import {idleOtherActivity300} from './idle-wander-300.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {constructionRecipe} from './construction-materials.ts';
import {workProgress,WORK_FRACTIONS} from './work-progress.ts';
import {frameWorkProjectionUnits301} from './frame-work-projection-301.ts';
import type {HumanOwnershipCapture} from './human-owners.ts';
import type {Pawn,World} from './types.ts';

export interface FrameWork301 {required:number;done:number}
export type FrameToil301={kind:'work';jobId:number;ticksLeft:number}|{kind:'retired';jobId:number;atCore:number};
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const single=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v)&&Math.fround(v)===v;
const malformed=Symbol('malformed FinishFrame301 data');
function data(v:Record<string,unknown>,key:string):unknown {
 const d=Object.getOwnPropertyDescriptor(v,key);if(!d)return key in v?malformed:undefined;
 return d.enumerable&&Object.hasOwn(d,'value')?d.value:malformed;
}
function exact(v:unknown,fields:readonly string[]):v is Record<string,unknown> {
 if(!record(v))return false;const proto=Object.getPrototypeOf(v);if(proto!==null&&proto!==Object.prototype)return false;
 const keys=Reflect.ownKeys(v);return keys.length===fields.length&&keys.every(k=>typeof k==='string'&&fields.includes(k)&&data(v,k)!==malformed);
}
/** Only this qualified producer is prospective301. Other recipes keep their
 * existing work representation; neither load nor this guard creates history. */
export function validFrameWorkJob301(value:unknown,version:number):boolean {
 try{
  if(!record(value)||!integer(version,1,301))return false;
  if('jobTickDelta301'in value||'frameToil301'in value||'postureUntilCore301'in value)return false;
  if(!('frameWork301'in value))return true;
  if(version!==301||data(value,'kind')!=='wall'||data(value,'material')!=='wood'||data(value,'construction')!=='frame'||'furniture'in value||'clearance'in value||'wallDoor296'in value)return false;
  const work=data(value,'frameWork301');if(!exact(work,['required','done'])||data(work,'required')!==94.5||!single(data(work,'done'))||Number(data(work,'done'))<0)return false;
  const progress=data(value,'progress'),remainder=data(value,'workRemainder');
  if(!integer(progress)||remainder!==undefined&&!integer(remainder,1,WORK_FRACTIONS-1))return false;
  const duration=constructionRecipe({kind:'wall',material:'wood'}).work;
  const projected=workProgress({progress,...remainder===undefined?{}:{workRemainder:remainder as number}});
  const units=Number(progress)*WORK_FRACTIONS+Number(remainder??0);
  // The existing Whole guard also refuses a completed job left in queue.
  return projected<duration&&units===frameWorkProjectionUnits301(Number(data(work,'done')),94.5,duration);
 }catch{return false;}
}
/** Capture an own-data view only for the already existing no-other-activity
 * consumer. No accessor is invoked and no World/task/permission is minted. */
function noOtherActivity(value:Record<string,unknown>,ownRetired=false):boolean {
 const capture=(v:unknown):Record<string,unknown>|undefined=>{
  if(!record(v))return;const proto=Object.getPrototypeOf(v);if(proto!==null&&proto!==Object.prototype)return;
  const out:Record<string,unknown>=Object.create(null);
  for(const key of Reflect.ownKeys(v)){if(typeof key!=='string')return;const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return;out[key]=d.value;}return out;
 };
 const view=capture(value);if(!view)return false;
 for(const key of ['orders','recreation','social','shooting','melee','tactics','mental','health']){
  if(view[key]===undefined||view[key]===null)continue;const nested=capture(view[key]);if(!nested)return false;view[key]=nested;
 }
 const orders=view.orders;if(!record(orders)||!record(view.recreation))return false;
 const queue=orders.queue;if(!Array.isArray(queue))return false;
 const length=Object.getOwnPropertyDescriptor(queue,'length');if(!length||!Object.hasOwn(length,'value')||!integer(length.value))return false;
 // A future Native Job queue is not another ACTIVE task during Ready/Wait1.
 // Ignore only its length in this private validation view. Raw contents/queue
 // remain untouched and require their existing independent admission guards.
 orders.queue=[];
 if(idleOtherActivity300(view as unknown as Pawn))return false;
 const health=view.health;
 return !('idleWander300'in value)&&(ownRetired||!('frameToil301'in value))&&view.state!=='dead'&&view.state!=='downed'&&!(record(health)&&health.death)&&!view.collapsePending;
}
/** local=true means an actual map Pawn at the caller's already validated owner.
 * Held/away/archive actors may retain the Thing counter, never these live jobs. */
export function validFramePawn301(value:unknown,version:number,local=false,ownerCore?:number):boolean {
 try{
  if(!record(value)||!integer(version,1,301)||'frameWork301'in value)return false;
  if('jobTickDelta301'in value&&(version!==301||!integer(data(value,'jobTickDelta301'),0,14)))return false;
  if('frameToil301'in value){
   if(version!==301||!local||'postureUntilCore301'in value)return false;
   const toil=data(value,'frameToil301');if(!record(toil)||!integer(data(toil,'jobId'),1))return false;
   if(data(toil,'kind')==='work'){
    if(!exact(toil,['kind','jobId','ticksLeft'])||!integer(data(toil,'ticksLeft'),-2147483648,5000)||data(value,'jobId')!==data(toil,'jobId'))return false;
   }else if(data(toil,'kind')==='retired'){
    if(!exact(toil,['kind','jobId','atCore'])||!integer(ownerCore)||!integer(data(toil,'atCore'),0,ownerCore)||data(value,'jobId')!==null||data(value,'state')!=='working'||!noOtherActivity(value,true))return false;
    const path=data(value,'path'),length=Array.isArray(path)?Object.getOwnPropertyDescriptor(path,'length'):undefined;
    if(!length||!Object.hasOwn(length,'value')||length.value!==0||data(value,'moveCooldown')!==0)return false;
    const motion=data(value,'motion');if(motion!==undefined&&motion!==null){if(!record(motion))return false;const end=data(motion,'end');if(typeof end!=='number'||!Number.isFinite(end)||end>ownerCore/10)return false;}
   }else return false;
  }
  if('postureUntilCore301'in value){
   const until=data(value,'postureUntilCore301');
   if(version!==301||!local||!integer(ownerCore)||!integer(until,0,ownerCore+1)||!noOtherActivity(value))return false;
   const path=data(value,'path'),length=Array.isArray(path)?Object.getOwnPropertyDescriptor(path,'length'):undefined;
   if(!length||!Object.hasOwn(length,'value')||length.value!==0||data(value,'moveCooldown')!==0)return false;
   const motion=data(value,'motion');if(motion!==undefined&&motion!==null){if(!record(motion))return false;const end=data(motion,'end');if(typeof end!=='number'||!Number.isFinite(end)||end>ownerCore/10)return false;}
   // Expiry may already have passed before the next eligible TickInterval.
  }
  return true;
 }catch{return false;}
}
function validJobs(w:World,version:number):boolean {
 for(const job of w.jobs)if(!validFrameWorkJob301(job,version))return false;return true;
}
function localLink(p:Pawn,w:World):boolean {
 if(!('frameToil301'in p))return true;
 const toil=p.frameToil301!,job=w.jobs.find(j=>j.id===toil.jobId);
 if(toil.kind==='retired')return p.jobId===null&&toil.jobId<w.nextId&&!job;
 return !!job&&Object.hasOwn(job,'frameWork301')&&validFrameWorkJob301(job,Number(w.schemaVersion))&&job.kind==='wall'&&job.material==='wood'&&job.construction==='frame'&&!('furniture'in job)&&!('clearance'in job)&&!('wallDoor296'in job)&&job.status==='active'&&job.reservedBy===p.id&&p.jobId===job.id;
}
/** Reuse the existing owner capture; no new identity/ownership census. */
export function validFrameOwners301(w:World,version:number,readOwners:()=>HumanOwnershipCapture):boolean {
 try{
  if(!integer(version,1,301)||!validJobs(w,version))return false;
  const core=effectiveCore297(w);
  for(const slot of readOwners().pawnOwners)if(slot.pawn&&(!validFramePawn301(slot.pawn,version,slot.kind==='map',slot.kind==='map'?core:undefined)||slot.kind==='map'&&(!w.pawns.includes(slot.pawn)||!localLink(slot.pawn,w))))return false;
  for(const row of(w.campaignMap?.revision===2?w.campaignMap.groups:[]))if('members'in row.state)for(const p of row.state.members)if(!validFramePawn301(p,version))return false;
  for(const loss of(w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!validFramePawn301(loss.pawn,version))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!validFramePawn301(row.actor,version))return false;
  for(const row of w.worldFactions?.leaders??[])if(!validFramePawn301(row.pawn,version))return false;
  return true;
 }catch{return false;}
}
/** Narrow MAIN pass over original already guarded holder containers. */
export function validFrameProjection301(w:World,version:number):boolean {
 try{
  if(!integer(version,1,301)||!validJobs(w,version))return false;
  const away=(p:unknown)=>validFramePawn301(p,version);
  const building=(s:Pick<World['structures'][number],'cryptosleep'|'shipCryptosleep277'|'casket'>):boolean=>{
   if(s.cryptosleep?.human&&!away(s.cryptosleep.human))return false;
   if(s.shipCryptosleep277?.occupant?.kind==='human'&&!away(s.shipCryptosleep277.occupant.pawn))return false;
   if(s.casket)for(const p of s.casket.humans)if(!away(p))return false;return true;
  };
  const group=(g:NonNullable<World['group']>):boolean=>!('members'in g)||g.members.every(away);
  const core=effectiveCore297(w);
  for(const p of w.pawns)if(!validFramePawn301(p,version,true,core)||!localLink(p,w))return false;
  for(const s of w.structures)if(!building(s))return false;
  for(const p of w.packed)if(!building(p.building))return false;
  if(w.startingArrival&&w.startingArrival.phase!=='opened')for(const p of w.startingArrival.pods)if(!away(p.pawn))return false;
  if(w.scout&&'pawn'in w.scout&&!away(w.scout.pawn))return false;
  if(w.commercialTrip&&'pawn'in w.commercialTrip&&!away(w.commercialTrip.pawn))return false;
  if(w.group&&!group(w.group))return false;
  for(const l of w.groupLosses??[])if(!away(l.pawn))return false;
  for(const d of w.visitors?.departed??[])if(!away(d.pawn))return false;
  for(const d of w.podRescues?.departed??[])if(!away(d.pawn))return false;
  for(const row of(w.campaignMap?.revision===2?w.campaignMap.groups:[]))if(!group(row.state))return false;
  for(const l of(w.campaignMap?.revision===2?w.campaignMap.groupLosses:[]))if(!away(l.pawn))return false;
  for(const row of w.worldPawns?.owners??[])if(row.kind==='human'&&!away(row.actor))return false;
  for(const h of w.worldPawns?.heldCaskets259??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldPlayerCaskets271??[])if(!building(h.casket))return false;
  for(const h of w.worldPawns?.heldShipCaskets277??[])if(!building(h.casket))return false;
  for(const l of w.worldFactions?.leaders??[])if(!away(l.pawn))return false;
  return true;
 }catch{return false;}
}

