import {isNativeCorePhaseAdmissionTicket297,isNativeCoreFullAdmissionTicket297} from './native-clone-resident';
/** MAIN-only transport scheduling. This helper grants no native provenance. */
export const MAIN_FRAME_ADMISSION_CAPACITY=256;
export const MAIN_FRAME_PHASE_ADMISSION_LIMIT297=8;
export const MAIN_FRAME_HEAVY_ADMISSION_LIMIT297=2;
export const MAIN_FRAME_SECOND_HEAVY_BEFORE_MS297=2;
export const MAIN_FRAME_STARVATION_WATCHDOG_MS325=100;
export interface MainFrameAdmissionHost {
 now():number;
 post(task:()=>void):void;
 report(error:unknown):void;
 /** Optional wall-time scheduling; callback is never invoked synchronously. */
 watchdog?(task:()=>void,delayMs:number):()=>void;
 close():void;
}
export interface MainFrameAdmissionInfo {readonly arrivalAt?:number;readonly epoch?:number;readonly tick?:number}
interface Entry {readonly run:()=>void;readonly arrivalAt:number;readonly epoch:number|undefined;readonly tick:number|undefined;readonly phaseTicket297:MainFrameAdmissionInfo|undefined;readonly fullTicket297:MainFrameAdmissionInfo|undefined}
function createHost():MainFrameAdmissionHost {
 const channel=new MessageChannel();let pending:(()=>void)|undefined,closed=false;
 channel.port1.onmessage=()=>{const task=pending;pending=undefined;if(!closed)task?.();};
 return {now:()=>performance.now(),post(task){if(closed)return;if(pending)throw Error('Admission task already posted');pending=task;channel.port2.postMessage(0);},
  report(error){if(typeof globalThis.reportError==='function')globalThis.reportError(error);else queueMicrotask(()=>{throw error;});},
  watchdog(task,delayMs){const timer=setTimeout(task,delayMs);return()=>clearTimeout(timer);},
  close(){closed=true;pending=undefined;channel.port1.close();channel.port2.close();}};
}
export class MainFrameAdmissionFIFO {
 readonly #host:MainFrameAdmissionHost;
 readonly #entries:Entry[]=[];
 #closed=false;#running=false;#posted=false;#current:Entry|undefined;
 #frameStarved=false;#watchdogToken:object|undefined;#cancelWatchdog:(()=>void)|undefined;
 #received=0;#dispatched=0;#maxDepth=0;#overflow=0;
 #dispatchCount=0;#dispatchMaxMs=0;#adoptCount=0;#adoptMaxMs=0;#adoptTotalMs=0;
 #latestEpoch:number|undefined;#latestTick:number|undefined;#appliedEpoch:number|undefined;#appliedTick:number|undefined;#maxTickLag=0;
 constructor(private readonly canFrame:()=>boolean,private readonly onOverflow:()=>void,host?:MainFrameAdmissionHost,private readonly onFrameStarved:()=>void=()=>{}){this.#host=host??createHost();}
 enqueue(run:()=>void,info:MainFrameAdmissionInfo={}):boolean {
  if(this.#closed)return false;
  const entry:Entry={run,arrivalAt:info.arrivalAt??this.#host.now(),epoch:info.epoch,tick:info.tick,phaseTicket297:isNativeCorePhaseAdmissionTicket297(info,run)?info:undefined,fullTicket297:isNativeCoreFullAdmissionTicket297(info,run)?info:undefined};this.#received++;
  if(info.epoch!==undefined&&info.tick!==undefined){this.#latestEpoch=info.epoch;this.#latestTick=info.tick;this.#updateLag();}
  // Startup has no renderer to wake an ACK/checkpoint. Preserve immediate path.
  if(!this.#running&&!this.#entries.length&&!this.canFrame()){this.#run(entry);return true;}
  if(this.#entries.length>=MAIN_FRAME_ADMISSION_CAPACITY){this.#overflow++;this.close();this.onOverflow();return false;}
  this.#entries.push(entry);this.#maxDepth=Math.max(this.#maxDepth,this.#entries.length);this.notifyAvailability();return true;
 }
 drainFrame():void {
  if(this.#closed||this.#running)return;
  this.#clearWatchdog();this.#frameStarved=false;
  this.#drainFrameBudget();
 }
 #drainFrameBudget():void {
  if(this.#closed||this.#running)return;
  if(!this.canFrame()){this.notifyAvailability();return;}
  const started=this.#host.now();let phases=0,ordinary=0,heavy=0,modernFull=false;
  while(!this.#closed&&this.#entries.length&&this.canFrame()){
   const entry=this.#entries[0]!,phase=entry.phaseTicket297!==undefined&&isNativeCorePhaseAdmissionTicket297(entry.phaseTicket297,entry.run);
   // Never skip a blocked head or move an ACK ahead of its publication. A
   // revoked/mismatched ticket falls back to the historical ordinary budget.
   if(phase){if(phases>=MAIN_FRAME_PHASE_ADMISSION_LIMIT297)break;phases++;}
   else {
    const full=entry.fullTicket297!==undefined&&isNativeCoreFullAdmissionTicket297(entry.fullTicket297,entry.run);
    if(heavy>=MAIN_FRAME_HEAVY_ADMISSION_LIMIT297||!full&&ordinary>=1)break;
    // Only a real current297 Full may fund one extra heavy admission. Slow
    // first work (including preceding phases) keeps the old one-heavy limit.
    if(heavy&&(!(modernFull||full)||!(this.#host.now()-started<MAIN_FRAME_SECOND_HEAVY_BEFORE_MS297)))break;
    heavy++;if(full)modernFull=true;else ordinary++;
   }
   this.#entries.shift();this.#run(entry);
  }
  this.notifyAvailability();
 }
 #clearWatchdog():void {
  const cancel=this.#cancelWatchdog;this.#cancelWatchdog=undefined;this.#watchdogToken=undefined;cancel?.();
 }
 #armWatchdog():void {
  if(this.#watchdogToken||this.#running||!this.#host.watchdog)return;
  const token={};this.#watchdogToken=token;
  this.#cancelWatchdog=this.#host.watchdog(()=>{
   if(this.#closed||this.#watchdogToken!==token)return;
   this.#watchdogToken=undefined;this.#cancelWatchdog=undefined;
   if(!this.#entries.length)return;
   if(this.canFrame()&&!this.#frameStarved){this.#frameStarved=true;this.onFrameStarved();}
   this.notifyAvailability();
  },MAIN_FRAME_STARVATION_WATCHDOG_MS325);
 }
 notifyAvailability():void {
  if(this.#closed||!this.#entries.length){this.#clearWatchdog();return;}
  const canFrame=this.canFrame();
  if(canFrame&&!this.#frameStarved){this.#armWatchdog();return;}
  this.#clearWatchdog();
  if(this.#posted)return;
  this.#posted=true;this.#host.post(()=>{this.#posted=false;if(this.#closed)return;
   if(this.canFrame()){if(this.#frameStarved)this.#drainFrameBudget();else this.notifyAvailability();return;}
   const entry=this.#entries.shift();if(entry)this.#run(entry);this.notifyAvailability();});
 }
 #run(entry:Entry):void {
  this.#running=true;this.#current=entry;this.#dispatchCount++;this.#dispatchMaxMs=Math.max(this.#dispatchMaxMs,this.#host.now()-entry.arrivalAt);
  try{entry.run();}catch(error){this.#host.report(error);}finally{this.#dispatched++;this.#current=undefined;this.#running=false;this.notifyAvailability();}
 }
 recordApplied(tick:number):void {
  if(!Number.isFinite(tick))return;
  this.#appliedEpoch=this.#current?.epoch;this.#appliedTick=tick;
  if(this.#current){const lag=this.#host.now()-this.#current.arrivalAt;this.#adoptCount++;this.#adoptTotalMs+=lag;this.#adoptMaxMs=Math.max(this.#adoptMaxMs,lag);}
  this.#updateLag();
 }
 #updateLag():void {if(this.#latestEpoch===this.#appliedEpoch&&this.#latestTick!==undefined&&this.#appliedTick!==undefined)this.#maxTickLag=Math.max(this.#maxTickLag,this.#latestTick-this.#appliedTick);}
 diagnostics(){return Object.freeze({depth:this.#entries.length,oldestMs:this.#entries.length?Math.max(0,this.#host.now()-this.#entries[0]!.arrivalAt):0,maxDepth:this.#maxDepth,
  received:this.#received,dispatched:this.#dispatched,overflow:this.#overflow,closed:this.#closed,
  arrivalToDispatchCount:this.#dispatchCount,arrivalToDispatchMaxMs:this.#dispatchMaxMs,arrivalToAdoptCount:this.#adoptCount,arrivalToAdoptMaxMs:this.#adoptMaxMs,arrivalToAdoptTotalMs:this.#adoptTotalMs,
  latestReceivedEpoch:this.#latestEpoch??null,latestReceivedTick:this.#latestTick??null,appliedEpoch:this.#appliedEpoch??null,appliedTick:this.#appliedTick??null,
  tickLag:this.#latestEpoch===this.#appliedEpoch&&this.#latestTick!==undefined&&this.#appliedTick!==undefined?this.#latestTick-this.#appliedTick:null,maxTickLag:this.#maxTickLag});}
 resetDiagnostics():void {this.#received=this.#dispatched=this.#overflow=this.#dispatchCount=this.#adoptCount=0;this.#dispatchMaxMs=this.#adoptMaxMs=this.#adoptTotalMs=0;this.#maxDepth=this.#entries.length;
  this.#maxTickLag=this.#latestEpoch===this.#appliedEpoch&&this.#latestTick!==undefined&&this.#appliedTick!==undefined?Math.max(0,this.#latestTick-this.#appliedTick):0;}
 close():void {if(this.#closed)return;this.#closed=true;this.#clearWatchdog();this.#frameStarved=false;this.#entries.length=0;this.#host.close();}
}
