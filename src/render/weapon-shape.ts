import {isLongswordItem270,LONGSWORD_ITEMS_270} from '../sim/longsword-content-270';
import {isSpearItem272,SPEAR_ITEMS_272} from '../sim/spear-content-272';
import {SPEAR_DYE272,SPEAR_EQUIPMENT272,SPEAR_PARTS272,spearParts272,spearEquipment272} from './spear-parts272';
import {LONGSWORD_DYE270,LONGSWORD_EQUIPMENT270,LONGSWORD_PARTS270,longswordParts270,longswordEquipment270} from './longsword-parts270';
import {isMaceItem269,MACE_ITEMS_269} from '../sim/mace-content-269';
import {MACE_DYE269,MACE_EQUIPMENT269,MACE_PARTS269,maceParts269,maceEquipment269} from './mace-parts269';
/** One authored rigid shape, reused on the ground, in cargo and at the hip.
 * Dimensions are metres before the pawn's model conversion. */
export const REVOLVER_PARTS = [
  {size:[.31,.065,.065],center:[.05,.065,0],color:0x69757a},
  {size:[.10,.10,.09],center:[-.055,.045,0],color:0x839093},
  {size:[.075,.14,.065],center:[-.105,-.055,0],color:0x705446},
] as const;

const RIFLE_PARTS = [
  {size:[.64,.045,.045],center:[.20,.055,0],color:0x667277},
  {size:[.35,.08,.07],center:[-.085,.025,0],color:0x725740},
  {size:[.24,.14,.06],center:[-.31,-.005,0],color:0x8b6b4c},
  {size:[.11,.09,.055],center:[-.015,.065,0],color:0x859195},
  {size:[.055,.04,.11],center:[-.07,.075,.035],color:0x596367},
] as const;
const KNIFE_PARTS = [
  {size:[.25,.055,.018],center:[.07,.005,0],color:0xb8d0d2},
  {size:[.06,.035,.016],center:[.205,.005,0],color:0xd4e6e5},
  {size:[.11,.045,.035],center:[-.11,0,0],color:0x53656b},
  {size:[.025,.105,.04],center:[-.045,0,0],color:0x849ea3},
] as const;
const EMP_LAUNCHER_PARTS = [
  {size:[.60,.14,.14],center:[.10,.045,0],color:0x546e77},
  {size:[.09,.19,.19],center:[.405,.045,0],color:0x293f4b},
  {size:[.025,.12,.12],center:[.455,.045,0],color:0x5596bf},
  {size:[.055,.175,.175],center:[-.025,.045,0],color:0x78b6c6},
  {size:[.055,.175,.175],center:[.155,.045,0],color:0x78b6c6},
  {size:[.22,.10,.12],center:[-.26,.015,0],color:0x60717b},
  {size:[.075,.15,.065],center:[-.12,-.085,0],color:0x35484f},
  {size:[.12,.035,.035],center:[.10,.15,0],color:0x9ebbc4},
] as const;

/** Schema 316 short bow, an original simple stave: leather grip, two limbs
 * stepping back toward their tips and a light string. The stave runs along
 * the bind Y axis so the aimed bow stands upright, string toward the archer. */
export const SHORT_BOW_PARTS = [
  {size:[.045,.13,.04],center:[0,0,0],color:0x5b3a22},
  {size:[.035,.20,.03],center:[-.008,.165,0],color:0x9a6b3f},
  {size:[.030,.16,.027],center:[-.03,.335,0],color:0x93653b},
  {size:[.026,.08,.024],center:[-.058,.45,0],color:0x7c5532},
  {size:[.035,.20,.03],center:[-.008,-.165,0],color:0x9a6b3f},
  {size:[.030,.16,.027],center:[-.03,-.335,0],color:0x93653b},
  {size:[.026,.08,.024],center:[-.058,-.45,0],color:0x7c5532},
  {size:[.008,.94,.008],center:[-.072,0,0],color:0xe8e0c8},
] as const;
export const SHORT_BOW_DYE316=-16;
/** Schema 322 pump shotgun, original shape: wide barrel over a tube
 * magazine, sliding fore-end, receiver and a wooden stock. */
const PUMP_SHOTGUN_PARTS = [
  {size:[.56,.05,.05],center:[.20,.07,0],color:0x5f6a70},
  {size:[.44,.035,.035],center:[.17,.025,0],color:0x4d575c},
  {size:[.14,.06,.06],center:[.14,.03,0],color:0x6e5238},
  {size:[.20,.09,.065],center:[-.10,.04,0],color:0x6b767b},
  {size:[.06,.12,.05],center:[-.12,-.045,0],color:0x5a4330},
  {size:[.26,.12,.055],center:[-.33,0,0],color:0x7f5f42},
] as const;
/** Schema 326 recurve bow, original shape: the short bow's grip with longer
 * limbs whose tips turn back away from the string. Same bind axes. */
const RECURVE_BOW_PARTS = [
  {size:[.045,.13,.04],center:[0,0,0],color:0x4e3220},
  {size:[.036,.22,.031],center:[-.01,.175,0],color:0x8a5a36},
  {size:[.031,.17,.028],center:[-.034,.36,0],color:0x83552f},
  {size:[.027,.09,.025],center:[-.022,.48,0],color:0x6a4426},
  {size:[.036,.22,.031],center:[-.01,-.175,0],color:0x8a5a36},
  {size:[.031,.17,.028],center:[-.034,-.36,0],color:0x83552f},
  {size:[.027,.09,.025],center:[-.022,-.48,0],color:0x6a4426},
  {size:[.008,1.0,.008],center:[-.05,0,0],color:0xe8e0c8},
] as const;
export const RECURVE_BOW_DYE326=-18;
/** Schema 326 greatbow, original shape: a tall plain stave, about as tall as
 * the archer, with a wrapped grip and a long string. */
const GREATBOW_PARTS = [
  {size:[.05,.15,.045],center:[0,0,0],color:0x4a2f1d},
  {size:[.04,.24,.034],center:[-.01,.195,0],color:0x7a5030},
  {size:[.034,.20,.03],center:[-.038,.41,0],color:0x734a2c},
  {size:[.028,.10,.026],center:[-.064,.555,0],color:0x5f3e24},
  {size:[.04,.24,.034],center:[-.01,-.195,0],color:0x7a5030},
  {size:[.034,.20,.03],center:[-.038,-.41,0],color:0x734a2c},
  {size:[.028,.10,.026],center:[-.064,-.555,0],color:0x5f3e24},
  {size:[.008,1.2,.008],center:[-.08,0,0],color:0xe8e0c8},
] as const;
export const GREATBOW_DYE326=-19;
/** Resident variants share one rig, one cargo batch and the same authored parts
 * as ground piles. Dye tags -2/-3 are already used by clothing. */
export const WEAPON_VISUALS = [
  {item:'revolver',equipment:1,cargo:21,dye:-1,parts:REVOLVER_PARTS},
  // 31–53 belong to folded apparel. Cargo IDs are render-only, never saved.
  {item:'bolt-action-rifle',equipment:2,cargo:70,dye:-4,parts:RIFLE_PARTS},
  {item:'plasteel-knife',equipment:3,cargo:71,dye:-5,parts:KNIFE_PARTS},
  {item:'emp-launcher',equipment:4,cargo:73,dye:-9,parts:EMP_LAUNCHER_PARTS},
  {item:'short-bow',equipment:8,cargo:186,dye:-16,parts:SHORT_BOW_PARTS},
  {item:'pump-shotgun',equipment:9,cargo:187,dye:-17,parts:PUMP_SHOTGUN_PARTS},
  {item:'recurve-bow',equipment:10,cargo:188,dye:RECURVE_BOW_DYE326,parts:RECURVE_BOW_PARTS},
  {item:'greatbow',equipment:11,cargo:189,dye:GREATBOW_DYE326,parts:GREATBOW_PARTS},
] as const;
/** Optional resident families are separate from the four historical concrete
 * visuals: a family key is never a real ItemId or a ground/cargo item. */
export const RESIDENT_WEAPON_VISUALS269=[...WEAPON_VISUALS,
  {item:'mace-family',equipment:MACE_EQUIPMENT269,cargo:0,dye:MACE_DYE269,parts:MACE_PARTS269},
  {item:'longsword-family',equipment:LONGSWORD_EQUIPMENT270,cargo:0,dye:LONGSWORD_DYE270,parts:LONGSWORD_PARTS270},
  {item:'spear-family',equipment:SPEAR_EQUIPMENT272,cargo:0,dye:SPEAR_DYE272,parts:SPEAR_PARTS272},
] as const;
const maceVisuals269=new Map(MACE_ITEMS_269.map(item=>[item,{item,equipment:maceEquipment269(item),cargo:0,dye:MACE_DYE269,parts:maceParts269(item)}]));
const longswordVisuals270=new Map(LONGSWORD_ITEMS_270.map(item=>[item,{item,equipment:longswordEquipment270(item),cargo:0,dye:LONGSWORD_DYE270,parts:longswordParts270(item)}]));
const spearVisuals272=new Map(SPEAR_ITEMS_272.map(item=>[item,{item,equipment:spearEquipment272(item),cargo:0,dye:SPEAR_DYE272,parts:spearParts272(item)}]));
export const weaponVisual=(item:string|undefined)=>isSpearItem272(item)?spearVisuals272.get(item):isLongswordItem270(item)?longswordVisuals270.get(item):isMaceItem269(item)?maceVisuals269.get(item):WEAPON_VISUALS.find(v=>v.item===item);
