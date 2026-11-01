import type { ItemId } from './items.ts';
import type { StorageConditions } from './storage-condition.ts';
export const SCHEMA_VERSION = 300 as const;
export const TICKS_PER_SECOND = 6;
export const TICKS_PER_DAY = 6000;

export type Terrain = import('./local-terrain-definitions-256.ts').NaturalTerrainId256 | 'smoothed-stone' | 'packed-dirt' | 'water-shallow' | 'marsh' | 'grass' | 'soil' | 'water' | 'rock' | 'rough-stone' | 'rich-soil' | 'gravel';
export type ResourceKind = 'hops' | 'wild-plant' | 'potato' | 'corn' | 'tree' | 'berries' | 'rock' | 'rice' | 'cotton' | 'healroot' | 'haygrass';
export type MaterialKind = 'ai-core' | 'book' | 'prosthesis' | 'wort' | 'beer' | 'jade' | 'plant' | 'chemfuel' | 'neutroamine' | 'mech-corpse' | 'silver' | 'corpse' | 'wood' | 'food' | 'chunk' | 'steel' | 'gold' | 'uranium' | 'plasteel' | 'advanced-component' | 'blocks' | 'component' | 'medicine' | 'weapon' | 'apparel' | 'textile' | 'unfinished';
export type BedSlot = 0 | 1;
export type LocalRoadProp256 = import('./local-road-data-256.ts').LocalRoadProp256;
export type StructureKind = 'ship-computer' | 'ship-sensors' | 'firefoam-popper' | 'ship-cryptosleep-casket' | 'ship-beam' | 'ship-engine' | 'ship-reactor' | 'cryptosleep-casket' | 'fueled-smithy' | 'electric-smithy' | 'brewery' | 'fermenting-barrel' | 'geothermal-generator' | import('./cave-hive-state-256.ts').CaveHiveKind256 | 'ship-chunk' | 'ancient-cryptosleep-casket' | import('./ancient-monument-props-256.ts').AncientMonumentKind256 | LocalRoadProp256 | 'torch-lamp' | 'vent' | 'shelf' | 'small-shelf' | 'spike-trap' | 'electric-crematorium' | 'double-bed' | 'electric-smelter' | 'sleeping-spot' | 'animal-sleeping-spot' | 'biofuel-refinery' | 'chemfuel-generator' | 'nutrient-paste-dispenser' | 'hopper' | 'orbital-beacon' | 'comms-console' | 'deep-drill' | 'ground-scanner' | 'vitals-monitor' | 'drug-lab' | 'hydroponics-basin' | 'mini-turret' | 'tube-television' | 'sandbags' | 'art-bench' | 'small-sculpture' | 'large-sculpture' | 'machining-table' | 'fabrication-bench' | 'hi-tech-research-bench' | 'multi-analyzer' | 'grave' | 'heater' | 'wind-turbine' | 'power-conduit' | 'power-switch' | 'battery' | 'solar-generator' | 'fueled-stove' | 'electric-stove' | 'butcher-table' | 'butcher-spot' | 'cooler' | 'research-bench' | 'tailor-bench' | 'electric-tailor-bench' | 'crafting-spot' | 'wood-generator' | 'sun-lamp' | 'standing-lamp' | 'passive-cooler' | 'door' | 'autodoor' | 'wall' | 'fence' | 'fence-gate' | 'pen-marker' | 'bedroll' | 'bed' | 'hospital-bed' | 'table' | 'table-square' | 'table-long' | 'stool' | 'dining-chair' | 'armchair' | 'end-table' | 'dresser' | 'flower-pot' | 'campfire' | 'horseshoes' | 'chess-table' | 'stonecutter';
export type JobKind = 'smooth-floor' | 'build-bridge' | 'remove-bridge' | 'extract-tree' | 'replant-tree' | 'lay-floor' | 'remove-floor' | 'flick' | 'repair' | 'fix-breakdown' | 'build-roof' | 'remove-roof' | 'mine' | 'chop' | 'harvest' | 'cut' | 'sow' | 'deconstruct' | 'uninstall' | 'install' | Exclude<StructureKind,LocalRoadProp256|'ship-chunk'|'ancient-cryptosleep-casket'|import('./cave-hive-state-256.ts').CaveHiveKind256>;
export type WorkType = 'handle' | 'art' | 'clean' | 'firefight' | 'warden' | 'basic' | 'hunt' | 'research' | 'patient' | 'bedrest' | 'doctor' | 'mine' | 'gather' | 'build' | 'haul' | 'grow' | 'cook' | 'craft';
export type Orientation = 0 | 1 | 2 | 3;
export type Footprint = 'standard' | 'legacy-single';
export type PawnState = 'idle' | 'moving' | 'working' | 'sleeping' | 'hungry' | 'eating' | 'recreating' | 'resting' | 'downed' | 'dead';
export interface Cell { x: number; z: number }
export interface AllowedArea { id:number; label:string; color:number; cells:number[] }
export interface AllowedAreaReturn { target:Cell }
export type AllowedAreaCommand =
  | {type:'allowed-area-create';label?:string}
  | {type:'allowed-area-settings';areaId:number;label?:string;color?:number}
  | {type:'allowed-area-paint';areaId:number;enabled:boolean;from:Cell;to:Cell}
  | {type:'allowed-area-delete';areaId:number}
  | {type:'assign-allowed-area';pawnId:number;areaId:number|null};
export interface Tile { mineable?:import('./local-mineable-owner-256.ts').LocalMineableOwner256; fogged?:true; collapsedRock?:import('./collapsed-rocks-256.ts').CollapsedRock256; /** Finished foundation only; the original wet terrain below remains literal. */ bridge?:true; snowDepth?:number; floor?:import('./flooring.ts').FloorKind; ore?: 'jade' | 'steel' | 'machinery' | 'gold' | 'silver' | 'uranium' | 'plasteel'; miningDamage?: number; /** Prospective yield weighted by the fraction of ore HP actually mined. */ miningYield?: number; terrain: Terrain; stone?: import('./geology.ts').StoneKind }
export interface Resource extends Cell { sown291?:true; blight?:import('./plant-blight.ts').CropBlightState; species?:import('./biome-flora.ts').PlantSpecies; plantLife?:import('./plant-life.ts').PlantLife; damage?:number; id: number; kind: ResourceKind; amount: number; growth?: number; growthTick?: number; growthThermalFactor?:number; growthLight?:'dark'|'artificial-full'; stone?: import('./geology.ts').StoneKind }
export interface Structure extends Cell { firefoam290?:import('./firefoam-state-290.ts').FirefoamPopper290; shipCryptosleep277?:import('./ship-casket-state-277.ts').ShipCasketHolder277; shipReactor275?:import('./ship-reactor-state-275.ts').ShipReactorState275; cryptosleep?:import('./cryptosleep-state-271.ts').CryptosleepHolder271; fermentation?:import('./fermentation-state-265.ts').FermentationState265; geothermal?:import('./geothermal-state-264.ts').GeothermalState264; caveHive?:import('./cave-hive-state-256.ts').CaveHiveComponents256; glowPod?:import('./cave-hive-state-256.ts').GlowPodComponents256; casketWick?:import('./ancient-casket-explosive-state-256.ts').AncientCasketWick256; casket?:import('./ancient-casket-state-256.ts').AncientCasketState256; factionId?:number|null; vent?:import('./vent.ts').VentState; shelf?:import('./shelf-storage.ts').ShelfStorageState; spikeTrap?:import('./spike-trap-state.ts').SpikeTrapState; deepDrill?:import('./deep-drilling-rules.ts').DeepDrillState; deepScanner?:import('./deep-drilling-rules.ts').DeepScannerState; emp?:{sinceCore:number;untilCore:number}; turret?:import('./mini-turret-state.ts').MiniTurretState; breakdown?:import('./breakdowns.ts').BreakdownState; gatherSpot?:boolean; pen?:{accepted:import('./animal-species.ts').AnimalSpeciesId[]}; art?:{authorId:number;createdAt:number}; flower?:import('./flower-pot.ts').FlowerPotState; quality?:import('./equipment-rules.ts').WeaponQuality; grave?:import('./burial.ts').GraveState; heater?:import('./heater.ts').HeaterState; wind?:import('./wind.ts').WindTurbineState; prisoner?:true; battery?:import('./power-battery.ts').BatteryState; cooler?:import('./cooler.ts').CoolerState; damage?:number; medical?:true; power?:import('./power-rules.ts').PowerState; door?:import('./door-rules.ts').DoorState; material?:import('./construction-materials.ts').ConstructionMaterial; bills?: import('./cooking-types.ts').CookingBill[]; fuel?: import('./fuel.ts').FuelState; id: number; kind: StructureKind; orientation: Orientation; footprint: Footprint }
export interface Stock { wood: number; food: number }
export type MaterialOwner = {type:'trade-request284';requestId:number;optionId:number} | {type:'world-site263';siteId:number} | {type:'starting-pod';podId:number} | {type:'orbital-ship';shipId:number} | {type:'orbital-cargo';deliveryId:number} | {type:'grave';graveId:number} | ({ type: 'ground' } & Cell) | { type: 'pawn'; pawnId: number } | {type:'inventory';pawnId:number} | {type:'equipment';pawnId:number} | {type:'apparel';pawnId:number} | { type: 'job'; jobId: number };
export interface MaterialPile { /** Individual prospective book; quantity is exactly one. */ book?:import('./book-state-295.ts').NovelBook295; /** Actual CompForbiddable on prospective ordinary Things; never migration enrichment. */ forbidden?:true; egg?:import('./animal-egg-state-v256.ts').FertilizedEggState256;
  /** Permission only; wild egg ownership and incubation are separate. */
  eggForbidden?:true; prostheticWork273?:import('./prosthetic-work-273.ts').ProstheticWork273; smithingWork?:import('./smithing-work-267.ts').SmithingWork267; innerResource?:Resource; plantPack?:import('./tree-transfer-state.ts').TreePack; mechCorpse?:import('./mechanoid-corpse.ts').MechanoidCorpseState; componentWork?:import('./component-work.ts').ComponentWork; flakWork?:import('./flak-work.ts').FlakWork; artWork?:import('./art-work.ts').ArtWork; gunWork?:import('./gun-work.ts').GunWork; humanCorpse?:import('./human-corpses.ts').HumanCorpseState; foodPoison?:import('./food-poisoning.ts').FoodContamination; damage?:number; corpse?:import('./corpses.ts').CorpseState; unfinished?:import('./unfinished.ts').UnfinishedState; apparel?:import('./apparel-rules.ts').ApparelState; weapon?:import('./equipment-rules.ts').WeaponState; haulRequested?: true; id: number; kind: MaterialKind; item: ItemId; quantity: number; owner: MaterialOwner; rot?: import('./food-preservation.ts').RotState }
export type StorageFilters = { 'ai-core'?:boolean; book?:boolean; prosthesis?:boolean; wort?:boolean; beer?:boolean; jade?:boolean; plant?:boolean; chemfuel?:boolean; neutroamine?:boolean; 'mech-corpse'?:boolean; silver?:boolean; corpse?:boolean; wood:boolean; food:boolean; unfinished?:boolean; textile?:boolean; chunk?:boolean; steel?:boolean; gold?:boolean; uranium?:boolean; plasteel?:boolean; component?:boolean; 'advanced-component'?:boolean; medicine?:boolean; weapon?:boolean; apparel?:boolean; blocks?:boolean; furniture?:boolean };
export interface StockpileCell extends Cell, StorageConditions { /** Logical zone identity; physical cell IDs remain haul destinations. */ zoneId?:number; items?:Partial<Record<ItemId,boolean>>; id: number; filters: StorageFilters; priority: number; capacity: number }
export interface GrowingZone { basinId?:number; id: number; cells: number[]; plant: import('./forestry-content-291.ts').GrowingPlant291; allowSow: boolean; allowCut: boolean }
export type HaulDestination = {type:'fermenting-barrel';structureId:number} | {type:'hopper';structureId:number} | { type:'turret';structureId:number;forced?:true } | { type: 'fuel'; structureId: number; forced?: boolean; forCooking?: boolean;forCrafting?:true } | { type: 'stockpile'; stockpileId: number; forHunting?: true } | { type: 'job'; jobId: number; forConstruction?: boolean } | ({ type: 'aside'; growingZoneId?: number; sowCell?: Cell; constructionId?: number; forConstruction?: boolean } & Cell);
export interface HaulTask {
  /** A whole furniture identity, never a divisible material pile. */
  whole?: true;
  serviceProgress?: number;
  sourcePileId: number;
  quantity: number;
  phase: 'pickup' | 'deliver';
  destination: HaulDestination;
  carryPileId: number | null;
  /** Source position survives removal of the last units for pickup-facing. */
  pickupCell?: Cell;
}
export interface DiningPlace { target: Cell; seatId: number | null; tableId: number | null }
export interface Memory { suspendedTicks?:number; kind: 'ate-without-table' | 'ate-raw-food' | 'ate-fine-meal' | 'ate-lavish-meal' | 'ate-nutrient-paste' | 'ate-kibble'; expiresAt: number }
export type NeedTask =
  | { kind: 'eat'; foodBinge299?:true; alcoholReason?:'joy'|'scheduled'|'addiction'|'ordered'|'binge'|'inventory'; forced?:true; phase: 'pickup' | 'collect' | 'choose-spot' | 'travel' | 'ingest'; sourcePileId: number | null; paste?:import('./nutrient-paste.ts').PasteRequest; carryPileId: number | null; quantity: number; progress: number; workRemainder?:number; dining: DiningPlace | null }
  | { kind: 'sleep'; roomRest?:import('./room-experience.ts').RoomRest; medical?:'patient'|'bedrest'; phase: 'travel' | 'sleep'; bedId: number | null; target: Cell };
export interface Job extends Cell { wallDoor296?:import('./wall-door-state-296.ts').WallDoorState296; frameDamage?:number;
  tree?:import('./tree-transfer-state.ts').TreeTask; plantTarget?:{resourceId:number};
  fixBreakdown?:import('./breakdowns.ts').BreakdownTarget;
  floor?:import('./flooring.ts').FloorKind;
  flick?:{structureId:number;kind:StructureKind;on:boolean};
  repair?:import('./repairs.ts').RepairTarget;
  /** Captured Core ticks for the current pick stroke; light changes affect the next. */
  pickTicks?:number;
  workRemainder?:number;
  material?:import('./construction-materials.ts').ConstructionMaterial;
  installationWork?: 'build' | 'haul';
  furniture?: import('./furniture-rules.ts').FurnitureTarget;
  deconstruction?: import('./deconstruction-rules.ts').DeconstructionTarget;
  construction?: 'blueprint' | 'frame';
  /** Plant clearing is work on the same construction intent, before delivery. */
  clearance?: {resourceId:number; progress:number; workRemainder?:number};
  /** Generated intention, rechecked against this zone while pending/active. */
  growingZoneId?: number;
  flowerPotId?:number;
  id: number;
  kind: JobKind;
  orientation: Orientation;
  footprint: Footprint;
  status: 'pending' | 'active';
  reservedBy: number | null;
  progress: number;
  escrow: Stock;
}
export interface Pawn extends Cell { /** Shared fixed catalogue: 1 novels allowed, 2 none; absent is the neutral default 1. */ readingPolicy295?:1|2; firefoamTask290?:import('./firefoam-manual-290.ts').FirefoamManualTask290; shipCasketTask277?:import('./ship-casket-state-277.ts').ShipCasketTask277; shipCryptosleepHeldAt277?:number; hiveDefeatSuspendedTicks271?:number[]; cryptosleepHeldAt271?:number; cryptosleepTask?:import('./cryptosleep-state-271.ts').CryptosleepTask271; caravanRest?:import('./caravan-rest-state-266.ts').CaravanRestMark266; worldAffiliation259?:import("./world-affiliation-259.ts").WorldAffiliation259; prisonerHistory259?:import("./prisoner-state.ts").PrisonerState; nativeHuman?:import('./native-human-identity-256.ts').NativeHumanIdentity256; hiveDefeats?:number[];
  /** Initial actual Camp Spawn facing; absent on historical actors. */
  arrivalRotation?:Orientation;
  /** One true global bed owner; local bedId/bedSlot remain map-local aliases. */
  mapBed?:import('./actor-map-bed-256.ts').ActorMapBed256;
  allowedAreaId?:number;
  allowedAreaReturn?:AllowedAreaReturn;
  animalRescue?:import('./animal-rest-state.ts').AnimalRescueTask;
  brewing?:import('./fermentation-state-265.ts').BarrelExtractionTask265;
  drugPolicyId?:number;
  deepWork?:import('./deep-drilling-rules.ts').DeepWorkTask;
  factionComms298?:import('./faction-comms-state-298.ts').FactionCommsTask298;
  orbitalTrade?:import('./orbital-state.ts').OrbitalTradeTask;
  age?:import('./human-age.ts').HumanAge;
  appearance?:import('./pawn-appearance.ts').PawnAppearance;
  animalHandling?:import('./domestic-state.ts').AnimalHandlingTask;
  animalCare?:import('./domestic-state.ts').AnimalCareTask;
  animalFeed?:import('./animal-feeding-rules.ts').AnimalFeedTask;
  roomMemories?:import('./room-experience.ts').RoomMemory[];
  body?:import('./human-corpses.ts').HumanBodyState;
  burial?:import('./burial.ts').BurialTask;
  cleaning?:import('./cleaning.ts').CleaningTask;
  openCasket?:import('./ancient-casket-state-256.ts').AncientCasketOpening256;
  filthFeet?:import('./filth.ts').FilthFeet;
  visitor?:import('./visitor-state.ts').VisitorState;
  trade?:import('./trade-state.ts').TradeTask;
  firefighting?:import('./fire-rules.ts').FirefightingTask;
  burning?:import('./fire-rules.ts').BurningReaction;
  prisoner?:import('./prisoner-state.ts').PrisonerState;
  recruitment?:{capturedAt:number;recruitedAt:number;fromFaction:'outlaws';raidGroup?:number};
  ward?:import('./prisoner-state.ts').WardTask;
  hunting?:import('./hunting-state.ts').HuntingTask;
  heatRefuge?:import('./heat-refuge.ts').HeatRefuge;
  research?:import('./research.ts').ResearchTask;
  social?:import('./social-state.ts').SocialState;
  bereavement?:import('./bereavement.ts').DeathMemory[];
  deathThoughts?:import('./death-thoughts-state.ts').DeathThoughtMemory[];
  familyBereavement?:import('./family-bereavement.ts').FamilyDeathMemory[];
  romanceMemories?:import('./romance-memories.ts').RomanceMemory[];
  coupleClock285?:import('./couple-state-285.ts').CoupleClock285;
  coupleTask285?:import('./couple-state-285.ts').CoupleTask285;
  partyMemories292?:import('./party-memories-292.ts').PartyMemory292[];
  coupleMemories285?:import('./couple-memories-285.ts').CoupleMemory285[];
  raid?:import('./raid-state.ts').RaiderState;
  traits?: import('./traits.ts').TraitId[];
  background?: import('./colonist-backgrounds.ts').ColonistBackground;
  mental?: import('./mental-state.ts').MentalState;
  faction?:import('./affiliation.ts').FactionId;
  hostilityResponse?:'ignore'|'attack';
  lastAttack?:import('./automatic-combat-state.ts').AttackMemory;
  /** Last real close melee attempt, including a miss; independent of faction. */
  meleeThreat?:{attackerId:number;atCore:number};
  disturbance?:import('./disturbance-state.ts').DisturbanceState;
  tactics?:import('./tactics-state.ts').TacticsState;
  flee?:import('./threats.ts').FleeState;
  bombRefuge?:import('./mini-turret-state.ts').BombRefuge;
  melee?:import('./melee-state.ts').MeleeState;
  stun?:import('./stun.ts').StunState;
  shooting?:import('./shooting-state.ts').ShootingState;
  stagger?:import('./stagger.ts').StaggerState;
  draft?:import('./drafting-rules.ts').DraftState;
  equipmentTask?:import('./equipment-rules.ts').EquipmentTask;
  equipmentDropPending?:true;
  droppedWeaponId?:number;
  feed?: import('./feeding-rules.ts').FeedTask;
  tend?: import('./care-rules.ts').TendTask;
  surgeryRequest?:import('./surgery-state.ts').SurgeryRequest;
  surgery?:import('./surgery-state.ts').SurgeryTask;
  careDisabled?:true;
  medicalCare?:import('./medicine-rules.ts').MedicalCare;
  selfTend?:true;
  rescue?: import('./rescue-state.ts').RescueTask;
  health?: import('./injury-types.ts').MedicalRecord;
  /** Actual sleep while incapacitated, separate from lying posture. */
  medicalSleep?:true;
  /** Interruption retained one undroppable/in-flight object, not an inventory. */
  interruptedCargo?: true;
  skills: import('./skills.ts').PawnSkills;
  priorityWork?: import('./priority-work-state.ts').PriorityWork;
  /** A physical exit from furniture after interruption; retained across saves. */
  transitExit?: true;
  orders: import('./player-orders.ts').PlayerOrders;
  recreation: import('./recreation-rules.ts').RecreationNeed;
  foodPolicyId: number;
  schedule: import('./schedule.ts').ScheduleAssignment[];
  restZeroTicks: number;
  collapsePending: boolean;
  id: number;
  name: string;
  hunger: number;
  rest: number;
  mood: number;
  comfort: number;
  beauty: number;
  mapAreas?:import('./pawn-map-areas.ts').PawnMapAreas;
  caravanCarrySick?:boolean;
  apparelPolicyId?:number;
  apparelAutomation?:boolean;
  nextApparelCheckAt?:number;
  memories: Memory[];
  deniedJoining?:number[];
  /** Physical arrival provenance; not a second owner or a reward transaction. */
  originQuestId?:number;
  /** Civilian crash provenance and admission, never colonial authority. */
  podRescue?:import('./pod-rescue-state.ts').PodRescuePawn;
  jobId: number | null;
  haul: HaulTask | null;
  cooking: import('./cooking-types.ts').CookingTask | null;
  need: NeedTask | null;
  /** Persistent ownership, distinct from an active sleep reservation. */
  bedId: number | null;
  bedSlot?: BedSlot;
  needCooldown: number;
  /** Last actual committed ingestion at this original human owner Core; absence is unknown. */
  lastIngestAtCore299?:number;
  /** Actual local civil wait/move only; absence preserves historical state. */
  idleWander300?:import('./idle-wander-300.ts').IdleWander300;
  state: PawnState;
  priorities: Record<WorkType, number>;
  /** Serialized route and cadence make save/resume exactly reproducible. */
  path: Cell[];
  moveCooldown: number;
  /** Active edge and exact fractional arrival, saved independently of presentation. */
  motion?: import('./movement.ts').TravelSegment | null;
  planCooldown: number;
}
export interface WorldEvent { tick: number; type: 'job' | 'need' | 'command'; message: string }
export interface World {
  /** Sole campaign RAW owner, born only after an actual successful departure. */
  escapedShips298?:import('./ship-escape-state-298.ts').EscapedShips298;
  party292?:import('./party-state-292.ts').PartyState292;
  firefoam290?:import('./firefoam-state-290.ts').FirefoamWorld290;
  ancientShrineWarnings?:import('./ancient-shrine-warning-state-256.ts').AncientShrineWarnings256;
  exploration?:import('./exploration-state-256.ts').ExplorationState256;
  geysers?:import('./local-geyser-state-256.ts').LocalGeysers256;
  riverWater?:import('./river-water-owner-256.ts').StoredRiverWater256;
  roadInfo?:import('./local-road-info-256.ts').LocalRoadInfo256;
  worldMaps?:import('./world-map-state.ts').WorldMapRegistry;
  worldGroups?:import('./world-map-state.ts').WorldGroupRegistry;
  /** Prospective local exposure stream, independent of campaign RNG. */
  deterioration?:import('./deterioration-content.ts').DeteriorationState;
  secondarySite?:import('./secondary-site-state.ts').SecondarySite;
  /** Real secondary-map provenance; no crash landing or supplies are inferred. */
  expeditionSite?:{tile:number;createdAt:number;calendarOffset:number};
  /** Snapshot-only campaign knowledge; never an additional physical owner. */
  campaignPeople?:import('./relationship-state.ts').RelationshipPerson[];
  /** Snapshot-only navigation metadata; full inactive terrain stays in worker. */
  campaignMap?:({active:'home'|'secondary';secondaryTile:number;createdAt:number;visitIds:number[];incidents?:import('./secondary-site-presentation.ts').CampaignIncident[];revision?:never}|import('./world-map-state.ts').CampaignMapPresentation);
  snow?:import('./snow-rules.ts').SnowState;
  snowClearArea?:number[];
  /** V318 prospective herd limits; absent policies leave the herd untouched. */
  autoSlaughter?:import('./auto-slaughter-state.ts').AutoSlaughterConfig[];
  allowedAreas?:AllowedArea[];
  orbital?:import('./orbital-state.ts').OrbitalState;
  deepResources?:import('./deep-resources.ts').DeepResourceState;
  planet?:import('./planet-state.ts').PlanetState;
  worldFactions?:import('./world-faction-state.ts').WorldFactionRegistry256;
  worldPawns?:import('./world-pawn-state-256.ts').WorldPawnsState256;
  group?:import('./group-state.ts').GroupState;
  groupLosses?:import('./group-state.ts').GroupLoss[];
  relationships?:import('./relationship-state.ts').RelationshipState;
  mechSalvage?:{completed:number;steel:number};
  mechanoids?:import('./mechanoid-state.ts').Mechanoid[];
  rainElectrical?:import('./rain-electric.ts').RainElectricalState;
  commercialTrip?:import('./commercial-state.ts').CommercialTrip;
  civilianPost?:import('./commercial-state.ts').CivilianPost;
  quests?:import('./quest-state.ts').QuestCalendar;
  scout?:import('./caravan-state.ts').ScoutState;
  breakdown?:import('./breakdowns.ts').BreakdownCalendar;
  economy?:import('./colony-economy.ts').ColonyEconomy;
  apparelWear?:import('./apparel-renewal.ts').ApparelWearState;
  apparelPolicies?:import('./apparel-policy.ts').ApparelPolicy[];
  nextApparelPolicyId?:number;
  filth?:import('./filth.ts').FilthState;
  visitors?:import('./visitor-state.ts').VisitorCalendar;
  trade?:import('./trade-state.ts').TradeLedger;
  climate?:import('./site-climate.ts').SiteClimate;
  wind?:import('./wind.ts').WindState;
  weather?:import('./weather.ts').WeatherState;
  fires?:import('./fire-rules.ts').FireState;
  prisonDepartures?:import('./prisoner-exit.ts').PrisonDeparture[];
  site?:import('./site.ts').LocalSite;
  gameProfile?:import('./game-profile.ts').GameProfile;
  scenario?:import('./scenario-definitions.ts').ScenarioStamp;
  startingArrival?:import('./starting-arrival-state.ts').StartingArrivalState;
  hunting?:{targets:number[];completed:number};
  butchery?:{completed:number;meat:number;leather:number};
  flora?:import('./wild-flora.ts').WildFloraState|import('./wild-plant-runtime-256.ts').WildFloraState256;
  wildlife?:import('./wildlife-state.ts').WildlifeState;
  heatwaves?:import('./heatwave.ts').HeatwaveCalendar;
  drugPolicies?:import('./alcohol-policy-265.ts').DrugPolicy265[];
  nextDrugPolicyId?:number;
  research?:import('./research.ts').ResearchState;
  shipReactorThreats275?:import('./ship-reactor-threats-275.ts').ShipReactorThreats275;
  raids?:import('./raid-state.ts').RaidCalendar;
  fluIncidents?:import('./flu-incidents.ts').FluIncidentCalendar;
  miscIncidents?:import('./cassandra-misc.ts').CassandraMiscCalendar;
  smallIncidents?:import('./cassandra-small.ts').CassandraSmallCalendar;
  worldIncidents?:import('./cassandra-world.ts').CassandraWorldCalendar;
  tradeRequests284?:import('./trade-request-state-284.ts').TradeRequests284;
  linkedStorage286?:import('./linked-storage-state-286.ts').LinkedStorageRegistry286;
  worldSites263?:import('./world-sites-state-263.ts').WorldSitesState263;
  worldDefence263?:import('./world-target-defence-263.ts').WorldTargetDefence263;
  worldSiteThreat263?:import('./world-site-ambush-state-263.ts').WorldSiteAmbush263;
  flashstorm?:import('./flashstorm.ts').FlashstormState;
  podRescues?:import('./pod-rescue-state.ts').PodRescueState;
  home?:number[];
  destroyed?:import('./barriers.ts').DestructionLedger;
  arrivals?:import('./arrival-state.ts').ArrivalState;
  projectiles?:import('./projectile-state.ts').WorldProjectile[];
  bombWaves?:import('./bomb-state.ts').MiniTurretBombWave[];
  roofing?: import('./roof-rules.ts').RoofingState;
  thermal?: import('./temperature.ts').ThermalState;
  packed: import('./furniture-rules.ts').PackedFurniture[];
  tailoring?:import('./unfinished.ts').TailoringLedger;
  deconstructed: import('./deconstruction-rules.ts').DeconstructionLedger;
  foodPolicies: import('./food-policy.ts').FoodPolicy[];
  nextFoodPolicyId: number;
  restRules: 'legacy' | 'adult';
  schemaVersion: typeof SCHEMA_VERSION;
  /** Prospective physical frontier; required by297 RAW, absent on older saves. */
  phaseCore297?: number;
  corePathBudget297?: {tick:number;remaining:number;pairs:number};
  /** V1–V4 continuations retain their former nutrition economy explicitly. */
  foodRules: 'legacy' | 'adult';
  seed: number;
  rng: number;
  tick: number;
  width: number;
  height: number;
  /** Row-major: tiles[z * width + x]. */
  tiles: Tile[];
  pawns: Pawn[];
  resources: Resource[];
  structures: Structure[];
  jobs: Job[];
  piles: MaterialPile[];
  stockpiles: StockpileCell[];
  growingZones: GrowingZone[];
  growingCursor: number;
  environment: 'temperate-equinox-v1';
  stock: Stock;
  spoiled: import('./food-preservation.ts').SpoiledFood;
  events: WorldEvent[];
  nextId: number;
  /** Rotating bounded logistics search position, persisted for exact continuation. */
  logisticsCursor: number;
}
export type DesignateCommand = { type: 'designate'; kind: JobKind; targetId?:number; orientation?: Orientation; material?:import('./construction-materials.ts').ConstructionMaterial; floor?:import('./flooring.ts').FloorKind } & Cell;
export type AreaAction = 'smooth-floor' | 'build-bridge' | 'remove-bridge' | 'snow-clear' | 'remove-snow-clear' | 'lay-floor' | 'remove-floor' | 'home' | 'remove-home' | 'build-roof' | 'remove-roof' | 'ignore-roof' | 'mine' | 'haul-chunks' | 'deconstruct' | 'chop' | 'harvest' | 'cut' | 'cancel' | 'stockpile' | 'remove-stockpile' | 'growing' | 'remove-growing';
export interface StorageSettings extends StorageConditions { items?:Partial<Record<ItemId,boolean>>; filters?: StorageFilters; priority?: number; capacity?: number }
export interface AreaCommand extends StorageSettings { type: 'area'; action: AreaAction; from: Cell; to: Cell; targetZoneId?:number; floor?: import('./flooring.ts').FloorKind }
export interface BuildLineCommand { type: 'build-line'; kind: import('./construction-line.ts').LineBuildKind; from: Cell; to: Cell; material?: import('./construction-materials.ts').ConstructionMaterial }
export type Command = import('./faction-comms-state-298.ts').FactionCommsCommand298 | {type:'read-book-295';pawnId:number;bookId:number} | {type:'reading-policy-295';pawnId:number;policyId:1|2} | import('./firefoam-state-290.ts').FirefoamCommand290 | import('./firefoam-manual-290.ts').FirefoamTriggerCommand290 | import('./animal-area-state-287.ts').AnimalAreaCommand287 | import('./linked-storage-state-286.ts').LinkedStorageCommand286 | import('./trade-request-state-284.ts').TradeRequestCommand284 | import('./ship-casket-state-277.ts').ShipCasketCommand277 | import('./ship-reactor-state-275.ts').ShipReactorCommand275 | import('./cryptosleep-state-271.ts').CryptosleepCommand271 | import('./alcohol-policy-265.ts').DrugPolicyCommand265 | import('./caravan-arrival-261.ts').CaravanArrivalCommand261 | import('./caravan-commands-261.ts').CaravanCommand261 | import('./material-permission-256.ts').MaterialPermissionCommand256 | import('./ancient-casket-state-256.ts').AncientCasketCommand256 | import('./local-road-prop-ownership-256.ts').ClaimRoadPropCommand256 | import('./animal-egg-permission-v256.ts').EggPermissionCommand256 | import('./world-map-state.ts').WorldMapCommand | import('./secondary-site-state.ts').SecondarySiteCommand | import('./tree-transfer-state.ts').TreeCommand | import('./orbital-state.ts').OrbitalCommand | import('./group-state.ts').GroupCommand | {type:'enable-mech-raids'} | import('./commercial-state.ts').CommercialCommand | import('./surgery-state.ts').SurgeryCommand | import('./quest-state.ts').QuestCommand | import('./caravan-state.ts').ScoutCommand | import('./domestic-state.ts').DomesticCommand | import('./burial.ts').BurialCommand | import('./cleaning.ts').CommandCleaning | import('./trade-state.ts').TradeCommand | import('./hunting-state.ts').HuntingCommand
  | import('./auto-slaughter-state.ts').AutoSlaughterCommand
  | {type:'spike-trap-auto-rebuild';structureId:number;on:boolean}
  | {type:'shelf-policy';structureId:number;settings:StorageSettings}
  | {type:'cut-blighted-crops'}
  | AllowedAreaCommand
  | import('./mini-turret-state.ts').TurretCommand
  | {type:'pen-species';markerId:number;species:import('./animal-species.ts').AnimalSpeciesId;accepted:boolean}
  | {type:'adopt-economy'}
  | {type:'climate-adopt'}
  | {type:'gather-spot';structureId:number;enabled:boolean}
  | {type:'heater-adjust';structureId:number;offset:-10|-1|1|10|null}
  | {type:'wind-auto-cut';structureId:number;enabled:boolean}
  | {type:'order-extinguish';pawnId:number;fireId:number}
  | {type:'prison-bed';bedId:number;enabled:boolean}
  | {type:'prisoner-mode';patientId:number;mode:import('./prisoner-state.ts').PrisonerMode}
  | {type:'order-capture';pawnId:number;patientId:number;queue:boolean}
  | {type:'order-arrest';pawnId:number;patientId:number;queue:boolean}
  | {type:'power-flick';structureId:number;on:boolean}
  | {type:'enable-wildlife'}
  | {type:'cancel-unfinished';itemId:number}
  | {type:'enable-raids'}
  | import('./arrival-state.ts').ArrivalCommand
  | {type:'hostility-response';pawnId:number;response:'flee'|'ignore'|'attack'}
  | import('./melee-state.ts').MeleeCommand
  | import('./shooting-state.ts').ShootingCommand
  | import('./drafting-rules.ts').DraftCommand
  | import('./equipment-rules.ts').EquipmentCommand
  | import('./medical-beds.ts').MedicalBedCommand
  | {type:'medical-care';pawnId:number;care:import('./medicine-rules.ts').MedicalCare}
  | {type:'medical-policy';pawnId:number;enabled:boolean}
  | {type:'order-feed';pawnId:number;patientId:number;queue:boolean}
  | {type:'order-tend';pawnId:number;patientId:number;queue:boolean}
  | {type:'order-drafted-tend';pawnId:number;patientId:number;queue:false}
  | {type:'order-consume';pawnId:number;pileId:number;queue:false}
  | {type:'self-tend-policy';pawnId:number;enabled:boolean}
  | {type:'order-rescue';pawnId:number;patientId:number;queue:boolean}
  | import('./doors.ts').DoorCommand
  | ({type:'install';structureId:number;orientation:Orientation} & Cell)
  | import('./player-orders.ts').OrderCommand
  | import('./food-policy.ts').FoodPolicyCommand
  | import('./apparel-system.ts').ApparelPolicyAssignmentCommand
  | import('./apparel-policy-edit.ts').ApparelPolicyUpdateCommand
  | import('./apparel-policy-edit.ts').ApparelPolicyNameCommand
  | import('./apparel-system.ts').ClearForcedApparelCommand
  | import('./schedule.ts').ScheduleCommand
  | { type: 'bill-add';recipe?:import('./production-recipes.ts').ProductionRecipe; structureId: number }
  | { type: 'bill-update'; structureId: number; billId: number; settings: import('./cooking-types.ts').BillSettings }
  | { type: 'bill-worker-policy'; structureId:number; billId:number; policy:import('./bill-worker-state-283.ts').BillWorkerPolicy283 }
  | { type:'bill-pause-policy';structureId:number;billId:number;policy:import('./bill-pause-state-289.ts').BillReservePausePolicy289 }
  | { type:'bill-pause-resume';structureId:number;billId:number }
  | { type: 'bill-remove'; structureId: number; billId: number }
  | { type: 'bill-move'; structureId: number; billId: number; direction: -1 | 1 }
  | DesignateCommand
  | AreaCommand
  | BuildLineCommand
  | { type: 'refuel-policy'; structureId: number; enabled: boolean }
  | { type: 'growing-policy'; zoneId: number; plant?: GrowingZone['plant']; allowSow: boolean; allowCut: boolean }
  | { type:'stockpile-policy'; stockpileId:number; settings:StorageSettings }
  | { type:'delete-zone'; kind:'stockpile'|'growing'; zoneId:number }
  | { type: 'assign-bed'; bedId: number; pawnId: number | null; slot?: BedSlot }
  | ({ type: 'cancel' } & Cell)
  | ({ type: 'stockpile'; enabled: boolean } & Cell & StorageSettings)
  | {type:'enable-heatwaves'}
  | {type:'cooler-target';structureId:number;target:number}
  | {type:'cooler-adjust';structureId:number;offset:-10|-1|1|10|null}
  | {type:'research-project';project:import('./research.ts').ResearchProject|null}
  | { type: 'priority'; pawnId: number; work: WorkType; value: number };
export type RefusalCode = 'invalid-command' | 'out-of-bounds' | 'occupied' | 'incompatible-resource' | 'missing-target' | 'invalid-priority' | 'invalid-storage';
export interface CommandResult { ok: boolean; reason?: string; code?: RefusalCode; affected?: number; skipped?: number }
export interface JobDiagnostic { code: 'clearing' | 'blocked' | 'working' | 'ready' | 'delivering' | 'missing-materials' | 'waiting-worker'; reason: string; delivered: number; required: number }
