import {ResidentMotionEncoder,ResidentMotionFrameOwner,type ResidentMotionDelta,type PreparedResidentMotion} from './resident-motion';
import type {World} from '../sim/types';
import type {SnapshotMessage} from './snapshots';
import {ResidentFilthEncoder,ResidentFilthFrameOwner,type ResidentFilthDelta,type PreparedResidentFilth} from './resident-filth-section';
import {ResidentActorsEncoder,ResidentActorsFrameOwner,type ResidentActorsDelta} from './resident-actors-section';
import {ResidentResourceRowsEncoder379,ResidentResourceFrameOwner379,bindPreparedResidentResources379,type ResidentResourceSection379,type PreparedResidentResources379} from './resident-resource-section-379';
import {ResidentStructuresFrameOwner379,bindPreparedResidentStructures379,type ResidentStructuresSection379,type PreparedResidentStructures379} from './resident-structures-section-379';
import {ResidentFullRetainedEncoder379,ResidentFullRetainedFrameOwner379,type ResidentFullRetainedDelta379,type PreparedResidentFullRetained379} from './resident-full-retained-379';

/** Fixed Worker wire adaptation only. Public snapshots and saves keep complete
 * literal auxiliary fields. A zero is a reference marker, never a World value. */
export const RESIDENT_AUXILIARY_KEYS=['stockpiles','home','roofing'] as const;
export type ResidentAuxiliaryKey=typeof RESIDENT_AUXILIARY_KEYS[number];
type Presence={readonly present:false}|{readonly present:true;readonly value:unknown};
interface Held {readonly presence:Presence;readonly token:object}
type Sections=Record<ResidentAuxiliaryKey,Held>;
export interface ResidentAuxiliaryDelta {
 readonly epoch:number;readonly revision:number;readonly tick:number;readonly checkpoint:boolean;
 readonly baseRevision?:number;readonly sections:Partial<Record<ResidentAuxiliaryKey,Presence>>;
 /** Omitted only by the legacy v3 lane, whose World.filth stays literal. */
 readonly filth?:ResidentFilthDelta;
 readonly motion?:ResidentMotionDelta;
 readonly actors?:ResidentActorsDelta;
 readonly resources?:ResidentResourceSection379;
 readonly structures?:ResidentStructuresSection379;
 readonly retained379?:ResidentFullRetainedDelta379;
}
type AuxiliaryWire<T extends {world:object}>=T extends unknown?Omit<T,'world'|'motion'>&{readonly motion?:SnapshotMessage<true>['motion']|0;
 readonly world:Omit<T['world'],ResidentAuxiliaryKey|'filth'|'pawns'|'wildlife'|'resources'|'jobs'|'thermal'>&Partial<Record<ResidentAuxiliaryKey,0>>&{
  readonly filth?:T['world'] extends {filth?:infer F}?F|0:unknown;
  readonly pawns:World['pawns']|0;
  readonly resources?:World['resources']|0;
  readonly jobs:World['jobs']|0;
  readonly thermal?:World['thermal']|0;
  readonly wildlife?:Omit<NonNullable<World['wildlife']>,'animals'>&{readonly animals:NonNullable<World['wildlife']>['animals']|0};
 };
}:never;
export type ResidentAuxiliaryPublication=AuxiliaryWire<SnapshotMessage<true>>;
const own=(value:object,key:PropertyKey)=>Object.hasOwn(value,key);
const integer=(value:unknown,min=0):value is number=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=min;
function dataRecord(value:unknown):value is Record<string,unknown> {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 return Reflect.ownKeys(value).every(key=>typeof key==='string'&&Object.getOwnPropertyDescriptor(value,key)?.enumerable===true&&own(Object.getOwnPropertyDescriptor(value,key)!,'value'));
}
function dense(value:unknown):value is unknown[] {
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||Reflect.ownKeys(value).length!==value.length+1)return false;
 for(let i=0;i<value.length;i++){const field=Object.getOwnPropertyDescriptor(value,String(i));if(!field||!field.enumerable||!own(field,'value'))return false;}return true;
}
const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).length===keys.length&&Object.keys(value).every(key=>keys.includes(key));
const capturedKeys=new WeakMap<object,readonly string[]>();

/** The capture is a value copy, never an authoritative mutable reference or a
 * JSON witness. Own undefined, -0, key order and array order remain distinct. */
function copyData(value:unknown,depth=0):unknown {
 if(depth>24)throw Error('Auxiliary data depth');
 if(value===null||value===undefined||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return value;
 if(dense(value))return Object.freeze(value.map(v=>copyData(v,depth+1)));
 if(!dataRecord(value))throw Error('Auxiliary producer requires plain own data');
 const keys=Object.keys(value),out:Record<string,unknown>={};for(const key of keys)Object.defineProperty(out,key,{value:copyData(value[key],depth+1),writable:true,enumerable:true,configurable:true});capturedKeys.set(out,keys);return Object.freeze(out);
}
function validData(value:unknown,depth=0):boolean {
 if(depth>24)return false;
 if(value===null||value===undefined||typeof value==='string'||typeof value==='number'||typeof value==='boolean')return true;
 if(dense(value))return value.every(v=>validData(v,depth+1));
 return dataRecord(value)&&Object.keys(value).every(key=>validData(value[key],depth+1));
}
function sameData(before:unknown,value:unknown):boolean {
 if(Object.is(before,value))return true;
 if(before===null||value===null||typeof before!=='object'||typeof value!=='object')return false;
 if(Array.isArray(before)){
  if(!Array.isArray(value)||before.length!==value.length)return false;
  for(let i=0;i<before.length;i++)if(!sameData(before[i],value[i]))return false;return true;
 }
 if(Array.isArray(value))return false;
 const left=capturedKeys.get(before);if(!left)return false;
 const a=before as Record<string,unknown>,b=value as Record<string,unknown>;
 let count=0;for(const key in b)if(own(b,key)){if(key!==left[count++]||!sameData(a[key],b[key]))return false;}return count===left.length;
}
function samePresence(before:Presence|undefined,world:object,key:ResidentAuxiliaryKey):boolean {
 const present=own(world,key);return !!before&&before.present===present&&(!present||before.present&&sameData(before.value,(world as Record<string,unknown>)[key]));
}

/** One synchronous, read-only producer pass. The current response must still be
 * posted synchronously, exactly like SnapshotEncoder's existing alias contract. */
export class ResidentAuxiliaryEncoder {
 private epoch=0;private revision=0;private tick=-1;
 private previous:Partial<Record<ResidentAuxiliaryKey,Presence>>={};
 private readonly filth=new ResidentFilthEncoder();
 private readonly motion=new ResidentMotionEncoder();
 private readonly actors=new ResidentActorsEncoder();
 private readonly resources=new ResidentResourceRowsEncoder379();
 private readonly retained:ResidentFullRetainedEncoder379|undefined;
 constructor(private readonly compactActors=false,private readonly compactResources=false,private readonly ownedStructures=false,sourceOwner?:object){if(sourceOwner)this.retained=new ResidentFullRetainedEncoder379(sourceOwner);}
 clear():void {this.epoch=this.revision=0;this.tick=-1;this.previous={};this.filth.clear();this.motion.clear();this.actors.clear();this.resources.clear();this.retained?.clear();}
 capture(packet:SnapshotMessage<true>,actualSource?:World):{publication:ResidentAuxiliaryPublication;auxiliary:ResidentAuxiliaryDelta} {
  const checkpoint=packet.kind==='checkpoint';
  if(!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick)
   ||!checkpoint&&(packet.epoch!==this.epoch||packet.baseRevision!==this.revision||packet.revision!==this.revision+1||packet.world.tick<this.tick))throw Error('Missing auxiliary producer predecessor');
  const sections:Partial<Record<ResidentAuxiliaryKey,Presence>>={},next:Partial<Record<ResidentAuxiliaryKey,Presence>>={...this.previous};
  const world={...packet.world} as Record<string,unknown>;
  for(const key of RESIDENT_AUXILIARY_KEYS){
   if(checkpoint||!samePresence(this.previous[key],packet.world,key)){
    // All captures stage before any producer state is committed. No getter or
    // mutable World is retained if a later section fails its copy.
    const presence:Presence=Object.freeze(own(packet.world,key)?{present:true as const,value:copyData((packet.world as unknown as Record<string,unknown>)[key])}:{present:false as const});
    sections[key]=presence;next[key]=presence;
   }
   if(own(world,key))world[key]=0;
  }
  // Stage all ordinary captures before the filth producer can advance. Filth
  // compares its own copied rows and then removes only its graph from the wire.
  const source={...packet,world} as unknown as SnapshotMessage<true>;
  const resources=this.compactResources?this.resources.capture(source):undefined;
  const actors=this.compactActors?this.actors.prepare(resources?.packet??source):undefined;
  const motion=this.motion.prepare(actors?.packet??resources?.packet??source);
  const retained=this.retained?.prepare(motion.publication,actualSource);
  const captured=this.filth.capture(retained?.publication??motion.publication);
  this.motion.commit(motion);
  if(actors)this.actors.commit(actors);
  if(retained)this.retained!.commit(retained);
  this.epoch=packet.epoch;this.revision=packet.revision;this.tick=packet.world.tick;this.previous=next;
  return {publication:captured.publication as unknown as ResidentAuxiliaryPublication,auxiliary:{epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,checkpoint,
   ...checkpoint?{}:{baseRevision:packet.baseRevision},sections,filth:captured.filth,motion:motion.motion,...actors?{actors:actors.actors}:{},...resources?.resources?{resources:resources.resources}:{},...this.ownedStructures?{structures:{epoch:packet.epoch,revision:packet.revision,checkpoint,...checkpoint?{}:{baseRevision:packet.baseRevision}}}:{},...retained?{retained379:retained.delta}:{}}};
 }
}

interface State {readonly owner:object;readonly epoch:number;readonly revision:number;readonly tick:number;readonly sections:Sections}
export interface ResidentAuxiliaryFrame {token(key:ResidentAuxiliaryKey):object}
const states=new WeakMap<World,State>(),frames=new WeakMap<World,ResidentAuxiliaryFrame>();
export function readResidentAuxiliaryFrame(world:World):ResidentAuxiliaryFrame|undefined {return frames.get(world);}
export interface PreparedResidentAuxiliary {
 readonly packet:SnapshotMessage<true>;readonly state:State;readonly previous:State|undefined;
 readonly filth?:PreparedResidentFilth;
 readonly motion?:PreparedResidentMotion;readonly original:SnapshotMessage<true>;
 readonly actors?:NonNullable<ReturnType<ResidentActorsFrameOwner['prepare']>>;
 readonly resources?:PreparedResidentResources379;
 readonly structures?:PreparedResidentStructures379;
 readonly retained379?:PreparedResidentFullRetained379;
}
const preparedPackets=new WeakMap<object,PreparedResidentAuxiliary>();
/** Only a candidate prepared against this exact committed MAIN predecessor can
 * reuse its already checked stockpile row shape. No public flag grants this. */
export function canReuseResidentAuxiliaryStockpiles(packet:SnapshotMessage<true>,previous:World|undefined):boolean {
 const draft=preparedPackets.get(packet),state=previous&&states.get(previous);
 return !!draft&&!!state&&draft.previous===state&&draft.state.sections.stockpiles===state.sections.stockpiles
  &&packet.world.nextId>=previous!.nextId&&state.sections.stockpiles.presence.present&&state.sections.stockpiles.presence.value===previous!.stockpiles;
}

/** Reconstruction is staged; no state/token is published before the complete
 * base admission, natural preparation and extra validator all succeed. */
export class ResidentAuxiliaryFrameOwner {
 private readonly identity={};private current:State|undefined;
 private readonly filth=new ResidentFilthFrameOwner();
 private readonly motion=new ResidentMotionFrameOwner();
 private readonly actors=new ResidentActorsFrameOwner();
 private readonly resources=new ResidentResourceFrameOwner379();
 private readonly structures=new ResidentStructuresFrameOwner379();
 private readonly retained=new ResidentFullRetainedFrameOwner379();
 readMotion(packet:SnapshotMessage<true>){return this.motion.read(packet);}
 commitLiteralMotion(packet:SnapshotMessage<true>):void {this.motion.commitLiteral(packet);}
 clear():void {this.current=undefined;this.filth.clear();this.motion.clear();this.actors.clear();this.resources.clear();this.structures.clear();this.retained.clear();}
 prepare(packet:SnapshotMessage<true>,raw:unknown,privateLease379?:unknown):PreparedResidentAuxiliary|'stale'|undefined {
  if(!dataRecord(packet)||!dataRecord(packet.world)||!integer(packet.epoch,1)||!integer(packet.revision,1)||!integer(packet.world.tick))return;
  const old=this.current,checkpoint=packet.kind==='checkpoint';
  if(old&&(packet.epoch<old.epoch||packet.epoch===old.epoch&&packet.revision<=old.revision))return 'stale';
  if(!dataRecord(raw)||!exactKeys(raw,[...(checkpoint?['epoch','revision','tick','checkpoint','sections']:['epoch','revision','tick','checkpoint','baseRevision','sections']),...own(raw,'filth')?['filth']:[],...own(raw,'motion')?['motion']:[],...own(raw,'actors')?['actors']:[],...own(raw,'resources')?['resources']:[],...own(raw,'structures')?['structures']:[],...own(raw,'retained379')?['retained379']:[]])
   ||raw.epoch!==packet.epoch||raw.revision!==packet.revision||raw.tick!==packet.world.tick||raw.checkpoint!==checkpoint||!dataRecord(raw.sections)
   ||Object.keys(raw.sections).some(key=>!(RESIDENT_AUXILIARY_KEYS as readonly string[]).includes(key))
   ||checkpoint&&Object.keys(raw.sections).length!==RESIDENT_AUXILIARY_KEYS.length
   ||!checkpoint&&(!old||old.epoch!==packet.epoch||packet.baseRevision!==old.revision||raw.baseRevision!==old.revision||packet.revision!==old.revision+1||packet.world.tick<old.tick))return;
  const original=packet;let motion:PreparedResidentMotion|undefined;
  let actors:PreparedResidentAuxiliary['actors'];
  if(own(raw,'actors')){actors=this.actors.prepare(packet,raw.actors);if(!actors)return;packet=actors.packet;}
  else if((packet.world as unknown as Record<string,unknown>).pawns===0||(packet.world.wildlife as unknown as Record<string,unknown>|undefined)?.animals===0)return;
  let resources:PreparedResidentResources379|undefined;
  if(own(raw,'resources')){resources=this.resources.prepare(packet,raw.resources,privateLease379);if(!resources)return;packet=resources.packet;}
  else if((packet.world as unknown as Record<string,unknown>).resources===0)return;
  let structures:PreparedResidentStructures379|undefined;
  if(own(raw,'structures')){structures=this.structures.prepare(packet,raw.structures);if(!structures)return;packet=structures.packet;}
  let retained379:PreparedResidentFullRetained379|undefined;
  if(own(raw,'retained379')){retained379=this.retained.prepare(packet,raw.retained379);if(!retained379)return;packet=retained379.packet;}
  else{const literal=packet.world as unknown as Record<string,unknown>;if(literal.jobs===0||literal.thermal===0)return;}
  if(own(raw,'motion')){const prepared=this.motion.prepare(packet,raw.motion,privateLease379);if(!prepared)return;motion=prepared;packet=prepared.publication;}
  else if(own(packet,'motion')&&(packet as unknown as Record<string,unknown>).motion===0)return;
  let filth:PreparedResidentFilth|undefined;
  if(own(raw,'filth')){
   const prepared=this.filth.prepare(packet,raw.filth);if(!prepared||prepared==='stale')return;
   filth=prepared;packet=prepared.packet;
  }
  const sections={} as Sections,world={...packet.world} as Record<string,unknown>;
  for(const key of RESIDENT_AUXILIARY_KEYS){
   let held:Held|undefined;
   if(own(raw.sections,key)){
    const value=raw.sections[key];if(!dataRecord(value)||typeof value.present!=='boolean'||!exactKeys(value,value.present?['present','value']:['present'])||value.present&&!validData(value.value))return;
    held={presence:value as unknown as Presence,token:{}};
   }else held=old?.sections[key];
   if(!held)return;
   const present=own(world,key);if(present!==held.presence.present||present&&world[key]!==0)return;
   if(present&&held.presence.present)world[key]=held.presence.value;
   sections[key]=held;
  }
  const full={...packet,world} as SnapshotMessage<true>,state:State={owner:this.identity,epoch:packet.epoch,revision:packet.revision,tick:packet.world.tick,sections};
  const draft={packet:full,state,previous:old,original,...filth?{filth}:{},...motion?{motion}:{},...actors?{actors}:{},...resources?{resources}:{},...structures?{structures}:{},...retained379?{retained379}:{}};preparedPackets.set(full,draft);if(resources)bindPreparedResidentResources379(full,resources);if(structures)bindPreparedResidentStructures379(full,structures);return draft;
 }
 canCommit(world:World,draft:PreparedResidentAuxiliary):boolean {
  if(draft.state.owner!==this.identity||draft.previous!==this.current||draft.filth&&!this.filth.canCommit(world,draft.filth)||draft.motion&&!this.motion.canCommit(draft.packet,draft.motion)||draft.actors&&!this.actors.canCommit(world,draft.actors)||draft.resources&&!this.resources.canCommit(world,draft.resources)||draft.structures&&!this.structures.canCommit(world,draft.structures)||draft.retained379&&!this.retained.canCommit(world,draft.retained379))return false;
  for(const key of RESIDENT_AUXILIARY_KEYS){const p=draft.state.sections[key].presence;if(own(world,key)!==p.present||p.present&&(world as unknown as Record<string,unknown>)[key]!==p.value)return false;}
  return true;
 }
 commit(world:World,draft:PreparedResidentAuxiliary):void {
  if(!this.canCommit(world,draft))throw Error('Lost auxiliary frame preparation');
  if(draft.filth)this.filth.commit(world,draft.filth);else this.filth.clear();
  if(draft.motion)this.motion.commit(draft.original,draft.packet,draft.motion);else this.motion.commitLiteral(draft.original);
  if(draft.actors)this.actors.commit(world,draft.actors);else this.actors.clear();
  if(draft.resources)this.resources.commit(world,draft.resources);else this.resources.clear();
  if(draft.structures)this.structures.commit(world,draft.structures);else this.structures.clear();
  if(draft.retained379)this.retained.commit(world,draft.retained379);else this.retained.clear();
  // The public read capability retains three empty tokens, never this draft,
  // its full packet, a World, the owner or a predecessor chain.
  const tokens=Object.fromEntries(RESIDENT_AUXILIARY_KEYS.map(key=>[key,draft.state.sections[key].token])) as Record<ResidentAuxiliaryKey,object>;
  const frame=Object.freeze({token:(key:ResidentAuxiliaryKey)=>tokens[key]});
  this.current=draft.state;states.set(world,draft.state);frames.set(world,frame);
 }
}
