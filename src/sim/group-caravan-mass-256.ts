import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {validAiCorePile298} from './victory-content-save-298.ts';
import {AI_CORE_CONTENT_298} from './ai-core-content-298.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validNovelPile295} from './book-save-295.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {additionalGroupFreightMass258,groupPackedMassGrams258} from './group-freight-mass-258.ts';
import {SCHEMA_VERSION} from './types.ts';
import {physicalTravelUnitMass} from './tree-transfer-mass.ts';
import {isAnimalMeat} from './biome-items.ts';
import {commercialItemMassGrams} from './commercial-mass.ts';
import {isProstheticItem273} from './prosthetic-content-273.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {isSmithingApparel267} from './smithing-apparel-267.ts';
import {caravanPawnCapacityGrams256,caravanRidingFactor256} from './group-animal-capacity-256.ts';
import type {MaterialPile} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {AwayGroup,GroupMassCapture} from './group-capture.ts';
import {groupItemMassGrams,freightGroup} from './group-freight.ts';
export const GROUP_FORAGED_MASS_256=Object.freeze({berries:27,'agave-fruit':30});
export type GroupWithTravelPacked256=AwayGroup&{packed?:PackedFurniture[]};
/** This new contract alone admits real gathered fruits. It does not broaden
 * mass/possession admission of a historical group or an individual trip. */
export function groupCaravanUnitMass256(item:MaterialPile['item'],freight:boolean,version:number=256):number|undefined {
 if(item==='ai-core')return isSchema298OrLater(version)?AI_CORE_CONTENT_298.massGrams:undefined;
 if(item==='novel')return (version===295||(version===296||isCorePhysicalSchema297(version)))?500:undefined;
 if(isProstheticItem273(item))return isSchema273OrLater(version)?commercialItemMassGrams(item,version):undefined;
 if(isSmithingApparel267(item))return version>=267?commercialItemMassGrams(item,version):undefined;
 if(item==='hops'||item==='wort'||item==='beer')return version>=265?commercialItemMassGrams(item,version):undefined;
 const extra=additionalGroupFreightMass258(item,version);if(extra!==undefined)return extra;
 if(item==='herbal-medicine')return 350;if(item==='glitterworld-medicine')return 500;
 return ITEM_DEFINITIONS[item].nutrition>0?(commercialItemMassGrams(item,256)??(item==='berries'?27:['rice','corn','potato','agave-fruit'].includes(item)||isAnimalMeat(item)?30:['simple-meal','fine-meal','lavish-meal','vegetarian-fine-meal','carnivore-fine-meal','vegetarian-lavish-meal','carnivore-lavish-meal'].includes(item)?440:item==='milk'?30:undefined)):Object.hasOwn(GROUP_FORAGED_MASS_256,item)?GROUP_FORAGED_MASS_256[item as keyof typeof GROUP_FORAGED_MASS_256]:groupItemMassGrams(item,freight,256);
}
/** Preserve the actual inner payload where mass belongs to a Thing, not ItemId. */
export function groupCaravanPileMass256(pile:MaterialPile,freight:boolean,version:number):number|undefined {
 if(pile.kind==='ai-core'||pile.item==='ai-core')return validAiCorePile298(pile,version)?AI_CORE_CONTENT_298.massGrams:undefined;
 if(pile.item==='novel'||pile.kind==='book'||'book'in pile)return (version===295||(version===296||isCorePhysicalSchema297(version)))&&pile.item==='novel'&&validNovelPile295(pile,version)?500:undefined;
 return version>=258&&pile.item==='minified-tree'?physicalTravelUnitMass(pile,version):groupCaravanUnitMass256(pile.item,freight,version);
}
/** Core-only current human life stage has BodySize1. Pack-animal/child/DLC
 * capacities must be supplied by their own real owner, not fabricated here. */
export function captureProspectiveGroupMass256(g:GroupWithTravelPacked256,version:number=SCHEMA_VERSION):GroupMassCapture|undefined {
 if(!g.members.length||new Set(g.members.map(p=>p.id)).size!==g.members.length)return;
 const animals=g.animalOwners?.members??[],all=[...g.members,...animals];if(new Set(all.map(p=>p.id)).size!==all.length)return;
 const carriers=new Map(all.map(p=>[p.id,{pawnId:p.id,grams:0,capacityGrams:caravanPawnCapacityGrams256(p)}])),ids=new Set<number>();
 for(const pile of g.items){
  if(!Number.isSafeInteger(pile.id)||pile.id<1||ids.has(pile.id)||!Number.isSafeInteger(pile.quantity)||pile.quantity<1||!['inventory','equipment','apparel'].includes(pile.owner.type)||!('pawnId' in pile.owner)||pile.owner.type!=='inventory'&&pile.quantity!==1)return;
  ids.add(pile.id);const carrier=carriers.get(pile.owner.pawnId),mass=groupCaravanPileMass256(pile,freightGroup(g),version);if(!carrier||mass===undefined)return;carrier.grams+=pile.quantity*mass;if(!Number.isSafeInteger(carrier.grams))return;
 }
 for(const pack of g.packed??[]){const id=pack.building.id;const unit=groupPackedMassGrams258(pack,version);if(ids.has(id)||unit===undefined||pack.owner.type!=='inventory')return;ids.add(id);const carrier=carriers.get(pack.owner.pawnId);if(!carrier)return;carrier.grams+=unit;if(!Number.isSafeInteger(carrier.grams))return;}
 const values=[...carriers.values()],grams=values.reduce((n,p)=>n+p.grams,0),capacityGrams=values.reduce((n,p)=>n+p.capacityGrams,0);if(!Number.isSafeInteger(grams)||!Number.isSafeInteger(capacityGrams))return;
 return {grams,capacityGrams,...animals.length?{ridingFactor:caravanRidingFactor256(g.members.length,animals)}:{},carriers:values};
}
