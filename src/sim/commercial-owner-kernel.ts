import type {WildAnimal} from './wildlife-state.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {groupItemMassGrams} from './group-freight.ts';
import { COMMERCIAL_MAX_STOCK,COMMERCIAL_RECEIPTS,emptyCommercialTextiles,isCommercialTextile,type CivilianPost,type CommercialBuyLine,type CommercialProduct,type CommercialTextile,type CommercialStockPile } from './commercial-state.ts';
import { validCivilianPostShape } from './commercial-post-rules.ts';
import { commercialItemMassGrams,type CommercialMass } from './commercial-mass.ts';
import { settlementTradeUnitPrice,roundTradeSilver } from './trade-prices.ts';
import { tradeImprovement,negotiatorRefusal } from './trade-negotiator.ts';
import { copyPileCondition } from './pile-condition.ts';
import type { MaterialPile,Pawn } from './types.ts';
export type CommercialDirection='buy'|'sell';
export interface CommercialOwnerContext {
  tick:number;nextId:number;version:number;scope:string;
  additionalInventoryOwners?:readonly WildAnimal[];
  members:readonly Pawn[];negotiator:Pawn;items:readonly MaterialPile[];post:CivilianPost;
  /** Same captured object used by route/overload for this decision phase. */
  mass:CommercialMass;
  /** Internal collective253 freight authority only; never a traded good. */
  groupFreight?:true;
  /** Internal actual collective travel/reorg only, never a saved permission. */
  groupProspective?:true;
  /** Channel-specific contact/baseline/counter authority; quotes bind to it. */
  ledgerStamp:unknown;
  pileCountElsewhere:number;inventoryLimit:number;
}
export interface OwnerGood {pileId:number;item:CommercialProduct|CommercialTextile;available:number;unitPrice:number}
export type OwnerQuote={ok:false;reason:string}|{ok:true;signature:string;direction:CommercialDirection;negotiatorId:number;totalSilver:number;remainingSilver:number;mass:CommercialMass;goods:OwnerGood[];selected:{pileId:number;quantity:number;unitPrice:number}[]};
export interface OwnerTradeDraft {
  items:MaterialPile[];post:CivilianPost;nextId:number;
  bought:{medicine:number;component:number};sold:ReturnType<typeof emptyCommercialTextiles>;
  silverPaid:number;silverEarned:number;
}
const integer=(v:unknown,min=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const reject=(reason:string)=>({ok:false as const,reason});
const product=(v:unknown):v is CommercialProduct=>v==='medicine'||v==='component';
function memberInventory(c:CommercialOwnerContext):MaterialPile[] {
  const ids=new Set([...c.members,...c.additionalInventoryOwners??[]].map(p=>p.id));
  return c.items.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId));
}
/** Price/funds/mass logic shared by V193/V203 and the real group channel.
 * Empty lines expose current prices. No creation, RNG, allocation or adoption. */
export function quoteOwnerTrade(c:CommercialOwnerContext,direction:CommercialDirection,lines:readonly CommercialBuyLine[]):OwnerQuote {
  if(!validCivilianPostShape(c.post,c.tick,c.nextId,c.version)||!c.members.includes(c.negotiator)||new Set(c.members.map(p=>p.id)).size!==c.members.length||c.members.some(p=>p.state==='dead'||p.health?.death))return reject('Propriétaires ou comptoir inadmissibles.');
  if(c.additionalInventoryOwners!==undefined&&(c.version<256||c.groupProspective!==true||new Set([...c.members,...c.additionalInventoryOwners].map(p=>p.id)).size!==c.members.length+c.additionalInventoryOwners.length||c.additionalInventoryOwners.some(a=>a.state==='dead'||a.health?.death)))return reject('Propriétaires animaux commerciaux inadmissibles.');
  const reason=negotiatorRefusal(c.negotiator,c.version);if(reason)return reject(reason);
  if(direction==='sell'&&c.version<185)return reject('La vente de textiles n’est pas disponible dans ce schéma.');
  if(!integer(c.mass.grams)||!integer(c.mass.capacityGrams)||!integer(c.inventoryLimit,1)||!integer(c.pileCountElsewhere))return reject('Masse ou limites commerciales inadmissibles.');
  const limit=direction==='buy'?COMMERCIAL_MAX_STOCK:c.inventoryLimit;
  if(!Array.isArray(lines)||lines.length>limit||lines.some(l=>!object(l)||Object.keys(l).some(k=>k!=='pileId'&&k!=='quantity')||!integer(l.pileId,1)||!integer(l.quantity,1))||new Set(lines.map(l=>l.pileId)).size!==lines.length)return reject(direction==='buy'?'Panier commercial invalide.':'Panier de vente invalide.');
  const inventory=memberInventory(c),source=direction==='buy'?c.post.stock:inventory;
  const improvement=tradeImprovement(c.negotiator),goods:OwnerGood[]=[],selected:Extract<OwnerQuote,{ok:true}>['selected']=[];
  for(const pile of source)if(direction==='buy'?product(pile.item):isCommercialTextile(pile.item)){
    const unitPrice=settlementTradeUnitPrice(pile,direction,improvement);
    if(unitPrice===undefined)return reject(direction==='buy'?'Prix du comptoir indisponible.':'Prix de vente indisponible.');
    goods.push({pileId:pile.id,item:pile.item as OwnerGood['item'],available:pile.quantity,unitPrice});
  }
  let total=0,goodsGrams=0;
  for(const line of lines){
    const good=goods.find(g=>g.pileId===line.pileId),unit=good?commercialItemMassGrams(good.item):undefined;
    if(!good||unit===undefined||line.quantity>good.available)return reject(direction==='buy'?'Le stock du comptoir a changé.':'Le fret porté a changé.');
    total+=good.unitPrice*line.quantity;goodsGrams+=unit*line.quantity;
    selected.push({pileId:line.pileId,quantity:line.quantity,unitPrice:good.unitPrice});
  }
  const totalSilver=roundTradeSilver(total),ownerSilver=inventory.filter(p=>p.item==='silver').reduce((sum,p)=>sum+p.quantity,0);
  const funds=direction==='buy'?ownerSilver:c.post.stock.filter(p=>p.item==='silver').reduce((sum,p)=>sum+p.quantity,0);
  if(!integer(totalSilver)||!integer(ownerSilver)||!integer(funds)||!integer(goodsGrams)||direction==='sell'&&lines.length>0&&totalSilver===0)return reject('Montant commercial hors limites.');
  if(totalSilver>funds)return reject(direction==='buy'?'Le voyageur ne porte pas assez d’argent.':'Le comptoir ne possède pas assez d’argent pour cette vente.');
  const remainingSilver=ownerSilver+(direction==='buy'?-totalSilver:totalSilver);
  const mass={grams:c.mass.grams+(direction==='buy'?1:-1)*(goodsGrams-totalSilver*8),capacityGrams:c.mass.capacityGrams};
  // An empty sale is the catalogue preview, including when a real loss reduced
  // carrying capacity. Every actual basket must still fit after its exchange.
  const salePreview=direction==='sell'&&lines.length===0;
  if(!integer(remainingSilver)||!integer(mass.grams)||!salePreview&&mass.grams>mass.capacityGrams)return reject(direction==='buy'?'Le panier dépasse la charge du voyageur.':'L’argent reçu dépasse la charge du voyageur.');
  const signature=JSON.stringify([c.scope,c.members.map(p=>p.id),c.negotiator.id,c.post,c.items,c.ledgerStamp,c.mass,improvement,direction,selected,totalSilver,mass]);
  return {ok:true,signature,direction,negotiatorId:c.negotiator.id,totalSilver,remainingSilver,mass,goods,selected};
}
/** One ownership move for goods AND silver, independent of buy/sell channel.
 * Whole pile keeps ID. Only a split allocates; refusal never changes originals. */
export function draftOwnerTrade(c:CommercialOwnerContext,q:Extract<OwnerQuote,{ok:true}>):OwnerTradeDraft|null {
  const fresh=quoteOwnerTrade(c,q.direction,q.selected.map(({pileId,quantity})=>({pileId,quantity})));
  if(!fresh.ok||fresh.signature!==q.signature||!q.selected.length)return null;
  const items=structuredClone(c.items) as MaterialPile[],post=structuredClone(c.post);
  const bought={medicine:0,component:0},sold=emptyCommercialTextiles();let nextId=c.nextId;
  const memberIds=new Set([...c.members,...c.additionalInventoryOwners??[]].map(p=>p.id));
  const memberOwnedInventory=(pile:MaterialPile|CommercialStockPile):boolean=>{
    const owner='owner' in pile?pile.owner:undefined;
    return object(owner)&&owner.type==='inventory'&&integer(owner.pawnId,1)&&memberIds.has(owner.pawnId);
  };
  const allocate=()=>integer(nextId,1)&&Number.isSafeInteger(nextId+1)?nextId++:null;
  const receiver=():number|undefined=>c.members.find(p=>items.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id).length<c.inventoryLimit)?.id;
  const move=(source:(MaterialPile|CommercialStockPile)[],actual:MaterialPile|CommercialStockPile,quantity:number,toOwner:boolean):boolean=>{
    const index=source.indexOf(actual);
    if(index<0||!integer(quantity,1)||quantity>actual.quantity)return false;
    let id=actual.id;
    if(quantity<actual.quantity){const value=allocate();if(value===null)return false;id=value;}
    const pawnId=toOwner?receiver():undefined;if(toOwner&&pawnId===undefined)return false;
    if(quantity<actual.quantity)actual.quantity-=quantity;else source.splice(index,1);
    const condition=copyPileCondition(actual);
    if(toOwner)items.push({...actual,id,quantity,owner:{type:'inventory',pawnId:pawnId!},...condition} as MaterialPile);
    else post.stock.push({id,kind:actual.kind,item:actual.item,quantity,...condition});
    return true;
  };
  for(const line of q.selected){
    const source=q.direction==='buy'?post.stock:items;
    const pile=source.find(p=>p.id===line.pileId);
    if(!pile)return null;
    if(q.direction==='buy'){if(!product(pile.item))return null;}
    else if(!isCommercialTextile(pile.item)||!memberOwnedInventory(pile))return null;
    if(!move(source,pile,line.quantity,q.direction==='buy'))return null;
    if(product(pile.item)){bought[pile.item]+=line.quantity;post.bought[pile.item]+=line.quantity;}
    else if(isCommercialTextile(pile.item)){sold[pile.item]+=line.quantity;(post.sold??=emptyCommercialTextiles())[pile.item]+=line.quantity;}
  }
  let payment=q.totalSilver;
  const source=q.direction==='buy'?items:post.stock;
  for(const pile of [...source].filter(p=>p.item==='silver'&&(q.direction==='sell'||memberOwnedInventory(p))).sort((a,b)=>a.id-b.id)){
    const quantity=Math.min(payment,pile.quantity);if(!quantity)continue;
    if(!move(source,pile,quantity,q.direction==='sell'))return null;
    payment-=quantity;if(!payment)break;
  }
  if(payment)return null;
  if(q.direction==='buy')post.silverReceived+=q.totalSilver;else post.silverPaid=(post.silverPaid??0)+q.totalSilver;
  post.transactions++;
  post.recent.push({tick:c.tick,pawnId:c.negotiator.id,silver:q.totalSilver,...bought,...(q.direction==='sell'?{sold}:{})});
  if(post.recent.length>COMMERCIAL_RECEIPTS)post.recent.splice(0,post.recent.length-COMMERCIAL_RECEIPTS);
  const inventory=items.filter(p=>p.owner.type==='inventory');
  if(c.pileCountElsewhere+items.length>32768||post.stock.length>COMMERCIAL_MAX_STOCK||inventory.length>c.inventoryLimit*(c.members.length+(c.additionalInventoryOwners?.length??0))||c.members.some(p=>inventory.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id).length>c.inventoryLimit)||!validCivilianPostShape(post,c.tick,nextId,c.version))return null;
  // Verify the final delta from actual units, not a second caller-owned mass capture.
  const grams=(piles:readonly MaterialPile[])=>piles.reduce((sum,p)=>{const unit=c.version>=256&&c.groupProspective===true?groupCaravanPileMass256(p,c.groupFreight===true,c.version):groupItemMassGrams(p.item,c.groupFreight===true,c.version);return unit===undefined?NaN:sum+unit*p.quantity;},0);
  if(c.mass.grams+grams(items)-grams(c.items)!==q.mass.grams)return null;
  const ids=new Set<number>();
  for(const pile of [...items,...post.stock])if(!integer(pile.id,1)||pile.id>=nextId||ids.has(pile.id)||!integer(pile.quantity,1))return null;else ids.add(pile.id);
  return {items,post,nextId,bought,sold,silverPaid:q.direction==='buy'?q.totalSilver:0,silverEarned:q.direction==='sell'?q.totalSilver:0};
}
