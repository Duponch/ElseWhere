import { writeTestFile } from '../test-output.ts';
import { isBuildableFloor,type BuildableFloorKind } from '../../src/sim/flooring';
import { expect, test, type Page } from '@playwright/test';
import { isDeepStrictEqual } from 'node:util';

import type { World } from '../../src/sim/types';

declare global {
  interface Window {
    __lisiere: { world: World; tick: number; backend: string; audio: { loadedCount: number; availableSounds: number }; saveRepository: import('../../src/ui/save-repository').BrowserSaveRepository; incident: { simulationStopped: boolean; graphicsFault: boolean; waiting: number }; failGraphics(message?: string): void; loseGraphicsDevice(): boolean; stopSimulation(): void; projectCell(x: number, z: number): { x: number; y: number }; projectPawn(id:number):{x:number;y:number;radius:number;depth:number}|undefined };
  }
}

// Transport one JSON string: tracing every tile as a remote object can dominate large maps.
export const serializedWorld = (page: Page): Promise<string> => page.evaluate(() => JSON.stringify(window.__lisiere.world));
export const world = async (page: Page): Promise<World> => JSON.parse(await serializedWorld(page)) as World;
/** Pause is an ordered worker command. A click alone does not prove that the
 * final snapshot is adopted; never capture a save oracle before this returns. */
export async function pause(page: Page): Promise<void> {
  const button=page.locator('[data-speed="0"]');
  if(await button.getAttribute('aria-pressed')!=='true')await button.click();
  await expect(button).toHaveAttribute('aria-pressed','true');
}
export async function expectWorld(page: Page, expected: World) {
  // The pre-load snapshot can already equal expected: wait for replacement and
  // presentation to finish before comparing, otherwise the assertion is vacuous.
  await expect(page.locator('.game-shell')).toHaveJSProperty('inert',false);
  const serialized = JSON.stringify(expected);
  // Preserve all values and array order. Object insertion order can differ
  // between a sparse delta and a checkpoint; it is not simulation state.
  let actual = serialized;
  try {
    await expect.poll(async () => {
      actual = await serializedWorld(page);
      return actual === serialized || isDeepStrictEqual(JSON.parse(actual), expected);
    }, {message: `État exact : graine ${expected.seed}, carte ${expected.width}×${expected.height}, tick ${expected.tick}, ${expected.jobs.length} ordre(s)`}).toBe(true);
    if(actual!==serialized)await test.info().attach('save-object-key-order',{contentType:'application/json',body:JSON.stringify({tick:expected.tick,semanticEquality:true})});
  } catch(error) {
    const path=test.info().outputPath('save-mismatch.json');
    await writeTestFile(path,JSON.stringify({expected,actual:JSON.parse(actual),notice:await page.locator('#notice').textContent()}));
    await test.info().attach('save-mismatch',{contentType:'application/json',path});
    throw error;
  }
}
export const saveKey = 'lisiere.save.v1';

export function observeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /GPUValidationError|Error while parsing|invalid pipeline/i.test(message.text())) errors.push(message.text());
  });
  return errors;
}

export async function panel(page: Page, name: 'quests' | 'world' | 'wildlife' | 'research' | 'architect' | 'work' | 'schedule' | 'assign' | 'menu') {
    // Snapshot adoption precedes GPU preparation and the closing of old panels.
    // Wait for the same interactive state a player needs, not just visibility.
    await expect(page.locator('.game-shell')).toHaveJSProperty('inert', false);
  if (!await page.locator(`#${name}-panel`).isVisible()) await page.locator(`[data-panel="${name}"]`).click();
  await expect(page.locator(`#${name}-panel`)).toBeVisible();
}

export type PawnInspectorTab = 'journal' | 'bio' | 'needs' | 'health' | 'gear' | 'social' | 'prisoner';

/** Open one real pawn-inspector tab and wait for its associated panel. */
export async function pawnTab(page: Page, tab: PawnInspectorTab): Promise<void> {
  const button = page.locator(`[data-colonist-tab="${tab}"]`);
  await expect(button).toBeVisible();
  if (await button.getAttribute('aria-selected') !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator(`[data-colonist-panel="${tab}"]`)).toBeVisible();
}

export async function tool(page: Page, name: 'allow'|'forbid'|BuildableFloorKind|'smooth-floor'|'build-bridge'|'remove-bridge'|'snow-clear'|'remove-snow-clear'|'sleeping-spot'|'shelf'|'small-shelf'|'spike-trap'|'electric-crematorium'|'mini-turret'|'remove-floor'|'grave'|'heater'|'wind-turbine'|'solar-generator'|'battery'|'power-conduit'|'power-switch'|'fueled-stove'|'electric-stove'|'butcher-table'|'butcher-spot'|'cooler'|'research-bench'|'tailor-bench'|'crafting-spot'|'home'|'remove-home'|'wood-generator'|'sun-lamp'|'standing-lamp'|'passive-cooler'|'build-roof'|'remove-roof'|'ignore-roof'|'door' | 'stonecutter' | 'mine' | 'haul-chunks' | 'uninstall' | 'deconstruct' | 'select' | 'chop' | 'harvest' | 'cut' | 'cancel' | 'wall' | 'bed' | 'double-bed' | 'table' | 'horseshoes' | 'stool' | 'campfire' | 'stockpile' | 'remove-stockpile' | 'growing' | 'remove-growing') {
  // Inspecter is the native default since V348; the redundant button was removed.
  if(name==='select'){
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-tool].active')).toHaveCount(0);
    return;
  }
  const category = isBuildableFloor(name)||name==='remove-floor'||name==='build-bridge'||name==='remove-bridge'?'floors':name==='grave'?'furniture':name === 'wind-turbine' || name === 'solar-generator' || name === 'battery' || name === 'power-conduit' || name === 'power-switch' || name === 'wood-generator' ? 'power' : name === 'standing-lamp' || name === 'sun-lamp' ? 'furniture' : name === 'electric-crematorium' || name === 'fueled-stove' || name === 'electric-stove' || name === 'butcher-table' || name === 'butcher-spot' || name === 'research-bench' || name === 'tailor-bench' || name === 'stonecutter' || name === 'crafting-spot' ? 'production' : name === 'horseshoes' ? 'recreation' : name === 'heater' || name === 'cooler' || name === 'campfire' || name === 'passive-cooler' ? 'temperature' : name === 'spike-trap' || name === 'door' || name === 'wall' || name === 'mini-turret' ? 'structure' : name === 'sleeping-spot' || name === 'shelf' || name === 'small-shelf' || name === 'bed' || name === 'double-bed' || name === 'table' || name === 'stool' ? 'furniture' : name==='snow-clear'||name==='remove-snow-clear'||name==='home'||name==='remove-home'||name === 'build-roof' || name === 'remove-roof' || name === 'ignore-roof' || name === 'stockpile' || name === 'remove-stockpile' || name === 'growing' || name === 'remove-growing' ? 'zones' : 'orders';
  if(category==='orders'||category==='zones'){
    const heading=page.locator(`#${category}-open`);
    // The map dock is hidden while a main panel is open. Close that panel by
    // the player's Escape path before choosing an external map tool.
    if(!await heading.isVisible())await page.keyboard.press('Escape');
    await expect(heading).toBeVisible();
    if(await heading.getAttribute('aria-expanded')!=='true')await heading.click();
  }else{
    await panel(page, 'architect');
    await page.locator(`[data-category="${category}"]`).click();
  }
  await page.locator(`[data-tool="${name}"]`).click();
}

/** Wheel/pan damping can continue after the target becomes visible. At map
 * overview a few screen pixels are a different cell. Observe stability before
 * acting, as a player does; do not disable damping or bypass the pointer path. */
export async function settledCells(page:Page,cells:{x:number;z:number}[]) {
  const sample=await page.evaluate(cells=>new Promise<{points:{x:number;y:number}[];shift:number;milliseconds:number}>((resolve,reject)=>{
    const project=()=>cells.map(c=>window.__lisiere.projectCell(c.x,c.z));
    const first=project(),start=performance.now();let previous=first,stable=0;
    const observe=()=>{const points=project(),now=performance.now();
      const delta=Math.max(...points.map((p,i)=>Math.hypot(p.x-previous[i]!.x,p.y-previous[i]!.y)));previous=points;
      stable=delta<.03?stable+1:0;
      if(stable>=3)resolve({points,shift:Math.max(...points.map((p,i)=>Math.hypot(p.x-first[i]!.x,p.y-first[i]!.y))),milliseconds:now-start});
      else if(now-start>8000)reject(new Error('Camera projection did not settle within 8000 ms.'));
      else requestAnimationFrame(observe);
    };requestAnimationFrame(observe);
  }),cells);
  if(process.env.CAMERA_TRACE==='1'&&sample.shift>.25)console.info(JSON.stringify({cameraSettlement:{cells,shift:sample.shift,milliseconds:sample.milliseconds}}));
  return sample.points;
}
export async function cell(page: Page, x: number, z: number) {
  const architect=page.locator('#architect-panel');
  if(await architect.isVisible())await architect.locator('[data-close-panel]').click();
  const [point] = await settledCells(page,[{x,z}]);
  const bounds = await page.locator('#viewport canvas').boundingBox();
  if (!bounds) throw new Error('Canvas absent');
  expect(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.tagName,{x:bounds.x+point!.x,y:bounds.y+point!.y}),'Cell click must reach the visible canvas.').toBe('CANVAS');
  await page.mouse.click(bounds.x + point!.x, bounds.y + point!.y);
}
export async function dragRectangle(page: Page, from: { x: number; z: number }, to: { x: number; z: number }, release = true) {
  const architect=page.locator('#architect-panel');
  if(await architect.isVisible())await architect.locator('[data-close-panel]').click();
  const points = await settledCells(page,[from,to]);
  const bounds = await page.locator('#viewport canvas').boundingBox();
  if (!bounds) throw new Error('Canvas absent');
  expect(await page.evaluate(({ points, bounds }) => points.map(point => document.elementFromPoint(bounds.x + point.x, bounds.y + point.y)?.tagName), { points, bounds }), 'Les extrémités du tracé doivent être sur la carte visible, hors panneaux.').toEqual(['CANVAS', 'CANVAS']);
  await page.mouse.move(bounds.x + points[0].x, bounds.y + points[0].y); await page.mouse.down();
  await page.mouse.move(bounds.x + points[1].x, bounds.y + points[1].y, { steps: 6 });
  if (release) await page.mouse.up();
}

export async function startPaused(page: Page) {
  await page.goto('/?scenario=camp&size=32&seed=42&e2e');
  await expect(page.locator('#loading')).toHaveCount(0);
  await expect(page.locator('#viewport canvas')).toBeVisible();
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.locator('#pause-banner')).toBeVisible();
  expect((await world(page)).width).toBe(32);
}
