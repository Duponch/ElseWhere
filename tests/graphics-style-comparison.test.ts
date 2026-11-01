import {expect,test} from 'vitest';
import {createGraphicsStyleComparison,GRAPHICS_COMPARISON_MAX_SAMPLES,type GraphicsStyleComparisonContext,type GraphicsStyleComparisonFrame} from '../src/render/graphics-style-comparison';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

const context=():GraphicsStyleComparisonContext=>({preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES},sceneFingerprint:'scene-17/revision-42',camera:{position:[3,4,5],target:[0,0,0],zoom:1},viewport:{width:1280,height:720,pixelRatio:1},backend:'WebGPU',settings:{textures:true,shadows:{frequency:30,resolution:1024},animation:true}});
const frame=(current:GraphicsStyleComparisonContext,nowMs:number,extra:Partial<GraphicsStyleComparisonFrame>={}):GraphicsStyleComparisonFrame=>({context:current,nowMs,visible:true,drawCalls:21,triangles:4300,...extra});

test('a fixed window excludes warmup and its boundary interval without inferring FPS from CPU work',()=>{
 const c=context(),run=createGraphicsStyleComparison(c,10);
 run.sample(frame(c,100,{drawCalls:999,cpuSubmitMs:1000}));run.sample(frame(c,1009));
 run.sample(frame(c,1010,{cpuSubmitMs:2,adoptionMs:5}));
 run.sample(frame(c,1020,{cpuSubmitMs:4}));run.sample(frame(c,1040,{cpuSubmitMs:6,adoptionMs:7}));run.sample(frame(c,1080,{cpuSubmitMs:8}));
 expect(run.sample(frame(c,6010,{drawCalls:999}))).toMatchObject({status:'complete',startedAtMs:10,measurementStartedAtMs:1010,deadlineMs:6010,finishedAtMs:6010,observedFrames:4,retainedFrames:4});
 expect(run.result?.frameIntervalsMs).toEqual({count:3,min:10,mean:70/3,median:20,p95:40,max:40});
 expect(run.result?.cpuSubmitMs).toEqual({count:4,min:2,mean:5,median:5,p95:8,max:8});
 expect(run.result?.adoptionMs).toEqual({count:2,min:5,mean:6,median:6,p95:7,max:7});
 expect(run.result?.drawCalls).toMatchObject({count:4,min:21,max:21});expect(run.result?.triangles).toMatchObject({count:4,max:4300});
 expect(run.result?.gpuDurationMs).toBeUndefined();expect(run.result).not.toHaveProperty('fps');
});

test('context identity is exact, key-order independent and snapshots cannot be changed through aliases',()=>{
 const c=context(),run=createGraphicsStyleComparison(c,0),same=context();
 same.camera={zoom:1,target:[0,0,0],position:[3,4,5]};same.settings={animation:true,shadows:{resolution:1024,frequency:30},textures:true};
 expect(run.sample(frame(same,1000))).toBeUndefined();run.sample(frame(same,1020));
 const exposed=run.context;exposed.preferences.style='origami';exposed.viewport.width=800;
 const result=run.finish(6000,same,true);expect(result.status).toBe('complete');expect(result.context).toEqual(c);
 expect(Object.isFrozen(result)).toBe(true);expect(Object.isFrozen(result.context.preferences)).toBe(true);expect(run.finish(9000,exposed,false)).toBe(result);
});

test('every actual context mutation invalidates a run and cannot become successful later',()=>{
 const mutations:((value:GraphicsStyleComparisonContext)=>void)[]=[
  value=>{value.preferences.style='origami';},value=>{value.preferences.impasto=.5;},value=>{value.sceneFingerprint='scene-other';},
  value=>{value.camera={position:[3,4,6],target:[0,0,0],zoom:1};},value=>{value.viewport.pixelRatio=2;},value=>{value.viewport.height=721;},
  value=>{value.backend='WebGL';},value=>{value.settings={...value.settings,textures:false};},
 ];
 for(const mutate of mutations){const c=context(),run=createGraphicsStyleComparison(c,0);run.sample(frame(c,1000));mutate(c);
  expect(run.sample(frame(c,1020))).toMatchObject({status:'cancelled',reason:'context-changed'});expect(run.finish(6000,context(),true)?.status).toBe('cancelled');}
});

test('visibility loss, invalid metrics and bad clocks fail closed, without replay or extending the deadline',()=>{
 const c=context(),hidden=createGraphicsStyleComparison(c,0);expect(hidden.sample(frame(c,300,{visible:false}))).toMatchObject({status:'cancelled',reason:'hidden'});
 const backwards=createGraphicsStyleComparison(c,0);backwards.sample(frame(c,1000));expect(backwards.sample(frame(c,900))).toMatchObject({status:'cancelled',reason:'invalid-clock'});
 const duplicate=createGraphicsStyleComparison(c,0);duplicate.sample(frame(c,1000));expect(duplicate.sample(frame(c,1000))).toMatchObject({status:'cancelled',reason:'non-increasing-frame-time'});
 for(const extra of [{cpuSubmitMs:NaN},{adoptionMs:-1},{drawCalls:1.5},{triangles:Infinity},{gpuDurationMs:2}]){
  const run=createGraphicsStyleComparison(c,0);expect(run.sample(frame(c,1000,extra))).toMatchObject({status:'cancelled',reason:'invalid-frame-metrics'});
 }
 const invalid=createGraphicsStyleComparison(c,0);expect(invalid.sample(frame(c,NaN))).toMatchObject({reason:'invalid-clock',finishedAtMs:0});
});

test('optional GPU duration is recorded only with an actual timestamp-query source and counts its own coverage',()=>{
 const c=context(),run=createGraphicsStyleComparison(c,0);run.sample(frame(c,1000,{gpuDurationMs:3,gpuSource:'timestamp-query'}));run.sample(frame(c,1020));run.sample(frame(c,1040,{gpuDurationMs:7,gpuSource:'timestamp-query'}));
 expect(run.finish(6000,c,true).gpuDurationMs).toEqual({count:2,min:3,mean:5,median:5,p95:7,max:7});
});

test('early stop and too few frames stay incomplete even if a later call supplies more time',()=>{
 const c=context(),early=createGraphicsStyleComparison(c,0);early.sample(frame(c,1000));early.sample(frame(c,1020));
 expect(early.finish(5999,c,true)).toMatchObject({status:'incomplete',reason:'ended-before-deadline',deadlineMs:6000});expect(early.finish(7000,c,true).status).toBe('incomplete');
 const empty=createGraphicsStyleComparison(c,0);expect(empty.finish(10000,c,true)).toMatchObject({status:'incomplete',reason:'insufficient-frames',deadlineMs:6000});expect(empty.result?.frameIntervalsMs).toBeUndefined();
});

test('bounded ring overflow is cancelled explicitly instead of reporting truncated quantiles as a full run',()=>{
 const c=context(),run=createGraphicsStyleComparison(c,0);
 for(let index=0;index<GRAPHICS_COMPARISON_MAX_SAMPLES;index++)expect(run.sample(frame(c,1000+index))).toBeUndefined();
 expect(run.sample(frame(c,1000+GRAPHICS_COMPARISON_MAX_SAMPLES))).toMatchObject({status:'cancelled',reason:'sample-capacity-exceeded',observedFrames:GRAPHICS_COMPARISON_MAX_SAMPLES+1,retainedFrames:GRAPHICS_COMPARISON_MAX_SAMPLES});
 expect(run.finish(6000,c,true).status).toBe('cancelled');
});

test('invalid initial context is rejected, cancellation is terminal and never changes game state',()=>{
 const c=context();expect(()=>createGraphicsStyleComparison(c,NaN)).toThrow();expect(()=>createGraphicsStyleComparison({...c,preferences:{...c.preferences,style:'invalid'} as never},0)).toThrow();
 expect(()=>createGraphicsStyleComparison({...c,camera:{zoom:Infinity}},0)).toThrow();expect(()=>createGraphicsStyleComparison({...c,viewport:{...c.viewport,width:0}},0)).toThrow();
 const before=JSON.stringify(c),run=createGraphicsStyleComparison(c,0),cancelled=run.cancel('human-cancel',1200);
 expect(cancelled).toMatchObject({status:'cancelled',reason:'human-cancel',finishedAtMs:1200});expect(run.sample(frame(c,1400))).toBe(cancelled);expect(JSON.stringify(c)).toBe(before);
});
