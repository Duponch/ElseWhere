import {isShipCasketKind277,SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {isShipAddedKind276,SHIP_ADDED_CONTENT_276} from './ship-part-content-276.ts';
import type { JobKind,ResourceKind } from './types.ts';

/** Core compares harvestWork strictly with Dandelion's 200 Core ticks.
 * The four cultivated plants tie that value; trees and berry bushes exceed it. */
export const conduitKeepsPlant=(kind:JobKind|import('./types.ts').StructureKind,plant:ResourceKind):boolean=>kind==='power-conduit'&&['rice','cotton','potato','corn','haygrass','hops','devilstrand'].includes(plant);
export const powerConstructionSkill=(kind:JobKind):number=>isShipCasketKind277(kind)?SHIP_CASKET_CONTENT_277.constructionSkill:isShipAddedKind276(kind)?SHIP_ADDED_CONTENT_276[kind].constructionSkill:kind==='ship-reactor'||kind==='geothermal-generator'?8:kind==='deep-drill'?4:kind==='ground-scanner'?8:kind==='vitals-monitor'?8:kind==='hydroponics-basin'?4:kind==='heater'?5:kind==='wind-turbine'?4:kind==='solar-generator'?6:0;
