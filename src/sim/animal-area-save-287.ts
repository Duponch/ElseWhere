import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {registeredMapForValidation} from './world-map-context.ts';
import {animalNavigation} from './wildlife-navigation.ts';
import {supportsAnimalAreas287,animalAreaEffective287} from './animal-area-policy-287.ts';
import {animalAreaProtected287} from './animal-area-runtime-287.ts';
import type {CampaignState,CampaignSummary} from './world-map-state.ts';
import {captureAnimalAreaOwners287} from './animal-area-owners-287.ts';
import {captureAnimalAreaReferences287,type AnimalAreaReferences287} from './animal-area-references-287.ts';
import {readAnimalAreaChoice287} from './animal-area-state-287.ts';
import type {AnimalAreaChoice287,AnimalAreaHolder287} from './animal-area-state-287.ts';
import type {World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>!!data(v,k));
const absent=(v:object,k:string)=>!Object.hasOwn(v,k)&&!(k in v);
export function validAnimalAreaChoice287(value:unknown,nextId=Number.MAX_SAFE_INTEGER):value is AnimalAreaChoice287 {
 if(!plain(value))return false;const kind=data(value,'kind');if(!kind)return false;
 return kind.value==='home'?exact(value,['kind']):kind.value==='allowed'&&exact(value,['kind','areaId'])&&int(data(value,'areaId')!.value,1,nextId-1);
}
/** Only the two prospective fields. A corpse/detached holder never owns Goto. */
export function validAnimalAreaField287(value:unknown,version:number,nextId:number,local=false):boolean {
 try{
  if(!plain(value)||!int(version,1,301)||!int(nextId,1))return false;
  for(const key of ['animalMapAreas287','animalAreaReturn287'])if(!absent(value,key)&&(!data(value,key)||!isSchema287OrLater(version)))return false;
  const field=data(value,'animalMapAreas287');if(field){const v=field.value;if(!plain(v)||!exact(v,['revision','assignments'])||v.revision!==1||!Array.isArray(v.assignments)||Object.getPrototypeOf(v.assignments)!==Array.prototype||v.assignments.length>nextId||Reflect.ownKeys(v.assignments).length!==v.assignments.length+1)return false;const maps=new Set<number>();for(let i=0;i<v.assignments.length;i++){const d=data(v.assignments,String(i)),r=d?.value;if(!plain(r)||!exact(r,['mapId','choice'])||!int(r.mapId)||maps.has(r.mapId)||!validAnimalAreaChoice287(r.choice,nextId))return false;maps.add(r.mapId);}}
  const back=data(value,'animalAreaReturn287');if(back){const v=back.value;if(!local||!field||!plain(v)||!exact(v,['mapId','target'])||!int(v.mapId)||!plain(v.target)||!exact(v.target,['x','z'])||!int(v.target.x)||!int(v.target.z))return false;}
  return true;
 }catch{return false;}
}
export function validAnimalAreaBindings287(value:AnimalAreaHolder287,refs:AnimalAreaReferences287):boolean {
 return (value.animalMapAreas287?.assignments??[]).every(row=>refs.has(row.mapId)&&(row.choice.kind==='home'||refs.get(row.mapId)!.has(row.choice.areaId)));
}
const lanes=new Set(['world','dynamic','campaign','wildlife','animals','animal','piles','corpse','worldMaps','sites','map','worldGroups','groups','state','animalOwners','members','animalLosses','items','worldPawns','owners','actor','structures','packed','building','shipCryptosleep277','occupant','cryptosleep','casket','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','startingArrival','pods','pending261','abandonedContents','abandonedPawns','humans','posts','stock','leaders','worldFactions','scout','commercialTrip','groupLosses','secondarySite','group','tradeRequests284','entries','options','legacyTravellers','losses']);
/** Historical sparse/dynamic fences visit known custody lanes, never grids. */
export function validAnimalAreaHistoricalTransport287(value:unknown,version:number):boolean {
 if(!int(version,1,301))return false;if(isSchema287OrLater(version))return true;const active=new Set<object>();let budget=2_000_000;
 const walk=(v:unknown):boolean=>{if(--budget<0)return false;if(v===null||typeof v!=='object')return true;if(active.has(v)||!Array.isArray(v)&&!plain(v)||'animalMapAreas287'in v||'animalAreaReturn287'in v)return false;active.add(v);for(const k of Reflect.ownKeys(v)){if(typeof k!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value'))return false;if((Array.isArray(v)||lanes.has(k))&&!walk(d.value))return false;}active.delete(v);return true;};
 try{return walk(value);}catch{return false;}
}
/** FK and return context only, separate from existing anatomy/owner guards. */
export function validAnimalAreaWorld287(input:CampaignState|CampaignSummary):boolean {
 const w=input as World;
 try{
  if(!validAnimalAreaHistoricalTransport287(w,w.schemaVersion))return false;if(!isSchema287OrLater(w.schemaVersion))return true;
  const refs=captureAnimalAreaReferences287(w),capture=captureAnimalAreaOwners287(w,{seal:false}),maps=new Map<number,World>(),navs=new Map<number,ReturnType<typeof animalNavigation>>();if(!refs||!capture.valid)return false;
  for(const h of capture.owners){if(!validAnimalAreaField287(h.record,w.schemaVersion,w.nextId,h.spawned)||!validAnimalAreaBindings287(h.record,refs))return false;const a=h.animal,t=a?.animalAreaReturn287;if(!t)continue;
   if(!h.spawned||h.mapHeldId!==t.mapId||!a?.domestic||!supportsAnimalAreas287(a.species)||a.stun||a.sleepUntilCore||['dead','downed','sleeping','eating'].includes(a.state)||a.health?.death)return false;
   if(a.haul||a.meal||a.animalRest||a.eggLay||a.mating||a.predation||a.exiting||a.flight||a.exitFlight||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.manhunter||a.confusion||a.wander?.job||a.hiveJob||a.shipCryptosleepHeldAt277!==undefined||a.animalThermalRefuge288)return false;
   const choice=readAnimalAreaChoice287(a,t.mapId);if(!choice)return false;
   // Only a present map needs cells; remote dormant rows use scalar FK proof.
   let actual=maps.get(t.mapId);if(!actual){actual=w.worldMaps?registeredMapForValidation(w,t.mapId):w;if(actual)maps.set(t.mapId,actual);}
   if(!actual||animalAreaProtected287(actual,a)||!animalAreaEffective287(actual,a))return false;const cells=choice.kind==='home'?actual.home:actual.allowedAreas?.find(r=>r.id===choice.areaId)?.cells;
   if(!cells?.length||!cells.includes(t.target.z*actual.width+t.target.x)||t.target.x>=actual.width||t.target.z>=actual.height)return false;
   let nav=navs.get(t.mapId);if(!nav){nav=animalNavigation(actual);navs.set(t.mapId,nav);}if(!nav.free(t.target))return false;
   const end=a.path.at(-1);if(end?end.x!==t.target.x||end.z!==t.target.z:a.x!==t.target.x||a.z!==t.target.z)return false;
  }
  return true;
 }catch{return false;}
}
