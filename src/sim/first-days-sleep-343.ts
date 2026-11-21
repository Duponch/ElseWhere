import {isGroundSleepingSpotKind} from './bed-kinds.ts';
import {temperatureAt} from './temperature.ts';
import {sharedLightEnvironmentCache} from './light-environment.ts';
import {HUMAN_COMFY_MAX_343,HUMAN_COMFY_MIN_343,type SleepMemoryKind343} from './first-days-memories-343.ts';
import type {Pawn,Structure,World} from './types.ts';

/* Schema 343, Toils_LayDown.ApplyBedThoughts: the sleep memories given at
 * the bedroom observation (room-experience). */
/** Room.PsychologicallyOutdoors (same rule as work-environment): at least
 * 300 open-roof cells, or touching the map edge with half its cells open. A
 * door or wall cell is its own closed room. Read once per bed observation. */
function psychologicallyOutdoors(w:World,p:Pawn):boolean {
 const {topology,roofs}=sharedLightEnvironmentCache(w).read(w),space=topology.at(p.x,p.z);
 if(space?.kind!=='space')return false;
 let covered=0;for(const index of roofs){const r=topology.at(index%w.width,Math.floor(index/w.width));if(r?.kind==='space'&&r.id===space.id)covered++;}
 const open=space.cellCount-covered;
 return open>=300||space.touchesMapEdge&&open>=space.cellCount*.5;
}
/** Toils_LayDown.ApplyBedThoughts, in its order: cold, heat, outdoors, ground.
 * `bed` is the bed being used; a sleeping spot costs nothing, hence ground. */
export function sleepMemoryKinds343(w:World,p:Pawn,bed:Structure|undefined):SleepMemoryKind343[] {
 const kinds:SleepMemoryKind343[]=[],temperature=temperatureAt(w,{x:p.x,z:p.z});
 if(temperature<HUMAN_COMFY_MIN_343)kinds.push('slept-in-cold');
 if(temperature>HUMAN_COMFY_MAX_343)kinds.push('slept-in-heat');
 if(psychologicallyOutdoors(w,p))kinds.push('slept-outside');
 if(!bed||isGroundSleepingSpotKind(bed.kind))kinds.push('slept-on-ground');
 return kinds;
}

