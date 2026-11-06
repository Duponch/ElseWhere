import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {spikeTrapWindow297} from './spike-traps-297.ts';
import {combatTargetByKey,type LivingTarget,type LivingTargetKey} from './combat-target.ts';
import {constructionRecipe} from './construction-materials.ts';
import {healthRandom} from './health.ts';
import {releaseStructureMelee} from './melee-state.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {planSpikeTrapImpact,commitSpikeTrapImpact} from './spike-trap-impact.ts';
import {rebuildSpikeTrap} from './spike-trap-rebuild.ts';
import {captureSpikeTrapContacts,spikeTrapPhysicalCell,spikeTrapSpringChance,spikeTrapTargetKey} from './spike-trap-state.ts';
import {carrierOf} from './rescue-state.ts';
import {animalCarrier} from './animal-rest-state.ts';
import type {CommandResult,Structure,World} from './types.ts';
import { structuresOfKind } from './structure-navigation.ts';

const actors=(w:World):LivingTarget[]=>[...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]];
const present=(w:World,a:LivingTarget)=>a.state!=='dead'&&!a.health?.death&&('species'in a?!animalCarrier(w,a.id):'mechKind'in a||!carrierOf(w,a.id));
/** Spatial cleanup is pure with respect to chance/RNG, also used after paused
 * ownership commands and before a snapshot with deaths or departing actors. */
export function reconcileSpikeTrapContacts(w:World,atCore=isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):w.tick*10):void {
 if(w.schemaVersion<226)return;
 const capture=captureSpikeTrapContacts(w,atCore);
 for(const [index,s] of capture.traps){const keys=new Set((capture.actors.get(index)??[]).map(spikeTrapTargetKey));
  s.spikeTrap!.touching=s.spikeTrap!.touching.filter(key=>keys.has(key));}
}
export function applySpikeTrapSwitch(w:World,command:{structureId:number;on:boolean}):CommandResult {
 const s=w.structures.find(s=>s.id===command.structureId&&s.kind==='spike-trap');
 if(w.schemaVersion<226||!s?.spikeTrap||typeof command.on!=='boolean'||!Number.isSafeInteger(command.structureId))return {ok:false,code:'invalid-command',reason:'Piège ou réglage de reconstruction invalide.'};
 s.spikeTrap.autoRebuild=command.on;return {ok:true};
}
function structuralLoss(w:World,s:Structure,base:World['destroyed']):World['destroyed']|null {
 const count=(base?.count??0)+1,lost={...base?.lost};if(!Number.isSafeInteger(count))return null;
 for(const c of constructionRecipe(s).ingredients){const item=c.item as keyof typeof lost,value=(lost[item]??0)+c.quantity;if(!Number.isSafeInteger(value))return null;lost[item]=value;}
 return {...base,count,lost};
}
/** A single consumed Thing, with no salvage/FireLedger/XP. All fallible health
 * and loss plans are complete before RNG, target, jobs or structure are edited. */
export function trySpringSpikeTrap(w:World,s:Structure,key:LivingTargetKey,atCore:number):boolean {
 const actor=combatTargetByKey(w,key),state=s.spikeTrap;
 if(!state||s.kind!=='spike-trap'||!w.structures.includes(s)||!actor||!present(w,actor)||state.touching.includes(key))return false;
 const c=spikeTrapPhysicalCell(actor,atCore);if(c.x!==s.x||c.z!==s.z)return false;
 const chance=spikeTrapSpringChance(w,actor),stream={rng:w.rng};
 const springs=chance>=1||chance>0&&healthRandom(stream)<chance;
 if(!springs){w.rng=stream.rng;state.touching.push(key);return false;}
 if(!s.material)return false;
 const impact=planSpikeTrapImpact(w,key,s.material,atCore,stream.rng);if(!impact)return false;
 const loss=structuralLoss(w,s,impact.destroyedAfter);if(!loss)return false;
 if(!commitSpikeTrapImpact(w,impact))return false;
 w.destroyed=loss;w.structures=w.structures.filter(x=>x!==s);
 const jobs=new Set(w.jobs.filter(j=>j.repair?.structureId===s.id||j.deconstruction?.structureId===s.id||j.furniture?.structureId===s.id).map(j=>j.id));
 for(const p of w.pawns){if(p.jobId!==null&&jobs.has(p.jobId)||p.haul?.whole&&p.haul.sourcePileId===s.id)interruptWork(w,p);p.orders.queue=p.orders.queue.filter(x=>typeof x!=='number'||!jobs.has(x));}
 w.jobs=w.jobs.filter(j=>!jobs.has(j.id));releaseStructureMelee(w,s.id);
 const replacement=rebuildSpikeTrap(w,s);
 w.events.push({tick:w.tick,type:'job',message:`Piège à pointes déclenché${replacement?' · reconstruction en attente de matériaux':''}.`});if(w.events.length>80)w.events.shift();
 return true;
}

export interface SpikeTrapWindow {advance:(core:number)=>boolean;refresh:()=>void;visit:(actor:LivingTarget)=>boolean}
/** Sparse candidate queue: one initial capture, then only paid arrivals and
 * departures. A real combat mutation refreshes candidates against live edges;
 * stagger cannot make an old queued arrival trigger before its new end. */
export function spikeTrapWindow(w:World):SpikeTrapWindow|undefined {
 if(isCorePhysicalSchema297(Number(w.schemaVersion)))return spikeTrapWindow297(w);
 if(w.schemaVersion<226||!(structuresOfKind(w,'spike-trap').length>0))return;
 const start=Math.max(0,(w.tick-1)*10),end=w.tick*10;
 let current=start,queue=new Map<number,Set<LivingTargetKey>>(),traps=new Map<number,Structure>();
 const refresh=()=>{
  queue=new Map();traps=new Map(w.structures.filter(s=>s.kind==='spike-trap'&&s.spikeTrap).map(s=>[s.z*w.width+s.x,s]));
  const add=(core:number,key:LivingTargetKey)=>{if(core>end)return;const row=queue.get(core)??new Set<LivingTargetKey>();row.add(key);queue.set(core,row);};
  const tracked=new Set([...traps.values()].flatMap(s=>s.spikeTrap!.touching));
  for(const a of actors(w)){if(!present(w,a))continue;const key=spikeTrapTargetKey(a),c=spikeTrapPhysicalCell(a,current);
   if(traps.has(c.z*w.width+c.x)||tracked.has(key))add(current+1,key);
   const m=a.motion;if(m&&m.end*10>current&&m.end*10<=end&&(traps.has(m.to.z*w.width+m.to.x)||traps.has(m.from.z*w.width+m.from.x)||tracked.has(key)))add(Math.max(current+1,Math.ceil(m.end*10)),key);
  }
 };
 refresh();
 const visit=(actor:LivingTarget)=>{const c=spikeTrapPhysicalCell(actor,w.tick*10),s=traps.get(c.z*w.width+c.x);
  if(!s)return false;const changed=trySpringSpikeTrap(w,s,spikeTrapTargetKey(actor),w.tick*10);if(changed)refresh();return changed;};
 return {refresh,visit,advance:core=>{
  current=core;const row=queue.get(core);if(!row)return false;queue.delete(core);
  const entries=[...row].map(key=>({key,actor:combatTargetByKey(w,key)})).filter(e=>e.actor&&present(w,e.actor));
  const ordered=entries.map(e=>{const c=spikeTrapPhysicalCell(e.actor!,core);return {...e,trap:traps.get(c.z*w.width+c.x)};})
   .sort((a,b)=>(a.trap?.id??Number.MAX_SAFE_INTEGER)-(b.trap?.id??Number.MAX_SAFE_INTEGER)||
    (a.key.split(':')[0]!<b.key.split(':')[0]!?-1:a.key.split(':')[0]!>b.key.split(':')[0]!?1:0)||a.actor!.id-b.actor!.id);
  let changed=false;
  for(const e of ordered){const c=spikeTrapPhysicalCell(e.actor!,core);
   for(const s of traps.values())if(s.spikeTrap!.touching.includes(e.key)&&(s.x!==c.x||s.z!==c.z))s.spikeTrap!.touching=s.spikeTrap!.touching.filter(key=>key!==e.key);
   const trap=e.trap;if(trap&&w.structures.includes(trap)&&trySpringSpikeTrap(w,trap,e.key,core)){changed=true;traps.delete(trap.z*w.width+trap.x);}
   const m=e.actor!.motion;if(m&&m.end*10>core&&m.end*10<=end){const due=Math.ceil(m.end*10),next=queue.get(due)??new Set<LivingTargetKey>();next.add(e.key);queue.set(due,next);}
  }
  if(changed)refresh();return changed;
 }};
}
