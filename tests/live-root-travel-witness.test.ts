import {expect,test} from 'vitest';
import {confirmedTravelExcess,type TravelFrameWitness} from '../scripts/harvest-assertions';

// The presentation check proves that a frame faster than 13 cells per second
// is continuous travel, not a jump. Actors now write their current position
// as a zero-length GPU leg, so the proof is made on the displayed position:
// on its confirmed edge at the confirmed time, in both frames.
const edge=(x0:number,x1:number,start:number,end:number)=>({from:{x:x0,z:40},to:{x:x1,z:40},start,end});
/** A live-root witness exactly on its confirmed edge at `play`. */
function at(segment:ReturnType<typeof edge>,play:number,offset=0):TravelFrameWitness {
 const alpha=(play-segment.start)/(segment.end-segment.start),x=Math.fround(segment.from.x+(segment.to.x-segment.from.x)*alpha)+offset,position={x,z:40};
 return{position,from:{...position},to:{...position},start:0,end:0,time:play/6,play,segment};
}
const dt=5,first=edge(120,121,2000,2001.3),second=edge(121,122,2001.3,2002.6);

test('ordinary x6 travel on one confirmed edge is continuous, though faster than the raw alarm',()=>{
 const previous=at(first,2000.5),current=at(first,2000.5+dt*.036);
 expect(Math.hypot(current.position.x-previous.position.x,current.position.z-previous.position.z)).toBeGreaterThan(dt*.013+.02);
 expect(confirmedTravelExcess(previous,current,dt)).toBe(true);
});

test('crossing exactly into the next confirmed edge is continuous',()=>{
 expect(confirmedTravelExcess(at(first,2001.25),at(second,2001.25+dt*.036),dt)).toBe(true);
});

test('a displayed position off its confirmed edge is a jump',()=>{
 const previous=at(first,2000.5);
 expect(confirmedTravelExcess(previous,at(first,2000.5+dt*.036,.01),dt)).toBe(false);
 const sideways=at(first,2000.5+dt*.036);sideways.position.z+=.01;sideways.from.z=sideways.to.z=sideways.position.z;
 expect(confirmedTravelExcess(previous,sideways,dt)).toBe(false);
});

test('time that advanced faster than the x6 budget, or not at all, is a jump',()=>{
 const previous=at(first,2000.2);
 // A forward seek: a whole tick within one 5 ms frame.
 expect(confirmedTravelExcess(previous,at(first,2001.2),dt)).toBe(false);
 // The position moved while the presented time did not.
 const frozen=at(first,2000.2);frozen.position.x+=.2;frozen.from.x=frozen.to.x=frozen.position.x;
 expect(confirmedTravelExcess(previous,frozen,dt)).toBe(false);
});

test('a skipped or replaced confirmed edge is a jump',()=>{
 const third=edge(122,123,2002.6,2003.9);
 expect(confirmedTravelExcess(at(first,2001.25),at(third,2002.65),dt)).toBe(false);
 // Not contiguous in time: the next edge starts later than the previous one ends.
 const late=edge(121,122,2001.4,2002.7);
 expect(confirmedTravelExcess(at(first,2001.25),at(late,2001.42),dt)).toBe(false);
});

test('a half-live witness is not proved by this path',()=>{
 const previous=at(first,2000.5),current=at(first,2000.5+dt*.036);
 // A real leg on one side: the leg proof applies and refuses these inconsistent legs.
 const leg={...current,from:{x:120,z:40},to:{x:121,z:40},start:333.3,end:333.5};
 expect(confirmedTravelExcess(previous,leg,dt)).toBe(false);
});
