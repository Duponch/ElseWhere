import {confirmedTravelExcess,tweenedRootStep,type TravelFrameWitness} from './harvest-assertions.ts';
import {confirmedContactDepartureDiagnostic} from './harvest-contact-departure.ts';

type Data=Record<string,unknown>;
type DrawnWitness=TravelFrameWitness&{shown:{x:number;z:number};live:boolean;submitted:boolean;submissionSerial:number;speed:number};
const record=(v:unknown):v is Data=>!!v&&typeof v==='object'&&!Array.isArray(v);
const count=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const point=(v:unknown):v is {x:number;z:number}=>record(v)&&finite(v.x)&&finite(v.z);
function drawnWitness(v:unknown):v is DrawnWitness {
 if(!record(v)||!point(v.position)||!point(v.shown)||!point(v.from)||!point(v.to)||v.live!==true||v.submitted!==true||!count(v.submissionSerial)||v.submissionSerial===0||!finite(v.speed)||v.speed<0)return false;
 const edge=v.segment;
 return ['start','end','time','play'].every(k=>finite(v[k]))&&record(edge)&&point(edge.from)&&point(edge.to)&&finite(edge.start)&&finite(edge.end);
}
function rockIndices(v:unknown):number|undefined {
 if(!record(v)||v.inventoryComplete!==true||!count(v.activeSubmittedCellIndices)||!count(v.canonicalActiveIndices)||v.canonicalActiveIndices%3!==0||!count(v.vertexFirst)||!count(v.vertexSpan)||v.vertexSpan===0||!Array.isArray(v.direct)||v.direct.length===0||!Array.isArray(v.compiled))return;
 let total=0;
 for(const mesh of v.direct){
  if(!record(mesh)||typeof mesh.visible!=='boolean'||!count(mesh.layers)||!count(mesh.activeCellIndices)||mesh.activeCellIndices%3!==0||!count(mesh.indexVersion)||!record(mesh.drawRange)||!count(mesh.drawRange.start)||!finite(mesh.drawRange.count)||mesh.drawRange.count<0)return;
  if((!mesh.visible||mesh.layers===0)&&mesh.activeCellIndices!==0)return;
  total+=mesh.activeCellIndices;
 }
 for(const mesh of v.compiled){if(!record(mesh)||!count(mesh.activeCellIndices)||mesh.activeCellIndices%3!==0||!count(mesh.sourceCellIndices)||!count(mesh.indexVersion))return;total+=mesh.activeCellIndices;}
 return total===v.activeSubmittedCellIndices?total:undefined;
}

/** Submitted-frame qualification, keeping RAF reports and the historical
 * assertHarvestPhase unchanged. Every
 * relaxed-looking diagnostic classification is re-proved from its inputs;
 * missing or incomplete evidence always refuses qualification. */
export function qualifySubmittedHarvestPhase(value:unknown,switches=true):{qualified:boolean;failures:string[];provedContactDepartures:number} {
 const failures:string[]=[];let provedContactDepartures=0;
 const fail=(reason:string)=>failures.push(reason);
 if(!record(value)||!record(value.submissionDiagnostics))return {qualified:false,failures:['Missing submission diagnostics'],provedContactDepartures};
 const phase=value,d=phase.submissionDiagnostics as Data;
 if(!count(d.actualSubmissionCount)||d.actualSubmissionCount===0||d.actualSubmissionCount!==d.submittedFrameCount)fail('Submission/frame count mismatch');
 if(d.unpairedSubmissions!==0||!Array.isArray(d.multipleSubmissionFrames)||d.multipleSubmissionFrames.length)fail('Unpaired or multiple submissions');
 if(!Array.isArray(d.stalls)||d.stalls.length||!Array.isArray(d.starvation)||d.starvation.length||phase.starvedFrames!==0)fail('Submission starvation');
 if(!Array.isArray(phase.controls)||switches&&phase.controls.length<3)fail('Missing submitted speed controls');
 else for(const control of phase.controls)if(!record(control)||!finite(control.submittedDelay)||control.submittedDelay<0||control.submittedDelay>100)fail('Delayed submitted speed control');
 if(!count(d.jumpCount)||!Array.isArray(d.jumps)||d.jumpCount!==d.jumps.length||!count(d.rawJumpCount)||!count(d.continuousTravelExcessCount)||d.rawJumpCount!==d.jumpCount+d.continuousTravelExcessCount)fail('Incomplete submitted jump evidence');
 else for(const jump of d.jumps){
  if(!record(jump)||!finite(jump.dt)||jump.dt<=0||jump.dt>=100||!drawnWitness(jump.previousWitness)||!drawnWitness(jump.currentWitness)){fail('Missing submitted jump witness');continue;}
  const p=jump.previousWitness,c=jump.currentWitness,dt=jump.dt;
  if(p.submissionSerial>=c.submissionSerial||!Array.isArray(jump.from)||!Array.isArray(jump.to)||jump.from.length!==2||jump.to.length!==2||jump.from[0]!==p.shown.x||jump.from[1]!==p.shown.z||jump.to[0]!==c.shown.x||jump.to[1]!==c.shown.z){fail('Inconsistent submitted jump witness');continue;}
  const rootDistance=Math.hypot(c.position.x-p.position.x,c.position.z-p.position.z);
  const ordinary=rootDistance<=dt*.013+.02||confirmedTravelExcess(p,c,dt),contact=confirmedContactDepartureDiagnostic(p,c,dt);
  if(!(ordinary||contact)||!tweenedRootStep(p.shown,c.shown,c.position,dt,c.speed))fail('Discontinuous submitted actor');
  else if(!ordinary&&contact)provedContactDepartures++;
 }
 if(!count(phase.solidOccupancyCount)||!Array.isArray(d.solidOccupancySamples)||phase.solidOccupancyCount!==d.solidOccupancySamples.length||!count(d.solidOccupancyCount)||!Array.isArray(d.solidOccupancy)||d.solidOccupancyCount!==d.solidOccupancy.length||!count(d.activeRockOccupancyCount))fail('Incomplete rock occupancy evidence');
 else {
  let submitted=0,active=0;
  for(const sample of d.solidOccupancySamples){
   if(!record(sample)||typeof sample.submitted!=='boolean'||!count(sample.submissionSerial)||sample.submissionSerial===0||!record(sample.rock)){fail('Missing rock submission witness');continue;}
   if(!sample.submitted)continue;
   submitted++;
   const indices=rockIndices(sample.rock);
   if(indices===undefined||!count(sample.cell)||sample.cell!==sample.rock.cell||sample.rockTilesMatchWorld!==true||sample.rock.terrain!=='rock'||!count(sample.rock.mask)||sample.rock.mask===0||sample.rock.canonicalActiveIndices===0||!finite(sample.x)||!finite(sample.z)||!finite(sample.play)||!finite(sample.travelTime)||Math.abs(sample.travelTime-sample.play/6)>.0001){fail('Inconsistent submitted rock witness');continue;}
   if(indices>0){active++;fail('Submitted actor overlaps active rock geometry');}
  }
  if(submitted!==d.solidOccupancyCount||active!==d.activeRockOccupancyCount)fail('Rock occupancy count mismatch');
 }
 if(!Array.isArray(phase.errors)||phase.errors.length||!finite(phase.initialJobs)||!finite(phase.remainingJobs)||phase.remainingJobs>=phase.initialJobs||!Array.isArray(phase.removals)||phase.removals.length===0||phase.removals.some(row=>!record(row)||!finite(row.play)||!finite(row.tick)||row.play<row.tick))fail('Harvest action regression');
 return {qualified:failures.length===0,failures,provedContactDepartures};
}
