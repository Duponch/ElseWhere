import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {validCapturedCoreMove297} from '../sim/core-move-save-297.ts';
import {MotionRecorder,type PawnTrack} from './motion-tracks.ts';
import type {PresentationSegment} from '../sim/travel-timing.ts';
import type {SnapshotMessage} from './snapshots.ts';

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
function freezeCopied(v:unknown):unknown {const result=copy(v);const freeze=(x:unknown):void=>{if(x&&typeof x==='object'){for(const key of Object.keys(x))freeze((x as Data)[key]);Object.freeze(x);}};freeze(result);return result;}
/** The checks of segment() before its copy test. */
function segmentFields(v:unknown,version:number):v is PresentationSegment {
 if(!record(v)||Object.keys(v).some(k=>!['from','to','start','end','terrainDelay','speedFactor','stagger','stuns','animalFlight','snowEntryPending','edgeStart','fromFraction','toFraction',...(isCorePhysicalSchema297(version)?['coreMove297','coreMoveWalk297','stop297']:[])].includes(k)))return false;
 if(!validCapturedCoreMove297(v,version)||!validPresentationStop297(v,version))return false;
 for(const name of ['from','to']){const c=v[name];if(!record(c)||!exact(c,['x','z'])||typeof c.x!=='number'||!Number.isFinite(c.x)||typeof c.z!=='number'||!Number.isFinite(c.z))return false;}
 if(typeof v.start!=='number'||!Number.isFinite(v.start)||typeof v.end!=='number'||!Number.isFinite(v.end)||v.end<v.start)return false;
 return true;
}
function segment(v:unknown,version:number):v is PresentationSegment {
 if(!segmentFields(v,version))return false;
 try{copy(v);return true;}catch{return false;}
}
/** A valid segment's copy, made once (segment() then copy() copied it twice). */
function copiedSegment(v:unknown,version:number):PresentationSegment|undefined {
 if(!segmentFields(v,version))return undefined;
 try{return copy(v) as PresentationSegment;}catch{return undefined;}
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
    if(prior){drop=current.length?prior.sources.indexOf(current[0]!):prior.sources.length;if(drop<0)drop=0;
     while(keep<current.length&&drop+keep<prior.sources.length&&current[keep]===prior.sources[drop+keep]){
      const value=current[keep]!;
      if((own(value,'stagger')||own(value,'stuns'))&&!same(prior.values[drop+keep],value))break;
      keep++;
     }
    }
    const appended=current.slice(keep).map(value=>{const copied=copiedSegment(value,packet.world.schemaVersion);if(!copied)throw Error('Invalid recorded motion segment');return copied;});
    const values=prior?prior.values.slice(drop,drop+keep).concat(appended):appended;
    if(!prior||drop||keep!==prior.sources.length||appended.length)rows.push({id:track.id,drop,keep,append:appended});
    next.push({id:track.id,sources:current.slice(),values});
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

interface State {readonly epoch:number;readonly revision:number;readonly tick:number;readonly presence:boolean;readonly value:unknown;readonly tracks?:readonly PawnTrack[]}
export interface PreparedResidentMotion {readonly previous:State|undefined;readonly state:State;readonly publication:SnapshotMessage<true>;readonly owner:object}
const admitted=new WeakMap<object,{owner:object;value:unknown}>();
export class ResidentMotionFrameOwner {
 private readonly identity={};private current:State|undefined;
 clear():void {this.current=undefined;}
 read(packet:SnapshotMessage<true>):PawnTrack[]|undefined {const value=admitted.get(packet);if(value?.owner!==this.identity)throw Error('Motion read before successful admission');return value.value as PawnTrack[]|undefined;}
 prepare(packet:SnapshotMessage<true>,raw:unknown):PreparedResidentMotion|undefined {
  if(!record(raw)||!record(packet)||!record(packet.world)||!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick)||!compatible(packet,this.current)
   ||!exact(raw,packet.kind==='checkpoint'?['epoch','revision','tick','checkpoint','section']:['epoch','revision','tick','checkpoint','baseRevision','section'])
   ||raw.epoch!==packet.epoch||raw.revision!==packet.revision||raw.tick!==packet.world.tick||raw.checkpoint!==(packet.kind==='checkpoint')||packet.kind==='delta'&&raw.baseRevision!==packet.baseRevision||!record(raw.section))return;
  const section=raw.section;let value:unknown,tracks:PawnTrack[]|undefined,presence=true;
  if(section.mode==='absent'){if(!exact(section,['mode'])||own(packet,'motion'))return;presence=false;}
  else if(section.mode==='literal'){if(!exact(section,['mode','value'])||!own(packet,'motion')||(packet as unknown as Data).motion!==0)return;try{value=copy(section.value,0,packet.world.schemaVersion);}catch{return;}}
  else if(section.mode==='tracks'){
   if(!exact(section,own(section,'order')?['mode','reset','count','removed','rows','order']:['mode','reset','count','removed','rows'])||typeof section.reset!=='boolean'||packet.kind==='checkpoint'&&!section.reset
    ||!integer(section.count)||section.count>=packet.world.nextId||!dense(section.removed)||!dense(section.rows)||own(section,'order')&&!dense(section.order)
    ||!own(packet,'motion')||(packet as unknown as Data).motion!==0||!section.reset&&!this.current?.tracks)return;
   const before=section.reset?[]:this.current!.tracks!,byId=new Map(before.map(row=>[row.id,row])),touched=new Set<number>();
   if(section.reset&&(section.removed.length||own(section,'order')))return;
   for(const id of section.removed){if(!integer(id,1)||touched.has(id)||!byId.has(id))return;touched.add(id);byId.delete(id);}
   for(const item of section.rows){
    if(!record(item)||!exact(item,['id','drop','keep','append'])||!integer(item.id,1)||item.id>=packet.world.nextId||touched.has(item.id)||!integer(item.drop)||!integer(item.keep)||!dense(item.append)||!item.append.every(value=>segment(value,packet.world.schemaVersion)))return;
    touched.add(item.id);const prior=byId.get(item.id),held=prior?.segments??[];
    if(item.drop+item.keep>held.length||!prior&&(item.drop||item.keep))return;
    const segments=held.slice(item.drop,item.drop+item.keep).concat(item.append.map(v=>freezeCopied(v) as PresentationSegment));
    Object.freeze(segments);byId.set(item.id,Object.freeze({id:item.id,segments}));
   }
   if(own(section,'order')){const order=section.order as unknown[];if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!integer(id,1)||!byId.has(id)))return;tracks=order.map(id=>byId.get(id as number)!);}
   else tracks=[...byId.values()];if(tracks.length!==section.count)return;Object.freeze(tracks);value=tracks;
  }else return;
  const publication={...packet} as unknown as Data;if(presence)publication.motion=value;
  const state:State={epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,presence,value,...tracks?{tracks}:{}};
  return {previous:this.current,state,publication:publication as unknown as SnapshotMessage<true>,owner:this.identity};
 }
 canCommit(packet:SnapshotMessage<true>,draft:PreparedResidentMotion):boolean {return draft.owner===this.identity&&draft.previous===this.current&&own(packet,'motion')===draft.state.presence&&(!draft.state.presence||(packet as unknown as Data).motion===draft.state.value);}
 commit(original:SnapshotMessage<true>,packet:SnapshotMessage<true>,draft:PreparedResidentMotion):void {if(!this.canCommit(packet,draft))throw Error('Lost motion preparation');this.current=draft.state;admitted.set(original,{owner:this.identity,value:draft.state.value});}
 commitLiteral(original:SnapshotMessage<true>):void {this.current=undefined;admitted.set(original,{owner:this.identity,value:original.motion});}
}
