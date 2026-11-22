// Summary of scripts/perf-client-publication.mjs records (measurement tool).
//   node scripts/perf-client-publication-summary.mjs run.json [...]          one line per run and speed
//   node scripts/perf-client-publication-summary.mjs base=a.json,b.json cand=c.json,d.json   medians [min-max] per group
// Main-thread ms per complete publication:
//   msg      Worker message task (deserialization at the first `data` read, then the native lane's capture)
//   adm      admission: drain of the frames that adopted a complete publication, minus the
//            phase packets drained with it (at the mean drain of frames with phases only)
//   apply    renderer.applyWorld of a complete publication (application to the render layers)
//   total    msg + adm + apply (the HUD refresh it triggers is reported apart, per second)
import { readFileSync } from 'node:fs';
const sum = (a, k) => a.reduce((s, x) => s + (x[k] ?? 0), 0);
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))] ?? 0; };
function measure(window) {
  const { frames: f, tasks, wallS, ticks } = window;
  const full = f.filter(x => x.fulls > 0), phaseOnly = f.filter(x => !x.fulls && x.phaseN > 0);
  const phaseDrain = sum(phaseOnly, 'drain') / Math.max(1, sum(phaseOnly, 'phaseN'));
  const nRecv = Math.max(1, sum(f, 'fulls')), nMsg = Math.max(1, sum(f, 'nFull')), nApply = Math.max(1, sum(f, 'applyN'));
  const msg = (sum(f, 'listenFull') + sum(f, 'onmsgFull')) / nMsg, adm = (sum(full, 'drain') - phaseDrain * sum(full, 'phaseN')) / nRecv, apply = sum(f, 'apply') / nApply;
  const dts = f.map(x => x.dt);
  return { total: msg + adm + apply, msg, deser: sum(f, 'deserFull') / nMsg, adm, adopt: sum(f, 'adopt') / nRecv, apply, fullsPerS: sum(f, 'fulls') / wallS,
    fps: f.length / wallS, p95: q(dts, .95), p99: q(dts, .99), max: q(dts, 1), over33: dts.filter(x => x > 33.4).length, over50: dts.filter(x => x > 50).length, over100: dts.filter(x => x > 100).length,
    longTaskMs: tasks.reduce((a, b) => a + b, 0), hudMsPerS: sum(f, 'hud') / wallS, ticksPerS: ticks / wallS };
}
const speeds = data => Object.keys(data).filter(k => /^x\d+$/.test(k));
const args = process.argv.slice(2);
if (!args.some(a => a.includes('='))) {
  for (const file of args) { const data = JSON.parse(readFileSync(file, 'utf8')); for (const k of speeds(data)) console.log(file.split(/[\\/]/).pop(), k, JSON.stringify(Object.fromEntries(Object.entries(measure(data[k])).map(([m, v]) => [m, +v.toFixed(1)])))); }
} else {
  const groups = args.map(a => { const [name, list] = a.split('='); return { name, runs: list.split(',').map(f => JSON.parse(readFileSync(f, 'utf8'))) }; });
  const med = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  for (const k of speeds(groups[0].runs[0])) {
    console.log(`== ${k}`);
    const rows = groups.map(g => g.runs.filter(r => r[k]).map(r => measure(r[k])));
    for (const m of Object.keys(rows[0][0])) console.log(m.padEnd(11) + groups.map((g, i) => { const v = rows[i].map(r => r[m]); return `${g.name} ${med(v).toFixed(1).padStart(7)} [${Math.min(...v).toFixed(1)}-${Math.max(...v).toFixed(1)}]`; }).join('   '));
  }
}
