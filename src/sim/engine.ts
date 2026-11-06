import {createWoodWallCore301} from './wood-wall-core-301.ts';
import {rateForPawn301} from './actual-view-301.ts';
import {isSchema300OrLater,isSchema290OrLater} from './schema-compatibility-257.ts';
import {idleWanderTask300,offerIdleWander300,processIdleWander300,createIdleWanderCore300} from './idle-wander-300.ts';
import {isSchema287OrLater,isSchema298OrLater} from './schema-compatibility-257.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {shipComputerSensorsPlacementRefusal298} from './ship-computer-sensors-placement-298.ts';
import {victoryResearchUnlocked298} from './victory-research-298.ts';
import {orderFactionComms298,reconcileFactionComms298,processFactionComms298,stopFactionComms298} from './faction-comms-298.ts';
import {factionCommsTask298} from './faction-comms-state-298.ts';
import {validFactionCommsCommand298} from './faction-comms-save-298.ts';
import {applyAiCoreInformation298} from './ai-core-information-298.ts';
import {createConsoleContactCore298} from './console-contact-core-298.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {expirePhysicalActorTimers297} from './core-timers-297.ts';
import {invalidateHumanMoveSpeed297} from './human-move-speed-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {syncWorldPawnsPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {createCorePhysics297,type CoreStepResult297} from './core-physics-297.ts';
import {createCoreMovement297} from './core-movement-297.ts';
import {applyReadBook295,applyReadingPolicy295} from './reading-runtime-295.ts';
import {canPlaceFirefoamPopper290} from './firefoam-placement-290.ts';
import {initializeFirefoamPopper290,applyFirefoamAutoRebuild290,advanceFirefoamWaves290} from './firefoam-290.ts';
import {applyFirefoamTrigger290,reconcileFirefoamManual290,processFirefoamManual290} from './firefoam-manual-290.ts';
import {advanceLocalMechFirefoam290,captureFirefoamWorldPawnIds290} from './firefoam-actor-290.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {advanceShipReactorThreats275} from './ship-reactor-threats-275.ts';
import {tryCoupleOpportunity285,reconcileCouple285,processCouple285} from './couple-runtime-285.ts';
import {reconcileParty292,reconcilePartyPawn292,advanceParty292,processParty292} from './party-runtime-292.ts';
import {interruptAnimalStorage282,reconcileAnimalHauls282} from './animal-hauling-282.ts';
import {shipCasketPlacementRefusal277} from './ship-casket-placement-277.ts';
import {shipCryptosleepUnlocked277} from './research.ts';
import {newShipCasketHolder277} from './ship-casket-state-277.ts';
import {applyShipCasket277,processShipCasketTask277,reconcileShipCasketTask277} from './ship-casket-task-277.ts';
import {shipReactorPlacementRefusal275} from './ship-reactor-placement-275.ts';
import {shipReactorUnlocked275,shipBasicsUnlocked275,shipEngineUnlocked276} from './research.ts';
import {isShipPartKind276,isShipAddedKind276,SHIP_PART_DEFAULT_ORIENTATION_276} from './ship-part-content-276.ts';
import {shipPartPlacementRefusal276} from './ship-reactor-placement-275.ts';
import {applyShipReactorCommand275,advanceShipReactors275,advanceShipReactorsCore297} from './ship-reactor-runtime-275.ts';
import {cancelProstheticWork273,detachMissingProstheticBills273} from './prosthetic-work-273.ts';
import {isSchema271OrLater,isSchema276OrLater,isSchema277OrLater,isSchema280OrLater,isSchema282OrLater} from './schema-compatibility-257.ts';
import {applyCryptosleep271,processCryptosleepTask271,reconcileCryptosleepTask271} from './cryptosleep-task-271.ts';
import {cryptosleepUnlocked271} from './research.ts';
import {newCryptosleepHolder271} from './cryptosleep-state-271.ts';
import {isSmithingRecipe267} from './smithing-content-267.ts';
import {isSchema263OrLater} from './schema-compatibility-257.ts';
import {processAutomaticAlcohol265} from './alcohol-ingestion-265.ts';
import {applyDrugPolicyCommand265} from './alcohol-policy-265.ts';
import {advanceFermentation265,processBarrelExtraction265} from './fermentation-runtime-265.ts';
import {newFermentationState265} from './fermentation-state-265.ts';
import {smithyConstructionUnlocked267} from './research.ts';
import {brewingUnlocked} from './research.ts';
import {geothermalPlacementRefusal264} from './geothermal-placement-264.ts';
import {createGeothermalState264} from './geothermal-state-264.ts';
import {geothermalPowerUnlocked} from './research.ts';
import {advanceSettlementProximity263} from './world-settlement-proximity-263.ts';
import {advanceSiteMechanoids263} from './world-site-mechanoids-263.ts';
import {advanceSiteAmbush263,isSiteAmbushHuman263,processSiteAmbushHuman263} from './world-site-ambush-263.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import {advanceWorldSites263} from './world-sites-runtime-263.ts';
import {expirePeaceTalks293} from './peace-talks-runtime-293.ts';
import {advanceTradeRequests284} from './trade-request-runtime-284.ts';
import {applyTradeRequestCommand284} from './trade-request-commands-284.ts';
import {advanceForeignSettlementDefeat263} from './world-target-lifecycle-263.ts';
import {pendingWorldEntry263} from './world-target-access-263.ts';
import {isWorldTargetDefender263,processWorldTargetDefender263} from './world-target-defence-263.ts';
import {adoptTempMapIncidents261,advanceTempMapIncidents261,tempMapModern261} from './temp-map-incidents-261.ts';
import {advanceCaravanMapExits261} from './caravan-map-exits-261.ts';
import {validCaravanArrivalCommand261,applyCaravanArrivalCommand261,advanceCaravanArrivals261} from './caravan-arrival-261.ts';
import {advanceBattlefieldVictory261} from './caravan-battlefield-rules-261.ts';
import {validCaravanCommand261,applyCaravanCommand261} from './caravan-commands-261.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {isCaveHiveKind256} from './cave-hive-state-256.ts';
import {advanceActualHiveComponents256} from './cave-hive-tick-256.ts';
import {captureAnimalCombatThreats256} from './cave-hive-lord-256.ts';
import {applyMaterialPermission256} from './material-permission-256.ts';
import {applyAreaMaterialPermission256} from './area-material-permission-256';
import {isShipChunk256} from './ship-chunk-256.ts';
import {advanceCaravanIncidents261,pendingCaravan261} from './caravan-incidents-261.ts';
import {advanceActualWorldPawns256} from './world-pawn-campaign-256.ts';
import {applyAncientCasketOpen256,processAncientCasketOpening256,reconcileAncientCasketOpening256} from './ancient-casket-opening-256.ts';
import {advanceAncientShrineWarnings256} from './ancient-shrine-warning-256.ts';
import {finishArrivalFacing256} from './arrival-rotation-256.ts';
import {ancientRepairTarget256,ancientRepairContact256} from './ancient-monument-runtime-256.ts';
import {isAncientMonumentKind256,ANCIENT_MONUMENT_KINDS_256} from './ancient-monument-props-256.ts';
import {claimRoadProp256,roadPropCanDeconstruct256} from './local-road-prop-ownership-256.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {blindMineDesignation256} from './exploration-visibility-256.ts';
import {hiddenExplorationCommandTarget256} from './exploration-command-targets-256.ts';
import {isLocalRoadProp256} from './local-road-props-256.ts';
import {applyEggPermission256} from './animal-egg-permission-v256.ts';
import {prepareConfirmedBedAssignment256} from './actor-bed-command-256.ts';
import {commitActorBedClaim256} from './actor-map-bed-256.ts';
import {advanceLocalEggs256} from './animal-egg-local-v256.ts';
import {advanceAnimalAges256} from './animal-clinical-age-v256.ts';
import {legacyTravellerContext} from './world-map-owners.ts';
import type {CampaignState} from './world-map-state.ts';
import {applyWorldMapCommand,validWorldMapCommand,removeEmptyCamps,enterRegisteredSite} from './world-map-authority.ts';
import {advanceCampPressure260} from './camp-pressure-260.ts';
import {applyRegisteredGroupCommand} from './world-map-groups.ts';
import {registeredCampaign,registeredMaps,registeredMapId,campaignClockContext,selectedRegisteredMap,flushRegisteredMap,withWorldGroup} from './world-map-context.ts';
import {canDesignateBridge,finishBridge,removeBridge} from './bridge.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {newVentState,ventPlacementAllowed} from './vent.ts';
import {advanceDeterioration} from './deterioration.ts';
import {campaignAuthority,isSecondaryContext,selectedMap,secondaryContext,flushSecondaryContext} from './secondary-site-context.ts';
import {adoptSecondaryIncidents} from './secondary-incidents.ts';
import {applySecondarySiteCommand} from './secondary-site.ts';
import {secondaryCommand} from './secondary-site-state.ts';
import type {SecondarySiteCommand} from './secondary-site-state.ts';
import {isConstructionLightPlant,clearanceOutputPending,workOutputPending} from './construction-plants.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement,retainClearingWorkAfterOutputRefusal,retainWorkAfterOutputRefusal} from './plant-retirement.ts';
import {applyTreeCommand,extractTreeReason,replantTreeReason,processTreeWork,advanceMinifiedTrees,isPlantDesignationJob,treeJobReason} from './tree-transfer.ts';
import {applyDesignationCancel,cancelIntentJobs,clearPileHaulFlags} from './designation-cancel.ts';
import {isShelfKind,newShelfStorage} from './shelf-storage.ts';
import {patchShelfPolicy} from './shelf-commands.ts';
import { applyAllowedAreaCommand } from './allowed-areas.ts';
import { commitAllowedAreaChange,preflightAllowedAreaChange,reconcileAllowedAreas,reconcileAllowedAreaPawn,type AreaInterruptionPlan } from './allowed-area-reconcile.ts';
import {applyAnimalAreaAssignmentCommand287,prepareAnimalAreaCellsEdit287,prepareAnimalAreaDefinitionRemoval287,type AnimalAreaCommandPhase287} from './animal-area-commands-287.ts';
import {animalAreaHumanPhaseMutable287,animalAreaHomePhaseMutable287} from './animal-area-human-admission-287.ts';
import {removalWritesMutable259} from './map-removal-writes-259.ts';
import {prepareRemovedMapAreas} from './pawn-map-areas.ts';
import { processReturnToAllowedArea } from './allowed-area-navigation.ts';
import { searchAllowed } from './work-planner.ts';
import { deepDrillingUnlocked,groundScannerUnlocked,nutrientPasteUnlocked,biofuelRefiningUnlocked } from './research.ts';
import { processDeepWork,reconcileDeepWork } from './deep-drilling.ts';
import { adoptDeepResources } from './deep-resources.ts';
import { adoptOrbital,advanceOrbital,applyOrbitalTrade,processOrbitalTrade,reconcileOrbitalTrade } from './orbital.ts';
import { reconcilePasteRequests } from './nutrient-paste.ts';
import { validGroupCommand } from './group-command-shape.ts';
import { applyGroupCommand,groupOnMapMember,cancelGroupPreparation,cancelPawnGroupPreparation257 } from './group-authority.ts';
import {groupHumanPassenger257} from './group-human-admission-257.ts';
import { processGroupOnMap,tryGroupDeparture,advanceGroup,reconcileGroupPreparation,reconcileGroupAdmission257 } from './group-driver.ts';
import { processMechanoidCombat,mechanoidCombatBatch } from './mechanoid-combat.ts';
import {isMechSalvageRecipe} from './mechanoid-salvage.ts';
import {advanceMechanoidCorpses} from './mechanoid-corpse.ts';
import {enableMechanoidRaids} from './mechanoid-raids.ts';
import { isBedKind } from './bed-kinds.ts';
import { bedAssignmentReason } from './bed-slots.ts';
import { removeIdentity } from './collection-remove.ts';
import { applyCommercialBuy,applyCommercialSell } from './commercial-post.ts';
import { applyCommercialPreparation,processCommercialOnMap,reconcileCommercialOnMap } from './commercial-loading.ts';
import { applyCommercialReturn,advanceCommercialTrip,departCommercial,commercialOnMapId,commercialPawn } from './commercial-trip.ts';
import { reconcileDomesticWork } from './domestic-reconcile.ts';
import { advanceAnimalProducts } from './animal-products.ts';
import { PEN_ANIMALS,penAnimalsForVersion, invalidateAnimalPens } from './animal-pens.ts';
import { applyTaming,processHandling,advanceTameness } from './animal-handling.ts';
import {setAnimalTrainingWanted282} from './animal-training-282.ts';
import { designateSlaughter } from './animal-slaughter.ts';
import { setAutoSlaughterPolicy } from './auto-slaughter.ts';
import { applyAnimalCarePolicy,processAnimalCare } from './animal-care.ts';
import { processAnimalFeeding,reconcileAnimalFeeding } from './animal-feeding.ts';
import {cancelSmithingWork267,detachMissingSmithingBills267} from './smithing-work-267.ts';
import {cancelFlakWork,detachMissingFlakBills} from './flak-work.ts';
import {cancelArtWork,detachMissingArtBills} from './art-work.ts';
import { drugProductionUnlocked, machiningUnlocked,microelectronicsUnlocked,multiAnalyzerUnlocked,fabricationUnlocked,autodoorsUnlocked,hospitalBedUnlocked,tubeTelevisionUnlocked,gunTurretsUnlocked,hydroponicsUnlocked } from './research.ts';
import {vitalsMonitorUnlocked} from './research.ts';
import { advanceHumanCorpses } from './human-corpses.ts';
import { advanceDeathThoughts } from './death-thoughts-perception.ts';
import { applyBurial,processBurial,reconcileBurials,initialGrave } from './burial.ts';
import { applyCleanRoom,processCleaning } from './cleaning.ts';
import {editSnowArea} from './snow-clearing.ts';
import {finishSnowSteps,clearSnowForStructure} from './snow-surface.ts';
import { advanceFilth,recordFilthMovement,bleedFilth } from './filth.ts';
import { weatherRainRate } from './weather.ts';
import { medicalBleed } from './injury-state.ts';
import { processPawnVomiting } from './food-hygiene.ts';
import {smoothFloorReason281,canDesignateSmoothFloor281,canTouchSmoothFloor281,advanceSmoothFloor281} from './smooth-floor-281.ts';
import { finishFloor,removeFloor,FLOOR_DEFINITIONS,canDesignateFloor } from './flooring.ts';
import { applyTrade } from './trade.ts';
import { processTrade } from './trade-contact.ts';
import { advanceVisitors,processVisitor,exitVisitor,visitorGroupDanger } from './visitors.ts';
import { advancePodRescues,exitPodRescue,reconcilePodRescueResults } from './pod-rescue.ts';
import { processPodRescuePatient } from './pod-rescue-patient.ts';
import { applyScoutCommand,processScoutLoading } from './caravan-loading.ts';
import { advanceScoutTrip,departScout,scoutOnMapId,scoutPawn } from './caravan-trip.ts';
import { requestPowerFlick,reconcilePowerFlicks,advancePowerFlick } from './power-flick.ts';
import { applyCapture } from './capture.ts';
import { applyArrest } from './arrest.ts';
import { adoptEnvironment,advanceSurfaceWeather,advanceSurfaceTemperature } from './environment-step.ts';
import { applyExtinguish,processFirefighting,processBurning } from './firefighting.ts';
import { reconcileFires } from './fire.ts';
import { applyPrisonerMode,applyPrisonBed,reconcilePrisoners,processPrisoner } from './prisoners.ts';
import { advancePrisonBreaks,endPrisonBreak } from './prison-break.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import { processPrisonBreak } from './prison-break-behavior.ts';
import { processWarden,reconcileWarden } from './warden.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { batteriesUnlocked,solarPowerUnlocked,complexFurnitureUnlocked } from './research.ts';
import {forestNativeSpecies291,isForestrySpecies291,isGrowingPlantInVersion291,treeSowingUnlocked291} from './forestry-content-291.ts';
import { isFoodWorkstation } from './food-workstations.ts';
import { designateHunt,processHunting } from './hunting.ts';
import { cancelHunting } from './hunting-state.ts';
import { advanceCorpses } from './corpses.ts';
import { advanceWildlife,enableWildlife,reconcileWildlife } from './wildlife.ts';
import { enableHeatwaves,advanceHeatwaves } from './heatwave.ts';
import { adoptMiscIncidents,adoptWeatherIncidents,advanceMiscIncidents } from './cassandra-misc.ts';
import { adoptShortCircuits } from './short-circuit.ts';
import { adoptCropBlights } from './crop-blight-incident.ts';
import {adoptToxicFallout294,finishToxicFallout294} from './toxic-fallout-incident-294.ts';
import {advanceToxicFalloutEnvironment294} from './toxic-fallout-environment-294.ts';
import { advanceCropBlight } from './plant-blight.ts';
import { designateBlightedCrops } from './crop-blight-orders.ts';
import { adoptWorldIncidents,advanceWorldIncidents } from './cassandra-world.ts';
import { adoptSmallIncidents,advanceSmallIncidents } from './cassandra-small.ts';
import { advanceHeatExposure } from './heat-exposure.ts';
import { processHeatRefuge } from './heat-refuge.ts';
import { newHeaterState,adjustHeaterTarget } from './heater.ts';
import { newWindTurbineState,setWindAutoCut,adoptWind } from './wind.ts';
import { coolerFaces,coolerFaceBlocked,newCoolerState,setCoolerTarget,adjustCoolerTarget } from './cooler.ts';
import { airConditioningUnlocked, selectResearch,processResearch,researchRate,clothingUnlocked } from './research.ts';
import { craftingQuality,tailoringTemperatureFactor } from './crafting-quality.ts';
import { healthRandom } from './health.ts';
import { FURNITURE_DEFINITIONS,isHabitatFurnitureKind } from './furniture-stats.ts';
import { cancelGunWork,detachMissingGunBills } from './gun-work.ts';
import { cancelComponentWork,detachMissingComponentBills } from './component-work.ts';
import { detachMissingBills,cancelUnfinished } from './unfinished.ts';
import { canPlaceHumanSleepingSpot,placeHumanSleepingSpot,removeHumanSleepingSpot } from './human-sleeping-spot.ts';
import {canPlaceAnimalSpot,placeAnimalSpot,removeAnimalSpot,applyAnimalSpotMedical} from './animal-sleeping-spot.ts';
import {syncCarriedAnimals} from './animal-rest-state.ts';
import {reconcileAnimalRest} from './animal-rest.ts';
import {applyAnimalRescue,processAnimalRescue,reconcileAnimalRescues} from './animal-rescue.ts';
import { placeCraftingSpot,removeCraftingSpot } from './crafting-spot.ts';
import { harvestProductLabel } from './plants.ts';
import { advanceSocial } from './social.ts';
import { advanceHumanAges } from './human-age.ts';
import { reconcileRepairs,advanceRepair } from './repairs.ts';
import { advanceBreakdowns,reconcileBreakdownJobs,advanceBreakdownFix,retireBreakdownJob } from './breakdowns.ts';
import { adoptColonyEconomy,sampleColonyEconomy,flushColonyLosses,advanceColonyAdaptation } from './colony-economy.ts';
import {reconcileKidnapParticipant261} from './caravan-kidnap-261.ts';
import { advanceRaids,enableRaids,exitRaider } from './raids.ts';
import { processRaider } from './raid-behavior.ts';
import { advanceArrivals,applyArrival } from './arrivals.ts';
import { advanceQuests,applyQuestCommand } from './quests.ts';
import { advanceFluIncidents } from './flu-incidents.ts';
import { updateMentalBreak,processMentalBreak } from './mental-break.ts';
import { mentalCrisisLabel } from './mental-catalog.ts';
import { isAggressiveCrisis,processAggressiveCrisis } from './aggressive-crisis.ts';
import { expireMealMemories } from './mood.ts';
import { considerAutomaticCombat } from './automatic-combat.ts';
import { cancelAutomaticCombat } from './automatic-combat-state.ts';
import { isColonist,isAdmittedGuest } from './affiliation.ts';
import { applyMeleeCommand,processMelee } from './melee.ts';
import { isStunned } from './stun.ts';
import { processTactics } from './tactics.ts';
import { considerFlee,processFlee,processSentry,threatQueries } from './threats.ts';
import { retryInterruptedCargo,interruptWork } from './interrupted-cargo.ts';
import { applyDraftCommand,processDraft,interruptDraftWork } from './drafting.ts';
import { advanceWorldCombat } from './combat-system.ts';
import {applySpikeTrapSwitch,reconcileSpikeTrapContacts,spikeTrapWindow} from './spike-traps.ts';
import {validSpikeTrapCommand} from './spike-trap-save.ts';
import {canPlaceSpikeTrap} from './spike-trap-placement.ts';
import {initialSpikeTrapState} from './spike-trap-state.ts';
import { captureFurnitureSight } from './furniture-sight.ts';
import { applyShootingCommand } from './shooting.ts';
import { expireStaggers } from './stagger.ts';
import { collapseFromExhaustion,processDraftSleep } from './needs.ts';
import { applyEquipment,processEquipment,reconcileEquipmentTasks,recoverDroppedWeapon } from './equipment.ts';
import { applyApparelPolicyUpdate,applyApparelPolicyName } from './apparel-policy-edit.ts';
import { advanceWorldApparelWear,applyApparelPolicyAssignment,applyClearForcedApparel,considerApparelPolicy } from './apparel-system.ts';
import { dropIncapacitatedEquipment,reconcileWeaponMemory } from './equipment-state.ts';
import { applyFeeding,processFeeding,reconcileFeeding } from './feeding.ts';
import { applySurgery,processSurgery,reconcileSurgery } from './surgery.ts';
import { applyTending,processTending,reconcileTending } from './tending.ts';
import { applyConsume,isForcedConsuming,consumeActivityValid } from './consuming.ts';
import { processEating } from './eating.ts';
import { applyDraftedTending,isDraftedTending } from './drafted-tending.ts';
import { reconcilePatientRest } from './patient-rest.ts';
import { MEDICAL_CARE } from './medicine-rules.ts';
import { planUrgentCare } from './urgent-care.ts';
import { applyRescue,processRescue,reconcileRescues,isDraftedRescue } from './rescue.ts';
import { applyMedicalBed } from './medical-beds.ts';
import { carrierOf } from './rescue-state.ts';
import { exitPrisoner } from './prisoner-exit.ts';
import { feedingWork } from './feeding-rules.ts';
import { tickSkills, constructionWorkRate } from './skills.ts';
import { plantWorkRate } from './plant-skills.ts';
import { advancePower, reconcilePower } from './power.ts';
import { adoptRainElectrical,advanceRainElectrical } from './rain-electric.ts';
import { isElectrical, newPowerState } from './power-rules.ts';
import { autoRoofRooms, designateRoofArea, scheduleRoofs, reconcileRoofJobs, reconcileRoofSupport, finishRoofJob } from './roofing.ts';
import { isRoofed, isRoofArea, isRoofJob, roofJobWanted, RoofContext } from './roof-rules.ts';
import { applyDoorCommand, updateDoors } from './doors.ts';
import { builtDoorState,isRoomDoor,isPassageDoor } from './door-rules.ts';
import { isBiofuelRecipe, taskWork } from './production-recipes.ts';
import { advanceMining } from './mining.ts';
import { advanceFurniture } from './furniture-transfer.ts';
import { minifiable, furnitureIntentAt, furnitureSourceCells, packedAt } from './furniture-rules.ts';
import { designateUninstall, installCommand } from './furniture-commands.ts';
import { deconstructionAt, deconstructionAvailable, designateDeconstruction } from './deconstruction-rules.ts';
import { finishDeconstruction } from './deconstruction.ts';
import { advancePriorityWork } from './priority-work.ts';
import { leaveTransitCell } from './transit-exit.ts';
import { captureStructureNavigation,structureNavigationReader ,structureById} from './structure-navigation.ts';
import { removeZonesForPlan } from './construction-zones.ts';
import { occupancyOf, occupies } from './occupancy.ts';
import { constructionHaulId, constructionSiteFree, constructionWorkTarget, isConstruction } from './construction-rules.ts';
import { advanceOrders, applyOrderCommand, reconcileOrders } from './player-orders.ts';
import { gatherResource, clearingDuration, clearingKind,plantWorkGrowthFactor256 } from './gathering.ts';
import { wallBlueprintForDoor, planBlueprintDoorReplacement, retireWallBlueprint } from './construction-replacement.ts';
import { wallDoorTarget296, wallDoorRemoval296, canAttachWallDoor296, attachWallDoor296, promoteWallDoorManual296 } from './wall-door-runtime-296.ts';
import { processRecreation } from './recreation.ts';
import { applyScheduleCommand } from './schedule.ts';
import { applyFoodPolicyCommand } from './food-policy.ts';
import { expireFood } from './food-expiration.ts';
export { queryJobStatus, queryPawnStatus } from './diagnostics.ts';
import { processCooking } from './cooking.ts';
import { WorkEnvironmentCache, type WorkEnvironment } from './work-environment.ts';
import { advanceBeautyNeeds } from './beauty-need.ts';
import { advanceFlowerPots } from './flower-pot-work.ts';
import { createFlowerPotState,cutFlowerPotPlant,flowerPotCanUninstall } from './flower-pot.ts';
import type { LightEnvironment } from './light-environment.ts';
import { advanceWork,workProgress,setWorkUnits,WORK_FRACTIONS } from './work-progress.ts';
import { TemperatureView, reconcileTemperature, advanceTemperature } from './temperature.ts';
import { lightSources } from './light-sources.ts';
import { reconcilePlantLighting } from './plant-lighting.ts';
import { updatePlantTemperatures } from './thermal-plants.ts';
import { updateFoodTemperatures } from './thermal-food.ts';
import { applyBillCommand } from './cooking-commands.ts';
import { cookingCellReserved } from './cooking-bills.ts';
import {reconcileBillReservePauses289} from './bill-pause-289.ts';
import { burnFuel, refuelable, newBuildingFuel, isFueledBuilding } from './fuel.ts';
import { newMiniTurretState } from './mini-turret-state.ts';
import { reloadableTurret,draftTurretService } from './mini-turret-reload.ts';
import { setTurretHoldFire } from './mini-turret.ts';
import { bombDanger,captureBombDangerSources } from './bomb-danger.ts';
import { processHaul } from './hauling.ts';
import { initializeHydroponicBasin,advanceHydroponics,hydroponicCropAllowed } from './hydroponics.ts';
import { scheduleGrowing, cancelGrowingJobs, growingJobValid, finishSowing, jobDuration, growingZoneAt, resourceAt } from './farming.ts';
import { isPlant, harvestable,choppable,berryYield,plantCanYieldNow } from './plants.ts';
import { search, searchCandidates, destinationValid, planWork, type SearchBudget, type NavigationGrid } from './work-planner.ts';
import { workPriority,workType } from './work-types.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { releaseAssignments, planCommandDrops, commitDrop, releaseWork, type DropPlan } from './work-release.ts';
import {prepareLinkedStorageCommand286} from './linked-storage-plan-286.ts';
import {prepareLinkedStorageLogistics286} from './linked-storage-logistics-286.ts';
import { validDiningPlace } from './dining.ts';
import { CIVIL_TRANSIT_BLOCKERS, moveToward } from './travel.ts';
import { haulingWork } from './haul-aside.ts';
import { groundPile } from './ground-placement.ts';
import { generateWorld } from './generation.ts';
import { adjacent, blockedCells, cellIndex, inBounds } from './pathfinding.ts';
import { CARRY_CAPACITY, footprintCells, STRUCTURE_DEFINITIONS } from './definitions.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { constructionSkillRequired,constructionSupplied, validConstructionMaterial } from './construction-materials.ts';
import { refreshStock } from './materials.ts';
import { queryArea, validStorageSettings } from './designation.ts';
import { patchStockpilePolicy,stockpileZoneId,stockpileZoneCells,stockpileCellsByZoneId,zoneCellComponents } from './stockpile-zones.ts';
import { constructionLineCells, isLineBuildKind, type LineBuildKind } from './construction-line.ts';
import { processNeeds,processNeedsDecision300, updateNeeds } from './needs.ts';
export { HUNGER_PER_TICK, REST_PER_TICK } from './needs.ts';
import type { AreaCommand, BuildLineCommand, Cell, Command, CommandResult, DesignateCommand, Job, JobKind, Pawn, RefusalCode, StorageSettings, World } from './types.ts';
export { JOB_DURATION, JOB_WOOD_COST } from './definitions.ts';

const PATH_SEARCHES_PER_TICK = 8;
const JOB_LABEL: Readonly<Record<JobKind, string>> = {'ship-computer':'construction de l’ordinateur de vaisseau','ship-sensors':'construction de l’ensemble de capteurs','firefoam-popper':'construction du diffuseur de mousse','smooth-floor':'lissage du sol', 'ship-cryptosleep-casket':'construction du caisson spatial','ship-beam':'construction de poutre structurelle de vaisseau','ship-engine':'construction du moteur Johnson–Tanaka', 'ship-reactor':'construction du réacteur stellaire', 'cryptosleep-casket':'construction de caisson de cryptosommeil', 'fueled-smithy':'construction de forge à combustible','electric-smithy':'construction de forge électrique', brewery:'construction de brasserie','fermenting-barrel':'construction de fût de fermentation', 'geothermal-generator':'centrale géothermique',column:'construction de colonne',urn:'construction d’urne','stele-large':'construction de grande stèle','stele-grand':'construction de stèle monumentale',sarcophagus:'construction de sarcophage','torch-lamp':'construction de lampe-torche','build-bridge':'construction de pont','remove-bridge':'retrait de pont',vent:'construction de bouche d’aération','extract-tree':'extraction arbre','replant-tree':'replantation arbre', shelf:'construction d’étagère','small-shelf':'construction de petite étagère', 'spike-trap':'construction de piège à pointes', 'double-bed':'construction de lit double', 'electric-crematorium':'Construction du crématorium électrique','electric-smelter':'construction de fonderie électrique','sleeping-spot':'couchage au sol','animal-sleeping-spot':'emplacement de couchage animal', 'biofuel-refinery':'construction de raffinerie de biocarburant','chemfuel-generator':'construction de générateur à biocarburant', 'nutrient-paste-dispenser':'construction du distributeur de pâte nutritive',hopper:'construction de trémie', 'orbital-beacon':'construction de balise orbitale','comms-console':'construction de console de communication', 'deep-drill':'construction de foreuse profonde','ground-scanner':'construction du scanner souterrain', 'vitals-monitor':'construction du moniteur vital', 'drug-lab':'construction du laboratoire de chimie', 'hydroponics-basin':'construction du bac hydroponique', 'mini-turret':'construction de mini-tourelle', 'tube-television':'construction de télévision cathodique', sandbags:'construction de sacs de sable', autodoor:'construction de porte automatique', fence:'construction de clôture','fence-gate':'construction de portillon','pen-marker':'construction de marqueur d’enclos', 'art-bench':'construction de l’atelier de sculpture','small-sculpture':'petite sculpture','large-sculpture':'grande sculpture', 'machining-table':'construction de l’atelier d’usinage','fabrication-bench':'construction de l’établi de fabrication','hi-tech-research-bench':'construction du bureau de recherche haute technologie','multi-analyzer':'construction du multi-analyseur', grave:'creusement de tombe','lay-floor':'pose de sol','remove-floor':'retrait de sol',heater:'construction de radiateur','wind-turbine':'construction d’éolienne',flick:'commutation électrique','power-conduit':'construction de conduit','power-switch':'construction d’interrupteur',battery:'construction de batterie','solar-generator':'construction de panneau solaire', 'fueled-stove':'construction de cuisinière à bois','electric-stove':'construction de cuisinière électrique','butcher-table':'construction de table de boucherie', 'butcher-spot':'emplacement de boucherie', cooler:'construction de climatiseur', 'research-bench':'construction de bureau de recherche','tailor-bench':'construction d’établi de tailleur','electric-tailor-bench':'construction d’établi de tailleur électrique', 'crafting-spot':'emplacement d’artisanat', repair:'réparer', 'fix-breakdown':'remplacer un composant en panne', 'wood-generator':'construction de générateur à bois', 'sun-lamp':'construction de lampe horticole', 'standing-lamp':'construction de lampe sur pied', 'passive-cooler':'Construction du refroidisseur passif', 'build-roof':'pose de toit', 'remove-roof':'retrait de toit', door:'construction de porte', stonecutter:'construction de table de taille de pierre', mine:'minage', uninstall:'désinstallation', install:'réinstallation', deconstruct: 'déconstruction', chop: 'abattage', harvest: 'récolte', cut: 'coupe de plante', sow: 'semis', horseshoes: 'construction de piquet de fers à cheval', 'chess-table':'construction de table d’échecs', campfire: 'construction de feu de camp', wall: 'construction de mur', bedroll:'construction de sac de couchage', bed: 'construction de lit', 'hospital-bed':'construction de lit d’hôpital', table: 'construction de table','table-square':'construction de table carrée','table-long':'construction de table longue', stool: 'construction de tabouret','dining-chair':'construction de chaise',armchair:'construction de fauteuil','end-table':'construction de table de chevet',dresser:'construction de commode','flower-pot':'construction de pot de fleurs' };
const sameCell = (a: Cell, b: Cell): boolean => a.x === b.x && a.z === b.z;
const refusal = (code: RefusalCode, reason: string): CommandResult => ({ ok: false, code, reason });
function event(world: World, type: 'job' | 'need' | 'command', message: string): void {
  world.events.push({ tick: world.tick, type, message });
  if (world.events.length > 80) world.events.splice(0, world.events.length - 80);
}
export function createWorld(seed = 42, width = 32, height = 32): World { return generateWorld(seed, width, height); }

function wakePlanners(world: World): void {
  for (const pawn of world.pawns) if (pawn.jobId === null && pawn.haul === null) pawn.planCooldown = 0;
}

/** One authoritative command, evaluated against the state at execution, without
 * per-cell worker messages or repeated scans of every resource for every cell.
 */
const copyStorageConditions=(settings:StorageSettings)=>({
  ...(settings.allowFresh!==undefined?{allowFresh:settings.allowFresh}:{}),
  ...(settings.allowRotten!==undefined?{allowRotten:settings.allowRotten}:{}),
  ...(settings.quality!==undefined?{quality:{...settings.quality}}:{}),
  ...(settings.hitPoints!==undefined?{hitPoints:{...settings.hitPoints}}:{}),
});
/** The existing human provider retains its own work/clinical notifications;
 * new animal promises share its finite physical drop plan before any write. */
function applyAnimalAwareAreaCommand287(world:World,command:import('./types.ts').AllowedAreaCommand):CommandResult {
  type Combined={human:AreaInterruptionPlan;animal?:Extract<AnimalAreaCommandPhase287,{ok:true}>};
  return applyAllowedAreaCommand(world,command,{
    preflight(next,affected){
      const human=preflightAllowedAreaChange(world,next,affected);if(human===false)return false;
      if(!animalAreaHumanPhaseMutable287(world,affected,human.ids))return false;
      if(command.type!=='allowed-area-paint')return {human} satisfies Combined;
      const cells=next.allowedAreas?.find(a=>a.id===command.areaId)?.cells;
      if(!cells||!removalWritesMutable259([{object:world,key:'allowedAreas',present:true,value:next.allowedAreas}]))return false;
      const animal=prepareAnimalAreaCellsEdit287(world,{kind:'allowed',areaId:command.areaId},cells,human.drops);
      if(!animal.ok||!animal.begin()||!animal.adoptOwner())return false;
      return {human,animal} satisfies Combined;
    },
    reconcile(w,affected,plan){
      if(!plan){commitAllowedAreaChange(w,affected,undefined);return;}const prepared=plan as Combined;
      commitAllowedAreaChange(w,affected,prepared.human);
      if(prepared.animal&&!prepared.animal.adoptRuntime())throw Error('Admitted animal area painting failed');
    },
    prepareDelete(w,areaId){
      const mapId=registeredMapId(w);if(mapId===undefined||!removalWritesMutable259([{object:w,key:'allowedAreas',present:(w.allowedAreas?.length??0)>1,value:undefined}]))return false;
      if(!animalAreaHumanPhaseMutable287(w,w.pawns.filter(p=>p.allowedAreaId===areaId),new Set()))return false;
      const humans=prepareRemovedMapAreas(registeredCampaign(w),mapId,new Set([areaId]),false);
      for(const row of humans.updates){const p=row.pawn;
        const changesDictionary=p.mapAreas?.assignments.some(a=>a.mapId===mapId&&a.areaId===areaId);
        if(changesDictionary&&!removalWritesMutable259([{object:p,key:'mapAreas',present:true,value:undefined}]))return false;
        if(p.allowedAreaId===areaId&&!removalWritesMutable259([{object:p,key:'allowedAreaId',present:false},
          ...(p.allowedAreaReturn?[{object:p,key:'allowedAreaReturn',present:false},{object:p,key:'path',present:true,value:undefined},{object:p,key:'planCooldown',present:true,value:0},{object:p,key:'state',present:true,value:'idle'}]:[])]))return false;
      }
      const animal=prepareAnimalAreaDefinitionRemoval287(w,areaId);if(!animal.ok||!animal.begin())return false;return animal;
    },
    commitDelete(_w,plan){const animal=plan as Extract<AnimalAreaCommandPhase287,{ok:true}>;
      if(!animal.adoptOwner()||!animal.adoptRuntime())throw Error('Admitted animal area definition removal failed');},
  })!;
}
function applyAnimalHomeArea287(world:World,command:AreaCommand,selected:readonly number[],drops:DropPlan):CommandResult {
  const cells=new Set(world.home);for(const id of selected){if(command.action==='home')cells.add(id);else cells.delete(id);}
  const future=[...cells].sort((a,b)=>a-b),removed=new Set(command.action==='remove-home'?selected:[]);
  const jobs=new Set(world.jobs.filter(j=>j.fixBreakdown&&removed.has(j.z*world.width+j.x)).map(j=>j.id));
  const humans=world.pawns.filter(p=>p.jobId!==null&&jobs.has(p.jobId)||!!p.haul&&jobs.has(constructionHaulId(p.haul.destination)??-1));
  const delivered=world.piles.filter(p=>p.owner.type==='job'&&jobs.has(p.owner.jobId));
  const targets=[{object:world,key:'home',present:future.length>0,value:future},{object:world,key:'stock',present:true,value:undefined},{object:world,key:'jobs',present:true,value:undefined},
    ...delivered.map(p=>({object:p,key:'owner',present:true,value:undefined})),
    ...world.jobs.map(j=>({object:j,key:'escrow',present:true,value:undefined})),
    ...world.pawns.map(p=>({object:p.orders,key:'queue',present:true,value:undefined})),
    ...humans.flatMap(p=>['jobId','haul','path','planCooldown','state'].map(key=>({object:p,key,present:true,value:undefined})))];
  if(!removalWritesMutable259(targets)||!animalAreaHumanPhaseMutable287(world,humans,new Set(humans.map(p=>p.id)))||!animalAreaHomePhaseMutable287(world))return refusal('occupied','Les travaux concernés ne peuvent pas être libérés.');
  const animal=prepareAnimalAreaCellsEdit287(world,{kind:'home'},future,drops);
  if(!animal.ok)return refusal('occupied',animal.reason);if(!animal.begin()||!animal.adoptOwner())return refusal('occupied','Les détenteurs ont changé avant la peinture.');
  // All physical choices were admitted against the original common floor.
  for(const pawn of humans)if(!releaseWork(world,pawn,drops))throw Error('Admitted Home worker release failed');
  for(const pile of delivered){const owner=pile.owner,job=owner.type==='job'?world.jobs.find(j=>j.id===owner.jobId):undefined;
    if(!job||!commitDrop(world,pile,job,drops))throw Error('Admitted Home job material release failed');}
  if(jobs.size){world.jobs=world.jobs.filter(j=>!jobs.has(j.id));for(const pawn of world.pawns)pawn.orders.queue=pawn.orders.queue.filter(order=>typeof order!=='number'||!jobs.has(order));}
  if(future.length)world.home=future;else delete world.home;
  if(!animal.adoptRuntime())throw Error('Admitted Home animal phase failed');
  reconcileBreakdownJobs(world);reconcileRepairs(world);wakePlanners(world);refreshStock(world);
  event(world,'command',`Rectangle : ${selected.length} case(s) de foyer modifiée(s).`);
  return {ok:true,affected:selected.length};
}
function applyArea(world: World, command: AreaCommand, drops:DropPlan): CommandResult {
  if(command.action==='allow'||command.action==='forbid')return applyAreaMaterialPermission256(world,command);
  const selection = queryArea(world, command);
  if (!selection.ok) return selection;
  if (!selection.cells.length) return refusal('missing-target', 'Aucune case compatible dans ce rectangle.');
  if(isSchema287OrLater(Number(world.schemaVersion))&&(command.action==='home'||command.action==='remove-home'))return applyAnimalHomeArea287(world,command,selection.cells,drops);
  if(command.action==='cancel'){
    const cells=new Set(selection.cells);
    const jobs=new Set(world.jobs.filter(j=>[...footprintCells(j),...furnitureSourceCells(world,j)].some(c=>cells.has(c.z*world.width+c.x))).flatMap(j=>j.wallDoor296?.plan?[j.id,j.wallDoor296.plan.id]:[j.id]));
    const result=cancelIntentJobs(world,jobs);if(!result.ok)return result;
    const removed=clearPileHaulFlags(world,new Set(world.piles.filter(p=>p.owner.type==='ground'&&cells.has(p.owner.z*world.width+p.owner.x)).map(p=>p.id)));
    wakePlanners(world);refreshStock(world);return {ok:true,affected:jobs.size+removed,skipped:selection.skipped};
  }
  const creates = command.action === 'smooth-floor' || command.action === 'build-bridge' || command.action === 'remove-bridge' || command.action === 'lay-floor' || command.action === 'remove-floor' || command.action === 'mine' || command.action === 'deconstruct' || command.action === 'chop' || command.action === 'harvest' || command.action === 'cut' || command.action === 'stockpile' || command.action === 'growing';
  const deconstructionCells=command.action==='deconstruct'?new Set(selection.cells):undefined;
  const identities=deconstructionCells?world.structures.filter(s=>!['sleeping-spot','animal-sleeping-spot','crafting-spot','butcher-spot'].includes(s.kind)&&!world.jobs.some(j=>j.deconstruction?.structureId===s.id&&j.wallDoor296?.manual===false)&&footprintCells(s).some(c=>deconstructionCells.has(c.z*world.width+c.x))).length:command.action==='growing'?(selection.targetZoneId===undefined?zoneCellComponents(world.width,selection.cells).length:0):selection.cells.length;
  if (creates && !Number.isSafeInteger(world.nextId + identities)) return refusal('invalid-command', 'Limite des identités atteinte.');
  let affected = selection.cells.length;
  if(command.action==='snow-clear'||command.action==='remove-snow-clear'){editSnowArea(world,selection.cells,command.action==='snow-clear',drops);}else if(command.action==='home'||command.action==='remove-home'){const cells=new Set(world.home);for(const i of selection.cells)if(command.action==='home')cells.add(i);else cells.delete(i);world.home=[...cells].sort((a,b)=>a-b);if(!world.home.length)delete world.home;} else if (isRoofArea(command.action)) { designateRoofArea(world, selection.cells, command.action); } else if (command.action === 'deconstruct') {
    const selected = deconstructionCells!;
    const targets = world.structures.filter(s => footprintCells(s).some(c => selected.has(cellIndex(world,c.x,c.z))));
    for (const target of targets)if(target.kind==='sleeping-spot')removeHumanSleepingSpot(world,target,drops);else if(target.kind==='animal-sleeping-spot')removeAnimalSpot(world,target);else if((target.kind==='crafting-spot'||target.kind==='butcher-spot'))removeCraftingSpot(world,target,drops);else designateDeconstruction(world,target);
    affected = targets.length;
  } else if(command.action==='build-bridge'||command.action==='remove-bridge'){
    for(const index of selection.cells)world.jobs.push({id:world.nextId++,kind:command.action,x:index%world.width,z:Math.floor(index/world.width),orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},...(command.action==='build-bridge'?{construction:'blueprint' as const}:{})});
  } else if(command.action==='smooth-floor') {
    for(const index of selection.cells)world.jobs.push({id:world.nextId++,kind:'smooth-floor',x:index%world.width,z:Math.floor(index/world.width),orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}});
  } else if(command.action==='lay-floor'||command.action==='remove-floor') {
    for(const index of selection.cells)world.jobs.push({id:world.nextId++,kind:command.action,x:index%world.width,z:Math.floor(index/world.width),orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},...command.action==='lay-floor'?{construction:'blueprint',floor:command.floor}:{floor:world.tiles[index]!.floor}});
  } else if(command.action==='haul-chunks') {
    const selected=new Set(selection.cells);for(const p of world.piles)if(p.kind==='chunk'&&p.owner.type==='ground'&&selected.has(cellIndex(world,p.owner.x,p.owner.z)))p.haulRequested=true;
  } else if (command.action === 'mine' || command.action === 'chop' || command.action === 'harvest' || command.action === 'cut') {
    for (const index of selection.cells) world.jobs.push({ id: world.nextId++, kind: command.action, ...(world.schemaVersion>=235&&command.action!=='mine'?{plantTarget:{resourceId:world.resources.find(r=>r.x===index%world.width&&r.z===Math.floor(index/world.width))!.id}}:{}), x: index % world.width, z: Math.floor(index / world.width), orientation: 0, footprint: 'standard', status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } });
  } else if (command.action === 'growing') {
    const target=world.growingZones.find(zone=>zone.id===selection.targetZoneId);
    if(target)world.growingZones=world.growingZones.map(zone=>zone===target?{...zone,cells:[...zone.cells,...selection.cells].sort((a,b)=>a-b)}:zone);
    else world.growingZones=[...world.growingZones,...zoneCellComponents(world.width,selection.cells).map(cells=>({id:world.nextId++,cells,plant:'rice' as const,allowSow:true,allowCut:true}))];
  } else if (command.action === 'remove-growing') {
    const selected = new Set(selection.cells);
    const changed = new Set(world.growingZones.filter(zone => zone.cells.some(c => selected.has(c))).map(z => z.id));
    cancelGrowingJobs(world, changed,drops);
    world.growingZones = world.growingZones.map(zone => ({...zone, cells: zone.cells.filter(c => !selected.has(c))})).filter(z => z.cells.length);
    world.growingCursor = 0;
  } else if (command.action === 'stockpile') {
    const target=selection.targetZoneId===undefined?undefined:stockpileCellsByZoneId(world,selection.targetZoneId)[0];
    const settings=target??command;
    for(const cells of zoneCellComponents(world.width,selection.cells)){
      const zoneId=target?stockpileZoneId(target):world.nextId;
      for(const index of cells)world.stockpiles.push({id:world.nextId++,zoneId,x:index%world.width,z:Math.floor(index/world.width),filters:{...(settings.filters??{wood:true,food:true,...(world.schemaVersion>=265?{wort:true,beer:true}:{}),...((Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?{book:true}:{})})},...(settings.items!==undefined?{items:{...settings.items}}:{}),...copyStorageConditions(settings),priority:settings.priority??2,capacity:settings.capacity??ITEM_DEFINITIONS.silver.stackLimit});
    }
  } else {
    const cells = new Set(selection.cells);
    if (command.action === 'remove-stockpile') {
      const ids = new Set(world.stockpiles.filter(cell => cells.has(cellIndex(world, cell.x, cell.z))).map(cell => cell.id));
      const carriers = new Set(world.pawns.filter(pawn => pawn.haul?.destination.type === 'stockpile' && ids.has(pawn.haul.destination.stockpileId)).map(pawn => pawn.id));
      const returning = world.piles.filter(pile => pile.owner.type === 'pawn' && carriers.has(pile.owner.pawnId)).length;
      if (!Number.isSafeInteger(world.nextId + returning)) return refusal('invalid-command', 'Identités insuffisantes pour déposer les cargaisons.');
      world.stockpiles = world.stockpiles.filter(cell => !ids.has(cell.id));
      for(const pawn of world.pawns)if(pawn.cooking?.storageId&&ids.has(pawn.cooking.storageId)){pawn.cooking.storageId=null;delete pawn.cooking.storageQuantity;pawn.path=[];pawn.planCooldown=0;}
      for (const pawn of world.pawns) if (pawn.haul?.destination.type === 'stockpile' && ids.has(pawn.haul.destination.stockpileId)) releaseWork(world, pawn,drops);
      interruptAnimalStorage282(world,ids);
    } else {
      const jobs = world.jobs.filter(job => [...footprintCells(job),...furnitureSourceCells(world,job)].some(cell => cells.has(cellIndex(world, cell.x, cell.z))));
      const ids = new Set(jobs.map(job => job.id)); affected = ids.size;
      const carriers = new Set(world.pawns.filter(pawn => pawn.haul && ids.has(constructionHaulId(pawn.haul.destination) ?? -1)).map(pawn => pawn.id));
      const returning = world.piles.filter(pile => (pile.owner.type === 'job' && ids.has(pile.owner.jobId)) || (pile.owner.type === 'pawn' && carriers.has(pile.owner.pawnId))).length;
      // Reserve an upper bound before releasing any owner. Deposits may merge,
      // but exhausting IDs must never leave a partly removed construction/cargo.
      if (!Number.isSafeInteger(world.nextId + returning)) return refusal('invalid-command', 'Identités insuffisantes pour conserver les matériaux annulés.');
      for (const pawn of world.pawns) if ((pawn.jobId !== null && ids.has(pawn.jobId)) || (pawn.haul && ids.has(constructionHaulId(pawn.haul.destination) ?? -1))) releaseWork(world, pawn,drops);
      world.jobs = world.jobs.filter(job => !ids.has(job.id));
      const delivered = world.piles.filter(pile => pile.owner.type === 'job' && ids.has(pile.owner.jobId));
      const byId = new Map(jobs.map(job => [job.id, job]));
      for (const pile of delivered) if (pile.owner.type === 'job' && !commitDrop(world,pile,byId.get(pile.owner.jobId)!,drops)) throw new Error('Preflighted cancellation has no drop cell.');
    }
  }
  wakePlanners(world); refreshStock(world);
  event(world, 'command', `Rectangle : ${affected} ${command.action === 'remove-stockpile' ? 'case(s) de réserve retirée(s)' : command.action === 'stockpile' ? 'case(s) de réserve créée(s)' : command.action==='home'||command.action==='remove-home'?'case(s) de foyer modifiée(s)':command.action==='deconstruct' ? 'ordre(s) de déconstruction créé(s)' : isRoofArea(command.action) ? 'case(s) de toiture désignée(s)' : 'ordre(s) de collecte créé(s)'}.`);
  return { ok: true, affected, skipped: selection.skipped };
}

/** One ordered worker command for a straight construction stroke. Each cell is
 * rechecked against the world left by preceding cells, just like separate clicks.
 */
function applyBuildLine(world: World, command: BuildLineCommand): CommandResult {
  if (!isLineBuildKind(command.kind) || !command.from || !command.to
    || !inBounds(world, command.from.x, command.from.z) || !inBounds(world, command.to.x, command.to.z)
    || !validConstructionMaterial(command.kind, command.material, world.schemaVersion))
    return refusal('invalid-command', 'Tracé ou matériau de construction invalide.');
  const cells = constructionLineCells(command.from, command.to);
  if (!Number.isSafeInteger(world.nextId + cells.length)) return refusal('invalid-command', 'Limite des identités atteinte.');
  let affected = 0;
  for (const cell of cells) {
    const result = applyCommandInternal(world, { type: 'designate', kind: command.kind, ...cell,
      orientation: 0, ...(command.material ? { material: command.material } : {}) });
    if (result.ok) affected++;
  }
  if (!affected) return refusal('missing-target', 'Aucune case compatible sur ce tracé.');
  return { ok: true, affected, skipped: cells.length - affected };
}

/** Generated sowing work is an AI intention, not a placed blueprint. A
 * no-zone construction will retire its generating zone through the shared path. */
function constructionRetiresSowingIntent(job:Job,kind:JobKind|import('./types.ts').StructureKind):boolean {
  return job.kind==='sow'&&job.growingZoneId!==undefined&&occupancyOf(kind)?.zones===false;
}

/** Snapshot-local spatial index for repeated line previews. It is never saved or
 * reused after a World mutation; canDesignate remains the common authority. */
export interface ConstructionCellIndex { kind: LineBuildKind; flags: Uint8Array }
export function buildConstructionCellIndex(world: World, kind: LineBuildKind): ConstructionCellIndex {
  const flags=new Uint8Array(world.width*world.height);
  const mark=(cell:Cell,bit:number)=>{if(inBounds(world,cell.x,cell.z))flags[cellIndex(world,cell.x,cell.z)]!|=bit;};
  for(const job of world.jobs)if(!isRoofJob(job)&&!isPlantDesignationJob(job)&&!constructionRetiresSowingIntent(job,kind)&&sharesConstructionLayer(job.furniture?.kind??job.deconstruction?.kind??job.flick?.kind??job.fixBreakdown?.kind??job.kind,kind))
    for(const cell of footprintCells(job))mark(cell,1);
  for(const structure of world.structures)if(sharesConstructionLayer(structure.kind,kind))
    for(const cell of footprintCells(structure))mark(cell,2);
  for(const resource of world.resources)if(resource.kind==='rock')mark(resource,4);
  return {kind,flags};
}

/** Pure shared rule used by preview and command execution. */
export function canDesignate(world: World, command: DesignateCommand|import('./cave-glowpod-minification-256.ts').NaturalInstallPlan256, installing=false, index?:ConstructionCellIndex): CommandResult {
  if(command&&isShipComputerSensorsKind298(command.kind)){
    if(installing||!isSchema298OrLater(Number(world.schemaVersion))||!victoryResearchUnlocked298(world,command.kind))return refusal('invalid-command','Recherchez cette pièce fixe du vaisseau avant de la construire.');
    if((command.orientation??0)!==0||command.material!==undefined&&command.material!=='steel')return refusal('invalid-command','Cette pièce fixe utilise son orientation et ses matériaux propres.');
    const reason=shipComputerSensorsPlacementRefusal298(world,{...command,kind:command.kind,orientation:0});if(reason)return refusal('occupied',reason);
  }
  if(command?.kind==='firefoam-popper')return canPlaceFirefoamPopper290(world,command as DesignateCommand,installing);
  if(command&&isShipPartKind276(command.kind)&&command.orientation===undefined)command={...command,orientation:SHIP_PART_DEFAULT_ORIENTATION_276[command.kind]};
  if(command&&isShipAddedKind276(command.kind)){if(installing||!isSchema276OrLater(world.schemaVersion)||!(command.kind==='ship-beam'?shipBasicsUnlocked275(world):shipEngineUnlocked276(world)))return refusal('invalid-command',command.kind==='ship-beam'?'Recherchez Construction de vaisseau pour construire cette poutre fixe.':'Recherchez Moteur Johnson–Tanaka pour construire ce moteur fixe.');const reason=shipPartPlacementRefusal276(world,{...command,kind:command.kind});if(reason)return refusal('occupied',reason);}
  if(command?.kind==='ship-cryptosleep-casket'){
    if(installing||!isSchema277OrLater(world.schemaVersion)||!shipCryptosleepUnlocked277(world))return refusal('invalid-command','Recherchez Cryptosommeil spatial pour construire ce caisson fixe.');
    command={...command,orientation:command.orientation??2};
    const reason=shipCasketPlacementRefusal277(world,{x:command.x,z:command.z,orientation:command.orientation});if(reason)return refusal('invalid-command',reason);
  }
  if(command?.kind==='ship-reactor'){if(installing||!shipReactorUnlocked275(world))return refusal('invalid-command','Recherchez Réacteur stellaire pour construire cet édifice fixe.');const reason=shipReactorPlacementRefusal275(world,command);if(reason)return refusal('occupied',reason);}
  if(command&&inBounds(world,command.x,command.z)&&command.kind!=='mine'&&foggedCell256(world,cellIndex(world,command.x,command.z)))return refusal('missing-target','Cette cellule n’est pas encore découverte.');
  if(isCaveHiveKind256(command?.kind)&&(!installing||command.kind!=='glow-pod'||!isSchema256Or257(world.schemaVersion)||command.orientation!==0))return refusal('invalid-command','Cet édifice naturel est généré ; seul son vrai paquet peut être réinstallé.');
  if(isLocalRoadProp256(command?.kind)||isShipChunk256(command?.kind))return refusal('invalid-command','Cet édifice routier est un vestige généré, sans commande de construction.');
  if(command&&Object.hasOwn(command,'bridge'))return refusal('invalid-command','La fondation est un état de terrain, pas un champ de commande.');
  if(command?.kind==='build-bridge'||command?.kind==='remove-bridge')return canDesignateBridge(world,command);
  if(command&&Object.hasOwn(STRUCTURE_DEFINITIONS,command.kind)&&!marshSupportsFootprint(world,footprintCells(command),{kind:command.kind,material:installing?command.material:command.material??'wood'}))return refusal('incompatible-resource','Le terrain ou le pont léger ne porte pas cette construction.');
  if((command?.kind==='orbital-beacon'||command?.kind==='comms-console')&&(world.schemaVersion<216||command.kind==='comms-console'&&installing||!installing&&!microelectronicsUnlocked(world)))return refusal('invalid-command','Recherchez Microélectronique pour construire cet appareil ; la console ne se désinstalle pas.');
  if(command?.kind==='deep-drill'&&(world.schemaVersion<215||!installing&&!deepDrillingUnlocked(world)))return refusal('invalid-command','Recherchez Forage profond pour construire une foreuse.');
  if(command?.kind==='ground-scanner'&&(world.schemaVersion<215||installing||!groundScannerUnlocked(world)))return refusal('invalid-command','Recherchez Scanner souterrain pour construire cet appareil non déplaçable.');
  if(command?.kind==='ground-scanner'&&footprintCells({...command,orientation:command.orientation??0,footprint:'standard'}).some(c=>isRoofed(world,c.z*world.width+c.x)))return refusal('invalid-command','Le scanner doit être installé à ciel ouvert.');
  if(command?.kind==='vitals-monitor'&&(world.schemaVersion<211||!installing&&!vitalsMonitorUnlocked(world)))return refusal('invalid-command','Recherchez Moniteur vital pour construire cet appareil.');
  if(command?.kind==='smooth-floor'){if(command.material!==undefined||command.floor!==undefined||command.targetId!==undefined||command.orientation!==undefined&&command.orientation!==0)return refusal('invalid-command','Ordre de lissage invalide.');return canDesignateSmoothFloor281(world,command);}
  if(command?.kind==='lay-floor'||command?.kind==='remove-floor')return canDesignateFloor(world,command);
  if(command&&isShelfKind(command.kind)&&world.schemaVersion<229)return refusal('invalid-command','L’étagère nécessite le format courant.');
  if(command?.kind==='spike-trap')return canPlaceSpikeTrap(world,command);
  if(command?.kind==='electric-crematorium'&&world.schemaVersion<225)return refusal('invalid-command','Le crématorium nécessite le format courant.');
  if(command?.kind==='electric-smelter'&&world.schemaVersion<222)return refusal('invalid-command','La fonderie nécessite le format courant.');
  if((command?.kind==='biofuel-refinery'||command?.kind==='chemfuel-generator')&&(world.schemaVersion<218||installing||command.kind==='biofuel-refinery'&&!biofuelRefiningUnlocked(world)))return refusal('invalid-command','Recherchez Raffinage de biocarburant pour la raffinerie ; ces appareils ne se désinstallent pas.');
  if((command?.kind==='nutrient-paste-dispenser'||command?.kind==='hopper')&&(world.schemaVersion<217||installing||!nutrientPasteUnlocked(world)))return refusal('invalid-command','Recherchez Pâte nutritive pour construire ces appareils ; désinstallation indisponible.');
  if(command?.kind==='drug-lab'&&(world.schemaVersion<206||!installing&&!drugProductionUnlocked(world)))return refusal('invalid-command','Recherchez Production de drogues pour construire ce laboratoire.');
  if(command?.kind==='hydroponics-basin'&&(world.schemaVersion<203||installing||!hydroponicsUnlocked(world)))return refusal('invalid-command','Recherchez Hydroponie pour construire ce bac ; désinstallation indisponible.');
  if(command?.kind==='battery'&&!batteriesUnlocked(world))return refusal('invalid-command','Recherchez Batteries pour construire cet appareil.');
  if((command?.kind==='fueled-smithy'||command?.kind==='electric-smithy')&&(world.schemaVersion<267||!installing&&!smithyConstructionUnlocked267(world)))return refusal('invalid-command','Recherchez Forge pour construire ce bâtiment.');
  if((command?.kind==='brewery'||command?.kind==='fermenting-barrel')&&!installing&&!brewingUnlocked(world))return refusal('invalid-command','Recherchez Brassage pour construire ce bâtiment.');
  if(command?.kind==='geothermal-generator'){if(installing||!geothermalPowerUnlocked(world))return refusal('invalid-command','Recherchez Géothermie pour construire cette centrale fixe.');const reason=geothermalPlacementRefusal264(world,command);if(reason)return refusal('occupied',reason);}
  if(command?.kind==='solar-generator'&&!solarPowerUnlocked(world))return refusal('invalid-command','Recherchez Panneaux solaires pour construire cet appareil.');
  if(command?.kind==='vent'&&(world.schemaVersion<244||!complexFurnitureUnlocked(world)))return refusal('invalid-command','Recherchez Mobilier complexe pour construire une bouche d’aération.');
  if(command?.kind==='cooler'&&!airConditioningUnlocked(world))return refusal('invalid-command','Recherchez Climatisation pour construire cet appareil.');
  if(command?.kind==='machining-table'&&!machiningUnlocked(world))return refusal('invalid-command','Recherchez Usinage pour construire cet atelier.');
  if(command?.kind==='hi-tech-research-bench'&&!microelectronicsUnlocked(world))return refusal('invalid-command','Recherchez Microélectronique pour construire ce bureau.');
  if(command?.kind==='multi-analyzer'&&!multiAnalyzerUnlocked(world))return refusal('invalid-command','Recherchez Multi-analyseur pour construire cet appareil.');
  if(command?.kind==='fabrication-bench'&&!fabricationUnlocked(world))return refusal('invalid-command','Recherchez Fabrication pour construire cet établi.');
  if(command?.kind==='cryptosleep-casket'&&(!isSchema271OrLater(world.schemaVersion)||installing||!cryptosleepUnlocked271(world)))return refusal('invalid-command','Recherchez Cryptosommeil pour construire ce caisson ; il ne se transporte pas en paquet.');
  if(command?.kind==='autodoor'&&!autodoorsUnlocked(world))return refusal('invalid-command','Recherchez Portes automatiques pour construire cette porte.');
  if(command?.kind==='mini-turret'&&(world.schemaVersion<193||installing||!gunTurretsUnlocked(world)))return refusal('invalid-command','Recherchez Tourelles automatiques pour construire cet appareil ; minification indisponible.');
  if(command?.kind==='tube-television'&&(world.schemaVersion<190||!installing&&!tubeTelevisionUnlocked(world)))return refusal('invalid-command','Recherchez Télévision cathodique pour construire cet appareil.');
  if(command?.kind==='sandbags'&&world.schemaVersion<189)return refusal('invalid-command','Sacs de sable absents de cet ancien schéma.');
  if(command?.kind==='hospital-bed'&&(world.schemaVersion<187||!installing&&!hospitalBedUnlocked(world)))return refusal('invalid-command','Recherchez Lit d’hôpital pour construire ce lit.');
  if((command?.kind==='tailor-bench'||command?.kind==='electric-tailor-bench')&&!clothingUnlocked(world))return refusal('invalid-command','Recherchez Vêtements complexes pour construire cet établi.');
  if(command&&(command.kind==='stele-large'||command.kind==='stele-grand')&&!complexFurnitureUnlocked(world))return refusal('invalid-command','Recherchez Mobilier complexe pour construire cette stèle.');
  if(command&&isAncientMonumentKind256(command.kind)&&command.kind!=='sarcophagus'&&command.orientation!==undefined&&command.orientation!==0)return refusal('invalid-command','Cet ouvrage ne se tourne pas.');
  if(command&&isHabitatFurnitureKind(command.kind)&&FURNITURE_DEFINITIONS[command.kind].research==='complex-furniture'&&!complexFurnitureUnlocked(world))return refusal('invalid-command','Recherchez Mobilier complexe pour construire ce meuble.');
  if(command?.kind==='sleeping-spot')return installing?refusal('invalid-command','Cet emplacement ne se transporte pas.'):canPlaceHumanSleepingSpot(world,command);
  if(command?.kind==='animal-sleeping-spot')return installing?refusal('invalid-command','Cet emplacement ne se transporte pas.'):canPlaceAnimalSpot(world,command);
  if(command?.kind==='torch-lamp'&&(world.schemaVersion<249||installing))return refusal('invalid-command','La lampe-torche exige le schéma 249 et ne se transporte pas en paquet.');
  if (!command || ![...(world.schemaVersion>=256?ANCIENT_MONUMENT_KINDS_256:[]),'ship-computer','ship-sensors','ship-beam','ship-engine','ship-reactor','ship-cryptosleep-casket','cryptosleep-casket','fueled-smithy','electric-smithy','brewery','fermenting-barrel','geothermal-generator','torch-lamp','vent','shelf','small-shelf',...(installing?['glow-pod','small-sculpture','large-sculpture']:[]),'spike-trap','electric-crematorium','electric-smelter','biofuel-refinery','chemfuel-generator','nutrient-paste-dispenser','hopper','orbital-beacon','comms-console','deep-drill','ground-scanner','vitals-monitor','drug-lab','hydroponics-basin','mini-turret','tube-television','sandbags','art-bench','machining-table','hi-tech-research-bench','multi-analyzer','fabrication-bench','grave','heater','wind-turbine','power-conduit','power-switch','battery','solar-generator','fueled-stove','electric-stove','butcher-table','butcher-spot','cooler','research-bench','tailor-bench','electric-tailor-bench','crafting-spot','wood-generator','sun-lamp','standing-lamp','passive-cooler','door','autodoor','fence','fence-gate','pen-marker','stonecutter', 'mine', 'uninstall', 'deconstruct', 'chop', 'harvest', 'cut', 'wall', 'bedroll', 'bed', 'double-bed', 'hospital-bed', 'table','table-square','table-long', 'stool','dining-chair','armchair','end-table','dresser','flower-pot', 'campfire', 'horseshoes', 'chess-table'].includes(command.kind)) return refusal('invalid-command', 'Type de travail inconnu.');
  if((command.kind==='torch-lamp'||command.kind==='sandbags'||isRoomDoor(command.kind)||command.kind==='fence-gate'||command.kind==='pen-marker'||command.kind==='passive-cooler'||isElectrical(command.kind)&&!isShipPartKind276(command.kind)&&command.kind!=='ship-cryptosleep-casket'&&command.kind!=='electric-smithy'&&command.kind!=='electric-crematorium'&&command.kind!=='electric-smelter'&&command.kind!=='biofuel-refinery'&&command.kind!=='nutrient-paste-dispenser'&&command.kind!=='comms-console'&&command.kind!=='deep-drill'&&command.kind!=='ground-scanner'&&command.kind!=='vitals-monitor'&&command.kind!=='hydroponics-basin'&&command.kind!=='tube-television'&&command.kind!=='machining-table'&&command.kind!=='hi-tech-research-bench'&&command.kind!=='fabrication-bench'&&command.kind!=='cooler'&&command.kind!=='electric-stove'&&command.kind!=='battery'&&command.kind!=='wind-turbine')&&command.orientation!==undefined&&command.orientation!==0)return refusal('invalid-command','Ce bâtiment ne se tourne pas manuellement.');
  if (command.orientation !== undefined && (!Number.isInteger(command.orientation) || command.orientation < 0 || command.orientation > 3)) return refusal('invalid-command', 'Orientation invalide.');
  const material=command.kind==='torch-lamp'?(command.material??'wood'):command.kind==='electric-crematorium'?(command.material??'granite-blocks'):command.kind==='sandbags'?(command.material??'cloth'):command.kind==='firefoam-popper'||isShipComputerSensorsKind298(command.kind)||isShipPartKind276(command.kind)||command.kind==='ship-cryptosleep-casket'||command.kind==='cryptosleep-casket'||command.kind==='geothermal-generator'||command.kind==='electric-smelter'||command.kind==='biofuel-refinery'||command.kind==='chemfuel-generator'||command.kind==='nutrient-paste-dispenser'||command.kind==='hopper'||command.kind==='orbital-beacon'||command.kind==='comms-console'||command.kind==='deep-drill'||command.kind==='ground-scanner'||command.kind==='vitals-monitor'||command.kind==='hydroponics-basin'||command.kind==='mini-turret'||command.kind==='hospital-bed'||command.kind==='tube-television'?(command.material??'steel'):command.material;
  if(!validConstructionMaterial(command.kind,material,world.schemaVersion))return refusal('invalid-command','Matériau incompatible avec cette construction.');
  if(command.kind==='vent'&&!ventPlacementAllowed(world,command))return refusal('occupied','Les deux faces de la bouche doivent être dégagées. Déconstruisez d’abord tout mur dans son empreinte.');
  if(command.kind==='cooler'){const faces=coolerFaces(command);if(coolerFaceBlocked(world,faces.cold,true)||coolerFaceBlocked(world,faces.hot,true))return refusal('occupied','Les faces froide et chaude doivent rester dégagées.');}
  if(command.kind==='extract-tree'||command.kind==='replant-tree'){const reason=command.kind==='extract-tree'?extractTreeReason(world,world.resources.find(r=>r.id===command.targetId)):replantTreeReason(world,world.piles.find(p=>p.id===command.targetId),command);return reason?refusal('incompatible-resource',reason):{ok:true};}
  if(['chop','cut','harvest'].includes(command.kind)){const resource=world.resources.find(r=>command.targetId!==undefined?r.id===command.targetId:sameCell(r,command));if(world.jobs.some(j=>isPlantDesignationJob(j)&&sameCell(j,command)))return refusal('occupied','Une plante possede deja cet ordre.');return resource&&sameCell(resource,command)&&(command.kind==='chop'?choppable(world,resource):isPlant(resource)||world.schemaVersion>=235&&command.kind==='cut'&&resource.kind==='tree')&&(command.kind!=='harvest'||harvestable(world,resource))?{ok:true}:refusal('incompatible-resource','Ressource incompatible.');}
  if(command.targetId!==undefined&&(!Number.isSafeInteger(command.targetId)||command.targetId<1||command.kind!=='deconstruct'&&command.kind!=='uninstall'))return refusal('invalid-command','Cible de retrait invalide.');
  const target = (command.kind==='deconstruct'||command.kind==='uninstall')?deconstructionAt(world,command):undefined;
  if((command.kind==='deconstruct'||command.kind==='uninstall')&&!target)return refusal('missing-target','Aucun bâtiment à déconstruire ici.');
  if(target&&command.kind==='deconstruct'&&!roadPropCanDeconstruct256(world,target))return refusal('invalid-command','Ce vestige ne peut pas être déconstruit par cette faction.');
  if(target&&world.jobs.some(j=>j.furniture?.structureId===target.id))return refusal('occupied','Ce meuble a déjà un ordre de déplacement.');
  if(target&&command.kind==='uninstall'&&!targetBuildingPlayerUse263(world,target))return refusal('invalid-command','Ce meuble doit être réellement revendiqué avant sa minification.');
  if(command.kind==='uninstall'&&(!minifiable(target!.kind)||target!.kind==='flower-pot'&&!flowerPotCanUninstall(target!.flower??createFlowerPotState())))return refusal('incompatible-resource','Coupez la plante avant de désinstaller ce pot.');
  const cells = footprintCells(target??command);
  if (cells.some(cell => !inBounds(world, cell.x, cell.z))) return refusal('out-of-bounds', 'Empreinte hors de la carte.');
  if(command.kind==='hopper'){
    if(world.stockpiles.some(zone=>sameCell(zone,command)))return refusal('occupied','La trémie possède son propre stockage : retirez la réserve de cette cellule.');
    if(![...world.structures,...world.jobs].some(s=>s.kind==='nutrient-paste-dispenser'&&footprintCells(s).some(cell=>Math.abs(cell.x-command.x)+Math.abs(cell.z-command.z)===1)))return refusal('incompatible-resource','Placez la trémie contre un bord du distributeur ou de son plan.');
  }
  if(command.kind==='grave'&&world.jobs.some(j=>j.kind==='lay-floor'&&cells.some(c=>sameCell(c,j))))return refusal('occupied','Un plan de sol occupe la future tombe.');
  if(command.kind==='grave'&&cells.some(c=>{const tile=world.tiles[cellIndex(world,c.x,c.z)]!;return !!tile.floor||!['grass','soil','rich-soil','gravel'].includes(tile.terrain);}))return refusal('incompatible-resource','La tombe exige un terrain meuble à creuser.');
  const replacing=installing||command.kind==='glow-pod'?undefined:wallBlueprintForDoor(world,command);
  const wallTarget=installing?undefined:wallDoorTarget296(world,command.kind,command);
  const wallRemoval=wallTarget?wallDoorRemoval296(world,wallTarget):command.kind==='deconstruct'&&target?wallDoorRemoval296(world,target):undefined;
  const allowedRemoval=wallTarget?wallRemoval:wallRemoval?.wallDoor296?.manual===false?wallRemoval:undefined;
  if (!replacing&&index?.kind===command.kind ? cells.some(cell=>!!(index.flags[cellIndex(world,cell.x,cell.z)]!&1))
    : world.jobs.some(job => job!==replacing && job!==allowedRemoval && !isRoofJob(job) && !isPlantDesignationJob(job) && !constructionRetiresSowingIntent(job,target?.kind??command.kind) && !(command.kind==='deconstruct'&&(job.kind==='repair'||job.kind==='fix-breakdown'||job.kind==='flick')) && sharesConstructionLayer(job.furniture?.kind??job.deconstruction?.kind??job.flick?.kind??job.fixBreakdown?.kind??job.kind,target?.kind??command.kind) && footprintCells(job).some(cell => cells.some(target => sameCell(cell, target))))) return refusal('occupied', 'Un ordre existe déjà dans cette empreinte.');
  if(command.kind==='deconstruct'||command.kind==='uninstall')return {ok:true};
  if(isAncientMonumentKind256(command.kind)&&!validConstructionMaterial(command.kind,command.material,world.schemaVersion))return refusal('invalid-command','Choisissez une matière admissible explicite pour cet ouvrage.');
  if(command.kind==='mine')return blindMineDesignation256(world,cellIndex(world,command.x,command.z))||world.tiles[cellIndex(world,command.x,command.z)]!.terrain==='rock'?{ok:true}:refusal('incompatible-resource','Désigner un massif rocheux à miner.');
  if((command.kind==='crafting-spot'||command.kind==='butcher-spot')&&world.resources.some(r=>sameCell(r,command)&&!isConstructionLightPlant(r)))return refusal('occupied','Dégager la plante avant de placer cet emplacement.');
  if (command.kind === 'chop' || command.kind === 'harvest' || command.kind === 'cut') {
    const resource = world.resources.find(candidate => sameCell(candidate, command));
    return resource && (command.kind === 'chop' ? choppable(world,resource) : isPlant(resource)) && (command.kind !== 'harvest' || harvestable(world, resource)) ? { ok: true } : refusal('incompatible-resource', 'Ressource incompatible.');
  }
  for (const cell of cells) {
    if ((['water', 'rock'].includes(world.tiles[cellIndex(world, cell.x, cell.z)]!.terrain)||!marshSupportsFootprint(world,[cell],{kind:command.kind,material:installing?command.material:command.material??'wood'}))
      || (index?.kind===command.kind ? !!(index.flags[cellIndex(world,cell.x,cell.z)]!&4) : world.resources.some(item => item.kind==='rock'&&sameCell(item, cell)))
      || (index?.kind===command.kind ? !!(index.flags[cellIndex(world,cell.x,cell.z)]!&2) : world.structures.some(item => item!==wallTarget&&sharesConstructionLayer(item.kind,command.kind)&&footprintCells(item).some(target => sameCell(target, cell))))
      || world.pawns.some(p => p.haul?.destination.type === 'aside' && sameCell(p.haul.destination, cell))
      || cookingCellReserved(world,cell)) {
      return refusal('occupied', 'Construction impossible : terrain, ouvrage ou réservation incompatible dans l’empreinte.');
    }
  }
  if(replacing&&command.kind!=='glow-pod'){
    if(!Number.isSafeInteger(world.nextId+1))return refusal('invalid-command','Limite des identités atteinte.');
    if(!planBlueprintDoorReplacement(world,command,replacing))return refusal('occupied','Attendez la fin du transport et une place pour déposer les matériaux du mur.');
  }
  if(wallTarget&&(command.kind==='door'||command.kind==='autodoor')&&!canAttachWallDoor296(world,wallTarget,command.kind,command.material??'wood'))return refusal('occupied','Le mur, ses ordres ou la limite des identités ne permettent pas ce plan de porte.');
  return { ok: true };
}
export function applyCommand(world: World, command: Command,caravans?:import('./group-campaign-runtime-256.ts').GroupCampaignRuntime256): CommandResult {
 if(isCorePhysicalSchema297(Number(world.schemaVersion)))invalidateCoreCampaign297(campaignAuthority(world),'command');
 const tradeType=command&&typeof command==='object'?Object.getOwnPropertyDescriptor(command,'type'):undefined;
 if(tradeType&&'value'in tradeType&&typeof tradeType.value==='string'&&tradeType.value.startsWith('trade-request-'))return applyTradeRequestCommand284(world,command);
 if(world.worldMaps){const descriptor=command&&typeof command==='object'&&!Array.isArray(command)?Object.getOwnPropertyDescriptor(command,'type'):undefined;if(!descriptor||!('value'in descriptor)||typeof descriptor.value!=='string')return refusal('invalid-command','Commande invalide.');const root=registeredCampaign(world);if(validCaravanArrivalCommand261(command,Number(world.schemaVersion)))return applyCaravanArrivalCommand261(root,command);if(validCaravanCommand261(command)){const result=applyCaravanCommand261(root,command);if(result.ok)caravans?.encounterChanged261(root,command.groupId);return result;}if(validWorldMapCommand(command))return applyWorldMapCommand(root,command);if(command&&typeof command==='object'&&typeof command.type==='string'&&(command.type==='planet-adopt'||command.type.startsWith('group-')))return applyRegisteredGroupCommand(root,command as import('./group-state.ts').GroupCommand,caravans);if(secondaryCommand(command))return refusal('invalid-command','Choisissez une carte ou un groupe du registre de campagne.');const local=selectedRegisteredMap(root);if(!local)return refusal('invalid-command','Aucune carte locale sélectionnée.');const result=applyLocalCommand(local,command);if(result.ok&&command.type==='commercial-start'){const source=root.worldMaps!.sites.find(s=>s.id===registeredMapId(local))!;if(root.worldGroups!.canonicalPostId===null)delete source.postId;else source.postId=root.worldGroups!.canonicalPostId;}if(result.ok)observeAcceptedConsoleCommand298(local,command);flushRegisteredMap(local);return result;}
  if(!command||typeof command!=='object')return refusal('invalid-command','Commande invalide.');
  if(secondaryCommand(command))return applySecondarySiteCommand(world,command);
  const root=campaignAuthority(world);
  if(!isSecondaryContext(world)&&root.secondarySite?.visit&&/^(scout-|commercial-)/.test(command.type))return {ok:false,code:'invalid-command',reason:'Terminez l’expédition du second site avant un autre voyage.'};
  const local=isSecondaryContext(world)?world:selectedMap(world);
  const result=applyLocalCommand(local,command);
  if(result.ok)observeAcceptedConsoleCommand298(local,command);
  if(isSecondaryContext(local))flushSecondaryContext(local);
  return result;
}
function observeAcceptedConsoleCommand298(world:World,command:Command):void {
 if(!isSchema298OrLater(Number(world.schemaVersion)))return;
 const owner=coreState297(world).contacts!;
 if('pawnId'in command&&typeof command.pawnId==='number'){const slot=world.pawns.findIndex(p=>p.id===command.pawnId);if(slot>=0)owner.observeCommandPawn(world.pawns[slot]!,slot,effectiveCore297(world));else owner.forgetActor(command.pawnId);}
 owner.invalidateActive(effectiveCore297(world),'command');
}
type LocalCommand=Exclude<Command,SecondarySiteCommand>;
function applyLocalCommand(world: World, command: LocalCommand): CommandResult {
  if(command?.type==='designate'&&isShipComputerSensorsKind298(command.kind))command={...command,orientation:command.orientation??0,material:command.material??'steel'};
  if(command?.type==='read-book-295')return applyReadBook295(world,command.pawnId,command.bookId);
  if(command?.type==='reading-policy-295')return applyReadingPolicy295(world,command.pawnId,command.policyId);
  if(isSchema287OrLater(Number(world.schemaVersion))&&command?.type==='animal-area-assign')return applyAnimalAreaAssignmentCommand287(world,command);
  if(isSchema287OrLater(Number(world.schemaVersion))&&(command?.type==='allowed-area-create'||command?.type==='allowed-area-settings'||command?.type==='allowed-area-paint'||command?.type==='allowed-area-delete'||command?.type==='assign-allowed-area'))return applyAnimalAwareAreaCommand287(world,command);
  if(command&&typeof command==='object'&&hiddenExplorationCommandTarget256(world,command))return refusal('missing-target','Cette cible n’est pas connue sur la carte actuelle.');
  if(command.type==='material-forbid')return applyMaterialPermission256(world,command);
  if(command.type==='area'&&(command.action==='allow'||command.action==='forbid'))return applyAreaMaterialPermission256(world,command);
  if(command.type==='egg-forbid')return applyEggPermission256(world,command);
  if(command.type==='map-view'||command.type==='map-settle'||command.type==='map-abandon'||command.type==='group-select'||command.type==='group-enter')return refusal('invalid-command','Une commande de campagne valide est requise.');
  // Filter editing changes campaign metadata only. Ordinary due checks own
  // future clothing actions; no task/thermal reconciliation is triggered here.
  if(command.type==='apparel-policy-update')return applyApparelPolicyUpdate(world,command);
  if(command.type==='apparel-policy-copy'||command.type==='apparel-policy-rename')return applyApparelPolicyName(world,command);
  const result=applyCommandInternal(world,command);
  if(command.type==='firefoam-auto-rebuild')return result;
  if(command.type==='bill-pause-policy'||command.type==='bill-pause-resume')return result;
  if(isSchema287OrLater(Number(world.schemaVersion))&&command.type==='area'&&(command.action==='home'||command.action==='remove-home'))return result;
  // These cold metadata transactions already reconcile their exact affected
  // destinations. A no-op must not advance unrelated services or clocks.
  if(command.type==='shelf-link'||command.type==='shelf-unlink'||command.type==='shelf-group-rename'
    ||isSchema286OrLater(world.schemaVersion)&&command.type==='shelf-policy')return result;
  if(result.ok){
    reconcileSmoothFloorJobs281(world);
    reconcileAllowedAreas(world);
    reconcilePodRescueResults(world);
    syncCarriedAnimals(world);reconcileAnimalRescues(world);reconcileAnimalRest(world);
    reconcileWildlife(world);
    detachMissingBills(world);detachMissingSmithingBills267(world);detachMissingGunBills(world);detachMissingFlakBills(world);detachMissingArtBills(world);detachMissingComponentBills(world);detachMissingProstheticBills273(world);reconcileBreakdownJobs(world);reconcileRepairs(world);reconcilePowerFlicks(world);
    if(command.type.startsWith('order-')&&'pawnId' in command){const actor=world.pawns.find(p=>p.id===command.pawnId);if(actor)delete actor.flee;}
    reconcilePrisoners(world);reconcileRescues(world);reconcileWarden(world);reconcilePatientRest(world);reconcileTending(world);reconcileSurgery(world);reconcilePasteRequests(world);reconcileFeeding(world);reconcileAnimalFeeding(world);reconcileEquipmentTasks(world);for(const pawn of world.pawns){if(factionCommsTask298(pawn))reconcileFactionComms298(world,pawn);if(pawn.orbitalTrade)reconcileOrbitalTrade(world,pawn);if(pawn.deepWork)reconcileDeepWork(world,pawn);reconcileWeaponMemory(world,pawn);}reconcileOrders(world);const thermal=reconcileTemperature(world);reconcilePlantLighting(world,()=>readPlantLight(world));updateFoodTemperatures(world,thermal);updatePlantTemperatures(world,thermal);}
  if(result.ok)reconcileSpikeTrapContacts(world);
  return result;
}
function applyCommandInternal(world: World, command: Exclude<LocalCommand,import('./world-map-state.ts').WorldMapCommand|{type:'apparel-policy-update'|'apparel-policy-copy'|'apparel-policy-rename'|'egg-forbid'|'material-forbid'|'read-book-295'|'reading-policy-295'}>): CommandResult {
  if(command.type==='firefoam-auto-rebuild')return applyFirefoamAutoRebuild290(world,command);
  if(command.type==='firefoam-trigger')return applyFirefoamTrigger290(world,command);
  if(command.type==='trade-request-answer'||command.type==='trade-request-dismiss'||command.type==='trade-request-fulfill')return applyTradeRequestCommand284(world,command);
  if (!command || typeof command !== 'object') return refusal('invalid-command', 'Commande invalide.');
  if(command.type==='animal-area-assign')return applyAnimalAreaAssignmentCommand287(world,command);
  if(command.type==='group-reform'||command.type==='group-split'||command.type==='group-merge'||command.type==='group-carry-sick')return refusal('invalid-command','Cette commande exige le registre et le contexte réel de caravane.');
  if(command.type==='cancel-job'||command.type==='cancel-resource'||command.type==='cancel-pile')return applyDesignationCancel(world,command)??refusal('invalid-command','Annulation inconnue.');
  if(command.type==='extract-tree'||command.type==='replant-tree')return applyTreeCommand(world,command)!;
  if(command.type==='designate'&&(command.kind==='extract-tree'||command.kind==='replant-tree'))return command.kind==='extract-tree'?applyTreeCommand(world,{type:'extract-tree',resourceId:command.targetId??-1})!:applyTreeCommand(world,{type:'replant-tree',pileId:command.targetId??-1,x:command.x,z:command.z})!;
  if(command.type==='spike-trap-auto-rebuild')return validSpikeTrapCommand(command)?applySpikeTrapSwitch(world,command):refusal('invalid-command','Réglage de piège invalide.');
  if(command.type==='allowed-area-create'||command.type==='allowed-area-settings'||command.type==='allowed-area-paint'||command.type==='allowed-area-delete'||command.type==='assign-allowed-area')
    return applyAllowedAreaCommand(world,command,{preflight:(next,affected)=>preflightAllowedAreaChange(world,next,affected),reconcile:commitAllowedAreaChange})!;
  if(command.type==='delete-zone'){
    if(!['stockpile','growing'].includes(command.kind)||!Number.isSafeInteger(command.zoneId))return refusal('invalid-command','Suppression de zone invalide.');
    command={type:'area',action:command.kind==='stockpile'?'remove-stockpile':'remove-growing',targetZoneId:command.zoneId,from:{x:0,z:0},to:{x:world.width-1,z:world.height-1}};
  }
  if(command.type==='stockpile'&&command.enabled===false){
    if(!validStorageSettings(command,world.schemaVersion))return refusal('invalid-storage','Politique de stockage invalide.');
    if(!inBounds(world,command.x,command.z))return refusal('out-of-bounds','Cellule hors de la carte.');
    const cell=world.stockpiles.find(cell=>sameCell(cell,command as Cell));
    if(!cell)return refusal('missing-target','Aucune cellule de stockage ici.');
    command={type:'area',action:'remove-stockpile',targetZoneId:stockpileZoneId(cell),from:{x:cell.x,z:cell.z},to:{x:cell.x,z:cell.z}};
  }
  if(command.type==='cut-blighted-crops'){
    if(Object.keys(command).length!==1)return refusal('invalid-command','Commande de coupe invalide.');
    const result=designateBlightedCrops(world);
    if(result.ok){wakePlanners(world);event(world,'command',`${result.affected} plant(s) malade(s) désigné(s) pour coupe, sans récolte.`);}
    return result;
  }
  if(command.type==='planet-adopt'||command.type==='group-start'||command.type==='group-cancel'||command.type==='group-pause'||command.type==='group-route'||command.type==='group-buy'||command.type==='group-sell'||command.type==='group-gift274'||command.type==='group-unload')return validGroupCommand(command,world.schemaVersion)?applyGroupCommand(world,command):refusal('invalid-command','Commande de groupe invalide.');
  if(command.type==='commercial-start'||command.type==='commercial-cancel'||command.type==='commercial-unload')return applyCommercialPreparation(world,command);
  if(command.type==='commercial-buy')return applyCommercialBuy(world,command);
  if(command.type==='commercial-sell')return applyCommercialSell(world,command);
  if(command.type==='commercial-return')return applyCommercialReturn(world);
  if(command.type==='scout-start'||command.type==='scout-cancel'||command.type==='scout-unload')return applyScoutCommand(world,command);
  const actors='pawnIds' in command&&Array.isArray(command.pawnIds)?command.pawnIds:'pawnId' in command&&command.pawnId!==null?[command.pawnId]:[];
  const captiveOperation280=isSchema280OrLater(world.schemaVersion)&&['surgery-request','surgery-install','surgery-cancel'].includes(command.type);
  if(actors.some(id=>world.pawns.find(p=>p.id===id)?.prisoner)&&!['medical-care','medical-policy','food-policy-assign','drug-policy-assign'].includes(command.type)&&!captiveOperation280)return refusal('invalid-command','Une personne détenue ne reçoit pas d’ordres de colon. Utilisez son inspection de prison.');
  if(actors.some(id=>groupOnMapMember(world,id))&&(typeof command.type==='string'&&command.type.startsWith('order-')||['clear-orders','draft','draft-move','draft-stop','shoot','melee','clean-room'].includes(command.type)))return refusal('invalid-command','Terminez ou annulez la préparation du groupe avant de donner un autre ordre.');
  const scoutId=scoutOnMapId(world)??commercialOnMapId(world);
  if(scoutId!==null&&actors.includes(scoutId)&&(typeof command.type==='string'&&command.type.startsWith('order-')||['clear-orders','draft','draft-move','draft-stop','shoot','melee','clean-room'].includes(command.type)))
    return refusal('invalid-command','Terminez ou annulez le voyage et son déchargement avant de donner un autre ordre à ce colon.');
  const traveler=scoutPawn(campaignAuthority(world))??commercialPawn(campaignAuthority(world));
  if(traveler&&'policyId' in command&&command.policyId===traveler.foodPolicyId
    &&(command.type==='food-policy-delete'||command.type==='food-policy-update'&&Array.isArray(command.allowed)&&!command.allowed.includes('survival-meal')))
    return refusal('invalid-command','Ce régime est engagé pour le voyage : conservez les repas de survie jusqu’au retour ou à l’annulation.');
  // Core's Vomit job is not player-interruptible. Reject the entire group
  // before any early command handler can replace a task or mutate a stance.
  if((typeof command.type==='string'&&command.type.startsWith('order-')||['clean-room','draft','draft-move','draft-stop','fire-at-will','clear-orders','shoot','melee','cancel-trade','trade-execute','cancel-orbital-trade','orbital-trade-execute','cancel-faction-comms','request-ai-core-information'].includes(command.type))
    &&actors.some(id=>{const h=world.pawns.find(p=>p.id===id)?.health;return (h?.foodPoisoning?.vomit||(h?.cryptosleepSickness?.vomit||h?.toxicBuildup?.vomit||h?.toxicBuildup?.vomitRequestedAt!==undefined))||h?.flu?.vomit||h?.immuneDiseases?.malaria?.vomit;}))return refusal('invalid-command','Ce colon vomit et ne peut pas interrompre cet épisode.');
  if(command.type==='ship-reactor-start')return applyShipReactorCommand275(world,command);
  if(command.type==='order-enter-ship-casket'||command.type==='order-carry-ship-casket'||command.type==='eject-ship-casket')return applyShipCasket277(world,command);
  if(command.type==='order-enter-cryptosleep'||command.type==='order-carry-cryptosleep'||command.type==='order-open-cryptosleep')return applyCryptosleep271(world,command);
  if(command.type==='order-open-casket')return applyAncientCasketOpen256(world,command);
  if(command?.type==='order-bury'||command?.type==='grave-policy'||command?.type==='assign-grave')return applyBurial(world,command);
  if(command?.type==='apparel-policy-assign')return applyApparelPolicyAssignment(world,command);
  if(command?.type==='apparel-clear-forced')return applyClearForcedApparel(world,command);
  if(command?.type==='clean-room'){const reason=applyCleanRoom(world,command);return reason?refusal('invalid-command',reason):{ok:true};}
  if(command?.type==='designate'&&command.kind==='flick')return refusal('invalid-command','Utilisez le bouton marche/arrêt de l’appareil.');
  if(command?.type==='designate'&&(command.kind==='repair'||command.kind==='fix-breakdown'))return refusal('invalid-command','Utilisez la zone de foyer pour activer les réparations.');
  if(command.type==='heater-adjust')return adjustHeaterTarget(world,command.structureId,command.offset);
  if(command.type==='wind-auto-cut')return setWindAutoCut(world,command.structureId,command.enabled);
  if(command.type==='gather-spot'){
    const spot=structureById(world,command.structureId);
    if(!spot||!['campfire','table','table-square','table-long'].includes(spot.kind)||typeof command.enabled!=='boolean')
      return refusal('invalid-command','Point de rencontre invalide.');
    if(command.enabled)delete spot.gatherSpot;else spot.gatherSpot=false;
    if(!command.enabled)for(const pawn of world.pawns)if(pawn.recreation.task?.activity==='social-relax'&&pawn.recreation.task.buildingId===spot.id)releaseWork(world,pawn);
    return {ok:true};
  }
  if(command.type==='adopt-economy'){if(adoptColonyEconomy(world))event(world,'command','Patrimoine, attentes et progression des menaces activés à partir de maintenant.');return {ok:true};}
  if(command.type==='climate-adopt'){const adopted=adoptEnvironment(world);if(adopted)event(world,'command','Climat saisonnier et météo activés à partir de maintenant.');return {ok:true};}
  if(command.type==='order-extinguish'){const reason=applyExtinguish(world,command);return reason?refusal('invalid-command',reason):{ok:true};}
  if(command.type==='power-flick')return requestPowerFlick(world,command.structureId,command.on);
  if(command.type==='cancel-unfinished')return world.piles.some(p=>p.id===command.itemId&&p.prostheticWork273)?cancelProstheticWork273(world,command.itemId):world.piles.some(p=>p.id===command.itemId&&p.smithingWork)?cancelSmithingWork267(world,command.itemId):world.piles.some(p=>p.id===command.itemId&&p.componentWork)?cancelComponentWork(world,command.itemId):world.piles.some(p=>p.id===command.itemId&&p.flakWork)?cancelFlakWork(world,command.itemId):world.piles.some(p=>p.id===command.itemId&&p.artWork)?cancelArtWork(world,command.itemId):world.piles.some(p=>p.id===command.itemId&&p.gunWork)?cancelGunWork(world,command.itemId):cancelUnfinished(world,command.itemId);
  if(command.type==='enable-wildlife'){enableWildlife(world);return {ok:true};}
  if(command.type==='enable-heatwaves'){if(world.gameProfile)return {ok:false,code:'invalid-command',reason:'Le calendrier de canicule historique n’est pas disponible avec ce narrateur.'};enableHeatwaves(world);return {ok:true};}
  if(command.type==='order-faction-comms'||command.type==='cancel-faction-comms'||command.type==='request-ai-core-information'){
    if(!validFactionCommsCommand298(command,Number(world.schemaVersion),world.nextId))return refusal('invalid-command','Communication de faction invalide.');
    if(command.type==='order-faction-comms')return orderFactionComms298(world,command.pawnId,command.factionId,command.consoleId);
    if(command.type==='request-ai-core-information')return applyAiCoreInformation298(world,command.pawnId,command.factionId,command.consoleId,command.quote);
    const pawn=world.pawns.find(p=>p.id===command.pawnId);if(!pawn)return refusal('missing-target','Négociateur introuvable.');if(factionCommsTask298(pawn))stopFactionComms298(world,pawn);return {ok:true};
  }
  if(command.type==='order-orbital-trade'||command.type==='cancel-orbital-trade'||command.type==='orbital-trade-execute')return applyOrbitalTrade(world,command);
  if(command.type==='enable-visitors'||command.type==='order-trade'||command.type==='cancel-trade'||command.type==='trade-execute')return applyTrade(world,command);
  if(command.type==='enable-mech-raids')return enableMechanoidRaids(world)?{ok:true}:{ok:false,code:'invalid-command',reason:'Le calendrier Cassandra est requis pour les menaces mécaniques.'};
  if(command.type==='claim-road-prop')return claimRoadProp256(world,command);
  if(command.type==='enable-raids'){enableRaids(world);return {ok:true};}
  if(command.type==='enable-arrivals'||command.type==='answer-arrival')return applyArrival(world,command);
  if(command.type==='enable-quests'||command.type==='answer-quest')return applyQuestCommand(world,command);
  if(command.type==='prison-bed')return applyPrisonBed(world,command);
  if(command.type==='prisoner-mode')return applyPrisonerMode(world,command);
  if(actors.some(id=>{const p=world.pawns.find(p=>p.id===id);return p&&!isColonist(p)&&!(p.prisoner&&captiveOperation280)&&!((p.prisoner||isAdmittedGuest(p))&&['medical-care','medical-policy','food-policy-assign','drug-policy-assign'].includes(command.type));}))return refusal('invalid-command','Cette personne ne fait pas partie de la colonie.');
  if(typeof command.type==='string'&&command.type.startsWith('order-')||['draft','draft-move','draft-stop','fire-at-will','clear-orders','shoot','melee'].includes(command.type)){
    const affected=actors.map(id=>world.pawns.find(p=>p.id===id)).find(p=>p?.mental?.crisis);
    if(affected?.mental?.crisis)return refusal('invalid-command',`${mentalCrisisLabel(affected.mental.crisis.kind)} : ce colon ne peut pas obéir pendant sa crise.`);
  }
  if(typeof command.type==='string'&&(command.type.startsWith('order-')||['shoot','melee','clean-room'].includes(command.type))){
    const consumer=actors.map(id=>world.pawns.find(p=>p.id===id)).find(p=>p&&isForcedConsuming(p));
    if(consumer){
      if('queue' in command&&command.queue===true)return refusal('invalid-command','Terminez ou annulez la consommation avant de mettre un autre travail en file.');
      if((consumer.moveCooldown>0||(consumer.motion?.end??0)>world.tick)
        &&world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===consumer.id))return refusal('invalid-command','Attendez la fin du déplacement avant de déposer la portion.');
    }
  }
  if(command.type==='hostility-response'){const p=world.pawns.find(p=>p.id===command.pawnId);if(!p||!['flee','ignore','attack'].includes(command.response))return refusal('invalid-command','Réaction invalide.');if(command.response==='flee')delete p.hostilityResponse;else p.hostilityResponse=command.response;cancelAutomaticCombat(p);if(p.flee&&command.response!=='flee'){delete p.flee;p.path=[];p.state='idle';}return {ok:true};}
  if(typeof command.type==='string'&&command.type.startsWith('order-')&&'pawnId' in command&&world.pawns.find(p=>p.id===command.pawnId)?.melee?.strike)return refusal('invalid-command','Le colon récupère après sa frappe.');
  if(command.type==='melee'||command.type==='shoot'){const result=command.type==='melee'?applyMeleeCommand(world,command):applyShootingCommand(world,command);if(result.ok){const target=world.pawns.find(p=>p.id===command.targetId);if(target?.visitor)visitorGroupDanger(world,target,'hostile');}return result;}
  if(typeof command.type==='string'&&'pawnId' in command&&command.type.startsWith('order-')&&world.pawns.find(p=>p.id===command.pawnId)?.shooting?.stance?.phase==='cooldown')return {ok:false,code:'invalid-command',reason:'Le colon récupère après son tir.'};
  if(command.type==='draft'||command.type==='draft-move'||command.type==='draft-stop'||command.type==='fire-at-will')return applyDraftCommand(world,command);
  if(typeof command.type==='string'&&command.type.startsWith('order-')&&'pawnId' in command&&world.pawns.find(p=>p.id===command.pawnId)?.draft
    &&!(world.schemaVersion>=237&&command.type==='order-rescue')&&!(world.schemaVersion>=234&&command.type==='order-consume')&&!(world.schemaVersion>=233&&command.type==='order-drafted-tend')&&!(world.schemaVersion>=193&&command.type==='order-haul'&&command.target?.type==='turret'))return refusal('invalid-command','Démobilisez ce colon avant un ordre civil.');
  if(command.type==='clear-orders'&&world.pawns.find(p=>p.id===command.pawnId)?.draft)return applyDraftCommand(world,{type:'draft-stop',pawnIds:[command.pawnId]});
  if(command.type==='order-equipment'||command.type==='weapon-permission'||command.type==='apparel-permission'||command.type==='forget-weapon')return applyEquipment(world,command);
  if(command.type==='order-feed')return applyFeeding(world,command);
  if(command.type==='tame')return applyTaming(world,command);
  if(command.type==='animal-training')return setAnimalTrainingWanted282(world,command.animalId,command.skill,command.wanted);
  if(command.type==='slaughter')return designateSlaughter(world,command);
  if(command.type==='auto-slaughter-policy'){
    const result=setAutoSlaughterPolicy(world,command);
    if(result.ok)reconcileDomesticWork(world);
    return result;
  }
  if(command.type==='pen-species'){
    if(!Number.isSafeInteger(command.markerId)||typeof command.accepted!=='boolean'||!penAnimalsForVersion(world.schemaVersion).includes(command.species))return refusal('invalid-command','Réglage d’enclos invalide.');
    const marker=world.structures.find(s=>s.id===command.markerId&&s.kind==='pen-marker');
    if(!marker?.pen)return refusal('missing-target','Marqueur d’enclos introuvable.');
    const selected=new Set(marker.pen.accepted);
    if(command.accepted)selected.add(command.species);else selected.delete(command.species);
    marker.pen.accepted=PEN_ANIMALS.filter(id=>selected.has(id));
    reconcileDomesticWork(world);wakePlanners(world);return {ok:true};
  }
  if(command.type==='animal-care-policy')return applyAnimalCarePolicy(world,command);
  if(command.type==='surgery-request'||command.type==='surgery-cancel'||command.type==='surgery-remove-prosthetic'||command.type==='surgery-install')return applySurgery(world,command);
  if(command.type==='order-tend')return applyTending(world,command);
  if(command.type==='order-drafted-tend')return applyDraftedTending(world,command);
  if(command.type==='order-consume')return applyConsume(world,command);
  if(command.type==='self-tend-policy'){
    const p=world.pawns.find(p=>p.id===command.pawnId);
    if(!p||p.state==='dead'||typeof command.enabled!=='boolean')return refusal('invalid-command','Réglage d’auto-soin invalide.');
    if(command.enabled)p.selfTend=true;else delete p.selfTend;
    p.planCooldown=0;return {ok:true};
  }
  if(command.type==='medical-care'){
    const p=world.pawns.find(p=>p.id===command.pawnId);
    if(!p||p.state==='dead'||typeof command.care!=='string'||!Object.hasOwn(MEDICAL_CARE,command.care))return refusal('invalid-command','Plafond médical invalide.');
    delete p.careDisabled;p.medicalCare=command.care;p.planCooldown=0;return {ok:true};
  }
  if(command.type==='medical-policy'){
    const p=world.pawns.find(p=>p.id===command.pawnId);
    if(!p||typeof command.enabled!=='boolean')return refusal('invalid-command','Politique médicale invalide.');
    delete p.medicalCare;if(command.enabled)delete p.careDisabled;else p.careDisabled=true;
    p.planCooldown=0;return {ok:true};
  }
  if(command.type==='order-animal-rescue')return applyAnimalRescue(world,command);
  if(command.type==='animal-spot-medical')return applyAnimalSpotMedical(world,command);
  if(command.type==='order-rescue')return applyRescue(world,command);
  if(command.type==='order-capture')return applyCapture(world,command);
  if(command.type==='order-arrest')return applyArrest(world,command);
  if(command.type==='medical-bed')return applyMedicalBed(world,command);
  if(command.type==='order-job'||command.type==='order-cook'||command.type==='order-haul'||command.type==='clear-orders')return applyOrderCommand(world,command);
  if (command.type === 'schedule-paint' || command.type === 'schedule-replace') return applyScheduleCommand(world, command);
  if(command.type==='drug-policy-create'||command.type==='drug-policy-update'||command.type==='drug-policy-delete'||command.type==='drug-policy-assign'||command.type==='drug-policy-default'){const reason=applyDrugPolicyCommand265(world,command);return reason?refusal('invalid-command',reason):{ok:true};}
  if (command.type === 'food-policy-create' || command.type === 'food-policy-update' || command.type === 'food-policy-delete' || command.type === 'food-policy-assign') return applyFoodPolicyCommand(world, command);
  if(command.type==='door-policy'){
    const result=applyDoorCommand(world,command);
    if(result.ok)reconcileDomesticWork(world);
    return result;
  }
  if(command.type==='install')return installCommand(world,command);
  if(command.type==='shelf-link'||command.type==='shelf-unlink'||command.type==='shelf-group-rename'
    ||isSchema286OrLater(world.schemaVersion)&&command.type==='shelf-policy'){
    const policy=prepareLinkedStorageCommand286(world,command);
    if(!policy.ok)return refusal('invalid-storage',policy.reason);
    if(policy.noop)return {ok:true,affected:0};
    const logistics=prepareLinkedStorageLogistics286(world,policy.changedCellIds);
    if(!logistics.ok)return refusal('occupied',logistics.reason);
    if(!policy.current()||!logistics.current())return refusal('occupied','Le stockage a changé pendant la préparation.');
    if(!policy.commit())return refusal('invalid-storage','Les réglages ont changé pendant la préparation.');
    if(!logistics.commit())throw Error('Admitted linked storage cargo plan changed during policy adoption');
    if(policy.changedCellIds.length){wakePlanners(world);refreshStock(world);}
    return {ok:true,affected:policy.changedCellIds.length};
  }
  const replacing=command.type==='designate'?wallBlueprintForDoor(world,command):undefined;
  const drops=replacing?planBlueprintDoorReplacement(world,command as DesignateCommand,replacing):planCommandDrops(world,command);
  if(!drops)return refusal('occupied','Pas de place à proximité pour les matériaux libérés.');
  if(command.type==='hunt')return designateHunt(world,command);
  if(command.type==='cooler-adjust')return adjustCoolerTarget(world,command.structureId,command.offset);
  if(command.type==='cooler-target')return setCoolerTarget(world,command.structureId,command.target);
  if(command.type==='research-project')return selectResearch(world,command.project);
  if(command.type==='bill-worker-policy'||command.type==='bill-pause-policy'||command.type==='bill-pause-resume') {
    const result=applyBillCommand(world,command,drops);if(result.ok)wakePlanners(world);return result;
  }
  if(command.type==='bill-add'||command.type==='bill-update'||command.type==='bill-remove'||command.type==='bill-move') {
    const result=applyBillCommand(world,command,drops);if(result.ok){detachMissingBills(world);detachMissingSmithingBills267(world);detachMissingGunBills(world);detachMissingFlakBills(world);detachMissingArtBills(world);detachMissingComponentBills(world);detachMissingProstheticBills273(world);wakePlanners(world);refreshStock(world);}return result;
  }
  if (command.type === 'area') return applyArea(world, command,drops);
  if (command.type === 'build-line') return applyBuildLine(world, command);
  if(command.type==='turret-hold-fire'||command.type==='turret-auto-reload'){
    const s=reloadableTurret(world,command.structureId);
    if(world.schemaVersion<193||!s||typeof command.enabled!=='boolean')return refusal('invalid-command','Mini-tourelle ou réglage invalide.');
    if(command.type==='turret-hold-fire')setTurretHoldFire(s,command.enabled);
    else {
      if(!command.enabled)for(const p of world.pawns)if(p.haul?.destination.type==='turret'&&!p.haul.destination.forced&&p.haul.destination.structureId===s.id)releaseWork(world,p,drops);
      s.turret!.autoReload=command.enabled;wakePlanners(world);refreshStock(world);
    }
    return {ok:true};
  }
  if (command.type === 'refuel-policy') {
    const fire=refuelable(world,command.structureId);
    if (!fire || typeof command.enabled!=='boolean') return refusal('invalid-command','Bâtiment ou réglage de ravitaillement invalide.');
    if(!command.enabled)for(const pawn of world.pawns)if(pawn.haul?.destination.type==='fuel'&&!pawn.haul.destination.forced&&pawn.haul.destination.structureId===fire.id)releaseWork(world,pawn,drops);
    fire.fuel!.autoRefuel=command.enabled;wakePlanners(world);refreshStock(world);return {ok:true};
  }
  if (command.type === 'growing-policy') {
    const zone = world.growingZones.find(z => z.id === command.zoneId);
    if (!zone || typeof command.allowSow !== 'boolean' || typeof command.allowCut !== 'boolean' || command.plant!==undefined&&!isGrowingPlantInVersion291(command.plant,world.schemaVersion)) return refusal('invalid-command', 'Zone ou réglages de culture invalides.');
    if(zone.basinId!==undefined&&!hydroponicCropAllowed(command.plant??zone.plant))return refusal('invalid-command','Cette plante ne peut pas être cultivée en hydroponie.');
    if(command.plant!==undefined&&command.plant!==zone.plant&&isForestrySpecies291(command.plant)){
      if(!treeSowingUnlocked291(world))return refusal('invalid-command','Terminez la recherche Semis d’arbres avant de choisir cette essence.');
      if(!forestNativeSpecies291(world).includes(command.plant))return refusal('invalid-command','Cette essence ne fait pas partie de la flore sauvage de ce biome.');
    }
    cancelGrowingJobs(world, new Set([zone.id]),drops);
    world.growingZones = world.growingZones.map(z => z === zone ? {...z, plant:command.plant??z.plant, allowSow: command.allowSow, allowCut: command.allowCut} : z);
    wakePlanners(world); return {ok:true};
  }
  if(command.type==='shelf-policy'){
    if(world.schemaVersion<229)return refusal('invalid-command','Le stockage en étagère nécessite le format courant.');
    if(Reflect.ownKeys(command).length!==3)return refusal('invalid-command','Commande de stockage invalide.');
    const shelf=world.structures.find(s=>s.id===command.structureId&&isShelfKind(s.kind));
    const result=patchShelfPolicy(world,command.structureId,command.settings);
    if(!result.ok)return refusal('invalid-storage',result.reason);
    const ids=new Set(shelf!.shelf!.cells);
    interruptAnimalStorage282(world,ids);
    for(const p of world.pawns){
      if(p.cooking?.storageId!==null&&p.cooking?.storageId!==undefined&&ids.has(p.cooking.storageId)){p.cooking.storageId=null;delete p.cooking.storageQuantity;p.path=[];p.planCooldown=0;}
      if(p.haul?.destination.type==='stockpile'&&ids.has(p.haul.destination.stockpileId))releaseWork(world,p,drops);
      p.orders.queue=p.orders.queue.filter(o=>typeof o==='number'||!('destination' in o)||o.destination.type!=='stockpile'||!ids.has(o.destination.stockpileId));
    }
    wakePlanners(world);refreshStock(world);return {ok:true,affected:ids.size};
  }
  if(command.type==='stockpile-policy'){
    const cells=stockpileZoneCells(world,command.stockpileId);
    if(!cells.length)return refusal('missing-target','Zone de stockage absente.');
    if(!validStorageSettings(command.settings,world.schemaVersion))return refusal('invalid-storage','Politique de stockage invalide.');
    const ids=new Set(cells.map(cell=>cell.id));
    interruptAnimalStorage282(world,ids);
    for(const cell of cells)patchStockpilePolicy(cell,command.settings);
    for(const pawn of world.pawns)if(pawn.cooking?.storageId!==null&&pawn.cooking?.storageId!==undefined&&ids.has(pawn.cooking.storageId)){
      pawn.cooking.storageId=null;delete pawn.cooking.storageQuantity;pawn.path=[];pawn.planCooldown=0;
    }
    for(const pawn of world.pawns)if(pawn.haul?.destination.type==='stockpile'&&ids.has(pawn.haul.destination.stockpileId))releaseWork(world,pawn,drops);
    wakePlanners(world);refreshStock(world);return {ok:true,affected:cells.length};
  }
  if (command.type === 'assign-bed') {
    const bed = world.structures.find(item => item.id === command.bedId && isBedKind(item.kind));
    const owner = world.pawns.find(item => item.id === command.pawnId);
    if(bed&&!targetBuildingPlayerUse263(world,bed))return refusal('invalid-command','Ce lit appartient à une autre faction.');
    if (!bed || bed.medical || bed.prisoner || (command.pawnId !== null && (!owner||owner.state==='dead'))) return refusal('missing-target', 'Lit ou colon introuvable.');
    if(bed.kind==='double-bed'){
      if(command.slot!==0&&command.slot!==1)return refusal('invalid-command','Une place du lit double doit être indiquée.');
      const reason=bedAssignmentReason(world,bed,owner??null,command.slot);if(reason)return refusal('invalid-command',reason);
      if(owner?.bedId===bed.id&&owner.bedSlot===command.slot)return {ok:true};
      const ownership=prepareConfirmedBedAssignment256(world,bed,owner??null,command.slot);
      const affected=new Set(world.pawns.filter(p=>p.bedId===bed.id&&p.bedSlot===command.slot||p===owner).map(p=>p.id));
      const released=world.pawns.filter(p=>(p.need?.kind==='sleep'||p.coupleTask285!==undefined)&&affected.has(p.id)||p.rescue&&(affected.has(p.rescue.patientId)||p.rescue.bedId===bed.id&&p.rescue.bedSlot===command.slot));
      for(const pawn of released)if(!releaseWork(world,pawn,drops))return refusal('occupied','Impossible de libérer le couchage précédent.');
      for(const pawn of world.pawns)if(affected.has(pawn.id)){pawn.bedId=null;delete pawn.bedSlot;pawn.needCooldown=0;}
      if(owner){owner.bedId=bed.id;owner.bedSlot=command.slot;}
      if(ownership)commitActorBedClaim256(ownership);
      return {ok:true};
    }
    if(command.slot!==undefined)return refusal('invalid-command','Ce lit ne possède qu’une place.');
    const ownership=prepareConfirmedBedAssignment256(world,bed,owner??null);
    if(owner?.bedSlot!==undefined)for(const carrier of world.pawns)if(carrier.rescue?.patientId===owner.id)releaseWork(world,carrier,drops);
    for (const pawn of world.pawns) if (pawn.bedId === bed.id || pawn === owner) {
      if (pawn.need?.kind === 'sleep'||pawn.coupleTask285) releaseWork(world, pawn,drops);
      pawn.bedId = null;delete pawn.bedSlot; pawn.needCooldown = 0;
    }
    if (owner) owner.bedId = bed.id;
    if(ownership)commitActorBedClaim256(ownership);
    return { ok: true };
  }
  if (command.type === 'priority') {
    if (!['handle','art','clean','firefight','warden','basic','hunt','research','patient','bedrest','doctor','mine', 'gather', 'build', 'haul', 'grow', 'cook', 'craft'].includes(command.work) || !Number.isInteger(command.value) || command.value < 0 || command.value > 4) return refusal('invalid-priority', 'La priorité doit être comprise entre 0 et 4.');
    const pawn = world.pawns.find(candidate => candidate.id === command.pawnId);
    if (!pawn) return refusal('missing-target', 'Colon introuvable.');
    const background=backgroundWorkRefusal(pawn,command.work);if(command.value>0&&background)return refusal('invalid-priority',background);
    pawn.priorities[command.work] = command.value;
    if(command.value===0&&command.work==='haul'&&pawn.brewing)releaseWork(world,pawn,drops);
    if(command.value===0&&pawn.deepWork&&command.work===(pawn.deepWork.kind==='drill'?'mine':'research'))releaseWork(world,pawn,drops);
    if(command.value===0&&(command.work==='handle'&&pawn.animalHandling||command.work==='doctor'&&(pawn.animalCare||pawn.animalFeed||pawn.animalRescue)))releaseWork(world,pawn,drops);
    if(command.work==='hunt'&&command.value===0&&pawn.hunting){cancelHunting(pawn);pawn.path=[];pawn.state='idle';}if(command.work==='research'&&command.value===0&&pawn.research)releaseAssignments(world,pawn);
    if(command.value===0&&pawn.feed&&command.work===feedingWork(world.pawns.find(p=>p.id===pawn.feed!.patientId))&&pawn.orders.active!=='feed')releaseWork(world,pawn,drops);
    if(command.work==='doctor'&&command.value===0&&(pawn.surgery||pawn.tend&&pawn.orders.active!=='tend'))releaseWork(world,pawn);
    if(command.work==='clean'&&command.value===0&&pawn.cleaning&&!pawn.cleaning.forced)releaseWork(world,pawn,drops);
    if(command.work==='haul'&&command.value===0&&pawn.burial&&pawn.orders.active!=='bury')releaseWork(world,pawn,drops);
    if(command.work==='firefight'&&command.value===0&&pawn.firefighting&&!pawn.firefighting.forced)releaseWork(world,pawn,drops);
    if(command.work==='warden'&&command.value===0&&pawn.ward)releaseWork(world,pawn,drops);
    if(command.value===0&&pawn.rescue&&pawn.orders.active!=='rescue'&&(pawn.rescue.release?
      (command.work==='basic'||command.work==='warden')&&!workPriority(pawn,'basic')&&!workPriority(pawn,'warden'):
      command.work===(world.pawns.find(p=>p.id===pawn.rescue!.patientId)?.prisoner?'warden':'doctor')))releaseWork(world,pawn,drops);
    const job = world.jobs.find(candidate => candidate.id === pawn.jobId);
    if (command.value === 0 && ((job && workType(job) === command.work && pawn.orders.active===null) || (pawn.haul && pawn.orders.active!=='haul' && command.work === haulingWork(pawn.haul.destination)) || (pawn.cooking && pawn.orders.active!=='cook' && command.work === taskWork(pawn.cooking)))) releaseWork(world, pawn,drops);
    pawn.planCooldown = 0; refreshStock(world); return { ok: true };
  }
  if(command.type==='caravan-order'||command.type==='caravan-encounter-choice'||command.type==='caravan-meeting-trade')return refusal('invalid-command','La commande exige le vrai registre de caravanes.');
  if (!['designate', 'cancel', 'stockpile'].includes(command.type)) return refusal('invalid-command', 'Commande inconnue.');
  if (!inBounds(world, command.x, command.z)) return refusal('out-of-bounds', 'Cellule hors de la carte.');
  if (command.type === 'stockpile') {
    if(cookingCellReserved(world,command))return refusal('occupied','Case réservée par un cuisinier.');
    if (world.pawns.some(p => p.haul?.destination.type === 'aside' && !p.haul.whole && sameCell(p.haul.destination, command))) return refusal('occupied', 'Case réservée pour le dégagement des cultures.');
    if (typeof command.enabled !== 'boolean' || !validStorageSettings(command,world.schemaVersion)) return refusal('invalid-storage', `Filtres, priorité (1–5) ou capacité (1–${ITEM_DEFINITIONS.silver.stackLimit}) invalides.`);
    const existing = world.stockpiles.find(zone => sameCell(zone, command));
    if(!existing&&command.enabled&&!Number.isSafeInteger(world.nextId+1))return refusal('invalid-command','Limite des identités atteinte.');
    const affectedIds=new Set(existing?stockpileZoneCells(world,existing.id).map(cell=>cell.id):[]);
    if (!command.enabled) {
      if (!existing) return refusal('missing-target', 'Aucune cellule de stockage ici.');
      removeIdentity(world.stockpiles,existing);
    } else {
      if (growingZoneAt(world, cellIndex(world, command.x, command.z)) || ['water', 'rock'].includes(world.tiles[cellIndex(world, command.x, command.z)]!.terrain)
        || world.resources.some(item => (world.schemaVersion<219||item.kind==='rock')&&sameCell(item, command))
        || [...world.structures, ...world.jobs].some(item => !['deconstruct','uninstall'].includes(item.kind)&&(world.schemaVersion>=219?occupancyOf('furniture' in item?item.furniture?.kind??item.kind:item.kind)?.zones===false:occupancyOf('furniture' in item?item.furniture?.kind??item.kind:item.kind)?.zones!==true)&&occupies(item,command))) return refusal('occupied', 'Stockage impossible sur cette cellule occupée ou infranchissable.');
      if (existing) {
        for(const cell of stockpileZoneCells(world,existing.id))patchStockpilePolicy(cell,command);
      } else {const id=world.nextId++;world.stockpiles.push({ id,zoneId:id, x: command.x, z: command.z, filters: { ...(command.filters ?? { wood: true, food: true,...(world.schemaVersion>=265?{wort:true,beer:true}:{}),...((Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion))))?{book:true}:{}) }) },...(command.items!==undefined?{items:{...command.items}}:{}),...copyStorageConditions(command), priority: command.priority ?? 2, capacity: command.capacity ?? ITEM_DEFINITIONS.silver.stackLimit });}
    }
    for(const pawn of world.pawns)if(pawn.cooking?.storageId!==null&&pawn.cooking?.storageId!==undefined&&affectedIds.has(pawn.cooking.storageId)){pawn.cooking.storageId=null;delete pawn.cooking.storageQuantity;pawn.path=[];pawn.planCooldown=0;}
    // Re-evaluate pending capacity reservations atomically after the policy change.
    interruptAnimalStorage282(world,affectedIds);
    for (const pawn of world.pawns) if (pawn.haul?.destination.type === 'stockpile'
      && (!destinationValid(world, pawn) || affectedIds.has(pawn.haul.destination.stockpileId))) releaseWork(world, pawn,drops);
    for(const p of world.pawns)if(p.haul?.whole&&p.haul.destination.type==='aside'&&!destinationValid(world,p))releaseWork(world,p,drops);
    wakePlanners(world); refreshStock(world); return { ok: true };
  }
  if(command.type==='cancel'){
    const jobs=new Set(world.jobs.filter(j=>[...footprintCells(j),...furnitureSourceCells(world,j)].some(c=>sameCell(c,command))).flatMap(j=>j.wallDoor296?.plan?[j.id,j.wallDoor296.plan.id]:[j.id]));
    if(!jobs.size)return refusal('missing-target','Aucun ordre a annuler ici.');
    return cancelIntentJobs(world,jobs);
  }
  const result = canDesignate(world, command);
  if (!result.ok) return result;
  if(command.kind==='uninstall') {
    if(!Number.isSafeInteger(world.nextId+1))return refusal('invalid-command','Limite des identités atteinte.');
    const source=deconstructionAt(world,command)!;
    const maintenance=world.jobs.find(j=>j.fixBreakdown?.structureId===source.id);
    if(maintenance&&!retireBreakdownJob(world,maintenance))return refusal('occupied','Pas de place pour restituer le composant de réparation.');
    designateUninstall(world,source);wakePlanners(world);return {ok:true};
  }
  if(command.kind==='deconstruct') {
    const immediate=deconstructionAt(world,command)!;
    if(promoteWallDoorManual296(world,immediate)){wakePlanners(world);event(world,'command','Déconstruction du mur confirmée indépendamment du plan de porte.');return {ok:true};}
    if(immediate.kind==='sleeping-spot'){const removed=removeHumanSleepingSpot(world,immediate,drops);if(removed.ok){wakePlanners(world);event(world,'command','Emplacement de couchage retiré.');}return removed;}
    if(!Number.isSafeInteger(world.nextId+1))return refusal('invalid-command','Limite des identités atteinte.');
    const target=deconstructionAt(world,command)!;if(target.kind==='animal-sleeping-spot')removeAnimalSpot(world,target);else if((target.kind==='crafting-spot'||target.kind==='butcher-spot'))removeCraftingSpot(world,target,drops);else designateDeconstruction(world,target);
    wakePlanners(world);event(world,'command','Bâtiment désigné pour déconstruction.');return {ok:true};
  }
  if(command.kind==='sleeping-spot')return placeHumanSleepingSpot(world,command);
  if(command.kind==='animal-sleeping-spot')return placeAnimalSpot(world,command);
  if(command.kind==='crafting-spot'||command.kind==='butcher-spot'){const r=placeCraftingSpot(world,command,drops);if(r.ok)wakePlanners(world);return r;}
  const wallTarget=wallDoorTarget296(world,command.kind,command);
  if(wallTarget&&(command.kind==='door'||command.kind==='autodoor')){
    if(!attachWallDoor296(world,wallTarget,command.kind,command.material??'wood'))return refusal('occupied','Le mur ne permet plus ce plan de porte.');
    removeZonesForPlan(world,command,drops);refreshStock(world);wakePlanners(world);
    event(world,'command',`Plan de porte posé : le mur sera réellement démonté avant la construction (${command.x}, ${command.z}).`);return {ok:true};
  }
  if(replacing)retireWallBlueprint(world,replacing,drops);
  removeZonesForPlan(world,command,drops);
  world.jobs.push({ id: world.nextId++, kind: command.kind, ...(world.schemaVersion>=235&&['chop','cut','harvest'].includes(command.kind)?{plantTarget:{resourceId:world.resources.find(r=>sameCell(r,command))!.id}}:{}), ...(isConstruction(command)?{construction:command.kind==='grave'?'frame' as const:'blueprint' as const,...command.kind==='grave'||command.kind==='build-bridge'||command.kind==='lay-floor'?{}:{material:command.material??(command.kind==='electric-crematorium'?'granite-blocks' as const:command.kind==='sandbags'?'cloth' as const:command.kind==='firefoam-popper'||isShipComputerSensorsKind298(command.kind)||isShipPartKind276(command.kind)||command.kind==='ship-cryptosleep-casket'||command.kind==='cryptosleep-casket'||command.kind==='geothermal-generator'||command.kind==='electric-smelter'||command.kind==='biofuel-refinery'||command.kind==='chemfuel-generator'||command.kind==='nutrient-paste-dispenser'||command.kind==='hopper'||command.kind==='orbital-beacon'||command.kind==='comms-console'||command.kind==='deep-drill'||command.kind==='ground-scanner'||command.kind==='vitals-monitor'||command.kind==='hydroponics-basin'||command.kind==='mini-turret'||command.kind==='hospital-bed'||command.kind==='tube-television'?'steel' as const:'wood' as const)}}:{}),...(command.kind==='lay-floor'?{floor:command.floor}:command.kind==='remove-floor'?{floor:world.tiles[command.z*world.width+command.x]!.floor}:{}), x: command.x, z: command.z, orientation: command.orientation ?? (command.kind==='ship-cryptosleep-casket'?2:isShipPartKind276(command.kind)?SHIP_PART_DEFAULT_ORIENTATION_276[command.kind]:0), footprint: 'standard', status: 'pending', reservedBy: null, progress: 0, escrow: { wood: 0, food: 0 } });
  refreshStock(world); wakePlanners(world); event(world, 'command', `Nouvel ordre : ${JOB_LABEL[command.kind]} (${command.x}, ${command.z}).`); return { ok: true };
}

function completeJob(world: World, pawn: Pawn, job: Job): void {
  if(job.flowerPotId!==undefined&&job.kind==='cut'){
    const pot=world.structures.find(s=>s.id===job.flowerPotId&&s.kind==='flower-pot');if(!pot?.flower?.plant){releaseWork(world,pawn);return;}pot.flower=cutFlowerPotPlant(pot.flower);
  } else if (job.kind === 'chop' || job.kind === 'harvest' || job.kind === 'cut') {
    const resource = world.resources.find(item => job.plantTarget?item.id===job.plantTarget.resourceId:sameCell(item, job));
    if (!resource) { releaseWork(world, pawn); return; }
    if (job.kind === 'harvest' && !harvestable(world, resource)) { releaseWork(world, pawn); return; }
    const quantity=gatherResource(world,resource,job.kind,job.id,pawn);
    if(quantity===null){
      // Current ground CUT has already paid its contact work and plant XP.
      // Keep the producer claim and retry only placement at the saved boundary.
      if(world.schemaVersion>=235&&job.kind==='cut'&&retainWorkAfterOutputRefusal(job,jobDuration(world,job))){pawn.planCooldown=20;return;}
      setWorkUnits(job,Math.max(0,Math.round((jobDuration(world,job)-1)*WORK_FRACTIONS)));releaseWork(world,pawn);return;
    }
    if(job.kind!=='chop'&&quantity>0)event(world,'job',`${pawn.name} a récolté ${quantity} ${harvestProductLabel(resource)}.`);
  } else if(job.kind==='build-bridge'||job.kind==='remove-bridge'){
    if(!(job.kind==='build-bridge'?finishBridge(world,job):removeBridge(world,job))){releaseWork(world,pawn);return;}
  } else if(job.kind==='lay-floor'||job.kind==='remove-floor'){
    if(!(job.kind==='lay-floor'?finishFloor(world,job):removeFloor(world,job))){releaseWork(world,pawn);return;}
  } else if (isRoofJob(job)) {
    finishRoofJob(world,job);
  } else if (job.kind === 'deconstruct') {
    const target=structureById(world,job.deconstruction?.structureId);
    if(!finishDeconstruction(world,pawn,job)){releaseWork(world,pawn);return;}
    invalidateAnimalPens(world);reconcileDomesticWork(world);
    if(target?.kind==='wall'||target?.kind==='column'||isRoomDoor(target?.kind))reconcileRoofSupport(world,false,target);
  } else if (job.kind==='mine'||job.kind==='install'||job.kind==='uninstall') {
    return; // Furniture transfers are processed by their physical state machine.
  } else if (job.kind === 'sow') {
    finishSowing(world, job);
  } else {
    if(!constructionSupplied(world,job)||!constructionSiteFree(world,job,pawn.id)||!Number.isSafeInteger(world.nextId+(isShelfKind(job.kind)?1+footprintCells(job).length:job.kind==='hydroponics-basin'?2:1))){setWorkUnits(job,Math.max(0,Math.round((jobDuration(world,job)-1)*WORK_FRACTIONS)));releaseWork(world,pawn);return;}
    const retirement=planConstructionPlantRetirement(world,job,job.id);
    if(!retirement||!commitConstructionPlantRetirement(world,retirement)){setWorkUnits(job,Math.max(0,Math.round((jobDuration(world,job)-1)*WORK_FRACTIONS)));releaseWork(world,pawn);return;}
    world.piles = world.piles.filter(pile => pile.owner.type !== 'job' || pile.owner.jobId !== job.id);
    if(job.kind==='wind-turbine')adoptWind(world);
    const qualityStream={rng:world.rng},quality=(job.kind==='sarcophagus'||isHabitatFurnitureKind(job.kind)&&FURNITURE_DEFINITIONS[job.kind].quality)?craftingQuality(pawn.skills.construction.level,()=>healthRandom(qualityStream)):undefined;if(quality)world.rng=qualityStream.rng;
    const builtId=world.nextId++,shelf=isShelfKind(job.kind)?newShelfStorage(footprintCells(job).map(()=>world.nextId++),world.schemaVersion):undefined;
    world.structures.push({ ...(job.kind==='ship-cryptosleep-casket'?{shipCryptosleep277:newShipCasketHolder277(world.tick)}:{}), ...(job.kind==='cryptosleep-casket'?{cryptosleep:newCryptosleepHolder271(world.tick)}:{}), ...(job.kind==='vent'?{vent:newVentState()}:{}), ...(shelf?{shelf}:{}), ...(job.kind==='spike-trap'?{spikeTrap:initialSpikeTrapState(world,job)}:{}),...(job.kind==='mini-turret'?{turret:newMiniTurretState()}:{}),...(job.kind==='hospital-bed'?{medical:true as const}:{}),...(job.kind==='grave'?{grave:initialGrave()}:job.kind==='sarcophagus'?{grave:{colonists:true,strangers:false}}:{}),...(job.kind==='pen-marker'?{pen:{accepted:[...penAnimalsForVersion(world.schemaVersion)]}}:{}),...(job.kind==='heater'?{heater:newHeaterState()}:{}),...(job.kind==='wind-turbine'?{wind:newWindTurbineState()}:{}),...(job.kind==='battery'?{battery:{stored:0}}:{}),...(job.kind==='cooler'?{cooler:newCoolerState()}:{}),...(job.kind==='flower-pot'?{flower:createFlowerPotState()}:{}),...(quality?{quality}:{}),...(isElectrical(job.kind)?{power:newPowerState(job.kind)}:{}),...(isPassageDoor(job.kind)?{door:builtDoorState(world,job)}:{}),...(job.material?{material:job.material}:{}),...(isFueledBuilding(job.kind)?{fuel:newBuildingFuel(job.kind as import('./types.ts').StructureKind)}:{}),...(job.kind==='fueled-smithy'||job.kind==='electric-smithy'||job.kind==='brewery'||job.kind==='electric-crematorium'||job.kind==='electric-smelter'||job.kind==='biofuel-refinery'||job.kind==='drug-lab'||job.kind==='art-bench'||job.kind==='machining-table'||job.kind==='fabrication-bench'||job.kind==='tailor-bench'||job.kind==='electric-tailor-bench'||job.kind==='campfire'||isFoodWorkstation(job.kind)||job.kind==='stonecutter'?{bills:[]}:{}), id: builtId, kind: job.kind as import('./types.ts').StructureKind, x: job.x, z: job.z, orientation: job.orientation, footprint: job.footprint });
      if(job.kind==='firefoam-popper')initializeFirefoamPopper290(world,world.structures.at(-1)!);
    if(job.kind==='fermenting-barrel')world.structures.at(-1)!.fermentation=newFermentationState265();
    if(job.kind==='geothermal-generator'){const built=world.structures.at(-1)!;built.geothermal=createGeothermalState264(world,built);}
    clearSnowForStructure(world,world.structures.at(-1)!);
    if(job.kind==='hydroponics-basin')initializeHydroponicBasin(world,world.structures.at(-1)!);
    if(isShipComputerSensorsKind298(job.kind)||isShipPartKind276(job.kind)||job.kind==='geothermal-generator'||job.kind==='vent'||job.kind==='fence'||job.kind==='fence-gate'||job.kind==='pen-marker'||job.kind==='wall'||isRoomDoor(job.kind)||job.kind==='cooler')invalidateAnimalPens(world);
  }
  if(job.kind==='cooler'||job.kind==='wall'||isRoomDoor(job.kind))autoRoofRooms(world,job);
  removeIdentity(world.jobs,job); pawn.jobId = null; pawn.path = []; if(!medicallyStopped(pawn))pawn.state = 'idle'; pawn.planCooldown = 0;
  event(world, 'job', `${pawn.name} a terminé le travail : ${JOB_LABEL[job.kind]}.`); wakePlanners(world);
}
const workEnvironments=new WeakMap<World,WorkEnvironmentCache>();
function environmentCache(world:World):WorkEnvironmentCache {
  let cache=workEnvironments.get(world);if(!cache){cache=new WorkEnvironmentCache();workEnvironments.set(world,cache);}return cache;
}
function reconcileSmoothFloorJobs281(world:World,readGeometry?:()=>ReturnType<typeof captureStructureNavigation>):void {
  let invalid:Set<number>|undefined;let geometry:ReturnType<typeof captureStructureNavigation>|undefined;
  for(const j of world.jobs)if(j.kind==='smooth-floor'){geometry??=readGeometry?.()??captureStructureNavigation(world);if(smoothFloorReason281(world,j,j.id,geometry))(invalid??=new Set()).add(j.id);}
  if(invalid)cancelIntentJobs(world,invalid);
}
const readPlantLight=(world:World):LightEnvironment=>environmentCache(world).readLight(world);
const plantLightSourcesKey=(world:World):string=>lightSources(world).map(s=>`${s.cell}:${s.radius}:${s.red}:${s.green}:${s.blue}:${s.overlightRadius??0}`).join('|');
export function stepWorld(world:CampaignState,ticks=1,diagnostics?:import('./work-planner.ts').SearchStats,caravans?:import('./group-campaign-runtime-256.ts').GroupCampaignRuntime256):void {
  if(!Number.isInteger(ticks)||ticks<0||ticks>100000)throw new Error('Tick count must be an integer between 0 and 100000.');
  const root=campaignAuthority(world as World);
  if(isCorePhysicalSchema297(Number(root.schemaVersion))&&!macro297.has(root)){for(let i=0;i<ticks*10;i++)advanceWorldCore297(root,diagnostics,caravans);return;}
  if(root.worldMaps){
    if(pendingCaravan261(root)||pendingWorldEntry263(root))return;
    if(ticks>0&&root.schemaVersion>=256&&!caravans&&root.worldGroups?.groups.some(r=>'members'in r.state?!!r.state.travel:'manifest'in r.state&&r.state.travelPreparation===true))throw Error('Prospective caravan requires its confirmed Core runtime before advancing time');
    if(ticks)for(const map of registeredMaps(root)){adoptTempMapIncidents261(map);flushRegisteredMap(map);}
    adoptWorldIncidents(campaignClockContext(root));
    for(let i=0;i<ticks;i++){
      const firefoamWorldOwners290=isSchema290OrLater(Number(root.schemaVersion))?captureFirefoamWorldPawnIds290(root):undefined;
      root.tick++;
      if(isCorePhysicalSchema297(Number(root.schemaVersion))){root.phaseCore297=0;beginCoreMacro297(root);syncWorldPawnsPhysicalCore297(root);advanceActualWorldPawns256(root,firefoamWorldOwners290);}
      for(const map of registeredMaps(root)){stepLocalWorld(map,1,diagnostics,false);flushRegisteredMap(map);}
      if(root.schemaVersion>=256&&caravans)caravans.step(root);
      else for(const g of root.worldGroups!.groups.slice().sort((a,b)=>a.state.id-b.state.id))if('members' in g.state)withWorldGroup(root,g.state.id,advanceGroup);
      if((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&caravans)for(const map of registeredMaps(root)){tryGroupDeparture(map,caravans);flushRegisteredMap(map);}
      for(const id of advanceCaravanArrivals261(root))caravans?.encounterChanged261(root,id);
      for(const row of root.worldGroups!.groups.slice()){const g=row.state;if(!row.encounters261&&'members' in g&&['at-site','awaiting-entry'].includes(g.phase)&&root.worldMaps!.sites.some(m=>m.tile===g.tile&&m.kind==='settlement'))enterRegisteredSite(root,g.id,'visit',false);}
      for(const old of root.worldGroups!.legacyTravellers){const view=legacyTravellerContext(root,old);advanceScoutTrip(view);advanceCommercialTrip(view);if(view.scout)old.scout=view.scout;else delete old.scout;if(view.commercialTrip)old.commercialTrip=view.commercialTrip;else delete old.commercialTrip;}
      advanceTradeRequests284(root);expirePeaceTalks293(root);advanceWorldSites263(root);advanceForeignSettlementDefeat263(root);advanceSettlementProximity263(root);advanceWorldIncidents(campaignClockContext(root));advanceBattlefieldVictory261(root);advanceCampPressure260(root);removeEmptyCamps(root);advanceTempMapIncidents261(root);
      if(!isCorePhysicalSchema297(Number(root.schemaVersion)))advanceActualWorldPawns256(root,firefoamWorldOwners290);advanceCaravanMapExits261(root);
      if(pendingCaravan261(root)||pendingWorldEntry263(root)||advanceCaravanIncidents261(root))break;
    }return;
  }
  if(!root.secondarySite){stepLocalWorld(root,ticks,diagnostics);return;}
  // One clock/allocator/PRNG, stable home-then-secondary order. Every map uses
  // the genuine local engine and receives each confirmed campaign tick once.
  for(let i=0;i<ticks;i++){
    stepLocalWorld(root,1,diagnostics);
    const local=secondaryContext(root)!;
    stepLocalWorld(local,1,diagnostics,false);
    // Both maps must observe the same exact Core end boundary before a
    // shared solar condition expires. The single-map historical order stays.
    advanceWorldIncidents(root);
    flushSecondaryContext(root);
  }
}
function stepLocalWorld(world: World, ticks = 1, diagnostics?:import('./work-planner.ts').SearchStats,advanceClock=true): void {
  if (!Number.isInteger(ticks) || ticks < 0 || ticks > 100000) throw new Error('Tick count must be an integer between 0 and 100000.');
  if(!ticks)return;
  adoptTempMapIncidents261(world);adoptSecondaryIncidents(world);
  // Old profiles start this new stream prospectively, when play resumes.
  // Loading or pausing never invents a past opportunity or heat exposure.
  if(!tempMapModern261(world)){adoptMiscIncidents(world);adoptWeatherIncidents(world);adoptShortCircuits(world);adoptCropBlights(world);adoptToxicFallout294(world);}
  adoptDeepResources(world);adoptOrbital(world);
  if(!isSecondaryContext(world))adoptWorldIncidents(world);
  adoptSmallIncidents(world);
  adoptRainElectrical(world);
  let thermal=reconcileTemperature(world);reconcilePlantLighting(world,()=>readPlantLight(world));updateFoodTemperatures(world,thermal);updatePlantTemperatures(world,thermal);
  for (let step = 0; step < ticks; step++) {
    const firefoamLocalMechs290=isSchema290OrLater(Number(world.schemaVersion))?new Set((world.mechanoids??[]).filter(m=>m.state!=='dead'&&m.health?.coveredInFirefoam290).map(m=>m.id)):undefined;
    flushColonyLosses(world);
    if(advanceClock){world.tick++;if(isCorePhysicalSchema297(Number(world.schemaVersion))){world.phaseCore297=0;beginCoreMacro297(campaignAuthority(world));syncWorldPawnsPhysicalCore297(campaignAuthority(world));}}advanceActualHiveComponents256(world);advanceAnimalAges256(world);finishSnowSteps(world);
    let light:LightEnvironment|undefined,lightKey:string|undefined;
    const getLight=()=>{if(!light){light=readPlantLight(world);lightKey=plantLightSourcesKey(world);}return light;};
    advanceHumanAges(world);
    sampleColonyEconomy(world);
    advanceArrivals(world);advanceHeatwaves(world);advanceMiscIncidents(world);advanceSmallIncidents(world);advanceVisitors(world);advancePodRescues(world);advanceFluIncidents(world);
    advanceToxicFalloutEnvironment294(world);
    const beforeWeather=world.structures;
    advanceSurfaceWeather(world,cell=>{const c={type:'designate' as const,kind:'chop' as const,...cell};if(canDesignate(world,c).ok)applyLocalCommand(world,c);});
    if(beforeWeather!==world.structures)thermal=reconcileTemperature(world);
    advancePower(world);advanceHydroponics(world);advanceOrbital(world);
    advanceCropBlight(world);
    if(!world.worldMaps&&!isSecondaryContext(world)&&!world.secondarySite)advanceWorldIncidents(world);
    const beforeElectricalRain=world.structures;
    advanceRainElectrical(world);
    if(beforeElectricalRain!==world.structures)thermal=reconcileTemperature(world);
    advanceBreakdowns(world);
    expireFood(world);
    advanceDeterioration(world,thermal);
    thermal=advanceSurfaceTemperature(world,thermal,getLight);
    advanceFermentation265(world,thermal);
    if(burnFuel(world))light=undefined; // Empty torches cannot light later work in this same tick.
    const trapContacts=isCorePhysicalSchema297(Number(world.schemaVersion))?undefined:spikeTrapWindow(world);
    advanceTameness(world);reconcileDomesticWork(world);syncCarriedAnimals(world);reconcileAnimalRescues(world);reconcileAnimalRest(world);
    advanceSiteAmbush263(world);advanceSiteMechanoids263(world);
    if(!trapContacts){advanceWildlife(world);reconcileAnimalRescues(world);reconcileAnimalRest(world);}
    updateDoors(world);
    advancePrisonBreaks(world);
    const structuresBeforeCombat=world.structures;
    reconcileAllowedAreas(world);if(isCorePhysicalSchema297(Number(world.schemaVersion)))advanceCoreMap297(world,true);else advanceWorldCombat(world,trapContacts);
    if(trapContacts){advanceWildlife(world);reconcileAnimalRescues(world);reconcileAnimalRest(world);}
    syncCarriedAnimals(world);advanceLocalEggs256(world,thermal);reconcileAnimalRescues(world);reconcileAnimalRest(world);advanceCorpses(world,thermal);advanceMechanoidCorpses(world);reconcileDomesticWork(world);advanceAnimalProducts(world);advanceHumanCorpses(world);advanceDeathThoughts(world);reconcileBurials(world);reconcileCommercialOnMap(world);
    detachMissingBills(world);detachMissingSmithingBills267(world);detachMissingGunBills(world);detachMissingFlakBills(world);detachMissingArtBills(world);detachMissingComponentBills(world);detachMissingProstheticBills273(world);if(world.tick%20===0)reconcileBreakdownJobs(world);reconcileRepairs(world);reconcilePowerFlicks(world);
    expireStaggers(world);advanceFilth(world,weatherRainRate(world));
    scheduleGrowing(world);
    scheduleRoofs(world);advanceWorldApparelWear(world);reconcilePrisoners(world);reconcileRescues(world);reconcileWarden(world);reconcilePatientRest(world);reconcileTending(world);reconcileSurgery(world);reconcilePasteRequests(world);reconcileFeeding(world);reconcileEquipmentTasks(world);for(const pawn of world.pawns){if(factionCommsTask298(pawn))reconcileFactionComms298(world,pawn);if(pawn.orbitalTrade)reconcileOrbitalTrade(world,pawn);if(pawn.deepWork)reconcileDeepWork(world,pawn);reconcileWeaponMemory(world,pawn);}
    reconcileBillReservePauses289(world);
    // Build only if this tick actually plans or moves. No cross-tick cache can hide
    // a command, edited terrain, restored save, or a wall that changed between calls.
    let blocked: Uint8Array | undefined;
    const structureNavigation=structureNavigationReader(world);reconcileSmoothFloorJobs281(world,structureNavigation.read);
    let roofs: RoofContext | undefined;
    let environment:WorkEnvironment|undefined;
    let furnitureSight:ReturnType<typeof captureFurnitureSight>|undefined;
    const getEnvironmentCache=()=>{
      return environmentCache(world);
    };
    if(structuresBeforeCombat!==world.structures)light=undefined;
    const getEnvironment=()=>environment??=getEnvironmentCache().read(world,getLight());
    const getFurnitureSight=()=>furnitureSight??=captureFurnitureSight(world);
    // Sparse live references for this decision phase. Each consumer still
    // rechecks hostility/state; ordinary fauna is not scanned per colonist.
    const bombSources=captureBombDangerSources(world);
    const animalThreats=captureAnimalCombatThreats256(world);
    const getThreats=()=>threatQueries(world,animalThreats);
    advanceBeautyNeeds(world,getLight().topology);
    advanceFlowerPots(world,getLight(),new TemperatureView(world,thermal));
    const hasAdversary=world.pawns.some(p=>p.faction==='outlaws'&&!p.prisoner||prisonBreakActive(p)||p.mental?.crisis?.kind==='berserk')||animalThreats.length>0||(world.mechanoids??[]).some(m=>!['dead','downed'].includes(m.state));
    let thermalDirty=structuresBeforeCombat!==world.structures;
    const invalidateEnvironment=()=>{if(isCorePhysicalSchema297(Number(world.schemaVersion)))invalidateHumanMoveSpeed297(world);environment=undefined;light=undefined;furnitureSight=undefined;thermalDirty=true;structureNavigation.invalidate();};
    const getRoofs = () => roofs ??= new RoofContext(world);
    const getBlocked: NavigationGrid = () => blocked ??= blockedCells(world,false,structureNavigation.read());
    const occupied = CIVIL_TRANSIT_BLOCKERS;
    const budget: SearchBudget = isCorePhysicalSchema297(Number(world.schemaVersion))?coreState297(world).movement.budget():{ remaining: PATH_SEARCHES_PER_TICK, pairs: 32768,stats:diagnostics,structureGeometry:structureNavigation.read };
    if(isCorePhysicalSchema297(Number(world.schemaVersion))){budget.stats=diagnostics;budget.structureGeometry=structureNavigation.read;}
    const processMechanicalDecisions=()=>{
      const actors=world.mechanoids;if(!actors?.length)return;
      const batch=mechanoidCombatBatch(world,getBlocked);
      for(let offset=0;offset<actors.length;offset++){const actor=actors[(world.tick-1+offset)%actors.length]!;
        if(trapContacts?.visit(actor)){blocked=undefined;invalidateEnvironment();}processMechanoidCombat(world,actor,getBlocked,budget,getLight,batch);}
    };
    // Both populations share the unchanged global search/pair cap. Alternate
    // first admission and rotate owners so a continuously busy colony cannot
    // starve the mechanical tail. Historical worlds take the same human path.
    if(world.tick%2)processMechanicalDecisions();
    // Borrow the real opening population; no array copy on the common path.
    // A casket transaction replaces the authority array rather than splicing
    // this iteration. Newly released people start decisions on the next tick.
    const actingHumans271=world.pawns,actingCount271=actingHumans271.length;
    // Current thermal phase already owns its topology and region array. Borrow
    // one O(1) view for the whole human pass; public readers keep their exact
    // mutable point lookup. Historical exposure branches retain their reader.
    const humanAir460=isSchema282OrLater(world.schemaVersion)?new TemperatureView(world,thermal):undefined;
    reconcileParty292(world,getLight().topology);
    for (let offset = 0; offset < (world.schemaVersion>=271?actingCount271:world.pawns.length); offset++) {
      const pawn = world.schemaVersion>=271?actingHumans271[((world.tick-1)+offset)%actingCount271]!:world.pawns[((world.tick-1)+offset)%world.pawns.length]!;
      if(world.schemaVersion>=271&&world.pawns!==actingHumans271&&!world.pawns.includes(pawn))continue;
      if(trapContacts?.visit(pawn)){blocked=undefined;invalidateEnvironment();}
      const completedEdge=pawn.moveCooldown>0&&(pawn.motion?.end??0)<=world.tick;
      pawn.moveCooldown = Math.max(0, (pawn.motion?.end ?? world.tick) - world.tick); if (pawn.planCooldown > 0) pawn.planCooldown--;
      const readAir460=()=> (humanAir460??new TemperatureView(world,thermal)).at(world,pawn);
      advanceHeatExposure(world,pawn,readAir460);
      const body=updatePawnHealth(world,pawn);reconcilePartyPawn292(world,pawn,body);reconcileCouple285(world,pawn,body);reconcileKidnapParticipant261(world,pawn);reconcileAncientCasketOpening256(world,pawn);reconcileFirefoamManual290(world,pawn);reconcileCryptosleepTask271(world,pawn);reconcileShipCasketTask277(world,pawn);
      reconcileAllowedAreaPawn(world,pawn);
      if(pawn.animalRescue)reconcileAnimalRescues(world,pawn);
      if(prisonBreakActive(pawn)&&(pawn.state==='downed'||pawn.state==='dead'))endPrisonBreak(world,pawn);
      if(scoutOnMapId(world)===pawn.id&&(pawn.state==='dead'||pawn.state==='downed'))applyScoutCommand(world,{type:'scout-cancel'});
      if(commercialOnMapId(world)===pawn.id&&(pawn.state==='dead'||pawn.state==='downed'))applyCommercialPreparation(world,{type:'commercial-cancel'});
      if(groupOnMapMember(world,pawn.id)&&(pawn.state==='dead'||pawn.state==='downed'&&!groupHumanPassenger257(world,pawn.id)||pawn.mental?.crisis))cancelPawnGroupPreparation257(world,pawn.id);
      if(pawn.equipmentDropPending)dropIncapacitatedEquipment(world,pawn,true);
      if(pawn.state==='dead'){expireMealMemories(world,pawn);updateMentalBreak(world,pawn);continue;}
      if(completedEdge)recordFilthMovement(world,pawn);
      if(pawn.health)bleedFilth(world,pawn,medicalBleed(pawn.health),pawn.state==='downed'||pawn.state==='sleeping');
      tickSkills(world,pawn);
      updateNeeds(world, pawn,body,getFurnitureSight,()=>getLight().topology,readAir460);
      updateMentalBreak(world,pawn,budget);reconcileAncientCasketOpening256(world,pawn);reconcileFirefoamManual290(world,pawn);reconcileCryptosleepTask271(world,pawn);reconcileShipCasketTask277(world,pawn);
      reconcilePartyPawn292(world,pawn,body);reconcileCouple285(world,pawn,body);
      if(prisonBreakActive(pawn)&&(pawn.mental?.crisis||pawn.state==='downed'||pawn.need))endPrisonBreak(world,pawn);
      if(pawn.mental?.crisis){
        if(scoutOnMapId(world)===pawn.id)applyScoutCommand(world,{type:'scout-cancel'});
        if(commercialOnMapId(world)===pawn.id)applyCommercialPreparation(world,{type:'commercial-cancel'});
      }
      if(pawn.animalRescue)reconcileAnimalRescues(world,pawn);
      if(processPawnVomiting(world,pawn)){if(prisonBreakActive(pawn))endPrisonBreak(world,pawn);continue;}
      if(pawn.stun&&pawn.stun.untilCore<=world.tick*10)delete pawn.stun;
      // Lying-down opportunities precede the ordinary downed/medical sleeper
      // dispatcher. Immobility alone is not an inability to be awake in bed.
      tryCoupleOpportunity285(world,pawn,body);
      if(pawn.coupleTask285){
        collapseFromExhaustion(world,pawn,{event:message=>event(world,'need',message)});
        reconcileCouple285(world,pawn,body);
        if(pawn.coupleTask285&&(pawn.state==='downed'||isStunned(pawn,world.tick*10))){processCouple285(world,pawn);continue;}
      }
      if(isForcedConsuming(pawn)&&!consumeActivityValid(world,pawn))interruptDraftWork(world,pawn);
      if(pawn.jobId!==null&&(pawn.stun||pawn.burning||pawn.bombRefuge||pawn.heatRefuge||pawn.tactics||pawn.draft)){const tree=world.jobs.find(j=>j.id===pawn.jobId&&j.tree);if(tree&&treeJobReason(world,tree,pawn))interruptWork(world,pawn);}
      if(pawn.state==='downed'||carrierOf(world,pawn.id)||isStunned(pawn,world.tick*10))continue;
      if(!isDraftedTending(pawn)&&!isDraftedRescue(world,pawn)&&!isForcedConsuming(pawn)&&(hasAdversary||pawn.meleeThreat&&world.tick*10-pawn.meleeThreat.atCore<=400)&&!pawn.prisoner&&!pawn.mental?.crisis){considerAutomaticCombat(world,pawn,budget,animalThreats);considerFlee(world,pawn,getThreats());}
      if(pawn.need?.kind==='eat' && pawn.need.dining && !validDiningPlace(world,pawn.need.dining)) {pawn.need.phase='choose-spot';pawn.need.dining=null;pawn.need.progress=0;delete pawn.need.workRemainder;pawn.path=[];pawn.state='moving';}
      if(factionCommsTask298(pawn))reconcileFactionComms298(world,pawn);if(pawn.orbitalTrade)reconcileOrbitalTrade(world,pawn);if(pawn.deepWork)reconcileDeepWork(world,pawn);
      reconcileAllowedAreaPawn(world,pawn);
      if (pawn.moveCooldown > 0) { if(pawn.draft)pawn.draft.lastActiveTick=world.tick; pawn.state = groupOnMapMember(world,pawn.id) || scoutOnMapId(world)===pawn.id || commercialOnMapId(world)===pawn.id || pawn.brewing || factionCommsTask298(pawn) || pawn.orbitalTrade || pawn.deepWork || pawn.animalHandling || pawn.animalCare || pawn.animalFeed || pawn.animalRescue || pawn.burial || pawn.shipCasketTask277 || pawn.cryptosleepTask || pawn.openCasket || pawn.firefoamTask290 || pawn.cleaning || pawn.visitor || pawn.podRescue || pawn.trade || pawn.burning || pawn.firefighting || pawn.hunting || pawn.mental?.crisis || pawn.raid || pawn.tactics || pawn.melee || pawn.flee || pawn.draft || pawn.bombRefuge || pawn.heatRefuge || pawn.research || pawn.allowedAreaReturn || pawn.jobId !== null || pawn.equipmentTask || pawn.ward || pawn.feed || pawn.tend || pawn.surgery || pawn.rescue || pawn.haul || pawn.need || pawn.cooking || pawn.recreation.task || isSchema300OrLater(Number(world.schemaVersion))&&idleWanderTask300(pawn)?.kind==='move' ? 'moving' : 'idle'; continue; }
      const needsContext = {
        recreationTopology:()=>getLight().topology,
        searchAllowed:(policy:import('./allowed-area-state.ts').AllowedAreaPolicy)=>searchAllowed(world,pawn,getBlocked(),occupied,budget,policy),
        search: (goals?: ReadonlySet<number>) => search(world, pawn, getBlocked(), occupied, budget, goals),
        move: (target: Cell, exact: boolean) => moveToward(world, pawn, target, true, getBlocked, budget, exact, getLight),
        release: () => releaseWork(world, pawn),
        event: (message: string) => event(world, 'need', message),
      };
      if(processBurning(world,pawn,needsContext))continue;
      if(bombDanger(world,pawn,getBlocked,budget,getLight,bombSources))continue;
      if(pawn.coupleTask285&&processHeatRefuge(world,pawn,needsContext,thermal))continue;
      if(processCouple285(world,pawn))continue;
      // An explicit clinical mandate keeps its mobilisation. Physiology,
      // captured travel, stun and immediate fire/bomb danger ran above it.
      if(isForcedConsuming(pawn)){
        if(pawn.draft)pawn.draft.lastActiveTick=world.tick;
        collapseFromExhaustion(world,pawn,needsContext);
        if(isForcedConsuming(pawn))processEating(world,pawn,needsContext);
        continue;
      }
      if(isDraftedTending(pawn)&&(!pawn.draft||pawn.mental?.crisis))reconcileTending(world);
      if(isDraftedTending(pawn)){
        pawn.draft!.lastActiveTick=world.tick;
        if(!processDraftSleep(world,pawn,needsContext)&&isDraftedTending(pawn))
          processTending(world,pawn,needsContext,()=>getLight().speedAt(pawn),()=>searchCandidates(world,pawn,getBlocked(),occupied,budget));
        continue;
      }
      if(isDraftedRescue(world,pawn)){
        pawn.draft!.lastActiveTick=world.tick;
        if(!processDraftSleep(world,pawn,needsContext)&&isDraftedRescue(world,pawn))processRescue(world,pawn,needsContext);
        continue;
      }
      if(processGroupOnMap(world,pawn,needsContext))continue;
      if(processCommercialOnMap(world,pawn,needsContext))continue;
      if(processScoutLoading(world,pawn,needsContext))continue;
      if(processPrisonBreak(world,pawn,getBlocked,budget,getLight,needsContext))continue;
      if(pawn.prisoner&&!(world.schemaVersion>=213&&isColonist(pawn)&&pawn.mental?.crisis)&&pawn.mental?.crisis?.kind!=='confused-wander'){processPrisoner(world,pawn,needsContext);continue;}
      if(pawn.mental?.crisis){
        if(isAggressiveCrisis(pawn.mental))processAggressiveCrisis(world,pawn,getBlocked,budget,getLight,needsContext);
        else processMentalBreak(world,pawn,needsContext,()=>searchCandidates(world,pawn,getBlocked(),occupied,budget));
        continue;
      }
      if(pawn.visitor){processVisitor(world,pawn,needsContext);continue;}
      if(isSiteAmbushHuman263(world,pawn)){if(!processDraftSleep(world,pawn,needsContext))processSiteAmbushHuman263(world,pawn,getBlocked,budget,getLight);continue;}
      if(isWorldTargetDefender263(world,pawn)){if(!processDraftSleep(world,pawn,needsContext))processWorldTargetDefender263(world,pawn,getBlocked,budget,getLight);continue;}
      if(pawn.raid){if(!processDraftSleep(world,pawn,needsContext))processRaider(world,pawn,getBlocked,budget,getLight);continue;}
      if(pawn.tactics&&(!pawn.allowedAreaId||pawn.tactics.targetId!==null||pawn.tactics.post!==null)){if(!processDraftSleep(world,pawn,needsContext))processTactics(world,pawn,getBlocked,budget,getLight);continue;}
      if(pawn.melee&&(!pawn.allowedAreaId||pawn.melee.order||pawn.melee.strike)){if(!processDraftSleep(world,pawn,needsContext)&&pawn.melee)processMelee(world,pawn,getBlocked,budget,getLight);continue;}
      if(processPodRescuePatient(world,pawn,needsContext))continue;
      if(!isColonist(pawn)){if(!processDraftSleep(world,pawn,needsContext))processSentry(world,pawn,getThreats());continue;}
      if(pawn.flee){if(!processDraftSleep(world,pawn,needsContext)&&pawn.flee)processFlee(world,pawn,getThreats(),getBlocked,budget,getLight);continue;}
      if(pawn.shooting)collapseFromExhaustion(world,pawn,needsContext);
      // Finish post-shot recovery before choosing another civilian activity.
      if(pawn.hunting&&pawn.shooting?.stance?.phase==='cooldown')continue;
      if(pawn.shooting&&!pawn.hunting&&(!pawn.allowedAreaId||pawn.shooting.order||pawn.shooting.stance)){if(pawn.draft)pawn.draft.lastActiveTick=world.tick;continue;}
      if(pawn.shipCasketTask277&&processShipCasketTask277(world,pawn,needsContext))continue;
      if(pawn.draft&&processFirefighting(world,pawn,needsContext))continue;
      if(pawn.draft&&draftTurretService(world,pawn)){
        pawn.draft.lastActiveTick=world.tick;
        if(!processDraftSleep(world,pawn,needsContext)){
          if(advanceOrders(world,pawn,getBlocked,budget))continue;
          if(advancePriorityWork(world,pawn,getBlocked,budget))continue;
          if(pawn.haul?.destination.type==='turret')processHaul(world,pawn,(target,allow)=>moveToward(world,pawn,target,allow,getBlocked,budget,false,getLight),()=>wakePlanners(world));
        }
        continue;
      }
      if(pawn.draft){if(!processDraftSleep(world,pawn,needsContext)){processDraft(world,pawn,getBlocked,budget,getLight);if(pawn.moveCooldown===0)retryInterruptedCargo(world,pawn);}continue;}
      if(pawn.firefighting&&processFirefighting(world,pawn,needsContext))continue;
      if(pawn.interruptedCargo){processNeeds(world,pawn,needsContext);continue;}
      if (leaveTransitCell(world,pawn,getBlocked,budget,getLight)) continue;
      if(factionCommsTask298(pawn)&&processFactionComms298(world,pawn,needsContext))continue;
      if(pawn.orbitalTrade&&processOrbitalTrade(world,pawn,needsContext))continue;
      if(pawn.trade&&processTrade(world,pawn,needsContext))continue;
      if(pawn.equipmentTask){processEquipment(world,pawn,needsContext);continue;}
      if(pawn.cryptosleepTask&&processCryptosleepTask271(world,pawn,needsContext))continue;
      if(pawn.firefoamTask290&&processFirefoamManual290(world,pawn,needsContext))continue;
      if(pawn.openCasket&&processAncientCasketOpening256(world,pawn,needsContext))continue;
      if(pawn.orders.active==='bury'&&pawn.burial){processBurial(world,pawn,needsContext);continue;}
      if(pawn.cleaning?.forced&&processCleaning(world,pawn,needsContext))continue;
      // An admitted FinishFrame owns its whole finite visit. Its paid work,
      // expiry and Ready run in the real Core owner, not again in this macro.
      const frameOwner301=Number(world.schemaVersion)===301?coreState297(world).frame:undefined;
      if(frameOwner301?.owns(pawn)){
        if(!pawn.frameToil301&&pawn.postureUntilCore301===undefined){
          const frame=frameOwner301.currentFrame(pawn);
          if(frame&&!frameOwner301.admitAtContact(pawn))
            moveToward(world,pawn,constructionWorkTarget(world,frame),false,getBlocked,budget,false,getLight);
        }
        continue;
      }
      if (advanceOrders(world,pawn,getBlocked,budget)) continue;
      if (!pawn.animalHandling&&!pawn.animalCare&&!pawn.animalFeed&&!pawn.animalRescue&&!pawn.ward&&!pawn.feed&&!pawn.tend&&!pawn.surgery&&!pawn.rescue&&advancePriorityWork(world,pawn,getBlocked,budget)) continue;
      if(processIdleWander300(world,pawn,{...needsContext,candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),blocked:getBlocked}))continue;
      if(processHeatRefuge(world,pawn,needsContext,thermal))continue;
      if(processFirefighting(world,pawn,needsContext))continue;
      if (planUrgentCare(world,pawn,()=>searchCandidates(world,pawn,getBlocked(),occupied,budget))) continue;
      const needDecision300=processNeedsDecision300(world,pawn,needsContext);
      if(needDecision300==='handled')continue;
      const pendingCurrent300=needDecision300==='pending-current';
      let idlePlanningResolved300=false;
      // A pending food offer may resume only the existing task below, never
      // another provider, a replacement job or a new idle/recreation offer.
      if(!pendingCurrent300){
        if(processAutomaticAlcohol265(world,pawn,needsContext))continue;
      if(processParty292(world,pawn,needsContext))continue;
      if (!pawn.animalHandling&&!pawn.animalCare&&!pawn.animalFeed&&!pawn.animalRescue&&!pawn.ward&&!pawn.feed&&!pawn.tend&&!pawn.surgery&&!pawn.rescue&&pawn.orders.active===null&&processRecreation(world, pawn, needsContext)) continue;
      if(!pawn.surgery&&pawn.planCooldown===0&&recoverDroppedWeapon(world,pawn,()=>searchCandidates(world,pawn,getBlocked(),occupied,budget)))continue;
      if(!pawn.surgery&&pawn.planCooldown===0&&considerApparelPolicy(world,pawn,()=>searchCandidates(world,pawn,getBlocked(),occupied,budget)))continue;
      if(processReturnToAllowedArea(world,pawn,needsContext))continue;
      if (pawn.jobId === null && pawn.haul === null && !pawn.rescue && !pawn.animalHandling && !pawn.animalCare && !pawn.animalFeed && !pawn.animalRescue && !pawn.ward&&!pawn.feed&&!pawn.tend&&!pawn.surgery && !pawn.cooking && !pawn.hunting && !pawn.orbitalTrade && !pawn.deepWork && !pawn.brewing && !pawn.research && !pawn.burial && !pawn.cleaning && pawn.planCooldown === 0) {planWork(world, pawn, getBlocked, occupied, budget);idlePlanningResolved300=isSchema300OrLater(Number(world.schemaVersion))&&budget.remaining>0&&budget.pairs>0&&pawn.planCooldown>0;}
      }
      if(pawn.firefighting&&processFirefighting(world,pawn,needsContext))continue;
      if(pawn.animalRescue){processAnimalRescue(world,pawn,needsContext);continue;}
      if(pawn.animalHandling){processHandling(world,pawn,{...needsContext,candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),blocked:getBlocked});continue;}
      if(pawn.animalFeed){processAnimalFeeding(world,pawn,needsContext);continue;}
      if(pawn.animalCare){processAnimalCare(world,pawn,{...needsContext,candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),blocked:getBlocked},()=>getLight().speedAt(pawn));continue;}
      if(pawn.hunting){processHunting(world,pawn,{...needsContext,candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),blocked:getBlocked});continue;}
      if(pawn.burial){processBurial(world,pawn,needsContext);continue;}
      if(processCleaning(world,pawn,needsContext))continue;
      if(pawn.brewing){processBarrelExtraction265(world,pawn,needsContext.move,()=>wakePlanners(world));continue;}
      if(pawn.deepWork){processDeepWork(world,pawn,needsContext,()=>getLight().speedAt(pawn));continue;}
      if(pawn.research){processResearch(world,pawn,needsContext.move,s=>researchRate(pawn,s,getEnvironment(),new TemperatureView(world,thermal).at(world,s),world),message=>event(world,'job',message));continue;}
      if(pawn.ward){processWarden(world,pawn,needsContext);continue;}
      if(pawn.feed){processFeeding(world,pawn,needsContext);continue;}
      if(pawn.surgery){processSurgery(world,pawn,needsContext,()=>getLight().lightAt(pawn),cell=>getLight().lightAt(cell));continue;}
      if(pawn.tend){processTending(world,pawn,needsContext,()=>getLight().speedAt(pawn),()=>searchCandidates(world,pawn,getBlocked(),occupied,budget));continue;}
      if(pawn.rescue){processRescue(world,pawn,needsContext);continue;}
      if (pawn.haul) { const refueling=pawn.haul.destination.type==='fuel';processHaul(world, pawn, (target, allow) => moveToward(world, pawn, target, allow, getBlocked, budget,false,getLight), () => {wakePlanners(world);if(refueling)invalidateEnvironment();});continue; }
      if(pawn.cooking) {const priorProduct=pawn.cooking.productId,priorPhase=pawn.cooking.phase;processCooking(world,pawn,{
        workRate:(station,worker)=>getEnvironment().production(station,worker).total*((isFoodWorkstation(station.kind)||station.kind==='butcher-spot'||station.kind==='crafting-spot'||station.kind==='tailor-bench'||station.kind==='electric-tailor-bench'||station.kind==='machining-table'||station.kind==='art-bench'||station.kind==='drug-lab'||station.kind==='fueled-smithy'||station.kind==='electric-smithy'||station.kind==='brewery'||station.kind==='biofuel-refinery'||station.kind==='electric-crematorium'||station.kind==='electric-smelter')?tailoringTemperatureFactor(new TemperatureView(world,thermal).at(world,station.kind==='electric-crematorium'?pawn.cooking!.spot:station)):1)*(taskWork(pawn.cooking!)==='cook'||isMechSalvageRecipe(pawn.cooking!.recipe)||pawn.cooking!.recipe==='make-medicine'||isBiofuelRecipe(pawn.cooking!.recipe)||pawn.cooking!.recipe==='burn-apparel'||pawn.cooking!.recipe==='smelt-weapon'||pawn.cooking!.recipe==='smelt-apparel'||isSmithingRecipe267(pawn.cooking!.recipe)||pawn.cooking!.recipe==='cremate-corpse'?1:physicalWorkFactor(pawn,'craft',body)),
        candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),
        search:goals=>search(world,pawn,getBlocked(),occupied,budget,goals),
        move:(target,exact)=>moveToward(world,pawn,target,true,getBlocked,budget,exact,getLight),
        release:()=>releaseWork(world,pawn),event:message=>event(world,'job',message),
      });if(pawn.cooking?.productId!==priorProduct||priorPhase!=='output'&&pawn.cooking?.phase==='output')reconcileBillReservePauses289(world);continue;}
      const job = world.jobs.find(candidate => candidate.id === pawn.jobId); if (!job) {
        if(pendingCurrent300)continue;
        if(processReturnToAllowedArea(world,pawn,needsContext))continue;
        if(processRecreation(world,pawn,needsContext,true,isSchema300OrLater(Number(world.schemaVersion))?'idle300':'ordinary'))continue;
        if(idlePlanningResolved300&&budget.remaining>0&&budget.pairs>0)offerIdleWander300(world,pawn,{...needsContext,candidates:()=>searchCandidates(world,pawn,getBlocked(),occupied,budget),blocked:getBlocked});
        continue;
      }
      // A job admitted by Main in THIS macro has not passed the earlier
      // owned-job branch. Admit its toil without paying old macro work once.
      if(Number(world.schemaVersion)===301&&coreState297(world).frame!.owns(pawn)){
        const frame=coreState297(world).frame!;
        if(!frame.admitAtContact(pawn))moveToward(world,pawn,constructionWorkTarget(world,job),false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.tree){const beforeResources=world.resources,beforePiles=world.piles,beforeJobs=world.jobs;processTreeWork(world,pawn,job,(target,touch)=>moveToward(world,pawn,target,false,getBlocked,budget,false,getLight),getLight().speedAt(pawn));if(world.resources!==beforeResources||world.piles!==beforePiles||world.jobs!==beforeJobs){blocked=undefined;roofs=undefined;invalidateEnvironment();}continue;}
      if(backgroundWorkRefusal(pawn,workType(job))){releaseWork(world,pawn);continue;}
       if ((job.growingZoneId !== undefined||job.flowerPotId!==undefined) && !growingJobValid(world, job)) { releaseWork(world, pawn); world.jobs = world.jobs.filter(j => j.id !== job.id); continue; }
      if (job.kind === 'sow' && groundPile(world, job)) { releaseWork(world, pawn); continue; }
      if(isRoofJob(job)) {
        if(!roofJobWanted(world,job,getRoofs())){releaseWork(world,pawn);reconcileRoofJobs(world,getRoofs());continue;}
        const tree=job.kind==='build-roof'?world.resources.find(r=>r.kind==='tree'&&sameCell(r,job)):undefined;
        if(tree&&!job.clearance){
          if(world.jobs.some(j=>j.id!==job.id&&sameCell(j,tree)&&(!isRoofJob(j)||j.clearance))){releaseWork(world,pawn);continue;}
          job.clearance={resourceId:tree.id,progress:0};
        }
      }
      if(job.clearance) {
        const plant=world.resources.find(r=>r.id===job.clearance!.resourceId);
        if(!plant){releaseWork(world,pawn);continue;}
        if(adjacent(pawn,plant)) {
          pawn.path=[];finishArrivalFacing256(pawn,plant);pawn.state='working';const duration=clearingDuration(plant);
          // Only the exact persisted output boundary uses the planner cooldown.
          // Ordinary assigned jobs already have a cooldown and must still work.
          const outputPending=clearanceOutputPending(job,duration);
          if(outputPending&&pawn.planCooldown>0)continue;
          // The first failed producer already paid the completion work/XP.
          // A retry is output preflight, never another tick of plant work.
          if(!outputPending)advanceWork(job.clearance,getLight().speedAt(pawn)*plantWorkRate(pawn,body,world.schemaVersion>=235&&clearingKind(world,plant)==='cut'?plantCanYieldNow(world,plant):plant.kind==='tree'&&choppable(world,plant)&&berryYield(world,plant)>0)*plantWorkGrowthFactor256(world,plant));
          if(outputPending||job.clearance.progress>=duration) {
            const quantity=gatherResource(world,plant,clearingKind(world,plant),job.id,pawn);
            if(quantity===null){retainClearingWorkAfterOutputRefusal(job,duration);pawn.planCooldown=20;continue;}
            event(world,'job',`${pawn.name} a dégagé le chantier${plant.kind!=='tree'&&quantity>0?` et a récolté ${quantity} ${harvestProductLabel(plant)}`:''}.`);
            releaseWork(world,pawn);wakePlanners(world);
          }
        } else moveToward(world,pawn,constructionWorkTarget(world,job),false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.kind==='flick'){
        if(footprintCells(job).some(c=>adjacent(pawn,c))&&!footprintCells(job).some(c=>sameCell(pawn,c))){pawn.path=[];finishArrivalFacing256(pawn,job);pawn.state='working';if(advancePowerFlick(world,job)){releaseWork(world,pawn);world.jobs=world.jobs.filter(j=>j!==job);invalidateEnvironment();event(world,'job',`${pawn.name} a actionné l’interrupteur.`);}}
        else moveToward(world,pawn,job,false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.kind==='repair'){
        if(ancientRepairContact256(world,pawn,job)){if(advanceRepair(world,pawn,job,getLight().speedAt(pawn),body)){releaseWork(world,pawn);world.jobs=world.jobs.filter(j=>j!==job);event(world,'job',`${pawn.name} a réparé l’ouvrage.`);}}
        else moveToward(world,pawn,ancientRepairTarget256(world,job),false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.kind==='fix-breakdown'){
        if(!constructionSupplied(world,job)){releaseWork(world,pawn);continue;}
        if(footprintCells(job).some(c=>adjacent(pawn,c))&&!footprintCells(job).some(c=>sameCell(pawn,c))){
          const result=advanceBreakdownFix(world,pawn,job,body);
          if(result){releaseWork(world,pawn);if(result==='success'){world.jobs=world.jobs.filter(j=>j!==job);event(world,'job',`${pawn.name} a remplacé le composant en panne.`);}else event(world,'job',`${pawn.name} a échoué à remplacer le composant ; une autre pièce est nécessaire.`);}
        }else moveToward(world,pawn,job,false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.kind==='sow'&&packedAt(world,job)){releaseWork(world,pawn);continue;}
      if(job.furniture){if(advanceFurniture(world,pawn,job,target=>moveToward(world,pawn,target,false,getBlocked,budget,false,getLight),()=>releaseWork(world,pawn),()=>constructionWorkRate(pawn,job,getLight().speedAt(pawn),body))){blocked=undefined;roofs=undefined;invalidateEnvironment();wakePlanners(world);}continue;}
      if(job.kind==='deconstruct'&&!deconstructionAvailable(world,job,pawn.id)){releaseWork(world,pawn);continue;}
      if(isConstruction(job)&&(pawn.skills.construction.level<(job.kind==='lay-floor'&&job.floor?FLOOR_DEFINITIONS[job.floor].skill:constructionSkillRequired(job.kind))||!constructionSupplied(world,job)||!constructionSiteFree(world,job,pawn.id))){releaseWork(world,pawn);continue;}
      if(job.kind==='smooth-floor'){
        if(smoothFloorReason281(world,job,job.id,structureNavigation.read())){cancelIntentJobs(world,new Set([job.id]));continue;}
        if(canTouchSmoothFloor281(world,pawn,job,structureNavigation.read())){
          if(advanceSmoothFloor281(world,pawn,job,getLight().lightAt(pawn),body,structureNavigation.read())){removeIdentity(world.jobs,job);pawn.jobId=null;pawn.state='idle';pawn.planCooldown=0;blocked=undefined;roofs=undefined;invalidateEnvironment();wakePlanners(world);event(world,'job',`${pawn.name} a terminé le lissage du sol.`);}
        }else moveToward(world,pawn,job,false,getBlocked,budget,false,getLight);
        continue;
      }
      if(job.kind==='mine') {
        if(Math.max(Math.abs(pawn.x-job.x),Math.abs(pawn.z-job.z))===1) {
          if(advanceMining(world,pawn,job,()=>getLight().speedAt(pawn),body)) {removeIdentity(world.jobs,job);pawn.jobId=null;pawn.state='idle';pawn.planCooldown=0;reconcileRoofSupport(world,false,job);reconcilePawnHealth(world,pawn);blocked=undefined;roofs=undefined;invalidateEnvironment();wakePlanners(world);event(world,'job',`${pawn.name} a terminé le minage.`);}
        } else moveToward(world,pawn,job,false,getBlocked,budget,false,getLight);
        continue;
      }
      const cells = footprintCells(job);
      if (cells.some(cell => adjacent(pawn, cell)) && !cells.some(cell => sameCell(pawn, cell))) {
        pawn.path = []; finishArrivalFacing256(pawn,job);pawn.state = 'working';
        // Historical frames (including zero-material graves) are not erased
        // during load/designation. Retire their small plants at real work contact.
        const frameCells=isConstruction(job)&&job.construction==='frame'&&job.kind!=='lay-floor'&&job.kind!=='build-bridge'?footprintCells(job):undefined;
        // Empty footprints need no transaction, JSON signature or drop plan.
        // Read living resources directly, so no stale cache can miss a plant.
        if(frameCells&&world.resources.some(r=>isConstructionLightPlant(r)&&frameCells.some(c=>sameCell(c,r)))){
          const retirement=planConstructionPlantRetirement(world,job,job.id,'frame');
          if(!retirement||!commitConstructionPlantRetirement(world,retirement))continue;
        }
        const plantJob=job.kind==='sow'||job.kind==='harvest'||job.kind==='cut'||job.kind==='chop';
        const tree=job.kind==='chop'?resourceAt(world,job.z*world.width+job.x):undefined;
        const cutSource=world.schemaVersion>=235&&job.kind==='cut'&&job.flowerPotId===undefined?resourceAt(world,job.z*world.width+job.x):undefined;
        const plantLearning=job.kind==='sow'||job.kind==='harvest'||!!tree&&choppable(world,tree)&&berryYield(world,tree)>0||!!cutSource&&plantCanYieldNow(world,cutSource);
        // Only CUT235 on a ground Resource reuses the paid output boundary.
        // Flower pots and all historical CHOP/HARVEST paths keep their work.
        const cutOutputPending=world.schemaVersion>=235&&job.kind==='cut'&&job.flowerPotId===undefined&&workOutputPending(job,jobDuration(world,job));
        if(cutOutputPending&&pawn.planCooldown>0)continue;
        const physicalPlant=job.flowerPotId===undefined&&['harvest','cut','chop'].includes(job.kind)?resourceAt(world,job.z*world.width+job.x):undefined;
        if(!cutOutputPending)advanceWork(job,plantJob?getLight().speedAt(pawn)*plantWorkRate(pawn,body,plantLearning)*(physicalPlant?plantWorkGrowthFactor256(world,physicalPlant):1):constructionWorkRate(pawn,job,getLight().speedAt(pawn),body));
        if (cutOutputPending||workProgress(job) >= jobDuration(world, job)) {completeJob(world, pawn, job);blocked=undefined;roofs=undefined;invalidateEnvironment();}
      } else moveToward(world, pawn, job, false, getBlocked, budget,false,getLight);
    }
    if(!(world.tick%2))processMechanicalDecisions();
    for(const pawn of [...world.pawns])if(pawn.visitor)exitVisitor(world,pawn);
    reconcilePodRescueResults(world);
    for(const pawn of [...world.pawns])if(pawn.podRescue)exitPodRescue(world,pawn);
    for(const pawn of world.pawns)if(pawn.trade&&!world.pawns.some(t=>t.id===pawn.trade!.traderId&&t.visitor)){delete pawn.trade;pawn.path=[];pawn.state='idle';}
    for(const pawn of [...world.pawns])if(pawn.prisoner?.escape)exitPrisoner(world,pawn);
    if(world.raids)for(const pawn of [...world.pawns])if(pawn.raid?.exiting&&!pawn.prisoner)exitRaider(world,pawn);
    const scoutId=scoutOnMapId(world);
    if(scoutId!==null){const pawn=world.pawns.find(p=>p.id===scoutId);if(pawn)departScout(world,pawn);}
    const commercialId=commercialOnMapId(world);
    if(commercialId!==null){const pawn=world.pawns.find(p=>p.id===commercialId);if(pawn)departCommercial(world,pawn);}
    reconcileGroupPreparation(world);
    tryGroupDeparture(world);
    advanceColonyAdaptation(world);
    const reactorStep275=advanceShipReactors275(world);
    advanceShipReactorThreats275(world,reactorStep275.starting);
    if(reactorStep275.completed)event(world,'command',reactorStep275.completed===1?'Un réacteur stellaire a terminé son démarrage.':`${reactorStep275.completed} réacteurs stellaires ont terminé leur démarrage.`);
    advanceRaids(world);
    advanceQuests(world);
    advanceSocial(world);
    advanceParty292(world,getLight().topology);
    if(world.roofing)reconcileRoofJobs(world,roofs);
    reconcileFires(world);reconcilePowerFlicks(world);reconcilePower(world);reconcileOrders(world);syncCarriedAnimals(world);reconcileAnimalRescues(world);reconcileAnimalRest(world);reconcileWildlife(world);advanceCorpses(world,thermal);advanceMechanoidCorpses(world);reconcileDomesticWork(world);advanceHumanCorpses(world);reconcileBurials(world);reconcileCommercialOnMap(world);
    if(world.hunting)world.hunting.targets=world.hunting.targets.filter(id=>world.wildlife?.animals.some(a=>a.id===id&&a.state!=='dead')||world.pawns.some(p=>p.hunting?.animalId===id));
    // Death is captured before an active traveller becomes an immutable archive.
    if(world.schemaVersion>=236)advanceMinifiedTrees(world);
    advanceScoutTrip(world);advanceCommercialTrip(world);if(!world.worldMaps&&!isSecondaryContext(world))advanceGroup(world);
    advanceAncientShrineWarnings256(world);
    advanceStartingArrival(world);if(world.schemaVersion<236)advanceMinifiedTrees(world);
    refreshStock(world);reconcileBillReservePauses289(world);reconcileSpikeTrapContacts(world);
    if(thermalDirty)thermal=reconcileTemperature(world);
    updateFoodTemperatures(world,thermal);
    if(light&&lightKey!==plantLightSourcesKey(world))light=undefined;
    reconcilePlantLighting(world,getLight);updatePlantTemperatures(world,thermal);reconcileSmoothFloorJobs281(world,structureNavigation.read);reconcilePrisoners(world);reconcileRescues(world);reconcileWarden(world);reconcilePatientRest(world);reconcileTending(world);reconcileSurgery(world);reconcilePasteRequests(world);reconcileFeeding(world);reconcileEquipmentTasks(world);const contactRoster298=coreMaps297.get(world)?.contacts;contactRoster298?.beginRosterSync(effectiveCore297(world));for(let slot298=0;slot298<world.pawns.length;slot298++){const pawn=world.pawns[slot298]!;if(factionCommsTask298(pawn))reconcileFactionComms298(world,pawn);if(pawn.orbitalTrade)reconcileOrbitalTrade(world,pawn);if(pawn.deepWork)reconcileDeepWork(world,pawn);reconcileWeaponMemory(world,pawn);contactRoster298?.observeRosterPawn(pawn,slot298);}contactRoster298?.finishRosterSync();
    reconcileGroupAdmission257(world);
    reconcileAnimalHauls282(world);
    advanceLocalMechFirefoam290(world,firefoamLocalMechs290);advanceFirefoamWaves290(world);
    for(const pawn of world.pawns)if(pawn.firefoamTask290)reconcileFirefoamManual290(world,pawn);
    finishToxicFallout294(world);
  }
}
import { updatePawnHealth,reconcilePawnHealth } from './health.ts';
import { advanceStartingArrival } from './starting-arrival.ts';
import { medicallyStopped,physicalWorkFactor } from './health-rules.ts';


function woodWallOwner301(world:World):ReturnType<typeof createWoodWallCore301> {
 let light:LightEnvironment|undefined;
 const owner=createWoodWallCore301(world,{
  rate:p=>rateForPawn301(world,p),
  light:p=>(light??=readPlantLight(world)).speedAt(p),
  complete:(p,j)=>{completeJob(world,p,j);return !world.jobs.includes(j);},
  release:p=>releaseWork(world,p),
  event:message=>event(world,'job',message),
 });
 return {...owner,invalidate(){light=undefined;owner.invalidate();}};
}
interface CoreMap297 {
 movement:ReturnType<typeof createCoreMovement297>;
 frame?:ReturnType<typeof createWoodWallCore301>;
 idle?:ReturnType<typeof createIdleWanderCore300>;
 physics:ReturnType<typeof createCorePhysics297>;
 contacts?:ReturnType<typeof createConsoleContactCore298>;
 result?:CoreStepResult297;
}
const coreMaps297=new WeakMap<World,CoreMap297>(),macro297=new WeakSet<World>();
/** Canonical register plus the explicitly retained historical two-map form. */
function actualCoreMaps297(root:World):World[]{
 if(!root.worldMaps&&root.secondarySite){const local=secondaryContext(root);if(!local)throw Error('Legacy secondary owner disappeared');return [root,local];}
 return registeredMaps(root);
}
function beginCoreMacro297(root:World):void {
 for(const map of actualCoreMaps297(root)){coreState297(map).movement.beginMacro({remaining:PATH_SEARCHES_PER_TICK,pairs:32768});flushRegisteredMap(map);}
 if(!root.worldMaps&&root.secondarySite)flushSecondaryContext(root);
}

function coreState297(world:World):CoreMap297 {
 let state=coreMaps297.get(world);if(!state){state={movement:createCoreMovement297(world),physics:createCorePhysics297(world),...(Number(world.schemaVersion)===301?{frame:woodWallOwner301(world)}:{}),...(isSchema300OrLater(Number(world.schemaVersion))?{idle:createIdleWanderCore300(world)}:{}),...(isSchema298OrLater(Number(world.schemaVersion))?{contacts:createConsoleContactCore298(world)}:{})};coreMaps297.set(world,state);}return state;
}
function invalidateCoreCampaign297(root:World,reason:'macro'|'command'|'movement'|'impact'):void {
 for(const map of actualCoreMaps297(root)){invalidateHumanMoveSpeed297(map);const state=coreMaps297.get(map);if(state){state.physics.invalidate(reason);state.movement.invalidate();state.idle?.invalidate();state.frame?.invalidate();if(reason==='macro'||reason==='impact')state.contacts?.invalidateActive(effectiveCore297(map),reason);}}
}
function advanceCoreMap297(world:World,boundary=false):CoreStepResult297 {
 const state=coreState297(world);
 if(boundary){invalidateHumanMoveSpeed297(world);state.physics.invalidate('macro');state.idle?.invalidate();state.frame?.invalidate();}
 const moved=state.movement.advance();if(moved.changedCells||moved.topologyChanged)state.physics.invalidate('movement');
 const result=state.physics.advance(effectiveCore297(world));
 if(result.requiresFull||moved.topologyChanged)state.frame?.invalidate();
 const frameStep301=state.frame?.advance(result.core);
 if(frameStep301?.requiresFull){state.physics.invalidate('impact');state.movement.invalidate();state.frame?.invalidate();}
 const expired=expirePhysicalActorTimers297(world);
 const idleStep300=state.idle?.advance(effectiveCore297(world));
 const contacts=state.contacts,core=result.core;
 if(result.observerEffects297.threatsChanged||frameStep301?.requiresFull)contacts?.invalidateActive(core,'impact');
 const physicalActorChanges298=[...moved.actorsChanged,...result.actorsChanged,...expired,...(idleStep300?.actorsChanged??[]),...(frameStep301?.actorsChanged??[])];
 contacts?.notifyActorsChanged(core,physicalActorChanges298);
 const contactStep=contacts?.advance(core);
 // Reindex only the actually changed owner on a causal roster mismatch.
 if(contactStep?.rosterSyncIds.length)for(const id of contactStep.rosterSyncIds){const slot=world.pawns.findIndex(p=>p.id===id);if(slot>=0)contacts!.observeCommandPawn(world.pawns[slot]!,slot,core);}
 const reactorStep=advanceShipReactorsCore297(world);
 if(reactorStep?.completed)event(world,'command',reactorStep.completed===1?'Un réacteur stellaire a terminé son démarrage.':`${reactorStep.completed} réacteurs stellaires ont terminé leur démarrage.`);
 if(result.requiresFull||frameStep301?.requiresFull){state.movement.invalidate();invalidateHumanMoveSpeed297(world);}
 state.result={...result,observerEffects297:{threatsChanged:result.observerEffects297.threatsChanged||moved.topologyChanged||!!frameStep301?.requiresFull,audioChanged:result.observerEffects297.audioChanged||moved.topologyChanged||!!frameStep301?.requiresFull},requiresFull:result.requiresFull||moved.requiresFull||!!frameStep301?.requiresFull||!!reactorStep?.completed||!!contactStep?.requiresFull||!!idleStep300?.requiresFull,deferredChange297:moved.deferredChange297,doorsMoved297:moved.doorsMoved297,actorsChanged:[...new Set(contactStep?.actorsChanged.length?[...physicalActorChanges298,...contactStep.actorsChanged]:physicalActorChanges298)]};return state.result;
}
/** requiresFull preserves the existing conservative boundary signal. Only the
 * fixed bridge may use the separate actual hard receipt to coalesce calm macros. */
export interface AdvancedCoreMap297 extends CoreStepResult297 {mapId:number;world:World;readonly requiresHardFull297:boolean;
 /** Changes a calm Full may publish (footprint filth, trodden snow, a released
  * idle wander): published by the next calm Full or caught by the macro actor
  * dependency check, rather than a hard Full. Never a simulation input. */
 readonly deferredFull297:boolean;
 /** Doors that opened or closed during this step (ids). A frontier anchor
  * presents them with a door patch; any other anchor needs a hard Full. */
 readonly doorsMoved297:readonly number[]}
/** A single authoritative physical step. Phase0 is an atomic global/local macro
 * transaction. Results borrow maps only until the synchronous bridge copies them. */
export function advanceWorldCore297(world:CampaignState,diagnostics?:import('./work-planner.ts').SearchStats,caravans?:import('./group-campaign-runtime-256.ts').GroupCampaignRuntime256):{core:number;localTickCompleted:boolean;maps:readonly AdvancedCoreMap297[]} {
 const root=campaignAuthority(world as World);if(!isCorePhysicalSchema297(Number(root.schemaVersion)))throw Error('Physical stepping requires297');
 const previous=effectiveCore297(root),maps=actualCoreMaps297(root);
 if(pendingCaravan261(root)||pendingWorldEntry263(root))return {core:previous,localTickCompleted:false,maps:[]};
 for(const map of maps)coreState297(map); // capture the LAST completed Core before moving the real clock
 const boundary=root.phaseCore297===9;
 if(boundary){macro297.add(root);try{stepWorld(root,1,diagnostics,caravans);}finally{macro297.delete(root);}}
 else {root.phaseCore297=root.phaseCore297!+1;syncWorldPawnsPhysicalCore297(root);
  for(const map of maps){advanceCoreMap297(map);flushRegisteredMap(map);}if(!root.worldMaps&&root.secondarySite)flushSecondaryContext(root);
 }
 const core=effectiveCore297(root);if(core!==previous+1)throw Error('Physical step did not commit exactly one Core');
 const results:AdvancedCoreMap297[]=[];
 const publishedMaps=boundary?actualCoreMaps297(root):maps;
 // Compare actual owner identities, not exposed map headers. A new/replaced,
 // retired or reordered registered owner keeps an unconditional hard barrier.
 const ownersChanged=boundary&&(publishedMaps.length!==maps.length||publishedMaps.some((map,index)=>map!==maps[index]));
 for(const map of publishedMaps){let result=coreMaps297.get(map)?.result;
  if(!result||result.core!==core){
   if(!boundary||maps.includes(map))throw Error('Missing local physical frontier');
   // The macro suffix genuinely created/replaced this registered local owner.
   // Its first state is already at this frontier; it has played no earlier Core.
   result={core,actorsChanged:[],projectileEvents:{upserted:[],removed:[]},requiresFull:true,observerEffects297:{threatsChanged:true,audioChanged:true},strikeAudio297:[],shotAudio297:[]};
  }
  results.push({...result,mapId:!root.worldMaps&&root.secondarySite&&map!==root?1:registeredMapId(map)??0,world:map,requiresFull:boundary||result.requiresFull||!!result.deferredChange297||!!result.doorsMoved297?.length,requiresHardFull297:ownersChanged||result.requiresFull,deferredFull297:!!result.deferredChange297,doorsMoved297:result.doorsMoved297??[]});
 }
 // Macro suffixes may create/retire owners or alter cover. Never retain their borrowed captures.
 if(boundary)invalidateCoreCampaign297(root,'macro');
 return {core,localTickCompleted:boundary,maps:results};
}
