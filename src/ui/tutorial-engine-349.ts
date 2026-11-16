/** The lesson engine of Core RimWorld 1.6's tutorial (TutorSystem,
 * ActiveLessonHandler, Lesson_Instruction and the Instruction_* classes),
 * on Elsewhere's interface.
 *
 * - One active lesson at a time. The five lessons of the creation pages live
 *   here only (no World exists yet); from GameStartDialogClosed on, the
 *   active lesson is the game's (src/sim/tutorial-lessons-349.ts): the engine
 *   asks for the next one with `tutorial-lesson` and follows the confirmed
 *   snapshots.
 * - notify(tag): Core Notify_Event. The event goes to the active lesson
 *   (eventTagsEnd and the classes' own checks), then activates the first
 *   lesson whose eventTagInitiate is the tag (and whose source, if any, is
 *   the lesson active before the event). The chain is
 *   InstructionDeactivated-<previous>.
 * - allow(action): Core AllowAction. Only while a lesson is active: the tag
 *   must be in the lesson's allowed list, with the cell checks of its class.
 * - tick(): the lessons that end on the map state (LessonUpdate), at the
 *   helper's cadence, on the latest snapshot only.
 * Interface only: real time, never a World write; the game changes only
 * through the `tutorial-lesson` command it sends. */
import {materialAllowedForPlayer256} from '../sim/material-permission-256';
import {factionOf,factionRelation,isColonist} from '../sim/affiliation';
import {TUTORIAL_LESSONS_349,contractRect349,coverCells349,doorCells349,isConstructionJob349,isGameLesson349,rectContains349,rectEdgeCells349,sandbagCells349,
  homeAreaCount349,buildRoofAreaCount349,tutorialLessonIndex349,tutorialLessons349,type TutorialLessonCommand349,type TutorialLessonId349,type TutorialLessons349,type TutorialRect349} from '../sim/tutorial-lessons-state-349';
import {tutorialMode347} from '../sim/game-profile';
const tutorialLessonsRecord=(w:World)=>Number(w.schemaVersion)>=349?w.gameProfile?.tutorial347?.lessons349:undefined;
import {TUTORIAL_LESSON_DEFS_349,tutorialLessonDef349,type TutorialLessonDef349} from './tutorial-lessons-349';
import type {TutorialAction349} from './tutorial-actions-349';
import type {Cell,World} from '../sim/types';

/** Learning helper calls of Instruction_LearnConcept (PlayerKnowledgeDatabase). */
export interface TutorialHelperHooks349 {knowledge(id:string):number;isComplete(id:string):boolean;setKnowledge(id:string,value:number):void}
export interface TutorialEngineOptions349 {
  /** The confirmed snapshot of the shown map, if any. */
  world():World|undefined;
  /** Changes when another game or map is shown (load, new colony). */
  epoch():number;
  /** A map is shown and playable (no front menu, loading or replacement). */
  playing():boolean;
  send(command:TutorialLessonCommand349):Promise<unknown>;
  helper?:TutorialHelperHooks349;
  /** The single selected building (Instruction_AddBill.RelevantBill). */
  selectedStructure?():number|undefined;
  /** Real time, milliseconds. */
  now():number;
  /** Lesson_Instruction.resetBuildDesignatorStuffs: the material back to wood. */
  resetMaterial?():void;
  /** The active lesson, its progress or the highlight changed. */
  changed?():void;
  /** The tutorial ended (endTutorial): LessonAutoActivator.Notify_TutorialEnding. */
  ended?():void;
}
export interface TutorialCardView349 {
  lesson:TutorialLessonId349;
  text:string;
  /** 0..1 when the lesson shows a progress bar. */
  progress?:number;
  /** Real time of the activation (the white flash fades over 0.5 s). */
  activatedAt:number;
  /** The first lesson's intro: centered on a dark overlay, then sliding. */
  intro?:{centered:number;overlay:number};
}
export type TutorialEngine349=ReturnType<typeof createTutorialEngine349>;

/** Core Lesson_Instruction intro: 4 s centered on a 90 % overlay, 1 s slide. */
export const TUTORIAL_INTRO_HOLD_349=4,TUTORIAL_INTRO_SLIDE_349=1;
/** Seconds after a confirmed lesson command before a lagging snapshot wins. */
const STALE_SECONDS=3;
const DEFS=TUTORIAL_LESSON_DEFS_349;

const cellKey=(w:{width:number},c:Cell)=>c.z*w.width+c.x;
const within=(cells:readonly Cell[]|undefined,allowed:readonly Cell[]):boolean=>{
  if(!cells)return false;const set=new Set(allowed.map(c=>`${c.x},${c.z}`));return cells.every(c=>set.has(`${c.x},${c.z}`));
};
const sameRect=(a:TutorialRect349|undefined,b:TutorialRect349|undefined)=>!!a&&!!b&&a.minX===b.minX&&a.minZ===b.minZ&&a.maxX===b.maxX&&a.maxZ===b.maxZ;
const expandRect=(r:TutorialRect349,n:number)=>contractRect349(r,-n);
function centers(w:World,kind:string):Set<number> {
  const out=new Set<number>();
  for(const s of w.structures)if(s.kind===kind)out.add(cellKey(w,s));
  for(const j of w.jobs)if(j.kind===kind)out.add(cellKey(w,j));
  return out;
}
function rectCells(r:TutorialRect349,w:{width:number;height:number}):Cell[] {
  const out:Cell[]=[];for(let z=Math.max(0,r.minZ);z<=Math.min(w.height-1,r.maxZ);z++)for(let x=Math.max(0,r.minX);x<=Math.min(w.width-1,r.maxX);x++)out.push({x,z});return out;
}
const freeColonists=(w:World)=>w.pawns.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead');
const hostileHuman=(p:World['pawns'][number])=>!p.prisoner&&factionRelation(factionOf(p),'colony')==='hostile';

/** The cells a lesson builds on (Instruction_BuildAtRoom.BuildableRect). */
function buildableRect(def:TutorialLessonDef349,data:TutorialLessons349):TutorialRect349|undefined {
  if(!data.roomRect)return undefined;
  return def.kind==='near-room'?expandRect(data.roomRect,10):contractRect349(data.roomRect,1);
}
function numPlaced(def:TutorialLessonDef349,w:World,data:TutorialLessons349):number {
  const rect=buildableRect(def,data);if(!rect||!def.thing)return 0;
  const set=centers(w,def.thing);let n=0;for(const c of rectCells(rect,w))if(set.has(cellKey(w,c)))n++;return n;
}

/** Core ProgressPercent of the active lesson, or undefined without a bar.
 * Its own data must be the game's (a lesson just asked for has none yet). */
export function tutorialLessonProgress349(def:TutorialLessonDef349,w:World,data:TutorialLessons349,helper?:TutorialHelperHooks349,selected?:number):number|undefined {
  switch(def.kind){
    case 'concept':return def.concept&&helper?Math.min(1,helper.knowledge(def.concept)):undefined;
    case 'unforbid':{
      const items=data.startingItems,piles=new Map(w.piles.map(p=>[p.id,p]));
      if(!items.length)return 1;
      return items.filter(id=>{const p=piles.get(id);return !p||materialAllowedForPlayer256(p);}).length/items.length;
    }
    case 'walls':{if(!data.roomRect)return 0;const set=centers(w,'wall'),edges=rectEdgeCells349(data.roomRect);return edges.filter(c=>set.has(cellKey(w,c))).length/edges.length;}
    case 'in-room':case 'near-room':return (def.target??1)<=1?undefined:numPlaced(def,w,data)/(def.target??1);
    case 'equip':{
      const people=freeColonists(w);if(!people.length)return 1;
      const armed=new Set(w.piles.filter(p=>p.owner.type==='equipment').map(p=>(p.owner as {pawnId:number}).pawnId));
      return people.filter(p=>armed.has(p.id)).length/people.length;
    }
    case 'bill':{
      // Instruction_AddBill: the selected stove's simple meal bill, (1 + count) / 11.
      const stove=selected===undefined?undefined:w.structures.find(s=>s.id===selected&&s.kind===def.thing);
      const bill=stove?.bills?.find(b=>b.recipe==='simple-meal');
      const target=def.target??10;return bill?(1+(bill.mode==='times'?bill.target:0))/(target+1):0;
    }
    case 'mine':{
      const cells=data.mineCells??[];if(!cells.length)return 1;
      const ordered=new Set(w.jobs.filter(j=>j.kind==='mine').map(j=>cellKey(w,j)));
      return cells.filter(i=>ordered.has(i)||w.tiles[i]?.terrain!=='rock'||w.tiles[i]?.ore!=='steel').length/cells.length;
    }
    case 'chop':{
      const trees=new Set(w.resources.filter(r=>r.kind==='tree').map(r=>cellKey(w,r)));
      return w.jobs.filter(j=>j.kind==='chop'&&trees.has(cellKey(w,j))).length/(def.target??10);
    }
    case 'expand-area':return ((def.id==='ExpandAreaHome'?homeAreaCount349(w):buildRoofAreaCount349(w))-(data.areaStart??0))/(def.target??1);
    case 'sandbags':{if(!data.sandbagsRect)return 0;const set=centers(w,'sandbags'),cells=sandbagCells349(data.sandbagsRect);return cells.filter(c=>set.has(cellKey(w,c))).length/cells.length;}
    case 'finish':{const initial=data.blueprints??0;if(!initial)return 1;return 1-w.jobs.filter(isConstructionJob349).length/initial;}
    case 'undraft':{const people=freeColonists(w);if(!people.length)return 1;return 1-people.filter(p=>!!p.draft).length/people.length;}
    default:return undefined;
  }
}
/** Core LessonUpdate checks: true when the active lesson is over on this map. */
export function tutorialLessonComplete349(def:TutorialLessonDef349,w:World,data:TutorialLessons349,helper?:TutorialHelperHooks349,selected?:number):boolean {
  switch(def.kind){
    case 'concept':return !!def.concept&&!!helper?.isComplete(def.concept);
    // The pods must have placed their items before they can be unforbidden.
    case 'unforbid':return (!w.startingArrival||w.startingArrival.phase==='opened')&&(tutorialLessonProgress349(def,w,data)??0)>.9999;
    case 'walls':case 'equip':case 'sandbags':case 'finish':case 'undraft':return (tutorialLessonProgress349(def,w,data)??0)>.9999;
    case 'bill':case 'mine':case 'chop':case 'expand-area':return (tutorialLessonProgress349(def,w,data,helper,selected)??0)>.999;
    case 'in-room':case 'near-room':return numPlaced(def,w,data)>=(def.target??1);
    case 'down-raider':
      // Hostile humans and manhunting animals (adaptation: dormant mechanoids
      // and hive insects of ancient sites do not hold the lesson).
      return !w.pawns.some(p=>hostileHuman(p)&&p.state!=='downed'&&p.state!=='dead')&&!w.wildlife?.animals.some(a=>!!a.manhunter&&a.state!=='downed'&&a.state!=='dead');
    default:return false;
  }
}

/** Instruction AllowAction overrides, then Lesson_Instruction's list. The
 * lesson's own data must be known (absent: refused). */
export function tutorialLessonAllows349(def:TutorialLessonDef349,action:TutorialAction349,w:World|undefined,data:TutorialLessons349|undefined):boolean {
  const base=()=>def.allowed.includes(action.tag);
  switch(def.kind){
    case 'stockpile':case 'growing-zone':{
      const tag=def.kind==='stockpile'?'Designate-ZoneAddStockpile_Resources':'Designate-ZoneAdd_Growing';
      // TutorUtility.EventCellsMatchExactly: exactly the shown rectangle.
      return action.tag===tag?sameRect(action.rect,data?.zoneRect):base();
    }
    case 'walls':{
      if(action.tag!=='Designate-Wall')return base();
      if(!w||!data?.roomRect)return false;
      const set=centers(w,'wall');return within(action.cells,rectEdgeCells349(data.roomRect).filter(c=>!set.has(cellKey(w,c))));
    }
    case 'door':return action.tag==='Designate-Door'?!!data?.roomRect&&within(action.cells,doorCells349(data.roomRect)):base();
    case 'in-room':case 'near-room':{
      if(!def.thing||action.tag!==`Designate-${tutorialDefName(def)}`)return base();
      const rect=data&&buildableRect(def,data);if(!rect||!action.cells?.length)return false;
      return action.cells.every(c=>rectContains349(rect,c)&&!(def.kind==='near-room'&&rectContains349(data!.roomRect!,c)));
    }
    case 'mine':return action.tag==='Designate-Mine'?!!data?.mineCells&&!!w&&within(action.cells,data.mineCells.map(i=>({x:i%w.width,z:Math.floor(i/w.width)}))):base();
    case 'sandbags':return action.tag==='Designate-Sandbags'?!!data?.sandbagsRect&&within(action.cells,sandbagCells349(data.sandbagsRect)):base();
    default:return base();
  }
}
const DEF_NAMES:Readonly<Record<string,string>>={bed:'Bed','torch-lamp':'TorchLamp','animal-sleeping-spot':'AnimalSleepingSpot',horseshoes:'HorseshoesPin','fueled-stove':'FueledStove','research-bench':'SimpleResearchBench'};
const tutorialDefName=(def:TutorialLessonDef349)=>DEF_NAMES[def.thing!]??def.thing!;

/** The map rectangle a lesson outlines (TutorUtility.DrawCellRectOnGUI and
 * GenDraw.DrawFieldEdges), as the renderer's {x,z,width,height}. */
export function tutorialLessonOutline349(def:TutorialLessonDef349,w:World|undefined,data:TutorialLessons349|undefined):{x:number;z:number;width:number;height:number}|null {
  if(!data)return null;
  const box=(r:TutorialRect349)=>({x:r.minX,z:r.minZ,width:r.maxX-r.minX+1,height:r.maxZ-r.minZ+1});
  switch(def.kind){
    case 'stockpile':case 'growing-zone':return data.zoneRect?box(data.zoneRect):null;
    case 'walls':case 'door':case 'in-room':return data.roomRect?box(def.kind==='in-room'?contractRect349(data.roomRect,1):data.roomRect):null;
    case 'sandbags':return data.sandbagsRect?box(data.sandbagsRect):null;
    case 'down-raider':{
      if(!data.sandbagsRect||!w)return null;
      // Shown until every free colonist stands on a cover cell.
      const cover=new Set(coverCells349(data.sandbagsRect).map(c=>cellKey(w,c)));
      return freeColonists(w).every(p=>cover.has(cellKey(w,p)))?null:box(data.sandbagsRect);
    }
    case 'mine':{
      const cells=data.mineCells??[];if(!cells.length||!w)return null;
      let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
      for(const i of cells){const x=i%w.width,z=Math.floor(i/w.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}
      return box({minX,minZ,maxX,maxZ});
    }
    default:return null;
  }
}

const missingPlace=(def:TutorialLessonDef349,data:TutorialLessons349):boolean=>
  (def.kind==='stockpile'||def.kind==='growing-zone')&&!data.zoneRect||(def.kind==='walls'||def.kind==='door'||def.kind==='in-room'||def.kind==='near-room')&&!data.roomRect||def.kind==='sandbags'&&!data.sandbagsRect;

/** Engine. A normal game (no lesson record) gates nothing and shows nothing. */
export function createTutorialEngine349(options:TutorialEngineOptions349){
  /** Creation pages of a tutorial (Core: the Tutor is the storyteller of the game being prepared). */
  let creation=false,creationLesson:TutorialLessonId349|undefined,creationAt=0,introDone=false;
  /** The game's lesson as the interface knows it (ahead of the snapshot while a command is pending). */
  let epoch:number|undefined,local:TutorialLessonId349|undefined,localAt=0,ended=false,endedNotified=false,started=false;
  let pending:TutorialLessonId349|undefined,confirmedAt:number|undefined,lastKey='',transition=false;
  const now=()=>options.now(),seconds=(at:number)=>(now()-at)/1000;
  const changed=()=>{try{options.changed?.();}catch{/* presentation only */}};
  const gameRecord=():TutorialLessons349|undefined=>{const w=options.world();return w&&tutorialMode347(w)?tutorialLessons349(w):undefined;};
  /** A tutorial with lessons whose storyteller was chosen (endTick set). */
  const gameEnded=(w:World|undefined)=>!!w&&tutorialLessonsRecord(w)!==undefined&&w.gameProfile!.tutorial347!.endedAtCore!==undefined;
  /** The end reached through the game (the choice of the storyteller already
   * handed it over): the lesson is over too. */
  const finish=():void=>{
    ended=true;if(local!==undefined){local=undefined;}pending=undefined;changed();
    if(!endedNotified){endedNotified=true;try{options.ended?.();}catch{/* presentation only */}}
  };
  /** The game record when it describes the lesson the interface shows. */
  const lessonData=():TutorialLessons349|undefined=>{const data=gameRecord();return data&&data.active===local&&pending===undefined?data:undefined;};

  function sync():void {
    if(transition)return;
    const w=options.world(),e=options.epoch();
    if(e!==epoch){epoch=e;pending=undefined;confirmedAt=undefined;started=false;ended=gameEnded(w);endedNotified=ended;local=gameRecord()?.active;localAt=now();changed();return;}
    const data=gameRecord();
    if(!data){if(gameEnded(w)&&!ended)finish();else if(local!==undefined){local=undefined;changed();}return;}
    if(pending!==undefined)return;
    const at=local===undefined?-1:tutorialLessonIndex349(local),theirs=data.active===undefined?-1:tutorialLessonIndex349(data.active);
    // A later lesson in the game (a save loaded, another view) wins at once; a
    // lagging snapshot only after the confirmed command had time to arrive.
    if(theirs>at||theirs<at&&(confirmedAt===undefined||seconds(confirmedAt)>STALE_SECONDS)){local=data.active;localAt=now();confirmedAt=undefined;changed();}
  }
  const activeId=():TutorialLessonId349|undefined=>creation?creationLesson:local;
  const activeDef=():TutorialLessonDef349|undefined=>{const id=activeId();return id?tutorialLessonDef349(id):undefined;};
  const enabled=():boolean=>creation||(!!gameRecord()&&!ended);

  function activate(def:TutorialLessonDef349):void {
    if(creation){if(isGameLesson349(def.id))return;creationLesson=def.id;creationAt=now();changed();return;}
    if(!isGameLesson349(def.id)||!gameRecord()||pending!==undefined)return;
    // Lesson_Instruction.OnActivated; Instruction_LearnConcept resets its concept.
    if(def.concept)options.helper?.setKnowledge(def.concept,0);
    if(def.resetStuff)options.resetMaterial?.();
    local=def.id;localAt=now();pending=def.id;confirmedAt=undefined;changed();
    void Promise.resolve().then(()=>options.send({type:'tutorial-lesson',lesson:def.id})).then(()=>{if(pending===def.id){pending=undefined;confirmedAt=now();}},()=>{
      if(pending!==def.id)return;
      pending=undefined;local=gameRecord()?.active;localAt=now();changed();
    });
  }
  /** ActiveLessonHandler.Deactivate and Lesson_Instruction.PostDeactivated. */
  function deactivate(def:TutorialLessonDef349):void {
    if(creation){if(creationLesson!==def.id)return;creationLesson=undefined;changed();notify(`InstructionDeactivated-${def.id}`);return;}
    if(local!==def.id||pending!==undefined)return;
    if(def.endTutorial){finish();return;}
    // ActiveLessonHandler.Deactivate clears the lesson before PostDeactivated
    // tells InstructionDeactivated-<id>, which activates the next one.
    local=undefined;transition=true;
    try{notify(`InstructionDeactivated-${def.id}`);}finally{transition=false;}
  }
  /** Lesson.Notify_Event of the active lesson. */
  function lessonEvent(def:TutorialLessonDef349,tag:string):void {
    if(def.end?.includes(tag)){deactivate(def);return;}
    const w=options.world(),data=lessonData();
    if(!w||!data)return;
    // Instruction_BuildAtRoom ends on any event once enough is placed;
    // Instruction_BuildRoomDoor on the door; Instruction_MineSteel on a
    // mining designation that covers the lump.
    if((def.kind==='in-room'||def.kind==='near-room')&&tutorialLessonComplete349(def,w,data))deactivate(def);
    else if(def.kind==='door'&&tag==='Designate-Door')deactivate(def);
    else if(def.kind==='mine'&&tag==='Designate-Mine'&&tutorialLessonComplete349(def,w,data))deactivate(def);
  }
  /** TutorSystem.Notify_Event. */
  function notify(tag:string):void {
    sync();
    if(!enabled())return;
    const current=activeDef();
    if(current)lessonEvent(current,tag);
    for(const def of DEFS)if(def.initiate===tag&&(!def.initiateSource||current?.id===def.initiateSource)){activate(def);break;}
  }

  return {
    /** A tutorial's creation pages open (Core InitLearnToPlay). */
    beginCreation():void {creation=true;creationLesson=undefined;introDone=false;changed();},
    /** The creation pages close: the game starts or the player leaves. */
    endCreation():void {if(!creation)return;creation=false;creationLesson=undefined;changed();},
    get inCreation(){return creation;},
    /** The tutorial runs: its creation pages, or a game with lessons not ended. */
    get active():boolean {sync();return enabled();},
    get lesson():TutorialLessonId349|undefined {sync();return enabled()?activeId():undefined;},
    /** True while the game's lesson waits for its confirmation. */
    get pending():boolean {return pending!==undefined;},
    notify,
    /** TutorSystem.AllowAction: undefined when allowed, else the message. */
    allow(action:TutorialAction349):string|undefined {
      if(!enabled())return undefined;
      sync();
      const def=activeDef();if(!def)return undefined;
      if(creation&&def.startCentered&&!introDone&&seconds(creationAt)<TUTORIAL_INTRO_HOLD_349+TUTORIAL_INTRO_SLIDE_349)return '';
      return tutorialLessonAllows349(def,action,options.world(),creation?undefined:lessonData())?undefined:def.text;
    },
    /** Core's intro overlay absorbs every input while it is shown. */
    get introBlocking():boolean {const def=activeDef();return creation&&!!def?.startCentered&&!introDone&&seconds(creationAt)<TUTORIAL_INTRO_HOLD_349+TUTORIAL_INTRO_SLIDE_349;},
    /** The learning helper is off while the tutorial runs (disableAdaptiveTraining). */
    get suspendsHelper():boolean {sync();return enabled();},
    /** LessonUpdate of the active lesson, at most a few times a second. */
    tick():void {
      if(creation){
        const def=activeDef();
        if(def?.startCentered&&!introDone&&seconds(creationAt)>=TUTORIAL_INTRO_HOLD_349+TUTORIAL_INTRO_SLIDE_349){introDone=true;changed();}
        return;
      }
      sync();
      const w=options.world(),data=gameRecord();
      if(!w||!data||ended||!options.playing())return;
      // GameStartDialogClosed: Elsewhere's start has no dialog; the first map lesson begins when the map is shown.
      if(!started&&data.active===undefined&&local===undefined&&pending===undefined){started=true;notify('GameStartDialogClosed');return;}
      const def=activeDef(),own=lessonData();
      if(!def||!own)return;
      // Adaptation: a lesson whose rectangle the game could not place (no usable
      // place on this map) is passed rather than left unfinishable.
      if(missingPlace(def,own)){deactivate(def);return;}
      const selected=options.selectedStructure?.();
      const key=`${def.id}|${tutorialLessonProgress349(def,w,own,options.helper,selected)??''}`;
      if(key!==lastKey){lastKey=key;changed();}
      if(tutorialLessonComplete349(def,w,own,options.helper,selected))deactivate(def);
    },
    /** The card of the active lesson, if any. */
    view():TutorialCardView349|undefined {
      sync();
      const def=enabled()?activeDef():undefined;if(!def)return undefined;
      const w=options.world(),data=lessonData();
      const progress=!creation&&w&&data?tutorialLessonProgress349(def,w,data,options.helper,options.selectedStructure?.()):undefined;
      const view:TutorialCardView349={lesson:def.id,text:def.text,activatedAt:creation?creationAt:localAt,...progress!==undefined&&Number.isFinite(progress)?{progress:Math.max(0,Math.min(1,progress))}:{}};
      if(creation&&def.startCentered&&!introDone){
        const age=seconds(creationAt),t=Math.max(0,Math.min(1,(age-TUTORIAL_INTRO_HOLD_349)/TUTORIAL_INTRO_SLIDE_349));
        view.intro={centered:1-t,overlay:.9*(1-t)};
      }
      return view;
    },
    /** Native highlight tags of the active lesson (Lesson_Instruction.highlightTags). */
    highlightTags():readonly string[] {const def=enabled()?activeDef():undefined;return def?.highlight??[];},
    /** The map rectangle to outline, if the active lesson shows one. */
    outline():{x:number;z:number;width:number;height:number}|null {
      const def=!creation&&enabled()?activeDef():undefined;return def?tutorialLessonOutline349(def,options.world(),lessonData()):null;
    },
    /** The game data of the active lesson (rects, cells), once confirmed. */
    get data():TutorialLessons349|undefined {return lessonData();},
  };
}
export {TUTORIAL_LESSONS_349};
