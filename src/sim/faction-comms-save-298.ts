import {SCHEMA_VERSION} from './types.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {captureHumanOwners,type HumanOwnershipCapture} from './human-owners.ts';
import {isColonist} from './affiliation.ts';
import {serviceCell} from './service-reservations.ts';
import {registeredMapId} from './world-map-context.ts';
import {validationCore297,effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {consoleSpot298,consoleOtherActivity298,settledConsoleContact298} from './console-service-298.ts';
import type {FactionCommsTask298,AiCoreInformationReceipt298} from './faction-comms-state-298.ts';
import type {Pawn,World} from './types.ts';
type Data=Record<string,unknown>;
const object=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const own=(v:object,key:string):unknown=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable&&Object.hasOwn(d,'value')?d.value as unknown:undefined;};
const closed=(v:Data,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)&&own(v,k)!==undefined);
export function validFactionCommsCommand298(v:unknown,version:number,nextId:number):boolean {
 if(!isSchema298OrLater(version)||!object(v))return false;const type=own(v,'type');
 const keys=type==='cancel-faction-comms'?['type','pawnId']:type==='order-faction-comms'?['type','pawnId','factionId','consoleId']:type==='request-ai-core-information'?['type','pawnId','factionId','consoleId','quote']:null;
 return !!keys&&closed(v,keys)&&integer(own(v,'pawnId'),1,nextId-1)&&(type==='cancel-faction-comms'||integer(own(v,'factionId'),1)&&integer(own(v,'consoleId'),1,nextId-1)&&(type!=='request-ai-core-information'||typeof own(v,'quote')==='string'&&String(own(v,'quote')).length<=512));
}
/** coreNow is the actual caller/holder frontier, never another map's root phase. */
export function validFactionCommsTaskShape298(value:unknown,version:number,tick:number,width:number,height:number,coreNow298?:number):value is FactionCommsTask298 {
 const now=validationCore297(version,tick,coreNow298);
 if(!isSchema298OrLater(version)||!Number.isSafeInteger(now)||!object(value)||!closed(value,['mapId','factionId','consoleId','spot','phase','startedAt','startedAtCore']))return false;
 const spot=own(value,'spot'),started=own(value,'startedAt'),core=own(value,'startedAtCore');
 return integer(own(value,'mapId'))&&integer(own(value,'factionId'),1)&&integer(own(value,'consoleId'),1)&&integer(started,0,tick)&&integer(core,0,now)&&Math.floor(core/10)===started&&(own(value,'phase')==='approach'||own(value,'phase')==='ready')&&object(spot)&&closed(spot,['x','z'])&&integer(own(spot,'x'),0,width-1)&&integer(own(spot,'z'),0,height-1);
}
/** Cheap half in the already-existing Pawn traversal, not a new historic walk. */
export function validFactionCommsPawnFields298(value:unknown,version:number,tick:number,width:number,height:number,coreNow298?:number):boolean {
 if(!object(value)||!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 if(!('factionComms298'in value))return true;
 return validFactionCommsTaskShape298(own(value,'factionComms298'),version,tick,width,height,coreNow298);
}
export function validFactionCommsTransport298(w:World,version:number):boolean {
 return validFactionCommsTransportForSnapshot298(w,version,()=>captureHumanOwners(w));
}
/** @internal Fixed validation consumers only. The caller supplies its real,
 * same-adoption default owner capture; public/RAW callers otherwise recapture.
 * Every off-map absence and local contact guard still runs, with no skip flag. */
export function validFactionCommsTransportForSnapshot298(w:World,version:number,readOwners:()=>HumanOwnershipCapture):boolean {
 try{
  const owners=readOwners();if(owners.slots.some(s=>s.kind!=='map'&&s.pawn&&'factionComms298'in s.pawn))return false;
  const consoles=new Set<number>(),spots=new Set<number>(),core=frontierCore297(w),mapId=w.campaignMap?.revision===2?w.campaignMap.activeMapId:registeredMapId(w);
  for(const p of w.pawns){
   if(!('factionComms298'in p))continue;const task=own(p,'factionComms298');
   if(!validFactionCommsTaskShape298(task,version,w.tick,w.width,w.height,core)||task.mapId!==mapId||!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.draft||p.mental?.crisis||p.interruptedCargo||p.orbitalTrade||consoleOtherActivity298(w,p))return false;
   const faction=w.worldFactions?.factions.find(f=>f.id===task.factionId),console=w.structures.find(s=>s.id===task.consoleId&&s.kind==='comms-console');
   if(!faction||faction.id===w.worldFactions?.playerFactionId||!console)return false;
   const expected=consoleSpot298(console),key=task.spot.z*w.width+task.spot.x;
   if(expected.x!==task.spot.x||expected.z!==task.spot.z||consoles.has(console.id)||spots.has(key))return false;
   if(task.phase==='ready'&&(p.state!=='idle'||!settledConsoleContact298(w,p,task))||task.phase==='approach'&&p.state!=='moving')return false;
   for(const other of w.pawns)if(other!==p){const at=serviceCell(other,w);if(at&&at.x===task.spot.x&&at.z===task.spot.z)return false;}
   consoles.add(console.id);spots.add(key);
  }
  return true;
 }catch{return false;}
}
/** Receipt is history, never a second owner of the core or consumed silver. */
export function validAiCoreInformationReceipt298(site:object,version:number,nextId:number,tick:number,coreNow298?:number):boolean {
 if(!('aiCoreInformation298'in site))return true;
 const v=own(site,'aiCoreInformation298'),now=validationCore297(version,tick,coreNow298);
 if(!isSchema298OrLater(version)||!Number.isSafeInteger(now)||!object(v)||!closed(v,['revision','atCore','mapId','pawnId','factionId','consoleId','cost','silver','coreId']))return false;
 if(own(v,'revision')!==1||own(v,'cost')!==1500||!integer(own(v,'atCore'),0,now)||own(v,'atCore')!==own(site,'createdAtCore')||!integer(own(v,'mapId'))||!integer(own(v,'pawnId'),1,nextId-1)||!integer(own(v,'factionId'),1)||!integer(own(v,'consoleId'),1,nextId-1)||!integer(own(v,'coreId'),1,nextId-1))return false;
 const rows=own(v,'silver');if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||Reflect.ownKeys(rows).length!==rows.length+1||rows.length<1||rows.length>1500)return false;
 let amount=0;const ids=new Set<number>();for(let i=0;i<rows.length;i++){const row=own(rows,String(i));if(!object(row)||!closed(row,['pileId','quantity']))return false;const id=own(row,'pileId'),quantity=own(row,'quantity');if(!integer(id,1,nextId-1)||!integer(quantity,1,1500)||ids.has(id)||id===own(v,'coreId'))return false;ids.add(id);amount+=quantity;}
 return amount===1500;
}
export type InformationSite298={aiCoreInformation298?:AiCoreInformationReceipt298};
export const asFactionCommsPawn298=(p:Pawn):Pawn&{factionComms298?:FactionCommsTask298}=>p;