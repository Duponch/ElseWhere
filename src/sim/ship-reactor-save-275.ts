import {SCHEMA_VERSION} from './types.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {SHIP_REACTOR_PHYSICS_275,shipReactorRect275} from './ship-reactor-content-275.ts';
import {isShipReactor275,validShipReactorField275,type ShipReactor275} from './ship-reactor-state-275.ts';
import {validShipHullBuilding276,validShipHullField276} from './ship-part-save-276.ts';
import type {World} from './types.ts';

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const data=(v:object,k:PropertyKey):PropertyDescriptor|undefined=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
type Header275=Pick<World,'width'|'height'|'nextId'>&Partial<Pick<World,'worldFactions'>>;
export function validShipReactorBuilding275(v:unknown,version:number,w:Header275,core:number):boolean {
 if(!validShipReactorField275(v,version,core)||!plain(v))return false;
 if(!isShipReactor275(v))return true;
 const allowed=['id','kind','x','z','orientation','footprint','material','power','damage','factionId','shipReactor275'];
 if(!isSchema275OrLater(version)||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!allowed.includes(k)||!data(v,k))
  ||!['id','kind','x','z','orientation','footprint','material','power'].every(k=>data(v,k)))return false;
 const s=v as unknown as ShipReactor275;
 if(!int(w.width,1)||!int(w.height,1)||!int(w.nextId,1)||!int(s.id,1,w.nextId-1)||!int(s.x,0,w.width-1)||!int(s.z,0,w.height-1)
  ||!int(s.orientation,0,3)||s.footprint!=='standard'||s.material!=='steel'
  ||Object.hasOwn(s,'damage')&&!int(s.damage,1,SHIP_REACTOR_PHYSICS_275.maxHitPoints-1)
  ||Object.hasOwn(s,'factionId')&&(!int(s.factionId,1)||s.factionId!==w.worldFactions?.playerFactionId))return false;
 const p=s.power;if(!plain(p)||Reflect.ownKeys(p).length!==2||!data(p,'on')||!data(p,'parentId')||typeof p.on!=='boolean'||p.parentId!==null)return false;
 const r=shipReactorRect275(s,s.orientation);return r.x>=0&&r.z>=0&&r.x+r.width<=w.width&&r.z+r.depth<=w.height;
}

/** Local actual owner checks, called after the general shape guards. Fixed
 * ship parts cannot travel inside any packed owner. The276 checks reuse this
 * owner walk, rather than adding another structures/possessions traversal. */
export function validShipReactorWorld275(w:World,version:number=w.schemaVersion):boolean {
 const core=isCorePhysicalSchema297(Number(version))?effectiveCore297(w):w.tick*10;if(!int(w.tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))||!int(version,1,SCHEMA_VERSION))return false;
 for(const s of w.structures)if(!validShipReactorBuilding275(s,version,w,core)||!validShipHullBuilding276(s,version,w))return false;
 for(const j of w.jobs){
  if(!validShipReactorField275(j,version,core,'job')||!validShipHullField276(j,version,'job'))return false;
  for(const s of [j.fixBreakdown,j.deconstruction,j.furniture,j.repair])if(s&&(!validShipReactorField275(s,version,core,'job')||!validShipHullField276(s,version,'job')))return false;
 }
 const packed=(records:readonly {building:unknown}[]|undefined):boolean=>(records??[]).every(p=>!('shipReactor275'in p)&&validShipReactorField275(p.building,version,core,'packed')&&validShipHullField276(p.building,version,'packed'));
 if(!packed(w.packed)||w.group&&'packed'in w.group&&!packed(w.group.packed)||w.groupLosses?.some(l=>!packed(l.packed)))return false;
 for(const list of [w.visitors?.departed??[],w.podRescues?.departed??[]])for(const row of list)if(!packed(row.packed))return false;
 if(w.worldPawns?.owners.some(o=>!packed(o.packed)))return false;
 const g=w.worldGroups;
 if(g&&(g.groups.some(r=>'packed'in r.state&&!packed(r.state.packed))||g.losses.some(r=>!packed(r.packed))||g.animalLosses?.some(r=>!packed(r.packed))
  ||g.abandonedPawns.some(r=>!packed(r.packed))||g.abandonedContents.some(r=>r.humans.some(p=>!packed(p.packed))||r.animals.some(a=>!packed(a.packed)))))return false;
 const c=w.campaignMap;
 if(c?.revision===2&&(c.groups.some(r=>'packed'in r.state&&!packed(r.state.packed))||c.groupLosses.some(r=>!packed(r.packed))||c.animalLosses?.some(r=>!packed(r.packed))))return false;
 return true;
}

/** Delta-only temporal check, after full next-world guards. Checkpoints have
 * no predecessor. Coalesced packets can legitimately skip the entire warmup. */
export function validShipReactorContinuation275(previous:Pick<World,'schemaVersion'|'tick'|'structures'>&Partial<Pick<World,'phaseCore297'>>,next:Pick<World,'schemaVersion'|'tick'|'structures'>&Partial<Pick<World,'phaseCore297'>>):boolean {
 if(!int(previous.tick,0,Math.floor(Number.MAX_SAFE_INTEGER/10))||!int(next.tick,previous.tick,Math.floor(Number.MAX_SAFE_INTEGER/10))
  ||!int(previous.schemaVersion,1,SCHEMA_VERSION)||!int(next.schemaVersion,1,SCHEMA_VERSION))return false;
 const before=isCorePhysicalSchema297(Number(previous.schemaVersion))?effectiveCore297(previous):previous.tick*10,after=isCorePhysicalSchema297(Number(next.schemaVersion))?effectiveCore297(next):next.tick*10;let old:Map<number,ShipReactor275>|undefined;
 for(const s of previous.structures)if(isShipReactor275(s))(old??=new Map()).set(s.id,s);
 for(const s of next.structures){
  const reactor=isShipReactor275(s),prior=old?.get(s.id);
  // Ordinary walls retain no new map entry or deep field validation. A
  // previously admitted reactor still cannot become a wall at the same ID.
  if(!reactor){if(prior||'shipReactor275'in s)return false;continue;}
  if(!validShipReactorField275(s,next.schemaVersion,after))return false;
  if(prior){
   const a=prior.shipReactor275,b=s.shipReactor275;
   if(a){if(!b||a.startCore!==b.startCore||a.endCore!==b.endCore||a.state==='running'&&b.state!=='running')return false;}
   else if(b&&b.startCore<before)return false;
  }else if(previous.structures.some(p=>p.id===s.id)||s.shipReactor275&&s.shipReactor275.startCore<before)return false;
 }
 return true;
}

const tokens=new Set(['ship-reactor','shipReactor275','shipReactorThreats275','ship-basics','shipBasics','shipReactor','lostPlasteel275']);
const domains=['piles','pawns','structures','jobs','packed','stockpiles','research','spoiled','destroyed','deconstructed','apparelPolicies','group','groupLosses','worldGroups','worldPawns','commercialTrip','civilianPost','visitors','raids','trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife','fires','bombWaves','campaignMap','shipReactorThreats275'];
const futureStrings=(a:unknown[]):boolean=>Reflect.ownKeys(a).some(k=>{const d=Object.getOwnPropertyDescriptor(a,k);return !d||!Object.hasOwn(d,'value')||typeof d.value==='string'&&tokens.has(d.value);});
/** Sparse historical fence, before migration or checkpoint/delta admission.
 * It never walks terrain, geography or resource arrays. */
export function validShipReactorHistoricalTransport275(value:unknown,version:number):boolean {
 if(!int(version,1,SCHEMA_VERSION))return false;if(isSchema275OrLater(version))return true;
 let budget=2000000;const active=new Set<object>();
 const historical=(v:unknown,domain?:string):boolean=>{
  if(--budget<0)return false;if(!v||typeof v!=='object')return true;
  if(active.has(v))return false;active.add(v);
  if(domain==='destroyed'){const lost=data(v,'lost')?.value;if(plain(lost)&&Object.hasOwn(lost,'plasteel')){active.delete(v);return false;}}
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string'||tokens.has(key)){active.delete(v);return false;}
   if(key==='tiles'||key==='planet'||key==='resources')continue;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value')){active.delete(v);return false;}
   const child=d.value;
   if(['kind','item','food','recipe','tool','project'].includes(key)&&typeof child==='string'&&tokens.has(child)
    ||['allowed','allowedItems','inputs'].includes(key)&&Array.isArray(child)&&futureStrings(child)||!historical(child,key)){active.delete(v);return false;}
  }
  active.delete(v);return true;
 };
 try{
  if(!value||typeof value!=='object')return true;
  const wrapped=Object.getOwnPropertyDescriptor(value,'world');if(wrapped&&!Object.hasOwn(wrapped,'value'))return false;
  const w=wrapped?.value&&typeof wrapped.value==='object'?wrapped.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(w,key);if(d&&(tokens.has(key)||!Object.hasOwn(d,'value')||!historical(d.value,key)))return false;}
  const secondary=Object.getOwnPropertyDescriptor(w,'secondarySite');if(secondary&&(!Object.hasOwn(secondary,'value')||!historical(secondary.value)))return false;
  const maps=Object.getOwnPropertyDescriptor(w,'worldMaps');
  if(maps){if(!Object.hasOwn(maps,'value')||!historical(maps.value))return false;}
  if(w!==value)for(const key of ['piles','structures','pawns','jobs']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!historical(d.value,key)))return false;}
  return true;
 }catch{return false;}
}
