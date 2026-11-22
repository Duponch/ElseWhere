/** Colony-wide families: research projects, zones and areas, storage
 * priorities, time. */
import {exact,adapt,drop,type DefMapping} from './mapping.ts';
import type {ResearchProject} from '../../sim/research.ts';

const r=(p:ResearchProject)=>exact(p);
const none=(why:string)=>drop<ResearchProject>(why);
export const RESEARCH_MAP:Readonly<Record<string,DefMapping<ResearchProject>>>={
 TreeSowing:r('tree-sowing'),Brewing:r('brewing'),ComplexFurniture:r('complex-furniture'),Stonecutting:r('stonecutting'),ComplexClothing:r('complex-clothing'),
 DrugProduction:r('drug-production'),Devilstrand:r('devilstrand'),CarpetMaking:r('carpet-making'),Pemmican:r('pemmican'),Smithing:r('smithing'),
 RecurveBow:r('recurve-bow'),PenoxycylineProduction:r('penoxycyline-production'),LongBlades:r('long-blades'),PlateArmor:r('plate-armor'),Greatbow:r('greatbow'),
 Batteries:r('batteries'),BiofuelRefining:r('biofuel-refining'),NutrientPaste:r('nutrient-paste'),SolarPanels:r('solar-power'),AirConditioning:r('air-conditioning'),
 Autodoors:r('autodoors'),Hydroponics:r('hydroponics'),TubeTelevision:r('tube-television'),PackagedSurvivalMeal:r('packaged-survival-meals'),Firefoam:r('firefoam'),
 IEDs:r('ieds'),GeothermalPower:r('geothermal-power'),SterileMaterials:r('sterile-materials'),Machining:r('machining'),Prosthetics:r('prosthetics'),
 Gunsmithing:r('gunsmithing'),FlakArmor:r('flak-armor'),BlowbackOperation:r('blowback-operation'),GasOperation:r('gas-operation'),GunTurrets:r('gun-turrets'),
 MicroelectronicsBasics:r('microelectronics'),HospitalBed:r('hospital-bed'),DeepDrilling:r('deep-drilling'),GroundPenetratingScanner:r('ground-scanner'),
 MedicineProduction:r('medicine-production'),LongRangeMineralScanner:r('long-range-mineral-scanner'),PrecisionRifling:r('precision-rifling'),
 MultiAnalyzer:r('multi-analyzer'),VitalsMonitor:r('vitals-monitor'),Fabrication:r('fabrication'),AdvancedFabrication:r('advanced-fabrication'),
 Cryptosleep:r('cryptosleep'),ReconArmor:r('recon-armor'),ShipBasics:r('ship-basics'),ShipCryptosleep:r('ship-cryptosleep'),ShipReactor:r('ship-reactor'),
 ShipEngine:r('ship-engine'),ShipComputerCore:r('ship-computer'),ShipSensorCluster:r('ship-sensors'),
 Electricity:none('Électricité : acquise d’office dans Elsewhere (pas de projet).'),PassiveCooler:none('Refroidisseur passif : sans recherche dans Elsewhere.'),
 Cocoa:none('Cacao : culture absente.'),ColoredLights:none('Lumières colorées : absentes.'),Mortars:none('Mortiers : absents.'),FoamTurret:none('Tourelle à mousse : absente.'),
 TransportPod:none('Capsules de transport : absentes.'),ShieldBelt:none('Ceinture bouclier : absente.'),HeavyTurrets:none('Tourelles lourdes : absentes.'),
 Bionics:none('Bionique : absente.'),SniperTurret:none('Tourelle de précision : absente.'),PsychoidBrewing:none('Psychoïde : absent.'),PsychiteRefining:none('Psychite : absente.'),
 WakeUpProduction:none('Wake-up : absent.'),GoJuiceProduction:none('Go-juice : absent.'),WatermillGenerator:none('Moulin à eau : absent.'),SmokepopBelt:none('Ceinture fumigène : absente.'),
 FlatscreenTelevision:none('Télévision à écran plat : absente.'),MoisturePump:none('Pompe à humidité : absente.'),MultibarrelWeapons:none('Armes multicanons : absentes.'),
 PoweredArmor:none('Armure assistée : absente.'),ChargedShot:none('Tir chargé : absent.'),RocketswarmLauncher:none('Lance-roquettes : absent.'),
 Mortar:none('Mortiers : absents.'),
};
/** Storage priority names → Elsewhere priority 1 … 5. */
export const STORAGE_PRIORITY:Readonly<Record<string,number>>={Low:1,Normal:2,Preferred:3,Important:4,Critical:5};
export const ZONE_MAP:Readonly<Record<string,DefMapping<'stockpile'|'growing'>>>={
 Zone_Stockpile:exact('stockpile'),Zone_Growing:exact('growing'),Zone_Fishing:drop('Zone de pêche : absente.'),
};
export const AREA_MAP:Readonly<Record<string,DefMapping<'home'|'snow-clear'|'allowed'>>>={
 Area_Home:exact('home'),Area_SnowOrSandClear:exact('snow-clear'),Area_Allowed:exact('allowed'),
 Area_BuildRoof:drop('Zone « construire un toit » : Elsewhere construit les toits sur ordre, pas par zone permanente.'),
 Area_NoRoof:drop('Zone « pas de toit » : absente.'),
};
export const TIME_NOTE=adapt(null,'Date : la date du calendrier (année, quadrum, jour, heure) est celle de la sauvegarde ; le compteur interne de la partie repart de la création.');
