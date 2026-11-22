import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { deserializeWorld, serializeWorld, validateWorld } from '../../src/sim/serialization';
import type { World } from '../../src/sim/types';
import { nightEncounter } from '../scenarios/disturbance';
import { expectWorld, observeErrors, panel, pause, saveKey } from './helpers';

// Read-only renderer probe. It is injected into the browser by this test only.
const probe = `
window.__comicView = null;
const comicFrame = ColonyRenderer.prototype.frame;
ColonyRenderer.prototype.frame = function(now) {
  const result = comicFrame.call(this, now);
  if (!this.preparing) window.__comicView = this;
  return result;
};`;

async function loadPrepared(page: Page, initial: World, raw = serializeWorld(initial)): Promise<void> {
  expect(validateWorld(initial)).toEqual([]);
  await page.addInitScript(({ key, data }) => localStorage.setItem(key, data), { key: saveKey, data: raw });
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: probe + await response.text() });
  });
  await page.goto('/?scenario=camp&size=32&e2e');
  await expect(page.locator('#loading')).toHaveCount(0);
  await pause(page);
  await panel(page, 'menu');
  await page.locator('#load').click();
  await expectWorld(page, initial);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !!(window as any).__comicView);
}

async function setCamera(page: Page, x: number, z: number, zoom: number): Promise<void> {
  await page.evaluate(({ x, z, zoom }) => {
    const view = (window as any).__comicView;
    view.controls.enableDamping = false;
    view.rig.setMode('orthographic');
    view.controls.target.set(x, 0, z);
    view.camera.zoom = zoom;
    view.camera.updateProjectionMatrix();
    view.controls.update();
  }, { x, z, zoom });
  // Let the renderer adopt this view. No simulation tick is permitted here.
  await page.waitForTimeout(120);
}

async function inspect(page: Page) {
  return page.evaluate(() => {
    const view = (window as any).__comicView;
    const counts = (group: any) => {
      let resident = 0, visible = 0, instances = 0;
      group.traverse((part: any) => {
        if (part.isMesh || part.isSprite) {
          resident++;
          if (part.visible && group.visible) visible++;
          instances += part.geometry?.instanceCount ?? 0;
        }
      });
      return { resident, visible, instances };
    };
    const action = counts(view.actionVfx.group);
    const mesh = view.actionVfx.mesh;
    const source = view.pawns.feedbackSource;
    return {
      backend: view.backend,
      tick: view.world.tick,
      actorCount: view.world.pawns.length,
      action,
      actionCount: mesh?.geometry?.instanceCount ?? null,
      sharedPose: mesh?.geometry && source ? ['aFrom', 'aTo', 'aTravel'].every(name =>
        mesh.geometry.getAttribute(name) === source.getAttribute(name)) : null,
      actionClock: view.actionVfx.time?.value ?? null,
      detail: view.rig.pixelsPerCell(view.host.clientHeight),
      overview: view.overview.group.visible,
    };
  });
}

test('V128: sleep Z stays batched, pauses with the world and disappears at detail LOD (the fight cloud was removed on 22 November 2026)', async ({ playwright }) => {
  test.setTimeout(120_000);
  const fightRaw = readFileSync(new URL('../../public/test-saves/v125/insulte-bagarre.json', import.meta.url), 'utf8');
  const scenes: { name: string; world: World; raw?: string; focus: { x: number; z: number } }[] = [
    { name: 'fight', world: deserializeWorld(fightRaw), raw: fightRaw, focus: { x: 16.5, z: 15.5 } },
    { name: 'sleep', world: nightEncounter(), focus: { x: 6, z: 10 } },
  ];
  const browser = await playwright.chromium.launch({ channel: 'chromium', headless: false, args: [] });
  const residentCounts: { action: number }[] = [];
  try {
    for (const scene of scenes) {
      const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 } });
      const errors = observeErrors(page);
      try {
        await loadPrepared(page, scene.world, scene.raw);
        await setCamera(page, scene.focus.x, scene.focus.z, 6);
        const close = await inspect(page);
        expect(close.backend).toBe('WebGPU');
        expect(close.detail).toBeGreaterThan(18);
        residentCounts.push({ action: close.action.resident });
        expect(close.action.resident).toBeGreaterThan(0);
        if (scene.name !== 'fight') {
          expect(close.action.visible).toBeGreaterThan(0);
          expect(close.actionCount).toBeGreaterThan(0);
        }
        if (close.sharedPose !== null) expect(close.sharedPose).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`comic-v128-${scene.name}-close.png`) });

        if (scene.name === 'fight') {
          await page.evaluate(() => (window as any).__comicView.rig.setMode('perspective'));
          await page.waitForTimeout(120);
          await page.screenshot({ path: test.info().outputPath('comic-v128-fight-perspective.png') });
          await page.evaluate(() => (window as any).__comicView.rig.setMode('orthographic'));
        }

        await page.waitForTimeout(180);
        const paused = await inspect(page);
        expect(paused.tick).toBe(close.tick);
        if (close.actionClock !== null) expect(paused.actionClock).toBe(close.actionClock);

        await setCamera(page, scene.focus.x, scene.focus.z, .45);
        const distant = await inspect(page);
        expect(distant.detail).toBeLessThan(18);
        expect(distant.action.visible).toBe(0);
        expect(distant.tick).toBe(close.tick);
        await page.screenshot({ path: test.info().outputPath(`comic-v128-${scene.name}-distant.png`) });
        expect(errors).toEqual([]);
      } finally { await page.close(); }
    }
    expect(residentCounts).toHaveLength(2);
    expect(residentCounts[1]).toEqual(residentCounts[0]);
  } finally { await browser.close(); }
});
