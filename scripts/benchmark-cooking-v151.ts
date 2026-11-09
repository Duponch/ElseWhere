/** Frozen pre-V151 cooking proposal for an independent decision and timing oracle.
 * The implementation below is copied from HEAD before the service-cell hoist. */
import { storedPriority } from '../src/sim/work-types.ts';
import {planArtWork} from '../src/sim/art-work-plan.ts';
import {isArtRecipe} from '../src/sim/art-rules.ts';
import { productionResearchUnlocked,productionWorkerQualified,validAdvancedComponentIngredients,validFlakIngredients } from '../src/sim/machining.ts';
import { planGunWork } from '../src/sim/gun-work-plan.ts';
import { planFlakWork } from '../src/sim/flak-work-plan.ts';
import { planComponentWork } from '../src/sim/component-work-plan.ts';
import { isGunRecipe,GUN_REQUIREMENTS,isFlakRecipe,flakRequirements,ADVANCED_COMPONENT_REQUIREMENTS,type AdvancedComponentMaterial } from '../src/sim/production-recipes.ts';
import { isAnimalCorpseItem } from '../src/sim/biome-items.ts';
import { foodStationUsable, usesCookingFuel } from '../src/sim/food-workstations.ts';
import { corpseFresh } from '../src/sim/corpses.ts';
import { planUnfinished } from '../src/sim/tailoring-plan.ts';
import { CARRY_CAPACITY, footprintCells } from '../src/sim/definitions.ts';
import { PRODUCTION_RECIPES, admittedIngredient, isTailoring, productionStationUsable, stationRecipe, stationWork, type ProductionIngredient } from '../src/sim/production-recipes.ts';
import { reservedServiceCells } from '../src/sim/service-reservations.ts';
import { billWanted, cookingPlaceFree, cookingSpot, ingredientPlaceFree } from '../src/sim/cooking-bills.ts';
import { groundCapacity } from '../src/sim/ground-placement.ts';
import { reservedSource } from '../src/sim/materials.ts';
import { fuelCapacity, fuelStationReserved } from '../src/sim/fuel.ts';
import { routeToCell, routeToJob, type Reachability } from '../src/sim/pathfinding.ts';
import type { CookingTask, CookingIngredient } from '../src/sim/cooking-types.ts';
import type { Cell, HaulTask, Pawn, Structure, World } from '../src/sim/types.ts';

export interface CookingPlan {station:Structure;priority:number;target:Cell;path:Cell[];task?:CookingTask;refuel?:HaulTask}
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;
export function hasCookingWork(world:World,pawn:Pawn):boolean {
  return productionPriority(world,pawn)<5;
}
export function availableCookingStations(world:World,pawn:Pawn):Structure[] {
  return world.structures.filter(s=>stationRecipe(s)&&(s.kind!=='electric-stove'||foodStationUsable(s))&&productionStationUsable(s)&&storedPriority(pawn,stationWork(s))>0&&s.bills?.some(b=>billWanted(world,b))
    &&!fuelStationReserved(world,s.id,pawn.id));
}
/** Select without mutation. The ordinary planner compares this proposal with
 * construction/growing/hauling before committing its reservations. */
export function legacyPlanCooking(world:World,pawn:Pawn,reachable:Reachability,budget:{pairs:number},options?:{stationId:number;forced:boolean}):CookingPlan|null {
  const stations=availableCookingStations(world,pawn).filter(s=>!options||s.id===options.stationId)
    .sort((a,b)=>storedPriority(pawn,stationWork(a))-storedPriority(pawn,stationWork(b))||distance(pawn,a)-distance(pawn,b)||a.id-b.id);
  for(const station of stations) {
    if(fuelStationReserved(world,station.id,pawn.id))continue;
    const spot=cookingSpot(station);
    if(!cookingPlaceFree(world,spot)||reservedServiceCells(world,pawn.id).has(spot.z*world.width+spot.x))continue;
    const toSpot=routeToCell(world,spot,reachable);
    if(!toSpot)continue;
    for(const bill of station.bills!) {
      if(!billWanted(world,bill)||!productionResearchUnlocked(world,bill.recipe)||!productionWorkerQualified(pawn,bill.recipe))continue;
      // The reference bill worker refuels an empty usable station before cooking.
      if(usesCookingFuel(station.kind)&&!station.fuel?.ticks) {
        const capacity=fuelCapacity(world,station.id,undefined,options?.forced);if(!capacity)break;
        const wood=world.piles.filter(p=>p.item==='wood'&&p.owner.type==='ground'&&p.quantity>reservedSource(world,p.id))
          .sort((a,b)=>distance(a.owner as Cell,station)-distance(b.owner as Cell,station)||a.id-b.id);
        for(const pile of wood) {
          if(budget.pairs--<=0){budget.pairs=0;return null;}
          const path=routeToJob(world,pile.owner as Cell,reachable,true);
          if(!path)continue;
          return {station,priority:storedPriority(pawn,stationWork(station)),target:pile.owner as Cell,path,refuel:{sourcePileId:pile.id,quantity:Math.min(10,capacity,pile.quantity-reservedSource(world,pile.id)),phase:'pickup',carryPileId:null,destination:{type:'fuel',structureId:station.id,forCooking:true,...(options?.forced?{forced:true}:{})}}};
        }
        break;
      }
      const artResumed=planArtWork(world,pawn,station,bill,reachable,budget);if(artResumed.plan)return artResumed.plan;if(artResumed.handled)continue;
      const gunResumed=planGunWork(world,pawn,station,bill,reachable,budget);if(gunResumed.plan)return gunResumed.plan;if(gunResumed.handled)continue;
      const flakResumed=planFlakWork(world,pawn,station,bill,reachable,budget);if(flakResumed.plan)return flakResumed.plan;if(flakResumed.handled)continue;
      const componentResumed=planComponentWork(world,pawn,station,bill,reachable,budget);if(componentResumed.plan)return componentResumed.plan;if(componentResumed.handled)continue;
      const resumed=planUnfinished(world,pawn,station,bill,reachable,budget);if(resumed.plan)return resumed.plan;if(resumed.handled)continue;
      const sources=world.piles.filter(p=>admittedIngredient(bill,p.item)&&(!isAnimalCorpseItem(p.item)||corpseFresh(p,world.tick))&&p.owner.type==='ground'&&distance(p.owner,station)<=bill.radius**2)
        .sort((a,b)=>distance(a.owner as Cell,station)-distance(b.owner as Cell,station)||a.id-b.id);
      // No source means no pair was visited and no staging decision was made.
      // Avoid six full resource/footprint scans per empty bill, especially after
      // simultaneous spoilage. Keep earlier route/blocker diagnostics unchanged.
      if(!sources.length)continue;
      const groups=isArtRecipe(bill.recipe)?[...new Set(sources.map(p=>p.item))].map(material=>sources.filter(p=>p.item===material)):[sources];
      for(const group of groups) {
      const ingredients:CookingIngredient[]=[],planned=new Map<string,{item:ProductionIngredient;quantity:number}>();
      let missing:number=PRODUCTION_RECIPES[bill.recipe].units;
      if(isArtRecipe(bill.recipe)&&group.reduce((n,p)=>n+Math.max(0,p.quantity-reservedSource(world,p.id)),0)<missing)continue;
      const cells=[station,spot,{x:spot.x-1,z:spot.z},{x:spot.x+1,z:spot.z},{x:spot.x,z:spot.z-1},{x:spot.x,z:spot.z+1},...footprintCells(station)]
        .filter((c,i,a)=>a.findIndex(t=>same(t,c))===i&&ingredientPlaceFree(world,c,spot,bill.recipe,station));
      let tailoringMaterial:ProductionIngredient|undefined;
      for(const pile of group) {
        if(isTailoring(bill.recipe)&&tailoringMaterial!==undefined&&pile.item!==tailoringMaterial)continue;
        if(budget.pairs--<=0){budget.pairs=0;return null;}
        const typeMissing=isGunRecipe(bill.recipe)?(pile.item==='steel'||pile.item==='component'?GUN_REQUIREMENTS[bill.recipe][pile.item]-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):0):isFlakRecipe(bill.recipe)?((flakRequirements(bill.recipe) as unknown as Record<string,number>)[pile.item]??0)-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):bill.recipe==='make-advanced-component'?ADVANCED_COMPONENT_REQUIREMENTS[pile.item as AdvancedComponentMaterial]-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):missing;
        const quantity=Math.min(typeMissing,pile.quantity-reservedSource(world,pile.id));
        if(quantity<=0)continue;if(isTailoring(bill.recipe))tailoringMaterial??=pile.item as ProductionIngredient;
        if(!routeToJob(world,pile.owner as Cell,reachable,true))continue;
        const already=cells.find(c=>same(c,pile.owner as Cell));
        const cell=already??cells.find(c=>{
          const reserved=planned.get(`${c.x}:${c.z}`);
          return (!reserved||reserved.item===pile.item)&&groundCapacity(world,c,pile.item)-(reserved?.quantity??0)>=quantity;
        });
        if(!cell)continue;
        for(let left=quantity;left>0;){const part=already?left:Math.min(left,CARRY_CAPACITY);ingredients.push({pileId:pile.id,item:pile.item as ProductionIngredient,quantity:part,stage:already?'placed':'source',cell:{x:cell.x,z:cell.z}});left-=part;}
        if(!already){const key=`${cell.x}:${cell.z}`;planned.set(key,{item:pile.item as ProductionIngredient,quantity:(planned.get(key)?.quantity??0)+quantity});}
        missing-=quantity;if(!missing)break;
      }
      if(missing||!validFlakIngredients(bill.recipe,ingredients)||!validAdvancedComponentIngredients(bill.recipe,ingredients))continue; // Try the next bill if its filters admit other ingredients.
      const source=ingredients.find(i=>i.stage==='source'),target=source?world.piles.find(p=>p.id===source.pileId)!.owner as Cell:spot;
      return {station,priority:storedPriority(pawn,stationWork(station)),target,path:source?routeToJob(world,target,reachable,true)!:toSpot,task:{...(bill.recipe!=='simple-meal'?{recipe:bill.recipe}:{}),stationId:station.id,billId:bill.id,spot,actionCell:{x:target.x,z:target.z},phase:'gather',ingredients,progress:0,productId:null,storageId:null}};
      }
    }
  }
  return null;
}

export function productionPriority(world:World,pawn:Pawn):number {
  let priority=5;
  for(const s of world.structures)if(stationRecipe(s)&&s.bills?.some(b=>billWanted(world,b))){const p=storedPriority(pawn,stationWork(s));if(p>0)priority=Math.min(priority,p);}
  return priority;
}

// The audit driver is kept in this file so the frozen algorithm above can be
// imported by the focused test without running a benchmark during Vitest.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { candidateAccess } from '../src/sim/candidate-access.ts';
import { planCooking } from '../src/sim/cooking-planner.ts';
import { blockedCells } from '../src/sim/pathfinding.ts';
import { deserializeWorld, serializeWorld } from '../src/sim/index.ts';
import { CIVIL_TRANSIT_BLOCKERS } from '../src/sim/travel.ts';

const SAVE_PATH='public/test-saves/v98/mixed-100.json';
const SOURCE_PATH='src/sim/cooking-planner.ts';
const OUTPUT_PATH='tmp/benchmark-cooking-v151.json';
const sameProposal=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);

function runBenchmark():void {
  const stored=readFileSync(SAVE_PATH,'utf8'),envelope=JSON.parse(stored);
  const raw=envelope?.format==='lisiere-save'&&envelope.codec==='gzip-base64'
    ?gunzipSync(Buffer.from(envelope.payload,'base64')).toString('utf8'):stored;
  const world=deserializeWorld(raw),before=serializeWorld(world);
  if(world.width!==250||world.height!==250||world.pawns.length!==104)throw new Error('Unexpected mixed-100 fixture.');
  const sourceHash=createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex');
  const rng={world:world.rng,fire:world.fires?.rng,wildlife:world.wildlife?.rng};
  const blocked=blockedCells(world);
  const reach=(pawn:Pawn)=>candidateAccess(world,pawn,blocked,CIVIL_TRANSIT_BLOCKERS,true);
  const eligible=world.pawns.filter(p=>availableCookingStations(world,p).length>0);
  if(!eligible.length)throw new Error('No production workers in mixed-100 fixture.');
  let proposals=0,pathCells=0,pairUse=0;
  for(const pawn of world.pawns){
    const aBudget={pairs:32768},bBudget={pairs:32768};
    const old=legacyPlanCooking(world,pawn,reach(pawn),aBudget);
    const current=planCooking(world,pawn,reach(pawn),bBudget);
    if(!sameProposal(old,current)||aBudget.pairs!==bBudget.pairs)throw new Error(`Proposal mismatch for pawn ${pawn.id}.`);
    if(current){proposals++;pathCells+=current.path.length;}
    pairUse+=32768-bBudget.pairs;
  }
  type Variant='old'|'new';
  const samples:Array<{round:number;slot:number;variant:Variant;milliseconds:number;calls:number;proposals:number;pathCells:number;pairUse:number}>=[];
  const invoke=(variant:Variant,pawn:Pawn,access:Reachability,budget:{pairs:number})=>
    variant==='old'?legacyPlanCooking(world,pawn,access,budget):planCooking(world,pawn,access,budget);
  for(const pawn of eligible){invoke('old',pawn,reach(pawn),{pairs:32768});invoke('new',pawn,reach(pawn),{pairs:32768});}
  for(let round=1;round<=4;round++)for(const [slot,variant] of (['old','new','new','old'] as const).entries()){
    const accesses=eligible.map(reach),budgets=eligible.map(()=>({pairs:32768}));
    let found=0,paths=0,pairs=0;
    const start=performance.now();
    for(let i=0;i<eligible.length;i++){
      const result=invoke(variant,eligible[i]!,accesses[i]!,budgets[i]!);
      if(result){found++;paths+=result.path.length;}
      pairs+=32768-budgets[i]!.pairs;
    }
    samples.push({round,slot:slot+1,variant,milliseconds:performance.now()-start,calls:eligible.length,proposals:found,pathCells:paths,pairUse:pairs});
  }
  const first=samples[0]!;
  if(samples.some(s=>s.proposals!==first.proposals||s.pathCells!==first.pathCells||s.pairUse!==first.pairUse))throw new Error('Frozen-world proposal totals changed.');
  if(serializeWorld(world)!==before||world.rng!==rng.world||world.fires?.rng!==rng.fire||world.wildlife?.rng!==rng.wildlife)throw new Error('Proposal mutated World or PRNG.');
  if(createHash('sha256').update(readFileSync(SOURCE_PATH)).digest('hex')!==sourceHash)throw new Error('Source changed during benchmark.');
  const summary=(variant:Variant)=>{const times=samples.filter(s=>s.variant===variant).map(s=>s.milliseconds),ordered=[...times].sort((a,b)=>a-b);
    return {batches:times.length,callsPerBatch:eligible.length,meanMs:times.reduce((a,b)=>a+b,0)/times.length,medianMs:(ordered[3]!+ordered[4]!)/2,p95Ms:ordered[Math.ceil(ordered.length*.95)-1]!};};
  let commit:string|null=null;try{commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{}
  const old=summary('old'),current=summary('new');
  // Prepared stress case: service claims occupy the first 24 physically free
  // stations in one worker's ranking. This is a proposal-only fixture, not a
  // valid colony continuation or a measurement of natural claim frequency.
  const controlled=structuredClone(world),worker=controlled.pawns.find(p=>availableCookingStations(controlled,p).filter(s=>cookingPlaceFree(controlled,cookingSpot(s))).length>=25);
  if(!worker)throw new Error('Need at least 25 free service spots for the controlled scenario.');
  const ranked=availableCookingStations(controlled,worker).sort((a,b)=>storedPriority(worker,stationWork(a))-storedPriority(worker,stationWork(b))||distance(worker,a)-distance(worker,b)||a.id-b.id);
  const claimed=ranked.filter(s=>cookingPlaceFree(controlled,cookingSpot(s))).slice(0,24);
  const claimants=controlled.pawns.filter(p=>p.id!==worker.id).slice(0,claimed.length);
  const researchStation=controlled.structures.find(s=>s.kind==='research-bench')!;
  for(let i=0;i<claimed.length;i++)claimants[i]!.research={stationId:researchStation.id,spot:cookingSpot(claimed[i]!),worked:0};
  if(claimed.some(s=>!reservedServiceCells(controlled,worker.id).has(cookingSpot(s).z*controlled.width+cookingSpot(s).x)))throw new Error('Controlled service claims were not installed.');
  const controlledBefore=JSON.stringify(controlled),controlledBlocked=blockedCells(controlled);
  const controlledReach=()=>candidateAccess(controlled,worker,controlledBlocked,CIVIL_TRANSIT_BLOCKERS,true);
  const oldBudget={pairs:32768},newBudget={pairs:32768};
  const oldProposal=legacyPlanCooking(controlled,worker,controlledReach(),oldBudget),newProposal=planCooking(controlled,worker,controlledReach(),newBudget);
  if(!sameProposal(oldProposal,newProposal)||oldBudget.pairs!==newBudget.pairs)throw new Error('Controlled proposal mismatch.');
  const controlledSamples:Array<{round:number;slot:number;variant:Variant;milliseconds:number;calls:number;proposals:number;pathCells:number;pairUse:number}>=[];
  const calls=49;
  for(let round=1;round<=4;round++)for(const [slot,variant] of (['old','new','new','old'] as const).entries()){
    const reaches=Array.from({length:calls},controlledReach),budgets=Array.from({length:calls},()=>({pairs:32768}));
    let found=0,paths=0,pairs=0;
    const start=performance.now();
    for(let i=0;i<calls;i++){
      const result=variant==='old'?legacyPlanCooking(controlled,worker,reaches[i]!,budgets[i]!):planCooking(controlled,worker,reaches[i]!,budgets[i]!);
      if(result){found++;paths+=result.path.length;}
      pairs+=32768-budgets[i]!.pairs;
    }
    controlledSamples.push({round,slot:slot+1,variant,milliseconds:performance.now()-start,calls,proposals:found,pathCells:paths,pairUse:pairs});
  }
  const controlledSummary=(variant:Variant)=>{const times=controlledSamples.filter(s=>s.variant===variant).map(s=>s.milliseconds),ordered=[...times].sort((a,b)=>a-b);
    return {batches:times.length,callsPerBatch:calls,meanMs:times.reduce((a,b)=>a+b,0)/times.length,medianMs:(ordered[3]!+ordered[4]!)/2,p95Ms:ordered[Math.ceil(ordered.length*.95)-1]!};};
  if(JSON.stringify(controlled)!==controlledBefore)throw new Error('Controlled proposal mutated the prepared World.');
  const controlledOld=controlledSummary('old'),controlledNew=controlledSummary('new');
  const report={timestamp:new Date().toISOString(),commit,runtime:process.version,platform:process.platform,cpuModel:cpus()[0]?.model??'unknown',
    source:{path:SOURCE_PATH,sha256:sourceHash},fixture:{path:SAVE_PATH,sha256:createHash('sha256').update(stored).digest('hex'),
      originalSchema:JSON.parse(raw).schemaVersion,migratedSchema:world.schemaVersion,tick:world.tick,width:world.width,height:world.height,pawns:world.pawns.length,stations:world.structures.filter(s=>!!s.bills?.length).length},
    protocol:{sequence:'A/B/B/A',rounds:4,warmupCalls:eligible.length*2,oraclePawns:world.pawns.length,measuredPawns:eligible.length,
      oracle:'Complete proposal, ordered path and ingredients, remaining pair budget, unchanged serialized World and PRNG.',
      reachability:'Independent fresh CandidateAccess per invocation, constructed outside measured batch.',
      limitation:'Frozen mixed world; proposal only, not whole-tick, worker, browser or GPU throughput.'},
    oracle:{proposals,pathCells,pairUse},samples,old,current,ratioOldOverNew:old.meanMs/current.meanMs,
    controlled:{description:'Prepared proposal-only scenario, 24 service spots claimed by other pawns; not a valid gameplay continuation.',workerId:worker.id,claimedStations:claimed.map(s=>s.id),
      oracle:{proposal:oldProposal,pairsRemaining:oldBudget.pairs,worldUnchanged:true},samples:controlledSamples,old:controlledOld,current:controlledNew,ratioOldOverNew:controlledOld.meanMs/controlledNew.meanMs}};
  mkdirSync('tmp',{recursive:true});writeFileSync(OUTPUT_PATH,`${JSON.stringify(report,null,2)}\n`);
  console.log(JSON.stringify({output:OUTPUT_PATH,oracle:report.oracle,measuredPawns:eligible.length,old,current,ratioOldOverNew:report.ratioOldOverNew,
    controlled:{claimedStations:claimed.length,old:controlledOld,current:controlledNew,ratioOldOverNew:report.controlled.ratioOldOverNew}},null,2));
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])runBenchmark();
