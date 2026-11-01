import {afterEach,expect,test,vi} from 'vitest';
import {OrthographicCamera,Vector3} from 'three/webgpu';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

afterEach(()=>vi.useRealTimers());

function fixture(){
 vi.useFakeTimers();
 let now=0,hidden=false,current=true;
 const camera=new OrthographicCamera(-1,1,1,-1,.1,100),renderer={getPixelRatio:()=>1,info:{render:{drawCalls:21,triangles:4300}}};
 // Prototype-only orchestration fixture: no constructor, World, graphics
 // device, render loop, renderer submission or campaign is created.
 const core=Object.assign(Object.create(SceneRenderCore.prototype),{
  disposed:false,fatalError:undefined,preparing:false,presentationStopped:false,world:{},received:{speed:0},keys:new Set<string>(),
  graphicsStyle:{preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES}},rig:{mode:'orthographic',camera,span:2,controls:{target:new Vector3()}},
  renderer,backend:'WebGPU',viewportWidth:1280,viewportHeight:720,texturesEnabled:true,grassVisible:true,grass:null,roomEnabled:false,dioramaEnabled:true,
  lightingSettings:{sun:1,moon:1,ambient:1},shadowSettings:{frequency:30,resolution:1024},animationDetail:{settings:{enabled:true},reset:vi.fn()},frames:{reset:vi.fn()},
  hostPort:{now:()=>now,hidden:()=>hidden,pixelRatio:()=>1,viewport:()=>({width:1280,height:720}),backend:()=>'WebGPU'},
 }) as SceneRenderCore;
 const submit=(time:number,cpuMs:number)=>{now=time;Reflect.get(SceneRenderCore.prototype,'recordGraphicsMeasurement').call(core,cpuMs,time);};
 return {core,renderer,camera,submit,at(value:number){now=value;},hide(value:boolean){hidden=value;},current(value:boolean){current=value;},start:()=>core.measureGraphicsStyle('scene17',{test:'declared-service-fixture'},()=>current)};
}

test('manual measurement collects only measured postwarmup frames and settles at its fixed timer without further RAF',async()=>{
 const f=fixture(),pending=f.start();f.submit(500,99);f.submit(1000,2);f.submit(1020,4);
 f.at(6000);vi.advanceTimersByTime(6000);const result=await pending;
 expect(result).toMatchObject({status:'complete',measurementStartedAtMs:1000,deadlineMs:6000,finishedAtMs:6000,retainedFrames:2,
  frameIntervalsMs:{count:1,median:20},cpuSubmitMs:{count:2,median:3},drawCalls:{count:2,median:21},triangles:{count:2,median:4300}});
 expect(result.gpuDurationMs).toBeUndefined();expect(result.context.camera).toMatchObject({mode:'orthographic',position:[0,0,0],zoom:1});
 expect(result.context.viewport).toEqual({width:1280,height:720,pixelRatio:1});expect(vi.getTimerCount()).toBe(0);
});

test('changed camera and external snapshot guards cancel exact context and clear the fixed timer',async()=>{
 const camera=fixture(),moved=camera.start();camera.submit(1000,2);camera.camera.position.x=1;camera.submit(1020,3);
 expect(await moved).toMatchObject({status:'cancelled',reason:'context-changed'});expect(vi.getTimerCount()).toBe(0);
 const snapshot=fixture(),stale=snapshot.start();snapshot.current(false);snapshot.at(6000);vi.advanceTimersByTime(6000);
 expect(await stale).toMatchObject({status:'cancelled',reason:'context-changed'});expect(vi.getTimerCount()).toBe(0);
});

test('hidden state cancels immediately through the owned visibility hook and through the deadline without RAF',async()=>{
 const f=fixture(),pending=f.start();f.hide(true);f.at(100);f.core.visibilityChanged();
 expect(await pending).toMatchObject({status:'cancelled',reason:'hidden',finishedAtMs:100});expect(vi.getTimerCount()).toBe(0);
 const stopped=fixture(),noRaf=stopped.start();stopped.hide(true);stopped.at(6000);vi.advanceTimersByTime(6000);
 expect(await noRaf).toMatchObject({status:'cancelled',reason:'hidden'});
});

test('manual measurement refuses simultaneous runs and explicit cancellation settles once with timer cleanup',async()=>{
 const f=fixture(),pending=f.start();await expect(f.start()).rejects.toThrow('déjà en cours');
 f.core.cancelGraphicsMeasurement('human-cancel');f.core.cancelGraphicsMeasurement('later');
 expect(await pending).toMatchObject({status:'cancelled',reason:'human-cancel'});expect(vi.getTimerCount()).toBe(0);
 const next=f.start();f.core.stopPresentation();expect(await next).toMatchObject({status:'cancelled',reason:'presentation-stopped'});
});
