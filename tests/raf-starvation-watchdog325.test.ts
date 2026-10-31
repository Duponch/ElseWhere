import {describe,expect,it} from 'vitest';
import {MainFrameAdmissionFIFO,MAIN_FRAME_ADMISSION_CAPACITY,type MainFrameAdmissionHost} from '../src/bridge/main-frame-admission-fifo';

// Scheduler contracts: ordinary callbacks carry no Native ticket or World.
// Production ticket predicates remain active; no Native authority is fabricated.
class Host implements MainFrameAdmissionHost {
 time=0;tasks:(()=>void)[]=[];errors:unknown[]=[];closed=0;scheduled=0;cancelled=0;maxTimers=0;
 timers:{at:number;run:()=>void;live:boolean}[]=[];
 now(){return this.time;}
 post(run:()=>void){this.tasks.push(run);}
 report(error:unknown){this.errors.push(error);}
 close(){this.closed++;}
 watchdog(run:()=>void,delayMs:number):()=>void {
  const timer={at:this.time+delayMs,run,live:true};this.timers.push(timer);this.scheduled++;
  this.maxTimers=Math.max(this.maxTimers,this.timers.filter(t=>t.live).length);
  return()=>{if(timer.live){timer.live=false;this.cancelled++;}};
 }
 advance(to:number):void {
  for(let count=0;count<1000;count++){
   const next=this.timers.filter(t=>t.live&&t.at<=to).sort((a,b)=>a.at-b.at)[0];
   if(!next){this.time=to;return;}
   this.time=next.at;next.live=false;next.run();
  }
  throw Error('Unexpected unbounded timer loop');
 }
 turn():void {const run=this.tasks.shift();if(!run)throw Error('No posted MessageChannel task');run();}
 get liveTimers(){return this.timers.filter(t=>t.live).length;}
}

describe('RAF starvation watchdog325, scheduling without Native authority',()=>{
 it('a real frame cancels starvation and a pending fallback cannot double-admit after RAF returns',()=>{
  const host=new Host(),seen:string[]=[],q=new MainFrameAdmissionFIFO(()=>true,()=>{throw Error('overflow');},host);
  try{
   q.enqueue(()=>seen.push('publication'));q.enqueue(()=>seen.push('reply'));q.enqueue(()=>seen.push('tail'));
   expect(host.liveTimers).toBe(1);host.advance(99);expect(seen).toEqual([]);
   q.drainFrame();expect(seen).toEqual(['publication']);expect(host.maxTimers).toBe(1);
   host.advance(100);expect(host.tasks).toHaveLength(0);expect(seen).toEqual(['publication']);
   host.advance(199);expect(host.tasks).toHaveLength(1);expect(seen).toEqual(['publication']);
   q.drainFrame();expect(seen).toEqual(['publication','reply']);
   host.turn();expect(seen).toEqual(['publication','reply']);
   q.drainFrame();host.advance(1000);expect(seen).toEqual(['publication','reply','tail']);
   expect(host.tasks).toHaveLength(0);expect(host.liveTimers).toBe(0);expect(q.diagnostics().dispatched).toBe(3);
  }finally{q.close();}
 });

 it('without RAF, 300 spaced arrivals stay ordered through separate bounded tasks after100ms',()=>{
  const host=new Host(),seen:number[]=[],overflow:string[]=[],q=new MainFrameAdmissionFIFO(()=>true,()=>overflow.push('overflow'),host);
  try{
   for(let n=0;n<12;n++)expect(q.enqueue(()=>seen.push(n))).toBe(true);
   host.advance(99);expect(host.tasks).toHaveLength(0);expect(seen).toEqual([]);
   host.advance(100);expect(host.tasks).toHaveLength(1);expect(seen).toEqual([]);
   // Each turn is a distinct macrotask, never a synchronous/microtask drain.
   for(let n=12;n<300;n++){
    host.turn();expect(host.tasks).toHaveLength(1);expect(seen).toHaveLength(n-11);
    host.time++;expect(q.enqueue(()=>seen.push(n))).toBe(true);expect(q.diagnostics().depth).toBeLessThanOrEqual(12);
   }
   for(let n=0;n<12;n++)host.turn();
   expect(seen).toEqual(Array.from({length:300},(_,n)=>n));expect(host.tasks).toHaveLength(0);
   expect(host.maxTimers).toBe(1);expect(overflow).toEqual([]);
   expect(q.diagnostics()).toMatchObject({received:300,dispatched:300,depth:0,closed:false,overflow:0});
   expect(MAIN_FRAME_ADMISSION_CAPACITY).toBe(256);
  }finally{q.close();}
 });

 it('close cancels the one timer and leaves already posted fallback work inert',()=>{
  for(const posted of [false,true]){
   const host=new Host(),seen:string[]=[],q=new MainFrameAdmissionFIFO(()=>true,()=>{throw Error('overflow');},host);
   q.enqueue(()=>seen.push('must not run'));
   const staleTimer=host.timers[0]!.run;
   if(posted)host.advance(100);
   q.close();q.close();staleTimer();host.advance(1000);
   while(host.tasks.length)host.turn();
   expect(seen).toEqual([]);expect(host.liveTimers).toBe(0);expect(host.closed).toBe(1);
   expect(q.enqueue(()=>seen.push('late'))).toBe(false);expect(q.diagnostics()).toMatchObject({closed:true,depth:0,dispatched:0});
  }
 });

 it('fallback reports a thrown callback once, preserves the following reply, and retains the unavailable-frame path',()=>{
  const host=new Host(),seen:string[]=[],error=Error('business dispatch');let canFrame=true;
  const q=new MainFrameAdmissionFIFO(()=>canFrame,()=>{throw Error('overflow');},host);
  try{
   q.enqueue(()=>{seen.push('faulting publication');throw error;});q.enqueue(()=>seen.push('correlated reply'));q.enqueue(()=>seen.push('tail'));
   host.advance(100);host.turn();expect(host.errors).toEqual([error]);expect(seen).toEqual(['faulting publication']);
   expect(host.tasks).toHaveLength(1);canFrame=false;host.turn();
   expect(seen).toEqual(['faulting publication','correlated reply']);expect(host.tasks).toHaveLength(1);
   host.turn();expect(seen).toEqual(['faulting publication','correlated reply','tail']);
   expect(host.errors).toEqual([error]);expect(host.tasks).toHaveLength(0);expect(q.diagnostics().dispatched).toBe(3);
   canFrame=true;q.drainFrame();q.enqueue(()=>seen.push('after visibility'));
   canFrame=false;q.notifyAvailability();canFrame=true;host.turn();
   expect(seen).toEqual(['faulting publication','correlated reply','tail']);
   // Returning visibility does not itself promise an actual RAF. Rearm the
   // watchdog when the old unavailable-frame task becomes stale.
   host.advance(200);expect(host.tasks).toHaveLength(1);host.turn();
   expect(seen).toEqual(['faulting publication','correlated reply','tail','after visibility']);
   expect(host.errors).toEqual([error]);expect(host.tasks).toHaveLength(0);expect(q.diagnostics().dispatched).toBe(4);
  }finally{q.close();}
 });
});

it('suspends presentation once before fallback dispatch and rearms only after a real frame',()=>{
 const host=new Host(),seen:string[]=[],starved=()=>seen.push('suspend');
 const q=new MainFrameAdmissionFIFO(()=>true,()=>{throw Error('overflow');},host,starved);
 try{
  q.enqueue(()=>seen.push('publication'));q.enqueue(()=>seen.push('reply'));
  host.advance(100);expect(seen).toEqual(['suspend']);host.turn();host.turn();
  expect(seen).toEqual(['suspend','publication','reply']);
  q.enqueue(()=>seen.push('next'));host.turn();expect(seen).toEqual(['suspend','publication','reply','next']);
  q.drainFrame();q.enqueue(()=>seen.push('new frame period'));host.advance(200);
  expect(seen).toEqual(['suspend','publication','reply','next','suspend']);
  host.turn();expect(seen.at(-1)).toBe('new frame period');
 }finally{q.close();}
});
