import {isColonist,distanceSquared} from './affiliation.ts';
import {isMoodPool350,isMoodPoolCrisis350,type MoodPoolCrisisKind350} from './mood-pool-memories-350.ts';
export {MOOD_POOL_CRISES_350,crisisWalks350,isMoodPoolCrisis350,type MoodPoolCrisisKind350} from './mood-pool-memories-350.ts';
import {isBedKind} from './bed-kinds.ts';
import {sharedLightEnvironmentCache} from './light-environment.ts';
import {pawnBody} from './health-rules.ts';
import {healthRandom} from './health.ts';
import {carrierOf} from './rescue-state.ts';
import {candidateAccess} from './candidate-access.ts';
import {captureMeleePlaces} from './melee-space.ts';
import {blockedCells,hasReachableCell,routeToCell,type Reachability} from './pathfinding.ts';
import {canSocialize,goodSocialPosition,prisonerCanSocialize325} from './social.ts';
import {addSocialMemory,expireSocialMemories,socialImpact,socialSeed} from './social-state.ts';
import {finishMentalBreak,type MentalCrisis} from './mental-state.ts';
import type {NeedContext} from './needs.ts';
import type {SearchBudget} from './work-planner.ts';
import type {Cell,Pawn,World} from './types.ts';

/* Schema 350: the mood breaks Elsewhere lacked (MentalStates_Mood.xml).
 * Minor (baseCommonality 0.5 each, colonists only): Wander_OwnRoom (40 000 to
 * 60 000 ticks, needs an owned bed in a room that is not psychologically
 * outdoors), InsultingSpree and TargetedInsultingSpree (25 000 to 45 000
 * ticks, need Talking; at least two insult candidates for the spree, one
 * non-prisoner for the targeted one). Major: Wander_Psychotic (commonality 1,
 * 70 000 to 90 000 ticks, prisoners too). Recovery MTB 0.166 days for all.
 * The minor pool now weighs 2.8, as in Core: food binge 0.8 of it. */
type Spree=Extract<MentalCrisis,{kind:'insulting-spree'|'targeted-insulting-spree'}>;
const isSpree=(c:MentalCrisis):c is Spree=>c.kind==='insulting-spree'||c.kind==='targeted-insulting-spree';

/** MentalStateWorker_WanderOwnRoom: the owned bed's cell (MentalState_WanderOwnRoom
 * target), when the bed stands in a room that is not psychologically outdoors
 * (at least 300 open cells, or the map edge with half its cells open). */
export function ownRoomRoot350(w:World,p:Pawn):Cell|undefined {
 if(p.bedId===null)return;
 const bed=w.structures.find(s=>s.id===p.bedId&&isBedKind(s.kind));if(!bed)return;
 const {topology,roofs}=sharedLightEnvironmentCache(w).read(w),space=topology.at(bed.x,bed.z);
 if(space?.kind!=='space')return;
 let covered=0;for(const index of roofs){const r=topology.at(index%w.width,Math.floor(index/w.width));if(r?.kind==='space'&&r.id===space.id)covered++;}
 const open=space.cellCount-covered;
 return open>=300||space.touchesMapEdge&&open>=space.cellCount*.5?undefined:{x:bed.x,z:bed.z};
}
/** WanderRoomUtility.IsValidWanderDest: a destination in the root's room. */
export function ownRoomSpace350(w:World,root:Cell):((x:number,z:number)=>boolean)|undefined {
 const topology=sharedLightEnvironmentCache(w).read(w).topology,space=topology.at(root.x,root.z);
 if(space?.kind!=='space')return;
 return (x,z)=>{const s=topology.at(x,z);return s?.kind==='space'&&s.id===space.id;};
}

/** InsultingSpreeMentalStateUtility.CanChaseAndInsult without the
 * reachability test: a humanlike of the bully's faction (or, when allowed, a
 * prisoner it holds), awake, not downed, within 40 cells, able to receive an
 * interaction. Adaptation: Elsewhere's interaction rules decide who can
 * receive one (not in a crisis, a fight, a carry or a couple activity). */
export function insultRecipient350(w:World,bully:Pawn,t:Pawn,allowPrisoners:boolean):boolean {
 if(t===bully||!w.pawns.includes(t)||t.state==='dead'||t.state==='downed'||t.state==='sleeping'||t.medicalSleep||t.health?.death||distanceSquared(bully,t)>40**2)return false;
 if(isColonist(t))return !t.visitor&&canSocialize(w,t,false);
 return allowPrisoners&&!!t.prisoner&&prisonerCanSocialize325(w,t,false);
}
/** GetInsultCandidatesFor: one bounded reachability read. Null defers. */
export function insultCandidates350(w:World,bully:Pawn,allowPrisoners:boolean,budget?:SearchBudget):Pawn[]|null {
 const near=w.pawns.filter(t=>insultRecipient350(w,bully,t,allowPrisoners));
 if(!near.length)return [];
 if(budget&&!budget.remaining)return null;
 if(budget)budget.remaining--;
 const reach=candidateAccess(w,bully,blockedCells(w),new Set(),true),places=captureMeleePlaces(w,bully);
 return near.filter(t=>places(t).some(c=>hasReachableCell(reach,c.z*w.width+c.x)));
}
export interface MoodPoolAdmission350 {root?:Cell;candidates?:Pawn[]}
/** The schema 350 options of one intensity, in the Core def order, before any
 * draw. Null defers the decision (no search budget left). */
export function minorPoolOptions350(w:World,p:Pawn,budget?:SearchBudget):{kind:'food-binge'|'sad-wander'|'wander-own-room'|'insulting-spree'|'targeted-insulting-spree';weight:number;admission?:MoodPoolAdmission350}[]|null {
 if(p.prisoner)return [{kind:'sad-wander',weight:.5}];
 const options:{kind:'food-binge'|'sad-wander'|'wander-own-room'|'insulting-spree'|'targeted-insulting-spree';weight:number;admission?:MoodPoolAdmission350}[]=[{kind:'food-binge',weight:.8},{kind:'sad-wander',weight:.5}];
 const root=ownRoomRoot350(w,p);if(root)options.push({kind:'wander-own-room',weight:.5,admission:{root}});
 if(pawnBody(p).capacities.talking>0){
  const all=insultCandidates350(w,p,true,budget);if(all===null)return null;
  if(all.length>=2)options.push({kind:'insulting-spree',weight:.5,admission:{candidates:all}});
  const free=all.filter(t=>!t.prisoner);
  if(free.length)options.push({kind:'targeted-insulting-spree',weight:.5,admission:{candidates:free}});
 }
 return options;
}
/** Wander_Psychotic has no colonistsOnly: any pawn able to break may start it. */
export const psychoticWanderAdmitted350=(p:Pawn):boolean=>p.state!=='downed'&&p.state!=='sleeping'&&!p.mental?.crisis;

/** The crisis record of a new break, before its target draws. */
export function newMoodPoolCrisis350(w:World,kind:MoodPoolCrisisKind350,admission?:MoodPoolAdmission350):MentalCrisis {
 const base={age:0,target:null,waitUntil:w.tick};
 if(kind==='psychotic-wander')return {...base,kind};
 if(kind==='wander-own-room')return {...base,kind,root:{...admission!.root!}};
 if(kind==='insulting-spree')return {...base,kind,insultTargetId:null,insulted:false,lastInsultCore:null,foundCore:null};
 return {...base,kind,insultTargetId:admission!.candidates![0]!.id,insulted:false,lastInsultCore:null};
}
/** PostStart (InsultingSpreeAll) or PreStart (Targeted): drawn after the
 * break's reason, on the same mental stream. */
export function drawFirstInsultTarget350(w:World,p:Pawn,c:MentalCrisis,candidates:readonly Pawn[]):void {
 if(c.kind==='insulting-spree')chooseNextInsultTarget350(w,p,c,candidates);
 else if(c.kind==='targeted-insulting-spree'){
  const t=candidates[Math.floor(healthRandom(w)*candidates.length)]!;c.insultTargetId=t.id;
  emit(w,`${p.name} s’en prend à ${t.name} et le suit pour l’insulter.`);
 }
}
/** MentalState_InsultingSpreeAll.ChooseNextTarget: weight 1 - min(d/40, 1)
 * + 0.01; after 1 250 ticks on one target, another one if any. */
function chooseNextInsultTarget350(w:World,p:Pawn,c:Extract<MentalCrisis,{kind:'insulting-spree'}>,candidates:readonly Pawn[]):void {
 if(!candidates.length){c.insultTargetId=null;c.insulted=false;c.foundCore=null;return;}
 const now=w.tick*10,current=c.insultTargetId;
 const pool=current===null||c.foundCore===null||now-c.foundCore<=1250||!candidates.some(t=>t.id!==current)?candidates:candidates.filter(t=>t.id!==current);
 const weight=(t:Pawn)=>1-Math.min(Math.sqrt(distanceSquared(p,t))/40,1)+.01;
 let roll=healthRandom(w)*pool.reduce((s,t)=>s+weight(t),0);
 const chosen=pool.find(t=>(roll-=weight(t))<0)??pool.at(-1)!;
 if(chosen.id!==current){c.insultTargetId=chosen.id;c.insulted=false;c.foundCore=now;}
}
const emit=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'need',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};

/** MentalStateTick of the sprees, each tick before the age step. False when
 * the crisis ended (a targeted spree whose target cannot be replaced). */
export function maintainInsultingSpree350(w:World,p:Pawn,budget?:SearchBudget):boolean {
 const c=p.mental?.crisis;if(!c||!isSpree(c))return true;
 const target=c.insultTargetId===null?undefined:w.pawns.find(t=>t.id===c.insultTargetId);
 if(c.kind==='insulting-spree'){
  const lost=c.insultTargetId!==null&&(!target||!insultRecipient350(w,p,target,true));
  if(lost||(w.tick+p.id)%25===0&&(c.insultTargetId===null||c.insulted)){
   const candidates=insultCandidates350(w,p,true,budget);
   if(candidates!==null)chooseNextInsultTarget350(w,p,c,candidates);
  }
  return true;
 }
 if(target&&insultRecipient350(w,p,target,false))return true;
 return retargetOrRecover350(w,p,c,budget);
}
function retargetOrRecover350(w:World,p:Pawn,c:Extract<MentalCrisis,{kind:'targeted-insulting-spree'}>,budget?:SearchBudget):boolean {
 const candidates=insultCandidates350(w,p,false,budget);
 if(candidates===null)return true;
 const old=w.pawns.find(t=>t.id===c.insultTargetId);
 if(!candidates.length){finishMentalBreak(w,p);return false;}
 const t=candidates[Math.floor(healthRandom(w)*candidates.length)]!;
 c.insultTargetId=t.id;c.target=null;p.path=[];
 emit(w,`${p.name} s’en prend désormais à ${t.name}${old?` au lieu de ${old.name}`:''}.`);
 return true;
}
/** MentalState.CanEndBeforeMaxDurationNow: a targeted spree recovers early
 * only after insulting its target once. */
export const crisisCanEndEarly350=(c:MentalCrisis):boolean=>c.kind!=='targeted-insulting-spree'||c.insulted;
/** Wander_Psychotic lacks recoverFromSleep: an ordinary sleep keeps it. */
export const crisisKeptAsleep350=(p:Pawn):boolean=>p.mental?.crisis?.kind==='psychotic-wander'&&p.state==='sleeping'&&!p.medicalSleep&&pawnBody(p).canBeAwake;
/** JobGiver_InsultingSpree and JobDriver_Insult: go to the target, wait 1 200
 * ticks after the last insult and 120 after the last interaction, then insult
 * from a good social position within 3 cells. False when there is no target
 * (the spree then wanders, JobGiver_WanderColony). */
export function processInsultingSpree350(w:World,p:Pawn,context:NeedContext,candidatesReach:()=>Reachability|null):boolean {
 const c=p.mental?.crisis;if(!c||!isSpree(c)||c.insultTargetId===null)return false;
 const target=w.pawns.find(t=>t.id===c.insultTargetId);if(!target)return false;
 if(distanceSquared(p,target)<=9&&goodSocialPosition(w,p,target)&&!carrierOf(w,target.id)){
  if(p.path.length||c.target){p.path=[];c.target=null;}
  p.state='idle';
  if(p.moveCooldown>0||c.lastInsultCore!==null&&w.tick*10-c.lastInsultCore<1200||w.tick-(p.social?.last?.tick??-1000)<12)return true;
  spreeInsult350(w,p,target);
  c.lastInsultCore=w.tick*10;if(target.id===c.insultTargetId)c.insulted=true;
  return true;
 }
 const end=p.path.at(-1);
 if(!end||!c.target||Math.max(Math.abs(end.x-target.x),Math.abs(end.z-target.z))>2){
  if(p.planCooldown>0||p.moveCooldown>0){if(c.target&&p.path.length)context.move(c.target,true);return true;}
  const reach=candidatesReach();if(!reach)return true;
  const path=routeToCell(w,{x:target.x,z:target.z},reach);
  if(!path){
   c.target=null;p.path=[];p.planCooldown=10;
   // Unreachable: the spree chooses another target, a targeted one another victim or its end.
   if(c.kind==='targeted-insulting-spree')retargetOrRecover350(w,p,c);else{c.insultTargetId=null;c.insulted=false;c.foundCore=null;}
   return true;
  }
  c.target={x:target.x,z:target.z};p.path=path;p.planCooldown=0;
 }
 context.move(c.target,true);
 return true;
}
/** The Insult interaction (InteractionDefOf.Insult): Insulted opinion and
 * InsultedMood on the recipient. Adaptation: Elsewhere starts no social
 * fight with a pawn in a mental break, so the fight chance is not rolled. */
function spreeInsult350(w:World,a:Pawn,b:Pawn):void {
 const sa=a.social??={rng:socialSeed(w.seed,a.id),memories:[]},sb=b.social??={rng:socialSeed(w.seed,b.id),memories:[]};
 expireSocialMemories(a,w.tick);expireSocialMemories(b,w.tick);
 addSocialMemory(sb,a.id,'insult',w.tick,socialImpact(a));
 sa.last={otherId:b.id,kind:'insult',tick:w.tick,initiated:true};sb.last={otherId:a.id,kind:'insult',tick:w.tick,initiated:false};delete sa.wants;
 emit(w,`${a.name} insulte ${b.name} pendant sa crise.`);
}
/** True while a crisis of this lot needs its own posture rules. */
export const moodPoolCrisisActive350=(w:World,p:Pawn):boolean=>isMoodPool350(w.schemaVersion)&&isMoodPoolCrisis350(p.mental?.crisis?.kind);
