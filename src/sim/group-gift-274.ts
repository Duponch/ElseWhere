import {isSchema274OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,boundWorldGroup} from './world-map-context.ts';
import {groupGeographicTradeTarget256} from './group-geographic-post-256.ts';
import {captureGroupMass,type AwayGroup} from './group-capture.ts';
import {freightGroup} from './group-freight.ts';
import {groupProvisionCounts,mixedGroupProvisions} from './group-provisions.ts';
import {bestGroupNegotiator,tradeImprovement} from './trade-negotiator.ts';
import {settlementTradeUnitPrice} from './trade-prices.ts';
import {isCommercialTextile,emptyCommercialTextiles,COMMERCIAL_MAX_STOCK,type CommercialBuyLine,type CommercialStockPile} from './commercial-state.ts';
import {validCivilianPostShape} from './commercial-post-rules.ts';
import {diplomaticGiftFaction274,worldNaturalGoodwill274,worldGoodwillChange274} from './world-diplomacy-274.ts';
import {diplomaticGiftGainFromBase274} from './diplomatic-gift-value-274.ts';
import {openGroupReorganization,withGroupExchange} from './group-reorganization-balance.ts';
import type {CommercialGifts274,GroupGiftQuote274,GroupGiftReceipt274} from './group-gift-state-274.ts';
import type {MaterialPile,World} from './types.ts';

const no=(reason:string)=>({ok:false as const,reason});
const int=(v:unknown,lo=0):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=lo;
const lineShape=(lines:unknown):lines is readonly CommercialBuyLine[]=>Array.isArray(lines)&&Object.getPrototypeOf(lines)===Array.prototype&&lines.length<=64&&Reflect.ownKeys(lines).length===lines.length+1&&Array.from({length:lines.length},(_,i)=>Object.hasOwn(Object.getOwnPropertyDescriptor(lines,String(i))??{},'value')).every(Boolean)&&lines.every(l=>l&&typeof l==='object'&&Object.getPrototypeOf(l)===Object.prototype&&Reflect.ownKeys(l).length===2&&Object.hasOwn(l,'pileId')&&Object.hasOwn(l,'quantity')&&Reflect.ownKeys(l).every(k=>Object.hasOwn(Object.getOwnPropertyDescriptor(l,k)!,'value'))&&int(l.pileId,1)&&int(l.quantity,1))&&new Set(lines.map(l=>l.pileId)).size===lines.length;
const writable=(o:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(o,k);return !!d&&Object.hasOwn(d,'value')&&d.writable===true;};
const assignable=(o:object,k:PropertyKey)=>Object.hasOwn(o,k)?writable(o,k):Object.isExtensible(o);
const same=(a:readonly object[],b:readonly object[])=>a.length===b.length&&a.every((v,i)=>v===b[i]);
function sealEdges(roots:readonly object[]):()=>boolean {
 const seen=new Set<object>(),edges:{owner:object;key:PropertyKey;value:object}[]=[],pending=[...roots];
 while(pending.length){const owner=pending.pop()!;if(seen.has(owner))continue;seen.add(owner);for(const key of Reflect.ownKeys(owner)){const d=Object.getOwnPropertyDescriptor(owner,key);if(d&&Object.hasOwn(d,'value')&&d.value&&typeof d.value==='object'){edges.push({owner,key,value:d.value});pending.push(d.value);}}}
 return ()=>edges.every(e=>Object.getOwnPropertyDescriptor(e.owner,e.key)?.value===e.value);
}
function capture(w:World){
 if(!isSchema274OrLater(Number(w.schemaVersion))||w.planet?.revision!==3||!w.group||!('members'in w.group))return no('Le don exige une caravane arrivée à un véritable comptoir de faction.');
 const g=w.group,target=groupGeographicTradeTarget256(w,g),root=registeredCampaign(w),factions=root.worldFactions;
 if(!target||!factions||!validCivilianPostShape(target.post,w.tick,w.nextId,w.schemaVersion))return no('Le comptoir réellement visité n’est plus disponible.');
 const faction=diplomaticGiftFaction274(factions,target.factionId,w.schemaVersion);if(!faction.ok)return faction;
 const negotiator=bestGroupNegotiator(g.members,w.schemaVersion);if(!negotiator)return no('Un adulte libre, éveillé et capable de négocier doit être présent.');
 const mass=captureGroupMass(g.members,g.items,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return no('Les détenteurs ou la charge de la caravane sont invalides.');
 const settlement=factions.settlements.find(s=>s.id===target.settlementId);if(!settlement)return no('L’établissement destinataire réel est absent.');
 return {ok:true as const,g,target,root,factions,faction:faction.faction,relation:faction.relation,negotiator,mass,settlement};
}

/** Pure preview over the selected confirmed caravan and visited finite post.
 * The sell unit price is recognized in float32, without a currency rounding. */
export function quoteGroupGift274(w:World,lines:readonly CommercialBuyLine[]):GroupGiftQuote274 {
 if(!lineShape(lines))return no('Panier de don invalide.');
 const c=capture(w);if(!c.ok)return c;
 const {g,target,relation,negotiator,mass}=c,owners=new Set([...g.members,...g.animalOwners?.members??[]].map(p=>p.id)),improvement=tradeImprovement(negotiator);
 const goods:Extract<GroupGiftQuote274,{ok:true}>['goods']=[];
 for(const pile of g.items)if(pile.owner.type==='inventory'&&owners.has(pile.owner.pawnId)&&isCommercialTextile(pile.item)){
  // The real post format preserves these properties. Never erase an unknown
  // property or nested object merely to make a carried original admissible.
  if(Reflect.ownKeys(pile).some(k=>typeof k!=='string'||!['id','kind','item','quantity','owner','damage'].includes(k)))continue;
  const unitPrice=settlementTradeUnitPrice(pile,'sell',improvement);if(unitPrice===undefined)return no('La valeur de ce fret est inconnue.');
  goods.push({pile,available:pile.quantity,unitPrice});
 }
 const selected:Extract<GroupGiftQuote274,{ok:true}>['selected']=[],quantities=new Map<number,number>();let recognizedValue=0,baseGoodwill=0;
 for(const line of lines){const good=goods.find(i=>i.pile.id===line.pileId);if(!good||!isCommercialTextile(good.pile.item)||line.quantity>good.available)return no('Le fret choisi n’est plus disponible chez ses vrais porteurs.');
  selected.push({pileId:good.pile.id,item:good.pile.item,quantity:line.quantity,unitPrice:good.unitPrice});quantities.set(good.pile.id,line.quantity);
  const value=Math.fround(Math.fround(good.unitPrice)*line.quantity);recognizedValue=Math.fround(recognizedValue+value);baseGoodwill=Math.fround(baseGoodwill+Math.fround(value/40));
 }
 if(!Number.isFinite(recognizedValue)||recognizedValue<0)return no('La valeur du don dépasse les limites.');
 if(target.post.stock.length+selected.length>COMMERCIAL_MAX_STOCK)return no('Le comptoir ne peut pas conserver toutes les piles données.');
 const finalItems=g.items.flatMap(p=>{const n=quantities.get(p.id)??0;return n===p.quantity?[]:n?[{...p,quantity:p.quantity-n}]:[p];});
 const finalMass=captureGroupMass(g.members,finalItems,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!finalMass||finalMass.grams>mass.grams)return no('La charge finale du don est incohérente.');
 const requestedGain=diplomaticGiftGainFromBase274(relation.goodwill,baseGoodwill),naturalGoodwill=worldNaturalGoodwill274(c.faction);
 if(naturalGoodwill===undefined)return no('Le niveau naturel de relation de cette faction est inconnu.');
 const change=worldGoodwillChange274(relation.goodwill,relation.kind,naturalGoodwill,requestedGain);if(!change)return no('Le changement de relation est invalide.');
 const {adjustedGain,appliedGain,goodwillAfter,kindAfter:relationAfter}=change;
 const counts=groupProvisionCounts(finalItems.filter(p=>p.owner.type==='inventory'&&(mixedGroupProvisions(g)||p.item!=='pemmican')),w.tick);
 const signature=selected.length?JSON.stringify([g.id,g.phase,g.tile,g.members.map(p=>p.id),g.animalOwners?.members.map(p=>p.id),target.settlementId,target.factionId,target.postId,target.post,negotiator.id,improvement,relation,selected.map(line=>[line,goods.find(good=>good.pile.id===line.pileId)!.pile]),recognizedValue,baseGoodwill,requestedGain,adjustedGain,naturalGoodwill,appliedGain,relationAfter,finalMass]):'';
 if(signature.length>262144)return no('Ce panier dépasse la taille de devis admise.');
 return {ok:true,signature,negotiatorId:negotiator.id,settlementId:target.settlementId,settlementName:c.settlement.name,factionId:target.factionId,factionName:c.faction.name,postId:target.postId,recognizedValue,baseGoodwill,requestedGain,adjustedGain,naturalGoodwill,appliedGain,goodwillBefore:relation.goodwill,goodwillAfter,relationBefore:relation.kind,relationAfter,goods,selected,mass:{grams:finalMass.grams,capacityGrams:finalMass.capacityGrams,byMember:finalMass.carriers,...finalMass.ridingFactor!==undefined?{ridingFactor:finalMass.ridingFactor}:{},...counts}};
}

export type PreparedGroupGift274={ok:false;reason:string}|{ok:true;current():boolean;commit():void};
/** One physical transfer, preserving whole original objects and allocating a
 * new identity only for a fragment. No write or RNG in preparation. */
export function prepareGroupGift274(w:World,lines:readonly CommercialBuyLine[],signature:string):PreparedGroupGift274 {
 const q=quoteGroupGift274(w,lines);if(!q.ok)return q;if(!q.selected.length||q.signature!==signature)return no('Le devis du don a changé.');
 const c=capture(w);if(!c.ok)return c;
 const {g,root,target,relation,factions}=c,registry=root.worldGroups,record=boundWorldGroup(w);
 if(!registry||!record||record.state!==g||record.localMapId!==null||record.pending261)return no('La caravane hors carte n’est plus son véritable propriétaire.');
 const postRow=registry.posts.find(p=>p.id===target.postId);if(!postRow||postRow.state!==target.post)return no('Le stock n’appartient plus au véritable comptoir.');
 const originalItems=g.items,itemRefs=originalItems.slice(),ownerRefs=itemRefs.map(p=>p.owner),members=g.members,memberRefs=members.slice(),animals=g.animalOwners?.members,animalRefs=animals?.slice(),packs=g.packed,packRefs=packs?.slice(),buildings=packRefs?.map(p=>p.building),post=target.post,stock=post.stock,stockRefs=stock.slice(),records=registry.groups,recordIndex=records.indexOf(record),posts=registry.posts,postIndex=posts.indexOf(postRow),events=registry.events,oldGifts=post.gifts274,oldHistory=g.reorganization,tick=w.tick,nextId=root.nextId;
 let allocated=nextId;const outgoing:MaterialPile[]=[],updates:{original:MaterialPile;quantity:number}[]=[],whole:MaterialPile[]=[],incoming:CommercialStockPile[]=[],remaining=originalItems.slice(),totals=emptyCommercialTextiles();
 for(const line of q.selected){const original=originalItems.find(p=>p.id===line.pileId)!;
  outgoing.push({...original,quantity:line.quantity});totals[line.item]+=line.quantity;
  if(line.quantity===original.quantity){remaining.splice(remaining.indexOf(original),1);whole.push(original);incoming.push(original);}
  else{if(!Number.isSafeInteger(allocated+1))return no('Le registre des fragments est plein.');const {owner,...body}=original;incoming.push({...body,id:allocated++,quantity:line.quantity});updates.push({original,quantity:original.quantity-line.quantity});}
 }
 if(!Object.values(totals).every(Number.isSafeInteger))return no('Les quantités du don dépassent les limites.');
 let history:NonNullable<AwayGroup['reorganization']>;
 try{history=withGroupExchange(oldHistory??openGroupReorganization(g,registry.losses,tick,g.members.map(p=>({pawnId:p.id,originMapId:record.originMapId,context:record.context}))),'sent',outgoing);}catch{return no('Le reçu du fret ne peut pas conserver les quantités données.');}
 const receipt:GroupGiftReceipt274={tick,groupId:g.id,pawnId:q.negotiatorId,settlementId:q.settlementId,factionId:q.factionId,postId:q.postId,totals:{...totals},recognizedValue:q.recognizedValue,baseGoodwill:q.baseGoodwill,requestedGain:q.requestedGain,adjustedGain:q.adjustedGain,naturalGoodwill:q.naturalGoodwill,appliedGain:q.appliedGain,goodwillBefore:q.goodwillBefore,goodwillAfter:q.goodwillAfter,relationBefore:q.relationBefore,relationAfter:q.relationAfter};
 const gifts:CommercialGifts274={count:(oldGifts?.count??0)+1,totals:{cloth:(oldGifts?.totals.cloth??0)+totals.cloth,'muffalo-wool':(oldGifts?.totals['muffalo-wool']??0)+totals['muffalo-wool']},recent:[...oldGifts?.recent??[],receipt].slice(-32)};
 const shadowStock=[...stock,...incoming.map(p=>{const {owner,...rest}=p as MaterialPile;return rest;})];
 if(!validCivilianPostShape({...post,stock:shadowStock,gifts274:gifts},tick,allocated,w.schemaVersion))return no('Le comptoir ne peut pas conserver les biens et le reçu de ce don.');
 const before=JSON.stringify([g,post,factions]),edgesCurrent=sealEdges([g,post,factions]),factionRows=factions.factions,factionRefs=factionRows.slice(),relations=factions.relations,relationRefs=relations.slice(),settlements=factions.settlements,settlementRefs=settlements.slice();let used=false;
 const recipients=()=>writable(root,'nextId')&&writable(g,'items')&&assignable(g,'reorganization')&&writable(post,'stock')&&assignable(post,'gifts274')&&writable(relation,'goodwill')&&writable(relation,'kind')&&updates.every(u=>writable(u.original,'quantity'))&&whole.every(p=>Object.getOwnPropertyDescriptor(p,'owner')?.configurable===true)&&writable(events,'length')&&Object.isExtensible(events)&&Object.keys(events).every(k=>writable(events,k)&&Object.getOwnPropertyDescriptor(events,k)?.configurable===true);
 const originals=()=>same(g.items,itemRefs)&&g.items===originalItems&&itemRefs.every((p,i)=>p.owner===ownerRefs[i])&&g.members===members&&same(members,memberRefs)&&g.animalOwners?.members===animals&&(!animals||same(animals,animalRefs!))&&g.packed===packs&&(!packs||same(packs,packRefs!)&&packs.every((p,i)=>p.building===buildings![i]))&&post.stock===stock&&same(stock,stockRefs)&&post.gifts274===oldGifts&&g.reorganization===oldHistory&&factions.factions===factionRows&&same(factionRows,factionRefs)&&factions.relations===relations&&same(relations,relationRefs)&&factions.settlements===settlements&&same(settlements,settlementRefs);
 const current=()=>!used&&root.tick===tick&&w.tick===tick&&root.nextId===nextId&&root.worldGroups===registry&&registry.groups===records&&records[recordIndex]===record&&record.state===g&&w.group===g&&registry.posts===posts&&posts[postIndex]===postRow&&postRow.state===post&&root.worldFactions===factions&&registry.events===events&&originals()&&edgesCurrent()&&recipients()&&JSON.stringify([g,post,factions])===before;
 if(!current())return no('Un véritable destinataire du don n’est pas modifiable.');
 return {ok:true,current,commit(){
  if(!current())throw Error('Stale actual diplomatic gift');used=true;
  for(const u of updates)u.original.quantity=u.quantity;
  for(const p of whole)delete (p as Partial<MaterialPile>).owner;
  g.items=remaining;g.reorganization=history;post.stock=[...stock,...incoming];post.gifts274=gifts;relation.goodwill=q.goodwillAfter;relation.kind=q.relationAfter;root.nextId=allocated;
  events.push({tick,type:'command',message:`Don remis à ${q.factionName} : ${totals.cloth} tissus, ${totals['muffalo-wool']} laines de mufalo ; relations ${q.goodwillBefore} → ${q.goodwillAfter} (${q.appliedGain>=0?'+':''}${q.appliedGain}).`});if(events.length>80)events.splice(0,events.length-80);
 }};
}
