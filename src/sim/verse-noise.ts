/** RimWorld's coherent noise modules (`Verse.Noise`, Core 1.6.4871), the
 * LibNoise design the planet generator builds on, rewritten from the
 * decompiled algorithms: each module computes a double from (x, y, z) and its
 * source modules. The gradient noise itself is `coherentWorldNoise` (same
 * lattice hash, gradient table, interpolation and coordinate wrap as the
 * game's `Utils.GradientCoherentNoise3D` and `MakeInt32Range`).
 *
 * Float parts (angles, curves) follow the game's runtime precision: see
 * `verse-rand.ts`. Pure: no World, no random generator. */
import {coherentWorldNoise,worldNoiseCoordinate,type NoiseQuality} from './world-coherent-noise.ts';
import {simpleCurveEvaluate,type CurvePoints} from './verse-rand.ts';
import {vector3Angle,type Vector3} from './verse-vector.ts';
export {vector3Angle,type Vector3};
const f=Math.fround;
export interface NoiseModule {getValue(x:number,y:number,z:number):number}
/** `ModuleBase.GetValue(Vector3)`: the coordinates widen to double, the
 * result is cast to float. */
export function noiseAt(module:NoiseModule,point:Vector3):number {return f(module.getValue(point[0],point[1],point[2]));}

const QUALITY:readonly NoiseQuality[]=['low','medium','high'];
export type VerseQuality=0|1|2;
export const QualityMode={Low:0,Medium:1,High:2} as const;
const clampOctaves=(octaves:number)=>Math.max(1,Math.min(30,octaves|0));

/** `Verse.Noise.Perlin`: octaves of gradient noise, seeds `seed + octave`. */
export class Perlin implements NoiseModule {
 readonly octaves:number;readonly #quality:NoiseQuality;
 constructor(readonly frequency:number,readonly lacunarity:number,readonly persistence:number,octaves:number,readonly seed:number,quality:VerseQuality,readonly normalized=false,readonly invert=false){
  this.octaves=clampOctaves(octaves);this.#quality=QUALITY[quality]!;
 }
 getValue(x:number,y:number,z:number):number {
  let result=0,amplitude=1;x*=this.frequency;y*=this.frequency;z*=this.frequency;
  for(let i=0;i<this.octaves;i++){
   const signal=coherentWorldNoise(worldNoiseCoordinate(x),worldNoiseCoordinate(y),worldNoiseCoordinate(z),((this.seed+i)>>>0),this.#quality);
   result+=signal*amplitude;x*=this.lacunarity;y*=this.lacunarity;z*=this.lacunarity;amplitude*=this.persistence;
  }
  if(this.normalized){result=result*.5+.5;if(result<0)result=0;if(result>1)result=1;}
  return this.invert?1-result:result;
 }
}
/** `Verse.Noise.RidgedMultifractal`: weights 1/lacunarity^octave, each
 * octave weighted by the previous signal, seeds `(seed + octave) & 0x7fffffff`. */
export class RidgedMultifractal implements NoiseModule {
 readonly octaves:number;readonly #quality:NoiseQuality;readonly #weights:Float64Array;
 constructor(readonly frequency:number,readonly lacunarity:number,octaves:number,readonly seed:number,quality:VerseQuality){
  this.octaves=clampOctaves(octaves);this.#quality=QUALITY[quality]!;this.#weights=new Float64Array(30);
  let frequencyPower=1;for(let i=0;i<30;i++){this.#weights[i]=Math.pow(frequencyPower,-1);frequencyPower*=lacunarity;}
 }
 getValue(x:number,y:number,z:number):number {
  x*=this.frequency;y*=this.frequency;z*=this.frequency;let total=0,weight=1;
  for(let i=0;i<this.octaves;i++){
   let signal=coherentWorldNoise(worldNoiseCoordinate(x),worldNoiseCoordinate(y),worldNoiseCoordinate(z),(this.seed+i)&0x7fffffff,this.#quality);
   signal=Math.abs(signal);signal=1-signal;signal*=signal;signal*=weight;
   weight=signal*2;if(weight>1)weight=1;if(weight<0)weight=0;
   total+=signal*this.#weights[i]!;x*=this.lacunarity;y*=this.lacunarity;z*=this.lacunarity;
  }
  return total*1.25-1;
 }
}
export class Const implements NoiseModule {constructor(readonly value:number){}getValue():number{return this.value;}}
export class ScaleBias implements NoiseModule {
 constructor(readonly scale:number,readonly bias:number,readonly input:NoiseModule){}
 getValue(x:number,y:number,z:number):number {return this.input.getValue(x,y,z)*this.scale+this.bias;}
}
/** Linear interpolation of two sources, the controller mapped from [−1, 1]. */
export class Blend implements NoiseModule {
 constructor(readonly lhs:NoiseModule,readonly rhs:NoiseModule,readonly controller:NoiseModule){}
 getValue(x:number,y:number,z:number):number {
  const a=this.lhs.getValue(x,y,z),b=this.rhs.getValue(x,y,z),position=(this.controller.getValue(x,y,z)+1)/2;
  return (1-position)*a+position*b;
 }
}
export class Multiply implements NoiseModule {
 constructor(readonly lhs:NoiseModule,readonly rhs:NoiseModule){}
 getValue(x:number,y:number,z:number):number {return this.lhs.getValue(x,y,z)*this.rhs.getValue(x,y,z);}
}
export class Power implements NoiseModule {
 constructor(readonly lhs:NoiseModule,readonly rhs:NoiseModule){}
 getValue(x:number,y:number,z:number):number {return Math.pow(this.lhs.getValue(x,y,z),this.rhs.getValue(x,y,z));}
}
export class Abs implements NoiseModule {constructor(readonly input:NoiseModule){}getValue(x:number,y:number,z:number):number{return Math.abs(this.input.getValue(x,y,z));}}
export class OneMinus implements NoiseModule {constructor(readonly input:NoiseModule){}getValue(x:number,y:number,z:number):number{return 1-this.input.getValue(x,y,z);}}
/** 1 inside [from, to], else 0. */
export class Filter implements NoiseModule {
 readonly from:number;readonly to:number;
 constructor(readonly input:NoiseModule,from:number,to:number){this.from=f(from);this.to=f(to);}
 getValue(x:number,y:number,z:number):number {const v=this.input.getValue(x,y,z);return v>=this.from&&v<=this.to?1:0;}
}
export class Clamp implements NoiseModule {
 #min:number;#max:number;
 constructor(min:number,max:number,readonly input:NoiseModule){this.#min=min;this.#max=max;}
 getValue(x:number,y:number,z:number):number {
  // The game swaps reversed bounds in place on first use.
  if(this.#min>this.#max){const min=this.#min;this.#min=this.#max;this.#max=min;}
  const v=this.input.getValue(x,y,z);return v<this.#min?this.#min:v>this.#max?this.#max:v;
 }
}
/** (v − from) / (to − from), clamped to [0, 1]. */
export class InverseLerp implements NoiseModule {
 readonly from:number;readonly to:number;
 constructor(readonly input:NoiseModule,from:number,to:number){this.from=f(from);this.to=f(to);}
 getValue(x:number,y:number,z:number):number {
  const v=(this.input.getValue(x,y,z)-this.from)/(this.to-this.from);return v<0?0:v>1?1:v;
 }
}
export class Arbitrary implements NoiseModule {
 constructor(readonly input:NoiseModule,readonly processor:(value:number)=>number){}
 getValue(x:number,y:number,z:number):number {return this.processor(this.input.getValue(x,y,z));}
}
/** A `SimpleCurve` applied to the source value cast to float. */
export class CurveSimple implements NoiseModule {
 constructor(readonly input:NoiseModule,readonly curve:CurvePoints){}
 getValue(x:number,y:number,z:number):number {return simpleCurveEvaluate(this.curve,f(this.input.getValue(x,y,z)));}
}
/** A curve of the absolute latitude in degrees, on a sphere of this radius. */
export class AbsLatitudeCurve implements NoiseModule {
 readonly planetRadius:number;
 constructor(readonly curve:CurvePoints,planetRadius:number){this.planetRadius=f(planetRadius);}
 getValue(_x:number,y:number,_z:number):number {
  const latitude=f(f(Math.asin(f(y/this.planetRadius)))*f(57.29578));
  return simpleCurveEvaluate(this.curve,Math.abs(latitude));
 }
}
/** Angle from the view centre over the view angle, at most 1 (inverted on
 * request). */
export class DistanceFromPlanetViewCenter implements NoiseModule {
 readonly viewAngle:number;
 constructor(readonly viewCenter:Vector3,viewAngle:number,readonly invert=false){this.viewAngle=f(viewAngle);}
 getValue(x:number,y:number,z:number):number {
  const value=this.viewAngle>=180?0:Math.min(f(vector3Angle(this.viewCenter,[f(x),f(y),f(z)])/this.viewAngle),1);
  // `1f - valueInt` is returned as a double, never stored as a float.
  return this.invert?1-value:value;
 }
}
/** Lowers the source towards the edge of the generated part of the planet,
 * which then becomes ocean. */
export class ConvertToIsland implements NoiseModule {
 readonly viewAngle:number;
 constructor(readonly viewCenter:Vector3,viewAngle:number,readonly input:NoiseModule){this.viewAngle=f(viewAngle);}
 getValue(x:number,y:number,z:number):number {
  const angle=vector3Angle(this.viewCenter,[f(x),f(y),f(z)]),value=this.input.getValue(x,y,z),view=this.viewAngle;
  const inner=f(Math.max(2.5,view*.25)),outer=f(Math.max(f(.8),f(view*f(.1))));
  if(angle<view-inner)return value;
  // GenMath.LerpDouble(view − inner, view − outer, 0, 0.62, angle).
  const from=f(view-inner),to=f(view-outer),t=f((angle-from)/(to-from)),edge=f(0+(f(.62)-0)*t);
  const waterLevel=f(-.12);
  if(value>waterLevel)return (value-waterLevel)*(1-edge*f(.7))-edge*f(.3)+waterLevel;
  return value-edge*f(.3);
 }
}
