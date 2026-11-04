import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {compileFaceStrokeTable,queryFaceStrokeTable} from '../src/render/surfaces/FaceStrokeTable';
import {MutableFaceStrokeBank} from '../src/render/surfaces/MutableFaceStrokeBank';

test('dynamic scalar bank preserves Source addresses across growth and reuses only released model regions',()=>{
 const plane=new THREE.PlaneGeometry(2,3),box=new THREE.BoxGeometry(),options={maxCpuBytes:8*1024*1024,maxTriangles:1000},a=compileFaceStrokeTable(plane,options),b=compileFaceStrokeTable(box,options),bank=new MutableFaceStrokeBank(1024*1024),node=bank.node;
 try{const first=bank.publish(a),before=bank.buffer,base=bank.values.slice(first.rowStart*4,(first.rowStart+first.rows)*4),second=bank.publish(b);expect(bank.node).toBe(node);expect(bank.buffer).not.toBe(before);expect(bank.values.slice(first.rowStart*4,(first.rowStart+first.rows)*4)).toEqual(base);
  for(const[table,region]of [[a,first],[b,second]] as const)for(let face=0;face<table.faceCount;face++)for(const point of [[.001,.2],[.5,.5],[.999,.8]] as const)expect(queryFaceStrokeTable(bank,face+region.faceOffset,point,1.7,.15)).toEqual(queryFaceStrokeTable(table,face,point,1.7,.15));
  first.release();first.release();const third=bank.publish(a);expect(third.rowStart).toBe(first.rowStart);expect(bank.snapshot().regions).toBe(2);expect(bank.node).toBe(node);second.release();third.release();expect(bank.snapshot().regions).toBe(0);expect(bank.snapshot().allocatedGpuUpperBoundBytes).toBeLessThan(bank.cpuBytes*2+256);
 }finally{bank.dispose();a.dispose();b.dispose();plane.dispose();box.dispose();}
});

test('bank capacity refusal leaves its existing owner, node and data intact',()=>{
 const plane=new THREE.PlaneGeometry(),table=compileFaceStrokeTable(plane,{maxCpuBytes:1024*1024,maxTriangles:1000}),bank=new MutableFaceStrokeBank(256),node=bank.node,buffer=bank.buffer,values=bank.values.slice();
 try{expect(()=>bank.publish(table)).toThrow(/BEFORE allocation/);expect(bank.node).toBe(node);expect(bank.buffer).toBe(buffer);expect(bank.values).toEqual(values);expect(bank.snapshot().regions).toBe(0);}finally{table.dispose();plane.dispose();bank.dispose();}
});
