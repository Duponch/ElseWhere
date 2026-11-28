import { expect,test } from 'vitest';
import { Matrix4 } from 'three/webgpu';
import { createWorld } from '../src/sim/index';
import { deepDrillingParts } from '../src/render/deep-drilling-parts';
import { DeepResourceLayer,deepResourceOverlayCells } from '../src/render/DeepResourceLayer';
import { pawnWorkPose,WORK_POSE } from '../src/render/work-presentation';
import type { Structure } from '../src/sim/types';

function fixture(){
  const world=createWorld(280,32,32);
  const scanner:Structure={id:world.nextId++,kind:'ground-scanner',x:7,z:7,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null},deepScanner:{daysWorking:0}};
  const drill:Structure={id:world.nextId++,kind:'deep-drill',x:12,z:12,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null},deepDrill:{progress:0,yieldPct:0,rng:1}};
  world.structures=[scanner,drill];world.deepResources={adoptedAt:world.tick,rng:1,discoveries:1,cells:[{index:12*world.width+12,item:'steel',count:300},{index:20*world.width+20,item:'gold',count:8}]};
  return {world,scanner,drill};
}

test('machinery has distinct static geometry, rotates about its own anchor and does not grow with progress',()=>{
  const {world,scanner,drill}=fixture();world.structures=[drill];const zero=deepDrillingParts(world);
  drill.orientation=1;const rotated=deepDrillingParts(world);expect(rotated).toHaveLength(zero.length);
  for(let i=0;i<zero.length;i++){
    expect(rotated[i]!.x-drill.x).toBeCloseTo(zero[i]!.z-drill.z);expect(rotated[i]!.z-drill.z).toBeCloseTo(-(zero[i]!.x-drill.x));
  }
  drill.deepDrill!.progress=9999;expect(deepDrillingParts(world)).toEqual(rotated);
  world.structures=[scanner];const scan=deepDrillingParts(world);expect(scan).not.toEqual(rotated);
  expect(scan.every(p=>Math.abs(p.x-scanner.x)+(p.sx??1)/2<=1.5&&Math.abs(p.z-scanner.z)+(p.sz??1)/2<=1.5)).toBe(true);
});

test('only discovered nonempty cells appear for selection or drill placement with a powered scanner',()=>{
  const {world,scanner,drill}=fixture(),before=structuredClone(world);
  expect(deepResourceOverlayCells(world,{})).toEqual([]);expect(deepResourceOverlayCells(world,{placement:'ground-scanner'})).toEqual([]);
  expect(deepResourceOverlayCells(world,{placement:'deep-drill'})).toHaveLength(2);
  const cells=deepResourceOverlayCells(world,{selectedId:drill.id});expect(cells.map(c=>c.selected)).toEqual([true,false]);expect(world).toEqual(before);
  scanner.emp={sinceCore:world.tick*10,untilCore:world.tick*10+10};expect(deepResourceOverlayCells(world,{selectedId:drill.id})).toEqual([]);delete scanner.emp;
  scanner.power!.on=false;expect(deepResourceOverlayCells(world,{selectedId:scanner.id})).toEqual([]);
});

test('resident overlay refreshes counts, hides exhausted reserves and preserves a newer update during compile',()=>{
  const {world,drill}=fixture(),layer=new DeepResourceLayer();
  try{
    expect(layer.update(world,{selectedId:drill.id})).toBe(true);expect(layer.mesh.activeCount).toBe(2);
    expect(layer.update(world,{selectedId:drill.id})).toBe(false);
    const matrix=new Matrix4();layer.mesh.getMatrixAt(0,matrix);expect(matrix.elements[12]).toBe(12);expect(matrix.elements[14]).toBe(12);
    layer.update(world,{});expect(layer.mesh.visible).toBe(false);const restore=layer.prepareForCompile();
    world.deepResources!.cells.shift();layer.update(world,{selectedId:drill.id});restore();expect(layer.mesh.activeCount).toBe(1);
    world.deepResources!.cells=[];layer.update(world,{selectedId:drill.id});expect(layer.mesh.activeCount).toBe(0);
  }finally{layer.dispose();}
});

test('uranium and jade have finite overlay cells and remain separate resources',()=>{
  const {world,drill}=fixture();world.deepResources!.cells[0]!.item='uranium';world.deepResources!.cells[1]!.item='jade';
  const layer=new DeepResourceLayer();
  try{
    expect(deepResourceOverlayCells(world,{selectedId:drill.id}).map(c=>c.item)).toEqual(['uranium','jade']);
    expect(layer.update(world,{selectedId:drill.id})).toBe(true);expect(layer.mesh.activeCount).toBe(2);
    expect(layer.surfaces).toHaveLength(2);
    expect(layer.update(world,{selectedId:drill.id})).toBe(false);
  }finally{layer.dispose();}
});

test('deep work reuses a control-panel pose only during real work',()=>{
  const {world,drill}=fixture(),pawn=world.pawns[0]!;pawn.deepWork={kind:'drill',structureId:drill.id,spot:{x:12,z:11}};
  pawn.state='moving';expect(pawnWorkPose(pawn,undefined,'deep-drill')).toBe(0);
  pawn.state='working';expect(pawnWorkPose(pawn,undefined,'deep-drill')).toBe(WORK_POSE.craft);
});
