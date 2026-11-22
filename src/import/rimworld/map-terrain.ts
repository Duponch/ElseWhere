/** Terrain and roof families. A RimWorld cell keeps a top terrain (natural
 * ground or a built floor) and, under a floor, the ground it covers. An
 * Elsewhere tile keeps the natural terrain and an optional floor on top. */
import {exact,adapt,drop,STONES,stoneId,type DefMapping} from './mapping.ts';
import type {Terrain} from '../../sim/types.ts';
import type {FloorKind} from '../../sim/flooring.ts';
import type {StoneKind} from '../../sim/geology.ts';
import {CARPET_COLOR_IDS_355,CARPET_COLORS_355} from '../../sim/carpet-355.ts';

export type GroundSpec={readonly kind:'ground';readonly terrain:Terrain;readonly stone?:StoneKind};
export type FloorSpec={readonly kind:'floor';readonly floor:FloorKind};
export type BridgeSpec={readonly kind:'bridge'};
export type TerrainSpec=GroundSpec|FloorSpec|BridgeSpec;
const ground=(terrain:Terrain,stone?:StoneKind):GroundSpec=>({kind:'ground',terrain,...stone?{stone}:{}});
const floor=(f:FloorKind):FloorSpec=>({kind:'floor',floor:f});

const table:Record<string,DefMapping<TerrainSpec>>={
 Soil:exact(ground('soil-natural')),SoilRich:exact(ground('rich-soil')),Gravel:exact(ground('gravel')),MossyTerrain:exact(ground('mossy-soil')),
 MarshyTerrain:exact(ground('marshy-soil')),Mud:exact(ground('mud')),Sand:exact(ground('sand')),SoftSand:exact(ground('soft-sand')),Ice:exact(ground('ice')),
 Riverbank:exact(ground('riverbank')),Marsh:exact(ground('marsh')),WaterShallow:exact(ground('water-shallow')),WaterDeep:exact(ground('water-deep')),
 WaterOceanShallow:exact(ground('ocean-shallow')),WaterOceanDeep:exact(ground('ocean-deep')),WaterMovingShallow:exact(ground('river-shallow')),
 WaterMovingChestDeep:exact(ground('river-chest-deep')),PackedDirt:exact(ground('packed-dirt')),
 WoodPlankFloor:exact(floor('wood-planks')),MetalTile:exact(floor('steel-tile')),SterileTile:exact(floor('sterile-tile')),StrawMatting:exact(floor('straw-matting')),
 BurnedWoodPlankFloor:exact(floor('burned-wood')),BurnedCarpet:exact(floor('burned-carpet')),BurnedStrawMatting:exact(floor('burned-straw-matting')),
 BrokenAsphalt:exact(floor('broken-asphalt')),AncientTile:exact(floor('ancient-tile')),AncientConcrete:exact(floor('ancient-concrete')),
 AncientWoodPlankFloor:adapt(floor('wood-planks'),'Plancher ancien : devient un plancher de bois.'),
 Concrete:adapt(floor('ancient-concrete'),'Béton : devient le béton ancien d’Elsewhere (même aspect, non constructible).'),
 PavedTile:adapt(floor('ancient-tile'),'Dalles pavées : deviennent du carrelage ancien.'),
 SilverTile:adapt(floor('steel-tile'),'Carrelage d’argent : devient du carrelage d’acier (beauté et valeur moindres).'),
 GoldTile:adapt(floor('steel-tile'),'Carrelage d’or : devient du carrelage d’acier (beauté et valeur moindres).'),
 Bridge:exact({kind:'bridge'}),AncientBridge:adapt({kind:'bridge'},'Pont ancien : devient un pont ordinaire.'),
 Underwall:drop('Sol sous un mur ancien : le sol naturel dessous est repris.'),
 Carpet:adapt(floor('carpet-red'),'Tapis sans couleur connue : tapis rouge.'),
};
for(const stone of STONES){
 const id=stoneId(stone);
 table[`${stone}_Rough`]=exact(ground('rough-stone',id));
 table[`${stone}_RoughHewn`]=adapt(ground('rough-stone',id),'Roche dégrossie : devient de la roche brute.');
 table[`${stone}_Smooth`]=exact(ground('smoothed-stone',id));
 table[`Tile${stone}`]=exact(floor(`${id}-tile` as FloorKind));
 table[`Flagstone${stone}`]=exact(floor(`${id}-flagstone` as FloorKind));
}
for(const color of CARPET_COLOR_IDS_355)table[`Carpet${CARPET_COLORS_355[color].core.replace(/^Structure_/,'')}`]=exact(floor(`carpet-${color}` as FloorKind));
export const TERRAIN_MAP:Readonly<Record<string,DefMapping<TerrainSpec>>>=table;

export type RoofSpec='constructed'|'thin'|'thick';
export const ROOF_MAP:Readonly<Record<string,DefMapping<RoofSpec>>>={RoofConstructed:exact('constructed'),RoofRockThin:exact('thin'),RoofRockThick:exact('thick')};

/** Natural rock walls and ores, stored in the compressed thing grid (or as
 * things when damaged). */
export type RockSpec={readonly stone?:StoneKind;readonly ore?:'jade'|'steel'|'machinery'|'gold'|'silver'|'uranium'|'plasteel'};
const rocks:Record<string,DefMapping<RockSpec>>={
 MineableSteel:exact({ore:'steel'}),MineableSilver:exact({ore:'silver'}),MineableGold:exact({ore:'gold'}),MineableUranium:exact({ore:'uranium'}),
 MineablePlasteel:exact({ore:'plasteel'}),MineableJade:exact({ore:'jade'}),MineableComponentsIndustrial:exact({ore:'machinery'}),
 CollapsedRocks:drop('Éboulis : non recréés (sol dégagé).'),RaisedRocks:drop('Roches surélevées : non recréées.'),
};
for(const stone of STONES)rocks[stone]=exact({stone:stoneId(stone)});
export const ROCK_MAP:Readonly<Record<string,DefMapping<RockSpec>>>=rocks;
/** Stone chunks may also sit in the compressed grid. */
export const COMPRESSED_CHUNKS=[...STONES.map(s=>`Chunk${s}`),'ChunkSlagSteel','ChunkMechanoidSlag'] as const;
/** Colour definitions of carpets (colour grid of 1.6 saves without per-colour terrain). */
export const COLOR_DEF_NAMES=CARPET_COLOR_IDS_355.map(c=>CARPET_COLORS_355[c].core);
