import {BufferAttribute,BufferGeometry,Camera,LightShadow,Mesh,Node,NodeMaterial,NodeMaterialObserver,Object3D,OrthographicCamera,PerspectiveCamera,RenderObjectRefreshType,REVISION,Scene,Texture,type NodeBuilder,type Renderer} from 'three/webgpu';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';
import {compatibleOwnedOpaqueCompiled435} from './OwnedOpaqueCompiled435';
import {createSourceOwnedRenderHook435,isSourceOwnedRenderHook435} from './SourceOwnedRenderHooks435';
import {ownedMaterialResources435,type OwnedMaterialResources435} from './OwnedMaterialResources435';

type Dictionary435=Record<string,unknown>;
const record435=(value:unknown):value is Dictionary435=>typeof value==='object'&&value!==null;
const identity435=(e:readonly number[])=>e[0]===1&&e[1]===0&&e[2]===0&&e[3]===0&&e[4]===0&&e[5]===1&&e[6]===0&&e[7]===0&&e[8]===0&&e[9]===0&&e[10]===1&&e[11]===0&&e[12]===0&&e[13]===0&&e[14]===0&&e[15]===1;
interface Draw435 {object:Mesh;material:NodeMaterial;geometry:BufferGeometry;scene:Scene;camera:Camera;_nodeBuilderState:object;_bindings:unknown}
const draw435=(value:unknown):value is Draw435=>record435(value)&&value.object instanceof Mesh&&value.material instanceof NodeMaterial&&value.geometry instanceof BufferGeometry&&value.scene instanceof Scene&&value.camera instanceof Camera&&record435(value._nodeBuilderState);
interface Material435 {native:NodeMaterial['setupObserver'];installed:NodeMaterial['setupObserver'];before:PropertyDescriptor|undefined}
interface Entry435 {revision:number;resources:number;geometry:BufferGeometry|undefined;state:object|undefined;material:NodeMaterial|undefined;bindings:unknown;pending:Pending435|undefined}
interface Pending435 {entry:Entry435;draw:Draw435;revision:number;resources:number;geometry:BufferGeometry;state:object;material:NodeMaterial;scene:Scene;camera:Camera}
type Family435='box'|'timber'|'static-page';
interface Mesh435 {family:Family435;allowedBefore:Mesh['onBeforeRender'];revision:number;materials:Set<NodeMaterial>;after:Mesh['onAfterRender'];before:PropertyDescriptor|undefined;pending:Pending435[];valid:boolean}
interface Resource435 {value:Texture|BufferAttribute;version:number;source:unknown;sourceVersion:number;generation:unknown;listener:(()=>void)|undefined}
type Compatibility435=ReturnType<typeof compatibleOwnedOpaqueCompiled435>;

/** Producer journals for two explicitly constructed families. No shader,
 * native hasNode flag, equals cache, material reference or renderer pipeline is
 * changed. Every clean MAIN draw still executes native SHARED node updates.
 * Shadows, room scenes and all unregistered/public objects remain native. */
export class OwnedOpaqueRevisions435 {
  private readonly meshes=new Map<Mesh,Mesh435>();
  private readonly materials=new Map<NodeMaterial,Material435>();
  private readonly resources=new Map<Texture|BufferAttribute,Resource435>();
  private readonly fixedResources=new Set<Texture|BufferAttribute>();
  private readonly shadowResources=new Set<Texture>();
  private readonly textures=new Set<Texture>();
  private readonly storage=new Set<BufferAttribute>();
  private readonly objectUniforms=new Set<Node>();
  private readonly fixedObjectUniforms=new Set<Node>();
  private readonly entries=new WeakMap<object,Entry435>();
  private readonly draws=new WeakMap<object,Draw435|false>();
  private readonly plans=new WeakMap<object,WeakMap<NodeMaterial,{epoch:number;result:Compatibility435}>>();
  private readonly producers=new Map<Family435,OwnedOpaqueProducer435>();
  private readonly materialResources=new Map<NodeMaterial,{resources:OwnedMaterialResources435;release:()=>void}>();
  private readonly arrayTextures=new Set<Texture>();
  private readonly sharedGroups=new Set<import('three/webgpu').UniformGroupNode>();
  private renderer:Renderer|undefined;
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
  private readonly counts={full:0,shared:0,native:0,retries:0,commits:0,registrations:0,forgotten:0,dirty:0,resourceInvalidations:0,resourceReads:0,compilations:0,acceptedPlans:0,rejectedPlans:0,preflights:0,identityReads:0};
  private readonly reasons:Record<string,number>={};

  producer(family:Family435):OwnedOpaqueProducer435 {
    let producer=this.producers.get(family);if(producer)return producer;
    producer={register:(mesh,materials,resources,options)=>this.register(mesh,materials,resources??[],family,options),dirty:mesh=>{const row=this.meshes.get(mesh);if(row){row.revision++;this.counts.dirty++;}},forget:mesh=>this.forget(mesh)};
    this.producers.set(family,producer);return producer;
  }
  attach(renderer:Renderer,scene:Scene,objectUniforms:readonly Node[],resources:readonly Texture[]):void {
    if(this.renderer&&this.renderer!==renderer)throw Error('Owned opaque renderer cannot be replaced');
    this.renderer=renderer;this.scene=scene;
    for(const node of objectUniforms){this.fixedObjectUniforms.add(node);this.objectUniforms.add(node);}
    for(const resource of resources){this.fixedResources.add(resource);this.addResource(resource);}
    this.invalidateResources();
  }
  invalidateResources():void {this.resourceEpoch++;this.counts.resourceInvalidations++;}
  setEnabled(enabled:boolean):void {if(this.enabled!==enabled){this.enabled=enabled;this.invalidateResources();}if(!enabled)this.preflightReady=false;}
  metrics(){return{enabled:this.enabled,meshes:this.meshes.size,materials:this.materials.size,resources:this.resources.size,resourceEpoch:this.resourceEpoch,plans:this.counts.acceptedPlans,...this.counts,reasons:{...this.reasons}};}
  private reason(reason:string):void {this.reasons[reason]=(this.reasons[reason]??0)+1;}

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
    const retained=new Set<Texture|BufferAttribute>([...this.fixedResources,...this.shadowResources]);this.arrayTextures.clear();this.sharedGroups.clear();this.objectUniforms.clear();for(const node of this.fixedObjectUniforms)this.objectUniforms.add(node);
    for(const {resources}of this.materialResources.values()){for(const node of resources.objectUniforms)this.objectUniforms.add(node);for(const value of resources.textures)retained.add(value);for(const value of resources.storage)retained.add(value);for(const value of resources.arrayTextures)this.arrayTextures.add(value);for(const group of resources.sharedGroups)this.sharedGroups.add(group);}
    for(const[value,row]of this.resources)if(!retained.has(value)){if(row.listener&&value instanceof Texture)value.removeEventListener('dispose',row.listener);this.resources.delete(value);this.textures.delete(value as Texture);this.storage.delete(value as BufferAttribute);}
    for(const value of retained)this.addResource(value);this.invalidateResources();
  }
  /** Once per world render, before any ShadowNode.updateBefore. Bounded to the
   * explicit family meshes and declared resources; never run per RenderObject.
   * The native shadow texture may be allocated/recreated later in updateBefore:
   * its dispose listener dirties the epoch, preventing retroactive acceptance. */
  preflight(camera:Camera,shadow:LightShadow):void {
    this.preflightReady=false;if(this.disposed||!this.enabled||!this.renderer||!this.scene)return;
    this.counts.preflights++;this.camera=camera;
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
    for(const row of this.resources.values()){
      const value=row.value,source=value instanceof Texture?value.source:undefined,sourceVersion=value instanceof Texture?value.source.version:0;
      const data=record435(Reflect.get(this.renderer,'_textures'))?Reflect.get(this.renderer,'_textures'):undefined;
      const cache=record435(data)&&data.data instanceof WeakMap?data.data.get(value):undefined;
      const generation=record435(cache)?cache.generation:undefined;this.counts.resourceReads+=4;
      if(row.version!==value.version||row.source!==source||row.sourceVersion!==sourceVersion||row.generation!==generation){row.version=value.version;row.source=source;row.sourceVersion=sourceVersion;row.generation=generation;this.invalidateResources();}
    }
    const checked=new Map<Object3D,boolean>();
    const identity=(object:Object3D):boolean=>{const old=checked.get(object);if(old!==undefined)return old;this.counts.identityReads+=42;
      const p=object.position,q=object.quaternion,s=object.scale;
      const valid=p.x===0&&p.y===0&&p.z===0&&q.x===0&&q.y===0&&q.z===0&&q.w===1&&s.x===1&&s.y===1&&s.z===1&&identity435(object.matrix.elements)&&identity435(object.matrixWorld.elements)&&(!object.parent||identity(object.parent));checked.set(object,valid);return valid;};
    for(const[mesh,row]of this.meshes){row.valid=identity(mesh)&&mesh.onAfterRender===row.after&&mesh.onBeforeRender===row.allowedBefore&&mesh.onBeforeShadow===Object3D.prototype.onBeforeShadow&&mesh.onAfterShadow===Object3D.prototype.onAfterShadow;}
    this.preflightReady=true;
  }

  private register(mesh:Mesh,materials:readonly NodeMaterial[],resources:readonly(Texture|BufferAttribute)[],family:Family435,options?:{readonly beforeRender:Mesh['onBeforeRender']}):void {
    if(this.disposed||this.meshes.has(mesh))return;
    if(!materials.length||materials.some(material=>material.transparent||material.setupObserver!==NodeMaterial.prototype.setupObserver&&!this.materials.has(material)))return;
    const allowedBefore=family==='static-page'&&options?.beforeRender===mesh.onBeforeRender&&isSourceOwnedRenderHook435(options.beforeRender)?options.beforeRender:Object3D.prototype.onBeforeRender;
    if(family==='static-page'&&materials.some(material=>!ownedMaterialResources435(material)))return;
    if(mesh.onBeforeRender!==allowedBefore||mesh.onAfterRender!==Object3D.prototype.onAfterRender||mesh.onBeforeShadow!==Object3D.prototype.onBeforeShadow||mesh.onAfterShadow!==Object3D.prototype.onAfterShadow)return;
    for(const resource of resources){this.fixedResources.add(resource);this.addResource(resource);}
    for(const material of materials)this.install(material);
    const owner=this,original=mesh.onAfterRender,before=Object.getOwnPropertyDescriptor(mesh,'onAfterRender');
    const callback:Mesh['onAfterRender']=function(this:Mesh,renderer,scene,camera,geometry,material,group){original.call(this,renderer,scene,camera,geometry,material,group);owner.finish(this,scene,camera,material);};
    const after=createSourceOwnedRenderHook435(callback);
    this.meshes.set(mesh,{family,allowedBefore,revision:1,materials:new Set(materials),after,before,pending:[],valid:false});mesh.onAfterRender=after;this.counts.registrations++;
  }
  private install(material:NodeMaterial):void {
    if(this.materials.has(material))return;
    const resources=ownedMaterialResources435(material);if(resources){const release=resources.subscribe(()=>this.synchronizeMaterialResources());this.materialResources.set(material,{resources,release});this.synchronizeMaterialResources();}
    const owner=this,native=material.setupObserver,before=Object.getOwnPropertyDescriptor(material,'setupObserver');
    const installed:NodeMaterial['setupObserver']=function(this:NodeMaterial,builder:NodeBuilder){
      const observer=native.call(this,builder),refresh:unknown=Reflect.get(observer,'needsRefresh');
      if(REVISION!=='186'||Object.getPrototypeOf(observer)!==NodeMaterialObserver.prototype||typeof refresh!=='function')return observer;
      Object.defineProperty(observer,'needsRefresh',{configurable:true,writable:true,value:function(ro:unknown,frame:unknown){return owner.decide(ro,frame,observer,refresh);}});return observer;
    };
    this.materials.set(material,{native,installed,before});material.setupObserver=installed;
  }
  private fallback(value:unknown,frame:unknown,observer:NodeMaterialObserver,native:Function,reason:string):unknown {
    if(record435(value)){const entry=this.entries.get(value);if(entry)entry.resources=-1;}this.counts.native++;this.reason(reason);return native.call(observer,value,frame);
  }
  private decide(value:unknown,frame:unknown,observer:NodeMaterialObserver,native:Function):unknown {
    if(this.disposed||!this.enabled||!this.preflightReady)return this.fallback(value,frame,observer,native,'inactive');
    if(!record435(value))return this.fallback(value,frame,observer,native,'not-render-object');
    let ro=this.draws.get(value);if(ro===undefined){ro=draw435(value)?value:false;this.draws.set(value,ro);}
    if(!ro||!record435(frame)||frame.renderer!==this.renderer||ro.scene!==this.scene||ro.camera!==this.camera||frame.camera!==this.camera||ro.scene.overrideMaterial!==null)return this.fallback(value,frame,observer,native,'not-owned-main');
    const row=this.meshes.get(ro.object);
    if(!row||!row.valid||!row.materials.has(ro.material))return this.fallback(value,frame,observer,native,'ownership');
    if(ro.object.material!==ro.material||Reflect.get(ro,'bundle')!==null||Reflect.get(ro.object,'isSkinnedMesh')===true||Reflect.get(ro.object,'isBatchedMesh')===true||this.renderer?.getMRT()!==null)return this.fallback(value,frame,observer,native,'unsupported-render-mode');
    let plans=this.plans.get(ro._nodeBuilderState);if(!plans){plans=new WeakMap();this.plans.set(ro._nodeBuilderState,plans);}
    let plan=plans.get(ro.material);
    if(!plan||!plan.result.accepted&&plan.result.reason==='resource-not-declared'&&plan.epoch!==this.resourceEpoch){
      const result=compatibleOwnedOpaqueCompiled435(ro._nodeBuilderState,{materials:[...row.materials],textures:this.textures,storage:this.storage,objectUniforms:this.objectUniforms,arrayTextures:this.arrayTextures,sharedGroups:this.sharedGroups,renderer:this.renderer});
      plan={epoch:this.resourceEpoch,result};plans.set(ro.material,plan);this.counts.compilations++;this.counts[result.accepted?'acceptedPlans':'rejectedPlans']++;
    }
    if(!plan.result.accepted)return this.fallback(value,frame,observer,native,'program:'+plan.result.reason);
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
      const entry=pending.entry;entry.revision=pending.revision;entry.resources=pending.resources;entry.geometry=pending.geometry;entry.state=pending.state;entry.material=pending.material;entry.bindings=pending.draw._bindings;this.counts.commits++;
    }
  }
  private forget(mesh:Mesh):void {
    const row=this.meshes.get(mesh);if(!row)return;
    if(mesh.onAfterRender===row.after){if(row.before)Object.defineProperty(mesh,'onAfterRender',row.before);else Reflect.deleteProperty(mesh,'onAfterRender');}
    for(const pending of row.pending){pending.entry.pending=undefined;pending.entry.resources=-1;}row.pending.length=0;this.meshes.delete(mesh);this.counts.forgotten++;
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;this.enabled=false;this.preflightReady=false;
    for(const mesh of this.meshes.keys())this.forget(mesh);
    for(const[material,row]of this.materials)if(material.setupObserver===row.installed){if(row.before)Object.defineProperty(material,'setupObserver',row.before);else Reflect.deleteProperty(material,'setupObserver');}
    for(const row of this.resources.values())if(row.listener&&row.value instanceof Texture)row.value.removeEventListener('dispose',row.listener);
    this.shadowTarget?.removeEventListener('dispose',this.shadowDisposed);this.shadowTarget=undefined;
    for(const row of this.materialResources.values())row.release();this.materialResources.clear();this.arrayTextures.clear();this.sharedGroups.clear();
    this.materials.clear();this.resources.clear();this.fixedResources.clear();this.shadowResources.clear();this.textures.clear();this.storage.clear();this.objectUniforms.clear();this.fixedObjectUniforms.clear();this.producers.clear();
    this.renderer=undefined;this.scene=undefined;this.camera=undefined;this.shadow=undefined;this.shadowMap=undefined;this.backend=undefined;this.device=undefined;
  }
}
