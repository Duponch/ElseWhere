// Real-save simulation throughput benchmark (CPU only, no renderer/worker).
// Usage: node --experimental-transform-types scripts/perf-save-bench.ts [save] [macroTicks]
// Example: node --experimental-transform-types scripts/perf-save-bench.ts public/test-saves/v432/les-forges-crash-test.json 300
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { advanceWorldCore297 } from '../src/sim/engine.ts';
import { deserializeWorld, serializeCampaign } from '../src/sim/serialization.ts';
import { createHash } from 'node:crypto';

const path = process.argv[2] ?? 'public/test-saves/v432/les-forges-crash-test.json';
const macros = Number(process.argv[3] ?? 200);
const warmup = Number(process.argv[4] ?? 20);

function payload(file: string): string {
  const text = readFileSync(file, 'utf8');
  const raw = JSON.parse(text);
  if (raw.format !== 'lisiere-save') return text;
  return gunzipSync(Buffer.from(raw.payload, 'base64')).toString('utf8');
}
const text = payload(path);
let t = performance.now();
const world = deserializeWorld(text);
const loadMs = performance.now() - t;
if (process.env.LOAD_ONLY) { console.log(JSON.stringify({ save: path, loadMs: Math.round(loadMs) })); process.exit(0); }

const step = (count: number, boundary: number[], inner: number[]) => {
  for (let i = 0; i < count * 10; i++) {
    const s = performance.now();
    const r = advanceWorldCore297(world);
    const d = performance.now() - s;
    (r.localTickCompleted ? boundary : inner).push(d);
  }
};
step(warmup, [], []);
const boundary: number[] = [], inner: number[] = [];
// PROFILE=out.cpuprofile records only the measured stepping window.
const profileOut = process.env.PROFILE;
let session: import('node:inspector').Session | undefined;
if (profileOut) {
  const inspector = await import('node:inspector');
  session = new inspector.Session(); session.connect();
  const post = (method: string, params?: object) => new Promise<any>((ok, ko) => session!.post(method, params ?? {}, (e, r) => e ? ko(e) : ok(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 200 }); await post('Profiler.start');
}
t = performance.now();
step(macros, boundary, inner);
const wall = performance.now() - t;
if (profileOut && session) {
  const { profile } = await new Promise<any>((ok, ko) => session!.post('Profiler.stop', (e, r) => e ? ko(e) : ok(r)));
  (await import('node:fs')).writeFileSync(profileOut, JSON.stringify(profile));
}
// Determinism fingerprint of the complete authoritative state after stepping.
const stateSha256 = createHash('sha256').update(serializeCampaign(world)).digest('hex');
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] ?? 0; };
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const msPerMacro = wall / macros;
console.log(JSON.stringify({
  save: path, pawns: world.pawns.length, size: `${world.width}x${world.height}`, schema: world.schemaVersion, tick: world.tick,
  loadMs: r3(loadMs), macros,
  msPerMacroTick: r3(msPerMacro),
  macroShareOfWallPct: r3(100 * sum(boundary) / wall),
  boundaryMedianMs: r3(pct(boundary, 0.5)), boundaryP95Ms: r3(pct(boundary, 0.95)), boundaryMaxMs: r3(Math.max(...boundary)),
  innerCoreMedianMs: r3(pct(inner, 0.5)), innerCoreP95Ms: r3(pct(inner, 0.95)),
  // RimWorld speed 3 (×6) = 36 macro ticks/s here. Budget 1000 ms.
  cpuSharePctAtSpeed6: r3(100 * msPerMacro * 36 / 1000),
  maxMacroTicksPerSecond: r3(1000 / msPerMacro),
  maxSpeedMultiplier: r3(1000 / msPerMacro / 6),
  stateSha256,
}, null, 1));
