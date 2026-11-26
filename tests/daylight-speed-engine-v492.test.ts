import {expect,test} from 'vitest';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {applyCommand,advanceWorldCore297} from '../src/sim/engine.ts';
import {fullLightReference297,previousLightReference297,currentLightReference297,daylightFactoryObservations297} from './helpers/daylight-core-factories-v492.ts';
import {serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {annualNaturalLight} from '../src/sim/environment.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import type {Command,Pawn,World,Structure} from '../src/sim/types.ts';
const factory={fullLightReference297,previousLightReference297,currentLightReference297,daylightFactoryObservations297};
// Exact known validated two-human fixture family from the existing seven Light
// contracts, without a new clock or a cloned Engine/catalogue graph.
function fixture(){const w=deconstructionCamp(2,32);w.growingZones=[];w.stockpiles=[];
 for(const[i,p]of w.pawns.entries()){Object.assign(p,{x:4,z:8+i*10,hunger:80,rest:80,needCooldown:20});p.schedule.fill('anything');p.recreation.level=100;for(const k of Object.keys(p.priorities)as(keyof Pawn['priorities'])[])p.priorities[k]=0;}
 for(let z=4;z<=12;z++){const s:Structure=fixtureBuilding(w,z===8?'door':'wall',12,z);s.material='wood';if(z===8)s.door=newDoorState(w.tick);}fixtureBuilding(w,'campfire',7,7);return w;
}
function equal(a:World,b:World,label:string){expect(b.rng,label+' RNG').toBe(a.rng);expect(serializeWorld(b),label+' whole').toBe(serializeWorld(a));}
function both(a:World,b:World,c:Command){const x=applyCommand(a,structuredClone(c)),y=applyCommand(b,structuredClone(c));expect(x.ok,'Actual command accepted').toBe(true);expect(y).toStrictEqual(x);equal(a,b,'Command '+c.type);}
function run(changes:boolean,current=false){const a=fixture(),b=structuredClone(a);expect(validateWorld(a)).toStrictEqual([]);expect(annualNaturalLight(a)).toBeLessThan(.3);if(current){factory.previousLightReference297(a);factory.currentLightReference297(b);}else factory.fullLightReference297(a);const ids=a.pawns.map(p=>p.id);
 both(a,b,{type:'draft',pawnIds:ids,enabled:true});for(const[id,z]of [[ids[0]!,8],[ids[1]!,18]] as const)both(a,b,{type:'draft-move',pawnIds:[id],target:{x:24,z},queue:false});
 for(let i=0;i<40;i++){
  if(changes&&(i===7||i===19||i===31)){if(i===19)for(const w of[a,b])w.structures.find(s=>s.kind==='campfire')!.fuel!.ticks=0;both(a,b,{type:'draft-move',pawnIds:[ids[0]!],target:{x:24,z:8},queue:false});}
  const before=effectiveCore297(a),x=advanceWorldCore297(a),y=advanceWorldCore297(b);expect(y).toStrictEqual(x);expect(effectiveCore297(a)).toBe(before+1);expect(effectiveCore297(b)).toBe(before+1);equal(a,b,'Actual Night Core '+(before+1));
 }
 expect(a.tick).toBe(4);expect(a.phaseCore297).toBe(0);expect(a.pawns.some(p=>p.x!==4)).toBe(true);expect(validateWorld(a)).toStrictEqual([]);expect(validateWorld(b)).toStrictEqual([]);
 const x=factory.daylightFactoryObservations297(a),y=factory.daylightFactoryObservations297(b);expect(x?.mode).toBe(current?'previous':'full');expect(y?.mode).toBe(current?'current':'daylight');expect(x?.bodySHA256).toBe(current?process.env.DAYLIGHT_SPEED_PREVIOUS_CORE_SHA:process.env.DAYLIGHT_SPEED_BEFORE_CORE_SHA);expect(y?.bodySHA256).toBe(current?process.env.DAYLIGHT_SPEED_CURRENT_CORE_SHA:process.env.DAYLIGHT_SPEED_SELECTED_CORE_SHA);expect(x!.factories).toBeGreaterThan(0);expect(y!.factories).toBe(x!.factories);expect(x!.macros).toBeGreaterThan(0);expect(y!.macros).toBe(x!.macros);if(changes){expect(x!.invalidations).toBeGreaterThan(0);expect(y!.invalidations).toBe(x!.invalidations);}
}

test('real Night movement preserves each committed Core, complete SAVE, RNG and receipts against the full-reader factory',()=>run(false));
test('real Night command invalidations and fuel-source changes preserve complete SAVE and RNG against the full-reader factory',()=>run(true));
test('current production Night movement preserves each committed Core and complete SAVE against the exact pre-receipt factory',()=>run(false,true));
test('current production Night command invalidations and fuel-source changes preserve SAVE and RNG against the exact pre-receipt factory',()=>run(true,true));
