import * as THREE from 'three/webgpu';
import {SceneRenderCore} from '../../../src/render/SceneRenderCore';
import {CameraRig} from '../../../src/render/CameraRig';
import {MapLabelsOverlay} from '../../../src/render/MapLabelsOverlay';
import {SceneApplicationContext} from '../../../src/render/SceneApplicationContext';
import {EnvironmentLighting} from '../../../src/render/EnvironmentLighting';
import {EnvironmentLightField} from '../../../src/render/EnvironmentLightField';
import {PresentationQueue} from '../../../src/render/PresentationQueue';
import {PresentationChanges} from '../../../src/bridge/presentation-changes';
import {ConfirmedStructurePhaseReader} from '../../../src/render/ConfirmedStructurePhases';
import {createClosedMainMapIntentReader} from '../../../src/render/closed-main-map-intents';
import {ReentrantRenderer} from '../../../src/render/ReentrantRenderer';
import {GraphicsStyleContext,withGraphicsStyle} from '../../../src/render/graphics-style';
import {adapterRendererLimits} from '../../../src/render/webgpu-device-limits';
import {DEFAULT_ROOM_ENABLED} from '../../../src/render/room-settings';
import {DEFAULT_DIORAMA_ENABLED} from '../../../src/render/diorama-settings';
import {createPrivateNativeCloneResidentLane379} from '../../../src/bridge/native-clone-resident';
import {readResidentWorkerMessage} from '../../../src/bridge/resident-protocol';
import {SimulationClient} from '../../../src/bridge/SimulationClient';
import {decodeStoredSave} from '../../../src/ui/save-storage-codec';
import type {SceneRenderHostPort} from '../../../src/render/scene-render-ports';
import type {World} from '../../../src/sim/types';
import type {PawnTrack} from '../../../src/bridge/motion-tracks';
import {prepareWorkerAsset} from './simulation-asset';
import type {Draw} from './scene';

// All scene/worker owners here are the real owners. The frozen proof doesn't
// enable input, audio, UI or live simulation, and never synthesizes a Full.
const clients = new WeakMap<SimulationClient,ReturnType<typeof createPrivateNativeCloneResidentLane379>>();
class FrozenClient extends SimulationClient {
  admitted?:{world:World;tracks?:PawnTrack[];owner:object};
  protected override createDecoder(){const lane=createPrivateNativeCloneResidentLane379();clients.set(this,lane);return lane.reader;}
  protected override createWorker(){return clients.get(this)!.createWorker();}
  protected override bindWorkerOutput(worker:Worker,dispatch:(raw:unknown)=>void,invalid:()=>void){clients.get(this)!.bindOwnedOutput379(worker,dispatch,run=>run(),invalid);}
  protected override workerStopped(){clients.get(this)?.close();}
  protected override readNativeSnapshotDispatch379(raw:unknown){return clients.get(this)!.readOwnedSnapshotDispatch379(raw);}
  protected override readWorkerMessage(raw:unknown){return readResidentWorkerMessage(raw);}
  protected override deliverCorePhase297(raw:unknown){clients.get(this)!.adoptCorePhase297(raw);}
  protected override deliverSnapshot(world:World,_cost:number,_speed:number,_replaced:boolean,tracks?:PawnTrack[],owner?:object){
    if(!owner)throw Error('Missing Native Full owner');
    this.admitted={world,tracks,owner};
  }
}
class Changes extends PresentationChanges {
  readonly structures=new ConfirmedStructurePhaseReader();
  protected override readStructures(world:World){return this.structures.read(world);}
}
class Core extends SceneRenderCore {
  protected override createApplicationContext(){return new SceneApplicationContext();}
  protected override createEnvironmentLighting(){const ctx=this.applicationContext!;return new EnvironmentLighting(new EnvironmentLightField(ctx.topology,w=>ctx.read(w)?.lighting));}
  protected override createIntentReader(){return createClosedMainMapIntentReader();}
  protected override createPresentationQueue(){return new PresentationQueue(this.confirmedIntentReader,()=>new Changes());}
  protected override createStructurePreparation(){return this.applicationContext!.structures;}
  attachLabels(labels:MapLabelsOverlay){this.scene.add(labels.mesh);}
  submit(){this.beginPresentationFrame297();this.frame(performance.now());}
  census(){
    let meshes=0,visible=0;
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});
    this.scene.traverseVisible(o=>{if(o instanceof THREE.Mesh)visible++;});
    return {meshes,visible,world:this.world&&[this.world.width,this.world.height,this.world.tick],triangles:this.stats.triangles,drawCalls:this.stats.drawCalls,phase:this.fatalError??null};
  }
}
export async function openScene(canvas:HTMLCanvasElement|OffscreenCanvas,bitmapFor?:(url:string)=>Promise<ImageBitmap>){
  const log=(phase:string)=>console.info('SceneRenderCore',phase);
  await prepareWorkerAsset();
  log('read save');const url='/les-forges.json';const res=await fetch(url);if(!res.ok)throw Error(url+' '+res.status);
  const client=new FrozenClient(),fault=new Promise<never>((_,reject)=>{client.onError=m=>reject(Error(m));client.onFault=f=>reject(Error(JSON.stringify(f)));});
  log('native migration');await Promise.race([client.load(await decodeStoredSave(await res.text())),fault]);
  if(!client.admitted)throw Error('Load did not receive Native Full');
  const {world,tracks,owner}=client.admitted;
  log('WebGPU');const gpu=new ReentrantRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',requiredLimits:await adapterRendererLimits()});
  await gpu.init();if(!(gpu.backend as {isWebGPUBackend?:boolean}).isWebGPUBackend)throw Error('WebGPU unavailable');
  const device=(gpu.getContext() as GPUCanvasContext).getConfiguration()!.device;
  const jobs:Promise<void>[]=[],assets:string[]=[];
  const labels=new MapLabelsOverlay(),viewport={width:768,height:512};
  const port:SceneRenderHostPort={
   now:()=>performance.now(),hidden:()=>false,backend:()=>'WebGPU',pixelRatio:()=>1,attachSurface:()=>{},
   viewport:()=>viewport,surfaceRect:()=>({left:0,top:0,...viewport}),createCamera:()=>new CameraRig(null),
   selectionReady:()=>false,selectionActive:()=>false,cancelSelection:()=>false,disposeSelection:()=>{},releasePointer:()=>{},
   canMoveCamera:()=>false,cursor:()=>{},title:()=>{},disconnectResize:()=>{},removeInputListeners:()=>{},removeSurface:()=>{},
   drawLabels:(...args)=>labels.draw(...args),prepareLabelsForCompile:()=>labels.prepareForCompile(),disposeLabels:()=>labels.dispose(),
   loadTexture(url,loaded,_progress,failed){
    const job=(async()=>{
     const t=bitmapFor?new THREE.Texture(await bitmapFor(url)):await new THREE.TextureLoader().loadAsync(url);
     if(bitmapFor){const bitmap=t.image as ImageBitmap;t.flipY=false;t.addEventListener('dispose',()=>bitmap.close());}
     t.needsUpdate=true;loaded(t);assets.push(url);
    })().catch(error=>{throw Error('Texture '+url.slice(0,140)+' '+error);});void job.catch(failed);jobs.push(job);
   },
  };
  log('construct scene');const lifecycle={closed:false};const ctx=new GraphicsStyleContext();const view=withGraphicsStyle(ctx,()=>new Core(gpu,true,lifecycle,port));
  view.onFatalError=m=>{throw Error(m);};
  view.attachLabels(labels);view.resize();view.setDioramaEnabled(DEFAULT_DIORAMA_ENABLED);view.setRoomEnabled(DEFAULT_ROOM_ENABLED);
  log('Full adoption');view.setWorld(world,true,0,tracks,true,owner);
  log('asset decode');await Promise.all(jobs);
  log('prepare scene');await view.preparePresentation();await Promise.all(jobs);
  const camera=view.captureGraphicsView(),[x,y,z]=camera.position,[tx,ty,tz]=camera.target;
  return async({view:index}:Draw)=>{
   const angle=index*.84;
   view.restoreGraphicsView({...camera,position:[tx+(x-tx)*Math.cos(angle)+(z-tz)*Math.sin(angle),y,tz-(x-tx)*Math.sin(angle)+(z-tz)*Math.cos(angle)]});
   view.submit();await device.queue.onSubmittedWorkDone();
   return {...view.census(),assets:assets.slice().sort(),worker:typeof document==='undefined',tick:world.tick,camera:view.captureGraphicsView(),style:ctx.preferences.style};
  };
}
