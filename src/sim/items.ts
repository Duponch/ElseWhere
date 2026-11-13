import {PROSTHETIC_ITEM_DEFINITIONS_273} from './prosthetic-content-273.ts';
import { GARMENT_ITEM_DEFINITIONS312 } from './apparel-definitions.ts';
import {SPEAR_ITEM_DEFINITIONS_272} from './spear-content-272.ts';
import {LONGSWORD_ITEM_DEFINITIONS_270} from './longsword-content-270.ts';
import {MACE_ITEM_DEFINITIONS_269} from './mace-content-269.ts';
import {SMITHING_APPAREL_ITEM_DEFINITIONS267} from './smithing-apparel-267.ts';
import {CAVE_ITEM_DEFINITIONS_256} from './cave-products-256.ts';
import {eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import {ANIMAL_ITEM_DEFINITIONS_256} from './animal-items-v256.ts';
import type { MaterialKind, MaterialPile, Pawn, World } from './types.ts';
import { BIOME_ITEM_DEFINITIONS,isAnimalMeat } from './biome-items.ts';
import { TEXTILE_APPAREL_ITEM_DEFINITIONS308 } from './textile-apparel-308.ts';
import { ANIMAL_PRODUCT_ITEM_DEFINITIONS } from './animal-product-items.ts';

/** Prospective V219 carcasses; historical bills and filters do not adopt them. */
export const V219_ITEM_IDS=['lancer-corpse','pikeman-corpse'] as const;
export const MECH_CORPSE_ITEMS=['scyther-corpse',...V219_ITEM_IDS] as const;
export type MechCorpseItem=typeof MECH_CORPSE_ITEMS[number];

/** Runtime content, not an exhaustive reference catalogue. Values and unresolved
 * rules are tracked in docs/development/food-items.md. Nutrition uses integer
 * hundredths here; the actor's 0..100 meter represents one nutrition unit. */
export const ITEM_DEFINITIONS = Object.freeze({
  'ai-core':Object.freeze({label:'Cœur d’IA',kind:'ai-core',stackLimit:1,nutrition:0,maxIngest:0,color:0x8ba3a5}),
  novel:Object.freeze({label:'Roman',kind:'book',stackLimit:1,nutrition:0,maxIngest:0,color:0x7e9f8b}),
  ...PROSTHETIC_ITEM_DEFINITIONS_273,
  'unfinished-prosthetic':Object.freeze({label:'Prothèse inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x9da9a1}),
  ...SMITHING_APPAREL_ITEM_DEFINITIONS267,
  ...MACE_ITEM_DEFINITIONS_269,
  ...LONGSWORD_ITEM_DEFINITIONS_270,
  ...SPEAR_ITEM_DEFINITIONS_272,
  'unfinished-spear':Object.freeze({label:'Lance inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x87958f}),
  'unfinished-longsword':Object.freeze({label:'Épée longue inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x87958f}),
  'unfinished-mace':Object.freeze({label:'Masse inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x87958f}),
  'unfinished-knife':Object.freeze({label:'Couteau inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xa0b2b5}),
  'unfinished-plate-armor':Object.freeze({label:'Armure de plaques inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x87958f}),
  'unfinished-simple-helmet':Object.freeze({label:'Casque simple inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x87958f}),
  hops:Object.freeze({label:'Houblon',kind:'food',stackLimit:75,nutrition:5,maxIngest:75,color:0xaaa455}),
  wort:Object.freeze({label:'Moût',kind:'wort',stackLimit:25,nutrition:0,maxIngest:0,color:0xa17a38}),
  beer:Object.freeze({label:'Bière',kind:'beer',stackLimit:25,nutrition:8,maxIngest:1,color:0xa87c38}),
  'minified-tree':Object.freeze({label:'Arbre déraciné',kind:'plant',stackLimit:1,nutrition:0,maxIngest:0,color:0x729548}),
  hay:Object.freeze({label:'Foin',kind:'food',stackLimit:200,nutrition:5,maxIngest:200,color:0xc3aa59}),
  pemmican:Object.freeze({label:'Pemmican',kind:'food',stackLimit:75,nutrition:5,maxIngest:75,color:0xaf7958}),
  kibble:Object.freeze({label:'Croquettes',kind:'food',stackLimit:75,nutrition:5,maxIngest:75,color:0xa98355}),
  ...CAVE_ITEM_DEFINITIONS_256,
  ...ANIMAL_ITEM_DEFINITIONS_256,
  ...BIOME_ITEM_DEFINITIONS,
  ...TEXTILE_APPAREL_ITEM_DEFINITIONS308,
  ...GARMENT_ITEM_DEFINITIONS312,
  'unfinished-tshirt':Object.freeze({label:'T-shirt inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'unfinished-jacket':Object.freeze({label:'Blouson inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  ...ANIMAL_PRODUCT_ITEM_DEFINITIONS,
  'scyther-corpse':Object.freeze({label:'Carcasse de Scyther',kind:'mech-corpse',stackLimit:1,nutrition:0,maxIngest:0,color:0x93a4a5}),
  'lancer-corpse':Object.freeze({label:'Carcasse de Lancier',kind:'mech-corpse',stackLimit:1,nutrition:0,maxIngest:0,color:0xa49d88}),
  'pikeman-corpse':Object.freeze({label:'Carcasse de Piquier',kind:'mech-corpse',stackLimit:1,nutrition:0,maxIngest:0,color:0x8d9f9c}),
  'human-corpse':Object.freeze({label:'Dépouille humaine',kind:'corpse',stackLimit:1,nutrition:0,maxIngest:0,color:0x8f8775}),
  'hare-corpse':Object.freeze({label:'Dépouille de lièvre',kind:'corpse',stackLimit:1,nutrition:0,maxIngest:0,color:0x9b9981}),
  'hare-meat':Object.freeze({label:'Viande de lièvre',kind:'food',stackLimit:75,nutrition:5,maxIngest:75,color:0xba6259}),
  'light-leather':Object.freeze({label:'Cuir léger',kind:'textile',stackLimit:75,nutrition:0,maxIngest:0,color:0xad8a61}),
  'unfinished-sculpture':Object.freeze({label:'Sculpture inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xb59b76}),
  'unfinished-flak-vest':Object.freeze({label:'Gilet pare-balles inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x626d65}),
  'unfinished-flak-helmet':Object.freeze({label:'Casque pare-balles inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x626d65}),
  'unfinished-recon-armor':Object.freeze({label:'Combinaison de reconnaissance inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x879da4}),
  'unfinished-recon-helmet':Object.freeze({label:'Casque de reconnaissance inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x879da4}),
  'unfinished-gun':Object.freeze({label:'Arme à feu inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x798c90}),
  'unfinished-component':Object.freeze({label:'Composant inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0x9aa69e}),
  'unfinished-shirt':Object.freeze({label:'Chemise inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'unfinished-tribalwear':Object.freeze({label:'Tenue tribale inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'unfinished-pants':Object.freeze({label:'Pantalon inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'unfinished-duster':Object.freeze({label:'Cache-poussière inachevé',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'unfinished-tuque':Object.freeze({label:'Tuque inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'cloth-tuque':Object.freeze({label:'Tuque en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'muffalo-wool-tuque':Object.freeze({label:'Tuque en laine de mufalo',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xb3c0ba}),
  'unfinished-parka':Object.freeze({label:'Parka inachevée',kind:'unfinished',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'cloth-tribalwear':Object.freeze({label:'Tenue tribale en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  cloth: Object.freeze({label:'Tissu',kind:'textile',stackLimit:75,nutrition:0,maxIngest:0,color:0xe4ddc8}),
  'cloth-shirt':Object.freeze({label:'Chemise en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'light-leather-tribalwear':Object.freeze({label:'Tenue tribale en cuir léger',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xad8a61}),
  'light-leather-shirt':Object.freeze({label:'Chemise en cuir léger',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xad8a61}),
  'cloth-pants':Object.freeze({label:'Pantalon en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'light-leather-pants':Object.freeze({label:'Pantalon en cuir léger',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xad8a61}),
  'cloth-duster':Object.freeze({label:'Cache-poussière en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'light-leather-duster':Object.freeze({label:'Cache-poussière en cuir léger',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xad8a61}),
  'cloth-parka':Object.freeze({label:'Parka en tissu',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xd8c8a2}),
  'light-leather-parka':Object.freeze({label:'Parka en cuir léger',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xad8a61}),
  'flak-vest':Object.freeze({label:'Gilet pare-balles',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0x626d65}),
  'flak-pants':Object.freeze({label:'Pantalon pare-balles',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0x707070}),
  'plasteel-flak-helmet':Object.freeze({label:'Casque pare-balles en plastacier',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0xa0b2b5}),
  'flak-helmet':Object.freeze({label:'Casque pare-balles',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0x626d65}),
  'recon-armor':Object.freeze({label:'Combinaison de reconnaissance',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0x879da4}),
  'recon-helmet':Object.freeze({label:'Casque de reconnaissance',kind:'apparel',stackLimit:1,nutrition:0,maxIngest:0,color:0x879da4}),
  silver:Object.freeze({label:'Argent',kind:'silver',stackLimit:500,nutrition:0,maxIngest:0,color:0xc7c9cc}),
  'bolt-action-rifle':Object.freeze({label:'Fusil à verrou',kind:'weapon',stackLimit:1,nutrition:0,maxIngest:0,color:0x695342}),
  'emp-launcher':Object.freeze({label:'Lanceur EMP',kind:'weapon',stackLimit:1,nutrition:0,maxIngest:0,color:0x749da6}),
  'plasteel-knife':Object.freeze({label:'Couteau en plastacier',kind:'weapon',stackLimit:1,nutrition:0,maxIngest:0,color:0xa0b2b5}),
  revolver:Object.freeze({label:'Revolver',kind:'weapon',stackLimit:1,nutrition:0,maxIngest:0,color:0x606b72}),
  'herbal-medicine':Object.freeze({label:'Plantes médicinales',kind:'medicine',stackLimit:25,nutrition:0,maxIngest:0,color:0x7d985c}),
  medicine:Object.freeze({label:'Médicaments',kind:'medicine',stackLimit:25,nutrition:0,maxIngest:0,color:0x91c6cc}),
  chemfuel:Object.freeze({label:'Biocarburant',kind:'chemfuel',stackLimit:150,nutrition:0,maxIngest:0,color:0xd49e4a}),
  neutroamine:Object.freeze({label:'Neutroamine',kind:'neutroamine',stackLimit:150,nutrition:0,maxIngest:0,color:0xcbd5d3}),
  'glitterworld-medicine':Object.freeze({label:'Médicaments avancés',kind:'medicine',stackLimit:25,nutrition:0,maxIngest:0,color:0xbcdce6}),
  'granite-blocks': Object.freeze({label:'Blocs de granite',kind:'blocks',stackLimit:75,nutrition:0,maxIngest:0,color:0x99958d}),
  'limestone-blocks': Object.freeze({label:'Blocs de calcaire',kind:'blocks',stackLimit:75,nutrition:0,maxIngest:0,color:0xafad8b}),
  'marble-blocks': Object.freeze({label:'Blocs de marbre',kind:'blocks',stackLimit:75,nutrition:0,maxIngest:0,color:0xc5c4b5}),
  'sandstone-blocks': Object.freeze({label:'Blocs de grès',kind:'blocks',stackLimit:75,nutrition:0,maxIngest:0,color:0xb99d76}),
  'slate-blocks': Object.freeze({label:'Blocs de ardoise',kind:'blocks',stackLimit:75,nutrition:0,maxIngest:0,color:0x737f83}),
  component: Object.freeze({label:'Composants',kind:'component',stackLimit:50,nutrition:0,maxIngest:0,color:0xbe914c}),
  'advanced-component':Object.freeze({label:'Composants avancés',kind:'advanced-component',stackLimit:50,nutrition:0,maxIngest:0,color:0xb7c9c1}),
  steel: Object.freeze({label:'Acier',kind:'steel',stackLimit:75,nutrition:0,maxIngest:0,color:0x839399}),
  jade:Object.freeze({label:'Jade',kind:'jade',stackLimit:75,nutrition:0,maxIngest:0,color:0x79a996}),
  gold: Object.freeze({label:'Or',kind:'gold',stackLimit:500,nutrition:0,maxIngest:0,color:0xd8b85d}),
  uranium:Object.freeze({label:'Uranium',kind:'uranium',stackLimit:75,nutrition:0,maxIngest:0,color:0x777d73}),
  plasteel: Object.freeze({label:'Plastacier',kind:'plasteel',stackLimit:75,nutrition:0,maxIngest:0,color:0x93b8bd}),
  'granite-chunk': Object.freeze({label:'Fragment de granite',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0x99958d}),
  'limestone-chunk': Object.freeze({label:'Fragment de calcaire',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0xafad8b}),
  'slag-steel-chunk':Object.freeze({label:'Scorie d’acier',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0x718582}),
  'marble-chunk': Object.freeze({label:'Fragment de marbre',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0xc5c4b5}),
  'sandstone-chunk': Object.freeze({label:'Fragment de grès',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0xb99d76}),
  'slate-chunk': Object.freeze({label:'Fragment d’ardoise',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0x737f83}),
  'legacy-chunk': Object.freeze({label:'Fragment historique non typé',kind:'chunk',stackLimit:1,nutrition:0,maxIngest:0,color:0x899182}),
  wood: Object.freeze({ label: 'Bois', kind: 'wood', stackLimit: 75, nutrition: 0, maxIngest: 0, color: 0x896841 }),
  berries: Object.freeze({ label: 'Baies', kind: 'food', stackLimit: 75, nutrition: 5, maxIngest: 75, color: 0xb96f63 }),
  milk: Object.freeze({ label: 'Lait', kind: 'food', stackLimit: 75, nutrition: 5, maxIngest: 75, color: 0xf1ead7 }),
  rice: Object.freeze({ label: 'Riz', kind: 'food', stackLimit: 75, nutrition: 5, maxIngest: 75, color: 0xd9c695 }),
  potato: Object.freeze({ label: 'Pommes de terre', kind: 'food', stackLimit: 75, nutrition: 5, maxIngest: 75, color: 0xb89b70 }),
  corn: Object.freeze({ label: 'Maïs', kind: 'food', stackLimit: 75, nutrition: 5, maxIngest: 75, color: 0xe0be56 }),
  'nutrient-paste-meal': Object.freeze({ label: 'Repas de pâte nutritive', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0x9da25d }),
  'simple-meal': Object.freeze({ label: 'Repas simple', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0xe4b274 }),
  'fine-meal': Object.freeze({ label: 'Plat raffiné', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0xd9a686 }),
  'vegetarian-fine-meal': Object.freeze({ label: 'Plat végétarien raffiné', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0xd7c892 }),
  'carnivore-fine-meal': Object.freeze({ label: 'Plat carnivore raffiné', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0xca9b8b }),
  'lavish-meal': Object.freeze({ label: 'Plat gastronomique', kind: 'food', stackLimit: 10, nutrition: 100, maxIngest: 1, color: 0xe2be8f }),
  'vegetarian-lavish-meal': Object.freeze({ label: 'Plat végétarien gastronomique', kind: 'food', stackLimit: 10, nutrition: 100, maxIngest: 1, color: 0xdacb9a }),
  'carnivore-lavish-meal': Object.freeze({ label: 'Plat carnivore gastronomique', kind: 'food', stackLimit: 10, nutrition: 100, maxIngest: 1, color: 0xd09b91 }),
  'survival-meal': Object.freeze({ label: 'Repas de survie', kind: 'food', stackLimit: 10, nutrition: 90, maxIngest: 1, color: 0xc7b96b }),
  'legacy-portion': Object.freeze({ label: 'Portion historique', kind: 'food', stackLimit: 75, nutrition: 35, maxIngest: 1, color: 0xba745a }),
} as const);
export type ItemId = keyof typeof ITEM_DEFINITIONS;
/** These raw foods cause the shared raw-meal thought, independently of policy. */
export const rawFoodThought = (item: ItemId): boolean => item === 'rice' || item === 'potato' || item === 'corn' || item === 'agave-fruit' || item === 'raw-fungus' || isAnimalMeat(item)||!!eggSpeciesForItem256(item);
export const legacyItem = (kind: MaterialKind): ItemId => kind==='ai-core'?'ai-core':kind==='book'?missingEquipmentType():kind==='wort'?'wort':kind==='beer'?'beer':kind==='chemfuel'?'chemfuel':kind==='neutroamine'?'neutroamine':kind==='silver'?'silver':kind==='uranium'?'uranium':kind==='corpse'||kind==='mech-corpse'?missingEquipmentType():kind==='prosthesis'?missingEquipmentType():kind==='unfinished'?missingEquipmentType():kind==='textile'?'cloth':kind==='apparel'||kind==='weapon'?missingEquipmentType():kind==='medicine'?missingMedicineType():kind==='component'?'component':kind==='advanced-component'?'advanced-component':kind==='jade'?'jade':kind==='gold'?'gold':kind==='plasteel'?'plasteel':kind==='blocks'?missingBlockType(): kind === 'steel' ? 'steel' : kind === 'wood' ? 'wood' : kind === 'chunk' ? 'legacy-chunk' : 'legacy-portion';
export const nutritionOf = (pile: MaterialPile): number => ITEM_DEFINITIONS[pile.item].nutrition * pile.quantity;
export function availableNutrition(world: World): number {
    return world.piles.reduce((sum, pile) => sum + (pile.item==='hay'||pile.item==='hops'||pile.item==='beer'||pile.owner.type === 'job'||pile.owner.type==='inventory'||pile.owner.type==='pawn'&&!world.pawns.some(p=>p.id===('pawnId' in pile.owner?pile.owner.pawnId:-1)&&(p.faction??'colony')==='colony') ? 0 : nutritionOf(pile)), 0) / 100;
}
/** Unity's midpoint-to-even rounding, used by the reference stack calculation. */
function roundEven(value: number): number {
  const lower = Math.floor(value), fraction = value - lower;
  return fraction === 0.5 ? lower + lower % 2 : Math.round(value);
}
export function mealQuantity(pawn: Pawn, pile: MaterialPile, available: number): number {
  const item = ITEM_DEFINITIONS[pile.item];
  if (pile.item==='hay' || pile.item==='hops'||pile.item==='beer'||!item.nutrition || available <= 0) return 0;
  return Math.min(available, item.maxIngest, Math.max(1, roundEven((100 - pawn.hunger) / item.nutrition)));
}

export function adultHungerFactor(level: number): number {
  return level <= 0 ? 0 : level < 12 ? 0.25 : level < 24 ? 0.5 : 1;
}

function missingBlockType():never {throw new Error('Stone blocks require an explicit ItemId.');}

function missingMedicineType():never {throw new Error('Medicine requires an explicit ItemId.');}

function missingEquipmentType():never {throw new Error('Equipment producers require an explicit item.');}
