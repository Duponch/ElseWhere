import {SCHEMA_VERSION} from './types.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
/** Pure research facts and read-only admission. The shared live service owns
 * station selection and progress; no record is initialized by these readers. */
export const SHIP_ENGINE_RESEARCH_276=Object.freeze({
 project:'ship-engine' as const,recordKey:'shipEngine' as const,label:'Moteur Johnson–Tanaka',nativeDef:'ShipEngine',
 points:6000,scale:1_000_000,scaledCost:6_000_000_000,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze([] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});
export interface ShipEngineProgress276 {readonly points:number;readonly completedAt?:number}
export interface ShipEngineResearchView276 {
 readonly schemaVersion:number;readonly research?:{readonly shipBasics?:{readonly completedAt?:number};readonly shipEngine?:ShipEngineProgress276};
}
export const isShipEngineResearchProject276=(value:unknown):value is 'ship-engine'=>value==='ship-engine';
/** Exact supported prospective version; extend a shared closed family only
 * when a later version is explicitly implemented. Never use >=276. */
export const shipEngineUnlocked276=(view:ShipEngineResearchView276):boolean=>isSchema276OrLater(view.schemaVersion)&&view.research?.shipEngine?.completedAt!==undefined;
export const shipEngineResearchPrerequisite276=(view:ShipEngineResearchView276):string|undefined=>view.research?.shipBasics?.completedAt===undefined?'Construction de vaisseau':undefined;

type RecordData=Record<string,unknown>;
const plain=(v:unknown):v is RecordData=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};

/** Domain-only admission, to be conjoined with the existing complete research
 * guard. Old fields still use their historical guards; false/undefined new
 * markers and selected ship-engine are rejected before276 and after283. */
export function validShipEngineResearchDomain276(state:unknown,version:number,atLocal:number):boolean {
 try{
  if(!int(version,1,SCHEMA_VERSION)||!int(atLocal,0,Number.MAX_SAFE_INTEGER))return false;
  if(state===undefined)return true;
  if(!plain(state))return false;
  const selected=data(state,'project')?.value,hasRecord='shipEngine'in state;
  if(!hasRecord&&selected!=='ship-engine')return true;
  if(!isSchema276OrLater(version)||!hasRecord)return false;
  const field=data(state,'shipEngine');if(!field||!plain(field.value))return false;
  const progress=field.value,keys=Reflect.ownKeys(progress),points=data(progress,'points')?.value;
  if(keys.some(k=>typeof k!=='string'||(k!=='points'&&k!=='completedAt')||!data(progress,k))||!int(points,0,SHIP_ENGINE_RESEARCH_276.scaledCost))return false;
  const parent=data(state,'shipBasics')?.value;
  if(!plain(parent))return false;
  const parentAt=data(parent,'completedAt')?.value;
  if(!int(parentAt,0,atLocal))return false;
  if('completedAt'in progress){
   const completedAt=data(progress,'completedAt')?.value;
   return int(completedAt,parentAt,atLocal)&&points===SHIP_ENGINE_RESEARCH_276.scaledCost&&selected!=='ship-engine';
  }
  return points<SHIP_ENGINE_RESEARCH_276.scaledCost;
 }catch{return false;}
}
