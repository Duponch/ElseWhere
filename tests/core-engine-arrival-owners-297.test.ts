import {expect,test} from 'vitest';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {controlledInjury} from './scenarios/health.ts';
import {applyCommand,advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {reconcilePawnHealth} from '../src/sim/health.ts';
import {recordFilthMovement} from '../src/sim/filth.ts';
import {applyBulletStagger} from '../src/sim/stagger.ts';
import {applyMeleeStun,meleeStunCore318} from '../src/sim/stun.ts';
import {carrierOf} from '../src/sim/rescue-state.ts';
import {validateWorld} from '../src/sim/serialization.ts';
import {BLOOD_UNIT} from '../src/sim/injury-rules.ts';
import type {World,Pawn} from '../src/sim/types.ts';

function quiet(count=1):World {
 const w=deconstructionCamp(count,32);expect(w.phaseCore297).toBe(0);
 for(const [i,p]of w.pawns.entries()){
  Object.assign(p,{x:3,z:5+i*7,hunger:70,rest:80,needCooldown:20,background:{childhood:'quiet-child',adulthood:'medic'}});
  p.schedule.fill('anything');p.recreation.level=100;
  for(const k of Object.keys(p.priorities)as(keyof Pawn['priorities'])[])p.priorities[k]=0;
 }
 return w;
}
function step(w:World){const before=effectiveCore297(w);expect(advanceWorldCore297(w).core).toBe(before+1);}
function until(w:World,done:()=>boolean,limit=240){for(let n=0;n<limit&&!done();n++)step(w);expect(done()).toBe(true);}

test('a real carried mirror does not spend a second walker feet/RNG operation when it appears before its carrier',()=>{
 const w=quiet(2),carrier=w.pawns[0]!,patient=w.pawns[1]!;
 Object.assign(patient,{x:12,z:5});controlledInjury(w,patient,'left-arm',5000,'cut');controlledInjury(w,patient,'right-arm',5000,'bruise');
 patient.health!.bloodLoss=BLOOD_UNIT*.61;reconcilePawnHealth(w,patient);expect(patient.state).toBe('downed');
 Object.assign(fixtureBuilding(w,'bed',3,20),{medical:true});
 expect(applyCommand(w,{type:'draft',pawnIds:[carrier.id],enabled:true}).ok).toBe(true);
 expect(applyCommand(w,{type:'order-rescue',pawnId:carrier.id,patientId:patient.id,queue:false}).ok).toBe(true);
 until(w,()=>carrier.rescue?.phase==='carry'&&carrier.moveCooldown>0&&!!carrier.motion&&Math.ceil(carrier.motion.end*10)%10!==0);
 expect(carrierOf(w,patient.id)).toBe(carrier);
 // Existing original identities are deliberately iterated in the other order;
 // no Pawn, hold, command or captured edge is manufactured or cloned here.
 w.pawns=[patient,carrier];
 const arrival=Math.ceil(carrier.motion!.end*10);until(w,()=>effectiveCore297(w)===arrival-1);
 w.filth={rng:1,items:[],cleaned:0};carrier.filthFeet={carried:[{kind:'slime',thickness:2}]};patient.filthFeet={carried:[{kind:'blood',thickness:2}]};
 const frozenPatient=structuredClone(patient.filthFeet),expected=structuredClone(w),expectedCarrier=expected.pawns.find(p=>p.id===carrier.id)!;
 recordFilthMovement(expected,expectedCarrier);step(w);
 expect(w.filth!.rng).toBe(expected.filth!.rng);expect(carrier.filthFeet).toEqual(expectedCarrier.filthFeet);expect(patient.filthFeet).toEqual(frozenPatient);
 expect(w.filth!.items.map(f=>[f.kind,f.x,f.z,f.thickness])).toEqual(expected.filth!.items.map(f=>[f.kind,f.x,f.z,f.thickness]));
 expect(carrierOf(w,patient.id)).toBe(carrier);expect(patient.motion?.snowEntryPending).toBeUndefined();
});

test('an otherwise idle human expires stun/stagger on the exact Core before current validation, without a combat owner or macro tick',()=>{
 const w=quiet(),p=w.pawns[0]!;
 // Schema 318: the Core Blunt stun lasts 120 Core ticks (45 before). It starts
 // on Core 5 so that both expiries stay off the macro boundary (phase 5).
 applyBulletStagger(w,p,0,1);until(w,()=>effectiveCore297(w)===5);applyMeleeStun(w,p,5);
 const stunEnd=5+meleeStunCore318(w.schemaVersion);
 expect(p.stun?.untilCore).toBe(stunEnd);expect(p.stagger?.untilCore).toBe(95);
 until(w,()=>effectiveCore297(w)===94);expect(p.stagger).toBeDefined();step(w);expect(w.phaseCore297).toBe(5);expect(p.stagger).toBeUndefined();expect(p.stun).toBeDefined();
 until(w,()=>effectiveCore297(w)===stunEnd-1);expect(p.stun).toBeDefined();step(w);expect(w.phaseCore297).toBe(5);expect(p.stun).toBeUndefined();
 expect(p.shooting).toBeUndefined();expect(p.melee).toBeUndefined();expect(validateWorld(w)).toEqual([]);
});