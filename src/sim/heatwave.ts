import { TICKS_PER_DAY,type World } from './types.ts';
import {journalLetter352} from './letter-producers-352.ts';
export interface HeatwaveCalendar {profile:'camp-heat-v1';rng:number;nextAt:number;serial:number;active?:{start:number;end:number};lastEnd?:number}
const random=(s:HeatwaveCalendar)=>{let n=s.rng;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng/0x100000000;};
const log=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'need',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};
/** Scenario cadence, explicitly not the Core storyteller's random event selection. */
export function enableHeatwaves(w:World):void {
  if(w.gameProfile)throw new Error('Historical heatwaves are unavailable for the selected storyteller.');
  if(w.heatwaves)return;
  const s=w.heatwaves={profile:'camp-heat-v1' as const,rng:((w.seed^0x4ea774)>>>0)||1,nextAt:0,serial:0};
  s.nextAt=w.tick+Math.floor((6+random(s))*TICKS_PER_DAY);
}
/** Both clocks own their histories; the thermal effect has one shared shape. */
export function activeHeatwave(world:Pick<World,'heatwaves'|'miscIncidents'>):{active?:{start:number;end:number}}|undefined {
  return world.miscIncidents?.active?world.miscIncidents:world.heatwaves;
}
export function heatwaveOffset(tick:number,state?:{active?:{start:number;end:number}}):number {
  const a=state?.active;return a?17*Math.max(0,Math.min(1,(tick-a.start)/1200,(a.end-tick)/1200)):0;
}
export function advanceHeatwaves(w:World):void {
  const s=w.heatwaves;if(!s)return;
  if(s.active){if(w.tick>=s.active.end){s.lastEnd=w.tick;delete s.active;log(w,'La canicule se termine. Les pièces retrouvent progressivement leur température habituelle.');}return;}
  if(w.tick<s.nextAt)return;
  const start=w.tick,end=start+Math.floor((1.5+2*random(s))*TICKS_PER_DAY);
  s.active={start,end};s.serial++;s.nextAt=end+Math.floor((30+10*random(s))*TICKS_PER_DAY);
  log(w,'Canicule : préparez une pièce fermée et refroidie, du bois et des vêtements adaptés. Surveillez les coups de chaleur.');
  journalLetter352(w,'threat-small','Canicule');
}
