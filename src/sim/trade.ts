import {assignPileOwner} from './pile-index.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { copyPileCondition } from './pile-condition.ts';
import { groundCapacity,nearbyGround } from './ground-placement.ts';
import { furnitureDropCell } from './furniture-transfer.ts';
import { refreshStock,transferPile } from './materials.ts';
import { orderTrade } from './trade-contact.ts';
import { quoteTrade } from './trade-goods.ts';
import { enableVisitors } from './visitors.ts';
import type { TradeCommand,TradeLedger,TradeReceipt } from './trade-state.ts';
import type { CommandResult,MaterialOwner,MaterialPile,World } from './types.ts';

const emptyLedger=():TradeLedger=>({count:0,silverPaid:0,silverReceived:0,forgone:0,bought:{},sold:{},artBought:{},artSold:{},recent:[]});
/** Split without refreshing age, rolling quality or turning goods into cargo. */
function take(w:World,id:number,quantity:number):MaterialPile|null {
  const pile=w.piles.find(p=>p.id===id);if(!pile||quantity<=0||quantity>pile.quantity)return null;
  if(quantity===pile.quantity)return pile;
  if(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))return null;
  pile.quantity-=quantity;
  const part={...pile,id:w.nextId++,quantity,owner:{...pile.owner},...copyPileCondition(pile)};w.piles.push(part);return part;
}
function move(w:World,id:number,quantity:number,owner:MaterialOwner):boolean {
  const part=take(w,id,quantity);if(!part)return false;
  if(owner.type!=='ground'){assignPileOwner(part,owner);return true;}
  return transferPile(w,part,owner);
}
function purchase(w:World,id:number,quantity:number,origin:{x:number;z:number}):boolean {
  const pile=w.piles.find(p=>p.id===id);if(!pile)return false;
  // Earlier goods already occupy the draft, so every deposit is planned as one
  // basket. A failed last item cannot commit the first one or its payment.
  for(const cell of nearbyGround(w,origin)){
    const count=Math.min(quantity,groundCapacity(w,cell,pile));
    if(count>0){if(!move(w,id,count,{type:'ground',...cell}))return false;quantity-=count;}
    if(!quantity)return true;
  }
  return false;
}
export function applyTrade(w:World,c:TradeCommand):CommandResult {
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(c.type==='enable-visitors'){enableVisitors(w);return {ok:true};}
  if(c.type==='order-trade')return orderTrade(w,c.pawnId,c.traderId);
  if(c.type==='cancel-trade'){
    const p=w.pawns.find(p=>p.id===c.pawnId);if(!p)return fail('Négociateur introuvable.');
    if(p.trade){delete p.trade;p.path=[];p.state='idle';p.planCooldown=0;}return {ok:true};
  }
  if(typeof c.acceptShortfall!=='boolean'||typeof c.quote!=='string')return fail('Confirmation du panier invalide.');
  const q=quoteTrade(w,c.pawnId,c.traderId,c.lines);if(!q.ok)return fail(q.reason);
  if(q.signature!==c.quote)return fail('Le panier a changé. Vérifiez de nouveau les prix et quantités.');
  if(q.forgone&&!c.acceptShortfall)return fail(`Le marchand manque de ${q.forgone} argent. Acceptez explicitement cette perte ou réduisez les ventes.`);
  const draft:World={...w,piles:w.piles.map(p=>({...p,owner:{...p.owner},...copyPileCondition(p)})),packed:q.selectedArt.length?structuredClone(w.packed):w.packed,jobs:w.jobs.map(j=>({...j,escrow:{...j.escrow}})),trade:structuredClone(w.trade??emptyLedger())};
  const ledger=draft.trade!,receipt:TradeReceipt={tick:w.tick,negotiatorId:q.p.id,traderId:q.t.id,silver:q.paid,forgone:q.forgone,lines:[]};
  for(const {good,quantity} of q.selected)if(quantity<0&&!move(draft,good.pile.id,-quantity,{type:'inventory',pawnId:q.t.id}))return fail('Stock de vente indisponible.');
  for(const {good,quantity} of q.selectedArt)if(quantity<0){
    const pack=draft.packed.find(x=>x.building.id===good.packed.building.id);
    if(!pack||pack.owner.type!=='ground')return fail('Sculpture de vente indisponible.');
    assignPileOwner(pack,{type:'inventory',pawnId:q.t.id});
  }
  for(const {good,quantity} of q.selected)if(quantity>0&&!purchase(draft,good.pile.id,quantity,q.p))return fail('Sol encombré : aucune transaction n’a été effectuée.');
  for(const {good,quantity} of q.selectedArt)if(quantity>0){
    const pack=draft.packed.find(x=>x.building.id===good.packed.building.id);
    if(!pack||pack.owner.type!=='inventory'||pack.owner.pawnId!==q.t.id)return fail('Sculpture à acheter indisponible.');
    const cell=furnitureDropCell(draft,q.p);
    if(!cell)return fail('Sol encombré : aucune transaction n’a été effectuée.');
    assignPileOwner(pack,{type:'ground',...cell});
  }
  let money=Math.abs(q.paid);
  for(const s of q.paid>=0?q.stock.silver:q.stock.merchantSilver){
    const n=Math.min(money,s.quantity);if(!n)continue;
    if(q.paid>=0?!move(draft,s.id,n,{type:'inventory',pawnId:q.t.id}):!purchase(draft,s.id,n,q.p))return fail('Impossible de transférer physiquement l’argent.');
    money-=n;if(!money)break;
  }
  if(money)return fail('L’argent n’est plus disponible.');
  ledger.count++;ledger.silverPaid+=Math.max(0,q.paid);ledger.silverReceived+=Math.max(0,-q.paid);ledger.forgone+=q.forgone;
  for(const {good,quantity} of q.selected){const target=quantity>0?ledger.bought:ledger.sold,item=good.pile.item;target[item]=(target[item]??0)+Math.abs(quantity);receipt.lines.push({item,quantity,unitPrice:good.unitPrice});}
  for(const {good,quantity} of q.selectedArt){
    const b=good.packed.building,kind=b.kind;
    if(kind!=='small-sculpture'&&kind!=='large-sculpture'||!b.material||!b.quality||!b.art)return fail('Sculpture invalide.');
    const target=quantity>0?(ledger.artBought??={}):(ledger.artSold??={});target[kind]=(target[kind]??0)+1;
    receipt.lines.push({packedId:b.id,kind,material:b.material as import('./art-rules.ts').ArtMaterial,quality:b.quality,damage:b.damage??0,art:{...b.art},quantity,unitPrice:good.unitPrice});
  }
  if([ledger.count,ledger.silverPaid,ledger.silverReceived,ledger.forgone,...Object.values(ledger.bought),...Object.values(ledger.sold),...Object.values(ledger.artBought??{}),...Object.values(ledger.artSold??{})].some(n=>!Number.isSafeInteger(n)||n<0))return fail('Compteurs du commerce hors limites.');
  if(draft.piles.length>32768||draft.piles.some(p=>p.quantity>ITEM_DEFINITIONS[p.item].stackLimit))return fail('Capacité physique dépassée.');
  ledger.recent.push(receipt);if(ledger.recent.length>80)ledger.recent.shift();
  w.piles=draft.piles;w.packed=draft.packed;w.nextId=draft.nextId;w.trade=ledger;refreshStock(w);
  delete q.p.trade;q.p.path=[];q.p.state='idle';q.p.planCooldown=0;
  w.events.push({tick:w.tick,type:'command',message:`${q.p.name} a conclu un échange avec ${q.t.name} (${q.paid>=0?q.paid+' argent payé':-q.paid+' argent reçu'}).`});if(w.events.length>80)w.events.shift();
  return {ok:true};
}
