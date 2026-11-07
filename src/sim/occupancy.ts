import { footprintContains } from './definitions.ts';
import type { Cell, JobKind, StructureKind, World } from './types.ts';

/** Core coexistence rules are distinct from our current planar transit rules.
 * Surface Eat admits existing items, but is not a storage-zone surface. */
export const OCCUPANCY = Object.freeze({
  // Local coexistence policy for a traversable device, independent of standability.
  'firefoam-popper':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'smooth-floor':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'ship-cryptosleep-casket':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'ship-beam':Object.freeze({clearItems:true,items:false,zones:false,store:false}),'ship-engine':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'ship-reactor':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'ship-computer':Object.freeze({clearItems:true,items:false,zones:false,store:false}),'ship-sensors':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'fueled-smithy':Object.freeze({clearItems:false,items:true,zones:false,store:false}),'electric-smithy':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  brewery:Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'fermenting-barrel':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'insect-hive':Object.freeze({clearItems:true,items:false,zones:false,store:false}),'glow-pod':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'ancient-cryptosleep-casket':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'cryptosleep-casket':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  column:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  urn:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'stele-large':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'stele-grand':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  sarcophagus:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'ancient-road-barrier':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'ancient-road-lamp':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'ship-chunk':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  bedroll:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'build-bridge':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'remove-bridge':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  shelf:Object.freeze({clearItems:true,items:true,zones:false,store:true}),
  'small-shelf':Object.freeze({clearItems:true,items:true,zones:false,store:true}),
  'spike-trap':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'electric-crematorium':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'electric-smelter':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'biofuel-refinery':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'geothermal-generator':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'chemfuel-generator':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'nutrient-paste-dispenser':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  hopper:Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'orbital-beacon':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'comms-console':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'deep-drill':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'ground-scanner':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'vitals-monitor':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'drug-lab':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'hydroponics-basin':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'mini-turret':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'tube-television':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  sandbags:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  fence:Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'fence-gate':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'pen-marker':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'art-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'fabrication-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'hi-tech-research-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'multi-analyzer':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'small-sculpture':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'large-sculpture':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  grave:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'lay-floor':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'remove-floor':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  heater:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'wind-turbine':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'power-conduit':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'power-switch':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  battery:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'solar-generator':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'fueled-stove':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'electric-stove':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'butcher-table':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'butcher-spot':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  cooler:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  vent:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'research-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'tailor-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'machining-table':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'electric-tailor-bench':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'sleeping-spot':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'animal-sleeping-spot':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'crafting-spot':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'build-roof': Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'remove-roof': Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'wood-generator':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'torch-lamp':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'standing-lamp':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'sun-lamp':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'passive-cooler': Object.freeze({clearItems:true,items:false,zones:true,store:false}),
  door: Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  autodoor: Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  stonecutter: Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  wall: Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'double-bed':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  bed: Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'hospital-bed':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  table: Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'table-square':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  'table-long':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  stool: Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'dining-chair':Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  armchair:Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'end-table':Object.freeze({clearItems:false,items:true,zones:false,store:false}),
  dresser:Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  'flower-pot':Object.freeze({clearItems:true,items:false,zones:false,store:false}),
  campfire: Object.freeze({clearItems:true,items:false,zones:true,store:false}),
  horseshoes: Object.freeze({clearItems:false,items:true,zones:true,store:true}),
  'chess-table': Object.freeze({clearItems:false,items:true,zones:false,store:false}),
});
export const occupancyOf=(kind:JobKind|StructureKind)=>kind in OCCUPANCY?OCCUPANCY[kind as StructureKind]:undefined;
export const clearsGroundItems=(world:World,kind:JobKind|StructureKind)=>world.schemaVersion<21||occupancyOf(kind)?.clearItems!==false;
export const occupies=footprintContains;
/** Quantitative capacity and reservations are checked by ground-placement. */
export function groundOccupancyAllows(world:World,cell:Cell):boolean {
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height||['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain))return false;
  for(const s of world.structures)if(occupies(s,cell)&&(world.schemaVersion<21?s.kind==='wall':!OCCUPANCY[s.kind].items))return false;
  if(world.schemaVersion<16)for(const j of world.jobs)if(j.kind==='wall'&&occupies(j,cell))return false;
  return true;
}
/** Same verdict as groundOccupancyAllows for an in-map integer cell, given
 * the structures whose footprint contains that cell, in source order. */
export function groundOccupancyAllowsAt(world:World,cell:Cell,occupants:readonly World['structures'][number][]):boolean {
  if(!Number.isInteger(cell.x)||!Number.isInteger(cell.z)||cell.x<0||cell.z<0||cell.x>=world.width||cell.z>=world.height||['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain))return false;
  for(const s of occupants)if(world.schemaVersion<21?s.kind==='wall':!OCCUPANCY[s.kind].items)return false;
  if(world.schemaVersion<16)for(const j of world.jobs)if(j.kind==='wall'&&occupies(j,cell))return false;
  return true;
}
export function storageOccupancyAllows(world:World,cell:Cell):boolean {
  for(const s of world.structures)if(occupies(s,cell)&&!OCCUPANCY[s.kind].store)return false;
  for(const j of world.jobs)if(occupies(j,cell)&&occupancyOf(j.furniture?.kind??j.kind)?.store===false)return false;
  return true;
}
