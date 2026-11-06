// Long busy stretches of a main-thread .cpuprofile, totalled by cause (chunk rebuilds,
// structures, publication adoption, GC, shadows, render, applyWorld...).
// Usage: node scripts/perf-profile-classify.mjs file.cpuprofile [minMs=40]
import { readFileSync } from 'node:fs';
const [file, minArg = '40'] = process.argv.slice(2); const min = Number(minArg);
const p = JSON.parse(readFileSync(file, 'utf8')); const byId = new Map(p.nodes.map(n => [n.id, n])); const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const cats = ['updateWorldChunks','buildStructures','buildJobs','#drainFrameBudget','adopt','(garbage collector)','renderShadow','renderScene','applyWorld','frame'];
const isIdle = id => ['(idle)','(program)'].includes(byId.get(id).callFrame.functionName);
const tasks = []; let cur = null;
for (let i = 0; i < p.samples.length; i++) { const id = p.samples[i], dt = (p.timeDeltas?.[i] ?? 0) / 1000;
  if (isIdle(id)) { if (cur) { tasks.push(cur); cur = null; } continue; }
  cur ??= { ms: 0, cat: new Map() }; cur.ms += dt;
  let cat = 'other'; for (let x = id; x !== undefined; x = parent.get(x)) { const f = byId.get(x).callFrame.functionName; const k = cats.indexOf(f); if (k >= 0 && (cat === 'other' || k < cats.indexOf(cat))) cat = f; }
  cur.cat.set(cat, (cur.cat.get(cat) ?? 0) + dt); }
if (cur) tasks.push(cur);
const long = tasks.filter(t => t.ms >= min); const total = new Map();
for (const t of long) for (const [k, v] of t.cat) total.set(k, (total.get(k) ?? 0) + v);
console.log(`stretches >= ${min} ms: ${long.length}, ${long.reduce((a, t) => a + t.ms, 0).toFixed(0)} ms`);
for (const [k, v] of [...total].sort((a, b) => b[1] - a[1])) console.log(`  ${v.toFixed(0).padStart(6)} ms  ${k}`);
