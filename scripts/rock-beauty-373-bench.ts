// Lot 373 cost of the room stats and perceived beauty passes on a real save
// (CPU only), under the 372 rules and the 373 rules of the same loaded world.
// Bundle with esbuild (no --keep-names) and run with node:
//   npx esbuild scripts/rock-beauty-373-bench.ts --bundle --platform=node --format=esm --outfile=tmp/rock373/bench.mjs
//   node tmp/rock373/bench.mjs [save] [runs]
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {gunzipSync} from 'node:zlib';
import {deserializeWorld} from '../src/sim/serialization';
import {RoomTopologyCache} from '../src/sim/room-topology';
import {RoomQualityCapture} from '../src/sim/room-quality';
import * as need from '../src/sim/beauty-need';
const {beautyMapAt,captureWorldBeauty}=need;
// The need's own fog reader (absent before 373: the older capture ignores it).
const fogOf=(w:World)=>(need as {worldFog?:(w:World)=>((i:number)=>boolean)|undefined}).worldFog?.(w);
import {RoomBeautyCapture} from '../src/sim/room-beauty';
import type {World} from '../src/sim/types';

const path=process.argv[2]??'public/test-saves/v432/les-forges-crash-test.json',runs=Number(process.argv[3]??200);
const text=(()=>{const t=readFileSync(path,'utf8'),raw=JSON.parse(t);return raw.format==='lisiere-save'?gunzipSync(Buffer.from(raw.payload,'base64')).toString('utf8'):t;})();
const base=deserializeWorld(text) as World;
const topology=new RoomTopologyCache().read(base);
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]!;};
const p95=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length*.95)]!;};
// One cell of every enclosed space: the room stats pass of every room.
const roots:{x:number;z:number}[]=[];
for(const space of topology.allSpaces())if(!space.touchesMapEdge)roots.push({x:(space.id-1)%base.width,z:Math.floor((space.id-1)/base.width)});
const pawns=base.pawns.filter(p=>!(p.state==='dead'||p.state==='sleeping'||p.medicalSleep));
const worlds={372:{...base,schemaVersion:372 as never} as World,373:base};
let sink=0;
function time(label:string,read:(w:World)=>number){
  const out:Record<string,number>={};
  for(const version of [372,373,372,373] as const){
    const w=worlds[version];for(let i=0;i<20;i++)sink+=read(w);
    const xs:number[]=[];for(let i=0;i<runs;i++){const t=performance.now();sink+=read(w);xs.push(performance.now()-t);}
    out[`median${version}`]=+median(xs).toFixed(4);out[`p95_${version}`]=+p95(xs).toFixed(4);
  }
  console.log(JSON.stringify({label,...out}));
}
console.log(JSON.stringify({save:path,schema:base.schemaVersion,tick:base.tick,rooms:roots.length,pawns:pawns.length,runs}));
time('room stats (RoomQualityCapture, every enclosed room)',w=>{const c=new RoomQualityCapture(w,topology);let s=0;for(const r of roots)s+=c.room(r)?.total??0;return s;});
time('room beauty capture (full BeautyMapCache + every room)',w=>{const c=captureWorldBeauty(w,topology);let s=0;for(const r of roots)s+=c.room(r)?.total??0;return s;});
time('beauty need pulse (partial map + perceived of every awake pawn)',w=>{const v=new RoomBeautyCapture(beautyMapAt(w,pawns),topology,fogOf(w));let s=0;for(const p of pawns)s+=v.perceived(p);return s;});
const views=new Map(([372,373] as const).map(v=>[worlds[v],new RoomBeautyCapture(beautyMapAt(worlds[v],pawns),topology,fogOf(worlds[v]))]));
time('perceived only (every awake pawn, map already built)',w=>{const v=views.get(w)!;let s=0;for(const p of pawns)s+=v.perceived(p);return s;});
console.log(JSON.stringify({sink:Number.isFinite(sink)}));
