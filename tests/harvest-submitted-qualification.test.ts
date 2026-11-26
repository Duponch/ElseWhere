import {expect,test} from 'vitest';
import {qualifySubmittedHarvestPhase} from '../scripts/harvest-submitted-qualification';

function phase(){return {starvedFrames:0,controls:Array.from({length:3},()=>({delay:10,submittedDelay:10})),errors:[],initialJobs:2,remainingJobs:1,removals:[{tick:1,play:1}],solidOccupancyCount:0,
 submissionDiagnostics:{actualSubmissionCount:4,submittedFrameCount:4,unpairedSubmissions:0,multipleSubmissionFrames:[] as unknown[],stalls:[] as unknown[],starvation:[] as unknown[],jumpCount:0,jumps:[] as unknown[],rawJumpCount:0,continuousTravelExcessCount:0,solidOccupancyCount:0,solidOccupancy:[] as unknown[],solidOccupancySamples:[] as unknown[],activeRockOccupancyCount:0}};}

test('submitted qualification is independent of historical CPU-only jump counts and includes the exact 100ms speed bound',()=>{
 const good={...phase(),jumpCount:17};good.controls[0]!.submittedDelay=100;
 expect(qualifySubmittedHarvestPhase(good)).toEqual({qualified:true,failures:[],provedContactDepartures:0});
 good.controls[0]!.submittedDelay=100.0001;expect(qualifySubmittedHarvestPhase(good).qualified).toBe(false);
});

test('missing submissions, unpaired/multiple frames, hidden stalls and incomplete counts cannot qualify',()=>{
 const mutations:((p:ReturnType<typeof phase>)=>void)[]=[
  p=>{p.submissionDiagnostics.actualSubmissionCount=0;},p=>{p.submissionDiagnostics.submittedFrameCount++;},
  p=>{p.submissionDiagnostics.unpairedSubmissions=1;},p=>{p.submissionDiagnostics.multipleSubmissionFrames.push({});},
  p=>{p.submissionDiagnostics.stalls.push({});},p=>{p.submissionDiagnostics.starvation.push({});},p=>{p.starvedFrames=1;},
  p=>{Reflect.deleteProperty(p.controls[0]!,'submittedDelay');},p=>{p.controls=[];},
  p=>{p.submissionDiagnostics.rawJumpCount=1;},p=>{p.submissionDiagnostics.jumpCount=1;},
  p=>{Reflect.deleteProperty(p.submissionDiagnostics,'solidOccupancySamples');},
  p=>{p.removals=[{tick:2,play:1}];},
 ];
 for(const mutate of mutations){const bad=phase();mutate(bad);expect(qualifySubmittedHarvestPhase(bad).qualified).toBe(false);}
 expect(qualifySubmittedHarvestPhase({})).toMatchObject({qualified:false});
});

function contactJump(){
 const previous={position:{x:.2,z:.2},shown:{x:.2,z:.2},from:{x:.2,z:.2},to:{x:0,z:0},start:10,end:10.24,time:10,play:60,
  segment:{from:{x:0,z:-1},to:{x:0,z:0},start:58,end:59},live:true,submitted:true,submissionSerial:10,speed:6};
 const start=60.4/6,fraction=(start-10)/.24,from={x:.2*(1-fraction),z:.2*(1-fraction)},alpha=(10.24-start)/.25;
 const position={x:from.x+(1-from.x)*alpha,z:from.z*(1-alpha)};
 const current={position,shown:{...position},from,to:{x:1,z:0},start,end:start+.25,time:10.24,play:61.44,
  segment:{from:{x:0,z:0},to:{x:1,z:0},start:60.4,end:61.9},live:true,submitted:true,submissionSerial:11,speed:6};
 return {dt:40,from:[previous.shown.x,previous.shown.z],to:[current.shown.x,current.shown.z],previousWitness:previous,currentWitness:current,contactDepartureProven:false};
}
function withJump(jump:ReturnType<typeof contactJump>){const p=phase();p.submissionDiagnostics.jumpCount=1;p.submissionDiagnostics.rawJumpCount=1;p.submissionDiagnostics.jumps=[jump];return p;}

test('an exact contact handoff is re-proved with PawnTweener, without trusting its diagnostic boolean',()=>{
 expect(qualifySubmittedHarvestPhase(withJump(contactJump()))).toEqual({qualified:true,failures:[],provedContactDepartures:1});
 const forged=contactJump();forged.contactDepartureProven=true;forged.currentWitness.from.x+=.01;
 expect(qualifySubmittedHarvestPhase(withJump(forged)).qualified).toBe(false);
 const drawnWarp=contactJump();drawnWarp.currentWitness.shown.x+=.1;drawnWarp.to[0]=drawnWarp.currentWitness.shown.x;
 expect(qualifySubmittedHarvestPhase(withJump(drawnWarp)).qualified).toBe(false);
 const unsubmitted=contactJump();unsubmitted.previousWitness.submitted=false;expect(qualifySubmittedHarvestPhase(withJump(unsubmitted)).qualified).toBe(false);
 const backwards=contactJump();backwards.currentWitness.submissionSerial=10;expect(qualifySubmittedHarvestPhase(withJump(backwards)).qualified).toBe(false);
});

function rockSample(){return {submitted:true,submissionSerial:11,cell:0,x:0,z:0,play:60,travelTime:10,rockTilesMatchWorld:true,
 rock:{cell:0,inventoryComplete:true,terrain:'rock',mask:1,canonicalActiveIndices:3,vertexFirst:24,vertexSpan:46,activeSubmittedCellIndices:0,
  direct:[{visible:false,layers:1,activeCellIndices:0,indexVersion:1,drawRange:{start:0,count:0}}],compiled:[]}};}
function withRock(sample:ReturnType<typeof rockSample>){const p=phase();p.solidOccupancyCount=1;p.submissionDiagnostics.solidOccupancyCount=1;p.submissionDiagnostics.solidOccupancy=[sample];p.submissionDiagnostics.solidOccupancySamples=[sample];return p;}

test('solid CPU candidates need complete geometry evidence, and actual submitted triangles always refuse',()=>{
 expect(qualifySubmittedHarvestPhase(withRock(rockSample())).qualified).toBe(true);
 const skipped=rockSample();skipped.submitted=false;const skippedPhase=withRock(skipped);skippedPhase.submissionDiagnostics.solidOccupancyCount=0;skippedPhase.submissionDiagnostics.solidOccupancy=[];
 expect(qualifySubmittedHarvestPhase(skippedPhase).qualified).toBe(true);
 const occupied=rockSample();occupied.rock.activeSubmittedCellIndices=3;occupied.rock.direct[0]!.visible=true;occupied.rock.direct[0]!.activeCellIndices=3;occupied.rock.direct[0]!.drawRange.count=3;
 const actual=withRock(occupied);actual.submissionDiagnostics.activeRockOccupancyCount=1;
 expect(qualifySubmittedHarvestPhase(actual).failures).toContain('Submitted actor overlaps active rock geometry');
 const mutations:((s:ReturnType<typeof rockSample>)=>void)[]=[s=>{Reflect.deleteProperty(s,'rock');},s=>{s.rock.inventoryComplete=false;},s=>{s.rock.activeSubmittedCellIndices=3;},s=>{s.rockTilesMatchWorld=false;},s=>{s.rock.cell=1;},s=>{s.travelTime+=.1;}];
 for(const mutate of mutations){
  const missing=rockSample();mutate(missing);expect(qualifySubmittedHarvestPhase(withRock(missing)).qualified).toBe(false);
 }
 const truncated=withRock(rockSample());truncated.solidOccupancyCount=2;expect(qualifySubmittedHarvestPhase(truncated).qualified).toBe(false);
});
