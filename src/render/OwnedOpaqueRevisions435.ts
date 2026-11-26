import {BufferAttribute,BufferGeometry,Camera,CustomBlending,LightShadow,MaterialReferenceNode,Mesh,Node,NodeMaterial,NodeMaterialObserver,Object3D,OrthographicCamera,PerspectiveCamera,ReferenceNode,RenderObjectRefreshType,REVISION,Scene,Texture,type NodeBuilder,type Renderer} from 'three/webgpu';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import {compatibleOwnedOpaqueCompiled435} from './OwnedOpaqueCompiled435';
import {createSourceOwnedRenderHook435,isSourceOwnedRenderHook435} from './SourceOwnedRenderHooks435';
import {ownedMaterialResources435,type OwnedMaterialResources435} from './OwnedMaterialResources435';
import {SourceCommandBundles,type SourceSharedCommandPlan} from './SourceCommandBundles';
import {canPrepareSourceCommands435,ownedSpatialCommands435,selectedSourceDraw435} from './source-command-capability';
import type {World} from '../sim/types';
import type {CorePhaseAnchor297} from '../bridge/core-phase-projection-297';

/** Only the private authentic Full caller supplies the closed-input proof.
 * A repeated or advancing revision of the same map does not replace global
 * shader/resource generations. Actual producer writes and resource versions
 * still revoke their native receipts. Any public/rewound/reset map does not
 * carry this continuity proof. */
export function canRetainOpaqueWorld435(before:World|null|undefined,next:World,previous:CorePhaseAnchor297|undefined,current:CorePhaseAnchor297|undefined,closed:boolean,reset:boolean):boolean{
 return closed&&!reset&&!!before&&!!previous&&!!current&&previous.epoch===current.epoch&&previous.mapId===current.mapId&&current.revision>=previous.revision&&next.tick>=before.tick&&
  before.seed===next.seed&&before.width===next.width&&before.height===next.height&&before.scenario?.id===next.scenario?.id&&before.scenario?.revision===next.scenario?.revision&&before.site?.hilliness===next.site?.hilliness&&before.site?.revision===next.site?.revision&&before.site?.biome===next.site?.biome;
}

type Dictionary435=Record<string,unknown>;
const record435=(value:unknown):value is Dictionary435=>typeof value==='object'&&value!==null;
const identity435=(e:readonly number[])=>e[0]===1&&e[1]===0&&e[2]===0&&e[3]===0&&e[4]===0&&e[5]===1&&e[6]===0&&e[7]===0&&e[8]===0&&e[9]===0&&e[10]===1&&e[11]===0&&e[12]===0&&e[13]===0&&e[14]===0&&e[15]===1;
interface Draw435 {object:Mesh;material:NodeMaterial;geometry:BufferGeometry;scene:Scene;camera:Camera;_nodeBuilderState:object;_bindings:unknown}
const draw435=(value:unknown):value is Draw435=>record435(value)&&value.object instanceof Mesh&&value.material instanceof NodeMaterial&&value.geometry instanceof BufferGeometry&&value.scene instanceof Scene&&value.camera instanceof Camera&&record435(value._nodeBuilderState);
interface Material435 {native:NodeMaterial['setupObserver'];installed:NodeMaterial['setupObserver'];before:PropertyDescriptor|undefined;commandVersion:number}
interface Entry435 {revision:number;resources:number;geometry:BufferGeometry|undefined;state:object|undefined;material:NodeMaterial|undefined;bindings:unknown;pending:Pending435|undefined}
interface Pending435 {entry:Entry435;draw:Draw435;revision:number;resources:number;geometry:BufferGeometry;state:object;material:NodeMaterial;scene:Scene;camera:Camera;retryResource?:true}
type Family435='box'|'timber'|'static-page';
interface Negative435 {state:object;geometry:BufferGeometry;material:NodeMaterial;version:number;resources:number;camera:Camera}
interface Mesh435 {family:Family435;allowedBefore:Mesh['onBeforeRender'];revision:number;commandRevision:number;materials:Set<NodeMaterial>;after:Mesh['onAfterRender'];before:PropertyDescriptor|undefined;pending:Pending435[];valid:boolean;preflight?:number;commandGeometry?:BufferGeometry;commandMaterial?:Mesh['material'];commandMaterialVersion?:number;commandShadow?:boolean;commandEligible?:boolean;negative?:Negative435}
interface Resource435 {value:Texture|BufferAttribute;version:number;source:unknown;sourceVersion:number;generation:unknown;listener:(()=>void)|undefined}
type Compatibility435=ReturnType<typeof compatibleOwnedOpaqueCompiled435>;
const nativeRefresh435:unknown=Reflect.get(NodeMaterialObserver.prototype,'needsRefresh');

/** Producer journals for two explicitly constructed families. No shader,
 * native hasNode flag, equals cache, material reference or renderer pipeline is
 * changed. Every clean MAIN draw still executes native SHARED node updates.
 * Shadows, room scenes and all unregistered/public objects remain native. */
export class OwnedOpaqueRevisions435 {
  private readonly meshes=new Map<Mesh,Mesh435>();
  private readonly materials=new Map<NodeMaterial,Material435>();
  private readonly resources=new Map<Texture|BufferAttribute,Resource435>();
  private readonly fixedResources=new Set<Texture|BufferAttribute>();
  /** The shared paint transaction publishes its actual resident Texture
   * objects here, including arrays sampled by Source material graphs. */
  private readonly sharedSurfaceTextures=new Set<Texture>();
  private readonly sharedSurfaceStorage=new Set<BufferAttribute>();
  private readonly shadowResources=new Set<Texture>();
  private readonly textures=new Set<Texture>();
  private readonly storage=new Set<BufferAttribute>();
  private readonly objectUniforms=new Set<Node>();
  private readonly fixedObjectUniforms=new Set<Node>();
  private readonly entries=new WeakMap<object,Entry435>();
  private readonly draws=new WeakMap<object,Draw435|false>();
  private readonly plans=new WeakMap<object,WeakMap<NodeMaterial,{epoch:number;result:Compatibility435}>>();
  private readonly liveCommandPlans=new WeakMap<object,WeakMap<NodeMaterial,{epoch:number;result:Compatibility435}>>();
  private readonly producers=new Map<Family435,OwnedOpaqueProducer435>();
  private readonly materialResources=new Map<NodeMaterial,{resources:OwnedMaterialResources435;release:()=>void}>();
  private readonly arrayTextures=new Set<Texture>();
  private readonly sharedGroups=new Set<import('three/webgpu').UniformGroupNode>();
  private renderer:Renderer|undefined;
  private drawCommands:SourceCommandBundles|undefined;
  private commandEpoch=0;
  private commandSerial=0;
  private readonly commandPlans=new WeakMap<object,{state:object;bindings:unknown;live:boolean;plan:SourceSharedCommandPlan}>();
  private readonly hookedObservers=new WeakMap<NodeMaterialObserver,{native:unknown;installed:unknown}>();
  private readonly commandRejects:Record<string,number>={};
  private readonly commandSamples:Record<string,unknown>={};
  private scene:Scene|undefined;
  private camera:Camera|undefined;
  private backend:object|undefined;
  private device:unknown;
  private enabled=false;
  private disposed=false;
  private resourceEpoch=0;
  private shadow:LightShadow|undefined;
  private shadowMap:unknown;
  private shadowTarget:LightShadow['map']|undefined;
  private readonly shadowDisposed=()=>this.invalidateResources();
  private shadowWidth=-1;
  private shadowHeight=-1;
  private preflightReady=false;
  private readonly checkedIdentity435=new Map<Object3D,boolean>();
  private readonly counts={full:0,shared:0,native:0,retries:0,commits:0,registrations:0,forgotten:0,dirty:0,resourceInvalidations:0,resourceReads:0,retainedWorlds:0,compilations:0,acceptedPlans:0,rejectedPlans:0,preflights:0,visiblePreflights:0,identityReads:0,commandNativeReceipts:0,commandLivePlans:0,negativePreflights:0,resourceFullRetries:0,resourceFullRecoveries:0};
  private readonly reasons:Record<string,number>={};

  producer(family:Family435):OwnedOpaqueProducer435 {
    let producer=this.producers.get(family);if(producer)return producer;
    producer={register:(mesh,materials,resources,options)=>this.register(mesh,materials,resources??[],family,options),dirty:mesh=>{const row=this.meshes.get(mesh);if(row){row.revision++;row.commandRevision=++this.commandSerial;this.counts.dirty++;}},forget:mesh=>this.forget(mesh)};
    this.producers.set(family,producer);return producer;
  }
  attach(renderer:Renderer,scene:Scene,objectUniforms:readonly Node[],resources:readonly Texture[]):void {
    if(this.renderer&&this.renderer!==renderer)throw Error('Owned opaque renderer cannot be replaced');
    this.renderer=renderer;this.scene=scene;
    const nodes:unknown=Reflect.get(renderer,'_nodes');
    if(!this.drawCommands&&Reflect.get(renderer.backend,'isWebGPUBackend')===true&&record435(nodes)&&typeof nodes.getNodeFrameForRender==='function')this.drawCommands=new SourceCommandBundles(renderer,scene,{epoch:()=>this.commandEpoch,serial:()=>this.commandSerial,revision:mesh=>this.meshes.get(mesh)?.commandRevision??-1,accepts:(mesh,material)=>{
      const row=this.meshes.get(mesh);
      return this.enabled&&this.preflightReady&&row!==undefined&&this.checkVisibleMesh435(mesh,row).commandEligible===true&&row.commandMaterial===material&&canPrepareSourceCommands435(mesh,mesh.geometry);
    },certify:draw=>this.certifyCommand(draw),complete:draw=>{if(draw435(draw))this.finish(draw.object,draw.scene,draw.camera,draw.material);}});
    for(const node of objectUniforms){this.fixedObjectUniforms.add(node);this.objectUniforms.add(node);}
    for(const resource of resources){this.fixedResources.add(resource);this.addResource(resource);}
    this.invalidateResources();
  }
  invalidateResources():void {this.resourceEpoch++;this.commandEpoch++;this.commandSerial++;this.counts.resourceInvalidations++;}
  adoptWorldContinuity435(retain:boolean):void{if(retain)this.counts.retainedWorlds++;else this.invalidateResources();}
  publishSharedSurfaceTextures(textures:readonly Texture[]):void {
    if(textures.length===this.sharedSurfaceTextures.size&&textures.every(value=>this.sharedSurfaceTextures.has(value)))return;
    this.sharedSurfaceTextures.clear();for(const value of textures)this.sharedSurfaceTextures.add(value);this.synchronizeMaterialResources();
  }
  publishSharedSurfaceStorage(storage:readonly BufferAttribute[]):void {
    if(storage.length===this.sharedSurfaceStorage.size&&storage.every(value=>this.sharedSurfaceStorage.has(value)))return;
    this.sharedSurfaceStorage.clear();for(const value of storage)this.sharedSurfaceStorage.add(value);this.synchronizeMaterialResources();
  }
  setEnabled(enabled:boolean):void {if(this.enabled!==enabled){this.enabled=enabled;this.invalidateResources();}if(!enabled)this.preflightReady=false;}
  metrics(){return{enabled:this.enabled,meshes:this.meshes.size,materials:this.materials.size,resources:this.resources.size,resourceEpoch:this.resourceEpoch,plans:this.counts.acceptedPlans,...this.counts,reasons:{...this.reasons},commandDiagnostics:{rejects:{...this.commandRejects},samples:{...this.commandSamples}},drawCommands:this.drawCommands?.metrics()};}
  private reason(reason:string):void {this.reasons[reason]=(this.reasons[reason]??0)+1;}

  private sampleCommand(reason:string,draw?:Draw435,compiledDetail?:string):void {
    if(draw&&this.commandSamples[reason]===undefined&&Object.keys(this.commandSamples).length<8){
      const state=draw._nodeBuilderState as {updateNodes?:Node[];bindings?:unknown[]},monitor:unknown=Reflect.get(draw,'_monitor'),uniforms:unknown[]=[];
      for(const group of state.bindings??[])if(record435(group)&&Array.isArray(group.bindings))for(const binding of group.bindings)if(record435(binding)&&Array.isArray(binding.uniforms))for(const uniform of binding.uniforms){const descriptor=record435(uniform)&&record435(uniform.nodeUniform)?uniform.nodeUniform:undefined,node=descriptor?.node;if(node instanceof Node){const value:unknown=Reflect.get(node,'value');uniforms.push({name:record435(uniform)?uniform.name:undefined,nativeName:descriptor?.name,nodeName:Reflect.get(node,'name'),type:Reflect.get(node.constructor,'type')??node.constructor.name,update:node.updateType,group:Reflect.get(Reflect.get(node,'groupNode')??{},'name'),declared:this.objectUniforms.has(node),valueType:record435(value)&&typeof value.constructor==='function'?value.constructor.name:typeof value,value:typeof value==='number'||typeof value==='boolean'?value:undefined});}}
      const resources:unknown[]=[];
      for(const group of state.bindings??[])if(record435(group)&&Array.isArray(group.bindings))for(const binding of group.bindings)if(record435(binding)){
        const node=record435(binding.textureNode)?binding.textureNode:undefined,value=node?.value;
        if(value instanceof Texture)resources.push({binding:binding.name,texture:value.name,type:value.type,array:Reflect.get(value,'isDataArrayTexture'),declared:this.textures.has(value),declaredArray:this.arrayTextures.has(value)});
        if(binding.attribute instanceof BufferAttribute)resources.push({binding:binding.name,storage:true,declared:this.storage.has(binding.attribute),count:binding.attribute.count});
      }
      this.commandSamples[reason]={mesh:draw.object.name,material:draw.material.type,nativeMonitor:monitor instanceof NodeMaterialObserver,pristineMonitor:monitor instanceof NodeMaterialObserver&&Reflect.get(monitor,'needsRefresh')===nativeRefresh435,hasNode:record435(monitor)?monitor.hasNode:undefined,entry:this.entries.has(draw),compiledDetail,uniforms,resources,updates:state.updateNodes?.map(node=>({type:Reflect.get(node.constructor,'type')??node.constructor.name,update:node.updateType,scope:Reflect.get(node,'scope'),group:Reflect.get(Reflect.get(node,'groupNode')??{},'name')}))};
    }
  }
  private rejectCommand(reason:string,draw?:Draw435,compiledDetail?:string):undefined {
    this.commandRejects[reason]=(this.commandRejects[reason]??0)+1;this.sampleCommand(reason,draw,compiledDetail);
    return undefined;
  }
  private compatibility(ro:Draw435,row:Mesh435,live=false,recheck=false):Compatibility435 {
    const cache=live?this.liveCommandPlans:this.plans;
    let plans=cache.get(ro._nodeBuilderState);if(!plans){plans=new WeakMap();cache.set(ro._nodeBuilderState,plans);}
    let plan=plans.get(ro.material);
    if(!plan||plan.epoch!==this.resourceEpoch||recheck){
      const result=compatibleOwnedOpaqueCompiled435(ro._nodeBuilderState,{materials:[...row.materials],textures:this.textures,storage:this.storage,objectUniforms:this.objectUniforms,arrayTextures:this.arrayTextures,sharedGroups:this.sharedGroups,renderer:this.renderer,liveObjectUniforms:live});
      plan={epoch:this.resourceEpoch,result};plans.set(ro.material,plan);this.counts.compilations++;if(live){if(result.accepted)this.counts.commandLivePlans++;}else this.counts[result.accepted?'acceptedPlans':'rejectedPlans']++;
    }
    return plan.result;
  }
  private commandCompatibility(ro:Draw435,row:Mesh435,recheck=false):Compatibility435 {
    const frozen=this.compatibility(ro,row,false,recheck);
    return frozen.accepted?frozen:frozen.reason==='object-uniform-not-declared'?this.compatibility(ro,row,true,recheck):frozen;
  }
  /** A known rejected native program does not need an ancestry/transform
   * census every RAF merely to keep using Three's unconditional native path.
   * Rejection grants no authority: a new actual NodeBuilderState reopens
   * admission on the *following* preflight and the present draw stays native.
   */
  private rememberNegative(row:Mesh435,ro:Draw435):void{
    const old=row.negative;
    if(old?.state===ro._nodeBuilderState&&old.resources===this.resourceEpoch&&old.geometry===ro.geometry&&old.material===ro.material&&old.version===ro.material.version&&old.camera===ro.camera)return;
    row.negative={state:ro._nodeBuilderState,geometry:ro.geometry,material:ro.material,version:ro.material.version,resources:this.resourceEpoch,camera:ro.camera};
  }
  private hookObserver(observer:NodeMaterialObserver):void {
    if(this.hookedObservers.has(observer))return;
    const refresh:unknown=Reflect.get(observer,'needsRefresh');if(REVISION!=='186'||Object.getPrototypeOf(observer)!==NodeMaterialObserver.prototype||typeof refresh!=='function')return;
    const owner=this,installed=function(ro:unknown,frame:unknown){return owner.decide(ro,frame,observer,refresh);};Object.defineProperty(observer,'needsRefresh',{configurable:true,writable:true,value:installed});this.hookedObservers.set(observer,{native:refresh,installed});
  }

  /** A completed native FULL draw, approved by the actual compiled-state
   * checker, certifies the fixed object outputs. Stable replay keeps only the
   * native frame/render writers and shared uniform buffers. No shader graph
   * or resource is discovered from the per-frame command path. */
  private certifyCommand(value:unknown):SourceSharedCommandPlan|undefined {
    if(!this.enabled||!this.preflightReady)return this.rejectCommand('inactive');
    if(!draw435(value))return this.rejectCommand('native-draw-shape');
    if(!selectedSourceDraw435(value.object,value.geometry))return this.rejectCommand('indirect',value);
    if(value.scene!==this.scene||value.camera!==this.camera||Reflect.get(value,'bundle')!==null||this.renderer?.getMRT()!==null)return this.rejectCommand('render-scope',value);
    const row=this.meshes.get(value.object);if(!row||!this.checkVisibleMesh435(value.object,row).valid)return this.rejectCommand('source-ownership',value);
    const compatible=this.commandCompatibility(value,row);
    if(!compatible.accepted){this.rememberNegative(row,value);return this.rejectCommand('program:'+compatible.reason,value,compatible.detail);}
    const live=!!compatible.liveObjectUniforms;
    let entry=this.entries.get(value);
    // Native NodeBuilderState/observer can predate late producer registration.
    // r186's pristine hasNode observer unconditionally returns FULL. A captured
    // completed draw therefore provides the missing real FULL receipt; attach
    // to that actual observer rather than assuming setupObserver ran again.
    const monitor:unknown=Reflect.get(value,'_monitor');
    if(live){
      // Strict observer ownership rejected this program, so its actual native
      // hasNode monitor just performed FULL. Commands retain no object values:
      // every original node writer and physical object UBO remains live.
      if(!(monitor instanceof NodeMaterialObserver)||Object.getPrototypeOf(monitor)!==NodeMaterialObserver.prototype||monitor.hasNode!==true)return this.rejectCommand('live-input-native-monitor',value);
      const refresh:unknown=Reflect.get(monitor,'needsRefresh'),hook=this.hookedObservers.get(monitor);
      if(refresh!==nativeRefresh435&&!(hook&&hook.native===nativeRefresh435&&hook.installed===refresh))return this.rejectCommand('live-input-native-monitor',value);
      this.hookObserver(monitor);this.sampleCommand('live-object-inputs',value);
    }
    if(!live&&!entry&&monitor instanceof NodeMaterialObserver&&Object.getPrototypeOf(monitor)===NodeMaterialObserver.prototype&&Reflect.get(monitor,'needsRefresh')===nativeRefresh435&&monitor.hasNode===true){
      entry={revision:row.revision,resources:this.resourceEpoch,geometry:value.geometry,state:value._nodeBuilderState,material:value.material,bindings:value._bindings,pending:undefined};this.entries.set(value,entry);this.hookObserver(monitor);this.counts.commandNativeReceipts++;
    }
    if(!live){
      if(!entry)return this.rejectCommand('missing-full-receipt',value);
      if(entry.pending)return this.rejectCommand('pending-full-receipt',value);
      if(entry.revision!==row.revision)return this.rejectCommand('producer-revision',value);
      if(entry.resources!==this.resourceEpoch)return this.rejectCommand('resource-epoch',value);
      if(entry.geometry!==value.geometry||entry.state!==value._nodeBuilderState||entry.material!==value.material||entry.bindings!==value._bindings)return this.rejectCommand('native-layout-or-bindings',value);
    }
    if(value.object.geometry!==value.geometry||value.object.material!==value.material||!Array.isArray(value._bindings))return this.rejectCommand('changed-source-layout',value);
    const previous=this.commandPlans.get(value);if(previous?.state===value._nodeBuilderState&&previous.bindings===value._bindings&&previous.live===live)return previous.plan;
    if(live)this.counts.commandNativeReceipts++;
    const state=value._nodeBuilderState as {updateNodes:Node[];updateBeforeNodes:Node[]};
    const bindings:unknown[]=[];for(const group of value._bindings)if(record435(group)&&Array.isArray(group.bindings))for(const binding of group.bindings)if(record435(binding)&&(binding.isNodeUniformsGroup===true||binding.isNodeUniformBuffer===true)&&record435(binding.groupNode)&&(live||binding.groupNode.shared===true))bindings.push(binding);
    const plan={before:state.updateBeforeNodes,shared:live?state.updateNodes:state.updateNodes.filter(node=>node.updateType==='frame'||node.updateType==='render'||node instanceof ReferenceNode&&!(node instanceof MaterialReferenceNode)),bindings,liveObjectInputs:live} as SourceSharedCommandPlan;
    this.commandPlans.set(value,{state:value._nodeBuilderState,bindings:value._bindings,live,plan});return plan;
  }

  private addResource(value:Texture|BufferAttribute):void {
    if(this.resources.has(value))return;
    const listener=value instanceof Texture?()=>this.invalidateResources():undefined;
    if(listener&&value instanceof Texture)value.addEventListener('dispose',listener);
    if(value instanceof Texture)this.textures.add(value);else this.storage.add(value);
    this.resources.set(value,{value,version:-1,source:undefined,sourceVersion:-1,generation:undefined,listener});
    this.invalidateResources();
  }
  /** Only constructor/publication/disposal writers call this. Stable draws never discover resources. */
  private synchronizeMaterialResources():void{
    const retained=new Set<Texture|BufferAttribute>([...this.fixedResources,...this.shadowResources,...this.sharedSurfaceTextures,...this.sharedSurfaceStorage]);this.arrayTextures.clear();this.sharedGroups.clear();this.objectUniforms.clear();for(const node of this.fixedObjectUniforms)this.objectUniforms.add(node);
    for(const texture of this.sharedSurfaceTextures)if(Reflect.get(texture,'isDataArrayTexture')===true||Reflect.get(texture,'isArrayTexture')===true)this.arrayTextures.add(texture);
    for(const {resources}of this.materialResources.values()){for(const node of resources.objectUniforms)this.objectUniforms.add(node);for(const value of resources.textures)retained.add(value);for(const value of resources.storage)retained.add(value);for(const value of resources.arrayTextures)this.arrayTextures.add(value);for(const group of resources.sharedGroups)this.sharedGroups.add(group);}
    for(const[value,row]of this.resources)if(!retained.has(value)){if(row.listener&&value instanceof Texture)value.removeEventListener('dispose',row.listener);this.resources.delete(value);this.textures.delete(value as Texture);this.storage.delete(value as BufferAttribute);}
    for(const value of retained)this.addResource(value);this.invalidateResources();
  }
  /** Once per world render, before any ShadowNode.updateBefore. Only the
   * shared resources are examined here, not the off-camera producer roster.
   * The native shadow texture may be allocated/recreated later in updateBefore:
   * its dispose listener dirties the epoch, preventing retroactive acceptance. */
  preflight(camera:Camera,shadow:LightShadow):void {
    this.preflightReady=false;this.checkedIdentity435.clear();if(this.disposed||!this.enabled||!this.renderer||!this.scene)return;
    this.counts.preflights++;if(this.camera!==camera){this.commandEpoch++;this.commandSerial++;}this.camera=camera;
    if(!(camera instanceof PerspectiveCamera||camera instanceof OrthographicCamera)||this.renderer.highPrecision){this.reason('unsupported-camera-or-high-precision');return;}
    const backend=this.renderer.backend,device:unknown=Reflect.get(backend,'device');
    if(Reflect.get(backend,'isWebGPUBackend')!==true){this.reason('unsupported-backend');return;}
    if(this.backend!==backend||this.device!==device){this.backend=backend;this.device=device;this.invalidateResources();}
    if(this.shadow!==shadow||this.shadowMap!==shadow.map||this.shadowWidth!==shadow.mapSize.x||this.shadowHeight!==shadow.mapSize.y){
      this.shadow=shadow;this.shadowMap=shadow.map;this.shadowWidth=shadow.mapSize.x;this.shadowHeight=shadow.mapSize.y;this.invalidateResources();
    }
    if(this.shadowTarget!==shadow.map){
      this.shadowTarget?.removeEventListener('dispose',this.shadowDisposed);
      for(const texture of this.shadowResources)if(!this.fixedResources.has(texture)){const old=this.resources.get(texture);if(old?.listener)texture.removeEventListener('dispose',old.listener);this.resources.delete(texture);this.textures.delete(texture);}
      this.shadowResources.clear();this.shadowTarget=shadow.map;this.shadowTarget?.addEventListener('dispose',this.shadowDisposed);
    }
    if(shadow.map){this.shadowResources.add(shadow.map.texture);this.addResource(shadow.map.texture);if(shadow.map.depthTexture){this.shadowResources.add(shadow.map.depthTexture);this.addResource(shadow.map.depthTexture);}}
    const target=shadow.map,depthImage:unknown=target?.depthTexture?.image;
    // Map creation/resizing can be delayed by shadow.needsUpdate=false. Until
    // native updateBefore actually makes BOTH target and depth image valid,
    // every world-render preflight must force a new FULL epoch. Remembering
    // only the requested size would incorrectly ACK the still-old texture.
    if(!target||target.width!==shadow.mapSize.x||target.height!==shadow.mapSize.y||!record435(depthImage)||depthImage.width!==shadow.mapSize.x||depthImage.height!==shadow.mapSize.y){this.invalidateResources();this.reason('full:shadow-not-ready');}
    const textureOwner:unknown=Reflect.get(this.renderer,'_textures'),textureCache=record435(textureOwner)&&textureOwner.data instanceof WeakMap?textureOwner.data:undefined;
    for(const row of this.resources.values()){
      const value=row.value,source=value instanceof Texture?value.source:undefined,sourceVersion=value instanceof Texture?value.source.version:0;
      const cache=textureCache?.get(value);
      const generation=record435(cache)?cache.generation:undefined;this.counts.resourceReads+=4;
      if(row.version!==value.version||row.source!==source||row.sourceVersion!==sourceVersion||row.generation!==generation){row.version=value.version;row.source=source;row.sourceVersion=sourceVersion;row.generation=generation;this.invalidateResources();}
    }
    for(const[material,row]of this.materials)if(row.commandVersion!==material.version){row.commandVersion=material.version;this.commandSerial++;}
    this.preflightReady=true;
  }
  private checkIdentity435(object:Object3D):boolean{
    const old=this.checkedIdentity435.get(object);if(old!==undefined)return old;this.counts.identityReads+=42;
    const p=object.position,q=object.quaternion,s=object.scale;
    const valid=p.x===0&&p.y===0&&p.z===0&&q.x===0&&q.y===0&&q.z===0&&q.w===1&&s.x===1&&s.y===1&&s.z===1&&identity435(object.matrix.elements)&&identity435(object.matrixWorld.elements)&&(!object.parent||this.checkIdentity435(object.parent));
    this.checkedIdentity435.set(object,valid);return valid;
  }
  /** Three's actual culled/sorted MAIN list asks on demand. The observer and
   * native receipt take exactly this same gate for single/fallback objects.
   * Only one check per visible owner per render, with shared ancestors reused;
   * no visibility approximation or producer's own frustum test is added. */
  private checkVisibleMesh435(mesh:Mesh,row:Mesh435):Mesh435{
      if(row.preflight===this.counts.preflights)return row;
      row.preflight=this.counts.preflights;this.counts.visiblePreflights++;
      const material=mesh.material;
      // Foreign indirect geometry and non-admitted callbacks cannot take
      // either shortcut. Only the same private producer's immutable spatial
      // command table can use the indirect lane.
      const rejected=row.negative&&row.negative.resources===this.resourceEpoch&&row.negative.geometry===mesh.geometry&&row.negative.material===material&&row.negative.version===row.negative.material.version&&row.negative.camera===this.camera;
      if(rejected)this.counts.negativePreflights++;else row.negative=undefined;
      const supported=!rejected&&canPrepareSourceCommands435(mesh,mesh.geometry)&&material instanceof NodeMaterial&&row.materials.has(material);
      const valid=supported&&mesh.onAfterRender===row.after&&this.validSpatialCallbacks435(mesh,row.allowedBefore,row.family)&&this.checkIdentity435(mesh);
      const eligible=valid&&material instanceof NodeMaterial&&!material.transparent&&material.opacity===1&&!material.stencilWrite&&material.blending!==CustomBlending&&!mesh.occlusionTest&&Reflect.get(mesh,'isBatchedMesh')!==true&&Reflect.get(mesh,'isSkinnedMesh')!==true;
      const version=material instanceof NodeMaterial?material.version:undefined;
      if(valid!==row.valid||row.commandGeometry!==mesh.geometry||row.commandMaterial!==material||row.commandMaterialVersion!==version||row.commandShadow!==mesh.receiveShadow||row.commandEligible!==eligible)row.commandRevision=++this.commandSerial;
      row.valid=valid;row.commandGeometry=mesh.geometry;row.commandMaterial=material;row.commandMaterialVersion=version;row.commandShadow=mesh.receiveShadow;row.commandEligible=eligible;
      return row;
  }
  private validSpatialCallbacks435(mesh:Mesh,before:Mesh['onBeforeRender'],family:Family435):boolean{
    const spatial=ownedSpatialCommands435(mesh,mesh.geometry);
    if(spatial)return spatial.producer===this.producers.get(family)&&spatial.originalBefore===before&&spatial.originalShadow===Object3D.prototype.onBeforeShadow&&spatial.originalAfterShadow===Object3D.prototype.onAfterShadow;
    return mesh.onBeforeRender===before&&mesh.onBeforeShadow===Object3D.prototype.onBeforeShadow&&mesh.onAfterShadow===Object3D.prototype.onAfterShadow;
  }

  private register(mesh:Mesh,materials:readonly NodeMaterial[],resources:readonly(Texture|BufferAttribute)[],family:Family435,options?:{readonly beforeRender:Mesh['onBeforeRender']}):void {
    if(this.disposed||this.meshes.has(mesh))return;
    if(!materials.length||materials.some(material=>material.transparent||material.setupObserver!==NodeMaterial.prototype.setupObserver&&!this.materials.has(material)))return;
    const originalBefore=ownedSpatialCommands435(mesh,mesh.geometry)?.originalBefore??mesh.onBeforeRender;
    const allowedBefore=family==='static-page'&&options?.beforeRender===mesh.onBeforeRender&&isSourceOwnedRenderHook435(originalBefore)?originalBefore:Object3D.prototype.onBeforeRender;
    if(family==='static-page'&&materials.some(material=>!ownedMaterialResources435(material)))return;
    if(!this.validSpatialCallbacks435(mesh,allowedBefore,family)||mesh.onAfterRender!==Object3D.prototype.onAfterRender)return;
    for(const resource of resources){this.fixedResources.add(resource);this.addResource(resource);}
    for(const material of materials)this.install(material);
    const owner=this,original=mesh.onAfterRender,before=Object.getOwnPropertyDescriptor(mesh,'onAfterRender');
    const callback:Mesh['onAfterRender']=function(this:Mesh,renderer,scene,camera,geometry,material,group){original.call(this,renderer,scene,camera,geometry,material,group);owner.finish(this,scene,camera,material);};
    const after=createSourceOwnedRenderHook435(callback);
    this.meshes.set(mesh,{family,allowedBefore,revision:1,commandRevision:++this.commandSerial,materials:new Set(materials),after,before,pending:[],valid:false});mesh.onAfterRender=after;this.counts.registrations++;
  }
  private install(material:NodeMaterial):void {
    if(this.materials.has(material))return;
    const resources=ownedMaterialResources435(material);if(resources){const release=resources.subscribe(()=>this.synchronizeMaterialResources());this.materialResources.set(material,{resources,release});this.synchronizeMaterialResources();}
    const owner=this,native=material.setupObserver,before=Object.getOwnPropertyDescriptor(material,'setupObserver');
    const installed:NodeMaterial['setupObserver']=function(this:NodeMaterial,builder:NodeBuilder){
      const observer=native.call(this,builder);owner.hookObserver(observer);return observer;
    };
    this.materials.set(material,{native,installed,before,commandVersion:material.version});material.setupObserver=installed;
  }
  private fallback(value:unknown,frame:unknown,observer:NodeMaterialObserver,native:Function,reason:string):unknown {
    if(record435(value)){const entry=this.entries.get(value);if(entry){entry.resources=-1;
      // An earlier incomplete FULL is not a receipt for this different call,
      // including a cached-negative retry that skipped the ownership proof.
      if(entry.pending){const row=this.meshes.get(entry.pending.draw.object),at=row?.pending.indexOf(entry.pending)??-1;if(row&&at>=0)row.pending.splice(at,1);entry.pending=undefined;this.counts.retries++;}
    }}this.counts.native++;this.reason(reason);return native.call(observer,value,frame);
  }
  /** A shared native material-map reference can still hold the previous
   * object's texture BEFORE this renderObject's actual FULL writers run.
   * Rejection grants no plan. Remember only an observed native FULL;
   * onAfterRender must complete this exact draw before trying the same strict
   * compiled-state checker with its actual fresh inputs. */
  private retryResourceFull435(row:Mesh435,draw:Draw435):void{
    let entry=this.entries.get(draw);if(!entry){entry={revision:-1,resources:-1,geometry:undefined,state:undefined,material:undefined,bindings:undefined,pending:undefined};this.entries.set(draw,entry);}
    if(entry.pending){const at=row.pending.indexOf(entry.pending);if(at>=0)row.pending.splice(at,1);this.counts.retries++;}
    const pending:Pending435={entry,draw,revision:row.revision,resources:this.resourceEpoch,geometry:draw.geometry,state:draw._nodeBuilderState,material:draw.material,scene:draw.scene,camera:draw.camera,retryResource:true};
    entry.pending=pending;entry.resources=-1;row.pending.push(pending);this.counts.resourceFullRetries++;
  }
  private decide(value:unknown,frame:unknown,observer:NodeMaterialObserver,native:Function):unknown {
    if(this.disposed||!this.enabled||!this.preflightReady)return this.fallback(value,frame,observer,native,'inactive');
    if(!record435(value))return this.fallback(value,frame,observer,native,'not-render-object');
    let ro=this.draws.get(value);if(ro===undefined){ro=draw435(value)?value:false;this.draws.set(value,ro);}
    if(!ro||!record435(frame)||frame.renderer!==this.renderer||ro.scene!==this.scene||ro.camera!==this.camera||frame.camera!==this.camera||ro.scene.overrideMaterial!==null)return this.fallback(value,frame,observer,native,'not-owned-main');
    const row=this.meshes.get(ro.object);if(row)this.checkVisibleMesh435(ro.object,row);
    if(row?.negative){if(row.negative.state!==ro._nodeBuilderState||row.negative.geometry!==ro.geometry||row.negative.material!==ro.material){row.negative=undefined;row.commandRevision=++this.commandSerial;}
      // A real native draw still performs FULL. No assumption that a prior
      // rejected state determines new shader/layout compatibility.
      else if(!row.valid)return this.fallback(value,frame,observer,native,'program:cached-negative');
    }
    if(!row||!row.valid||!row.materials.has(ro.material))return this.fallback(value,frame,observer,native,'ownership');
    if(ro.object.material!==ro.material||!selectedSourceDraw435(ro.object,ro.geometry)||Reflect.get(ro,'bundle')!==null||Reflect.get(ro.object,'isSkinnedMesh')===true||Reflect.get(ro.object,'isBatchedMesh')===true||this.renderer?.getMRT()!==null)return this.fallback(value,frame,observer,native,'unsupported-render-mode');
    const plan=this.compatibility(ro,row);if(!plan.accepted){const command=this.commandCompatibility(ro,row);if(!command.accepted)this.rememberNegative(row,ro);const refresh=this.fallback(value,frame,observer,native,'program:'+plan.reason);
      if(refresh===RenderObjectRefreshType.FULL&&command.reason==='resource-not-declared'&&['material-map-value','texture-writer-value','texture-binding-value'].includes(command.detail??''))this.retryResourceFull435(row,ro);
      return refresh;
    }
    let entry=this.entries.get(ro);if(!entry){entry={revision:-1,resources:-1,geometry:undefined,state:undefined,material:undefined,bindings:undefined,pending:undefined};this.entries.set(ro,entry);}
    if(entry.pending){const at=row.pending.indexOf(entry.pending);if(at>=0)row.pending.splice(at,1);entry.pending=undefined;entry.resources=-1;this.counts.retries++;}
    const full=entry.revision!==row.revision||entry.resources!==this.resourceEpoch||entry.geometry!==ro.geometry||entry.state!==ro._nodeBuilderState||entry.material!==ro.material||entry.bindings!==ro._bindings;
    if(!full){this.counts.shared++;return RenderObjectRefreshType.SHARED;}
    this.reason(entry.state===undefined?'full:initial':entry.geometry!==ro.geometry||entry.state!==ro._nodeBuilderState||entry.material!==ro.material||entry.bindings!==ro._bindings?'full:layout-or-binding':entry.revision!==row.revision?'full:producer':'full:resources-or-retry');
    const pending:Pending435={entry,draw:ro,revision:row.revision,resources:this.resourceEpoch,geometry:ro.geometry,state:ro._nodeBuilderState,material:ro.material,scene:ro.scene,camera:ro.camera};entry.pending=pending;row.pending.push(pending);this.counts.full++;return RenderObjectRefreshType.FULL;
  }
  private finish(mesh:Mesh,scene:Scene,camera:Camera,material:unknown):void {
    const row=this.meshes.get(mesh);if(!row)return;
    for(let i=row.pending.length-1;i>=0;i--){const pending=row.pending[i]!;if(pending.scene!==scene||pending.camera!==camera||pending.material!==material)continue;row.pending.splice(i,1);pending.entry.pending=undefined;
      if(this.disposed||!this.enabled||pending.revision!==row.revision||pending.resources!==this.resourceEpoch||mesh.geometry!==pending.geometry||mesh.material!==pending.material||pending.draw._nodeBuilderState!==pending.state){pending.entry.resources=-1;continue;}
      const entry=pending.entry;
      if(pending.retryResource){const recovered=this.commandCompatibility(pending.draw,row,true);if(!recovered.accepted){entry.resources=-1;this.rememberNegative(row,pending.draw);continue;}row.negative=undefined;row.commandRevision=++this.commandSerial;this.counts.resourceFullRecoveries++;}
      entry.revision=pending.revision;entry.resources=pending.resources;entry.geometry=pending.geometry;entry.state=pending.state;entry.material=pending.material;entry.bindings=pending.draw._bindings;this.counts.commits++;
    }
  }
  private forget(mesh:Mesh):void {
    const row=this.meshes.get(mesh);if(!row)return;
    if(mesh.onAfterRender===row.after){if(row.before)Object.defineProperty(mesh,'onAfterRender',row.before);else Reflect.deleteProperty(mesh,'onAfterRender');}
    for(const pending of row.pending){pending.entry.pending=undefined;pending.entry.resources=-1;}row.pending.length=0;this.meshes.delete(mesh);this.commandSerial++;this.counts.forgotten++;
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.enabled=false;this.preflightReady=false;
    this.drawCommands?.dispose();this.drawCommands=undefined;
    for(const mesh of this.meshes.keys())this.forget(mesh);
    for(const[material,row]of this.materials)if(material.setupObserver===row.installed){if(row.before)Object.defineProperty(material,'setupObserver',row.before);else Reflect.deleteProperty(material,'setupObserver');}
    for(const row of this.resources.values())if(row.listener&&row.value instanceof Texture)row.value.removeEventListener('dispose',row.listener);
    this.shadowTarget?.removeEventListener('dispose',this.shadowDisposed);this.shadowTarget=undefined;
    for(const row of this.materialResources.values())row.release();this.materialResources.clear();this.arrayTextures.clear();this.sharedGroups.clear();
    this.materials.clear();this.resources.clear();this.fixedResources.clear();this.sharedSurfaceTextures.clear();this.sharedSurfaceStorage.clear();this.shadowResources.clear();this.textures.clear();this.storage.clear();this.objectUniforms.clear();this.fixedObjectUniforms.clear();this.producers.clear();
    this.checkedIdentity435.clear();this.renderer=undefined;this.scene=undefined;this.camera=undefined;this.shadow=undefined;this.shadowMap=undefined;this.backend=undefined;this.device=undefined;
  }
}
