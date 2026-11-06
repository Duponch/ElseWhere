import {factionCommsTask298} from './faction-comms-state-298.ts';
import { blockedCells,inBounds } from './pathfinding.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
import { footprintCells } from './definitions.ts';
import { isPassageDoor } from './door-rules.ts';
import { isPowerActive } from './power-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { carrierOf } from './rescue-state.ts';
import { negotiatorRefusal,tradeImprovement } from './trade-negotiator.ts';
import { tradeCatalogueEntry } from './trade-catalogue.ts';
import { roundTradeSilver,tradeUnitPrice } from './trade-prices.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { reservedSource } from './materials.ts';
import { orbitalBeerCatalogue265,orbitalNovelCatalogue295,ORBITAL_STOCK } from './orbital-stock.ts';
import type { TradeGood } from './trade-goods.ts';
import type { TradeLine } from './trade-state.ts';
import type { OrbitalShip } from './orbital-state.ts';
import type { Cell,MaterialPile,Pawn,Structure,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export function orbitalConsoleSpot(s:Structure):Cell {return s.orientation===0?{x:s.x,z:s.z+2}:s.orientation===1?{x:s.x+2,z:s.z}:s.orientation===2?{x:s.x,z:s.z-2}:{x:s.x-2,z:s.z};}
export function orbitalPoweredBeacon(w:World):boolean {return w.structures.some(s=>s.kind==='orbital-beacon'&&isPowerActive(s));}
/** Local connected topology replaces Core regions. Doors are barriers even open;
 * roofing and storage designations do not affect launchable ground things. */
export function orbitalCoverage(w:World):Set<number> {
  const result=new Set<number>(),blocked=blockedCells(w,true);
  for(const s of w.structures)if(isPassageDoor(s.kind))for(const c of footprintCells(s))blocked[c.z*w.width+c.x]=1;
  for(const beacon of w.structures){
    if(beacon.kind!=='orbital-beacon'||!isPowerActive(beacon))continue;
    const origin=beacon.z*w.width+beacon.x;if(blocked[origin])continue;
    const queue=[origin],seen=new Set(queue);
    for(let i=0;i<queue.length;i++){
      const key=queue[i]!,x=key%w.width,z=Math.floor(key/w.width);
      if((x-beacon.x)**2+(z-beacon.z)**2<=7.9**2)result.add(key);
      for(const [dx,dz] of [[0,-1],[1,0],[0,1],[-1,0]]){const nx=x+dx!,nz=z+dz!,next=nz*w.width+nx;
        if(inBounds(w,nx,nz)&&(nx-beacon.x)**2+(nz-beacon.z)**2<=7.9**2&&!blocked[next]&&!seen.has(next)){seen.add(next);queue.push(next);}}
    }
  }
  return result;
}
export function orbitalTradeReason(w:World,p:Pawn,ship:OrbitalShip,console?:Structure):string|undefined {
  if(w.schemaVersion<216||!w.orbital)return 'Le commerce orbital n’est pas encore adopté.';
  if(!w.orbital.ships.includes(ship)||w.tick>=ship.departAt)return 'Le vaisseau a quitté l’orbite.';
  const reason=negotiatorRefusal(p);if(reason)return reason;
  if(!w.pawns.includes(p)||p.state==='dead'||p.state==='downed'||p.state==='sleeping'||p.flee||carrierOf(w,p.id)||p.hunger<=24||p.rest<=15)return 'Négociateur indisponible.';
  if(!orbitalPoweredBeacon(w))return 'Une balise orbitale alimentée est nécessaire.';
  console??=structureById(w,p.orbitalTrade?.consoleId);
  if(!console||console.kind!=='comms-console'||!w.structures.includes(console))return 'Console de communication introuvable.';
  const areaReason=allowedAreaReason(w,p,console);if(areaReason)return areaReason;
  if(!isPowerActive(console))return 'La console n’est pas alimentée.';
  if(w.jobs.some(j=>(j.kind==='deconstruct'||j.kind==='uninstall')&&(j.deconstruction?.structureId??j.furniture?.structureId)===console.id))return 'Retrait de la console demandé.';
  if(w.fires?.items.some(f=>footprintCells(console!).some(c=>c.x===f.x&&c.z===f.z)))return 'La console est en feu.';
  const spot=orbitalConsoleSpot(console);
  if(!canStandAt(w,spot))return 'La cellule de contact est inaccessible.';
  if(w.pawns.some(q=>q!==p&&(q.orbitalTrade?.consoleId===console.id||q.orbitalTrade?.shipId===ship.id||factionCommsTask298(q)?.consoleId===console.id))||reservedServiceCells(w,p.id).has(spot.z*w.width+spot.x))return 'La console ou le vaisseau est déjà réservé.';
}
export function orbitalAtContact(w:World,p:Pawn,ship:OrbitalShip):boolean {
  const task=p.orbitalTrade;
  if(!task||task.shipId!==ship.id||task.phase!=='ready'||orbitalTradeReason(w,p,ship))return false;
  const s=structureById(w,task.consoleId)!,spot=orbitalConsoleSpot(s);
  return task.spot.x===spot.x&&task.spot.z===spot.z&&p.x===spot.x&&p.z===spot.z&&!p.path.length&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick&&(p.stun?.untilCore??0)<=w.tick*10
    &&!orbitalOtherActivity(w,p);
}
export function orbitalOtherActivity(w:World,p:Pawn):boolean {return !!(factionCommsTask298(p)||p.need||p.jobId!==null||p.orders.active!==null||p.orders.queue.length||p.haul||p.cooking||p.brewing||p.deepWork||p.trade||p.research||p.hunting||p.animalHandling||p.rescue||p.tend||p.feed||p.ward||p.surgery||p.animalCare||p.animalFeed||p.animalRescue||p.equipmentTask||p.burial||p.cleaning||p.firefighting||p.shooting||p.melee||p.tactics||p.flee||p.heatRefuge||p.bombRefuge||p.recreation.task||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id));}
export const ORBITAL_BULK_EXTRAS=new Set(['light-leather','muffalo-wool','foxfur','berries','rice','potato','corn','hare-meat','red-fox-meat','survival-meal']);
export function orbitalItemRefusal(pile:MaterialPile,side:'buy'|'sell',w:World,ship:OrbitalShip):string|undefined {
  const e=tradeCatalogueEntry(pile.item);
  if(!e||pile.quantity<=0||ticksUntilRot(pile,w.tick)<=0)return 'Objet indisponible ou sans profil commercial.';
  if(pile.kind==='weapon'||pile.kind==='apparel'||pile.unfinished||pile.corpse||pile.humanCorpse||pile.mechCorpse)return 'Ce profil orbital ne commerce pas cet objet.';
  if(side==='sell'&&!e.playerCanSell||side==='buy'&&!e.playerCanBuy)return 'Cet objet ne peut pas être échangé dans ce sens.';
  if(!orbitalNovelCatalogue295(w.schemaVersion,ship.kind,pile.item)&&!orbitalBeerCatalogue265(w.schemaVersion,ship.kind,pile.item)&&!ORBITAL_STOCK[ship.kind].some(([item])=>item===pile.item)&&!(side==='sell'&&ship.kind==='bulk'&&ORBITAL_BULK_EXTRAS.has(pile.item)))return 'Ce profil orbital ne commerce pas cette catégorie.';
}
export function orbitalTradeGoods(w:World,p:Pawn,ship:OrbitalShip):{goods:TradeGood[];silver:MaterialPile[];merchantSilver:MaterialPile[]} {
  const covered=orbitalCoverage(w),improvement=tradeImprovement(p),goods:TradeGood[]=[],silver:MaterialPile[]=[],merchantSilver:MaterialPile[]=[];
  for(const pile of w.piles){const o=pile.owner,held=o.type==='orbital-ship'&&o.shipId===ship.id,ground=o.type==='ground'&&covered.has(o.z*w.width+o.x);if(!held&&!ground)continue;
    const available=held?pile.quantity:Math.max(0,pile.quantity-reservedSource(w,pile.id));if(!available)continue;
    if(pile.item==='silver'){(held?merchantSilver:silver).push({...pile,quantity:available});continue;}
    const side=held?'buy':'sell',unitPrice=tradeUnitPrice(pile,side,improvement),refusal=orbitalItemRefusal(pile,side,w,ship)??(unitPrice===undefined?'Objet non négociable.':undefined);
    goods.push({pile,side,available,unitPrice:unitPrice??0,...refusal?{refusal}:{}});
  }
  return {goods,silver,merchantSilver};
}
export function quoteOrbitalTrade(w:World,pawnId:number,shipId:number,lines:TradeLine[]) {
  const fail=(reason:string)=>({ok:false as const,reason}),p=w.pawns.find(p=>p.id===pawnId),ship=w.orbital?.ships.find(s=>s.id===shipId);
  if(!p||!ship||!orbitalAtContact(w,p,ship))return fail('Le négociateur doit rejoindre la console alimentée et rester disponible.');
  if(!Array.isArray(lines)||!lines.length||lines.length>128||lines.some(l=>!l||Object.keys(l).some(k=>!['pileId','quantity'].includes(k))||!('pileId' in l)||!Number.isSafeInteger(l.pileId)||!Number.isSafeInteger(l.quantity)||l.quantity===0||Math.abs(l.quantity)>250000)||new Set(lines.map(l=>l.pileId)).size!==lines.length)return fail('Panier orbital invalide.');
  const stock=orbitalTradeGoods(w,p,ship),selected:{good:TradeGood;quantity:number}[]=[];let net=0;
  for(const line of lines){const good=stock.goods.find(g=>g.pile.id===line.pileId);
    if(!good||good.refusal||Math.abs(line.quantity)>good.available||(line.quantity>0)!==(good.side==='buy'))return fail(good?.refusal??'Le stock ou une réservation a changé.');
    selected.push({good,quantity:line.quantity});net+=line.quantity*good.unitPrice;}
  net=roundTradeSilver(net);if(!Number.isSafeInteger(net))return fail('Le montant dépasse les limites du commerce.');
  const silver=stock.silver.reduce((n,p)=>n+p.quantity,0),merchantSilver=stock.merchantSilver.reduce((n,p)=>n+p.quantity,0);
  if(net>silver)return fail('La colonie ne dispose pas d’assez d’argent couvert par les balises.');
  const forgone=Math.max(0,-net-merchantSilver),paid=Math.max(net,-merchantSilver);
  const signature=JSON.stringify([pawnId,shipId,p.orbitalTrade!.consoleId,selected.map(({good:g,quantity})=>[g.pile.id,g.pile.item,g.available,quantity,g.unitPrice,g.pile.damage,g.pile.rot,g.pile.foodPoison,...g.pile.book?[g.pile.book]:[]]),stock.silver.map(s=>[s.id,s.quantity]),stock.merchantSilver.map(s=>[s.id,s.quantity]),net,forgone]);
  return {ok:true as const,p,ship,stock,selected,net,paid,forgone,signature};
}
