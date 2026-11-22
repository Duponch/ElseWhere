// Measurement tool (not product code). Real client in Chromium, against a
// profiling build made with scripts/perf-client-publication-config.mjs: loads a
// save, then records every animation frame for `seconds` at each speed:
// frame interval, RAF work, admission drain, resident adoption, receiveMainSnapshot,
// renderer.applyWorld / setWorld / renderScene / phases, HUD, and per Worker
// message the first `data` read (structured-clone deserialization, lazy in
// Chromium) and the listener time, split between complete publications
// (resident-publication) and actor phase packets. Long tasks are listed too.
// Usage: node scripts/perf-client-publication.mjs <port> <save URL path> <seconds> <speeds csv> <out.json>
//   CHROME=<chrome.exe> to choose the browser (default: the project's Playwright Chromium)
//   PROFILE=1 also writes a main-thread CPU profile of each window (diagnosis only: it adds overhead).
// Then: node scripts/perf-client-publication-summary.mjs out.json [...]
// Headless Chromium draws through three/webgpu's WebGL backend here: the GPU
// cost of the player's browser is not measured, the main-thread work is.
// In Git Bash, set MSYS_NO_PATHCONV=1 so the save path is not rewritten.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [port = '5311', save = '/test-saves/v432/les-forges-crash-test.json', secs = '20', speeds = '1,3', out] = process.argv.slice(2);
if (!out) throw Error('Usage: perf-client-publication <port> <save> <seconds> <speeds> <out.json>');
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? 'E:/Code/RimWorld/.playwright/chromium-1243/chrome-win64/chrome.exe', headless: true, args: ['--mute-audio', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  for (const [k, v] of Object.entries({ 'lisiere.audio.effects.enabled.v1': 'false', 'lisiere.audio.music.enabled.v1': 'false', 'lisiere.autosave-minutes.v1': '0', 'lisiere.presentation.threat-pause.v1': 'never' })) localStorage.setItem(k, v);
  const zero = () => ({ cb: 0, frame: 0, apply: 0, applyN: 0, setWorld: 0, render: 0, phases: 0, phaseSet: 0, phaseN: 0, deserFull: 0, deserPhase: 0, listenFull: 0, listenPhase: 0, onmsgFull: 0, onmsgPhase: 0, nFull: 0, nPhase: 0 });
  const st = window.__fa = { on: false, frames: [], cur: zero(), zero, last: 0, tasks: [], types: new WeakMap() };
  // Chromium deserializes a message at the first `data` read.
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data'), get = desc.get, seen = new WeakSet();
  Object.defineProperty(MessageEvent.prototype, 'data', { ...desc, get() {
    if (seen.has(this)) return get.call(this);
    seen.add(this); const t = performance.now(); const v = get.call(this); const d = performance.now() - t;
    const type = v && typeof v === 'object' ? v.type : undefined; st.types.set(this, type);
    if (type === 'resident-publication') st.cur.deserFull += d; else if (type === 'actor-frontier-297' || type === 'actor-phase-297') st.cur.deserPhase += d;
    return v;
  } });
  const timed = (fn, key) => function (ev) { const t = performance.now(); try { return fn.call(this, ev); } finally { const d = performance.now() - t, type = st.types.get(ev); if (type === 'resident-publication') { st.cur[key + 'Full'] += d; if (key === 'listen') st.cur.nFull++; } else if (type === 'actor-frontier-297' || type === 'actor-phase-297') { st.cur[key + 'Phase'] += d; if (key === 'listen') st.cur.nPhase++; } } };
  const add = Worker.prototype.addEventListener;
  Worker.prototype.addEventListener = function (type, fn, opts) { return add.call(this, type, type === 'message' && typeof fn === 'function' ? timed(fn, 'listen') : fn, opts); };
  const om = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage');
  Object.defineProperty(Worker.prototype, 'onmessage', { ...om, set(fn) { om.set.call(this, typeof fn === 'function' ? timed(fn, 'onmsg') : fn); } });
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(ts => { const t = performance.now(); try { cb(ts); } finally { st.cur.cb += performance.now() - t; } });
  // One record per animation frame, closed before the frame's callbacks run:
  // work between two frames (messages, timers, HUD) lands in the next record.
  const tick = ts => { const c2 = window.__c2; if (st.on) st.frames.push({ dt: ts - st.last, ...st.cur, ...(c2 ? c2.cur : {}) }); st.last = ts; st.cur = zero(); if (c2) c2.cur = c2.z(); raf(tick); };
  raf(tick);
  try { new PerformanceObserver(l => { if (st.on) for (const e of l.getEntries()) st.tasks.push(e.duration); }).observe({ type: 'longtask', buffered: false }); } catch { }
});
const page = await ctx.newPage(); page.setDefaultTimeout(900000);
const errors = []; page.on('pageerror', e => errors.push(String(e).slice(0, 300))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
page.on('crash', () => console.log('[crash]', new Date().toISOString()));
await page.goto(`http://127.0.0.1:${port}/?e2e=1`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__perf?.ready && window.__c2);
const t0 = Date.now();
await page.evaluate(u => window.__perf.loadUrl(u), save);
await page.waitForFunction(() => window.__perf?.view?.backend && !!window.__perf.world && !window.__perf.blocked);
const loadS = (Date.now() - t0) / 1000;
await page.evaluate(() => {
  const v = window.__perf.view, st = window.__fa;
  const wrap = (name, key, count) => { const f = v[name]; if (typeof f !== 'function') return; v[name] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { st.cur[key] += performance.now() - t; if (count) st.cur[count]++; } }; };
  wrap('frame', 'frame'); wrap('applyWorld', 'apply', 'applyN'); wrap('setWorld', 'setWorld'); wrap('renderScene', 'render'); wrap('presentCorePhases297', 'phases'); wrap('setCorePhase297', 'phaseSet', 'phaseN');
});
const result = { loadS, backend: await page.evaluate(() => window.__perf.view.backend?.isWebGPUBackend ? 'webgpu' : 'webgl') };
for (const speed of speeds.split(',').map(Number)) {
  await page.evaluate(s => window.__perf.speedTo(s), speed);
  await page.waitForTimeout(5000);
  const cdp = process.env.PROFILE ? await ctx.newCDPSession(page) : undefined;
  if (cdp) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 }); await cdp.send('Profiler.start'); }
  await page.evaluate(() => { const st = window.__fa; st.frames = []; st.tasks = []; st.on = true; st.t0 = performance.now(); st.tick0 = window.__perf.world?.tick; });
  await page.waitForTimeout(Number(secs) * 1000);
  const raw = await page.evaluate(() => { const st = window.__fa; st.on = false; return { frames: st.frames.slice(1), tasks: st.tasks, wallS: (performance.now() - st.t0) / 1000, ticks: (window.__perf.world?.tick ?? 0) - st.tick0 }; });
  if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(`${out}.x${speed}.cpuprofile`, JSON.stringify(profile)); await cdp.detach(); }
  result['x' + speed] = raw;
  console.log('speed', speed, 'frames', raw.frames.length, 'ticks', raw.ticks);
}
result.errors = errors.slice(0, 5);
writeFileSync(out, JSON.stringify(result));
await browser.close();
