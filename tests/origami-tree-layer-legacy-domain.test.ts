/** Actual ResourceLayer render domains. Only paint raster is replaced by sink
 * pixels; records below are explicitly renderer fixtures, not simulation Worlds.
 * No renderer, atlas pixels or visual-fidelity claim. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createHash} from 'node:crypto';
vi.mock('../src/render/origami/reference-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:s.stubReferenceBakeToSink};});
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:s.stubResidentPaintToSink};});
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>{const s=await import('./fixtures/reference-paint-bake-stub');return{...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:s.stubCheckpointPaintToSink,replayCheckpointMaskR8:s.stubReplayCheckpointMaskR8};});
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {fixedTreePaintKey} from '../src/render/surfaces/FixedTreeTextureSurface';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {EnvironmentLighting} from '../src/render/EnvironmentLighting';
import {TREE_SPECIES} from '../src/render/origami/baked/trees/recipe';
import type {TreeAssetCatalog} from '../src/render/origami/baked/trees/types';
import type {TextureSurfaceSlot} from '../src/render/surfaces/TextureSurface';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import type {ResourceRangeData} from '../src/render/StaticGeometry';
import type {Resource} from '../src/sim/types';
import type {NaturalPresentationChange} from '../src/render/NaturalResourcePresentation';
import {writeTestFileSync} from './test-output';

const settings={impasto:0,wear:0,edges:0,blackEdges:.79,edgeWidth:1.7,strokeImperfection:.15,contourImperfection:.6};
function fixture(site:boolean){const resources:Resource[]=TREE_SPECIES.map((species,i)=>({id:1000+i,kind:'tree',species,x:3+i,z:8,amount:1,growth:.7}));resources[0]!.blight={since:0,severity:.5,lastHarmTick:0,nextCheck:200,rng:1};resources.push({id:1100,kind:'tree',x:21,z:11,amount:1,growth:.41});return{width:32,height:32,tick:0,seed:123,...(site?{site:{biome:'temperate-forest'}}:{}),resources,structures:[],pawns:[],jobs:[]};}
type Input=ReturnType<typeof fixture>;
function make(style:'default'|'origami'){
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,...settings}),group=new THREE.Group(),environment=new EnvironmentLighting(),plain=new THREE.MeshLambertNodeMaterial({vertexColors:true}),paint=new THREE.MeshLambertNodeMaterial({vertexColors:true}),pastel=createStylizedSurfaceTexture('vegetation');
 plain.userData.rendererOwned=paint.userData.rendererOwned=true;environment.configure(plain);environment.configure(paint);const layer=withGraphicsStyle(context,()=>new ResourceLayer(group,plain,paint,undefined,{pastelTexture:pastel,configure:environment.configure}));
 return{group,layer,environment,context,dispose(){layer.dispose();plain.dispose();paint.dispose();pastel.dispose();environment.dispose();context.dispose();}};
}
function update(layer:ResourceLayer,input:Input,newMap:boolean,leaves:ReadonlySet<number>,changes?:ReadonlyMap<number,NaturalPresentationChange>){const before=JSON.stringify(input);Reflect.apply(layer.update,layer,[input,newMap,changes,undefined,{read:(r:Resource)=>({size:r.growth??1,ripe:true,leafless:leaves.has(r.id)}),harvestable:()=>false}]);expect(JSON.stringify(input)).toBe(before);}
const fields=['position','normal','windRoot','windBasis','uv','surfaceUv'] as const;
const cornerStride=3+3+3+4+2+4;
type Domain={id:number;canopy:boolean;visible:boolean;active:number[][];resident:number[][];rangeCounts:number[]};
/** Compare logical triangle corners, not backing indices: atlas seams legitimately
 * duplicate source vertices. Active streams read the ACTUAL compacted index and
 * drawRange; original is used only for the independently reported resident set. */
function capture(group:THREE.Group):Domain[]{
 const rows=new Map<string,Domain>();
 group.traverse(object=>{
  if(!(object instanceof THREE.Mesh)||object.userData.referenceCompanion)return;
  const data=object.userData.resourceRanges as ResourceRangeData|undefined;if(!data)return;
  const geometry=object.geometry,index=geometry.index!;let visible=true;for(let o:THREE.Object3D|null=object;o;o=o.parent)visible&&=o.visible;
  const canopy=object.name==='tree-canopy',byVertex=new Map<number,Domain>();
  const triangle=(a:number,b:number,c:number)=>{const corners=[a,b,c].map(v=>fields.flatMap(name=>{const attr=geometry.getAttribute(name);return Array.from({length:attr.itemSize},(_,k)=>attr.getComponent(v,k));}));let first=0;for(let i=1;i<3;i++)if(compare(corners[i]!,corners[first]!)<0)first=i;return [...corners[first]!,...corners[(first+1)%3]!,...corners[(first+2)%3]!];};
  for(const range of data.ranges){const key=range.id+':'+canopy;let row=rows.get(key);if(!row){row={id:range.id,canopy,visible,active:[],resident:[],rangeCounts:[]};rows.set(key,row);}else expect(row.visible).toBe(visible);row.rangeCounts.push(range.count);
   for(let v=range.vertexStart;v<range.vertexStart+range.vertexCount;v++)byVertex.set(v,row);
   for(let i=range.start;i<range.start+range.count;i+=3)row.resident.push(triangle(data.original[i]!,data.original[i+1]!,data.original[i+2]!));
  }
  const start=Math.max(0,geometry.drawRange.start),end=Math.min(index.count,geometry.drawRange.start+geometry.drawRange.count);
  for(let i=start;i+2<end;i+=3){const a=index.getX(i),b=index.getX(i+1),c=index.getX(i+2),row=byVertex.get(a);expect(row,'active index must retain a real owner').toBeDefined();expect(byVertex.get(b)).toBe(row);expect(byVertex.get(c)).toBe(row);row!.active.push(triangle(a,b,c));}
 });
 return[...rows.values()].map(r=>({...r,active:r.active.sort(compare),resident:r.resident.sort(compare),rangeCounts:r.rangeCounts.sort((a,b)=>a-b)})).sort((a,b)=>a.id-b.id||Number(a.canopy)-Number(b.canopy));
}
function compare(a:readonly number[],b:readonly number[]){for(let i=0;i<Math.min(a.length,b.length);i++)if(a[i]!==b[i])return a[i]!-b[i]!;return a.length-b.length;}
function difference(expected:Domain[],actual:Domain[]){
 const issues:string[]=[];if(expected.length!==actual.length)issues.push(`domains ${expected.length}/${actual.length}`);
 for(const a of expected){const b=actual.find(r=>r.id===a.id&&r.canopy===a.canopy);if(!b){issues.push(`missing owner ${a.id} canopy=${a.canopy}`);continue;}
  if(a.visible!==b.visible)issues.push(`visibility ${a.id}`);
  if(JSON.stringify(a.rangeCounts)!==JSON.stringify(b.rangeCounts))issues.push(`range counts ${a.id}: ${a.rangeCounts}/${b.rangeCounts}`);
  for(const field of ['active','resident'] as const){if(a[field].length!==b[field].length){issues.push(`${field} triangles ${a.id}: ${a[field].length}/${b[field].length}`);continue;}let error=0;for(let t=0;t<a[field].length;t++)for(let c=0;c<a[field][t]!.length;c++)error=Math.max(error,Math.abs(a[field][t]![c]!-b[field][t]![c]!));if(error>2e-6)issues.push(`${field} position/normal/wind ${a.id}: max ${error}`);}
 }return issues;
}
function compact(rows:Domain[]){return rows.map(r=>({id:r.id,canopy:r.canopy,visible:r.visible,rangeCounts:r.rangeCounts,activeTriangles:r.active.length,residentTriangles:r.resident.length,activeSha:createHash('sha256').update(JSON.stringify(r.active)).digest('hex'),residentSha:createHash('sha256').update(JSON.stringify(r.resident)).digest('hex'),positionBounds:r.resident.length?Array.from({length:3},(_,axis)=>({min:Math.min(...r.resident.flatMap(t=>[t[axis]!,t[cornerStride+axis]!,t[cornerStride*2+axis]!])),max:Math.max(...r.resident.flatMap(t=>[t[axis]!,t[cornerStride+axis]!,t[cornerStride*2+axis]!]))})):null}));}

test('actual shared tree Layer keeps all13 species, anonymous and blighted active domains/UVs in both variants across texture-only publication, growth and leaf masking',()=>{
 const reports:unknown[]=[],failures:string[]=[];
  for(const site of [true,false]){
   const input=fixture(site),legacy=make('default'),fallback=make('origami'),baked=make('origami'),leaves=new Set<number>();
   let texture:THREE.DataArrayTexture|undefined;
   try{
    for(const row of [legacy,fallback,baked])update(row.layer,input,true,leaves);const demand=baked.layer.treeBakeDemand();expect(demand.models).toHaveLength(13);expect(demand.models.every(m=>m.variant===(site?'broadleaf':'conical'))).toBe(true);expect(demand.models.some(m=>m.species===undefined)).toBe(false);
    texture=new THREE.DataArrayTexture(new Uint8Array(2*2*4*13),2,2,13);texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=true;const slots:TextureSurfaceSlot[]=Array.from({length:64},()=>({layer:0,paletteBaked:false}));demand.models.forEach((m,i)=>{slots[m.surfaceSlot]={layer:i,paletteBaked:true};});const catalog:TreeAssetCatalog={paintKey:fixedTreePaintKey(baked.context),revision:1,texture,pageCount:13,modelKeys:demand.models.map(m=>m.key),slots,assertCurrent(){for(const m of demand.models)m.assertCurrent();}};
    const before=capture(baked.group),geometries=baked.group.children.filter((m):m is THREE.Mesh=>m instanceof THREE.Mesh).map(m=>m.geometry),materials=baked.layer.compiledMaterials435();baked.layer.setTreeAssetCatalog(catalog,baked.environment.configure).commit();expect(capture(baked.group)).toEqual(before);expect(baked.group.children.filter((m):m is THREE.Mesh=>m instanceof THREE.Mesh).map(m=>m.geometry)).toEqual(geometries);expect(baked.layer.compiledMaterials435()).toEqual(materials);expect(baked.layer.bakedTreeStatus()).toMatchObject({ready:13,fallback:1});
    const check=(phase:string)=>{const source=capture(legacy.group),raw=capture(fallback.group),atlas=capture(baked.group),fallbackIssues=difference(source,raw),atlasIssues=difference(source,atlas);reports.push({site,phase,status:baked.layer.bakedTreeStatus(),source:compact(source),fallback:compact(raw),ready:compact(atlas),fallbackIssues,atlasIssues});failures.push(...fallbackIssues.map(s=>`${site}/${phase}/fallback: ${s}`),...atlasIssues.map(s=>`${site}/${phase}/ready: ${s}`));};
    check('initial-full');
    input.resources[0]!.growth=.43;input.resources[4]!.growth=.57;const changes=new Map<number,NaturalPresentationChange>([0,4].map(i=>[input.resources[i]!.id,{resource:input.resources[i]!,size:input.resources[i]!.growth!}]));
    for(const row of [legacy,fallback,baked])update(row.layer,input,false,leaves,changes);check('partial-growth');
    for(const r of input.resources.filter((_,i)=>i%2===0))leaves.add(r.id);const leafChanges=new Map(input.resources.map(r=>[r.id,{resource:r,size:r.growth!}]));for(const row of [legacy,fallback,baked])update(row.layer,input,false,leaves,leafChanges);check('partial-leafless');
    for(const row of [legacy,fallback,baked])row.layer.setFoliageVisible(false);check('foliage-hidden');for(const row of [legacy,fallback,baked])row.layer.setFoliageVisible(true);
    leaves.clear();for(const row of [legacy,fallback,baked])update(row.layer,input,false,leaves);check('full-update-restored');
    for(const row of [legacy,fallback,baked])update(row.layer,input,true,leaves);check('new-map-rebuild');
   }finally{baked.dispose();fallback.dispose();legacy.dispose();texture?.dispose();}
  }
  writeTestFileSync('artifacts/tree-layer13-legacy-domain.json',JSON.stringify({scope:'Integrated actual ResourceLayer/common models. Tiny texture arrays and synthetic paint only; no GPU/raster/World or visual claim. Actual owners, indexed triangles, UV/model-slot fields and visibility compared before/after texture data publication.',fields,reports,failures},null,2));
  expect(failures).toEqual([]);
},60000);
