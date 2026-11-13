import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validVolcanicWinter310} from './volcanic-winter-state-310.ts';
import {tempMapModern261,tempMapAdoptedAtCore261} from './temp-map-incidents-261.ts';
import { MISC_CHECK_INTERVAL,MISC_FIRST_CHECK,MISC_HEAT_COOLDOWN,MISC_INTRO_TICK } from './cassandra-misc.ts';
import { TICKS_PER_DAY,type World } from './types.ts';
import {validWeatherIncidents} from './weather-incident-save.ts';
import {validShortCircuits} from './short-circuit-save.ts';
import {validCropBlightCalendar} from './plant-blight-save.ts';
import {validToxicFalloutCalendar294} from './toxic-fallout-save-294.ts';
import {RESOURCE_POD_FALL_TICKS305,RESOURCE_POD_OPEN_TICKS305} from './resource-pods-305.ts';
/** Schema 305 resource pods: a positive count, and at most one unopened pod
 * dropped on a check tick, its timings exact and its opening possibly late. */
function validResourcePods305(value:Record<string,unknown>,tick:number):boolean {
  const count=value.resourcePods305,pod=value.resourcePod305;
  if(count===undefined)return pod===undefined;
  if(!integer(count,1))return false;
  if(pod===undefined)return true;
  if(!object(pod)||!keys(pod,['start','landAt','openAt','cell','seed'])||Object.keys(pod).length!==5||!integer(pod.start,0,tick)||Number(pod.start)%MISC_CHECK_INTERVAL!==0&&pod.start!==MISC_INTRO_TICK)return false;
  if(pod.landAt!==Number(pod.start)+RESOURCE_POD_FALL_TICKS305||pod.openAt!==Number(pod.landAt)+RESOURCE_POD_OPEN_TICKS305||!integer(pod.seed,1,0xffffffff))return false;
  const c=pod.cell;return object(c)&&keys(c,['x','z'])&&Object.keys(c).length===2&&integer(c.x)&&integer(c.z);
}

/** Schema 310: a positive count, a last start in the past and at most one
 * active interval that began at that start. */
function validVolcanicWinters310(value:Record<string,unknown>,tick:number):boolean {
  const count=value.volcanicWinters310,last=value.lastVolcanicWinterStart310,active=value.volcanicWinter310;
  if(count===undefined)return last===undefined&&active===undefined;
  if(!integer(count,1)||!integer(last,0,tick)||!validVolcanicWinter310(active,tick))return false;
  return active===undefined||(active as {startCore:number}).startCore===Number(last)*10;
}
const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));

/** Called on the serialized source before a neutral 168→169 migration too. */
export function validMiscIncidents(value:unknown,version:number,world:Pick<World,'tick'|'gameProfile'|'heatwaves'>&Partial<World>):boolean {
  const scheduleTick=tempMapModern261(world as World)?tempMapAdoptedAtCore261(world as World)!/10:world.tick;
  if(value===undefined)return true;
  // A future field is forbidden even when hidden, undefined or an accessor.
  // Never read it before its own data descriptor has been admitted.
  const toxic=object(value)?Object.getOwnPropertyDescriptor(value,'toxicFallout'):undefined;
  if(object(value)&&'toxicFallout'in value&&((version!==294&&(version!==295&&(version!==296&&!isCorePhysicalSchema297(version))))||!toxic||toxic.enumerable!==true||!Object.hasOwn(toxic,'value')||toxic.value===undefined))return false;
  if(version<169||!world.gameProfile||!object(value)||
    !keys(value,['profile','adoptedAt','rng','nextCheck','introDone','checks','opportunities','heatwaves','lastHeatwaveStart','active',...version>=200?['weather']:[],...version>=201?['shortCircuits']:[],...version>=205?['cropBlights']:[],...(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))?['toxicFallout']:[],...version>=305?['resourcePods305','resourcePod305']:[],...version>=310?['volcanicWinters310','lastVolcanicWinterStart310','volcanicWinter310']:[]])||
    value.profile!=='cassandra-misc-v1'||!integer(value.adoptedAt,0,world.tick)||!integer(value.rng,1,0xffffffff)||
    !integer(value.nextCheck,MISC_FIRST_CHECK)||value.nextCheck%MISC_CHECK_INTERVAL!==0||
    value.nextCheck!==Math.max(MISC_FIRST_CHECK,(Math.floor(scheduleTick/MISC_CHECK_INTERVAL)+1)*MISC_CHECK_INTERVAL)||
    typeof value.introDone!=='boolean'||!integer(value.checks)||!integer(value.opportunities)||!integer(value.heatwaves)||
    value.checks>Math.max(0,Math.floor((scheduleTick-Math.max(MISC_FIRST_CHECK,(Math.floor(value.adoptedAt/MISC_CHECK_INTERVAL)+1)*MISC_CHECK_INTERVAL))/MISC_CHECK_INTERVAL)+1)||
    value.opportunities>value.checks+(value.introDone&&value.adoptedAt<MISC_INTRO_TICK?1:0)||
    value.heatwaves>value.opportunities||
    value.introDone!==(scheduleTick>=MISC_INTRO_TICK)||
    world.heatwaves!==undefined)return false;
  if(value.lastHeatwaveStart!==undefined&&(!integer(value.lastHeatwaveStart,value.adoptedAt,world.tick)||
    value.heatwaves===0||
    value.lastHeatwaveStart!==MISC_INTRO_TICK&&
      (value.lastHeatwaveStart<MISC_FIRST_CHECK||value.lastHeatwaveStart%MISC_CHECK_INTERVAL!==0)||
    value.lastHeatwaveStart===MISC_INTRO_TICK&&value.adoptedAt>=MISC_INTRO_TICK||
    value.lastHeatwaveStart<
      (value.adoptedAt<MISC_INTRO_TICK?MISC_INTRO_TICK:
        Math.max(MISC_FIRST_CHECK,(Math.floor(value.adoptedAt/MISC_CHECK_INTERVAL)+1)*MISC_CHECK_INTERVAL))+
      (value.heatwaves-1)*MISC_HEAT_COOLDOWN))return false;
  if(value.heatwaves>0&&value.lastHeatwaveStart===undefined)return false;
  if(value.active!==undefined){
    const active=value.active;
    if(!object(active)||!keys(active,['start','end'])||Object.keys(active).length!==2||
      !integer(active.start,value.adoptedAt,world.tick)||
      !integer(active.end,world.tick+1)||active.end-active.start<1.5*TICKS_PER_DAY||
      active.end-active.start>=3.5*TICKS_PER_DAY||active.start!==value.lastHeatwaveStart)return false;
  } else if(value.lastHeatwaveStart!==undefined&&world.tick-value.lastHeatwaveStart<1.5*TICKS_PER_DAY){
    return false;
  }
  const calendar=value as unknown as import('./cassandra-misc.ts').CassandraMiscCalendar;
  return validWeatherIncidents(value.weather,version,world,calendar)&&validShortCircuits(value.shortCircuits,version,world,calendar)
    &&validCropBlightCalendar(value.cropBlights,version,world,calendar)
    &&validToxicFalloutCalendar294(toxic?.value,version,world as World,calendar)
    &&(value.cropBlights===undefined&&toxic===undefined||calendar.heatwaves+(calendar.weather?.coldSnaps??0)+(calendar.weather?.eclipses??0)+(calendar.shortCircuits?.count??0)+(calendar.cropBlights?.count??0)+(calendar.toxicFallout?.count??0)+(calendar.resourcePods305??0)+(calendar.volcanicWinters310??0)<=calendar.opportunities)
    &&validResourcePods305(value,world.tick)&&validVolcanicWinters310(value,world.tick);
}

export function validateMiscIncidents(world:World,version=world.schemaVersion):string[] {
  return validMiscIncidents(world.miscIncidents,version,world)?[]:['Invalid Cassandra misc calendar.'];
}
