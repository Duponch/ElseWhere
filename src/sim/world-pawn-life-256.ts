import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {worldPawnPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {medicalCivilTick271,medicalElapsedTicks271} from './suspended-human-clock-271.ts';
import {markCorpseWornApparel284} from './apparel-provenance-284.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {cancelAlcoholSpatial265} from './alcohol-state-265.ts';
import {advanceScariaRecord261,commitScariaDeath261} from './animal-scaria-261.ts';
import {advanceOffmapThermal259,offmapThermalRange259,WORLD_PAWN_NO_HOLDER_TEMPERATURE_259} from './offmap-thermal-259.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {advanceMechanicalWorldPawn259} from './world-pawn-mechanical-259.ts';
import {validSuspendedWorldPawnGoods259} from './world-pawn-held-259.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256,orderedWorldPawnRows256} from './world-pawn-native-order-256.ts';
import {destroyNativeWorldPawnOrder256,mothballNativeWorldPawnOrder256} from './native-world-pawn-order-256.ts';
import {advanceWorldPawnEggLayer256,worldPawnEggBoundary256,worldPawnEggIntervalBoundary256} from './world-pawn-egg-comp-256.ts';
import {humanConditionMedicalFrontier256} from './human-condition-frontier-256.ts';
import {commitToxicDeath256} from './toxic-buildup-256.ts';
import {worldPawnAnimalConditionFrontier256} from './animal-condition-medical-frontier-256.ts';
import {applyLiveAnimalBirthday256} from './animal-live-birthday-256.ts';
import {healthRandom} from './health.ts';
import {tickSkillsAt} from './skills.ts';
import {expireMealMemoriesAt} from './mood.ts';
import {expireSocialMemories} from './social-state.ts';
import {expireMentalCatharsisAt} from './mental-state.ts';
import {advanceTrackedAnimalAge256,synchronizeAnimalGrowthMedical256} from './animal-growth-runtime-256.ts';
import {animalGrowthFactor,animalNutritionMax} from './animal-life.ts';
import {INITIAL_ANIMAL_FACTS_256} from './initial-animal-data-256.ts';
import {advanceHumanAgeAt} from './human-age.ts';
import {advanceMedical} from './injury-evolution.ts';
import {medicalStatus,freshMissing,createMedicalRecord} from './injury-state.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {autoTendWorldPawn256} from './world-pawn-auto-tend-256.ts';
import {terminalWorldPawn256,mutableWorldPawnOriginal256,type WorldPawnOwner256,type WorldPawnsState256} from './world-pawn-state-256.ts';
const f=Math.fround,year=3600000,facts=new Map(Object.values(INITIAL_ANIMAL_FACTS_256).map(r=>[r.species,r]));
export type WorldPawnLifeResult256={ok:true}|{ok:false;reason:string};
/** Exact supported permanent dossiers; other defs need their REAL mothball
 * flags before they may freeze. Unknown is not converted into false/healthy. */
export function worldPawnMothballReadiness256(row:WorldPawnOwner256):'yes'|'blocked'{
 if(row.kind!=='animal'||row.actor.pregnancy)return 'blocked';
 const h=row.actor.health;if(!h)return 'yes';
 if(h.bloodLoss||h.injuries.some(i=>i.scar?.pain===undefined)||h.missing.some(m=>freshMissing(h,m)))return 'blocked';
 const allowed=new Set(['tick','nextInjuryId','injuries','missing','bloodLoss','body','animalBirthTick','animalGrowth','death']);
 return Object.keys(h).some(k=>!allowed.has(k))?'blocked':'yes';
}
function animalAge(row:Extract<WorldPawnOwner256,{kind:'animal'}>,toCore:number,mothball:boolean,random:()=>number,provisionalMothball263=false):WorldPawnLifeResult256 {
 const a=row.actor,delta=toCore-row.clockCore,before=a.ageTicks*10+(a.ageCoreRemainder??0),after=before+delta;
 if(!Number.isSafeInteger(after)||delta<0)return {ok:false,reason:'World animal age exhausted'};
 if(!provisionalMothball263&&Math.floor(before/year)!==Math.floor(after/year)&&(mothball||!a.wander))return {ok:false,reason:'Actual mothball birthday sequence or historical mind is not represented'};
 if(!mothball){if(a.growthTracker)advanceTrackedAnimalAge256(a,{atCore:toCore,deltaCore:delta,hungerMultiplier:animalGrowthFactor(a),suspended:false});else a.ageTicks+=delta/10;}
 else {
  const g=a.growthTracker;
  if(g){const fact=facts.get(a.species);if(!fact)return {ok:false,reason:'Missing real animal age definition'};
   if(g.value>=1)g.nextCheckCore=null;else{const adult=Math.max(Math.floor(f(f(fact.stages.at(-1)!.minAgeYears)*year)),1);g.value=Math.min(1,f(g.value+f(f(f(animalGrowthFactor(a))*f(delta))/f(adult))));g.nextCheckCore=toCore+240;}}
  a.ageTicks=Math.floor(after/10);if(a.ageCoreRemainder!==undefined)a.ageCoreRemainder=after%10;synchronizeAnimalGrowthMedical256(a);
 }
 if(!mothball)applyLiveAnimalBirthday256({schemaVersion:256,tick:toCore/10},a,before,random);
 return {ok:true};
}
/** Existing active-owner frontiers, also checked BEFORE a MapRemoved commit.
 * This reads actual fields; it does not run a future clinical tick or trial. */
export function worldPawnActiveBoundary256(row:WorldPawnOwner256,version=256,atCore=isCorePhysicalSchema297(version)?worldPawnPhysicalCore297(row,version):row.clockCore):string|null {
 if(terminalWorldPawn256(row)||row.mode==='mothballed')return null;
 if(row.items.length||row.packed.length){if((version!==259&&version!==260&&(version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))))return 'Actual off-map item/gear ticking requires its retained-holder adapter';if(!validSuspendedWorldPawnGoods259(row,atCore,version))return 'Actual suspended item holder/frontier is not admitted';}
 if(row.kind==='mechanical')return (version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version)))))&&row.items.length===0&&row.packed.length===0?null:'Mechanical WorldPawn owner is not admitted';
 if(row.kind==='animal'){
  if(row.actor.pregnancy)return 'Actual off-map pregnancy requires miscarriage and newborn WorldPawn-owner adapters';
  const egg=worldPawnEggBoundary256(row.actor,worldPawnMothballReadiness256(row)==='yes');if(egg)return egg;
 }
 if((version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version)))))){const range=offmapThermalRange259(row.actor,row.items);if(typeof range==='string')return range;}
 else if(row.actor.health?.heatstroke||row.actor.health?.hypothermia)return 'Actual off-map thermal hediff owner is not bound';
 return null;
}
/** Pure preparation on an ACTUAL row projection; caller commits originals only
 * after every row succeeded. Free needs are frozen by current Need.IsFrozen. */
export function advanceWorldPawnRow256(row:WorldPawnOwner256,toCore:number,random:()=>number,notices:string[]=[],version=256,scariaRotChance?:number):WorldPawnLifeResult256 {
 return advancePreparedWorldPawnRow256(row,toCore,random,notices,version,scariaRotChance);
}
/** Private campaign preparation only. The exported row/removal paths remain
 * strict; this switch cannot be supplied by a save or presentation consumer. */
function advancePreparedWorldPawnRow256(row:WorldPawnOwner256,toCore:number,random:()=>number,notices:string[],version:number,scariaRotChance?:number,provisionalMothball263=false,advanceFirefoam=true):WorldPawnLifeResult256 {
 if(terminalWorldPawn256(row))return {ok:true};
 if(toCore<row.clockCore||toCore%10)return {ok:false,reason:'Invalid WorldPawn personal clock'};
 const delta=toCore-row.clockCore;if(!delta)return {ok:true};
 if(row.kind==='mechanical'){const reason=(version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version)))))?advanceMechanicalWorldPawn259(row,toCore,advanceFirefoam,version):'Future mechanical WorldPawn';return reason?{ok:false,reason}:{ok:true};}
 const mothball=row.mode==='mothballed';
 const activeBoundary=worldPawnActiveBoundary256(row,version,toCore);if(activeBoundary)return {ok:false,reason:activeBoundary};
 if(row.kind==='animal'){
  if(!mothball){const interval=worldPawnEggIntervalBoundary256(row.actor,row.clockCore,toCore);if(interval)return {ok:false,reason:interval};advanceWorldPawnEggLayer256(row.actor,row.clockCore,toCore);}
  const age=animalAge(row,toCore,mothball,random,provisionalMothball263);if(!age.ok)return age;
 }
 else {
  if(mothball)return {ok:false,reason:'Human AgeTickMothballed requires actual records/birthday binding'};
  if(delta!==10)return {ok:false,reason:'World human active interval skipped'};
  advanceHumanAgeAt(row.actor,{tick:toCore/10,schemaVersion:256,random,notice:message=>notices.push(message)});
  tickSkillsAt(row.actor,toCore/10);expireMealMemoriesAt(row.actor,toCore/10);expireSocialMemories(row.actor,toCore/10);expireMentalCatharsisAt(row.actor,toCore/10);
 }
 const a=row.actor;let h=a.health;
 if(!mothball&&h){
  cancelAlcoholSpatial265(h);
  if(medicalCivilTick271(h)!==row.clockCore/10&&medicalCivilTick271(h)!==toCore/10)return {ok:false,reason:'WorldPawn clinical clock skipped'};
  const medicalContext={civilTick:toCore/10,cryptosleepSicknessSpawned:false,...h.alcohol?{alcoholOwner:{id:a.id,spawned:false,awake:a.state!=='sleeping',chemicalNeedFrozen:true}}:{},...h.toxicBuildup?{toxicOwner:{id:a.id,spawned:false,awake:a.state!=='sleeping'}}:{},phase:a.id%60,posture:'standing' as const,starving:row.kind==='animal'?row.actor.food<=0:row.actor.hunger<=0,hunger:row.kind==='animal'?row.actor.food/animalNutritionMax(row.actor)*100:row.actor.hunger,rest:row.kind==='animal'?row.actor.rest*100:row.actor.rest,infectionSeed:(row.context.seed^Math.imul(a.id,0x9e3779b1))>>>0};
  const frontier=row.kind==='animal'?worldPawnAnimalConditionFrontier256(row.actor,h,random):humanConditionMedicalFrontier256(row.actor,h,toCore/10,random,{kind:'world-pawn'});
  if((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&row.kind==='animal')advanceScariaRecord261(h,toCore,row.actor.manhunter?.permanent261===true);
  advanceMedical(h,medicalElapsedTicks271(h,toCore/10),medicalContext,random,frontier);frontier?.commit();
 }
 if(!mothball&&(version===259||version===260||(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))))advanceOffmapThermal259(a,row.items,toCore,WORLD_PAWN_NO_HOLDER_TEMPERATURE_259,()=>row.kind==='animal'?createAnimalMedicalRecord256({schemaVersion:version,tick:toCore/10},row.actor,toCore/10):createMedicalRecord(toCore/10));
 h=a.health;
 if(!mothball&&h){const status=medicalStatus(h);if(status==='dead'){commitToxicDeath256(h,random);if(row.kind==='animal'){commitScariaDeath261(h,scariaRotChance,random);delete row.actor.manhunter;}a.state='dead';if(row.kind==='human')markCorpseWornApparel284(row.items,row.actor,version);row.mode='dead';delete row.free;row.clockCore=h.death!.tick*10;return {ok:true};}a.state=status==='downed'?'downed':'idle';
 }
 row.clockCore=toCore;
 if(!mothball&&h&&groupPawnInterval256(a.id,toCore,7500,Math.min(delta,10)))autoTendWorldPawn256(h,Number(version),random);
 return {ok:true};
}
/** Same declared current263 animal adaptation at campaign life and the
 * existing removal remainder. Neither a save flag nor a new animal cohort. */
function provisionalAnimalMothball263(row:WorldPawnOwner256,version:number,nativeOrder:WorldPawnsState256['nativeOrder']):boolean {
 return isSchema263OrLater(version)&&!nativeOrder&&row.kind==='animal'&&row.mode==='mothballed'&&row.actor.wander?.revision===1&&row.actor.growthTracker?.revision===1&&worldPawnMothballReadiness256(row)==='yes';
}
/** The redress caller has already checked its actual Free neutral owner and
 * clinical frontier. Only its existing Food/Rest reset may precede removal;
 * the clone cannot replace age, mind, health, history, items or provenance. */
function redressedRemovalClone263(row:WorldPawnOwner256,original:WorldPawnOwner256):boolean {
 if(row.kind!=='animal'||original.kind!=='animal'||row.actor.id!==original.actor.id||row.clockCore!==original.clockCore||row.mode!==original.mode)return false;
 return JSON.stringify({...row,actor:{...row.actor,food:original.actor.food,rest:original.actor.rest}})===JSON.stringify(original);
}
/** Existing Mothball removal remainder, no health catch-up/healing. */
export function prepareWorldPawnRemoval256(row:WorldPawnOwner256,atCore:number,authority?:{version:number;state:WorldPawnsState256;original:WorldPawnOwner256}):{ok:true;draft:WorldPawnOwner256}|{ok:false;reason:string}{
 if(authority&&(!isSchema263OrLater(authority.version)||authority.state.atCore!==atCore||!nativeWorldPawnOrderCurrent256(authority.state,authority.state.nativeOrder)||!authority.state.owners.includes(authority.original)||!redressedRemovalClone263(row,authority.original)))return {ok:false,reason:'Current263 removal requires its actual unchanged original and only the existing Food/Rest reset'};
 const draft=structuredClone(row);
 if(draft.mode==='mothballed'){
  if(worldPawnMothballReadiness256(draft)!=='yes')return {ok:false,reason:'Unclosed real mothball hediff flags'};
  const result=authority?advancePreparedWorldPawnRow256(draft,atCore,()=>{throw Error('Unexpected mothball RNG');},[],authority.version,undefined,provisionalAnimalMothball263(draft,authority.version,authority.state.nativeOrder)):advanceWorldPawnRow256(draft,atCore,()=>{throw Error('Unexpected mothball RNG');});if(!result.ok)return result;
  // Only permanent supported records can cross observation without ticking
  // health; their severity/tend/blood remain byte-identical.
  if(draft.actor.health)draft.actor.health.tick=atCore/10;
 }
 return {ok:true,draft};
}
/** Transaction preparation only; does not clone geography or any map. */
export function prepareWorldPawnLife256(state:WorldPawnsState256,atCore:number,randomOwner:{rng:number;gameProfile?:import('./game-profile.ts').GameProfile},version=256,firefoamActiveIds?:ReadonlySet<number>):{ok:true;notices:readonly string[];deceasedHumanIds:readonly number[];commit():void}|{ok:false;reason:string}{
 const nativeBefore=state.nativeOrder;if(!nativeWorldPawnOrderCurrent256(state,nativeBefore))return {ok:false,reason:'Actual native life order is not mutable/admitted'};
 let nativeAfter=nativeBefore;
 if(atCore!==state.atCore+10)return {ok:false,reason:'WorldPawn runtime requires the next actual local frontier'};
 const rngBefore=randomOwner.rng,randomState={rng:rngBefore},random=()=>healthRandom(randomState);
 if(!Object.getOwnPropertyDescriptor(state,'atCore')?.writable||!Object.getOwnPropertyDescriptor(randomOwner,'rng')?.writable||state.owners.some(row=>row.mode!=='dead'&&(!mutableWorldPawnOriginal256(row.actor)||!Object.getOwnPropertyDescriptor(row,'clockCore')?.writable||!Object.getOwnPropertyDescriptor(row,'mode')?.writable)))return {ok:false,reason:'WorldPawn life requires mutable actual worker owners'};
 const notices:string[]=[];
 const atBefore=state.atCore,membership=state.owners.slice(),pairs=orderedWorldPawnRows256(state).filter(r=>r.mode!=='dead'&&(r.mode!=='mothballed'||atCore%15000===0)).map(row=>({row,before:JSON.stringify(row),draft:structuredClone(row)}));
 // Preflight every coupled interval before changing even an earlier PRIVATE
 // row outcome or consuming a birthday trial. Original/RNG adoption is later.
 for(const {draft} of pairs)if(draft.kind==='animal'&&draft.mode==='active'&&atCore>draft.clockCore){const interval=worldPawnEggIntervalBoundary256(draft.actor,draft.clockCore,atCore);if(interval)return {ok:false,reason:interval};}
 // ADAPTER: current provisional263 animal producer, explicitly not native
 // birthday/mind parity (human ruling17Oct). Keep its existing age/growth
 // arithmetic, frozen real clinical dossier and zero mothball birthday draws.
 // A true native order or an absent actual mind/tracker retains the old guard.
 for(const {draft} of pairs){
  const provisionalMothball263=provisionalAnimalMothball263(draft,version,nativeBefore);
  const result=advancePreparedWorldPawnRow256(draft,atCore,random,notices,version,randomOwner.gameProfile?.difficulty==='adventure-story'?.333:undefined,provisionalMothball263,!firefoamActiveIds||firefoamActiveIds.has(draft.actor.id));if(!result.ok)return result;
 }
 const deceasedHumanIds:number[]=[];
 for(const {row,draft} of pairs)if(row.mode!=='dead'&&draft.mode==='dead'){
  if(nativeAfter)nativeAfter=destroyNativeWorldPawnOrder256(nativeAfter,row.actor.id);
  if(row.kind==='human'&&row.actor.state!=='dead'&&!row.actor.health?.death&&(draft.actor.state==='dead'||draft.actor.health?.death))deceasedHumanIds.push(row.actor.id);
 }
 if(atCore%15000===0)for(const {draft} of pairs)if(draft.mode==='active'&&worldPawnMothballReadiness256(draft)==='yes'){if(nativeAfter)nativeAfter=mothballNativeWorldPawnOrder256(nativeAfter,draft.actor.id);draft.mode='mothballed';}
 // True clinical death removes the durable Free authority with the same actor.
 // Check its actual recipient before adoption, including a seal after preparation.
 const canAdoptFree=()=>pairs.every(({row,draft})=>!Object.hasOwn(row,'free')||Object.hasOwn(draft,'free')||Object.getOwnPropertyDescriptor(row,'free')?.configurable===true);
 if(!canAdoptFree())return {ok:false,reason:'WorldPawn death requires its deletable actual Free authority'};
 // Unsupported true hediff flags stay ACTIVE conservatively. This does not
 // certify their native mothball eligibility or silently suspend them.
 let used=false;return {ok:true,notices:Object.freeze(notices.slice()),deceasedHumanIds:Object.freeze(deceasedHumanIds),commit(){if(used||!nativeWorldPawnOrderCurrent256(state,nativeBefore)||state.atCore!==atBefore||state.owners.length!==membership.length||state.owners.some((r,i)=>r!==membership[i])||pairs.some(p=>JSON.stringify(p.row)!==p.before)||randomOwner.rng!==rngBefore||!canAdoptFree())throw Error('Stale WorldPawn life transaction');used=true;
  for(const {row,draft:d} of pairs){if(isCorePhysicalSchema297(version)&&Object.hasOwn(row,'physicalClockCore297'))d.physicalClockCore297=d.clockCore;const prisoner=row.kind==='human'?row.actor.prisoner:undefined,history=row.kind==='human'?row.actor.prisonerHistory259:undefined;for(const k of Object.keys(row.actor))delete (row.actor as unknown as Record<string,unknown>)[k];Object.assign(row.actor,d.actor);if(row.kind==='human'){if(prisoner)row.actor.prisoner=prisoner;if(history)row.actor.prisonerHistory259=history;}row.clockCore=d.clockCore;if(isCorePhysicalSchema297(version)&&Object.hasOwn(d,'physicalClockCore297'))row.physicalClockCore297=d.physicalClockCore297;row.mode=d.mode;if(!Object.hasOwn(d,'free'))delete row.free;}
  commitNativeWorldPawnOrder256(state,nativeBefore,nativeAfter);state.atCore=atCore;randomOwner.rng=randomState.rng;
 }};
}
