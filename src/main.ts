import {isShipComputerSensorsKind298} from './sim/ship-computer-sensors-content-298';
import {isCorePhysicalSchema297} from './sim/physical-schema-297.ts';
import {updateShipAssemblyInspection276} from './ui/ship-assembly-inspection-276';
import {NativeStage} from './ui3d/NativeStage';
import {nativeTextEntitiesFor} from './ui3d/native-text-entities';
import {createNativeFrontMenu} from './ui3d/native-front';
import {buildNativePanel,buildNativeToolPalette,syncNativePanelState} from './ui3d/native-panels';
import {buildNativeEncounter,buildNativeFactions,setNativeWorldTab,focusNativeCaravanTrade} from './ui3d/native-world';
import {nativeOrderPage,cancelNativeOrderPage} from './ui3d/native-orders';
import {nativeHelpPage} from './ui3d/native-help';
import {createNativeSaveManager} from './ui3d/native-saves';
import {createNativeLocalTrade} from './ui3d/native-local-trade';
import {createNativeFactionComms298} from './ui3d/native-faction-comms-298';
import {buildNativeArrivals} from './ui3d/native-arrivals';
import type {NativeDomainAlert} from './ui3d/native-domain-alerts';
import {buildNativeInspector,setNativeInspectorTab} from './ui3d/native-inspector';
import {NativeHudCards} from './ui3d/native-hud';
import type {NativeHudViewAction} from './ui3d/native-hud';
import {NATIVE_DOCK_PREFERENCE_KEY,parseNativeDockPreferences,NATIVE_UI_SCALE_PREFERENCE_KEY,parseNativeUiScale,normalizeNativeUiScale,type NativeDockPreferences} from './ui3d/native-preferences';
import {installNativeCardboardCursors} from './ui/native-cardboard-cursors';
import type {NativeUiState,NativeUiActions,NativePage} from './ui3d/native-contract';
import {createNativeShipTerminal298,readAdoptedShipCredits298} from './ui3d/native-ship-terminal-298';
import type {ConstructionMaterial} from './sim/construction-materials';
import type {CampEntryProgressMessage256,CaravanEncounterProgressMessage261} from './bridge/protocol';
import {isShipPartKind276,SHIP_PART_DEFAULT_ORIENTATION_276} from './sim/ship-part-content-276';
import {updateShipReactorInspection275} from './ui/ship-reactor-inspection-275';
import {SceneApplicationContext} from './render/SceneApplicationContext';
import {groupGeographicTradeTarget256} from './sim/group-geographic-post-256';
import {updateColonistCard} from './ui/colonist-card';
import {groupWorld} from './sim/world-map-authority';
import {CaravanEncounterDialog261} from './ui/caravan-encounter-dialog-261';
import {createMainWorldCreationCallbacks256} from './ui/world-creation-main';
import type {WorldCreationCallbacks256,WorldCreationTicket256} from './ui/world-creation-contract';
import {ancientMonumentDescription256} from './ui/ancient-monument-inspection-256';
import {geyserInspection256} from './ui/geyser-inspection-256';
import {knownPosition256,knownPile256,knownBuilding256,knownNutrition256} from './ui/exploration-readers-256';
import {explorationEnabled256} from './sim/exploration-state-256';
import {knownNotificationTarget256} from './ui/notification-focus';
import {localRoadPropDescription256} from './ui/local-road-prop-inspection-256';
import {eggSpeciesForItem256} from './sim/animal-egg-content-v256';
import {createSettlementLimitPreference,readSettlementLimit,SETTLEMENT_LIMIT_PREFERENCE_KEY,type SettlementLimit} from './ui/settlement-limit-settings';
import type {CampaignSummary} from './sim/world-map-state';
import {createMapRegistryPanel,createMapJumpTo,type JumpToEntry} from './ui/map-registry-panel';
import {campaignUIFacts,mapDisplayName,readMapRegistryState,readJumpToEntries,readPlanetObjects,type CampaignUIState} from './ui/map-registry-adapter';
import {createPlanetView} from './ui/planet-view';
import type {ThreatPauseMode,ThreatPauseToken,UrgentThreatReceipt} from './bridge/urgent-threats';
import {THREAT_PAUSE_PREFERENCE_KEY,createThreatPausePreference,readThreatPausePreference,createDeferredResumeGuard} from './ui/threat-pause-settings';
import {createUrgentThreatFeedback,urgentThreatLabel,type UrgentThreatTarget} from './ui/urgent-threat-feedback';
import { createAllowedAreaControls } from './ui/allowed-area-controls';
import './ui/allowed-area-controls.css';
import { createFirstDayGuide } from './ui/first-day-guide';
import {createFirstGesturesLearning,FIRST_GESTURES_STORAGE_KEY} from './ui/first-gestures-learning';
import {createFirstGesturesGuide} from './ui/first-gestures-guide';
import { createStartingArrivalUI } from './ui/starting-arrival';
let allowedAreaEditId:number|undefined;
import {PresentationQueue} from './render/PresentationQueue';
import {PresentationChanges} from './bridge/presentation-changes';
import {ConfirmedStructurePhaseReader} from './render/ConfirmedStructurePhases';
import {createClosedMainMapIntentReader} from './render/closed-main-map-intents';
import { isBedKind } from './sim/bed-kinds';
import { bedSlotsCount } from './sim/bed-slots';
import { bedRestEffectiveness } from './sim/furniture-stats';
import { mentalCrisisView } from './sim/mental-presentation';
import { bedHealPerDay,bedImmunityFactor,bedTendOffset,bedSurgeryFactor } from './sim/hospital-medical-stats';
import {vitalsMonitorInspection} from './ui/vitals-monitor-inspection';
import { createCommercialUI } from './ui/commercial-panel';
import {appearanceOf} from './sim/pawn-appearance';
import {humanLimbVisualMask} from './render/human-anatomy-presentation';
import {portraitDataUrl,portraitExpressionOf} from './ui/pawn-portrait';
import {updatePawnAppearanceInspection} from './ui/pawn-appearance-inspection';
import {pawnBaseColor} from './render/pawn-appearance-shape';
import { createColonyEconomyUI } from './ui/colony-economy';
import {QUALITY_LABELS} from './sim/equipment-rules';
import {structureBeauty} from './sim/room-beauty';
import { floraDefinition } from './sim/biome-flora';
import { updateBurialControls } from './ui/burial-controls';
import { updateHygieneControls } from './ui/hygiene-controls';
import { isBuildableFloor } from './sim/flooring';
import { createOrbitalTradeUI } from './ui/orbital-trade-panel';
import { createTradeUI } from './ui/trade-panel';
import { climateControls } from './ui/climate-inspection';
import { createSiteHud } from './ui/site-hud';
import { createResourceLedger } from './ui/resource-ledger';
import { installArchitectWorkbench } from './ui/architect-workbench';
import { installTimeControls } from './ui/time-controls';
import { WEATHER } from './sim/weather-definitions';
import { perceivedWeather, weatherRainRate } from './sim/weather';
import { windIntensity } from './sim/wind-rules';
import { firePosition } from './sim/fire-rules';
import { calendarTick } from './sim/calendar';
import { GameSession, SAVE_KEY, PREVIOUS_KEY } from './ui/game-session';
import { BrowserSaveRepository } from './ui/save-repository';
import { AutosaveScheduler, AUTOSAVE_PREFERENCE_KEY, autosaveMinutes } from './ui/autosave';
import { createSaveManager } from './ui/save-manager';
import { fetchTestColonies, readSaveFile, readTestColony } from './ui/test-colonies';
import { createFrontMenu,type FrontMenuOptions } from './ui/front-menu';
import { bindRenderPerformanceControls } from './ui/render-performance-controls';
import { DEFAULT_SHADOW_SETTINGS, SHADOW_PREFERENCE_KEY, parseShadowSettings, type ShadowSettings } from './render/shadow-settings';
import { DEFAULT_ANIMATION_SETTINGS, ANIMATION_PREFERENCE_KEY, parseAnimationSettings, type AnimationSettings } from './render/animation-settings';
import {DESIGNATION_VISIBILITY_KEY,designationMinCellPixels,designationVisibilityLabel} from './ui/designation-visibility';
import {ITEM_LABEL_VISIBILITY_KEY,itemLabelMinCellPixels,itemLabelVisibilityLabel} from './ui/item-label-visibility';
import {applyUiFont,readUiFont,saveUiFont,UI_FONT_CHOICES,type UiFontId} from './ui/ui-fonts';
import {CLOUD_MASK_RADIUS_KEY} from './render/cloud-mask';
import {DECOR_OCCLUSION_KEY,DEFAULT_DECOR_OCCLUSION_ENABLED,decorOcclusionEnabled} from './render/decor-occlusion-settings';
import {DIORAMA_PREFERENCE_KEY,DEFAULT_DIORAMA_ENABLED,dioramaEnabled as parseDioramaEnabled} from './render/diorama-settings';
import {ROOM_PREFERENCE_KEY,DEFAULT_ROOM_ENABLED,roomEnabled as parseRoomEnabled} from './render/room-settings';
import {ROOM_MASK_RADIUS_KEY} from './render/room-mask-settings';
import {LIGHTING_PREFERENCE_KEY,DEFAULT_LIGHTING_SETTINGS,LIGHTING_CONTROLS,parseLightingSettings,lightingPercentLabel,type LightingSettings} from './render/lighting-settings';
import type { PawnTrack } from './bridge/motion-tracks';
import { SCENARIOS, type ScenarioId } from './sim/scenario-definitions';
import { INFECTION_UNIT,infectionStage } from './sim/infection-rules';
import { FLU_UNIT,fluStage } from './sim/flu-rules';
import { IMMUNE_DISEASE_UNIT,immuneDiseaseStage } from './sim/immune-diseases-rules';
import { IMMUNE_DISEASE_KINDS } from './sim/immune-diseases-types';
import { corpseStage } from './sim/corpses';
import { updateAnimalsPanel } from './ui/animals-panel';
import type { AutoSlaughterConfig } from './sim/auto-slaughter-state';
import { updateWildlifePanel } from './ui/wildlife-panel';
import { createHeatwaveUI } from './ui/heatwave';
import { createWeatherConditionUI, weatherConditionLabel } from './ui/weather-inspection';
import { createShortCircuitUI } from './ui/short-circuit';
import { createFlashstormUI } from './ui/flashstorm';
import { createSolarFlareUI } from './ui/solar-flare';
import { updateResearchPanel,type ResearchPanelActions } from './ui/research-panel';
import { specificWorkActivity } from './ui/work-activity';
import {coupleActivity285} from './ui/couple-activity-285';
import { createScoutUI } from './ui/scout-panel';
import {createCampPreparationView256} from './ui/camp-preparation-view-256';
import { createGroupPanel } from './ui/group-panel';
import { createGroupAdapters, readGroupPanelSnapshot } from './ui/group-adapter';
import { createQuestUI } from './ui/quests';
import { mountStorageControls, type MountedStorageControls as StorageControls, type StorageControlSettings } from './ui/storage-item-controls';
import { stockpileZoneCells, stockpileZoneId, stockpileCellsByZoneId } from './sim/stockpile-zones';
import { isShelfKind } from './sim/shelf-storage';
import { shelfControlOptions,updateShelfInspection } from './ui/shelf-inspection';
import {createLinkedStorageControls286,linkedStoragePasteScope286} from './ui/linked-storage-286';
import {updateCryptosleepInspection271} from './ui/cryptosleep-inspection-271';
import {updateShipCasketInspection277} from './ui/ship-casket-inspection-277';
import './ui/zone-controls.css';
import './ui/storage-item-controls.css';
import { updateUnfinishedInspection } from './ui/unfinished-inspection';
import { createSocialInspection,updateSocialInspection } from './ui/social-inspection';
import { createJournalInspection,updateJournalInspection } from './ui/journal-inspection';
import { createRaidUI } from './ui/raids';
import { createStatusAlerts } from './ui/status-alerts';
import type { NotificationTarget } from './ui/notification-focus';
import { barrierHp,barrierMaxHp,isBarrier } from './sim/barriers';
import { resourceMaxHp, structureMaxHp } from './sim/thing-damage-rules';
import { rockMaxHP } from './sim/mining-rules';
import { createArrivalUI } from './ui/arrivals';
import { createMoodInspection,updateMoodInspection } from './ui/mood-inspection';
import { isColonist,activeThreat } from './sim/affiliation';
import { prisonBreakActive } from './sim/prison-break-state';
import { ShootingControls } from './ui/shooting-controls';
const shootingControls=new ShootingControls();
import { createDraftControls,updateDraftControls,toggleDraft,draftLabel } from './ui/drafting-controls';
import { apparelProjection,apparelAppearance } from './render/character-apparel';
import { createEquipmentInspection,updateEquipmentInspection } from './ui/equipment-inspection';
import { equipmentProjection,equipmentDescription } from './render/character-equipment';
import { bedControls,updateBedControls } from './ui/bed-controls.ts';
import { medicalBleed } from './sim/injury-state';
import { createHealthInspection,updateHealthInspection,healthSurgeryActionsAvailable280 } from './ui/health-inspection';
import { createPrisonerInspection,updatePrisonerInspection } from './ui/prisoner-inspection';
import { createSkillsInspection, updateSkillsInspection, updateWorkSkills } from './ui/skills-inspection';
import { BACKGROUND_SKILL_IDS, backgroundSkillRefusal } from './sim/colonist-backgrounds';
import { BACKGROUND_SKILL_LABELS, backgroundSummary, backgroundRestrictionRows, updateBackgroundWorkControl } from './ui/background-inspection';
import { updateCoolerControls } from './ui/cooler-controls';
import { powerInspection } from './ui/power-inspection';
import { nutrientPasteInspection,pasteTaskLabel } from './ui/nutrient-paste-inspection';
import { televisionInspection } from './ui/television-inspection';
import { updatePowerControls } from './ui/power-controls';
import { buildingLabels } from './ui/building-labels';
import { outdoorTemperature } from './sim/temperature';
import { SnapshotHud } from './ui/snapshot-hud';
import { isRoofArea } from './sim/roof-rules';
import { stationRecipe } from './sim/production-recipes';
import { RoomInspection } from './ui/room-inspection';
import { constructionControls, constructionDeliveryLabel, structureFootprintLabel,placementMaterial } from './ui/construction-controls';
import { constructionRecipe } from './sim/construction-materials';
import { rockInspection } from './ui/geology-inspection';
import { doorControls, updateDoorControls } from './ui/door-controls';
import { penControls, updatePenControls } from './ui/pen-controls';
import {firefoamControls290,updateFirefoamControls290} from './ui/firefoam-controls-290';
import {spikeTrapControls} from './ui/spike-trap-controls';
import { furnitureControls, updateFurnitureControls } from './ui/furniture-controls';
import { furnitureObject, furnitureIntentAt } from './sim/furniture-rules';
import { fireControls, updateFireControls } from './ui/fire-controls';
import { PawnSelection } from './ui/pawn-selection';
import { createAnimalInspector, updateAnimalInspector } from './ui/animal-inspector';
import type {AnimalAreaActions287} from './ui/animal-area-287';
import {isSchema286OrLater} from './sim/schema-compatibility-257';
import { updateAnimalSpotControls } from './ui/animal-sleeping-spot-inspection';
import { createMechanoidInspector, updateMechanoidInspector } from './ui/mechanoid-inspection';
import { mechanoidView } from './sim/mechanoid-presentation';
import './ui/animal-inspector.css';
import { animalSpecies } from './sim/animal-species';
import { OrderMenu } from './ui/order-menu';
import type { SelectionGesture } from './render/PawnSelectionInput';
import { createScheduleControls } from './ui/schedule-controls';
import {createDrugPolicyControls265} from './ui/drug-policy-controls-265';
import {brewingInspection265} from './ui/brewing-inspection-265';
import { createFoodPolicyControls } from './ui/food-policy-controls';
import { createApparelPolicyControls } from './ui/apparel-policy-controls';
import { billControls, updateBillControls } from './ui/bill-controls';
import { growingControls } from './ui/growing-controls';
import { plantInspection, growingTemperatureInspection } from './ui/plant-inspection';
import { BIOME_LABELS,HILLINESS_LABELS } from './sim/site';
import { choppable,harvestable,isPlant } from './sim/plants';
import {growingPlantLabel291} from './sim/forestry-content-291';
import './style.css';
import './ui/colonist-inspector.css';
import './ui/cell-inspector.css';
import './ui/inspection-dossiers.css';
import './ui/journal-inspection.css';
import { presentCellDescription, type CellHealth } from './ui/cell-inspector';
import { mapObjectExists,nextMapObject,type MapObjectSelection } from './ui/map-object-selection';
import {mapObjectGroupCells,MAX_MAP_OBJECT_SELECTION} from './ui/map-object-group-selection';
import {mapObjectActions,mapObjectGroupActions} from './ui/map-object-actions';
import { MapHoverLightCache,mapHoverLines } from './ui/map-hover-readout';
import {installHoverReadoutLayout} from './ui/hover-readout-layout';
import { mapCellDetails } from './ui/map-cell-details';
import './ui/map-details.css';
import './ui/cursors.css';
import { pictogramDataUrl } from './ui/pictograms';
import { isMinifiedTree } from './sim/tree-transfer';
import { installVisualIdentity, type UiIcon } from './ui/visual-identity';
import { installArchitectIcons } from './ui/architect-icons';
import { syncToolCursor } from './ui/tool-cursors';
import { mountColonistInspector, updateColonistInspector, colonistInspectorState, type ColonistInspectorState } from './ui/colonist-inspector';
import { installTooltips, dismissTooltip, setTooltip } from './ui/tooltip';
import { installTextSelectionGuard } from './ui/text-selection';
import { pawnNeedsMarkup, updatePawnInspection } from './ui/pawn-inspection';
import { openObjectInformation } from './ui/object-information';
import { itemInformation } from './ui/item-information';
import {deteriorationInspection} from './ui/deterioration-inspection';
import {minifiedTreeDescription} from './ui/minified-tree-inspection';
import { healthCapacityRows } from './ui/health-inspection';
import {captureFoodReadability,type FoodReadability} from './sim/food-readability';
import { ITEM_DEFINITIONS, availableNutrition } from './sim/items';
import { foodFreshnessLabel } from './ui/food-freshness';
import { SimulationClient } from './bridge/SimulationClient';
import type {SnapshotReader} from './bridge/SimulationClient';
import {readNativeCorePhaseInput297,createNativeCloneResidentLane,type NativeCloneResidentLane} from './bridge/native-clone-resident';
import {MainFrameAdmissionFIFO} from './bridge/main-frame-admission-fifo';
import {readResidentWorkerMessage} from './bridge/resident-protocol';
import type { AudioCue } from './bridge/audio-cues';
import { AudioDirector } from './audio/AudioDirector';
import { MusicDirector, type MusicMood } from './audio/MusicDirector';
import { ambientCameraGain, FoliageAmbience } from './audio/ambience';
import { createNearbyFireCollector, createNearbyMachineCollector, runningMachineAudioSource } from './audio/continuous';
import { listenerPose, type AudioCamera } from './audio/spatial';
import { ColonyRenderer } from './render/ColonyRenderer';
import { SceneStructurePreparation } from './render/SceneStructurePreparation';
import { SceneLightTopology } from './render/SceneLightTopology';
import { EnvironmentLightField } from './render/EnvironmentLightField';
import { EnvironmentLighting } from './render/EnvironmentLighting';
import type { JobKind, Pawn, World, WorkType, Orientation, AreaAction, Cell, Command } from './sim/types';
import { TICKS_PER_DAY } from './sim/types';
import { DEFAULT_MAP_SIZE, MAP_SIZE_PRESETS } from './sim/map-config';
import { footprintCells, queryJobStatus, queryPawnStatus } from './sim/index';
import {STRUCTURE_DEFINITIONS} from './sim/definitions';
import { gameLayout, storageSettings, toolDefinitions, workColumns } from './ui/layout';
import {architectAvailabilityKey,architectToolAvailable,architectCategoryAvailable} from './ui/architect-availability';
import type { ArchitectCategory, Panel, Tool } from './ui/layout';
import { updateMiniTurretControls } from './ui/mini-turret-controls';
import { miniTurretView,turretSeconds } from './sim/mini-turret-presentation';

import { updateRecreationInspection } from './ui/recreation-inspection';
import { gatherSpotControls, updateGatherSpotControls } from './ui/gather-spot-controls';
import './ui/visual-identity.css';
import './ui/site-hud.css';
import './ui/resource-ledger.css';
import './ui/architect-workbench.css';
import './ui/time-controls.css';
import './ui/first-day-guide.css';
import './ui/first-gestures-guide.css';
const jobLabels: Record<JobKind, string> = { 'ship-computer':'Construction de l’ordinateur de vaisseau','ship-sensors':'Construction des capteurs de vaisseau', 'firefoam-popper':'Construction du diffuseur de mousse', 'ship-cryptosleep-casket':'Construction du caisson spatial','ship-beam':'Construction de la poutre structurelle de vaisseau','ship-engine':'Construction du moteur Johnson–Tanaka', 'ship-reactor':'Construction du réacteur stellaire', 'cryptosleep-casket':'Construction du caisson de cryptosommeil', 'fueled-smithy':'Construction de la forge à combustible','electric-smithy':'Construction de la forge électrique', brewery:'Construction de la brasserie','fermenting-barrel':'Construction du fût de fermentation', 'geothermal-generator':'Construction de la centrale géothermique', column:'Construction de la colonne',urn:'Construction de l’urne','stele-large':'Construction de la grande stèle','stele-grand':'Construction de la stèle monumentale',sarcophagus:'Construction du sarcophage', 'torch-lamp':'Construction de la lampe-torche', 'build-bridge':'Construction du pont','remove-bridge':'Retrait du pont', vent:'Construction de la bouche d’aération', 'extract-tree':'Déracinement de l’arbre','replant-tree':'Replantation de l’arbre', 'sleeping-spot':'Couchage au sol', shelf:'Construction de l’étagère', 'small-shelf':'Construction de la petite étagère', 'spike-trap':'Construction du piège à pointes', 'electric-crematorium':'Construction du crématorium électrique','electric-smelter':'Construction de fonderie électrique','animal-sleeping-spot':'Emplacement de couchage animal', 'biofuel-refinery':'Construction de la raffinerie de biocarburant','chemfuel-generator':'Construction du générateur à biocarburant', 'nutrient-paste-dispenser':'Construction du distributeur de pâte nutritive',hopper:'Construction de la trémie', 'orbital-beacon':'Construction de la balise orbitale','comms-console':'Construction de la console de communication', 'deep-drill':'Construction de foreuse profonde','ground-scanner':'Construction du scanner souterrain', 'vitals-monitor':'Construction du moniteur vital', 'drug-lab':'Construction du laboratoire de chimie', 'hydroponics-basin':'Construction du bac hydroponique', 'mini-turret':'Construction de mini-tourelle automatique', 'tube-television':'Construction de télévision cathodique', sandbags: 'sacs de sable', fence:'Clôture','fence-gate':'Portillon',autodoor:'Porte automatique','pen-marker':'Marqueur d’enclos', 'art-bench':'Atelier de sculpture','small-sculpture':'Petite sculpture','large-sculpture':'Grande sculpture', 'machining-table':'Atelier d’usinage','fabrication-bench':'Établi de fabrication','hi-tech-research-bench':'Bureau de recherche haute technologie','multi-analyzer':'Multi-analyseur', grave:'Creuser une tombe','smooth-floor':'Lissage du sol','lay-floor':'Pose de sol','remove-floor':'Retrait de sol', heater:'Radiateur','wind-turbine':'Éolienne',flick:'Actionner un interrupteur', 'power-conduit':'Construction du câble', 'power-switch':'Construction de l’interrupteur', battery:'Construction de la batterie', 'solar-generator':'Construction du générateur solaire', 'fueled-stove':'Cuisinière à bois','electric-stove':'Cuisinière électrique','butcher-table':'Table de boucherie', 'butcher-spot':'Emplacement de boucherie', cooler:'Climatiseur', 'research-bench':'Bureau de recherche','tailor-bench':'Établi de tailleur','electric-tailor-bench':'Établi de tailleur électrique', 'crafting-spot':'Emplacement d’artisanat', repair:'Réparation', 'fix-breakdown':'Remplacement du composant', 'wood-generator':'Construction du générateur à bois', 'sun-lamp':'Construction de la lampe horticole', 'standing-lamp':'Construction de la lampe', 'passive-cooler':'Construction du refroidisseur passif', 'build-roof':'Pose de toit', 'remove-roof':'Retrait de toit', door:'Construction de la porte', stonecutter:'Construction de la table de taille', mine:'Minage', uninstall:'Désinstallation',install:'Réinstallation', deconstruct: 'Déconstruction', chop: 'Abattage', harvest: 'Récolte', cut: 'Coupe de plante', sow: 'Semis', wall: 'Construction du mur', 'double-bed':'Construction du lit double', bedroll:'Construction du sac de couchage', bed: 'Construction du lit', 'hospital-bed':'Construction du lit d’hôpital', table: 'Construction de la table','table-square':'Construction de la table carrée','table-long':'Construction de la table longue', stool: 'Construction du tabouret','dining-chair':'Construction de la chaise',armchair:'Construction du fauteuil','end-table':'Construction de la table de chevet',dresser:'Construction de la commode','flower-pot':'Construction du pot de fleurs', horseshoes: 'Construction du piquet de fers à cheval', 'chess-table': 'Construction de la table d’échecs', campfire: 'Construction du feu de camp' };
const stateLabels: Record<Pawn['state'], string> = { resting:'Au lit pour soins', downed:'À terre', dead:'Décédé', idle: 'Disponible', moving: 'En chemin', working: 'Au travail', sleeping: 'Se repose', hungry: 'Cherche à manger', eating: 'Mange', recreating: 'Se divertit' };
const rotatableTools=new Set<Tool>(['ship-cryptosleep-casket','ship-beam','ship-engine','ship-reactor','cryptosleep-casket','fueled-smithy','electric-smithy','brewery','fermenting-barrel','vent','sleeping-spot','shelf','small-shelf','electric-crematorium','electric-smelter','biofuel-refinery','nutrient-paste-dispenser','hopper','comms-console','deep-drill','ground-scanner','vitals-monitor','drug-lab','hydroponics-basin','tube-television','art-bench','machining-table','hi-tech-research-bench','fabrication-bench','grave','wind-turbine','battery','fueled-stove','electric-stove','butcher-table','install','bedroll','bed','double-bed','hospital-bed','table','table-square','table-long','dining-chair','armchair','end-table','dresser','campfire','stonecutter','butcher-spot','crafting-spot','research-bench','tailor-bench','electric-tailor-bench','cooler']);
const resourceLabels = { hops:'Houblon', 'wild-plant':'Plante sauvage', healroot:'Racine médicinale', haygrass:'Herbe à foin', potato:'Plant de pommes de terre',corn:'Plant de maïs', tree: 'Arbre', berries: 'Buisson de baies', rock: 'Pierre au sol', rice: 'Plant de riz', cotton: 'Cotonnier' };
const params = new URLSearchParams(location.search);
const nativeMode=!(import.meta.env.DEV&&params.get('ui')==='legacy');
if(nativeMode)installNativeCardboardCursors(document.documentElement);
let nativeUi:NativeStage|undefined;
let nativeShipTerminal298:ReturnType<typeof createNativeShipTerminal298>|undefined;
let nativeHud:NativeHudCards|undefined;
let nativeCustomPage:NativePage|undefined;
let nativeHudHiddenInspectorKey:string|undefined;
let nativeToolPalette:'orders'|'zones'|undefined;
let nativeDockPreferences:NativeDockPreferences=(()=>{try{return parseNativeDockPreferences(localStorage.getItem(NATIVE_DOCK_PREFERENCE_KEY));}catch{return parseNativeDockPreferences(null);}})();
let nativeUiScale=(()=>{try{return parseNativeUiScale(localStorage.getItem(NATIVE_UI_SCALE_PREFERENCE_KEY));}catch{return parseNativeUiScale(null);}})();
let nativeRightDockOpen=!nativeDockPreferences.notifications;
let nativeCampProgress:CampEntryProgressMessage256|undefined;
let nativeCaravanProgress:CaravanEncounterProgressMessage261|undefined;
let nativeEncounterKey:string|undefined;
let nativeBeforeIncident:NativePage|undefined;
let nativeConstructionMaterial:ConstructionMaterial='wood';
let nativeRoofsVisible=false,nativeZonesVisible=true,nativePerspective=false;
let nativeCreationStorage:StorageControlSettings={priority:2,filters:{wood:true,food:true,unfinished:true,textile:true,apparel:true,weapon:true,medicine:true,neutroamine:true,chemfuel:true,component:true,'advanced-component':true,steel:true,gold:true,uranium:true,plasteel:true,blocks:true,furniture:true,silver:true}};
const diagnosticStart = params.has('scenario');
document.querySelector<HTMLDivElement>('#app')!.innerHTML = gameLayout();
const creationStorageControls=mountStorageControls(document.getElementById('stockpile-items')!,{priority:2,filters:{wood:true,food:true,unfinished:true,textile:true,apparel:true,weapon:true,medicine:true,neutroamine:true,chemfuel:true,component:true,'advanced-component':true,steel:true,gold:true,uranium:true,plasteel:true,blocks:true,furniture:true,silver:true}},()=>{});
let selectedStorageControls:StorageControls|undefined;
let selectedLinkedStorage:ReturnType<typeof createLinkedStorageControls286>|undefined;
let selectedStoragePending=0;
let storageClipboard:StorageControlSettings|undefined;
let zoneEditTarget:number|undefined;
const legacyElements=new Map<string,HTMLElement>();
const el = <T extends HTMLElement = HTMLElement>(id: string) => (document.getElementById(id)??legacyElements.get(id)) as T;
const researchPanelActions:ResearchPanelActions={onOpenWork:()=>openResearchContext('work'),onOpenProduction:()=>openResearchContext('architect')};
function openResearchContext(panel:'work'|'architect'):void {
  void attempt(async()=>{await switchPanel(panel);if(panel==='architect')setCategory('production');});
}
// Only this fixed Worker/client and the fixed MAIN consumers can reach these
// decoders. The command facade exposes no adoption or World callback entry.
let firstGesturesLearning:ReturnType<typeof createFirstGesturesLearning>|undefined;
let drainMainAdmissionsBeforeFrame=()=>{};
let notifyMainAdmissionAvailability=()=>{};
let mainAdmissionCanFrame=()=>false;
const client = (() => {
  // External WeakMap survives virtual createDecoder during super(), without a
  // subclass field initializer overwriting the freshly created lane afterward.
  const lanes=new WeakMap<SimulationClient,NativeCloneResidentLane>();
  const queues=new WeakMap<SimulationClient,MainFrameAdmissionFIFO>();
  class MainSimulationClient extends SimulationClient {
    protected override createDecoder():SnapshotReader {
      queues.get(this)?.close();lanes.get(this)?.close();const lane=createNativeCloneResidentLane();lanes.set(this,lane);
      queues.set(this,new MainFrameAdmissionFIFO(()=>mainAdmissionCanFrame(),()=>this.stop('La file de présentation est saturée. Le résultat des opérations reste inconnu ; rechargez une colonie validée.'),undefined,()=>renderer?.suspendUntilNextFrame()));
      return lane.reader;
    }
    protected override createWorker():Worker {const lane=lanes.get(this);if(!lane)throw Error('Missing native clone lane');return lane.createWorker();}
    protected override readWorkerMessage(value:unknown){return readResidentWorkerMessage(value);}
    protected override withWorkerMessage(source:Worker,event:MessageEvent<unknown>,dispatch:()=>void):void {
      const lane=lanes.get(this);if(lane)lane.withWorkerMessage(source,event,dispatch);else dispatch();
    }
    protected override dispatchWorkerMessage(source:Worker,event:MessageEvent<unknown>,dispatch:(raw:unknown)=>void):void {
      const ticket=lanes.get(this)?.takeDeferredMessage(source,event,dispatch),queue=queues.get(this);
      if(queue){if(ticket)queue.enqueue(ticket.run,ticket);else {const raw=event.data;queue.enqueue(()=>dispatch(raw));}return;}
      super.dispatchWorkerMessage(source,event,dispatch);
    }
    protected override dispatchWorkerFailure(_source:Worker,dispatch:()=>void):void {const queue=queues.get(this);if(queue)queue.enqueue(dispatch);else dispatch();}
    protected override workerStopped(_source:Worker):void {queues.get(this)?.close();lanes.get(this)?.close();}
    admissionFIFODiagnostics475(){return queues.get(this)?.diagnostics();}
    resetAdmissionFIFODiagnostics475():void {queues.get(this)?.resetDiagnostics();}
    protected override deliverCorePhase297(raw:unknown):void {const input=lanes.get(this)?.adoptCorePhase297(raw);if(!input)throw Error('Missing Native physical phase owner');latestCorePhaseInput297=input;renderer?.setCorePhase297(input);const projection=readNativeCorePhaseInput297(input);if(!projection)throw Error('Lost Native phase audio owner');if(projection.audioCues.length)receiveMainAudioCues(projection.audioCues);}
    protected override deliverSnapshot(world: World, cost: number, speed: number, replaced: boolean, motion?: PawnTrack[], coreInput297?:object): void {
      queues.get(this)?.recordApplied(world.tick);receiveMainSnapshot(world, cost, speed, replaced, motion, coreInput297);
    }
    protected override deliverCampaignOnly(summary:CampaignSummary,cost:number,speed:number,replaced:boolean):void {queues.get(this)?.recordApplied(summary.tick);receiveMainCampaignOnly(summary,cost,speed,replaced);}
    protected override deliverAudioCues(cues: readonly AudioCue[]): void { receiveMainAudioCues(cues); }
    protected override deliverUrgentThreats(receipt:UrgentThreatReceipt):void { receiveMainUrgentThreats(receipt); }
  }
  const native = new MainSimulationClient();
  drainMainAdmissionsBeforeFrame=()=>queues.get(native)?.drainFrame();
  notifyMainAdmissionAvailability=()=>queues.get(native)?.notifyAvailability();
  document.addEventListener('visibilitychange',()=>queues.get(native)?.notifyAvailability());
  let onError: SimulationClient['onError'] = () => {};
  let onFault: SimulationClient['onFault'] = () => {};
  let onRequestStatus: SimulationClient['onRequestStatus'] = () => {};
  let onCampProgress:SimulationClient['onCampProgress']=()=>{};
  let onCaravanEncounterProgress:SimulationClient['onCaravanEncounterProgress']=()=>{};
  let onCaravanTradeArrival:SimulationClient['onCaravanTradeArrival']=()=>{};
  let onShipCountdownState298:SimulationClient['onShipCountdownState298']=()=>{};
  // Invoke facade listeners as plain functions so their `this` cannot expose
  // the private client through the base client's method-style notification.
  native.onError = message => onError(message);
  native.onFault = fault => onFault(fault);
  native.onRequestStatus = status => onRequestStatus(status);
  native.onCampProgress=message=>onCampProgress(message);
  native.onCaravanEncounterProgress=message=>onCaravanEncounterProgress(message);
  native.onCaravanTradeArrival=message=>onCaravanTradeArrival(message);
  native.onShipCountdownState298=state=>onShipCountdownState298(state);
  return {
    generateWorldDraft256:(...args:Parameters<SimulationClient['generateWorldDraft256']>)=>native.generateWorldDraft256(...args),
    confirmWorldDraftSite256:(...args:Parameters<SimulationClient['confirmWorldDraftSite256']>)=>native.confirmWorldDraftSite256(...args),
    startWorldDraft256:(...args:Parameters<SimulationClient['startWorldDraft256']>)=>native.startWorldDraft256(...args),
    hasConfirmedWorldDraft256:(...args:Parameters<SimulationClient['hasConfirmedWorldDraft256']>)=>native.hasConfirmedWorldDraft256(...args),
    init: (...args: Parameters<SimulationClient['init']>) => native.init(...args),
    command: async (command:Parameters<SimulationClient['command']>[0]) => {
      const learning=firstGesturesLearning,token=learning?.prepare(command,snapshot);
      const result=await native.command(command);
      if(token)learning?.confirm(token,result);
      return result;
    },
    cancelCampEntry256:(...args:Parameters<SimulationClient['cancelCampEntry256']>)=>native.cancelCampEntry256(...args),
    get hasCampPreparation(){return native.hasCampPreparation;},
    get hasWorldCreationPreparation(){return native.hasWorldCreationPreparation;},
    get shipCountdownActive298(){return native.shipCountdownActive298;},
    launchShip298:(...args:Parameters<SimulationClient['launchShip298']>)=>native.launchShip298(...args),
    continueShipCredits298:(...args:Parameters<SimulationClient['continueShipCredits298']>)=>native.continueShipCredits298(...args),
    feedShipFrame298:(delta:number)=>native.feedShipFrame298(delta),
    cancelShipCountdown298:(reason:'menu'|'front')=>native.cancelShipCountdown298(reason),
    resumeShipFramesAfterPreparation298:()=>native.resumeShipFramesAfterPreparation298(),
    get hasPendingPresentationRequests(){return native.hasPendingPresentationRequests;},
    orderOptions: (...args: Parameters<SimulationClient['orderOptions']>) => native.orderOptions(...args),
    billWorkerOptions: (...args: Parameters<SimulationClient['billWorkerOptions']>) => native.billWorkerOptions(...args),
    setSpeed: (...args: Parameters<SimulationClient['setSpeed']>) => native.setSpeed(...args),
    setThreatPauseMode: (mode:ThreatPauseMode) => native.setThreatPauseMode(mode),
    setMaxSettlements:(value:SettlementLimit)=>native.setMaxSettlements(value),
    getThreatPauseToken: () => native.getThreatPauseToken(),
    save: () => native.save(),
    get hasActiveMap(){return native.hasActiveMap;},
    get campaignSummary(){return native.campaignSummary;},
    load: (...args: Parameters<SimulationClient['load']>) => native.load(...args),
    stop: (...args: Parameters<SimulationClient['stop']>) => native.stop(...args),
    restartForReplacement: () => native.restartForReplacement(),
    dispose: () => native.dispose(),
    get onError() { return onError; },
    set onError(callback: SimulationClient['onError']) { onError = callback; },
    get onFault() { return onFault; },
    set onFault(callback: SimulationClient['onFault']) { onFault = callback; },
    get onRequestStatus() { return onRequestStatus; },
    set onRequestStatus(callback: SimulationClient['onRequestStatus']) { onRequestStatus = callback; },
    get onCaravanTradeArrival(){return onCaravanTradeArrival;},
    set onCaravanTradeArrival(callback:SimulationClient['onCaravanTradeArrival']){onCaravanTradeArrival=callback;},
    get onCaravanEncounterProgress(){return onCaravanEncounterProgress;},
    set onCaravanEncounterProgress(callback:SimulationClient['onCaravanEncounterProgress']){onCaravanEncounterProgress=callback;},
    get onCampProgress(){return onCampProgress;},
    set onCampProgress(callback:SimulationClient['onCampProgress']){onCampProgress=callback;},
    get onShipCountdownState298(){return onShipCountdownState298;},
    set onShipCountdownState298(callback:SimulationClient['onShipCountdownState298']){onShipCountdownState298=callback;},
  };
})();
const audio = new AudioDirector();
const music = new MusicDirector();
let snapshot: World | undefined;
let campaignOnly:CampaignSummary|undefined;
const caravanEncounterDialog261=new CaravanEncounterDialog261(c=>client.command(c));
client.onCaravanEncounterProgress=message=>{if(nativeUi){nativeCaravanProgress=message;refreshNativeUi();}else caravanEncounterDialog261.progress(message);if(message.phase==='complete'||message.phase==='refused')resumeNativeShipPreparation298();};
client.onShipCountdownState298=()=>nativeUi?.notifyCountdownFrameEligibility298();
const campaignState=():CampaignUIState|undefined=>snapshot??campaignOnly;
let latestFoodReadability:FoodReadability|undefined;
function confirmedFoodReadability():FoodReadability|undefined {
  if(!snapshot)return undefined;
  return latestFoodReadability??=captureFoodReadability(snapshot,{pileVisible:p=>knownPile256(snapshot!,p),structureVisible:s=>knownBuilding256(snapshot!,s)});
}
let guideAfterStartingArrival=false;
let selectedPawn: number | undefined;
let colonistInspector: ColonistInspectorState | undefined;
let selectedCell: { x: number; z: number } | undefined;
let selectedObject:MapObjectSelection|undefined;
let selectedObjects:MapObjectSelection[]=[];
const objectGroupReads=new WeakMap<HTMLElement,{world:World;selection:string}>();
let hoveredCell:Cell|null=null;
let hoverReadoutLayout:ReturnType<typeof installHoverReadoutLayout>|undefined;
let lastHoverReadAt=0,lastHoverCopy='';
let altInspectorHeld=false,lastAltReadAt=0,lastAltCopy='',mapPointerX=0,mapPointerY=0;
const mapHoverLight=new MapHoverLightCache();
let lastAudioSourceFocus={x:Infinity,z:Infinity};
let lastAudioSourceHeight=NaN;
let lastAudioCamera:AudioCamera|undefined;
const foliageAmbience = new FoliageAmbience();
function syncAudioSources(world: World,camera=lastAudioCamera): void {
  if (!soundEnabled) { audio.setContinuousSources([]); return; }
  // Rebuild on a snapshot or meaningful listener movement, never per image.
  // A low perspective view can place the ear far from the orbit target.
  const listener=camera?listenerPose(camera):undefined;
  const pose=listener??renderer?.audioFocus??{x:world.width/2,z:world.height/2};
  const focus={x:pose.x,z:pose.z};
  lastAudioSourceFocus=focus;
  lastAudioSourceHeight=listener?.y??NaN;
  const weatherCameraGain=camera?ambientCameraGain(camera):1;
  const nearby=createNearbyFireCollector(focus);
  const machinery=createNearbyMachineCollector(focus);
  for(const fire of world.fires?.items??[])if(fire.attachedPawnId===undefined&&fire.attachedAnimalId===undefined)
    nearby.add(`fire:${fire.id}`,fire.x,fire.z,Math.max(.2,Math.min(1,fire.size)));
  for(const structure of world.structures){
    if(structure.kind==='campfire'&&structure.fuel?.ticks)
      nearby.add(`campfire:${structure.id}`,structure.x,structure.z,.48);
    if(structure.kind==='wood-generator'||structure.kind==='wind-turbine'){
      const machine=runningMachineAudioSource(structure);
      if(machine)machinery.add(machine.id,machine.kind,machine.x,machine.z,machine.gain);
    }
  }
  const sources=[...nearby.sources(),...machinery.sources()];
  const weather=perceivedWeather(world);
  if(weather==='rain'||weather==='rainy-thunderstorm'||weather==='foggy-rain') {
    const gain=Math.min(1,Math.max(0,weatherRainRate(world)));
    if(gain>.05)sources.push({id:'weather:rain',kind:'weather.rain',x:focus.x,z:focus.z,gain:gain*weatherCameraGain});
  }
  // One foliage loop follows wind and nearby canopy, using a snapshot census.
  const wind=Math.max(0,Math.min(1,windIntensity(world)/2));
  const rustle=wind*weatherCameraGain*foliageAmbience.gain(focus.x,focus.z);
  if(rustle>.001)sources.push({id:'weather:wind',kind:'weather.wind',x:focus.x,z:focus.z,gain:rustle});
  audio.setContinuousSources(sources);
}
let lastColonyHistorySignature='';
let installationId:number|undefined;
let replantPileId:number|undefined;
let currentTool: Tool = 'select';
let currentPanel: Panel = null;
const scoutUI=createScoutUI(el('scout-content'),c=>void attempt(()=>client.command(c)));
async function commercialCommand(command:Parameters<typeof client.command>[0]):Promise<unknown>{
  const resumeRevision=deferredResumeGuard.capture();
  const result=await client.command(command);
  if(['commercial-start','commercial-return','commercial-unload'].includes(command.type)&&currentSpeed===0&&deferredResumeGuard.allows(resumeRevision))await client.setSpeed(1);
  return result;
}
const commercialUI=createCommercialUI(el('commercial-content'),commercialCommand);
type WorldTab='maps'|'group'|'individual';
let worldTab:WorldTab='individual';
const groupUI=createGroupPanel(el('group-content'),createGroupAdapters({
  blocked:groupCommandsBlocked,
  send:sendCampaignCommand,
  pauseForReorganization:()=>{const token=client.getThreatPauseToken();return client.setSpeed(0,{explicit:true,token});},
  inspectPresentPawn:id=>{if(snapshot?.pawns.some(p=>p.id===id))selectPawn(id);},
}));
const campPreparationUI256=createCampPreparationView256(el('group-content'),(id,groupId)=>client.cancelCampEntry256(id,groupId));
client.onCampProgress=message=>{if(nativeUi){nativeCampProgress=message;refreshNativeUi();}else campPreparationUI256.update(message);if(!message)resumeNativeShipPreparation298();};
function groupCommandsBlocked():string|undefined {
 if(client.hasCampPreparation)return 'La pr\u00e9paration du camp attend encore sa d\u00e9cision.';
  if(simulationStopped)return 'La simulation est arrêtée. Chargez ou créez une colonie pour reprendre.';
  if(graphicsFault||graphicsRecovering)return 'Recréez l’affichage avant de commander le groupe.';
  if(replacingWorld||session.busy)return 'Une opération de partie est en cours.';
  if(!campaignState()||frontMenu.isOpen())return 'Ouvrez la partie avant de commander le groupe.';
  if(waitingRequests.size)return [...waitingRequests.values()].join(' ');
  return undefined;
}
let overviewTile:number|null=null;
const overviewGlobe=createPlanetView(el('maps-globe'),id=>{overviewTile=id;const state=campaignState();if(state)refreshWorldPanels(state);});overviewGlobe.setVisible(false);
const mapRegistry=createMapRegistryPanel(el('maps-list'),{
 view:async mapId=>{const result=await sendCampaignCommand({type:'map-view',mapId});if(snapshot&&campaignUIFacts(snapshot)?.activeMapId===mapId)setPanel(null);return result;},
 prepare:async mapId=>{await sendCampaignCommand({type:'map-view',mapId});await sendCampaignCommand({type:'group-select',groupId:null});worldTab='group';setPanel('world');},
 settle:mapId=>sendCampaignCommand({type:'map-settle',mapId}),
 abandon:mapId=>sendCampaignCommand({type:'map-abandon',mapId,confirm:true}),
});
const mapJumpTo=createMapJumpTo(el('map-jump-to-host'),jumpToCampaignTarget);
el('show-world-globe').onclick=()=>void attempt(()=>sendCampaignCommand({type:'map-view',mapId:null}));
async function ensureActiveMapView():Promise<void>{
 if(!client.hasActiveMap||!snapshot||renderer)return;
 graphicsRecovering=true;syncStorageButtons();
 try{await prepareWorld();if(client.hasActiveMap&&snapshot&&!renderer)await prepareWorld();}catch(error){notify(error instanceof Error?error.message:String(error),true);}
 finally{graphicsRecovering=false;syncStorageButtons();}
}
async function sendCampaignCommand(command:Parameters<typeof client.command>[0]):Promise<unknown>{
 deferredResumeGuard.cancel();menuResumeSpeed=undefined;
 if(command.type==='group-select'&&command.groupId!==null){
  const state=campaignState(),facts=state?campaignUIFacts(state):undefined,group=facts?.groups.find(group=>group.id===command.groupId);
  if(group?.localMapId!==null&&group?.localMapId!==undefined&&group.localMapId!==facts?.activeMapId)await client.command({type:'map-view',mapId:group.localMapId});
 }
 const result=await client.command(command);await ensureActiveMapView();if(command.type==='group-enter'&&snapshot)setPanel(null);renderState();return result;
}
async function jumpToCampaignTarget(target:JumpToEntry):Promise<void>{
 if(target.kind==='map'){await sendCampaignCommand({type:'map-view',mapId:target.id});if(snapshot&&campaignUIFacts(snapshot)?.activeMapId===target.id)setPanel(null);}
 else if(target.kind==='group'){await sendCampaignCommand({type:'group-select',groupId:target.id});worldTab='group';setPanel('world');}
 else {setPanel('quests');}
}
client.onCaravanTradeArrival=notice=>{const state=campaignState(),view=state&&groupWorld(state,notice.groupId),g=view?.group;if(!view||!g||!('members'in g))return;const target=groupGeographicTradeTarget256(view,g);if(!target||target.settlementId!==notice.settlementId||target.factionId!==notice.factionId||target.postId!==notice.postId)return;
 if(nativeUi){setNativeWorldTab('groups');setPanel('world');focusNativeCaravanTrade(readNativeState(),nativeActions(),notice.groupId);return;}
 worldTab='group';setPanel('world');refreshWorldPanels(state!);groupUI.focusTrade261();};
function refreshWorldPanels(world:CampaignUIState):void {
 const group=worldTab==='group',maps=worldTab==='maps',local='width' in world;
 el('group-content').hidden=!group;el('maps-content').hidden=!maps;el('individual-world-content').hidden=maps||group;
 el('world-panel').classList.toggle('world-group-active',maps||group);
 const groupState=readGroupPanelSnapshot(world);groupUI.setVisible(currentPanel==='world'&&group&&!!groupState);
 if(groupState&&group)groupUI.update(groupState);
 if(!maps&&!group&&local){scoutUI.update(world);commercialUI.update(world);}
 const registry=readMapRegistryState(world);if(registry)mapRegistry.update(registry);
 mapRegistry.setBlocked(groupCommandsBlocked());mapJumpTo.update(readJumpToEntries(world));mapJumpTo.setBlocked(groupCommandsBlocked());
 overviewGlobe.setVisible(currentPanel==='world'&&maps);
 if(currentPanel==='world'&&maps){overviewGlobe.setPlanet(world.planet);const facts=campaignUIFacts(world),selected=facts?.groups.find(group=>group.id===facts.selectedGroupId),state=selected?.state;overviewGlobe.setOverlay({selected:overviewTile,route:state&&'route' in state?state.route:[],...readPlanetObjects(world)});}
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-world-tab]')){const active=button.dataset.worldTab===worldTab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;if(button.dataset.worldTab==='individual')button.disabled=!local;}
}
const worldTabs:WorldTab[]=['maps','group','individual'];
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-world-tab]')){
 button.addEventListener('click',()=>{worldTab=button.dataset.worldTab as WorldTab;const state=campaignState();if(state)refreshWorldPanels(state);});
 button.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const available=worldTabs.filter(tab=>snapshot||tab!=='individual'),index=available.indexOf(worldTab);worldTab=event.key==='Home'?available[0]!:event.key==='End'?available.at(-1)!:available[(Math.max(index,0)+(event.key==='ArrowLeft'?available.length-1:1))%available.length]!;
  const state=campaignState();if(state)refreshWorldPanels(state);el<HTMLButtonElement>(`world-tab-${worldTab}`).focus();
 });
}
let lastCommercialArrivalKey:string|undefined;
let currentCategory: ArchitectCategory = 'structure';
let placementOrientation: Orientation = 0;
let currentSpeed = 1, lastSpeed = 1, stepMs = 0;
const deferredResumeGuard=createDeferredResumeGuard();
let wallCutaway = false, foliageVisible = true, replacingWorld = false;
let simulationStopped = false, graphicsFault = false, graphicsRecovering = false;
let presentationPreparation: Promise<void> | undefined;
function nativeShipPresentationEligible298():boolean {
  return session.hasWorld&&!replacingWorld&&!presentationPreparation&&!simulationStopped&&!graphicsFault&&!graphicsRecovering
    &&!client.hasCampPreparation&&!client.hasWorldCreationPreparation;
}
function nativeShipFrameEligible298():boolean {
  // Preserve the inactive primitive guard. Options and speed0 remain separate.
  return (client.shipCountdownActive298||nativeShipTerminal298?.closing===true&&!frontMenu.isOpen()&&!waitingRequests.size)
    &&!document.hidden&&nativeShipPresentationEligible298();
}
function nativeShipCurtainEligible298():boolean {
  return nativeShipPresentationEligible298()&&!frontMenu.isOpen()&&!waitingRequests.size;
}
function resumeNativeShipPreparation298():void {
  if(client.hasCampPreparation||client.hasWorldCreationPreparation)return;
  client.resumeShipFramesAfterPreparation298();nativeUi?.notifyCountdownFrameEligibility298();
}
let graphicsMessage = '', incidentPanel: HTMLElement | undefined;
const waitingRequests = new Map<number, string>();
// This instance never escapes MAIN. All Worlds come from the private client,
// all UI/audio/render aliases are fixed readers, and DEV exposes a clone.
// This observer lives only in the closed MAIN renderer. Source/public queues
// retain the complete historical projections; a journal alone grants no authority.
class MainPresentationChanges extends PresentationChanges {
  readonly #structures=new ConfirmedStructurePhaseReader();
  protected override readStructures(world:World):unknown { return this.#structures.read(world); }
}
class MainColonyRenderer extends ColonyRenderer {
  protected override cameraOnlyInput():boolean{return nativeUi?.hasOpenGamePage(true)??false;}
  protected override createSelectionRectanglePort(){return nativeUi?(bounds:{left:number;top:number;width:number;height:number}|null)=>nativeUi!.setSelectionRectangle(bounds):undefined;}
  get admissionFrameReady():boolean {return !this.disposed&&!this.preparing&&!this.fatalError&&!this.presentationStopped;}
  protected override frame(now:number):void {this.resumeAfterFrameStarvation();this.beginPresentationFrame297();drainMainAdmissionsBeforeFrame();const frameNow=Math.max(now,this.hostPort.now());let ready=false;try{super.frame(frameNow);ready=this.admissionFrameReady;}finally{try{if(renderer===this)nativeUi?.gameCountdownFrame298(now,ready);}finally{notifyMainAdmissionAvailability();}}}
  protected override createApplicationContext():SceneApplicationContext{return new SceneApplicationContext();}
  protected override createEnvironmentLighting():EnvironmentLighting {const context=this.applicationContext!;return new EnvironmentLighting(new EnvironmentLightField(context.topology,world=>context.read(world)?.lighting));}
  protected override createIntentReader(){return createClosedMainMapIntentReader();}
  protected override createPresentationQueue():PresentationQueue {
    return new PresentationQueue(this.confirmedIntentReader,()=>new MainPresentationChanges());
  }
  protected override createStructurePreparation():SceneStructurePreparation { return this.applicationContext!.structures; }
  protected override renderScene():void {super.renderScene();nativeUi?.renderOverlay(this.renderer);}
}
let renderer: ColonyRenderer | undefined;
const TEXTURE_PREFERENCE_KEY = 'lisiere.presentation.textures.v1';
const GROUND_GRASS_PREFERENCE_KEY = 'lisiere.presentation.ground-grass.v1';
const SOUND_ENABLED_PREFERENCE_KEY = 'lisiere.audio.effects.enabled.v1';
const SOUND_VOLUME_PREFERENCE_KEY = 'lisiere.audio.effects.volume.v1';
const MUSIC_ENABLED_PREFERENCE_KEY = 'lisiere.audio.music.enabled.v1';
const MUSIC_VOLUME_PREFERENCE_KEY = 'lisiere.audio.music.volume.v1';
let texturesEnabled = true;
let designationIconThreshold = 32;
let itemLabelThreshold = 96;
let groundGrassEnabled = true;
let dioramaEnabled = DEFAULT_DIORAMA_ENABLED;
let roomEnabled = DEFAULT_ROOM_ENABLED;
let decorOcclusionPreference = DEFAULT_DECOR_OCCLUSION_ENABLED;
let lightingSettings = { ...DEFAULT_LIGHTING_SETTINGS };
let shadowSettings = { ...DEFAULT_SHADOW_SETTINGS };
let animationSettings = { ...DEFAULT_ANIMATION_SETTINGS };
let uiFont = readUiFont();
applyUiFont(uiFont);
let soundEnabled = true;
let soundVolume = 0.75;
let musicEnabled = true;
let musicVolume = 0.5;
let audioUnlockWarningShown = false;
const autosaveScheduler = new AutosaveScheduler();
let autosaveIntervalMinutes = autosaveMinutes(null);
try {
  autosaveIntervalMinutes = autosaveMinutes(localStorage.getItem(AUTOSAVE_PREFERENCE_KEY));
  designationIconThreshold=designationMinCellPixels(localStorage.getItem(DESIGNATION_VISIBILITY_KEY));
  itemLabelThreshold=itemLabelMinCellPixels(localStorage.getItem(ITEM_LABEL_VISIBILITY_KEY));
  texturesEnabled = localStorage.getItem(TEXTURE_PREFERENCE_KEY) !== 'false';
  groundGrassEnabled = localStorage.getItem(GROUND_GRASS_PREFERENCE_KEY) !== 'false';
  dioramaEnabled = parseDioramaEnabled(localStorage.getItem(DIORAMA_PREFERENCE_KEY));
  roomEnabled = parseRoomEnabled(localStorage.getItem(ROOM_PREFERENCE_KEY));
  decorOcclusionPreference=decorOcclusionEnabled(localStorage.getItem(DECOR_OCCLUSION_KEY),localStorage.getItem(CLOUD_MASK_RADIUS_KEY),localStorage.getItem(ROOM_MASK_RADIUS_KEY));
  lightingSettings = parseLightingSettings(localStorage.getItem(LIGHTING_PREFERENCE_KEY));
  shadowSettings = parseShadowSettings(localStorage.getItem(SHADOW_PREFERENCE_KEY));
  animationSettings = parseAnimationSettings(localStorage.getItem(ANIMATION_PREFERENCE_KEY));
  soundEnabled = localStorage.getItem(SOUND_ENABLED_PREFERENCE_KEY) !== 'false';
  const storedVolume = Number(localStorage.getItem(SOUND_VOLUME_PREFERENCE_KEY));
  if (localStorage.getItem(SOUND_VOLUME_PREFERENCE_KEY) !== null && Number.isFinite(storedVolume)) soundVolume = Math.max(0, Math.min(1, storedVolume));
  musicEnabled = localStorage.getItem(MUSIC_ENABLED_PREFERENCE_KEY) !== 'false';
  const storedMusicVolume = Number(localStorage.getItem(MUSIC_VOLUME_PREFERENCE_KEY));
  if (localStorage.getItem(MUSIC_VOLUME_PREFERENCE_KEY) !== null && Number.isFinite(storedMusicVolume)) musicVolume = Math.max(0, Math.min(1, storedMusicVolume));
} catch { /* The defaults remain active when browser storage is unavailable. */ }
const threatPausePreference=createThreatPausePreference({
 initial:readThreatPausePreference(()=>localStorage.getItem(THREAT_PAUSE_PREFERENCE_KEY)),
 confirm:mode=>client.setThreatPauseMode(mode),
 store:mode=>{try{localStorage.setItem(THREAT_PAUSE_PREFERENCE_KEY,mode);return true;}catch{return false;}},
 changed:()=>syncRuntimeOptionControls(),
});
function syncThreatPauseControls():void {
 const pending=threatPausePreference.pending||settlementPreference.pending;for(const select of document.querySelectorAll<HTMLSelectElement>('[data-threat-pause-mode]')){select.value=threatPausePreference.mode;select.disabled=pending;}
 for(const status of document.querySelectorAll<HTMLElement>('[data-threat-pause-status]'))status.textContent=pending?'Application des options en attente…':'';
}
const settlementPreference=createSettlementLimitPreference({
 initial:readSettlementLimit(()=>localStorage.getItem(SETTLEMENT_LIMIT_PREFERENCE_KEY)),confirm:value=>client.setMaxSettlements(value),
 store:value=>{try{localStorage.setItem(SETTLEMENT_LIMIT_PREFERENCE_KEY,String(value));return true;}catch{return false;}},changed:()=>syncRuntimeOptionControls(),
});
function syncSettlementLimitControls():void {
 const pending=threatPausePreference.pending||settlementPreference.pending;for(const select of document.querySelectorAll<HTMLSelectElement>('[data-max-settlements]')){select.value=String(settlementPreference.value);select.disabled=pending;}
 for(const status of document.querySelectorAll<HTMLElement>('[data-max-settlements-status]'))status.textContent=pending?'Application des options en attente…':'';
}
function syncRuntimeOptionControls():void {syncThreatPauseControls();syncSettlementLimitControls();}
autosaveScheduler.setMinutes(autosaveIntervalMinutes);
function setAutosaveMinutes(minutes:number):boolean {
  autosaveIntervalMinutes=autosaveMinutes(minutes);
  autosaveScheduler.setMinutes(autosaveIntervalMinutes);
  saveManager?.refresh();
  try { localStorage.setItem(AUTOSAVE_PREFERENCE_KEY,String(autosaveIntervalMinutes));return true; }
  catch { return false; }
}
audio.setVolume(soundVolume);
audio.setMuted(!soundEnabled);
music.setVolume(musicVolume);
music.setEnabled(musicEnabled);
music.setHidden(document.hidden);
audio.setHidden(document.hidden);
function unlockAudioFromGesture(): void {
  if (!soundEnabled || !audio.needsUnlock) return;
  void audio.unlock().then(() => { audioUnlockWarningShown = false; }).catch(error => {
    if (audioUnlockWarningShown) return;
    audioUnlockWarningShown = true;
    const assetFailure = error instanceof Error && (error.message.includes('MP3') || error.message.includes('Audio manifest'));
    notify(assetFailure ? 'Le chargement des bruitages a échoué. Ouvrez Options → Son et cliquez sur « Essayer le son » pour réessayer.' : 'Le navigateur a bloqué le son. Cliquez à nouveau dans le jeu ou réactivez les effets sonores.', true);
  });
}
function setSoundEnabled(enabled: boolean): boolean {
  soundEnabled = enabled;
  el<HTMLInputElement>('sound-enabled').checked = enabled;
  audio.setMuted(!enabled);
  if (enabled) {
    if (snapshot) { foliageAmbience.adopt(snapshot,true); syncAudioSources(snapshot); }
    unlockAudioFromGesture();
  }
  else audio.reset();
  try { localStorage.setItem(SOUND_ENABLED_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
function setSoundVolume(volume: number): boolean {
  soundVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.75));
  el<HTMLInputElement>('sound-volume').value = String(Math.round(soundVolume * 100));
  audio.setVolume(soundVolume);
  try { localStorage.setItem(SOUND_VOLUME_PREFERENCE_KEY, String(soundVolume)); return true; }
  catch { return false; }
}
function setMusicEnabled(enabled: boolean): boolean {
  musicEnabled = enabled;
  el<HTMLInputElement>('music-enabled').checked = enabled;
  music.setEnabled(enabled);
  try { localStorage.setItem(MUSIC_ENABLED_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
function setMusicVolume(volume: number): boolean {
  musicVolume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.5));
  el<HTMLInputElement>('music-volume').value = String(Math.round(musicVolume * 100));
  music.setVolume(musicVolume);
  try { localStorage.setItem(MUSIC_VOLUME_PREFERENCE_KEY, String(musicVolume)); return true; }
  catch { return false; }
}
function musicMood(world: World): MusicMood {
  if (world.pawns.some(pawn => (pawn.faction === 'outlaws' && !pawn.prisoner || prisonBreakActive(pawn)) && activeThreat(pawn))
    || world.wildlife?.animals.some(animal=>animal.manhunter&&animal.state!=='dead'&&animal.state!=='downed')) return 'tension';
  const hour = 24 * (calendarTick(world) % TICKS_PER_DAY) / TICKS_PER_DAY;
  return hour >= 6 && hour < 20 ? 'day' : 'night';
}
const textureToggle = el<HTMLInputElement>('textures-enabled');
const fontSelect = el<HTMLSelectElement>('ui-font');
fontSelect.value = uiFont;
function setUiFontPreference(value:UiFontId):void {
  uiFont=value; fontSelect.value=value; applyUiFont(value); saveUiFont(value);
  nativeUi?.setTextFont(UI_FONT_CHOICES.find(choice=>choice.id===value)!.family);
}
const decorOcclusionToggle=el<HTMLInputElement>('decor-occlusion-enabled');
decorOcclusionToggle.checked=decorOcclusionPreference;
function setDecorOcclusionPreference(enabled:boolean):boolean {
  decorOcclusionPreference=enabled;decorOcclusionToggle.checked=enabled;
  renderer?.setDecorOcclusion(enabled);
  try{localStorage.setItem(DECOR_OCCLUSION_KEY,String(enabled));return true;}catch{return false;}
}
const designationSlider=el<HTMLInputElement>('designation-visibility');
const itemLabelSlider=el<HTMLInputElement>('item-label-visibility');
itemLabelSlider.value=String(itemLabelThreshold);
el('item-label-visibility-value').textContent=itemLabelVisibilityLabel(itemLabelThreshold);
function setItemLabelMinCellPixels(value:number):boolean {
  itemLabelThreshold=itemLabelMinCellPixels(value);
  itemLabelSlider.value=String(itemLabelThreshold);
  el('item-label-visibility-value').textContent=itemLabelVisibilityLabel(itemLabelThreshold);
  renderer?.setItemLabelMinCellPixels(itemLabelThreshold);
  try {localStorage.setItem(ITEM_LABEL_VISIBILITY_KEY,String(itemLabelThreshold));return true;}catch{return false;}
}
designationSlider.value=String(designationIconThreshold);
el('designation-visibility-value').textContent=designationVisibilityLabel(designationIconThreshold);
function setDesignationMinCellPixels(value:number):boolean {
  designationIconThreshold=designationMinCellPixels(value);
  designationSlider.value=String(designationIconThreshold);
  el('designation-visibility-value').textContent=designationVisibilityLabel(designationIconThreshold);
  renderer?.setDesignationMinCellPixels(designationIconThreshold);
  try {localStorage.setItem(DESIGNATION_VISIBILITY_KEY,String(designationIconThreshold));return true;}catch{return false;}
}
textureToggle.checked = texturesEnabled;
function setTexturesEnabled(enabled: boolean): boolean {
  texturesEnabled = enabled;
  textureToggle.checked = enabled;
  renderer?.setTexturesEnabled(enabled);
  try { localStorage.setItem(TEXTURE_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
const groundGrassToggle = el<HTMLInputElement>('ground-grass-enabled');
groundGrassToggle.checked = groundGrassEnabled;
function setGroundGrassEnabled(enabled: boolean): boolean {
  groundGrassEnabled = enabled;
  groundGrassToggle.checked = enabled;
  renderer?.setGroundGrassEnabled(enabled);
  try { localStorage.setItem(GROUND_GRASS_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
const dioramaToggle = el<HTMLInputElement>('diorama-enabled');
dioramaToggle.checked = dioramaEnabled;
function setDioramaEnabled(enabled: boolean): boolean {
  dioramaEnabled = enabled;
  dioramaToggle.checked = enabled;
  renderer?.setDioramaEnabled(enabled);
  try { localStorage.setItem(DIORAMA_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
const roomToggle = el<HTMLInputElement>('room-enabled');
roomToggle.checked = roomEnabled;
function setRoomEnabled(enabled: boolean): boolean {
  roomEnabled = enabled;
  roomToggle.checked = enabled;
  renderer?.setRoomEnabled(enabled);
  try { localStorage.setItem(ROOM_PREFERENCE_KEY, String(enabled)); return true; }
  catch { return false; }
}
const lightingSliders = LIGHTING_CONTROLS.map(control => ({
  key: control.key, slider: el<HTMLInputElement>(`lighting-${control.key}`), output: el(`lighting-${control.key}-value`),
}));
function refreshLightingControls(): void {
  for (const { key, slider, output } of lightingSliders) {
    slider.value = String(Math.round(lightingSettings[key] * 100));
    output.textContent = lightingPercentLabel(lightingSettings[key]);
  }
}
refreshLightingControls();
function setLightingSettings(settings: LightingSettings): boolean {
  lightingSettings = parseLightingSettings(settings);
  refreshLightingControls(); renderer?.setLightingSettings(lightingSettings);
  try { localStorage.setItem(LIGHTING_PREFERENCE_KEY, JSON.stringify(lightingSettings)); return true; }
  catch { return false; }
}
function setShadowSettings(settings: ShadowSettings): boolean {
  shadowSettings=parseShadowSettings(settings);renderer?.setShadowSettings(shadowSettings);refreshPerformanceControls();
  try { localStorage.setItem(SHADOW_PREFERENCE_KEY,JSON.stringify(shadowSettings));return true; } catch { return false; }
}
function setAnimationSettings(settings: AnimationSettings): boolean {
  animationSettings=parseAnimationSettings(settings);renderer?.setAnimationSettings(animationSettings);refreshPerformanceControls();
  try { localStorage.setItem(ANIMATION_PREFERENCE_KEY,JSON.stringify(animationSettings));return true; } catch { return false; }
}
const refreshPerformanceControls=bindRenderPerformanceControls(document.querySelector('#menu-panel')!,'game-',{
  getShadows:()=>shadowSettings,setShadows:setShadowSettings,
  getAnimations:()=>animationSettings,setAnimations:setAnimationSettings,
  onStorageFailure:()=>notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true),
});
let noticeTimer: ReturnType<typeof setTimeout> | undefined;
let pawnSignature = '';
const colonistButtons = new Map<number, HTMLButtonElement>();
const selection=new PawnSelection();
const roomInspection = new RoomInspection();
const orderMenu=new OrderMenu(client,notify);
const snapshotHud=new SnapshotHud(()=>renderState());
let latestMotion: PawnTrack[] | undefined;
let latestCoreFullInput297:object|undefined,latestCorePhaseInput297:object|undefined;
let menuResumeSpeed: number | undefined;
let menuTransition: Promise<unknown> = Promise.resolve();
const shell = document.querySelector<HTMLElement>('.game-shell')!;
if(!nativeMode){
  installVisualIdentity(document.querySelector<HTMLElement>('#app')!);
  installTooltips(document.body);installTextSelectionGuard(document.body);
  installArchitectIcons(document.querySelector<HTMLElement>('#app')!);
}
const siteHud = createSiteHud(document.querySelector<HTMLElement>('#app')!);
const resourceLedger = createResourceLedger(document.querySelector<HTMLElement>('#app')!);
const architectWorkbench = nativeMode?{close:()=>{}}:installArchitectWorkbench(document.querySelector<HTMLElement>('#app')!, () => {
  setPanel(null); clearSelection(); applyTool('select');
});
if(!nativeMode)hoverReadoutLayout=installHoverReadoutLayout(shell,{cell:()=>hoveredCell,refresh:()=>updateMapHover(true)});
// Workbench has already moved Orders/Zones out of Architect. Keep the
// resident catalogue and its icon/handler nodes; only visibility changes.
const architectToolButtons=[...el('architect-panel').querySelectorAll<HTMLButtonElement>('[data-tool-category]')]
  .map(button=>({button,tool:button.dataset.tool as Tool,category:button.dataset.toolCategory as ArchitectCategory}));
let lastArchitectAvailabilityKey='';
installTimeControls(document.querySelector<HTMLElement>('#app')!);
// Suppress browser chrome without cancelling the game's own order-menu handler.
document.querySelector('#app')!.addEventListener('contextmenu', event => {
  event.preventDefault();
  if(currentPanel==='architect'&&(event.target as Element).closest('.management-panel'))setPanel(null,true);
  if((event.target as Element).closest('.map-tools-dock'))architectWorkbench.close();
});
const saveRepository = new BrowserSaveRepository(() => localStorage, () => globalThis.indexedDB,
  status => { if (status.message) notify(status.message, true); });
let saveManager:ReturnType<typeof createSaveManager>|undefined;
let saveStorageReady=false;
const session = new GameSession(client, saveRepository, prepareWorld, () => {
  simulationStopped = false; menuResumeSpeed = undefined; frontMenu.setHasGame(true);
  groupUI.resetForReplacement();mapRegistry.resetForReplacement();mapJumpTo.resetForReplacement();
  if(campaignOnly){worldTab='maps';refreshWorldPanels(campaignOnly);}
  if(snapshot){worldTab=snapshot.scout||snapshot.commercialTrip?'individual':snapshot.planet||snapshot.group?'group':'individual';refreshWorldPanels(snapshot);}
  updateIncident(); syncStorageButtons();
},()=>{queueMicrotask(()=>snapshotHud.request(true));});
const frontHost = document.createElement('div'); document.querySelector('#app')!.append(frontHost);
if(nativeMode){
  nativeUi=new NativeStage({onTools:showNativeToolPalette,onViewport:(w,h,k,bottom,left)=>nativeHud?.setViewport(w,h,k,bottom??96,left),onWindowLayout:bounds=>nativeHud?.setWindowBounds(bounds)??false,onPointer:updateNativeDockPointer,onAnimate:dt=>nativeHud?.animate(dt)??false,countdownFrame298:{canFeed:nativeShipFrameEligible298,canPresent:nativeShipCurtainEligible298,feed:delta=>{client.feedShipFrame298(delta);nativeShipTerminal298?.frame(delta);}},onPanel:id=>{
    nativeCustomPage=undefined;nativeToolPalette=undefined;
    if(id==='factions'){nativeCustomPage=buildNativeFactions(readNativeState(),nativeActions());nativeUi!.showPage(nativeCustomPage);return;}
    void attempt(()=>switchPanel(currentPanel===id?null:id));
  },onEscape:()=>{cancelNativeOrderPage();nativeCustomPage=undefined;renderer?.cancelSelection();renderer?.cancelDesignation();if(frontMenu.isOpen())return;setPanel(null);clearSelection();},
    onHudInspectorDismiss:()=>{nativeHudHiddenInspectorKey=nativePawnInspectorKey();nativeCustomPage=undefined;nativeUi!.showPage(null);},onError:message=>notify(message,true),
    onGesture:()=>{unlockAudioFromGesture();music.unlock();},
    onActivate:id=>audio.playInterface(id.startsWith('tab:')||id.includes('back')?'ui.panel':'ui.click'),
    onCancelWorldInteraction:()=>{renderer?.cancelSelection();renderer?.cancelDesignation();},
  });
  nativeShipTerminal298=createNativeShipTerminal298({readState:readNativeState,
    readEpoch:()=>session.generation,readCredits:()=>readAdoptedShipCredits298(snapshot,campaignOnly,session.hasWorld),
    canPresent:nativeShipCurtainEligible298,
    isPageCurrent:id=>nativeCustomPage?.id===id,show:page=>{nativeCustomPage=page;nativeUi!.showPage(page);},
    close:id=>{if(nativeCustomPage?.id!==id)return;nativeCustomPage=undefined;renderState();},
    launch:id=>client.launchShip298(id),continueCredits:id=>client.continueShipCredits298(id),
    onFrameDemandChanged:()=>nativeUi?.notifyCountdownFrameEligibility298(),
    onPresentation:(ownerId,phase,fraction)=>nativeUi?.presentShipCurtain298(ownerId,phase,fraction),
  });
  nativeUi.setTextFont(UI_FONT_CHOICES.find(choice=>choice.id===uiFont)!.family);
  nativeHud=new NativeHudCards(nativeUi.art,nativeUi.anchors,{selectPawn,focus:(target,tab)=>{nativeCustomPage=undefined;focusNotification(target);if(tab)setNativeInspectorTab(tab);refreshNativeUi();},
    domain:openNativeDomainAlert,campaign:target=>{nativeCustomPage=undefined;void attempt(async()=>{const reason=await viewUrgentThreat(target);if(reason)throw Error(reason);});},
    context:context=>{nativeCustomPage=undefined;if(context.tool){setTool(context.tool);return;}if(context.worldTab)setNativeWorldTab(context.worldTab==='group'?'groups':'individual');void attempt(async()=>{await switchPanel(context.panel);if(context.category)setCategory(context.category);});},
    speed:value=>{const token=client.getThreatPauseToken();void attempt(()=>changeSpeed(value,token));},view:applyNativeViewControl,
    showPage:page=>{nativeCustomPage=page;nativeUi!.showPage(page);}});
  nativeUi.setUiScale(nativeUiScale);
  const viewport=nativeUi.getViewportMetrics();nativeHud.setViewport(viewport.width,viewport.height,viewport.unitsPerPixel,viewport.bottomDockHeight??96,viewport.leftHudBottom);nativeHud.setNotificationsAutoHide(nativeDockPreferences.notifications);nativeHud.setRightDockOpen(nativeRightDockOpen);nativeUi.setAutoHideBottom(nativeDockPreferences.bottom);
  // Old controls are a disabled development witness only. Native scene layout
  // and input never read their measurements, values, handlers or visibility.
  for(const child of shell.children)if(child.id!=='viewport'){
    (child as HTMLElement).style.display='none';(child as HTMLElement).inert=true;
  }
}
// Help is shared by both entry points, outside the hidden/inert colony shell.
const helpDialog=el<HTMLDialogElement>('help');document.querySelector('#app')!.append(helpDialog);
let helpOpener:HTMLElement|null=null;
function openHelp():void {
  if(nativeUi){
    renderer?.cancelDesignation();altInspectorHeld=false;nativeUi.setWorldReadout(null);
    const close=()=>{nativeCustomPage=undefined;if(frontMenu.isOpen())frontMenu.showHome(session.hasWorld);else refreshNativeUi();};
    nativeCustomPage=nativeHelpPage({...nativeActions(),currentWorld:()=>snapshot,learning:firstGesturesLearning,close,
      onGuideAction:async action=>{
        nativeCustomPage=undefined;if(frontMenu.isOpen())frontMenu.hide();
        if(action.target){focusNotification(action.target);if(action.tab)setNativeInspectorTab(action.tab);refreshNativeUi();return;}
        if(action.worldTab)setNativeWorldTab(action.worldTab==='group'?'groups':'individual');
        if(action.tool){setTool(action.tool);return;}
        if(action.mapTools){await switchPanel('architect');setCategory(action.mapTools);return;}
        if(action.panel)await switchPanel(action.panel);if(action.category)setCategory(action.category);
      }});nativeUi.showPage(nativeCustomPage);return;
  }
  if(helpDialog.open)return;
  helpOpener=document.activeElement instanceof HTMLElement?document.activeElement:null;
  renderer?.cancelDesignation();altInspectorHeld=false;updateMapCellDetails(true);
  helpDialog.showModal();
}
// Keep keyboard navigation in the help, including its single-button form.
helpDialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab'||!helpDialog.open)return;
  const controls=[...helpDialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')]
    .filter(node=>node.tabIndex>=0&&!node.matches(':disabled')&&node.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(!first||!last){event.preventDefault();helpDialog.focus();return;}
  const active=document.activeElement;
  if(!helpDialog.contains(active)||(event.shiftKey?active===first:active===last)){
    event.preventDefault();(event.shiftKey?last:first).focus({preventScroll:true});
  }
});
helpDialog.addEventListener('close',()=>{
  const opener=helpOpener;helpOpener=null;
  if(opener?.isConnected&&!opener.closest('[hidden],[inert]')&&opener.getClientRects().length)opener.focus({preventScroll:true});
});
// The measured counter remains visible over both the colony and the menu.
document.querySelector('#app')!.append(el('fps-counter'));
const worldCreationPlayer256=Object.freeze({scenario:'crashlanded',playerDef:'PlayerColony' as const,playerName:'Nouvelle colonie'});
const worldCreationBackend256:WorldCreationCallbacks256={
 generate:async(request,context)=>{await initialRuntimeOptions;await Promise.all([threatPausePreference.whenSettled(),settlementPreference.whenSettled()]);return client.generateWorldDraft256(request,context);},
 confirmSite:request=>client.confirmWorldDraftSite256(request),
 start:(ticket,party,context)=>session.createConfirmedDraft(()=>client.startWorldDraft256(ticket,party,context)),
};
const frontOptions:FrontMenuOptions = {
  getUiAutoHide:()=>({...nativeDockPreferences}),onUiAutoHideChange:setNativeDockPreferences,
  getUiScale:()=>nativeUiScale,onUiScaleChange:setNativeUiScale,
  getWorldCreationPlayer:()=>({...worldCreationPlayer256}),
  worldCreation:createMainWorldCreationCallbacks256(worldCreationBackend256,{
    replaceConfirmedDraft:(ticket,operation)=>replaceColony(operation,ticket),
    afterCreated:()=>{guideAfterStartingArrival=!!snapshot?.startingArrival&&snapshot.startingArrival.phase!=='opened';learningReadout.open=!guideAfterStartingArrival;syncFirstDayGuide();},
  }),
  onHelp:openHelp,
  getMaxSettlements:()=>settlementPreference.value,getMaxSettlementsPending:()=>settlementPreference.pending||threatPausePreference.pending,onMaxSettlementsChange:value=>settlementPreference.set(value),
  getThreatPauseMode:()=>threatPausePreference.mode,getThreatPausePending:()=>threatPausePreference.pending||settlementPreference.pending,onThreatPauseModeChange:mode=>threatPausePreference.set(mode),
  getAutosaveMinutes:()=>autosaveIntervalMinutes,onAutosaveMinutesChange:setAutosaveMinutes,
  onExport:exportCurrentColony,
  getShadowSettings:()=>({...shadowSettings}),onShadowSettingsChange:setShadowSettings,
  getAnimationSettings:()=>({...animationSettings}),onAnimationSettingsChange:setAnimationSettings,
  getSaves: () => session.saves(),
  getTexturesEnabled: () => texturesEnabled,
  getUiFont:()=>uiFont,
  onUiFontChange:setUiFontPreference,
  getDecorOcclusion:()=>decorOcclusionPreference,
  onDecorOcclusionChange:setDecorOcclusionPreference,
  getDesignationMinCellPixels:()=>designationIconThreshold,
  getItemLabelMinCellPixels:()=>itemLabelThreshold,
  onItemLabelMinCellPixelsChange:setItemLabelMinCellPixels,
  onDesignationMinCellPixelsChange:setDesignationMinCellPixels,
  onTexturesEnabledChange: setTexturesEnabled,
  getGroundGrassEnabled: () => groundGrassEnabled,
  onGroundGrassEnabledChange: setGroundGrassEnabled,
  getDioramaEnabled: () => dioramaEnabled,
  onDioramaEnabledChange: setDioramaEnabled,
  getRoomEnabled: () => roomEnabled,
  onRoomEnabledChange: setRoomEnabled,
  getLightingSettings: () => ({ ...lightingSettings }),
  onLightingSettingsChange: setLightingSettings,
  getSoundEnabled: () => soundEnabled,
  onSoundEnabledChange: setSoundEnabled,
  getSoundVolume: () => soundVolume,
  onSoundVolumeChange: setSoundVolume,
  onTestSound: () => audio.playPreview(),
  getMusicEnabled: () => musicEnabled,
  onMusicEnabledChange: setMusicEnabled,
  getMusicVolume: () => musicVolume,
  onMusicVolumeChange: setMusicVolume,
  onStart: async draft => {
    await replaceColony(() => session.create(draft.seed, draft.size, 'crashlanded',draft.site,draft.startingParty,draft.startingWorld));
    guideAfterStartingArrival=!!snapshot?.startingArrival&&snapshot.startingArrival.phase!=='opened';
    learningReadout.open=!guideAfterStartingArrival;syncFirstDayGuide();
  },
  onLoad: async key => replaceColony(() => session.load(key)),
  getTestColonies: fetchTestColonies,
  onLoadTest: async save => replaceColony(() => session.loadExternal(() => readTestColony(save))),
  onImport: async file => replaceColony(() => session.loadExternal(() => readSaveFile(file))),
  onResume: async () => {
    if (simulationStopped || waitingRequests.size > 0) throw new Error('Chargez une colonie validée pour reprendre.');
    await prepareWorld();
    if (simulationStopped || waitingRequests.size > 0) throw new Error('Chargez une colonie validée pour reprendre.');
    const speed = menuResumeSpeed ?? 0; menuResumeSpeed = undefined;
    frontMenu.hide(); setPanel(null); syncStorageButtons();
    await changeSpeed(deferredResumeGuard.held?0:speed);
  },
};
const frontMenu=nativeUi?createNativeFrontMenu(frontOptions,page=>{
  nativeUi!.setFrontVisible(page!==null);nativeHud?.setVisible(page===null&&!!snapshot);nativeUi!.showPage(page);
}):createFrontMenu(frontHost,frontOptions);
const nativeSaveManager=nativeUi?createNativeSaveManager({
  readSaves:()=>session.saves(),refresh:()=>session.refreshSaves(),save,saveNamed:(label,key,revision)=>session.saveNamed(label,key,revision),
  deleteSave:(key,revision)=>session.deleteSave(key,revision),load:key=>replaceColony(()=>session.load(key)),exportSave:exportCurrentColony,
  show:page=>{nativeCustomPage=page;nativeUi!.showPage(page);},close:()=>{nativeCustomPage=undefined;setPanel('menu');},
  blocked:()=>!saveStorageReady||replacingWorld||session.busy||simulationStopped||waitingRequests.size>0,
}):undefined;
async function openNativeSaveManager():Promise<void>{await pauseForMenu();await nativeSaveManager?.open();}
async function openNativeOptions():Promise<void>{await pauseForMenu();frontMenu.setHasGame(session.hasWorld);frontMenu.showOptions?.();syncStorageButtons();}
function openNativeDomainAlert(alert:NativeDomainAlert):void {
  if(!nativeUi)return;
  if(alert.action.kind==='arrivals'){nativeCustomPage=buildNativeArrivals(readNativeState(),nativeActions());nativeUi.showPage(nativeCustomPage);}
  else if(alert.action.kind==='quests'){nativeCustomPage=undefined;void attempt(()=>switchPanel('quests'));}
  else if(alert.action.kind==='trade')nativeLocalTrade?.openVisitors();
  else if(alert.action.kind==='orbital')nativeLocalTrade?.openOrbital();
}
function setNativeUiScale(value:number):boolean {
  nativeUiScale=normalizeNativeUiScale(value);nativeUi?.setUiScale(nativeUiScale);
  try{localStorage.setItem(NATIVE_UI_SCALE_PREFERENCE_KEY,JSON.stringify(nativeUiScale));return true;}catch{return false;}
}
function setNativeDockPreferences(value:NativeDockPreferences):boolean {
  nativeDockPreferences={bottom:value.bottom===true,notifications:value.notifications===true};
  nativeUi?.setAutoHideBottom(nativeDockPreferences.bottom);nativeHud?.setNotificationsAutoHide(nativeDockPreferences.notifications);
  nativeRightDockOpen=!nativeDockPreferences.notifications;nativeHud?.setRightDockOpen(nativeRightDockOpen);nativeUi?.invalidate();
  try{localStorage.setItem(NATIVE_DOCK_PREFERENCE_KEY,JSON.stringify(nativeDockPreferences));return true;}catch{return false;}
}
function updateNativeDockPointer(x:number,y:number):void {
  if(!nativeHud)return;const bounds=nativeHud.getRightDockBounds();
  const width=nativeUi?.getViewportMetrics().width??innerWidth;
  const open=!nativeDockPreferences.notifications||x>=Math.min(width-12,bounds.left)&&y>=bounds.top-15&&y<=bounds.bottom+20;
  if(open!==nativeHud.getRightDockOpen()){nativeRightDockOpen=open;nativeHud.setRightDockOpen(open);nativeUi?.invalidate();}
}
function showNativeToolPalette(kind:'orders'|'zones',toggle=true):void {
  if(!nativeUi||!snapshot||replacingWorld)return;
  if(toggle&&nativeToolPalette===kind){nativeToolPalette=undefined;nativeCustomPage=undefined;refreshNativeUi();return;}
  setPanel(null,true);nativeToolPalette=kind;nativeCustomPage=buildNativeToolPalette(readNativeState(),nativeActions(),kind);nativeUi.showPage(nativeCustomPage);
}
function applyNativeViewControl(action:NativeHudViewAction):void {
  if(action==='walls'){wallCutaway=!wallCutaway;renderer?.setWallCutaway(wallCutaway);}
  else if(action==='roofs'){nativeRoofsVisible=!nativeRoofsVisible;renderer?.setRoofsVisible(nativeRoofsVisible);}
  else if(action==='foliage'){foliageVisible=!foliageVisible;renderer?.setFoliageVisible(foliageVisible);}
  else if(action==='zones'){nativeZonesVisible=!nativeZonesVisible;renderer?.setZonesVisible(nativeZonesVisible);}
  else if(action==='camera'){nativePerspective=renderer?.toggleCameraMode()==='perspective';}
  else if(action==='home'){const pawn=snapshot?.pawns[0];if(pawn)renderer?.focusPawn(pawn.id);}
  refreshNativeUi();
}
function readNativeState():NativeUiState {
  return {world:snapshot,epoch:session.generation,campaign:campaignOnly,panel:currentPanel,category:currentCategory,tool:currentTool,
    orientation:placementOrientation,constructionMaterial:nativeConstructionMaterial,creationStorage:nativeCreationStorage,selectedPawnIds:[...selection.ids],selectedCell,
    selectedObjects,campProgress:nativeCampProgress,caravanProgress:nativeCaravanProgress,
    selectedAnimalId:selectedPawn!==undefined&&snapshot?.wildlife?.animals.some(animal=>animal.id===selectedPawn)?selectedPawn:undefined,
    selectedMechanoidId:selectedPawn!==undefined&&snapshot?.mechanoids?.some(actor=>actor.id===selectedPawn)?selectedPawn:undefined,
    speed:currentSpeed,hasGame:session.hasWorld,busy:session.busy||replacingWorld||waitingRequests.size>0,
    fault:simulationStopped?'La simulation s’est arrêtée. Rechargez une colonie validée.':graphicsFault?'Le rendu doit être rétabli.':undefined,
    saves:saveStorageReady?session.saves():[]};
}
function nativeActions():NativeUiActions {
  return {
    command:async command=>{
      if(replacingWorld||simulationStopped||graphicsFault||waitingRequests.size)throw Error('L’état courant ne permet pas encore cette commande.');
      const campaign=/^(group-|map-|caravan-)/.test(command.type);
      const result=campaign?await sendCampaignCommand(command):['commercial-start','commercial-return','commercial-unload'].includes(command.type)?await commercialCommand(command):await client.command(command);
      renderState();return result;
    },
    panel:panel=>switchPanel(panel),category:setCategory,tool:setTool,selectPawn,
    speed:value=>{const token=client.getThreatPauseToken();return changeSpeed(value,token);},rotate:direction=>{if(isShipComputerSensorsKind298(currentTool))return;placementOrientation=((placementOrientation+direction+4)%4) as Orientation;renderer?.setPlacementRotation(placementOrientation);refreshNativeUi();},
    material:material=>{if(isShipComputerSensorsKind298(currentTool))return;nativeConstructionMaterial=material;renderer?.setConstructionMaterial(material);refreshNativeUi();},
    creationStorage:settings=>{nativeCreationStorage=structuredClone(settings);refreshNativeUi();},
    front:openFront,save,exportSave:exportCurrentColony,
    showPage:page=>{nativeCustomPage=page;nativeUi?.showPage(page);},refresh:()=>renderState(),clearSelection,
    readState:readNativeState,closePage:()=>{nativeToolPalette=undefined;nativeCustomPage=undefined;renderState();},
    pawnActivity:id=>{const pawn=snapshot?.pawns.find(p=>p.id===id);return pawn&&snapshot?actionLabel(pawn,carriedPatientsOf(snapshot)):'';},
    openVisitorTrade:()=>nativeLocalTrade?.openVisitors(),openOrbitalTrade:id=>nativeLocalTrade?.openOrbital(id),openFactionComms298:id=>{void attempt(async()=>nativeFactionComms298?.open(id));},
    launchShip298:id=>nativeShipTerminal298?.openLaunch(id),
    resizeZone:(kind,id,shrink)=>{nativeCustomPage=undefined;editZone(kind,id,shrink);},
    paintAllowedArea:(id,enabled)=>{if(!snapshot?.allowedAreas?.some(area=>area.id===id))return;nativeCustomPage=undefined;setPanel(null);applyTool(enabled?'allowed-expand':'allowed-shrink');allowedAreaEditId=id;renderer?.setAllowedAreaTarget(id);},
    selectObject:object=>selectObjects([object]),
    readBillWorkers:(structureId,billId)=>client.billWorkerOptions(structureId,billId),
    cancelCampEntry:(id,groupId)=>client.cancelCampEntry256(id,groupId),
    placeFurniture:structureId=>{const object=snapshot&&furnitureObject(snapshot,structureId);if(!object)return;
      installationId=structureId;placementOrientation=object.orientation;applyTool('install');renderer?.setFurniturePlacement(object);setPanel(null,true);},
    replant:pileId=>{replantPileId=pileId;applyTool('replant-tree');renderer?.setTreePlacement(pileId);setPanel(null,true);},
  };
}
function nativePawnInspectorKey():string{return `${session.generation}:${campaignPresentationEpoch}:${[...selection.ids].join(',')}`;}
function refreshNativeUi():void {
  if(!nativeUi)return;
  nativeUi.setTextEntities(nativeTextEntitiesFor(snapshot,campaignOnly));
  nativeUi.setWorldVisible(!!snapshot&&!!renderer);nativeHud?.setVisible(!!snapshot&&!frontMenu.isOpen());
  if(snapshot){nativeHud?.setSelection([...selection.ids]);nativeHud?.update(snapshot,currentSpeed,renderer?.stats.fps??0);}
  nativeHud?.setViewState({walls:wallCutaway?'coupés':'hauts',roofs:nativeRoofsVisible,foliage:foliageVisible,zones:nativeZonesVisible,camera:nativePerspective?'perspective':'iso'});
  const state=readNativeState(),actions=nativeActions(),terminalPage=nativeShipTerminal298?.update(state);
  if(frontMenu.isOpen())return;
  if(state.fault||waitingRequests.size){updateIncident();return;}
  if(terminalPage){nativeCustomPage=terminalPage;nativeUi.showPage(terminalPage);return;}
  if(nativeShipTerminal298?.ownsPage(nativeCustomPage?.id))nativeCustomPage=undefined;
  syncNativePanelState(state,actions);
  if(nativeToolPalette&&nativeCustomPage?.id==='map-tools-'+nativeToolPalette)nativeCustomPage=buildNativeToolPalette(state,actions,nativeToolPalette);
  nativeLocalTrade?.update();nativeFactionComms298?.update();
  const encounter=buildNativeEncounter(state,actions);
  if(encounter){
    if(nativeEncounterKey!==encounter.id){nativeEncounterKey=encounter.id;nativeCustomPage=undefined;}
    if(!nativeCustomPage){encounter.closable=false;nativeUi.showPage(encounter);return;}
  }else if(nativeEncounterKey){nativeEncounterKey=undefined;nativeCustomPage=undefined;}
  if(nativeCustomPage){nativeUi.showPage(nativeCustomPage);return;}
  const page=currentPanel?buildNativePanel(state,actions):nativeHudHiddenInspectorKey!==undefined&&nativeHudHiddenInspectorKey===nativePawnInspectorKey()?null:buildNativeInspector(state,actions);
  if(page?.id==='menu')page.rows.push({id:'native-menu-details',label:'Sauvegardes, options et carnet',controls:[
    {id:'native-manage-saves',label:'Gérer les sauvegardes',onActivate:openNativeSaveManager},
    {id:'native-options',label:'Options',onActivate:openNativeOptions},{id:'native-help',label:'Aide',onActivate:openHelp},
  ]});
  if(page?.id==='menu')page.rows.push({id:'native-menu-trade',label:'Échanges',controls:[
    {id:'native-visitor-trade',label:'Visiteurs et commerce',onActivate:()=>nativeLocalTrade?.openVisitors()},
    {id:'native-orbital-trade',label:'Commerce orbital',onActivate:()=>nativeLocalTrade?.openOrbital()},
    ...(Number(state.world?.schemaVersion)===298?[{id:'native-faction-comms298',label:'Communications de faction',onActivate:()=>{void attempt(async()=>nativeFactionComms298?.open());}}]:[]),
  ]});
  if(page&&!page.onClose)page.onClose=()=>setPanel(null);
  nativeUi.showPage(page);
}
const initialRuntimeOptions=(async()=>{await attempt(()=>threatPausePreference.initialize());await attempt(()=>settlementPreference.initialize());})();
async function pauseForMenu(): Promise<void> {
  renderer?.cancelDesignation(); orderMenu.close();
  if(simulationStopped){menuResumeSpeed=0;return;}
  await menuTransition;
  if(simulationStopped){menuResumeSpeed=0;return;}
  if (campaignState() && menuResumeSpeed === undefined) {
    const speed = currentSpeed,resumeRevision=deferredResumeGuard.capture();
    await client.setSpeed(0); menuResumeSpeed = deferredResumeGuard.allows(resumeRevision)?speed:0;
  }
}
async function openFront(page: 'home' | 'create' | 'load'): Promise<void> {
  if (session.busy || replacingWorld) return;
  client.cancelShipCountdown298('front');
  await pauseForMenu();
  if(page==='load')await session.refreshSaves();
  frontMenu.setHasGame(session.hasWorld);
  if (page === 'create') frontMenu.showCreation();
  else if (page === 'load') frontMenu.showLoad();
  else frontMenu.showHome(session.hasWorld);
  setPanel(null); syncStorageButtons();
}
async function switchPanel(panel: Panel, preserveTool = false): Promise<void> {
  if (panel === 'menu') { client.cancelShipCountdown298('menu');await pauseForMenu();await session.refreshSaves();saveManager?.refresh(); }
  setPanel(panel, preserveTool);
}
async function replaceColony(action: () => Promise<void>,confirmedDraft?:WorldCreationTicket256): Promise<void> {
  cancelNativeOrderPage();nativeCustomPage=undefined;
  firstGesturesLearning?.cancelPending();
  await initialRuntimeOptions;
  await Promise.all([threatPausePreference.whenSettled(),settlementPreference.whenSettled()]);
  if(confirmedDraft){if(!client.hasConfirmedWorldDraft256(confirmedDraft))throw Error('La préparation est perdue. Générez le monde à nouveau.');}
  else client.restartForReplacement();
  latestFoodReadability=undefined;
  lastCommercialArrivalKey=undefined;
  replacingWorld = true; syncStorageButtons();
  try {
    await action(); menuResumeSpeed = undefined;deferredResumeGuard.cancel();deferredResumeGuard.confirm(false);urgentThreatUI.reset(); updateIncident();
    if (simulationStopped) throw new Error('La simulation s’est arrêtée pendant la préparation de l’affichage. Chargez une colonie validée pour reprendre.');
    statusAlerts.reset();raidUI.reset();heatwaveUI.reset();flashstormUI.reset();weatherConditionUI.reset();tradeUI.reset();
    guideAfterStartingArrival=false;learningReadout.open=false;firstDayGuide.reset();firstGesturesGuide.reset();startingArrivalUI.reset();
    if(snapshot)startingArrivalUI.update(snapshot,currentSpeed);
    clearSelection(); setPanel(campaignOnly?'world':null); frontMenu.hide();
    if (snapshot?.pawns[0]) renderer?.focusPawn(snapshot.pawns[0].id);
    else if(snapshot?.startingArrival&&snapshot.startingArrival.phase!=='opened')renderer?.focusCell(snapshot.startingArrival.pods[0]!.cell);
  } finally { replacingWorld = false; syncStorageButtons(); }
}


function notify(message: string, error = false) {
  if(nativeUi){nativeUi.showNotice(message,error);return;}
  el('notice').textContent = message;
  el('notice').classList.toggle('error', error);
  el('notice').hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { el('notice').hidden = true; }, error ? 8000 : 4000);
}
async function attempt(action: () => Promise<unknown>) {
  try { await action(); } catch (error) { audio.playInterface('ui.reject'); notify(error instanceof Error ? error.message : String(error), true); }
}
const scheduleUI = createScheduleControls(el('schedule-panel'), command => attempt(async () => {
  await client.command(command); renderState();
}));
const foodPolicyUI = createFoodPolicyControls(el('assign-panel'), async command => {
  try { await client.command(command); renderState(); return null; }
  catch(error) {return error instanceof Error ? error.message : String(error);}
});
const drugPolicyUI = createDrugPolicyControls265(el('assign-panel'), async command => {
  try {await client.command(command);renderState();return null;}catch(error){return error instanceof Error?error.message:String(error);}
});
const apparelPolicyUI = createApparelPolicyControls(el('assign-panel'), async command => {
  try { await client.command(command); renderState(); return null; }
  catch(error) {return error instanceof Error ? error.message : String(error);}
});
const allowedAreaUI=nativeMode?undefined:createAllowedAreaControls(el('assign-panel'),async command=>{
  try{await client.command(command);renderState();return null;}catch(error){return error instanceof Error?error.message:String(error);}
},(id,enabled)=>{setPanel(null);applyTool(enabled?'allowed-expand':'allowed-shrink');allowedAreaEditId=id;renderer?.setAllowedAreaTarget(id);},id=>renderer?.setAllowedAreaTarget(id));
const animalAreaActions287:AnimalAreaActions287={
  current(animalId){
    const world=snapshot;if(!world||!client.hasActiveMap||!world.wildlife?.animals.some(a=>a.id===animalId))return;
    return {world,mapId:campaignUIFacts(world)?.activeMapId??0,epoch:campaignPresentationEpoch,
      blocked:replacingWorld||session.busy||simulationStopped||campaignFocusBusy||frontMenu.isOpen()};
  },
  async send(command,anchor){
    const context=animalAreaActions287.current(command.animalId);
    if(!context||context.blocked||context.epoch!==anchor.epoch||context.mapId!==anchor.mapId||command.animalId!==anchor.animalId)
      throw new Error('La carte ou l’animal a changé. Reprenez le choix depuis son état confirmé.');
    return client.command(command);
  },
  onManage:()=>allowedAreaUI?.open(),
  onPendingChange:()=>queueMicrotask(()=>renderState()),
};
const constructionUI = constructionControls(() => applyTool(currentTool));
function setCategory(category: ArchitectCategory) {
  if(nativeUi){currentCategory=category;nativeCustomPage=undefined;refreshNativeUi();return;}
  if(category==='orders'||category==='zones')return;
  currentCategory = category;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-category]')) {button.classList.toggle('active',button.dataset.category===category);if(button.dataset.category==='ship')button.hidden=!snapshot||!architectCategoryAvailable(snapshot,'ship');}
  syncArchitectAvailability(true);
}

function syncArchitectAvailability(force=false):void {
  if(nativeUi){if(snapshot&&!architectToolAvailable(snapshot,currentTool))applyTool('select');return;}
  const key=`${currentCategory}:${snapshot?architectAvailabilityKey(snapshot):'no-world'}`;
  if(!force&&key===lastArchitectAvailabilityKey)return;
  lastArchitectAvailabilityKey=key;
  const shipCategory=document.querySelector<HTMLButtonElement>('[data-category="ship"]');if(shipCategory)shipCategory.hidden=!snapshot||!architectCategoryAvailable(snapshot,'ship');
  for(const {button,tool,category} of architectToolButtons){
    const hidden=category!==currentCategory||!snapshot||!architectToolAvailable(snapshot,tool);
    if(button.hidden!==hidden)button.hidden=hidden;
  }
  if(snapshot&&!architectToolAvailable(snapshot,currentTool)){
    renderer?.cancelDesignation();
    applyTool('select');
  }
}
function selectedColonyIds():number[]{return snapshot?.pawns.filter(p=>selection.ids.has(p.id)&&isColonist(p)&&!p.prisoner).map(p=>p.id)??[];}
function renderWildlife(world:World){updateWildlifePanel(el('wildlife-content'),world,id=>selectPawn(id),()=>void attempt(async()=>{await client.command({type:'enable-wildlife'});renderState();}),[...selection.ids],id=>void attempt(async()=>{await client.command({type:'shoot',pawnIds:selectedColonyIds(),targetId:id});renderState();}),id=>void attempt(async()=>{await client.command({type:'melee',pawnIds:selectedColonyIds(),targetId:id});renderState();}),(id,enabled)=>void attempt(async()=>{await client.command({type:'hunt',animalId:id,enabled});renderState();}),(id,enabled)=>void attempt(async()=>{await client.command({type:'tame',animalId:id,enabled});renderState();}));}
function setPanel(panel: Panel, preserveTool = false) {
  if(nativeUi){
    cancelNativeOrderPage();
    nativeToolPalette=undefined;
    if(!snapshot&&campaignOnly&&panel===null)panel='world';
    const previous=currentPanel;currentPanel=panel;nativeCustomPage=undefined;
    if(previous==='menu'&&panel!=='menu'&&menuResumeSpeed!==undefined&&!replacingWorld&&!frontMenu.isOpen()){
      const speed=menuResumeSpeed;menuResumeSpeed=undefined;void attempt(()=>client.setSpeed(deferredResumeGuard.held?0:speed));
    }
    if(panel!=='architect'&&!preserveTool&&currentTool!=='select')applyTool('select');
    nativeUi.setPanel(panel);refreshNativeUi();return;
  }
  if(!snapshot&&campaignOnly&&panel===null)panel='world';
  if(!snapshot&&campaignOnly&&panel!==null&&panel!=='world'&&panel!=='menu'&&panel!=='quests')return;
  hoverReadoutLayout?.reset();
  architectWorkbench.close();
  dismissTooltip();
  // Every exit path (tabs, map, portraits and shortcuts) releases this pause.
  if (currentPanel === 'menu' && panel !== 'menu' && menuResumeSpeed !== undefined && !replacingWorld && !frontMenu.isOpen()) {
    const speed = menuResumeSpeed; menuResumeSpeed = undefined;
    menuTransition = client.setSpeed(deferredResumeGuard.held?0:speed);
    void attempt(() => menuTransition);
  }
  orderMenu.close();
  currentPanel = panel;
  syncStorageButtons();
  scheduleUI.cancel();
  for (const name of ['architect', 'work', 'schedule', 'assign', 'history', 'menu', 'research', 'wildlife', 'animals', 'world', 'quests'] as const) el(`${name}-panel`).hidden = panel !== name;
  groupUI.setVisible(panel==='world'&&worldTab==='group');overviewGlobe.setVisible(panel==='world'&&worldTab==='maps');
  const campaign=campaignState();if(panel==='world'&&campaign)refreshWorldPanels(campaign);
  if(panel==='animals'&&snapshot)updateAnimalsPanel(el('animals-content'),snapshot,id=>selectPawn(id),designateAnimalSlaughter,updateAutoSlaughterPolicy,designateAnimalTraining,animalAreaActions287);
  if(panel==='wildlife'&&snapshot)renderWildlife(snapshot);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]:not(:disabled)')) {
    const active = button.dataset.panel === panel;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (panel === 'schedule' && snapshot) scheduleUI.update(snapshot);
  if (panel === 'assign' && snapshot) {foodPolicyUI.update(snapshot,confirmedFoodReadability());apparelPolicyUI.update(snapshot);drugPolicyUI.update(snapshot);allowedAreaUI?.update(snapshot);}
  if (panel === 'research' && snapshot) updateResearchPanel(el('research-content'),snapshot,c=>void attempt(()=>client.command(c)),researchPanelActions);
  el('inspector').hidden = panel !== null || preserveTool&&currentTool!=='select' || (!selection.ids.size && !selectedCell);
  if (panel !== 'architect' && !preserveTool) applyTool('select');
  if (panel === null && snapshot) {
    const cell = selectedCell ?? snapshot.pawns.find(p => p.id === selectedPawn);
    if (cell) roomInspection.update(el('inspector'), snapshot, cell);
  }
  if (panel === 'work' && snapshot) updateWorkPanel(snapshot,carriedPatientsOf(snapshot));
}
function applyTool(tool: Tool) {
  if(nativeUi){
    zoneEditTarget=undefined;renderer?.setZoneTarget(undefined);allowedAreaEditId=undefined;renderer?.setAllowedAreaTarget(undefined);shootingControls.cancel();
    if(tool==='ship-cryptosleep-casket'&&currentTool!==tool){placementOrientation=2;renderer?.setPlacementRotation(placementOrientation);}
    if(isShipPartKind276(tool)&&currentTool!==tool){placementOrientation=SHIP_PART_DEFAULT_ORIENTATION_276[tool];renderer?.setPlacementRotation(placementOrientation);}
    if(isShipComputerSensorsKind298(tool)){placementOrientation=0;renderer?.setPlacementRotation(0);}
    currentTool=tool;syncToolCursor(el('viewport'),tool);
    if(tool!=='install'){installationId=undefined;renderer?.setFurniturePlacement(undefined);}
    if(tool!=='replant-tree'){replantPileId=undefined;renderer?.setTreePlacement(undefined);}
    renderer?.setFloorSelection(isBuildableFloor(tool)?tool:undefined);renderer?.setTool(isBuildableFloor(tool)?'lay-floor':tool);
    renderer?.setRoofAreasVisible(isRoofArea(tool));const material=isShipComputerSensorsKind298(tool)?'steel':placementMaterial(tool,nativeConstructionMaterial);
    if(material)nativeConstructionMaterial=material;renderer?.setConstructionMaterial(material);
    refreshNativeUi();return;
  }
  hoverReadoutLayout?.reset();
  architectWorkbench.close();
  zoneEditTarget=undefined;renderer?.setZoneTarget(undefined);allowedAreaEditId=undefined;renderer?.setAllowedAreaTarget(undefined);
  shootingControls.cancel();
  if(tool!=='install'){installationId=undefined;renderer?.setFurniturePlacement(undefined);}
  if(tool!=='replant-tree'){replantPileId=undefined;renderer?.setTreePlacement(undefined);}
  if(tool==='ship-cryptosleep-casket'&&currentTool!==tool){placementOrientation=2;renderer?.setPlacementRotation(placementOrientation);}
  if(isShipPartKind276(tool)&&currentTool!==tool){placementOrientation=SHIP_PART_DEFAULT_ORIENTATION_276[tool];renderer?.setPlacementRotation(placementOrientation);}
  if(isShipComputerSensorsKind298(tool)){placementOrientation=0;renderer?.setPlacementRotation(0);}
  currentTool = tool;
  syncToolCursor(el('viewport'), tool);
  renderer?.setFloorSelection(isBuildableFloor(tool)?tool:undefined);renderer?.setTool(isBuildableFloor(tool)?'lay-floor':tool);
  renderer?.setRoofAreasVisible(isRoofArea(tool));
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  el('tool-instruction').textContent = constructionUI.update(tool, tool==='replant-tree'?'Choisissez un sol fertile, sans toit pour replanter cet arbre. Échap ou clic droit : annuler.':tool==='allowed-expand'||tool==='allowed-shrink'?'Tracer un rectangle pour modifier la zone autorisée. Échap ou clic droit : quitter.':toolDefinitions.find(item => item.id === tool)?.hint??'Choisissez le nouvel emplacement du meuble. Q/E : rotation. Échap : annuler.');
  renderer?.setConstructionMaterial(isShipComputerSensorsKind298(tool)?'steel':constructionUI.material(tool));
  el('placement-controls').hidden = !rotatableTools.has(tool);
  el('storage-options').hidden = tool !== 'stockpile';
  updateMapHover(true);
}
function setTool(tool: Tool) {
  if(!snapshot||!architectToolAvailable(snapshot,tool))return;
  const definition = toolDefinitions.find(item => item.id === tool);
  if(!definition)return;
  if(nativeUi&&(definition.category==='orders'||definition.category==='zones')){setPanel(null,true);setCategory(definition.category);applyTool(tool);showNativeToolPalette(definition.category,false);return;}
  setCategory(definition.category);
  setPanel('architect');
  applyTool(tool);
  setPanel(null,true);
}
function beginTreePlacement(pileId:number):void {
  if(!snapshot||!snapshot.piles.some(p=>p.id===pileId&&p.owner.type==='ground'&&isMinifiedTree(p)))return;
  setPanel('architect');applyTool('replant-tree');replantPileId=pileId;renderer?.setTreePlacement(pileId);setPanel(null,true);
}
function selectPawn(id: number) {
  selectPawns({ids:[id],additive:false,toggle:false},true);
}
function updateMapHover(force=false):void {
  if(nativeUi){
    const cell=hoveredCell;
    if(currentTool!=='select'||!snapshot||!cell||currentPanel!==null||frontMenu.isOpen()||replacingWorld){nativeUi.setWorldReadout(null);return;}
    if(altInspectorHeld){updateMapCellDetails(force);return;}
    const now=performance.now();if(!force&&now-lastHoverReadAt<250)return;lastHoverReadAt=now;
    nativeUi.setWorldReadout(mapHoverLines(snapshot,cell,mapHoverLight.lightAt(snapshot,cell,now)));return;
  }
  const readout=el('map-hover-readout'),cell=hoveredCell??hoverReadoutLayout?.retainedCell;
  if(currentTool!=='select'||!snapshot||!cell||currentPanel!==null||frontMenu.isOpen()||replacingWorld||document.querySelector('dialog[open]')){
    const changed=!readout.hidden||lastHoverCopy!=='';
    readout.hidden=true;if(lastHoverCopy)readout.replaceChildren();lastHoverCopy='';
    if(changed)hoverReadoutLayout?.changed();
    updateMapCellDetails(true);return;
  }
  const now=performance.now();
  if(!force&&now-lastHoverReadAt<250)return;
  lastHoverReadAt=now;
  const lines=mapHoverLines(snapshot,cell,mapHoverLight.lightAt(snapshot,cell,now));
  const copy=lines.join('\n'),changed=copy!==lastHoverCopy||readout.hidden!==!lines.length;
  if(copy!==lastHoverCopy){readout.replaceChildren(...lines.map(line=>{const span=document.createElement('span');span.textContent=line;return span;}));lastHoverCopy=copy;}
  readout.hidden=!lines.length;
  if(changed)hoverReadoutLayout?.changed();
  updateMapCellDetails(force);
}
function positionMapCellDetails():void {
  if(nativeUi)return;
  const panel=el('map-cell-details');if(panel.hidden)return;
  const bounds=shell.getBoundingClientRect();
  const x=mapPointerX-bounds.left,y=mapPointerY-bounds.top;
  panel.style.left=`${Math.max(8,Math.min(bounds.width-panel.offsetWidth-8,x+26))}px`;
  panel.style.top=`${Math.max(8,Math.min(bounds.height-panel.offsetHeight-8,y+26))}px`;
}
function updateMapCellDetails(force=false):void {
  if(nativeUi){
    if(!altInspectorHeld){updateMapHover(force);return;}
    if(currentTool!=='select'||!snapshot||!hoveredCell||frontMenu.isOpen()||replacingWorld)return;
    const now=performance.now();if(!force&&now-lastAltReadAt<160)return;lastAltReadAt=now;
    const details=mapCellDetails(snapshot,hoveredCell,mapHoverLight.lightAt(snapshot,hoveredCell,now));
    nativeUi.setWorldReadout(details?[details.heading,...details.things,...details.rows.map(row=>`${row.label} : ${row.value}`)]:null);return;
  }
  const panel=el('map-cell-details');
  if(currentTool!=='select'||!altInspectorHeld||!snapshot||!hoveredCell||frontMenu.isOpen()||replacingWorld
    ||document.elementFromPoint(mapPointerX,mapPointerY)!==document.querySelector('#viewport canvas')){
    panel.hidden=true;lastAltCopy='';return;
  }
  const now=performance.now();if(!force&&now-lastAltReadAt<160)return;
  lastAltReadAt=now;
  const details=mapCellDetails(snapshot,hoveredCell,mapHoverLight.lightAt(snapshot,hoveredCell,now));
  if(!details){panel.hidden=true;lastAltCopy='';return;}
  const copy=JSON.stringify(details);
  if(copy!==lastAltCopy){
    const heading=document.createElement('div');heading.className='map-cell-detail-heading';heading.textContent=details.heading;
    const things=details.things.map(value=>{const node=document.createElement('div');node.className='map-cell-detail-thing';node.textContent=value;return node;});
    const rows=details.rows.map(({label,value})=>{const node=document.createElement('div');node.className='map-cell-detail-row';const name=document.createElement('span');name.textContent=label;const datum=document.createElement('strong');datum.textContent=value;node.append(name,datum);return node;});
    panel.replaceChildren(heading,...things,...rows);lastAltCopy=copy;
  }
  panel.hidden=false;positionMapCellDetails();
}
function selectPawns(gesture:SelectionGesture,focus=false) {
  if(!snapshot||replacingWorld||frontMenu.isOpen())return;
  nativeHudHiddenInspectorKey=undefined;
  shootingControls.cancel();
  selection.apply(gesture,new Set([...snapshot.pawns.filter(p=>knownPosition256(snapshot!,p)).map(p=>p.id),...(snapshot.wildlife?.animals??[]).filter(a=>knownPosition256(snapshot!,a)).map(a=>a.id),...(snapshot.mechanoids??[]).filter(m=>knownPosition256(snapshot!,m)).map(m=>m.id)]));
  selectedPawn=selection.single;selectedCell=undefined;
  selectedObject=undefined;selectedObjects=[];renderer?.setSelectedObject(undefined);
  renderer?.setSelectedPawns(selection.ids);
  setPanel(null);
  if(focus&&selectedPawn!==undefined)renderer?.focusPawn(selectedPawn);
  if(!nativeUi)rebuildInspector(); renderState();
}
function pickCell(x: number, z: number) {
  if (!snapshot || replacingWorld || frontMenu.isOpen()) return;
  if(shootingControls.active){
    if(!knownPosition256(snapshot,{x,z})){shootingControls.cancel();renderState();return;}
    const target=shootingControls.mode==='melee'?snapshot.structures.find(s=>isBarrier(s)&&s.x===x&&s.z===z):undefined;
    shootingControls.cancel();if(target)void attempt(async()=>{await client.command({type:'melee',pawnIds:selectedColonyIds(),targetId:target.id,structure:true});renderState();});else renderState();return;
  }
  if (currentTool !== 'select') {
    const tool = currentTool;
    if((tool==='allowed-expand'||tool==='allowed-shrink')&&allowedAreaEditId!==undefined){paintAllowedArea(allowedAreaEditId,tool==='allowed-expand',{x,z},{x,z});return;}
    void attempt(() => {
      if(isBuildableFloor(tool))return client.command({type:'area',action:'lay-floor',floor:tool,from:{x,z},to:{x,z}});
      if(tool==='build-bridge'||tool==='remove-bridge')return client.command({type:'area',action:tool,from:{x,z},to:{x,z}});
      if(tool==='smooth-floor')return client.command({type:'area',action:'smooth-floor',from:{x,z},to:{x,z}});
      if(tool==='remove-floor')return client.command({type:'area',action:'remove-floor',from:{x,z},to:{x,z}});
      if(tool==='replant-tree'){if(replantPileId===undefined)throw new Error('Sélectionnez un arbre à replanter.');return client.command({type:'replant-tree',pileId:replantPileId,x,z}).then(()=>{applyTool('select');setPanel(null);});}
      if(tool==='install'){if(installationId===undefined)throw new Error('Sélectionnez un meuble à installer.');return client.command({type:'install',structureId:installationId,x,z,orientation:['sun-lamp','standing-lamp','small-sculpture','large-sculpture'].includes(furnitureObject(snapshot!,installationId)?.kind??'')?0:placementOrientation}).then(()=>{applyTool('select');setPanel(null);});}
      if (tool==='snow-clear'||tool==='remove-snow-clear'||tool==='home'||tool==='remove-home'||isRoofArea(tool) || tool === 'haul-chunks' || tool === 'growing' || tool === 'remove-growing') return client.command({type:'area',action:tool,from:{x,z},to:{x,z},...(zoneEditTarget===undefined?{}:{targetZoneId:zoneEditTarget})});
      if (tool==='stockpile'||tool==='remove-stockpile')return client.command({type:'area',action:tool,from:{x,z},to:{x,z},...(zoneEditTarget===undefined?{}:{targetZoneId:zoneEditTarget}),...(tool==='stockpile'?readStorageSettings('stockpile'):{})});
      const objects = tool==='deconstruct'||tool==='uninstall' ? snapshot?.structures.filter(s=>footprintCells(s).some(c=>c.x===x&&c.z===z))??[] : [];
      const target = objects.find(s=>s.kind!=='power-conduit')??objects[0];
      const material=isShipComputerSensorsKind298(tool)?'steel':nativeUi?placementMaterial(tool,nativeConstructionMaterial):constructionUI.material(tool);
      return client.command(tool === 'cancel' ? { type: 'cancel', x, z } : { type: 'designate', kind: tool as JobKind, ...(target?{targetId:target.id}:{}), orientation: isShipComputerSensorsKind298(tool)||tool==='geothermal-generator'||tool==='mini-turret'||tool==='sandbags'||tool==='solar-generator'||tool==='power-conduit'||tool==='power-switch'||tool==='wood-generator'||tool==='chemfuel-generator'||tool==='sun-lamp'||tool==='standing-lamp'||tool==='door'||tool==='autodoor'||tool==='passive-cooler'?0:placementOrientation, x, z, ...(material ? {material} : {}) });
    });
    return;
  }
  const cell={x,z},object=nextMapObject(snapshot,cell,selectedCell?.x===x&&selectedCell.z===z?selectedObject:undefined);
  if(!object){clearSelection();return;}
  selection.clear();renderer?.setSelectedPawns(selection.ids);
  selectedPawn = undefined; selectedCell = cell;selectedObject=object;selectedObjects=[object];renderer?.setSelectedObject(object);
  setPanel(null); if(!nativeUi)rebuildInspector(); renderState();
}
function paintAllowedArea(id:number,enabled:boolean,from:Cell,to:Cell):void {
  if(!snapshot||replacingWorld||frontMenu.isOpen())return;
  void attempt(async()=>{await client.command({type:'allowed-area-paint',areaId:id,enabled,from,to});renderState();});
}
function designateArea(action: AreaAction, from: Cell, to: Cell) {
  if (!snapshot || replacingWorld || frontMenu.isOpen()) return;
  void attempt(async () => {
    let response:string|undefined;
    try {response = await client.command({ type: 'area', action, from, to, ...(action==='lay-floor'&&isBuildableFloor(currentTool)?{floor:currentTool}:{}), ...(action === 'stockpile' ? readStorageSettings('stockpile') : {}),...(zoneEditTarget===undefined?{}:{targetZoneId:zoneEditTarget}) });}
    catch(error) {
      if(error instanceof Error && error.message==='Aucune case compatible dans ce rectangle.')return;
      throw error;
    }
    const result = JSON.parse(response!) as { affected: number; skipped: number };
    if(result.affected===0)return;
    const label = action==='snow-clear'||action==='remove-snow-clear'?'case(s) de déneigement modifiée(s)':action==='build-bridge'||action==='remove-bridge'?'ordre(s) de pont créé(s)':action==='smooth-floor'?'ordre(s) de lissage créé(s)':action==='lay-floor'||action==='remove-floor'?'ordre(s) de sol créé(s)':action==='home'||action==='remove-home'?'case(s) de foyer modifiée(s)':isRoofArea(action) ? 'case(s) de zone de toiture modifiée(s)' : action === 'growing' ? 'case(s) de culture créée(s)' : action === 'remove-growing' ? 'case(s) de culture retirée(s)' : action === 'cancel' ? 'ordre(s) annulé(s)' : action === 'remove-stockpile' ? 'case(s) de réserve retirée(s)' : action === 'stockpile' ? 'case(s) de réserve créée(s)' : 'ordre(s) de collecte créé(s)';
    notify(`${result.affected} ${label}${result.skipped ? ` · ${result.skipped} case(s) ignorée(s)` : ''}.`);
  });
}
function clearSelection() {
  nativeHudHiddenInspectorKey=undefined;
  selection.clear();renderer?.setSelectedPawns(selection.ids);orderMenu.close();
  selectedPawn = undefined; selectedCell = undefined;selectedObject=undefined;selectedObjects=[];renderer?.setSelectedObject(undefined);
  if(!nativeUi)rebuildInspector();renderState();
}
function selectObjects(objects:MapObjectSelection[],additive=false):void {
  if(!snapshot||replacingWorld||frontMenu.isOpen())return;
  const merged=new Map<string,MapObjectSelection>();
  for(const object of [...(additive?selectedObjects:[]),...objects])merged.set(`${object.kind}:${object.id}`,object);
  selectedObjects=[...merged.values()].slice(0,MAX_MAP_OBJECT_SELECTION);
  selectedObject=selectedObjects[0];selectedCell=selectedObject?mapObjectGroupCells(snapshot,[selectedObject])[0]?.[0]:undefined;
  selection.clear();selectedPawn=undefined;renderer?.setSelectedPawns(selection.ids);renderer?.setSelectedObjects(selectedObjects);
  setPanel(null);if(!nativeUi)rebuildInspector();renderState();
}
function objectGroupControls():void {
  if(!snapshot||!selectedObject)return;
  el('object-group-title').textContent=`${selectedObjects.length} objets sélectionnés`;
  const host=el('object-group-actions'),selectionKey=selectedObjects.map(o=>`${o.kind}:${o.id}`).join('|');
  const previous=objectGroupReads.get(host);
  if(previous?.world===snapshot&&previous.selection===selectionKey)return;
  const actions=mapObjectGroupActions(snapshot,selectedObjects);
  objectGroupReads.set(host,{world:snapshot,selection:selectionKey});
  const key=actions.map(a=>`${a.id}:${a.label}`).join('|');if(host.dataset.actions===key)return;
  host.dataset.actions=key;host.replaceChildren(...actions.map(action=>{
    const button=document.createElement('button');button.type='button';button.className='secondary-action';button.textContent=action.label;
    button.dataset.objectGroupAction=action.id;
    button.onclick=()=>void attempt(async()=>{
      if(!snapshot)return;
      const commands=mapObjectGroupActions(snapshot,selectedObjects).find(a=>a.id===action.id)?.commands??[];
      for(const command of commands)await client.command(command);
      rebuildInspector();renderState();
    });return button;
  }));
}
function readStorageSettings(_prefix:string){return nativeUi?nativeCreationStorage:creationStorageControls.read();}
function editZone(kind:'stockpile'|'growing',id:number,shrink=false):void {
  setTool(kind==='stockpile'?(shrink?'remove-stockpile':'stockpile'):(shrink?'remove-growing':'growing'));
  zoneEditTarget=id;renderer?.setZoneTarget(id);
}
function zoneActions(kind:'stockpile'|'growing',id:number):HTMLElement {
  const actions=document.createElement('div');actions.className='zone-actions';
  for(const [label,shrink] of [['Agrandir la zone',false],['Réduire la zone',true]] as const){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.zoneAction=shrink?'shrink':'expand';
    button.onclick=()=>editZone(kind,id,shrink);actions.append(button);
  }
  const remove=document.createElement('button');remove.type='button';remove.textContent='Supprimer la zone';remove.dataset.zoneAction='delete';
  remove.onclick=()=>void attempt(async()=>{await client.command({type:'delete-zone',kind,zoneId:id});clearSelection();});actions.append(remove);
  return actions;
}

function rotatePlacement(direction = 1) {
  if(isShipComputerSensorsKind298(currentTool))return;
  if(currentTool==='install'&&snapshot&&installationId!==undefined&&furnitureObject(snapshot,installationId)?.kind==='firefoam-popper')return;
  placementOrientation = ((placementOrientation + direction + 4) % 4) as Orientation;
  renderer?.setPlacementRotation(placementOrientation);
  el('placement-orientation').textContent = `${placementOrientation * 90}°`;
}
function rebuildInspector() {
  if(nativeUi){refreshNativeUi();return;}
  dismissTooltip();
  selectedLinkedStorage?.dispose();selectedLinkedStorage=undefined;
  selectedStorageControls?.dispose();selectedStorageControls=undefined;selectedStoragePending=0;
  const panel = el('inspector');
  panel.hidden = currentPanel !== null || (!selection.ids.size && !selectedCell);
  panel.classList.remove('colonist-inspector-host','animal-inspector-host','mechanoid-inspector-host','cell-inspector-host','stockpile-inspector-host');
  delete panel.dataset.colonistInspectorPawn;
  delete panel.dataset.colonistInspectorTab;
  delete panel.dataset.mechanoidId;
  if(selectedObjects.length>1){
    panel.innerHTML='<div class="panel-heading"><h2 id="object-group-title"></h2><button id="inspect-close" aria-label="Fermer l’inspection">×</button></div><div id="object-group-actions" class="zone-actions"></div><p class="muted">Double clic : objets du même type visibles à l’écran. Sélection limitée à 200 objets.</p>';
    objectGroupControls();
  } else if(selection.ids.size>1) {
    panel.innerHTML='<div class="panel-heading"><h2 id="group-title"></h2><button id="inspect-close" aria-label="Fermer l’inspection">×</button></div><div id="group-members"></div><p class="muted">Choisissez un individu pour consulter son dossier.</p>';
    for(const id of selection.ids) {
      const button=document.createElement('button');button.dataset.groupPawn=String(id);button.onclick=()=>selectPawn(id);el('group-members').append(button);
    }
  } else if(selectedPawn!==undefined&&snapshot?.wildlife?.animals.some(a=>a.id===selectedPawn)) {
    createAnimalInspector(panel,{animalAreas:animalAreaActions287,onRescue:(pawnId,animalId)=>void attempt(async()=>{await client.command({type:'order-animal-rescue',pawnId,animalId});renderState();}),onSlaughter:designateAnimalSlaughter,onTraining:designateAnimalTraining,onTame:(animalId,enabled)=>void attempt(async()=>{await client.command({type:'tame',animalId,enabled});renderState();}),onCarePolicy:(animalId,care)=>void attempt(async()=>{await client.command({type:'animal-care-policy',animalId,care});renderState();}),onHunt:(animalId,enabled)=>void attempt(async()=>{await client.command({type:'hunt',animalId,enabled});renderState();}),onClose:clearSelection});
  } else if(selectedPawn!==undefined&&snapshot?.mechanoids?.some(m=>m.id===selectedPawn)) {
    const current=()=>{const actor=snapshot?.mechanoids?.find(m=>m.id===selectedPawn);return snapshot&&actor?{world:snapshot,actor}:undefined;};
    createMechanoidInspector(panel,current,clearSelection);
  } else if (selectedPawn !== undefined && snapshot?.pawns.some(p=>p.id===selectedPawn)) {
    const inspected=snapshot.pawns.find(p=>p.id===selectedPawn)!;
    const managed=isColonist(inspected)&&!inspected.prisoner;
    const current=()=>{const pawn=snapshot?.pawns.find(p=>p.id===selectedPawn);return snapshot&&pawn?{world:snapshot,pawn}:undefined;};
    const send=(command:Command)=>void attempt(()=>client.command(command));
    panel.innerHTML = `<div class="panel-heading"><h2 id="selected-name"></h2><button id="selected-information" aria-label="Informations sur le personnage">i</button><button id="inspect-close" aria-label="Fermer l’inspection">×</button></div><p id="selected-action"></p>${pawnNeedsMarkup()}${managed?'<button class="secondary-action" id="manage-work">Gérer le travail</button>':''}`;
    el('selected-information').onclick=()=>{const state=current();if(!state)return;
      const pawn=state.pawn;
      openObjectInformation({title:pawn.name,description:actionLabel(pawn,carriedPatientsOf(state.world)),rows:[
        {category:'Passé',label:'Profil',value:backgroundSummary(pawn),description:'Enfance et activité adulte enregistrées. Bio présente leurs récits et effets initiaux.'},
        ...backgroundRestrictionRows(pawn).map(row=>({category:'Incapacités',label:row.label,value:'Indisponible',description:row.reason})),
        ...healthCapacityRows(pawn).map(row=>({...row,category:'Capacités',description:'Capacité actuelle du personnage. Les détails anatomiques et facteurs actifs se consultent dans Santé.'})),
        ...BACKGROUND_SKILL_IDS.flatMap(skill=>{const value=pawn.skills[skill];if(!value)return [];
          const refusal=backgroundSkillRefusal(pawn,skill);
          return [{category:'Compétences',label:BACKGROUND_SKILL_LABELS[skill],value:refusal?`Indisponible (niveau enregistré ${value.level} / 20)`:`${value.level} / 20`,description:refusal??'Niveau actuel. Bio expose l’expérience et les effets sur les travaux.'}];}),
      ]});};
    setTooltip(el('selected-information'),{title:'Informations',body:'Afficher les statistiques disponibles du personnage.'});
    createMoodInspection(panel);
    createSocialInspection(panel,renderState);
    createJournalInspection(panel);
    createSkillsInspection(panel);
    createEquipmentInspection(panel,current,send);
    createHealthInspection(panel,()=>current()?.pawn,send,managed,healthSurgeryActionsAvailable280(inspected,snapshot.schemaVersion)?{version:()=>current()?.world.schemaVersion,request:(pawnId,part)=>send({type:'surgery-request',pawnId,part}),cancel:pawnId=>send({type:'surgery-cancel',pawnId}),install:(pawnId,part,implant)=>send({type:'surgery-install',pawnId,part,implant}),remove:(pawnId,part)=>send({type:'surgery-remove-prosthetic',pawnId,part})}:undefined);
    if(inspected.prisoner)createPrisonerInspection(panel,current,send);
    if(managed){
      el('manage-work').onclick = () => setPanel('work');
      const orders=document.createElement('p');orders.id='selected-orders';panel.append(orders);
      const cancel=document.createElement('button');cancel.id='clear-orders';cancel.textContent='Annuler les ordres directs';
      cancel.onclick=()=>{if(selectedPawn!==undefined)send({type:'clear-orders',pawnId:selectedPawn});};panel.append(cancel);
      setTooltip(el('manage-work'),{title:'Travail',body:'Ouvrir les priorités de travail de la colonie.'});
      setTooltip(cancel,{title:'Annuler les ordres',body:'Interrompre les ordres directs de ce colon et lui rendre son autonomie.'});
    }
  } else if (selectedCell) {
    panel.classList.add('cell-inspector-host');
    panel.innerHTML = `<div class="cell-summary"><div class="cell-card"><div class="panel-heading cell-heading"><span class="cell-illustration ui-icon" aria-hidden="true"></span><h2 id="cell-title"></h2><button id="inspect-close" aria-label="Fermer l’inspection">×</button></div><div id="cell-description"></div><p id="cell-materials"></p><p id="cell-job"></p></div><div class="cell-actions" role="group" aria-label="Commandes de l’objet"><button id="weapon-permission" class="secondary-action" hidden></button><button id="cell-material-permission" type="button" class="secondary-action" hidden></button><button id="cell-chop" class="secondary-action" hidden>Couper du bois</button><button id="cell-harvest" class="secondary-action" hidden>Récolter</button><button id="cell-cut" class="secondary-action" hidden>Couper</button><button id="cell-extract" class="secondary-action" hidden>Déraciner</button><button id="cell-replant" class="secondary-action" hidden>Replanter</button><button id="cell-deconstruct" class="secondary-action" hidden>Déconstruire</button><button id="cell-cancel" class="secondary-action" hidden>Annuler cet ordre</button></div></div><div id="cell-storage" hidden><div id="selected-stockpile-items"></div></div>`;
    for(const [id,label] of [['mine','Miner'],['haul-chunks','Transporter']] as const){
      const button=document.createElement('button');button.id=`cell-${id}`;button.className='secondary-action';button.hidden=true;button.textContent=label;panel.querySelector('.cell-actions')!.append(button);
    }
    const storageCell = selectedObject?.kind==='stockpile'?snapshot?.stockpiles.find(item => item.id===selectedObject!.id):undefined;
    const shelf = selectedObject?.kind==='structure'?snapshot?.structures.find(item=>item.id===selectedObject!.id&&isShelfKind(item.kind)):undefined;
    const storage = storageCell??shelf?.shelf?.settings;
    if(storage){
      panel.classList.add('stockpile-inspector-host');
      const stockpileId=storageCell?.id,structureId=shelf?.id,storageEpoch=campaignPresentationEpoch,
        storageMap=campaignUIFacts(snapshot!)?.activeMapId??0;let pending=0,needsRollback=false;
      const storageCurrent=()=>!!snapshot&&client.hasActiveMap&&storageEpoch===campaignPresentationEpoch
        &&(campaignUIFacts(snapshot)?.activeMapId??0)===storageMap&&!replacingWorld&&!session.busy&&!simulationStopped
        &&selectedObject?.kind===(structureId!==undefined?'structure':'stockpile')
        &&selectedObject.id===(structureId??stockpileId);
      const sendSettings=(settings:StorageControlSettings)=>{
        if(!storageCurrent()||selectedLinkedStorage?.pending)return;
        pending++;selectedStoragePending=pending;
        void attempt(async()=>{
          try{await client.command(structureId!==undefined?{type:'shelf-policy',structureId,settings}:{type:'stockpile-policy',stockpileId:stockpileId!,settings});}
          catch(error){needsRollback=true;throw error;}
          finally{pending--;if(selectedStorageControls===controls){selectedStoragePending=pending;const current=structureId!==undefined?snapshot?.structures.find(s=>s.id===structureId)?.shelf?.settings:snapshot?.stockpiles.find(cell=>cell.id===stockpileId);if(!pending&&current){controls.show(current,needsRollback);needsRollback=false;}renderState();}}
        });
      };
      const controls=mountStorageControls(el('selected-stockpile-items'),storage,sendSettings,shelf?shelfControlOptions:undefined);selectedStorageControls=controls;
      if(shelf)controls.element.dataset.shelfControls=String(shelf.id);
      if(shelf&&isSchema286OrLater(snapshot?.schemaVersion)){
        const linked=createLinkedStorageControls286({
          current:()=>storageCurrent()&&snapshot?{world:snapshot,mapId:storageMap,epoch:storageEpoch,structureId:shelf.id,blocked:selectedStoragePending>0}:undefined,
          onPendingChange:pending=>{
            if(selectedStorageControls!==controls)return;controls.element.inert=pending;
            const paste=panel.querySelector<HTMLButtonElement>('[data-zone-action="paste"]');if(paste)paste.disabled=!storageClipboard||pending;
          },
          send:async(command,context)=>{
            if(!storageCurrent()||context.mapId!==storageMap||context.epoch!==storageEpoch||context.structureId!==shelf.id||selectedStoragePending)
              throw Error('La carte ou l’inspection du stockage a changé.');
            const result=await client.command(command);renderState();return result;
          },
        });
        selectedLinkedStorage=linked;panel.querySelector('#cell-storage')?.prepend(linked.element);linked.update();
      }
      const commands=storageCell?zoneActions('stockpile',stockpileZoneId(storageCell)):document.createElement('div');
      if(shelf)commands.className='zone-actions';
      const copy=document.createElement('button');copy.type='button';copy.textContent='Copier les réglages';copy.dataset.zoneAction='copy';
      copy.onclick=()=>{storageClipboard=structuredClone(controls.read());rebuildInspector();renderState();};commands.append(copy);
      const paste=document.createElement('button');paste.type='button';paste.textContent='Coller les réglages';paste.dataset.zoneAction='paste';paste.disabled=!storageClipboard;
      if(shelf&&snapshot)setTooltip(paste,{body:linkedStoragePasteScope286(snapshot,shelf.id)});
      paste.onclick=()=>{if(storageClipboard&&storageCurrent()&&!selectedLinkedStorage?.pending){const settings=structuredClone(storageClipboard);controls.show(settings);sendSettings(settings);}};commands.append(paste);
      panel.querySelector('.cell-card')?.append(commands);
    }
    el('cell-deconstruct').onclick=()=>{if(selectedCell)void attempt(()=>client.command({type:'designate',kind:'deconstruct',...selectedCell!}));};
    el('cell-cancel').onclick=()=>{if(selectedCell)void attempt(()=>client.command({type:'cancel',...selectedCell!}));};
    if(selectedObject?.kind==='structure'){
      const console=snapshot?.structures.find(s=>s.id===selectedObject!.id&&s.kind==='comms-console');
      if(console){const button=document.createElement('button');button.dataset.orbitalOpen=String(console.id);button.textContent='Appeler un vaisseau';button.onclick=()=>orbitalUI.open(console.id);panel.querySelector('.cell-actions')?.append(button);}
      doorControls(panel,()=>snapshot,()=>selectedCell,c=>void attempt(()=>client.command(c)));
      penControls(panel,()=>snapshot,()=>selectedCell,c=>void attempt(()=>client.command(c)));
      gatherSpotControls(panel,(structureId,enabled)=>attempt(async()=>{await client.command({type:'gather-spot',structureId,enabled});renderState();}));
      bedControls(panel,()=>snapshot,()=>selectedCell,c=>void attempt(()=>client.command(c)));
      const popper=snapshot?.structures.find(s=>s.id===selectedObject!.id&&s.kind==='firefoam-popper');
      if(popper&&[290,291,292,293,294,295,296].includes(Number(snapshot?.schemaVersion)))panel.append(firefoamControls290(snapshot!,popper,command=>client.command(command).then(()=>renderState())));
      const trap=snapshot?.structures.find(s=>s.id===selectedObject!.id&&s.kind==='spike-trap');
      if(trap)panel.append(spikeTrapControls(trap,command=>void attempt(async()=>{await client.command(command);rebuildInspector();renderState();})));
    }
    if(selectedObject?.kind==='structure'||selectedObject?.kind==='packed'){
      furnitureControls(panel,()=>snapshot,()=>selectedCell,()=>selectedObject?.id,c=>void attempt(()=>client.command(c)),id=>{const object=furnitureObject(snapshot!,id);if(!object)return;setPanel('architect');applyTool('install');installationId=id;placementOrientation=object.orientation;renderer?.setPlacementRotation(placementOrientation);renderer?.setFurniturePlacement(object);if(object.kind==='firefoam-popper'){el('placement-controls').hidden=true;el('tool-instruction').textContent='Choisissez le nouvel emplacement du diffuseur. Échap ou clic droit : annuler.';}setPanel(null,true);});
      panel.querySelector('.cell-actions')?.append(...panel.querySelectorAll('#cell-uninstall, #cell-install'));
    }
    const fire=selectedObject?.kind==='structure'?snapshot?.structures.find(s=>s.id===selectedObject!.id&&(stationRecipe(s)!==null||s.kind==='torch-lamp'||s.kind==='passive-cooler'||s.kind==='wood-generator'||s.kind==='chemfuel-generator')):undefined;
    if(fire) {
      const send=(command:Command)=>command.type==='bill-worker-policy'||command.type==='bill-pause-policy'||command.type==='bill-pause-resume'?client.command(command).then(()=>{renderState();}):void attempt(async()=>{await client.command(command);rebuildInspector();renderState();});
      if(fire.fuel)panel.append(fireControls(fire,send));if(stationRecipe(fire))panel.append(billControls(fire,send,billId=>client.billWorkerOptions(fire.id,billId)));
    }
    const zone = selectedObject?.kind==='growing'?snapshot?.growingZones.find(z=>z.id===selectedObject!.id):selectedObject?.kind==='structure'?snapshot?.growingZones.find(z=>z.basinId===selectedObject!.id):undefined;
    if(zone){panel.append(growingControls(zone,command=>void attempt(async()=>{await client.command(command);renderState();}),snapshot));if(zone.basinId===undefined)panel.querySelector('.cell-card')?.append(zoneActions('growing',zone.id));}
  } else panel.replaceChildren();
  if(selectedCell&&selectedObject){
    const heading=panel.querySelector('.cell-heading');
    if(heading){const info=document.createElement('button');info.id='cell-information';info.textContent='i';info.setAttribute('aria-label','Informations sur l’objet');
      info.onclick=()=>{if(!snapshot||!selectedObject)return;const pile=selectedObject.kind==='pile'?snapshot.piles.find(p=>p.id===selectedObject!.id):undefined;
        if(pile){openObjectInformation(itemInformation(pile,snapshot));return;}
        const rows=[...panel.querySelectorAll<HTMLElement>('.cell-facts>p')].map(line=>({category:'Propriétés',label:line.querySelector('span')?.textContent?.replace(/\s*:\s*$/,'')??'État',value:line.querySelector('strong')?.textContent??line.textContent??'',description:line.textContent??''}));
        const health=panel.querySelector('.cell-health-caption strong');if(health)rows.unshift({category:'Propriétés',label:'Points de vie',value:health.textContent??'',description:'État réel de cet objet.'});
        openObjectInformation({title:panel.querySelector('#cell-title')?.textContent??'Objet',description:panel.querySelector('#cell-description')?.textContent??'',rows});};
      setTooltip(info,{title:'Informations',body:'Afficher les propriétés de cet objet et rechercher une statistique.'});heading.querySelector('#inspect-close')?.before(info);}
  }
  if(selection.ids.size&&snapshot?.pawns.some(p=>selection.ids.has(p.id)&&isColonist(p))){createDraftControls(panel,()=>snapshot?.pawns.filter(p=>selection.ids.has(p.id)&&isColonist(p)&&!p.prisoner)??[],c=>void attempt(async()=>{await client.command(c);renderState();}));shootingControls.create(panel,()=>snapshot?.pawns.filter(p=>selection.ids.has(p.id)&&isColonist(p)&&!p.prisoner)??[],()=>renderState());}
  const inspected = snapshot?.pawns.find(p => p.id === selectedPawn);
  if (inspected && selection.ids.size <= 1) {
    colonistInspector = colonistInspectorState(colonistInspector, inspected.id, !!inspected.prisoner);
    mountColonistInspector(panel, { ...colonistInspector, prisoner: !!inspected.prisoner, onTabChange: tab => {
      colonistInspector = { pawnId: inspected.id, activeTab: tab }; renderState();
    } });
  }
  const close = document.getElementById('inspect-close');
  if (close) close.onclick = clearSelection;
}
function carriedPatientsOf(world: World): ReadonlySet<number> {
  const patients = new Set<number>();
  for (const pawn of world.pawns) if (pawn.rescue?.phase === 'carry') patients.add(pawn.rescue.patientId);
  return patients;
}
function actionLabel(pawn: Pawn, carriedPatients: ReadonlySet<number>) {
  const couple=snapshot&&coupleActivity285(snapshot,pawn);if(couple)return couple.label;
  if((pawn.health?.foodPoisoning?.vomit||pawn.health?.alcohol?.vomit)&&pawn.state!=='dead')return 'Vomit';
  if(pawn.cleaning)return pawn.cleaning.phase==='clean'?'Nettoie':'Rejoint des traces à nettoyer';
  if(pawn.burial)return pawn.burial.phase==='bury'?'Inhume une dépouille':pawn.burial.phase==='carry'?'Transporte une dépouille vers une tombe':'Va chercher une dépouille';
  if(pawn.burning)return pawn.burning.phase==='panic'?'En feu · panique':'Éteint les flammes sur lui';
  if(pawn.firefighting)return pawn.firefighting.phase==='approach'?'Rejoint un incendie':'Éteint un incendie';
  if(prisonBreakActive(pawn))return pawn.melee?.strike?'Révolte · récupération après attaque':pawn.melee?'Révolte · force le passage':'Révolte · cherche à s’échapper';
  if(pawn.bombRefuge||pawn.prisoner)return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if(pawn.mental?.crisis)return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if(pawn.flee)return pawn.path.length||pawn.moveCooldown>0?'Fuit une menace':'Reste à couvert après la fuite';
  if(pawn.stun)return 'Étourdi';
  if(pawn.melee)return pawn.melee.strike?'Mêlée · récupération':pawn.path.length?'Mêlée · approche':'Mêlée · au contact';
  if(pawn.faction==='outlaws'&&pawn.tactics&&activeThreat(pawn)&&pawn.state==='moving')return 'Hors-la-loi · rejoint sa position de combat';
  if(pawn.faction==='outlaws'&&activeThreat(pawn))return pawn.shooting?.stance?.phase==='aim'?'Hors-la-loi · vise':pawn.shooting?'Hors-la-loi · récupération après tir':'Hors-la-loi · surveille les alentours';
  if(pawn.shipCasketTask277){const task=pawn.shipCasketTask277;return task.phase==='closing'?`Prépare le cryptosommeil spatial · ${Math.floor(task.progressCore/500*100)} %`:task.phase==='carry'?'Porte un patient vers le caisson spatial':task.action==='carry'?'Va chercher le patient pour le caisson spatial':'Rejoint le caisson spatial pour y entrer';}
  if(pawn.draft)return draftLabel(pawn);
  if(pawn.shooting)return pawn.shooting.stance?.phase==='cooldown'?'Récupération après tir':pawn.shooting.stance?.phase==='aim'?'Riposte · vise':'Riposte · rejoint sa position';
  if(pawn.equipmentTask)return ({equip:'Va équiper son arme',drop:'Dépose son arme',wear:pawn.state==='working'?'Enfile un vêtement':'Va chercher un vêtement',remove:'Retire un vêtement'})[pawn.equipmentTask.action];
  const pasteLabel=pasteTaskLabel(snapshot!,pawn);if(pasteLabel)return pasteLabel;
  if(pawn.ward||pawn.prisoner||pawn.feed||pawn.tend||pawn.surgery||pawn.state==='resting'||pawn.rescue||carriedPatients.has(pawn.id))return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if(pawn.state==='downed'||pawn.state==='dead')return stateLabels[pawn.state];
  if(pawn.interruptedCargo)return pawn.state==='sleeping'?'Se repose · cargaison à déposer':'Cargaison à déposer · sol proche encombré';
  if(pawn.animalHandling)return ({tame:'Apprivoisement',maintain:'Entretien de la familiarité',train:'Dressage animal',lead:'Conduit un animal vers son enclos',milk:'Trait un dromadaire',shear:'Tond un mufalo',slaughter:'Abattage domestique'})[pawn.animalHandling.kind];
  if(pawn.animalRescue)return pawn.animalRescue.phase==='carry'?'Porte un animal vers un couchage':'Secourt un animal';
  if(pawn.animalCare)return 'Soins vétérinaires';
  if(pawn.animalFeed)return 'Alimentation assistée animale';
  if(pawn.cooking)return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if(pawn.need?.kind==='eat'&&pawn.need.alcoholReason)return pawn.need.alcoholReason==='inventory'?'Prend des bières pour son inventaire':pawn.need.phase==='ingest'?'Boit une bière':'Rejoint une bière';
  if(pawn.brewing)return pawn.path.length||pawn.moveCooldown>0?'Rejoint le fût de fermentation':'Extrait la bière du fût';
  if (pawn.need) return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if(pawn.recreation.task)return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  const comms298=(pawn as import('./sim/faction-comms-state-298').FactionCommsPawn298).factionComms298;if(comms298)return comms298.phase==='ready'?'Communication de faction · au contact de la console':'Communication de faction · rejoint la console';
  if(pawn.orbitalTrade)return pawn.orbitalTrade.phase==='ready'?'Commerce orbital · au contact de la console':'Commerce orbital · rejoint la console';
  if(pawn.visitor)return pawn.visitor.phase==='leaving'?'Visiteur · quitte la carte':pawn.visitor.phase==='arriving'?'Visiteur · rejoint la colonie':pawn.visitor.role==='trader'?'Marchand · séjourne dans la colonie':'Visiteur · séjourne dans la colonie';
  if(pawn.haul?.destination.type==='fuel'||pawn.haul?.destination.type==='turret')return queryPawnStatus(snapshot!,pawn,confirmedFoodReadability()).reason;
  if (pawn.haul) {
    const destination = pawn.haul.destination.type === 'job' ? 'chantier' : pawn.haul.destination.type === 'aside' ? 'bord du champ' : pawn.haul.destination.type==='hopper'?'trémie':pawn.haul.destination.type==='fermenting-barrel'?'fût de fermentation':'réserve';
    const carried = snapshot?.piles.find(pile => pile.id === pawn.haul!.carryPileId);
    return pawn.haul.phase === 'pickup' ? `Prélèvement · ${pawn.haul.quantity} unités pour ${destination}`
      : `Livraison · ${carried?.quantity ?? pawn.haul.quantity} ${carried ? ITEM_DEFINITIONS[carried.item].label : 'unités'} → ${destination}`;
  }
  const specificActivity = snapshot && specificWorkActivity(snapshot, pawn);
  if (specificActivity) return specificActivity;
  const job = snapshot?.jobs.find(item => item.id === pawn.jobId);
  return job ? `${stateLabels[pawn.state]} · ${jobLabels[job.kind].toLocaleLowerCase('fr')}` : stateLabels[pawn.state];
}
function rebuildPawns(world: World) {
  colonistButtons.clear();
  el('colonists').replaceChildren(...world.pawns.filter(isColonist).map((pawn, index) => {
    const button = document.createElement('button');
    button.className = 'colonist'; button.dataset.pawn = String(pawn.id);
    button.innerHTML = `<span class="portrait portrait-generated"><span class="portrait-head"></span><span class="portrait-body"></span><span class="portrait-vest"></span><span class="pawn-symbol"></span></span><strong></strong><span class="pawn-mood"><i></i></span>`;
    button.onclick = event => selectPawns({ids:[pawn.id],additive:event.shiftKey,toggle:event.shiftKey},!event.shiftKey);
    colonistButtons.set(pawn.id, button);
    return button;
  }));
  el('work-rows').replaceChildren(...world.pawns.filter(p=>isColonist(p)&&!p.prisoner).map(pawn => {
    const row = document.createElement('tr'); row.dataset.worker = String(pawn.id);
    const name = document.createElement('th'); name.scope = 'row'; name.textContent = pawn.name; row.append(name);
    for (const {id: work, label} of workColumns) {
      const cell = document.createElement('td'), select = document.createElement('select');
      select.dataset.work = work; select.dataset.owner = String(pawn.id);
      select.setAttribute('aria-label', `Priorité ${label} ${pawn.name}`);
      for (let value = 0; value <= 4; value++) { const option = document.createElement('option'); option.value = String(value); option.textContent = String(value); select.append(option); }
      select.onchange = () => { void attempt(async () => { try { await client.command({ type: 'priority', pawnId: pawn.id, work, value: Number(select.value) }); } finally { renderState(); } }); };
      cell.append(select); row.append(cell);
    }
    const activity = document.createElement('td'); activity.className = 'work-activity'; row.append(activity); return row;
  }));
}
function updateWorkPanel(world: World, carriedPatients: ReadonlySet<number>): void {
  for (const pawn of world.pawns.filter(isColonist)) {
    const row = document.querySelector<HTMLElement>(`[data-worker="${pawn.id}"]`);
    if (!row) continue;
    updateWorkSkills(row,pawn);
    row.querySelector('.work-activity')!.textContent = actionLabel(pawn, carriedPatients);
    for (const select of row.querySelectorAll<HTMLSelectElement>('select')) {
      const work=select.dataset.work as WorkType;select.value=String(pawn.priorities[work]);
      updateBackgroundWorkControl(select,pawn,work);
    }
  }
}
function designateAnimalSlaughter(animalId:number,enabled:boolean):void {
  void attempt(async()=>{await client.command({type:'slaughter',animalId,enabled});renderState();});
}
function designateAnimalTraining(animalId:number,skill:'obedience'|'haul',wanted:boolean):void {
  void attempt(async()=>{await client.command({type:'animal-training',animalId,skill,wanted});renderState();});
}
async function updateAutoSlaughterPolicy(config:AutoSlaughterConfig):Promise<void> {
  await client.command({type:'auto-slaughter-policy',config});renderState();
}

function handleCommercialArrival(world:World):void {
  if(world.commercialTrip?.phase!=='at-post')return;
  const trip=world.commercialTrip,key=[world.seed,trip.pawn.id,trip.departedAt,trip.arrivedAt].join(':');
  if(key===lastCommercialArrivalKey)return;
  lastCommercialArrivalKey=key;
  worldTab='individual';if(nativeUi)setNativeWorldTab('individual');
  if(currentSpeed!==0)void client.setSpeed(0);
  if(currentPanel!=='menu')setPanel('world');
}
function renderState() {
  if(nativeUi){
    if(snapshot)handleCommercialArrival(snapshot);
    if(snapshot&&explorationEnabled256(snapshot)){
      const visible=new Set([...snapshot.pawns,...(snapshot.wildlife?.animals??[]),...(snapshot.mechanoids??[])].filter(actor=>knownPosition256(snapshot!,actor)).map(actor=>actor.id));
      const kept=new Set([...selection.ids].filter(id=>visible.has(id)));
      if(kept.size!==selection.ids.size){selection.ids=kept;selectedPawn=selection.single;nativeCustomPage=undefined;cancelNativeOrderPage();renderer?.setSelectedPawns(kept);}
    }
    refreshNativeUi();return;
  }
  caravanEncounterDialog261.update(snapshot??campaignOnly);
  if (!snapshot) {if(campaignOnly)renderCampaignOnly();return;}
  shell.classList.remove('campaign-only');
  const world = snapshot,food=confirmedFoodReadability()!;
  if(explorationEnabled256(world)){
    const visibleActors=new Set([...world.pawns,...(world.wildlife?.animals??[]),...(world.mechanoids??[])].filter(a=>knownPosition256(world,a)).map(a=>a.id));
    const keptActors=new Set([...selection.ids].filter(id=>visibleActors.has(id)));
    if(keptActors.size!==selection.ids.size){selection.ids=keptActors;selectedPawn=selection.single;renderer?.setSelectedPawns(selection.ids);rebuildInspector();}
    const keptObjects=selectedObjects.filter(o=>mapObjectExists(world,o));
    if(keptObjects.length!==selectedObjects.length){selectedObjects=keptObjects;selectedObject=selectedObjects[0];renderer?.setSelectedObjects(selectedObjects);rebuildInspector();}
  }
  syncArchitectAvailability();
  const colonists = world.pawns.filter(isColonist);
  const living = colonists.filter(pawn => pawn.state !== 'dead');
  const colonistIds = new Set(colonists.map(pawn => pawn.id));
  const selectedColonists = colonists.filter(pawn => selection.ids.has(pawn.id) && !pawn.prisoner);
  const carriedPatients = carriedPatientsOf(world);
  if(currentPanel==='animals')updateAnimalsPanel(el('animals-content'),world,id=>selectPawn(id),designateAnimalSlaughter,updateAutoSlaughterPolicy,designateAnimalTraining,animalAreaActions287);
  if(currentPanel==='wildlife')renderWildlife(world);
  if(currentPanel==='research')updateResearchPanel(el('research-content'),world,c=>void attempt(()=>client.command(c)),researchPanelActions);
  mapJumpTo.update(readJumpToEntries(world));
  if(currentPanel==='world')refreshWorldPanels(world);
  handleCommercialArrival(world);
  if(currentPanel==='schedule')scheduleUI.update(world);
  if(currentPanel==='assign'){foodPolicyUI.update(world,food);apparelPolicyUI.update(world);drugPolicyUI.update(world);} allowedAreaUI?.update(world);
  const totals = {blocks:0,medicine:0,silver:0,component:0,cloth:0,steel:0,chemfuel:0,gold:0,uranium:0,plasteel:0,'advanced-component':0,carried:0,delivered:0};
  const stockCounts = new Map<World['piles'][number]['item'],number>();
  for (const pile of world.piles) {
    if(!knownPile256(world,pile))continue;
    const owner = pile.owner;
    if (owner.type === 'job') totals.delivered += pile.quantity;
    const colony = owner.type === 'ground' || ('pawnId' in owner && colonistIds.has(owner.pawnId));
    if (!colony) continue;
    stockCounts.set(pile.item,(stockCounts.get(pile.item)??0)+pile.quantity);
    if (pile.kind === 'blocks') totals.blocks += pile.quantity;
    if (pile.kind === 'medicine') totals.medicine += pile.quantity;
    if (pile.item === 'silver') totals.silver += pile.quantity;
    if (pile.item === 'component') totals.component += pile.quantity;
    if (pile.item === 'cloth') totals.cloth += pile.quantity;
    if (pile.item === 'steel') totals.steel += pile.quantity;
    if (pile.item === 'chemfuel' || pile.item === 'gold' || pile.item === 'uranium' || pile.item === 'plasteel' || pile.item === 'advanced-component') totals[pile.item] += pile.quantity;
    if (owner.type === 'pawn') totals.carried += pile.quantity;
  }
  el('blocks').textContent=String(totals.blocks);
  el('medicine').textContent=String(totals.medicine);
  el('silver').textContent=String(totals.silver);
  el('component').textContent=String(totals.component);
  el('cloth').textContent=String(totals.cloth);el('cloth-stock').hidden=totals.cloth===0;
  el('steel').textContent=String(totals.steel);
  for(const item of ['chemfuel','gold','uranium','plasteel','advanced-component'] as const){el(item).textContent=String(totals[item]);el(`${item}-stock`).hidden=totals[item]===0;}
  el('wood').textContent = String(explorationEnabled256(world)?stockCounts.get('wood')??0:world.stock.wood); const nutrition = explorationEnabled256(world)?knownNutrition256(world):availableNutrition(world);el('food').textContent = nutrition.toFixed(1);
  const physicalFoodLabel=el('food').previousElementSibling;if(physicalFoodLabel)physicalFoodLabel.textContent='Stock physique';
  setTooltip(el('food').parentElement!,{title:'Stock physique de nutrition',body:'Compteur physique existant, indépendant des régimes. Il ne mesure ni fraîcheur, accès, réservation, partage ni autonomie.'});
  resourceLedger.update(stockCounts);
  const carried = totals.carried, delivered = totals.delivered;
  el('material-status').textContent = `${carried} portées · ${delivered} au chantier`;
  el('scenario-current').textContent=(world.scenario?SCENARIOS[world.scenario.id].label:'Partie historique · départ non renseigné')+(world.site?` · ${BIOME_LABELS[world.site.biome]} · ${HILLINESS_LABELS[world.site.hilliness]}`:'');
  el('biome-current').textContent=world.site?BIOME_LABELS[world.site.biome]:'Site historique';
  el('population').textContent = String(living.length); el('map-size').textContent = `${world.width} × ${world.height}`;
  siteHud.update(world,outdoorTemperature(world),weatherConditionLabel(world));
  const climateKey=world.climate?`${world.climate.adoptedAt}:${Math.floor(world.tick/TICKS_PER_DAY)}`:'historical';
  const climateRoot=el('climate-options');if(climateRoot.dataset.key!==climateKey){climateRoot.dataset.key=climateKey;climateRoot.replaceChildren(climateControls(world,c=>void attempt(()=>client.command(c))));}
  el('pause-banner').hidden = currentSpeed !== 0;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-speed]')) {
    const active = Number(button.dataset.speed) === currentSpeed;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  const signature = JSON.stringify(colonists.map(pawn => [pawn.id, pawn.name, !!pawn.prisoner]));
  if (signature !== pawnSignature) { pawnSignature = signature; rebuildPawns(world); }
  const equipment=equipmentProjection(world),apparel=apparelProjection(world);
  for (const pawn of colonists) {
    const button = colonistButtons.get(pawn.id)!;
    const rawLook=apparelAppearance(apparel.get(pawn.id)),look={...rawLook,color:rawLook.color??pawnBaseColor(pawn.id)};
    const url=portraitDataUrl(appearanceOf(pawn,world.seed),look,equipment.get(pawn.id)?.item,portraitExpressionOf(pawn),humanLimbVisualMask(pawn));
    const crisis=mentalCrisisView(world,pawn,s=>buildingLabels[s.kind]);
    updateColonistCard(button,{
      selected:selection.ids.has(pawn.id),drafted:!!pawn.draft,name:pawn.name,
      title:`${pawn.name} · ${actionLabel(pawn,carriedPatients)} · ${equipmentDescription(equipment.get(pawn.id),pawn)} · ${look.description}`,
      equipment:equipment.get(pawn.id)?.item??'',apparel:look.signature,portrait:url,
      bodyColor:look.color!==undefined?`#${look.color.toString(16)}`:'',vest:!!look.vest,
      symbol:pawn.state==='dead'?'†':pawn.state==='downed'?'!':crisis?crisis.symbol:pawn.state === 'sleeping' ? 'Z' : pawn.state === 'hungry' ? '!' : '',
      symbolLabel:crisis?`${crisis.label}${crisis.target?` · cible : ${crisis.target.label}`:''}`:'',
      mentalCrisis:crisis?.kind??'',symbolState:pawn.state==='dead'?'dead':pawn.state==='sleeping'?'sleep':'',mood:pawn.state==='dead'?0:pawn.mood,
    });
  }
  if (currentPanel === 'work') updateWorkPanel(world,carriedPatients);
  updateDraftControls(el('inspector'),selectedColonists);
  shootingControls.update(el('inspector'),selectedColonists);
  if(selectedObjects.length>1){objectGroupControls();}
  else if(selection.ids.size>1) {
    el('group-title').textContent=`${selection.ids.size} individus sélectionnés`;
    for(const button of el('group-members').querySelectorAll<HTMLButtonElement>('button')) {
      const pawn=world.pawns.find(p=>p.id===Number(button.dataset.groupPawn));
      const animal=world.wildlife?.animals.find(a=>a.id===Number(button.dataset.groupPawn));
      const mech=world.mechanoids?.find(m=>m.id===Number(button.dataset.groupPawn));
      const mechView=mech?mechanoidView(world,mech):undefined;
      button.textContent=pawn?`${pawn.name} · ${actionLabel(pawn,carriedPatients)}`:animal?`${animalSpecies(animal.species).label} ${animal.id}`:mechView?`${mechView.label} · ${mechView.action}`:'Individu absent';
    }
  } else if (selectedPawn !== undefined) {
    const pawn = world.pawns.find(item => item.id === selectedPawn);
    if(pawn){const look=apparelAppearance(apparel.get(pawn.id));updatePawnAppearanceInspection(el('inspector'),world,pawn,{...look,color:look.color??pawnBaseColor(pawn.id)},equipment.get(pawn.id)?.item);}
    if (!pawn) {const actor=world.mechanoids?.find(m=>m.id===selectedPawn);if(actor)updateMechanoidInspector(el('inspector'),{world,actor});else if(!updateAnimalInspector(el('inspector'),world,selectedPawn))clearSelection();}
    else if(pawn.prisoner){
      el('selected-name').textContent=pawn.name;el('selected-action').textContent=actionLabel(pawn,carriedPatients);
      updatePrisonerInspection(el('inspector'),world,pawn);
    }
    else if(!isColonist(pawn)){el('selected-name').textContent=pawn.name;el('selected-action').textContent=actionLabel(pawn,carriedPatients);}
    else {
      el('selected-name').textContent = pawn.name; el('selected-action').textContent = actionLabel(pawn,carriedPatients);
      el('selected-orders').textContent=`${pawn.orders.active!==null?'Travail imposé · ':''}${pawn.orders.queue.length} ordre(s) en file${pawn.priorityWork?` · Priorité case ${pawn.priorityWork.cell.x}, ${pawn.priorityWork.cell.z}`:''}`;
      el<HTMLButtonElement>('clear-orders').disabled=pawn.orders.active===null&&!pawn.orders.queue.length&&!pawn.priorityWork&&!pawn.animalRescue&&!pawn.openCasket&&!pawn.shipCasketTask277;
    }
    if(pawn){
      updatePawnInspection(el('inspector'),world,pawn,c=>void attempt(()=>client.command(c)));
      updateEquipmentInspection(el('inspector'),world,pawn);updateSkillsInspection(el('inspector'),pawn,world);updateHealthInspection(el('inspector'),pawn,world);
      updateRecreationInspection(el('inspector'),pawn,world);
      roomInspection.update(el('inspector'), world, pawn);
      updateMoodInspection(el('inspector'),world,pawn);
      updateSocialInspection(el('inspector'),world,pawn);
      updateJournalInspection(el('inspector'),world,pawn);
      setTooltip(el('selected-action'),{title:'Activité',body:coupleActivity285(world,pawn)?.description??queryPawnStatus(world,pawn,food).reason});
    }
  } else if (selectedCell) {
    const { x, z } = selectedCell;
    if (x >= world.width || z >= world.height || !selectedObject || !mapObjectExists(world,selectedObject)) clearSelection();
    else {
      const geyser=selectedObject.kind==='geyser'?geyserInspection256(world,selectedObject.id):undefined;
      const resource = selectedObject.kind==='resource'?world.resources.find(item=>item.id===selectedObject!.id):undefined;
      const structure = selectedObject.kind==='structure'?world.structures.find(item=>item.id===selectedObject!.id):undefined;
      const job = selectedObject.kind==='job'?world.jobs.find(item=>item.id===selectedObject!.id):structure||selectedObject.kind==='packed'?world.jobs.find(item=>item.furniture?.structureId===selectedObject!.id):undefined;
      const storageCell = selectedObject.kind==='stockpile'?world.stockpiles.find(item=>item.id===selectedObject!.id):undefined;
      const storage = storageCell??(structure&&isShelfKind(structure.kind)?structure.shelf?.settings:undefined);
      const pile = selectedObject.kind==='pile'?world.piles.find(item=>item.id===selectedObject!.id):undefined;
      const piles = pile?[pile]:[];
      const packed=selectedObject.kind==='packed'?world.packed.find(p=>p.building.id===selectedObject!.id&&p.owner.type==='ground'):undefined;
      if(structure||packed)updateFurnitureControls(el('inspector'),world,selectedCell,selectedObject.id);
      updateGatherSpotControls(el('inspector'),structure);
      updateFirefoamControls290(el('inspector'),world,structure);
      updateAnimalSpotControls(el('inspector'),world,structure,c=>void attempt(async()=>{await client.command(c);renderState();}));
      if(structure){updateDoorControls(el('inspector'),world,selectedCell);updatePenControls(el('inspector'),world,selectedCell);roomInspection.update(el('inspector'), world, selectedCell);}
      updateShelfInspection(el('inspector'),world,structure,id=>selectObjects([{kind:'pile',id}]));
      updateCryptosleepInspection271(el('inspector'),world,structure);
      updateShipCasketInspection277(el('inspector'),world,structure,c=>void attempt(()=>client.command(c)));
      updateShipReactorInspection275(el('inspector'),world,structure,c=>void attempt(()=>client.command(c)));
      updateShipAssemblyInspection276(el('inspector'),world,structure);
      const zone=selectedObject.kind==='growing'?world.growingZones.find(z=>z.id===selectedObject!.id):undefined;
      el('cell-title').textContent = geyser?geyser.title:packed ? `Meuble emballé · ${buildingLabels[packed.building.kind]}` : pile ? ITEM_DEFINITIONS[pile.item].label : structure ? buildingLabels[structure.kind] : resource ? (floraDefinition(resource)?.label??resourceLabels[resource.kind]) : job ? `${job.construction==='blueprint'?'Plan · ':job.construction==='frame'?'Cadre · ':''}${jobLabels[job.kind]}` : zone ? 'Zone de culture' : storage ? `Zone de stockage ${stockpileZoneId(storageCell!)}` : 'Massif rocheux';
      let cellDescription = geyser?geyser.description:resource ? (isPlant(resource)||resource.kind==='tree') ? plantInspection(world,resource) : `Quantité : ${resource.amount}` : pile ? `Quantité : ${pile.quantity}${pile.kind==='food'?` · ${foodFreshnessLabel(pile,world.tick)}`:pile.kind==='corpse'?` · ${{fresh:'Fraîche',rotting:'Pourrie (impropre à la boucherie)',desiccated:'Desséchée'}[corpseStage(pile,world.tick)]}`:''}` : structure ? `${structureFootprintLabel(structure)} cases` : job ? queryJobStatus(world,job).reason??'' : zone ? `Culture : ${growingPlantLabel291(zone.plant)} · ${zone.cells.length} cases${growingTemperatureInspection(world,selectedCell,zone.plant)}` : storage ? `Taille : ${stockpileZoneCells(world,storageCell!.id).length} cases` : '';
      if(pile&&isMinifiedTree(pile)){cellDescription=minifiedTreeDescription(pile,world.tick);if(pile.plantPack.pendingExpiry)el('cell-title').textContent='Arbre mort · restes en attente';}
      let cellHealth:CellHealth|undefined;
      const deterioration=pile?deteriorationInspection(world,pile):undefined;
      if(deterioration){cellDescription+=' · '+deterioration.summary;cellHealth=deterioration.health;}
      if(pile&&isMinifiedTree(pile))cellHealth={current:100-(pile.damage??0),maximum:100,label:'Emballage'};
      const inspectedBuilding=packed?.building??structure;
      if(inspectedBuilding&&inspectedBuilding.kind!=='sleeping-spot'){
        const maximum=structureMaxHp(inspectedBuilding),current=maximum-(inspectedBuilding.damage??0);
        if(maximum>0)cellHealth={current,maximum,label:'Résistance',valueText:`${current}/${maximum} PV`};
      }
      if(resource&&(isPlant(resource)||resource.kind==='tree')){
        const maximum=resourceMaxHp(resource);
        cellHealth={current:maximum-(resource.damage??0),maximum,label:'État'};
        cellDescription=cellDescription.replace(/ · État \d+\/\d+/, '');
      }
      if(inspectedBuilding?.kind==='firefoam-popper')cellDescription+=' · Diffuseur à usage unique · Détection accessible < 3 cases · Mousse à 9,9 cases · Reconstruction : 75 acier + 1 composant';
      if(inspectedBuilding?.kind==='spike-trap')cellDescription+=' · Usage unique · Risque allié : 0,5 % par entrée · Aucun effet sur les visiteurs neutres · Reconstruction : 45 matériaux';
      if(structure){const road=localRoadPropDescription256(structure);if(road)cellDescription+=' · '+road;}
      if(structure){const monument=ancientMonumentDescription256(structure);if(monument)cellDescription+=' · '+monument;}
      if(structure?.kind==='sandbags')cellDescription+=' · Couvert 55 % (selon la direction du tir) · Traversée ralentie, sans arrêt sur cette case';
      if(structure&&isBarrier(structure)){
        const current=barrierHp(structure),maximum=barrierMaxHp(structure);
        cellHealth={current,maximum,label:'Résistance',valueText:`${current}/${maximum} PV`};
        cellDescription+=` · ${world.home?.includes(z*world.width+x)?'Zone de foyer':'Hors zone de foyer (réparation désactivée)'}`;
      }
      const building = packed?.building ?? structure;
      if (building && building.kind!=='ship-cryptosleep-casket' && !isShipPartKind276(building.kind) && building.kind !== 'sleeping-spot' && building.kind !== 'animal-sleeping-spot' && building.kind !== 'grave' && building.kind !== 'butcher-spot' && building.kind !== 'crafting-spot' && building.kind !== 'campfire' && building.kind !== 'passive-cooler') el('cell-title').textContent += ` · ${ITEM_DEFINITIONS[building.material ?? 'wood'].label}${building.material === undefined ? ' (ancien)' : ''}`;
      const rock = selectedObject.kind==='rock'||resource?.kind==='rock'?rockInspection(world.tiles[z * world.width + x]!, resource):null;
      if (rock) {
        el('cell-title').textContent = rock.title; cellDescription = rock.description;
        if(selectedObject.kind==='rock'){
          const tile=world.tiles[z*world.width+x]!,maximum=rockMaxHP(tile);
          cellHealth={current:maximum-(tile.miningDamage??0),maximum,label:'Résistance'};
          cellDescription=cellDescription.replace(/^(?:Roche : )?\d+ \/ \d+ PV\. ?/, '');
        }
      }
      const weapon=piles.find(p=>p.kind==='weapon'||p.kind==='apparel'),egg=pile&&eggSpeciesForItem256(pile.item)?pile:undefined,permission=el<HTMLButtonElement>('weapon-permission');permission.hidden=!weapon&&!egg;
      if(egg){const forbidden=!!egg.eggForbidden;permission.textContent=forbidden?'Permettre cet œuf':'Interdire cet œuf';permission.onclick=()=>void attempt(()=>client.command({type:'egg-forbid',pileId:egg.id,forbidden:!forbidden}));}
      else if(weapon){const forbidden=!!(weapon.weapon??weapon.apparel)?.forbidden;permission.textContent=forbidden?'Autoriser cet objet':'Interdire cet objet';permission.onclick=()=>void attempt(()=>client.command({type:weapon.kind==='apparel'?'apparel-permission':'weapon-permission',itemId:weapon.id,allowed:forbidden}));}
      const plantOrder=(kind:'chop'|'harvest'|'cut')=>{if(resource)void attempt(()=>client.command({type:'designate',kind,x:resource.x,z:resource.z}));};
      const chop=el<HTMLButtonElement>('cell-chop'),harvest=el<HTMLButtonElement>('cell-harvest'),cut=el<HTMLButtonElement>('cell-cut');
      chop.hidden=!resource||!choppable(world,resource);harvest.hidden=!resource||!harvestable(world,resource);cut.hidden=!resource||!isPlant(resource);
      cut.textContent=resource?.blight?'Couper ce plant malade':resource?.kind==='tree'?'Couper':'Couper les plantes';
      let cutBlight=el('inspector').querySelector<HTMLButtonElement>('#cell-cut-blighted');
      if(!cutBlight){cutBlight=document.createElement('button');cutBlight.id='cell-cut-blighted';cutBlight.className='secondary-action';cutBlight.textContent='Couper tous les plants malades';cut.after(cutBlight);}
      cutBlight.hidden=!resource?.blight;
      cutBlight.onclick=()=>void attempt(()=>client.command({type:'cut-blighted-crops'}));
      chop.onclick=()=>plantOrder('chop');harvest.onclick=()=>plantOrder('harvest');cut.onclick=()=>plantOrder('cut');
      el('cell-materials').textContent = '';
      updateUnfinishedInspection(el('inspector'),world,pile?.prostheticWork273||pile?.smithingWork||pile?.unfinished||pile?.gunWork||pile?.artWork||pile?.flakWork||pile?.componentWork?pile:undefined,c=>void attempt(()=>client.command(c)));
      el('cell-job').textContent = job ? `${queryJobStatus(world, job).reason ?? 'En cours'}${constructionDeliveryLabel(world,job) ? ` · Livré : ${constructionDeliveryLabel(world,job)}` : ''}` : '';
      if(structure&&isBedKind(structure.kind))cellDescription += ` · Efficacité du repos : ${Math.round(bedRestEffectiveness(structure)*100)} % · Immunité : ${Math.round(bedImmunityFactor(structure,world)*100)} % · Soins : +${Math.round(bedTendOffset(structure,world)*100)} % · Chirurgie : ×${bedSurgeryFactor(structure,world).toLocaleString('fr-FR')} · Guérison du lit : +${bedHealPerDay(structure)} PV/jour Core`;
      if(structure)cellDescription+=vitalsMonitorInspection(world,structure);
      if(structure?.kind==='hopper')cellDescription+=nutrientPasteInspection(world,structure);
      updateCoolerControls(el('inspector'),world,structure,c=>void attempt(()=>client.command(c)));
      if(structure?.power)cellDescription+=powerInspection(world,structure,true);
      if(structure?.kind==='brewery'||structure?.kind==='fermenting-barrel')cellDescription+=` · ${brewingInspection265(world,structure)}`;
      if(structure)updatePowerControls(el('inspector'), world, selectedCell, c=>void attempt(()=>client.command(c)));
      if(structure?.kind==='butcher-table')cellDescription+=' · Boucherie : rendement du poste 100 %, compétence Cuisine';
      if(structure?.kind==='butcher-spot')cellDescription+=' · Boucherie : rendement du poste 70 %, compétence Cuisine';
      if(building?.art)cellDescription+=` · Qualité : ${QUALITY_LABELS[building.quality??'normal']} · Beauté une fois posée : ${structureBeauty(building).toLocaleString('fr-FR')} · Auteur : ${world.pawns.find(p=>p.id===building.art!.authorId)?.name??'inconnu'} · Sculpté au jour ${Math.floor(building.art.createdAt/6000)+1}.`;
      if(structure?.kind==='sleeping-spot')cellDescription+=' · Gratuit · Traversable · Couchage au sol sans bonus de chevet ou de commode · Ne remplace pas un abri.';
      if(structure?.kind==='animal-sleeping-spot')cellDescription+=' · Gratuit · Traversable · Couchage animal sans bonus de lit rembourré.';
      if(structure?.kind==='crafting-spot')cellDescription+=' · Gratuit · 60 tissus → tenue tribale · vitesse de poste 50 % · Artisanat.';
      if(structure?.kind==='stonecutter')cellDescription += ' · 1 fragment → 20 blocs · Artisanat.';
      if(structure?.kind==='horseshoes')cellDescription += ` · Dextérité · ${world.pawns.filter(p=>p.recreation.task?.buildingId===structure.id).length}/3 joueurs · places à 5 cases, ligne de vue dégagée.`;
      if(structure?.kind==='tube-television')cellDescription+=televisionInspection(world,structure);
      let inspectionIcon:UiIcon=structure||packed?'home':rock||storage?'blocks':zone||resource?'leaf':'layers';
      if(pile){
        inspectionIcon=pile.item==='nutrient-paste-meal'||pile.item==='simple-meal'||pile.item==='fine-meal'||pile.item==='vegetarian-fine-meal'||pile.item==='carnivore-fine-meal'||pile.item==='lavish-meal'||pile.item==='vegetarian-lavish-meal'||pile.item==='carnivore-lavish-meal'||pile.item==='survival-meal'?'meal'
          :pile.kind==='food'?'food':pile.kind==='medicine'?'medicine'
          :pile.kind==='wood'?'wood':pile.kind==='steel'?'steel'
          :pile.kind==='component'||pile.kind==='advanced-component'?'component'
          :pile.kind==='silver'?'silver':pile.kind==='chunk'||pile.kind==='blocks'?'blocks':'layers';
      }
      const tile=world.tiles[z*world.width+x];
      const illustration=structure?.kind??packed?.building.kind??(pile&&!['corpse','mech-corpse'].includes(pile.kind)?`item-${pile.item}`:undefined)
        ??(resource?`resource-${resource.species??resource.kind}`:undefined)
        ??(selectedObject.kind==='rock'?`mountain-${tile?.ore??tile?.stone??'granite'}`:undefined)
        ??(zone?'growing':storage?'stockpile':job?.tree?job.kind:job&&Object.hasOwn(STRUCTURE_DEFINITIONS,job.kind)?job.kind:undefined);
      presentCellDescription(el('inspector'), cellDescription, inspectionIcon, cellHealth,illustration);
      if(structure?.fuel)updateFireControls(el('inspector'),structure);
      updateMiniTurretControls(el('inspector'),world,structure,c=>void attempt(async()=>{await client.command(c);renderState();}));
      if(structure&&stationRecipe(structure))updateBillControls(el('inspector'),structure,world);
      el('cell-deconstruct').hidden=!structure||!!job&&job.kind!=='repair'&&job.kind!=='fix-breakdown'&&job.kind!=='flick';
      el('cell-deconstruct').onclick=()=>{if(structure)void attempt(()=>client.command({type:'designate',kind:'deconstruct',targetId:structure.id,x:structure.x,z:structure.z}));};
      // The coordinate command must resolve to the intent shown in this inspector.
      const cancelTarget=job&&(world.jobs.find(item=>footprintCells(item).some(cell=>cell.x===x&&cell.z===z))??furnitureIntentAt(world,selectedCell));
      el('cell-cancel').hidden=!job||job.kind==='repair'||job.kind==='fix-breakdown'||cancelTarget?.id!==job.id||selectedObject.kind!=='job'&&job.furniture?.structureId!==selectedObject.id;
      const offered=mapObjectActions(world,selectedObject);
      for(const id of ['material-permission','mine','haul-chunks','chop','harvest','cut','extract','replant','deconstruct','cancel'] as const){
        const button=el<HTMLButtonElement>(`cell-${id}`),action=offered.find(a=>a.id===id);button.hidden=!action;
        if(action){
          if(id==='material-permission'||id==='extract'||id==='replant'){
            if(button.dataset.actionLabel!==action.label){const icon=document.createElement('span');icon.className='ui-icon';icon.setAttribute('aria-hidden','true');icon.style.backgroundImage=`url('${pictogramDataUrl(id==='material-permission'?(action.label==='Autoriser'?'allow':'forbid'):id)}')`;icon.style.backgroundSize='contain';icon.style.backgroundPosition='center';icon.style.backgroundRepeat='no-repeat';const label=document.createElement('span');label.textContent=action.label;button.replaceChildren(icon,label);button.dataset.actionLabel=action.label;}
          }else button.textContent=action.label;
          button.onclick=()=>void attempt(async()=>{
          if(!snapshot||!selectedObject)return;
          const current=mapObjectActions(snapshot,selectedObject).find(a=>a.id===id);if(current?.command)await client.command(current.command);else if(current?.placementPileId!==undefined)beginTreePlacement(current.placementPileId);
          renderState();
        });}
      }
      el('cell-storage').hidden = !storage;
      if(structure)updateBedControls(el('inspector'),world,structure);
      if(storage&&!selectedStoragePending)selectedStorageControls?.show(storage);
      selectedLinkedStorage?.update();
      if(selectedStorageControls)selectedStorageControls.element.inert=!!selectedLinkedStorage?.pending;
      const storagePaste=el('inspector').querySelector<HTMLButtonElement>('[data-zone-action="paste"]');
      if(storagePaste){storagePaste.disabled=!storageClipboard||!!selectedLinkedStorage?.pending;
        if(structure&&isShelfKind(structure.kind))setTooltip(storagePaste,{body:linkedStoragePasteScope286(world,structure.id)});}
    }
  }
  if(currentPanel===null){const target=selectedPawn===undefined?selectedObject?.kind==='pile'&&world.piles.some(p=>p.id===selectedObject!.id&&p.humanCorpse)||selectedObject?.kind==='structure'&&world.structures.some(s=>s.id===selectedObject!.id&&s.kind==='grave')?selectedCell:undefined:world.pawns.find(p=>p.id===selectedPawn);
    updateBurialControls(el('inspector'),world,target,c=>void attempt(()=>client.command(c)));
    updateHygieneControls(el('inspector'),world,selectedPawn===undefined?undefined:target,c=>void attempt(()=>client.command(c)));}
  if (colonistInspector && selectedPawn !== undefined && el('inspector').classList.contains('colonist-inspector-host')) {
    const pawn = world.pawns.find(p => p.id === selectedPawn);
    if (pawn) { colonistInspector = colonistInspectorState(colonistInspector, pawn.id, !!pawn.prisoner); updateColonistInspector(el('inspector'), colonistInspector, !!pawn.prisoner); }
  }
  const pending = world.jobs.filter(job => job.status === 'pending').length;
  el('job-count').textContent = world.jobs.length ? `${world.jobs.length} ordre(s) · ${pending} en attente` : 'Aucun ordre en cours';
  const entries = world.events.slice(-30).reverse();
  const historySignature=JSON.stringify(entries.map(entry=>[entry.tick,entry.message]));
  if(historySignature!==lastColonyHistorySignature){
    lastColonyHistorySignature=historySignature;
    el('journal-items').replaceChildren(...entries.map(entry => {
      const item = document.createElement('p'), time = document.createElement('span'); time.className = 'event-time';
      time.textContent = `J${1 + Math.floor(entry.tick / TICKS_PER_DAY)} · `;
      item.append(time, document.createTextNode(entry.message)); return item;
    }));
    if (!entries.length) el('journal-items').textContent = 'Trois survivants. Une nouvelle histoire.';
  }
  statusAlerts.update(world,food);
  startingArrivalUI.update(world,currentSpeed);
  syncFirstDayGuide();
  economyUI.update(world);arrivalUI.update(world);questUI.update(world);raidUI.update(world);heatwaveUI.update(world);flashstormUI.update(world);solarFlareUI.update(world);weatherConditionUI.update(world);shortCircuitUI.update(world);tradeUI.update(world);orbitalUI.update(world);
}
function focusNotification(target:NotificationTarget):void {
  if(snapshot&&!knownNotificationTarget256(snapshot,target))return;
  if(!snapshot||replacingWorld||frontMenu.isOpen())return;
  shootingControls.cancel();applyTool('select');
  if(target.kind==='actor'){selectPawn(target.id);return;}
  if(target.kind==='object'){
    if(!mapObjectExists(snapshot,target.object))return;
    selectObjects([target.object]);
  }else {clearSelection();setPanel(null);}
  renderer?.focusCell(target.cell);
}
let campaignFocusBusy=false,campaignPresentationEpoch=0;
async function viewUrgentThreat(target:UrgentThreatTarget):Promise<string|undefined> {
 deferredResumeGuard.cancel();menuResumeSpeed=undefined;
 if(campaignFocusBusy||replacingWorld||frontMenu.isOpen())return 'La carte attend la fin de l’opération en cours.';
 const current=campaignState(),before=current?campaignUIFacts(current):undefined;
 const mapId='mapId' in target?target.mapId:target.site==='home'?0:before?.maps.find(map=>map.kind==='legacy-site')?.id;
 if(mapId===undefined||!before?.maps.some(map=>map.id===mapId))return 'Cette carte n’est plus disponible.';
 campaignFocusBusy=true;
 try{
  if(before.activeMapId!==mapId){
   const record=before.maps.find(map=>map.id===mapId)!,epoch=campaignPresentationEpoch;
   await sendCampaignCommand({type:'map-view',mapId});
   const state=campaignState(),map=state?campaignUIFacts(state):undefined;
   if(!map||map.activeMapId!==mapId||map.maps.find(map=>map.id===mapId)?.createdAt!==record.createdAt||campaignPresentationEpoch<=epoch)return 'La carte demandée n’a pas encore été adoptée.';
  }
  await ensureActiveMapView();
  const next=snapshot;if(!next)return 'La carte n’est pas disponible.';
  const id=target.actorId;if(id===undefined)return; // Map-only Camp warning has no invented actor target.
  const person=next.pawns.find(p=>p.id===id);
  if(!person&&!next.mechanoids?.some(m=>m.id===id)&&!next.wildlife?.animals.some(a=>a.id===id))return 'La dernière cible de cette arrivée n’est plus présente sur la carte.';
  focusNotification({key:`actor:${id}`,kind:'actor',id});
  if(person?.state==='downed')document.querySelector<HTMLButtonElement>('[data-colonist-tab="health"]')?.click();
  return undefined;
 }finally{campaignFocusBusy=false;}
}
const urgentThreatUI=createUrgentThreatFeedback(el('alerts'),{view:viewUrgentThreat,mapName:id=>{const state=campaignState(),map=state?campaignUIFacts(state)?.maps.find(map=>map.id===id):undefined;return map?mapDisplayName(map):`Carte ${id}`;}});
function receiveMainUrgentThreats(receipt:UrgentThreatReceipt):void {
 if(receipt.paused){deferredResumeGuard.confirm(true);menuResumeSpeed=undefined;}
 if(nativeUi&&receipt.rows.length){
  const prior=nativeCustomPage,id=`native-threat-${receipt.generation}-${receipt.serial}`;
  const close=()=>{if(nativeCustomPage?.id!==id)return;nativeCustomPage=prior;if(frontMenu.isOpen())frontMenu.showHome(session.hasWorld);else refreshNativeUi();};
  nativeCustomPage={id,title:receipt.rows.length>1?'Nouvelles menaces':'Nouvelle menace',subtitle:receipt.paused?'Jeu mis en pause. Fermez cet avertissement puis reprenez avec les commandes de temps.':'La simulation suit la vitesse choisie.',
    rows:receipt.rows.map((row,index)=>({id:`native-threat-row-${index}`,label:urgentThreatLabel(row,mapId=>{const state=campaignState(),map=state?campaignUIFacts(state)?.maps.find(map=>map.id===mapId):undefined;return map?mapDisplayName(map):`Carte ${mapId}`;}),controls:[{id:`native-threat-view-${index}`,label:'Voir la carte',onActivate:async()=>{const reason=await viewUrgentThreat({...typeof row.mapId==='number'?{mapId:row.mapId}:{site:row.site},...row.actorId===undefined?{}:{actorId:row.actorId}});if(reason)throw Error(reason);}}]})),
    actions:[{id:'native-threat-close',label:'Fermer',onActivate:close}],onClose:close};
  nativeUi.showPage(nativeCustomPage);
 }else urgentThreatUI.show(receipt);
 if(soundEnabled)audio.playInterface('ui.threat');
}
const statusAlerts=createStatusAlerts(el('status-alerts'),{
  'inspect-threat':el<HTMLButtonElement>('inspect-threat'),'inspect-fire':el<HTMLButtonElement>('inspect-fire'),'inspect-blight':el<HTMLButtonElement>('inspect-blight'),
},{focus:focusNotification,campaign:target=>{void attempt(async()=>{const reason=await viewUrgentThreat(target);if(reason)throw Error(reason);});},context:context=>{
  if(context.tool){setTool(context.tool);return;}
  if(context.worldTab)worldTab=context.worldTab;
  void attempt(async()=>{await switchPanel(context.panel);if(context.category)setCategory(context.category);});
},tab:tab=>document.querySelector<HTMLButtonElement>(`[data-colonist-tab="${tab}"]`)?.click()});
const learningReadout=document.querySelector<HTMLDetailsElement>('.learning-readout')!;
const startingArrivalUI=createStartingArrivalUI(document.querySelector<HTMLElement>('.game-shell')!,{onResume:()=>void attempt(()=>changeSpeed(1))});
function performFirstDayGuideAction(action:import('./ui/first-day-guide').FirstDayGuideAction):void {
  learningReadout.open=false;firstDayGuide.setActive(false);
  if(action.target){
    focusNotification(action.target);
    if(action.tab&&action.target.kind==='actor')document.querySelector<HTMLButtonElement>(`[data-colonist-tab="${action.tab}"]`)?.click();
    return;
  }
  if(action.mapTools){el<HTMLButtonElement>(`${action.mapTools}-open`).click();return;}
  if(action.tool){setTool(action.tool);return;}
  if(action.worldTab)worldTab=action.worldTab;
  if(action.panel)void attempt(async()=>{await switchPanel(action.panel!);if(action.category)setCategory(action.category);});
}
const firstDayGuide=createFirstDayGuide(el('first-day-guide'),{onAction:performFirstDayGuideAction});
firstGesturesLearning=createFirstGesturesLearning({
  read:()=>localStorage.getItem(FIRST_GESTURES_STORAGE_KEY),
  write:value=>localStorage.setItem(FIRST_GESTURES_STORAGE_KEY,value),
  changed:()=>syncFirstDayGuide(),
});
const firstGesturesGuide=createFirstGesturesGuide(el('first-gestures-guide'),{learning:firstGesturesLearning,onAction:action=>{
  if(action.tool){learningReadout.open=false;firstDayGuide.setActive(false);firstGesturesGuide.setActive(false);setTool(action.tool);return;}
  performFirstDayGuideAction(action);
}});
function syncFirstDayGuide():void {
  if(nativeUi)return;
  const pending=!!snapshot?.startingArrival&&snapshot.startingArrival.phase!=='opened';
  if(guideAfterStartingArrival&&!pending&&!frontMenu.isOpen()&&!replacingWorld){guideAfterStartingArrival=false;learningReadout.open=true;}
  firstDayGuide.setActive(learningReadout.open&&!pending&&!frontMenu.isOpen()&&!replacingWorld);
  firstGesturesGuide.setActive(learningReadout.open&&!pending&&!frontMenu.isOpen()&&!replacingWorld&&!!snapshot);
  const learning=firstGesturesLearning?.state,summary=learningReadout.querySelector('summary')!;
  const label=learning?.enabled?`Conseils · ${Object.keys(learning.learned).length}/4 gestes`:'Conseils';
  if(summary.textContent!==label)summary.textContent=label;
  if(snapshot)firstDayGuide.update(snapshot,confirmedFoodReadability());
}
learningReadout.addEventListener('toggle',syncFirstDayGuide);
const heatwaveUI=createHeatwaveUI(command=>client.command(command),focusNotification);
const flashstormUI=createFlashstormUI(focusNotification);
const solarFlareUI=createSolarFlareUI();
const weatherConditionUI=createWeatherConditionUI(focusNotification);
const shortCircuitUI=createShortCircuitUI(focusNotification);
const economyUI=createColonyEconomyUI(el('colony-economy'),command=>client.command(command));
const raidUI=createRaidUI(command=>client.command(command),focusNotification);
let orbitalResumeRevision=0,tradeResumeRevision=0;
const orbitalUI=createOrbitalTradeUI(command=>{orbitalResumeRevision=deferredResumeGuard.capture();return client.command(command);},()=>client.setSpeed(0),id=>{const console=snapshot?.structures.find(s=>s.id===id);if(console)renderer?.focusCell(console);},async()=>{if(currentSpeed===0&&deferredResumeGuard.allows(orbitalResumeRevision))await client.setSpeed(1);});
const tradeUI=createTradeUI(command=>{tradeResumeRevision=deferredResumeGuard.capture();return client.command(command);},()=>client.setSpeed(0),id=>selectPawn(id),async()=>{if(currentSpeed===0&&deferredResumeGuard.allows(tradeResumeRevision))await client.setSpeed(1);});
let nativeTradeResumeRevision=0;
const nativeLocalTrade:ReturnType<typeof createNativeLocalTrade>|undefined=nativeUi?createNativeLocalTrade({
  readState:readNativeState,command:command=>{nativeTradeResumeRevision=deferredResumeGuard.capture();return client.command(command);},
  pause:()=>client.setSpeed(0),resume:async()=>{if(currentSpeed===0&&deferredResumeGuard.allows(nativeTradeResumeRevision))await client.setSpeed(1);},
  show:page=>{nativeCustomPage=page;nativeUi!.showPage(page);},close:()=>{nativeCustomPage=undefined;refreshNativeUi();},
  isCurrent:()=>!!nativeLocalTrade?.ownsPage(nativeCustomPage?.id),focusPawn:id=>renderer?.focusPawn(id),focusCell:cell=>renderer?.focusCell(cell),
}):undefined;
let nativeFactionResumeRevision298=0;
const nativeFactionComms298:ReturnType<typeof createNativeFactionComms298>|undefined=nativeUi?createNativeFactionComms298({
  readState:readNativeState,command:command=>{nativeFactionResumeRevision298=deferredResumeGuard.capture();return client.command(command);},
  pause:()=>client.setSpeed(0),resume:async()=>{if(currentSpeed===0&&deferredResumeGuard.allows(nativeFactionResumeRevision298))await client.setSpeed(1);},
  show:page=>{nativeCustomPage=page;nativeUi!.showPage(page);},close:()=>{nativeCustomPage=undefined;refreshNativeUi();},
  isCurrent:()=>!!nativeFactionComms298?.ownsPage(nativeCustomPage?.id),focusPawn:id=>renderer?.focusPawn(id),focusCell:cell=>renderer?.focusCell(cell),
}):undefined;
const arrivalUI=createArrivalUI(command=>client.command(command));
const questUI=createQuestUI(command=>client.command(command));
function syncStorageButtons() {
  nativeUi?.notifyCountdownFrameEligibility298();
  if(nativeUi){shell.inert=replacingWorld||frontMenu.isOpen()||!campaignState()||simulationStopped||graphicsFault||graphicsRecovering||waitingRequests.size>0;return;}
  syncFirstDayGuide();
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]')){if(button.dataset.mapOriginalDisabled===undefined){button.dataset.mapOriginalDisabled=String(button.disabled);button.dataset.mapOriginalTitle=button.title;}const local=!['world','menu','quests'].includes(button.dataset.panel??'');button.disabled=button.dataset.mapOriginalDisabled==='true'||local&&!snapshot;button.title=local&&!snapshot?'Affichez une carte locale pour ouvrir ce panneau.':button.dataset.mapOriginalTitle??'';}
  groupUI.setHostBlocked(groupCommandsBlocked());mapRegistry.setBlocked(groupCommandsBlocked());mapJumpTo.setBlocked(groupCommandsBlocked());
  shell.inert = replacingWorld || frontMenu.isOpen() || !campaignState() || simulationStopped || graphicsFault || graphicsRecovering || waitingRequests.size > 0;
  for(const button of document.querySelectorAll<HTMLButtonElement>('[data-speed]'))button.disabled=replacingWorld||currentPanel==='menu';
  for (const [id, key] of [['load', SAVE_KEY], ['restore-previous', PREVIOUS_KEY]]) {
    try { el<HTMLButtonElement>(id).disabled = replacingWorld || session.busy || !saveRepository.peekItem(key!); } catch { el<HTMLButtonElement>(id).disabled = true; }
  }
  el<HTMLButtonElement>('save').disabled=replacingWorld||session.busy||!campaignState()||simulationStopped;
  saveManager?.setBlocked(replacingWorld||session.busy||!campaignState()||simulationStopped||waitingRequests.size>0);
  updateIncident();
}
async function save() {
  if (session.busy || replacingWorld) return;
  const saving = session.save(); syncStorageButtons();
  try { await saving; autosaveScheduler.noteSaved(session.generation,campaignState()?.tick??0);notify('Colonie sauvegardée dans ce navigateur.'); }
  finally { syncStorageButtons(); }
}
async function load(key = SAVE_KEY) {
  if (session.busy || replacingWorld) return;
  await replaceColony(() => session.load(key));
  notify(key === PREVIOUS_KEY ? 'Colonie précédente restaurée en pause.' : 'Sauvegarde rechargée en pause.');
}
async function exportCurrentColony():Promise<void> {
  if(replacingWorld)throw new Error('Attendez la fin du chargement avant d’exporter.');
  const saving=session.exportSave();syncStorageButtons();
  try {
    const raw=await saving;
    const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;
    anchor.download=`Elsewhere-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
    document.body.append(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  } finally {syncStorageButtons();}
}
saveManager=createSaveManager(el('save-management'),{
  getSaves:()=>saveStorageReady?session.saves():[],
  onSaveNamed:async(label,key,revision)=>{
    const saving=session.saveNamed(label,key,revision);syncStorageButtons();
    try{await saving;autosaveScheduler.noteSaved(session.generation,campaignState()?.tick??0);}
    finally{syncStorageButtons();}
  },
  onDelete:async(key,revision)=>{
    const removing=session.deleteSave(key,revision);syncStorageButtons();
    try{await removing;}finally{syncStorageButtons();}
  },
  onExport:exportCurrentColony,
  getAutosaveMinutes:()=>autosaveIntervalMinutes,onAutosaveMinutesChange:setAutosaveMinutes,
  onChanged:syncStorageButtons,
});
// Explicit scenario URLs retain the historical diagnostic creation dialog.
async function createWorld() {
  if (session.busy || replacingWorld) return;
  const seed=Number(el<HTMLInputElement>('world-seed').value), size=Number(el<HTMLSelectElement>('world-size').value);
  const scenario=el<HTMLSelectElement>('world-scenario').value as ScenarioId;
  el('new-world-error').hidden=true;
  try {
    await replaceColony(() => session.create(seed,size,scenario));
    el<HTMLDialogElement>('new-world-dialog').close();
  } catch (error) {
    el('new-world-error').textContent=error instanceof Error ? error.message : String(error);
    el('new-world-error').hidden=false;
  }
}
async function changeSpeed(speed: number,token?:ThreatPauseToken) { if (currentPanel==='menu'||graphicsFault||simulationStopped||waitingRequests.size>0) return; if (speed > 0) lastSpeed = speed; await client.setSpeed(speed,token?{explicit:true,token}:undefined); }
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) button.onclick = () => setTool(button.dataset.tool as Tool);
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-category]')) button.onclick = () => { setCategory(button.dataset.category as ArchitectCategory); applyTool('select'); };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-panel]:not(:disabled)')) button.onclick = () => { const panel = button.dataset.panel as Panel; void attempt(() => switchPanel(currentPanel === panel ? null : panel)); };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-guide-panel]')) button.onclick = () => { const panel = button.dataset.guidePanel as Panel; document.querySelector('.learning-readout')?.removeAttribute('open'); void attempt(() => switchPanel(panel)); };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-guide-map-tools]')) button.onclick = () => {
  document.querySelector('.learning-readout')?.removeAttribute('open');
  el<HTMLButtonElement>(`${button.dataset.guideMapTools}-open`).click();
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close-panel]')) button.onclick = () => {
  const preserveTool = currentPanel === 'architect' && currentTool !== 'select';
  void attempt(() => switchPanel(null, preserveTool));
};
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-speed]')) button.onclick = () => { const token=client.getThreatPauseToken(),speed=Number(button.dataset.speed);void attempt(() => changeSpeed(speed,token)); };
el('save').onclick = () => { void attempt(save); }; el('load').onclick = () => { void attempt(() => load()); };
el('restore-previous').onclick = () => { void attempt(() => load(PREVIOUS_KEY)); };
el('browse-saves').onclick = () => { void attempt(() => openFront('load')); };
el('help-open').onclick = openHelp;
el('new-colony').onclick = () => { if (diagnosticStart) el<HTMLDialogElement>('new-world-dialog').showModal(); else void attempt(() => openFront('create')); };
el('return-home').onclick = () => { void attempt(async () => { await save(); await openFront('home'); }); };
function updateScenarioDescription():void {
  const id=el<HTMLSelectElement>('world-scenario').value as ScenarioId;
  el('scenario-description').textContent=SCENARIOS[id].description;
}
el('world-scenario').onchange=updateScenarioDescription;
el('new-world-close').onclick = () => el<HTMLDialogElement>('new-world-dialog').close();
el('new-world-form').onsubmit = event => { event.preventDefault(); void attempt(createWorld); };
el('show-diagnostics').onclick = () => { const hidden = !el('metrics').hidden; el('metrics').hidden = hidden; el('show-diagnostics').textContent = hidden ? 'Afficher les diagnostics' : 'Masquer les diagnostics'; };
textureToggle.onchange = () => { if (!setTexturesEnabled(textureToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
designationSlider.oninput=()=>{if(!setDesignationMinCellPixels(Number(designationSlider.value)))notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true);};
itemLabelSlider.oninput=()=>{if(!setItemLabelMinCellPixels(Number(itemLabelSlider.value)))notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true);};
fontSelect.onchange=()=>setUiFontPreference(fontSelect.value as UiFontId);
decorOcclusionToggle.onchange=()=>{if(!setDecorOcclusionPreference(decorOcclusionToggle.checked))notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true);};
groundGrassToggle.onchange = () => { if (!setGroundGrassEnabled(groundGrassToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
dioramaToggle.onchange = () => { if (!setDioramaEnabled(dioramaToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
roomToggle.onchange = () => { if (!setRoomEnabled(roomToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
for (const { key, slider } of lightingSliders) slider.oninput = () => {
  if (!setLightingSettings({ ...lightingSettings, [key]: Number(slider.value) / 100 })) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true);
};
el<HTMLButtonElement>('lighting-reset').onclick = () => {
  if (!setLightingSettings({ ...DEFAULT_LIGHTING_SETTINGS })) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true);
};
const settlementsSelect=el<HTMLSelectElement>('max-settlements');syncSettlementLimitControls();
settlementsSelect.onchange=()=>{const value=Number(settlementsSelect.value) as SettlementLimit;void attempt(async()=>{if(!await settlementPreference.set(value))notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true);});};
const threatPauseSelect=el<HTMLSelectElement>('threat-pause-mode');syncThreatPauseControls();
threatPauseSelect.onchange=()=>{const mode=threatPauseSelect.value as ThreatPauseMode;void attempt(async()=>{if(!await threatPausePreference.set(mode))notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.',true);});};
const soundToggle = el<HTMLInputElement>('sound-enabled');
const soundVolumeSlider = el<HTMLInputElement>('sound-volume');
soundToggle.checked = soundEnabled;
soundVolumeSlider.value = String(Math.round(soundVolume * 100));
soundToggle.onchange = () => { if (!setSoundEnabled(soundToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
soundVolumeSlider.oninput = () => { if (!setSoundVolume(Number(soundVolumeSlider.value) / 100)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
const musicToggle = el<HTMLInputElement>('music-enabled');
const musicVolumeSlider = el<HTMLInputElement>('music-volume');
musicToggle.checked = musicEnabled;
musicVolumeSlider.value = String(Math.round(musicVolume * 100));
musicToggle.onchange = () => { if (!setMusicEnabled(musicToggle.checked)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
musicVolumeSlider.oninput = () => { if (!setMusicVolume(Number(musicVolumeSlider.value) / 100)) notify('Le choix s’applique maintenant, mais ce navigateur ne peut pas le conserver pour la prochaine visite.', true); };
const testSoundButton = el<HTMLButtonElement>('test-sound');
const testSoundStatus = el<HTMLElement>('test-sound-status');
testSoundButton.onclick = () => {
  testSoundButton.disabled = true;
  testSoundStatus.textContent = 'Chargement du son d’essai…';
  void audio.playPreview().then(() => {
    testSoundStatus.textContent = 'Son d’essai lancé. Vérifiez le volume de votre appareil si vous ne l’entendez pas.';
  }).catch(error => {
    testSoundStatus.textContent = error instanceof Error ? error.message : 'Le son d’essai a échoué.';
  }).finally(() => { testSoundButton.disabled = false; });
};
// Resume directly from any later user gesture too: the browser/device can suspend an unlocked context.
const audioGestureRoot = document.querySelector<HTMLElement>('#app')!;
audioGestureRoot.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') { unlockAudioFromGesture(); music.unlock(); } }, { capture: true });
audioGestureRoot.addEventListener('pointerup', event => { if (event.pointerType !== 'mouse') { unlockAudioFromGesture(); music.unlock(); } }, { capture: true });
document.addEventListener('keydown', event => { if (!event.repeat) { unlockAudioFromGesture(); music.unlock(); } }, { capture: true });
audioGestureRoot.addEventListener('click', event => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.disabled || button.id === 'test-sound' || button.id === 'front-test-sound') return;
  const panelButton = button.matches('[data-panel], [data-guide-panel], [data-close-panel], .front-back, .front-next');
  audio.playInterface(panelButton ? 'ui.panel' : 'ui.click');
}, { capture: true });
document.addEventListener('visibilitychange', () => { music.setHidden(document.hidden); audio.setHidden(document.hidden); });
function setViewControlLabel(id:string,label:string):void {
  const button=el<HTMLButtonElement>(id);
  button.querySelector<HTMLElement>('.view-control-label')!.textContent=label;
  button.setAttribute('aria-label',label);
}
el('wall-cutaway').onclick = () => { wallCutaway = !wallCutaway; renderer?.setWallCutaway(wallCutaway); setViewControlLabel('wall-cutaway',wallCutaway ? 'Murs : coupés' : 'Murs : hauts'); el('wall-cutaway').setAttribute('aria-pressed', String(wallCutaway)); };
el('roof-toggle').onclick=()=>{const button=el('roof-toggle'),visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));setViewControlLabel('roof-toggle',visible?'Toits : visibles':'Toits : masqués');renderer?.setRoofsVisible(visible);};
el('foliage-toggle').onclick = () => { foliageVisible = !foliageVisible; renderer?.setFoliageVisible(foliageVisible); setViewControlLabel('foliage-toggle',foliageVisible ? 'Feuillage' : 'Troncs'); el('foliage-toggle').setAttribute('aria-pressed', String(!foliageVisible)); };
el('zones-toggle').onclick=()=>{const button=el('zones-toggle'),visible=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(visible));setViewControlLabel('zones-toggle',visible?'Zones : visibles':'Zones : masquées');renderer?.setZonesVisible(visible);};
el('view-home').onclick = () => { const pawn = snapshot?.pawns[0]; if (pawn) renderer?.focusPawn(pawn.id); };
el('camera-mode').onclick = () => {
  const perspective = renderer?.toggleCameraMode() === 'perspective';
  setViewControlLabel('camera-mode',perspective ? 'Vue : perspective' : 'Vue : iso');
  el('camera-mode').setAttribute('aria-pressed', String(perspective));
  el('camera-mode').title = `Basculer en ${perspective ? 'vue isométrique' : 'perspective'} ; glisser avec le bouton droit pour tourner`;
};
el('rotate-building').onclick = () => rotatePlacement();
syncStorageButtons(); setCategory(currentCategory); applyTool('select');
window.addEventListener('pointermove',event=>{
  mapPointerX=event.clientX;mapPointerY=event.clientY;
  if(altInspectorHeld)positionMapCellDetails();
},{passive:true});
window.addEventListener('keydown',event=>{
  if(event.key!=='Alt'||frontMenu.isOpen()||!snapshot||replacingWorld||document.querySelector('dialog[open]'))return;
  if(event.target instanceof Element&&event.target.closest('#world-panel'))return;
  altInspectorHeld=true;event.preventDefault();updateMapCellDetails(true);
},true);
window.addEventListener('keyup',event=>{
  if(event.key==='Alt'){altInspectorHeld=false;updateMapCellDetails(true);}
},true);
window.addEventListener('blur',()=>{altInspectorHeld=false;updateMapCellDetails(true);});
document.addEventListener('keydown', event => {
  if(event.defaultPrevented || frontMenu.isOpen() || !campaignState() || replacingWorld || graphicsFault || simulationStopped || waitingRequests.size>0)return;
  if(document.getElementById('orbital-dialog') instanceof HTMLDialogElement&&(document.getElementById('orbital-dialog') as HTMLDialogElement).open&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void attempt(save);return;}
  if (document.querySelector('dialog[open]')) return;
  if(event.key==='F8'){event.preventDefault();worldTab='maps';setPanel(currentPanel==='world'?null:'world');return;}
  const worldControl=event.target instanceof Element&&!!event.target.closest('#world-panel');
  if(worldControl&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();void attempt(save);return;}
  if(worldControl&&event.key==='Escape'){event.preventDefault();void attempt(()=>switchPanel(null));return;}
  if(worldControl)return;
  if (event.target instanceof HTMLElement && (event.target.matches('input, select, textarea') || event.target.isContentEditable)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); void attempt(save); return; }
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.code === 'Space') { event.preventDefault();const token=client.getThreatPauseToken(),speed=currentSpeed===0?lastSpeed:0;void attempt(() => changeSpeed(speed,token)); return; }
  if (event.key === 'Escape') { event.preventDefault(); if(shootingControls.active){shootingControls.cancel();renderState();return;} if (orderMenu.close() || renderer?.cancelDesignation()) return; void attempt(() => switchPanel(null)); clearSelection(); return; }
  if (event.key === 'Tab' || event.key === 'F1' || event.key === 'F2' || event.key === 'F3') { event.preventDefault(); const panel = event.key === 'Tab' ? 'architect' : event.key === 'F1' ? 'work' : event.key === 'F2' ? 'schedule' : 'assign'; setPanel(currentPanel === panel ? null : panel); return; }
  const speeds: Record<string, number> = { '1': 1, '2': 3, '3': 6 };
  if (event.key in speeds) { const token=client.getThreatPauseToken(),speed=speeds[event.key];void attempt(() => changeSpeed(speed,token)); return; }
  if(event.key.toLowerCase()==='r'&&selection.ids.size){event.preventDefault();if(!event.repeat)toggleDraft(snapshot?.pawns.filter(p=>selection.ids.has(p.id)&&isColonist(p)&&!p.prisoner)??[],c=>void attempt(async()=>{await client.command(c);renderState();}));return;}
  if(!snapshot)return;
  const shortcuts: Record<string, Tool> = { m:'mine', c: 'chop', r: 'harvest', b: 'wall', l: 'bed', x: 'cancel' };
  const key = event.key.toLowerCase(); if (key in shortcuts) setTool(shortcuts[key]);
  else if (rotatableTools.has(currentTool) && (key === 'q' || key === 'e')) { event.preventDefault(); rotatePlacement(key === 'q' ? -1 : 1); }
  else if (key === 's') { event.preventDefault(); setTool('stockpile'); }
});
client.onError = message => notify(message, true);
client.onRequestStatus = status => {
  if (status.state === 'waiting') waitingRequests.set(status.id, status.message ?? 'La simulation tarde à répondre.');
  else waitingRequests.delete(status.id);
  if(status.state==='settled'&&['world-draft-generate','world-draft-start','world-draft-cancel'].includes(status.type))resumeNativeShipPreparation298();
  groupUI.setRequestStatus(status);
  updateIncident(); syncStorageButtons();
};
client.onFault = () => {
  groupUI.setSimulationStopped('La simulation est arrêtée. Les derniers états confirmés restent consultables.');
  session.markSimulationStopped(); simulationStopped = true; currentSpeed = 0; menuResumeSpeed = undefined;
  frontMenu.setHasGame(false);
  audio.reset();
  renderer?.stopPresentation();
  updateIncident(); syncStorageButtons();
};
function receiveMainSnapshot(world: World, cost: number, speed: number, replaced: boolean, motion?: PawnTrack[], coreInput297?:object): void {
  latestCoreFullInput297=coreInput297;latestCorePhaseInput297=undefined;
  if(replaced)firstGesturesLearning?.cancelPending();
  campaignOnly=undefined;shell.classList.remove('campaign-only');
  if(replaced){hoveredCell=null;hoverReadoutLayout?.reset();}
  if(replaced){nativeHudHiddenInspectorKey=undefined;campaignPresentationEpoch++;}
  if (replaced) {audio.reset();lastAudioCamera=undefined;lastAudioSourceFocus={x:Infinity,z:Infinity};lastAudioSourceHeight=NaN;}
  const speedChanged=currentSpeed!==speed;
  if(speed>0)deferredResumeGuard.confirm(false);
  const role=(p:Pawn|undefined)=>p?p.prisoner?'prisoner':isColonist(p)?'colonist':'other':'absent';
  const roleChanged=selectedPawn!==undefined&&role(snapshot?.pawns.find(p=>p.id===selectedPawn))!==role(world.pawns.find(p=>p.id===selectedPawn));
  let zoneAnchorChanged=false;
  if(!replaced&&selectedObject?.kind==='stockpile'&&!world.stockpiles.some(cell=>cell.id===selectedObject!.id)){
    const old=snapshot?.stockpiles.find(cell=>cell.id===selectedObject!.id);
    const replacement=old?stockpileCellsByZoneId(world,stockpileZoneId(old))[0]:undefined;
    if(replacement){selectedObject={kind:'stockpile',id:replacement.id};selectedObjects=[selectedObject];selectedCell={x:replacement.x,z:replacement.z};renderer?.setSelectedObject(selectedObject);zoneAnchorChanged=true;}
  }
  if(!replaced&&selectedObject?.kind==='resource'&&!world.resources.some(r=>r.id===selectedObject!.id)){
    const tree=world.piles.find(p=>p.owner.type==='ground'&&isMinifiedTree(p)&&p.innerResource.id===selectedObject!.id);
    if(tree&&tree.owner.type==='ground'){selectedObject={kind:'pile',id:tree.id};selectedObjects=[selectedObject];selectedCell={x:tree.owner.x,z:tree.owner.z};renderer?.setSelectedObject(selectedObject);zoneAnchorChanged=true;}
  }
  if(currentTool==='replant-tree'&&replantPileId!==undefined&&!world.piles.some(p=>p.id===replantPileId&&p.owner.type==='ground'&&isMinifiedTree(p)&&!p.plantPack.pendingExpiry))applyTool('select');
  latestFoodReadability=undefined;snapshot=world;stepMs=cost;currentSpeed=speed;latestMotion=motion;session.hasWorld=true;frontMenu.setHasGame(true);
  syncArchitectAvailability(replaced);
  let objectGroupChanged=false;
  if(!replaced&&selectedObjects.length>1){
    const cells=mapObjectGroupCells(world,selectedObjects),remaining=selectedObjects.filter((_,i)=>cells[i]!.length>0);
    if(remaining.length!==selectedObjects.length){const first=remaining[0]?selectedObjects.indexOf(remaining[0]):-1;selectedObjects=remaining;selectedObject=remaining[0];selectedCell=first>=0?cells[first]?.[0]:undefined;renderer?.setSelectedObjects(remaining);objectGroupChanged=true;}
  }
  if(soundEnabled)foliageAmbience.adopt(world,true);
  music.setMood(musicMood(world));
  const changed=replaced||[...selection.ids].some(id=>!world.pawns.some(p=>p.id===id)&&!world.wildlife?.animals.some(a=>a.id===id)&&!world.mechanoids?.some(m=>m.id===id))||!!selectedObject&&!mapObjectExists(world,selectedObject);
  if(changed){selection.clear();selectedPawn=undefined;selectedCell=undefined;selectedObject=undefined;selectedObjects=[];renderer?.setSelectedObject(undefined);orderMenu.close();rebuildInspector();}
  else if(roleChanged||zoneAnchorChanged||objectGroupChanged){orderMenu.close();rebuildInspector();}
  const deferCalmFull297=isCorePhysicalSchema297(Number(world.schemaVersion))&&!replaced&&!speedChanged&&speed>0&&!client.hasPendingPresentationRequests;
  renderer?.setWorld(world,replaced,speed,motion,true,coreInput297,deferCalmFull297);
  syncAudioSources(world);
  if(changed)renderer?.setSelectedPawns(selection.ids);
  updateMapHover();
  snapshotHud.request(changed||roleChanged||speedChanged);
}
function renderCampaignOnly():void {
 if(nativeUi){refreshNativeUi();return;}
 const state=campaignOnly;if(!state)return;caravanEncounterDialog261.update(state);shell.classList.add('campaign-only');
 // A confirmed globe-only campaign does not create a terrain renderer. It
 // must still finish the initial loading presentation and accept real input.
 el('loading')?.remove();
 const minute=Math.floor(state.civilTick%TICKS_PER_DAY*1440/TICKS_PER_DAY);el('campaign-clock').textContent=`Temps de campagne · jour ${1+Math.floor(state.civilTick/TICKS_PER_DAY)} · ${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;el('fps-counter').textContent='— FPS';
 el('pause-banner').hidden=currentSpeed!==0;
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-speed]')){const active=Number(button.dataset.speed)===currentSpeed;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
 statusAlerts.updateCampaign(state);mapJumpTo.update(readJumpToEntries(state));questUI.updateCampaign(state);
 if(currentPanel==='world')refreshWorldPanels(state);
}
function receiveMainCampaignOnly(summary:CampaignSummary,cost:number,speed:number,replaced:boolean):void {
 firstGesturesLearning?.cancelPending();
 const hadMap=!!snapshot;if(replaced||hadMap){nativeHudHiddenInspectorKey=undefined;campaignPresentationEpoch++;}
 if(hadMap||replaced){renderer?.dispose();renderer=undefined;audio.reset();latestMotion=undefined;latestCoreFullInput297=latestCorePhaseInput297=undefined;hoveredCell=null;hoverReadoutLayout?.reset();selection.clear();selectedPawn=undefined;selectedCell=undefined;selectedObject=undefined;selectedObjects=[];orderMenu.close();startingArrivalUI.reset();}
 snapshot=undefined;latestFoodReadability=undefined;campaignOnly=summary;stepMs=cost;currentSpeed=speed;if(speed>0)deferredResumeGuard.confirm(false);session.hasWorld=true;frontMenu.setHasGame(true);
 if(worldTab==='individual')worldTab='maps';if(currentPanel!=='menu'&&currentPanel!=='world'&&currentPanel!=='quests')setPanel('world');
 if(!frontMenu.isOpen())shell.hidden=false;renderCampaignOnly();syncStorageButtons();
}
function receiveMainAudioCues(cues: readonly AudioCue[]): void {
  if (soundEnabled) audio.ingestCues(cues);
}
function updateIncident(): void {
  if(nativeUi){
    if(!simulationStopped&&!graphicsFault&&!waitingRequests.size){
      if(nativeCustomPage?.id==='native-incident'){nativeCustomPage=nativeBeforeIncident;nativeBeforeIncident=undefined;refreshNativeUi();}
      return;
    }
    if(nativeCustomPage?.id!=='native-incident')nativeBeforeIncident=nativeCustomPage;
    nativeUi.setWorldVisible(!!renderer&&!!snapshot);
    nativeCustomPage={id:'native-incident',title:simulationStopped?'Simulation arrêtée':graphicsFault?'Affichage interrompu':'Opération en attente',modal:true,closable:false,
      rows:[{id:'native-incident-message',label:simulationStopped?'Le dernier tick peut être incomplet. Vos sauvegardes sont conservées.':graphicsFault?graphicsMessage:'La commande peut avoir été appliquée ; son résultat et sa récupération restent en attente.'}],
      actions:[{id:'native-incident-home',label:'Charger une colonie',disabled:graphicsRecovering||replacingWorld||session.busy,onActivate:()=>openFront('load')},
        ...(graphicsFault&&!simulationStopped?[{id:'native-incident-retry',label:'Rétablir l’affichage',onActivate:()=>prepareWorld()}]:[]),
        ...(waitingRequests.size?[{id:'native-incident-stop',label:'Arrêter la simulation',onActivate:()=>client.stop()}]:[])]};
    nativeUi.showPage(nativeCustomPage);return;
  }
  const visible = simulationStopped || graphicsFault || waitingRequests.size > 0;
  if (!incidentPanel && !visible) return;
  if (!incidentPanel) {
    incidentPanel = document.createElement('section');
    incidentPanel.id = 'game-incident'; incidentPanel.setAttribute('role', 'alert');
    incidentPanel.style.cssText = 'position:fixed;z-index:10000;top:20px;left:50%;transform:translateX(-50%);max-width:560px;padding:20px;background:#fff8ec;color:#292b31;border:2px solid #cda598;border-radius:12px;box-shadow:0 8px 28px #0005';
    incidentPanel.innerHTML = '<strong></strong><p></p><button id="retry-display">Recréer l’affichage</button> <button id="incident-colonies">Charger ou créer une colonie</button> <button id="stop-unanswered">Arrêter la simulation</button>';
    document.querySelector('#app')!.append(incidentPanel);
    el('retry-display').onclick = () => { void attempt(async () => {
      if (graphicsRecovering || replacingWorld || session.busy || simulationStopped) return;
      graphicsRecovering = true; updateIncident(); syncStorageButtons();
      try { await prepareWorld(); }
      finally { graphicsRecovering = false; updateIncident(); syncStorageButtons(); }
    }); };
    el('incident-colonies').onclick = () => { frontMenu.showHome(session.hasWorld && !simulationStopped); incidentPanel!.hidden = true; syncStorageButtons(); };
    el('stop-unanswered').onclick = () => client.stop();
  }
  incidentPanel.hidden = !visible;
  incidentPanel.querySelector('strong')!.textContent = simulationStopped ? 'Simulation arrêtée' : graphicsFault ? 'Affichage interrompu' : 'Opération en attente';
  incidentPanel.querySelector('p')!.textContent = simulationStopped
    ? 'Le dernier tick peut être incomplet. Vos sauvegardes sont conservées. Chargez une copie validée ou créez une colonie pour reprendre.'
    : graphicsFault ? `${graphicsMessage} La colonie est conservée et mise en pause avant la reprise de l’affichage.`
    : 'La simulation tarde à répondre. La commande peut avoir été appliquée ; son résultat et la copie de récupération restent en attente. Vous pouvez attendre ou arrêter la simulation et recharger une copie validée.';
  el<HTMLButtonElement>('retry-display').hidden = !graphicsFault || simulationStopped;
  el<HTMLButtonElement>('retry-display').disabled = graphicsRecovering || replacingWorld || session.busy;
  el<HTMLButtonElement>('incident-colonies').hidden = !simulationStopped && !graphicsFault;
  el<HTMLButtonElement>('incident-colonies').disabled = graphicsRecovering || replacingWorld || session.busy;
  el<HTMLButtonElement>('stop-unanswered').hidden = waitingRequests.size === 0;
}

async function handleGraphicsFailure(message: string): Promise<void> {
  const alreadyFailed = graphicsFault;
  graphicsFault = true; graphicsMessage = message;
  const failed = renderer; renderer = undefined; failed?.dispose(); notifyMainAdmissionAvailability(); audio.reset();
  if (alreadyFailed) { updateIncident(); syncStorageButtons(); return; }
  graphicsRecovering = true;
  updateIncident(); syncStorageButtons();
  try { if (snapshot && !simulationStopped) await client.setSpeed(0); }
  catch (error) { notify(error instanceof Error ? error.message : String(error), true); }
  finally { graphicsRecovering = false; updateIncident(); syncStorageButtons(); }
}

function prepareWorld(): Promise<void> {
  if(!presentationPreparation){presentationPreparation=prepareWorldSafely().finally(()=>{presentationPreparation=undefined;nativeUi?.notifyCountdownFrameEligibility298();});nativeUi?.notifyCountdownFrameEligibility298();}
  return presentationPreparation;
}
async function prepareWorldSafely(): Promise<void> {
 for(;;){
  const epoch=campaignPresentationEpoch;
  try {
    await prepareWorldView();
    // Automatic entry can replace the map while its first renderer warms up.
    // The same preparation promise must finish the latest confirmed view.
    if(epoch!==campaignPresentationEpoch){
      if((client.hasActiveMap&&snapshot)||campaignOnly)continue;
      return;
    }
    // The fatal callback may have retired this renderer during warmup.
    if(client.hasActiveMap&&(!renderer||renderer.fatalError))throw new Error(renderer?.fatalError||graphicsMessage||'La préparation de l’affichage a été interrompue.');
    graphicsFault = false; graphicsMessage = ''; updateIncident();
  } catch (error) {
    if(epoch!==campaignPresentationEpoch){
      if((client.hasActiveMap&&snapshot)||campaignOnly)continue;
      return;
    }
    if(!client.hasActiveMap){if(campaignOnly)renderCampaignOnly();return;}
    await handleGraphicsFailure(error instanceof Error ? error.message : String(error));
    throw error;
  }
  return;
 }
}
async function prepareWorldView(): Promise<void> {
  if(campaignOnly&&!client.hasActiveMap){shell.hidden=false;worldTab='maps';setPanel('world');renderCampaignOnly();return;}
  if (!snapshot) throw new Error('Aucune colonie à afficher.');
  shell.hidden=false;
  const epoch=campaignPresentationEpoch;
  const hasAuthority=()=>epoch===campaignPresentationEpoch&&client.hasActiveMap&&!!snapshot;
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  if(!hasAuthority()){if(campaignOnly)renderCampaignOnly();return;}
  if (!renderer) {
    const created=await MainColonyRenderer.create(el('viewport'), pickCell, groundGrassEnabled);
    if(!hasAuthority()){created.dispose();if(campaignOnly)renderCampaignOnly();return;}
    renderer=created;
    renderer.setDioramaEnabled(dioramaEnabled);
    renderer.setRoomEnabled(roomEnabled);
    renderer.setDecorOcclusion(decorOcclusionPreference);
    renderer.setLightingSettings(lightingSettings);
    renderer.setShadowSettings(shadowSettings);
    renderer.setAnimationSettings(animationSettings);
    renderer.onFatalError = message => { if(renderer===created&&client.hasActiveMap&&snapshot)void handleGraphicsFailure(message); };
    renderer.onCompatibilityWarning = message => notify(message, true);
    renderer.setTexturesEnabled(texturesEnabled);
    if(nativeUi){renderer.setWallCutaway(wallCutaway);renderer.setFoliageVisible(foliageVisible);renderer.setRoofsVisible(nativeRoofsVisible);renderer.setZonesVisible(nativeZonesVisible);if(nativePerspective)renderer.toggleCameraMode();}
    renderer.setDesignationMinCellPixels(designationIconThreshold);
    renderer.setItemLabelMinCellPixels(itemLabelThreshold);
    renderer.onAudioFrame = view => {
      lastAudioCamera=view.camera;
      audio.updateCamera(view.camera);
      const pose=listenerPose(view.camera);
      if (soundEnabled && snapshot && !document.hidden &&
        (Math.hypot(pose.x-lastAudioSourceFocus.x,pose.z-lastAudioSourceFocus.z)>=4 ||
          !Number.isFinite(lastAudioSourceHeight) || Math.abs(pose.y-lastAudioSourceHeight)>=2))
        syncAudioSources(snapshot,view.camera);
      audio.update({ presentedTick: view.tick, paused: view.paused || frontMenu.isOpen() || replacingWorld, hidden: document.hidden });
    };
    renderer.onSelection=gesture=>{if(shootingControls.active){const targetId=gesture.ids[0];if(targetId!==undefined){const type=shootingControls.mode!;shootingControls.cancel();void attempt(async()=>{await client.command({type,pawnIds:selectedColonyIds(),targetId});renderState();});}return;}selectPawns(gesture);};
    renderer.onObjectSelection=selectObjects;
    renderer.onHover=cell=>{hoveredCell=cell;if(cell)hoverReadoutLayout?.resume();updateMapHover(true);};
    renderer.onInteractionCancel=()=>{cancelNativeOrderPage();orderMenu.close();};
    renderer.onContext=(cell,x,y,queue,targetId)=>{
      if(shootingControls.active){shootingControls.cancel();renderState();return;}if(!snapshot||replacingWorld||frontMenu.isOpen())return;
      if(nativeUi){
        const epoch=session.generation;void nativeOrderPage(snapshot,[...selection.ids],cell,x,y,queue,targetId,
          {orderOptions:client.orderOptions,command:client.command,currentWorld:()=>snapshot,currentSelectedPawnIds:()=>[...selection.ids],
            isCurrent:()=>session.generation===epoch&&!replacingWorld&&!frontMenu.isOpen(),close:()=>{nativeCustomPage=undefined;refreshNativeUi();}},
          page=>{nativeCustomPage=page;nativeUi!.showPage(page);}).catch(error=>notify(String(error),true));return;
      }
      const selected=snapshot.pawns.filter(p=>selection.ids.has(p.id)&&isColonist(p)&&!p.prisoner);if(selected.some(p=>p.draft))void orderMenu.openTactical(snapshot,new Set(selected.map(p=>p.id)),cell,x,y,queue,targetId);else void orderMenu.open(snapshot,selection.ids,cell,x,y,queue);
    };
    renderer.onArea = designateArea;
    renderer.onAllowedAreaPaint=(enabled,from,to)=>{if(allowedAreaEditId!==undefined)paintAllowedArea(allowedAreaEditId,enabled,from,to);};
    renderer.onExitOrder=()=>{applyTool('select');setPanel(null);clearSelection();};
    renderer.onBuildLine = (kind, from, to, material) => {
      if (!snapshot || replacingWorld || frontMenu.isOpen()) return;
      void attempt(async () => {
        const response = await client.command({ type:'build-line', kind, from, to, ...(material ? { material } : {}) });
        const result = JSON.parse(response!) as { affected:number; skipped:number };
        notify(`${result.affected} plan(s) ${kind==='power-conduit'?'de câble':kind==='fence'?'de clôture':'de mur'} créé(s)${result.skipped ? ` · ${result.skipped} case(s) ignorée(s)` : ''}.`);
      });
    };
    renderer.onAreaPreview = () => {
      el('area-feedback').hidden = true;
    };
  }
  const activeRenderer=renderer,activeWorld=snapshot;
  if(!activeRenderer||!activeWorld||!hasAuthority()){if(campaignOnly)renderCampaignOnly();return;}
  activeRenderer.setWorld(activeWorld, true, currentSpeed, latestMotion,true,latestCoreFullInput297);
  if(latestCorePhaseInput297)activeRenderer.setCorePhase297(latestCorePhaseInput297);
  if (activeRenderer.compatibilityWarning) notify(activeRenderer.compatibilityWarning, true);
  syncAudioSources(activeWorld);
  try{await activeRenderer.preparePresentation();}
  catch(error){if(hasAuthority())throw error;}
  if(renderer!==activeRenderer||!hasAuthority()){activeRenderer.dispose();if(renderer===activeRenderer)renderer=undefined;if(campaignOnly)renderCampaignOnly();return;}
  el('loading')?.remove(); renderState();
}
async function start() {
  shell.hidden=true; frontMenu.showHome(false);
  frontMenu.setBusy(true, 'Lecture des sauvegardes…');
  try { await session.initializeStorage();saveStorageReady=true;saveManager?.refresh(); }
  finally { frontMenu.setBusy(false); }
  if (import.meta.env.DEV && params.has('e2e')) Object.defineProperty(window, '__lisiere', { value: {
    get world() { return structuredClone(snapshot); }, get tick() { return campaignState()?.tick ?? 0; }, get campaign() { const state=campaignState();return state?structuredClone(campaignUIFacts(state)):undefined; },get hasActiveMap(){return client.hasActiveMap;}, get backend() { return renderer?.backend; },
    get nativeUi(){return nativeUi?.diagnostics();},
    get renderStats(){return renderer?{...renderer.stats}:undefined;},get speed(){return currentSpeed;},
    get busy(){return session.busy||replacingWorld||graphicsRecovering;},
    get audio() { return { loadedCount: audio.loadedCount, availableSounds: audio.availableSounds, music: music.diagnostics }; },
    saveRepository,
    get incident() { return { simulationStopped, graphicsFault, waiting: waitingRequests.size }; },
    failGraphics: (message = 'Incident graphique de contrôle') => renderer?.reportFailure(message),
    loseGraphicsDevice: () => renderer?.requestDeviceLossForDiagnostics() ?? false,
    stopSimulation: () => client.stop('Arrêt de contrôle de la simulation.'),
    projectCell: (x: number,z: number) => renderer!.projectCell(x,z),
    projectPawn: (id:number) => renderer?.screenPawns().find(pawn=>pawn.id===id),
  } });
  syncStorageButtons();
  if (!diagnosticStart) return;
  frontMenu.setBusy(true, 'Préparation du scénario de diagnostic…');
  try {
    const seedText=params.get('seed'), seed=seedText===null?42:Number(seedText), size=Number(params.get('size'));
    if(seedText!==null&&(!/^\d{1,10}$/.test(seedText)||!Number.isInteger(seed)||seed<0||seed>4294967295))throw new Error('Graine invalide dans cette adresse.');
    const scenario=params.get('scenario')!;
    if(!Object.hasOwn(SCENARIOS,scenario))throw new Error('Scénario inconnu dans cette adresse.');
    el<HTMLSelectElement>('world-scenario').value=scenario; updateScenarioDescription();
    await replaceColony(() => session.create(seed,[32,...MAP_SIZE_PRESETS].includes(size)?size:DEFAULT_MAP_SIZE,scenario as ScenarioId));
    await changeSpeed(1);
  } catch(error) { frontMenu.showError(error instanceof Error?error.message:String(error)); }
  finally { frontMenu.setBusy(false); syncStorageButtons(); }
}
const metricsInterval = setInterval(() => {
  void autosaveScheduler.poll(performance.now(),{
    generation:session.generation,tick:campaignState()?.tick??0,
    playing:!!campaignState()&&currentSpeed>0&&!document.hidden&&!frontMenu.isOpen()&&!graphicsFault&&!simulationStopped,
    available:session.hasWorld&&!session.busy&&!replacingWorld&&!waitingRequests.size&&!graphicsFault&&!simulationStopped,
  },async()=>{
    const saving=session.autosave();syncStorageButtons();
    try{await saving;}finally{syncStorageButtons();}
  },error=>notify(`Autosauvegarde échouée : ${error instanceof Error?error.message:String(error)}. Les autres copies sont conservées ; vous pouvez exporter la partie.`,true));
  if (!renderer) return;
  if(nativeHud&&snapshot)nativeHud.update(snapshot,currentSpeed,renderer.stats.fps);
  el('fps-counter').textContent = renderer.stats.fps > 0 ? `${Math.round(renderer.stats.fps)} FPS` : '— FPS';
  if (!el('metrics').hidden) {
    const sound = audio.diagnostics;
    const soundState = !soundEnabled ? 'coupé' : soundVolume === 0 ? 'volume 0'
      : sound.state === 'running' ? 'actif' : sound.state === 'suspended' ? 'suspendu' : sound.state;
    const song = music.diagnostics;
    el('metrics').textContent = `${renderer.backend} · ${renderer.stats.frameMs.toFixed(1)} ms/image · p95 ${renderer.stats.frameP95.toFixed(1)} ms · simulation ${stepMs.toFixed(2)} ms/tick · son ${soundState}, ${sound.loaded} MP3, ${sound.playedOneShots} effets, dernier ${sound.lastKind ?? '—'} · musique ${song.state}${song.track ? ` (${song.track})` : ''}`;
  }
}, 1000);
window.addEventListener('pagehide', event => { if (event.persisted) return; clearInterval(metricsInterval);nativeLocalTrade?.dispose();nativeFactionComms298?.dispose();nativeSaveManager?.dispose();nativeHud?.dispose();nativeShipTerminal298?.dispose();nativeUi?.dispose(); client.dispose(); audio.dispose(); music.dispose(); renderer?.dispose(); saveRepository.close(); });
mainAdmissionCanFrame=()=>renderer instanceof MainColonyRenderer&&renderer.admissionFrameReady&&!presentationPreparation&&!replacingWorld&&!simulationStopped&&!graphicsFault&&!graphicsRecovering&&!frontMenu.isOpen()&&!document.hidden;
if(nativeMode){
  // Compatibility bookkeeping is detached after bootstrap. No legacy control
  // remains in the active page or supplies native input, layout or values.
  for(const node of document.querySelectorAll<HTMLElement>('#app [id],body > dialog[id]'))legacyElements.set(node.id,node);
  for(const child of [...shell.children])if(child.id!=='viewport')child.remove();
  for(const child of [...document.querySelector('#app')!.children])if(child!==shell)child.remove();
  for(const dialog of document.querySelectorAll('body > dialog'))dialog.remove();
}
void start().catch(error => { frontMenu.showError(error instanceof Error ? error.message : String(error)); });
