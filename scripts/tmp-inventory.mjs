// Size each top-level entry of a directory without following symlinks or
// Windows junctions (they are counted as 0 and listed separately).
// Usage: node scripts/tmp-inventory.mjs [dir=tmp] [out=tmp/perf/tmp-inventory.tsv]
import { lstat, opendir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [root = 'tmp', out = 'tmp/perf/tmp-inventory.tsv'] = process.argv.slice(2);
async function size(path) {
  let total = 0, files = 0, links = 0, newest = 0;
  const stack = [path];
  while (stack.length) {
    const dir = stack.pop();
    let handle;
    try { handle = await opendir(dir); } catch { continue; }
    for await (const entry of handle) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) { links++; continue; }
      if (entry.isDirectory()) { stack.push(full); continue; }
      try { const s = await lstat(full); if (s.isSymbolicLink()) { links++; continue; } total += s.size; files++; if (s.mtimeMs > newest) newest = s.mtimeMs; } catch {}
    }
  }
  return { total, files, links, newest };
}
const rows = [];
const dir = await opendir(root);
const entries = [];
for await (const e of dir) entries.push(e);
let next = 0;
async function worker() {
  while (next < entries.length) {
    const e = entries[next++], full = join(root, e.name);
    const st = await lstat(full);
    const r = e.isSymbolicLink() ? { total: 0, files: 0, links: 1, newest: st.mtimeMs } : e.isDirectory() ? await size(full) : { total: st.size, files: 1, links: 0, newest: st.mtimeMs };
    rows.push([e.name, r.total, r.files, r.links, new Date(r.newest || st.mtimeMs).toISOString().slice(0, 10)]);
  }
}
await Promise.all(Array.from({ length: 16 }, worker));
rows.sort((a, b) => b[1] - a[1]);
await writeFile(out, rows.map(r => `${(r[1] / 1048576).toFixed(0)}\t${r[4]}\t${r[2]}\t${r[3]}\t${r[0]}`).join('\n') + '\n');
const sum = rows.reduce((a, r) => a + r[1], 0);
console.log(`entries=${rows.length} totalGB=${(sum / 1073741824).toFixed(2)}`);
console.log(rows.slice(0, 40).map(r => `${(r[1] / 1048576).toFixed(0).padStart(7)} MB  newest ${r[4]}  files ${r[2]}  links ${r[3]}  ${r[0]}`).join('\n'));
