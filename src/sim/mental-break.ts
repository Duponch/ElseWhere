import {drugBingeWeight361,onlyAllowedMinorBreaks361,traitForbidsDrugBinge361,traitMentalStateRoll361} from './trait-mental-361.ts';
import {markCrisisNotMood362} from './trait-links-362.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {mentalBreakLetter352} from './letter-producers-352.ts';
import {tutorialMode347} from './game-profile.ts';
import {processHumanConfusedWander256,recoverHumanConfusion256} from './human-condition-mind-256.ts';
import {alcoholBingeAdmission265,processAutomaticAlcohol265} from './alcohol-ingestion-265.ts';
import { expireMentalCatharsisAt } from './mental-state.ts';
import { BREAK_MTB_DAYS,finishMentalBreak,mentalState } from './mental-state.ts';
import { TRAITS,breakThresholds,minorBreakThreshold } from './traits.ts';
import { moodFrozen,moodThoughts } from './mood.ts';
import { healthRandom } from './health.ts';
import { interruptDraftWork } from './drafting.ts';
import { collapseFromExhaustion,processNeeds,type NeedContext } from './needs.ts';
import { retryInterruptedCargo } from './interrupted-cargo.ts';
import { isColonist } from './affiliation.ts';
import { carrierOf } from './rescue-state.ts';
import { canStandAt } from './furniture-travel.ts';
import { hasReachableCell,routeToCell,type Reachability } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { MENTAL_CRISIS_CATALOG,mentalCrisisLabel,murderousRageWeight,type MentalCrisisKind } from './mental-catalog.ts';
import { aggressiveCrisisAdmission,planAggressiveCrisis,type AggressiveCrisisAdmission } from './aggressive-crisis-admission.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import type { AggressiveCrisisKind,MentalCrisis } from './mental-state.ts';
import {isMoodPool350} from './mood-pool-350.ts';
import {crisisCanEndEarly350,crisisKeptAsleep350,drawFirstInsultTarget350,isMoodPoolCrisis350,maintainInsultingSpree350,minorPoolOptions350,newMoodPoolCrisis350,ownRoomSpace350,processInsultingSpree350,psychoticWanderAdmitted350,type MoodPoolAdmission350,type MoodPoolCrisisKind350} from './mental-breaks-350.ts';
import {fireSpreeJobEnded368,isPyromaniac368,newFireSpreeCrisis368,processFireStartingSpree368,pyromaniacRandomSpreeDue368} from './fire-spree-368.ts';
import type { SearchBudget } from './work-planner.ts';
import type { Pawn,World } from './types.ts';
import {markHumanMentalThreat379} from './human-threat-candidates-379.ts';

/** Schema 347 tutorial (TutorSystem.TutorialMode): MentalBreakWorker.
 * BreakCanOccur and MentalStateHandler.TryStartMentalState refuse every
 * pawn of the player's faction (a prisoner is not of it). */
export const tutorialSparesMind347=(world:World,pawn:Pawn):boolean=>tutorialMode347(world)&&isColonist(pawn)&&!pawn.prisoner;
function commitBreak(world:World,pawn:Pawn,crisis:MentalCrisis,rng=world.rng,traitReason?:string):boolean {
  if(tutorialSparesMind347(world,pawn))return false;
  let reason=traitReason;
  // A trait-given state (schema 361) names its trait, as Core's
  // MentalStateReason_Trait: no thought is drawn for it.
  if(reason===undefined){
    const thoughts=moodThoughts(world,pawn).filter(t=>t.offset<0);
    const strongest=Math.min(0,...thoughts.map(t=>t.offset));
    const candidates=thoughts.filter(t=>t.offset<=strongest*.5);
    const stream={rng};
    let roll=healthRandom(stream)*candidates.reduce((s,t)=>s-t.offset,0);
    reason=candidates.find(t=>(roll+=t.offset)<0)?.label;
    world.rng=stream.rng;
  }
  delete pawn.draft;cancelShooting(pawn);cancelMelee(pawn);delete pawn.flee;
  interruptDraftWork(world,pawn);
  mentalState(pawn).crisis=crisis;
  markHumanMentalThreat379(world,pawn);
  pawn.needCooldown=0;pawn.planCooldown=0;
  world.events.push({tick:world.tick,type:'need',message:`${pawn.name} commence ${crisis.kind==='food-binge'?'une frénésie alimentaire':crisis.kind==='sad-wander'?'une errance triste':`une ${mentalCrisisLabel(crisis.kind).toLowerCase()}`}.${reason?` Dernière cause : ${reason}.`:''}`});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
  mentalBreakLetter352(world,pawn,crisis.kind);
  return true;
}
function startMinorBreak(world:World,pawn:Pawn,kind:'sad-wander'|'food-binge',traitReason?:string):boolean {
  if(!isColonist(pawn)||kind==='food-binge'&&pawn.prisoner||pawn.state==='downed'||moodFrozen(pawn)||pawn.mental?.crisis)return false;
  return commitBreak(world,pawn,{kind,age:0,target:null,waitUntil:world.tick},world.rng,traitReason);
}
export const startSadWander=(world:World,pawn:Pawn):boolean=>startMinorBreak(world,pawn,'sad-wander');
export const startFoodBinge=(world:World,pawn:Pawn):boolean=>startMinorBreak(world,pawn,'food-binge');
export function startAlcoholBinge265(world:World,pawn:Pawn,budget?:SearchBudget,admitted=false):boolean {
 if(!admitted&&alcoholBingeAdmission265(world,pawn,budget)!==true)return false;
 return commitBreak(world,pawn,{kind:'drug-binge',age:0,target:null,waitUntil:world.tick});
}
function startAggressiveBreak(world:World,pawn:Pawn,kind:AggressiveCrisisKind,admitted?:AggressiveCrisisAdmission):boolean {
  if(world.schemaVersion<192||moodFrozen(pawn))return false;
  const admission=admitted??aggressiveCrisisAdmission(world,pawn,kind);
  if(!admission)return false;
  const rng={value:world.rng},crisis=planAggressiveCrisis(world,pawn,kind,admission,rng);
  return commitBreak(world,pawn,crisis,rng.value);
}
/** Schema 368: FireStartingSpree BreakCanOccur (requiredTrait Pyromaniac)
 * and MentalStateWorker.StateCanOccur (colonistsOnly, prisonersCanDo false,
 * not downed), awake (TryStartMentalState), no other state. */
export function fireSpreeCanOccur368(world:World,pawn:Pawn):boolean {
  return isPyromaniac368(world.schemaVersion)&&!!pawn.traits?.includes('pyromaniac')&&isColonist(pawn)&&!pawn.prisoner&&!pawn.visitor
    &&pawn.state!=='downed'&&pawn.state!=='dead'&&!moodFrozen(pawn)&&!pawn.mental?.crisis;
}
/** Start the spree: mood-caused (the reason drawn on the mental stream) or
 * given by the trait (its label, no draw). */
export function startFireStartingSpree368(world:World,pawn:Pawn,traitReason?:string):boolean {
  if(!fireSpreeCanOccur368(world,pawn))return false;
  return commitBreak(world,pawn,newFireSpreeCrisis368(world),world.rng,traitReason);
}
export const startTantrum=(world:World,pawn:Pawn):boolean=>startAggressiveBreak(world,pawn,'tantrum');
export const startBerserk=(world:World,pawn:Pawn):boolean=>startAggressiveBreak(world,pawn,'berserk');
export const startMurderousRage=(world:World,pawn:Pawn):boolean=>startAggressiveBreak(world,pawn,'murderous-rage');

/** Counters/cooldown are saved; the schedule derives only from tick and ID.
 * No random calls on healthy ordinary actors. */
export function updateMentalBreak(world:World,pawn:Pawn,budget?:SearchBudget):void {
  const hadCrisis=!!pawn.mental?.crisis;
  updateMoodMentalBreak(world,pawn,budget);
  // Core MentalBreakerTickInterval: the trait state givers run on the same
  // 150-tick check when no mood break started (schema 361 traits only), in
  // the pawn's trait order until one gives a state (368: the pyromaniac).
  if(!hadCrisis&&!pawn.mental?.crisis&&pawn.traits)for(const id of pawn.traits){
    if(id==='gourmand'?gourmandRandomBinge361(world,pawn):id==='pyromaniac'&&pyromaniacRandomSpree368(world,pawn))break;
  }
}
/** Pyromaniac randomMentalState FireStartingSpree (schema 368), MTB 50 days
 * at any mood, on the pyromaniac's own stream; not caused by mood. */
function pyromaniacRandomSpree368(world:World,pawn:Pawn):boolean {
  if((world.tick+pawn.id)%15!==0||pawn.state==='dead'||!isColonist(pawn)||tutorialSparesMind347(world,pawn))return false;
  if(!pyromaniacRandomSpreeDue368(world,pawn))return false;
  if(!startFireStartingSpree368(world,pawn,TRAITS.pyromaniac.label))return false;
  markCrisisNotMood362(world.schemaVersion,pawn);return true;
}
/** Gourmand randomMentalState Binging_Food, MTB 50 days at any mood
 * (randomMentalStateMtbDaysMoodCurve (0,50)), drawn on a private channel. */
function gourmandRandomBinge361(world:World,pawn:Pawn):boolean {
  if((world.tick+pawn.id)%15!==0||pawn.state==='dead'||!isColonist(pawn)||tutorialSparesMind347(world,pawn))return false;
  if(traitMentalStateRoll361(world.seed,pawn.id,world.tick)>=150/(50*60000))return false;
  // Schema 362: TraitMentalStateGiver starts it with causedByMood false.
  if(!startMinorBreak(world,pawn,'food-binge',TRAITS.gourmand.label))return false;
  markCrisisNotMood362(world.schemaVersion,pawn);return true;
}
function updateMoodMentalBreak(world:World,pawn:Pawn,budget?:SearchBudget):void {
  let m=pawn.mental;
  expireMentalCatharsisAt(pawn,world.tick);
  if(pawn.state==='dead'){if(m?.crisis)finishMentalBreak(world,pawn,false);return;}
  if(m?.crisis?.kind==='confused-wander'){if(pawn.state==='downed')recoverHumanConfusion256(pawn,world);return;}
  if(!isColonist(pawn))return;
  if(m?.cooldown&&!moodFrozen(pawn))m.cooldown--;
  // The arrested person's current interval stays clinical, while no new
  // mental job can replace the body owned by the actual carrier.
  if(world.schemaVersion>=213&&carrierOf(world,pawn.id)?.rescue?.arrest)return;
  const alcohol=pawn.health?.alcohol;
  if(alcohol?.bingeRequestedAt!==undefined){
    if(alcohol.bingeRequestedAt<(world.tick-1)*10||pawn.mental?.crisis||moodFrozen(pawn)||pawn.state==='downed')delete alcohol.bingeRequestedAt;
    else {const admission=alcoholBingeAdmission265(world,pawn,budget);if(admission!==null){delete alcohol.bingeRequestedAt;if(admission){if(startAlcoholBinge265(world,pawn,budget,true))markCrisisNotMood362(world.schemaVersion,pawn);m=pawn.mental;}}}
  }
  if(m?.crisis) {
    // Schema 350: Wander_Psychotic has no recoverFromSleep.
    if(pawn.state==='downed'||moodFrozen(pawn)&&!crisisKeptAsleep350(pawn)){finishMentalBreak(world,pawn);return;}
    if(isMoodPoolCrisis350(m.crisis.kind)&&!maintainInsultingSpree350(world,pawn,budget))return;
    if((world.tick+pawn.id)%3===0) {
      m.crisis.age+=30;
      const rules=MENTAL_CRISIS_CATALOG[m.crisis.kind];
      if(m.crisis.age>=rules.maxCore||m.crisis.age>=rules.minCore&&crisisCanEndEarly350(m.crisis)&&healthRandom(world)<30/(rules.recoveryMtb*60000)) {
        finishMentalBreak(world,pawn);
        // Recovery ends the crisis job as well. A carried meal stays physical;
        // interruption may retain it until the active edge/ground permits drop.
        interruptDraftWork(world,pawn);
      }
    }
    return;
  }
  if((world.tick+pawn.id)%15!==0||!m&&pawn.mood>=minorBreakThreshold(pawn))return;
  m=mentalState(pawn);
  const thresholds=breakThresholds(pawn);
  for(let i=0;i<3;i++)m.below[i]=pawn.mood<thresholds[i]! ? Math.min(2100,m.below[i]!+150):0;
  if(m.cooldown||pawn.state==='downed'||moodFrozen(pawn))return;
  const level=m.below[2]>2000?2:m.below[1]>2000?1:m.below[0]>2000?0:-1;
  if(level<0)return;
  // The thresholds are still tracked; no break can be chosen (no draw).
  if(tutorialSparesMind347(world,pawn))return;
  if(world.schemaVersion<192){
    if(healthRandom(world)<150/(BREAK_MTB_DAYS[Math.max(0,level)]!*60000)){
      if(!pawn.prisoner&&healthRandom(world)<.8/(.8+.5))startFoodBinge(world,pawn);else startSadWander(world,pawn);
    }
    return;
  }
  if(isMoodPool350(world.schemaVersion)){updateMoodPoolBreak350(world,pawn,level,budget);return;}
  // Availability is resolved before randomness. A deferred search is not an
  // empty catalogue and must not silently downgrade a major/extreme crisis.
  let options:{kind:MentalCrisisKind;weight:number;admission?:AggressiveCrisisAdmission}[]=[];
  for(let intensity=world.schemaVersion>=192?level:0;intensity>=0;intensity--) {
    if(intensity===0)options=pawn.prisoner?[{kind:'sad-wander',weight:.5}]:[{kind:'food-binge',weight:.8},{kind:'sad-wander',weight:.5}];
    else for(const kind of intensity===1?['tantrum'] as const:['berserk','murderous-rage'] as const) {
      const admission=aggressiveCrisisAdmission(world,pawn,kind,budget);
      if(admission===null)return;
      if(admission)options.push({kind,admission,weight:MENTAL_CRISIS_CATALOG[kind].weight*(kind==='murderous-rage'?murderousRageWeight(admission.population):1)});
    }
    if(intensity===1&&isSchema265OrLater(world.schemaVersion)&&!pawn.prisoner){const admission=alcoholBingeAdmission265(world,pawn,budget);if(admission===null)return;if(admission)options.push({kind:'drug-binge',weight:1});}
    if(options.length)break;
  }
  if(!options.length||healthRandom(world)>=150/(BREAK_MTB_DAYS[Math.max(0,level)]!*60000))return;
  let roll=healthRandom(world)*options.reduce((sum,c)=>sum+c.weight,0);
  const chosen=options.find(c=>(roll-=c.weight)<0)??options.at(-1)!;
  if(chosen.kind==='sad-wander'||chosen.kind==='food-binge')startMinorBreak(world,pawn,chosen.kind);
  else if(chosen.kind==='drug-binge')startAlcoholBinge265(world,pawn,budget,true);
  else startAggressiveBreak(world,pawn,chosen.kind as AggressiveCrisisKind,chosen.admission);
}
/** Schema 350: the same decision with Core's complete mood pool, each
 * intensity in the MentalBreakDef order (mental-breaks-350). */
function updateMoodPoolBreak350(world:World,pawn:Pawn,level:number,budget?:SearchBudget):void {
  type Option={kind:MentalCrisisKind;weight:number;admission?:AggressiveCrisisAdmission;pool?:MoodPoolAdmission350};
  let options:Option[]=[];
  for(let intensity=level;intensity>=0;intensity--) {
    if(intensity===0){const minor=minorPoolOptions350(world,pawn,budget);if(minor===null)return;options=onlyAllowedMinorBreaks361(pawn,minor.map(o=>({kind:o.kind,weight:o.weight,...o.admission?{pool:o.admission}:{}})));}
    else if(intensity===1){
      if(isSchema265OrLater(world.schemaVersion)&&!pawn.prisoner&&!traitForbidsDrugBinge361(pawn)){const admission=alcoholBingeAdmission265(world,pawn,budget);if(admission===null)return;if(admission)options.push({kind:'drug-binge',weight:drugBingeWeight361(pawn)});}
      if(psychoticWanderAdmitted350(pawn))options.push({kind:'psychotic-wander',weight:MENTAL_CRISIS_CATALOG['psychotic-wander'].weight});
      const admission=aggressiveCrisisAdmission(world,pawn,'tantrum',budget);if(admission===null)return;
      if(admission)options.push({kind:'tantrum',admission,weight:MENTAL_CRISIS_CATALOG.tantrum.weight});
    }else if(fireSpreeCanOccur368(world,pawn)){
      // Schema 368: Pyromaniac theOnlyAllowedMentalBreaks FireStartingSpree,
      // extreme: while it can occur, no other extreme break can.
      options.push({kind:'fire-starting-spree',weight:MENTAL_CRISIS_CATALOG['fire-starting-spree'].weight});
    }else for(const kind of ['berserk','murderous-rage'] as const){
      const admission=aggressiveCrisisAdmission(world,pawn,kind,budget);if(admission===null)return;
      if(admission)options.push({kind,admission,weight:MENTAL_CRISIS_CATALOG[kind].weight*(kind==='murderous-rage'?murderousRageWeight(admission.population):1)});
    }
    if(options.length)break;
  }
  if(!options.length||healthRandom(world)>=150/(BREAK_MTB_DAYS[Math.max(0,level)]!*60000))return;
  let roll=healthRandom(world)*options.reduce((sum,c)=>sum+c.weight,0);
  const chosen=options.find(c=>(roll-=c.weight)<0)??options.at(-1)!;
  if(chosen.kind==='sad-wander'||chosen.kind==='food-binge')startMinorBreak(world,pawn,chosen.kind);
  else if(chosen.kind==='drug-binge')startAlcoholBinge265(world,pawn,budget,true);
  else if(isMoodPoolCrisis350(chosen.kind))startMoodPoolBreak350(world,pawn,chosen.kind,chosen.pool);
  else if(chosen.kind==='fire-starting-spree')startFireStartingSpree368(world,pawn);
  else startAggressiveBreak(world,pawn,chosen.kind as AggressiveCrisisKind,chosen.admission);
}
/** A schema 350 break: the reason is drawn at commit, a spree's first target
 * right after it, both on the mental stream. */
export function startMoodPoolBreak350(world:World,pawn:Pawn,kind:MoodPoolCrisisKind350,admission?:MoodPoolAdmission350):boolean {
  if(!isMoodPool350(world.schemaVersion)||pawn.state==='downed'||moodFrozen(pawn)||pawn.mental?.crisis)return false;
  if(kind!=='psychotic-wander'&&(!isColonist(pawn)||pawn.prisoner))return false;
  if(kind==='wander-own-room'&&!admission?.root||(kind==='insulting-spree'||kind==='targeted-insulting-spree')&&!admission?.candidates?.length)return false;
  const crisis=newMoodPoolCrisis350(world,kind,admission);
  if(!commitBreak(world,pawn,crisis))return false;
  if(admission?.candidates)drawFirstInsultTarget350(world,pawn,crisis,admission.candidates);
  return true;
}

export function processMentalBreak(world:World,pawn:Pawn,context:NeedContext,candidatesReach:()=>Reachability|null):void {
  const crisis=pawn.mental?.crisis;if(!crisis)return;
  if(crisis.kind==='confused-wander'){processHumanConfusedWander256(world,pawn,context,candidatesReach);return;}
  collapseFromExhaustion(world,pawn,context);
  if(moodFrozen(pawn)&&!crisisKeptAsleep350(pawn)){finishMentalBreak(world,pawn);return;}
  retryInterruptedCargo(world,pawn);
  // Retained emergency cargo never doubles as an inventory. Walking may free a
  // legal drop; ordinary needs resume after the real deposit.
  if(!pawn.interruptedCargo&&processNeeds(world,pawn,context)) {
    // A depleted search budget can defer a need without starting it. Keep the
    // current wander route/target together until a real need replaces them.
    if(pawn.need){crisis.target=null;fireSpreeJobEnded368(pawn);}
    if(moodFrozen(pawn))finishMentalBreak(world,pawn);
    return;
  }
  if(crisis.kind==='drug-binge'&&!pawn.interruptedCargo&&processAutomaticAlcohol265(world,pawn,context)){crisis.target=null;return;}
  // Schema 350: a spree goes to insult its target; without one it wanders.
  if(isMoodPoolCrisis350(crisis.kind)&&!pawn.interruptedCargo&&processInsultingSpree350(world,pawn,context,candidatesReach))return;
  // Schema 368: the fire-starting spree's own jobs (fire-spree-368).
  // With retained cargo it wanders as the others until a legal drop.
  if(crisis.kind==='fire-starting-spree'){if(!pawn.interruptedCargo){processFireStartingSpree368(world,pawn,context,candidatesReach);return;}fireSpreeJobEnded368(pawn);}
  if(crisis.target) {
    if(!canStandAt(world,crisis.target)||reservedServiceCells(world,pawn.id).has(crisis.target.z*world.width+crisis.target.x)) {
      crisis.target=null;pawn.path=[];pawn.state='idle';crisis.waitUntil=world.tick+1;return;
    }
    // JobGiver_WanderOwnRoom waits 300 to 600 ticks, the other wanders 125 to 200.
    if(pawn.x===crisis.target.x&&pawn.z===crisis.target.z){crisis.target=null;pawn.path=[];pawn.state='idle';crisis.waitUntil=world.tick+(crisis.kind==='wander-own-room'?30+Math.floor(healthRandom(world)*31):(125+Math.floor(healthRandom(world)*76))/10);return;}
    context.move(crisis.target,true);
    if(pawn.state==='idle'&&!pawn.path.length){crisis.target=null;crisis.waitUntil=world.tick+20;}
    return;
  }
  pawn.state='idle';
  if(world.tick<crisis.waitUntil||pawn.planCooldown>0)return;
  // Pick a reachable stop, not an arbitrary point through solid cells. One
  // synchronous search, bounded local candidates, no per-frame navigation.
  const reach=candidatesReach();if(!reach)return;
  const reserved=reservedServiceCells(world,pawn.id),candidates=[];
  // Schema 350: hiding in one's room wanders around the bed, inside its room.
  const center=crisis.kind==='wander-own-room'?crisis.root:pawn,inRoom=crisis.kind==='wander-own-room'?ownRoomSpace350(world,crisis.root):undefined;
  for(let z=Math.max(0,center.z-7);z<=Math.min(world.height-1,center.z+7);z++)for(let x=Math.max(0,center.x-7);x<=Math.min(world.width-1,center.x+7);x++) {
    if((x-center.x)**2+(z-center.z)**2>49||x===pawn.x&&z===pawn.z||reserved.has(z*world.width+x)||!canStandAt(world,{x,z})||inRoom&&!inRoom(x,z))continue;
    if(hasReachableCell(reach,z*world.width+x))candidates.push({x,z});
  }
  if(!candidates.length){crisis.waitUntil=world.tick+20;return;}
  const dest=candidates[Math.floor(healthRandom(world)*candidates.length)]!;
  crisis.target={x:dest.x,z:dest.z};pawn.path=routeToCell(world,dest,reach)!;pawn.planCooldown=0;
  context.move(crisis.target,true);
}
export const processSadWander=processMentalBreak;
