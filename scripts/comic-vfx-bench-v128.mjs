import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Short presentation-only A/B/A probe. Start Vite first (`npm run dev`).
 * The synthetic world exists only in the renderer, with the GameSession paused.
 * This isolates comic brawl/Z effects from simulation and from other V126 effects. */
const base = process.env.COMIC_VFX_BENCH_URL ?? 'http://127.0.0.1:5173';
const durationMs = Number(process.env.COMIC_VFX_BENCH_DURATION_MS ?? 1800);
const report = {
  date: new Date().toISOString(), base, viewport: { width: 1440, height: 1000 },
  protocol: 'Paused synthetic 64² scene with 100 visible actors: 20 reciprocal contact fights (40 actors), 30 sleepers, 30 idle. Fixed orthographic camera, native Chromium/WebGPU, A/B/A ActionVfxLayer visible/hidden/visible (the comic brawl cloud was removed on 22 November 2026; melee now jolts the bodies in PawnLayer). PawnLayer poses remain active in A and B. 45 RAF warmup frames then 1.8 s per arm. RAF interval is display paced; absolute frame CPU is JS/render submission, not GPU execution. No threshold or simulation claim.',
  scene: null, adapter: null, runtime: null, phases: [], errors: [],
};
const statistics = values => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = q => sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))].toFixed(3) : null;
  return { count: sorted.length, p50: at(.5), p95: at(.95), max: at(1) };
};
process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.playwright');
const { chromium } = await import('playwright');
const browser = await chromium.launch({ channel: 'chromium', headless: false });
try {
  const page = await browser.newPage({ viewport: report.viewport });
  page.setDefaultTimeout(20_000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' || /GPUValidationError|invalid pipeline/i.test(message.text())) report.errors.push(message.text());
  });
  // Capture the same frame boundary for both arms without modifying the game.
  const probe = `
window.__comicVfxBench={view:null,active:false,enabled:true,frames:[],intervals:[],previous:null};
const comicFrame=ColonyRenderer.prototype.frame;
ColonyRenderer.prototype.frame=function(now){
  const b=window.__comicVfxBench;b.view=this;
  const start=performance.now(),result=comicFrame.call(this,now);
  if(b.active&&!this.preparing){b.frames.push(performance.now()-start);if(b.previous!==null)b.intervals.push(now-b.previous);b.previous=now;}
  return result;
};
`;
  // `node --check` does not parse this browser-injected source.
  new Function(probe);
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, body: probe + await response.text() });
  });
  await page.goto(`${base}/?scenario=camp&size=64&e2e`);
  await page.waitForFunction(() => window.__comicVfxBench?.view && !window.__comicVfxBench.view.preparing, undefined, { timeout: 60_000 });
  await page.locator('[data-speed="0"]').click();
  report.scene = await page.evaluate(async () => {
    const b = window.__comicVfxBench, v = b.view;
    const { createWorld } = await import('/src/sim/index.ts');
    const w = createWorld(128, 64, 64), basePawn = structuredClone(w.pawns[0]);
    w.tick = 100;
    w.jobs = []; w.structures = []; w.piles = [];
    w.pawns = Array.from({ length: 100 }, (_, i) => {
      const p = structuredClone(basePawn);
      p.id = w.nextId++; p.name = `Acteur ${i + 1}`;
      p.jobId = null; p.haul = null; p.cooking = null; p.need = null;
      p.research = undefined; p.shooting = undefined; p.melee = undefined;
      p.path = []; p.motion = null; p.body = undefined;
      if (i < 40) {
        const pair = Math.floor(i / 2), side = i % 2;
        p.x = 14 + (pair % 5) * 4 + side;
        p.z = 14 + Math.floor(pair / 5) * 3;
        p.state = 'idle';
        p.social = { rng: p.id || 1, memories: [], fight: { opponentId: -1, startedAt: 80 } };
      } else if (i < 70) {
        const n = i - 40;
        p.x = 14 + (n % 10) * 2;
        p.z = 28 + Math.floor(n / 10) * 3;
        p.state = 'sleeping'; p.social = undefined;
      } else {
        const n = i - 70;
        p.x = 14 + (n % 10) * 2;
        p.z = 38 + Math.floor(n / 10) * 3;
        p.state = 'idle'; p.social = undefined;
      }
      return p;
    });
    for (let i = 0; i < 40; i += 2) {
      const a = w.pawns[i], other = w.pawns[i + 1];
      a.social.fight.opponentId = other.id;
      other.social.fight.opponentId = a.id;
      // A confirmed strike on half the pairs exercises event-linked bursts.
      if (i < 20) a.melee = { order: { targetId: other.id, startedDowned: false, auto: 'social' },
        strike: { targetId: other.id, atCore: 997, untilCore: 1117, tool: 'left-fist', outcome: 'hit' } };
    }
    v.setWorld(w, true, 0);
    v.rig.setMode('orthographic'); v.controls.enableDamping = false;
    v.controls.target.set(23, 0, 29.5);
    v.camera.position.set(41, 31, 49.5); v.camera.zoom = .78;
    v.camera.updateProjectionMatrix(); v.controls.update(); v.camera.updateMatrixWorld(true);
    const render = v.renderer.render.bind(v.renderer);
    v.renderer.render = function (scene, camera) {
      v.actionVfx.group.visible = b.enabled;
      return render(scene, camera);
    };
    return { actors: 100, reciprocalPairs: 20, confirmedStrikes: 10, sleeping: 30, idle: 30 };
  });
  await page.waitForTimeout(900);
  report.runtime = await page.evaluate(() => {
    const v = window.__comicVfxBench.view;
    const adapter = v.renderer.getContext()?.getConfiguration?.()?.device?.adapterInfo ?? {};
    const visibleActorCenters = v.world.pawns.filter(p => {
      const point = v.camera.position.clone().set(p.x, 1.2, p.z).project(v.camera);
      return Math.abs(point.x) < .98 && Math.abs(point.y) < .98;
    }).length;
    return {
      backend: v.backend,
      adapter: { vendor: adapter.vendor ?? 'unknown', architecture: adapter.architecture ?? 'unknown', description: adapter.description ?? '' },
      actionInstances: v.actionVfx.mesh.geometry.instanceCount,
      actionVisible: v.actionVfx.mesh.visible,
      visibleActorCenters, detail: v.rig.pixelsPerCell(v.host.clientHeight), distant: v.overview.group.visible,
    };
  });
  assert.equal(report.runtime.backend, 'WebGPU');
  assert.ok(report.runtime.actionInstances > 0 && report.runtime.actionVisible);
  assert.equal(report.runtime.visibleActorCenters, 100, 'All actor centers must be in the viewport.');
  assert.ok(report.runtime.detail >= 18, 'Action VFX LOD must stay visible.');
  assert.equal(report.runtime.distant, false);
  report.adapter = report.runtime.adapter;
  mkdirSync('artifacts', { recursive: true });
  const waitFrames = n => page.evaluate(n => new Promise(resolve => {
    const step = () => { if (--n <= 0) resolve(); else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }), n);
  for (const [name, enabled] of [['A-visible', true], ['B-hidden', false], ['A-visible-repeat', true]]) {
    await page.evaluate(enabled => { const b = window.__comicVfxBench; b.enabled = enabled; b.active = false; }, enabled);
    await waitFrames(45);
    await page.evaluate(() => {
      const b = window.__comicVfxBench; b.frames = []; b.intervals = []; b.previous = null; b.active = true;
    });
    await page.waitForTimeout(durationMs);
    const data = await page.evaluate(() => {
      const b = window.__comicVfxBench; b.active = false;
      return { frames: b.frames, intervals: b.intervals, calls: b.view.stats.drawCalls,
        triangles: b.view.stats.triangles, tick: b.view.world.tick };
    });
    report.phases.push({ name, enabled, intervals: statistics(data.intervals), frameCpu: statistics(data.frames),
      fps: data.intervals.length ? +(1000 / (data.intervals.reduce((a, c) => a + c, 0) / data.intervals.length)).toFixed(1) : null,
      drawCalls: data.calls, triangles: data.triangles, tick: data.tick });
    // Capture after measurement, never inside its timed interval. The central
    // crop excludes HUD counters; a changed A/B hash is an oracle against a
    // stale WebGPU bundle still drawing the VFX after group.visible=false.
    const screenshot = await page.screenshot({ path: `artifacts/comic-vfx-bench-v128-${name}.png`,
      clip: { x: 350, y: 220, width: 760, height: 560 } });
    report.phases.at(-1).imageHash = createHash('sha256').update(screenshot).digest('hex');
  }
  assert.equal(new Set(report.phases.map(phase => phase.tick)).size, 1, 'Benchmark world must remain paused.');
  assert.notEqual(report.phases[0].imageHash, report.phases[1].imageHash,
    'Hiding VFX did not alter central scene pixels; reject a stale-bundle A/B/A result.');
  assert.notEqual(report.phases[1].imageHash, report.phases[2].imageHash,
    'Restoring VFX did not alter central scene pixels; reject A/B/A result.');
  assert.equal(report.errors.length, 0, 'Native console/GPU errors');
  await page.close();
} finally {
  await browser.close();
  mkdirSync('artifacts', { recursive: true });
  writeFileSync('artifacts/comic-vfx-bench-v128.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report));
