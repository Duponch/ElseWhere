import {SCHEMA_VERSION} from './types.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {isShipAddedKind276,SHIP_ADDED_CONTENT_276} from './ship-part-content-276.ts';
import {shipPartRect276} from './ship-part-geometry-276.ts';
import type {World} from './types.ts';

type Data=Record<string,unknown>;
const plain=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
type ShapeHeader276=Pick<World,'width'|'height'|'nextId'>&Partial<Pick<World,'worldFactions'>>;

/** Descriptor-first sparse fence. A hull part has no running component and
 * cannot be carried as minified furniture. Ordinary shapes keep their guards. */
export function validShipHullField276(v:unknown,version:number,owner:'installed'|'job'|'packed'='installed'):boolean {
 if(!integer(version,1,SCHEMA_VERSION)||!plain(v))return false;
 const kind=data(v,'kind');if(!kind)return !('kind'in v);
 if(!isShipAddedKind276(kind.value))return true;
 if(!isSchema276OrLater(version)||owner==='packed')return false;
 if(['shipReactor275','quality','fuel','breakdown','emp','flick','battery'].some(key=>key in v))return false;
 return owner!=='job'||!('power'in v);
}

/** Complete new installed shape, conjoined with the normal owner, terrain,
 * namespace and overlap guards. Existing pieces need no research record. */
export function validShipHullBuilding276(v:unknown,version:number,w:ShapeHeader276):boolean {
 if(!validShipHullField276(v,version)||!plain(v))return false;
 const kind=data(v,'kind');if(!kind||!isShipAddedKind276(kind.value))return true;
 const allowed=['id','kind','x','z','orientation','footprint','material','power','damage','factionId'];
 if(Reflect.ownKeys(v).some(key=>typeof key!=='string'||!allowed.includes(key)||!data(v,key))
  ||!['id','kind','x','z','orientation','footprint','material','power'].every(key=>data(v,key))
  ||!integer(w.width,1)||!integer(w.height,1)||!integer(w.nextId,1)
  ||!integer(v.id,1,w.nextId-1)||!integer(v.x,0,w.width-1)||!integer(v.z,0,w.height-1)||!integer(v.orientation,0,3)
  ||v.footprint!=='standard'||v.material!=='steel'||'damage'in v&&!integer(v.damage,1,SHIP_ADDED_CONTENT_276[kind.value].maxHitPoints-1)
  ||'factionId'in v&&(!integer(v.factionId,1)||v.factionId!==w.worldFactions?.playerFactionId))return false;
 const power=data(v,'power')?.value;
 if(!plain(power)||Reflect.ownKeys(power).length!==2||!data(power,'on')||!data(power,'parentId')||power.on!==false||power.parentId!==null)return false;
 const r=shipPartRect276({kind:kind.value,x:v.x,z:v.z,orientation:v.orientation as 0|1|2|3});
 return r.x>=0&&r.z>=0&&r.x+r.width<=w.width&&r.z+r.depth<=w.height;
}

const tokens276=new Set(['ship-beam','ship-engine','shipEngine']);
const domains276=['piles','pawns','structures','jobs','packed','stockpiles','research','spoiled','destroyed','deconstructed',
 'apparelPolicies','group','groupLosses','worldGroups','worldPawns','commercialTrip','civilianPost','visitors','raids',
 'trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife','fires','bombWaves','campaignMap'];
const catalogueFields276=new Set(['kind','project','item','food','recipe','tool']);
const filterFields276=new Set(['allowed','allowedItems','inputs']);
/** Original RAW/public namespaces are fenced before275 migration/adoption.
 * Traversal is sparse: never the terrain, resources or planetary payload.
 * This is a historical fence, not a replacement for complete276 validation. */
export function validShipPartHistoricalTransport276(value:unknown,version:number):boolean {
 if(!integer(version,1,SCHEMA_VERSION))return false;if(isSchema276OrLater(version))return true;
 let left=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--left<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  if('shipEngine'in v&&!Object.hasOwn(v,'shipEngine'))return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string'||tokens276.has(key)){active.delete(v);return false;}
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value')){active.delete(v);return false;}
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(catalogueFields276.has(key)&&typeof d.value==='string'&&tokens276.has(d.value)){active.delete(v);return false;}
   if(filterFields276.has(key)&&Array.isArray(d.value))for(const item of Reflect.ownKeys(d.value)){
    const descriptor=Object.getOwnPropertyDescriptor(d.value,item);
    if(!descriptor||!Object.hasOwn(descriptor,'value')||typeof descriptor.value==='string'&&tokens276.has(descriptor.value)){active.delete(v);return false;}
   }
   if(!walk(d.value)){active.delete(v);return false;}
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope&&!Object.hasOwn(envelope,'value'))return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  for(const key of [...domains276,'secondarySite','worldMaps']){
   const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;
  }
  if(root!==value)for(const key of ['structures','jobs','pawns','piles']){
   const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;
  }
  return true;
 }catch{return false;}
}
