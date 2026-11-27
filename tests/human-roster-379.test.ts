import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {expect,test} from 'vitest';
import {humanById379,markOrderedHuman379,orderedHumanCandidates379} from '../src/sim/human-roster-379.ts';
import {orderedTargetClaimant378} from '../src/sim/order-types.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import type {Pawn} from '../src/sim/types.ts';

test('closed lookup follows real enqueue, handoff, cancellation and roster arrival order',()=>{
  const a={id:1} as Pawn,b={id:2} as Pawn,world={schemaVersion:SCHEMA_VERSION,pawns:[a,b]};
  const order={type:'order-equipment',pawnId:b.id,itemId:77,action:'equip',queue:false} as const;
  withJournalTerrainReadScope({},()=>{
    expect(humanById379(world.pawns,2)).toBe(b);
    expect(orderedHumanCandidates379(world.pawns)).toEqual([]);
    b.orderedQueue378=[order];markOrderedHuman379(world.pawns,b);
    expect(orderedTargetClaimant378(world,'pile',77)).toBe(b);
    a.orderedQueue378=[{...order,pawnId:a.id}];markOrderedHuman379(world.pawns,a);
    expect(orderedTargetClaimant378(world,'pile',77)).toBe(a);
    expect(orderedTargetClaimant378(world,'pile',77,a.id)).toBe(b);
    delete a.orderedQueue378;
    expect(orderedTargetClaimant378(world,'pile',77)).toBe(b);
    const c={...b,id:9};world.pawns.push(c);
    expect(humanById379(world.pawns,9)).toBe(c);
    world.pawns=[c,b];expect(orderedTargetClaimant378(world,'pile',77)).toBe(c);
  });
  world.pawns.reverse();
  expect(orderedTargetClaimant378(world,'pile',77)).toBe(b);
});
