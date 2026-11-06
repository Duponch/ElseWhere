import {validGeographicCreationSize262,validGeographicCreationSeason262,type GeographicCreationSize262,type GeographicCreationSeason262} from './geographic-creation-options-262.ts';
import {initializeGeographicRenewal262} from './geographic-renewal-state-262.ts';
import {crashlandedProfile} from './game-profile.ts';
import {constructAncientCasketGroupIds256,type AncientCasketGroupIds256} from './ancient-casket-group-ids-256.ts';
import {configuredGeographicStartClock256} from './geographic-start-clock-256.ts';
/** One unpublished Base_Player256 candidate. Progress never exposes a World;
 * cancellation/refusal discards this invocation, never a running colony.
 * The required actual Shrine producer is deliberately NOT replaced by its
 * room envelope or by a callback that merely declares success. */
import type {AncientHumanNameWorking256} from './ancient-human-name-256.ts';
import {SCHEMA_VERSION,type World} from './types.ts';
import type {StartingParty} from './starting-candidates.ts';
import type {GeographicWorldDraft256} from './world-geographic-draft.ts';
import {isCampaignGeography256,type CampaignGeography256} from './world-geography-owner-256.ts';
import {createGeographicPlanet256} from './planet-factory-256.ts';
import {describeWorldSite,localGenerationStepSeed} from './world-site-geography.ts';
import {geographicPlanetClimateDefinition256} from './site-climate.ts';
import {validStartingOriginalRequest256,type StartingOriginalRequest256} from './starting-original-request-256.ts';
import {prepareStartingOriginalDraft256} from './starting-original-draft-256.ts';
import {wakeUnfoggedTempleMechs256} from './temple-mech-duty-256.ts';
import {attachStartingOriginalRoster256,requireOriginalStartingWorld256,type StartingOriginalRoster256} from './starting-original-roster-256.ts';
import {prepareGeographicPhysicalMap256} from './geographic-map-physical-256.ts';
import {portableLocalRoadAngular256} from './local-road-angular-256.ts';
import {populateGeographicRoads256} from './geographic-roads-256.ts';
import {CORE_4871_GEN_STEP_DEFS,CORE_4871_PAWN_KIND_ORDER} from './core-definition-order-4871.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import {generateMonumentRuins750256} from './ancient-monument-spawn-256.ts';
import {ANCIENT_STEP_SEEDS_256,type AncientPlacementContext256,type AncientScatterResult256,type AncientRect256} from './local-ancient-placement-256.ts';
import {findPlayerStartSpot256,PLAYER_START_SEED_PART_256} from './player-start-256.ts';
import {applyCoreStartingScenParts256} from './starting-scenparts-core-256.ts';
import {CORE_STARTING_SCENPARTS_SEED_PART_256} from './starting-scenparts-data-256.ts';
import {applyCoreStartingPostMap256} from './starting-post-map-256.ts';
import {populateGeographicInitialPlants256} from './geographic-initial-plants-256.ts';
import {generateLocalGeysers256} from './local-geyser-generation-256.ts';
import {planVanishMineable256} from './local-mineable-owner-256.ts';
import {planVanishGeneratedAncient256} from './generated-ancient-vanish-256.ts';
import {localBiomeRules256} from './local-biome-rules-v256.ts';
import {footprintCells} from './definitions.ts';
import {populateGeographicRockChunks256,ROCK_CHUNKS_SEED_PART_256} from './geographic-rock-chunks-256.ts';
import {populateGeographicCaveHives256} from './geographic-cave-hives-256.ts';
import {constructCampaignLordIds256,type HiveLordIds256} from './cave-hive-lord-ids-256.ts';
import {hiveReproductionFactor256} from './cave-hive-profile-256.ts';
import {initializeGeographicInitialSnow256,INITIAL_SNOW_SEED_PART_256} from './initial-snow-256.ts';
import {produceInitialAnimals256,INITIAL_ANIMALS_SEED_PART_256,GEOGRAPHIC_FAUNA_PROFILE_256} from './initial-animals-256.ts';
import {captureRandomClosewalk256} from './random-closewalk-256.ts';
import {initializeExploration256,INITIAL_FOG_SEED_PART_256,type FogEdgeSelectionContext256} from './exploration-initial-256.ts';
import {captureActualFogPhysical256} from './exploration-physical-256.ts';
import {captureGeographicGenerationReachability256} from './geographic-generation-reachability-256.ts';
import {generateLocalRiverFlow256} from './local-river-flow-256.ts';
import {packRiverWater256} from './river-water-owner-256.ts';
import {isNaturalTerrain256,NATURAL_TERRAIN_DEFINITIONS_256} from './local-terrain-definitions-256.ts';
import {initialMapGenerationRuntime256,captureMapGenerationRuntime256,finishMapGenerationRuntime256} from './map-generation-runtime-256.ts';
import {finalizeInitialWorldRegistry} from './world-map-context.ts';
import {adoptWind} from './wind.ts';
import {ensureFireState} from './fire-rules.ts';
import {validateWorld} from './serialization.ts';
import { structuresOfKind } from './structure-navigation.ts';

const BASE_STEPS=new Set(['ElevationFertility','MutatorPostElevationFertility','RocksFromGrid','Terrain','MutatorPostTerrain','Roads','MutatorCriticalStructures','MutatorNonCriticalStructures','ScatterShrines','ScatterRuinsSimple','FindPlayerStartSpot','ScenParts','Plants','SteamGeysers','RockChunks','CaveHives','Snow','Animals','Fog','MutatorFinal']);
export const BASE_PLAYER_GENERATION_ORDER_256=Object.freeze(CORE_4871_GEN_STEP_DEFS.filter(row=>BASE_STEPS.has(row.defName)).sort((a,b)=>a.order-b.order||a.index-b.index));
const EXPECTED=['ElevationFertility','MutatorPostElevationFertility','RocksFromGrid','Terrain','MutatorPostTerrain','Roads','MutatorCriticalStructures','MutatorNonCriticalStructures','ScatterShrines','ScatterRuinsSimple','FindPlayerStartSpot','ScenParts','Plants','SteamGeysers','RockChunks','CaveHives','Snow','Animals','Fog','MutatorFinal'];
export interface GeographicNewGameInput256 {draft:GeographicWorldDraft256;geography:CampaignGeography256;tile:number;size:GeographicCreationSize262;season?:GeographicCreationSeason262;scenario:'crashlanded';startingParty:StartingParty}
export interface GeographicNewGameProgress256 {phase:string;completed:number;total:number}
export interface InitialGenerationWorking256 {adjacentPermutation:number[];adjacentUses:number;edgeContext?:FogEdgeSelectionContext256;rootsToUnfog:number[]}
/** The concrete750 implementation must run ScatterShrines INCLUDING its
 * selected interior/loot/caskets/occupants/triggers. Envelope-only is not a
 * conforming implementation. No instance is supplied by this partial lot. */
export interface ActualShrines750256 {
 generate(world:World,context:AncientPlacementContext256,random:WorldGenerationRandom,owners:{roster:StartingOriginalRoster256;working:InitialGenerationWorking256;lordIds:HiveLordIds256;casketGroupIds:AncientCasketGroupIds256;absoluteCore:number;humanNames?:AncientHumanNameWorking256}):AncientScatterResult256;
}
export interface GeographicNewGameBindings256 {shrines750:ActualShrines750256}
/** No owner, constructor, random stream or terrain is changed by this guard. */
export function requireGeographicNewGameInputs256(input:GeographicNewGameInput256,bindings:GeographicNewGameBindings256|undefined):{bindings:GeographicNewGameBindings256;request:StartingOriginalRequest256} {
 if(!bindings||typeof bindings.shrines750?.generate!=='function')throw Error('Unresolved actual ScatterShrines750/interior_ancientTemple producer; Base_Player cannot be published');
 if(!input||!validGeographicCreationSize262(input.size)||input.season!==undefined&&!validGeographicCreationSeason262(input.season)||input.scenario!=='crashlanded'||!validStartingOriginalRequest256(input.startingParty))throw Error('The actual eight-entry original roster is required, never a three-entry preview');
 const {draft,geography,tile}=input;
 if(!draft||draft.revision!==1||!isCampaignGeography256(geography)||geography.surface!==draft.surface||geography.roads!==draft.roads||draft.factions.generatedAt!==0||!Number.isSafeInteger(draft.nextThingId)||draft.nextThingId<1||!Number.isSafeInteger(tile)||tile<0||tile>=geography.surface.tiles.length)throw Error('Actual confirmed geographic draft/owner/frontier required');
 if(BASE_PLAYER_GENERATION_ORDER_256.length!==EXPECTED.length||BASE_PLAYER_GENERATION_ORDER_256.some((d,i)=>d.defName!==EXPECTED[i]))throw Error('Observed Core Base_Player order disagrees; no alphabetical or omitted750 substitution');
 return {bindings,request:input.startingParty};
}
/** Same public worker API; ROOT must wire the actual second argument ONLY
 * after its concrete750 producer is complete. A one-argument call fails before
 * allocating the eight originals, not after returning a partial map. */
export function* createGeographicNewGame256(input:GeographicNewGameInput256,bindings?:GeographicNewGameBindings256):Generator<GeographicNewGameProgress256,World,void> {
 const accepted=requireGeographicNewGameInputs256(input,bindings),request=accepted.request;
 const {draft,geography,tile,size}=input,total=BASE_PLAYER_GENERATION_ORDER_256.length;
 const planet=createGeographicPlanet256({geography,factions:draft.factions,homeTile:tile,adoptedAt:0,nextGroupId:1});
 const description=describeWorldSite(geography.surface,geography.roads,tile),definition=geographicPlanetClimateDefinition256(planet,tile),{calendarOrigin,absoluteCore}=configuredGeographicStartClock256(definition,input.season??'auto');
 if(!Number.isSafeInteger(absoluteCore)||absoluteCore<0)throw Error('Actual initial absolute clock is invalid');
 // Existing genuine constructor's initial gameplay RNG, distinct from OUTER
 // map-generation Rand and all SeedPart streams. The zero-seed sentinel is its
 // existing explicit constructor rule, never a missing captured input default.
 const runtimeRng=(description.mapSeed>>>0)||0x9e3779b9;
 const roster=prepareStartingOriginalDraft256(draft,geography,tile,request,absoluteCore,size),lordIds=constructCampaignLordIds256(),casketGroupIds=constructAncientCasketGroupIds256(),runtimeBirth=initialMapGenerationRuntime256();
 // The current authored NPC producer owns its actual names/backgrounds. Do
 // not construct an unused native-name context or load its research tables.
 const working:InitialGenerationWorking256={...captureMapGenerationRuntime256(runtimeBirth,size,size),adjacentUses:0,rootsToUnfog:[]};
 // ClearWorkingData/rootsToUnfog.Clear are genuine new MapGenerator operations;
 // empty working rectangles/roots do not stand in for a captured old owner.
 const layoutRects:AncientRect256[]=[],usedRects:AncientRect256[]=[];
 yield {phase:'physical10-220',completed:0,total};
 const physical=prepareGeographicPhysicalMap256({schemaVersion:SCHEMA_VERSION,planet,factions:draft.factions,tile,width:size,height:size,tick:0,calendarOrigin,nextId:roster.nextId,rng:runtimeRng,initialWeather:{gameInitDataPresent:true,daysPassedSinceSettle:0},definitionContext:{isStartingMap:true,mapInitializing:true,tutorial:false,nomadicFactor:.5,usedRectCells:new Set()}}),w=physical.world;
 // Creation choices exist before MapGenerator in the real new-game lifecycle.
 // This factory exposes only the same supported Crashlanded preset. Establish
 // it here before750 difficulty consumers; never infer it in a reader/load.
 w.gameProfile=crashlandedProfile();
 attachStartingOriginalRoster256(w,roster);
 const stream=(part:number)=>new WorldGenerationRandom(localGenerationStepSeed(description.mapSeed,part,0));
 yield {phase:'Roads390',completed:5,total};
 const roads=populateGeographicRoads256(w,usedRects,portableLocalRoadAngular256);
 if(roads.edges.cells!==null)working.edgeContext={width:size,height:size,edgeCells:[...roads.edges.cells]};
 // The four admitted modifiers have no500/700 structures overrides. Their
 // actual nontrivial Init/elevation/terrain effects already ran in physical.
 const ancient:AncientPlacementContext256={startingMap:true,waterCovered:description.waterCovered,mapInitializing:true,layoutRects,usedRects};
 yield {phase:'ScatterShrines750',completed:8,total};
 const shrines=accepted.bindings.shrines750.generate(w,ancient,stream(ANCIENT_STEP_SEEDS_256.shrines),{roster,working,lordIds,casketGroupIds,absoluteCore});
 if(!shrines||!Number.isSafeInteger(shrines.requested)||!Number.isSafeInteger(shrines.scattered)||shrines.scattered<0||shrines.scattered>shrines.requested||typeof shrines.skipped!=='boolean'||typeof shrines.exhausted!=='boolean')throw Error('Actual750 producer did not return its scatter outcome');
 yield {phase:'ScatterRuinsSimple750',completed:9,total};
 generateMonumentRuins750256(w,ancient,stream(ANCIENT_STEP_SEEDS_256.ruins));
 yield {phase:'FindPlayerStartSpot850',completed:10,total};
 const rect=(r:AncientRect256)=>({minX:r.minX,minZ:r.minZ,width:r.maxX-r.minX+1,height:r.maxZ-r.minZ+1}),start=findPlayerStartSpot256({map:w,layoutRects:layoutRects.map(rect),usedRects:usedRects.map(rect)},stream(PLAYER_START_SEED_PART_256));
 if(start.cell===null)throw Error('Actual850 produced no player start; no relocation or dry-ground fallback');
 yield {phase:'ScenParts875',completed:11,total};
 applyCoreStartingScenParts256(w,{roster,start850:start.cell,layoutRects},stream(CORE_STARTING_SCENPARTS_SEED_PART_256));
 yield {phase:'Plants900',completed:12,total};
 const plants=populateGeographicInitialPlants256(w);let plant=plants.next();while(!plant.done){yield {phase:'Plants900',completed:12,total};plant=plants.next();}
 yield {phase:'SteamGeysers950',completed:13,total};
 const rules=localBiomeRules256(description.biome,256);if(!rules)throw Error('Actual biome definition absent');
 const caskets=[...structuresOfKind(w,'ancient-cryptosleep-casket')].map(s=>{const cells=footprintCells(s),xs=cells.map(c=>c.x),zs=cells.map(c=>c.z);return {id:s.id,x:Math.min(...xs),z:Math.min(...zs),width:Math.max(...xs)-Math.min(...xs)+1,height:Math.max(...zs)-Math.min(...zs)+1};});
 generateLocalGeysers256(w,{waterCovered:description.waterCovered,biomeFactor:rules.scalars.geyserCountFactor,mutatorFactors:[],layoutRects,usedRects,ancientCaskets:caskets,mapInitializing:true,planEdificeRemoval(cell){
  const rock=w.tiles[cell]?.mineable;if(rock)return planVanishMineable256(w,cell,rock.id,true);
  // Only the verified real generated750/road props may Vanish without product.
  // A nonempty casket/other edifice is NOT silently deleted here.
  return planVanishGeneratedAncient256(w,cell,true);
 }},stream(1158116095));
 yield {phase:'RockChunks970',completed:14,total};
 const chunks=populateGeographicRockChunks256(physical,working,stream(ROCK_CHUNKS_SEED_PART_256));working.adjacentPermutation=[...chunks.adjacentPermutation];working.adjacentUses+=chunks.adjacentUses;
 yield {phase:'CaveHives1120',completed:15,total};
 const retained=roster.worldPawns.owners.flatMap(row=>row.kind==='animal'?[row.actor]:[]),hiveContext={...working,unspawnedAnimals:retained,runtimeWildlifeRng:runtimeRng,enemyReproductionRateFactor:hiveReproductionFactor256(w),lordIds,allowCaveHives:true};
 // Medium inherits allowCaveHives=true from current DifficultyDef; no biome
 // flag or unconditional alias is invented. Insect absence remains Core early exit.
 const hives=populateGeographicCaveHives256(physical,hiveContext,stream(349641510));if(hives.status==='blocked')throw Error('Actual1120 refused: '+hives.reason);
 working.adjacentPermutation=[...hives.adjacentPermutation];working.adjacentUses=hives.adjacentUses;
 yield {phase:'Snow1150',completed:16,total};initializeGeographicInitialSnow256(w,stream(INITIAL_SNOW_SEED_PART_256));
 yield {phase:'Animals1200',completed:17,total};
 const animals=produceInitialAnimals256(w,{random:stream(INITIAL_ANIMALS_SEED_PART_256),pawnKindOrder:CORE_4871_PAWN_KIND_ORDER,unspawnedAnimals:retained,closewalk:captureRandomClosewalk256(w)});if(animals.status==='blocked')throw Error('Actual1200 refused: '+animals.reason);
 const originalWildlife=w.wildlife;
 w.wildlife=originalWildlife?{...originalWildlife,animals:[...originalWildlife.animals,...animals.originals]}:{profile:GEOGRAPHIC_FAUNA_PROFILE_256,rng:runtimeRng,animals:animals.originals,eatenPlants:0,eatenNutrition:0,eatenItems:0};w.nextId=animals.nextId;
 initializeGeographicRenewal262(w);
 for(const initial of animals.initialGrowth){const a=animals.originals.find(a=>a.id===initial.animalId);if(!a?.growthTracker||a.growthTracker.value!==initial.value||a.growthTracker.nextCheckCore!==initial.nextCheckCore)throw Error('Initial growth receipt disagrees with its actual constructor owner');}
 yield {phase:'Fog1500',completed:18,total};
 const reach=captureGeographicGenerationReachability256(w),fog=initializeExploration256(w,{start:start.cell,rootsToUnfog:working.rootsToUnfog,readers:{standable:reach.physical.standable,roofed:reach.physical.roofed,canReachMapEdgeNoPassClosedDoorsOrWater:reach.canReachMapEdgeNoPassClosedDoorsOrWater},...working.edgeContext?{edgeContext:working.edgeContext}:{}},captureActualFogPhysical256(w),stream(INITIAL_FOG_SEED_PART_256));
 if(fog.edgeContext)working.edgeContext=fog.edgeContext;
 wakeUnfoggedTempleMechs256(w);
 yield {phase:'MutatorFinal1600',completed:19,total};
 const composition=physical.composition;
 if(composition.plans.init.river||composition.plans.river){if(!composition.plans.init.river||!composition.plans.river)throw Error('Actual river Init/node pair is incomplete');const flow=generateLocalRiverFlow256({plan:composition.plans.init.river,node:composition.plans.river,isRiver:cell=>{const t=w.tiles[cell]!;return !t.floor&&!t.bridge&&isNaturalTerrain256(t.terrain)&&NATURAL_TERRAIN_DEFINITIONS_256[t.terrain].river;}});w.riverWater=packRiverWater256(flow.values,w.width,w.height);}
 const initialization=physical.initialization;
 if(!initialization.outerRandom||!initialization.outerAfterWeather)throw Error('Actual Init/weather OUTER owner is absent; never substitute a fresh seed');
 applyCoreStartingPostMap256(w,roster,{random:initialization.outerRandom,outerAfterWeather:initialization.outerAfterWeather});
 adoptWind(w);ensureFireState(w);finalizeInitialWorldRegistry(w);
 if(!w.worldMaps)throw Error('Actual new campaign registry missing');
 w.worldMaps.generationRuntime=finishMapGenerationRuntime256(runtimeBirth,working);w.worldMaps.nextLordId=lordIds.nextId;w.worldMaps.nextAncientCasketGroupId=casketGroupIds.nextId;
 requireOriginalStartingWorld256(w,request);
 if(w.planet!==planet||w.worldFactions!==draft.factions||w.tick!==0||w.nextId<roster.nextId||w.worldPawns!==roster.worldPawns||w.planet.geography!==geography.definition)throw Error('Actual new-game owner/clock frontier changed');
 const errors=validateWorld(w);if(errors.length)throw Error('Actual Base_Player candidate refused: '+errors.join(' '));
 yield {phase:'validated-private-candidate',completed:total,total};return w;
}
