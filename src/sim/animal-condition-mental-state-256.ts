import type {WildAnimal} from './wildlife-state.ts';
/** Schema 304: the longest idle wander wait a save may hold (2 x 240 ticks
 * plus the 15-tick hash window, animal-idle-wander-304.ts). */
export const ANIMAL_WANDER_WAIT_MAX_CORE304=500;
export interface AnimalWanderState256 {
 revision:1;
 /** Pawn_MindState ctor's CLR default. Reset's true is a different event. */
 nextMoveOrderIsWait:boolean;
 job?:{kind:'wait';untilCore:number}|{kind:'goto';destination:{x:number;z:number}};
}
export interface AnimalConfusion256 {revision:1;ageCore:number}
export type ActualAnimalMind256=WildAnimal&{wander?:AnimalWanderState256;confusion?:AnimalConfusion256};
const data=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d&&d.enumerable===true;};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(v).every(k=>typeof k==='string'&&keys.includes(k)&&data(v,k));
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
/** This call belongs to construction of a NEW original, never migration,
 * entering a map, clinical application, recovery or reading a save. */
export function constructAnimalMind256(a:{growthTracker?:unknown;wander?:AnimalWanderState256;confusion?:AnimalConfusion256},version:number):void {
 if(version<256||!a.growthTracker||Object.hasOwn(a,'wander')||Object.hasOwn(a,'confusion'))throw Error('Animal mind must be constructed once with its original');
 a.wander={revision:1,nextMoveOrderIsWait:false};
}
/** Called on the real job transition, preserving the shared MindState flag. */
export function stopAnimalWanderJob256(a:ActualAnimalMind256):void {if(a.wander)delete a.wander.job;}
export function validAnimalMindFields256(value:Record<string,unknown>,version:number,clock:number,width:number,height:number,local=true):boolean {
 const hd=Object.getOwnPropertyDescriptor(value,'health');
 if(hd&&'value'in hd&&object(hd.value)&&Object.hasOwn(hd.value,'animalAgeConditions')&&!Object.hasOwn(value,'wander'))return false;
 if(!Object.hasOwn(value,'wander')&&!Object.hasOwn(value,'confusion'))return true;
 if(version<256||!Object.hasOwn(value,'growthTracker'))return false;
 if(Object.hasOwn(value,'wander')){
  if(!data(value,'wander')||!object(value.wander))return false;const w=value.wander;
  if(!exact(w,['revision','nextMoveOrderIsWait','job'])||!data(w,'revision')||!data(w,'nextMoveOrderIsWait')||w.revision!==1||typeof w.nextMoveOrderIsWait!=='boolean')return false;
  if(Object.hasOwn(w,'job')){
   if(!local)return false;
   if(!object(w.job))return false;const j=w.job;if(!data(j,'kind'))return false;
   if(j.kind==='wait'){if(!exact(j,['kind','untilCore'])||!data(j,'untilCore')||!integer(j.untilCore,0,Number.MAX_SAFE_INTEGER)||j.untilCore>clock*10+(version>=304?ANIMAL_WANDER_WAIT_MAX_CORE304:200))return false;}
   else if(j.kind==='goto'){
    if(!exact(j,['kind','destination'])||!data(j,'destination')||!object(j.destination)||!exact(j.destination,['x','z'])||!data(j.destination,'x')||!data(j.destination,'z')||!integer(j.destination.x,0,width-1)||!integer(j.destination.z,0,height-1))return false;
   }else return false;
  }
 }
 if(Object.hasOwn(value,'confusion')){
  if(!Object.hasOwn(value,'wander')||!data(value,'confusion')||!object(value.confusion)||!exact(value.confusion,['revision','ageCore'])||!data(value.confusion,'revision')||!data(value.confusion,'ageCore')||value.confusion.revision!==1||!integer(value.confusion.ageCore,0,119999)||value.confusion.ageCore%30!==0||value.state==='dead'||value.state==='downed'||Object.hasOwn(value,'manhunter'))return false;
 }
 return true;
}
