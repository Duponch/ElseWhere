// Actual Three node outputs and runtime material ownership, without a GPU.
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {PawnLayer} from '../src/render/PawnLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {sampleActorRoot} from '../src/render/ActorAnimationCache';
import {TICKS_PER_SECOND} from '../src/sim/types';
import {animalCombatCamp} from './scenarios/animal-combat';

type Surface=THREE.MeshStandardNodeMaterial;
type Body=THREE.Mesh<THREE.InstancedBufferGeometry,Surface>;

// Pinned Three r186 exposes these runtime methods, but not all of them in
// @types/three. Expanding a deferred Fn evaluates its actual TSL stack, without
// generating a shader or constructing a renderer. A ShaderCall's captures are
// NOT output dependencies: follow getOutputNode exclusively at that boundary.
interface InspectionBuilder {context:object;}
interface InspectionNode {
  getChildren?:()=>Iterable<InspectionNode>;
  getOutputNode?:(builder:InspectionBuilder)=>InspectionNode;
  jsFunc?:unknown;call?:()=>InspectionNode;
  isTextureNode?:boolean;sampler?:boolean;value?:unknown;
}
function outputNodes(root:unknown,mesh:Body):InspectionNode[] {
  const Constructor=THREE.NodeBuilder as unknown as new(object:Body)=>InspectionBuilder;
  const builder=new Constructor(mesh);builder.context={};
  const pending=[root as InspectionNode],seen=new Set<InspectionNode>();
  while(pending.length){
    const node=pending.pop()!;
    if(!node||seen.has(node))continue;seen.add(node);
    if(node.getOutputNode){pending.push(node.getOutputNode(builder));continue;}
    if(typeof node.jsFunc==='function'&&node.call){pending.push(node.call());continue;}
    if(node.getChildren)for(const child of node.getChildren())pending.push(child);
  }
  return [...seen];
}
function textureReads(root:unknown,mesh:Body):InspectionNode[] {
  return outputNodes(root,mesh).filter(node=>node.isTextureNode);
}
function body(layer:PawnLayer):Body {
  const mesh=layer.group.getObjectByName('Colonists — procedural eight-bone GPU rig');
  if(!(mesh instanceof THREE.Mesh))throw Error('Expected the actual resident PawnLayer body');
  return mesh as Body;
}
function selection(layer:PawnLayer):THREE.Mesh {
  const mesh=layer.group.getObjectByName('Selected colonists — shared GPU trajectories');
  if(!(mesh instanceof THREE.Mesh))throw Error('Expected the actual resident selection batch');
  return mesh;
}
function iso(pixels:number):THREE.OrthographicCamera {
  const view=new THREE.OrthographicCamera(-360/pixels,360/pixels,360/pixels,-360/pixels,.1,1000);
  view.position.set(10,30,30);view.lookAt(10,0,10);view.updateProjectionMatrix();return view;
}
function perspective():THREE.PerspectiveCamera {
  const view=new THREE.PerspectiveCamera(50,16/9,.1,1000);
  view.position.set(10,30,30);view.lookAt(10,0,10);view.updateProjectionMatrix();return view;
}
function setup(){
  const world=animalCombatCamp(),pawn=world.pawns[0]!;
  const edge={from:{x:10,z:10},to:{x:14,z:10},start:100,end:104};
  world.tick=101;Object.assign(pawn,{x:14,z:10,state:'moving',motion:edge,path:[]});
  const exact=JSON.stringify(world),detail=new AnimationDetail(),configured:THREE.NodeMaterial[]=[];
  const layer=new PawnLayer(material=>{configured.push(material);material.userData.nativePipelineProbe=true;},detail);
  const timeline=new MotionTimeline();timeline.tracks.set(pawn.id,[edge]);
  layer.update(world,1,true);layer.setSelected(new Set([pawn.id]));
  const frame=(ms:number,tick:number,view:THREE.Camera)=>{
    timeline.tick=tick;layer.time.value=(tick/TICKS_PER_SECOND)%(2*Math.PI);
    layer.updateTravel(world,timeline);layer.presentCargo(tick,world);
    detail.beginFrame(ms,view,720,tick);layer.presentAnimations();
  };
  return {world,pawn,exact,detail,layer,configured,frame};
}
const names=['aFrom','aTo','aTravel','aMotion','aCargo','aShape','aEquipment'] as const;
function streams(source:THREE.InstancedBufferGeometry){
  return names.map(name=>({name,attribute:source.getAttribute(name),values:Array.from(source.getAttribute(name).array)}));
}
function expectNativeGraph(material:Surface,detail:AnimationDetail,mesh:Body):void {
  const nodes=outputNodes(material.positionNode,mesh);
  expect(nodes.length).toBeGreaterThan(50); // A real authored rig, not an empty output.
  expect(nodes.filter(node=>node.isTextureNode)).toEqual([]);
  for(const uniform of [detail.enabled,detail.nearPixels,detail.farPixels,detail.projectionScale,detail.perspective])expect(nodes).not.toContain(uniform);
}

test('actual PawnLayer uses four configured material variants and native position outputs for near/OFF',()=>{
  const {world,exact,detail,layer,configured,frame}=setup();
  try{
    const mesh=body(layer),source=layer.feedbackSource!;
    const actorPalette=(layer.animationCache.cell(0) as unknown as {value:THREE.DataTexture}).value;
    frame(0,101,iso(30));const nativeTextured=mesh.material;
    expectNativeGraph(nativeTextured,detail,mesh);expect(textureReads(nativeTextured.colorNode,mesh).length).toBeGreaterThan(0);
    layer.setTexturesEnabled(false);const nativePlain=mesh.material;
    expect(nativePlain).not.toBe(nativeTextured);expectNativeGraph(nativePlain,detail,mesh);
    expect(textureReads(nativePlain.colorNode,mesh)).toEqual([]);

    frame(1,101,iso(16));const lodPlain=mesh.material;
    expect(lodPlain).not.toBe(nativePlain);
    expect(textureReads(lodPlain.positionNode,mesh).some(node=>node.sampler===false&&node.value===actorPalette)).toBe(true);
    expect(textureReads(lodPlain.colorNode,mesh)).toEqual([]);
    layer.setTexturesEnabled(true);const lodTextured=mesh.material;
    expect(lodTextured).not.toBe(lodPlain);expect(lodTextured.positionNode).toBe(lodPlain.positionNode);
    expect(textureReads(lodTextured.colorNode,mesh).length).toBeGreaterThan(0);
    expect(nativeTextured.positionNode).toBe(nativePlain.positionNode);
    expect(nativePlain.positionNode).not.toBe(lodPlain.positionNode);
    frame(2,101,iso(4));expect(mesh.material).toBe(lodTextured);
    frame(3,101,perspective());expect(mesh.material).toBe(lodTextured);

    detail.setSettings({...detail.settings,enabled:false});
    frame(4,101,perspective());expect(mesh.material).toBe(nativeTextured);
    frame(5,101,iso(4));expect(mesh.material).toBe(nativeTextured);
    layer.setTexturesEnabled(false);expect(mesh.material).toBe(nativePlain);
    expectNativeGraph(mesh.material,detail,mesh);
    const variants=[lodPlain,lodTextured,nativePlain,nativeTextured];
    expect(new Set(variants).size).toBe(4);
    for(const material of variants){
      expect(configured.filter(item=>item===material)).toHaveLength(1);
      expect(material.userData.nativePipelineProbe).toBe(true);expect(material.userData.rendererOwned).toBe(true);
    }
    expect(mesh.geometry).toBe(source);expect(layer.feedbackSource).toBe(source);
    expect(JSON.stringify(world)).toBe(exact);
  }finally{layer.dispose();}
});

test('material transitions preserve encoded edges, selected ownership and geometry while retained roots resume the current edge',()=>{
  const {world,pawn,exact,detail,layer,frame}=setup();
  try{
    frame(0,101,iso(16));const source=layer.feedbackSource!,mesh=body(layer),ring=selection(layer);
    const snapshot=streams(source),selected=ring.geometry.getAttribute('aSelected'),selectedValues=Array.from(selected.array);
    expect(selected.getX(0)).toBe(1);expect(source.userData.animationCache).toBe(layer.animationCache);
    const first=layer.presentedPose(pawn.id)!;expect(first).toBeDefined();expect(layer.animationCache.get(0,1,3)).toBe(1);
    frame(40,101.25,iso(16));expect(layer.presentedPose(pawn.id)).toEqual(first);
    frame(84,101.5,iso(16));const middle=layer.presentedPose(pawn.id)!;expect(middle.x).toBeGreaterThan(first.x);
    frame(85,101.5,iso(4));const far=layer.presentedPose(pawn.id)!;
    frame(400,103.5,iso(4));expect(layer.presentedPose(pawn.id)).toEqual(far);
    expect(layer.travelTime.value).toBe(103.5/TICKS_PER_SECOND);
    frame(401,103.5,iso(30));expect(layer.presentedPose(pawn.id)).toBeUndefined();expect(layer.animationCache.get(0,1,3)).toBe(0);
    const current=sampleActorRoot(source.getAttribute('aFrom'),source.getAttribute('aTo'),source.getAttribute('aTravel'),0,layer.travelTime.value,layer.blend.value);
    expect(current.x).toBeGreaterThan(far.x);
    frame(402,103.5,iso(16));const resumed=layer.presentedPose(pawn.id)!;
    for(const axis of ['x','y','z','yaw'] as const)expect(resumed[axis]).toBeCloseTo(current[axis],5);
    detail.setSettings({...detail.settings,enabled:false});frame(403,103.5,perspective());
    expect(layer.presentedPose(pawn.id)).toBeUndefined();expect(layer.animationCache.get(0,1,3)).toBe(0);
    expect(body(layer)).toBe(mesh);expect(mesh.geometry).toBe(source);expect(layer.feedbackSource).toBe(source);
    for(const item of snapshot){expect(source.getAttribute(item.name)).toBe(item.attribute);expect(Array.from(item.attribute.array)).toEqual(item.values);}
    expect(selection(layer)).toBe(ring);expect(ring.geometry.getAttribute('aSelected')).toBe(selected);expect(Array.from(selected.array)).toEqual(selectedValues);
    for(const name of ['aFrom','aTo','aTravel'])expect(ring.geometry.getAttribute(name)).toBe(source.getAttribute(name));
    expect(JSON.stringify(world)).toBe(exact);
  }finally{layer.dispose();}
});

// Since the grouped warm-up, every variant draws through a detached stand-in
// that shares the body attributes, index and user data (same render-object
// cache key as the body): one compilation per camera and ONE shadow warm-up
// cover all four variants. The body itself keeps its material throughout.
function standIns(object:THREE.Object3D,mesh:Body,source:THREE.InstancedBufferGeometry):Surface[]{
  expect(object).toBeInstanceOf(THREE.Group);expect(object.parent).toBe(mesh.parent);
  const children=object.children as Body[];
  for(const child of children){
    for(const [name,attribute] of Object.entries(source.attributes))expect(child.geometry.getAttribute(name)).toBe(attribute);
    expect(child.geometry.index).toBe(source.index);expect(child.geometry.userData).toBe(source.userData);expect(child.geometry.instanceCount).toBe(1);
    expect(child.castShadow).toBe(mesh.castShadow);expect(child.receiveShadow).toBe(mesh.receiveShadow);
  }
  return children.map(child=>child.material);
}
test('cold warm-up compiles the four body variants through stand-ins for both cameras and covers them with one shadow warm-up, then restores the active native choice',async()=>{
  const {world,exact,layer,frame}=setup();
  try{
    frame(0,101,iso(30));layer.setTexturesEnabled(false);
    const mesh=body(layer),source=layer.feedbackSource!,savedMaterial=mesh.material,scene=new THREE.Scene();scene.add(layer.group);
    const cameras=[iso(30),perspective()],colour:{materials:Surface[];camera:THREE.Camera}[]=[],shadows:Surface[][]=[];let group:THREE.Object3D|undefined;
    mesh.visible=false;source.instanceCount=0;
    const renderer={compileAsync:vi.fn(async(object:THREE.Object3D,camera:THREE.Camera,actualScene?:THREE.Scene)=>{
      expect(actualScene).toBe(scene);expect(mesh.visible).toBe(true);expect(source.instanceCount).toBe(1);expect(mesh.material).toBe(savedMaterial);
      group??=object;expect(object).toBe(group);colour.push({materials:standIns(object,mesh,source),camera});
    })};
    await layer.prepareBodyPipelines(renderer as unknown as THREE.WebGPURenderer,scene,cameras,async()=>{
      expect(mesh.visible).toBe(true);expect(source.instanceCount).toBe(1);expect(colour).toHaveLength(2);
      let inScene=false;scene.traverse(object=>{if(object===group)inScene=true;});expect(inScene).toBe(true);
      shadows.push(standIns(group!,mesh,source));
    });
    expect(renderer.compileAsync).toHaveBeenCalledTimes(2);expect(shadows).toHaveLength(1);
    const variants=shadows[0]!;expect(variants).toHaveLength(4);expect(new Set(variants).size).toBe(4);
    for(let view=0;view<2;view++)expect(colour[view]).toEqual({materials:variants,camera:cameras[view]});
    expect(group!.parent).toBeNull();
    expect(mesh.material).toBe(savedMaterial);expect(mesh.visible).toBe(false);expect(source.instanceCount).toBe(0);expect(mesh.geometry).toBe(source);
    // The warm-up cannot flip textures or the runtime native/LOD selection.
    expect(savedMaterial).toBe(variants[2]);layer.setTexturesEnabled(true);expect(mesh.material).toBe(variants[3]);
    expect(layer.feedbackSource).toBe(source);expect(JSON.stringify(world)).toBe(exact);
  }finally{layer.dispose();}
});

test.each(['colour','shadow'] as const)('warm-up restores material, visibility, instances and preferences after a %s rejection',async(failure)=>{
  const {world,exact,layer,frame}=setup();
  try{
    frame(0,101,iso(16));layer.setTexturesEnabled(false);
    const mesh=body(layer),source=layer.feedbackSource!,savedMaterial=mesh.material,scene=new THREE.Scene(),error=Error(`deliberate ${failure} warm rejection`);
    scene.add(layer.group);mesh.visible=false;source.instanceCount=0;
    let colours=0,shadows=0,group:THREE.Object3D|undefined;
    const renderer={compileAsync:vi.fn(async(object:THREE.Object3D)=>{group=object;colours++;if(failure==='colour'&&colours===2)throw error;})};
    await expect(layer.prepareBodyPipelines(renderer as unknown as THREE.WebGPURenderer,scene,[iso(30),perspective()],async()=>{
      shadows++;if(failure==='shadow')throw error;
    })).rejects.toBe(error);
    expect(colours).toBe(2);expect(shadows).toBe(failure==='colour'?0:1);expect(group!.parent).toBeNull();
    expect(mesh.material).toBe(savedMaterial);expect(mesh.visible).toBe(false);expect(source.instanceCount).toBe(0);expect(mesh.geometry).toBe(source);
    layer.setTexturesEnabled(true);const lodTextured=mesh.material;expect(lodTextured).not.toBe(savedMaterial);
    frame(1,101,iso(16));expect(mesh.material).toBe(lodTextured);
    layer.setTexturesEnabled(false);expect(mesh.material).toBe(savedMaterial);
    expect(layer.feedbackSource).toBe(source);expect(JSON.stringify(world)).toBe(exact);
  }finally{layer.dispose();}
});

test('disposing a body after both pipeline families were used destroys each of its four owned materials exactly once',()=>{
  const {layer,frame}=setup();
  const variants=new Set<Surface>(),disposals=new Map<Surface,number>();
  try{
    for(const [ms,pixels] of [[0,30],[1,16]] as const){
      frame(ms,101,iso(pixels));layer.setTexturesEnabled(true);variants.add(body(layer).material);
      layer.setTexturesEnabled(false);variants.add(body(layer).material);
    }
    expect(variants.size).toBe(4);
    for(const material of variants){disposals.set(material,0);material.addEventListener('dispose',()=>disposals.set(material,disposals.get(material)!+1));}
  }finally{layer.dispose();}
  for(const material of variants)expect(disposals.get(material)).toBe(1);
  expect(layer.group.children).toHaveLength(0);expect(layer.feedbackSource).toBeUndefined();
});

// Private addendum: append after the six cases in
// tests/pawn-native-pipeline-v331.test.ts; no extra imports are needed.
// These call the REAL Pawn mesh callback with real Three materials/scenes.
// They do not construct a renderer, draw, compile shaders or claim GPU proof.
function shadowOverrideForPawnTest():THREE.NodeMaterial & {isShadowPassMaterial:boolean} {
  const material=new THREE.NodeMaterial() as THREE.NodeMaterial & {isShadowPassMaterial:boolean};
  material.isShadowPassMaterial=true;
  return material;
}
function callPawnBeforeRender(mesh:Body,scene:THREE.Scene,camera:THREE.Camera):void {
  mesh.onBeforeRender({} as Parameters<Body['onBeforeRender']>[0],scene,camera,
    mesh.geometry,mesh.material,new THREE.Group());
}

test('Pawn shadow callback invalidates each real override once per source identity/version, with stable colour and shadow no-ops',()=>{
  const {world,exact,layer,frame}=setup(),scene=new THREE.Scene(),camera=iso(30);
  const shadows=[shadowOverrideForPawnTest(),shadowOverrideForPawnTest()],colourOverride=new THREE.NodeMaterial();
  try{
    const mesh=body(layer),variants:Surface[]=[];
    frame(0,101,iso(16));layer.setTexturesEnabled(false);variants.push(mesh.material);
    layer.setTexturesEnabled(true);variants.push(mesh.material);
    frame(1,101,camera);layer.setTexturesEnabled(false);variants.push(mesh.material);
    layer.setTexturesEnabled(true);variants.push(mesh.material);
    expect(new Set(variants).size).toBe(4);
    const source=layer.feedbackSource!,savedGeometry=mesh.geometry;
    const versions=shadows.map(material=>material.version);
    for(const variant of variants){
      mesh.material=variant;
      // A colour pass or an unrelated override cannot dirty any shadow.
      scene.overrideMaterial=null;callPawnBeforeRender(mesh,scene,camera);
      const colourVersion=colourOverride.version;
      scene.overrideMaterial=colourOverride;callPawnBeforeRender(mesh,scene,camera);
      expect(colourOverride.version).toBe(colourVersion);
      shadows.forEach((override,index)=>{
        expect(override.version).toBe(versions[index]);
        scene.overrideMaterial=override;
        callPawnBeforeRender(mesh,scene,camera);versions[index]++;
        expect(override.version).toBe(versions[index]);
        for(let repeat=0;repeat<3;repeat++)callPawnBeforeRender(mesh,scene,camera);
        expect(override.version).toBe(versions[index]);
      });
      expect(mesh.geometry).toBe(savedGeometry);expect(layer.feedbackSource).toBe(source);
    }
    // A revised graph under the SAME source identity must also invalidate.
    const stableSource=mesh.material;stableSource.needsUpdate=true;
    shadows.forEach((override,index)=>{
      scene.overrideMaterial=override;callPawnBeforeRender(mesh,scene,camera);versions[index]++;
      expect(override.version).toBe(versions[index]);
      callPawnBeforeRender(mesh,scene,camera);expect(override.version).toBe(versions[index]);
    });
    // Version changes must not update the stamp during a colour-only draw.
    stableSource.needsUpdate=true;scene.overrideMaterial=null;callPawnBeforeRender(mesh,scene,camera);
    expect(shadows.map(material=>material.version)).toEqual(versions);
    scene.overrideMaterial=shadows[0];callPawnBeforeRender(mesh,scene,camera);versions[0]++;
    expect(shadows[0].version).toBe(versions[0]);expect(shadows[1].version).toBe(versions[1]);
    expect(JSON.stringify(world)).toBe(exact);
  }finally{layer.dispose();shadows.forEach(material=>material.dispose());colourOverride.dispose();}
});

test('Pawn shadow stamps follow override identity across scenes and restart for a recreated mesh',()=>{
  const {world,exact,layer,frame}=setup(),camera=iso(30),first=new THREE.Scene(),second=new THREE.Scene();
  const a=shadowOverrideForPawnTest(),b=shadowOverrideForPawnTest();
  let replacement:ReturnType<typeof setup>|undefined,oldDisposed=false;
  try{
    frame(0,101,camera);const oldMesh=body(layer),oldSource=oldMesh.material;
    first.overrideMaterial=a;callPawnBeforeRender(oldMesh,first,camera);
    const firstVersion=a.version;
    second.overrideMaterial=a;callPawnBeforeRender(oldMesh,second,camera);
    expect(a.version).toBe(firstVersion); // Same override/source needs no new graph.
    second.overrideMaterial=b;const bBefore=b.version;callPawnBeforeRender(oldMesh,second,camera);
    expect(b.version).toBe(bBefore+1);expect(a.version).toBe(firstVersion);
    first.overrideMaterial=a;callPawnBeforeRender(oldMesh,first,camera);expect(a.version).toBe(firstVersion);

    // A new scene owner constructs a NEW mesh and source materials after the
    // old owner's disposal. Neither a stamp nor a graph may leak from it.
    layer.dispose();oldDisposed=true;replacement=setup();replacement.frame(1,101,camera);
    const freshMesh=body(replacement.layer);expect(freshMesh).not.toBe(oldMesh);expect(freshMesh.material).not.toBe(oldSource);
    callPawnBeforeRender(freshMesh,first,camera);expect(a.version).toBe(firstVersion+1);
    callPawnBeforeRender(freshMesh,first,camera);expect(a.version).toBe(firstVersion+1);
    second.overrideMaterial=b;callPawnBeforeRender(freshMesh,second,camera);expect(b.version).toBe(bBefore+2);
    expect(JSON.stringify(world)).toBe(exact);
    expect(JSON.stringify(replacement.world)).toBe(replacement.exact);
  }finally{if(!oldDisposed)layer.dispose();replacement?.layer.dispose();a.dispose();b.dispose();}
});
