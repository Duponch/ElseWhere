import {giveBornTraits361} from './trait-generation-361.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {bindBornHumanFaction259,bornFactionForDef259} from './world-affiliation-259.ts';
import { releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { isColonist } from './affiliation.ts';
import { newApparelState } from './apparel-rules.ts';
import { candidateAccess } from './candidate-access.ts';
import { treatmentTarget,medicalRestNeeded } from './care-rules.ts';
import { footprintCells,footprintContains } from './definitions.ts';
import { captureStandability,canStandAt } from './furniture-travel.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { addResolvedInjury,createMedicalRecord,medicalStatus } from './injury-state.ts';
import { HP_UNIT } from './injury-rules.ts';
import { cancelMelee } from './melee-state.ts';
import { blockedCells } from './pathfinding.ts';
import { isRoofed } from './roof-rules.ts';
import { carrierOf } from './rescue-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { startingPawn } from './starting-pawns.ts';
import { generateBornBackground } from './background-generation.ts';
import { reconcilePodRescueJoining,selectPodRescueOrigin } from './pod-rescue-joining.ts';
import { visitorAtEdge } from './visitor-navigation.ts';
import { POD_RESCUE_FALL_TICKS,POD_RESCUE_OPEN_TICKS,POD_RESCUE_LIMIT,type PodRescuePending } from './pod-rescue-state.ts';
import type { Cell,MaterialPile,Pawn,World } from './types.ts';

function random(s:{rng:number}):number {let n=s.rng;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng/0x100000000;}
function emit(w:World,message:string):void {w.events.push({tick:w.tick,type:'need',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
function landingOccupancy(w:World):Set<number> {
  return new Set([...w.structures.flatMap(s=>footprintCells(s).map(c=>c.z*w.width+c.x)),
    ...w.pawns.flatMap(p=>[p.z*w.width+p.x,...p.motion&&p.motion.end>w.tick?[p.motion.from.z*w.width+p.motion.from.x]:[]]),
    ...w.piles.flatMap(p=>p.owner.type==='ground'?[p.owner.z*w.width+p.owner.x]:[]),
    ...w.packed.flatMap(p=>p.owner.type==='ground'?[p.owner.z*w.width+p.owner.x]:[])]);
}
/** Admission searches once; a later blocked opening waits at this same cell. */
function landingCell(w:World,seed:number):Cell|undefined {
  const colon=w.pawns.find(p=>isColonist(p)&&p.state!=='dead');if(!colon)return;
  const blocked=blockedCells(w),occupied=landingOccupancy(w),stand=captureStandability(w);
  const access=candidateAccess(w,colon,blocked,new Set(),true),cells:Cell[]=[];
  for(let z=1;z<w.height-1;z++)for(let x=1;x<w.width-1;x++){
    const c={x,z},key=z*w.width+x;
    if(!blocked[key]&&!occupied.has(key)&&stand(c)&&!isRoofed(w,key)&&access.has(key))cells.push(c);
  }
  return cells.length?cells[(seed>>>0)%cells.length]:undefined;
}
function openingFree(w:World,pending:PodRescuePending):boolean {
  const c=pending.cell,key=c.z*w.width+c.x;
  // A blocked capsule may wait many ticks. Test its single cell directly;
  // rebuilding a whole navigation grid/occupancy set adds no information.
  return canStandAt(w,c)&&!isRoofed(w,key)&&!w.structures.some(s=>footprintContains(s,c))
    &&!w.pawns.some(p=>p.x===c.x&&p.z===c.z||p.motion&&p.motion.end>w.tick&&p.motion.from.x===c.x&&p.motion.from.z===c.z)
    &&!w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z)
    &&!w.packed.some(p=>p.owner.type==='ground'&&p.owner.x===c.x&&p.owner.z===c.z);
}
export function resolveSelectedPodRescue(w:World,seed:number):boolean {
  const state=w.podRescues;
  if(!Number.isInteger(seed)||seed<1||seed>0xffffffff||state?.pending||
    (state?.incidents.length??0)>=POD_RESCUE_LIMIT||(state?.serial??0)>=POD_RESCUE_LIMIT||
    !civilianAdmissionFits(w,1,1)||!Number.isSafeInteger(w.nextId+2)||
    !Number.isSafeInteger(w.tick+POD_RESCUE_FALL_TICKS+POD_RESCUE_OPEN_TICKS))return false;
  const cell=landingCell(w,seed);if(!cell)return false;
  const s=w.podRescues??={profile:'civilian-pod-rescue-v1',serial:0,incidents:[],departed:[]};
  const id=++s.serial;
  s.pending={id,start:w.tick,landAt:w.tick+POD_RESCUE_FALL_TICKS,openAt:w.tick+POD_RESCUE_FALL_TICKS+POD_RESCUE_OPEN_TICKS,cell:{...cell},seed,
    ...(w.schemaVersion>=199?{origin:selectPodRescueOrigin(seed)}:{})};
  emit(w,'Une capsule civile descend : une personne blessée pourra être secourue après son ouverture.');return true;
}
function openPod(w:World,pending:PodRescuePending):boolean {
  if(!civilianAdmissionFits(w,1,1)||!Number.isSafeInteger(w.nextId+2)||!openingFree(w,pending))return false;
  const factionId=pending.origin==='independent'?null:bornFactionForDef259(w,'OutlanderCivil');if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&factionId===undefined)return false;
  const rng={rng:pending.seed},p=startingPawn(w.nextId,`Naufragé ${pending.id}`,pending.cell.x,pending.cell.z,0,55,pending.seed,w.tick,w.schemaVersion);
  p.faction='outlanders';if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&w.worldFactions&&!bindBornHumanFaction259(w,p,factionId!))return false;p.foodPolicyId=w.foodPolicies[0]!.id;p.podRescue={incidentId:pending.id};
  delete p.apparelPolicyId;delete p.apparelAutomation;delete p.nextApparelCheckAt;
  // Historical capsules keep their exact generation; new people retain their
  // starting skills and the ordinary background gains, whichever their origin.
  if(pending.origin===undefined)for(const skill of Object.values(p.skills))if(typeof skill==='object'){skill.level=0;skill.passion=0;}
  // Schema 370: a SpaceRefugee; its bio reads its real faction, or a random
  // non-colony humanlike one when it has none (PawnGenerator).
  if(w.schemaVersion>=191)generateBornBackground(w,p,pending.seed,false,false,{kind:'SpaceRefugee',...pending.origin==='independent'?{}:{fallbackFaction:'OutlanderCivil'}});
  giveBornTraits361(w,p,false,pending.seed);
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  p.health??=createMedicalRecord(w.tick);
  // Local adult injury profile: real recoverable pain shock, no imposed state
  // independent of physiology and no world/combat RNG consumed at generation.
  for(const part of ['left-arm','right-arm','left-leg','right-leg'] as const)
    addResolvedInjury(p.health,part,'cut',(15+Math.floor(random(rng)*2))*HP_UNIT,()=>random(rng));
  addResolvedInjury(p.health,'torso','bruise',8*HP_UNIT,()=>random(rng));
  if(medicalStatus(p.health)!=='downed')return false;
  p.state='downed';
  const shirt:MaterialPile={id:w.nextId+1,kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'apparel',pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,w.schemaVersion)};
  const s=w.podRescues!;
  w.nextId+=2;w.pawns.push(p);w.piles.push(shirt);
  s.incidents.push({id:pending.id,start:pending.start,openedAt:w.tick,pawnId:p.id,
    ...(pending.origin===undefined?{}:{origin:pending.origin})});delete s.pending;
  emit(w,`${p.name} est à terre après l’ouverture de sa capsule. Un secours direct peut le conduire vers un lit.`);return true;
}
/** Production and observation only. Medical intentions belong to the patient
 * processor; the first completed treatment is separate from the final issue. */
export function advancePodRescues(w:World):void {
  const s=w.podRescues;if(!s)return;
  if(s.pending&&w.tick>=s.pending.openAt)openPod(w,s.pending);
  reconcilePodRescueResults(w);
}
/** Also called after medical/capture/death transitions, including paused
 * commands. It cannot allocate an actor or retry a pending capsule opening. */
export function reconcilePodRescueResults(w:World):void {
  const s=w.podRescues;if(!s)return;
  for(const incident of s.incidents){
    if(incident.result)continue;
    const p=w.pawns.find(p=>p.id===incident.pawnId);if(!p)continue;
    if(incident.tendedAt===undefined&&p.health&&(p.health.injuries.some(i=>i.tended!==undefined)||p.health.missing.some(m=>m.tended)))incident.tendedAt=w.tick;
    if(p.state==='dead'||p.health?.death){incident.result='dead';incident.resolvedAt=p.health?.death?.tick??w.tick;}
    else if(p.prisoner){incident.result='captured';incident.resolvedAt=w.tick;}
  }
  // Death and capture close the incident before any recovery decision.
  reconcilePodRescueJoining(w);
}
function stopTargeting(w:World,p:Pawn):boolean {
  let recovering=false;
  for(const q of w.pawns){
    const shooting=q.shooting?.order?.targetId===p.id,melee=q.melee?.order?.targetId===p.id&&!q.melee?.order?.structure;
    if(shooting)cancelShooting(q);if(melee)cancelMelee(q);
    if(shooting||melee){q.path=[];q.planCooldown=0;q.state=(q.motion?.end??0)>w.tick?'moving':'idle';}
    if(q.melee?.strike?.targetId===p.id&&!q.melee.strike.structure)recovering=true;
  }
  return recovering;
}
/** End-of-step commit. Every captured movement and recovery must finish first. */
export function exitPodRescue(w:World,p:Pawn):boolean {
  const s=w.podRescues,incident=s?.incidents.find(i=>i.id===p.podRescue?.incidentId&&i.pawnId===p.id);
  if(!s||!incident||incident.result||!w.pawns.includes(p)||p.faction!=='outlanders'||p.prisoner||
    !visitorAtEdge(w,p)||p.path.length||p.need||p.moveCooldown>0||(p.motion?.end??0)>w.tick||
    !['idle','moving','hungry'].includes(p.state)||p.burning||p.mental?.crisis||p.flee||carrierOf(w,p.id)||
    (p.stun?.untilCore??0)>w.tick*10||p.bombRefuge||p.interruptedCargo||p.equipmentDropPending||p.shooting?.stance||p.melee?.strike||
    p.jobId!==null||p.haul||p.cooking||p.rescue||p.tend||p.feed||p.ward||p.recreation.task||
    p.podRescue?.admittedAt!==undefined&&(treatmentTarget(p)||medicalRestNeeded(p))||s.departed.length>=POD_RESCUE_LIMIT)return false;
  const items=w.piles.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id),packed=w.packed.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id);
  if(items.some(i=>!['inventory','equipment','apparel'].includes(i.owner.type))||packed.some(i=>i.owner.type!=='inventory')||stopTargeting(w,p))return false;
  for(const q of w.pawns)if(q.rescue?.patientId===p.id||q.tend?.patientId===p.id||q.feed?.patientId===p.id)interruptWork(w,q);
  releaseAllowedAreaReturn(p);p.path=[];p.state='idle';p.bedId=null;delete p.bedSlot;p.moveCooldown=0;p.orders={active:null,queue:[]};
  delete p.motion;delete p.stagger;delete p.stun;delete p.shooting;delete p.melee;delete p.tactics;delete p.medicalSleep;delete p.transitExit;
  s.departed.push({incidentId:incident.id,tick:w.tick,pawn:structuredClone(p),items:structuredClone(items),...packed.length?{packed:structuredClone(packed)}:{}});
  incident.result='departed';incident.resolvedAt=w.tick;
  w.pawns=w.pawns.filter(q=>q!==p);w.piles=w.piles.filter(i=>!items.includes(i));w.packed=w.packed.filter(i=>!packed.includes(i));
  emit(w,`${p.name} quitte la carte avec ses possessions restantes.`);return true;
}
import { civilianAdmissionFits } from './civilian-away.ts';
