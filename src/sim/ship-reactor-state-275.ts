import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import type {Structure} from './types.ts';

export const SHIP_REACTOR_STARTUP_CORE_275=840000;
/** Absence is native Hibernating. Dates never move after this one activation. */
export interface ShipReactorState275 {state:'starting'|'running';startCore:number;endCore:number}
export type ShipReactor275=Omit<Structure,'kind'>&{kind:'ship-reactor';shipReactor275?:ShipReactorState275};
export interface ShipReactorCommand275 {type:'ship-reactor-start';reactorId:number;reactorIds:number[]}

const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
export const isShipReactor275=(v:unknown):v is ShipReactor275=>!!v&&typeof v==='object'&&data(v,'kind')?.value==='ship-reactor';

/** Native TicksGame is converted to Float32 before addition and Unity's
 * RoundToInt rounds ties to even. Refusing a result beyond int32 is our
 * explicit conservative boundary; native overflow behaviour is unverified. */
export function shipReactorEndCore275(startCore:number):number|undefined {
 if(!integer(startCore,0,2147483647))return;
 const value=Math.fround(Math.fround(startCore)+Math.fround(SHIP_REACTOR_STARTUP_CORE_275)),lower=Math.floor(value),fraction=value-lower;
 const rounded=fraction<.5?lower:fraction>.5?lower+1:lower%2===0?lower:lower+1;
 return integer(rounded,startCore+1,2147483647)?rounded:undefined;
}

export function validShipReactorState275(v:unknown,core:number,version:number=275):v is ShipReactorState275 {
 if(!integer(version,1,300)||!integer(core)||!plain(v)||Reflect.ownKeys(v).length!==3||!['state','startCore','endCore'].every(k=>data(v,k)))return false;
 return integer(v.startCore,0,core)&&(isCorePhysicalSchema297(version)||v.startCore%10===0)&&integer(v.endCore,SHIP_REACTOR_STARTUP_CORE_275)
  &&v.endCore===shipReactorEndCore275(v.startCore)
  &&(v.state==='starting'?core<=v.endCore:v.state==='running'&&core>v.endCore);
}

/** Descriptor-first prospective field fence. Jobs may name the future built
 * kind but never own a running component; minified reactors do not exist. */
export function validShipReactorField275(v:unknown,version:number,core:number,owner:'installed'|'job'|'packed'='installed'):boolean {
 if(!integer(version,1,300)||!integer(core)||!plain(v))return false;
 const kind=data(v,'kind');if(!kind)return owner==='job'&&!('kind'in v)&&!('shipReactor275'in v);
 const has='shipReactor275'in v;
 if(kind.value!=='ship-reactor')return !has;
 if(!isSchema275OrLater(version)||owner==='packed')return false;
 if(owner==='job')return !has;
 if(!has)return true;
 const field=data(v,'shipReactor275');return !!field&&validShipReactorState275(field.value,core,version);
}

export function validShipReactorCommand275(v:unknown,version:number,nextId=Number.MAX_SAFE_INTEGER):v is ShipReactorCommand275 {
 if(!isSchema275OrLater(version)||!integer(nextId,1)||!plain(v)||Reflect.ownKeys(v).length!==3||!['type','reactorId','reactorIds'].every(k=>data(v,k))
  ||v.type!=='ship-reactor-start'||!integer(v.reactorId,1,nextId-1)||!Array.isArray(v.reactorIds)||!v.reactorIds.length||v.reactorIds.length>32768)return false;
 const ids=v.reactorIds;
 if(Object.getPrototypeOf(ids)!==Array.prototype||Reflect.ownKeys(ids).length!==ids.length+1)return false;
 let previous=0;for(let i=0;i<ids.length;i++){const d=data(ids,String(i));if(!d||!integer(d.value,1,nextId-1)||d.value<=previous)return false;previous=d.value;}
 return true;
}
