import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {newShelfStorage} from '../src/sim/shelf-storage';
import type {MaterialPile,World} from '../src/sim/types';
import {SceneApplicationContext} from '../src/render/SceneApplicationContext';
import {pileIdentitySurfaces,pileSurfaces} from '../src/render/pile-surfaces';
import {harness} from './resident-presentation-fixtures-v427';

test('phase views retain pile supports and immutable ordinals across subsequent cumulative edits',()=>{
 const live=createWorld(414,32,32);live.tiles=live.tiles.map(()=>({terrain:'grass'}));live.resources=[];live.jobs=[];
 live.structures=[{id:live.nextId++,kind:'small-shelf',material:'wood',x:10,z:10,orientation:0,footprint:'standard',shelf:newShelfStorage([live.nextId++],live.schemaVersion)}];
 live.piles=[{id:live.nextId++,kind:'wood',item:'wood',quantity:2,owner:{type:'ground',x:10,z:10}},{id:live.nextId++,kind:'wood',item:'wood',quantity:3,owner:{type:'ground',x:11,z:10}}];
 const context=new SceneApplicationContext(),a=harness(live).send();
 try{
  expect(context.prepare(a)).toBeDefined();context.commit(a);
  const base=context.readSupports(a)!;
  const patches=new Map<number,Readonly<MaterialPile>|null>(),pose:World={...a,phaseCore297:1};
  expect(context.preparePileView297(pose,a,patches)).toBe(true);
  expect(context.readSupports(pose)!.cells).toBe(base.cells);expect(context.readSupports(pose)!.identities).toBe(base.identities);
  const id=a.piles[0]!.id,other=a.piles[1]!.id;
  const ground={...a.piles[0]!,owner:{type:'ground' as const,x:7,z:7}};patches.set(id,ground);
  const view={...a,piles:[ground,a.piles[1]!],phaseCore297:2};
  expect(context.preparePileView297(view,a,patches,pose)).toBe(true);
  expect(context.readSupports(view)!.identities).toStrictEqual(pileIdentitySurfaces(view));
  const support=context.readSupports(view),directory=context.piles.viewDirectory297(view)!;
  const nextPose={...view,phaseCore297:3};
  expect(context.preparePileView297(nextPose,a,patches,view)).toBe(true);
  expect(context.readSupports(nextPose)).toBe(support);
  expect(context.metrics().phaseShelfBuilds).toBe(1);
  patches.set(id,null);
  const removed={...a,piles:[a.piles[1]!],phaseCore297:4};
  expect(context.preparePileView297(removed,a,patches,nextPose)).toBe(true);
  expect(context.piles.viewDirectory297(removed)!.source(id)).toBeUndefined();
  expect(context.piles.viewDirectory297(removed)!.source(other)).toBe(0);
  // The earlier view still supplies cargo endpoints, with its earlier ordinals.
  expect(directory.source(id)).toBe(0);expect(directory.source(other)).toBe(1);
  expect(context.piles.viewDirectory297(nextPose)!.source(id)).toBe(0);
  expect(context.readSupports(removed)!.cells).toStrictEqual(pileSurfaces(removed));
  expect(context.readSupports(removed)!.identities).toStrictEqual(pileIdentitySurfaces(removed));
  expect(context.readSupports(a)).toBe(base);
 }finally{context.clear();}
});
