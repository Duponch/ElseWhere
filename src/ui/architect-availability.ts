import { FLOOR_DEFINITIONS,isBuildableFloor,isFloorKind,floorAvailable } from '../sim/flooring';
import { FURNITURE_DEFINITIONS,isHabitatFurnitureKind } from '../sim/furniture-stats';
import { researchUnlocked,type ResearchProject } from '../sim/research';
import {isSchema276OrLater,isSchema277OrLater,isSchema281OrLater} from '../sim/schema-compatibility-257';
import {isShipAddedKind276} from '../sim/ship-part-content-276';
import type { World } from '../sim/types';
import type { ArchitectCategory, Tool } from './layout';

/** Research requirements for ordinary construction, without installation's
 * exemptions. Furniture and floors keep their delivered definition as owner. */
const BUILD_RESEARCH:Readonly<Partial<Record<Tool,ResearchProject>>>=Object.freeze({
  'ship-computer':'ship-computer','ship-sensors':'ship-sensors',
  'firefoam-popper':'firefoam','ship-cryptosleep-casket':'ship-cryptosleep','ship-beam':'ship-basics','ship-engine':'ship-engine',
  'ship-reactor':'ship-reactor','cryptosleep-casket':'cryptosleep',vent:'complex-furniture',autodoor:'autodoors','mini-turret':'gun-turrets','vitals-monitor':'vitals-monitor',
  'tube-television':'tube-television',cooler:'air-conditioning',battery:'batteries',
  'fueled-smithy':'smithing','electric-smithy':'smithing',brewery:'brewing','fermenting-barrel':'brewing','geothermal-generator':'geothermal-power','solar-generator':'solar-power','hydroponics-basin':'hydroponics',
  'deep-drill':'deep-drilling','ground-scanner':'ground-scanner',
  'orbital-beacon':'microelectronics','comms-console':'microelectronics',
  'nutrient-paste-dispenser':'nutrient-paste',hopper:'nutrient-paste',
  'tailor-bench':'complex-clothing','electric-tailor-bench':'complex-clothing',
  'drug-lab':'drug-production','biofuel-refinery':'biofuel-refining',
  'machining-table':'machining','hi-tech-research-bench':'microelectronics',
  'multi-analyzer':'multi-analyzer','fabrication-bench':'fabrication',
});

/** Existing command/material compatibility boundaries. These describe the
 * format, never the colony's stock, selected material, workers or terrain. */
const MIN_SCHEMA:Readonly<Partial<Record<Tool,number>>>=Object.freeze({
  'ship-computer':298,'ship-sensors':298,
  'ship-cryptosleep-casket':277,'ship-beam':276,'ship-engine':276,
  'ship-reactor':275,'cryptosleep-casket':271,'fueled-smithy':267,'electric-smithy':267,brewery:265,'fermenting-barrel':265,'geothermal-generator':264,bedroll:256,'torch-lamp':249,'build-bridge':247,'remove-bridge':247,vent:244,'sleeping-spot':232,shelf:229,'small-shelf':229,'spike-trap':226,
  'electric-crematorium':225,'double-bed':224,'electric-smelter':222,
  'animal-sleeping-spot':221,'biofuel-refinery':218,'chemfuel-generator':218,
  'nutrient-paste-dispenser':217,hopper:217,'orbital-beacon':216,
  'comms-console':216,'deep-drill':215,'ground-scanner':215,
  'vitals-monitor':211,'sterile-tile':211,'drug-lab':206,
  'hydroponics-basin':203,'mini-turret':193,'tube-television':190,
  sandbags:189,'hospital-bed':187,'sun-lamp':177,autodoor:143,
  'fabrication-bench':123,'hi-tech-research-bench':123,'multi-analyzer':123,
  'chess-table':122,fence:119,'fence-gate':119,'pen-marker':119,
  'art-bench':104,'machining-table':101,'electric-tailor-bench':90,
  armchair:90,'dining-chair':90,'end-table':90,dresser:90,
  'table-square':90,'table-long':90,'flower-pot':90,grave:89,'remove-floor':89,
  heater:87,'wind-turbine':87,'power-conduit':85,'power-switch':85,
  battery:85,'solar-generator':85,'fueled-stove':84,'electric-stove':84,
  'butcher-table':84,cooler:75,'research-bench':73,'tailor-bench':73,
  'wood-generator':42,'standing-lamp':42,'passive-cooler':40,
});

const KEY_RESEARCH:readonly ResearchProject[]=Object.freeze([...new Set([
  'ship-basics',...Object.values(BUILD_RESEARCH),
  ...Object.values(FURNITURE_DEFINITIONS).map(definition=>definition.research),
  ...Object.values(FLOOR_DEFINITIONS).map(definition=>definition.research),
].filter((project):project is ResearchProject=>project!==null&&project!==undefined))]);

/** The Ship category follows ShipBasics, before its reactor research finishes. */
export const architectCategoryAvailable=(world:World,category:ArchitectCategory):boolean=>category!=='ship'||researchUnlocked(world,'ship-basics');

/** Catalogue visibility only. Placement still has its own shared simulation
 * validation; an occupied cell or an empty stock never removes an icon. */
export function architectToolAvailable(world:World,tool:Tool):boolean {
  if(tool==='firefoam-popper'&&![290,291,292,293,294,295,296,297,298,299,300,301].includes(world.schemaVersion))return false;
  if(tool==='smooth-floor'&&!isSchema281OrLater(world.schemaVersion))return false;
  if(tool==='ship-cryptosleep-casket'&&!isSchema277OrLater(world.schemaVersion))return false;
  if(isShipAddedKind276(tool)&&!isSchema276OrLater(world.schemaVersion))return false;
  if((tool==='snow-clear'||tool==='remove-snow-clear')&&!world.snow)return false;
  if(isFloorKind(tool)&&(!isBuildableFloor(tool)||!floorAvailable(tool,world.schemaVersion)))return false;
  if(world.schemaVersion<(MIN_SCHEMA[tool]??(isBuildableFloor(tool)?89:0)))return false;
  const project=isBuildableFloor(tool)?FLOOR_DEFINITIONS[tool].research
    :isHabitatFurnitureKind(tool)?FURNITURE_DEFINITIONS[tool].research
    :BUILD_RESEARCH[tool];
  return !project||researchUnlocked(world,project);
}

/** Completion bits, read when adopting a snapshot. Progress,
 * project selection and completion dates do not trigger catalogue DOM work. */
export function architectAvailabilityKey(world:World):string {
  // The completion vector stays collision-free as the delivered catalogue grows.
  let completed='';
  for(const project of KEY_RESEARCH)completed+=researchUnlocked(world,project)?'1':'0';
  return `${world.schemaVersion}:${world.snow?1:0}:${completed}`;
}
