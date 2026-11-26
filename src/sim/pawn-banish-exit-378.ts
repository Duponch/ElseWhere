import {filterPileEntries} from './pile-identity-directory.ts';
import type {Pawn,World} from './types.ts';
import type {WorldPawnOwner256,WorldPawnsState256} from './world-pawn-state-256.ts';
import {isColonist} from './affiliation.ts';
import {atMapEdge} from './raid-space.ts';
import {carrierOf} from './rescue-state.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {worldPawnsPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {cleanMapRemovedHumanRecord259} from './world-lost-owners.ts';
import {clearReleasedPawnAssignments259} from './work-release.ts';
import {unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import {preparePassedToWorld256,type WorldPawnFactionCondition256} from './world-pawn-transition-256.ts';
import {suspendWorldPawnGoods259} from './world-pawn-held-259.ts';
import {worldPawnActiveBoundary256} from './world-pawn-life-256.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {cancelWorldPawnGC256} from './world-pawn-gc-256.ts';
import {WORLD_FACTION_TECH_LEVEL_259} from './world-faction-catalog.ts';
import {healthRandom} from './health.ts';
import {prepareDepartureCombat261} from './caravan-departure-combat-261.ts';
import {notifyBillWorkerUnavailable283} from './bill-worker-owners-283.ts';

const owns=(p:{owner:object},id:number)=>'pawnId'in p.owner&&p.owner.pawnId===id;
/** A non-geographic historical world cannot manufacture native geographic
 * provenance. Only that pre-existing adapted context uses a frozen full owner. */
export const usesLegacyBanishArchive378=(w:World):boolean=>{
 const root=registeredCampaign(w);return root.planet?.revision!==3||!root.worldPawns||!root.worldFactions;
};
function ready(w:World,p:Pawn):boolean {
 return Number(w.schemaVersion)>=378&&p.identity378?.banishedAt!==undefined&&!isColonist(p)&&!p.prisoner&&w.pawns.includes(p)&&atMapEdge(w,p)
  &&p.state!=='dead'&&p.state!=='downed'&&p.state!=='sleeping'&&!p.health?.death&&!p.need&&!p.mental?.crisis&&!carrierOf(w,p.id)
  &&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&(p.stun?.untilCore??0)<=w.tick*10&&!p.interruptedCargo&&!p.equipmentDropPending&&!p.rescue&&!p.animalRescue&&!p.coupleTask285
  &&!w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)&&!w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
}
function writeOriginal(target:object,draft:object):void {
 const t=target as Record<string,unknown>,d=draft as Record<string,unknown>;
 for(const key of Object.keys(t))if(!Object.hasOwn(d,key))delete t[key];
 for(const key of Object.keys(d))if(JSON.stringify(t[key])!==JSON.stringify(d[key]))t[key]=d[key];
}
/** True border ExitMap, after the local pawn pass and WorldPawns' civil pass.
 * Reuses the same Free transition, goods suspension and native-order commit as
 * the existing map/caravan exits; the original body and items move once. */
export function exitBanishedPawn378(w:World,p:Pawn):boolean {
 if(!ready(w,p))return false;
 const root=registeredCampaign(w),mapId=registeredMapId(w);if(mapId===undefined)return false;
 const combat=prepareDepartureCombat261(w,new Set([p.id]));if(!combat.ok||!combat.current())return false;
 const items=w.piles.filter(i=>owns(i,p.id)),packed=w.packed.filter(i=>owns(i,p.id));
 const draft=structuredClone(p);clearReleasedPawnAssignments259(draft);
 if(draft.worldAffiliation259)cleanMapRemovedHumanRecord259(draft,w.tick);
 else {
  // The adapted historical original has no native guest tracker to clear.
  // Stop its existing local components without creating one retrospectively.
  for(const key of ['draft','flee','bombRefuge','tactics','melee','shooting','stagger','stun','meleeThreat','surgeryRequest','burning','filthFeet','priorityWork','transitExit','equipmentDropPending','droppedWeaponId'] as const)delete draft[key];
  if(draft.social)delete draft.social.fight;delete draft.motion;draft.path=[];draft.moveCooldown=0;
 }
 unclaimDetachedActorBed256(draft);delete draft.allowedAreaId;delete draft.allowedAreaReturn;
 const history=p.prisonerHistory259;
 if(usesLegacyBanishArchive378(w)){
  writeOriginal(p,draft);if(history)p.prisonerHistory259=history;
  combat.commit();notifyBillWorkerUnavailable283(w,p.id);
  (w.banishedDepartures378??=[]).push({tick:w.tick,mapId,pawn:p,items,packed});
 }else{
  const state=root.worldPawns!,factions=root.worldFactions!,now=w.tick*10;
  if(root.tick!==w.tick||state.atCore!==now||!p.worldAffiliation259||p.worldAffiliation259.factionId!==null||state.owners.some(row=>row.actor.id===p.id)||!nativeWorldPawnOrderCurrent256(state,state.nativeOrder))return false;
  const conditions:WorldPawnFactionCondition256[]=[];
  for(const faction of factions.factions){if(!faction.lifecycle259)return false;conditions.push({factionId:faction.id,...faction.lifecycle259,techLevel:WORLD_FACTION_TECH_LEVEL_259[faction.def]});}
  let absolute:number;try{absolute=actualCampRemovalAbsCore256(root,w);}catch{return false;}
  const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}};
  const physical=worldPawnsPhysicalCore297(state,Number(w.schemaVersion));
  const row:WorldPawnOwner256={kind:'human',actor:draft,factionId:null,originMapId:mapId,context,clockCore:now,enteredAtAbsCore:absolute,entryKind261:'map-exit',mode:'active',everColonist:true,items:structuredClone(items),packed:structuredClone(packed),...physical!==now?{physicalClockCore297:physical}:{}};
  suspendWorldPawnGoods259(row,now,Number(w.schemaVersion),physical);
  if(worldPawnActiveBoundary256(row,Number(w.schemaVersion),physical))return false;
  const nativeBefore=state.nativeOrder,staged:WorldPawnsState256={...state,owners:state.owners.slice()},random={rng:root.rng};
  const pass=preparePassedToWorld256(staged,row,factions,{float:(min,max)=>min+(max-min)*healthRandom(random)},{version:Number(w.schemaVersion),situation:'Free',conditions});if(!pass.ok)return false;
  pass.commit();if(!combat.current()||!nativeWorldPawnOrderCurrent256(state,nativeBefore))return false;
  const outcome=pass.row;writeOriginal(p,outcome.actor);if(history)p.prisonerHistory259=history;
  for(const item of items){const next=outcome.items.find(i=>i.id===item.id)!;writeOriginal(item,next);}
  for(const pack of packed){const next=outcome.packed.find(i=>i.building.id===pack.building.id)!;writeOriginal(pack,next);}
  outcome.actor=p;outcome.items=items;outcome.packed=packed;
  combat.commit();notifyBillWorkerUnavailable283(w,p.id);cancelWorldPawnGC256(state);state.owners.push(outcome);commitNativeWorldPawnOrder256(state,nativeBefore,staged.nativeOrder);root.rng=random.rng;
 }
 w.pawns=w.pawns.filter(other=>other!==p);w.piles=filterPileEntries(w.piles,i=>!items.includes(i));w.packed=w.packed.filter(i=>!packed.includes(i));
 w.events.push({tick:w.tick,type:'command',message:`${p.name} quitte la carte avec ses vêtements, son équipement et son inventaire.`});return true;
}
export function finalizeBanishedDepartures378(w:World):void {
 if(Number(w.schemaVersion)<378)return;
 for(const p of w.pawns.slice())if(p.identity378?.banishedAt!==undefined)exitBanishedPawn378(w,p);
}
