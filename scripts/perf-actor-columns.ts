// Fixed actual Full actor frames, captured by publication-replay-record.ts.
// CPU-only: same frames/order/values, separately time the producer, structured
// clone, and checked frozen reconstruction. No GPU or FPS claim.
import {readFileSync} from 'node:fs';
import {deserialize,serialize} from 'node:v8';
import {performance} from 'node:perf_hooks';
import {isDeepStrictEqual} from 'node:util';
import {ResidentActorsEncoder,ResidentActorsFrameOwner} from '../src/bridge/resident-actors-section';
import {frozenDataInPlace297} from '../src/bridge/core-frozen-copy-297';
import type {SnapshotMessage} from '../src/bridge/snapshots';
import type {World} from '../src/sim/types';
const [input,roundsArg='8']=process.argv.slice(2),rounds=Number(roundsArg);
if(!input||!Number.isInteger(rounds)||rounds<2||rounds>30)throw Error('Usage: perf-actor-columns frames.bin [rounds]');
const frames=deserialize(readFileSync(input)) as SnapshotMessage<true>[];
if(!frames.length||frames[0]!.kind!=='checkpoint')throw Error('Need actual checkpoint-anchored frames');
type Times={encode:number;clone:number;receive:number;bytes:number;frames:number};
function run(compact:boolean,measure:boolean):Times {
 const encoder=new ResidentActorsEncoder(),reader=new ResidentActorsFrameOwner(),result:Times={encode:0,clone:0,receive:0,bytes:0,frames:0};
 for(const frame of frames){
  let t=performance.now();const draft=compact?encoder.prepare(frame):undefined;if(draft)encoder.commit(draft);
  if(measure)result.encode+=performance.now()-t;
  const outgoing=draft?{packet:draft.packet,columns:draft.actors}:{packet:frame};
  // Byte measurement is outside timings and only on the validation round.
  if(!measure)result.bytes+=serialize(outgoing).byteLength;
  t=performance.now();const received=structuredClone(outgoing);if(measure)result.clone+=performance.now()-t;
  t=performance.now();let world=received.packet.world;
  if('columns'in received){const staged=reader.prepare(received.packet,received.columns);if(!staged)throw Error('Actor column rejected');world=staged.packet.world;reader.commit(world as World,staged);}
  else {frozenDataInPlace297(world.pawns);frozenDataInPlace297(world.wildlife?.animals??[]);}
  if(measure)result.receive+=performance.now()-t;
  if(!measure&&!isDeepStrictEqual(world,frame.world))throw Error('Literal actor frame divergence');
  result.frames++;
 }
 return result;
}
const validation=[run(false,false),run(true,false)],results:{version:'literal'|'columns';round:number;times:Times}[]=[];
for(let round=0;round<rounds;round++)for(const compact of round%2===0?[false,true]:[true,false])results.push({version:compact?'columns':'literal',round,times:run(compact,true)});
const median=(values:number[])=>values.sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
const summary=Object.fromEntries(['literal','columns'].map(version=>{const rows=results.filter(r=>r.version===version).map(r=>r.times);return[version,Object.fromEntries(['encode','clone','receive','total'].map(key=>[key,median(rows.map(r=>(key==='total'?r.encode+r.clone+r.receive:r[key as 'encode'|'clone'|'receive'])/r.frames))]))];}));
console.log(JSON.stringify({frames:frames.length,validation,summary,results},null,2));
