import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {advanceGroupAlcohol265} from './alcohol-caravan-265.ts';
import {groupMixedNeedOrder256} from './group-mixed-pawns-256.ts';
import {satisfyCaravanAnimalFood256} from './group-animal-food-256.ts';
import {groupAnimalEnvironment256} from './group-animal-runtime-256.ts';
import type {World,Pawn} from './types.ts';
import type {MedicalContext} from './injury-types.ts';
import type {GroupForageOwner256,GroupForageContext256} from './group-forage-256.ts';
import {advanceGroupForage256} from './group-forage-256.ts';
import {recalculateGroupCarried256} from './group-caravan-carry-256.ts';
import {recalculateGroupBeds256,GroupComfortMarks256,type GroupBedUse256} from './group-caravan-beds-256.ts';
import {ingestGroupFood256} from './group-foraged-ingestion-256.ts';
import {groupHumanNeedOrder256} from './group-human-needs-order-256.ts';
import {advanceGroupJoy} from './group-joy.ts';
import {advanceGroupCare} from './group-care.ts';
import {GroupRestMarks256} from './group-need-meters-256.ts';
export type GroupTravelMedical256=Pick<MedicalContext,'posture'|'restingBonus'|'bedHealPerDay'|'bedImmunityFactor'>;
interface PhysicalService {carried:ReadonlySet<number>;beds:ReadonlyMap<number,GroupBedUse256>}
/** Derived services only. MotionRuntime remains the single owner of cadence,
 * tickDelta and tweener. This object has no clock and persists no duplicate. */
export class GroupCaravanPhysical256 {
 private readonly services=new Map<number,PhysicalService>();
 readonly comfortMarks=new GroupComfortMarks256();
 clear():void {this.services.clear();this.comfortMarks.clear();}
 remove(groupId:number,members:readonly Pawn[]=[]):void {this.services.delete(groupId);for(const p of members)this.comfortMarks.remove(p.id);}
 needComfort(g:GroupForageOwner256,coreTick:number):void {for(const p of g.members)this.comfortMarks.needAt(p,coreTick);}
 rebuild(g:GroupForageOwner256):void {const moving=this.moving(g),carried=recalculateGroupCarried256(g,moving);this.services.set(g.id,{carried,beds:recalculateGroupBeds256(g,moving,carried)});}
 private moving(g:GroupForageOwner256):boolean{return g.phase==='travelling'&&!g.paused&&g.stop===null;}
 clinicalRestFor(g:GroupForageOwner256,p:Pawn):GroupTravelMedical256 {
  if(!g.members.includes(p))throw Error('Clinical patient is not this actual caravan member');
  const service=this.services.get(g.id);if(!service)throw Error('Caravan physical services must be bootstrapped');
  const bed=service.beds.get(p.id),actual=bed&&(g.packed??[]).includes(bed.pack);
  if(actual)return {posture:'bed',restingBonus:p.state!=='downed',bedHealPerDay:bed.healPerDay,bedImmunityFactor:bed.immunityFactor};
  const resting=!this.moving(g)||service.carried.has(p.id);return {posture:resting?'ground':'standing',restingBonus:resting&&p.state!=='downed'};
 }
 /** Called exactly by MotionRuntime.afterTween. Forage sees the previous carry
  * service; carry/beds are then recomputed before per-Pawn food/joy and care. */
 afterTween(w:World,g:GroupForageOwner256,coreTick:number,deltaCore:number,c:Omit<GroupForageContext256,'coreTick'|'deltaCore'|'movingNow'|'carriedBefore'>&{restMarks:GroupRestMarks256;notice(pawn:Pawn,message:string):void}):void {
  if(w.group!==g||g.lastPersonalTick!==w.tick)throw Error('Invalid caravan interval owner');let prior=this.services.get(g.id);if(!prior){this.rebuild(g);prior=this.services.get(g.id)!;}
  const moving=this.moving(g);advanceGroupForage256(w,g,{...c,coreTick,deltaCore,movingNow:moving,carriedBefore:prior.carried});
  const carried=recalculateGroupCarried256(g,moving),beds=recalculateGroupBeds256(g,moving,carried);this.services.set(g.id,{carried,beds});
  for(const [id,bed] of beds){const p=g.members.find(p=>p.id===id)!;this.comfortMarks.used(p,bed,coreTick,deltaCore);}
  for(const p of groupMixedNeedOrder256(g)){if(p.state==='dead'||p.health?.death)continue;if('species'in p){if(p.ageTicks===0)continue;if(!moving||carried.has(p.id))c.restMarks.mark(p,coreTick,.8);satisfyCaravanAnimalFood256(w,g,p,{...groupAnimalEnvironment256(w,g,coreTick),random:c.random});continue;}const bed=beds.get(p.id);if(!moving||carried.has(p.id)||bed)c.restMarks.mark(p,coreTick,bed?.restEffectiveness??.8);
   ingestGroupFood256(w,g,p,isSchema299OrLater(Number(w.schemaVersion))?{...c,coreAt299:coreTick}:c);advanceGroupAlcohol265(g,{tick:w.tick,schemaVersion:w.schemaVersion,drugPolicies:w.drugPolicies,resting:!moving,core256:{tick:coreTick,delta:deltaCore},onlyPerson256:p,random:c.random,notice:c.notice});advanceGroupJoy(g,{tick:w.tick,stationary:!moving,core256:{tick:coreTick,delta:deltaCore},onlyPerson256:p,random:c.random});}
  advanceGroupCare(g,{tick:w.tick,core256:{tick:coreTick,delta:deltaCore},random:c.random});
 }
}
