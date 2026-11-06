// Forces full rebuilds of every vegetation chunk in the real client, times them and
// hashes every produced attribute, index and bounding sphere, so a rendering
// optimisation can be checked for bit-identical output (compare the "after" hash).
// Needs a perf build served on 127.0.0.1:5199 (see tmp/perf/vite.perfbuild.config.mjs
// in the audit). Under Git Bash, set MSYS_NO_PATHCONV=1 so the save path is kept.
// Usage: node scripts/perf-chunk-bench.mjs [/test-saves/v419/les-eclaircies.json] [rounds=3] [profile.cpuprofile]
//   NOHASH=1 skips hashing (for clean profiles).
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
const [save = '/test-saves/v419/les-eclaircies.json', rounds = '3', profileOut = ''] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: resolve('.playwright/chromium-1243/chrome-win64/chrome.exe'), headless: true, args: ['--mute-audio', '--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addInitScript(() => { for (const [k, v] of Object.entries({ 'lisiere.audio.effects.enabled.v1': 'false', 'lisiere.audio.music.enabled.v1': 'false', 'lisiere.autosave-minutes.v1': '0', 'lisiere.presentation.threat-pause.v1': 'never' })) localStorage.setItem(k, v); });
const page = await ctx.newPage(); page.setDefaultTimeout(600000);
page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 300)));
await page.goto('http://127.0.0.1:5199/?e2e=1', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__perf?.ready);
await page.evaluate(u => window.__perf.loadUrl(u), save);
await page.waitForFunction(() => window.__perf?.view?.backend && !!window.__perf.world && !window.__perf.blocked);
await page.evaluate(() => window.__perf.speedTo(0));
await page.waitForTimeout(2000);
const hash = () => page.evaluate(() => {
  const r = window.__perf.view.resources; let h = 2166136261 >>> 0, n = 0;
  const mix = b => { for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619) >>> 0; } };
  for (const key of [...r.chunks.keys()].sort()) { const g = r.chunks.get(key).group;
    g.traverse(o => { if (!o.geometry) return; const geo = o.geometry; for (const name of Object.keys(geo.attributes).sort()) { const a = geo.attributes[name].array; mix(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); n += a.length; }
      if (geo.index) mix(new Uint8Array(geo.index.array.buffer, geo.index.array.byteOffset, geo.index.array.byteLength));
      const s = geo.boundingSphere; if (s) mix(new Uint8Array(new Float64Array([s.center.x, s.center.y, s.center.z, s.radius]).buffer)); }); }
  return { hash: h.toString(16), values: n };
});
const rebuildAll = () => page.evaluate(() => {
  const r = window.__perf.view.resources; r.setChunkRebuildBudget(Infinity); const times = {};
  for (const key of [...r.chunks.keys()].sort()) { const prev = r.chunks.get(key); r.group.remove(prev.group); r.chunks.delete(key); r.deferredChunks.add(key);
    const t = performance.now(); r.flushDeferredChunks(); times[key] = +(performance.now() - t).toFixed(1); }
  return times;
});
if (!process.env.NOHASH) console.log("initial", await hash());
let cdp; if (profileOut) { cdp = await ctx.newCDPSession(page); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start'); }
for (let i = 0; i < Number(rounds); i++) { const times = await rebuildAll(); const v = Object.values(times); console.log(`round ${i}: total ${v.reduce((a, b) => a + b, 0).toFixed(0)} ms, max ${Math.max(...v)} ms`, JSON.stringify(times)); if (!process.env.NOHASH) console.log('  after', await hash()); }
if (cdp) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(profileOut, JSON.stringify(profile)); }
await browser.close();
