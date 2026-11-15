import {medicalCivilTick271,validMedicalCivilHeader271} from './suspended-human-clock-271.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {isAnimalSpecies} from './animal-species.ts';
import {hasAlcoholConsumeMarker265,validAlcoholConsumePawnShape265,validAlcoholConsumeTransport265} from './alcohol-consume-save-265.ts';
import type {VomitState} from './food-poisoning.ts';
import type {MedicalRecord} from './injury-types.ts';
import {campaignPhysicalCaptures} from './campaign-people.ts';
import {validDrugPolicyRegistry265,effectiveDrugPolicies265} from './alcohol-policy-265.ts';
import {validPenoxycylineIntake337} from './penoxycyline-save-337.ts';
import {validateMedicalRecord} from './injury-validation.ts';
import {medicalStatus} from './injury-state.ts';
import {pawnBody} from './health-rules.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {toxicVomitEngagement256} from './toxic-vomit-256.ts';
import type {World} from './types.ts';
/** Same original's medical clock. The first actual dose creates this record;
 * absence never draws addiction or grants historical chemical experience. */
export interface AlcoholState265 {
 bornAt:number;high:number;tolerance:number;hangover:number;
 lastDoseTick:number;dosesToday:number;
 addiction?:{severity:number;need:number};
 cirrhosis?:true;brainDamage?:true;
 vomit?:VomitState;vomitRequestedAt?:number;bingeRequestedAt?:number;
}
export const ALCOHOL_REASONS_265=['joy','scheduled','addiction','ordered','binge','inventory'] as const;
export type AlcoholReason265=typeof ALCOHOL_REASONS_265[number];
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const own=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d&&d.enumerable?d:undefined;};
const closed=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>plain(v)&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&keys.includes(k)&&!!own(v,k));
const int=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
const severity=(v:unknown,lo=0,hi=1):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi&&Math.fround(v)===v;
export function validAlcoholHeader265(record:unknown,version:number,human=true):boolean {
 if(!record||typeof record!=='object')return false;
 // The spatial flesh-animal owner also has an active/civil clock. This does
 // not admit alcohol on that owner: the actual alcohol field stays human-only.
 const fleshAnimal=isSchema277OrLater(version)&&isAnimalSpecies(Object.getOwnPropertyDescriptor(record,'body')?.value);
 if(!validMedicalCivilHeader271(record,version,human||fleshAnimal))return false;
 const d=Object.getOwnPropertyDescriptor(record,'alcohol');if(!d)return !('alcohol'in record);
 const tick=own(record,'tick');if(!isSchema265OrLater(version)||!human||!d.enumerable||!('value'in d)||!tick||!int(tick.value)||!Number.isSafeInteger(tick.value*10))return false;
 const a=d.value;if(!closed(a,['bornAt','high','tolerance','hangover','lastDoseTick','dosesToday','addiction','cirrhosis','brainDamage','vomit','vomitRequestedAt','bingeRequestedAt'])||!['bornAt','high','tolerance','hangover','lastDoseTick','dosesToday'].every(k=>!!own(a,k))||!int(a.bornAt,0,tick.value)||!severity(a.high,0,3.4028234663852886e38)||!severity(a.tolerance)||!severity(a.hangover)||!int(a.lastDoseTick,a.bornAt,medicalCivilTick271(record as MedicalRecord))||!int(a.dosesToday,1,6000))return false;
 if(Object.hasOwn(a,'addiction')&&(!closed(a.addiction,['severity','need'])||Reflect.ownKeys(a.addiction).length!==2||!severity(a.addiction.severity,Number.MIN_VALUE)||!severity(a.addiction.need)))return false;
 for(const key of ['cirrhosis','brainDamage'])if(Object.hasOwn(a,key)&&a[key]!==true)return false;
 for(const key of ['vomitRequestedAt','bingeRequestedAt'])if(Object.hasOwn(a,key)&&(!int(a[key],0,medicalCivilTick271(record as MedicalRecord)*10)||Object.hasOwn(record,'death')))return false;
 if(Object.hasOwn(a,'vomit')){
  if(Object.hasOwn(record,'death')||!closed(a.vomit,['remainingCore','cell'])||Reflect.ownKeys(a.vomit).length!==2||!int(a.vomit.remainingCore,1,899)||!closed(a.vomit.cell,['x','z'])||Reflect.ownKeys(a.vomit.cell).length!==2||!int(a.vomit.cell.x)||!int(a.vomit.cell.z))return false;
  for(const key of ['foodPoisoning','flu','cryptosleepSickness','toxicBuildup']){const other=own(record,key);if(other&&plain(other.value)&&Object.hasOwn(other.value,'vomit'))return false;}
  const immune=own(record,'immuneDiseases');if(immune&&plain(immune.value)){const malaria=own(immune.value,'malaria');if(malaria&&plain(malaria.value)&&Object.hasOwn(malaria.value,'vomit'))return false;}
 }
 return true;
}
export const alcoholClinicalActive265=(a:AlcoholState265|undefined):boolean=>!!a&&(a.high>0||a.tolerance>0||a.hangover>0||!!a.addiction);
export function cancelAlcoholSpatial265(record:MedicalRecord):void {const a=record.alcohol;if(a){delete a.vomit;delete a.vomitRequestedAt;delete a.bingeRequestedAt;}}
/** Called after ordinary owner/container shape checks. Includes frozen real
 * dossiers; it never grants a registry or mutates an original during adoption. */
export function validAlcoholWorld265(world:World,version:number=world.schemaVersion):boolean {
 try{
  for(const key of ['drugPolicies','nextDrugPolicyId'])if(key in world&&!own(world,key))return false;
  if(!isSchema265OrLater(version)){if('drugPolicies'in world||'nextDrugPolicyId'in world)return false;}
  else if(('drugPolicies'in world)!==('nextDrugPolicyId'in world)||'drugPolicies'in world&&(world.drugPolicies===undefined||world.nextDrugPolicyId===undefined)||!validDrugPolicyRegistry265(world.drugPolicies,world.nextDrugPolicyId,version))return false;
  const policies=new Set(effectiveDrugPolicies265(world).map(p=>p.id)),seen=new Set<object>();
  for(const capture of campaignPhysicalCaptures(world)){if(capture.world&&!validAlcoholConsumeTransport265(capture.world))return false;for(const slot of capture.owners.pawnOwners){const p=slot.pawn!;if(seen.has(p))continue;seen.add(p);
   const policy=Object.getOwnPropertyDescriptor(p,'drugPolicyId');if(policy?(!isSchema265OrLater(version)||!('value'in policy)||!policy.enumerable||!int(policy.value,1,(world.nextDrugPolicyId??2)-1)||slot.simulation!=='frozen'&&!policies.has(policy.value)):'drugPolicyId'in p)return false;
   if(p.health&&(!validAlcoholHeader265(p.health,version,p.health.body===undefined)||p.health.alcohol&&p.health.alcohol.lastDoseTick>slot.validationTick))return false;
   if(p.health?.alcohol){
    const h=p.health,a=h.alcohol!,spatial=slot.kind==='map'?capture.world:undefined;
    if(medicalCivilTick271(h)>slot.validationTick||validateMedicalRecord(h,true,true,true,true,false,false,true,true,true,true,true,version,version>=127)!==null)return false;
    const status=medicalStatus(h);if(status==='mobile'?(p.state==='downed'||p.state==='dead'):p.state!==status)return false;
    if(!spatial&&(a.vomit||a.vomitRequestedAt!==undefined||a.bingeRequestedAt!==undefined))return false;
    if(a.vomit){const v=a.vomit;if(!spatial||v.cell.x>=spatial.width||v.cell.z>=spatial.height||!['idle','downed'].includes(p.state)||p.path.length||p.moveCooldown>0||!pawnBody(p).canBeAwake||Math.max(Math.abs(v.cell.x-p.x),Math.abs(v.cell.z-p.z))>1||p.need||p.jobId!==null||p.haul||p.cooking||p.research||p.orders.active!==null||p.recreation.task)return false;}
    if(a.vomitRequestedAt!==undefined){const edge=toxicVomitEngagement256(p,slot.validationTick);if(!spatial||!groupPawnInterval256(p.id,a.vomitRequestedAt,600,1)||!edge||edge.startCore>a.vomitRequestedAt||edge.endCore<=slot.validationTick*10||!pawnBody(p).canBeAwake)return false;}
    if(a.bingeRequestedAt!==undefined&&(!spatial||!groupPawnInterval256(p.id,a.bingeRequestedAt,60,1)||a.bingeRequestedAt<(slot.validationTick-1)*10))return false;
   }
   if(hasAlcoholConsumeMarker265(p)&&(slot.simulation!=='local'||!validAlcoholConsumePawnShape265(p,version,capture.world??world)))return false;
   if(!validPenoxycylineIntake337(p,version,capture.world??world,slot.simulation==='local'))return false;
   const tolerance=p.recreation?.tolerance as Record<string,unknown>|undefined,bored=p.recreation?.bored as Record<string,unknown>|undefined;
   if(tolerance&&('chemical'in tolerance||bored&&'chemical'in bored)){
    if(!isSchema265OrLater(version)||!own(tolerance,'chemical')||!bored||!own(bored,'chemical')||typeof tolerance.chemical!=='number'||!Number.isFinite(tolerance.chemical)||tolerance.chemical<0||tolerance.chemical>100||typeof bored.chemical!=='boolean'||tolerance.chemical>50&&!bored.chemical||tolerance.chemical<30&&bored.chemical)return false;
   }
   if(p.mental?.crisis?.kind==='drug-binge'&&!isSchema265OrLater(version))return false;
  }
  }
  // Animals and machines can never acquire this human ingestion mechanism.
  for(const a of world.wildlife?.animals??[])if(a.health&&'alcohol'in a.health||'drugPolicyId'in a)return false;
  for(const a of world.mechanoids??[])if(a.health&&'alcohol'in a.health||'drugPolicyId'in a)return false;
  return true;
 }catch{return false;}
}
