// Real production worker (presentation.worker.ts: simulation + encoder + natural
// sidecar + auxiliary sections) driven in Node in real time at a given speed.
// Reports achieved simulation rate vs target and the cost of what is posted.
// Usage (bundle with esbuild first):
//   node tmp/perf/worker-run.mjs <save> [speed=6] [seconds=20] [warmupSeconds=5]
//   PROFILE=out.cpuprofile ... records the measured window.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const [savePath = 'public/test-saves/v419/les-eclaircies.json', speedArg = '6', secondsArg = '20', warmArg = '5'] = process.argv.slice(2);
const speed = Number(speedArg), seconds = Number(secondsArg), warmup = Number(warmArg);
const text = (() => { const t = readFileSync(savePath, 'utf8'); const r = JSON.parse(t); return r.format === 'lisiere-save' ? gunzipSync(Buffer.from(r.payload, 'base64')).toString('utf8') : t; })();

interface Stat { count: number; bytes: number; cloneMs: number }
const stats = new Map<string, Stat>();
const keySizes = { count: 0, parts: new Map<string, number>() };
let measuring = false, lastTick = -1, replies: any[] = [];
const kindOf = (m: any): string => m?.type === 'snapshot' || m?.kind ? `${m.type ?? '?'}:${m.kind ?? m.resident?.kind ?? ''}` : String(m?.type ?? typeof m);
const tickOf = (m: any): number | undefined => m?.world?.tick ?? m?.summary?.tick ?? m?.publication?.world?.tick ?? m?.tick;
const scope: any = {
  onmessage: null,
  postMessage(message: any) {
    if (message?.type === 'reply') replies.push(message);
    const t = tickOf(message); if (typeof t === 'number') lastTick = Math.max(lastTick, t);
    if (!measuring) return;
    // A browser Worker pays structured clone for every postMessage.
    const s = performance.now(); const copy = structuredClone(message); const cloneMs = performance.now() - s;
    const k = kindOf(message), row = stats.get(k) ?? { count: 0, bytes: 0, cloneMs: 0 };
    row.count++; row.cloneMs += cloneMs;
    // SIZES=1 only: the JSON sizing costs as much as the clone and would weigh on
    // the measured Worker (about 7% of each complete publication before 11 November).
    if (process.env.SIZES && row.count <= 40) row.bytes += JSON.stringify(copy, (_k, v) => ArrayBuffer.isView(v) ? Array.from(v as any).length : v)?.length ?? 0;
    stats.set(k, row);
    // KEYS=1: JSON size of each part of a complete publication.
    if (process.env.KEYS && message?.type === 'resident-publication' && keySizes.count < 20) {
      keySizes.count++;
      const size = (v: unknown) => JSON.stringify(v, (_k, x) => ArrayBuffer.isView(x) ? Array.from(x as any) : x)?.length ?? 0;
      const pub = copy.publication ?? {};
      for (const [key, value] of Object.entries(pub)) if (key !== 'world') keySizes.parts.set(key, (keySizes.parts.get(key) ?? 0) + size(value));
      for (const [key, value] of Object.entries(pub.world ?? {})) keySizes.parts.set('world.' + key, (keySizes.parts.get('world.' + key) ?? 0) + size(value));
      for (const key of ['resources', 'piles', 'structures', 'tiles']) { const v = pub[key]; if (v && !Array.isArray(v)) { keySizes.parts.set(key + '.upserted#', (keySizes.parts.get(key + '.upserted#') ?? 0) + 1024 * (v.upserted?.length ?? 0)); keySizes.parts.set(key + '.removed#', (keySizes.parts.get(key + '.removed#') ?? 0) + 1024 * (v.removed?.length ?? 0)); if (v.growth) keySizes.parts.set(key + '.growth#', (keySizes.parts.get(key + '.growth#') ?? 0) + 1024 * v.growth.length / 4); } }
    }
  },
};
(globalThis as any).self = scope;
// Optional: count who requests a hard Full (FULL_REASONS=1).
const fullReasons = new Map<string, number>();
if (process.env.FULL_REASONS) {
  const mod = await import('../src/bridge/core-phase-publisher-297.ts');
  const proto = (Object.values(mod).find((v: any) => typeof v === 'function' && v.prototype?.requestFull) as any).prototype;
  const original = proto.requestFull;
  proto.requestFull = function (...args: any[]) {
    if (measuring) { const frames = (new Error().stack ?? '').split(String.fromCharCode(10)).slice(2, 4).map(l => l.trim().replace(/\(.*\)/, '').replace(/^at /, '')).join(' <- '); fullReasons.set(frames, (fullReasons.get(frames) ?? 0) + 1); }
    return original.apply(this, args);
  };
  for (const name of ['allocatorNeedsFull', 'terrainNeedsFull297', 'audioFitsPhase297']) {
    const fn = proto[name];
    proto[name] = function (...args: any[]) { const r = fn.apply(this, args); const hit = name === 'audioFitsPhase297' ? r === false : r === true; if (measuring && hit) fullReasons.set(`check:${name}`, (fullReasons.get(`check:${name}`) ?? 0) + 1); return r; };
  }
  const obs = proto.observe;
  proto.observe = function (value: any, macro: boolean, ...rest: any[]) { if (measuring && value?.requiresFull) fullReasons.set('observe(requiresFull)', (fullReasons.get('observe(requiresFull)') ?? 0) + 1); return obs.call(this, value, macro, ...rest); };
}
// VERIFY_NATURAL=1: every skipped plant appearance is recomputed and compared.
if (process.env.VERIFY_NATURAL) (await import('../src/bridge/worker-natural-appearance.ts') as any).setNaturalAppearanceVerification?.(true);
await import('../src/bridge/presentation.worker.ts');
const request = (data: any) => scope.onmessage({ data });
const waitReply = async (id: number) => { while (!replies.some(r => r.id === id)) await new Promise(r => setTimeout(r, 20)); const r = replies.find(x => x.id === id); if (!r.ok) throw Error('Request failed: ' + r.reason); };

let t = performance.now();
request({ id: 1, type: 'load', data: text, threatPauseMode: 'never' });
await waitReply(1);
const loadMs = performance.now() - t;
request({ id: 2, type: 'speed', speed }); await waitReply(2);
await new Promise(r => setTimeout(r, warmup * 1000));

let session: import('node:inspector').Session | undefined;
if (process.env.PROFILE) {
  const inspector = await import('node:inspector'); session = new inspector.Session(); session.connect();
  const post = (m: string, p?: object) => new Promise<any>((ok, ko) => session!.post(m, p ?? {}, (e, r) => e ? ko(e) : ok(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 250 }); await post('Profiler.start');
}
const startTick = lastTick; measuring = true;
const cpuStart = process.cpuUsage(); t = performance.now();
// Event-loop lag probe: a 10 ms timer; its lateness shows long synchronous tasks.
const lags: number[] = []; let expected = performance.now() + 10;
const probe = setInterval(() => { const now = performance.now(); lags.push(now - expected); expected = now + 10; }, 10);
await new Promise(r => setTimeout(r, seconds * 1000));
clearInterval(probe); measuring = false;
const wall = performance.now() - t, cpu = process.cpuUsage(cpuStart), endTick = lastTick;
if (session) {
  const { profile } = await new Promise<any>((ok, ko) => session!.post('Profiler.stop', (e, r) => e ? ko(e) : ok(r)));
  writeFileSync(process.env.PROFILE!, JSON.stringify(profile));
}
request({ id: 3, type: 'speed', speed: 0 });
const sorted = [...lags].sort((a, b) => a - b), pct = (p: number) => +(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0).toFixed(1);
const ticks = endTick - startTick, target = speed * 6 * wall / 1000;
console.log(JSON.stringify({
  save: savePath, speed, wallS: +(wall / 1000).toFixed(1), loadS: +(loadMs / 1000).toFixed(1),
  macroTicks: ticks, targetMacroTicks: +target.toFixed(0), achievedPctOfTarget: +(100 * ticks / target).toFixed(1),
  workerCpuPct: +(100 * (cpu.user + cpu.system) / 1000 / wall).toFixed(1),
  taskLagMs: { p50: pct(.5), p95: pct(.95), p99: pct(.99), max: +(sorted.at(-1) ?? 0).toFixed(1) },
  fullRequests: Object.fromEntries([...fullReasons].sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / (wall / 1000)).toFixed(2)])),
  ...(keySizes.count ? { publicationKB: Object.fromEntries([...keySizes.parts].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => [k, +(v / keySizes.count / 1024).toFixed(1)])) } : {}),
  posted: Object.fromEntries([...stats].map(([k, v]) => [k, { perS: +(v.count / (wall / 1000)).toFixed(1), ...(process.env.SIZES ? { avgKB: +(v.bytes / Math.min(v.count, 40) / 1024).toFixed(1) } : {}), cloneMsEach: +(v.cloneMs / v.count).toFixed(2) }])),
}, null, 1));
process.exit(0);
