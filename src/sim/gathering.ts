import { tryAddGroundMaterial } from './materials.ts';
import {markResourceChanged,markResourceArrayChanged} from './resource-mutation-journal.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { cropProduct } from './crops.ts';
import { FLORA_DEFINITIONS,PROSPECTIVE_PLANT_SPECIES_256 } from './biome-flora.ts';
import {plantHarvestWorkCore} from './construction-plants.ts';
import { isCrop, plantGrowth, AFTER_HARVEST_GROWTH, choppable, harvestable, harvestRoll,plantCanYieldNow } from './plants.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { releaseWork } from './work-release.ts';
import { designateBlightedCrops } from './crop-blight-orders.ts';
import type { Pawn, Resource, World } from './types.ts';
import {DEAD_STUMP_SPECIES_382,isDeadStump382} from './native-special-plants-382.ts';
import {treeLeavesStump382,treeStump382} from './stump-birth-382.ts';

/** Harvest and construction clearing share one conservative producer. null
 * leaves resource, RNG and material unchanged when output cannot be placed. */
export function gatherResource(world: World, resource: Resource, kind:'chop'|'harvest'|'cut', producerJobId?:number, worker?:Pawn): number|null {
  if(kind==='harvest'&&!harvestable(world,resource)||kind==='chop'&&!choppable(world,resource))return null;
  const currentCut=kind==='cut'&&world.schemaVersion>=235;
  // CUT235 attempts the common worker yield only for a currently yieldable
  // source. All pre235 paths remain literal, including legacy no-worker draws.
  const roll=currentCut?(plantCanYieldNow(world,resource)?harvestRoll(world,resource,worker):{quantity:0,rng:world.rng}):
    kind==='chop'&&!resource.species&&!worker?{quantity:resource.amount,rng:world.rng}:kind==='cut'&&(world.schemaVersion>=235&&resource.kind==='tree'||resource.blight||resource.species||resource.kind==='healroot'||resource.kind==='haygrass'||resource.kind==='hops')?{quantity:0,rng:world.rng}:harvestRoll(world,resource,kind==='cut'?undefined:worker);
  const originalGrowth=world.schemaVersion>=382&&resource.kind==='tree'&&resource.species!==undefined?plantGrowth(world,resource):0;
  const leavesStump=treeLeavesStump382(world,resource,originalGrowth),manualCut=leavesStump&&kind==='cut'&&world.jobs.some(j=>j.id===producerJobId&&j.kind==='cut');
  if(leavesStump&&!Number.isSafeInteger(world.nextId+roll.quantity+(manualCut?2:1)))return null;
  if(roll.quantity>0) {
    const item=resource.species?FLORA_DEFINITIONS[resource.species].product:
      kind==='chop'||currentCut&&resource.kind==='tree'?'wood':isCrop(resource)?cropProduct(resource.kind):world.foodRules==='legacy'?'legacy-portion':'berries';
    if(!item)return null;
    if(!tryAddGroundMaterial(world,ITEM_DEFINITIONS[item].kind,roll.quantity,resource,item))return null;
  }
  if(kind==='cut'&&resource.blight)designateBlightedCrops(world,resource);
  world.rng=roll.rng;
  const removed=!(kind==='harvest'&&(resource.species?FLORA_DEFINITIONS[resource.species].persistent:resource.kind==='berries'));
  let stump:Resource|undefined;
  if(!removed){resource.growth=AFTER_HARVEST_GROWTH;resource.growthTick=world.tick;markResourceChanged(world,resource);}
  else {const beforeResources=world.resources;world.resources=world.resources.filter(r=>r.id!==resource.id);if(leavesStump){stump=treeStump382(world,resource,originalGrowth,'chopped-stump');world.resources.push(stump);}markResourceArrayChanged(world,beforeResources,stump?[stump]:[],[resource]);}
  // A roof or construction worker can finish clearing after a separate chop
  // was designated. Only the successful producer keeps the yield; its rivals
  // and their actor/queue claims must disappear with the consumed resource.
  if(removed){
    const obsolete=new Set(world.jobs.filter(j=>j.id!==producerJobId&&j.x===resource.x&&j.z===resource.z&&['chop','harvest','cut','extract-tree'].includes(j.kind)).map(j=>j.id));
    if(obsolete.size){
      for(const pawn of world.pawns)if(pawn.jobId!==null&&obsolete.has(pawn.jobId)&&!releaseWork(world,pawn))interruptWork(world,pawn);
      for(const pawn of world.pawns)if(pawn.orders.queue.length)pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!obsolete.has(order));
      world.jobs=world.jobs.filter(j=>!obsolete.has(j.id));
    }
    for(const job of world.jobs)if(job.id!==producerJobId&&job.clearance?.resourceId===resource.id){
      for(const pawn of world.pawns){
        if(pawn.jobId===job.id&&!releaseWork(world,pawn))interruptWork(world,pawn);
        pawn.orders.queue=pawn.orders.queue.filter(order=>order!==job.id);
      }
      delete job.clearance;delete job.installationWork;job.reservedBy=null;job.status='pending';
    }
    for(const animal of world.wildlife?.animals??[])if(animal.meal?.kind==='plant'&&animal.meal.id===resource.id){delete animal.meal;animal.path=[];animal.nextDecision=world.tick;}
    // Player CutPlant, unlike Chop, explicitly queues removal of the created
    // stump. The actual planner owns the next reservation/contact work.
    if(stump&&manualCut)world.jobs.push({id:world.nextId++,kind:'cut',plantTarget:{resourceId:stump.id},x:stump.x,z:stump.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  }
  return roll.quantity;
}
/** Select at the actual resolution: clearing does not require a mature yield. */
export const clearingKind=(world:World,resource:Resource):'chop'|'cut'=>(resource.kind==='tree'||isDeadStump382(resource.species))&&choppable(world,resource)?'chop':'cut';
const prospectiveWorkSpecies256:ReadonlySet<string>=new Set([...PROSPECTIVE_PLANT_SPECIES_256,'ambrosia',...DEAD_STUMP_SPECIES_382]);
/** New identities are admitted only by schema256; no historical work changed. */
export const prospectivePlantWorkCore256=(resource:Pick<Resource,'kind'|'species'>):number|undefined=>resource.species!==undefined&&prospectiveWorkSpecies256.has(resource.species)?plantHarvestWorkCore(resource):undefined;
/** One local work unit is ten Core ticks. Work speed is applied by the caller,
 * not baked into this threshold; all historical durations remain literal. */
export const clearingDuration=(resource:Resource):number=>{const core=prospectivePlantWorkCore256(resource);return core===undefined?resource.kind==='tree'?100:isCrop(resource)?20:60:core/10;};
/** Core PlantWork WorkDonePerTick growth multiplier, separate from stat/light.
 * Float32 arithmetic matches the actual Lerp constants and clamped growth. */
export function plantWorkGrowthFactor256(world:World,resource:Resource):number {
 if(world.schemaVersion<256||prospectivePlantWorkCore256(resource)===undefined)return 1;
 const growth=Math.fround(Math.max(0,Math.min(1,plantGrowth(world,resource)))),start=Math.fround(3.3);
 return Math.fround(start+Math.fround(Math.fround(1-start)*growth));
}
