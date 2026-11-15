import {notifyColonistKidnapped336} from './colony-economy.ts';
import {preparePartyRelease292} from './party-release-292.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import {prepareCoupleRelease285,type CoupleReleasePlan285} from './couple-release-285.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {raidGroup261,raidSource261} from './temp-map-raids-261.ts';
import type {Pawn,World} from './types.ts';
import type {WorldPawnOwner256,WorldPawnsState256} from './world-pawn-state-256.ts';
import {mutableWorldPawnOriginal256} from './world-pawn-state-256.ts';
import {registeredCampaign,registeredMapId,registeredMap} from './world-map-context.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {validWorldAffiliationForeignKeys259} from './world-affiliation-259.ts';
import {cleanMapRemovedHumanRecord259} from './world-lost-owners.ts';
import {clearReleasedPawnAssignments259} from './work-release.ts';
import {unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import {preparePassedToWorld256,type WorldPawnFactionCondition256} from './world-pawn-transition-256.ts';
import {worldPawnActiveBoundary256} from './world-pawn-life-256.ts';
import {suspendWorldPawnGoods259} from './world-pawn-held-259.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {cancelWorldPawnGC256} from './world-pawn-gc-256.ts';
import {WORLD_FACTION_TECH_LEVEL_259} from './world-faction-catalog.ts';
import {healthRandom} from './health.ts';
import {atMapEdge} from './raid-space.ts';
import {carrierOf} from './rescue-state.ts';
import {isStunned} from './stun.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelShooting} from './shooting-state.ts';
import {kidnapping261,kidnapExitPhysicalReason261} from './caravan-kidnap-261.ts';
import {notifyBillWorkerUnavailable283} from './bill-worker-owners-283.ts';

type CaptivityRow261=WorldPawnOwner256&{entryKind261?:'map-exit';captivity261?:{factionId:number;atCore:number}};
/** This actual dossier will be MOVED at commit, after private preflight. */
const mutableHistory261=(h:Pawn['prisonerHistory259']):boolean=>!h||[h,...h.breakout?[h.breakout]:[]].every(o=>Object.isExtensible(o)&&Reflect.ownKeys(o).every(k=>{const d=Object.getOwnPropertyDescriptor(o,k)!;return Object.hasOwn(d,'value')&&d.writable===true&&d.configurable===true;}));

export type MapRaiderWorldExit261={ok:true;departingIds:readonly number[];rows:readonly WorldPawnOwner256[];current():boolean;commit():void}|{ok:false;reason:string};
/** One true DeSpawn/PassedToWorld boundary. Stock stays on its current real
 * human holder. No RaidDeparture item archive and no encounterBirth null origin
 * are produced: these actors really leave THIS registered geographic map. */
export function prepareMapRaiderWorldExit261(w:World,carrier:Pawn,patient?:Pawn):MapRaiderWorldExit261 {
 const no=(reason:string):MapRaiderWorldExit261=>({ok:false,reason});
 const root=registeredCampaign(w),mapId=registeredMapId(w),state=root.worldPawns,factions=root.worldFactions;
 const calendar=w.raids,group=carrier.raid?.group,active=raidGroup261(w,group);
 const source=raidSource261(w,group),captor=source?.caravan261??source?.tempIncident261;
 if((Number(w.schemaVersion)!==261&&(Number(w.schemaVersion)!==262&&!isSchema263OrLater(Number(w.schemaVersion))))||(Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||!w.pawns.includes(carrier)||mapId===undefined||registeredMap(root,mapId)!==w||w.tick!==root.tick||!root.worldMaps?.sites.some(s=>s.id===mapId)||!state||!factions||!captor||group===undefined||active?.id===group&&!active.members?.includes(carrier.id))return no('La sortie ne possède pas ses vrais propriétaires carte/faction/assaut.');
 if('kind'in captor&&captor.kind==='pressure'&&captor.sourceMapId!==mapId)return no('La pression ne provient pas de cette vraie carte Battlefield.');
 const released=!!carrier.prisoner&&carrier.prisoner.mode==='release'&&carrier.prisoner.releasedAt!==undefined&&carrier.prisoner.releasedAt<=root.tick&&!!carrier.prisoner.escape;
 const now=root.tick*10;
 if(state.atCore!==now||!nativeWorldPawnOrderCurrent256(state,state.nativeOrder))return no('La passe WorldPawns confirmée doit précéder cette sortie.');
 if(!carrier.raid?.exiting||!atMapEdge(w,carrier)||carrier.moveCooldown!==0||(carrier.motion?.end??0)>w.tick||carrier.state==='dead'||carrier.state==='downed'||carrier.state==='sleeping'||carrier.health?.death||carrier.prisoner&&!released||carrier.need||carrier.melee?.strike||carrier.shooting?.stance||isStunned(carrier,now)||carrierOf(w,carrier.id))return no('Le pillard n’a pas encore atteint sa vraie sortie physique.');
 if(patient&&released)return no('La personne libérée ne possède aucun mandat pour emporter une victime.');
 if(patient){if('kind'in captor&&captor.kind!=='assault')return no('Une caravane défensive ne possède pas d’autorité de kidnapping.');const reason=kidnapExitPhysicalReason261(w,carrier,patient);if(reason)return no(reason);}
 else if(kidnapping261(carrier))return no('Le passager réel doit sortir dans la même transaction que son ravisseur.');
 const originals=patient?[carrier,patient]:[carrier];
 if(new Set(originals.map(p=>p.id)).size!==originals.length)return no('La sortie partage un même original entre deux lignes.');
 if(originals.some(p=>!mutableWorldPawnOriginal256(p)||!p.worldAffiliation259||!validWorldAffiliationForeignKeys259(p,factions)||p.health&&medicalCivilTick271(p.health)!==w.tick||state.owners.some(r=>r.actor===p||r.actor.id===p.id)||p.rescue||p.animalRescue||p.surgery||p.interruptedCargo||p.equipmentDropPending||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)))return no('Une personne ou sa cargaison ne possède pas encore sa sortie terminale réelle.');
 if(carrier.worldAffiliation259!.factionId!==captor.factionId||captor.factionId===factions.playerFactionId||patient&&patient.worldAffiliation259!.factionId===captor.factionId)return no('La faction réelle du ravisseur ou de la victime ne correspond plus.');
 if(patient){const relation=factions.relations.find(r=>r.aId===Math.min(captor.factionId,factions.playerFactionId)&&r.bId===Math.max(captor.factionId,factions.playerFactionId));if(relation?.kind!=='hostile')return no('La faction ravisseuse n’est plus réellement hostile au joueur.');}
 let absolute:number;try{absolute=actualCampRemovalAbsCore256(root,w);}catch(e){return no(e instanceof Error?e.message:String(e));}
 const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}};
 const conditions:WorldPawnFactionCondition256[]=[];
 for(const faction of factions.factions){if(!faction.lifecycle259)return no('Une instance de faction ne possède pas son cycle de vie réel.');conditions.push({factionId:faction.id,...faction.lifecycle259,techLevel:WORLD_FACTION_TECH_LEVEL_259[faction.def]});}
 const nativeBefore=state.nativeOrder,staged:WorldPawnsState256={...state,owners:state.owners.slice()},random={rng:root.rng};
 const prepared:{original:Pawn;row:CaptivityRow261;items:World['piles'];packed:World['packed'];history?:Pawn['prisonerHistory259']}[]=[];
 let couple:CoupleReleasePlan285;
 try{couple=prepareCoupleRelease285(w,new Set(originals.map(p=>p.id)));
  // Only these actual exiting originals are excluded; remaining members may finish.
  const party=preparePartyRelease292(w,new Set(originals.map(p=>p.id)),{finish:originals.some(p=>p.id===w.party292?.active?.organizerId)});
  const base=couple;couple={...base,writes:[...party.writes,...base.writes],people:[...new Set([...base.people,...party.people])],current:()=>base.current()&&party.current(),commit(){if(!base.current()||!party.current())throw Error('Stale Party map exit');party.commit();base.commit();}};}catch(e){return no(e instanceof Error?e.message:String(e));}
 try{for(const original of originals){
  const history=original.prisoner??original.prisonerHistory259;if(!mutableHistory261(history))return no('Le dossier de captivité original ne peut pas être déplacé à sa vraie sortie.');
  const draft=couple.project(original);clearReleasedPawnAssignments259(draft);cleanMapRemovedHumanRecord259(draft,w.tick);unclaimDetachedActorBed256(draft);delete draft.allowedAreaId;delete draft.allowedAreaReturn;
  const items=w.piles.filter(i=>'pawnId'in i.owner&&i.owner.pawnId===original.id),packed=w.packed.filter(p=>p.owner.type!=='ground'&&p.owner.pawnId===original.id);
  const row:CaptivityRow261={kind:'human',actor:draft,factionId:draft.worldAffiliation259!.factionId,originMapId:mapId,context,clockCore:now,enteredAtAbsCore:absolute,entryKind261:'map-exit',mode:'active',items:structuredClone(items),packed:structuredClone(packed),...original===patient?{captivity261:{factionId:captor.factionId,atCore:now}}:{}};
  suspendWorldPawnGoods259(row,now);const boundary=worldPawnActiveBoundary256(row,root.schemaVersion,now);if(boundary)return no(boundary);
  const pass=preparePassedToWorld256(staged,row,factions,{float:(min,max)=>min+(max-min)*healthRandom(random)},{version:root.schemaVersion,situation:original===patient?'Kidnapped':'Free',conditions});if(!pass.ok)return no(pass.reason);pass.commit();prepared.push({original,row:pass.row,items,packed,history});
 }}catch(e){return no(e instanceof Error?e.message:String(e));}
 const removedIds=new Set(originals.map(p=>p.id)),targeters=w.pawns.filter(p=>!removedIds.has(p.id)&&[p.shooting?.order?.targetId,p.melee?.order?.targetId,p.tactics?.targetId].some(id=>id!==undefined&&id!==null&&removedIds.has(id)));
 if(targeters.some(p=>!mutableWorldPawnOriginal256(p)))return no('Une référence de combat à libérer n’est pas mutable.');
 const tick=root.tick,rng=root.rng,nextId=root.nextId,membership=state.owners.slice(),people=w.pawns.slice(),piles=w.piles.slice(),packs=w.packed.slice(),sourceJson=JSON.stringify(source),snapshots=originals.map(p=>JSON.stringify(p)),goods=prepared.map(p=>JSON.stringify([p.items,p.packed])),targeterSnapshots=targeters.map(p=>JSON.stringify(p));let used=false;
 const current=()=>!used&&couple.current()&&root.tick===tick&&w.tick===tick&&root.rng===rng&&root.nextId===nextId&&root.worldPawns===state&&root.worldFactions===factions&&state.atCore===now&&registeredMap(root,mapId)===w&&w.raids===calendar&&raidSource261(w,group)===source&&JSON.stringify(source)===sourceJson&&state.owners.length===membership.length&&state.owners.every((r,i)=>r===membership[i])&&nativeWorldPawnOrderCurrent256(state,nativeBefore)&&w.pawns.length===people.length&&w.pawns.every((p,i)=>p===people[i])&&w.piles.length===piles.length&&w.piles.every((p,i)=>p===piles[i])&&w.packed.length===packs.length&&w.packed.every((p,i)=>p===packs[i])&&originals.every((p,i)=>JSON.stringify(p)===snapshots[i])&&prepared.every((p,i)=>JSON.stringify([p.items,p.packed])===goods[i])&&prepared.every(p=>mutableHistory261(p.history))&&targeters.every((p,i)=>JSON.stringify(p)===targeterSnapshots[i]);
 return {ok:true,departingIds:originals.map(p=>p.id),rows:prepared.map(p=>p.row),current,commit(){
  if(!current())throw Error('Stale actual map raider/kidnap WorldPawn transfer');couple.commit();used=true;cancelWorldPawnGC256(state);
  for(const {original,row,items,packed,history} of prepared){
   const draft=row.actor as unknown as Record<string,unknown>,target=original as unknown as Record<string,unknown>;
   for(const key of Object.keys(target))if(!Object.hasOwn(draft,key))delete target[key];
   for(const key of Object.keys(draft))if(JSON.stringify(target[key])!==JSON.stringify(draft[key]))target[key]=draft[key];
   // Match SetGuestStatus(null): retain the SAME actual dossier and its dates,
   // resistance and RNG. Only local escape/breakout mandates end at DeSpawn.
   if(history){delete history.escape;if(history.breakout)delete history.breakout.active;original.prisonerHistory259=history;}
   row.actor=original;row.items=items;row.packed=packed;suspendWorldPawnGoods259(row,now);state.owners.push(row);
  }
  if(active?.tempIncident261)for(const id of removedIds)if(active.members.includes(id)&&!active.lost.includes(id))active.lost.push(id);if(active?.tempIncident261)active.lost.sort((a,b)=>a-b);
  commitNativeWorldPawnOrder256(state,nativeBefore,staged.nativeOrder);root.rng=random.rng;
  const ids=new Set(originals.map(p=>p.id)),movedItems=new Set(prepared.flatMap(p=>p.items)),movedPacks=new Set(prepared.flatMap(p=>p.packed));
  if(patient)notifyColonistKidnapped336(w,patient);
  w.pawns=w.pawns.filter(p=>!ids.has(p.id));w.piles=w.piles.filter(p=>!movedItems.has(p));w.packed=w.packed.filter(p=>!movedPacks.has(p));
  if(patient)notifyBillWorkerUnavailable283(w,patient.id);
  // Same local combat cancellation as the existing physical exitRaider;
  // no renderer or stale target may continue to own the departed actor.
  for(const p of targeters){cancelShooting(p);cancelMelee(p);delete p.tactics;p.path=[];if(p.raid)p.raid.goal=null;p.planCooldown=0;if((p.motion?.end??0)<=w.tick&&p.state==='moving')p.state='idle';}
 }};
}
