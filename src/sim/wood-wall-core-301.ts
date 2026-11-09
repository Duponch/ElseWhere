import {isFinishFrameSchema301} from './wall-frame-kind-301.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {dueThingIntervalDelta301} from './thing-interval-301.ts';
import {constructionObstructions,constructionSiteFree} from './construction-rules.ts';
import {constructionSupplied} from './construction-materials.ts';
import {planConstructionPlantRetirement,commitConstructionPlantRetirement} from './plant-retirement.ts';
import {medicalWorkRefusal} from './health-rules.ts';
import {isColonist} from './affiliation.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {isStunned} from './stun.ts';
import {finishArrivalFacing256} from './arrival-rotation-256.ts';
import {isWoodWallFrame301} from './wall-frame-failure-301.ts';
import {contactWoodWallWork301,workWoodWallInterval301} from './wood-wall-work-301.ts';
import type {Job,Pawn,World} from './types.ts';

export type FrameToil301=
 |{kind:'work';jobId:number;ticksLeft:number}
 |{kind:'retired';jobId:number;atCore:number};
type Human301=Pawn&{jobTickDelta301?:number;frameToil301?:FrameToil301;postureUntilCore301?:number};
export interface WoodWallCorePorts301{
 /** Actual live view, not an implicit nominal/macro delta. */
 rate(p:Pawn):number;
 light(p:Pawn):number;
 /** Existing real final-building transaction; must return true only if retired. */
 complete(p:Pawn,j:Job):boolean;
 /** Existing real release; never refunds a destroyed Frame. */
 release(p:Pawn):boolean;
 event(message:string):void;
}
// Wall is an edifice with holdsRoof: native Touch admits all eight neighbours
// without a diagonal side-cell veto. Interior completion remains separate.
const at=(p:Pawn,j:Job,core:number):boolean=>Math.max(Math.abs(p.x-j.x),Math.abs(p.z-j.z))===1
 &&p.path.length===0&&p.moveCooldown===0&&(p.motion?.end??0)<=core/10;
/** One true physical owner. Job-clock counters advance even between jobs;
 * expensive geometry/material captures are invalidated only at actual Engine
 * macro/command/impact/structural boundaries, not frozen as World validity. */
export function createWoodWallCore301(w:World,ports:WoodWallCorePorts301){
 let dirty=true,last=effectiveCore297(w),jobs=w.jobs,jobCount=-1,piles=w.piles,pileCount=-1;
 let byId=new Map<number,Job>(),obstacles:ReturnType<typeof constructionObstructions>|undefined;
 let supplied=new Map<number,boolean>();
 const capture=()=>{
  if(!dirty&&jobs===w.jobs&&jobCount===jobs.length&&piles===w.piles&&pileCount===piles.length)return;
  dirty=false;jobs=w.jobs;jobCount=jobs.length;piles=w.piles;pileCount=piles.length;
  byId=new Map(jobs.map(j=>[j.id,j]));
  const active=jobs.filter(j=>isWoodWallFrame301(j)&&j.status==='active'&&j.reservedBy!==null);
  // No resource/pile/packed census for maps without an active FinishFrame.
  // The shared helper's default retains the historical complete-job scan.
  obstacles=active.length?constructionObstructions(w,active):undefined;supplied=new Map();
  for(const j of active)supplied.set(j.id,constructionSupplied(w,j));
 };
 const wake=(p:Human301,success:boolean)=>{
  delete p.frameToil301;
  if(!ports.release(p))throw Error('Actual Frame job release refused');
  p.planCooldown=0;p.needCooldown=0;
  // EndCurrentJob adds this expiry1 only after Succeeded, never after failure
  // of the original target at the following fixed step.
  if(success)p.postureUntilCore301=effectiveCore297(w)+1;
 };
 const continuation=(p:Pawn,j:Job)=>p.jobId===j.id&&j.reservedBy===p.id&&j.status==='active'
  &&isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&!backgroundWorkRefusal(p,'build')
  &&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!p.collapsePending&&!p.draft&&!p.mental?.crisis
  &&!p.need&&!p.haul&&!p.cooking&&!p.recreation.task&&!p.idleWander300&&!medicalWorkRefusal(p);
 const eligible=(p:Pawn,j:Job,core:number)=>continuation(p,j)&&at(p,j,core);
 const begin=(p:Human301,j:Job,core:number)=>{
  if(p.frameToil301||p.postureUntilCore301!==undefined||!isWoodWallFrame301(j)||!eligible(p,j,core)||isStunned(p,core))return false;
  // Contact is an infrequent actual admission, so read these owners live.
  if(!constructionSupplied(w,j)||!constructionSiteFree(w,j,p.id))return false;
  const retirement=planConstructionPlantRetirement(w,j,j.id,'frame');
  if(!retirement||!commitConstructionPlantRetirement(w,retirement))return false;
  contactWoodWallWork301(w,p,j);
  p.frameToil301={kind:'work',jobId:j.id,ticksLeft:5000};p.state='working';p.path=[];finishArrivalFacing256(p,j);
  dirty=true;return true;
 };
 return {
  invalidate(){dirty=true;},
  owns(pawn:Pawn):boolean{
   const p=pawn as Human301;
   if(p.frameToil301||p.postureUntilCore301!==undefined)return true;
   if(p.jobId===null)return false;capture();
   const j=byId.get(p.jobId);return !!j&&isWoodWallFrame301(j);
  },
  currentFrame(pawn:Pawn):Job|undefined{
   capture();const j=pawn.jobId===null?undefined:byId.get(pawn.jobId);
   return j&&isWoodWallFrame301(j)?j:undefined;
  },
  /** Called by the existing macro AFTER this Core's fixed pass. No extra
   * fixed decrement, interval action, XP, work or RNG is performed here. */
  admitAtContact(pawn:Pawn):boolean{
   if(!isFinishFrameSchema301(Number(w.schemaVersion)))return false;
   capture();const p=pawn as Human301,j=p.jobId===null?undefined:byId.get(p.jobId);
   return !!j&&begin(p,j,effectiveCore297(w));
  },
  advance(core:number):{actorsChanged:number[];requiresFull:boolean}{
   if(!isFinishFrameSchema301(Number(w.schemaVersion)))return {actorsChanged:[],requiresFull:false};
   if(core!==effectiveCore297(w)||core!==last+1)throw Error('Frame301 requires one actual consecutive Core');
   last=core;capture();const changed:number[]=[];let full=false;
   for(const raw of w.pawns){const p=raw as Human301;if(p.state==='dead')continue;
    const previous=p.jobTickDelta301??0;
    const due=dueThingIntervalDelta301(previous,core,p.id,ports.rate(p));
    // Native DoTick's fixed work precedes dispatch of this interval. The
    // scalar due calculation itself has no Job side effect.
    let owner=p.frameToil301;
    if(owner?.kind==='retired'){
     if(core>owner.atCore){wake(p,false);changed.push(p.id);full=true;}
    }else{
     let j=p.jobId===null?undefined:byId.get(p.jobId);
     // The moving visit owns its reservation before the work toil exists.
     // A real refusal must end that visit; missing contact alone keeps Goto.
     if(!owner&&j&&isWoodWallFrame301(j)&&(!continuation(p,j)||!supplied.get(j.id)
      ||!constructionSiteFree(w,j,p.id,obstacles?.get(j.id)))){
      wake(p,false);j=undefined;changed.push(p.id);full=true;
     }
     if(!owner&&j&&begin(p,j,core)){owner=p.frameToil301;capture();changed.push(p.id);}
     if(owner?.kind==='work'){
      j=byId.get(owner.jobId);
      if(!j||!isWoodWallFrame301(j)||!eligible(p,j,core)||!supplied.get(j.id)
       ||!constructionSiteFree(w,j,p.id,obstacles?.get(j.id))){
       wake(p,false);changed.push(p.id);full=true;
      }else{
       owner.ticksLeft=(owner.ticksLeft-1)|0;
       if(owner.ticksLeft<=0){
        // Ready after the LAST toil cannot pass a busy stance. Timer does
        // not freeze, but DriverTickInterval no longer executes its action.
        if(!isStunned(p,core)){wake(p,true);changed.push(p.id);full=true;}
       }else if(due){
        if(!Number.isSafeInteger(w.nextId+6))throw RangeError('Frame301 identity budget exhausted');
        const result=workWoodWallInterval301(w,p,j,due,ports.light(p));
        if(result.kind==='complete'){
         if(!ports.complete(p,j)||w.jobs.includes(j))throw Error('Frame completion refused after actual work preflight');
         dirty=true;
         if(isStunned(p,core)){
          // Completed target is gone; preserve only the original driver
          // reference until its next fixed FailOnDespawned, not a new owner.
          if(!ports.release(p))throw Error('Retired Frame job release refused');
          p.planCooldown=0;p.needCooldown=0;p.frameToil301={kind:'retired',jobId:j.id,atCore:core};delete p.postureUntilCore301;p.state='working';
         }else wake(p,true);
         changed.push(p.id);full=true;
        }else if(result.kind==='failed'){
         dirty=true;ports.event(p.name+' a échoué à construire le mur ; une partie des matériaux a été récupérée.');
         if(isStunned(p,core)){
          if(!ports.release(p))throw Error('Retired Frame job release refused');
          p.planCooldown=0;p.needCooldown=0;p.frameToil301={kind:'retired',jobId:j.id,atCore:core};delete p.postureUntilCore301;p.state='working';
         }else wake(p,true);
         changed.push(p.id);full=true;
        }
        if(dirty)capture();
       }
      }
     }
    }
    p.jobTickDelta301=due?0:previous+1;
    if(due&&p.postureUntilCore301!==undefined&&core>=p.postureUntilCore301){
     delete p.postureUntilCore301;p.planCooldown=0;p.needCooldown=0;changed.push(p.id);full=true;
    }
   }
   return {actorsChanged:[...new Set(changed)],requiresFull:full};
  },
 };
}
