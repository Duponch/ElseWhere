import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {registeredCampaign,withWorldGroup} from './world-map-context.ts';
import {peaceTalksArrivalReason293,preparePeaceTalksResolution293} from './peace-talks-runtime-293.ts';
import {worldSettlementAccess256} from './world-faction-access.ts';
import {arriveGeographicGroupPost256,groupGeographicTradeTarget256} from './group-geographic-post-256.ts';
import {enterRegisteredSite} from './world-map-authority.ts';
import {prepareGroupRedirection} from './group-trip.ts';
import {planetCostContext,planetQueryBudget} from './planet-navigation.ts';
import {captureGroupMass} from './group-capture.ts';
import {freightGroup} from './group-freight.ts';
import {validRetainedArrivalShape261} from './caravan-encounter-save-261.ts';
import {worldTargetAccess263,queueWorldTargetEntry263,queueWorldTargetEntryAtTile298,pendingWorldTargetOrder263} from './world-target-access-263.ts';
import type {RetainedArrival261} from './caravan-encounter-state-261.ts';
import type {CampaignState} from './world-map-state.ts';
import type {CommandResult} from './types.ts';
export type CaravanArrivalCommand261={type:'caravan-order';groupId:number;destination:number;action:RetainedArrival261};
export interface CaravanTradeArrival261 {groupId:number;settlementId:number;factionId:number;postId:number}
const notices=new WeakMap<CampaignState,CaravanTradeArrival261[]>();
export function takeCaravanTradeArrivals261(root:CampaignState):CaravanTradeArrival261[]{const rows=notices.get(root)??[];notices.delete(root);return rows;}
export function validCaravanArrivalCommand261(v:unknown,version=261):v is CaravanArrivalCommand261 {
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 const r=v as Record<string,unknown>;return Reflect.ownKeys(r).length===4&&['type','groupId','destination','action'].every(k=>Object.hasOwn(r,k)&&Object.hasOwn(Object.getOwnPropertyDescriptor(r,k)!,'value'))&&r.type==='caravan-order'&&Number.isSafeInteger(r.groupId)&&Number(r.groupId)>0&&Number.isSafeInteger(r.destination)&&Number(r.destination)>=0&&validRetainedArrivalShape261(r.action,version);
}
export function applyCaravanArrivalCommand261(root:CampaignState,c:CaravanArrivalCommand261):CommandResult {
 const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason}),r=root.worldGroups?.groups.find(r=>r.state.id===c.groupId),g=r?.state,planet=root.planet,a=c.action;
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||!validCaravanArrivalCommand261(c,root.schemaVersion)||!r?.encounters261||r.pending261||!g||!('members'in g)||r.localMapId!==null||!planet)return fail('L’ordre exige la vraie caravane prospective disponible.');
 const pendingOrder=pendingWorldTargetOrder263(root,r,c.destination,a);if(pendingOrder)return pendingOrder;
 if(a?.kind==='peace-talks'){const reason=peaceTalksArrivalReason293(root,g.id,a.siteId,c.destination);if(reason)return fail(reason);}
 if(a?.kind==='attack-settlement'||a?.kind==='visit-site'){const access=worldTargetAccess263(root,a,c.destination);if(!access.ok)return fail(access.reason);}
 if(a?.kind==='enter'&&!root.worldMaps?.sites.some(s=>s.id===a.mapId&&s.tile===c.destination))return fail('La carte de cette entrée a disparu ou changé de tuile.');
 if(a?.kind==='trade'){
  const access=root.worldFactions&&worldSettlementAccess256(root.worldFactions,a.settlementId);
  if(!access?.ok||!access.canTrade||access.settlement.tile!==c.destination||access.settlement.factionId!==a.factionId||access.settlement.postId!==a.postId)return fail('L’établissement, sa faction ou son stock ne correspond plus à cet ordre.');
 }
 // StartPath at the real destination invokes VisitSite immediately in Core1.6.
 // This request creates no map and plays no tick; the existing cooperative
 // generator still owns every physical adoption, allocation and placement.
 if(isSchema298OrLater(Number(root.schemaVersion))&&a?.kind==='visit-site'&&g.tile===c.destination){
  if(!captureGroupMass(g.members,g.items,freightGroup(g),root.schemaVersion,g.packed,g.animalOwners?.members))return fail('La masse actuelle est invalide.');
  return queueWorldTargetEntryAtTile298(root,r,a)?{ok:true}:fail('La vraie entrée immédiate du Site ne peut pas être engagée.');
 }
 return withWorldGroup(root,g.id,view=>{const mass=captureGroupMass(g.members,g.items,freightGroup(g),root.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return fail('La masse actuelle est invalide.');const plan=prepareGroupRedirection(planet,g,c.destination,planetCostContext(view,mass),planetQueryBudget(planet));if(plan.kind!=='ready')return fail(plan.kind==='deferred'?'Le calcul de route doit être réessayé.':plan.reason);
  view.group={...plan.state,paused:false};if(a)r.arrival261={tile:c.destination,action:{...a}};else delete r.arrival261;return {ok:true};})??fail('Le contexte de la caravane a disparu.');
}
/** True route completion only. The action is consumed on this attempt, even a
 * refusal. A null post at order is historical absence, never an absence promise.
 * Another caravan's real finite post is resolved by its current owner. */
export function advanceCaravanArrivals261(root:CampaignState):number[] {
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion)))))return [];const changed:number[]=[];
 for(const r of root.worldGroups?.groups.slice()??[]){const g=r.state,a=r.arrival261;if(!a||!('members'in g)||r.localMapId!==null||g.segment||g.tile!==g.destination||g.tile!==a.tile||!['at-site','awaiting-entry'].includes(g.phase)||g.lastPersonalTick!==root.tick)continue;
  delete r.arrival261;changed.push(g.id);let ok=false;
  const action=a.action;
  if(action.kind==='peace-talks'){const prepared=preparePeaceTalksResolution293(root,g.id,action.siteId);if(prepared.ok)ok=prepared.commit().ok;}
  else if(action.kind==='enter'){const target=root.worldMaps?.sites.find(s=>s.id===action.mapId&&s.tile===g.tile);if(target)ok=enterRegisteredSite(root,g.id,'visit',false).ok;}
  else if(action.kind==='attack-settlement'||action.kind==='visit-site')ok=queueWorldTargetEntry263(root,r,action);
  else {
   const factions=root.worldFactions,access=factions&&worldSettlementAccess256(factions,action.settlementId);
   if(access?.ok&&access.canTrade&&access.settlement.tile===g.tile&&access.settlement.factionId===action.factionId&&(action.postId===null||access.settlement.postId===action.postId)){
    withWorldGroup(root,g.id,view=>{const still=root.worldFactions===factions&&root.worldGroups?.groups.includes(r)&&r.state===g&&g.lastPersonalTick===root.tick;if(!still||!arriveGeographicGroupPost256(view,g))return;const target=groupGeographicTradeTarget256(view,g);if(!target||target.settlementId!==action.settlementId||target.factionId!==action.factionId||action.postId!==null&&target.postId!==action.postId)return;
     root.worldGroups!.selectedGroupId=g.id;const rows=notices.get(root)??[];rows.push({groupId:g.id,settlementId:target.settlementId,factionId:target.factionId,postId:target.postId});notices.set(root,rows);ok=true;});
   }
  }
  if(!ok){root.worldGroups!.events.push({tick:root.tick,type:'command',message:'L’action d’arrivée n’est plus disponible ; la caravane reste sur sa véritable tuile.'});if(root.worldGroups!.events.length>80)root.worldGroups!.events.splice(0,root.worldGroups!.events.length-80);}
 }
 return changed;
}
