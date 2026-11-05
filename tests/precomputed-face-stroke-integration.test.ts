import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const actual=await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),stub=await import('./fixtures/reference-paint-bake-stub');return{...actual,bakeResidentPaintToSink:stub.stubResidentPaintToSink};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {compileFaceStrokeTable} from '../src/render/surfaces/FaceStrokeTable';
import {compileNaturalSurfaceModels} from '../src/render/surfaces/NaturalSurfaceModels';
import {MutableFaceStrokeBank} from '../src/render/surfaces/MutableFaceStrokeBank';
import {RockLayer} from '../src/render/RockLayer';
import {RockStrokeTable,type RockStrokePatch} from '../src/render/surfaces/RockStrokeTable';
import {PawnLayer} from '../src/render/PawnLayer';
import {createWorld} from '../src/sim/engine';
import {settlePreparedStrokes} from './fixtures/settle-prepared-strokes';
import {writeTestFileSync} from './test-output';
const preferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default' as const,impasto:0,wear:0};
const words=(array:Float32Array)=>new Uint32Array(array.buffer,array.byteOffset,array.length);

test('two genuine canonical models admit before first Pastel and settings publication rolls both buffers/uniforms back atomically',()=>{
 const context=new GraphicsStyleContext(preferences),geometries=[new THREE.BoxGeometry(1,2,.4),new THREE.BoxGeometry(3,.5,1)],tables=geometries.map(geometry=>compileFaceStrokeTable(geometry,{maxCpuBytes:4*1024*1024,maxTriangles:100})),canonical=tables.map(table=>table.values.slice()),owners=tables.map(table=>context.preparedStrokes.acquire(table)!);
 try{
  expect(owners.every(owner=>owner.snapshot().ready)).toBe(true);const before=owners.map(owner=>(owner.buffer.array as Float32Array).slice()),attributes=owners.map(owner=>owner.buffer),settings=owners.map(owner=>owner.snapshot().settingsKey);
  const stage=context.preparedStrokes.stage({preferences:{...context.preferences,edgeWidth:5,strokeImperfection:1}},()=>{});
  owners.forEach((owner,index)=>expect(words(owner.buffer.array as Float32Array)).toEqual(words(before[index]!)));stage.publish();expect(owners.every(owner=>owner.width.value===5&&owner.irregularity.value===1)).toBe(true);stage.dispose();
  owners.forEach((owner,index)=>{expect(owner.buffer).toBe(attributes[index]);expect(owner.snapshot().settingsKey).toBe(settings[index]);expect(words(owner.buffer.array as Float32Array)).toEqual(words(before[index]!));expect(words(tables[index]!.values)).toEqual(words(canonical[index]!));});
  const counters=owners.map(owner=>({...owner.counters}));for(const style of ['origami','default','origami']as const){context.update({...context.preferences,style});settlePreparedStrokes(context);}expect(owners.map(owner=>owner.counters)).toEqual(counters);
 }finally{tables.forEach(table=>context.preparedStrokes.release(table,geometries));tables.forEach(table=>table.dispose());geometries.forEach(geometry=>geometry.dispose());context.dispose();}
});

test('real sparse mutable natural regions use actual headers and queued publication; canonical disposal removes the context borrower',()=>{
 const context=new GraphicsStyleContext(preferences),sources=[new THREE.BoxGeometry(1,2,.5),new THREE.PlaneGeometry(1,3)],tables=sources.map(source=>compileFaceStrokeTable(source,{maxCpuBytes:4*1024*1024,maxTriangles:100})),bank=new MutableFaceStrokeBank(),owner=context.preparedStrokes.acquire(bank)!,first=bank.publish(tables[0]!),second=bank.publish(tables[1]!);
 try{
  expect(second.faceOffset).toBeGreaterThan(tables[0]!.faceCount);expect(owner.snapshot().counters.dirtyPreparations).toBe(0);settlePreparedStrokes(context);const data=owner.buffer.array as Float32Array,canonical=bank.values;
  for(const[offset,count]of [[first.faceOffset,tables[0]!.faceCount],[second.faceOffset,tables[1]!.faceCount]])for(let face=0;face<count!;face++)expect(words(data.subarray((offset!+face)*8,(offset!+face)*8+8))).toEqual(words(canonical.subarray((offset!+face)*8,(offset!+face)*8+8)));
  expect(owner.snapshot().counters.preparedFaces).toBe(tables[0]!.faceCount+tables[1]!.faceCount);const pending=context.preparedStrokes.stage({preferences:{...context.preferences,edgeWidth:2}},()=>{}),third=bank.publish(tables[1]!);expect(()=>pending.publish()).toThrow(/superseded/);pending.dispose();third.release();settlePreparedStrokes(context);first.release();second.release();bank.dispose();expect(context.preparedStrokes.snapshot().entries).toBe(0);expect(()=>owner.assertCurrent()).toThrow(/retired/);
 }finally{bank.dispose();tables.forEach(table=>table.dispose());sources.forEach(source=>source.dispose());context.dispose();}
});

test('actual Rock mining queues only Source patch faces; Single/Paged representation changes are JavaScript graph changes on the same materials',()=>{
 const context=new GraphicsStyleContext(preferences),layer=withGraphicsStyle(context,()=>new RockLayer()),canonical=Reflect.get(layer,'stroke')as RockStrokeTable,world=createWorld(39,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(const[x,z]of [[12,12],[13,12],[13,13],[14,13]])world.tiles[z!*32+x!]={terrain:'rock',stone:'granite'};
 try{
  layer.update(world,true);settlePreparedStrokes(context);const owner=context.preparedStrokes.acquire(canonical)!,geometry=layer.mesh.geometry,material=layer.mesh.material,program=(material as THREE.NodeMaterial).colorNode,prior=owner.snapshot().counters.preparedFaces,spy=vi.spyOn(canonical,'commit'),before=(owner.buffer.array as Float32Array).slice(),changed={...world,tiles:world.tiles.slice()};changed.tiles[12*32+13]={terrain:'soil'};layer.update(changed,false,[12*32+13]);const patches=spy.mock.calls.at(-1)![0]as readonly RockStrokePatch[],dirty=new Set(patches.flatMap(patch=>[...patch.faces]));expect(words(owner.buffer.array as Float32Array)).toEqual(words(before));settlePreparedStrokes(context);expect(owner.snapshot().counters.preparedFaces-prior).toBe(dirty.size);expect(layer.mesh.geometry).toBe(geometry);expect(layer.mesh.material).toBe(material);expect((material as THREE.NodeMaterial).colorNode).toBe(program);spy.mockRestore();
  const large={...world,width:192,height:192,tiles:Array.from({length:192*192},()=>({terrain:'soil' as const}))};layer.update(large,true);settlePreparedStrokes(context);expect(canonical.representationKey).toBe('paged');expect(context.preparedStrokes.acquire(canonical)).toBeUndefined();expect(layer.mesh.material).toBe(material);const pagedProgram=(material as THREE.NodeMaterial).colorNode;expect(pagedProgram).not.toBe(program);layer.update(world,true);settlePreparedStrokes(context);expect(context.preparedStrokes.acquire(canonical)).toBe(owner);expect(layer.mesh.material).toBe(material);expect((material as THREE.NodeMaterial).colorNode).not.toBe(pagedProgram);writeTestFileSync('artifacts/prepared-rock-producer-lifetime.json',JSON.stringify({scope:'Actual producer CPU adoption/mining only; no GPU/pixels/timing',canonical:canonical.snapshot(),prepared:owner.snapshot()},null,2)+'\n');
 }finally{layer.dispose();context.dispose();}
});

test('human canonical rows are borrowed from the real model and natural model closure retires prepared data before canonical geometry',()=>{
 const context=new GraphicsStyleContext(preferences),layer=withGraphicsStyle(context,()=>new PawnLayer()),world=createWorld(7,8,8);let natural:ReturnType<typeof compileNaturalSurfaceModels>|undefined;
 try{
  layer.update(world,0,true);settlePreparedStrokes(context);const model=Reflect.get(layer,'humanModel')as{strokes:{values:Float32Array;buffer:THREE.StorageBufferAttribute}},canonical=Reflect.get(layer,'humanStroke')as{values:Float32Array;buffer:THREE.StorageBufferAttribute};expect(canonical.values).toBe(model.strokes.values);expect(canonical.buffer).toBe(model.strokes.buffer);const capture=layer.bodySurfaceBakeSource();expect(capture?.model).toBe(model);expect(capture?.sourceMaterial).toBe(Reflect.get(layer,'texturedMaterial'));expect(capture?.pastelTexture.image.width).toBe(64);
  const source=new THREE.BoxGeometry(2,1,3);try{natural=compileNaturalSurfaceModels([source]);}finally{source.dispose();}const owner=context.preparedStrokes.acquire(natural.stroke)!;natural.dispose();natural=undefined;expect(()=>owner.assertCurrent()).toThrow(/retired/);expect(context.preparedStrokes.snapshot().entries).toBeGreaterThan(0);
 }finally{natural?.dispose();layer.dispose();context.dispose();}
});
