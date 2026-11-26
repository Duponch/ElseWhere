import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {validCapturedCoreMove297} from '../sim/core-move-save-297.ts';
import {isSealedMotionHistory,ownedMotionPiece297,MotionRecorder,type PawnTrack} from './motion-tracks.ts';
import type {PresentationSegment} from '../sim/travel-timing.ts';
import type {SnapshotMessage} from './snapshots.ts';
import {isOrdinaryResidentOwnerRecord379,isOrdinaryResidentOwnerArray379,residentOwnerArray379} from './resident-owner-records-379';
import {readPrivateNativeAuxLease379} from './native-aux-lease-reader-379';
import {verifyResourceJournal} from '../sim/resource-mutation-journal';
import {verifyTerrainWriteCaches} from '../sim/terrain-mutation-journal';

type Data=Record<string,unknown>;
const own=(v:object,k:PropertyKey)=>Object.hasOwn(v,k);
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
function record(v:unknown):v is Data {
 if(!v||typeof v!=='object'||Object.getPrototypeOf(v)!==Object.prototype)return false;
 // One descriptor read per key (the same answer as reading it twice).
 for(const k of Reflect.ownKeys(v)){if(typeof k!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,k);if(d?.enumerable!==true||!own(d,'value'))return false;}
 return true;
}
function dense(v:unknown):v is unknown[]{if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||Reflect.ownKeys(v).length!==v.length+1)return false;for(let i=0;i<v.length;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!own(d,'value'))return false;}return true;}
const exact=(v:Data,keys:string[])=>Object.keys(v).length===keys.length&&Object.keys(v).every(k=>keys.includes(k));
interface MotionExtent297 {readonly nodes:number;readonly height:number;readonly finite:boolean}
const CORE_MOTION_NODES297=1048576,CORE_MOTION_DEPTH297=24;
const motionExtents297=new WeakMap<object,MotionExtent297>(),motionLists297=new WeakSet<object>();
const leafExtent297:MotionExtent297={nodes:1,height:0,finite:true},nonfiniteExtent297:MotionExtent297={nodes:1,height:0,finite:false};
const nativeMotionArray=Array,nativeMotionArrayPrototype=Array.prototype;
const motionDescriptor=Object.getOwnPropertyDescriptor,motionPrototype=Object.getPrototypeOf;
const motionSpecies=motionDescriptor(nativeMotionArray,Symbol.species)?.get;
const motionPrototypes297=[Object.prototype,Array.prototype].map(value=>({value,prototype:motionPrototype(value),keys:Reflect.ownKeys(value),descriptors:Object.getOwnPropertyDescriptors(value)}));
function unchangedMotionPrototypes297():boolean {
 const species=motionDescriptor(nativeMotionArray,Symbol.species);if(Array!==nativeMotionArray||!motionSpecies||!species||species.get!==motionSpecies||own(species,'value'))return false;
 for(let i=0;i<motionPrototypes297.length;i++){
  const saved=motionPrototypes297[i]!;if(motionPrototype(saved.value)!==saved.prototype)return false;const keys=Reflect.ownKeys(saved.value);if(keys.length!==saved.keys.length)return false;
  for(let k=0;k<keys.length;k++){const key=keys[k]!;if(key!==saved.keys[k])return false;const a=motionDescriptor(saved.value,key)!,b=(saved.descriptors as Record<PropertyKey,PropertyDescriptor>)[key]!;if(a.value!==b.value||a.get!==b.get||a.set!==b.set||a.enumerable!==b.enumerable||a.configurable!==b.configurable||a.writable!==b.writable)return false;}
 }
 return true;
}
function extent297(value:unknown):MotionExtent297|undefined {
 if(value===null||value===undefined||typeof value==='string'||typeof value==='boolean')return leafExtent297;
 if(typeof value==='number')return Number.isFinite(value)?leafExtent297:nonfiniteExtent297;
 return typeof value==='object'?motionExtents297.get(value):undefined;
}
/** Only arrays whose construction was proved ordinary reach this function.
 * Count every occurrence, including retained/aliased children. No descriptor
 * or frozen-wrapper claim supplied by a caller grants an extent. */
function sealMotionArray297(values:readonly unknown[]):MotionExtent297|undefined {
 if(motionPrototype(values)!==nativeMotionArrayPrototype||Reflect.ownKeys(values).length!==values.length+1)return;
 let nodes=1,height=0,finite=true;
 for(let i=0;i<values.length;i++){
  const d=motionDescriptor(values,i);if(!d?.enumerable||!own(d,'value'))return;const child=extent297(d.value);if(!child)return;
  nodes=Math.min(CORE_MOTION_NODES297+1,nodes+child.nodes);height=Math.max(height,child.height+1);finite&&=child.finite;
 }
 Object.freeze(values);const result={nodes,height,finite};motionExtents297.set(values,result);return result;
}
/** Local array construction: count the same occurrences without another
 * descriptor pass over a graph that cannot have escaped before freezing. */
function sealKnownMotionArray379(values:readonly unknown[]):MotionExtent297|undefined {
 let nodes=1,height=0,finite=true;for(let i=0;i<values.length;i++){const child=extent297(values[i]);if(!child)return;nodes=Math.min(CORE_MOTION_NODES297+1,nodes+child.nodes);height=Math.max(height,child.height+1);finite&&=child.finite;}
 Object.freeze(values);const result={nodes,height,finite};motionExtents297.set(values,result);return result;
}
/** Internal construction fact only. It is not a native event/admission token;
 * public/literal lists, Proxy wrappers and over-budget graphs stay strict. */
export function hasOwnedResidentMotionCoreLimits297(value:unknown):boolean {
 if(!value||typeof value!=='object'||!motionLists297.has(value))return false;
 const extent=motionExtents297.get(value);return !!extent&&extent.finite&&extent.nodes<=CORE_MOTION_NODES297&&extent.height<=CORE_MOTION_DEPTH297;
}
/** A successful preflight cannot call input code: every source node must have
 * a real ordinary-identity witness, current plain/dense own-data shape, and no
 * active back edge. Section wrappers add four levels to segment copy depth. */
function ordinaryMotionGraph297(value:unknown,active:Set<object>,depth=0):boolean {
 if(depth>16)return false;
 if(value===undefined||value===null||typeof value==='number'||typeof value==='string'||typeof value==='boolean')return true;
 if(typeof value!=='object'||active.has(value))return false;
 const array=Array.isArray(value);if(array?!isOrdinaryResidentOwnerArray379(value)||!dense(value):!isOrdinaryResidentOwnerRecord379(value)||!record(value))return false;
 active.add(value);
 try{
  if(array){for(let i=0;i<value.length;i++)if(!ordinaryMotionGraph297(motionDescriptor(value,i)!.value,active,depth+1))return false;}
  else {const keys=Reflect.ownKeys(value);for(let i=0;i<keys.length;i++)if(!ordinaryMotionGraph297(motionDescriptor(value,keys[i]!)!.value,active,depth+1))return false;}
  return true;
 }finally{active.delete(value);}
}
/** Construction under the synchronous successful preflight. It retains the
 * exact original value/key order, but freezes only its own detached objects. */
function copyOwnedMotion297(value:unknown):unknown {
 if(!value||typeof value!=='object')return value;
 const array=Array.isArray(value),out:unknown[]|Data=array?residentOwnerArray379():{};let nodes=1,height=0,finite=true;
 const put=(key:PropertyKey,raw:unknown)=>{const copied=copyOwnedMotion297(raw),child=extent297(copied)!;Object.defineProperty(out,key,{value:copied,enumerable:true,writable:true,configurable:true});nodes=Math.min(CORE_MOTION_NODES297+1,nodes+child.nodes);height=Math.max(height,child.height+1);finite&&=child.finite;};
 if(array)for(let i=0;i<value.length;i++)put(i,value[i]);else for(const key of Object.keys(value))put(key,(value as Data)[key]);
 Object.freeze(out);motionExtents297.set(out,{nodes,height,finite});return out;
}
/** Genuine, not-yet-exposed structured clone on the exclusively bound native
 * port: own enumerable data fields only. Keep every shape, depth, cycle and
 * extent check in this SAME copy. Aliases still copy per occurrence. */
function copyPrivateMotion379(value:unknown,active:Set<object>,depth=0):unknown {
 if(depth>12)throw Error('Motion data depth');
 if(value===undefined||value===null||typeof value==='number'||typeof value==='string'||typeof value==='boolean')return value;
 if(typeof value!=='object'||active.has(value))throw Error('Invalid private motion data');
 const array=Array.isArray(value),keys=Object.keys(value);
 if(array?(Object.getPrototypeOf(value)!==Array.prototype||keys.length!==value.length):Object.getPrototypeOf(value)!==Object.prototype)throw Error('Invalid private motion shape');
 active.add(value);
 try{
  const out:unknown[]|Data=array?residentOwnerArray379():{};let nodes=1,height=0,finite=true;
  for(let i=0;i<keys.length;i++){
   const key=array?i:keys[i]!;if(array&&!Object.hasOwn(value,i))throw Error('Sparse private motion array');
   const copied=copyPrivateMotion379((value as Data)[key as string],active,depth+1),child=extent297(copied)!;
   Object.defineProperty(out,key,{value:copied,enumerable:true,writable:true,configurable:true});nodes=Math.min(CORE_MOTION_NODES297+1,nodes+child.nodes);height=Math.max(height,child.height+1);finite&&=child.finite;
  }
  Object.freeze(out);motionExtents297.set(out,{nodes,height,finite});return out;
 }finally{active.delete(value);}
}
function validPresentationStop297(v:Data,version:number):boolean {
 if(!('stop297'in v))return true;
 if(!isCorePhysicalSchema297(version)||v.stop297!==true||!exact(v,['from','to','start','end','fromFraction','toFraction','stop297'])||!record(v.from)||!record(v.to)||!exact(v.from,['x','z'])||!exact(v.to,['x','z']))return false;
 return typeof v.from.x==='number'&&Number.isFinite(v.from.x)&&typeof v.from.z==='number'&&Number.isFinite(v.from.z)&&v.from.x===v.to.x&&v.from.z===v.to.z&&typeof v.start==='number'&&Number.isFinite(v.start)&&v.start>=0&&v.end===v.start&&Number.isSafeInteger(v.start*10)&&v.fromFraction===0&&v.toFraction===0;
}
function copy(v:unknown,depth=0,version?:number):unknown {
 if(depth>12)throw Error('Motion data depth');
 if(v===null||v===undefined||['number','string','boolean'].includes(typeof v))return v;
 if(dense(v))return v.map(x=>copy(x,depth+1,version));
 if(!record(v))throw Error('Motion requires plain own data');if(version!==undefined&&(!validCapturedCoreMove297(v,version)||!validPresentationStop297(v,version)))throw Error('Invalid or future captured Core motion');const out:Data={};
 for(const key of Object.keys(v))Object.defineProperty(out,key,{value:copy(v[key],depth+1,version),enumerable:true,writable:true,configurable:true});return out;
}
function same(a:unknown,b:unknown):boolean {
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object')return false;
 if(Array.isArray(a)){return dense(b)&&a.length===b.length&&a.every((v,i)=>same(v,b[i]));}
 if(!record(b)||Array.isArray(b))return false;const keys=Reflect.ownKeys(a),other=Reflect.ownKeys(b);
 return keys.length===other.length&&keys.every((k,i)=>k===other[i]&&same((a as Data)[k as string],b[k as string]));
}
function deepFreeze(x:unknown):void {if(x&&typeof x==='object'){if(motionExtents297.has(x))return;for(const key of Object.keys(x))deepFreeze((x as Data)[key]);Object.freeze(x);}}
/** The checks of a segment before its copy test. */
function segmentFields(v:unknown,version:number):v is PresentationSegment {
 if(!record(v)||Object.keys(v).some(k=>!['from','to','start','end','terrainDelay','speedFactor','stagger','stuns','animalFlight','snowEntryPending','edgeStart','fromFraction','toFraction',...(isCorePhysicalSchema297(version)?['coreMove297','coreMoveWalk297','stop297']:[])].includes(k)))return false;
 if(!validCapturedCoreMove297(v,version)||!validPresentationStop297(v,version))return false;
 for(const name of ['from','to']){const c=v[name];if(!record(c)||!exact(c,['x','z'])||typeof c.x!=='number'||!Number.isFinite(c.x)||typeof c.z!=='number'||!Number.isFinite(c.z))return false;}
 if(typeof v.start!=='number'||!Number.isFinite(v.start)||typeof v.end!=='number'||!Number.isFinite(v.end)||v.end<v.start)return false;
 return true;
}
/** A valid segment's copy, made once (checking it used to copy it a first time). */
function copiedSegment(v:unknown,version:number,ownedMotion=false,privateMotion=false):PresentationSegment|undefined {
 if(!segmentFields(v,version))return undefined;
 try{return (privateMotion?copyPrivateMotion379(v,new Set()):ownedMotion?copyOwnedMotion297(v):copy(v)) as PresentationSegment;}catch{return undefined;}
}
/** Every value's copiedSegment, or undefined when one is not a valid segment. */
function copiedSegments(values:readonly unknown[],version:number,ownedMotion=false,privateMotion=false):PresentationSegment[]|undefined {
 const out:PresentationSegment[]=ownedMotion?residentOwnerArray379():new Array(values.length);if(ownedMotion)out.length=values.length;
 for(let i=0;i<values.length;i++){const copied=copiedSegment(values[i],version,ownedMotion,privateMotion);if(!copied)return undefined;out[i]=copied;}
 if(privateMotion)sealKnownMotionArray379(out);else if(ownedMotion)sealMotionArray297(out);
 return out;
}
interface Stamp {readonly owner:object;readonly generation:number}
const certified=new WeakMap<object,Stamp>();
/** A fixed-lane witness of Recorder-owned segment identities, never a World or
 * public packet flag. Base capture/reset/snapshot semantics remain unchanged. */
export class ResidentMotionRecorder extends MotionRecorder {
 private readonly owner={};private generation=0;
 override reset():void {super.reset();this.generation++;}
 override snapshot():PawnTrack[]{const rows=super.snapshot();certified.set(rows,{owner:this.owner,generation:this.generation});return rows;}
}
interface Patch {readonly id:number;readonly drop:number;readonly keep:number;readonly append:readonly PresentationSegment[]}
type Section={readonly mode:'absent'}|{readonly mode:'literal';readonly value:unknown}|{
 readonly mode:'tracks';readonly reset:boolean;readonly count:number;readonly removed:readonly number[];readonly rows:readonly Patch[];readonly order?:readonly number[];
};
export interface ResidentMotionDelta {readonly epoch:number;readonly revision:number;readonly tick:number;readonly checkpoint:boolean;readonly baseRevision?:number;readonly section:Section}
type Held={id:number;sources:readonly PresentationSegment[];values:readonly PresentationSegment[]};
const header=(p:SnapshotMessage<true>)=>({epoch:p.epoch,revision:p.revision,tick:p.world.tick,checkpoint:p.kind==='checkpoint',...p.kind==='checkpoint'?{}:{baseRevision:p.baseRevision}});
const compatible=(p:SnapshotMessage<true>,old:{epoch:number;revision:number;tick:number}|undefined)=>p.kind==='checkpoint'||!!old&&p.epoch===old.epoch&&p.baseRevision===old.revision&&p.revision===old.revision+1&&p.world.tick>=old.tick;

/** Retains copied scalar values plus references owned by the fixed recorder.
 * Stable ordinary segments need identity reads only. Empty stagger/stun arrays
 * can be aliased by the historical recorder: compare those records by value. */
export class ResidentMotionEncoder {
 private previous:{epoch:number;revision:number;tick:number;stamp?:Stamp;rows:readonly Held[]}|undefined;
 clear():void {this.previous=undefined;}
 prepare(packet:SnapshotMessage<true>){
  if(!compatible(packet,this.previous))throw Error('Missing motion producer predecessor');
  const source=packet as unknown as Data,stamp=source.motion&&typeof source.motion==='object'?certified.get(source.motion):undefined;
  let section:Section,next:Held[]=[];
  if(!own(source,'motion'))section={mode:'absent'};
  else if(!stamp)section={mode:'literal',value:copy(source.motion,0,packet.world.schemaVersion)};
  else {
   const tracks=source.motion as PawnTrack[],old=this.previous,reset=packet.kind==='checkpoint'||old?.stamp?.owner!==stamp.owner||old?.stamp?.generation!==stamp.generation,
    before=reset?[]:old!.rows,byId=new Map(before.map(row=>[row.id,row])),rows:Patch[]=[],seen=new Set<number>();
   for(const track of tracks){
    if(!integer(track.id,1)||track.id>=packet.world.nextId||seen.has(track.id))throw Error('Invalid motion identity');seen.add(track.id);
    const prior=byId.get(track.id),current=track.segments;let drop=0,keep=0;
    if(prior?.sources===current&&isSealedMotionHistory(current)){next.push(prior);continue;}
    if(prior){drop=current.length?prior.sources.indexOf(current[0]!):prior.sources.length;if(drop<0)drop=0;
     while(keep<current.length&&drop+keep<prior.sources.length&&current[keep]===prior.sources[drop+keep]){
      const value=current[keep]!;
      if((own(value,'stagger')||own(value,'stuns'))&&!same(prior.values[drop+keep],value))break;
      keep++;
     }
    }
    const appended=current.slice(keep).map(value=>{
     const version=packet.world.schemaVersion,owned=ownedMotionPiece297(value);
     // The recorder already owns the detached finite graph; still perform
     // the exact schema checks (including both nested points) that a Full
     // copy would make. Only the redundant value copy disappears.
     if(owned&&segmentFields(owned,version)&&validCapturedCoreMove297(owned.from,version)&&validCapturedCoreMove297(owned.to,version)
      &&validPresentationStop297(owned.from as unknown as Data,version)&&validPresentationStop297(owned.to as unknown as Data,version))return owned;
     const copied=copiedSegment(value,version);if(!copied)throw Error('Invalid recorded motion segment');return copied;
    });
    const values=prior?prior.values.slice(drop,drop+keep).concat(appended):appended;
    if(!prior||drop||keep!==prior.sources.length||appended.length)rows.push({id:track.id,drop,keep,append:appended});
    next.push({id:track.id,sources:isSealedMotionHistory(current)?current:current.slice(),values});
   }
   const removed=before.filter(row=>!seen.has(row.id)).map(row=>row.id),implicit=before.filter(row=>seen.has(row.id)).map(row=>row.id);
   for(const row of next)if(!byId.has(row.id))implicit.push(row.id);
   const order=implicit.length!==tracks.length||implicit.some((id,i)=>id!==tracks[i]!.id)?tracks.map(row=>row.id):undefined;
   section={mode:'tracks',reset,count:tracks.length,removed,rows,...order&&!reset?{order}:{}};
  }
  const publication={...packet} as unknown as Data;if(own(publication,'motion'))publication.motion=0;
  return {publication:publication as unknown as SnapshotMessage<true>,motion:{...header(packet),section} as ResidentMotionDelta,previous:this.previous,next:{epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,stamp,rows:next}};
 }
 commit(draft:ReturnType<ResidentMotionEncoder['prepare']>):void {if(draft.previous!==this.previous)throw Error('Lost motion producer preparation');this.previous=draft.next;}
 capture(packet:SnapshotMessage<true>):{publication:SnapshotMessage<true>;motion:ResidentMotionDelta}{const draft=this.prepare(packet);this.commit(draft);return{publication:draft.publication,motion:draft.motion};}
}

interface State {readonly epoch:number;readonly revision:number;readonly tick:number;readonly schemaVersion:number;readonly presence:boolean;readonly value:unknown;readonly tracks?:readonly PawnTrack[]}
export interface PreparedResidentMotion {readonly previous:State|undefined;readonly state:State;readonly publication:SnapshotMessage<true>;readonly owner:object}
const admitted=new WeakMap<object,{owner:object;value:unknown}>();
export class ResidentMotionFrameOwner {
 private readonly identity={};private current:State|undefined;
 clear():void {this.current=undefined;}
 read(packet:SnapshotMessage<true>):PawnTrack[]|undefined {const value=admitted.get(packet);if(value?.owner!==this.identity)throw Error('Motion read before successful admission');return value.value as PawnTrack[]|undefined;}
 prepare(packet:SnapshotMessage<true>,raw:unknown,privateLease379?:unknown):PreparedResidentMotion|undefined {
  const privateRaw=readPrivateNativeAuxLease379(privateLease379,'motion',raw),draft=this.prepareMotion379(packet,raw,privateRaw);
  if(privateRaw&&(verifyResourceJournal||verifyTerrainWriteCaches)){
   const oracle=this.prepareMotion379(packet,raw,false);
   if(!!draft!==!!oracle||draft&&oracle&&(!same(draft.state.value,oracle.state.value)||hasOwnedResidentMotionCoreLimits297(draft.state.value)!==hasOwnedResidentMotionCoreLimits297(oracle.state.value)))throw Error('Private Native motion differs from exhaustive preparation');
  }
  return draft;
 }
 private prepareMotion379(packet:SnapshotMessage<true>,raw:unknown,privateRaw:boolean):PreparedResidentMotion|undefined {
  if(!record(raw)||!record(packet)||!record(packet.world)||!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick)||!own(packet.world,'schemaVersion')||!integer(packet.world.schemaVersion,1)||!compatible(packet,this.current)
   ||packet.kind==='delta'&&this.current?.schemaVersion!==packet.world.schemaVersion
   ||!exact(raw,packet.kind==='checkpoint'?['epoch','revision','tick','checkpoint','section']:['epoch','revision','tick','checkpoint','baseRevision','section'])
   ||raw.epoch!==packet.epoch||raw.revision!==packet.revision||raw.tick!==packet.world.tick||raw.checkpoint!==(packet.kind==='checkpoint')||packet.kind==='delta'&&raw.baseRevision!==packet.baseRevision||!record(raw.section))return;
  const section=raw.section;let value:unknown,tracks:PawnTrack[]|undefined,presence=true;
  if(section.mode==='absent'){if(!exact(section,['mode'])||own(packet,'motion'))return;presence=false;}
  else if(section.mode==='literal'){if(!exact(section,['mode','value'])||!own(packet,'motion')||(packet as unknown as Data).motion!==0)return;try{value=copy(section.value,0,packet.world.schemaVersion);}catch{return;}}
  else if(section.mode==='tracks'){
   if(!exact(section,own(section,'order')?['mode','reset','count','removed','rows','order']:['mode','reset','count','removed','rows'])||typeof section.reset!=='boolean'||packet.kind==='checkpoint'&&!section.reset
    ||!integer(section.count)||section.count>=packet.world.nextId||!dense(section.removed)||!dense(section.rows)||own(section,'order')&&!dense(section.order)
    ||!own(packet,'motion')||(packet as unknown as Data).motion!==0||!section.reset&&!this.current?.tracks)return;
   const before=section.reset?[]:this.current!.tracks!;
   const privateMotion=privateRaw&&(section.reset||motionLists297.has(before))&&unchangedMotionPrototypes297();
   const ownedMotion=privateMotion||isOrdinaryResidentOwnerRecord379(raw)&&isOrdinaryResidentOwnerRecord379(section)
    &&(section.reset||motionLists297.has(before))&&unchangedMotionPrototypes297()&&ordinaryMotionGraph297(section,new Set());
   const byId=new Map(before.map(row=>[row.id,row])),touched=new Set<number>();
   if(section.reset&&(section.removed.length||own(section,'order')))return;
   for(const id of section.removed){if(!integer(id,1)||touched.has(id)||!byId.has(id))return;touched.add(id);byId.delete(id);}
   for(const item of section.rows){
    // Each appended segment is checked and copied once (the check used to
    // make a first copy, then thrown away). A refusal still refuses all.
    let appended:PresentationSegment[]|undefined;
    if(!record(item)||!exact(item,['id','drop','keep','append'])||!integer(item.id,1)||item.id>=packet.world.nextId||touched.has(item.id)||!integer(item.drop)||!integer(item.keep)||!dense(item.append)||!(appended=copiedSegments(item.append,packet.world.schemaVersion,ownedMotion,privateMotion)))return;
    touched.add(item.id);const prior=byId.get(item.id),held=prior?.segments??[];
    if(item.drop+item.keep>held.length||!prior&&(item.drop||item.keep))return;
    for(const value of appended)deepFreeze(value);
    const segments=ownedMotion?residentOwnerArray379<PresentationSegment>():held.slice(item.drop,item.drop+item.keep).concat(appended);
    if(ownedMotion){for(let i=item.drop;i<item.drop+item.keep;i++)segments.push(held[i]!);for(let i=0;i<appended.length;i++)segments.push(appended[i]!);if(privateMotion)sealKnownMotionArray379(segments);else sealMotionArray297(segments);}
    Object.freeze(segments);const track=Object.freeze({id:item.id,segments}),extent=ownedMotion?motionExtents297.get(segments):undefined;
    if(extent)motionExtents297.set(track,{nodes:Math.min(CORE_MOTION_NODES297+1,extent.nodes+2),height:extent.height+1,finite:extent.finite});byId.set(item.id,track);
   }
   if(own(section,'order')){const order=section.order as unknown[];if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1)||!byId.has(id)))return;if(ownedMotion){tracks=residentOwnerArray379<PawnTrack>();for(const id of order)tracks.push(byId.get(id as number)!);}else tracks=order.map(id=>byId.get(id as number)!);}
   else if(privateMotion){tracks=residentOwnerArray379<PawnTrack>();for(const row of byId.values())tracks.push(row);}else tracks=[...byId.values()];if(tracks.length!==section.count)return;Object.freeze(tracks);if(ownedMotion&&(privateMotion?sealKnownMotionArray379(tracks):sealMotionArray297(tracks)))motionLists297.add(tracks);value=tracks;
  }else return;
  const publication={...packet} as unknown as Data;if(presence)publication.motion=value;
  const state:State={epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,schemaVersion:packet.world.schemaVersion,presence,value,...tracks?{tracks}:{}};
  return {previous:this.current,state,publication:publication as unknown as SnapshotMessage<true>,owner:this.identity};
 }
 canCommit(packet:SnapshotMessage<true>,draft:PreparedResidentMotion):boolean {return draft.owner===this.identity&&draft.previous===this.current&&own(packet,'motion')===draft.state.presence&&(!draft.state.presence||(packet as unknown as Data).motion===draft.state.value);}
 commit(original:SnapshotMessage<true>,packet:SnapshotMessage<true>,draft:PreparedResidentMotion):void {if(!this.canCommit(packet,draft))throw Error('Lost motion preparation');this.current=draft.state;admitted.set(original,{owner:this.identity,value:draft.state.value});}
 commitLiteral(original:SnapshotMessage<true>):void {this.current=undefined;admitted.set(original,{owner:this.identity,value:original.motion});}
}
