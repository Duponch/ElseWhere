import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {isShipCasketKind277} from './ship-casket-content-277.ts';
import {isShipPartKind276} from './ship-part-content-276.ts';
import type { Structure } from './types.ts';

/** Nominal roles do not depend on production, fuel or stored energy. */
export const isPowerConduit=(kind:unknown):boolean=>kind==='power-conduit';
export const isPowerTransmitter=(kind:unknown):boolean=>isShipComputerSensorsKind298(kind)||isShipCasketKind277(kind)||isShipPartKind276(kind)||kind==='geothermal-generator'||kind==='chemfuel-generator'||kind==='wood-generator'||kind==='solar-generator'||kind==='wind-turbine'||kind==='battery'||kind==='power-conduit'||kind==='power-switch';
export const isPowerConnector=(kind:unknown):boolean=>kind==='electric-smithy'||kind==='electric-crematorium'||kind==='electric-smelter'||kind==='biofuel-refinery'||kind==='nutrient-paste-dispenser'||kind==='orbital-beacon'||kind==='comms-console'||kind==='deep-drill'||kind==='ground-scanner'||kind==='vitals-monitor'||kind==='hydroponics-basin'||kind==='mini-turret'||kind==='tube-television'||kind==='sun-lamp'||kind==='standing-lamp'||kind==='wall-lamp'||kind==='cooler'||kind==='heater'||kind==='electric-stove'||kind==='electric-tailor-bench'||kind==='machining-table'||kind==='hi-tech-research-bench'||kind==='multi-analyzer'||kind==='fabrication-bench'||kind==='autodoor';

/** A stopped generator remains a wire. Only the physical switch opens the grid;
 * its requested state lives in a job and cannot affect this query. */
export const transmitsPowerNow=(s:Structure):boolean=>isPowerTransmitter(s.kind)&&(s.kind!=='power-switch'||s.power?.switchOn!==false);
export const allowsWireConnection=(kind:unknown):boolean=>isPowerTransmitter(kind)&&kind!=='power-switch';

/** True means the two footprints cannot coexist. A conduit can share a cell
 * with a wall, door or consumer, but never with another transmitter. V85 rejects
 * replacing a conduit by a transmitter until that replacement is conservative. */
export function sharesConstructionLayer(aKind:unknown,bKind:unknown):boolean {
  if(aKind==='smooth-floor'||bKind==='smooth-floor')return aKind===bKind;
  if(aKind==='smooth-wall'||bKind==='smooth-wall')return aKind===bKind;
  if(aKind==='build-bridge'||aKind==='remove-bridge'||bKind==='build-bridge'||bKind==='remove-bridge')return true;
  const floor=(k:unknown)=>k==='lay-floor'||k==='remove-floor';
  if(floor(aKind)||floor(bKind))return floor(aKind)&&floor(bKind);
  if(isPowerConduit(aKind))return isPowerTransmitter(bKind);
  if(isPowerConduit(bKind))return isPowerTransmitter(aKind);
  return true;
}
