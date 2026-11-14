import {assignPileOwner} from './pile-index.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {bestGroupNegotiator,tradeImprovement} from './trade-negotiator.ts';
import {tradeRefusal,tradeUnitPrice,roundTradeSilver} from './trade-prices.ts';
import {copyPileCondition} from './pile-condition.ts';
import {captureGroupMass} from './group-capture.ts';
import {freightGroup} from './group-freight.ts';
import {withGroupExchange} from './group-reorganization-balance.ts';
import type {CampaignState,WorldGroupRecord} from './world-map-state.ts';
import type {MaterialPile} from './types.ts';

export interface MeetingTradeLine261 {pileId:number;quantity:number}
export interface MeetingTradeGood261 {id:number;item:MaterialPile['item'];side:'buy'|'sell';available:number;unitPrice:number|null;refusal?:string}
type Quote261={ok:false;reason:string}|{ok:true;signature:string;goods:MeetingTradeGood261[];paid:number;forgone:number;negotiatorId:number;traderId:number};
const fail=(reason:string)=>({ok:false as const,reason});
/** Real encounter inventory channel. Existing visitor catalogue/prices and
 * negotiator rules apply, without a CivilianPost, invented local map or remote
 * stock alias. Current UI supports inventory piles; worn gear and furniture
 * keep their original owners and are not advertised as supported trade goods. */
export function quoteMeetingTrade261(root:Pick<CampaignState,'schemaVersion'|'tick'|'nextId'>,record:WorldGroupRecord,lines:readonly MeetingTradeLine261[]):Quote261 {
 const p=record.pending261,g=record.state;
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||p?.kind!=='meeting'||p.decision!=='open'||record.localMapId!==null||!('members'in g)||g.lastPersonalTick!==root.tick||p.atCore!==root.tick*10)return fail('La rencontre commerciale n’est plus disponible.');
 const negotiator=bestGroupNegotiator(g.members),trader=p.people.find(a=>a.id===p.traderId);
 if(!negotiator||!trader||trader.state==='dead'||trader.state==='downed')return fail('Un négociateur et le véritable marchand doivent être disponibles.');
 if(!Array.isArray(lines)||lines.length>128||new Set(lines.map(l=>l.pileId)).size!==lines.length||lines.some(l=>!l||Reflect.ownKeys(l).length!==2||!Number.isSafeInteger(l.pileId)||!Number.isSafeInteger(l.quantity)||!l.quantity||Math.abs(l.quantity)>250000))return fail('Panier de rencontre invalide.');
 const improvement=tradeImprovement(negotiator),goods:MeetingTradeGood261[]=[];
 for(const [items,side] of [[g.items,'sell'],[p.items,'buy']] as const)for(const i of items){
  if(i.owner.type!=='inventory'||i.item==='silver')continue;
  // Only the actual merchant's current inventory is the current producer's stock.
  if(side==='buy'&&i.owner.pawnId!==p.traderId)continue;
  const refusal=tradeRefusal(i,side,root.tick,undefined,'caravan',root.schemaVersion),price=tradeUnitPrice(i,side,improvement);
  goods.push({id:i.id,item:i.item,side,available:i.quantity,unitPrice:price??null,...refusal?{refusal}:price===undefined?{refusal:'Ce bien n’a pas de prix représenté.'}:{}});
 }
 let net=0;
 for(const line of lines){const good=goods.find(g=>g.id===line.pileId);if(!good||good.refusal||good.unitPrice===null||Math.abs(line.quantity)>good.available||(line.quantity>0)!==(good.side==='buy'))return fail(good?.refusal??'Le stock réel ou la quantité a changé.');net+=line.quantity*good.unitPrice;}
 net=roundTradeSilver(net);
 const playerSilver=g.items.filter(i=>i.owner.type==='inventory'&&i.item==='silver').reduce((n,i)=>n+i.quantity,0),foreignSilver=p.items.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.traderId&&i.item==='silver').reduce((n,i)=>n+i.quantity,0);
 if(!Number.isSafeInteger(net)||net>playerSilver)return fail('La caravane ne porte pas assez d’argent.');
 const forgone=Math.max(0,-net-foreignSilver),paid=Math.max(net,-foreignSilver);
 return {ok:true,signature:JSON.stringify([record.originMapId,record.localMapId,record.context,record.state,record.pending261,root.nextId,negotiator.id,trader.id,improvement,lines,paid,forgone]),goods,paid,forgone,negotiatorId:negotiator.id,traderId:trader.id};
}
export function prepareMeetingTrade261(root:CampaignState,record:WorldGroupRecord,lines:readonly MeetingTradeLine261[],signature:string,acceptShortfall:boolean):{ok:false;reason:string}|{ok:true;current():boolean;commit():void} {
 const q=quoteMeetingTrade261(root,record,lines),g=record.state,p=record.pending261;
 if(!q.ok)return q;
 if(!lines.length||q.signature!==signature||typeof acceptShortfall!=='boolean'||q.forgone&&!acceptShortfall||!('members'in g)||p?.kind!=='meeting')return fail('Le panier ou l’acceptation de perte doit être confirmé.');
 if(!g.reorganization)return fail('Le bilan réel des inventaires de cette caravane est absent.');
 const registry=root.worldGroups,recordsBefore=registry?.groups,recordSlotBefore=recordsBefore?.indexOf(record)??-1;if(!registry||!recordsBefore||recordSlotBefore<0)return fail('La rencontre n’appartient plus à son vrai registre.');
 const tick=root.tick,allocator=root.nextId,player=g.items.slice(),foreign=p.items.slice(),playerBefore=player.slice(),foreignBefore=foreign.slice(),membersBefore=g.members.slice(),peopleBefore=p.people.slice(),updates=new Map<MaterialPile,{quantity:number;owner:MaterialPile['owner']}>(),received:MaterialPile[]=[],sent:MaterialPile[]=[];let nextId=allocator;
 const receiver=g.members.find(a=>a.id===q.negotiatorId)!;
 const projected=(i:MaterialPile)=>updates.has(i)?{...i,...updates.get(i)!}:i;
 const move=(from:MaterialPile[],to:MaterialPile[],original:MaterialPile,quantity:number,pawnId:number,effect:MaterialPile[]):boolean=>{
  const current=projected(original);if(quantity<1||quantity>current.quantity||!from.includes(original))return false;
  let moved:MaterialPile;
  if(quantity===current.quantity){from.splice(from.indexOf(original),1);updates.set(original,{quantity:current.quantity,owner:{type:'inventory',pawnId}});moved=original;}
  else{if(!Number.isSafeInteger(nextId+1))return false;updates.set(original,{quantity:current.quantity-quantity,owner:current.owner});moved={...current,id:nextId++,quantity,owner:{type:'inventory',pawnId},...copyPileCondition(current)};}
  to.push(moved);effect.push({...current,quantity,owner:{type:'inventory',pawnId}});return true;
 };
 for(const l of lines){const buying=l.quantity>0,from=buying?foreign:player,to=buying?player:foreign,i=from.find(i=>i.id===l.pileId);if(!i||!move(from,to,i,Math.abs(l.quantity),buying?receiver.id:p.traderId,buying?received:sent))return fail('Un transfert de bien réel ne peut pas être préparé.');}
 let silver=Math.abs(q.paid);const payer=q.paid>=0?player:foreign,payee=q.paid>=0?foreign:player;
 for(const i of payer.slice()){const current=projected(i);if(current.item!=='silver'||current.owner.type!=='inventory'||q.paid<0&&current.owner.pawnId!==p.traderId)continue;const count=Math.min(silver,current.quantity);if(count&&!move(payer,payee,i,count,q.paid>=0?p.traderId:receiver.id,q.paid>=0?sent:received))return fail('L’argent réel ne peut pas être transféré.');silver-=count;if(!silver)break;}
 if(silver)return fail('L’argent porté a changé.');
 const mass=captureGroupMass(g.members,player.map(projected),freightGroup(g),root.schemaVersion,g.packed,g.animalOwners?.members);if(!mass||mass.grams>mass.capacityGrams)return fail('Le panier final dépasse la charge représentée de la caravane.');
 const history=withGroupExchange(withGroupExchange(g.reorganization,'sent',sent),'received',received),before=JSON.stringify(record),events=registry.events;let used=false;
 const writable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return !!d&&Object.hasOwn(d,'value')&&d.writable===true;};
 const recipients=()=>writable(root,'nextId')&&writable(g,'items')&&writable(g,'reorganization')&&writable(p,'items')&&[...updates.keys()].every(i=>writable(i,'quantity')&&writable(i,'owner'))&&registry.events===events&&writable(events,'length')&&Object.isExtensible(events)&&Object.keys(events).every(key=>writable(events,key)&&Object.getOwnPropertyDescriptor(events,key)?.configurable===true);
 if(!recipients())return fail('Un véritable détenteur du panier n’est pas modifiable.');
 const sameOriginals=(actual:readonly object[],originals:readonly object[])=>actual.length===originals.length&&actual.every((a,i)=>a===originals[i]);
 const current=()=>!used&&root.worldGroups===registry&&registry.groups===recordsBefore&&recordsBefore[recordSlotBefore]===record&&recipients()&&root.tick===tick&&root.nextId===allocator&&record.state===g&&record.pending261===p&&sameOriginals(g.items,playerBefore)&&sameOriginals(p.items,foreignBefore)&&sameOriginals(g.members,membersBefore)&&sameOriginals(p.people,peopleBefore)&&JSON.stringify(record)===before&&quoteMeetingTrade261(root,record,lines).ok;
 return {ok:true,current,commit(){if(!current())throw Error('Stale real meeting trade');used=true;for(const [i,next]of updates){i.quantity=next.quantity;assignPileOwner(i,next.owner);}g.items=player;g.reorganization=history;p.items=foreign;root.nextId=nextId;root.worldGroups!.events.push({tick,type:'command',message:`Échange de rencontre conclu : ${q.paid>=0?q.paid+' argent payé':-q.paid+' argent reçu'}${q.forgone?', '+q.forgone+' argent abandonné explicitement':''}.`});if(root.worldGroups!.events.length>80)root.worldGroups!.events.splice(0,root.worldGroups!.events.length-80);}};
}
