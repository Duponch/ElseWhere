import {Mesh,NodeMaterial,REVISION,type Camera,type Node,type Scene,type Renderer} from 'three/webgpu';
import {canPrepareSourceCommands435,sameSourceDraw435,selectedSourceDraw435,type SourceCommandDrawState435} from './source-command-capability';

type Row={object:Mesh;geometry:Mesh['geometry'];material:NodeMaterial;group:unknown;clippingContext:unknown};
type Parameters={vertexCount:number;instanceCount:number;firstVertex:number};
type Sets={attributes:Record<number,unknown>;bindingGroups:unknown[];pipeline:unknown;index:unknown};
type Context={sampleCount:number;depth:boolean;stencil:boolean;textures:unknown;clippingContext?:{unionPlanes:unknown[];intersectionPlanes:unknown[]}};
type Pass={executeBundles(bundles:unknown[]):void};
type Data={currentPass:Pass;currentSets:Sets;bundleEncoders?:unknown;occlusionQuerySet?:unknown};
type Info={render:{drawCalls:number;triangles:number};update(object:Mesh,count:number,instances:number):void};
type Draw={object:Mesh;material:NodeMaterial;geometry:Mesh['geometry'];camera:Camera;context:Context;pipeline:unknown;getBindings():object[];getVertexBuffers():object[]};
type Binding={groupNode?:{shared:boolean};update():boolean;updateRanges:unknown[];clearUpdateRanges():void};
type Frame={updateBeforeNode(node:Node):void;updateNode(node:Node):void};
export interface SourceSharedCommandPlan {readonly before:readonly Node[];readonly shared:readonly Node[];readonly bindings:readonly Binding[];readonly liveObjectInputs?:boolean}
export interface SourceCommandOwnership {
 /** Global dependencies only (device, resource generation, view/program
  * scope). Mutable producers carry their own independently versioned receipt. */
 epoch():number;
 revision?(mesh:Mesh,material:NodeMaterial):number;
 /** Every true producer write, used only to detect exceptional changes
  * while callbacks are executing. */
 serial?():number;
 accepts(mesh:Mesh,material:NodeMaterial):boolean;
 certify(draw:unknown):SourceSharedCommandPlan|undefined;
 /** Complete the private producer receipt after exceptional native repair;
  * the object's actual render callbacks have already run exactly once. */
 complete(draw:unknown):void;
}
type NativeDraw=(draw:Draw,info:Info,data:Data,pipeline:unknown,bindings:object[],vertices:object[],parameters:Parameters,pass:unknown,sets:Sets,cameraSlot?:number)=>void;
type Objects=(rows:Row[],camera:Camera,scene:Scene,lights:unknown,pass?:string|null)=>void;
type Direct=(object:Mesh,material:NodeMaterial,scene:Scene,camera:Camera,lights:unknown,group:unknown,clipping:unknown,pass?:string|null)=>void;
type Backend={isWebGPUBackend?:boolean;_draw:NativeDraw;get(value:object):Data;updateBinding(binding:Binding):void;pipelineUtils:{createBundleEncoder(context:Context,label?:string):{finish():unknown}}};
type Routing={backend:Backend;info:Info;contextNode:{id:number;version:number};toneMapping:unknown;outputColorSpace:unknown;_renderObjects:Objects;_renderObjectDirect:Direct;_handleObjectFunction:unknown;_currentRenderObjectFunction:unknown;renderObject:unknown;_currentRenderBundle:unknown;_currentRenderContext:Context;_nodes:{getCacheKey(scene:Scene,lights:unknown):unknown;getNodeFrameForRender(draw:Draw):Frame;updateGroup(binding:Binding):boolean};};
type Command={row:Row;draw:Draw;pipeline:unknown;parameters:Parameters;layout:SourceCommandDrawState435;plan:SourceSharedCommandPlan|undefined;revision:number|undefined};
type Run={rows:Row[];commands:Command[];epoch:number;key:unknown[];bundle:unknown;certified:boolean;negative:boolean};
type Encoder={finish():unknown};
type Recording={run:Run;context:Context;encoder:Encoder;sets:Sets;count:number;total:number;lastDraw:Draw|undefined;flushed:boolean;fallback:boolean};
const freshSets=():Sets=>({attributes:{},bindingGroups:[],pipeline:null,index:null});
const sameKey=(a:readonly unknown[],b:readonly unknown[])=>a.length===b.length&&a.every((value,index)=>value===b[index]);

/** Native culling and sorting still produce each frame's exact list. Closed
 * producer epochs certify the recorded native RenderObjects and resources.
 * Clean runs execute only their actual shared node/binding writers and replay
 * their GPU commands inline. No object lookup, material monitor, pipeline
 * preparation or GPU-handle census occurs on that replay path. */
export class SourceCommandBundles {
 private readonly routing:Routing;private readonly backend:Backend;
 private readonly nativeObjects:Objects;private readonly nativeDraw:NativeDraw;
 private readonly wrappedObjects:Objects;private readonly wrappedDraw:NativeDraw;
 private runs=new WeakMap<Row[],Run[]>();private recording:Recording|undefined;private disposed=false;
 private readonly counts={runs:0,recordings:0,replays:0,draws:0,recordedDraws:0,replayedDraws:0,indirectRecordedDraws:0,indirectReplayedDraws:0,spatialRepairs:0,signatureReads:0,membershipReads:0,sharedNodeVisits:0,objectNodeVisits:0,sharedBindingVisits:0,sharedBindingUpdates:0,sharedBufferUploads:0,objectBindingVisits:0,objectBindingUpdates:0,objectBufferUploads:0,liveObjectDraws:0,nativeObjectBypasses:0,nativeNegativePasses:0,nativeFallbackObjects:0,lateRepairs:0,fallbackLists:0,fallbackDraws:0,uncertifiedRuns:0};
 constructor(renderer:Renderer,private readonly scene:Scene,private readonly owner:SourceCommandOwnership){
  this.routing=renderer as unknown as Routing;this.backend=this.routing.backend;
  if(REVISION!=='186'||this.backend.isWebGPUBackend!==true||typeof this.routing._renderObjects!=='function'||typeof this.backend._draw!=='function'||typeof this.routing._nodes?.getNodeFrameForRender!=='function')throw Error('Source command replay requires audited Three r186 native render objects.');
  this.nativeObjects=this.routing._renderObjects;this.nativeDraw=this.backend._draw;const cache=this;
  this.wrappedObjects=function(rows,camera,scene,lights,pass){cache.objects(rows,camera,scene,lights,pass);};
  this.wrappedDraw=function(draw,info,data,pipeline,bindings,vertices,parameters,pass,sets,cameraSlot){
   const recording=cache.recording;
   if(!recording||recording.context!==draw.context){cache.nativeDraw.call(this,draw,info,data,pipeline,bindings,vertices,parameters,pass,sets,cameraSlot);return;}
   if(cameraSlot!==undefined&&cameraSlot!==-1)throw Error('Source command producer changed to an array-camera draw.');
   recording.total++;recording.lastDraw=draw;
   // Selection happens in the actual onBeforeRender/run. Record only direct
   // draws or the immutable command table and exact offsets published by the
   // actual spatial producer; an arbitrary indirect transition stays native.
   const layout=selectedSourceDraw435(draw.object,draw.geometry);
   if(recording.fallback||!layout){
    if(!recording.flushed){recording.run.bundle=recording.encoder.finish();if(recording.count)data.currentPass.executeBundles([recording.run.bundle]);data.currentSets=freshSets();recording.flushed=true;recording.fallback=true;}
    cache.counts.fallbackDraws++;cache.nativeDraw.call(this,draw,info,data,pipeline,bindings,vertices,parameters,pass,data.currentSets,cameraSlot);return;
   }
   const index=recording.count++,previous=recording.run.commands[index],row=recording.run.rows.find(row=>row.object===draw.object&&row.material===draw.material);
   if(!row)throw Error('Source command did not match its actual native list item.');
   if(previous){previous.row={...row};previous.draw=draw;previous.pipeline=pipeline;Object.assign(previous.parameters,parameters);previous.layout=layout;previous.plan=undefined;previous.revision=undefined;}
   else recording.run.commands.push({row:{...row},draw,pipeline,parameters:{...parameters},layout,plan:undefined,revision:undefined});
   if(layout.indirect)cache.counts.indirectRecordedDraws++;
   cache.nativeDraw.call(this,draw,info,data,pipeline,bindings,vertices,parameters,recording.encoder,recording.sets,cameraSlot);
  };
  this.routing._renderObjects=this.wrappedObjects;this.backend._draw=this.wrappedDraw;
 }
 metrics(){return{...this.counts,enabled:!this.disposed,producerEpochs:true};}
 private accepts(row:Row):boolean{return canPrepareSourceCommands435(row.object,row.geometry)&&this.owner.accepts(row.object,row.material);}
 private objects(rows:Row[],camera:Camera,scene:Scene,lights:unknown,pass?:string|null):void {
  const outer=this.recording;this.recording=undefined;
  try{
   const r=this.routing,context=r._currentRenderContext,data=this.backend.get(context),clipping=context.clippingContext;
   if(this.disposed||scene!==this.scene||scene.overrideMaterial!==null||pass!=null||r._handleObjectFunction!==r._renderObjectDirect||r._currentRenderObjectFunction!==r.renderObject||r._currentRenderBundle!==null||Reflect.get(camera,'isArrayCamera')===true||!data.currentPass?.executeBundles||data.occlusionQuerySet!==undefined||data.bundleEncoders!==undefined||clipping&&(clipping.unionPlanes.length>0||clipping.intersectionPlanes.length>0)){
    this.counts.fallbackLists++;this.nativeObjects.call(r,rows,camera,scene,lights,pass);return;
   }
   // These are native program/context inputs, once per list rather than per
   // object. Camera/viewport uniforms remain actual shared writers below.
   const key=[context,camera,lights,r._nodes.getCacheKey(scene,lights),r.contextNode.id,r.contextNode.version,r.toneMapping,r.outputColorSpace,context.sampleCount,context.depth,context.stencil,context.textures];
   let runs=this.runs.get(rows);if(!runs){runs=[];this.runs.set(rows,runs);}
   let at=0,slot=0;
   while(at<rows.length){
    const first=at,owned=this.accepts(rows[at]!);at++;
    while(at<rows.length&&this.accepts(rows[at]!)===owned)at++;
    if(!owned||at-first<2){if(first===0&&at===rows.length)this.nativeObjects.call(r,rows,camera,scene,lights,pass);else this.nativeObjects.call(r,rows.slice(first,at),camera,scene,lights,pass);continue;}
    let run=runs[slot++];if(!run){run={rows:[],commands:[],epoch:-1,key:[],bundle:undefined,certified:false,negative:false};runs.push(run);}
    const epoch=this.owner.epoch();let same=run.epoch===epoch&&sameKey(run.key,key)&&run.commands.length===at-first;
    for(let i=first;i<at;i++){
     const row=rows[i]!,command=run.commands[i-first],old=command?.row;
     if(same&&(!old||old.object!==row.object||old.geometry!==row.geometry||old.material!==row.material||old.clippingContext!==row.clippingContext||old.group!==row.group||command!.revision!==this.owner.revision?.(row.object,row.material)))same=false;
     run.rows[i-first]=row;this.counts.membershipReads+=5;
    }
    run.rows.length=at-first;this.counts.runs++;
    if(same&&run.certified)this.replay(run,camera,scene,lights,data);
    else if(same&&run.negative){this.counts.nativeNegativePasses++;this.counts.nativeFallbackObjects+=run.rows.length;this.nativeObjects.call(r,run.rows,camera,scene,lights,null);}
    else this.record(run,camera,scene,lights,data,key);
   }
   runs.length=slot;
  }finally{this.recording=outer;}
 }
 private record(run:Run,camera:Camera,scene:Scene,lights:unknown,data:Data,key:unknown[],repair=false):void {
  const context=this.routing._currentRenderContext,encoder=this.backend.pipelineUtils.createBundleEncoder(context,'source-owned-native-commands');
  const recording:Recording={run,context,encoder,sets:freshSets(),count:0,total:0,lastDraw:undefined,flushed:false,fallback:false};this.recording=recording;
  try{
   if(repair){
    // Source callbacks already ran once. Repeat only the native direct path,
    // whose NodeFrame suppresses repeated render/frame callbacks, and finish
    // the private acknowledgement without invoking object callbacks again.
    for(const row of run.rows){const before=recording.total;this.routing._renderObjectDirect(row.object,row.material,scene,camera,lights,row.group,row.clippingContext,null);if(recording.total>before)this.owner.complete(recording.lastDraw);}
   }else this.nativeObjects.call(this.routing,run.rows,camera,scene,lights,null);
  }finally{this.recording=undefined;}
  run.commands.length=recording.count;if(!recording.flushed)run.bundle=encoder.finish();run.key=key.slice();run.epoch=this.owner.epoch();
  run.certified=!recording.fallback&&run.commands.length===run.rows.length;
  const geometries=new Set<Mesh['geometry']>();
  for(const command of run.commands){command.plan=this.owner.certify(command.draw);command.revision=this.owner.revision?.(command.row.object,command.row.material);if(!command.plan||geometries.has(command.draw.geometry))run.certified=false;geometries.add(command.draw.geometry);}
  if(!run.certified)this.counts.uncertifiedRuns++;
  run.negative=!run.certified;
  if(!recording.flushed){data.currentPass.executeBundles([run.bundle]);data.currentSets=freshSets();}
  this.counts.recordings++;this.counts.recordedDraws+=run.commands.length;this.counts.draws+=recording.total;
 }
 private replay(run:Run,camera:Camera,scene:Scene,lights:unknown,data:Data):void {
  const r=this.routing,nodes=r._nodes,epoch=this.owner.serial?.()??this.owner.epoch();let triangles=0,accounted=0,changedSelection=false,indirectDraws=0;
  for(const command of run.commands){
   const {row,draw,plan,parameters,layout}=command;draw.camera=camera;
   Reflect.apply(row.object.onBeforeRender,row.object,[r,scene,camera,row.geometry,row.material,row.group]);
   changedSelection ||= !sameSourceDraw435(layout,selectedSourceDraw435(row.object,row.object.geometry));
   // Match native NodeManager frame scoping around nested ShadowNode renders.
   for(const node of plan!.before)nodes.getNodeFrameForRender(draw).updateBeforeNode(node);
   changedSelection ||= !sameSourceDraw435(layout,selectedSourceDraw435(row.object,row.object.geometry));
   const frame=nodes.getNodeFrameForRender(draw);
   for(const node of plan!.shared){frame.updateNode(node);if(plan!.liveObjectInputs&&node.updateType==='object')this.counts.objectNodeVisits++;else this.counts.sharedNodeVisits++;}
   for(const binding of plan!.bindings){const object=plan!.liveObjectInputs&&binding.groupNode?.shared!==true;this.counts[object?'objectBindingVisits':'sharedBindingVisits']++;if(!nodes.updateGroup(binding))continue;this.counts[object?'objectBindingUpdates':'sharedBindingUpdates']++;if(binding.update()){this.backend.updateBinding(binding);this.counts[object?'objectBufferUploads':'sharedBufferUploads']++;}if(binding.updateRanges.length)binding.clearUpdateRanges();}
   if(plan!.liveObjectInputs)this.counts.liveObjectDraws++;
   r.info.update(row.object,parameters.vertexCount,parameters.instanceCount);accounted++;triangles+=parameters.vertexCount*parameters.instanceCount/3;if(layout.indirect)indirectDraws++;
   Reflect.apply(row.object.onAfterRender,row.object,[r,scene,camera,row.geometry,row.material,row.group]);
  }
  if(changedSelection||(this.owner.serial?.()??this.owner.epoch())!==epoch){
   // A native shadow atlas can be allocated/resized in updateBefore. Keep its
   // actual shadow draws in Info; undo only our unsubmitted main commands.
   r.info.render.drawCalls-=accounted;r.info.render.triangles-=triangles;this.counts.lateRepairs++;if(changedSelection)this.counts.spatialRepairs++;
   this.record(run,camera,scene,lights,data,run.key,true);return;
  }
  data.currentPass.executeBundles([run.bundle]);data.currentSets=freshSets();
  this.counts.replays++;this.counts.replayedDraws+=run.commands.length;this.counts.draws+=run.commands.length;this.counts.nativeObjectBypasses+=run.commands.length;
  this.counts.indirectReplayedDraws+=indirectDraws;
 }
 dispose():void{if(this.disposed)return;this.disposed=true;this.runs=new WeakMap();this.recording=undefined;if(this.routing._renderObjects===this.wrappedObjects)this.routing._renderObjects=this.nativeObjects;if(this.backend._draw===this.wrappedDraw)this.backend._draw=this.nativeDraw;}
}
