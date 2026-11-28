import {isConduitKind} from './conduit-kinds-382.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import {STRUCTURE_DEFINITIONS} from './definitions.ts';
import type { Structure } from './types.ts';

/** Nominal roles do not depend on production, fuel or stored energy. */
export const isPowerConduit=isConduitKind;
export const isPowerTransmitter=(kind:unknown):boolean=>isShipComputerSensorsKind298(kind)||isShipCasketKind277(kind)||isShipPartKind276(kind)||kind==='geothermal-generator'||kind==='chemfuel-generator'||kind==='wood-generator'||kind==='solar-generator'||kind==='wind-turbine'||kind==='battery'||isConduitKind(kind)||kind==='power-switch';
export const isPowerConnector=(kind:unknown):boolean=>kind==='electric-smithy'||kind==='electric-crematorium'||kind==='electric-smelter'||kind==='biofuel-refinery'||kind==='nutrient-paste-dispenser'||kind==='orbital-beacon'||kind==='comms-console'||kind==='deep-drill'||kind==='ground-scanner'||kind==='vitals-monitor'||kind==='hydroponics-basin'||kind==='mini-turret'||kind==='tube-television'||kind==='sun-lamp'||kind==='standing-lamp'||kind==='wall-lamp'||kind==='cooler'||kind==='heater'||kind==='electric-stove'||kind==='electric-tailor-bench'||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='multi-analyzer'||kind==='fabrication-bench'||kind==='autodoor';

/** A stopped generator remains a wire. Only the physical switch opens the grid;
 * its requested state lives in a job and cannot affect this query. */
export const transmitsPowerNow=(s:Structure):boolean=>isPowerTransmitter(s.kind)&&(s.kind!=='power-switch'||s.power?.switchOn!==false);
export const allowsWireConnection=(kind:unknown):boolean=>isPowerTransmitter(kind)&&kind!=='power-switch';

/** Core 1.6.4871: Placeworker_AttachedToWall forbids full Fillage in the
 * attachment's cell, and only an attachment facing the same wall. Full
 * Fillage means fillPercent > .99 (ThingDef.Fillage). These are the admitted
 * full-fillage Core building families, independent of our collision model.
 * The other supported buildings permit non-edifices; natural rock is already
 * excluded by terrain admission. */
const FULL_ATTACHMENT_BLOCKERS_382:ReadonlySet<unknown>=new Set(['wall','door','autodoor','fence-gate','cooler','vent','geothermal-generator','electric-crematorium','nutrient-paste-dispenser','ship-beam','ship-engine','ship-reactor','ship-computer','ship-sensors']);
/** Surface readers must retain the floor building over a wall attachment,
 * irrespective of the order in which the two objects are constructed. */
export function surfacePriority382(kind:unknown,version:number):number {
  return isConduitKind(kind)?0:version>=382&&kind==='wall-lamp'?1:2;
}
/** True means the two footprints cannot coexist. A conduit can share a cell
 * with a wall, door or consumer, but never with another transmitter. V85 rejects
 * replacing a conduit by a transmitter until that replacement is conservative. */
export function sharesConstructionLayer(aKind:unknown,bKind:unknown,version=381,aOrientation?:number,bOrientation?:number):boolean {
  if(aKind==='smooth-floor'||bKind==='smooth-floor')return aKind===bKind;
  if(aKind==='smooth-wall'||bKind==='smooth-wall')return aKind===bKind;
  if(aKind==='build-bridge'||aKind==='remove-bridge'||bKind==='build-bridge'||bKind==='remove-bridge')return true;
  const floor=(k:unknown)=>k==='lay-floor'||k==='remove-floor';
  if(floor(aKind)||floor(bKind))return floor(aKind)&&floor(bKind);
  if(isPowerConduit(aKind))return isPowerTransmitter(bKind);
  if(isPowerConduit(bKind))return isPowerTransmitter(aKind);
  if(version>=382&&(aKind==='wall-lamp'||bKind==='wall-lamp')){
    if(aKind===bKind)return aOrientation===undefined||bOrientation===undefined||aOrientation===bOrientation;
    const other=aKind==='wall-lamp'?bKind:aKind;
    if(typeof other==='string'&&Object.hasOwn(STRUCTURE_DEFINITIONS,other))return FULL_ATTACHMENT_BLOCKERS_382.has(other);
  }
  return true;
}
