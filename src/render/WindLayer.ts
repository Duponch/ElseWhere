import * as THREE from 'three/webgpu';
import { Fn,attribute,mat4,normalLocal,positionLocal,transformNormal,uniform,select,vec3,vec4,cos,sin,instanceIndex,uint } from 'three/tsl';
import { BoxMesh } from './BoxMesh';
import { material } from './primitives';
import type { World } from '../sim/types';
import { isPowerActive } from '../sim/power-rules';
import { WIND_BLADE_COLOR, WIND_BLADE_SHAPE, windBladeHub, windBladeInitialPhase } from './wind-blade-parts';
import { ResourceTargetTint } from './resource-target-tint';
import type { AnimationDetail } from './AnimationDetail';
import { RetainedAnimation } from './RetainedAnimation';
import {currentGraphicsStyle} from './graphics-style';
import {createOrigamiContour,type OrigamiContourBinding} from './origami/contours';

interface Spin {tick:number;phase:number;speed:number}
/** Three retained blades per turbine. Only changes of power/placement upload
 * attributes; presentation advances one shared tick, never CPU blade matrices. */
export class WindLayer {
  readonly group=new THREE.Group();
  readonly tick=uniform(0);
  readonly mesh:BoxMesh;
  private readonly contour?:OrigamiContourBinding;
  private readonly base=new THREE.BoxGeometry(1,1,1);
  private readonly material=material(0xffffff);
  private key:string|null=null;
  private readonly history=new Map<number,{current:Spin;previous:Spin}>();
  private readonly targetTint=new ResourceTargetTint();
  private targetPreviewIds=new Set<number>();
  private readonly targetSlots=new Map<number,number>();
  private readonly animation:RetainedAnimation;
  constructor(configure?:(material:THREE.MeshStandardNodeMaterial)=>void,detail?:AnimationDetail){
    this.animation=new RetainedAnimation(detail);
    configure?.(this.material);
    this.material.positionNode=Fn(()=>{
      const transform=mat4(attribute('boxMatrix0','vec4'),attribute('boxMatrix1','vec4'),attribute('boxMatrix2','vec4'),attribute('boxMatrix3','vec4'));
      const current=attribute('windCurrent','vec4'),previous=attribute('windPrevious','vec4');
      const basis=this.animation.choose(()=>{
        const segment=select(this.tick.lessThan(current.x),previous,current);
        const angle=segment.y.add(this.tick.sub(segment.x).mul(segment.z)).add(current.w);
        return vec4(cos(angle),sin(angle),0,0);
      },uint(instanceIndex));
      const c=basis.x,s=basis.y;
      const shape=attribute('windShape','vec4'),p=positionLocal.mul(shape.xyz).add(vec3(0,shape.w,0));
      const rotated=vec3(p.x.mul(c).sub(p.y.mul(s)),p.x.mul(s).add(p.y.mul(c)),p.z);
      const n=normalLocal.toVar();normalLocal.assign(transformNormal(vec3(n.x.mul(c).sub(n.y.mul(s)),n.x.mul(s).add(n.y.mul(c)),n.z),transform));
      return transform.mul(rotated).xyz;
    })();
    this.material.colorNode=attribute('boxColor','vec3');this.material.userData.rendererOwned=true;
    this.mesh=new BoxMesh(this.base,this.material,256);this.allocateAttributes(256);
    this.mesh.name='wind-turbine-blades';this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.group.add(this.mesh);
    const context=currentGraphicsStyle();
    if(context?.origami){this.contour=createOrigamiContour(this.mesh,context);this.group.add(this.contour.line);}
  }
  private allocateAttributes(capacity:number):void {
    for(const name of ['windCurrent','windPrevious','windShape'])this.mesh.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.StaticDrawUsage));
  }
  setTargetPreview(ids:ReadonlySet<number>):void {
    if(ids.size===this.targetPreviewIds.size&&[...ids].every(id=>this.targetPreviewIds.has(id)))return;
    this.targetTint.restore();this.targetPreviewIds=new Set(ids);this.tintTargets();
  }
  clearTargetPreview():void {this.targetTint.restore();this.targetPreviewIds.clear();}
  private tintTargets():void {
    if(!this.targetPreviewIds.size)return;
    const slots:number[]=[];
    for(const id of this.targetPreviewIds){const first=this.targetSlots.get(id);if(first!==undefined)slots.push(first,first+1,first+2);}
    this.targetTint.applySlots(this.mesh.colorBuffer,slots);
  }
  adopt(world:World,reset=false):void {
    if(reset){this.clearTargetPreview();this.key=null;this.history.clear();this.animation.reset();}
    const turbines=world.structures.filter(s=>s.kind==='wind-turbine');
    const key=turbines.map(s=>`${s.id}:${s.x}:${s.z}:${s.orientation}:${isPowerActive(s)}:${s.wind?.cachedWatts}`).join('|');
    if(key===this.key)return;this.key=key;
    this.targetTint.restore();this.targetSlots.clear();
    const live=new Set(turbines.map(s=>s.id));for(const id of this.history.keys())if(!live.has(id))this.history.delete(id);
    const count=turbines.length*3;if(count>this.mesh.instanceMatrix.count){const capacity=2**Math.ceil(Math.log2(count));this.mesh.allocate(this.base,capacity);this.allocateAttributes(capacity);}
    const current=this.mesh.geometry.getAttribute('windCurrent'),previous=this.mesh.geometry.getAttribute('windPrevious'),shape=this.mesh.geometry.getAttribute('windShape'),object=new THREE.Object3D(),color=new THREE.Color(WIND_BLADE_COLOR);
    let index=0;
    for(const s of turbines){
      this.targetSlots.set(s.id,index);
      const old=this.history.get(s.id),speed=isPowerActive(s)?(s.wind?.cachedWatts??0)/3450*.35:0;
      const initial=windBladeInitialPhase(s.id);
      const phase=old?(old.current.phase+(world.tick-old.current.tick)*old.current.speed)%(Math.PI*2):initial;
      const changed=!old||old.current.speed!==speed;
      const pair=changed?{current:{tick:world.tick,phase,speed},previous:old?.current??{tick:world.tick,phase,speed}}:old!;this.history.set(s.id,pair);
      const hub=windBladeHub(s);object.position.set(hub.x,hub.y,hub.z);object.rotation.set(0,hub.ry!,0);object.scale.set(1,1,1);object.updateMatrix();
      for(let blade=0;blade<3;blade++){
        this.mesh.setMatrixAt(index,object.matrix);this.mesh.setColorAt(index,color);
        for(const [attribute,segment] of [[current,pair.current],[previous,pair.previous]] as const)attribute.setXYZW(index,segment.tick,segment.phase,segment.speed,blade*Math.PI*2/3);
        shape.setXYZW(index,WIND_BLADE_SHAPE.sx,WIND_BLADE_SHAPE.sy,WIND_BLADE_SHAPE.sz,WIND_BLADE_SHAPE.offsetY);index++;
      }
    }
    this.mesh.activeCount=count;
    // Color writers rebuild every live blade. A pending preview range must not
    // restrict their upload when ordinary adoption changes membership/order.
    this.mesh.colorBuffer.clearUpdateRanges();if(count)this.mesh.colorBuffer.addUpdateRange(0,count*3);
    this.mesh.instanceMatrix.needsUpdate=this.mesh.colorBuffer.needsUpdate=true;
    for(const a of [current,previous,shape])a.needsUpdate=true;
    this.mesh.computeBoundingSphere();if(count)this.mesh.boundingSphere.radius+=3.2;
    this.tintTargets();
    this.animation.reconcile(turbines.flatMap(s=>{
      const hub=windBladeHub(s);return [0,1,2].map(blade=>({id:s.id*3+blade,x:hub.x,y:hub.y,z:hub.z}));
    }));
    this.contour?.sync();
  }
  present(tick:number):void {
    this.tick.value=tick;if(!this.mesh.activeCount)return;
    const current=this.mesh.geometry.getAttribute('windCurrent'),previous=this.mesh.geometry.getAttribute('windPrevious');
    this.animation.present((owner,row)=>{
      const segment=tick<current.getX(row)?previous:current;
      const angle=segment.getY(row)+(tick-segment.getX(row))*segment.getZ(row)+current.getW(row);
      owner.values[0]=Math.cos(angle);owner.values[1]=Math.sin(angle);
    });
  }
  prepareForCompile():()=>void {
    if(this.mesh.activeCount)return ()=>{};
    const version=this.mesh.instanceMatrix.version;this.mesh.activeCount=1;this.contour?.sync();
    return ()=>{if(this.mesh.instanceMatrix.version===version)this.mesh.activeCount=0;this.contour?.sync();};
  }
  dispose():void {this.contour?.dispose();this.animation.dispose();this.clearTargetPreview();this.mesh.dispose();this.base.dispose();this.material.dispose();}
}
