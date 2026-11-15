import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {registeredMap,flushRegisteredMap} from './world-map-context.ts';
import {prepareMapRaiderWorldExit261} from './caravan-map-exit-261.ts';
import {atMapEdge} from './raid-space.ts';
import {raidSource261} from './temp-map-raids-261.ts';
import {isConcurrentRaids341} from './concurrent-raids-341.ts';
import type {CampaignState} from './world-map-state.ts';
const refusals=new WeakMap<object,string>();
/** True WorldPawns pass precedes this exact physical exit frontier. */
export function advanceCaravanMapExits261(root:CampaignState):void {
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion)))))return;
 for(const site of root.worldMaps?.sites??[]){const map=registeredMap(root,site.id)!;if(!map.raids?.active?.caravan261&&!map.raids?.last?.caravan261&&!map.raids?.extraActive261&&!map.raids?.extraResults261)continue;
  for(const actor of map.pawns.slice()){
   if(!actor.raid?.exiting||!atMapEdge(map,actor)||actor.moveCooldown>0||(actor.motion?.end??0)>map.tick||actor.state==='dead'||actor.state==='downed')continue;
   // Schema 341: a home raid (several may share the multi-raid lists) leaves
   // through the ordinary map exit, not this WorldPawn frontier.
   if(isConcurrentRaids341(map.schemaVersion)){const source=raidSource261(map,actor.raid.group);if(!source?.caravan261&&!source?.tempIncident261)continue;}
   const carry=actor.raid.kidnap261,patient=carry?.phase==='carry'?map.pawns.find(p=>p.id===carry.patientId):undefined,plan=prepareMapRaiderWorldExit261(map,actor,patient);
   if(!plan.ok){if(refusals.get(actor)!==plan.reason){refusals.set(actor,plan.reason);root.worldGroups!.events.push({tick:root.tick,type:'command',message:plan.reason.slice(0,240)});if(root.worldGroups!.events.length>80)root.worldGroups!.events.shift();}continue;}
   if(!plan.current())continue;plan.commit();refusals.delete(actor);flushRegisteredMap(map);
  }
 }
}
