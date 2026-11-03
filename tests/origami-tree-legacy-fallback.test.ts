/** Real ResourceLayer geometry/material/range boundary. Synthetic Canvas pixels
 * only; no renderer/device, atlas raster, gameplay or visual-fidelity claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-paint-library',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stub.stubReferenceBakeToSink};});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>{const stub=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stub.stubCheckpointPaintToSink,replayCheckpointMaskR8:stub.stubReplayCheckpointMaskR8};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {TREE_SPECIES} from '../src/render/origami/baked/trees/recipe';
import type {TreeAssetCatalog} from '../src/render/origami/baked/trees/types';
import * as edgeWear from '../src/render/origami/reference-edges';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {Resource} from '../src/sim/types';

function fixture(){const resources:Resource[]=TREE_SPECIES.map((species,i)=>({id:1000+i,kind:'tree',species,x:5+i,z:8,amount:1,growth:.8}));resources.push({id:1100,kind:'tree',x:7,z:12,amount:1,growth:.8},{id:1101,kind:'tree',species:'oak',x:9,z:12,amount:1,growth:.8,blight:{since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:1}},{id:1200,kind:'rock',x:11,z:12,amount:1});return{width:32,height:32,tick:0,seed:123,site:{biome:'temperate-forest'},resources,structures:[],pawns:[{id:7,x:4,z:8,state:'working',jobId:91}],jobs:[{id:91,kind:'chop',x:5,z:8,status:'active',reservedBy:7,progress:0}]};}
type Input=ReturnType<typeof fixture>;
function update(layer:ResourceLayer,input:Input){const before=JSON.stringify(input);Reflect.apply(layer.update,layer,[input,true,undefined,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:false}),harvestable:()=>false}]);expect(JSON.stringify(input)).toBe(before);}
function meshes(group:THREE.Group,kind?:string){const out:THREE.Mesh[]=[];group.traverse(o=>{if(o instanceof THREE.Mesh&&(kind?o.userData.referenceCompanion===kind:!o.userData.referenceCompanion))out.push(o);});return out;}
function stream(group:THREE.Group,id:number,field:string){const out:number[]=[];for(const mesh of meshes(group)){const ranges=mesh.userData.resourceRanges as ResourceRangeData|undefined,a=mesh.geometry.getAttribute(field);if(!ranges||!a)continue;for(const range of ranges.ranges)if(range.id===id||range.id===-id*2)for(let i=range.start;i<range.start+range.count;i++)for(let c=0;c<a.itemSize;c++)out.push(a.getComponent(ranges.original[i]!,c));}return out;}
function make(context:GraphicsStyleContext){const group=new THREE.Group(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshStandardNodeMaterial({vertexColors:true}),environment=new EnvironmentLighting();plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint));return{group,layer,environment,dispose(){layer.dispose();plain.dispose();paint.dispose();environment.dispose();}};}

test('all real tree fallbacks keep Legacy forms/colors/ranges under missing/refused atlas, positive effects, blight and absent species, with Origami paint/ink and tree-only positive wear',()=>{
 const input=fixture(),originalInput=JSON.stringify(input),treeIds=input.resources.filter(r=>r.kind==='tree').map(r=>r.id),legacyContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default'}),legacy=make(legacyContext),expected=new Map<number,{position:number[];normal:number[];color:number[]}>();
 try{update(legacy.layer,input);for(const id of treeIds){expected.set(id,{position:stream(legacy.group,id,'position'),normal:stream(legacy.group,id,'normal'),color:stream(legacy.group,id,'color')});expect(expected.get(id)!.position.length).toBeGreaterThan(0);}}finally{legacy.dispose();legacyContext.dispose();}
 const wearFactory=vi.spyOn(edgeWear,'createPhysicalEdgeWearGeometry');
 try{for(const mode of ['not-prepared','catalog-missing-species','positive-effects'] as const){
  const positive=mode==='positive-effects',context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:positive?1:0,wear:positive?.75:0,edges:positive?.5:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6}),actual=make(context),texture=new THREE.DataTexture(new Uint8Array([255,255,255,255]),1,1),beforeWear=wearFactory.mock.calls.length;
  try{
   update(actual.layer,input);
   if(mode==='catalog-missing-species'){const missing:TreeAssetCatalog={revision:1,texture,pageCount:1,readReady:()=>undefined,assertCurrent:()=>{}};actual.layer.setTreeAssetCatalog(missing,actual.environment.configure).commit();}
   expect(actual.layer.bakedTreeStatus()).toMatchObject({ready:0,fallback:treeIds.length,total:treeIds.length});
   for(const id of treeIds){const prior=expected.get(id)!;expect(stream(actual.group,id,'position'),mode+':position:'+id).toEqual(prior.position);expect(stream(actual.group,id,'normal'),mode+':normal:'+id).toEqual(prior.normal);expect(stream(actual.group,id,'color'),mode+':color:'+id).toEqual(prior.color);}
   const body=meshes(actual.group),ink=meshes(actual.group,'lines'),wear=meshes(actual.group,'wear');expect(body.length).toBeGreaterThan(0);expect(ink.length).toBeGreaterThan(0);expect(body.every(m=>!m.geometry.hasAttribute('bakedUv'))).toBe(true);
   for(const mesh of body){expect(mesh.geometry.hasAttribute('origamiPaint')).toBe(true);expect(Array.isArray(mesh.material)).toBe(false);const material=mesh.material as THREE.NodeMaterial;expect(material.colorNode).not.toBeNull();expect(material.normalNode!==null).toBe(positive);}
   for(const mesh of ink){expect(Array.isArray(mesh.material)).toBe(false);expect((mesh.material as THREE.NodeMaterial).userData.origamiContour).toBe(true);expect(mesh.geometry.getAttribute('windRoot')).toBeDefined();}
   if(positive){expect(wearFactory.mock.calls.length).toBeGreaterThan(beforeWear);expect(wear.length).toBeGreaterThan(0);const worn=new Set<number>();for(const mesh of wear){expect(mesh.geometry.getAttribute('origamiWearExpand')).toBeDefined();expect(mesh.geometry.getAttribute('windRoot')).toBeDefined();const data=mesh.userData.resourceRanges as ResourceRangeData;for(const range of data.ranges){expect(range.id).not.toBe(1200);expect(range.id).not.toBe(-2400);for(const id of treeIds)if(range.id===id||range.id===-id*2)worn.add(id);}}expect([...worn].sort((a,b)=>a-b)).toEqual([...treeIds].sort((a,b)=>a-b));}
   else{expect(wearFactory.mock.calls.length).toBe(beforeWear);expect(wear).toHaveLength(0);}
   const geometryOwners=body.map(m=>m.geometry),first=treeIds[0]!,before=stream(actual.group,first,'position'),colors=treeIds.map(id=>stream(actual.group,id,'color'));
   actual.layer.setTargetPreview(new Set([first]));actual.layer.clearTargetPreview();expect(treeIds.map(id=>stream(actual.group,id,'color'))).toEqual(colors);expect(body.map(m=>m.geometry)).toEqual(geometryOwners);
   actual.layer.setWind(1,.6,.8);actual.layer.presentWind(123.25);expect(stream(actual.group,first,'position')).toEqual(before);
   const phase=7*1.7-1.5*Math.PI;let tick=2;while(Math.floor((11*tick/6+phase)/(2*Math.PI))===Math.floor((11*(tick-1)/6+phase)/(2*Math.PI)))tick++;const previous=structuredClone(input),next=structuredClone(input);previous.tick=tick-1;next.tick=tick;next.jobs[0]!.progress=1;const at=(Math.floor((11*tick/6+phase)/(2*Math.PI))*2*Math.PI-phase)/11;Reflect.apply(actual.layer.adoptChopWork,actual.layer,[previous,next]);actual.layer.presentChop(at+.09);expect(stream(actual.group,first,'position')).not.toEqual(before);actual.layer.clearChopRecoil();expect(stream(actual.group,first,'position')).toEqual(before);
   expect(JSON.stringify(input)).toBe(originalInput);
  }finally{actual.dispose();texture.dispose();context.dispose();}
 }}finally{wearFactory.mockRestore();}
});
