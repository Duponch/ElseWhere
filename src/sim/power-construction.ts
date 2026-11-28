import {isConduitKind} from './conduit-kinds-382.ts';
import {isShipCasketKind277,SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import {isShipAddedKind276,SHIP_ADDED_CONTENT_276} from './ship-part-content-276.ts';
import {SCHEMA_VERSION,type JobKind,type ResourceKind} from './types.ts';

/** Completed Core power conduits (including hidden conduits in 1.6) have
 * zero fill and are not edifices. They are neither a BlocksPlanting nor a
 * SpawningWipes obstacle, so any vegetation can later grow on that cell.
 * This is a coexistence rule, NOT the clearance rule during construction:
 * physical Frames and the costly-plant clearance threshold stay separate.
 * Rocks are not vegetation and never share the installed conduit. */
export const conduitKeepsPlant=(kind:JobKind|import('./types.ts').StructureKind,plant:ResourceKind,version:number=SCHEMA_VERSION):boolean=>
 isConduitKind(kind)&&(version>=381?plant!=='rock':['rice','cotton','potato','corn','haygrass','hops','devilstrand'].includes(plant));
export const powerConstructionSkill=(kind:JobKind):number=>isShipCasketKind277(kind)?SHIP_CASKET_CONTENT_277.constructionSkill:isShipAddedKind276(kind)?SHIP_ADDED_CONTENT_276[kind].constructionSkill:kind==='ship-reactor'||kind==='geothermal-generator'?8:kind==='deep-drill'?4:kind==='ground-scanner'?8:kind==='vitals-monitor'?8:kind==='hydroponics-basin'?4:kind==='heater'?5:kind==='wind-turbine'?4:kind==='solar-generator'?6:0;
