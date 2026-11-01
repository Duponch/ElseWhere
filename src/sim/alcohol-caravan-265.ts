import {groupIngestionCore299,commitHumanIngestion299} from './human-ingestion-clock299.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {drugPolicyFor265,type DrugPolicy265} from './alcohol-policy-265.ts';
import {alcoholBodySize265,scheduledAlcoholDue265} from './alcohol-ingestion-265.ts';
import {ingestAlcoholDose265} from './alcohol-clinical-265.ts';
import {createMedicalRecord,medicalStatus} from './injury-state.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {recordCaravanAnimalConsumption256} from './group-animal-food-256.ts';
import {gainRecreation} from './recreation-rules.ts';
import type {GroupState} from './group-state.ts';
import type {ConsumedGroupMass} from './group-care.ts';
import type {Pawn} from './types.ts';
type Group=Extract<GroupState,{members:unknown}>;
export interface GroupAlcoholContext265 {
 tick:number;schemaVersion:number;drugPolicies?:DrugPolicy265[];onlyPerson256?:Pawn;resting:boolean;
 core256?:{tick:number;delta:number};
 random():number;notice(person:Pawn,message:string):void;
}
/** Core caravans ingest from their actual shared retained inventories; they
 * do not manufacture a map position or run a Map ingest job. The mass receipt
 * always names the real original carrier, independently of who drinks. */
export function advanceGroupAlcohol265(group:Group,c:GroupAlcoholContext265):ConsumedGroupMass {
 const none:ConsumedGroupMass={massRemovedGrams:0,removed:[]};
 if(!isSchema265OrLater(c.schemaVersion)||!group.items.some(p=>p.kind==='beer'&&p.item==='beer'))return none;
 if(group.lastPersonalTick!==c.tick||c.onlyPerson256&&!group.members.includes(c.onlyPerson256))throw Error('Alcohol ingestion lost its actual caravan person');
 // Every prospective goods transformation needs a real inventory opening.
 // A historical group is never silently enriched with an effects ledger.
 if(!group.reorganization)return none;
 const core=c.core256??{tick:c.tick*10,delta:10},removed:ConsumedGroupMass['removed']=[];
 // MotionRuntime batches up to sixteen Core ticks. Its actual interval may
 // begin in the previous local tick; only its endpoint belongs to this one.
 if(!Number.isSafeInteger(core.tick)||core.tick<1||!Number.isSafeInteger(core.delta)||core.delta<1||core.delta>16||core.tick>c.tick*10||core.tick<=(c.tick-1)*10||core.tick-core.delta<0)throw Error('Invalid actual caravan alcohol interval');
 const scheduledPulse=groupPawnInterval256(group.id,core.tick,120,core.delta);
 const carriers=new Set([...group.members,...group.animalOwners?.members??[]].filter(p=>p.state!=='dead'&&!p.health?.death).map(p=>p.id));
 for(const p of c.onlyPerson256?[c.onlyPerson256]:group.members){
  if(p.state==='dead'||p.state==='downed'||p.state==='sleeping'||p.health?.death||p.health?.body!==undefined)continue;
  const policy=drugPolicyFor265(c,p).beer,chemical=p.health?.alcohol?.addiction;
  const addictionDue=!!chemical&&chemical.need<=Math.fround(.1)&&policy.allowedForAddiction&&groupPawnInterval256(p.id,core.tick,150,core.delta);
  if(!addictionDue&&!(scheduledPulse&&scheduledAlcoholDue265(c.tick,p,policy)))continue;
  const pile=group.items.find(q=>q.kind==='beer'&&q.item==='beer'&&q.quantity>0&&q.owner.type==='inventory'&&carriers.has(q.owner.pawnId));if(!pile||pile.owner.type!=='inventory')continue;
  const originalCarrier=pile.owner.pawnId;
  if(!Number.isSafeInteger(pile.quantity)||p.health&&medicalCivilTick271(p.health)!==c.tick)throw Error('Caravan beer is not at its actual clinical frontier');
  const previous=group.reorganization.inventoryEffects?.beer??0;if(!Number.isSafeInteger(previous-1))throw Error('Alcohol consumption effects exhausted');
  const ingestedAt299=groupIngestionCore299(group,p,c.schemaVersion,c.tick,core.tick);
  const bodySize=alcoholBodySize265(p);recordCaravanAnimalConsumption256(group,'beer',1);
  if(pile.quantity===1)group.items.splice(group.items.indexOf(pile),1);else pile.quantity--;
  p.health??=createMedicalRecord(c.tick);ingestAlcoholDose265(p.health,bodySize,c.tick,c.random);p.hunger=Math.min(100,p.hunger+8);gainRecreation(p.recreation,'chemical',17);commitHumanIngestion299(p,ingestedAt299);
  const status=medicalStatus(p.health);if(status!=='mobile')p.state=status;
  removed.push({pawnId:originalCarrier,grams:300});c.notice(p,`${p.name} a bu une bière des provisions de la caravane.`);
 }
 return {massRemovedGrams:removed.length*300,removed};
}
