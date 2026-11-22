import {SCHEMA_VERSION} from './types.ts';
import {isStoneKind} from './geology.ts';
import {isColonist} from './affiliation.ts';
import {workProgress,WORK_FRACTIONS} from './work-progress.ts';
import {isSmoothWallSchema367,smoothWallReason367,canTouchSmoothWall367,SMOOTH_WALL_WORK_367} from './smooth-wall-367.ts';
import {captureStructureNavigation,type StructureNavigationGeometry} from './structure-navigation.ts';
import type {Pawn,Tile,World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const field=(v:object,key:PropertyKey):unknown=>{const d=Object.getOwnPropertyDescriptor(v,key);if(d&&!Object.hasOwn(d,'value'))throw Error('Accessor');return d?.value;};
const branches=['world','tiles','jobs','worldMaps','sites','map','secondarySite','campaignMap','campaign','worldGroups','groups','group','context','state','upserted'];

/** Below 367 no lane may carry a smoothed wall or a SmoothWall job: tile
 * objects, the thirteenth slot of a tile tuple, or a `smooth-wall` job. */
export function validSmoothWallsHistoricalTransport367(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 if(isSmoothWallSchema367(version))return true;
 const active=new Set<object>();
 const walk=(v:unknown,tiles=false):boolean=>{
  if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  active.add(v);
  if(Array.isArray(v)){
   if(tiles&&v.length>12&&typeof field(v,0)==='number'&&typeof field(v,1)==='string')return false;
   for(let i=0;i<v.length;i++)if(!walk(field(v,String(i)),tiles))return false;
  }else{
   if(field(v,'smoothedWall367')!==undefined||Object.hasOwn(v,'smoothedWall367')||field(v,'kind')==='smooth-wall')return false;
   for(const key of branches){const d=Object.getOwnPropertyDescriptor(v,key);if(d&&!walk(field(v,key),key==='tiles')||!d&&key in v)return false;}
  }
  active.delete(v);return true;
 };
 try{return walk(value);}catch{return false;}
}

/** The flag sits only on a natural stone wall (terrain rock, one of the five
 * stones, no ore, not collapsed rock), from 367. A partial mining damage of the
 * smoothed wall is kept by the ordinary mining validator. */
export function validSmoothWallTile367(tile:Tile,version:number):boolean {
 const d=Object.getOwnPropertyDescriptor(tile,'smoothedWall367');
 if(!d)return !('smoothedWall367' in tile);
 return Object.hasOwn(d,'value')&&d.enumerable===true&&d.value===true&&isSmoothWallSchema367(version)
  &&tile.terrain==='rock'&&isStoneKind(tile.stone)&&tile.ore===undefined&&tile.collapsedRock===undefined&&tile.miningYield===undefined&&tile.floor===undefined&&tile.bridge===undefined;
}

const keys=new Set(['id','kind','x','z','orientation','footprint','status','reservedBy','progress','workRemainder','escrow']);
const noClaims:readonly Pawn[]=Object.freeze([]);
/** Only the rare SmoothWall jobs are visited; no terrain or room scan. */
export function validateSmoothWalls367(w:World,version:number):string[] {
 const errors:string[]=[];let cells:Set<number>|undefined,geometry:StructureNavigationGeometry|undefined;
 let workersByJob:Map<number,Pawn[]>|undefined,materialJobs:Set<number>|undefined;
 for(const job of w.jobs){
  if(job.kind!=='smooth-wall')continue;
  if(!cells){
   cells=new Set();geometry=captureStructureNavigation(w);workersByJob=new Map();materialJobs=new Set();
   for(const p of w.pawns)if(p.jobId!==null){const group=workersByJob.get(p.jobId);if(group)group.push(p);else workersByJob.set(p.jobId,[p]);}
   for(const p of w.piles)if(p.owner.type==='job')materialJobs.add(p.owner.jobId);
  }
  const index=job.z*w.width+job.x,progress=workProgress(job);
  if(!isSmoothWallSchema367(version)||Object.keys(job).some(k=>!keys.has(k))
   ||job.orientation!==0||job.footprint!=='standard'||cells.has(index)
   ||!Number.isSafeInteger(job.progress)||job.progress<0||!Number.isFinite(progress)||progress>=SMOOTH_WALL_WORK_367
   ||job.workRemainder!==undefined&&(!Number.isSafeInteger(job.workRemainder)||job.workRemainder<=0||job.workRemainder>=WORK_FRACTIONS)
   ||!job.escrow||Object.keys(job.escrow).some(k=>k!=='wood'&&k!=='food')||job.escrow.wood!==0||job.escrow.food!==0
   ||smoothWallReason367(w,job,job.id)!==undefined)errors.push('Invalid natural wall smoothing job.');
  cells.add(index);
  const claims=workersByJob!.get(job.id)??noClaims;
  if(job.status==='pending'){
   if(job.reservedBy!==null||progress!==0||claims.length)errors.push('Pending wall smoothing job retains work or an actor.');
  }else if(job.status==='active'){
   const p=claims[0];
   if(claims.length!==1||!p||job.reservedBy!==p.id||!isColonist(p)||p.prisoner||p.visitor||p.podRescue||p.raid||p.draft||p.mental?.crisis
    ||p.state!=='working'&&p.state!=='moving'||p.priorities.build===0&&p.orders.active!==job.id
    ||p.state==='working'&&!canTouchSmoothWall367(w,p,job,geometry))errors.push('Wall smoothing job lacks its actual free worker or contact.');
  }else errors.push('Invalid wall smoothing job phase.');
  if(materialJobs!.has(job.id))errors.push('Natural wall smoothing cannot own ingredients.');
 }
 return errors;
}

/** A removed or moved SmoothWall job cannot leave its former live owner in a
 * sparse successor. New load epochs pass no predecessor. */
export function validSmoothWallWorld367(w:World,previous?:World):boolean {
 try{
  if(!Number.isSafeInteger(w.schemaVersion)||Number(w.schemaVersion)<1||Number(w.schemaVersion)>SCHEMA_VERSION)return false;
  if(validateSmoothWalls367(w,w.schemaVersion).length)return false;
  let jobs:Map<number,World['jobs'][number]>|undefined,claimedJobs:Set<number>|undefined;
  for(const before of previous?.jobs??[])if(before.kind==='smooth-wall'){
   jobs??=new Map(w.jobs.map(j=>[j.id,j]));const now=jobs.get(before.id);
   if(now&&(now.kind!=='smooth-wall'||now.x!==before.x||now.z!==before.z))return false;
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
