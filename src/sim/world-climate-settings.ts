/** Numeric climate settings for prospective worlds. Data: Core1.6.4871
 * SimpleCurve endpoints; original interpolation implementation. Historical
 * worlds retain their literal seed and climate, including old FNV semantics. */
export type ClimateSetting=0|1|2|3|4|5|6;
export type WorldCoverage=.3|.5|1;
export type CurvePoint=readonly [number,number];
export const POPULATION_MULTIPLIERS=[.1,.4,.7,1,1.5,2,2.75] as const;
export const WORLD_MAP_SIZES=[200,225,250,275,300,325,350,400] as const;
export const DEFAULT_WORLD_MAP_SIZE=250;
export const DEFAULT_WORLD_COVERAGE:WorldCoverage=.3;
const CURVES={"temperature":[[[-9999.0,-9999.0],[-50.0,-75.0],[-40.0,-60.0],[0.0,-35.0],[20.0,-28.0],[25.0,-18.0],[30.0,-8.5],[50.0,-7.0]],[[-9999.0,-9999.0],[-50.0,-70.0],[-25.0,-40.0],[-20.0,-25.0],[-13.0,-15.0],[0.0,-12.0],[30.0,-3.0],[60.0,25.0]],[[-9999.0,-9999.0],[-20.0,-22.0],[-15.0,-15.0],[-5.0,-13.0],[40.0,30.0],[9999.0,9999.0]],"identity",[[-9999.0,-9999.0],[-45.0,-35.0],[40.0,50.0],[120.0,120.0],[9999.0,9999.0]],[[-45.0,-22.0],[-25.0,-12.0],[-22.0,2.0],[-10.0,25.0],[40.0,57.0],[120.0,120.0],[9999.0,9999.0]],[[-45.0,25.0],[0.0,40.0],[33.0,80.0],[40.0,88.0],[120.0,120.0],[9999.0,9999.0]]],"rainfall":[[[0.0,0.0],[1500.0,120.0],[3500.0,180.0],[6000.0,200.0],[12000.0,250.0]],[[0.0,0.0],[1500.0,300.0],[6000.0,1100.0],[12000.0,1400.0]],[[0.0,0.0],[1000.0,700.0],[5000.0,4700.0],[12000.0,12000.0],[99999.0,99999.0]],"identity",[[0.0,50.0],[5000.0,5300.0],[12000.0,12000.0],[99999.0,99999.0]],[[0.0,500.0],[150.0,950.0],[500.0,2000.0],[1000.0,2800.0],[5000.0,6000.0],[12000.0,12000.0],[99999.0,99999.0]],[[0.0,750.0],[125.0,2000.0],[500.0,3000.0],[1000.0,3800.0],[5000.0,7500.0],[12000.0,12000.0],[99999.0,99999.0]]]} as const;

export function isClimateSetting(value:unknown):value is ClimateSetting {
 return Number.isInteger(value)&&typeof value==='number'&&value>=0&&value<=6;
}
/** UTF16 code units, signed 32-bit overflow, no trim/case conversion. */
export function stableWorldSeedHash(seed:string|null):number {
 if(seed===null)return 0;
 let hash=23;
 for(let i=0;i<seed.length;i++)hash=(Math.imul(hash,31)+seed.charCodeAt(i))|0;
 return hash;
}
export function evaluateClimateCurve(points:readonly CurvePoint[],value:number):number {
 if(!Number.isFinite(value)||points.length===0)throw Error('Invalid climate curve input');
 value=Math.fround(value);
 const first=points[0]!,last=points[points.length-1]!;
 if(value<=Math.fround(first[0]))return Math.fround(first[1]);
 if(value>=Math.fround(last[0]))return Math.fround(last[1]);
 for(let i=1;i<points.length;i++){
  const right=points[i]!;
  if(value<=Math.fround(right[0])){
   const left=points[i-1]!,fraction=Math.fround(Math.fround(value-Math.fround(left[0]))/Math.fround(Math.fround(right[0])-Math.fround(left[0])));
   return Math.fround(Math.fround(left[1])+Math.fround(Math.max(0,Math.min(1,fraction))*Math.fround(Math.fround(right[1])-Math.fround(left[1]))));
  }
 }
 throw Error('Invalid climate curve order');
}
/** The game's curve for a non-normal setting (`GetRainfallCurve`,
 * `GetTemperatureCurve`), or null for Normal, which applies none. */
export function worldClimateCurvePoints(kind:'temperature'|'rainfall',setting:ClimateSetting):readonly CurvePoint[]|null {
 if(!isClimateSetting(setting))throw Error('Invalid world climate setting');
 const curve=CURVES[kind][setting];return curve==='identity'?null:curve;
}
export function remapWorldClimate(kind:'temperature'|'rainfall',setting:ClimateSetting,value:number):number {
 if(!isClimateSetting(setting)||!Number.isFinite(value))throw Error('Invalid world climate setting');
 // Normal is identity, including outside other curves' endpoint range.
 if(setting===3)return value;
 return evaluateClimateCurve(CURVES[kind][setting],value);
}
export function populationMultiplier(setting:ClimateSetting):number {
 if(!isClimateSetting(setting))throw Error('Invalid population setting');
 return POPULATION_MULTIPLIERS[setting];
}
export interface WorldClimateSettings {
 coverage:WorldCoverage;
 rainfall:ClimateSetting;
 temperature:ClimateSetting;
 population:ClimateSetting;
}
export function validateWorldClimateSettings(value:unknown):value is WorldClimateSettings {
 if(value===null||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===4&&[.3,.5,1].includes(v.coverage as number)
  &&isClimateSetting(v.rainfall)&&isClimateSetting(v.temperature)&&isClimateSetting(v.population);
}
