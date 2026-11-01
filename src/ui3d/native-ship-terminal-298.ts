import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import type {NativePage,NativeRow,NativeUiState,NativeShipCurtainPhase298} from './native-contract';
import type {World} from '../sim/types';
import type {EscapedShipsSummary298} from '../sim/ship-escape-projection-298';
import {registeredMapId} from '../sim/world-map-context';
import {knownBuilding256} from '../ui/exploration-readers-256';
import {targetBuildingPlayerUse263} from '../sim/world-target-building-263';
import {indexShipParts276,readShipAssembly276} from '../sim/ship-part-reader-276';
import {SHIP_FRAME_MAXIMUM_DELTA_298} from '../bridge/ship-countdown-wire-298';

/** All state here is presentation-only. The options expose no Raw owner/archive. */
export interface NativeShipTerminalOptions298 {
  readState:()=>NativeUiState;
  /** Narrow adopted readers avoid rebuilding a complete UI state per frame. */
  readEpoch:()=>number|undefined;
  readCredits:()=>PublicCredits298|undefined;
  canPresent:()=>boolean;
  isPageCurrent:(id:string)=>boolean;
  show:(page:NativePage)=>void;
  close:(id:string)=>void;
  launch:(computerId:number)=>Promise<unknown>;
  continueCredits:(departureId:number)=>Promise<unknown>;
  onFrameDemandChanged:()=>void;
  /** Primitive presentation events only. Called without per-frame allocation. */
  onPresentation?:(ownerId:string,phase:NativeShipCurtainPhase298,fraction:number)=>void;
}
interface LaunchScope298 {
  epoch:number|undefined;mapId:number|undefined;seed:number;width:number;height:number;computerId:number;
}
interface LaunchPage298 {scope:LaunchScope298;id:string;rows:NativeRow[];pending:boolean;page?:NativePage;error?:string}
type PublicCredits298=NonNullable<EscapedShipsSummary298['credits']>;
interface CreditsPage298 {
  epoch:number|undefined;value:PublicCredits298;id:string;rows:NativeRow[];page?:NativePage;
  phase:'idle'|'closing'|'submitting'|'awaiting';remaining:number;error?:string;
}
const prefix='native-ship-terminal298:';
const message=(cause:unknown)=>cause instanceof Error?cause.message:String(cause);
const line=(id:string,label:string,value?:string):NativeRow=>({id,label,value});
/** The current adopted World wins even when it has no summary. A mapless
 * CampaignSummary is consulted ONLY when there is no current World. */
export function readAdoptedShipCredits298(world:NativeUiState['world'],campaign:NativeUiState['campaign'],hasGame:boolean):PublicCredits298|undefined {
  const source:{schemaVersion:number;escapedShipsSummary298?:EscapedShipsSummary298}|undefined=world!==undefined?world:campaign;
  return hasGame&&isSchema298OrLater(Number(source?.schemaVersion))?source?.escapedShipsSummary298?.credits??undefined:undefined;
}
const adoptedCredits298=(state:NativeUiState)=>readAdoptedShipCredits298(state.world,state.campaign,state.hasGame);
function scope298(state:NativeUiState,computerId:number):LaunchScope298|undefined {
  const world=state.world;if(!world||!isSchema298OrLater(Number(world.schemaVersion)))return;
  return {epoch:state.epoch,mapId:registeredMapId(world),seed:world.seed,width:world.width,height:world.height,computerId};
}
function currentComputer298(state:NativeUiState,scope:LaunchScope298):World['structures'][number]|undefined {
  const world=state.world,next=scope298(state,scope.computerId);
  if(!world||!next||next.epoch!==scope.epoch||next.mapId!==scope.mapId||next.seed!==scope.seed||next.width!==scope.width||next.height!==scope.height)return;
  const computer=world.structures.find(s=>s.id===scope.computerId&&s.kind==='ship-computer');
  return computer&&knownBuilding256(world,computer)&&targetBuildingPlayerUse263(world,computer)?computer:undefined;
}

/** A modal read view, not a launch permission or a saved clock. */
export function createNativeShipTerminal298(options:NativeShipTerminalOptions298) {
  let launch:LaunchPage298|undefined,credits:CreditsPage298|undefined,serial=0,disposed=false;
  let presentationOwner:string|undefined,presentationEpoch:number|undefined;
  function resetPresentation():void {
    if(presentationOwner!==undefined)options.onPresentation?.(presentationOwner,'reset',0);
    presentationOwner=undefined;presentationEpoch=undefined;
  }
  function presentCredits(value:CreditsPage298,phase:'closing'|'held',fraction:number):void {
    if(credits!==value||options.readEpoch()!==value.epoch||!options.canPresent()||!options.isPageCurrent(value.id)){resetPresentation();return;}
    presentationOwner=value.id;presentationEpoch=value.epoch;
    options.onPresentation?.(value.id,phase,fraction);
  }
  const currentLaunch=(value:LaunchPage298)=>!disposed&&launch===value&&options.isPageCurrent(value.id)&&!!currentComputer298(options.readState(),value.scope);
  const currentCredits=(value:CreditsPage298)=>{
    if(disposed||credits!==value)return false;
    const now=options.readCredits();
    return options.readEpoch()===value.epoch&&now?.id===value.value.id&&now.mapId===value.value.mapId&&now.computerId===value.value.computerId;
  };
  const showCredits=(value:CreditsPage298)=>{if(value.page&&currentCredits(value)&&options.canPresent()&&options.isPageCurrent(value.id))options.show(value.page);};
  const showLaunch=(value:LaunchPage298)=>{const page=launchPage(value);value.page=page;options.show(page);};
  function cancelLaunch(value:LaunchPage298):void {
    if(!currentLaunch(value)||value.pending)return;
    launch=undefined;options.close(value.id);
  }
  function launchPage(value:LaunchPage298):NativePage {
    return {id:value.id,title:'Lancer le vaisseau',layout:'dialog',modal:true,closable:false,width:620,height:460,
      rows:[...value.rows,...value.error?[line('ship-launch-error',value.error)]:[]],
      onCancel:()=>cancelLaunch(value),actions:[
        {id:'ship-launch-confirm298',icon:'rocket',label:value.pending?'Vérification du lancement…':'Confirmer le lancement',disabled:value.pending,onActivate:()=>confirmLaunch(value)},
        {id:'ship-launch-back298',icon:'back',label:'Retour',disabled:value.pending,onActivate:()=>cancelLaunch(value)},
      ]};
  }
  async function confirmLaunch(value:LaunchPage298):Promise<void> {
    if(!currentLaunch(value)||value.pending||!options.canPresent())return;
    value.pending=true;delete value.error;showLaunch(value);
    try {
      // The runtime performs the actual preflight; this report is no capability.
      await options.launch(value.scope.computerId);
      if(!currentLaunch(value))return;
      launch=undefined;options.close(value.id);
    } catch(cause) {
      if(!currentLaunch(value))return;
      value.pending=false;value.error=message(cause);showLaunch(value);
    }
  }
  function creditsPage(value:CreditsPage298):NativePage {
    return {id:value.id,title:'Le voyage continue',subtitle:'Les occupants embarqués ont quitté cette colonie.',
      layout:'dialog',modal:true,closable:false,width:650,height:500,
      rows:[...value.rows,...value.error?[line('ship-credits-error',value.error)]:[]],
      onCancel:()=>beginClose(value),actions:[{id:'ship-credits-continue298',icon:'play',
        label:value.phase==='idle'?'Continuer la colonie':value.phase==='closing'?'Retour à la colonie…':'Fermeture en attente…',
        disabled:value.phase!=='idle',onActivate:()=>beginClose(value)}]};
  }
  function beginClose(value:CreditsPage298):void {
    if(!currentCredits(value)||!options.isPageCurrent(value.id)||!options.canPresent()||value.phase!=='idle')return;
    value.phase='closing';value.remaining=Math.fround(3);delete value.error;
    value.page=creditsPage(value);showCredits(value);presentCredits(value,'closing',0);options.onFrameDemandChanged();
  }
  async function finishClose(value:CreditsPage298):Promise<void> {
    if(!currentCredits(value)||!options.isPageCurrent(value.id)||!options.canPresent()||value.phase!=='closing')return;
    value.phase='submitting';value.page=creditsPage(value);showCredits(value);presentCredits(value,'held',1);options.onFrameDemandChanged();
    try {
      await options.continueCredits(value.value.id);
      if(!currentCredits(value))return;
      // Do not remove the screen from an ACK. Only the adopted summary closes it.
      value.phase='awaiting';value.page=creditsPage(value);showCredits(value);
    } catch(cause) {
      if(!currentCredits(value))return;
      resetPresentation();value.phase='idle';value.remaining=0;value.error=message(cause);value.page=creditsPage(value);showCredits(value);
    }
  }
  return {
    ownsPage(id:string|undefined):boolean{return !!id?.startsWith(prefix);},
    get closing():boolean{return !disposed&&credits?.phase==='closing';},
    openLaunch(computerId:number):void {
      if(disposed||!options.canPresent())return;
      const state=options.readState(),scope=scope298(state,computerId);
      if(!scope||!currentComputer298(state,scope))throw Error('Choisissez un ordinateur de vaisseau connu et utilisable sur cette carte.');
      if(adoptedCredits298(state))return;
      const world=state.world!,index=indexShipParts276(world.structures,world.width,world.height);
      if(!index.ok)throw Error('Les pièces reliées ne peuvent pas être inspectées.');
      const report=readShipAssembly276(index.index,computerId);if(!report.ok)throw Error('Cet ordinateur ne possède plus son assemblage courant.');
      const rows:NativeRow[]=[
        line('ship-launch-warning','Seuls les occupants déjà embarqués partiront. Les personnes restées sur cette carte resteront dans la colonie.'),
        ...report.requirements.map(r=>line('ship-launch-part-'+r.id,r.label,r.present+' / '+r.required)),
        line('ship-launch-occupied','Caissons occupés',String(report.occupiedCaskets)),
        line('ship-launch-authority','Le lancement sera vérifié au moment de votre confirmation.'),
      ];
      for(const part of report.parts){const o=part.source.shipCryptosleep277?.occupant;if(o?.kind==='human')rows.push(line('ship-launch-person-'+o.pawn.id,o.pawn.name));}
      const value:LaunchPage298={scope,id:prefix+'launch:'+String(state.epoch)+':'+(++serial),rows,pending:false};launch=value;
      showLaunch(value);
    },
    /** Called after actual presentation adoption, never from the launch reply. */
    update(state:NativeUiState):NativePage|undefined {
      if(disposed)return;
      if(presentationOwner!==undefined&&(presentationEpoch!==state.epoch||presentationEpoch!==options.readEpoch()||!state.hasGame||!!state.fault||!options.canPresent()))resetPresentation();
      if(launch&&(!options.isPageCurrent(launch.id)||!currentComputer298(state,launch.scope)))launch=undefined;
      const current=adoptedCredits298(state);
      if(!current){
        if(credits){
          const previous=credits;
          // The ACK never starts this fade. Only this adopted, same-epoch
          // disappearance after the complete closing interval can do so.
          const clear=state.epoch===previous.epoch&&options.readEpoch()===previous.epoch&&state.hasGame&&!state.fault&&options.canPresent()&&options.isPageCurrent(previous.id)
            &&(previous.phase==='submitting'||previous.phase==='awaiting');
          credits=undefined;
          if(clear){presentationOwner=previous.id;presentationEpoch=previous.epoch;options.onPresentation?.(previous.id,'clear',1);}
          else resetPresentation();
          options.onFrameDemandChanged();
        }
        return launch?.page;
      }
      launch=undefined;
      if(!credits||credits.epoch!==state.epoch||credits.value.id!==current.id||credits.value.mapId!==current.mapId||credits.value.computerId!==current.computerId){
        resetPresentation();
        const rows:NativeRow[]=[...current.humans.map(h=>line('ship-credit-human-'+h.id,h.name)),
          line('ship-credit-animals','Animaux embarqués',String(current.animalCount)),
          line('ship-credit-mechanical','Mécanoïdes embarqués',String(current.mechanicalCount)),
          line('ship-credit-caskets','Caissons partis',String(current.casketCount)),
          line('ship-credit-parts','Pièces parties',String(current.partCount))];
        const value:CreditsPage298={epoch:state.epoch,value:current,id:prefix+'credits:'+String(state.epoch)+':'+current.id,rows,phase:'idle',remaining:0};
        value.page=creditsPage(value);credits=value;options.onFrameDemandChanged();
      }
      if(!options.canPresent()||!options.isPageCurrent(credits.id))resetPresentation();
      else if(credits.phase==='closing')presentCredits(credits,'closing',Math.max(0,Math.min(1,1-credits.remaining/3)));
      else if(credits.phase==='submitting'||credits.phase==='awaiting')presentCredits(credits,'held',1);
      return credits.page;
    },
    /** Only the elected existing browser frame port invokes this. No wall timer,
     * World mutation or per-frame page/raster reconstruction is performed. */
    frame(deltaSeconds:number):void {
      const value=credits;if(disposed||value?.phase!=='closing')return;
      if(!currentCredits(value)||!options.canPresent()||!options.isPageCurrent(value.id))return;
      if(!Number.isFinite(deltaSeconds)||deltaSeconds<0)throw RangeError('Delta de présentation invalide.');
      const delta=Math.fround(Math.min(deltaSeconds,SHIP_FRAME_MAXIMUM_DELTA_298));
      value.remaining=Math.fround(value.remaining-delta);
      if(value.remaining<=0)void finishClose(value);
      else presentCredits(value,'closing',Math.max(0,Math.min(1,1-value.remaining/3)));
    },
    dispose():void {resetPresentation();disposed=true;launch=undefined;credits=undefined;options.onFrameDemandChanged();},
  };
}
