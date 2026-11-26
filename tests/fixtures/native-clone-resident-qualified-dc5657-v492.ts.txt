import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {CorePhaseFrameOwner297,type PreparedCoreFull297} from './core-phase-owner-297';
import {copyCoreData297,coreOwnRecord297,coreInteger297,validCoreTrace297} from './core-phase-data-297';
import type {CorePhaseAnchor297,CorePhaseTypedProjection297} from './core-phase-projection-297';
/** No exported mint: only the fixed trusted-event receipt below can add data. */
const nativeCoreInputs297=new WeakMap<object,{projection:CorePhaseTypedProjection297;alive:()=>boolean}>();
/** Scheduling only: no World, phase projection, ACK or admission authority.
 * This map is written solely while redeeming the first trusted Native receipt. */
const nativePhaseAdmission297=new WeakMap<object,{run:()=>void;alive:()=>boolean}>();
const nativeFullAdmission297=new WeakMap<object,{run:()=>void;alive:()=>boolean}>();
export function isNativeCorePhaseAdmissionTicket297(info:unknown,run:unknown):boolean {
 if(!info||typeof info!=='object')return false;
 const held=nativePhaseAdmission297.get(info);return !!held&&held.run===run&&held.alive();
}
export function isNativeCoreFullAdmissionTicket297(info:unknown,run:unknown):boolean {
 if(!info||typeof info!=='object')return false;
 const held=nativeFullAdmission297.get(info);return !!held&&held.run===run&&held.alive();
}

export function readNativeCorePhaseInput297(value:unknown):CorePhaseTypedProjection297|undefined {
 if(!value||typeof value!=='object')return;const held=nativeCoreInputs297.get(value);return held?.alive()?held.projection:undefined;
}
import type {World} from '../sim/types';
import {captureNativeMessageForDeferred297 as captureNativeMessageForDeferred} from './native-message-capture';
import {isOwnedResidentFilthCopyInternal,isOwnedResidentFilthItemListInternal} from './resident-filth-section';
import {createFirefoamLaneValidatorsInternal290} from '../sim/firefoam-save-290';
import {ResidentVegetationAssembler} from './resident-vegetation-assembler';
import type {SnapshotAdoption,SnapshotMessage} from './snapshots';
import type {CampaignOnlyMessage} from './protocol';

/** Fixed native source only. No caller-supplied flag/token grants provenance. */
export interface NativeCloneResidentLane {
 readonly reader:ResidentVegetationAssembler;
 adoptCorePhase297(raw:unknown):object;
 createWorker():Worker;
 withWorkerMessage(source:Worker,event:MessageEvent<unknown>,dispatch:()=>void):void;
 takeDeferredMessage(source:Worker,event:MessageEvent<unknown>,dispatch:(raw:unknown)=>void):{run:()=>void;arrivalAt:number;epoch?:number;tick?:number}|undefined;
 close():void;
 diagnostics():Readonly<{fastAdoptions:number;strictAdoptions:number;fastLaneReads:number}>;
}
type Packet=SnapshotMessage<true>;
/** Union of the two Firefoam scanner custody lanes; never terrain/anatomy. */
const cloneLanes=new Set(['world','summary','dynamic','campaign','map','worldMaps','sites','secondarySite','campaignMap',
 'structures','jobs','packed','building','items','bills','worldGroups','groups','group','state','pending261',
 'groupLosses','animalLosses','losses','legacyTravellers','abandonedPawns','abandonedContents','worldPawns','owners',
 'worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant',
 'visitors','podRescues','departed','startingArrival','pods','animalOwners','wildlife','raids','mechActive','extraMechActive261',
 'humans','members','people','animals','mechanoids','flyers','human','pawn','animal','mech','actor','pawns','piles','corpse','mechCorpse',
 'scout','commercialTrip','health','filthFeet','research','filth','carried','upserted']);

/** Captured native getters reject Proxy/wrapper receivers and synthetic events. */
function nativeEventReader(){
 try{
  if(typeof Event!=='function'||typeof MessageEvent!=='function')return;
  const current=Object.getOwnPropertyDescriptor(Event.prototype,'currentTarget')?.get;
  const data=Object.getOwnPropertyDescriptor(MessageEvent.prototype,'data')?.get;
  const sample=new MessageEvent('message');
  const trusted=Object.getOwnPropertyDescriptor(sample,'isTrusted')?.get
   ??Object.getOwnPropertyDescriptor(Event.prototype,'isTrusted')?.get;
  if(!current||!data||!trusted)return;
  return (event:MessageEvent<unknown>,source:Worker):{value:unknown}|undefined=>{
   try{return current.call(event)===source&&trusted.call(event)===true?{value:data.call(event)}:undefined;}
   catch{return;}
  };
 }catch{return;}
}

export function createNativeCloneResidentLane():NativeCloneResidentLane {
 let worker:Worker|undefined,closed=false,capture:((event:MessageEvent<unknown>)=>void)|undefined;
 const ordinary=new WeakSet<object>(),receipts=new WeakMap<object,Receipt>(),readNative=nativeEventReader();
 interface Deferred {readonly eventRaw:unknown;readonly captured:unknown;readonly arrivalAt:number;receipt:Receipt|undefined;phaseReceipt297?:PhaseReceipt297;taken:boolean;used:boolean;epoch?:number;tick?:number}
 const deferred=new WeakMap<object,Deferred>();
 const phaseOwner297=new CorePhaseFrameOwner297(),phaseReceipts297=new WeakMap<object,PhaseReceipt297>(),fullInputs297=new WeakMap<object,object>();
 interface PhaseReceipt297 {readonly raw:unknown;readonly captured:unknown;consumed:boolean}
 let phaseFrame297:PhaseReceipt297|undefined,phaseGeneration297=0;
 const mintPhase297=(projection:CorePhaseTypedProjection297):object=>{const generation=phaseGeneration297,token=Object.freeze({});nativeCoreInputs297.set(token,{projection,alive:()=>!closed&&generation===phaseGeneration297});return token;};
 const preflightFull297=(packet:Packet):void=>{
  const world=packet.world as unknown as Record<string,unknown>,version=Object.getOwnPropertyDescriptor(world,'schemaVersion')?.value,field=Object.getOwnPropertyDescriptor(packet,'corePhase297');
  if(!isCorePhysicalSchema297(version)){if(field)throw Error('Future physical header on historical Native publication');return;}
  if(!field?.enumerable||!Object.hasOwn(field,'value'))throw Error('Native297 full lost its physical header');
  const meta=copyCoreData297(field.value),tick=Object.getOwnPropertyDescriptor(world,'tick')?.value,phase=Object.getOwnPropertyDescriptor(world,'phaseCore297')?.value,nextId=Object.getOwnPropertyDescriptor(world,'nextId')?.value;
  const frontier=coreOwnRecord297(meta)&&Object.hasOwn(meta,'actorMode297');
  if(!coreInteger297(tick)||!coreInteger297(phase,0,9)||!coreInteger297(tick*10+phase)||!coreInteger297(nextId,1)||!coreOwnRecord297(meta)||Object.keys(meta).length!==(frontier?4:3)||frontier&&meta.actorMode297!=='frontier'||!Object.hasOwn(meta,'mapId')||!Object.hasOwn(meta,'core')||!Object.hasOwn(meta,'projectilesRetained')||meta.core!==tick*10+phase||!coreInteger297(meta.mapId)||!Array.isArray(meta.projectilesRetained))throw Error('Invalid Native full Core header');
  const anchor:CorePhaseAnchor297={epoch:packet.epoch,mapId:meta.mapId,revision:packet.revision,core:meta.core,width:Number(world.width),height:Number(world.height),nextId,layout:{human:[],animal:[],mechanical:[]}},seen=new Set<number>();
  for(const trace of meta.projectilesRetained){if(!validCoreTrace297(trace,anchor,meta.core)||seen.has(trace.id))throw Error('Invalid retained Native projectile');seen.add(trace.id);}
  const old=phaseOwner297.currentAnchor;if(old?.epoch===packet.epoch&&old.mapId===meta.mapId&&(Number(meta.core)<Number(phaseOwner297.currentCore)||nextId<Number(phaseOwner297.currentNextId)))throw Error('Full precedes committed actor phase');
 };
 const deferredGet=Function.call.bind(WeakMap.prototype.get) as (map:WeakMap<object,Deferred>,key:object)=>Deferred|undefined;
 const deferredSet=Function.call.bind(WeakMap.prototype.set) as (map:WeakMap<object,Deferred>,key:object,value:Deferred)=>unknown;
 const deferredDelete=Function.call.bind(WeakMap.prototype.delete) as (map:WeakMap<object,Deferred>,key:object)=>unknown;
 interface Receipt {readonly raw:unknown;readonly original:Packet;readonly modernFull297?:true;consumed:boolean}
 interface Scope {readonly frame:Receipt;prepared:Packet|undefined}
 let frame:Receipt|undefined,scope:Scope|undefined;
 const metrics={fastAdoptions:0,strictAdoptions:0,fastLaneReads:0};
 // Only our first, private native listener calls mark. An ordinary object cannot
 // turn into a Proxy later. Inserted/reused unknown objects remain strict.
 const mark=(root:unknown):void=>{
  const seen=new Set<object>(),pending:unknown[]=[root];
  while(pending.length){
   const value=pending.pop();if(!value||typeof value!=='object'||seen.has(value))continue;seen.add(value);
   if(Array.isArray(value)){
    if(Object.getPrototypeOf(value)!==Array.prototype)continue;
    for(const key of Object.keys(value))if(/^(0|[1-9]\d*)$/.test(key))pending.push(value[Number(key)]);
   }else if(Object.getPrototypeOf(value)===Object.prototype){
    ordinary.add(value);
    for(const key of Object.keys(value))if(cloneLanes.has(key))pending.push((value as Record<string,unknown>)[key]);
   }
  }
 };
 const guards=createFirefoamLaneValidatorsInternal290((value,key)=>{
  // Unknown child traps can replace an ancestor's prototype during a scan.
  // Recheck at the read: identity alone never certifies its current prototype.
  if(!ordinary.has(value)||Object.getPrototypeOf(value)!==Object.prototype)return Object.getOwnPropertyDescriptor(value,key);
  metrics.fastLaneReads++;
  return key in value?Object.getOwnPropertyDescriptor(value,key):null;
 },(value,laneKeys)=>{
  if(!ordinary.has(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
  // Reflect.ownKeys observes nonenumerable/accessor/undefined lanes without
  // reading their values. No Proxy or getter can run in this ordinary proof.
  for(const key of Reflect.ownKeys(value))if(typeof key==='string'&&laneKeys.has(key))return false;
  // Live, never cached: earlier unknown children may pollute this prototype.
  for(const key of Reflect.ownKeys(Object.prototype))if(typeof key==='string'&&laneKeys.has(key))return false;
  return true;
 },isOwnedResidentFilthCopyInternal,isOwnedResidentFilthItemListInternal);

 class NativeCloneAssembler extends ResidentVegetationAssembler {
  protected override preparedPublication(original:Packet,prepared:Packet):void {
   if(!scope||scope.frame!==frame||scope.frame.original!==original)return;
   scope.prepared=prepared;
  }
  protected override firefoamTransport(value:unknown,version:unknown):boolean {
   return scope&&scope.frame===frame&&value===scope.prepared
    ?guards.historical(value,version):super.firefoamTransport(value,version);
  }
  protected override firefoamWorld(value:World,packet:Packet):boolean {
   return scope&&scope.frame===frame&&packet===scope.prepared
    ?guards.world(value):super.firefoamWorld(value,packet);
  }
  readCorePhase297(packet:Packet):object|undefined{return fullInputs297.get(packet);}
  override adopt(packet:Packet,acceptExtra?:(view:World)=>boolean):SnapshotAdoption {
   if(scope)return {status:'resync',reason:'Reentrant resident clone admission'};
   // No packet property reads before the ordinary admission guards. Provenance
   // is per object; the base reader alone owns revisions and reconstruction.
   const held=frame,eligible=!closed&&!!held&&!held.consumed&&packet===held.original;
   if(eligible){held.consumed=true;scope={frame:held,prepared:undefined};}
   try{
    if(eligible)preflightFull297(packet);
    let physicalFull:PreparedCoreFull297|undefined;
    const result=super.adopt(packet,view=>{
     if(acceptExtra&&!acceptExtra(view))return false;
     if(eligible&&isCorePhysicalSchema297(Number(view.schemaVersion))){
      const prepared=scope?.prepared;if(!prepared)throw Error('Missing staged Native Full publication');
      physicalFull=phaseOwner297.prepareFull(view,packet.epoch,packet.revision,prepared.motion,packet.corePhase297,packet.speed as 0|1|3|6,packet.kind==='checkpoint');
     }
     return true;
    });
    if(result.status==='applied'){
     if(eligible&&scope?.prepared){
      if(isCorePhysicalSchema297(Number(result.world.schemaVersion))){const old=phaseOwner297.currentAnchor,metadata=packet.corePhase297;
       if(result.replaced||old&&old.epoch!==packet.epoch||old&&old.mapId!==metadata?.mapId)phaseGeneration297++;
       if(!physicalFull||physicalFull.projection.world!==result.world)throw Error('Missing atomically prepared Core Full');
       const projection=phaseOwner297.commitFull(physicalFull);
       fullInputs297.set(packet,mintPhase297(projection));
      }else if(phaseOwner297.currentAnchor){phaseOwner297.clear();phaseGeneration297++;}
      metrics.fastAdoptions++;
     }
     else metrics.strictAdoptions++;
    }
    return result;
   }finally{scope=undefined;}
  }
  override adoptCampaignOnly(packet:CampaignOnlyMessage,acceptExtra?:(view:World)=>boolean):ReturnType<ResidentVegetationAssembler['adoptCampaignOnly']>{
   if(scope)return {status:'resync',reason:'Reentrant resident campaign admission'};
   const result=super.adoptCampaignOnly(packet,acceptExtra);
   if(result.status==='applied'){phaseOwner297.clear();phaseGeneration297++;}
   return result;
  }
 }
 const reader=new NativeCloneAssembler();
 return {
  reader,
  createWorker(){
   if(closed||worker)throw Error('Native clone lane already created or closed');
   worker=new Worker(new URL('./presentation.worker.ts',import.meta.url),{type:'module'});
   const source=worker;
   capture=event=>{
    if(closed||worker!==source)return;
    const native=readNative?.(event,source);if(!native)return;
    const arrivalAt=performance.now();
    try{
     const captured=captureNativeMessageForDeferred(native.value);
     const phaseType297=(captured as {type?:unknown})?.type;
     if(phaseType297==='actor-phase-297'||phaseType297==='actor-frontier-297'){
      const phaseReceipt297:PhaseReceipt297={raw:native.value,captured,consumed:false};phaseReceipts297.set(event,phaseReceipt297);
      deferredSet(deferred,event,{eventRaw:native.value,captured,arrivalAt,receipt:undefined,phaseReceipt297,taken:false,used:false});return;
     }
     const envelope=captured as {type?:unknown;publication?:Packet};
     const packet=envelope.type==='resident-publication'&&envelope.publication?.type==='snapshot'?envelope.publication:undefined;
     // The captured packet is a private own-data envelope. Its shared World
     // body is marked exactly once below through the original native packet.
     if(packet)ordinary.add(packet);
     const epoch=packet&&Object.getOwnPropertyDescriptor(packet,'epoch')?.value,tick=packet?.world&&Object.getOwnPropertyDescriptor(packet.world,'tick')?.value;
     deferredSet(deferred,event,{eventRaw:native.value,captured,arrivalAt,receipt:undefined,taken:false,used:false,...Number.isSafeInteger(epoch)?{epoch}:{},...Number.isSafeInteger(tick)?{tick}:{}});
    }catch{/* No deferred authority: the ordinary strict immediate reader owns malformed inputs. */}
    try{
     const raw=native.value as Record<string,unknown>|null;
     if(!raw||typeof raw!=='object'||raw.type!=='resident-publication')return;
     const packet=raw.publication as Packet;
     if(!packet||typeof packet!=='object'||packet.type!=='snapshot'||!packet.world||typeof packet.world!=='object')return;
     mark(packet);
     const receipt:Receipt={raw,original:packet,consumed:false};
     receipts.set(event,receipt);
     const held=deferredGet(deferred,event),owned=(held?.captured as {publication?:Packet}|undefined)?.publication;
     if(held&&owned?.type==='snapshot'&&owned.world===packet.world){
      // Capture only the constant scheduling discriminator inside the genuine
      // first listener. World/admission/FX guards are not repeated or bypassed.
      const version=Object.getOwnPropertyDescriptor(owned.world,'schemaVersion'),header=Object.getOwnPropertyDescriptor(owned,'corePhase297');
      const modern=version?.enumerable===true&&Object.hasOwn(version,'value')&&isCorePhysicalSchema297(version.value)&&header?.enumerable===true&&Object.hasOwn(header,'value')&&coreOwnRecord297(header.value);
      held.receipt={raw:held.captured,original:owned,...modern?{modernFull297:true as const}:{},consumed:false};
     }
    }catch{/* ordinary strict reader owns malformed publication refusal */}
   };
   // Registered before exposing the Worker to arbitrary client listeners.
   worker.addEventListener('message',capture);
   return worker;
  },
  adoptCorePhase297(raw){
   const held=phaseFrame297;if(closed||!held||held.consumed||raw!==held.raw&&raw!==held.captured)throw Error('Actor phase lacks its Native one-use receipt');
   held.consumed=true;const prepared=phaseOwner297.prepare(held.captured),projection=phaseOwner297.commit(prepared);return mintPhase297(projection);
  },
  withWorkerMessage(source,event,dispatch){
   if(closed||!worker||source!==worker||frame||phaseFrame297){dispatch();return;}
   const phase=phaseReceipts297.get(event),nativePhase=readNative?.(event,source);
   if(phase&&!phase.consumed&&nativePhase&&nativePhase.value===phase.raw){
    phaseReceipts297.delete(event);const pending=deferredGet(deferred,event);if(pending){pending.used=true;deferredDelete(deferred,event);}
    phaseFrame297=phase;try{dispatch();}finally{phase.consumed=true;phaseFrame297=undefined;}return;
   }
   // Native currentTarget becomes null after dispatch. A synthetic redispatch
   // cannot redeem this exact Event, source and private one-use receipt.
   const receipt=receipts.get(event),native=readNative?.(event,source);
   if(!receipt||receipt.consumed||!native||native.value!==receipt.raw){dispatch();return;}
   const alternative=deferredGet(deferred,event);if(alternative){alternative.used=true;deferredDelete(deferred,event);}
   receipts.delete(event);frame=receipt;
   try{dispatch();}finally{receipt.consumed=true;frame=undefined;scope=undefined;}
  },
  takeDeferredMessage(source,event,dispatch){
   if(closed||!worker||source!==worker||frame||phaseFrame297)return;
   const held=deferredGet(deferred,event),native=readNative?.(event,source);
   if(!held||held.taken||held.used||!native||native.value!==held.eventRaw)return;
   held.taken=true;deferredDelete(deferred,event);receipts.delete(event);phaseReceipts297.delete(event);
   const run=()=>{
    if(held.used||closed||worker!==source)return;held.used=true;
    if(frame||phaseFrame297)throw Error('Reentrant deferred native receipt');
    frame=held.receipt;phaseFrame297=held.phaseReceipt297;
    try{dispatch(held.captured);}finally{if(held.receipt)held.receipt.consumed=true;if(held.phaseReceipt297)held.phaseReceipt297.consumed=true;frame=undefined;phaseFrame297=undefined;scope=undefined;}
   };
   const ticket=Object.freeze({arrivalAt:held.arrivalAt,...held.epoch!==undefined?{epoch:held.epoch}:{},...held.tick!==undefined?{tick:held.tick}:{},run});
   const phase=held.phaseReceipt297;
   // The discriminator was captured inside the first native listener. Neither
   // info.type nor a caller-supplied flag can mark a queue entry as lightweight.
   if(phase)nativePhaseAdmission297.set(ticket,{run,alive:()=>!closed&&worker===source&&!held.used&&!phase.consumed});
   const full=held.receipt;
   if(full?.modernFull297)nativeFullAdmission297.set(ticket,{run,alive:()=>!closed&&worker===source&&!held.used&&!full.consumed});
   return ticket;
  },
  close(){closed=true;phaseGeneration297++;phaseOwner297.clear();if(worker&&capture)worker.removeEventListener('message',capture);frame=undefined;phaseFrame297=undefined;scope=undefined;},
  diagnostics:()=>Object.freeze({...metrics}),
 };
}
