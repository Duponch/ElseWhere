import {isSchema288OrLater} from './schema-compatibility-257.ts';
import {captureAnimalAreaOwners287} from './animal-area-owners-287.ts';
import {createAnimalAreaPolicyReader287} from './animal-area-policy-287.ts';
import {animalAreaProtected287} from './animal-area-runtime-287.ts';
import {animalThermalProfile466} from './animal-thermal-v466.ts';
import {animalBody} from './wildlife-health.ts';
import {localWorldGroups,registeredMapForValidation,registeredMapId} from './world-map-context.ts';
import {createAnimalNavigationReader} from './wildlife-navigation.ts';
import type {CampaignState,CampaignSummary} from './world-map-state.ts';
import type {World} from './types.ts';

const FIELD='animalThermalRefuge288';
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const exact=(v:Record<string,unknown>,keys:readonly string[])=>Reflect.ownKeys(v).length===keys.length&&keys.every(k=>!!data(v,k));
const absent=(v:object,k:string)=>!Object.hasOwn(v,k)&&!(k in v);

/** Only a spawned local original can own this prospective job. No getter is evaluated. */
export function validAnimalThermalRefugeField288(value:unknown,version:number,tick:number,width:number,height:number,local=false):boolean {
 try{
  if(!plain(value)||!int(version,1,301))return false;
  if(absent(value,FIELD))return true;
  const d=data(value,FIELD);if(!isSchema288OrLater(version)||!local||!d||!int(tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))||!int(width,1)||!int(height,1))return false;
  const t=d.value;if(!plain(t)||!exact(t,['mapId','target','phase','startedAtCore'])||!int(t.mapId)||!int(t.startedAtCore,0,tick*10)||t.startedAtCore%10!==0||t.phase!=='travel'&&t.phase!=='wait')return false;
  return plain(t.target)&&exact(t.target,['x','z'])&&int(t.target.x,0,width-1)&&int(t.target.z,0,height-1);
 }catch{return false;}
}

const lanes=new Set(['world','dynamic','campaign','wildlife','animals','animal','piles','corpse','worldMaps','sites','map','worldGroups','groups','state','animalOwners','members','animalLosses','items','worldPawns','owners','actor','structures','packed','building','shipCryptosleep277','occupant','cryptosleep','casket','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','startingArrival','pods','pending261','abandonedContents','abandonedPawns','humans','posts','stock','leaders','worldFactions','scout','commercialTrip','groupLosses','secondarySite','group','tradeRequests284','entries','options','legacyTravellers','losses','flyers']);
/** Historical sparse/dynamic packets visit real custody lanes, never terrain grids. */
export function validAnimalThermalRefugeHistoricalTransport288(value:unknown,version:number):boolean {
 if(!int(version,1,301))return false;if(isSchema288OrLater(version))return true;
 const active=new Set<object>();let budget=2_000_000;
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v)||FIELD in v)return false;active.add(v);
  for(const k of Reflect.ownKeys(v)){if(typeof k!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value'))return false;if((Array.isArray(v)||lanes.has(k))&&!walk(d.value))return false;}
  active.delete(v);return true;
 };
 try{return walk(value);}catch{return false;}
}

/** A job survives changing air/severity. Only ownership and physical task context are checked here. */
export function validAnimalThermalRefugeWorld288(input:CampaignState|CampaignSummary):boolean {
 try{
  const w=input as World;if(!validAnimalThermalRefugeHistoricalTransport288(w,Number(w.schemaVersion)))return false;if(!isSchema288OrLater(w.schemaVersion))return true;
  const capture=captureAnimalAreaOwners287(w,{seal:false});if(!capture.valid)return false;
  const maps=new Map<number,World>(),navs=new Map<number,ReturnType<typeof createAnimalNavigationReader>>(),policies=new Map<number,ReturnType<typeof createAnimalAreaPolicyReader287>>(),groupClaims=new Map<number,Set<number>>();
  for(const h of capture.owners){
   if(absent(h.record,FIELD))continue;
   if(!h.spawned||!h.animal||h.mapHeldId===null)return false;
   let actual=maps.get(h.mapHeldId);if(!actual){actual=w.worldMaps?registeredMapForValidation(w,h.mapHeldId):registeredMapId(w)===h.mapHeldId?w:undefined;if(actual)maps.set(h.mapHeldId,actual);}
   if(!actual||!validAnimalThermalRefugeField288(h.record,Number(w.schemaVersion),actual.tick,actual.width,actual.height,true))return false;
   const a=h.animal,t=a.animalThermalRefuge288!;
   const body=animalBody(a);
   if(t.mapId!==h.mapHeldId||!actual.wildlife?.animals.includes(a)||!a.domestic||!a.health||!animalThermalProfile466(a)||animalAreaProtected287(actual,a)||!body.movingCapable||!body.canBeAwake||body.painShock||body.vitalFailure)return false;
   if(!['idle','moving'].includes(a.state)||a.stun||a.sleepUntilCore!==undefined||a.meal||a.animalRest||a.animalAreaReturn287||a.haul&&a.haul.phase!=='holding'||a.eggLay||a.mating||a.predation||a.exiting||a.exitFlight||a.burning||a.flee||a.threat||a.retaliation||a.strike||a.manhunter||a.confusion||a.wander?.job||a.hiveJob||a.shipCryptosleepHeldAt277!==undefined)return false;
   let claims=groupClaims.get(t.mapId);if(!claims){claims=new Set();const groups=new Set([...localWorldGroups(actual).map(row=>row.state),...(actual.group?[actual.group]:[])]);for(const g of groups){if('animalIds'in g)for(const id of g.animalIds??[])claims.add(id);if('manifest'in g)for(const row of g.animalPreparation?.lines??[])claims.add(row.animalId);}groupClaims.set(t.mapId,claims);}if(claims.has(a.id))return false;
   let readPolicy=policies.get(t.mapId);if(!readPolicy){readPolicy=createAnimalAreaPolicyReader287(actual);policies.set(t.mapId,readPolicy);}const policy=readPolicy(a);if(policy&&!policy.has(t.target.z*actual.width+t.target.x))return false;
   let readNav=navs.get(t.mapId);if(!readNav){readNav=createAnimalNavigationReader(actual,undefined,readPolicy);navs.set(t.mapId,readNav);}if(!readNav(a).free(t.target))return false;
   if(t.phase==='wait'){
    if(a.state!=='idle'||a.path.length||(a.motion?.end??0)>actual.tick||a.x!==t.target.x||a.z!==t.target.z)return false;
   }else{
    let previous={x:a.x,z:a.z};for(const cell of a.path){if(!int(cell.x,0,actual.width-1)||!int(cell.z,0,actual.height-1)||Math.max(Math.abs(cell.x-previous.x),Math.abs(cell.z-previous.z))!==1)return false;previous=cell;}
    const end=a.path.at(-1);if(end?end.x!==t.target.x||end.z!==t.target.z:a.x!==t.target.x||a.z!==t.target.z)return false;
   }
  }
  return true;
 }catch{return false;}
}
