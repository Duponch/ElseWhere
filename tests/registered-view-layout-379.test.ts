import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {flushRegisteredMap,registeredMap} from '../src/sim/world-map-context.ts';

test('local views preserve property order, live campaign fields and independent local writes',()=>{
  const root=createWorld(17,24,24),map=registeredMap(root,0)!;
  expect(map).not.toBe(root);
  const shared=Object.getOwnPropertyDescriptor(map,'tick')!,local=Object.getOwnPropertyDescriptor(map,'piles')!;
  expect(shared).toMatchObject({enumerable:true,configurable:false});
  expect(typeof shared.get).toBe('function');expect(typeof shared.set).toBe('function');
  expect(local).toMatchObject({value:root.piles,writable:true,enumerable:true,configurable:true});
  const keys=Object.keys(map);
  expect(keys.slice(0,Object.keys(root).length)).toEqual(Object.keys(root));
  root.tick=41;expect(map.tick).toBe(41);
  const id=root.nextId;map.nextId++;expect(root.nextId).toBe(id+1);
  const old=root.piles;map.piles=old.slice();expect(root.piles).toBe(old);
  flushRegisteredMap(map);expect(root.piles).toBe(map.piles);
  expect(registeredMap(root,0)).toBe(map);
  expect(Object.getOwnPropertyDescriptor(map,'civilianPost')).toMatchObject({enumerable:true,configurable:true});
});
