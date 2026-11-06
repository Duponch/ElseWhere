// Summarise a .cpuprofile: self time and inclusive time per function.
// Usage: node scripts/perf-profile-summary.mjs file.cpuprofile [top=40]
import { readFileSync } from 'node:fs';
const [file, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 40);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map(n => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const self = new Map();
const counts = new Map();
for (const s of p.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
const total = p.samples.length;
const key = n => `${n.callFrame.functionName || '(anon)'} @${(n.callFrame.url.split('/').pop() || '')}:${n.callFrame.lineNumber + 1}`;
const incl = new Map();
for (const [id, c] of counts) {
  const n = byId.get(id); const k = key(n);
  self.set(k, (self.get(k) ?? 0) + c);
  // inclusive: count once per distinct function on stack
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const kk = key(byId.get(cur)); if (seen.has(kk)) continue; seen.add(kk);
    incl.set(kk, (incl.get(kk) ?? 0) + c);
  }
}
const fmt = m => [...m].sort((a, b) => b[1] - a[1]).slice(0, top).map(([k, v]) => `${(100 * v / total).toFixed(2).padStart(6)}%  ${k}`).join('\n');
console.log(`samples=${total}\n--- SELF ---\n${fmt(self)}\n--- INCLUSIVE ---\n${fmt(incl)}`);
