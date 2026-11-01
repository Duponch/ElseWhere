import {queryFirefoamUseReason290} from '../sim/firefoam-manual-290';
import {footprintContains} from '../sim/definitions';
import {firefoamResearchUnlocked290} from '../sim/firefoam-content-290';
import type {Cell,Command,Structure,World} from '../sim/types';

type RebuildCommand=Extract<Command,{type:'firefoam-auto-rebuild'}>;
type TriggerCommand=Extract<Command,{type:'firefoam-trigger'}>;
const controllers=new WeakMap<HTMLElement,{refresh(world:World,structure?:Structure):void}>();

/** Confirmed installed state owns the checkbox and wick. Sending an option
 * never writes a Structure or invents a start/end time in the browser. */
export function firefoamControls290(world:World,structure:Structure,send:(command:RebuildCommand)=>unknown):HTMLElement {
 const section=document.createElement('section');section.className='cell-facts';section.dataset.firefoam=String(structure.id);
 const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.firefoamAutoRebuild=String(structure.id);
 label.append(input,' Reconstruire automatiquement');
 const state=document.createElement('p');state.dataset.firefoamState=String(structure.id);
 const help=document.createElement('p');help.className='muted';help.textContent='Usage unique. Détection à moins de 3 cases par un passage accessible ; les portes fermées la bloquent. La mousse atteint 9,9 cases autour de l’appareil selon les obstacles. Pour déclencher manuellement : sélectionnez un colon démobilisé, puis donnez l’ordre sur cet appareil. Le colon doit travailler au contact.';
 const cost=document.createElement('p');cost.textContent='Reconstruire demande un nouveau plan, 75 acier, 1 composant et une construction complète. La mousse au sol salit la pièce et doit être nettoyée.';
 const status=document.createElement('p');status.dataset.firefoamStatus=String(structure.id);status.setAttribute('role','status');section.append(label,state,help,cost,status);
 let current=structure,currentWorld=world,available=false,pending=false,sent:boolean|undefined,feedback='';
 function paint(){
  available=[290,291,292,293,294,295,296,297,298,299,300].includes(currentWorld.schemaVersion)&&current.kind==='firefoam-popper'&&!!current.firefoam290&&currentWorld.structures.includes(current);
  const optionAllowed=firefoamResearchUnlocked290(currentWorld)&&current.factionId===undefined;
  section.hidden=!available;input.checked=sent??current.firefoam290?.autoRebuild??false;input.disabled=!available||!optionAllowed||pending||sent!==undefined;
  const wick=current.firefoam290?.wick;
  state.textContent=wick?`Mèche déclenchée : diffusion dans ${(Math.max(0,wick.endCore-currentWorld.tick*10)/60).toFixed(1)} s au plus. L’appareil sera consommé.`:'Prêt : aucune mèche déclenchée.';
  status.textContent=pending||sent!==undefined?'Commande envoyée ; attente de la confirmation.':feedback||(!optionAllowed?'La reconstruction automatique demande un appareil colonial et la recherche Mousse anti-incendie.':'Réglage confirmé.');section.setAttribute('aria-busy',String(pending||sent!==undefined));
 }
 input.onchange=()=>{
  if(!available||input.disabled||pending||sent!==undefined)return;const on=input.checked;sent=on;pending=true;feedback='';paint();
  const refused=(error:unknown)=>{sent=undefined;feedback=error instanceof Error?error.message:String(error);};
  try{void Promise.resolve(send({type:'firefoam-auto-rebuild',structureId:structure.id,on})).catch(refused).finally(()=>{pending=false;paint();});}
  catch(error){refused(error);pending=false;paint();}
 };
 const controller={refresh(nextWorld:World,next?:Structure){
  currentWorld=nextWorld;if(next?.id===structure.id)current=next;
  if(!next||![290,291,292,293,294,295,296,297,298,299,300].includes(nextWorld.schemaVersion)){sent=undefined;pending=false;section.hidden=true;return;}
  if(sent!==undefined&&next.firefoam290?.autoRebuild===sent){sent=undefined;feedback='Reconstruction confirmée.';}paint();
 }};controllers.set(section,controller);paint();return section;
}
export function updateFirefoamControls290(parent:ParentNode,world:World,structure?:Structure):void {
 for(const section of parent.querySelectorAll<HTMLElement>('[data-firefoam]'))controllers.get(section)?.refresh(world,structure);
}

/** Uses the same pure authority as the SIM command. The action is direct,
 * unqueued and acquires neither contact time nor wick on the UI side. */
export function appendFirefoamOptions290(parent:HTMLElement,world:World,pawnId:number,cell:Cell,queue:boolean,actions:{close():void;send(command:TriggerCommand):Promise<unknown>;report(message:string,error?:boolean):void}):number {
 if(![290,291,292,293,294,295,296,297,298,299,300].includes(world.schemaVersion))return 0;
 const structures=world.structures.filter(s=>s.kind==='firefoam-popper'&&footprintContains(s,cell)).sort((a,b)=>a.id-b.id);
 for(const structure of structures){
  const reason=queue?'Déclenchement direct ; relâchez Maj.':queryFirefoamUseReason290(world,pawnId,structure.id);
  const button=parent.ownerDocument.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset.orderFirefoam=String(structure.id);
  button.textContent='Déclencher sur place : mousse anti-incendie'+(reason?` — ${reason}`:'');button.disabled=!!reason;
  button.onclick=event=>{if(reason)return;if(event.shiftKey){actions.report('Déclenchement direct ; relâchez Maj.',true);return;}actions.close();void actions.send({type:'firefoam-trigger',pawnId,structureId:structure.id}).then(()=>actions.report('Déclenchement demandé : trajet et travail au contact.')).catch(error=>actions.report(error instanceof Error?error.message:String(error),true));};
  parent.append(button);
 }
 return structures.length;
}
