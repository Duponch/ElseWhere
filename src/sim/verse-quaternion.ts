/** The two quaternion operations the planet's headings rely on
 * (`WorldRendererUtility.GetTangentialVectorFacing`, then
 * `PlanetLayer.GetHeadingFromTo`).
 *
 * - `Quaternion.LookRotation` is native code in Unity's engine, not managed
 *   code: it is emulated here in plain single precision (every operation
 *   rounded), following the engine's documented construction: an orthonormal
 *   basis (z = forward normalized, x = up × z normalized, y = z × x) turned
 *   into a quaternion by Shoemake's trace method, then normalized; when the
 *   basis cannot be built (forward and up parallel), the rotation from +Z to
 *   forward (Möller–Hughes). The engine's source is not public: this
 *   emulation is measured, not proven, to give the game's headings
 *   (`docs/development/planet-parity.md`).
 * - `Quaternion * Vector3` is managed (UnityEngine.CoreModule) and follows the
 *   game's runtime precision (see `verse-rand.ts`): each named float is
 *   rounded where it is stored, each component expression is evaluated in
 *   double and rounded once.
 *
 * Pure; nothing here touches a World. */
import type {Vector3} from './verse-vector.ts';
const f=Math.fround;
export type Quaternion=readonly [x:number,y:number,z:number,w:number];

const dot3=(a:Vector3,b:Vector3)=>f(f(f(a[0]*b[0])+f(a[1]*b[1]))+f(a[2]*b[2]));
const cross3=(a:Vector3,b:Vector3):Vector3=>[f(f(a[1]*b[2])-f(a[2]*b[1])),f(f(a[2]*b[0])-f(a[0]*b[2])),f(f(a[0]*b[1])-f(a[1]*b[0]))];
const divide3=(a:Vector3,s:number):Vector3=>[f(a[0]/s),f(a[1]/s),f(a[2]/s)];
const EPSILON=f(.00001);

/** Row-major 3×3 matrix, `m[row*3+column]`. */
type Matrix3=readonly number[];
/** Shoemake's trace method, then normalization; single precision. */
function matrixToQuaternion(m:Matrix3):Quaternion {
 const at=(r:number,c:number)=>m[r*3+c]!;
 const q=[0,0,0,0];
 const trace=f(f(at(0,0)+at(1,1))+at(2,2));
 if(trace>0){
  let root=f(Math.sqrt(f(trace+1)));
  q[3]=f(.5*root);root=f(.5/root);
  q[0]=f(f(at(2,1)-at(1,2))*root);q[1]=f(f(at(0,2)-at(2,0))*root);q[2]=f(f(at(1,0)-at(0,1))*root);
 } else {
  const next=[1,2,0];let i=0;
  if(at(1,1)>at(0,0))i=1;
  if(at(2,2)>at(i,i))i=2;
  const j=next[i]!,k=next[j]!;
  let root=f(Math.sqrt(f(f(f(at(i,i)-at(j,j))-at(k,k))+1)));
  q[i]=f(.5*root);root=f(.5/root);
  q[3]=f(f(at(k,j)-at(j,k))*root);
  q[j]=f(f(at(j,i)+at(i,j))*root);
  q[k]=f(f(at(k,i)+at(i,k))*root);
 }
 const magnitude=f(Math.sqrt(f(f(f(f(q[0]!*q[0]!)+f(q[1]!*q[1]!))+f(q[2]!*q[2]!))+f(q[3]!*q[3]!))));
 return [f(q[0]!/magnitude),f(q[1]!/magnitude),f(q[2]!/magnitude),f(q[3]!/magnitude)];
}
/** Rotation taking the unit vector `from` to the unit vector `to`
 * (Möller–Hughes), single precision. */
function fromToRotation(from:Vector3,to:Vector3):Matrix3 {
 const v=cross3(from,to),e=dot3(from,to),limit=f(.000001);
 if(e>f(1-limit))return [1,0,0,0,1,0,0,0,1];
 if(e<f(-1+limit)){
  let left:Vector3=[0,from[2],f(-from[1])];
  if(dot3(left,left)<limit)left=[f(-from[2]),0,from[0]];
  const inverse=f(1/f(Math.sqrt(dot3(left,left))));
  left=[f(left[0]*inverse),f(left[1]*inverse),f(left[2]*inverse)];
  const up=cross3(left,from);
  const p=(a:number,b:number)=>f(a*b),n=(a:number,b:number)=>f(f(-a)*b);
  const fxx=n(from[0],from[0]),fyy=n(from[1],from[1]),fzz=n(from[2],from[2]),fxy=n(from[0],from[1]),fxz=n(from[0],from[2]),fyz=n(from[1],from[2]);
  const uxx=p(up[0],up[0]),uyy=p(up[1],up[1]),uzz=p(up[2],up[2]),uxy=p(up[0],up[1]),uxz=p(up[0],up[2]),uyz=p(up[1],up[2]);
  const lxx=n(left[0],left[0]),lyy=n(left[1],left[1]),lzz=n(left[2],left[2]),lxy=n(left[0],left[1]),lxz=n(left[0],left[2]),lyz=n(left[1],left[2]);
  const s=(a:number,b:number,c:number)=>f(f(a+b)+c);
  const m01=s(fxy,uxy,lxy),m02=s(fxz,uxz,lxz),m12=s(fyz,uyz,lyz);
  return [s(fxx,uxx,lxx),m01,m02,m01,s(fyy,uyy,lyy),m12,m02,m12,s(fzz,uzz,lzz)];
 }
 const h=f(f(1-e)/dot3(v,v)),hvx=f(h*v[0]),hvz=f(h*v[2]),hvxy=f(hvx*v[1]),hvxz=f(hvx*v[2]),hvyz=f(hvz*v[1]);
 return [f(e+f(hvx*v[0])),f(hvxy-v[2]),f(hvxz+v[1]),
  f(hvxy+v[2]),f(e+f(f(h*v[1])*v[1])),f(hvyz-v[0]),
  f(hvxz-v[1]),f(hvyz+v[0]),f(e+f(hvz*v[2]))];
}
/** `UnityEngine.Quaternion.LookRotation(forward, upwards)` (native engine
 * code, emulated; see the module note). */
export function unityLookRotation(forward:Vector3,upwards:Vector3):Quaternion {
 const forwardMagnitude=f(Math.sqrt(dot3(forward,forward)));
 if(forwardMagnitude>=EPSILON){
  const z=divide3(forward,forwardMagnitude),side=cross3(upwards,z),sideMagnitude=f(Math.sqrt(dot3(side,side)));
  if(sideMagnitude>=EPSILON){
   const x=divide3(side,sideMagnitude),y=cross3(z,x);
   if(Math.abs(f(dot3(y,y)-1))<=f(.000001))
    return matrixToQuaternion([x[0],y[0],z[0],x[1],y[1],z[1],x[2],y[2],z[2]]);
  }
  return matrixToQuaternion(fromToRotation([0,0,1],divide3(forward,forwardMagnitude)));
 }
 return [0,0,0,1];
}
/** `Quaternion * Vector3` (managed, game runtime precision). */
export function quaternionRotate(q:Quaternion,point:Vector3):Vector3 {
 const [x,y,z,w]=q,num=f(x*2),num2=f(y*2),num3=f(z*2),num4=f(x*num),num5=f(y*num2),num6=f(z*num3);
 const num7=f(x*num2),num8=f(x*num3),num9=f(y*num3),num10=f(w*num),num11=f(w*num2),num12=f(w*num3);
 const [px,py,pz]=point;
 return [f((1-(num5+num6))*px+(num7-num12)*py+(num8+num11)*pz),
  f((num7+num12)*px+(1-(num4+num6))*py+(num9-num10)*pz),
  f((num8-num11)*px+(num9+num10)*py+(1-(num4+num5))*pz)];
}
