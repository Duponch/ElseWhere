import {expect,test} from 'vitest';
import {isSealedMotionHistory,ownedMotionPiece297,MotionRecorder} from '../src/bridge/motion-tracks.ts';
import {frozenDataCopy297} from '../src/bridge/core-frozen-copy-297';
import type {World} from '../src/sim/types.ts';

const edge=(start:number,end:number,x=1)=>({start,end,from:{x:0,z:0},to:{x,z:1}});
function local():World {
  return {schemaVersion:379,tick:4,phaseCore297:0,pawns:[
    {id:7,x:1,z:1,motion:edge(4,6)},{id:3,x:0,z:0,motion:null}
  ]} as unknown as World;
}

test('sealed histories retain old values across a same-start retarget, a stop, roster replacement and expiry',()=>{
  const w=local(),fixed=new MotionRecorder(true),oracle=new MotionRecorder();
  const read=(ids?:number[])=>{
    if(ids)fixed.capturePhysical(w,ids);else fixed.capture(w);
    oracle.capture(w);
    const result=fixed.snapshot();
    expect(result).toStrictEqual(oracle.snapshot());
    return result;
  };
  const a=read(),held=structuredClone(a);
  expect(isSealedMotionHistory(a[0]!.segments)).toBe(true);
  w.phaseCore297=1;
  expect(read([])).toBe(a);
  w.pawns[0]!.motion=edge(4,7,2);w.phaseCore297=2;
  const b=read([7]);
  expect(b[0]!.segments).not.toBe(a[0]!.segments);
  expect(b[1]!.segments).toBe(a[1]!.segments);
  w.pawns[0]!.motion=null;w.phaseCore297=4;read([7]);
  expect(a).toStrictEqual(held);
  w.pawns=[...w.pawns,{...w.pawns[1]!,id:12,motion:edge(4.5,7)}];w.phaseCore297=5;
  expect(read([]).map(track=>track.id)).toEqual([7,3,12]);
  for(let tick=5;tick<80;tick++){w.tick=tick;w.phaseCore297=0;w.pawns[0]!.motion=edge(tick,tick+1);read();}
  expect(a).toStrictEqual(held);
  fixed.reset();oracle.reset();expect(read().length).toBe(3);
});

test('an old empty stagger array can change between observations without certifying its track',()=>{
  const w=local(),fixed=new MotionRecorder(true);
  const segment=w.pawns[0]!.motion!;segment.stagger=[];fixed.capture(w);
  const row=fixed.snapshot()[0]!;
  expect(isSealedMotionHistory(row.segments)).toBe(false);
  segment.stagger.push({start:4,end:4.5});
  expect(row.segments[0]!.stagger).toEqual([{start:4,end:4.5}]);
  expect(Object.isFrozen(segment.stagger)).toBe(false);
  expect(ownedMotionPiece297(row.segments[0]!)).toBeUndefined();
});

test('only detached finite recorder pieces can serve as their exact own-data copy',()=>{
 const w=local(),fixed=new MotionRecorder(true);
 fixed.capture(w);const first=fixed.snapshot()[0]!.segments[0]!;
 expect(ownedMotionPiece297(first)).toBe(first);expect(first).toStrictEqual(frozenDataCopy297(first));
 expect(ownedMotionPiece297(structuredClone(first))).toBeUndefined();
 w.pawns[0]!.motion=edge(7,Infinity);w.tick=7;fixed.capture(w);
 const unsafe=fixed.snapshot()[0]!.segments.at(-1)!;
 expect(ownedMotionPiece297(unsafe)).toBeUndefined();expect(()=>frozenDataCopy297(unsafe)).toThrow('Nonfinite Core phase number');
 w.tick=73;w.pawns[0]!.motion=edge(73,74);fixed.capture(w);
 // The old Infinity segment is still present until the next one ages out:
 // a later good append never certifies a history with an unsafe prefix.
 expect(isSealedMotionHistory(fixed.snapshot()[0]!.segments)).toBe(false);
});
