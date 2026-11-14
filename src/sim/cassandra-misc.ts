import {resolveSelectedResourcePod305,advanceResourcePod305} from './resource-pods-305.ts';
import {advanceVolcanicWinter310,resolveSelectedVolcanicWinter310} from './volcanic-winter-310.ts';
import {isVolcanicWinter310} from './volcanic-winter-state-310.ts';
import {isMiscIncidents305,resolveSelectedSelfTame305,resolveSelectedFarmAnimals305} from './misc-incidents-305.ts';
import {homeIncidentsBlocked261} from './temp-map-incidents-261.ts';
import { climateTick,seasonTemperature,siteClimateDefinition } from './site-climate.ts';
import { eligibleFlashstorm,resolveSelectedFlashstorm } from './flashstorm.ts';
import { resolveSelectedPodRescue } from './pod-rescue.ts';
import { eligibleColdSnap } from './cold-snap.ts';
import { checkpointEclipseGrowth } from './eclipse.ts';
import { eligibleShortCircuit,resolveSelectedShortCircuit,type ShortCircuitCalendar } from './short-circuit.ts';
import { eligibleCropBlight,resolveSelectedCropBlight,type CropBlightCalendar } from './crop-blight-incident.ts';
import {eligibleToxicFallout294,resolveSelectedToxicFallout294} from './toxic-fallout-incident-294.ts';
import type {ToxicFalloutCalendar294} from './toxic-fallout-state-294.ts';
import { TICKS_PER_DAY,type World } from './types.ts';

/** A deliberately fixed local envelope for the Core Misc category. Core
 * filters and storyteller population intent change the effective weights;
 * unsupported incidents keep their tickets rather than becoming heat waves. */
export const MISC_FIRST_CHECK=5*TICKS_PER_DAY+100;
export const MISC_INTRO_TICK=Math.round(4.4*TICKS_PER_DAY);
export const MISC_CHECK_INTERVAL=100;
export const MISC_CATEGORY_CHANCE=MISC_CHECK_INTERVAL/(4.8*TICKS_PER_DAY);
export const MISC_RAW_WEIGHT=16.9;
export const MISC_HEAT_WEIGHT=1;
export const MISC_FLASHSTORM_WEIGHT=.4;
export const MISC_POD_WEIGHT=1.5;
export const MISC_COLD_WEIGHT=1;
export const MISC_ECLIPSE_WEIGHT=1.5;
export const MISC_SHORT_CIRCUIT_WEIGHT=1;
export const MISC_CROP_BLIGHT_WEIGHT=.3;
export const MISC_TOXIC_FALLOUT_WEIGHT=.12;
export const MISC_SELF_TAME_WEIGHT305=1;
export const MISC_FARM_ANIMALS_WEIGHT305=.4;
export const MISC_RESOURCE_POD_WEIGHT305=1;
export const MISC_VOLCANIC_WINTER_WEIGHT310=.08;
export const MISC_HEAT_COOLDOWN=30*TICKS_PER_DAY;
export const MISC_COLD_COOLDOWN=30*TICKS_PER_DAY;
export const MISC_ECLIPSE_COOLDOWN=15*TICKS_PER_DAY;

export interface WeatherIncidentState {
  adoptedAt:number;coldSnaps:number;eclipses:number;
  lastColdSnapStart?:number;lastEclipseStart?:number;
  coldSnap?:{start:number;end:number};eclipse?:{start:number;end:number};
}

export interface CassandraMiscCalendar {
  profile:'cassandra-misc-v1';
  adoptedAt:number;
  rng:number;
  nextCheck:number;
  introDone:boolean;
  checks:number;
  opportunities:number;
  heatwaves:number;
  lastHeatwaveStart?:number;
  active?:{start:number;end:number};
  weather?:WeatherIncidentState;
  shortCircuits?:ShortCircuitCalendar;
  cropBlights?:CropBlightCalendar;
  toxicFallout?:ToxicFalloutCalendar294;
  /** Schema 305: resource pods dropped so far, and the pod not yet opened. */
  resourcePods305?:number;resourcePod305?:import('./resource-pods-305.ts').ResourcePodPending305;
  /** Schema 310 volcanic winter: count, last start (local tick) and the active interval. */
  volcanicWinters310?:number;lastVolcanicWinterStart310?:number;volcanicWinter310?:import('./volcanic-winter-state-310.ts').VolcanicWinter310;
}

function random(state:CassandraMiscCalendar):number {
  let value=state.rng;
  value^=value<<13;value^=value>>>17;value^=value<<5;
  state.rng=value>>>0;
  return state.rng/0x100000000;
}
function emit(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}

/** A continuation starts from the next check, with no retrospective draws. */
export function adoptMiscIncidents(world:World):void {
  if(homeIncidentsBlocked261(world)||!world.gameProfile||world.miscIncidents)return;
  world.miscIncidents={profile:'cassandra-misc-v1',adoptedAt:world.tick,
    rng:((world.seed^0x4c5ca180)>>>0)||1,
    nextCheck:Math.max(MISC_FIRST_CHECK,(Math.floor(world.tick/MISC_CHECK_INTERVAL)+1)*MISC_CHECK_INTERVAL),
    introDone:world.tick>=MISC_INTRO_TICK,checks:0,opportunities:0,heatwaves:0};
}

/** New rules begin on the first played step, never during save migration. */
export function adoptWeatherIncidents(world:World):void {
  if(world.schemaVersion<200||!world.gameProfile||!world.miscIncidents||world.miscIncidents.weather)return;
  world.miscIncidents.weather={adoptedAt:world.tick,coldSnaps:0,eclipses:0};
}

/** The daily temperature swing is not a seasonal eligibility signal. */
export function eligibleMiscHeatwave(world:World,state:CassandraMiscCalendar=world.miscIncidents!):boolean {
  if(!world.gameProfile||!world.climate||!state||state.active||state.weather?.coldSnap||world.heatwaves?.active||world.schemaVersion>=328&&!!state.volcanicWinter310||
    state.lastHeatwaveStart!==undefined&&world.tick-state.lastHeatwaveStart<MISC_HEAT_COOLDOWN)return false;
  const site=siteClimateDefinition(world);
  return seasonTemperature(site.latitude,site.meanTemperature,climateTick(world))>=20;
}

/** Only a selected heat ticket reaches this point. An ineligible ticket is
 * consumed; it cannot create a later guaranteed heat wave. */
export function resolveSelectedHeatwave(world:World,state:CassandraMiscCalendar=world.miscIncidents!):boolean {
  if(!eligibleMiscHeatwave(world,state))return false;
  const start=world.tick;
  const end=start+Math.floor((1.5+2*random(state))*TICKS_PER_DAY);
  state.active={start,end};state.lastHeatwaveStart=start;state.heatwaves++;
  emit(world,'Canicule : préparez une pièce fermée et refroidie, du bois et des vêtements adaptés. Surveillez les coups de chaleur.');
  return true;
}

export function resolveSelectedColdSnap(world:World,state:CassandraMiscCalendar=world.miscIncidents!):boolean {
  const weather=state?.weather;if(!weather||!eligibleColdSnap(world)||!Number.isSafeInteger(world.tick+3.5*TICKS_PER_DAY))return false;
  const start=world.tick,end=start+Math.floor((1.5+2*random(state))*TICKS_PER_DAY);
  if(!Number.isSafeInteger(end))return false;
  weather.coldSnap={start,end};weather.lastColdSnapStart=start;weather.coldSnaps++;
  emit(world,'Vague de froid : protégez les cultures, chauffez les pièces et équipez les habitants de vêtements isolants.');return true;
}

export function eligibleEclipse(world:World,state:CassandraMiscCalendar=world.miscIncidents!):boolean {
  const weather=state?.weather;
  return world.schemaVersion>=200&&!!world.gameProfile&&!!weather&&!weather.eclipse&&
    (weather.lastEclipseStart===undefined||world.tick-weather.lastEclipseStart>=MISC_ECLIPSE_COOLDOWN);
}

export function resolveSelectedEclipse(world:World,state:CassandraMiscCalendar=world.miscIncidents!):boolean {
  if(!eligibleEclipse(world,state)||!Number.isSafeInteger(world.tick+1.25*TICKS_PER_DAY))return false;
  const weather=state.weather!,start=world.tick,end=start+Math.floor((.75+.5*random(state))*TICKS_PER_DAY);
  if(!Number.isSafeInteger(end))return false;
  checkpointEclipseGrowth(world);
  weather.eclipse={start,end};weather.lastEclipseStart=start;weather.eclipses++;
  emit(world,'Éclipse : la lumière naturelle et la production solaire diminuent. Préservez vos réserves et l’éclairage des cultures.');return true;
}

function consumeOpportunity(world:World,state:CassandraMiscCalendar):void {
  state.opportunities++;
  const ticket=random(state)*MISC_RAW_WEIGHT;
  if(ticket<MISC_HEAT_WEIGHT)resolveSelectedHeatwave(world,state);
  else if(ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT&&eligibleFlashstorm(world)){
    resolveSelectedFlashstorm(world,Math.floor(random(state)*0x100000000)||1);
  }
  else if(ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT){
    resolveSelectedPodRescue(world,Math.floor(random(state)*0x100000000)||1);
  }
  else if(state.weather&&ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT){
    resolveSelectedColdSnap(world,state);
  }
  else if(state.weather&&ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT){
    resolveSelectedEclipse(world,state);
  }
  else if(ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT&&eligibleShortCircuit(world)){
    resolveSelectedShortCircuit(world,Math.floor(random(state)*0x100000000)||1);
  }
  else if(ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT+MISC_CROP_BLIGHT_WEIGHT&&eligibleCropBlight(world)){
    resolveSelectedCropBlight(world,Math.floor(random(state)*0x100000000)||1);
  }
  else if(ticket>=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT+MISC_CROP_BLIGHT_WEIGHT&&ticket<MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT+MISC_CROP_BLIGHT_WEIGHT+MISC_TOXIC_FALLOUT_WEIGHT&&eligibleToxicFallout294(world)){
    resolveSelectedToxicFallout294(world,Math.floor(random(state)*0x100000000)||1);
  }
  // Schema 305: the Self-tame then Farm animals tickets follow, in the space
  // that drew nothing before (misc-incidents-305).
  else if(isMiscIncidents305(Number(world.schemaVersion))){
    const supported=MISC_HEAT_WEIGHT+MISC_FLASHSTORM_WEIGHT+MISC_POD_WEIGHT+MISC_COLD_WEIGHT+MISC_ECLIPSE_WEIGHT+MISC_SHORT_CIRCUIT_WEIGHT+MISC_CROP_BLIGHT_WEIGHT+MISC_TOXIC_FALLOUT_WEIGHT;
    if(ticket>=supported&&ticket<supported+MISC_SELF_TAME_WEIGHT305)resolveSelectedSelfTame305(world,()=>random(state));
    else if(ticket>=supported+MISC_SELF_TAME_WEIGHT305&&ticket<supported+MISC_SELF_TAME_WEIGHT305+MISC_FARM_ANIMALS_WEIGHT305)resolveSelectedFarmAnimals305(world,Math.floor(random(state)*0x100000000)||1);
    else if(ticket>=supported+MISC_SELF_TAME_WEIGHT305+MISC_FARM_ANIMALS_WEIGHT305&&ticket<supported+MISC_SELF_TAME_WEIGHT305+MISC_FARM_ANIMALS_WEIGHT305+MISC_RESOURCE_POD_WEIGHT305)resolveSelectedResourcePod305(world,Math.floor(random(state)*0x100000000)||1);
    else if(isVolcanicWinter310(Number(world.schemaVersion))&&ticket>=supported+MISC_SELF_TAME_WEIGHT305+MISC_FARM_ANIMALS_WEIGHT305+MISC_RESOURCE_POD_WEIGHT305&&ticket<supported+MISC_SELF_TAME_WEIGHT305+MISC_FARM_ANIMALS_WEIGHT305+MISC_RESOURCE_POD_WEIGHT305+MISC_VOLCANIC_WINTER_WEIGHT310)resolveSelectedVolcanicWinter310(world,()=>random(state));
  }
}

/** End is processed before any draw at the same tick. The introductory
 * opportunity exists only for calendars adopted strictly before its tick. */
export function advanceMiscIncidents(world:World):void {
  const state=world.miscIncidents;
  if(!state||!world.gameProfile)return;
  if(state.active&&world.tick>=state.active.end){
    delete state.active;
    emit(world,'La canicule se termine. Les pièces retrouvent progressivement leur température habituelle.');
  }
  const weather=state.weather;
  if(weather?.coldSnap&&world.tick>=weather.coldSnap.end){
    delete weather.coldSnap;emit(world,'La vague de froid se termine. Les pièces retrouvent progressivement leur température habituelle.');
  }
  if(weather?.eclipse&&world.tick>=weather.eclipse.end){
    checkpointEclipseGrowth(world);delete weather.eclipse;
    emit(world,'L’éclipse se termine. La lumière naturelle et les générateurs solaires retrouvent leur fonctionnement habituel.');
  }
  advanceResourcePod305(world);
  advanceVolcanicWinter310(world);
  if(homeIncidentsBlocked261(world))return;
  if(!state.introDone&&world.tick>=MISC_INTRO_TICK){
    state.introDone=true;
    if(world.tick===MISC_INTRO_TICK)consumeOpportunity(world,state);
  }
  if(world.tick<state.nextCheck)return;
  // A skipped time span never replays old rolls at the current tick.
  state.nextCheck=Math.max(MISC_FIRST_CHECK,(Math.floor(world.tick/MISC_CHECK_INTERVAL)+1)*MISC_CHECK_INTERVAL);
  if(world.tick%MISC_CHECK_INTERVAL!==0)return;
  state.checks++;
  if(random(state)<MISC_CATEGORY_CHANCE)consumeOpportunity(world,state);
}
