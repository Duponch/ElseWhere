import {schemaAtLeast} from './schema-range.ts';
import {HP_UNIT} from './injury-rules.ts';
import type {MedicalRecord} from './injury-types.ts';

/* Schema 307: the two Core mechanite diseases (Disease_FibrousMechanites,
 * Disease_SensoryMechanites) that the disease incident drew without effect.
 * Core numbers (MechanitesBase and the two defs):
 * - severity starts at 0.001, rises 0.25 a day, and a tend of quality q
 *   lowers it by q a day for 48 hours plus a 3 hour overlap, renewable in
 *   the last 3 hours (Core TendTicksFull); it never drops below 0.001 and never
 *   exceeds 1; the mechanites leave by themselves after 15 to 30 days;
 * - stage one (below 0.5): +0.2 pain, rest falls 1.7 times as fast;
 *   stage two: +0.6 pain, rest falls twice as fast;
 * - fibrous: manipulation, moving and blood pumping +50 points;
 *   sensory: sight, hearing and talking +50 points, manipulation +30;
 * - they cause the sick thought; there is no immunity gain.
 * Severity unit: 24,000,000 per 1.0, so that one local tick (10 Core ticks)
 * moves it by exactly 1000 - 4q units (q in thousandths). */
export const isMechanites307=schemaAtLeast(307);
export const MECHANITE_KINDS307=['fibrous-mechanites','sensory-mechanites'] as const;
export type MechaniteKind307=typeof MECHANITE_KINDS307[number];
export const isMechaniteKind307=(kind:string):kind is MechaniteKind307=>kind==='fibrous-mechanites'||kind==='sensory-mechanites';
export const MECHANITE_UNIT307=24_000_000;
export const MECHANITE_MIN307=24_000,MECHANITE_STAGE_TWO307=12_000_000;
export const MECHANITE_TEND_DURATION_CORE307=51*2500,MECHANITE_TEND_OVERLAP_CORE307=3*2500;
export const MECHANITE_DISAPPEAR_MIN_CORE307=900_000,MECHANITE_DISAPPEAR_MAX_CORE307=1_800_000;
export const MECHANITE_LABELS307:Readonly<Record<MechaniteKind307,string>>={'fibrous-mechanites':'Mécanites fibreuses','sensory-mechanites':'Mécanites sensorielles'};
export interface MechaniteState307 {
  bornAt:number;
  /** Units of MECHANITE_UNIT307. */
  severity:number;
  disappearsAtCore:number;
  tend?:{quality:number;expiresAtCore:number};
}
export type Mechanites307=Partial<Record<MechaniteKind307,MechaniteState307>>;

export interface MechaniteModifiers307 {pain:number;restOffset:number;manipulationOffset:number;movingOffset:number;bloodPumpingOffset:number;sightOffset:number;hearingOffset:number;talkingOffset:number}
const NONE:MechaniteModifiers307=Object.freeze({pain:0,restOffset:0,manipulationOffset:0,movingOffset:0,bloodPumpingOffset:0,sightOffset:0,hearingOffset:0,talkingOffset:0});
export function mechaniteModifiers307(record:Pick<MedicalRecord,'mechanites307'>|undefined):MechaniteModifiers307 {
  const m=record?.mechanites307;if(!m)return NONE;
  const out={...NONE};
  for(const kind of MECHANITE_KINDS307){
    const state=m[kind];if(!state)continue;
    const two=state.severity>=MECHANITE_STAGE_TWO307;
    out.pain+=two?.6:.2;out.restOffset+=two?1:.7;
    if(kind==='fibrous-mechanites'){out.manipulationOffset+=.5;out.movingOffset+=.5;out.bloodPumpingOffset+=.5;}
    else{out.sightOffset+=.5;out.hearingOffset+=.5;out.talkingOffset+=.5;out.manipulationOffset+=.3;}
  }
  return out;
}
export const mechaniteTendable307=(record:MedicalRecord,kind:MechaniteKind307):boolean=>{
  const state=record.mechanites307?.[kind];return !!state&&!record.death&&(!state.tend||state.tend.expiresAtCore-record.tick*10<MECHANITE_TEND_OVERLAP_CORE307);
};
export function mechaniteTargets307(record:MedicalRecord):{disease:MechaniteKind307;priority:number;severity:number}[] {
  if(!record.mechanites307)return [];
  const out:{disease:MechaniteKind307;priority:number;severity:number}[]=[];
  for(const kind of MECHANITE_KINDS307)if(mechaniteTendable307(record,kind))out.push({disease:kind,priority:.025,severity:Math.round(record.mechanites307[kind]!.severity/MECHANITE_UNIT307*HP_UNIT)});
  return out;
}
export function tendMechanite307(record:MedicalRecord,kind:MechaniteKind307,quality:number):boolean {
  if(!Number.isSafeInteger(quality)||quality<0||quality>1300)throw new Error('Invalid mechanite tending quality');
  const state=record.mechanites307?.[kind];if(!state||!mechaniteTendable307(record,kind))return false;
  const expiresAtCore=Math.max(record.tick*10,state.tend?.expiresAtCore??0)+MECHANITE_TEND_DURATION_CORE307;
  if(!Number.isSafeInteger(expiresAtCore))throw new Error('Mechanite treatment clock exhausted');
  state.tend={quality,expiresAtCore};return true;
}
/** random: a value in [0,1) drawn by the caller's stream for the 15-30 day lifetime. */
export function acquireMechanite307(record:MedicalRecord,kind:MechaniteKind307,random:number):boolean {
  if(record.death||record.mechanites307?.[kind])return false;
  const life=MECHANITE_DISAPPEAR_MIN_CORE307+Math.floor(random*(MECHANITE_DISAPPEAR_MAX_CORE307-MECHANITE_DISAPPEAR_MIN_CORE307+1));
  (record.mechanites307??={})[kind]={bornAt:record.tick,severity:MECHANITE_MIN307,disappearsAtCore:record.tick*10+life};return true;
}
/** One local tick of 10 Core ticks, after record.tick moved to the new tick. */
export function advanceMechanites307(record:MedicalRecord):void {
  const m=record.mechanites307;if(!m)return;
  const now=record.tick*10;
  for(const kind of MECHANITE_KINDS307){
    const state=m[kind];if(!state)continue;
    if(now>=state.disappearsAtCore){delete m[kind];continue;}
    const tended=state.tend&&state.tend.expiresAtCore>now-10?state.tend.quality:0;
    state.severity=Math.max(MECHANITE_MIN307,Math.min(MECHANITE_UNIT307,state.severity+1000-4*tended));
    if(state.tend&&state.tend.expiresAtCore<=now)delete state.tend;
  }
  if(!Object.keys(m).length)delete record.mechanites307;
}
export function validMechanites307(value:unknown,version:number,tick:number):boolean {
  if(value===undefined)return true;
  if(!isMechanites307(version)||!value||typeof value!=='object'||Array.isArray(value))return false;
  const entries=Object.entries(value as Record<string,unknown>);if(!entries.length)return false;
  for(const [kind,state] of entries){
    if(!isMechaniteKind307(kind)||!state||typeof state!=='object'||Array.isArray(state))return false;
    const s=state as Record<string,unknown>;
    if(!Object.keys(s).every(k=>k==='bornAt'||k==='severity'||k==='disappearsAtCore'||k==='tend'))return false;
    if(!Number.isSafeInteger(s.bornAt)||Number(s.bornAt)<0||Number(s.bornAt)>tick)return false;
    if(!Number.isSafeInteger(s.severity)||Number(s.severity)<MECHANITE_MIN307||Number(s.severity)>MECHANITE_UNIT307)return false;
    const life=Number(s.disappearsAtCore)-Number(s.bornAt)*10;
    if(!Number.isSafeInteger(s.disappearsAtCore)||life<MECHANITE_DISAPPEAR_MIN_CORE307||life>MECHANITE_DISAPPEAR_MAX_CORE307||Number(s.disappearsAtCore)<=tick*10)return false;
    if(s.tend!==undefined){
      const t=s.tend as Record<string,unknown>;
      if(!t||typeof t!=='object'||Object.keys(t).length!==2||!Number.isSafeInteger(t.quality)||Number(t.quality)<0||Number(t.quality)>1300
        ||!Number.isSafeInteger(t.expiresAtCore)||Number(t.expiresAtCore)<=tick*10||Number(t.expiresAtCore)>tick*10+MECHANITE_TEND_DURATION_CORE307+MECHANITE_TEND_OVERLAP_CORE307-1)return false;
    }
  }
  return true;
}
