import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {paidConsoleCell298} from './console-service-298.ts';
import {reconcileFactionComms298} from './faction-comms-298.ts';
import {factionCommsTask298,type FactionCommsTask298} from './faction-comms-state-298.ts';
import type {Pawn,World} from './types.ts';

interface ActiveConsoleContact298 {pawn:Pawn;task:FactionCommsTask298;slot:number;roster:Pawn[];seen:number;due:number;needsValidation:boolean}
export interface ConsoleContactCoreResult298 {
 readonly actorsChanged:readonly number[];
 readonly requiresFull:boolean;
 /** Each invalid membership is isolated; other contacts still advance. */
 readonly rosterSyncIds:readonly number[];
}
const NO_CONTACT_CHANGE298:ConsoleContactCoreResult298=Object.freeze({actorsChanged:Object.freeze([]),requiresFull:false,rosterSyncIds:Object.freeze([])});
const safe=(v:number)=>Number.isSafeInteger(v)&&v>=0;
/** One owner per actual local World. No Native authority, timer, route or
 * macro-work producer. Registered after load and actual command/macro changes. */
export function createConsoleContactCore298(world:World){
 if(!isSchema298OrLater(Number(world.schemaVersion)))throw Error('Console Core owner requires prospective298');
 const active=new Map<number,ActiveConsoleContact298>();
 let lastCore=effectiveCore297(world),nextDue=Infinity,syncSerial=0,syncing=false;
 const live=(core:number)=>{if(!safe(core)||effectiveCore297(world)!==core)throw Error('Console contact needs its actual committed Core');};
 const current=(e:ActiveConsoleContact298)=>world.pawns===e.roster&&e.roster[e.slot]===e.pawn&&factionCommsTask298(e.pawn)===e.task&&e.task.phase==='approach';
 function deadline(pawn:Pawn,core:number,minimum:number):number{
  const end=(pawn.motion?.end??0)*10,stun=pawn.stun?.untilCore??0;
  const due=Math.max(minimum,Math.ceil(Math.max(core,end,stun)));
  if(!safe(due))throw Error('Invalid actual console contact deadline');
  return due;
 }
 function minimum():void{nextDue=Infinity;for(const e of active.values())nextDue=Math.min(nextDue,e.due);}
 function observe(pawn:Pawn,slot:number,core:number):void{
  if(!Number.isSafeInteger(slot)||slot<0||world.pawns[slot]!==pawn)throw Error('Console roster observation has no actual owner');
  const task=factionCommsTask298(pawn),prior=active.get(pawn.id);
  if(!task||task.phase!=='approach'){active.delete(pawn.id);return;}
  if(prior&&prior.pawn!==pawn)throw Error('Duplicate active console identity');
  active.set(pawn.id,{pawn,task,slot,roster:world.pawns,seen:syncSerial,due:core+1,needsValidation:true});
 }
 function beginRosterSync(core:number):void{
  live(core);if(core!==lastCore||syncing)throw Error('Console roster sync must follow the played Core or an actual command');
  syncing=true;syncSerial++;
 }
 function observeRosterPawn(pawn:Pawn,slot:number):void{
  if(!syncing)throw Error('Console roster observation outside its macro transaction');
  observe(pawn,slot,lastCore);
 }
 function finishRosterSync():void{
  if(!syncing)throw Error('No console roster transaction');
  for(const [id,e] of active)if(e.seen!==syncSerial)active.delete(id);
  syncing=false;minimum();
 }
 /** Initial load capture only. Future macros reuse an existing Pawn walk. */
 beginRosterSync(lastCore);
 for(let slot=0;slot<world.pawns.length;slot++)observeRosterPawn(world.pawns[slot]!,slot);
 finishRosterSync();
 return {
  beginRosterSync,observeRosterPawn,finishRosterSync,
  /** Caller already knows this original actor/slot from its command. */
  observeCommandPawn(pawn:Pawn,slot:number,core:number):void{
   live(core);if(core!==lastCore||syncing)throw Error('Console command observation is outside the safe point');
   observe(pawn,slot,core);minimum();
  },
  forgetActor(id:number):void{active.delete(id);minimum();},
  /** Only causal service mutations: never ordinary movement, filth or calm Full. */
  invalidateActive(core:number,_reason:'command'|'macro'|'impact'|'ownership'|'console'):void{
   live(core);if(syncing||core!==lastCore&&core!==lastCore+1)throw Error('Console invalidation outside its safe point');
   const due=core===lastCore?core+1:core;
   for(const e of active.values()){e.needsValidation=true;e.due=Math.min(e.due,due);}
   minimum();
  },
  /** Feed the existing movement/physics/timer result IDs before advance.
   * No population lookup and no new capture is hidden in this notification. */
  notifyActorsChanged(core:number,ids:readonly number[]):void{
   live(core);if(core!==lastCore+1||syncing)throw Error('Console actor notification is outside its physical step');
   if(!active.size)return;
   let changed=false;
   for(const id of ids){const e=active.get(id);if(!e)continue;
    // A mismatched slot is retained until advance can report its own failure.
    if(!current(e))e.due=core;
    else e.due=e.needsValidation?core:deadline(e.pawn,core,core);
    changed=true;
   }
   if(changed)minimum();
  },
  /** Called after movement, impact and expiry on the same real Core. */
  advance(core:number):ConsoleContactCoreResult298{
   live(core);if(core!==lastCore+1||syncing)throw Error('Console contact must advance exactly one physical Core');
   lastCore=core;
   if(!active.size||core<nextDue)return NO_CONTACT_CHANGE298;
   const changed:number[]=[],rosterSync:number[]=[];let full=false;
   for(const [id,e] of active){
    if(e.due>core)continue;
    if(!current(e)){
     active.delete(id);full=true;rosterSync.push(id);continue;
    }
    const pawn=e.pawn;let validated=false;
    if(e.needsValidation){
     e.needsValidation=false;validated=true;
     if(!reconcileFactionComms298(world,pawn)){
      active.delete(id);changed.push(id);full=true;continue;
     }
    }
    if(!paidConsoleCell298(world,pawn,e.task)){e.due=deadline(pawn,core,core+1);continue;}
    // Real arrival transaction. Existing complete guards are evaluated once
    // here, not for every actor on every physical Core.
    if(!validated&&!reconcileFactionComms298(world,pawn)){
     active.delete(id);changed.push(id);full=true;continue;
    }
    if(!current(e)||!paidConsoleCell298(world,pawn,e.task)){
     active.delete(id);rosterSync.push(id);full=true;continue;
    }
    e.task.phase='ready';pawn.path=[];pawn.state='idle';
    active.delete(id);changed.push(id);full=true;
   }
   minimum();
   return {actorsChanged:changed,requiresFull:full,rosterSyncIds:rosterSync};
  },
  dispose():void{active.clear();nextDue=Infinity;syncing=false;},
 };
}