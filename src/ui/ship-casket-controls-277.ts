import {isSchema277OrLater} from '../sim/schema-compatibility-257';
import {isShipCasket277,type ShipCasketCommand277,type ShipCasketPatient277} from '../sim/ship-casket-state-277';
import {shipCasketContains277} from '../sim/ship-casket-geometry-277';
import {shipCasketIntent277} from '../sim/ship-casket-intent-277';
import {shipCasketSubject277} from '../sim/ship-casket-carry-277';
import {shipCasketOccupantLabel277} from '../sim/ship-casket-task-277';
import type {Cell,Command,World} from '../sim/types';
import {orderedIntentReason378} from '../sim/ordered-queue-378';
import {personalOrderCommands378} from './order-queue-378';

export interface ShipCasketOption277 {label:string;command:ShipCasketCommand277;enabled:boolean;reason?:string}
/** These cold menu proposals use the same real admission as commands. No
 * confirmation or extra worker is invented for a player-ejectable casket. */
export function shipCasketOptions277(w:World,pawnId:number,cell:Cell,queue=false,targetId?:number):ShipCasketOption277[]{
 if(!isSchema277OrLater(w.schemaVersion))return [];
 const p=w.pawns.find(q=>q.id===pawnId);if(!p)return [];
 const target=w.structures.find(s=>isShipCasket277(s)&&(targetId===undefined||s.id===targetId)&&shipCasketContains277(s,cell,s.orientation));
 const all:ShipCasketPatient277[]=[...w.pawns.filter(a=>a.id!==pawnId&&a.state==='downed').map(a=>({kind:'human' as const,id:a.id})),...w.wildlife?.animals.filter(a=>a.state==='downed').map(a=>({kind:'animal' as const,id:a.id}))??[],...w.mechanoids?.filter(a=>a.state==='downed').map(a=>({kind:'mechanical' as const,id:a.id}))??[]];
 const clicked=all.filter(r=>{const o=shipCasketSubject277(w,r)!,a=o.kind==='human'?o.pawn:o.kind==='animal'?o.animal:o.mech;return (targetId===undefined||a.id===targetId)&&a.x===cell.x&&a.z===cell.z;});
 const caskets=target?[target]:clicked.length?w.structures.filter(isShipCasket277).filter(s=>!s.shipCryptosleep277.occupant).sort((a,b)=>(a.x-p.x)**2+(a.z-p.z)**2-((b.x-p.x)**2+(b.z-p.z)**2)||a.id-b.id):[];
 const out:ShipCasketOption277[]=[];
 for(const c of caskets){
  if(!isShipCasket277(c))continue;
  if(c.shipCryptosleep277.occupant){out.push({label:'Éjecter l’occupant du caisson spatial',command:{type:'eject-ship-casket',casketId:c.id},enabled:!queue,...queue?{reason:'L’éjection est une commande directe ; relâchez Maj.'}:{}});continue;}
  const add=(label:string,command:Exclude<ShipCasketCommand277,{type:'eject-ship-casket'}>)=>{const plan=shipCasketIntent277(w,command),reason=queue?Number(w.schemaVersion)>=378?orderedIntentReason378(w,command):'Le cryptosommeil est un ordre direct ; relâchez Maj.':!plan.ok?plan.reason:undefined;out.push({label,command,enabled:!reason,...reason?{reason}:{}});};
  if(target)add('Entrer dans le caisson spatial',{type:'order-enter-ship-casket',pawnId,casketId:c.id});
  for(const patient of target?all:clicked){const o=shipCasketSubject277(w,patient)!;add(`Porter ${shipCasketOccupantLabel277(o)} dans le caisson spatial (${c.x}, ${c.z})`,{type:'order-carry-ship-casket',pawnId,patient,casketId:c.id});}
 }
 return out;
}
export function appendShipCasketOptions277(parent:HTMLElement,w:World,pawnId:number,cell:Cell,queue:boolean,actions:{close():void;send(command:Command):Promise<unknown>;report(message:string,error?:boolean):void},targetId?:number):number {
 const options=shipCasketOptions277(w,pawnId,cell,queue,targetId);
 for(const option of options){
  const b=parent.ownerDocument.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.shipCasketOrder=option.command.type;b.dataset.shipCasket=String(option.command.casketId);
  if(option.command.type==='order-carry-ship-casket')b.dataset.shipCasketPatient=`${option.command.patient.kind}:${option.command.patient.id}`;
  b.textContent=option.label+(option.reason?` — ${option.reason}`:'');b.disabled=!option.enabled;
  b.onclick=event=>{if(!option.enabled)return;if(event.shiftKey&&Number(w.schemaVersion)<378){actions.report('Le caisson spatial utilise un ordre direct ; relâchez Maj.',true);return;}actions.close();void actions.send(personalOrderCommands378(w,option.command,queue||event.shiftKey)[0]!).then(()=>actions.report('Ordre de caisson spatial accepté.')).catch(error=>actions.report(error instanceof Error?error.message:String(error),true));};parent.append(b);
 }
 return options.length;
}
