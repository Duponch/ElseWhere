import {isPenoxycyline337} from './penoxycyline-337.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {validLinkedShelfField286} from './linked-storage-save-286.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validTargetBuildingFactionShape263} from './world-target-building-263.ts';
import {isBlockMaterial} from './building-materials.ts';
import {footprintCells} from './definitions.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {validStorageItems,validAiCoreStorageFilters298} from './storage-filters.ts';
import {validStorageConditions} from './storage-condition.ts';
import {isShelfKind,shelfFixedAccepts} from './shelf-storage.ts';
import {structureMaxHp} from './thing-damage-rules.ts';
import {validateFurniture} from './furniture-transfer-save.ts';
import type {Structure,World} from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const storageKeys=new Set<string>(['furniture','plant',...Object.values(ITEM_DEFINITIONS).map(d=>d.kind)]);
export function validShelfSettings(value:unknown,version:number):boolean {
  if(object(value)&&!validAiCoreStorageFilters298(value.filters,version))return false;
  if(object(value)&&object(value.filters)&&'book'in value.filters){const d=Object.getOwnPropertyDescriptor(value.filters,'book');if((version!==295&&(version!==296&&!isCorePhysicalSchema297(version)))||!d||!d.enumerable||!Object.hasOwn(d,'value')||typeof d.value!=='boolean')return false;}
  if(version<229||!object(value)||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!['filters','priority','capacity','items','quality','hitPoints','allowFresh','allowRotten'].includes(k)))return false;
  return object(value.filters)&&Reflect.ownKeys(value.filters).every(k=>typeof k==='string'&&storageKeys.has(k)&&(k!=='book'||(version===295||(version===296||isCorePhysicalSchema297(version))))&&(isSchema273OrLater(version)||k!=='prosthesis')&&(version>=265||k!=='wort'&&k!=='beer')&&(isPenoxycyline337(version)||k!=='drug')&&(version>=256||k!=='jade')&&(version>=241||k!=='uranium')&&(version>=235||k!=='plant')&&(version>=357||k!=='shell')&&typeof value.filters![k as never]==='boolean')
    &&integer(value.priority,1,5)&&value.capacity===500&&validStorageItems(value.items,version)&&validStorageConditions(value,version);
}
/** Reciprocal building/state admission, shared by files and snapshots. */
export function validShelfBuildingShape(value:unknown,version:number):boolean {
  if(!object(value))return false;
  if(!isShelfKind(String(value.kind)))return !Object.hasOwn(value,'shelf');
  if(Reflect.ownKeys(value).some(k=>typeof k!=='string'||!['id','kind','x','z','orientation','footprint','material','shelf','damage',...(isSchema263OrLater(version)?['factionId']:[])].includes(k)))return false;
  if(Object.hasOwn(value,'factionId')&&!validTargetBuildingFactionShape263(value,version))return false;
  const state=value.shelf;
  if(version<229||!object(state)||Reflect.ownKeys(state).length!==(Object.hasOwn(state,'linked286')?3:2)||!validLinkedShelfField286(state,version)||!Object.hasOwn(state,'cells')||!Object.hasOwn(state,'settings')
    ||!Array.isArray(state.cells)||state.cells.length!==(value.kind==='shelf'?2:1)||Reflect.ownKeys(state.cells).length!==state.cells.length+1
    ||state.cells.some((id,i)=>!Object.hasOwn(state.cells as object,i)||!integer(id,1))||new Set(state.cells).size!==state.cells.length
    ||!validShelfSettings(state.settings,version)||!integer(value.orientation,0,3)||value.footprint!=='standard'
    ||!(value.material==='wood'||value.material==='steel'||version>=256&&value.material==='jade'||isBlockMaterial(value.material))
    ||['quality','art','fuel','bills','power','medical','prisoner','spikeTrap'].some(k=>Object.hasOwn(value,k)))return false;
  return !Object.hasOwn(value,'damage')||integer(value.damage,1,structureMaxHp(value as unknown as Structure)-1);
}
/** IDs are real durable cell owners, also while their shelf is packed. */
export function shelfIdentityOwners(world:Pick<World,'structures'|'packed'>):{id:number}[] {
  const result:{id:number}[]=[];
  for(const s of [...world.structures,...(world.packed??[]).map(p=>p.building)])for(const id of s.shelf?.cells??[])result.push({id});
  return result;
}
export function registerShelfThingIds(world:World,ids:{has(id:number):boolean;add(id:number):unknown}):string[] {
  for(const {id} of shelfIdentityOwners(world)){
    if(!integer(id,1,world.nextId-1)||ids.has(id))return ['Duplicate or invalid shelf storage cell identity.'];
    ids.add(id);
  }
  return [];
}
export function validShelfTransport(w:World,version:number=w.schemaVersion):boolean {
  try{
    const descriptors=w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.repair,j.fixBreakdown,j.flick].filter(Boolean));
    const archives=[...(w.visitors?.departed??[]),...(w.podRescues?.departed??[])].flatMap(d=>d.packed??[]);
    const buildings=[...w.structures,...(w.packed??[]).map(p=>p.building),...archives.map(p=>p.building)];
    const prospective=(v:unknown)=>object(v)&&(isShelfKind(String(v.kind))||Object.hasOwn(v,'shelf'));
    if(![...buildings,...w.jobs,...descriptors].some(prospective))return true;
    if(version<229||!buildings.every(s=>validShelfBuildingShape(s,version))||archives.some(p=>prospective(p.building)))return false;
    if(descriptors.some(d=>Object.hasOwn(d!,'shelf')))return false;
    // Reuse the shape traversal for this adoption's ground-stockpile geometry.
    // Packed shelves do not occupy cells; absent stockpiles need no index.
    // Cloned zone packets cannot use identity as an unchanged-value witness.
    const noStockpileCells=w.stockpiles.length?new Set<number>():undefined;
    for(const j of w.jobs){
      if(Object.hasOwn(j,'shelf'))return false;
      if(isShelfKind(j.kind)&&(!integer(j.orientation,0,3)||j.footprint!=='standard'
        ||!(j.material==='wood'||j.material==='steel'||version>=256&&j.material==='jade'||isBlockMaterial(j.material))
        ||['quality','art','fuel','bills','power','medical','prisoner','damage'].some(k=>Object.hasOwn(j,k))))return false;
      if(noStockpileCells&&(isShelfKind(j.kind)||j.kind==='install'&&isShelfKind(j.furniture?.kind??'')))
        for(const c of footprintCells(j))noStockpileCells.add(c.z*w.width+c.x);
    }
    for(let i=0;i<buildings.length;i++){
      const s=buildings[i]!;if(!isShelfKind(s.kind))continue;
      const cells=footprintCells(s);
      if(!integer(s.id,1,w.nextId-1)||s.shelf!.cells.some(id=>!integer(id,1,w.nextId-1))
        ||cells.some(c=>!integer(c.x,0,w.width-1)||!integer(c.z,0,w.height-1)))return false;
      if(noStockpileCells&&i<w.structures.length)for(const c of cells)noStockpileCells.add(c.z*w.width+c.x);
    }
    if(noStockpileCells?.size&&w.stockpiles.some(z=>noStockpileCells.has(z.z*w.width+z.x)))return false;
    if((w.packed??[]).some(p=>prospective(p.building))||w.jobs.some(j=>isShelfKind(j.furniture?.kind??''))){
      if(validateFurniture(w,version,new Set()).length)return false;
    }
    return true;
  }catch{return false;}
}
/** Policy edits may leave refused items in place; fixed physical exclusions cannot. */
export function validShelfGround(w:World):boolean {
  const shelves=w.structures.filter(s=>isShelfKind(s.kind));
  if(w.schemaVersion<229&&!shelves.length)return true;
  const cells=new Set(shelves.flatMap(s=>footprintCells(s).map(c=>c.z*w.width+c.x)));
  for(const pack of w.packed??[])if(pack.owner.type==='ground'&&cells.has(pack.owner.z*w.width+pack.owner.x))return false;
  const counts=new Map<number,number>();
  for(const p of w.piles)if(p.owner.type==='ground'){
    const key=p.owner.z*w.width+p.owner.x,shelf=cells.has(key),count=(counts.get(key)??0)+1;
    if(count>(shelf?3:1)||shelf&&!shelfFixedAccepts(p))return false;
    counts.set(key,count);
  }
  return true;
}
