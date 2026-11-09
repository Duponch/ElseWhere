import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
export interface PartyMember292 {pawnId:number;joinedAtCore:number;presentCore:number}
export interface PartyActive292 {
 startedAtCore:number;durationCore:number;advancedAtCore:number;organizerId:number;organizerJoined?:true;
 site:{x:number;z:number};members:PartyMember292[];
}
export interface PartyState292 {
 adoptedAtCore:number;nextCheckCore:number;rng:number;pending:boolean;lastStartedAtCore?:number;active?:PartyActive292;
}
export const partyInteger292=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export const partyPlain292=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
export function partyData292(v:object,key:string):PropertyDescriptor|undefined {const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;}
export function partyKeys292(v:unknown,required:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>{
 return partyPlain292(v)&&required.every(k=>!!partyData292(v,k))&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&!!partyData292(v,k));
}
export function partyDense292(v:unknown):v is unknown[]{return Array.isArray(v)&&v.length<=1_000_000&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>!!partyData292(v,String(i))).every(Boolean);}
export function validPartyState292(value:unknown,version:number,tick:number,width:number,height:number,nextId=Number.MAX_SAFE_INTEGER):value is PartyState292|undefined{
 if(!partyInteger292(version,1,SCHEMA_VERSION)||!partyInteger292(tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10)))return false;
 if(value===undefined)return true;if((version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))||!partyKeys292(value,['adoptedAtCore','nextCheckCore','rng','pending'],['lastStartedAtCore','active']))return false;
 const now=tick*10;
 if(!partyInteger292(value.adoptedAtCore,0,now)||!partyInteger292(value.nextCheckCore,value.adoptedAtCore+1)||!partyInteger292(value.rng,1,0xffffffff)||typeof value.pending!=='boolean')return false;
 if('lastStartedAtCore'in value&&!partyInteger292(value.lastStartedAtCore,value.adoptedAtCore,now))return false;
 if(!('active'in value))return true;
 const a=value.active;if(!partyKeys292(a,['startedAtCore','durationCore','advancedAtCore','organizerId','site','members'],['organizerJoined']))return false;
 if(!partyInteger292(a.startedAtCore,value.adoptedAtCore,now)||a.startedAtCore!==value.lastStartedAtCore||!partyInteger292(a.durationCore,5000,15000)||!partyInteger292(a.advancedAtCore,a.startedAtCore,now)||!partyInteger292(a.organizerId,1,nextId-1)||'organizerJoined'in a&&a.organizerJoined!==true
  ||!partyKeys292(a.site,['x','z'])||!partyInteger292(a.site.x,0,width-1)||!partyInteger292(a.site.z,0,height-1)||!partyDense292(a.members)||a.members.length>=nextId)return false;
 const ids=new Set<number>();for(const m of a.members){if(!partyKeys292(m,['pawnId','joinedAtCore','presentCore'])||!partyInteger292(m.pawnId,1,nextId-1)||ids.has(m.pawnId)||!partyInteger292(m.joinedAtCore,a.startedAtCore,now)||!partyInteger292(m.presentCore,0,Math.max(0,a.advancedAtCore-m.joinedAtCore)))return false;ids.add(m.pawnId);}
 return !ids.has(a.organizerId)||a.organizerJoined===true;
}
export function validPartyField292(owner:unknown,version:number,tick:number,width:number,height:number,nextId=Number.MAX_SAFE_INTEGER):boolean {
 if(!partyPlain292(owner))return false;const d=Object.getOwnPropertyDescriptor(owner,'party292');
 return d?d.enumerable===true&&Object.hasOwn(d,'value')&&d.value!==undefined&&validPartyState292(d.value,version,tick,width,height,nextId):!('party292'in owner)&&validPartyState292(undefined,version,tick,width,height,nextId);
}

/** Existing resource/Thing passes use this scalar; no extra collection walk. */
export function validPartyNonOwner292(value:unknown):boolean {return !!value&&typeof value==='object'&&!['party292','partyMemories292','partyStartedAtCore'].some(key=>key in value);}
