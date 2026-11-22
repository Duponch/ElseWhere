import {existsSync,readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {applyCommand,createWorld,stepWorld,advanceWorldCore297} from '../src/sim/engine.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {enableWildlife} from '../src/sim/wildlife.ts';
import {refreshStock,addGroundMaterial} from '../src/sim/materials.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {bedSlotBodyCenter} from '../src/sim/bed-slots.ts';
import {isDoubleBedKind} from '../src/sim/bed-kinds.ts';
import {PawnLayer,bedHeadEnd} from '../src/render/PawnLayer';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import {ARRIVAL_TAIL_END,MELEE_LUNGE,MELEE_HIT_RECOIL,JITTER_DROP_PER_TICK,arrivalTailPhase,arrivalTailTarget} from '../src/render/actor-motion-accents';
import {origamiHumanGeometry,ORIGAMI_HUMAN_BIND} from '../src/render/origami/human-geometry';
import {PAWN_MODEL_SCALE} from '../src/world/scale';
import {WORK_POSE} from '../src/render/work-presentation';
import {fixtureBuilding,deconstructionCamp} from './scenarios/deconstruction.ts';
import type {Pawn,StructureKind,World} from '../src/sim/types.ts';
import type {PresentationSegment} from '../src/sim/travel-timing.ts';

type Attr=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
const humanStreams=(layer:PawnLayer)=>{const g=layer.feedbackSource!;return {from:g.getAttribute('aFrom') as Attr,motion:g.getAttribute('aMotion') as Attr};};

/** Real Engine walk of one drafted colonist, painted at 60 frames per second
 * at x1: each frame commits one Core tick (60 Core ticks per second). */
function walkingColonist(distance:number) {
  const world=deconstructionCamp(1,32),pawn=world.pawns[0]!;
  Object.assign(pawn,{x:10,z:10,hunger:70,rest:80});pawn.schedule.fill('anything');pawn.recreation.level=100;
  for(const key of Object.keys(pawn.priorities) as (keyof Pawn['priorities'])[])pawn.priorities[key]=0;
  if(world.wildlife)world.wildlife.animals=[];
  expect(applyCommand(world,{type:'draft',pawnIds:[pawn.id],enabled:true}).ok).toBe(true);
  const layer=new PawnLayer(),timeline=new MotionTimeline();timeline.tick=effectiveCore297(world)/10;
  layer.update(world,1,true);layer.updateTravel(world,timeline,1/60,1);
  expect(applyCommand(world,{type:'draft-move',pawnIds:[pawn.id],target:{x:10+distance,z:10},queue:false}).ok).toBe(true);
  const edges:PresentationSegment[]=[pawn.motion!];timeline.tracks.set(pawn.id,edges);
  layer.update(world,1,false);layer.updateTravel(world,timeline,1/60,1);
  const frame=()=>{
    const step=advanceWorldCore297(world);timeline.tick=step.core/10;
    const p=world.pawns[0]!;if(p.motion&&p.motion!==edges.at(-1)){edges.push(p.motion);timeline.tracks.set(p.id,edges);}
    layer.update(world,1,false);layer.updateTravel(world,timeline,1/60,1);
    const s=humanStreams(layer);return {x:s.from.getX(0),z:s.from.getZ(0),walking:s.motion.getX(0),pose:s.motion.getZ(0),phase:s.motion.getW(0),arrived:p.path.length===0&&p.x===10+distance&&(!p.motion||timeline.tick>=p.motion.end)};
  };
  return {world,layer,frame};
}

test('a colonist keeps stepping until its drawn body has arrived, then stops feet together',()=>{
  const {layer,frame}=walkingColonist(3);
  try{
    let previous=frame(),arrivedAt=-1,lastWalking=-1,stoppedPhase=NaN,residualAtArrival=0,stoppedX=NaN;
    const rows=[previous];
    for(let n=1;n<300;n++){
      const row=frame();rows.push(row);
      const moved=Math.hypot(row.x-previous.x,row.z-previous.z);
      // No slide: whenever the drawn body visibly moves (more than 2 mm in a
      // frame), the legs walk.
      if(moved>.1*ARRIVAL_TAIL_END)expect(row.walking,`frame ${n}: body moves ${moved.toFixed(4)} with idle legs`).toBeGreaterThan(.5);
      if(row.arrived&&arrivedAt<0){arrivedAt=n;residualAtArrival=Math.abs(13-row.x);}
      if(row.walking>.5)lastWalking=n;
      if(row.walking<.5&&previous.walking>.5){stoppedPhase=previous.phase;stoppedX=row.x;}
      previous=row;
    }
    // The spring (RimWorld PawnTweener 0.09 at x1) leaves the drawn body
    // visibly behind when the confirmed edge ends: the tail really exists.
    expect(arrivedAt).toBeGreaterThan(0);expect(residualAtArrival).toBeGreaterThan(.2);
    expect(lastWalking).toBeGreaterThan(arrivedAt);
    // The body has stopped on its cell, the legs at rest, on a neutral phase.
    const last=rows.at(-1)!;expect(Math.abs(last.x-13)).toBeLessThanOrEqual(ARRIVAL_TAIL_END);expect(last.walking).toBe(0);
    // What is left to cover once the legs have stopped is under 2 cm.
    expect(Math.abs(13-stoppedX)).toBeLessThanOrEqual(ARRIVAL_TAIL_END);
    expect(Math.abs(Math.sin(stoppedPhase))).toBeLessThan(.2);
    // The gait phase never jumps at the edge end.
    for(let n=arrivedAt-2;n<=lastWalking;n++){const a=rows[n]!.phase,b=rows[n+1]!.phase;if(rows[n]!.walking>.5&&rows[n+1]!.walking>.5)expect(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))).toBeLessThan(.9);}
  }finally{layer.dispose();}
});

test('the arrival plan lands on a multiple of pi and covers the residual monotonically',()=>{
  for(const [phase,residual] of [[0,.78],[1.3,.4],[5.9,.05],[3.14,1.2]] as const){
    const rate=2*Math.PI/1.12,target=arrivalTailTarget(phase,residual,rate);
    expect(target).toBeGreaterThanOrEqual(phase);expect(Math.abs(Math.sin(target))).toBeLessThan(1e-9);
    expect(Math.abs(target-(phase+residual*rate))).toBeLessThanOrEqual(Math.PI);
    expect(arrivalTailPhase(phase,residual,target,residual)).toBeCloseTo(phase%(2*Math.PI),9);
    expect(Math.sin(arrivalTailPhase(phase,residual,target,0))).toBeCloseTo(0,9);
  }
});

test('an animal walks its drawn body onto its cell instead of sliding with idle legs',()=>{
  const world=createWorld(91,32,32);world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.structures=[];
  world.resources.push({id:world.nextId++,kind:'berries',x:4,z:4,amount:10,growth:1,growthTick:world.tick});delete world.wildlife;enableWildlife(world,1);const animal=world.wildlife!.animals[0]!;
  const tick=world.tick,edge={from:{x:10,z:10},to:{x:11,z:10},start:tick,end:tick+12};
  Object.assign(animal,{x:11,z:10,state:'moving',motion:edge,path:[]});delete animal.strike;
  const layer=new WildlifeLayer(),timeline=new MotionTimeline();timeline.tick=tick;timeline.tracks.set(animal.id,[edge]);
  try{
    layer.update(world,timeline,true,undefined,undefined,1/60,1);
    const mesh=layer.mesh.children.find(c=>c.name.startsWith(`Wild ${animal.species} `)) as THREE.Mesh;expect(mesh).toBeDefined();
    const g=mesh.geometry,from=g.getAttribute('aFrom'),state=g.getAttribute('aAnimal');
    let previous={x:from.getX(0),moving:state.getX(0)},lastMoving=-1,stoppedPhase=NaN;
    for(let n=1;n<120;n++){
      timeline.tick=tick+n;
      if(timeline.tick>=edge.end&&animal.state==='moving'){animal.state='idle';delete animal.motion;}
      layer.update(world,timeline,false,undefined,undefined,1/60,1);
      const row={x:from.getX(0),moving:state.getX(0)};
      if(Math.abs(row.x-previous.x)>.1*ARRIVAL_TAIL_END)expect(row.moving,`frame ${n}: drawn animal moves with idle legs`).toBeGreaterThan(.5);
      if(row.moving>.5)lastMoving=n;else if(previous.moving>.5&&Number.isNaN(stoppedPhase))stoppedPhase=n;
      previous=row;
    }
    expect(lastMoving).toBeGreaterThan(12);expect(Math.abs(previous.x-11)).toBeLessThanOrEqual(ARRIVAL_TAIL_END);expect(previous.moving).toBe(0);
  }finally{layer.dispose();}
});

/** Independent crown of the lying body: the highest head or hair vertex of
 * the resident human geometry, laid along the bed (z = lieCenter - y). */
let crownMemo:{crown:number;feet:number}|undefined;
function crownExtent():{crown:number;feet:number} {
  if(crownMemo)return crownMemo;
  const g=origamiHumanGeometry(),pos=g.getAttribute('position'),dye=g.getAttribute('dye');let top=0;
  for(let i=0;i<pos.count;i++){const d=dye.getX(i);if(d===2||d>=100&&d<200)top=Math.max(top,pos.getY(i));}
  g.dispose();
  const bind=ORIGAMI_HUMAN_BIND,lieCenter=bind.hipY+.04*(bind.hipY-bind.footY)/.5;
  return crownMemo={crown:(top-lieCenter)*PAWN_MODEL_SCALE,feet:(lieCenter-bind.footY)*PAWN_MODEL_SCALE};
}

const BEDS:StructureKind[]=['sleeping-spot','double-sleeping-spot','bedroll','double-bedroll','bed','double-bed','hospital-bed'];
test.each(BEDS)('a lying colonist keeps the head on the %s at every orientation; only the feet may stick out',kind=>{
  const extent=crownExtent(),layer=new PawnLayer();
  try{for(const orientation of [0,1,2,3] as const)for(const slot of isDoubleBedKind(kind)?[0,1] as const:[0] as const){
    const w=deconstructionCamp(1,32),bed=fixtureBuilding(w,kind,16,16,orientation),p=w.pawns[0]!;
    const center=bedSlotBodyCenter(bed,slot)!,dir={x:Math.sin(orientation*Math.PI/2),z:Math.cos(orientation*Math.PI/2)};
    const head={x:center.x-dir.x*.5,z:center.z-dir.z*.5};
    Object.assign(p,head);p.bedId=bed.id;if(isDoubleBedKind(kind))p.bedSlot=slot;p.motion=null;p.state='sleeping';
    p.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:head};
    {
      layer.update(w,1,true);const to=layer.feedbackSource!.getAttribute('aTo');
      const along=(to.getX(0)-center.x)*dir.x+(to.getZ(0)-center.z)*dir.z,across=(to.getX(0)-center.x)*dir.z-(to.getZ(0)-center.z)*dir.x;
      expect(Math.abs(across)).toBeLessThan(1e-5);
      const crown=along-extent.crown,feet=along+extent.feet;
      // The footprint of the slot spans [-1, +1] along the bed from its body centre.
      expect(crown,`${kind}/${orientation}/${slot}: crown inside the head end`).toBeGreaterThanOrEqual(-.95);
      expect(crown,`${kind}/${orientation}/${slot}: head on the pillow end`).toBeLessThanOrEqual(-.7);
      expect(feet).toBeGreaterThan(crown);expect(feet).toBeLessThan(1.2);
      expect(Math.abs(along-(layer.lieHeadExtent-bedHeadEnd(bed)))).toBeLessThan(1e-5);
    }
  }}finally{layer.dispose();}
});

test('the historical one-cell bed keeps the head in and lets the feet stick out',()=>{
  const extent=crownExtent();
  const w=deconstructionCamp(1,32),bed=fixtureBuilding(w,'bed',16,16,0),p=w.pawns[0]!;Object.assign(bed,{footprint:'legacy-single'});
  Object.assign(p,{x:16,z:16,bedId:bed.id,motion:null,state:'sleeping'});p.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:16,z:16}};
  const layer=new PawnLayer();
  try{layer.update(w,1,true);const along=layer.feedbackSource!.getAttribute('aTo').getZ(0)-16;
    expect(along-extent.crown).toBeGreaterThanOrEqual(-.5);expect(along+extent.feet).toBeGreaterThan(.5);}
  finally{layer.dispose();}
});

/** The kitchen of lot 350: a stove with a bill and, optionally, a stool on
 * its interaction cell (10,15). Real Engine ticks bring the cook to work. */
function kitchen(stool:boolean):{w:World;cook:Pawn} {
  const w=createWorld(350,40,40);
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
  w.pawns=w.pawns.slice(0,1);const cook=w.pawns[0]!;Object.assign(cook,{hunger:100,rest:100,x:10,z:10});delete cook.background;delete cook.traits;
  for(const key of Object.keys(cook.priorities) as (keyof Pawn['priorities'])[])cook.priorities[key]=0;
  cook.priorities.cook=1;cook.skills.cooking={level:10,xp:0,dailyXp:0,passion:0};
  const station={id:w.nextId++,kind:'fueled-stove' as const,x:10,z:16,orientation:0 as const,footprint:'standard' as const,material:'steel' as const,bills:[],fuel:newBuildingFuel('fueled-stove')};
  station.fuel.ticks=12000;w.structures.push(station);addGroundMaterial(w,'food',70,{x:12,z:18},'rice');
  if(stool)fixtureBuilding(w,'stool',10,15);
  for(const x of [14,15])expect(applyCommand(w,{type:'stockpile',enabled:true,x,z:10,filters:{wood:false,food:true}}).ok).toBe(true);
  expect(applyCommand(w,{type:'bill-add',structureId:station.id,recipe:'simple-meal'}).ok).toBe(true);
  refreshStock(w);
  for(let i=0;i<400&&cook.cooking?.phase!=='work';i++)stepWorld(w);
  expect(cook.cooking?.phase).toBe('work');expect([cook.x,cook.z]).toEqual([10,15]);
  return {w,cook};
}

test('a cook working a bill sits on the stool of the interaction cell, and stands without one',()=>{
  for(const stool of [true,false]){
    const {w}=kitchen(stool),layer=new PawnLayer();
    try{
      layer.update(w,1,true);const g=layer.feedbackSource!,to=g.getAttribute('aTo'),motion=g.getAttribute('aMotion');
      if(stool){expect(motion.getZ(0)).toBe(3);expect(to.getX(0)).toBe(10);expect(to.getZ(0)).toBe(15);expect(to.getY(0)).toBe(0);}
      else{expect(motion.getZ(0)).not.toBe(3);expect([WORK_POSE.craft,WORK_POSE.build,0]).toContain(motion.getZ(0));}
      // The same choice holds in the per-frame path.
      const timeline=new MotionTimeline();timeline.tick=w.tick;layer.updateTravel(w,timeline,1/60,1);
      expect(motion.getZ(0)===3).toBe(stool);
    }finally{layer.dispose();}
  }
});

function duel(outcome:'hit'|'miss') {
  const w=deconstructionCamp(2,32),[a,b]=w.pawns as [Pawn,Pawn];
  Object.assign(a,{x:10,z:10,motion:null,path:[],state:'idle'});Object.assign(b,{x:11,z:10,motion:null,path:[],state:'idle'});
  a.melee={order:{targetId:b.id,startedDowned:false},strike:{targetId:b.id,atCore:w.tick*10,untilCore:w.tick*10+450,tool:'left-fist',outcome}};
  return {w,a,b};
}
function drawn(layer:PawnLayer,w:World,tick:number,speed=1):{ax:number;az:number;bx:number;bz:number} {
  const timeline=new MotionTimeline();timeline.tick=tick;layer.updateTravel(w,timeline,1/60,speed);
  const from=layer.feedbackSource!.getAttribute('aFrom');return {ax:from.getX(0),az:from.getZ(0),bx:from.getX(1),bz:from.getZ(1)};
}

test('a melee blow lunges the attacker toward the target and pushes the hit victim, returning at 0.018 cell per tick',()=>{
  const {w}=duel('hit'),layer=new PawnLayer(),t0=w.tick;
  try{
    layer.update(w,1,true);
    // MotionTimeline ticks are macro ticks of ten Core (RimWorld game) ticks.
    const rest=drawn(layer,w,t0+40),hit=drawn(layer,w,t0),mid=drawn(layer,w,t0+.5),half=drawn(layer,w,t0+1),back=drawn(layer,w,t0+40);
    expect(mid.ax-rest.ax).toBeCloseTo(MELEE_LUNGE-5*JITTER_DROP_PER_TICK,4);expect(mid.bx-rest.bx).toBeCloseTo(MELEE_HIT_RECOIL-5*JITTER_DROP_PER_TICK,4);
    expect(hit.ax-rest.ax).toBeCloseTo(MELEE_LUNGE,4);expect(Math.abs(hit.az-rest.az)).toBeLessThan(1e-4);
    expect(half.ax-rest.ax).toBeCloseTo(MELEE_LUNGE-10*JITTER_DROP_PER_TICK,4);
    expect(hit.bx-rest.bx).toBeCloseTo(MELEE_HIT_RECOIL,4);expect(half.bx-rest.bx).toBeCloseTo(0,4);
    expect(back).toEqual(rest);
    // Paused: the jolt holds; x6: the spring snaps but the jolt still shows.
    expect(drawn(layer,w,t0+5,0).ax).toBe(drawn(layer,w,t0+5,0).ax);
    expect(drawn(layer,w,t0,6).ax-rest.ax).toBeCloseTo(MELEE_LUNGE,4);
  }finally{layer.dispose();}
  // A miss lunges the attacker but never pushes the target.
  const miss=duel('miss'),other=new PawnLayer();
  try{other.update(miss.w,1,true);const rest=drawn(other,miss.w,miss.w.tick+40),blow=drawn(other,miss.w,miss.w.tick);
    expect(blow.ax-rest.ax).toBeCloseTo(MELEE_LUNGE,4);expect(blow.bx).toBe(rest.bx);}
  finally{other.dispose();}
});

test('an animal bite lunges the animal and pushes the colonist it hits',()=>{
  const w=deconstructionCamp(1,32),p=w.pawns[0]!;Object.assign(p,{x:11,z:10,motion:null,path:[],state:'idle'});
  w.resources.push({id:w.nextId++,kind:'berries',x:4,z:4,amount:10,growth:1,growthTick:w.tick});delete w.wildlife;enableWildlife(w,1);const animal=w.wildlife!.animals[0]!;
  Object.assign(animal,{x:10,z:10,state:'idle',motion:null,path:[]});
  animal.strike={targetId:p.id,atCore:w.tick*10,untilCore:w.tick*10+450,tool:'teeth',outcome:'hit'};
  const wild=new WildlifeLayer(),pawns=new PawnLayer(),t0=w.tick;
  try{
    const animalX=(tick:number)=>{const timeline=new MotionTimeline();timeline.tick=tick;wild.update(w,timeline,false,undefined,undefined,1/60,1);
      const mesh=wild.mesh.children.find(c=>c.name.startsWith(`Wild ${animal.species} `)) as THREE.Mesh;return mesh.geometry.getAttribute('aFrom').getX(0);};
    const tl=new MotionTimeline();tl.tick=t0+40;wild.update(w,tl,true,undefined,undefined,1/60,1);
    const rest=animalX(t0+40),bite=animalX(t0),settled=animalX(t0+40);
    expect(bite-rest).toBeCloseTo(MELEE_LUNGE,4);expect(settled).toBe(rest);
    pawns.update(w,1,true);const colonist=(tick:number)=>{const timeline=new MotionTimeline();timeline.tick=tick;pawns.updateTravel(w,timeline,1/60,1);return pawns.feedbackSource!.getAttribute('aFrom').getX(0);};
    const still=colonist(t0+40),pushed=colonist(t0);expect(pushed-still).toBeCloseTo(MELEE_HIT_RECOIL,4);
  }finally{wild.dispose();pawns.dispose();}
});

test('the comic brawl cloud is gone from the renderer',()=>{
  expect(existsSync(new URL('../src/render/BrawlCloudLayer.ts',import.meta.url))).toBe(false);
  const scene=readFileSync(new URL('../src/render/SceneRenderCore.ts',import.meta.url),'utf8');
  expect(scene).not.toMatch(/brawl/i);
});
