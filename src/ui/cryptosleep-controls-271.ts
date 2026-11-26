import {isSchema271OrLater} from '../sim/schema-compatibility-257.ts';
import {footprintContains} from '../sim/definitions';
import {cryptosleepIntent271,cryptosleepLastColonist271} from '../sim/cryptosleep-intent-271';
import {isPlayerCasket271,type CryptosleepCommand271} from '../sim/cryptosleep-state-271';
import type {Cell,Command,World} from '../sim/types';
import {orderedIntentReason378} from '../sim/ordered-queue-378';
import {personalOrderCommands378} from './order-queue-378';

export interface CryptosleepOption271 {label:string;command:CryptosleepCommand271;enabled:boolean;reason?:string;confirmLast:boolean}
/** Cold context-menu read: use the same real route/claim admission as commands.
 * The acknowledgement used for preflight never sends or accepts an order. */
export function cryptosleepOptions271(w:World,pawnId:number,cell:Cell,queue=false):CryptosleepOption271[]{
 if(!isSchema271OrLater(w.schemaVersion))return [];
 const actor=w.pawns.find(p=>p.id===pawnId);if(!actor)return [];
 const target=w.structures.find(s=>isPlayerCasket271(s)&&footprintContains(s,cell));
 const patient=w.pawns.find(p=>p.id!==pawnId&&p.state==='downed'&&p.x===cell.x&&p.z===cell.z);
 const caskets=target?[target]:patient?w.structures.filter(isPlayerCasket271).filter(s=>!s.cryptosleep.human).sort((a,b)=>(a.x-actor.x)**2+(a.z-actor.z)**2-((b.x-actor.x)**2+(b.z-actor.z)**2)||a.id-b.id):[];
 const options:CryptosleepOption271[]=[];
 const add=(label:string,command:CryptosleepCommand271)=>{
  const confirmLast=command.type==='order-enter-cryptosleep'&&cryptosleepLastColonist271(w,pawnId);
  const check=cryptosleepIntent271(w,command.type==='order-enter-cryptosleep'&&confirmLast?{...command,confirmLastColonist:true}:command);
  const reason=queue?Number(w.schemaVersion)>=378?orderedIntentReason378(w,command.type==='order-enter-cryptosleep'&&confirmLast?{...command,confirmLastColonist:true}:command):'Le cryptosommeil est un ordre direct ; relâchez Maj.':!check.ok?check.reason.replaceAll(' dans cette tranche',''):undefined;
  options.push({label,command,enabled:!reason,...reason?{reason}:{},confirmLast});
 };
 for(const casket of caskets){
  if(casket.cryptosleep?.human){add(`Ouvrir le caisson de ${casket.cryptosleep.human.name}`,{type:'order-open-cryptosleep',pawnId,casketId:casket.id});continue;}
  if(target)add('Entrer dans le caisson de cryptosommeil',{type:'order-enter-cryptosleep',pawnId,casketId:casket.id});
  const patients=patient?[patient]:w.pawns.filter(p=>p.id!==pawnId&&p.state==='downed');
  for(const p of patients)add(`Porter ${p.name} dans le caisson (${casket.x}, ${casket.z})`,{type:'order-carry-cryptosleep',pawnId,patientId:p.id,casketId:casket.id});
 }
 return options;
}

/** Deliberate modal action. Escape/Cancel never sends an acknowledgement. */
export function confirmLastCryptosleep271(doc:Document,name:string,accept:()=>void):HTMLDialogElement {
 const previous=doc.activeElement,dialog=doc.createElement('dialog'),title=doc.createElement('h3'),text=doc.createElement('p'),cancel=doc.createElement('button'),enter=doc.createElement('button');
 dialog.className='help-dialog';dialog.dataset.cryptosleepConfirmation='';dialog.setAttribute('aria-label','Dernier colon avant le cryptosommeil');
 title.textContent='Dernier colon hors des caissons';
 text.textContent=`${name} est le dernier colon libre encore présent hors des caissons. Une autre personne devra ouvrir son caisson sur place. Continuer ?`;
 const close=()=>{dialog.close();dialog.remove();if(previous instanceof HTMLElement&&previous.isConnected)previous.focus({preventScroll:true});};
 cancel.type=enter.type='button';cancel.textContent='Annuler';enter.textContent='Entrer en cryptosommeil';enter.dataset.confirmCryptosleep='';
 cancel.onclick=close;let accepted=false;enter.onclick=()=>{if(accepted)return;accepted=true;close();accept();};
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 for(const type of ['pointerdown','pointerup','click','dblclick','keydown','keyup'] as const)dialog.addEventListener(type,event=>event.stopPropagation());
 dialog.append(title,text,cancel,enter);doc.body.append(dialog);dialog.showModal();cancel.focus();return dialog;
}

export function appendCryptosleepOptions271(parent:HTMLElement,w:World,pawnId:number,cell:Cell,queue:boolean,actions:{close():void;send(command:Command):Promise<unknown>;report(message:string,error?:boolean):void}):number {
 const options=cryptosleepOptions271(w,pawnId,cell,queue);
 for(const option of options){
  const button=parent.ownerDocument.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.cryptosleepOrder=option.command.type;button.dataset.cryptosleepCasket=String(option.command.casketId);
  if(option.command.type==='order-carry-cryptosleep')button.dataset.cryptosleepPatient=String(option.command.patientId);
  button.textContent=option.label+(option.reason?` — ${option.reason}`:'');button.disabled=!option.enabled;
  button.onclick=event=>{
   if(!option.enabled)return;if(event.shiftKey&&Number(w.schemaVersion)<378){actions.report('Le cryptosommeil est un ordre direct ; relâchez Maj.',true);return;}
   actions.close();const send=(command:CryptosleepCommand271)=>void actions.send(personalOrderCommands378(w,command,queue||event.shiftKey)[0]!).then(()=>actions.report('Ordre de cryptosommeil accepté.')).catch(error=>actions.report(error instanceof Error?error.message:String(error),true));
   if(option.confirmLast&&option.command.type==='order-enter-cryptosleep'){
    const command=option.command;confirmLastCryptosleep271(parent.ownerDocument,w.pawns.find(p=>p.id===pawnId)?.name??'Ce colon',()=>send({...command,confirmLastColonist:true}));
   }else send(option.command);
  };parent.append(button);
 }
 return options.length;
}
