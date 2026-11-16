import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {startAnimalManhunter} from './animal-manhunter.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {planAnimalDeathExplosion256} from './animal-death-explosion-v256.ts';
import {healthRandom} from './health.ts';
import {scariaRotChance347} from './game-profile.ts';
import {CARAVAN_MANHUNTER_DATA_261} from './caravan-manhunter-data-261.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {carrierOf} from './rescue-state.ts';
import type {LivingTarget} from './combat-target.ts';
import type {MedicalRecord} from './injury-types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {World} from './types.ts';
export interface AnimalScaria261 {manhunterCore:number;deathRot?:boolean}
const passFences=new Set<string>(CARAVAN_MANHUNTER_DATA_261.filter(r=>r.passesFences).map(r=>r.species));
/** Permanent state shares Core Manhunter hostility: humanlikes, machines, and
 * human-faction animals that are not roamers. Wild animals stay non-targets. */
export function permanentManhunterTargets261(w:World):LivingTarget[] {return [...w.pawns.filter(p=>!carrierOf(w,p.id)),...(w.mechanoids??[]),...(w.wildlife?.animals??[]).filter(a=>a.domestic&&passFences.has(a.species)&&!animalCarrier(w,a.id))].filter(a=>a.state!=='dead'&&a.state!=='downed'&&!a.health?.death);}
export function permanentManhunterTarget261(w:World,id:number|undefined):LivingTarget|undefined {
 if(id===undefined)return;const p=w.pawns.find(p=>p.id===id);if(p)return p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!carrierOf(w,p.id)?p:undefined;
 const m=w.mechanoids?.find(m=>m.id===id);if(m)return m.state!=='dead'&&m.state!=='downed'&&!m.health?.death?m:undefined;
 const a=w.wildlife?.animals.find(a=>a.id===id);return a?.domestic&&passFences.has(a.species)&&a.state!=='dead'&&a.state!=='downed'&&!a.health?.death&&!animalCarrier(w,a.id)?a:undefined;
}
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&d.enumerable&&Object.hasOwn(d,'value');});
/** Prospective animal-only clinical field; other records never gain it. */
export function validScariaRecord261(raw:unknown,version:number,animal:boolean):boolean {
 if(!raw||typeof raw!=='object')return false;const d=Object.getOwnPropertyDescriptor(raw,'scaria261');if(!d)return !('scaria261'in raw);
 if((version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))||!animal||!d.enumerable||!Object.hasOwn(d,'value')||!plain(d.value))return false;
 const s=d.value,h=raw as MedicalRecord,keys=Reflect.ownKeys(s);
 return keys.length===(Object.hasOwn(s,'deathRot')?2:1)&&Object.hasOwn(s,'manhunterCore')&&(s.manhunterCore===-999999||typeof s.manhunterCore==='number'&&Number.isSafeInteger(s.manhunterCore)&&s.manhunterCore>=0&&s.manhunterCore<=h.tick*10)&&(h.death?typeof s.deathRot==='boolean':!Object.hasOwn(s,'deathRot'));
}
export function validPermanentManhunter261(a:WildAnimal,version:number):boolean {
 const m=a.manhunter;if(!m)return true;if(typeof m!=='object'||Array.isArray(m))return false;const d=Object.getOwnPropertyDescriptor(m,'permanent261');
 return !d?!('permanent261'in m):(version===261||(Number(version)===262||isSchema263OrLater(Number(version))))&&d.enumerable===true&&Object.hasOwn(d,'value')&&d.value===true&&!!a.health?.scaria261;
}
/** Actual hediff tick only. ClearMind/normal recovery is observed, never undone
 * by reconstructing the previous mental state. Zero keeps native semantics. */
export function advanceScariaRecord261(h:MedicalRecord,core:number,permanent:boolean):void {
 const s=h.scaria261;if(!s||h.death)return;const clinicalCore=core-(medicalCivilTick271(h)-h.tick)*10;
 if(s.manhunterCore<0&&permanent)s.manhunterCore=clinicalCore;
 if(s.manhunterCore>0&&!permanent)s.manhunterCore=-999999;
 if(s.manhunterCore>0&&clinicalCore-s.manhunterCore>300000){h.tick=clinicalCore/10;if(h.civilTick271!==undefined)h.civilTick271=core/10;h.death={tick:core/10,cause:'scaria'};}
}
/** One roll at this SAME original's actual death, never at rendering/reload. */
export function commitScariaDeath261(h:MedicalRecord,chance:number|undefined,draw:()=>number):void {
 const s=h.scaria261;if(!s||!h.death||Object.hasOwn(s,'deathRot'))return;
 if(chance===undefined||!Number.isFinite(chance)||chance<0||chance>1)throw Error('Scaria death requires actual current difficulty rot chance');
 // Rand.Chance: no draw at 0 or below, nor at 1 or above (the Easy difficulty's 0).
 s.deathRot=chance<=0?false:chance>=1?true:draw()<chance;
}
export function advanceAnimalScaria261(w:World,a:WildAnimal):void {
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||!a.health?.scaria261||a.health.death)return;
 const s=a.health.scaria261,permanent=a.manhunter?.permanent261===true;
 if(!(s.manhunterCore>0&&permanent&&(w.tick-(medicalCivilTick271(a.health)-a.health.tick))*10-s.manhunterCore>300000)){advanceScariaRecord261(a.health,w.tick*10,permanent);return;}
 const record=structuredClone(a.health);advanceScariaRecord261(record,w.tick*10,a.manhunter?.permanent261===true);
 if(record.death){const death=planAnimalDeathExplosion256(w,a,record);commitScariaDeath261(record,scariaRotChance347(w),()=>healthRandom(w));death.commit();}
 a.health=record;
}
export function scariaCorpseRot261(h:MedicalRecord|undefined,rot:{progress:number;atTick:number;rate?:number}):typeof rot {return h?.scaria261?.deathRot?{...rot,progress:Math.max(rot.progress,15000)}:rot;}
/** Stage the native post-SpawnSetup AddHediff then mental start against the
 * selected ORIGINAL, without editing it until the map's publication commits. */
export function prepareManhunterSpawn261(w:World,a:WildAnimal,core=w.tick*10):WildAnimal|undefined {
 if(core!==w.tick*10&&!isSchema263OrLater(Number(w.schemaVersion)))return;
 const draft=structuredClone(a),view={...w,wildlife:{...w.wildlife!,animals:[draft]}};
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||!startAnimalManhunter(view,draft,core,true))return;
 draft.health??=createAnimalMedicalRecord256(w,draft);draft.health.scaria261={manhunterCore:-999999};return draft;
}
