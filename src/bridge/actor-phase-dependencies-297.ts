import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import type {World,Pawn,Job,MaterialPile,Structure} from '../sim/types';
import {appearanceOf} from '../sim/pawn-appearance';
import {appearanceShape} from '../render/pawn-appearance-shape';
import {humanLimbVisualMask} from '../render/human-anatomy-presentation';
import {bodyBloodWord} from '../render/body-blood-word-297';
import {corpseVisualMask} from '../render/corpse-presentation';
import {WildlifeBodyScale} from '../render/wildlife-frame-state';
import {wildlifePresentationGroups} from '../render/wildlife-presentation-groups';
import {treeCargoKind} from '../render/tree-presentation';
import {pasteCollectionSource,pawnWorkPose,workApproach,meleeApproach,WORK_POSE} from '../render/work-presentation';
import {constructionWorkTarget} from '../sim/construction-rules';
import {footprintCells} from '../sim/definitions';
import {firePosition} from '../sim/fire-rules';
import {anestheticStage} from '../sim/anesthetic';
import {medicallyStopped} from '../sim/health-rules';
import {mechanoidVisualMask} from '../sim/mechanoid-presentation';
import {corpsePartAbsent} from '../sim/corpse-anatomy';
import {corpseStage,CORPSE_ROT_TICKS,CORPSE_DESSICATION_TICKS} from '../sim/corpses';
import {humanCorpseAge} from '../sim/human-corpses';
import {coupleBed285} from '../sim/couple-bed-285';
import {pawnBedSlot,bedSlotBodyCenter} from '../sim/bed-slots';
import {adjacentTable} from '../sim/dining';
import {groupHumanCarryPairs257} from '../sim/group-human-admission-257';
import {autoSlaughterTargets} from '../sim/auto-slaughter';
import {isColonist} from '../sim/affiliation';
import {frozenDataCopy297} from './core-frozen-copy-297';

export const POSE_SLEEP=18,POSE_DEAD=19,POSE_FIGHT_READY=22,READING_ACTIVITY295=14;
export function seatedOnFurniture(pawn:Pawn):boolean {
  if(pawn.state==='eating')return pawn.need?.kind==='eat'&&typeof pawn.need.dining?.seatId==='number';
  if(pawn.state!=='recreating')return false;
  const task=pawn.recreation.task;
  return !!task&&(task.activity==='read'||task.activity==='watch-television'||task.activity==='chess'||task.activity==='social-relax'||task.activity==='visit-sick')&&typeof task.seatId==='number';
}

export function workActivity(pawn:Pawn):number {
  if(pawn.state!=='working'||pawn.stun)return 0;
  if(pawn.cooking?.recipe==='make-plate-armor'||pawn.cooking?.recipe==='make-simple-helmet')return 1;
  return pawn.cooking?2:pawn.research||pawn.deepWork||pawn.cryptosleepTask?3:1;
}

export function animationPose(pawn:Pawn,workPose:number,smallMelee:boolean,seated:boolean,lyingAwake=false):number {
  if(pawn.state==='dead')return POSE_DEAD;
  if(pawn.state==='sleeping'||pawn.medicalSleep||anestheticStage(pawn.health?.anesthetic?.severity??0)==='sedated')return POSE_SLEEP;
  if(lyingAwake)return 1;
  if(pawn.health?.foodPoisoning?.vomit||pawn.health?.flu?.vomit||pawn.health?.immuneDiseases?.malaria?.vomit)return 10;
  if(pawn.stun&&!medicallyStopped(pawn))return 9;
  if(pawn.melee?.strike)return smallMelee?WORK_POSE.groundMelee:8;
  if(pawn.shooting?.stance?.phase==='cooldown')return 15;
  if(pawn.shooting?.stance)return 7;
  if(pawn.social?.fight&&!medicallyStopped(pawn))return POSE_FIGHT_READY;
  if(pawn.state==='recreating'){
    const activity=pawn.recreation.task?.activity;
    if(activity==='horseshoes')return 4;
    if(activity==='skygaze')return 5;
    if(activity==='party')return 0;
    if(activity==='read'||activity==='watch-television'||activity==='chess'||activity==='social-relax'||activity==='visit-sick')return seated?3:0;
  }
  if(pawn.state==='resting'||medicallyStopped(pawn))return 1;
  if(pasteCollectionSource(pawn))return 0;
  if(pawn.state==='eating')return seated?3:2;
  return workPose;
}

export function humanCorpseVisualStage(world:World,pawn:Pawn,body?:MaterialPile):0|1|2 {
  if(pawn.state!=='dead')return 0;
  const pile=body??(pawn.body?.pileId!==undefined?world.piles.find(p=>p.id===pawn.body?.pileId):undefined);
  if(pile){const stage=corpseStage(pile,world.tick);return stage==='desiccated'?2:stage==='rotting'?1:0;}
  const age=humanCorpseAge(world,pawn);
  return age>=CORPSE_DESSICATION_TICKS?2:age>=CORPSE_ROT_TICKS?1:0;
}

/** Exact pure statements moved from PawnLayer; no new contact formula. */
export function humanWorkContact297(world:World,pawn:Pawn,pawnsById:ReadonlyMap<number,Pawn>,initialJobs:Map<number,Job>|undefined,initialYaw:number) {
 let jobsById=initialJobs,yaw=initialYaw;
      const arriving=pawn.state==='moving'&&pawn.moveCooldown>0&&pawn.path.length===0&&!!pawn.motion&&pawn.motion.to.x===pawn.x&&pawn.motion.to.z===pawn.z;
      const job=pawn.jobId===null?undefined:(jobsById??=new Map(world.jobs.map(j=>[j.id,j]))).get(pawn.jobId);
      const garment=pawn.equipmentTask?.action==='wear'?world.piles.find(p=>p.id===pawn.equipmentTask!.itemId):undefined;
      const dressing=garment?.owner.type==='ground'?garment.owner:undefined;
      const fighting=pawn.firefighting?world.fires?.items.find(f=>f.id===pawn.firefighting!.fireId):undefined;
      const fireTarget=fighting?firePosition(world,fighting):undefined;
      const fuelDestination=pawn.haul?.destination.type==='fuel'||pawn.haul?.destination.type==='turret'?pawn.haul.destination:undefined;
      const orbitalReady=pawn.orbitalTrade?.phase==='ready'&&!pawn.stun;
      const pasteCollect=pasteCollectionSource(pawn);
      const station=pawn.cryptosleepTask&&(pawn.state==='working'||arriving)?world.structures.find(s=>s.id===pawn.cryptosleepTask!.casketId):pasteCollect?world.structures.find(s=>s.id===pasteCollect.dispenserId):orbitalReady||arriving&&pawn.orbitalTrade ? world.structures.find(s=>s.id===pawn.orbitalTrade!.consoleId) : pawn.state==='working'||arriving ? pawn.deepWork ? world.structures.find(s=>s.id===pawn.deepWork!.structureId) : pawn.research ? world.structures.find(s=>s.id===pawn.research!.stationId) : pawn.cooking?.phase==='work' ? world.structures.find(s=>s.id===pawn.cooking!.stationId) : pawn.haul?.serviceProgress!==undefined&&fuelDestination ? world.structures.find(s=>s.id===fuelDestination.structureId) : undefined : undefined;
      const workPose=pawnWorkPose(pawn,job,station?.kind);
      const stationCell=station ? footprintCells(station).reduce((best,cell)=>Math.hypot(cell.x-pawn.x,cell.z-pawn.z)<Math.hypot(best.x-pawn.x,best.z-pawn.z)?cell:best) : undefined;
      const patient=pawn.feed?.phase==='feed'?pawnsById.get(pawn.feed.patientId):pawn.tend?.phase==='tend'?pawnsById.get(pawn.tend.patientId):pawn.surgery?.phase==='work'?pawnsById.get(pawn.surgery.patientId):undefined;
      const handledAnimal=pawn.animalFeed?.phase==='feed'?world.wildlife?.animals.find(a=>a.id===pawn.animalFeed!.animalId)
        :pawn.animalCare?.phase==='treat'?world.wildlife?.animals.find(a=>a.id===pawn.animalCare!.animalId)
        :pawn.animalHandling?.phase==='interact'?world.wildlife?.animals.find(a=>a.id===pawn.animalHandling!.animalId):undefined;
      const work = pawn.state==='working'||arriving ? fireTarget ?? (job?constructionWorkTarget(world,job):dressing) ?? (pawn.hunting?.phase==='finish' ? world.wildlife?.animals.find(a=>a.id===pawn.hunting!.animalId) : patient ?? handledAnimal ?? stationCell ?? pawn.cooking?.actionCell ?? pawn.haul?.pickupCell) : undefined;
      if(work&&pawn.state==='working') yaw=Math.atan2(work.x-pawn.x,work.z-pawn.z);
      if(orbitalReady&&stationCell)yaw=Math.atan2(stationCell.x-pawn.x,stationCell.z-pawn.z);
      if(pasteCollect&&stationCell)yaw=Math.atan2(stationCell.x-pawn.x,stationCell.z-pawn.z);
      const contactPose=arriving?pawnWorkPose({...pawn,state:'working'},job,station?.kind):workPose;
      const atBench=station?.kind==='fueled-smithy'||station?.kind==='electric-smithy'||station?.kind==='electric-crematorium'||station?.kind==='electric-smelter'||station?.kind==='biofuel-refinery'||station?.kind==='deep-drill'||station?.kind==='ground-scanner'||station?.kind==='drug-lab'||station?.kind==='research-bench'||station?.kind==='hi-tech-research-bench'||station?.kind==='fabrication-bench'||station?.kind==='butcher-table'||station?.kind==='machining-table'||station?.kind==='stonecutter'||station?.kind==='art-bench'||station?.kind==='tailor-bench'||station?.kind==='electric-tailor-bench'||station?.kind==='electric-stove'||station?.kind==='fueled-stove';
      const clearance=job?.kind==='mine' ? .9 : atBench ? .88 : .82;
      const pair=pawn.social?.fight?pawnsById.get(pawn.social.fight.opponentId):undefined;
      const socialOpponent=pair?.social?.fight?.opponentId===pawn.id&&!medicallyStopped(pair)?pair:undefined;
      const humanOpponent=pawn.melee?.order&&!pawn.melee.order.structure?pawnsById.get(pawn.melee.order.targetId):socialOpponent;
      const fightContact=humanOpponent&&humanOpponent.state!=='dead'&&!medicallyStopped(pawn)&&(pawn.state!=='moving'||arriving)
        ? meleeApproach(pawn,humanOpponent):undefined;
      const reach=fightContact&&(fightContact.x!==0||fightContact.z!==0)?fightContact
        :contactPose!==WORK_POSE.ground&&contactPose!==0&&!station?.kind.includes('spot') ? workApproach(pawn,work,clearance) : {x:0,z:0};

 return {arriving,workPose,contactPose,reach,humanOpponent,pasteCollect,yaw,jobsById};
}

/** Owned comparable data only; no value or predicate confers Native authority. */
export interface ActorPhaseDependencies297 {readonly format:'actor-phase-dependencies-297-1';readonly data:unknown}
const ownedDependencies297=new WeakSet<object>();
function cell(value:{x:number;z:number}|null|undefined){return value?[value.x,value.z]:null;}
function structure(value:Structure|undefined){return value?[value.id,value.kind,value.x,value.z,value.orientation,value.footprint,value.medical,value.prisoner]:null;}
function owner(value:MaterialPile['owner']){return {...value};}
function cargo(p:MaterialPile|undefined){
 if(!p)return null;
 return [p.id,p.item,p.kind,p.quantity,owner(p.owner),p.item==='minified-tree'?treeCargoKind(p.innerResource):undefined,
  p.corpse?[p.corpse.animalId,p.corpse.species,corpseVisualMask(p.corpse)]:undefined,
  p.humanCorpse?.pawnId,p.mechCorpse?[p.mechCorpse.mechKind,p.mechCorpse.heading,mechanoidVisualMask(p.mechCorpse)]:undefined];
}
/** After the ENTIRE macro suffix, plus actual prepareFull seeding. No BFS/RNG,
 * no Pawn/World/clinical record escapes; no clock or UI work counter is signed. */
export function captureActorPhaseDependencies297(world:World):ActorPhaseDependencies297 {
 if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw Error('Dependency capture requires actual schema297');
 const pawnsById=new Map(world.pawns.map(p=>[p.id,p])),jobs=new Map(world.jobs.map(j=>[j.id,j]));
 const bodies=new Map<number,MaterialPile>(),carried=new Map<number,MaterialPile>(),gear=new Map<number,string>(),apparel=new Map<number,unknown[]>();
 for(const pile of world.piles){
  if(pile.humanCorpse)bodies.set(pile.humanCorpse.pawnId,pile);
  if(pile.owner.type==='pawn')carried.set(pile.owner.pawnId,pile);
  if(pile.owner.type==='equipment')gear.set(pile.owner.pawnId,pile.item);
  if(pile.owner.type==='apparel'){const list=apparel.get(pile.owner.pawnId)??[];list.push([pile.item,pile.apparel?.birthColor]);apparel.set(pile.owner.pawnId,list);}
 }
 const packed=new Set((world.packed??[]).flatMap(p=>p.owner.type==='pawn'?[p.owner.pawnId]:[]));
 const scale=new WildlifeBodyScale(),quotas=autoSlaughterTargets(world);
 const human=world.pawns.map(p=>{
  const contact=humanWorkContact297(world,p,pawnsById,jobs,0),couple=coupleBed285(world,p),sleepId=p.need?.kind==='sleep'?p.need.bedId:null;
  const bed=couple??((p.state==='sleeping'||p.state==='resting'||p.state==='downed')&&sleepId!==null?world.structures.find(s=>s.id===sleepId):undefined);
  const slot=bed?pawnBedSlot(p,bed):undefined,seated=seatedOnFurniture(p),small=!!p.melee?.strike&&!!world.wildlife?.animals.some(a=>a.id===p.melee!.strike!.targetId&&a.species==='hare');
  const recreation=p.recreation.task,paste=pasteCollectionSource(p),identity=appearanceOf(p,world.seed),body=bodies.get(p.id),visitor=world.visitors?.groups.find(g=>g.id===p.visitor?.group);
  const dining=p.state==='eating'&&p.need?.kind==='eat'&&p.need.dining?adjacentTable(world,p):null;
  const leisure=recreation&&recreation.buildingId!==null?world.structures.find(s=>s.id===recreation.buildingId):undefined;
  const patient=recreation?.activity==='visit-sick'?pawnsById.get(recreation.patientId!):undefined;
  return [p.id,identity,appearanceShape(identity),apparel.get(p.id)??[],gear.get(p.id),isColonist(p),p.visitor?!!visitor?.hostile:undefined,
   humanLimbVisualMask(p),bodyBloodWord(p.health),humanCorpseVisualStage(world,p,body),
   [p.body?.pileId,p.body?.lostAt,body?owner(body.owner):undefined],
   [contact.workPose,contact.contactPose,contact.reach.x,contact.reach.z,contact.yaw],
   [animationPose(p,contact.workPose,small,seated,!!couple),workActivity(p),seated],
   [structure(bed),slot,bed?.kind==='double-bed'&&slot!==undefined?cell(bedSlotBodyCenter(bed,slot)):undefined,!!couple],
   dining?[dining.id,cell(dining.cell),p.need?.kind==='eat'?p.need.dining?.seatId:undefined]:null,
   recreation?[recreation.activity,recreation.activity==='read'?recreation.stage:undefined,recreation.phase,recreation.seatId,recreation.buildingId,recreation.patientId,structure(leisure),cell(patient)]:null,
   paste?[paste.dispenserId,cell(paste.spot)]:null,
   cargo(carried.get(p.id)),packed.has(p.id),
   p.rescue?[p.rescue.phase,p.rescue.patientId]:null,p.animalRescue?[p.animalRescue.phase,p.animalRescue.animalId]:null,
   p.cryptosleepTask?[p.cryptosleepTask.action,p.cryptosleepTask.phase,p.cryptosleepTask.patientId]:null,
   p.raid?.kidnap261?[p.raid.kidnap261.phase,p.raid.kidnap261.patientId]:null,
   (world.fires?.items??[]).filter(f=>f.attachedPawnId===p.id).map(f=>[f.id,f.size])];
 });
 const animalGroups=[...wildlifePresentationGroups(world)].map(([species,rows])=>[species,rows.map(a=>{
  const corpse=a.corpsePile?.corpse,medical=corpse?.health??a.health;
  const blood=corpse?bodyBloodWord(corpse.health,part=>corpsePartAbsent(corpse,part)):bodyBloodWord(medical);
  const mask=corpse?corpseVisualMask(corpse):a.health?corpseVisualMask({animalId:a.id,species:a.species,sex:a.sex,ageTicks:a.ageTicks,health:a.health}):0;
  const meal=a.meal,target=meal?.kind==='plant'?world.resources.find(r=>r.id===meal.id):meal?world.piles.find(p=>p.id===meal.id)?.owner:undefined;
  const doorId=a.manhunter?.door?.targetId,door=doorId===undefined?undefined:world.structures.find(s=>s.id===doorId);
  return [a.id,a.species,scale.read(corpse??a),blood,mask,a.domestic?.slaughter===true,quotas.has(a.id),
   meal?[meal.kind,meal.id,target&&'x' in target?cell(target):null]:null,structure(door),a.carrierId,
   a.corpsePile?[a.corpsePile.id,owner(a.corpsePile.owner),corpse?.facing]:null,
   (world.fires?.items??[]).filter(f=>f.attachedAnimalId===a.id).map(f=>[f.id,f.size])];
 })]);
 const animalCargo=(world.wildlife?.animals??[]).flatMap(a=>{
  const t=a.haul;if(!a.domestic||a.state==='dead'||!t||t.phase==='pickup'||t.carryPileId===null)return [];
  const pile=world.piles.find(p=>p.id===t.carryPileId&&p.owner.type==='inventory'&&p.owner.pawnId===a.id&&p.quantity>0);
  return pile?[[a.id,a.species,a.state,scale.read(a),cargo(pile)]]:[];
 });
 const mechanical=(world.mechanoids??[]).map(a=>[a.id,a.mechKind,mechanoidVisualMask(a)]);
 const mechanicalBodies=world.piles.filter(p=>p.mechCorpse&&(p.owner.type==='ground'||p.owner.type==='pawn')).map(p=>[p.id,owner(p.owner),p.mechCorpse!.mechKind,p.mechCorpse!.heading,mechanoidVisualMask(p.mechCorpse!)]);
 const departed=(world.raids?.departed??[]).map(a=>[a.pawnId,cell(a.cell)]);
 const data=frozenDataCopy297({map:[world.seed,world.width,world.height],human,animalGroups,animalCargo,mechanical,mechanicalBodies,departed,
  humanCarry:groupHumanCarryPairs257(world).map(p=>[p.carrierId,p.patientId])});
 const result=Object.freeze({format:'actor-phase-dependencies-297-1' as const,data});ownedDependencies297.add(result);return result;
}
const equalDependencyValue297=(x:unknown,y:unknown):boolean=>{
 if(Object.is(x,y))return true;if(x===null||y===null||typeof x!=='object'||typeof y!=='object')return false;
 if(Array.isArray(x))return Array.isArray(y)&&x.length===y.length&&x.every((v,i)=>equalDependencyValue297(v,y[i]));
 if(Array.isArray(y))return false;const keys=Reflect.ownKeys(x),other=Reflect.ownKeys(y);if(keys.length!==other.length)return false;
 return keys.every(k=>Object.hasOwn(y,k)&&equalDependencyValue297((x as Record<PropertyKey,unknown>)[k],(y as Record<PropertyKey,unknown>)[k]));
};
/** Exact type/presence/value comparison; unknown or copied wrappers refuse. */
export function equalActorPhaseDependencies297(a:ActorPhaseDependencies297,b:ActorPhaseDependencies297):boolean {
 if(!a||!b||!ownedDependencies297.has(a)||!ownedDependencies297.has(b))return false;
 return equalDependencyValue297(a.data,b.data);
}
/** Row slots of a human dependency row that a pose patch can carry: the work
 * contact (work pose, contact pose, reach, yaw) and the animation pose. */
const HUMAN_CONTACT_SLOT297=11,HUMAN_POSE_SLOT297=12;
/** Humans whose dependency rows differ ONLY in their contact/animation pose,
 * every other dependency (all other human slots, animals, cargo, mechanical
 * bodies, departures, carry pairs, map) being exactly equal. Those changes are
 * derived from the human's own record and its work target, so a frontier pose
 * patch (complete record + Worker-computed contact) presents them without a
 * complete World. `undefined` means some other dependency changed: the caller
 * must keep requesting a genuine Full. An empty list means no change. */
export function poseOnlyDependencyChanges297(a:ActorPhaseDependencies297,b:ActorPhaseDependencies297):number[]|undefined {
 if(!a||!b||!ownedDependencies297.has(a)||!ownedDependencies297.has(b))return undefined;
 const x=a.data as Record<string,unknown>,y=b.data as Record<string,unknown>;
 const keys=Object.keys(x);if(keys.length!==Object.keys(y).length)return undefined;
 for(const key of keys)if(key!=='human'&&(!Object.hasOwn(y,key)||!equalDependencyValue297(x[key],y[key])))return undefined;
 const before=x.human,after=y.human;if(!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)return undefined;
 const changed:number[]=[];
 for(let i=0;i<before.length;i++){
  const p=before[i] as unknown[],q=after[i] as unknown[];
  if(p===q)continue;if(!Array.isArray(p)||!Array.isArray(q)||p.length!==q.length||!Object.is(p[0],q[0]))return undefined;
  let pose=false;
  for(let slot=0;slot<p.length;slot++)if(!equalDependencyValue297(p[slot],q[slot])){
   if(slot!==HUMAN_CONTACT_SLOT297&&slot!==HUMAN_POSE_SLOT297)return undefined;pose=true;
  }
  if(pose)changed.push(p[0] as number);
 }
 return changed;
}
