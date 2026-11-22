/** World family: biomes, relief, rivers, roads, terrain modifiers, factions
 * and world settings. The Elsewhere planet mesh has the same tile numbering
 * and neighbour order as the game's surface layer (checked on real saves:
 * same tile count for a coverage, road and river links land on adjacent
 * route tiles), so tiles are copied one by one. */
import {exact,adapt,drop,type DefMapping} from './mapping.ts';
import type {WorldBiome} from '../../sim/world-biome-selection.ts';
import type {WorldRelief} from '../../sim/world-climate-evaluation.ts';
import type {WorldRiverId} from '../../sim/world-rivers.ts';
import type {WorldRoadId} from '../../sim/world-roads.ts';
import type {ConfigurableWorldFaction} from '../../sim/world-generation-settings.ts';

export const BIOME_MAP:Readonly<Record<string,DefMapping<WorldBiome>>>={
 TemperateForest:exact('temperate-forest'),BorealForest:exact('boreal-forest'),Tundra:exact('tundra'),IceSheet:exact('ice-sheet'),SeaIce:exact('sea-ice'),
 ColdBog:exact('cold-bog'),TemperateSwamp:exact('temperate-swamp'),TropicalRainforest:exact('tropical-rainforest'),TropicalSwamp:exact('tropical-swamp'),
 AridShrubland:exact('arid-shrubland'),Desert:exact('desert'),ExtremeDesert:exact('extreme-desert'),Ocean:exact('ocean'),Lake:exact('lake'),
};
/** Hilliness enum values as saved (byte): 1 flat … 5 impassable. */
export const HILLINESS_MAP:Readonly<Record<number,WorldRelief>>={1:'flat',2:'small-hills',3:'large-hills',4:'mountainous',5:'impassable'};
export const RIVER_MAP:Readonly<Record<string,DefMapping<WorldRiverId>>>={HugeRiver:exact('huge-river'),LargeRiver:exact('large-river'),River:exact('river'),Creek:exact('creek')};
export const ROAD_MAP:Readonly<Record<string,DefMapping<WorldRoadId>>>={
 DirtPath:exact('dirt-path'),DirtRoad:exact('dirt-road'),StoneRoad:exact('stone-road'),AncientAsphaltRoad:exact('ancient-asphalt-road'),AncientAsphaltHighway:exact('ancient-asphalt-highway'),
};
/** Terrain modifiers kept by the planet: mountain 1, caves 2, river 4, coast 8.
 * Mountain, river and coast are recomputed from the tile itself (the planet
 * requires it); only the cave choice is taken from the save. */
export const MUTATOR_MAP:Readonly<Record<string,DefMapping<1|2|4|8>>>={
 Mountain:exact(1),Caves:exact(2),River:exact(4),Coast:exact(8),
 Lakeshore:drop('Rive de lac : modificateur absent d’Elsewhere.'),Pond:drop('Étang : modificateur absent.'),Bay:drop('Baie : modificateur absent.'),
 Peninsula:drop('Péninsule : modificateur absent.'),Headwater:drop('Source : modificateur absent.'),RiverConfluence:drop('Confluent : modificateur absent.'),
 RiverDelta:drop('Delta : modificateur absent.'),RiverIsland:drop('Île de rivière : modificateur absent.'),
};
export const FACTION_MAP:Readonly<Record<string,DefMapping<ConfigurableWorldFaction|'PlayerColony'|'PlayerTribe'>>>={
 OutlanderCivil:exact('OutlanderCivil'),OutlanderRough:exact('OutlanderRough'),TribeCivil:exact('TribeCivil'),TribeRough:exact('TribeRough'),
 TribeSavage:exact('TribeSavage'),Pirate:exact('Pirate'),Mechanoid:exact('Mechanoid'),Insect:exact('Insect'),Ancients:exact('Ancients'),
 AncientsHostile:exact('AncientsHostile'),PlayerColony:exact('PlayerColony'),PlayerTribe:exact('PlayerTribe'),
 OutlanderRefugee:drop('Faction temporaire de quête : non recréée.'),
};
/** World settings: the saved names of the seven-step scales (0 … 6). */
export const WORLD_SCALE:Readonly<Record<string,number>>={
 AlmostNone:0,Little:1,LittleBitLess:2,Normal:3,LittleBitMore:4,High:5,VeryHigh:6,
 VeryCold:0,Cold:1,LittleBitColder:2,LittleBitWarmer:4,Hot:5,VeryHot:6,
};
export function worldScale(value:string|undefined):number {return value!==undefined&&Object.hasOwn(WORLD_SCALE,value)?WORLD_SCALE[value]!:3;}
export const RELATION_NOTE=adapt(null,'Relations entre factions étrangères : reprises de la sauvegarde ; leaders et colonies recréés par Elsewhere.');
