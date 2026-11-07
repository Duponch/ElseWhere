// Worker-side cost of a new game: drives the real presentation Worker in Node
// with the menu's requests (planet generation, site confirmation, colony start)
// and reports each request's time and its progress steps.
// Usage (bundle with esbuild first):
//   node tmp/perf/newgame-profile.mjs [size=250] [seed=probe] [out.cpuprofile]
import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { defaultWorldGenerationSettings } from '../src/sim/world-generation-settings';
import { startingOriginalRequestFromRoster256 } from '../src/sim/starting-original-request-256';

const [sizeArg = '250', seed = 'probe', out] = process.argv.slice(2);
const size = Number(sizeArg);
const messages: { at: number; data: any }[] = [];
const scope: any = { onmessage: null, postMessage(data: any) { messages.push({ at: performance.now(), data }); } };
(globalThis as any).self = scope;
await import('../src/bridge/presentation.worker.ts');
let nextId = 1;
async function request(payload: any): Promise<{ reply: any; ms: number; progress: { at: number; phase: string; completed: number; total: number }[] }> {
  const id = nextId++, start = performance.now(), from = messages.length;
  scope.onmessage({ data: { ...payload, id } });
  for (;;) {
    const reply = messages.slice(from).find(m => m.data?.type === 'reply' && m.data.id === id);
    if (reply) {
      const progress = messages.slice(from).filter(m => m.data?.type === 'world-draft-progress' && m.data.id === id).map(m => ({ at: m.at - start, ...m.data.progress }));
      return { reply: reply.data, ms: reply.at - start, progress };
    }
    await new Promise(r => setTimeout(r, 2));
  }
}
const summary = (p: { at: number; phase: string; completed: number; total: number }[]) => {
  const phases = new Map<string, { first: number; last: number; steps: number; total: number }>();
  for (const s of p) { const e = phases.get(s.phase) ?? { first: s.at, last: s.at, steps: 0, total: s.total }; e.last = s.at; e.steps++; e.total = s.total; phases.set(s.phase, e); }
  return [...phases].map(([phase, e]) => `${phase}: ${(e.first / 1000).toFixed(1)}→${(e.last / 1000).toFixed(1)}s (${e.steps} steps, total ${e.total})`);
};
const input = { seed, settings: defaultWorldGenerationSettings(), player: { scenario: 'crashlanded', playerDef: 'PlayerColony', playerName: 'Colonie' } };
const generated = await request({ type: 'world-draft-generate', generation: 1, request: input });
if (!generated.reply.ok) throw Error('generate: ' + generated.reply.reason);
const preview = messages.find(m => m.data?.type === 'world-draft-preview')!.data;
let ticket: any, confirmMs = 0, tries = 0;
for (let tile = 0; tile < 20000 && !ticket; tile++) {
  const site = { generation: 1, key: preview.key, tile, size, season: 'auto' };
  const r = await request({ type: 'world-draft-confirm', request: site, geographyId: preview.geography.id }); tries++;
  if (r.reply.ok) { ticket = JSON.parse(r.reply.data); confirmMs = r.ms; }
}
if (!ticket) throw Error('No confirmable site');
let session: import('node:inspector').Session | undefined;
if (out) {
  const inspector = await import('node:inspector'); session = new inspector.Session(); session.connect();
  const post = (m: string, p?: object) => new Promise<any>((ok, ko) => session!.post(m, p ?? {}, (e, r) => e ? ko(e) : ok(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 500 }); await post('Profiler.start');
}
const party = startingOriginalRequestFromRoster256(7, Array.from({ length: 8 }, (_, i) => ({ serial: i + 1, generation: i, nameOverride: 'Original ' + (i + 1) })));
const started = await request({ type: 'world-draft-start', ticket, startingParty: party, maxSettlements: 1, threatPauseMode: 'major' });
if (session) {
  const { profile } = await new Promise<any>((ok, ko) => session!.post('Profiler.stop', (e, r) => e ? ko(e) : ok(r)));
  writeFileSync(out!, JSON.stringify(profile));
}
const lastProgress = started.progress.at(-1)?.at ?? 0;
console.log(JSON.stringify({
  size, seed, generateMs: +generated.ms.toFixed(0), generatePhases: summary(generated.progress),
  confirmTries: tries, confirmMs: +confirmMs.toFixed(0),
  startMs: +started.ms.toFixed(0), startOk: started.reply.ok, startReason: started.reply.reason,
  startPhases: summary(started.progress), afterLastProgressMs: +(started.ms - lastProgress).toFixed(0),
}, null, 1));
process.exit(0);
