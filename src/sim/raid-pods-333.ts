import {civilianAdmissionFits} from './civilian-away.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {canStandAt} from './furniture-travel.ts';
import {groundPile,nearbyGround} from './ground-placement.ts';
import {RAID_MAKERS_331} from './raid-factions-331.ts';
import {RAID_POD_ROOF_CORE_333} from './raid-arrival-333.ts';
import {makeRaider,raidRoleWeapon} from './raid-spawn.ts';
import {hitSkyfallerRoof256} from './roofing.ts';
import type {RaidGroup} from './raid-state.ts';
import type {Cell,MaterialPile,World} from './types.ts';

/* Schema 333 drop pods of a Cassandra home raid. Core DropPodIncoming hits the
 * roof 15 ticks before its impact (a thin roof is punched, with the existing
 * roof collapse of the starting pods); the ActiveDropPod opens once its age
 * exceeds the delay, places its raider at the pod cell (or the nearest free
 * one) and leaves a steel slag chunk (leaveSlag). One local tick is ten Core
 * ticks: each pod is handled at the first local tick at or after its Core tick. */
export function advanceRaidPods333(w:World,group:RaidGroup):void {
  const pods=group.arrival333?.pods;if(!pods||w.schemaVersion<333)return;
  for(let i=0;i<pods.length;i++){
    const pod=pods[i]!;if(pod.openedAtCore!==undefined)continue;
    const core=effectiveCore297(w);
    if(!pod.roofHit){
      if(core<pod.landAtCore-RAID_POD_ROOF_CORE_333)continue;
      // A refused roof impact keeps the pod in the air until the next tick.
      if(!hitSkyfallerRoof256(w,pod.cell,core))continue;
      pod.roofHit=true;
    }
    if(core>=pod.openAtCore)openRaidPod333(w,group,i,core);
  }
}
const actorCells=(w:World):Set<number>=>{
  const cells=new Set<number>();
  for(const a of [...w.pawns,...w.wildlife?.animals??[],...w.mechanoids??[]]){cells.add(a.z*w.width+a.x);if(a.motion&&a.motion.end>w.tick)cells.add(a.motion.from.z*w.width+a.motion.from.x);}
  return cells;
};
/** The raider is born at the opening, with the identity reserved at the
 * arrival. A pod with no free cell around it stays closed until there is one. */
function openRaidPod333(w:World,group:RaidGroup,index:number,core:number):boolean {
  const arrival=group.arrival333!,pod=arrival.pods![index]!;
  if(!w.foodPolicies[0]||!civilianAdmissionFits(w,1,3)||!Number.isSafeInteger(w.nextId+3))return false;
  const busy=actorCells(w),free=(c:Cell)=>!busy.has(c.z*w.width+c.x)&&canStandAt(w,c);
  const cell=free(pod.cell)?pod.cell:nearbyGround(w,pod.cell).find(free);if(!cell)return false;
  const role=group.composition?.roster[index],maker=group.composition?.group331;
  const made=makeRaider(w,{groupId:group.id,index,pawnId:pod.pawnId,nextId:w.nextId,cell:{x:cell.x,z:cell.z},factionId:arrival.factionId,
    tribe:!!maker&&RAID_MAKERS_331[maker].family==='tribe',weapon:role?raidRoleWeapon(role,{world:w,pawnId:pod.pawnId}):group.id>1&&index===0?'revolver':undefined,exiting:group.phase==='withdraw',...role?{kind:role}:{}});
  if(!made)return false;
  w.pawns.push(made.pawn);w.piles.push(...made.piles);w.nextId=made.nextId;pod.openedAtCore=core;
  busy.add(cell.z*w.width+cell.x);
  const slag=nearbyGround(w,pod.cell).find(c=>free(c)&&!groundPile(w,c));
  if(slag){const pile:MaterialPile={id:w.nextId++,kind:'chunk',item:'slag-steel-chunk',quantity:1,owner:{type:'ground',x:slag.x,z:slag.z}};w.piles.push(pile);}
  return true;
}
