// Measurement tool (not product code). Frame CPU of the human and animal actor
// layers on Les Forges (80 colonists, 241 animals), on the same path as the
// client's frame: PawnLayer.updateTravel, WildlifeLayer.update and both
// presentAnimations, plus the per-publication PawnLayer.update; when the
// historical BrawlCloudLayer file exists it is driven as SceneRenderCore did
// (update per publication, present per frame), so a before/after comparison
// includes its removal. Each frame commits one real Core tick (x1 at 60 Hz);
// the simulation step itself is not timed.
// Usage: npx tsx scripts/actor-accents-bench.ts [frames=1200] [rounds=5]
import {readFileSync,existsSync} from 'node:fs';
import {deserializeWorld} from '../src/sim/serialization';
import {advanceWorldCore297} from '../src/sim/engine';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {PawnLayer} from '../src/render/PawnLayer';
import {WildlifeLayer} from '../src/render/WildlifeLayer';
import {MotionTimeline} from '../src/render/MotionTimeline';
import type {TravelSegment} from '../src/render/MotionTimeline';

const frames=Number(process.argv[2]??1200),rounds=Number(process.argv[3]??5);
const world=deserializeWorld(readFileSync('public/test-saves/v432/les-forges-crash-test.json','utf8'));
type Brawl={update(world:unknown,source:unknown):void;present(tick:number):void;dispose():void};
const brawlPath=new URL('../src/render/BrawlCloudLayer.ts',import.meta.url);
const BrawlCloud=existsSync(brawlPath)?(await import(brawlPath.href) as {BrawlCloudLayer:new(clock:unknown,detail?:unknown)=>Brawl}).BrawlCloudLayer:undefined;
const pawns=new PawnLayer(),wild=new WildlifeLayer(),timeline=new MotionTimeline();
const brawl=BrawlCloud?new BrawlCloud(pawns):undefined;
const tracks=timeline.tracks as Map<number,TravelSegment[]>;
const record=()=>{for(const actor of [...world.pawns,...world.wildlife?.animals??[]]){const edge=actor.motion as TravelSegment|null|undefined;if(!edge)continue;const list=tracks.get(actor.id);if(!list)tracks.set(actor.id,[edge]);else if(list.at(-1)!==edge){list.push(edge);if(list.length>8)list.shift();}}};
timeline.tick=effectiveCore297(world)/10;record();
pawns.update(world,1,true);wild.update(world,timeline,true,pawns,undefined,1/60,1);brawl?.update(world,pawns.feedbackSource);
const frame=():{frame:number;adoption:number}=>{
  const step=advanceWorldCore297(world);timeline.tick=step.core/10;record();
  let adoption=0;
  if(step.core%10===0){const t=performance.now();pawns.update(world,1,false);brawl?.update(world,pawns.feedbackSource);adoption=performance.now()-t;}
  const t=performance.now();
  pawns.updateTravel(world,timeline,1/60,1);wild.update(world,timeline,false,pawns,undefined,1/60,1);
  pawns.presentAnimations();wild.presentAnimations(pawns);brawl?.present(timeline.tick);
  return {frame:performance.now()-t,adoption};
};
for(let i=0;i<120;i++)frame();
const results:{frameMean:number;frameP95:number;adoptionMean:number}[]=[];
for(let round=0;round<rounds;round++){
  const rows=Array.from({length:frames},frame),f=rows.map(r=>r.frame).sort((a,b)=>a-b),a=rows.filter(r=>r.adoption>0).map(r=>r.adoption);
  results.push({frameMean:f.reduce((s,v)=>s+v,0)/f.length,frameP95:f[Math.floor(.95*f.length)]!,adoptionMean:a.reduce((s,v)=>s+v,0)/Math.max(1,a.length)});
}
const median=(values:number[])=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)]!;
console.log(JSON.stringify({brawlCloud:!!BrawlCloud,humans:world.pawns.length,animals:world.wildlife?.animals.length??0,frames,rounds,
  frameMeanMs:median(results.map(r=>r.frameMean)),frameP95Ms:median(results.map(r=>r.frameP95)),adoptionMeanMs:median(results.map(r=>r.adoptionMean)),rounds_detail:results}));
pawns.dispose();wild.dispose();brawl?.dispose();
