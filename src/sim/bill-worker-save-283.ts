import {SCHEMA_VERSION} from './types.ts';
import {validBillWorkerPolicy283} from './bill-worker-rules-283.ts';
import {isSchema283OrLater} from './schema-compatibility-257.ts';
import {captureHumanOwners,type HumanOwnershipCapture} from './human-owners.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {hasLoadedRoot,registeredMapForValidation,brandCampaignContext} from './world-map-context.ts';
import {emptyCampaignOwner} from './world-map-owners.ts';
import type {World} from './types.ts';
import type {CampaignState} from './world-map-state.ts';

const own=(v:object,k:PropertyKey)=>Object.hasOwn(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const domains=['piles','pawns','structures','jobs','packed','worldMaps','secondarySite','campaignMap','worldGroups','worldPawns','worldFactions','group','groupLosses','commercialTrip','civilianPost','visitors','raids','trade','orbital','prisonDepartures','arrivals','startingArrival','podRescues','scout','quests','wildlife'];
type Custody283='world'|'maps'|'mapRecord'|'secondary'|'projection'|'groups'|'groupRecord'|'worldPawns'|'factions'|'archive'|'departures'|'building'|'pack'|'casketRecord'|'holder';
type Branch283=readonly [key:string,kind:Custody283,array?:true];
/** Closed current custody graph, not a recursively filtered World walk.
 * Pawn/animal records contain no packed: actual goods are sibling packed in
 * these holders. Grids, actors, physiology and item payloads are never read. */
const custodyBranches283:Readonly<Record<Custody283,readonly Branch283[]>>={
 world:[['structures','building',true],['packed','pack',true],['worldMaps','maps'],['secondarySite','secondary'],['campaignMap','projection'],['worldGroups','groups'],['groups','groupRecord',true],['worldPawns','worldPawns'],['worldFactions','factions'],['group','holder'],['groupLosses','holder',true],['animalLosses','holder',true],['visitors','departures'],['podRescues','departures']],
 maps:[['sites','mapRecord',true]],
 mapRecord:[['map','world']],
 secondary:[['map','world']],
 projection:[['groups','groupRecord',true],['groupLosses','holder',true],['animalLosses','holder',true]],
 groups:[['groups','groupRecord',true],['losses','holder',true],['animalLosses','holder',true],['abandonedPawns','holder',true],['abandonedContents','archive',true]],
 groupRecord:[['state','holder'],['pending261','holder']],
 worldPawns:[['owners','holder',true],['heldCaskets259','casketRecord',true],['heldPlayerCaskets271','casketRecord',true],['heldShipCaskets277','casketRecord',true]],
 factions:[['leaders','holder',true]],
 archive:[['humans','holder',true],['animals','holder',true]],
 departures:[['departed','holder',true]],
 building:[['cryptosleep','holder'],['shipCryptosleep277','holder']],
 pack:[['building','building']],
 casketRecord:[['casket','building']],
 holder:[['packed','pack',true]],
};

/** Existing domain guards have already admitted their owning envelopes. Only
 * bill policy shape/reference is new here; no terrain-sized branch is touched. */
function scanCurrent283(value:unknown,nextId:number,named:Set<number>):boolean {
 let budget=2_000_000;const active=new Set<object>();
 const visit=(v:unknown,kind:Custody283):boolean=>{
  if(--budget<0||!plain(v)||active.has(v))return false;
  if(kind==='building'&&!('bills'in v)&&!('cryptosleep'in v)&&!('shipCryptosleep277'in v))return true;
  if(kind==='building'&&!validBillWorkerBuilding283(v,283,nextId,named))return false;
  active.add(v);
  for(const [key,child,array]of custodyBranches283[kind]){
   const field=Object.getOwnPropertyDescriptor(v,key);
   if(!field){if(key in v)return false;continue;}
   if(!own(field,'value'))return false;
   const data=field.value;if(data===undefined||data===null)continue;
   if(array){
    if(!Array.isArray(data)||active.has(data))return false;active.add(data);
    for(let i=0;i<data.length;i++){const row=Object.getOwnPropertyDescriptor(data,String(i));if(!row)continue;if(!own(row,'value')||!visit(row.value,child))return false;}
    active.delete(data);
   }else if(!visit(data,child))return false;
  }
  active.delete(v);return true;
 };
 try{return visit(value,'world');}catch{return false;}
}

/** Pure scalar building guard, including actual minified originals. */
export function validBillWorkerBuilding283(value:unknown,version:number,nextId?:number,named?:Set<number>):boolean {
 if(!plain(value)||!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 const bills=Object.getOwnPropertyDescriptor(value,'bills');if(!bills)return !('bills'in value);
 if(!own(bills,'value'))return false;if(!Array.isArray(bills.value))return true; // Existing owner validates bills shape.
 for(let i=0;i<bills.value.length;i++){
  const entry=Object.getOwnPropertyDescriptor(bills.value,String(i));if(!entry)continue;if(!own(entry,'value'))return false;
  const bill=entry.value;if(!bill||typeof bill!=='object'||!('worker'in bill))continue;
  const field=Object.getOwnPropertyDescriptor(bill,'worker');
  if(!isSchema283OrLater(version)||!plain(bill)||!field?.enumerable||!own(field,'value')||!validBillWorkerPolicy283(field.value,nextId))return false;
  if(field.value.pawnId!==null)named?.add(field.value.pawnId);
 }
 return true;
}

/** Walk the actual custody envelopes, never terrain/resources/planet. It is
 * data-only and bounded; no owner, task or policy is created or normalized. */
function scan(value:unknown,version:number,nextId?:number,named?:Set<number>):boolean {
 let budget=2_000_000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;
  if('worker'in v&&(!isSchema283OrLater(version)||!plain(v)||!own(v,'worker')))return false;
  if('bills'in v&&!validBillWorkerBuilding283(v,version,nextId,named))return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!own(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(!walk(d.value))return false;
  }
  active.delete(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope&&!own(envelope,'value'))return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!own(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  if(root!==value)for(const key of ['piles','pawns','structures','jobs']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!own(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}
/** Historical fence before migration or patch reconstruction. */
export function validBillWorkerHistoricalTransport283(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
 return isSchema283OrLater(version)||scan(value,version);
}

/** Only call after the real owner guards. Dead/away retained human IDs remain
 * valid references; the prospective lifecycle event owns native cleanup. */
export function validBillWorkerWorld283(w:World,readOwners?:()=>HumanOwnershipCapture):boolean {
 try{
  const root=campaignAuthority(w) as CampaignState,named=new Set<number>();
  if(isSchema283OrLater(w.schemaVersion)?!scanCurrent283(root,w.nextId,named):!scan(root,w.schemaVersion,w.nextId,named))return false;
  if(root!==w){const local={structures:w.structures,packed:w.packed};if(isSchema283OrLater(w.schemaVersion)?!scanCurrent283(local,w.nextId,named):!scan(local,w.schemaVersion,w.nextId,named))return false;}
  if(!named.size)return true;
  const context=hasLoadedRoot(root)?root:root.worldMaps?.sites.length?registeredMapForValidation(root,root.worldMaps.sites[0]!.id):root.worldMaps?emptyCampaignOwner(root):w;
  if(context&&context!==root)brandCampaignContext(context,root);
  if(!context)return false;const people=(readOwners?readOwners():captureHumanOwners(context)).people;
  return [...named].every(id=>people.has(id));
 }catch{return false;}
}
