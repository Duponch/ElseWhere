import { writeTestFile } from '../test-output.ts';
import { expect, test } from '@playwright/test';

import { serializeWorld, validateWorld } from '../../src/sim/serialization';
import { appearanceOf } from '../../src/sim/pawn-appearance';
import { WORK_POSE } from '../../src/render/work-presentation';
import { equipmentCamp } from '../scenarios/equipment';
import { expectWorld, observeErrors, panel, pause, saveKey } from './helpers';

const probe = `
window.__junctionView=null;
const junctionFrame=ColonyRenderer.prototype.frame;
ColonyRenderer.prototype.frame=function(...args){
  const result=junctionFrame.apply(this,args);
  if(!this.preparing)window.__junctionView=this;
  return result;
};`;

test('V136: the same colon keeps connected shoulder and waist silhouettes standing and crouched in WebGPU', async ({ playwright }) => {
  test.setTimeout(150_000);
  const browser = await playwright.chromium.launch({ channel: 'chromium', args: [] });
  const records: { state: string; angle: string; pose: number; backend: string; actors: number; tick: number }[] = [];
  try {
    for (const state of ['standing', 'crouched'] as const) {
      const prepared = equipmentCamp(1), pawn = prepared.pawns[0]!;
      prepared.piles = [];
      pawn.x = 12; pawn.z = 12; pawn.path = [];
      delete pawn.motion;
      const appearance = appearanceOf(pawn, prepared.seed);
      pawn.appearance = { ...appearance, bodyType: appearance.sex === 'male' ? 'Male' : 'Female' };
      pawn.state = state === 'standing' ? 'idle' : 'working';
      pawn.jobId = null;
      if (state === 'crouched') {
        pawn.priorities.grow = 1;
        const zone = { id: prepared.nextId++, cells: [13 * prepared.width + 12],
          plant: 'rice' as const, allowSow: true, allowCut: true };
        prepared.growingZones.push(zone);
        const job = { id: prepared.nextId++, kind: 'sow' as const, x: 12, z: 13,
          orientation: 0 as const, footprint: 'standard' as const, status: 'active' as const,
          reservedBy: pawn.id, progress: 0, escrow: { wood: 0, food: 0 }, growingZoneId: zone.id };
        prepared.jobs.push(job);
        pawn.jobId = job.id;
      }
      expect(validateWorld(prepared)).toEqual([]);
      const page = await browser.newPage({ baseURL: 'http://127.0.0.1:5173', viewport: { width: 1440, height: 1000 } });
      const errors = observeErrors(page);
      try {
        await page.addInitScript(({ key, data }) => localStorage.setItem(key, data),
          { key: saveKey, data: serializeWorld(prepared) });
        await page.route('**/src/main.ts*', async route => {
          const response = await route.fetch();
          await route.fulfill({ response, body: probe + await response.text() });
        });
        await page.goto('/?scenario=camp&size=32&e2e');
        await expect(page.locator('#loading')).toHaveCount(0);
        await pause(page);
        await panel(page, 'menu');
        await page.locator('#load').click();
        await expectWorld(page, prepared);
        await page.keyboard.press('Escape');
        await page.waitForFunction(() => !!(window as any).__junctionView);
        for (const angle of ['front', 'side'] as const) {
          const observed = await page.evaluate(({ x, z, angle }) => {
            const view = (window as any).__junctionView;
            view.controls.enableDamping = false;
            view.rig.setMode('orthographic');
            view.controls.maxZoom = 12;
            const yaw = view.pawns.feedbackSource.getAttribute('aTo').getW(0);
            const forwardX = Math.sin(yaw), forwardZ = Math.cos(yaw);
            const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
            view.controls.target.set(x, .8, z);
            view.camera.position.set(x + 7 * (angle === 'front' ? forwardX : rightX), 2.8,
              z + 7 * (angle === 'front' ? forwardZ : rightZ));
            view.camera.zoom = 9.5;
            view.camera.updateProjectionMatrix();
            view.controls.update();
            view.actionParticles.group.visible = false;
            view.actionFeedback.group.visible = false;
            const notice = document.querySelector<HTMLElement>('#notice');
            if (notice) notice.style.display = 'none';
            const geometry = view.pawns.feedbackSource;
            return { backend: view.backend, actors: geometry.instanceCount,
              pose: geometry.getAttribute('aMotion').getZ(0), tick: view.world.tick };
          }, { x: pawn.x, z: pawn.z, angle });
          expect(observed).toMatchObject({ backend: 'WebGPU', actors: 1,
            pose: state === 'standing' ? 0 : WORK_POSE.ground, tick: prepared.tick });
          await page.waitForTimeout(250);
          await page.screenshot({
            path: test.info().outputPath(`pawn-junction-v136-${state}-${angle}.png`),
            clip: { x: 420, y: 170, width: 600, height: 660 },
          });
          records.push({ state, angle, ...observed });
        }
        expect(errors).toEqual([]);
      } finally {
        await page.close();
      }
    }
  } finally {
    await writeTestFile(test.info().outputPath('pawn-junction-v136-captures.json'), JSON.stringify(records, null, 2));
    await browser.close();
  }
});
