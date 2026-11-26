import {expect,test} from 'vitest';
import type {TravelFrameWitness} from '../scripts/harvest-assertions';
import {confirmedTravelExcess,tweenedRootStep} from '../scripts/harvest-assertions';
import {confirmedContactDepartureDiagnostic} from '../scripts/harvest-contact-departure';

// Recorded run perf379-closure-presentation, second candidate. Its preserved
// report remains red and untouched; this additional proof is diagnostic only.
function recorded(){
 const previous:TravelFrameWitness={position:{x:151.21212768554688,z:161.21212768554688},from:{x:151.21212768554688,z:161.21212768554688},to:{x:151,z:161},start:420.09921010335285,end:420.3392079671224,time:420.0992067871044,play:2520.5952407226264,
  segment:{from:{x:151,z:160},to:{x:151,z:161},start:2339,end:2340.504347826087}};
 const current:TravelFrameWitness={position:{x:151.7417994511161,z:161.04646503458878},from:{x:151.1525115966797,z:161.1525115966797},to:{x:152,z:161},start:420.16666920979816,end:420.4173940022786,time:420.3410067870865,play:2522.046040722519,
  segment:{from:{x:151,z:161},to:{x:152,z:161},start:2521,end:2522.504347826087}};
 return {previous,current,dt:40.29999999701977};
}
function resample(frame:TravelFrameWitness){const alpha=Math.min(1,Math.max(0,(frame.time-frame.start)/(frame.end-frame.start)));frame.position={x:frame.from.x+(frame.to.x-frame.from.x)*alpha,z:frame.from.z+(frame.to.z-frame.from.z)*alpha};}

test('recorded contact-to-edge handoff has a witnessed exact junction while existing acceptance stays red',()=>{
 const {previous,current,dt}=recorded();
 expect(confirmedTravelExcess(previous,current,dt)).toBe(false);
 expect(confirmedContactDepartureDiagnostic(previous,current,dt)).toBe(true);
});

test('contact departure proof rejects altered junctions, clocks, missing edges and coherent-looking warps',()=>{
 const mutations:((p:TravelFrameWitness,c:TravelFrameWitness)=>void)[]=[
  (_p,c)=>{c.from.x+=.01;resample(c);},
  (_p,c)=>{c.position.z+=.01;},
  (_p,c)=>{c.start+=.00001;c.end+=.00001;c.time+=.00001;resample(c);},
  (_p,c)=>{c.segment.start+=.01;c.start+=.01/6;resample(c);},
  (_p,c)=>{c.segment.from.z++;c.segment.to.z++;c.from.z++;c.to.z++;resample(c);},
  (_p,c)=>{c.segment.to.x++;c.to.x++;resample(c);},
  (_p,c)=>{c.to.z+=.4;resample(c);},
  (p,_c)=>{p.end+=.01;resample(p);},
  (p,_c)=>{p.segment.end=p.play;},
  (p,_c)=>{p.from.x+=.4;resample(p);},
  (_p,c)=>{c.play+=.01;c.time+=.01/6;resample(c);},
 ];
 for(const mutate of mutations){const {previous,current,dt}=recorded();mutate(previous,current);expect(confirmedContactDepartureDiagnostic(previous,current,dt)).toBe(false);}
});

test('a contact proof never supplies absent/nonfinite data or accepts an unbounded frame interval',()=>{
 const {previous,current,dt}=recorded();
 for(const key of ['position','from','to','start','end','time','play','segment']){const bad=structuredClone(current) as unknown as Record<string,unknown>;delete bad[key];expect(confirmedContactDepartureDiagnostic(previous,bad as unknown as TravelFrameWitness,dt)).toBe(false);}
 for(const elapsed of [0,-1,100,NaN])expect(confirmedContactDepartureDiagnostic(previous,current,elapsed)).toBe(false);
});

function stationaryRecorded(){
 const previous:TravelFrameWitness={position:{x:151.21212768554688,z:161.21212768554688},from:{x:151.21212768554688,z:161.21212768554688},to:{x:151.21212768554688,z:161.21212768554688},start:0,end:0,time:420.1569046356053,play:2520.941427813632,
  segment:{from:{x:151,z:160},to:{x:151,z:161},start:2339,end:2340.504347826087}};
 const current:TravelFrameWitness={position:{x:151.58669330738883,z:161.21212768554688},from:{x:151.21212768554688,z:161.21212768554688},to:{x:152.21212768554688,z:161.21212768554688},start:420.16666920979816,end:420.4173940022786,time:420.2605820976048,play:2521.563492585629,
  segment:{from:{x:151,z:161},to:{x:152,z:161},start:2521,end:2522.504347826087}};
 return {previous,current,dt:18.100000008940697};
}
test('the recorded stationary contact departure has one exact junction and an independent valid PawnTweener step',()=>{
 const {previous,current,dt}=stationaryRecorded();expect(confirmedTravelExcess(previous,current,dt)).toBe(false);
 expect(confirmedContactDepartureDiagnostic(previous,current,dt)).toBe(true);
 expect(tweenedRootStep(previous.position,{x:151.58670043945312,z:161.21212768554688},current.position,dt,6)).toBe(true);
});
test('stationary contact departure rejects false stillness, altered junctions, unfinished or missing edges and excess time',()=>{
 const mutations:((p:TravelFrameWitness,c:TravelFrameWitness)=>void)[]=[
  p=>{p.from.x+=.01;},p=>{p.position.x+=.01;},p=>{p.start=p.end=1;},p=>{p.segment.end=p.play;},
  (_p,c)=>{c.from.x+=.01;resample(c);},(_p,c)=>{c.segment.from.x++;c.segment.to.x++;c.from.x++;c.to.x++;resample(c);},
  (_p,c)=>{c.start+=.00001;c.end+=.00001;c.time+=.00001;resample(c);},(_p,c)=>{c.end+=.001;resample(c);},
  (_p,c)=>{c.play+=.1;c.time+=.1/6;resample(c);},(_p,c)=>{c.to.z+=.4;resample(c);},
 ];
 for(const mutate of mutations){const {previous,current,dt}=stationaryRecorded();mutate(previous,current);expect(confirmedContactDepartureDiagnostic(previous,current,dt)).toBe(false);}
});
