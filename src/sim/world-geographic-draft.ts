import {SCHEMA_VERSION} from './types.ts';
/** Original composition of the prospective physical/world-object stages.
 * Actual step order and isolated random streams follow Core4871 facts.
 * Original names/people mean composed seed output is not a Core certificate.
 * A draft has no local map and never replaces a running campaign by itself. */
import {generateWorldPhysicalSurface,type WorldPhysicalSurface} from './world-surface-geography.ts';
import {WorldGenerationRandom,combineWorldSeed} from './world-generation-random.ts';
import {worldClimateSettings,validWorldGenerationSettings,worldGenerationKey,type WorldGenerationSettings} from './world-generation-settings.ts';
import {pickWorldSettlementTile} from './world-settlement-placement.ts';
import {captureWorldSurfaceDifficulties} from './world-surface-movement.ts';
import {generateAncientWorldRoads,selectOrdinaryRoadEndpoints,generateOrdinaryWorldRoads} from './world-road-generation.ts';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from './world-faction-generation.ts';
import type {WorldFactionRegistry256} from './world-faction-state.ts';
import type {WorldRoadLink} from './world-roads.ts';
import {generateCoreWorldMutators256} from './world-local-mutators-256.ts';
import {generateCoreAncientSites,generateCoreAncientRoads} from './world-ancient-core.ts';
import {captureCoreMovementDifficulties} from './world-core-movement.ts';
export interface GeographicWorldDraft256 {
 revision:1;key:string;surface:WorldPhysicalSurface;roads:WorldRoadLink[][];
 settings:WorldGenerationSettings;factions:WorldFactionRegistry256;nextThingId:number;mutators:number[];
}
export interface GeographicDraftProgress {phase:string;completed:number;total:number}
const f=Math.fround;
const roundedDraw=(value:number,r:WorldGenerationRandom)=>Math.trunc(value)+(r.value()<f(value-Math.trunc(value))?1:0);
/** Advancing this iterator is confined to the generation worker. A cancelled
 * iterator is discarded; resuming/yielding never consumes a random draw. */
/** `terrain`: 'core' (default from schema 376) generates the surface with the
 * game's terrain step and mesh (geometry revision 2); 'historical' keeps the
 * earlier generator. The later stages are the same in both cases. */
export function* generateGeographicWorldDraft256(input:{seed:string;settings:WorldGenerationSettings;tick:number;nextThingId:number;playerDef:'PlayerColony'|'PlayerTribe';playerName:string;terrain?:'core'|'historical'}):Generator<GeographicDraftProgress,GeographicWorldDraft256,void> {
 if(typeof input.seed!=='string'||!validWorldGenerationSettings(input.settings)||input.terrain!==undefined&&input.terrain!=='core'&&input.terrain!=='historical'||!Number.isSafeInteger(input.tick)||input.tick<0||!Number.isSafeInteger(input.nextThingId)||input.nextThingId<1)throw Error('Invalid geographic world draft');
 const settings={...input.settings,factions:[...input.settings.factions]},key=worldGenerationKey(input.seed,settings),physical=generateWorldPhysicalSurface(input.seed,worldClimateSettings(settings),input.terrain==='historical'?undefined:{core:true});
 let next=physical.next();while(!next.done){yield next.value;next=physical.next();}const surface=next.value,tiles=surface.tiles,roads:WorldRoadLink[][]=tiles.map(()=>[]),rootSeed=surface.generationSeed;
 const difficulties=captureWorldSurfaceDifficulties(tiles,settings.temperature,0);
 if(input.terrain==='historical'){
  const ancient=new WorldGenerationRandom(combineWorldSeed(rootSeed,976238715)),anchors:number[]=[];
  const count=roundedDraw(f(f(tiles.length/100000)*ancient.float(10,20)),ancient);
  for(let i=0;i<count;i++){const choice=pickWorldSettlementTile(tiles,ancient,{settlementTiles:new Set()});if(!choice.found)throw Error('No admissible ancient-road anchor');anchors.push(choice.tile);yield {phase:'ancient-sites',completed:i+1,total:count};}
  yield* generateAncientWorldRoads(tiles,difficulties,anchors,roads);
 } else {
  // The game's steps 300 and 400 (`world-ancient-core.ts`), path costs
  // at tick 0 computed as the game computes them.
  const sites=yield* generateCoreAncientSites(tiles,rootSeed);
  yield* generateCoreAncientRoads(tiles,captureCoreMovementDifficulties(tiles,settings.temperature,0),sites,roads);
 }
 yield {phase:'foreign-factions',completed:0,total:settings.factions.length};
 const foreign=generateForeignWorldFactions256({version:SCHEMA_VERSION,tick:input.tick,tiles,selection:settings.factions,population:settings.population,nextFactionId:1,nextSettlementId:1,nextThingId:input.nextThingId,random:new WorldGenerationRandom(combineWorldSeed(rootSeed,777998381))});
 if(!foreign.ok)throw Error(foreign.reason);
 yield {phase:'foreign-factions',completed:settings.factions.length,total:settings.factions.length};
 const occupied=new Set(foreign.draft.settlements.map(s=>s.tile));
 const endpoints=selectOrdinaryRoadEndpoints(tiles,difficulties,roads,rootSeed,foreign.draft.settlements.map(s=>({tile:s.tile,onSurface:true})),random=>{const choice=pickWorldSettlementTile(tiles,random,{settlementTiles:occupied});if(!choice.found)throw Error('No admissible road endpoint');return choice.tile;});
 yield* generateOrdinaryWorldRoads(tiles,difficulties,roads,rootSeed,endpoints);
 const mutators=generateCoreWorldMutators256(tiles,rootSeed);yield {phase:'terrain-modifiers',completed:tiles.length,total:tiles.length};
 // The real player faction is a post-world hook, not the first faction of
 // step500. It consumes its own actual post-world stream after root reset.
 const completed=completeWorldFactionRegistry256({version:SCHEMA_VERSION,draft:foreign.draft,playerDef:input.playerDef,name:input.playerName,postWorldRandom:new WorldGenerationRandom(rootSeed)});
 if(!completed.ok)throw Error(completed.reason);
 return {revision:1,key,surface,roads,settings,factions:completed.registry,nextThingId:foreign.nextThingId,mutators:mutators.codes};
}
