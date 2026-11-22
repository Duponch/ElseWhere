import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { isRoomDoor } from './door-rules.ts';
import type { PlantSpecies } from './biome-flora.ts';
import type { Resource,ResourceKind,StructureKind } from './types.ts';

/** Logical fill, not model height, navigation or the final cover probability.
 * Sources, version limits and decorative-stone decision: combat-world-reference. */
export const STRUCTURE_SHOT_FILL:Readonly<Record<StructureKind,number>>=Object.freeze({'egg-box':.3,'tool-cabinet':.5,'firefoam-popper':.25,'ship-cryptosleep-casket':.5,'ship-computer':1,'ship-sensors':1,'ship-beam':1,'ship-engine':1,'ship-reactor':1,'cryptosleep-casket':.5,'fueled-smithy':.5,'electric-smithy':.5,brewery:.5,'fermenting-barrel':.45,'insect-hive':.5,'glow-pod':.2,'ship-chunk':.5,'ancient-cryptosleep-casket':.5,column:.25,urn:.4,'stele-large':.5,'stele-grand':.5,sarcophagus:.5,'ancient-road-barrier':.5,'ancient-road-lamp':.25,'torch-lamp':.15,vent:1,'spike-trap':0,'ied-high-explosive':0,'ied-incendiary':0,'electric-crematorium':1,'electric-smelter':.5,'biofuel-refinery':.5,'chemfuel-generator':.9,'geothermal-generator':1,'nutrient-paste-dispenser':1,hopper:.5,'orbital-beacon':.15,'comms-console':.5,'deep-drill':.5,'ground-scanner':.4,'drug-lab':.5,'hydroponics-basin':.3,'mini-turret':.4,'tube-television':.4,sandbags:.55,fence:.15,'fence-gate':.15,'pen-marker':.1,'art-bench':.5,'fabrication-bench':.5,'hi-tech-research-bench':.5,'multi-analyzer':.5,'small-sculpture':.35,'large-sculpture':.5,grave:0,heater:.4,'wind-turbine':.5,
  'vitals-monitor':.2,'power-conduit':0,'power-switch':0,battery:.4,'solar-generator':.5,
  'fueled-stove':.5,'electric-stove':.5,'butcher-table':.5,
  'butcher-spot':0,
  'machining-table':.5,cooler:1,'research-bench':.5,'tailor-bench':.5,'electric-tailor-bench':.5,wall:1,door:1,autodoor:1,  'sleeping-spot':0,'animal-sleeping-spot':0,'crafting-spot':0,'wood-generator':1,stonecutter:.5,bedroll:0,bed:.4,'double-bed':.4,'hospital-bed':.4,table:.4,'table-square':.4,'table-long':.4,'table-large':.4,'double-bedroll':0,'double-sleeping-spot':0,'wall-lamp':.2,
  shelf:.4,'small-shelf':.4,'passive-cooler':.4,stool:.2,'dining-chair':.2,armchair:.3,couch:.4,'end-table':.2,dresser:.4,'flower-pot':.2,campfire:.2,'standing-lamp':.2,'sun-lamp':.2,horseshoes:0,'chess-table':.4,
  'hoopstone-ring':0,'billiards-table':.4,'game-of-ur-board':.2,'poker-table':.4,
});
export const RESOURCE_SHOT_FILL:Readonly<Record<ResourceKind,number>>=Object.freeze({
  hops:0,devilstrand:0,tree:.25,berries:.2,'wild-plant':0,rice:0,potato:0,corn:0,cotton:0,healroot:0,haygrass:0,
  // These small decorative pebbles are not the haulable Core chunks. Their
  // replacement by actual chunks is deferred; don't create invisible cover.
  rock:0,
});
/** Only species that override their resource-kind Core fill need
 * entries. Other wild plants stay at zero; ordinary trees retain .25. */
const SPECIES_SHOT_FILL:Readonly<Partial<Record<PlantSpecies,number>>>=Object.freeze({agave:.2,saguaro:.35,alocasia:.2,bush:.2,clivia:.2,rafflesia:.2});
export const resourceShotFill=(resource:Pick<Resource,'kind'|'species'>):number=>
  resource.species===undefined?RESOURCE_SHOT_FILL[resource.kind]:SPECIES_SHOT_FILL[resource.species]??RESOURCE_SHOT_FILL[resource.kind];
export const FRAME_SHOT_FILL=.2;
export const itemShotFill=(item:ItemId):number=>ITEM_DEFINITIONS[item].kind==='chunk'?.5:0;

/** Relative definition layers for ThingCovered, NOT physical/render heights.
 * A logical OPEN door retains its full fill and definition layer in that test. */
export const SHOT_LAYER=Object.freeze({heater:.4,'wind-turbine':.5,lowPlant:11,door:14,building:15,item:18,pawn:23});
export const structureShotLayer=(kind:StructureKind):number=>kind==='hydroponics-basin'?SHOT_LAYER.lowPlant:isRoomDoor(kind)?SHOT_LAYER.door:SHOT_LAYER.building;
