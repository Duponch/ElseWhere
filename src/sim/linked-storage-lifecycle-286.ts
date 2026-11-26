import {revokeActorRecordSource297} from './actor-record-source-297.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {prepareLinkedStorageRemoval286,type LinkedStoragePlanResult286,type LinkedStoragePlan286} from './linked-storage-plan-286.ts';
import {isShelfKind} from './shelf-storage.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import type {Structure,World} from './types.ts';

function unchanged():LinkedStoragePlan286{
 let used=false;return {ok:true,writes:[],changedCellIds:[],noop:true,current:()=>!used,
  commit(){if(used)return false;used=true;return true;}};
}
/** Only actual object retirement enters here. Packing, travel and holder death
 * are custody changes and deliberately do not call this helper. */
export function prepareLinkedShelfRetirement286(world:World,buildings:readonly Structure[]):LinkedStoragePlanResult286{
 const shelves=buildings.filter(s=>isShelfKind(s.kind));
 return isSchema286OrLater(world.schemaVersion)&&shelves.length?prepareLinkedStorageRemoval286(world,shelves.map(s=>s.id)):unchanged();
}
/** The physical installation frontier, not the earlier placement order. */
export function prepareLinkedShelfInstall286(world:World,building:Structure):LinkedStoragePlanResult286{
 if(!isSchema286OrLater(world.schemaVersion)||!isShelfKind(building.kind)||!building.shelf?.linked286)return unchanged();
 const group=registeredCampaign(world).linkedStorage286?.groups.find(g=>g.id===building.shelf!.linked286!.groupId);
 if(!group)return {ok:false,reason:'Groupe de l’étagère à réinstaller absent.'};
 return group.originMapId===registeredMapId(world)?unchanged():prepareLinkedStorageRemoval286(world,[building.id]);
}
/** Caller has checked plan.current immediately before its synchronous physical
 * preflight commit. That commit may move actual cargo, invalidating custody
 * stamps, but cannot change any of these already admitted policy leaves.
 * Used only after successful plant retirement at the installation frontier. */
export function adoptLinkedShelfInstallWrites286(plan:LinkedStoragePlan286):void{
 for(const w of plan.writes){
  revokeActorRecordSource297(w.object);
  if(w.present){if(Object.hasOwn(w.object,w.key)){if(!Reflect.set(w.object,w.key,w.value))throw Error('Admitted linked shelf install write failed');}
   else Object.defineProperty(w.object,w.key,{value:w.value,writable:true,enumerable:true,configurable:true});}
  else if(!Reflect.deleteProperty(w.object,w.key))throw Error('Admitted linked shelf install deletion failed');
 }
}
