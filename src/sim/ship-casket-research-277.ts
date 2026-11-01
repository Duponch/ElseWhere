import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {SHIP_CASKET_RESEARCH_POINTS_277} from './ship-casket-content-277.ts';

/** Native ShipCryptosleep, including its hidden Cryptosleep prerequisite. */
export const SHIP_CASKET_RESEARCH_277=Object.freeze({
 project:'ship-cryptosleep' as const,recordKey:'shipCryptosleep' as const,
 label:'Caisson spatial de cryptosommeil',nativeDef:'ShipCryptosleep',
 points:SHIP_CASKET_RESEARCH_POINTS_277,scale:1_000_000,scaledCost:SHIP_CASKET_RESEARCH_POINTS_277*1_000_000,
 prerequisites:Object.freeze(['ship-basics'] as const),hiddenPrerequisites:Object.freeze(['cryptosleep'] as const),
 requiresHighTechBench:true,requiresAnalyzer:true,techLevel:'Spacer' as const,
});
export interface ShipCasketResearchView277 {
 readonly schemaVersion:number;
 readonly research?:{readonly shipBasics?:{readonly completedAt?:number};readonly cryptosleep?:{readonly completedAt?:number};readonly shipCryptosleep?:{readonly points:number;readonly completedAt?:number}};
}
export const isShipCasketResearchProject277=(value:unknown):value is 'ship-cryptosleep'=>value==='ship-cryptosleep';
export const shipCryptosleepUnlocked277=(w:ShipCasketResearchView277):boolean=>isSchema277OrLater(w.schemaVersion)&&w.research?.shipCryptosleep?.completedAt!==undefined;
export const shipCasketResearchPrerequisite277=(w:ShipCasketResearchView277):string|undefined=>w.research?.shipBasics?.completedAt===undefined?'Construction de vaisseau':w.research?.cryptosleep?.completedAt===undefined?'Cryptosommeil':undefined;

type Data=Record<string,unknown>;
const plain=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};

/** Sparse prospective record, shared by RAW and reconstructed public states.
 * False/undefined markers and selection are rejected before277 and after283. */
export function validShipCasketResearchDomain277(state:unknown,version:number,atLocal:number):boolean {
 try{
  if(!int(version,1,301)||!int(atLocal,0,Number.MAX_SAFE_INTEGER))return false;
  if(state===undefined)return true;if(!plain(state))return false;
  const selected=data(state,'project')?.value,hasRecord='shipCryptosleep'in state;
  if(!hasRecord&&selected!=='ship-cryptosleep')return true;
  if(!isSchema277OrLater(version)||!hasRecord)return false;
  const field=data(state,'shipCryptosleep');if(!field||!plain(field.value))return false;
  const progress=field.value,points=data(progress,'points')?.value;
  if(Reflect.ownKeys(progress).some(k=>typeof k!=='string'||(k!=='points'&&k!=='completedAt')||!data(progress,k))||!int(points,0,SHIP_CASKET_RESEARCH_277.scaledCost))return false;
  const basics=data(state,'shipBasics')?.value,crypto=data(state,'cryptosleep')?.value;
  if(!plain(basics)||!plain(crypto))return false;
  const basicsAt=data(basics,'completedAt')?.value,cryptoAt=data(crypto,'completedAt')?.value;
  if(!int(basicsAt,0,atLocal)||!int(cryptoAt,0,atLocal))return false;
  if('completedAt'in progress){
   return int(data(progress,'completedAt')?.value,Math.max(basicsAt,cryptoAt),atLocal)&&points===SHIP_CASKET_RESEARCH_277.scaledCost&&selected!=='ship-cryptosleep';
  }
  return points<SHIP_CASKET_RESEARCH_277.scaledCost;
 }catch{return false;}
}
