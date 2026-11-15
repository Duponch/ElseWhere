import {schemaAtLeast} from './schema-range.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {ImmuneDiseaseKind} from './immune-diseases-types.ts';

/* Schema 337: Core 1.6 Penoxycyline, its research, its drug lab bills and its
 * scheduled drug policy entry. Facts read from Core Drugs/Penoxycyline.xml,
 * Drugs/DrugBases.xml, ResearchProjects_1.xml, DrugPolicyDefs.xml,
 * WorkGivers.xml and the decompiled DrugPolicy, DrugPolicyEntry,
 * DrugPolicyDatabase, Pawn_DrugPolicyTracker, DrugTakeRecord,
 * JobGiver_TakeDrugsForDrugPolicy, JobDriver_Ingest, ImmunityHandler,
 * IncidentWorker_Disease and HediffComp_SeverityPerDay (facts only).
 *
 * Item Penoxycyline (MakeableDrugPillBase): market value 18, mass 0.005 kg,
 * stack 150, 50 hit points, flammability 0.7, Industrial, drug category
 * Medical, one per ingestion, 100 ingestion ticks, eaten standing
 * (chairSearchRadius 0). Recipe at the DrugLab: 2 neutroamine, WorkToMake
 * 600, Intellectual, no skill requirement, research PenoxycylineProduction,
 * bulk x4 (8 neutroamine, 2400 work). Bills belong to the Crafting work type
 * (DoBillsProduceDrugs). Research PenoxycylineProduction: 500 points,
 * Industrial, after DrugProduction.
 *
 * Hediff PenoxycylineHigh: one dose gives severity 1.0 (maximum 1.0; a dose
 * while it lasts merges back to 1.0); -0.18 per day applied every 200 Core
 * ticks on the pawn's hash interval; removed at 0. Its stage makes the pawn
 * immune to Malaria, SleepingSickness and Plague: the disease contract chance
 * is 0, so a new infection is blocked; an existing one is untouched.
 *
 * Adaptations: the hediff's end is stored as one Core tick of the clinical
 * clock (frozen while the person is suspended, as Core hediffs); after a
 * suspension its 200 tick phase keeps the dose's civil phase (at most 199
 * Core ticks of difference). The CompDrug overdose offset (0.08~0.14) is not
 * represented: this game has no drug overdose yet. */
export const PENOXYCYLINE_SCHEMA_337=337 as const;
export const isPenoxycyline337=schemaAtLeast(PENOXYCYLINE_SCHEMA_337);

export const PENOXYCYLINE_FACTS_337=Object.freeze({
 item:'penoxycyline' as const,label:'Pénoxycyline',baseMarketValue:18,massGrams:5,stackLimit:150,maxHitPoints:50,flammability:.7,
 /** Core baseIngestTicks 100 = ten local ticks of ingestion work. */
 ingestTicks:10,
 research:{project:'penoxycyline-production' as const,recordKey:'penoxycylineProduction' as const,label:'Production de pénoxycyline',points:500,techLevel:'Industrial' as const},
 /** Severity points per 200 Core ticks, as Core computes it in float32. */
 severityPerInterval:Math.fround(Math.fround(-.18)*Math.fround(.0033333334)),
});
export const PENOXYCYLINE_RECIPES_337=Object.freeze(['make-penoxycyline','make-penoxycyline-bulk'] as const);
export type PenoxycylineRecipe337=typeof PENOXYCYLINE_RECIPES_337[number];
export const isPenoxycylineRecipe337=(v:unknown):v is PenoxycylineRecipe337=>v==='make-penoxycyline'||v==='make-penoxycyline-bulk';
/** Local work ticks are Core WorkToMake / 10. */
export const PENOXYCYLINE_RECIPE_FACTS_337:Readonly<Record<PenoxycylineRecipe337,{label:string;neutroamine:number;workTicks:number;outputUnits:number}>>=Object.freeze({
 'make-penoxycyline':Object.freeze({label:'Fabriquer de la pénoxycyline',neutroamine:2,workTicks:60,outputUnits:1}),
 'make-penoxycyline-bulk':Object.freeze({label:'Fabriquer de la pénoxycyline x4',neutroamine:8,workTicks:240,outputUnits:4}),
});
export const PENOXYCYLINE_IMMUNE_TO_337:readonly ImmuneDiseaseKind[]=Object.freeze(['malaria','sleeping-sickness','plague']);

/** Number of 200 tick decrements that bring severity 1.0 to 0 (Core float32). */
export const PENOXYCYLINE_DECREMENTS_337=(():number=>{let s=Math.fround(1),k=0;while(s>0){s=Math.fround(s+PENOXYCYLINE_FACTS_337.severityPerInterval);k++;}return k;})();
const SPAN_MIN=(PENOXYCYLINE_DECREMENTS_337-1)*200+1,SPAN_MAX=PENOXYCYLINE_DECREMENTS_337*200;

/** Core DrugTakeRecord plus the PenoxycylineHigh hediff end, on the clinical
 * clock (record.tick units x 10). The record stays after the effect ends, as
 * Core's take record, so a later schedule counts from the actual last dose. */
export interface PenoxycylineState337 {
 /** Clinical Core tick of the last dose. */
 lastDoseCore:number;
 /** Doses taken on the civil day of the last dose (TimesTakenThisDay). */
 dosesToday:number;
 /** Clinical Core tick at which PenoxycylineHigh is removed. */
 untilCore:number;
}
const own=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d&&d.enumerable?d.value:undefined;};
const int=(v:unknown,lo=0,hi=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo&&v<=hi;
export function validPenoxycylineState337(value:unknown,version:number,record:{tick:number}):boolean {
 if(value===undefined)return true;
 if(!isPenoxycyline337(version)||!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const keys=Reflect.ownKeys(value);
 if(keys.length!==3||!['lastDoseCore','dosesToday','untilCore'].every(k=>keys.includes(k)&&own(value,k)!==undefined))return false;
 const last=own(value,'lastDoseCore'),doses=own(value,'dosesToday'),until=own(value,'untilCore');
 if(!int(record.tick)||!Number.isSafeInteger(record.tick*10)||!int(last,0,record.tick*10)||!int(doses,1,10_000)||!int(until))return false;
 return until-last>=SPAN_MIN&&until-last<=SPAN_MAX;
}

/** The clinical Core tick of an active owner at the civil tick `civil`. */
const clinicalCoreAt=(record:MedicalRecord,civil:number):number=>(record.tick+Math.max(0,civil-medicalCivilTick271(record)))*10;
/** Core HediffStage.makeImmuneTo: the hediff exists until its removal tick. */
export function penoxycylineActive337(record:MedicalRecord|undefined,civilTick:number):boolean {
 const p=record?.penoxycyline337;return !!p&&!record!.death&&p.untilCore>clinicalCoreAt(record!,civilTick);
}
export const penoxycylineImmuneTo337=(record:MedicalRecord|undefined,civilTick:number,disease:ImmuneDiseaseKind):boolean=>
 PENOXYCYLINE_IMMUNE_TO_337.includes(disease)&&penoxycylineActive337(record,civilTick);
/** Core shows the hours to recover: severity / 0.18 x 24. */
export function penoxycylineHoursLeft337(record:MedicalRecord|undefined,civilTick:number):number {
 const p=record?.penoxycyline337;if(!p)return 0;
 return Math.max(0,Math.round((p.untilCore-clinicalCoreAt(record!,civilTick))/2500));
}

/** One real dose has already left its holder at the ingestion contact. The
 * record is at its actual frontier: severity returns to 1.0, the end is the
 * last of the 200 tick decrements counted from the next hashed Core tick. */
export function applyPenoxycylineDose337(record:MedicalRecord,pawnId:number,worldTick:number):PenoxycylineState337 {
 if(record.body!==undefined||record.death||!int(worldTick)||worldTick!==medicalCivilTick271(record)||!Number.isSafeInteger(worldTick*10))throw Error('Penoxycyline requires its actual living human clinical owner');
 const civilCore=worldTick*10,clinicalCore=record.tick*10;
 let first=civilCore+1;while(!groupPawnInterval256(pawnId,first,200,1))first++;
 const untilCore=clinicalCore+(first-civilCore)+(PENOXYCYLINE_DECREMENTS_337-1)*200;
 const previous=record.penoxycyline337,day=Math.floor(worldTick/6000);
 const previousDay=previous?Math.floor((previous.lastDoseCore/10+(medicalCivilTick271(record)-record.tick))/6000):-1;
 const state:PenoxycylineState337={lastDoseCore:clinicalCore,dosesToday:previous&&previousDay===day?Math.min(10_000,previous.dosesToday+1):1,untilCore};
 record.penoxycyline337=state;return state;
}

/** Core DrugPolicyEntry for this medical, non addictive, non pleasure drug:
 * the policy UI only offers scheduling, its frequency and the two thresholds.
 * Core's default policies keep it unscheduled every 1 day (no def entry). The
 * "keep in inventory" amount is not represented for this drug. */
export interface PenoxycylinePolicy337 {allowScheduled:boolean;daysFrequency:number;onlyIfMoodBelow:number;onlyIfJoyBelow:number}
export const DEFAULT_PENOXYCYLINE_POLICY_337:Readonly<PenoxycylinePolicy337>=Object.freeze({allowScheduled:false,daysFrequency:1,onlyIfMoodBelow:1,onlyIfJoyBelow:1});
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function validPenoxycylinePolicy337(v:unknown):v is PenoxycylinePolicy337 {
 if(!plain(v))return false;const keys=Reflect.ownKeys(v);
 return keys.length===4&&['allowScheduled','daysFrequency','onlyIfMoodBelow','onlyIfJoyBelow'].every(k=>keys.includes(k)&&own(v,k)!==undefined)
  &&typeof v.allowScheduled==='boolean'&&typeof v.daysFrequency==='number'&&Number.isFinite(v.daysFrequency)&&v.daysFrequency>=.1&&v.daysFrequency<=25
  &&[v.onlyIfMoodBelow,v.onlyIfJoyBelow].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=.01&&n<=1);
}

/** Mathf.RoundToInt: round half to even. */
const roundToInt=(v:number):number=>{const f=Math.floor(v),d=v-f;return d===.5?(f%2===0?f:f+1):Math.round(v);};
/** Same stable per-day appointment as scheduled beer: it replaces Core's
 * temporary Rand seeded by (DaysPassed, thingIDNumber) without touching any
 * gameplay stream. The day percent is the plain day fraction (as beer). */
function appointment(pawnId:number,day:number):number {
 let bits=(Math.imul(pawnId,0x9e3779b1)^Math.imul(day+1,0x85ebca6b))>>>0;bits^=bits<<13;bits^=bits>>>17;bits^=bits<<5;
 return .1+(bits>>>0)/0x100000000*.25;
}
/** Core AllowedToTakeScheduledNow then ShouldTryToTakeScheduledNow, for a
 * spawned colonist whose take record is `record.penoxycyline337`. */
export function scheduledPenoxycylineDue337(worldTick:number,pawn:{id:number;mood:number;recreation:{level:number};health?:MedicalRecord},e:PenoxycylinePolicy337):boolean {
 if(!e.allowScheduled)return false;
 if(e.onlyIfMoodBelow<1&&pawn.mood>=e.onlyIfMoodBelow*100||e.onlyIfJoyBelow<1&&pawn.recreation.level>=e.onlyIfJoyBelow*100)return false;
 const r=pawn.health?.penoxycyline337;if(!r)return true;
 const day=Math.floor(worldTick/6000),lastTick=r.lastDoseCore/10+(medicalCivilTick271(pawn.health!)-pawn.health!.tick),lastDay=Math.floor(lastTick/6000);
 const today=lastDay===day?r.dosesToday:0,dayPercent=(worldTick%6000)/6000;
 if(e.daysFrequency<1){
  const times=roundToInt(1/e.daysFrequency);if(today>=times)return false;
  const step=1/(times+1);let due=0;for(let i=0;i<times;i++)if(dayPercent>(i+1)*step-step*.5)due++;
  if(today>=due)return false;
  // HoursPerDayNotSleeping x 2500 Core ticks: the full day here (as beer).
  return today===0||(worldTick-lastTick)*10/(24*2500)>=.6*step;
 }
 if(Math.abs(day-lastDay)<roundToInt(e.daysFrequency))return false;
 return dayPercent>=appointment(pawn.id,day);
}
