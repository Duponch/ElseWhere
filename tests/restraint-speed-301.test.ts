import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {humanMoveSpeedFactor297} from '../src/sim/human-move-speed-297.ts';
import {inRestraints301} from '../src/sim/restraint-rules-301.ts';
import type {PrisonerState} from '../src/sim/prisoner-state.ts';
import type {World} from '../src/sim/types.ts';

// RimWorld 1.6.4871: Pawn.TicksPerMove applies x0.35 only while
// RestraintsUtility.InRestraints holds; a released prisoner and a prisoner in a
// prison break (LordJob_PrisonBreak.NeverInRestraints) walk at their own speed.
function world(schema=301):World {
  const w=createWorld(301,16,16);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.structures=[];w.resources=[];
  w.roofing={constructed:[],build:[],remove:[],cursor:0};delete w.climate;delete w.gameProfile;w.tick=0;w.schemaVersion=schema as World['schemaVersion'];
  return w;
}
const held=(extra:Partial<PrisonerState>={}):PrisonerState=>({capturedAt:0,initialResistance:10,resistance:10,mode:'maintain',chatDay:0,chatCount:0,rng:1,...extra});

test('a held prisoner moves at x0.35; released or breaking out, at full speed (schema 301)',()=>{
  const w=world(),pawn=w.pawns[0]!,free=humanMoveSpeedFactor297(w,pawn);
  expect(free).toBeGreaterThan(0);
  pawn.prisoner=held();
  expect(inRestraints301(w,pawn)).toBe(true);expect(humanMoveSpeedFactor297(w,pawn)).toBeCloseTo(free*.35,12);
  pawn.prisoner=held({releasedAt:0,escape:{x:0,z:0}});
  expect(inRestraints301(w,pawn)).toBe(false);expect(humanMoveSpeedFactor297(w,pawn)).toBe(free);
  pawn.prisoner=held({breakout:{rng:1,active:{startedAt:0,initiatorId:pawn.id}}});
  expect(inRestraints301(w,pawn)).toBe(false);expect(humanMoveSpeedFactor297(w,pawn)).toBe(free);
  // A break that is over restrains again.
  pawn.prisoner=held({breakout:{rng:1,lastAt:0}});
  expect(humanMoveSpeedFactor297(w,pawn)).toBeCloseTo(free*.35,12);
});

test('historical schemas keep x0.35 for every prisoner',()=>{
  const w=world(300),pawn=w.pawns[0]!,free=humanMoveSpeedFactor297(w,pawn);
  pawn.prisoner=held({releasedAt:0,escape:{x:0,z:0}});
  expect(inRestraints301(w,pawn)).toBe(true);expect(humanMoveSpeedFactor297(w,pawn)).toBeCloseTo(free*.35,12);
  pawn.prisoner=held({breakout:{rng:1,active:{startedAt:0,initiatorId:pawn.id}}});
  expect(humanMoveSpeedFactor297(w,pawn)).toBeCloseTo(free*.35,12);
});
