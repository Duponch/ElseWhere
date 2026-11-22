import {expect,test,vi} from 'vitest';
import {Group,OrthographicCamera,Texture} from 'three/webgpu';
import {applyCommand} from '../src/sim/engine';
import {validateWorld,serializeWorld} from '../src/sim/serialization';
import {treeTransferScene,preparedTreeWrapper} from './scenarios/tree-transfer-v349';
import {designationIconInstances,DesignationIconLayer,isIconDesignationKind,TREE_DESIGNATION_ATLAS_URL} from '../src/render/DesignationIconLayer';
import {buildJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts} from '../src/render/construction-ghosts';
import {floraSize,floraTreeHeight} from '../src/render/flora-presentation';
import {noise} from '../src/render/StaticGeometry';
import {WORLD_SCALE} from '../src/world/scale';
import {pictogramSvg,UI_ATLAS_URL} from '../src/ui/pictograms';
import {ARCHITECT_ICON_ATLASES} from '../src/ui/architect-icons';
import type {BoxBatches} from '../src/render/BoxBatches';
import type {Placement} from '../src/render/primitives';
import type {SceneTextureLoader} from '../src/render/scene-render-ports';

// Renderer readers qualify real admitted intentions; no work/production is
// simulated here and no visual marker is treated as a completed tree transfer.
test.each(['oak',null] as const)('V349 actual %s extraction has a shovel at current source height without World mutation',species=>{
  const w=treeTransferScene(species,.4),source=w.resources[0]!;expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'extract-tree',resourceId:source.id})).toMatchObject({ok:true});expect(validateWorld(w)).toEqual([]);
  const before=serializeWorld(w),instances=designationIconInstances(w),height=source.species?floraTreeHeight(source)*floraSize(w,source):WORLD_SCALE.treeMinHeight+noise(source.x,source.z,77)*(WORLD_SCALE.treeMaxHeight-WORLD_SCALE.treeMinHeight);
  expect(instances).toEqual([{x:source.x,y:height*.72,z:source.z,icon:80}]);expect(isIconDesignationKind('extract-tree')).toBe(true);expect(serializeWorld(w)).toBe(before);
});

test('V349 actual replant location has its distinct sprout and neither tree intention creates cube, tint or assembly progress',()=>{
  const {w,pile}=preparedTreeWrapper('pine',.5);expect(validateWorld(w)).toEqual([]);
  expect(applyCommand(w,{type:'replant-tree',pileId:pile.id,x:20,z:14})).toMatchObject({ok:true});expect(validateWorld(w)).toEqual([]);
  expect(designationIconInstances(w)).toEqual([{x:20,y:1.08,z:14,icon:81}]);expect(isIconDesignationKind('replant-tree')).toBe(true);
  expect(applyCommand(w,{type:'designate',kind:'wall',x:8,z:7,material:'wood'})).toMatchObject({ok:true});expect(validateWorld(w)).toEqual([]);
  const before=serializeWorld(w),rows=new Map<string,Placement[]>(),sink={set(_group:Group,key:string,parts:Placement[]){rows.set(key,parts);}};
  // 22 November: the wall to build is its ghost only (no tinted cell, no plan box).
  const ghosts=new ConstructionGhosts();buildJobMarkers(w,new Group(),false,sink as unknown as BoxBatches,ghosts);
  const wallId=w.jobs.find(j=>j.kind==='wall')!.id;expect(rows.get('job-orders')).toEqual([]);expect(rows.has('job-plans')).toBe(false);expect(rows.get('job-solids')).toEqual([]);
  expect(ghosts.allParts().length).toBeGreaterThan(0);expect(ghosts.allParts().every(p=>p.key===wallId)).toBe(true);expect(serializeWorld(w)).toBe(before);ghosts.dispose();
  const extraction=treeTransferScene('oak',.4);expect(applyCommand(extraction,{type:'extract-tree',resourceId:extraction.resources[0]!.id}).ok).toBe(true);
  rows.clear();buildJobMarkers(extraction,new Group(),false,sink as unknown as BoxBatches);expect([...rows.values()].flat()).toEqual([]);
});

test('V349 vector atlas contains the shared shovel and sprout in separate slots and releases late loads',()=>{
  const svg=decodeURIComponent(TREE_DESIGNATION_ATLAS_URL.split(',')[1]!);expect(svg).toContain('viewBox="0 0 128 64"');
  for(const [id,x] of [['extract-tree',0],['replant-tree',64]] as const){const expected=pictogramSvg(id).replace('<svg ',`<svg x="${x}" y="0" `).replace('width="96" height="96"','width="64" height="64"');expect(svg).toContain(expected);}
  const pending:{url:string;complete:(t:Texture)=>void}[]=[],loader:SceneTextureLoader=(url,complete)=>{pending.push({url,complete});},layer=new DesignationIconLayer(loader);
  expect(pending.map(p=>p.url)).toEqual([UI_ATLAS_URL,...ARCHITECT_ICON_ATLASES,TREE_DESIGNATION_ATLAS_URL]);
  const loaded=new Texture(),late=new Texture(),disposed=vi.spyOn(loaded,'dispose'),lateDisposed=vi.spyOn(late,'dispose');pending[3]!.complete(loaded);layer.dispose();pending[3]!.complete(late);expect(disposed).toHaveBeenCalledOnce();expect(lateDisposed).toHaveBeenCalledOnce();
});

test('V349 tree billboard buffers remain resident, vanish on real cancellation and presentation reads no World',()=>{
  const {w,pile}=preparedTreeWrapper();expect(applyCommand(w,{type:'replant-tree',pileId:pile.id,x:20,z:14})).toMatchObject({ok:true});expect(validateWorld(w)).toEqual([]);
  const layer=new DesignationIconLayer(()=>undefined);
  try{layer.update(w);const geometry=layer.mesh.geometry,material=layer.mesh.material,positions=geometry.getAttribute('designationPosition');if(!('version' in positions))throw Error('Expected resident non-interleaved positions');const version=positions.version;
    layer.update(w);expect(positions.version).toBe(version);expect(geometry.instanceCount).toBe(1);expect(geometry.getAttribute('designationIcon').getX(0)).toBe(81);
    const job=w.jobs[0]!;expect(applyCommand(w,{type:'cancel-job',jobId:job.id})).toMatchObject({ok:true});expect(validateWorld(w)).toEqual([]);layer.update(w);expect(geometry.instanceCount).toBe(0);expect(layer.mesh.visible).toBe(false);
    for(const key of ['jobs','resources','piles'])Object.defineProperty(w,key,{get(){throw Error('Presentation re-read '+key);}});
    layer.present(new OrthographicCamera(),1000,64);expect(layer.mesh.geometry).toBe(geometry);expect(layer.mesh.material).toBe(material);expect(geometry.getAttribute('designationPosition')).toBe(positions);
  }finally{layer.dispose();}
});