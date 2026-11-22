import {NATURAL_TERRAIN_DEFINITIONS_256 as NATURAL,isNaturalTerrain256} from '../sim/local-terrain-definitions-256';
import {terrainHasProspectiveRules256,type TerrainRuntimeMetadata256} from '../sim/natural-terrain-runtime-256';
import {terrainTravelDelay} from '../sim/furniture-travel';
import type {World} from '../sim/types';
import { isGrowingTerrain, soilFertility } from '../sim/soil';
import type { Terrain, Tile } from '../sim/types';
import { FLOOR_DEFINITIONS } from '../sim/flooring';
import {isSmoothedStone281,smoothedStoneLabel281,SMOOTHED_STONE_FACTS_281} from '../sim/smooth-floor-terrain-281';

export const TERRAIN_LABELS: Record<Terrain, string> = {
  'packed-dirt':'Terre tassée',
  'soil-natural':'Terre fertile',
  'mossy-soil':'Sol moussu','marshy-soil':'Sol marécageux',mud:'Boue',sand:'Sable','soft-sand':'Sable meuble',ice:'Glace',riverbank:'Alluvions',
  'water-deep':'Eau profonde infranchissable','ocean-shallow':'Eau marine peu profonde','ocean-deep':'Eau marine profonde infranchissable',
  'river-shallow':'Rivière peu profonde','river-chest-deep':'Rivière profonde traversable',
  grass: 'Terre ordinaire',
  soil: 'Terre pauvre',
  'rich-soil': 'Terre riche',
  gravel: 'Gravier',
  'rough-stone': 'Sol rocheux brut',
  'smoothed-stone':'Sol rocheux lissé',
  marsh: 'Marais',
  water: 'Eau infranchissable',
  'water-shallow': 'Eau peu profonde',
  rock: 'Massif rocheux infranchissable',
};

const legacy=new Set<string>(['grass','soil','rich-soil','gravel','rough-stone','marsh','water','water-shallow','rock']);
const prospective=(tile:Tile,metadata?:TerrainRuntimeMetadata256)=>metadata?terrainHasProspectiveRules256(tile.terrain,metadata):!legacy.has(tile.terrain)&&isNaturalTerrain256(tile.terrain);
export const terrainSurfaceLabel=(tile:Tile):string=>tile.collapsedRock?'Roche effondrée infranchissable':tile.smoothedWall367?'Paroi rocheuse lissée infranchissable':tile.bridge?`Pont en bois sur ${TERRAIN_LABELS[tile.terrain].toLocaleLowerCase('fr')}`:tile.floor?FLOOR_DEFINITIONS[tile.floor].label:isSmoothedStone281(tile.terrain)?smoothedStoneLabel281(tile.stone):TERRAIN_LABELS[tile.terrain];
export const bridgeTerrainNote=(tile:Tile):string=>tile.collapsedRock?`Pont en bois conservé sous la roche · Terrain sous-jacent : ${TERRAIN_LABELS[tile.collapsedRock.terrain].toLocaleLowerCase('fr')}`:tile.terrain==='water-shallow'||tile.terrain==='marsh'?`Support léger uniquement · Marche : +0 tick (${tile.terrain==='water-shallow'?'eau peu profonde nue':'marais nu'} : +3)`:`Support léger uniquement · Marche : +0 tick (terrain sous le pont : ${TERRAIN_LABELS[tile.terrain].toLocaleLowerCase('fr')} · +${isNaturalTerrain256(tile.terrain)?NATURAL[tile.terrain].pathCostCore/10:0})`;
/** Terrain passage, distinct from furniture standability or a reachable route. */
export function terrainSurfaceWalkable(tile:Tile,metadata?:TerrainRuntimeMetadata256):boolean {
 if(tile.terrain==='rock'||tile.collapsedRock)return false;
 if(tile.bridge||tile.floor)return true;
 if(isSmoothedStone281(tile.terrain))return !metadata||terrainHasProspectiveRules256(tile.terrain,metadata);
 return prospective(tile,metadata)&&isNaturalTerrain256(tile.terrain)?NATURAL[tile.terrain].affordances.includes('Walkable'):tile.terrain!=='water';
}
export function terrainSurfaceSpeed(world:World,index:number):number {const tile=world.tiles[index];return tile&&terrainSurfaceWalkable(tile,world)?Math.round(300/(3+terrainTravelDelay(world,index))):0;}
/** Pure facts from actual future terrain; this does not promise an accessible
 * free cell, an authorized blueprint or crop admission at the current light. */
export function terrainAffordanceNote(tile:Tile,metadata?:TerrainRuntimeMetadata256):string {
 if(tile.collapsedRock)return 'Passage impossible · Case occupée par une roche · Dégager avant construction ou culture';
 if(tile.bridge)return bridgeTerrainNote(tile);
 if(tile.floor)return 'Support de revêtement · Terrain non cultivable';
 if(isSmoothedStone281(tile.terrain))return metadata&&!terrainHasProspectiveRules256(tile.terrain,metadata)?'':'Marche : +0 tick · Supports léger, moyen et lourd · Terrain non cultivable';
 if(!prospective(tile,metadata)||!isNaturalTerrain256(tile.terrain))return '';
 const d=NATURAL[tile.terrain],a=d.affordances,walk=a.includes('Walkable');
 const support=a.includes('Heavy')?'Supports léger, moyen et lourd':a.includes('Medium')?'Supports léger et moyen':a.includes('Light')?'Support léger uniquement':'Support de construction ordinaire absent';
 return `${walk?`Marche : +${d.pathCostCore/10} tick(s)`:'Passage impossible'} · ${support} · ${a.includes('GrowSoil')?'Sol de culture (fertilité et plante à vérifier)':'Sol de culture absent'}${a.includes('Bridgeable')?' · Pont en bois possible':''}${d.water&&!a.includes('WaterproofConduitable')?' · Conduit électrique ordinaire incompatible':''}`;
}

/** Describe the actual saved terrain even when a plant or rock occupies it.
 * This is soil suitability, not a promise that the cell can be sown now. */
function baseTerrainInspection(tile: Tile,metadata?:TerrainRuntimeMetadata256): string {
  if(tile.collapsedRock){const retained=tile.bridge?bridgeTerrainNote(tile):tile.floor?`Revêtement conservé : ${FLOOR_DEFINITIONS[tile.floor].label}`:`Terrain conservé : ${isSmoothedStone281(tile.collapsedRock.terrain)?smoothedStoneLabel281(tile.stone):TERRAIN_LABELS[tile.collapsedRock.terrain]}`;
    return `Sol : ${terrainSurfaceLabel(tile)} · Fertilité : 0 % · ${terrainAffordanceNote(tile,metadata)} · ${retained}`;}
  if(isSmoothedStone281(tile.terrain)&&!tile.bridge){
    const facts=SMOOTHED_STONE_FACTS_281,label=smoothedStoneLabel281(tile.stone);
    if(tile.floor)return `Sol : ${FLOOR_DEFINITIONS[tile.floor].label} · Fertilité : 0 % · Propreté du revêtement : ${FLOOR_DEFINITIONS[tile.floor].cleanliness.toFixed(1)} · Terrain non cultivable · Terrain conservé : ${label}`;
    return `Sol : ${label} · Fertilité : 0 % · Beauté : ${facts.beauty} · Propreté du sol : ${facts.cleanliness.toFixed(1)} · Valeur : ${facts.marketValue} · ${terrainAffordanceNote(tile,metadata)}`;
  }
  if(tile.bridge)return `Sol : ${terrainSurfaceLabel(tile)} · Fertilité : 0 % · Terrain non cultivable · ${bridgeTerrainNote(tile)}`;
  if(tile.floor)return `Sol : ${FLOOR_DEFINITIONS[tile.floor].label} · Fertilité : 0 % · Propreté du revêtement : ${FLOOR_DEFINITIONS[tile.floor].cleanliness.toFixed(1)} · Terrain non cultivable`;
  if(prospective(tile,metadata)&&isNaturalTerrain256(tile.terrain))return `Sol : ${terrainSurfaceLabel(tile)} · Fertilité : ${Math.round(NATURAL[tile.terrain].fertility*100)} % · ${terrainAffordanceNote(tile,metadata)}`;
  if(tile.terrain==='water-shallow')return 'Sol : Eau peu profonde · Fertilité : 0 % · Terrain non cultivable · Déplacements ralentis · Marche : +3 ticks · Support de construction ordinaire absent · Pont en bois possible · Conduit électrique ordinaire incompatible';
  if(tile.terrain==='marsh')return 'Sol : Marais · Fertilité : 0 % · Terrain non cultivable · Déplacements ralentis · Support de construction ordinaire absent · Conduit électrique ordinaire incompatible';
  const fertility = Math.round(soilFertility(tile.terrain) * 100);
  return `Sol : ${TERRAIN_LABELS[tile.terrain]} · Fertilité : ${fertility} % · ${isGrowingTerrain(tile.terrain) ? 'Terrain cultivable' : 'Terrain non cultivable'}`;
}

export function terrainInspection(tile:Tile,metadata?:TerrainRuntimeMetadata256):string {const depth=tile.snowDepth??0;return baseTerrainInspection(tile,metadata)+(depth>0?` · Neige : ${Math.round(depth*100)} % · Marche : +${depth<.25?0:depth<.5?.4:depth<.75?.8:1.2} tick(s)`:'');}
