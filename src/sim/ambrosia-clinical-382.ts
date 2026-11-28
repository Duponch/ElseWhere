import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {MoodThought} from './mood.ts';
import type {Pawn} from './types.ts';

/** Independent, genuine Core hediffs already present on a human at load.
 * Ingestion, DrugPolicy and addiction are separate owners; merely holding
 * this state never produces a dose or a fictional last-take receipt. */
export interface AmbrosiaHediff382 {bornAtCore:number;ageCore:number;severity:number}
export interface AmbrosiaClinical382 {high?:AmbrosiaHediff382;tolerance?:AmbrosiaHediff382}
const f=Math.fround;
const changes=Object.freeze({high:f(f(-.75)*f(200/60000)),tolerance:f(f(-.020)*f(200/60000))});
const keys=['high','tolerance'] as const;
function plain(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));}
export function validAmbrosiaClinical382(record:unknown,version:number,human:boolean):boolean {
 if(!record||typeof record!=='object')return false;
 const d=Object.getOwnPropertyDescriptor(record,'ambrosia382');if(!d)return !('ambrosia382'in record);
 if(version<382||!human||!d.enumerable||!Object.hasOwn(d,'value')||!plain(d.value))return false;
 const state=d.value,fields=Object.keys(state);if(!fields.length||fields.some(k=>!keys.includes(k as typeof keys[number])))return false;
 const now=medicalCivilTick271(record as MedicalRecord)*10+9;
 return fields.every(k=>{const h=state[k];return plain(h)&&Object.keys(h).length===3&&Number.isSafeInteger(h.bornAtCore)&&Number(h.bornAtCore)>=0&&Number(h.bornAtCore)<=now&&Number.isSafeInteger(h.ageCore)&&Number(h.ageCore)>=0&&Number(h.ageCore)<=now-Number(h.bornAtCore)+9&&typeof h.severity==='number'&&h.severity>0&&h.severity<=1&&f(h.severity)===h.severity;});
}
/** Called on one actual unsuspended clinical Core tick only. No allocations,
 * global random draws or work on humans without either hediff. */
export function advanceAmbrosiaClinical382(record:MedicalRecord,actorId:number,civilCore:number):void {
 const state=record.ambrosia382;if(!state||record.death)return;
 const due=groupPawnInterval256(actorId,civilCore,200,1);
 for(const key of keys){const h=state[key];if(!h)continue;h.ageCore++;
  if(due){const severity=f(h.severity+changes[key]);if(severity<=0)delete state[key];else h.severity=severity;}
 }
 if(!state.high&&!state.tolerance)delete record.ambrosia382;
}
const highThought: MoodThought=Object.freeze({id:'ambrosia-high',label:'Douceur d’ambroisie',kind:'situation',offset:5,description:'L’effet relaxant est présent tant que l’affection AmbrosiaHigh est active.'});
export const ambrosiaThought382=(pawn:Pawn):MoodThought|undefined=>pawn.health?.ambrosia382?.high?highThought:undefined;
