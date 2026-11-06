// Hot source lines (self samples) inside functions matching a name, read from the bundle.
// Usage: node scripts/perf-profile-lines.mjs file.cpuprofile bundle.mjs functionName [top=15]
import { readFileSync } from 'node:fs';
const [file, bundle, name, topArg] = process.argv.slice(2);
const top = Number(topArg ?? 15);
const p = JSON.parse(readFileSync(file, 'utf8'));
const lines = readFileSync(bundle, 'utf8').split('\n');
const total = p.samples.length;
const agg = new Map();
for (const n of p.nodes) {
  if (n.callFrame.functionName !== name) continue;
  for (const t of n.positionTicks ?? []) agg.set(t.line, (agg.get(t.line) ?? 0) + t.ticks);
}
const sum = [...agg.values()].reduce((a, b) => a + b, 0);
console.log(`${name}: self ${(100 * sum / total).toFixed(2)}%`);
for (const [line, v] of [...agg].sort((a, b) => b[1] - a[1]).slice(0, top))
  console.log(`${(100 * v / total).toFixed(2).padStart(6)}%  L${line}: ${(lines[line - 1] ?? '').trim().slice(0, 220)}`);
