// Inclusive time of direct callees of a function (aggregated across all its frames).
// Usage: node scripts/perf-profile-callees.mjs file.cpuprofile functionName [top=25]
import { readFileSync } from 'node:fs';
const [file, name, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 25);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const counts = new Map();
for (const s of p.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
const total = p.samples.length;
const key = n => `${n.callFrame.functionName || '(anon)'}:${n.callFrame.lineNumber + 1}`;
const agg = new Map();
let all = 0;
for (const [id, c] of counts) {
  // outermost frame matching name; record the frame right below it
  let cur = id, child, hitChild;
  let found = false;
  while (cur !== undefined) {
    const n = byId.get(cur);
    if (n.callFrame.functionName === name) { found = true; hitChild = child; }
    child = cur; cur = parent.get(cur);
  }
  if (!found) continue;
  all += c;
  const k = hitChild === undefined ? '(self)' : key(byId.get(hitChild));
  agg.set(k, (agg.get(k) ?? 0) + c);
}
console.log(`${name}: ${(100 * all / total).toFixed(2)}% inclusive`);
for (const [k, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, top)) console.log(`${(100 * v / total).toFixed(2).padStart(6)}%  ${k}`);
