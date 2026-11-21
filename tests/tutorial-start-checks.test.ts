import {expect,test} from 'vitest';
import {createStartingCandidateRoster,previewStartingCandidate,rerollStartingCandidateForRoster} from '../src/sim/starting-candidates';
import {violentWorkRefusal} from '../src/sim/colonist-backgrounds';

/* Found while playing the tutorial on screen (21 November 2026). Core
 * StartingPawnUtility.DefaultStartingPawnRequest passes TutorSystem.TutorialMode
 * as mustBeCapableOfViolence: in the tutorial every starting or optional
 * candidate, first drawn or renewed, can fight. Elsewhere drew them like any
 * other game, then refused the start. */

const able=(seed:number,d:{serial:number;generation:number})=>violentWorkRefusal(previewStartingCandidate(seed,d))===undefined;
const SEEDS=Array.from({length:40},(_,i)=>1000+i*7919);

test('a tutorial draws eight candidates who can all fight; other games draw as before',()=>{
 let otherwise=0;
 for(const seed of SEEDS){
  const tutorial=createStartingCandidateRoster(seed,{capableOfViolence:true}),normal=createStartingCandidateRoster(seed);
  expect(tutorial.map(d=>d.serial)).toEqual([1,2,3,4,5,6,7,8]);
  expect(tutorial.every(d=>able(seed,d))).toBe(true);
  // The rule only skips refused births: an able reserve (never renewed for the
  // team's missing work) is the same person in both games.
  for(const d of normal.slice(3))if(able(seed,d))expect(tutorial.find(t=>t.serial===d.serial)).toEqual(d);
  otherwise+=normal.filter(d=>!able(seed,d)).length;
  expect(createStartingCandidateRoster(seed,{})).toEqual(normal);
 }
 // Without the rule some candidates refuse violence, so the check above means something.
 expect(otherwise).toBeGreaterThan(0);
});

test('renewing a tutorial candidate always gives someone who can fight, and leaves the others alone',()=>{
 const seed=271828;let roster=createStartingCandidateRoster(seed,{capableOfViolence:true});
 for(let i=0;i<60;i++){
  const serial=roster[i%8]!.serial,before=roster;
  roster=rerollStartingCandidateForRoster(seed,roster,serial,{capableOfViolence:true});
  const renewed=roster.find(d=>d.serial===serial)!;
  expect(renewed.generation).toBeGreaterThan(before.find(d=>d.serial===serial)!.generation);
  expect(able(seed,renewed)).toBe(true);
  expect(roster.filter(d=>d.serial!==serial)).toEqual(before.filter(d=>d.serial!==serial));
 }
 // A normal game still renews into anyone.
 let normal=createStartingCandidateRoster(seed),refused=0;
 for(let i=0;i<60;i++){normal=rerollStartingCandidateForRoster(seed,normal,normal[i%8]!.serial);refused+=normal.filter(d=>!able(seed,d)).length?1:0;}
 expect(refused).toBeGreaterThan(0);
});
