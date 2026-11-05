/** Actual model and placement writers. ONLY the prepared GPU-owner callee is a
 * TEST double. No GPU bake, pixel, visual fidelity or timing claim is made. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import type {PreparedSurfaceVariant} from '../src/render/origami/baked/surfaces/PreparedSurfaceTypes';
vi.mock('../src/render/origami/baked/surfaces/PreparedSurfaceOwner',()=>({PREPARED_SURFACE_VARIANT:'preparedSurfaceVariant',PreparedSurfaceOwner:class TestPreparedOwner {
 readonly variants:PreparedSurfaceVariant[]=[];readonly contributions=new Map<unknown,Set<number>>();readonly materials:THREE.NodeMaterial[]=[];calls=0;registrations=0;closed=false;
 constructor(readonly options:{source:()=>{assertCurrent():void}}){}
 addTarget(options:{sourceMaterial:THREE.NodeMaterial}){const material=options.sourceMaterial.clone();this.materials.push(material);return material;}
 registerVariant(value:PreparedSurfaceVariant){this.registrations++;let id=this.variants.findIndex(v=>v.key===value.key);if(id<0){id=this.variants.length;this.variants.push(value);}return id;}
 setContribution(key:unknown,ids:Iterable<number>){this.calls++;this.contributions.set(key,new Set(ids));}
 status(){return{scope:'TEST owner boundary only',active:[...new Set([...this.contributions.values()].flatMap(v=>[...v]))]};}
 requestQualityRoute(){}attachGpuRetirement(){}
 dispose(){if(this.closed)return;this.options.source().assertCurrent();this.closed=true;for(const material of this.materials)material.dispose();}
 }}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {CropLayer} from '../src/render/CropLayer';
import {TimberCladdingLayer,timberCladdingParts} from '../src/render/TimberCladdingLayer';
import {RoofLayer} from '../src/render/RoofLayer';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import {createWorld} from '../src/sim/engine';
import type {Resource} from '../src/sim/types';
import {infectCrop} from '../src/sim/plant-blight';
import {cropHarness} from './crop-worker-fixtures-v433';
import {SceneResourceIndex} from '../src/render/scene-resource-index';
const preferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default' as const,impasto:0,wear:0};
type TestOwner={variants:PreparedSurfaceVariant[];contributions:Map<unknown,Set<number>>;calls:number;registrations:number;closed:boolean};
type Batch={kind:string;mesh:THREE.InstancedMesh;slots:Map<number,number>};
function field(){const world=createWorld(433,16,16);world.resources=[0,1,2].map((i):Resource=>({id:world.nextId++,kind:'rice',x:4+i,z:5,amount:8,growth:.3,growthTick:world.tick}));world.structures=[];return world;}
const batches=(layer:CropLayer)=>Reflect.get(layer,'batches') as Batch[];
const owner=(layer:CropLayer|TimberCladdingLayer)=>layer.preparedSurface as unknown as TestOwner;
function crop(){const context=new GraphicsStyleContext(preferences),pastel=createStylizedSurfaceTexture('vegetation'),plain=new THREE.MeshLambertNodeMaterial(),paint=new THREE.MeshLambertNodeMaterial({map:pastel}),layer=withGraphicsStyle(context,()=>new CropLayer(plain,paint,pastel));return{context,layer,dispose(){layer.dispose();paint.dispose();plain.dispose();pastel.dispose();context.dispose();}};}

test('actual crop growth/tint and writer transitions retain canonical IDs; leafless, retirements and recycling update only actual demand',()=>{
 const h=crop(),world=field(),o=owner(h.layer),index=new SceneResourceIndex();
 try{
  h.layer.update(world,true);const b=batches(h.layer).find(b=>b.kind==='rice')!,geometry=b.mesh.geometry,a=geometry.getAttribute('preparedSurfaceVariant') as THREE.InstancedBufferAttribute,material=b.mesh.material,ids=Array.from(a.array),version=a.version,calls=o.calls,registered=o.registrations;
  expect(o.variants).toHaveLength(12);expect([...o.contributions.get(b)!]).toHaveLength(1);
  world.resources[0]!.growth=.9;expect(infectCrop(world,world.resources[1]!,433)).toBe(true);h.layer.update(world,false);
  expect(a.version).toBe(version);expect(Array.from(a.array)).toEqual(ids);expect(o.calls).toBe(calls);expect(o.registrations).toBe(registered);
  // Unprepared immutable reader, then actual resident-column publication.
  h.layer.update(world,false,true);const wire=cropHarness(world),target=wire.send();h.layer.update(target,false,true,index.adopt(target));expect(a.version).toBe(version);expect(o.calls).toBe(calls);
  const leaf=world.resources[0]!;leaf.plantLife={since:world.tick,age:0,darkTicks:0,nextCheck:world.tick+1,leaflessAt:world.tick};h.layer.update(world,false);
  expect([...o.contributions.get(b)!]).toHaveLength(2);expect(a.getX(b.slots.get(leaf.id)!)).not.toBe(ids[0]);expect(o.registrations).toBe(registered);
  for(const style of['origami','default','origami'] as const){h.context.update({...h.context.preferences,style});h.layer.setTexturesEnabled(false);h.layer.setTexturesEnabled(true);expect(b.mesh.material).toBe(material);expect(b.mesh.geometry).toBe(geometry);}
  world.resources=[];h.layer.update(world,false);expect(o.contributions.get(b)!.size).toBe(0);const emptyCalls=o.calls,restore=h.layer.prepareForCompile();restore();expect(o.calls).toBe(emptyCalls);expect(o.contributions.get(b)!.size).toBe(0);
  world.resources=[{id:world.nextId++,kind:'rice',x:7,z:5,amount:8,growth:.2,growthTick:world.tick}];h.layer.update(world,false);expect([...o.contributions.get(b)!]).toEqual([ids[0]]);expect(o.registrations).toBe(registered);
 }finally{index.clear();h.dispose();}expect(o.closed).toBe(true);
});

test('real crop capacity growth preserves sparse variant IDs and stays within eight actual vertex buffers',()=>{
 const h=crop(),world=field(),o=owner(h.layer);
 try{
  h.layer.update(world,false);const b=batches(h.layer).find(b=>b.kind==='rice')!,first=b.mesh.geometry.getAttribute('preparedSurfaceVariant').getX(0);world.resources[0]!.plantLife={since:world.tick,age:0,darkTicks:0,nextCheck:1,leaflessAt:world.tick};h.layer.update(world,false);const leaf=b.mesh.geometry.getAttribute('preparedSurfaceVariant').getX(0);expect(leaf).not.toBe(first);
  for(let i=3;i<140;i++)world.resources.push({id:world.nextId++,kind:'rice',x:2+i%12,z:2+Math.floor(i/12),amount:8,growth:.3,growthTick:world.tick});h.layer.update(world,false,true);
  const a=b.mesh.geometry.getAttribute('preparedSurfaceVariant');expect(a.count).toBeGreaterThanOrEqual(140);expect(a.getX(0)).toBe(leaf);expect(a.getX(139)).toBe(first);expect(o.variants).toHaveLength(12);
  const buffers=new Set<unknown>();for(const attribute of Object.values(b.mesh.geometry.attributes))buffers.add(attribute instanceof THREE.InterleavedBufferAttribute?attribute.data:attribute);buffers.add(b.mesh.instanceMatrix);buffers.add(b.mesh.instanceColor);expect(buffers.size).toBeLessThanOrEqual(8);
 }finally{h.dispose();}
});

const wood=(id:number,x:number,z:number)=>({id,x,z,kind:'wall' as const,material:'wood' as const,orientation:0 as const,footprint:'legacy-single' as const});
test('timber retains every Source placement/colour and exact normalized metric, sharing charts across positions and cutaway returns',()=>{
 const context=new GraphicsStyleContext(preferences),layer=withGraphicsStyle(context,()=>new TimberCladdingLayer()),world=createWorld(7,16,16),o=owner(layer),matrix=new THREE.Matrix4(),object=new THREE.Object3D(),color=new THREE.Color();world.structures=[wood(101,3,4),{...wood(102,4,4),kind:'door'},wood(103,5,4)];
 const check=(cutaway:boolean)=>{layer.update(world,cutaway);const parts=timberCladdingParts(world,cutaway);for(const[mesh,placements]of[[layer.wallMesh,parts.walls],[layer.eaveMesh,parts.eaves]]as const){expect(mesh.activeCount).toBe(placements.length);const a=mesh.geometry.getAttribute('preparedSurfaceVariant');for(let i=0;i<placements.length;i++){const p=placements[i]!,v=o.variants[a.getX(i)]!,x=p.sx??1,y=p.sy??1,z=p.sz??1,largest=Math.max(x,y,z);expect(v.linear).toEqual([x/largest,0,0,0,y/largest,0,0,0,z/largest]);object.position.set(p.x,p.y,p.z);object.rotation.set(0,p.ry??0,0);object.scale.set(x,y,z);object.updateMatrix();mesh.getMatrixAt(i,matrix);expect(matrix.elements).toEqual(Array.from(new Float32Array(object.matrix.elements)));mesh.getColorAt(i,color);expect(color.toArray()).toEqual(Array.from(new Float32Array([p.tint,p.tint,p.tint])));}}};
 try{check(false);const count=o.registrations,material=layer.material,wall=layer.wallMesh,eave=layer.eaveMesh;world.structures=world.structures.map(s=>({...s,x:s.x+3,z:s.z+2}));check(false);expect(o.registrations).toBe(count);check(true);const cutCount=o.registrations;check(false);expect(o.registrations).toBe(cutCount);expect(layer.wallMesh).toBe(wall);expect(layer.eaveMesh).toBe(eave);for(const style of['origami','default']as const){context.update({...context.preferences,style});layer.setTexturesEnabled(false);layer.setTexturesEnabled(true);expect(layer.wallMesh.material).toBe(material);}}
 finally{layer.dispose();context.dispose();}expect(o.closed).toBe(true);
});

test('continuous absolute-world roof explicitly retains Source and refuses a false prepared-quality witness',()=>{
 const context=new GraphicsStyleContext(preferences),layer=withGraphicsStyle(context,()=>new RoofLayer());
 try{const geometry=layer.mesh.geometry,material=layer.mesh.material;expect(layer.preparedSurfaceStatus()).toMatchObject({representation:'source',fallback:'continuous-world-roof-no-canonical-domain',atlasLayers:0});expect(()=>layer.requestPreparedSurfaceQualityRoute('prepared')).toThrow('no admitted canonical');layer.requestPreparedSurfaceQualityRoute('source');expect(layer.mesh.geometry).toBe(geometry);expect(layer.mesh.material).toBe(material);expect(layer.mesh.geometry.hasAttribute('preparedSurfaceVariant')).toBe(false);}
 finally{layer.dispose();context.dispose();}
});
