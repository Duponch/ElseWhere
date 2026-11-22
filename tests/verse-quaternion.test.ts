// Quaternions and planet headings (src/sim/verse-quaternion.ts,
// src/sim/world-core-geometry.ts). Axis-aligned cases are derived by hand
// from the construction (orthonormal basis, Shoemake's trace method, managed
// rotation); `LookRotation` itself is native engine code, emulated: these
// tests fix the emulation, the real saves (planet-parity) measure it.
import {describe,expect,it} from 'vitest';
import {unityLookRotation,quaternionRotate} from '../src/sim/verse-quaternion';
import {coreHeadingFromTo,tangentialVectorFacing,coreSphericalDistance,coreApproxDistanceInTiles,vector3ApproximatelyEqual} from '../src/sim/world-core-geometry';
import {worldSphericalHeading} from '../src/sim/world-spherical-heading';
import type {Vector3} from '../src/sim/verse-vector';
const f=Math.fround;
/** Unity's longitude/latitude convention: longitude atan2(x, −z). */
const at=(latitude:number,longitude:number):Vector3=>{const la=latitude*Math.PI/180,lo=longitude*Math.PI/180;return [f(100*Math.cos(la)*Math.sin(lo)),f(100*Math.sin(la)),f(-100*Math.cos(la)*Math.cos(lo))];};

describe('LookRotation emulation',()=>{
 it('forward +Z, up +Y: the identity (trace 3, root 2, w 1)',()=>{
  expect(unityLookRotation([0,0,1],[0,1,0])).toEqual([0,0,0,1]);
  expect(unityLookRotation([0,0,5],[0,10,0])).toEqual([0,0,0,1]);
 });
 it('forward +X, up +Y: a quarter turn about Y (basis x = −Z, y = +Y, z = +X)',()=>{
  const q=unityLookRotation([1,0,0],[0,1,0]);
  // Trace 1: w = ½√2, y = (m02 − m20)·(½ / √2) = 2·(½ / √2); then normalized.
  expect(q[0]).toBe(0);expect(q[2]).toBe(0);expect(q[1]).toBe(q[3]);
  expect(Math.abs(q[1]-Math.SQRT1_2)).toBeLessThan(2**-22);
  const forward=quaternionRotate(q,[0,0,1]);
  expect(Math.abs(forward[0]-1)).toBeLessThan(2**-22);expect(Math.abs(forward[2])).toBeLessThan(2**-22);
  expect(quaternionRotate(q,[0,1,0])).toEqual([0,1,0]);
 });
 it('forward parallel to up: the rotation from +Z to forward (Möller–Hughes)',()=>{
  // +Y: a quarter turn about −X; −Z: a half turn about X.
  const up=unityLookRotation([0,1,0],[0,1,0]);
  expect(up[1]).toBe(0);expect(up[2]).toBe(0);expect(up[0]).toBe(-up[3]);
  const back=unityLookRotation([0,0,-1],[0,0,1]);expect(back.map(Math.abs)).toEqual([1,0,0,0]);
  expect(unityLookRotation([0,0,0],[0,1,0])).toEqual([0,0,0,1]);
 });
 it('the managed rotation rounds each stored float, each component once',()=>{
  expect(quaternionRotate([0,0,0,1],[f(.1),f(.2),f(.3)])).toEqual([f(.1),f(.2),f(.3)]);
 });
});

describe('planet heading (PlanetLayer.GetHeadingFromTo)',()=>{
 const from:Vector3=[0,0,100];
 it('tangential frame facing north from a point of the equator',()=>{
  // LookRotation((0,0,100), (0,100,0)): z = +Z, x = up × z = +X, y = +Y.
  expect(tangentialVectorFacing(from,[0,100,0])).toEqual({forward:[0,1,0],right:[-1,0,0]});
 });
 it('north 0, then clockwise: west of +Z is +X at 270, −X at 90, south 180',()=>{
  expect(coreHeadingFromTo(from,[0,10,99.5],100)).toBe(0);
  expect(coreHeadingFromTo(from,[0,-10,99.5],100)).toBe(180);
  expect(coreHeadingFromTo(from,[10,0,99.5],100)).toBe(270);
  expect(Math.abs(coreHeadingFromTo(from,[-10,0,99.5],100)-90)).toBeLessThan(1e-5);
  expect(coreHeadingFromTo(from,from,100)).toBe(0);
 });
 it('agrees with the older tangent-frame heading to a few float steps',()=>{
  let worst=0;
  for(let a=0;a<40;a++){const p=at(-60+a*3,a*9-170),q=at(-55+a*2.5,a*7-160);const d=Math.abs(coreHeadingFromTo(p,q,100)-worldSphericalHeading(p,q));worst=Math.max(worst,Math.min(d,360-d));}
  expect(worst).toBeLessThan(1e-3);
 });
 it('spherical distance and distance in tiles',()=>{
  expect(vector3ApproximatelyEqual([1,2,3],[1,2,3.000001])).toBe(true);
  expect(coreSphericalDistance([0,0,1],[0,0,1])).toBe(0);
  expect(coreSphericalDistance([0,0,1],[1,0,0])).toBe(f(Math.PI/2));
  // π/2 rad × 100 / 2 per tile, one expression: 78.53982 tiles.
  expect(coreApproxDistanceInTiles([0,0,100],[100,0,0],100,2)).toBe(f(f(Math.PI/2)*100/2));
 });
});
