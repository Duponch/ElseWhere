import {expect,test} from 'vitest';
import {tweenedRootStep} from '../scripts/harvest-assertions';

// The presentation check's model of PawnTweener297 (RimWorld's PawnTweener):
// spring of 0.09 x (frame seconds x 60 x speed), root adopted at x5 and above,
// frozen at pause. A drawn pose that does anything else is a jump.
const at=(x:number,z=0)=>({x,z});

test('below x5 the drawn pose moves toward the root by the spring fraction, never more',()=>{
 const previous=at(0),root=at(1),fraction=.09*.005*60*1; // 5 ms at x1: 2.7 % of the gap
 expect(tweenedRootStep(previous,at(fraction),root,5,1)).toBe(true);
 expect(tweenedRootStep(previous,at(0),root,5,1)).toBe(true);
 // A snap to the root at x1 or x3 is a jump.
 expect(tweenedRootStep(previous,at(1),root,5,1)).toBe(false);
 expect(tweenedRootStep(previous,at(1),root,5,3)).toBe(false);
 // Off the previous -> root line, or away from the root.
 expect(tweenedRootStep(previous,{x:fraction,z:.01},root,5,1)).toBe(false);
 expect(tweenedRootStep(previous,at(-.01),root,5,1)).toBe(false);
 // A long frame allows a larger fraction (x3, 30 ms: 48.6 %).
 expect(tweenedRootStep(previous,at(.45),root,30,3)).toBe(true);
});

test('at x5 and above the drawn pose is the root itself: the switch to x6 snaps, as in RimWorld',()=>{
 expect(tweenedRootStep(at(0),at(.8),at(.8),5,6)).toBe(true);
 expect(tweenedRootStep(at(0),at(.4),at(.8),5,6)).toBe(false);
});

test('at pause the drawn pose does not move',()=>{
 expect(tweenedRootStep(at(.3),at(.3),at(1),5,0)).toBe(true);
 expect(tweenedRootStep(at(.3),at(.31),at(1),5,0)).toBe(false);
});

test('a drawn pose already on its root stays on it',()=>{
 expect(tweenedRootStep(at(2),at(2),at(2),5,1)).toBe(true);
 expect(tweenedRootStep(at(2),at(2.1),at(2),5,1)).toBe(false);
});
