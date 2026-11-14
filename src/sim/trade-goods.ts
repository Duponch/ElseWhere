import { storageCells } from './shelf-storage.ts';
import { tradeImprovement } from './trade-negotiator.ts';
export { tradeImprovement } from './trade-negotiator.ts';
import { reservedSource } from './materials.ts';
import { adjacent,blockedCells,reachableCells,routeToJob } from './pathfinding.ts';
import { sculptureTradeUnitPrice,tradeRefusal,tradeUnitPrice } from './trade-prices.ts';
import { isSculptureKind } from './furniture-stats.ts';
import { structureRoomMarketValue } from './room-market-value.ts';
import { tradingAtContact } from './trade-contact.ts';
import type { MaterialPile,Pawn,World } from './types.ts';
import type { PackedFurniture } from './furniture-rules.ts';
import type { TradeLine } from './trade-state.ts';

export interface TradeGood { pile:MaterialPile; side:'buy'|'sell'; available:number; unitPrice:number; refusal?:string }
export interface PackedTradeGood { packed:PackedFurniture; side:'buy'|'sell'; available:1; unitPrice:number }

export function tradeGoods(w:World,p:Pawn,t:Pawn):{goods:TradeGood[];artGoods:PackedTradeGood[];silver:MaterialPile[];merchantSilver:MaterialPile[]} {
  const improvement=tradeImprovement(p),goods:TradeGood[]=[],artGoods:PackedTradeGood[]=[],silver:MaterialPile[]=[],merchantSilver:MaterialPile[]=[];
  const home=new Set(w.home??[]),zones=new Set(storageCells(w).map(z=>z.z*w.width+z.x));
  let reach:ReturnType<typeof reachableCells>|undefined;
  for(const pile of w.piles) {
    const held=pile.owner.type==='inventory'&&pile.owner.pawnId===t.id&&!t.visitor?.personalFoodIds.includes(pile.id);
    const o=pile.owner,colonial=o.type==='ground'&&(home.has(o.z*w.width+o.x)||zones.has(o.z*w.width+o.x));
    if(!held&&!colonial)continue;
    const available=held?pile.quantity:Math.max(0,pile.quantity-reservedSource(w,pile.id));
    if(!available)continue;
    if(colonial&&o.type==='ground'&&!adjacent(t,o)){
      reach??=reachableCells(w,t,blockedCells(w),new Set());
      if(routeToJob(w,o,reach,true)===null)continue;
    }
    if(pile.item==='silver'){(held?merchantSilver:silver).push({...pile,quantity:available});continue;}
    const side=held?'buy':'sell',refusal=tradeRefusal(pile,side,w.tick,t.visitor?.merchantKind,'visitor',w.schemaVersion),unitPrice=tradeUnitPrice(pile,side,improvement);
    goods.push({pile,side,available,unitPrice:unitPrice??0,...refusal?{refusal}:unitPrice===undefined?{refusal:'Objet non négociable.'}:{}});
  }
  for(const packed of w.packed) {
    const b=packed.building,o=packed.owner;
    if(!isSculptureKind(b.kind)||!b.art)continue;
    const held=o.type==='inventory'&&o.pawnId===t.id;
    const colonial=o.type==='ground'&&(home.has(o.z*w.width+o.x)||zones.has(o.z*w.width+o.x));
    if(!held&&!colonial||reservedSource(w,b.id)>0||w.jobs.some(j=>j.furniture?.structureId===b.id))continue;
    if(colonial&&o.type==='ground'&&!adjacent(t,o)){
      reach??=reachableCells(w,t,blockedCells(w),new Set());
      if(routeToJob(w,o,reach,true)===null)continue;
    }
    const side=held?'buy':'sell',unitPrice=sculptureTradeUnitPrice(structureRoomMarketValue(b),side,improvement);
    if(unitPrice!==undefined)artGoods.push({packed,side,available:1,unitPrice});
  }
  return {goods,artGoods,silver,merchantSilver};
}
export const roundTradeBalance=(n:number):number=>{const low=Math.floor(n);return n-low===.5?low+Math.abs(low%2):Math.round(n);};
export function quoteTrade(w:World,pawnId:number,traderId:number,lines:TradeLine[]) {
  const reject=(reason:string)=>({ok:false as const,reason});
  const p=w.pawns.find(p=>p.id===pawnId),t=w.pawns.find(p=>p.id===traderId);
  if(!p||!t||!tradingAtContact(w,p,t))return reject('Le négociateur doit rejoindre le marchand et rester disponible.');
  if(!Array.isArray(lines)||!lines.length||lines.length>128
    ||lines.some(l=>!l||!Number.isSafeInteger(l.quantity)||l.quantity===0||Math.abs(l.quantity)>250000
      ||('pileId' in l?Object.keys(l).some(k=>!['pileId','quantity'].includes(k))||!Number.isSafeInteger(l.pileId):Object.keys(l).some(k=>!['packedId','quantity'].includes(k))||!Number.isSafeInteger(l.packedId)||Math.abs(l.quantity)!==1))
    ||new Set(lines.map(l=>'pileId' in l?`pile:${l.pileId}`:`packed:${l.packedId}`)).size!==lines.length)return reject('Panier invalide.');
  const stock=tradeGoods(w,p,t),selected: {good:TradeGood;quantity:number}[]=[],selectedArt:{good:PackedTradeGood;quantity:1|-1}[]=[];
  let net=0;
  for(const line of lines){
    if('pileId' in line){
      const g=stock.goods.find(g=>g.pile.id===line.pileId);
      if(!g||g.refusal||Math.abs(line.quantity)>g.available||(line.quantity>0)!==(g.side==='buy'))return reject(g?.refusal??'Le stock ou une réservation a changé.');
      selected.push({good:g,quantity:line.quantity});net+=line.quantity*g.unitPrice;
    }else{
      const g=stock.artGoods.find(g=>g.packed.building.id===line.packedId);
      if(!g||(line.quantity>0)!==(g.side==='buy'))return reject('La sculpture n’est plus disponible.');
      selectedArt.push({good:g,quantity:line.quantity as 1|-1});net+=line.quantity*g.unitPrice;
    }
  }
  net=roundTradeBalance(net);
  const silver=stock.silver.reduce((n,x)=>n+x.quantity,0),merchantSilver=stock.merchantSilver.reduce((n,x)=>n+x.quantity,0);
  if(!Number.isSafeInteger(net))return reject('Le montant dépasse les limites du commerce.');
  if(net>silver)return reject('La colonie ne dispose pas d’assez d’argent accessible dans son foyer ou ses réserves.');
  const forgone=Math.max(0,-net-merchantSilver),paid=Math.max(net,-merchantSilver);
  // Only the participating quantities, condition, capacity-derived prices and
  // available currency form the quote. Unrelated ticks do not stale a basket.
  const signature=JSON.stringify([pawnId,traderId,t.visitor?.group,selected.map(({good:g,quantity})=>[g.pile.id,g.pile.item,g.available,quantity,g.unitPrice,g.pile.weapon,g.pile.apparel,g.pile.damage]),
    selectedArt.map(({good:g,quantity})=>{const b=g.packed.building;return [b.id,b.kind,b.material,b.quality,b.damage??0,b.art?.authorId,b.art?.createdAt,g.packed.owner,quantity,g.unitPrice];}),
    stock.silver.map(s=>[s.id,s.quantity]),stock.merchantSilver.map(s=>[s.id,s.quantity]),net,forgone]);
  return {ok:true as const,p,t,stock,selected,selectedArt,net,paid,forgone,signature};
}
