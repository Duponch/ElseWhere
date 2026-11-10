import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {planNaturalHiveLoss256} from './cave-hive-loss-256.ts';
import {findActualHiveLord256} from './cave-hive-lord-search-256.ts';
import {hasTravellingCargo,interruptWork} from './interrupted-cargo.ts';
/** Narrow installed/packed natural-building damage. Cargo preflight reuses
 * existing work release; Hive/GlowPod never hold a roof or electrical net. */
import type {World,Structure} from './types.ts';
import type {StructureDamageCause,StructureDamageContext} from './thing-damage.ts';
import {planSelectedDrops,releaseWork} from './work-release.ts';
import {releaseStructureMelee} from './melee-state.ts';
import {ensureFireState} from './fire-rules.ts';
import {refreshStock} from './materials.ts';
import {planCaveHiveKill256,commitHiveKilledProducts256} from './cave-hive-leavings-256.ts';
import {notifyActualHiveRemoved256} from './cave-hive-lifecycle-256.ts';
import {receiveHiveMemo256,hiveInstigatorFaction256} from './cave-hive-lord-256.ts';
import {notifyHiveDefeated256} from './cave-hive-memories-256.ts';
import {validCaveHiveBuilding256} from './cave-hive-save-256.ts';
import type {ActualHive256} from './cave-hive-state-256.ts';
const stamp=(v:unknown)=>JSON.stringify(v);
export function notifyRemovedHiveProp256(w:World,s:Structure,core:number,collapse:boolean,defeat=true):void {
 releaseStructureMelee(w,s.id);
 for(const a of w.wildlife?.animals??[]){
  const j=a.hiveJob;if(j&&(j.kind==='maintain'?j.hiveId===s.id:j.structure&&j.targetId===s.id)){delete a.hiveJob;a.path=[];if(!['dead','downed'].includes(a.state))a.state=(a.motion?.end??0)>w.tick?'moving':'idle';a.nextDecision=w.tick;}
  if(a.strike?.structure&&a.strike.targetId===s.id)a.strike.targetId=null;
 }
 if(s.kind!=='insect-hive')return;
 if(!collapse)receiveHiveMemo256(w,'destroyed',core);
 notifyActualHiveRemoved256(w,s as ActualHive256);receiveHiveMemo256(w,'despawned',core);if(defeat)notifyHiveDefeated256(w);
}
/** No lethal hit is accepted before all real leavings/cargo/IDs fit. */
export function damageCaveHiveProp256(w:World,s:Structure,amount:number,cause:StructureDamageCause,rng:number,external?:StructureDamageContext):boolean {
 const max=s.kind==='insect-hive'?130:s.kind==='glow-pod'?50:0,pack=w.packed.find(p=>p.building===s),spawned=w.structures.includes(s);
 if(!max||!isSchema256Or257(w.schemaVersion)||!spawned&&!pack||!Number.isSafeInteger(amount)||amount<1||!validCaveHiveBuilding256(s,256,w,!!pack))return false;
 const core=external?.core??(isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10);if(!Number.isSafeInteger(core)||(isCorePhysicalSchema297(Number(w.schemaVersion))?core!==effectiveCore297(w):core<Math.max(0,(w.tick-1)*10)||core>w.tick*10))return false;
 const next=(s.damage??0)+amount;
 if(next<max){s.damage=next;if(cause!=='fire')w.rng=rng;
  if(s.kind==='insect-hive'){const lord=findActualHiveLord256(w,s)?.id;if(lord!==undefined){if(hiveInstigatorFaction256(w,external?.instigatorKey).hasFaction&&cause!=='roof'&&cause!=='roof-thick')receiveHiveMemo256(w,'attacked',core,lord);if(cause==='fire'&&max-next<max*.3)receiveHiveMemo256(w,'burned',core,lord);}}return true;
 }
 const jobs=w.jobs.filter(j=>j.repair?.structureId===s.id||j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id),ids=new Set(jobs.map(j=>j.id));
 if(w.piles.some(p=>p.owner.type==='job'&&ids.has(p.owner.jobId)))return false;
 const actors=w.pawns.filter(p=>p.jobId!==null&&ids.has(p.jobId)||p.haul?.whole&&p.haul.sourcePileId===s.id),dropView={...w,structures:w.structures.filter(b=>b!==s),packed:w.packed.filter(p=>p!==pack)},drops=planSelectedDrops(dropView,ids,new Set(actors.filter(p=>!hasTravellingCargo(dropView,p)).map(p=>p.id)));if(!drops)return false;
 const view:World={...w,structures:w.structures.filter(b=>b!==s),packed:w.packed.filter(p=>p!==pack).map(p=>({...p,owner:{...p.owner}})),piles:w.piles.map(p=>({...p,owner:{...p.owner}}))};
 for(const p of view.piles){const cell=drops.get(p.id);if(cell)assignPileOwner(p,{type:'ground',...cell});}for(const p of view.packed){const cell=drops.get(p.building.id);if(cell)assignPileOwner(p,{type:'ground',...cell});}
 const fire=cause==='fire'?w.fires??ensureFireState({...w}):undefined,owner=pack?.owner,carrierId=owner?.type==='pawn'||owner?.type==='inventory'?owner.pawnId:undefined,origin=owner?.type==='ground'?owner:carrierId!==undefined?w.pawns.find(p=>p.id===carrierId)??s:s;
 const leaving=planCaveHiveKill256(view,s,origin,fire?.rng??rng,spawned);if(!leaving)return false;
 const destroyed=planNaturalHiveLoss256(w.destroyed,s.kind as 'insect-hive'|'glow-pod');if(!destroyed||fire&&!Number.isSafeInteger(fire.ledger.structures+1))return false;
 const structures=w.structures,piles=w.piles,packed=w.packed,actualJobs=w.jobs,nextId=w.nextId,before=stamp(s),clock=w.tick,priorRng=w.rng;
 // Synchronous end-to-end preflight; a refused release never adopts the plan.
 if(w.structures!==structures||w.piles!==piles||w.packed!==packed||w.jobs!==actualJobs||w.nextId!==nextId||w.tick!==clock||w.rng!==priorRng||stamp(s)!==before)return false;
 // A destroyed wrapper is gone before the carry tracker is interrupted. Other
 // cargo on an unfinished edge stays attached until its real edge ends.
 w.packed=w.packed.filter(p=>p!==pack);
 for(const p of actors)if(hasTravellingCargo(w,p))interruptWork(w,p,true);else if(!releaseWork(w,p,drops))throw Error('Preflighted natural-building cargo changed');
 w.jobs=w.jobs.filter(j=>!ids.has(j.id));for(const p of w.pawns)p.orders.queue=p.orders.queue.filter(o=>typeof o!=='number'||!ids.has(o));
 w.structures=w.structures.filter(b=>b!==s);w.packed=w.packed.filter(p=>p!==pack);
 if(leaving.rubble){w.filth=leaving.rubble.filth;w.nextId=leaving.rubble.nextId;}commitHiveKilledProducts256(w,leaving.hiveProducts);
 w.destroyed=destroyed;if(fire){w.fires=fire;fire.rng=leaving.rng;fire.ledger.structures++;}else w.rng=leaving.rng;
 notifyRemovedHiveProp256(w,s,core,cause==='roof'||cause==='roof-thick');refreshStock(w);return true;
}
