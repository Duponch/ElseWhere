// Retours du 22 novembre, vague 2, lot 1: cost of the construction ghosts and
// of the click on drawn models, on Les Forges with a few hundred placed
// constructions (CPU only). Bundle with esbuild (no --keep-names), run with node:
//   npx esbuild scripts/ghosts-pick-bench.ts --bundle --platform=node --format=esm --outfile=tmp/ghosts/bench.mjs
//   node tmp/ghosts/bench.mjs [save] [placed] [runs]
// The before/after figures of the lot note used origin/main's JobLayer copied
// in tmp/ (docs/development/retours-20261122-vague2-lot1.md).
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import {gunzipSync} from 'node:zlib';
import * as THREE from 'three/webgpu';
import {deserializeWorld} from '../src/sim/serialization';
import {footprintCells} from '../src/sim/definitions';
import {jobDuration} from '../src/sim/farming';
import type {Job,World} from '../src/sim/types';
import {BoxBatches} from '../src/render/BoxBatches';
import {buildJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import {pickMapModel,modelPickTarget} from '../src/render/map-model-pick';
import {mapObjectsAt} from '../src/ui/map-object-selection';

const path=process.argv[2]??'public/test-saves/v432/les-forges-crash-test.json',count=Number(process.argv[3]??300),runs=Number(process.argv[4]??40);
const text=(()=>{const t=readFileSync(path,'utf8'),raw=JSON.parse(t);return raw.format==='lisiere-save'?gunzipSync(Buffer.from(raw.payload,'base64')).toString('utf8'):t;})();
const world=deserializeWorld(text) as World;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]!;};
const p95=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b);return s[Math.floor(s.length*.95)]!;};
// Free cells: no building footprint, plant, pile, rock or job.
const busy=new Uint8Array(world.width*world.height);
for(const s of world.structures)for(const c of footprintCells(s))busy[c.z*world.width+c.x]=1;
for(const r of world.resources)if(r.kind==='tree')busy[r.z*world.width+r.x]=1;
for(const j of world.jobs)for(const c of footprintCells(j))busy[c.z*world.width+c.x]=1;
world.tiles.forEach((t,i)=>{if(t.terrain==='rock'||t.fogged)busy[i]=1;});
const kinds:Job['kind'][]=['wall','wall','wall','door','bed','table','stool','standing-lamp','power-conduit','shelf','research-bench','dining-chair','armchair','lay-floor','lay-floor'];
const placed:Job[]=[];let k=0;
for(let z=2;z<world.height-3&&placed.length<count;z+=2)for(let x=2;x<world.width-3&&placed.length<count;x+=3){
  const kind=kinds[k%kinds.length]!;
  const job:Job={id:world.nextId++,kind,x,z,orientation:(k%4) as Job['orientation'],footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},...(kind==='lay-floor'?{floor:'wood-planks' as const}:{})};
  const cells=footprintCells(job);if(cells.some(c=>c.x<0||c.z<0||c.x>=world.width||c.z>=world.height||busy[c.z*world.width+c.x]))continue;
  for(const c of cells)busy[c.z*world.width+c.x]=1;
  if(k%3===0){job.construction='frame';job.progress=jobDuration(world,job)*.4;}
  placed.push(job);k++;
}
world.jobs=[...world.jobs,...placed];
console.log(JSON.stringify({save:path,structures:world.structures.length,piles:world.piles.length,resources:world.resources.length,jobs:world.jobs.length,placed:placed.length}));
let sink=0;
function time(label:string,fn:()=>void){for(let i=0;i<5;i++)fn();const xs:number[]=[];for(let i=0;i<runs;i++){const t=performance.now();fn();xs.push(performance.now()-t);}console.log(JSON.stringify({label,median:+median(xs).toFixed(3),p95:+p95(xs).toFixed(3)}));}
const boxes=new BoxBatches(),groupNew=new THREE.Group(),ghosts=new ConstructionGhosts();
time('job markers, ghosts rebuilt (placed set changed)',()=>{ghosts.clear();buildJobMarkers(world,groupNew,false,boxes,ghosts);});
time('job markers, ghosts kept (progress only)',()=>buildJobMarkers(world,groupNew,false,boxes,ghosts));
console.log(JSON.stringify({ghostParts:ghosts.allParts().length}));
{const extra:Job={id:world.nextId++,kind:'wall',x:placed[7]!.x+1,z:placed[7]!.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},material:'wood'};let on=false;
 time('job markers, one placed construction added or finished',()=>{on=!on;if(on)world.jobs.push(extra);else world.jobs.pop();buildJobMarkers(world,groupNew,false,boxes,ghosts);});
 console.log(JSON.stringify({redrawnPerChange:ghosts.redrawn}));
 const fresh=new ConstructionGhosts();buildJobMarkers(world,new THREE.Group(),false,boxes,fresh);console.log(JSON.stringify({incrementalEqualsFull:JSON.stringify(fresh.parts)===JSON.stringify(ghosts.parts)}));fresh.dispose();}
{const {constructionGhostParts}=await import('../src/render/construction-preview-parts');const {constructionGhostSpec}=await import('../src/render/construction-ghosts');
 const specs=world.jobs.flatMap(j=>{const s=constructionGhostSpec(j,world);return s?[s]:[];});
 time('ghost parts only',()=>{constructionGhostParts(world,specs);});
 const parts=constructionGhostParts(world,specs);
 time('ghost upload only',()=>{ghosts.layer.presentPlaced({...parts});});
 time('specs only',()=>{world.jobs.forEach(j=>constructionGhostSpec(j,world));});}
// Clicks: a camera above and behind the target, like the game's default view.
const rng=(()=>{let s=12345;return()=>{s=Math.imul(s^s>>>15,2246822507)+0x6d2b79f5|0;return((s>>>0)%1e6)/1e6;};})();
const rays=Array.from({length:400},()=>{const tx=8+rng()*(world.width-16),tz=8+rng()*(world.height-16),ox=tx,oy=18,oz=tz-12;const dx=tx-ox,dy=-oy,dz=tz-oz;return{ox,oy,oz,dx,dy,dz,ground:{x:Math.floor(tx+.5),z:Math.floor(tz+.5)}};});
const cold=performance.now();pickMapModel(world,rays[0]!);console.log(JSON.stringify({label:'first click (model tops measured)',ms:+(performance.now()-cold).toFixed(3)}));
let i=0,models=0;
time('click, cell list only (lot 3 path)',()=>{for(const r of rays.slice(0,10))sink+=mapObjectsAt(world,r.ground).length;});
time('click, model pick then cell list',()=>{for(const r of rays.slice(0,10)){const t=modelPickTarget(r.ground,pickMapModel(world,r));if(t?.preferred)models++;sink+=t?mapObjectsAt(world,t.cell).length:0;}});
time('click, model pick only',()=>{for(const r of rays.slice(10,20))sink+=pickMapModel(world,r)?1:0;});
for(const r of rays){const t=modelPickTarget(r.ground,pickMapModel(world,r));if(t?.preferred)i++;}
console.log(JSON.stringify({note:'times above are for 10 clicks',raysOnAnotherCellsModel:i,of:rays.length,sink}));
boxes.dispose();ghosts.dispose();
