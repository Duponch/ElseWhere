/** Actual continuous cliff writer, no device, painter, shader or simulation
 * stepping. Both texture encodings borrow this same geometric owner. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {writeRockCell,ROCK_VERTICES} from '../src/render/RockSurface';
import {writeRockPigment} from '../src/render/rock-pigment';
import {RockSurfaceModel,ROCK_SURFACE_UV,ROCK_SURFACE_VERTICES} from '../src/render/models/RockSurfaceModel';
import {createOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';

function world(){const w=createWorld(42,32,32);w.tiles=w.tiles.map(()=>({terrain:'soil'}));for(let z=12;z<=16;z++)for(let x=12;x<=16;x++)w.tiles[z*w.width+x]={terrain:'rock',stone:x<15?'granite':'marble'};return w;}
function stream(g:THREE.BufferGeometry,indices:readonly number[],name:string){const a=g.getAttribute(name),out:number[]=[];for(const v of indices)for(let c=0;c<a.itemSize;c++)out.push(a.getComponent(v,c));return out;}

test('actual rock triangles, pigment, winding and slab stay exact with only face seams and stable sparse slots',()=>{
 const w=world(),model=new RockSurfaceModel(w.width,w.height,32),before=JSON.stringify(w),position=model.geometry.getAttribute('position'),normal=model.geometry.getAttribute('normal'),color=model.geometry.getAttribute('color'),slab=new THREE.BoxGeometry(w.width+.15,.8,w.height+.15).translate((w.width-1)/2,-.56,(w.height-1)/2);
 try{
  for(const name of ['position','normal'])expect(Array.from(model.geometry.getAttribute(name).array).slice(0,24*3)).toEqual(Array.from(slab.getAttribute(name).array));expect(Array.from(model.stock.index!.array).slice(0,36)).toEqual(Array.from(slab.index!.array));
  for(const[cell,slot]of [[12*32+12,0],[14*32+14,1],[16*32+16,2]]as const){
   const ids=model.writeCell(w,cell,slot),sourcePositions=new Float32Array(ROCK_VERTICES*3),sourceColors=new Float32Array(ROCK_VERTICES*3),source=writeRockCell(w,cell%32,Math.floor(cell/32),sourcePositions,0);writeRockPigment(w,cell%32,Math.floor(cell/32),sourceColors,0);
   expect(stream(model.geometry,ids,'position')).toEqual(source.flatMap(i=>Array.from(sourcePositions.subarray(i*3,i*3+3))));expect(stream(model.geometry,ids,'color')).toEqual(source.flatMap(i=>Array.from(sourceColors.subarray(i*3,i*3+3))));expect(ids.length).toBe(source.length);expect(ids.every(i=>i>=24+slot*ROCK_SURFACE_VERTICES&&i<24+(slot+1)*ROCK_SURFACE_VERTICES)).toBe(true);
   const uv=model.geometry.getAttribute(ROCK_SURFACE_UV);for(let triangle=0;triangle<ids.length;triangle+=3)expect([uv.getZ(ids[triangle]!),uv.getZ(ids[triangle+1]!),uv.getZ(ids[triangle+2]!)]).toEqual(Array(3).fill(uv.getZ(ids[triangle]!)));
  }
  const frozen=position.array.slice(),changed={...w,tiles:w.tiles.slice()};changed.tiles[14*32+14]={terrain:'soil'};expect(model.writeCell(changed,14*32+14,1)).toEqual([]);expect(model.geometry.getAttribute('position')).toBe(position);expect(model.geometry.getAttribute('normal')).toBe(normal);expect(model.geometry.getAttribute('color')).toBe(color);expect(position.array).toEqual(frozen);expect(model.writeCell(w,14*32+14,1)).toHaveLength(6);expect(JSON.stringify(w)).toBe(before);
 }finally{slab.dispose();model.dispose();}
});

test('Source stock retains true neighbour suppression and each original triangle UV inverse, including the piecewise-affine lower quads',()=>{
 const w=world(),model=new RockSurfaceModel(w.width,w.height,32),cells:number[]=[],indices:number[][]=[];
 try{
  for(let z=12;z<=16;z++)for(let x=12;x<=16;x++){const cell=z*32+x,slot=cells.length;cells.push(cell);indices.push(model.writeCell(w,cell,slot));}
  const center=cells.indexOf(14*32+14);model.stock.clearGroups();for(let slot=0;slot<cells.length;slot++)model.stock.addGroup(model.stockOffset(slot),indices[slot]!.length,0);const stock=createOrigamiBrushGeometry(model.stock),base=stock.userData.referenceBrushBasePositions as Float32Array,face=stock.getAttribute(ROCK_SURFACE_UV),lowerFaces=new Set<number>();
  try{for(let first=0;first<face.count;first+=6){const id=face.getZ(first),a=new THREE.Vector3().fromArray(base,first*3),b=new THREE.Vector3().fromArray(base,(first+4)*3),project=model.projector(id,[a,b]),uvA=project(a,false),uvB=project(b,false);for(const uv of [uvA,uvB])expect(uv.every(value=>value>=-1e-5&&value<=1+1e-5)).toBe(true);if(id>=6&&(id-6)%14>=10)lowerFaces.add(id);}
   // Interior cell boundaries are analysed with their real neighbours; no
   // isolated-cell four-edge frame is introduced by a local stock compiler.
   const records=(g:THREE.BufferGeometry)=>{const tag=g.getAttribute(ROCK_SURFACE_UV),out:number[]=[];for(let first=0;first<tag.count;first+=6)if(tag.getZ(first)>=model.face(center)&&tag.getZ(first)<model.face(center)+14)for(const key of ['referenceBrushBasePositions','referenceBrushWidthOffsets','referenceBrushRoughOffsets'])out.push(...(g.userData[key] as Float32Array).subarray(first*3,(first+6)*3));return out;};
   model.stock.clearGroups();for(let slot=0;slot<cells.length;slot++)if(Math.abs(cells[slot]!%32-14)<=1&&Math.abs(Math.floor(cells[slot]!/32)-14)<=1)model.stock.addGroup(model.stockOffset(slot),indices[slot]!.length,0);const halo=createOrigamiBrushGeometry(model.stock);try{expect(records(halo)).toEqual(records(stock));}finally{halo.dispose();}expect(lowerFaces.size).toBeGreaterThan(0);
  }finally{stock.dispose();}
 }finally{model.dispose();}
});
