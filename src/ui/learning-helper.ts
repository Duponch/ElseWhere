import {parseFirstGesturesLearning,type FirstGestureId} from './first-gestures-learning';

/** Learning helper (Core LessonAutoActivator, LearningReadout and
 * PlayerKnowledgeDatabase). Interface code only: real time, browser storage,
 * never the World, a save, the simulation or its random streams. */

export const LEARNING_HELPER_STORAGE_KEY='elsewhere.learning.helper.v1';
/** Core LessonAutoActivator constants (RimWorld 1.6). */
export const LEARNING_GRACE_SECONDS=8;
export const LEARNING_KNOWLEDGE_DECAY_PER_SECOND=.00015;
export const LEARNING_OPPORTUNITY_DECAY_PER_SECOND=.4;
export const LEARNING_OPPORTUNITY_MAX_DESIRE_ADD=60;
/** Core checks every 15 frames, i.e. a quarter of a second at 60 images/s. */
export const LEARNING_CHECK_SECONDS=.25;
export const LEARNING_MAX_SHOWN=3;
/** A GoodToKnow opportunity still opens its concept while fewer are shown. */
export const LEARNING_GOOD_TO_KNOW_SHOWN_LIMIT=4;
export const LEARNING_SKIP_KNOWLEDGE=.15;
export const LEARNING_MIN_DESIRE=.1;
export const LEARNING_COMPLETE=.999;
export const LEARNING_INITIAL_SECONDS_SINCE_LESSON=10000;
/** Frames counted per second of real time for Core's per-frame amounts. */
export const LEARNING_FRAMES_PER_SECOND=60;
/** Real time between two browser writes of a decaying knowledge table. */
export const LEARNING_WRITE_INTERVAL_SECONDS=30;

export type LearningOpportunity='good-to-know'|'important'|'critical';
export const OPPORTUNITY_VALUES:Readonly<Record<LearningOpportunity,number>>=Object.freeze({'good-to-know':60,important:80,critical:100});
/** Core KnowledgeAmount. Per-frame amounts are multiplied by the frames shown. */
export type KnowledgeAmount='frame-displayed'|'frame-interaction'|'tiny'|'small'|'specific'|'total'|'note-closed'|'note-taught';
export const KNOWLEDGE_AMOUNTS:Readonly<Record<KnowledgeAmount,number>>=Object.freeze({
  'frame-displayed':.004,'frame-interaction':.008,tiny:.03,small:.1,specific:.4,total:1,'note-closed':.5,'note-taught':1,
});

/** One ConceptDef. Priority ≤ 0 marks a one-time modal message (Core
 * TriggeredDirect): it never enters the shown list. */
export interface LearningConcept {
  id:string;
  /** Core ConceptDef name, or 'Elsewhere' for an adaptation of our own. */
  core:string;
  group:'self-show'|'opportunistic'|'modal';
  title:string;
  text:string;
  priority:number;
  needsOpportunity:boolean;
  opportunityDecays:boolean;
}
export const isModalConcept=(concept:Pick<LearningConcept,'priority'>):boolean=>concept.priority<=0;

export interface LearningKnowledgeRecord {version:1;enabled:boolean;knowledge:Record<string,number>}
const ID=/^[a-z0-9-]{1,40}$/;
const MAX_RAW=16384,MAX_KEYS=200;
const plain=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;

/** Strict reader of the browser record; null (absent) is a fresh record.
 * Unknown concept ids are kept untouched for a later version of the game. */
export function parseLearningKnowledge(raw:string|null):LearningKnowledgeRecord|undefined {
  if(raw===null)return {version:1,enabled:true,knowledge:{}};
  if(typeof raw!=='string'||raw.length>MAX_RAW)return undefined;
  try{
    const value:unknown=JSON.parse(raw);
    if(!plain(value)||Object.keys(value).length!==3||value.version!==1||typeof value.enabled!=='boolean'||!plain(value.knowledge))return undefined;
    const entries=Object.entries(value.knowledge);
    if(entries.length>MAX_KEYS)return undefined;
    const knowledge:Record<string,number>={};
    for(const [key,amount] of entries){
      if(!ID.test(key)||typeof amount!=='number'||!Number.isFinite(amount)||amount<=0||amount>1)return undefined;
      knowledge[key]=amount;
    }
    return {version:1,enabled:value.enabled,knowledge};
  }catch{return undefined;}
}
/** Rounded, zero-free and key-sorted: a small stable record. */
export function serializeLearningKnowledge(record:LearningKnowledgeRecord):string {
  const knowledge:Record<string,number>={};
  for(const key of Object.keys(record.knowledge).sort()){const amount=Math.round(record.knowledge[key]!*1e5)/1e5;if(amount>0)knowledge[key]=Math.min(1,amount);}
  return JSON.stringify({version:1,enabled:record.enabled,knowledge});
}

/** The four first gestures already learned in this browser, as concepts. */
export const GESTURE_CONCEPTS:Readonly<Record<FirstGestureId,string>>=Object.freeze({work:'work-tab',storage:'stockpiles',beds:'beds',cultivation:'growing'});

export interface LearningHelperOptions {
  concepts:readonly LearningConcept[];
  read:()=>string|null;
  write:(value:string)=>void|boolean;
  /** The first-gestures record, read once when no helper record exists. */
  readGestures?:()=>string|null;
  /** A concept became shown or left the list, or knowledge was reset. */
  changed?:()=>void;
}
export interface LearningUpdateContext {
  /** A local map is shown and playable (not the front menu or a loading). */
  playing:boolean;
  /** The in-game Menu is open (Core TickManager.NotPlaying). */
  menuOpen:boolean;
}
export interface ShownConcept {id:string;title:string;text:string;knowledge:number}
export type LearningHelper=ReturnType<typeof createLearningHelper>;

/** Core rules, faithfully: desire = (priority + opportunity × 0.6) ×
 * (1 − knowledge); a check every quarter second after an 8 s grace and while
 * the Menu is closed, decaying knowledge and opportunities and showing the
 * most desired concept when the relax timer allows it; opportunities open
 * their concept at once for Important and Critical. */
export function createLearningHelper(options:LearningHelperOptions){
  const concepts=options.concepts,byId=new Map(concepts.map(concept=>[concept.id,concept]));
  if(byId.size!==concepts.length||concepts.some(concept=>!ID.test(concept.id)))throw Error('Learning concepts need distinct identifiers.');
  let record:LearningKnowledgeRecord={version:1,enabled:true,knowledge:{}},saved=true,dirty=false,sinceWrite=0;
  try{
    const raw=options.read(),parsed=parseLearningKnowledge(raw);
    if(parsed)record=parsed;else saved=false;
    if(raw===null&&parsed){
      // One-time migration: the gestures already recognized count as learned.
      let gestures;try{gestures=parseFirstGesturesLearning(options.readGestures?.()??null);}catch{gestures=undefined;}
      for(const id of Object.keys(gestures?.learned??{}) as FirstGestureId[]){const concept=GESTURE_CONCEPTS[id];if(byId.has(concept))record.knowledge[concept]=1;}
      // Written at once: a later reset never imports the gestures again.
      try{saved=options.write(serializeLearningKnowledge(record))!==false;}catch{saved=false;}
    }
  }catch{saved=false;}
  const opportunities=new Map<string,number>();
  const active:string[]=[];
  let secondsSinceLesson=LEARNING_INITIAL_SECONDS_SINCE_LESSON,sinceLoad=LEARNING_GRACE_SECONDS,sinceDialog=LEARNING_GRACE_SECONDS,checkClock=0;

  const knowledge=(id:string):number=>record.knowledge[id]??0;
  const isComplete=(id:string):boolean=>knowledge(id)>LEARNING_COMPLETE;
  const opportunity=(id:string):number=>opportunities.get(id)??0;
  const notify=():void=>{try{options.changed?.();}catch{/* presentation observers cannot undo knowledge */}};
  const persist=():void=>{
    dirty=false;sinceWrite=0;
    try{saved=options.write(serializeLearningKnowledge(record))!==false;}catch{saved=false;}
  };
  /** Core PlayerKnowledgeDatabase.SetKnowledge, with NewlyLearned. */
  const setKnowledge=(id:string,value:number):void=>{
    const before=knowledge(id),after=Math.min(1,Math.max(0,value));
    if(after>0)record.knowledge[id]=after;else delete record.knowledge[id];
    dirty=true;
    if(before<LEARNING_COMPLETE&&after>=LEARNING_COMPLETE){
      const index=active.indexOf(id);
      if(index>=0)active.splice(index,1);
      persist();notify();
    }
  };
  const desire=(id:string):number=>{
    const concept=byId.get(id);
    if(!concept||isComplete(id)||active.includes(id))return 0;
    if(concept.needsOpportunity&&opportunity(id)<.1)return 0;
    return (concept.priority+opportunity(id)/100*LEARNING_OPPORTUNITY_MAX_DESIRE_ADD)*(1-knowledge(id));
  };
  const mostDesired=():LearningConcept|undefined=>{
    let best=-9999,result:LearningConcept|undefined;
    for(const concept of concepts){
      const value=desire(concept.id);
      if(value>best&&!(concept.needsOpportunity&&opportunity(concept.id)<.1)&&!(knowledge(concept.id)>LEARNING_SKIP_KNOWLEDGE)){best=value;result=concept;}
    }
    return result;
  };
  const tryInitiate=(id:string):boolean=>{
    if(active.includes(id))return false;
    active.push(id);secondsSinceLesson=0;notify();return true;
  };
  const check=(seconds:number):void=>{
    for(const concept of concepts){
      if(isComplete(concept.id))continue;
      const current=knowledge(concept.id);
      if(current>0){const next=Math.max(0,current-LEARNING_KNOWLEDGE_DECAY_PER_SECOND*seconds);if(next>0)record.knowledge[concept.id]=next;else delete record.knowledge[concept.id];dirty=true;}
      if(concept.opportunityDecays&&opportunities.has(concept.id))opportunities.set(concept.id,Math.max(0,opportunity(concept.id)-LEARNING_OPPORTUNITY_DECAY_PER_SECOND*seconds));
    }
    if(active.length<LEARNING_MAX_SHOWN){
      const best=mostDesired();
      if(best){const value=desire(best.id);if(value>LEARNING_MIN_DESIRE&&relaxDesire()<value)tryInitiate(best.id);}
    }else secondsSinceLesson=0;
  };
  const relaxDesire=():number=>100-secondsSinceLesson/9;

  return {
    concepts,
    get enabled(){return record.enabled;},
    get saved(){return saved;},
    get secondsSinceLesson(){return secondsSinceLesson;},
    get relaxDesire(){return relaxDesire();},
    /** Shown concepts, in activation order (modal ones never). */
    get active():readonly string[]{return [...active];},
    get shown():ShownConcept[]{
      if(!record.enabled)return [];
      return active.map(id=>{const concept=byId.get(id)!;return {id,title:concept.title,text:concept.text,knowledge:knowledge(id)};});
    },
    concept:(id:string)=>byId.get(id),
    knowledge,isComplete,opportunity,desire,
    /** Core LessonAutoActivator.TeachOpportunity. */
    teachOpportunity(id:string,type:LearningOpportunity):boolean {
      const concept=byId.get(id);
      if(!concept||!record.enabled||isComplete(id)||isModalConcept(concept))return false;
      opportunities.set(id,OPPORTUNITY_VALUES[type]);
      if(type!=='good-to-know'||active.length<LEARNING_GOOD_TO_KNOW_SHOWN_LIMIT)return tryInitiate(id);
      return false;
    },
    /** Core KnowledgeDemonstrated, counted even with the helper off. `frames`
     * repeats a per-frame call (Core credits some amounts every frame). */
    demonstrate(id:string,amount:KnowledgeAmount,frames=1):void {
      if(!byId.has(id)||!(frames>0)||!Number.isFinite(frames))return;
      const added=KNOWLEDGE_AMOUNTS[amount]*frames;
      if(!(added>0))return;
      setKnowledge(id,knowledge(id)+added);
      if(isComplete(id))opportunities.set(id,0);
      // Larger gestures are written at once; per-frame credit waits for the timer.
      if(added>=KNOWLEDGE_AMOUNTS.small&&dirty)persist();
    },
    /** "Compris" (Core Mark learned): knowledge 1. */
    markLearned(id:string):void {if(!byId.has(id))return;setKnowledge(id,1);opportunities.set(id,0);if(dirty)persist();notify();},
    /** Core TutorUtility.DoModalDialogIfNotKnown: the concept to show once,
     * already marked learned; undefined when known. Not gated by the option. */
    modalIfNotKnown(id:string):LearningConcept|undefined {
      const concept=byId.get(id);
      if(!concept||!isModalConcept(concept)||isComplete(id))return undefined;
      setKnowledge(id,1);if(dirty)persist();return concept;
    },
    setEnabled(value:boolean):boolean {
      if(record.enabled!==value){record={...record,enabled:value};persist();notify();}
      return saved;
    },
    /** Options → Réinitialiser: every concept back to zero (Core deletes
     * Knowledge.xml). The first-gestures path is a separate aid, untouched. */
    reset():boolean {record={version:1,enabled:record.enabled,knowledge:{}};persist();notify();return saved;},
    /** A colony was created or loaded (Core Time.timeSinceLevelLoad). */
    levelLoaded():void {sinceLoad=0;},
    /** The starting pods opened (Elsewhere's game-start dialog). */
    startDialogClosed():void {sinceDialog=0;},
    /** Real seconds since the last call. */
    update(seconds:number,context:LearningUpdateContext):void {
      if(!(seconds>0)||!Number.isFinite(seconds))return;
      sinceLoad+=seconds;sinceDialog+=seconds;sinceWrite+=seconds;
      if(dirty&&sinceWrite>=LEARNING_WRITE_INTERVAL_SECONDS)persist();
      if(!record.enabled||!context.playing)return;
      secondsSinceLesson+=seconds;
      if(sinceLoad<LEARNING_GRACE_SECONDS||sinceDialog<LEARNING_GRACE_SECONDS||context.menuOpen)return;
      checkClock+=seconds;
      if(checkClock<LEARNING_CHECK_SECONDS)return;
      const elapsed=checkClock;checkClock=0;check(elapsed);
    },
    /** Writes pending knowledge (page hidden, colony replaced). */
    flush():void {if(dirty)persist();},
  };
}
