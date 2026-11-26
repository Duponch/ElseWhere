import * as THREE from 'three/webgpu';
import {NativeOverlayCache} from '../../ui3d/NativeOverlayCache';
import {PrototypeCardboardArt,MANAGEMENT_BUTTONS,type CardboardPiece} from '../../ui3d/prototype-art';
import {NATIVE_VIEW_ACTIONS,globalColumn} from '../../ui3d/native-hud-rimworld';
import {applyNativeHudButtonPose} from '../../ui3d/native-hud-art';
import {advanceNativeActivePoses,createNativeSpeedButtons,selectNativeSpeed,nativeTimeBottom} from '../../ui3d/native-speed-controls';
import {HUD_DISTANCE,nativeHudCamera,lightNativeHud,nativeManagementDock,placeBottomRight} from '../../ui3d/native-hud-viewport';
import type {ColonySpeed,SceneSize,SpeedHudHits} from './protocol';

/** An independently owned native HUD layer over the colony's existing GPU.
 * Hit geometry leaves the Worker once. Changed poses carry four transforms. */
export class WorkerSpeedHud {
  private readonly art=new PrototypeCardboardArt();
  private readonly cache=new NativeOverlayCache();
  private readonly scene=new THREE.Scene();
  private readonly camera=nativeHudCamera(1);
  private readonly anchor=new THREE.Group();
  private readonly row=new THREE.Group();
  private readonly activePoses=new Set<CardboardPiece>();
  private readonly buttons:CardboardPiece[];
  private readonly projected=new THREE.Vector3();
  private readonly clip=new THREE.Matrix4();
  private sentVertices=false;
  private width=0;
  private height=0;
  private speed=-1;
  private revision=0;
  private previousTime=0;

  constructor(private readonly uiScale:number,private readonly reducedMotion:boolean,private readonly report:(value:SpeedHudHits)=>void) {
    const root=new THREE.Group();
    root.position.z=-HUD_DISTANCE;this.camera.add(root);this.scene.add(this.camera);
    root.add(this.anchor);this.anchor.add(this.row);lightNativeHud(this.scene,this.camera);
    this.buttons=createNativeSpeedButtons(globalColumn(NATIVE_VIEW_ACTIONS.length).speed,this.row,
      options=>this.art.createPiece(options),()=>this.speed,()=>{});
  }
  pointer(hover:ColonySpeed|null,pressed:boolean):void {
    for(const piece of this.buttons){
      const selected=piece.userData.nativeId==='hud:speed:'+hover;
      piece.userData.hoverTarget=Number(selected);
      if(pressed&&selected)piece.userData.pressVal=1;
    }
  }
  draw(renderer:THREE.WebGPURenderer,size:SceneSize,speed:number,now:number):void {
    const dt=this.previousTime?Math.max(0,Math.min(.05,(now-this.previousTime)/1000)):1/60;
    this.previousTime=now;
    let changed=false;
    if(this.width!==size.width||this.height!==size.height){
      this.width=size.width;this.height=size.height;
      const w=this.width/this.uiScale,h=this.height/this.uiScale;
      this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
      const visH=2*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)*HUD_DISTANCE,s=visH/h*100;
      this.anchor.scale.setScalar(s);placeBottomRight(this.anchor,visH*this.camera.aspect/2,visH/2,s);
      this.row.position.y=nativeTimeBottom(nativeManagementDock(this.width,w,h,MANAGEMENT_BUTTONS.length).bottomDockHeight)*.01;
      changed=true;
    }
    if(this.speed!==speed){this.speed=speed;selectNativeSpeed(this.buttons,speed,this.activePoses);changed=true;}
    changed=advanceNativeActivePoses(this.activePoses,dt)||changed;
    for(const piece of this.buttons){
      const data=piece.userData;
      if(data.hoverVal===data.hoverTarget&&data.pressVal===0)continue;
      data.hoverVal=this.reducedMotion?data.hoverTarget:data.hoverVal+(data.hoverTarget-data.hoverVal)*14*dt;
      if(Math.abs(data.hoverTarget-data.hoverVal)<.001)data.hoverVal=data.hoverTarget;
      data.pressVal=this.reducedMotion?0:Math.max(0,data.pressVal-5.5*dt);
      changed=applyNativeHudButtonPose(piece)||changed;
    }
    if(changed)this.revision++;
    this.cache.draw(renderer,this.scene,this.camera,this.revision,false);
    if(changed)this.report(this.projectHits());
  }
  private projectHits():SpeedHudHits {
    this.scene.updateMatrixWorld(true);
    const buttons=this.buttons.map(piece=>{
      const mesh=piece.userData.mesh,geometry=mesh.geometry;
      const clip=this.clip.multiplyMatrices(this.camera.projectionMatrix,this.camera.matrixWorldInverse).multiply(mesh.matrixWorld);
      if(!geometry.boundingBox)geometry.computeBoundingBox();
      const box=geometry.boundingBox!,bounds=[Infinity,Infinity,-Infinity,-Infinity];
      for(let corner=0;corner<8;corner++){
        const p=this.projected.set(corner&1?box.max.x:box.min.x,corner&2?box.max.y:box.min.y,corner&4?box.max.z:box.min.z).applyMatrix4(clip);
        const x=(p.x+1)*this.width/2,y=(1-p.y)*this.height/2;
        bounds[0]=Math.min(bounds[0]!,x);bounds[1]=Math.min(bounds[1]!,y);bounds[2]=Math.max(bounds[2]!,x);bounds[3]=Math.max(bounds[3]!,y);
      }
      let vertices:Float32Array|undefined;
      if(!this.sentVertices){
        const source=geometry.getAttribute('position'),index=geometry.getIndex(),count=index?.count??source.count;
        vertices=new Float32Array(count*3);
        for(let i=0;i<count;i++)this.projected.fromBufferAttribute(source,index?index.getX(i):i).toArray(vertices,i*3);
      }
      return {speed:Number(String(piece.userData.nativeId).slice('hud:speed:'.length)) as ColonySpeed,transform:clip.toArray(),bounds,vertices};
    });
    this.sentVertices=true;
    return {width:this.width,height:this.height,buttons};
  }
  dispose():void {this.cache.dispose();this.art.dispose();this.scene.clear();}
}
