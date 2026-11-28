import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {mechRaidGroups261} from './mechanical-raid-groups-261.ts';
import {tempMapAdoptedAtCore261} from './temp-map-incidents-261.ts';
import { enableMechanoidRaids } from './mechanoid-raids.ts';
import { raidRandom,type RaidCalendar } from './raid-state.ts';
import { TICKS_PER_DAY,type World } from './types.ts';
import {homeThreatCycle382,type GameProfile} from './game-profile.ts';
import {phoebeCoreBigHit382,validNativePhoebeCycle382,type NativePhoebeCycle382} from './phoebe-native-cycle-382.ts';

export interface CassandraRaidAgenda {rng:number;cycle:number;pending:number[];nativePhoebe382?:NativePhoebeCycle382}
export const INTRO_RAID_TICK=Math.round(TICKS_PER_DAY*5.4);
export const CASSANDRA_CYCLE_START=TICKS_PER_DAY*11;
export const CASSANDRA_ACTIVE_TICKS=Math.round(TICKS_PER_DAY*4.6);
export const CASSANDRA_CYCLE_TICKS=Math.round(TICKS_PER_DAY*10.6);
export const CASSANDRA_MIN_SPACING=Math.round(TICKS_PER_DAY*1.9);
const INTERVAL=100;

/** The source schedules opportunities on 1,000-Core-tick intervals. Keep its
 * active/rest windows and minimum spacing; our private PRNG is not Core's RNG.
 * Raid composition and selection beyond day 20 remain explicit adaptations. */
function prepareCycle(agenda:CassandraRaidAgenda,profile:Pick<World,'gameProfile'>):void {
  const rule=homeThreatCycle382(profile),start=rule.start+agenda.cycle*rule.cycle;
  if(agenda.nativePhoebe382){agenda.pending=[phoebeCoreBigHit382(agenda.nativePhoebe382,agenda.cycle)];return;}
  const count=rule.bigCount===1?1:raidRandom(agenda)<.5?1:2;
  for(let attempt=0;attempt<256;attempt++) {
    const times=Array.from({length:count},()=>Math.floor(raidRandom(agenda)*(rule.active/INTERVAL))*INTERVAL).sort((a,b)=>a-b);
    if(times.length===2)times[1]=Math.max(times[1]!,times[0]!+rule.spacing);
    if(times.at(-1)!>rule.active)continue;
    agenda.pending=times.map(t=>start+t);return;
  }
  throw new Error('Cannot schedule Cassandra raid opportunities.');
}
export function enableCassandraRaids(world:World,prospective=false,nativePhoebe382?:NativePhoebeCycle382):void {
  if(world.raids)throw new Error('Cannot replace an existing raid calendar.');
  if(nativePhoebe382&&(world.schemaVersion<382||world.gameProfile?.storyteller!=='phoebe-partial'||!validNativePhoebeCycle382(nativePhoebe382)))throw Error('Invalid native Phoebe cycle source');
  world.raids={profile:'cassandra-raids-v1',rng:((world.seed^0x7a1d068)>>>0)||1,nextCheck:INTRO_RAID_TICK,serial:0,completed:0,departed:[],
    cassandra:{rng:((world.seed^0xc455a82)>>>0)||1,cycle:-1,pending:[INTRO_RAID_TICK],...nativePhoebe382?{nativePhoebe382}: {}}};
  if(prospective){
    // A secondary map never replays ClassicIntro or an already begun cycle.
    const agenda=world.raids.cassandra!;
    const rule=homeThreatCycle382(world);
    agenda.cycle=Math.max(0,Math.floor((world.tick-rule.start)/rule.cycle)+(nativePhoebe382?0:1));
    prepareCycle(agenda,world);
    if(agenda.pending[0]!<=world.tick){agenda.cycle++;prepareCycle(agenda,world);}
    world.raids.nextCheck=agenda.pending[0]!;
  }
  if(world.schemaVersion>=194)enableMechanoidRaids(world);
}
/** A failed or occupied opportunity is consumed, never postponed into an
 * artificial guaranteed raid. Advancing a group cannot move the next cycle. */
export function consumeCassandraOpportunity(world:World,state:RaidCalendar):boolean {
  const agenda=state.cassandra;
  if(!agenda||world.tick<agenda.pending[0]!)return false;
  const due=world.tick===agenda.pending[0];
  while(agenda.pending[0]!<=world.tick) {
    agenda.pending.shift();
    if(!agenda.pending.length){agenda.cycle++;prepareCycle(agenda,world);}
  }
  if(!state.active&&!mechRaidGroups261(world).length&&!state.extraActive261?.length)state.nextCheck=agenda.pending[0]!;
  return due;
}
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validCassandraAgenda(value:unknown,tick:number,version=241,gameProfile?:GameProfile):boolean {
  if(typeof value!=='object'||value===null||Array.isArray(value))return false;
  const s=value as Record<string,unknown>;
  const rule=homeThreatCycle382({gameProfile:version>=382?gameProfile:undefined});
  const native=s.nativePhoebe382;
  if(Object.hasOwn(s,'nativePhoebe382')&&(version<382||gameProfile?.storyteller!=='phoebe-partial'||!validNativePhoebeCycle382(native)))return false;
  if(Object.keys(s).length!==(native?4:3)||!Object.keys(s).every(k=>['rng','cycle','pending','nativePhoebe382'].includes(k))||!integer(s.rng,1,0xffffffff)||!integer(s.cycle,-1)||!Array.isArray(s.pending)||!s.pending.length||s.pending.length>rule.bigCount)return false;
  if(s.cycle===-1)return s.pending.length===1&&s.pending[0]===INTRO_RAID_TICK&&tick<INTRO_RAID_TICK;
  const start=rule.start+s.cycle*rule.cycle,end=start+rule.active;
  if(!Number.isSafeInteger(end)||start>tick+rule.cycle&&!(version>=242&&s.cycle===0&&tick<rule.start))return false;
  const pending=s.pending;
  if(native&&validNativePhoebeCycle382(native)&&pending[0]!==phoebeCoreBigHit382(native,s.cycle))return false;
  return pending.every((time,i)=>integer(time,Math.max(start,tick+1),rule.bigCount===1?end-INTERVAL:end)&&time%INTERVAL===0&&(i===0||time-Number(pending[i-1])>=rule.spacing));
}

/** Actual Camp -> settlement conversion. Keep the complete real attack owner. */
export function convertCampRaidOwner260(w:World):void {
 const s=w.raids,modern=(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))&&tempMapAdoptedAtCore261(w)!==undefined;if(w.schemaVersion<260||!s||s.profile!=='camp-pressure-v1'&&!modern)return;
 const rule=homeThreatCycle382(w),agenda:CassandraRaidAgenda={rng:modern&&s.cassandra?s.cassandra.rng:((w.seed^0xc455a82)>>>0)||1,cycle:Math.max(0,Math.floor((w.tick-rule.start)/rule.cycle)+1),pending:[]};prepareCycle(agenda,w);
 s.profile='cassandra-raids-v1';s.cassandra=agenda;s.nextCheck=s.active||mechRaidGroups261(w).length||s.extraActive261?.length?null:agenda.pending[0]!;
}
