// Usage: npx esbuild scripts/perf-actor-deps-diff.ts --bundle --platform=node --format=esm --outfile=tmp/perf/deps-diff.mjs && node tmp/perf/deps-diff.mjs <save> [macroTicks=30]
// Which actor-phase dependency fields change between consecutive macro ticks.
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { advanceWorldCore297 } from '../src/sim/engine.ts';
import { deserializeWorld } from '../src/sim/serialization.ts';
import { captureActorPhaseDependencies297 } from '../src/bridge/actor-phase-dependencies-297.ts';
const path = process.argv[2] ?? 'public/test-saves/v432/les-forges-crash-test.json', ticks = Number(process.argv[3] ?? 30);
const raw = JSON.parse(readFileSync(path, 'utf8'));
const world = deserializeWorld(raw.format === 'lisiere-save' ? gunzipSync(Buffer.from(raw.payload, 'base64')).toString('utf8') : JSON.stringify(raw));
const humanFields = ['id','identity','shape','apparel','gear','colonist','visitorHostile','limbMask','blood','corpseStage','body','contact','pose','bed','dining','recreation','paste','cargo','packed','rescue','animalRescue','cryptosleep','kidnap','fires'];
const animalFields = ['id','species','scale','blood','mask','slaughter','quota','meal','door','carrier','corpsePile','fires'];
const counts = new Map<string, number>(); let changedTicks = 0, macro = 0;
const bump = (k: string) => counts.set(k, (counts.get(k) ?? 0) + 1);
const eq = (a: unknown, b: unknown): boolean => { if (Object.is(a, b)) return true; if (!a || !b || typeof a !== "object" || typeof b !== "object") return false; const ka = Object.keys(a as object), kb = Object.keys(b as object); return ka.length === kb.length && ka.every(k => eq((a as any)[k], (b as any)[k])); };
let prev: any;
for (let i = 0; macro < ticks; i++) {
  const r = advanceWorldCore297(world); if (!r.localTickCompleted) continue; macro++;
  const d: any = (captureActorPhaseDependencies297(world) as any).data;
  if (prev) { let any = false;
    for (const top of Object.keys(d)) if (!eq(d[top], prev[top])) { any = true;
      if (top === 'human') { const byId = new Map(prev.human.map((h: any) => [h[0], h])); for (const h of d.human) { const p: any = byId.get(h[0]); if (!p) { bump('human:new'); continue; } h.forEach((v: any, f: number) => { if (!eq(v, p[f])) { bump('human.' + humanFields[f]); if (humanFields[f] === 'contact' || humanFields[f] === 'pose') { (v as any[]).forEach((x, j) => { if (!eq(x, p[f][j])) bump(`human.${humanFields[f]}[${j}]`); }); } } }); } }
      else if (top === 'animalGroups') { const pm = new Map(prev.animalGroups.flatMap(([, rows]: any) => rows.map((r: any) => [r[0], r]))); for (const [, rows] of d.animalGroups) for (const r of rows) { const p: any = pm.get(r[0]); if (!p) { bump('animal:new'); continue; } r.forEach((v: any, f: number) => { if (!eq(v, p[f])) bump('animal.' + animalFields[f]); }); } }
      else bump(top); }
    if (any) changedTicks++; }
  prev = structuredClone(d);
}
console.log(JSON.stringify({ macro, changedTicks, fields: Object.fromEntries([...counts].sort((a, b) => b[1] - a[1])) }, null, 1));
