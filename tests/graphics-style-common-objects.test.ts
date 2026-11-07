/** Shared-model contract. Real furniture/item/chunk producers, placements and
 * resident span owner; no Canvas, renderer/device, lighting or pixel claim. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {FurniturePresentation} from '../src/render/FurnitureLayer';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ITEM_SHAPES,createItemGeometry} from '../src/render/item-geometry';
import {createChunkGeometry,chunkContour} from '../src/render/chunk-shape';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {camp,expected,growth,laidOut,pot,RecordingBatches,structure} from './furniture-resident-fixtures';
import type {Structure} from '../src/sim/types';

const KINDS:readonly Structure['kind'][]=['bed','solar-generator','wood-generator','heater','table','stool','table-square','table-long','shelf','small-shelf'];
function geometryBits(g:THREE.BufferGeometry){
 const bytes=(a:ArrayBufferView)=>Array.from(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
 return{index:g.index?bytes(g.index.array):null,drawRange:{...g.drawRange},groups:g.groups.map(r=>({...r})),attributes:Object.entries(g.attributes).map(([name,a])=>({name,itemSize:a.itemSize,normalized:a.normalized,count:a.count,bytes:bytes(a.array)})),bounds:g.boundingBox?{min:g.boundingBox.min.toArray(),max:g.boundingBox.max.toArray()}:null,sphere:g.boundingSphere?{center:g.boundingSphere.center.toArray(),radius:g.boundingSphere.radius}:null};
}
test('both graphics styles keep the ten Legacy furniture models and resident flower spans plus exact shared item/fragment geometry',()=>{
 const world=camp();world.structures=KINDS.map((kind,i)=>({...structure(kind,1000+i,3+i*2,8),material:i%2?'steel' as const:'wood' as const}));world.structures.push(pot(1100,8,14,.24));
 const defaultContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default'}),origamiContext=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0});
 const before=JSON.stringify(world),oracle=expected(world),owners=[defaultContext,origamiContext].map(context=>({context,owner:withGraphicsStyle(context,()=>new FurniturePresentation()),batches:new RecordingBatches(),group:new THREE.Group(),signature:new StructurePresentationSignature()}));
 try{
  for(const kind of KINDS){const s=world.structures.find(s=>s.kind===kind)!;expect(oracle.some(p=>p.targetId===s.id||p.key===s.id),'Legacy producer absent: '+kind).toBe(true);}
  for(const input of owners){input.signature.read(world.structures,'','',true);withGraphicsStyle(input.context,()=>input.owner.update(world,input.group,false,input.batches.asNative(),input.signature.flowerChanges(),true));input.signature.ackFurnitureBuild();expect(input.batches.items).toEqual(laidOut(world,input.owner));expect(input.batches.calls.map(c=>c.kind)).toEqual(['set']);}
  expect(JSON.stringify(world)).toBe(before);
  // The formerly style-specific replacement prevented the resident span path.
  // Shared forms now permit the SAME real six-part flower patch in both styles.
  growth(world,KINDS.length,.5);const patchedOracle=expected(world);
  for(const input of owners){input.signature.read(world.structures,'','');withGraphicsStyle(input.context,()=>input.owner.update(world,input.group,false,input.batches.asNative(),input.signature.flowerChanges(),true));input.signature.ackFurnitureBuild();expect(input.batches.calls.at(-1)).toMatchObject({kind:'patch'});expect(input.batches.calls.at(-1)!.count).toBeLessThanOrEqual(6);expect(input.batches.items).toEqual(laidOut(world,input.owner));expect(laidOut(world,input.owner).filter(p=>p.targetId!==undefined)).toHaveLength(patchedOracle.length);}
  const patchBefore=JSON.stringify(world),cutawayOracle=expected(world,true);
  for(const input of owners){withGraphicsStyle(input.context,()=>input.owner.update(world,input.group,true,input.batches.asNative(),undefined,false));expect(input.batches.items).toEqual(cutawayOracle);expect(input.batches.calls.at(-1)!.kind).toBe('set');}
  expect(JSON.stringify(world)).toBe(patchBefore);
  // Real finite object and fragment factories already have one shared shape.
  // Preserve their exact triangle records/UVs/normals in this same contract;
  // paint, physical contours and the existing target/cargo transforms are free
  // to differ without replacing the object or quantizing its geometry.
  const factories=[...ITEM_SHAPES.map(shape=>()=>createItemGeometry(shape)),()=>createChunkGeometry(false),()=>createChunkGeometry(true)];
  for(const make of factories){const a=withGraphicsStyle(defaultContext,make),b=withGraphicsStyle(origamiContext,make);try{expect(geometryBits(b)).toEqual(geometryBits(a));}finally{a.dispose();b.dispose();}}
  expect(withGraphicsStyle(origamiContext,()=>chunkContour(712))).toEqual(withGraphicsStyle(defaultContext,()=>chunkContour(712)));
 }finally{for(const input of owners)input.owner.clear();origamiContext.dispose();defaultContext.dispose();}
});
