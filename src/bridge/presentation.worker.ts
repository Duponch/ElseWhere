import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {validPhaseCore297} from '../sim/core-phase-297';
import {ResidentMotionRecorder} from './resident-motion';
import {SourceMotionPhasePublisher297} from './source-motion-phase-publisher-297';
import {encodeCorePhaseWire379} from './core-phase-wire-379';
/// <reference lib="webworker" />
import {startSimulationWorker} from './simulation-runtime';
import {residentPublication} from './resident-protocol';
import {TerrainJournalSnapshotEncoder} from './terrain-journal-encoder';
import {ResidentAuxiliaryEncoder} from './resident-auxiliary-sections';
import {withJournalTerrainReadScope} from '../sim/terrain-read-scope';
import type {World} from '../sim/types';
import type {SnapshotMessage} from './snapshots';
import {WorkerNaturalAppearance} from './worker-natural-appearance';
import {RESIDENT_CROP_KINDS} from './natural-appearance-values';
import {FLORA_DEFINITIONS} from '../sim/biome-flora';
import {PLANT_DEFINITIONS} from '../sim/plants';
import {CROP_KINDS} from '../sim/crops';
import {CAVE_PLANT_SPECIES_256} from '../sim/cave-flora-256';
import {WILD_PLANT_GENERATION_FACTS_256} from '../sim/wild-plant-generation-data-256';
import {CLIMATE_DEFINITIONS} from '../sim/site-climate';
import {NATURAL_TERRAIN_DEFINITIONS_256,NATURAL_TERRAIN_BINDINGS_256} from '../sim/local-terrain-definitions-256';
import {PACKED_DIRT_256} from '../sim/road-ground-256';
import {SMOOTHED_STONE_FACTS_281} from '../sim/smooth-floor-terrain-281';
import {STONE_KINDS} from '../sim/geology';

type Value=undefined|null|boolean|number|string|Value[]|{[key:string]:Value};
const CONTEXT_BUDGET=8192,STRUCTURE_BUDGET=4096,BASIN_BUDGET=64;
// plant-substrate retains initial FACTS row identities in its private Map.
// Never renew this binding verdict after clear, replacement or a full capture.
const factsInitialKeys=Reflect.ownKeys(WILD_PLANT_GENERATION_FACTS_256);
const factsInitialRefs=factsInitialKeys.map(key=>Object.getOwnPropertyDescriptor(WILD_PLANT_GENERATION_FACTS_256,key)?.value as unknown);
let factsBindingsStable=true;
function initialFactsBindings():boolean {
 if(!factsBindingsStable)return false;
 try{
  const keys=Reflect.ownKeys(WILD_PLANT_GENERATION_FACTS_256);
  if(keys.length!==factsInitialKeys.length)throw Error('Facts bindings changed');
  for(let i=0;i<keys.length;i++){
   const key=keys[i]!,field=Object.getOwnPropertyDescriptor(WILD_PLANT_GENERATION_FACTS_256,key);
   if(typeof key!=='string'||key!==factsInitialKeys[i]||!field?.enumerable||!('value'in field)||field.value!==factsInitialRefs[i])throw Error('Facts binding changed');
  }
  return true;
 }catch{factsBindingsStable=false;return false;}
}
function ownData(value:unknown,key:string):unknown {
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error('Unowned context');
 const field=Object.getOwnPropertyDescriptor(value,key);if(!field)return undefined;
 if(!('value'in field)||!field.enumerable)throw Error('Context accessor');return field.value;
}
function copyValue(value:unknown,budget:{left:number},active:Set<object>,depth=0):Value {
 if(--budget.left<0||depth>12)throw Error('Context budget');
 if(value===null||value===undefined||typeof value==='boolean'||typeof value==='string')return value;
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Nonfinite context');return value;}
 if(typeof value!=='object'||active.has(value))throw Error('Unsupported context');active.add(value);
 try{
  if(Array.isArray(value)){
   const length=Object.getOwnPropertyDescriptor(value,'length')?.value;
   if(Object.getPrototypeOf(value)!==Array.prototype||!Number.isSafeInteger(length)||length>budget.left||Reflect.ownKeys(value).length!==length+1)throw Error('Context array');
   const out:Value[]=[];for(let i=0;i<length;i++){const field=Object.getOwnPropertyDescriptor(value,String(i));if(!field?.enumerable||!('value'in field))throw Error('Context hole/accessor');out.push(copyValue(field.value,budget,active,depth+1));}return out;
  }
  if(Object.getPrototypeOf(value)!==Object.prototype)throw Error('Context prototype');
  const keys=Reflect.ownKeys(value);if(keys.length>budget.left)throw Error('Context keys');const out:{[key:string]:Value}={};
  for(const key of keys){if(typeof key!=='string')throw Error('Context symbol');const field=Object.getOwnPropertyDescriptor(value,key);if(!field?.enumerable||!('value'in field))throw Error('Context field');Object.defineProperty(out,key,{value:copyValue(field.value,budget,active,depth+1),enumerable:true});}return out;
 }finally{active.delete(value);}
}
function sameValue(a:Value,b:Value):boolean {
 if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const keys=Object.keys(a),other=Object.keys(b);return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&sameValue((a as Record<string,Value>)[key]!, (b as Record<string,Value>)[key]!));
}
function contextValue(world:World):Value|undefined {
 try{
  if(!initialFactsBindings())return;
  if(ownData(world,'worldMaps')!==undefined)return;
  const fields=['tick','schemaVersion','seed','width','height','nextId','climate','growingZones'];const values=fields.map(key=>ownData(world,key));
  const roof=ownData(world,'roofing'),natural=ownData(roof,'natural'),weather=ownData(ownData(world,'miscIncidents'),'weather');
  const structures=ownData(world,'structures');if(!Array.isArray(structures)||structures.length>STRUCTURE_BUDGET)return;
  const basins=[];for(let i=0;i<structures.length;i++){const field=Object.getOwnPropertyDescriptor(structures,String(i));if(!field||!('value'in field))throw Error('Structure hole');const s=field.value;if(ownData(s,'kind')==='hydroponics-basin'){if(basins.length>=BASIN_BUDGET)return;basins.push(['id','kind','x','z','orientation','footprint','footprintLegacy'].map(key=>ownData(s,key)));}}
  const defs=[FLORA_DEFINITIONS,PLANT_DEFINITIONS,CROP_KINDS,RESIDENT_CROP_KINDS,CAVE_PLANT_SPECIES_256,factsInitialRefs,CLIMATE_DEFINITIONS,NATURAL_TERRAIN_DEFINITIONS_256,NATURAL_TERRAIN_BINDINGS_256,PACKED_DIRT_256,SMOOTHED_STONE_FACTS_281,STONE_KINDS];
  return copyValue([values,!!ownData(world,'gameProfile'),[ownData(roof,'constructed'),ownData(natural,'thin'),ownData(natural,'thick')],ownData(weather,'eclipse'),basins,defs],{left:CONTEXT_BUDGET},new Set());
 }catch{return;}
}
class EncoderNatural extends WorkerNaturalAppearance {
 private allowed=false;
 protected override canReuseInputs():boolean{return this.allowed;}
 read(world:World,publication:SnapshotMessage<true>,allow:boolean){this.allowed=allow;try{return super.capture(world,publication);}finally{this.allowed=false;}}
}
type NaturalCommit={world:World;epoch:number;revision:number;tick:number;schema:World['schemaVersion'];seed:World['seed'];width:number;height:number;nextId:number;context:Value|undefined};


/** Fixed entry only. A sidecar is computed before encode exposes its packet. */
class FixedPresentationEncoder extends TerrainJournalSnapshotEncoder {
 protected override usesClosedResourceJournal=true;
 private readonly natural=new EncoderNatural();
 private committed:NaturalCommit|undefined;
 private pending:{packet:SnapshotMessage<true>;appearance:ReturnType<WorkerNaturalAppearance['capture']>}|undefined;
 clearNatural():void {this.pending=undefined;this.committed=undefined;this.natural.clear();}
 takeNatural(originalPacket:SnapshotMessage<true>){
  const held=this.pending;this.pending=undefined;
  if(!held||held.packet!==originalPacket){this.committed=undefined;this.forcePublicationCheckpoint();throw Error('Natural sidecar does not belong to the current original packet');}
  return held.appearance;
 }
 override encode(world:World,stepMs:number,speed:number,checkpoint=false):SnapshotMessage<true> {
  if(this.pending){this.clearNatural();this.forcePublicationCheckpoint();}
  const supported=Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))&&validPhaseCore297(world,Number(world.schemaVersion));
  if(!supported)this.committed=undefined;
  const prior=this.committed;
  const possible=!!prior&&prior.world===world&&Object.is(prior.tick,world.tick)&&Object.is(prior.schema,world.schemaVersion)&&Object.is(prior.seed,world.seed)&&prior.width===world.width&&prior.height===world.height&&prior.nextId===world.nextId;
  this.trackNaturalInputs=possible&&prior!.context!==undefined&&!checkpoint;
  try{
   const packet=super.encode(world,stepMs,speed,checkpoint);
   // Warming does not grant authority; a changed tick still disables tracking.
   const context=supported&&(possible||speed===0||world.pawns.some(p=>!!p.draft))?contextValue(world):undefined;
   const reuse=this.naturalInputsUnchanged&&packet.kind==='delta'&&!!prior&&packet.epoch===prior.epoch&&packet.baseRevision===prior.revision&&prior.context!==undefined&&context!==undefined&&sameValue(prior.context,context);
   // There is no callback, external return, or mutable-world consumer between
   // the producer comparison and this exact Natural read in the fixed entry.
   const appearance=this.natural.read(world,packet,reuse);
   this.committed={world,epoch:packet.epoch,revision:packet.revision,tick:world.tick,schema:world.schemaVersion,seed:world.seed,width:world.width,height:world.height,nextId:world.nextId,context};
   this.pending={packet,appearance};return packet;
  }catch(error){this.pending=undefined;this.committed=undefined;this.forcePublicationCheckpoint();throw error;}
  finally{this.trackNaturalInputs=false;}
 }
}

const scope=self as unknown as DedicatedWorkerGlobalScope;
// The direct Worker output remains the literal test/replay/public lane. The
// fixed MAIN factory may bind exactly one private output port as its FIRST
// message on the already ordered command channel. Every response (including
// phases, progress and acknowledgements) then uses that same port.
let privateOutput379:MessagePort|undefined,inputStarted379=false;
const postOutput379=(message:unknown,transfer?:Transferable[]):void=>{
 const target=privateOutput379??scope;
 if(transfer?.length)target.postMessage(message,transfer);else target.postMessage(message);
};
const publicationSourceOwner={};
const snapshots=new FixedPresentationEncoder(publicationSourceOwner);
const auxiliary=new ResidentAuxiliaryEncoder(true,true,true,publicationSourceOwner);
startSimulationWorker(scope,message=>{
 if(message.type==='campaign-only'){snapshots.clearNatural();auxiliary.clear();}
 postOutput379(residentPublication(message));
},snapshots,(world,publication,originalPacket)=>{
 // Natural observes the complete confirmed value before auxiliary capture
 // replaces both retained sections and ordered filth with private wire data.
 const appearance=snapshots.takeNatural(originalPacket),resident=withJournalTerrainReadScope(publicationSourceOwner,()=>auxiliary.capture(publication,world));
 postOutput379(residentPublication(resident.publication,appearance,resident.auxiliary));
},()=>new ResidentMotionRecorder(true),(_world,phase)=>{
 const packed=encodeCorePhaseWire379(phase);
 if(packed)postOutput379(packed.message,packed.transfer);else postOutput379(phase);
},publicationSourceOwner,()=>new SourceMotionPhasePublisher297(publicationSourceOwner));
const runtimeInput379=scope.onmessage;
if(!runtimeInput379)throw Error('Missing actual simulation command owner');
scope.onmessage=event=>{
 const value=event.data,kind=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,'type'):undefined;
 if(kind&&'value'in kind&&kind.value==='bind-native-presentation-port379'){
  const port=Object.getOwnPropertyDescriptor(value,'port');
  if(inputStarted379||privateOutput379||!event.isTrusted||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==2||!kind.enumerable||!port?.enumerable||!('value'in port)||!(port.value instanceof MessagePort)||event.ports.length!==1||event.ports[0]!==port.value)throw Error('Invalid private presentation output bootstrap');
  privateOutput379=port.value;return;
 }
 inputStarted379=true;runtimeInput379.call(scope,event);
};
