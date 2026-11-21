import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,stationRecipes,recipeProduct} from '../src/sim/production-recipes.ts';
import {productionResearchUnlocked,productionWorkerQualified} from '../src/sim/machining.ts';
import {RESEARCH_SCALE,researchCost,researchPrerequisite,researchUnlocked} from '../src/sim/research.ts';
import {addGroundMaterial,addMaterial} from '../src/sim/materials.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {adoptFluIncidents,adoptImmuneDiseaseIncidents,resolveImmuneDiseaseIncident} from '../src/sim/flu-incidents.ts';
import {acquireImmuneDisease} from '../src/sim/immune-diseases-state.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {applyDrugPolicyCommand265,drugPolicyFor265,penoxycylinePolicyOf337,validDrugPolicyRegistry265} from '../src/sim/alcohol-policy-265.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {validPenoxycylineResearchTransport337} from '../src/sim/research-save.ts';
import {processScheduledPenoxycyline337} from '../src/sim/penoxycyline-intake-337.ts';
import {PENOXYCYLINE_DECREMENTS_337,PENOXYCYLINE_FACTS_337,DEFAULT_PENOXYCYLINE_POLICY_337,applyPenoxycylineDose337,
  penoxycylineActive337,penoxycylineImmuneTo337,scheduledPenoxycylineDue337,validPenoxycylineState337} from '../src/sim/penoxycyline-337.ts';
import {medicalCamp} from './scenarios/health.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema,asNumberOnly} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';
import type {NeedContext} from '../src/sim/needs.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {registeredMapPresentation} from '../src/sim/world-map-presentation.ts';

// Declared prepared scenes (research already learned, stocks laid on the
// ground); every dose, unit and disease check below goes through the real
// engine or the real incident resolver.
const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=4000){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
const doses=(w:World)=>w.piles.filter(p=>p.item==='penoxycyline').reduce((n,p)=>n+p.quantity,0);
const learned=(w:World,penoxycyline=true)=>{
  w.research={project:null,points:0,drugProduction:{points:researchCost('drug-production'),completedAt:0},
    ...(penoxycyline?{penoxycylineProduction:{points:researchCost('penoxycyline-production'),completedAt:0}}:{})};
};
function lab(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.priorities.research=1;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:8,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:4,xp:0,dailyXp:0,passion:0};
  const station={id:w.nextId++,kind:'drug-lab',x:10,z:10,orientation:0,footprint:'standard',material:'steel',bills:[]} as unknown as Structure;
  const desk={id:w.nextId++,kind:'research-bench',x:8,z:6,orientation:0,footprint:'standard',material:'wood'} as unknown as Structure;
  w.structures.push(station,desk);
  return {w,pawn,station};
}
/** One colonist assigned to a policy that schedules penoxycyline. */
function intake(frequency=5,units=3){
  const w=medicalCamp(),p=w.pawns[0]!;Object.assign(p,{x:3,z:5,hunger:90,rest:90});w.piles=[];
  addMaterial(w,'drug',units,{type:'ground',x:12,z:5},'penoxycyline');
  accept(w,{type:'drug-policy-update',policyId:1,penoxycyline337:{...DEFAULT_PENOXYCYLINE_POLICY_337,allowScheduled:true,daysFrequency:frequency}});
  expect(drugPolicyFor265(w,p).penoxycyline337).toMatchObject({allowScheduled:true,daysFrequency:frequency});
  expect(validateWorld(w)).toEqual([]);
  return {w,p};
}
const same=(w:World)=>{const copy=deserializeWorld(serializeWorld(w));expect(serializeWorld(copy)).toBe(serializeWorld(w));return copy;};
/** The public snapshot adopts the same state (marked task, held unit, record). */
function published(w:World){
  const publicWorld=w.worldMaps?registeredMapPresentation(w):w;if(!publicWorld)throw Error('No selected map');
  const expected=structuredClone(publicWorld),packet=new SnapshotDecoder().adopt(structuredClone(new SnapshotEncoder().encode(w,0,0,true)));
  expect(packet.status).toBe('applied');if(packet.status==='applied')expect(packet.world).toEqual(expected);
}

test('penoxycyline, its research and its two drug lab bills have the Core numbers',()=>{
  expect(ITEM_DEFINITIONS.penoxycyline).toMatchObject({label:'Pénoxycyline',kind:'drug',stackLimit:150,nutrition:0,maxIngest:1});
  expect(PENOXYCYLINE_FACTS_337).toMatchObject({baseMarketValue:18,massGrams:5,maxHitPoints:50,flammability:.7,ingestTicks:10});
  expect(PRODUCTION_RECIPES['make-penoxycyline']).toMatchObject({station:'drug-lab',work:'craft',inputs:['neutroamine'],units:2,workTicks:60,outputUnits:1});
  expect(PRODUCTION_RECIPES['make-penoxycyline-bulk']).toMatchObject({station:'drug-lab',work:'craft',inputs:['neutroamine'],units:8,workTicks:240,outputUnits:4});
  expect(stationRecipes({kind:'drug-lab'})).toEqual(['make-medicine','make-penoxycyline','make-penoxycyline-bulk']);
  expect(recipeProduct('make-penoxycyline',[{item:'neutroamine'}])).toBe('penoxycyline');
  expect(researchCost('penoxycyline-production')).toBe(500*RESEARCH_SCALE);
  // Severity 1.0, -0.18/day every 200 Core ticks (float32): 1667 decrements.
  expect(PENOXYCYLINE_DECREMENTS_337).toBe(1667);
  // Core's default policies keep it unscheduled every 1 day.
  const w=medicalCamp();for(const policy of w.drugPolicies!)expect(penoxycylinePolicyOf337(policy)).toEqual({allowScheduled:false,daysFrequency:1,onlyIfMoodBelow:1,onlyIfJoyBelow:1});
  // No skill requirement (MakeableDrugPillBase has none).
  const {pawn}=lab();pawn.skills.intellectual={level:0,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:0,xp:0,dailyXp:0,passion:0};
  expect(productionWorkerQualified(pawn,'make-penoxycyline')).toBe(true);
});

test('PenoxycylineProduction needs DrugProduction, then real desk work unlocks the bills',()=>{
  const {w,station}=lab();w.research={project:null,points:0};
  expect(researchPrerequisite(w,'penoxycyline-production')).toBe('Production de drogues');
  expect(productionResearchUnlocked(w,'make-penoxycyline')).toBe(false);
  expect(applyCommand(w,{type:'research-project',project:'penoxycyline-production'}).ok).toBe(false);
  expect(w.research).toEqual({project:null,points:0});
  learned(w,false);expect(validateWorld(w)).toEqual([]);
  // Refusals are atomic: no bill before the research is complete.
  const before=serializeWorld(w);
  expect(applyCommand(w,{type:'bill-add',structureId:station.id,recipe:'make-penoxycyline'}).ok).toBe(false);
  expect(serializeWorld(w)).toBe(before);
  expect(researchPrerequisite(w,'penoxycyline-production')).toBeUndefined();
  accept(w,{type:'research-project',project:'penoxycyline-production'});expect(w.research!.penoxycylineProduction).toEqual({points:0});
  until(w,()=>w.research!.penoxycylineProduction!.points>0,400);expect(validateWorld(w)).toEqual([]);
  // Declared shortcut to the last point, then the last real desk tick.
  w.research!.penoxycylineProduction!.points=researchCost('penoxycyline-production')-1;
  const resumed=same(w),start=w.tick;
  until(w,()=>researchUnlocked(w,'penoxycyline-production'),800);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  accept(w,{type:'bill-add',structureId:station.id,recipe:'make-penoxycyline'});
  accept(w,{type:'bill-add',structureId:station.id,recipe:'make-penoxycyline-bulk'});
  expect(validateWorld(w)).toEqual([]);
});

test('a crafter makes one penoxycyline from two real neutroamine at the drug lab; the work resumes exactly',()=>{
  const {w,pawn,station}=lab();learned(w);pawn.priorities.research=0;
  addGroundMaterial(w,'neutroamine',5,{x:13,z:12});expect(validateWorld(w)).toEqual([]);
  accept(w,{type:'bill-add',structureId:station.id,recipe:'make-penoxycyline'});
  until(w,()=>!!pawn.cooking&&pawn.cooking.phase==='work'&&(pawn.cooking.progress??0)>0);
  const resumed=same(w),start=w.tick;
  until(w,()=>doses(w)===1);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(w.piles.filter(p=>p.item==='neutroamine').reduce((n,p)=>n+p.quantity,0)).toBe(3);
  const made=w.piles.find(p=>p.item==='penoxycyline')!;expect(made.kind).toBe('drug');
  expect(validateWorld(w)).toEqual([]);
});

test('a scheduled colonist walks to the stack, takes one unit and gets PenoxycylineHigh for its Core duration',()=>{
  const {w,p}=intake();const start={x:p.x,z:p.z};
  until(w,()=>p.need?.kind==='eat'&&p.need.drugReason337==='scheduled');
  expect(p.need).toMatchObject({phase:'pickup',quantity:1});
  // Mid-intake save: the marked task and its reservation reload exactly.
  let copy=same(w);
  until(w,()=>p.need?.kind==='eat'&&p.need.phase==='ingest');
  const held=w.piles.find(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)!;
  expect(held).toMatchObject({item:'penoxycyline',kind:'drug',quantity:1});
  expect(doses(w)).toBe(3);copy=same(w);published(w);
  until(w,()=>!!p.health?.penoxycyline337,40);
  const startTick=w.tick;stepWorld(copy,w.tick-copy.tick);expect(serializeWorld(copy)).toBe(serializeWorld(w));
  expect(Math.abs(p.x-start.x)+Math.abs(p.z-start.z)).toBeGreaterThan(0);
  expect(doses(w)).toBe(2);expect(w.piles.some(q=>q.owner.type==='pawn')).toBe(false);
  const state=p.health!.penoxycyline337!;
  expect(state.dosesToday).toBe(1);expect(state.lastDoseCore).toBe(p.health!.tick*10);
  const span=state.untilCore-state.lastDoseCore;expect(span).toBeGreaterThan(1666*200);expect(span).toBeLessThanOrEqual(1667*200);
  expect(penoxycylineActive337(p.health,w.tick)).toBe(true);
  for(const disease of ['malaria','plague','sleeping-sickness'] as const)expect(penoxycylineImmuneTo337(p.health,w.tick,disease)).toBe(true);
  expect(w.events.some(e=>e.message.includes('pénoxycyline'))).toBe(true);
  expect(validateWorld(w)).toEqual([]);published(w);
  // Mid-effect save/reload, then a day later: no new dose before five days.
  const resumed=same(w);for(let i=0;i<6000;i++){stepWorld(w);stepWorld(resumed);}
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));expect(doses(w)).toBe(2);expect(w.tick-startTick).toBe(6000);
  // Protection ends with the last decrement on the clinical clock.
  expect(penoxycylineActive337(p.health,Math.floor(state.untilCore/10)-1)).toBe(true);
  expect(penoxycylineActive337(p.health,Math.ceil(state.untilCore/10)+1)).toBe(false);
});

test('drafting a colonist who holds the dose drops the same unit without any effect',()=>{
  const {w,p}=intake();
  until(w,()=>p.need?.kind==='eat'&&p.need.drugReason337==='scheduled'&&p.need.phase!=='pickup');
  const held=w.piles.find(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id)!;expect(held.item).toBe('penoxycyline');
  accept(w,{type:'draft',pawnIds:[p.id],enabled:true});
  until(w,()=>!p.need&&w.piles.every(q=>q.owner.type!=='pawn'),60);
  const dropped=w.piles.find(q=>q.id===held.id)!;
  expect(dropped.owner.type).toBe('ground');expect(dropped.quantity).toBe(1);
  expect(doses(w)).toBe(3);expect(p.health?.penoxycyline337).toBeUndefined();
  expect(validateWorld(w)).toEqual([]);same(w);
});

test('the schedule follows Core: first dose at once, then every N days at the daily appointment, own inventory first',()=>{
  const {w,p}=intake(5,4);const entry={...DEFAULT_PENOXYCYLINE_POLICY_337,allowScheduled:true,daysFrequency:5};
  expect(scheduledPenoxycylineDue337(w.tick,p,entry)).toBe(true);
  p.health=createMedicalRecord(w.tick);applyPenoxycylineDose337(p.health,p.id,w.tick);
  const day=Math.floor(w.tick/6000);
  for(const d of [0,1,4])for(const f of [0,1500,5999])expect(scheduledPenoxycylineDue337((day+d)*6000+f,p,entry)).toBe(false);
  const fifth=[...Array(6000).keys()].filter(f=>scheduledPenoxycylineDue337((day+5)*6000+f,p,entry));
  expect(fifth[0]).toBeGreaterThanOrEqual(600);expect(fifth[0]).toBeLessThanOrEqual(2100);expect(fifth.at(-1)).toBe(5999);
  // Twice a day (0.5): two doses at the 1/3 and 2/3 thresholds of the day.
  const twice={...entry,daysFrequency:.5},q=structuredClone(p);q.health=createMedicalRecord(day*6000);
  expect(scheduledPenoxycylineDue337(day*6000+100,q,twice)).toBe(true);
  applyPenoxycylineDose337(q.health,q.id,day*6000);q.health.tick=day*6000+2100;
  expect(scheduledPenoxycylineDue337(day*6000+1900,{...q,health:{...q.health,tick:day*6000+1900}},twice)).toBe(false);
  expect(scheduledPenoxycylineDue337(day*6000+4100,{...q,health:{...q.health,tick:day*6000+4100}},twice)).toBe(true);
  // Mood threshold: not taken while the mood is at or above it.
  expect(scheduledPenoxycylineDue337(w.tick,{...p,health:undefined,mood:60},{...entry,onlyIfMoodBelow:.5})).toBe(false);
  // Own inventory first: the unit is taken in place, without travel.
  p.health=undefined;const owned=w.piles[0]!;owned.quantity=3;
  addMaterial(w,'drug',1,{type:'inventory',pawnId:p.id},'penoxycyline');
  const context={search:()=>{throw Error('no search for an owned dose');},release:()=>true,move:()=>{},event:()=>{}} as unknown as NeedContext;
  expect(processScheduledPenoxycyline337(w,p,context)).toBe(true);
  const source=w.piles.find(q=>q.owner.type==='inventory')!;
  expect(p.need).toMatchObject({kind:'eat',drugReason337:'scheduled',sourcePileId:source.id});expect(p.path).toEqual([]);
  until(w,()=>!!p.health?.penoxycyline337,60);
  expect(w.piles.some(q=>q.owner.type==='inventory')).toBe(false);expect(doses(w)).toBe(3);
  expect(validateWorld(w)).toEqual([]);
});

function diseaseColony(){
  const w=deconstructionCamp(1);w.gameProfile=crashlandedProfile();adoptFluIncidents(w);w.tick=Math.max(w.tick,1);adoptImmuneDiseaseIncidents(w);
  return {w,p:w.pawns[0]!,state:w.fluIncidents!.immuneDiseases!};
}
for(const disease of ['plague','sleeping-sickness'] as const)test(`a protected colonist is not infected by ${disease}, with the same random draws, and is again once the effect ends`,()=>{
  const free=diseaseColony(),guarded=diseaseColony(),sick=diseaseColony();
  guarded.p.health=createMedicalRecord(guarded.w.tick);applyPenoxycylineDose337(guarded.p.health,guarded.p.id,guarded.w.tick);
  sick.p.health=createMedicalRecord(sick.w.tick);acquireImmuneDisease(sick.p.health,disease,1_000_000);
  expect(resolveImmuneDiseaseIncident(free.w,disease)).toBe(1);
  expect(resolveImmuneDiseaseIncident(guarded.w,disease)).toBe(0);
  expect(resolveImmuneDiseaseIncident(sick.w,disease)).toBe(0);
  // The contract roll is drawn as for an already infected colonist.
  expect(guarded.state.rng).toBe(sick.state.rng);expect(guarded.p.health.immuneDiseases).toBeUndefined();
  expect(guarded.w.events.at(-1)?.message).toContain('bloqué par la pénoxycyline');
  // After the last decrement, the same draw infects.
  const after=diseaseColony();after.p.health=createMedicalRecord(after.w.tick);applyPenoxycylineDose337(after.p.health,after.p.id,after.w.tick);
  after.w.tick+=Math.ceil((after.p.health.penoxycyline337!.untilCore-after.p.health.tick*10)/10);
  expect(penoxycylineActive337(after.p.health,after.w.tick)).toBe(false);
  expect(resolveImmuneDiseaseIncident(after.w,disease)).toBe(1);
  expect(after.p.health.immuneDiseases?.[disease]?.severity).toBeGreaterThan(0);
});

test('a dose does not cure an existing infection',()=>{
  const {w,p}=diseaseColony();p.health=createMedicalRecord(w.tick);expect(acquireImmuneDisease(p.health,'plague',1_000_000)).toBe(true);
  const before=structuredClone(p.health.immuneDiseases);applyPenoxycylineDose337(p.health,p.id,w.tick);
  expect(p.health.immuneDiseases).toEqual(before);expect(penoxycylineActive337(p.health,w.tick)).toBe(true);
});

test('before schema 337 the item, its kind, recipes, research, policy entry and clinical record are refused',()=>{
  const old=336;
  expect(validTuqueCatalogueTransport({piles:[{item:'penoxycyline'}]},old)).toBe(false);
  expect(validTuqueCatalogueTransport({bills:[{recipe:'make-penoxycyline-bulk'}]},old)).toBe(false);
  expect(validTuqueCatalogueTransport({filters:{drug:true}},old)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'penoxycyline'}]},SCHEMA_VERSION)).toBe(true);
  const {w,p}=intake();
  expect(validatePileRecordShape(w.piles[0] as unknown as Record<string,unknown>,w,old).length).toBeGreaterThan(0);
  expect(validDrugPolicyRegistry265(w.drugPolicies,w.nextDrugPolicyId,old)).toBe(false);
  expect(validDrugPolicyRegistry265(w.drugPolicies,w.nextDrugPolicyId,SCHEMA_VERSION)).toBe(true);
  p.health=createMedicalRecord(w.tick);applyPenoxycylineDose337(p.health,p.id,w.tick);
  expect(validPenoxycylineState337(p.health.penoxycyline337,old,p.health)).toBe(false);
  expect(validPenoxycylineState337({...p.health.penoxycyline337,untilCore:p.health.penoxycyline337!.lastDoseCore+10},SCHEMA_VERSION,p.health)).toBe(false);
  learned(w);expect(validPenoxycylineResearchTransport337(w,old)).toBe(false);expect(validPenoxycylineResearchTransport337(w,SCHEMA_VERSION)).toBe(true);
  // A save carrying any of it under the old number fails to load.
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(w),old))).toThrow();
  // Commands of an older world cannot create the entry, and nothing is taken.
  const legacy=medicalCamp();legacy.schemaVersion=old as typeof legacy.schemaVersion;
  expect(applyDrugPolicyCommand265(legacy,{type:'drug-policy-update',policyId:1,penoxycyline337:{...DEFAULT_PENOXYCYLINE_POLICY_337,allowScheduled:true}})).not.toBeNull();
  const context={search:()=>null,release:()=>true,move:()=>{},event:()=>{}} as unknown as NeedContext;
  expect(processScheduledPenoxycyline337(legacy,legacy.pawns[0]!,context)).toBe(false);
});

test('a schema 336 save migrates to 337 by its number only, without any dose, research or entry',()=>{
  const camp=medicalCamp(),current=serializeWorld(camp);
  const migrated=deserializeWorld(asOldSchema(current,336));
  expect(serializeWorld(migrated)).toBe(asNumberOnly(current,336));
  expect(migrated.drugPolicies!.every(p=>!Object.hasOwn(p,'penoxycyline337'))).toBe(true);
  expect(migrated.pawns.every(p=>!p.health?.penoxycyline337)).toBe(true);
  const {w}=lab();learned(w,false);const labSave=serializeWorld(w);
  expect(serializeWorld(deserializeWorld(asOldSchema(labSave,336)))).toBe(asNumberOnly(labSave,336));
});
