import { isColonist } from './affiliation.ts';
import { isPowerActive } from './power-rules.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { blockedCells,reachableCells,routeToCell } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { refreshStock } from './materials.ts';
import { orbitalConsoleSpot,orbitalTradeReason,orbitalOtherActivity,quoteOrbitalTrade } from './orbital-rules.ts';
import { orbitalRandom,orbitalStock } from './orbital-stock.ts';
import { orbitalDeposit,orbitalDraftPiles,orbitalLandingCells,orbitalLandingFree,orbitalTake } from './orbital-transfer.ts';
import { ORBITAL_ACTIVE_CHECKS,ORBITAL_CHECK,ORBITAL_CYCLE,ORBITAL_DELIVERY_LIMIT,ORBITAL_FALL_TICKS,ORBITAL_LIFETIME,ORBITAL_OPEN_TICKS,ORBITAL_SHIP_LIMIT,type OrbitalCommand,type OrbitalKind,type OrbitalShip } from './orbital-state.ts';
import type { TradeLedger,TradeReceipt } from './trade-state.ts';
import type { NeedContext } from './needs.ts';
import type { CommandResult,Pawn,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

function emit(w:World,message:string):void {w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
export function adoptOrbital(w:World):void {
  if(w.schemaVersion<216||w.orbital)return;
  const next=(Math.floor(w.tick/ORBITAL_CHECK)+1)*ORBITAL_CHECK;
  if(!Number.isSafeInteger(next+ORBITAL_CYCLE+ORBITAL_LIFETIME))return;
  const state={profile:'orbital-v1' as const,adoptedAt:w.tick,rng:((w.seed^0x2810b171)>>>0)||1,cycleStart:next,scheduledAt:next,nextCheckAt:next,ships:[],pending:[]};
  state.scheduledAt+=Math.floor(orbitalRandom(state)*ORBITAL_ACTIVE_CHECKS)*ORBITAL_CHECK;w.orbital=state;
}
export function createOrbitalShip(w:World,kind:OrbitalKind):OrbitalShip|undefined {
  adoptOrbital(w);const state=w.orbital;
  if(!state||!['bulk','exotic'].includes(kind)||state.ships.length>=ORBITAL_SHIP_LIMIT||!Number.isSafeInteger(w.tick+ORBITAL_LIFETIME)||!Number.isSafeInteger(w.nextId+1))return;
  const draft={...w,nextId:w.nextId+1},rng={rng:state.rng},ship:OrbitalShip={id:w.nextId,kind,name:kind==='bulk'?'Marchand orbital de gros':'Marchand orbital exotique',arrivedAt:w.tick,departAt:w.tick+ORBITAL_LIFETIME,announced:w.structures.some(s=>s.kind==='comms-console'&&isPowerActive(s))};
  const piles=orbitalStock(draft,ship,rng);
  if(w.piles.length+piles.length>32768||!Number.isSafeInteger(draft.nextId))return;
  w.nextId=draft.nextId;state.rng=rng.rng;state.ships.push(ship);w.piles.push(...piles);
  if(ship.announced)emit(w,`${ship.name} est en orbite pour 4000 ticks.`);return ship;
}
function stop(w:World,p:Pawn):void {if(!releaseWork(w,p))interruptWork(w,p);delete p.orbitalTrade;p.path=[];p.planCooldown=0;if(!['dead','downed','sleeping'].includes(p.state))p.state=(p.motion?.end??0)>w.tick?'moving':'idle';}
export function reconcileOrbitalTrade(w:World,p:Pawn):boolean {
  const task=p.orbitalTrade;if(!task)return false;
  const ship=w.orbital?.ships.find(s=>s.id===task.shipId),console=structureById(w,task.consoleId),spot=console&&orbitalConsoleSpot(console);
  if(!ship||!console||orbitalTradeReason(w,p,ship,console)||!spot||spot.x!==task.spot.x||spot.z!==task.spot.z||orbitalOtherActivity(w,p)){stop(w,p);return false;}
  return true;
}
export function processOrbitalTrade(w:World,p:Pawn,ctx:NeedContext):boolean {
  if(!reconcileOrbitalTrade(w,p))return false;const task=p.orbitalTrade!;
  if(p.moveCooldown>0||(p.motion?.end??0)>w.tick||(p.stun?.untilCore??0)>w.tick*10)return true;
  if(p.x!==task.spot.x||p.z!==task.spot.z){task.phase='approach';ctx.move(task.spot,true);return true;}
  task.phase='ready';p.path=[];p.state='idle';return true;
}
export function orderOrbitalTrade(w:World,pawnId:number,shipId:number,consoleId:number):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason}),p=w.pawns.find(p=>p.id===pawnId),ship=w.orbital?.ships.find(s=>s.id===shipId),console=structureById(w,consoleId);
  if(!p||!ship||!console)return fail('Négociateur, vaisseau ou console introuvable.');
  const reason=orbitalTradeReason(w,p,ship,console);if(reason)return fail(reason);
  const spot=orbitalConsoleSpot(console),path=routeToCell(w,spot,reachableCells(w,p,blockedCells(w),new Set()));if(!path)return fail('Console inaccessible.');
  const drops=planCommandDrops(w,{type:'order-orbital-trade',pawnId,shipId,consoleId});if(!drops||!releaseWork(w,p,drops))return fail('Pas de place pour déposer la cargaison.');
  clearQueuedOrders(w,p);delete p.priorityWork;p.orbitalTrade={shipId,consoleId,spot,phase:'approach',startedAt:w.tick};p.path=path;p.state='moving';p.planCooldown=0;return {ok:true};
}
export function advanceOrbital(w:World):void {
  const state=w.orbital;if(!state)return;
  const leaving=new Set(state.ships.filter(s=>w.tick>=s.departAt).map(s=>s.id));
  if(leaving.size){for(const ship of state.ships)if(leaving.has(ship.id)&&ship.announced)emit(w,`${ship.name} quitte définitivement l’orbite.`);
    state.ships=state.ships.filter(s=>!leaving.has(s.id));w.piles=w.piles.filter(p=>p.owner.type!=='orbital-ship'||!leaving.has(p.owner.shipId));
    for(const p of w.pawns)if(p.orbitalTrade&&leaving.has(p.orbitalTrade.shipId))stop(w,p);}
  if(w.structures.some(s=>s.kind==='comms-console'&&isPowerActive(s)))for(const ship of state.ships)if(!ship.announced){ship.announced=true;emit(w,`${ship.name} est détecté en orbite.`);}
  for(const delivery of [...state.pending])if(w.tick>=delivery.openAt){
    // Exclude this capsule from occupancy only; every other delivery retains its cell.
    const check={...w,orbital:{...state,pending:state.pending.filter(p=>p!==delivery)}};
    if(!orbitalLandingFree(check,delivery.cell))continue;
    const draft:World={...w,piles:orbitalDraftPiles(w),jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}}))};
    if(!orbitalDeposit(draft,delivery.id,delivery.cell))continue;
    w.piles=draft.piles;w.nextId=draft.nextId;state.pending=state.pending.filter(p=>p!==delivery);refreshStock(w);emit(w,'Une capsule orbitale s’ouvre : sa cargaison est déposée au sol.');
  }
  if(w.tick<state.nextCheckAt)return;
  state.nextCheckAt=(Math.floor(w.tick/ORBITAL_CHECK)+1)*ORBITAL_CHECK;
  while(w.tick>=state.cycleStart+ORBITAL_CYCLE){state.cycleStart+=ORBITAL_CYCLE;state.scheduledAt=state.cycleStart+Math.floor(orbitalRandom(state)*ORBITAL_ACTIVE_CHECKS)*ORBITAL_CHECK;}
  if(w.tick!==state.scheduledAt||!w.gameProfile||!w.pawns.some(p=>isColonist(p)&&p.state!=='dead')||state.ships.length>=ORBITAL_SHIP_LIMIT)return;
  createOrbitalShip(w,orbitalRandom(state)<.5?'bulk':'exotic');
}
const emptyLedger=():TradeLedger=>({count:0,silverPaid:0,silverReceived:0,forgone:0,bought:{},sold:{},recent:[]});
export function applyOrbitalTrade(w:World,c:OrbitalCommand):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(c.type==='order-orbital-trade')return orderOrbitalTrade(w,c.pawnId,c.shipId,c.consoleId);
  if(c.type==='cancel-orbital-trade'){const p=w.pawns.find(p=>p.id===c.pawnId);if(!p)return fail('Négociateur introuvable.');if(p.orbitalTrade)stop(w,p);return {ok:true};}
  if(typeof c.acceptShortfall!=='boolean'||typeof c.quote!=='string')return fail('Confirmation du panier invalide.');
  const q=quoteOrbitalTrade(w,c.pawnId,c.shipId,c.lines);if(!q.ok)return fail(q.reason);
  if(q.signature!==c.quote)return fail('Le panier a changé. Vérifiez de nouveau les prix et quantités.');
  if(q.forgone&&!c.acceptShortfall)return fail(`Le marchand manque de ${q.forgone} argent. Acceptez explicitement cette perte ou réduisez les ventes.`);
  const state=w.orbital!;
  const receives=q.selected.some(l=>l.quantity>0)||q.paid<0;
  if(receives&&(state.pending.length>=ORBITAL_DELIVERY_LIMIT||!Number.isSafeInteger(w.tick+ORBITAL_FALL_TICKS+ORBITAL_OPEN_TICKS)||!Number.isSafeInteger(w.nextId+1)))return fail('Capacité des livraisons dépassée.');
  const draft:World={...w,piles:orbitalDraftPiles(w),jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}})),trade:structuredClone(w.trade??emptyLedger())};
  const deliveryId=receives?draft.nextId++:0,shipOwner={type:'orbital-ship' as const,shipId:q.ship.id},cargoOwner={type:'orbital-cargo' as const,deliveryId};
  for(const {good,quantity} of q.selected)if(!orbitalTake(draft,good.pile.id,Math.abs(quantity),quantity<0?shipOwner:cargoOwner))return fail('Stock de transaction indisponible.');
  let money=Math.abs(q.paid);
  for(const s of q.paid>=0?q.stock.silver:q.stock.merchantSilver){const n=Math.min(money,s.quantity);if(!n)continue;if(!orbitalTake(draft,s.id,n,q.paid>=0?shipOwner:cargoOwner))return fail('Impossible de transférer physiquement l’argent.');money-=n;if(!money)break;}
  if(money)return fail('L’argent n’est plus disponible.');
  let cell:import('./types.ts').Cell|undefined;
  if(receives)for(const candidate of orbitalLandingCells(draft)){
    const preflight:World={...draft,piles:orbitalDraftPiles(draft),jobs:draft.jobs.map(j=>({...j,escrow:{...j.escrow}}))};
    if(orbitalDeposit(preflight,deliveryId,candidate)&&Number.isSafeInteger(preflight.nextId)&&preflight.piles.length<=32768){cell=candidate;break;}
  }
  if(receives&&!cell)return fail('Sol encombré : aucune réception conservatrice, aucune transaction effectuée.');
  const ledger=draft.trade!,receipt:TradeReceipt={tick:w.tick,negotiatorId:q.p.id,traderId:q.ship.id,silver:q.paid,forgone:q.forgone,lines:[]};
  ledger.count++;ledger.silverPaid+=Math.max(0,q.paid);ledger.silverReceived+=Math.max(0,-q.paid);ledger.forgone+=q.forgone;
  for(const {good,quantity} of q.selected){const target=quantity>0?ledger.bought:ledger.sold,item=good.pile.item;target[item]=(target[item]??0)+Math.abs(quantity);receipt.lines.push({item,quantity,unitPrice:good.unitPrice});}
  if([ledger.count,ledger.silverPaid,ledger.silverReceived,ledger.forgone,...Object.values(ledger.bought),...Object.values(ledger.sold)].some(n=>!Number.isSafeInteger(n)||n<0)||!Number.isSafeInteger(draft.nextId)||draft.piles.length>32768||draft.piles.some(p=>p.quantity>ITEM_DEFINITIONS[p.item].stackLimit))return fail('Capacité physique ou compteurs du commerce hors limites.');
  ledger.recent.push(receipt);if(ledger.recent.length>80)ledger.recent.shift();
  w.piles=draft.piles;w.nextId=draft.nextId;w.trade=ledger;
  if(cell)state.pending.push({id:deliveryId,shipId:q.ship.id,negotiatorId:q.p.id,cell,createdAt:w.tick,landAt:w.tick+ORBITAL_FALL_TICKS,openAt:w.tick+ORBITAL_FALL_TICKS+ORBITAL_OPEN_TICKS});
  refreshStock(w);delete q.p.orbitalTrade;q.p.path=[];q.p.state='idle';q.p.planCooldown=0;
  emit(w,`${q.p.name} a conclu un échange avec ${q.ship.name} (${q.paid>=0?q.paid+' argent payé':-q.paid+' argent reçu'}).`);return {ok:true};
}
