import {isShipCasket277,type ShipCasket277} from './ship-casket-state-277.ts';
import {revokeActorRecordSource297} from './actor-record-source-297.ts';
import {removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import type {Structure} from './types.ts';
import type {ShipEscapeAlias298,ShipEscapeAliasKey298} from './ship-escape-state-298.ts';

const humanKeys=['bedId','bedSlot','mapBed','allowedAreaId','allowedAreaReturn'] as const;
/** Physical departure releases only these local aliases. No clinical, need,
 * skill, faction, family, biological-clock or inventory field is rewritten. */
export function prepareShipEscapeAliases298(parts:readonly Structure[]) {
 const writes:MapRemovalWrite259[]=[],aliases:ShipEscapeAlias298[]=[];
 function put(object:object,actorId:number,target:'actor'|'domestic',key:ShipEscapeAliasKey298,present:boolean,value?:unknown):void {
  const old=Object.getOwnPropertyDescriptor(object,key);
  if(key in object&&!old||old&&!Object.hasOwn(old,'value'))throw Error('Launch alias must be an original own data field');
  aliases.push({actorId,target,key,present:!!old,...old?{value:structuredClone(old.value)}:{}});
  writes.push({object,key,present,...present?{value}:{}});
 }
 for(const c of parts.filter(isShipCasket277)){
  const o=c.shipCryptosleep277.occupant;if(!o)continue;
  if(o.kind==='human')for(const key of humanKeys)put(o.pawn,o.pawn.id,'actor',key,key==='bedId',key==='bedId'?null:undefined);
  else if(o.kind==='animal'){
   put(o.animal,o.animal.id,'actor','mapBed',false);
   if(o.animal.domestic){put(o.animal.domestic,o.animal.id,'domestic','bedId',false);put(o.animal.domestic,o.animal.id,'domestic','penMarkerId',false);}
  }
 }
 const scope={parts:[...parts],aliases},seal=sealRemovalOriginal259(scope,writes,[]);
 let used=false;
 const current=()=>!used&&removalWritesMutable259(writes)&&seal(0);
 const admitted=writes.map(w=>({write:w,descriptor:Object.getOwnPropertyDescriptor(w.object,w.key)}));
 const commitPrepared=()=>{used=true;for(const {write:w,descriptor:d} of admitted){revokeActorRecordSource297(w.object);if(w.present)Object.defineProperty(w.object,w.key,d?{...d,value:w.value}:{value:w.value,writable:true,enumerable:true,configurable:true});else delete (w.object as Record<string,unknown>)[w.key];}};
 return {writes,aliases,current,commitPrepared,commit(){if(!current())throw Error('Launch local-alias sources changed');commitPrepared();}};
}
/** Validation preview only. Actual commit keeps the original casket, occupant,
 * possessions and every unmodified nested clinical object, not these copies. */
export function previewDetachedShipCasket298(c:ShipCasket277):ShipCasket277 {
 const h=c.shipCryptosleep277,o=h.occupant;if(!o||o.kind==='mechanical')return c;
 if(o.kind==='human'){
  const pawn={...o.pawn,bedId:null};for(const key of humanKeys)if(key!=='bedId')delete pawn[key];
  return {...c,shipCryptosleep277:{...h,occupant:{kind:'human',pawn}}};
 }
 const animal={...o.animal};delete animal.mapBed;
 if(animal.domestic){animal.domestic={...animal.domestic};delete animal.domestic.bedId;delete animal.domestic.penMarkerId;}
 return {...c,shipCryptosleep277:{...h,occupant:{kind:'animal',animal}}};
}
