import {LESSONS,type FirstGestureId,type FirstGesturesLearningState} from './first-gestures-learning';
import type {FirstDayGuideAction,FirstDayGuideId,FirstDayGuideSection,FirstDayGuideStatus} from './first-day-guide';

/** On-screen advice card of the play view. Interface state only: it is never
 * written into the World, a save or the simulation, and it holds no learning
 * knowledge of its own (the first-gestures browser memory stays the owner). */
export type GuidanceCardMode='expanded'|'collapsed'|'closed';

export const GESTURE_ACTION_LABELS:Readonly<Record<FirstGestureId,string>>=Object.freeze({
  work:'Ouvrir Travail',storage:'Choisir Réserve',beds:'Choisir Couchage au sol',cultivation:'Choisir Zone de culture',
});
export const GUIDANCE_STATUS_LABELS:Readonly<Record<FirstDayGuideStatus,string>>=Object.freeze({
  ready:'Disponible',started:'À compléter',missing:'À préparer',optional:'À examiner',
});

export interface GuidanceCardCheck {
  id:FirstDayGuideId;title:string;status:FirstDayGuideStatus;detail:string;
  action:FirstDayGuideAction;actionLabel:string;
}
export interface GuidanceCardGesture {
  state:'off'|'active'|'paused'|'complete';
  learned:number;total:number;saved:boolean;
  current?:{id:FirstGestureId;position:number;title:string;instruction:string;actionLabel:string;action:FirstDayGuideAction};
}
/** A notion shown by the learning helper (Core LearningReadout row). */
export interface GuidanceCardConcept {id:string;title:string;text:string;knowledge:number}
export interface GuidanceCardModel {
  /** Learning helper notions, in activation order; empty when it is off. */
  concepts:readonly GuidanceCardConcept[];
  gesture:GuidanceCardGesture;
  /** Same order and facts as Aide → Conseils actuels; empty without a map. */
  checks:readonly GuidanceCardCheck[];
  ready:number;
}
export interface GuidanceLearningView {state:FirstGesturesLearningState;current:FirstGestureId|undefined;saved:boolean}

/** The single place deciding what the card shows: the learning helper's
 * notions first (as Core's readout), then the first gestures and the
 * first-day preparations. Later helpers (tutorial lessons) add rows here. */
export function readGuidanceCard(input:{learning?:GuidanceLearningView;sections?:readonly FirstDayGuideSection[];concepts?:readonly GuidanceCardConcept[]}):GuidanceCardModel {
  return {concepts:readGuidanceConcepts(input.concepts),gesture:readGuidanceGesture(input.learning),...readGuidanceChecks(input.sections)};
}

/** Shown notions, each a copy with its knowledge clamped to 0..1. Core
 * selects three at most on its own, but Important and Critical opportunities
 * add more; the card keeps six, the newest last. */
export const GUIDANCE_MAX_CONCEPTS=6;
export function readGuidanceConcepts(concepts:readonly GuidanceCardConcept[]|undefined):GuidanceCardConcept[] {
  return (concepts??[]).slice(-GUIDANCE_MAX_CONCEPTS).map(concept=>({id:concept.id,title:concept.title,text:concept.text,knowledge:Math.min(1,Math.max(0,concept.knowledge))}));
}

export function readGuidanceGesture(learning:GuidanceLearningView|undefined):GuidanceCardGesture {
  const learned=learning?LESSONS.filter(lesson=>learning.state.learned[lesson.id]!==undefined).length:0,total=LESSONS.length;
  if(!learning)return {state:'off',learned,total,saved:true};
  const lesson=LESSONS.find(row=>row.id===learning.current),saved=learning.saved;
  if(!lesson)return {state:'complete',learned,total,saved};
  if(!learning.state.enabled)return {state:learned?'paused':'off',learned,total,saved};
  return {state:'active',learned,total,saved,current:{id:lesson.id,position:LESSONS.indexOf(lesson)+1,title:lesson.title,instruction:lesson.instruction,
    actionLabel:GESTURE_ACTION_LABELS[lesson.id],action:{...lesson.action}}};
}

function readGuidanceChecks(sections:readonly FirstDayGuideSection[]|undefined):Pick<GuidanceCardModel,'checks'|'ready'> {
  const checks=(sections??[]).map(section=>({id:section.id,title:section.title,status:section.status,detail:`${section.detail} ${section.body}`.trim(),
    action:{...section.action},actionLabel:section.actionLabel}));
  return {checks,ready:checks.filter(check=>check.status==='ready').length};
}

/** Short label of the collapsed tab; reads browser knowledge only. */
export function guidanceTabLabel(gesture:Pick<GuidanceCardGesture,'learned'|'total'|'state'>,concepts=0):string {
  if(concepts>0)return `Conseils · ${concepts} notion${concepts>1?'s':''} à lire`;
  return gesture.state==='off'?'Conseils':`Conseils · ${gesture.learned}/${gesture.total} gestes`;
}

/** The starting pods of the colony have not opened yet. */
export const startingArrivalPending=(world:{startingArrival?:{phase:string}}|undefined):boolean=>!!world?.startingArrival&&world.startingArrival.phase!=='opened';

export interface GuidanceVisibilityContext {
  /** A local map snapshot is adopted. */
  world:boolean;
  /** The starting pods have not opened yet. */
  arrivalPending:boolean;
  /** Front menu, loading screen or a colony replacement in progress. */
  blocked:boolean;
}
export interface GuidanceCardSession {
  readonly mode:GuidanceCardMode;
  /** A new colony was created: the card opens once its pods have opened. */
  newColony():void;
  /** A colony was loaded or replaced: a collapsed tab, unless closed earlier
   * in this browser session. */
  loadedColony():void;
  /** Applies the pending opening and returns whether the card is shown. */
  sync(context:GuidanceVisibilityContext):boolean;
  collapse():void;
  expand():void;
  close():void;
  reopen():void;
  /** A learning notion became shown: like Core's readout, the card shows it
   * even if it was collapsed or closed (the helper itself is turned off in
   * the Options). Before the starting pods open, the pending opening stays. */
  attention():void;
}

/** Mode transitions of the card, like the learning readout of Core: shown on
 * every new colony; the player may collapse, close and reopen it. */
export function createGuidanceCardSession():GuidanceCardSession {
  let mode:GuidanceCardMode='closed',awaitingArrival=false,closedThisSession=false;
  return {
    get mode(){return mode;},
    newColony(){awaitingArrival=true;closedThisSession=false;mode='closed';},
    loadedColony(){awaitingArrival=false;mode=closedThisSession?'closed':'collapsed';},
    sync(context){
      if(awaitingArrival&&context.world&&!context.arrivalPending&&!context.blocked){awaitingArrival=false;mode='expanded';}
      return context.world&&!context.arrivalPending&&!context.blocked&&mode!=='closed';
    },
    collapse(){if(mode==='expanded')mode='collapsed';},
    expand(){if(mode==='collapsed')mode='expanded';},
    close(){mode='closed';awaitingArrival=false;closedThisSession=true;},
    reopen(){mode='expanded';awaitingArrival=false;closedThisSession=false;},
    attention(){if(awaitingArrival)return;mode='expanded';closedThisSession=false;},
  };
}

/** H opens the survival notebook, without a modifier. */
export function isHelpShortcut(event:{key:string;ctrlKey?:boolean;metaKey?:boolean;altKey?:boolean}):boolean {
  return !event.ctrlKey&&!event.metaKey&&!event.altKey&&(event.key==='h'||event.key==='H');
}
