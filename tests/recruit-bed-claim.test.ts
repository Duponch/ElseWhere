import {expect,test} from 'vitest';
import {stepWorld} from '../src/sim/engine.ts';
import {validateWorld} from '../src/sim/serialization.ts';
import {captureActorBeds256} from '../src/sim/actor-bed-local-256.ts';
import {recruitmentUiFixture} from './scenarios/prison-camp.ts';

/** Found by the prison campaign (day 53): a recruited prisoner kept the global
 * claim on its prison bed while its local bed was cleared, and the save no
 * longer loaded ("Owned bed has no matching original or local alias"). */
test('a recruited prisoner gives up its prison bed and the save stays valid',()=>{
  const q=recruitmentUiFixture(),w=q.world,warden=w.pawns.find(p=>p.id===q.actorId)!,recruit=w.pawns.find(p=>p.id===q.patientId)!;
  const ref=captureActorBeds256(w).refs.find(r=>r.id===q.bedId)!;
  expect(ref.mapId).not.toBeNull();
  recruit.mapBed={revision:1,mapId:ref.mapId!,bedId:q.bedId};
  expect(validateWorld(w)).toEqual([]);
  recruit.prisoner!.resistance=0;recruit.prisoner!.mode='recruit';warden.priorities.warden=1;
  for(let i=0;i<260&&!recruit.recruitment;i++)stepWorld(w);
  expect(recruit.recruitment).toBeDefined();
  expect(recruit.mapBed).toBeUndefined();
  expect(validateWorld(w)).toEqual([]);
});
