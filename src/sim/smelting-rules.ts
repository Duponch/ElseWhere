import {isLongswordItem270,longswordMaterial270,longswordUnits270} from './longsword-content-270.ts';
import {isSpearItem272,spearMaterial272,spearUnits272} from './spear-content-272.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {isMaceItem269,maceMaterial269,maceUnits269} from './mace-content-269.ts';
import {SCHEMA_VERSION} from './types.ts';
import { roundYield } from './cooking-statistics.ts';
import { WEAPON_QUALITIES,isWeaponItem,weaponMaxHitPoints,type WeaponItem } from './equipment-rules.ts';
import { pawnBody } from './health-rules.ts';
import type { CookingBill,SmeltFilter } from './cooking-types.ts';
import type { MaterialPile,Pawn } from './types.ts';
import { isSmeltingRecipe,SMELTING_WEAPONS } from './smelting-content.ts';
import {APPAREL} from './apparel-definitions.ts';
import {isSmithingApparel267,smithingApparelStuff267,smithingApparelUnits267,type SmithingApparel267} from './smithing-apparel-267.ts';
export { isSmeltingRecipe,SMELTING_WORK_TICKS,SMELTING_MAX_OUTPUT,SMELTING_WEAPONS,SMELTING_APPAREL_INPUTS267,SMELTING_APPAREL_MAX_OUTPUT267,smeltingProduct,type SmeltingRecipe } from './smelting-content.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validSmeltFilter(value:unknown):value is SmeltFilter {
  if(!record(value)||Object.keys(value).some(k=>!['hpMin','hpMax','qualityMin','qualityMax'].includes(k))
    ||!['hpMin','hpMax','qualityMin','qualityMax'].every(k=>Object.hasOwn(value,k)))return false;
  const min=WEAPON_QUALITIES.indexOf(value.qualityMin as SmeltFilter['qualityMin']),max=WEAPON_QUALITIES.indexOf(value.qualityMax as SmeltFilter['qualityMax']);
  return typeof value.hpMin==='number'&&Number.isInteger(value.hpMin)&&value.hpMin>=0
    &&typeof value.hpMax==='number'&&Number.isInteger(value.hpMax)&&value.hpMax<=100&&value.hpMin<=value.hpMax&&min>=0&&max>=min;
}
/** Core rounds the ratio to hundredths with midpoint-to-even before filtering. */
export function smeltingHitPointsPercent(hitPoints:number,maxHitPoints:number):number {
  const numerator=hitPoints*100,whole=Math.floor(numerator/maxHitPoints),remainder=numerator-whole*maxHitPoints;
  return Math.min(100,Math.max(0,whole+(remainder*2>maxHitPoints||remainder*2===maxHitPoints&&whole%2!==0?1:0)));
}
/** Ownership belongs to the caller: this same filter applies to ground and held stages. */
export function smeltingIngredientAllowed(bill:CookingBill,pile:MaterialPile):boolean {
  if(bill.recipe==='smelt-slag')return materialAllowedForPlayer256(pile)&&pile.item==='slag-steel-chunk'&&pile.kind==='chunk'&&pile.quantity===1&&bill.filters['slag-steel-chunk']===true&&pile.weapon===undefined&&pile.apparel===undefined&&pile.corpse===undefined&&(pile.damage===undefined||Number.isSafeInteger(pile.damage)&&pile.damage>=1&&pile.damage<300);
  if(bill.recipe==='smelt-apparel'){
    if(!validSmeltFilter(bill.smeltFilter)||!materialAllowedForPlayer256(pile)||!isSmithingApparel267(pile.item)||smithingApparelStuff267(pile.item)==='wood'
      ||pile.kind!=='apparel'||pile.quantity!==1||bill.filters[pile.item]!==true||!record(pile.apparel)||pile.weapon!==undefined
      ||pile.apparel.material!==undefined||pile.apparel.forbidden!==undefined||pile.apparel.forced!==undefined
      ||Object.keys(pile.apparel).some(k=>!['quality','hitPoints','material','forbidden','forced'].includes(k)))return false;
    const a=pile.apparel,max=APPAREL[pile.item].hitPoints,quality=WEAPON_QUALITIES.indexOf(a.quality);
    if(!Number.isInteger(a.hitPoints)||a.hitPoints<=0||a.hitPoints>max||quality<0)return false;
    const hp=smeltingHitPointsPercent(a.hitPoints,max),filter=bill.smeltFilter;
    return hp>=filter.hpMin&&hp<=filter.hpMax&&quality>=WEAPON_QUALITIES.indexOf(filter.qualityMin)&&quality<=WEAPON_QUALITIES.indexOf(filter.qualityMax);
  }
  if(!isSmeltingRecipe(bill.recipe)||!validSmeltFilter(bill.smeltFilter)||!isWeaponItem(pile.item)||!SMELTING_WEAPONS.includes(pile.item)
    ||pile.kind!=='weapon'||pile.quantity!==1||bill.filters[pile.item]!==true||!record(pile.weapon)
    ||!Object.hasOwn(pile.weapon,'quality')||!Object.hasOwn(pile.weapon,'hitPoints')
    ||Object.keys(pile.weapon).some(k=>!['quality','hitPoints','forbidden'].includes(k))||pile.weapon.forbidden!==undefined)return false;
  const weapon=pile.weapon,max=weaponMaxHitPoints(pile.item),quality=WEAPON_QUALITIES.indexOf(weapon.quality);
  if(!Number.isInteger(weapon.hitPoints)||weapon.hitPoints<=0||weapon.hitPoints>max||quality<0)return false;
  const hp=smeltingHitPointsPercent(weapon.hitPoints,max),filter=bill.smeltFilter;
  return hp>=filter.hpMin&&hp<=filter.hpMax&&quality>=WEAPON_QUALITIES.indexOf(filter.qualityMin)&&quality<=WEAPON_QUALITIES.indexOf(filter.qualityMax);
}
export function validSmeltingIngredients(parts:readonly {item:unknown;quantity:number}[],recipe:unknown='smelt-weapon'):boolean {
  return parts.length===1&&parts[0]!.quantity===1&&(recipe==='smelt-slag'?parts[0]!.item==='slag-steel-chunk':recipe==='smelt-apparel'?isSmithingApparel267(parts[0]!.item)&&smithingApparelStuff267(parts[0]!.item)!=='wood':isWeaponItem(parts[0]!.item)&&SMELTING_WEAPONS.includes(parts[0]!.item));
}
/** Smelting has no skill or learning; delivered WorkSpeedGlobal remains neutral. */
export function smeltingSpeed(pawn:Pawn):number {
  const c=pawnBody(pawn).capacities;
  return Math.max(.1,c.manipulation*(.7+.3*Math.min(1,c.sight)));
}
/** Intricate components are excluded before rounding. Even a whole yield draws once. */
export function smeltingYield(item:WeaponItem|SmithingApparel267,random:()=>number):number {
  if(isSpearItem272(item)){const material=spearMaterial272(item);if(material==='wood')throw Error('Wooden weapon is not smeltable');return roundYield(spearUnits272(material)*.25,random);}
  if(isLongswordItem270(item)){const material=longswordMaterial270(item);if(material==='wood')throw Error('Wooden weapon is not smeltable');return roundYield(longswordUnits270(material)*.25,random);}
  if(isMaceItem269(item)){const material=maceMaterial269(item);if(material==='wood')throw Error('Wooden weapon is not smeltable');return roundYield(maceUnits269(material)*.25,random);}
  if(isSmithingApparel267(item)){
    if(smithingApparelStuff267(item)==='wood')throw Error('Wooden apparel is not smeltable');
    return roundYield(smithingApparelUnits267(item)*.25,random);
  }
  return roundYield((item==='bolt-action-rifle'||item==='pump-shotgun'?60:item==='emp-launcher'?75:30)*.25,random);
}
export function validSmeltingProduct(item:unknown,quantity:unknown,recipe:unknown='smelt-weapon',version:number=SCHEMA_VERSION):boolean {
  if(recipe==='smelt-apparel')return Number.isInteger(quantity)&&(['steel','plasteel','uranium'].includes(String(item))?[10,42,43].includes(Number(quantity)):['silver','gold'].includes(String(item))&&[100,425].includes(Number(quantity)));
  if(recipe==='smelt-slag')return item==='steel'&&typeof quantity==='number'&&Number.isInteger(quantity)&&quantity>=1&&quantity<=15;
  // Output can already have deposited a fraction into a partly filled stack.
  // Preserve each old metal/quantity frontier, even with no input left.
  return typeof quantity==='number'&&Number.isInteger(quantity)&&quantity>=1&&(item==='steel'?quantity<=(version>=270?25:19):item==='plasteel'?quantity<=(version>=270?25:version>=269?13:8):version>=269&&(item==='uranium'?quantity<=(version>=270?25:13):(item==='silver'||item==='gold')&&quantity<=(version>=270?250:125)));
}
