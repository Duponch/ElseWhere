import { footprintCells,footprintContains } from './definitions.ts';
import { cancelGrowingJobs,resourceAt } from './farming.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { isPlant } from './plants.ts';
import { isPowerActive } from './power-rules.ts';
import { damageResource,resourceMaxHp } from './thing-damage.ts';
import type { Cell,GrowingZone,Structure,World } from './types.ts';

export const HYDROPONIC_FERTILITY=2.8;
export const HYDROPONIC_ROT_INTERVAL=25;
export const hydroponicCropAllowed=(plant:unknown):boolean=>plant==='hops'||plant==='rice'||plant==='potato'||plant==='cotton'||plant==='healroot'||plant==='tinctoria';

/** Presentation captures this small derived field once per update. Rebuild from
 * the current zones: neither a mutable array nor a returned Map owns a cache. */
export function readHydroponicCells(world:World):ReadonlyMap<number,number> {
  const cells=new Map<number,number>();
  for(const zone of world.growingZones)if(zone.basinId!==undefined)for(const cell of zone.cells)cells.set(cell,zone.basinId);
  return cells;
}

/** Ordinary soil queries inspect only the few growing policies. A building
 * lookup is needed only when this exact cell belongs to a linked basin. */
export function hydroponicBasinAt(world:World,cell:Cell):Structure|undefined {
  const index=cell.z*world.width+cell.x;
  const zone=world.growingZones.find(z=>z.basinId!==undefined&&z.cells.includes(index));
  if(!zone)return undefined;
  const basin=world.structures.find(s=>s.id===zone.basinId&&s.kind==='hydroponics-basin');
  return basin&&footprintContains(basin,cell)?basin:undefined;
}
export const hydroponicFertility=(world:World,cell:Cell):number|undefined=>hydroponicBasinAt(world,cell)?HYDROPONIC_FERTILITY:undefined;
export function hydroponicSowingAllowed(world:World,zone:GrowingZone):boolean {
  if(zone.basinId===undefined)return true;
  if(!hydroponicCropAllowed(zone.plant)||!zone.cells.length)return false;
  const cell=zone.cells[0]!,basin=hydroponicBasinAt(world,{x:cell%world.width,z:Math.floor(cell/world.width)});
  return !!basin&&basin.id===zone.basinId&&isPowerActive(basin);
}

/** Called after the building's admitted placement. Construction already clears
 * incompatible drawn zones and reserves capacity for the separate policy ID. */
export function initializeHydroponicBasin(world:World,basin:Structure):void {
  if(basin.kind!=='hydroponics-basin'||!world.structures.includes(basin)||world.growingZones.some(z=>z.basinId===basin.id))return;
  const footprint=footprintCells(basin);
  if(footprint.length!==4||footprint.some(c=>c.x<0||c.z<0||c.x>=world.width||c.z>=world.height)||!Number.isSafeInteger(world.nextId+1))return;
  const cells=footprint.map(c=>c.z*world.width+c.x).sort((a,b)=>a-b);
  if(world.growingZones.some(z=>z.cells.some(c=>cells.includes(c))))return;
  world.growingZones=[...world.growingZones,{id:world.nextId++,basinId:basin.id,cells,plant:'rice',allowSow:true,allowCut:true}];
  world.growingCursor=0;
}

/** Called only after removal commits. Forced interruption preserves a carried
 * item even when a full floor prevents its immediate conservative deposit. */
export function removeHydroponicPlants(world:World,basin:Structure):void {
  if(basin.kind!=='hydroponics-basin')return;
  const zones=new Set(world.growingZones.filter(z=>z.basinId===basin.id).map(z=>z.id));
  const jobs=new Set(world.jobs.filter(j=>j.growingZoneId!==undefined&&zones.has(j.growingZoneId)).map(j=>j.id));
  for(const pawn of world.pawns)if(pawn.jobId!==null&&jobs.has(pawn.jobId)||pawn.haul?.destination.type==='aside'&&zones.has(pawn.haul.destination.growingZoneId??-1))interruptWork(world,pawn);
  cancelGrowingJobs(world,zones);
  for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!jobs.has(order));
  world.growingZones=world.growingZones.filter(z=>!zones.has(z.id));world.growingCursor=0;
  for(const cell of footprintCells(basin)) {
    const plant=resourceAt(world,cell.z*world.width+cell.x);
    if(plant&&isPlant(plant))damageResource(world,plant,resourceMaxHp(plant),'rotting');
  }
}

/** Core rare ticks become 25 local ticks, with a stable building-ID phase.
 * Loss of power damages plants gradually; fertility and their growth continue. */
export function advanceHydroponics(world:World):void {
  if(!world.growingZones.some(z=>z.basinId!==undefined))return;
  const due=world.structures.filter(s=>s.kind==='hydroponics-basin'&&!isPowerActive(s)&&world.tick%HYDROPONIC_ROT_INTERVAL===s.id%HYDROPONIC_ROT_INTERVAL);
  for(const basin of due)for(const cell of footprintCells(basin)) {
    const plant=resourceAt(world,cell.z*world.width+cell.x);
    if(plant&&isPlant(plant))damageResource(world,plant,1,'rotting');
  }
}
