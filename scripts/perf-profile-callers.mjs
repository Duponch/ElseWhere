// Show the callers (by inclusive samples) of functions matching a name.
// Usage: node scripts/perf-profile-callers.mjs file.cpuprofile functionName [depth=1]
import { readFileSync } from 'node:fs';
const [file, name, depthArg] = process.argv.slice(2);
const depth = Number(depthArg ?? 1);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const counts = new Map();
for (const s of p.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
const total = p.samples.length;
const key = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const agg = new Map();
let matched = 0;
for (const [id, c] of counts) {
  // find the innermost frame matching name on this stack
  let cur = id, hit;
  while (cur !== undefined) { const n = byId.get(cur); if (n.callFrame.functionName === name) { hit = cur; break; } cur = parent.get(cur); }
  if (hit === undefined) continue;
  matched += c;
  const chain = [];
  let up = parent.get(hit);
  for (let d = 0; d < depth && up !== undefined; d++) { chain.push(key(byId.get(up))); up = parent.get(up); }
  const k = chain.join(' <- ');
  agg.set(k, (agg.get(k) ?? 0) + c);
}
console.log(`${name}: ${(100 * matched / total).toFixed(2)}% inclusive`);
for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, 25)) console.log(`${(100 * v / total).toFixed(2).padStart(6)}%  ${k}`);
