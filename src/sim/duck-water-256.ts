import {naturalTerrainCosts256,naturalTerrainWalkable256} from './natural-terrain-movement-256.ts';
import {duckFlying256} from './duck-flight-state-256.ts';
import type {World,Tile,Cell} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
/** layerKey names the override when it is a pure function of the tile's
 * terrain, floor and bridge: terrain cost layers built with it can then be kept
 * like the plain ones (furniture-travel terrainCostLayer). */
export interface DuckTerrainOverride256 {readonly layerKey?:string;coreCost(tile:Tile):number|undefined;perceivedCore(tile:Tile):number|undefined}
/** Only actual Duck256. No replacement of solid buildings, snow or material
 * cost; callers overlay these independently in the existing cost producer. */
export function duckTerrainOverride256(w:Pick<World,'schemaVersion'>,a:Pick<WildAnimal,'species'|'flight'>):DuckTerrainOverride256|undefined {
 if(w.schemaVersion<256||a.species!=='duck')return;
 const flying=duckFlying256(a.flight),water=(t:Tile)=>!t.bridge&&!t.floor&&!!naturalTerrainCosts256(t.terrain)?.water;
 return {layerKey:flying?'duck-flying':'duck',coreCost:t=>water(t)?1:flying?0:undefined,perceivedCore:t=>water(t)?0:flying?0:undefined};
}
/** WaterDeep alone declares forcePassableByFlyingPawns. OceanDeep does not. */
export function duckTerrainWalkable256(w:Pick<World,'schemaVersion'>,a:Pick<WildAnimal,'species'|'flight'>,terrain:unknown):boolean {return naturalTerrainWalkable256(terrain)||w.schemaVersion>=256&&a.species==='duck'&&duckFlying256(a.flight)&&terrain==='water-deep';}
/** RCellFinder's waterSeeker part of wander admission, after ordinary physical
 * path/danger checks. rectangle is clipped, ten real uniform cell draws. No
 * search for globally nearest water, no forced water job and no world scan. */
export function duckWanderWaterAllowed256(w:Pick<World,'width'|'height'|'tiles'|'schemaVersion'>,a:Pick<WildAnimal,'species'|'domestic'>,candidate:Cell,anyWater:boolean,random:()=>number):boolean {
 if(w.schemaVersion<256||a.species!=='duck'||a.domestic||!anyWater)return true;
 const water=(c:Cell)=>{const tile=w.tiles[c.z*w.width+c.x];return !!tile&&!tile.floor&&!tile.bridge&&!!naturalTerrainCosts256(tile.terrain)?.water;};
 if(water(candidate))return true;
 const x0=Math.max(0,candidate.x-8),z0=Math.max(0,candidate.z-8),x1=Math.min(w.width-1,candidate.x+8),z1=Math.min(w.height-1,candidate.z+8),width=x1-x0+1,height=z1-z0+1;
 for(let i=0;i<10;i++){const x=x0+Math.floor(random()*width),z=z0+Math.floor(random()*height);if(water({x,z}))return true;}
 return false;
}

/** Exact tile-array owner. Build only on first Duck wander after load, then
 * update the changed cell from real surface mutators. No terrain scan per tick. */
const waterByTiles=new WeakMap<Tile[],{mask:Uint8Array;count:number}>();
const exposedWater=(tile:Tile):boolean=>!tile.floor&&!tile.bridge&&!!naturalTerrainCosts256(tile.terrain)?.water;
export function duckMapHasWater256(w:Pick<World,'tiles'>):boolean {
 let index=waterByTiles.get(w.tiles);if(!index){const mask=new Uint8Array(w.tiles.length);let count=0;for(let i=0;i<w.tiles.length;i++){mask[i]=Number(exposedWater(w.tiles[i]!));count+=mask[i]!;}index={mask,count};waterByTiles.set(w.tiles,index);}return index.count>0;
}
export function refreshDuckWaterCell256(w:Pick<World,'tiles'|'width'>,cell:Cell):void {const index=waterByTiles.get(w.tiles);if(!index)return;const i=cell.z*w.width+cell.x,t=w.tiles[i];if(!t)return;const next=Number(exposedWater(t));index.count+=next-index.mask[i]!;index.mask[i]=next;}
