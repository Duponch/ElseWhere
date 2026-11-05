import {settlePreparedStrokes} from './fixtures/settle-prepared-strokes';
/** Real Source brush triangles are the coverage oracle. This finite CPU raster
 * and cold WGSL contract assert no Native pixel, GPU-time or quality result. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {RockSurfaceModel,ROCK_SURFACE_UV,ROCK_SURFACE_VERTICES} from '../src/render/models/RockSurfaceModel';
import {RockStrokeTable} from '../src/render/surfaces/RockStrokeTable';
import {classifyFaceStrokeGate,faceStrokeGateDistance,FACE_STROKE_EDGE_FLOATS,type FaceStrokeGateKind} from '../src/render/surfaces/FaceStrokeTable';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';
import {RockLayer} from '../src/render/RockLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {writeTestFileSync} from './test-output';

const bounds=[0,0,1,1]as const;
function baseRecord(a:readonly[number,number],b:readonly[number,number]){const record=new Float32Array(FACE_STROKE_EDGE_FLOATS);for(let v=0;v<6;v++){const t=Math.floor(v/2)*.5;record[v*6]=a[0]+t*(b[0]-a[0]);record[v*6+1]=a[1]+t*(b[1]-a[1]);}return record;}
function fixture(){const world=createWorld(42,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));const cells:number[]=[];for(let z=12;z<=16;z++)for(let x=12;x<=16;x++){const cell=z*world.width+x;cells.push(cell);world.tiles[cell]={terrain:'rock',stone:'granite'};}for(const[x,z]of [[8,8],[19,19]]as const){cells.push(z*32+x);world.tiles[z*32+x]={terrain:'rock',stone:'granite'};}return{world,cells};}

test('gate classifications use all actual Source bases, retain both diagonals and bypass unknown edges',()=>{
 const main=baseRecord([0,0],[1,1]),anti=baseRecord([0,1],[1,0]),axis=baseRecord([0,0],[0,1]),both=new Float32Array([...main,...anti]),unknown=baseRecord([.2,.3],[.7,.8]);
 expect(classifyFaceStrokeGate(axis,bounds).kind).toBe(1);expect(classifyFaceStrokeGate(main,bounds).kind).toBe(2);expect(classifyFaceStrokeGate(anti,bounds).kind).toBe(3);expect(classifyFaceStrokeGate(both,bounds).kind).toBe(4);expect(classifyFaceStrokeGate(unknown,bounds).kind).toBe(0);expect(faceStrokeGateDistance([.5,.5],bounds,0)).toBe(-Infinity);
 // Endpoints alone are insufficient. A displaced real midpoint must prevent
 // classification, even though both endpoints remain on the same diagonal.
 const bent=main.slice();bent[2*6+1]=bent[2*6+1]!+.1;expect(classifyFaceStrokeGate(bent,bounds).kind).toBe(0);
 const near=main.slice();for(let v=0;v<6;v++)near[v*6+1]=near[v*6+1]!+1e-6;const tolerated=classifyFaceStrokeGate(near,bounds);expect(tolerated.kind).toBe(2);expect(tolerated.deviation).toBeGreaterThan(0);expect(tolerated.deviation).toBeLessThan(1e-5);
 expect(faceStrokeGateDistance([.5,.5],bounds,2)).toBe(0);expect(faceStrokeGateDistance([.5,.5],bounds,3)).toBe(0);expect(faceStrokeGateDistance([.5,.2],bounds,2)).toBeCloseTo(.15);expect(faceStrokeGateDistance([.5,.2],bounds,3)).toBeCloseTo(.15);
});

test('actual rock brush pixels, shared seams and corner triangles survive the gate at every width/roughness extreme and after mining',()=>{
 const original=fixture(),states=([.5,1.7,5]as const).flatMap(width=>([0,.15,1]as const).map(rough=>[width,rough]as const)),misses:unknown[]=[],hits=new Array<number>(states.length).fill(0);let diagonalFaces=0,rejectedInterior=0,sourceTriangles=0;
 for(const mined of [false,true]){
  const world=mined?{...original.world,tiles:original.world.tiles.slice()}:original.world;if(mined)world.tiles[14*32+14]={terrain:'soil'};
  const model=new RockSurfaceModel(32,32,32),table=new RockStrokeTable(),active:number[][]=[],logical=new Map<number,number>();let source:THREE.BufferGeometry|undefined;
  try{
   table.reset(32,32);table.bindModel(model);
   for(let slot=0;slot<original.cells.length;slot++){table.bindCell(model,slot);active.push(model.writeCell(world,original.cells[slot]!,slot));const uv=model.geometry.getAttribute(ROCK_SURFACE_UV);let previous=-1,local=0;for(let i=0;i<ROCK_SURFACE_VERTICES;i++){const id=uv.getZ(model.vertex(slot)+i);if(id!==previous){logical.set(id,model.face(slot)+local++);previous=id;}}expect(local).toBe(14);}
   const patches=original.cells.map((cell,slot)=>table.prepareCell(model,slot,original.cells.flatMap((other,s)=>Math.abs(other%32-cell%32)<=1&&Math.abs(Math.floor(other/32)-Math.floor(cell/32))<=1?[{slot:s,count:active[s]!.length}]:[])));table.commit(patches);
   // Generate the independent oracle over the complete real neighbourhood,
   // retaining the Source's global index offsets, order and random seeds.
   model.stock.clearGroups();for(let slot=0;slot<active.length;slot++)if(active[slot]!.length)model.stock.addGroup(model.stockOffset(slot),active[slot]!.length,0);source=createOrigamiBrushGeometry(model.stock);
   const values=table.values,tag=source.getAttribute(ROCK_SURFACE_UV),base=source.userData.referenceBrushBasePositions as Float32Array,index=source.index!,point=new THREE.Vector3(),projectors=new Map<number,ReturnType<RockSurfaceModel['projector']>>();
   const present=new Set<number>();for(let first=0;first<tag.count;first+=6){const face=tag.getZ(first),a=new THREE.Vector3().fromArray(base,first*3),b=new THREE.Vector3().fromArray(base,(first+4)*3);projectors.set(first,model.projector(logical.get(face)!,[a,b]));present.add(face);}
   for(const face of present){const at=face*8,kind=values[at+7]!as FaceStrokeGateKind;expect(kind).toBeGreaterThan(0);if(kind>=2){diagonalFaces++;for(let y=1;y<16;y++)for(let x=1;x<16;x++)if(faceStrokeGateDistance([x/16,y/16],bounds,kind)>values[at+6]!)rejectedInterior++;}}
   const triangles=[[0,2,3],[0,3,1],[2,4,5],[2,5,3]]as const;
   for(let state=0;state<states.length;state++){
    const[width,rough]=states[state]!;updateOrigamiBrushGeometry(source,width,rough);const position=source.getAttribute('position');
    for(let first=0;first<tag.count;first+=6){const face=tag.getZ(first),at=face*8,kind=values[at+7]!as FaceStrokeGateKind,inset=values[at+6]!,project=projectors.get(first)!,p=Array.from({length:6},(_,v)=>project(point.fromBufferAttribute(position,first+v),false));
     for(const ids of triangles){sourceTriangles++;const[a,b,c]=ids.map(i=>p[i]!)as[readonly[number,number],readonly[number,number],readonly[number,number]],bx=b[0]-a[0],by=b[1]-a[1],cx=c[0]-a[0],cy=c[1]-a[1],det=bx*cy-cx*by;if(Math.abs(det)<=1e-20)continue;
      const check=(uv:readonly[number,number])=>{hits[state]=hits[state]!+1;const distance=faceStrokeGateDistance(uv,bounds,kind);if(distance>inset&&misses.length<8)misses.push({mined,width,rough,face,uv,distance,inset,kind});};
      // Actual strip corners, all three triangle seams and its centroid.
      for(const bary of [[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[.5,0,.5],[0,.5,.5],[1/3,1/3,1/3]]as const)check([a[0]*bary[0]+b[0]*bary[1]+c[0]*bary[2],a[1]*bary[0]+b[1]*bary[1]+c[1]*bary[2]]);
      // Pixel centres inside the Source triangles, including diagonal strips.
      const left=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])*64-.5)),right=Math.min(63,Math.floor(Math.max(a[0],b[0],c[0])*64-.5)),top=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])*64-.5)),bottom=Math.min(63,Math.floor(Math.max(a[1],b[1],c[1])*64-.5));
      for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){const u=(x+.5)/64,v=(y+.5)/64,dx=u-a[0],dy=v-a[1],s=(dx*cy-dy*cx)/det,t=(dy*bx-dx*by)/det;if(s>=-1e-6&&t>=-1e-6&&s+t<=1+1e-6)check([u,v]);}
     }
    }
   }
   expect(index.count).toBe(tag.count/6*12); // Four original triangles per six-vertex strip.
  }finally{source?.dispose();table.dispose();model.dispose();}
 }
 expect(misses).toEqual([]);expect(hits.every(count=>count>0)).toBe(true);expect(diagonalFaces).toBeGreaterThan(0);expect(rejectedInterior).toBeGreaterThan(0);
 writeTestFileSync('artifacts/rock-stroke-gate-source-raster.json',JSON.stringify({states,hits,sourceTriangles,diagonalFaces,rejectedInterior,misses,scope:'Finite CPU Source-triangle coverage only; not Native quality or GPU timing'})+'\n');
},60000);

interface Inspector{scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;lightsNode:THREE.LightsNode;vertexShader:string;fragmentShader:string;varyings:{name:string;needsInterpolation:boolean}[];build():void;getBindings():{bindings:{name:string;isStorageBuffer?:boolean;isSampledTexture?:boolean;visibility:number;texture?:THREE.Texture;attribute?:THREE.StorageBufferAttribute}[]}[];getAttributesArray():{name:string;node?:{attribute?:THREE.BufferAttribute|THREE.InterleavedBufferAttribute}}[];}
test('actual common RockLayer gate still compiles cold with one contiguous storage binding and no added texture or geometry',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0}),flush=vi.spyOn(context,'flushPaint').mockImplementation(()=>{}),layer=withGraphicsStyle(context,()=>new RockLayer()),renderer=new THREE.WebGPURenderer({canvas:{width:960,height:600,style:{}}as HTMLCanvasElement}),init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU in cold gate contract');});renderer.hasFeature=()=>false;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
 const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,100),sun=new THREE.DirectionalLight(),sky=new THREE.HemisphereLight();scene.add(sun,sky);camera.position.set(3,4,6);camera.lookAt(0,1,0);camera.updateMatrixWorld();const warning=vi.spyOn(console,'warn');
 try{
  layer.update(fixture().world,true);settlePreparedStrokes(context);const canonical=Reflect.get(layer,'stroke')as RockStrokeTable,prepared=context.preparedStrokes.acquire(canonical)!;layer.setDistant(true);scene.add(layer.mesh);scene.updateMatrixWorld(true);const geometry=layer.mesh.geometry,material=layer.mesh.material,Builder=THREE.WGSLNodeBuilder as unknown as new(o:THREE.Object3D,r:THREE.WebGPURenderer)=>Inspector,builder=new Builder(layer.mesh,renderer);builder.scene=scene;builder.camera=camera;builder.material=material as THREE.Material;builder.lightsNode=new THREE.LightsNode().setLights([sun,sky]);builder.build();
  const bindings=builder.getBindings().flatMap(group=>group.bindings),storage=bindings.filter(b=>b.isStorageBuffer),textures=bindings.filter(b=>b.isSampledTexture),attributes=builder.getAttributesArray().map(a=>a.node?.attribute??geometry.getAttribute(a.name)).filter((a):a is THREE.BufferAttribute|THREE.InterleavedBufferAttribute=>!!a),buffers=new Set(attributes.map(a=>a instanceof THREE.InterleavedBufferAttribute?a.data:a)),stone=Reflect.get(layer,'stonePaint')as THREE.Texture,pigment=(Reflect.get(context,'banks')as THREE.Texture[])[0]!,dry=(Reflect.get(context,'edgeMaps')as{alpha:THREE.Texture}).alpha;
  // Record evidence before every assertion, including unexpected bindings.
  writeTestFileSync('artifacts/rock-stroke-gate-vertex.wgsl',builder.vertexShader);writeTestFileSync('artifacts/rock-stroke-gate-fragment.wgsl',builder.fragmentShader);writeTestFileSync('artifacts/rock-stroke-gate-bindings.json',JSON.stringify({scope:'Cold actual Standard rock; no device, Native image or timing',attributes:attributes.length,buffers:buffers.size,varyings:builder.varyings.filter(v=>v.needsInterpolation).map(v=>v.name),bindings:bindings.map(b=>({name:b.name,storage:!!b.isStorageBuffer,sampled:!!b.isSampledTexture,visibility:b.visibility,texture:b.texture?{id:b.texture.id,uuid:b.texture.uuid,name:b.texture.name,type:b.texture.type,format:b.texture.format,width:(b.texture.image as {width:number}).width,height:(b.texture.image as {height:number}).height,role:b.texture===stone?'stone':b.texture===pigment?'Source stroke pigment':b.texture===dry?'Source dry-brush alpha':b.texture.name==='DFG_LUT'?'r186 Standard BRDF LUT':'unexpected'}:null}))},null,2)+'\n');
  expect(new Set(storage.map(binding=>binding.attribute)).size).toBe(1);expect(storage[0]?.attribute?.id).toBe(prepared.buffer.id);expect(storage.some(binding=>binding.attribute===canonical.buffer)).toBe(false);for(const bit of [1,2])expect(storage.filter(binding=>(binding.visibility&bit)!==0)).toHaveLength(1);expect(builder.vertexShader).toContain('v_rockStrokeHeader0');expect(builder.fragmentShader).toContain('v_rockStrokeHeader1');
  for(const texture of [stone,pigment,dry]){expect(texture).toBeInstanceOf(THREE.Texture);expect(textures.filter(binding=>binding.texture===texture)).toHaveLength(1);}
  // r186 PhysicalLightingModel.js:579 samples BSDF/DFGLUT.js, a shared
  // 16x16 RG HalfFloat texture named DFG_LUT. It predates this gate.
  const dfg=textures.filter(binding=>binding.texture?.name==='DFG_LUT');expect(dfg).toHaveLength(1);expect((dfg[0]!.texture!.image as {width:number}).width).toBe(16);expect((dfg[0]!.texture!.image as {height:number}).height).toBe(16);expect(dfg[0]!.texture!.format).toBe(THREE.RGFormat);expect(dfg[0]!.texture!.type).toBe(THREE.HalfFloatType);expect(textures).toHaveLength(4);
  expect(attributes.length).toBeLessThanOrEqual(16);expect(buffers.size).toBeLessThanOrEqual(8);expect(builder.varyings.filter(v=>v.needsInterpolation).length).toBeLessThanOrEqual(16);expect(layer.mesh.geometry).toBe(geometry);expect(layer.mesh.material).toBe(material);expect(init).not.toHaveBeenCalled();expect(warning.mock.calls.filter(args=>args.some(a=>String(a).includes('Return statement used')))).toEqual([]);
 }finally{layer.mesh.removeFromParent();layer.dispose();context.dispose();flush.mockRestore();init.mockRestore();warning.mockRestore();}
},60000);
