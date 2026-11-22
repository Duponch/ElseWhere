import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {ActionVfxLayer} from '../src/render/ActionVfxLayer';
import type {World} from '../src/sim/types';

/** DECLARED RENDERER PROJECTIONS ONLY. These minimal input records are not
 * valid Engine Worlds, RAWs, campaigns, played commands or Native authority.
 * Real production layers consume real source attributes. No source-code oracle.
 * Prospective contracts, not run by their author. */
const names=['aFrom','aTo','aTravel'] as const;
function camera(pixels:number){const half=50/pixels,c=new THREE.OrthographicCamera(-half,half,half,-half,.1,1000);c.position.set(8,20,30);c.lookAt(8,0,8);c.updateProjectionMatrix();return c;}
function source(count:number){const g=new THREE.InstancedBufferGeometry();g.instanceCount=count;for(const name of names)g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(count*4),4));for(let row=0;row<count;row++){g.getAttribute('aFrom').setXYZW(row,8+row,0,8,0);g.getAttribute('aTo').setXYZW(row,8+row,0,8,0);g.getAttribute('aTravel').setXYZW(row,0,0,0,1);}return g;}
function projection(count:number):World{return{schemaVersion:296,tick:100,pawns:Array.from({length:count},(_,i)=>({id:31+i,x:8+i,z:8,state:'idle',jobId:null})),jobs:[],structures:[]} as unknown as World;}
function rows(g:THREE.BufferGeometry){return names.map(name=>Array.from(g.getAttribute(name).array));}
function components(g:THREE.BufferGeometry,name:string,row:number){const a=g.getAttribute(name);return[0,1,2,3].map(i=>a.getComponent(row,i));}
function version(g:THREE.BufferGeometry,name:string){const a=g.getAttribute(name);return a instanceof THREE.InterleavedBufferAttribute?a.data.version:(a as THREE.BufferAttribute).version;}
function move(g:THREE.BufferGeometry){for(const [field,name]of names.entries()){const a=g.getAttribute(name) as THREE.InstancedBufferAttribute;for(let row=0;row<a.count;row++)a.setXYZW(row,10+row+field*.125,field*.25,9+row*.25,.1+field*.2);a.needsUpdate=true;}}

test('original middle Action copies changed source poses with unchanged compact membership, then pauses without uploads and removes far rows',()=>{
 const world=projection(3);world.pawns[1]!.state='sleeping';const raw=JSON.stringify(world),stream=source(3),detail=new AnimationDetail(),clock={travelTime:uniform(0),blend:uniform(1)},layer=new ActionVfxLayer(clock,detail);
 const frame=(ms:number,pixels:number,tick=100.12)=>{detail.beginFrame(ms,camera(pixels),100,tick);layer.present(tick);};
 try{
  detail.beginFrame(0,camera(16),100,100);layer.update(world,stream);layer.present(100);
  const g=layer.mesh.geometry,slots=g.getAttribute('fxSlot'),initial=rows(g),geometry=g;
  expect(g.instanceCount).toBe(1);expect(slots.getX(0)).toBe(1);expect(detail.classify(9,0,8)).toBe(1);
  move(stream);const input=rows(stream),versions=names.map(name=>version(g,name));
  frame(20,16);
  expect(g.instanceCount).toBe(1);expect(slots.getX(0)).toBe(1);expect(g).toBe(geometry);
  for(const name of names)expect(components(g,name,0)).toEqual(components(stream,name,1));
  expect(rows(g)).not.toEqual(initial);expect(rows(stream)).toEqual(input);expect(JSON.stringify(world)).toBe(raw);
  const moved=rows(g),movedVersions=names.map(name=>version(g,name));expect(movedVersions.every((v,i)=>v>versions[i]!)).toBe(true);
  frame(40,16);expect(rows(g)).toEqual(moved);expect(names.map(name=>version(g,name))).toEqual(movedVersions);expect(rows(stream)).toEqual(input);
  frame(60,5);expect(g.instanceCount).toBe(0);expect(layer.mesh.visible).toBe(false);expect(rows(stream)).toEqual(input);
  frame(80,50);expect(g.instanceCount).toBe(1);expect(slots.getX(0)).toBe(1);for(const name of names)expect(components(g,name,0)).toEqual(components(stream,name,1));
  expect(JSON.stringify(world)).toBe(raw);
 }finally{layer.dispose();stream.dispose();}
});

