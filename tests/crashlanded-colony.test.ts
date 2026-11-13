import {createIngestionLedger,readIngestionLedger,promoteLegacyIngestionLedger,trackIngestionStep,observeIngestion,ordinaryRationBoundary,RATION_DEADLINE,type IngestionLedger,type IngestionRecord} from './scenarios/ingestion-conservation.ts';
import { createWoodLedger,readWoodLedger,trackWoodStep,conservedWood,gatherProbe,grazingProbe,type WoodLedger } from './scenarios/wood-conservation.ts';
import {createRepairLedger,readRepairLedger,trackMaintenanceStep,type RepairLedger} from './scenarios/repair-conservation.ts';
import { writeTestFileSync } from './test-output.ts';
import { isColonist } from '../src/sim/affiliation';
import { crashlandedDecisions, crashlandedSummary,crashlandedThreatActive } from './scenarios/crashlanded-player';
import { readFileSync } from 'node:fs';
import {createHash} from 'node:crypto';
import { expect, onTestFailed, test } from 'vitest';
import { applyCommand, createWorld, deserializeWorld, serializeWorld, stepWorld, validateWorld } from '../src/sim/index.ts';
import { createScenarioWorld } from '../src/sim/new-game.ts';
import { enableWildlife } from '../src/sim/wildlife.ts';
import { HARE } from '../src/sim/wildlife-state.ts';
import { refreshStock } from '../src/sim/materials.ts';
import { FLORA_DEFINITIONS,weightedSpecies } from '../src/sim/biome-flora.ts';
import { deconstructionCamp } from './scenarios/deconstruction.ts';
import { foodAccount, woodAccount } from './scenarios/colony-player.ts';
import { survivorPlan } from './scenarios/survivor-player.ts';
import type { Command,Job,Resource,World } from '../src/sim/types.ts';
import { sameMapWorld } from './scenarios/same-map.ts';
import { footprintCells } from '../src/sim/definitions.ts';
import { medicalBleed } from '../src/sim/injury-state.ts';

type Summary=ReturnType<typeof crashlandedSummary>;
interface Ledger {
  consumed:number;harvested:number;cooked:number;riceHarvested:number;riceCooked:number;riceMeals:number;
  potatoHarvested:number;cornHarvested:number;potatoCooked:number;cornCooked:number;
  riceHarvestsByCell:Record<number,number>;mealsByStation:Record<string,number>;
  consumedByItem:Record<string,number>;lastSurvivalMealTick:number;nonRationIngestionsLastWeek:Record<number,number>;
  meals:Record<number,number>;sleep:Record<number,number>;
}
interface Checkpoint { woodLedger:WoodLedger;repairLedger:RepairLedger;
  protocol:'food-chain-v84';instrumentation:3|4;ingestionLedger?:IngestionLedger;seed:number;world:string;initial:{wood:number;food:number;steel:number;component:number};ledger:Ledger;
  milestones:Record<string,number>;journal:{tick:number;reason:string;command:Command}[];observations:Summary[];
}
const woodConserved=(w:World)=>woodAccount(w)+(w.fires?.ledger.items.wood??0)+(w.fires?.ledger.woodPotentialLost??0)+((w.fires?.ledger.fuelTicksLost??0)+(w.fires?.ledger.fuelTicksBurned??0))/600;

test('wood loss without a completed chop is still detected by the conservation oracle',()=>{
  const w=createWorld(42,20,20),tree:Resource={id:w.nextId++,kind:'tree',amount:12,x:10,z:10};
  w.resources.push(tree);
  const initial=woodConserved(w),woodYieldLost=0;
  expect(woodConserved(w)+woodYieldLost).toBe(initial);
  tree.amount--;
  expect(woodConserved(w)+woodYieldLost).toBe(initial-1);
  expect(woodConserved(w)+woodYieldLost).not.toBe(initial);
});
test('confirmed chopping and grazing balance physical tree wood, while an unrelated loss remains visible',()=>{
  const chopped=deconstructionCamp(),pawn=chopped.pawns[0]!;
  pawn.priorities.gather=2;
  const tree:Resource={id:chopped.nextId++,kind:'tree',species:'poplar',amount:27,growth:.5,growthTick:chopped.tick,x:12,z:16};
  chopped.resources.push(tree);
  const initialChop=woodConserved(chopped);
  expect(applyCommand(chopped,{type:'designate',kind:'chop',x:tree.x,z:tree.z}).ok).toBe(true);
  gatherProbe.records.length=0;gatherProbe.active=true;
  try{for(let i=0;i<1000&&chopped.resources.includes(tree);i++)stepWorld(chopped);}finally{gatherProbe.active=false;}
  const production=gatherProbe.records.filter(r=>sameMapWorld(r.world,chopped)&&r.kind==='chop'&&r.resourceKind==='tree');
  expect(production).toHaveLength(1);
  expect(production[0]).toMatchObject({kind:'chop',resourceKind:'tree',nominal:27});
  expect(production[0]!.quantity).toBeGreaterThan(0);
  expect(production[0]!.quantity).toBeLessThan(27);
  expect(woodConserved(chopped)+27-production[0]!.quantity!).toBe(initialChop);

  const grazed=createWorld(42,16,16);grazed.resources=[];grazed.tiles=grazed.tiles.map(()=>({terrain:'grass'}));grazed.structures=[];grazed.jobs=[];grazed.piles=[];refreshStock(grazed);
  const poplar:Resource={id:grazed.nextId++,kind:'tree',species:'poplar',amount:27,x:3,z:3,growth:.11,growthTick:grazed.tick};
  grazed.resources.push(poplar);enableWildlife(grazed,1);
  const animal=grazed.wildlife!.animals[0]!;animal.x=3;animal.z=3;animal.food=0;animal.state='eating';animal.path=[];
  animal.meal={kind:'plant',id:poplar.id,quantity:1,progress:HARE.ingestTicks-.01};
  const initialGraze=woodConserved(grazed);
  grazingProbe.records.length=0;grazingProbe.active=true;
  try{stepWorld(grazed);}finally{grazingProbe.active=false;}
  const grazing=grazingProbe.records.filter(r=>sameMapWorld(r.world,grazed)&&r.resourceId===poplar.id);
  // The record's world is the same map (filtered above), possibly through its campaign root.
  expect(grazing.map(({world:_world,...record})=>record)).toEqual([{resourceId:poplar.id,resourceKind:'tree',amount:27,removed:true,confirmed:true}]);
  expect(woodConserved(grazed)+grazing[0]!.amount).toBe(initialGraze);
  const unrelated:Resource={id:grazed.nextId++,kind:'tree',amount:5,x:5,z:5};grazed.resources.push(unrelated);
  const beforeLoss=woodConserved(grazed)+grazing[0]!.amount;
  unrelated.amount--;
  expect(woodConserved(grazed)+grazing[0]!.amount).toBe(beforeLoss-1);

  const regrown=createWorld(42,20,20);regrown.tick=59;if(regrown.corePathBudget297)regrown.corePathBudget297.tick=regrown.tick;if(regrown.deterioration)regrown.deterioration.lastTick=regrown.tick;regrown.resources=[];regrown.piles=[];regrown.jobs=[];regrown.structures=[];
  regrown.tiles=regrown.tiles.map(()=>({terrain:'grass'}));refreshStock(regrown);
  const roll=(value:number)=>{let n=value;n^=n<<13;n^=n>>>17;n^=n<<5;return {value:n>>>0,fraction:(n>>>0)/0x100000000};};
  let floraSeed=0;
  for(let seed=1;seed<100000;seed++){
    const first=roll(seed);if(first.fraction>=.2)continue;
    const second=roll(first.value),third=roll(second.value);
    if(FLORA_DEFINITIONS[weightedSpecies('temperate-forest',third.fraction)].kind==='tree'){floraSeed=seed;break;}
  }
  expect(floraSeed).toBeGreaterThan(0);
  regrown.flora={revision:1,biome:'temperate-forest',rng:floraSeed,nextCheck:60,adoptedAt:0,capacity:400};
  const nextId=regrown.nextId,initialRegrow=woodConserved(regrown);
  stepWorld(regrown);
  const born=regrown.resources.filter(r=>r.id>=nextId&&r.kind==='tree'&&r.plantLife?.bornAt===60);
  expect(born).toHaveLength(1);
  expect(born[0]!.amount).toBe(FLORA_DEFINITIONS[born[0]!.species!].yield);
  expect(woodConserved(regrown)-born[0]!.amount).toBe(initialRegrow);
});
const checkpointFile=process.env.CRASHLANDED_CHECKPOINT;
const checkpointRaw=checkpointFile?readFileSync(checkpointFile,'utf8'):undefined;
const resumed:Checkpoint|undefined=checkpointRaw?JSON.parse(checkpointRaw):undefined;
if(resumed&&resumed.protocol!=='food-chain-v84')throw Error('Use a V84 food-chain checkpoint; a V83 20-cell camp has a different player protocol.');
if(resumed&&resumed.instrumentation!==3&&resumed.instrumentation!==4)throw Error('Use a food-chain checkpoint with confirmed wood/repair instrumentation and prospective ingestion observations.');

/** Completion retains the removed job object and its final reserver. Read that
 * object after the tick so a newly assigned, partially completed harvest is
 * attributed to its actual worker. Resource arrays are replaced on removal;
 * keeping the old array requires no full-map copy on every simulated tick. */
function completedRiceCell(w:World,message:string,events:World['events'],jobsBefore:readonly Job[],resourcesBefore:readonly Resource[],context:string):number|undefined {
  const people=w.pawns.filter(p=>message.startsWith(`${p.name} `));
  const diagnostic=(reason:string,candidates:unknown=[]):never=>{throw Error(`${reason}: ${JSON.stringify({context,tick:w.tick,message,people:people.map(p=>({id:p.id,name:p.name,x:p.x,z:p.z})),candidates,jobs:jobsBefore.map(j=>({id:j.id,x:j.x,z:j.z,reservedBy:j.reservedBy,progress:j.progress,retained:w.jobs.some(current=>current.id===j.id)})),riceBefore:resourcesBefore.filter(r=>r.kind==='rice').map(r=>({id:r.id,x:r.x,z:r.z,retained:w.resources.some(current=>current.id===r.id)})),events})}`);};
  if(people.length!==1)return diagnostic('Rice event has no unique actor');
  const pawn=people[0]!;
  const completed=events.some(e=>e.message===`${pawn.name} a terminé le travail : récolte.`);
  if(!completed){
    // Clearing/cutting can recover a crop, but does not prove a harvest cycle.
    if(message.startsWith(`${pawn.name} a dégagé le chantier et a récolté`)
      ||events.some(e=>e.message===`${pawn.name} a terminé le travail : coupe de plante.`))return;
    return diagnostic('Rice production has no correlated harvest or clearing completion');
  }
  const candidates=jobsBefore.filter(j=>j.kind==='harvest'&&j.reservedBy===pawn.id&&!w.jobs.some(current=>current.id===j.id))
    .flatMap(job=>{
      const plant=resourcesBefore.find(r=>r.kind==='rice'&&r.x===job.x&&r.z===job.z);
      return plant&&!w.resources.some(r=>r.id===plant.id)?[{jobId:job.id,resourceId:plant.id,cell:job.z*w.width+job.x}]:[];
    });
  if(candidates.length!==1)return diagnostic('Rice harvest has no unique completed job and removed plant',candidates);
  return candidates[0]!.cell;
}

test.each(resumed?[resumed.seed]:[42])('Atterrissage : 24 jours, deux récoltes de riz, cuisine construite et diversification naturelle, graine %i',seed=>{
  const version=process.env.VALIDATION_VERSION??'v84',started=performance.now();
  let w:World=resumed?deserializeWorld(resumed.world):createScenarioWorld(seed,250,'crashlanded');
  const woodLedger=resumed?readWoodLedger(resumed.woodLedger):createWoodLedger();
  const repairLedger=resumed?readRepairLedger(resumed.repairLedger):createRepairLedger();
  const initial=resumed?.initial??{wood:conservedWood(w,woodLedger),food:foodAccount(w),steel:450,component:30};
  const ledger:Ledger=resumed?.ledger??{consumed:0,harvested:0,cooked:0,riceHarvested:0,riceCooked:0,riceMeals:0,potatoHarvested:0,cornHarvested:0,potatoCooked:0,cornCooked:0,riceHarvestsByCell:{},mealsByStation:{},consumedByItem:{},lastSurvivalMealTick:0,nonRationIngestionsLastWeek:Object.fromEntries(w.pawns.map(p=>[p.id,0])),meals:Object.fromEntries(w.pawns.map(p=>[p.id,0])),sleep:Object.fromEntries(w.pawns.map(p=>[p.id,0]))};
  const ingestionLedger=resumed?resumed.instrumentation===4?readIngestionLedger(resumed.ingestionLedger,w.tick,w.nextId)
    :promoteLegacyIngestionLedger(w.tick,ledger.lastSurvivalMealTick,createHash('sha256').update(checkpointRaw!).digest('hex')):createIngestionLedger(w.tick);
  if(resumed)expect(conservedWood(w,woodLedger)).toBeCloseTo(initial.wood,7);
  const milestones:Record<string,number>=resumed?.milestones??{},journal:Checkpoint['journal']=resumed?.journal??[],observations:Summary[]=resumed?.observations??[];
  const primary=survivorPlan(w,true).field,initialRiceCells=new Set<number>();
  for(let z=primary.from.z;z<=primary.to.z;z++)for(let x=primary.from.x;x<=primary.to.x;x++)initialRiceCells.add(z*w.width+x);
  const checkpoint=():Checkpoint=>({protocol:'food-chain-v84',instrumentation:4,seed,world:serializeWorld(w),initial,woodLedger,repairLedger,ingestionLedger,ledger,milestones,journal,observations});
  const failureFile=`tmp/crashlanded-failed-${version}-${seed}.json`;
  onTestFailed(()=>{
    try{writeTestFileSync(failureFile,JSON.stringify(checkpoint()));}
    catch{writeTestFileSync(`tmp/crashlanded-invalid-world-${version}-${seed}.json`,JSON.stringify({protocol:'food-chain-v84',instrumentation:4,seed,world:JSON.stringify(w),initial,woodLedger,repairLedger,ingestionLedger,ledger,milestones,journal,observations,validation:validateWorld(w)}));}
  });
  const record=(name:string,yes:boolean)=>{if(yes&&milestones[name]===undefined)milestones[name]=w.tick;};
  const observe=()=>{
    const s=crashlandedSummary(w);observations.push(s);
    const context=`seed ${seed}, tick ${w.tick}; checkpoint ${failureFile}`;
    expect(validateWorld(w),context).toEqual([]);
    expect(conservedWood(w,woodLedger),context).toBeCloseTo(initial.wood,7);
    expect({...s.materials,component:s.materials.component+repairLedger.spent},context).toEqual({steel:initial.steel,component:initial.component});
    expect(foodAccount(w)+ledger.consumed+9*ledger.cooked+(w.wildlife?.eatenItems??0),context).toBe(initial.food+ledger.harvested);
    readIngestionLedger(ingestionLedger,w.tick,w.nextId);
    // Food poisoning can drive hunger to zero between the physical pickup and
    // ingestion. A colonist actively eating is already resolving that state;
    // death, exhaustion or starvation without an engaged meal remain hard
    // failures. A temporary combat downing is observed and must be resolved by
    // the final recovery assertion rather than making every raid harmless.
    expect(w.pawns.filter(isColonist).every(p=>p.state!=='dead'&&p.rest>0&&(p.hunger>0||p.state==='eating'||p.state==='downed')),context).toBe(true);
    record('threeBeds',s.beds===3);record('shelter',s.shelteredBeds===3&&s.walls===15&&s.doors===1);
    record('stockMoved',s.stored.steel>0&&s.stored.component>0);
    record('medicineStored',s.stored.medicine===30);record('riceGrowing',s.crops.length>=40&&s.crops.some(c=>c.growth>0));
    record('everyoneAte',Object.values(ledger.meals).every(n=>n>0));record('everyoneSleptInBed',Object.values(ledger.sleep).every(n=>n>0));
    record('firstCookedMeal',ledger.cooked>0);record('firstRaid',!!w.raids?.active);record('raidOver',!!w.raids?.last);
    record('coveredStock',s.foodChain.coveredStockCells>=24);
    record('fueledStove',s.foodChain.stations.some(s=>s.kind==='fueled-stove'));
    record('butcherTable',s.foodChain.stations.some(s=>s.kind==='butcher-table'));
    record('firstButchery',(w.butchery?.completed??0)>0);
    record('secondRiceCycle',Object.values(ledger.riceHarvestsByCell).filter(n=>n>=2).length>=40);
    record('potatoGrowing',s.foodChain.plants.some(p=>p.kind==='potato'&&p.count>0&&p.meanGrowth>0));
    record('cornGrowing',s.foodChain.plants.some(p=>p.kind==='corn'&&p.count>0&&p.meanGrowth>0));
    record('initialRationsGone',s.food.survival===0);
    return s;
  };
  while(w.tick<144000) {
    if(w.tick%250===0 || crashlandedThreatActive(w) && w.tick%20===0) {
      for(const d of crashlandedDecisions(w)){expect(applyCommand(w,d.command),JSON.stringify({seed,tick:w.tick,decision:d})).toMatchObject({ok:true});journal.push({tick:w.tick,...d});}
      observe();
    }
    // Include unowned partial jobs: assignment and completion may share a tick.
    // Match positive rice output to both actual job completion and plant loss;
    // grazing, cutting or a failed harvest never increment the cycle counter.
    const harvestJobs=w.jobs.filter(j=>j.kind==='harvest'),resourcesBefore=w.resources;
    const stations=new Map(w.pawns.flatMap(p=>{const station=w.structures.find(s=>s.id===p.cooking?.stationId);return station?[[p.name,station.kind] as const]:[];}));
    const eating=new Map(w.pawns.flatMap(p=>{const need=p.need,pile=need?.kind==='eat'?w.piles.find(q=>q.id===need.carryPileId):undefined;return pile?[[p.name,pile.item] as const]:[];}));
    const assisted=new Map<number,IngestionRecord>();
    // Assisted feeding reports ingestion under the patient's name, while its
    // physical food is carried by the doctor until the actual completion.
    for(const doctor of w.pawns)if(doctor.feed){
      const patient=w.pawns.find(p=>p.id===doctor.feed!.patientId),pile=w.piles.find(p=>p.id===doctor.feed!.carryPileId);
      if(patient&&pile){eating.set(patient.name,pile.item);assisted.set(patient.id,{tick:w.tick+1,pawnId:patient.id,portionId:pile.id,item:pile.item,quantity:pile.quantity,source:'assisted',mentalKind:patient.mental?.crisis?.kind??null});}
    }
    const ingestions=trackIngestionStep(w,()=>trackMaintenanceStep(w,repairLedger,()=>trackWoodStep(w,woodLedger,()=>stepWorld(w))));
    const currentEvents=w.events.filter(e=>e.tick===w.tick);
    for(const e of currentEvents) {
      const eaten=e.message.match(/a mangé une portion \((\d+) ×/);
      if(eaten){
        const quantity=Number(eaten[1]);
        const pawn=w.pawns.find(p=>e.message.startsWith(`${p.name} a mangé`)),item=pawn?eating.get(pawn.name):undefined;
        expect(item,`Consumed physical item missing at tick ${w.tick}: ${e.message}`).toBeDefined();
        if(!pawn||!isColonist(pawn))continue;
        const physical=ingestions.filter(r=>r.pawnId===pawn.id&&r.item===item&&r.quantity===quantity);
        if(physical.length)expect(physical).toHaveLength(1);
        const observed=physical[0]??assisted.get(pawn.id);
        expect(observed,`Actual ingestion producer missing at tick${w.tick}: ${e.message}`).toBeDefined();
        expect(observed!.item).toBe(item);expect(observed!.quantity).toBe(quantity);expect(observed!.tick).toBe(w.tick);
        observeIngestion(ingestionLedger,observed!);
        ledger.consumed+=quantity;
        ledger.consumedByItem[item!]=(ledger.consumedByItem[item!]??0)+quantity;
        if(item==='survival-meal')ledger.lastSurvivalMealTick=w.tick;
        if(pawn){ledger.meals[pawn.id]=(ledger.meals[pawn.id]??0)+1;if(w.tick>17*6000&&item!=='survival-meal')ledger.nonRationIngestionsLastWeek[pawn.id]=(ledger.nonRationIngestionsLastWeek[pawn.id]??0)+1;}
      }
      const harvest=e.message.match(/a récolté (\d+) (baies|riz|pommes de terre|maïs)/);
      if(harvest){
        const quantity=Number(harvest[1]);ledger.harvested+=quantity;
        if(harvest[2]==='riz'){
          ledger.riceHarvested+=quantity;record('riceHarvested',true);
          const cell=completedRiceCell(w,e.message,currentEvents,harvestJobs,resourcesBefore,`seed ${seed}; checkpoint ${failureFile}`);
          if(cell!==undefined&&initialRiceCells.has(cell))ledger.riceHarvestsByCell[cell]=(ledger.riceHarvestsByCell[cell]??0)+1;
        }
        if(harvest[2]==='pommes de terre'){ledger.potatoHarvested+=quantity;record('potatoHarvested',true);}
        if(harvest[2]==='maïs'){ledger.cornHarvested+=quantity;record('cornHarvested',true);}
      }
      if(e.message.includes('a cuisiné 1 repas simple')){
        ledger.cooked++;
        const rice=Number(e.message.match(/, (\d+) riz/)?.[1]??0),potato=Number(e.message.match(/, (\d+) pommes de terre/)?.[1]??0),corn=Number(e.message.match(/, (\d+) maïs/)?.[1]??0);
        if(rice>0){ledger.riceCooked+=rice;ledger.riceMeals++;record('firstCropMeal',true);}
        ledger.potatoCooked+=potato;ledger.cornCooked+=corn;
        const station=[...stations].find(([name])=>e.message.startsWith(`${name} a cuisiné`))?.[1]??'unmatched';ledger.mealsByStation[station]=(ledger.mealsByStation[station]??0)+1;
      }
    }
    for(const p of w.pawns)if(p.state==='sleeping'&&p.need?.kind==='sleep'&&p.need.bedId!==null)ledger.sleep[p.id]=(ledger.sleep[p.id]??0)+1;
    if(w.tick%6000===0) {
      const saved=serializeWorld(w),copy=deserializeWorld(saved);stepWorld(w,100);stepWorld(copy,100);
      expect(serializeWorld(copy)).toBe(serializeWorld(w));w=deserializeWorld(saved);
      writeTestFileSync(`tmp/crashlanded-day-${version}-${seed}.json`,JSON.stringify(checkpoint()));
      // Keep milestone days independently so diagnosis does not require a fresh
      // 24-day run. These are real reached states, never a prepared fixture.
      if([1,6,12,18,24].includes(w.tick/6000))writeTestFileSync(`tmp/crashlanded-day${w.tick/6000}-${version}-${seed}.json`,JSON.stringify(checkpoint()));
      console.info(`Atterrissage ${seed}: J${w.tick/6000}, ${ledger.riceHarvested} riz récoltés, ${ledger.riceMeals} repas au riz, ${Object.values(ledger.riceHarvestsByCell).filter(n=>n>=2).length}/80 cases récoltées deux fois, ${w.jobs.length} travaux`);
    }
  }
  const final=observe(),runtimeMs=performance.now()-started,report={protocol:'food-chain-v84',instrumentation:4,seed,resumed:!!resumed,runtimeMs,initial,woodLedger,repairLedger,ingestionLedger,ledger,milestones,journal,observations,final};
  writeTestFileSync(`tmp/crashlanded-final-${version}-${seed}.json`,serializeWorld(w));writeTestFileSync(`artifacts/crashlanded-colony-${version}-${seed}.json`,JSON.stringify(report));
  const context=JSON.stringify({seed,milestones,ledger,ingestionLedger,final});
  const survivors=w.pawns.filter(isColonist);expect(survivors,context).toHaveLength(3);
  // A colonist wounded shortly before J24 may still be convalescing: downed is
  // accepted only lying in a real bed of its own need, no longer bleeding
  // (decision of the user, 12 November 2026).
  const convalescing=(p:World['pawns'][number])=>{
    const need=p.need,bed=need?.kind==='sleep'&&need.bedId!==null?w.structures.find(s=>s.id===need.bedId):undefined;
    return p.state==='downed'&&!!bed&&footprintCells(bed).some(c=>c.x===p.x&&c.z===p.z)&&(!p.health||medicalBleed(p.health)===0);
  };
  expect(survivors.every(p=>p.state!=='dead'&&(p.state!=='downed'||convalescing(p))&&p.hunger>0&&p.rest>0),context).toBe(true);
  expect(final.beds,context).toBe(3);expect(final.shelteredBeds,context).toBe(3);
  expect(final.walls,context).toBe(15);expect(final.doors,context).toBe(1);
  expect(final.foodChain.zones,context).toEqual(expect.arrayContaining([expect.objectContaining({plant:'rice',cells:80}),expect.objectContaining({plant:'potato',cells:24}),expect.objectContaining({plant:'corn',cells:24})]));
  expect(final.foodChain.coveredStockCells,context).toBeGreaterThanOrEqual(24);
  expect(final.foodChain.stations,context).toEqual(expect.arrayContaining([expect.objectContaining({kind:'fueled-stove',roofed:true}),expect.objectContaining({kind:'butcher-table',roofed:true})]));
  expect(ledger.mealsByStation['fueled-stove'],context).toBeGreaterThan(0);
  expect(milestones.firstButchery,context).toBeGreaterThan(milestones.butcherTable!);
  expect(Object.values(ledger.meals).every(n=>n>=12),context).toBe(true);expect(Object.values(ledger.sleep).every(n=>n>1000),context).toBe(true);
  expect(final.stored.component,context).toBe(30);expect(final.stored.steel,context).toBe(370);
  expect(final.food.nutrition,context).toBeGreaterThan(0);expect(milestones.stockMoved,context).toBeGreaterThan(0);
  expect(milestones.shelter,context).toBeGreaterThan(0);
  expect(ordinaryRationBoundary(ingestionLedger),context).toBeLessThanOrEqual(RATION_DEADLINE);
  // Includes raw berries/crops as well as cooked meals. Crop cooking and rice
  // cycles have their own assertions; this only proves ingestion without rations.
  expect(Object.values(ledger.nonRationIngestionsLastWeek).every(n=>n>=6),context).toBe(true);
  expect(ledger.riceHarvested,context).toBeGreaterThan(0);expect(ledger.riceMeals,context).toBeGreaterThan(0);
  expect(ledger.riceCooked,context).toBeGreaterThan(0);expect(ledger.riceCooked,context).toBeLessThanOrEqual(ledger.riceHarvested);
  expect(milestones.firstCropMeal,context).toBeGreaterThan(milestones.riceHarvested!);
  expect(milestones.secondRiceCycle,context).toBeGreaterThan(milestones.riceHarvested!);
  expect(milestones.potatoGrowing,context).toBeGreaterThan(0);expect(milestones.cornGrowing,context).toBeGreaterThan(0);
  expect(milestones.firstRaid,context).toBe(32400);expect(milestones.raidOver,context).toBeGreaterThan(32400);
  expect(w.raids?.active,context).toBeUndefined();expect(w.raids?.last?.reason,context).not.toBe('colony-down');
  expect(w.pawns.filter(isColonist).every(p=>!p.draft),context).toBe(true);
  // Corn sown after the first rice harvest can legitimately remain immature at
  // J24. Presence, maturity, harvest and cooking are reported separately. No
  // Reserve rations may remain stored: ordinary meals in the last seven days
  // must be supplied without them. Confirmed impulsive consumption is reported
  // separately and remains in every physical food total and raw last-ingestion
  // timestamp; no reserve is confiscated or historical crisis reconstructed. No
  // growth/need/deadline is changed to make all food appear in this one run.
  // Watchdog includes doubled simulated duration and a larger real farm. This
  // is a hang limit, not a simulation performance acceptance threshold.
},2400000);
