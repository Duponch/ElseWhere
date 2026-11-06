import {isCaveHiveKind256} from './cave-hive-state-256.ts';
import {validCollapsedRock256,excavatedCollapsedRock256,admittedRoofTerrain256} from './collapsed-rocks-256.ts';
import {isWetTerrain} from './shallow-water.ts';
import {isRoadFloor256} from './road-ground-256.ts';
import {buildingSupportNeed256} from './bridge-rules.ts';
import {terrainAvailable256,terrainHoldsSnow256,terrainSupportsAffordance256,terrainSupportsFloor256,terrainGroundFertility256,terrainHasProspectiveRules256,naturalPlantSubstrate256,readNaturalPlantSubstrate256,type TerrainRuntimeMetadata256} from './natural-terrain-runtime-256.ts';
import {plantSubstrateAllowed256} from './plant-substrate-256.ts';
import {footprintCells,STRUCTURE_DEFINITIONS} from './definitions.ts';
import type {Cell,Job,Resource,Tile,World} from './types.ts';
import type {OwnedResourceReuseWitness,OwnedResourceBaseReuseWitness} from './owned-validation-resources.ts';
import { structureById } from './structure-navigation.ts';
export const MARSH_SCHEMA_VERSION=246;
export const MARSH_PATH_COST_CORE=30;
export const MARSH_PERCEIVED_CORE={ordinary:180,drafted:18} as const;
export const marshAt=(world:Pick<World,'tiles'|'width'>,cell:Cell):boolean=>isWetTerrain(world.tiles[cell.z*world.width+cell.x]?.terrain);
/** Existing callers retain one support authority for structures, plans,
 * frames and installations, with exact Stuff resolved by BUILDING_SUPPORT. */
export function marshSupportsFootprint(world:Pick<World,'tiles'|'width'>&TerrainRuntimeMetadata256,cells:readonly Cell[],building?:{kind:string;material?:unknown}):boolean {
 const need=building&&buildingSupportNeed256(building);
 return cells.every(c=>{const tile=world.tiles[c.z*world.width+c.x];if(!tile)return false;if(building?.kind==='lay-floor')return terrainSupportsFloor256(tile,world);if(building&&isCaveHiveKind256(building.kind))return (world.schemaVersion??255)>=256&&terrainAvailable256(tile.terrain,world.schemaVersion??255);if(need)return terrainSupportsAffordance256(tile,need,world);return !terrainHasProspectiveRules256(tile.terrain,world)&&!isWetTerrain(tile.terrain);});
}
export function validMarshTile(tile:Pick<Tile,'terrain'|'floor'|'snowDepth'|'bridge'|'collapsedRock'>,version:number,metadata:TerrainRuntimeMetadata256={}):boolean {
 if(!validCollapsedRock256(tile,version,Number.MAX_SAFE_INTEGER,v=>admittedRoofTerrain256(v,version)))return false;
 if(tile.collapsedRock)tile=excavatedCollapsedRock256(tile as Tile);
 return terrainAvailable256(tile.terrain,version)&&(!isRoadFloor256(tile.floor)||version>=256)&&(tile.floor===undefined||terrainSupportsFloor256(tile,{...metadata,schemaVersion:version}))&&(tile.snowDepth===undefined||terrainHoldsSnow256(tile.terrain,!!tile.bridge));
}
export const marshConstructionJob=(job:Pick<Job,'kind'>):boolean=>job.kind==='install'||job.kind==='lay-floor'||Object.hasOwn(STRUCTURE_DEFINITIONS,job.kind);
/** Changed tile identities are incremental; object support remains checked
 * even when a same-tick packet leaves the grid unchanged. No new runtime scan. */
export function validateMarshTransport(world:World,version:number=world.schemaVersion,changedTiles?:readonly number[]):string[] {
 return validateMarshTransportResources(world,version,changedTiles);
}
/** The private selector is reached only at the original plant frontier. Public
 * callers never supply it and always read the complete current population. */
function validateMarshTransportResources(world:World,version:number,changedTiles?:readonly number[],selectResources?:()=>readonly Resource[]):string[] {
 const meta={schemaVersion:version,site:world.site},check=(i:number)=>!!world.tiles[i]&&validMarshTile(world.tiles[i]!,version,meta),bad=(s:string)=>[s];
 if(changedTiles?changedTiles.some(i=>!check(i)):world.tiles.some((_,i)=>!check(i)))return bad('Invalid or future natural terrain.');
 const support={tiles:world.tiles,width:world.width,...meta};
 if(world.structures.some(s=>!marshSupportsFootprint(support,footprintCells(s),s)))return bad('Building lacks actual terrain support.');
 for(const j of world.jobs){if(version<256&&isRoadFloor256(j.floor))return bad('Future road floor work.');if(marshConstructionJob(j)&&!marshSupportsFootprint(support,footprintCells(j),j.kind==='install'?{kind:j.furniture?.kind??'install',material:world.packed.find(p=>p.building.id===j.furniture?.structureId)?.building.material??structureById(world,j.furniture?.structureId)?.material}:j))return bad('Construction lacks actual terrain support.');if(j.kind==='sow'&&j.flowerPotId===undefined&&world.growingZones?.find(z=>z.id===j.growingZoneId)?.basinId===undefined){const t=world.tiles[j.z*world.width+j.x];if(!t||terrainGroundFertility256(t)<=0)return bad('Sowing lacks fertile unlayered terrain.');}}
 const substrate={fertility:0,terrainDefId:'',tags:[] as string[]};
 for(const r of selectResources?selectResources():world.resources){if(r.kind==='rock')continue;const tile=world.tiles[r.z*world.width+r.x];if(!tile)return bad('Plant outside terrain.');const prospective=version>=256&&plantSubstrateAllowed256(r.species,version,readNaturalPlantSubstrate256(tile));if(prospective!==undefined&&prospective!==false){if(tile.bridge||tile.floor)return bad('Plant beneath a built surface.');continue;}if(prospective===false&&version>=256&&r.species!==undefined&&terrainHasProspectiveRules256(tile.terrain,meta))return bad('Plant violates its actual substrate profile.');if(isWetTerrain(tile.terrain))return bad('Plant rooted in incompatible water.');}
 if((world.growingZones??[]).some(z=>z.basinId===undefined&&z.cells.some(i=>{const tile=world.tiles[i];return !tile||(terrainHasProspectiveRules256(tile.terrain,meta)?naturalPlantSubstrate256({...tile,bridge:undefined,floor:undefined},substrate).fertility<=0:isWetTerrain(tile.terrain));})))return bad('Growing zone on infertile terrain.');
 return [];
}

export interface OwnedMarshTransportOwner {
 validate(world:World,changedTiles?:readonly number[],reuse?:OwnedResourceReuseWitness):string[];
 validateBase(world:World,changedTiles:readonly number[]|undefined,reuse:OwnedResourceBaseReuseWitness):string[];
 commit(world:World):void;
 discard():void;
}
/** Closed native MAIN only: its exact Decoder witness lists every replaced
 * resource and retains all other records without writers. This shape alone
 * grants no authority to a mutable RAW World. No tile or plant index is kept;
 * every other Marsh domain remains fully checked at its original frontier. */
export function createOwnedMarshTransportOwner():OwnedMarshTransportOwner {
 let confirmed:World|undefined,pending:World|undefined;
 const ownValue=(value:object,key:string):unknown=>{
  const d=Object.getOwnPropertyDescriptor(value,key);
  if(!d||!Object.hasOwn(d,'value')||!d.enumerable)throw Error('Expected own data');
  return d.value;
 };
 const ordinaryArray=(value:unknown):value is unknown[]=>Array.isArray(value)&&Object.getPrototypeOf(value)===Array.prototype;
 const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
 const positiveId=(value:unknown):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>0;
 const resources=(world:World,changedTiles:readonly number[]|undefined,reuse:OwnedResourceReuseWitness|undefined,baseOnly=false):readonly Resource[]=>{
  // Metadata can request a full fallback; an actual replacement refusal below
  // never retries on a favorable population or silently omits that resource.
  try{
   const base=confirmed;
   if(!base||!reuse||ownValue(reuse,'kind')!=='sparse'||ownValue(reuse,'previous')!==base
     ||world.schemaVersion!==base.schemaVersion||world.width!==base.width||world.height!==base.height
     ||world.seed!==base.seed||world.site?.revision!==base.site?.revision
     ||!Number.isSafeInteger(world.tick)||!Number.isSafeInteger(base.tick)||world.tick<base.tick
     ||world.tiles!==base.tiles||!ordinaryArray(changedTiles)||changedTiles.length!==0
     ||Reflect.ownKeys(changedTiles).length!==1)return world.resources;
   const before=base.resources,after=world.resources;
   if(!ordinaryArray(before)||!ordinaryArray(after)||before.length!==after.length)return after;
   const updated=ownValue(reuse,'updated');
   if(!ordinaryArray(updated)||Reflect.ownKeys(updated).length!==updated.length+1)return after;
   if(updated.length>=after.length)return after;
   if(!updated.length)return baseOnly||after===before?[]:after;
   if(after===before)return after;
   const ordinals:number[]=[],seen=new Set<number>();
   for(let i=0;i<updated.length;i++){
    const update=ownValue(updated,String(i));if(!record(update))return after;
    const ordinal=ownValue(update,'afterOrdinal'),id=ownValue(update,'id');
    if(typeof ordinal!=='number'||!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>=after.length
      ||seen.has(ordinal)||!positiveId(id))return after;
    const old=ownValue(before,String(ordinal)),next=ownValue(after,String(ordinal));
    if(!record(old)||!record(next)||ownValue(old,'id')!==id||ownValue(next,'id')!==id)return after;
    seen.add(ordinal);ordinals.push(ordinal);
   }
   // Producer update order follows packet touches; diagnostics follow the
   // complete resource Array's historical order, including rock transitions.
   ordinals.sort((a,b)=>a-b);
   return ordinals.map(ordinal=>after[ordinal] as Resource);
  }catch{return world.resources;}
 };
 return {
  validate(world,changedTiles,reuse){
   pending=undefined;
   const errors=validateMarshTransportResources(world,world.schemaVersion,changedTiles,()=>resources(world,changedTiles,reuse));
   if(!errors.length)pending=world;
   return errors;
  },
  validateBase(world,changedTiles,reuse){
   pending=undefined;
   const witness:OwnedResourceReuseWitness|undefined=reuse.kind==='resource-base'?{kind:'sparse',previous:reuse.previous,updated:reuse.updated}:undefined;
   const errors=validateMarshTransportResources(world,world.schemaVersion,changedTiles,()=>resources(world,changedTiles,witness,true));
   if(!errors.length)pending=world;
   return errors;
  },
  // Only the caller's fully applied result can publish the pending predecessor.
  commit(world){confirmed=pending===world?pending:undefined;pending=undefined;},
  discard(){pending=undefined;},
 };
}
