/** Preparation/cold-program contracts only. No device, atlas, pixels or timing. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import {attribute,positionLocal,positionView,texture,varying,vec2} from 'three/tsl';
import {createWorld} from '../src/sim/engine';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {RockLayer} from '../src/render/RockLayer';
import {ROCK_SURFACE_UV} from '../src/render/models/RockSurfaceModel';
import {RockStrokeTable} from '../src/render/surfaces/RockStrokeTable';
import {prepareAffineEdge,prepareAffineInteriorCircle} from '../src/render/surfaces/AffineStrokeOwner';
import {createPreparedAffineStrokeNode,preparedAffineInteriorCircleVertex} from '../src/render/surfaces/AffineStrokeKernel';
import {faceStrokeVertexHeaders} from '../src/render/surfaces/FaceStrokeTable';
import {createRockFinalAffineSnapshot,rockFinalBakeAlbedoNode,type RockFinalCanonicalInput} from '../src/render/surfaces/RockFinalSource';
import {settlePreparedStrokes} from './fixtures/settle-prepared-strokes';
import {writeTestFileSync} from './test-output';
const MiB=1024*1024;

function fixture(){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),layer=withGraphicsStyle(context,()=>new RockLayer()),world=createWorld(42,32,32);
 world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(const[x,z]of [[12,12],[13,12],[12,13]]as const)world.tiles[z*32+x]={terrain:'rock',stone:'granite'};
 layer.update(world,true);settlePreparedStrokes(context);layer.setDistant(true);
 const table=Reflect.get(layer,'stroke')as RockStrokeTable,geometry=layer.mesh.geometry,face=geometry.getAttribute(ROCK_SURFACE_UV),active=new Set<number>();
 for(let at=36;at<geometry.drawRange.count;at++)active.add(face.getZ(geometry.index!.getX(at)));
 const faceId=Uint32Array.from([...active].sort((a,b)=>a-b)),faceHeader=new Float32Array(faceId.length*8),faceEdgeOffset=new Uint32Array(faceId.length+1),rows=table.values;let count=0;
 for(let dense=0;dense<faceId.length;dense++){const id=faceId[dense]!;faceHeader.set(rows.subarray(id*8,id*8+8),dense*8);faceEdgeOffset[dense]=count;count+=rows[id*8+1]!;}faceEdgeOffset[faceId.length]=count;
 const canonicalEdges=new Float32Array(count*36);for(let dense=0;dense<faceId.length;dense++){const at=faceId[dense]!*8,start=rows[at]!*4,n=rows[at+1]!*36;canonicalEdges.set(rows.subarray(start,start+n),faceEdgeOffset[dense]!*36);}
 const captured=table.stats.patches,input:RockFinalCanonicalInput={faceId,faceHeader,faceEdgeOffset,canonicalEdges,revision:()=>String(table.stats.patches),assertCurrent(){table.assertCurrent();if(table.stats.patches!==captured)throw Error('Actual fixture Source changed');}};
 return{context,flush,layer,table,geometry,input,close(){layer.dispose();context.dispose();flush.mockRestore();}};
}

test('fresh dense Rock snapshot preserves actual canonical floats/order and new settings without touching the published Source owner',()=>{
 const f=fixture(),published=f.context.preparedStrokes.acquire(f.table)!,original=f.table.values.slice(),publishedBytes=(published.buffer.array as Float32Array).slice(),snapshot=createRockFinalAffineSnapshot(f.input,{width:5,irregularity:1},{maxCpuBytes:16*MiB,maxBindingBytes:8*MiB});
 try{
  expect(snapshot.owner).not.toBe(published);expect(snapshot.owner.buffer).not.toBe(published.buffer);expect(snapshot.settings).toEqual({width:5,irregularity:1});expect(snapshot.owner.width.value).toBe(5);expect(snapshot.owner.irregularity.value).toBe(1);expect(published.width.value).toBe(Math.fround(1.7));expect(published.irregularity.value).toBe(Math.fround(.15));
  expect(snapshot.denseToSource).toEqual(f.input.faceId);expect(snapshot.peakPreparationCpuBytes).toBeLessThanOrEqual(16*MiB);expect(snapshot.cpuBytes).toBeLessThanOrEqual(snapshot.peakPreparationCpuBytes);expect(snapshot.potentialPreparedGpuBytes).toBe(snapshot.owner.buffer.array.byteLength);
  for(let dense=0;dense<f.input.faceId.length;dense++){
   const sourceId=f.input.faceId[dense]!,header=snapshot.canonical.values.subarray(dense*8,dense*8+8),old=f.input.faceHeader.subarray(dense*8,dense*8+8),first=f.input.faceEdgeOffset[dense]!,last=f.input.faceEdgeOffset[dense+1]!;expect(snapshot.denseFaceId(sourceId)).toBe(dense);expect(header.subarray(1)).toEqual(old.subarray(1));expect(snapshot.canonical.values.subarray(header[0]!*4,header[0]!*4+(last-first)*36)).toEqual(f.input.canonicalEdges.subarray(first*36,last*36));
   const prepared=Array.from({length:last-first},(_,i)=>prepareAffineEdge(f.input.canonicalEdges.subarray((first+i)*36,(first+i+1)*36),snapshot.settings));if(prepared.length)prepared[0]!.set(prepareAffineInteriorCircle(prepared),32);
   for(let i=0;i<prepared.length;i++)expect((snapshot.owner.buffer.array as Float32Array).subarray(header[0]!*4+i*36,header[0]!*4+(i+1)*36)).toEqual(prepared[i]);
  }
  expect(f.table.values).toEqual(original);expect(published.buffer.array).toEqual(publishedBytes);expect(()=>snapshot.denseFaceId(0xffffffff)).toThrow('absent');
  expect(()=>createRockFinalAffineSnapshot(f.input,{width:5,irregularity:1},{maxCpuBytes:1,maxBindingBytes:8*MiB})).toThrow('BEFORE allocation');
  const bad={...f.input,faceEdgeOffset:f.input.faceEdgeOffset.slice()};bad.faceEdgeOffset[1]=0xffffffff;expect(()=>createRockFinalAffineSnapshot(bad,{width:1.7,irregularity:.15},{maxCpuBytes:16*MiB,maxBindingBytes:8*MiB})).toThrow();
 }finally{snapshot.dispose();f.close();}
 expect(()=>snapshot.assertCurrent()).toThrow('retired');
});

interface Inspector{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;build():void;getBindings():{bindings:{isSampledTexture?:boolean;isStorageBuffer?:boolean;texture?:THREE.Texture;attribute?:THREE.StorageBufferAttribute}[]}[];}
test('shared Rock body/affine factories compile the exact original Source program with the same textures, material and actual geometry',()=>{
 const f=fixture(),owner=f.context.preparedStrokes.acquire(f.table)!,renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU in Source cold contract');});renderer.hasFeature=()=>false;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();scene.add(f.layer.mesh);scene.updateMatrixWorld(true);
 const material=f.layer.mesh.material as THREE.MeshStandardNodeMaterial,geometry=f.layer.mesh.geometry,stone=Reflect.get(f.layer,'stonePaint')as THREE.DataTexture,oldColor=material.colorNode,uuid=material.uuid,sourceAttributes={...geometry.attributes},Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector;
 const build=(shared:boolean)=>{
  const base=attribute('color','vec3'),surface=attribute(ROCK_SURFACE_UV,'vec3'),headers=faceStrokeVertexHeaders({table:owner.headerTable(),faceId:surface.z,enabled:f.context.surfaceEncoding,opacity:f.context.lineOpacity,readRow:owner.readRow},'v_rockStrokeHeader'),interiorCircle=preparedAffineInteriorCircleVertex({owner,faceId:surface.z,enabled:f.context.surfaceEncoding,opacity:f.context.lineOpacity}),options={owner,headers,interiorCircle,faceId:surface.z,faceUv:surface.xy,enabled:f.context.surfaceEncoding,opacity:f.context.lineOpacity,brushColor:f.context.brushColor.rgb,samplePigment:(p:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>f.context.sampleStrokePigment(p,dx,dy),sampleDry:(p:THREE.Node<'vec2'>,dx:THREE.Node<'vec2'>,dy:THREE.Node<'vec2'>)=>f.context.sampleStrokeDry(p,dx,dy)};
  material.colorNode=shared?rockFinalBakeAlbedoNode({positionForStone:positionLocal,vertexColor:base,stonePaint:stone,physicalSurfacePosition:positionView,stroke:options}):createPreparedAffineStrokeNode(base.mul(texture(stone,varying(positionLocal.xz.mul(.026).add(positionLocal.y.mul(vec2(.009,.007))))).rgb),options);const builder=new Builder(f.layer.mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();return builder;
 };
 try{
  expect(stone.image).toMatchObject({width:256,height:256});expect(stone.colorSpace).toBe(THREE.NoColorSpace);expect(stone.wrapS).toBe(THREE.RepeatWrapping);expect(stone.wrapT).toBe(THREE.RepeatWrapping);expect(stone.minFilter).toBe(THREE.LinearMipmapLinearFilter);expect(stone.magFilter).toBe(THREE.LinearFilter);expect(material.roughness).toBe(.93);expect(material.metalness).toBe(0);
  const reference=build(false),shared=build(true);writeTestFileSync('artifacts/rock-final-source-reference-vertex.wgsl',reference.vertexShader);writeTestFileSync('artifacts/rock-final-source-reference-fragment.wgsl',reference.fragmentShader);writeTestFileSync('artifacts/rock-final-source-shared-vertex.wgsl',shared.vertexShader);writeTestFileSync('artifacts/rock-final-source-shared-fragment.wgsl',shared.fragmentShader);
  expect(shared.vertexShader).toBe(reference.vertexShader);expect(shared.fragmentShader).toBe(reference.fragmentShader);
  const bindings=(b:Inspector)=>b.getBindings().flatMap(g=>g.bindings);expect(bindings(shared).filter(b=>b.isSampledTexture).map(b=>b.texture)).toEqual(bindings(reference).filter(b=>b.isSampledTexture).map(b=>b.texture));expect(new Set(bindings(shared).filter(b=>b.isStorageBuffer).map(b=>b.attribute))).toEqual(new Set([owner.buffer]));expect(bindings(shared).some(b=>b.attribute===f.table.buffer)).toBe(false);
  expect(material.uuid).toBe(uuid);expect(f.layer.mesh.geometry).toBe(geometry);for(const[name,a]of Object.entries(sourceAttributes))expect(geometry.getAttribute(name)).toBe(a);expect(init).not.toHaveBeenCalled();
 }finally{material.colorNode=oldColor;f.layer.mesh.removeFromParent();f.close();init.mockRestore();}
},60000);
