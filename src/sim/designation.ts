import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {queryAreaMaterialPermission256} from './area-material-permission-256.ts';
import {naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {canDesignateBridge} from './bridge.ts';
import {isPlantDesignationJob} from './tree-transfer.ts';
import { validStorageItems,validNovelStorageFilters295,validAiCoreStorageFilters298 } from './storage-filters.ts';
import { validStorageConditions } from './storage-condition.ts';
import { connectedZoneCells,stockpileCellsByZoneId,stockpileZoneId } from './stockpile-zones.ts';
import { isRoofArea, isRoofJob } from './roof-rules.ts';
import { occupancyOf } from './occupancy.ts';
import { isPlant, harvestable,choppable } from './plants.ts';
import { isCookingOrder } from './order-types.ts';
import { footprintCells } from './definitions.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { inBounds } from './pathfinding.ts';
import {canDesignateSmoothFloor281} from './smooth-floor-281.ts';
import {captureStructureNavigation,structureById} from './structure-navigation.ts';
import { canDesignateFloor,isBuildableFloor } from './flooring.ts';
import { soilFertility } from './soil.ts';
import { SCHEMA_VERSION,type AreaAction,type AreaCommand,type Cell,type CommandResult,type StorageSettings,type World } from './types.ts';

const TREE = 1, BERRIES = 2, FIXED = 4, JOB = 8, STORAGE = 16, BLOCKED = 32, RIPE = 64, GROWING = 128, ZONE_BLOCKED = 256, GROW_BLOCKED = 512, DECONSTRUCTIBLE = 1024, ROCK = 2048, CHUNK = 4096, HAUL = 8192, PLANT_JOB = 16384;
export const isAreaAction = (value: unknown): value is AreaAction => ['allow','forbid','smooth-floor','build-bridge','remove-bridge','snow-clear','remove-snow-clear','lay-floor','remove-floor','home','remove-home','build-roof', 'remove-roof', 'ignore-roof', 'mine', 'haul-chunks', 'deconstruct', 'chop', 'harvest', 'cut', 'cancel', 'stockpile', 'remove-stockpile', 'growing', 'remove-growing'].includes(value as string);
export interface AreaBounds { minX: number; maxX: number; minZ: number; maxZ: number }
export interface AreaIndex { flags: Uint16Array }
export type AreaQuery = { ok: false; reason: string; code: CommandResult['code'] }
  | { ok: true; bounds: AreaBounds; cells: number[]; selected: number; skipped: number; targetZoneId?:number };

export function validStorageSettings(settings: StorageSettings,version:number=SCHEMA_VERSION): boolean {
  if(!settings||typeof settings!=='object'||Array.isArray(settings))return false;
  const filters=Object.getOwnPropertyDescriptor(settings,'filters');
  if(filters?filters.enumerable!==true||!Object.hasOwn(filters,'value'):'filters'in settings)return false;
  if(!validNovelStorageFilters295(filters?.value,version)||!validAiCoreStorageFilters298(filters?.value,version))return false;
  if(settings.filters&&Object.hasOwn(settings.filters,'prosthesis')&&(!isSchema273OrLater(version)||typeof settings.filters.prosthesis!=='boolean'))return false;
  if(settings.filters&&Object.hasOwn(settings.filters,'jade')&&(version<256||typeof settings.filters.jade!=='boolean'))return false;
  if(settings.filters&&Object.hasOwn(settings.filters,'plant')&&(version<235||typeof settings.filters.plant!=='boolean'))return false;
  if(settings.filters?.corpse!==undefined&&(version<79||typeof settings.filters.corpse!=='boolean'))return false;
  if(settings.filters&&Object.hasOwn(settings.filters,'chemfuel')&&(version<218||typeof settings.filters.chemfuel!=='boolean'))return false;
  return (!settings.filters||['wort','beer'].every(k=>!Object.hasOwn(settings.filters!,k)||version>=265&&typeof (settings.filters as Record<string,unknown>)[k]==='boolean'))&&validStorageConditions(settings,version)&&validStorageItems(settings.items,version)&&(version>=241||!settings.filters||!Object.hasOwn(settings.filters,'uranium'))&&(version>=206||!settings.filters||!Object.hasOwn(settings.filters,'neutroamine'))&&(settings.filters === undefined || (!!settings.filters && typeof settings.filters.wood === 'boolean' && typeof settings.filters.food === 'boolean' && (settings.filters['mech-corpse']===undefined||typeof settings.filters['mech-corpse']==='boolean') && (settings.filters.silver===undefined||typeof settings.filters.silver==='boolean') && (settings.filters.unfinished===undefined||typeof settings.filters.unfinished==='boolean') && (settings.filters.textile===undefined||typeof settings.filters.textile==='boolean') && (settings.filters.apparel===undefined||typeof settings.filters.apparel==='boolean') && (settings.filters.weapon===undefined||typeof settings.filters.weapon==='boolean') && (settings.filters.neutroamine===undefined||typeof settings.filters.neutroamine==='boolean') && (settings.filters.medicine===undefined||typeof settings.filters.medicine==='boolean') && (settings.filters.component===undefined||typeof settings.filters.component==='boolean') && (settings.filters['advanced-component']===undefined||typeof settings.filters['advanced-component']==='boolean') && (settings.filters.uranium===undefined||typeof settings.filters.uranium==='boolean') && (settings.filters.gold===undefined||typeof settings.filters.gold==='boolean') && (settings.filters.plasteel===undefined||typeof settings.filters.plasteel==='boolean') && (settings.filters.blocks===undefined||typeof settings.filters.blocks==='boolean') && (settings.filters.steel===undefined||typeof settings.filters.steel==='boolean') && (settings.filters.chunk===undefined||typeof settings.filters.chunk==='boolean') && (settings.filters.furniture===undefined||typeof settings.filters.furniture==='boolean')))
    && (settings.priority === undefined || (Number.isInteger(settings.priority) && settings.priority >= 1 && settings.priority <= (version>=219?5:4)))
    && (settings.capacity === undefined || (Number.isInteger(settings.capacity) && settings.capacity >= 1 && settings.capacity <= ITEM_DEFINITIONS.silver.stackLimit));
}

/** Rebuilt on demand from one snapshot. No persistent cache or gameplay authority. */
export function buildAreaIndex(world: World): AreaIndex {
  const flags = new Uint16Array(world.width * world.height);
  const index = (cell: Cell) => cell.z * world.width + cell.x;
  for (let i = 0; i < flags.length; i++) if (!naturalTerrainWalkable256(world.tiles[i]!.terrain)) flags[i] = BLOCKED | (world.tiles[i]!.terrain==='rock'?ROCK:0);
  for(let i=0;i<flags.length;i++)if(world.tiles[i]!.terrain==='rough-stone'||world.tiles[i]!.floor||world.schemaVersion>=219&&soilFertility(world.tiles[i]!.terrain)<.7)flags[i]!|=GROW_BLOCKED;
  for(const pile of world.piles)if(pile.owner.type==='ground'){if(pile.kind==='chunk'&&!pile.haulRequested)flags[index(pile.owner)]!|=CHUNK;if(pile.haulRequested)flags[index(pile.owner)]!|=HAUL;}
  // Core's CanOverlapZones exempts plants from the impassable-thing rule.
  // A plant or its work designation does not carve a hole in a zone. Rock
  // resources still obstruct both zone types; legacy schemas keep their rules.
  for (const resource of world.resources) flags[index(resource)]! |= (world.schemaVersion<219?ZONE_BLOCKED:resource.kind==='rock'?ZONE_BLOCKED|GROW_BLOCKED:0) | FIXED | (choppable(world,resource)?TREE:0) | (isPlant(resource)||world.schemaVersion>=235&&resource.kind==='tree' ? BERRIES | (harvestable(world, resource) ? RIPE : 0) : 0);
  for (const structure of world.structures) for (const cell of footprintCells(structure)) flags[index(cell)]! |= DECONSTRUCTIBLE | FIXED | (occupancyOf(structure.kind)?.zones?0:ZONE_BLOCKED | GROW_BLOCKED);
  for(const job of world.jobs)if(job.furniture){const source=structureById(world,job.furniture!.structureId);if(source)for(const c of footprintCells(source))flags[index(c)]!|=JOB;}
  // Repair is automatic maintenance, not a cancellable designation. Its existing
  // barrier already supplies occupancy; it must not prevent deconstruction.
  for (const job of world.jobs.filter(j=>!isRoofJob(j)&&j.kind!=='repair'&&j.kind!=='fix-breakdown')) for (const cell of footprintCells(job)) flags[index(cell)]! |= JOB | (isPlantDesignationJob(job)?PLANT_JOB:0) | (job.kind==='deconstruct'||job.kind==='uninstall'||(world.schemaVersion>=219?occupancyOf(job.furniture?.kind??job.kind)?.zones!==false:occupancyOf(job.furniture?.kind??job.kind)?.zones)?0:ZONE_BLOCKED) | (occupancyOf(job.furniture?.kind??job.kind)?.zones===false?GROW_BLOCKED:0);
  for(const pack of world.packed??[])if(pack.owner.type==='ground'&&world.jobs.some(j=>j.furniture?.structureId===pack.building.id))flags[index(pack.owner)]!|=JOB;
  for (const storage of world.stockpiles) flags[index(storage)]! |= STORAGE;
  for (const pawn of world.pawns) {
    if(pawn.haul?.destination.type==='aside')flags[index(pawn.haul.destination)]!|=BLOCKED;
    if(pawn.cooking){flags[index(pawn.cooking.spot)]!|=BLOCKED;for(const i of pawn.cooking.ingredients)if(i.stage!=='placed')flags[index(i.cell)]!|=BLOCKED;}
    for(const order of pawn.orders?.queue??[])if(isCookingOrder(order)){flags[index(order.cooking.spot)]!|=BLOCKED;for(const i of order.cooking.ingredients)if(i.stage!=='placed')flags[index(i.cell)]!|=BLOCKED;}
  }
  for (const zone of world.growingZones) for (const cell of zone.cells) if(zone.basinId===undefined)flags[cell]! |= GROWING;
  return { flags };
}

/** Inclusive rectangle in stable row-major order; occupied/incompatible cells are skipped.
 * Endpoints and policy are validated before any index allocation or mutation.
 */
export function queryArea(world: World, command: AreaCommand, index?: AreaIndex): AreaQuery {
  if (!command || !isAreaAction(command.action)) return { ok: false, code: 'invalid-command', reason: 'Outil de rectangle inconnu.' };
  if(command.action==='allow'||command.action==='forbid')return queryAreaMaterialPermission256(world,command);
  if((command.action==='snow-clear'||command.action==='remove-snow-clear')&&!world.snow)return {ok:false,code:'invalid-command',reason:'Cette partie historique ne simule pas de neige au sol.'};
  if(command.targetZoneId===undefined&&command.from&&command.to&&(command.action==='stockpile'||command.action==='growing')){
    const within=(x:number,z:number)=>x>=Math.min(command.from.x,command.to.x)&&x<=Math.max(command.from.x,command.to.x)&&z>=Math.min(command.from.z,command.to.z)&&z<=Math.max(command.from.z,command.to.z);
    const targets=command.action==='stockpile'?new Set(world.stockpiles.filter(cell=>within(cell.x,cell.z)).map(stockpileZoneId))
      :new Set(world.growingZones.filter(zone=>zone.basinId===undefined&&zone.cells.some(cell=>within(cell%world.width,Math.floor(cell/world.width)))).map(zone=>zone.id));
    if(targets.size===1)command={...command,targetZoneId:targets.values().next().value!};
  }
  const zoneAction=['stockpile','remove-stockpile','growing','remove-growing'].includes(command.action);
  const targetStorage=command.targetZoneId===undefined?undefined:stockpileCellsByZoneId(world,command.targetZoneId);
  const targetGrowing=command.targetZoneId===undefined?undefined:world.growingZones.find(zone=>zone.id===command.targetZoneId);
  if(command.targetZoneId!==undefined&&(!zoneAction||!Number.isSafeInteger(command.targetZoneId)
    ||(command.action==='stockpile'||command.action==='remove-stockpile'? !targetStorage?.length:!targetGrowing||targetGrowing.basinId!==undefined)))
    return {ok:false,code:'missing-target',reason:'Zone cible absente ou incompatible.'};
  if(command.action==='lay-floor'&&!isBuildableFloor(command.floor)||command.action!=='lay-floor'&&command.floor!==undefined)return {ok:false,code:'invalid-command',reason:'Revêtement de sol invalide.'};
  if (!command.from || !command.to || !inBounds(world, command.from.x, command.from.z) || !inBounds(world, command.to.x, command.to.z)) {
    return { ok: false, code: 'out-of-bounds', reason: 'Rectangle hors de la carte.' };
  }
  if (command.action === 'stockpile' && !validStorageSettings(command,world.schemaVersion)) return { ok: false, code: 'invalid-storage', reason: `Filtres, plages de qualité/PV, priorité (1–5) ou capacité (1–${ITEM_DEFINITIONS.silver.stackLimit}) invalides.` };
  const bounds = { minX: Math.min(command.from.x, command.to.x), maxX: Math.max(command.from.x, command.to.x), minZ: Math.min(command.from.z, command.to.z), maxZ: Math.max(command.from.z, command.to.z) };
  const selected = (bounds.maxX - bounds.minX + 1) * (bounds.maxZ - bounds.minZ + 1);
  const flags = (index ?? buildAreaIndex(world)).flags;
  const smoothGeometry=command.action==='smooth-floor'?captureStructureNavigation(world):undefined;
  const cells: number[] = [],home=new Set(world.home);
  const manualWallCells=command.action==='deconstruct'?new Set(world.jobs.filter(j=>j.wallDoor296?.manual===false).flatMap(j=>footprintCells(j).map(c=>c.z*world.width+c.x))):undefined;
  for (let z = bounds.minZ; z <= bounds.maxZ; z++) for (let x = bounds.minX; x <= bounds.maxX; x++) {
    const i = z * world.width + x, value = flags[i]!;
    const hidden=foggedCell256(world,i);
    if(hidden&&command.action!=='mine'&&!['cancel','remove-stockpile','remove-growing','remove-home','remove-roof','ignore-roof','remove-snow-clear'].includes(command.action))continue;
    if(hidden&&command.action==='mine'){
      if(!world.jobs.some(j=>j.kind==='mine'&&j.x===x&&j.z===z))cells.push(i);
      continue;
    }
    const eligible = command.action==='smooth-floor'?canDesignateSmoothFloor281(world,{x,z},undefined,smoothGeometry).ok:command.action==='build-bridge'||command.action==='remove-bridge'?canDesignateBridge(world,{type:'designate',kind:command.action,x,z}).ok:command.action==='snow-clear'?!(world.snowClearArea??[]).includes(i)&&!(value&BLOCKED):command.action==='remove-snow-clear'?(world.snowClearArea??[]).includes(i):command.action==='lay-floor'||command.action==='remove-floor'?canDesignateFloor(world,{type:'designate',kind:command.action,x,z,...command.action==='lay-floor'?{floor:command.floor}:{}}).ok:command.action==='home'?!home.has(i):command.action==='remove-home'?home.has(i):isRoofArea(command.action) ? true : command.action === 'mine' ? (value & ROCK) && !(value & JOB)
      : command.action === 'haul-chunks' ? value & CHUNK
      : command.action === 'deconstruct' ? (value & DECONSTRUCTIBLE) && (!(value & JOB)||manualWallCells!.has(i))
      : command.action === 'chop' ? (value & TREE) && !(value & (world.schemaVersion>=235?PLANT_JOB:JOB))
      : command.action === 'cut' ? (value & BERRIES) && !(value & (world.schemaVersion>=235?PLANT_JOB:JOB))
      : command.action === 'harvest' ? (value & RIPE) && !(value & (world.schemaVersion>=235?PLANT_JOB:JOB))
        : command.action === 'cancel' ? value & (world.schemaVersion>=235?JOB|HAUL:JOB)
          : command.action === 'remove-growing' ? value & GROWING
          : command.action === 'growing' ? !(value & (BLOCKED | STORAGE | GROWING | GROW_BLOCKED))
          : command.action === 'remove-stockpile' ? value & STORAGE
            : !(value & (BLOCKED | ZONE_BLOCKED | STORAGE | GROWING));
    if (eligible&&(!(command.action==='remove-stockpile')||command.targetZoneId===undefined||targetStorage!.some(cell=>cell.x===x&&cell.z===z))
      &&(!(command.action==='remove-growing')||world.growingZones.some(zone=>zone.basinId===undefined&&zone.cells.includes(i)&&(command.targetZoneId===undefined||zone===targetGrowing)))) cells.push(i);
  }
  const skipped=selected-cells.length;
  if(command.targetZoneId!==undefined&&(command.action==='stockpile'||command.action==='growing')){
    const existing=command.action==='stockpile'?targetStorage!.map(cell=>cell.z*world.width+cell.x):targetGrowing!.cells;
    const connected=connectedZoneCells(world.width,[...existing,...cells],existing);
    const compatible=cells.filter(cell=>connected.has(cell));
    return {ok:true,bounds,cells:compatible,selected,skipped:selected-compatible.length,targetZoneId:command.targetZoneId};
  }
  if(command.action==='remove-stockpile'||command.action==='remove-growing'){
    const removed=new Set(cells);
    const groups=command.action==='remove-growing'?world.growingZones.filter(zone=>zone.basinId===undefined).map(zone=>zone.cells)
      :[...new Set(world.stockpiles.map(stockpileZoneId))].map(id=>stockpileCellsByZoneId(world,id).map(cell=>cell.z*world.width+cell.x));
    for(const group of groups)if(group.some(cell=>removed.has(cell))){
      const survivors=group.filter(cell=>!removed.has(cell));
      const connected=connectedZoneCells(world.width,survivors,survivors.slice(0,1));
      for(const cell of survivors)if(!connected.has(cell))removed.add(cell);
    }
    return {ok:true,bounds,cells:[...removed].sort((a,b)=>a-b),selected,skipped};
  }
  return { ok: true, bounds, cells, selected, skipped };
}
