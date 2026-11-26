import type {Pawn,World} from '../sim/types';
import {pawnBanishRefusal378,pawnRenameRefusal378} from '../sim/pawn-identity-378';
import {wouldBeLeftToDie378} from '../sim/banish-risk-378';
import {validPawnNameInput378} from '../sim/pawn-identity-state-378';
import {registeredMapId} from '../sim/world-map-context';
import {itemTitle} from '../lore/lore-text';
import {ITEM_DEFINITIONS} from '../sim/items';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from './native-contract';

const possessions=(w:World,p:Pawn)=>w.piles.filter(i=>'pawnId'in i.owner&&i.owner.pawnId===p.id&&['inventory','equipment','apparel'].includes(i.owner.type));
const banishStamp=(w:World,p:Pawn)=>JSON.stringify([p.name,p.faction,p.worldAffiliation259,p.state==='downed',wouldBeLeftToDie378(w,p),possessions(w,p).map(i=>[i.id,i.item,i.quantity,i.apparel?.hitPoints,i.weapon]),w.packed.filter(i=>i.owner.type!=='ground'&&i.owner.pawnId===p.id)]);
/** One native modal session. It holds only a draft and captured authority;
 * Worker commands remain the sole mutation path. */
export function createPawnIdentityDialog378(initial:NativeUiState,pawn:Pawn,kind:'rename'|'banish',actions:NativeUiActions,close:()=>void,repaint:()=>void,isCurrent:()=>boolean=()=>true):(state:NativeUiState)=>NativePage {
 const epoch=initial.epoch,mapId=registeredMapId(initial.world!),seed=initial.world!.seed,id=pawn.id,originalName=pawn.name,stamp=kind==='banish'?banishStamp(initial.world!,pawn):undefined;
 let nick=pawn.nativeHuman?(pawn.nativeHuman.name.nickSet?pawn.nativeHuman.name.nick:''):pawn.name,title=pawn.identity378?.title??'',error='',pending=false;
 function checked(state:NativeUiState):{world:World;pawn:Pawn}{
  const w=state.world,p=w?.pawns.find(p=>p.id===id);if(state.busy||pending)throw Error('Une commande est déjà en cours.');
  if(!isCurrent()||state.epoch!==epoch||!w||w.seed!==seed||registeredMapId(w)!==mapId||!p||!state.selectedPawnIds.includes(id))throw Error('La personne ou la carte sélectionnée a changé.');
  const refusal=kind==='rename'?pawnRenameRefusal378(w,p):pawnBanishRefusal378(w,p);if(refusal)throw Error(refusal);
  if(p.name!==originalName||kind==='banish'&&banishStamp(w,p)!==stamp)throw Error('La situation a changé. Fermez cette fenêtre puis vérifiez à nouveau la décision.');
  return {world:w,pawn:p};
 }
 const button=(key:string,label:string,act:()=>void|Promise<unknown>,disabled=false):NativeControl=>({id:key,label,disabled:disabled||pending,onActivate:async()=>{
  if(disabled||pending||!isCurrent())return;error='';try{await act();}catch(e){error=e instanceof Error?e.message:String(e);}repaint();
 }});
 const commit=async()=>{
  checked(actions.readState?.()??initial);
  if(kind==='rename'&&(!validPawnNameInput378(nick)||!validPawnNameInput378(title)||!pawn.nativeHuman&&!nick.trim()))throw Error('Saisissez un nom de 1 à 16 lettres ou chiffres, espaces, apostrophes, points ou tirets ; le titre peut rester vide.');
  pending=true;try{
   const result=await actions.command(kind==='rename'?{type:'pawn-rename',pawnId:id,nick,title}:{type:'pawn-banish',pawnId:id});
   if(result&&typeof result==='object'&&'ok'in result&&result.ok===false)throw Error('reason'in result?String(result.reason):'La commande a été refusée.');
   close();actions.refresh();
  }finally{pending=false;}
 };
 return state=>{
  const w=state.world??initial.world!,p=w.pawns.find(p=>p.id===id)??pawn;
  const rows:NativePage['rows']=[];
  if(kind==='rename'){
   if(pawn.nativeHuman)rows.push({id:'pawn-name-first',label:'Prénom',value:pawn.nativeHuman.name.first},{id:'pawn-name-last',label:'Nom de famille',value:pawn.nativeHuman.name.last});
   rows.push({id:'pawn-name-nick',label:pawn.nativeHuman?'Surnom':'Nom',input:{value:nick,maxLength:16,onCommit:value=>{if(pending)return false;nick=value;error='';repaint();}}},
    {id:'pawn-name-title',label:'Titre',hint:'Un titre vide rétablit le titre de l’histoire de ce colon.',input:{value:title,maxLength:16,onCommit:value=>{if(pending)return false;title=value;error='';repaint();}}});
  }else{
   rows.push({id:'pawn-banish-confirmation',label:`Bannir ${pawn.name} de la colonie ?`,detail:'Cette personne gardera ses vêtements, son équipement et son inventaire, puis cherchera à quitter la carte.'});
   if(wouldBeLeftToDie378(w,p))rows.push({id:'pawn-banish-danger',label:'Ce bannissement risque de lui coûter la vie.',detail:'Son état de santé ou les températures de cette saison sont dangereux.'});
   for(const item of possessions(initial.world!,pawn))rows.push({id:`pawn-banish-item-${item.id}`,label:itemTitle(item.item,ITEM_DEFINITIONS[item.item].label),value:String(item.quantity)});
   rows.push({id:'pawn-banish-thoughts',label:'Les autres colons en garderont un souvenir pendant six jours.',detail:wouldBeLeftToDie378(w,p)?'Bannissement vers une mort probable : −6 ; les proches et amis éprouvent aussi du chagrin.':'Colon banni : −3.'});
  }
  if(error)rows.push({id:'pawn-identity-error',label:error});
  return {id:`pawn-${kind}-${id}`,title:kind==='rename'?'Renommer un colon':'Confirmer le bannissement',rows,layout:'dialog',modal:true,width:kind==='rename'?560:640,closeOwnsNavigation:true,onClose:close,onCancel:close,actions:[button('pawn-identity-cancel','Annuler',close),button(kind==='rename'?'pawn-rename-confirm':'pawn-banish-confirm',kind==='rename'?'OK':'Bannir',commit,state.busy)]};
 };
}
