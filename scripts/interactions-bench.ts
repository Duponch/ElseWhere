// Interactions lot of the 22 November feedback (section H): CPU cost of the
// readers it changed, on Les Forges. Bundle with esbuild (no --keep-names):
//   npx esbuild scripts/interactions-bench.ts --bundle --platform=node --format=esm --outfile=tmp/bench/interactions.mjs
//   node tmp/bench/interactions.mjs [save] [runs]
// « Before » readers are origin/main's map-hover-readout.ts and
// action-feedback.ts copied to tmp/bench/ with their imports re-pointed
// (see docs/development/interactions-rimworld.md).
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {gunzipSync} from 'node:zlib';
import {deserializeWorld} from '../src/sim/serialization';
import type {World} from '../src/sim/types';
import {mapHoverLines} from '../src/ui/map-hover-readout';
import {hoverTemperatureText} from '../src/ui/hover-temperature';
import {mapObjectsInRect} from '../src/ui/map-object-rectangle';
import {actionProgress,type ActionLookup} from '../src/render/action-feedback';
// @ts-ignore copied before the lot by the command of the header
import {mapHoverLines as oldMapHoverLines} from '../tmp/bench/old-map-hover-readout';
// @ts-ignore idem
import {actionProgress as oldActionProgress} from '../tmp/bench/old-action-feedback';

const path=process.argv[2]??'public/test-saves/v432/les-forges-crash-test.json',runs=Number(process.argv[3]??7);
const text=(()=>{const t=readFileSync(path,'utf8'),raw=JSON.parse(t);return raw.format==='lisiere-save'?gunzipSync(Buffer.from(raw.payload,'base64')).toString('utf8'):t;})();
const world=deserializeWorld(text) as World;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]!;};
// Deterministic cells spread over the map (hover samples).
const cells=Array.from({length:400},(_,i)=>({x:(i*37+11)%world.width,z:(i*53+7)%world.height}));
function time(label:string,fn:()=>void,per:number):void {
  const samples:number[]=[];
  for(let r=0;r<runs;r++){const start=performance.now();fn();samples.push((performance.now()-start)/per);}
  console.log(`${label}: median ${median(samples).toFixed(4)} ms (${runs} runs)`);
}
console.log(`${path}: ${world.width}x${world.height}, ${world.structures.length} structures, ${world.piles.length} piles, ${world.resources.length} plants, ${world.pawns.length} pawns, ${world.thermal?.regions.length??0} indoor regions`);
let sink=0;
time('hover readout, before (per cell)',()=>{for(const c of cells)sink+=oldMapHoverLines(world,c,.5).length;},cells.length);
time('hover readout, after (per cell)',()=>{for(const c of cells)sink+=mapHoverLines(world,c,.5).length;},cells.length);
time('hover temperature (per cell)',()=>{for(const c of cells)sink+=hoverTemperatureText(world,c).length;},cells.length);
// A selection box of 40 x 25 cells around the map centre.
const cx=Math.floor(world.width/2),cz=Math.floor(world.height/2);
time('selection box objects (per box, 40x25 cells)',()=>{const r=mapObjectsInRect(world,c=>c.x>=cx-20&&c.x<cx+20&&c.z>=cz-12&&c.z<cz+13);sink+=r.things.length+r.resources.length;},1);
time('work bars, before (all pawns, per snapshot)',()=>{const lookup={jobs:new Map(world.jobs.map(j=>[j.id,j]))};for(const p of world.pawns)sink+=oldActionProgress(world,p,lookup)?.fraction??0;},1);
const memory=new Map<number,{filthId:number;thickness:number}>();
time('work bars, after (all pawns, per snapshot)',()=>{const lookup:ActionLookup={jobs:new Map(world.jobs.map(j=>[j.id,j])),cleaningStart:memory};for(const p of world.pawns)sink+=actionProgress(world,p,lookup)?.fraction??0;},1);
console.log(`(checksum ${sink.toFixed(2)})`);
