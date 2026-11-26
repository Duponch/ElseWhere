import {Box3,Frustum,IndirectStorageBufferAttribute,Matrix4} from 'three/webgpu';
import type {BufferGeometry,Camera,Material,Mesh} from 'three/webgpu';
import {directOwnedSpatialDraw435,markNativeIndirectGeometry,publishOwnedSpatialCommands435,retireOwnedSpatialCommands435,type OwnedSpatialCommand435,type SourceCommandDrawState435} from './source-command-capability';
import type {OwnedOpaqueProducer435} from './OwnedOpaqueRevisionRegistry435';

export interface SpatialInstanceRange379 {readonly first:number;readonly count:number;readonly bounds:Box3}
interface RangePlan {
  matrix:Matrix4; coordinateSystem:Camera['coordinateSystem']; reversedDepth:boolean;
  offsets:number[]|null; instances:number;
}
interface AttributeOwner {update(attribute:IndirectStorageBufferAttribute,type:number):void;delete(attribute:IndirectStorageBufferAttribute):unknown}
type DrawGeometry=BufferGeometry&{isInstancedBufferGeometry?:boolean;instanceCount?:number};
const indirectAttributeType=4; // Three r186 AttributeType.INDIRECT

/** Native firstInstance keeps all original matrix, material and picking slots.
 * The immutable command table contains every contiguous source interval.
 * Each real camera selects byte offsets into that table. No per-camera GPU
 * buffer write can overwrite commands already encoded by another pass. */
export class SpatialInstanceRanges379 {
  private ranges:SpatialInstanceRange379[]=[];
  private geometry?:DrawGeometry;
  private commands?:IndirectStorageBufferAttribute;
  private commandVersion435=-1;
  private commandOwner435?:OwnedSpatialCommand435;
  private selectedOffsets435=new WeakMap<number[],SourceCommandDrawState435>();
  private allocated?:AttributeOwner;
  private plans=new WeakMap<Camera,RangePlan>();
  private readonly frustum=new Frustum();
  private readonly matrix=new Matrix4();
  private count=0;
  private vertices=0;
  private vertexStart=0;
  private stride=0;
  private levels:{span:number;firstCommand:number}[]=[];
  // Small spatial plans may encode every contiguous interval. For these
  // producers a visible stretch is ONE actual draw instead of a dyadic cover.
  // Large fragmented domains retain the bounded O(n) command table.
  private exactIntervals?:Int32Array;
  private shadowStack:{geometry:BufferGeometry;indirect:BufferGeometry['indirect'];offset:BufferGeometry['indirectOffset'];camera:Camera}[]=[];
  private readonly counts={direct:0,partial:0,empty:0,frustumReads:0,sourceInstances:0,selectedInstances:0,selectedRanges:0};
  private readonly previousBefore:Mesh['onBeforeRender'];
  private readonly previousShadow:Mesh['onBeforeShadow'];
  private readonly previousAfterShadow:Mesh['onAfterShadow'];
  private readonly before:Mesh['onBeforeRender'];
  private readonly shadow:Mesh['onBeforeShadow'];
  private readonly afterShadow:Mesh['onAfterShadow'];
  private readonly releaseGeometry=()=>this.clear();
  constructor(private readonly mesh:Mesh,private readonly unit:'instances'|'indices'='instances',private readonly producer435?:OwnedOpaqueProducer435){
    this.previousBefore=mesh.onBeforeRender;this.previousShadow=mesh.onBeforeShadow;this.previousAfterShadow=mesh.onAfterShadow;
    this.before=(...args)=>{
      this.previousBefore.apply(mesh,args);
      const [renderer,,camera,geometry,material,group]=args;
      this.select(renderer,this.shadowStack.at(-1)?.camera??camera,geometry,material,group);
    };
    this.shadow=(...args)=>{
      this.previousShadow.apply(mesh,args);
      const [renderer,,,camera,geometry,material,group]=args;
      this.shadowStack.push({geometry,indirect:geometry.indirect,offset:geometry.indirectOffset,camera});
      this.select(renderer,camera,geometry,material,group);
    };
    this.afterShadow=(...args)=>{
      try{this.previousAfterShadow.apply(mesh,args);}finally{
        const prior=this.shadowStack.pop();if(prior)prior.geometry.setIndirect(prior.indirect,prior.offset);
      }
    };
    mesh.onBeforeRender=this.before;mesh.onBeforeShadow=this.shadow;mesh.onAfterShadow=this.afterShadow;
    if(producer435)this.commandOwner435={mesh,producer:producer435,before:this.before,shadow:this.shadow,afterShadow:this.afterShadow,originalBefore:this.previousBefore,originalShadow:this.previousShadow,originalAfterShadow:this.previousAfterShadow,read:()=>this.readCommand435()};
  }
  private readCommand435():SourceCommandDrawState435|undefined{
    const geometry=this.geometry,commands=this.commands;
    if(!geometry||!commands||commands.version!==this.commandVersion435)return;
    if(geometry.indirect===null)return directOwnedSpatialDraw435;
    if(geometry.indirect!==commands||!Array.isArray(geometry.indirectOffset))return;
    return this.selectedOffsets435.get(geometry.indirectOffset);
  }
  private instanceCount(geometry:DrawGeometry):number|undefined {
    return geometry.isInstancedBufferGeometry?geometry.instanceCount:(this.mesh as Mesh&{isInstancedMesh?:boolean;count?:number}).count;
  }
  private clear():void {
    if(this.geometry){
      if(this.commandOwner435)retireOwnedSpatialCommands435(this.geometry,this.commandOwner435);
      this.geometry.removeEventListener('dispose',this.releaseGeometry);
      if(this.commands&&this.geometry.indirect===this.commands)this.geometry.setIndirect(null);
    }
    if(this.commands){this.allocated?.delete(this.commands);this.commands.dispose();}
    this.commands=undefined;this.commandVersion435=-1;this.selectedOffsets435=new WeakMap();this.allocated=undefined;this.geometry=undefined;this.ranges=[];this.levels=[];this.exactIntervals=undefined;this.plans=new WeakMap();this.count=0;
  }
  setRanges(input:readonly SpatialInstanceRange379[]|undefined):boolean {
    const geo=this.mesh.geometry as DrawGeometry,position=geo.getAttribute('position');
    const start=geo.drawRange.start,available=geo.index?.count??position?.count,vertices=Math.min(geo.drawRange.count,(available??0)-start);
    const count=this.unit==='indices'?vertices:this.instanceCount(geo);
    const refuse=()=>{this.clear();return false;};
    if(!input||input.length<2||!position||!count||this.unit==='indices'&&(!geo.index||geo.isInstancedBufferGeometry||Reflect.get(this.mesh,'isInstancedMesh'))||geo.indirect!==null&&geo.indirect!==this.commands)return refuse();
    const ranges:SpatialInstanceRange379[]=[];
    let bound=0;
    for(const r of input){
      const {first,count:extent,bounds}=r;
      if(first!==bound||!Number.isSafeInteger(extent)||extent<=0||this.unit==='indices'&&extent%3!==0||bounds.isEmpty()||![bounds.min.x,bounds.min.y,bounds.min.z,bounds.max.x,bounds.max.y,bounds.max.z].every(Number.isFinite))return refuse();
      ranges.push({first,count:extent,bounds:bounds.clone().expandByScalar(.001)});bound+=extent;
    }
    if(bound!==count||bound>0xffffffff)return refuse();
    if(!Number.isSafeInteger(start)||start<0||!Number.isSafeInteger(vertices)||vertices<=0)return refuse();
    const indexed=geo.index!==null,words=indexed?5:4;
    if(this.geometry===geo&&this.count===count&&this.vertexStart===start&&this.vertices===vertices&&this.stride===words*4&&ranges.length===this.ranges.length&&ranges.every((r,i)=>r.first===this.ranges[i]!.first&&r.count===this.ranges[i]!.count)){
      this.ranges=ranges;this.plans=new WeakMap();return true;
    }
    this.clear();
    // Every aligned interval of 1, 2, 4, ... adjacent source ranges gets one
    // native command. A visible stretch can then be submitted in large draws,
    // without copying or renumbering a single source index between cameras.
    let commandCount=0;
    for(let span=1;span<=ranges.length;span*=2){this.levels.push({span,firstCommand:commandCount});commandCount+=Math.floor(ranges.length/span);}
    const n=ranges.length,extra:{first:number;end:number;command:number}[]=[];
    if(n<=128){
      const exact=new Int32Array(n*n).fill(-1);
      for(const {span,firstCommand} of this.levels)for(let i=0;i+span<=n;i+=span)exact[i*n+i+span-1]=firstCommand+i/span;
      for(let first=0;first<n;first++)for(let end=first+1;end<=n;end++){
        const at=first*n+end-1;if(exact[at]!==-1)continue;
        extra.push({first,end,command:commandCount});exact[at]=commandCount++;
      }
      this.exactIntervals=exact;
    }
    const table=new Uint32Array(commandCount*words);
    const write=(command:number,first:number,end:number)=>{const at=command*words,r=ranges[first]!,last=ranges[end-1]!,length=last.first+last.count-r.first;
      if(this.unit==='indices'){table[at]=length;table[at+1]=1;table[at+2]=start+r.first;}
      else{table[at]=vertices;table[at+1]=length;table[at+2]=start;table[at+words-1]=r.first;}
    };
    for(const {span,firstCommand} of this.levels)for(let i=0;i+span<=ranges.length;i+=span)write(firstCommand+i/span,i,i+span);
    for(const {first,end,command} of extra)write(command,first,end);
    this.vertices=vertices;this.vertexStart=start;this.count=count;this.geometry=geo;this.ranges=ranges;this.stride=words*4;
    this.commands=new IndirectStorageBufferAttribute(table,words);
    markNativeIndirectGeometry(geo);
    this.commandVersion435=this.commands.version;
    if(this.commandOwner435)publishOwnedSpatialCommands435(geo,this.commandOwner435);
    geo.addEventListener('dispose',this.releaseGeometry);
    return true;
  }
  private appendVisibleRun(offsets:number[],first:number,end:number):void {
    const exact=this.exactIntervals;
    if(exact){offsets.push(exact[first*this.ranges.length+end-1]!*this.stride);return;}
    while(first<end){
      const length=end-first,aligned=first===0?length:first&-first;
      const level=this.levels[31-Math.clz32(Math.min(length,aligned))]!;
      offsets.push((level.firstCommand+first/level.span)*this.stride);first+=level.span;
    }
  }
  private select(renderer:object,camera:Camera,geometry:BufferGeometry,material:Material,group:unknown):void {
    const commands=this.commands;
    if(!commands||geometry!==this.geometry)return;
    // Returning to the direct draw also handles materials temporarily replaced
    // by debug wireframe, a grouped pass and an unsupported backend/device.
    if(geometry.indirect!==null&&geometry.indirect!==commands)return;
    const backend=Reflect.get(renderer,'backend'),owner=Reflect.get(renderer,'_attributes') as AttributeOwner|undefined;
    const available=geometry.index?.count??geometry.getAttribute('position')?.count;
    const sameDrawRange=available!==undefined&&(geometry.index?20:16)===this.stride&&geometry.drawRange.start===this.vertexStart&&Math.min(geometry.drawRange.count,available-this.vertexStart)===this.vertices;
    if(!backend?.isWebGPUBackend||!backend.device||this.unit==='instances'&&!backend.device.features?.has('indirect-first-instance')||typeof owner?.update!=='function'||typeof owner.delete!=='function'||group!=null||Reflect.get(material,'wireframe')||Reflect.get(camera,'isArrayCamera')||!this.mesh.frustumCulled||this.unit==='instances'&&this.instanceCount(geometry)!==this.count||!sameDrawRange){
      if(geometry.indirect===commands)geometry.setIndirect(null);
      this.counts.direct++;return;
    }
    this.matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(this.mesh.matrixWorld);
    let plan=this.plans.get(camera);
    if(!plan||!plan.matrix.equals(this.matrix)||plan.coordinateSystem!==camera.coordinateSystem||plan.reversedDepth!==camera.reversedDepth){
      this.counts.frustumReads++;
      this.frustum.setFromProjectionMatrix(this.matrix,camera.coordinateSystem,camera.reversedDepth);
      const offsets:number[]=[];let instances=0,run=-1;
      for(let i=0;i<this.ranges.length;i++){
        const range=this.ranges[i]!;
        if(this.frustum.intersectsBox(range.bounds)){if(run<0)run=i;instances+=range.count;}
        else if(run>=0){this.appendVisibleRun(offsets,run,i);run=-1;}
      }
      if(run>=0&&run!==0)this.appendVisibleRun(offsets,run,this.ranges.length);
      if(this.commandOwner435&&instances!==this.count){Object.freeze(offsets);this.selectedOffsets435.set(offsets,Object.freeze({indirect:commands,offsets}));}
      plan={matrix:this.matrix.clone(),coordinateSystem:camera.coordinateSystem,reversedDepth:camera.reversedDepth,offsets:instances===this.count?null:offsets,instances};this.plans.set(camera,plan);
    }
    this.counts.sourceInstances+=this.count;this.counts.selectedInstances+=plan.instances;
    if(plan.offsets===null){geometry.setIndirect(null);this.counts.direct++;this.counts.selectedRanges++;return;}
    // An initially fully visible draw can switch to indirect between Fulls,
    // including in a shared-uniform refresh. Prepare the fresh buffer once
    // without depending on a later native FULL material update.
    if(this.allocated!==owner){this.allocated?.delete(commands);owner.update(commands,indirectAttributeType);this.allocated=owner;}
    geometry.setIndirect(commands,plan.offsets);this.counts.selectedRanges+=plan.offsets.length;
    if(plan.offsets.length)this.counts.partial++;else this.counts.empty++;
  }
  metrics(){const bytes=this.commands?.array.byteLength??0;return {...this.counts,unit:this.unit,ranges:this.ranges.length,commandBytes:bytes,gpuCommandBytes:this.allocated?bytes:0};}
  dispose():void {
    this.clear();
    if(this.mesh.onBeforeRender===this.before)this.mesh.onBeforeRender=this.previousBefore;
    if(this.mesh.onBeforeShadow===this.shadow)this.mesh.onBeforeShadow=this.previousShadow;
    if(this.mesh.onAfterShadow===this.afterShadow)this.mesh.onAfterShadow=this.previousAfterShadow;
  }
}
