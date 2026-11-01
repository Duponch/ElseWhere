import type {Resource} from '../sim/types';

/** Runtime definition facts from the concrete inherited Core4871 XML rows in
 * all-plant-selection-flags.json: all32 local species and7 cultivated kinds.
 * Not World state, a migration or a capability. This covers the local plant
 * catalog, not every Core definition. The shared TreeBase family also supplies
 * neverMultiSelect for an untyped historical tree without inventing its def.
 */
export const CONFIRMED_PLANT_SELECTION_FLAGS_4871={
  grass:{def:'Plant_Grass',selectable:false,neverMultiSelect:true},
  'tall-grass':{def:'Plant_TallGrass',selectable:false,neverMultiSelect:true},
  brambles:{def:'Plant_Brambles',selectable:false,neverMultiSelect:true},
  moss:{def:'Plant_Moss',selectable:false,neverMultiSelect:true},
  astragalus:{def:'Plant_Astragalus',selectable:false,neverMultiSelect:true},
  chokevine:{def:'Plant_Chokevine',selectable:false,neverMultiSelect:true},
  dandelion:{def:'Plant_Dandelion',selectable:false,neverMultiSelect:true},
  'low-shrub':{def:'Plant_ShrubLow',selectable:false,neverMultiSelect:true},
  bush:{def:'Plant_Bush',selectable:true,neverMultiSelect:true},
  oak:{def:'Plant_TreeOak',selectable:true,neverMultiSelect:true},
  poplar:{def:'Plant_TreePoplar',selectable:true,neverMultiSelect:true},
  pine:{def:'Plant_TreePine',selectable:true,neverMultiSelect:true},
  birch:{def:'Plant_TreeBirch',selectable:true,neverMultiSelect:true},
  saguaro:{def:'Plant_SaguaroCactus',selectable:true,neverMultiSelect:true},
  drago:{def:'Plant_TreeDrago',selectable:true,neverMultiSelect:true},
  bamboo:{def:'Plant_TreeBamboo',selectable:true,neverMultiSelect:true},
  cecropia:{def:'Plant_TreeCecropia',selectable:true,neverMultiSelect:true},
  cypress:{def:'Plant_TreeCypress',selectable:true,neverMultiSelect:true},
  maple:{def:'Plant_TreeMaple',selectable:true,neverMultiSelect:true},
  palm:{def:'Plant_TreePalm',selectable:true,neverMultiSelect:true},
  teak:{def:'Plant_TreeTeak',selectable:true,neverMultiSelect:true},
  willow:{def:'Plant_TreeWillow',selectable:true,neverMultiSelect:true},
  alocasia:{def:'Plant_Alocasia',selectable:true,neverMultiSelect:true},
  clivia:{def:'Plant_Clivia',selectable:true,neverMultiSelect:true},
  rafflesia:{def:'Plant_Rafflesia',selectable:true,neverMultiSelect:true},
  'pincushion-cactus':{def:'Plant_PincushionCactus',selectable:true,neverMultiSelect:true},
  'berry-bush':{def:'Plant_Berry',selectable:true,neverMultiSelect:false},
  agave:{def:'Plant_Agave',selectable:true,neverMultiSelect:false},
  'healroot-wild':{def:'Plant_HealrootWild',selectable:true,neverMultiSelect:false},
  glowstool:{def:'Glowstool',selectable:true,neverMultiSelect:false},
  agarilux:{def:'Agarilux',selectable:true,neverMultiSelect:false},
  bryolux:{def:'Bryolux',selectable:true,neverMultiSelect:true},
  rice:{def:'Plant_Rice',selectable:true,neverMultiSelect:true},
  potato:{def:'Plant_Potato',selectable:true,neverMultiSelect:true},
  corn:{def:'Plant_Corn',selectable:true,neverMultiSelect:true},
  cotton:{def:'Plant_Cotton',selectable:true,neverMultiSelect:true},
  healroot:{def:'Plant_Healroot',selectable:true,neverMultiSelect:true},
  haygrass:{def:'Plant_Haygrass',selectable:true,neverMultiSelect:true},
  hops:{def:'Plant_Hops',selectable:true,neverMultiSelect:true},
} as const;

/** No concrete def, age or growth is invented for historical identities.
 * TreeBase and all13 concrete local trees agree on the family policy. A plain
 * wild-plant without species remains explicitly unresolved and keeps its old
 * behavior; that fallback is not a Core parity claim.
 */
export function resourceNeverMultiSelect4871(resource:Pick<Resource,'kind'|'species'>):boolean{
  if(resource.kind==='rock')return false;
  if(resource.kind==='tree'&&!resource.species)return true;
  const key=resource.species??(resource.kind==='berries'?'berry-bush':resource.kind);
  const flags=Object.hasOwn(CONFIRMED_PLANT_SELECTION_FLAGS_4871,key)?CONFIRMED_PLANT_SELECTION_FLAGS_4871[key as keyof typeof CONFIRMED_PLANT_SELECTION_FLAGS_4871]:undefined;
  return flags?.neverMultiSelect??false;
}
