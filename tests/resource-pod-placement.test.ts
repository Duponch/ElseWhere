import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {crashlandedProfile} from '../src/sim/game-profile.ts';
import {adoptMiscIncidents,MISC_FIRST_CHECK} from '../src/sim/cassandra-misc.ts';
import {advanceResourcePod305,resolveSelectedResourcePod305,resourcePodContents305} from '../src/sim/resource-pods-305.ts';
import {withPileIndexScope} from '../src/sim/pile-index.ts';
import {validateWorld} from '../src/sim/serialization.ts';

/** Found by the prison campaign (day 53): a resource pod opened inside a
 * simulation step laid five stacks of light leather on one floor cell, and
 * the save no longer validated ("Several item stacks occupy one floor cell"). */
test('a resource pod opened inside a step lays at most one stack per floor cell',()=>{
  for(const seed of [1234,77,4242,9001]){
    const w=createWorld(305,40,40);w.gameProfile=crashlandedProfile();delete w.heatwaves;adoptMiscIncidents(w);
    const state=w.miscIncidents!;w.tick=MISC_FIRST_CHECK;state.nextCheck=w.tick+100;state.introDone=true;state.opportunities=1;state.checks=1;
    expect(resolveSelectedResourcePod305(w,seed)).toBe(true);
    const pod=state.resourcePod305!,{stacks}=resourcePodContents305(pod.seed),before=w.piles.length;
    w.tick=pod.openAt;
    withPileIndexScope(()=>advanceResourcePod305(w));
    expect(state.resourcePod305).toBeUndefined();
    const made=w.piles.slice(before),cells=made.map(p=>p.owner.type==='ground'?`${p.owner.x},${p.owner.z}`:'?');
    expect(new Set(cells).size,`seed ${seed}: ${stacks.length} stacks`).toBe(made.length);
    expect(validateWorld(w).filter(e=>/stack/i.test(e))).toEqual([]);
  }
});
