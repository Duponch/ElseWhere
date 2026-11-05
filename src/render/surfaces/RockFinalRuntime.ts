/** PRIVATE concrete planner/baker bridge. No renderer or Source override and
 * no allocation occurs before the final baker's complete memory permit. */
import type * as THREE from 'three/webgpu';
import {scalarInkCompactionDevice} from './InkOccupancyPacking';
import {planRockFinalAtlas,RockFinalPlanRefusal,type RockFinalPlan,type RockFinalPlanInput} from './RockFinalPlan';
import {allocateRockFinalGpuBank,bakeRockFinalGpuPages,copyRockFinalGpuPages,planRockFinalGpu,RockFinalGpuAdmissionRefusal,drainRockFinalGpuQuarantine} from '../origami/baked/rocks/RockFinalGpu';
import type {RockFinalBakeInput,RockFinalBudgetDeclarations,RockFinalGpuBank as NativeBank,RockFinalGpuBudget,RockFinalLayout} from '../origami/baked/rocks/RockFinalTypes';
import type {RockFinalOwnerOptions} from './RockFinalOwner';
import type {SharedSurfacePreparationSnapshot} from './SharedSurfacePreparation';
import {RockFinalAdmissionRefusal,type RockFinalGpuBank,type RockFinalInput,type RockFinalRuntimePlan} from './RockFinalRuntimeTypes';
export interface RockFinalRuntimeConfiguration {
 readonly declarations:(input:RockFinalInput,oldAtlasGpuBytes:number,oldAtlasCpuBytes:number)=>RockFinalBudgetDeclarations;
 readonly size:1024|2048;readonly density:number;readonly maxCellPixels:number;readonly returnCellPixels:number;
}
interface RuntimeOptions extends RockFinalRuntimeConfiguration {readonly stonePaint:THREE.Texture;readonly lookupStageUpperBytes:(faceSpan:number)=>{readonly retainedGpuBytes:number;readonly newCpuBytes:number;readonly lookupBytes:number}}
type Flat=RockFinalPlanInput&RockFinalBakeInput;
type Record={readonly flat:Flat;readonly layout:RockFinalLayout;readonly original:RockFinalPlan;readonly permit:RockFinalGpuBudget;readonly oldCpu:number};
const flatten=(input:RockFinalInput):Flat=>({...input.arrays,panels:input.panels,faceSpan:input.faceSpan,width:input.width,height:input.height,cpuBytes:input.cpuBytes,revision:input.revision,assertCurrent:input.assertCurrent});
export function createRockFinalRuntimeOptions(options:RuntimeOptions):Omit<RockFinalOwnerOptions,'host'> {
 const records=new WeakMap<RockFinalRuntimePlan,Record>(),banks=new Map<RockFinalGpuBank,NativeBank>();let allocationSerial=0;
 const ownedGpu=()=>[...banks.values()].reduce((n,b)=>n+b.gpuBytes,0);
 const actual=(bank:RockFinalGpuBank)=>{const v=banks.get(bank);if(!v)throw Error('Rock runtime bank is foreign or retired');return v;};
 const record=(plan:RockFinalRuntimePlan)=>{const value=records.get(plan);if(!value)throw Error('Rock runtime plan is foreign or retired');return value;};
 const declarations=(input:RockFinalInput,oldGpu:number,oldCpu:number)=>{
  // Core alone inventories quarantined scratch as global peak/CPU debt.
  // This owner contributes only its actual retained A/B and lookup resources.
  const b=options.declarations(input,oldGpu,oldCpu),lookup=options.lookupStageUpperBytes(input.faceSpan);
  // Actual owned banks and HWM lookup bounds are authoritative in this owner.
  // All Source/other-family costs remain supplied by the real Core ledger.
  return{...b,oldAtlasGpuBytes:Math.max(b.oldAtlasGpuBytes??oldGpu,oldGpu),oldAtlasCpuBytes:Math.max(b.oldAtlasCpuBytes??oldCpu,oldCpu),newLookupGpuBytes:Math.max(b.newLookupGpuBytes??lookup.retainedGpuBytes,lookup.retainedGpuBytes),newLookupCpuBytes:Math.max(b.newLookupCpuBytes??lookup.newCpuBytes,lookup.newCpuBytes)};
 };
 const admission=<T>(work:()=>T):T=>{try{return work();}catch(error){if(error instanceof RockFinalPlanRefusal||error instanceof RockFinalGpuAdmissionRefusal)throw new RockFinalAdmissionRefusal(error.message,{cause:error});throw error;}};
 return{
  maxCellPixels:options.maxCellPixels,returnCellPixels:options.returnCellPixels,
  plan:(input,_snapshot,previous,oldGpu,oldCpu,newBankCopies)=>admission(()=>{
   // Owner states the exact allocation demand. A previous layout does not
   // imply that a spare bank already exists; cold preparation allocates one.
   if(newBankCopies!==0&&newBankCopies!==1)throw new RockFinalAdmissionRefusal('Explicit zero or one new Rock bank required BEFORE GPU allocation');
   const flat=flatten(input),b=declarations(input,Math.max(oldGpu,ownedGpu()),oldCpu),before=previous?record(previous):undefined;
   // This first pure pass computes exact chart demand. Unknown scratch remains
   // null; it grants NO admission. The complete GPU inspector below supplies
   // the real scratch, affine, paint, old/new and retained permit.
   const original=planRockFinalAtlas(flat,{size:options.size,density:options.density,maxCellPixels:options.maxCellPixels,returnCellPixels:options.returnCellPixels},{sourceScope:b.sourceScope,sourceCpuBytes:b.sourceCpuBytes,sourceGpuBytes:b.sourceGpuBytes,otherLiveGpuBytes:b.otherLiveGpuBytes,scratchCpuBytes:null,scratchGpuBytes:null,oldAtlasCpuBytes:b.oldAtlasCpuBytes,oldAtlasGpuBytes:b.oldAtlasGpuBytes},before?.original);
   const key=previous?.key??`rock-final-array:${options.size}:${original.layers}:${++allocationSerial}`,layout:RockFinalLayout={key,size:original.size,levels:4,layers:original.layers,charts:original.charts,lookup:original.lookup,assertCurrent:original.assertCurrent};
   const permit=planRockFinalGpu(flat,layout,b,newBankCopies);
   const plan:RockFinalRuntimePlan={key,admitted:true,size:original.size,levels:4,layers:original.layers,density:original.density,charts:original.charts.map(c=>({...c,side:c.side??-1})),lookup:original.lookup,gpuBytes:original.gpuBytes,cpuBytes:original.cpuBytes,retainedGpuBytes:permit.familyLiveGpuBytes,peakGpuBytes:permit.globalPeakGpuBytes,maxCellPixels:options.maxCellPixels,returnCellPixels:options.returnCellPixels,permit,assertCurrent:original.assertCurrent};
   records.set(plan,{flat,layout,original,permit,oldCpu});return plan;
  }),
  gpu:{
   allocate:async(snapshot,_input,plan,check)=>admission(()=>{const r=record(plan),native=allocateRockFinalGpuBank(snapshot.renderer,r.layout,r.permit,check);let closed=false;const bank:RockFinalGpuBank={texture:native.texture,gpuBytes:native.gpuBytes,cpuBytes:native.layers*4*64,assertCurrent(){if(closed)throw Error('Rock bank retired');native.assertCurrent();},dispose(){if(closed)return;native.dispose();banks.delete(bank);closed=true;}};banks.set(bank,native);return bank;}),
   copyPages:(snapshot,from,to,pages,check)=>copyRockFinalGpuPages(snapshot.renderer,actual(from),actual(to),pages,check),
   bakePages:async(snapshot,input,plan,bank,pages,check)=>{
    const r=record(plan),lease=snapshot.paintSource;if(!lease)throw Error('Held Rock bake requires the actual current paint lease');
    const b=declarations(input,ownedGpu(),r.oldCpu);try{await bakeRockFinalGpuPages(snapshot.renderer,r.flat,r.layout,{width:snapshot.preferences.edgeWidth,irregularity:snapshot.preferences.strokeImperfection},options.stonePaint,lease,b,actual(bank),{pageIds:pages},check);}catch(error){if(error instanceof RockFinalGpuAdmissionRefusal)throw new RockFinalAdmissionRefusal(error.message,{cause:error});throw error;}
   },
   fence:async(snapshot:SharedSurfacePreparationSnapshot)=>{await drainRockFinalGpuQuarantine(snapshot.renderer,()=>{});const device=scalarInkCompactionDevice(snapshot.renderer);if(!device)throw Error('Actual configured Rock renderer queue required for retirement');await device.queue.onSubmittedWorkDone();},
  },
 };
}
