import { isColonist } from './affiliation.ts';
import type { Pawn,World } from './types.ts';

/** Core TutorialState kept by a tutorial game (schema 347): the forced
 * content each given once, in Core ticks, and the handover (endTick). The
 * lessons' rectangles and starting items belong to the tutorial steps. */
export interface TutorialState347 {
  revision:1;
  /** Instruction AddBillSimpleMeal: 75 raw potatoes given. */
  potatoesAtCore?:number;
  /** Instruction MineSteel: the compacted steel lump scattered. */
  steelLumpAtCore?:number;
  /** Instruction DownRaider: the single-raider raid sent. */
  raidAtCore?:number;
  /** Core TutorialState.endTick: the ChooseStoryteller handover. */
  endedAtCore?:number;
  /** Schema 349: the lessons (src/sim/tutorial-lessons-349.ts). */
  lessons349?:TutorialLessons349;
}
/** Core Tutor.activeLesson and TutorialState of a tutorial created at schema
 * 349; the per-lesson fields exist only while their lesson is active. */
export interface TutorialLessons349 {
  revision:1;
  /** TutorialState.introDone. */
  introDone:boolean;
  /** TutorialState.startingItems: ids of the Things placed for the player at
   * the start (pods, near-start scatter); weapons only after UnforbidStartingResources. */
  startingItems:number[];
  /** The active lesson of the map (absent before GameStartDialogClosed and after the end). */
  active?:import('./tutorial-lessons-349.ts').TutorialLessonId349;
  /** TutorialState.roomRect (BuildRoomWalls onward). */
  roomRect?:import('./tutorial-347.ts').TutorialRect347;
  /** TutorialState.sandbagsRect (BuildSandbags onward). */
  sandbagsRect?:import('./tutorial-347.ts').TutorialRect347;
  /** Instruction_PlaceStockpile / Instruction_PlaceGrowingZone rect. */
  zoneRect?:import('./tutorial-347.ts').TutorialRect347;
  /** Instruction_MineSteel.mineCells (cell indices, ascending). */
  mineCells?:number[];
  /** Instruction_ExpandArea.startingAreaCount. */
  areaStart?:number;
  /** Instruction_FinishConstruction.initialBlueprintsCount. */
  blueprints?:number;
}
/** Applied creation choices. Absence preserves every historical camp rule.
 * Schema 347 adds the Core tutorial (Tutor storyteller, Easy difficulty,
 * scenario Tutorial); after its handover the same game carries the normal
 * Cassandra profile and keeps its ended tutorial record. */
export interface GameProfile {
  revision:1;
  storyteller:'cassandra-partial'|'tutor';
  difficulty:'adventure-story'|'community-builder';
  saveMode:'reloadable';
  tutorial347?:TutorialState347;
}
export function crashlandedProfile():GameProfile {
  return {revision:1,storyteller:'cassandra-partial',difficulty:'adventure-story',saveMode:'reloadable'};
}
/** Core MainMenuDrawer.InitLearnToPlay: storyteller Tutor (hidden, no
 * storyteller comps, alerts and permadeath disabled) at its forced
 * difficulty Easy ("community builder"), scenario Tutorial. */
export function tutorialProfile347(lessons?:TutorialLessons349):GameProfile {
  return {revision:1,storyteller:'tutor',difficulty:'community-builder',saveMode:'reloadable',tutorial347:{revision:1,...lessons?{lessons349:lessons}:{}}};
}
/** Schema 347: the Core tutorial profile and its rules. */
export const isSchema347OrLater=(version:number):boolean=>Number(version)>=347;
type ProfileWorld=Pick<World,'gameProfile'>;
/** Core TutorSystem.TutorialMode: the current storyteller def is Tutor. */
export const tutorialMode347=(world:ProfileWorld):boolean=>world.gameProfile?.storyteller==='tutor';
/** A storyteller with incident comps tells the story (Cassandra). The Tutor
 * has none: no raid, visitor, disease, condition or quest is drawn for it. */
export const storytellerIncidents347=(world:ProfileWorld):boolean=>!!world.gameProfile&&world.gameProfile.storyteller!=='tutor';
/** Core StorytellerDef.disableAlerts (Tutor): the alerts readout is empty. */
export const alertsDisabled347=(world:ProfileWorld):boolean=>tutorialMode347(world);
/** A game that began as the tutorial (active or ended). */
export const tutorialOrigin347=(world:ProfileWorld):boolean=>!!world.gameProfile?.tutorial347;
/** The two supported creation profiles: Cassandra at Adventure Story, and
 * the tutorial's Tutor at Community builder. */
export function supportedCoreProfile347(p:GameProfile|undefined):boolean {
  return !!p&&p.revision===1&&p.saveMode==='reloadable'&&(p.storyteller==='cassandra-partial'&&p.difficulty==='adventure-story'||p.storyteller==='tutor'&&p.difficulty==='community-builder');
}

/** Core DifficultyDef values the simulation reads (Medium "adventure
 * story" and Easy "community builder", Difficulties.xml). Medium keeps the
 * constants the clone always used. */
interface DifficultyValues347 {
  colonistMoodOffset:number;playerPawnInfectionChanceFactor:number;foodPoisonChanceFactor:number;
  enemyDeathOnDownedChanceFactor:number;researchSpeedFactor:number;cropYieldFactor:number;mineYieldFactor:number;
  adaptationGrowthRateFactorOverZero:number;scariaRotChance:number;enemyReproductionRateFactor:number;
}
const MEDIUM:Readonly<DifficultyValues347>=Object.freeze({colonistMoodOffset:5,playerPawnInfectionChanceFactor:.75,foodPoisonChanceFactor:.75,
  enemyDeathOnDownedChanceFactor:1,researchSpeedFactor:1,cropYieldFactor:1,mineYieldFactor:1,adaptationGrowthRateFactorOverZero:.75,scariaRotChance:.333,enemyReproductionRateFactor:.5});
const EASY:Readonly<DifficultyValues347>=Object.freeze({colonistMoodOffset:10,playerPawnInfectionChanceFactor:.5,foodPoisonChanceFactor:.5,
  enemyDeathOnDownedChanceFactor:.9,researchSpeedFactor:1.2,cropYieldFactor:1.2,mineYieldFactor:1.2,adaptationGrowthRateFactorOverZero:.25,scariaRotChance:0,enemyReproductionRateFactor:.15});
/** The profile's difficulty values; undefined without a creation profile
 * (historical camps keep their own neutral rules). */
export function difficultyValues347(world:ProfileWorld):Readonly<DifficultyValues347>|undefined {
  const d=world.gameProfile?.difficulty;return d==='community-builder'?EASY:d==='adventure-story'?MEDIUM:undefined;
}
const easy=(world:ProfileWorld):boolean=>world.gameProfile?.difficulty==='community-builder';

/** Core Need_Mood: colonistMoodOffset for a colonist or (schema 313) a prisoner of the colony. */
export const colonistMoodOffset=(world:Pick<World,'gameProfile'>&Partial<Pick<World,'schemaVersion'>>,pawn:Pawn):number=>world.gameProfile&&(isColonist(pawn)||Number(world.schemaVersion)>=313&&!!pawn.prisoner)?(easy(world)?EASY.colonistMoodOffset:MEDIUM.colonistMoodOffset):0;
/** Current Core player-faction multiplier applies when an exposed wound
 * reaches its infection deadline, not when the original wound is received. */
export const playerInfectionFactor=(world:Pick<World,'gameProfile'>,pawn:Pawn):number=>world.gameProfile&&isColonist(pawn)?(easy(world)?EASY.playerPawnInfectionChanceFactor:MEDIUM.playerPawnInfectionChanceFactor):1;
/** The profile's playerPawnInfectionChanceFactor for a caravan member; 1 without a profile. */
export const profileInfectionFactor347=(world:ProfileWorld):number=>difficultyValues347(world)?.playerPawnInfectionChanceFactor??1;
/** Core foodPoisonChanceFactor; 1 without a profile. */
export const foodPoisonFactor347=(world:ProfileWorld):number=>difficultyValues347(world)?.foodPoisonChanceFactor??1;
/** Core scariaRotChance; undefined without a profile (no current difficulty). */
export const scariaRotChance347=(world:ProfileWorld):number|undefined=>difficultyValues347(world)?.scariaRotChance;
/** Core enemyDeathOnDownedChanceFactor; 1 without a profile. */
export const enemyDeathOnDownedFactor347=(world:ProfileWorld):number=>difficultyValues347(world)?.enemyDeathOnDownedChanceFactor??1;
/** Core ResearchManager.ResearchPerformed: researchSpeedFactor. */
export const researchSpeedFactor347=(world:ProfileWorld):number=>easy(world)?EASY.researchSpeedFactor:1;
/** Core Plant.YieldNow: cropYieldFactor (every plant def is affected). */
export const cropYieldFactor347=(world:ProfileWorld):number=>easy(world)?EASY.cropYieldFactor:1;
/** Core BuildingProperties.EffectiveMineableYield: RoundToInt(yield x mineYieldFactor). */
export function effectiveMineableYield347(world:ProfileWorld,mineableYield:number):number {
  if(!easy(world))return mineableYield;
  const value=Math.fround(Math.fround(mineableYield)*Math.fround(EASY.mineYieldFactor)),lower=Math.floor(value),fraction=value-lower;
  // Mathf.RoundToInt rounds a half to the even integer.
  return fraction<.5?lower:fraction>.5?lower+1:lower%2===0?lower:lower+1;
}
/** Core StoryWatcher_Adaptation: adaptationGrowthRateFactorOverZero. */
export const adaptationGrowthFactor347=(world:ProfileWorld):number=>easy(world)?EASY.adaptationGrowthRateFactorOverZero:MEDIUM.adaptationGrowthRateFactorOverZero;
/** Both the historical camp and the selected Core difficulty use .40. */
export const friendlyFireFactor=(_world:Pick<World,'gameProfile'>):number=>.4;
