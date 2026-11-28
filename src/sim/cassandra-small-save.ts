import {tempMapModern261,tempMapAdoptedAtCore261} from './temp-map-incidents-261.ts';
import { SMALL_CHECK_INTERVAL,SMALL_INTRO_TICK,SMALL_REFIRE_TICKS,smallCycleAt,smallNextCheck } from './cassandra-small.ts';
import type { World } from './types.ts';
import {homeThreatCycle382} from './game-profile.ts';
import {phoebeCoreSmallHit382} from './phoebe-native-cycle-382.ts';

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;
const keys=(value:Record<string,unknown>,allowed:readonly string[])=>Object.keys(value).every(key=>allowed.includes(key));

function validIncidentTick(tick:number,adoptedAt:number,world:Pick<World,'gameProfile'>&Partial<Pick<World,'raids'>>):boolean {
  if(tick<=adoptedAt)return false;
  if(tick===SMALL_INTRO_TICK)return adoptedAt<SMALL_INTRO_TICK;
  const rule=homeThreatCycle382(world),cycle=smallCycleAt(tick,world);
  const native=world.raids?.cassandra?.nativePhoebe382;
  if(cycle<0||tick===rule.start||(!native&&cycle<=smallCycleAt(adoptedAt,world))||tick%SMALL_CHECK_INTERVAL!==0)return false;
  if(native&&phoebeCoreSmallHit382(native,cycle)?.tick!==tick)return false;
  return tick<rule.start+cycle*rule.cycle+rule.active;
}

/** Validate the source before neutral 182→183 migration too. No hidden future
 * state, pending past date or impossible count can survive a save/snapshot. */
export function validSmallIncidents(value:unknown,version:number,world:Pick<World,'tick'|'gameProfile'>&Partial<World>):boolean {
  const scheduleTick=tempMapModern261(world as World)?tempMapAdoptedAtCore261(world as World)!/10:world.tick;
  if(value===undefined)return true;
  const rule=homeThreatCycle382(world);
  if(version<183||!world.gameProfile||!object(value)||
    !keys(value,['profile','adoptedAt','rng','nextCheck','cycle','pending','introDone','opportunities','incidents','lastIncidentTick'])||
    value.profile!=='cassandra-small-v1'||!integer(value.adoptedAt,0,world.tick)||!integer(value.rng,1,0xffffffff)||
    !integer(value.nextCheck,rule.start)||value.nextCheck!==smallNextCheck(scheduleTick,world)||
    !integer(value.cycle,-1)||value.cycle!==smallCycleAt(scheduleTick,world)||
    !Array.isArray(value.pending)||value.pending.length>1||
    typeof value.introDone!=='boolean'||value.introDone!==(scheduleTick>=SMALL_INTRO_TICK)||
    !integer(value.opportunities)||!integer(value.incidents)||value.incidents>value.opportunities)return false;
  const native=world.raids?.cassandra?.nativePhoebe382,adoptedCycle=smallCycleAt(value.adoptedAt,world),
    adoptedHit=native&&adoptedCycle>=0?phoebeCoreSmallHit382(native,adoptedCycle):undefined;
  const cycle=value.cycle,opened=cycle-adoptedCycle+(adoptedHit&&adoptedHit.tick>value.adoptedAt?1:0),
    intro=value.introDone&&value.adoptedAt<SMALL_INTRO_TICK?1:0;
  if(value.opportunities+value.pending.length>opened+intro)return false;
  if(value.pending.length){
    const time=value.pending[0],start=rule.start+cycle*rule.cycle;
    if(cycle<0||!integer(time,Math.max(start,scheduleTick+1),start+rule.active-SMALL_CHECK_INTERVAL)||
      !validIncidentTick(time,value.adoptedAt,world))return false;
  }
  if(value.lastIncidentTick!==undefined){
    if(!integer(value.lastIncidentTick,0,world.tick)||value.incidents===0||
      !validIncidentTick(value.lastIncidentTick,value.adoptedAt,world))return false;
    const earliest=value.adoptedAt<SMALL_INTRO_TICK?SMALL_INTRO_TICK:
      adoptedHit&&adoptedHit.tick>value.adoptedAt?adoptedHit.tick:rule.start+(adoptedCycle+1)*rule.cycle;
    if(value.lastIncidentTick<earliest+(value.incidents-1)*SMALL_REFIRE_TICKS)return false;
  } else if(value.incidents!==0)return false;
  return true;
}

export function validateSmallIncidents(world:World,version=world.schemaVersion):string[] {
  return validSmallIncidents(world.smallIncidents,version,world)?[]:['Invalid Cassandra small-threat calendar.'];
}
