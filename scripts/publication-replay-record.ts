// Exactness tool for publication work (not product code): the real presentation
// Worker (simulation + encoders + phase publisher) driven in Node under a
// VIRTUAL clock. Wall time and task delivery are the only nondeterministic
// inputs of the Worker loop; here both follow a fixed script, so two builds of
// the Worker that publish the same thing produce the same record, message for
// message. Each posted message is hashed over a canonical encoding of what a
// structured clone transmits: types, key order, exact doubles (-0 and NaN
// count), own undefined, typed arrays, and which objects are shared references.
// (The engine's own clone bytes also vary with the internal number
// representation, small integer or double, which no receiver can observe.)
// The final save is hashed too.
// Usage (bundle with esbuild first, once per source tree to compare):
//   npx esbuild scripts/publication-replay-record.ts --bundle --platform=node --format=esm --outfile=tmp/perf/replay-record.mjs
//   node tmp/perf/replay-record.mjs <save> <out.json> [macroTicks=60] [profile=mixed|fast|slow]
//   DUMP=<n> also writes message n as readable JSON, to diff two builds.
// Then: node scripts/publication-replay-compare.mjs a.json b.json
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const [savePath, outPath, ticksArg = '60', profile = 'mixed'] = process.argv.slice(2);
if (!savePath || !outPath) throw Error('Usage: replay-record <save> <out.json> [macroTicks] [profile]');
const wantedTicks = Number(ticksArg);
const text = (() => { const t = readFileSync(savePath, 'utf8'); const r = JSON.parse(t); return r.format === 'lisiere-save' ? gunzipSync(Buffer.from(r.payload, 'base64')).toString('utf8') : t; })();

// Virtual clock and controlled task delivery.
let now = 1000, wake: () => void = () => {};
const tasks: (() => void)[] = [];
performance.now = () => now;
(globalThis as any).setInterval = (callback: () => void, ms: number) => { if (ms !== 20) throw Error('Unexpected interval ' + ms); wake = callback; return 0; };
class ControlledChannel {
  port1: any = { onmessage: null, unref() {} };
  port2: any = { postMessage: (data: unknown) => { tasks.push(() => this.port1.onmessage?.({ data })); }, unref() {} };
}
(globalThis as any).MessageChannel = ControlledChannel;
// Scripted task durations (ms), a fixed pseudo-random sequence per profile.
let seed = 0x2f6e2b1;
const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
const taskMs = (): number => {
  const r = next();
  if (profile === 'fast') return 0.25;
  if (profile === 'slow') return r < .5 ? 9 : r < .9 ? 60 : 140;
  return r < .55 ? 0.5 : r < .8 ? 6 : r < .93 ? 25 : r < .98 ? 70 : 150;
};

interface Row { n: number; at: number; type: string; kind?: string; tick?: number; core?: number; bytes: number; sha: string }
const rows: Row[] = [], replies = new Map<number, any>();
let lastTick = -1, firstTick = -1;
const sha = (buffer: Uint8Array | string) => createHash('sha256').update(buffer).digest('hex');
/** Canonical walk; returns the hash, the encoded size and, on request, the
 * paths of shared references (first path -> later paths). */
function canonical(message: unknown, shared?: string[]): { sha: string; bytes: number } {
  const hash = createHash('sha256'), seen = new Map<object, { index: number; path: string }>();
  let chunk: string[] = [], pending = 0, bytes = 0;
  const put = (text: string) => { chunk.push(text); pending += text.length; bytes += text.length; if (pending > 65536) { hash.update(chunk.join('')); chunk = []; pending = 0; } };
  const bits = new Float64Array(1), words = new Uint32Array(bits.buffer);
  const walk = (v: unknown, path: string): void => {
    if (v === undefined) return put('u'); if (v === null) return put('n');
    if (typeof v === 'boolean') return put(v ? 't' : 'f');
    if (typeof v === 'number') { bits[0] = v; return put('d' + words[0]!.toString(36) + '.' + words[1]!.toString(36)); }
    if (typeof v === 'string') return put('s' + v.length + ':' + v);
    if (typeof v !== 'object') throw Error('Unsupported value in a posted message at ' + path);
    const known = seen.get(v);
    if (known) { shared?.push(known.path + ' <- ' + path); return put('r' + known.index); }
    seen.set(v, { index: seen.size, path });
    if (ArrayBuffer.isView(v)) { const view = v as unknown as { constructor: { name: string }; buffer: ArrayBuffer; byteOffset: number; byteLength: number }; put('b' + view.constructor.name + view.byteLength); hash.update(chunk.join('')); chunk = []; pending = 0; hash.update(new Uint8Array(view.buffer, view.byteOffset, view.byteLength)); bytes += view.byteLength; return; }
    if (Array.isArray(v)) { put('a' + v.length); for (let i = 0; i < v.length; i++) { if (!(i in v)) put('h'); else walk(v[i], shared ? path + '[' + i + ']' : path); } return; }
    const keys = Object.keys(v); put('o' + keys.length);
    for (const key of keys) { put('k' + key.length + ':' + key); walk((v as Record<string, unknown>)[key], shared ? path + '.' + key : path); }
  };
  walk(message, '$'); hash.update(chunk.join(''));
  return { sha: hash.digest('hex'), bytes };
}
// Frontier path patches (CorePathKeep297), rebuilt here as the documented
// reader does, independently of it: a row listed in `paths297` carries no
// cells, and its path is the tail of the path held for that actor (from the
// last complete publication, its last row or its last pose patch). The record
// then hashes the complete rows, so a build that sends path patches and one
// that sends every cell compare equal exactly when they present the same paths.
const heldPaths = new Map<number, readonly unknown[]>();
function expandPaths(message: any): any {
  if (message?.type === 'resident-publication' && message.publication?.type === 'snapshot') {
    const world = message.publication.world; heldPaths.clear();
    for (const actor of [...world?.pawns ?? [], ...world?.wildlife?.animals ?? [], ...world?.mechanoids ?? []]) heldPaths.set(actor.id, structuredClone(actor.path));
    return message;
  }
  if (message?.type !== 'actor-frontier-297' && message?.type !== 'actor-phase-297') return message;
  const keeps = new Map<number, number>((message.paths297 ?? []).map((row: any) => [row.id, row.keep]));
  const actors = message.actors.map((row: any) => {
    const keep = keeps.get(row.id); if (keep === undefined) return row;
    const held = heldPaths.get(row.id); if (!held || keep > held.length || row.fields.path.length !== 0) throw Error(`Path patch without a held path for actor ${row.id}`);
    return { ...row, fields: { ...row.fields, path: held.slice(held.length - keep) } };
  });
  for (const row of actors) heldPaths.set(row.id, row.fields.path);
  for (const pose of message.poses297 ?? []) heldPaths.set(pose.id, pose.actor.path);
  if (!keeps.size) return message;
  const { paths297: _paths, ...rest } = message; return { ...rest, actors };
}
// Compact resource updates of a complete publication (growth tuples, plant age
// tuples), rebuilt here, independently of the readers, into the complete
// records they stand for; they are then merged with the complete upserts and
// sorted by id. A build that sends a tuple and one that sends the whole record
// compare equal exactly when the record rebuilt from the tuple (from the record
// held since the previous publication) is the record the other build sent.
const heldResources = new Map<number, any>();
function expandResources(message: any): any {
  if (message?.type !== 'resident-publication' || message.publication?.type !== 'snapshot') return message;
  const publication = message.publication;
  if (publication.kind === 'checkpoint') { heldResources.clear(); for (const resource of publication.world.resources ?? []) heldResources.set(resource.id, structuredClone(resource)); return message; }
  const changes = publication.resources; if (!changes) return message;
  const touched = new Map<number, any>();
  for (const id of changes.removed) heldResources.delete(id);
  for (const resource of changes.upserted) touched.set(resource.id, structuredClone(resource));
  const growth: Float64Array | undefined = changes.growth, life: Float64Array | undefined = changes.life;
  for (let i = 0; growth && i < growth.length; i += 4) {
    const id = growth[i]!, old = heldResources.get(id); if (!old || touched.has(id)) throw Error(`Growth tuple without a held resource ${id}`);
    const next = { ...old, growth: growth[i + 1], growthTick: growth[i + 2] };
    if (Number.isNaN(growth[i + 3]!)) delete next.growthThermalFactor; else next.growthThermalFactor = growth[i + 3];
    touched.set(id, next);
  }
  for (let i = 0; life && i < life.length; i += 4) {
    const id = life[i]!, old = heldResources.get(id); if (!old?.plantLife || touched.has(id)) throw Error(`Plant age tuple without a held record ${id}`);
    touched.set(id, { ...old, plantLife: { ...old.plantLife, age: life[i + 1], darkTicks: life[i + 2], nextCheck: life[i + 3] } });
  }
  for (const [id, resource] of touched) heldResources.set(id, resource);
  const { growth: _growth, life: _life, ...rest } = changes;
  return { ...message, publication: { ...publication, resources: { ...rest, upserted: [...touched.values()].sort((a, b) => a.id - b.id) } } };
}
const scope: any = {
  onmessage: null,
  postMessage(message: any) {
    if (message?.type === 'reply') replies.set(message.id, message);
    // RAW=1 records the messages as sent (path patches not rebuilt), to inspect the wire.
    if (!process.env.RAW) message = expandResources(expandPaths(message));
    const tick = message?.publication?.world?.tick ?? message?.world?.tick ?? message?.summary?.tick;
    if (typeof tick === 'number') { lastTick = Math.max(lastTick, tick); if (firstTick < 0) firstTick = tick; }
    // A reply's save text is hashed apart; operation progress carries wall durations only in older builds.
    const shared: string[] | undefined = process.env.DUMP !== undefined && rows.length === Number(process.env.DUMP) ? [] : undefined;
    const encoded = canonical(message, shared);
    if (shared) writeFileSync(`${outPath}.msg${rows.length}.shared.txt`, shared.join(String.fromCharCode(10)));
    // DUMP=<n>: also write message n as readable JSON beside the record, to diff two builds.
    if (process.env.DUMP !== undefined && rows.length === Number(process.env.DUMP)) writeFileSync(`${outPath}.msg${rows.length}.json`, JSON.stringify(message, (_k, v) => v === undefined ? '__undefined__' : ArrayBuffer.isView(v) ? { typed: v.constructor.name, values: Array.from(v as any) } : Object.is(v, -0) ? '__-0__' : v, 1));
    rows.push({ n: rows.length, at: now, type: String(message?.type), ...message?.publication?.kind ? { kind: message.publication.kind } : {}, ...typeof tick === 'number' ? { tick } : {}, ...typeof message?.toCore === 'number' ? { core: message.toCore } : {}, bytes: encoded.bytes, sha: encoded.sha });
  },
};
(globalThis as any).self = scope;
await import('../src/bridge/presentation.worker.ts');

let id = 0;
const request = async (data: any): Promise<any> => {
  const rid = ++id; scope.onmessage({ data: { ...data, id: rid } });
  for (let i = 0; !replies.has(rid); i++) { await new Promise(r => setImmediate(r)); if (i > 2_000_000) throw Error('No reply to ' + data.type); }
  const reply = replies.get(rid); if (!reply.ok) throw Error(`${data.type} failed: ${reply.reason}`); return reply;
};
const drain = () => { for (let guard = 0; tasks.length; guard++) { if (guard > 100000) throw Error('Runaway tasks'); const task = tasks.shift()!; now += taskMs(); task(); } };
const run = (macroTicks: number) => { const until = lastTick + macroTicks; for (let i = 0; lastTick < until; i++) { if (i > 200000) throw Error('Simulation does not advance'); now += 20; wake(); drain(); } };

await request({ type: 'load', data: text, threatPauseMode: 'never' });
const third = Math.max(1, Math.floor(wantedTicks / 3));
await request({ type: 'speed', speed: 6 }); run(third);
await request({ type: 'speed', speed: 1 }); run(third);
await request({ type: 'speed', speed: 0 }); for (let i = 0; i < 5; i++) { now += 20; wake(); drain(); }
await request({ type: 'speed', speed: 3 }); run(third);
await request({ type: 'speed', speed: 0 });
const saved = await request({ type: 'save' });
const kinds = new Map<string, number>(); for (const row of rows) { const k = row.type + (row.kind ? ':' + row.kind : ''); kinds.set(k, (kinds.get(k) ?? 0) + 1); }
const out = { save: savePath, profile, macroTicks: lastTick - firstTick, messages: rows.length, kinds: Object.fromEntries(kinds), totalBytes: rows.reduce((s, r) => s + r.bytes, 0), allSha: sha(rows.map(r => r.sha).join('\n')), saveSha: sha(String(saved.data)), rows };
writeFileSync(outPath, JSON.stringify(out));
console.log(JSON.stringify({ ...out, rows: undefined }));
process.exit(0);
