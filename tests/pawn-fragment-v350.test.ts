import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {pawnFragmentTraits} from '../src/render/PawnLayer';

// This graph/source contract guards the new transport only. Actual complete
// WGSL locations and raster equality belong to ROOT's native diagnostics.
test('V350 bone and dye share one named vec2 transport from the common packed rig traits',()=>{
  expect(pawnFragmentTraits.isVaryingNode).toBe(true);
  expect(pawnFragmentTraits.name).toBe('v_pawnFragmentTraits');
  const attributes=new Set<string>();
  pawnFragmentTraits.traverse(node=>{
    const candidate=node as typeof node&{isAttributeNode?:boolean;_attributeName?:string};
    if(candidate._attributeName)attributes.add(candidate._attributeName);
  });
  expect([...attributes].sort()).toEqual(['pawnRigTraits']);
});

test('V350 shared traits preserve each scalar under perspective-correct interpolation',()=>{
  // Nonuniform W includes different body/equipment classifications. Packing
  // must not round IDs or move their nonlinear comparisons to the vertex.
  const samples=[{bone:0,dye:1,w:2},{bone:7,dye:203,w:5},{bone:2,dye:-3,w:11}];
  const barycentric=[.2,.3,.5],weight=samples.map((sample,i)=>barycentric[i]!/sample.w);
  const sum=weight.reduce((a,b)=>a+b,0);
  const scalar=(key:'bone'|'dye')=>samples.reduce((value,sample,i)=>value+sample[key]*weight[i]!,0)/sum;
  const packed=samples.reduce((value,sample,i)=>[value[0]!+sample.bone*weight[i]!,value[1]!+sample.dye*weight[i]!],[0,0]).map(value=>value/sum);
  expect(packed).toEqual([scalar('bone'),scalar('dye')]);
  expect(packed[0]).not.toBe(Math.round(packed[0]!));
  expect(packed[1]).not.toBe(Math.round(packed[1]!));
});

test('V350 only fragment trait transport changes; pose attributes and nonlinear pigment remain in their stages',()=>{
  const source=readFileSync(new URL('../src/render/PawnLayer.ts',import.meta.url),'utf8');
  const start=source.indexOf('    const baseColor = Fn('),end=source.indexOf('    mat.colorNode = baseColor;',start);
  expect(start).toBeGreaterThan(0);expect(end).toBeGreaterThan(start);
  const fragment=source.slice(start,end);
  expect(fragment).toContain('const traits=origamiTraits??pawnFragmentTraits;const fragmentBone=traits.x,fragmentDye=traits.y');
  expect(fragment).not.toMatch(/attribute\('(boneId|dye)'/);
  expect(fragment).toContain('const ribs=sin(positionLocal.y.mul(43)).greaterThan(.25)');
  expect(fragment).toContain('bodyBloodPigment(');
  const before=source.slice(source.indexOf('const makeOriginalPosition'),start),cached=source.slice(source.indexOf('private cachedPawnPosition'));
  expect(before).toContain('pawnBoneNode(this.referenceRig)');
  expect(before).toContain('pawnDyeNode(this.referenceRig)');
  expect(cached).toContain('pawnBoneNode(this.referenceRig)');
  expect(cached).toContain('pawnDyeNode(this.referenceRig)');
  expect(source).toContain('baseColor.mul(pawnSurfaceShade(this.surfaceTexture))');
});
