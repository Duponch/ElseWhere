import {isSchema298OrLater,isSchema290OrLater} from './schema-compatibility-257.ts';
import {BOW_RESEARCH_326,isBowResearch326,isBowSchema326,bowResearchUnlocked326,bowResearchPrerequisite326} from './bows-326.ts';
export {recurveBowUnlocked326,greatbowUnlocked326} from './bows-326.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {VICTORY_RESEARCH_CONTENT_298,isVictoryResearchProject298,type VictoryResearchProject298} from './victory-research-content-298.ts';
import {victoryResearchUnlocked298,victoryResearchPrerequisite298} from './victory-research-298.ts';
import {TREE_SOWING_COST_291,treeSowingUnlocked291} from './forestry-content-291.ts';
import {FIREFOAM_CONTENT_290,firefoamResearchUnlocked290} from './firefoam-content-290.ts';
import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {SHIP_CASKET_RESEARCH_277,shipCryptosleepUnlocked277,isShipCasketResearchProject277,shipCasketResearchPrerequisite277} from './ship-casket-research-277.ts';
export {shipCryptosleepUnlocked277} from './ship-casket-research-277.ts';
import {isSchema276OrLater} from './schema-compatibility-257.ts';
import {SHIP_ENGINE_RESEARCH_276,shipEngineUnlocked276,isShipEngineResearchProject276} from './ship-engine-research-276.ts';
export {shipEngineUnlocked276} from './ship-engine-research-276.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {SHIP_RESEARCH_POINTS_275,isShipResearchProject275} from './ship-reactor-content-275.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {PROSTHETIC_RESEARCH_COST_273} from './prosthetic-content-273.ts';
import {isSchema270OrLater,isSchema271OrLater} from './schema-compatibility-257.ts';
import {CRYPTOSLEEP_RESEARCH_POINTS_271} from './cryptosleep-content-271.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { otherCampaignMap } from './secondary-site-context.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { workPriority } from './work-types.ts';
import { cookingSpot } from './cooking-bills.ts';
import { researchFacilityDistance,researchFacilityLinked } from './research-facilities.ts';
import { CleanlinessCapture } from './filth-room.ts';
import { glowIgnoredByBlindPawn } from './glow-rules-301.ts';
import { isPowerActive } from './power-rules.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { deconstructionReserved } from './deconstruction-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { routeToJob,type Reachability } from './pathfinding.ts';
import { releaseAssignments } from './work-release.ts';
import { learnSkill,type SkillRecord } from './skills.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { tailoringTemperatureFactor } from './crafting-quality.ts';
import type { WorkEnvironment } from './work-environment.ts';
import type { Cell,CommandResult,Pawn,Structure,World } from './types.ts';
import { structuresOfKind, structureById } from './structure-navigation.ts';

export const RESEARCH_SCALE=1_000_000;export const SHIP_CRYPTOSLEEP_RESEARCH_COST277=SHIP_CASKET_RESEARCH_277.scaledCost;export const SHIP_ENGINE_RESEARCH_COST276=SHIP_ENGINE_RESEARCH_276.points*RESEARCH_SCALE;
export const SHIP_BASICS_RESEARCH_COST275=SHIP_RESEARCH_POINTS_275.basics*RESEARCH_SCALE;
export const SHIP_REACTOR_RESEARCH_COST275=SHIP_RESEARCH_POINTS_275.reactor*RESEARCH_SCALE;
export const shipBasicsUnlocked275=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isSchema275OrLater(w.schemaVersion)&&w.research?.shipBasics?.completedAt!==undefined;
export const shipReactorUnlocked275=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isSchema275OrLater(w.schemaVersion)&&w.research?.shipReactor?.completedAt!==undefined;
export const PROSTHETICS_RESEARCH_COST273=PROSTHETIC_RESEARCH_COST_273*RESEARCH_SCALE;
export const prostheticsUnlocked273=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isSchema273OrLater(w.schemaVersion)&&w.research?.prosthetics?.completedAt!==undefined;
export const CRYPTOSLEEP_RESEARCH_COST271=CRYPTOSLEEP_RESEARCH_POINTS_271*RESEARCH_SCALE;
export const cryptosleepUnlocked271=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isSchema271OrLater(w.schemaVersion)&&w.research?.cryptosleep?.completedAt!==undefined;
/** Schema 326 Core RecurveBow (400) and Greatbow (600, after RecurveBow). */
export const RECURVE_BOW_RESEARCH_COST326=BOW_RESEARCH_326['recurve-bow'].scaledCost,GREATBOW_RESEARCH_COST326=BOW_RESEARCH_326.greatbow.scaledCost;
export const LONG_BLADES_RESEARCH_COST=400*RESEARCH_SCALE;
export const longBladesUnlocked270=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isSchema270OrLater(w.schemaVersion)&&w.research?.longBlades?.completedAt!==undefined;
export const BREWING_RESEARCH_COST=400*RESEARCH_SCALE;
export const brewingUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=265&&w.research?.brewing?.completedAt!==undefined;
export const GEOTHERMAL_POWER_RESEARCH_COST=3200*RESEARCH_SCALE;
export const geothermalPowerUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=264&&w.research?.geothermalPower?.completedAt!==undefined;
export const PEMMICAN_RESEARCH_COST=500*RESEARCH_SCALE;
export const pemmicanUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=248&&w.research?.pemmican?.completedAt!==undefined;
export const BIOFUEL_REFINING_RESEARCH_COST=700*RESEARCH_SCALE;
export const BIOFUEL_RESEARCH_COST=BIOFUEL_REFINING_RESEARCH_COST;
export const biofuelRefiningUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=218&&w.research?.biofuelRefining?.completedAt!==undefined;
export const NUTRIENT_PASTE_RESEARCH_COST=400*RESEARCH_SCALE;
export const nutrientPasteUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=217&&w.research?.nutrientPaste?.completedAt!==undefined;
export const DEEP_DRILLING_RESEARCH_COST=1000*RESEARCH_SCALE,GROUND_SCANNER_RESEARCH_COST=1000*RESEARCH_SCALE;
export const deepDrillingUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=215&&w.research?.deepDrilling?.completedAt!==undefined;
export const groundScannerUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=215&&w.research?.groundScanner?.completedAt!==undefined;
export const STERILE_MATERIALS_RESEARCH_COST=600*RESEARCH_SCALE,VITALS_MONITOR_RESEARCH_COST=2500*RESEARCH_SCALE;
export const sterileMaterialsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=211&&w.research?.sterileMaterials?.completedAt!==undefined;
export const vitalsMonitorUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=211&&w.research?.vitalsMonitor?.completedAt!==undefined;
export const DRUG_PRODUCTION_RESEARCH_COST=500*RESEARCH_SCALE,MEDICINE_PRODUCTION_RESEARCH_COST=1500*RESEARCH_SCALE;
export const drugProductionUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=206&&w.research?.drugProduction?.completedAt!==undefined;
export const medicineProductionUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=206&&w.research?.medicineProduction?.completedAt!==undefined;
export const HYDROPONICS_RESEARCH_COST=700*RESEARCH_SCALE;
export const hydroponicsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.hydroponics?.completedAt!==undefined;
export const GUN_TURRETS_RESEARCH_COST=500*RESEARCH_SCALE;
export const gunTurretsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.gunTurrets?.completedAt!==undefined;
export const TUBE_TELEVISION_RESEARCH_COST=1000*RESEARCH_SCALE;
export const tubeTelevisionUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.tubeTelevision?.completedAt!==undefined;
export const HOSPITAL_BED_RESEARCH_COST=1200*RESEARCH_SCALE;
export const PACKAGED_SURVIVAL_MEALS_RESEARCH_COST=500*RESEARCH_SCALE;
export const packagedSurvivalMealsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.packagedSurvivalMeals?.completedAt!==undefined;
export const hospitalBedUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.hospitalBed?.completedAt!==undefined;
export const STONECUTTING_RESEARCH_COST=300*RESEARCH_SCALE,SMITHING_RESEARCH_COST=700*RESEARCH_SCALE,COMPLEX_FURNITURE_RESEARCH_COST=300*RESEARCH_SCALE;
export const stonecuttingUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.stonecutting?.completedAt!==undefined;
export const smithingUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.smithing?.completedAt!==undefined;
/** New construction only; recovered workbenches retain their own physical use. */
export const smithyConstructionUnlocked267=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.schemaVersion>=267&&smithingUnlocked(w);
export const complexFurnitureUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.complexFurniture?.completedAt!==undefined;
export const CLOTHING_RESEARCH_COST=600*RESEARCH_SCALE;
export const MACHINING_RESEARCH_COST=1000*RESEARCH_SCALE,GUNSMITHING_RESEARCH_COST=500*RESEARCH_SCALE;
export const MICROELECTRONICS_RESEARCH_COST=3000*RESEARCH_SCALE,MULTI_ANALYZER_RESEARCH_COST=4000*RESEARCH_SCALE,FABRICATION_RESEARCH_COST=4000*RESEARCH_SCALE;
export const ADVANCED_FABRICATION_RESEARCH_COST=4000*RESEARCH_SCALE;
export const RECON_ARMOR_RESEARCH_COST=6000*RESEARCH_SCALE;
export const AUTODOORS_RESEARCH_COST=600*RESEARCH_SCALE;
export const PLATE_ARMOR_RESEARCH_COST=600*RESEARCH_SCALE,FLAK_ARMOR_RESEARCH_COST=1200*RESEARCH_SCALE;
export const machiningUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.machining?.completedAt!==undefined;
export const gunsmithingUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.gunsmithing?.completedAt!==undefined;
export const plateArmorUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.plateArmor?.completedAt!==undefined;
export const flakArmorUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.flakArmor?.completedAt!==undefined;
export const microelectronicsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.microelectronics?.completedAt!==undefined;
export const multiAnalyzerUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.multiAnalyzer?.completedAt!==undefined;
export const fabricationUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.fabrication?.completedAt!==undefined;
export const advancedFabricationUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.advancedFabrication?.completedAt!==undefined;
export const reconArmorUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.reconArmor?.completedAt!==undefined;
export const autodoorsUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.autodoors?.completedAt!==undefined;
export const researchPrerequisite=(w:World,project:ResearchProject):string|undefined=>isBowResearch326(project)?bowResearchPrerequisite326(w,project):isVictoryResearchProject298(project)?victoryResearchPrerequisite298(w,project):project==='ship-cryptosleep'?shipCasketResearchPrerequisite277(w):project==='ship-basics'&&!advancedFabricationUnlocked(w)?'Fabrication avancée':(project==='ship-reactor'||project==='ship-engine')&&!shipBasicsUnlocked275(w)?'Construction de vaisseau':project==='prosthetics'&&!machiningUnlocked(w)?'Usinage':project==='cryptosleep'&&!multiAnalyzerUnlocked(w)?'Multi-analyseur':project==='long-blades'&&!smithingUnlocked(w)?'Forge':project==='deep-drilling'&&!microelectronicsUnlocked(w)?'Microélectronique':project==='ground-scanner'&&!deepDrillingUnlocked(w)?'Forage profond':project==='vitals-monitor'&&!hospitalBedUnlocked(w)?'Lit d’hôpital':project==='vitals-monitor'&&!multiAnalyzerUnlocked(w)?'Multi-analyseur':project==='medicine-production'&&!drugProductionUnlocked(w)?'Production de drogues':project==='medicine-production'&&!microelectronicsUnlocked(w)?'Microélectronique':project==='gun-turrets'&&!gunsmithingUnlocked(w)?'Armurerie':project==='tube-television'&&!complexFurnitureUnlocked(w)?'Mobilier complexe':project==='hospital-bed'&&!microelectronicsUnlocked(w)?'Microélectronique':project==='hospital-bed'&&!complexFurnitureUnlocked(w)?'Mobilier complexe':project==='machining'&&!smithingUnlocked(w)?'Forge':project==='gunsmithing'&&!machiningUnlocked(w)?'Usinage':project==='plate-armor'&&!smithingUnlocked(w)?'Forge':project==='plate-armor'&&!clothingUnlocked(w)?'Vêtements complexes':project==='flak-armor'&&!machiningUnlocked(w)?'Usinage':project==='flak-armor'&&!plateArmorUnlocked(w)?'Armure de plaques':project==='multi-analyzer'&&!microelectronicsUnlocked(w)?'Microélectronique':project==='multi-analyzer'&&!machiningUnlocked(w)?'Usinage':project==='fabrication'&&!multiAnalyzerUnlocked(w)?'Multi-analyseur':project==='advanced-fabrication'&&!fabricationUnlocked(w)?'Fabrication':project==='recon-armor'&&!fabricationUnlocked(w)?'Fabrication':project==='recon-armor'&&!clothingUnlocked(w)?'Vêtements complexes':undefined;
export type ResearchProject=VictoryResearchProject298|'recurve-bow'|'greatbow'|'tree-sowing'|'firefoam'|'ship-cryptosleep'|'ship-engine'|'ship-basics'|'ship-reactor'|'prosthetics'|'cryptosleep'|'long-blades'|'brewing'|'geothermal-power'|'pemmican'|'biofuel-refining'|'nutrient-paste'|'deep-drilling'|'ground-scanner'|'sterile-materials'|'vitals-monitor'|'drug-production'|'medicine-production'|'hydroponics'|'gun-turrets'|'tube-television'|'packaged-survival-meals'|'hospital-bed'|'machining'|'gunsmithing'|'plate-armor'|'flak-armor'|'recon-armor'|'complex-clothing'|'complex-furniture'|'air-conditioning'|'batteries'|'solar-power'|'stonecutting'|'smithing'|'microelectronics'|'multi-analyzer'|'fabrication'|'advanced-fabrication'|'autodoors';
export interface ResearchProgress {points:number;completedAt?:number}
export interface ResearchState extends ResearchProgress {recurveBow?:ResearchProgress;greatbow?:ResearchProgress;longRangeMineralScanner?:ResearchProgress;shipComputer?:ResearchProgress;shipSensors?:ResearchProgress;treeSowing291?:ResearchProgress;firefoam?:ResearchProgress;shipCryptosleep?:ResearchProgress;shipEngine?:ResearchProgress;shipBasics?:ResearchProgress;shipReactor?:ResearchProgress;prosthetics?:ResearchProgress;cryptosleep?:ResearchProgress;longBlades?:ResearchProgress;brewing?:ResearchProgress;geothermalPower?:ResearchProgress;pemmican?:ResearchProgress;biofuelRefining?:ResearchProgress;nutrientPaste?:ResearchProgress;deepDrilling?:ResearchProgress;groundScanner?:ResearchProgress;sterileMaterials?:ResearchProgress;vitalsMonitor?:ResearchProgress;drugProduction?:ResearchProgress;medicineProduction?:ResearchProgress;hydroponics?:ResearchProgress;gunTurrets?:ResearchProgress;tubeTelevision?:ResearchProgress;packagedSurvivalMeals?:ResearchProgress;hospitalBed?:ResearchProgress;machining?:ResearchProgress;gunsmithing?:ResearchProgress;plateArmor?:ResearchProgress;flakArmor?:ResearchProgress;reconArmor?:ResearchProgress;microelectronics?:ResearchProgress;multiAnalyzer?:ResearchProgress;fabrication?:ResearchProgress;advancedFabrication?:ResearchProgress;autodoors?:ResearchProgress;project:ResearchProject|null;complexFurniture?:ResearchProgress;airConditioning?:ResearchProgress;batteries?:ResearchProgress;solarPower?:ResearchProgress;stonecutting?:ResearchProgress;smithing?:ResearchProgress}
export const AIR_CONDITIONING_COST=500*RESEARCH_SCALE;
export const BATTERIES_RESEARCH_COST=400*RESEARCH_SCALE;
export const SOLAR_POWER_RESEARCH_COST=600*RESEARCH_SCALE;
export const airConditioningUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.airConditioning?.completedAt!==undefined;
export const batteriesUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.batteries?.completedAt!==undefined;
export const solarPowerUnlocked=(w:Pick<World,'schemaVersion'|'research'>):boolean=>w.research?.solarPower?.completedAt!==undefined;
export const projectProgress=(s:ResearchState,project:ResearchProject):ResearchProgress=>project==='recurve-bow'?(s.recurveBow??={points:0}):project==='greatbow'?(s.greatbow??={points:0}):project==='long-range-mineral-scanner'?(s.longRangeMineralScanner??={points:0}):project==='ship-computer'?(s.shipComputer??={points:0}):project==='ship-sensors'?(s.shipSensors??={points:0}):project==='tree-sowing'?(s.treeSowing291??={points:0}):project==='firefoam'?(s.firefoam??={points:0}):project==='ship-cryptosleep'?(s.shipCryptosleep??={points:0}):project==='ship-engine'?(s.shipEngine??={points:0}):project==='ship-basics'?(s.shipBasics??={points:0}):project==='ship-reactor'?(s.shipReactor??={points:0}):project==='prosthetics'?(s.prosthetics??={points:0}):project==='cryptosleep'?(s.cryptosleep??={points:0}):project==='long-blades'?(s.longBlades??={points:0}):project==='brewing'?(s.brewing??={points:0}):project==='geothermal-power'?(s.geothermalPower??={points:0}):project==='pemmican'?(s.pemmican??={points:0}):project==='biofuel-refining'?(s.biofuelRefining??={points:0}):project==='nutrient-paste'?(s.nutrientPaste??={points:0}):project==='deep-drilling'?(s.deepDrilling??={points:0}):project==='ground-scanner'?(s.groundScanner??={points:0}):project==='sterile-materials'?(s.sterileMaterials??={points:0}):project==='vitals-monitor'?(s.vitalsMonitor??={points:0}):project==='drug-production'?(s.drugProduction??={points:0}):project==='medicine-production'?(s.medicineProduction??={points:0}):project==='hydroponics'?(s.hydroponics??={points:0}):project==='gun-turrets'?(s.gunTurrets??={points:0}):project==='tube-television'?(s.tubeTelevision??={points:0}):project==='packaged-survival-meals'?(s.packagedSurvivalMeals??={points:0}):project==='hospital-bed'?(s.hospitalBed??={points:0}):project==='microelectronics'?(s.microelectronics??={points:0}):project==='multi-analyzer'?(s.multiAnalyzer??={points:0}):project==='fabrication'?(s.fabrication??={points:0}):project==='advanced-fabrication'?(s.advancedFabrication??={points:0}):project==='recon-armor'?(s.reconArmor??={points:0}):project==='autodoors'?(s.autodoors??={points:0}):project==='machining'?(s.machining??={points:0}):project==='gunsmithing'?(s.gunsmithing??={points:0}):project==='plate-armor'?(s.plateArmor??={points:0}):project==='flak-armor'?(s.flakArmor??={points:0}):project==='stonecutting'?(s.stonecutting??={points:0}):project==='smithing'?(s.smithing??={points:0}):project==='complex-furniture'?(s.complexFurniture??={points:0}):project==='complex-clothing'?s:project==='air-conditioning'?(s.airConditioning??={points:0}):project==='batteries'?(s.batteries??={points:0}):(s.solarPower??={points:0});
/** Pure HUD projection; rendering never initializes an historical record. */
const RESEARCH_PROGRESS_KEYS:Record<Exclude<ResearchProject,'complex-clothing'>,keyof ResearchState>={
  'recurve-bow':'recurveBow',greatbow:'greatbow',
  'long-range-mineral-scanner':'longRangeMineralScanner','ship-computer':'shipComputer','ship-sensors':'shipSensors',
  'tree-sowing':'treeSowing291',firefoam:'firefoam','ship-cryptosleep':'shipCryptosleep','ship-engine':'shipEngine','ship-basics':'shipBasics','ship-reactor':'shipReactor',
  prosthetics:'prosthetics',
  cryptosleep:'cryptosleep',
  'long-blades':'longBlades',
  brewing:'brewing',
  'geothermal-power':'geothermalPower',
  pemmican:'pemmican',
  'biofuel-refining':'biofuelRefining',
  'nutrient-paste':'nutrientPaste',
  'deep-drilling':'deepDrilling',
  'ground-scanner':'groundScanner',
  'sterile-materials':'sterileMaterials',
  'vitals-monitor':'vitalsMonitor',
  'drug-production':'drugProduction',
  'medicine-production':'medicineProduction',
  'hydroponics':'hydroponics',
  'gun-turrets':'gunTurrets',
  'tube-television':'tubeTelevision',
  'packaged-survival-meals':'packagedSurvivalMeals',
  'hospital-bed':'hospitalBed',
  'microelectronics':'microelectronics',
  'multi-analyzer':'multiAnalyzer',
  'fabrication':'fabrication',
  'advanced-fabrication':'advancedFabrication',
  'recon-armor':'reconArmor',
  'autodoors':'autodoors',
  'machining':'machining',
  'gunsmithing':'gunsmithing',
  'plate-armor':'plateArmor',
  'flak-armor':'flakArmor',
  'stonecutting':'stonecutting',
  'smithing':'smithing',
  'complex-furniture':'complexFurniture',
  'air-conditioning':'airConditioning',
  'batteries':'batteries',
  'solar-power':'solarPower'
};
export function readProjectProgress(state:ResearchState,project:ResearchProject):ResearchProgress|undefined {
  if(project==='complex-clothing')return state;
  const progress=state[RESEARCH_PROGRESS_KEYS[project]];
  return progress && typeof progress==='object' ? progress : undefined;
}
export const researchCost=(project:ResearchProject):number=>isBowResearch326(project)?BOW_RESEARCH_326[project].scaledCost:isVictoryResearchProject298(project)?VICTORY_RESEARCH_CONTENT_298[project].scaledCost:project==='tree-sowing'?TREE_SOWING_COST_291:project==='firefoam'?FIREFOAM_CONTENT_290.researchPoints*RESEARCH_SCALE:project==='ship-cryptosleep'?SHIP_CRYPTOSLEEP_RESEARCH_COST277:project==='ship-engine'?SHIP_ENGINE_RESEARCH_COST276:project==='ship-basics'?SHIP_BASICS_RESEARCH_COST275:project==='ship-reactor'?SHIP_REACTOR_RESEARCH_COST275:project==='prosthetics'?PROSTHETICS_RESEARCH_COST273:project==='cryptosleep'?CRYPTOSLEEP_RESEARCH_COST271:project==='long-blades'?LONG_BLADES_RESEARCH_COST:project==='brewing'?BREWING_RESEARCH_COST:project==='geothermal-power'?GEOTHERMAL_POWER_RESEARCH_COST:project==='pemmican'?PEMMICAN_RESEARCH_COST:project==='biofuel-refining'?BIOFUEL_REFINING_RESEARCH_COST:project==='nutrient-paste'?NUTRIENT_PASTE_RESEARCH_COST:project==='deep-drilling'?DEEP_DRILLING_RESEARCH_COST:project==='ground-scanner'?GROUND_SCANNER_RESEARCH_COST:project==='sterile-materials'?STERILE_MATERIALS_RESEARCH_COST:project==='vitals-monitor'?VITALS_MONITOR_RESEARCH_COST:project==='drug-production'?DRUG_PRODUCTION_RESEARCH_COST:project==='medicine-production'?MEDICINE_PRODUCTION_RESEARCH_COST:project==='hydroponics'?HYDROPONICS_RESEARCH_COST:project==='gun-turrets'?GUN_TURRETS_RESEARCH_COST:project==='tube-television'?TUBE_TELEVISION_RESEARCH_COST:project==='packaged-survival-meals'?PACKAGED_SURVIVAL_MEALS_RESEARCH_COST:project==='hospital-bed'?HOSPITAL_BED_RESEARCH_COST:project==='microelectronics'?MICROELECTRONICS_RESEARCH_COST:project==='multi-analyzer'?MULTI_ANALYZER_RESEARCH_COST:project==='fabrication'?FABRICATION_RESEARCH_COST:project==='advanced-fabrication'?ADVANCED_FABRICATION_RESEARCH_COST:project==='recon-armor'?RECON_ARMOR_RESEARCH_COST:project==='autodoors'?AUTODOORS_RESEARCH_COST:project==='machining'?MACHINING_RESEARCH_COST:project==='gunsmithing'?GUNSMITHING_RESEARCH_COST:project==='plate-armor'?PLATE_ARMOR_RESEARCH_COST:project==='flak-armor'?FLAK_ARMOR_RESEARCH_COST:project==='stonecutting'?STONECUTTING_RESEARCH_COST:project==='smithing'?SMITHING_RESEARCH_COST:project==='complex-furniture'?COMPLEX_FURNITURE_RESEARCH_COST:project==='complex-clothing'?CLOTHING_RESEARCH_COST:project==='air-conditioning'?AIR_CONDITIONING_COST:project==='batteries'?BATTERIES_RESEARCH_COST:SOLAR_POWER_RESEARCH_COST;
export const researchUnlocked=(w:Pick<World,'schemaVersion'|'research'>,project:ResearchProject):boolean=>isBowResearch326(project)?bowResearchUnlocked326(w,project):isVictoryResearchProject298(project)?victoryResearchUnlocked298(w,project):project==='tree-sowing'?treeSowingUnlocked291(w):project==='firefoam'?firefoamResearchUnlocked290(w):project==='ship-cryptosleep'?shipCryptosleepUnlocked277(w):project==='ship-engine'?shipEngineUnlocked276(w):project==='ship-basics'?shipBasicsUnlocked275(w):project==='ship-reactor'?shipReactorUnlocked275(w):project==='prosthetics'?prostheticsUnlocked273(w):project==='cryptosleep'?cryptosleepUnlocked271(w):project==='long-blades'?longBladesUnlocked270(w):project==='brewing'?brewingUnlocked(w):project==='geothermal-power'?geothermalPowerUnlocked(w):project==='pemmican'?pemmicanUnlocked(w):project==='biofuel-refining'?biofuelRefiningUnlocked(w):project==='nutrient-paste'?nutrientPasteUnlocked(w):project==='deep-drilling'?deepDrillingUnlocked(w):project==='ground-scanner'?groundScannerUnlocked(w):project==='sterile-materials'?sterileMaterialsUnlocked(w):project==='vitals-monitor'?vitalsMonitorUnlocked(w):project==='drug-production'?drugProductionUnlocked(w):project==='medicine-production'?medicineProductionUnlocked(w):project==='hydroponics'?hydroponicsUnlocked(w):project==='gun-turrets'?gunTurretsUnlocked(w):project==='tube-television'?tubeTelevisionUnlocked(w):project==='packaged-survival-meals'?packagedSurvivalMealsUnlocked(w):project==='hospital-bed'?hospitalBedUnlocked(w):project==='microelectronics'?microelectronicsUnlocked(w):project==='multi-analyzer'?multiAnalyzerUnlocked(w):project==='fabrication'?fabricationUnlocked(w):project==='advanced-fabrication'?advancedFabricationUnlocked(w):project==='recon-armor'?reconArmorUnlocked(w):project==='autodoors'?autodoorsUnlocked(w):project==='machining'?machiningUnlocked(w):project==='gunsmithing'?gunsmithingUnlocked(w):project==='plate-armor'?plateArmorUnlocked(w):project==='flak-armor'?flakArmorUnlocked(w):project==='stonecutting'?stonecuttingUnlocked(w):project==='smithing'?smithingUnlocked(w):project==='complex-furniture'?complexFurnitureUnlocked(w):project==='complex-clothing'?clothingUnlocked(w):project==='air-conditioning'?airConditioningUnlocked(w):project==='batteries'?batteriesUnlocked(w):solarPowerUnlocked(w);
export interface ResearchTask {stationId:number;spot:Cell;worked:number;facilityId?:number}
export const clothingUnlocked=(world:Pick<World,'schemaVersion'|'research'>):boolean=>world.research?.completedAt!==undefined;
export const intellectualSkill=(pawn:Pawn):SkillRecord=>pawn.skills.intellectual??{level:0,xp:0,dailyXp:0,passion:0};
export const researchWanted=(world:World,pawn:Pawn):boolean=>!!world.research?.project&&workPriority(pawn,'research')>0;
export const needsHighTechBench=(project:ResearchProject):boolean=>isVictoryResearchProject298(project)?VICTORY_RESEARCH_CONTENT_298[project].requiresHighTechBench:(isShipResearchProject275(project)||isShipEngineResearchProject276(project)||isShipCasketResearchProject277(project))||project==='cryptosleep'||project==='deep-drilling'||project==='ground-scanner'||project==='vitals-monitor'||project==='medicine-production'||project==='hospital-bed'||project==='multi-analyzer'||project==='fabrication'||project==='advanced-fabrication'||project==='recon-armor';
export const needsResearchAnalyzer=(project:ResearchProject):boolean=>isVictoryResearchProject298(project)?VICTORY_RESEARCH_CONTENT_298[project].requiresAnalyzer:(isShipResearchProject275(project)||isShipEngineResearchProject276(project)||isShipCasketResearchProject277(project))||project==='cryptosleep'||project==='vitals-monitor'||project==='fabrication'||project==='advanced-fabrication'||project==='recon-armor';
/** The nearest usable analyzer supplies one link per desk, with shared use. */
export function nearbyResearchFacility(world:World,station:Structure):Structure|undefined {
  // Same members and order as filtering world.structures by kind.
  const linked=structuresOfKind(world,'multi-analyzer').filter(s=>researchFacilityLinked(world,station,s))
    .sort((a,b)=>researchFacilityDistance(station,a)-researchFacilityDistance(station,b)||a.x-b.x||a.z-b.z||a.id-b.id)[0];
  return linked&&isPowerActive(linked)?linked:undefined;
}
export function researchStationUsable(world:World,station:Structure,project:ResearchProject,facilityId?:number):boolean {
  if(station.kind!=='research-bench'&&station.kind!=='hi-tech-research-bench')return false;
  if(needsHighTechBench(project)&&(station.kind!=='hi-tech-research-bench'||!isPowerActive(station)))return false;
  if(station.kind==='hi-tech-research-bench'&&!isPowerActive(station))return false;
  if(needsResearchAnalyzer(project)){
    const facility=nearbyResearchFacility(world,station);
    if(!facility||facilityId!==undefined&&facility.id!==facilityId)return false;
  }
  return true;
}
export function selectResearch(world:World,project:unknown):CommandResult {
  if(isBowResearch326(project)&&!isBowSchema326(Number(world.schemaVersion)))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(isVictoryResearchProject298(project)&&!isSchema298OrLater(Number(world.schemaVersion)))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='tree-sowing'&&(Number(world.schemaVersion)!==291&&(Number(world.schemaVersion)!==292&&(Number(world.schemaVersion)!==293&&(Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))))))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='firefoam'&&!isSchema290OrLater(Number(world.schemaVersion)))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(isShipCasketResearchProject277(project)&&!isSchema277OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(isShipEngineResearchProject276(project)&&!isSchema276OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(isShipResearchProject275(project)&&!isSchema275OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='prosthetics'&&!isSchema273OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='cryptosleep'&&!isSchema271OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='long-blades'&&!isSchema270OrLater(world.schemaVersion))return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='brewing'&&world.schemaVersion<265)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='geothermal-power'&&world.schemaVersion<264)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='pemmican'&&world.schemaVersion<248)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='biofuel-refining'&&world.schemaVersion<218)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='nutrient-paste'&&world.schemaVersion<217)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if((project==='deep-drilling'||project==='ground-scanner')&&world.schemaVersion<215)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project!==null&&!isBowResearch326(project)&&!isVictoryResearchProject298(project)&&project!=='tree-sowing'&&project!=='firefoam'&&!isShipResearchProject275(project)&&!isShipEngineResearchProject276(project)&&!isShipCasketResearchProject277(project)&&project!=='prosthetics'&&project!=='cryptosleep'&&project!=='long-blades'&&project!=='brewing'&&project!=='geothermal-power'&&project!=='pemmican'&&project!=='biofuel-refining'&&project!=='nutrient-paste'&&project!=='deep-drilling'&&project!=='ground-scanner'&&project!=='sterile-materials'&&project!=='vitals-monitor'&&project!=='drug-production'&&project!=='medicine-production'&&project!=='hydroponics'&&project!=='gun-turrets'&&project!=='tube-television'&&project!=='packaged-survival-meals'&&project!=='hospital-bed'&&project!=='microelectronics'&&project!=='multi-analyzer'&&project!=='fabrication'&&project!=='advanced-fabrication'&&project!=='recon-armor'&&project!=='autodoors'&&project!=='machining'&&project!=='gunsmithing'&&project!=='plate-armor'&&project!=='flak-armor'&&project!=='complex-clothing'&&project!=='complex-furniture'&&project!=='air-conditioning'&&project!=='batteries'&&project!=='solar-power'&&project!=='stonecutting'&&project!=='smithing')return {ok:false,code:'invalid-command',reason:'Projet inconnu.'};
  if((project==='sterile-materials'||project==='vitals-monitor')&&world.schemaVersion<211)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if((project==='drug-production'||project==='medicine-production')&&world.schemaVersion<206)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='hydroponics'&&world.schemaVersion<203)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='gun-turrets'&&world.schemaVersion<193)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='tube-television'&&world.schemaVersion<190)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='packaged-survival-meals'&&world.schemaVersion<188)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='hospital-bed'&&world.schemaVersion<187)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project==='autodoors'&&world.schemaVersion<143)return {ok:false,code:'invalid-command',reason:'Projet indisponible dans ce schéma.'};
  if(project&&researchUnlocked(world,project))return {ok:false,code:'invalid-command',reason:'Cette recherche est déjà terminée.'};
  if(project&&researchPrerequisite(world,project))return {ok:false,code:'invalid-command',reason:`Recherchez ${researchPrerequisite(world,project)} d’abord.`};
  if(project==='vitals-monitor'&&!world.structures.some(s=>researchStationUsable(world,s,project)))return {ok:false,code:'invalid-command',reason:'Un bureau avancé alimenté relié à un multi-analyseur alimenté est requis.'};
  world.research??={project:null,points:0};world.research.project=project;if(project)projectProgress(world.research,project);
  for(const local of [world,otherCampaignMap(world)])if(local)for(const pawn of local.pawns){if(pawn.research)releaseAssignments(local,pawn);pawn.planCooldown=0;}
  return {ok:true};
}
/** With `benchSpeed` (schema 301 family), benches are taken in RimWorld's
 * order: WorkGiver_Researcher is prioritized by the bench's research speed
 * factor, highest first, then the closest in straight-line distance.
 * Otherwise by the historical Manhattan distance. */
export function researchProposal(world:World,pawn:Pawn,reach:Reachability,benchSpeed?:(station:Structure)=>number):{task:ResearchTask;path:Cell[]}|null {
  if(!researchWanted(world,pawn))return null;
  const project=world.research!.project!;
  const reserved=reservedServiceCells(world,pawn.id);
  const stations=world.structures.filter(s=>allowedAreaAllows(world,pawn,s)&&(s.kind==='research-bench'||s.kind==='hi-tech-research-bench')&&researchStationUsable(world,s,project)&&!deconstructionReserved(world,s.id,pawn.id)&&!world.pawns.some(p=>p!==pawn&&p.research?.stationId===s.id))
    .sort((a,b)=>Math.abs(a.x-pawn.x)+Math.abs(a.z-pawn.z)-Math.abs(b.x-pawn.x)-Math.abs(b.z-pawn.z)||a.id-b.id);
  if(benchSpeed){
    const speed=new Map(stations.map(s=>[s.id,benchSpeed(s)]));
    stations.sort((a,b)=>speed.get(b.id)!-speed.get(a.id)!||(a.x-pawn.x)**2+(a.z-pawn.z)**2-((b.x-pawn.x)**2+(b.z-pawn.z)**2)||a.id-b.id);
  }
  for(const s of stations){const spot=cookingSpot(s);if(reserved.has(spot.z*world.width+spot.x)||!canStandAt(world,spot))continue;
    const facility=s.kind==='hi-tech-research-bench'?nearbyResearchFacility(world,s):undefined;
    if(needsResearchAnalyzer(project)&&!facility)continue;
    const path=routeToJob(world,spot,reach,true);if(path)return {task:{stationId:s.id,spot,worked:0,...(facility?{facilityId:facility.id}:{})},path};
  }return null;
}
interface ResearchCleanlinessRead {capture:CleanlinessCapture;environment:WorkEnvironment;items:NonNullable<World['filth']>['items']|undefined;count:number}
/* One capture per room topology. The work environment is rebuilt after every
 * job end or haul, but a room's cleanliness reads only the world, this
 * topology and the filth. Within one environment, unchanged filth returns the
 * computed room; otherwise the capture enters a new epoch and each room is
 * brought up to date on request exactly as a fresh capture would compute it
 * (see CleanlinessCapture.extendFilth), or a fresh capture is made. */
const cleanlinessCaptures=new WeakMap<WorkEnvironment['topology'],ResearchCleanlinessRead>();
function researchCleanliness(world:World,station:Structure,environment:WorkEnvironment):number|null {
  const items=world.filth?.items,count=items?.length??0;
  let read=cleanlinessCaptures.get(environment.topology);
  // Actual deposits append traces and removals replace the array. Their
  // identity/count is an O(1) revision; thickness does not alter this score.
  if(!read||read.capture.world!==world||read.environment!==environment||read.items!==items||read.count!==count){
    if(read&&read.capture.world===world&&items&&read.items===items&&count>=read.count&&read.capture.extendFilth()){read.environment=environment;read.count=count;}
    else {read={capture:new CleanlinessCapture(world,environment.topology),environment,items,count};cleanlinessCaptures.set(environment.topology,read);}
  }
  return read.capture.cleanliness(station);
}
export function researchCleanlinessFactor(cleanliness:number|null):number {
  if(cleanliness===null)return .75;
  if(cleanliness<=-5)return .75;if(cleanliness>=1)return 1.15;
  if(cleanliness<-2.5)return .75+(cleanliness+5)*.04;
  if(cleanliness<0)return .85+(cleanliness+2.5)*.06;
  return 1+cleanliness*.15;
}
/** Integer micro-points persist work. Room stats reuse the current environment
 * topology and one lazily computed cleanliness result per requested room. */
/** A bench's research speed factor: bench type and linked analyzer, outdoors,
 * room cleanliness and role. The work rate also applies the temperature. */
export function benchSpeedFactor(world:World,station:Structure,environment:WorkEnvironment):number {
  const room=environment.room(station),outdoor=room?.psychologicallyOutdoors??true;
  let cleanliness:number|null=outdoor?null:0;
  if(!outdoor)cleanliness=researchCleanliness(world,station,environment);
  const facilityOffset=nearbyResearchFacility(world,station)?.kind==='multi-analyzer'?.1:0;
  return ((station.kind==='hi-tech-research-bench'?1:.75)+facilityOffset)*(outdoor?.75:1)*researchCleanlinessFactor(cleanliness)*(room&&!outdoor&&room.role!=='laboratory'?.8:1);
}
export function researchRate(pawn:Pawn,station:Structure,environment:WorkEnvironment,temperature:number,world:World):number {
  const c=pawnBody(pawn).capacities,skill=intellectualSkill(pawn);
  const personal=Math.max(.1,(.08+.115*skill.level)*(.5+.5*Math.min(1.1,c.manipulation))*(.5+.5*Math.min(1.1,c.sight))*(glowIgnoredByBlindPawn(world,pawn)?1:environment.speedAt(pawn)));
  const bench=Math.max(.25,benchSpeedFactor(world,station,environment)*tailoringTemperatureFactor(temperature));
  return Math.round(.0825*personal*bench*RESEARCH_SCALE);
}
export function processResearch(world:World,pawn:Pawn,move:(target:Cell,exact:boolean)=>unknown,rate:(s:Structure)=>number,event:(text:string)=>void):void {
  if(!allowedAreaServicesAllowed(world,pawn)){releaseAssignments(world,pawn);return;}
  const task=pawn.research!,station=structureById(world,task.stationId);
  if(medicalWorkRefusal(pawn)||!station||!researchWanted(world,pawn)||(needsResearchAnalyzer(world.research!.project!))&&task.facilityId===undefined||!researchStationUsable(world,station,world.research!.project!,task.facilityId)||deconstructionReserved(world,station.id,pawn.id)||!canStandAt(world,task.spot)){releaseAssignments(world,pawn);return;}
  if(pawn.x!==task.spot.x||pawn.z!==task.spot.z){move(task.spot,true);return;}
  pawn.path=[];pawn.state='working';
  const state=world.research!,project=state.project!,progress=projectProgress(state,project),cost=researchCost(project);
  progress.points=Math.min(cost,progress.points+rate(station));
  pawn.skills.intellectual??={...intellectualSkill(pawn)};learnSkill(pawn.skills.intellectual,1000,pawn);task.worked++;
  if(progress.points===cost){state.project=null;progress.completedAt=world.tick;
    for(const local of [world,otherCampaignMap(world)])if(local)for(const p of local.pawns)if(p.research)releaseAssignments(local,p);
    event(project==='recurve-bow'?'Recherche achevée : Arc recourbé. Fabrication au poste d’artisanat ou aux forges ; Grand arc disponible.':project==='greatbow'?'Recherche achevée : Grand arc. Fabrication au poste d’artisanat ou aux forges.':isVictoryResearchProject298(project)?`Recherche achevée : ${VICTORY_RESEARCH_CONTENT_298[project].label}.`:project==='tree-sowing'?'Recherche achevée : Semis d’arbres. Choisissez une essence indigène dans une zone de sol.':project==='firefoam'?'Recherche achevée : Mousse anti-incendie. Diffuseur constructible.':project==='ship-cryptosleep'?'Recherche achevée : Caisson spatial de cryptosommeil. Construction sur poutre débloquée.':project==='ship-engine'?'Recherche achevée : Moteur Johnson–Tanaka. Construction extérieure débloquée.':project==='ship-basics'?(isSchema276OrLater(world.schemaVersion)?'Recherche achevée : Construction de vaisseau. Poutres constructibles, recherches du réacteur et du moteur disponibles.':'Recherche achevée : Construction de vaisseau. Recherche du réacteur stellaire disponible.'):project==='ship-reactor'?'Recherche achevée : Réacteur stellaire. Construction extérieure débloquée.':project==='prosthetics'?'Recherche achevée : Prothèses. Bras et jambes prothétiques fabricables à l’atelier d’usinage.':project==='cryptosleep'?'Recherche achevée : Cryptosommeil. Caisson ordinaire constructible.':project==='long-blades'?'Recherche achevée : Lames longues. Épée longue fabricable aux forges.':project==='brewing'?'Recherche achevée : Brassage. Brasserie et fût de fermentation débloqués.':project==='geothermal-power'?'Recherche achevée : Énergie géothermique. Centrale sur geyser débloquée.':project==='pemmican'?'Recherche achevée : Pemmican. Préparation au feu ou sur cuisinière débloquée.':project==='biofuel-refining'?'Recherche achevée : Raffinage du biocarburant. Raffinerie débloquée.':project==='nutrient-paste'?'Recherche achevée : Pâte nutritive. Distributeur et trémies débloqués.':project==='deep-drilling'?'Recherche achevée : Forage profond. Foreuse débloquée.':project==='ground-scanner'?'Recherche achevée : Scanner souterrain. Recherche de gisements débloquée.':project==='sterile-materials'?'Recherche achevée : Matériaux stériles. Sol stérile débloqué.':project==='vitals-monitor'?'Recherche achevée : Moniteur vital. Soutien hospitalier débloqué.':project==='drug-production'?'Recherche achevée : Production de drogues. Laboratoire débloqué.':project==='medicine-production'?'Recherche achevée : Production de médicaments. Synthèse industrielle débloquée.':project==='gun-turrets'?'Recherche achevée : Tourelles automatiques. Mini-tourelle en acier débloquée.':project==='tube-television'?'Recherche achevée : Télévision cathodique. Loisirs télévisés débloqués.':project==='packaged-survival-meals'?'Recherche achevée : Repas de survie emballés. Fabrication sur cuisinière débloquée.':project==='hospital-bed'?'Recherche achevée : Lit d’hôpital. Construction médicale spécialisée débloquée.':project==='microelectronics'?'Recherche achevée : Microélectronique. Bureau de recherche avancé débloqué.':project==='multi-analyzer'?'Recherche achevée : Multi-analyseur. Équipement de recherche débloqué.':project==='fabrication'?'Recherche achevée : Fabrication. Établi de fabrication débloqué.':project==='advanced-fabrication'?'Recherche achevée : Fabrication avancée. Composants avancés fabricables.':project==='recon-armor'?(world.schemaVersion>=241?'Recherche achevée : Armure de reconnaissance. Casque et combinaison de reconnaissance fabricables.':'Recherche achevée : Armure de reconnaissance. Casque de reconnaissance fabricable.'):project==='autodoors'?'Recherche achevée : Portes automatiques. Construction débloquée.':project==='machining'?'Recherche achevée : Usinage. Atelier d’usinage débloqué.':project==='gunsmithing'?'Recherche achevée : Armurerie. Revolver et fusil à verrou fabricables.':project==='plate-armor'?(world.schemaVersion>=267?'Recherche achevée : Armure de plaques. Facture disponible aux forges.':'Recherche achevée : Armure de plaques. Préparation du gilet pare-balles.'):project==='flak-armor'?'Recherche achevée : Gilet pare-balles. Facture disponible à l’atelier d’usinage.':project==='stonecutting'?'Recherche achevée : Taille de pierre. Dalles de pierre débloquées.':project==='smithing'?(world.schemaVersion>=267?'Recherche achevée : Forge. Forges, casque simple et dalles en acier débloqués.':'Recherche achevée : Forge. Dalles en acier débloquées.'):project==='complex-furniture'?'Recherche achevée : Mobilier complexe. Chaises, fauteuils, mobilier de chambre et table d’échecs débloqués.':project==='complex-clothing'?'Recherche achevée : Vêtements complexes. Établis de tailleur et vêtements avancés débloqués.':project==='air-conditioning'?'Recherche achevée : Climatisation. Climatiseur électrique débloqué.':project==='batteries'?'Recherche achevée : Batteries. Stockage électrique débloqué.':'Recherche achevée : Panneaux solaires. Production solaire débloquée.');
  }else if(task.worked>=400)releaseAssignments(world,pawn);
}
