import { negotiatorRefusal } from './trade-negotiator.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
export { negotiatorRefusal } from './trade-negotiator.ts';
import { adjacent,blockedCells,reachableCells,routeToJob } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { visitorMayTrade } from './visitors.ts';
import { releaseDraftForTrade338 } from './drafted-negotiator-338.ts';
import {orderedTargetClaimed378} from './order-types.ts';
import type { NeedContext } from './needs.ts';
import type { CommandResult,Pawn,World } from './types.ts';


export function tradingAtContact(w:World,p:Pawn,t:Pawn):boolean {
  return p.trade?.traderId===t.id&&p.trade.phase==='ready'&&!negotiatorRefusal(p,w.schemaVersion)&&visitorMayTrade(w,t)
    &&!allowedAreaReason(w,p,t)&&p.moveCooldown===0&&t.moveCooldown===0&&adjacent(p,t);
}
export function orderTrade(w:World,pawnId:number,traderId:number,preview=false):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  const p=w.pawns.find(p=>p.id===pawnId),t=w.pawns.find(p=>p.id===traderId);
  if(!p||!t||!visitorMayTrade(w,t))return fail('Marchand disponible introuvable.');
  const why=negotiatorRefusal(p,w.schemaVersion);if(why)return fail(why);
  const areaReason=allowedAreaReason(w,p,t);if(areaReason)return fail(areaReason);
  if(orderedTargetClaimed378(w,'pawn',t.id,p.id)||w.pawns.some(other=>other!==p&&other.trade?.traderId===t.id))return fail('Ce marchand est déjà réservé par un négociateur.');
  const path=routeToJob(w,t,reachableCells(w,p,blockedCells(w),new Set()),false);
  if(!path)return fail('Ce marchand est inaccessible.');
  const drops=planCommandDrops(w,{type:'order-trade',pawnId,traderId});
  if(!drops)return fail('Pas de place pour déposer la cargaison.');
  if(preview)return {ok:true};
  if(!releaseWork(w,p,drops))return fail('Pas de place pour déposer la cargaison.');
  clearQueuedOrders(w,p);delete p.priorityWork;releaseDraftForTrade338(w,p);
  p.trade={traderId,phase:'approach',startedAt:w.tick};p.path=path;p.state='moving';p.planCooldown=0;
  return {ok:true};
}
export function processTrade(w:World,p:Pawn,ctx:NeedContext):boolean {
  if(!p.trade)return false;
  const t=w.pawns.find(q=>q.id===p.trade!.traderId);
  if(!t||allowedAreaReason(w,p,t)||!visitorMayTrade(w,t)||negotiatorRefusal(p,w.schemaVersion)||p.hunger<=24||p.rest<=15){delete p.trade;p.path=[];p.state='idle';return false;}
  if(p.moveCooldown===0&&t.moveCooldown===0&&adjacent(p,t)) {p.trade.phase='ready';p.path=[];p.state='idle';}
  else {p.trade.phase='approach';ctx.move(t,false);}
  return true;
}
