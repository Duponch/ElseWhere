import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {electricityDisabledAtCore} from './cassandra-world.ts';
import {empStructureActive} from './emp-state.ts';
import {isPowerActive} from './power-rules.ts';
import {canStandAt} from './furniture-travel.ts';
import {reservedServiceCells} from './service-reservations.ts';
import {carrierOf} from './rescue-state.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {effectiveCore297 as frontierCore297} from './core-phase-297.ts';
import {combatCell297} from './combat-target.ts';
import {factionCommsTask298} from './faction-comms-state-298.ts';
import type {CampaignState,LocalMapState,WorldMapRecord} from './world-map-state.ts';
import type {NeedContext} from './needs.ts';
import type {Cell,Pawn,Structure,World} from './types.ts';

export interface ActualConsoleHome298 {root:CampaignState;mapId:number;body:World|LocalMapState;record?:WorldMapRecord}
/** Actual owner only. No map, registry or projection is fabricated by this reader. */
export function actualConsoleHome298(w:World):ActualConsoleHome298|undefined {
 const root=registeredCampaign(w),mapId=registeredMapId(w);
 if(!isSchema298OrLater(Number(w.schemaVersion))||!isSchema298OrLater(Number(root.schemaVersion))||mapId===undefined)return;
 const maps=root.worldMaps;
 if(!maps){
  if(root!==w||mapId!==0||!Array.isArray(w.tiles)||!Array.isArray(w.pawns)||!Array.isArray(w.piles))return;
  return {root,mapId:0,body:w};
 }
 const record=maps.sites.find(s=>s.id===mapId),body=mapId===maps.rootMapId&&'tiles'in root?root:record?.map;
 if(!record||record.kind!=='settlement'||!body||!('pawns'in body)||!('piles'in body)||w.pawns!==body.pawns||w.piles!==body.piles)return;
 return {root,mapId,body,record};
}
export function consoleSpot298(s:Structure):Cell {return s.orientation===0?{x:s.x,z:s.z+2}:s.orientation===1?{x:s.x+2,z:s.z}:s.orientation===2?{x:s.x,z:s.z-2}:{x:s.x-2,z:s.z};}
/** Neither channel's own contact counts as competing work. */
export function consoleOtherActivity298(w:World,p:Pawn):boolean {
 return !!(p.need||p.jobId!==null||p.orders.active!==null||p.orders.queue.length||p.haul||p.cooking||p.brewing||p.deepWork||p.trade||p.research||p.hunting||p.animalHandling||p.rescue||p.tend||p.feed||p.ward||p.surgery||p.animalCare||p.animalFeed||p.animalRescue||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.shooting||p.melee||p.tactics||p.flee||p.heatRefuge||p.bombRefuge||p.recreation.task||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id));
}
/** Contact capability only. Social skill/disabled work belongs to a specific
 * offer, not Building_CommsConsole.CanUseCommsNow. Draft/mental/forced-job
 * interruption remains the caller's separately audited admission policy. */
export function consoleNegotiatorReason298(w:World,p:Pawn):string|undefined {
 if(!w.pawns.includes(p)||!isColonist(p)||p.prisoner||p.visitor||p.raid||p.podRescue||p.health?.death||['dead','downed','sleeping'].includes(p.state)||carrierOf(w,p.id))return 'Négociateur contrôlable et présent requis.';
 const body=pawnBody(p);
 if(!body.canBeAwake)return 'Le négociateur doit être éveillé.';
 if(body.capacities.talking<=0)return 'Le négociateur doit pouvoir parler.';
}
export function consolePhysicalReason298(w:World,p:Pawn,console:Structure,participantChecked=false):string|undefined {
 if(!participantChecked){const reason=consoleNegotiatorReason298(w,p);if(reason)return reason;}
 if(console.kind!=='comms-console'||!w.structures.includes(console))return 'Console de communication introuvable.';
 const core=frontierCore297(w);
 if(electricityDisabledAtCore(w,core))return 'Les communications électriques sont désactivées.';
 if(!isPowerActive(console)||empStructureActive(console,core))return 'La console n’est pas alimentée.';
 const spot=consoleSpot298(console);if(!canStandAt(w,spot))return 'La cellule de contact est inaccessible.';
 if(w.pawns.some(q=>q!==p&&(q.orbitalTrade?.consoleId===console.id||factionCommsTask298(q)?.consoleId===console.id))||reservedServiceCells(w,p.id).has(spot.z*w.width+spot.x))return 'La console est déjà réservée.';
}
export interface ConsoleContactTask298 {consoleId:number;spot:Cell;phase:'approach'|'ready'}
/** Existing authoritative physical reader. Unpaid edges cannot become contact
 * because raw x/z may already be their nextCell. Root must preserve297 in298. */
function physicalConsoleCell298(w:World,p:Pawn,core:number):Cell {return combatCell297(Number(w.schemaVersion),p,core);}
export function advanceConsoleContact298(w:World,p:Pawn,task:ConsoleContactTask298,ctx:NeedContext):void {
 const core=frontierCore297(w);
 if(p.moveCooldown>0||(p.motion?.end??0)*10>core||(p.stun?.untilCore??0)>core)return;
 const cell=physicalConsoleCell298(w,p,core);
 if(cell.x!==task.spot.x||cell.z!==task.spot.z){task.phase='approach';ctx.move(task.spot,true);return;}
 task.phase='ready';p.path=[];p.state='idle';
}
/** Physical arrival only: phase ready is an effect, never its own premise. */
export function paidConsoleCell298(w:World,p:Pawn,task:ConsoleContactTask298):boolean {
 const core=frontierCore297(w),cell=physicalConsoleCell298(w,p,core);
 return cell.x===task.spot.x&&cell.z===task.spot.z&&!p.path.length&&p.moveCooldown===0&&(p.motion?.end??0)*10<=core&&(p.stun?.untilCore??0)<=core;
}
export function settledConsoleContact298(w:World,p:Pawn,task:ConsoleContactTask298):boolean {
 return task.phase==='ready'&&paidConsoleCell298(w,p,task);
}