/** Planet geometry as RimWorld 1.6's surface layer computes it
 * (`PlanetLayer.GetHeadingFromTo`, `PlanetLayer.ApproxDistanceInTiles`,
 * `GenMath.SphericalDistance`), with the game's runtime precision (see
 * `verse-rand.ts`). Tile centres are the generated ones (geometry revision 2,
 * radius 100). Rewritten from the decompiled algorithms; pure.
 *
 * Used by the world generation steps that reproduce the game's (ancient sites
 * and ancient roads). The older steps keep `world-spherical-heading.ts` and
 * `world-surface-distances.ts`, unchanged. */
import {vector3Angle,vector3Normalized,type Vector3} from './verse-vector.ts';
import {unityLookRotation,quaternionRotate} from './verse-quaternion.ts';
const f=Math.fround;
const UP:Vector3=[0,1,0],LEFT:Vector3=[-1,0,0];
/** `Vector3.Dot`: one double expression, returned as a float. */
export const vector3Dot=(a:Vector3,b:Vector3)=>f(a[0]*b[0]+a[1]*b[1]+a[2]*b[2]);
/** Unity's `Vector3 ==`: componentwise differences stored, then their
 * squared length (one expression) under 9.9999994e-11. */
export function vector3ApproximatelyEqual(a:Vector3,b:Vector3):boolean {
 const x=f(a[0]-b[0]),y=f(a[1]-b[1]),z=f(a[2]-b[2]);
 return f(x*x+y*y+z*z)<f(9.9999994e-11);
}
/** `WorldRendererUtility.GetTangentialVectorFacing(root, pointToFace)`:
 * forward and right of `LookRotation(root, pointToFace)`. */
export function tangentialVectorFacing(root:Vector3,pointToFace:Vector3):{forward:Vector3;right:Vector3} {
 const q=unityLookRotation(root,pointToFace);
 return {forward:quaternionRotate(q,UP),right:quaternionRotate(q,LEFT)};
}
/** `PlanetLayer.GetHeadingFromTo(Vector3 from, Vector3 to)`: degrees
 * clockwise from north, in [0, 360). `radius` places the north pole. The
 * tile overload returns 0 for the same tile before reading centres. */
export function coreHeadingFromTo(from:Vector3,to:Vector3,radius:number):number {
 if(vector3ApproximatelyEqual(from,to))return 0;
 const north=tangentialVectorFacing(from,[0,f(radius),0]),target=tangentialVectorFacing(from,to);
 const angle=vector3Angle(north.forward,target.forward);
 return vector3Dot(target.forward,north.right)<0?f(360-angle):angle;
}
/** `GenMath.SphericalDistance(normalizedA, normalizedB)`: radians. */
export function coreSphericalDistance(normalizedA:Vector3,normalizedB:Vector3):number {
 if(vector3ApproximatelyEqual(normalizedA,normalizedB))return 0;
 return f(Math.acos(vector3Dot(normalizedA,normalizedB)));
}
/** `PlanetLayer.ApproxDistanceInTiles(float sphericalDistance)`. */
export function coreApproxDistanceFromSpherical(sphericalDistance:number,radius:number,averageTileSize:number):number {
 return f(sphericalDistance*f(radius)/averageTileSize);
}
/** `PlanetLayer.ApproxDistanceInTiles(tileA, tileB)` from the two centres. */
export function coreApproxDistanceInTiles(centerA:Vector3,centerB:Vector3,radius:number,averageTileSize:number):number {
 return coreApproxDistanceFromSpherical(coreSphericalDistance(vector3Normalized(centerA),vector3Normalized(centerB)),radius,averageTileSize);
}
