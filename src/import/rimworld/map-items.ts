/** Item family (stacks on the ground, in shelves and in inventories), the
 * stuff (material) family and apparel/weapons with their stuff and quality. */
import {exact,adapt,drop,STONES,stoneId,type DefMapping} from './mapping.ts';
import type {ItemId} from '../../sim/items.ts';
import type {ApparelMaterial,ApparelItem,ApparelFamily} from '../../sim/apparel-definitions.ts';
import type {ConstructionMaterial} from '../../sim/building-materials.ts';
import type {WeaponItem,WeaponQuality} from '../../sim/equipment-rules.ts';
import type {FilthKind} from '../../sim/filth-rules.ts';
import type {GapOrigin} from './gap-origin.ts';

type Item=DefMapping<ItemId>;
const i=(id:ItemId):Item=>exact(id);
const ia=(id:ItemId,why:string):Item=>adapt(id,why);
const ix=(why:string):Item=>drop(why);
const items:Record<string,Item>={
 WoodLog:i('wood'),Steel:i('steel'),Plasteel:i('plasteel'),Uranium:i('uranium'),Jade:i('jade'),Gold:i('gold'),Silver:i('silver'),
 ComponentIndustrial:i('component'),ComponentSpacer:i('advanced-component'),Chemfuel:i('chemfuel'),Neutroamine:i('neutroamine'),
 Penoxycyline:i('penoxycyline'),MedicineHerbal:i('herbal-medicine'),MedicineIndustrial:i('medicine'),MedicineUltratech:i('glitterworld-medicine'),
 Shell_HighExplosive:i('shell-high-explosive'),Shell_Incendiary:i('shell-incendiary'),AIPersonaCore:i('ai-core'),Wort:i('wort'),Beer:i('beer'),
 SimpleProstheticLeg:i('prosthetic-leg'),SimpleProstheticArm:i('prosthetic-arm'),
 Cloth:i('cloth'),DevilstrandCloth:i('devilstrand'),Leather_Plain:i('plainleather'),Leather_Light:i('light-leather'),Leather_Dog:i('dog-leather'),
 Leather_Bear:i('bear-leather'),Leather_Bird:i('bird-leather'),Leather_Chinchilla:i('chinchilla-fur'),Leather_Elephant:i('elephant-leather'),
 Leather_GuineaPig:i('guinea-pig-fur'),Leather_Heavy:i('heavy-fur'),Leather_Lizard:i('lizard-leather'),Leather_Panthera:i('panthera-fur'),
 Leather_Pig:i('pig-leather'),Leather_Rhinoceros:i('rhinoceros-leather'),Leather_Wolf:i('wolf-leather'),Leather_Fox:i('foxfur'),
 Leather_Bluefur:i('bluefur'),Leather_Camel:i('camelhide'),WoolMuffalo:i('muffalo-wool'),WoolAlpaca:i('alpaca-wool'),WoolBison:i('bison-wool'),
 WoolMegasloth:i('megasloth-wool'),
 WoolSheep:ia('muffalo-wool','Laine de mouton : devient de la laine de muffalo.'),Synthread:ia('cloth','Synthétique : devient du tissu.'),
 Hyperweave:ia('devilstrand','Hypertissu : devient de la soie du diable.'),Leather_Thrumbo:ia('heavy-fur','Cuir de thrumbo : devient de la fourrure épaisse.'),
 Leather_Patch:ia('plainleather','Cuir rapiécé : devient du cuir ordinaire.'),Leather_Human:ix('Cuir humain : absent.'),
 MealNutrientPaste:i('nutrient-paste-meal'),MealSimple:i('simple-meal'),MealFine:i('fine-meal'),MealFine_Veg:i('vegetarian-fine-meal'),
 MealFine_Meat:i('carnivore-fine-meal'),MealLavish:i('lavish-meal'),MealLavish_Veg:i('vegetarian-lavish-meal'),MealLavish_Meat:i('carnivore-lavish-meal'),
 MealSurvivalPack:i('survival-meal'),Hay:i('hay'),RawBerries:i('berries'),RawRice:i('rice'),RawPotatoes:i('potato'),RawCorn:i('corn'),RawAgave:i('agave-fruit'),
 RawFungus:i('raw-fungus'),RawHops:i('hops'),Milk:i('milk'),InsectJelly:i('insect-jelly'),Pemmican:i('pemmican'),Kibble:i('kibble'),
 Chocolate:ix('Chocolat : absent.'),Ambrosia:ix('Ambroisie : absente.'),Dye:ix('Teinture : absente.'),ReinforcedBarrel:ix('Canon renforcé : absent.'),
 ThrumboHorn:ix('Corne de thrumbo : absente.'),ElephantTusk:ix('Défense d’éléphant : absente.'),InsectJellyBottle:ix('Absent.'),
 Novel:i('novel'),TextBook:ix('Manuel d’apprentissage : absent.'),Textbook:ix('Manuel d’apprentissage : absent.'),Schematic:ix('Schéma : absent.'),
 PsychicAnimalPulser:ix('Pulser animal : artefact d’incident absent.'),PsychicSoothePulser:ix('Pulser d’apaisement : artefact d’incident absent.'),
 MechSerumHealer:ix('Sérum de guérison : absent.'),MechSerumResurrector:ix('Sérum de résurrection : absent.'),
 TechprofSubpersonaCore:ix('Noyau de savoir : artefact de recherche instantanée absent.'),
 ActiveDropPodMechanoid:ix('Capsule mécanoïde active : propriétaire de livraison non représenté.'),
 Skull:ix('Crâne humain conservé : objet absent.'),TornadoGenerator:ix('Générateur de tornade : absent.'),
 OrbitalTargeterBombardment:ix('Artefact de ciblage orbital : absent.'),OrbitalTargeterPowerBeam:ix('Artefact de ciblage orbital : absent.'),
 ArchotechArm:ix('Bras archotech : absent.'),ArchotechEye:ix('Œil archotech : absent.'),ArchotechLeg:ix('Jambe archotech : absente.'),
 BionicJaw:ix('Mâchoire bionique : absente.'),BionicTongue:ix('Langue bionique : absente.'),DeathAcidifier:ix('Implant de désintégration à la mort : absent.'),
 SimpleProstheticHeart:ix('Cœur prothétique : absent.'),Heart:ix('Organe prélevé : absent.'),Kidney:ix('Organe prélevé : absent.'),Liver:ix('Organe prélevé : absent.'),Lung:ix('Organe prélevé : absent.'),
 Luciferium:ix('Lucifèrium : drogue absente.'),Flake:ix('Flake : drogue absente.'),Yayo:ix('Yayo : drogue absente.'),GoJuice:ix('Go-juice : drogue absente.'),
 WakeUp:ix('Wake-up : drogue absente.'),PsychiteTea:ix('Thé de psychite : drogue absente.'),SmokeleafJoint:ix('Joint : drogue absente.'),
 SmokeleafLeaves:ix('Feuilles à fumer : absentes.'),PsychoidLeaves:ix('Feuilles de psychoïde : absentes.'),
 Joywire:ix('Fil de joie : implant absent.'),Painstopper:ix('Inhibiteur de douleur : implant absent.'),
 BionicLeg:ix('Jambe bionique : prothèse absente.'),BionicArm:ix('Bras bionique : prothèse absente.'),BionicEye:ix('Œil bionique : prothèse absente.'),
 BionicHeart:ix('Cœur bionique : prothèse absente.'),BionicSpine:ix('Colonne bionique : prothèse absente.'),BionicStomach:ix('Estomac bionique : prothèse absente.'),
 BionicEar:ix('Oreille bionique : prothèse absente.'),CochlearImplant:ix('Implant cochléaire : absent.'),PowerClaw:ix('Griffe : absente.'),
 Shell_Firefoam:ix('Obus à mousse : absent.'),Shell_EMP:ix('Obus IEM : absent.'),Shell_Smoke:ix('Obus fumigène : absent.'),Shell_AntigrainWarhead:ix('Ogive antigrain : absente.'),
 MinifiedThing:ix('Meuble emballé : type intérieur à résoudre pendant la conversion.'),MinifiedTree:i('minified-tree'),UnfinishedApparel:ix('Ouvrage inachevé : type et travail à résoudre pendant la conversion.'),
 UnfinishedSculpture:ix('Ouvrage inachevé : non importé.'),UnfinishedWeapon:ix('Ouvrage inachevé : non importé.'),UnfinishedGun:ix('Ouvrage inachevé : non importé.'),
 UnfinishedComponent:ix('Ouvrage inachevé : non importé.'),UnfinishedTechArmor:ix('Ouvrage inachevé : non importé.'),UnfinishedMetallicTechArmor:ix('Ouvrage inachevé : non importé.'),
 UnfinishedArmor:ix('Ouvrage inachevé : type et travail à résoudre pendant la conversion.'),
 UnfinishedHealthItemProsthetic:ix('Ouvrage inachevé : non importé.'),Silver_Stack:ix('Absent.'),
};
for(const skill of ['Animals','Artistic','Construction','Cooking','Crafting','Intellectual','Medicine','Melee','Mining','Plants','Shooting','Social'])
 items['Neurotrainer_'+skill]=ix('Neuroformateur : artefact d’apprentissage absent.');
for(const stone of STONES){items[`Blocks${stone}`]=i(`${stoneId(stone)}-blocks` as ItemId);items[`Chunk${stone}`]=i(`${stoneId(stone)}-chunk` as ItemId);}
items.ChunkSlagSteel=i('slag-steel-chunk');items.ChunkMechanoidSlag=ia('slag-steel-chunk','Scories mécanoïdes : deviennent des scories d’acier.');
// Meat (the game shares some meats between related animals).
const meats:Record<string,ItemId>={Hare:'hare-meat',Deer:'deer-meat',Muffalo:'muffalo-meat',Gazelle:'gazelle-meat',Dromedary:'dromedary-meat',
 Megaspider:'megaspider-meat',Cat:'cat-meat',YorkshireTerrier:'yorkshire-terrier-meat',LabradorRetriever:'labrador-retriever-meat',Husky:'husky-meat',
 Alpaca:'alpaca-meat',Bear_Grizzly:'grizzly-bear-meat',Bison:'bison-meat',Boomalope:'boomalope-meat',Boomrat:'boomrat-meat',Capybara:'capybara-meat',
 Caribou:'caribou-meat',Cassowary:'cassowary-meat',Chinchilla:'chinchilla-meat',Cobra:'cobra-meat',Cougar:'cougar-meat',Donkey:'donkey-meat',Duck:'duck-meat',
 Elephant:'elephant-meat',Elk:'elk-meat',Fox_Fennec:'fennec-fox-meat',GuineaPig:'guinea-pig-meat',Horse:'horse-meat',Ibex:'ibex-meat',Iguana:'iguana-meat',
 Lynx:'lynx-meat',Megasloth:'megasloth-meat',Monkey:'monkey-meat',Panther:'panther-meat',Raccoon:'raccoon-meat',Rat:'rat-meat',Rhinoceros:'rhinoceros-meat',
 Squirrel:'squirrel-meat',Tortoise:'tortoise-meat',Turkey:'turkey-meat',Warg:'warg-meat',Pig:'pig-meat',Wolf_Timber:'timber-wolf-meat',Yak:'yak-meat'} as Record<string,ItemId>;
for(const [race,id] of Object.entries(meats))items[`Meat_${race}`]=i(id);
for(const [race,id,label] of [['Goat','ibex-meat','bouquetin'],['Sheep','alpaca-meat','alpaga'],['Cow','yak-meat','yak'],['Chicken','turkey-meat','dinde'],['Goose','duck-meat','canard']] as const)
 items[`Meat_${race}`]=ia(id,`Viande de cet animal : devient de la viande de ${label}, comme l’animal lui-même.`);
for(const race of ['Thrumbo','Alphabeaver','Human'])items[`Meat_${race}`]=ix(`Viande (${race}) : absente d’Elsewhere.`);
for(const bird of ['Cassowary','Cobra','Duck','Emu','Iguana','Ostrich','Tortoise','Turkey']){
 const id=bird.toLowerCase();
 items[`Egg${bird}Unfertilized`]=i(`${id}-egg-unfertilized` as ItemId);
 items[`Egg${bird}Fertilized`]=i(`${id}-egg-fertilized` as ItemId);
}
for(const bird of ['Chicken','Goose'])for(const f of ['Fertilized','Unfertilized'])items[`Egg${bird}${f}`]=ix('Œuf de cet oiseau : absent.');
export const ITEM_MAP:Readonly<Record<string,DefMapping<ItemId>>>=items;
/** The explicit source definitions of actual floor traces. Animal filth
 * remains a distinct missing Core type, not a replacement by common dirt. */
export const FILTH_MAP:Readonly<Record<string,FilthKind>>=Object.freeze({
 Filth_Dirt:'dirt',Filth_Trash:'trash',Filth_Blood:'blood',Filth_Ash:'ash',Filth_Vomit:'vomit',Filth_CorpseBile:'corpse-bile',
 Filth_RubbleRock:'rock-rubble',Filth_RubbleBuilding:'building-rubble',Filth_Slime:'slime',Filth_FireFoam:'firefoam',
});
/** Explicit, reviewed item gaps: distinguish absent catalogue entries from
 * the dedicated state/owner paths and unfamiliar historical aliases. */
export function knownItemGapOrigin(def:string):GapOrigin|undefined {
 const mapping=Object.hasOwn(ITEM_MAP,def)?ITEM_MAP[def]:undefined;
 if(!mapping)return undefined;
 if(def.startsWith('Unfinished')||def==='MinifiedThing')return 'importer';
 if(def==='Silver_Stack'||def==='InsectJellyBottle')return 'unresolved';
 return isDroppedMapping(mapping)||'adapt' in mapping&&mapping.adapt?'model':undefined;
}
const isDroppedMapping=(m:DefMapping<ItemId>)=>'drop' in m;

/** Stuff: what a material becomes for buildings, clothes and metal weapons. */
export interface StuffSpec {readonly construction?:ConstructionMaterial;readonly apparel?:ApparelMaterial;readonly metal?:'wood'|'steel'|'plasteel'|'uranium'|'silver'|'gold'}
const stuff:Record<string,DefMapping<StuffSpec>>={
 WoodLog:exact({construction:'wood',metal:'wood'}),Steel:exact({construction:'steel',metal:'steel'}),Jade:exact({construction:'jade'}),
 Plasteel:adapt({construction:'steel',metal:'plasteel'},'Plastacier : les bâtiments en plastacier deviennent en acier.'),
 Gold:adapt({construction:'steel',metal:'gold'},'Or : les bâtiments en or deviennent en acier.'),Silver:adapt({construction:'steel',metal:'silver'},'Argent : les bâtiments en argent deviennent en acier.'),
 Uranium:adapt({construction:'steel',metal:'uranium'},'Uranium : les bâtiments en uranium deviennent en acier.'),
 Cloth:exact({construction:'cloth',apparel:'cloth'}),DevilstrandCloth:exact({construction:'devilstrand',apparel:'devilstrand'}),
 Synthread:adapt({construction:'cloth',apparel:'cloth'},'Synthétique : devient du tissu.'),Hyperweave:adapt({construction:'devilstrand',apparel:'devilstrand'},'Hypertissu : devient de la soie du diable.'),
 WoolSheep:adapt({construction:'muffalo-wool',apparel:'muffalo-wool'},'Laine de mouton : devient de la laine de muffalo.'),
 Leather_Thrumbo:adapt({construction:'heavy-fur',apparel:'heavy-fur'},'Cuir de thrumbo : devient de la fourrure épaisse.'),
 Leather_Patch:adapt({construction:'plainleather',apparel:'plainleather'},'Cuir rapiécé : devient du cuir ordinaire.'),
 Leather_Human:adapt({construction:'plainleather',apparel:'plainleather'},'Cuir humain : devient du cuir ordinaire.'),
};
const textiles:Record<string,ApparelMaterial>={Leather_Plain:'plainleather',Leather_Light:'light-leather',Leather_Dog:'dog-leather',Leather_Bear:'bear-leather',
 Leather_Bird:'bird-leather',Leather_Chinchilla:'chinchilla-fur',Leather_Elephant:'elephant-leather',Leather_GuineaPig:'guinea-pig-fur',Leather_Heavy:'heavy-fur',
 Leather_Lizard:'lizard-leather',Leather_Panthera:'panthera-fur',Leather_Pig:'pig-leather',Leather_Rhinoceros:'rhinoceros-leather',Leather_Wolf:'wolf-leather',
 Leather_Fox:'foxfur',Leather_Bluefur:'bluefur',Leather_Camel:'camelhide',WoolMuffalo:'muffalo-wool',WoolAlpaca:'alpaca-wool',WoolBison:'bison-wool',WoolMegasloth:'megasloth-wool'};
for(const [def,m] of Object.entries(textiles))stuff[def]=exact({construction:m as ConstructionMaterial,apparel:m});
for(const s of STONES)stuff[`Blocks${s}`]=exact({construction:`${stoneId(s)}-blocks` as ConstructionMaterial});
export const STUFF_MAP:Readonly<Record<string,DefMapping<StuffSpec>>>=stuff;

/** Apparel: a family made of a material, or a fixed item. */
export type ApparelSpec={readonly family:ApparelFamily}|{readonly armor:'plate-armor'|'simple-helmet'}|{readonly item:ApparelItem};
const ap=(family:ApparelFamily)=>exact<ApparelSpec>({family});
export const APPAREL_MAP:Readonly<Record<string,DefMapping<ApparelSpec>>>={
 Apparel_BasicShirt:ap('tshirt'),Apparel_CollarShirt:ap('shirt'),Apparel_Pants:ap('pants'),Apparel_Duster:ap('duster'),Apparel_Parka:ap('parka'),
 Apparel_Jacket:ap('jacket'),Apparel_CowboyHat:ap('cowboy-hat'),Apparel_BowlerHat:ap('bowler-hat'),Apparel_Tuque:ap('tuque'),Apparel_TribalA:ap('tribalwear'),
 Apparel_PlateArmor:exact({armor:'plate-armor'}),Apparel_SimpleHelmet:exact({armor:'simple-helmet'}),
 Apparel_FlakVest:exact({item:'flak-vest'}),Apparel_FlakPants:exact({item:'flak-pants'}),Apparel_AdvancedHelmet:exact({item:'flak-helmet'}),
 Apparel_ArmorRecon:exact({item:'recon-armor'}),Apparel_ArmorHelmetRecon:exact({item:'recon-helmet'}),
 Apparel_FlakJacket:adapt({item:'flak-vest'},'Veste pare-éclats : devient un gilet pare-éclats.'),
 Apparel_Robe:drop('Robe : absente.'),Apparel_Cape:drop('Cape : absente.'),Apparel_TribalHeaddress:drop('Coiffe tribale : absente.'),
 Apparel_FirefoampopPack:drop('Sac de mousse anti-incendie : absent.'),Apparel_PsychicInsanityLance:drop('Artefact psychique : absent.'),Apparel_PsychicShockLance:drop('Artefact psychique : absent.'),
 Apparel_ShieldBelt:drop('Ceinture bouclier : absente.'),Apparel_SmokepopBelt:drop('Ceinture fumigène : absente.'),Apparel_ClothMask:drop('Masque de tissu : absent.'),
 Apparel_WarVeil:drop('Voile de guerre : absent.'),Apparel_WarMask:drop('Masque de guerre : absent.'),Apparel_Gunlink:drop('Gunlink : absent.'),
 Apparel_PowerArmor:drop('Armure assistée : absente.'),Apparel_PowerArmorHelmet:drop('Casque d’armure assistée : absent.'),Apparel_HatHood:drop('Capuche : absente.'),
 Apparel_PsychicFoilHelmet:drop('Casque anti-psychique : absent.'),Apparel_ArmorMarineGrenadier:drop('Armure de grenadier : absente.'),
};
/** Weapons: a fixed item or a metal family. */
export type WeaponSpec={readonly item:WeaponItem}|{readonly family:'mace'|'longsword'|'spear'};
export const WEAPON_MAP:Readonly<Record<string,DefMapping<WeaponSpec>>>={
 Gun_Revolver:exact({item:'revolver'}),Gun_BoltActionRifle:exact({item:'bolt-action-rifle'}),Gun_PumpShotgun:exact({item:'pump-shotgun'}),
 Gun_Autopistol:exact({item:'autopistol'}),Gun_MachinePistol:exact({item:'machine-pistol'}),Gun_ChainShotgun:exact({item:'chain-shotgun'}),
 Gun_HeavySMG:exact({item:'heavy-smg'}),Gun_LMG:exact({item:'lmg'}),Gun_AssaultRifle:exact({item:'assault-rifle'}),Gun_SniperRifle:exact({item:'sniper-rifle'}),
 Gun_EmpLauncher:exact({item:'emp-launcher'}),Bow_Short:exact({item:'short-bow'}),Bow_Recurve:exact({item:'recurve-bow'}),Bow_Great:exact({item:'greatbow'}),
 MeleeWeapon_Mace:exact({family:'mace'}),MeleeWeapon_LongSword:exact({family:'longsword'}),MeleeWeapon_Spear:exact({family:'spear'}),
 MeleeWeapon_Knife:adapt({item:'plasteel-knife'},'Couteau : devient le couteau en plastacier (seul couteau d’Elsewhere).'),
 MeleeWeapon_Club:adapt({family:'mace'},'Massue : devient une masse.'),MeleeWeapon_Ikwa:adapt({family:'spear'},'Ikwa : devient une lance.'),
 MeleeWeapon_Gladius:adapt({family:'longsword'},'Glaive : devient une épée longue.'),MeleeWeapon_Axe:adapt({family:'mace'},'Hache : devient une masse.'),
 MeleeWeapon_BreachAxe:drop('Hache de brèche spécifique : absente.'),Pila:drop('Javelot de lancer : absent.'),
 MeleeWeapon_Warhammer:adapt({family:'mace'},'Marteau de guerre : devient une masse.'),MeleeWeapon_Breadsword:adapt({family:'longsword'},'Épée : devient une épée longue.'),
 Gun_ChargeLance:drop('Lance à charge : arme absente.'),Gun_ChargeRifle:drop('Fusil à charge : arme absente.'),Gun_InfernoCannon:drop('Canon inferno : arme absente.'),
 Gun_Minigun:drop('Minigun : arme absente.'),Gun_IncendiaryLauncher:drop('Lance-flammes incendiaire : arme absente.'),Gun_SmokeLauncher:drop('Lance-fumigènes : absent.'),
 Gun_ChargeBlasterHeavy:drop('Arme mécanique lourde à charge : absente du catalogue portable.'),Gun_Needle:drop('Arme mécanique à aiguilles : absente du catalogue portable.'),
 Gun_RocketswarmLauncher:drop('Arme de tourelle lance-roquettes multiples : absente du catalogue portable.'),
 Gun_AutocannonTurret:drop('Arme de tourelle : propriétaire spécialisé absent.'),Gun_ChargeBlasterHeavyTurret:drop('Arme de tourelle : propriétaire spécialisé absent.'),
 Gun_InfernoCannonTurret:drop('Arme de tourelle : propriétaire spécialisé absent.'),Gun_MiniTurret:drop('Arme interne de mini-tourelle : propriétaire spécialisé, pas d’arme portable.'),Gun_MiniTurretMech:drop('Arme interne de mécanoïde : propriétaire spécialisé, pas d’arme portable.'),Gun_TurretFoam:drop('Arme interne de tourelle : propriétaire spécialisé absent.'),Gun_TurretSniper:drop('Arme interne de tourelle : propriétaire spécialisé absent.'),
 Gun_DoomsdayRocket:drop('Lance-roquettes : absent.'),Gun_TripleRocket:drop('Lance-roquettes : absent.'),Weapon_GrenadeFrag:drop('Grenades : absentes.'),
 Weapon_GrenadeMolotov:drop('Cocktails Molotov : absents.'),Weapon_GrenadeEMP:drop('Grenades IEM : absentes.'),Gun_ThumpCannon:drop('Canon : absent.'),
 MeleeWeapon_PlasmaSword:drop('Épée à plasma : absente.'),MeleeWeapon_MonoSword:drop('Monosabre : absent.'),MeleeWeapon_Zeushammer:drop('Marteau de Zeus : absent.'),
 MeleeWeapon_PsyfocusStaff:drop('Bâton : absent.'),Gun_Mortar:drop('Absent.'),
};
export const QUALITY_MAP:Readonly<Record<string,WeaponQuality>>={Awful:'awful',Poor:'poor',Normal:'normal',Good:'good',Excellent:'excellent',Masterwork:'masterwork',Legendary:'legendary'};
