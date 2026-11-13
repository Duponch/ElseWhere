import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {isProstheticItem273,PROSTHETIC_DEFINITIONS_273} from './prosthetic-content-273.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {ANIMAL_ITEM_MASS_GRAMS_256,isAnimalItem256} from './animal-items-v256.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {isCoreStartingApparel256} from './starting-gear-256.ts';
import {physicalTravelUnitMass} from './tree-transfer-mass.ts';
import {SCHEMA_VERSION} from './types.ts';
import { apparelFamily,isApparelItem } from './apparel-rules.ts';
import {isSmithingApparel267,smithingApparelMass267} from './smithing-apparel-267.ts';
import { biologicalYears } from './human-age.ts';
import type { ItemId } from './items.ts';
import type { MaterialPile,Pawn,World } from './types.ts';

export interface CommercialMass {grams:number;capacityGrams:number}
const FIXED:Readonly<Partial<Record<ItemId,number>>>=Object.freeze({
  pemmican:18,hay:14,kibble:15,chemfuel:50,'nutrient-paste-meal':440,silver:8,'survival-meal':300,medicine:500,neutroamine:20,component:600,cloth:26,'muffalo-wool':28,
  revolver:1400,'bolt-action-rifle':3500,'plasteel-knife':500,'emp-launcher':3400,
  'flak-vest':4000,'flak-helmet':1200,'flak-pants':4000,'plasteel-flak-helmet':1200,'recon-helmet':1000,'recon-armor':9000,uranium:1000,
});
// Core Mass: BasicShirt 0.25 kg, Jacket 1.7 kg (schema 312).
const TEXTILE=Object.freeze({tribalwear:500,shirt:300,pants:500,duster:2000,parka:2000,tuque:70,tshirt:250,jacket:1700});

/** The delivered shirt is Core's CollarShirt, not the lighter BasicShirt.
 * Quality, HP and the seven represented stuffs do not alter these masses. */
export function commercialItemMassGrams(item:ItemId,version:number=SCHEMA_VERSION):number|undefined {
  if(item==='ai-core')return isSchema298OrLater(version)?2000:undefined;
  if(item==='novel')return (version===295||(version===296||isCorePhysicalSchema297(version)))?500:undefined;
  if(item==='unfinished-prosthetic')return isSchema273OrLater(version)?23400:undefined;
  if(isProstheticItem273(item))return isSchema273OrLater(version)?PROSTHETIC_DEFINITIONS_273[item].massGrams:undefined;
  if(isSpearItem272(item))return version>=272?2000:undefined;
  if(isLongswordItem270(item))return version>=270?2000:undefined;
  if(isMaceItem269(item))return version>=269?1250:undefined;
  if(isSmithingApparel267(item))return version>=267?smithingApparelMass267(item):undefined;
  if(version<256&&isCoreStartingApparel256(item))return undefined;
  if(item==='hops'||item==='wort'||item==='beer')return version>=265?(item==='hops'?30:item==='wort'?800:300):undefined;
  if(item==='jade')return version>=256?500:undefined;
  if(item==='slag-steel-chunk')return version>=256?8000:undefined;
  if(item==='raw-fungus')return version>=256?30:undefined;
  if(isAnimalItem256(item))return version>=256?(ANIMAL_ITEM_MASS_GRAMS_256 as Readonly<Partial<Record<ItemId,number>>>)[item]:undefined;
  if(item==='pemmican'&&version<248)return undefined;
  if(item==='minified-tree')return version>=235?150000:undefined;if(item==='wood')return version>=235?400:undefined;
  if(item.endsWith('-tuque')&&version<245)return undefined;
  const fixed=FIXED[item];if(fixed!==undefined)return fixed;
  if(!isApparelItem(item))return undefined;
  const family=apparelFamily(item);return family?TEXTILE[family]:undefined;
}
/** Pure ownership projection. All worn/equipped gear counts once; the live
 * person's body and goods owned by the map or another actor do not count. */
export function commercialPawnMass(p:Pawn,items:readonly MaterialPile[],version:number=SCHEMA_VERSION):CommercialMass|null {
  if(p.age&&biologicalYears(p.age)<18)return null;
  let grams=0;const ids=new Set<number>();
  for(const pile of items){
    const o=pile.owner;
    if(!o||!('pawnId' in o)||o.pawnId!==p.id||!['inventory','equipment','apparel'].includes(o.type))continue;
    const unit=physicalTravelUnitMass(pile,version);
    if(unit===undefined||!Number.isSafeInteger(pile.quantity)||pile.quantity<1
      ||o.type!=='inventory'&&pile.quantity!==1||ids.has(pile.id))return null;
    ids.add(pile.id);grams+=unit*pile.quantity;
    if(!Number.isSafeInteger(grams))return null;
  }
  return {grams,capacityGrams:35000};
}
/** Pass trip.items off-map; the default only consults live map possessions. */
export function commercialMass(w:World,p:Pawn,items:readonly MaterialPile[]=w.piles):CommercialMass|null {
  return commercialPawnMass(p,items,w.schemaVersion);
}
