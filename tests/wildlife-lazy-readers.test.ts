import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {advanceWildlife} from '../src/sim/wildlife.ts';
import * as health from '../src/sim/wildlife-health.ts';
import * as food from '../src/sim/wildlife-food.ts';
import * as rest from '../src/sim/animal-rest.ts';
import {animalNutritionMax} from '../src/sim/animal-life.ts';
import {createMedicalRecord,addResolvedInjury} from '../src/sim/injury-state.ts';
import type {Structure} from '../src/sim/types.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

afterEach(()=>vi.restoreAllMocks());

function fixture(){
 const w=createWorld(1823,16,16);w.tick=2000;
 w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.pawns=[];
 const a:WildAnimal={id:w.nextId++,species:'hare',sex:'female',ageTicks:6000,x:6,z:6,food:.4,rest:.9,state:'idle',path:[],nextDecision:w.tick+100,
  domestic:{since:w.tick,care:'herbal',tameness:5,nextDecay:w.tick+45000,lastTraining:w.tick}};
 a.food=animalNutritionMax(a)*.99;
 w.wildlife={profile:'temperate-hares-v1',rng:17,animals:[a],eatenPlants:0,eatenNutrition:0,eatenItems:0};
 const add=(kind:Structure['kind'],x:number,z:number)=>{const s:Structure={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard'};w.structures.push(s);return s;};
 for(let x=4;x<=8;x++){add('fence',x,4);add('fence',x,8);}
 for(let z=5;z<8;z++){add('fence',4,z);add('fence',8,z);}
 const marker=add('pen-marker',6,5);a.domestic!.penMarkerId=marker.id;
 const inside=add('animal-sleeping-spot',7,6),outside=add('animal-sleeping-spot',9,6);
 return {w,a,inside,outside};
}

test('a healthy animal keeps its committed edge and all needs without assessing an unused body',()=>{
 const {w,a}=fixture(),body=vi.spyOn(health,'animalBody');
 a.motion={from:{x:5,z:6},to:{x:6,z:6},start:w.tick-1,end:w.tick+2,speedFactor:1,terrainDelay:0};a.state='moving';
 const edge=structuredClone(a.motion),before=structuredClone(w),foodPerTick=animalNutritionMax(a);
 advanceWildlife(w);
 expect(body.mock.calls.filter(([animal])=>animal===a)).toHaveLength(0);
 expect(a.motion).toEqual(edge);expect(a.ageTicks).toBe(before.wildlife!.animals[0]!.ageTicks+1);
 expect(a.food).toBeLessThan(before.wildlife!.animals[0]!.food);expect(a.food).toBeGreaterThan(foodPerTick*.9);
 expect(a.rest).toBeLessThan(before.wildlife!.animals[0]!.rest);
 expect(w.rng).toBe(before.rng);expect(w.wildlife!.rng).toBe(before.wildlife!.rng);expect(w.nextId).toBe(before.nextId);
});

test('a clinical animal on a committed edge retains its early capacity assessment',()=>{
 const {w,a}=fixture();a.health={...createMedicalRecord(w.tick-1),body:'hare'};
 addResolvedInjury(a.health,'left-front-leg','bruise',500,()=>.999999);
 a.motion={from:{x:5,z:6},to:{x:6,z:6},start:w.tick-1,end:w.tick+2,speedFactor:1,terrainDelay:0};a.state='moving';
 const body=vi.spyOn(health,'animalBody');advanceWildlife(w);
 expect(body.mock.calls.some(([animal])=>animal===a)).toBe(true);
 expect(a.health.tick).toBe(w.tick);expect(a.motion.end).toBe(w.tick+2);
});

test('an animal with no rest action does not read pen geometry',()=>{
 const {w,a}=fixture(),pen=vi.spyOn(food,'grazingPen');advanceWildlife(w);
 expect(pen.mock.calls.filter(([,animal])=>animal===a)).toHaveLength(0);
 expect(a.animalRest).toBeUndefined();expect(a.state).toBe('idle');
});

// Eager capture is the previous caller's boundary. Compare the whole world,
// including random streams and ownership, against that boundary on each case.
test.each(['wanted','owned-outside','travelling','sleeping','hungry','awake'] as const)('rest decisions match an eager pen capture: %s',kind=>{
 const {w,a,inside,outside}=fixture();
 a.nextDecision=w.tick;a.rest=.2;
 if(kind==='owned-outside')a.domestic!.bedId=outside.id;
 if(kind==='travelling'){a.animalRest={spotId:inside.id,phase:'travel'};a.path=[{x:inside.x,z:inside.z}];a.state='moving';}
 if(kind==='sleeping'){a.x=inside.x;a.z=inside.z;a.animalRest={spotId:inside.id,phase:'sleep'};a.state='sleeping';}
 if(kind==='hungry')a.food=animalNutritionMax(a)*.1;
 if(kind==='awake'){a.rest=.9;a.nextDecision=w.tick+100;}
 const eager=structuredClone(w),processRest=rest.processAnimalRest;
 advanceWildlife(w);
 vi.spyOn(rest,'processAnimalRest').mockImplementation((world,animal,ctx)=>{
  const pen=food.grazingPen(world,animal),inside=(c:{x:number;z:number})=>!pen||pen.has(c.z*world.width+c.x);
  return processRest(world,animal,{...ctx,free:c=>inside(c)&&ctx.free(c),step:(from,to)=>inside(to)&&ctx.step(from,to),route:(goals,rank)=>ctx.route(goals.filter(inside),rank)});
 });
 advanceWildlife(eager);
 expect(w).toEqual(eager);
 if(kind==='wanted'||kind==='owned-outside'||kind==='travelling')expect(a.animalRest?.spotId).toBe(inside.id);
});
