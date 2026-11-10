// Diagnostic only (not product code): how long does the real presentation
// worker take to apply and show a speed change? Same world as the presentation
// check (seed 42, 250², tick 2000, mining rectangle, speed 1 then 6,1,3 every 2 s).
// A speed request is dispatched from a timer, like a browser message event: it
// waits for the worker's current task. Reports, per switch: queue wait, reply,
// first publication after it, and when the posted tick rate reaches the new speed.
// Bundle: npx esbuild scripts/speed-latency-probe.ts --bundle --platform=node --format=esm --keep-names --outfile=tmp/perf/speed-latency-probe.mjs
// Run: node tmp/perf/speed-latency-probe.mjs [seconds=30] [speeds=6,1,3] [rawOut.json]
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';

const seconds = Number(process.argv[2] ?? 30), cycle = (process.argv[3] ?? '6,1,3').split(',').map(Number);
const posts: { at: number; kind: string; tick?: number }[] = [];
const replies = new Map<number, number>();
const tickOf = (m: any): number | undefined => m?.world?.tick ?? m?.summary?.tick ?? m?.publication?.world?.tick ?? m?.tick;
const kindOf = (m: any): string => `${m?.type ?? typeof m}:${m?.kind ?? m?.resident?.kind ?? ''}`;
const scope: any = {
  onmessage: null,
  postMessage(m: any) {
    const at = performance.now();
    if (m?.type === 'reply') { replies.set(m.id, at); if (!m.ok) console.error('reply failed', m.id, m.reason); }
    posts.push({ at, kind: kindOf(m), tick: tickOf(m) });
  },
};
(globalThis as any).self = scope;
const { createWorld, applyCommand, serializeWorld } = await import('../src/sim/index.ts');
await import('../src/bridge/presentation.worker.ts');

const w = createWorld(42, 250, 250); w.tick = 2000; w.deterioration.lastTick = w.tick;
if (w.corePathBudget297) w.corePathBudget297.tick = w.tick;
const p = w.pawns[0]!;
const c = w.tiles.map((t, i) => ({ t, x: i % 250, z: Math.floor(i / 250) })).filter(v => v.t.terrain === 'rock').sort((a, b) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.z - p.z) ** 2))[0]!;
if (!applyCommand(w, { type: 'area', action: 'mine', from: { x: Math.max(0, c.x - 20), z: Math.max(0, c.z - 20) }, to: { x: Math.min(249, c.x + 20), z: Math.min(249, c.z + 20) } } as any).ok) throw Error('Designation rejected');

let id = 0;
const send = (data: any) => { const rid = ++id; scope.onmessage({ data: { ...data, id: rid } }); return rid; };
const waitReply = async (rid: number) => { while (!replies.has(rid)) await new Promise(r => setTimeout(r, 5)); };
await waitReply(send({ type: 'load', data: serializeWorld(w), threatPauseMode: 'never' }));
await waitReply(send({ type: 'speed', speed: 1 }));
await new Promise(r => setTimeout(r, 3000));

// Event-loop lag probe: lateness of a 5 ms timer marks long synchronous tasks.
const lags: { at: number; lag: number }[] = []; let expected = performance.now() + 5;
const probe = setInterval(() => { const now = performance.now(); lags.push({ at: now, lag: now - expected }); expected = now + 5; }, 5);
const switches: { from: number; to: number; due: number; fired: number; rid: number }[] = [];
let current = 1;
for (let i = 0; i * 2 < seconds; i++) {
  const to = cycle[i % cycle.length]!, due = performance.now() + 2000;
  await new Promise<void>(r => setTimeout(() => { switches.push({ from: current, to, due, fired: performance.now(), rid: send({ type: 'speed', speed: to }) }); current = to; r(); }, 2000));
}
await new Promise(r => setTimeout(r, 1500));
clearInterval(probe);
send({ type: 'speed', speed: 0 });

// Posted tick rate in local ticks per second; 6 per second at speed 1.
const rows = switches.map(s => {
  const reply = replies.get(s.rid) ?? NaN;
  const after = posts.filter(q => q.at >= s.fired && q.tick !== undefined);
  const base = posts.filter(q => q.at < s.fired && q.tick !== undefined).at(-1)?.tick ?? NaN;
  const first = after[0];
  // First time the ticks posted since the switch reach half a second at the new speed.
  const need = Math.max(1, Math.round(s.to * 6 * 0.5));
  const reached = after.find(q => (q.tick! - base) >= need);
  const window = lags.filter(l => l.at >= s.due - 200 && l.at <= s.fired + 1500);
  const nextGap = after.length > 1 ? Math.max(...after.slice(0, 20).map((q, i, a) => i ? q.at - a[i - 1]!.at : q.at - s.fired)) : NaN;
  return {
    switch: `${s.from}->${s.to}`,
    queueWaitMs: +(s.fired - s.due).toFixed(1),
    replyMs: +(reply - s.fired).toFixed(1),
    firstPostMs: first ? +(first.at - s.fired).toFixed(1) : null,
    halfSecondOfTicksMs: reached ? +(reached.at - s.fired).toFixed(1) : null,
    idealHalfSecondMs: 500,
    maxPostGapFirst20Ms: +nextGap.toFixed(1),
    maxLoopLagNearMs: +Math.max(0, ...window.map(l => l.lag)).toFixed(1),
  };
});
const sorted = lags.map(l => l.lag).sort((a, b) => a - b), pct = (q: number) => +(sorted[Math.floor(sorted.length * q)] ?? 0).toFixed(1);
const out = { seconds, cycle, loopLagMs: { p50: pct(.5), p95: pct(.95), p99: pct(.99), max: +(sorted.at(-1) ?? 0).toFixed(1) }, switches: rows };
console.log(JSON.stringify(out, null, 1));
if (process.argv[4]) writeFileSync(process.argv[4], JSON.stringify({ ...out, posts, lags }, null, 0));
process.exit(0);
