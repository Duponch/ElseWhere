// The game's noise modules (Verse.Noise). Expected values come from an
// independent hand computation of the decompiled algorithms (gradient lattice,
// octave sums, module formulas), not from running this module.
import {describe,expect,it} from 'vitest';
import {coherentWorldNoise} from '../src/sim/world-coherent-noise';
import {Perlin,RidgedMultifractal,Const,ScaleBias,Blend,Multiply,Power,Abs,OneMinus,Filter,Clamp,InverseLerp,Arbitrary,CurveSimple,AbsLatitudeCurve,DistanceFromPlanetViewCenter,ConvertToIsland,QualityMode,noiseAt} from '../src/sim/verse-noise';
import {vector3Angle,vector3Normalized} from '../src/sim/verse-vector';
const f=Math.fround;

describe('gradient noise and octave modules',()=>{
 it('GradientCoherentNoise3D in the three qualities',()=>{
  expect(coherentWorldNoise(.5,.25,.75,0,'high')).toBeCloseTo(0.47170709096921726,15);
  expect(coherentWorldNoise(-1.3,2.7,-.1,1234,'medium')).toBeCloseTo(0.26608448953007363,15);
  expect(coherentWorldNoise(3.2,-4.4,5.6,987654,'low')).toBeCloseTo(0.861267014272,15);
 });
 it('Perlin sums its octaves with seeds seed + octave (wrapping on 32 bits)',()=>{
  expect(new Perlin(f(.035),2,f(.4),6,12345,QualityMode.High).getValue(10.5,-3.25,7.75)).toBeCloseTo(0.05398450067809192,15);
  expect(new Perlin(f(.032),2,.5,5,2147483647,QualityMode.Medium).getValue(-41.25,81.5,-40.125)).toBeCloseTo(0.46032731970173874,15);
  const normalized=new Perlin(f(.035),2,f(.4),6,12345,QualityMode.High,true,true).getValue(10.5,-3.25,7.75);
  expect(normalized).toBeCloseTo(1-(0.05398450067809192*.5+.5),15);
  expect(new Perlin(1,2,.5,99,1,QualityMode.Low).octaves).toBe(30);
 });
 it('RidgedMultifractal weights each octave by the previous signal',()=>{
  expect(new RidgedMultifractal(f(.012),2,6,2147483640,QualityMode.High).getValue(10.5,-3.25,7.75)).toBeCloseTo(0.41580064680689754,15);
 });
});

describe('combining modules',()=>{
 const c=(v:number)=>new Const(v);
 it('ScaleBias, Blend, Multiply, Power, Abs, OneMinus',()=>{
  expect(new ScaleBias(5500,-500,c(.5)).getValue(0,0,0)).toBe(2250);
  expect(new Blend(c(2),c(10),c(0)).getValue(0,0,0)).toBe(6);
  expect(new Blend(c(2),c(10),c(-1)).getValue(0,0,0)).toBe(2);
  expect(new Multiply(c(3),c(-4)).getValue(0,0,0)).toBe(-12);
  expect(new Power(c(.5),c(3)).getValue(0,0,0)).toBe(.125);
  expect(new Abs(c(-2)).getValue(0,0,0)).toBe(2);expect(new OneMinus(c(.25)).getValue(0,0,0)).toBe(.75);
 });
 it('Filter, Clamp (reversed bounds swapped), InverseLerp, Arbitrary, CurveSimple',()=>{
  expect([new Filter(c(-.3),-.3,1).getValue(0,0,0),new Filter(c(-.31),-.3,1).getValue(0,0,0),new Filter(c(1),-.3,1).getValue(0,0,0)]).toEqual([1,0,1]);
  expect(new Filter(c(f(-.3)),-.3,1).getValue(0,0,0)).toBe(1);expect(new Filter(c(-.30000002),-.3,1).getValue(0,0,0)).toBe(0);
  expect(new Clamp(1,0,c(5)).getValue(0,0,0)).toBe(1);expect(new Clamp(0,999,c(-3)).getValue(0,0,0)).toBe(0);
  expect(new InverseLerp(c(700),750,650).getValue(0,0,0)).toBe(.5);expect(new InverseLerp(c(1000),725,900).getValue(0,0,0)).toBe(1);
  expect(new Arbitrary(c(.01),v=>v*2).getValue(0,0,0)).toBe(.02);
  expect(new CurveSimple(c(250),[[0,0],[1000,700]]).getValue(0,0,0)).toBe(175);
 });
 it('AbsLatitudeCurve reads the latitude of y on the sphere',()=>{
  const curve=[[0,1.12],[25,.94],[45,.7],[70,.3],[80,.05],[90,.05]] as const,module=new AbsLatitudeCurve(curve,100);
  expect(module.getValue(0,0,0)).toBe(f(1.12));expect(module.getValue(0,-100,0)).toBe(f(.05));
  const lat=f(f(Math.asin(f(50/100)))*f(57.29578));
  expect(module.getValue(0,50,0)).toBe(f(f(.94)+(f(.7)-f(.94))*f((lat-25)/(45-25))));
 });
});

describe('planet view modules and Vector3 with the runtime precision',()=>{
 it('Vector3.Angle and normalized',()=>{
  expect(vector3Angle([1,0,0],[0,1,0])).toBe(90);
  expect(vector3Angle([f(.3),f(-.2),f(.9)],[10,20,-5])).toBe(104.33447265625);
  expect(vector3Normalized([3,4,12])).toEqual([0.23076923191547394,0.3076923191547394,0.9230769276618958]);
  expect(vector3Normalized([0,0,1e-6])).toEqual([0,0,0]);
 });
 it('DistanceFromPlanetViewCenter: angle over view angle, at most 1, inverted in double',()=>{
  const centre=[0,0,-1] as const,view=f(54.000003814697266);
  const near=new DistanceFromPlanetViewCenter(centre,view,true),far=new DistanceFromPlanetViewCenter(centre,view);
  expect(near.getValue(0,0,-100)).toBe(1);expect(far.getValue(100,0,0)).toBe(1);
  const point=[f(30),f(10),f(-90)] as const,ratio=f(vector3Angle(centre,point)/view);
  expect(near.getValue(...point)).toBe(1-ratio);
  expect(new DistanceFromPlanetViewCenter(centre,180).getValue(1,2,3)).toBe(0);
 });
 it('ConvertToIsland lowers land and water near the edge of the generated part',()=>{
  const centre=[0,0,-1] as const,view=54,inside=new ConvertToIsland(centre,view,new Const(.3));
  expect(inside.getValue(0,0,-100)).toBe(.3);
  const edge=[f(100*Math.sin(50*Math.PI/180)),0,f(-100*Math.cos(50*Math.PI/180))] as const;
  const angle=vector3Angle(centre,edge),from=f(54-13.5),to=f(54-f(54*f(.1))),t=f((angle-from)/(to-from)),e=f(.62*t),w=f(-.12);
  expect(inside.getValue(...edge)).toBe((.3-w)*(1-e*f(.7))-e*f(.3)+w);
  expect(new ConvertToIsland(centre,view,new Const(-.5)).getValue(...edge)).toBe(-.5-e*f(.3));
 });
 it('noiseAt casts the module value to float',()=>{
  expect(noiseAt(new Const(1/3),[0,0,0])).toBe(f(1/3));
 });
});
