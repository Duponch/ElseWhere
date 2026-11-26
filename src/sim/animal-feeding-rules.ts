import { allowedAreaReason } from './allowed-area-state.ts';
import { isColonist } from './affiliation.ts';
import { animalNutritionMax } from './animal-life.ts';
import { animalClaimed,animalCarrier } from './animal-rest-state.ts';
import { veterinaryCareSpeciesAllowed,veterinaryNeedsRest } from './veterinary-rules.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { carrierOf } from './rescue-state.ts';
import { workPriority } from './work-types.ts';
import { canStandAt } from './furniture-travel.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import type { WildAnimal } from './wildlife-state.ts';
import type { Cell,MaterialPile,Pawn,World } from './types.ts';

export interface AnimalFeedTask {
  animalId:number;spot:Cell;sourcePileId:number;carryPileId:number|null;
  quantity:number;phase:'pickup'|'deliver'|'feed';progress:number;
}
/** Herbivore WantEat=.45, Hungry=WantEat*.8, FeedPatient adds .02. All
 * delivered ingestibles/profiles use 500 Core base ticks, multiplied by1.5. */
export const ANIMAL_FEED_HUNGER=.38,ANIMAL_FEED_TICKS=75;

export function animalFeedingDoctorReady(w:World,p:Pawn):boolean {
  return w.schemaVersion>=214&&isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!p.draft&&!p.burning&&!p.flee&&!p.mental?.crisis
    &&!p.interruptedCargo&&!p.collapsePending&&!(w.restRules==='legacy'&&p.rest===0)&&!carrierOf(w,p.id)
    &&!p.animalCare&&!p.animalHandling&&!p.animalRescue&&workPriority(p,'doctor')>0&&!medicalWorkRefusal(p);
}
/** Local adaptation: the five owned species rest on the ground because animal
 * beds are not delivered. Medicine policy does not govern bringing food. */
export function animalFeedingPatientReady(w:World,a:WildAnimal,doctor?:Pawn):boolean {
  return w.schemaVersion>=214&&veterinaryCareSpeciesAllowed(a.species,w.schemaVersion,a)&&!!a.domestic&&!a.manhunter
    &&(a.state==='downed'||a.state==='sleeping')&&!!a.health&&!a.health.death&&a.health.body===a.species
    &&(a.state==='downed'||veterinaryNeedsRest(a.health))&&(!a.motion||a.motion.end<=w.tick)
    &&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.stun&&!(a.health.foodPoisoning?.vomit||(a.health.cryptosleepSickness?.vomit||a.health.toxicBuildup?.vomit||a.health.toxicBuildup?.vomitRequestedAt!==undefined))
    &&!animalCarrier(w,a.id)&&!animalClaimed(w,a.id,doctor?.id);
}
export function animalFeedingReason(w:World,doctor:Pawn,a:WildAnimal|undefined,accepted=false):string|undefined {
  if(!animalFeedingDoctorReady(w,doctor))return 'Un colon libre et apte doit avoir Médecin activé.';
  if(!a||!w.wildlife?.animals.includes(a))return 'L’animal possédé doit être couché pour un besoin médical, sans danger ni autre service.';
  return knownAnimalFeedingReason379(w,doctor,a,accepted);
}
/** A read-only candidate pass has already admitted the doctor and enumerates
 * the actual local animal roster. Keep the patient, area and hunger predicates
 * shared with the public order/ongoing-task reader. */
export function knownAnimalFeedingReason379(w:World,doctor:Pawn,a:WildAnimal,accepted=false):string|undefined {
  if(!animalFeedingPatientReady(w,a,doctor))return 'L’animal possédé doit être couché pour un besoin médical, sans danger ni autre service.';
  if(!accepted){const reason=allowedAreaReason(w,doctor,a);if(reason)return reason;}
  if(!accepted&&a.food>animalNutritionMax(a)*ANIMAL_FEED_HUNGER)return 'Cet animal n’a pas encore besoin d’être nourri.';
  return undefined;
}
export function animalFeedPlaceValid(w:World,t:AnimalFeedTask,a:WildAnimal):boolean {
  return Math.abs(t.spot.x-a.x)+Math.abs(t.spot.z-a.z)===1&&canStandAt(w,t.spot);
}
/** Core StackCountForNutrition uses nearest-even, then the food's ingest cap. */
export function animalFeedQuantity(a:WildAnimal,pile:Pick<MaterialPile,'item'>,available:number):number {
  const def=ITEM_DEFINITIONS[pile.item];if(def.nutrition<=0||available<=0)return 0;
  const raw=(animalNutritionMax(a)-a.food)/(def.nutrition/100),floor=Math.floor(raw);
  const rounded=raw-floor===.5?floor+floor%2:Math.round(raw);
  return Math.min(available,def.maxIngest,Math.max(1,rounded));
}
