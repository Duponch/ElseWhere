import {groupIngestionCore299,commitHumanIngestion299} from './human-ingestion-clock299.ts';
import {mixedGroupProvisions,groupPemmicanCounter,setGroupPemmicanCounter} from './group-provisions.ts';
import {foodScore} from './food-selection.ts';
import {ticksUntilRot} from './food-preservation.ts';
import {TICKS_PER_DAY} from './types.ts';
import type { GroupState } from './group-state.ts';
import type { Pawn } from './types.ts';
import type { FoodPolicy } from './food-policy.ts';
import { allowedFoodFromPolicies } from './food-policy.ts';
import { ITEM_DEFINITIONS,adultHungerFactor,mealQuantity } from './items.ts';
import { commercialItemMassGrams } from './commercial-mass.ts';
import { ingestionFoodPoison,exposeFoodPoisoningAtRecord } from './food-poisoning.ts';
import { createMedicalRecord,medicalStatus } from './injury-state.ts';
import { rememberIngestionAt } from './wellbeing.ts';
import type { ConsumedGroupMass } from './group-care.ts';
type ActiveGroup=Extract<GroupState,{members:unknown}>;
export interface GroupIngestionContext {
  /** One actual owner only, for the prospective per-Pawn Core needs order. */
  onlyPerson256?:Pawn;
  tick:number;schemaVersion:number;coreAt299?:number;foodPolicies:readonly FoodPolicy[];foodPoisonFactor:number;
  random():number;notice(person:Pawn,message:string):void;
}
/** Historical groups retain ration-only ingestion. Prospective formations
 * share actual survival meals and pemmican across living carriers. */
export function advanceGroupIngestion(group:ActiveGroup,c:GroupIngestionContext):ConsumedGroupMass {
  if(group.lastPersonalTick!==c.tick)throw Error('Ingestion precedes personal frontier');
  const removed:ConsumedGroupMass['removed']=[];
  if(c.onlyPerson256&&(c.schemaVersion<256||!group.members.includes(c.onlyPerson256)))throw Error('Invalid prospective ingestion owner');
  for(const person of c.onlyPerson256?[c.onlyPerson256]:group.members){
    if(person.state==='dead'||person.health?.death||adultHungerFactor(person.hunger)>=1)continue;
    const mixed=mixedGroupProvisions(group),allowed=allowedFoodFromPolicies(c.foodPolicies,person);
    if(!mixed&&!allowed.includes('survival-meal'))continue;
    const validOwner=(p:typeof group.items[number])=>p.owner.type==='inventory'&&group.members.some(owner=>owner.id===('pawnId' in p.owner?p.owner.pawnId:-1)&&owner.state!=='dead');
    const score=(p:typeof group.items[number])=>foodScore(p.item,0)+(ticksUntilRot(p,c.tick)<TICKS_PER_DAY/2?12:0);
    const pile=mixed?group.items.filter(p=>(p.item==='pemmican'||p.item==='survival-meal')&&validOwner(p)&&allowed.includes(p.item)&&ticksUntilRot(p,c.tick)>0).sort((a,b)=>score(b)-score(a)||a.id-b.id)[0]
      :group.items.find(p=>p.item==='survival-meal'&&validOwner(p));
    if(!pile)continue;
    const owner=pile.owner,index=group.items.indexOf(pile),mass=commercialItemMassGrams(pile.item);
    if(owner.type!=='inventory'||index<0||mass===undefined||!Number.isSafeInteger(pile.quantity)||pile.quantity<1)throw Error('Invalid group food ownership');
    const quantity=mealQuantity(person,pile,pile.quantity),pemmican=mixed&&pile.item==='pemmican',consumed=(pemmican?groupPemmicanCounter(group,'consumed'):group.ledger.foodConsumed)+quantity;
    if((!mixed&&quantity!==1)||!Number.isSafeInteger(quantity)||quantity<1||quantity>pile.quantity||!Number.isSafeInteger(consumed)||consumed<0)throw Error('Invalid food consumption counter');
    const ingestedAt299=groupIngestionCore299(group,person,c.schemaVersion,c.tick,c.coreAt299);
    const cause=c.schemaVersion>=89?ingestionFoodPoison(pile,true,c.foodPoisonFactor,c.random):undefined;
    if(pile.quantity===quantity)group.items.splice(index,1);else pile.quantity-=quantity;
    person.hunger=Math.min(100,person.hunger+ITEM_DEFINITIONS[pile.item].nutrition*quantity);
    commitHumanIngestion299(person,ingestedAt299);
    // No dining-room observation or missing-table thought without that job.
    rememberIngestionAt(person,c.tick,{raw:false,food:pile.item});
    if(pemmican)setGroupPemmicanCounter(group,'consumed',consumed);else group.ledger.foodConsumed=consumed;
    removed.push({pawnId:owner.pawnId,grams:mass*quantity});
    if(cause){
      person.health??=createMedicalRecord(c.tick);
      person.health.foodPoisoning=exposeFoodPoisoningAtRecord(person.health,cause,pile.item,c.tick);
      const status=medicalStatus(person.health);if(status!=='mobile')person.state=status;
      c.notice(person,`${person.name} souffre d’une intoxication alimentaire.`);
    }
    if(!group.items.some(p=>p.item==='survival-meal'||mixed&&p.item==='pemmican'))c.notice(person,mixed?'Le groupe a consommé sa dernière provision.':'Le groupe a consommé sa dernière ration.');
  }
  const massRemovedGrams=removed.reduce((sum,r)=>sum+r.grams,0);
  if(!Number.isSafeInteger(massRemovedGrams))throw Error('Food mass overflow');
  return {massRemovedGrams,removed};
}
