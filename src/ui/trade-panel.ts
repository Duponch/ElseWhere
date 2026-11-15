import { isColonist } from '../sim/affiliation';
import { ITEM_DEFINITIONS } from '../sim/items';
import { weaponLabel } from '../sim/equipment-rules';
import {apparelLabel,apparelDefinition} from '../sim/apparel-rules';
import { negotiatorRefusal,tradingAtContact } from '../sim/trade-contact';
import { tradeGoods,quoteTrade,tradeImprovement } from '../sim/trade-goods';
import { isSculptureMaterial,sculptureMaxHitPoints } from '../sim/furniture-stats';
import { visitorMayTrade,visitorMerchantLabel } from '../sim/visitors';
import type { Command,World } from '../sim/types';
import type { TradeLine } from '../sim/trade-state';
import './trade-panel.css';
import { actorNotificationTarget,NotificationFocusCycle } from './notification-focus';

export function createTradeUI(send:(c:Command)=>Promise<unknown>,pause:()=>Promise<unknown>,focus:(id:number)=>void,resume:()=>Promise<unknown>) {
  const button=document.createElement('button');button.id='trade-letter';button.className='arrival-letter';
  const dialog=document.createElement('dialog');dialog.id='trade-dialog';dialog.className='trade-dialog';
  const heading=document.createElement('h2');heading.textContent='Visiteurs et commerce';
  const trader=document.createElement('select'),colonist=document.createElement('select');trader.id='trade-merchant';colonist.id='trade-negotiator';trader.setAttribute('aria-label','Marchand');colonist.setAttribute('aria-label','Négociateur');
  const contact=document.createElement('button');contact.id='trade-contact';contact.textContent='Rejoindre le marchand';
  const status=document.createElement('p'),hint=document.createElement('p');hint.className='muted';hint.textContent='Les biens à vendre et l’argent doivent être accessibles dans le foyer ou une réserve. Les objets réservés, portés et les provisions personnelles sont exclus.';
  const table=document.createElement('table');table.id='trade-goods';
  const total=document.createElement('p'),error=document.createElement('p');error.id='trade-error';error.setAttribute('role','alert');total.id='trade-total';
  const shortfall=document.createElement('label'),accept=document.createElement('input');accept.type='checkbox';accept.id='trade-shortfall';shortfall.append(accept,' Accepter la perte d’argent indiquée');shortfall.hidden=true;
  const confirm=document.createElement('button'),close=document.createElement('button');confirm.id='trade-confirm';close.id='trade-close';confirm.textContent='Conclure l’échange';close.textContent='Fermer';
  dialog.append(heading,trader,colonist,contact,status,hint,table,total,shortfall,error,confirm,close);document.body.append(dialog);
  let current:World|undefined,last=-Infinity,stockKey='',readyKey='',shownQuote='',busy=false;
  const cycle=new NotificationFocusCycle();
  const quantities=new Map<string,number>();
  const lines=():TradeLine[]=>[...quantities].filter(([,n])=>n!==0).map(([key,quantity])=>key.startsWith('packed:')?{packedId:Number(key.slice(7)),quantity}:{pileId:Number(key.slice(5)),quantity});
  function balance(){
    confirm.disabled=true;shortfall.hidden=true;if(!current)return;
    const q=quoteTrade(current,Number(colonist.value),Number(trader.value),lines());
    if(!q.ok){total.textContent=lines().length?q.reason:'Choisissez les quantités à acheter ou vendre.';return;}
    total.textContent=q.net>=0?`À payer : ${q.net} argent.`:`À recevoir : ${-q.paid} argent${q.forgone?` · Le marchand manque de ${q.forgone} argent.`:'.'}`;
    shownQuote=q.signature;shortfall.hidden=!q.forgone;confirm.disabled=busy||!!q.forgone&&!accept.checked;
  }
  async function run(action:()=>Promise<unknown>){if(busy)return;busy=true;error.textContent='';render();try{await action();}catch(e){error.textContent=e instanceof Error?e.message:String(e);}finally{busy=false;if(dialog.open)render();else balance();}}
  button.onclick=()=>{const target=cycle.next('visitors',(current?.pawns??[]).filter(p=>p.visitor&&p.state!=='dead').sort((a,b)=>a.id-b.id).map(p=>actorNotificationTarget(p.id)));if(target?.kind==='actor')focus(target.id);if(!dialog.open)dialog.showModal();stockKey='';last=-Infinity;render();};
  close.onclick=()=>dialog.close();dialog.onclose=()=>{const p=current?.pawns.find(p=>p.id===Number(colonist.value));if(p?.trade)void run(()=>send({type:'cancel-trade',pawnId:p.id}));};
  dialog.oncancel=e=>{if(busy)e.preventDefault();};
  const reset=()=>{quantities.clear();stockKey='';readyKey='';accept.checked=false;render();};trader.onchange=reset;colonist.onchange=reset;accept.onchange=balance;
  contact.onclick=()=>void run(async()=>{if(!current)return;if(!current.visitors){await send({type:'enable-visitors'});return;}const id=Number(trader.value);focus(id);await send({type:'order-trade',pawnId:Number(colonist.value),traderId:id});await resume();});
  confirm.onclick=()=>void run(async()=>{if(!current)return;const pawnId=Number(colonist.value),traderId=Number(trader.value),basket=lines(),q=quoteTrade(current,pawnId,traderId,basket);if(!q.ok)throw new Error(q.reason);if(q.signature!==shownQuote){render();throw new Error('Le panier a changé : vérifiez les nouveaux prix avant de confirmer.');}await send({type:'trade-execute',pawnId,traderId,lines:basket,quote:q.signature,acceptShortfall:accept.checked});quantities.clear();stockKey='';readyKey='';dialog.close();});
  function options(select:HTMLSelectElement,entries:{id:number;label:string}[]){const key=entries.map(e=>e.id+':'+e.label).join('|');if(select.dataset.key===key)return;const prior=select.value;select.replaceChildren(...entries.map(e=>new Option(e.label,String(e.id))));if(entries.some(e=>String(e.id)===prior))select.value=prior;select.dataset.key=key;}
  function render(){
    if(!current||!dialog.open)return;
    const w=current,merchants=w.pawns.filter(p=>visitorMayTrade(w,p));
    options(trader,merchants.map(p=>({id:p.id,label:visitorMerchantLabel(w,p)})));
    options(colonist,w.pawns.filter(p=>isColonist(p)&&p.state!=='dead').map(p=>({id:p.id,label:`${p.name} · Social ${p.skills.social?.level??0}`})));
    const p=w.pawns.find(p=>p.id===Number(colonist.value)),t=w.pawns.find(p=>p.id===Number(trader.value));
    trader.hidden=colonist.hidden=!w.visitors;contact.textContent=w.visitors?'Rejoindre le marchand':'Autoriser les prochaines visites';
    close.disabled=busy;trader.disabled=colonist.disabled=busy||!!p?.trade;
    contact.disabled=busy||!!w.visitors&&(!p||!t||!!p.trade||!!negotiatorRefusal(p,w.schemaVersion));
    const ready=!!p&&!!t&&tradingAtContact(w,p,t);table.hidden=hint.hidden=confirm.hidden=shortfall.hidden=!ready;
    status.textContent=!w.visitors?'Cette ancienne partie conserve son calendrier. Autorisez les visites à partir de maintenant.':!t?'Aucun marchand disponible. Les visiteurs ne commercent pas tous.':p?.trade?.traderId===t.id?(ready?`Au contact · avantage du négociateur ${(tradeImprovement(p)*100).toFixed(1)} %`:'Le négociateur rejoint le marchand.'):(p&&negotiatorRefusal(p,w.schemaVersion))??'Rejoindre reprend le temps si nécessaire. La partie se mettra en pause au contact.';
    if(!ready){total.textContent='';confirm.disabled=true;return;}
    const key=`${p.id}:${t.id}:${p.trade!.startedAt}`;
    if(readyKey!==key&&!busy){readyKey=key;void run(pause);}
    const stock=tradeGoods(w,p,t),next=[...stock.goods.map(g=>`${g.pile.id}:${g.available}:${g.unitPrice}:${g.refusal??''}:${g.pile.apparel?.quality??''}:${g.pile.apparel?.hitPoints??''}`),...stock.artGoods.map(g=>`art:${g.packed.building.id}:${g.packed.building.kind}:${g.packed.building.material}:${g.packed.building.quality}:${g.packed.building.damage??0}:${g.unitPrice}`)].join('|');
    if(stockKey!==next){
      stockKey=next;table.replaceChildren();const head=document.createElement('tr');for(const x of ['Objet','Échange','Stock','Prix unitaire','Quantité']){const th=document.createElement('th');th.textContent=x;head.append(th);}table.append(head);
      for(const g of stock.goods){
        const tr=document.createElement('tr'),name=document.createElement('td'),side=document.createElement('td'),available=document.createElement('td'),price=document.createElement('td'),quantity=document.createElement('td');
        name.textContent=g.pile.weapon?weaponLabel(g.pile):g.pile.apparel?`${apparelLabel(g.pile)} · ${g.pile.apparel.hitPoints}/${apparelDefinition(g.pile).hitPoints} PV`:ITEM_DEFINITIONS[g.pile.item].label;side.textContent=g.side==='buy'?'Acheter':'Vendre';available.textContent=String(g.available);price.textContent=g.refusal?'Refusé':g.unitPrice.toFixed(2);if(g.refusal)tr.title=g.refusal;
        const input=document.createElement('input');input.type='number';input.min='0';input.max=String(g.available);input.step='1';input.value=String(Math.abs(quantities.get(`pile:${g.pile.id}`)??0));input.disabled=!!g.refusal;input.dataset.pile=String(g.pile.id);input.dataset.item=g.pile.item;input.dataset.side=g.side;input.setAttribute('aria-label',`${side.textContent} ${name.textContent}`);
        input.oninput=()=>{const n=Number(input.value);quantities.set(`pile:${g.pile.id}`,(g.side==='buy'?1:-1)*n);accept.checked=false;balance();};quantity.append(input);tr.append(name,side,available,price,quantity);table.append(tr);
      }
      for(const g of stock.artGoods){
        const b=g.packed.building,kind=b.kind;
        if(kind!=='small-sculpture'&&kind!=='large-sculpture')continue;
        const tr=document.createElement('tr'),name=document.createElement('td'),side=document.createElement('td'),available=document.createElement('td'),price=document.createElement('td'),quantity=document.createElement('td');
        const max=isSculptureMaterial(b.material)?sculptureMaxHitPoints(kind,b.material):0;
        const author=w.pawns.find(a=>a.id===b.art?.authorId)?.name??`#${b.art?.authorId??'?'}`;
        name.textContent=`${kind==='small-sculpture'?'Petite sculpture':'Grande sculpture'} · ${b.material?ITEM_DEFINITIONS[b.material].label:'matière inconnue'} · ${b.quality??'normal'} · ${max-(b.damage??0)}/${max} PV · ${author}`;
        side.textContent=g.side==='buy'?'Acheter':'Vendre';available.textContent='1';price.textContent=g.unitPrice.toFixed(2);
        const key=`packed:${b.id}`,input=document.createElement('input');input.type='number';input.min='0';input.max='1';input.step='1';input.value=String(Math.abs(quantities.get(key)??0));input.dataset.packed=String(b.id);input.dataset.side=g.side;input.setAttribute('aria-label',`${side.textContent} ${name.textContent}`);
        input.oninput=()=>{const n=Number(input.value);quantities.set(key,(g.side==='buy'?1:-1)*n);accept.checked=false;balance();};quantity.append(input);tr.append(name,side,available,price,quantity);table.append(tr);
      }
    }
    const money=stock.silver.reduce((n,x)=>n+x.quantity,0),merchant=stock.merchantSilver.reduce((n,x)=>n+x.quantity,0);hint.textContent=`Argent disponible : colonie ${money}, marchand ${merchant}. Biens au foyer ou en réserve, accessibles et non réservés. Les achats seront déposés au contact, puis rangés par les colons.`;balance();
  }
  return {reset:()=>cycle.reset(),update(w:World){current=w;const count=w.pawns.filter(p=>p.visitor&&p.state!=='dead').length;button.textContent=w.visitors?`Visiteurs : ${count} · Commerce`:'Activer les visites';const alerts=document.getElementById('alerts')!;if(button.parentElement!==alerts)alerts.append(button);if(dialog.open&&performance.now()-last>250){last=performance.now();render();}}};
}
