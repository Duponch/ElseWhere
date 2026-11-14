import { createWoodLedger,readWoodLedger,trackWoodStep,conservedWood,type WoodLedger } from './scenarios/wood-conservation.ts';
import {createRepairLedger,readRepairLedger,trackMaintenanceStep,type RepairLedger} from './scenarios/repair-conservation.ts';
import { writeTestFileSync } from './test-output.ts';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect,onTestFailed,test } from 'vitest';
import { applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld } from '../src/sim/index.ts';
import { isColonist } from '../src/sim/affiliation.ts';
import { foodAccount,woodAccount } from './scenarios/colony-player.ts';
import { metalAccount,type EnergyPlayerState } from './scenarios/energy-player.ts';
import { newPrisonPlayer,observePrison,prisonDecisions,prisonPlan,prisonSummary,prisonWoodDecisions,type PrisonPlayerState } from './scenarios/prison-player.ts';
import { crashlandedThreatActive } from './scenarios/crashlanded-player.ts';
import { survivorPlan } from './scenarios/survivor-player.ts';
import { blockedCells,reachableCells,routeToJob } from '../src/sim/pathfinding.ts';
import type { Command,World } from '../src/sim/types.ts';
import { ITEM_DEFINITIONS,type ItemId } from '../src/sim/items.ts';
/** Item opened by a resource pod event, from its label, with its quantity. */
const podDelivery=(message:string):{item:ItemId;quantity:number}|undefined=>{
  const match=message.match(/^Les capsules se sont ouvertes : (\d+) × (.+) à récupérer/);if(!match)return undefined;
  const item=(Object.keys(ITEM_DEFINITIONS) as ItemId[]).find(id=>ITEM_DEFINITIONS[id].label===match[2]);
  expect(item,message).toBeDefined();return {item:item!,quantity:Number(match[1])};
};

// Project-owned Lisière world from the published V85 energy continuation.
// gzip stores precisely those bytes; this is not a private RimWorld save.
const fixtureBytes=gunzipSync(readFileSync('tests/fixtures/colony-v85.json.gz'));
const fixtureHash=createHash('sha256').update(fixtureBytes).digest('hex');
const expectedFixtureHash='514086e50ea7a571dbdc8e5540e5c9cdcaa8113cc3dba51a7e06d69df1611fa3';
const energyReport=JSON.parse(readFileSync('artifacts/energy-colony-v85.json','utf8')) as {player:EnergyPlayerState};
const loadFixture=()=>deserializeWorld(fixtureBytes.toString('utf8'));
interface Ledger {consumed:number;harvested:number;cooked:number;steelMined:number;componentsMined:number;medicineConsumed:number;meals:Record<number,number>;mealsByStation:Record<string,number>;
  /** Resource pods (schema 305) deliver goods from outside the colony. */
  podSteel?:number;podComponents?:number;podFood?:number}
interface Checkpoint { woodLedger:WoodLedger;repairLedger:RepairLedger;
  protocol:'prison-v86';fixtureHash:string;world:string;player:PrisonPlayerState;ledger:Ledger;
  initial:{wood:number;food:number;animalEaten:number;steel:number;component:number;medicine:number};
  journal:{tick:number;reason:string;command:Command}[];observations:ReturnType<typeof prisonSummary>[];
}
const medicines=(w:World)=>w.piles.filter(p=>p.kind==='medicine').reduce((n,p)=>n+p.quantity,0);
// `foodAccount` deliberately ignores food owned by non-colonists so hostile
// inventories and visitor provisions do not enter the colony ledger. A captive
// can nevertheless pick up a meal from their prison room and hold its split
// pile during the physical travel/ingest phases. Until ingestion publishes its
// event, that exact colony unit is still conserved and must bridge the ledger.
const captiveMealInTransit=(w:World)=>w.pawns.reduce((total,pawn)=>{
  const need=pawn.prisoner&&pawn.need?.kind==='eat'?pawn.need:undefined;
  if(!need||need.carryPileId===null)return total;
  const pile=w.piles.find(candidate=>candidate.id===need.carryPileId&&candidate.kind==='food'&&candidate.owner.type==='pawn'&&candidate.owner.pawnId===pawn.id);
  return total+(pile?.quantity??0);
},0);

// The two preflights load and replay the real day-42 fixture: well over the
// default 30 s on a busy machine, so they carry their own limit.
test('Prison : préflight du réapprovisionnement au-delà de la clairière épuisée, sans injection',()=>{
  const w=loadFixture(),player=newPrisonPlayer(w,energyReport.player),before=serializeWorld(w),wood=woodAccount(w),resources=structuredClone(w.resources);
  expect(w.piles.filter(p=>p.item==='wood')).toEqual([]);
  expect(w.resources.some(r=>r.kind==='tree'&&Math.hypot(r.x-player.campAnchor.x,r.z-player.campAnchor.z)<=25)).toBe(false);
  const decisions=prisonDecisions(w,player),cuts=decisions.filter(d=>d.command.type==='designate'&&d.command.kind==='chop');
  expect(serializeWorld(w)).toBe(before);expect(cuts.length).toBeGreaterThan(0);expect(cuts.length).toBeLessThanOrEqual(6);
  const reach=reachableCells(w,w.pawns.find(isColonist)!,blockedCells(w),new Set());
  for(const d of cuts){
    const c=d.command;if(c.type!=='designate')throw Error('Tree designation required.');
    expect(Math.hypot(c.x-player.campAnchor.x,c.z-player.campAnchor.z)).toBeGreaterThan(25);
    expect(w.resources.some(r=>r.kind==='tree'&&r.x===c.x&&r.z===c.z)).toBe(true);
    expect(routeToJob(w,c,reach)).not.toBeNull();
  }
  for(const d of decisions)expect(applyCommand(w,d.command),JSON.stringify(d)).toMatchObject({ok:true});
  const supply=prisonSummary(w,player).wood;
  expect(supply.missingConstruction).toBeGreaterThanOrEqual(145);expect(supply.target-supply.missingConstruction).toBe(160);
  expect(supply.pendingCuts).toBe(cuts.length);expect(supply.pendingYield).toBeGreaterThan(0);
  expect(prisonWoodDecisions(w,player.campAnchor)).toEqual([]); // Existing cuts count before another batch.
  expect(w.resources).toEqual(resources);expect(woodAccount(w)).toBe(wood);expect(validateWorld(w)).toEqual([]);
},180_000);

// Central runner selects this bounded preflight before scheduling the long test.
test('Prison : préflight de continuation V85, prison ordinaire et carnet sans injection',()=>{
  expect(fixtureHash).toBe(expectedFixtureHash);
  expect(JSON.parse(fixtureBytes.toString('utf8')).schemaVersion).toBe(85);
  const w=loadFixture(),before=serializeWorld(w),player=newPrisonPlayer(w,energyReport.player),decisions=prisonDecisions(w,player),plan=prisonPlan(player);
  expect(w.tick).toBe(253280);expect(w.scenario?.id).toBe('crashlanded');expect(w.pawns.filter(isColonist)).toHaveLength(3);
  expect(serializeWorld(w)).toBe(before);expect(plan.origin.z).toBeGreaterThan(player.campAnchor.z);
  expect(decisions.some(d=>d.command.type==='designate'&&d.command.kind==='bed'&&d.command.orientation===2)).toBe(true);
  expect(decisions.some(d=>d.command.type==='priority'&&d.command.work==='warden')).toBe(true);
  for(const d of decisions){const result=applyCommand(w,d.command);expect(result,JSON.stringify({tick:w.tick,...d,result})).toMatchObject({ok:true});}
  expect(survivorPlan(w,true).anchor).toEqual(player.campAnchor);expect(validateWorld(w)).toEqual([]);
  stepWorld(w,250);observePrison(w,player);
  for(const d of prisonDecisions(w,player)){const result=applyCommand(w,d.command);expect(result,JSON.stringify({tick:w.tick,...d,result})).toMatchObject({ok:true});}
  const copy=deserializeWorld(serializeWorld(w));stepWorld(w,120);stepWorld(copy,120);
  expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(validateWorld(w)).toEqual([]);
},180_000);

function runPrisonJourney(stopTick?:number):void {
  expect(fixtureHash).toBe(expectedFixtureHash);
  const input=process.env.PRISON_CHECKPOINT,resumed:Checkpoint|undefined=input?JSON.parse(readFileSync(input,'utf8')):undefined;
  if(resumed&&(resumed.protocol!=='prison-v86'||resumed.fixtureHash!==fixtureHash))throw Error('Prison checkpoint must descend from the committed V85 colony.');
  let w:World=resumed?deserializeWorld(resumed.world):loadFixture();
  const woodLedger=resumed?readWoodLedger(resumed.woodLedger):createWoodLedger();
  const repairLedger=resumed?readRepairLedger(resumed.repairLedger):createRepairLedger();
  if(stopTick!==undefined&&(!resumed||!Number.isSafeInteger(stopTick)||stopTick<=w.tick||stopTick>w.tick+2*6000))throw Error('Combat diagnostic requires an actual checkpoint and a limit within two days.');
  const player=resumed?.player??newPrisonPlayer(w,energyReport.player),started=performance.now(),diagnostic=process.env.PRISON_DIAGNOSTIC==='1';
  const ledger:Ledger=resumed?.ledger??{consumed:0,harvested:0,cooked:0,steelMined:0,componentsMined:0,medicineConsumed:0,meals:{},mealsByStation:{}};
  const initial=resumed?.initial??{wood:conservedWood(w,woodLedger),food:foodAccount(w),animalEaten:w.wildlife?.eatenItems??0,steel:metalAccount(w,'steel'),component:metalAccount(w,'component'),medicine:medicines(w)};
  const journal:Checkpoint['journal']=resumed?.journal??[],observations:Checkpoint['observations']=resumed?.observations??[];
  const checkpoint=(world=serializeWorld(w)):Checkpoint=>({protocol:'prison-v86',fixtureHash,world,player,ledger,woodLedger,repairLedger,initial,journal,observations});
  const failureFile=stopTick===undefined?'tmp/prison-failed-v86.json':'tmp/prison-combat-diagnostic-failed-v86.json';onTestFailed(()=>writeTestFileSync(failureFile,JSON.stringify({...checkpoint(JSON.stringify(w)),validation:validateWorld(w)})));
  const context=()=>JSON.stringify({tick:w.tick,player,ledger,latest:observations.at(-1),checkpoint:failureFile});
  const observe=()=>{
    observations.push(structuredClone(prisonSummary(w,player)));const c=context();
    expect(validateWorld(w),c).toEqual([]);expect(survivorPlan(w,true).anchor,c).toEqual(player.campAnchor);
    expect(conservedWood(w,woodLedger),c).toBeCloseTo(initial.wood,7);
    expect(metalAccount(w,'steel'),c).toBe(initial.steel+ledger.steelMined+(ledger.podSteel??0));expect(metalAccount(w,'component')+repairLedger.spent,c).toBe(initial.component+ledger.componentsMined+(ledger.podComponents??0));
    expect(foodAccount(w)+captiveMealInTransit(w)+ledger.consumed+9*ledger.cooked+(w.wildlife?.eatenItems??0)-initial.animalEaten,c).toBe(initial.food+ledger.harvested+(ledger.podFood??0));
    expect(player.initialColonists.every(id=>w.pawns.some(p=>p.id===id&&isColonist(p)&&p.state!=='dead')),c).toBe(true);
  };
  const continuation=()=>{
    const saved=serializeWorld(w),copy=deserializeWorld(saved);
    try{stepWorld(w,120);stepWorld(copy,120);expect(serializeWorld(copy),context()).toBe(serializeWorld(w));}
    catch(error){writeTestFileSync('tmp/prison-continuation-failed-v86.json',JSON.stringify({protocol:'prison-v86-continuation-failure',saved,actual:JSON.stringify(w),restored:JSON.stringify(copy),validation:validateWorld(w),failure:String(error)}));throw error;}
    finally{w=deserializeWorld(saved);}
  };
  // Sixty days from the reached V85 colony is a diagnostic ceiling, not a
  // promised capture date: earlier natural raids left no surviving captive.
  // This runner limit changes no game rule. Decisions never read the next raid
  // deadline; daily/milestone checkpoints retain the actual elapsed journey.
  while(w.tick<Math.min(player.startTick+60*6000,stopTick??Infinity)){
    if(w.tick%250===0||crashlandedThreatActive(w)&&w.tick%20===0||player.targetId!==undefined&&w.tick%50===0){
      for(const d of prisonDecisions(w,player)){const result=applyCommand(w,d.command);expect(result,JSON.stringify({tick:w.tick,...d,result})).toMatchObject({ok:true});journal.push({tick:w.tick,...d});}
      if(w.tick%250===0)observe();
      if(diagnostic&&w.tick%250===0)writeTestFileSync('tmp/prison-diagnostic-latest-v86.json',JSON.stringify(checkpoint()));
    }
    const beforeMilestones=Object.keys(player.milestones).join(','),stations=new Map(w.pawns.flatMap(p=>{const station=w.structures.find(s=>s.id===p.cooking?.stationId);return station?[[p.name,station.kind] as const]:[];}));
    const names=new Map(w.pawns.map(p=>[p.name,p.id])),tenders=new Map(w.pawns.filter(p=>p.tend).map(p=>[p.name,p.tend!.patientId]));
    const mines=w.jobs.filter(j=>j.kind==='mine').flatMap(j=>{const tile=w.tiles[j.z*w.width+j.x]!;return tile.ore?[{cell:j.z*w.width+j.x,ore:tile.ore}]:[];});
    const medicineBefore=medicines(w);trackMaintenanceStep(w,repairLedger,()=>trackWoodStep(w,woodLedger,()=>stepWorld(w)));
    ledger.medicineConsumed+=Math.max(0,medicineBefore-medicines(w));
    for(const target of mines)if(w.tiles[target.cell]!.terrain!=='rock'){if(target.ore==='steel')ledger.steelMined+=40;else if(target.ore==='machinery')ledger.componentsMined+=2;}
    for(const e of w.events.filter(e=>e.tick===w.tick)){
      const eaten=e.message.match(/a mangé une portion \((\d+) ×/),person=[...names].find(([name])=>e.message.startsWith(`${name} `)),id=person?.[1];
      if(eaten){ledger.consumed+=Number(eaten[1]);if(id!==undefined){ledger.meals[id]=(ledger.meals[id]??0)+1;const p=w.pawns.find(p=>p.id===id);if(p?.prisoner&&id===player.targetId){player.fedCaptive++;player.milestones.fedCaptive??=w.tick;}if(id===player.recruitId)player.recruitMeals++;}}
      const pod=podDelivery(e.message);
      if(pod){if(pod.item==='steel')ledger.podSteel=(ledger.podSteel??0)+pod.quantity;else if(pod.item==='component')ledger.podComponents=(ledger.podComponents??0)+pod.quantity;else if(ITEM_DEFINITIONS[pod.item].kind==='food')ledger.podFood=(ledger.podFood??0)+pod.quantity;}
      const harvest=e.message.match(/a récolté (\d+) (baies|riz|pommes de terre|maïs)/);if(harvest)ledger.harvested+=Number(harvest[1]);
      if(e.message.includes('a cuisiné 1 repas simple')){ledger.cooked++;const kind=person?stations.get(person[0]):undefined;expect(kind,e.message).toBeDefined();ledger.mealsByStation[kind!]=(ledger.mealsByStation[kind!]??0)+1;}
      if(e.message.includes('réduit la résistance de ')){player.conversations++;player.milestones.resistanceReduced??=w.tick;}
      if(e.message.includes('a traité ')&&person&&tenders.get(person[0])===player.targetId)player.milestones.treatedCaptive??=w.tick;
    }
    observePrison(w,player);
    if(Object.keys(player.milestones).join(',')!==beforeMilestones){observe();continuation();writeTestFileSync('tmp/prison-phase-latest-v86.json',JSON.stringify(checkpoint()));console.info(`Prison transition J${(w.tick/6000).toFixed(3)} : ${Object.keys(player.milestones).join(', ')}.`);}
    if(w.tick%6000===0){
      observe();continuation();const data=JSON.stringify(checkpoint());writeTestFileSync('tmp/prison-latest-v86.json',data);writeTestFileSync(`tmp/prison-day${w.tick/6000}-v86.json`,data);
      const supply=observations.at(-1)!.wood;
      console.info(`Prison J${w.tick/6000} : ${w.pawns.filter(isColonist).length} colons, ${player.conversations} entretiens, ${player.fedCaptive} repas captif, ${player.recruitMeals} repas recruté, ${ledger.cooked} repas produits, bois ${supply.available}/${supply.target} visé et ${supply.pendingCuts} coupes engagées.`);
    }else if(diagnostic&&w.tick%1000===0)console.info(`Prison tick ${w.tick}, ${(performance.now()-started).toFixed(0)} ms, cible ${player.targetId??'aucune'}, ${w.jobs.length} travaux.`);
    if(player.milestones.recruited&&player.milestones.colonistBed&&w.tick-player.milestones.recruited>=2*6000&&player.recruitMeals>=3&&player.recruitWorkTicks>0&&player.recruitSleepTicks>0)break;
  }
  observe();continuation();const final=prisonSummary(w,player),report={protocol:'prison-v86',fixtureHash,resumed:!!resumed,fromTick:resumed?JSON.parse(resumed.world).tick:player.startTick,runtimeMs:performance.now()-started,initial,woodLedger,repairLedger,ledger,player,journal,observations,final};
  if(stopTick!==undefined){
    writeTestFileSync('artifacts/prison-combat-diagnostic-v86.json',JSON.stringify(report));writeTestFileSync('tmp/prison-combat-diagnostic-v86.json',JSON.stringify(checkpoint()));
    expect(player.initialColonists.every(id=>w.pawns.some(p=>p.id===id&&isColonist(p)&&p.state!=='dead')),context()).toBe(true);
    expect(w.raids?.completed,context()).toBeGreaterThan(JSON.parse(resumed!.world).raids.completed);
    expect(w.pawns.filter(p=>player.initialColonists.includes(p.id)&&p.state==='downed'),context()).toEqual([]);
    expect(journal.filter(d=>d.tick>=JSON.parse(resumed!.world).tick&&d.command.type==='order-equipment').length,context()).toBeGreaterThanOrEqual(2);
    return; // A combat diagnostic does not certify the separate recruitment journey.
  }
  writeTestFileSync('artifacts/prison-colony-v86.json',JSON.stringify(report));writeTestFileSync('tmp/prison-final-v86.json',serializeWorld(w));writeTestFileSync('tmp/prison-final-checkpoint-v86.json',JSON.stringify(checkpoint()));
  for(const name of ['prisonReady','newRaidDowned','captureStarted','captureCarried','captured','treatedCaptive','fedCaptive','firstConversation','resistanceReduced','recruited','colonistBed'])expect(player.milestones[name],context()).toBeGreaterThanOrEqual(player.startTick);
  const recruit=w.pawns.find(p=>p.id===player.recruitId)!;
  expect(recruit?.recruitment?.fromFaction,context()).toBe('outlaws');expect(player.initialPeople.includes(recruit.id),context()).toBe(false);
  expect(w.pawns.filter(isColonist),context()).toHaveLength(4);expect(w.pawns.filter(isColonist).every(p=>p.state!=='dead'&&p.state!=='downed'&&p.hunger>0&&p.rest>0),context()).toBe(true);
  expect(player.recruitMeals,context()).toBeGreaterThanOrEqual(3);expect(player.recruitWorkTicks,context()).toBeGreaterThan(0);expect(player.recruitSleepTicks,context()).toBeGreaterThan(0);
  expect(ledger.mealsByStation['electric-stove']??0,context()).toBeGreaterThan(0);expect(final.energy.stovePowered&&final.energy.coolerPowered,context()).toBe(true);
  expect(journal.some(d=>d.command.type==='bill-update'&&d.command.settings.target===12),context()).toBe(true);
}
test('Prison : après J42, capture réelle, soins, recrutement et quatre personnes entretenues',()=>runPrisonJourney(),3_600_000);
test.skipIf(!process.env.PRISON_COMBAT_UNTIL)('Prison : diagnostic de défense depuis un checkpoint réel et secours après le raid',()=>runPrisonJourney(Number(process.env.PRISON_COMBAT_UNTIL)),300_000);
