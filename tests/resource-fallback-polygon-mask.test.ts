/** Real thirteen-species/two-variant polygons and original bake topology.
 * No painting, renderer, mock geometry, device or visual claim. */
import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {TreeModels,TREE_MODEL_SPECIES} from '../src/render/models/TreeModels';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {createResourceSurfaceModels} from '../src/render/models/ResourceSurfaceModels';
import {compileLegacyFaceMasks,maskPoint,legacyMaskSamples} from '../src/render/origami/baked/trees/face-mask';
import {SURFACE_STROKE_FACE} from '../src/render/surfaces/NaturalSurfaceModels';
import {writeTestFileSync} from './test-output';

test('complete Resource fallback maps every real named tree polygon to the admitted bake mask without imaginary raw-UV borders',()=>{
 const trees=new TreeModels(),flora=new ReferenceFloraLibrary(false,false),source:ReturnType<typeof trees.get>[]=[];
 for(const variant of ['broadleaf','conical']as const)for(const species of TREE_MODEL_SPECIES)source.push(trees.get(species,variant));
 const before=source.flatMap(model=>model.parts.map(part=>({geometry:part.geometry,uv:part.geometry.getAttribute('uv'),words:new Uint32Array(part.geometry.getAttribute('uv').array.buffer.slice(0))}))),models=createResourceSurfaceModels(trees,flora),coverage=models.legacyCoverage;
 const barycentrics=[[1/3,1/3,1/3],[.8,.1,.1],[.1,.8,.1],[.1,.1,.8]]as const;let triangles=0,points=0,edgeQueries=0,uvBorderInteriorWitnesses=0;
 const faces=new Set<number>();
 try{
  expect(TREE_MODEL_SPECIES).toHaveLength(13);expect(source).toHaveLength(26);expect(coverage.maskedFaces).toBeGreaterThan(0);expect(coverage.cpuBytes).toBeLessThanOrEqual(1024*1024);expect(coverage.gpuBytes).toBe(coverage.cpuBytes);expect(coverage.texture.image.data).toBe(coverage.data);expect(coverage.texture.type).toBe(THREE.FloatType);expect(coverage.texture.minFilter).toBe(THREE.NearestFilter);expect(coverage.texture.generateMipmaps).toBe(false);
  for(const model of source){const layout=model.createAtlasLayout(),masks=compileLegacyFaceMasks(layout.charts);for(const part of layout.canonicalParts){const mapped=models.map(part.geometry),raw=mapped.getAttribute('bakedUv'),sourceRaw=mapped.getAttribute('uv'),ids=mapped.getAttribute(SURFACE_STROKE_FACE),index=mapped.index;
   for(const triangle of layout.charts.triangles){if(triangle.sourceTriangle<part.triangleOffset||triangle.sourceTriangle>=part.triangleOffset+part.geometry.getAttribute('position').count/3)continue;
    const local=triangle.sourceTriangle-part.triangleOffset,vertices=[0,1,2].map(c=>index?.getX(local*3+c)??local*3+c),face=ids.getX(vertices[0]!),at=face*32,mask=masks[triangle.chartId]!;faces.add(face);triangles++;
    expect(coverage.data[at+6]).toBe(mask.edges.length);expect(coverage.data[at+7]).toBe(Math.fround(mask.span));for(let e=0;e<mask.edges.length;e++)expect([...coverage.data.subarray(at+8+e*4,at+12+e*4)]).toEqual(mask.edges[e]!.map(Math.fround));
    for(const bary of barycentrics){const uv:[number,number]=[0,0],sourceUv:[number,number]=[0,0];for(let c=0;c<3;c++){uv[0]+=raw.getX(vertices[c]!)*bary[c]!;uv[1]+=raw.getY(vertices[c]!)*bary[c]!;sourceUv[0]+=sourceRaw.getX(vertices[c]!)*bary[c]!;sourceUv[1]+=sourceRaw.getY(vertices[c]!)*bary[c]!;}const actual=coverage.point(face,uv),expected=maskPoint(layout.charts,triangle.id,bary),bound=32*2**-23*(1+Math.abs(actual[0])+Math.abs(actual[1])+Math.abs(expected[0])+Math.abs(expected[1]));expect(Math.abs(actual[0]-expected[0])).toBeLessThanOrEqual(bound);expect(Math.abs(actual[1]-expected[1])).toBeLessThanOrEqual(bound);points++;
     // Independent original edge sampler determines the physical painted
     // interior; no assumption about triangle/box UV edges enters this query.
     for(const fill of [0,.6,1]){const samples=legacyMaskSamples(mask,expected,fill);edgeQueries++;for(const q of samples){expect(q.every(Number.isFinite)).toBe(true);expect(q[0]).toBeGreaterThanOrEqual(0);expect(q[0]).toBeLessThanOrEqual(1);expect(q[1]).toBeGreaterThanOrEqual(0);}if(fill===.6&&!samples.length&&(sourceUv[0]<0||sourceUv[0]>1||sourceUv[1]<0||sourceUv[1]>1))uvBorderInteriorWitnesses++;}
    }
   }
  }}
  const generic=models.get('rock').getAttribute(SURFACE_STROKE_FACE);for(let v=0;v<generic.count;v++)expect(coverage.data[generic.getX(v)*32+6]).toBe(0);
  for(const row of before){expect(row.geometry.getAttribute('uv')).toBe(row.uv);expect(new Uint32Array(row.uv.array.buffer)).toEqual(row.words);}
  writeTestFileSync('artifacts/resource-fallback-mask-domain.json',JSON.stringify({scope:'Actual Source model/polygon correspondence only; no pixels/GPU/imperceptibility claim',species:TREE_MODEL_SPECIES,variants:['broadleaf','conical'],models:source.length,namedFaces:faces.size,allMaskFaces:coverage.maskedFaces,triangles,points,edgeQueries,uvBorderInteriorWitnesses,metadataCpuBytes:coverage.cpuBytes,metadataGpuBytes:coverage.gpuBytes},null,2));
 }finally{models.dispose();flora.dispose();trees.dispose();}
},45_000);
