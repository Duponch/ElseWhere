import {normalizeGraphicsStylePreferences,type GraphicsStylePreferences} from '../ui3d/native-preferences';

export type GraphicsComparisonMetadata=string|number|boolean|null|readonly GraphicsComparisonMetadata[]|{readonly [key:string]:GraphicsComparisonMetadata};
export interface GraphicsStyleComparisonContext {
 preferences:GraphicsStylePreferences;
 /** Identity/revision of the actual rendered scene, supplied by its owner. */
 sceneFingerprint:string;
 camera:Readonly<Record<string,GraphicsComparisonMetadata>>;
 viewport:{width:number;height:number;pixelRatio:number};
 backend:string;
 settings:Readonly<Record<string,GraphicsComparisonMetadata>>;
}
export interface GraphicsStyleComparisonFrame {
 nowMs:number;
 context:GraphicsStyleComparisonContext;
 visible:boolean;
 drawCalls:number;
 triangles:number;
 /** Measured CPU submission work only; never GPU or display duration. */
 cpuSubmitMs?:number;
 adoptionMs?:number;
 /** A measured duration from actual GPU timestamp queries, when supported. */
 gpuDurationMs?:number;
 gpuSource?:'timestamp-query';
}
export interface GraphicsStyleComparisonDistribution {count:number;min:number;mean:number;median:number;p95:number;max:number}
export interface GraphicsStyleComparisonResult {
 status:'complete'|'cancelled'|'incomplete';
 reason?:string;
 context:GraphicsStyleComparisonContext;
 startedAtMs:number;
 measurementStartedAtMs:number;
 deadlineMs:number;
 finishedAtMs:number;
 observedFrames:number;
 retainedFrames:number;
 /** Intervals between frame submissions inside the fixed measurement window.
  * These are not a GPU timer or proof of displayed FPS. */
 frameIntervalsMs?:GraphicsStyleComparisonDistribution;
 cpuSubmitMs?:GraphicsStyleComparisonDistribution;
 adoptionMs?:GraphicsStyleComparisonDistribution;
 gpuDurationMs?:GraphicsStyleComparisonDistribution;
 drawCalls?:GraphicsStyleComparisonDistribution;
 triangles?:GraphicsStyleComparisonDistribution;
}
export const GRAPHICS_COMPARISON_WARMUP_MS=1000;
export const GRAPHICS_COMPARISON_DURATION_MS=5000;
export const GRAPHICS_COMPARISON_MAX_SAMPLES=2048;

function canonical(value:unknown,depth=0,budget={remaining:1024}):string {
 if(depth>10||--budget.remaining<0)throw Error('Comparison context is too large.');
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'&&Number.isFinite(value))return JSON.stringify(value);
 if(Array.isArray(value))return `[${value.map(item=>canonical(item,depth+1,budget)).join(',')}]`;
 if(value&&typeof value==='object'&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null))return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical((value as Record<string,unknown>)[key],depth+1,budget)}`).join(',')}}`;
 throw Error('Comparison context must contain finite JSON values.');
}
function contextKey(context:GraphicsStyleComparisonContext):string {
 if(!context||typeof context.sceneFingerprint!=='string'||!context.sceneFingerprint||typeof context.backend!=='string'||!context.backend||!context.camera||Array.isArray(context.camera)||typeof context.camera!=='object'||!context.settings||Array.isArray(context.settings)||typeof context.settings!=='object'||!context.preferences||!context.viewport)throw Error('Comparison context is incomplete.');
 const {width,height,pixelRatio}=context.viewport;
 if(![width,height,pixelRatio].every(value=>Number.isFinite(value)&&value>0))throw Error('Comparison viewport is invalid.');
 if(canonical(context.preferences)!==canonical(normalizeGraphicsStylePreferences(context.preferences)))throw Error('Comparison preferences are invalid.');
 const key=canonical(context);if(key.length>16384)throw Error('Comparison context is too large.');return key;
}
/** Pair reporting only: different styles intentionally have different render
 * preferences/bindings. World, camera, viewport and ALL common settings stay
 * exact. The collector still validates the complete context on every sample. */
export function graphicsStyleComparisonsShareScene(left:GraphicsStyleComparisonContext,right:GraphicsStyleComparisonContext):boolean {
 try{
  const a=contextKey(left),b=contextKey(right);
  if(left.preferences.style===right.preferences.style)return a===b;
  const shared=(context:GraphicsStyleComparisonContext)=>{
   const {preferences:_preferences,settings,...scene}=context;
   const {origamiBaked:_renderState,...commonSettings}=settings;
   return canonical({...scene,settings:commonSettings});
  };
  return shared(left)===shared(right);
 }catch{return false;}
}
function distribution(values:number[]):GraphicsStyleComparisonDistribution|undefined {
 if(!values.length)return undefined;
 values.sort((a,b)=>a-b);const count=values.length,middle=Math.floor(count/2);
 return {count,min:values[0]!,mean:values.reduce((sum,value)=>sum+value,0)/count,median:count%2?values[middle]!:(values[middle-1]!+values[middle]!)/2,p95:values[Math.ceil(count*.95)-1]!,max:values[count-1]!};
}
type Sample={nowMs:number;drawCalls:number;triangles:number;cpuSubmitMs?:number;adoptionMs?:number;gpuDurationMs?:number};
function freeze<T>(value:T):T {
 if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;
}

/** A manual, single-use, fixed-window collector. Its caller supplies real frame
 * timestamps/counters and checks visibility/context on every frame (and on any
 * visibility change). It never schedules work, changes style or extends a run. */
export function createGraphicsStyleComparison(context:GraphicsStyleComparisonContext,startedAtMs:number){
 if(!Number.isFinite(startedAtMs)||startedAtMs<0)throw Error('Comparison start time is invalid.');
 const key=contextKey(context);
 const measurementStartedAtMs=startedAtMs+GRAPHICS_COMPARISON_WARMUP_MS,deadlineMs=measurementStartedAtMs+GRAPHICS_COMPARISON_DURATION_MS;
 const ring:Sample[]=new Array(GRAPHICS_COMPARISON_MAX_SAMPLES);
 let count=0,head=0,observedFrames=0,lastNowMs=startedAtMs,lastFrameMs:number|undefined,result:GraphicsStyleComparisonResult|undefined;
 const retained=()=>Array.from({length:count},(_,index)=>ring[(head+index)%ring.length]!);
 function end(status:GraphicsStyleComparisonResult['status'],finishedAtMs:number,reason?:string):GraphicsStyleComparisonResult {
  if(result)return result;
  const samples=retained(),intervals=samples.slice(1).map((sample,index)=>sample.nowMs-samples[index]!.nowMs);
  const metric=(field:keyof Omit<Sample,'nowMs'>)=>distribution(samples.flatMap(sample=>sample[field]===undefined?[]:[sample[field]!]));
  result=freeze({status,reason,context:JSON.parse(key) as GraphicsStyleComparisonContext,startedAtMs,measurementStartedAtMs,deadlineMs,finishedAtMs,observedFrames,retainedFrames:count,
   frameIntervalsMs:distribution(intervals),cpuSubmitMs:metric('cpuSubmitMs'),adoptionMs:metric('adoptionMs'),gpuDurationMs:metric('gpuDurationMs'),drawCalls:metric('drawCalls'),triangles:metric('triangles')});
  return result;
 }
 function check(nowMs:number,current:GraphicsStyleComparisonContext,visible:boolean):GraphicsStyleComparisonResult|undefined {
  if(result)return result;
  if(!Number.isFinite(nowMs)||nowMs<lastNowMs)return end('cancelled',lastNowMs,'invalid-clock');
  lastNowMs=nowMs;
  if(!visible)return end('cancelled',nowMs,'hidden');
  try{if(contextKey(current)!==key)return end('cancelled',nowMs,'context-changed');}catch{return end('cancelled',nowMs,'invalid-context');}
  return undefined;
 }
 function finish(nowMs:number,current:GraphicsStyleComparisonContext,visible:boolean):GraphicsStyleComparisonResult {
  const stopped=check(nowMs,current,visible);if(stopped)return stopped;
  if(nowMs<deadlineMs)return end('incomplete',nowMs,'ended-before-deadline');
  return count<2?end('incomplete',nowMs,'insufficient-frames'):end('complete',nowMs);
 }
 function sample(frame:GraphicsStyleComparisonFrame):GraphicsStyleComparisonResult|undefined {
  const stopped=check(frame.nowMs,frame.context,frame.visible);if(stopped)return stopped;
  if(frame.nowMs>=deadlineMs)return finish(frame.nowMs,frame.context,frame.visible);
  if(lastFrameMs!==undefined&&frame.nowMs<=lastFrameMs)return end('cancelled',frame.nowMs,'non-increasing-frame-time');
  lastFrameMs=frame.nowMs;
  if(![frame.drawCalls,frame.triangles].every(value=>Number.isSafeInteger(value)&&value>=0)||![frame.cpuSubmitMs,frame.adoptionMs,frame.gpuDurationMs].every(value=>value===undefined||Number.isFinite(value)&&value>=0)||frame.gpuDurationMs!==undefined&&frame.gpuSource!=='timestamp-query')return end('cancelled',frame.nowMs,'invalid-frame-metrics');
  if(frame.nowMs<measurementStartedAtMs)return undefined;
  observedFrames++;
  const next:Sample={nowMs:frame.nowMs,drawCalls:frame.drawCalls,triangles:frame.triangles,cpuSubmitMs:frame.cpuSubmitMs,adoptionMs:frame.adoptionMs,gpuDurationMs:frame.gpuDurationMs};
  if(count===ring.length){ring[head]=next;head=(head+1)%ring.length;return end('cancelled',frame.nowMs,'sample-capacity-exceeded');}
  ring[(head+count)%ring.length]=next;count++;return undefined;
 }
 return {sample,finish,cancel:(reason:string,nowMs=lastNowMs)=>end('cancelled',Number.isFinite(nowMs)&&nowMs>=lastNowMs?nowMs:lastNowMs,reason),
  get context(){return JSON.parse(key) as GraphicsStyleComparisonContext;},
  get deadlineMs(){return deadlineMs;},get measurementStartedAtMs(){return measurementStartedAtMs;},get result(){return result;},get sampleCount(){return count;}};
}
