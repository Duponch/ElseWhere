import {filteredStructures} from './structure-navigation.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import { footprintCells,footprintContains } from './definitions.ts';
import { bodySizeAtAge,adultAgeTicks } from './animal-life.ts';
import { ANIMAL_SPECIES } from './animal-species.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { storageAccepts } from './storage-filters.ts';
import type { StorageConditions } from './storage-condition.ts';
import {SCHEMA_VERSION} from './types.ts';
import type { Cell,MaterialPile,StockpileCell,StorageFilters,Structure,World } from './types.ts';

export type ShelfKind='shelf'|'small-shelf';
export const isShelfKind=(kind:string):kind is ShelfKind=>kind==='shelf'||kind==='small-shelf';
export interface ShelfStorageSettings extends StorageConditions {filters:StorageFilters;priority:number;capacity:number;items?:Partial<Record<ItemId,boolean>>}
/** Cell identities belong to the same building through construction and packing. */
export interface ShelfStorageState {cells:number[];settings:ShelfStorageSettings;linked286?:import('./linked-storage-state-286.ts').LinkedShelfMember286}
export interface StorageCell extends StockpileCell {shelfId?:number}
export function newShelfStorage(cells:readonly number[],version:number=SCHEMA_VERSION):ShelfStorageState {
  return {cells:[...cells],settings:{priority:3,capacity:500,filters:{...(isSchema298OrLater(version)?{'ai-core':true}:{}),...((version===295||(version===296||isCorePhysicalSchema297(version)))?{book:true}:{}),...(isSchema273OrLater(version)?{prosthesis:true}:{}),...(version>=265?{wort:true,beer:true}:{}),wood:true,food:true,chemfuel:true,neutroamine:true,silver:true,unfinished:true,textile:true,steel:true,gold:true,uranium:true,plasteel:true,component:true,'advanced-component':true,medicine:true,weapon:true,apparel:true,blocks:true}}};
}
/** Fixed physical exclusions are independent of the player's policy. */
export function shelfFixedAccepts(subject:ItemId|MaterialPile):boolean {
  const item=typeof subject==='string'?subject:subject.item,kind=ITEM_DEFINITIONS[item].kind;
  if(kind==='chunk'||kind==='mech-corpse')return false;
  if(kind!=='corpse')return true;
  if(typeof subject!=='string')return !!subject.corpse&&!subject.humanCorpse&&bodySizeAtAge(subject.corpse.species,subject.corpse.ageTicks??adultAgeTicks(subject.corpse.species),subject.corpse.growthTracker?.value)<.75;
  // A string is only a conservative placement prefilter. Real bodies use age.
  return Object.values(ANIMAL_SPECIES).some(s=>s.corpseItem===item&&s.bodySize<.75);
}
export function shelfAt(world:Pick<World,'structures'>,cell:Cell):Structure|undefined {
  return world.structures.find(s=>isShelfKind(s.kind)&&s.shelf&&footprintContains(s,cell));
}
export function groundMaxStacks(world:Pick<World,'structures'>,cell:Cell):number {return shelfAt(world,cell)?3:1;}
export function shelfStorageCells(s:Structure):StorageCell[] {
  if(!isShelfKind(s.kind)||!s.shelf)return [];
  return footprintCells(s).map((c,i)=>({id:s.shelf!.cells[i]!,...c,...s.shelf!.settings,shelfId:s.id}));
}
/** A read-only decision view, never a second mutable storage registry. */
export function storageCells(world:Pick<World,'stockpiles'|'structures'>&Partial<Pick<World,'schemaVersion'|'worldFactions'>>):StorageCell[] {
  // shelfStorageCells is empty but for shelf kinds: on a full World, the shared
  // per-kind list visits the same shelves in the same order.
  const structures='width' in world&&'tiles' in world?filteredStructures(world as World,'shelf-kinds',s=>isShelfKind(s.kind)):world.structures;
  return [...world.stockpiles,...structures.filter(s=>targetBuildingPlayerUse263(world,s)).flatMap(shelfStorageCells)];
}
export function storageCellById(world:Pick<World,'stockpiles'|'structures'>&Partial<Pick<World,'schemaVersion'|'worldFactions'>>,id:number):StorageCell|undefined {
  const zone=world.stockpiles.find(z=>z.id===id);if(zone)return zone;
  for(const s of world.structures)if(targetBuildingPlayerUse263(world,s)&&isShelfKind(s.kind)&&s.shelf?.cells.includes(id))return shelfStorageCells(s).find(c=>c.id===id);
}
export function storageAt(world:Pick<World,'stockpiles'|'structures'>&Partial<Pick<World,'schemaVersion'|'worldFactions'>>,cell:Cell):StorageCell|undefined {
  const s=shelfAt(world,cell);if(s&&!targetBuildingPlayerUse263(world,s))return;return s?shelfStorageCells(s).find(c=>c.x===cell.x&&c.z===cell.z):world.stockpiles.find(z=>z.x===cell.x&&z.z===cell.z);
}
export function storageCellAccepts(world:Pick<World,'tick'>,cell:StorageCell,subject:ItemId|MaterialPile):boolean {
  return (cell.shelfId===undefined||shelfFixedAccepts(subject))&&storageAccepts(cell,subject,world.tick);
}
