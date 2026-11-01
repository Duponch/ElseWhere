import {groupIngestionCore299,commitHumanIngestion299} from './human-ingestion-clock299.ts';
import {recordCaravanAnimalConsumption256} from './group-animal-food-256.ts';
import type {Pawn,World,MaterialPile} from './types.ts';
import {TICKS_PER_DAY} from './types.ts';
import type {AwayGroup} from './group-capture.ts';
import type {GroupReorganization} from './group-reorganization-state.ts';
import type {GroupForageRevision256,GroupForageUnits256,GroupForagedItem256} from './group-forage-state-256.ts';
import {GROUP_FORAGED_ITEMS_256} from './group-forage-state-256.ts';
import {groupCaravanUnitMass256} from './group-caravan-mass-256.ts';
import {freightGroup} from './group-freight.ts';
import {mixedGroupProvisions} from './group-provisions.ts';
import {allowedFoodFromPolicies} from './food-policy.ts';
import {foodScore} from './food-selection.ts';
import {ticksUntilRot} from './food-preservation.ts';
import {ITEM_DEFINITIONS,adultHungerFactor,mealQuantity,rawFoodThought} from './items.ts';
import {ingestionFoodPoison,exposeFoodPoisoningAtRecord} from './food-poisoning.ts';
import {createMedicalRecord,medicalStatus} from './injury-state.ts';
import {rememberIngestionAt} from './wellbeing.ts';
import type {ConsumedGroupMass} from './group-care.ts';
export type GroupFoodOwner256=AwayGroup&{travel?:{revision:1;tickDelta:number;forage:GroupForageRevision256};reorganization?:GroupReorganization&{foodSinceOpening?:{consumed:GroupForageUnits256;spoiled:GroupForageUnits256}}};
function fruitCounters(g:GroupFoodOwner256):{consumed:GroupForageUnits256;spoiled:GroupForageUnits256}|undefined{return g.travel?.forage??g.reorganization?.foodSinceOpening;}
function eligible(g:GroupFoodOwner256,w:World,p:Pawn):MaterialPile|undefined {
 const allowed=allowedFoodFromPolicies(w.foodPolicies,p),owners=new Set([...g.members,...g.animalOwners?.members??[]].filter(p=>p.state!=='dead'&&!p.health?.death).map(p=>p.id)),mixed=mixedGroupProvisions(g)||g.reorganization?.revision===1,fruits=!!fruitCounters(g);
 return g.items.filter(pile=>pile.owner.type==='inventory'&&owners.has(pile.owner.pawnId)&&allowed.some(food=>food===pile.item)&&ticksUntilRot(pile,w.tick)>0&&(pile.item==='survival-meal'||mixed&&pile.item==='pemmican'||fruits&&ITEM_DEFINITIONS[pile.item].nutrition>0))
  .sort((a,b)=>(foodScore(b.item,0)+(ticksUntilRot(b,w.tick)<TICKS_PER_DAY/2?12:0))-(foodScore(a.item,0)+(ticksUntilRot(a,w.tick)<TICKS_PER_DAY/2?12:0))||a.id-b.id)[0];
}
/** One original person in Mono needs order. A received fruit is not recorded
 * as gathered; legacy reorganization gets consumption counters only. */
export function ingestGroupFood256(w:World,g:GroupFoodOwner256,p:Pawn,c:{coreAt299?:number;random():number;notice(pawn:Pawn,message:string):void}):ConsumedGroupMass {
 const none:ConsumedGroupMass={massRemovedGrams:0,removed:[]};
 if(w.schemaVersion<256||w.group!==g||g.lastPersonalTick!==w.tick||!g.members.includes(p)||g.travel?.revision!==1&&g.reorganization?.revision!==1)throw Error('Invalid prospective food owner');
 if(p.state==='dead'||p.health?.death||adultHungerFactor(p.hunger)>=1)return none;
 const pile=eligible(g,w,p);if(!pile)return none;
 const owner=pile.owner,quantity=mealQuantity(p,pile,pile.quantity),mass=groupCaravanUnitMass256(pile.item,freightGroup(g));
 if(owner.type!=='inventory'||mass===undefined||!Number.isSafeInteger(quantity)||quantity<1||quantity>pile.quantity)throw Error('Invalid prospective food possession');
 const ordinary=pile.item!=='survival-meal'&&pile.item!=='pemmican'&&!GROUP_FORAGED_ITEMS_256.includes(pile.item as GroupForagedItem256);
 const fruit=GROUP_FORAGED_ITEMS_256.includes(pile.item as GroupForagedItem256),counter=fruit?fruitCounters(g)!.consumed:undefined;
 let prior:number;if(ordinary)prior=0;else if(fruit)prior=counter![pile.item as GroupForagedItem256];else if(pile.item==='pemmican')prior=g.provisions?.pemmicanConsumedUnits??g.reorganization?.pemmicanSinceOpening?.consumed??NaN;else prior=g.ledger.foodConsumed;
 if(!Number.isSafeInteger(prior)||!Number.isSafeInteger(prior+quantity))throw Error('Prospective food counter overflow');
 const ingestedAt299=groupIngestionCore299(g,p,w.schemaVersion,w.tick,c.coreAt299);
 if(ordinary)recordCaravanAnimalConsumption256(g,pile.item,quantity);
 const cause=ingestionFoodPoison(pile,true,w.gameProfile?.difficulty==='adventure-story'?.75:1,c.random);
 if(pile.quantity===quantity)g.items.splice(g.items.indexOf(pile),1);else pile.quantity-=quantity;
 p.hunger=Math.min(100,p.hunger+ITEM_DEFINITIONS[pile.item].nutrition*quantity);commitHumanIngestion299(p,ingestedAt299);rememberIngestionAt(p,w.tick,{raw:rawFoodThought(pile.item),food:pile.item});
 if(ordinary){}else if(fruit)counter![pile.item as GroupForagedItem256]=prior+quantity;else if(pile.item==='pemmican'){if(g.provisions)g.provisions.pemmicanConsumedUnits=prior+quantity;else g.reorganization!.pemmicanSinceOpening!.consumed=prior+quantity;}else g.ledger.foodConsumed=prior+quantity;
 if(cause){p.health??=createMedicalRecord(w.tick);p.health.foodPoisoning=exposeFoodPoisoningAtRecord(p.health,cause,pile.item,w.tick);const status=medicalStatus(p.health);if(status!=='mobile')p.state=status;c.notice(p,`${p.name} souffre d’une intoxication alimentaire.`);}
 if(!eligible(g,w,p))c.notice(p,'La caravane ne possède plus de nourriture admissible pour ce membre.');
 return {massRemovedGrams:mass*quantity,removed:[{pawnId:owner.pawnId,grams:mass*quantity}]};
}
