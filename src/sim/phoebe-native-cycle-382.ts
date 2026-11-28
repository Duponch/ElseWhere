import {VerseRand} from './verse-rand.ts';
import {TICKS_PER_DAY} from './types.ts';

/** Core-only campaign source, independently tied to the actual local map.
 * The native cycle is admitted only when the settlement clock starts at zero;
 * relocated colonies need an independent settlement-clock owner. */
export interface NativePhoebeCycle382 {worldRandom:number;mapUniqueId:number}
const signed=(v:unknown):v is number=>Number.isInteger(v)&&Number(v)>=-2147483648&&Number(v)<=2147483647;
export function validNativePhoebeCycle382(value:unknown):value is NativePhoebeCycle382 {
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===2&&signed(v.worldRandom)&&signed(v.mapUniqueId)&&v.mapUniqueId>=0;
}
/** Verse.Gen.HashCombineInt overload with four values, NOT chaining its two
 * argument overload. Core storyteller positions are index 6 for the home
 * big-threat comp and index 8 for the home small-threat comp (Core-only). */
function componentSeed382(source:NativePhoebeCycle382,salt:number,cycle:number):number {
 const mix=(n:number,v:number)=>((n<<5)+n+(n>>27))^v;
 const a=mix(mix(352654597,source.worldRandom),salt),b=mix(mix(352654597,source.mapUniqueId^0xfda252),cycle);
 return (a+Math.imul(b,1566083941))|0;
}
const hitStart=(cycle:number)=>(13+16*cycle)*TICKS_PER_DAY;
export function phoebeCoreBigHit382(source:NativePhoebeCycle382,cycle:number):number {
 const r=new VerseRand(componentSeed382(source,6,cycle));
 // Rand.Range(1,1) consumes no draw; RoundRandom(1) always consumes one.
 void r.value;
 return hitStart(cycle)+100*r.range(0,480);
}
export function phoebeCoreSmallHit382(source:NativePhoebeCycle382,cycle:number):{tick:number;acceptanceDraw:number}|undefined {
 const r=new VerseRand(componentSeed382(source,8,cycle));
 const count=r.rangeFloat(.2,1),rounded=Math.trunc(count)+(r.value<count%1?1:0);
 if(!rounded)return undefined;
 const tick=hitStart(cycle)+100*r.range(0,480);
 return {tick,acceptanceDraw:r.value};
}
