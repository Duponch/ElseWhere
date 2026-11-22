/** RimWorld's random generator (`Verse.Rand`, Core 1.6.4871), rewritten from
 * the decompiled algorithm: a counter hashed with MurmurHash3's mixing steps,
 * a seed and an iteration count, a stack of saved states. Same draws in the
 * same order give the same values as the game.
 *
 * Floating point follows the game's runtime (Unity's Mono). Mono evaluates a
 * float expression in double precision and rounds to single precision only
 * where the value is stored: a local variable, a parameter, a field, an array
 * element, a returned value, or an explicit cast. `Math.fround` therefore
 * appears at those points and nowhere inside an expression. This model was
 * measured on real saves (`docs/development/planet-parity.md`): with plain
 * single precision, a few planet tiles differ.
 *
 * Pure and deterministic: no clock, no `Math.random`; each instance owns its
 * state. Nothing here touches a World. */
const f=Math.fround;

/** `Verse.MurmurHash.GetInt(seed, input)`: signed 32-bit result. */
export function murmurHashInt(seed:number,input:number):number {
 let k=Math.imul(input>>>0,0xcc9e2d51);
 k=Math.imul((k<<15)|(k>>>17),0x1b873593);
 let h=(seed>>>0)^k;
 h=(Math.imul((h<<13)|(h>>>19),5)+0xe6546b64)|0;
 h^=0xa8f3b65a;
 h^=h>>>16;h=Math.imul(h,0x85ebca6b);
 h^=h>>>13;h=Math.imul(h,0xc2b2ae35);
 return (h^(h>>>16))|0;
}
/** `Verse.GenText.StableStringHash`: 23, then ×31 + UTF-16 code unit, signed
 * 32-bit wrap; 0 for a missing string. */
export function stableStringHash(text:string|null):number {
 if(text===null)return 0;
 let hash=23;for(let i=0;i<text.length;i++)hash=(Math.imul(hash,31)+text.charCodeAt(i))|0;return hash;
}
/** `Verse.Gen.HashCombineInt(int seed, int value)`. */
export function hashCombineInt(seed:number,value:number):number {
 seed|=0;value|=0;
 // value + 2654435769u + (seed << 6) + (seed >> 2): exact in double, then
 // the low 32 bits are kept, as the game's 64-bit sum cast to int.
 return (seed^(value+2654435769+(seed<<6)+(seed>>2)))|0;
}
/** `Mathf.RoundToInt` on a float: round half to even. */
export function roundToInt(value:number):number {
 const lower=Math.floor(value),part=value-lower;
 return part<.5?lower:part>.5?lower+1:lower%2===0?lower:lower+1;
}
export interface VerseRandState {readonly seed:number;readonly iterations:number}
/** Curve points as `Verse.SimpleCurve` holds them (x ascending). */
export type CurvePoints=readonly (readonly [number,number])[];

export class VerseRand {
 #seed:number;#iterations=0;readonly #stack:VerseRandState[]=[];
 /** The game seeds its static generator from the clock at start; here the
  * initial seed is explicit. */
 constructor(seed=0){this.#seed=seed>>>0;}
 static fromState(state:VerseRandState):VerseRand {
  if(!Number.isInteger(state.seed)||state.seed<0||state.seed>0xffffffff||!Number.isInteger(state.iterations)||state.iterations<0||state.iterations>0xffffffff)throw Error('Invalid Verse random state');
  const r=new VerseRand(state.seed);r.#iterations=state.iterations;return r;
 }
 /** `Rand.Seed = value`: the iteration count restarts at 0. */
 set seed(value:number){if(!Number.isInteger(value))throw Error('Invalid Verse random seed');this.#seed=value>>>0;this.#iterations=0;}
 get state():VerseRandState {return {seed:this.#seed,iterations:this.#iterations};}
 /** `Rand.Int`. */
 get int():number {const result=murmurHashInt(this.#seed,this.#iterations);this.#iterations=(this.#iterations+1)>>>0;return result;}
 /** `Rand.Value`: [0, 1] in single precision. */
 get value():number {return f((this.int+2147483648)/4294967295);}
 get bool():boolean {return this.value<.5;}
 get sign():number {return this.bool?1:-1;}
 /** `Rand.Range(int, int)`: maximum excluded. */
 range(minInclusive:number,maxExclusive:number):number {
  if(maxExclusive<=minInclusive)return minInclusive;
  return (minInclusive+Math.abs(this.int%((maxExclusive-minInclusive)|0)))|0;
 }
 rangeInclusive(minInclusive:number,maxInclusive:number):number {
  if(maxInclusive<=minInclusive)return minInclusive;
  return this.range(minInclusive,maxInclusive+1);
 }
 /** `Rand.Range(float, float)`: `Value * (max − min) + min`. */
 rangeFloat(minInclusive:number,maxInclusive:number):number {
  minInclusive=f(minInclusive);maxInclusive=f(maxInclusive);
  if(maxInclusive<=minInclusive)return minInclusive;
  return f(this.value*(maxInclusive-minInclusive)+minInclusive);
 }
 chance(chance:number):boolean {
  chance=f(chance);if(chance<=0)return false;if(chance>=1)return true;return this.value<chance;
 }
 /** `Rand.Gaussian`: Box–Muller from two draws. */
 gaussian(centerX=0,widthFactor=1):number {
  const a=this.value,b=this.value;
  return f(gaussianFactor(a,b)*f(widthFactor)+f(centerX));
 }
 gaussianAsymmetric(centerX=0,lowerWidthFactor=1,upperWidthFactor=1):number {
  // `float num = …`: the product is stored, hence rounded, before the test.
  const a=this.value,b=this.value,n=f(gaussianFactor(a,b));
  return n<=0?f(n*f(lowerWidthFactor)+f(centerX)):f(n*f(upperWidthFactor)+f(centerX));
 }
 /** `Rand.Element(params T[])`: one value, then an integer range. */
 element<T>(list:readonly T[]):T {
  const value=this.value;return list[this.range(0,roundToInt(f(value*list.length)))]!;
 }
 /** `Rand.ElementByWeight(a, wa, b, wb, …)` for two to six options. */
 elementByWeight<T>(...pairs:readonly (readonly [T,number])[]):T {
  if(pairs.length<2||pairs.length>6)throw Error('Verse ElementByWeight takes two to six options');
  const total=pairsTotal(pairs),value=this.value;
  for(let i=0;i<pairs.length-1;i++)if(value<partialSum(pairs,i)/total)return pairs[i]![0];
  return pairs[pairs.length-1]![0];
 }
 pushState(replacementSeed?:number):void {
  this.#stack.push({seed:this.#seed,iterations:this.#iterations});
  if(replacementSeed!==undefined)this.seed=replacementSeed;
 }
 popState():void {
  const state=this.#stack.pop();if(!state)throw Error('Verse random state stack is empty');
  this.#seed=state.seed;this.#iterations=state.iterations;
 }
 get stackDepth():number {return this.#stack.length;}
 valueSeeded(specialSeed:number):number {this.pushState(specialSeed);const v=this.value;this.popState();return v;}
 chanceSeeded(chance:number,specialSeed:number):boolean {this.pushState(specialSeed);const v=this.chance(chance);this.popState();return v;}
 rangeSeeded(minInclusive:number,maxExclusive:number,specialSeed:number):number {this.pushState(specialSeed);const v=this.range(minInclusive,maxExclusive);this.popState();return v;}
 rangeFloatSeeded(minInclusive:number,maxInclusive:number,specialSeed:number):number {this.pushState(specialSeed);const v=this.rangeFloat(minInclusive,maxInclusive);this.popState();return v;}
 rangeInclusiveSeeded(minInclusive:number,maxInclusive:number,specialSeed:number):number {this.pushState(specialSeed);const v=this.rangeInclusive(minInclusive,maxInclusive);this.popState();return v;}
 /** `Rand.ByCurve`: a value distributed by a curve whose ends are 0. */
 byCurve(points:CurvePoints):number {
  if(points.length<3)throw Error('curve has < 3 points');
  if(f(points[0]![1])!==0||f(points[points.length-1]![1])!==0)throw Error('curve has start/end point with y != 0');
  const x=(i:number)=>f(points[i]![0]),y=(i:number)=>f(points[i]![1]);
  let total=0;
  for(let i=0;i<points.length-1;i++){if(y(i)<0)throw Error('curve has point with y < 0');total=f(total+(x(i+1)-x(i))*(y(i)+y(i+1)));}
  let target=this.rangeFloat(0,total);
  for(let j=0;j<points.length-1;j++){
   const area=f((x(j+1)-x(j))*(y(j)+y(j+1)));
   if(area<target){target=f(target-area);continue;}
   const width=f(x(j+1)-x(j)),y0=y(j),y1=y(j+1);
   let along=f(target/(y0+y1));
   if(this.rangeFloat(0,f((y0+y1)/2))>monoLerp(y0,y1,f(along/width)))along=f(width-along);
   return f(along+x(j));
  }
  throw Error('Reached end of Rand.ByCurve without choosing a point.');
 }
 /** `GenCollection.RandomElement` on a list. */
 randomElement<T>(list:readonly T[]):T|undefined {return list.length?list[this.range(0,list.length)]:undefined;}
 /** `GenCollection.RandomElementByWeight` on a list (undefined when every
  * weight is zero, where the game logs an error). */
 randomElementByWeight<T>(list:readonly T[],weight:(item:T)=>number):T|undefined {
  let total=0;for(const item of list)total=f(total+Math.max(0,f(weight(item))));
  if(list.length===1&&total>0)return list[0];
  if(total<=0)return undefined;
  const target=f(this.value*total);let sum=0;
  for(const item of list){const w=f(weight(item));if(w<=0)continue;sum=f(sum+w);if(sum>=target)return item;}
  return undefined;
 }
 /** `GenCollection.TryRandomElementByWeight` on a list, including the game's
  * second pass when the first one runs out by rounding. */
 tryRandomElementByWeight<T>(list:readonly T[],weight:(item:T)=>number):{found:true;value:T}|{found:false} {
  let total=0;for(const item of list)total=f(total+Math.max(0,f(weight(item))));
  if(list.length===1&&total>0)return {found:true,value:list[0]!};
  if(total===0)return {found:false};
  total=f(total*this.value);
  for(const item of list){const w=f(weight(item));if(w<=0)continue;total=f(total-w);if(total<=0)return {found:true,value:item};}
  let at=0,result:T|undefined,sum=0;
  for(;sum===0&&at<list.length;at++){result=list[at];sum=Math.max(0,f(weight(result!)));}
  if(sum===0)return {found:false};
  for(;at<list.length;at++){const item=list[at]!,w=Math.max(0,f(weight(item)));if(this.rangeFloat(0,f(sum+w))>=sum)result=item;sum=f(sum+w);}
  return {found:true,value:result!};
 }
 /** `Rand.MTBEventOccurs`. */
 mtbEventOccurs(mtb:number,mtbUnit:number,ticksSinceLastCheck:number):boolean {
  mtb=f(mtb);mtbUnit=f(mtbUnit);ticksSinceLastCheck=f(ticksSinceLastCheck);
  if(mtb===Infinity)return false;if(mtb===0)return true;if(mtb<0)return true;if(mtbUnit<=0||ticksSinceLastCheck<=0)return false;
  let chance=ticksSinceLastCheck/(mtb*mtbUnit);if(chance<=0)return false;
  let gate=1;
  if(chance<1e-4){while(chance<1e-4){chance*=8;gate/=8;}if(this.value>gate)return false;}
  return this.value<chance;
 }
}
function gaussianFactor(a:number,b:number):number {
 // Mathf.Sqrt(-2f * Mathf.Log(a)) * Mathf.Sin(2π_f * b): each Mathf call takes
 // and returns a float.
 return f(Math.sqrt(f(-2*f(Math.log(a)))))*f(Math.sin(f(f(Math.PI*2)*b)));
}
function pairsTotal(pairs:readonly (readonly [unknown,number])[]):number {
 // `float num = wA + wB + …`: one expression, rounded once when stored.
 let sum=0;for(const [,w] of pairs)sum+=f(w);return f(sum);
}
function partialSum(pairs:readonly (readonly [unknown,number])[],last:number):number {
 // `(wA + wB + …)` inside the comparison: never stored, kept in double.
 let sum=0;for(let i=0;i<=last;i++)sum+=f(pairs[i]![1]);return sum;
}
/** `Mathf.Lerp(a, b, t)` returned as a float. */
export function monoLerp(a:number,b:number,t:number):number {return f(a+(b-a)*Math.max(0,Math.min(1,t)));}
/** `Verse.SimpleCurve.Evaluate(x)`: clamps outside the points, linear between. */
export function simpleCurveEvaluate(points:CurvePoints,x:number):number {
 if(!points.length)return 0;
 x=f(x);
 if(x<=f(points[0]![0]))return f(points[0]![1]);
 const last=points[points.length-1]!;if(x>=f(last[0]))return f(last[1]);
 let a=points[0]!,b=last;
 for(let i=0;i<points.length;i++)if(x<=f(points[i]![0])){b=points[i]!;if(i>0)a=points[i-1]!;break;}
 const t=f((x-f(a[0]))/(f(b[0])-f(a[0])));
 return monoLerp(f(a[1]),f(b[1]),t);
}
