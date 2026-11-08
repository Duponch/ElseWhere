import {mockRequestId298} from './request-id-binding298';
import {campaignAuthority} from '../src/sim/secondary-site-context';
import {revolverProfile} from '../src/sim/ranged-statistics';
// New frontier publication policy. Historical V7 12+1 files remain immutable separate oracles.
// Real Runtime, physical Engine, clocks, Macro observers, Full codec and phase staging.
// Only the monotonic wall clock and task delivery are controlled; no Native authority.
import {afterEach,test,vi} from 'vitest';
import {CorePhasePublisher297} from '../src/bridge/core-phase-publisher-297';
import {captureCoreActor297} from '../src/bridge/core-phase-data-297';
import {AudioCueRecorder} from '../src/bridge/audio-cues';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {validateWorld} from '../src/sim/serialization';
import {registerWorldProjectile} from '../src/sim/projectile-system';
import {createBulletFlight} from '../src/sim/bullet-flight';
import assert from 'node:assert/strict';
import {startSimulationWorker} from '../src/bridge/simulation-runtime';
import {SnapshotDecoder,type SnapshotMessage} from '../src/bridge/snapshots';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {CorePhaseFrameOwner297} from '../src/bridge/core-phase-owner-297';
import type {CorePhaseEnvelope297} from '../src/bridge/core-phase-projection-297';
import {MotionRecorder} from '../src/bridge/motion-tracks';
import {PresentationChanges} from '../src/bridge/presentation-changes';
import {createWorld,applyCommand,serializeWorld} from '../src/sim/index';
import {advanceWorldCore297} from '../src/sim/engine';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {deserializeCampaign,serializeCampaign} from '../src/sim/serialization';
import {finalizeInitialWorldRegistry} from '../src/sim/world-map-context';
import {NATURAL_TERRAIN_BINDINGS_256} from '../src/sim/local-terrain-definitions-256';
import {newDoorState} from '../src/sim/door-rules';
import {isCorePhysicalSchema297} from '../src/sim/physical-schema-297';
import type {Request,Response} from '../src/bridge/protocol';
import type {World} from '../src/sim/types';

afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
export type QuietOptions={speed?:1|3|6;doorAtCore?:number;fireTicks?:number;deconstruct?:boolean;projectile?:boolean};
export function prepared(options:QuietOptions={}){
 const w=deconstructionCamp(2,32);assert.ok(isCorePhysicalSchema297(Number(w.schemaVersion)),'current physical schema family');assert.equal(effectiveCore297(w),0);
 w.tiles=Array.from({length:w.width*w.height},()=>({terrain:NATURAL_TERRAIN_BINDINGS_256.Soil}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.growingZones=[];w.stockpiles=[];
 if(w.wildlife)w.wildlife.animals=[];if(w.mechanoids)w.mechanoids=[];
 for(const [i,p]of w.pawns.entries()){Object.assign(p,{x:3,z:5+i*8,jobId:null,path:[],state:'idle',planCooldown:0,hunger:80,rest:80,needCooldown:20});p.schedule.fill('anything');p.recreation.level=100;for(const k of Object.keys(p.priorities)as(keyof typeof p.priorities)[])p.priorities[k]=0;}
 const pawn=w.pawns[0]!,ids=w.pawns.map(p=>p.id);
 if(options.deconstruct){
  for(const p of w.pawns.slice(1))assert.equal(applyCommand(w,{type:'draft',pawnIds:[p.id],enabled:true}).ok,true);
  pawn.priorities.build=1;const wall=Object.assign(fixtureBuilding(w,'wall',4,5),{material:'wood'as const});
  assert.equal(applyCommand(w,{type:'designate',kind:'deconstruct',x:wall.x,z:wall.z}).ok,true);
  const job=w.jobs.find(j=>j.kind==='deconstruct')!;assert.ok(job);assert.equal(applyCommand(w,{type:'order-job',pawnId:pawn.id,jobId:job.id,queue:false}).ok,true);
 }else assert.equal(applyCommand(w,{type:'draft',pawnIds:ids,enabled:true}).ok,true);
 let doorId:number|undefined;
 if(options.doorAtCore!==undefined){const door={id:w.nextId++,kind:'door'as const,x:2,z:2,orientation:0 as const,footprint:'standard'as const,material:'wood'as const,door:{...newDoorState(w.tick),open:true,from:1,closeAt:options.doorAtCore/10}};doorId=door.id;w.structures.push(door);}
 if(options.fireTicks!==undefined){const fire=fixtureBuilding(w,'campfire',6,5);fire.fuel!.ticks=options.fireTicks;fire.fuel!.autoRefuel=false;}
 if(options.projectile){const profile=revolverProfile('normal'),flight=createBulletFlight({origin:{x:3.5,z:5.5},destination:{x:7.5,z:5.5},launcherKey:'pawn:'+pawn.id,equipmentKey:null,intendedKey:null,usedKey:null,flags:7,preventFriendlyFire:false,speedPerCoreTick:profile.projectileTilesPerCoreTick});assert.equal(flight.remainingCoreTicks,8,'Four cells at the actual normal-revolver profile must arrive at Core8');registerWorldProjectile(w,flight,'normal',{friendlyPawnIds:ids,friendlyFireFactor:0});}
 finalizeInitialWorldRegistry(w);assert.deepEqual(validateWorld(w),[]);return{raw:serializeWorld(w),pawnId:pawn.id,doorId};
}
class RecordedMotion extends MotionRecorder {
 cores:number[]=[];last?:World;
 /** Test-only read borrow: never serialized, mutated, or granted to Native. */
 borrowed?:World;
 override capture(w:World){super.capture(w);this.cores.push(effectiveCore297(w));this.borrowed=w;this.last=structuredClone(w);}
}
type FullRow={world:World;packet:SnapshotMessage<true>};
type PhaseRow={world:World;packet:CorePhaseEnvelope297;fullWorld:World;actorCore:number};
type Publication={kind:'full'|'phase';core:number;at:number;audio:readonly {kind:string;tick:number}[]};
export function frontierHarness(options:QuietOptions={}){
 const input=prepared(options),messages:Response[]=[],rows:FullRow[]=[],phaseRows:PhaseRow[]=[],publications:Publication[]=[],order:string[]=[],motion=new RecordedMotion(),posted:(()=>void)[]=[];
 const frameOwner=new CorePhaseFrameOwner297();let trueFull:World|undefined,trueFullJson:string|undefined;

 const trace={observations:[]as{core:number;macro:boolean;hard:boolean}[],discrete:[]as{core:number;changed:boolean}[],allocator:[]as{core:number;required:boolean;nextId:number}[]};
 let publisher:CorePhasePublisher297|undefined,cueRecorder:AudioCueRecorder|undefined;
 let actualPhysicalWorld:World|undefined,actualCampaignRoot:World|undefined,authorityGeneration=0,physicalBorrowGeneration:number|undefined;
 const observed=CorePhasePublisher297.prototype.observe,allocation=CorePhasePublisher297.prototype.allocatorNeedsFull,discreteCapture=PresentationChanges.prototype.capture,audioCapture=AudioCueRecorder.prototype.capturePhysical297;
 vi.spyOn(CorePhasePublisher297.prototype,'observe').mockImplementation(function(this:CorePhasePublisher297,...args:Parameters<CorePhasePublisher297['observe']>){const[value,macro]=args;publisher=this;trace.observations.push({core:value.core,macro,hard:value.requiresFull});return Reflect.apply(observed,this,args);});
 vi.spyOn(CorePhasePublisher297.prototype,'allocatorNeedsFull').mockImplementation(function(this:CorePhasePublisher297,w){const required=allocation.call(this,w);actualPhysicalWorld=w;actualCampaignRoot=campaignAuthority(w);physicalBorrowGeneration=authorityGeneration;trace.allocator.push({core:effectiveCore297(w),required,nextId:w.nextId});return required;});
 vi.spyOn(PresentationChanges.prototype,'capture').mockImplementation(function(this:PresentationChanges,w){const changed=discreteCapture.call(this,w);trace.discrete.push({core:effectiveCore297(w),changed});return changed;});
 vi.spyOn(AudioCueRecorder.prototype,'capturePhysical297').mockImplementation(function(this:AudioCueRecorder,...args){cueRecorder=this;return Reflect.apply(audioCapture,this,args);});

 let now=1000,wake=()=>{},id=0,failEncode=false,failSend=false;const origin=performance.timeOrigin;
 vi.spyOn(performance,'now').mockImplementation(()=>now);vi.spyOn(performance,'timeOrigin','get').mockReturnValue(origin);
 vi.stubGlobal('setInterval',(callback:()=>void,ms:number)=>{assert.equal(ms,20);wake=callback;return 1;});
 // A stale task remains physically queued, making generation guards observable.
 class ControlledChannel {
  port1:any;port2:any;
  constructor(){const first={onmessage:null as any,listeners:new Set<any>(),start(){},close(){},unref(){},addEventListener(_name:string,fn:any){this.listeners.add(fn);},removeEventListener(_name:string,fn:any){this.listeners.delete(fn);}};this.port1=first;this.port2={start(){},close(){},unref(){},postMessage(value:unknown){const data=structuredClone(value);posted.push(()=>{const event={data};first.onmessage?.call(first,event);for(const fn of first.listeners)fn.call(first,event);});}};}
 }
 vi.stubGlobal('MessageChannel',ControlledChannel);
 const encoder=new TerrainJournalSnapshotEncoder(),encode=encoder.encode.bind(encoder);
 vi.spyOn(encoder,'encode').mockImplementation((w,ms,speed,checkpoint)=>{if(failEncode)throw Error('Private current Full preparation failure');return encode(w,ms,speed,checkpoint);});
 const physical=(w:World)=>w.pawns.map(p=>({id:p.id,x:p.x,z:p.z,state:p.state,path:p.path,moveCooldown:p.moveCooldown,motion:p.motion}));
 const scope={onmessage:undefined as any};
 startSimulationWorker(scope as DedicatedWorkerGlobalScope,message=>{messages.push(structuredClone(message));order.push(message.type==='reply'?'reply:'+message.id:message.type);},encoder,
  (w:World,packet:SnapshotMessage<true>)=>{
   if(failSend)throw Error('Private actual Full send failure');const world=structuredClone(w),owned=structuredClone(packet);rows.push({world,packet:owned});
   assert.ok(owned.corePhase297,'Every297 Full has its actual physical watermark');
   const projection=frameOwner.adoptFull(world,owned.epoch,owned.revision,owned.motion,owned.corePhase297,owned.speed as 0|1|3|6);
   assert.equal(projection.core,effectiveCore297(world));assert.equal(projection.world,world);assert.deepEqual(physical(projection.world),physical(world));trueFull=world;trueFullJson=JSON.stringify(world);
   publications.push({kind:'full',core:projection.core,at:now,audio:owned.audioCues??[]});order.push('publication:'+projection.core+':'+owned.speed);
  },()=>motion,
  (w:World,packet:CorePhaseEnvelope297)=>{
   if(failSend)throw Error('Private actual phase send failure');
   const world=structuredClone(w),owned=structuredClone(packet),projection=frameOwner.commit(frameOwner.prepare(owned));
   assert.equal(projection.core,effectiveCore297(world));
   if(owned.type==='actor-frontier-297'){
    assert.ok(trueFull);assert.equal(projection.world,trueFull,'Frontier projection keeps the authentic Full object');assert.equal(JSON.stringify(projection.world),trueFullJson,'No tick, phase, actor or allocator is written into the Full');assert.equal(effectiveCore297(projection.world),projection.anchor.core);
    assert.equal(projection.actorScene.core,owned.toCore);
    for(const [index,p]of world.pawns.entries())assert.deepEqual(captureCoreActor297('human',index,projection.actorScene.humans[index] as World['pawns'][number]),captureCoreActor297('human',index,p),'Detached human allowlist equals the actually committed Engine state');
    for(const [index,a]of(world.wildlife?.animals??[]).entries())assert.deepEqual(captureCoreActor297('animal',index,projection.actorScene.animals[index]!),captureCoreActor297('animal',index,a));
    for(const [index,m]of(world.mechanoids??[]).entries())assert.deepEqual(captureCoreActor297('mechanical',index,projection.actorScene.mechanical[index]!),captureCoreActor297('mechanical',index,m));
   }else assert.deepEqual(physical(projection.world),physical(world));
   phaseRows.push({world,packet:owned,fullWorld:projection.world,actorCore:projection.core});publications.push({kind:'phase',core:projection.core,at:now,audio:owned.audioCues});order.push('phase:'+projection.core);
  });
 const request=(value:any)=>{const request={...value,id:++id} as Request,before=rows.length;scope.onmessage({data:request});const reply=messages.findLast((r):r is Extract<Response,{type:'reply'}>=>r.type==='reply'&&r.id===mockRequestId298(request));assert.ok(reply,'The real Runtime must reply');
  // A successful replacement revokes the old physical borrow even if its
  // Motion projection/shape still resembles the newly loaded map. A refused
  // load leaves the current owner and its existing proven borrow unchanged.
  if(request.type==='load'&&reply.ok){authorityGeneration++;physicalBorrowGeneration=undefined;actualPhysicalWorld=undefined;actualCampaignRoot=undefined;}
  return {reply,rows:rows.slice(before),id:mockRequestId298(request)};};
 const saved=()=>{const result=request({type:'save'});assert.equal(result.reply.ok,true,result.reply.reason);assert.equal(typeof result.reply.data,'string');return result.reply.data!;};
 assert.equal(request({type:'load',data:input.raw,threatPauseMode:'major'}).reply.ok,true);
 const initial=saved(),oracle=deserializeCampaign(initial),core=effectiveCore297(oracle);assert.equal(core,0);assert.equal(request({type:'speed',speed:options.speed??6}).reply.ok,true);
 const lastCore=()=>motion.last?effectiveCore297(motion.last):core;
 const runOne=()=>{const task=posted.shift();assert.ok(task,'Expected a posted internal task');const before=lastCore();task();const delta=lastCore()-before;assert.ok(delta===0||delta===1,'One task commits at most one complete physical Core');return delta;};
 const drain=()=>{const deltas:number[]=[];for(let i=0;posted.length&&i<512;i++)deltas.push(runOne());assert.equal(posted.length,0,'Bounded transport drain');return deltas;};
 const oracleCores=(count:number)=>{for(let n=0;n<count;n++){const before=effectiveCore297(oracle),result=advanceWorldCore297(oracle);assert.equal(result.core,before+1);}return serializeCampaign(oracle);};
 const assertFullDecoder=()=>{const decoder=new SnapshotDecoder();for(const row of rows){const admitted=decoder.adopt(row.packet);assert.equal(admitted.status,'applied',JSON.stringify({reason:admitted.status==='resync'?admitted.reason:undefined,kind:row.packet.kind,tick:row.packet.world.tick,phaseCore297:row.packet.world.phaseCore297,coreMetadata:row.packet.corePhase297?.core}));if(admitted.status==='applied')assert.equal(effectiveCore297(admitted.world),effectiveCore297(row.world));}};
 return {input,initial,messages,rows,phaseRows,publications,order,motion,oracle,core,frameOwner,trace,owner:()=>{
   assert.ok(actualPhysicalWorld&&actualCampaignRoot&&physicalBorrowGeneration===authorityGeneration,'No current genuine physical campaign borrow; Motion projections and copies are not Raw authority');
   assert.equal(campaignAuthority(actualPhysicalWorld),actualCampaignRoot,'The physical borrow must retain its existing campaign ownership binding');
   return actualCampaignRoot;
  },pending:()=>publisher?{needsFull:publisher.needsFull,canDeferFull:publisher.canDeferFull,canActors:publisher.canPublishActors297,frontier:publisher.frontierMode297}:undefined,audioPending:()=>cueRecorder?.preparePublication297().cues??[],request,saved,lastCore,runOne,drain,oracleCores,assertFullDecoder,queued:()=>posted.length,
  at(value:number){now=value;},wake(){wake();},slice(){const before=lastCore();wake();if(lastCore()===before&&posted.length)runOne();return lastCore()-before;},stamp(local:number){return {origin:origin-5000,at:local+5000};},fail(kind:'encode'|'send'='send'){if(kind==='encode')failEncode=true;else failSend=true;},allow(){failEncode=false;failSend=false;},
  doorCues(){return publications.flatMap(row=>row.audio).filter(cue=>cue.kind==='door.close');}};
}
