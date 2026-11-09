import { PAWN_MODEL_SCALE } from '../world/scale';
import * as THREE from 'three/webgpu';
import { Fn,If,attribute,float,instanceIndex,positionLocal,positionGeometry,sin,cos,uniform,varying,vec2,vec3,mix,texture,uv,uint } from 'three/tsl';
import { pawnPresentationPose,type PresentationClock,type PresentationPoseClock } from './pawn-presentation';
import type { AnimationDetail } from './AnimationDetail';
import { FxAnimationCache,fxActorCache,fxActorPose } from './FxAnimationCache';
import { groundFireVisualScale } from './fire-paper';
import { acquireFirePaint, releaseFirePaint } from './fire-paint';
import type { PawnLayer } from './PawnLayer';
import type { World } from '../sim/types';

function fireGeometry():THREE.InstancedBufferGeometry {
  // Restore the original orange/yellow pyramid, including its original UVs.
  const source=new THREE.ConeGeometry(.38,1.5,5,1),g=new THREE.InstancedBufferGeometry();
  g.index=source.index;
  const p=source.getAttribute('position'),normal=source.getAttribute('normal'),uvs=source.getAttribute('uv');
  // The native attached-human full graph reads six instance streams. Share
  // one static vertex binding so position/normal/UV plus fxSlot never exceed
  // WebGPU's eight-buffer limit during the empty-fire compilation warm-up.
  // Keep every authored value and the actor's shared instance aliases exact.
  const vertices=new THREE.InterleavedBuffer(new Float32Array(p.count*12),12).setUsage(THREE.StaticDrawUsage);
  for(let i=0;i<p.count;i++){
    const h=p.getY(i)+.75;
    vertices.array.set([p.getX(i),p.getY(i),p.getZ(i),normal.getX(i),normal.getY(i),normal.getZ(i),uvs.getX(i),uvs.getY(i),Math.sin(h*2.4),Math.cos(h*2.4),Math.sin(h*2.1),Math.cos(h*2.1)],i*12);
  }
  g.setAttribute('position',new THREE.InterleavedBufferAttribute(vertices,3,0));
  g.setAttribute('normal',new THREE.InterleavedBufferAttribute(vertices,3,3));
  g.setAttribute('uv',new THREE.InterleavedBufferAttribute(vertices,2,6));
  g.setAttribute('fireStaticShape',new THREE.InterleavedBufferAttribute(vertices,4,8));
  return g;
}
const textureSwitches=new WeakMap<THREE.Material,{value:boolean}>();
function fireMaterial(owner:THREE.Node<'uint'>=instanceIndex):THREE.MeshBasicNodeMaterial {
  const m=new THREE.MeshBasicNodeMaterial();
  const map=acquireFirePaint(),enabled=uniform(true);
  textureSwitches.set(m,enabled);
  const base=mix(vec3(1,.71,.08),vec3(1,.14,.015),positionGeometry.y.add(.75).div(1.5).clamp(0,1));
  // Change which brush paths cross each flame without a second texture,
  // instance buffer, draw or pixel sample. The slot stays stable while lit.
  const paintOffset=varying(float(owner).mul(.618033989).fract());
  m.colorNode=Fn(()=>{
    const color=base.toVar();
    // A uniform branch avoids pigment sampling with textures disabled.
    If(enabled,()=>{color.assign(texture(map,uv().add(vec2(paintOffset,0))).rgb);});
    return color;
  })();
  let released=false;
  m.addEventListener('dispose',()=>{if(!released){released=true;releaseFirePaint();}});
  return m;
}
export function setFireTexturesEnabled(mesh:THREE.Mesh,enabled:boolean):void {
  for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    const flag=textureSwitches.get(material);if(flag)flag.value=enabled;
  }
}
/** Ground fires share one prepared instanced graph. No lights/shadows per fire. */
export class FireLayer {
  readonly mesh:THREE.Mesh;
  private readonly tick=uniform(0);
  private capacity=32;
  private signature='';
  private readonly cache:FxAnimationCache;
  private flames:{x:number;y:number;z:number;size:number}[]=[];
  private drawn:number[]=[];
  constructor(private readonly detail?:AnimationDetail){
    this.cache=new FxAnimationCache(3,detail);
    const material=fireMaterial(detail?uint(attribute('fxSlot','float')):instanceIndex);
    material.positionNode=this.cache.choose(()=>Fn(()=>{
      const data=attribute('firePosition','vec4'),height=positionLocal.y.add(.75);
      const phase=this.tick.mul(2*Math.PI/18).add(data.x.mul(7)).add(data.z.mul(11));
      const pulse=sin(phase).mul(.14).add(.96);
      const sway=sin(phase.add(height.mul(2.4))).mul(height).mul(.10);
      const curl=cos(phase.mul(1.27).add(height.mul(2.1))).mul(height).mul(.07);
      const p=vec3(positionLocal.x.add(sway),height.mul(pulse),positionLocal.z.add(curl)).mul(data.w);
      return data.w.greaterThan(0).select(p.add(data.xyz),vec3(0,-100,0));
    })(),()=>Fn(()=>{
      const data=attribute('firePosition','vec4'),height=positionLocal.y.add(.75),shape=attribute('fireStaticShape','vec4');
      const a=this.cache.cell(1),b=this.cache.cell(2);
      const sway=a.x.mul(shape.y).add(a.y.mul(shape.x)).mul(height).mul(.10);
      const curl=b.y.mul(shape.w).sub(b.x.mul(shape.z)).mul(height).mul(.07);
      return vec3(positionLocal.x.add(sway),height.mul(a.z),positionLocal.z.add(curl)).mul(data.w).add(data.xyz);
    })());
    this.mesh=new THREE.Mesh(fireGeometry(),material);this.mesh.name='Ground fire — shared GPU flames';this.mesh.frustumCulled=false;this.allocate();
  }
  private allocate():void {
    this.mesh.geometry.dispose();this.mesh.geometry.setAttribute('firePosition',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*4),4));
    this.mesh.geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity),1));
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount=this.detail?0:1;
  }
  adopt(world:World,reset=false):void {
    const fires=(world.fires?.items??[]).filter(f=>f.attachedPawnId===undefined&&f.attachedAnimalId===undefined);
    const campfires=world.structures.filter(s=>s.kind==='campfire'&&!!s.fuel?.ticks),torches=world.structures.filter(s=>s.kind==='torch-lamp'&&!!s.fuel?.ticks);
    const key=fires.map(f=>`${f.id}:${f.x}:${f.z}:${f.size}`).join('|')+';'+campfires.map(s=>`${s.id}:${s.x}:${s.z}`).join('|')+';'+torches.map(s=>`${s.id}:${s.x}:${s.z}`).join('|');if(!reset&&key===this.signature)return;this.signature=key;
    const count=fires.length+campfires.length*3+torches.length;
    if(count>this.capacity){while(this.capacity<count)this.capacity*=2;this.allocate();}
    const a=this.mesh.geometry.getAttribute('firePosition') as THREE.InstancedBufferAttribute;
    // A new small fire used to disappear behind the ground/logs in the
    // isometric view. Keep one GPU instance per ground fire, but give its
    // visible flame a minimum silhouette while preserving size ordering.
    this.flames=[];this.cache.reset();this.drawn=[];
    let i=0;for(const f of fires){const size=groundFireVisualScale(f.size);a.setXYZW(i++,f.x,0,f.z,size);this.flames.push({x:f.x,y:0,z:f.z,size});}
    for(const s of campfires)for(let j=0;j<3;j++){const item={x:s.x+(j-1)*.13,y:.2+(j%2)*.045,z:s.z+(j%2)*.09,size:j===1?.54:.40};a.setXYZW(i++,item.x,item.y,item.z,item.size);this.flames.push(item);}
    for(const s of torches){const item={x:s.x,y:.89,z:s.z,size:.23};a.setXYZW(i++,item.x,item.y,item.z,item.size);this.flames.push(item);}
    if(!count)a.setXYZW(0,0,-100,0,0);
    a.needsUpdate=true;(this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount=this.detail?count:Math.max(1,count);this.mesh.visible=this.detail?count>0:true;
  }
  present(tick:number):void {
    this.tick.value=((tick%3600)+3600)%3600;
    if(!this.detail)return;
    const positions=this.mesh.geometry.getAttribute('firePosition') as THREE.InstancedBufferAttribute,slots=this.mesh.geometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;
    let count=0,dirty=false;
    for(let row=0;row<this.flames.length;row++){
      const f=this.flames[row]!,level=this.cache.sample(row,f.x,f.y,f.z,()=>{
        const phase=this.tick.value*2*Math.PI/18+f.x*7+f.z*11;
        this.cache.set(row,1,Math.sin(phase),Math.cos(phase),Math.sin(phase)*.14+.96);
        this.cache.set(row,2,Math.sin(phase*1.27),Math.cos(phase*1.27));
      });
      if(level===2)continue;
      if(this.drawn[count]!==row){positions.setXYZW(count,f.x,f.y,f.z,f.size);slots.setX(count,row);this.drawn[count]=row;dirty=true;}count++;
    }
    this.drawn.length=count;if(dirty)positions.needsUpdate=slots.needsUpdate=true;
    (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount=count;this.mesh.visible=count>0;this.cache.flush();
  }
  setTexturesEnabled(enabled:boolean):void {setFireTexturesEnabled(this.mesh,enabled);}
  dispose():void {this.cache.dispose();this.flames.length=0;this.mesh.geometry.dispose();(this.mesh.material as THREE.Material).dispose();}
}

/** Burning actors share their body's exact motion attributes, including stun,
 * slowed edges, furniture heights and carried-patient pose adjustments. */
const attachedStates=new WeakMap<THREE.Mesh,{cache:FxAnimationCache;capacity:number;drawn:number[];scale:number;versions:number[];amounts:number[]}>();
/** The original (non-cached) flame position graph of an attached fire. */
function attachedFireOriginal(clock:PresentationPoseClock,scale:number,carried:boolean,scaled:boolean,before?:THREE.Node):THREE.Node<'vec3'> {
  return Fn(()=>{
    before?.toStack();
    const size=attribute('aFire','float'),pose=pawnPresentationPose(clock,uint(attribute('fxSlot','float')));
    const pulse=sin(clock.travelTime.mul(8).add(pose.x)).mul(.15).add(1);
    const local=vec3(positionLocal.x,positionLocal.y.add(.75).mul(pulse),positionLocal.z)
      .mul(size.mul(scale).mul(scaled?attribute('aScale','float'):float(1)));
    const offset=carried?attribute('aMotion','vec4').z.equal(6).select(vec3(sin(pose.w).mul(.3*PAWN_MODEL_SCALE),.95+.19*PAWN_MODEL_SCALE,cos(pose.w).mul(.3*PAWN_MODEL_SCALE)),vec3(0)):vec3(0);
    return size.greaterThan(0).select(local.add(pose.xyz).add(offset),vec3(0,-100,0));
  })() as THREE.Node<'vec3'>;
}
/** Shape flags an attached fire reads from its actor source. */
export function attachedFireShape(source:THREE.BufferGeometry):{carried:boolean;scaled:boolean} {return{carried:source.hasAttribute('aMotion'),scaled:source.hasAttribute('aScale')};}
/** One attached-fire program for several actor batches of the same shape
 * whose clocks are read per drawn object (written by binder). It is the graph
 * attachedFireMesh builds when its effect cache keeps continuous middle
 * detail, which never reads the cache in the shader. */
export function sharedAttachedFireMaterial(clock:PresentationPoseClock,scale:number,detail:AnimationDetail|undefined,shape:{carried:boolean;scaled:boolean},binder:THREE.Node):THREE.MeshBasicNodeMaterial {
  const material=fireMaterial(detail?uint(attribute('fxSlot','float')):instanceIndex);
  material.positionNode=attachedFireOriginal(clock,scale,shape.carried,shape.scaled,binder);return material;
}
export function attachedFireMesh(source:THREE.BufferGeometry,clock:PresentationClock,scale=1,detail?:AnimationDetail,shared?:THREE.MeshBasicNodeMaterial):THREE.Mesh {
  const geometry=fireGeometry(),count=source.getAttribute('aFrom').count;
  const size=new THREE.InstancedBufferAttribute(new Float32Array(count),1);source.setAttribute('aFire',size);
  const {carried,scaled}=attachedFireShape(source);
  for(const name of ['aFrom','aTo','aTravel','aFire',...(carried?['aMotion']:[]),...(scaled?['aScale']:[])])geometry.setAttribute(name,source.getAttribute(name));
  const cache=new FxAnimationCache(3,detail);
  geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(count),1));
  const slots=geometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;for(let i=0;i<count;i++)slots.setX(i,i);
  let material=shared;
  if(!material){
    material=fireMaterial(detail?uint(attribute('fxSlot','float')):instanceIndex);material.positionNode=cache.choose(()=>attachedFireOriginal(clock,scale,carried,scaled),()=>{
      const offset=cache.cell(1),shape=cache.cell(2),pose=pawnPresentationPose(clock,uint(attribute('fxSlot','float')));
      return vec3(positionLocal.x,positionLocal.y.add(.75).mul(shape.x),positionLocal.z).mul(shape.y).add(pose.xyz).add(offset.xyz);
    });
    material.addEventListener('dispose',()=>cache.dispose());
  }else if(cache.reads)throw Error('A shared attached-fire program cannot read a per-batch effect cache');
  geometry.instanceCount=0;const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.name='Attached fire — body GPU poses';
  attachedStates.set(mesh,{cache,capacity:0,drawn:[],scale,versions:[],amounts:[]});
  return mesh;
}
/** Releases the effect cache of an attached fire drawn with a shared program
 * (an owned program releases it with its material). */
export function disposeAttachedFireCache(mesh:THREE.Mesh):void {attachedStates.get(mesh)?.cache.dispose();}

/** Called after the body cache publication. Slots refer to the actor source,
 * even though only visible, burning actors occupy the compact flame stream. */
export function presentAttachedFire(mesh:THREE.Mesh,source:THREE.BufferGeometry,clock:PresentationClock,detail?:AnimationDetail):void {
  if(!detail)return;
  const state=attachedStates.get(mesh);if(!state)return;
  const geometry=mesh.geometry as THREE.InstancedBufferGeometry,fire=source.getAttribute('aFire');if(!fire)return;
  const actors=source instanceof THREE.InstancedBufferGeometry?Math.min(fire.count,Math.max(0,source.instanceCount)):fire.count;
  // Capacity is not membership: removed actors can leave burning tail values.
  // Keep empty resident rigs cheap without altering their compile warm-up.
  if(actors===0){state.drawn.length=0;geometry.instanceCount=0;mesh.visible=false;return;}
  const names=['aFrom','aTo','aTravel','aFire',...(source.hasAttribute('aMotion')?['aMotion']:[]),...(source.hasAttribute('aScale')?['aScale']:[])];
  if(state.capacity<fire.count||geometry.getAttribute('aFrom')===source.getAttribute('aFrom')){
    const borrowed=geometry.getAttribute('aFrom')===source.getAttribute('aFrom');
    // Remove borrowed actor aliases before releasing this geometry. Native
    // RenderObject disposal clears its cached bindings first, so Geometries
    // only releases the remaining flame-owned attributes and index.
    if(borrowed)for(const name of names)geometry.deleteAttribute(name);
    geometry.dispose();state.capacity=Math.max(1,2**Math.ceil(Math.log2(fire.count)));
    for(const name of names){const input=source.getAttribute(name);geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(state.capacity*input.itemSize),input.itemSize).setUsage(THREE.DynamicDrawUsage));}
    geometry.setAttribute('fxSlot',new THREE.InstancedBufferAttribute(new Float32Array(state.capacity),1));state.drawn=[];state.versions=[];
  }
  const versions=names.map(name=>{const a=source.getAttribute(name);return a instanceof THREE.InterleavedBufferAttribute?a.data.version:a.version;});
  const sourceChanged=versions.some((version,i)=>version!==state.versions[i]);if(sourceChanged)state.versions=versions;
  const actor=fxActorCache(source,clock),to=source.getAttribute('aTo'),slots=geometry.getAttribute('fxSlot') as THREE.InstancedBufferAttribute;
  let count=0,dirty=false,minimumScale=1;
  for(let row=0;row<actors;row++){
    const amount=fire.getX(row),amountChanged=state.amounts[row]!==amount;
    if(amountChanged){state.amounts[row]=amount;state.cache.invalidate(row);}if(amount<=0)continue;
    const scale=source.hasAttribute('aScale')?source.getAttribute('aScale').getX(row):1;
    minimumScale=Math.min(minimumScale,scale);
    // Actor cache owns the displayed pose. No delayed actor/World references.
    const bake=()=>{
      const pose=fxActorPose(source,clock,row),time=actor?.cpuClock(row,'travelTime')??clock.travelTime.value;
      const carried=source.hasAttribute('aMotion')&&source.getAttribute('aMotion').getZ(row)===6;
      state.cache.set(row,1,carried?Math.sin(pose.yaw)*.3*PAWN_MODEL_SCALE:0,carried?.95+.19*PAWN_MODEL_SCALE:0,carried?Math.cos(pose.yaw)*.3*PAWN_MODEL_SCALE:0);
      state.cache.set(row,2,Math.sin(time*8+pose.x)*.15+1,fire.getX(row)*state.scale*scale);
    };
    const level=actor?state.cache.sampleLinked(row,(actor.get(row,1,2)||0) as 0|1|2,actor.cpuPublication(row),bake):state.cache.sample(row,to.getX(row),to.getY(row),to.getZ(row),bake,scale);
    if(level===2)continue;
    if(sourceChanged||amountChanged||state.drawn[count]!==row){
      for(const name of names){const input=source.getAttribute(name),output=geometry.getAttribute(name) as THREE.InstancedBufferAttribute;for(let c=0;c<input.itemSize;c++)output.setComponent(count,c,input.getComponent(row,c));}
      slots.setX(count,row);state.drawn[count]=row;dirty=true;
    }count++;
  }
  state.drawn.length=count;if(dirty){for(const name of names)(geometry.getAttribute(name) as THREE.InstancedBufferAttribute).needsUpdate=true;slots.needsUpdate=true;}
  state.cache.minimumScale.value=minimumScale;geometry.instanceCount=count;mesh.visible=count>0;state.cache.flush();
}
