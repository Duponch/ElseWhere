import type { StockpileCell,StorageSettings,World } from './types.ts';
import {validAiCoreStorageFilters298} from './storage-filters.ts';

type StorageWorld=Pick<World,'stockpiles'>;
export const stockpileZoneId=(cell:StockpileCell):number=>cell.zoneId??cell.id;
export function stockpileCellsByZoneId(world:StorageWorld,zoneId:number):StockpileCell[] {
  return world.stockpiles.filter(cell=>stockpileZoneId(cell)===zoneId);
}
/** Selection/haul IDs identify a physical cell, never a separate logical owner. */
export function stockpileZoneCells(world:StorageWorld,stockpileId:number):StockpileCell[] {
  const selected=world.stockpiles.find(cell=>cell.id===stockpileId);
  return selected?stockpileCellsByZoneId(world,stockpileZoneId(selected)):[];
}
function sortedRecord(value:object|undefined):unknown {
  return value===undefined?null:Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0);
}
export function stockpilePolicyKey(cell:StockpileCell):string {
  return JSON.stringify([sortedRecord(cell.filters),sortedRecord(cell.items),cell.priority,cell.capacity,
    cell.quality??null,cell.hitPoints??null,cell.allowFresh??true,cell.allowRotten??true]);
}
/** Legacy saves had no zone identity. Join only cardinal neighbours with the
 * same policy; preserve every physical ID, owner, reservation and pile. */
export function adoptStockpileZones(world:Pick<World,'width'|'stockpiles'>):void {
  const byCell=new Map(world.stockpiles.map(cell=>[cell.z*world.width+cell.x,cell]));
  const visited=new Set<number>();
  for(const seed of world.stockpiles){
    if(visited.has(seed.id))continue;
    const key=stockpilePolicyKey(seed),members=[seed];visited.add(seed.id);
    for(let i=0;i<members.length;i++){
      const cell=members[i]!;
      for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]] as const){
        const x=cell.x+dx,z=cell.z+dz;
        if(x<0||x>=world.width||z<0)continue;
        const neighbour=byCell.get(z*world.width+x);
        if(neighbour&&!visited.has(neighbour.id)&&stockpilePolicyKey(neighbour)===key){visited.add(neighbour.id);members.push(neighbour);}
      }
    }
    let zoneId=seed.id;for(const cell of members)zoneId=Math.min(zoneId,cell.id);
    for(const cell of members)cell.zoneId=zoneId;
  }
}
/** Cardinal traversal has no horizontal row wrap. Original order determines
 * the retained seed, matching Core Zone.CheckContiguous's first member. */
export function connectedZoneCells(width:number,cells:readonly number[],seeds:readonly number[]):Set<number> {
  const available=new Set(cells),found=new Set<number>(),queue:number[]=[];
  for(const seed of seeds)if(available.has(seed)&&!found.has(seed)){found.add(seed);queue.push(seed);}
  for(let i=0;i<queue.length;i++){
    const cell=queue[i]!,x=cell%width;
    for(const next of [cell-width,...x>0?[cell-1]:[],...x<width-1?[cell+1]:[],cell+width])
      if(available.has(next)&&!found.has(next)){found.add(next);queue.push(next);}
  }
  return found;
}
export function zoneCellComponents(width:number,cells:readonly number[]):number[][] {
  const remaining=new Set(cells),result:number[][]=[];
  for(const seed of cells)if(remaining.has(seed)){
    const members=[seed];remaining.delete(seed);
    for(let i=0;i<members.length;i++){
      const cell=members[i]!,x=cell%width;
      for(const next of [cell-width,...x>0?[cell-1]:[],...x<width-1?[cell+1]:[],cell+width])
        if(remaining.delete(next))members.push(next);
    }
    result.push(members.sort((a,b)=>a-b));
  }
  return result;
}
/** Settings are copied per cell: no mutable policy object is shared between
 * owners or with the input command. Explicit undefined clears optional fields. */
export function patchStockpilePolicy(cell:StockpileCell,settings:StorageSettings):void {
  for(const key of ['items','quality','hitPoints'] as const)if(Object.hasOwn(settings,key)){
    const value=settings[key];if(value===undefined)delete cell[key];else Object.assign(cell,{[key]:{...value}});
  }
  for(const key of ['allowFresh','allowRotten'] as const)if(Object.hasOwn(settings,key)){
    if(settings[key]===undefined)delete cell[key];else cell[key]=settings[key];
  }
  if(settings.filters!==undefined)cell.filters={...settings.filters};
  if(settings.priority!==undefined)cell.priority=settings.priority;
  if(settings.capacity!==undefined)cell.capacity=settings.capacity;
}
export function validStockpileZones(world:Pick<World,'stockpiles'|'nextId'>,version:number):boolean {
  const policies=new Map<number,StockpileCell>();
  for(const cell of world.stockpiles){
    if(!validAiCoreStorageFilters298(cell.filters,version))return false;
    if(Object.hasOwn(cell.filters,'dye')&&(version<382||typeof cell.filters.dye!=='boolean'))return false;
    if(version<219){if(Object.hasOwn(cell,'zoneId'))return false;continue;}
    const zoneId=cell.zoneId===undefined?cell.id:cell.zoneId;
    if(!Number.isSafeInteger(zoneId)||zoneId<1||zoneId>=world.nextId)return false;
    const previous=policies.get(zoneId);
    if(previous!==undefined&&!sameStockpilePolicy(previous,cell))return false;
    policies.set(zoneId,cell);
  }
  return true;
}
function sameRecord(a:object|undefined,b:object|undefined):boolean {
  if(a===b)return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)||Array.isArray(b))return false;
  const keys=Object.keys(a);if(keys.length!==Object.keys(b).length)return false;
  return keys.every(key=>Object.hasOwn(b,key)&&(a as Record<string,unknown>)[key]===(b as Record<string,unknown>)[key]);
}
function sameStockpilePolicy(a:StockpileCell,b:StockpileCell):boolean {
  return a.priority===b.priority&&a.capacity===b.capacity&&(a.allowFresh??true)===(b.allowFresh??true)&&(a.allowRotten??true)===(b.allowRotten??true)
    &&sameRecord(a.filters,b.filters)&&sameRecord(a.items,b.items)&&sameRecord(a.quality,b.quality)&&sameRecord(a.hitPoints,b.hitPoints);
}
