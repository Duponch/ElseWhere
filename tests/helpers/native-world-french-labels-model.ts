import {createWorld} from '../../src/sim/index';
import {effectiveCore297} from '../../src/sim/core-phase-297';
import {CAMPAIGN_FIELDS} from '../../src/sim/secondary-site-state';
import {generateCoveredSurfaceMesh,cropSurfaceCells,surfaceVisibilityAxis} from '../../src/sim/world-surface-mesh';
import {stableWorldSeedHash} from '../../src/sim/world-climate-settings';
import {defaultWorldGenerationSettings,worldClimateSettings,INTRINSIC_WORLD_FACTIONS} from '../../src/sim/world-generation-settings';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../../src/sim/world-faction-generation';
import {WorldGenerationRandom} from '../../src/sim/world-generation-random';
import {generateCoreWorldMutators256} from '../../src/sim/world-local-mutators-256';
import {captureGeneratedGeography256} from '../../src/sim/world-geography-owner-256';
import {createGeographicPlanet256} from '../../src/sim/planet-factory-256';
import {planetFactionTargets256} from '../../src/sim/planet-faction-targets-256';
import {canPlaceWorldSettlement} from '../../src/sim/world-settlement-placement';
import type {WorldPhysicalSurface,WorldSurfaceTile} from '../../src/sim/world-surface-geography';
import type {GeographicWorldDraft256} from '../../src/sim/world-geographic-draft';
import type {CampaignSummary,CampaignMapSummary,SharedCampaignState} from '../../src/sim/world-map-state';
import type {WorldRoadLink} from '../../src/sim/world-roads';

/** Bounded, explicit presentation model. Real geometry helpers and immutable
 * geography owner; deliberately reduced mesh level2, NOT the normal saved
 * geometry revision1 level10. No persistence, restoration or Whole admission
 * of this component is supported or claimed. No normal globe generation runs.
 */
export function createWorldUiModels(){
  const baseWorld=createWorld(6111201,32,32),seedText='Private World UI reduced92',generationSeed=stableWorldSeedHash(seedText)>>>0;
  const settings={...defaultWorldGenerationSettings(),coverage:1 as const,factions:['OutlanderCivil','TribeCivil',...INTRINSIC_WORLD_FACTIONS] as ReturnType<typeof defaultWorldGenerationSettings>['factions']};
  const cells=cropSurfaceCells(generateCoveredSurfaceMesh(1,2),1,surfaceVisibilityAxis(1));
  if(cells.length!==92)throw Error('The component requires the bounded level2 mesh of92 cells.');
  // Climate/biome values are UI fixture facts; only the mesh topology comes
  // from the actual geometry helper. They are not a generated campaign claim.
  const tiles:WorldSurfaceTile[]=cells.map((cell,id)=>({id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,
    biome:id===1?'ocean':id===2?'lake':id===4?'tundra':id%9===0?'boreal-forest':'temperate-forest',hilliness:id===1?'small-hills':id===2?'large-hills':id===3?'mountainous':id===4?'impassable':'flat',elevation:20,meanTemperature:12,rainfall:900,swampiness:.25,rivers:[],riverDistance:0}));
  const roads:WorldRoadLink[][]=tiles.map(()=>[]),surface:WorldPhysicalSurface={revision:3,radius:100,seedText,generationSeed,settings:worldClimateSettings(settings),tiles};
  const generated=generateForeignWorldFactions256({version:baseWorld.schemaVersion,tick:0,tiles,selection:settings.factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:baseWorld.nextId,random:new WorldGenerationRandom(821)});
  if(!generated.ok)throw Error('Reduced component factions: '+generated.reason);
  const completed=completeWorldFactionRegistry256({version:baseWorld.schemaVersion,draft:generated.draft,playerDef:'PlayerColony',name:'Camp UI réduit',postWorldRandom:new WorldGenerationRandom(821)});
  if(!completed.ok)throw Error('Reduced component player faction: '+completed.reason);
  const draft:GeographicWorldDraft256={revision:1,key:'private-ui-reduced-mesh-not-saveable',surface,roads,settings,factions:completed.registry,nextThingId:generated.nextThingId,mutators:generateCoreWorldMutators256(tiles,generationSeed).codes};
  const geography=captureGeneratedGeography256(draft),targets=planetFactionTargets256(completed.registry,tiles);
  if(!targets)throw Error('The reduced component registry did not bind to its tiles.');
  const home=tiles.find(tile=>canPlaceWorldSettlement(tiles,tile.id,{settlementTiles:targets.occupied}));
  if(!home)throw Error('No admissible component home tile; do not rescue or reroll.');
  const planet=createGeographicPlanet256({geography,factions:completed.registry,homeTile:home.id,adoptedAt:0,nextGroupId:1});
  baseWorld.planet=planet;baseWorld.worldFactions=completed.registry;baseWorld.nextId=generated.nextThingId;
  if(effectiveCore297(baseWorld)!==0)throw Error('The component source World must remain at Core0.');
  const shared=Object.fromEntries(CAMPAIGN_FIELDS.filter(key=>key!=='escapedShips298'&&Object.hasOwn(baseWorld,key)).map(key=>[key,baseWorld[key]])) as Omit<SharedCampaignState,'escapedShips298'>;
  function summary(count:3|30):CampaignSummary{
    const maps:CampaignMapSummary[]=Array.from({length:count},(_,id)=>({id,tile:(home!.id+id*3)%tiles.length,kind:id===0?'settlement':'camp',createdAt:0,...(id===0?{settledAt:0}:{}),pawnCount:id===0?3:0,selected:id===0,
      actions:{view:{ok:true},settle:{ok:false,reason:'Projection UI uniquement ; aucune carte propriétaire à installer.'},abandon:{ok:false,reason:'Projection UI uniquement ; aucune conséquence de campagne.'}},
      abandonConsequences:{pawns:[],groundItems:0,structures:0}}));
    // Declared transport/projection data, NOT thirty owned local Worlds.
    // No groups are fabricated: groupDetail/snapshot need actual group owners.
    return{...shared,tick:0,civilTick:0,calendarOrigin:0,campaignSeed:baseWorld.seed+count,mapSize:{width:32,height:32},events:[],people:[],groupLosses:[],activeMapId:0,rootMapId:0,maxSettlements:5,selectedGroupId:null,maps,groups:[],lossContexts:[],lostMemories:[],incidents:[]};
  }
  const scenes={3:summary(3),30:summary(30)};
  return{baseWorld,geography,scenes,homeTile:home.id,sourceScope:'Reduced92-cell UI geography and synthetic3/30map summaries; no admitted campaign, group owners, save or normal-planet workload.'};
}
