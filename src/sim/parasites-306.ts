import {schemaAtLeast} from './schema-range.ts';
import {HP_UNIT} from './injury-rules.ts';
import type {MedicalRecord} from './injury-types.ts';

/* Schema 306: the two Core local infections that the disease incident drew
 * without effect (Disease_GutWorms, Disease_MuscleParasites). Core numbers:
 * - both: +0.2 pain, tendable; a tend lasts 48 hours plus a 3 hour overlap
 *   (Core TendTicksFull) and can be renewed during the last 3 hours, adding
 *   to what remains; the ailment is gone once the qualities of its tends add
 *   up to 3; they cause the sick thought and need no bed rest;
 * - gut worms: hunger falls twice as fast;
 * - muscle parasites: rest falls twice as fast, manipulation and moving -0.3.
 * Adaptation: the gut worms' vomiting (one in a day on average) is not yet
 * represented. */
export const isParasites306=schemaAtLeast(306);
export const PARASITE_KINDS306=['gut-worms','muscle-parasites'] as const;
export type ParasiteKind306=typeof PARASITE_KINDS306[number];
export const isParasiteKind306=(kind:string):kind is ParasiteKind306=>kind==='gut-worms'||kind==='muscle-parasites';
export interface ParasiteState306 {
  bornAt:number;
  /** Sum of the qualities of the tends received, in thousandths. */
  totalTend:number;
  tend?:{quality:number;expiresAtCore:number};
}
export type Parasites306=Partial<Record<ParasiteKind306,ParasiteState306>>;
/** (48 + 3) hours of 2500 Core ticks, and the 3 hour renewal overlap. */
export const PARASITE_TEND_DURATION_CORE306=51*2500,PARASITE_TEND_OVERLAP_CORE306=3*2500;
export const PARASITE_CURE_TOTAL306=3000;
export const PARASITE_LABELS306:Readonly<Record<ParasiteKind306,string>>={'gut-worms':'Vers intestinaux','muscle-parasites':'Parasites musculaires'};

export function parasiteModifiers306(record:Pick<MedicalRecord,'parasites306'>):{pain:number;manipulationOffset:number;movingOffset:number} {
  const p=record.parasites306;if(!p)return NONE;
  let pain=0,manipulationOffset=0,movingOffset=0;
  if(p['gut-worms'])pain+=.2;
  if(p['muscle-parasites']){pain+=.2;manipulationOffset-=.3;movingOffset-=.3;}
  return {pain,manipulationOffset,movingOffset};
}
const NONE=Object.freeze({pain:0,manipulationOffset:0,movingOffset:0});
/** Hunger fall factor: x2 with gut worms. */
export const parasiteHungerFactor306=(record:Pick<MedicalRecord,'parasites306'>|undefined):number=>record?.parasites306?.['gut-worms']?2:1;
/** Rest fall factor: x2 with muscle parasites. */
export const parasiteRestFactor306=(record:Pick<MedicalRecord,'parasites306'>|undefined):number=>record?.parasites306?.['muscle-parasites']?2:1;
export const hasParasites306=(record:Pick<MedicalRecord,'parasites306'>|undefined):boolean=>!!record?.parasites306;

export function parasiteTendable306(record:MedicalRecord,kind:ParasiteKind306):boolean {
  const state=record.parasites306?.[kind];return !!state&&!record.death&&(!state.tend||state.tend.expiresAtCore-record.tick*10<PARASITE_TEND_OVERLAP_CORE306);
}
/** Not life threatening: the same low rank as a minor illness. */
export function parasiteTargets306(record:MedicalRecord):{disease:ParasiteKind306;priority:number;severity:number}[] {
  if(!record.parasites306)return [];
  const out:{disease:ParasiteKind306;priority:number;severity:number}[]=[];
  for(const kind of PARASITE_KINDS306)if(parasiteTendable306(record,kind))out.push({disease:kind,priority:.025,severity:HP_UNIT});
  return out;
}
/** One tend: 51 hours added to what remains, and the ailment ends once the tends add up to 3. */
export function tendParasite306(record:MedicalRecord,kind:ParasiteKind306,quality:number):boolean {
  if(!Number.isSafeInteger(quality)||quality<0||quality>1300)throw new Error('Invalid parasite tending quality');
  const state=record.parasites306?.[kind];if(!state||!parasiteTendable306(record,kind))return false;
  const expiresAtCore=Math.max(record.tick*10,state.tend?.expiresAtCore??0)+PARASITE_TEND_DURATION_CORE306;
  if(!Number.isSafeInteger(expiresAtCore)||!Number.isSafeInteger(state.totalTend+quality))throw new Error('Parasite treatment clock exhausted');
  state.totalTend+=quality;state.tend={quality,expiresAtCore};
  if(state.totalTend>=PARASITE_CURE_TOTAL306){delete record.parasites306![kind];if(!Object.keys(record.parasites306!).length)delete record.parasites306;}
  return true;
}
/** A new case; an existing one of the same kind is not doubled. */
export function acquireParasite306(record:MedicalRecord,kind:ParasiteKind306):boolean {
  if(record.death||record.parasites306?.[kind])return false;
  (record.parasites306??={})[kind]={bornAt:record.tick,totalTend:0};return true;
}
export function validParasites306(value:unknown,version:number,tick:number):boolean {
  if(value===undefined)return true;
  if(!isParasites306(version)||!value||typeof value!=='object'||Array.isArray(value))return false;
  const entries=Object.entries(value as Record<string,unknown>);if(!entries.length)return false;
  for(const [kind,state] of entries){
    if(!(PARASITE_KINDS306 as readonly string[]).includes(kind)||!state||typeof state!=='object'||Array.isArray(state))return false;
    const s=state as Record<string,unknown>;
    if(!Object.keys(s).every(k=>k==='bornAt'||k==='totalTend'||k==='tend')||!Number.isSafeInteger(s.bornAt)||Number(s.bornAt)<0||Number(s.bornAt)>tick)return false;
    if(!Number.isSafeInteger(s.totalTend)||Number(s.totalTend)<0||Number(s.totalTend)>=PARASITE_CURE_TOTAL306)return false;
    if(s.tend!==undefined){
      const t=s.tend as Record<string,unknown>;
      if(!t||typeof t!=='object'||Object.keys(t).length!==2||!Number.isSafeInteger(t.quality)||Number(t.quality)<0||Number(t.quality)>1300||Number(t.quality)>Number(s.totalTend)||!Number.isSafeInteger(t.expiresAtCore)||Number(t.expiresAtCore)<Number(s.bornAt)*10+PARASITE_TEND_DURATION_CORE306||Number(t.expiresAtCore)>tick*10+PARASITE_TEND_DURATION_CORE306+PARASITE_TEND_OVERLAP_CORE306-1)return false;
    }else if(Number(s.totalTend)!==0)return false;
  }
  return true;
}
