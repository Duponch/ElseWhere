import {SCHEMA_VERSION} from './types.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {AI_CORE_CONTENT_298,isAiCoreContentSchema298,isAiCoreItem298} from './ai-core-content-298.ts';
import {isShipComputerSensorsKind298,isShipComputerSensorsSchema298,SHIP_COMPUTER_SENSORS_CONTENT_298} from './ship-computer-sensors-content-298.ts';
import {shipComputerSensorsRect298} from './ship-computer-sensors-geometry-298.ts';
import type {World} from './types.ts';

type Data=Record<string,unknown>;
const plain=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const closed=(v:Data,allowed:readonly string[],required:readonly string[])=>Reflect.ownKeys(v).every(k=>typeof k==='string'&&allowed.includes(k)&&!!data(v,k))&&required.every(k=>!!data(v,k));

/** Domain-only: conjoin the existing complete material/owner/ID guard. The
 * physical core may be delivered to a construction job; it is never a recipe. */
export function validAiCorePile298(v:unknown,version:number):boolean {
 if(!integer(version,1,SCHEMA_VERSION)||!plain(v))return false;
 const item=data(v,'item')?.value,kind=data(v,'kind')?.value;
 if(!isAiCoreItem298(item)&&kind!=='ai-core')return true;
 if(!isAiCoreContentSchema298(version)||item!=='ai-core'||kind!=='ai-core')return false;
 return closed(v,['id','kind','item','quantity','owner','damage','forbidden','haulRequested'],['id','kind','item','quantity','owner'])
  &&integer(v.id,1)&&v.quantity===AI_CORE_CONTENT_298.stackLimit&&plain(v.owner)
  &&(!('damage'in v)||integer(v.damage,1,AI_CORE_CONTENT_298.maxHitPoints-1))
  &&(!('forbidden'in v)||v.forbidden===true)&&(!('haulRequested'in v)||v.haulRequested===true);
}

/** Ordinary complete building/job guards remain conjoined. No holder,
 * running component, quality, fuel, switch, breakdown or packed form exists. */
export function validShipComputerSensorsField298(v:unknown,version:number,owner:'installed'|'job'|'packed'='installed'):boolean {
 if(!integer(version,1,SCHEMA_VERSION)||!plain(v))return false;
 const kind=data(v,'kind');if(!kind)return !('kind'in v);
 if(!isShipComputerSensorsKind298(kind.value))return true;
 if(!isShipComputerSensorsSchema298(version)||owner==='packed')return false;
 if(['shipReactor275','shipCryptosleep277','quality','fuel','breakdown','emp','flick','battery'].some(k=>k in v))return false;
 if('orientation'in v&&data(v,'orientation')?.value!==0)return false;
 return owner!=='job'||!('power'in v);
}
type Header298=Pick<World,'width'|'height'|'nextId'>&Partial<Pick<World,'worldFactions'>>;
export function validShipComputerSensorsBuilding298(v:unknown,version:number,w:Header298):boolean {
 if(!validShipComputerSensorsField298(v,version)||!plain(v))return false;
 const kind=data(v,'kind');if(!kind||!isShipComputerSensorsKind298(kind.value))return true;
 if(!closed(v,['id','kind','x','z','orientation','footprint','material','power','damage','factionId'],['id','kind','x','z','orientation','footprint','material','power'])
  ||!integer(w.width,1)||!integer(w.height,1)||!integer(w.nextId,1)
  ||!integer(v.id,1,w.nextId-1)||!integer(v.x,0,w.width-1)||!integer(v.z,0,w.height-1)
  ||v.orientation!==0||v.footprint!=='standard'||v.material!=='steel'
  ||'damage'in v&&!integer(v.damage,1,SHIP_COMPUTER_SENSORS_CONTENT_298[kind.value].maxHitPoints-1)
  ||'factionId'in v&&(!integer(v.factionId,1)||v.factionId!==w.worldFactions?.playerFactionId))return false;
 const power=data(v,'power')?.value;
 if(!plain(power)||!closed(power,['on','parentId'],['on','parentId'])||power.on!==false||power.parentId!==null)return false;
 const r=shipComputerSensorsRect298({x:v.x,z:v.z});return r.x+r.width<=w.width&&r.z+r.depth<=w.height;
}

const tokens=new Set(['escapedShips298','ai-core','ship-computer','ship-sensors','shipComputer','shipSensors','long-range-mineral-scanner','longRangeMineralScanner','lostAiCores298','lostGold298','factionComms298','aiCoreInformation298']);
const domains=['piles','pawns','structures','jobs','packed','stockpiles','research','spoiled','destroyed','deconstructed','apparelPolicies','group','groupLosses','worldGroups','worldPawns','commercialTrip','civilianPost','visitors','raids','trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife','mechanoids','worldFactions','worldSites263','tradeRequests284','linkedStorage286','secondarySite','worldMaps','campaignMap'];
const catalogue=new Set(['kind','project','item','food','recipe','tool']),filters=new Set(['allowed','allowedItems','inputs']);
/** Original RAW/public sparse fence BEFORE migration. Same bounded traversal
 * convention as276/277; never read terrain/resources/planet or grant ownership. */
export function validVictoryContentHistorical298(value:unknown,version:number):boolean {
 if(!integer(version,1,SCHEMA_VERSION))return false;if(isSchema298OrLater(version))return true;
 let remaining=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--remaining<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;active.add(v);
  for(const k of Reflect.ownKeys(v)){
   if(typeof k!=='string'||tokens.has(k)){active.delete(v);return false;}
   const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value')){active.delete(v);return false;}
   if(k==='tiles'||k==='resources'||k==='planet')continue;
   if(catalogue.has(k)&&typeof d.value==='string'&&tokens.has(d.value)){active.delete(v);return false;}
   if(filters.has(k)&&Array.isArray(d.value))for(const key of Reflect.ownKeys(d.value)){
    const field=Object.getOwnPropertyDescriptor(d.value,key);if(!field||!Object.hasOwn(field,'value')||typeof field.value==='string'&&tokens.has(field.value)){active.delete(v);return false;}
   }
   if(!walk(d.value)){active.delete(v);return false;}
  }active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope?!Object.hasOwn(envelope,'value'):'world'in value)return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  if('escapedShips298'in root||root!==value&&'escapedShips298'in value)return false;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d?(!Object.hasOwn(d,'value')||!walk(d.value)):key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs']){const d=Object.getOwnPropertyDescriptor(value,key);if(d?(!Object.hasOwn(d,'value')||!walk(d.value)):key in value)return false;}
  return true;
 }catch{return false;}
}
