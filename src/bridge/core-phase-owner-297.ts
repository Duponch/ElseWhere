import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import type {World,Pawn} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import type {Mechanoid} from '../sim/mechanoid-state';
import type {PawnTrack} from './motion-tracks';
import type {PresentationSegment} from '../sim/travel-timing';
import {effectiveCore297} from '../sim/core-phase-297';
import {coreAnchor297,coreInteger297,coreOwnRecord297,copyCoreData297,readCorePhaseData297,validCoreTrace297} from './core-phase-data-297';
import {CORE_HUMAN_OPTIONAL297,CORE_ANIMAL_OPTIONAL297,CORE_MECH_OPTIONAL297,type CoreActorMode297,type CoreActorScene297,type CoreActorSceneRecord297,type CorePhaseAnchor297,type CoreFullPhaseMetadata297,type CorePhaseTypedProjection297,type CoreActorProjection297,type CoreProjectileTrace297} from './core-phase-projection-297';

/* Same contract as copyCoreData297 (pinned in core-phase-data-297.ts): the
 * same budget, depth, cycle, finite-number, dense-array and plain-own-data
 * rejections with the same messages, and an identical deeply frozen result
 * (same keys and order; frozen properties are non-writable/non-configurable).
 * It reads each property descriptor once and assigns before freezing instead
 * of two descriptor reads plus defineProperty per key, which made the actor
 * copy of every Full ~15% of the main thread on large colonies. */
export function frozenDataCopy297<T>(value:T):T {
 const active=new Set<object>();let left=1048576;
 const copy=(v:unknown,depth:number):unknown=>{
  if(--left<0||depth>24)throw Error('Core phase payload budget exceeded');
  if(v===undefined||v===null||typeof v==='string'||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v))throw Error('Nonfinite Core phase number');return v;}
  if(typeof v!=='object'||active.has(v))throw Error('Cyclic or non-data Core phase value');active.add(v);
  try{
   if(Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1){
    const n=v.length,values:unknown[]=new Array(n);let dense=true;
    for(let i=0;i<n;i++){const d=Object.getOwnPropertyDescriptor(v,String(i));if(!d?.enumerable||!Object.hasOwn(d,'value')){dense=false;break;}values[i]=d.value;}
    if(dense){const out:unknown[]=new Array(n);for(let i=0;i<n;i++)out[i]=copy(values[i],depth+1);return Object.freeze(out);}
   }
   if(Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)throw Error('Core phase requires plain own data');
   const keys=Reflect.ownKeys(v),values:unknown[]=new Array(keys.length);
   for(let i=0;i<keys.length;i++){const k=keys[i]!;const d=typeof k==='string'?Object.getOwnPropertyDescriptor(v,k):undefined;if(!d||d.enumerable!==true||!Object.hasOwn(d,'value'))throw Error('Core phase requires plain own data');values[i]=d.value;}
   const out:Record<string,unknown>={};
   for(let i=0;i<keys.length;i++){const k=keys[i] as string,copied=copy(values[i],depth+1);if(k==='__proto__')Object.defineProperty(out,k,{value:copied,enumerable:true,writable:true,configurable:true});else out[k]=copied;}
   return Object.freeze(out);
  }finally{active.delete(v);}
 };
 return copy(value,0) as T;
}
type State={anchor:CorePhaseAnchor297;world:World;actorScene:CoreActorScene297;actorMode:CoreActorMode297;core:number;nextId:number;seq:number;tracks:PawnTrack[];trace:Map<number,CoreProjectileTrace297>};
export interface PreparedCoreFull297 {readonly previous:object|undefined;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
export interface PreparedCorePhase297 {readonly previous:object;readonly projection:CorePhaseTypedProjection297;readonly owner:object}
/** Representation staging only. This class alone grants NO Native/renderer
 * authority. The fixed trusted-event lane is the sole caller allowed to mint
 * a private renderer token after its successful commit. */
export class CorePhaseFrameOwner297 {
 private state:State|undefined;
 private readonly identity={};
 private prepared=new WeakMap<object,State>();
 clear():void {this.state=undefined;this.prepared=new WeakMap<object,State>();}
 get currentCore():number|undefined{return this.state?.core;}
 get currentNextId():number|undefined{return this.state?.nextId;}
 get currentAnchor():CorePhaseAnchor297|undefined{return this.state?.anchor;}
 get currentSequence():number|undefined{return this.state?.seq;}
 prepareFull(world:World,epoch:number,revision:number,motion:PawnTrack[]|undefined,metadata:unknown,speed:0|1|3|6,reset=false):PreparedCoreFull297 {
  if(!isCorePhysicalSchema297(Number(world.schemaVersion)))throw Error('Phase anchor requires current schema297');
  const core=effectiveCore297(world),m=copyCoreData297(metadata);
  const frontier=coreOwnRecord297(m)&&Object.hasOwn(m,'actorMode297');
  if(!coreOwnRecord297(m)||Reflect.ownKeys(m).length!==(frontier?4:3)||frontier&&m.actorMode297!=='frontier'||!Object.hasOwn(m,'mapId')||!Object.hasOwn(m,'core')||!Object.hasOwn(m,'projectilesRetained')||m.core!==core||!coreInteger297(m.mapId)||!Array.isArray(m.projectilesRetained))throw Error('Invalid full Core phase metadata');
  const anchor=coreAnchor297(world,epoch,revision,core,m.mapId),old=this.state,same=!reset&&old?.anchor.epoch===epoch&&old.anchor.mapId===m.mapId;
  if(same&&(core<old!.core||world.nextId<old!.nextId))throw Error('Full World predates its committed actor phase');
  if(!Array.isArray(motion))throw Error('Full Core anchor lost confirmed tracks');
  const tracks=frozenDataCopy297(motion),trace=same?new Map(old!.trace):new Map<number,CoreProjectileTrace297>(),seen=new Set<number>();
  for(const value of m.projectilesRetained){if(!validCoreTrace297(value,anchor,core)||seen.has(value.id))throw Error('Invalid retained Core projectile');seen.add(value.id);trace.set(value.id,value);}
  for(const[id,value]of trace)if(value.endCore<core-640)trace.delete(id);
  const actorMode:CoreActorMode297=frontier?'frontier':'same-civil',actorScene=this.scene(core,frozenDataCopy297(world.pawns),frozenDataCopy297(world.wildlife?.animals??[]),frozenDataCopy297(world.mechanoids??[]));
  const next:State={anchor,world,actorScene,actorMode,core,nextId:world.nextId,seq:0,tracks,trace};
  const projection:CorePhaseTypedProjection297=Object.freeze({kind:'full',audioCues:Object.freeze([]),anchor,phaseSeq:0,nextId:world.nextId,fromCore:core,core,speed,world,actorScene,actors:Object.freeze([]),tracks,projectiles:Object.freeze({upserted:Object.freeze([...trace.values()]),removed:Object.freeze([])})});
  const result=Object.freeze({previous:old,projection,owner:this.identity});this.prepared.set(result,next);return result;
 }
 commitFull(prepared:PreparedCoreFull297):CorePhaseTypedProjection297 {
  const next=this.prepared.get(prepared);if(!next||prepared.owner!==this.identity||prepared.previous!==this.state)throw Error('Stale Core full staging');
  this.prepared.delete(prepared);this.state=next;return prepared.projection;
 }
 adoptFull(world:World,epoch:number,revision:number,motion:PawnTrack[]|undefined,metadata:unknown,speed:0|1|3|6,reset=false):CorePhaseTypedProjection297 {
  return this.commitFull(this.prepareFull(world,epoch,revision,motion,metadata,speed,reset));
 }
 prepare(raw:unknown):PreparedCorePhase297 {
  const before=this.state;if(!before)throw Error('Actor phase before Native full anchor');
  const input=readCorePhaseData297(raw,before.anchor,before.core,before.seq+1,before.nextId,new Set(before.trace.keys()),before.actorMode);
  const actorScene=this.patchActors(before.actorScene,input.actors,input.toCore),trackMap=new Map(before.tracks.map(t=>[t.id,t]));
  for(const patch of input.tracks){if(!trackMap.has(patch.id)&&![...before.anchor.layout.human,...before.anchor.layout.animal,...before.anchor.layout.mechanical].includes(patch.id))throw Error('Unknown actor track outside the anchored layout');const previous=trackMap.get(patch.id)?.segments??[];
   if(patch.drop+patch.keep>previous.length||!trackMap.has(patch.id)&&(patch.drop!==0||patch.keep!==0))throw Error('Core motion predecessor mismatch');
   const segments=Object.freeze([...previous.slice(patch.drop,patch.drop+patch.keep),...patch.append]) as unknown as PresentationSegment[];
   trackMap.set(patch.id,Object.freeze({id:patch.id,segments}));
  }
  const tracks=Object.freeze([...trackMap.values()]) as unknown as PawnTrack[],trace=new Map(before.trace);
  for(const value of input.projectiles.upserted)trace.set(value.id,value);
  // removed means physical SIM cleanup, never erasure of playable history.
  for(const[id,value]of trace)if(value.endCore<input.toCore-640)trace.delete(id);
  const next:State={anchor:before.anchor,world:before.world,actorScene,actorMode:before.actorMode,core:input.toCore,nextId:input.nextId,seq:input.phaseSeq,tracks,trace};
  const projection:CorePhaseTypedProjection297=Object.freeze({kind:'phase',audioCues:input.audioCues,anchor:before.anchor,phaseSeq:input.phaseSeq,nextId:input.nextId,fromCore:input.fromCore,core:input.toCore,speed:input.speed,world:before.world,actorScene,actors:input.actors,tracks,projectiles:input.projectiles});
  const result=Object.freeze({previous:before,projection,owner:this.identity});this.prepared.set(result,next);return result;
 }
 commit(prepared:PreparedCorePhase297):CorePhaseTypedProjection297 {
  const next=this.prepared.get(prepared);if(!next||prepared.owner!==this.identity||prepared.previous!==this.state)throw Error('Stale Core phase staging');
  this.prepared.delete(prepared);this.state=next;return prepared.projection;
 }
 private scene(core:number,humans:readonly Readonly<Pawn>[],animals:readonly Readonly<WildAnimal>[],mechanical:readonly Readonly<Mechanoid>[]):CoreActorScene297 {
  const byId:Record<number,CoreActorSceneRecord297>={};
  const put=(id:number,value:CoreActorSceneRecord297)=>{if(Object.hasOwn(byId,id))throw Error('Duplicate actor scene ID');Object.defineProperty(byId,id,{value:Object.freeze(value),enumerable:true,writable:false,configurable:false});};
  humans.forEach((actor,index)=>put(actor.id,{kind:'human',index,actor}));
  animals.forEach((actor,index)=>put(actor.id,{kind:'animal',index,actor}));
  mechanical.forEach((actor,index)=>put(actor.id,{kind:'mechanical',index,actor}));
  return Object.freeze({core,humans:Object.freeze(humans),animals:Object.freeze(animals),mechanical:Object.freeze(mechanical),byId:Object.freeze(byId)});
 }
 private patchActors(base:CoreActorScene297,changes:readonly CoreActorProjection297[],core:number):CoreActorScene297 {
  if(changes.length===0)return Object.freeze({...base,core});
  let humans:Readonly<Pawn>[]|undefined,animals:Readonly<WildAnimal>[]|undefined,mechanical:Readonly<Mechanoid>[]|undefined;
  for(const row of changes){const source=row.kind==='human'?(humans??base.humans)[row.index]:row.kind==='animal'?(animals??base.animals)[row.index]:(mechanical??base.mechanical)[row.index];
   if(!source||source.id!==row.id)throw Error('Changed Core actor escaped its anchored slot');
   const clone={...source} as unknown as Record<string,unknown>,optionals=row.kind==='human'?CORE_HUMAN_OPTIONAL297:row.kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
   for(const key of optionals)if(!Object.hasOwn(row.fields,key))delete clone[key];
   for(const key of Object.keys(row.fields))Object.defineProperty(clone,key,{value:(row.fields as unknown as Record<string,unknown>)[key],enumerable:true,writable:false,configurable:false});Object.freeze(clone);
   if(row.kind==='human')(humans??=base.humans.slice())[row.index]=clone as unknown as Readonly<Pawn>;
   else if(row.kind==='animal')(animals??=base.animals.slice())[row.index]=clone as unknown as Readonly<WildAnimal>;
   else (mechanical??=base.mechanical.slice())[row.index]=clone as unknown as Readonly<Mechanoid>;
  }
  return this.scene(core,humans??base.humans,animals??base.animals,mechanical??base.mechanical);
 }
}
