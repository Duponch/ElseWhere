import {isMiscIncidents305,resolveSelectedAurora305,advanceAurora305} from './misc-incidents-305.ts';
import { TICKS_PER_DAY,type World } from './types.ts';

export const WORLD_CHECK_INTERVAL=100;
export const WORLD_FIRST_CHECK=15*TICKS_PER_DAY+WORLD_CHECK_INTERVAL;
export const WORLD_CATEGORY_CHANCE=1/900;
export const SOLAR_FLARE_COOLDOWN=15*TICKS_PER_DAY;
export interface CassandraWorldCalendar {
  profile:'cassandra-world-v1';adoptedAt:number;rng:number;nextCheck:number;
  checks:number;opportunities:number;flares:number;
  lastStart?:number;lastEndCore?:number;
  active?:{start:number;endCore:number};
  /** Schema 305: Aurora, the other World ticket (misc-incidents-305). */
  auroras?:number;lastAuroraStart?:number;aurora?:import('./misc-incidents-305.ts').AuroraState305;
}
function random(state:CassandraWorldCalendar):number {
  let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;
  return state.rng/0x100000000;
}
function emit(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
export function adoptWorldIncidents(world:World):void {
  if(!world.gameProfile||world.worldIncidents)return;
  const nextCheck=Math.max(WORLD_FIRST_CHECK,(Math.floor(world.tick/WORLD_CHECK_INTERVAL)+1)*WORLD_CHECK_INTERVAL);
  if(!Number.isSafeInteger(nextCheck))return;
  world.worldIncidents={profile:'cassandra-world-v1',adoptedAt:world.tick,
    rng:((world.seed^0x5c202a13)>>>0)||1,nextCheck,checks:0,opportunities:0,flares:0};
}
export function eligibleSolarFlare(world:World):boolean {
  const state=world.worldIncidents;
  return !!world.gameProfile&&!!state&&!state.active&&
    (state.lastStart===undefined||world.tick-state.lastStart>=SOLAR_FLARE_COOLDOWN)&&
    Number.isSafeInteger(world.tick*10+30000)&&state.flares<Number.MAX_SAFE_INTEGER;
}
/** Only an already selected World ticket reaches this function. */
export function resolveSelectedSolarFlare(world:World):boolean {
  if(!eligibleSolarFlare(world))return false;
  const state=world.worldIncidents!,start=world.tick,value=9000+21000*random(state);
  const floor=Math.floor(value),duration=value-floor===.5?floor+floor%2:Math.round(value);
  const endCore=start*10+duration;
  state.flares++;state.lastStart=start;state.lastEndCore=endCore;state.active={start,endCore};
  emit(world,'Éruption solaire : les appareils électriques s’arrêtent progressivement. Les batteries ne peuvent pas les alimenter.');
  return true;
}
/** PowerNet reads each exact reference boundary, including the expiration tick. */
export function electricityDisabledAtCore(world:World,coreTick:number):boolean {
  const active=world.worldIncidents?.active;
  return !!active&&coreTick>active.start*10&&coreTick<=active.endCore;
}
/** Called AFTER advancePower: its ten boundaries still see the ending condition. */
export function advanceWorldIncidents(world:World):void {
  const state=world.worldIncidents;if(!state||!world.gameProfile)return;
  advanceAurora305(world);
  if(state.active&&world.tick*10>state.active.endCore){
    delete state.active;emit(world,'L’éruption solaire se termine. Les appareils redémarrent selon leur alimentation et leurs interrupteurs réels.');
  }
  if(world.tick<state.nextCheck)return;
  state.nextCheck=Math.max(WORLD_FIRST_CHECK,(Math.floor(world.tick/WORLD_CHECK_INTERVAL)+1)*WORLD_CHECK_INTERVAL);
  if(world.tick%WORLD_CHECK_INTERVAL!==0)return;
  state.checks++;
  if(random(state)>=WORLD_CATEGORY_CHANCE)return;
  state.opportunities++;
  const ticket=random(state)*4;
  // Eclipse and Aurora keep their absent tickets; no retries or renormalization.
  if(ticket>=1.5&&ticket<2.8)resolveSelectedSolarFlare(world);
  else if(ticket>=2.8&&isMiscIncidents305(Number(world.schemaVersion)))resolveSelectedAurora305(world,()=>random(state));
}
