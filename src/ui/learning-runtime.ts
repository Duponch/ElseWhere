import type {Command,World} from '../sim/types';
import {LEARNING_CONCEPTS} from './learning-concepts';
import {createLearningHelper,LEARNING_HELPER_STORAGE_KEY,type LearningConcept,type LearningHelper} from './learning-helper';
import {digestLearningWorld,learningFromCommand,learningFromObservation,learningOpportunities,type CommandLearning,type LearningObservation,type LearningWorldDigest} from './learning-triggers';
import {FIRST_GESTURES_STORAGE_KEY} from './first-gestures-learning';

/** Real time between two helper checks; Core checks every 15 frames. */
export const LEARNING_TICK_MS=250;
const DOLLY_KEYS=new Set(['arrowleft','arrowright','arrowup','arrowdown','q','a','d','z','w','s']);

export interface LearningRuntimeOptions {
  read:(key:string)=>string|null;
  write:(key:string,value:string)=>void|boolean;
  /** Confirmed local map snapshot, if any. */
  world:()=>World|undefined;
  /** Changes when the colony or its shown map is replaced. */
  epoch:()=>number;
  /** A map is shown and playable: no front menu, loading or starting pods. */
  playing:()=>boolean;
  /** The starting pods of a new colony have not opened yet. */
  arrivalPending:()=>boolean;
  menuOpen:()=>boolean;
  /** Interface state read on the timer (hovered control, page, panel, Alt). */
  observe:()=>Omit<LearningObservation,'cameraDolly'>;
  now:()=>number;
  /** A notion became shown (the card opens, like Core's readout). */
  activated?:()=>void;
  /** Shown notions, enabled state or knowledge changed. */
  changed?:()=>void;
  /** One-time message of a modal notion; `then` continues the gesture. */
  showModal?:(concept:LearningConcept,then?:()=>void)=>void;
  concepts?:readonly LearningConcept[];
}
export type LearningRuntime=ReturnType<typeof createLearningRuntime>;

/** The helper wired to MAIN: one timer reads the adopted snapshot only when it
 * changed, the interface state, and advances Core's rules in real time. */
export function createLearningRuntime(options:LearningRuntimeOptions){
  let shown:readonly string[]=[];
  const helper:LearningHelper=createLearningHelper({concepts:options.concepts??LEARNING_CONCEPTS,
    read:()=>options.read(LEARNING_HELPER_STORAGE_KEY),write:value=>options.write(LEARNING_HELPER_STORAGE_KEY,value),
    readGestures:()=>options.read(FIRST_GESTURES_STORAGE_KEY),
    changed:()=>{
      const now=helper.active,fresh=now.some(id=>!shown.includes(id));shown=now;
      try{if(fresh)options.activated?.();options.changed?.();}catch{/* presentation only */}
    }});
  shown=helper.active;
  let digest:LearningWorldDigest|undefined,digestWorld:World|undefined,epoch=options.epoch(),last:number|undefined;
  // The pods of a new colony open: Core's 8 s after the game-start dialog.
  let observation:LearningObservation|undefined,pending=false;
  const keys=new Set<string>();let dragged=false;
  const apply=(learning:CommandLearning,then?:()=>void):void=>{
    for(const step of learning.demonstrations)helper.demonstrate(step.concept,step.amount,step.frames);
    for(const chance of learning.opportunities)helper.teachOpportunity(chance.concept,chance.type);
    if(learning.modal)modal(learning.modal,then);else then?.();
  };
  const modal=(id:string,then?:()=>void):void=>{
    const concept=helper.modalIfNotKnown(id);
    if(concept&&options.showModal)options.showModal(concept,then);else then?.();
  };
  const open=(id:string)=>helper.enabled&&!helper.isComplete(id);
  return {
    helper,
    /** One timer step: snapshot differences, interface demonstrations, rules. */
    tick():void {
      const now=options.now(),seconds=last===undefined?0:Math.min(1,Math.max(0,(now-last)/1000));last=now;
      const currentEpoch=options.epoch();
      if(currentEpoch!==epoch){epoch=currentEpoch;digest=undefined;digestWorld=undefined;}
      const playing=options.playing(),arrival=options.arrivalPending();
      if(pending&&!arrival&&playing)helper.startDialogClosed();
      pending=arrival;
      const world=options.world();
      if(playing&&world&&world!==digestWorld){
        const next=digestLearningWorld(world,open);
        for(const chance of learningOpportunities(digest,next,world))helper.teachOpportunity(chance.concept,chance.type);
        digest=next;digestWorld=world;
      }
      const current:LearningObservation={...options.observe(),cameraDolly:keys.size>0||dragged};dragged=false;
      if(playing)apply(learningFromObservation(current,observation,seconds));
      observation=current;
      helper.update(seconds,{playing,menuOpen:options.menuOpen()});
    },
    /** An accepted player command; `world` is the snapshot it was given on. */
    command(command:Command,result:unknown,world?:World,then?:()=>void):void {apply(learningFromCommand(command,result,world),then);},
    /** Core TimeControls: the pause button or key (Space toggles), a speed. */
    speed(speed:number,toggle=false):void {helper.demonstrate(toggle||speed===0?'pause':'time-controls','specific');},
    /** A one-time modal notion (already known: `then` runs at once). */
    modal,
    /** Core TradeShip.TryOpenComms: the orbital trade opens (`then`), with
     * BuildOrbitalTradeBeacon Critical and its one-time beacon message. */
    orbitalTrade(then:()=>void):void {helper.teachOpportunity('orbital-beacon','critical');modal('orbital-trade-beacon',then);},
    /** Core CameraDriver: zoom notches are tiny interactions. */
    zoomed():void {helper.demonstrate('camera-zoom','tiny');},
    /** The middle button moved the camera since the last step. */
    dragged():void {dragged=true;},
    /** Camera keys held, with the renderer's own filter applied by the caller. */
    key(key:string,down:boolean):void {const name=key.toLowerCase();if(!DOLLY_KEYS.has(name))return;if(down)keys.add(name);else keys.delete(name);},
    releaseKeys():void {keys.clear();},
    levelLoaded():void {helper.levelLoaded();},
    flush():void {helper.flush();},
  };
}

/** Browser listeners of the camera gestures; returns their removal. */
export function installLearningCameraInput(runtime:LearningRuntime,viewport:HTMLElement,canMove:()=>boolean):()=>void {
  const abort=new AbortController(),signal=abort.signal;let middle=false;
  window.addEventListener('keydown',event=>{
    if(event.ctrlKey||event.metaKey||event.altKey||!canMove())return;
    if(event.target instanceof HTMLElement&&(event.target.matches('input, textarea, select')||event.target.isContentEditable))return;
    runtime.key(event.key,true);
  },{signal});
  window.addEventListener('keyup',event=>runtime.key(event.key,false),{signal});
  window.addEventListener('blur',()=>{runtime.releaseKeys();middle=false;},{signal});
  viewport.addEventListener('pointerdown',event=>{if(event.button===1&&canMove())middle=true;},{signal,capture:true});
  window.addEventListener('pointerup',event=>{if(event.button===1)middle=false;},{signal});
  viewport.addEventListener('pointermove',event=>{if(middle&&(event.buttons&4)&&canMove())runtime.dragged();},{signal,passive:true});
  viewport.addEventListener('wheel',()=>{if(canMove())runtime.zoomed();},{signal,passive:true,capture:true});
  return ()=>abort.abort();
}
