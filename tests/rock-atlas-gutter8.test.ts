/** Actual Rock producer/collector, CPU only. No device or model substitution. */
import{test,expect}from'vitest';
import type * as THREE from'three/webgpu';
import{RockLayer}from'../src/render/RockLayer';
import{collectRockFinalInput,type RockFinalProducer}from'../src/render/surfaces/RockFinalInput';
import{planRockFinalAtlas,type RockFinalPlan,type RockFinalPlanInput}from'../src/render/surfaces/RockFinalPlan';
import{createWorld}from'../src/sim/engine';
import{ROCK_SURFACE_UV}from'../src/render/models/RockSurfaceModel';
import{writeTestFileSync}from'./test-output';
const options={size:1024 as const,density:48,maxCellPixels:24,returnCellPixels:20};
const unknown={sourceCpuBytes:null,sourceGpuBytes:null,otherLiveGpuBytes:null,scratchCpuBytes:null,scratchGpuBytes:null,oldAtlasCpuBytes:null,oldAtlasGpuBytes:null,sourceScope:'CPU geometry/filter proof only; actual global Source/scratch ledger remains unknown'};
const words=(a:ArrayBufferView)=>new Uint32Array(a.buffer,a.byteOffset,a.byteLength/4);
function fixture(){
 const world=createWorld(42,32,32);world.tiles=world.tiles.map(()=>({terrain:'soil'}));for(const[x,z]of[[12,12],[13,12],[13,13],[14,13]]as const)world.tiles[z*32+x]={terrain:'rock',stone:'granite'};
 const layer=new RockLayer();layer.update(world,true);const slots:unknown=Reflect.get(layer,'slots');if(!(slots instanceof Map))throw Error('Actual Rock writer required');
 const producer:RockFinalProducer={geometry:layer.mesh.geometry,stroke:layer.rockFinalCanonicalTable(),slots,width:world.width,height:world.height,revision:()=> 'actual-Source-model-for-gutter8'},collected=collectRockFinalInput(producer,()=>{});
 const input:RockFinalPlanInput={...collected.arrays,panels:collected.panels,faceSpan:collected.faceSpan,width:collected.width,height:collected.height,cpuBytes:collected.cpuBytes,revision:collected.revision,assertCurrent:collected.assertCurrent};
 return{layer,producer,collected,input,close:()=>layer.dispose()};
}
function support(start:number,length:number,level:number){const s=2**level,lo=Math.floor((start+.5)/s-.5),hi=Math.floor((start+length-.5)/s-.5)+1;return{min:lo*s,max:(hi+1)*s,left:Math.max(0,start-lo*s),right:Math.max(0,(hi+1)*s-start-length)};}
function texelBound(input:RockFinalPlanInput,plan:RockFinalPlan,triangle:number){
 const p:number[][]=[],uv:number[][]=[];for(let n=0;n<3;n++){const v=input.indices[triangle*3+n]!,at=input.triangleFace[triangle]!*8;p.push(Array.from(input.position.subarray(v*3,v*3+3)));uv.push([0,1].map(axis=>(input.rockSurfaceUv[v*3+axis]!*plan.lookup[at+2+axis]!+plan.lookup[at+axis]!)*plan.size));}
 const a=uv[1]![0]!-uv[0]![0]!,b=uv[1]![1]!-uv[0]![1]!,c=uv[2]![0]!-uv[0]![0]!,d=uv[2]![1]!-uv[0]![1]!,det=a*d-b*c,e=p[1]!.map((n,i)=>n-p[0]![i]!),f=p[2]!.map((n,i)=>n-p[0]![i]!),du=e.map((n,i)=>(n*d-f[i]!*b)/det),dv=e.map((n,i)=>(f[i]!*a-n*c)/det),aa=du.reduce((n,v)=>n+v*v,0),bb=du.reduce((n,v,i)=>n+v*dv[i]!,0),cc=dv.reduce((n,v)=>n+v*v,0);
 return Math.sqrt((aa+cc+Math.hypot(aa-cc,2*bb))*.5);
}
test('RockAtlasGutter8 keeps every actual Source word and48texels/cell while aligned four-mip filtering stays inside eight padded texels',()=>{
 const f=fixture(),before=Object.fromEntries(Object.entries(f.collected.arrays).map(([name,a])=>[name,words(a).slice()])),geometry=f.layer.mesh.geometry,attrs=['position','normal','color',ROCK_SURFACE_UV].map(name=>geometry.getAttribute(name)as THREE.BufferAttribute),raw=attrs.map(a=>({ref:a,version:a.version,words:words(a.array).slice()})),index=geometry.index!,indexWords=words(index.array).slice(),canonical=f.producer.stroke.buffer,canonicalWords=words(canonical.array).slice();
 try{
  const plan=planRockFinalAtlas(f.input,options,unknown);expect(plan.stats.namespace).toBe('RockAtlasGutter8');expect(plan.stats.gutter).toBe(8);expect(plan.admitted).toBe(false);expect(plan.permit).toBeUndefined();expect(plan.retainedGpuBytes).toBeNull();expect(plan.peakGpuBytes).toBeNull();expect(plan.charts.length).toBeGreaterThan(0);expect(plan.sourceSlabFaces).toHaveLength(6);
  for(const chart of plan.charts){for(const v of[chart.content.x,chart.content.y,chart.content.width,chart.content.height])expect(v%8).toBe(0);for(const v of[chart.rect.x,chart.rect.y,chart.rect.width,chart.rect.height])expect(v%16).toBe(0);expect(chart.content.x-chart.rect.x).toBe(8);expect(chart.content.y-chart.rect.y).toBe(8);
   for(const[start,length,outerStart,outerLength]of[[chart.content.x,chart.content.width,chart.rect.x,chart.rect.width],[chart.content.y,chart.content.height,chart.rect.y,chart.rect.height]])for(let level=0;level<4;level++){const s=support(start!,length!,level);expect(s.left).toBeLessThanOrEqual(8);expect(s.right).toBeLessThanOrEqual(8);expect(s.min).toBeGreaterThanOrEqual(outerStart!);expect(s.max).toBeLessThanOrEqual(outerStart!+outerLength!);}
  }
  for(let t=0;t<f.input.triangleFace.length;t++)if(plan.lookup[f.input.triangleFace[t]!*8+5]===1)expect(texelBound(f.input,plan,t)).toBeLessThanOrEqual(1/48*(1+1e-10));
  for(const[name,a]of Object.entries(f.collected.arrays))expect(words(a),name).toEqual(before[name]);for(let i=0;i<attrs.length;i++){expect(attrs[i]).toBe(raw[i]!.ref);expect(attrs[i]!.version).toBe(raw[i]!.version);expect(words(attrs[i]!.array)).toEqual(raw[i]!.words);}expect(geometry.index).toBe(index);expect(words(index.array)).toEqual(indexWords);expect(f.producer.stroke.buffer).toBe(canonical);expect(words(canonical.array)).toEqual(canonicalWords);f.input.assertCurrent();
  expect(support(3,16,3).left).toBe(11); // Unaligned8px padding demonstrably fails.
  writeTestFileSync('artifacts/rock-atlas-gutter8-filter-source-proof.json',JSON.stringify({source:'Actual RockLayer/RockSurfaceModel/current collectRockFinalInput',charts:plan.charts.length,pages:plan.layers,density:48,all13SourceStreamsAndRawModelWordsExact:true,allActualFloat32LookupTriangleMetricsBounded:true,conditions:{contentAlignment:8,outerAlignment:16,gutter:8,mips:4,maxLOD:3,anisotropy:1,bilinearTrilinear:true,aligned2x2BoxMipReduction:true},admitted:false,qualityQualified:false,scope:'CPU geometry/filter support proof only; valid padding seeds and Native quality remain required'},null,2)+'\n');
 }finally{f.close();}
});
test('RockAtlasGutter8 preserves stable real Source placements and refuses old or misaligned layout reuse',()=>{
 const f=fixture();try{
  const previous=planRockFinalAtlas(f.input,options,unknown),next=planRockFinalAtlas(f.input,options,unknown,previous);expect(next.layers).toBe(previous.layers);expect(next.charts.map(c=>[c.stableKey,c.page,c.rect,c.content,c.chartSplit])).toEqual(previous.charts.map(c=>[c.stableKey,c.page,c.rect,c.content,c.chartSplit]));expect(next.lookup).toEqual(previous.lookup);expect(next.admitted).toBe(false);
  const old={...previous,stats:{...previous.stats,namespace:undefined,gutter:16}};expect(()=>planRockFinalAtlas(f.input,options,unknown,old)).toThrow(/complete prepared layout/);
  const bad={...previous,charts:previous.charts.map((c,i)=>i?c:{...c,content:{...c.content,width:c.content.width+1}})};expect(()=>planRockFinalAtlas(f.input,options,unknown,bad)).toThrow(/mip3-aligned/);
  const full={...previous,charts:previous.charts.map(c=>({...c,content:{...c.content,width:8,height:8}}))};expect(()=>planRockFinalAtlas(f.input,options,unknown,full)).toThrow(/changed metric/);f.input.assertCurrent();
 }finally{f.close();}
});
