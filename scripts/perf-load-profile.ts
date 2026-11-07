// Worker-side cost of loading a save: drives the real presentation Worker in
// Node, sends one 'load' request and profiles it until the reply arrives.
// Usage (bundle with esbuild first):
//   node tmp/perf/load-profile.mjs <save> [out.cpuprofile]
// Reports the reply time and, if the Worker posts 'load-progress' messages,
// each stage with its time.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

const [savePath = 'public/test-saves/v432/les-forges-crash-test.json', out] = process.argv.slice(2);
const read0 = performance.now();
const text = (() => { const t = readFileSync(savePath, 'utf8'); const r = JSON.parse(t); return r.format === 'lisiere-save' ? gunzipSync(Buffer.from(r.payload, 'base64')).toString('utf8') : t; })();
const readMs = performance.now() - read0;
const replies: any[] = [], progress: { at: number; stage: string; done?: number; total?: number }[] = [], posted: { at: number; kind: string; bytes?: number }[] = [];
let start = 0;
const scope: any = {
  onmessage: null,
  postMessage(message: any) {
    const at = performance.now() - start;
    if (message?.type === 'reply') replies.push({ ...message, at });
    else if (message?.type === 'load-progress') progress.push({ at, stage: message.stage, done: message.done, total: message.total });
    else posted.push({ at, kind: `${message?.type ?? '?'}:${message?.kind ?? message?.resident?.kind ?? ''}` });
  },
};
(globalThis as any).self = scope;
await import('../src/bridge/presentation.worker.ts');
let session: import('node:inspector').Session | undefined;
if (out) {
  const inspector = await import('node:inspector'); session = new inspector.Session(); session.connect();
  const post = (m: string, p?: object) => new Promise<any>((ok, ko) => session!.post(m, p ?? {}, (e, r) => e ? ko(e) : ok(r)));
  await post('Profiler.enable'); await post('Profiler.setSamplingInterval', { interval: 500 }); await post('Profiler.start');
}
start = performance.now();
scope.onmessage({ data: { id: 1, type: 'load', data: text, threatPauseMode: 'never' } });
while (!replies.some(r => r.id === 1)) await new Promise(r => setTimeout(r, 5));
const reply = replies.find(r => r.id === 1);
if (session) {
  const { profile } = await new Promise<any>((ok, ko) => session!.post('Profiler.stop', (e, r) => e ? ko(e) : ok(r)));
  writeFileSync(out!, JSON.stringify(profile));
}
console.log(JSON.stringify({ save: savePath, readAndGunzipMs: +readMs.toFixed(0), replyMs: +reply.at.toFixed(0), ok: reply.ok, reason: reply.reason,
  progress: progress.map(p => `${(p.at / 1000).toFixed(1)}s ${p.stage}${p.total ? ` ${p.done}/${p.total}` : ''}`),
  postedBeforeReply: posted.filter(p => p.at <= reply.at).map(p => `${(p.at / 1000).toFixed(1)}s ${p.kind}`).slice(0, 12) }, null, 1));
process.exit(0);
