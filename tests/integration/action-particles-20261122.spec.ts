import { expect, test, type Page } from '@playwright/test';
import { serializeWorld, validateWorld } from '../../src/sim/serialization';
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
    const view = (window as any).__comicView, layer = view.actionParticles, mesh = layer.mesh;
    return {
      backend: view.backend,
      tick: view.world.tick,
      resident: layer.group.children.length,
      visible: mesh.visible && layer.group.visible ? 1 : 0,
      emitters: mesh.geometry.instanceCount,
      records: mesh.geometry.getAttribute('eA').data.array.length,
      clock: layer.time.value,
      detail: view.rig.pixelsPerCell(view.host.clientHeight),
    };
  });
}

/** Real WebGPU client: the drawn sleep marks of a prepared night camp stay in
 * one resident instanced draw with a fixed pool, freeze with the paused
 * world, and disappear at far zoom. The former comic sprites (V128) and fight
 * cloud were replaced by the action particles of 22 November 2026. */
test('action particles: one resident pool, frozen in pause, hidden far away', async ({ playwright }) => {
  test.setTimeout(120_000);
  const browser = await playwright.chromium.launch({ channel: 'chromium', headless: false, args: ['--mute-audio'] });
  try {
    const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 } });
    const errors = observeErrors(page);
    try {
      await loadPrepared(page, nightEncounter());
      await setCamera(page, 6, 10, 6);
      const close = await inspect(page);
      expect(close.backend).toBe('WebGPU');
      expect(close.resident).toBe(1);
      expect(close.visible).toBe(1);
      expect(close.emitters).toBeGreaterThan(0);
      await page.screenshot({ path: test.info().outputPath('action-particles-sleep-close.png') });
      await page.waitForTimeout(180);
      const paused = await inspect(page);
      expect(paused.tick).toBe(close.tick);
      expect(paused.clock).toBe(close.clock);
      expect(paused.records).toBe(close.records);
      await setCamera(page, 6, 10, .2);
      const distant = await inspect(page);
      expect(distant.detail).toBeLessThan(9);
      expect(distant.visible).toBe(0);
      expect(distant.tick).toBe(close.tick);
      expect(errors).toEqual([]);
    } finally { await page.close(); }
  } finally { await browser.close(); }
});
