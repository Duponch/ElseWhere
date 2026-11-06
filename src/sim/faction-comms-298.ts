import {blockedCells,reachableCells,routeToCell} from './pathfinding.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {planCommandDrops,releaseWork} from './work-release.ts';
import {interruptWork} from './interrupted-cargo.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {actualConsoleHome298,consoleSpot298,consoleOtherActivity298,consolePhysicalReason298,advanceConsoleContact298,settledConsoleContact298} from './console-service-298.ts';
import {factionCommsTask298,type FactionCommsPawn298} from './faction-comms-state-298.ts';
import type {NeedContext} from './needs.ts';
import type {CommandResult,Pawn,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export function factionCommsReason298(w:World,p:Pawn,factionId:number,consoleId:number):string|undefined {
 const home=actualConsoleHome298(w);if(!home)return 'Une véritable carte foyer298 chargée est nécessaire.';
 const registry=home.root.worldFactions,faction=registry?.factions.find(f=>f.id===factionId);
 if(!registry||!faction||faction.id===registry.playerFactionId||faction.hidden||faction.lifecycle259?.temporary||faction.lifecycle259?.defeated)return 'Faction de communication indisponible.';
 const leader=faction.leaderOwnerId===null?undefined:registry.leaders.find(owner=>owner.factionId===faction.id&&owner.pawn.id===faction.leaderOwnerId)?.pawn;
 // Registry leaders are actual off-map owners, not spawned map Pawns.
 // Their stored x/z do not imply Spawned. Native downed/prisoner/awake/mental
 // restrictions apply only to a spawned leader; this owner form is not one.
 if(!leader||leader.health?.death||leader.state==='dead')return 'Le chef réel de cette faction est indisponible.';
 const console=structureById(w,consoleId);if(!console)return 'Console introuvable.';
 return consolePhysicalReason298(w,p,console);
}
const otherActivity=(w:World,p:Pawn)=>!!p.orbitalTrade||consoleOtherActivity298(w,p);
export function stopFactionComms298(w:World,p:Pawn):void {
 if(!releaseWork(w,p))interruptWork(w,p);delete (p as FactionCommsPawn298).factionComms298;
 p.path=[];p.planCooldown=0;if(!['dead','downed','sleeping'].includes(p.state))p.state=(p.motion?.end??0)*10>frontierCore297(w)?'moving':'idle';
}
export function reconcileFactionComms298(w:World,p:Pawn):boolean {
 const task=factionCommsTask298(p);if(!task)return false;
 const home=actualConsoleHome298(w),console=structureById(w,task.consoleId),spot=console&&consoleSpot298(console);
 if(!home||task.mapId!==home.mapId||factionCommsReason298(w,p,task.factionId,task.consoleId)||!spot||spot.x!==task.spot.x||spot.z!==task.spot.z||otherActivity(w,p)){stopFactionComms298(w,p);return false;}return true;
}
/** Called in the existing macro decision lane, never once per physical Core. */
export function processFactionComms298(w:World,p:Pawn,ctx:NeedContext):boolean {
 if(!reconcileFactionComms298(w,p))return false;advanceConsoleContact298(w,p,factionCommsTask298(p)!,ctx);return true;
}
export function factionCommsAtContact298(w:World,p:Pawn,factionId:number,consoleId:number):boolean {
 const task=factionCommsTask298(p),home=actualConsoleHome298(w);
 return !!home&&!!task&&task.mapId===home.mapId&&task.factionId===factionId&&task.consoleId===consoleId&&!factionCommsReason298(w,p,factionId,consoleId)&&!otherActivity(w,p)&&settledConsoleContact298(w,p,task);
}
export function orderFactionComms298(w:World,pawnId:number,factionId:number,consoleId:number):CommandResult {
 const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason}),p=w.pawns.find(p=>p.id===pawnId),home=actualConsoleHome298(w);
 if(!p||!home)return fail('Négociateur ou carte foyer introuvable.');
 const reason=factionCommsReason298(w,p,factionId,consoleId);if(reason)return fail(reason);
 const console=structureById(w,consoleId)!,spot=consoleSpot298(console),path=routeToCell(w,spot,reachableCells(w,p,blockedCells(w),new Set()));if(!path)return fail('Console inaccessible.');
 const drops=planCommandDrops(w,{type:'order-faction-comms',pawnId,factionId,consoleId});if(!drops||!releaseWork(w,p,drops))return fail('Pas de place pour déposer la cargaison.');
 clearQueuedOrders(w,p);delete p.priorityWork;
 (p as FactionCommsPawn298).factionComms298={mapId:home.mapId,factionId,consoleId,spot,phase:'approach',startedAt:w.tick,startedAtCore:frontierCore297(w)};
 p.path=path;p.state='moving';p.planCooldown=0;return {ok:true};
}