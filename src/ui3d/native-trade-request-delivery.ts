import type {NativeControl,NativePage,NativeRow} from './native-contract';
import {NATIVE_MESSAGE} from './native-dialog-metrics';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import {QUALITY_LABELS} from '../sim/equipment-rules';
import {tradeRequestContent284} from '../sim/trade-request-content-284';
import type {TradeRequest284,TradeRequestCommand284,TradeRequestQuote284} from '../sim/trade-request-state-284';

type Quote=TradeRequestQuote284|{ok:false;reason:string};
export interface NativeTradeDeliveryView {
  /** Identity of the current campaign, visit, group and accepted request. */
  identity:string;request:TradeRequest284;quote:Quote;groupLabel:string;
  carrierLabel:(id:number)=>string;consumedLabel?:(pileId:number,item:ItemId)=>string;
  relation?:{before:number;afterBonus:number;afterReward:number};
  paused?:boolean;
}
interface Options {
  parent:NativePage;requestId:number;groupId:number;
  read:()=>NativeTradeDeliveryView;pause:()=>Promise<unknown>;
  isCurrent:(page:NativePage)=>boolean;show:(page:NativePage)=>void;back:()=>void;
  send:(command:TradeRequestCommand284)=>Promise<unknown>;
}
const number=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:3});
const kg=(grams:number)=>`${number.format(grams/1000)} kg`;
const signed=(value:number)=>`${value>0?'+':''}${value}`;
const message=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
const row=(id:string,label:string,value?:string,detail?:string):NativeRow=>({id,label,value,detail});
const heading=(id:string,label:string):NativeRow=>({id,label,emphasis:'heading'});

/** Presentation of the exact whole handover, not a trade basket. Only the
 * simulator has chosen the outgoing fragments and the receiving inventories. */
export function nativeTradeDeliveryRows(view:NativeTradeDeliveryView,quote:TradeRequestQuote284):NativeRow[] {
  const {request}=view,family=tradeRequestContent284(request.family)?.label??request.family,option=request.options.find(entry=>entry.id===request.selectedOptionId);
  const rows:NativeRow[]=[row('delivery-destination','Établissement',request.settlementName,view.groupLabel),
    {...row('delivery-count','Marchandises remises',`${number.format(quote.required)} ${family}`,`${number.format(quote.available)} unités admissibles dans les inventaires de cette caravane. La remise complète est définitive.`),presentation:'summary'},
    heading('delivery-outgoing','Lots consommés')];
  for(const line of quote.consumed)rows.push(row(`delivery-consumed-${line.pileId}`,view.consumedLabel?.(line.pileId,line.item)??`${ITEM_DEFINITIONS[line.item].label} · lot n° ${line.pileId}`,`× ${number.format(line.quantity)}`));
  rows.push(heading('delivery-incoming',`Récompense choisie${option?' (option '+option.id+')':''}`));
  for(const item of quote.rewards)rows.push(row(`delivery-reward-${item.id}`,`${number.format(item.quantity)} ${ITEM_DEFINITIONS[item.item].label}`,item.quality?QUALITY_LABELS[item.quality]:undefined,`Reçu par ${view.carrierLabel(item.pawnId)} · lot n° ${item.id}`));
  if(!quote.rewards.length)rows.push(row('delivery-no-objects','Aucun objet dans cette récompense.'));
  rows.push(row('delivery-bonus','Relations',view.relation?`${signed(view.relation.before)} → ${signed(view.relation.afterReward)}`:undefined,`Bonus de remise demandé : +12. Récompense diplomatique choisie : ${signed(option?.goodwill??0)}.${view.relation?` Après le bonus : ${signed(view.relation.afterBonus)}.`:' Les règles diplomatiques peuvent limiter le gain.'}`),
    row('delivery-mass','Charge après remise',`${kg(quote.mass.grams)} / ${kg(quote.mass.capacityGrams)}`));
  if(quote.mass.grams>quote.mass.capacityGrams)rows.push({...row('delivery-overload','Caravane surchargée','La récompense peut être reçue, mais la marche attendra une charge admissible.'),presentation:'summary'});
  return rows;
}

/** The pause ACK authorizes only calculation of a preview. Consent belongs
 * to the exact shown page and signature, never to a numeric request ID alone.
 * Navigation and late acknowledgements cannot reclaim a different page. */
export function createNativeTradeRequestDelivery(options:Options){
  type Phase='idle'|'opening'|'review'|'refused'|'sending'|'disposed';
  let phase:Phase='idle',shown=options.parent,identity:string|undefined,signature:string|undefined,subject:string|undefined;
  const current=()=>phase!=='disposed'&&options.isCurrent(shown);
  const emit=(next:NativePage)=>{shown=next;options.show(next);};
  const dispose=()=>{phase='disposed';signature=subject=undefined;};
  const leave=()=>{dispose();options.back();};
  const read=()=>{
    const view=options.read();
    if(view.request.id!==options.requestId||view.quote.ok&&(view.quote.requestId!==options.requestId||view.quote.groupId!==options.groupId))throw Error('Cette demande ou sa caravane ne correspond plus à la remise ouverte.');
    if(identity!==undefined&&view.identity!==identity)throw Error('La visite, la demande ou la campagne a changé.');
    if(!view.quote.ok)throw Error(view.quote.reason);
    return {view,quote:view.quote};
  };
  function frame(rows:NativeRow[],back:()=>void,confirm:NativeControl):NativePage {
    return{id:'delivery-confirm',title:'Remplir la demande commerciale',modal:true,layout:'message',width:NATIVE_MESSAGE.width,height:NATIVE_MESSAGE.height,rows,
      actions:[{id:'delivery-confirm-back',label:'Retour',onActivate:back},confirm],onClose:back,closeOwnsNavigation:true};
  }
  function refuse(reason:string):void {
    if(!current())return;
    phase='refused';signature=subject=undefined;
    const back=()=>{if(phase==='refused'&&current()&&shown===page)leave();};
    const page=frame([row('delivery-refused','La remise doit être vérifiée de nouveau.',undefined,reason),row('delivery-reopen','Cette fenêtre ne peut plus valider la remise. Revenez à la caravane pour relire sa situation confirmée.')],back,{id:'delivery-confirm-confirm',label:'Confirmer la remise',disabled:true,hint:reason,onActivate:()=>undefined});
    emit(page);
  }
  /** Seal the facts actually presented, in addition to the authoritative
   * signature. Keep only scalars, never a mutable request/quote reference. */
  const subjectOf=(view:NativeTradeDeliveryView,quote:TradeRequestQuote284)=>{
    const r=view.request,chosen=r.options.find(entry=>entry.id===r.selectedOptionId);
    return JSON.stringify([r.id,r.status,r.tile,r.settlementId,r.settlementName,r.factionId,r.family,r.quantity,r.expiresAtCore,r.selectedOptionId,chosen?.goodwill,quote.required,quote.available,quote.consumed,quote.rewards,quote.mass,view.relation]);
  };
  function verified():{view:NativeTradeDeliveryView;quote:TradeRequestQuote284}{
    const fresh=read();
    if(fresh.view.paused===false)throw Error('La partie n’est plus en pause. Vérifiez de nouveau la remise.');
    if(fresh.quote.quote!==signature||subjectOf(fresh.view,fresh.quote)!==subject)throw Error('La remise ou les propriétaires ont changé. Vérifiez de nouveau la remise.');
    return fresh;
  }
  function review(view:NativeTradeDeliveryView,quote:TradeRequestQuote284):void {
    signature=quote.quote;subject=subjectOf(view,quote);phase='review';
    const live=()=>phase==='review'&&current()&&shown===page;
    const back=()=>{if(live())leave();};
    const page=frame(nativeTradeDeliveryRows(view,quote),back,{id:'delivery-confirm-confirm',label:'Confirmer la remise',hint:'Remet exactement les lots de ce devis et reçoit la récompense choisie.',onActivate:async()=>{
      if(!live())return;
      let fresh:ReturnType<typeof verified>;
      try{fresh=verified();}catch(cause){refuse(message(cause));return;}
      phase='sending';
      try{
        const result=await options.send({type:'trade-request-fulfill',requestId:options.requestId,groupId:options.groupId,quote:fresh.quote.quote,confirm:true});
        if(result===false)throw Error('Remise refusée.');
        if(result&&typeof result==='object'&&'ok'in result&&result.ok===false)throw Error('reason'in result?String(result.reason):'Remise refusée.');
        if(phase==='sending'&&current()&&shown===page)leave();else dispose();
      }catch(cause){if(phase==='sending'&&current()&&shown===page)refuse(message(cause));else dispose();}
    }});
    emit(page);
  }
  return {
    async open():Promise<void>{
      if(phase!=='idle'||!current())return;
      phase='opening';
      try{
        const before=read();identity=before.view.identity;
        await options.pause();
        if(phase!=='opening'||!current()){dispose();return;}
        const {view,quote}=read();if(view.paused===false)throw Error('La pause du jeu n’a pas été confirmée.');
        review(view,quote);
      }catch(cause){const stillCurrent=current();dispose();if(stillCurrent)throw cause;}
    },
    /** Revoke visible consent on an accepted snapshot change, never while the
     * request's own pause or send is pending. Main calls this only on change. */
    refresh():void{
      if(phase!=='review')return;if(!current()){dispose();return;}
      try{verified();}catch(cause){refuse(message(cause));}
    },
    owns:(page:NativePage)=>phase!=='disposed'&&shown===page,
    dispose,
  };
}
