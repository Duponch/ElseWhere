import {assignPileOwner} from './pile-index.ts';
import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,boundWorldGroup} from './world-map-context.ts';
import {worldSettlementAccess256} from './world-faction-access.ts';
import {worldNaturalGoodwill274,worldGoodwillChange274} from './world-diplomacy-274.ts';
import {captureProspectiveGroupMass256} from './group-caravan-mass-256.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {caravanPawnCapacityGrams256} from './group-animal-capacity-256.ts';
import {groupProvisionClimateRate} from './group-provision-age.ts';
import {openGroupReorganization,withGroupExchange} from './group-reorganization-balance.ts';
import {eligibleTradeRequestThing284} from './trade-request-rules-284.ts';
import {tradeRewardManifest284,sameTradeRewardManifest284} from './trade-request-holder-284.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {rotAge} from './food-preservation.ts';
import {healthRandom} from './health.ts';
import type {AwayGroup} from './group-capture.ts';
import type {TradeConsumedThing284,TradeDeliveredThing284,TradeRequestFulfillment284,TradeRequestQuote284} from './trade-request-state-284.ts';
import type {MaterialPile,World} from './types.ts';

const no=(reason:string)=>({ok:false as const,reason});
const positive=(n:unknown):n is number=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0;
const writable=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&Object.hasOwn(d,'value')&&d.writable===true;};
const assignable=(v:object,k:PropertyKey)=>Object.hasOwn(v,k)?writable(v,k):!(k in v)&&Object.isExtensible(v);
/** Same-value replacement of a nested original is still a changed transaction. */
function sealEdges(roots:readonly object[]):()=>boolean {
 const seen=new Set<object>(),edges:{v:object;k:PropertyKey;value:unknown}[]=[],todo=[...roots];
 while(todo.length){const v=todo.pop()!;if(seen.has(v))continue;seen.add(v);for(const k of Reflect.ownKeys(v)){const d=Object.getOwnPropertyDescriptor(v,k);if(d&&Object.hasOwn(d,'value')&&d.value&&typeof d.value==='object'){edges.push({v,k,value:d.value});todo.push(d.value);}}}
 return ()=>edges.every(e=>Object.getOwnPropertyDescriptor(e.v,e.k)?.value===e.value);
}

function capture(w:World,requestId:number,groupId:number){
 const root=registeredCampaign(w),requests=root.tradeRequests284,factions=root.worldFactions;
 if(!isSchema284OrLater(w.schemaVersion)||!isSchema284OrLater(root.schemaVersion)||!positive(requestId)||!positive(groupId)||root.planet?.revision!==3||!requests||!factions||w.tick!==root.tick)return no('Cette demande commerciale ou son contexte n’est plus disponible.');
 const request=requests.entries.find(r=>r.id===requestId),binding=boundWorldGroup(w),record=binding??root.worldGroups?.groups.find(r=>r.state.id===groupId);
 if(record&&!plainWorldPawnData256(record))return no('Le propriétaire réel de cette caravane est invalide.');
 const g=record?.state??w.group;
 if(binding&&w.group!==g)return no('La projection ne désigne plus les mêmes propriétaires de caravane.');
 if(!g||!('members'in g)||g.id!==groupId||!plainWorldPawnData256(g)||!request||!plainWorldPawnData256(request))return no('Choisissez la vraie caravane et une demande existante.');
 if(record&&(record.localMapId!==null||record.pending261||record.pendingEntry263))return no('La caravane doit avoir terminé son arrivée hors carte.');
 if(g.phase!=='at-site'||g.segment!==null||g.lastPersonalTick!==w.tick||g.tile!==request.tile)return no('La caravane doit être immobile et confirmée à l’établissement demandé.');
 const core=w.tick*10;
 if(request.status!=='accepted'||request.closed||request.fulfillment||request.expiresAtCore===undefined||request.expiresAtCore<=core)return no('Cette demande n’est plus acceptée et active.');
 const settlement=factions.settlements.find(s=>s.id===request.settlementId),access=worldSettlementAccess256(factions,request.settlementId);
 if(request.destinationLost||!settlement||!plainWorldPawnData256(settlement)||settlement.factionId!==request.factionId||settlement.tile!==request.tile||!access.ok||!access.canTrade)return no('L’établissement destinataire réel n’est plus visitable.');
 const faction=factions.factions.find(f=>f.id===request.factionId),a=Math.min(factions.playerFactionId,request.factionId),b=Math.max(factions.playerFactionId,request.factionId),relations=factions.relations.filter(r=>r.aId===a&&r.bId===b);
 const relation=relations[0],natural=faction&&worldNaturalGoodwill274(faction);
 if(!faction||!relation||relations.length!==1||natural===undefined||!plainWorldPawnData256(relation)||relation.kind==='hostile')return no('La vraie relation diplomatique est absente ou hostile.');
 const chosen=request.options.find(o=>o.id===request.selectedOptionId);
 if(!chosen||request.options.some(o=>o!==chosen&&o.items.length)||chosen.items.length!==chosen.original.length||chosen.items.length>64)return no('La récompense choisie n’est plus dans son détenteur exclusif.');
 const mass=captureProspectiveGroupMass256(g,w.schemaVersion),members=groupPhysicalPawns256(g),ids=new Set<number>();
 if(!mass||!members.length||members.some(p=>p.state==='dead'||p.health?.death)||!positive(request.quantity)||!positive(root.nextId)||!positive(root.rng)||root.rng>0xffffffff)return no('Les vrais porteurs, les quantités ou la charge sont invalides.');
 for(const p of g.items){if(!positive(p.id)||p.id>=root.nextId||ids.has(p.id))return no('L’identité d’un bien transporté est invalide.');ids.add(p.id);}
 for(const p of chosen.items){
  const owner=p.owner,original=chosen.original.find(o=>o.id===p.id);
  if(!positive(p.id)||p.id>=root.nextId||ids.has(p.id)||owner.type!=='trade-request284'||owner.requestId!==requestId||owner.optionId!==chosen.id||!original||!sameTradeRewardManifest284(tradeRewardManifest284(p),original))return no('Un original de récompense a changé de propriétaire ou de contenu.');
  ids.add(p.id);
 }
 return {ok:true as const,root,requests,factions,request,g,record,settlement,faction,relation,natural,chosen,mass,members,core};
}

function draft(w:World,requestId:number,groupId:number){
 const c=capture(w,requestId,groupId);if(!c.ok)return c;
 const {root,g,request,chosen,members,relation,natural}=c,consumed:TradeConsumedThing284[]=[],outgoing:MaterialPile[]=[],changes=new Map<MaterialPile,number>();let available=0,needed=request.quantity,nextId=root.nextId;
 // CaravanInventoryUtility: actual pawn order, each inventory from its end.
 for(const member of members)for(let i=g.items.length-1;i>=0;i--){
  const p=g.items[i]!;if(p.owner.type!=='inventory'||p.owner.pawnId!==member.id||!eligibleTradeRequestThing284(p,request.family,w.tick))continue;
  available+=p.quantity;if(!Number.isSafeInteger(available))return no('La quantité disponible dépasse les limites.');
  if(!needed)continue;const quantity=Math.min(needed,p.quantity),id=quantity===p.quantity?p.id:nextId++;
  if(!Number.isSafeInteger(nextId)||nextId>Number.MAX_SAFE_INTEGER)return no('Le registre des fragments consommés est plein.');
  changes.set(p,quantity);consumed.push({sourceId:p.id,id,item:p.item,quantity});outgoing.push({...p,id,quantity});needed-=quantity;
 }
 if(needed)return no(`La caravane ne transporte pas toute la quantité admissible (${available}/${request.quantity}).`);
 const remaining=g.items.filter(p=>changes.get(p)!==p.quantity),shadowItems=remaining.map(p=>changes.has(p)?{...p,quantity:p.quantity-changes.get(p)!}:p);
 const random={rng:root.rng},rewards:TradeDeliveredThing284[]=[],incoming:MaterialPile[]=[],placements:{pile:MaterialPile;owner:MaterialPile['owner'];rot?:MaterialPile['rot']}[]=[];
 let finalMass=captureProspectiveGroupMass256({...g,items:shadowItems},w.schemaVersion);if(!finalMass)return no('La charge après remise ne peut pas être conservée.');
 const climate=chosen.items.some(p=>p.rot)?groupProvisionClimateRate(w,g):1;
 for(const pile of chosen.items){
  const capable=members.filter(p=>caravanPawnCapacityGrams256(p)>0),notOverloaded=capable.filter(p=>{const row=finalMass!.carriers.find(r=>r.pawnId===p.id);return !!row&&row.grams<=row.capacityGrams;}),pool=notOverloaded.length?notOverloaded:capable.length?capable:members;
  if(!pool.length)return no('Aucun véritable membre ne peut recevoir la récompense.');
  const pawn=pool[Math.floor(healthRandom(random)*pool.length)]!,owner={type:'inventory' as const,pawnId:pawn.id};
  const rot=pile.rot?{progress:rotAge(pile,w.tick),atTick:w.tick,...climate!==1?{rate:climate}:{}}:undefined;
  const moved={...pile,owner,...rot?{rot}:{}};incoming.push(moved);shadowItems.push(moved);placements.push({pile,owner,...rot?{rot}:{}});rewards.push({...tradeRewardManifest284(pile),pawnId:pawn.id});
  if(shadowItems.length>32768)return no('La caravane ne peut pas conserver toutes les piles de récompense.');
  finalMass=captureProspectiveGroupMass256({...g,items:shadowItems},w.schemaVersion);if(!finalMass)return no('La charge de la récompense n’est pas représentée.');
 }
 const bonus=worldGoodwillChange274(relation.goodwill,relation.kind,natural,12),reward=bonus&&worldGoodwillChange274(bonus.goodwillAfter,bonus.kindAfter,natural,chosen.goodwill);
 if(!bonus||!reward)return no('Les deux changements diplomatiques ne peuvent pas être conservés.');
 const quote=JSON.stringify([requestId,groupId,w.tick,root.nextId,root.rng,request,g,c.settlement,relation,natural,consumed,rewards,finalMass]);
 if(!quote.length||quote.length>262144)return no('Cette remise dépasse la taille de devis admise.');
 const q:TradeRequestQuote284={ok:true,quote,requestId,groupId,available,required:request.quantity,consumed:consumed.map(p=>({pileId:p.sourceId,item:p.item,quantity:p.quantity})),rewards,mass:{grams:finalMass.grams,capacityGrams:finalMass.capacityGrams}};
 return {ok:true as const,c,q,changes,remaining,consumed,outgoing,incoming,placements,nextId,rng:random.rng,bonus,reward};
}

/** Read-only preview on both a real groupWorld projection and SIM authority.
 * All PRNG advances and fragment identities here belong to a private draft. */
export function quoteTradeRequestFulfill284(w:World,requestId:number,groupId:number):TradeRequestQuote284|{ok:false;reason:string}{
 try{const d=draft(w,requestId,groupId);return d.ok?d.q:d;}catch{return no('La remise ne peut pas être calculée sur ces propriétaires.');}
}

export type PreparedTradeRequestFulfill284={ok:false;reason:string}|{ok:true;current():boolean;commit():void};
/** Whole originals leave the exclusive quest holder once. Consumed fragments
 * reserve their own destroyed identity in a scalar receipt, not a second pile. */
export function prepareTradeRequestFulfill284(w:World,requestId:number,groupId:number,quote:string):PreparedTradeRequestFulfill284 {
 try{
  const d=draft(w,requestId,groupId);if(!d.ok)return d;if(typeof quote!=='string'||quote!==d.q.quote)return no('Le devis de remise a changé.');
  const {c}=d,{root,requests,request,g,record,chosen,relation,factions}=c,registry=root.worldGroups;
  if(!registry||!record||record.state!==g||!registry.groups.includes(record)||record.localMapId!==null)return no('La remise exige le véritable propriétaire autoritaire de cette caravane.');
  const tick=w.tick,nextId=root.nextId,rng=root.rng,entries=requests.entries,records=registry.groups,items=g.items,rewardItems=chosen.items,oldHistory=g.reorganization;
  let history:NonNullable<AwayGroup['reorganization']>;
  try{history=withGroupExchange(withGroupExchange(oldHistory??openGroupReorganization(g,registry.losses,tick,g.members.map(p=>({pawnId:p.id,originMapId:record.originMapId,context:record.context}))),'sent',d.outgoing),'received',d.incoming);}catch{return no('Les bilans ne peuvent pas conserver cette remise complète.');}
  const receipt:TradeRequestFulfillment284={atCore:c.core,groupId,consumed:d.consumed,delivered:d.q.rewards.map(r=>({...r})),goodwill:{before:relation.goodwill,afterBonus:d.bonus.goodwillAfter,afterReward:d.reward.goodwillAfter,bonusRequested:12,rewardRequested:chosen.goodwill}};
  const before=JSON.stringify([g,request,c.settlement,c.faction,relation]),edges=sealEdges([g,request,c.settlement,c.faction,relation]),finalItems=[...d.remaining,...rewardItems];let used=false;
  const recipients=()=>writable(root,'nextId')&&writable(root,'rng')&&writable(g,'items')&&assignable(g,'reorganization')&&writable(chosen,'items')&&writable(request,'status')&&assignable(request,'closed')&&assignable(request,'fulfillment')&&writable(relation,'goodwill')&&writable(relation,'kind')
   &&[...d.changes].every(([p,n])=>n===p.quantity||writable(p,'quantity'))&&d.placements.every(p=>writable(p.pile,'owner')&&(!p.rot||writable(p.pile,'rot')));
  const current=():boolean=>{
   try{if(used||root.tick!==tick||w.tick!==tick||root.nextId!==nextId||root.rng!==rng||root.worldGroups!==registry||root.tradeRequests284!==requests||root.worldFactions!==factions||requests.entries!==entries||!entries.includes(request)||registry.groups!==records||!records.includes(record)||record.state!==g||g.items!==items||chosen.items!==rewardItems||g.reorganization!==oldHistory||!edges()||!recipients()||JSON.stringify([g,request,c.settlement,c.faction,relation])!==before)return false;
    const now=draft(w,requestId,groupId);return now.ok&&now.c.g===g&&now.c.request===request&&now.c.relation===relation&&now.c.settlement===c.settlement&&now.c.faction===c.faction&&now.q.quote===quote;
   }catch{return false;}
  };
  if(!current())return no('Un véritable destinataire de la remise n’est pas modifiable.');
  return {ok:true,current,commit(){
   if(!current())throw Error('Stale actual trade request fulfillment');used=true;
   for(const [p,n] of d.changes)if(n<p.quantity)p.quantity-=n;
   for(const p of d.placements){assignPileOwner(p.pile,p.owner);if(p.rot)p.pile.rot=p.rot;}
   g.items=finalItems;g.reorganization=history;chosen.items=[];
   relation.goodwill=d.reward.goodwillAfter;relation.kind=d.reward.kindAfter;
   request.fulfillment=receipt;request.closed={atCore:c.core,reason:'fulfilled'};request.status='succeeded';root.nextId=d.nextId;root.rng=d.rng;
  }};
 }catch{return no('Cette remise ne peut pas être préparée sans modifier les originaux.');}
}
