import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import {createShipCountdownSession298,type ShipCountdownSession298} from './ship-countdown-session-298.ts';
import {prepareShipLaunch298,prepareShipDeparture298} from '../sim/ship-escape-runtime-298.ts';
import {captureShipRootDestruction298,releaseShipRootDestruction298,type ShipRootDestructionProof298} from '../sim/ship-root-destruction-proof-298.ts';
import {prepareShipEscapeDueRoot298} from '../sim/ship-escape-due-root-298.ts';
import {prepareShipPhysicalRemoval298} from '../sim/ship-escape-removal-298.ts';
import {registeredCampaign,isActualMapMutationContext298} from '../sim/world-map-context.ts';
import type {ShipEscapeLaunchCapture298,ShipEscapePhysicalServices298} from '../sim/ship-escape-physical-298.ts';
import type {EscapeCampaign298} from '../sim/ship-escape-state-298.ts';
import type {Structure,World} from '../sim/types.ts';

export interface ShipCountdownStatus298 {
 readonly generation:number;readonly active:boolean;readonly countingDown:boolean;
 readonly timeLeftSeconds:number;readonly disposed:boolean;
}
export type ShipCountdownStart298={ok:false;reason:string}|{ok:true;generation:number};
export type ShipCountdownUpdate298=
 |{kind:'idle'}|{kind:'waiting'}|{kind:'refused';reason:string}
 |{kind:'departed';departureId:number}
 |{kind:'failed';reason:string;worldOutcome:'unchanged'|'unknown'};
interface Mandate298 {capture:ShipEscapeLaunchCapture298;proof:ShipRootDestructionProof298;generation:number}
const idle298=Object.freeze({kind:'idle'} as const),waiting298=Object.freeze({kind:'waiting'} as const);
const stale298=Object.freeze({kind:'refused',reason:'Le propriétaire ou la génération du countdown est périmé.'} as const);
const reason298=(error:unknown)=>error instanceof Error?error.message.slice(0,512):'La transaction terminale interne a échoué.';
const actualOwner298=(owner:EscapeCampaign298)=>!!owner&&typeof owner==='object'&&isSchema298OrLater(Number(owner.schemaVersion))&&registeredCampaign(owner)===owner;

/** INTERNAL runtime composition only. No wire input or public launch grant.
 * The caller owns delta eligibility/browser policy and invokes bind only at a
 * truly accepted replacement. No time source, transport, persisted pending or
 * arbitrary service/callback is accepted here. */
export function createShipCountdownCoordinator298(initialOwner:EscapeCampaign298){
 if(!actualOwner298(initialOwner))throw TypeError('Le coordinateur exige son vrai propriétaire298.');
 let owner:EscapeCampaign298|undefined=initialOwner;
 let clock:ShipCountdownSession298<EscapeCampaign298,Structure>|undefined=createShipCountdownSession298<EscapeCampaign298,Structure>(initialOwner);
 let active:Mandate298|undefined,disposed=false,closedGeneration=0;
 const releaseActive=()=>{const previous=active;active=undefined;if(previous)releaseShipRootDestruction298(previous.proof);};
 const generationAvailable=()=>!!clock&&Number.isSafeInteger(clock.generation+1);
 const matches=(currentOwner:EscapeCampaign298,generation:number)=>!disposed&&!!clock&&currentOwner===owner&&Number.isSafeInteger(generation)&&generation===clock.generation;
 const clearAfterDueFailure=(error:unknown,unknown:boolean):ShipCountdownUpdate298=>{
  releaseActive();
  // The Single frontier/token stays private and inert after crossing <=0.
  // No retry/update can return it again; a new start/bind invalidates its epoch,
  // and cleanup drops the clock itself. Do not consume a refused preflight.
  return {kind:'failed',reason:reason298(error),worldOutcome:unknown?'unknown':'unchanged'};
 };
 const cancel=(currentOwner:EscapeCampaign298,generation:number):boolean=>{
  if(!matches(currentOwner,generation)||!generationAvailable())return false;
  clock!.cancelFromMenu();releaseActive();return true;
 };
 return {
  get generation():number{return clock?.generation??closedGeneration;},
  get active():boolean{return !disposed&&active!==undefined;},
  status():Readonly<ShipCountdownStatus298>{return Object.freeze({generation:clock?.generation??closedGeneration,active:!disposed&&active!==undefined,
   countingDown:clock?.countingDown??false,timeLeftSeconds:clock?.timeLeftSeconds??Math.fround(-1000),disposed});},
  start(world:World,computerId:number):ShipCountdownStart298 {
   // Every ordinary refusal precedes a new observation: captureProof replaces
   // the previous observation epoch, so owner/current/generation are closed first.
   if(disposed||!clock||!owner||registeredCampaign(world)!==owner||!isActualMapMutationContext298(owner,world))return {ok:false,reason:'Le lancement ne vient pas du vrai contexte courant.'};
   if(!generationAvailable())return {ok:false,reason:'La génération terminale est épuisée.'};
   let prepared:ReturnType<typeof prepareShipLaunch298>;
   try{prepared=prepareShipLaunch298(world,computerId);if(!prepared.ok)return prepared;
    if(prepared.capture.owner!==owner||!prepared.current())return {ok:false,reason:'La préparation initiale est périmée.'};
   }catch(error){return {ok:false,reason:reason298(error)};}
   let proof:ShipRootDestructionProof298;
   try{proof=captureShipRootDestruction298(world,prepared.capture.originalRoot,owner);}
   catch(error){return {ok:false,reason:reason298(error)};}
   // With the private clock's exact owner and a preflighted safe generation,
   // start is total here. No await or user callback can replace either owner.
   if(!clock.start(prepared.capture.originalRoot,owner))throw Error('Invariant interne : le propriétaire du countdown a changé.');
   const previous=active;active={capture:prepared.capture,proof,generation:clock.generation};
   if(previous)releaseShipRootDestruction298(previous.proof);
   return {ok:true,generation:clock.generation};
  },
  updateEligible(deltaSeconds:number,currentOwner:EscapeCampaign298,generation:number):ShipCountdownUpdate298 {
   if(!matches(currentOwner,generation))return stale298;
   const c=clock!,mandate=active;if(!mandate)return idle298;
   if(mandate.generation!==generation||mandate.capture.owner!==owner)return stale298;
   let token:ReturnType<typeof c.update>;
   try{token=c.update(deltaSeconds,currentOwner);}catch(error){return {kind:'refused',reason:reason298(error)};}
   if(!token)return waiting298;
   const capture=mandate.capture,expectedOwner=owner!;
   if(active!==mandate||!c.isCurrent(token,expectedOwner,capture.originalRoot))return clearAfterDueFailure(Error('Le jeton dû exact est périmé.'),false);
   // These are the real concrete selectors/retirement service. They are not
   // supplied by a caller and cannot manufacture a successful fake finalizer.
   const services:ShipEscapePhysicalServices298={
    prepareDueRoot(candidateOwner,candidateCapture,core){
     if(candidateOwner!==expectedOwner||candidateCapture!==capture)return {ok:false,reason:'La sélection ne correspond pas à la capture privée exacte.'};
     return prepareShipEscapeDueRoot298(expectedOwner,capture,mandate.proof,core);
    },
    prepareRemoval(world,parts,core){return prepareShipPhysicalRemoval298(expectedOwner,world,parts,core);},
   };
   let committing=false;
   try{
    const plan=prepareShipDeparture298(expectedOwner,capture,services);
    if(active!==mandate||owner!==expectedOwner||clock!==c||c.generation!==generation||!plan.current()||!c.isCurrent(token,expectedOwner,capture.originalRoot))
     return clearAfterDueFailure(Error('Le départ réel a changé avant sa consommation.'),false);
    if(!c.adopt(token,expectedOwner,capture.originalRoot))return clearAfterDueFailure(Error('Le jeton terminal ne peut pas être consommé.'),false);
    // Synchronous prepared transaction only. A false promises zero World writes;
    // an unexpected throw once commit was entered cannot promise a rollback.
    committing=true;
    if(!plan.commit())return clearAfterDueFailure(Error('Le départ réel a été refusé sans écriture.'),false);
    releaseActive();return {kind:'departed',departureId:plan.departureId};
   }catch(error){return clearAfterDueFailure(error,committing);}
  },
  cancelFromMenu(currentOwner:EscapeCampaign298,generation:number):boolean{return cancel(currentOwner,generation);},
  cancelFromFront(currentOwner:EscapeCampaign298,generation:number):boolean{return cancel(currentOwner,generation);},
  /** Safety adaptation. Runtime invokes only AFTER the new World was adopted,
   * never on load request/refusal, snapshot replacement or graphics preparation. */
  bindAcceptedOwner(nextOwner:EscapeCampaign298):boolean {
   if(disposed||!clock||!owner||nextOwner===owner||!actualOwner298(nextOwner)||!generationAvailable())return false;
   clock.bindOwner(nextOwner);releaseActive();owner=nextOwner;return true;
  },
  cleanup():void {
   if(disposed)return;
   releaseActive();closedGeneration=clock?.generation??closedGeneration;
   clock=undefined;owner=undefined;disposed=true;
  },
 };
}
