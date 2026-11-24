import type {Command} from '../sim/types';
import type {CommercialBuyLine} from '../sim/commercial-state';
import type {NativeControl,NativePage,NativeRow} from './native-contract';
import {NATIVE_MESSAGE,NATIVE_TRADE} from './native-dialog-metrics';

type Side=NonNullable<NativeRow['tradeEntry']>['side'];
export interface WorldTradeGood {id:number;side:Side;label:string;icon?:string;available:number;unitPrice:number|null;refusal?:string;detail?:string}
export type WorldTradeQuote={ok:false;reason:string}|{ok:true;signature:string;preview:NativeRow[];review:NativeRow[];reviewTitle?:string;forgone?:number;command:(acceptShortfall:boolean)=>Command};
export interface WorldTradeView {
  /** A visit, not its mutable stock or its current valuation. */
  identity:string;
  navigation:NativeRow[];
  goods:readonly WorldTradeGood[];
  quote:(lines:CommercialBuyLine[])=>WorldTradeQuote;
}
interface Options {
  id:string;title:string;prefix:string;goodPrefix:string;verifyId:string;confirmId:string;confirmTitle:string;
  mode:Side|'mixed';sourceLabel:string;partnerLabel:string;
  read:()=>WorldTradeView;show:(page:NativePage)=>void;isCurrent:(page:NativePage)=>boolean;
  send:(command:Command)=>Promise<unknown>;back:()=>void;
}
export interface NativeWorldTradeDraft {open():void;dispose():void;owns(page:NativePage):boolean}
const number=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:2}),collator=new Intl.Collator('fr');
export const worldTradeAmount=(value:number):string=>number.format(value);
const fold=(value:string)=>value.normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
const sorts={catalogue:'Ordre du catalogue',name:'Nom',price:'Prix unitaire',stock:'Stock disponible'} as const;
const filters={all:'Tous les biens',buy:'Achats',sell:'Ventes',negotiable:'Échanges possibles'} as const;
const sideLabel=(side:Side)=>side==='buy'?'Acheter':side==='sell'?'Vendre':'Donner';
const row=(id:string,label:string,value?:string,detail?:string):NativeRow=>({id,label,value,detail,region:'details'});
const refusal=(good:WorldTradeGood)=>good.refusal??(good.unitPrice===null?'Valeur de ce bien indisponible.':undefined);
type Selection={quantity:number;side:Side};
type Captured={lines:CommercialBuyLine[];signature:string;forgone:number;accepted:boolean};

/** Shared native editor for all off-map exchange channels. Only transient
 * choices live here: the adapter's real quote remains the sole owner of prices,
 * transfer restrictions, mass, relation changes, and the resulting command. */
export function createNativeWorldTradeDraft(options:Options):NativeWorldTradeDraft {
  let active=true,shown:NativePage|undefined,identity:string|undefined,phase:'basket'|'review'='basket',revision=0,submitting=false;
  let query='',sort:keyof typeof sorts='catalogue',filter:keyof typeof filters='all',acceptedSignature:string|undefined;
  const selected=new Map<number,Selection>();
  const id=(suffix:string)=>`${options.prefix}-${suffix}`;
  const current=(token:number,expected:typeof phase)=>active&&!submitting&&revision===token&&phase===expected&&!!shown&&options.isCurrent(shown);
  function read():WorldTradeView {
    const view=options.read();
    if(identity===undefined)identity=view.identity;
    if(!active||identity!==view.identity)throw Error('La visite commerciale ou la campagne a changé. Rouvrez le commerce.');
    return view;
  }
  function emit(page:NativePage):void {shown=page;options.show(page);}
  function leave():void {active=false;shown=undefined;selected.clear();acceptedSignature=undefined;options.back();}
  function lines(view:WorldTradeView):{ok:true;lines:CommercialBuyLine[]}|{ok:false;reason:string} {
    const goods=new Map(view.goods.map(good=>[good.id,good])),result:CommercialBuyLine[]=[];
    for(const [pileId,choice]of selected){
      const good=goods.get(pileId);
      if(!good||good.side!==choice.side||choice.quantity>good.available||refusal(good))return {ok:false,reason:good?refusal(good)??`Le lot ${pileId} ou son stock a changé.`:`Le lot ${pileId} n’est plus présent.`};
      result.push({pileId,quantity:options.mode==='mixed'&&choice.side==='sell'?-choice.quantity:choice.quantity});
    }
    return {ok:true,lines:result.sort((a,b)=>a.pileId-b.pileId)};
  }
  function quote(view:WorldTradeView):WorldTradeQuote {
    const basket=lines(view);if(!basket.ok)return basket;
    if(!basket.lines.length)return {ok:false,reason:'Choisissez au moins un bien.'};
    return view.quote(basket.lines);
  }
  function edit(good:WorldTradeGood,text:string,token:number):boolean {
    if(!current(token,'basket'))return false;
    const view=read(),fresh=view.goods.find(entry=>entry.id===good.id),quantity=Number(text);
    if(!fresh||fresh.side!==good.side||refusal(fresh))throw Error(fresh?refusal(fresh)??'Le propriétaire de ce lot a changé.':'Ce lot n’est plus disponible.');
    const max=options.mode==='mixed'?Math.min(250000,fresh.available):fresh.available;
    if(!text.trim()||!Number.isSafeInteger(quantity)||quantity<0||quantity>max)throw Error(`Entier de 0 à ${max} requis.`);
    if(quantity)selected.set(good.id,{quantity,side:fresh.side});else selected.delete(good.id);
    acceptedSignature=undefined;render(view);return true;
  }
  function button(controlId:string,label:string,action:NativeControl['onActivate'],disabled=false,hint?:string,selected=false):NativeControl {
    return {id:controlId,label,disabled,hint,active:selected,onActivate:gesture=>{if(!disabled)return action(gesture);}};
  }
  function stockRow(good:WorldTradeGood,index:number,token:number):NativeRow {
    const count=selected.get(good.id)?.quantity??0,reason=refusal(good),max=options.mode==='mixed'?Math.min(250000,good.available):good.available,controlId=`${options.goodPrefix}-${good.id}`;
    const value=`${sideLabel(good.side)} · ${good.available} disponibles · ${good.unitPrice===null?'Valeur indisponible':`${worldTradeAmount(good.unitPrice)} ${good.side==='gift'?'de valeur':'argent'}/unité`}`;
    const input:NativeRow['input']=reason?undefined:{value:String(count),kind:'number',onCommit:text=>{if(!edit(good,text,token))return false;input!.value=String(Number(text));return true;}};
    return {id:controlId,label:good.label,value,detail:[good.detail,reason].filter(Boolean).join(' · ')||undefined,hint:[good.label,`Lot n° ${good.id}`,value,good.detail,reason].filter(Boolean).join('\n'),region:'catalogue',
      tradeEntry:{side:good.side,available:good.available,unitPrice:good.unitPrice,quantity:good.side==='buy'?count:-count,refused:!!reason,index,icon:good.icon},input,
      controls:[button(`${controlId}-less`,'−',()=>{edit(good,String(count-1),token);},!!reason||count<=0),button(`${controlId}-more`,'+',()=>{edit(good,String(count+1),token);},!!reason||count>=max)]};
  }
  function visible(goods:readonly WorldTradeGood[]):WorldTradeGood[] {
    const needle=fold(query.trim()),list=goods.filter(good=>(filter==='all'||filter==='negotiable'&&!refusal(good)||filter===good.side)&&(!needle||fold([good.label,good.detail,good.refusal,sideLabel(good.side),String(good.id)].filter(Boolean).join(' ')).includes(needle)));
    if(sort==='name')list.sort((a,b)=>collator.compare(a.label,b.label)||a.id-b.id);
    else if(sort==='price')list.sort((a,b)=>(a.unitPrice??Infinity)-(b.unitPrice??Infinity)||a.id-b.id);
    else if(sort==='stock')list.sort((a,b)=>b.available-a.available||a.id-b.id);
    return list;
  }
  function filtersRow(token:number):NativeRow {
    const change=(write:()=>void)=>{if(!current(token,'basket'))return false;const view=read();write();render(view);return true;};
    const filterOptions=Object.entries(filters).filter(([key])=>key==='all'||key==='negotiable'||options.mode==='mixed');
    const chooser:NativeControl={...button(id('filter'),filters[filter],()=>{}),select:{value:filter,options:filterOptions.map(([value,label])=>({value,label})),onChange:value=>{if(filterOptions.some(([key])=>key===value))change(()=>{filter=value as keyof typeof filters;});}}};
    const sorter:NativeControl={...button(id('sort'),sorts[sort],()=>{}),select:{value:sort,options:Object.entries(sorts).map(([value,label])=>({value,label:options.mode==='gift'&&value==='price'?'Valeur unitaire':label})),onChange:value=>{if(Object.hasOwn(sorts,value))change(()=>{sort=value as keyof typeof sorts;});}}};
    if(options.mode==='gift'&&sort==='price')sorter.label='Valeur unitaire';
    return {id:id('search'),label:'Rechercher',region:'navigation',hint:'Trier ou filtrer les lots sans modifier le panier.',input:{value:query,placeholder:'Rechercher une marchandise',maxLength:160,onCommit:value=>change(()=>{query=value;})},controls:[chooser,sorter]};
  }
  function render(view=read()):void {
    const token=++revision;phase='basket';const stock=visible(view.goods),checked=quote(view),hidden=selected.size-stock.filter(good=>selected.has(good.id)).length;
    const accepted=checked.ok&&acceptedSignature===checked.signature;
    const rows:NativeRow[]=[...view.navigation.map(r=>({...r,region:'navigation' as const})),filtersRow(token),
      {id:id('stock-heading'),label:'Marchandises',region:'toolbar',tradeHeading:{source:options.sourceLabel,partner:options.partnerLabel,gift:options.mode==='gift'},hint:options.mode==='gift'?'Chaque ligne est un lot réellement porté. La valeur reconnue du don ne constitue pas un paiement.':'Chaque ligne est un lot réel du stock du propriétaire indiqué.'},
      ...stock.map((good,index)=>stockRow(good,index,token))];
    if(!stock.length)rows.push({id:id('no-goods'),label:view.goods.length?'Aucun bien ne correspond aux filtres.':'Aucun lot commercial disponible.',region:'catalogue'});
    rows.push(row(id('basket-count'),`${selected.size} lot(s) dans le panier`,`${stock.length} / ${view.goods.length} affichés`,hidden?`${hidden} lot(s) du panier masqués ou absents de la liste. La vérification conserve le panier entier.`:undefined));
    if(!selected.size)rows.push(row(id('draft-empty'),'Panier du brouillon','Aucun bien choisi'));
    else if(checked.ok)rows.push(...checked.preview.map(r=>({...r,region:'details' as const})));
    else rows.push(row(id('draft-refusal'),'Brouillon non admissible',checked.reason));
    if(checked.ok&&checked.forgone)rows.push({...row(id('shortfall'),`${worldTradeAmount(checked.forgone)} argent sans contrepartie`,accepted?'Acceptée explicitement':'Acceptation requise'),controls:[button(id('shortfall-toggle'),accepted?'Refuser cette perte':'Accepter cette perte',()=>{
      if(!current(token,'basket'))return;const fresh=read(),now=quote(fresh);
      if(!now.ok||now.signature!==checked.signature){acceptedSignature=undefined;render(fresh);throw Error('Le montant a changé. Vérifiez la perte actuellement proposée.');}
      acceptedSignature=accepted?undefined:now.signature;render(fresh);
    },false,undefined,accepted)]});
    const back=()=>{if(current(token,'basket'))leave();};
    emit({id:options.id,title:options.title,modal:true,layout:'trade',width:NATIVE_TRADE.width,contentKey:JSON.stringify([query,sort,filter]),rows,actions:[
      button(id('clear-basket'),'Vider le panier',()=>{if(!current(token,'basket'))return;const fresh=read();selected.clear();acceptedSignature=undefined;render(fresh);},!selected.size),
      button(options.verifyId,'Vérifier le panier',()=>{if(current(token,'basket'))review();},!checked.ok||!!checked.forgone&&!accepted,checked.ok?'Vérifie aussi les lots masqués, puis demande une confirmation distincte.':checked.reason),
      button(`${options.id}-back`,'Retour',back),
    ],onClose:back,closeOwnsNavigation:true});
  }
  function review():void {
    const view=read(),basket=lines(view);if(!basket.ok)throw Error(basket.reason);if(!basket.lines.length)throw Error('Choisissez au moins un bien.');
    const checked=view.quote(basket.lines);if(!checked.ok)throw Error(checked.reason);
    const forgone=checked.forgone??0,accepted=acceptedSignature===checked.signature;
    if(forgone&&!accepted){render(view);throw Error('La part sans contrepartie exige une acceptation explicite de ce devis.');}
    const captured:Captured={lines:basket.lines.map(line=>({...line})),signature:checked.signature,forgone,accepted},goods=new Map(view.goods.map(good=>[good.id,good]));
    phase='review';const token=++revision,rows=[...checked.review.map(r=>({...r,region:undefined})),...captured.lines.map(line=>{const good=goods.get(line.pileId)!;return {id:id(`confirmed-${good.id}`),label:good.label,value:`${sideLabel(good.side)} × ${Math.abs(line.quantity)}`,detail:`Lot n° ${good.id}`};})];
    const back=()=>{if(!current(token,'review'))return;try{render();}catch(error){leave();throw error;}};
    emit({id:options.confirmId,title:checked.reviewTitle??options.confirmTitle,modal:true,layout:'message',width:NATIVE_MESSAGE.width,height:NATIVE_MESSAGE.height,rows,actions:[
      button(`${options.confirmId}-back`,'Revoir le panier',back),
      button(`${options.confirmId}-confirm`,'Confirmer',async()=>{
        if(!current(token,'review'))return;const fresh=read(),now=fresh.quote(captured.lines);
        if(!now.ok||now.signature!==captured.signature||(now.forgone??0)!==captured.forgone)throw Error(now.ok?'Le devis, le stock ou les propriétaires ont changé. Revenez au panier.':now.reason);
        if(captured.forgone&&!captured.accepted)throw Error('La perte doit être acceptée explicitement.');
        submitting=true;try{await options.send(now.command(captured.accepted));if(active&&shown&&options.isCurrent(shown))leave();else{active=false;shown=undefined;}}finally{submitting=false;}
      }),
    ],onClose:back,closeOwnsNavigation:true});
  }
  return {open(){render();},owns:page=>active&&shown===page,dispose(){active=false;shown=undefined;selected.clear();acceptedSignature=undefined;}};
}
