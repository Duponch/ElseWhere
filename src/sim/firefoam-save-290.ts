import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {firefoamCellCore290,firefoamData290,firefoamDense290,firefoamInteger290,validFirefoamPopper290,validFirefoamWorldShape290} from './firefoam-state-290.ts';
import {validFirefoamManualField290,validateFirefoamManualOwners290} from './firefoam-manual-290.ts';
import {validFirefoamResearchTransport290} from './research-save.ts';
import {validCoveredInFirefoamField290} from './firefoam-actor-state-290.ts';
import {validFirefoamActorOwnersWithLanesInternal290,type FirefoamLaneReaderInternal290,type FirefoamEmptyOwnerLanesInternal290} from './firefoam-actor-save-290.ts';
import {filthCheckPeriod} from './filth-rules.ts';
import {CAMPAIGN_FIELDS} from './secondary-site-state.ts';
import type {World} from './types.ts';

const own=(v:object,k:PropertyKey)=>Object.hasOwn(v,k);
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const field=(v:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&own(d,'value')?d:undefined;};
const versionAllowed=(v:unknown):v is number=>firefoamInteger290(v,1,300);
type Kind='world'|'record'|'thing'|'building'|'retainedBuilding'|'job'|'actor'|'localActor'|'health'|'feet'|'trace'|'carried'|'research'|'filth';
type Branch=readonly [string,Kind,boolean?];
interface IdentitySinkInternal290 {add(value:number):unknown;has(value:number):boolean}
interface IdentityLeaseInternal290 {readonly ids:IdentitySinkInternal290;release():void}
/** Only the native dependency adapter creates this factory. Its retained
 * storage contains numbers exclusively, never row/World references. Each
 * synchronous World verdict owns an independent active prefix and finally.
 * Public World/Local callers still create/use their original eager Sets. */
function createPooledIdentityFactoryInternal290():()=>IdentityLeaseInternal290 {
 const capacity=65536;let retained:Float64Array|undefined,leased=false;
 return ()=>{
  // Unknown getters can reenter the adapter: never share an active prefix.
  if(leased)return {ids:new Set<number>(),release(){}};
  const values=retained??new Float64Array(capacity);retained=values;leased=true;
  let count=0,queries=0,tail:number[]|undefined,index:Set<number>|undefined;
  const materialize=():Set<number>=>{
   const result=new Set<number>();
   for(let i=0;i<count;i++)result.add(values[i]!);
   if(tail)for(let i=0;i<tail.length;i++)result.add(tail[i]!);
   index=result;count=0;tail=undefined;return result;
  };
  const ids:IdentitySinkInternal290={
   add(value){
    if(index)return index.add(value);
    // Runtime unknown census IDs must preserve Set identity, not undergo a
    // Float64 coercion. A local Set may hold them until this verdict's finally.
    if(typeof value!=='number')return materialize().add(value);
    if(count<capacity)values[count++]=value;else (tail??=[]).push(value);
   },
   has(value){
    if(index)return index.has(value);
    if(++queries>16)return materialize().has(value);
    if(typeof value!=='number')return false;
    for(let i=0;i<count;i++){const seen=values[i]!;if(seen===value||seen!==seen&&value!==value)return true;}
    return tail?.includes(value)??false;
   },
  };
  return {ids,release(){count=0;queries=0;tail=undefined;index=undefined;leased=false;}};
 };
}
/** Positive scalar/shape body only, never a World or clock verdict. */
interface TracePositiveInternal290 {
 has(value:object,version:number):boolean;
 remember(value:object,version:number):void;
 list(value:object,version:number):TraceListPositiveInternal290|undefined;
 rememberList(value:unknown[],version:number):void;
}
interface TraceListPositiveInternal290 {
 readonly version:number;readonly count:number;readonly ids:readonly number[];
 readonly rows:readonly unknown[];readonly missingReserved:number;
}
const traceReserved=['kind','firefoam290','firefoamTask290','coveredInFirefoam290'] as const;
/** The closed owner/envelope lanes include original actors and retained
 * furniture. Terrain, anatomy, planet tiles and presentation caches are not
 * recursively searched. Sparse tables visit only their actual upserts. */
const lanes:readonly Branch[]=[
 ['world','world'],['summary','world'],['dynamic','world'],['campaign','world'],['map','world'],
 ['worldMaps','record'],['sites','record',true],['secondarySite','record'],['campaignMap','record'],
 ['structures','building',true],['jobs','job',true],['packed','record',true],['building','retainedBuilding'],
 ['items','thing',true],['bills','thing',true],
 ['worldGroups','record'],['groups','record',true],['group','record'],['state','record'],['pending261','record'],
 ['groupLosses','record',true],['animalLosses','record',true],['losses','record',true],['legacyTravellers','record',true],['abandonedPawns','record',true],['abandonedContents','record',true],
 ['worldPawns','record'],['owners','record',true],['worldFactions','record'],['leaders','record',true],
 ['heldCaskets259','record',true],['heldPlayerCaskets271','record',true],['heldShipCaskets277','record',true],
 ['casket','record'],['cryptosleep','record'],['shipCryptosleep277','record'],['occupant','record'],
 ['visitors','record'],['podRescues','record'],['departed','record',true],['startingArrival','record'],['pods','record',true],
 ['animalOwners','record'],['wildlife','record'],['raids','record'],['mechActive','record'],['extraMechActive261','record',true],
 ['humans','actor',true],['members','actor',true],['people','actor',true],['animals','actor',true],['mechanoids','actor',true],['flyers','actor',true],
 ['human','actor'],['pawn','actor'],['animal','actor'],['mech','actor'],['actor','actor'],
 ['pawns','localActor',true],['piles','thing',true],['corpse','record'],['mechCorpse','record'],['scout','record'],['commercialTrip','record'],
 ['health','health'],['filthFeet','feet'],['research','research'],['filth','filth'],
];

const laneKeys:ReadonlySet<string>=new Set(lanes.map(([key])=>key));
const feetLaneKeys:ReadonlySet<string>=new Set(['carried']),filthLaneKeys:ReadonlySet<string>=new Set(['items']);

function scan(raw:unknown,version:number,contexts?:Record<string,unknown>[],identities?:{add(value:number):unknown},readLane:FirefoamLaneReaderInternal290=Object.getOwnPropertyDescriptor,skipEmptyOwnerLanes?:FirefoamEmptyOwnerLanesInternal290,tracePositive?:TracePositiveInternal290):boolean {
 if(!plain(raw))return false;
 let budget=2_000_000;const active=new Set<object>();
 const list=(v:unknown,kind:Kind):boolean=>{
  if(!Array.isArray(v)){
   if(!plain(v)||active.has(v))return false;const d=field(v,'upserted');if(!d)return false;
   active.add(v);const ok=list(d.value,kind);active.delete(v);return ok;
  }
  const cached=kind==='trace'?tracePositive?.list(v,version):undefined;
  if(cached){
   // This exact array is ordinary/frozen by its constructor; its rows carry
   // separate private deep-copy proofs. No input getter or Proxy runs here.
   if(Object.getPrototypeOf(v)!==Array.prototype||active.has(v)||budget<cached.count)return false;
   // The constructor-owned ordinary frozen array is already the exact list.
   // Indexed data reads have no getters; primitives cannot be active ancestors.
   for(let i=0;i<cached.rows.length;i++)if(active.has(cached.rows[i] as object))return false;
   // Object.prototype has immutable null [[Prototype]]. An inherited reserved
   // field is invalid precisely when one admitted row lacks that own field.
   for(let n=0;n<traceReserved.length;n++)if((cached.missingReserved&(1<<n))&&own(Object.prototype,traceReserved[n]!))return false;
   budget-=cached.count;
   if(identities)for(const id of cached.ids)identities.add(id);
   return true;
  }
  if(!firefoamDense290(v,1_000_000)||active.has(v))return false;active.add(v);
  for(let i=0;i<v.length;i++)if(!visit(v[i],kind)){active.delete(v);return false;}
  if(kind==='trace')tracePositive?.rememberList(v,version);
  active.delete(v);return true;
 };
 const visit=(v:unknown,kind:Kind):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return true;
  if(!plain(v)||active.has(v))return false;
  if(identities&&['thing','building','retainedBuilding','job','actor','localActor','trace'].includes(kind)){
   const id=field(v,'id')?.value;if(firefoamInteger290(id,1))identities.add(id);
  }
  // No capability marker may be supplied by inheritance or an accessor.
  for(const k of ['kind','firefoam290','firefoamTask290','coveredInFirefoam290']){
   if(k in v&&!field(v,k))return false;
  }
  // The four inherited/reserved fences above stay live on every hit.
  if(kind!=='trace'||!tracePositive?.has(v,version)){
   const foam=field(v,'firefoam290');
   if(foam){
    if(kind==='world'){if(!validFirefoamWorldShape290(foam.value,version))return false;}
    else if(kind==='building'||kind==='retainedBuilding'){
     if(v.kind!=='firefoam-popper'||!validFirefoamPopper290(foam.value,version)||kind==='retainedBuilding'&&own(foam.value,'wick'))return false;
    }else return false;
   }
   if(v.kind==='firefoam-popper'&&((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!['building','retainedBuilding','job'].includes(kind)||kind!=='job'&&!foam||!field(v,'material')||v.material!=='steel'))return false;
   if(v.kind==='firefoam'){
    if((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||kind!=='trace'&&kind!=='carried')return false;
    if(kind==='carried'){if(!firefoamData290(v,['kind','thickness'])||!firefoamInteger290(v.thickness,1,5))return false;}
    else if(!firefoamData290(v,['id','kind','x','z','thickness','grownCore','expiresAfterCore','nextCheckCore'])||!firefoamInteger290(v.id,1)
     ||!firefoamInteger290(v.thickness,1,5)||!firefoamInteger290(v.x)||!firefoamInteger290(v.z)||!firefoamInteger290(v.grownCore)||!firefoamInteger290(v.expiresAfterCore,300000,599999)||!firefoamInteger290(v.nextCheckCore,1))return false;
   }
   if(!validFirefoamManualField290(v,version)||own(v,'firefoamTask290')&&kind!=='localActor')return false;
   if(own(v,'coveredInFirefoam290')&&kind!=='health'||kind==='health'&&!validCoveredInFirefoamField290(v,version))return false;
   if(kind==='research'){
    if(('project'in v)&&!field(v,'project'))return false;
    if(v.project==='firefoam'&&((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!field(v,'firefoam')))return false;
    if('firefoam'in v){const p=field(v,'firefoam')?.value;
     if((version!==290&&(version!==291&&(version!==292&&(version!==293&&(version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))))))||!firefoamData290(p,['points'],['completedAt'])||!firefoamInteger290(p.points,0,600000000)
      ||(own(p,'completedAt')?!firefoamInteger290(p.completedAt)||p.points!==600000000||v.project==='firefoam':p.points>=600000000))return false;
    }
   }
   if(kind==='feet'){
    const carried=field(v,'carried')?.value;
    if(Array.isArray(carried)){
     if(!firefoamDense290(carried,8))return false;
     let foam=false;for(let i=0;i<carried.length;i++){const row=Object.getOwnPropertyDescriptor(carried,String(i))?.value;if(plain(row)&&field(row,'kind')?.value==='firefoam')foam=true;}
     if(foam&&(!firefoamData290(v,['carried'],['lastTerrain'])||own(v,'lastTerrain')&&v.lastTerrain!=='dirt'))return false;
    }
   }
   if(kind==='trace')tracePositive?.remember(v,version);
  }
  if(kind==='world'&&contexts&&Array.isArray(field(v,'structures')?.value)&&Array.isArray(field(v,'pawns')?.value)&&firefoamInteger290(field(v,'width')?.value,1)&&firefoamInteger290(field(v,'height')?.value,1))contexts.push(v);
  active.add(v);
  const branches:readonly Branch[]=kind==='feet'?[['carried','carried',true]]:kind==='filth'?[['items','trace',true]]:kind==='health'||kind==='trace'||kind==='carried'||kind==='research'?[]:lanes;
  // Proof removes only an empty edge loop, after all semantics/IDs/context.
  if(branches.length&&skipEmptyOwnerLanes?.(v,kind==='feet'?feetLaneKeys:kind==='filth'?filthLaneKeys:laneKeys)){active.delete(v);return true;}
  for(const [key,child,array]of branches){
   const d=readLane(v,key);if(d===null)continue;if(!d){if(key in v)return false;continue;}
   if(!d.enumerable||!own(d,'value'))return false;if(d.value===undefined||d.value===null||typeof d.value!=='object')continue;
   // Animals and mechanics are local only in their actual map collections;
   // neither can receive the human manual order, even when spawned.
   if(!(array?list(d.value,child):visit(d.value,child)))return false;
  }
  active.delete(v);return true;
 };
 try{return visit(raw,'world');}catch{return false;}
}

/** Called before migration, sparse reconstruction or geographic preparation. */
export function validFirefoamHistoricalTransport290(raw:unknown,version:unknown):boolean {
 return validFirefoamHistoricalWithLanesInternal290(raw,version,Object.getOwnPropertyDescriptor);
}
function validFirefoamHistoricalWithLanesInternal290(raw:unknown,version:unknown,readLane:FirefoamLaneReaderInternal290,skipEmptyOwnerLanes?:FirefoamEmptyOwnerLanesInternal290,tracePositive?:TracePositiveInternal290):boolean {
 return versionAllowed(version)&&scan(raw,version,undefined,undefined,readLane,skipEmptyOwnerLanes,tracePositive)&&validFirefoamActorOwnersWithLanesInternal290(raw,version,readLane,skipEmptyOwnerLanes);
}

/** Full map context, using the captured propagation list rather than today's
 * LOS. Registry callers supply their shared Thing identity set. */
export function validateFirefoamLocal290(w:World,ids?:{has(value:number):boolean;add(value:number):unknown}):string[] {
 try{
  if(!validFirefoamHistoricalTransport290(w,w.schemaVersion))return ['Invalid or future firefoam data.'];
  return validatePrevalidatedFirefoamLocal290(w,ids);
 }catch{return ['Invalid firefoam local context.'];}
}

/** Private semantic phase for the same synchronously admitted owner scopes.
 * Public local callers still pass the complete historical/actor fence above.
 * Never export, cache or grant this prerequisite through a packet marker. */
function validatePrevalidatedFirefoamLocal290(w:World,ids?:{has(value:number):boolean;add(value:number):unknown}):string[] {
 const errors:string[]=[];
 try{
  const macro=w.tick*10,physical=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):macro;
  for(const s of w.structures)if(s.firefoam290?.wick){const wick=s.firefoam290.wick;
   if(wick.startedAtCore>physical||wick.endCore<=physical||!w.firefoam290)errors.push('Invalid installed firefoam wick clock.');
  }
  if((Number(w.schemaVersion)!==290&&(Number(w.schemaVersion)!==291&&(Number(w.schemaVersion)!==292&&(Number(w.schemaVersion)!==293&&(Number(w.schemaVersion)!==294&&(Number(w.schemaVersion)!==295&&(Number(w.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(w.schemaVersion))))))))))return errors;
  if(!validFirefoamResearchTransport290(w,w.schemaVersion))errors.push('Invalid firefoam research or new construction.');
  for(const trace of w.filth?.items??[])if(trace.kind==='firefoam'&&(!firefoamInteger290(trace.id,1,w.nextId-1)||!firefoamInteger290(trace.x,0,w.width-1)
   ||!firefoamInteger290(trace.z,0,w.height-1)||!firefoamInteger290(trace.grownCore,0,physical)||!firefoamInteger290(trace.nextCheckCore,macro+1,(isCorePhysicalSchema297(Number(w.schemaVersion))?Math.max(macro,trace.grownCore):macro)+filthCheckPeriod(w))))errors.push('Invalid firefoam filth clock or cell.');
  if(w.firefoam290){
   const seen=new Set<number>(),sourceIds=new Set<number>();let previous=0;
   const occupied=ids??new Set([
    ...w.pawns,...w.resources,...w.structures,...w.jobs,...w.piles,...w.stockpiles,...w.growingZones,
    ...w.wildlife?.animals??[],...w.wildlife?.flyers??[],...w.mechanoids??[],...w.filth?.items??[],...w.fires?.items??[],...w.fires?.embers??[],...w.projectiles??[],...w.bombWaves??[],
    ...w.packed.map(p=>p.building),...w.structures.flatMap(s=>s.bills??[]),...w.packed.flatMap(p=>p.building.bills??[]),
   ].map(v=>v.id));
   for(const wave of w.firefoam290.waves){
    if(wave.id>=w.nextId||wave.id<=previous||seen.has(wave.id)||occupied.has(wave.id))errors.push('Duplicate or invalid firefoam wave identity.');
    previous=wave.id;seen.add(wave.id);ids?.add(wave.id);
    if(sourceIds.has(wave.sourceId)||occupied.has(wave.sourceId))errors.push('Firefoam source remains owned.');sourceIds.add(wave.sourceId);
    // Firefoam remains a6Hz helpful clinical owner. A phase1..9 birth
    // owns an unprocessed receipt until the next actual macro, never a
    // fictitious central treatment or an advanced root-Core cursor.
    const pendingBirth297=isCorePhysicalSchema297(Number(w.schemaVersion))&&wave.startedAtCore>macro;
    if(pendingBirth297&&(wave.nextCell!==0||wave.affectedActorKeys.length!==0))errors.push('Unprocessed firefoam birth has a fictitious clinical cursor.');
    if(wave.center.x>=w.width||wave.center.z>=w.height||wave.startedAtCore>physical||wave.advancedAtCore!==(isCorePhysicalSchema297(Number(w.schemaVersion))?Math.max(macro,wave.startedAtCore):macro))errors.push('Invalid firefoam wave clock or center.');
    if(wave.cells[0]!==wave.center.z*w.width+wave.center.x)errors.push('Missing firefoam wave center.');
    const halo=new Set(wave.damageOnlyCells);let priorDate=-1,priorIndex=-1;
    for(let n=0;n<wave.cells.length;n++){
     const i=wave.cells[n]!,date=firefoamCellCore290(w.width,wave,i),x=i%w.width,z=Math.floor(i/w.width);
     if(i>=w.width*w.height||Math.abs(x-wave.center.x)>10||Math.abs(z-wave.center.z)>10||!halo.has(i)&&Math.hypot(x-wave.center.x,z-wave.center.z)>9.9||date<priorDate||date===priorDate&&i<=priorIndex
      ||(n<wave.nextCell)!==(!pendingBirth297&&date<=wave.advancedAtCore))errors.push('Invalid captured firefoam cell, order or due cursor.');
     priorDate=date;priorIndex=i;
    }
    if(wave.damageOnlyCells.some((i,n)=>n>0&&wave.cells.indexOf(i)<=wave.cells.indexOf(wave.damageOnlyCells[n-1]!))||halo.has(wave.center.z*w.width+wave.center.x))errors.push('Invalid firefoam halo order.');
    if(wave.damageOnlyCells.some(i=>!wave.cells.some(p=>!halo.has(p)&&Math.max(Math.abs(i%w.width-p%w.width),Math.abs(Math.floor(i/w.width)-Math.floor(p/w.width)))===1)))errors.push('Firefoam halo lacks a captured primary neighbor.');
    if(wave.nextCell===wave.cells.length&&firefoamCellCore290(w.width,wave,wave.cells.at(-1)!)<=w.tick*10-10)errors.push('Expired completed firefoam wave.');
    if(wave.affectedActorKeys.some(k=>!firefoamInteger290(Number(k.slice(k.indexOf(':')+1)),1,w.nextId-1))||wave.nextCell===0&&wave.affectedActorKeys.length)errors.push('Invalid firefoam affected actor identity.');
   }
  }
  errors.push(...validateFirefoamManualOwners290(w));return errors;
 }catch{return ['Invalid firefoam local context.'];}
}

/** Complete owners are checked after their own envelope guards. A mapless
 * summary retains actors/furniture, but cannot own a local propagation wave. */
export function validFirefoamWorld290(input:unknown):boolean {
 return validFirefoamWorldWithLanesInternal290(input,Object.getOwnPropertyDescriptor);
}
/** Internal dependency adapter only. It cannot stamp a World, mint a native
 * proof or change the strict choice of any public façade. */
export function createFirefoamLaneValidatorsInternal290(readLane:FirefoamLaneReaderInternal290,skipEmptyOwnerLanes?:FirefoamEmptyOwnerLanesInternal290,ownedFrozenTrace?:(value:object)=>boolean,ownedFrozenTraceList?:(value:object)=>boolean){
 const identityFactory=createPooledIdentityFactoryInternal290();
 const positives=new WeakMap<object,number>();
 const lists=new WeakMap<object,TraceListPositiveInternal290>();
 const tracePositive:TracePositiveInternal290|undefined=ownedFrozenTrace?{
  has:(value,version)=>positives.get(value)===version,
  // Only genuine deeply frozen copies can acquire this representation proof.
  remember(value,version){if(ownedFrozenTrace?.(value))positives.set(value,version);},
  list(value,version){const held=lists.get(value);return held?.version===version?held:undefined;},
  rememberList(value,version){
   if(!ownedFrozenTraceList?.(value))return;
   const ids:number[]=[];let missingReserved=0;
   for(let i=0;i<value.length;i++){
    const row=value[i];
    // Primitive visits still consume one budget unit; arrays/unknown objects
    // never borrow a record proof, even when somebody froze them externally.
    if(row===null||typeof row!=='object')continue;
    // The successful first visit just established this exact-version private
    // immutable row positive. Do not invoke the representation callback twice.
    if(positives.get(row)!==version)return;
    const id=field(row,'id')?.value;if(firefoamInteger290(id,1))ids.push(id);
    for(let n=0;n<traceReserved.length;n++)if(!own(row,traceReserved[n]!))missingReserved|=1<<n;
   }
   lists.set(value,{version,count:value.length,ids,rows:value,missingReserved});
  },
 }:undefined;
 return {
  historical:(raw:unknown,version:unknown)=>validFirefoamHistoricalWithLanesInternal290(raw,version,readLane,skipEmptyOwnerLanes,tracePositive),
  world:(input:unknown)=>validFirefoamWorldWithLanesInternal290(input,readLane,skipEmptyOwnerLanes,tracePositive,identityFactory),
 };
}
function validFirefoamWorldWithLanesInternal290(input:unknown,readLane:FirefoamLaneReaderInternal290,skipEmptyOwnerLanes?:FirefoamEmptyOwnerLanesInternal290,tracePositive?:TracePositiveInternal290,identityFactory?:()=>IdentityLeaseInternal290):boolean {
 let identityLease:IdentityLeaseInternal290|undefined;
 try{
  if(!plain(input))return false;const world=input as unknown as World,root=campaignAuthority(world) as unknown as Record<string,unknown>;
  const schema=field(root,'schemaVersion');if(!schema||!versionAllowed(schema.value))return false;
  const maps:Record<string,unknown>[]=[],ids=(identityLease=identityFactory?.())?.ids??new Set<number>();if(!scan(root,schema.value,maps,ids,readLane,skipEmptyOwnerLanes,tracePositive)||!validFirefoamActorOwnersWithLanesInternal290(root,schema.value,readLane,skipEmptyOwnerLanes))return false;
  if(!validFirefoamResearchTransport290({...root,jobs:Array.isArray(root.jobs)?root.jobs:[]} as unknown as World,schema.value))return false;
  const shared:Record<string,unknown>={};for(const key of CAMPAIGN_FIELDS)if(own(root,key))shared[key]=root[key];
  if(root!==input){const local:Record<string,unknown>={};for(const key of Object.keys(input)){if((CAMPAIGN_FIELDS as readonly string[]).includes(key)||key==='worldMaps'||key==='worldGroups'||key==='civilianPost')continue;const d=Object.getOwnPropertyDescriptor(input,key);if(!d||!d.enumerable||!own(d,'value'))return false;local[key]=d.value;}if(!scan(local,schema.value,maps,ids,readLane,skipEmptyOwnerLanes,tracePositive)||!validFirefoamActorOwnersWithLanesInternal290(local,schema.value,readLane,skipEmptyOwnerLanes))return false;}
  if(own(root,'firefoam290')&&!Array.isArray(root.structures))return false;
  const unique=[...new Map(maps.map(map=>[map.structures,map])).values()];for(const map of unique){
   const context={...shared,...map,schemaVersion:schema.value,tick:root.tick,nextId:root.nextId} as unknown as World;
   for(const list of [context.resources,context.stockpiles,context.growingZones,context.fires?.items,context.fires?.embers,context.projectiles,context.bombWaves])for(const row of list??[])ids.add(row.id);
  }
  for(const map of unique){const context={...shared,...map,schemaVersion:schema.value,tick:root.tick,nextId:root.nextId} as unknown as World;if(validatePrevalidatedFirefoamLocal290(context,ids).length)return false;}
  return true;
 }catch{return false;}finally{identityLease?.release();}
}
