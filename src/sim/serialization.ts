import {validFrameOwners301} from './finish-frame-save-301.ts';
import {isSchema300OrLater} from './schema-compatibility-257.ts';
import {validHumanIngestionOwners299} from './human-ingestion-save-299.ts';
import {validIdleWanderOwners300} from './idle-wander-save-300.ts';
import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {validFactionCommsTransportForSnapshot298} from './faction-comms-save-298.ts';
import {validVictoryContentHistorical298,validShipComputerSensorsBuilding298,validShipComputerSensorsField298} from './victory-content-save-298.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validCorePathBudget297,adoptMigratedCorePathBudgets297} from './core-path-budget-297.ts';
import {validPhaseCore297,effectiveCore297} from './core-phase-297.ts';
import {validCoreMoveHistoricalTransport297} from './core-move-save-297.ts';
import {validWallDoorHistoricalTransport296,validWallDoorWorld296,registerWallDoorPlanIds296} from './wall-door-save-296.ts';
import {validNovelHistoricalTransport295,validNovelPile295} from './book-save-295.ts';
import {validPeaceTalksHistorical293,validPeaceTalksBindings293,validPeaceTalksRegistryScalars293} from './peace-talks-save-293.ts';
import {validToxicFalloutHistoricalTransport294} from './toxic-fallout-save-294.ts';
import {validPartyNonOwner292} from './party-state-292.ts';
import {validPartyHistoricalTransport292,validPartyWorld292} from './party-save-292.ts';
import {validForestryHistoricalTransport291} from './forestry-save-291.ts';
import {validFirefoamHistoricalTransport290,validFirefoamWorld290,validateFirefoamLocal290} from './firefoam-save-290.ts';
import {validBillPauseHistoricalTransport289,validBillPauseWorld289} from './bill-pause-save-289.ts';
import {validAnimalThermalRefugeHistoricalTransport288,validAnimalThermalRefugeWorld288} from './animal-thermal-refuge-save-288.ts';
import {validAnimalAreaHistoricalTransport287,validAnimalAreaWorld287} from './animal-area-save-287.ts';
import {validSmoothFloorsHistoricalTransport281,validSmoothFloorTile281,validateSmoothFloors281} from './smooth-floor-save-281.ts';
import {validAnimalTrainingHistoricalTransport282} from './animal-training-historical-282.ts';
import {animalHaulContents282} from './animal-haul-contents-282.ts';
import {isSchema281OrLater} from './schema-compatibility-257.ts';
import {validPrisonerSurgeryHistoricalTransport280} from './prisoner-surgery-save-280.ts';
import {validApparelTradeHistoricalTransport279} from './apparel-trade-save-279.ts';
import {validApparelReservesHistoricalTransport278} from './apparel-reserves-save-278.ts';
import {validBillWorkerHistoricalTransport283,validBillWorkerWorld283} from './bill-worker-save-283.ts';
import {validShipCasketHistoricalTransport277} from './ship-casket-save-277.ts';
import {validShipEscapeHistorical298,validEscapedShipsEnvelope298} from './ship-escape-save-298.ts';
import {validShipCasketBuilding277,registerShipCasketThingIds277} from './ship-casket-owner-save-277.ts';
import {validateShipCasketTasks277} from './ship-casket-task-save-277.ts';
import {validShipPartHistoricalTransport276} from './ship-part-save-276.ts';
import {validateShipReactorThreats275} from './ship-reactor-threat-save-275.ts';
import {validShipReactorHistoricalTransport275,validShipReactorWorld275} from './ship-reactor-save-275.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {validateProstheticWorks273} from './prosthetic-work-save-273.ts';
import {validProstheticHistoricalTransport273,validProstheticCatalogueDomains273} from './catalogue-save-273.ts';
import {isSchema269OrLater,isSchema271OrLater,isSchema275OrLater,isSchema276OrLater,isSchema277OrLater} from './schema-compatibility-257.ts';
import {validSpearHistoricalTransport272,validSpearCatalogueDomains272} from './catalogue-save-272.ts';
import {validCryptosleepBuilding271,registerCryptosleepThingIds271} from './cryptosleep-owner-save-271.ts';
import {validateCryptosleepTasks271} from './cryptosleep-task-save-271.ts';
import {validCryptosleepField271} from './cryptosleep-state-271.ts';
import {validCryptosleepHistoricalTransport271,validCryptosleepCatalogueDomains271} from './catalogue-save-271.ts';
import {validLongswordHistoricalTransport270,validLongswordCatalogueDomains270} from './catalogue-save-270.ts';
import {validCraftingFuelTransport269} from './fuel-purpose-save-269.ts';
import {validMaceHistoricalTransport269,validMaceCatalogueDomains269} from './catalogue-save-269.ts';
import {validKnifeHistoricalTransport268,validKnifeCatalogueDomains268} from './catalogue-save-268.ts';
import {validSmithingHistoricalTransport267,validSmithingCatalogueDomains267} from './smithing-catalogue-save-267.ts';
import {validateSmithingWorks267} from './smithing-save-267.ts';
import {isSchema263OrLater} from './schema-compatibility-257.ts';
import {validAlcoholWorld265} from './alcohol-state-265.ts';
import {validBrewingCatalogueDomains265,validBrewingHistoricalTransport265} from './brewing-catalogue-save-265.ts';
import {validFermentationWorld265} from './fermentation-save-265.ts';
import {validGeothermalWorld264} from './geothermal-state-264.ts';
import {validWorldSiteAmbush263} from './world-site-ambush-save-263.ts';
import {validSiteDefenceSource263} from './world-site-defence-source-263.ts';
import {validGeographicSettlementDimensions262} from './geographic-creation-options-262.ts';
import {validCaravan261Historical} from './caravan-schema-historical-261.ts';
import {validCamp260Historical} from './camp-schema-historical-260.ts';
import {validGeographicRenewalCampaignRaw262} from './geographic-renewal-state-262.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {freezeAdmittedNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {validateCaveHiveOwners256} from './cave-hive-save-256.ts';
import {validateActualStartingPetLinks256} from './starting-pet-owners-256.ts';
import {validWorldTargetDefence263} from './world-target-defence-save-263.ts';
import {registeredWorldTargetContext263} from './world-target-local-context-263.ts';
import {worldTargetConstructionReason263,type WorldTargetGenerated263} from './world-target-construction-263.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {validWorldPawnsEnvelope256,validateWorldPawnOwners256} from './world-pawn-save-256.ts';
import {historicalWorldSitesAbsent263} from './world-sites-historical-263.ts';
import {validCobraClinicalWorld256} from './toxic-buildup-save-256.ts';
import {validAncientCasketBuilding256,validateAncientCasketPhysical256} from './ancient-casket-physical-256.ts';
import {validAncientCasketField256,registerAncientCasketThingIds256} from './ancient-casket-save-256.ts';
import {validateAncientOpeningOwners256} from './ancient-casket-opening-256.ts';
import {validCryptosleepSicknessWorldTransport256} from './cryptosleep-sickness-save-256.ts';
import {validRiverWaterCampaignRaw256,validRiverWaterEnvelope256,freezeAdmittedRiverWaterCampaign256} from './river-water-owner-256.ts';
import {ANCIENT_MONUMENT_KINDS_256} from './ancient-monument-props-256.ts';
import {validAncientMonumentState256} from './ancient-monument-save-256.ts';
import {validMineableTile256,registerMineableIdentities256,validMineableCampaignRaw256} from './local-mineable-save-256.ts';
import {validLocalRoadInfoCampaignRaw256,validLocalRoadInfoEnvelope256} from './local-road-info-256.ts';
import {validAncientShrineWarningCampaignRaw256,validAncientShrineWarningEnvelope256,registerAncientShrineWarningIds256} from './ancient-shrine-warning-save-256.ts';
import {validLocalGeyserCampaignRaw256,validLocalGeyserEnvelope256} from './local-geyser-campaign-save-256.ts';
import {registerGeyserIdentities256} from './local-geyser-save-256.ts';
import {animalContentsOwner256} from './animal-local-contents-256.ts';
import {validExplorationCampaignRaw256} from './exploration-campaign-save-256.ts';
import {validateExploration256} from './exploration-save-256.ts';
import {validLocalRoadPropsState256} from './local-road-props-save-256.ts';
import {validGroupForageHistoricalTransport256} from './group-forage-save-256.ts';
import {validCollapsedRock256,registerCollapsedRockIdentities256,excavatedCollapsedRock256,admittedRoofTerrain256} from './collapsed-rocks-256.ts';
import {validGeographicSiteBinding256} from './site-geographic-256.ts';
import {validPlanetGeographyHistorical256} from './planet-geography-historical-256.ts';
import {preparePlanetNavigation256} from './planet-route-256.ts';
import {preparePlanetHydration256} from './planet-geography-256.ts';
import {withinSaveTextLimit} from './save-text-limit.ts';
import {validateCampaignActorBeds256} from './actor-bed-save-256.ts';
import {validateCampaignSharedFields} from './campaign-shared-save.ts';
import {emptyCampaignOwner} from './world-map-owners.ts';
import {brandCampaignContext} from './world-map-context.ts';
import {validWorldMapHistorical,validateRegisteredCampaign} from './world-map-save.ts';
import {migrateWorldRegistry,hasLoadedRoot} from './world-map-context.ts';
import type {CampaignState} from './world-map-state.ts';
import {isWetTerrain} from './shallow-water.ts';
import {validGroupFreightHistoricalTransport} from './group-freight-save.ts';
import {validDeteriorationHistoricalTransport,validDeteriorationTransport} from './deterioration-save.ts';
import {createDeteriorationState} from './deterioration-content.ts';
import {validBurnApparelHistoricalTransport,validBurnApparelTransport} from './burn-apparel-save.ts';
import {validGroupProvisionsHistoricalTransport} from './group-provisions-save.ts';
import {validTorchHistoricalTransport,validTorchTransport} from './torch-save.ts';
import {validPemmicanHistoricalTransport,validPemmicanCatalogueDomains} from './pemmican-save.ts';
import {validBridgeTile,validateBridgeTransport} from './bridge-rules.ts';
import {validVentTransport} from './vent.ts';
import {tundraHistoricalFieldsAbsent,validTundraTransport} from './tundra-save.ts';
import {validateMarshTransport,validMarshTile} from './marsh.ts';
import {validTuqueCatalogueTransport,validTuqueCatalogueDomains} from './tuque-catalogue-save.ts';
import {validReconCatalogueTransport} from './recon-catalogue-save.ts';
import {isConstructionLightPlant,constructionFinalWipesPlants} from './construction-plants.ts';
import {validateTreeTransport,registerTreeThingIds,validTreeJobShape,validPlantTargetShape} from './tree-transfer-save.ts';
import {isPlantDesignationJob} from './tree-transfer.ts';
import {validShelfTransport,validShelfGround,registerShelfThingIds} from './shelf-save.ts';
import {groundMaxStacks,storageCellById,storageCellAccepts} from './shelf-storage.ts';
import { validatePlanet } from './planet-save.ts';
import { validateGroupState } from './group-save.ts';
import { registerGroupThingIds } from './group-namespace-save.ts';
import { validateStartingArrivalOwners,registerStartingArrivalThingIds } from './starting-arrival-save.ts';
import { captureHumanOwners } from './human-owners.ts';
import { validateForcedConsumption } from './consume-save.ts';
import { validatePawnRecordShape } from './pawn-record-save.ts';
import { validatePileRecordShape } from './material-record-save.ts';
import { validateRelationshipWorld } from './relationship-world-save.ts';
import { validRelationshipState } from './relationship-save.ts';
import { validFamilyBereavementShape } from './family-bereavement-save.ts';
import { validRomanceMemoryShape } from './romance-memories.ts';
import { validMechCorpseShape,validMechSalvageLedger } from './mechanoid-corpse-save.ts';
import { validMechanoidShape,validateMechanoids } from './mechanoid-save.ts';
import { validateMechanoidRanged } from './mechanoid-ranged-save.ts';
import { validateMechanoidRaids } from './mechanoid-raid-save.ts';
import { initializeTelevisionRecreation, validTelevisionState } from './television-save.ts';
import { validSandbagsState } from './sandbags-save.ts';
import { validPackagedSurvivalState } from './packaged-survival-save.ts';
import {validBedrollState256} from './bedroll-save-256.ts';
import { validHospitalBedState } from './hospital-bed-save.ts';
import { isBedKind } from './bed-kinds.ts';
import { validHumanSleepingSpotProvenance,validHumanSleepingSpotTransport } from './human-sleeping-spot-save.ts';
import { validateCivilianPost } from './commercial-post.ts';
import { validateCommercialRegistry,validateCommercialBindings } from './commercial-save.ts';
import { commercialOnMapId } from './commercial-trip.ts';
import { validateDomesticAnimals } from './domestic-save.ts';
import { validAutoSlaughterTransport } from './auto-slaughter-save.ts';
import { validateAnimalRest } from './animal-rest-save.ts';
import { validateBreakdowns } from './breakdown-save.ts';
import { newBreakdownCalendar } from './breakdowns.ts';
import { consolidateLooseRocks } from './loose-rocks.ts';
import { validateAnimalPens } from './animal-pens-save.ts';
import {validatePawnAppearance} from './pawn-appearance.ts';
import { legacyHumanAge, validHumanAge } from './human-age.ts';
import {validFlakWorkShape,validateFlakWorks} from './flak-work.ts';
import {validArtWorkShape,validateArtWorks} from './art-work.ts';
import {validateArtObjects} from './art-save.ts';
import { validateWildFlora } from './wild-flora.ts';
import { validRoomExperience } from './room-experience.ts';
import { V91_ITEM_IDS,V190_ITEM_IDS } from './biome-items.ts';
import { V120_ANIMAL_PRODUCT_ITEMS } from './animal-product-items.ts';
import { validHumanBodyShape,validHumanCorpseShape,validGraveShape,validBurialTaskShape,validateBurials } from './burial-save.ts';
import { validateFlooring } from './flooring-save.ts';
import { validateFilth } from './filth-save.ts';
import { validFoodContamination } from './food-poisoning-save.ts';
import { validVisitorShape,validateVisitors } from './visitor-save.ts';
import { validTradeShape,validateTrade } from './trade-save.ts';
import { validateFires,validateThingDamage } from './fire-save.ts';
import { validateColonyEconomy } from './colony-economy-save.ts';
import { validSiteClimate } from './site-climate-save.ts';
import { validPlantLife } from './plant-life-save.ts';
import { validCropBlight } from './plant-blight-save.ts';
import {snowHistoricalFieldsAbsent,validateSnowTransport} from './snow-save.ts';
import { validateWeather } from './weather-save.ts';
import { validateWind } from './wind.ts';
import { validateHeaters } from './heater.ts';
import { conduitKeepsPlant } from './power-construction.ts';
import { validatePowerFlicks } from './power-flick.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { validSite } from './site.ts';
import { validScenario } from './scenario-save.ts';
import { validGameProfile,validateGameProfile } from './game-profile-save.ts';
import { validCorpseShape,validateCorpses } from './corpse-save.ts';
import { validHuntingTask,validateHunting } from './hunting-save.ts';
import { validateWildlife } from './wildlife-save.ts';
import { validateHeat } from './heat-save.ts';
import { validMiscIncidents } from './cassandra-misc-save.ts';
import { validSmallIncidents } from './cassandra-small-save.ts';
import { validWorldIncidents } from './cassandra-world-save.ts';
import { validFlashstorm } from './flashstorm-save.ts';
import { validRainElectrical } from './rain-electric-save.ts';
import { validPawnPodRescue,validPodRescueShape,validatePodRescues } from './pod-rescue-save.ts';
import { createPodDepartureValidator } from './pod-rescue-projection.ts';
import { validateResearch,validDeepResearchTransport } from './research-save.ts';
import { validBiofuelTransport,validBuildingFuelShape } from './biofuel-save.ts';
import { validCremationTransport } from './cremation-save.ts';
import { validFodderTransport } from './fodder-save.ts';
import { validKibbleProductionTransport } from './cooking-save.ts';
import { validSpikeTrapTransport } from './spike-trap-save.ts';
import { validSmeltingTransport } from './smelting-save.ts';
import { validAllowedAreaTransport } from './allowed-area-save.ts';
import { validDoubleBedTransport } from './double-bed-save.ts';
import { bedSlotCell } from './bed-slots.ts';
import { validNutrientPasteTransport } from './nutrient-paste-save.ts';
import { hopperCapacity } from './nutrient-paste.ts';
import { adoptPasteFoodPolicies } from './food-policy-save.ts';
import { validOrbitalTransport,registerOrbitalThingIds } from './orbital-save.ts';
import { validDeepDrillingTransport } from './deep-drilling-save.ts';
import { storageAccepts, validStorageItems } from './storage-filters.ts';
import { validStorageConditions } from './storage-condition.ts';
import { adoptStockpileZones,validStockpileZones } from './stockpile-zones.ts';
import { validGunWorkShape,validateGunWorks } from './gun-work.ts';
import { validComponentWorkShape,validateComponentWorks } from './component-work.ts';
import { validUnfinishedShape,validateUnfinished } from './unfinished.ts';
import { validateSocial } from './social-save.ts';
import { validBereavement } from './bereavement-save.ts';
import { validDeathThoughtsTransport } from './death-thoughts-save.ts';
import { validateBarriers } from './barrier-save.ts';
import { validMiniTurretShape,validateMiniTurrets } from './mini-turret-save.ts';
import { validBombRefugeShape,validateBombRefuges } from './bomb-danger.ts';
import { validateBombWaves } from './bomb-state.ts';
import { turretReloadCapacity,turretReloadPawnReason } from './mini-turret-reload.ts';
import { validateRaids } from './raid-save.ts';
import { validateArrivals } from './arrival-save.ts';
import { validateQuests } from './quest-save.ts';
import { groupOnMapMember } from './group-state.ts';
import { validTraits } from './traits.ts';
import { validBackground } from './colonist-backgrounds.ts';
import { validateMental,validMeleeThreatShape } from './mental-save.ts';
import { validApparelShape,validateApparel } from './apparel-save.ts';
import { validDisturbance } from './disturbance-state.ts';
import { validTacticsShape,validateTactics } from './tactics-save.ts';
import { validAttackMemory } from './automatic-combat-save.ts';
import { validAffiliationShape,validateAffiliations } from './affiliation-save.ts';
import { validStagger } from './stagger.ts';
import { travelEnd,validSlowIntervals,validStunIntervals,type TravelSegment } from './travel-timing.ts';
import { validMeleeShape,validStunShape,validateMelee } from './melee-save.ts';
import { validShootingShape,validateShooting } from './shooting-save.ts';
import { validDraftShape,validateDrafting } from './drafting-save.ts';
import { validateProjectiles } from './projectile-save.ts';
import { validEquipmentShape,validWeaponShape,validateEquipment } from './equipment-save.ts';
import { validFeedShape,validateFeeding } from './feeding-save.ts';
import { validTendShape,validateCare } from './care-save.ts';
import { validPawnSurgeryShape,validateSurgeries } from './surgery-save.ts';
import { validRescueShape,validateRescues } from './rescue-save.ts';
import { validSkills } from './skills-save.ts';
import { validateInterruptedCargo } from './interrupted-cargo.ts';
import { initialSkills } from './skills.ts';
import { validPlantThermalFactor } from './thermal-plants.ts';
import { validateTemperature } from './temperature-save.ts';
import { initializeLightWork, validateWorkProgress } from './work-progress-save.ts';
import { workProgress } from './work-progress.ts';
import { legacyProductionTicks, productionWorkTotal, taskRecipe, PRODUCTION_RECIPES } from './production-recipes.ts';
import {validateRoofing,validNaturalRoofState256} from './roof-save.ts';
import { isRoofJob } from './roof-rules.ts';
import { validateDoors } from './door-save.ts';
import { validateCoolers } from './cooler.ts';
import { validatePower } from './power-save.ts';
import { validateMining } from './mining-save.ts';
import { validateConstructionMaterials } from './construction-material-save.ts';
import { constructionCapacity, constructionSupplied, requiredMaterial } from './construction-materials.ts';
import { validStoneIdentity } from './geology.ts';
import { validateFurnitureHaul } from './furniture-haul-save.ts';
import { validateFurniture } from './furniture-transfer-save.ts';
import { validateDeconstruction } from './deconstruction-save.ts';
import { validatePriorityWork } from './priority-work-state.ts';
import { canStandAt } from './furniture-travel.ts';
import { initializeFurnitureTravel } from './furniture-save.ts';
import { initializeOccupancy } from './occupancy-save.ts';
import { groundOccupancyAllows, occupancyOf } from './occupancy.ts';
import { validSowingClearance } from './sowing-clearance.ts';
import { initializeConstruction, validateConstruction } from './construction-save.ts';
import { initializePlayerOrders, validatePlayerOrders, validSowingDestination } from './player-orders-save.ts';
import { isConstruction } from './construction-rules.ts';
import { initializeRecreation, validateRecreation } from './recreation-save.ts';
import { validateCooking } from './cooking-save.ts';
import { initializeSchedules, validateSchedules } from './schedule-save.ts';
import { initializeFoodPolicies, validateFoodPolicies } from './food-policy-save.ts';
import { initializePreservation, validatePreservation } from './food-preservation-save.ts';
import { fuelCapacity, fuelItem, isFueledBuilding } from './fuel.ts';
import { hydroponicPlantAllowed,initializeFarming, validateFarming } from './farming-save.ts';
import { jobDuration } from './farming.ts';
import { workType } from './work-planner.ts';
import { asideCapacity, haulingWork } from './haul-aside.ts';
import { harvestable, isPlant, legacyPlantGrowth } from './plants.ts';
import { groundPile, storageCapacity } from './ground-placement.ts';
import { validateTravel,MIN_PAWN_SPEED_V87,MAX_PAWN_DELAY_V87,MIN_PAWN_SPEED_V86,MAX_PAWN_DELAY_V86 } from './travel-validation.ts';
import { validPrisonerPawnShape,validatePrisoners } from './prisoner-save.ts';
import { serviceCell } from './service-reservations.ts';
import { CARRY_CAPACITY, footprintCells, JOB_WOOD_COST, MAX_STACK } from './definitions.ts';
import { deliveredStock, groundQuantity, reservedDestination, reservedSource } from './materials.ts';
import { migrateLegacy, initializeNeeds, initializeDining, initializeFood, initializeSpatial, initializePlants } from './save-migrations.ts';
import type { Resource,World } from './types.ts';
import {validGeographicMapDimension262} from './geographic-creation-options-262.ts';
import { INGEST_TICKS } from './eating.ts';
import { validDiningPlace } from './dining.ts';
import { ITEM_DEFINITIONS,V219_ITEM_IDS } from './items.ts';
import {isCoreStartingApparel256} from './starting-gear-256.ts';
import { validPlantGrowthLight } from './plant-light-save.ts';
import { SCHEMA_VERSION, TICKS_PER_DAY } from './types.ts';
import { validateScoutRegistry } from './caravan-save.ts';
import { scoutRegistryView,scoutOnMapId } from './caravan-trip.ts';
import { adultAgeTicks } from './animal-life.ts';
import { adoptFluIncidents } from './flu-incidents.ts';
import { validFluIncidents } from './flu-incidents-save.ts';
import { validEmpStructureTransport,validEmpProductionTransport } from './emp-save.ts';
import { adoptExoticMerchantSchedule } from './visitors.ts';
import { isFurnitureQuality } from './furniture-stats.ts';
import {validCoupleHistoricalTransport285} from './couple-owner-save-285.ts';
import {validLinkedStorageHistorical286,validLinkedStorageWorld286} from './linked-storage-save-286.ts';
import {validTradeRequestHistorical284} from './trade-request-save-284.ts';
import {validApparelProvenanceHistoricalTransport284} from './apparel-provenance-284.ts';
import { validateFlowerPotState } from './flower-pot.ts';
import { createDefaultApparelPolicyRegistry,validApparelPolicy } from './apparel-policy.ts';
import { APPAREL_POLICY_INTERVAL,APPAREL_WEAR_INTERVAL,createApparelWearCalendar } from './apparel-renewal.ts';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const integer = (value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const bounded = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const stock = (value: unknown): boolean => record(value) && integer(value.wood, 0, MAX_STACK * 32768) && integer(value.food, 0, MAX_STACK * 32768);
const oneOf = (value: unknown, values: string[]): boolean => typeof value === 'string' && values.includes(value);

/** Structural validation first, cross-reference validation second; accepts arbitrary JSON without throwing. */
export function validateWorld(input: unknown): string[] {
  return validateCampaignSchema(input,SCHEMA_VERSION);
}
/** Strict previous campaign contract, before the number-only285 migration. */
export function validateCampaignSchema284(input:unknown):string[] {
  return validateCampaignSchema(input,284);
}
/** Strict previous contract before the number-only286 migration. */
export function validateCampaignSchema285(input:unknown):string[] {
  return validateCampaignSchema(input,285);
}
/** Strict preceding contract before the number-only287 migration. */
export function validateCampaignSchema286(input:unknown):string[] {return validateCampaignSchema(input,286);}
/** Strict preceding contract before the number-only288 migration. */
export function validateCampaignSchema287(input:unknown):string[] {return validateCampaignSchema(input,287);}
/** Strict preceding contract before the number-only289 migration. */
export function validateCampaignSchema288(input:unknown):string[] {return validateCampaignSchema(input,288);}
/** Strict preceding contract before the number-only290 migration. */
export function validateCampaignSchema289(input:unknown):string[] {return validateCampaignSchema(input,289);}
export function validateCampaignSchema290(input:unknown):string[] {return validateCampaignSchema(input,290);}
export function validateCampaignSchema291(input:unknown):string[] {return validateCampaignSchema(input,291);}
export function validateCampaignSchema292(input:unknown):string[] {return validateCampaignSchema(input,292);}
/** Complete preceding campaign contract before the number-only294 migration. */
export function validateCampaignSchema293(input:unknown):string[] {return validateCampaignSchema(input,293);}
/** Complete preceding campaign contract before the number-only295 migration. */
export function validateCampaignSchema294(input:unknown):string[] {return validateCampaignSchema(input,294);}
/** Complete authentic predecessor before the number-only296 migration. */
export function validateCampaignSchema295(input:unknown):string[] {return validateCampaignSchema(input,295);}
/** Unpublished geographic factory output, before a map registry owns it.
 * Reuse the complete local-schema guard without synthesizing a campaign,
 * colony, group or registry. This never authorizes save/load or adoption;
 * those still require the complete registered campaign validator above. */
export function validateGeneratedLocalMap256(input:unknown,context:{readonly calendarOrigin:number;readonly settlement?:true;readonly settlementDimensions?:Readonly<{width:number;height:number}>;readonly worldTarget263?:WorldTargetGenerated263}):string[] {
  try {
    if(!record(input)||!isSchema256Or257(input.schemaVersion)||!record(input.planet)||input.planet.revision!==3
      ||!record(input.site)||input.site.revision!==3||Object.hasOwn(input,'worldMaps')||Object.hasOwn(input,'worldGroups')||!context||!Number.isSafeInteger(context.calendarOrigin))return ['Expected an unpublished geographic local-map candidate with its actual campaign clock.'];
    if(context.settlement&&(!validGeographicSettlementDimensions262(Number(input.schemaVersion),input.width,input.height,context.settlementDimensions)||['scenario','expeditionSite','startingArrival'].some(k=>Object.hasOwn(input,k))))return ['A non-starting settlement must have its actual new geographic body, without arrival or Camp provenance.'];
    if(context.worldTarget263&&(!isSchema263OrLater(Number(input.schemaVersion))||input.width!==context.worldTarget263.context.dimensions.width||input.height!==context.worldTarget263.context.dimensions.height||!record(input.site)||worldTargetConstructionReason263(input as unknown as World,context.worldTarget263.context,Number(input.site.tileId),Number(input.width))||['scenario','expeditionSite','startingArrival'].some(k=>Object.hasOwn(input,k))))return ['World target generation differs from its real construction authority.'];
    return validateSchema(input,input.schemaVersion as 256|257|258|259|260|261|262|263|264|265|266|267|268|269|270|271|272|273|274|275|276|277|278|279|280|281|282|283|284|285|286|287|288|289|290|291|292|293|294|295|296|297|298|299|300|301,false,undefined,context);
  }catch{return ['Invalid unpublished geographic local-map candidate.'];}
}
function validateSharedCampaign(root:CampaignState):string[] {const view=emptyCampaignOwner(root);brandCampaignContext(view,root);return validateCampaignSharedFields(view);}
/** Validate BOTH original map namespaces before a historical schema changes.
 * The secondary view forwards the old campaign schema without migrating it. */
function validateCampaignSchema(input:unknown,version:Parameters<typeof validateSchema>[1]):string[] {
  try{
    if(!validPhaseCore297(input,version))return ['Invalid or future campaign physical phase.'];
    if(!validShipEscapeHistorical298(input,version))return ['Historical save contains future escaped-ship data.'];
    if(record(input)&&'escapedShips298' in input&&!validEscapedShipsEnvelope298(input,version,Number(input.tick),Number(input.nextId),isSchema298OrLater(Number(version))?effectiveCore297(input as unknown as World):undefined))return ['Invalid escaped-ship campaign envelope.'];
    if(!validVictoryContentHistorical298(input,version))return ['Invalid or future victory content.'];
    if(!validCoreMoveHistoricalTransport297(input,version))return ['Invalid or future captured Core movement.'];
    if(!validWallDoorHistoricalTransport296(input,version))return ['Invalid or future wall-door successor data.'];
    if(!validNovelHistoricalTransport295(input,version))return ['Invalid or future Novel, reading task or policy.'];
    if(!validToxicFalloutHistoricalTransport294(input,version))return ['Invalid or future ToxicFallout data.'];
    if(!validPeaceTalksHistorical293(input,version))return ['Invalid or future PeaceTalks data.'];
    if(!validPartyHistoricalTransport292(input,version))return ['Invalid or future Party data.'];
    if(!validForestryHistoricalTransport291(input,version))return ['Invalid or future forestry data.'];
    if(!validFirefoamHistoricalTransport290(input,version))return ['Invalid or future firefoam data.'];
    if(!validBillPauseHistoricalTransport289(input,version))return ['Invalid or future bill reserve pause.'];
    if(!validAnimalThermalRefugeHistoricalTransport288(input,version))return ['Historical save contains future animal thermal refuge.'];
    if(!validAnimalAreaHistoricalTransport287(input,version))return ['Historical save contains future animal areas.'];
    if(!validLinkedStorageHistorical286(input,version))return ['Historical save contains future linked storage.'];
    if(!validCoupleHistoricalTransport285(input,version))return ['Historical save contains future couple fields.'];
    if(!validTradeRequestHistorical284(input,version)||!validApparelProvenanceHistoricalTransport284(input,version))return ['Historical save contains future trade requests or apparel provenance.'];
    if(!validBillWorkerHistoricalTransport283(input,version))return ['Historical save contains future bill worker settings.'];
    if(!validAnimalTrainingHistoricalTransport282(input,version))return ['Historical save contains future animal training or hauling.'];
    if(!validSmoothFloorsHistoricalTransport281(input,version))return ['Historical save contains future natural stone smoothing.'];
    if(!validPrisonerSurgeryHistoricalTransport280(input,version))return ['Historical save contains future captive surgery.'];
    if(!validApparelTradeHistoricalTransport279(input,version))return ['Historical save contains future ordinary apparel custody or trade.'];
    if(!validApparelReservesHistoricalTransport278(input,version))return ['Historical save contains future apparel reserve settings.'];
    if(!validShipCasketHistoricalTransport277(input,version))return ['Historical save contains future spatial casket content.'];
    if(!validShipPartHistoricalTransport276(input,version))return ['Historical save contains future ship hull or engine research.'];
    if(!validShipReactorHistoricalTransport275(input,version))return ['Historical save contains future ship reactor content.'];
    if(!validSpearHistoricalTransport272(input,version))return ['Historical save contains future spear catalogue.'];
    if(!validCryptosleepHistoricalTransport271(input,version))return ['Historical save contains future cryptosleep content.'];
    if(!validLongswordHistoricalTransport270(input,version))return ['Historical save contains future long-blade catalogue.'];
    if(!validMaceHistoricalTransport269(input,version))return ['Historical save contains future mace catalogue.'];
    if(!validKnifeHistoricalTransport268(input,version))return ['Historical save contains future knife manufacture.'];
    if(!historicalWorldSitesAbsent263(input,version))return ['Historical save contains future263 Site/settlement authority.'];
    if(!validCaravan261Historical(input,version))return ['Historical save contains future caravan261 state.'];
    if(!validCamp260Historical(input,version))return ['Historical save contains future Camp260 state.'];
    if(!input||typeof input!=='object'||!validWorldPawnsEnvelope256(input,version,(isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):Number((input as Record<string,unknown>).tick)*10),Number((input as Record<string,unknown>).nextId)))return ['Invalid or future WorldPawns header.'];
    if(!validGeographicRenewalCampaignRaw262(input,version))return ['Invalid or future original geographic renewal owner.'];
    if(!validGroupForageHistoricalTransport256(input,version))return ['Future local caravan foraged ownership.'];
    if(!validPlanetGeographyHistorical256(input,version))return ['Historical save contains future geographic owners.'];
    if(!validWorldMapHistorical(input,version))return ['Historical save contains future registry.'];
    if(!validMineableCampaignRaw256(input,version))return ['Invalid original Mineable ownership.'];
    if(!validExplorationCampaignRaw256(input,version))return ['Invalid original exploration namespace.'];
    if(!validRiverWaterCampaignRaw256(input,version))return ['Invalid original river water namespace.'];
    if(!validLocalRoadInfoCampaignRaw256(input,version))return ['Invalid original road namespace.'];
    if(!validLocalGeyserCampaignRaw256(input,version))return ['Invalid original geyser namespace.'];
    if(!validAncientShrineWarningCampaignRaw256(input,version))return ['Invalid original ancient shrine warning namespace.'];
    if(version>=255){const errors=validateRegisteredCampaign(input,(local,ids,later)=>validateSchema(local,version,true,ids,undefined,later),validateSharedCampaign);if(!errors.length&&version>=256)errors.push(...validateCampaignActorBeds256(input as CampaignState));if(!errors.length&&!validPeaceTalksBindings293(input))errors.push('Invalid PeaceTalks reciprocal campaign bindings.');if(!errors.length&&!validPartyWorld292(input as World))errors.push('Invalid Party owner or membership.');if(!errors.length&&!validFirefoamWorld290(input))errors.push('Invalid firefoam world or owner.');if(!errors.length&&!validBillPauseWorld289(input))errors.push('Invalid bill reserve pause settings.');if(!errors.length&&!validBillWorkerWorld283(input as World))errors.push('Invalid bill worker reference or settings.');if(!errors.length&&!validLinkedStorageWorld286(input as CampaignState))errors.push('Invalid linked storage owner, membership or effective policy.');if(!errors.length&&!validAnimalAreaWorld287(input as CampaignState))errors.push('Invalid animal area owner, references or return.');if(!errors.length&&!validAnimalThermalRefugeWorld288(input as CampaignState))errors.push('Invalid animal thermal refuge owner or task.');return errors;}
    if(!validSecondarySiteShape(input,version))return ['Invalid or future second-site authority.'];
    const homeIds=new Set<number>(),errors=validateSchema(input,version,true,homeIds);
    if(errors.length||!record(input))return errors;
    const local=secondaryMapForValidation(input as unknown as World);if(!local)return errors;
    const localIds=new Set<number>(),secondaryErrors=validateSchema(local,version,true,localIds);
    if(secondaryErrors.length)return secondaryErrors.map(e=>'Second site: '+e);
    for(const id of localIds)if(homeIds.has(id))errors.push('Thing identity owned by both campaign maps.');
    return errors;
  }catch{return ['Invalid second-site records or owner namespace.'];}
}
function validateSchema(raw: unknown, version: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 | 52 | 53 | 54 | 55 | 56 | 57 | 58 | 59 | 60 | 61 | 62 | 63 | 64 | 65 | 66 | 67 | 68 | 69 | 70 | 71 | 72 | 73 | 74 | 75 | 76 | 77 | 78 | 79 | 80 | 81 | 82 | 83 | 84 | 85 | 86 | 87 | 88 | 89 | 90 | 91 | 101 | 103 | 104 | 105 | 106 | 109 | 119 | 120 | 121 | 122 | 123 | 124 | 125 | 127 | 134 | 135 | 138 | 139 | 141 | 143 | 144 | 148 | 150 | 152 | 154 | 155 | 156 | 157 | 159 | 160 | 161 | 162 | 163 | 164 | 165 | 166 | 167 | 168 | 169 | 170 | 171 | 172 | 173 | 174 | 175 | 176 | 177 | 178 | 179 | 180 | 181 | 182 | 183 | 184 | 185 | 186 | 187 | 188 | 189 | 190 | 191 | 192 | 193 | 194 | 195 | 196 | 197 | 198 | 199 | 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207 | 208 | 209 | 210 | 211 | 212 | 213 | 214 | 215 | 216 | 217 | 218 | 219 | 220 | 221 | 222 | 223 | 224 | 225 | 226 | 227 | 228 | 229 | 230 | 231 | 232 | 233 | 234 | 235 | 236 | 237 | 238 | 239 | 240 | 241 | 242 | 243 | 244 | 245 | 246 | 247 | 248 | 249 | 250 | 251 | 252 | 253 | 254 | 255 | 256 | 257 | 258 | 259 | 260 | 261|262|263|264|265|266|267|268|269|270|271|272|273|274|275|276|277|278|279|280|281|282|283|284|285|286|287|288|289|290|291|292|293|294|295|296|297|298|299|300|301, relationshipContext = true,registeredIds?:Set<number>,generatedContext?:{readonly calendarOrigin:number;readonly settlement?:true;readonly settlementDimensions?:Readonly<{width:number;height:number}>;readonly worldTarget263?:WorldTargetGenerated263},registeredNonStartingSettlement=false): string[] {
  const legacyV2 = version === 2;
  const errors: string[] = [];
  if (!record(raw)) return ['World must be an object.'];
  if(!validPhaseCore297(raw,version))return ['Invalid or future local physical phase.'];
  if(!validCorePathBudget297(raw,version,Number(raw.tick),isCorePhysicalSchema297(version)?Number(raw.phaseCore297):0))return ['Invalid or future actual local path budget.'];
  if(!validVictoryContentHistorical298(raw,version))return ['Invalid or future local victory content.'];
  if(!validCoreMoveHistoricalTransport297(raw,version))return ['Invalid or future local captured Core movement.'];
  if(!validWallDoorHistoricalTransport296(raw,version))return ['Invalid or future local wall-door successor data.'];
  const targetContext263=generatedContext?.worldTarget263?.context??registeredWorldTargetContext263(raw as unknown as World);
  const temporaryTarget263=isSchema263OrLater(version)&&targetContext263!==undefined;
  if(temporaryTarget263&&(raw.width!==targetContext263.dimensions.width||raw.height!==targetContext263.dimensions.height||['scenario','expeditionSite','startingArrival'].some(k=>Object.hasOwn(raw,k))))return ['Invalid actual target263 local context.'];
  const worldPawnRoot=campaignAuthority(raw as unknown as World);
  if(!validWorldPawnsEnvelope256(worldPawnRoot,version,isCorePhysicalSchema297(version)?effectiveCore297(raw as unknown as World):Number(raw.tick)*10,Number(raw.nextId)))return ['Invalid or future WorldPawns header.'];
  if(Object.hasOwn(raw,'explorationApproachers'))return ['Transport-only exploration actors in RAW.'];
  if(!validRiverWaterEnvelope256(raw,version))return ['Invalid local river water.'];
  if(!validLocalRoadInfoEnvelope256(raw,version))return ['Invalid local road state.'];
  if(!validLocalGeyserEnvelope256(raw,version,Number(raw.tick),Number(raw.nextId)))return ['Invalid local geyser state.'];
  if(!validAncientShrineWarningEnvelope256(raw,version,Number(raw.tick),Number(raw.nextId)))return ['Invalid or future ancient shrine warning.'];
  const explorationErrors=validateExploration256(raw,version);if(explorationErrors.length)return explorationErrors;
  if(!validGroupForageHistoricalTransport256(raw,version))return ['Future local caravan foraged ownership.'];
  if(!validSecondarySiteShape(raw,version))return ['Invalid or future second-site authority.'];
  if(!validTuqueCatalogueDomains(raw,version))return ['Future tuque catalogue content.'];
  if(!validGroupProvisionsHistoricalTransport(raw,version))return ['Future mixed group provisions.'];
  if(!validGroupFreightHistoricalTransport(raw,version))return ['Future collective freight.'];
  if(!tundraHistoricalFieldsAbsent(raw,version))return ['Future tundra provenance.'];
  if(!snowHistoricalFieldsAbsent(raw,version))return ['Future snow content.'];
  const arrivalErrors=validateStartingArrivalOwners(raw as unknown as World,version);
  if(arrivalErrors.length)return arrivalErrors;
  if(!validHumanSleepingSpotProvenance(raw,version))return ['Invalid or future human sleeping spot provenance.'];
  if(!validAutoSlaughterTransport(raw as unknown as World,version))return ['Invalid or future auto slaughter policy.'];
  if(version<=195&&['planet','group','groupLosses'].some(k=>Object.hasOwn(raw,k)))return ['Historical schema contains future world/group fields.'];
  if(!validShelfTransport(raw as unknown as World,version))return ['Invalid or future shelf storage state.'];
  let input=raw;
  if (version >= 5 && !oneOf(input.foodRules, ['legacy', 'adult'])) errors.push('Invalid food rules profile.');
  if (version < 5 && input.foodRules !== undefined) errors.push('Legacy save contains version 5 fields.');
  if(!validProstheticCatalogueDomains273(input,version))errors.push('Future industrial prosthetics.');
  if(!validSpearCatalogueDomains272(input,version))errors.push('Future spear catalogue.');
  if(!validCryptosleepCatalogueDomains271(input,version))errors.push('Future player cryptosleep content.');
  if(!validLongswordCatalogueDomains270(input,version))errors.push('Future long-blade catalogue.');
  if(!validMaceCatalogueDomains269(input,version))errors.push('Future mace catalogue.');
  if(!validKnifeCatalogueDomains268(input,version))errors.push('Future knife manufacture.');
  if(!validSmithingCatalogueDomains267(input,version))errors.push('Future smithing catalogue content.');
  if(!validBrewingCatalogueDomains265(input,version))errors.push('Future brewing catalogue content.');
  if(!validPemmicanCatalogueDomains(input,version))errors.push('Future pemmican catalogue content.');
  if(!validReconCatalogueTransport(input,version))errors.push('Future recon catalogue content.');
  if (input.schemaVersion !== version) errors.push('Unsupported schema version; migrate older saves through deserializeWorld.');
  if (!integer(input.seed, 0, 0xffffffff) || !integer(input.rng, 1, 0xffffffff)) errors.push('Invalid deterministic random state.');
  if (!integer(input.tick, 0) || !integer(input.nextId, 1)) errors.push('Invalid tick or nextId.');
  if (!integer(input.logisticsCursor, 0)) errors.push('Invalid logistics search cursor.');
  if (!validGeographicMapDimension262(input.width,version) || !validGeographicMapDimension262(input.height,version)) return [...errors, 'Invalid dimensions.'];
  if(!validScenario(input.scenario,version,input.width,input.height))errors.push('Invalid scenario provenance for schema.');
  if(!validGameProfile(input.gameProfile,version,input.scenario,input.expeditionSite!==undefined,registeredNonStartingSettlement||generatedContext?.settlement===true||temporaryTarget263))errors.push('Invalid game profile for schema.');
  if(!validSite(input.site,version,input.scenario as World['scenario'],input.expeditionSite!==undefined)||version>=256&&!validGeographicSiteBinding256(input as unknown as World))errors.push('Invalid local site provenance for schema.');
  if(!validSiteClimate(input.climate,version,input as unknown as World,generatedContext?.calendarOrigin))errors.push('Invalid site climate for schema.');
  const size = input.width * input.height;
  if(!validNaturalRoofState256(input.roofing,version,size))return [...errors,'Invalid or future natural roofing.'];
  if(!validPodRescueShape(input.podRescues,version,input as unknown as World))errors.push('Invalid or future pod rescue state for schema.');
  if(input.mechanoids!==undefined&&(version<194||!Array.isArray(input.mechanoids)||input.mechanoids.length>size||input.mechanoids.some(m=>!validMechanoidShape(m,version,input.tick as number,undefined,isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):undefined))))errors.push('Invalid or future mechanoid population.');
  if(!validMechSalvageLedger(input as unknown as World,version))errors.push('Invalid or future mechanoid salvage ledger.');
  if(version<195&&Object.hasOwn(input,'relationships')||!validRelationshipState(input.relationships,version,input.tick as number))errors.push('Invalid or future relationship graph.');
  const arrays = ['tiles', 'pawns', 'resources', 'structures', 'jobs', 'piles', 'stockpiles', 'events'] as const;
  if (arrays.some(key => !Array.isArray(input[key]))) return [...errors, 'Missing world arrays.'];
  if(version<180&&(input.commercialTrip!==undefined||input.civilianPost!==undefined))return [...errors,'Future commercial state in legacy save.'];
  const commercialWorld=input as unknown as World;
  if(!validTorchTransport(commercialWorld,version))return [...errors,'Invalid or future torch lamp, fuel or original refuel owner.'];
  if(!validHumanSleepingSpotTransport(commercialWorld,version))return [...errors,'Invalid or future human sleeping spot, role or physical reservation.'];
  const commercialErrors=validateCommercialRegistry(commercialWorld,version);
  if(commercialErrors.length)return [...errors,...commercialErrors];
  const scoutErrors=validateScoutRegistry(input as unknown as World,version);
  if(scoutErrors.length)return [...errors,...scoutErrors];
  if(!validDoubleBedTransport(commercialWorld,version))return [...errors,'Invalid or future double bed, owner slot or reservation.'];
  if(!validCremationTransport(commercialWorld,version))return [...errors,'Invalid or future cremation station, filter or original owner.'];
  if(!validFodderTransport(commercialWorld,version)||!validKibbleProductionTransport(commercialWorld,version))return [...errors,'Invalid or future fodder, diet or production owner.'];
  if(!validSpikeTrapTransport(commercialWorld,version))return [...errors,'Invalid or future spike trap state, contact or original owner.'];
  // A projection validates every original Pawn/possession once with the common
  // rules. It never changes map arrays, persisted owners or derived map stock.
  const offMapScout=input.scout&&record(input.scout)&&record(input.scout.pawn)?input.scout.pawn:input.commercialTrip&&record(input.commercialTrip)&&record(input.commercialTrip.pawn)?input.commercialTrip.pawn:undefined;
  input=scoutRegistryView(input as unknown as World) as unknown as Record<string,unknown>;
  const tiles = input.tiles as unknown[];
  if (tiles.length !== size || tiles.some(tile => !record(tile) || !validMineableTile256(tile,version,(input.site as World['site'])?.revision===3,Number(input.nextId)) ||!validSmoothFloorTile281(tile as unknown as World['tiles'][number],version)|| !validCollapsedRock256(tile,version,Number(input.nextId),v=>admittedRoofTerrain256(v,version)) || !validMarshTile(tile as unknown as import('./types.ts').Tile,version,{schemaVersion:version,site:input.site as World['site']}) || !validStoneIdentity(tile.stone,tile.collapsedRock?(tile.collapsedRock as import('./collapsed-rocks-256.ts').CollapsedRock256).terrain:tile.terrain,version)||!validBridgeTile(tile,version))) errors.push('Invalid terrain grid.');
  if (!stock(input.stock)) errors.push('Invalid derived stock.');
  const coord = (item: Record<string, unknown>): boolean => integer(item.x, 0, (input.width as number) - 1) && integer(item.z, 0, (input.height as number) - 1);
  const ids = new Set<number>();
  if(!errors.length&&!registerMineableIdentities256((tiles as import('./types.ts').Tile[]).flatMap(t=>t.mineable?[t.mineable]:[]),ids))errors.push('Duplicate Mineable identity.');
  if(input.geysers&&!registerGeyserIdentities256(input.geysers as import('./local-geyser-state-256.ts').LocalGeysers256,ids))errors.push('Duplicate geyser identity.');
  if(input.ancientShrineWarnings&&!registerAncientShrineWarningIds256(input.ancientShrineWarnings as import('./ancient-shrine-warning-state-256.ts').AncientShrineWarnings256,ids))errors.push('Duplicate ancient shrine warning Thing identity.');
  if(!errors.length&&!registerCollapsedRockIdentities256(tiles as import('./types.ts').Tile[],ids))errors.push('Duplicate collapsed rock identity.');
  errors.push(...validateCivilianPost(commercialWorld,version,commercialWorld.worldMaps?undefined:ids));
  if(errors.length)return errors;
  for (const key of ['pawns', 'resources', 'structures', 'jobs', 'piles', 'stockpiles'] as const) {
    const items = input[key] as unknown[];
    if (items.length > (key === 'piles' ? 32768 : key==='jobs'&&version>=35?size*(version>=85?3:2):key==='structures'&&version>=85?size*2:size)) errors.push(`Too many ${key}.`);
    for (const item of items) {
      if (!record(item) || !integer(item.id, 1) || (key !== 'piles' && !coord(item))) { errors.push(`Invalid ${key} identity or cell.`); continue; }
      if(key!=='pawns'&&!validPartyNonOwner292(item))errors.push('Party state requires its actual owner.');
      if(key==='structures'&&!validShipComputerSensorsBuilding298(item,version,input as unknown as World)||key==='jobs'&&!validShipComputerSensorsField298(item,version,'job'))errors.push('Invalid fixed ship computer/sensors state.');
      if(key==='structures'&&!validShipCasketBuilding277(item,version,input as unknown as World,Number(input.tick),isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):undefined)||key==='jobs'&&'shipCryptosleep277'in item)errors.push('Invalid spatial casket physical state.');
      if(key==='structures'&&!validCryptosleepBuilding271(item,version,input as unknown as World,Number(input.tick),isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):undefined)||key==='jobs'&&(Object.hasOwn(item,'cryptosleep')||item.kind!=='cryptosleep-casket'&&!validCryptosleepField271(item,version,Number(input.tick))))errors.push('Invalid player-casket physical state.');
      if((key==='structures'||key==='jobs')&&!validAncientCasketField256(item,version,input.tick as number,isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):undefined))errors.push('Invalid or future actual casket field.');
      if (ids.has(item.id)) errors.push('Duplicate entity ID.'); ids.add(item.id);
      if (integer(input.nextId, 1) && item.id >= input.nextId) errors.push('nextId must exceed all entity IDs.');
      if(key==='jobs'&&(!validTreeJobShape(item,version,Number(input.nextId))||!validPlantTargetShape(item,version,Number(input.nextId))))errors.push('Invalid or future plant designation.');
      if(key==='resources'&&!validPlantLife(item as unknown as World['resources'][number],version,input as unknown as World))errors.push('Invalid plant life for schema.');
      if(key==='resources'&&!validCropBlight(item,version,input as unknown as World))errors.push('Invalid crop blight for schema.');
      if (key === 'pawns') {
        errors.push(...(item===offMapScout?validatePawnRecordShape(item,input as unknown as World,version,Number(input.tick),undefined,Number(input.tick)*10):validatePawnRecordShape(item,input as unknown as World,version)));
      } else if (key === 'resources') {
        if (!validPlantThermalFactor(item,version)) errors.push('Invalid plant thermal factor.');
        if (!validStoneIdentity(item.stone, item.kind, version)) errors.push('Invalid resource stone identity.');
        if (!oneOf(item.kind, ['tree', 'berries', 'rock', ...(version >= 8 ? ['rice'] : []), ...(version>=71?['cotton']:[]),...(version>=84?['potato','corn']:[]),...(version>=91?['wild-plant']:[]),...(version>=182?['healroot']:[]),...(version>=227?['haygrass']:[]),...(version>=265?['hops']:[])]) || !integer(item.amount, version>=91&&item.kind==='wild-plant'?0:1, item.kind==='healroot'?1:1000000)) errors.push('Invalid resource.');
        if(!validPlantGrowthLight(item as unknown as Resource,version,input.tick as number))errors.push('Invalid plant light interval.');
        if (item.growth !== undefined || item.growthTick !== undefined) {
          if (version < 7 || !(item.kind === 'berries' || (version >= 8 && item.kind === 'rice') || (version>=71&&item.kind==='cotton') || (version>=84&&(item.kind==='potato'||item.kind==='corn')) || (version>=182&&item.kind==='healroot') || (version>=227&&item.kind==='haygrass') || (version>=265&&item.kind==='hops') || (version>=91&&item.species!==undefined&&(item.kind==='tree'||item.kind==='wild-plant'))) || typeof item.growth !== 'number' || !Number.isFinite(item.growth) || item.growth < 0 || item.growth > 1 || !integer(item.growthTick, 0, input.tick as number)) errors.push('Invalid plant growth checkpoint.');
        }
        if(version<91&&item.species!==undefined||version<167&&item.species==='healroot-wild')errors.push('Future flora species in older save.');
      } else if (key === 'structures' || key === 'jobs') {
        if(!validAncientCasketBuilding256(item,version,input as unknown as World,Number(input.tick),isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):undefined))errors.push('Invalid actual casket geometry/state.');
        if(Object.hasOwn(item,'turret')&&(key!=='structures'||item.kind!=='mini-turret'||!validMiniTurretShape(item.turret,version,isCorePhysicalSchema297(version)?effectiveCore297(input as unknown as World):Number(input.tick)*10,Number(input.nextId))))errors.push('Invalid turret state for schema.');
        if(item.gatherSpot!==undefined&&(version<124||key!=='structures'||!['campfire','table','table-square','table-long'].includes(String(item.kind))||typeof item.gatherSpot!=='boolean'))errors.push('Invalid or future gathering spot.');
        const flowerPotId=item.flowerPotId;
        if(flowerPotId!==undefined){
          const pot=(input.structures as Record<string,unknown>[]).find(s=>s.id===flowerPotId&&s.kind==='flower-pot');
          const flower=pot&&record(pot.flower)?pot.flower:undefined,plant=flower?.plant;
          if(version<90||key!=='jobs'||!integer(flowerPotId,1)||!pot||pot.x!==item.x||pot.z!==item.z||item.kind!=='sow'&&item.kind!=='cut'||item.kind==='sow'&&(plant!==undefined||flower?.allowSow!==true)||item.kind==='cut'&&plant===undefined)errors.push('Invalid flower pot work target.');
        }
        const qualityKinds=['bed',...(version>=187?['hospital-bed']:[]),...(version>=224?['double-bed']:[]),...(version>=256?['bedroll','sarcophagus']:[]),'table','stool','dining-chair','armchair','end-table','dresser','table-square','table-long','flower-pot',...(version>=122?['chess-table']:[])];
        if(version<90?item.quality!==undefined:key==='structures'&&(qualityKinds.includes(String(item.kind))||version>=104&&['small-sculpture','large-sculpture'].includes(String(item.kind)))?!isFurnitureQuality(item.quality):item.quality!==undefined)errors.push('Invalid furniture quality for schema.');
        if(item.flower!==undefined&&(version<90||key!=='structures'||item.kind!=='flower-pot'||validateFlowerPotState(item.flower,input.tick as number).length>0))errors.push('Invalid flower pot state for schema.');
        if(version>=90&&key==='structures'&&item.kind==='flower-pot'&&item.flower===undefined)errors.push('Flower pot lacks its physical plant state.');
        if((item.kind==='grave'||version>=256&&item.kind==='sarcophagus')&&key==='structures'?!validGraveShape(item.grave,version):item.grave!==undefined)errors.push('Invalid grave state.');
        if(item.medical!==undefined&&(version<46||key!=='structures'||(!isBedKind(item.kind)&&!(version>=221&&item.kind==='animal-sleeping-spot'))||item.kind==='hospital-bed'&&version<187||item.medical!==true))errors.push('Invalid medical bed role.');
        if(item.prisoner!==undefined&&(version<86||key!=='structures'||!isBedKind(item.kind)||item.kind==='hospital-bed'&&version<187||item.prisoner!==true))errors.push('Invalid prisoner bed role.');
        if (!oneOf(item.kind, key === 'structures' ? (version < 4 ? ['wall', 'bed'] : ['wall', 'bed', 'table', 'stool', ...(version>=10?['campfire']:[]), ...(version>=15?['horseshoes']:[]), ...(version>=31?['stonecutter']:[]), ...(version>=34?['door']:[]),...(version>=143?['autodoor']:[]), ...(version>=40?['passive-cooler']:[]),...(version>=42?['wood-generator','standing-lamp']:[]),...(version>=177?['sun-lamp']:[]),...(version>=187?['hospital-bed']:[]),...(version>=224?['double-bed']:[]),...(version>=256?['ship-chunk','bedroll','insect-hive','glow-pod','ancient-road-barrier','ancient-road-lamp','ancient-cryptosleep-casket',...ANCIENT_MONUMENT_KINDS_256]:[]),...(version>=75?['cooler']:[]),...(version>=73?['research-bench','tailor-bench']:[]),...(version>=72?['crafting-spot']:[]),...(version>=79?['butcher-spot']:[]),...(version>=84?['fueled-stove','electric-stove','butcher-table']:[]),...(version>=85?['power-conduit','power-switch','battery','solar-generator']:[]),...(version>=87?['heater','wind-turbine']:[]),...(version>=89?['grave']:[]),...(version>=104?['art-bench','small-sculpture','large-sculpture']:[]),...(version>=101?['machining-table']:[]),...(version>=123?['hi-tech-research-bench','multi-analyzer','fabrication-bench']:[]),...(version>=90?['electric-tailor-bench','table-square','table-long','dining-chair','armchair','end-table','dresser','flower-pot']:[]),...(version>=122?['chess-table']:[]),...(version>=119?['fence','fence-gate','pen-marker']:[]),...(version>=189?['sandbags']:[]),...(version>=190?['tube-television']:[]),...(version>=193?['mini-turret']:[]),...(version>=203?['hydroponics-basin']:[]),...(version>=206?['drug-lab']:[]),...(version>=211?['vitals-monitor']:[]),...(version>=215?['deep-drill','ground-scanner']:[]),...(version>=216?['orbital-beacon','comms-console']:[]),...(version>=217?['nutrient-paste-dispenser','hopper']:[]),...((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?['firefoam-popper']:[]),...(version>=264?['geothermal-generator']:[]),...(isSchema298OrLater(version)?['ship-computer','ship-sensors']:[]),...(isSchema275OrLater(version)?['ship-reactor']:[]),...(isSchema276OrLater(version)?['ship-beam','ship-engine']:[]),...(isSchema277OrLater(version)?['ship-cryptosleep-casket']:[]),...(isSchema271OrLater(version)?['cryptosleep-casket']:[]),...(version>=267?['fueled-smithy','electric-smithy']:[]),...(version>=265?['brewery','fermenting-barrel']:[]),...(version>=249?['torch-lamp']:[]),...(version>=244?['vent']:[]),...(version>=229?['shelf','small-shelf']:[]),...(version>=226?['spike-trap']:[]),...(version>=225?['electric-crematorium']:[]),...(version>=222?['electric-smelter']:[]),...(version>=218?['biofuel-refinery','chemfuel-generator']:[]),...(version>=221?['animal-sleeping-spot']:[]),...(version>=232?['sleeping-spot']:[])]) : (version < 4 ? ['chop', 'harvest', 'wall', 'bed'] : [...(isSchema281OrLater(version)?['smooth-floor']:[]),...(version>=247?['build-bridge','remove-bridge']:[]),...((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))?['firefoam-popper']:[]),...(version>=264?['geothermal-generator']:[]),...(isSchema298OrLater(version)?['ship-computer','ship-sensors']:[]),...(isSchema275OrLater(version)?['ship-reactor']:[]),...(isSchema276OrLater(version)?['ship-beam','ship-engine']:[]),...(isSchema277OrLater(version)?['ship-cryptosleep-casket']:[]),...(isSchema271OrLater(version)?['cryptosleep-casket']:[]),...(version>=267?['fueled-smithy','electric-smithy']:[]),...(version>=265?['brewery','fermenting-barrel']:[]),...(version>=249?['torch-lamp']:[]),...(version>=244?['vent']:[]),...(version>=229?['shelf','small-shelf']:[]),...(version>=84?['fueled-stove','electric-stove','butcher-table']:[]),...(version>=85?['power-conduit','power-switch','battery','solar-generator']:[]),...(version>=87?['heater','wind-turbine']:[]),...(version>=89?['grave','lay-floor','remove-floor']:[]),...(version>=104?['art-bench']:[]),...(version>=101?['machining-table']:[]),...(version>=123?['hi-tech-research-bench','multi-analyzer','fabrication-bench']:[]),...(version>=90?['electric-tailor-bench','table-square','table-long','dining-chair','armchair','end-table','dresser','flower-pot']:[]),...(version>=122?['chess-table']:[]),...(version>=119?['fence','fence-gate','pen-marker']:[]),...(version>=189?['sandbags']:[]),...(version>=190?['tube-television']:[]),...(version>=193?['mini-turret']:[]),...(version>=203?['hydroponics-basin']:[]),...(version>=206?['drug-lab']:[]),...(version>=211?['vitals-monitor']:[]),...(version>=215?['deep-drill','ground-scanner']:[]),...(version>=216?['orbital-beacon','comms-console']:[]),...(version>=217?['nutrient-paste-dispenser','hopper']:[]),...(version>=226?['spike-trap']:[]),...(version>=225?['electric-crematorium']:[]),...(version>=222?['electric-smelter']:[]),...(version>=218?['biofuel-refinery','chemfuel-generator']:[]),...(version>=35?['build-roof','remove-roof']:[]), ...(version>=28?['mine']:[]), ...(version>=25?['install','uninstall']:[]), ...(version>=75?['cooler']:[]),...(version>=73?['research-bench','tailor-bench']:[]),...(version>=67?['repair']:[]),...(version>=144?['fix-breakdown']:[]),...(version>=85?['flick']:[]), ...(version>=24?['deconstruct']:[]), ...(version>=235?['extract-tree','replant-tree']:[]),'chop', 'harvest', ...(version >= 7 ? ['cut'] : []), ...(version >= 8 ? ['sow'] : []), 'wall', 'bed', 'table', 'stool', ...(version>=10?['campfire']:[]), ...(version>=15?['horseshoes']:[]), ...(version>=31?['stonecutter']:[]), ...(version>=34?['door']:[]),...(version>=143?['autodoor']:[]), ...(version>=40?['passive-cooler']:[]),...(version>=42?['wood-generator','standing-lamp']:[]),...(version>=177?['sun-lamp']:[]),...(version>=187?['hospital-bed']:[]),...(version>=224?['double-bed']:[]),...(version>=256?['bedroll',...ANCIENT_MONUMENT_KINDS_256]:[])])) || !integer(item.orientation, 0, 3)
          || !oneOf(item.footprint, ['standard', 'legacy-single']) || (item.footprint === 'legacy-single' && item.kind !== 'bed' && !(version>=24&&item.kind==='deconstruct'||version>=25&&['install','uninstall'].includes(String(item.kind))))) errors.push('Invalid structure definition or footprint.');
        if (key==='structures' && isFueledBuilding(item.kind)) {
          const f=item.fuel;
          if(!validBuildingFuelShape(f,item.kind,version,input.tick as number))errors.push('Invalid building fuel.');
        } else if(item.fuel!==undefined)errors.push('Unexpected fuel state.');
        if (key === 'jobs' && (!oneOf(item.status, ['pending', 'active']) || !(item.reservedBy === null || integer(item.reservedBy, 1)) || !stock(item.escrow) || !integer(item.progress, 0, version>=31?Number.MAX_SAFE_INTEGER:119))) errors.push('Invalid job.');
      } else if (key === 'piles') {
        errors.push(...validatePileRecordShape(item, input as unknown as World, version));
      } else if (item.items!==undefined&&(version<197&&V219_ITEM_IDS.some(i=>Object.hasOwn(item.items as object,i))||version<194&&Object.hasOwn(item.items as object,'scyther-corpse')||version<101||version<178&&Object.keys(item.items as object).some(i=>V190_ITEM_IDS.includes(i))||!validStorageItems(item.items,version)||version<104&&Object.hasOwn(item.items as object,'unfinished-sculpture')||version<120&&Object.keys(item.items as object).some(i=>V120_ANIMAL_PRODUCT_ITEMS.includes(i))||version<123&&Object.keys(item.items as object).some(i=>['gold','plasteel','advanced-component'].includes(i))||version<141&&Object.keys(item.items as object).some(i=>i==='flak-helmet'||i==='unfinished-flak-helmet')||version<148&&Object.keys(item.items as object).some(i=>i==='recon-helmet'||i==='unfinished-recon-helmet')||version<152&&Object.hasOwn(item.items as object,'fine-meal')||version<154&&Object.hasOwn(item.items as object,'lavish-meal')||version<155&&Object.hasOwn(item.items as object,'vegetarian-fine-meal')||version<156&&Object.hasOwn(item.items as object,'carnivore-fine-meal')||version<157&&Object.hasOwn(item.items as object,'vegetarian-lavish-meal')||version<159&&Object.hasOwn(item.items as object,'carnivore-lavish-meal'))||record(item.filters)&&Object.hasOwn(item.filters,'prosthesis')&&(!isSchema273OrLater(version)||typeof item.filters.prosthesis!=='boolean')||record(item.filters)&&Object.hasOwn(item.filters,'plant')&&(version<235||typeof (item.filters as Record<string,unknown>).plant!=='boolean')||!record(item.filters) || typeof item.filters.wood !== 'boolean' || typeof item.filters.food !== 'boolean' || item.filters['mech-corpse']!==undefined&&(version<194||typeof item.filters['mech-corpse']!=='boolean') || item.filters.silver!==undefined&&(version<88||typeof item.filters.silver!=='boolean') || (['wort','beer'].some(k=>Object.hasOwn(item.filters as object,k))&&(version<265||['wort','beer'].some(k=>Object.hasOwn(item.filters as object,k)&&typeof (item.filters as Record<string,unknown>)[k]!=='boolean'))) || Object.hasOwn(item.filters,'jade')&&(version<256||typeof item.filters.jade!=='boolean') || item.filters.corpse!==undefined&&(version<79||typeof item.filters.corpse!=='boolean') || item.filters.unfinished!==undefined&&(version<72||typeof item.filters.unfinished!=='boolean') || item.filters.textile!==undefined&&(version<71||typeof item.filters.textile!=='boolean') || item.filters.apparel!==undefined&&(version<63||typeof item.filters.apparel!=='boolean') || item.filters.weapon!==undefined&&(version<52||typeof item.filters.weapon!=='boolean') || Object.hasOwn(item.filters,'chemfuel')&&(version<218||typeof item.filters.chemfuel!=='boolean') || Object.hasOwn(item.filters,'neutroamine')&&(version<206||typeof item.filters.neutroamine!=='boolean') || item.filters.medicine!==undefined&&(version<51||typeof item.filters.medicine!=='boolean') || item.filters.component!==undefined&&(version<41||typeof item.filters.component!=='boolean') || item.filters.blocks!==undefined&&(version<32||typeof item.filters.blocks!=='boolean') || Object.hasOwn(item.filters,'uranium')&&(version<241||typeof item.filters.uranium!=='boolean') || item.filters.gold!==undefined&&(version<123||typeof item.filters.gold!=='boolean') || item.filters.plasteel!==undefined&&(version<123||typeof item.filters.plasteel!=='boolean') || item.filters['advanced-component']!==undefined&&(version<123||typeof item.filters['advanced-component']!=='boolean') || item.filters.steel!==undefined&&(version<29||typeof item.filters.steel!=='boolean') || item.filters.chunk!==undefined&&(version<28||typeof item.filters.chunk!=='boolean') || item.filters.furniture!==undefined&&(version<26||typeof item.filters.furniture!=='boolean')
        || !validStorageConditions(item,version) || !integer(item.priority, 1, version>=219?5:4) || !integer(item.capacity, 1, version>=88?ITEM_DEFINITIONS.silver.stackLimit:MAX_STACK)) errors.push('Invalid storage policy.');
    }
  }
  if(!errors.length&&!validStockpileZones(input as unknown as World,version))errors.push('Invalid or future stockpile zone identity/policy.');
  const events = input.events as unknown[];
  if (events.length > 80 || events.some(item => !record(item) || !integer(item.tick, 0, input.tick as number) || !oneOf(item.type, ['job', 'need', 'command']) || typeof item.message !== 'string' || item.message.length > 240)) errors.push('Invalid event log.');
  if (version >= 8 && !errors.length) errors.push(...validateFarming(input, size, ids));
  if(!errors.length)errors.push(...validateSnowTransport(input as unknown as World,version),...validateTemperature(input as unknown as World,version));
  if(!errors.length)errors.push(...validateWorkProgress(input as unknown as World,version));
  if(!errors.length)errors.push(...validateMining(input as unknown as World,version));
  if(!errors.length)errors.push(...validateFurniture(input as unknown as World,version,ids,true));
  if(!errors.length)errors.push(...registerShelfThingIds(input as unknown as World,ids));
  if(!errors.length)for(const pack of (input as unknown as World).packed??[])if(pack.building.gatherSpot!==undefined&&(version<124||!['table','table-square','table-long'].includes(pack.building.kind)||typeof pack.building.gatherSpot!=='boolean'))errors.push('Invalid or future packed gathering spot.');
  if(!errors.length)errors.push(...validateBarriers(input as unknown as World,version));
  if(!errors.length)errors.push(...validateBreakdowns(input as unknown as World,version));
  if(!errors.length)errors.push(...validateDeconstruction(input as unknown as World,version,true));
  if(!errors.length&&!validWallDoorWorld296(input as unknown as World))errors.push('Invalid physical wall-door successor or implicit work owner.');
  if(!errors.length)errors.push(...validatePriorityWork(input as unknown as World,version));
  if(!errors.length)errors.push(...validatePlayerOrders(input as unknown as World,version,true));
  if(!errors.length)errors.push(...validateCooking(input,version,ids));
  if(!errors.length)errors.push(...validateDoors(input as unknown as World,version));
  if(!errors.length)errors.push(...validateAnimalPens(input as unknown as World,version));
  if(!errors.length)errors.push(...validateConstructionMaterials(input as unknown as World,version));
  if(!errors.length)errors.push(...validatePreservation(input as unknown as World,version));
  if(!errors.length)errors.push(...validateSchedules(input as unknown as World,version));
  if(!errors.length)errors.push(...validateFoodPolicies(input as unknown as World,version));
  if(!errors.length)errors.push(...validateRecreation(input as unknown as World,version));
  if(!errors.length)errors.push(...validateConstruction(input as unknown as World,version));
  if(!errors.length)errors.push(...validateRoofing(input as unknown as World,version));
  if(!errors.length)errors.push(...validatePlayerOrders(input as unknown as World,version));
  if(!errors.length&&!validateWildFlora(input as unknown as World,version))errors.push('Invalid wild flora.');
  if(!errors.length&&!validTundraTransport(input as unknown as World,version,generatedContext?.calendarOrigin))errors.push('Invalid tundra provenance.');
  if(!errors.length)errors.push(...validateV90Persistence(input as unknown as World,version));
  if (errors.length) return errors;
  const groupErrors=validateGroupState(commercialWorld,version);
  if(groupErrors.length)return groupErrors;
  const planetErrors=validatePlanet(commercialWorld.planet,commercialWorld,version);
  if(planetErrors.length)return planetErrors;
  let humanOwners298:ReturnType<typeof captureHumanOwners>|undefined;
  const readHumanOwners298=()=>humanOwners298??=captureHumanOwners(commercialWorld);
  if(!validHumanIngestionOwners299(commercialWorld,version,readHumanOwners298))return ['Invalid actual human ingestion clock or provider provenance.'];
  if(!validIdleWanderOwners300(commercialWorld,version,readHumanOwners298))return ['Invalid actual local civil wander task.'];
  if(!validFrameOwners301(commercialWorld,version,readHumanOwners298))return ['Invalid actual FinishFrame301 owner or work.'];
  const knownPeople=(commercialWorld.worldMaps||commercialWorld.group||commercialWorld.groupLosses?.length||commercialWorld.secondarySite||isSecondaryContext(commercialWorld))?readHumanOwners298().people:undefined;
  const world = input as unknown as World;
  errors.push(...validateFlooring(world,version),...validateSmoothFloors281(world,version),...validateFilth(world,version,ids),...validateBurials(world,version,ids));
  if(errors.length)return errors;
  errors.push(...validateMechanoids(world,version,ids));
  if(errors.length)return errors;
  errors.push(...validateColonyEconomy(world,version));
  errors.push(...validateGameProfile(world,temporaryTarget263));
  const defenceConstruction=generatedContext?.worldTarget263&&world.worldDefence263?{source:generatedContext.worldTarget263.context.kind==='foreign-settlement'?{kind:'foreign-settlement' as const,settlementId:generatedContext.worldTarget263.context.settlementId}:{kind:world.worldSites263?.entries.some(s=>s.id===(generatedContext.worldTarget263!.context.kind==='quest-site'?generatedContext.worldTarget263!.context.siteId:-1)&&s.kind==='item-stash'&&s.threat.kind==='turrets')?'turrets' as const:'outpost' as const,siteId:generatedContext.worldTarget263.context.siteId},factionId:generatedContext.worldTarget263.context.factionId!,bornAtCore:world.tick*10}:undefined;
  if(!validWorldTargetDefence263(world,version,defenceConstruction))errors.push('Invalid actual target263 defence owner.');
  if(!validSiteDefenceSource263(world,version))errors.push('Site defence differs from its actual selected threat.');
  if(!validWorldSiteAmbush263(world,version,generatedContext?.worldTarget263?.context.kind==='quest-site'?generatedContext.worldTarget263.context.siteId:undefined))errors.push('Invalid actual Site ambush continuation.');
  errors.push(...validateRaids(world,version,ids));
  if(!errors.length)errors.push(...validatePrisoners(world,version,ids));
  if(errors.length)return errors;
  errors.push(...validateArrivals(world,version));
  errors.push(...validateQuests(commercialWorld,version));
  errors.push(...validateMental(world,version));
  errors.push(...validateSocial(world,version,knownPeople?new Set(knownPeople.keys()):undefined));
  for(const pawn of world.pawns)if(!validBereavement(pawn.bereavement,pawn.id,version,world,knownPeople))errors.push('Invalid bereavement memory.');
  if(!validDeathThoughtsTransport(commercialWorld,version))errors.push('Invalid perceived death memory or owner.');
  if(!validArtificialPartsWorldTransport(commercialWorld,version))errors.push('Invalid artificial anatomy or owner clock.');
  if(!validCobraClinicalWorld256(commercialWorld,version))errors.push('Invalid Cobra clinical owner frontier');
  if(!validCryptosleepSicknessWorldTransport256(commercialWorld,version))errors.push('Invalid cryptosleep sickness or physical owner clock.');
  if(version>=44)errors.push(...validateInterruptedCargo(world));
  // The unpublished generator has shared Site references but no campaign owner
  // registry yet. It cannot be saved/adopted through this private local gate.
  if(!errors.length&&!(generatedContext?validPeaceTalksRegistryScalars293(world):validPeaceTalksBindings293(world)))errors.push('Invalid PeaceTalks reciprocal bindings.');
  if(!errors.length&&!validPartyWorld292(world))errors.push('Invalid Party owner or membership.');
  if(version>=45)errors.push(...validatePawnHealth(world));
  if(version>=46)errors.push(...validateRescues(world));
  if(version>=48)errors.push(...validateFeeding(world));
  if(version>=47)errors.push(...validateCare(world));
  errors.push(...validateSurgeries(world,version));
  errors.push(...validateHeat(world,version));
  if(!validMiscIncidents(world.miscIncidents,version,world))errors.push('Invalid or future Misc incident calendar for schema.');
  if(!validSmallIncidents(world.smallIncidents,version,world))errors.push('Invalid or future small threat calendar for schema.');
  if(version<184&&Object.hasOwn(world,'worldIncidents')||!validWorldIncidents(world.worldIncidents,version,world))errors.push('Invalid or future World incident calendar for schema.');
  if(!validFlashstorm(world.flashstorm,version,world))errors.push('Invalid or future Flashstorm incident for schema.');
  if(!validRainElectrical(world.rainElectrical,version,world))errors.push('Invalid or future electrical rain state for schema.');
  if(!validFluIncidents(world,version))errors.push('Invalid or missing flu incident calendar for schema.');
  if(!validEmpStructureTransport(world,version))errors.push('Invalid or future EMP device state.');
  if(!validEmpProductionTransport(world,version))errors.push('Locked or future EMP production.');
  errors.push(...validateWildlife(world,version,ids));
  if(!errors.length)errors.push(...validateDomesticAnimals(world,version));
  if(!errors.length)errors.push(...validateAnimalRest(world,version));
  if(errors.length)return errors;
  errors.push(...validateCommercialBindings(commercialWorld,version,ids));
  if(errors.length)return errors;
  errors.push(...validateCorpses(world,version),...validateHunting(world,version));
  errors.push(...validateResearch(world,version));
  if(!validBiofuelTransport(commercialWorld,version))errors.push('Invalid biofuel content, original owner or fuel transport.');
  if(!validAllowedAreaTransport(commercialWorld,version))errors.push('Invalid or future allowed area, original assignment or return.');
  if(!validDeteriorationTransport(world,version))errors.push('Invalid or future deterioration clock or owner.');
  if(!validBurnApparelTransport(world,version))errors.push('Invalid or future apparel-burning recipe, filter or owner.');
  if(!validSmeltingTransport(commercialWorld,version))errors.push('Invalid or future smelting content, filter or owner.');
  if(!validNutrientPasteTransport(commercialWorld,version))errors.push('Invalid nutrient paste content, source or transport.');
  if(!validFactionCommsTransportForSnapshot298(commercialWorld,version,readHumanOwners298))errors.push('Invalid faction communication task/contact.');
  if(!validOrbitalTransport(commercialWorld,version))errors.push('Invalid orbital state, ownership or task.');
  if(!validAlcoholWorld265(world,version))errors.push('Invalid or future alcohol, drug policy or actual owner.');
  if(!validCraftingFuelTransport269(world,version))errors.push('Invalid or future crafting refuel transport.');
  errors.push(...validateSmithingWorks267(world,version),...validateProstheticWorks273(world,version));
  if(!validFermentationWorld265(world,version))errors.push('Invalid or future fermentation, content or owner.');
  errors.push(...validateShipReactorThreats275(world,version));
  if(!validShipReactorWorld275(world,version))errors.push('Invalid or future ship reactor, startup or owner.');
  if(!validGeothermalWorld264(world,version))errors.push('Invalid or future geothermal building, phase or owner.');
  if(!validDeepDrillingTransport(world,version)||!validDeepResearchTransport(world,version))errors.push('Invalid deep resources, work or research.');
  if(!errors.length)errors.push(...validateCaveHiveOwners256(world,version));
  if(!errors.length&&!validLocalRoadPropsState256(world,version))errors.push('Invalid or future road edifice.');
  if(!errors.length&&!validSandbagsState(world,version))errors.push('Invalid sandbags state.');
  if(!errors.length&&!validTelevisionState(world,version))errors.push('Invalid television state.');
  if(!errors.length&&(!validBedrollState256(world,version)||!validAncientMonumentState256(world,version)))errors.push('Invalid or future bedroll.');
  if(!errors.length&&!validHospitalBedState(world,version))errors.push('Invalid hospital bed state.');
  if(!errors.length&&!validPackagedSurvivalState(world,version))errors.push('Invalid packaged survival state.');
  errors.push(...validateUnfinished(world,version),...validateGunWorks(world,version),...validateFlakWorks(world,version),...validateComponentWorks(world,version),...validateArtWorks(world,version),...validateArtObjects(world,version));
  errors.push(...validateTrade(world,version),...validateVisitors(world,version,ids));
  if(version>=63)errors.push(...validateApparel(world));
  if(version>=52)errors.push(...validateEquipment(world));
  if(version>=53)errors.push(...validateDrafting(world));
  if(!errors.length)errors.push(...validateForcedConsumption(world));
  if(version>=59)errors.push(...validateMelee(world));
  if(version>=61)errors.push(...validateTactics(world));
  if(version>=58)errors.push(...validateAffiliations(world));
  errors.push(...validateFurniture(world,version,ids));
  if(!errors.length)errors.push(...validatePodRescues(world,version,ids,createPodDepartureValidator(projection=>validateSchema(projection,version,false))));
  if(!errors.length)errors.push(...validateFires(world,version,ids),...validateThingDamage(world,version));
  if(!errors.length)errors.push(...registerGroupThingIds(commercialWorld,ids));
  if(!errors.length)errors.push(...registerStartingArrivalThingIds(commercialWorld,ids));
  if(!errors.length&&isSchema256Or257(version))errors.push(...validateActualStartingPetLinks256(commercialWorld));
  if(!errors.length)errors.push(...registerAncientCasketThingIds256(world,ids),...validateAncientOpeningOwners256(world),...registerCryptosleepThingIds271(world,ids),...validateCryptosleepTasks271(world),...registerShipCasketThingIds277(world,ids),...validateShipCasketTasks277(world));
  if(!errors.length&&version>=56)errors.push(...validateShooting(world,version,ids));
  if(!errors.length&&(world.raids?.mechActive||world.raids?.extraMechActive261?.length))errors.push(...validateMechanoidRaids(world,version,ids));
  if(!errors.length)for(const mech of world.mechanoids??[])errors.push(...validateMechanoidRanged(world,mech,version,ids));
  if(!errors.length&&relationshipContext)errors.push(...validateRelationshipWorld(commercialWorld,version));
  if(!errors.length)errors.push(...validateProjectiles(world,version,ids));
  if(!errors.length){validateBombWaves(world,errors,ids);validateMiniTurrets(world,errors);validateBombRefuges(world,errors,ids);}
  if(!errors.length)errors.push(...validateFirefoamLocal290(world,ids));
  if(!errors.length)errors.push(...validateWeather(world,version),...validateWind(world,version),...validateHeaters(world,version));
  if(!errors.length)errors.push(...registerOrbitalThingIds(commercialWorld,ids));
  if(!errors.length&&!validateTreeTransport(world,version))errors.push('Invalid tree transfer, claim or custody.');
  if(!errors.length)errors.push(...registerTreeThingIds(world,ids));
  if(!errors.length)errors.push(...registerWallDoorPlanIds296(world,ids));
  if(!errors.length)errors.push(...validatePower(world,version),...validatePowerFlicks(world,version),...(!validVentTransport(world,version)?['Invalid or future vent state or owner.']:[]),...validateCoolers(world,version));
  if(errors.length)return errors;
  errors.push(...validateDeconstruction(world,version));
  if(version>=6)errors.push(...validateTravel(world, version < 14));
  const cellKey = (item: { x: number; z: number }): number => item.z * world.width + item.x;
  const pawnById = new Map(world.pawns.map(item => [item.id, item])); const jobById = new Map(world.jobs.map(item => [item.id, item]));
  const pileById = new Map(world.piles.map(item => [item.id, item]));
  const resourceCells = new Map(world.resources.map(item => [cellKey(item), item]));
  const structureCells = new Map<number, World['structures'][number]>(); const jobCells = new Map<number, World['jobs'][number]>();
  if (resourceCells.size !== world.resources.length || new Set(world.stockpiles.map(cellKey)).size !== world.stockpiles.length) errors.push('Duplicate cell occupancy.');
  for (const [items, map] of [[world.structures, structureCells], [world.jobs, jobCells]] as const) {
    const occupants=new Map<number,typeof items[number][]>();
    for (const item of items) if(!isRoofJob(item)&&!(version>=235&&isPlantDesignationJob(item))) for (const cell of footprintCells(item)) {
      if (cell.x < 0 || cell.z < 0 || cell.x >= world.width || cell.z >= world.height) { errors.push('Footprint outside map.'); continue; }
      const key=cellKey(cell),others=occupants.get(key)??[];
      const kind=(s:typeof item)=>'deconstruction' in s&&s.deconstruction?s.deconstruction.kind:'furniture' in s&&s.furniture?s.furniture.kind:'flick' in s&&s.flick?s.flick.kind:s.kind;
      if(others.some(other=>sharesConstructionLayer(kind(other),kind(item))))errors.push('Overlapping footprints.');
      others.push(item);occupants.set(key,others);
      // The primary surface remains the building, regardless of insertion order.
      if(!map.has(key)||kind(item)!=='power-conduit')(map as Map<number,typeof item>).set(key,item);
    }
  }
  const isImpassable = (cell: { x: number; z: number }): boolean => ['water', 'rock'].includes(world.tiles[cellKey(cell)]!.terrain);
  const spatialPawns=world.pawns.filter(pawn=>pawn.id!==offMapScout?.id&&!(version>=89&&pawn.state==='dead'&&(pawn.body?.pileId!==undefined||pawn.body?.lostAt!==undefined))),spatialPawnSet=new Set(spatialPawns);
  for (const item of [...world.resources, ...spatialPawns, ...world.stockpiles]) if (isImpassable(item)) errors.push('Entity placed on impassable terrain.');
  for (const [key,item] of [...structureCells, ...jobCells]) if (item.kind!=='mine'&&['water', 'rock'].includes(world.tiles[key]!.terrain)) errors.push('Footprint on impassable terrain.');
  for (const resource of world.resources) if (structureCells.has(cellKey(resource))&&!(version>=235&&isConstructionLightPlant(resource)&&!constructionFinalWipesPlants(structureCells.get(cellKey(resource))!.kind))&&!conduitKeepsPlant(structureCells.get(cellKey(resource))!.kind,resource.kind)&&!(version>=221&&structureCells.get(cellKey(resource))!.kind==='animal-sleeping-spot'&&resource.kind!=='rock')&&!(version>=232&&structureCells.get(cellKey(resource))!.kind==='sleeping-spot'&&!['rock','tree'].includes(resource.kind))&&!(version>=203&&structureCells.get(cellKey(resource))!.kind==='hydroponics-basin'&&hydroponicPlantAllowed(world,structureCells.get(cellKey(resource))!.id,resource))) errors.push('Resource overlaps a structure.');
  for (const zone of world.stockpiles) if ((version>=219?resourceCells.get(cellKey(zone))?.kind==='rock':resourceCells.has(cellKey(zone))) || (version<21?structureCells.has(cellKey(zone))||jobCells.has(cellKey(zone)) : occupancyOf(structureCells.get(cellKey(zone))?.kind??'cut')?.zones===false || jobCells.has(cellKey(zone))&&!['deconstruct','uninstall'].includes(jobCells.get(cellKey(zone))!.kind)&&(version>=219?occupancyOf(jobCells.get(cellKey(zone))!.furniture?.kind??jobCells.get(cellKey(zone))!.kind)?.zones===false:occupancyOf(jobCells.get(cellKey(zone))!.furniture?.kind??jobCells.get(cellKey(zone))!.kind)?.zones!==true))) errors.push('Storage overlaps fixed content.');
  if(version>=21)for(const zone of world.growingZones)if(zone.cells.some(c=>occupancyOf(structureCells.get(c)?.kind??'cut')?.zones===false&&!(version>=203&&structureCells.get(c)?.kind==='hydroponics-basin'&&zone.basinId===structureCells.get(c)!.id)||occupancyOf(jobCells.get(c)?.furniture?.kind??jobCells.get(c)?.kind??'cut')?.zones===false))errors.push('Growing zone overlaps incompatible construction.');
  errors.push(...validateAncientCasketPhysical256(world),...validateMarshTransport(world,version,[]),...validateBridgeTransport(world,version,[]));
  const pawnCells = new Set<number>();
  const bedOwners = new Set<number>();
  const sleepingBeds = new Set<number>();
  const diningCells = new Set<number>();
  const serviceCells = new Set<number>();
  for (const pawn of world.pawns) {
    const key = cellKey(pawn);
    const spatial=spatialPawnSet.has(pawn);
    if(version>=22&&pawn.transitExit&&!pawn.motion)errors.push('Furniture exit lacks a physical edge.');
    if(version>=14) {
      const service=serviceCell(pawn,world);
      if(service) {const target=cellKey(service);if(serviceCells.has(target))errors.push('Conflicting service reservation.');serviceCells.add(target);}
    }
    if (spatial) {if (version < 14 && pawnCells.has(key)) errors.push('Pawns overlap.'); pawnCells.add(key);}
    if (spatial&&((version<22?['wall', 'table']:['wall']).includes(structureCells.get(key)?.kind ?? '') || version<16&&['wall', 'table'].includes(jobCells.get(key)?.kind ?? ''))) errors.push('Pawn occupies a wall target.');
    if (Number((version===285||version===286||version===287||version===288||version===289||(version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))))))&&!!pawn.coupleTask285)+Number((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&!!pawn.firefoamTask290)+Number(version>=265&&!!pawn.brewing)+Number(version>=256&&!!pawn.openCasket)+Number(version>=221&&!!pawn.animalRescue) + Number(version>=216&&!!pawn.orbitalTrade) + Number(version>=215&&!!pawn.deepWork) + Number(version>=214&&!!pawn.animalFeed) + Number(version>=179&&!!pawn.surgery) + Number(version>=106&&!!pawn.animalHandling) + Number(version>=106&&!!pawn.animalCare) + Number(version>=86&&!!pawn.ward) + Number(version>=52&&!!pawn.equipmentTask) + Number(version>=48&&!!pawn.feed) + Number(version>=47&&!!pawn.tend) + Number(version>=46&&!!pawn.rescue) + Number(version>=10&&!!pawn.cooking) + Number(pawn.jobId !== null) + Number(pawn.haul !== null) + Number(!legacyV2 && pawn.need !== null) > 1) errors.push('Pawn has two simultaneous tasks.');
    if (pawn.jobId !== null) {
      const job = jobById.get(pawn.jobId);
      if (!job || job.reservedBy !== pawn.id || job.status !== 'active') errors.push('Pawn/job reservation mismatch.');
      if (job && pawn.priorities[workType(job)] === 0 && !(version>=17&&pawn.orders.active===job.id)) errors.push('Pawn assigned to disabled work.');
    }
    const owned = world.piles.filter(pile => pile.owner.type === 'pawn' && pile.owner.pawnId === pawn.id);
    const readingCarry=(version===295||(version===296||isCorePhysicalSchema297(version)))&&pawn.recreation?.task?.activity==='read'&&owned.length===1&&owned[0]!.id===pawn.recreation.task.bookId&&owned[0]!.kind==='book'&&owned[0]!.item==='novel'&&owned[0]!.quantity===1&&validNovelPile295(owned[0],version);
    if (owned.length > 1 || (owned.length === 1 && !readingCarry && !(version>=214&&pawn.animalFeed&&pawn.animalFeed.phase!=='pickup') && !(version>=210&&pawn.surgery?.implant&&pawn.surgery.phase==='approach'&&Array.isArray(pawn.surgery.ingredients)&&pawn.surgery.ingredients.some(i=>i?.stage==='held')) && !(version>=179&&pawn.surgery?.medicine&&pawn.surgery.phase==='approach') && !(version>=106&&pawn.animalHandling&&pawn.animalHandling.phase!=='pickup') && !(version>=106&&pawn.animalCare?.medicine&&pawn.animalCare.phase!=='pickup') && !(version>=89&&pawn.burial&&pawn.burial.phase!=='pickup') && !(version>=86&&pawn.ward?.kind==='food'&&pawn.ward.phase==='deliver') && !(version>=51&&pawn.tend?.medicine&&pawn.tend.phase!=='pickup') && !(version>=48&&pawn.feed&&pawn.feed.phase!=='pickup') && !(version>=44&&pawn.interruptedCargo) && !(version >= 10 && pawn.cooking) &&!(version>=235&&world.jobs.some(j=>j.id===pawn.jobId&&j.tree?.kind==='replant'&&j.tree.phase!=='pickup'))&& pawn.haul?.phase !== 'deliver' && (legacyV2 || pawn.need?.kind !== 'eat' || pawn.need.phase === 'pickup'))) errors.push('Carried ownership mismatch.');
    if ((version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))&&pawn.firefoamTask290 || version>=265&&pawn.brewing || version>=215&&pawn.deepWork || version>=179&&pawn.surgery || version>=86&&pawn.ward || version>=73&&pawn.research || pawn.jobId !== null || pawn.haul !== null || version>=52&&pawn.equipmentTask || version>=48&&pawn.feed || version>=47&&pawn.tend || version>=46&&pawn.rescue || version >= 10 && pawn.cooking) { if (!['moving', 'working'].includes(pawn.state)) errors.push('Assigned pawn has incompatible state.'); }
    else if (!(version===301&&pawn.frameToil301?.kind==='retired')&&!(isSchema300OrLater(Number(version))&&pawn.idleWander300?.kind==='move')&&!(isSchema298OrLater(version)&&pawn.factionComms298)&&!(isSchema277OrLater(version)&&pawn.shipCasketTask277)&&!(isSchema271OrLater(version)&&pawn.cryptosleepTask)&&!(version>=256&&pawn.openCasket)&&!(version>=223&&pawn.allowedAreaReturn)&&!(version>=221&&pawn.animalRescue)&&!(version>=216&&pawn.orbitalTrade)&&!(version>=265&&pawn.brewing)&&!(version>=215&&pawn.deepWork)&&!(version>=214&&pawn.animalFeed)&&!(version>=196&&groupOnMapMember(world,pawn.id))&&!(version>=193&&pawn.bombRefuge)&&!(version>=171&&scoutOnMapId(world)===pawn.id||version>=180&&commercialOnMapId(world)===pawn.id)&&!(version>=106&&(pawn.animalHandling||pawn.animalCare))&&!(version>=89&&(pawn.burial||pawn.cleaning))&&!(version>=88&&(pawn.visitor||pawn.trade))&&!(version>=87&&(pawn.burning||pawn.firefighting))&&!(version>=86&&pawn.prisoner)&&!(version>=79&&pawn.hunting)&&!(version>=74&&pawn.heatRefuge)&&!(version>=68&&pawn.raid)&&!(version>=65&&pawn.mental?.crisis)&&!(version>=61&&pawn.tactics)&&!(version>=59&&pawn.melee)&&!(version>=58&&pawn.flee) && !(version>=53&&pawn.draft) && !(version>=15&&pawn.recreation.task) && (legacyV2 || pawn.need === null) && (pawn.path.length || ['moving', 'working'].includes(pawn.state)) && !(version>=22&&pawn.transitExit&&pawn.state!=='working')) errors.push('Unassigned pawn has path or work state.');
    if (!legacyV2) {
      if (pawn.bedId !== null) {
        const ownedBed=[...world.structures,...(world.packed??[]).map(p=>p.building)].find(bed => isBedKind(bed.kind) && !bed.medical && bed.id === pawn.bedId);
        if (!ownedBed || ownedBed.kind!=='double-bed'&&bedOwners.has(pawn.bedId)) errors.push('Invalid or duplicate bed ownership.');
        if(ownedBed?.kind!=='double-bed')bedOwners.add(pawn.bedId);
      }
      const need = pawn.need;
      if (need?.kind === 'eat') {
        if (need.sourcePileId!==null&&need.sourcePileId >= world.nextId) errors.push('Invalid food source identity.');
        const pile = pileById.get((need.phase === 'pickup' ? need.sourcePileId : need.carryPileId)??-1);
        if (need.phase === 'pickup'&&need.paste) { /* Shared guard checks the six real reserved ingredients. */
        } else if (need.phase === 'pickup') {
          if (pawn.state !== 'moving' || need.progress !== 0 || need.carryPileId !== null || !pile || !(pile.kind==='food'||version>=265&&need.alcoholReason&&pile.kind==='beer'&&pile.item==='beer') || !(pile.owner.type==='ground'||version>=265&&need.alcoholReason&&pile.owner.type==='inventory'&&pile.owner.pawnId===pawn.id) || reservedSource(world, pile.id) > pile.quantity) errors.push('Invalid meal reservation.');
        } else {
          if (owned[0]?.id !== need.carryPileId || !pile || !(pile.kind==='food'||version>=265&&need.alcoholReason&&pile.kind==='beer'&&pile.item==='beer') || pile.quantity !== (need.quantity ?? 1) || pile.owner.type !== 'pawn' || pile.owner.pawnId !== pawn.id) errors.push('Invalid ingestion ownership or state.');
          if (need.phase === 'ingest' ? pawn.state !== 'eating' || pawn.path.length > 0 : pawn.state !== 'moving' || need.progress !== 0) errors.push('Invalid meal phase or state.');
        }
        if (version >= 5 && pile && need.quantity > (version>=265&&need.alcoholReason==='inventory'?3:ITEM_DEFINITIONS[pile.item].maxIngest)) errors.push('Meal exceeds item ingestion limit.');
        if (version >= 4) {
          if (need.phase === 'pickup' || need.phase==='collect' || need.phase === 'choose-spot') {
            if (need.dining !== null || (need.phase === 'choose-spot' && pawn.path.length && !(version>=22&&pawn.transitExit))) errors.push('Meal search has a premature dining reservation.');
          } else {
            const place = need.dining;
            if (!place || !validDiningPlace(world, place)) errors.push('Invalid dining furniture reference.');
            else {
              const target = cellKey(place.target);
              if (diningCells.has(target) || isImpassable(place.target) || ['wall', 'table'].includes(structureCells.get(target)?.kind ?? '') || (version<16||jobCells.get(target)?.construction==='frame')&&['wall', 'table'].includes(jobCells.get(target)?.kind ?? '')) errors.push('Invalid or duplicate dining destination.');
              diningCells.add(target);
              if (need.phase === 'ingest' && key !== target) errors.push('Eating away from reserved place.');
              if (place.seatId !== null && place.tableId === null && !(version>=265&&need.alcoholReason)) errors.push('Dining seat has no eating surface.');
            }
          }
        }
      } else if (need?.kind === 'sleep') {
        if (need.bedId !== null) {
          const bed = world.structures.find(item => item.id === need.bedId && isBedKind(item.kind));
          const target=bed?.kind==='double-bed'&&version>=224&&pawn.bedSlot!==undefined?bedSlotCell(bed,pawn.bedSlot):bed;
          if (!bed || (pawn.bedId !== bed.id && !(version>=46&&bed.medical&&(pawn.state==='downed'||version>=47&&!!need.medical))) || !target || cellKey(target) !== cellKey(need.target) || bed.kind!=='double-bed'&&sleepingBeds.has(need.bedId)) errors.push('Invalid sleep reservation.');
          if(bed?.kind!=='double-bed')sleepingBeds.add(need.bedId);
        }
        if(version>=22&&need.bedId===null&&!canStandAt(world,need.target)) errors.push('Ground sleep requires a standable cell.');
        if (need.phase === 'sleep' ? (pawn.state !== 'sleeping' && !(version>=47&&pawn.state==='resting'&&need.medical) && !(version>=45&&pawn.state==='downed')) || pawn.path.length > 0 || cellKey(pawn) !== cellKey(need.target) : pawn.state !== 'moving') errors.push('Invalid sleep position or phase.');
      } else if (['eating', 'sleeping',...(version>=47?['resting']:[])].includes(pawn.state)) errors.push('Need action without a task.');
    }
    if(pawn.haul?.whole)errors.push(...validateFurnitureHaul(world,pawn));
    if (pawn.haul && !pawn.haul.whole) {
      const haul = pawn.haul;
      if (pawn.priorities[haulingWork(haul.destination)] === 0 && !(version>=18&&pawn.orders.active==='haul')) errors.push('Pawn hauling with disabled work.');
      if (haul.sourcePileId >= world.nextId) errors.push('Invalid source identity.');
      const pile = pileById.get(haul.phase === 'pickup' ? haul.sourcePileId : haul.carryPileId!);
      if(haul.destination.type==='stockpile'&&haul.destination.forHunting&&(pile?.kind!=='corpse'||haul.quantity!==1||haul.whole))errors.push('Hunting can only haul one corpse.');
      if (haul.phase === 'pickup') {
        if (haul.carryPileId !== null || !pile || pile.owner.type !== 'ground' || reservedSource(world, pile.id) > pile.quantity) errors.push('Invalid source quantity reservation.');
      } else if (!pile || pile.owner.type !== 'pawn' || pile.owner.pawnId !== pawn.id || pile.quantity !== haul.quantity || owned[0]?.id !== haul.carryPileId) errors.push('Invalid carried quantity.');
      if(haul.destination.type==='turret'){
        if(version<193||pile?.item!=='steel'||turretReloadPawnReason(pawn)||turretReloadCapacity(world,haul.destination.structureId,pawn.id,haul.destination.forced)<haul.quantity)errors.push('Invalid turret service reservation.');
      } else if (haul.destination.type === 'hopper') {
        if(version<217||!pile||hopperCapacity(world,haul.destination.structureId,pile.item,pawn.id)<haul.quantity)errors.push('Invalid hopper delivery reservation.');
      } else if (haul.destination.type === 'fuel') {
        const fuelTargetId=haul.destination.structureId;
        if(haul.destination.forCrafting&&(!isSchema269OrLater(version)||structureById(world,fuelTargetId)?.kind!=='fueled-smithy'))errors.push('Crafting refuel targets a non-smithy or historical schema.');
        if(haul.destination.forCooking&&!['campfire',...(version>=267?['fueled-smithy']:[]),...(version>=84?['fueled-stove']:[])].includes(structureById(world,fuelTargetId)?.kind??''))errors.push('Cooking refuel targets a non-cooking building.');
        if(pile?.item!==fuelItem(structureById(world,fuelTargetId)?.kind)||fuelCapacity(world,haul.destination.structureId,pawn.id,haul.destination.forced)<haul.quantity)errors.push('Invalid fuel delivery reservation.');
      } else if (haul.destination.type === 'job') {
        const job = jobById.get(haul.destination.jobId);
        const capacity = job && pile ? version < 5
          ? JOB_WOOD_COST[job.kind] - deliveredStock(world,job.id).wood - reservedDestination(world,haul.destination,pawn.id)
          : constructionCapacity(world,job,pile.item,pawn.id) : 0;
        if (!job || !pile || version < 5 && pile.kind !== 'wood' || capacity < haul.quantity) errors.push('Invalid construction delivery reservation.');
      } else if (haul.destination.type === 'aside') {
        if (!validSowingClearance(world,haul.destination)||!pile || asideCapacity(world, haul.destination, pile.item, pawn.id) < haul.quantity
          || (pile.owner.type === 'ground' && cellKey(pile.owner) === cellKey(haul.destination))) errors.push('Invalid clearing destination reservation.');
      } else {
        const zone = haul.destination.type==='stockpile'?storageCellById(world,haul.destination.stockpileId):undefined;
        if (!zone || !pile || !storageCellAccepts(world,zone,pile) || (version>=6 ? storageCapacity(world,zone,pile,pawn.id)<haul.quantity : groundQuantity(world, zone) + reservedDestination(world, haul.destination) > zone.capacity)) errors.push('Invalid storage capacity reservation.');
        if (zone && pile?.owner.type === 'ground' && cellKey(zone) === cellKey(pile.owner)) errors.push('Haul source is its own destination.');
      }
    }
  }
  for (const job of world.jobs) {
    if (workProgress(job) >= jobDuration(world, job)) errors.push('Completed job left in queue.');
    if ((job.status === 'active') !== (job.reservedBy !== null)) errors.push('Job reservation/status mismatch.');
    if (job.reservedBy !== null && pawnById.get(job.reservedBy)?.jobId !== job.id && !(version>=17&&pawnById.get(job.reservedBy)?.orders.queue.includes(job.id))) errors.push('Job references missing or mismatched pawn.');
    const delivered = deliveredStock(world, job.id);
    if (job.escrow.wood !== delivered.wood || job.escrow.food !== delivered.food || delivered.food !== 0 || delivered.wood > requiredMaterial(job,'wood')) errors.push('Invalid delivered material view.');
    // Version 1 could refund escrow on interruption while retaining progress. Such plans
    // keep that progress, but may only acquire a builder after physical delivery again.
    if (job.reservedBy !== null && !job.clearance && (version<5 ? delivered.wood<JOB_WOOD_COST[job.kind] : !constructionSupplied(world,job))) errors.push('Construction work started before delivery.');
    const resource = resourceCells.get(cellKey(job));
    if (job.kind === 'chop' || job.kind === 'harvest' || job.kind === 'cut') { if (!(version>=90&&(job as typeof job&{flowerPotId?:number}).flowerPotId)&&(!resource || !(job.kind === 'chop' ? resource.kind === 'tree' : isPlant(resource)||version>=235&&job.kind==='cut'&&resource.kind==='tree'))) errors.push('Gather job has no matching resource.'); else if (version >= 7 && job.kind === 'harvest' && resource && !(version === 7 ? legacyPlantGrowth(world,resource) > .65 : harvestable(world,resource))) errors.push('Harvest job targets an immature plant.'); }
    else if(!(version>=90&&(job as typeof job&{flowerPotId?:number}).flowerPotId)&&!isRoofJob(job)&&job.kind!=='repair'&&job.kind!=='fix-breakdown'&&job.kind!=='flick'&&job.kind!=='mine'&&!(version>=235&&isPlantDesignationJob(job))&&job.kind!=='replant-tree'&&job.kind!=='deconstruct'&&job.kind!=='uninstall'&&job.kind!=='install')for (const cell of footprintCells(job)) {
      const obstacle=resourceCells.get(cellKey(cell));
      if (obstacle&&!conduitKeepsPlant(job.kind,obstacle.kind)&&(version<16||!isConstruction(job)||obstacle.kind==='rock') || world.structures.some(s=>sharesConstructionLayer(job.kind,s.kind)&&footprintCells(s).some(c=>cellKey(c)===cellKey(cell))&&!(version>=203&&job.kind==='sow'&&s.kind==='hydroponics-basin'&&world.growingZones.some(z=>z.id===job.growingZoneId&&z.basinId===s.id&&z.cells.includes(cellKey(cell)))))) errors.push('Construction overlaps existing content.');
    }
  }
  const available = { wood: 0, food: 0 };
  const groundCounts=new Map<number,number>();
  if(!validShelfGround(world))errors.push('Invalid physical shelf content or stack count.');
  for (const pile of world.piles) {
    const owner = pile.owner;
    if (owner.type === 'ground') {
      if (version>=6 && ((groundCounts.set(cellKey(owner),(groundCounts.get(cellKey(owner))??0)+1)),groundCounts.get(cellKey(owner))!>(version>=229?groundMaxStacks(world,owner):1))) errors.push('Several item stacks occupy one floor cell.');
      if (version>=21&&!groundOccupancyAllows(world,owner) || isImpassable(owner) || structureCells.get(cellKey(owner))?.kind === 'wall' || version<16&&jobCells.get(cellKey(owner))?.kind === 'wall') errors.push('Pile on impassable cell.');
      if(pile.kind==='wood'||pile.kind==='food')available[pile.kind] += pile.quantity;
    } else if (owner.type === 'pawn') { if (!pawnById.has(owner.pawnId)) errors.push('Pile references missing carrier.'); if((pile.kind==='wood'||pile.kind==='food')&&(version<88||(pawnById.get(owner.pawnId)?.faction??'colony')==='colony'))available[pile.kind] += pile.quantity; }
    else if(owner.type==='equipment'||owner.type==='apparel'||owner.type==='inventory'){
      if(!pawnById.has(owner.pawnId)&&!(owner.type==='inventory'&&version>=256&&animalContentsOwner256(world,owner.pawnId)!==undefined))errors.push('Missing equipment owner.');
      if((pile.kind==='wood'||pile.kind==='food')&&animalHaulContents282(world,pile))available[pile.kind]+=pile.quantity;
    }
    else if(owner.type==='grave'){if(!world.structures.some(s=>(s.kind==='grave'||version>=256&&s.kind==='sarcophagus')&&s.id===owner.graveId))errors.push('Missing grave owner.');}
    else if(owner.type==='starting-pod')errors.push('Contained starting material occurs in map piles.');
    else if(owner.type==='world-site263'||owner.type==='trade-request284')errors.push('Contained world reward material occurs in map piles.');
    else if(owner.type==='orbital-ship'||owner.type==='orbital-cargo'){/* Checked by the shared real-owner contract. */}
    else if (!jobById.has(owner.jobId)) errors.push('Pile references missing construction.');
  }
  if (world.stock.wood !== available.wood || world.stock.food !== available.food) errors.push('Derived stock differs from physical piles.');
  if(!errors.length&&registeredIds)for(const id of ids)registeredIds.add(id);
  return errors;
}

function validateV90Persistence(world:World,version:number):string[] {
  const errors:string[]=[],future=[world.apparelWear,world.apparelPolicies,world.nextApparelPolicyId];
  if(version<90){
    if(future.some(value=>value!==undefined))errors.push('Legacy save contains V90 apparel persistence.');
  }else{
    const wear=world.apparelWear;
    // Focused subsystem tests and tools can advance the global tick without
    // running the engine scheduler. The overdue pulse is replayed on the next
    // engine step; only a pulse more than one interval ahead is impossible.
    if(!record(wear)||Object.keys(wear).some(key=>!['nextWearAt','rng'].includes(key))||!integer(wear.nextWearAt,0,world.tick+APPAREL_WEAR_INTERVAL)||!integer(wear.rng,0,0xffffffff))errors.push('Invalid apparel wear calendar.');
    const policies=world.apparelPolicies;
    if(!Array.isArray(policies)||policies.length<1||policies.length>32||!integer(world.nextApparelPolicyId??0,1))errors.push('Invalid apparel policy registry.');
    else {
      const ids=new Set<number>(),allowed=['id','label','allowedItems','allowedMaterials','minQuality','maxQuality','minHitPointsPercent','maxHitPointsPercent'];
      for(const policy of policies){
        if(!record(policy)||version<256&&Array.isArray(policy.allowedItems)&&policy.allowedItems.some(isCoreStartingApparel256)||Object.keys(policy).length!==allowed.length||Object.keys(policy).some(key=>!allowed.includes(key))||!validApparelPolicy(policy as never,version)||version<120&&(Array.isArray(policy.allowedItems)&&policy.allowedItems.some(i=>V120_ANIMAL_PRODUCT_ITEMS.includes(String(i)))||Array.isArray(policy.allowedMaterials)&&policy.allowedMaterials.includes('muffalo-wool'))||version<141&&Array.isArray(policy.allowedItems)&&policy.allowedItems.includes('flak-helmet')||version<148&&Array.isArray(policy.allowedItems)&&policy.allowedItems.includes('recon-helmet')||version<178&&(Array.isArray(policy.allowedItems)&&policy.allowedItems.some(i=>V190_ITEM_IDS.includes(String(i)))||Array.isArray(policy.allowedMaterials)&&policy.allowedMaterials.includes('foxfur'))||String(policy.label).length>60||ids.has(Number(policy.id)))errors.push('Invalid apparel policy.');
        else ids.add(Number(policy.id));
      }
      if(ids.size&&Number(world.nextApparelPolicyId)<=Math.max(...ids))errors.push('Apparel policy identity was reused.');
      for(const pawn of world.pawns){
        const ordinary=(pawn.faction??'colony')==='colony'&&!pawn.visitor&&!pawn.prisoner&&pawn.state!=='dead';
        const hasPolicy=pawn.apparelPolicyId!==undefined||pawn.apparelAutomation!==undefined||pawn.nextApparelCheckAt!==undefined;
        if(ordinary&&!hasPolicy)errors.push('Player pawn lacks an apparel policy.');
        // A check may remain due while urgent work, incapacity or a player order
        // owns the pawn. Only the next future interval has an upper bound.
        if(hasPolicy&&(!integer(pawn.apparelPolicyId,1)||!ids.has(pawn.apparelPolicyId!)||typeof pawn.apparelAutomation!=='boolean'||!integer(pawn.nextApparelCheckAt,0,world.tick+APPAREL_POLICY_INTERVAL.max)))errors.push('Invalid pawn apparel policy assignment.');
      }
    }
  }
  const qualityKinds=new Set(['bed',...(version>=187?['hospital-bed']:[]),...(version>=224?['double-bed']:[]),...(version>=256?['bedroll','sarcophagus']:[]),'table','stool','dining-chair','armchair','end-table','dresser','table-square','table-long','flower-pot',...(version>=122?['chess-table']:[])]);
  for(const pack of world.packed??[]){
    const building=pack.building;
    if(version<90?building.quality!==undefined:(qualityKinds.has(building.kind)||version>=104&&['small-sculpture','large-sculpture'].includes(building.kind))?!isFurnitureQuality(building.quality):building.quality!==undefined)errors.push('Invalid packed furniture quality for schema.');
    if(building.flower!==undefined&&(version<90||building.kind!=='flower-pot'||validateFlowerPotState(building.flower,world.tick).length>0))errors.push('Invalid packed flower pot state for schema.');
    if(version>=90&&building.kind==='flower-pot'&&building.flower===undefined)errors.push('Packed flower pot lacks its physical plant state.');
  }
  return errors;
}

export function serializeWorld(world: World): string {return serializeCampaign(world);}
export function serializeCampaign(world:CampaignState):string {
  const errors = validateWorld(world); if (errors.length) throw new Error(`Cannot save invalid world: ${errors.join(' ')}${errors.includes('Missing travel segment for movement delay.')?' Travel diagnostic: '+JSON.stringify((world as World).pawns.map(p=>({id:p.id,cooldown:p.moveCooldown,motion:p.motion}))):''}`);
  const serialized = JSON.stringify(world); if (!withinSaveTextLimit(serialized)) throw new Error('Save exceeds supported size.'); return serialized;
}
export function deserializeCampaign(serialized: string): CampaignState {
  if (typeof serialized !== 'string' || !withinSaveTextLimit(serialized)) throw new Error('Invalid or oversized save.');
  let input: unknown = JSON.parse(serialized);
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validShipEscapeHistorical298(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future escaped-ship data.');
  if(record(input)&&!validWallDoorHistoricalTransport296(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid wall-door successor data.');
  if(record(input)&&!validNovelHistoricalTransport295(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid Novel/reading data.');
  if(record(input)&&!validToxicFalloutHistoricalTransport294(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid ToxicFallout data.');
  if(record(input)&&!validPeaceTalksHistorical293(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid PeaceTalks data.');
  if(record(input)&&!validPartyHistoricalTransport292(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid Party data.');
  if(record(input)&&!validForestryHistoricalTransport291(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid forestry data.');
  if(record(input)&&!validFirefoamHistoricalTransport290(input,input.schemaVersion))throw new Error('Invalid historical save: Future or invalid firefoam data.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validBillPauseHistoricalTransport289(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future or invalid bill reserve pause.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validAnimalThermalRefugeHistoricalTransport288(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future animal thermal refuge.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validAnimalAreaHistoricalTransport287(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future animal areas.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validLinkedStorageHistorical286(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future linked storage.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validCoupleHistoricalTransport285(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future couple fields.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&(!validTradeRequestHistorical284(input,Number(input.schemaVersion))||!validApparelProvenanceHistoricalTransport284(input,Number(input.schemaVersion))))throw new Error('Invalid historical save: Future trade requests or apparel provenance.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validBillWorkerHistoricalTransport283(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future bill worker settings.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validAnimalTrainingHistoricalTransport282(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future animal training or hauling.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validSmoothFloorsHistoricalTransport281(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future natural stone smoothing.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validPrisonerSurgeryHistoricalTransport280(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future captive surgery.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validApparelTradeHistoricalTransport279(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future ordinary apparel custody or trade.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validShipCasketHistoricalTransport277(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future spatial casket content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validShipPartHistoricalTransport276(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future ship hull or engine research.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validShipReactorHistoricalTransport275(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future ship reactor content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validProstheticHistoricalTransport273(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future industrial prosthetics.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validSpearHistoricalTransport272(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future spear catalogue.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validCryptosleepHistoricalTransport271(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future player cryptosleep content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validLongswordHistoricalTransport270(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future long-blade catalogue.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validMaceHistoricalTransport269(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future mace catalogue.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validKnifeHistoricalTransport268(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future knife manufacture.');
  if(!input||typeof input!=='object'||!validGeographicRenewalCampaignRaw262(input,Number((input as Record<string,unknown>).schemaVersion)))throw Error('Invalid or future geographic renewal before hydration.');
  if(!input||typeof input!=='object'||!validWorldPawnsEnvelope256(input,Number((input as Record<string,unknown>).schemaVersion),(isCorePhysicalSchema297(Number((input as Record<string,unknown>).schemaVersion))?effectiveCore297(input as unknown as World):Number((input as Record<string,unknown>).tick)*10),Number((input as Record<string,unknown>).nextId)))throw Error('Invalid or future WorldPawns header before geographic hydration.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validPlanetGeographyHistorical256(input,Number(input.schemaVersion)))throw new Error('Invalid historical geographic ownership.');
  if(record(input)&&isSchema256Or257(input.schemaVersion)&&record(input.planet)&&input.planet.revision===3){const staged=preparePlanetHydration256(input.planet,Number(input.schemaVersion));preparePlanetNavigation256(staged.planet);input={...input,planet:staged.planet};}
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validWorldMapHistorical(input,Number(input.schemaVersion)))throw new Error('Invalid historical map registry.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validSmithingHistoricalTransport267(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future smithing content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validBrewingHistoricalTransport265(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future brewing content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validGroupFreightHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future collective freight.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validDeteriorationHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future deterioration state.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validBurnApparelHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future apparel-burning recipe.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validGroupProvisionsHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future mixed group provisions.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validTorchHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future torch lamp content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validPemmicanHistoricalTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future pemmican catalogue content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validTuqueCatalogueTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future tuque catalogue content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!validReconCatalogueTransport(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future recon catalogue content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)<240
    &&(Object.hasOwn(input,'secondarySite')||Object.hasOwn(input,'expeditionSite')))throw new Error('Historical save contains future second-site fields.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!tundraHistoricalFieldsAbsent(input,Number(input.schemaVersion)))throw new Error('Future tundra provenance in historical save.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&!snowHistoricalFieldsAbsent(input,Number(input.schemaVersion)))throw new Error('Future snow content in historical save.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<232
    &&!validHumanSleepingSpotProvenance(input,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future human sleeping spot content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)<231){
    const future=Object.hasOwn(input,'startingArrival')||record(input.scenario)&&input.scenario.revision===10;
    const pending:unknown[]=[input];let futureOwner=false;
    while(pending.length&&!futureOwner){const value=pending.pop();if(!value||typeof value!=='object')continue;
      if(record(value)&&record(value.owner)&&value.owner.type==='starting-pod'){futureOwner=true;break;}
      for(const nested of Object.values(value))pending.push(nested);
    }
    if(future||futureOwner)throw new Error('Invalid historical save: Future starting arrival content.');
  }
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<229&&!validShelfTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future shelf storage state.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<=227
    &&!validAutoSlaughterTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error(`Invalid version ${input.schemaVersion} save: Future auto slaughter policy.`);
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<=226
    &&!validFodderTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future fodder content.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<=225
    &&!validSpikeTrapTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error('Invalid historical save: Future spike trap kind or state.');
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<=224
    &&!validCremationTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error("Invalid historical save: Future cremation content or filter.");
  if(record(input)&&Number.isInteger(input.schemaVersion)&&Number(input.schemaVersion)>=1&&Number(input.schemaVersion)<=223
    &&!validDoubleBedTransport(input as unknown as World,Number(input.schemaVersion)))throw new Error(`Invalid version ${input.schemaVersion} save: Future double bed or bed slot.`);
  if(record(input)&&Number(input.schemaVersion)<=222&&(Object.hasOwn(input,'allowedAreas')
    ||Array.isArray(input.pawns)&&input.pawns.some(p=>record(p)&&(Object.hasOwn(p,'allowedAreaId')||Object.hasOwn(p,'allowedAreaReturn')))))throw new Error(`Invalid version ${input.schemaVersion} save: Future allowed area fields.`);
  if (record(input) && input.schemaVersion === 1) input = migrateLegacy(input);
  if (record(input) && input.schemaVersion === 2) {
    const errors = validateSchema(input, 2);
    if (errors.length) throw new Error(`Invalid version 2 save: ${errors.join(' ')}`);
    input.schemaVersion = 4;
    initializeNeeds(input as unknown as World);
    initializeDining(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 3) {
    const errors = validateSchema(input, 3);
    if (errors.length) throw new Error(`Invalid version 3 save: ${errors.join(' ')}`);
    input.schemaVersion = 4;
    initializeDining(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 4) {
    const errors = validateSchema(input, 4);
    if (errors.length) throw new Error(`Invalid version 4 save: ${errors.join(' ')}`);
    initializeFood(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 5) {
    const errors=validateSchema(input,5);if(errors.length) throw new Error(`Invalid version 5 save: ${errors.join(' ')}`);
    initializeSpatial(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 6) {
    const errors=validateSchema(input,6); if(errors.length) throw new Error(`Invalid version 6 save: ${errors.join(' ')}`);
    initializePlants(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 7) {
    const errors=validateSchema(input,7); if(errors.length) throw new Error(`Invalid version 7 save: ${errors.join(' ')}`);
    initializeFarming(input as unknown as World);
  }
  if (record(input) && input.schemaVersion === 8) {
    const errors = validateSchema(input, 8); if (errors.length) throw new Error(`Invalid version 8 save: ${errors.join(' ')}`);
    // Existing paths, reservations and meals continue; only future decisions change.
    input.schemaVersion = 9;
  }
  if(record(input)&&input.schemaVersion===9) {
    const errors=validateSchema(input,9);if(errors.length)throw new Error(`Invalid version 9 save: ${errors.join(' ')}`);
    for(const pawn of (input as unknown as World).pawns){pawn.cooking=null;pawn.priorities.cook=2;}
    input.schemaVersion=10; // No old campfires: preserve all existing objects and tasks.
  }
  if(record(input)&&input.schemaVersion===10) {
    const errors=validateSchema(input,10);if(errors.length)throw new Error(`Invalid version 10 save: ${errors.join(' ')}`);
    initializePreservation(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===11) {
    const errors=validateSchema(input,11);if(errors.length)throw new Error(`Invalid version 11 save: ${errors.join(' ')}`);
    initializeSchedules(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===12) {
    const errors=validateSchema(input,12);if(errors.length)throw new Error(`Invalid version 12 save: ${errors.join(' ')}`);
    initializeFoodPolicies(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===13) {
    const errors=validateSchema(input,13);if(errors.length)throw new Error(`Invalid version 13 save: ${errors.join(' ')}`);
    input.schemaVersion=14; // Positions, active edges, jobs and reservations are preserved.
  }
  if(record(input)&&input.schemaVersion===14) {
    const errors=validateSchema(input,14);if(errors.length)throw new Error(`Invalid version 14 save: ${errors.join(' ')}`);
    initializeRecreation(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===15) {
    const errors=validateSchema(input,15);if(errors.length)throw new Error(`Invalid version 15 save: ${errors.join(' ')}`);
    initializeConstruction(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===16) {
    const errors=validateSchema(input,16);if(errors.length)throw new Error(`Invalid version 16 save: ${errors.join(' ')}`);
    initializePlayerOrders(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===17) {
    const errors=validateSchema(input,17);if(errors.length)throw new Error(`Invalid version 17 save: ${errors.join(' ')}`);
    input.schemaVersion=18; // Existing numeric work orders and active tasks continue unchanged.
  }
  if(record(input)&&input.schemaVersion===18) {
    const errors=validateSchema(input,18);if(errors.length)throw new Error(`Invalid version 18 save: ${errors.join(' ')}`);
    input.schemaVersion=19; // New contextual providers; preserve existing tasks and quantities.
  }
  if(record(input)&&input.schemaVersion===19) {
    const errors=validateSchema(input,19);if(errors.length)throw new Error(`Invalid version 19 save: ${errors.join(' ')}`);
    input.schemaVersion=20; // Preserve tasks; enable queued recipes and sowing-clearance intents.
  }
  if(record(input)&&input.schemaVersion===20) {
    const errors=validateSchema(input,20);if(errors.length)throw new Error(`Invalid version 20 save: ${errors.join(' ')}`);
    initializeOccupancy(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===21) {
    const errors=validateSchema(input,21);if(errors.length)throw new Error(`Invalid version 21 save: ${errors.join(' ')}`);
    initializeFurnitureTravel(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===22) {
    const errors=validateSchema(input,22);if(errors.length)throw new Error(`Invalid version 22 save: ${errors.join(' ')}`);
    input.schemaVersion=23; // No invented priority for orders accepted by an older version.
  }
  if(record(input)&&input.schemaVersion===23) {
    const errors=validateSchema(input,23);if(errors.length)throw new Error(`Invalid version 23 save: ${errors.join(' ')}`);
    input.schemaVersion=24;input.deconstructed={count:0,lostWood:0,fuelTicks:0};
  }
  if(record(input)&&input.schemaVersion===24){const errors=validateSchema(input,24);if(errors.length)throw new Error(`Invalid version 24 save: ${errors.join(' ')}`);input.schemaVersion=25;input.packed=[];}
  if(record(input)&&input.schemaVersion===25){const errors=validateSchema(input,25);if(errors.length)throw new Error(`Invalid version 25 save: ${errors.join(' ')}`);input.schemaVersion=26;}
  if(record(input)&&input.schemaVersion===26){const errors=validateSchema(input,26);if(errors.length)throw new Error(`Invalid version 26 save: ${errors.join(' ')}`);input.schemaVersion=27;}
  if(record(input)&&input.schemaVersion===27){const errors=validateSchema(input,27);if(errors.length)throw new Error(`Invalid version 27 save: ${errors.join(' ')}`);input.schemaVersion=28;for(const p of (input as unknown as World).pawns)p.priorities.mine=2;}
  if(record(input)&&input.schemaVersion===28){const errors=validateSchema(input,28);if(errors.length)throw new Error(`Invalid version 28 save: ${errors.join(' ')}`);input.schemaVersion=29;}
  if(record(input)&&input.schemaVersion===29){const errors=validateSchema(input,29);if(errors.length)throw new Error(`Invalid version 29 save: ${errors.join(' ')}`);input.schemaVersion=30;}
  if(record(input)&&input.schemaVersion===30){const errors=validateSchema(input,30);if(errors.length)throw new Error(`Invalid version 30 save: ${errors.join(' ')}`);input.schemaVersion=31;}
  if(record(input)&&input.schemaVersion===31){const errors=validateSchema(input,31);if(errors.length)throw new Error(`Invalid version 31 save: ${errors.join(' ')}`);input.schemaVersion=32;const w=input as unknown as World;for(const p of w.pawns)p.priorities.craft=2;for(const s of [...w.structures,...w.packed.map(p=>p.building)])if(s.kind==='stonecutter')s.bills=[];}
  if(record(input)&&input.schemaVersion===32){const errors=validateSchema(input,32);if(errors.length)throw new Error(`Invalid version 32 save: ${errors.join(' ')}`);input.schemaVersion=33;}
  if(record(input)&&input.schemaVersion===33){const errors=validateSchema(input,33);if(errors.length)throw new Error(`Invalid version 33 save: ${errors.join(' ')}`);input.schemaVersion=34;}
  if(record(input)&&input.schemaVersion===34){const errors=validateSchema(input,34);if(errors.length)throw new Error(`Invalid version 34 save: ${errors.join(' ')}`);input.schemaVersion=35;}
  if(record(input)&&input.schemaVersion===35){const errors=validateSchema(input,35);if(errors.length)throw new Error(`Invalid version 35 save: ${errors.join(' ')}`);const w=input as unknown as World;for(const p of w.pawns)if(p.cooking)p.cooking.progress*=productionWorkTotal(taskRecipe(p.cooking))/legacyProductionTicks(taskRecipe(p.cooking));input.schemaVersion=36;}
  if(record(input)&&input.schemaVersion===36){const errors=validateSchema(input,36);if(errors.length)throw new Error(`Invalid version 36 save: ${errors.join(' ')}`);initializeLightWork(input as unknown as World);}
  if(record(input)&&input.schemaVersion===37){const errors=validateSchema(input,37);if(errors.length)throw new Error('Invalid version 37 save: '+errors.join(' '));input.schemaVersion=38;}
  if(record(input)&&input.schemaVersion===38){const errors=validateSchema(input,38);if(errors.length)throw new Error('Invalid version 38 save: '+errors.join(' '));input.schemaVersion=39;}
  if(record(input)&&input.schemaVersion===39){const errors=validateSchema(input,39);if(errors.length)throw new Error('Invalid version 39 save: '+errors.join(' '));input.schemaVersion=40;}
  if(record(input)&&input.schemaVersion===40){const errors=validateSchema(input,40);if(errors.length)throw new Error('Invalid version 40 save: '+errors.join(' '));input.schemaVersion=41;}
  if(record(input)&&input.schemaVersion===41){const errors=validateSchema(input,41);if(errors.length)throw new Error('Invalid version 41 save: '+errors.join(' '));input.schemaVersion=42;}
  if(record(input)&&input.schemaVersion===42){const errors=validateSchema(input,42);if(errors.length)throw new Error('Invalid version 42 save: '+errors.join(' '));const w=input as unknown as World;for(const p of w.pawns){p.skills=initialSkills(8,0);delete (p.skills as Partial<typeof p.skills>).medicine;delete (p.skills as Partial<typeof p.skills>).shooting;delete (p.skills as Partial<typeof p.skills>).melee;delete p.skills.cooking;}input.schemaVersion=43;}
  if(record(input)&&input.schemaVersion===43){const errors=validateSchema(input,43);if(errors.length)throw new Error('Invalid version 43 save: '+errors.join(' '));input.schemaVersion=44;}
  if(record(input)&&input.schemaVersion===44){const errors=validateSchema(input,44);if(errors.length)throw new Error('Invalid version 44 save: '+errors.join(' '));input.schemaVersion=45;}
  if(record(input)&&input.schemaVersion===45){const errors=validateSchema(input,45);if(errors.length)throw new Error('Invalid version 45 save: '+errors.join(' '));for(const p of (input as unknown as World).pawns)p.priorities.doctor=1;input.schemaVersion=46;}
  if(record(input)&&input.schemaVersion===46){const errors=validateSchema(input,46);if(errors.length)throw new Error('Invalid version 46 save: '+errors.join(' '));for(const p of (input as unknown as World).pawns){p.priorities.patient=1;p.priorities.bedrest=3;p.skills.medicine={level:8,xp:0,dailyXp:0,passion:0};}input.schemaVersion=47;}
  if(record(input)&&input.schemaVersion===47){const errors=validateSchema(input,47);if(errors.length)throw new Error('Invalid version 47 save: '+errors.join(' '));input.schemaVersion=48;}
  if(record(input)&&input.schemaVersion===48){const errors=validateSchema(input,48);if(errors.length)throw new Error('Invalid version 48 save: '+errors.join(' '));input.schemaVersion=49;}
  if(record(input)&&input.schemaVersion===49){const errors=validateSchema(input,49);if(errors.length)throw new Error('Invalid version 49 save: '+errors.join(' '));input.schemaVersion=50;}
  if(record(input)&&input.schemaVersion===50){const errors=validateSchema(input,50);if(errors.length)throw new Error('Invalid version 50 save: '+errors.join(' '));input.schemaVersion=51;}
  if(record(input)&&input.schemaVersion===51){const errors=validateSchema(input,51);if(errors.length)throw new Error('Invalid version 51 save: '+errors.join(' '));input.schemaVersion=52;}
  if(record(input)&&input.schemaVersion===52){const errors=validateSchema(input,52);if(errors.length)throw new Error('Invalid version 52 save: '+errors.join(' '));input.schemaVersion=53;}
  if(record(input)&&input.schemaVersion===53){const errors=validateSchema(input,53);if(errors.length)throw new Error('Invalid version 53 save: '+errors.join(' '));input.schemaVersion=54;}
  if(record(input)&&input.schemaVersion===54){const errors=validateSchema(input,54);if(errors.length)throw new Error('Invalid version 54 save: '+errors.join(' '));input.schemaVersion=55;}
  if(record(input)&&input.schemaVersion===55){const errors=validateSchema(input,55);if(errors.length)throw new Error('Invalid version 55 save: '+errors.join(' '));for(const p of (input as unknown as World).pawns)p.skills.shooting={level:8,xp:0,dailyXp:0,passion:0};input.schemaVersion=56;}
  if(record(input)&&input.schemaVersion===56){const errors=validateSchema(input,56);if(errors.length)throw new Error('Invalid version 56 save: '+errors.join(' '));input.schemaVersion=57;}
  if(record(input)&&input.schemaVersion===57){const errors=validateSchema(input,57);if(errors.length)throw new Error('Invalid version 57 save: '+errors.join(' '));input.schemaVersion=58;}
  if(record(input)&&input.schemaVersion===58){const errors=validateSchema(input,58);if(errors.length)throw new Error('Invalid version 58 save: '+errors.join(' '));for(const p of (input as unknown as World).pawns)p.skills.melee={level:8,xp:0,dailyXp:0,passion:0};input.schemaVersion=59;}
  if(record(input)&&input.schemaVersion===59){const errors=validateSchema(input,59);if(errors.length)throw new Error('Invalid version 59 save: '+errors.join(' '));input.schemaVersion=60;}
  if(record(input)&&input.schemaVersion===60){const errors=validateSchema(input,60);if(errors.length)throw new Error('Invalid version 60 save: '+errors.join(' '));input.schemaVersion=61;}
  if(record(input)&&input.schemaVersion===61){const errors=validateSchema(input,61);if(errors.length)throw new Error('Invalid version 61 save: '+errors.join(' '));input.schemaVersion=62;}
  if(record(input)&&input.schemaVersion===62){const errors=validateSchema(input,62);if(errors.length)throw new Error('Invalid version 62 save: '+errors.join(' '));input.schemaVersion=63;}
  if(record(input)&&input.schemaVersion===63){const errors=validateSchema(input,63);if(errors.length)throw new Error('Invalid version 63 save: '+errors.join(' '));input.schemaVersion=64;}
  if(record(input)&&input.schemaVersion===64){const errors=validateSchema(input,64);if(errors.length)throw new Error('Invalid version 64 save: '+errors.join(' '));input.schemaVersion=65;}
  if(record(input)&&input.schemaVersion===65){const errors=validateSchema(input,65);if(errors.length)throw new Error('Invalid version 65 save: '+errors.join(' '));input.schemaVersion=66;}
  if(record(input)&&input.schemaVersion===66){const errors=validateSchema(input,66);if(errors.length)throw new Error('Invalid version 66 save: '+errors.join(' '));input.schemaVersion=67;}
  if(record(input)&&input.schemaVersion===67){const errors=validateSchema(input,67);if(errors.length)throw new Error('Invalid version 67 save: '+errors.join(' '));input.schemaVersion=68;}
  if(record(input)&&input.schemaVersion===68){const errors=validateSchema(input,68);if(errors.length)throw new Error('Invalid version 68 save: '+errors.join(' '));input.schemaVersion=69;}
  if(record(input)&&input.schemaVersion===69){const errors=validateSchema(input,69);if(errors.length)throw new Error('Invalid version 69 save: '+errors.join(' '));input.schemaVersion=70;}
  if(record(input)&&input.schemaVersion===70){const errors=validateSchema(input,70);if(errors.length)throw new Error('Invalid version 70 save: '+errors.join(' '));input.schemaVersion=71;}
  if(record(input)&&input.schemaVersion===71){const errors=validateSchema(input,71);if(errors.length)throw new Error('Invalid version 71 save: '+errors.join(' '));input.schemaVersion=72;}
  if(record(input)&&input.schemaVersion===72){const errors=validateSchema(input,72);if(errors.length)throw new Error('Invalid version 72 save: '+errors.join(' '));input.schemaVersion=73;for(const p of (input as unknown as World).pawns)p.priorities.research=3;}
  if(record(input)&&input.schemaVersion===73){const errors=validateSchema(input,73);if(errors.length)throw new Error('Invalid version 73 save: '+errors.join(' '));input.schemaVersion=74;}
  if(record(input)&&input.schemaVersion===74){const errors=validateSchema(input,74);if(errors.length)throw new Error('Invalid version 74 save: '+errors.join(' '));input.schemaVersion=75;}
  if(record(input)&&input.schemaVersion===75){const errors=validateSchema(input,75);if(errors.length)throw new Error('Invalid version 75 save: '+errors.join(' '));input.schemaVersion=76;}
  if(record(input)&&input.schemaVersion===76){const errors=validateSchema(input,76);if(errors.length)throw new Error('Invalid version 76 save: '+errors.join(' '));input.schemaVersion=77;}
  if(record(input)&&input.schemaVersion===77){const errors=validateSchema(input,77);if(errors.length)throw new Error('Invalid version 77 save: '+errors.join(' '));input.schemaVersion=78;}
  if(record(input)&&input.schemaVersion===78){const errors=validateSchema(input,78);if(errors.length)throw new Error('Invalid version 78 save: '+errors.join(' '));input.schemaVersion=79;for(const p of (input as unknown as World).pawns)p.priorities.hunt=0;}
  if(record(input)&&input.schemaVersion===79){const errors=validateSchema(input,79);if(errors.length)throw new Error('Invalid version 79 save: '+errors.join(' '));input.schemaVersion=80;}
  if(record(input)&&input.schemaVersion===80){const errors=validateSchema(input,80);if(errors.length)throw new Error('Invalid version 80 save: '+errors.join(' '));input.schemaVersion=81;}
  if(record(input)&&input.schemaVersion===81){const errors=validateSchema(input,81);if(errors.length)throw new Error('Invalid version 81 save: '+errors.join(' '));input.schemaVersion=82;}
  if(record(input)&&input.schemaVersion===82){const errors=validateSchema(input,82);if(errors.length)throw new Error('Invalid version 82 save: '+errors.join(' '));input.schemaVersion=83;}
  if(record(input)&&input.schemaVersion===83){const errors=validateSchema(input,83);if(errors.length)throw new Error('Invalid version 83 save: '+errors.join(' '));input.schemaVersion=84;}
  if(record(input)&&input.schemaVersion===84){const errors=validateSchema(input,84);if(errors.length)throw new Error('Invalid version 84 save: '+errors.join(' '));input.schemaVersion=85;for(const p of (input as unknown as World).pawns)p.priorities.basic=3;}
  if(record(input)&&input.schemaVersion===85){const errors=validateSchema(input,85);if(errors.length)throw new Error('Invalid version 85 save: '+errors.join(' '));input.schemaVersion=86;for(const p of (input as unknown as World).pawns)p.priorities.warden=3;}
  if(record(input)&&input.schemaVersion===86){const errors=validateSchema(input,86);if(errors.length)throw new Error('Invalid version 86 save: '+errors.join(' '));input.schemaVersion=87;for(const p of (input as unknown as World).pawns)p.priorities.firefight=1;}
  if(record(input)&&input.schemaVersion===87){const errors=validateSchema(input,87);if(errors.length)throw new Error('Invalid version 87 save: '+errors.join(' '));input.schemaVersion=88;}
  if(record(input)&&input.schemaVersion===88){const errors=validateSchema(input,88);if(errors.length)throw new Error('Invalid version 88 save: '+errors.join(' '));input.schemaVersion=89;for(const p of (input as unknown as World).pawns)p.priorities.clean=p.visitor?0:3;}
  if(record(input)&&input.schemaVersion===89){
    const errors=validateSchema(input,89);if(errors.length)throw new Error('Invalid version 89 save: '+errors.join(' '));
    const world=input as unknown as World,registry=createDefaultApparelPolicyRegistry(false,false,false,false);
    for(const structure of [...world.structures,...world.packed.map(pack=>pack.building)])if(['bed','table','stool'].includes(structure.kind))structure.quality='normal';
    for(const pile of world.piles){
      if(pile.apparel&&(pile.item==='cloth-shirt'||pile.item==='cloth-tribalwear'))pile.apparel.material='cloth';
      if(pile.unfinished){pile.unfinished.material='cloth';pile.unfinished.units=pile.unfinished.cloth!;}
    }
    for(const departure of world.raids?.departed??[])for(const pile of departure.items)
      if(pile.apparel&&(pile.item==='cloth-shirt'||pile.item==='cloth-tribalwear'))pile.apparel.material='cloth';
    for(const departure of world.visitors?.departed??[]){
      departure.pawn.beauty=40;
      for(const pile of departure.items)if(pile.apparel&&(pile.item==='cloth-shirt'||pile.item==='cloth-tribalwear'))pile.apparel.material='cloth';
    }
    if(world.tailoring)world.tailoring.lostLeather=0;
    world.apparelWear=createApparelWearCalendar(world.tick,(world.seed^world.tick^0x0a77e1)>>>0);
    world.apparelPolicies=registry.apparelPolicies;world.nextApparelPolicyId=registry.nextApparelPolicyId;
    for(const pawn of world.pawns){
      pawn.beauty=40;
      if((pawn.faction??'colony')==='colony'&&!pawn.visitor&&!pawn.prisoner&&pawn.state!=='dead'){
        pawn.apparelPolicyId=registry.apparelPolicies[0]!.id;pawn.apparelAutomation=false;pawn.nextApparelCheckAt=world.tick+APPAREL_POLICY_INTERVAL.min+pawn.id%(APPAREL_POLICY_INTERVAL.max-APPAREL_POLICY_INTERVAL.min+1);
      }
    }
    input.schemaVersion=90;
  }
  if(record(input)&&input.schemaVersion===90){const errors=validateSchema(input,90);if(errors.length)throw new Error('Invalid version 90 save: '+errors.join(' '));input.schemaVersion=91;}
  if(record(input)&&input.schemaVersion===91){const errors=validateSchema(input,91);if(errors.length)throw new Error('Invalid version 91 save: '+errors.join(' '));input.schemaVersion=101;}
  if(record(input)&&input.schemaVersion===101){const errors=validateSchema(input,101);if(errors.length)throw new Error('Invalid version 101 save: '+errors.join(' '));input.schemaVersion=103;}
  if(record(input)&&input.schemaVersion===103){const errors=validateSchema(input,103);if(errors.length)throw new Error('Invalid version 103 save: '+errors.join(' '));input.schemaVersion=104;for(const pawn of (input as unknown as World).pawns)pawn.priorities.art=0;}
  if(record(input)&&input.schemaVersion===104){const errors=validateSchema(input,104);if(errors.length)throw new Error('Invalid version 104 save: '+errors.join(' '));input.schemaVersion=105;}
  if(record(input)&&input.schemaVersion===105){const errors=validateSchema(input,105);if(errors.length)throw new Error('Invalid version 105 save: '+errors.join(' '));input.schemaVersion=106;for(const pawn of (input as unknown as World).pawns)pawn.priorities.handle=0;}
  if(record(input)&&input.schemaVersion===106){const errors=validateSchema(input,106);if(errors.length)throw new Error('Invalid version 106 save: '+errors.join(' '));input.schemaVersion=109;}
  if(record(input)&&input.schemaVersion===109){const errors=validateSchema(input,109);if(errors.length)throw new Error('Invalid version 109 save: '+errors.join(' '));input.schemaVersion=119;}
  if(record(input)&&input.schemaVersion===119){
    const errors=validateSchema(input,119);if(errors.length)throw new Error('Invalid version 119 save: '+errors.join(' '));
    const world=input as unknown as World;
    for(const animal of world.wildlife?.animals??[])if(animal.domestic&&(animal.species==='muffalo'||animal.species==='dromedary'&&animal.sex==='female'))animal.domestic.productFullness=0;
    for(const structure of [...world.structures,...world.packed.map(pack=>pack.building)])for(const bill of structure.bills??[]){
      if(PRODUCTION_RECIPES[bill.recipe].inputs.includes('milk'))bill.filters.milk=false;
      if(PRODUCTION_RECIPES[bill.recipe].inputs.includes('muffalo-wool'))bill.filters['muffalo-wool']=false;
    }
    input.schemaVersion=120;
  }
  if(record(input)&&input.schemaVersion===120){
    const errors=validateSchema(input,120);if(errors.length)throw new Error('Invalid version 120 save: '+errors.join(' '));
    const world=input as unknown as World;
    for(const animal of world.wildlife?.animals??[])animal.ageTicks=adultAgeTicks(animal.species);
    for(const pile of world.piles)if(pile.corpse)pile.corpse.ageTicks=adultAgeTicks(pile.corpse.species);
    input.schemaVersion=121;
  }
  if(record(input)&&input.schemaVersion===121){
    const errors=validateSchema(input,121);if(errors.length)throw new Error('Invalid version 121 save: '+errors.join(' '));
    for(const pawn of (input as unknown as World).pawns){pawn.recreation.tolerance.cerebral=0;pawn.recreation.bored.cerebral=false;}
    input.schemaVersion=122;
  }
  if(record(input)&&input.schemaVersion===122){
    const errors=validateSchema(input,122);if(errors.length)throw new Error('Invalid version 122 save: '+errors.join(' '));
    input.schemaVersion=123;
    adoptExoticMerchantSchedule(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===123){
    const errors=validateSchema(input,123);if(errors.length)throw new Error('Invalid version 123 save: '+errors.join(' '));
    for(const pawn of (input as unknown as World).pawns){pawn.recreation.tolerance.social=0;pawn.recreation.bored.social=false;}
    input.schemaVersion=124;
  }
  if(record(input)&&input.schemaVersion===124){
    const errors=validateSchema(input,124);if(errors.length)throw new Error('Invalid version 124 save: '+errors.join(' '));
    // New negative memories and physical fights arise only after play resumes.
    input.schemaVersion=125;
  }
  if(record(input)&&input.schemaVersion===125){
    const errors=validateSchema(input,125);if(errors.length)throw new Error('Invalid version 125 save: '+errors.join(' '));
    // A future opportunity is scheduled without introducing illness or spending
    // the established simulation PRNG on an old colony's migration boundary.
    input.schemaVersion=127;
    adoptFluIncidents(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===127){
    const errors=validateSchema(input,127);if(errors.length)throw new Error('Invalid version 127 save: '+errors.join(' '));
    // No trait, exchange, opinion or mood is granted to an old colony.
    input.schemaVersion=134;
  }
  if(record(input)&&input.schemaVersion===134){
    const errors=validateSchema(input,134);if(errors.length)throw new Error('Invalid version 134 save: '+errors.join(' '));
    // Existing one-animal leads resume unchanged; new ropes are acquired only
    // at physical contact after this neutral migration.
    input.schemaVersion=135;
  }
  if(record(input)&&input.schemaVersion===135){
    const errors=validateSchema(input,135);if(errors.length)throw new Error('Invalid version 135 save: '+errors.join(' '));
    const world=input as unknown as World;
    for(const pawn of world.pawns)pawn.age=legacyHumanAge();
    for(const departure of world.visitors?.departed??[])departure.pawn.age=legacyHumanAge();
    input.schemaVersion=138;
  }
  if(record(input)&&input.schemaVersion===138){
    const errors=validateSchema(input,138);if(errors.length)throw new Error('Invalid version 138 save: '+errors.join(' '));
    // Research, ingredients and authored work begin only after play resumes.
    input.schemaVersion=139;
  }
  if(record(input)&&input.schemaVersion===139){
    const errors=validateSchema(input,139);if(errors.length)throw new Error('Invalid version 139 save: '+errors.join(' '));
    // New equipment is earned only through future work or trade. Persisted
    // clothing policies, including player restrictions, are left untouched.
    input.schemaVersion=141;
  }
  if(record(input)&&input.schemaVersion===141){
    const errors=validateSchema(input,141);if(errors.length)throw new Error('Invalid version 141 save: '+errors.join(' '));
    // A researched design is not granted to existing colonies retroactively.
    input.schemaVersion=143;
  }
  if(record(input)&&input.schemaVersion===143){
    const errors=validateSchema(input,143);if(errors.length)throw new Error('Invalid version 143 save: '+errors.join(' '));
    const world=input as unknown as World;
    world.breakdown=newBreakdownCalendar(world.seed,world.tick);
    input.schemaVersion=144;
  }
  if(record(input)&&input.schemaVersion===144){
    const errors=validateSchema(input,144);if(errors.length)throw new Error('Invalid version 144 save: '+errors.join(' '));
    // New research, bills and equipment are earned only after play resumes.
    // Preserve the PRNG and every existing player policy unchanged.
    input.schemaVersion=148;
  }
  if(record(input)&&input.schemaVersion===148){
    const errors=validateSchema(input,148);if(errors.length)throw new Error('Invalid version 148 save: '+errors.join(' '));
    // A new crisis can occur only through future simulation. Preserve all
    // existing moods, tasks, reservations and the simulation PRNG exactly.
    input.schemaVersion=150;
  }
  if(record(input)&&input.schemaVersion===150){
    const errors=validateSchema(input,150);if(errors.length)throw new Error('Invalid version 150 save: '+errors.join(' '));
    // Existing policies, food, memories, spoilage and PRNG continue unchanged.
    // New meals arise only through future physical production and ingestion.
    input.schemaVersion=152;
  }
  if(record(input)&&input.schemaVersion===152){
    const errors=validateSchema(input,152);if(errors.length)throw new Error('Invalid version 152 save: '+errors.join(' '));
    // Production and ingestion grant the new meal and memory only during play.
    // Preserve existing food policies, spoilage, tasks and PRNG unchanged.
    input.schemaVersion=154;
  }
  if(record(input)&&input.schemaVersion===154){
    const errors=validateSchema(input,154);if(errors.length)throw new Error('Invalid version 154 save: '+errors.join(' '));
    // The new meal, recipe and policy permission can arise only after play resumes.
    // Keep every identity, quantity, task, memory, food age and PRNG state intact.
    input.schemaVersion=155;
  }
  if(record(input)&&input.schemaVersion===155){
    const errors=validateSchema(input,155);if(errors.length)throw new Error('Invalid version 155 save: '+errors.join(' '));
    // New content begins only after play resumes. Keep policies, inventories,
    // active work, food condition, memories and the PRNG untouched.
    input.schemaVersion=156;
  }
  if(record(input)&&input.schemaVersion===156){
    const errors=validateSchema(input,156);if(errors.length)throw new Error('Invalid version 156 save: '+errors.join(' '));
    // New content arises only through future play; leave all existing state intact.
    input.schemaVersion=157;
  }
  if(record(input)&&input.schemaVersion===157){
    const errors=validateSchema(input,157);if(errors.length)throw new Error('Invalid version 157 save: '+errors.join(' '));
    // New content arises only through future play; preserve the existing state.
    input.schemaVersion=159;
  }
  if(record(input)&&input.schemaVersion===159){
    const errors=validateSchema(input,159);if(errors.length)throw new Error('Invalid version 159 save: '+errors.join(' '));
    // The bulk bill is chosen in later play, never granted to an older world.
    input.schemaVersion=160;
  }
  if(record(input)&&input.schemaVersion===160){
    const errors=validateSchema(input,160);if(errors.length)throw new Error('Invalid version 160 save: '+errors.join(' '));
    // The mixed fine bulk bill is chosen only during later play.
    input.schemaVersion=161;
  }
  if(record(input)&&input.schemaVersion===161){
    const errors=validateSchema(input,161);if(errors.length)throw new Error('Invalid version 161 save: '+errors.join(' '));
    // The vegetarian fine bulk bill is chosen only during later play.
    input.schemaVersion=162;
  }
  if(record(input)&&input.schemaVersion===162){
    const errors=validateSchema(input,162);if(errors.length)throw new Error('Invalid version 162 save: '+errors.join(' '));
    // The carnivore fine bulk bill is chosen only during later play.
    input.schemaVersion=163;
  }
  if(record(input)&&input.schemaVersion===163){
    const errors=validateSchema(input,163);if(errors.length)throw new Error('Invalid version 163 save: '+errors.join(' '));
    // The mixed lavish bulk bill is chosen only during later play.
    input.schemaVersion=164;
  }
  if(record(input)&&input.schemaVersion===164){
    const errors=validateSchema(input,164);if(errors.length)throw new Error('Invalid version 164 save: '+errors.join(' '));
    // The vegetarian lavish bulk bill is chosen only during later play.
    input.schemaVersion=165;
  }
  if(record(input)&&input.schemaVersion===165){
    const errors=validateSchema(input,165);if(errors.length)throw new Error('Invalid version 165 save: '+errors.join(' '));
    // The carnivore lavish bulk bill is chosen only during later play.
    input.schemaVersion=166;
  }
  if(record(input)&&input.schemaVersion===166){
    const errors=validateSchema(input,166);if(errors.length)throw new Error('Invalid version 166 save: '+errors.join(' '));
    // No retrospective plants, doses or RNG draws; only future wild renewal may use the new species.
    input.schemaVersion=167;
  }
  if(record(input)&&input.schemaVersion===167){
    const errors=validateSchema(input,167);if(errors.length)throw new Error('Invalid version 167 save: '+errors.join(' '));
    // An absent Plants profile retains the old neutral work and harvest behavior
    // until a colonist performs future plant work. No past XP or RNG is invented.
    input.schemaVersion=168;
  }
  if(record(input)&&input.schemaVersion===168){
    const errors=validateSchema(input,168);if(errors.length)throw new Error('Invalid version 168 save: '+errors.join(' '));
    // No retrospective event, calendar, exposure or RNG draw. Playing resumes
    // the selected profile through an explicit prospective engine adoption.
    input.schemaVersion=169;
  }
  if(record(input)&&input.schemaVersion===169){
    const errors=validateSchema(input,169);if(errors.length)throw new Error('Invalid version 169 save: '+errors.join(' '));
    // Death memories arise at future transitions, never from retained historical bodies.
    input.schemaVersion=170;
  }
  if(record(input)&&input.schemaVersion===170){
    const errors=validateSchema(input,170);if(errors.length)throw new Error('Invalid version 170 save: '+errors.join(' '));
    input.schemaVersion=171;
  }
  if(record(input)&&input.schemaVersion===171){
    const errors=validateSchema(input,171);if(errors.length)throw new Error('Invalid version 171 save: '+errors.join(' '));
    // The quest calendar is enabled only through a later player decision.
    input.schemaVersion=172;
  }
  if(record(input)&&input.schemaVersion===172){
    const errors=validateSchema(input,172);if(errors.length)throw new Error('Invalid version 172 save: '+errors.join(' '));
    // Flashstorm exists only at a future eligible Misc opportunity.
    input.schemaVersion=173;
  }
  if(record(input)&&input.schemaVersion===173){
    const errors=validateSchema(input,173);if(errors.length)throw new Error('Invalid version 173 save: '+errors.join(' '));
    // No departed animal, route, ecological history or random draw is invented.
    input.schemaVersion=174;
  }
  if(record(input)&&input.schemaVersion===174){
    const errors=validateSchema(input,174);if(errors.length)throw new Error('Invalid version 174 save: '+errors.join(' '));
    // No patient, capsule, injuries, items, admission or random draw is invented.
    input.schemaVersion=175;
  }
  if(record(input)&&input.schemaVersion===175){
    const errors=validateSchema(input,175);if(errors.length)throw new Error('Invalid version 175 save: '+errors.join(' '));
    // Absent quality/HP ranges retain historical storage rules without invented settings.
    input.schemaVersion=176;
  }
  if(record(input)&&input.schemaVersion===176){
    const errors=validateSchema(input,176);if(errors.length)throw new Error('Invalid version 176 save: '+errors.join(' '));
    // No lamp, crop, light history, power or random draw is invented.
    input.schemaVersion=177;
  }
  if(record(input)&&input.schemaVersion===177){
    const errors=validateSchema(input,177);if(errors.length)throw new Error('Invalid version 177 save: '+errors.join(' '));
    // No predator, consumed anatomy, hunt, food or ecological target is invented.
    input.schemaVersion=178;
  }
  if(record(input)&&input.schemaVersion===178){
    const errors=validateSchema(input,178);if(errors.length)throw new Error('Invalid version 178 save: '+errors.join(' '));
    // No request, dose, operation, anesthetic or medical history is invented.
    input.schemaVersion=179;
  }
  if(record(input)&&input.schemaVersion===179){
    const errors=validateSchema(input,179);if(errors.length)throw new Error('Invalid version 179 save: '+errors.join(' '));
    // No expedition, destination, stock, money or purchase is invented.
    input.schemaVersion=180;
  }
  if(record(input)&&input.schemaVersion===180){
    const errors=validateSchema(input,180);if(errors.length)throw new Error('Invalid version 180 save: '+errors.join(' '));
    // No exposure, discharge, clock or random draw is invented.
    input.schemaVersion=181;
  }
  if(record(input)&&input.schemaVersion===181){
    const errors=validateSchema(input,181);if(errors.length)throw new Error('Invalid version 181 save: '+errors.join(' '));
    // No cultivated plant, medicine, profile, exposure, progress or draw is invented.
    input.schemaVersion=182;
  }
  if(record(input)&&input.schemaVersion===182){
    const errors=validateSchema(input,182);if(errors.length)throw new Error('Invalid version 182 save: '+errors.join(' '));
    // No incident, rage, mental clock or random draw is invented.
    input.schemaVersion=183;
  }
  if(record(input)&&input.schemaVersion===183){
    const errors=validateSchema(input,183);if(errors.length)throw new Error('Invalid version 183 save: '+errors.join(' '));
    // No World calendar, condition, stored energy or random draw is invented.
    input.schemaVersion=184;
  }
  if(record(input)&&input.schemaVersion===184){
    const errors=validateSchema(input,184);if(errors.length)throw new Error('Invalid version 184 save: '+errors.join(' '));
    // No cargo, trade, silver, stock or progress is granted.
    input.schemaVersion=185;
  }
  if(record(input)&&input.schemaVersion===185){
    const errors=validateSchema(input,185);if(errors.length)throw new Error('Invalid version 185 save: '+errors.join(' '));
    // No Mining profile, past XP, yield contribution or random draw is invented.
    // Missing contributions from historical rock damage remain neutral at use.
    input.schemaVersion=186;
  }
  if(record(input)&&input.schemaVersion===186){
    const errors=validateSchema(input,186);if(errors.length)throw new Error('Invalid version 186 save: '+errors.join(' '));
    // No hospital bed, research, ingredients or clinical history is invented.
    input.schemaVersion=187;
  }
  if(record(input)&&input.schemaVersion===187){
    const errors=validateSchema(input,187);if(errors.length)throw new Error('Invalid version 187 save: '+errors.join(' '));
    // Existing rations remain unchanged; no project, bill, meal or work is granted.
    input.schemaVersion=188;
  }
  if(record(input)&&input.schemaVersion===188){
    const errors=validateSchema(input,188);if(errors.length)throw new Error('Invalid version 188 save: '+errors.join(' '));
    input.schemaVersion=189;
  }
  if(record(input)&&input.schemaVersion===189){
    const errors=validateSchema(input,189);if(errors.length)throw new Error('Invalid version 189 save: '+errors.join(' '));
    initializeTelevisionRecreation(input as unknown as World);
    input.schemaVersion=190;
  }
  if(record(input)&&input.schemaVersion===190){
    const errors=validateSchema(input,190);if(errors.length)throw new Error('Invalid version 190 save: '+errors.join(' '));
    // Past, skills, priorities, offers, archives and all RNG streams stay exact.
    input.schemaVersion=191;
  }
  if(record(input)&&input.schemaVersion===191){
    const errors=validateSchema(input,191);if(errors.length)throw new Error('Invalid version 191 save: '+errors.join(' '));
    // No crisis, target, threat, counter or random draw is added to old owners.
    input.schemaVersion=192;
  }
  if(record(input)&&input.schemaVersion===192){
    const errors=validateSchema(input,192);if(errors.length)throw new Error('Invalid version 192 save: '+errors.join(' '));
    // Existing owners, histories, research and RNG stay exact; only the version advances.
    input.schemaVersion=193;
  }
  if(record(input)&&input.schemaVersion===193){
    const errors=validateSchema(input,193);if(errors.length)throw new Error('Invalid version 193 save: '+errors.join(' '));
    // No actor, carcass, raid permission, salvage count or draw is added to old owners.
    input.schemaVersion=194;
  }
  if(record(input)&&input.schemaVersion===194){
    const errors=validateSchema(input,194);if(errors.length)throw new Error('Invalid version 194 save: '+errors.join(' '));
    // No relationship, partner, offer, memory, archive or draw is invented.
    input.schemaVersion=195;
  }
  if(record(input)&&input.schemaVersion===195){
    const errors=validateSchema(input,195);if(errors.length)throw new Error('Invalid version 195 save: '+errors.join(' '));
    // Existing owners remain unchanged; planet and groups are prospective commands.
    input.schemaVersion=196;
  }
  if(record(input)&&input.schemaVersion===196){
    const errors=validateSchema(input,196);if(errors.length)throw new Error('Invalid version 196 save: '+errors.join(' '));
    // Races, ranged permission and corpse filters remain prospective; number only.
    input.schemaVersion=197;
  }
  if(record(input)&&input.schemaVersion===197){
    const errors=validateSchema(input,197);if(errors.length)throw new Error('Invalid version 197 save: '+errors.join(' '));
    // Human Busy clocks are adopted only at their first prospective Core pass.
    input.schemaVersion=198;
  }
  if(record(input)&&input.schemaVersion===198){
    const errors=validateSchema(input,198);if(errors.length)throw new Error('Invalid version 198 save: '+errors.join(' '));
    // Existing capsules retain their affiliation and outcome; joining is prospective.
    input.schemaVersion=199;
  }
  if(record(input)&&input.schemaVersion===199){
    const errors=validateSchema(input,199);if(errors.length)throw new Error('Invalid version 199 save: '+errors.join(' '));
    // The weather envelope is adopted only by a future played step.
    input.schemaVersion=200;
  }
  if(record(input)&&input.schemaVersion===200){
    const errors=validateSchema(input,200);if(errors.length)throw new Error('Invalid version 200 save: '+errors.join(' '));
    // Electrical accidents begin only on a future played step.
    input.schemaVersion=201;
  }
  if(record(input)&&input.schemaVersion===201){
    const errors=validateSchema(input,201);if(errors.length)throw new Error('Invalid version 201 save: '+errors.join(' '));
    input.schemaVersion=202;
  }
  if(record(input)&&input.schemaVersion===202){
    const errors=validateSchema(input,202);if(errors.length)throw new Error('Invalid version 202 save: '+errors.join(' '));
    // Existing soil zones and plants are untouched; basins are prospective.
    input.schemaVersion=203;
  }
  if(record(input)&&input.schemaVersion===203){
    const errors=validateSchema(input,203);if(errors.length)throw new Error('Invalid version 203 save: '+errors.join(' '));
    // Prison breaks are adopted prospectively; no prisoner history is invented.
    input.schemaVersion=204;
  }
  if(record(input)&&input.schemaVersion===204){
    const errors=validateSchema(input,204);if(errors.length)throw new Error('Invalid version 204 save: '+errors.join(' '));
    // Blight is prospective: neither infections nor incident history are invented.
    input.schemaVersion=205;
  }
  if(record(input)&&input.schemaVersion===205){
    const errors=validateSchema(input,205);if(errors.length)throw new Error('Invalid version 205 save: '+errors.join(' '));
    // Drug production is prospective; no bench, research, ingredient or bill is added.
    input.schemaVersion=206;
  }
  if(record(input)&&input.schemaVersion===206){
    const errors=validateSchema(input,206);if(errors.length)throw new Error('Invalid version 206 save: '+errors.join(' '));
    // Immune diseases and their incident stream are adopted only by future play.
    input.schemaVersion=207;
  }
  if(record(input)&&input.schemaVersion===207){
    const errors=validateSchema(input,207);if(errors.length)throw new Error('Invalid version 207 save: '+errors.join(' '));
    // EMP weapons and their retained effects are prospective, with no invented history.
    input.schemaVersion=208;
  }
  if(record(input)&&input.schemaVersion===208){
    const errors=validateSchema(input,208);if(errors.length)throw new Error('Invalid version 208 save: '+errors.join(' '));
    // Perceived deaths and corpse exposure begin prospectively during play.
    input.schemaVersion=209;
  }
  if(record(input)&&input.schemaVersion===209){
    const errors=validateSchema(input,209);if(errors.length)throw new Error('Invalid version 209 save: '+errors.join(' '));
    // Wooden prostheses and their surgical ingredients require future play.
    input.schemaVersion=210;
  }
  if(record(input)&&input.schemaVersion===210){
    const errors=validateSchema(input,210);if(errors.length)throw new Error('Invalid version 210 save: '+errors.join(' '));
    // Hospital support is prospective: preserve all research, terrain and RNG.
    input.schemaVersion=211;
  }
  if(record(input)&&input.schemaVersion===211){
    const errors=validateSchema(input,211);if(errors.length)throw new Error('Invalid version 211 save: '+errors.join(' '));
    // Herd veterinary care is prospective; no animal, medicine or intent is added.
    input.schemaVersion=212;
  }
  if(record(input)&&input.schemaVersion===212){
    const errors=validateSchema(input,212);if(errors.length)throw new Error('Invalid version 212 save: '+errors.join(' '));
    // Arrest is prospective; retain all people, possessions, intent and RNG.
    input.schemaVersion=213;
  }
  if(record(input)&&input.schemaVersion===213){
    const errors=validateSchema(input,213);if(errors.length)throw new Error('Invalid version 213 save: '+errors.join(' '));
    // Assisted animal feeding is prospective; no food, health or intent is added.
    input.schemaVersion=214;
  }
  if(record(input)&&input.schemaVersion===214){
    const errors=validateSchema(input,214);if(errors.length)throw new Error('Invalid version 214 save: '+errors.join(' '));
    // Deep resources are prospective; no discovery, work, stock or RNG is added.
    input.schemaVersion=215;
  }
  if(record(input)&&input.schemaVersion===215){
    const errors=validateSchema(input,215);if(errors.length)throw new Error('Invalid version 215 save: '+errors.join(' '));
    // Prospective orbital calendar: no stock, RNG, task or arrival is synthesized.
    input.schemaVersion=216;
  }
  if(record(input)&&input.schemaVersion===216){
    const errors=validateSchema(input,216);if(errors.length)throw new Error('Invalid version 216 save: '+errors.join(' '));
    input.schemaVersion=217;adoptPasteFoodPolicies(input as unknown as World);
  }
  if(record(input)&&input.schemaVersion===217){
    const errors=validateSchema(input,217);if(errors.length)throw new Error('Invalid version 217 save: '+errors.join(' '));
    // Refining and stored fuel are prospective: preserve every original reserve.
    input.schemaVersion=218;
  }
  if(record(input)&&input.schemaVersion===218){
    const errors=validateSchema(input,218);if(errors.length)throw new Error('Invalid version 218 save: '+errors.join(' '));
    adoptStockpileZones(input as unknown as World);
    input.schemaVersion=219;
  }
  if(record(input)&&input.schemaVersion===219){
    const errors=validateSchema(input,219);if(errors.length)throw new Error('Invalid version 219 save: '+errors.join(' '));
    // Slaughter is an explicit future intent: preserve every herd, owner and RNG.
    input.schemaVersion=220;
  }
  if(record(input)&&input.schemaVersion===220){
    const errors=validateSchema(input,220);if(errors.length)throw new Error('Invalid version 220 save: '+errors.join(' '));
    // Sleeping places and rescue are prospective; no owner or actor is invented.
    input.schemaVersion=221;
  }
  if(record(input)&&input.schemaVersion===221){
    const errors=validateSchema(input,221);if(errors.length)throw new Error('Invalid version 221 save: '+errors.join(' '));
    // Smelting is prospective; keep original objects, bills, skills and streams.
    input.schemaVersion=222;
  }
  if(record(input)&&input.schemaVersion===222){
    const errors=validateSchema(input,222);if(errors.length)throw new Error('Invalid version 222 save: '+errors.join(' '));
    // Areas and assignments are prospective; original owners and streams are untouched.
    input.schemaVersion=223;
  }
  if(record(input)&&input.schemaVersion===223){
    const errors=validateSchema(input,223);if(errors.length)throw new Error('Invalid version 223 save: '+errors.join(' '));
    // Double beds and their durable slots are prospective; no owner is inferred.
    input.schemaVersion=224;
  }
  if(record(input)&&input.schemaVersion===224){
    const errors=validateSchema(input,224);if(errors.length)throw new Error('Invalid version 224 save: '+errors.join(' '));
    input.schemaVersion=225; // No station, filter, task or death history is invented.
  }
  if(record(input)&&input.schemaVersion===225){
    const errors=validateSchema(input,225);if(errors.length)throw new Error('Invalid version 225 save: '+errors.join(' '));
    input.schemaVersion=226; // No trap, contact, switch, material or random state is created.
  }
  if(record(input)&&input.schemaVersion===226){
    const errors=validateSchema(input,226);if(errors.length)throw new Error('Invalid version 226 save: '+errors.join(' '));
    input.schemaVersion=227; // No crop, item, bill, diet permission or random state is created.
  }
  if(record(input)&&input.schemaVersion===227){
    const errors=validateSchema(input,227);if(errors.length)throw new Error('Invalid version 227 save: '+errors.join(' '));
    input.schemaVersion=228; // No herd limit, designation, task or random state is created.
  }
  if(record(input)&&input.schemaVersion===228){
    const errors=validateSchema(input,228);if(errors.length)throw new Error('Invalid version 228 save: '+errors.join(' '));
    input.schemaVersion=229; // No shelf, cell identity, item, policy or random draw is created.
  }
  if(record(input)&&input.schemaVersion===229){
    const errors=validateSchema(input,229);if(errors.length)throw new Error('Invalid version 229 save: '+errors.join(' '));
    input.schemaVersion=230; // No candidate, planet, climate or random draw is added.
  }
  if(record(input)&&input.schemaVersion===230){
    const errors=validateSchema(input,230);if(errors.length)throw new Error('Invalid version 230 save: '+errors.join(' '));
    input.schemaVersion=231; // No capsule, person, possession, clinical clock or random draw is created.
  }
  if(record(input)&&input.schemaVersion===231){
    const errors=validateSchema(input,231);if(errors.length)throw new Error('Invalid version 231 save: '+errors.join(' '));
    input.schemaVersion=232; // No sleeping spot, role, assignment, clinical record or random draw is created.
  }
  if(record(input)&&input.schemaVersion===232){
    const errors=validateSchema(input,232);if(errors.length)throw new Error('Invalid version 232 save: '+errors.join(' '));
    input.schemaVersion=233; // No tactical task, medicine, posture, clinical clock or random draw is created.
  }
  if(record(input)&&input.schemaVersion===233){
    const errors=validateSchema(input,233);if(errors.length)throw new Error('Invalid version 233 save: '+errors.join(' '));
    input.schemaVersion=234; // No forced meal, cargo, need, dining place or random draw is created.
  }
  if(record(input)&&input.schemaVersion===234){const errors=validateSchema(input,234);if(errors.length)throw new Error('Invalid version234 save: '+errors.join(' '));input.schemaVersion=235;}
  if(record(input)&&input.schemaVersion===235){const errors=validateSchema(input,235);if(errors.length)throw new Error('Invalid version235 save: '+errors.join(' '));input.schemaVersion=236;}
  if(record(input)&&input.schemaVersion===236){
    const errors=validateSchema(input,236);if(errors.length)throw new Error('Invalid version236 save: '+errors.join(' '));
    input.schemaVersion=237; // No guest admission, person, possession, clinical clock or random draw is created.
  }
  if(record(input)&&input.schemaVersion===237){
    const errors=validateSchema(input,237);if(errors.length)throw new Error('Invalid version237 save: '+errors.join(' '));
    input.schemaVersion=238; // No captured lean, past projectile, clock, person or draw is invented.
  }
  if(record(input)&&input.schemaVersion===238){const old=validateSchema(input,238);if(old.length)throw new Error('Invalid version238 save: '+old.join(' '));input.schemaVersion=239;}
  if(record(input)&&input.schemaVersion===239){
    const errors=validateSchema(input,239);if(errors.length)throw new Error('Invalid version239 save: '+errors.join(' '));
    input.schemaVersion=240; // No site, people, goods, research, RNG or progress is invented.
  }
  if(record(input)&&input.schemaVersion===240){
    const errors=validateCampaignSchema(input,240);if(errors.length)throw new Error('Invalid version240 save: '+errors.join(' '));
    input.schemaVersion=241; // No ore, item, recipe permission, research, person or random draw is created.
  }
  if(record(input)&&input.schemaVersion===241){
    const errors=validateCampaignSchema(input,241);if(errors.length)throw new Error('Invalid version241 save: '+errors.join(' '));
    input.schemaVersion=242; // No calendar, actor, draw, item or past opportunity is granted by loading.
  }
  if(record(input)&&input.schemaVersion===242){
    const errors=validateCampaignSchema(input,242);if(errors.length)throw new Error('Invalid version242 save: '+errors.join(' '));
    input.schemaVersion=243; // Neither map is regenerated; no silver, person, progress, ID or draw is granted.
  }
  if(record(input)&&input.schemaVersion===243){
    const errors=validateCampaignSchema(input,243);if(errors.length)throw new Error('Invalid version243 save: '+errors.join(' '));
    input.schemaVersion=244; // No vent, service, resource, temperature, ID or draw is created on either map.
  }
  if(record(input)&&input.schemaVersion===244){
    const errors=validateCampaignSchema(input,244);if(errors.length)throw new Error('Invalid version244 save: '+errors.join(' '));
    input.schemaVersion=245; // Both maps stay literal: no garment, permission, material, work, ID or random draw.
  }
  if(record(input)&&input.schemaVersion===245){
    const errors=validateCampaignSchema(input,245);if(errors.length)throw new Error('Invalid version245 save: '+errors.join(' '));
    input.schemaVersion=246; // Both maps remain literal; no marsh, terrain, plant, ID or draw is generated.
  }
  if(record(input)&&input.schemaVersion===246){
    const errors=validateCampaignSchema(input,246);if(errors.length)throw new Error('Invalid version246 save: '+errors.join(' '));
    input.schemaVersion=247; // Both maps remain literal: no foundation, wood, work, ID or draw is granted.
  }
  if(record(input)&&input.schemaVersion===247){
    const errors=validateCampaignSchema(input,247);if(errors.length)throw new Error('Invalid version247 save: '+errors.join(' '));
    input.schemaVersion=248; // Both maps remain literal: no food, permission, research, work, ID or draw is granted.
  }
  if(record(input)&&input.schemaVersion===248){
    const errors=validateCampaignSchema(input,248);if(errors.length)throw new Error('Invalid version248 save: '+errors.join(' '));
    input.schemaVersion=249; // Both maps remain literal: no torch, fuel, work, owner, ID or draw is granted.
  }
  if(record(input)&&input.schemaVersion===249){
    const errors=validateCampaignSchema(input,249);if(errors.length)throw new Error('Invalid version249 save: '+errors.join(' '));
    input.schemaVersion=250; // Existing groups remain literal: no mixed-provision permission, stock, counter or history is granted.
  }
  if(record(input)&&input.schemaVersion===250){
    const old=validateCampaignSchema(input,250);if(old.length)throw new Error('Invalid version250 save: '+old.join(' '));
    input.schemaVersion=251; // Both maps remain literal: no disposal bill, garment, work, ID or random draw.
  }
  if(record(input)&&input.schemaVersion===251){
    const old=validateCampaignSchema(input,251);if(old.length)throw new Error('Invalid version251 save: '+old.join(' '));
    // Both old maps are valid before the prospective calendar is introduced.
    // No old exposure, damage, random draw, item or owner is reconstructed.
    input.schemaVersion=252;
    input.deterioration=createDeteriorationState(Number(input.seed),Number(input.tick));
    if(record(input.secondarySite)&&record(input.secondarySite.map))
      input.secondarySite.map.deterioration=createDeteriorationState(Number(input.secondarySite.map.seed),Number(input.tick));
  }
  if(record(input)&&input.schemaVersion===252){
    const old=validateCampaignSchema(input,252);if(old.length)throw new Error('Invalid version252 save: '+old.join(' '));
    input.schemaVersion=253; // Both maps/groups remain literal: no freight contract, stock, receipt, baseline or history granted.
  }
  if(record(input)&&input.schemaVersion===253){
    const old=validateCampaignSchema(input,253);if(old.length)throw new Error('Invalid version253 save: '+old.join(' '));
    input.schemaVersion=254; // Both maps remain literal: no shallow water, bridge, person, stock, ID or draw generated.
  }
  if(record(input)&&input.schemaVersion===254){const old=validateCampaignSchema(input,254);if(old.length)throw new Error('Invalid version254 save: '+old.join(' '));input.schemaVersion=255;migrateWorldRegistry(input as unknown as World);}
  if(record(input)&&input.schemaVersion===255){const old=validateCampaignSchema(input,255);if(old.length)throw new Error('Invalid version255 save: '+old.join(' '));input.schemaVersion=256; /* No geography, faction, leader, history or draw is offered. */}
  if(record(input)&&input.schemaVersion===256){
    const old=validateCampaignSchema(input,256);if(old.length)throw new Error('Invalid version256 save: '+old.join(' '));
    input.schemaVersion=257; // Every map/group stays literal: no admission, actor, permission, task, owner, ID or random draw is created.
  }
  if(record(input)&&input.schemaVersion===257){const old=validateCampaignSchema(input,257);if(old.length)throw new Error('Invalid version257 save: '+old.join(' '));input.schemaVersion=258; /* No freight, package, receipt, opening, owner or random draw is created. */}
  if(record(input)&&input.schemaVersion===258){const old=validateCampaignSchema(input,258);if(old.length)throw new Error('Invalid version258 save: '+old.join(' '));input.schemaVersion=259; /* No affiliation, prisoner history, admission2, exit receipt, lifecycle or random draw is offered. */}
  if(record(input)&&input.schemaVersion===259){const old=validateCampaignSchema(input,259);if(old.length)throw new Error('Invalid version259 save: '+old.join(' '));input.schemaVersion=260; /* No Reform birth, pressure, raid or random draw is offered. */}
  if(record(input)&&input.schemaVersion===260){const old=validateCampaignSchema(input,260);if(old.length)throw new Error('Invalid version260 save: '+old.join(' '));input.schemaVersion=261; /* Number only. No encounter, story, route action, birth, captivity or role is offered. */}
  if(record(input)&&input.schemaVersion===261){const old=validateCampaignSchema(input,261);if(old.length)throw new Error('Invalid version261 save: '+old.join(' '));input.schemaVersion=262; /* Number only after strict original-map validation. No fauna/climate/encounter marker, actor or random draw is offered. */}
  if(record(input)&&input.schemaVersion===262){const old=validateCampaignSchema(input,262);if(old.length)throw new Error('Invalid version262 save: '+old.join(' '));input.schemaVersion=263; /* Number only, after strict validation of every original262 map. No Site, defence, held Thing, quest calendar, population watcher, arrival or history is offered. */}
  if(record(input)&&input.schemaVersion===263){const old=validateCampaignSchema(input,263);if(old.length)throw new Error('Invalid version263 save: '+old.join(' '));input.schemaVersion=264; /* Number only. No research, generator, sprayer, material, heat or random draw is offered. */}
  if(record(input)&&input.schemaVersion===264){const old=validateCampaignSchema(input,264);if(old.length)throw new Error('Invalid version264 save: '+old.join(' '));input.schemaVersion=265; /* Number only. No hops, wort, beer, fermentation, policy, alcohol, research, history or random draw is offered. */}
  if(record(input)&&input.schemaVersion===265){const old=validateCampaignSchema(input,265);if(old.length)throw new Error('Invalid version265 save: '+old.join(' '));input.schemaVersion=266; /* Number only. No past caravan rest, fatigue gain, comfort or service is invented. */}
  if(record(input)&&input.schemaVersion===266){const old=validateCampaignSchema(input,266);if(old.length)throw new Error('Invalid version266 save: '+old.join(' '));input.schemaVersion=267; /* Number only. No forge, armor, ingredient, policy, research or random draw is offered. */}
  if(record(input)&&input.schemaVersion===267){const old=validateCampaignSchema(input,267);if(old.length)throw new Error('Invalid version267 save: '+old.join(' '));input.schemaVersion=268; /* Number only. No knife, receipt, bill, permission, progress, owner, ID or random draw is offered. */}
  if(record(input)&&input.schemaVersion===268){const old=validateCampaignSchema(input,268);if(old.length)throw new Error('Invalid version268 save: '+old.join(' '));input.schemaVersion=269; /* Number only: no mace, tool, bill, filter, work, resource, history or random draw. */}
  if(record(input)&&input.schemaVersion===269){const old=validateCampaignSchema(input,269);if(old.length)throw new Error('Invalid version269 save: '+old.join(' '));input.schemaVersion=270; /* Number only: no long-blade research, sword, work, owner, progress or random draw. */}
  if(record(input)&&input.schemaVersion===270){const old=validateCampaignSchema(input,270);if(old.length)throw new Error('Invalid version270 save: '+old.join(' '));input.schemaVersion=271; /* Number only: no cryptosleep research, holder, clinical anchor, memory pause, person, goods or random draw. */}
  if(record(input)&&input.schemaVersion===271){const old=validateCampaignSchema(input,271);if(old.length)throw new Error('Invalid version271 save: '+old.join(' '));input.schemaVersion=272; /* Number only: no spear, work, research, progress, person, goods or random draw. */}
  if(record(input)&&input.schemaVersion===272){const old=validateCampaignSchema(input,272);if(old.length)throw new Error('Invalid version272 save: '+old.join(' '));input.schemaVersion=273; /* Number only: no implant, research, work, surgery, dose, injury, owner or random draw. */}
  if(record(input)&&input.schemaVersion===273){const old=validateCampaignSchema(input,273);if(old.length)throw new Error('Invalid version273 save: '+old.join(' '));input.schemaVersion=274; /* Number only: no gift, price, goodwill, relation transition, receipt, person, goods or random draw. */}
  if(record(input)&&input.schemaVersion===274){const old=validateCampaignSchema(input,274);if(old.length)throw new Error('Invalid version274 save: '+old.join(' '));input.schemaVersion=275; /* Number only: no ship research, building, startup, threat, time, power, goods or random draw. */}
  if(record(input)&&input.schemaVersion===275){const old=validateCampaignSchema(input,275);if(old.length)throw new Error('Invalid version275 save: '+old.join(' '));input.schemaVersion=276; /* Number only: no hull, engine, research, work, power, network, goods, time or random draw. */}
  if(record(input)&&input.schemaVersion===276){const old=validateCampaignSchema(input,276);if(old.length)throw new Error('Invalid version276 save: '+old.join(' '));input.schemaVersion=277; /* Number only: no spatial casket, research, task, suspension, occupant, goods, time, power or random draw. */}
  if(record(input)&&input.schemaVersion===277){const old=validateCampaignSchema(input,277);if(old.length)throw new Error('Invalid version277 save: '+old.join(' '));input.schemaVersion=278; /* Number only after every original map is validated: no reserve filter, bill, item, work, time or random draw. */}
  if(record(input)&&input.schemaVersion===278){const old=validateCampaignSchema(input,278);if(old.length)throw new Error('Invalid version278 save: '+old.join(' '));input.schemaVersion=279; /* Number only: preserve objects, custody, receipts, sampled wealth, bills, time and random draws. */}
  if(record(input)&&input.schemaVersion===279){const old=validateCampaignSchema(input,279);if(old.length)throw new Error('Invalid version279 save: '+old.join(' '));input.schemaVersion=280; /* Number only: no surgery request, patient/bed role, medical state, inventory, dossier, time or random draw. */}
  if(record(input)&&input.schemaVersion===280){const old=validateCampaignSchema(input,280);if(old.length)throw new Error('Invalid version280 save: '+old.join(' '));input.schemaVersion=281; /* Number only: no terrain, rock identity, smoothing intention/progress, skill, inventory, time or random draw. */}
  if(record(input)&&input.schemaVersion===281){const old=validateCampaignSchema(input,281);if(old.length)throw new Error('Invalid version281 save: '+old.join(' '));input.schemaVersion=282; /* Number only: no animal training, learned step, intent, area, cargo, master, clock, food or random draw. */}
  if(record(input)&&input.schemaVersion===282){const old=validateCampaignSchema(input,282);if(old.length)throw new Error('Invalid version282 save: '+old.join(' '));input.schemaVersion=283; /* Number only: no bill worker, skill range, person, work, item, date or random draw is offered. */}
  if(record(input)&&input.schemaVersion===283){const old=validateCampaignSchema(input,283);if(old.length)throw new Error('Invalid version283 save: '+old.join(' '));input.schemaVersion=284; /* Number only: no quest, reward, worker, cloth provenance, person, item, clock or random draw is offered. */}
  if(record(input)&&input.schemaVersion===284){const old=validateCampaignSchema284(input);if(old.length)throw new Error('Invalid version284 save: '+old.join(' '));input.schemaVersion=285; /* Number only: no couple task, opportunity, cooldown, memory, person, item, clock or random draw is offered. */}
  if(record(input)&&input.schemaVersion===285){const old=validateCampaignSchema285(input);if(old.length)throw new Error('Invalid version285 save: '+old.join(' '));input.schemaVersion=286; /* Number only: no storage group, link, private policy, item, clock, skill or random draw is offered. */}
  if(record(input)&&input.schemaVersion===286){const old=validateCampaignSchema286(input);if(old.length)throw new Error('Invalid version286 save: '+old.join(' '));input.schemaVersion=287; /* Number only: no animal area, return, movement, work, clock, goods or random draw is offered. */}
  if(record(input)&&input.schemaVersion===287){const old=validateCampaignSchema287(input);if(old.length)throw new Error('Invalid version287 save: '+old.join(' '));input.schemaVersion=288; /* Number only: no animal refuge, route, wait, health, owner, cargo, clock, work or random draw is offered. */}
  if(record(input)&&input.schemaVersion===288){const old=validateCampaignSchema288(input);if(old.length)throw new Error('Invalid version288 save: '+old.join(' '));input.schemaVersion=289; /* Number only: no reserve pause, policy, product, work, owner, clock or random draw is offered. */}
  if(record(input)&&input.schemaVersion===289){const old=validateCampaignSchema289(input);if(old.length)throw new Error('Invalid version289 save: '+old.join(' '));input.schemaVersion=290; /* Number only: no apparatus, research, foam, protection, task, wave, option or random draw is offered. */}
  if(record(input)&&input.schemaVersion===290){const old=validateCampaignSchema290(input);if(old.length)throw new Error('Invalid version290 save: '+old.join(' '));input.schemaVersion=291; /* Number only: no research, choice, tree, sown origin, work, life, XP or random draw is offered. */}
  if(record(input)&&Number(input.schemaVersion)===291){const old=validateCampaignSchema291(input);if(old.length)throw new Error('Invalid version291 save: '+old.join(' '));input.schemaVersion=292; /* Number only: no Party, occasion, pending, duration, presence, memory, task or random draw is offered. */}
  if(record(input)&&input.schemaVersion===292){const old=validateCampaignSchema292(input);if(old.length)throw new Error('Invalid version292 save: '+old.join(' '));input.schemaVersion=293; /* Number only: no offer, tag, outcome, diplomat, XP, relation, loot, attack or random draw is offered. */}
  if(record(input)&&input.schemaVersion===293){const old=validateCampaignSchema293(input);if(old.length)throw new Error('Invalid version293 save: '+old.join(' '));input.schemaVersion=294; /* Number only: no condition calendar, random draw, cursor, exposure, resistance, plant damage or rot is offered. */}
  if(record(input)&&input.schemaVersion===294){const old=validateCampaignSchema294(input);if(old.length)throw new Error('Invalid version294 save: '+old.join(' '));input.schemaVersion=295; /* Number only: no book, stock, policy, tolerance, task, XP, mood, duration or random draw is offered. */}
  if(record(input)&&input.schemaVersion===295){const old=validateCampaignSchema295(input);if(old.length)throw new Error('Invalid version295 save: '+old.join(' '));input.schemaVersion=296; /* Number only: no wall-door plan, identity, work origin, designation, material, restitution or random draw is offered. */}
  if(record(input)&&input.schemaVersion===296){const old=validateCampaignSchema(input,296);if(old.length)throw new Error('Invalid version296 save: '+old.join(' '));input.schemaVersion=297;input.phaseCore297=0;adoptMigratedCorePathBudgets297(input); /* Prospective phase0 only: captured pace, urgency, edge, coordinate, owner, work, time and random draw unchanged. */}
  if(record(input)&&input.schemaVersion===297){const old=validateCampaignSchema(input,297);if(old.length)throw new Error('Invalid version297 save: '+old.join(' '));input.schemaVersion=298; /* Number only: preserve committed Core phase, consumed per-map path budgets, captured owners, routes, RNG and IDs; no AI/content/departure grant. */}
  if(record(input)&&input.schemaVersion===298){const old=validateCampaignSchema(input,298);if(old.length)throw new Error('Invalid version298 save: '+old.join(' '));input.schemaVersion=299; /* Number only: preserve original data, physical phase, routes, owners, RNG and IDs. Missing ingestion/provider history stays absent, never inferred. */}
  if(record(input)&&input.schemaVersion===299){const old=validateCampaignSchema(input,299);if(old.length)throw new Error('Invalid version299 save: '+old.join(' '));input.schemaVersion=300; /* Number only: keep the existing ordinary/clinical wander bit, committed phase, paths, owners, RNG and IDs. Do not create an idle task or reset history. */}
  if(record(input)&&input.schemaVersion===300){const old=validateCampaignSchema(input,300);if(old.length)throw new Error('Invalid version300 save: '+old.join(' '));input.schemaVersion=301; /* Number only. Preserve every owner, task, work fraction, committed phase, RNG and identity. Missing Thing counter, Frame work/toil and posture history stay absent. */}
  const errors = validateWorld(input); if (errors.length) throw new Error(`Invalid save: ${errors.join(' ')}`);
  const world = input as World;
  if(hasLoadedRoot(world))consolidateLooseRocks(world);
  const normalizedErrors = validateWorld(world);
  if (normalizedErrors.length) throw new Error(`Invalid consolidated save: ${normalizedErrors.join(' ')}`);
  freezeAdmittedNativeWorldPawnOrder256(world);
  freezeAdmittedRiverWaterCampaign256(world);
  return world;
}
export function deserializeWorld(serialized:string):World {const value=deserializeCampaign(serialized);if(!hasLoadedRoot(value))throw new Error('Campaign has no local map; use deserializeCampaign.');return value;}
/** Deterministic diagnostic fingerprint, not a cryptographic digest. */
export function hashWorld(world: World): string {
  const serialized = JSON.stringify(world); let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index++) { hash ^= serialized.charCodeAt(index); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
import { validSecondarySiteShape,secondaryMapForValidation } from './secondary-site-save.ts';
import { isSecondaryContext } from './secondary-site-context.ts';
import { validateMedicalRecord } from './injury-validation.ts';
import { validatePawnHealth,validArtificialPartsWorldTransport } from './health-save.ts';
import { structureById } from './structure-navigation.ts';
