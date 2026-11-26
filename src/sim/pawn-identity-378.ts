import type {Cell,CommandResult,Pawn,World} from './types.ts';
import type {NeedContext} from './needs.ts';
import {isColonist} from './affiliation.ts';
import {appearanceOf} from './pawn-appearance.ts';
import {ancientHumanNameLabel256} from './ancient-human-name-256.ts';
import {actualPlayerOwner259,clearActualGuest259} from './world-affiliation-259.ts';
import {forgetLocalActorBed256} from './actor-bed-local-256.ts';
import {planCommandDrops,releaseWork} from './work-release.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {campaignLivingObservers} from './campaign-people.ts';
import {gainMoodPoolMemory350} from './mood-pool-memories-350.ts';
import {closestFamilyRelation} from './relationship-state.ts';
import {relationshipIndex} from './relationship-runtime.ts';
import {opinionOf} from './social-state.ts';
import {expireBereavement,DEATH_MEMORY_LIMIT,type DeathMemoryKind} from './bereavement.ts';
import {expireFamilyBereavement,FAMILY_DEATH_LIMIT} from './family-bereavement.ts';
import {atMapEdge} from './raid-space.ts';
import {routeToCell,routeCost} from './pathfinding.ts';
import {canStandAt} from './furniture-travel.ts';
import {processNeeds} from './needs.ts';
import {carrierOf} from './rescue-state.ts';
import {groupOnMapMember} from './group-state.ts';
import {scoutOnMapId} from './caravan-trip.ts';
import {commercialOnMapId} from './commercial-trip.ts';
import {stopCapturedTravel297} from './movement.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {resetMentalBreakForArrest} from './mental-state.ts';
import {cancelMelee} from './melee-state.ts';
import {cancelShooting} from './shooting-state.ts';
import {rememberCurrentMapArea} from './pawn-map-areas.ts';
import {wouldBeLeftToDie378} from './banish-risk-378.ts';
import {finalizeBanishedDepartures378} from './pawn-banish-exit-378.ts';
import {validPawnNameInput378,type PawnIdentityCommand378} from './pawn-identity-state-378.ts';
export {validPawnIdentity378,type PawnIdentity378,type BanishDeparture378,type PawnIdentityCommand378} from './pawn-identity-state-378.ts';
export {finalizeBanishedDepartures378};

const fail=(reason:string):CommandResult=>({ok:false,reason});
export function pawnRenameRefusal378(w:World,p:Pawn|undefined):string|undefined {
 if(Number(w.schemaVersion)<378)return 'Cette sauvegarde ne prend pas en charge le changement de nom.';
 if(!p||!w.pawns.includes(p)||!isColonist(p)||p.state==='dead'||p.health?.death)return 'Seul un colon vivant de cette carte peut être renommé.';
}
export function pawnBanishRefusal378(w:World,p:Pawn|undefined):string|undefined {
 const reason=pawnRenameRefusal378(w,p);if(reason)return reason;
 if(p!.prisoner||p!.visitor||w.worldFactions&&!actualPlayerOwner259(p!,w.worldFactions.playerFactionId))return 'Seul un colon libre peut être banni.';
 if(p!.state==='downed'||carrierOf(w,p!.id))return 'Impossible de bannir une personne à terre.';
 if(p!.identity378?.banishedAt!==undefined)return 'Cette personne a déjà été bannie.';
 if(groupOnMapMember(w,p!.id)||scoutOnMapId(w)===p!.id||commercialOnMapId(w)===p!.id)return 'Annulez la préparation du voyage avant de bannir ce colon.';
}
/** Native normal naming permits nickname and custom backstory title only.
 * A historical single name stays single; a native triple keeps First/Last. */
export function applyPawnIdentityCommand378(w:World,c:PawnIdentityCommand378):CommandResult {
 const p=w.pawns.find(p=>p.id===c.pawnId),reason=c.type==='pawn-rename'?pawnRenameRefusal378(w,p):pawnBanishRefusal378(w,p);if(reason)return fail(reason);
 if(c.type==='pawn-rename'){
  if(!validPawnNameInput378(c.nick)||!validPawnNameInput378(c.title)||!p!.nativeHuman&&!c.nick.trim())return fail('Le nom doit contenir de 1 à 16 lettres ou chiffres, espaces, apostrophes, points ou tirets ; le titre peut rester vide.');
  const nick=c.nick.trim();
  // Old appearances derived from a name become their actual visible appearance
  // before that name changes; renaming never changes the body's identity.
  p!.appearance??=appearanceOf(p!,w.seed);
  if(p!.nativeHuman){const n=p!.nativeHuman.name,chosen=nick||n.first||n.last;p!.nativeHuman={...p!.nativeHuman,name:{...n,nick:chosen,nickSet:!!nick}};p!.name=ancientHumanNameLabel256(p!.nativeHuman.name);}
  else p!.name=nick;
  const identity={...(p!.identity378??{revision:1 as const})};if(c.title)identity.title=c.title;else delete identity.title;
  if(Object.keys(identity).length>1)p!.identity378=identity;else delete p!.identity378;
  return {ok:true};
 }
 // SetFaction's ClearMind stops the existing edge at its committed source.
 // Plan the cargo there before any original is written, including a refusal.
 const motion=p!.motion,at=motion&&motion.end>effectiveLocal297(w)?motion.from:p!;
 const source=at===p?w:{...w,pawns:w.pawns.map(q=>q===p?{...q,x:at.x,z:at.z,motion:null,moveCooldown:0}:q)};
 const drops=planCommandDrops(source,{type:'clear-orders',pawnId:p!.id});
 if(!drops)return fail('Pas de place pour déposer les objets transportés avant le bannissement.');
 const stopped={x:p!.x,z:p!.z,moveCooldown:p!.moveCooldown,path:p!.path,motion:p!.motion},hadMotion=Object.hasOwn(p!,'motion');
 stopCapturedTravel297(w,p!);
 if(!releaseWork(w,p!,drops,true)){Object.assign(p!,stopped);if(!hadMotion)delete p!.motion;return fail('Le travail en cours ne peut pas être interrompu pour ce bannissement.');}
 clearQueuedOrders(w,p!);delete p!.priorityWork;
 const dying=wouldBeLeftToDie378(w,p!);giveBanishThoughts378(w,p!,dying);
 forgetLocalActorBed256(w,p!);delete p!.draft;if(p!.mapAreas)rememberCurrentMapArea(w,p!,null);delete p!.allowedAreaId;delete p!.allowedAreaReturn;
 resetMentalBreakForArrest(p!);if(p!.mental?.wander)p!.mental.wander.nextMoveOrderIsWait=true;cancelMelee(p!);cancelShooting(p!);delete p!.tactics;delete p!.flee;delete p!.bombRefuge;delete p!.hostilityResponse;delete p!.surgeryRequest;delete p!.meleeThreat;
 if(p!.worldAffiliation259){clearActualGuest259(p!);p!.worldAffiliation259={...p!.worldAffiliation259!,factionId:null};}
 p!.faction='outlanders';p!.identity378={...(p!.identity378??{revision:1}),banishedAt:w.tick};p!.path=[];p!.planCooldown=0;
 w.events.push({tick:w.tick,type:'command',message:`${p!.name} a été banni de la colonie${dying?' malgré un risque mortel':''}.`});
 if(w.events.length>80)w.events.splice(0,w.events.length-80);
 return {ok:true};
}

/** The same existing memories represent the Core grief given to a pawn who
 * is banished to die. No death, corpse or relation deletion is manufactured. */
function giveBanishThoughts378(w:World,victim:Pawn,dying:boolean):void {
 const family=dying?relationshipIndex(w):undefined;
 for(const {pawn:p,world:local} of campaignLivingObservers(w)){
  if(p===victim||!isColonist(p)||p.prisoner||p.visitor||p.state==='dead'||p.health?.death)continue;
  gainMoodPoolMemory350(p,dying?'colonist-banished-to-die':'colonist-banished',w.tick,victim.id);
  if(!dying)continue;
  expireBereavement(p,w.tick);expireFamilyBereavement(p,w.tick);
  const relation=closestFamilyRelation(family!,p.id,victim.id);
  if(relation&&!p.familyBereavement?.some(m=>m.otherId===victim.id)){
   const list=p.familyBereavement??=[],kind=`${relation}-died` as const,same=list.filter(m=>m.kind===kind);
   if(same.length>=FAMILY_DEATH_LIMIT)list.splice(list.indexOf(same.reduce((a,b)=>a.at<b.at?a:b)),1);
   list.push({kind,otherId:victim.id,at:w.tick,banishedToDie378:true});
  }
  const opinion=opinionOf(p,victim.id,w.tick,local),kind:DeathMemoryKind|undefined=opinion>=20?'friend-died':opinion<=-20?'rival-died':undefined;
  if(kind&&!p.bereavement?.some(m=>m.otherId===victim.id)){
   const list=p.bereavement??=[],same=list.filter(m=>m.kind===kind);if(same.length>=DEATH_MEMORY_LIMIT)list.splice(list.indexOf(same.reduce((a,b)=>a.at<b.at?a:b)),1);
   list.push({kind,otherId:victim.id,at:w.tick,opinion,banishedToDie378:true});
  }
 }
}
/** JobGiver_ExitMap after SetFaction(null). The normal navigation and finite
 * search budget own every movement; a sealed map keeps its original person. */
export function processBanishedPawn378(w:World,p:Pawn,c:NeedContext):boolean {
 if(Number(w.schemaVersion)<378||p.identity378?.banishedAt===undefined||isColonist(p)||p.prisoner)return false;
 if(p.state==='dead'||p.state==='downed'||carrierOf(w,p.id))return true;
 if(p.mental?.crisis)return false;
 if(p.need&&!c.release()){processNeeds(w,p,c);return true;}
 if(atMapEdge(w,p)&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick){p.state='idle';return true;}
 if(!p.path.length&&p.planCooldown>0){p.state='idle';return true;}
 if(!p.path.length||p.planCooldown===0){
  const goals=new Set<number>();for(let z=0;z<w.height;z++)for(let x=0;x<w.width;x++)if(atMapEdge(w,{x,z})&&canStandAt(w,{x,z}))goals.add(z*w.width+x);
  const reach=c.search(goals);if(!reach)return true;
  let best:Cell[]|undefined,cost=Infinity;for(const i of goals){const path=routeToCell(w,{x:i%w.width,z:Math.floor(i/w.width)},reach);if(path){const score=routeCost(w,path,reach);if(score<cost){cost=score;best=path;}}}
  p.path=best??[];p.planCooldown=20;
 }
 const target=p.path.at(-1);if(target){p.state='moving';c.move(target,true);}else p.state='idle';return true;
}
