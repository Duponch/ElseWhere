// Measurement tool (not product code). Real client in headed Chromium (real
// WebGPU and GPU timestamp queries) against a running Vite dev server: loads a
// save, lets it run at ×1 so the colonists work, then measures, A/B/A with the
// action particle layer drawn / hidden / drawn:
//   frame   CPU of renderer.frame (JS and command submission)
//   layer   CPU of the layer's own update + present calls
//   gpu     sum of the render passes of a frame (timestamp queries)
// at pause and at ×1. The layer is found as `actionParticles` (since the
// 22 November rewrite) or `actionVfx` (the former layer).
// Usage: node scripts/perf-action-particles.mjs <port> <save URL path> <seconds per window> <out.json>
// Each speed: one discarded warm-up window, then three A/B pairs pooled per arm.
// STRESS=<n> adds n synthetic emitters at pause (new layer only).
// In Git Bash, set MSYS_NO_PATHCONV=1 so the save path is not rewritten.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [port = '5317', save = '/test-saves/v432/les-forges-crash-test.json', secs = '4', out] = process.argv.slice(2);
if (!out) throw Error('Usage: perf-action-particles <port> <save> <seconds> <out.json>');
const hook = `
;window.__perf={get view(){return renderer},get world(){return snapshot},
 get ready(){return !session.busy&&!replacingWorld&&!presentationPreparation},
 get blocked(){return !!(simulationStopped||graphicsFault||waitingRequests.size||replacingWorld||frontMenu.isOpen()||document.hidden)},
 loadUrl:async url=>{const text=await (await fetch(url)).text();return replaceColony(()=>session.loadExternal(()=>readSaveFile(new File([text],'s.json'))));},
 speedTo:value=>changeSpeed(value,client.getThreatPauseToken())};
`;
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? 'E:/Code/RimWorld/.playwright/chromium-1243/chrome-win64/chrome.exe', headless: false,
  args: ['--mute-audio', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  for (const [k, v] of Object.entries({ 'lisiere.audio.effects.enabled.v1': 'false', 'lisiere.audio.music.enabled.v1': 'false', 'lisiere.autosave-minutes.v1': '0', 'lisiere.presentation.threat-pause.v1': 'never' })) localStorage.setItem(k, v);
});
const page = await ctx.newPage(); page.setDefaultTimeout(900000);
const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.route('**/src/main.ts*', async route => { const response = await route.fetch(); await route.fulfill({ response, body: (await response.text()) + hook }); });
await page.goto(`http://127.0.0.1:${port}/?e2e=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__perf?.ready, undefined, { timeout: 300000 });
const t0 = Date.now();
await page.evaluate(u => window.__perf.loadUrl(u), save);
await page.waitForFunction(() => window.__perf?.view?.backend && !!window.__perf.world && !window.__perf.blocked, undefined, { timeout: 600000 });
const loadS = (Date.now() - t0) / 1000;
const setup = await page.evaluate(() => {
  const v = window.__perf.view, layer = v.actionParticles ?? v.actionVfx, r = v.renderer, b = r.backend;
  const st = window.__pa = { on: false, frame: [], layer: [], gpu: [], count: [], cur: 0 };
  const wrap = (object, name, key) => { const f = object[name]; object[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { if (st.on) st[key === 'frame' ? 'frameCur' : 'layerCur'] = (st[key === 'frame' ? 'frameCur' : 'layerCur'] ?? 0) + performance.now() - t; } }; };
  wrap(v, 'frame', 'frame'); wrap(layer, 'update', 'layer'); wrap(layer, 'present', 'layer');
  const timestamps = r.hasFeature?.('timestamp-query') === true && b.isWebGPUBackend;
  if (timestamps) b.trackTimestamp = true;
  const tick = () => {
    if (st.on) {
      st.frame.push(st.frameCur ?? 0); st.layer.push(st.layerCur ?? 0); st.frameCur = 0; st.layerCur = 0;
      st.count.push((v.actionParticles ?? v.actionVfx).mesh?.geometry?.instanceCount ?? 0);
      if (timestamps) r.resolveTimestampsAsync('render').then(ms => { if (st.on && typeof ms === 'number' && ms > 0) st.gpu.push(ms); }).catch(() => {});
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  // Centre the default orthographic camera on the colonists at work.
  const pawns = window.__perf.world.pawns.filter(p => p.state === 'working');
  const list = pawns.length ? pawns : window.__perf.world.pawns;
  const xs = list.map(p => p.x).sort((a, b) => a - b), zs = list.map(p => p.z).sort((a, b) => a - b);
  const cx = xs[xs.length >> 1], cz = zs[zs.length >> 1];
  v.controls.target.x = cx; v.controls.target.z = cz; v.controls.update();
  return { backend: v.backend, timestamps, working: pawns.length, pawns: window.__perf.world.pawns.length, centre: [cx, cz], layerName: v.actionParticles ? 'actionParticles' : 'actionVfx' };
});
const stats = values => { const s = [...values].sort((a, b) => a - b), at = q => s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * q))].toFixed(3) : null;
  return { n: s.length, mean: s.length ? +(s.reduce((a, b) => a + b, 0) / s.length).toFixed(3) : null, p50: at(.5), p95: at(.95) }; };
const arm = async (label, visible) => {
  await page.evaluate(visible => { const v = window.__perf.view, layer = v.actionParticles ?? v.actionVfx; layer.group.visible = visible; const st = window.__pa; st.frame = []; st.layer = []; st.gpu = []; st.count = []; st.frameCur = 0; st.layerCur = 0; }, visible);
  await page.waitForTimeout(400);
  await page.evaluate(() => { window.__pa.on = true; });
  await page.waitForTimeout(Number(secs) * 1000);
  return page.evaluate(label => { const st = window.__pa; st.on = false; return { label, frame: st.frame, layer: st.layer, gpu: st.gpu, count: st.count }; }, label);
};
const median = values => { const s = [...values].sort((a, b) => a - b); return s.length ? +s[s.length >> 1].toFixed(3) : null; };
const mean = values => values.length ? +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(3) : null;
/** Alternating windows A (drawn) / B (hidden), pooled per arm after one discarded warm-up window. */
const alternate = async (label, rounds) => {
  await arm(`${label}-warmup`, true);
  const pooled = { A: { frame: [], layer: [], gpu: [], count: [] }, B: { frame: [], layer: [], gpu: [], count: [] } };
  for (let i = 0; i < rounds * 2; i++) {
    const side = i % 2 ? 'B' : 'A', raw = await arm(`${label}-${side}${i >> 1}`, side === 'A');
    for (const k of ['frame', 'layer', 'gpu', 'count']) pooled[side][k].push(...raw[k]);
  }
  for (const side of ['A', 'B']) {
    const p = pooled[side];
    report.windows.push({ label: `${label}-${side}`, frames: p.frame.length, frame: { mean: mean(p.frame), median: median(p.frame), p95: stats(p.frame).p95 }, layer: { mean: mean(p.layer) },
      gpu: { n: p.gpu.length, mean: mean(p.gpu), median: median(p.gpu) }, emitters: mean(p.count) });
  }
};
const report = { date: new Date().toISOString(), save, loadS, setup, windows: [], errors };
await page.evaluate(() => window.__perf.speedTo(1));
await page.waitForTimeout(8000);
for (const speed of [0, 1]) {
  await page.evaluate(s => window.__perf.speedTo(s), speed);
  await page.waitForTimeout(1500);
  await alternate(speed === 0 ? 'pause' : 'x1', 3);
}
// Optional stress (new layer only): STRESS=n synthetic emitters spread around
// the camera target, cycling through every catalogued action, at pause.
const stress = Number(process.env.STRESS ?? 0);
if (stress > 0) {
  await page.evaluate(() => window.__perf.speedTo(0));
  const placed = await page.evaluate(async n => {
    const v = window.__perf.view, layer = v.actionParticles;
    if (!layer) return 0;
    const { ACTION_PARTICLES, actionParticleIndex, actorParticleSeed } = await import('/src/render/action-particle-catalogue.ts');
    const repeating = ACTION_PARTICLES.filter(a => !a.once), list = [], t = v.controls.target, side = Math.ceil(Math.sqrt(n));
    for (let i = 0; i < n; i++) {
      const a = repeating[i % repeating.length], x = t.x - side / 2 * 1.6 + (i % side) * 1.6, z = t.z - side / 2 * 1.6 + Math.floor(i / side) * 1.6;
      list.push({ action: actionParticleIndex(a.id), choice: { action: a.id, tx: x, tz: z + 1, ty: .85 }, row: -1, seed: actorParticleSeed(i), stroke: 0, pose: { x, y: 0, z, yaw: 0 }, startTick: -1, endTick: 0 });
    }
    layer.update = () => {}; layer.emitters = list; layer.events = []; layer.dirty = true;
    // Keep the particle clock running while the world is paused.
    const present = layer.present.bind(layer), start = performance.now();
    layer.present = tick => present(tick + (performance.now() - start) / 1000 * 6);
    return list.length;
  }, stress);
  await page.waitForTimeout(1000);
  await alternate(`stress${placed}`, 3);
}
await page.evaluate(() => window.__perf.speedTo(0));
writeFileSync(out, JSON.stringify(report, null, 1));
for (const w of report.windows) console.log(w.label.padEnd(14), 'frame mean', w.frame.mean, 'med', w.frame.median, 'p95', w.frame.p95, '| layer', w.layer.mean, '| gpu mean', w.gpu.mean, 'med', w.gpu.median, 'n', w.gpu.n, '| emitters', w.emitters);
console.log(JSON.stringify(setup), 'errors', errors.length);
await browser.close();
