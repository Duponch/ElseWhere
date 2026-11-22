/** The planet's terrain step as the game runs it (`WorldGenStep_Terrain`,
 * Core 1.6.4871), rewritten from the decompiled algorithm: the same noise
 * modules built in the same order from the same random draws, then each tile
 * in tile order (elevation, relief with its random draws, temperature,
 * rainfall, swampiness, biome by the biome workers' scores).
 *
 * The random generator is seeded as the game's world generator seeds this
 * step: `HashCombineInt(StableStringHash(seed), 83469557)`, the step being
 * the first of the surface layer. Float precision follows the game's runtime
 * (see `verse-rand.ts`). Measured tile by tile on real saves in
 * `docs/development/planet-parity.md`.
 *
 * Pure: the caller owns the tile loop and the generated values. */
import {VerseRand,stableStringHash,hashCombineInt,simpleCurveEvaluate,monoLerp} from './verse-rand.ts';
import {Perlin,RidgedMultifractal,Const,ScaleBias,Blend,Multiply,Power,Abs,OneMinus,Filter,Clamp,InverseLerp,Arbitrary,CurveSimple,AbsLatitudeCurve,DistanceFromPlanetViewCenter,ConvertToIsland,QualityMode,noiseAt,vector3Angle,type NoiseModule,type Vector3} from './verse-noise.ts';
import {surfaceViewAngle,surfaceVisibilityAxis} from './world-surface-mesh.ts';
import {worldClimateCurvePoints,validateWorldClimateSettings,type WorldClimateSettings} from './world-climate-settings.ts';
import {worldSphericalHeading} from './world-spherical-heading.ts';
import type {WorldRelief} from './world-climate-evaluation.ts';
import type {WorldBiome} from './world-biome-selection.ts';
const f=Math.fround;

/** `WorldGenStep_Terrain.SeedPart`. */
export const CORE_TERRAIN_SEED_PART=83469557;
const AVG_TEMP_BY_LATITUDE=[[0,30],[.1,29],[.5,7],[1,-37]] as const;
const RAIN_BY_LATITUDE=[[0,1.12],[25,.94],[45,.7],[70,.3],[80,.05],[90,.05]] as const;
const MAX_INT=2147483647;

/** A cache of the last coordinate, as LibNoise's `Cache` module: the value is
 * the source's, only computed once when several modules read it. */
class LastPoint implements NoiseModule {
 #x=NaN;#y=NaN;#z=NaN;#value=0;
 constructor(readonly input:NoiseModule){}
 getValue(x:number,y:number,z:number):number {
  if(x!==this.#x||y!==this.#y||z!==this.#z){this.#value=this.input.getValue(x,y,z);this.#x=x;this.#y=y;this.#z=z;}
  return this.#value;
 }
}
export interface CoreTerrainTile {
 elevation:number;hilliness:WorldRelief;temperature:number;rainfall:number;swampiness:number;biome:Exclude<WorldBiome,'lake'>;
}
/** Biome definitions of the game in database order, with their workers'
 * scores. Underground does not generate naturally; Lake shares the ocean's
 * score and comes later, so it never wins here (lakes come from a later step). */
const CORE_BIOMES=['boreal-forest','tundra','cold-bog','ice-sheet','sea-ice','temperate-forest','temperate-swamp','tropical-rainforest','tropical-swamp','arid-shrubland','desert','extreme-desert','ocean'] as const;
interface ScoredTile {elevation:number;temperature:number;rainfall:number;swampiness:number}
/** `BiomeWorker.GetScore` of each Core biome; each score is a float result of
 * one expression. `seaIceAllowed` is the sea-ice worker's position test. */
export function coreBiomeScore(biome:Exclude<WorldBiome,'lake'>,tile:ScoredTile,seaIceAllowed:()=>boolean):number {
 const water=tile.elevation<=0,t=tile.temperature,r=tile.rainfall,s=tile.swampiness;
 const permaIce=()=>f(-20+(0-t)*2);
 if(biome==='ocean')return water?0:-100;
 if(biome==='sea-ice')return !water||!seaIceAllowed()?-100:f(permaIce()-23);
 if(water)return -100;
 switch(biome){
  case 'boreal-forest':return t<-10||r<600?0:15;
  case 'tundra':return f(0-t);
  case 'cold-bog':return t<-10||s<.5?0:f(0-t+13+s*8);
  case 'ice-sheet':return permaIce();
  case 'temperate-forest':return t>=-10&&r>=600?f(15+(t-7)+(r-600)/180):0;
  case 'temperate-swamp':return t<-10||r<600||s<.5?0:f(15+(t-7)+(r-600)/180+s*3);
  case 'tropical-rainforest':return t<15||r<2000?0:f(28+(t-20)*1.5+(r-600)/165);
  case 'tropical-swamp':return t>=15&&t<=55&&r>=2000&&s>=.5?f(28+(t-20)*1.5+(r-600)/165+s*3):0;
  case 'arid-shrubland':return t<-10||r<600||r>=2000?0:f(22.5+(t-20)*f(2.2)+(r-600)/100);
  case 'desert':return r>=600?0:f(t+f(1e-4));
  case 'extreme-desert':return r>=340?0:f(t*f(2.7)-13-r*f(.14));
 }
}

export interface CoreTerrainStep {
 readonly rootSeed:number;readonly random:VerseRand;
 /** Tiles must be generated in increasing order from 0: relief draws share
  * one random stream. */
 generateTile(tileId:number,center:Vector3):CoreTerrainTile;
}
export function createCoreTerrainStep(seedText:string,sourceSettings:WorldClimateSettings):CoreTerrainStep {
 if(typeof seedText!=='string'||!validateWorldClimateSettings(sourceSettings))throw Error('Invalid world generation settings');
 const settings={...sourceSettings},rootSeed=stableStringHash(seedText),random=new VerseRand();
 random.seed=hashCombineInt(rootSeed,CORE_TERRAIN_SEED_PART);
 const coverage=f(settings.coverage),viewAngle=surfaceViewAngle(settings.coverage),viewCenter=surfaceVisibilityAxis(settings.coverage);
 const seed=()=>random.range(0,MAX_INT);
 // SetupElevationNoise
 const micro=new Perlin(f(.035),2,f(.4),6,seed(),QualityMode.High);
 let ridged:NoiseModule=new RidgedMultifractal(f(.012),2,6,seed(),QualityMode.High);
 let macroFactor:NoiseModule=new Perlin(f(.12),2,.5,5,seed(),QualityMode.High);
 let continents:NoiseModule=new Perlin(f(.01),2,.5,5,seed(),QualityMode.High);
 let continentBlend:number;
 if(coverage<f(.55)){
  const island=new ScaleBias(2,-1,new DistanceFromPlanetViewCenter(viewCenter,viewAngle,true));
  continents=new Blend(continents,island,new Const(f(.4)));
  continentBlend=random.rangeFloat(-.4,-.35);
 }else continentBlend=random.rangeFloat(.15,.25);
 macroFactor=new ScaleBias(.5,.5,macroFactor);
 ridged=new Multiply(ridged,macroFactor);
 const microRidgedBlend=random.rangeFloat(.4,.6);
 let elevation:NoiseModule=new Blend(micro,ridged,new Const(microRidgedBlend));
 elevation=new Blend(elevation,continents,new Const(continentBlend));
 if(coverage<f(.9999))elevation=new ConvertToIsland(viewCenter,viewAngle,elevation);
 elevation=new ScaleBias(.5,.5,elevation);
 elevation=new Power(elevation,new Const(3));
 elevation=new LastPoint(new ScaleBias(5500,-500,elevation));
 // SetupTemperatureOffsetNoise
 const temperatureOffset=new Multiply(new Perlin(f(.018),2,.5,6,seed(),QualityMode.High),new Const(4));
 // SetupRainfallNoise
 let rainfall:NoiseModule=new Multiply(new ScaleBias(.5,.5,new Perlin(f(.015),2,.5,6,seed(),QualityMode.High)),new AbsLatitudeCurve(RAIN_BY_LATITUDE,100));
 const altitudeFactor=f(.00022222222),altitudeBias=f(-500*altitudeFactor);
 rainfall=new Multiply(rainfall,new Clamp(0,1,new ScaleBias(-1,1,new ScaleBias(altitudeFactor,altitudeBias,elevation))));
 rainfall=new Arbitrary(rainfall,value=>{if(value<0)value=0;if(value<.12){value=(value+.12)/2;if(value<.03)value=(value+.03)/2;}return value;});
 rainfall=new ScaleBias(4000,0,new Clamp(0,999,new Power(rainfall,new Const(1.5))));
 const rainfallCurve=worldClimateCurvePoints('rainfall',settings.rainfall);
 if(rainfallCurve)rainfall=new CurveSimple(rainfall,rainfallCurve);
 rainfall=new LastPoint(rainfall);
 // SetupHillinessNoise
 let mountainLines:NoiseModule=new Perlin(f(.025),2,.5,6,seed(),QualityMode.High);
 const holes=new Perlin(f(.06),2,.5,6,seed(),QualityMode.High);
 mountainLines=new OneMinus(new Multiply(new OneMinus(new Abs(mountainLines)),new Filter(holes,-.3,1)));
 const hillsMacro=new Perlin(f(.032),2,.5,5,seed(),QualityMode.Medium);
 const hillsMicro=new Perlin(f(.19),2,.5,6,seed(),QualityMode.High);
 // SetupSwampinessNoise
 const swampMicro=new ScaleBias(.5,.5,new Perlin(f(.09),2,f(.4),6,seed(),QualityMode.High));
 const swampMacro=new ScaleBias(.5,.5,new RidgedMultifractal(f(.025),2,6,seed(),QualityMode.High));
 const swampiness=new Multiply(new Multiply(new Multiply(swampMicro,swampMacro),new InverseLerp(elevation,750,650)),new InverseLerp(rainfall,725,900));
 const temperatureCurve=worldClimateCurvePoints('temperature',settings.temperature);
 // BiomeWorker_SeaIce: allowed inside the generated part except a noisy
 // band along its edge, keyed by the world seed.
 const seaIceNoise=new Perlin(.017000000923871994,2,.5,6,rootSeed,QualityMode.Medium);
 const seaIceBand=f(Math.min(7.5,f(viewAngle*f(.12))));
 const seaIceAllowed=(center:Vector3)=>{
  const angle=vector3Angle(viewCenter,center),from=f(viewAngle-seaIceBand);
  const edge=from!==viewAngle?Math.max(0,Math.min(1,f((angle-from)/(viewAngle-from)))):0;
  if(edge<=0)return true;
  const heading=worldSphericalHeading(viewCenter,center);
  return edge<=f(f(seaIceNoise.getValue(heading,0,0))*.5+.5);
 };
 let nextTile=0;
 return {rootSeed,random,generateTile(tileId:number,center:Vector3):CoreTerrainTile {
  if(tileId!==nextTile||!center.every(Number.isFinite))throw Error('Non-contiguous core terrain generation');
  nextTile++;
  const tileElevation=noiseAt(elevation,center),value=noiseAt(mountainLines,center);
  let hilliness:WorldRelief;
  if(value>f(.235)||tileElevation<=0){
   hilliness=tileElevation>0&&noiseAt(hillsMicro,center)>f(.46)&&noiseAt(hillsMacro,center)>f(-.3)?(random.bool?'small-hills':'large-hills'):'flat';
  }else if(value>f(.12))hilliness=(['flat','small-hills','large-hills','mountainous'] as const)[random.range(0,4)]!;
  else hilliness=value>f(.0363)?'mountainous':'impassable';
  const latitude=f(f(Math.asin(f(center[1]/100)))*f(57.29578));
  let temperature=simpleCurveEvaluate(AVG_TEMP_BY_LATITUDE,f(Math.abs(latitude)/90));
  const reduction=tileElevation<250?0:monoLerp(0,40,f((tileElevation-250)/4750));
  temperature=f(temperature-reduction);
  temperature=f(temperature+noiseAt(temperatureOffset,center));
  if(temperatureCurve)temperature=simpleCurveEvaluate(temperatureCurve,temperature);
  const tileRainfall=noiseAt(rainfall,center);
  const tileSwampiness=hilliness==='flat'||hilliness==='small-hills'?noiseAt(swampiness,center):0;
  const scored={elevation:tileElevation,temperature,rainfall:tileRainfall,swampiness:tileSwampiness};
  let biome:Exclude<WorldBiome,'lake'>=CORE_BIOMES[0],best=0,first=true;
  for(const candidate of CORE_BIOMES){
   const score=coreBiomeScore(candidate,scored,()=>seaIceAllowed(center));
   if(score>best||first){biome=candidate;best=score;first=false;}
  }
  return {elevation:tileElevation,hilliness,temperature,rainfall:tileRainfall,swampiness:tileSwampiness,biome};
 }};
}
