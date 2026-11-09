import {SCHEMA_VERSION} from './types.ts';
import {isSchema281OrLater} from './schema-compatibility-257.ts';
import {isStoneKind} from './geology.ts';
import {isColonist} from './affiliation.ts';
import {workProgress,WORK_FRACTIONS} from './work-progress.ts';
import {smoothFloorReason281,canTouchSmoothFloor281} from './smooth-floor-281.ts';
import {captureStructureNavigation,type StructureNavigationGeometry} from './structure-navigation.ts';
import type {Pawn,Tile,World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const field=(v:object,key:PropertyKey):unknown=>{const d=Object.getOwnPropertyDescriptor(v,key);if(d&&!Object.hasOwn(d,'value'))throw Error('Accessor');return d?.value;};
const branches=['world','tiles','jobs','worldMaps','sites','map','secondarySite','campaignMap','campaign','worldGroups','groups','group','context','state','collapsedRock','upserted'];

/** Inspect only real terrain/job owner lanes. Labels and ordinary strings are
 * never new content; tile tuples have their existing positional contract. */
export function validSmoothFloorsHistoricalTransport281(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 if(isSchema281OrLater(version))return true;
 const active=new Set<object>();
 const walk=(v:unknown,tiles=false):boolean=>{
  if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  active.add(v);
  if(Array.isArray(v)){
   // A transport tuple is visited from its tiles lane only. Full tile objects
   // keep their named shape; no packed pawn/body fields are reclassified.
   if(tiles&&field(v,1)==='smoothed-stone')return false;
   for(let i=0;i<v.length;i++)if(!walk(field(v,String(i)),tiles))return false;
  }else{
   if(field(v,'terrain')==='smoothed-stone'||field(v,'kind')==='smooth-floor')return false;
   for(const key of branches){const d=Object.getOwnPropertyDescriptor(v,key);if(d&&!walk(field(v,key),key==='tiles')||!d&&key in v)return false;}
  }
  active.delete(v);return true;
 };
 try{return walk(value);}catch{return false;}
}

/** Both uncovered and truly retained collapse substrates keep the same stone.
 * A collapsed rock may accumulate its own mining damage; bare smooth cannot. */
export function validSmoothFloorTile281(tile:Tile,version:number):boolean {
 if(tile.terrain!=='smoothed-stone'&&tile.collapsedRock?.terrain!=='smoothed-stone')return true;
 return isSchema281OrLater(version)&&isStoneKind(tile.stone)&&tile.mineable===undefined&&tile.bridge===undefined
  &&tile.ore===undefined&&tile.miningYield===undefined
  &&(tile.collapsedRock?tile.terrain==='rock':tile.miningDamage===undefined);
}

const keys=new Set(['id','kind','x','z','orientation','footprint','status','reservedBy','progress','workRemainder','escrow']);
const noClaims:readonly Pawn[]=Object.freeze([]);
/** Reuse the shared local eligibility. This scans only rare smoothing jobs,
 * never rooms, all terrain or people's clinical dossiers. */
export function validateSmoothFloors281(w:World,version:number):string[] {
 const errors:string[]=[];let cells:Set<number>|undefined,geometry:StructureNavigationGeometry|undefined;
 let workersByJob:Map<number,Pawn[]>|undefined,materialJobs:Set<number>|undefined;
 for(const job of w.jobs){
  if(job.kind!=='smooth-floor')continue;
  if(!cells){
   cells=new Set();geometry=captureStructureNavigation(w);workersByJob=new Map();materialJobs=new Set();
   for(const p of w.pawns)if(p.jobId!==null){const group=workersByJob.get(p.jobId);if(group)group.push(p);else workersByJob.set(p.jobId,[p]);}
   for(const p of w.piles)if(p.owner.type==='job')materialJobs.add(p.owner.jobId);
  }
  const index=job.z*w.width+job.x,progress=workProgress(job);
  if(!isSchema281OrLater(version)||Object.keys(job).some(k=>!keys.has(k))
   ||job.orientation!==0||job.footprint!=='standard'||cells.has(index)
   ||!Number.isSafeInteger(job.progress)||job.progress<0||!Number.isFinite(progress)||progress>=280
   ||job.workRemainder!==undefined&&(!Number.isSafeInteger(job.workRemainder)||job.workRemainder<=0||job.workRemainder>=WORK_FRACTIONS)
   ||!job.escrow||Object.keys(job.escrow).some(k=>k!=='wood'&&k!=='food')||job.escrow.wood!==0||job.escrow.food!==0
   ||smoothFloorReason281(w,job,job.id,geometry)!==undefined)errors.push('Invalid natural stone smoothing job.');
  cells.add(index);
  const claims=workersByJob!.get(job.id)??noClaims;
  if(job.status==='pending'){
   if(job.reservedBy!==null||progress!==0||claims.length)errors.push('Pending smoothing job retains work or an actor.');
  }else if(job.status==='active'){
   const p=claims[0];
   if(claims.length!==1||!p||job.reservedBy!==p.id||!isColonist(p)||p.prisoner||p.visitor||p.podRescue||p.raid||p.draft||p.mental?.crisis
    ||p.state!=='working'&&p.state!=='moving'||p.priorities.build===0&&p.orders.active!==job.id
    ||p.state==='working'&&!canTouchSmoothFloor281(w,p,job,geometry))errors.push('Smoothing job lacks its actual free worker or contact.');
  }else errors.push('Invalid smoothing job phase.');
  if(materialJobs!.has(job.id))errors.push('Natural stone smoothing cannot own ingredients.');
 }
 return errors;
}

/** A removed/retyped/moved intention cannot leave its former live owner in a
 * sparse successor. New load epochs intentionally pass no predecessor. */
export function validSmoothFloorWorld281(w:World,previous?:World):boolean {
 try{
  if(!Number.isSafeInteger(w.schemaVersion)||Number(w.schemaVersion)<1||Number(w.schemaVersion)>SCHEMA_VERSION)return false;
  if(validateSmoothFloors281(w,w.schemaVersion).length)return false;
  let jobs:Map<number,World['jobs'][number]>|undefined,claimedJobs:Set<number>|undefined;
  for(const before of previous?.jobs??[])if(before.kind==='smooth-floor'){
   jobs??=new Map(w.jobs.map(j=>[j.id,j]));const now=jobs.get(before.id);
   if(now&&(now.kind!=='smooth-floor'||now.x!==before.x||now.z!==before.z))return false;
   if(!now){
    if(!claimedJobs){claimedJobs=new Set();for(const p of w.pawns){
     if(p.jobId!==null)claimedJobs.add(p.jobId);
     if(typeof p.orders.active==='number')claimedJobs.add(p.orders.active);
     for(const order of p.orders.queue)if(typeof order==='number')claimedJobs.add(order);
    }}
    if(claimedJobs.has(before.id))return false;
   }
  }
  return true;
 }catch{return false;}
}
