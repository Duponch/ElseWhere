/** Plant family: wild flora, trees, sown crops and existing potted plants. */
import {exact,adapt,drop,type DefMapping} from './mapping.ts';
import type {PlantSpecies} from '../../sim/biome-flora.ts';
import type {CropKind} from '../../sim/crops.ts';

export type PlantSpec={readonly wild:PlantSpecies}|{readonly crop:CropKind}|{readonly pot:'daylily'};
const wild=(s:PlantSpecies)=>exact<PlantSpec>({wild:s});
const crop=(c:CropKind)=>exact<PlantSpec>({crop:c});
const none=(why:string)=>drop<PlantSpec>(why);
export const PLANT_MAP:Readonly<Record<string,DefMapping<PlantSpec>>>={
 Plant_Grass:wild('grass'),Plant_TallGrass:wild('tall-grass'),Plant_Brambles:wild('brambles'),Plant_Bush:wild('bush'),Plant_Dandelion:wild('dandelion'),
 Plant_Berry:wild('berry-bush'),Plant_HealrootWild:wild('healroot-wild'),Plant_Moss:wild('moss'),Plant_Agave:wild('agave'),Plant_SaguaroCactus:wild('saguaro'),
 Plant_PincushionCactus:wild('pincushion-cactus'),Plant_Alocasia:wild('alocasia'),Plant_Astragalus:wild('astragalus'),Plant_Chokevine:wild('chokevine'),
 Plant_Clivia:wild('clivia'),Plant_Rafflesia:wild('rafflesia'),Plant_ShrubLow:wild('low-shrub'),
 Plant_TreeOak:wild('oak'),Plant_TreePoplar:wild('poplar'),Plant_TreePine:wild('pine'),Plant_TreeBirch:wild('birch'),Plant_TreeMaple:wild('maple'),
 Plant_TreeWillow:wild('willow'),Plant_TreeCypress:wild('cypress'),Plant_TreeTeak:wild('teak'),Plant_TreePalm:wild('palm'),Plant_TreeBamboo:wild('bamboo'),
 Plant_TreeCecropia:wild('cecropia'),Plant_TreeDrago:wild('drago'),
 Glowstool:wild('glowstool'),Agarilux:wild('agarilux'),Bryolux:wild('bryolux'),
 Plant_Rice:crop('rice'),Plant_Potato:crop('potato'),Plant_Corn:crop('corn'),Plant_Cotton:crop('cotton'),Plant_Healroot:crop('healroot'),
 Plant_Haygrass:crop('haygrass'),Plant_Hops:crop('hops'),Plant_Devilstrand:crop('devilstrand'),
 Plant_Strawberry:none('Fraisier cultivé : culture absente d’Elsewhere.'),Plant_Ambrosia:none('Ambroisie : plante absente.'),
 Plant_Daylily:exact<PlantSpec>({pot:'daylily'}),Plant_Rose:none('Rosier (pot de fleurs) : fleur décorative absente.'),
 Plant_Tinctoria:none('Tinctoria (teinture) : plante absente.'),Plant_Smokeleaf:none('Feuille à fumer : drogue absente.'),Plant_Psychoid:none('Psychoïde : drogue absente.'),
 Plant_TreeCocoa:none('Cacaoyer : arbre absent.'),Plant_Timbershroom:none('Champignon de bois : plante absente.'),Plant_TreeGauranlen:none('Arbre Gauranlen : extension, absent.'),
};
/** Dead plants are separate things in the save. */
export const DEAD_PLANT_MAP:Readonly<Record<string,DefMapping<never>>>={
 SmashedStump:drop('Souche brisée : décor non recréé.'),ChoppedStump:drop('Souche coupée : décor non recréé.'),BurnedTree:drop('Arbre calciné : décor non recréé.'),
 BurnedBush:drop('Buisson calciné : décor non recréé.'),
};
/** Plant chosen for a growing zone (crops, and trees for forestry). */
export type ZonePlant=import('../../sim/forestry-content-291.ts').GrowingPlant291;
export function zonePlant(def:string|undefined):DefMapping<ZonePlant>|undefined {
 if(!def)return undefined;const m=PLANT_MAP[def];if(!m)return undefined;if('drop' in m)return m;
 if('crop' in m.to)return exact(m.to.crop);
 if('pot' in m.to)return drop('Hémérocalle : culture en pot, pas en champ dans Elsewhere.');
 const trees:readonly string[]=['oak','poplar','pine','birch','saguaro','drago','bamboo','cecropia','cypress','maple','palm','teak','willow'];
 return trees.includes(m.to.wild)?exact(m.to.wild as ZonePlant):adapt('potato','Plante sauvage choisie pour un champ : le champ cultivera des pommes de terre.');
}
