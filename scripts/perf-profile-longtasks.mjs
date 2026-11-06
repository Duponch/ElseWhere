// Find long contiguous busy stretches (between idle samples) in a .cpuprofile
// and list the functions that dominate each of them.
// Usage: node scripts/perf-profile-longtasks.mjs file.cpuprofile [minMs=50]
import { readFileSync } from 'node:fs';
const [file, minArg] = process.argv.slice(2);
const minMs = Number(minArg ?? 50);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const name = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const isIdle = id => { const n = byId.get(id); return n.callFrame.functionName === '(idle)' || n.callFrame.functionName === '(program)'; };
const tasks = []; let cur = null;
for (let i = 0; i < p.samples.length; i++) {
  const id = p.samples[i], dt = (p.timeDeltas?.[i] ?? 0) / 1000;
  if (isIdle(id)) { if (cur) { tasks.push(cur); cur = null; } continue; }
  cur ??= { ms: 0, stacks: new Map() };
  cur.ms += dt;
  const seen = new Set();
  for (let x = id; x !== undefined; x = parent.get(x)) { const k = name(byId.get(x)); if (seen.has(k)) continue; seen.add(k); cur.stacks.set(k, (cur.stacks.get(k) ?? 0) + dt); }
}
if (cur) tasks.push(cur);
const long = tasks.filter(t => t.ms >= minMs).sort((a, b) => b.ms - a.ms);
console.log(`busy stretches >= ${minMs} ms: ${long.length} (total ${long.reduce((a, t) => a + t.ms, 0).toFixed(0)} ms)`);
for (const t of long.slice(0, 8)) {
  console.log(`\n== ${t.ms.toFixed(0)} ms`);
  const generic = /^\(root\)|^\(anon\):0|^update:|^frame:|^\(anon\):3415|runMicrotasks/;
  for (const [k, v] of [...t.stacks].filter(([k]) => !generic.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${(100 * v / t.ms).toFixed(0).padStart(3)}%  ${k}`);
}
