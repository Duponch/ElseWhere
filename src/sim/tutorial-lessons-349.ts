/** Core RimWorld 1.6 tutorial ("Apprendre à jouer"), schema 349: the state of
 * the 37 lessons that the game keeps (Tutor.activeLesson and TutorialState).
 *
 * The lessons run in the interface (src/ui/tutorial-engine-349.ts): it reads
 * the confirmed snapshots, decides when the active lesson is complete and
 * asks for the next one with the command `tutorial-lesson`. This module only
 * keeps what Core saves in the game and what an activation changes in it:
 * - Tutor.activeLesson: the active lesson of the game (the five lessons of
 *   the creation pages never reach the World);
 * - TutorialState: startingItems, roomRect, sandbagsRect, introDone;
 * - the data a lesson saves itself (Instruction_PlaceStockpile.stockpileRect,
 *   Instruction_PlaceGrowingZone.growingZoneRect, Instruction_MineSteel
 *   .mineCells, Instruction_ExpandArea.startingAreaCount and Instruction_
 *   FinishConstruction.initialBlueprintsCount);
 * - the activations that change the map: TutorUtility.FindUsableRect (room,
 *   stockpile, growing zone, sandbags), the sandbag ring cleared of trees,
 *   the forced content of lot 347 (potatoes, steel lump, raid);
 * - Instruction_DownRaider: once a pawn of the player is down, every hostile
 *   is damaged until downed (HealthUtility.DamageUntilDowned).
 * Only a tutorial game created at schema 349 has this record; every other
 * game (and a 347/348 tutorial migrated by number) is untouched. */
import {factionOf,factionRelation,isColonist} from './affiliation.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {healthRandom,reconcilePawnHealth,updatePawnHealth} from './health.ts';
import {reconcileAnimalHealth} from './wildlife-health.ts';
import {createAnimalMedicalRecord256} from './animal-clinical-age-v256.ts';
import {cryptosleepDamageUntilDowned271} from './cryptosleep-removal-271.ts';
import {createMedicalRecord,medicalStatus} from './injury-state.ts';
import {applyTutorialCommand347,findUsableRect347,scatterTutorialSteelLump347} from './tutorial-347.ts';
import {isSchema347OrLater,tutorialMode347,type TutorialLessons349,type TutorialState347} from './game-profile.ts';
import type {Cell,CommandResult,World} from './types.ts';
import {tutorialLessonIndex349,FIRST_GAME_LESSON_349,isGameLesson349,nextTutorialLesson349,contractRect349,rectContains349,homeAreaCount349,buildRoofAreaCount349,isConstructionJob349,
  TUTORIAL_STOCKPILE_SIZE_349,TUTORIAL_ROOM_SIZE_349,TUTORIAL_GROWING_SIZE_349,TUTORIAL_SANDBAGS_SIZE_349,TUTORIAL_STARTING_ITEM_TICKS_349,tutorialLessons349,
  type TutorialLessonId349,type TutorialRect349,type TutorialLessonCommand349} from './tutorial-lessons-state-349.ts';
export * from './tutorial-lessons-state-349.ts';


/** Core ActiveTransporter / GenStep_ScatterThings (nearPlayerStart): a Thing
 * placed for the player at the start of a tutorial is remembered. */
export function recordTutorialStartingItem349(w:World,id:number):void {
  // After UnforbidStartingResources only the starting weapons stay remembered.
  const state=tutorialLessons349(w);if(!state||!tutorialMode347(w)||state.active!==undefined&&tutorialLessonIndex349(state.active)>tutorialLessonIndex349('UnforbidStartingResources'))return;
  if(effectiveCore297(w)>=TUTORIAL_STARTING_ITEM_TICKS_349||!Number.isSafeInteger(id)||id<1)return;
  if(!state.startingItems.includes(id))state.startingItems.push(id);
}

const refuse=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const exact=(c:object,keys:readonly string[]):boolean=>Reflect.ownKeys(c).length===keys.length&&keys.every(k=>Object.hasOwn(c,k));
/** Per-lesson data is kept only while its lesson is active. */
function clearLessonData(state:TutorialLessons349):void {delete state.zoneRect;delete state.mineCells;delete state.areaStart;delete state.blueprints;}

/** Core Instruction_UnforbidStartingResources.PostDeactivated: only the
 * starting weapons stay remembered (Instruction_EquipWeapons.IsWeapon: a
 * weapon worth more than 30 silver; every weapon of Crashlanded is). */
function keepStartingWeapons(w:World,state:TutorialLessons349):void {
  const weapons=new Set(w.piles.filter(p=>p.weapon!==undefined).map(p=>p.id));
  state.startingItems=state.startingItems.filter(id=>weapons.has(id));
}

/** Instruction_BuildSandbags.OnActivated: inside the ring, the band one cell
 * in is cleared of the plants that block passage (trees). Adaptation: a tree
 * a job already targets stays, and items (chunks) are not removed. */
function clearSandbagBand(w:World,rect:TutorialRect349):void {
  const outer=contractRect349(rect,1),inner=contractRect349(rect,2);
  const busy=new Set<number>(),index=(c:Cell)=>c.z*w.width+c.x;
  for(const j of w.jobs){busy.add(index(j));if(j.plantTarget)busy.add(-j.plantTarget.resourceId-1);}
  w.resources=w.resources.filter(r=>!(r.kind==='tree'&&rectContains349(outer,r)&&!rectContains349(inner,r)&&!busy.has(index(r))&&!busy.has(-r.id-1)));
}

/** Lesson_Instruction.OnActivated and the instruction classes' own. */
function activate(w:World,profile:TutorialState347,state:TutorialLessons349,lesson:TutorialLessonId349):string|undefined {
  const rect=(size:{width:number;height:number},minFertility=0)=>findUsableRect347(w,size.width,size.height,minFertility)??undefined;
  switch(lesson){
    case 'MakeStockpile':{const r=rect(TUTORIAL_STOCKPILE_SIZE_349);if(!r)return 'Aucun emplacement dégagé de 6 × 6 près du centre de la carte.';state.zoneRect=r;return;}
    case 'MakeGrowingZone':{const r=rect(TUTORIAL_GROWING_SIZE_349,TUTORIAL_GROWING_SIZE_349.minFertility);if(!r)return 'Aucun sol fertile dégagé de 10 × 8 près du centre de la carte.';state.zoneRect=r;return;}
    case 'BuildRoomWalls':{const r=rect(TUTORIAL_ROOM_SIZE_349);if(!r)return 'Aucun emplacement dégagé de 12 × 8 près du centre de la carte.';state.roomRect=r;return;}
    case 'BuildSandbags':{const r=rect(TUTORIAL_SANDBAGS_SIZE_349);if(!r)return 'Aucun emplacement dégagé de 7 × 7 près du centre de la carte.';state.sandbagsRect=r;clearSandbagBand(w,r);return;}
    case 'AddBillSimpleMeal':if(profile.potatoesAtCore===undefined)applyTutorialCommand347(w,{type:'tutorial-potatoes'});return;
    case 'MineSteel':{
      if(profile.steelLumpAtCore!==undefined){state.mineCells=[];return;}
      const lump=scatterTutorialSteelLump347(w,profile);
      // Core keeps the steel cells of the 10 x 10 rect.
      state.mineCells=lump.rect?lump.cells.filter(i=>rectContains349(lump.rect!,{x:i%w.width,z:Math.floor(i/w.width)})).sort((a,b)=>a-b):[];return;
    }
    case 'ExpandAreaHome':state.areaStart=homeAreaCount349(w);return;
    case 'ExpandAreaBuildRoof':state.areaStart=buildRoofAreaCount349(w);return;
    case 'FinishSandbags':state.blueprints=w.jobs.filter(isConstructionJob349).length;return;
    case 'DownRaider':if(profile.raidAtCore===undefined)applyTutorialCommand347(w,{type:'tutorial-raid'});return;
    default:return;
  }
}

/** The next lesson of the chain becomes the active one: GameStartDialogClosed
 * starts MapCameraDolly, then each lesson follows the one it names. The
 * interface decides that a lesson is complete, as Core's lessons do from the
 * UI; the game only checks the order. */
export function applyTutorialLessonCommand349(w:World,c:TutorialLessonCommand349):CommandResult {
  if(!c||typeof c!=='object'||!exact(c,['type','lesson']))return refuse('Commande invalide.');
  const profile=w.gameProfile?.tutorial347,state=tutorialLessons349(w);
  if(!isSchema347OrLater(Number(w.schemaVersion))||!tutorialMode347(w)||!profile||!state)return refuse('Cette commande n’existe que pendant le tutoriel.');
  if(!isGameLesson349(c.lesson))return refuse('Leçon inconnue.');
  const expected=state.active===undefined?FIRST_GAME_LESSON_349:nextTutorialLesson349(state.active);
  if(c.lesson!==expected)return refuse(expected?'Cette leçon n’est pas la suivante.':'Le tutoriel est terminé.');
  if(state.active==='UnforbidStartingResources')keepStartingWeapons(w,state);
  clearLessonData(state);state.active=c.lesson;
  const problem=activate(w,profile,state,c.lesson);
  if(problem){w.events.push({tick:w.tick,type:'command',message:problem});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
  return {ok:true};
}

const hostileHuman=(p:World['pawns'][number])=>!p.prisoner&&factionRelation(factionOf(p),'colony')==='hostile';
/** Instruction_DownRaider.LessonUpdate: when a pawn of the player is down,
 * every hostile pawn is damaged until downed (DamageUntilDowned forces the
 * downed state: no death roll). Elsewhere checks it each tick of the
 * simulation; hostile humans and manhunting animals are covered. */
export function advanceTutorialDownRaider349(w:World):void {
  const state=tutorialLessons349(w);if(state?.active!=='DownRaider'||!tutorialMode347(w))return;
  const downed=w.pawns.some(p=>isColonist(p)&&!p.prisoner&&p.state==='downed')||!!w.wildlife?.animals.some(a=>a.domestic&&a.state==='downed');
  if(!downed)return;
  const random=()=>healthRandom(w);
  for(const p of w.pawns){
    if(!hostileHuman(p)||p.state==='downed'||p.state==='dead')continue;
    // The clinical record is brought to now first, as for any damage.
    if(!p.health||p.health.tick<w.tick)updatePawnHealth(w,p);
    const record=p.health??createMedicalRecord(w.tick);
    if(record.death||medicalStatus(record)!=='mobile')continue;
    p.health=cryptosleepDamageUntilDowned271(record,random).record;reconcilePawnHealth(w,p);
  }
  for(const a of w.wildlife?.animals??[]){
    if(!a.manhunter||a.state==='downed'||a.state==='dead')continue;
    a.health??=createAnimalMedicalRecord256(w,a,Math.max(0,w.tick-1));
    if(a.health.death||medicalStatus(a.health)!=='mobile')continue;
    a.health=cryptosleepDamageUntilDowned271(a.health,random).record;reconcileAnimalHealth(w,a);
  }
}

