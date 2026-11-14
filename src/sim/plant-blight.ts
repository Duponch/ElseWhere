import { isCrop,plantGrowth } from './plants.ts';
import { cancelResourceHarvests,damageResource } from './thing-damage.ts';
import type { Resource,World } from './types.ts';

export interface CropBlightState {
  since:number;
  severity:number;
  lastHarmTick:number;
  nextCheck:number;
  rng:number;
}

export const CROP_BLIGHT_INTERVAL=200;
export const CROP_BLIGHT_HARM_INTERVAL=6000;
export const CROP_BLIGHT_RADIUS=4;
const safeClock=(world:World):boolean=>Number.isSafeInteger(world.tick)&&world.tick>=0&&Number.isSafeInteger(world.tick+CROP_BLIGHT_INTERVAL);

/** Explicit cultivated growth distinguishes the five sown crops from flora.
 * Callers discovering candidates already walk the world's resource list. */
export function cropBlightable(world:World,plant:Resource):boolean {
  return world.schemaVersion>=205&&isCrop(plant)&&plant.species===undefined&&!plant.blight&&
    plant.growth!==undefined&&plant.growth>=.0001;
}

interface BlightIndex {source:Resource[];buckets:Resource[][];cells:Map<number,Resource>}
const indices=new WeakMap<World,BlightIndex>();
function capture(world:World):BlightIndex {
  let index=indices.get(world);
  if(!index||index.source!==world.resources){
    const buckets=Array.from({length:CROP_BLIGHT_INTERVAL},()=>[] as Resource[]),cells=new Map<number,Resource>();
    // Wild flora (most resources) has a species: tested first, the same result.
    for(const plant of world.resources)if(plant.species===undefined&&isCrop(plant)){
      cells.set(plant.z*world.width+plant.x,plant);
      if(plant.blight)buckets[plant.blight.nextCheck%CROP_BLIGHT_INTERVAL]!.push(plant);
    }
    index={source:world.resources,buckets,cells};indices.set(world,index);
  }
  return index;
}

export function infectCrop(world:World,plant:Resource,seed:number):boolean {
  if(!safeClock(world)||!cropBlightable(world,plant)||!Number.isInteger(seed)||seed<1||seed>0xffffffff||!world.resources.includes(plant))return false;
  // Settle the healthy interval before suspending any subsequent growth.
  plant.growth=plantGrowth(world,plant);plant.growthTick=world.tick;
  plant.blight={since:world.tick,severity:.2,lastHarmTick:world.tick,
    nextCheck:world.tick+(plant.id-world.tick%CROP_BLIGHT_INTERVAL+CROP_BLIGHT_INTERVAL)%CROP_BLIGHT_INTERVAL+1,rng:seed};
  cancelResourceHarvests(world,plant);
  const index=indices.get(world);
  if(index?.source===world.resources)index.buckets[plant.blight.nextCheck%CROP_BLIGHT_INTERVAL]!.push(plant);
  return true;
}

function random(state:CropBlightState):number {
  let value=state.rng;value^=value<<13;value^=value>>>17;value^=value<<5;
  state.rng=value>>>0;return state.rng/0x100000000;
}
/** Core checks each equidistant ring and chooses uniformly within the first
 * one containing an eligible crop. Species, roof and room never filter spread. */
function reproduce(world:World,source:Resource,index:BlightIndex):void {
  let distance=Infinity;
  const candidates:Resource[]=[];
  for(let z=Math.max(0,source.z-CROP_BLIGHT_RADIUS);z<=Math.min(world.height-1,source.z+CROP_BLIGHT_RADIUS);z++)
    for(let x=Math.max(0,source.x-CROP_BLIGHT_RADIUS);x<=Math.min(world.width-1,source.x+CROP_BLIGHT_RADIUS);x++){
      const squared=(x-source.x)**2+(z-source.z)**2;
      if(!squared||squared>CROP_BLIGHT_RADIUS**2||squared>distance)continue;
      const plant=index.cells.get(z*world.width+x);
      if(!plant||!cropBlightable(world,plant))continue;
      if(squared<distance){distance=squared;candidates.length=0;}
      candidates.push(plant);
    }
  if(!candidates.length)return;
  const state=source.blight!,target=candidates[Math.floor(random(state)*candidates.length)]!;
  random(state);infectCrop(world,target,state.rng);
}

/** Derived phase buckets are rebuilt after resource replacement and updated
 * on infection. Quiet ticks do not walk the forest or draw gameplay RNG. */
export function advanceCropBlight(world:World):void {
  if(world.schemaVersion<205||!safeClock(world))return;
  const index=capture(world),due=index.buckets[world.tick%CROP_BLIGHT_INTERVAL]!;
  // New infections have a strictly future phase, including during this loop.
  for(const plant of due){
    const state=plant.blight;if(!state||state.nextCheck!==world.tick)continue;
    state.nextCheck+=CROP_BLIGHT_INTERVAL;
    if(world.tick-state.lastHarmTick>=CROP_BLIGHT_HARM_INTERVAL){
      state.lastHarmTick=world.tick;
      damageResource(world,plant,5,'blight');
      if(!world.resources.includes(plant))continue;
    }
    state.severity=Math.min(1,state.severity+1/30);
    if(state.severity<.28)continue;
    const mtbHours=16.8+(2.1-16.8)*(state.severity-.28)/.72;
    if(random(state)<.8/mtbHours)reproduce(world,plant,index);
  }
}
