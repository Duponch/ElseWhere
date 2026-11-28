import {isAncientGeneratedFloor256} from './ancient-generated-floor-state-256.ts';
/** Pure adaptation of the actual17 Core terrain definitions. No terrain
 * rewrite, map scan, owner, cadence or generic terrain registry is introduced. */
import {NATURAL_TERRAIN_DEFINITIONS_256 as DEFS,NATURAL_TERRAIN_BINDINGS_256 as BINDINGS,isNaturalTerrain256,type TerrainAffordance256} from './local-terrain-definitions-256.ts';
import type {Tile} from './types.ts';
import {STONE_KINDS} from './geology.ts';
import {PACKED_DIRT_256} from './road-ground-256.ts';
import {isSchema281OrLater} from './schema-compatibility-257.ts';
import {isSmoothedStone281,SMOOTHED_STONE_TERRAIN_281,SMOOTHED_STONE_FACTS_281} from './smooth-floor-terrain-281.ts';
export const NATURAL_TERRAIN_RUNTIME_SCHEMA=256;
export interface TerrainRuntimeMetadata256 {schemaVersion?:number;site?:{revision:number};developerTest381?:true;developerPlacements381?:import('./developer-import-381.ts').DevPlacements381}
const historical=new Set(['grass','soil','water','rock','rough-stone','rich-soil','gravel','marsh','water-shallow']);
export function terrainAvailable256(terrain:unknown,version:number):boolean {if(isSmoothedStone281(terrain))return isSchema281OrLater(version);return terrain==='grass'||terrain==='soil'||terrain==='water'||terrain==='rock'||terrain==='rough-stone'&&version>=28||(terrain==='rich-soil'||terrain==='gravel')&&version>=83||terrain==='marsh'&&version>=246||terrain==='water-shallow'&&version>=254||version>=256&&(terrain==='packed-dirt'||isNaturalTerrain256(terrain));}
export function terrainHasProspectiveRules256(terrain:unknown,w:TerrainRuntimeMetadata256):boolean {if(isSmoothedStone281(terrain))return isSchema281OrLater(w.schemaVersion);return (w.schemaVersion??255)>=256&&(terrain==='packed-dirt'||isNaturalTerrain256(terrain)&&(!historical.has(terrain)||w.site?.revision===3));}
export function terrainIsWater256(terrain:unknown):boolean {return isNaturalTerrain256(terrain)&&DEFS[terrain].water;}
export function terrainBridgeable256(terrain:unknown,version:number):boolean {return terrainAvailable256(terrain,version)&&isNaturalTerrain256(terrain)&&DEFS[terrain].affordances.includes('Bridgeable');}
export function terrainExtinguishesFire256(tile:Pick<Tile,'terrain'|'bridge'|'floor'>):boolean {return !tile.bridge&&!tile.floor&&(tile.terrain==='water'||isNaturalTerrain256(tile.terrain)&&DEFS[tile.terrain].extinguishesFire);}
export function terrainAcceptsFilth256(tile:Pick<Tile,'terrain'|'bridge'|'floor'>):boolean {if(tile.bridge||tile.floor)return true;if(isSmoothedStone281(tile.terrain))return SMOOTHED_STONE_FACTS_281.acceptsUnnaturalFilth;if(isNaturalTerrain256(tile.terrain))return DEFS[tile.terrain].affordances.includes('Walkable')&&DEFS[tile.terrain].acceptsUnnaturalFilth;return tile.terrain!=='water'&&tile.terrain!=='rock';}
export function terrainHoldsSnow256(terrain:unknown,bridge=false):boolean {if(bridge)return true;if(isSmoothedStone281(terrain))return SMOOTHED_STONE_FACTS_281.holdsSnow;return isNaturalTerrain256(terrain)?DEFS[terrain].holdsSnow:terrain!=='water'&&terrain!=='rock';}
export function terrainExtraDeterioration256(tile:Pick<Tile,'terrain'|'floor'|'bridge'>):number {return tile.bridge||tile.floor?0:tile.terrain==='water'?3:isNaturalTerrain256(tile.terrain)?DEFS[tile.terrain].extraDeterioration:0;}
/** Complete affordances apply only to newly introduced identities or a true
 * geographic site3. Neutral migrations keep old rough-stone graves literal. */
export function terrainSupportsAffordance256(tile:Pick<Tile,'terrain'|'bridge'|'floor'>&Partial<Pick<Tile,'mineable'>>,need:TerrainAffordance256,w:TerrainRuntimeMetadata256):boolean {
 if(!terrainAvailable256(tile.terrain,w.schemaVersion??255))return false;
 if(isAncientGeneratedFloor256(tile.floor))return (w.schemaVersion??255)>=256&&terrainSupportsFloor256(tile,w)&&['Walkable','Light','Medium','Heavy'].includes(need);
 if(tile.bridge)return terrainBridgeable256(tile.terrain,w.schemaVersion??255)&&(need==='Walkable'||need==='Light');
 if(tile.floor==='broken-asphalt')return (w.schemaVersion??255)>=256&&['Walkable','Light','Medium','Heavy'].includes(need);
 if(tile.terrain==='packed-dirt'&&!tile.floor)return PACKED_DIRT_256.affordances.includes(need);
 if(!terrainHasProspectiveRules256(tile.terrain,w))return tile.terrain!=='marsh'&&tile.terrain!=='water-shallow';
 if(tile.floor)return terrainSupportsAffordance256({terrain:tile.terrain},'Heavy',w)&&['Walkable','Light','Medium','Heavy'].includes(need);
 if(isSmoothedStone281(tile.terrain))return (SMOOTHED_STONE_FACTS_281.affordances as readonly TerrainAffordance256[]).includes(need);
 return isNaturalTerrain256(tile.terrain)&&DEFS[tile.terrain].affordances.includes(need);
}
/** Every delivered constructed floor inherits Core FloorBase Heavy. */
export function terrainSupportsFloor256(tile:Pick<Tile,'terrain'|'bridge'>&Partial<Pick<Tile,'floor'|'mineable'>>,w:TerrainRuntimeMetadata256):boolean {if(isAncientGeneratedFloor256(tile.floor))return (w.schemaVersion??255)>=256&&!tile.bridge&&(tile.terrain!=='rock'||tile.mineable!==undefined)&&terrainSupportsAffordance256({terrain:tile.mineable?.terrain??tile.terrain},'Heavy',w);if(tile.floor==='broken-asphalt')return (w.schemaVersion??255)>=256&&terrainAvailable256(tile.terrain,w.schemaVersion??255)&&tile.terrain!=='rock'&&!tile.bridge;return terrainHasProspectiveRules256(tile.terrain,w)?terrainSupportsAffordance256({terrain:tile.terrain,bridge:tile.bridge},'Heavy',w):terrainAvailable256(tile.terrain,w.schemaVersion??255)&&!['rock','water','marsh','water-shallow'].includes(tile.terrain);}
export function terrainGroundFertility256(tile:Pick<Tile,'terrain'|'bridge'|'floor'>):number {if(tile.floor||tile.bridge)return 0;return isNaturalTerrain256(tile.terrain)?DEFS[tile.terrain].fertility:tile.terrain==='grass'?1:tile.terrain==='soil'?.7:0;}
const coreIds=new Map<string,string>(Object.entries(BINDINGS).map(([core,id])=>[id,core]));
const soilTags=new Set(['soil-natural','rich-soil','gravel','mossy-soil','marshy-soil','riverbank']);
/** Real Core tags/def identity for the existing narrow flora profile guard. */
export function naturalPlantSubstrate256(tile:Pick<Tile,'terrain'|'bridge'|'floor'|'stone'>,scratch?:{fertility:number;terrainDefId:string;tags:string[]}):{fertility:number;terrainDefId:string;tags:readonly string[]} {
 const t=tile.terrain,tags=scratch?.tags??[];tags.length=0;
 if(isSmoothedStone281(t))tags.push('Floor');else if(soilTags.has(t))tags.push('Soil');else if(t==='mud')tags.push('Mud');else if(t==='marsh')tags.push('Water','WaterMarshy');else if(t==='ice')tags.push('Ice');else if(t==='river-shallow')tags.push('Water','River','WaterFreshShallow','WaterFreshShallowMoving');else if(t==='river-chest-deep')tags.push('Water','River');else if(t==='water-shallow')tags.push('Water','WaterFreshShallow','WaterFreshShallowStill');else if(t==='ocean-shallow'||t==='ocean-deep')tags.push('Water','Ocean');else if(t==='water-deep')tags.push('Water');
 const stone=tile.stone?tile.stone[0]!.toUpperCase()+tile.stone.slice(1)+(isSmoothedStone281(t)?'_Smooth':'_Rough'):undefined;
 const fertility=terrainGroundFertility256(tile),terrainDefId=t==='packed-dirt'?'PackedDirt':coreIds.get(t)??((t==='rough-stone'||isSmoothedStone281(t))&&stone?stone:t);
 if(tile.bridge||tile.floor)tags.length=0;else if(t==='packed-dirt'){tags.length=0;tags.push('Road');}
 // Only a synchronous caller may reuse this DTO; public calls still own fresh values.
 if(scratch){scratch.fertility=fertility;scratch.terrainDefId=terrainDefId;return scratch;}
 return {fertility,terrainDefId,tags};
}

/** Only static definition DTOs live here. Public substrate results remain fresh;
 * this readonly path neither retains tiles nor certifies their validity. */
type ReadonlyPlantSubstrate256=Readonly<ReturnType<typeof naturalPlantSubstrate256>>;
type ReadonlyPlantSubstratePair256=readonly [ReadonlyPlantSubstrate256,ReadonlyPlantSubstrate256];
function staticPlantSubstratePair256(tile:Pick<Tile,'terrain'|'stone'>):ReadonlyPlantSubstratePair256 {
 const freeze=(value:ReturnType<typeof naturalPlantSubstrate256>):ReadonlyPlantSubstrate256=>{Object.freeze(value.tags);return Object.freeze(value);};
 return Object.freeze([freeze(naturalPlantSubstrate256(tile)),freeze(naturalPlantSubstrate256({...tile,floor:'wood-planks'}))] as const);
}
const readonlyPlantSubstrates256:ReadonlyMap<Tile['terrain'],ReadonlyPlantSubstratePair256>=new Map(
 ([...Object.values(BINDINGS),'rough-stone',SMOOTHED_STONE_TERRAIN_281,'packed-dirt','grass','soil','water','rock'] as Tile['terrain'][]).map(terrain=>[terrain,staticPlantSubstratePair256({terrain})] as const)
);
const readonlyRoughPlantSubstrates256:ReadonlyMap<string,ReadonlyPlantSubstratePair256>=new Map(
 STONE_KINDS.map(stone=>{const pair=staticPlantSubstratePair256({terrain:'rough-stone',stone});return [pair[0].terrainDefId,pair] as const;})
);
const readonlySmoothPlantSubstrates281:ReadonlyMap<string,ReadonlyPlantSubstratePair256>=new Map(
 STONE_KINDS.map(stone=>{const pair=staticPlantSubstratePair256({terrain:SMOOTHED_STONE_TERRAIN_281,stone});return [pair[0].terrainDefId,pair] as const;})
);
/** Re-read the actual tile every time, including malformed stone before any
 * surface/fertility access. Returned shared definitions are deeply frozen. */
export function readNaturalPlantSubstrate256(tile:Pick<Tile,'terrain'|'bridge'|'floor'|'stone'>):ReadonlyPlantSubstrate256 {
 const t=tile.terrain;
 const stone=tile.stone?tile.stone[0]!.toUpperCase()+tile.stone.slice(1)+(isSmoothedStone281(t)?'_Smooth':'_Rough'):undefined;
 const fertility=terrainGroundFertility256(tile),pair=readonlyPlantSubstrates256.get(t);
 const terrainDefId=(t==='rough-stone'||isSmoothedStone281(t))&&stone?stone:pair?.[0].terrainDefId??t;
 const layered=tile.bridge||tile.floor;
 const actualPair=isSmoothedStone281(t)&&stone?readonlySmoothPlantSubstrates281.get(stone):t==='rough-stone'&&stone?readonlyRoughPlantSubstrates256.get(stone):pair;
 const value=actualPair?.[layered?1:0];
 if(value&&value.fertility===fertility&&value.terrainDefId===terrainDefId)return value;
 return {fertility,terrainDefId,tags:layered?[]:[...(pair?.[0].tags??[])]};
}
