import {SCHEMA_VERSION} from './types.ts';
import {validBillReservePauseState289} from './bill-pause-rules-289.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import type {World} from './types.ts';

const own=(v:object,k:PropertyKey)=>Object.hasOwn(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const versionAllowed=(v:number)=>Number.isSafeInteger(v)&&v>=1&&v<=SCHEMA_VERSION;
const field=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&own(d,'value')?d:undefined;};

/** Scalar only. A retained/minified original owns the same saved memory.
 * Existing owner guards validate the rest of the building and bill. */
export function validBillPauseBuilding289(value:unknown,version:number):boolean {
 try{
  if(!plain(value)||!versionAllowed(version))return false;
  const bills=Object.getOwnPropertyDescriptor(value,'bills');if(!bills)return !('bills'in value);
  if(!bills.enumerable||!own(bills,'value'))return false;
  if(!Array.isArray(bills.value))return true; // The existing building validator owns this shape.
  for(let i=0;i<bills.value.length;i++){
   const row=Object.getOwnPropertyDescriptor(bills.value,String(i));if(!row)continue;
   if(!own(row,'value'))return false;const bill=row.value;
   if(!bill||typeof bill!=='object'||!('reservePause'in bill))continue;
   if(!plain(bill))return false;
   const state=field(bill,'reservePause'),recipe=field(bill,'recipe');
   if(!state||!recipe||!validBillReservePauseState289(state.value,version,recipe.value))return false;
  }
  return true;
 }catch{return false;}
}

type Custody='world'|'maps'|'mapRecord'|'secondary'|'projection'|'groups'|'groupRecord'|'worldPawns'|'factions'|'archive'|'departures'|'building'|'pack'|'casketRecord'|'holder';
type Branch=readonly [key:string,kind:Custody,array?:true];
/** Closed custody lanes from V461, with transport envelopes. Never descend
 * into terrain, actor bodies, plants, item payloads or the planet. */
const branches:Readonly<Record<Custody,readonly Branch[]>>={
 world:[['world','world'],['summary','world'],['dynamic','world'],['campaign','world'],['structures','building',true],['packed','pack',true],['worldMaps','maps'],['secondarySite','secondary'],['campaignMap','projection'],['worldGroups','groups'],['groups','groupRecord',true],['worldPawns','worldPawns'],['worldFactions','factions'],['group','holder'],['groupLosses','holder',true],['animalLosses','holder',true],['visitors','departures'],['podRescues','departures']],
 maps:[['sites','mapRecord',true]],mapRecord:[['map','world']],secondary:[['map','world']],
 projection:[['groups','groupRecord',true],['groupLosses','holder',true],['animalLosses','holder',true]],
 groups:[['groups','groupRecord',true],['losses','holder',true],['animalLosses','holder',true],['abandonedPawns','holder',true],['abandonedContents','archive',true]],
 groupRecord:[['state','holder'],['pending261','holder']],
 worldPawns:[['owners','holder',true],['heldCaskets259','casketRecord',true],['heldPlayerCaskets271','casketRecord',true],['heldShipCaskets277','casketRecord',true]],
 factions:[['leaders','holder',true]],archive:[['humans','holder',true],['animals','holder',true]],departures:[['departed','holder',true]],
 building:[['cryptosleep','holder'],['shipCryptosleep277','holder']],pack:[['building','building']],casketRecord:[['casket','building']],holder:[['packed','pack',true]],
};

function scan(value:unknown,version:number):boolean {
 let budget=2_000_000;const active=new Set<object>();
 const list=(v:unknown,kind:Custody):boolean=>{
  if(Array.isArray(v)){
   if(active.has(v))return false;active.add(v);
   for(let i=0;i<v.length;i++){if(--budget<0)return false;const d=Object.getOwnPropertyDescriptor(v,String(i));if(d&&(!own(d,'value')||!visit(d.value,kind)))return false;}
   active.delete(v);return true;
  }
  // Snapshot sparse tables contain removed IDs and upserted records.
  if(!plain(v)||active.has(v))return false;
  const upserts=field(v,'upserted');if(!upserts)return false;
  active.add(v);const result=list(upserts.value,kind);active.delete(v);return result;
 };
 const visit=(v:unknown,kind:Custody):boolean=>{
  if(--budget<0||!plain(v)||active.has(v))return false;
  if(kind==='building'&&!validBillPauseBuilding289(v,version))return false;
  active.add(v);
  for(const [key,child,array]of branches[kind]){
   const d=Object.getOwnPropertyDescriptor(v,key);
   if(!d){if(key in v)return false;continue;}
   if(!d.enumerable||!own(d,'value'))return false;
   if(d.value===undefined||d.value===null)continue;
   if(!(array?list(d.value,child):visit(d.value,child)))return false;
  }
  active.delete(v);return true;
 };
 try{return visit(value,'world');}catch{return false;}
}

/** Pre-migration and pre-reconstruction fence, including sparse upserts.
 * Current data are validated too; presence never adopts or recomputes pause. */
export function validBillPauseHistoricalTransport289(raw:unknown,version:number):boolean {
 return versionAllowed(version)&&scan(raw,version);
}

/** Call after the real owner envelopes were admitted. The local projection
 * may carry installed originals absent from its shared campaign root. */
export function validBillPauseWorld289(input:unknown):boolean {
 try{
  if(!plain(input))return false;const world=input as unknown as World;
  const schema=field(input,'schemaVersion');if(!schema||!versionAllowed(schema.value))return false;
  const version=schema.value as number;
  const root=campaignAuthority(world);
  if(!scan(root,version))return false;if(root===world)return true;
  const local:Record<string,unknown>={};
  for(const key of ['structures','packed']){const d=Object.getOwnPropertyDescriptor(input,key);if(d){if(!d.enumerable||!own(d,'value'))return false;local[key]=d.value;}else if(key in input)return false;}
  return scan(local,version);
 }catch{return false;}
}
