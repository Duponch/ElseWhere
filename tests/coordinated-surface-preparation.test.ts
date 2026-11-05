/** Actual registry/Core methods with explicit orchestration ports only.
 * No GPU, Canvas, current Native packet, image or performance claim. */
import {afterEach,expect,test,vi} from 'vitest';
import type {WebGPURenderer} from 'three/webgpu';
import {SharedSurfacePreparationRegistry,type SharedSurfacePreparationOwner,type SharedSurfacePreparationSnapshot,type SharedSurfacePreparationStage} from '../src/render/surfaces/SharedSurfacePreparation';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import type {World} from '../src/sim/types';
afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(yes=>{resolve=yes;});return{promise,resolve};}
const world=(tick:number)=>({tick,width:16,height:16,resources:[],pawns:[]} as unknown as World);
const snapshot=(tick=1):SharedSurfacePreparationSnapshot=>({preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0},world:world(tick),reset:false,reason:'world',epoch:1,paintRevision:3,renderer:{} as WebGPURenderer});
function port(key:string,events:string[],gate?:Promise<void>){
 let dirty=true,published=false,committed=false,closed=false;
 const stage:SharedSurfacePreparationStage={publish:vi.fn(()=>{events.push(key+':publish');published=true;}),commit:vi.fn(()=>{events.push(key+':commit');committed=true;dirty=false;}),rollback:vi.fn(()=>{if(committed)throw Error('TEST committed owner');events.push(key+':rollback');published=false;}),dispose:vi.fn(()=>{if(closed)return;events.push(key+':dispose');if(published&&!committed){stage.rollback();}closed=true;})};
 const owner:SharedSurfacePreparationOwner={key,needsPreparation:()=>dirty,stage:vi.fn(async(_snapshot,assertCurrent)=>{events.push(key+':stage');if(gate)await gate;assertCurrent();return stage;})};
 return{owner,stage,published:()=>published,committed:()=>committed};
}
test('all actual owners finish staging before any binding publishes and one commit settles the shared dirty latch',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],gate=deferred(),a=port('coefficients',events),b=port('rgba',events,gate.promise),releaseA=registry.register(a.owner),releaseB=registry.register(b.owner);
 const pending=registry.stage(snapshot(),()=>{});await Promise.resolve();await Promise.resolve();expect(events).toEqual(['coefficients:stage','rgba:stage']);expect(a.published()).toBe(false);expect(()=>registry.assertReadyForDraw()).toThrow();gate.resolve();const batch=await pending;
 try{batch.publish();expect(events.slice(-2)).toEqual(['coefficients:publish','rgba:publish']);expect(()=>registry.assertReadyForDraw()).toThrow();batch.commit();batch.dispose();expect(()=>registry.assertReadyForDraw()).not.toThrow();expect(registry.snapshot().stagedReferences).toBe(0);}finally{batch.dispose();releaseA();releaseB();registry.dispose();}
});
test('failure in another owner rolls back every published binding before staged resources retire',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],a=port('coefficients',events),b=port('rgba',events);vi.mocked(b.stage.publish).mockImplementation(()=>{events.push('rgba:publish-failed');throw Error('TEST rgba publication');});registry.register(a.owner);registry.register(b.owner);const batch=await registry.stage(snapshot(),()=>{});
 try{expect(()=>batch.publish()).toThrow('TEST rgba publication');expect(a.published()).toBe(false);expect(events.indexOf('rgba:rollback')).toBeLessThan(events.indexOf('coefficients:rollback'));expect(a.stage.commit).not.toHaveBeenCalled();expect(registry.dirty).toBe(true);}finally{batch.dispose();registry.dispose();}
});
test('a resolved candidate is retained immediately when a post-await demand invalidates and cleanup initially fails',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],candidate=port('rgba',events);let cleanupFails=true;
 vi.mocked(candidate.owner.stage).mockImplementation(async()=>{registry.invalidate();return candidate.stage;});vi.mocked(candidate.stage.dispose).mockImplementation(()=>{if(cleanupFails)throw Error('TEST dispose failed');events.push('rgba:disposed');});registry.register(candidate.owner);
 await expect(registry.stage(snapshot(),()=>{})).rejects.toThrow('staging cleanup failed');expect(registry.snapshot().stagedReferences).toBe(1);expect(()=>registry.dispose()).toThrow('close quarantined');expect(registry.snapshot().stagedReferences).toBe(1);cleanupFails=false;registry.dispose();expect(registry.snapshot().stagedReferences).toBe(0);
});
test('a partial owner transfer cannot claim rollback success or release the presentation as prepared',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],a=port('coefficients',events),b=port('rgba',events);vi.mocked(b.stage.commit).mockImplementation(()=>{throw Error('TEST owner transfer failed');});registry.register(a.owner);registry.register(b.owner);const batch=await registry.stage(snapshot(),()=>{});batch.publish();expect(()=>batch.commit()).toThrow('owner transfer');expect(batch.state).toBe('quarantined');expect(()=>batch.rollback()).toThrow('Committed');expect(registry.dirty).toBe(true);batch.dispose();registry.dispose();
});
test('registration removal during an await refuses the stale batch without publishing a borrowed owner',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],gate=deferred(),a=port('rgba',events,gate.promise);vi.mocked(a.owner.stage).mockImplementation(async()=>{await gate.promise;return a.stage;});const release=registry.register(a.owner),pending=registry.stage(snapshot(),()=>{});release();gate.resolve();await expect(pending).rejects.toThrow('demand changed');expect(a.stage.publish).not.toHaveBeenCalled();expect(a.stage.dispose).toHaveBeenCalledOnce();expect(registry.snapshot().stagedReferences).toBe(0);registry.dispose();
});
function call<T>(target:object,name:string,...args:unknown[]):T{const method=Reflect.get(target,name);if(typeof method!=='function')throw Error(name);return Reflect.apply(method,target,args) as T;}
test('the real first Core callback holds immediately after Native/adoption dirties a producer, before renderer or shadow submission',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),gate=deferred(),next=world(4),core:object=Object.assign(Object.create(SceneRenderCore.prototype),{disposed:false,fatalError:undefined,preparing:false,holdSurfaceWorld:false,closingPresentation:false,sharedSurfaceEpoch:0,presentationStopped:false,hasTracks:true,timeline:{advance:vi.fn(),tick:4},presentation:{take:()=>next},graphicsStyle:{surfacePreparation:registry},backend:'WebGL2',applyWorld:vi.fn(()=>{Reflect.set(core,'world',next);registry.invalidate();}),presentCorePhases297:vi.fn(),cancelGraphicsMeasurement:vi.fn(),finishSurfacePreparation:vi.fn(()=>gate.promise),renderScene:vi.fn(),renderer:{render:vi.fn()},hostPort:{hidden:()=>false}});
 call(core,'frame',100);expect(Reflect.get(core,'preparing')).toBe(true);expect(Reflect.get(core,'holdSurfaceWorld')).toBe(true);expect(Reflect.get(core,'renderScene')).not.toHaveBeenCalled();expect(Reflect.get(core,'renderer').render).not.toHaveBeenCalled();const held=Reflect.get(core,'pendingSurfaceWorld');expect(held).toEqual({world:next,reset:false,alreadyApplied:true});gate.resolve();await Reflect.get(core,'sharedSurfacePreparation');registry.dispose();
});
test('the existing source-assets preparation cancels the fill timer before the actual Source lease is captured',()=>{
 vi.useFakeTimers();let epoch=7;const timer=setTimeout(()=>{epoch++;},60),context:object={fillTimer:timer,bakedFill:.6,repaintRequested:false,origami:true,banks:[],prepareSharedSurfaceAssets:GraphicsStyleContext.prototype.prepareSharedSurfaceAssets,flushPaint:vi.fn(()=>{expect(Reflect.get(context,'fillTimer')).toBeUndefined();epoch++;}),ensureEdgeMaps:vi.fn(),assertPaintReadyForDraw:vi.fn()};
 call(context,'prepareSharedSurfaceAssets');const captured=epoch;vi.advanceTimersByTime(120);expect(epoch).toBe(captured);expect(Reflect.get(context,'fillTimer')).toBeUndefined();expect(Reflect.get(context,'repaintRequested')).toBe(true);expect(Reflect.get(context,'flushPaint')).toHaveBeenCalledOnce();
});
test('the real World coordinator discards an awaited old demand and prepares only the latest held World with OR(reset)',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),gate=deferred(),first=world(1),middle=world(2),latest=world(3),events:string[]=[],captured:SharedSurfacePreparationSnapshot[]=[],stages:SharedSurfacePreparationStage[]=[];
 registry.register({key:'rgba',needsPreparation:()=>true,stage:async(s)=>{captured.push(s);const p=port('world'+s.world!.tick,events);stages.push(p.stage);if(captured.length===1)await gate.promise;return p.stage;}});
 const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{world:first,disposed:false,closingPresentation:false,fatalError:undefined,preparing:true,holdSurfaceWorld:true,sharedSurfaceEpoch:1,backend:'WebGL2',sharedSurfacePreparation:Promise.resolve(),pendingSurfaceWorld:{world:first,reset:false,alreadyApplied:true},presentation:{clear:vi.fn()},graphicsStyle:{surfacePreparation:registry,preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0},preparedPaintRevision:0,prepareSharedSurfaceAssets:()=>[]},renderer:{initTexture:vi.fn(),compileAsync:vi.fn(async()=>{})},rig:{orthographic:{},perspective:{}},scene:{},hostPort:{hidden:()=>false},captureGraphicsView:()=>({mode:'orthographic',position:[1,2,3],target:[0,0,0],zoom:1}),applyAdmittedWorld:vi.fn((w:World)=>{Reflect.set(core,'world',w);registry.invalidate();}),resources:{assertFixedTreeDrawReady:vi.fn()},invalidatePausedShadow:vi.fn(),presentCorePhases297:vi.fn(),updateSelectedObject:vi.fn(),updateHover:vi.fn()});
 const pending=call<Promise<void>>(core,'finishSurfacePreparation');await Promise.resolve();await Promise.resolve();expect(captured).toHaveLength(1);call(core,'applyWorld',middle,true);call(core,'applyWorld',latest,false);expect(Reflect.get(core,'world')).toBe(first);gate.resolve();await pending;
 expect(captured.map(s=>[s.world,s.reset])).toEqual([[first,false],[latest,true]]);expect(stages[0]!.publish).not.toHaveBeenCalled();expect(stages[0]!.dispose).toHaveBeenCalledOnce();expect(stages[1]!.publish).toHaveBeenCalledOnce();expect(stages[1]!.commit).toHaveBeenCalledOnce();expect(Reflect.get(core,'applyAdmittedWorld')).toHaveBeenCalledExactlyOnceWith(latest,true,undefined);expect(Reflect.get(core,'renderer').compileAsync).toHaveBeenCalledTimes(2);expect(registry.dirty).toBe(false);expect(Reflect.get(core,'preparing')).toBe(false);registry.dispose();
});
test('actual Context close settles a globally published batch before closing the canonical coefficient manager',async()=>{
 const registry=new SharedSurfacePreparationRegistry(),events:string[]=[],p=port('rgba',events);registry.register(p.owner);const batch=await registry.stage(snapshot(),()=>{});batch.publish();
 const context:object={surfacePreparation:registry,preparedStrokes:{dispose:vi.fn(()=>{expect(batch.state).toBe('disposed');expect(p.published()).toBe(false);events.push('canonical-manager-close');})},sharedSurfaceRefreshers:new Set(),sharedPaintSettingsRefreshers:new Set(),coverageCheckpoints:new Map(),brushOwners:new Map(),brushGeometries:new Map(),banks:[],paintPool:{dispose:vi.fn()},appearanceRows:new Map(),wearGeometries:new Set(),edgeObjects:new Map()};
 function invokeActual(){Reflect.apply(GraphicsStyleContext.prototype.dispose,context,[]);}
 // Invoke the real public method, not a replacement disposal path.
 expect(invokeActual).not.toThrow();expect(events.indexOf('rgba:rollback')).toBeLessThan(events.indexOf('canonical-manager-close'));expect(registry.snapshot().stagedReferences).toBe(0);expect(Reflect.get(context,'preparedStrokes').dispose).toHaveBeenCalledOnce();
});

test('the real operation snapshot captures current physical camera density before the initial atlas stage, with no Pastel or positive-effect density work',()=>{
 const current=world(5),pixels=vi.fn(()=>30.5),dpr=vi.fn(()=>1.2000000476837158),graphics={preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0},origami:true,reliefEnabled:false,wearEnabled:false,preparedPaintRevision:8};
 const core:object=Object.assign(Object.create(SceneRenderCore.prototype),{world:current,backend:'WebGPU',texturesEnabled:true,graphicsStyle:graphics,sharedSurfaceEpoch:4,viewportHeight:760,rig:{mode:'orthographic',pixelsPerCell:pixels},renderer:{getPixelRatio:dpr}});
 const captured=call<SharedSurfacePreparationSnapshot>(core,'sharedSurfaceSnapshot','settings');expect(captured.world).toBe(current);expect(captured.density).toEqual({mode:'orthographic',physicalCellPixels:30.5*1.2000000476837158});expect(Object.isFrozen(captured.density)).toBe(true);expect(pixels).toHaveBeenCalledExactlyOnceWith(760);expect(dpr).toHaveBeenCalledOnce();
 pixels.mockClear();dpr.mockClear();graphics.origami=false;expect(call<SharedSurfacePreparationSnapshot>(core,'sharedSurfaceSnapshot','settings').density).toBeUndefined();expect(pixels).not.toHaveBeenCalled();expect(dpr).not.toHaveBeenCalled();
 graphics.origami=true;graphics.reliefEnabled=true;expect(call<SharedSurfacePreparationSnapshot>(core,'sharedSurfaceSnapshot','settings').density).toBeUndefined();expect(pixels).not.toHaveBeenCalled();expect(dpr).not.toHaveBeenCalled();
});
