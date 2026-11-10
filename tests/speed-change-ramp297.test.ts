import {expect,test} from 'vitest';
import {MotionTimeline} from '../src/render/MotionTimeline';

// A running speed change in fine297 mode: no freeze while the new reserve
// fills (speeding up), no seek to it (slowing down). Playback moves at the
// mean of the old and new rates until the confirmed history meets the new
// reserve, at most 250 ms. Numeric received-frontier tests only.
const eps=1e-9,TPS=6,reserve=(speed:number)=>speed*TPS*.036;
const history=(t:MotionTimeline)=>(t as unknown as {latest:number}).latest-t.tick;
/** A regular producer at `speed` publishing every 31 ms, the renderer drawing
 * every 5 ms; the producer switches at `at` to `next`. Returns per-frame moves. */
function run(speed:number,next:number,at:number,end:number,producerRatio=1){
 const t=new MotionTimeline();let latest=100,now=0,current=speed;
 t.adopt(latest,speed,[],0,true,true,true);
 const frames:{now:number;moved:number;history:number}[]=[];let nextReceipt=31,changed=false;
 while(now<end){
  now+=5;
  if(!changed&&now>=at){changed=true;current=next;}
  if(now>=nextReceipt){latest+=current*TPS*.031*producerRatio;t.adopt(latest,current,[],now,false,true,true);nextReceipt+=31;}
  const before=t.tick;t.advance(now);frames.push({now,moved:t.tick-before,history:history(t)});
  expect(t.tick).toBeLessThanOrEqual(latest+eps);
 }
 return{t,frames,latest};
}

test.each([[1,6],[1,3],[3,6]])('speeding up x%i -> x%i never freezes and never seeks',(from,to)=>{
 const {frames}=run(from,to,1000,1600);
 const changeFrame=frames.findIndex(f=>f.now>=1000+31);
 const after=frames.slice(changeFrame+1,changeFrame+60);
 // Every frame moves (no wait for the new reserve), and none faster than the new rate.
 for(const f of after){expect(f.moved).toBeGreaterThan(0);expect(f.moved).toBeLessThanOrEqual(to*TPS*.005+eps);}
 // The first frames already play faster than the old speed.
 expect(after[1]!.moved).toBeGreaterThan(from*TPS*.005+eps);
 // Within the transition budget the history reaches the new reserve, then x`to` holds.
 const settled=frames.filter(f=>f.now>=1000+31+250);
 for(const f of settled.slice(-20))expect(f.moved).toBeCloseTo(to*TPS*.005,9);
 expect(settled.at(-1)!.history).toBeGreaterThan(reserve(to)-.2);
});

test.each([[6,1],[3,1],[6,3]])('slowing down x%i -> x%i never seeks forward and drains to the new reserve',(from,to)=>{
 const {frames}=run(from,to,1000,1600);
 const changeFrame=frames.findIndex(f=>f.now>=1000+31);
 // No frame moves more than the old rate allows: the old seek moved up to a whole tick at once.
 for(const f of frames.slice(changeFrame))expect(f.moved).toBeLessThanOrEqual(from*TPS*.005+eps);
 // The slowdown is visible at once: slower than the old speed right after the change.
 const after=frames.slice(changeFrame+1,changeFrame+4);
 for(const f of after)expect(f.moved).toBeLessThan(from*TPS*.005-eps);
 // Then the history is back to the new reserve and x`to` holds.
 const settled=frames.filter(f=>f.now>=1000+31+300);
 expect(settled.at(-1)!.history).toBeLessThanOrEqual(reserve(to)+to*TPS*.031+eps);
 for(const f of settled.slice(-20))expect(f.moved).toBeLessThanOrEqual(to*TPS*.005+eps);
});

test('a slow producer ends the transition after 250 ms, then the supply estimate takes over',()=>{
 // The producer reaches only half of x6: the new reserve is never filled.
 const {frames}=run(1,6,1000,2400,.5);
 const after=frames.filter(f=>f.now>1000+31+260&&f.now<2400);
 // No freeze waiting for a reserve that never fills: playback keeps moving.
 const still=after.filter(f=>f.moved===0).length;
 expect(still/after.length).toBeLessThan(.9);
 // At most the reserve plus one receipt of the slower supply stays ahead.
 expect(frames.at(-1)!.history).toBeLessThanOrEqual(reserve(6)+3*TPS*.031+eps);
});

test('a speed change carried by a genuinely late receipt keeps the reserve join',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],0,true,true,true);t.adopt(101.5,6,[],20,false,true,true);t.advance(25);
 // 200 ms without a receipt: the playhead finished the history; a far frontier arrives with x1.
 t.advance(225);const before=t.tick;
 t.adopt(110,1,[],230,false,true,true);
 expect(t.tick).toBeGreaterThan(before);expect(110-t.tick).toBeCloseTo(reserve(1),9);
});

test('a pause during a transition shows the confirmed frontier exactly, and a reset clears it',()=>{
 const t=new MotionTimeline();t.adopt(100,6,[],0,true,true,true);t.adopt(101.5,6,[],20,false,true,true);t.advance(25);
 t.adopt(102,1,[],40,false,true,true);t.advance(45);
 t.adopt(102.2,0,[],50,false,true,true);expect(t.tick).toBe(102.2);expect(t.advance(1000)).toBe(102.2);
 t.adopt(50,3,[],2000,true,true,true);expect(t.tick).toBe(50);expect(t.advance(2010)).toBe(50);
});
