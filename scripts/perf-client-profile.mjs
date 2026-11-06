// Real client profile in Chromium (real GPU, WebGPU) against a perf build served
// with tmp/perf/vite.perfbuild.config.mjs. Measures frame times, long tasks and a
// main-thread CPU profile while paused, at speed 1 and at speed 6.
// Usage: node scripts/perf-client-profile.mjs <origin> <saveUrlPath> <outPrefix> [seconds=10]
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [origin = 'http://127.0.0.1:5199', savePath = '/test-saves/v419/les-eclaircies.json', outPrefix = 'tmp/perf/client', secondsArg = '10'] = process.argv.slice(2);
const seconds = Number(secondsArg);
const browser = await chromium.launch({
  executablePath: resolve('.playwright/chromium-1243/chrome-win64/chrome.exe'), headless: true,
  args: ['--mute-audio', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
await context.addInitScript(() => {
  for (const [k, v] of Object.entries({ 'lisiere.audio.effects.enabled.v1': 'false', 'lisiere.audio.music.enabled.v1': 'false', 'lisiere.autosave-minutes.v1': '0', 'lisiere.presentation.threat-pause.v1': 'never' })) localStorage.setItem(k, v);
});
const page = await context.newPage(); page.setDefaultTimeout(900000);
const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); if (process.env.VERBOSE) console.log('[console]', m.type(), m.text().slice(0, 200)); });
page.on('crash', () => console.log('[crash] page crashed at', new Date().toISOString()));
page.on('worker', w => { if (process.env.VERBOSE) console.log('[worker]', w.url().slice(-60)); });
await page.goto(origin + '/?e2e=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__perf?.ready);
const t0 = Date.now();
await page.evaluate(url => window.__perf.loadUrl(url), savePath);
await page.waitForFunction(() => window.__perf?.view?.backend && window.__lisiere?.hasActiveMap && !window.__perf.blocked);
const loadS = (Date.now() - t0) / 1000;
await page.evaluate(() => window.__perf.speedTo(0));
await page.mouse.move(720, 500);
await page.waitForTimeout(3000);
const backend = await page.evaluate(() => window.__perf.view.backend?.isWebGPUBackend ? 'webgpu' : 'webgl');
const cdp = await context.newCDPSession(page);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Performance.enable');
const results = { origin, savePath, loadS, backend };
const measure = async label => {
  const before = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const tick0 = await page.evaluate(() => window.__perf.world.tick);
  await page.evaluate(() => {
    window.__frameStop = false; const q = window.__frames = []; let last = performance.now();
    const tick = now => { q.push(now - last); last = now; if (!window.__frameStop) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    window.__long = []; try { window.__lo?.disconnect(); window.__lo = new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long.push(e.duration); }); window.__lo.observe({ type: 'longtask' }); } catch {}
  });
  await cdp.send('Profiler.start'); await page.waitForTimeout(seconds * 1000); const { profile } = await cdp.send('Profiler.stop');
  const after = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
  const info = await page.evaluate(() => {
    window.__frameStop = true; const f = window.__frames.slice(1).sort((a, b) => a - b), L = window.__long;
    const p = q => +f[Math.min(f.length - 1, Math.floor(f.length * q))].toFixed(1);
    return { fps: +(1000 * f.length / f.reduce((a, b) => a + b, 0)).toFixed(1), frameMs: { p50: p(.5), p95: p(.95), p99: p(.99), max: +f.at(-1).toFixed(1) }, framesOver50ms: f.filter(x => x > 50).length,
      longTasks: { count: L.length, totalMs: Math.round(L.reduce((a, b) => a + b, 0)), max: Math.round(Math.max(0, ...L)) }, tick: window.__perf.world.tick, speed: window.__perf.speed };
  });
  info.mainThreadBusyPct = +(100 * (after.TaskDuration - before.TaskDuration) / seconds).toFixed(1);
  info.macroTicksPerS = +((info.tick - tick0) / seconds).toFixed(1);
  results[label] = info;
  console.log(label, JSON.stringify(info));
  await writeFile(`${outPrefix}-${label}.cpuprofile`, JSON.stringify(profile));
};
await measure('paused');
await page.evaluate(() => window.__perf.speedTo(1)); await page.waitForTimeout(3000); await measure('speed1');
await page.evaluate(() => window.__perf.speedTo(6)); await page.waitForTimeout(3000); await measure('speed6');
results.errors = errors.slice(0, 8);
await writeFile(`${outPrefix}-summary.json`, JSON.stringify(results, null, 1));
console.log('errors', JSON.stringify(errors.slice(0, 6)));
await browser.close();
