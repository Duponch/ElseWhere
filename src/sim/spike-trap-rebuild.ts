import {canPlaceSpikeTrap} from './spike-trap-placement.ts';
import {iedsUnlocked357,isIedTrapKind357} from './ied-traps-357.ts';
import type {Job,Structure,World} from './types.ts';
/** A spent trap is never refilled. Its replacement is an ordinary empty plan
 * which waits for another full material delivery and real construction. */
export function rebuildSpikeTrap(world:World,source:Structure):Job|undefined {
 // Core CheckAutoRebuild requires CanSetAutoRearm: the IED research is finished.
 const kind=source.kind,ied=isIedTrapKind357(kind);
 if(world.schemaVersion<226||kind!=='spike-trap'&&!(ied&&iedsUnlocked357(world))||!source.spikeTrap?.autoRebuild||!source.material
  ||world.structures.includes(source)||world.jobs.length>=world.width*world.height*3||!Number.isSafeInteger(world.nextId+1))return;
 const command={type:'designate' as const,kind:ied?kind:'spike-trap' as const,x:source.x,z:source.z,orientation:0 as const,material:source.material};
 if(!canPlaceSpikeTrap(world,command).ok)return;
 const job:Job={id:world.nextId++,kind:command.kind,x:source.x,z:source.z,orientation:0,footprint:'standard',material:source.material,
  construction:'blueprint',progress:0,status:'pending',reservedBy:null,escrow:{wood:0,food:0}};
 world.jobs.push(job);for(const p of world.pawns)p.planCooldown=0;
 return job;
}
