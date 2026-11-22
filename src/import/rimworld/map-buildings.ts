/** Building family. Each kept building lists the game's footprint size
 * (width × depth at rotation North): the importer computes the game's
 * occupied cells and looks for the Elsewhere anchor/orientation covering the
 * same cells. Stuff becomes the construction material where the kind accepts
 * it (Elsewhere's own material rules decide). */
import {exact,adapt,drop,type DefMapping} from './mapping.ts';
import type {StructureKind} from '../../sim/types.ts';

export interface BuildingSpec {readonly kind:StructureKind;readonly size:readonly [number,number]}
const b=(kind:StructureKind,w=1,d=1)=>exact<BuildingSpec>({kind,size:[w,d]});
const a=(kind:StructureKind,why:string,w=1,d=1)=>adapt<BuildingSpec>({kind,size:[w,d]},why);
const x=(why:string)=>drop<BuildingSpec>(why);

export const BUILDING_MAP:Readonly<Record<string,DefMapping<BuildingSpec>>>={
 Wall:b('wall'),Door:b('door'),Autodoor:b('autodoor'),Fence:b('fence'),FenceGate:b('fence-gate'),PenMarker:b('pen-marker'),Sandbags:b('sandbags'),
 Barricade:a('sandbags','Barricade : devient des sacs de sable.'),AnimalFlap:x('Chatière : porte à animaux absente d’Elsewhere.'),
 Bed:b('bed',1,2),DoubleBed:b('double-bed',2,2),HospitalBed:b('hospital-bed',1,2),RoyalBed:a('double-bed','Lit royal : devient un lit double.',2,2),
 Bedroll:b('bedroll',1,2),BedrollDouble:b('double-bedroll',2,2),SleepingSpot:b('sleeping-spot',1,2),DoubleSleepingSpot:b('double-sleeping-spot',2,2),
 AnimalSleepingSpot:b('animal-sleeping-spot'),AnimalSleepingBox:a('animal-sleeping-spot','Panier pour animal : devient une place de couchage pour animal.'),
 AnimalBed:a('animal-sleeping-spot','Lit pour animal : devient une place de couchage pour animal.'),
 Table1x2c:b('table',1,2),Table2x2c:b('table-square',2,2),Table2x4c:b('table-long',2,4),Table3x3c:b('table-large',3,3),
 DiningChair:b('dining-chair'),Stool:b('stool'),Armchair:b('armchair'),Couch:b('couch',2,1),EndTable:b('end-table'),Dresser:b('dresser',2,1),
 PlantPot:b('flower-pot'),Shelf:b('shelf',2,1),ShelfSmall:b('small-shelf'),ToolCabinet:b('tool-cabinet',2,1),
 Bookcase:x('Bibliothèque : meuble absent (les romans d’Elsewhere se rangent ailleurs).'),BookcaseSmall:x('Petite bibliothèque : meuble absent.'),
 ChessTable:b('chess-table'),HorseshoesPin:b('horseshoes'),HoopstoneRing:b('hoopstone-ring'),BilliardsTable:b('billiards-table',2,3),
 GameOfUrBoard:b('game-of-ur-board'),PokerTable:b('poker-table',2,2),TubeTelevision:b('tube-television'),
 FlatscreenTelevision:a('tube-television','Télévision à écran plat : devient une télévision à tube.',2,1),
 MegascreenTelevision:a('tube-television','Écran géant : devient une télévision à tube.',3,1),Telescope:x('Télescope : absent.'),
 FueledStove:b('fueled-stove',3,1),ElectricStove:b('electric-stove',3,1),Campfire:b('campfire'),TableButcher:b('butcher-table',3,1),ButcherSpot:b('butcher-spot'),
 NutrientPasteDispenser:b('nutrient-paste-dispenser',3,4),Hopper:b('hopper'),SimpleResearchBench:b('research-bench',3,2),
 HiTechResearchBench:b('hi-tech-research-bench',5,2),MultiAnalyzer:b('multi-analyzer',2,2),HandTailoringBench:b('tailor-bench',3,1),
 ElectricTailoringBench:b('electric-tailor-bench',3,1),CraftingSpot:b('crafting-spot'),TableStonecutter:b('stonecutter',3,1),TableMachining:b('machining-table',3,1),
 FabricationBench:b('fabrication-bench',5,2),TableSculpting:b('art-bench',3,1),FueledSmithy:b('fueled-smithy',3,1),ElectricSmithy:b('electric-smithy',3,1),
 DrugLab:b('drug-lab',3,1),Brewery:b('brewery',3,1),FermentingBarrel:b('fermenting-barrel'),ElectricSmelter:b('electric-smelter',3,1),
 BiofuelRefinery:b('biofuel-refinery',3,2),ElectricCrematorium:b('electric-crematorium',3,2),
 SculptureSmall:b('small-sculpture'),SculptureLarge:b('large-sculpture'),SculptureGrand:a('large-sculpture','Sculpture monumentale : devient une grande sculpture.',2,2),
 PowerConduit:b('power-conduit'),HiddenConduit:a('power-conduit','Conduit enterré : devient un conduit ordinaire.'),
 WaterproofConduit:a('power-conduit','Conduit étanche : devient un conduit ordinaire.'),PowerSwitch:b('power-switch'),Battery:b('battery',1,2),
 WoodFiredGenerator:b('wood-generator',2,2),ChemfuelPoweredGenerator:b('chemfuel-generator',2,2),SolarGenerator:b('solar-generator',4,4),
 WindTurbine:b('wind-turbine',7,2),GeothermalGenerator:x('Générateur géothermique : son geyser n’est pas recréé à la même place ; non importé.'),
 WatermillGenerator:x('Moulin à eau : absent.'),
 StandingLamp:b('standing-lamp'),SunLamp:b('sun-lamp'),TorchLamp:b('torch-lamp'),WallLamp:b('wall-lamp'),
 FloodLight:a('standing-lamp','Projecteur : devient une lampe sur pied.'),
 StandingLamp_Red:a('standing-lamp','Lampe colorée : devient une lampe ordinaire.'),StandingLamp_Green:a('standing-lamp','Lampe colorée : devient une lampe ordinaire.'),
 StandingLamp_Blue:a('standing-lamp','Lampe colorée : devient une lampe ordinaire.'),
 Heater:b('heater'),Cooler:b('cooler'),PassiveCooler:b('passive-cooler'),Vent:b('vent'),FirefoamPopper:b('firefoam-popper'),
 Turret_MiniTurret:b('mini-turret'),Turret_Autocannon:x('Tourelle autocanon : absente.'),Turret_Sniper:x('Tourelle de précision : absente.'),
 Turret_Mortar:x('Mortier : absent.'),Turret_FoamTurret:x('Tourelle à mousse : absente.'),TrapSpike:b('spike-trap'),
 TrapIED_HighExplosive:b('ied-high-explosive'),TrapIED_Incendiary:b('ied-incendiary'),TrapIED_EMP:x('Piège EEI à IEM : absent.'),
 TrapIED_Smoke:x('Piège EEI fumigène : absent.'),TrapIED_Firefoam:x('Piège EEI à mousse : absent.'),TrapIED_AntigrainWarhead:x('Piège à ogive antigrain : absent.'),
 VitalsMonitor:b('vitals-monitor'),Grave:b('grave',1,2),Sarcophagus:b('sarcophagus',1,2),CryptosleepCasket:x('Caisson de cryptosommeil : contenu non importé, caisson omis.'),
 CommsConsole:b('comms-console',3,2),OrbitalTradeBeacon:b('orbital-beacon'),DeepDrill:b('deep-drill'),GroundPenetratingScanner:b('ground-scanner',3,3),
 LongRangeMineralScanner:x('Scanner minéral à longue portée : absent.'),HydroponicsBasin:b('hydroponics-basin',1,4),MoisturePump:x('Pompe à humidité : absente.'),
 Ship_Beam:x('Poutre de vaisseau : vaisseau non importé.'),Ship_CryptosleepCasket:x('Caisson de vaisseau : vaisseau non importé.'),
 Ship_ComputerCore:x('Ordinateur de vaisseau : vaisseau non importé.'),Ship_Reactor:x('Réacteur de vaisseau : vaisseau non importé.'),
 Ship_Engine:x('Moteur de vaisseau : vaisseau non importé.'),Ship_SensorCluster:x('Capteurs de vaisseau : vaisseau non importé.'),
 TransportPod:x('Capsule de transport : absente.'),PodLauncher:x('Lanceur de capsules : absent.'),CaravanPackingSpot:x('Point de préparation de caravane : absent.'),
 MarriageSpot:x('Lieu de mariage : absent.'),PartySpot:x('Lieu de fête : absent (la fête utilise la place de rassemblement).'),EggBox:x('Boîte à œufs : absente.'),
 ShipChunk:x('Débris de vaisseau : décor non recréé.'),Column:x('Colonne ancienne : décor non recréé.'),Urn:x('Urne ancienne : décor non recréé.'),
 SteleLarge:x('Stèle ancienne : décor non recréé.'),SteleGrand:x('Grande stèle ancienne : décor non recréé.'),
 AncientCryptosleepCasket:x('Caisson ancien : contenu inconnu, non recréé.'),SteamGeyser:x('Geyser : non recréé (le terrain d’Elsewhere est repris de la sauvegarde).'),
 Hive:x('Ruche d’insectes : non recréée.'),GlowPod:x('Bulbe lumineux : non recréé.'),
};
/** Frames and blueprints: unfinished construction. */
export const CONSTRUCTION_NOTE='Chantiers et plans en cours : non importés (les matériaux déjà livrés sont perdus).';
