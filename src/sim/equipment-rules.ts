import {LONGSWORD_ITEMS_270,isLongswordItem270,longswordLabel270,longswordMaxHitPoints270,type LongswordItem270} from './longsword-content-270.ts';
import {SPEAR_ITEMS_272,isSpearItem272,spearLabel272,spearMaxHitPoints272,type SpearItem272} from './spear-content-272.ts';
import type { MaterialPile,Pawn,World } from './types.ts';
import {pileIndex,pileIndexMismatch,verifyPileIndex} from './pile-index.ts';
import type { ItemId } from './items.ts';
import {MACE_ITEMS_269,isMaceItem269,maceLabel269,maceMaxHitPoints269,type MaceItem269} from './mace-content-269.ts';

export const WEAPON_QUALITIES=['awful','poor','normal','good','excellent','masterwork','legendary'] as const;
export type WeaponQuality=typeof WEAPON_QUALITIES[number];
const MELEE_QUALITY_FACTORS=Object.freeze([.8,.9,1,1.1,1.2,1.45,1.65]);
export const weaponMeleeQualityFactor=(quality:WeaponQuality):number=>MELEE_QUALITY_FACTORS[WEAPON_QUALITIES.indexOf(quality)]!;
export const QUALITY_LABELS:Readonly<Record<WeaponQuality,string>>={awful:'déplorable',poor:'médiocre',normal:'normal',good:'bon',excellent:'excellent',masterwork:'chef-d’œuvre',legendary:'légendaire'};
export interface WeaponState {quality:WeaponQuality;hitPoints:number;forbidden?:true}
export type EquipmentAction='equip'|'drop'|'wear'|'remove';
export interface EquipmentTask {itemId:number;action:EquipmentAction;progress:number;duration?:number;automatic?:true}
export type EquipmentCommand={type:'order-equipment';pawnId:number;itemId:number;action:EquipmentAction;queue:boolean}
  |{type:'weapon-permission';itemId:number;allowed:boolean}
  |{type:'apparel-permission';itemId:number;allowed:boolean}|{type:'forget-weapon';pawnId:number};
/** The first equipment pile of this pawn in array order (pile index inside a simulation step). */
export function equippedWeapon(world:World,pawn:Pawn):MaterialPile|undefined {
  const index=Number.isInteger(pawn.id)?pileIndex(world):undefined;
  if(index&&!verifyPileIndex)return index.equipment.get(pawn.id);
  const found=world.piles.find(p=>p.owner.type==='equipment'&&p.owner.pawnId===pawn.id);
  if(index&&index.equipment.get(pawn.id)!==found)pileIndexMismatch('equipped weapon');
  return found;
}
const longswordLabels270=Object.fromEntries(LONGSWORD_ITEMS_270.map(item=>[item,longswordLabel270(item)])) as Record<LongswordItem270,string>;
const maceLabels269=Object.fromEntries(MACE_ITEMS_269.map(item=>[item,maceLabel269(item)])) as Record<MaceItem269,string>;
const spearLabels272=Object.fromEntries(SPEAR_ITEMS_272.map(item=>[item,spearLabel272(item)])) as Record<SpearItem272,string>;
export const WEAPON_LABELS=Object.freeze({revolver:'Revolver','bolt-action-rifle':'Fusil à verrou','plasteel-knife':'Couteau en plastacier','emp-launcher':'Lanceur EMP','short-bow':'Arc court','pump-shotgun':'Fusil à pompe',...maceLabels269,...longswordLabels270,...spearLabels272});
export type WeaponItem=keyof typeof WEAPON_LABELS;
export type RangedWeaponItem='revolver'|'bolt-action-rifle'|'emp-launcher'|'short-bow'|'pump-shotgun';
export const isWeaponItem=(item:unknown):item is WeaponItem=>typeof item==='string'&&Object.hasOwn(WEAPON_LABELS,item);
export const isRangedWeaponItem=(item:unknown):item is RangedWeaponItem=>item==='revolver'||item==='bolt-action-rifle'||item==='emp-launcher'||item==='short-bow'||item==='pump-shotgun';
export const weaponMaxHitPoints=(item:ItemId):number=>isSpearItem272(item)?spearMaxHitPoints272(item):isLongswordItem270(item)?longswordMaxHitPoints270(item):isMaceItem269(item)?maceMaxHitPoints269(item):item==='plasteel-knife'?280:isWeaponItem(item)?100:0;
export const weaponLabel=(pile:MaterialPile):string=>`${WEAPON_LABELS[pile.item as WeaponItem]??'Arme'} (${QUALITY_LABELS[pile.weapon?.quality??'normal']})`;
export const newWeaponState=(item:WeaponItem='revolver'):WeaponState=>({quality:'normal',hitPoints:weaponMaxHitPoints(item)});
