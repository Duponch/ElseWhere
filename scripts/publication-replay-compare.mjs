// Compares two records made by publication-replay-record.ts (see that file).
// Exit code 0 when every posted message and the final save are identical.
// Usage: node scripts/publication-replay-compare.mjs a.json b.json
import { readFileSync } from 'node:fs';
const [a, b] = process.argv.slice(2).map(file => JSON.parse(readFileSync(file, 'utf8')));
const n = Math.min(a.rows.length, b.rows.length);
let first = -1;
for (let i = 0; i < n; i++) if (a.rows[i].sha !== b.rows[i].sha) { first = i; break; }
const same = first < 0 && a.rows.length === b.rows.length && a.saveSha === b.saveSha;
const summary = r => ({ messages: r.messages, macroTicks: r.macroTicks, kinds: r.kinds, totalKB: +(r.totalBytes / 1024).toFixed(0), saveSha: r.saveSha.slice(0, 16) });
console.log(JSON.stringify({ identical: same, a: summary(a), b: summary(b), ...first >= 0 ? { firstDifference: { index: first, a: a.rows[first], b: b.rows[first], before: a.rows.slice(Math.max(0, first - 3), first) } } : {} }, null, 1));
process.exit(same ? 0 : 1);
