/** `UnityEngine.Vector3` operations the planet generator relies on, with the
 * game's runtime precision (see `verse-rand.ts`): an expression is evaluated
 * in double and rounded to float where it is stored or returned. */
const f=Math.fround;
export type Vector3=readonly [number,number,number];
/** `Vector3.sqrMagnitude`, returned as a float. */
const sqrMagnitude=(v:Vector3)=>f(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]);
/** `UnityEngine.Vector3.Angle(from, to)` in degrees. */
export function vector3Angle(from:Vector3,to:Vector3):number {
 const num=f(Math.sqrt(sqrMagnitude(from)*sqrMagnitude(to)));
 if(num<f(1e-15))return 0;
 const dot=f(from[0]*to[0]+from[1]*to[1]+from[2]*to[2]);
 const cos=Math.max(-1,Math.min(1,f(dot/num)));
 return f(f(Math.acos(cos))*f(57.29578));
}
/** `UnityEngine.Vector3.normalized`: zero below a 1e-5 magnitude. */
export function vector3Normalized(v:Vector3):Vector3 {
 const magnitude=f(Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]));
 return magnitude>f(1e-5)?[f(v[0]/magnitude),f(v[1]/magnitude),f(v[2]/magnitude)]:[0,0,0];
}

