import {isConduitKind} from './conduit-kinds-382.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import {validCapturedCoreMove297} from './core-move-save-297.ts';
import { isColonist } from './affiliation.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import { autoSlaughterTargets,slaughterIntent } from './auto-slaughter.ts';
import { animalCarrier,animalClaimed,animalSpotClaimed } from './animal-rest-state.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { workPriority } from './work-types.ts';
import { footprintCells } from './definitions.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { isConstruction } from './construction-rules.ts';
import { veterinaryCareSpeciesAllowed } from './veterinary-rules.ts';
import { MIN_PAWN_SPEED_V87 } from './travel-validation.ts';
import { validCapturedTravelDelay } from './captured-travel-delay.ts';
import { travelEnd,validSlowIntervals,validStunIntervals } from './travel-timing.ts';
import { blockedCells,canStep } from './pathfinding.ts';
import type { Pawn,Structure,World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { TravelSegment } from './travel-timing.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=1&&Number(v)<=max;
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const same=(a:{x:number;z:number},b:{x:number;z:number})=>a.x===b.x&&a.z===b.z;
export function sameAnimalCarrierEdge(a:TravelSegment|undefined,b:TravelSegment|null|undefined):boolean {
  return !a||!b?!a&&!b:a.start===b.start&&a.end===b.end&&a.terrainDelay===b.terrainDelay&&a.speedFactor===b.speedFactor&&a.coreMove297===b.coreMove297&&a.coreMoveWalk297===b.coreMoveWalk297
    &&same(a.from,b.from)&&same(a.to,b.to)
    &&(a.stagger?.length??0)===(b.stagger?.length??0)&&(!a.stagger||a.stagger.every((s,i)=>s.start===b.stagger![i].start&&s.end===b.stagger![i].end))
    &&(a.stuns?.length??0)===(b.stuns?.length??0)&&(!a.stuns||a.stuns.every((s,i)=>s.start===b.stuns![i].start&&s.end===b.stuns![i].end));
}
export function validAnimalRescueShape(v:unknown,version:number):boolean {
  return version>=221&&object(v)&&keys(v,['animalId','spotId','phase'],version>=223?['forced']:[])
    &&(!Object.hasOwn(v,'forced')||v.forced===true)&&id(v.animalId)&&id(v.spotId)&&(v.phase==='approach'||v.phase==='carry');
}
/** A released patient retains the admitted human segment without a synthetic
 * provenance flag. The owned-animal envelope also covers recovery before the
 * edge ends. Spatial277 admits a wild patient on the same strict human edge,
 * with no autonomous route/activity state; every cost/interval stays strict. */
export function validAnimalCarrierMotion(w:World,a:WildAnimal,version:number):boolean {
  const m=a.motion;
  const spatialPatient=isSchema277OrLater(version)&&a.path.length===0&&['idle','downed','dead'].includes(a.state)
    &&!a.meal&&!a.predation&&!a.mating&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.animalRest;
  if(version<221||!a.domestic&&!spatialPatient||!m||!object(m)||!keys(m,['from','to','start','end'],['speedFactor','terrainDelay','stagger','stuns',...(version>=239?['snowEntryPending']:[]),...(isCorePhysicalSchema297(version)?['coreMove297','coreMoveWalk297']:[])]))return false;
  const cell=(v:unknown):v is {x:number;z:number}=>object(v)&&keys(v,['x','z'])&&Number.isSafeInteger(v.x)&&Number(v.x)>=0&&Number(v.x)<w.width&&Number.isSafeInteger(v.z)&&Number(v.z)>=0&&Number(v.z)<w.height;
  if(!cell(m.from)||!cell(m.to)||!same(a,m.to)||!Number.isFinite(m.start)||m.start<0||m.start>effectiveLocal297(w)||!Number.isFinite(m.end)||m.end<=m.start
    ||Math.max(Math.abs(m.from.x-m.to.x),Math.abs(m.from.z-m.to.z))!==1
    ||m.speedFactor!==undefined&&(!Number.isFinite(m.speedFactor)||m.speedFactor<MIN_PAWN_SPEED_V87||m.speedFactor>1)
    ||!validCapturedCoreMove297(m,version)||!validCapturedTravelDelay(m.terrainDelay,version)||!validSlowIntervals(m.stagger,version,m.start,w.tick,isCorePhysicalSchema297(version)?effectiveCore297(w):undefined)||!validStunIntervals(m.stuns,version,m.start,w.tick,isCorePhysicalSchema297(version)?effectiveCore297(w):undefined)
    ||Math.abs(m.end-travelEnd(m))>1e-7)return false;
  const carrier=animalCarrier(w,a.id);
  if(carrier&&!sameAnimalCarrierEdge(m,carrier.motion))return false;
  if(m.end>effectiveLocal297(w)){
    if(!['moving','idle','downed','dead'].includes(a.state))return false;
    const blocked=blockedCells(w,true);
    if(blocked[m.from.z*w.width+m.from.x]||!canStep(w,m.from,m.to,blocked,new Set()))return false;
  }
  return true;
}
const aliveOwned=(a:WildAnimal,version:number)=>!!a.domestic&&veterinaryCareSpeciesAllowed(a.species,version,a)&&a.state!=='dead'&&!a.health?.death;
function validSpot(w:World,s:Structure,version:number):boolean {
  return version>=221&&keys(s as unknown as Record<string,unknown>,['id','kind','x','z','orientation','footprint'],['medical'])
    &&id(s.id,w.nextId-1)&&Number.isSafeInteger(s.x)&&s.x>=0&&s.x<w.width&&Number.isSafeInteger(s.z)&&s.z>=0&&s.z<w.height
    &&s.orientation===0&&s.footprint==='standard'&&(!Object.hasOwn(s,'medical')||s.medical===true)
    &&!['rock','water'].includes(w.tiles[s.z*w.width+s.x]!.terrain)&&!w.resources.some(r=>same(r,s)&&r.kind==='rock')
    &&!w.structures.some(other=>other!==s&&!isConduitKind(other.kind)&&(version<382||sharesConstructionLayer(other.kind,s.kind,version,other.orientation,s.orientation))&&footprintCells(other).some(c=>same(c,s)))
    &&!w.jobs.some(j=>isConstruction(j)&&sharesConstructionLayer(j.furniture?.kind??j.kind,s.kind,version,j.orientation,s.orientation)&&footprintCells(j).some(c=>same(c,s)));
}
function actorExclusive(w:World,p:Pawn):boolean {
  return isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.draft&&!p.mental?.crisis&&!p.flee&&!p.burning
    &&!p.interruptedCargo&&!medicalWorkRefusal(p)&&pawnBody(p).capacities.moving>0&&workPriority(p,'doctor')>0
    &&!p.need&&!p.haul&&!p.cooking&&!p.hunting&&!p.research&&!p.ward&&!p.feed&&!p.tend&&!p.surgery&&!p.rescue
    &&!p.equipmentTask&&!p.burial&&!p.cleaning&&!p.firefighting&&p.jobId===null&&!p.melee&&!p.shooting?.order&&!p.tactics
    &&!p.trade&&!p.orbitalTrade&&!p.deepWork&&!p.recreation.task&&!p.animalCare&&!p.animalFeed&&!p.animalHandling
    &&p.orders.active===null&&!p.orders.queue.length&&!p.priorityWork&&['moving','idle'].includes(p.state)
    &&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
}
/** Normative file/Decoder admission. Threats and hunger may change before the
 * ordinary reconciliation; only durable shape, owners and physical bindings
 * are validated here. No decisions, RNG, repair or full validateWorld call. */
export function validateAnimalRest(w:World,version:number):string[] {
  if(Object.hasOwn(w,'packed')&&!Array.isArray(w.packed))return ['Malformed animal rest furniture container.'];
  const errors:string[]=[],assignments=new Set<number>(),patients=new Set<number>(),spots=new Set<number>();
  const slaughterTargets=autoSlaughterTargets(w,version);
  for(const s of w.structures)if(s.kind==='animal-sleeping-spot'&&!validSpot(w,s,version))errors.push('Invalid or future animal sleeping spot.');
  if(w.jobs.some(j=>j.kind==='animal-sleeping-spot'||j.furniture?.kind==='animal-sleeping-spot'||j.deconstruction?.kind==='animal-sleeping-spot')
    ||(w.packed??[]).some(p=>p.building.kind==='animal-sleeping-spot'))errors.push('Animal sleeping spot cannot be a job or packed furniture.');
  for(const a of w.wildlife?.animals??[]){
    if(a.domestic&&Object.hasOwn(a.domestic,'bedId')){
      const target=w.structures.find(s=>s.id===a.domestic!.bedId);
      if(version<221||!id(a.domestic.bedId,w.nextId-1)||!aliveOwned(a,version)||!target||target.kind!=='animal-sleeping-spot'||target.medical||assignments.has(target.id))errors.push('Invalid or duplicate normal animal sleeping assignment.');
      if(target)assignments.add(target.id);
    }
    if(!Object.hasOwn(a,'animalRest'))continue;
    const t:unknown=a.animalRest;
    if(version<221||!object(t)||!keys(t,['spotId','phase'])||!id(t.spotId,w.nextId-1)||!['travel','sleep'].includes(String(t.phase))){errors.push('Invalid or future animal rest task.');continue;}
    const spot=w.structures.find(s=>s.id===t.spotId);
    if(!aliveOwned(a,version)||slaughterIntent(w,a,version,slaughterTargets)||!spot||spot.kind!=='animal-sleeping-spot'
      ||a.meal||a.mating||a.exiting||(spot.medical?a.domestic?.care==='none':a.domestic?.bedId!==t.spotId))errors.push('Invalid animal rest ownership.');
    if(!spot)continue;
    if(spots.has(spot.id))errors.push('Animal sleeping place occupied twice.');spots.add(spot.id);
    if(t.phase==='sleep'?!same(a,spot)||a.path.length||(a.motion?.end??0)>w.tick||!['sleeping','downed'].includes(a.state)
      :a.state!=='moving'||!a.path.length&&((a.motion?.end??0)<=w.tick||!same(a,spot))||a.path.length&&!same(a.path.at(-1)!,spot))errors.push('Invalid animal rest position or route.');
  }
  for(const p of w.pawns){
    if(!Object.hasOwn(p,'animalRescue'))continue;
    const t=p.animalRescue;
    if(!validAnimalRescueShape(t,version)){errors.push('Invalid or future animal rescue task.');continue;}
    const a=w.wildlife?.animals.find(a=>a.id===t!.animalId),spot=w.structures.find(s=>s.id===t!.spotId);
    if(!actorExclusive(w,p)||!a||!aliveOwned(a,version)||a.state!=='downed'||a.domestic!.slaughter||a.animalRest||!spot||spot.kind!=='animal-sleeping-spot'
      ||spot.medical&&a.domestic!.care==='none'||!spot.medical&&a.domestic!.bedId!==spot.id
      ||patients.has(t!.animalId)||spots.has(t!.spotId)||animalClaimed(w,t!.animalId,p.id)||animalSpotClaimed(w,t!.spotId,a?.id,p.id))errors.push('Invalid or duplicate animal rescue owner.');
    patients.add(t!.animalId);spots.add(t!.spotId);
    if(t!.phase==='carry'&&a){
      if(!same(a,p)||!sameAnimalCarrierEdge(a.motion,p.motion)||a.motion&&!validAnimalCarrierMotion(w,a,version)||a.path.length||a.meal||a.mating)errors.push('Carried animal does not share the exclusive carrier edge.');
      if(p.path.length&&spot&&!same(p.path.at(-1)!,spot))errors.push('Animal rescue carry route misses its destination.');
    }
  }
  return errors;
}
export function validAnimalRestTransport(w:World,version:number):boolean {
  try{return validateAnimalRest(w,version).length===0;}catch{return false;}
}
