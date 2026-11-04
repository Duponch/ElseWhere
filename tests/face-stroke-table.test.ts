/** Source geometry is the oracle. These are CPU/provenance contracts, not a
 * GPU/performance or pixel-equivalence claim. */
import {describe,expect,it} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileFaceStrokeTable,combineFaceStrokeTables,queryFaceStrokeTable,attachFaceStrokeGpuRetirement} from '../src/render/surfaces/FaceStrokeTable';
import {createOrigamiBrushGeometry,updateOrigamiBrushGeometry} from '../src/render/origami/brush-geometry';

const budget={maxCpuBytes:8*1024*1024,maxTriangles:1000};
describe('one opaque surface retains actual Source brush provenance',()=>{
 it('groups true coplanar faces without expanding a 24-corner indexed cube or changing any triangle',()=>{
  const source=new THREE.BoxGeometry(2,3,4),original=Array.from(source.index!.array),table=compileFaceStrokeTable(source,budget);
  try{
   expect(table.faceCount).toBe(6);expect(table.edgeCount).toBe(24);expect(table.maxEdgesPerFace).toBe(4);expect(table.sourceVertex.length).toBe(24);expect(table.sourceIndex.length).toBe(36);
   expect(Array.from(table.sourceIndex,vertex=>table.sourceVertex[vertex]!)).toEqual(original);
   for(let first=0;first<original.length;first+=3){const face=table.sourceTriangleFaceIds[first/3]!;for(let c=0;c<3;c++)expect(table.faceIds[table.sourceIndex[first+c]!]).toBe(face);}
   for(let face=0;face<table.faceCount;face++){expect(queryFaceStrokeTable(table,face,[.5,.5],1.7,.15)).toEqual([]);expect(table.values[face*8+7]).toBe(1);}
   expect(Array.from(source.index!.array)).toEqual(original);
  }finally{table.dispose();source.dispose();}
 });

 it('matches all four actual Source strip triangles, rough anchors and brush UVs at three real width settings',()=>{
  const source=new THREE.PlaneGeometry(2,3),table=compileFaceStrokeTable(source,budget),stock=createOrigamiBrushGeometry(source),p=stock.getAttribute('position'),uv=stock.getAttribute('uv'),index=stock.index!;
  try{
   for(const[width,rough]of [[.5,0],[1.7,.15],[5,1]] as const){
    updateOrigamiBrushGeometry(stock,width,rough);
    for(let first=0;first<index.count;first+=3){
     const vertices=[0,1,2].map(c=>index.getX(first+c)),x=vertices.reduce((v,i)=>v+p.getX(i),0)/3,y=vertices.reduce((v,i)=>v+p.getY(i),0)/3,edge=Math.floor(vertices[0]!/6),expected=[vertices.reduce((v,i)=>v+uv.getX(i),0)/3,vertices.reduce((v,i)=>v+uv.getY(i),0)/3],hit=queryFaceStrokeTable(table,0,[x/2+.5,y/3+.5],width,rough).find(h=>h.edge===edge);
     expect(hit,`${width}/${rough}, Source triangle ${first/3}`).toBeDefined();expect(hit!.uv[0]).toBeCloseTo(expected[0]!,4);expect(hit!.uv[1]).toBeCloseTo(expected[1]!,4);
     // Independently invert the actual positioned Source triangle. This also
     // checks explicit sampling gradients, beyond a shared alpha-mask shape.
     const[a,b,c]=vertices as[number,number,number],ax=p.getX(a)/2+.5,ay=p.getY(a)/3+.5,bx=p.getX(b)/2+.5-ax,by=p.getY(b)/3+.5-ay,cx=p.getX(c)/2+.5-ax,cy=p.getY(c)/3+.5-ay,det=bx*cy-cx*by,du=uv.getX(b)-uv.getX(a),dv=uv.getX(c)-uv.getX(a),eu=uv.getY(b)-uv.getY(a),ev=uv.getY(c)-uv.getY(a),jacobian=[(du*cy-dv*by)/det,(-du*cx+dv*bx)/det,(eu*cy-ev*by)/det,(-eu*cx+ev*bx)/det];
     for(let component=0;component<4;component++)expect(hit!.jacobian[component]!/Math.max(1,Math.abs(jacobian[component]!))).toBeCloseTo(jacobian[component]!/Math.max(1,Math.abs(jacobian[component]!)),3);
    }
   }
  }finally{stock.dispose();table.dispose();source.dispose();}
 });

 it('does not merge a real UV seam or independently masked coplanar body owner',()=>{
  for(const seam of ['uv','owner'] as const){const source=new THREE.PlaneGeometry().toNonIndexed();if(seam==='uv'){const uv=source.getAttribute('uv');for(let i=3;i<6;i++)uv.setX(i,uv.getX(i)+2);}else source.setAttribute('partMask',new THREE.Float32BufferAttribute([1,1,1,2,2,2],1));const table=compileFaceStrokeTable(source,budget);try{expect(table.faceCount).toBe(2);expect(table.sourceTriangleFaceIds[0]).not.toBe(table.sourceTriangleFaceIds[1]);}finally{table.dispose();source.dispose();}}
 });

 it('combines scalar records after original per-model seeds, preserving every hit and borrowed geometry',()=>{
  const sources=[new THREE.PlaneGeometry(2,3),new THREE.BoxGeometry(1,2,1)],tables=sources.map(source=>compileFaceStrokeTable(source,budget)),before=tables.map(t=>t.values.slice()),bank=combineFaceStrokeTables(tables,{maxCpuBytes:8*1024*1024});
  try{
   expect(bank.faceOffsets).toEqual([0,1]);expect(bank.table.faceCount).toBe(7);
   for(let model=0;model<tables.length;model++){const source=tables[model]!;for(let face=0;face<source.faceCount;face++)for(const point of [[.005,.2],[.5,.5],[.995,.8]] as const)expect(queryFaceStrokeTable(bank.table,bank.faceOffsets[model]!+face,point,1.7,.15)).toEqual(queryFaceStrokeTable(source,face,point,1.7,.15));expect(source.values).toEqual(before[model]);}
   tables[0]!.dispose();expect(()=>bank.table.assertCurrent()).not.toThrow();expect(queryFaceStrokeTable(bank.table,0,[.001,.2],1.7,.15).length).toBeGreaterThan(0);
  }finally{bank.dispose();for(const t of tables)t.dispose();for(const source of sources)source.dispose();}
 });

 it('refuses explicit budgets and edge-count overflow without consuming the source',()=>{
  const source=new THREE.BoxGeometry(),index=source.index,position=source.getAttribute('position');let disposed=0;source.addEventListener('dispose',()=>disposed++);
  try{expect(()=>compileFaceStrokeTable(source,{...budget,maxCpuBytes:1})).toThrow(/BEFORE allocation/);expect(()=>compileFaceStrokeTable(source,{...budget,maxEdgesPerFace:3})).toThrow(/edge-count/);expect(source.index).toBe(index);expect(source.getAttribute('position')).toBe(position);expect(disposed).toBe(0);}finally{source.dispose();}
 });
 it('keeps dynamic non-indexed triangle domains without inventing coplanar roof seams',()=>{
  const source=new THREE.PlaneGeometry(2,3).toNonIndexed(),grouped=compileFaceStrokeTable(source,budget),triangles=compileFaceStrokeTable(source,{...budget,mergeCoplanar:false,maxEdgesPerFace:3}),before=source.getAttribute('position').array.slice();
  try{expect(triangles.faceCount).toBe(2);expect(triangles.edgeCount).toBe(grouped.edgeCount);expect(triangles.maxEdgesPerFace).toBe(2);expect(Array.from(triangles.sourceVertex)).toEqual(Array.from({length:6},(_,i)=>i));
   for(const p of [[.001,.2],[.999,.8],[.2,.001],[.8,.999],[.5,.5]] as const){const expected=queryFaceStrokeTable(grouped,0,p,1.7,.15).map(h=>h.uv).sort((a,b)=>a[0]-b[0]||a[1]-b[1]),actual=[...queryFaceStrokeTable(triangles,0,p,1.7,.15),...queryFaceStrokeTable(triangles,1,p,1.7,.15)].map(h=>h.uv).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);expect(actual.length).toBe(expected.length);for(let i=0;i<actual.length;i++)for(let c=0;c<2;c++)expect(actual[i]![c]).toBeCloseTo(expected[i]![c]!,5);}
   expect(source.index).toBeNull();expect(source.getAttribute('position').array).toEqual(before);
  }finally{grouped.dispose();triangles.dispose();source.dispose();}
 });
 it('adds no GPU ownership attribute to live models and attaches only at explicit terminal retirement',()=>{
  const source=new THREE.PlaneGeometry(),table=compileFaceStrokeTable(source,budget),a=source.clone(),b=source.clone(),names=Object.keys(a.attributes);
  try{expect(Object.keys(a.attributes)).toEqual(names);attachFaceStrokeGpuRetirement(table,[a,b,a]);expect(Object.keys(a.attributes).length).toBe(names.length+1);expect(Object.values(a.attributes)).toContain(table.buffer);expect(Object.values(b.attributes)).toContain(table.buffer);expect(()=>table.assertCurrent()).not.toThrow();}finally{a.dispose();b.dispose();table.dispose();source.dispose();}
 });
});
