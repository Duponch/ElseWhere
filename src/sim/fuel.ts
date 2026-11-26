import {structureFamily379} from './structure-family-379.ts';
import { weatherRainRate } from './weather.ts';
import { isRoofed } from './roof-rules.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { isCookingOrder } from './order-types.ts';
import { reservedDestination } from './materials.ts';
import type { Structure, World } from './types.ts';

/** Integer reserve units per physical fuel item; appliance rates remain distinct. */
export const FUEL_UNIT_TICKS = 600;
export const WOOD_BURN_TICKS = FUEL_UNIT_TICKS;
export const fuelItem = (kind:unknown):'wood'|'chemfuel' => kind==='chemfuel-generator'?'chemfuel':'wood';
export const CAMPFIRE_CAPACITY = 20 * WOOD_BURN_TICKS;
export const PASSIVE_COOLER_CAPACITY = 50 * WOOD_BURN_TICKS;
export const isFueledBuilding = (kind:unknown):boolean => kind==='fueled-smithy'||kind==='torch-lamp'||kind==='campfire'||kind==='passive-cooler'||kind==='wood-generator'||kind==='chemfuel-generator'||kind==='fueled-stove';
export const fuelLimit = (kind:unknown):number => kind==='chemfuel-generator'?30*FUEL_UNIT_TICKS:kind==='wood-generator'?75*WOOD_BURN_TICKS:kind==='fueled-smithy'||kind==='fueled-stove'||kind==='passive-cooler'?PASSIVE_COOLER_CAPACITY:kind==='torch-lamp'||kind==='campfire'?CAMPFIRE_CAPACITY:0;
export const newBuildingFuel = (kind:Structure['kind']):FuelState => ({ticks:kind==='wood-generator'||kind==='chemfuel-generator'||kind==='fueled-stove'||kind==='fueled-smithy'?0:fuelLimit(kind),burned:0,autoRefuel:true,...kind==='torch-lamp'||kind==='wood-generator'||kind==='chemfuel-generator'?{burnRemainder:0}:{}});
export function refuelable(world:World,id:number):Structure|undefined {return world.structures.find(s=>s.id===id&&isFueledBuilding(s.kind));}
export const AUTO_REFUEL_THRESHOLD = .3;
export const REFUEL_WORK_TICKS = 24;
export interface FuelState { burnRemainder?:number; ticks: number; burned: number; autoRefuel: boolean }
export function newCampfireFuel(): FuelState { return {ticks:CAMPFIRE_CAPACITY,burned:0,autoRefuel:true}; }
export function campfire(world: World, id: number): Structure | undefined {
  return world.structures.find(s => s.id === id && s.kind === 'campfire');
}
/** Waiting refuels reserve the workstation as well as their fuel. */
export function fuelStationReserved(world: World, id: number, exceptPawn?: number): boolean {
  if(deconstructionReserved(world,id,exceptPawn))return true;
  for(const p of world.pawns) {
    if(p.id!==exceptPawn&&(p.cooking?.stationId===id||p.haul?.destination.type==='fuel'&&p.haul.destination.structureId===id))return true;
    for(const task of p.orders?.queue??[])if(typeof task!=='number'&&(isCookingOrder(task)?task.cooking.stationId===id:task.destination.type==='fuel'&&task.destination.structureId===id))return true;
  }
  return false;
}
export function fuelCapacity(world: World, id: number, exceptPawn?: number, forced=false): number {
  const fire=refuelable(world,id);
  if (!fire?.fuel || !forced&&(fire.power?.switchOn===false||world.jobs.some(j=>j.flick?.structureId===id)) || !forced&&!fire.fuel.autoRefuel || fuelStationReserved(world,id,exceptPawn)) return 0;
  // Whole physical fuel items only: never silently discard a fractional refill overflow.
  return Math.max(0,Math.floor((fuelLimit(fire.kind)-fire.fuel.ticks)/FUEL_UNIT_TICKS)-reservedDestination(world,{type:'fuel',structureId:id},exceptPawn));
}
export function wantsFuel(world: World, fire: Structure): boolean {
  return isFueledBuilding(fire.kind) && !!fire.fuel?.autoRefuel && fire.fuel.ticks <= fuelLimit(fire.kind)*AUTO_REFUEL_THRESHOLD && fuelCapacity(world,fire.id)>0;
}
/** Reports a torch going dark, so an already captured decision light can be retired. */
export function burnFuel(world: World): boolean {
  let torchExtinguished=false;
  // RainRate includes snowfall; compute once, then use the current roof at each torch.
  const wet=weatherRainRate(world)>.4;
  for (const fire of structureFamily379(world,'fueled-buildings',isFueledBuilding)) if (isFueledBuilding(fire.kind) && fire.kind!=='fueled-stove'&&fire.kind!=='fueled-smithy' && fire.fuel && fire.fuel.ticks>0 && fire.power?.switchOn!==false&&!fire.breakdown) {
    const f=fire.fuel;let amount=1;
    if(fire.kind==='torch-lamp'){const total=(f.burnRemainder??0)+(wet&&!isRoofed(world,fire.z*world.width+fire.x)?19:1);amount=Math.floor(total/5);f.burnRemainder=total%5;}
    else if(fire.kind==='wood-generator'){const total=(f.burnRemainder??0)+11;amount=Math.floor(total/5);f.burnRemainder=total%5;}
    else if(fire.kind==='chemfuel-generator'){const total=(f.burnRemainder??0)+9;amount=Math.floor(total/20);f.burnRemainder=total%20;}
    amount=Math.min(amount,f.ticks);f.ticks-=amount;f.burned+=amount;
    if((fire.kind==='torch-lamp'||fire.kind==='wood-generator'||fire.kind==='chemfuel-generator')&&!f.ticks){f.burnRemainder=0;if(fire.kind==='torch-lamp')torchExtinguished=true;if(fire.power)fire.power.on=false;}
  }
  return torchExtinguished;
}
/** Usage-only consumers: stove160 and smithy80 wood per6000 local work
 * ticks. The final partial reserve grants only its corresponding work. */
export function consumeCookingFuel(station:Structure):number {
  if(station.kind!=='fueled-stove'&&station.kind!=='fueled-smithy')return 1;
  const fuel=station.fuel;if(!fuel)return 0;
  const rate=station.kind==='fueled-smithy'?8:16,amount=Math.min(rate,fuel.ticks);fuel.ticks-=amount;fuel.burned+=amount;
  return amount/rate;
}
