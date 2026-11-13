import { TICKS_PER_DAY } from './types.ts';
import { volcanicGlow310,volcanicWinterStrength310 } from './volcanic-winter-state-310.ts';
import { climateTick,siteClimateDefinition,TICKS_PER_YEAR,type ClimateWorld } from './site-climate.ts';
import { eclipseLightFactor,ECLIPSE_MAX_DURATION,type EclipseWorld } from './eclipse.ts';

/** Fixed site: 45°N at equinox. Outdoor temperature/weather are still a preset.
 * Celestial glow follows the reference's horizon correction, independently of
 * rendered pixels and the artistic ambient light used for night readability. */
export function naturalLight(tick: number): number {
  const hourAngle = (tick % TICKS_PER_DAY / TICKS_PER_DAY - .5) * 2 * Math.PI;
  const altitudeDot = Math.cos(hourAngle) * Math.SQRT1_2;
  const correctedAngle = Math.max(0, Math.acos(altitudeDot) - 23.25 * Math.PI / 180);
  return Math.max(0, Math.min(1, Math.cos(correctedAngle) / .7));
}
export const OUTDOOR_TEMPERATURE = 21;

// Inclusive integer-tick integral. CPU growth remains O(1) per query, regardless
// of elapsed days; no per-tick walk over the forest or permanent growth deltas.
const prefix = new Float64Array(TICKS_PER_DAY + 1);
for (let tick = 1; tick <= TICKS_PER_DAY; tick++) {
  const phase = tick % TICKS_PER_DAY / TICKS_PER_DAY;
  const light = Math.max(0, (naturalLight(tick) - .51) / .49);
  prefix[tick] = prefix[tick - 1]! + (phase >= .25 && phase <= .8 ? light : 0);
}
export function growingLightIntegral(tick: number): number {
  const days = Math.floor(tick / TICKS_PER_DAY), remainder = tick % TICKS_PER_DAY;
  return days * prefix[TICKS_PER_DAY]! + prefix[remainder]!;
}

/** Reference celestial geometry reduced to a scalar dot product. The game's
 * horizon corrections are retained, rather than terrestrial sunrise formulas. */
export function seasonalNaturalLight(latitude:number,civilTick:number):number {
  const phase=((civilTick%TICKS_PER_YEAR)+TICKS_PER_YEAR)%TICKS_PER_YEAR;
  const day=Math.floor(phase/TICKS_PER_DAY),hourAngle=(phase%TICKS_PER_DAY/TICKS_PER_DAY-.5)*2*Math.PI;
  const offset=latitude<=70?.2:latitude>=75?1.5:.2+(latitude-70)/5*1.3;
  const y=-Math.cos(day/60*2*Math.PI)*offset,lat=latitude*Math.PI/180;
  const dot=(Math.cos(hourAngle)*Math.cos(lat)+y*Math.sin(lat))/Math.sqrt(1+y*y);
  const peek=latitude<=70?1:latitude>=75?.05:1-(latitude-70)/5*.95;
  const correction=(19*peek+17*Math.max(0,Math.min(1,(60-Math.abs(latitude))/60)))*Math.PI/180;
  const angle=Math.max(0,Math.acos(Math.max(-1,Math.min(1,dot)))-correction);
  return Math.max(0,Math.min(1,Math.cos(angle)/.7));
}

export function annualNaturalLight(world:ClimateWorld,tick=world.tick):number {
  const civil=climateTick(world,tick);
  const base=world.climate?seasonalNaturalLight(siteClimateDefinition(world).latitude,civil):naturalLight(civil);
  return volcanicGlow310(base*eclipseLightFactor(world,tick),volcanicWinterStrength310(world,tick));
}

// Shared immutable annual table: one profile, ~2.9MB, O(1) interval queries.
// No plant/map scan on lookup and no accumulated authoritative growth cache.
const yearlyPrefixes=new Map<number,Float64Array>();
function annualPrefix(latitude:number):Float64Array {
  const cached=yearlyPrefixes.get(latitude);if(cached)return cached;
  const values=new Float64Array(TICKS_PER_YEAR+1);
  for(let tick=1;tick<=TICKS_PER_YEAR;tick++) {
    const phase=tick%TICKS_PER_DAY/TICKS_PER_DAY;
    const light=phase>=.25&&phase<=.8?Math.max(0,(seasonalNaturalLight(latitude,tick)-.51)/.49):0;
    values[tick]=values[tick-1]!+light;
  }
  // New geographical starts add real latitudes. Keep the derived annual
  // tables bounded across repeated new games; eviction never alters values.
  if(yearlyPrefixes.size>=8)yearlyPrefixes.delete(yearlyPrefixes.keys().next().value!);
  yearlyPrefixes.set(latitude,values);return values;
}

export function annualGrowingLightIntegral(world:ClimateWorld,tick=world.tick):number {
  const civil=climateTick(world,tick);
  let base:number;
  if(!world.climate)base=growingLightIntegral(civil);
  else {
    const values=annualPrefix(siteClimateDefinition(world).latitude),years=Math.floor(civil/TICKS_PER_YEAR),remainder=civil-years*TICKS_PER_YEAR;
    base=years*values[TICKS_PER_YEAR]!+values[remainder]!;
  }
  return base-eclipseGrowingLightLoss(world,tick)-volcanicGrowingLightLoss310(world,tick);
}

/** Schema 310 volcanic winter: the growth lost to the darker sky, as a prefix
 * table over the condition's own ticks (at most 240,001 doubles, ~1.9 MB per
 * live World, built once). Plants are checkpointed at its start and end. */
interface VolcanicLoss {startCore:number;endCore:number;civilStart:number;latitude:number|undefined;values:Float64Array}
const volcanicLosses=new WeakMap<object,VolcanicLoss>();
function volcanicGrowingLightLoss310(world:ClimateWorld,tick:number):number {
  const v=world.miscIncidents?.volcanicWinter310;
  if(!v)return 0;
  const start=v.startCore/10,duration=Math.ceil((v.endCore-v.startCore)/10);
  if(tick<=start)return 0;
  const civilStart=climateTick(world,start),latitude=world.climate?siteClimateDefinition(world).latitude:undefined;
  let cached=volcanicLosses.get(world);
  if(!cached||cached.startCore!==v.startCore||cached.endCore!==v.endCore||cached.civilStart!==civilStart||cached.latitude!==latitude){
    const values=new Float64Array(duration+1);
    for(let offset=1;offset<=duration;offset++){
      const civil=civilStart+offset,phase=((civil%TICKS_PER_DAY)+TICKS_PER_DAY)%TICKS_PER_DAY/TICKS_PER_DAY;
      let loss=0;
      if(phase>=.25&&phase<=.8){
        const base=latitude===undefined?naturalLight(civil):seasonalNaturalLight(latitude,civil);
        loss=Math.max(0,(base-.51)/.49)-Math.max(0,(volcanicGlow310(base,volcanicWinterStrength310(world,start+offset))-.51)/.49);
      }
      values[offset]=values[offset-1]!+loss;
    }
    cached={startCore:v.startCore,endCore:v.endCore,civilStart,latitude,values};volcanicLosses.set(world,cached);
  }
  return cached.values[Math.min(duration,tick-start)]!;
}

interface EclipseLoss {start:number;end:number;civilStart:number;latitude:number|undefined;values:Float64Array}
// One derived table per live World, at most 7501 doubles (~60KB). Building it
// visits ticks of this single bounded event, never plants or elapsed history.
// All subsequent growth queries and interval clips are O(1); JSON saves omit it.
const eclipseLosses=new WeakMap<object,EclipseLoss>();
function eclipseGrowingLightLoss(world:ClimateWorld&EclipseWorld,tick:number):number {
  const interval=world.miscIncidents?.weather?.eclipse;
  if(!interval)return 0;
  if(tick<=interval.start)return 0;
  const {start,end}=interval,duration=end-start;
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||duration<=0||duration>ECLIPSE_MAX_DURATION)
    throw new Error('Invalid bounded eclipse interval');
  const civilStart=climateTick(world,start),latitude=world.climate?siteClimateDefinition(world).latitude:undefined;
  let cached=eclipseLosses.get(world);
  if(!cached||cached.start!==start||cached.end!==end||cached.civilStart!==civilStart||cached.latitude!==latitude) {
    const values=new Float64Array(duration+1);
    for(let offset=1;offset<=duration;offset++) {
      const civil=civilStart+offset,phase=((civil%TICKS_PER_DAY)+TICKS_PER_DAY)%TICKS_PER_DAY/TICKS_PER_DAY;
      let loss=0;
      if(phase>=.25&&phase<=.8) {
        const base=latitude===undefined?naturalLight(civil):seasonalNaturalLight(latitude,civil);
        loss=Math.max(0,(base-.51)/.49)-Math.max(0,(base*eclipseLightFactor(world,start+offset)-.51)/.49);
      }
      values[offset]=values[offset-1]!+loss;
    }
    cached={start,end,civilStart,latitude,values};eclipseLosses.set(world,cached);
  }
  return cached.values[Math.min(duration,tick-start)]!;
}
