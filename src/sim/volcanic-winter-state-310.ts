import {schemaAtLeast} from './schema-range.ts';
import type {World} from './types.ts';

/* Schema 310: Core VolcanicWinter (Misc, baseChance 0.08), which the Misc
 * calendar already drew without effect. Core rules (IncidentDef and
 * GameCondition_VolcanicWinter), our own texts:
 * - not before day 60, then at least 140 days between two starts;
 * - lasts 7.5 to 40 days;
 * - every effect ramps in over the first 50,000 Core ticks and out over the
 *   last 50,000 (LerpInOutValue);
 * - outdoor temperature -7 °C at full strength;
 * - the sky glow is pulled 30 % of the way towards 0.55 (darker days,
 *   slightly lighter nights), which slows plant growth and solar power;
 * - wild animal density is halved;
 * - nobody enjoys recreation outdoors while it lasts.
 * Adaptation: the darker sky colour itself is not drawn yet. */
export const isVolcanicWinter310=schemaAtLeast(310);
export const VOLCANIC_WINTER_FIRST_DAY310=60,VOLCANIC_WINTER_REFIRE_DAYS310=140;
export const VOLCANIC_WINTER_MIN_CORE310=450_000,VOLCANIC_WINTER_MAX_CORE310=2_400_000,VOLCANIC_WINTER_TRANSITION_CORE310=50_000;
export const VOLCANIC_WINTER_TEMPERATURE310=-7,VOLCANIC_WINTER_GLOW310=.55,VOLCANIC_WINTER_SKY_LERP310=.3;
export interface VolcanicWinter310 {startCore:number;endCore:number}
type VolcanicWorld=Pick<World,'tick'|'miscIncidents'>;

/** 0 outside, ramping 0 -> 1 -> 0 at the edges (Core LerpInOutValue). */
export function volcanicWinterStrength310(world:VolcanicWorld,tick=world.tick):number {
  const v=world.miscIncidents?.volcanicWinter310,now=tick*10;
  if(!v||now<v.startCore||now>=v.endCore)return 0;
  return Math.max(0,Math.min(1,(now-v.startCore)/VOLCANIC_WINTER_TRANSITION_CORE310,(v.endCore-now)/VOLCANIC_WINTER_TRANSITION_CORE310));
}
export const volcanicWinterActive310=(world:VolcanicWorld,tick=world.tick):boolean=>{
  const v=world.miscIncidents?.volcanicWinter310,now=tick*10;return !!v&&now>=v.startCore&&now<v.endCore;
};
export const volcanicTemperatureOffset310=(world:VolcanicWorld,tick=world.tick):number=>VOLCANIC_WINTER_TEMPERATURE310*volcanicWinterStrength310(world,tick);
/** The sky glow after the condition's target lerp. */
export const volcanicGlow310=(glow:number,strength:number):number=>strength>0?glow+(VOLCANIC_WINTER_GLOW310-glow)*VOLCANIC_WINTER_SKY_LERP310*strength:glow;
export const volcanicAnimalDensityFactor310=(world:VolcanicWorld,tick=world.tick):number=>1-.5*volcanicWinterStrength310(world,tick);

export function validVolcanicWinter310(value:unknown,tick:number):boolean {
  if(value===undefined)return true;
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==2)return false;
  const v=value as Record<string,unknown>;
  if(!Number.isSafeInteger(v.startCore)||!Number.isSafeInteger(v.endCore)||Number(v.startCore)%10!==0)return false;
  const duration=Number(v.endCore)-Number(v.startCore);
  return duration>=VOLCANIC_WINTER_MIN_CORE310&&duration<=VOLCANIC_WINTER_MAX_CORE310&&Number(v.startCore)<=tick*10&&Number(v.endCore)>tick*10;
}
