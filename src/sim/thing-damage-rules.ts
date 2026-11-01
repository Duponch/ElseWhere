import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {AI_CORE_CONTENT_298} from './ai-core-content-298.ts';
import {NOVEL_MAX_HIT_POINTS_295} from './book-state-295.ts';
import {SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {SHIP_BEAM_CONTENT_276,SHIP_ENGINE_CONTENT_276} from './ship-part-content-276.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {isLongswordItem270,longswordMaterial270,LONGSWORD_DEFINITIONS_270} from './longsword-content-270.ts';
import {isSpearItem272,spearMaterial272,SPEAR_DEFINITIONS_272} from './spear-content-272.ts';
import {isAncientMonumentKind256,ancientMonumentMaterial256,ancientMonumentMaxHp256,ancientNeutralMaxHp256,ANCIENT_MONUMENT_DEFS_256} from './ancient-monument-props-256.ts';
import {isHabitatFurnitureKind,FURNITURE_DEFINITIONS} from './furniture-stats.ts';
import {ANIMAL_ITEM_HP_256,ANIMAL_ITEM_FLAMMABILITY_256,isAnimalItem256} from './animal-items-v256.ts';
import {BEDROLL_TEXTILES_256,isBedrollTextile256} from './bedroll-textiles-256.ts';
import { APPAREL } from './apparel-rules.ts';
import {isSmithingApparel267,smithingApparelStuff267,ARMOR_STUFF_DEFINITIONS267} from './smithing-apparel-267.ts';
import { weaponMaxHitPoints } from './equipment-rules.ts';
import type { ItemId } from './items.ts';
import type { MaterialPile,Resource,Structure } from './types.ts';
import { floraDefinition } from './biome-flora.ts';

/** Only shipped definitions. Missing/non-HP things are deliberately not fuels. */
const BUILDINGS:Readonly<Record<string,readonly [number,number,boolean]>>={
  'firefoam-popper':[50,1,false],
  'ship-cryptosleep-casket':[SHIP_CASKET_CONTENT_277.maxHitPoints,SHIP_CASKET_CONTENT_277.flammability,SHIP_CASKET_CONTENT_277.leavesResourcesWhenKilled],
  'ship-beam':[SHIP_BEAM_CONTENT_276.maxHitPoints,SHIP_BEAM_CONTENT_276.flammability,SHIP_BEAM_CONTENT_276.leavesResourcesWhenKilled],
  'ship-engine':[SHIP_ENGINE_CONTENT_276.maxHitPoints,SHIP_ENGINE_CONTENT_276.flammability,SHIP_ENGINE_CONTENT_276.leavesResourcesWhenKilled],
  'ship-reactor':[500,0,true],
  'ship-computer':[150,0,true],'ship-sensors':[100,0,true],
  'fueled-smithy':[180,1,true],'electric-smithy':[180,1,true],
  brewery:[180,1,true],'fermenting-barrel':[100,1,true],
  'insect-hive':[130,1,false],'glow-pod':[50,1,false],
  'ship-chunk':[300,0,false],
  'ancient-cryptosleep-casket':[250,1,false],
  'cryptosleep-casket':[250,.5,false],
  shelf:[100,1,true],'small-shelf':[50,1,true],
  'spike-trap':[40,1,true],
  'electric-crematorium':[300,1,true],
  bedroll:[75,1,true],
  'double-bed':[200,1,true],
  'electric-smelter':[180,1,true],
  'biofuel-refinery':[200,1,true],
  'chemfuel-generator':[300,1,true],
  'geothermal-generator':[500,.5,true],
  'nutrient-paste-dispenser':[350,.5,true],
  hopper:[100,.5,true],
  'orbital-beacon':[75,.5,false],
  'comms-console':[250,.6,true],
  'deep-drill':[300,.5,true],
  'ground-scanner':[200,.5,false],
  'vitals-monitor':[100,.7,true],
  'drug-lab':[120,1,true],
  'hydroponics-basin':[180,.5,true],
  'mini-turret':[100,.7,true],
  'ancient-road-barrier':[500,0,true],'ancient-road-lamp':[300,0,true],
  'tube-television':[100,1,true],sandbags:[300,0,true],fence:[100,1,false],'fence-gate':[120,1,false],'pen-marker':[80,1,false],wall:[300,1,false],door:[160,1,false],autodoor:[160,1,false],bed:[140,1,true],'hospital-bed':[150,1,true],table:[75,1,true],stool:[75,1,true],horseshoes:[75,1,true],'chess-table':[100,1,true],
  'torch-lamp':[75,0,false],campfire:[80,0,false],'passive-cooler':[80,1,false],stonecutter:[180,1,true],'butcher-table':[180,1,true],
  'fueled-stove':[180,1,true],'electric-stove':[180,1,true],'tailor-bench':[180,1,true],'research-bench':[250,1,true],
  'machining-table':[180,1,true],
  'fabrication-bench':[300,1,true],'hi-tech-research-bench':[250,1,true],'multi-analyzer':[200,1,true],
  'art-bench':[180,1,true],'small-sculpture':[90,1,true],'large-sculpture':[150,1,true],
  'electric-tailor-bench':[180,1,true],'table-square':[100,1,true],'table-long':[125,1,true],'dining-chair':[75,1,true],armchair:[120,1,true],'end-table':[60,1,true],dresser:[100,1,true],'flower-pot':[40,1,true],
  'wood-generator':[300,1,true],'standing-lamp':[50,1,false],'sun-lamp':[50,1,false],cooler:[100,.7,true],vent:[100,1,true],battery:[100,1,true],
  'power-conduit':[80,.7,false],'power-switch':[120,.5,false],'solar-generator':[300,.7,true],heater:[100,.5,true],'wind-turbine':[150,.5,true],
};
const STUFF_HP:Readonly<Record<string,number>>={wood:.65,steel:1,jade:.5,'granite-blocks':1.7,'limestone-blocks':1.55,'marble-blocks':1.2,'sandstone-blocks':1.4,'slate-blocks':1.3};
const STUFF_BUILDINGS=new Set(['shelf','small-shelf','spike-trap','electric-crematorium','double-bed','drug-lab','fence','fence-gate','pen-marker','wall','door','autodoor','bedroll','bed','hospital-bed','table','table-square','table-long','stool','dining-chair','end-table','dresser','flower-pot','horseshoes','chess-table','stonecutter','butcher-table','fueled-stove','electric-stove','tailor-bench','electric-tailor-bench','research-bench','art-bench','small-sculpture','large-sculpture']);
export const structureMaxHp=(s:Pick<Structure,'kind'|'material'>)=>isAncientMonumentKind256(s.kind)&&ancientMonumentMaterial256(s.kind,s.material,256)?ancientMonumentMaxHp256(s.kind,s.material):Object.hasOwn(s,'factionId')&&(s.kind==='wall'||s.kind==='door'||s.kind==='table'||s.kind==='table-square')&&ancientMonumentMaterial256('column',s.material,256)?ancientNeutralMaxHp256(s.kind,s.material):s.material==='jade'&&isHabitatFurnitureKind(s.kind)?Math.round(FURNITURE_DEFINITIONS[s.kind].maxHitPoints*.5):s.kind==='bedroll'&&isBedrollTextile256(s.material)?Math.round(75*BEDROLL_TEXTILES_256[s.material].hitPointsFactor):Math.round((BUILDINGS[s.kind]?.[0]??0)*(STUFF_BUILDINGS.has(s.kind)?STUFF_HP[s.material??'wood']??1:1));
export const structureFlammability=(s:Pick<Structure,'kind'|'material'>)=>isAncientMonumentKind256(s.kind)?ANCIENT_MONUMENT_DEFS_256[s.kind].flammability*(s.material==='wood'?1:s.material==='steel'?.4:0):s.material==='jade'?0:s.kind==='bedroll'&&isBedrollTextile256(s.material)?BEDROLL_TEXTILES_256[s.material].flammabilityFactor:(BUILDINGS[s.kind]?.[1]??0)*(STUFF_BUILDINGS.has(s.kind)?s.material?.endsWith('-blocks')?0:s.material==='steel'?.4:1:1);
export const structureLeavesResources=(s:Pick<Structure,'kind'>)=>isAncientMonumentKind256(s.kind)|| (BUILDINGS[s.kind]?.[2]??false);
export const resourceMaxHp=(r:Pick<Resource,'kind'|'species'>)=>floraDefinition(r)?.hitPoints??(r.kind==='healroot'?60:r.kind==='tree'?200:r.kind==='berries'?120:r.kind==='corn'?150:r.kind==='rock'?0:85);
export const resourceFlammability=(r:Pick<Resource,'kind'|'species'>)=>floraDefinition(r)?.flammability??(r.kind==='rock'?0:r.kind==='tree'?.8:r.kind==='haygrass'?1.3:1);
export function pileMaxHp(p:Pick<MaterialPile,'kind'|'item'>,version=p.item==='ai-core'?298:p.item==='novel'?295:isProstheticItem273(p.item)?273:isSmithingApparel267(p.item)?267:193):number {
  if(p.item==='ai-core')return isSchema298OrLater(version)&&p.kind==='ai-core'?AI_CORE_CONTENT_298.maxHitPoints:0;
  if(p.item==='novel')return (version===295||(version===296||isCorePhysicalSchema297(version)))&&p.kind==='book'?NOVEL_MAX_HIT_POINTS_295:0;
  if(isProstheticItem273(p.item))return isSchema273OrLater(version)&&p.kind==='prosthesis'?50:0;
  if(isSmithingApparel267(p.item))return version>=267&&p.kind==='apparel'?APPAREL[p.item].hitPoints:0;
  if(version<256&&(p.item==='flak-pants'||p.item==='plasteel-flak-helmet'))return 0;
  if(p.item==='slag-steel-chunk')return version>=256?300:0;
  if(p.item==='hops'||p.item==='wort'||p.item==='beer')return version>=265?(p.item==='beer'?50:60):0;
  if(p.item==='raw-fungus')return version>=256?60:0;
  if(isAnimalItem256(p.item))return version>=256?(ANIMAL_ITEM_HP_256 as Readonly<Record<string,number>>)[p.item]??(p.kind==='corpse'?100:0):0;
  if(version>=256&&p.item==='steel')return 100;
  if(p.kind==='plant')return version>=235?100:0;
  if(p.kind==='apparel')return APPAREL[p.item as keyof typeof APPAREL]?.hitPoints??0;
  if(p.kind==='weapon')return weaponMaxHitPoints(p.item);if(p.kind==='corpse'||p.kind==='mech-corpse')return 100;
  if(p.kind==='food')return ['nutrient-paste-meal','simple-meal','fine-meal','vegetarian-fine-meal','carnivore-fine-meal','lavish-meal','vegetarian-lavish-meal','carnivore-lavish-meal','survival-meal','legacy-portion'].includes(p.item)?50:60;
  if(p.kind==='chemfuel')return 50;if(p.kind==='medicine')return 60;if(p.kind==='neutroamine')return 50;if(p.kind==='unfinished')return 50;
  if(version>=193){if(p.kind==='chunk')return 300;if(p.item==='muffalo-wool')return 90;if(p.item==='advanced-component')return 70;if(['plainleather','bluefur','camelhide','foxfur'].includes(p.item))return 60;}
  return p.item==='wood'?150:p.item==='cloth'?80:p.item==='light-leather'?60:p.item==='component'?70:0;
}
export function pileFlammability(p:Pick<MaterialPile,'kind'|'item'>):number {
  if(p.item==='ai-core'&&p.kind==='ai-core')return AI_CORE_CONTENT_298.flammability;
  if(p.item==='novel'&&p.kind==='book')return 1;
  if(isProstheticItem273(p.item))return .7;
  if(isSpearItem272(p.item))return SPEAR_DEFINITIONS_272[spearMaterial272(p.item)].flammability;
  if(isLongswordItem270(p.item))return LONGSWORD_DEFINITIONS_270[longswordMaterial270(p.item)].flammability;
  if(isMaceItem269(p.item))return MACE_DEFINITIONS_269[maceMaterial269(p.item)].flammability;
  if(isSmithingApparel267(p.item))return ARMOR_STUFF_DEFINITIONS267[smithingApparelStuff267(p.item)].flammability;
  if(isAnimalItem256(p.item))return (ANIMAL_ITEM_FLAMMABILITY_256 as Readonly<Record<string,number>>)[p.item]??(p.kind==='corpse'?.7:0);
  if(p.item==='hops')return 1;if(p.item==='wort')return .2;if(p.item==='beer')return .5;
  if(p.kind==='plant')return .8;
  if(p.item==='recon-armor')return .4;
  if(p.item==='plasteel-flak-helmet')return 0;
  if(p.item==='flak-pants')return .6;
  if(p.kind==='apparel')return (p.item==='flak-vest'||p.item==='flak-helmet')?.6:1.2;
  if(p.kind==='mech-corpse')return 0;
  if(p.kind==='weapon')return p.item==='plasteel-knife'?0:.5;if(p.kind==='corpse')return .7;if(p.kind==='food')return p.item==='pemmican'?.6:p.item==='hay'?1.5:1;
  if(p.kind==='medicine')return p.item==='herbal-medicine'?1.3:.7;
  if(p.kind==='chemfuel')return 2;if(p.kind==='neutroamine')return .7;
  // Unfinished apparel inherits the default zero stat; its embedded cloth is not a second ground pile.
  return p.item==='wood'?1:p.item==='cloth'?1.2:p.item==='light-leather'?1:p.item==='component'?.6:0;
}
export function pileDamage(p:MaterialPile):number {return p.apparel?pileMaxHp(p)-p.apparel.hitPoints:p.weapon?pileMaxHp(p)-p.weapon.hitPoints:p.damage??0;}
export function copyThingDamage(target:{damage?:number},source:{damage?:number}):void {if(source.damage)target.damage=source.damage;else delete target.damage;}
/** Call before adding quantity. Core stacks average surviving HP, rounding up. */
export function mergeThingDamage(target:Pick<MaterialPile,'item'|'kind'|'quantity'|'damage'>,quantity:number,sourceDamage=0,maxHp=pileMaxHp(target)):void {
  if(!maxHp||!quantity)return;const hp=Math.ceil(((maxHp-(target.damage??0))*target.quantity+(maxHp-sourceDamage)*quantity)/(target.quantity+quantity));
  if(hp<maxHp)target.damage=maxHp-hp;else delete target.damage;
}
export type FireItemLoss=Partial<Record<ItemId,number>>;

export const isRepairableStructure=(s:Pick<Structure,'kind'|'material'>):boolean=>structureMaxHp(s)>0;
import {isMaceItem269,maceMaterial269,MACE_DEFINITIONS_269} from './mace-content-269.ts';
