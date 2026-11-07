/** Actual SceneRenderCore.finishSurfacePreparation and the actual shared surface
 * registry. Staging, scene application and GPU work are TEST ports: no device. */
import {expect,test,vi} from 'vitest';
import type {World} from '../src/sim/types';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {SharedSurfacePreparationRegistry,SurfacePreparationSuperseded,type SharedSurfacePreparationBatch,type SharedSurfacePreparationOwner,type SharedSurfacePreparationSnapshot} from '../src/render/surfaces/SharedSurfacePreparation';

const world=(tick:number)=>({tick} as unknown as World);
function core(stage:(attempt:number)=>SharedSurfacePreparationBatch|undefined){
  let attempts=0;
  const registry={invalidate:vi.fn()};
  const owner:object=Object.assign(Object.create(SceneRenderCore.prototype),{
    disposed:false,closingPresentation:false,fatalError:undefined,preparing:true,holdSurfaceWorld:true,presentationSuspendedUntilFrame325:false,
    backend:'WebGL',texturesEnabled:false,graphicsStyle:{origami:false,surfacePreparation:registry},
    hostPort:{hidden:()=>false},presentation:{clear:vi.fn()},resources:{assertFixedTreeDrawReady:vi.fn()},
    applyAdmittedWorld:vi.fn(),uploadSharedSurfaceAssets:vi.fn(),reportFailure:vi.fn(),invalidatePausedShadow:vi.fn(),
    presentCorePhases297:vi.fn(),updateSelectedObject:vi.fn(),updateHover:vi.fn(),
    stageCoordinatedSurfaces:vi.fn(async()=>stage(attempts++)),
  });
  return {owner,registry,attempts:()=>attempts};
}
const batch=()=>({ownerKeys:[],publish:vi.fn(),commit:vi.fn(),rollback:vi.fn(),dispose:vi.fn()} as unknown as SharedSurfacePreparationBatch);
const finish=(owner:object)=>Reflect.apply(Reflect.get(owner,'finishSurfacePreparation') as ()=>Promise<void>,owner,[]);

test('a preparation superseded by a camera, density or demand change prepares again instead of failing the display',async()=>{
  const done=batch(),{owner,attempts}=core(attempt=>{if(attempt<2)throw new SurfacePreparationSuperseded('Shared actor density changed before publication');return done;});
  Reflect.set(owner,'pendingSurfaceWorld',{world:world(7),reset:true});
  await finish(owner);
  expect(attempts()).toBe(3);
  expect(Reflect.get(owner,'reportFailure')).not.toHaveBeenCalled();
  // The World is applied once, then only its surfaces are prepared again.
  expect(Reflect.get(owner,'applyAdmittedWorld')).toHaveBeenCalledOnce();
  expect(Reflect.get(owner,'stageCoordinatedSurfaces')).toHaveBeenNthCalledWith(3,'world',expect.any(Function),true);
  expect(done.publish).toHaveBeenCalledOnce();expect(done.commit).toHaveBeenCalledOnce();
  expect(Reflect.get(owner,'preparing')).toBe(false);expect(Reflect.get(owner,'holdSurfaceWorld')).toBe(false);
});

test('a preparation that keeps being superseded leaves its demand for the next frame, still without a failure',async()=>{
  const {owner,registry,attempts}=core(()=>{throw new SurfacePreparationSuperseded('Shared surface demand changed during preparation');});
  const target=world(9);Reflect.set(owner,'pendingSurfaceWorld',{world:target,reset:false});
  await finish(owner);
  expect(attempts()).toBe(9);
  expect(Reflect.get(owner,'reportFailure')).not.toHaveBeenCalled();
  expect(registry.invalidate).toHaveBeenCalledOnce();
  expect(Reflect.get(owner,'pendingSurfaceWorld')).toEqual({world:target,reset:false,alreadyApplied:true});
});

test('an ordinary preparation error still stops the display with its message',async()=>{
  const {owner}=core(()=>{throw Error('TEST GPU failure');});
  Reflect.set(owner,'pendingSurfaceWorld',{world:world(3),reset:false});
  await expect(finish(owner)).rejects.toThrow('TEST GPU failure');
  expect(Reflect.get(owner,'reportFailure')).toHaveBeenCalledWith('Préparation du dernier affichage interrompue : TEST GPU failure');
});

test('the registry reports a demand change during staging as a supersession, not a failure',async()=>{
  let open!:()=>void;const registry=new SharedSurfacePreparationRegistry(),gate={promise:new Promise<void>(resolve=>{open=resolve;}),resolve:()=>open()};
  const owner:SharedSurfacePreparationOwner={key:'TEST',needsPreparation:()=>true,stage:async()=>{await gate.promise;return {publish(){},commit(){},rollback(){},dispose(){}} as never;}};
  registry.register(owner);
  const staged=registry.stage({reason:'world'} as SharedSurfacePreparationSnapshot,()=>{});
  registry.invalidate();gate.resolve();
  await expect(staged).rejects.toBeInstanceOf(SurfacePreparationSuperseded);
  registry.dispose();
});
