import {expect,test,vi} from 'vitest';
import {Box3,BoxGeometry,IndirectStorageBufferAttribute,Mesh,MeshBasicNodeMaterial,Node,NodeFrame,PerspectiveCamera,Renderer,Scene,UniformGroupNode,Vector3,WebGPUBackend} from 'three/webgpu';
import {SourceCommandBundles,type SourceSharedCommandPlan} from '../src/render/SourceCommandBundles';
import {markNativeIndirectGeometry} from '../src/render/source-command-capability';
import {SpatialInstanceRanges379} from '../src/render/SpatialInstanceRanges379';

// The pinned native group-version scheduler has no public export or matching
// declaration. Load its real implementation; no scheduler is copied here.
const nativeManagerPath='three/src/renderers/common/nodes/NodeManager.js';
const {default:nativeManager}:{default:unknown}=await import(nativeManagerPath);
if(typeof nativeManager!=='function')throw Error('Pinned native node manager unavailable.');
const NativeManager=nativeManager;

/** The real native list iterator and native backend _draw encode into a small
 * command tape. This checks order/resources/accounting without manufacturing a
 * GPU device or inferring a frame rate. ROOT also measures the native client. */
function fixture(){
 const scene=new Scene(),camera=new PerspectiveCamera(),context={camera,stencil:false,occlusionQueryCount:0},gpu=new WeakMap<object,Record<string,unknown>>(),tape:unknown[][]=[];
 const makePass=()=>({
  setPipeline:(...a:unknown[])=>tape.push(['pipeline',...a]),setBindGroup:(...a:unknown[])=>tape.push(['group',...a]),setVertexBuffer:(...a:unknown[])=>tape.push(['vertex',...a]),setIndexBuffer:(...a:unknown[])=>tape.push(['index',...a]),
  drawIndexed:(...a:unknown[])=>tape.push(['draw',...a]),draw:(...a:unknown[])=>tape.push(['draw',...a]),
  drawIndexedIndirect:(...a:unknown[])=>tape.push(['indirect',...a]),drawIndirect:(...a:unknown[])=>tape.push(['indirect',...a]),
  executeBundles:(bundles:unknown[][][])=>{for(const bundle of bundles)for(const command of bundle)tape.push(command);},
 });
 const pass=makePass(),data={currentPass:pass,currentSets:{attributes:{},bindingGroups:[],pipeline:null,index:null}},backend=new WebGPUBackend();
 let gpuReads=0;const get=(value:object)=>{gpuReads++;let row=gpu.get(value);if(!row){row={};gpu.set(value,row);}return row;};
 Reflect.set(backend,'get',get);
 const recordings:unknown[][][]=[];
 Reflect.set(backend,'pipelineUtils',{createBundleEncoder:()=>{
  const commands:unknown[][]=[];recordings.push(commands);
  const push=(kind:string)=>(...args:unknown[])=>commands.push([kind,...args]);
  return{setPipeline:push('pipeline'),setBindGroup:push('group'),setVertexBuffer:push('vertex'),setIndexBuffer:push('index'),drawIndexed:push('draw'),draw:push('draw'),drawIndexedIndirect:push('indirect'),drawIndirect:push('indirect'),finish:()=>commands};
 }});
 Object.assign(get(context),data);
 const renderer=Object.create(Renderer.prototype) as Renderer,owned=new Set<Mesh>(),callbacks:string[]=[],draws=new Map<Mesh,ReturnType<typeof draw>>();
 Reflect.set(renderer,'backend',backend);Reflect.set(renderer,'_currentRenderContext',context);Reflect.set(renderer,'_currentRenderBundle',null);
 Reflect.set(renderer,'_handleObjectFunction',Reflect.get(renderer,'_renderObjectDirect'));
 const info={render:{drawCalls:0,triangles:0},update:(_mesh:Mesh,count:number,instances:number)=>{info.render.drawCalls++;info.render.triangles+=count*instances/3;}};Reflect.set(renderer,'info',info);Reflect.set(renderer,'contextNode',{id:1,version:0});
 let epoch=1,serial=1,programKey=1,certified=true,bindingUpdates=0;const localRevisions=new WeakMap<Mesh,number>(),frame=new NodeFrame(),before:Node[]=[],shared:Node[]=[],sharedBindings:{groupNode:UniformGroupNode;update():boolean;updateRanges:unknown[];clearUpdateRanges():void}[]=[],plan:SourceSharedCommandPlan={before,shared,bindings:sharedBindings};
 const manager:object=Reflect.construct(NativeManager,[renderer,backend]),nativeUpdateGroup:unknown=Reflect.get(manager,'updateGroup');if(typeof nativeUpdateGroup!=='function')throw Error('Pinned native group scheduler unavailable.');
 const nodes={getCacheKey:()=>programKey,getNodeFrameForRender:(draw:{object:Mesh})=>{Object.assign(frame,{renderer,scene,camera,object:draw.object,material:draw.object.material});return frame;},updateGroup:(binding:object)=>Reflect.apply(nativeUpdateGroup,manager,[binding])as boolean};Reflect.set(renderer,'_nodes',nodes);Reflect.set(backend,'updateBinding',()=>{bindingUpdates++;});
 function draw(mesh:Mesh){
  const index=mesh.geometry.index!,binding={},vertex={},pipeline={},parameters={vertexCount:12,instanceCount:2,firstVertex:0};
  get(index).buffer={index:mesh.uuid};get(binding).group={group:mesh.uuid};get(vertex).buffer={vertex:mesh.uuid};
  return{object:mesh,material:mesh.material,geometry:mesh.geometry,context,camera,getIndex:()=>index,getIndirect:()=>mesh.geometry.indirect,getIndirectOffset:()=>mesh.geometry.indirectOffset,index,binding,vertex,pipeline,parameters};
 }
 const direct=function(mesh:Mesh){
  const d=draws.get(mesh)!;for(const node of before)nodes.getNodeFrameForRender(d).updateBeforeNode(node);for(const node of shared)nodes.getNodeFrameForRender(d).updateNode(node);for(const binding of sharedBindings){if(!nodes.updateGroup(binding))continue;if(binding.update())bindingUpdates++;if(binding.updateRanges.length)binding.clearUpdateRanges();}
  const drawMethod:unknown=Reflect.get(backend,'_draw');Reflect.apply(drawMethod as Function,backend,[d,info,get(context),d.pipeline,[d.binding],[d.vertex],d.parameters,pass,get(context).currentSets]);
 };
 const renderObject=function(mesh:Mesh){
  callbacks.push(mesh.name+':before');Reflect.apply(mesh.onBeforeRender,mesh,[renderer,scene,camera,mesh.geometry,mesh.material,null]);
  direct(mesh);
  callbacks.push(mesh.name+':after');Reflect.apply(mesh.onAfterRender,mesh,[renderer,scene,camera,mesh.geometry,mesh.material,null]);
 };
 Reflect.set(renderer,'renderObject',renderObject);Reflect.set(renderer,'_currentRenderObjectFunction',renderObject);
 Reflect.set(renderer,'_renderObjectDirect',direct);Reflect.set(renderer,'_handleObjectFunction',direct);
 const owner=new SourceCommandBundles(renderer,scene,{epoch:()=>epoch,serial:()=>serial,revision:mesh=>localRevisions.get(mesh)??0,accepts:(mesh,material)=>owned.has(mesh)&&!material.transparent,certify:()=>certified?plan:undefined,complete:()=>{}});
 function mesh(name:string,closed=true){const mesh=new Mesh(new BoxGeometry(),new MeshBasicNodeMaterial());mesh.name=name;scene.add(mesh);if(closed)owned.add(mesh);draws.set(mesh,draw(mesh));return mesh;}
 const rows:Record<string,unknown>[]=[];
 function render(meshes:Mesh[]){frame.renderId++;frame.frameId++;rows.length=0;for(const mesh of meshes)rows.push({object:mesh,geometry:mesh.geometry,material:mesh.material,group:null,clippingContext:null});const method:unknown=Reflect.get(renderer,'_renderObjects');Reflect.apply(method as Function,renderer,[rows,camera,scene,null]);}
 function dispose(){owner.dispose();for(const mesh of draws.keys()){mesh.geometry.dispose();(mesh.material as MeshBasicNodeMaterial).dispose();}}
 return{owner,mesh,render,draws,callbacks,tape,recordings,get,context,scene,camera,renderer,backend,pass,before,shared,sharedBindings,bump:()=>{epoch++;serial++;},dirty:(mesh:Mesh)=>{localRevisions.set(mesh,++serial);},programChange:()=>{programKey++;},certified:(value:boolean)=>{certified=value;},bindingUpdates:()=>bindingUpdates,gpuReads:()=>gpuReads,counts:()=>({...info.render}),dispose};
}

test('independent source revisions rebuild only the affected native command run',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),publicMesh=f.mesh('public',false),c=f.mesh('c'),d=f.mesh('d'),rows=[a,b,publicMesh,c,d];
  f.render(rows);f.render(rows);expect(f.owner.metrics()).toMatchObject({recordings:2,replays:2});
  f.draws.get(a)!.parameters.instanceCount=7;f.dirty(a);f.tape.length=0;f.render(rows);
  expect(f.owner.metrics()).toMatchObject({recordings:3,replays:3});
  expect(f.tape.filter(row=>row[0]==='index').map(row=>row[1])).toEqual(rows.map(mesh=>f.get(f.draws.get(mesh)!.index).buffer));
  expect(f.tape.some(row=>row[0]==='draw'&&row[2]===7)).toBe(true);
 }finally{f.dispose();}
});

test('identical actual commands replay with native callbacks and truthful every-frame draws',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),beforeA=vi.fn(),afterB=vi.fn();a.onBeforeRender=beforeA;b.onAfterRender=afterB;
  f.render([a,b]);const first=f.tape.slice();f.tape.length=0;f.render([a,b]);
  expect(f.tape).toEqual(first);expect(f.recordings).toHaveLength(1);expect(beforeA).toHaveBeenCalledTimes(2);expect(afterB).toHaveBeenCalledTimes(2);
  expect(f.callbacks).toEqual(['a:before','a:after','b:before','b:after']);
  expect(f.counts()).toEqual({drawCalls:4,triangles:32});expect(f.owner.metrics()).toMatchObject({recordings:1,replays:1,draws:4,replayedDraws:2});
 }finally{f.dispose();}
});

test('live native membership/order and ordinary draws keep the exact inline order',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),ordinary=f.mesh('public',false),c=f.mesh('c'),d=f.mesh('d');
  f.render([a,b,ordinary,c,d]);const expected=f.tape.filter(row=>row[0]==='index').map(row=>row[1]);
  expect(expected).toEqual([a,b,ordinary,c,d].map(mesh=>f.get(f.draws.get(mesh)!.index).buffer));
  // The iterator's input is the already-culled, sorted native list. Removing
  // a previously visible member or changing orbit order records that list.
  f.tape.length=0;f.render([d,c,ordinary,b]);
  expect(f.tape.filter(row=>row[0]==='index').map(row=>row[1])).toEqual([d,c,ordinary,b].map(mesh=>f.get(f.draws.get(mesh)!.index).buffer));
  expect(f.counts().drawCalls).toBe(9);expect(f.owner.metrics().draws).toBe(6);
 }finally{f.dispose();}
});

test('real producer epochs reacquire commands after resource replacement or changed draw arguments',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),draw=f.draws.get(a)!;f.render([a,b]);
  const mutate=[()=>{f.get(draw.binding).group={replacement:'bind group'};},()=>{f.get(draw.vertex).buffer={replacement:'vertex GPU buffer'};},()=>{f.get(draw.index).buffer={replacement:'index GPU buffer'};},()=>{draw.pipeline={replacement:'pipeline'};},()=>{draw.parameters.instanceCount=7;},()=>{draw.parameters.vertexCount=9;},()=>{draw.parameters.firstVertex=3;}];
  for(const change of mutate){const before=f.owner.metrics().recordings;change();f.bump();f.render([a,b]);expect(f.owner.metrics().recordings).toBe(before+1);f.render([a,b]);expect(f.owner.metrics().recordings).toBe(before+1);}
  expect(f.tape.some(row=>row[0]==='draw'&&row[1]===9&&row[2]===7&&row[3]===3)).toBe(true);
 }finally{f.dispose();}
});

test('producer data writes reacquire the native path and disposal restores its original routing',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),before=vi.fn();a.onBeforeRender=before;
  f.render([a,b]);f.render([a,b]);expect(before).toHaveBeenCalledTimes(2);expect(f.owner.metrics().replays).toBe(1);
  a.geometry.attributes.position!.needsUpdate=true;f.bump();f.render([a,b]);expect(f.owner.metrics().recordings).toBe(2);
  f.owner.dispose();f.render([a,b]);expect(before).toHaveBeenCalledTimes(4);expect(f.owner.metrics()).toMatchObject({enabled:false,draws:6});
 }finally{f.dispose();}
});

test('shadow overrides, custom object routing, transparent and occlusion passes stay native',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b');f.scene.overrideMaterial=new MeshBasicNodeMaterial();f.render([a,b]);f.scene.overrideMaterial.dispose();f.scene.overrideMaterial=null;
  const route:unknown=Reflect.get(f.renderer,'_currentRenderObjectFunction');Reflect.set(f.renderer,'_currentRenderObjectFunction',(...args:unknown[])=>Reflect.apply(route as Function,f.renderer,args));f.render([a,b]);Reflect.set(f.renderer,'_currentRenderObjectFunction',route);
  (a.material as MeshBasicNodeMaterial).transparent=true;(b.material as MeshBasicNodeMaterial).transparent=true;f.render([a,b]);
  (a.material as MeshBasicNodeMaterial).transparent=false;(b.material as MeshBasicNodeMaterial).transparent=false;f.get(f.context).occlusionQuerySet={};f.render([a,b]);
  delete f.get(f.context).occlusionQuerySet;Reflect.set(f.renderer,'_handleObjectFunction',()=>{});f.render([a,b]);
  expect(f.owner.metrics()).toMatchObject({recordings:0,replays:0,draws:0});expect(f.counts().drawCalls).toBe(10);
 }finally{f.dispose();}
});

test('source epoch replay bypasses native object preparation and GPU handle validation while callbacks remain live',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),before=vi.fn(),after=vi.fn();a.onBeforeRender=before;b.onAfterRender=after;
  f.render([a,b]);const first=f.tape.slice();f.tape.length=0;const reads=f.gpuReads();f.render([a,b]);
  expect(f.tape).toEqual(first);expect(before).toHaveBeenCalledTimes(2);expect(after).toHaveBeenCalledTimes(2);
  expect(f.callbacks).toHaveLength(4);expect(f.gpuReads()-reads).toBe(1);expect(f.owner.metrics()).toMatchObject({recordings:1,replays:1,nativeObjectBypasses:2,signatureReads:0});expect(f.counts()).toEqual({drawCalls:4,triangles:32});
 }finally{f.dispose();}
});

test('real NodeFrame shared writers and shared buffer updates run on every source replay',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b');let updates=0;const node=new Node(),group=new UniformGroupNode('source-command-test',true,0,'render');node.updateType='render';node.update=()=>{updates++;return undefined;};f.shared.push(node,group);
  const binding={groupNode:group,update:vi.fn(()=>true),updateRanges:[]as unknown[],clearUpdateRanges(){this.updateRanges.length=0;}};f.sharedBindings.push(binding);
  f.render([a,b]);f.camera.position.x=7;f.render([a,b]);f.render([a,b]);
  expect(updates).toBe(3);expect(binding.update).toHaveBeenCalledTimes(3);expect(f.bindingUpdates()).toBe(3);expect(f.owner.metrics()).toMatchObject({nativeObjectBypasses:4,sharedNodeVisits:8,sharedBindingVisits:4});
 }finally{f.dispose();}
});

test('producer, program, exact membership and order changes reacquire native RenderObjects before recording',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),c=f.mesh('c');f.render([a,b]);f.render([a,b]);
  f.draws.get(a)!.parameters.instanceCount=5;f.bump();f.render([a,b]);expect(f.owner.metrics().recordings).toBe(2);
  f.programChange();f.render([a,b]);expect(f.owner.metrics().recordings).toBe(3);
  f.tape.length=0;f.render([c,b,a]);expect(f.owner.metrics().recordings).toBe(4);expect(f.tape.filter(row=>row[0]==='index').map(row=>row[1])).toEqual([c,b,a].map(mesh=>f.get(f.draws.get(mesh)!.index).buffer));
  f.render([c,b,a]);expect(f.owner.metrics().nativeObjectBypasses).toBe(5);
 }finally{f.dispose();}
});

test('late native shadow resource invalidation repairs once without repeating object callbacks or draw accounting',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),before=vi.fn(),after=vi.fn();a.onBeforeRender=before;b.onAfterRender=after;
  let late=false;const node=new Node();node.updateBeforeType='render';node.updateBefore=()=>{if(late){late=false;f.get(f.draws.get(a)!.binding).group={newShadowAtlas:true};f.bump();}return undefined;};f.before.push(node);
  f.render([a,b]);f.tape.length=0;late=true;f.render([a,b]);
  expect(before).toHaveBeenCalledTimes(2);expect(after).toHaveBeenCalledTimes(2);expect(f.counts()).toEqual({drawCalls:4,triangles:32});expect(f.owner.metrics()).toMatchObject({lateRepairs:1,recordings:2,replays:0});
  expect(f.tape.some(row=>row[0]==='group'&&(row[2]as {newShadowAtlas?:boolean})?.newShadowAtlas===true)).toBe(true);
 }finally{f.dispose();}
});

test('unproved native compiled draws never acquire the source replay shortcut',()=>{
 const f=fixture();try{const a=f.mesh('a'),b=f.mesh('b');f.certified(false);f.render([a,b]);f.render([a,b]);expect(f.owner.metrics()).toMatchObject({recordings:1,replays:0,uncertifiedRuns:1,nativeObjectBypasses:0,nativeNegativePasses:1});f.certified(true);f.bump();f.render([a,b]);f.render([a,b]);expect(f.owner.metrics()).toMatchObject({recordings:2,replays:1,nativeObjectBypasses:2});}finally{f.dispose();}
});

test('cached direct commands escape to actual per-pass indirect offsets and reacquire after direct restoration',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),storage=new IndirectStorageBufferAttribute(new Uint32Array(10),5);f.get(storage).buffer={indirect:true};let indirect=false;
  const before=vi.fn(()=>{a.geometry.setIndirect(indirect?storage:null,indirect?[0,20]:0);});a.onBeforeRender=before;
  f.render([a,b]);f.render([a,b]);expect(f.owner.metrics().replays).toBe(1);
  f.tape.length=0;indirect=true;f.render([a,b]);
  expect(before).toHaveBeenCalledTimes(3);expect(f.tape.filter(row=>row[0]==='indirect').map(row=>row[2])).toEqual([0,20]);expect(f.counts().drawCalls).toBe(6);expect(f.owner.metrics().lateRepairs).toBe(1);
  f.render([a,b]);indirect=false;f.render([a,b]);f.render([a,b]);f.render([a,b]);
  expect(before).toHaveBeenCalledTimes(7);expect(f.counts().drawCalls).toBe(14);expect(f.owner.metrics().replays).toBe(2);
 }finally{f.dispose();}
});

test('an indirect transition during first recording flushes only the direct prefix in native order',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b'),storage=new IndirectStorageBufferAttribute(new Uint32Array(5),5);f.get(storage).buffer={indirect:true};b.onBeforeRender=()=>b.geometry.setIndirect(storage,0);
  f.render([a,b]);expect(f.tape.filter(row=>row[0]==='draw'||row[0]==='indirect').map(row=>row[0])).toEqual(['draw','indirect']);
  expect(f.counts()).toEqual({drawCalls:2,triangles:16});expect(f.owner.metrics()).toMatchObject({replays:0,recordedDraws:1,fallbackDraws:1,uncertifiedRuns:1});
 }finally{f.dispose();}
});

test('per-pass indirect capability escapes a cached direct bundle even while the current pass is full-visible',()=>{
 const f=fixture();try{
  const a=f.mesh('a'),b=f.mesh('b');f.render([a,b]);f.render([a,b]);const before=f.owner.metrics().nativeObjectBypasses;
  markNativeIndirectGeometry(a.geometry);expect(a.geometry.indirect).toBeNull();f.render([a,b]);f.render([a,b]);
  expect(f.owner.metrics().nativeObjectBypasses).toBe(before);expect(f.counts().drawCalls).toBe(8);
 }finally{f.dispose();}
});

test('owned spatial producer replays the exact native indirect offsets and repairs only real camera selection changes',()=>{
 const f=fixture(),a=f.mesh('spatial'),b=f.mesh('ordinary'),before=vi.fn();a.onBeforeRender=before;
 const ranges=new SpatialInstanceRanges379(a,'indices',{register(){},dirty(){},forget(){}});
 Reflect.set(f.backend,'device',{features:new Set<string>()});Reflect.set(f.renderer,'_attributes',{update(attribute:object){f.get(attribute).buffer={indirect:attribute};},delete(){}});
 const move=(x:number,z:number)=>{f.camera.position.set(x,0,z);f.camera.lookAt(x,0,0);f.camera.updateProjectionMatrix();f.camera.updateMatrixWorld();};
 const offsets=()=>f.tape.filter(row=>row[0]==='indirect').map(row=>row[2]);
 try{
  expect(ranges.setRanges([-3,0,3,6].map((x,i)=>({first:i*9,count:9,bounds:new Box3(new Vector3(x-.1,-.1,-.1),new Vector3(x+.1,.1,.1))})))).toBe(true);
  move(0,10);f.render([a,b]);const original=offsets();expect(original.length).toBeGreaterThan(0);expect(original).toEqual(a.geometry.indirectOffset);
  f.tape.length=0;f.render([a,b]);expect(offsets()).toEqual(original);expect(f.owner.metrics()).toMatchObject({recordings:1,replays:1,indirectRecordedDraws:1,indirectReplayedDraws:1,spatialRepairs:0});
  move(6,10);f.tape.length=0;f.render([a,b]);expect(offsets()).toEqual(a.geometry.indirectOffset);expect(offsets()).not.toEqual(original);expect(f.owner.metrics()).toMatchObject({recordings:2,replays:1,spatialRepairs:1,lateRepairs:1});
  f.tape.length=0;f.render([a,b]);expect(offsets()).toEqual(a.geometry.indirectOffset);expect(f.owner.metrics().indirectReplayedDraws).toBe(2);
  move(0,30);f.tape.length=0;f.render([a,b]);expect(a.geometry.indirect).toBeNull();expect(offsets()).toEqual([]);expect(f.owner.metrics().spatialRepairs).toBe(2);
  expect(before).toHaveBeenCalledTimes(5);expect(f.counts()).toEqual({drawCalls:10,triangles:80});
  ranges.dispose();f.render([a,b]);expect(before).toHaveBeenCalledTimes(6);expect(f.owner.metrics().replays).toBe(2);
 }finally{ranges.dispose();f.dispose();}
});
