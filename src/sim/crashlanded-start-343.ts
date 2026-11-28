import {isFirstDays343} from './first-days-memories-343.ts';
import {NEW_COLONY_START_343} from './world-map-lost.ts';
import {CRASHED_TOGETHER_OPINION,socialSeed} from './social-state.ts';
import {NUTRIENT_PASTE_RESEARCH_COST} from './research.ts';
import {grantFoundationalResearch382} from './foundational-research-382.ts';
import type {Pawn,World} from './types.ts';

/** Schema 343, Crashlanded creation only (tick 0, never a load or a
 * migration). Core order: ScenPart_PlayerPawnsArriveMethod.PostMapGenerate
 * gives CrashedTogether (drop pods) to every pair of starting colonists, then
 * Game.InitNewGame gives NewColonyOptimism to each of them. */
export function giveCrashlandedStartThoughts343(world:World,colonists:readonly Pawn[]):void {
 if(!isFirstDays343(world.schemaVersion))return;
 if(world.tick!==0||!world.worldGroups||!world.worldMaps||new Set(colonists.map(p=>p.id)).size!==colonists.length)throw Error('Starting thoughts need the actual new colony at tick 0');
 for(const p of colonists){
  const social=p.social??={rng:socialSeed(world.seed,p.id),memories:[]};
  for(const other of colonists)if(other!==p&&!social.memories.some(m=>m.kind==='crashed-together'&&m.otherId===other.id))
   social.memories.push({otherId:other.id,kind:'crashed-together',at:0,offset:CRASHED_TOGETHER_OPINION});
 }
 const mapId=world.worldMaps.rootMapId??0,memories=world.worldGroups.lostMemories;
 for(const p of colonists)if(!memories.some(m=>m.receiverId===p.id&&m.kind===NEW_COLONY_START_343))memories.push({receiverId:p.id,mapId,otherId:null,kind:NEW_COLONY_START_343,at:0});
}
/** Factions_Player PlayerColony startingResearchTags ClassicStart: the seven
 * projects tagged ClassicStart are completed at start (ResearchUtility.
 * ApplyPlayerStartingResearch). Elsewhere already completes Stonecutting,
 * Complex furniture, Complex clothing, Air conditioning, Electricity and
 * PassiveCooler. Schema 343 adds NutrientPaste, 382 the two actual projects. */
export function grantClassicStartResearch343(world:World):void {
 if(!isFirstDays343(world.schemaVersion)||!world.research)return;
 world.research.nutrientPaste??={points:NUTRIENT_PASTE_RESEARCH_COST,completedAt:0};
 if(world.schemaVersion>=382)grantFoundationalResearch382(world.research);
}
