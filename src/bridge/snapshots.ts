import {validHumanIngestionOwners299} from '../sim/human-ingestion-save-299.ts';
import {validIdleWanderOwners300} from '../sim/idle-wander-save-300.ts';
import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import {validVictoryContentHistorical298,validShipComputerSensorsBuilding298} from '../sim/victory-content-save-298.ts';
import {escapedShipProjection298,validEscapedShipsProjection298,validEscapedShipsProjectionScope298,type NativeUIWorld298} from '../sim/ship-escape-projection-298.ts';
import {validShipEscapeHistorical298} from '../sim/ship-escape-save-298.ts';
import {registeredCampaign} from '../sim/world-map-context.ts';
import {validFactionCommsTransportForSnapshot298} from '../sim/faction-comms-save-298.ts';
import {isCorePhysicalSchema297} from '../sim/physical-schema-297.ts';
import {validCorePathBudget297} from '../sim/core-path-budget-297';
import {effectiveCore297,validPhaseCore297} from '../sim/core-phase-297';
import {validWallDoorHistoricalTransport296,validWallDoorWorld296,registerWallDoorPlanIds296} from '../sim/wall-door-save-296.ts';
import {validNovelPile295,validNovelHistoricalTransport295} from '../sim/book-save-295.ts';
import {validReadingWorld295} from '../sim/book-transport-295.ts';
import {validPeaceTalksHistorical293,validPeaceTalksBindings293} from '../sim/peace-talks-save-293.ts';
import {validPartyHistoricalTransport292,validPartyWorld292} from '../sim/party-save-292.ts';
import {validForestryPolicies291,validForestryHistoricalTransport291} from '../sim/forestry-save-291.ts';
import {isGrowingPlantInVersion291} from '../sim/forestry-content-291.ts';
import {validFirefoamHistoricalTransport290,validFirefoamWorld290,validateFirefoamLocal290} from '../sim/firefoam-save-290.ts';
import {validBillPauseHistoricalTransport289,validBillPauseWorld289} from '../sim/bill-pause-save-289.ts';
import {validAnimalThermalRefugeHistoricalTransport288,validAnimalThermalRefugeWorld288} from '../sim/animal-thermal-refuge-save-288.ts';
import {validAnimalAreaHistoricalTransport287,validAnimalAreaWorld287} from '../sim/animal-area-save-287.ts';
import {validSmoothFloorsHistoricalTransport281,validSmoothFloorTile281,validSmoothFloorWorld281} from '../sim/smooth-floor-save-281.ts';
import {validAnimalTrainingHistoricalTransport282} from '../sim/animal-training-historical-282.ts';
import {validAnimalTrainingWorld282} from '../sim/animal-training-world-282.ts';
import {validPrisonerSurgeryHistoricalTransport280,validPrisonerSurgeryWorld280,hasPrisonerSurgery280} from '../sim/prisoner-surgery-save-280.ts';
import {validApparelTradeHistoricalTransport279,validApparelTradeWorld279} from '../sim/apparel-trade-save-279.ts';
import {validApparelReservesBuilding278,validApparelReservesHistoricalTransport278} from '../sim/apparel-reserves-save-278.ts';
import {validBillWorkerHistoricalTransport283,validBillWorkerWorld283} from '../sim/bill-worker-save-283.ts';
import {validLinkedStorageHistorical286,validLinkedStorageProjection286} from '../sim/linked-storage-save-286.ts';
import {validShipCasketHistoricalTransport277} from '../sim/ship-casket-save-277.ts';
import {validShipCasketBuilding277,registerShipCasketThingIds277} from '../sim/ship-casket-owner-save-277.ts';
import {isShipCasket277} from '../sim/ship-casket-state-277.ts';
import {validShipCasketTaskField277,validShipCasketTaskTransport277} from '../sim/ship-casket-task-save-277.ts';
import {validShipPartHistoricalTransport276,validShipHullBuilding276} from '../sim/ship-part-save-276.ts';
import {validateShipReactorThreats275,validShipReactorThreatContinuation275} from '../sim/ship-reactor-threat-save-275.ts';
import {validShipReactorBuilding275,validShipReactorWorld275,validShipReactorContinuation275,validShipReactorHistoricalTransport275} from '../sim/ship-reactor-save-275.ts';
import {validShipResearchTransport275} from '../sim/research-save.ts';
import {isSchema273OrLater} from '../sim/schema-compatibility-257.ts';
import {validProstheticHistoricalTransport273} from '../sim/catalogue-save-273.ts';
import {validProstheticsResearchTransport273} from '../sim/research-save.ts';
import {validProstheticWorkShape273,validateProstheticWorks273} from '../sim/prosthetic-work-save-273.ts';
import {validSpearHistoricalTransport272} from '../sim/catalogue-save-272.ts';
import {validLongswordHistoricalTransport270} from '../sim/catalogue-save-270.ts';
import {validCryptosleepHistoricalTransport271} from '../sim/catalogue-save-271.ts';
import {validCryptosleepResearchTransport271} from '../sim/research-save.ts';
import {isPlayerCasket271} from '../sim/cryptosleep-state-271.ts';
import {validCryptosleepBuilding271,registerCryptosleepThingIds271} from '../sim/cryptosleep-owner-save-271.ts';
import {validCryptosleepTaskField271,validCryptosleepTaskTransport271} from '../sim/cryptosleep-task-save-271.ts';
import {medicalCivilTick271,validMedicalCivilHeader271} from '../sim/suspended-human-clock-271.ts';
import {validLongBladesResearchTransport270} from '../sim/research-save.ts';
import {validCraftingFuelTransport269} from '../sim/fuel-purpose-save-269.ts';
import {validMaceHistoricalTransport269} from '../sim/catalogue-save-269.ts';
import {validKnifeHistoricalTransport268} from '../sim/catalogue-save-268.ts';
import {validSmithingHistoricalTransport267} from '../sim/smithing-catalogue-save-267.ts';
import {validSmithingWorkShape267,validateSmithingWorks267} from '../sim/smithing-save-267.ts';
import {validAlcoholWorld265} from '../sim/alcohol-state-265.ts';
import {validCaravanRestField266} from '../sim/caravan-rest-state-266.ts';
import {validBrewingHistoricalTransport265} from '../sim/brewing-catalogue-save-265.ts';
import {validFermentationWorld265} from '../sim/fermentation-save-265.ts';
import {validSmithyResearchTransport267,validBrewingResearchTransport265,validGeothermalResearchTransport} from '../sim/research-save.ts';
import {validGeothermalWorld264} from '../sim/geothermal-state-264.ts';
import {registerProjectedTradeRequests284} from '../sim/trade-request-projection-save-284.ts';
import {validCouplePawnShape285} from '../sim/couple-save-285.ts';
import {hasCoupleFields285,validCoupleHistoricalTransport285} from '../sim/couple-owner-save-285.ts';
import {validTradeRequestHistorical284} from '../sim/trade-request-save-284.ts';
import {validApparelProvenanceHistoricalTransport284} from '../sim/apparel-provenance-284.ts';
import {registerProjectedWorldSites263} from '../sim/world-sites-projection-save-263.ts';
import {validWorldAffiliationFields259,validWorldAffiliationForeignKeys259} from '../sim/world-affiliation-259.ts';
import {validPrisonerStateRecord259} from '../sim/prisoner-save.ts';
import {isAncientGeneratedFloor256} from '../sim/ancient-generated-floor-state-256.ts';
import {validNaturalHiveLoss256} from '../sim/cave-hive-loss-256.ts';
import {validCaveHiveBuilding256,validateCaveHiveOwners256} from '../sim/cave-hive-save-256.ts';
import {validateHiveRuntimeOwners256} from '../sim/cave-hive-runtime-save-256.ts';
import {validMaterialPermission256} from '../sim/material-permission-256.ts';
import {validNativeHumanField256,validHumanAgeForPawn256} from '../sim/native-human-identity-256';
import {freezeAdmittedNativeWorldPawnOrder256,captureNativeWorldPawnBirth256,sameNativeWorldPawnBirth256} from '../sim/world-pawn-native-order-256';
import {validWorldPawnsEnvelope256} from '../sim/world-pawn-save-256';
import {registerProjectedWorldPawns256} from '../sim/world-pawn-transport-save-256';
import {validCobraClinicalWorldForSnapshot256} from '../sim/toxic-buildup-save-256.ts';
import {validAncientCasketBuilding256,validateAncientCasketPhysical256} from '../sim/ancient-casket-physical-256.ts';
import {isAncientCasket256} from '../sim/ancient-casket-state-256.ts';
import {validAncientCasketField256,registerAncientCasketThingIds256} from '../sim/ancient-casket-save-256.ts';
import {validateAncientOpeningOwners256} from '../sim/ancient-casket-opening-256.ts';
import {validCryptosleepSicknessWorldTransportForSnapshot256} from '../sim/cryptosleep-sickness-save-256.ts';
import {validArrivalRotation256} from '../sim/arrival-rotation-256';
import {prepareRiverWaterSnapshot256} from './river-water-transport-256.ts';
import {freezeAdmittedRiverWater256} from '../sim/river-water-owner-256.ts';
import {validAncientMonumentBuilding256,validAncientMonumentState256} from '../sim/ancient-monument-save-256.ts';
import {validLocalRoadInfoEnvelope256} from '../sim/local-road-info-256.ts';
import {heldDuckInventoryClock256} from '../sim/duck-held-item-clock-256.ts';
import {validMineableTile256} from '../sim/local-mineable-save-256.ts';
import {validAncientShrineWarningEnvelope256,registerAncientShrineWarningIds256} from '../sim/ancient-shrine-warning-save-256.ts';
import {validLocalGeyserEnvelope256} from '../sim/local-geyser-campaign-save-256.ts';
import {registerGeyserIdentities256} from '../sim/local-geyser-save-256.ts';
import {validateDuckFlyers256} from '../sim/duck-flyer-save-256.ts';
import {animalContentsOwner256} from '../sim/animal-local-contents-256.ts';
import {captureExplorationTransport256,prepareExplorationTransport256,validExplorationTransportEnvelope256} from './exploration-transport-256.ts';
import {validExplorationHeader256,validExplorationTile256,validateExploration256} from '../sim/exploration-save-256.ts';
import {validateDoors} from '../sim/door-save.ts';
import {validBlindMineTransport256} from '../sim/mining-save.ts';
import {validLocalRoadPropStructure256,validLocalRoadPropsState256} from '../sim/local-road-props-save-256.ts';
import {validGroupForageHistoricalTransport256} from '../sim/group-forage-save-256.ts';
import {validCollapsedRock256,registerCollapsedRockIdentities256,admittedRoofTerrain256} from '../sim/collapsed-rocks-256.ts';
import {validNaturalRoofState256} from '../sim/roof-save.ts';
import {validGeographicSiteBinding256} from '../sim/site-geographic-256.ts';
import {validEggPile256} from '../sim/animal-egg-save-v256.ts';
import {isFutureEcologyItem256} from '../sim/cave-products-256.ts';
import {registerProjectedFactionOwners256} from '../sim/world-faction-projection-save-256.ts';
import {captureFactionInitializations256,sameFactionInitializations256,type ConfirmedFactionInitializations256} from '../sim/world-faction-no-expansion-ideo-256.ts';
import {PlanetGeographyTransportEncoder256,PlanetGeographyTransportDecoder256,type PlanetGeographyTransport256} from './planet-geography-transport-256.ts';
import {validPlanetGeographyHistorical256} from '../sim/planet-geography-historical-256.ts';
import type {CampaignSummary} from '../sim/world-map-state.ts';
import {registeredMapPresentation} from '../sim/world-map-presentation.ts';
import type {CampaignOnlyMessage} from './protocol';
import {validWorldMapHistorical} from '../sim/world-map-save.ts';
import {validCampaignSummary,registerProjectedGroups} from '../sim/world-map-projection-save.ts';
import {groupWorld} from '../sim/world-map-authority.ts';
import {isWetTerrain} from '../sim/shallow-water.ts';
import {validGroupFreightHistoricalTransport} from '../sim/group-freight-save.ts';
import {validDeteriorationHistoricalTransport,validDeteriorationTransport} from '../sim/deterioration-save.ts';
import {validBurnApparelHistoricalTransport,validBurnApparelTransport} from '../sim/burn-apparel-save.ts';
import {validGroupProvisionsHistoricalTransport} from '../sim/group-provisions-save.ts';
import {validTorchHistoricalTransport,validTorchTransport} from '../sim/torch-save.ts';
import {validPemmicanHistoricalTransport,validPemmicanCatalogueDomains} from '../sim/pemmican-save.ts';
import {validPemmicanResearchTransport} from '../sim/research-save.ts';
import {validBridgeTile,validateBridgeTransport} from '../sim/bridge-rules.ts';
import {validVentTransport} from '../sim/vent.ts';
import {validTundraTransport} from '../sim/tundra-save.ts';
import {validCampaignPresentation} from '../sim/secondary-site-presentation.ts';
import {validateMarshTransport,validMarshTile} from '../sim/marsh.ts';
import {validTuqueCatalogueTransport} from '../sim/tuque-catalogue-save.ts';
import {validReconCatalogueTransport} from '../sim/recon-catalogue-save.ts';
import {validateTreeTransport,registerTreeThingIds,validTreePileShape,validTreeJobShape,validPlantTargetShape} from '../sim/tree-transfer-save.ts';
import type {MinifiedTreePile} from '../sim/tree-transfer-state.ts';
import {validOriginalTreeResource} from '../sim/tree-transfer-resource-save.ts';
import {hasPausedTreeClock} from '../sim/tree-transfer-clock.ts';
import {validShelfTransport,validShelfGround,shelfIdentityOwners} from '../sim/shelf-save.ts';
import {validSiteClimate} from '../sim/site-climate-save.ts';
import { hasForcedConsumptionDomain,validForcedConsumePawnShape,validForcedConsumeOwners,validForcedConsumeTransport } from '../sim/consume-save.ts';
import { hasDraftedTendingMarker,validTendShape,validDraftedTendingTransport } from '../sim/care-save.ts';
import {storageCellById} from '../sim/shelf-storage.ts';
import { PowerParentValidationCache,type PowerParentReader } from '../sim/power-parent-validation.ts';
import type { StagingGeometryReader } from '../sim/staging-validation.ts';
import type { OwnedValidationResourceReader, OwnedResourceReuseWitness, OwnedResourceBaseReuseWitness } from '../sim/owned-validation-resources.ts';
import type { OwnedGeometryReuseWitness } from '../sim/owned-validation-geometry.ts';
import { ValidationIdentityContext } from '../sim/validation-identities.ts';
import { validBiofuelTransport } from '../sim/biofuel-save.ts';
import { validAutoSlaughterTransport } from '../sim/auto-slaughter-save.ts';
import { validCremationTransport } from '../sim/cremation-save.ts';
import { validFodderTransport } from '../sim/fodder-save.ts';
import { validKibbleProductionTransport } from '../sim/cooking-save.ts';
import { validSpikeTrapTransport } from '../sim/spike-trap-save.ts';
import { validSmeltingTransport } from '../sim/smelting-save.ts';
import { validAllowedAreaTransport } from '../sim/allowed-area-save.ts';
import { validDoubleBedTransport } from '../sim/double-bed-save.ts';
import { validNutrientPasteTransport } from '../sim/nutrient-paste-save.ts';
import { validOrbitalTransport,registerOrbitalThingIds } from '../sim/orbital-save.ts';
import { validDeepDrillingTransport } from '../sim/deep-drilling-save.ts';
import { validTelevisionState } from '../sim/television-save.ts';
import { validMiniTurretShape,validateMiniTurrets } from '../sim/mini-turret-save.ts';
import { validBombWaveShape,validateBombWaves } from '../sim/bomb-state.ts';
import { validBombRefugeShape,validateBombRefuges } from '../sim/bomb-danger.ts';
import { validateProjectiles } from '../sim/projectile-save.ts';
import { validSandbagsState } from '../sim/sandbags-save.ts';
import { validPackagedSurvivalState } from '../sim/packaged-survival-save.ts';
import {validBedrollState256,validBedrollStructureEntry256} from '../sim/bedroll-save-256.ts';
import { validHospitalBedState } from '../sim/hospital-bed-save.ts';
import { validArtWorkShape } from '../sim/art-work.ts';
import { validStorageConditions } from '../sim/storage-condition.ts';
import { validStockpileZones } from '../sim/stockpile-zones.ts';
import { validFlakWorkShape } from '../sim/flak-work.ts';
import { validComponentWorkShape } from '../sim/component-work.ts';
import { floorAvailable } from '../sim/flooring.ts';
import { sterileMaterialsUnlocked } from '../sim/research.ts';
import { validPlantLife } from '../sim/plant-life-save.ts';
import { validCropBlight } from '../sim/plant-blight-save.ts';
import { validDeepResearchTransport,validHospitalSupportTransport,validateResearch,validMedicineResearchTransport } from '../sim/research-save.ts';
import { validEmpStructureTransport,validEmpProductionTransport } from '../sim/emp-save.ts';
import { validFluIncidents } from '../sim/flu-incidents-save.ts';
import { validateMedicalRecord } from '../sim/injury-validation.ts';
import { medicalStatus } from '../sim/injury-state.ts';
import { productionWorkTotal,validMedicineIngredients } from '../sim/production-recipes.ts';
import { productionWorkerQualified } from '../sim/machining.ts';
import { cookingSpot,validBillSettings } from '../sim/cooking-bills.ts';
import { validCookingOrder } from '../sim/player-cooking-save.ts';
import { reservedSource } from '../sim/materials.ts';
import { validatePileRecordShape } from '../sim/material-record-save.ts';
import { validateHydroponics } from '../sim/farming-save.ts';
import { validFireResourceLosses } from '../sim/fire-save.ts';
import { validPlantSkill, validMiningSkill } from '../sim/skills-save.ts';
import { validMiscIncidents } from '../sim/cassandra-misc-save.ts';
import {validToxicFalloutRotCredit294} from '../sim/toxic-fallout-save-294.ts';
import {validToxicFalloutTransport294} from '../sim/toxic-fallout-transport-294.ts';
import { validSmallIncidents } from '../sim/cassandra-small-save.ts';
import { validWorldIncidents } from '../sim/cassandra-world-save.ts';
import { validWildlifeManhunterState } from '../sim/animal-manhunter-save.ts';
import { validFlashstorm } from '../sim/flashstorm-save.ts';
import { validRainElectrical } from '../sim/rain-electric-save.ts';
import { validDomesticTasksTransport } from '../sim/domestic-save.ts';
import { validAnimalRestTransport } from '../sim/animal-rest-save.ts';
import { validArrestRescueTransport,validDraftedRescueTransport } from '../sim/rescue-save.ts';
import { validVisitorMedicalTransport,validVisitorMedicalTransition } from '../sim/visitor-medical-save.ts';
import { validPawnPodRescue,validPodRescueTransportBindings } from '../sim/pod-rescue-save.ts';
import { validWildlifeExitState,validWildlifePredationState } from '../sim/wildlife-save.ts';
import { validCorpseConsumption } from '../sim/corpse-anatomy.ts';
import { V190_ITEM_IDS } from '../sim/biome-items.ts';
import { validBereavement } from '../sim/bereavement-save.ts';
import { validDeathThoughtsPawnShape,validDeathThoughtsTransportForSnapshot } from '../sim/death-thoughts-save.ts';
import { validateRelationshipWorldForSnapshot } from '../sim/relationship-world-save.ts';
import { validateGroupStateWithPlanet } from '../sim/group-save.ts';
import { registerGroupThingIds } from '../sim/group-namespace-save.ts';
import { validStartingArrivalShape,validateStartingArrivalOwners,registerStartingArrivalThingIds,validStartingArrivalTransition } from '../sim/starting-arrival-save.ts';
import { validHumanSleepingSpotProvenance,validHumanSleepingSpotStructureEntry,validHumanSleepingSpotTransport } from '../sim/human-sleeping-spot-save.ts';
import { captureHumanOwners,everyHumanPawnOwner,type HumanOwnershipCapture } from '../sim/human-owners.ts';
import { validateSocial } from '../sim/social-save.ts';
import { validPawnSurgeryShape,validateSurgeries } from '../sim/surgery-save.ts';
import { validArtificialPartTransport,validArtificialPartsWorldTransportForSnapshot } from '../sim/health-save.ts';
import { validAnesthetic } from '../sim/anesthetic.ts';
import { validateScoutRegistry } from '../sim/caravan-save.ts';
import { validateCommercialRegistry,validateCommercialBindings } from '../sim/commercial-save.ts';
import { validateCivilianPost } from '../sim/commercial-post.ts';
import { validateQuests } from '../sim/quest-save.ts';
import { scoutRegistryView } from '../sim/caravan-trip.ts';
import { resourceMaxHp } from '../sim/thing-damage-rules.ts';
import { validPlantThermalFactor } from '../sim/thermal-plants.ts';
import { isPlant } from '../sim/plants.ts';
import { validOre } from '../sim/ore.ts';
import { validMiningDamage } from '../sim/mining-rules.ts';
import { validStoneIdentity } from '../sim/geology.ts';
import { ITEM_DEFINITIONS,V219_ITEM_IDS } from '../sim/items.ts';
import { validFoodContamination } from '../sim/food-poisoning-save.ts';
import { validHumanCorpseShape,validHumanBodyShape } from '../sim/burial-save.ts';
import {validFrameDamage256} from '../sim/roof-frame-256.ts';
import { validCorpseShape } from '../sim/corpse-save.ts';
import { validGunWorkShape } from '../sim/gun-work.ts';
import { validUnfinishedShape } from '../sim/unfinished.ts';
import { validApparelShape } from '../sim/apparel-save.ts';
import { validPrisonerPawnShape,validPrisonBreakBindings } from '../sim/prisoner-save.ts';
import { validWeaponShape } from '../sim/equipment-save.ts';
import { pileMaxHp } from '../sim/thing-damage-rules.ts';
import {validateSnowTransport} from '../sim/snow-save.ts';
import { SCHEMA_VERSION, type MaterialPile, type Pawn, type Resource, type Structure, type Terrain, type Tile, type World } from '../sim/types.ts';
import { STRUCTURE_DEFINITIONS } from '../sim/definitions.ts';
import { TileSnapshotCache, type TileDelta } from '../bridge/tile-snapshot-cache.ts';
import { PlanetValidationCache, type PlanetPreparation } from '../bridge/planet-validation-cache.ts';
import { validBackground } from '../sim/colonist-backgrounds.ts';
import type { HumanAge } from '../sim/human-age.ts';
import { validOfferedBackground } from '../sim/background-save.ts';
import { validMentalShape, validMeleeThreatShape, validateMental } from '../sim/mental-save.ts';
import { validMeleeShape, validStunShape, validateMelee } from '../sim/melee-save.ts';
import { validShootingShape,validShootingLeanOwner,validateShooting } from '../sim/shooting-save.ts';
import { validArchivedMeleeThreat,hasVisitorMedicalGuestMarker,validVisitorShape } from '../sim/visitor-save.ts';
import { validMechanoidShape,validateMechanoids } from '../sim/mechanoid-save.ts';
import { validMechCorpseShape,validMechSalvageLedger } from '../sim/mechanoid-corpse-save.ts';
import { validateMechanoidRaids } from '../sim/mechanoid-raid-save.ts';
import { validateMechanoidRanged } from '../sim/mechanoid-ranged-save.ts';
import { isMechanoidKind } from '../sim/mechanoid-definition.ts';
import { NumericMembership, type NumericMembershipSink } from '../sim/numeric-membership.ts';
import { captureOwnedStrictNamespace } from '../sim/owned-strict-namespace.ts';

export interface SnapshotChanges {
  readonly resourceIndices: readonly number[];
  readonly tileIndices: readonly number[];
}
interface SnapshotChangeStamp { journal: SnapshotChangeJournal; generation: number; epoch: number; revision: number }
interface SnapshotChangeRecord {
  readonly parentRevision: number;
  // Absent means membership/order was not proved stable across this edge.
  readonly resourceIndices: readonly number[] | undefined;
  readonly tileIndices: readonly number[];
}
const snapshotChangeStamps = new WeakMap<World, SnapshotChangeStamp>();
const emptyChangeIndices: readonly number[] = Object.freeze([]);
const emptySnapshotChanges: SnapshotChanges = Object.freeze({ resourceIndices: emptyChangeIndices, tileIndices: emptyChangeIndices });
const orderedChangeCopy = (indices: readonly number[]): readonly number[] => {
  const values=[...indices];
  // Numeric producers already emit ascending unique ordinals in the common
  // case. Keep the historical normalization for every atypical input.
  for(let i=0;i<values.length;i++)if(!Number.isSafeInteger(values[i])||values[i]!<0||i>0&&values[i-1]!>=values[i]!)
    return Object.freeze([...new Set(values)].sort((a,b)=>a-b));
  return Object.freeze(values);
};
interface SnapshotReadCache<T> {
  readonly generation:number;readonly epoch:number;readonly fromRevision:number;readonly toRevision:number;readonly result:T;
}

/** Decoder-private publication capability. Records never retain a World,
 * packet, resource or parent object; accepted Worlds are weak keys. */
/** @internal Shared publication capability; never exported by snapshot-changes. */
export class SnapshotChangeJournal {
  private generation = 0;
  private epoch = 0;
  private revision = 0;
  private readonly records = new Map<number, SnapshotChangeRecord>();
  private lastRead:SnapshotReadCache<SnapshotChanges|undefined>|undefined;
  private lastTileRead:SnapshotReadCache<readonly number[]|undefined>|undefined;

  private remember<T>(from:SnapshotChangeStamp,to:SnapshotChangeStamp,result:T):SnapshotReadCache<T> {
    return {generation:this.generation,epoch:this.epoch,fromRevision:from.revision,toRevision:to.revision,result};
  }
  private matches<T>(cache:SnapshotReadCache<T>|undefined,from:SnapshotChangeStamp,to:SnapshotChangeStamp):cache is SnapshotReadCache<T> {
    return !!cache&&cache.generation===this.generation&&cache.epoch===this.epoch&&cache.fromRevision===from.revision&&cache.toRevision===to.revision;
  }

  reset(world: World, epoch: number, revision: number): void {
    this.lastRead=undefined;this.lastTileRead=undefined;
    this.records.clear(); this.generation++; this.epoch = epoch; this.revision = revision;
    snapshotChangeStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  append(parent: World, world: World, epoch: number, revision: number,
    resourceIndices: readonly number[] | undefined, tileIndices: readonly number[]): void {
    this.lastRead=undefined;this.lastTileRead=undefined;
    const previous = snapshotChangeStamps.get(parent);
    if (!previous || previous.journal !== this || previous.generation !== this.generation
      || previous.epoch !== epoch || epoch !== this.epoch || previous.revision !== this.revision
      || revision <= previous.revision) {
      // A lost witness may only remove the optimization, never invent a suffix.
      this.reset(world, epoch, revision); return;
    }
    this.records.set(revision, Object.freeze({ parentRevision: previous.revision,
      resourceIndices: resourceIndices === undefined ? undefined : orderedChangeCopy(resourceIndices),
      tileIndices: orderedChangeCopy(tileIndices) }));
    if (this.records.size > 64) this.records.delete(this.records.keys().next().value!);
    this.revision = revision;
    snapshotChangeStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  read(from: SnapshotChangeStamp, to: SnapshotChangeStamp): SnapshotChanges | undefined {
    if (from.generation !== this.generation || to.generation !== this.generation
      || from.epoch !== this.epoch || to.epoch !== this.epoch || from.revision > to.revision) return undefined;
    if (from.revision === to.revision) return emptySnapshotChanges;
    if(this.matches(this.lastRead,from,to))return this.lastRead.result;
    const finish=(result:SnapshotChanges|undefined):SnapshotChanges|undefined=>{
      this.lastRead=this.remember(from,to,result);return result;
    };
    const resources = new Set<number>(), tiles = new Set<number>();
    let revision = to.revision;
    while (revision > from.revision) {
      const record = this.records.get(revision);
      if (!record || record.resourceIndices === undefined || record.parentRevision < from.revision
        || record.parentRevision >= revision) return finish(undefined);
      for (const index of record.resourceIndices) resources.add(index);
      for (const index of record.tileIndices) tiles.add(index);
      revision = record.parentRevision;
    }
    if (revision !== from.revision) return finish(undefined);
    // Both collections are already unique Sets; do not deduplicate them again.
    return finish(Object.freeze({ resourceIndices: Object.freeze([...resources].sort((a,b)=>a-b)), tileIndices: Object.freeze([...tiles].sort((a,b)=>a-b)) }));
  }

  /** The same accepted chronology, independent of resource membership/order.
   * A terrain consumer never needs to enumerate or allocate resource ordinals. */
  readTiles(from:SnapshotChangeStamp,to:SnapshotChangeStamp):readonly number[]|undefined {
    if(from.generation!==this.generation||to.generation!==this.generation
      ||from.epoch!==this.epoch||to.epoch!==this.epoch||from.revision>to.revision)return;
    if(from.revision===to.revision)return emptyChangeIndices;
    if(this.matches(this.lastTileRead,from,to))return this.lastTileRead.result;
    const finish=(result:readonly number[]|undefined):readonly number[]|undefined=>{
      this.lastTileRead=this.remember(from,to,result);return result;
    };
    const tiles=new Set<number>();let revision=to.revision;
    while(revision>from.revision){
      const record=this.records.get(revision);
      if(!record||record.parentRevision<from.revision||record.parentRevision>=revision)return finish(undefined);
      for(const index of record.tileIndices)tiles.add(index);
      revision=record.parentRevision;
    }
    if(revision!==from.revision)return finish(undefined);
    return finish(Object.freeze([...tiles].sort((a,b)=>a-b)));
  }
}

/** Only decoder-confirmed identities confer a witness. Unknown/mutable copies,
 * checkpoints, lost records or structural resource edges require a full read. */
export function readSnapshotChanges(from: World, to: World): SnapshotChanges | undefined {
  const before = snapshotChangeStamps.get(from), after = snapshotChangeStamps.get(to);
  if (!before || !after || before.journal !== after.journal) return undefined;
  return before.journal.read(before, after);
}

/** Accepted tile ordinals only. Resource birth/removal/reorder is not a terrain
 * gap; checkpoints, unknown copies, stale generations and eviction still are. */
export function readSnapshotTileChanges(from:World,to:World):readonly number[]|undefined {
  const before=snapshotChangeStamps.get(from),after=snapshotChangeStamps.get(to);
  if(!before||!after||before.journal!==after.journal)return;
  return before.journal.readTiles(before,after);
}

/** Domain gate only. It proves neither resource membership nor a sparse suffix;
 * consumers still own and compare all primitives needed for a full projection. */
export function sameSnapshotChangeDomain(from: World, to: World): boolean {
  const before = snapshotChangeStamps.get(from), after = snapshotChangeStamps.get(to);
  return !!before && !!after && before.journal === after.journal
    && before.generation === after.generation && before.epoch === after.epoch
    && before.revision <= after.revision
    && before.journal.read(before, before) !== undefined
    && before.journal.read(after, after) !== undefined;
}

export interface SnapshotStructureChanges {
  readonly structureIndices: readonly number[];
  readonly tileIndices: readonly number[];
}
interface StructureChangeStamp { journal: StructureChangeJournal; generation: number; epoch: number; revision: number }
interface StructureChangeRecord {
  readonly parentRevision: number;
  readonly structureIndices: readonly number[] | undefined;
  readonly tileIndices: readonly number[];
  readonly values: number;
}
const structureChangeStamps = new WeakMap<World, StructureChangeStamp>();
const emptyStructureChanges: SnapshotStructureChanges = Object.freeze({ structureIndices: emptyChangeIndices, tileIndices: emptyChangeIndices });
/** Independent of resource membership. Only primitive ordinals/tiles are kept;
 * consumers retain their constructive immutable-read mandate separately. */
/** @internal Shared publication capability; never exported by snapshot-changes. */
export class StructureChangeJournal {
  private generation = 0;
  private epoch = 0;
  private revision = 0;
  private values = 0;
  private readonly budget = 131072;
  private readonly records = new Map<number, StructureChangeRecord>();

  reset(world: World, epoch: number, revision: number): void {
    this.records.clear(); this.values = 0; this.generation++;
    this.epoch = epoch; this.revision = revision;
    structureChangeStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  append(parent: World, world: World, epoch: number, revision: number,
    structureIndices: readonly number[] | undefined, tileIndices: readonly number[]): void {
    const previous = structureChangeStamps.get(parent);
    if (!previous || previous.journal !== this || previous.generation !== this.generation
      || previous.epoch !== epoch || epoch !== this.epoch || previous.revision !== this.revision
      || revision <= previous.revision) {
      this.reset(world, epoch, revision); return;
    }
    const cost = structureIndices === undefined ? 0 : structureIndices.length + tileIndices.length;
    const indices = structureIndices !== undefined && cost <= this.budget ? orderedChangeCopy(structureIndices) : undefined;
    const tiles = indices === undefined ? emptyChangeIndices : orderedChangeCopy(tileIndices);
    const values = indices === undefined ? 0 : indices.length + tiles.length;
    this.records.set(revision, Object.freeze({ parentRevision: previous.revision,
      structureIndices: indices, tileIndices: tiles, values }));
    this.values += values;
    while (this.records.size > 64 || this.values > this.budget) {
      const key = this.records.keys().next().value!;
      this.values -= this.records.get(key)!.values; this.records.delete(key);
    }
    this.revision = revision;
    structureChangeStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  read(from: StructureChangeStamp, to: StructureChangeStamp): SnapshotStructureChanges | undefined {
    if (from.generation !== this.generation || to.generation !== this.generation
      || from.epoch !== this.epoch || to.epoch !== this.epoch || from.revision > to.revision) return undefined;
    if (from.revision === to.revision) return emptyStructureChanges;
    const structures = new Set<number>(), tiles = new Set<number>();
    let revision = to.revision;
    while (revision > from.revision) {
      const record = this.records.get(revision);
      if (!record || record.structureIndices === undefined || record.parentRevision < from.revision
        || record.parentRevision >= revision) return undefined;
      for (const index of record.structureIndices) structures.add(index);
      for (const index of record.tileIndices) tiles.add(index);
      revision = record.parentRevision;
    }
    if (revision !== from.revision) return undefined;
    return Object.freeze({ structureIndices: orderedChangeCopy([...structures]), tileIndices: orderedChangeCopy([...tiles]) });
  }
}

/** Confirmed stable structure IDs/order only. Read the returned ordinals from
 * `to`, never from a newer decoder World; no ownership is granted by this API. */
export function readSnapshotStructureChanges(from: World, to: World): SnapshotStructureChanges | undefined {
  const before = structureChangeStamps.get(from), after = structureChangeStamps.get(to);
  if (!before || !after || before.journal !== after.journal) return undefined;
  return before.journal.read(before, after);
}

export interface SnapshotResourceRemoval { readonly id: number; readonly beforeOrdinal: number }
export interface SnapshotResourcePlacement { readonly id: number; readonly afterOrdinal: number }
/** Primitive edits of one confirmed edge. Survivors preserve their relative
 * order; additions append. These ordinals belong to this edge, not a later
 * target or the decoder's current World. */
export interface SnapshotResourceStructureEdge {
  readonly parentRevision: number;
  readonly revision: number;
  readonly beforeCount: number;
  readonly afterCount: number;
  readonly removed: readonly SnapshotResourceRemoval[];
  readonly added: readonly SnapshotResourcePlacement[];
  readonly updated: readonly SnapshotResourcePlacement[];
}
export interface SnapshotResourceStructure {
  readonly edges: readonly SnapshotResourceStructureEdge[];
  readonly tileIndices: readonly number[];
}
export type ResourceStructureCandidate = Omit<SnapshotResourceStructureEdge, 'parentRevision' | 'revision'>;
interface ResourceStructureStamp { journal: ResourceStructureJournal; generation: number; epoch: number; revision: number }
interface ResourceStructureRecord {
  readonly parentRevision: number;
  readonly edge: SnapshotResourceStructureEdge | undefined;
  readonly tileIndices: readonly number[];
  readonly values: number;
}
const resourceStructureStamps = new WeakMap<World, ResourceStructureStamp>();
const emptyResourceStructure: SnapshotResourceStructure = Object.freeze({ edges: Object.freeze([]), tileIndices: emptyChangeIndices });
/** Separate capability: the historical ordinal journal/read is unchanged.
 * Neither a record nor its witness retains a packet, Resource or World. */
/** @internal Shared publication capability; never exported by snapshot-changes. */
export class ResourceStructureJournal {
  private generation = 0;
  private epoch = 0;
  private revision = 0;
  private budget = 1024;
  private values = 0;
  private readonly records = new Map<number, ResourceStructureRecord>();

  reset(world: World, epoch: number, revision: number, count: number): void {
    this.records.clear(); this.values = 0; this.generation++;
    this.epoch = epoch; this.revision = revision;
    // Four primitive edits per source, with an absolute memory bound. Overflow
    // removes only this optimization; it never changes presentation cadence.
    this.budget = Number.isSafeInteger(count) && count >= 0
      ? Math.min(131072, Math.max(1024, count * 4)) : 1024;
    resourceStructureStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  append(parent: World, world: World, epoch: number, revision: number,
    candidate: ResourceStructureCandidate | undefined, tileIndices: readonly number[], count: number): void {
    const previous = resourceStructureStamps.get(parent);
    if (!previous || previous.journal !== this || previous.generation !== this.generation
      || previous.epoch !== epoch || epoch !== this.epoch || previous.revision !== this.revision
      || revision <= previous.revision) {
      this.reset(world, epoch, revision, count); return;
    }
    const cost = candidate === undefined ? 0 : 4 + tileIndices.length
      + 2 * (candidate.removed.length + candidate.added.length + candidate.updated.length);
    let edge: SnapshotResourceStructureEdge | undefined;
    let tiles: readonly number[] = emptyChangeIndices;
    if (candidate !== undefined && cost <= this.budget) {
      const removals = Object.freeze(candidate.removed.map(edit => Object.freeze({ id: edit.id, beforeOrdinal: edit.beforeOrdinal }))
        .sort((a, b) => a.beforeOrdinal - b.beforeOrdinal));
      const placements = (edits: readonly SnapshotResourcePlacement[]): readonly SnapshotResourcePlacement[] =>
        Object.freeze(edits.map(edit => Object.freeze({ id: edit.id, afterOrdinal: edit.afterOrdinal }))
          .sort((a, b) => a.afterOrdinal - b.afterOrdinal));
      edge = Object.freeze({ parentRevision: previous.revision, revision,
        beforeCount: candidate.beforeCount, afterCount: candidate.afterCount,
        removed: removals, added: placements(candidate.added), updated: placements(candidate.updated) });
      tiles = orderedChangeCopy(tileIndices);
    }
    const values = edge === undefined ? 0 : cost;
    this.records.set(revision, Object.freeze({ parentRevision: previous.revision, edge, tileIndices: tiles, values }));
    this.values += values;
    while (this.records.size > 64 || this.values > this.budget) {
      const key = this.records.keys().next().value!;
      this.values -= this.records.get(key)!.values; this.records.delete(key);
    }
    this.revision = revision;
    resourceStructureStamps.set(world, { journal: this, generation: this.generation, epoch, revision });
  }

  read(from: ResourceStructureStamp, to: ResourceStructureStamp): SnapshotResourceStructure | undefined {
    if (from.generation !== this.generation || to.generation !== this.generation
      || from.epoch !== this.epoch || to.epoch !== this.epoch || from.revision > to.revision) return undefined;
    if (from.revision === to.revision) return emptyResourceStructure;
    const edges: SnapshotResourceStructureEdge[] = [], tiles = new Set<number>();
    let revision = to.revision;
    while (revision > from.revision) {
      const record = this.records.get(revision);
      if (!record || record.edge === undefined || record.parentRevision < from.revision
        || record.parentRevision >= revision) return undefined;
      edges.push(record.edge);
      for (const index of record.tileIndices) tiles.add(index);
      revision = record.parentRevision;
    }
    if (revision !== from.revision) return undefined;
    return Object.freeze({ edges: Object.freeze(edges.reverse()), tileIndices: orderedChangeCopy([...tiles]) });
  }
}

/** A structural witness only. Consumers compose chronological metadata to
 * `to`, then read that target's current records under their immutable-read
 * mandate. Never present skipped intermediate Worlds or resolve via slots of
 * a newer decoder World. Unknown order/mutable reads require the full path. */
export function readSnapshotResourceStructure(from: World, to: World): SnapshotResourceStructure | undefined {
  const before = resourceStructureStamps.get(from), after = resourceStructureStamps.get(to);
  if (!before || !after || before.journal !== after.journal) return undefined;
  return before.journal.read(before, after);
}

const validCapturedResourceId = (id: number): boolean => Number.isSafeInteger(id) && id > 0;

type DynamicWorld = Omit<NativeUIWorld298, 'tiles' | 'resources' | 'piles'> & { readonly piles?: never };
type StructurelessDynamicWorld = Omit<DynamicWorld, 'structures'> & { readonly structures?: never };
interface ResourceChanges { removed: number[]; upserted: Resource[]; order?: number[]; growth?:Float64Array }
interface PileChanges { removed: number[]; upserted: MaterialPile[]; order?: number[] }
export interface StructureChanges { removed: number[]; upserted: Structure[]; order?: number[] }
interface SnapshotHeader { corePhase297?:import('./core-phase-projection-297').CoreFullPhaseMetadata297; explorationApproachers?:import('../sim/exploration-door-256.ts').ExplorationApproacher256[]; geography?:PlanetGeographyTransport256; urgentThreats?:import('./urgent-threats').UrgentThreatSnapshot; motion?:import('../bridge/motion-tracks.ts').PawnTrack[]; audioCues?:import('../bridge/audio-cues.ts').AudioCue[]; type: 'snapshot'; epoch: number; revision: number; stepMs: number; speed: number }
function validMiningTransport(pawn:Pawn,version:number):boolean {
  return !(version<186&&pawn.skills&&Object.hasOwn(pawn.skills,'mining'))&&validMiningSkill(pawn.skills?.mining,version);
}
/** Private crisis/retaliation ownership follows the same shape contract as a
 * save. Target relations are checked after the complete delta is reconstructed. */
function validMentalTransport(pawn:Pawn,world:Pick<World,'schemaVersion'|'tick'|'width'|'height'|'phaseCore297'>):boolean {
  const coreNow297=isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):undefined;
  return !(world.schemaVersion<192&&Object.hasOwn(pawn,'meleeThreat'))
    &&validMentalShape(pawn.mental,world.schemaVersion,world.tick,world.width,world.height)
    &&validMeleeThreatShape(pawn.meleeThreat,world.schemaVersion,world.tick,coreNow297)
    &&validMeleeShape(pawn.melee,world.schemaVersion,world.tick,coreNow297);
}
/** Sparse historical offers keep both fields absent. Active owners use the
 * same age/profile rules on and off the map; archives are not rewritten. */
function validBackgroundTransport(value:unknown,version:number,offer=false):boolean {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const person=value as {background?:Pawn['background'];age?:HumanAge};
  if(version<191&&Object.hasOwn(person,'background'))return false;
  if(offer){
    if(version<191&&Object.hasOwn(person,'age'))return false;
    return validOfferedBackground(person,version);
  }
  return validHumanAgeForPawn256(person,version)&&validBackground(person.background,version,person.age);
}
/** The default type remains the complete historical protocol. Structure deltas
 * are an explicit opt-in transport form, never a partial World-field patch. */
export type SnapshotMessage<SparseStructures extends boolean = false> = SnapshotHeader & (
  | { kind: 'checkpoint'; world: NativeUIWorld298; structures?: never }
  | ({ kind: 'delta'; baseRevision: number; tiles?: TileDelta[]; resources?: ResourceChanges; piles?: PileChanges } & (
      | { world: DynamicWorld; structures?: never }
      | (SparseStructures extends true ? { world: StructurelessDynamicWorld; structures: StructureChanges } : never)
    ))
);

import { validPlantGrowthLight } from '../sim/plant-light-save.ts';

/** The new cultivated identity must not enter an older transport stream, even
 * without growth fields. Keep its physical and vital bounds shared with saves. */
function validDomesticHealroot(resource:Resource,world:World|DynamicWorld):boolean {
  if(hasPausedTreeClock(resource)&&!validPlantLife(resource,world.schemaVersion,world))return false;
  if(resource.kind!=='healroot')return true;
  if(world.schemaVersion<182||resource.amount!==1||resource.species!==undefined
    ||!Number.isSafeInteger(resource.id)||resource.id<1||resource.id>=world.nextId
    ||!Number.isSafeInteger(resource.x)||resource.x<0||resource.x>=world.width
    ||!Number.isSafeInteger(resource.z)||resource.z<0||resource.z>=world.height
    ||!validStoneIdentity(resource.stone,resource.kind,world.schemaVersion)
    ||!validPlantLife(resource,world.schemaVersion,world)
    ||!validPlantThermalFactor(resource,world.schemaVersion)
    ||resource.damage!==undefined&&(!Number.isSafeInteger(resource.damage)||resource.damage<1||resource.damage>=resourceMaxHp(resource)))return false;
  return resource.growth===undefined&&resource.growthTick===undefined
    ||typeof resource.growth==='number'&&Number.isFinite(resource.growth)&&resource.growth>=0&&resource.growth<=1
      &&Number.isSafeInteger(resource.growthTick)&&resource.growthTick!>=0&&resource.growthTick!<=world.tick;
}

/** Sparse clinical transport guard. Full anatomy, permissions and possession
 * relations remain save-validator responsibilities. A dead dossier uses its
 * frozen medical tick; live anesthesia must follow the confirmed World tick. */
function validSurgeryTransport(pawn:Pawn,world:Pick<World,'schemaVersion'|'tick'|'width'|'height'|'nextId'>):boolean {
  if(world.schemaVersion<179&&(Object.hasOwn(pawn,'surgery')||Object.hasOwn(pawn,'surgeryRequest')||pawn.health&&Object.hasOwn(pawn.health,'anesthetic')))return false;
  if(!validPawnSurgeryShape(pawn,world.schemaVersion,world))return false;
  if(!validArtificialPartTransport(pawn,world.schemaVersion,world.tick))return false;
  const record=pawn.health;
  if(isMechanoidKind(record?.body))return false;
  if(record?.anesthetic===undefined)return true;
  if(!record||typeof record!=='object'||Array.isArray(record)||record.body!==undefined||!validMedicalCivilHeader271(record,world.schemaVersion)||medicalCivilTick271(record)>world.tick||
    (record.death===undefined?medicalCivilTick271(record)!==world.tick:!record.death||typeof record.death!=='object'||Array.isArray(record.death)||record.death.tick!==medicalCivilTick271(record)))return false;
  return validAnesthetic(record.anesthetic,record.tick,world.schemaVersion>=179,pawn.id%20,medicalCivilTick271(record),world.schemaVersion);
}

/** New disease payloads use the same isolated record guard as save files.
 * Legacy dossiers do not acquire an additional anatomical census. */
function validImmuneDiseaseTransport(pawn:Pawn,world:Pick<World,'schemaVersion'|'tick'|'width'|'height'>,archived=false):boolean {
  const record=pawn.health;
  if(!record||!Object.hasOwn(record,'immuneDiseases')&&!['malaria','plague'].includes(record.death?.cause??''))return true;
  if(validateMedicalRecord(record,true,true,true,true,false,false,true,true,true,true,true,world.schemaVersion,world.schemaVersion>=127)!==null
    ||!validMedicalCivilHeader271(record,world.schemaVersion)||medicalCivilTick271(record)>world.tick||!archived&&!record.death&&medicalCivilTick271(record)!==world.tick)return false;
  const vomit=record.immuneDiseases?.malaria?.vomit;
  if(vomit&&(vomit.cell.x>=world.width||vomit.cell.z>=world.height||record.foodPoisoning?.vomit||record.flu?.vomit))return false;
  const status=medicalStatus(record);
  return status==='mobile'?pawn.state!=='dead'&&pawn.state!=='downed':pawn.state===status;
}

const equalResourceBase = (a: Resource, b: Resource): boolean => a.id === b.id && a.kind === b.kind && a.species === b.species && a.sown291 === b.sown291 && Object.hasOwn(a,'sown291') === Object.hasOwn(b,'sown291')
  && a.growthLight === b.growthLight && a.x === b.x && a.z === b.z && a.amount === b.amount && a.stone === b.stone && a.damage === b.damage
  && a.plantLife?.initialAgeCore === b.plantLife?.initialAgeCore && a.plantLife?.since === b.plantLife?.since && a.plantLife?.bornAt === b.plantLife?.bornAt
  && a.plantLife?.pausedTicks === b.plantLife?.pausedTicks && a.plantLife?.ageTick === b.plantLife?.ageTick && a.plantLife?.leaflessPausedTicks === b.plantLife?.leaflessPausedTicks
  && a.plantLife?.age === b.plantLife?.age && a.plantLife?.darkTicks === b.plantLife?.darkTicks
  && a.plantLife?.leaflessAt === b.plantLife?.leaflessAt && a.plantLife?.nextCheck === b.plantLife?.nextCheck
  && a.blight?.since === b.blight?.since && a.blight?.severity === b.blight?.severity && a.blight?.lastHarmTick === b.blight?.lastHarmTick
  && a.blight?.nextCheck === b.blight?.nextCheck && a.blight?.rng === b.blight?.rng;
const copyResource=(r:Resource):Resource=>({...r,...r.plantLife?{plantLife:{...r.plantLife}}:{},...r.blight?{blight:{...r.blight}}:{}});

/** Preserve own-property presence, nested values and exact floating-point bits. */
function equalPileValue(a:unknown,b:unknown):boolean {
  if(Object.is(a,b))return true;
  if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
  const left=Object.keys(a),right=Object.keys(b);
  return left.length===right.length&&left.every((key,index)=>key===right[index]&&Object.hasOwn(b,key)
    &&equalPileValue((a as Record<string,unknown>)[key],(b as Record<string,unknown>)[key]));
}
const copyPile=(pile:MaterialPile):MaterialPile=>structuredClone(pile);

/** A transport array has no holes or enumerable side properties. */
function denseArray(value:unknown):value is unknown[] {
  return Array.isArray(value)&&Object.keys(value).length===value.length
    &&Object.keys(value).every((key,index)=>key===String(index));
}
function validStructurePatchEntry(value:unknown,world:Pick<World,'nextId'|'width'|'height'|'schemaVersion'|'tick'>):value is Structure {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(!validCaveHiveBuilding256(value,world.schemaVersion,world)||!validAncientCasketField256(value,world.schemaVersion)||!validLocalRoadPropStructure256(value,world.schemaVersion,world)||!validHumanSleepingSpotStructureEntry(value,world.schemaVersion,world)||!validBedrollStructureEntry256(value,world.schemaVersion,world)||!validAncientMonumentBuilding256(value,world.schemaVersion))return false;
  if(!validShipCasketBuilding277(value,world.schemaVersion,world,world.tick,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):undefined))return false;
  if(!validShipComputerSensorsBuilding298(value,world.schemaVersion,world)||!validShipReactorBuilding275(value,world.schemaVersion,world,effectiveCore297(world))||!validShipHullBuilding276(value,world.schemaVersion,world))return false;
  if(!validAncientCasketBuilding256(value,world.schemaVersion,world,isCorePhysicalSchema297(Number(world.schemaVersion))?world.tick:undefined,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):undefined)||!validCryptosleepBuilding271(value,world.schemaVersion,world,world.tick,isCorePhysicalSchema297(Number(world.schemaVersion))?effectiveCore297(world):undefined))return false;
  const s=value as Structure;
  return Number.isSafeInteger(s.id)&&s.id>=1&&s.id<world.nextId
    &&typeof s.kind==='string'&&Object.hasOwn(STRUCTURE_DEFINITIONS,s.kind)
    &&Number.isSafeInteger(s.x)&&s.x>=0&&s.x<world.width
    &&Number.isSafeInteger(s.z)&&s.z>=0&&s.z<world.height
    &&Number.isSafeInteger(s.orientation)&&s.orientation>=0&&s.orientation<=3
    &&['standard','legacy-single'].includes(s.footprint)
    &&(s.bills===undefined||denseArray(s.bills));
}
/** Only reconstructs a private candidate. All ordinary business/namespace
 * guards still run below, including for unchanged retained structures. */
interface PreparedStructureChanges { structures: Structure[]; structureIndices: number[] | undefined }
function prepareStructureChanges(previous:World,world:Pick<World,'nextId'|'width'|'height'|'schemaVersion'|'tick'>,value:unknown):PreparedStructureChanges|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  const patch=value as StructureChanges;
  if(Object.keys(value).some(key=>!['removed','upserted','order'].includes(key))
    ||!Object.hasOwn(value,'removed')||!Object.hasOwn(value,'upserted')
    ||!denseArray(patch.removed)||!denseArray(patch.upserted)
    ||Object.hasOwn(value,'order')&&!denseArray(patch.order))return;
  const byId=new Map<number,Structure>();
  const ordinals=new Map<number,number>();
  let ordinal=0,stable=true;
  for(const structure of previous.structures){
    if(!Number.isSafeInteger(structure.id)||structure.id<1||structure.id>=world.nextId||byId.has(structure.id))return;
    // Capture the same ID read used by the historical Map insertion.
    const id=structure.id;byId.set(id,structure);
    if(!Number.isSafeInteger(id)||id<1||ordinals.has(id))stable=false;
    ordinals.set(id,ordinal++);
  }
  const touched=new Set<number>();
  const structureIndices:number[]=[];
  for(const id of patch.removed){
    stable=false;
    if(!Number.isSafeInteger(id)||id<1||id>=world.nextId||touched.has(id)||!byId.delete(id))return;
    touched.add(id);
  }
  for(const structure of patch.upserted){
    if(!validStructurePatchEntry(structure,world)||touched.has(structure.id))return;
    touched.add(structure.id);
    const id=structure.id;byId.set(id,structure);
    const index=ordinals.get(id);
    if(index===undefined)stable=false;
    else structureIndices.push(index);
  }
  if(patch.order!==undefined){
    if(patch.order.length!==byId.size||new Set(patch.order).size!==patch.order.length
      ||patch.order.some(id=>!Number.isSafeInteger(id)||!byId.has(id)))return;
    return {structures:patch.order.map(id=>byId.get(id)!),structureIndices:undefined};
  }
  // Existing IDs retain their slots; additions append in upsert order.
  return {structures:touched.size?[...byId.values()]:previous.structures,
    structureIndices:stable?structureIndices:undefined};
}

/** Check a transported pile using the same item and optional-state contracts as saves. */
function validPile(pile:MaterialPile,world:World|DynamicWorld,deferAnimalHolder=false):boolean {
  if(!pile||typeof pile!=='object'||Array.isArray(pile)||!Number.isSafeInteger(pile.id)||pile.id<1||pile.id>=world.nextId
    ||typeof pile.item!=='string'||!Object.hasOwn(ITEM_DEFINITIONS,pile.item))return false;
  if(!validNovelPile295(pile,world.schemaVersion))return false;
  if(!validProstheticWorkShape273(pile as unknown as Record<string,unknown>,world.schemaVersion))return false;
  if(!validSmithingWorkShape267(pile as unknown as Record<string,unknown>,world.schemaVersion))return false;
  if(world.schemaVersion<265&&['hops','wort','beer'].includes(pile.item))return false;
  if(pile.item==='pemmican'&&world.schemaVersion<248)return false;
  if(pile.item==='nutrient-paste-meal'&&world.schemaVersion<217)return false;
  if(pile.item==='chemfuel'&&(world.schemaVersion<218||pile.rot!==undefined))return false;
  if(pile.item==='neutroamine'&&(world.schemaVersion<206||pile.rot!==undefined))return false;
  const definition=ITEM_DEFINITIONS[pile.item],owner=pile.owner;
  if(pile.kind!==definition.kind||!Number.isSafeInteger(pile.quantity)||pile.quantity<1||pile.quantity>definition.stackLimit
    ||!owner||typeof owner!=='object'||Array.isArray(owner))return false;
  if(owner.type==='ground'){
    if(!Number.isSafeInteger(owner.x)||!Number.isSafeInteger(owner.z)||owner.x<0||owner.z<0||owner.x>=world.width||owner.z>=world.height
      ||Object.keys(owner).some(key=>!['type','x','z'].includes(key)))return false;
  }else if(owner.type==='pawn'||owner.type==='inventory'||owner.type==='equipment'||owner.type==='apparel'){
    if(!Number.isSafeInteger(owner.pawnId)||owner.pawnId<1||!world.pawns.some(p=>p.id===owner.pawnId)&&!(owner.type==='inventory'&&world.schemaVersion>=256&&(deferAnimalHolder||animalContentsOwner256(world,owner.pawnId)!==undefined))
      ||Object.keys(owner).some(key=>!['type','pawnId'].includes(key)))return false;
    if(pile.item==='pemmican'&&owner.type==='inventory'){
      const pawn=world.pawns.find(p=>p.id===owner.pawnId)!;
      if(!pawn&&!(world.schemaVersion>=256&&(deferAnimalHolder||animalContentsOwner256(world,owner.pawnId)!==undefined))||pawn&&!pawn.visitor&&(world.schemaVersion<250||Object.hasOwn(pawn,'mechKind')||pawn.health?.body!==undefined))return false;
    }
  }else if(owner.type==='job'){
    if(!Number.isSafeInteger(owner.jobId)||owner.jobId<1||!world.jobs.some(job=>job.id===owner.jobId)
      ||Object.keys(owner).some(key=>!['type','jobId'].includes(key)))return false;
  }else if(owner.type==='orbital-ship'){
    if(world.schemaVersion<216||!Number.isSafeInteger(owner.shipId)||!Array.isArray(world.orbital?.ships)||!world.orbital!.ships.some(s=>s?.id===owner.shipId)||Object.keys(owner).some(k=>!['type','shipId'].includes(k)))return false;
  }else if(owner.type==='orbital-cargo'){
    if(world.schemaVersion<216||!Number.isSafeInteger(owner.deliveryId)||!Array.isArray(world.orbital?.pending)||!world.orbital!.pending.some(d=>d?.id===owner.deliveryId)||Object.keys(owner).some(k=>!['type','deliveryId'].includes(k)))return false;
  }else if(owner.type==='grave'){
    if(world.schemaVersion<89||!Number.isSafeInteger(owner.graveId)||owner.graveId<1||!world.structures.some(s=>s.id===owner.graveId&&(s.kind==='grave'||world.schemaVersion>=256&&s.kind==='sarcophagus'))
      ||Object.keys(owner).some(key=>!['type','graveId'].includes(key)))return false;
  }else return false;
  if(Object.keys(pile).some(key=>!['id','kind','item','quantity','owner','rot','foodPoison','corpse','humanCorpse','mechCorpse','damage','unfinished','gunWork','flakWork','componentWork','artWork','smithingWork','prostheticWork273','apparel','weapon','haulRequested','innerResource','plantPack','egg','eggForbidden','forbidden',...((Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?['book']:[])].includes(key)))return false;
  if(!validMaterialPermission256(pile,world.schemaVersion))return false;
  if(!validEggPile256(pile,world.schemaVersion,heldDuckInventoryClock256(world,pile,world.schemaVersion,world.tick),world.nextId)||world.schemaVersion<256&&isFutureEcologyItem256(pile.item))return false;
  if(world.schemaVersion<194&&Object.hasOwn(pile,'mechCorpse'))return false;
  if(pile.haulRequested!==undefined&&(world.schemaVersion<28||pile.kind!=='chunk'||pile.haulRequested!==true))return false;
  if(pile.damage!==undefined&&(world.schemaVersion<87||!Number.isSafeInteger(pile.damage)||pile.damage<(pile.kind==='book'?0:1)||pile.damage>=pileMaxHp(pile,world.schemaVersion)))return false;
  const rot=pile.rot;
  if(!validToxicFalloutRotCredit294(rot,world.schemaVersion,pile.kind==='corpse'))return false;
  if(rot!==undefined&&(!rot||typeof rot!=='object'||!Number.isFinite(rot.progress)||rot.progress<0
    ||!Number.isSafeInteger(rot.atTick)||rot.atTick<0||rot.atTick>world.tick
    ||rot.rate!==undefined&&(!Number.isFinite(rot.rate)||rot.rate<0||rot.rate>1)))return false;
  const record=pile as unknown as Record<string,unknown>;
  return validFoodContamination(pile.foodPoison,pile.item,world.schemaVersion>=89)
    &&validMechCorpseShape(pile,world.schemaVersion,world.tick)
    &&(pile.item==='human-corpse'?validHumanCorpseShape(pile.humanCorpse,world.schemaVersion,world.tick):pile.humanCorpse===undefined)
    &&(pile.item==='human-corpse'||validCorpseShape(record,world.schemaVersion))
    &&(!pile.corpse||validCorpseConsumption(pile.corpse,world.tick))
    &&(world.schemaVersion>=178||!V190_ITEM_IDS.includes(pile.item))
    &&validUnfinishedShape(record,world.schemaVersion)&&validGunWorkShape(record,world.schemaVersion)
    &&validArtWorkShape(record,world.schemaVersion)&&validFlakWorkShape(record,world.schemaVersion)&&validComponentWorkShape(record,world.schemaVersion)
    &&validApparelShape(record,world.schemaVersion)
    &&validWeaponShape(record,world.schemaVersion)
    &&validTreePileShape(record,world.schemaVersion,world.tick,world.nextId,(raw,tick)=>validOriginalTreeResource(raw,world,world.schemaVersion,tick));
}

/** Only the new pharmaceutical envelope is added to the historical decoder.
 * Ingredient quotas and bill settings share the simulation's pure validators. */
function validMedicineTransport(world:World):boolean {
  const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
  const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const cell=(v:unknown)=>record(v)&&Object.keys(v).every(k=>k==='x'||k==='z')&&int(v.x,0,world.width-1)&&int(v.z,0,world.height-1);
  for(const station of [...world.structures,...world.packed.map(p=>p.building)])for(const bill of station.bills??[]){
    if(station.kind==='drug-lab'&&bill.recipe!=='make-medicine')return false;
    if(bill.recipe==='make-medicine'&&(world.schemaVersion<206||station.kind!=='drug-lab'||!int(bill.id,1,world.nextId-1)||!validBillSettings(bill,'make-medicine',world.schemaVersion)))return false;
  }
  const taskValid=(value:unknown,pawn:Pawn,queued:boolean):boolean=>{
    if(!record(value)||value.recipe!=='make-medicine')return true;
    if(world.schemaVersion<206||Object.keys(value).some(k=>!['recipe','stationId','billId','spot','actionCell','phase','ingredients','progress','workTicks','productId','storageId','storageQuantity'].includes(k))
      ||!int(value.stationId,1,world.nextId-1)||!int(value.billId,1,world.nextId-1)||!cell(value.spot)||!cell(value.actionCell)
      ||typeof value.phase!=='string'||!['gather','work','output'].includes(value.phase)||queued&&value.phase!=='gather'
      ||!int(value.progress,0,productionWorkTotal('make-medicine'))||!Array.isArray(value.ingredients)||value.ingredients.length>5
      ||value.workTicks!==undefined&&(value.phase!=='work'||!int(value.workTicks,1,Math.floor(Number.MAX_SAFE_INTEGER/1000)))
      ||value.phase==='work'&&value.workTicks===undefined
      ||value.storageQuantity!==undefined||!productionWorkerQualified(pawn,'make-medicine'))return false;
    const station=world.structures.find(s=>s.id===value.stationId&&s.kind==='drug-lab'),bill=station?.bills?.find(b=>b.id===value.billId&&b.recipe==='make-medicine');
    if(!station||!bill||bill.suspended)return false;
    const spot=cookingSpot(station);
    if((value.spot as {x:number;z:number}).x!==spot.x||(value.spot as {x:number;z:number}).z!==spot.z)return false;
    if(!queued&&(pawn.jobId!==null||pawn.haul!==null||pawn.need!==null||pawn.priorities.craft===0&&pawn.orders.active!=='cook'))return false;
    if(!queued&&value.phase==='work'&&(pawn.state!=='working'||pawn.x!==spot.x||pawn.z!==spot.z||pawn.path.length))return false;
    if(value.phase==='output'){
      const held=world.piles.filter(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id);
      return value.ingredients.length===0&&value.progress===0&&int(value.productId,1,world.nextId-1)
        &&held.length===1&&held[0]!.id===value.productId&&held[0]!.item==='medicine'&&held[0]!.quantity===1
        &&(value.storageId===null||int(value.storageId,1,world.nextId-1)&&!!storageCellById(world,value.storageId));
    }
    if(value.productId!==null||value.storageId!==null||value.phase==='gather'&&value.progress!==0)return false;
    for(const part of value.ingredients)if(!record(part)||Object.keys(part).some(k=>!['pileId','item','quantity','stage','cell'].includes(k))
      ||!int(part.pileId,1,world.nextId-1)||typeof part.item!=='string'||!int(part.quantity,1,3)||!cell(part.cell)
      ||typeof part.stage!=='string'||!['source','held','placed'].includes(part.stage)||queued&&part.stage==='held')return false;
    for(const part of value.ingredients){
      const pile=world.piles.find(p=>p.id===part.pileId);
      if(!pile||pile.item!==part.item||pile.quantity<part.quantity||!bill.filters[part.item as keyof typeof bill.filters])return false;
      if(part.stage==='held'){
        if(pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id||pile.quantity!==part.quantity)return false;
      }else if(pile.owner.type!=='ground'||reservedSource(world,pile.id)>pile.quantity
        ||part.stage==='placed'&&(pile.owner.x!==part.cell.x||pile.owner.z!==part.cell.z))return false;
    }
    if(value.ingredients.filter(part=>part.stage==='held').length>1)return false;
    if(value.phase==='work'&&value.ingredients.some(part=>part.stage!=='placed'))return false;
    return validMedicineIngredients('make-medicine',value.ingredients as {item:string;quantity:number}[]);
  };
  for(const pawn of world.pawns){
    if(!taskValid(pawn.cooking,pawn,false))return false;
    for(const order of pawn.orders.queue)if(typeof order==='object'&&order!==null&&'cooking' in order&&order.cooking.recipe==='make-medicine'
      &&(!validCookingOrder(order,world)||!taskValid(order.cooking,pawn,true)))return false;
  }
  return true;
}

/** Transport cache only: never mutates the simulation or contributes to a saved game. */
export class SnapshotEncoder<SparseStructures extends boolean = false> {
  private source: World | undefined;
  private epoch = 0;
  private revision = 0;
  private width = 0;
  private height = 0;
  private riverWater:World['riverWater'];
  private tiles = this.createTileCache();
  private resources = new Map<number, Resource>();
  private orderedResources: Resource[] = [];
  private piles = new Map<number, MaterialPile>();
  private orderedPiles: MaterialPile[] = [];
  private structures = new Map<number,Structure>();
  private orderedStructures: Structure[] = [];

  private readonly structureDeltaRequested:boolean;
  private readonly minimumStructures:number;
  private structureDelta=false;
  private campaignOnly=false;
  private readonly geographicTransport=new PlanetGeographyTransportEncoder256();
  /** Public default always performs complete value discovery. A fixed Worker
   * may own a separate subclass; no packet/boolean changes this authority. */
  protected trackNaturalInputs=false;
  protected naturalInputsUnchanged=false;
  protected createTileCache():TileSnapshotCache {return new TileSnapshotCache();}
  reserveDraftPreview(owner:import('../sim/world-geography-owner-256.ts').CampaignGeography256){return this.geographicTransport.reserveDraftPreview(owner);}
  authorizeDraftPreview(owner:import('../sim/world-geography-owner-256.ts').CampaignGeography256,id:number):void {this.geographicTransport.authorizeDraftPreview(owner,id);}
  discardDraftPreview():void {this.geographicTransport.discardDraftPreview();}
  encodeCampaignSummary(summary:CampaignSummary,checkpoint=false){return this.geographicTransport.encode(summary,checkpoint);}
  campaignHeader(checkpoint=false):{epoch:number;revision:number} {if(!this.campaignOnly||checkpoint){this.epoch++;this.revision=0;}this.campaignOnly=true;this.source=undefined;this.riverWater=undefined;this.tiles=this.createTileCache();this.resources.clear();this.piles.clear();this.structures.clear();this.orderedResources=[];this.orderedPiles=[];this.orderedStructures=[];return {epoch:this.epoch,revision:++this.revision};}
  constructor(options:{structureDelta?:SparseStructures;minimumStructures?:number} = {}) {
    const minimum=options.minimumStructures??0;
    if(!Number.isSafeInteger(minimum)||minimum<0)throw new RangeError('minimumStructures must be a nonnegative safe integer.');
    this.structureDeltaRequested=options.structureDelta===true;
    this.minimumStructures=minimum;
  }

  /** postMessage must follow synchronously: it owns cloning the returned dynamic state. */
  encode(world: World, stepMs: number, speed: number, checkpoint = false): SnapshotMessage<SparseStructures> {
    this.naturalInputsUnchanged=false;
    const actualExplorationWorld=world;
    if(world.worldMaps){const selected=registeredMapPresentation(world);if(!selected)throw Error('No selected map; publish campaignHeader and campaignOnlySummary.');world=selected;}
    this.campaignOnly=false;
    const replacement = world !== this.source || world.width !== this.width || world.height !== this.height || this.riverWater!==undefined&&world.riverWater===undefined;
    if (replacement) { this.epoch++; this.revision = 0; }
    const baseRevision = this.revision++;
    // Keep the REAL source/cache identity. Registered presentation is already
    // projected; the genuine monomap fallback must never publish its RAW owner.
    let transportWorld:World=world;
    if('escapedShips298' in world){const {escapedShips298:_raw,...surface}=world;transportWorld={...surface,...escapedShipProjection298(registeredCampaign(world))};}
    const geographic=this.geographicTransport.encode(transportWorld,replacement||checkpoint);
    const explorationApproachers=captureExplorationTransport256(actualExplorationWorld,world);
    const header: SnapshotHeader = { type: 'snapshot', epoch: this.epoch, revision: this.revision, stepMs, speed,...geographic.geography?{geography:geographic.geography}:{},...explorationApproachers?{explorationApproachers}:{} };
    if (replacement || checkpoint) {
      // Keep the protocol mode stable until an explicit full checkpoint.
      this.structureDelta=this.structureDeltaRequested&&world.structures.length>=this.minimumStructures;
      this.source = world; this.width = world.width; this.height = world.height; this.riverWater=world.riverWater;
      this.tiles.reset(world.tiles);
      this.orderedResources = world.resources.map(copyResource);
      this.resources = new Map(this.orderedResources.map(resource => [resource.id, resource]));
      this.orderedPiles = world.piles.map(copyPile);
      this.piles = new Map(this.orderedPiles.map(pile => [pile.id, pile]));
      if(this.structureDelta){
        this.orderedStructures=world.structures.map(s=>structuredClone(s));
        this.structures=new Map(this.orderedStructures.map(s=>[s.id,s]));
      }else if(this.orderedStructures.length){
        this.orderedStructures=[];this.structures.clear();
      }
      return { ...header, kind: 'checkpoint', world:geographic.state } as SnapshotMessage<SparseStructures>;
    }

    const tiles = this.tiles.diff(world.tiles);
    const upserted: Resource[] = [];
    const growthValues:number[]=[],growthUpdates:Resource[]=[];
    let nextOrder: Resource[] | undefined = world.resources.length !== this.orderedResources.length ? [] : undefined;
    let naturalSame=this.trackNaturalInputs&&world.resources.length===this.orderedResources.length;
    for (let index = 0; index < world.resources.length; index++) {
      const resource = world.resources[index]!;
      const ordered = this.orderedResources[index];
      const sameSlot = ordered?.id === resource.id;
      if (!sameSlot && !nextOrder) nextOrder = this.orderedResources.slice(0, index);
      // Most publications preserve order. Avoid hashing every unchanged plant,
      // but still compare values: simulation edits objects in place.
      const previous = sameSlot ? ordered : this.resources.get(resource.id);
      let cached = previous;
      const sameBase=previous!==undefined&&equalResourceBase(previous,resource);
      if(naturalSame&&(!sameSlot||!sameBase||!Object.is(previous!.growth,resource.growth)||!Object.is(previous!.growthTick,resource.growthTick)
        ||!Object.is(previous!.growthThermalFactor,resource.growthThermalFactor)||!Object.is(previous!.plantLife?.leaflessAt,resource.plantLife?.leaflessAt)
        ||Object.hasOwn(previous!,'plantLife')!==Object.hasOwn(resource,'plantLife')||Object.hasOwn(previous!,'blight')!==Object.hasOwn(resource,'blight')||!!previous!.blight!==!!resource.blight))naturalSame=false;
      if (!sameBase || previous!.growth!==resource.growth || previous!.growthTick!==resource.growthTick || previous!.growthThermalFactor!==resource.growthThermalFactor) {
        const copy = copyResource(resource);
        // Exact doubles, not rounded presentation values. A whole forest can
        // change its thermal growth factor without cloning its full identities.
        if(sameBase&&resource.growth!==undefined&&resource.growthTick!==undefined){
          growthValues.push(resource.id,resource.growth,resource.growthTick,resource.growthThermalFactor??NaN);growthUpdates.push(copy);
        }else upserted.push(copy);
        if (sameSlot) this.orderedResources[index] = copy;
        cached = copy;
      }
      nextOrder?.push(cached!);
    }
    let changes: ResourceChanges | undefined;
    if (upserted.length || growthUpdates.length || nextOrder) {
      const removed: number[] = [];
      changes = { removed, upserted };
      if(growthValues.length)changes.growth=new Float64Array(growthValues);
      // Metadata/quantities alone cannot alter membership or ordering. Only
      // structural edits need the ID set and an optional explicit order.
      if (nextOrder) {
        const currentIds = new Set(world.resources.map(resource => resource.id));
        const implicitOrder: number[] = [];
        for (const resource of this.orderedResources) {
          if (currentIds.has(resource.id)) implicitOrder.push(resource.id);
          else removed.push(resource.id);
        }
        for (const resource of upserted) if (!this.resources.has(resource.id)) implicitOrder.push(resource.id);
        if (implicitOrder.some((id, index) => id !== world.resources[index]?.id)) changes.order = world.resources.map(resource => resource.id);
      }
      for (const id of removed) this.resources.delete(id);
      for (const resource of upserted) this.resources.set(resource.id, resource);
      for (const resource of growthUpdates) this.resources.set(resource.id, resource);
      if (nextOrder) this.orderedResources = nextOrder;
    }
    const pileUpserts:MaterialPile[]=[];
    let nextPileOrder:MaterialPile[]|undefined=world.piles.length!==this.orderedPiles.length?[]:undefined;
    for(let index=0;index<world.piles.length;index++){
      const pile=world.piles[index]!,ordered=this.orderedPiles[index],sameSlot=ordered?.id===pile.id;
      if(!sameSlot&&!nextPileOrder)nextPileOrder=this.orderedPiles.slice(0,index);
      const previous=sameSlot?ordered:this.piles.get(pile.id);
      let cached=previous;
      if(!previous||!equalPileValue(previous,pile)){
        const copy=copyPile(pile);pileUpserts.push(copy);cached=copy;
        if(sameSlot)this.orderedPiles[index]=copy;
      }
      nextPileOrder?.push(cached!);
    }
    let pileChanges:PileChanges|undefined;
    if(pileUpserts.length||nextPileOrder){
      const removed:number[]=[];pileChanges={removed,upserted:pileUpserts};
      if(nextPileOrder){
        const currentIds=new Set(world.piles.map(p=>p.id)),implicitOrder:number[]=[];
        for(const pile of this.orderedPiles){
          if(currentIds.has(pile.id))implicitOrder.push(pile.id);
          else removed.push(pile.id);
        }
        for(const pile of pileUpserts)if(!this.piles.has(pile.id))implicitOrder.push(pile.id);
        if(implicitOrder.some((id,index)=>id!==world.piles[index]?.id))pileChanges.order=world.piles.map(p=>p.id);
      }
      for(const id of removed)this.piles.delete(id);
      for(const pile of pileUpserts)this.piles.set(pile.id,pile);
      if(nextPileOrder)this.orderedPiles=nextPileOrder;
    }
    const { tiles: _tiles, resources: _resources, piles: _piles, riverWater:_riverWater, ...dynamicWithoutRiver } = geographic.state;
    const dynamic={...dynamicWithoutRiver,..._riverWater!==this.riverWater&&_riverWater?{riverWater:_riverWater}:{}};
    this.riverWater=_riverWater;
    if(this.structureDelta){
      const upserted:Structure[]=[],cacheUpdates:Structure[]=[];
      let nextOrder:Structure[]|undefined=world.structures.length!==this.orderedStructures.length?[]:undefined;
      for(let index=0;index<world.structures.length;index++){
        const structure=world.structures[index]!,ordered=this.orderedStructures[index],sameSlot=ordered?.id===structure.id;
        if(!sameSlot&&!nextOrder)nextOrder=this.orderedStructures.slice(0,index);
        const previous=sameSlot?ordered:this.structures.get(structure.id);
        let cached=previous;
        // Never use mutable World identity or tick as a value witness. This
        // walks all nested own fields, exact doubles and property presence.
        if(!previous||!equalPileValue(previous,structure)){
          cached=structuredClone(structure);
          cacheUpdates.push(cached);
          // Outgoing records also cannot expose the private comparison cache.
          upserted.push(structuredClone(cached));
          if(sameSlot)this.orderedStructures[index]=cached;
        }
        nextOrder?.push(cached!);
      }
      const structureChanges:StructureChanges={removed:[],upserted};
      if(nextOrder){
        const currentIds=new Set(world.structures.map(s=>s.id)),implicitOrder:number[]=[];
        for(const structure of this.orderedStructures){
          if(currentIds.has(structure.id))implicitOrder.push(structure.id);
          else structureChanges.removed.push(structure.id);
        }
        for(const structure of upserted)if(!this.structures.has(structure.id))implicitOrder.push(structure.id);
        if(implicitOrder.some((id,index)=>id!==world.structures[index]?.id))structureChanges.order=world.structures.map(s=>s.id);
      }
      for(const id of structureChanges.removed)this.structures.delete(id);
      for(const structure of cacheUpdates)this.structures.set(structure.id,structure);
      if(nextOrder)this.orderedStructures=nextOrder;
      this.naturalInputsUnchanged=naturalSame&&tiles.length===0&&structureChanges.removed.length===0&&structureChanges.upserted.length===0&&structureChanges.order===undefined;
      const {structures:_structures,...sparseWorld}=dynamic;
      return {...header,kind:'delta',baseRevision,world:sparseWorld,structures:structureChanges,
        ...(tiles.length?{tiles}:{}),...(changes?{resources:changes}:{}),...(pileChanges?{piles:pileChanges}:{})} as SnapshotMessage<SparseStructures>;
    }
    return { ...header, kind: 'delta', baseRevision, world: dynamic,
      ...(tiles.length ? { tiles } : {}), ...(changes ? { resources: changes } : {}), ...(pileChanges ? { piles: pileChanges } : {}) } as SnapshotMessage<SparseStructures>;
  }
}

export type SnapshotAdoption = { status: 'applied'; world: World; replaced: boolean } | { status: 'stale' } | { status: 'resync'; reason: string };

/** Auxiliary queries only; every semantic guard still runs. A context belongs
 * to one synchronous adoption and is never committed to a later World. */
export interface SnapshotValidationContext {
  powerParents:PowerParentReader;
  geometry?:StagingGeometryReader;
  resourceFacts?:OwnedValidationResourceReader;
  /** Lazy default owner capture for one closed MAIN adoption only. Public readers remain complete. */
  humanOwners?:{read(world:World):HumanOwnershipCapture};
}

/** Reuses stable arrays and replaces changed arrays; previous render snapshots remain intact. */
interface ExpiredTreeFact {wrapperId:number;resourceId:number;quantity:number;packedAt:number;expiresAt:number;source:string}
const expiredTreeSource=(pile:MinifiedTreePile):string=>JSON.stringify(pile.innerResource,(_key,value)=>
  value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,value[k]])):value);
export class SnapshotDecoder {
  private collapsedRockIds=new Map<number,number>();
  private mineableIds=new Map<number,number>();
  private geographicCalendar?:{epoch:number;origin:number};
  private validGeographicCalendar(view:World,epoch:number,summary?:CampaignSummary):boolean {
    if(view.planet?.revision!==3)return true;
    const origin=summary?.calendarOrigin??(view.campaignMap?.revision===2?view.campaignMap.calendarOrigin:undefined);
    return Number.isSafeInteger(origin)&&(!this.geographicCalendar||this.geographicCalendar.epoch!==epoch||this.geographicCalendar.origin===origin);
  }
  private adoptGeographicCalendar(view:World,epoch:number,summary?:CampaignSummary):void {
    if(view.planet?.revision!==3){this.geographicCalendar=undefined;return;}
    const origin=summary?.calendarOrigin??(view.campaignMap?.revision===2?view.campaignMap.calendarOrigin:undefined);
    if(!Number.isSafeInteger(origin))throw Error('Unconfirmed geographic clock');
    this.geographicCalendar={epoch,origin:origin!};
  }
  private epoch = 0;
  private revision = 0;
  private current: World | undefined;
  // Independent causal values survive a campaign-only view; no validation cache.
  private confirmedNativeWorldPawnBirth:ReturnType<typeof captureNativeWorldPawnBirth256>;
  private confirmedFactionInitializations:ConfirmedFactionInitializations256|undefined;
  private readonly planetValidation = new PlanetValidationCache();
  private readonly geographicTransport=new PlanetGeographyTransportDecoder256();
  prepareDraftPreview(packet:unknown){return this.geographicTransport.prepareDraftPreview(packet);}
  authorizeDraftPreview(preview:import('../sim/world-geography-owner-256.ts').DraftGeographyPreview256):void {this.geographicTransport.authorizeDraftPreview(preview);}
  discardDraftPreview():void {this.geographicTransport.discardDraftPreview();}
  readonly #snapshotChanges = new SnapshotChangeJournal();
  readonly #structureChanges = new StructureChangeJournal();
  readonly #resourceStructure = new ResourceStructureJournal();
  #resourceStructureReady = false;
  #resourceStructureCount = 0;
  // The decoder owns immutable snapshots. Membership changes rebuild this
  // index; ordinary growth/metadata packets only copy the array of references.
  private resourceSlots = new Map<number, number>();
  private pileSlots = new Map<number, number>();
  // Only dead pending trees have epoch-local facts. Ordinary packets add no
  // index, retained-resource scan or mutable historical ownership registry.
  private expiredTreeWrappers:ReadonlyMap<number,ExpiredTreeFact>|undefined;
  private expiredTreeSources:ReadonlyMap<number,ExpiredTreeFact>|undefined;

  /** Public/mutable consumers retain the mutation-aware historical reader.
   * The closed MAIN subclass owns its fixed consumers and local query scope. */
  protected createValidationContext(_next:World,_resourceReuse?:OwnedResourceReuseWitness,_geometryReuse?:OwnedGeometryReuseWitness,_baseReuse?:OwnedResourceBaseReuseWitness):SnapshotValidationContext {
    return {powerParents:new PowerParentValidationCache()};
  }

  /** Closed MAIN may reuse only its privately certified unchanged structures.
   * Public decoders keep the complete RAW guard at the same refusal frontier. */
  protected validateDeteriorationTransport(next:World,_structureReuse?:OwnedGeometryReuseWitness):boolean {
    return validDeteriorationTransport(next,next.schemaVersion);
  }
  /** Closed MAIN may reuse only unchanged placed-structure provenance.
   * Public admission and all dynamic sleeping/clinical checks stay complete. */
  protected validateHumanSleepingSpotTransport(next:World,_structureReuse?:OwnedGeometryReuseWitness):boolean {
    return validHumanSleepingSpotTransport(next,next.schemaVersion);
  }
  /** Mutable/public decoders always inspect the entire plant population. */
  protected validateMarshTransport(next:World,changedTiles?:readonly number[],_resourceReuse?:OwnedResourceReuseWitness,_baseReuse?:OwnedResourceBaseReuseWitness):string[] {
    return validateMarshTransport(next,next.schemaVersion,changedTiles);
  }
  adoptCampaignOnly(packet:CampaignOnlyMessage,acceptExtra?:(view:World)=>boolean):{status:'applied';replaced:boolean;summary:CampaignSummary}|{status:'stale'}|{status:'resync';reason:string} {
    const refuse=()=>({status:'resync' as const,reason:'Campagne sans carte illisible.'});
    if(!Number.isSafeInteger(packet.epoch)||packet.epoch<1||!Number.isSafeInteger(packet.revision)||packet.revision<1||!Number.isFinite(packet.stepMs)||packet.stepMs<0||![0,1,3,6].includes(packet.speed))return refuse();
    if(packet.epoch<this.epoch||packet.epoch===this.epoch&&packet.revision<=this.revision)return {status:'stale'};
    if(!validPhaseCore297(packet.summary,packet.summary.schemaVersion)||!validCorePathBudget297(packet.summary,packet.summary.schemaVersion,packet.summary.tick,isCorePhysicalSchema297(Number(packet.summary.schemaVersion))?Number(Object.getOwnPropertyDescriptor(packet.summary,'phaseCore297')?.value):0,false))return refuse();
    if(!validVictoryContentHistorical298(packet.summary,packet.summary.schemaVersion))return refuse();
    if(!validShipEscapeHistorical298(packet.summary,packet.summary.schemaVersion)||!validEscapedShipsProjection298(packet.summary,packet.summary.schemaVersion,packet.summary.tick,packet.summary.nextId,isSchema298OrLater(Number(packet.summary.schemaVersion))&&'escapedShipsSummary298' in packet.summary?effectiveCore297(packet.summary):undefined))return refuse();
    if(!validWallDoorHistoricalTransport296(packet.summary,packet.summary.schemaVersion))return refuse();
    if(!validNovelHistoricalTransport295(packet.summary,packet.summary.schemaVersion))return refuse();
    if(!validToxicFalloutTransport294(packet.summary,packet.summary.schemaVersion)||!validPeaceTalksHistorical293(packet.summary,packet.summary.schemaVersion)||!validPartyHistoricalTransport292(packet.summary,packet.summary.schemaVersion)||!validForestryHistoricalTransport291(packet.summary,packet.summary.schemaVersion)||!validFirefoamHistoricalTransport290(packet.summary,packet.summary.schemaVersion)||!validBillPauseHistoricalTransport289(packet.summary,packet.summary.schemaVersion)||!validAnimalThermalRefugeHistoricalTransport288(packet.summary,packet.summary.schemaVersion)||!validAnimalAreaHistoricalTransport287(packet.summary,packet.summary.schemaVersion)||!validLinkedStorageHistorical286(packet.summary,packet.summary.schemaVersion)||!validCoupleHistoricalTransport285(packet.summary,packet.summary.schemaVersion)||!validTradeRequestHistorical284(packet.summary,packet.summary.schemaVersion)||!validApparelProvenanceHistoricalTransport284(packet.summary,packet.summary.schemaVersion))return refuse();
    if(!validWorldPawnsEnvelope256(packet.summary,packet.summary.schemaVersion,effectiveCore297(packet.summary),packet.summary.nextId))return refuse();
    if(!validPlanetGeographyHistorical256(packet.summary,packet.summary.schemaVersion))return refuse();
    const geographic=this.geographicTransport.prepare(packet.summary,packet.geography,Object.hasOwn(packet,'geography'),packet.epoch!==this.epoch);if(!geographic.ok)return refuse();
    if(!validCampaignSummary(geographic.state)||!validFirefoamWorld290(geographic.state)||!validBillPauseWorld289(geographic.state)||!validAnimalThermalRefugeWorld288(geographic.state)||!validAnimalAreaWorld287(geographic.state))return refuse();const summary=geographic.state.worldPawns?.nativeOrder?{...geographic.state}:geographic.state,view=groupWorld(summary,null);if(!view||!this.validGeographicCalendar(view,packet.epoch,summary))return refuse();
    const proof=this.planetValidation.prepare(view,view.schemaVersion,packet.epoch);if(!proof.ok)return refuse();
    if(packet.epoch===this.epoch&&!sameNativeWorldPawnBirth256(this.confirmedNativeWorldPawnBirth,view.worldPawns))return refuse();
    if(packet.epoch===this.epoch&&!sameFactionInitializations256(this.confirmedFactionInitializations,view.worldFactions))return refuse();
    const ids=new Set<number>();
    if(registerProjectedGroups(view,ids,proof.context,summary).length||registerProjectedFactionOwners256(view,ids,summary).length||registerProjectedWorldPawns256(view,ids,summary).length||registerProjectedWorldSites263(view,ids,summary).length||registerProjectedTradeRequests284(view,ids,summary).length||acceptExtra&&!acceptExtra(view)||!this.geographicTransport.canCommit(geographic)||!this.planetValidation.commit(proof))return refuse();
    if(!this.geographicTransport.commit(geographic))throw Error('Lost private geographic preparation after commit');
    freezeAdmittedNativeWorldPawnOrder256(summary);view.worldPawns=summary.worldPawns;
    this.adoptGeographicCalendar(view,packet.epoch,summary);
    this.confirmedNativeWorldPawnBirth=captureNativeWorldPawnBirth256(view.worldPawns);
    this.confirmedFactionInitializations=captureFactionInitializations256(view.worldFactions);
    const replaced=packet.epoch!==this.epoch;this.current=undefined;this.epoch=packet.epoch;this.revision=packet.revision;this.resourceSlots.clear();this.pileSlots.clear();this.expiredTreeSources=undefined;this.expiredTreeWrappers=undefined;return {status:'applied',replaced,summary};
  }
  adopt(packet: SnapshotMessage<true>,acceptExtra?:(view:World)=>boolean): SnapshotAdoption {
    const resync = (reason: string): SnapshotAdoption => ({ status: 'resync', reason });
    if (!Number.isSafeInteger(packet.epoch) || packet.epoch < 1
      || !Number.isSafeInteger(packet.revision) || packet.revision < 1) return resync('Révision de snapshot invalide.');
    if (packet.epoch < this.epoch || (packet.epoch === this.epoch && packet.revision <= this.revision)) return { status: 'stale' };
    if (!Number.isSafeInteger(packet.world.schemaVersion) || packet.world.schemaVersion < 1
      || packet.world.schemaVersion > SCHEMA_VERSION) return resync('Version de schéma du snapshot invalide.');
    if(!validPhaseCore297(packet.world,packet.world.schemaVersion)||!validCorePathBudget297(packet.world,packet.world.schemaVersion,packet.world.tick,isCorePhysicalSchema297(Number(packet.world.schemaVersion))?Number(Object.getOwnPropertyDescriptor(packet.world,'phaseCore297')?.value):0,true))return resync('Invalid physical clock or local path-budget owner.');
    if(packet.world.destroyed!==undefined&&!validNaturalHiveLoss256(packet.world.destroyed,packet.world.schemaVersion))return resync('Invalid or future natural Hive loss counter.');
    if(!validWorldPawnsEnvelope256(packet.world,packet.world.schemaVersion,effectiveCore297(packet.world),packet.world.nextId))return resync('Invalid or future WorldPawns header.');
    if(!validAnimalTrainingHistoricalTransport282(packet,packet.world.schemaVersion))return resync('Future animal training or hauling.');
    if(!validSmoothFloorsHistoricalTransport281(packet,packet.world.schemaVersion))return resync('Future natural stone smoothing.');
    if(!validPrisonerSurgeryHistoricalTransport280(packet,packet.world.schemaVersion))return resync('Future captive surgery.');
    if(!validApparelTradeHistoricalTransport279(packet,packet.world.schemaVersion))return resync('Future ordinary apparel inventory or trade.');
    if(!validApparelReservesHistoricalTransport278(packet,packet.world.schemaVersion))return resync('Future apparel reserve settings.');
    if(!validVictoryContentHistorical298(packet,packet.world.schemaVersion))return resync('Invalid or future victory content.');
    if(!validWallDoorHistoricalTransport296(packet,packet.world.schemaVersion))return resync('Invalid or future wall-door successor data.');
    if(!validNovelHistoricalTransport295(packet,packet.world.schemaVersion))return resync('Invalid or future Novel/reading data.');
    if(!validToxicFalloutTransport294(packet,packet.world.schemaVersion))return resync('Invalid or future ToxicFallout condition or corpse rot credit.');
    if(!validPeaceTalksHistorical293(packet,packet.world.schemaVersion)||!validPartyHistoricalTransport292(packet,packet.world.schemaVersion)||!validForestryHistoricalTransport291(packet,packet.world.schemaVersion)||!validFirefoamHistoricalTransport290(packet,packet.world.schemaVersion)||!validBillPauseHistoricalTransport289(packet,packet.world.schemaVersion)||!validAnimalThermalRefugeHistoricalTransport288(packet,packet.world.schemaVersion)||!validAnimalAreaHistoricalTransport287(packet,packet.world.schemaVersion)||!validLinkedStorageHistorical286(packet,packet.world.schemaVersion)||!validCoupleHistoricalTransport285(packet,packet.world.schemaVersion)||!validTradeRequestHistorical284(packet,packet.world.schemaVersion)||!validApparelProvenanceHistoricalTransport284(packet,packet.world.schemaVersion)||!validBillWorkerHistoricalTransport283(packet,packet.world.schemaVersion))return resync('Future couple or bill worker settings.');
    if(!validShipEscapeHistorical298(packet,packet.world.schemaVersion)||!validEscapedShipsProjection298(packet.world,packet.world.schemaVersion,packet.world.tick,packet.world.nextId,isSchema298OrLater(Number(packet.world.schemaVersion))&&'escapedShipsSummary298' in packet.world?effectiveCore297(packet.world):undefined))return resync('Invalid escaped-ship read projection.');
    if(!validShipCasketHistoricalTransport277(packet,packet.world.schemaVersion))return resync('Future spatial casket content.');
    if(!validShipPartHistoricalTransport276(packet,packet.world.schemaVersion))return resync('Pièce de vaisseau ou recherche moteur future dans ce snapshot.');
    if(!validShipReactorHistoricalTransport275(packet,packet.world.schemaVersion))return resync('Réacteur stellaire futur dans ce snapshot.');
    if(!validProstheticHistoricalTransport273(packet,packet.world.schemaVersion))return resync('Prothèses industrielles futures dans ce snapshot.');
    if(!validSpearHistoricalTransport272(packet,packet.world.schemaVersion))return resync('Catalogue de lances futur dans ce snapshot.');
    if(!validCryptosleepHistoricalTransport271(packet,packet.world.schemaVersion))return resync('Cryptosommeil futur dans ce snapshot.');
    if(!validPlanetGeographyHistorical256(packet.world,packet.world.schemaVersion))return resync('Géographie ou factions futures.');
    if(!validLocalRoadInfoEnvelope256(packet.world,packet.world.schemaVersion))return resync('Invalid local road state.');
    if(!validLocalGeyserEnvelope256(packet.world,packet.world.schemaVersion,packet.world.tick,packet.world.nextId))return resync('Invalid local geyser state.');
    if(!validExplorationTransportEnvelope256(packet,packet.world.schemaVersion)||Object.hasOwn(packet.world,'explorationApproachers')||!validExplorationHeader256(packet.world,packet.world.schemaVersion))return resync('Invalid exploration header or actor witness.');
    if(!validAncientShrineWarningEnvelope256(packet.world,packet.world.schemaVersion,packet.world.tick,packet.world.nextId))return resync('Invalid or future ancient shrine warning.');
    const geographic=this.geographicTransport.prepare(packet.world,packet.geography,Object.hasOwn(packet,'geography'),packet.epoch!==this.epoch);if(!geographic.ok)return resync(geographic.reason);
    packet={...packet,world:geographic.state} as SnapshotMessage<true>;
    const riverWater=prepareRiverWaterSnapshot256(packet.world,packet.world.schemaVersion,this.current,{kind:packet.kind,epoch:packet.epoch,revision:packet.revision,...packet.kind==='delta'?{baseRevision:packet.baseRevision}:{},previousEpoch:this.epoch,previousRevision:this.revision});
    if(!riverWater.ok)return resync('Invalid river water definition or predecessor.');
    if(riverWater.inherited)packet={...packet,world:{...packet.world,riverWater:riverWater.owner!}} as SnapshotMessage<true>;
    if(!validGroupForageHistoricalTransport256(packet.world,packet.world.schemaVersion,packet.kind==='delta'?packet.piles?.upserted:undefined))return resync('Propriétaire de récolte de caravane futur.');
    if(!validWorldMapHistorical(packet.world,packet.world.schemaVersion))return resync('Registre de cartes futur.');
    if(!validDeteriorationHistoricalTransport(packet,packet.world.schemaVersion))return resync('État de détérioration futur.');
    if(!validBurnApparelHistoricalTransport(packet,packet.world.schemaVersion))return resync('Recette de destruction de vêtement future.');
    if(!validGroupProvisionsHistoricalTransport(packet,packet.world.schemaVersion))return resync('Provisions mixtes de groupe futures.');
    if(!validGroupFreightHistoricalTransport(packet.world,packet.world.schemaVersion,packet.kind==='delta'?packet.piles?.upserted:undefined))return resync('Fret collectif futur.');
    if(!validTorchHistoricalTransport(packet,packet.world.schemaVersion))return resync('Lampe-torche future.');
    if(!validPemmicanHistoricalTransport(packet,packet.world.schemaVersion))return resync('Contenu de pemmican futur.');
    if(!validTuqueCatalogueTransport(packet,packet.world.schemaVersion))return resync('Contenu de tuque futur.');
    if(!validReconCatalogueTransport(packet,packet.world.schemaVersion))return resync('Contenu de reconnaissance futur.');
    if(!validCampaignPresentation(packet.world))return resync('Registre de campagne ou carte affichée invalide.');
    if(!validHumanSleepingSpotProvenance(packet.world,packet.world.schemaVersion))return resync('Provenance de couchage au sol humain invalide ou future.');
    const arrivalField=Object.getOwnPropertyDescriptor(packet.world,'startingArrival');
    if(arrivalField?(!Object.hasOwn(arrivalField,'value')||!arrivalField.enumerable||arrivalField.value===undefined
      ||!validStartingArrivalShape(arrivalField.value,packet.world.schemaVersion,packet.world)):'startingArrival' in packet.world)
      return resync('Forme ou horloge des capsules initiales invalide.');
    let message:SnapshotMessage;
    let structureIndices:readonly number[]|undefined;
    if(packet.kind==='delta'&&Object.hasOwn(packet,'structures')){
      // No ambiguous omission or mixed complete/patch form. Reconstruct before
      // the earliest structure guard, using only the confirmed predecessor.
      if(Object.hasOwn(packet.world,'structures'))return resync('Forme de transport des structures ambiguë.');
      const previous=this.current;
      if(!previous||packet.epoch!==this.epoch||!Number.isSafeInteger(packet.baseRevision)
        ||packet.baseRevision!==this.revision||packet.revision!==packet.baseRevision+1)return resync('Snapshot intermédiaire manquant.');
      if(packet.world.width!==previous.width||packet.world.height!==previous.height
        ||packet.world.schemaVersion!==previous.schemaVersion)return resync('Le delta appartient à une autre carte.');
      const prepared=prepareStructureChanges(previous,packet.world,packet.structures);
      if(!prepared)return resync('Delta de structures invalide.');
      const structures=prepared.structures;structureIndices=prepared.structureIndices;
      const {structures:_patch,...normalized}=packet;
      message={...normalized,world:{...packet.world,structures}} as SnapshotMessage;
    }else{
      if(Object.hasOwn(packet,'structures')||!Object.hasOwn(packet.world,'structures')
        ||!Array.isArray(packet.world.structures))return resync('Forme de transport des structures ambiguë.');
      message=packet as SnapshotMessage;
    }
    if(!validNaturalRoofState256(message.world.roofing,message.world.schemaVersion,message.world.width*message.world.height))return resync('Toiture naturelle future ou invalide.');
    if(!validVentTransport(message.world,message.world.schemaVersion))return resync('Bouche d’aération, état ou service futur/invalide.');
    if(message.world.schemaVersion<=195&&['planet','group','groupLosses'].some(key=>Object.hasOwn(message.world,key)))return resync('Planète ou propriétaire de groupe futur.');
    if(message.world.schemaVersion<=260&&Object.hasOwn(message.world.raids??{},'extraMechActive261'))return resync('Groupes mécaniques prospectifs futurs.');
    if(message.world.schemaVersion<194&&(Object.hasOwn(message.world,'mechanoids')||Object.hasOwn(message.world,'mechSalvage')
      ||['mechanoid','mechActive'].some(k=>Object.hasOwn(message.world.raids??{},k))
      ||['mechanoid','mechComposition'].some(k=>Object.hasOwn(message.world.raids?.last??{},k))))return resync('Propriétaire ou calendrier mécanique futur.');
    if(Object.hasOwn(message.world,'mechanoids')&&(!Array.isArray(message.world.mechanoids)||message.world.mechanoids.some(m=>!validMechanoidShape(m,message.world.schemaVersion,message.world.tick,undefined,isCorePhysicalSchema297(Number(message.world.schemaVersion))?effectiveCore297(message.world):undefined))))return resync('Forme mécanique invalide.');
    if(validateDuckFlyers256(message.world,message.world.schemaVersion).length)return resync('Invalid actual Duck holder before pile owner lookup.');
    if(message.world.wildlife?.animals.some(a=>isMechanoidKind(a.health?.body)))return resync('Dossier mécanique attribué à un animal.');
    if(message.world.schemaVersion<194&&[...message.world.structures,...message.world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>['smash-mechanoid','shred-mechanoid'].includes(b.recipe))))return resync('Facture mécanique future.');
    if(message.world.schemaVersion<197&&[...message.world.structures,...message.world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>V219_ITEM_IDS.some(item=>Object.hasOwn(b.filters??{},item)))))return resync('Filtre de facture mécanique futur.');
    if(!Array.isArray(message.world.stockpiles)||message.world.stockpiles.some(zone=>!validStorageConditions(zone,message.world.schemaVersion)))return resync('Plages de qualité ou de PV de réserve invalides pour ce snapshot.');
    if(!validStockpileZones(message.world,message.world.schemaVersion)||message.world.stockpiles.some(zone=>!Number.isInteger(zone.priority)||zone.priority<1||zone.priority>(message.world.schemaVersion>=219?5:4)))return resync('Identité de zone ou priorité de réserve invalide pour ce snapshot.');
    for(const zone of message.world.stockpiles){
      if(Object.hasOwn(zone.filters??{},'prosthesis')&&(!isSchema273OrLater(message.world.schemaVersion)||typeof zone.filters.prosthesis!=='boolean'))return resync('Filtre de prothèses invalide ou futur.');
      if(Object.hasOwn(zone.filters??{},'jade')&&(message.world.schemaVersion<256||typeof zone.filters.jade!=='boolean'))return resync('Filtre de jade invalide ou futur.');
      if(Object.hasOwn(zone.filters??{},'neutroamine')&&(message.world.schemaVersion<206||typeof zone.filters.neutroamine!=='boolean')
        ||Object.hasOwn(zone.items??{},'neutroamine')&&(message.world.schemaVersion<206||typeof zone.items!.neutroamine!=='boolean'))return resync('Filtre de neutroamine invalide ou futur.');
      if(message.world.schemaVersion<194&&(Object.hasOwn(zone.filters??{},'mech-corpse')||Object.hasOwn(zone.items??{},'scyther-corpse')))return resync('Filtre mécanique futur.');
      if(message.world.schemaVersion<197&&(Object.hasOwn(zone.items??{},'lancer-corpse')||Object.hasOwn(zone.items??{},'pikeman-corpse')))return resync('Filtre mécanique futur.');
    }
    if(!Array.isArray(message.world.growingZones)||message.world.growingZones.some(zone=>!zone||!isGrowingPlantInVersion291(zone.plant,message.world.schemaVersion)))return resync('Culture future ou inconnue dans ce snapshot.');
    if(message.world.fires!==undefined&&!validFireResourceLosses(message.world.fires?.ledger?.resources,message.world.schemaVersion))return resync('Pertes végétales du feu invalides pour ce snapshot.');
    if(message.world.schemaVersion<193&&(Object.hasOwn(message.world,'bombWaves')||Object.hasOwn(message.world.research??{},'gunTurrets')
      ||[...message.world.structures,...message.world.jobs,...message.world.packed.map(p=>p.building)].some(s=>s.kind==='mini-turret'||Object.hasOwn(s,'turret'))))return resync('Tourelle, recherche ou vague future.');
    for(const s of message.world.structures)if(Object.hasOwn(s,'turret')&&!validMiniTurretShape(s.turret,message.world.schemaVersion,effectiveCore297(message.world),message.world.nextId))return resync('Canon intrinsèque invalide.');
    if(Object.hasOwn(message.world,'bombWaves')&&(!Array.isArray(message.world.bombWaves)||message.world.bombWaves.some(w=>!validBombWaveShape(w,message.world.schemaVersion,isCorePhysicalSchema297(Number(message.world.schemaVersion))?effectiveCore297(message.world):undefined))))return resync('Forme de vague Bomb invalide.');
    let hasDraftedTend=false;const forcedConsumers:Pawn[]=[];
    for(const pawn of message.world.pawns){
      if(!validCouplePawnShape285(pawn,message.world.schemaVersion,message.world.tick))return resync('Activité, horloge ou souvenir de couple invalide ou futur.');
      if(!validCryptosleepTaskField271(pawn,message.world.schemaVersion,message.world.tick,message.world.nextId)||Object.hasOwn(pawn,'cryptosleepHeldAt271')||!validShipCasketTaskField277(pawn,message.world.schemaVersion,message.world.tick,message.world.nextId)||Object.hasOwn(pawn,'shipCryptosleepHeldAt277'))return resync('Tâche ou propriétaire local de cryptosommeil invalide.');
      if(pawn.health&&!validMedicalCivilHeader271(pawn.health,message.world.schemaVersion))return resync('Horloge médicale civile invalide ou future.');
      if(!validCaravanRestField266(pawn as unknown as Record<string,unknown>,message.world.schemaVersion,pawn.health?.death?.tick??message.world.tick))return resync('Trace de repos de caravane invalide ou future.');
      if(!validNativeHumanField256(pawn,message.world.schemaVersion))return resync('Identité humaine native invalide ou future.');
      if(!validArrivalRotation256(pawn,message.world.schemaVersion))return resync('Orientation d’arrivée invalide ou future.');
      if(!pawn||typeof pawn!=='object'||Array.isArray(pawn))return resync('Personne locale invalide pour ce snapshot.');
      if(hasVisitorMedicalGuestMarker(pawn)&&!validVisitorShape(pawn as unknown as Record<string,unknown>,message.world.schemaVersion,message.world as World))
        return resync('Admission médicale de visiteur invalide ou future.');
      if(hasDraftedTendingMarker(pawn)||pawn.draft&&pawn.tend){
        if(!hasDraftedTendingMarker(pawn)||!validTendShape(pawn.tend,message.world.schemaVersion,message.world))return resync('Forme de soins mobilisés invalide ou future.');
        hasDraftedTend=true;
      }
      if(hasForcedConsumptionDomain(pawn)){
        if(!validForcedConsumePawnShape(pawn,message.world.schemaVersion,message.world))return resync('Forme de consommation forcée invalide ou future.');
        forcedConsumers.push(pawn);
      }
      if(!validWorldAffiliationFields259(pawn as unknown as Record<string,unknown>,message.world.schemaVersion))return resync('Affiliation ou dossier captif futur/invalide.');
      if(Object.hasOwn(pawn,'emp'))return resync('Un effet EMP mécanique ne peut pas appartenir à une personne.');
      if(!validDeathThoughtsPawnShape(pawn as unknown as Record<string,unknown>,message.world.schemaVersion,message.world.tick))return resync('Souvenir de décès perçu invalide ou futur.');
      if(Object.hasOwn(pawn,'bombRefuge')&&!validBombRefugeShape(pawn.bombRefuge,message.world.schemaVersion))return resync('Refuge Bomb futur ou invalide.');
      if(!validMentalTransport(pawn,message.world))return resync('Crise mentale, menace ou autorité de mêlée invalide pour ce snapshot.');
      if(!validShootingShape(pawn.shooting,message.world.schemaVersion,message.world.tick,isCorePhysicalSchema297(Number(message.world.schemaVersion))?effectiveCore297(message.world):undefined)
        ||!validShootingLeanOwner(pawn,message.world,message.world.schemaVersion)
        ||pawn.shooting!==undefined&&!validStunShape(pawn.stun,message.world.schemaVersion,message.world.tick,45,isCorePhysicalSchema297(Number(message.world.schemaVersion))?effectiveCore297(message.world):undefined))return resync('Phase de tir humaine invalide pour ce snapshot.');
      if(!validBackgroundTransport(pawn,message.world.schemaVersion))return resync('Âge ou passé personnel invalide pour ce snapshot.');
      if(!validSurgeryTransport(pawn,message.world))return resync('État chirurgical ou anesthésique invalide pour ce snapshot.');
      if(!validImmuneDiseaseTransport(pawn,message.world))return resync('Maladie immunitaire invalide pour ce snapshot.');
      if(!validPawnPodRescue(pawn,message.world.schemaVersion,message.world))return resync('Mandat de secours civil invalide pour ce snapshot.');
      if(!validMiningTransport(pawn,message.world.schemaVersion))return resync('Compétence Minage invalide pour ce snapshot.');
      if(!validPlantSkill(pawn.skills?.plants,message.world.schemaVersion))return resync('Compétence Plantes invalide pour ce snapshot.');
      if(pawn.bereavement!==undefined&&!Object.hasOwn(message.world,'group')&&!Object.hasOwn(message.world,'groupLosses')&&!validBereavement(pawn.bereavement,pawn.id,message.world.schemaVersion,message.world))return resync('Souvenir de décès invalide pour ce snapshot.');
    }
    for(const owner of [message.world.scout,message.world.commercialTrip]){
      if(owner&&typeof owner==='object'&&'pawn' in owner&&hasDraftedTendingMarker(owner.pawn))return resync('Soins mobilisés détenus par une personne hors carte.');
      if(owner&&typeof owner==='object'&&'pawn' in owner&&Object.hasOwn(owner.pawn,'emp'))return resync('Effet EMP détenu par un voyageur humain.');
      if(owner&&typeof owner==='object'&&'pawn' in owner&&!validBackgroundTransport(owner.pawn,message.world.schemaVersion))return resync('Âge ou passé personnel hors carte invalide pour ce snapshot.');
      if(owner&&typeof owner==='object'&&'pawn' in owner&&(owner.pawn.mental?.crisis
        ||Object.hasOwn(owner.pawn,'bombRefuge')
        ||owner.pawn.melee?.order?.auto==='mental'||owner.pawn.melee?.order?.auto==='retaliation'
        ||!validArchivedMeleeThreat(owner.pawn,message.world,message.world.tick)))return resync('Crise mentale ou menace hors carte invalide.');
    }
    if(message.world.arrivals?.pending&&!validBackgroundTransport(message.world.arrivals.pending,message.world.schemaVersion,true))return resync('Profil d’accueil invalide pour ce snapshot.');
    if(Array.isArray(message.world.quests?.entries)&&message.world.quests.entries.some(quest=>!validBackgroundTransport(quest,message.world.schemaVersion,true)))return resync('Profil d’asile invalide pour ce snapshot.');
    if(!validMiscIncidents(message.world.miscIncidents,message.world.schemaVersion,message.world))return resync('Calendrier d’incidents divers invalide pour ce snapshot.');
    if(!validSmallIncidents(message.world.smallIncidents,message.world.schemaVersion,message.world))return resync('Calendrier de petites menaces invalide pour ce snapshot.');
    if(message.world.fluIncidents&&Object.hasOwn(message.world.fluIncidents,'immuneDiseases')&&!validFluIncidents(message.world as World,message.world.schemaVersion))return resync('Calendrier de maladies immunitaires invalide pour ce snapshot.');
    if(message.world.schemaVersion<184&&Object.hasOwn(message.world,'worldIncidents')||!validWorldIncidents(message.world.worldIncidents,message.world.schemaVersion,message.world))return resync('Calendrier mondial invalide pour ce snapshot.');
    if(!validFlashstorm(message.world.flashstorm,message.world.schemaVersion,message.world))return resync('Orage sec localisé invalide pour ce snapshot.');
    if((message.world.schemaVersion<181&&Object.hasOwn(message.world,'rainElectrical'))
      ||!validRainElectrical(message.world.rainElectrical,message.world.schemaVersion,message.world))return resync('Exposition électrique aux précipitations invalide pour ce snapshot.');
    if(!validPodRescueTransportBindings(message.world))return resync('Secours civil invalide pour ce snapshot.');
    if(message.kind==='checkpoint'&&(!Array.isArray(message.world.tiles)||message.world.tiles.some(tile=>!tile||!validCollapsedRock256(tile,message.world.schemaVersion,message.world.nextId,v=>admittedRoofTerrain256(v,message.world.schemaVersion))||!validMarshTile(tile,message.world.schemaVersion,message.world)||!validBridgeTile(tile,message.world.schemaVersion)||!validOre(tile,message.world.schemaVersion)||!validMiningDamage(tile,message.world.schemaVersion)||tile.floor!==undefined&&!floorAvailable(tile.floor,message.world.schemaVersion)||tile.floor==='sterile-tile'&&!sterileMaterialsUnlocked(message.world))))return resync('Rendement ou dégâts miniers invalides pour ce snapshot.');
    let next: World;
    let planetCheck: PlanetPreparation | undefined;
    let reindexResources = message.kind === 'checkpoint';
    let reindexPiles = message.kind === 'checkpoint';
    let changedResourceIds: number[] | undefined = [];
    let changedTileIndices: number[] = [];
    let resourceStructureCandidate: ResourceStructureCandidate | undefined;
    // Only full upserts can alter resource identity/spatial/substrate fields.
    // Growth tuples reconstruct those fields from the admitted predecessor.
    const resourceBaseUpdated:SnapshotResourcePlacement[]=[];
    let resourceStructureTouched: Set<number> | undefined;
    let resourceStructureRemoved: SnapshotResourceRemoval[] = [];
    let resourceStructureAllowed = this.#resourceStructureReady;
    if (message.kind === 'checkpoint') {
      if(message.world.tiles.some(t=>!validMineableTile256(t,message.world.schemaVersion,message.world.site?.revision===3,message.world.nextId)))return resync('Invalid full Mineable owner.');
      if(validateExploration256(message.world,message.world.schemaVersion).length)return resync('Invalid full exploration cells.');
      if (message.world.tiles.length !== message.world.width * message.world.height) return resync('Dimensions du checkpoint invalides.');
      if(!Array.isArray(message.world.piles)||message.world.piles.some(pile=>!validPile(pile,message.world)))return resync('Pile de checkpoint invalide.');
      next = message.world.worldPawns?.nativeOrder?{...message.world}:message.world;
    } else {
      const previous = this.current;
      if (!previous || message.epoch !== this.epoch || message.baseRevision !== this.revision
        || message.revision !== message.baseRevision + 1) return resync('Snapshot intermédiaire manquant.');
      if (message.world.width !== previous.width || message.world.height !== previous.height
        || message.world.schemaVersion !== previous.schemaVersion) return resync('Le delta appartient à une autre carte.');
      let tiles = previous.tiles;
      if (message.tiles?.length) {
        const touched = new Set<number>();
        if(message.tiles.some(tile=>!Array.isArray(tile)||Reflect.ownKeys(tile).some(k=>k!=='length'&&(typeof k!=='string'||!/^\d+$/.test(k)||Number(k)>=tile.length||(!Object.hasOwn(Object.getOwnPropertyDescriptor(tile,k)!,'value')||Object.getOwnPropertyDescriptor(tile,k)!.enumerable!==true)))||Array.from({length:tile.length},(_,i)=>i).some(i=>!Object.hasOwn(tile,i))||tile.length>(message.world.schemaVersion>=256?12:message.world.schemaVersion>=247?9:message.world.schemaVersion>=239?8:message.world.schemaVersion>=186?7:6)))return resync('Future snow/terrain tuple.');
        if(message.world.schemaVersion<186&&message.tiles.some(tile=>tile.length>6))return resync('Rendement minier futur dans ce delta.');
        for (const tuple of message.tiles) {
          const [index, terrain, stone, miningDamage, ore, floor, miningYield, snowDepth, bridge, collapsedRock,fogged,mineable]=tuple;
          if(tuple.length===10&&collapsedRock===undefined)return resync('Empty collapsed rock tuple.');
          if(tuple.length===11&&fogged===undefined)return resync('Empty exploration tuple.');
          if(tuple.length===12&&mineable===undefined)return resync('Empty Mineable tuple.');
          const candidate={terrain,...stone===undefined?{}:{stone},...miningDamage===undefined?{}:{miningDamage},...ore===undefined?{}:{ore},...miningYield===undefined?{}:{miningYield},...floor===undefined?{}:{floor},...snowDepth===undefined?{}:{snowDepth},...bridge===undefined?{}:{bridge},...collapsedRock===undefined?{}:{collapsedRock},...fogged===undefined?{}:{fogged},...mineable===undefined?{}:{mineable}};
          if(!validMineableTile256(candidate,message.world.schemaVersion,message.world.site?.revision===3,message.world.nextId))return resync('Invalid or future Mineable owner.');
          if(!validExplorationTile256(candidate,message.world.schemaVersion,Object.hasOwn(message.world,'exploration')))return resync('Invalid or future fog cell.');
          if(!validCollapsedRock256(candidate,message.world.schemaVersion,message.world.nextId,v=>admittedRoofTerrain256(v,message.world.schemaVersion)))return resync('Invalid or future collapsed rock.');
          if (!validBridgeTile(candidate,message.world.schemaVersion)||!validMarshTile(candidate,message.world.schemaVersion,message.world)||snowDepth!==undefined&&(message.world.schemaVersion<239||typeof snowDepth!=='number'||!Number.isFinite(snowDepth)||snowDepth<=0||snowDepth>1) || !Number.isInteger(index) || index < 0 || index >= tiles.length || touched.has(index)
            || floor!==undefined&&(message.world.schemaVersion<89||!floorAvailable(floor,message.world.schemaVersion)||floor==='sterile-tile'&&!sterileMaterialsUnlocked(message.world)) ||!validSmoothFloorTile281(candidate,message.world.schemaVersion)|| !validOre({terrain,ore},message.world.schemaVersion) || !validMiningDamage(candidate,message.world.schemaVersion) || !validStoneIdentity(stone,collapsedRock?.terrain??terrain,message.world.schemaVersion)) return resync('Delta de terrain invalide.');
          touched.add(index);
        }
        tiles = tiles.slice();
        for (const [index, terrain, stone, miningDamage, ore, floor, miningYield, snowDepth, bridge, collapsedRock,fogged,mineable] of message.tiles) tiles[index] = {terrain,...stone===undefined?{}:{stone},...miningDamage===undefined?{}:{miningDamage},...ore===undefined?{}:{ore},...floor===undefined?{}:{floor},...miningYield===undefined?{}:{miningYield},...snowDepth===undefined?{}:{snowDepth},...bridge===undefined?{}:{bridge},...collapsedRock===undefined?{}:{collapsedRock:{id:collapsedRock.id,terrain:collapsedRock.terrain}},...fogged===undefined?{}:{fogged},...mineable===undefined?{}:{mineable:{id:mineable.id,def:mineable.def,terrain:mineable.terrain}}};
        changedTileIndices = [...touched];
      }
      let resources = previous.resources;
      const beforeCount = this.#resourceStructureCount;
      resourceStructureAllowed &&= beforeCount === this.resourceSlots.size;
      resourceStructureCandidate = resourceStructureAllowed ? {
        beforeCount, afterCount: beforeCount, removed: [], added: [], updated: [],
      } : undefined;
      if (message.resources) {
        const { removed, upserted, order, growth } = message.resources;
        const sparse = !removed.length && !order && upserted.every(resource => this.resourceSlots.has(resource.id));
        let capturedBeforeCount = 0;
        const byId = sparse ? undefined : new Map<number, Resource>(resources.map((resource, ordinal): [number, Resource] => {
          // The same historical id read constructs the Map and checks the old
          // slot certificate. Never use cached records as reconstruction truth.
          const id = resource.id;
          capturedBeforeCount++;
          if (resourceStructureAllowed && (this.resourceSlots.get(id) !== ordinal
            || !validCapturedResourceId(id))) resourceStructureAllowed = false;
          return [id, resource];
        }));
        if (byId && capturedBeforeCount !== beforeCount) resourceStructureAllowed = false;
        if (order) resourceStructureAllowed = false;
        // Candidate mutations stay private until the complete packet validates.
        const patches = new Map<number, Resource>();
        const read = (id:number):Resource|undefined => byId ? byId.get(id) : resources[this.resourceSlots.get(id) ?? -1];
        const write = (resource:Resource):void => {
          const id = resource.id;
          if (resourceStructureAllowed && !validCapturedResourceId(id)) resourceStructureAllowed = false;
          if(byId)byId.set(id,resource);else patches.set(id,resource);
        };
        const touched = new Set<number>();
        for (const id of removed) {
          if (!byId!.delete(id) || touched.has(id)) return resync('Suppression de ressource invalide.');
          touched.add(id);
          if (resourceStructureAllowed) {
            const beforeOrdinal = this.resourceSlots.get(id);
            if (beforeOrdinal === undefined) resourceStructureAllowed = false;
            else resourceStructureRemoved.push({ id, beforeOrdinal });
          }
        }
        for (const resource of upserted) {
          if(!validDomesticHealroot(resource,message.world)||!validPlantGrowthLight(resource,message.world.schemaVersion,message.world.tick)||!validPlantLife(resource,message.world.schemaVersion,message.world)||!validCropBlight(resource,message.world.schemaVersion,message.world)||resource.damage!==undefined&&(message.world.schemaVersion<87||!Number.isSafeInteger(resource.damage)||resource.damage<1||resource.damage>=resourceMaxHp(resource)))return resync('État végétal invalide.');
          if (!validPlantThermalFactor(resource,message.world.schemaVersion)) return resync('Facteur thermique végétal invalide.');
          if (!validStoneIdentity(resource.stone, resource.kind, message.world.schemaVersion)) return resync('Identité géologique invalide.');
          if (touched.has(resource.id)) return resync('Ressource modifiée plusieurs fois.');
          touched.add(resource.id); write(resource);
          if(sparse){const afterOrdinal=this.resourceSlots.get(resource.id);if(afterOrdinal!==undefined)resourceBaseUpdated.push({id:resource.id,afterOrdinal});}
        }
        if(growth!==undefined){
          if(!(growth instanceof Float64Array)||growth.length%4||growth.length>previous.width*previous.height*4)return resync('Delta de croissance invalide.');
          for(let i=0;i<growth.length;i+=4){
            const id=growth[i]!,value=growth[i+1]!,tick=growth[i+2]!,factor=growth[i+3]!,old=read(id);
            if(!old||!isPlant(old)||touched.has(id)||!Number.isSafeInteger(id)||!Number.isFinite(value)||value<0||value>1||!Number.isSafeInteger(tick)||tick<0||tick>message.world.tick||!Number.isNaN(factor)&&(!Number.isFinite(factor)||factor<0||factor>1))return resync('Delta de croissance invalide.');
            const updated={...old,growth:value,growthTick:tick};
            if(Number.isNaN(factor))delete updated.growthThermalFactor;else updated.growthThermalFactor=factor;
            if(!validPlantLife(updated,message.world.schemaVersion,message.world)||!validPlantThermalFactor(updated,message.world.schemaVersion)||!validCropBlight(updated,message.world.schemaVersion,message.world))return resync('Delta de croissance invalide.');
            touched.add(id);write(updated);
          }
        }
        if (order) {
          if (order.length !== byId!.size || new Set(order).size !== order.length
            || order.some(id => !byId!.has(id))) return resync('Ordre des ressources invalide.');
          resources = order.map(id => byId!.get(id)!);
        } else if(byId) resources = [...byId.values()];
        else {
          resources = resources.slice();
          for(const [id,resource] of patches)resources[this.resourceSlots.get(id)!]=resource;
        }
        reindexResources = !sparse;
        changedResourceIds = sparse ? [...touched] : undefined;
        resourceStructureTouched = touched;
        if (resourceStructureAllowed && sparse) {
          const updated: SnapshotResourcePlacement[] = [];
          for (const id of touched) {
            const afterOrdinal = this.resourceSlots.get(id);
            // Getter changes between touched/write are not a structural proof.
            if (afterOrdinal === undefined || !patches.has(id)) { resourceStructureAllowed = false; break; }
            updated.push({ id, afterOrdinal });
          }
          if (patches.size !== touched.size) resourceStructureAllowed = false;
          resourceStructureCandidate = resourceStructureAllowed ? {
            beforeCount, afterCount: beforeCount, removed: [], added: [], updated,
          } : undefined;
        } else resourceStructureCandidate = undefined;
      }
      let piles=previous.piles;
      if(message.piles){
        const {removed,upserted,order}=message.piles;
        if(!Array.isArray(removed)||!Array.isArray(upserted)||order!==undefined&&!Array.isArray(order))return resync('Delta de piles invalide.');
        const sparse=!removed.length&&!order&&upserted.every(p=>p&&this.pileSlots.has(p.id));
        const byId=sparse?undefined:new Map(piles.map(p=>[p.id,p]));
        const patches=new Map<number,MaterialPile>(),touched=new Set<number>();
        for(const id of removed){
          if(!Number.isSafeInteger(id)||touched.has(id)||!byId?.delete(id))return resync('Suppression de pile invalide.');
          touched.add(id);
        }
        for(const pile of upserted){
          if(!validPile(pile,message.world,true)||touched.has(pile.id))return resync('Pile modifiée invalide.');
          touched.add(pile.id);
          if(byId)byId.set(pile.id,pile);else patches.set(pile.id,pile);
        }
        if(order){
          if(order.length!==byId!.size||new Set(order).size!==order.length||order.some(id=>!Number.isSafeInteger(id)||!byId!.has(id)))return resync('Ordre des piles invalide.');
          piles=order.map(id=>byId!.get(id)!);
        }else if(byId)piles=[...byId.values()];
        else if(patches.size){
          piles=piles.slice();
          for(const [id,pile] of patches)piles[this.pileSlots.get(id)!]=pile;
        }
        reindexPiles=!sparse;
      }
      // Keep the checkpoint's property order for exact JSON/save comparisons.
      next = { ...previous, ...message.world, tiles, resources, piles };
      // DynamicWorld is a complete replacement, not a partial field patch.
      // In particular an absent sparse collection means it was removed.
      for(const key of Object.keys(previous) as (keyof World)[])if(key!=='tiles'&&key!=='resources'&&key!=='piles'&&!Object.hasOwn(message.world,key))delete (next as Partial<World>)[key];
    }
    // Captures live only in this synchronous adoption, with no World writes
    // between these guards. The public context checks power keys on every read;
    // the closed MAIN context captures stable auxiliary queries once. Identity
    // views keep their distinct domains. Refusal retains none of these caches.
    // This scratch witness is offered only after the historical sequence and
    // sparse-slot checks. It is not the public post-commit change journal and
    // grants no ownership to public callers. Checkpoints/remaps stay full.
    const resourceReuse:OwnedResourceReuseWitness|undefined=!reindexResources
      &&resourceStructureAllowed&&resourceStructureCandidate&&this.current
      ?{kind:'sparse',previous:this.current,updated:resourceStructureCandidate.updated}:undefined;
    const resourceBaseReuse:OwnedResourceBaseReuseWitness|undefined=resourceReuse
      ?{kind:'resource-base',previous:resourceReuse.previous,updated:resourceBaseUpdated}:undefined;
    // Defined only by the verified sparse branch above; do not re-read packet
    // properties to infer authority here. Public contexts ignore this fact.
    const geometryReuse:OwnedGeometryReuseWitness|undefined=structureIndices!==undefined&&this.current
      ?{kind:'sparse',previous:this.current,updatedOrdinals:structureIndices}:undefined;
    // Old packets cannot introduce the new local inventory combination via
    // retained piles and a changed visitor owner either. Current253 is O(1).
    if(!validGroupFreightHistoricalTransport(next,next.schemaVersion))return resync('Fret collectif futur.');
    if(!this.validateDeteriorationTransport(next,geometryReuse))return resync('Horloge ou propriétaire de détérioration invalide.');
    if(!validTorchTransport(next,next.schemaVersion))return resync('Lampe-torche, carburant ou propriétaire de recharge invalide.');
    if(!validPemmicanCatalogueDomains(next,next.schemaVersion)||!validPemmicanResearchTransport(next,next.schemaVersion))return resync('Pemmican, recherche ou production future/invalide.');
    if(!validTundraTransport(next,next.schemaVersion))return resync('Toundra, flore ou climat futur/incohérent.');
    if(validateAncientCasketPhysical256(next).length)return resync('Invalid actual casket physical owner.');
    if(!validCryptosleepResearchTransport271(next,next.schemaVersion)||!validCryptosleepTaskTransport271(next)||!validShipCasketTaskTransport277(next))return resync('Recherche, caisson ou service de cryptosommeil invalide.');
    if(next.structures.some(s=>!validApparelReservesBuilding278(s,next.schemaVersion))||next.packed.some(p=>!validApparelReservesBuilding278(p.building,next.schemaVersion)))return resync('Réglages de réserve vestimentaire invalides ou futurs.');
    if(!validApparelTradeWorld279(next))return resync('Propriétaire vestimentaire commercial invalide.');
    if(validateBridgeTransport(next,next.schemaVersion,message.kind==='delta'?changedTileIndices:[]).length)return resync('Fondation future, chantier ou support invalide.');
    if(this.validateMarshTransport(next,message.kind==='delta'?changedTileIndices:[],resourceReuse,resourceBaseReuse).length)return resync('Marais futur, sans support ou fertile invalide.');
    if(validateSnowTransport(next,next.schemaVersion, message.kind==='delta'&&!!this.current?.snow===!!next.snow?changedTileIndices:undefined).length)return resync('Snow surface clock, depth or owner invalid.');
    if(validateStartingArrivalOwners(next,next.schemaVersion).length)return resync('Personne, possession ou propriétaire de capsule initiale invalide.');
    if(hasDraftedTend&&!validDraftedTendingTransport(next))return resync('Soins mobilisés, patient, contact ou réservation incohérents.');
    if(!validVisitorMedicalTransport(next))return resync('Invité médical, secours, lit ou possession incohérents.');
    if(!validDraftedRescueTransport(next))return resync('Secours mobilisé, autorité ou portage incohérents.');
    if(this.current&&message.epoch===this.epoch&&!validVisitorMedicalTransition(this.current,next))
      return resync('Admission médicale d’un visiteur réécrite dans cette partie.');
    if(forcedConsumers.length?!validForcedConsumeTransport(next,forcedConsumers):!validForcedConsumeOwners(next))return resync('Consommation forcée, propriétaire, source, contact ou réservation incohérents.');
    if(!this.validateHumanSleepingSpotTransport(next,geometryReuse))return resync('Couchage au sol humain, propriétaire, rôle ou réservation physique invalide ou futur.');
    if(this.current&&message.epoch===this.epoch&&!validStartingArrivalTransition(this.current,next))
      return resync('Contenu ou transfert des capsules initiales réécrit dans cette partie.');
    if(!validGroupForageHistoricalTransport256(next,next.schemaVersion))return resync('Propriétaire de récolte de caravane futur.');
    if(message.kind==='delta'&&this.current&&Object.hasOwn(this.current,'exploration')!==Object.hasOwn(next,'exploration')&&validateExploration256(next,next.schemaVersion).length)return resync('Invalid exploration ownership transition.');
    const exploration=prepareExplorationTransport256(message,next);
    if(!exploration.ok||validateDoors(next,next.schemaVersion,exploration.resolve).length||!validBlindMineTransport256(next))return resync('Invalid exploration actor, door or blind mining intent.');
    const validation=this.createValidationContext(next,resourceReuse,geometryReuse,resourceBaseReuse),powerTopology=validation.powerParents;
    if(next.schemaVersion<256&&([...next.structures,...next.jobs,...next.packed.map(pack=>pack.building)].some(entity=>entity.material==='jade')||next.piles.some(pile=>pile.item==='jade'||pile.kind==='jade'||pile.artWork?.material==='jade')))return resync('Jade ou matière future dans un ancien snapshot.');
    const identities=new ValidationIdentityContext(next,validation.resourceFacts);
    const oldDeadWrappers=message.epoch===this.epoch?this.expiredTreeWrappers:undefined;
    const oldDeadSources=message.epoch===this.epoch?this.expiredTreeSources:undefined;
    let addedDeadTrees:MinifiedTreePile[]|undefined,invalidDeadTree=false;
    const collectTree=(pile:MinifiedTreePile)=>{
      const old=oldDeadWrappers?.get(pile.id)??oldDeadSources?.get(pile.innerResource.id),pending=pile.plantPack.pendingExpiry;
      if(old){
        if(!pending||pile.id!==old.wrapperId||pile.innerResource.id!==old.resourceId||pending.quantity!==old.quantity||pile.plantPack.packedAt!==old.packedAt||pile.plantPack.expiresAt!==old.expiresAt||expiredTreeSource(pile)!==old.source)invalidDeadTree=true;
      }else if(pending)(addedDeadTrees??=[]).push(pile);
    };
    if(next.jobs.some(j=>!validTreeJobShape(j,next.schemaVersion,next.nextId)||!validPlantTargetShape(j,next.schemaVersion,next.nextId))||!validateTreeTransport(next,next.schemaVersion,collectTree)||invalidDeadTree)return resync('Invalid tree transfer domain.');
    // Retained resources could not already be this original; only actual
    // checkpoint records or delta upserts can attempt to resurrect it.
    if(oldDeadSources?.size&&(message.kind==='checkpoint'?next.resources:message.resources?.upserted??[]).some(r=>oldDeadSources.has(r.id)))return resync('Expired tree original cannot become a living resource in this epoch.');
    if(!validBiofuelTransport(next,next.schemaVersion,powerTopology,true,validation.geometry))return resync('Biocarburant, propriétaire original ou ravitaillement invalide.');
    if(!validAllowedAreaTransport(next,next.schemaVersion))return resync('Zone autorisée, affectation originale ou retour invalide ou futur.');
    if(!validDoubleBedTransport(next,next.schemaVersion))return resync('Lit double, place ou réservation invalide ou futur.');
    if(!validFodderTransport(next,next.schemaVersion)||!validKibbleProductionTransport(next,next.schemaVersion,false,true,validation.geometry))return resync('Fourrage, alimentation ou propriétaire de croquettes invalide ou futur.');
    if(!validShelfTransport(next,next.schemaVersion)||!validShelfGround(next))return resync('Étagère, cellules ou contenu physique invalide ou futur.');
    if(!validSpikeTrapTransport(next,next.schemaVersion))return resync('Piège à pointes, contact ou propriétaire invalide ou futur.');
    if(!validCremationTransport(next,next.schemaVersion,powerTopology,true,validation.geometry))return resync('Crématorium, filtre ou corps réservé invalide ou futur.');
    if(!validBurnApparelTransport(next,next.schemaVersion,true,validation.geometry))return resync('Recette, vêtement ou propriétaire de brûlage invalide ou futur.');
    if(!validSmeltingTransport(next,next.schemaVersion,powerTopology,true,validation.geometry))return resync('Fonderie, filtre, arme ou propriétaire de fusion invalide ou futur.');
    if(!validNutrientPasteTransport(next,next.schemaVersion,powerTopology))return resync('Pâte nutritive, source ou transport invalide.');
    if(!validOrbitalTransport(next,next.schemaVersion,powerTopology,identities))return resync('État orbital, propriétaire ou contact invalide.');
    if(!validCraftingFuelTransport269(next,next.schemaVersion))return resync('Ravitaillement d’artisanat invalide ou futur.');
    if(!validProstheticsResearchTransport273(next,next.schemaVersion)||validateProstheticWorks273(next,next.schemaVersion).length)return resync('Recherche ou ouvrage de prothèse invalide.');
    if(!validProstheticHistoricalTransport273(message,next.schemaVersion))return resync('Prothèses industrielles futures dans ce snapshot.');
    if(!validSpearHistoricalTransport272(message,next.schemaVersion))return resync('Catalogue de lances futur dans ce snapshot.');
    if(!validLongswordHistoricalTransport270(message,next.schemaVersion)||!validLongBladesResearchTransport270(next,next.schemaVersion))return resync('Lames longues, recherche ou fabrication invalides.');
    if(!validMaceHistoricalTransport269(message,next.schemaVersion)||!validKnifeHistoricalTransport268(message,next.schemaVersion)||!validSmithyResearchTransport267(next,next.schemaVersion)||!validSmithingHistoricalTransport267(message,next.schemaVersion)||validateSmithingWorks267(next,next.schemaVersion).length)return resync('Forge, matière ou ouvrage invalide.');
    if(!validAlcoholWorld265(next,next.schemaVersion))return resync('Alcool, politique ou propriétaire invalide.');
    if(!validBrewingHistoricalTransport265(message,next.schemaVersion)||!validFermentationWorld265(next,next.schemaVersion)||!validBrewingResearchTransport265(next,next.schemaVersion))return resync('Brassage, fermentation ou propriétaire invalide.');
    if(validateShipReactorThreats275(next,next.schemaVersion).length||message.kind==='delta'&&this.current&&!validShipReactorThreatContinuation275(this.current,next))return resync('Signal et historique du réacteur stellaire invalides.');
    if(!validShipReactorWorld275(next,next.schemaVersion)||!validShipResearchTransport275(next,next.schemaVersion)||message.kind==='delta'&&this.current&&!validShipReactorContinuation275(this.current,next))return resync('Réacteur stellaire, démarrage ou propriétaire invalide.');
    if(!validGeothermalWorld264(next,next.schemaVersion)||!validGeothermalResearchTransport(next,next.schemaVersion))return resync('Géothermie, phase ou propriétaire invalide.');
    if(!validDeepDrillingTransport(next,next.schemaVersion)||!validDeepResearchTransport(next,next.schemaVersion))return resync('Gisement, travail ou recherche de forage invalides.');
    if(validateHydroponics(next,next.schemaVersion,powerTopology,identities,validation.geometry).length)return resync('Bac hydroponique, culture liée ou alimentation incohérents.');
    if(!validAutoSlaughterTransport(next,next.schemaVersion))return resync('Quota d’abattage automatique invalide ou futur.');
    if(!validDomesticTasksTransport(next,next.schemaVersion))return resync('Soin, alimentation vétérinaire ou abattage, patient ou cargaison incohérents.');
    if(!validAnimalRestTransport(next,next.schemaVersion))return resync('Couchage, secours ou propriétaire animal incohérent ou futur.');
    if(!validArrestRescueTransport(next))return resync('Mandat d’arrestation, portage ou libération locale incohérent.');
    if(!validEmpStructureTransport(next,next.schemaVersion)||!validEmpProductionTransport(next,next.schemaVersion))return resync('État EMP ou production future invalide.');
    for(const pawn of next.pawns)if(!validWorldAffiliationFields259(pawn as unknown as Record<string,unknown>,next.schemaVersion)||pawn.prisonerHistory259&&!validPrisonerStateRecord259(pawn.prisonerHistory259,next.schemaVersion,next,true)||!validPrisonerPawnShape(pawn as unknown as Record<string,unknown>,next.schemaVersion,next))return resync('Prisonnier, geôlier ou provenance de recrutement invalide.');
    if(!validPrisonBreakBindings(next,next.schemaVersion))return resync('Révolte de prisonniers et service médical simultanés.');
    if(validateMental(next,next.schemaVersion).length||next.schemaVersion>=192&&validateMelee(next).length)return resync('Cible de crise mentale ou autorité de mêlée incohérente.');
    if(!validMechSalvageLedger(next,next.schemaVersion)||validateMechanoidRaids(next,next.schemaVersion).length)return resync('Récupération ou mandat mécanique invalide.');
    const mechanicalCorpseIds=new Set<number>();
    if(!validHospitalSupportTransport(next,next.schemaVersion,powerTopology)||next.research?.project==='vitals-monitor'&&validateResearch(next,next.schemaVersion).length)return resync('Soutien hospitalier, recherche ou ingrédients invalides.');
    if(message.kind==='delta'&&this.current&&sterileMaterialsUnlocked(this.current)&&!sterileMaterialsUnlocked(next)&&next.tiles.some(t=>t.floor==='sterile-tile'))return resync('Sol stérile privé de sa recherche acquise.');
    if(!validMedicineResearchTransport(next,next.schemaVersion))return resync('Recherche ou laboratoire pharmaceutique invalide.');
    if(!validMedicineTransport(next))return resync('Production pharmaceutique invalide.');
    if(next.schemaVersion<206&&[next.trade?.bought,next.trade?.sold,next.fires?.ledger?.items,next.destroyed?.items].some(items=>items&&Object.hasOwn(items,'neutroamine'))
      ||next.schemaVersion<206&&Array.isArray(next.trade?.recent)&&next.trade.recent.some(receipt=>receipt&&Array.isArray(receipt.lines)&&receipt.lines.some(line=>line&&typeof line==='object'&&'item' in line&&line.item==='neutroamine')))return resync('Historique de neutroamine futur.');
    for(const pile of next.piles){
      const owner=pile.owner;
      if(next.schemaVersion>=256&&owner.type==='inventory'&&!next.pawns.some(p=>p.id===owner.pawnId)&&!validPile(pile,next))return resync('Inventaire sans propriétaire animal réel.');
      if(pile.kind==='mech-corpse'||Object.hasOwn(pile,'mechCorpse')){if(mechanicalCorpseIds.has(pile.id)||!validPile(pile,next))return resync('Carcasse mécanique invalide.');mechanicalCorpseIds.add(pile.id);}
    }
    if(validateMiniTurrets(next).length)return resync('Propriétaire ou cible de mini-tourelle invalide.');
    if(validateCommercialRegistry(next,next.schemaVersion).length)return resync('Registre commercial invalide.');
    const postIds=new Set<number>();
    if(validateCivilianPost(next,next.schemaVersion,postIds).length)return resync('Stock du comptoir invalide.');
    const commercial=next.commercialTrip,foreignIds=new Set(postIds);
    if(commercial&&'pawn' in commercial){
      for(const entity of [commercial.pawn,...commercial.items]){
        if(foreignIds.has(entity.id))return resync('Identité commerciale hors carte dupliquée.');
        foreignIds.add(entity.id);
      }
    }
    const invalidResources=validation.resourceFacts?.hasInvalid(next,foreignIds,resource=>!validDomesticHealroot(resource,next)||!validPlantGrowthLight(resource,next.schemaVersion,next.tick)||!validCropBlight(resource,next.schemaVersion,next))
      ??next.resources.some(resource=>foreignIds.has(resource.id)||!validDomesticHealroot(resource,next)||!validPlantGrowthLight(resource,next.schemaVersion,next.tick)||!validCropBlight(resource,next.schemaVersion,next));
    if(invalidResources)return resync('État végétal ou identité commerciale invalide.');
    if(foreignIds.size){
      const collides=(entities:readonly {id:number}[])=>entities.some(e=>foreignIds.has(e.id));
      if([next.pawns,next.piles,next.structures,next.jobs,next.stockpiles,next.growingZones,next.wildlife?.animals??[],next.mechanoids??[],next.filth?.items??[],next.fires?.items??[],next.fires?.embers??[],next.projectiles??[],next.bombWaves??[]].some(collides)
        ||shelfIdentityOwners(next).some(o=>foreignIds.has(o.id))||next.packed.some(p=>foreignIds.has(p.building.id)||collides(p.building.bills??[]))||next.structures.some(s=>collides(s.bills??[])))return resync('Identité commerciale dupliquée sur la carte.');
      if((next.raids?.departed??[]).some(d=>foreignIds.has(d.pawnId)||collides(d.items))||(next.prisonDepartures??[]).some(d=>foreignIds.has(d.pawnId)||collides(d.items))
        ||[next.visitors?.departed??[],next.podRescues?.departed??[]].some(records=>records.some(d=>foreignIds.has(d.pawn.id)||collides(d.items)||(d.packed??[]).some(p=>foreignIds.has(p.building.id)||collides(p.building.bills??[])))))return resync('Identité commerciale dupliquée dans une archive.');
      if(next.scout&&'pawn' in next.scout&&(postIds.has(next.scout.pawn.id)||next.scout.items.some(i=>postIds.has(i.id))))return resync('Stock commercial dupliqué dans la reconnaissance.');
    }
    if(next.destroyed!==undefined&&!validNaturalHiveLoss256(next.destroyed,next.schemaVersion))return resync('Invalid or future reconstructed natural Hive loss counter.');
    if(validateCaveHiveOwners256(next,next.schemaVersion).length||validateHiveRuntimeOwners256(next).length)return resync('Invalid actual Hive/GlowPod/Lord continuation.');
    if(!validLocalRoadPropsState256(next,next.schemaVersion))return resync('Édifice routier invalide ou futur.');
    if(!validSandbagsState(next,next.schemaVersion))return resync('Sacs de sable ou bilan textile invalides ou futurs.');
    if(!validTelevisionState(next,next.schemaVersion))return resync('Télévision ou loisir télévisé invalide ou futur.');
    if((!validBedrollState256(next,next.schemaVersion)||!validAncientMonumentState256(next,next.schemaVersion)))return resync('Sac de couchage invalide ou futur.');
    if(!validHospitalBedState(next,next.schemaVersion))return resync('Lit d’hôpital invalide ou futur.');
    if(!validPackagedSurvivalState(next,next.schemaVersion))return resync('Production de repas de survie invalide ou future.');
    if(next.schemaVersion<177&&[...next.structures,...next.jobs,...(next.packed??[]).map(p=>p.building)].some(s=>s.kind==='sun-lamp'))return resync('Lampe horticole future.');
    if(validateScoutRegistry(next,next.schemaVersion).length)return resync('Registre de reconnaissance invalide.');
    for(const animal of next.wildlife?.animals??[])if(!validCaravanRestField266(animal as unknown as Record<string,unknown>,next.schemaVersion,animal.health?.death?.tick??next.tick))return resync('Trace de repos de caravane animale invalide ou future.');
    if(!validWildlifeExitState(next,next.schemaVersion))return resync('Départ de faune invalide.');
    if(next.jobs.some(j=>isAncientGeneratedFloor256(j.floor)&&(next.schemaVersion<256||j.kind!=='remove-floor'||next.tiles[j.z*next.width+j.x]?.floor!==j.floor)))return resync('Invalid generated ancient floor work.');
    if(next.jobs.some(j=>!validFrameDamage256(j,next.schemaVersion)))return resync('Dégâts de cadre invalides ou futurs.');
    for(const pawn of next.pawns)if(pawn.body&&Object.hasOwn(pawn.body,'damage')&&(!validHumanBodyShape(pawn.body,next.schemaVersion,next.tick,pawn.health)||pawn.state!=='dead'||!pawn.health?.death||pawn.body.observedAt<pawn.health.death.tick))return resync('Dégâts de corps retenu invalides.');
    if(next.pawns.some(p=>!validNativeHumanField256(p,next.schemaVersion)))return resync('Identité humaine native retenue invalide ou future.');
    if(next.pawns.some(p=>!validArrivalRotation256(p,next.schemaVersion)))return resync('Orientation d’arrivée retenue invalide ou future.');
    if(!validAnimalTrainingWorld282(next))return resync('Dressage ou transport animal incohérent.');
    if(!validWildlifePredationState(next,next.schemaVersion))return resync('Prédation de faune invalide.');
    if(!validWildlifeManhunterState(next,next.schemaVersion,isCorePhysicalSchema297(Number(next.schemaVersion))?effectiveCore297(next):undefined))return resync('Rage de faune invalide.');
    if(validateQuests(next,next.schemaVersion).length)return resync('Dossier de quête invalide.');
    if(next.scout&&(next.scout.phase==='travelling'||next.scout.phase==='awaiting-entry')){
      const registry=scoutRegistryView(next),pawn=next.scout.pawn;
      if(!validSurgeryTransport(pawn,next)||!validImmuneDiseaseTransport(pawn,next)||!validPlantSkill(pawn.skills?.plants,next.schemaVersion)||!validMiningTransport(pawn,next.schemaVersion)||pawn.bereavement!==undefined&&!validBereavement(pawn.bereavement,pawn.id,next.schemaVersion,registry)
        ||next.scout.items.some(pile=>!validPile(pile,registry)))return resync('Voyageur ou possession hors carte invalide.');
    }
    if(commercial&&'pawn' in commercial){
      const registry=scoutRegistryView(next),pawn=commercial.pawn;
      if(postIds.has(pawn.id)||!validSurgeryTransport(pawn,next)||!validImmuneDiseaseTransport(pawn,next)||!validPlantSkill(pawn.skills?.plants,next.schemaVersion)||!validMiningTransport(pawn,next.schemaVersion)||pawn.bereavement!==undefined&&!validBereavement(pawn.bereavement,pawn.id,next.schemaVersion,registry)
        ||commercial.items.some(pile=>postIds.has(pile.id)||!validPile(pile,registry)))return resync('Voyageur commercial ou possession invalide.');
    }
    if(validateCommercialBindings(next,next.schemaVersion).length)return resync('Possessions commerciales incohérentes.');
    for(const records of [next.raids?.departed??[],next.prisonDepartures??[]])for(const departure of records)
      if(departure.items.some(p=>!validMechCorpseShape(p,next.schemaVersion,departure.tick)||next.schemaVersion<194&&Object.hasOwn(p,'mechCorpse')))return resync('Dossier mécanique de départ historique invalide.');
    for(const records of [next.visitors?.departed??[],next.podRescues?.departed??[]])
      for(const departure of records){
        if(Object.hasOwn(departure.pawn,'emp'))return resync('Effet EMP mécanique archivé sur une personne.');
        if(departure.items.some(p=>(p.item==='neutroamine'||p.kind==='neutroamine')&&validatePileRecordShape(p as unknown as Record<string,unknown>,next,next.schemaVersion,departure.tick).length))return resync('Neutroamine archivée invalide.');
        if(next.schemaVersion<206&&(departure.packed??[]).some(p=>p.building.kind==='drug-lab'||p.building.bills?.some(b=>b.recipe==='make-medicine')))return resync('Laboratoire pharmaceutique archivé futur.');
        if(isMechanoidKind(departure.pawn.health?.body)||departure.items.some(p=>!validMechCorpseShape(p,next.schemaVersion,departure.tick)||next.schemaVersion<194&&Object.hasOwn(p,'mechCorpse')))return resync('Dossier mécanique archivé invalide.');
        if(!validMiningTransport(departure.pawn,next.schemaVersion))return resync('Profil de minage archivé invalide.');
        if(!validImmuneDiseaseTransport(departure.pawn,{...next,tick:departure.tick},true))return resync('Maladie immunitaire archivée invalide.');
        if(!validArchivedMeleeThreat(departure.pawn,next,departure.tick))return resync('Menace de mêlée archivée invalide.');
        if(Object.hasOwn(departure.pawn,'bombRefuge'))return resync('Refuge Bomb archivé hors carte.');
      }
    for(const departure of next.podRescues?.departed??[])if(!validSurgeryTransport(departure.pawn,{schemaVersion:next.schemaVersion,tick:departure.tick,width:next.width,height:next.height,nextId:next.nextId}))return resync('Dossier chirurgical civil archivé invalide.');
    let mineableIds=message.kind==='checkpoint'?new Map<number,number>():this.mineableIds;
    if(message.kind==='checkpoint'){for(let i=0;i<next.tiles.length;i++){const owner=next.tiles[i]!.mineable;if(owner)mineableIds.set(i,owner.id);}}
    else {let copied=false;for(const i of changedTileIndices??[]){const id=next.tiles[i]!.mineable?.id;if(mineableIds.get(i)===id)continue;if(!copied){mineableIds=new Map(mineableIds);copied=true;}if(id===undefined)mineableIds.delete(i);else mineableIds.set(i,id);}}
    const collapsedRockIds=new Map(message.kind==='checkpoint'?[]:this.collapsedRockIds);
    if(message.kind==='checkpoint'){for(let i=0;i<next.tiles.length;i++){const rock=next.tiles[i]!.collapsedRock;if(rock)collapsedRockIds.set(i,rock.id);}}
    else for(const i of changedTileIndices??[]){const rock=next.tiles[i]!.collapsedRock;if(rock)collapsedRockIds.set(i,rock.id);else collapsedRockIds.delete(i);}
    const relationMemories=(p:Pawn):boolean=>Object.hasOwn(p,'romanceMemories')||Object.hasOwn(p,'familyBereavement')||hasCoupleFields285(p);
    const relationships=Object.hasOwn(next,'planet')||Object.hasOwn(next,'group')||Object.hasOwn(next,'groupLosses')||Object.hasOwn(next,'relationships')||next.pawns.some(relationMemories)
      ||[next.scout,next.commercialTrip].some(owner=>owner&&'pawn' in owner&&relationMemories(owner.pawn))
      ||[next.visitors?.departed??[],next.podRescues?.departed??[]].some(records=>records.some(record=>relationMemories(record.pawn)))
      ||Object.hasOwn(next.arrivals?.pending??{},'relationship')||(next.quests?.entries??[]).some(q=>Object.hasOwn(q,'relationship'));
    // Retained ballistic/Bomb and relationship owners need this additional identity
    // capture. Foreign registries above are already validated; their historical
    // owners reserve the same namespace as the map and cannot become a wave.
    const shelves=next.structures.some(s=>s.shelf!==undefined)||next.packed.some(p=>p.building.shelf!==undefined);
    const startingArrival=Object.hasOwn(next,'startingArrival'),ancientCaskets=next.structures.some(isAncientCasket256),playerCaskets=next.structures.some(s=>isPlayerCasket271(s)||isShipCasket277(s));
    if(next.jobs.some(j=>j.wallDoor296?.plan)||next.ancientShrineWarnings||mineableIds.size||next.geysers||next.wildlife?.flyers?.length||collapsedRockIds.size||next.jobs.some(j=>j.tree)||next.piles.some(p=>p.innerResource)||startingArrival||ancientCaskets||playerCaskets||shelves||relationships||Object.hasOwn(next,'orbital')||Object.hasOwn(next,'mechanoids')||next.raids?.mechActive||next.raids?.extraMechActive261?.length||mechanicalCorpseIds.size||Object.hasOwn(next,'projectiles')||Object.hasOwn(next,'bombWaves')||next.pawns.some(p=>Object.hasOwn(p,'bombRefuge')||p.shooting!==undefined)){
      // Only the closed MAIN context can reuse its resource facts. Keep RAW
      // and non-strict collection/getter evaluation on the historical path.
      const owned=validation.resourceFacts&&(next.jobs.some(j=>j.wallDoor296?.plan)||startingArrival||ancientCaskets||playerCaskets||shelves||relationships||Object.hasOwn(next,'orbital'))
        ?captureOwnedStrictNamespace(next,validation.resourceFacts,mechanicalCorpseIds):undefined;
      let ids:NumericMembershipSink&Iterable<number>,strictIds:boolean;
      if(owned!==undefined){
        if(!owned.ok)return resync(owned.reason);
        ids=owned.ids;strictIds=true;
      }else{
        const owners=[
          ...next.pawns,...next.structures,...next.jobs,...next.resources,...next.piles,...next.stockpiles,...next.growingZones,
          ...(next.wildlife?.animals??[]),...(next.filth?.items??[]),...(next.fires?.items??[]),...(next.fires?.embers??[]),
          ...next.packed.map(p=>p.building),...shelfIdentityOwners(next),...next.structures.flatMap(s=>s.bills??[]),...next.packed.flatMap(p=>p.building.bills??[]),
        ];
        ids=new NumericMembership();strictIds=next.jobs.some(j=>!!j.wallDoor296?.plan)||!!next.ancientShrineWarnings||mineableIds.size>0||!!next.geysers||!!next.wildlife?.flyers?.length||collapsedRockIds.size>0||startingArrival||ancientCaskets||playerCaskets||shelves||relationships||Object.hasOwn(next,'orbital')||next.schemaVersion>=235&&(next.jobs.some(j=>j.tree!==undefined||j.plantTarget!==undefined)||next.piles.some(p=>p.kind==='plant')||next.resources.some(hasPausedTreeClock));
        for(const owner of owners){if(strictIds&&(!Number.isSafeInteger(owner.id)||owner.id<1||owner.id>=next.nextId||ids.has(owner.id)))return resync('Identité dupliquée ou invalide dans le registre relationnel.');if(mechanicalCorpseIds.has(owner.id)&&ids.has(owner.id))return resync('Identité de carcasse mécanique dupliquée.');ids.add(owner.id);}
      }
      if(next.geysers&&!registerGeyserIdentities256(next.geysers,ids))return resync('Duplicate geyser identity.');
      if(next.ancientShrineWarnings&&!registerAncientShrineWarningIds256(next.ancientShrineWarnings,ids))return resync('Duplicate ancient shrine warning Thing identity.');
      if(validateDuckFlyers256(next,next.schemaVersion,ids).length)return resync('Propriétaire de transit animal dupliqué ou invalide.');
      for(const id of mineableIds.values()){if(ids.has(id))return resync('Duplicate Mineable owner.');ids.add(id);}
      for(const id of collapsedRockIds.values()){if(ids.has(id))return resync('Duplicate collapsed rock owner.');ids.add(id);}
      const addId=(id:unknown):boolean=>{if(!Number.isSafeInteger(id)||Number(id)<1||Number(id)>=next.nextId||ids.has(Number(id))&&(strictIds||mechanicalCorpseIds.has(Number(id))))return false;ids.add(Number(id));return true;};
      const addItems=(items:unknown):boolean=>Array.isArray(items)&&items.every(item=>item&&typeof item==='object'&&addId(item.id));
      if(relationships){for(const id of postIds)if(!addId(id))return resync('Identité du comptoir dupliquée dans le registre relationnel.');}
      // Map collisions with the full foreign registry were checked above.
      // Reserve the post here; the original travellers and their possessions
      // are registered once by the next loop, including the strict orbital path.
      else for(const id of postIds)ids.add(id);
      for(const owner of [next.scout,next.commercialTrip])if(owner&&'pawn' in owner){if(!addId(owner.pawn.id)||!addItems(owner.items))return resync('Identité hors carte invalide pour les projectiles.');}
      for(const pawn of next.pawns)if(pawn.body?.lostAt!==undefined){
        if(pawn.body.pileId!==undefined){if(!addId(pawn.body.pileId))return resync('Identité de dépouille perdue invalide.');}
        else if(next.schemaVersion<256||!validHumanBodyShape(pawn.body,next.schemaVersion,next.tick,pawn.health)||pawn.state!=='dead'||!pawn.health?.death||pawn.body.observedAt<pawn.health.death.tick
          ||next.piles.some(p=>['pawn','equipment','apparel','inventory'].includes(p.owner.type)&&'pawnId' in p.owner&&p.owner.pawnId===pawn.id)
          ||next.packed.some(p=>(p.owner.type==='pawn'||p.owner.type==='inventory')&&p.owner.pawnId===pawn.id))return resync('Corps perdu avant matérialisation invalide.');
      }
      for(const records of [next.raids?.departed??[],next.prisonDepartures??[]])for(const d of records)
        if(!addId(d.pawnId)||!addItems(d.items))return resync('Identité de départ historique invalide.');
      for(const records of [next.visitors?.departed??[],next.podRescues?.departed??[]])for(const d of records){
        if(!addId(d.pawn.id)||!addItems(d.items))return resync('Identité de dossier archivé invalide.');
        for(const pack of d.packed??[])if(!addId(pack.building.id)||!addItems(pack.building.bills??[]))return resync('Identité de mobilier archivé invalide.');
      }
      if(validateMechanoids(next,next.schemaVersion,ids).length)return resync('Identité, cible ou déplacement mécanique invalide.');
      planetCheck=this.planetValidation.prepare(next,next.schemaVersion,message.epoch);
      if(!planetCheck.ok||validateGroupStateWithPlanet(next,next.schemaVersion,planetCheck.context).length)return resync('Planète, groupe ou pertes incohérents.');
      if(registerProjectedGroups(next,ids,planetCheck.context).length)return resync('Registre projeté de caravanes incohérent.');
      if(registerWallDoorPlanIds296(next,ids).length)return resync('Invalid or duplicate wall-door successor identity.');
      if(registerGroupThingIds(next,ids).length)return resync('Une identité du groupe possède plusieurs propriétaires.');
      if(registerStartingArrivalThingIds(next,ids).length)return resync('Une identité des capsules initiales possède plusieurs propriétaires.');
      if(registerAncientCasketThingIds256(next,ids).length)return resync('Propriétaire ou identité de capsule ancienne invalide.');
      if(registerShipCasketThingIds277(next,ids).length)return resync('Invalid spatial casket owner or identity.');
      if(registerCryptosleepThingIds271(next,ids).length)return resync('Propriétaire ou identité de caisson de cryptosommeil invalide.');
      // Outer human/personal Things must precede their contained tree originals,
      // matching RAW. The player-holder guard can reuse this ordinary namespace
      // without mistaking its own already-registered inner tree for a rival.
      if(registerTreeThingIds(next,ids).length)return resync('Duplicate contained tree identity.');
      if(validateShooting(next,next.schemaVersion,ids).length)return resync('Référence ou autorité de tir humaine invalide.');
      if(validateMechanoidRaids(next,next.schemaVersion,ids).length)return resync('Identité mécanique historique réutilisée dans un autre propriétaire.');
      for(const actor of next.mechanoids??[])if(validateMechanoidRanged(next,actor,next.schemaVersion,ids).length)return resync('Référence ou phase de tir mécanique invalide.');
      if(validateProjectiles(next,next.schemaVersion,ids).length)return resync('Balle ou canon lanceur invalide.');
      const bombErrors:string[]=[];validateBombWaves(next,bombErrors,ids);if(bombErrors.length)return resync('Vague Bomb ou identité invalide.');
      if(validateFirefoamLocal290(next,ids).length)return resync('Vague anti-incendie ou identité invalide.');
      if(registerOrbitalThingIds(next,ids).length)return resync('Une identité orbitale possède plusieurs propriétaires.');
      if(validateBombRefuges(next,[],ids).length)return resync('Refuge ou danger Bomb incohérent.');
      if(registerProjectedFactionOwners256(next,ids).length)return resync('Faction, chef ou propriétaire projeté incohérent.');
      if(registerProjectedWorldPawns256(next,ids).length)return resync('Invalid projected WorldPawns owner or namespace.');
      if(registerProjectedWorldSites263(next,ids).length||registerProjectedTradeRequests284(next,ids).length)return resync('Invalid projected263 Site holder or map parent.');
    }
    if(!everyHumanPawnOwner(next,p=>validWorldAffiliationFields259(p as unknown as Record<string,unknown>,next.schemaVersion)&&validWorldAffiliationForeignKeys259(p,next.worldFactions)))return resync('Faction/hôte d’un original invalide.');
    // An absent planet also belongs to the accepted epoch. A replacement
    // without planetary owners must clear the previous witness atomically.
    planetCheck??=this.planetValidation.prepareAbsence(message.epoch);
    if(message.epoch===this.epoch&&!sameNativeWorldPawnBirth256(this.confirmedNativeWorldPawnBirth,next.worldPawns))return resync('Naissance WorldPawns native réécrite sans remplacement.');
    if(message.epoch===this.epoch&&!sameFactionInitializations256(this.confirmedFactionInitializations,next.worldFactions))return resync('Initialisation culturelle de faction réécrite sans remplacement.');
    if(!planetCheck.ok)return resync('Planète, groupe ou pertes incohérents.');
    if(planetCheck.geographyChanged)return resync('La géographie confirmée a changé sans remplacement.');
    // Rev1 transport retains its historical presentation-fixture admission.
    // New tile climates are authority: certify the small definition before
    // committing the geographic witness or replacing the confirmed world.
    if((next.scenario?.revision===9||next.scenario?.revision===10||next.climate&&(next.climate.revision!==1||Object.hasOwn(next.climate,'definition')))&&
      !validSiteClimate(next.climate,next.schemaVersion,next))return resync('Climat du lieu de départ incohérent.');
    // Only the fixed MAIN context reuses this default capture within this call.
    // Public decoding and each foreign context retain their complete capture.
    const readHumanOwners=()=>validation.humanOwners?.read(next)??captureHumanOwners(next);
    if(!validHumanIngestionOwners299(next,next.schemaVersion,readHumanOwners))return resync('Horloge ou provenance alimentaire humaine invalide.');
    if(!validIdleWanderOwners300(next,next.schemaVersion,readHumanOwners))return resync('Tâche locale d’errance civile invalide.');
    if(!validFactionCommsTransportForSnapshot298(next,next.schemaVersion,readHumanOwners))return resync('Communication de faction ou contact invalide.');
    if(Object.hasOwn(next,'group')||Object.hasOwn(next,'groupLosses')){
      try {const people=readHumanOwners().people;
        if(validateSocial(next,next.schemaVersion,new Set(people.keys())).length||next.pawns.some(p=>!validBereavement(p.bereavement,p.id,next.schemaVersion,next,people)))return resync('Souvenirs de personnes hors carte incohérents.');
      }catch{return resync('Propriétaire humain hors carte incohérent.');}
    }
    if(validateRelationshipWorldForSnapshot(next,next.schemaVersion,readHumanOwners).length)return resync('Liens, annonce ou souvenirs relationnels incohérents.');
    if(!validDeathThoughtsTransportForSnapshot(next,next.schemaVersion,readHumanOwners))return resync('Souvenirs de décès perçus ou propriétaires incohérents.');
    if(!validArtificialPartsWorldTransportForSnapshot(next,next.schemaVersion,readHumanOwners))return resync('Anatomie artificielle ou horloge de son propriétaire invalide.');
    if(!validCobraClinicalWorldForSnapshot256(next,next.schemaVersion,readHumanOwners))return resync('Propriétaire clinique toxique invalide.');
    if(!validCryptosleepSicknessWorldTransportForSnapshot256(next,next.schemaVersion,readHumanOwners))return resync('Mal de cryptosommeil ou propriétaire clinique invalide.');
    if(validateAncientOpeningOwners256(next).length)return resync('Ouverture de capsule ancienne ou propriétaire incohérent.');
    if(message.kind==='checkpoint'&&next.tiles.some(t=>!validSmoothFloorTile281(t,next.schemaVersion)))return resync('Terrain lissé invalide.');
    if(!validSmoothFloorWorld281(next,message.epoch===this.epoch?this.current:undefined))return resync('Ordre ou auteur du lissage incohérent.');
    if(!validPrisonerSurgeryWorld280(next))return resync('Demande ou service chirurgical du captif incohérent.');
    if(!hasPrisonerSurgery280(next)&&next.pawns.some(p=>p.surgery?.implant!==undefined||p.surgeryRequest?.implant!==undefined)
      &&validateSurgeries(next,next.schemaVersion).length)return resync('Prothèse demandée ou ingrédients chirurgicaux incohérents.');
    // Commit only after every patch is checked. A refusal preserves both state and revision.
    if(next.schemaVersion>=256&&!validGeographicSiteBinding256(next))return resync('Provenance locale distincte de la vraie planète.');
    if(!this.validGeographicCalendar(next,message.epoch))return resync('Origine du calendrier géographique réécrite.');
    if(!validWallDoorWorld296(next))return resync('Invalid wall-door target or implicit work owner.');
    if(!validReadingWorld295(next))return resync('Invalid Novel ownership, reading phase or reservation.');
    if(!validPeaceTalksBindings293(next)||!validPartyWorld292(next)||!validForestryPolicies291(next))return resync('Invalid or locked forest growing policy.');
    if(!validFirefoamWorld290(next)||!validBillPauseWorld289(next)||!validAnimalThermalRefugeWorld288(next)||!validAnimalAreaWorld287(next)||!validLinkedStorageProjection286(next)||!validBillWorkerWorld283(next,readHumanOwners))return resync('Opérateur de facture ou réglages incohérents.');
    if(!validEscapedShipsProjection298(next,next.schemaVersion,next.tick,next.nextId,isSchema298OrLater(Number(next.schemaVersion))&&'escapedShipsSummary298' in next?effectiveCore297(next):undefined)||!validEscapedShipsProjectionScope298(next))return resync('Escaped-ship credits do not match known away people.');
    if(acceptExtra&&!acceptExtra(next))return resync('Métadonnées supplémentaires incompatibles avec la carte confirmée.');
    freezeAdmittedNativeWorldPawnOrder256(next);
    if(!riverWater.inherited&&next.riverWater)freezeAdmittedRiverWater256(next.riverWater);
    if(!this.geographicTransport.canCommit(geographic))return resync('Préparation géographique périmée.');
    if(!this.planetValidation.commit(planetCheck))return resync('Planète, groupe ou pertes incohérents.');
    if(!this.geographicTransport.commit(geographic))throw Error('Lost private geographic preparation after commit');
    this.adoptGeographicCalendar(next,message.epoch);
    const replaced = message.epoch !== this.epoch;
    if(reindexResources){
      // Reuse the historical reindex traversal, keeping the old private slots
      // local until the candidate is certified. No second source-array scan.
      const oldSlots = this.resourceSlots, nextSlots = new Map<number, number>();
      const removed = new Set(resourceStructureRemoved.map(edit => edit.id));
      const added: SnapshotResourcePlacement[] = [], updated: SnapshotResourcePlacement[] = [];
      let lastSurvivor = -1, appended = false, nextReady = true, afterCount = 0;
      for(let i=0;i<(afterCount=next.resources.length);i++){
        const resource = next.resources[i]!, id = resource.id;
        if (nextSlots.has(id) || !validCapturedResourceId(id)) nextReady = false;
        nextSlots.set(id,i);
        if (resourceStructureAllowed && message.kind !== 'checkpoint') {
          const beforeOrdinal = oldSlots.get(id);
          if (beforeOrdinal === undefined) {
            if (!resourceStructureTouched?.has(id)) resourceStructureAllowed = false;
            appended = true; added.push({ id, afterOrdinal: i });
          } else {
            if (appended || beforeOrdinal <= lastSurvivor || removed.has(id)) resourceStructureAllowed = false;
            lastSurvivor = beforeOrdinal;
            if (resourceStructureTouched?.has(id)) updated.push({ id, afterOrdinal: i });
          }
        }
      }
      this.resourceSlots = nextSlots;
      nextReady &&= Number.isSafeInteger(afterCount) && afterCount >= 0;
      this.#resourceStructureReady = nextReady;
      this.#resourceStructureCount = afterCount;
      if (message.kind !== 'checkpoint' && resourceStructureAllowed && nextReady
        && oldSlots.size - resourceStructureRemoved.length + added.length === afterCount
        && resourceStructureRemoved.length + added.length + updated.length === resourceStructureTouched?.size) {
        resourceStructureCandidate = { beforeCount: oldSlots.size, afterCount: afterCount,
          removed: resourceStructureRemoved, added, updated };
      } else resourceStructureCandidate = undefined;
    } else if (!resourceStructureAllowed) {
      resourceStructureCandidate = undefined; this.#resourceStructureReady = false;
    }
    if(reindexPiles){this.pileSlots.clear();for(let i=0;i<next.piles.length;i++)this.pileSlots.set(next.piles[i]!.id,i);}
    let resourceIndices: number[] | undefined;
    if (changedResourceIds) {
      resourceIndices = [];
      for (const id of changedResourceIds) {
        const index = this.resourceSlots.get(id);
        if (index === undefined) { resourceIndices = undefined; break; }
        resourceIndices.push(index);
      }
    }
    const previous = this.current;
    let deadWrappers=oldDeadWrappers,deadSources=oldDeadSources;
    if(addedDeadTrees?.length){
      const wrappers=new Map<number,ExpiredTreeFact>(oldDeadWrappers??[]),sources=new Map<number,ExpiredTreeFact>(oldDeadSources??[]);
      for(const pile of addedDeadTrees){const fact:ExpiredTreeFact={wrapperId:pile.id,resourceId:pile.innerResource.id,quantity:pile.plantPack.pendingExpiry!.quantity,packedAt:pile.plantPack.packedAt,expiresAt:pile.plantPack.expiresAt,source:expiredTreeSource(pile)};wrappers.set(fact.wrapperId,fact);sources.set(fact.resourceId,fact);}
      deadWrappers=wrappers;deadSources=sources;
    }
    this.expiredTreeWrappers=deadWrappers;this.expiredTreeSources=deadSources;
    this.collapsedRockIds=collapsedRockIds;this.mineableIds=mineableIds;
    this.confirmedNativeWorldPawnBirth=captureNativeWorldPawnBirth256(next.worldPawns);
    this.confirmedFactionInitializations=captureFactionInitializations256(next.worldFactions);
    this.current = next; this.epoch = message.epoch; this.revision = message.revision;
    // Publish only at the confirmed boundary, after every guard and planet commit.
    if (message.kind === 'checkpoint' || !previous) this.#snapshotChanges.reset(next, message.epoch, message.revision);
    else this.#snapshotChanges.append(previous, next, message.epoch, message.revision, resourceIndices, changedTileIndices);
    if (message.kind === 'checkpoint' || !previous) this.#structureChanges.reset(next, message.epoch, message.revision);
    else this.#structureChanges.append(previous, next, message.epoch, message.revision, structureIndices, changedTileIndices);
    if (message.kind === 'checkpoint' || !previous) this.#resourceStructure.reset(next, message.epoch, message.revision, this.#resourceStructureCount);
    else this.#resourceStructure.append(previous, next, message.epoch, message.revision, resourceStructureCandidate, changedTileIndices, this.#resourceStructureCount);
    return { status: 'applied', world: next, replaced };
  }
}
