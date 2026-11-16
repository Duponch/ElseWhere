import {isMoodPool350} from './mood-pool-memories-350.ts';
import type {World} from './types.ts';

/* Schema 350 psychic drone and soothe (psychic-emanation-350): the condition
 * record, its reading and its strict save shape, in a leaf module. */
export type PsychicLevel350='soothe'|'low'|'moderate'|'high'|'extreme';
export type PsychicKind350='drone'|'soothe';
export interface PsychicEmanation350 {kind:PsychicKind350;level:PsychicLevel350;gender:'male'|'female'|'none';startCore:number;endCore:number}
export const PSYCHIC_DURATION_DAYS_350:Readonly<Record<PsychicKind350,readonly [number,number]>>=Object.freeze({drone:Object.freeze([.75,1.75] as const),soothe:Object.freeze([1.5,3] as const)});
export const PSYCHIC_LEVEL_LABEL_350:Readonly<Record<PsychicLevel350,string>>={soothe:'',low:'faible',moderate:'modéré',high:'fort',extreme:'extrême'};
export const PSYCHIC_GENDER_LABEL_350:Readonly<Record<PsychicEmanation350['gender'],string>>={male:'hommes',female:'femmes',none:'personnes sans genre'};

export const psychicActive350=(w:Pick<World,'tick'|'miscIncidents'>):PsychicEmanation350|undefined=>{
 const c=w.miscIncidents?.psychic350,now=w.tick*10;return c&&now>=c.startCore&&now<c.endCore?c:undefined;
};
export const psychicConditionText350=(c:PsychicEmanation350):{title:string;body:string}=>c.kind==='drone'
 ?{title:`Bourdonnement psychique ${PSYCHIC_LEVEL_LABEL_350[c.level]} (${PSYCHIC_GENDER_LABEL_350[c.gender]})`,body:`Une émission psychique lointaine tourmente les ${PSYCHIC_GENDER_LABEL_350[c.gender]} de cette carte : leur humeur baisse fortement tant qu’elle dure. Surveillez les risques de crise, offrez du confort, de bons repas et des loisirs, et évitez de les pousser à bout.`}
 :{title:`Apaisement psychique (${PSYCHIC_GENDER_LABEL_350[c.gender]})`,body:`Une émission psychique lointaine apaise les ${PSYCHIC_GENDER_LABEL_350[c.gender]} de cette carte : leur humeur monte nettement tant qu’elle dure.`};

/** Strict save shape: counts, last starts and one active condition that
 * began at the last start of its kind. */
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validPsychic350(value:Record<string,unknown>,version:number,tick:number):boolean {
 const keys=['psychicDrones350','psychicSoothes350','lastPsychicDrone350','lastPsychicSoothe350','psychic350'];
 if(!isMoodPool350(version))return keys.every(k=>!(k in value));
 for(const [count,last] of [['psychicDrones350','lastPsychicDrone350'],['psychicSoothes350','lastPsychicSoothe350']] as const){
  if(value[count]===undefined){if(value[last]!==undefined)return false;continue;}
  if(!integer(value[count],1)||!integer(value[last],0,tick))return false;
 }
 const c=value.psychic350;if(c===undefined)return true;
 if(!c||typeof c!=='object'||Array.isArray(c))return false;
 const r=c as Record<string,unknown>;
 if(Object.keys(r).length!==5||!Object.keys(r).every(k=>['kind','level','gender','startCore','endCore'].includes(k))||(r.kind!=='drone'&&r.kind!=='soothe')||!['male','female','none'].includes(String(r.gender)))return false;
 if(r.kind==='soothe'?r.level!=='soothe':!['low','moderate','high'].includes(String(r.level)))return false;
 const last=r.kind==='drone'?value.lastPsychicDrone350:value.lastPsychicSoothe350;
 if(!integer(r.startCore,0)||r.startCore!==Number(last)*10||!integer(r.endCore,tick*10+1))return false;
 const [min,max]=PSYCHIC_DURATION_DAYS_350[r.kind];const duration=Number(r.endCore)-Number(r.startCore);
 return duration>=Math.floor(min*60000)&&duration<=Math.ceil(max*60000);
}
