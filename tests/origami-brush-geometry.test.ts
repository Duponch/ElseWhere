import {describe,it,expect} from 'vitest';
import * as THREE from 'three/webgpu';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';

describe('painted Origami edge strips are actual bounded surface geometry',()=>{
 it('removes coplanar triangle seams and keeps both real faces at cube folds',()=>{
  const plane=new THREE.PlaneGeometry(1,1),cube=new THREE.BoxGeometry(1,1,1),flat=createOrigamiBrushGeometry(plane),folded=createOrigamiBrushGeometry(cube);
  expect(flat.getAttribute('position').count).toBe(4*6);expect(flat.index?.count).toBe(4*12);expect(folded.getAttribute('position').count).toBe(12*2*6);expect(folded.index?.count).toBe(12*2*12);
  for(const [width,rough]of [[.5,0],[1,.45],[5,1]] as const){
   updateOrigamiBrushGeometry(folded,width,rough);const p=folded.getAttribute('position');
   for(let i=0;i<p.count;i++){const coordinates=[p.getX(i),p.getY(i),p.getZ(i)];expect(Math.max(...coordinates.map(Math.abs))).toBeCloseTo(.5);expect(coordinates.every(n=>Math.abs(n)<=.5000001)).toBe(true);}
   updateOrigamiBrushGeometry(flat,width,rough);const f=flat.getAttribute('position');for(let i=0;i<f.count;i++){expect(f.getZ(i)).toBe(0);expect(Math.abs(f.getX(i))).toBeLessThanOrEqual(.5000001);expect(Math.abs(f.getY(i))).toBeLessThanOrEqual(.5000001);}
  }
  for(const geometry of [plane,cube,flat,folded])geometry.dispose();
 });
 it('keeps tiny faces bounded at the widest rough setting and packs all metadata into one stream',()=>{
  const source=new THREE.PlaneGeometry(.001,.002);source.setAttribute('partMask',new THREE.Float32BufferAttribute(new Array(source.getAttribute('position').count).fill(64),1));
  const brush=createOrigamiBrushGeometry(source);updateOrigamiBrushGeometry(brush,5,1);const points=brush.getAttribute('position'),buffers=new Set<unknown>();
  for(const attribute of Object.values(brush.attributes)){expect(attribute).toBeInstanceOf(THREE.InterleavedBufferAttribute);buffers.add((attribute as THREE.InterleavedBufferAttribute).data);}
  expect(buffers.size).toBe(1);for(let i=0;i<points.count;i++){expect(Math.abs(points.getX(i))).toBeLessThanOrEqual(.000500001);expect(Math.abs(points.getY(i))).toBeLessThanOrEqual(.001000001);expect(points.getZ(i)).toBe(0);expect(brush.getAttribute('partMask').getX(i)).toBe(64);}
  brush.dispose();source.dispose();
 });
 it('honors selected cargo triangles and never cancels overlaid anatomical identities',()=>{
  const cube=new THREE.BoxGeometry().toNonIndexed(),source=new THREE.BufferGeometry(),n=cube.getAttribute('position').count;
  for(const name of ['position','normal','uv']){const a=cube.getAttribute(name),values=new Float32Array(a.array.length*2);values.set(a.array);values.set(a.array,a.array.length);source.setAttribute(name,new THREE.BufferAttribute(values,a.itemSize));}
  source.setAttribute('cargoKind',new THREE.Float32BufferAttribute([...new Array(n).fill(4),...new Array(n).fill(17)],1));source.userData.cargoRangesByKind={4:{start:0,count:n},17:{start:n,count:n}};
  source.addGroup(0,n*2);const all=createOrigamiBrushGeometry(source);expect(all.getAttribute('position').count).toBe(288);expect(all.index?.count).toBe(576);
  source.clearGroups();source.addGroup(n,n);const selected=createOrigamiBrushGeometry(source);expect(selected.getAttribute('position').count).toBe(144);expect(selected.index?.count).toBe(288);const tag=selected.getAttribute('cargoKind');for(let i=0;i<tag.count;i++)expect(tag.getX(i)).toBe(17);
  source.clearGroups();const empty=createOrigamiBrushGeometry(source);expect(empty.getAttribute('position').count).toBe(0);for(const geometry of [cube,source,all,selected,empty])geometry.dispose();
 });
 it('updates only the requested vertices and preserves packed semantic values and paint UVs',()=>{
  const source=new THREE.BoxGeometry(),brush=createOrigamiBrushGeometry(source),position=brush.getAttribute('position'),uv=brush.getAttribute('uv'),before=new Float32Array(position.count*3),paint=new Float32Array(uv.count*2);
  for(let i=0;i<position.count;i++){before.set([position.getX(i),position.getY(i),position.getZ(i)],i*3);paint.set([uv.getX(i),uv.getY(i)],i*2);}
  const packed=(position as THREE.InterleavedBufferAttribute).data;packed.clearUpdateRanges();updateOrigamiBrushGeometry(brush,5,.8,7,9);
  const base=brush.userData.referenceBrushBasePositions as Float32Array,width=brush.userData.referenceBrushWidthOffsets as Float32Array,rough=brush.userData.referenceBrushRoughOffsets as Float32Array;
  for(let i=0;i<position.count;i++){for(let c=0;c<3;c++)expect(position.getComponent(i,c)).toBe(i>=7&&i<16?Math.fround(base[i*3+c]!+5*(width[i*3+c]!+.8*rough[i*3+c]!)):before[i*3+c]);expect(uv.getX(i)).toBe(paint[i*2]);expect(uv.getY(i)).toBe(paint[i*2+1]);}
  expect(packed.updateRanges).toEqual([{start:7*packed.stride,count:9*packed.stride}]);brush.dispose();source.dispose();
 });
});
