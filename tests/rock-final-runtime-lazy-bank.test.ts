/** True RuntimeOptions -> Source planner -> GPU budget, CPU only.
 * No renderer/device, GPU allocation, raster or performance result. */
import{test,expect,vi}from'vitest';
import*as THREE from'three/webgpu';
import{RockLayer}from'../src/render/RockLayer';
import{collectRockFinalInput,type RockFinalProducer}from'../src/render/surfaces/RockFinalInput';
import{createRockFinalRuntimeOptions}from'../src/render/surfaces/RockFinalRuntime';
import{RockFinalAdmissionRefusal,type RockFinalInput,type RockFinalRuntimePlan}from'../src/render/surfaces/RockFinalRuntimeTypes';
import type{SharedSurfacePreparationSnapshot}from'../src/render/surfaces/SharedSurfacePreparation';
import type{RockFinalBudgetDeclarations,RockFinalGpuBudget}from'../src/render/origami/baked/rocks/RockFinalTypes';
import*as gpu from'../src/render/origami/baked/rocks/RockFinalGpu';
import{AffineStrokeOwner}from'../src/render/surfaces/AffineStrokeOwner';
import{createWorld}from'../src/sim/engine';
const MiB=1024*1024;
function fixture(){
 const world=createWorld(42,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(const[x,z]of[[12,12],[13,12],[13,13],[14,13]]as const)world.tiles[z*32+x]={terrain:'rock',stone:'granite'};
 const layer=new RockLayer();layer.update(world,true);const slots:unknown=Reflect.get(layer,'slots');if(!(slots instanceof Map))throw Error('Actual Rock writer slots required');
 const producer:RockFinalProducer={geometry:layer.mesh.geometry,stroke:layer.rockFinalCanonicalTable(),slots,width:world.width,height:world.height,revision:()=> 'real-Rock-runtime-lazy-bank'},input=collectRockFinalInput(producer,()=>{}),stone=new THREE.Texture(),calls:{oldGpu:number;oldCpu:number}[]=[];
 let budget:RockFinalBudgetDeclarations={sourceScope:'Explicit disjoint test Source/other ledger; nominal buffers only, not driver VRAM',sourceCpuBytes:2*MiB,sourceGpuBytes:24*MiB,otherLiveGpuBytes:400*MiB,oldAtlasCpuBytes:0,oldAtlasGpuBytes:0,newLookupCpuBytes:input.faceSpan*32,newLookupGpuBytes:input.faceSpan*32,maxFamilyRetainedGpuBytes:512*MiB,maxGlobalPeakGpuBytes:1024*MiB,maxPreparationCpuBytes:256*MiB};
 // Planning must never interrogate a renderer or any device.
 const renderer=new Proxy({}as THREE.WebGPURenderer,{get(){throw Error('CPU runtime plan accessed the renderer');}}),snapshot:SharedSurfacePreparationSnapshot={preferences:{style:'origami',impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6},world,reset:false,reason:'settings',epoch:1,renderer,paintRevision:1,density:{mode:'orthographic',physicalCellPixels:22}};
 const runtime=createRockFinalRuntimeOptions({stonePaint:stone,size:1024,density:48,maxCellPixels:24,returnCellPixels:20,lookupStageUpperBytes:span=>({retainedGpuBytes:span*32,newCpuBytes:span*32,lookupBytes:span*32}),declarations:(_input,oldGpu,oldCpu)=>{calls.push({oldGpu,oldCpu});return{...budget,oldAtlasGpuBytes:oldGpu,oldAtlasCpuBytes:oldCpu};}});
 return{input,snapshot,runtime,calls,get budget(){return budget;},setBudget:(update:Partial<RockFinalBudgetDeclarations>)=>{budget={...budget,...update};},close:()=>{stone.dispose();layer.dispose();}};
}
function receipt(plan:RockFinalRuntimePlan):RockFinalGpuBudget{const value:unknown=plan.permit;if(!value||typeof value!=='object'||!('schema'in value)||value.schema!=='rock-final-gpu-budget-v1')throw Error('Actual complete GPU budget required');return value as RockFinalGpuBudget;}
function noGpu(){const allocate=vi.spyOn(gpu,'allocateRockFinalGpuBank'),affine=vi.spyOn(AffineStrokeOwner.prototype,'stageAll');return{assert(){expect(allocate).not.toHaveBeenCalled();expect(affine).not.toHaveBeenCalled();},close(){allocate.mockRestore();affine.mockRestore();}};}

test('real runtime admits one cold bank, counts a lazy spare beside the live bank, and requests zero new banks for an existing back bank',()=>{
 const f=fixture(),guard=noGpu();try{
  const first=f.runtime.plan(f.input,f.snapshot,undefined,0,0,1),a=receipt(first),bank=a.bankGpuBytes;
  expect(first.layers).toBeGreaterThan(0);expect(bank).toBe(first.layers*gpu.rockFinalPageGpuBytes(1024));expect(a.newBankCopies).toBe(1);expect(a.newAtlasGpuBytes).toBe(bank);
  expect(a.familyLiveGpuBytes).toBe(f.budget.sourceGpuBytes!+f.input.faceSpan*32+bank);expect(a.globalPeakGpuBytes).toBe(f.budget.otherLiveGpuBytes!+a.familyLiveGpuBytes+a.scratchGpuBytes);expect(f.calls.at(-1)).toEqual({oldGpu:0,oldCpu:0});
  const oldCpu=f.input.cpuBytes+first.cpuBytes+first.layers*4*64,second=f.runtime.plan(f.input,f.snapshot,first,bank,oldCpu,1),b=receipt(second);
  // previous exists in BOTH calls. Only the explicit allocation count differs.
  expect(second.key).toBe(first.key);expect(second.charts).toEqual(first.charts);expect(second.lookup).toEqual(first.lookup);expect(b.newBankCopies).toBe(1);expect(b.newAtlasGpuBytes).toBe(bank);expect(b.familyLiveGpuBytes-a.familyLiveGpuBytes).toBe(bank);expect(f.calls.at(-1)).toEqual({oldGpu:bank,oldCpu});
  const reused=f.runtime.plan(f.input,f.snapshot,second,bank*2,oldCpu,0),c=receipt(reused);
  expect(c.newBankCopies).toBe(0);expect(c.newAtlasGpuBytes).toBe(0);expect(c.familyLiveGpuBytes).toBe(b.familyLiveGpuBytes);expect(c.globalPeakGpuBytes).toBe(b.globalPeakGpuBytes);expect(f.calls.at(-1)).toEqual({oldGpu:bank*2,oldCpu});
  // A full replacement has no previous layout, yet still allocates just ONE
  // candidate while the formerly published bank remains live until its fence.
  const replacement=f.runtime.plan(f.input,f.snapshot,undefined,bank,oldCpu,1),d=receipt(replacement);expect(d.newBankCopies).toBe(1);expect(d.familyLiveGpuBytes).toBe(b.familyLiveGpuBytes);expect(replacement.key).not.toBe(first.key);f.input.assertCurrent();guard.assert();
 }finally{guard.close();f.close();}
});

test('real runtime keeps exact caps and refuses a lazy spare before GPU allocation when old plus new overlap does not fit',()=>{
 const f=fixture(),guard=noGpu();try{
  const initial=f.runtime.plan(f.input,f.snapshot,undefined,0,0,1),a=receipt(initial),bank=a.bankGpuBytes;
  f.setBudget({maxFamilyRetainedGpuBytes:a.familyLiveGpuBytes,maxGlobalPeakGpuBytes:a.globalPeakGpuBytes,maxPreparationCpuBytes:a.preparationCpuBytes});
  expect(()=>f.runtime.plan(f.input,f.snapshot,undefined,0,0,1)).not.toThrow();
  expect(()=>f.runtime.plan(f.input,f.snapshot,initial,bank,0,1)).toThrow(RockFinalAdmissionRefusal);
  f.setBudget({maxFamilyRetainedGpuBytes:512*MiB,maxGlobalPeakGpuBytes:a.globalPeakGpuBytes-1,maxPreparationCpuBytes:256*MiB});expect(()=>f.runtime.plan(f.input,f.snapshot,undefined,0,0,1)).toThrow('BEFORE GPU allocation');
  f.setBudget({maxGlobalPeakGpuBytes:1024*MiB,maxFamilyRetainedGpuBytes:a.familyLiveGpuBytes-1});expect(()=>f.runtime.plan(f.input,f.snapshot,undefined,0,0,1)).toThrow('BEFORE GPU allocation');
  f.setBudget({maxFamilyRetainedGpuBytes:512*MiB,maxPreparationCpuBytes:a.preparationCpuBytes-1});expect(()=>f.runtime.plan(f.input,f.snapshot,undefined,0,0,1)).toThrow('BEFORE GPU allocation');
  f.setBudget({maxPreparationCpuBytes:256*MiB,sourceGpuBytes:null});expect(()=>f.runtime.plan(f.input,f.snapshot,undefined,0,0,1)).toThrow('Unknown budget');
  const untyped=f.runtime.plan as(...args:unknown[])=>RockFinalRuntimePlan;for(const count of[undefined,-1,2,1.5])expect(()=>untyped(f.input,f.snapshot,initial,bank,0,count)).toThrow(RockFinalAdmissionRefusal);
  f.input.assertCurrent();guard.assert();
 }finally{guard.close();f.close();}
});
