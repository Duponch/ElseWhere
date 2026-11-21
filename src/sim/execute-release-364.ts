import {schemaAtLeast} from './schema-range.ts';
import {isColonist} from './affiliation.ts';
import {allowedAreaAllows} from './allowed-area-state.ts';
import {allowedAreaServicesAllowed} from './allowed-area-services.ts';
import {violentWorkRefusal} from './colonist-backgrounds.ts';
import {bedServicePlace339,bedsideAccess,patientClaimed} from './care-access.ts';
import {medicalWorkRefusal,pawnBody} from './health-rules.ts';
import {healthRandom,reconcilePawnHealth,updatePawnHealth} from './health.ts';
import {addResolvedInjury,createMedicalRecord,partMissing,remainingPartHealth} from './injury-state.ts';
import {HP_UNIT} from './injury-rules.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {addFilth} from './filth.ts';
import {rememberDeathThought,deathThoughtObserver} from './death-thoughts.ts';
import {gainMoodPoolMemory350} from './mood-pool-memories-350.ts';
import {prisonBreakActive} from './prison-break-state.ts';
import {carrierOf} from './rescue-state.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {releaseWork} from './work-release.ts';
import {workPriority} from './work-types.ts';
import {adjacent,hasReachableCell,routeToJob,type Reachability} from './pathfinding.ts';
import {capturePrisonTopology} from './prison-space.ts';
import {canStandAt} from './furniture-travel.ts';
import {compareSearchKeys,type RegionSearch} from './region-search.ts';
import {slaughterContact} from './animal-slaughter.ts';
import {animalClaimed,animalCarrier,syncCarriedAnimals} from './animal-rest-state.ts';
import {interruptAnimalHaul282} from './animal-hauling-282.ts';
import {forgetLocalActorBed256} from './actor-bed-local-256.ts';
import {releaseAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {cancelToxicVomit256} from './toxic-buildup-256.ts';
import {actualAnimalName256} from './starting-pet-state-256.ts';
import {animalSpecies} from './animal-species.ts';
import type {NeedContext} from './needs.ts';
import type {WardExecuteTask364} from './prisoner-state.ts';
import type {AnimalHandlingTask,DomesticCommand} from './domestic-state.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Cell,CommandResult,Pawn,World} from './types.ts';

/* Schema 364: executing a prisoner and releasing a colony animal to the wild,
 * read from RimWorld 1.6 Core: PrisonerInteractionModeDefs (Execution,
 * mustBeAwake false), WorkGiver_Warden_DoExecution (Warden, priority 110,
 * Manipulation, refused to a pawn incapable of Violent work), JobDriver_Execute
 * (Toils_Interpersonal.GotoPrisoner, Touch, then an instant toil),
 * ExecutionUtility.DoExecutionByCut (blood filth max(1, bodySize x 8), a cut
 * of min(int part health - 1, 1) on the part of highest executionPartPriority,
 * the Neck at 1000, then Kill), ThoughtUtility.GiveThoughtsForPawnExecuted
 * (GenericBrutal: stage 2), the classic precept Execution_Classic
 * (PreceptComp_KnowsMemoryThought: KnowGuestExecuted to the other pawns of
 * the executioner's faction spawned on its map), ThoughtDef KnowGuestExecuted
 * (-5, 6 days, stack 5, nullified by Psychopath, Bloodlust, Cannibal),
 * KilledHumanlikeBloodlust (+12, 4 days, stack 5, Bloodlust only), and
 * Faction.Notify_MemberDied (no Core pawn kind turns the faction hostile on
 * such a death: no goodwill change). Release: Designator_ReleaseAnimalToWild,
 * WorkGiver_ReleaseAnimalsToWild (Handling, priority 100, Manipulation, an
 * outside cell must exist), JobDriver_ReleaseAnimalToWild (go to the animal;
 * when its district does not touch the map edge, carry it to the closest
 * standable outside cell; wait 180 ticks with it; release) and
 * ReleaseAnimalToWildUtility.DoReleaseAnimal (BondedAnimalReleased -5, 15
 * days, stack 5, one per animal, nullified by Psychopath; SetFaction(null);
 * ownership unclaimed). Older schemas never call this module. */
export const EXECUTE_RELEASE_SCHEMA_364=364;
export const isExecuteRelease364=schemaAtLeast(EXECUTE_RELEASE_SCHEMA_364);

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const settled=(w:World,a:{motion?:{end:number}|null|undefined;moveCooldown?:number})=>(a.moveCooldown??0)===0&&(a.motion?.end??0)<=w.tick;
const announce=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'need',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};

/* ------------------------------------------------------------- execution */

/** ExecutionUtility: an adult human has body size 1, so 8 blood filth. */
export const EXECUTION_BLOOD_364=8;
/** ThoughtDef nullifyingTraits of KnowGuestExecuted. */
const GUEST_EXECUTED_NULLIFIERS=['psychopath','bloodlust','cannibal'] as const;

const securePrisoner=(p:Pawn)=>!!p.prisoner&&!prisonBreakActive(p)&&!p.prisoner.escape&&p.prisoner.releasedAt===undefined&&p.state!=='dead'&&!p.health?.death&&!p.mental?.crisis;
/** WorkGiver_Warden_DoExecution: Warden enabled, Manipulation, and not
 * incapable of Violent work (JobFailReason IncapableOfViolence). */
export function executionWardenReady364(w:World,actor:Pawn):boolean {
  if(!isExecuteRelease364(w.schemaVersion)||!isColonist(actor)||actor.prisoner||actor.visitor||workPriority(actor,'warden')<=0)return false;
  if(actor.state==='downed'||actor.state==='dead'||actor.draft||actor.mental?.crisis||actor.interruptedCargo||medicalWorkRefusal(actor)||violentWorkRefusal(actor))return false;
  const body=pawnBody(actor);return body.capacities.manipulation>0&&body.capacities.moving>0;
}
/** ShouldTakeCareOfPrisoner and the Execution interaction mode. A detained
 * colonist keeps the maintain/release choice only, as before 364. */
export function executionTarget364(w:World,actor:Pawn,p:Pawn):boolean {
  return p!==actor&&securePrisoner(p)&&p.prisoner!.mode==='execute'&&!isColonist(p)&&!carrierOf(w,p.id)
    &&allowedAreaAllows(w,actor,p)&&!patientClaimed(w,p.id,actor);
}
export function executionWanted364(w:World,actor:Pawn):boolean {
  return executionWardenReady364(w,actor)&&w.pawns.some(p=>executionTarget364(w,actor,p));
}
export interface ExecutionProposal364 {task:WardExecuteTask364;path:Cell[]}
/** Regionwise search from the warden, then straight-line distance (as the
 * other warden givers of the 301 family). */
export function executionProposal364(w:World,actor:Pawn,reach:Reachability,search?:RegionSearch):ExecutionProposal364|undefined {
  if(!executionWardenReady364(w,actor))return;
  const targets=w.pawns.filter(p=>executionTarget364(w,actor,p));
  const ordered=search?targets.map(p=>({p,key:search.key(p,'DoExecution'),near:(p.x-actor.x)**2+(p.z-actor.z)**2})).sort((a,b)=>compareSearchKeys(a.key,b.key)||a.near-b.near||a.p.id-b.p.id).map(e=>e.p)
    :[...targets].sort((a,b)=>a.id-b.id);
  for(const p of ordered){
    const access=bedsideAccess(w,actor,p,reach,undefined,false,'interaction');
    if(access)return {task:{kind:'execute',patientId:p.id,spot:{...access.spot},phase:'approach'},path:access.path};
  }
}
export function executionTaskValid364(w:World,actor:Pawn,p:Pawn|undefined):boolean {
  return !!p&&allowedAreaServicesAllowed(w,actor)&&executionWardenReady364(w,actor)&&p!==actor&&securePrisoner(p)
    &&p.prisoner!.mode==='execute'&&!isColonist(p)&&!carrierOf(w,p.id)&&!patientClaimed(w,p.id,actor);
}
/** Toils_Interpersonal.GotoPrisoner (Touch), then the instant execution. */
export function processExecution364(w:World,actor:Pawn,t:WardExecuteTask364,context:NeedContext):void {
  const p=w.pawns.find(q=>q.id===t.patientId);
  if(!p||!executionTaskValid364(w,actor,p)){interruptWork(w,actor);return;}
  if(!settled(w,actor))return;
  actor.state='moving';
  const contact=bedServicePlace339(w,p,actor)||adjacent(actor,p)||same(actor,p);
  if(!contact){
    if(!same(actor,t.spot)){context.move(t.spot,true);return;}
    const reach=context.search();if(!reach)return;
    const access=bedsideAccess(w,actor,p,reach,undefined,false,'interaction');
    if(!access){interruptWork(w,actor);return;}
    t.spot={...access.spot};context.move(t.spot,true);return;
  }
  if(!settled(w,p))return;
  commitExecution364(w,actor,p,context);
  if(!releaseWork(w,actor))interruptWork(w,actor);
}
/** DoExecutionByCut, GiveThoughtsForPawnExecuted (GenericBrutal) and the
 * KilledHumanlikeBloodlust thought of the instigator. */
export function commitExecution364(w:World,actor:Pawn,victim:Pawn,context?:Pick<NeedContext,'event'>):void {
  if(!victim.health||medicalCivilTick271(victim.health)<w.tick)updatePawnHealth(w,victim);
  if(victim.state==='dead'||victim.health?.death)return;
  const record=victim.health??=createMedicalRecord(w.tick);
  // Core truncates the part health before the min(health - 1, 1) cut.
  if(!partMissing(record,'neck')){
    const damage=Math.min(HP_UNIT,Math.max(0,(Math.floor(remainingPartHealth(record,'neck')/HP_UNIT)-1)*HP_UNIT));
    if(damage>0)addResolvedInjury(record,'neck','execution-cut',damage,()=>healthRandom(w));
  }
  if(!record.death)record.death={tick:medicalCivilTick271(record),cause:'execution'};
  addFilth(w,victim,'blood',EXECUTION_BLOOD_364);
  reconcilePawnHealth(w,victim,undefined,true);
  // Execution_Classic: the other pawns of the executioner's faction spawned
  // on its map learn of it; carried and held pawns are not spawned.
  for(const p of w.pawns){
    if(p===actor||p===victim||!deathThoughtObserver(p)||carrierOf(w,p.id)||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined)continue;
    if(GUEST_EXECUTED_NULLIFIERS.some(id=>p.traits?.includes(id)))continue;
    rememberDeathThought(p,'guest-executed',victim.id,w.tick);
  }
  if(actor.traits?.includes('bloodlust')&&actor.state!=='dead')rememberDeathThought(actor,'killed-humanlike-bloodlust',victim.id,w.tick);
  context?.event(`${actor.name} a exécuté ${victim.name}.`);
}
/** ITab_Pawn_Visitor: choosing Execution warns when no free colonist has
 * Warden enabled without being incapable of violence. */
export function anyExecutionWarden364(w:World):boolean {
  return w.pawns.some(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead'&&workPriority(p,'warden')>0&&!violentWorkRefusal(p));
}
export function noteExecutionMode364(w:World,p:Pawn):void {
  if(isExecuteRelease364(w.schemaVersion)&&!anyExecutionWarden364(w))announce(w,`Aucun geôlier capable de violence : ${p.name} ne sera pas exécuté tant qu’un colon apte n’a pas Geôlier activé.`);
}

/* ------------------------------------------------------ release to wild */

/** JobDriver_ReleaseAnimalToWild waits 180 Core ticks: 18 local ticks. */
export const RELEASE_WILD_WAIT_TICKS_364=18;
/** BondedAnimalReleased nullifying trait. */
const BONDED_RELEASED_NULLIFIER='psychopath';
export type ReleaseWildTask364=AnimalHandlingTask&{kind:'release';phase:'approach'|'carry'|'interact'};

export function releaseWildHandlerReady364(w:World,p:Pawn):boolean {
  if(!isExecuteRelease364(w.schemaVersion)||!isColonist(p)||p.prisoner||p.visitor||workPriority(p,'handle')<=0)return false;
  if(p.draft||p.mental?.crisis||p.flee||p.burning||p.stun||p.interruptedCargo||medicalWorkRefusal(p)||p.state==='downed'||p.state==='dead')return false;
  const body=pawnBody(p);return body.capacities.moving>0&&body.capacities.manipulation>0;
}
/** Designator and WorkGiver: a living colony animal carrying the designation,
 * not in an aggressive mental state (manhunter), held by nobody else. */
export function releaseWildTargetAvailable364(w:World,a:WildAnimal,handler?:Pawn):boolean {
  return !!w.wildlife?.animals.includes(a)&&!!a.domestic?.release364&&a.state!=='dead'&&!a.health?.death&&!a.manhunter
    &&a.shipCryptosleepHeldAt277===undefined&&(!handler||allowedAreaAllows(w,handler,a))&&!animalClaimed(w,a.id,handler?.id)
    &&(()=>{const carrier=animalCarrier(w,a.id);return !carrier||carrier===handler;})();
}
/** The animal can be picked up or waited with: no fight, flight or fire. */
const calm=(a:WildAnimal)=>!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.stun&&!a.predation;
/** District.TouchesMapEdge, read on the air space of the animal's cell. */
export function outsideCell364(w:World,c:Cell):boolean {
  const room=capturePrisonTopology(w).at(c.x,c.z);return room?.kind==='space'&&room.touchesMapEdge;
}
/** TryFindClosestOutsideCell: Core takes the first region (by region search
 * from the animal) whose district touches the map edge, then its standable
 * allowed cell nearest the root. Our room representation has no region
 * graph: among the reachable standable allowed cells of edge-touching air
 * spaces, the cell nearest the root, cell index breaking ties. */
export function releaseWildOutsideCell364(w:World,handler:Pawn,root:Cell,reach:Reachability):Cell|undefined {
  const topology=capturePrisonTopology(w);let best:Cell|undefined,bestD=Infinity;
  for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++){
    const room=topology.at(x,z);if(room?.kind!=='space'||!room.touchesMapEdge)continue;
    const d=(x-root.x)**2+(z-root.z)**2;if(d>=bestD)continue;
    const c={x,z};if(!canStandAt(w,c)||!allowedAreaAllows(w,handler,c)||!hasReachableCell(reach,z*w.width+x))continue;
    best=c;bestD=d;
  }
  return best;
}
export function releaseWildWanted364(w:World,p:Pawn):boolean {
  return releaseWildHandlerReady364(w,p)&&!!w.wildlife?.animals.some(a=>a.domestic?.release364&&releaseWildTargetAvailable364(w,a,p));
}
export interface ReleaseWildProposal364 {task:ReleaseWildTask364;path:Cell[];target:WildAnimal}
export function releaseWildProposal364(w:World,p:Pawn,reach:Reachability):ReleaseWildProposal364|undefined {
  if(!releaseWildHandlerReady364(w,p))return;
  const animals=(w.wildlife?.animals??[]).filter(a=>a.domestic?.release364&&releaseWildTargetAvailable364(w,a,p))
    .sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.id-b.id);
  for(const a of animals){
    const path=slaughterContact(w,p,a)?[]:routeToJob(w,a,reach,false);if(!path)continue;
    // WorkGiver: NoReachableOutsideCell refuses the job.
    if(!outsideCell364(w,a)&&!releaseWildOutsideCell364(w,p,a,reach))continue;
    return {task:{animalId:a.id,kind:'release',phase:'approach',sourcePileId:0,carryPileId:null,quantity:0,step:0,progress:0},path,target:a};
  }
}
/** JobDriver fail conditions, re-read every step. */
export function releaseWildTaskValid364(w:World,p:Pawn,a:WildAnimal|undefined):a is WildAnimal {
  return !!a&&allowedAreaServicesAllowed(w,p)&&releaseWildHandlerReady364(w,p)&&releaseWildTargetAvailable364(w,a,p);
}
/** The handler waits with the animal (Toils_General.WaitWith): it is held. */
export function releaseWildHolding364(w:World,p:Pawn,a:WildAnimal):boolean {
  const t=p.animalHandling;
  return t?.kind==='release'&&t.animalId===a.id&&t.phase==='interact'&&settled(w,p)&&settled(w,a)&&slaughterContact(w,p,a);
}
function pickUp(w:World,a:WildAnimal):void {
  if(a.haul)interruptAnimalHaul282(w,a);
  releaseAnimalThermalRefuge288(w,a);
  delete a.animalRest;delete a.meal;delete a.mating;delete a.exiting;delete a.eggLay;delete a.sleepUntilCore;delete a.strike;
  if(a.wander)delete a.wander.job;
  if(a.health)cancelToxicVomit256(a.health);
  a.path=[];if(a.state!=='downed')a.state='idle';
}
export function processReleaseWild364(w:World,p:Pawn,task:ReleaseWildTask364,ctx:NeedContext):void {
  const a=w.wildlife?.animals.find(x=>x.id===task.animalId);
  if(!releaseWildTaskValid364(w,p,a)){interruptWork(w,p);return;}
  if(task.phase==='carry'){
    const drop=task.drop364;if(!drop){interruptWork(w,p);return;}
    if(!same(p,drop)||!settled(w,p)){if(settled(w,p))ctx.move(drop,true);syncCarriedAnimals(w,p);return;}
    // PlaceHauledThingInCell: the animal is set down on the handler's cell.
    syncCarriedAnimals(w,p);delete a.motion;a.path=[];a.nextDecision=w.tick;
    task.phase='interact';task.progress=0;delete task.drop364;p.path=[];p.state='working';
    return;
  }
  if(!slaughterContact(w,p,a)||!settled(w,p)||!settled(w,a)){
    task.phase='approach';task.progress=0;
    if(!slaughterContact(w,p,a)){if(settled(w,p))ctx.move(a,false);}
    else {p.path=[];p.state=(p.motion?.end??0)>w.tick?'moving':'idle';}
    return;
  }
  if(!calm(a)){p.path=[];p.state='idle';return;}
  if(task.phase==='approach'){
    if(!outsideCell364(w,a)){
      const reach=ctx.search();if(!reach)return;
      const drop=releaseWildOutsideCell364(w,p,p,reach);if(!drop){interruptWork(w,p);return;}
      pickUp(w,a);task.phase='carry';task.drop364={...drop};p.path=[];p.state='moving';syncCarriedAnimals(w,p);
      ctx.event(`${p.name} porte ${animalLabel364(a)} hors de la colonie pour le relâcher.`);
      return;
    }
    releaseAnimalThermalRefuge288(w,a);task.phase='interact';task.progress=0;
  }
  p.path=[];p.state='working';
  if(++task.progress<RELEASE_WILD_WAIT_TICKS_364)return;
  doReleaseAnimal364(w,p,a,ctx);
  if(!releaseWork(w,p))interruptWork(w,p);
}
export const animalLabel364=(a:WildAnimal):string=>actualAnimalName256(a)??`${animalSpecies(a.species).label} ${a.id}`;
/** ReleaseAnimalToWildUtility.DoReleaseAnimal. SetFaction(null) keeps the
 * training tracker, the master and the bond relation as Core data: they stay
 * on the record and are inert while the animal is wild. */
export function doReleaseAnimal364(w:World,handler:Pawn,a:WildAnimal,ctx?:Pick<NeedContext,'event'>):void {
  const bond=a.startingPet?.bondedPawnId;
  if(bond!==undefined){
    const human=w.pawns.find(h=>h.id===bond);
    if(human&&human.state!=='dead'&&!human.health?.death&&!human.traits?.includes(BONDED_RELEASED_NULLIFIER))gainMoodPoolMemory350(human,'bonded-animal-released',w.tick,a.id);
  }
  if(a.haul)interruptAnimalHaul282(w,a);
  forgetLocalActorBed256(w,a);
  delete a.animalThermalRefuge288;delete a.animalMapAreas287;delete a.animalAreaReturn287;delete a.domestic;delete a.taming;delete a.animalRest;
  // A tame-only job (a nuzzle, a walk to its sleeping place) ends with the faction.
  const nuzzle=a.wander?.nuzzle350;if(nuzzle?.targetId!==undefined)a.wander!.nuzzle350={tryCore:nuzzle.tryCore};
  if(a.wander)delete a.wander.job;
  if(a.state==='moving'&&(a.motion?.end??0)<=w.tick)a.state='idle';
  a.path=[];a.nextDecision=w.tick;
  ctx?.event(`${handler.name} a relâché ${animalLabel364(a)} dans la nature.`);
}
export function releaseWildRefusal364(w:World,a:WildAnimal|undefined):string|undefined {
  return !isExecuteRelease364(w.schemaVersion)?'La remise en liberté est indisponible dans cette version.'
    :!a||a.state==='dead'||a.health?.death?'Animal vivant introuvable.'
    :!a.domestic?'Seul un animal de la colonie peut être relâché.':undefined;
}
/** Designator_ReleaseAnimalToWild: the designation replaces a Slaughter one
 * and warns when a colonist is bonded to the animal. */
export function designateReleaseWild364(w:World,command:Extract<DomesticCommand,{type:'release-wild'}>):CommandResult {
  const invalid=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!Number.isSafeInteger(command.animalId)||typeof command.enabled!=='boolean')return invalid('Ordre de remise en liberté invalide.');
  const a=w.wildlife?.animals.find(x=>x.id===command.animalId),reason=releaseWildRefusal364(w,a);
  if(reason)return invalid(reason);
  const d=a!.domestic!;
  if(!command.enabled){
    delete d.release364;
    for(const p of w.pawns)if(p.animalHandling?.kind==='release'&&p.animalHandling.animalId===a!.id)interruptWork(w,p);
  }else if(!d.release364){
    d.release364=true;delete d.slaughter;
    for(const p of w.pawns)if(p.animalHandling?.kind==='slaughter'&&p.animalHandling.animalId===a!.id)interruptWork(w,p);
    const bond=a!.startingPet?.bondedPawnId,human=bond===undefined?undefined:w.pawns.find(h=>h.id===bond&&h.state!=='dead');
    if(human)announce(w,`${animalLabel364(a!)} est lié à ${human.name} : le relâcher lui causera de la peine.`);
  }
  for(const p of w.pawns)p.planCooldown=0;
  return {ok:true};
}
/** Designator_Slaughter: a Slaughter designation replaces the release one. */
export function clearReleaseForSlaughter364(w:World,a:WildAnimal):void {
  if(!a.domestic?.release364)return;
  delete a.domestic.release364;
  for(const p of w.pawns)if(p.animalHandling?.kind==='release'&&p.animalHandling.animalId===a.id)interruptWork(w,p);
}

/* -------------------------------------------------------------- saves */

const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const cellIn=(w:Pick<World,'width'|'height'>,v:unknown):v is Cell=>obj(v)&&Object.keys(v).length===2&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);
/** The warden's execution task: shape only; its target is checked with the
 * other warden tasks. */
export function validExecutionWardShape364(t:Record<string,unknown>,version:number,w:Pick<World,'width'|'height'|'nextId'>):boolean {
  return isExecuteRelease364(version)&&t.kind==='execute'&&Object.keys(t).length===4&&['kind','patientId','spot','phase'].every(k=>Object.hasOwn(t,k))
    &&int(t.patientId,1,w.nextId-1)&&cellIn(w,t.spot)&&t.phase==='approach';
}
/** The handler's release task, with its actual animal and designation. */
export function validReleaseWildTask364(w:World,p:Pawn,version:number):boolean {
  const raw:unknown=p.animalHandling;
  if(!obj(raw)||raw.kind!=='release')return true;
  const allowed=['animalId','kind','phase','sourcePileId','carryPileId','quantity','step','progress','drop364'];
  if(!isExecuteRelease364(version)||!Object.keys(raw).every(k=>allowed.includes(k))||!allowed.slice(0,8).every(k=>Object.hasOwn(raw,k))
    ||!int(raw.animalId,1,w.nextId-1)||!['approach','carry','interact'].includes(String(raw.phase))
    ||raw.sourcePileId!==0||raw.carryPileId!==null||raw.quantity!==0||raw.step!==0
    ||!int(raw.progress,0,RELEASE_WILD_WAIT_TICKS_364-1)||raw.phase!=='interact'&&raw.progress!==0
    ||(raw.phase==='carry'?!cellIn(w,raw.drop364):Object.hasOwn(raw,'drop364')))return false;
  const a=w.wildlife?.animals.find(x=>x.id===raw.animalId);
  if(!a||!a.domestic?.release364||a.state==='dead'||a.health?.death||!isColonist(p)||p.prisoner||p.visitor||!['moving','working','idle'].includes(p.state))return false;
  if(w.pawns.some(other=>other!==p&&other.animalHandling?.animalId===a.id))return false;
  return raw.phase!=='carry'||a.x===p.x&&a.z===p.z;
}
/** Domestic record field: the release designation, never with Slaughter. */
export function validReleaseDesignation364(d:Record<string,unknown>,version:number):boolean {
  return !Object.hasOwn(d,'release364')||isExecuteRelease364(version)&&d.release364===true&&!Object.hasOwn(d,'slaughter');
}
