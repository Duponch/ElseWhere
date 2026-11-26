import * as THREE from 'three/webgpu';
import {SceneRenderCore} from '../SceneRenderCore';
import {CameraRig} from '../CameraRig';
import {MapLabelsOverlay} from '../MapLabelsOverlay';
import {SceneApplicationContext} from '../SceneApplicationContext';
import {EnvironmentLighting} from '../EnvironmentLighting';
import {EnvironmentLightField} from '../EnvironmentLightField';
import {PresentationQueue} from '../PresentationQueue';
import {PresentationChanges} from '../../bridge/presentation-changes';
import {ConfirmedStructurePhaseReader} from '../ConfirmedStructurePhases';
import {createClosedMainMapIntentReader} from '../closed-main-map-intents';
import {ReentrantRenderer} from '../ReentrantRenderer';
import {GraphicsStyleContext,withGraphicsStyle} from '../graphics-style';
import {adapterRendererLimits} from '../webgpu-device-limits';
import {readColonyGraphicsPreferences} from '../colony-graphics-preferences';
import {actualCameraView301} from '../actual-camera-view-301';
import type {SceneRenderHostPort} from '../scene-render-ports';
import type {World} from '../../sim/types';
import {hitActors} from '../PawnSelectionInput';
import {clickedMapObject} from '../../ui/map-object-selection';
import {readNativeCorePhaseInput297} from '../../bridge/native-clone-resident';
import {WorkerSpeedHud} from './speed-hud';
import type {ColonySpeed,SpeedHudHits} from './protocol';
import type {CameraInput,PickTarget,PresentedPick,SceneSize} from './protocol';

class SceneChanges extends PresentationChanges {
  private readonly confirmedStructures=new ConfirmedStructurePhaseReader();
  protected override readStructures(world:World){return this.confirmedStructures.read(world);}
}

export class WorkerColonyScene extends SceneRenderCore {
  submissions=0;
  afterPickDraw?:()=>void;
  private speedHud?:WorkerSpeedHud;
  private drawSpeedHud?:()=>void;
  enableSpeedHud(uiScale:number,reducedMotion:boolean,size:SceneSize,speed:()=>ColonySpeed,report:(hits:SpeedHudHits)=>void):void {
    if(this.speedHud)return;
    const hud=new WorkerSpeedHud(uiScale,reducedMotion,report);
    this.speedHud=hud;this.drawSpeedHud=()=>hud.draw(this.renderer,size,speed(),this.hostPort.now());
  }
  speedHudPointer(hover:ColonySpeed|null,pressed:boolean):void {this.speedHud?.pointer(hover,pressed);}
  override dispose():void {
    this.drawSpeedHud=undefined;
    try{this.speedHud?.dispose();}finally{this.speedHud=undefined;super.dispose();}
  }
  private readonly orbitAxis=new THREE.Vector3(0,1,0);
  private readonly orbitOffset=new THREE.Vector3();
  protected override createApplicationContext(){return new SceneApplicationContext();}
  protected override createEnvironmentLighting(){
    const context=this.applicationContext!;
    return new EnvironmentLighting(new EnvironmentLightField(context.topology,world=>context.read(world)?.lighting));
  }
  protected override createIntentReader(){return createClosedMainMapIntentReader();}
  protected override createPresentationQueue(){return new PresentationQueue(this.confirmedIntentReader,()=>new SceneChanges());}
  protected override createStructurePreparation(){return this.applicationContext!.structures;}

  static async open(
    canvas:OffscreenCanvas|HTMLCanvasElement, size:SceneSize, isHidden:()=>boolean,
    loadTexture:SceneRenderHostPort['loadTexture'], onFailure:(message:string)=>void,graphics=readColonyGraphicsPreferences(()=>null),
  ):Promise<WorkerColonyScene> {
    const gpu=new ReentrantRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',requiredLimits:await adapterRendererLimits()});
    let result:WorkerColonyScene|undefined;
    try {
      await gpu.init();
      if(!(gpu.backend as {isWebGPUBackend?:boolean}).isWebGPUBackend)throw Error('WebGPU est indisponible pour cette colonie.');
      const labels=new MapLabelsOverlay();
      // The page owns the surface and sends camera commands. Selection and
      // DOM input have no owners in this dedicated colony viewer.
      const port:SceneRenderHostPort={
        now:()=>performance.now(),hidden:isHidden,backend:()=>'WebGPU',pixelRatio:()=>size.pixelRatio,
        attachSurface:()=>{},removeSurface:()=>{},createCamera:()=>new CameraRig(null),
        viewport:()=>size,surfaceRect:()=>({left:0,top:0,...size}),
        selectionReady:()=>false,selectionActive:()=>false,cancelSelection:()=>false,disposeSelection:()=>{},
        releasePointer:()=>{},canMoveCamera:()=>false,cursor:()=>{},title:()=>{},
        drawLabels:(...args)=>labels.draw(...args),prepareLabelsForCompile:()=>labels.prepareForCompile(),
        disposeLabels:()=>labels.dispose(),disconnectResize:()=>{},removeInputListeners:()=>{},loadTexture,
      };
      result=withGraphicsStyle(new GraphicsStyleContext(graphics.style),()=>new WorkerColonyScene(gpu,graphics.groundGrassEnabled,{closed:false},port));
      result.onFatalError=onFailure;
      result.scene.add(labels.mesh);result.resize();
      result.setDioramaEnabled(graphics.dioramaEnabled);result.setRoomEnabled(graphics.roomEnabled);
      result.setDecorOcclusion(graphics.decorOcclusion);result.setLightingSettings(graphics.lighting);
      result.setShadowSettings(graphics.shadows);result.setAnimationSettings(graphics.animation);
      result.setTexturesEnabled(graphics.texturesEnabled);
      result.setDesignationMinCellPixels(graphics.designationMinCellPixels);labels.setMinCellPixels(graphics.itemLabelMinCellPixels);
      return result;
    } catch(error) {
      if(result)result.dispose();else await gpu.dispose();
      throw error;
    }
  }
  get ready():boolean{return !this.disposed&&!this.fatalError&&!this.preparing&&!this.presentationStopped;}
  protected override renderScene():void {
    super.renderScene();
    this.drawSpeedHud?.();
    this.submissions++;
    this.afterPickDraw?.();
  }
  readPick(u:number,v:number,viewport:SceneSize):PresentedPick {
    const world=this.world;
    if(!world||!this.ready)throw Error('La carte ne peut pas être inspectée.');
    const x=u*viewport.width,y=v*viewport.height;
    const actor=hitActors(this.screenPawns(),x,y)[0];
    let target:PickTarget;
    if(actor){
      const kind=world.wildlife?.animals.some(a=>a.id===actor.id)?'animal':world.mechanoids?.some(m=>m.id===actor.id)?'mechanoid':'pawn';
      target={kind,id:actor.id};
    }else{
      const lamp=this.wallAttachmentCellAt(x,y);
      const hit=lamp?{cell:lamp,preferred:undefined}:this.objectPickAt(x,y);
      if(!hit)target={kind:'outside'};
      else{
        const object=clickedMapObject(world,hit.cell,undefined,hit.preferred);
        target=object?{...object,...hit.cell}:{kind:'terrain',...hit.cell};
      }
    }
    const full=readNativeCorePhaseInput297(this.received?.coreInput297);
    return {frame:this.submissions,tick:world.tick,presentationTick:this.hasTracks?this.timeline.tick:world.tick,
      ...(full?.kind==='full'&&full.world===world?{epoch:full.anchor.epoch,revision:full.anchor.revision}:{}),
      map:world.campaignMap?.revision===2?world.campaignMap.activeMapId:0,camera:this.captureGraphicsView(),viewport:{...viewport},u,v,target};
  }
  frameWithAdmissions(now:number,drain:()=>void):void {
    this.resumeAfterFrameStarvation();this.beginPresentationFrame297();drain();
    this.frame(Math.max(now,this.hostPort.now()));
  }
  actualView(){
    const world=this.world;
    if(!world||!this.ready)return null;
    const mapId=world.campaignMap?.revision===2?world.campaignMap.activeMapId:0;
    return actualCameraView301(this.camera,mapId,world.width,world.height,this.rig.span);
  }
  changeCamera({orbit=0,panX=0,panZ=0,zoom=1}:CameraInput):void {
    if(![orbit,panX,panZ,zoom].every(Number.isFinite)||zoom<=0)return;
    const {camera,controls}=this;
    this.orbitOffset.copy(camera.position).sub(controls.target).applyAxisAngle(this.orbitAxis,orbit);
    controls.target.x+=panX;controls.target.z+=panZ;camera.position.copy(controls.target).add(this.orbitOffset);
    if(zoom!==1){
      const rig=this.rig as CameraRig;
      camera.zoom=THREE.MathUtils.clamp(camera.zoom*zoom,rig.controls.minZoom,rig.controls.maxZoom);
      camera.updateProjectionMatrix();
    }
    controls.update();this.rig.constrainRoom?.();this.invalidatePausedShadow();
  }
  scaleAndResize(ratio:number):void {this.renderer.setPixelRatio(Math.min(ratio,1.8));this.resize();}
  animate(fn:(now:number)=>void):void {this.renderer.setAnimationLoop(fn);}
  adapterInfo(){
    const info=(this.renderer.getContext() as GPUCanvasContext).getConfiguration()?.device.adapterInfo;
    return {backend:'webgpu' as const,vendor:info?.vendor??'',architecture:info?.architecture??''};
  }
  settleDevice():Promise<void>{return (this.renderer.getContext() as GPUCanvasContext).getConfiguration()!.device.queue.onSubmittedWorkDone();}
  census(){
    let meshes=0,visible=0;
    this.scene.traverse(o=>{if(o instanceof THREE.Mesh)meshes++;});
    this.scene.traverseVisible(o=>{if(o instanceof THREE.Mesh)visible++;});
    return {meshes,visible,world:this.world&&[this.world.width,this.world.height,this.world.tick],triangles:this.stats.triangles,drawCalls:this.stats.drawCalls,phase:this.fatalError??null};
  }
}
