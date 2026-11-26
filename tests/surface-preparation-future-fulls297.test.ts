import {expect,test,vi} from 'vitest';
import type {World} from '../src/sim/types';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {PresentationQueue} from '../src/render/PresentationQueue';

// Actual coordinator and queue; GPU operations are narrow orchestration ports.
// Numeric Full metadata supplies no Native input or saved-World authority.
test('preparing Full21543 preserves queued Full21550 and21570 at their original times and frame gates',async()=>{
 const world=(tick:number,terrain:string)=>({tick,tiles:[{terrain}]} as unknown as World),target=world(2154,'rock'),open=world(2155,'rough-stone'),later=world(2157,'rough-stone'),queue=new PresentationQueue();
 queue.push(target,2154.2);queue.push(target,2154.3);queue.push(open,2155,8);queue.push(later,2157,9);
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;}),metadata=new WeakMap<object,{core:number}>([[target,{core:21543}]]);
 const owner:object=Object.assign(Object.create(SceneRenderCore.prototype),{world:target,coreFullInputs297:metadata,presentation:queue,
  disposed:false,closingPresentation:false,fatalError:undefined,preparing:true,holdSurfaceWorld:true,presentationSuspendedUntilFrame325:false,
  backend:'WebGL',texturesEnabled:false,graphicsStyle:{origami:false},hostPort:{hidden:()=>false},pendingSurfaceWorld:{world:target,reset:false,alreadyApplied:true},
  stageCoordinatedSurfaces:vi.fn(async()=>{await gate;return undefined;}),uploadSharedSurfaceAssets:vi.fn(),resources:{assertFixedTreeDrawReady:vi.fn()},
  applyAdmittedWorld:vi.fn((next:World)=>Reflect.set(owner,'world',next)),reportFailure:vi.fn(),invalidatePausedShadow:vi.fn(),presentCorePhases297:vi.fn(),updateSelectedObject:vi.fn(),updateHover:vi.fn()});
 const finish=Reflect.apply(Reflect.get(owner,'finishSurfacePreparation'),owner,[]) as Promise<void>;
 expect(queue.size).toBe(2);release();await finish;expect(queue.size).toBe(2);
 expect(queue.take(2154.9,undefined,100)).toBeUndefined();expect(queue.take(2155,undefined,7)).toBeUndefined();
 const first=queue.take(2155,undefined,8);expect(first).toBe(open);Reflect.apply(Reflect.get(owner,'applyWorld'),owner,[first]);
 expect(Reflect.get(owner,'world').tiles[0].terrain).toBe('rough-stone');
 expect(queue.take(2157,undefined,8)).toBeUndefined();const next=queue.take(2157,undefined,9);expect(next).toBe(later);Reflect.apply(Reflect.get(owner,'applyWorld'),owner,[next]);
 expect(Reflect.get(owner,'world')).toBe(later);expect(queue.take(2157,undefined,100)).toBeUndefined();
 expect(Reflect.get(owner,'applyAdmittedWorld').mock.calls.map((row:World[])=>row[0])).toEqual([open,later]);
 expect(Reflect.get(owner,'reportFailure')).not.toHaveBeenCalled();
});

test('discarding a prepared prefix leaves future same-civil Core entries, gates and observer ownership intact',()=>{
 const clear=vi.fn(),queue=new PresentationQueue({clear,read:()=>''}),a={tick:2154} as World,b={tick:2154} as World,c={tick:2155} as World;
 queue.push(a,2154.3);queue.push(b,2154.7,8);queue.push(c,2155,9);queue.discardThrough(2154.3);
 expect(clear).not.toHaveBeenCalled();expect(queue.take(2154.6,undefined,100)).toBeUndefined();expect(queue.take(2154.7,undefined,7)).toBeUndefined();expect(queue.take(2154.7,undefined,8)).toBe(b);
 expect(()=>queue.discardThrough(NaN)).toThrow('Invalid presentation discard frontier');expect(queue.size).toBe(1);expect(queue.take(2155,undefined,9)).toBe(c);
 queue.push(a,2154.3);queue.clear();expect(clear).toHaveBeenCalledOnce();expect(queue.size).toBe(0);
});

test('a Full admitted during a surface hold also keeps later queued Fulls instead of clearing their gates',()=>{
 const world=(tick:number)=>({schemaVersion:256,tick,seed:42,width:32,height:32} as unknown as World),previous=world(9),target=world(10),future=world(11),queue=new PresentationQueue();
 queue.push(previous,9);queue.push(future,11,8);
 const owner=Object.assign(Object.create(SceneRenderCore.prototype),{disposed:false,fatalError:undefined,presentationStopped:false,holdSurfaceWorld:true,
  coreFullInputs297:new WeakMap(),received:{world:previous},pendingCore297:[],presentation:queue,immutableWorlds:new WeakSet(),hasTracks:false,
  releaseCalmFullFrame297:vi.fn(),invalidatePausedShadow:vi.fn(),projectiles:{adopt:vi.fn()},hostPort:{hidden:()=>false},reportFailure:vi.fn()});
 Reflect.apply(Reflect.get(owner,'setWorld'),owner,[target,false,1]);
 expect(Reflect.get(owner,'reportFailure')).not.toHaveBeenCalled();expect(Reflect.get(owner,'pendingSurfaceWorld').world).toBe(target);
 expect(queue.size).toBe(1);expect(queue.take(11,undefined,7)).toBeUndefined();expect(queue.take(11,undefined,8)).toBe(future);
});
