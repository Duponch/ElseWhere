import {isConduitKind} from './conduit-kinds-382.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {isShipAddedKind276} from './ship-part-content-276.ts';
import { solarPowerOutput } from './solar-rules.ts';
import { SUN_LAMP_DEMAND,sunLampScheduled } from './sun-lamp.ts';
import { empStructureActive } from './emp-state.ts';
import { GEOTHERMAL_POWER_WATTS_264 } from './geothermal-state-264.ts';
import type { Structure,World } from './types.ts';

export const POWER_OUTPUT=1000;
export const LAMP_DEMAND=30;
export const CONNECTION_RANGE=6;
/** switchOn is the physical switch, absent means on. Actual supply persists
 * independently; a brownout cannot rewrite the player's physical switch. */
export interface PowerState { on:boolean; parentId:number|null;switchOn?:boolean }
export const isPowerTrader=(kind:unknown):boolean=>kind==='ship-reactor'||kind==='electric-smithy'||kind==='geothermal-generator'||kind==='electric-crematorium'||kind==='electric-smelter'||kind==='biofuel-refinery'||kind==='chemfuel-generator'||kind==='nutrient-paste-dispenser'||kind==='orbital-beacon'||kind==='comms-console'||kind==='deep-drill'||kind==='ground-scanner'||kind==='vitals-monitor'||kind==='hydroponics-basin'||kind==='mini-turret'||kind==='tube-television'||kind==='wood-generator'||kind==='solar-generator'||kind==='wind-turbine'||kind==='heater'||kind==='standing-lamp'||kind==='wall-lamp'||kind==='sun-lamp'||kind==='cooler'||kind==='electric-stove'||kind==='electric-tailor-bench'||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='multi-analyzer'||kind==='fabrication-bench'||kind==='autodoor';
export const isElectrical=(kind:unknown):boolean=>isShipComputerSensorsKind298(kind)||isShipCasketKind277(kind)||isShipAddedKind276(kind)||isPowerTrader(kind)||kind==='battery'||isConduitKind(kind)||kind==='power-switch';
export const isFlickable=(kind:unknown):boolean=>kind==='electric-smithy'||kind==='electric-crematorium'||kind==='electric-smelter'||kind==='biofuel-refinery'||kind==='chemfuel-generator'||kind==='nutrient-paste-dispenser'||kind==='orbital-beacon'||kind==='comms-console'||kind==='deep-drill'||kind==='ground-scanner'||kind==='vitals-monitor'||kind==='hydroponics-basin'||kind==='mini-turret'||kind==='tube-television'||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='multi-analyzer'||kind==='fabrication-bench'||kind==='wood-generator'||kind==='standing-lamp'||kind==='wall-lamp'||kind==='sun-lamp'||kind==='cooler'||kind==='heater'||kind==='electric-stove'||kind==='electric-tailor-bench'||kind==='power-switch';
export const newPowerState=(kind:unknown):PowerState=>({on:kind==='ship-reactor'||kind==='geothermal-generator'||kind==='wood-generator'||kind==='solar-generator'||kind==='wind-turbine',parentId:null});
export const isPowerActive=(s:Structure):boolean=>!s.breakdown&&!!s.power?.on&&s.power.switchOn!==false&&(!['wood-generator','chemfuel-generator'].includes(s.kind)||!!s.fuel?.ticks);
export const powerDemand=(s:Structure):number=>s.kind==='electric-smithy'?210:s.kind==='electric-crematorium'?250:s.kind==='electric-smelter'?700:s.kind==='biofuel-refinery'?170:s.kind==='nutrient-paste-dispenser'?200:s.kind==='orbital-beacon'?40:s.kind==='comms-console'?200:s.kind==='deep-drill'?200:s.kind==='ground-scanner'?700:s.kind==='vitals-monitor'?80:s.kind==='hydroponics-basin'?70:s.kind==='mini-turret'?80:s.kind==='tube-television'?200:s.kind==='electric-stove'||s.kind==='machining-table'?350:s.kind==='hi-tech-research-bench'||s.kind==='fabrication-bench'?250:s.kind==='multi-analyzer'?200:s.kind==='electric-tailor-bench'?120:s.kind==='autodoor'?50:s.kind==='cooler'?(s.cooler?.high?200:20):s.kind==='heater'?(s.heater?.high?175:17.5):s.kind==='standing-lamp'||s.kind==='wall-lamp'?LAMP_DEMAND:s.kind==='sun-lamp'?SUN_LAMP_DEMAND:0;
export const powerPotential=(s:Structure,world?:World):number=>s.kind==='ship-reactor'?1000:s.kind==='geothermal-generator'?GEOTHERMAL_POWER_WATTS_264:s.kind==='chemfuel-generator'||s.kind==='wood-generator'?POWER_OUTPUT:s.kind==='solar-generator'?(world?Math.round(solarPowerOutput(world,s)):0):s.kind==='wind-turbine'?(s.wind?.cachedWatts??0):-powerDemand(s);
export const powerWatts=(s:Structure,world?:World,core=world?.tick===undefined?undefined:world.tick*10):number=>
  (core===undefined?!s.emp:!empStructureActive(s,core))&&isPowerActive(s)&&(s.kind!=='sun-lamp'||!!world&&sunLampScheduled(world))?powerPotential(s,world):0;
