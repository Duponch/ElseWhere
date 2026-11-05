/** Mathematical filter/format contract over STORED RGBA8 bytes. This does not
 * evaluate a shader or establish a GPU RGB round-trip/pixel/performance result.
 * The actual product WGSL is checked separately in Resource cold programs. */
import {expect,test} from 'vitest';

type Rgba=readonly[number,number,number,number];
const linear=(code:number)=>{const s=code/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;};
const occupancy=(v:Rgba)=>v[0]!==0||v[1]!==0||v[2]!==0?1:0;
function filter(texels:readonly Rgba[],weights:readonly number[]){return[0,1,2].map(c=>texels.reduce((sum,value,i)=>sum+linear(value[c]!)*weights[i]!,0));}
const rgba=(r:number,g=0,b=0,a=0):Rgba=>[r,g,b,a];

test('stored coloured Ink with alpha quantized to zero still needs an Ink read; opaque black needs none',()=>{
 const coloured=rgba(1,0,0,0),black=rgba(0,0,0,255),legacyBodyOccupancy=1;
 expect(coloured[3]).toBe(0);expect(linear(coloured[0])).toBeGreaterThan(0);expect(occupancy(coloured)).toBe(1);
 expect(black[3]).toBe(255);expect(occupancy(black)).toBe(0);
 const weight=.125,actual=filter([coloured,black],[weight,1-weight]),wrongAlphaDecision=coloured[3]>0?actual:[0,0,0];
 expect(actual[0]).toBeGreaterThan(0);expect(wrongAlphaDecision).not.toEqual(actual);
 expect(legacyBodyOccupancy>0).toBe(true); // old Body.a=1 is conservative
});

test('nonnegative bilinear/trilinear filtering cannot produce a false zero for per-mip stored-RGB occupancy',()=>{
 // Eight texels are four bilinear taps at each of two ACTUAL stored levels.
 // Coarse levels are tested independently: no assumption that alpha was
 // averaged from fine coverage or that RGB mip encoding preserves Ink.a.
 const phase=[0,1/65536,.125,.5,.875,1-1/65536,1],palette=[rgba(0),rgba(1,0,0,0),rgba(0,255,0,0),rgba(0,0,1,255),rgba(17,51,203,0)];
 let exactZero=0,reads=0,colouredZeroAlpha=0;
 for(let seed=0;seed<palette.length*8;seed++)for(const x of phase)for(const y of phase)for(const z of phase){
  const values=Array.from({length:8},(_,i)=>palette[(seed+i*(seed%4+1))%palette.length]!),bilinear=[(1-x)*(1-y),x*(1-y),(1-x)*y,x*y],weights=bilinear.map(v=>v*(1-z)).concat(bilinear.map(v=>v*z)),mask=values.reduce((n,v,i)=>n+occupancy(v)*weights[i]!,0),ink=filter(values,weights);
  expect(weights.every(v=>v>=0)).toBe(true);expect(mask).toBeGreaterThanOrEqual(0);expect(mask).toBeLessThanOrEqual(1.000000000000001);
  const gated=mask>0?ink:[0,0,0];expect(gated).toEqual(ink);
  if(mask===0){exactZero++;expect(ink).toEqual([0,0,0]);}else reads++;
  if(values.some((v,i)=>v[3]===0&&occupancy(v)===1&&weights[i]!>0)&&ink.some(v=>v>0))colouredZeroAlpha++;
 }
 expect(exactZero).toBeGreaterThan(0);expect(reads).toBeGreaterThan(0);expect(colouredZeroAlpha).toBeGreaterThan(0);
});
