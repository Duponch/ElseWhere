import {pileLabelAnchor} from '../src/render/map-label-anchors';
import {SHELF_LEVELS} from '../src/render/shelf-presentation';
import {afterEach,expect,test,vi} from 'vitest';
import {BufferAttribute,OrthographicCamera} from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {newShelfStorage} from '../src/sim/shelf-storage';
import {MapLabelsOverlay} from '../src/render/MapLabelsOverlay';
import {pileIdentitySurfaces} from '../src/render/pile-surfaces';
import type {MaterialPile,World} from '../src/sim/types';

afterEach(()=>vi.unstubAllGlobals());
test('shelf quantities retain real IDs and heights; layout changes update while policy and steady frames retain GPU buffers',()=>{
  const context={setTransform:vi.fn(),clearRect:vi.fn(),strokeText:vi.fn(),fillText:vi.fn(),measureText:(text:string)=>({width:7*text.length})},canvas={width:0,height:0,getContext:()=>context};
  vi.stubGlobal('document',{createElement:()=>canvas});vi.stubGlobal('window',{devicePixelRatio:1});
  const overlay=new MapLabelsOverlay(),camera=new OrthographicCamera(-6,6,6,-6,.1,100);
  camera.position.set(8,12,10);camera.lookAt(4,0,4);camera.updateProjectionMatrix();
  let w:World=createWorld(42,8);w.structures=[{id:50,kind:'small-shelf',x:4,z:4,orientation:0,footprint:'standard',material:'wood',shelf:newShelfStorage([51])}];w.packed=[];
  w.piles=[3,1,2].map(n=>({id:60+n,kind:'wood',item:'wood',quantity:11*n,owner:{type:'ground',x:4,z:4}} as MaterialPile));
  overlay.draw(w,camera,120,800,600);const entries=overlay['chunks'].flatMap(c=>c.entries),supports=pileIdentitySurfaces(w);
  expect(entries.map(e=>e.label)).toEqual(['33','11','22']);expect(new Set(entries.map(e=>e.y)).size).toBe(3);
  for(const e of entries){const support=supports.get(e.pileId!)!;expect(e.x).toBe(4+support.x);expect(e.y).toBe(pileLabelAnchor(w.piles.find(p=>p.id===e.pileId)!,support).y);expect(e.z).toBe(4+support.z);}
  expect(overlay.mesh.geometry.instanceCount).toBe(6);
  const anchors=overlay.mesh.geometry.getAttribute('labelAnchor');if(!(anchors instanceof BufferAttribute))throw Error('Expected anchor buffer');
  const version=anchors.version,geometry=overlay.mesh.geometry;
  for(let i=0;i<entries.length;i++){const e=entries[i]!;expect([anchors.getX(i*2),anchors.getY(i*2),anchors.getZ(i*2)]).toEqual([Math.fround(e.x),Math.fround(e.y),Math.fround(e.z)]);}
  const stationary=overlay['chunks'];overlay.draw(w,camera,120,800,600);expect(overlay.mesh.geometry).toBe(geometry);expect(anchors.version).toBe(version);
  w={...w,structures:w.structures.map(s=>({...s,damage:1,shelf:{...s.shelf!,settings:{...s.shelf!.settings,priority:5}}}))};
  overlay.draw(w,camera,120,800,600);expect(overlay['chunks']).toBe(stationary);expect(anchors.version).toBe(version);
  w={...w,structures:w.structures.map(s=>({...s,orientation:1}))};overlay.draw(w,camera,120,800,600);expect(anchors.version).toBeGreaterThan(version);expect(overlay['chunks']).not.toBe(stationary);
  w={...w,piles:w.piles.filter(p=>p.id!==61)};overlay.draw(w,camera,120,800,600);expect(overlay.mesh.geometry.instanceCount).toBe(4);
  const two=overlay['chunks'].flatMap(c=>c.entries);expect(two.map(e=>e.pileId).sort()).toEqual([62,63]);expect(two.map(e=>e.y).sort()).toEqual([SHELF_LEVELS[0]!+.43700159311294556,SHELF_LEVELS[1]!+.43700159311294556]);
  w={...w,structures:[]};overlay.draw(w,camera,120,800,600);expect(overlay['chunks'].flatMap(c=>c.entries).every(e=>e.y===pileLabelAnchor(w.piles.find(p=>p.id===e.pileId)!).y)).toBe(true);
  const groundAnchors=overlay.mesh.geometry.getAttribute('labelAnchor');for(let i=0;i<overlay.mesh.geometry.instanceCount;i++)expect(groundAnchors.getY(i)).toBe(Math.fround(pileLabelAnchor(w.piles[0]!).y));
  overlay.dispose();
});

test('full block stacks on all three shelf levels place captions above their own scaled blocks',()=>{
  const context={setTransform:vi.fn(),strokeText:vi.fn(),fillText:vi.fn(),measureText:(text:string)=>({width:7*text.length})};
  vi.stubGlobal('document',{createElement:()=>({width:0,height:0,getContext:()=>context})});
  const overlay=new MapLabelsOverlay(),camera=new OrthographicCamera(-6,6,6,-6,.1,100);
  camera.position.set(8,12,10);camera.lookAt(4,0,4);camera.updateProjectionMatrix();
  const world=createWorld(42,8);world.structures=[{id:50,kind:'small-shelf',x:4,z:4,orientation:0,footprint:'standard',material:'wood',shelf:newShelfStorage([51])}];world.packed=[];
  world.piles=[1,2,3].map((n):MaterialPile=>({id:60+n,kind:'blocks',item:'granite-blocks',quantity:75,owner:{type:'ground',x:4,z:4}}));
  overlay.draw(world,camera,120,800,600);
  const entries=overlay['chunks'].flatMap(chunk=>chunk.entries);expect(entries.map(entry=>entry.pileId)).toEqual([61,62,63]);expect(entries.map(entry=>entry.label)).toEqual(['75','75','75']);
  for(let i=0;i<entries.length;i++)expect(entries[i]!.y).toBeCloseTo(SHELF_LEVELS[i]!+.59+.02,12);
  // Do not lift a lower shelf caption above an upper board to bypass depth.
  expect(entries[0]!.y).toBeLessThan(SHELF_LEVELS[1]!-.07);expect(entries[1]!.y).toBeLessThan(SHELF_LEVELS[2]!-.07);
  const anchors=overlay.mesh.geometry.getAttribute('labelAnchor');for(let i=0;i<entries.length;i++)expect(anchors.getY(i*2)).toBe(Math.fround(entries[i]!.y));
  overlay.dispose();
});
