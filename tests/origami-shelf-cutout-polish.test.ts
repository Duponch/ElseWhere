import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {origamiFurnitureParts} from '../src/render/origami/props';
import {normalizeCutoutPaintUvs} from '../src/render/origami/face-paint-uv';
import {buildOrigamiAnimalReference} from '../src/render/origami/animal-reference';
import {footprintCells} from '../src/sim/definitions';
import {SHELF_LEVELS} from '../src/render/shelf-presentation';
import type {Structure,World} from '../src/sim/types';

test.each(['shelf','small-shelf'] as const)('%s remains open through both long sides in every orientation without moving storage supports',kind=>{
 for(const orientation of [0,1,2,3] as const){
  const structure:Structure={id:101,kind,x:7,z:9,orientation,footprint:'standard',material:'wood'},world={structures:[structure]} as World;
  const before=JSON.stringify(world),parts=origamiFurnitureParts(world),cells=footprintCells(structure),x=cells.reduce((n,c)=>n+c.x,0)/cells.length,z=cells.reduce((n,c)=>n+c.z,0)/cells.length,angle=orientation*Math.PI/2;
  expect(parts.filter(p=>p.sy===.07).map(p=>p.y+p.sy!/2)).toEqual(SHELF_LEVELS);
  for(const side of [-1,1])for(const height of [.39,.89,1.31]){
   const ray=new THREE.Ray(new THREE.Vector3(x+side*Math.sin(angle)*2,height,z+side*Math.cos(angle)*2),new THREE.Vector3(-side*Math.sin(angle),0,-side*Math.cos(angle)));
   for(const part of parts){
    const transform=new THREE.Matrix4().compose(new THREE.Vector3(part.x,part.y,part.z),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),part.ry??0),new THREE.Vector3(part.sx!,part.sy!,part.sz!));
    const local=ray.clone().applyMatrix4(transform.invert()),box=new THREE.Box3(new THREE.Vector3(-.5,-.5,-.5),new THREE.Vector3(.5,.5,.5));
    expect(local.intersectsBox(box),`blocked ${kind}/${orientation}/${side}/${height}`).toBe(false);
   }
  }
  expect(parts.every(p=>p.key===101&&p.targetId===101)).toBe(true);expect(JSON.stringify(world)).toBe(before);
 }
});

test('both elephant ear caps have complete coherent fill coordinates while the literal reference stays untouched',()=>{
 const root=buildOrigamiAnimalReference('elephant'),ears:THREE.Mesh[]=[];root.traverse(object=>{if(object instanceof THREE.Mesh&&object.name==='earPlate')ears.push(object);});
 expect(ears).toHaveLength(2);
 try{for(const ear of ears){
  const source=ear.geometry,original=Array.from(source.getAttribute('uv').array),painted=normalizeCutoutPaintUvs(source),position=painted.getAttribute('position'),normal=painted.getAttribute('normal'),uv=painted.getAttribute('uv');
  try{
   expect(Math.min(...original)).toBeLessThan(0);expect(Array.from(source.getAttribute('uv').array)).toEqual(original);
   expect(Array.from(position.array)).toEqual(Array.from(source.getAttribute('position').array));
   for(const side of [-1,1]){
    const cap=Array.from({length:position.count},(_,i)=>i).filter(i=>normal.getZ(i)*side>.99);expect(cap.length).toBeGreaterThan(3);
    for(const component of [0,1]){const values=cap.map(i=>uv.getComponent(i,component));expect(Math.min(...values)).toBeCloseTo(0);expect(Math.max(...values)).toBeCloseTo(1);}
   }
   for(let i=0;i<uv.count;i++){expect(uv.getX(i)).toBeGreaterThanOrEqual(0);expect(uv.getX(i)).toBeLessThanOrEqual(1);expect(uv.getY(i)).toBeGreaterThanOrEqual(0);expect(uv.getY(i)).toBeLessThanOrEqual(1);}
   const points=new Map<string,[number,number]>();for(let i=0;i<position.count;i++)if(Math.abs(normal.getZ(i))>.99){const key=[position.getX(i),position.getY(i),position.getZ(i)].join(',');const at:[number,number]=[uv.getX(i),uv.getY(i)];if(points.has(key))expect(at).toEqual(points.get(key));else points.set(key,at);}
  }finally{painted.dispose();}
 }}finally{root.traverse(object=>{if(object instanceof THREE.Mesh)object.geometry.dispose();});}
});
