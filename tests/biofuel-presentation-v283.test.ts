import { expect,test } from 'vitest';
import * as THREE from 'three/webgpu';
import { createWorld } from '../src/sim/index';
import { newBuildingFuel } from '../src/sim/fuel';
import { cookingSpot } from '../src/sim/cooking-bills';
import { biofuelParts,CHEMFUEL_CARGO } from '../src/render/biofuel-parts';
import { itemCargoKind } from '../src/render/item-presentation';
import { pileParts } from '../src/render/pile-parts';
import { pileSurfaces } from '../src/render/pile-surfaces';
import { buildFurniture } from '../src/render/FurnitureLayer';
import { buildJobMarkers } from '../src/render/JobLayer';
import { ConstructionGhosts } from '../src/render/construction-ghosts';
import { constructionPreviewParts } from '../src/render/construction-preview-parts';
import { PawnLayer } from '../src/render/PawnLayer';
import { pawnWorkPose,WORK_POSE } from '../src/render/work-presentation';
import type { BoxBatches } from '../src/render/BoxBatches';
import type { Placement } from '../src/render/primitives';
import type { Structure } from '../src/sim/types';

function fixture(){
  const world=createWorld(283,32,32);world.resources=[];world.jobs=[];world.piles=[];world.packed=[];
  const refinery:Structure={id:world.nextId++,kind:'biofuel-refinery',x:12,z:12,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null},bills:[]};
  const generator:Structure={id:world.nextId++,kind:'chemfuel-generator',x:17,z:12,orientation:0,footprint:'standard',material:'steel',power:{on:true,parentId:null},fuel:newBuildingFuel('chemfuel-generator')};
  world.structures=[refinery,generator];return {world,refinery,generator};
}

test('refinery rotates within its complete footprint and preserves an unobstructed service edge',()=>{
  const {world,refinery}=fixture();world.structures=[refinery];const base=biofuelParts(world);
  expect(base.length).toBeGreaterThan(10);
  expect(base.every(p=>Math.abs(p.x-refinery.x)+(p.sx??1)/2<=1.5&&p.z-refinery.z-(p.sz??1)/2>=-.5&&p.z-refinery.z+(p.sz??1)/2<=1.5)).toBe(true);
  for(const orientation of [0,1,2,3] as const){
    refinery.orientation=orientation;const rotated=biofuelParts(world),angle=orientation*Math.PI/2;
    rotated.forEach((p,i)=>{const b=base[i]!,x=b.x-refinery.x,z=b.z-refinery.z;
      expect(p.x).toBeCloseTo(refinery.x+x*Math.cos(angle)+z*Math.sin(angle));expect(p.z).toBeCloseTo(refinery.z+z*Math.cos(angle)-x*Math.sin(angle));expect(p.key).toBe(refinery.id);
    });
    expect(Math.hypot(cookingSpot(refinery).x-refinery.x,cookingSpot(refinery).z-refinery.z)).toBe(1);
  }
  const stable=biofuelParts(world);refinery.power!.on=false;world.tick+=50;world.piles=[{id:world.nextId++,item:'wood',kind:'wood',quantity:70,owner:{type:'ground',x:11,z:11}}];expect(biofuelParts(world)).toEqual(stable);
});

test('fixed generator shell represents machinery without inventing reservoir piles or surfaces',()=>{
  const {world,generator}=fixture();world.structures=[generator];const base=biofuelParts(world);
  expect(base.every(p=>p.x-(p.sx??1)/2>=generator.x-.5&&p.x+(p.sx??1)/2<=generator.x+1.5&&p.z-(p.sz??1)/2>=generator.z-.5&&p.z+(p.sz??1)/2<=generator.z+1.5)).toBe(true);
  generator.fuel!.ticks=18000;generator.power!.on=false;expect(biofuelParts(world)).toEqual(base);expect(world.piles).toHaveLength(0);expect(pileSurfaces(world).size).toBe(0);
  const batches:Placement[][]=[];buildFurniture(world,new THREE.Group(),false,{set:(_g:THREE.Group,_name:string,parts:Placement[])=>batches.push(parts)} as unknown as BoxBatches);
  expect(batches).toHaveLength(1);expect(batches[0]!.filter(p=>p.key===generator.id)).toEqual(base);
});

test('ground fuel uses centred cans while carried fuel occupies its own existing actor cargo slot',()=>{
  const {world}=fixture(),small=pileParts([{x:8,z:7,item:'chemfuel',kind:'chemfuel',quantity:1,supplied:false}]),full=pileParts([{x:8,z:7,item:'chemfuel',kind:'chemfuel',quantity:150,supplied:false}]);
  expect(small).toHaveLength(5);expect(full).toHaveLength(5);
  const left=Math.min(...full.map(p=>p.x-(p.sx??1)/2)),right=Math.max(...full.map(p=>p.x+(p.sx??1)/2));expect((left+right)/2).toBe(8);expect(full.every(p=>p.y>0)).toBe(true);
  const pawn=world.pawns[0]!;world.piles=[{id:world.nextId++,item:'chemfuel',kind:'chemfuel',quantity:35,owner:{type:'pawn',pawnId:pawn.id}}];
  const layer=new PawnLayer();try{layer.update(world,1,true);const cargo=layer.feedbackSource!.getAttribute('aCargo') as THREE.InstancedBufferAttribute;expect(cargo.getX(0)).toBe(itemCargoKind('chemfuel'));expect(cargo.getY(0)).toBeGreaterThan(0);}finally{layer.dispose();}
});

test('construction marker covers refinery footprint and completed refining uses the common work pose',()=>{
  const {world,refinery}=fixture();world.structures=[];world.jobs=[{id:world.nextId++,kind:'biofuel-refinery',x:refinery.x,z:refinery.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},material:'steel',construction:'blueprint'}];
  // 22 November: the placed refinery is its ghost (the cursor's model), not a box over its cells.
  const captures=new Map<string,Placement[]>(),ghosts=new ConstructionGhosts(),job=world.jobs[0]!;
  try{
    buildJobMarkers(world,new THREE.Group(),false,{set:(_g:THREE.Group,name:string,parts:Placement[])=>captures.set(name,parts)} as unknown as BoxBatches,ghosts);
    expect(captures.has('job-plans')).toBe(false);expect(captures.get('job-orders')).toEqual([]);
    const cursor=constructionPreviewParts(world,[{kind:'biofuel-refinery',x:refinery.x,z:refinery.z,orientation:0,material:'steel'}]).boxes;
    expect(ghosts.allParts().map(({key:_k,targetId:_t,...part})=>part)).toEqual(cursor.map(({key:_k,targetId:_t,...part})=>part));expect(ghosts.allParts().every(p=>p.key===job.id)).toBe(true);
    const left=Math.min(...cursor.map(p=>p.x-(p.sx??1)/2)),right=Math.max(...cursor.map(p=>p.x+(p.sx??1)/2));expect((left+right)/2).toBeCloseTo(refinery.x,5);
  }finally{ghosts.dispose();}
  const pawn=world.pawns[0]!;pawn.state='working';pawn.cooking={stationId:refinery.id,billId:1,recipe:'chemfuel-from-wood',phase:'work',spot:cookingSpot(refinery),actionCell:cookingSpot(refinery),ingredients:[],progress:10,productId:null,storageId:null};expect(pawnWorkPose(pawn,undefined,'biofuel-refinery')).toBe(WORK_POSE.craft);
});
