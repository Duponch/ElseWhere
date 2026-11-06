import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {combatTargetByKey,type LivingTarget,type LivingTargetKey} from './combat-target.ts';
import {spikeTrapPhysicalCell,spikeTrapTargetKey} from './spike-trap-state.ts';
import {carrierOf} from './rescue-state.ts';
import {animalCarrier} from './animal-rest-state.ts';
import type {Structure,World} from './types.ts';
import {trySpringSpikeTrap,type SpikeTrapWindow} from './spike-traps.ts';
import {effectiveCore297} from './core-phase-297.ts';
import { structuresOfKind } from './structure-navigation.ts';

const actors=(w:World):LivingTarget[]=>[...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]];
const present=(w:World,a:LivingTarget)=>a.state!=='dead'&&!a.health?.death&&('species'in a?!animalCarrier(w,a.id):'mechKind'in a||!carrierOf(w,a.id));

/** Created at a known last played Core; all future endpoints remain queued until
 * an actual movement/impact invalidates them. No repeated spring chance. */
export function spikeTrapWindow297(w:World,lastPlayedCore=effectiveCore297(w)-1):SpikeTrapWindow|undefined {
 if(!isCorePhysicalSchema297(Number(w.schemaVersion)))throw new RangeError('Core297 trap owner requires schema297');
 if(!Number.isSafeInteger(lastPlayedCore)||lastPlayedCore<0||lastPlayedCore>effectiveCore297(w))throw new RangeError('Invalid trap owner origin');
 if(!(structuresOfKind(w,'spike-trap').length>0))return;
 const start=lastPlayedCore;
 let current=start,queue=new Map<number,Set<LivingTargetKey>>(),traps=new Map<number,Structure>();
 const refresh=()=>{
  queue=new Map();traps=new Map(w.structures.filter(s=>s.kind==='spike-trap'&&s.spikeTrap).map(s=>[s.z*w.width+s.x,s]));
  const add=(core:number,key:LivingTargetKey)=>{if(!Number.isSafeInteger(core)||core<=current)return;const row=queue.get(core)??new Set<LivingTargetKey>();row.add(key);queue.set(core,row);};
  const tracked=new Set([...traps.values()].flatMap(s=>s.spikeTrap!.touching));
  for(const a of actors(w)){if(!present(w,a))continue;const key=spikeTrapTargetKey(a),c=spikeTrapPhysicalCell(a,current);
   if(traps.has(c.z*w.width+c.x)||tracked.has(key))add(current+1,key);
   const m=a.motion;if(m&&m.end*10>current&&(traps.has(m.to.z*w.width+m.to.x)||traps.has(m.from.z*w.width+m.from.x)||tracked.has(key)))add(Math.max(current+1,Math.ceil(m.end*10)),key);
  }
 };
 refresh();
 const visit=(actor:LivingTarget)=>{const c=spikeTrapPhysicalCell(actor,effectiveCore297(w)),s=traps.get(c.z*w.width+c.x);
  if(!s)return false;const changed=trySpringSpikeTrap(w,s,spikeTrapTargetKey(actor),effectiveCore297(w));if(changed)refresh();return changed;};
 return {refresh,visit,advance:core=>{
  if(!Number.isSafeInteger(core)||core!==current+1||core!==effectiveCore297(w))throw new RangeError('Invalid next trap Core');
  current=core;const row=queue.get(core);if(!row)return false;queue.delete(core);
  const entries=[...row].map(key=>({key,actor:combatTargetByKey(w,key)})).filter(e=>e.actor&&present(w,e.actor));
  const ordered=entries.map(e=>{const c=spikeTrapPhysicalCell(e.actor!,core);return {...e,trap:traps.get(c.z*w.width+c.x)};})
   .sort((a,b)=>(a.trap?.id??Number.MAX_SAFE_INTEGER)-(b.trap?.id??Number.MAX_SAFE_INTEGER)||
    (a.key.split(':')[0]!<b.key.split(':')[0]!?-1:a.key.split(':')[0]!>b.key.split(':')[0]!?1:0)||a.actor!.id-b.actor!.id);
  let changed=false;
  for(const e of ordered){const c=spikeTrapPhysicalCell(e.actor!,core);
   for(const s of traps.values())if(s.spikeTrap!.touching.includes(e.key)&&(s.x!==c.x||s.z!==c.z)){s.spikeTrap!.touching=s.spikeTrap!.touching.filter(key=>key!==e.key);changed=true;}
   const trap=e.trap;if(trap&&w.structures.includes(trap)){const touching=trap.spikeTrap!.touching.includes(e.key),rng=w.rng;
    if(trySpringSpikeTrap(w,trap,e.key,core)){changed=true;traps.delete(trap.z*w.width+trap.x);}
    else if(touching!==trap.spikeTrap!.touching.includes(e.key)||rng!==w.rng)changed=true;}
   const m=e.actor!.motion;if(m&&m.end*10>core){const due=Math.ceil(m.end*10),next=queue.get(due)??new Set<LivingTargetKey>();next.add(e.key);queue.set(due,next);}
  }
  if(changed)refresh();return changed;
 }};
}
