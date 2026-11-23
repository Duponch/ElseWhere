import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/index';
import {PawnLayer} from '../src/render/PawnLayer';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ActorAnimationCache} from '../src/render/ActorAnimationCache';
import {AnimationDetail} from '../src/render/AnimationDetail';
import {samplePawnRig,sampleAnimalRig} from '../src/render/actor-animation-sampling';
import {CPU_GESTURE_OPS,GestureNumber,gestureValue,humanGesture,animalGesture,animalIdleProfile,downedWiggleAngle,downedWigglePhase,downedWiggleOffset,humanGestureCode,
  HUMAN_GESTURE,ANIMAL_POSTURE_DOWNED,ANIMAL_APPENDAGE,GESTURE_SLOW_RATE,restingHumanChest,restingAnimalGesture,evaluateHumanGesture,evaluateAnimalGesture} from '../src/render/actor-idle-gestures';
import {HUMAN_ANIMATIONS,ANIMAL_ANIMATIONS,actionParticles} from '../src/render/animation-catalogue';
import {commonAnimalPresentationGeometry} from '../src/render/origami/animal-geometry';
import {SPECIES_COATS} from '../src/render/origami/species-coats';
import {GAME_UNUSED_BESTIARY_SOURCE_KEYS} from '../src/render/origami/game-paint-residency';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {animalCore256,isAnimalSpecies256} from '../src/sim/animal-core-v256';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {DEVELOPER_PAGES} from '../src/ui/developer-pages';
import {animalCombatCamp} from './scenarios/animal-combat';
import type {RecreationTask} from '../src/sim/recreation-rules';
import type {World} from '../src/sim/types';

const n=(value:number)=>new GestureNumber(value);
type HumanOut=ReturnType<typeof humanGesture>;
const human=(code:number,pose:number,t:number,phase=7*1.7,travelTime=t,cargo=0,walking=0):HumanOut=>humanGesture(CPU_GESTURE_OPS,{code:n(code),pose:n(pose),walking:n(walking),cargo:n(cargo),t:n(t),phase:n(phase),travelTime:n(travelTime)});
const values=(g:HumanOut)=>Object.fromEntries(Object.entries(g).map(([k,v])=>[k,gestureValue(v)])) as Record<keyof HumanOut,number>;

/** The real PawnLayer streams for one pawn of a fresh colony in a set state. */
function seatedScene(){
  const world=createWorld(),pawn=world.pawns[0]!,other=world.pawns[1]!;
  world.pawns=[pawn,other];world.structures=[];world.tick=120;
  pawn.x=10;pawn.z=10;delete pawn.motion;other.x=12;other.z=10;
  const stool={id:world.nextId++,kind:'stool' as const,x:10,z:10,orientation:0 as const,footprint:'standard' as const};
  const chess={id:world.nextId++,kind:'chess-table' as const,x:10,z:11,orientation:0 as const,footprint:'standard' as const};
  const tv={id:world.nextId++,kind:'tube-television' as const,x:10,z:13,orientation:0 as const,footprint:'standard' as const};
  const campfire={id:world.nextId++,kind:'campfire' as const,x:11,z:11,orientation:0 as const,footprint:'standard' as const};
  world.structures.push(stool,chess,tv,campfire);
  const layer=new PawnLayer();
  const streams=():{x:number;y:number;z:number;w:number}=>{world.tick++;layer.update(world,1,true);const m=layer.feedbackSource!.getAttribute('aMotion');return {x:m.getX(0),y:m.getY(0),z:m.getZ(0),w:m.getW(0)};};
  return {world,pawn,other,stool,chess,tv,campfire,layer,streams};
}

test('each seated, social and leisure animation of the page is what the real PawnLayer writes for its game state',()=>{
  const s=seatedScene(),{pawn}=s,base={target:{x:10,z:10},phase:'active' as const,elapsed:1};
  const play=(task:RecreationTask)=>{pawn.state='recreating';pawn.recreation.task=task;return s.streams();};
  const entry=(id:string)=>HUMAN_ANIMATIONS.find(a=>a.id===id)!;
  try{
    // Chess, poker and the game of Ur on a seat.
    for(const activity of ['chess','poker','game-of-ur'] as const)expect(play({...base,activity,buildingId:s.chess.id,seatId:s.stool.id})).toMatchObject({y:entry('table-game').activity,z:entry('table-game').pose});
    expect(play({...base,activity:'watch-television',buildingId:s.tv.id,seatId:s.stool.id})).toMatchObject({y:entry('television').activity,z:entry('television').pose});
    expect(play({...base,activity:'social-relax',buildingId:s.campfire.id,seatId:s.stool.id})).toMatchObject({y:entry('chat-seated').activity,z:entry('chat-seated').pose});
    expect(play({...base,activity:'visit-sick',buildingId:null,patientId:s.other.id,seatId:s.stool.id})).toMatchObject({y:entry('chat-seated').activity,z:entry('chat-seated').pose});
    expect(play({...base,activity:'party',buildingId:null})).toMatchObject({y:entry('party').activity,z:entry('party').pose});
    expect(play({...base,activity:'view-art',buildingId:null})).toMatchObject({y:entry('view-art').activity,z:entry('view-art').pose});
    expect(play({...base,activity:'skygaze',buildingId:null})).toMatchObject({y:0,z:entry('skygaze').pose});
    // Still walking to the seat: no gesture yet (the travel phase).
    expect(play({...base,phase:'travel',activity:'chess',buildingId:s.chess.id,seatId:s.stool.id}).y).toBe(0);
    // A downed colonist on the ground wiggles (Core); in a bed it does not.
    pawn.recreation.task=null;pawn.state='downed';pawn.need=null;
    const down=s.streams();expect(down).toMatchObject({y:entry('downed').activity,z:entry('downed').pose});
    expect(down.w).toBeCloseTo(downedWigglePhase(pawn.id,0),5);
    expect(humanGestureCode({...pawn,need:{kind:'sleep',phase:'sleep',bedId:99,target:{x:10,z:10}}} as typeof pawn)).toBe(0);
  }finally{s.layer.dispose();}
});

test('every catalogue entry of a person is a pose the rig knows, with a description and a game state',()=>{
  const ids=new Set<string>();
  for(const a of HUMAN_ANIMATIONS){
    expect(ids.has(a.id)).toBe(false);ids.add(a.id);
    expect(a.label.length).toBeGreaterThanOrEqual(4);expect(a.description.length).toBeGreaterThan(20);expect(a.state.length).toBeGreaterThanOrEqual(3);
    expect([0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,18,19,22]).toContain(a.pose);
  }
  for(const a of ANIMAL_ANIMATIONS){expect(a.description.length).toBeGreaterThan(20);expect([0,1,ANIMAL_POSTURE_DOWNED,2]).toContain(a.posture);}
  expect(HUMAN_ANIMATIONS.filter(a=>a.pose===3).length).toBeGreaterThanOrEqual(8);
  expect(actionParticles()).toEqual([]);
  // The page is declared once with the other developer pages.
  expect(DEVELOPER_PAGES.find(page=>page.id==='animations')).toMatchObject({file:'animations.html',published:true});
});

test('seated people are animated: hands forward on the table, breathing torso, moving head, never arms hanging',()=>{
  const times=Array.from({length:240},(_,i)=>i*.05);
  for(const a of HUMAN_ANIMATIONS.filter(a=>a.pose===3)){
    const rows=times.map(t=>values(human(a.activity,a.pose,t,7*1.7,t,a.cargo?1:0)));
    const range=(key:keyof HumanOut)=>Math.max(...rows.map(r=>r[key]))-Math.min(...rows.map(r=>r[key]));
    expect(rows.every(r=>r.upper===1),a.id).toBe(true);
    // Some upper-body motion over 12 s, and the arms never hang straight down.
    expect(range('head')+range('lean')+range('yaw')+range('arm2')+range('arm3'),a.id).toBeGreaterThan(.08);
    expect(rows.every(r=>r.arm2< -.2&&r.arm3< -.2),a.id).toBe(true);
  }
  // Forearms on the table and eyes on the board while playing.
  const game=values(human(HUMAN_GESTURE.tableGame,3,1));expect(game.arm2).toBeLessThan(-.9);expect(game.lean).toBeGreaterThan(.1);
});

test('gestures are deterministic per actor, bounded, and continuous across both clock wraps',()=>{
  const cases:[number,number][]=[[0,0],[0,3],[HUMAN_GESTURE.tableGame,3],[HUMAN_GESTURE.television,3],[HUMAN_GESTURE.chat,3],[HUMAN_GESTURE.chat,0],[HUMAN_GESTURE.viewArt,0],[HUMAN_GESTURE.eat,2],[HUMAN_GESTURE.eat,3],[14,3],[14,0],[2,3],[3,3],[1,3],[0,1],[0,5],[0,18],[HUMAN_GESTURE.downed,1]];
  for(const [code,pose] of cases){
    for(let t=0;t<2*Math.PI;t+=.37){
      const a=values(human(code,pose,t,3.4,t+40)),b=values(human(code,pose,t,3.4,t+40));expect(a).toEqual(b);
      for(const [key,value] of Object.entries(a)){expect(Number.isFinite(value),key).toBe(true);expect(Math.abs(value),`${code}/${pose}/${key}`).toBeLessThan(2.7);}
    }
    // The presentation clock wraps at 2π: integer frequencies only.
    const before=values(human(code,pose,2*Math.PI-1e-6,3.4,50)),after=values(human(code,pose,1e-6,3.4,50));
    for(const key of Object.keys(before) as (keyof HumanOut)[])if(key!=='wiggle')expect(Math.abs(before[key]-after[key]),`${code}/${pose}/${key}`).toBeLessThan(1e-3);
    // The travel clock origin moves by 1024 local ticks (170.67 s): the slow clock keeps its phase.
    const slow=values(human(code,pose,1,3.4,12)),shifted=values(human(code,pose,1,3.4,12+1024/6));
    for(const key of Object.keys(slow) as (keyof HumanOut)[])if(key!=='wiggle')expect(Math.abs(slow[key]-shifted[key]),`${code}/${pose}/${key}`).toBeLessThan(1e-6);
  }
  expect(Math.abs(Math.sin(1024/6*GESTURE_SLOW_RATE))).toBeLessThan(1e-9);
  // Two actors are not in step.
  expect(values(human(0,0,2,1.7)).yaw).not.toBeCloseTo(values(human(0,0,2,3.4)).yaw,3);
  // Walking or crouching people keep their own rig.
  expect(values(human(0,0,2,1.7,2,0,1)).upper).toBe(0);
  expect(values(human(HUMAN_GESTURE.tableGame,3,2,1.7,2,0,1)).upper).toBe(0);
});

test('the downed wiggle accumulates exactly as Core PawnDownedWiggler, across the travel clock origin',()=>{
  // Core: +0.35°/tick for the first 90 ticks of each 300-tick half, + then -.
  const id=17,offset=downedWiggleOffset(id);let angle=0;
  for(let tick=1;tick<=1200;tick++){
    const num=(tick+offset)%600;if(num>=0&&num<90)angle+=.35;if((num+300)%600<90)angle-=.35;
    const at=(tick+offset)%600,mine=gestureValue(downedWiggleAngle(CPU_GESTURE_OPS,n(at)))*180/Math.PI;
    // Core adds during the tick it processes; ours is the value at that tick's start.
    const core=(()=>{let a=0;for(let k=0;k<at;k++){if(k<90)a+=.35;if((k+300)%600<90)a-=.35;}return a;})();
    expect(mine).toBeCloseTo(core,6);
  }
  expect(angle).toBeCloseTo(0,6);
  // The phase written per origin makes (travelTime + phase)·60 the Core tick + offset.
  for(const origin of [0,1024,2048,9216]){const core=origin*10+333,travel=(core/10-origin)/6,phase=downedWigglePhase(id,origin);expect(((travel+phase)*60)%600).toBeCloseTo((core+offset)%600,6);}
});

test('the retained CPU rig samples the same gesture as the GPU formulas',()=>{
  const s=seatedScene(),base={target:{x:10,z:10},phase:'active' as const,elapsed:1};
  try{
    s.pawn.state='recreating';s.pawn.recreation.task={...base,activity:'chess',buildingId:s.chess.id,seatId:s.stool.id};s.streams();
    const g=s.layer.feedbackSource!,cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
    const m=g.getAttribute('aMotion'),time=1.3,travel=9.5;samplePawnRig(cache,0,g,{x:10,y:0,z:10,yaw:0},time,travel);
    const ref=values(human(m.getY(0),m.getZ(0),time,m.getW(0),travel));
    expect(cache.get(0,5,0)).toBeCloseTo(Math.cos(ref.lean),5);expect(cache.get(0,5,3)).toBeCloseTo(Math.sin(ref.yaw),5);
    expect(cache.get(0,8+3,1)).toBeCloseTo(Math.sin(ref.arm3),5);expect(cache.get(0,8,1)).toBeCloseTo(Math.sin(ref.torso+ref.lean),5);
  }finally{s.layer.dispose();}
});

test('the retained sampler shortcuts equal the general formulas for sleepers, bodies and lying animals',()=>{
  for(const pose of [18,19])for(let t=0;t<6.3;t+=.29){const g=values(human(0,pose,t,2.3,t));expect(g.upper).toBe(0);expect(g.arms).toBe(0);expect(g.lean).toBe(0);expect(g.yaw).toBe(0);expect(g.wiggle).toBe(0);expect(restingHumanChest(pose,t,2.3)).toBeCloseTo(g.chest,12);}
  for(const posture of [1,2])for(const carried of [0,1])for(let t=0;t<6.3;t+=.29){
    const fast=restingAnimalGesture(0,posture,9,carried,t,.38)!,g=animalGesture(CPU_GESTURE_OPS,{moving:n(0),eating:n(0),posture:n(posture),seed:n(9),carried:n(carried),t:n(t),travelTime:n(t*2),graze:n(1),peck:n(0),tailAmplitude:n(.38),tailRate:n(7),shake:n(1),ruffle:n(0),look:n(.4)});
    for(const key of Object.keys(fast) as (keyof typeof fast)[])expect(fast[key],`${posture}/${carried}/${key}`).toBeCloseTo(gestureValue(g[key]),12);
  }
  expect(restingAnimalGesture(1,1,9,0,1,.38)).toBeUndefined();expect(restingAnimalGesture(0,0,9,0,1,.38)).toBeUndefined();expect(restingAnimalGesture(0,ANIMAL_POSTURE_DOWNED,9,0,1,.38)).toBeUndefined();
});

test('the allocation-free traced evaluators give exactly the general formulas',()=>{
  for(const code of [0,1,2,3,14,HUMAN_GESTURE.tableGame,HUMAN_GESTURE.television,HUMAN_GESTURE.chat,HUMAN_GESTURE.viewArt,HUMAN_GESTURE.downed,HUMAN_GESTURE.eat])
    for(const pose of [0,1,2,3,5,18])for(const walking of [0,.3,.5,1])for(const cargo of [0,.5,.9])for(let t=.1;t<6.3;t+=.7){
      const ref=values(human(code,pose,t,4.1,t*3+1,cargo,walking)),fast=evaluateHumanGesture(code,pose,walking,cargo,t,4.1,t*3+1);
      for(const key of Object.keys(ref) as (keyof HumanOut)[])expect(fast[key],`${code}/${pose}/${key}`).toBe(ref[key]);
    }
  const profile=animalIdleProfile('labrador-retriever','QuadrupedAnimalWithPawsAndTail','OmnivoreAnimal');
  for(const [moving,eating,posture] of [[0,0,0],[1,0,0],[.3,0,0],[.5,0,0],[.7,0,0],[0,1,0],[0,.3,0],[0,2,0],[0,0,1],[0,0,ANIMAL_POSTURE_DOWNED],[0,0,2],[0,0,.7]] as const)for(const carried of [0,.3,1])for(let t=.1;t<6.3;t+=.7){
    const g=animalGesture(CPU_GESTURE_OPS,{moving:n(moving),eating:n(eating),posture:n(posture),seed:n(5),carried:n(carried),t:n(t),travelTime:n(t*2+3),graze:n(profile.graze),peck:n(profile.peck),tailAmplitude:n(profile.tailAmplitude),tailRate:n(profile.tailRate),shake:n(profile.shake),ruffle:n(profile.ruffle),look:n(profile.look)});
    const fast=evaluateAnimalGesture(moving,eating,posture,5,carried,t,t*2+3,profile);
    for(const key of Object.keys(g) as (keyof typeof g)[])expect(fast[key],`${moving}/${eating}/${posture}/${key}`).toBe(gestureValue(g[key]));
  }
});

test('animals: families from the native body and diet, idle gestures bounded, a downed animal is posed for Core’s wiggle',()=>{
  const facts=(species:string)=>isAnimalSpecies256(species)?animalIdleProfile(species,animalCore256(species).race.body,String(animalCore256(species).race.foodType)):animalIdleProfile(species);
  expect(facts('muffalo')).toMatchObject({family:'quadruped',graze:1,shake:1});expect(facts('labrador-retriever')).toMatchObject({family:'canine',tailRate:7});
  expect(facts('cat').family).toBe('feline');expect(facts('duck')).toMatchObject({family:'bird',peck:1,ruffle:1,shake:0});expect(facts('megaspider').family).toBe('insect');
  expect(facts('cobra').family).toBe('snake');expect(facts('tortoise').family).toBe('turtle');expect(facts('iguana').family).toBe('lizard');expect(facts('monkey').family).toBe('primate');
  expect(facts('husky').graze).toBe(0);
  for(const species of ANIMAL_SPECIES_IDS){const p=facts(species);
    for(const posture of [0,1,ANIMAL_POSTURE_DOWNED,2])for(let t=0;t<6.3;t+=.41){
      const g=animalGesture(CPU_GESTURE_OPS,{moving:n(0),eating:n(0),posture:n(posture),seed:n(11),carried:n(0),t:n(t),travelTime:n(t*3),graze:n(p.graze),peck:n(p.peck),tailAmplitude:n(p.tailAmplitude),tailRate:n(p.tailRate),shake:n(p.shake),ruffle:n(p.ruffle),look:n(p.look)});
      for(const [key,v] of Object.entries(g)){const value=gestureValue(v);expect(Number.isFinite(value)).toBe(true);expect(Math.abs(value),`${species}/${key}`).toBeLessThan(1.2);if(posture===2)expect(value,`${species} dead ${key}`).toBe(0);}
    }}
  // A real downed animal of the camp.
  const world=animalCombatCamp(),animal=world.wildlife!.animals[0]!;animal.state='downed';
  const wild=new WildlifeLayer(),timeline=new MotionTimeline();
  try{timeline.tick=effectiveCore297(world)/10;wild.update(world,timeline,true);
    const g=(wild.mesh.children.find(c=>c.name.startsWith('Wild '+animal.species+' ')) as THREE.Mesh).geometry,state=g.getAttribute('aAnimal');
    expect(state.getZ(0)).toBe(ANIMAL_POSTURE_DOWNED);expect(state.getW(0)).toBeCloseTo(downedWigglePhase(animal.id,Math.floor(timeline.tick/1024)*1024),5);
    // The retained sampler writes the gesture cells it reads.
    const cache=new ActorAnimationCache(new AnimationDetail());cache.ensureCapacity(1);
    sampleAnimalRig(cache,0,g,{x:animal.x,y:0,z:animal.z,yaw:0},1,2,1,[0,1,2,3],facts(animal.species));
    expect(Math.hypot(cache.get(0,6,0),cache.get(0,6,1))).toBeCloseTo(1,6);expect(cache.get(0,6,2)).not.toBe(0);
  }finally{wild.dispose();}
});

test('tails and bird wings are tagged once with a root pivot; model sizes stay within their family budgets',()=>{
  const budget=(species:string)=>{const body=isAnimalSpecies256(species)?String(animalCore256(species).race.body):'legacy';return body==='Bird'||body==='Snake'||body==='TurtleLike'||body.includes('Jowl')?260:body.startsWith('BeetleLike')?300:520;};
  for(const species of ANIMAL_SPECIES_IDS){
    const g=commonAnimalPresentationGeometry(1,species,false)!;
    try{
      const part=g.getAttribute('animalPart'),pivot=g.getAttribute('bindPivot'),position=g.getAttribute('position'),triangles=(g.index?.count??position.count)/3;
      expect(triangles,species).toBeLessThanOrEqual(budget(species));
      const pivots=new Map<number,string>();
      for(let i=0;i<part.count;i++){const mark=part.getW(i);if(mark<-1.5){
        expect(part.getX(i),species+' appendage keeps bone 0').toBe(0);
        const key=`${pivot.getX(i)},${pivot.getY(i)},${pivot.getZ(i)}`;if(pivots.has(mark))expect(pivots.get(mark),species+' one pivot per appendage').toBe(key);else pivots.set(mark,key);
        expect([ANIMAL_APPENDAGE.tail,ANIMAL_APPENDAGE.leftWing,ANIMAL_APPENDAGE.rightWing]).toContain(mark);}}
      const family=isAnimalSpecies256(species)?String(animalCore256(species).race.body):'';
      if(['labrador-retriever','husky','red-fox','cat','horse','muffalo','deer','timber-wolf'].includes(species))expect(pivots.has(ANIMAL_APPENDAGE.tail),species+' tail').toBe(true);
      if(family==='Bird')expect(pivots.has(ANIMAL_APPENDAGE.leftWing)&&pivots.has(ANIMAL_APPENDAGE.rightWing),species+' wings').toBe(true);
    }finally{g.dispose();}
  }
});

test('species coats separate the look-alikes and follow the Core tints, with resident pigments only',()=>{
  const main=(species:string)=>{const g=commonAnimalPresentationGeometry(1,species,false)!,c=g.getAttribute('color'),p=g.getAttribute('position'),area=new Map<string,number>(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),idx=g.index;
    for(let t=0;t<(idx?.count??p.count);t+=3){const i0=idx?idx.getX(t):t,i1=idx?idx.getX(t+1):t+1,i2=idx?idx.getX(t+2):t+2;a.fromBufferAttribute(p,i0);b.fromBufferAttribute(p,i1);d.fromBufferAttribute(p,i2);
      const key=new THREE.Color(c.getX(i0),c.getY(i0),c.getZ(i0)).getHexString();area.set(key,(area.get(key)??0)+b.sub(a).cross(d.sub(a)).length());}
    g.dispose();return new THREE.Color('#'+[...area].sort((x,y)=>y[1]-x[1])[0]![0]);};
  // In sRGB, as the Core tints are given.
  const srgb=(x:THREE.Color)=>{const h=x.getHex();return [h>>16&255,h>>8&255,h&255] as const;};
  const distance=(x:THREE.Color,y:THREE.Color)=>{const a=srgb(x),b=srgb(y);return Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);};
  // Core PawnKindDef body graphic tints.
  for(const [species,tint] of [['megaspider','#9a7d5e'],['alpaca','#b4946d'],['capybara','#6d5431'],['labrador-retriever','#dcc6a0'],['husky','#898585']] as const)expect(distance(main(species),new THREE.Color(tint)),species).toBeLessThan(12);
  expect(distance(main('snow-hare'),new THREE.Color('#b4b4b4'))).toBeLessThan(80);
  for(const [a,b] of [['hare','snow-hare'],['labrador-retriever','husky'],['husky','yorkshire-terrier'],['labrador-retriever','yorkshire-terrier'],['deer','caribou'],['capybara','guinea-pig']] as const)
    expect(distance(main(a),main(b)),`${a}/${b}`).toBeGreaterThan(40);
  for(const rules of Object.values(SPECIES_COATS))for(const rule of rules)expect(GAME_UNUSED_BESTIARY_SOURCE_KEYS as readonly string[]).not.toContain(rule.to);
});

test('frames add no object per actor and never touch the World',()=>{
  const s=seatedScene();
  try{
    s.pawn.state='recreating';s.pawn.recreation.task={target:{x:10,z:10},phase:'active',elapsed:1,activity:'chess',buildingId:s.chess.id,seatId:s.stool.id};
    s.streams();const timeline=new MotionTimeline();timeline.tick=s.world.tick;
    const before=JSON.stringify(s.world),objects=s.layer.group.children.length;
    for(let i=0;i<30;i++){timeline.tick+=.1;s.layer.updateTravel(s.world as World,timeline,1/60,1);s.layer.presentAnimations();}
    expect(JSON.stringify(s.world)).toBe(before);expect(s.layer.group.children.length).toBe(objects);
  }finally{s.layer.dispose();}
});
