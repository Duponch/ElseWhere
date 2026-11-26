import {SimulationClient} from '../../bridge/SimulationClient';
import {MainFrameAdmissionFIFO} from '../../bridge/main-frame-admission-fifo';
import {createPrivateNativeCloneResidentLane379,readNativeCorePhaseInput297} from '../../bridge/native-clone-resident';
import {readResidentWorkerMessage} from '../../bridge/resident-protocol';
import type {PawnTrack} from '../../bridge/motion-tracks';
import type {World} from '../../sim/types';
import type {ColonySpeed} from './protocol';

export interface SceneFull {
  world:World; tracks?:PawnTrack[]; owner:object; replaced:boolean; speed:ColonySpeed; defer:boolean;
}
interface SceneLane {lane:ReturnType<typeof createPrivateNativeCloneResidentLane379>; queue:MainFrameAdmissionFIFO}
// The base constructor invokes createDecoder() before subclass fields exist.
const lanes=new WeakMap<SimulationClient,SceneLane>();

/** The same native MessagePort, ownership checks and ordered frame admission
 * used by the game, living beside the renderer in its dedicated worker. */
export class SceneSimulation extends SimulationClient {
  full?:SceneFull;
  lastPhase?:object;
  fulls=0;
  phases=0;
  core=0;
  speed:ColonySpeed=0;
  canRender=()=>false;
  onStarvation=()=>{};
  onFull:((value:SceneFull)=>void)|undefined;
  onPhase:((owner:object)=>void)|undefined;

  get queue():MainFrameAdmissionFIFO{return lanes.get(this)!.queue;}
  protected override createDecoder(){
    const earlier=lanes.get(this);earlier?.queue.close();earlier?.lane.close();
    const lane=createPrivateNativeCloneResidentLane379();
    const queue=new MainFrameAdmissionFIFO(()=>this.canRender?.()??false,
      ()=>this.stop('La file de rendu de la colonie est saturée.'),undefined,()=>this.onStarvation());
    lanes.set(this,{lane,queue});
    return lane.reader;
  }
  protected override createWorker(){return lanes.get(this)!.lane.createWorker();}
  protected override bindWorkerOutput(source:Worker,dispatch:(raw:unknown)=>void,invalid:()=>void){
    const {lane,queue}=lanes.get(this)!;
    lane.bindOwnedOutput379(source,dispatch,(run,info)=>{queue.enqueue(run,info);},invalid);
  }
  protected override dispatchWorkerFailure(_worker:Worker,dispatch:()=>void){this.queue.enqueue(dispatch);}
  protected override workerStopped(){
    const owner=lanes.get(this);owner?.queue.close();owner?.lane.close();
  }
  protected override readNativeSnapshotDispatch379(value:unknown){return lanes.get(this)!.lane.readOwnedSnapshotDispatch379(value);}
  protected override readWorkerMessage(value:unknown){return readResidentWorkerMessage(value);}
  protected override deliverCampaignOnly():void{
    this.full=undefined;this.lastPhase=undefined;this.speed=0;this.core=0;
    this.onError('Cette campagne ne contient plus de carte de colonie active.');
  }
  protected override deliverSnapshot(world:World,_cost:number,speed:number,replaced:boolean,tracks?:PawnTrack[],owner?:object){
    const receipt=readNativeCorePhaseInput297(owner);
    if(!owner||receipt?.kind!=='full'||receipt.world!==world||receipt.speed!==speed)throw Error('Publication complète de colonie invalide.');
    this.queue.recordApplied(world.tick);
    const defer=!replaced&&speed>0&&this.speed===speed&&!this.hasPendingPresentationRequests;
    this.speed=receipt.speed;this.core=receipt.core;this.fulls++;this.lastPhase=undefined;
    this.full={world,tracks,owner,replaced,speed:this.speed,defer};
    this.onFull?.(this.full);
  }
  protected override deliverCorePhase297(raw:unknown){
    const owner=lanes.get(this)!.lane.adoptCorePhase297(raw),receipt=readNativeCorePhaseInput297(owner);
    if(receipt?.kind!=='phase')throw Error('Phase de colonie invalide.');
    this.speed=receipt.speed;this.core=receipt.core;this.phases++;this.lastPhase=owner;
    this.onPhase?.(owner);
  }
}
