/** Schema 349 tutorial lessons: their order, the record kept by the game and
 * its strict validation (src/sim/tutorial-lessons-349.ts changes it). Light
 * module: read by the save validation and by the interface. */
import type {TutorialLessons349,TutorialState347} from './game-profile.ts';
import type {TutorialRect347} from './tutorial-347.ts';
import type {Cell,Job,World} from './types.ts';

/** Core InstructionDefs, in Instructions.xml order. */
export const TUTORIAL_LESSONS_349=Object.freeze(['CreateWorldParams','ChooseLandingSite','ReorderCharacters','RandomizeCharacter','AcceptStartingPawns',
  'MapCameraDolly','MapCameraZoom','Pause','TimeControls','MakeStockpile','EndStockpileDesignating','UnforbidStartingResources',
  'BuildRoomWalls','BuildRoomDoor','BuildBeds','BuildTorchLamp','BuildAnimalSleepingSpot','BuildHorseshoesPin','MakeGrowingZone','SetToGrowRice',
  'EquipWeapons','BuildFueledStove','AddBillSimpleMeal','MineSteel','ChopTrees','OpenMainTabWork','ChangeWorkSettings','BuildSimpleResearchBench',
  'OpenMainTabResearch','SelectResearchProject','ExpandAreaHome','ExpandAreaBuildRoof','BuildSandbags','FinishSandbags','DownRaider','UndraftAll','ChooseStoryteller'] as const);
export type TutorialLessonId349=typeof TUTORIAL_LESSONS_349[number];
export type {TutorialLessons349};
/** The first lesson played on the map (eventTagInitiate GameStartDialogClosed). */
export const FIRST_GAME_LESSON_349:TutorialLessonId349='MapCameraDolly';
const INDEX=new Map<string,number>(TUTORIAL_LESSONS_349.map((id,index)=>[id,index]));
export const tutorialLessonIndex349=(id:string):number=>INDEX.get(id)??-1;
/** The lessons of the creation pages (world, site, colonists) never reach a World. */
export const isGameLesson349=(id:unknown):id is TutorialLessonId349=>typeof id==='string'&&tutorialLessonIndex349(id)>=tutorialLessonIndex349(FIRST_GAME_LESSON_349);
/** The next lesson of the chain (InstructionDeactivated-<this>), or undefined after the last. */
export const nextTutorialLesson349=(id:TutorialLessonId349):TutorialLessonId349|undefined=>TUTORIAL_LESSONS_349[tutorialLessonIndex349(id)+1];
export const isSchema349OrLater=(version:number):boolean=>Number(version)>=349;
export type TutorialRect349=TutorialRect347;

/** Core Instruction sizes (TutorUtility.FindUsableRect arguments). */
export const TUTORIAL_STOCKPILE_SIZE_349=Object.freeze({width:6,height:6});
export const TUTORIAL_ROOM_SIZE_349=Object.freeze({width:12,height:8});
export const TUTORIAL_GROWING_SIZE_349=Object.freeze({width:10,height:8,minFertility:.5});
export const TUTORIAL_SANDBAGS_SIZE_349=Object.freeze({width:7,height:7});
/** Core ActiveTransporter: items placed by the pods count as starting items
 * only during the first 1200 ticks of the game. */
export const TUTORIAL_STARTING_ITEM_TICKS_349=1200;

export type TutorialLessonCommand349={type:'tutorial-lesson';lesson:TutorialLessonId349};
export const isTutorialLessonCommand349=(c:unknown):c is TutorialLessonCommand349=>!!c&&typeof c==='object'&&(c as {type?:unknown}).type==='tutorial-lesson';

/** Core TutorialState and Tutor.activeLesson of a tutorial created at 349. */
export function tutorialLessons349(w:Pick<World,'gameProfile'|'schemaVersion'>):TutorialLessons349|undefined {
  return isSchema349OrLater(Number(w.schemaVersion))?w.gameProfile?.tutorial347?.lessons349:undefined;
}
/** A fresh record, at creation (TutorialState of InitLearnToPlay). The intro
 * of the first lesson (the centered card of the world page) is always over
 * before a map exists: its overlay absorbs input until it ends. */
export const createTutorialLessons349=():TutorialLessons349=>({revision:1,introDone:true,startingItems:[]});

const width=(r:TutorialRect349)=>r.maxX-r.minX+1,height=(r:TutorialRect349)=>r.maxZ-r.minZ+1;
/** Core CellRect.ContractedBy / ExpandedBy. */
export const contractRect349=(r:TutorialRect349,n:number):TutorialRect349=>({minX:r.minX+n,minZ:r.minZ+n,maxX:r.maxX-n,maxZ:r.maxZ-n});
export const rectContains349=(r:TutorialRect349,c:Cell):boolean=>c.x>=r.minX&&c.x<=r.maxX&&c.z>=r.minZ&&c.z<=r.maxZ;
/** Core CellRect.EdgeCells, in Core's order (bottom row, right column, top row, left column). */
export function rectEdgeCells349(r:TutorialRect349):Cell[] {
  const out:Cell[]=[];if(r.maxX<r.minX||r.maxZ<r.minZ)return out;
  for(let x=r.minX;x<=r.maxX;x++)out.push({x,z:r.minZ});
  for(let z=r.minZ+1;z<=r.maxZ;z++)out.push({x:r.maxX,z});
  if(r.maxZ>r.minZ)for(let x=r.maxX-1;x>=r.minX;x--)out.push({x,z:r.maxZ});
  if(r.maxX>r.minX)for(let z=r.maxZ-1;z>r.minZ;z--)out.push({x:r.minX,z});
  return out;
}
/** Core CellRect.CenterCell. */
export const rectCenter349=(r:TutorialRect349):Cell=>({x:r.minX+Math.floor(width(r)/2),z:r.minZ+Math.floor(height(r)/2)});
/** Instruction_BuildSandbags: the ring of the sandbags rect without its two
 * center lines. */
export function sandbagCells349(r:TutorialRect349):Cell[] {const c=rectCenter349(r);return rectEdgeCells349(r).filter(e=>e.x!==c.x&&e.z!==c.z);}
/** Instruction_DownRaider: the cover cells, the same ring one cell inside. */
export function coverCells349(r:TutorialRect349):Cell[] {return sandbagCells349(contractRect349(r,1));}
/** Instruction_BuildRoomDoor: the room edge without its four corners. */
export function doorCells349(r:TutorialRect349):Cell[] {
  return rectEdgeCells349(r).filter(c=>!((c.x===r.minX||c.x===r.maxX)&&(c.z===r.minZ||c.z===r.maxZ)));
}

/** Construction blueprints and frames of the player (Core ThingRequestGroup
 * Blueprint and BuildingFrame); the other jobs are designations. */
const DESIGNATIONS=new Set(['smooth-wall','smooth-floor','remove-bridge','extract-tree','remove-floor','flick','repair','fix-breakdown','build-roof','remove-roof','mine','chop','harvest','cut','sow','deconstruct','uninstall','install','replant-tree']);
export const isConstructionJob349=(j:Pick<Job,'kind'>):boolean=>!DESIGNATIONS.has(j.kind);
/** Core TutorUtility.BuildingOrBlueprintOrFrameCenterExists. */
export function thingCenterAt349(w:Pick<World,'structures'|'jobs'>,c:Cell,kind:string):boolean {
  return w.structures.some(s=>s.kind===kind&&s.x===c.x&&s.z===c.z)||w.jobs.some(j=>j.kind===kind&&j.x===c.x&&j.z===c.z);
}

/** Core Area.TrueCount of the home area. */
export const homeAreaCount349=(w:Pick<World,'home'>):number=>w.home?.length??0;
/** Core Area_BuildRoof.TrueCount. */
export const buildRoofAreaCount349=(w:Pick<World,'roofing'>):number=>w.roofing?.build.length??0;

/** ChooseStoryteller (endTutorial): TutorialState.Notify_TutorialEnding
 * clears the starting items and both rectangles; the lesson is over. */
export function endTutorialLessons349(state:TutorialState347):TutorialState347 {
  const lessons=state.lessons349;
  return lessons?{...state,lessons349:{revision:1,introDone:lessons.introDone,startingItems:[]}}:{...state};
}

const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const plainKeys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]):boolean=>required.every(k=>Object.hasOwn(v,k))&&
  Reflect.ownKeys(v).every(k=>typeof k==='string'&&(required.includes(k)||optional.includes(k))&&Object.getOwnPropertyDescriptor(v,k)!.enumerable===true&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function validRect(v:unknown,size:{width:number;height:number},w:{width:number;height:number}):boolean {
  if(!record(v)||!plainKeys(v,['minX','minZ','maxX','maxZ'],[]))return false;
  const r=v as unknown as TutorialRect349;
  return int(r.minX)&&int(r.minZ)&&int(r.maxX)&&int(r.maxZ)&&r.maxX<w.width&&r.maxZ<w.height&&width(r)===size.width&&height(r)===size.height;
}
/** Shape of the record (game-profile-save.ts); the map checks follow in
 * validateTutorialLessons349. */
export function validTutorialLessonsShape349(v:unknown,ended:boolean):boolean {
  if(!record(v)||!plainKeys(v,['revision','introDone','startingItems'],['active','roomRect','sandbagsRect','zoneRect','mineCells','areaStart','blueprints'])||v.revision!==1||typeof v.introDone!=='boolean')return false;
  if(!Array.isArray(v.startingItems)||v.startingItems.length>4096||!v.startingItems.every(id=>int(id,1))||new Set(v.startingItems).size!==v.startingItems.length)return false;
  if(v.active!==undefined&&!isGameLesson349(v.active))return false;
  if(ended&&(v.active!==undefined||v.startingItems.length||v.roomRect!==undefined||v.sandbagsRect!==undefined))return false;
  const at=v.active===undefined?-1:tutorialLessonIndex349(v.active as string),after=(id:TutorialLessonId349)=>at>=tutorialLessonIndex349(id);
  // A rectangle exists only from its lesson on; it can be missing when no
  // usable place was found (TutorUtility.FindUsableRect never gives up in Core).
  if(v.roomRect!==undefined&&!after('BuildRoomWalls')||v.sandbagsRect!==undefined&&!after('BuildSandbags'))return false;
  if(v.zoneRect!==undefined&&v.active!=='MakeStockpile'&&v.active!=='MakeGrowingZone')return false;
  if((v.mineCells!==undefined)!==(v.active==='MineSteel')||(v.blueprints!==undefined)!==(v.active==='FinishSandbags'))return false;
  if((v.areaStart!==undefined)!==(v.active==='ExpandAreaHome'||v.active==='ExpandAreaBuildRoof'))return false;
  if(v.blueprints!==undefined&&!int(v.blueprints))return false;
  return true;
}
/** Strict map checks of a tutorial lesson record. */
export function validateTutorialLessons349(w:World):string[] {
  const state=w.gameProfile?.tutorial347?.lessons349;if(state===undefined)return [];
  if(!isSchema349OrLater(Number(w.schemaVersion)))return ['Tutorial lessons before schema 349.'];
  const map={width:w.width,height:w.height},cells=w.width*w.height;
  if(state.roomRect!==undefined&&!validRect(state.roomRect,TUTORIAL_ROOM_SIZE_349,map))return ['Invalid tutorial room rectangle.'];
  if(state.sandbagsRect!==undefined&&!validRect(state.sandbagsRect,TUTORIAL_SANDBAGS_SIZE_349,map))return ['Invalid tutorial sandbags rectangle.'];
  if(state.zoneRect!==undefined&&!validRect(state.zoneRect,state.active==='MakeStockpile'?TUTORIAL_STOCKPILE_SIZE_349:TUTORIAL_GROWING_SIZE_349,map))return ['Invalid tutorial zone rectangle.'];
  if(state.mineCells!==undefined&&(!Array.isArray(state.mineCells)||state.mineCells.length>100||!state.mineCells.every((i,n,a)=>int(i,0,cells-1)&&(n===0||i>a[n-1]!))))return ['Invalid tutorial mine cells.'];
  if(state.areaStart!==undefined&&!int(state.areaStart,0,cells))return ['Invalid tutorial area count.'];
  return [];
}
