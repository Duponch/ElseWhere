import {isSchema298OrLater} from '../sim/schema-compatibility-257.ts';
import {createShipCountdownCoordinator298} from './ship-countdown-coordinator-298.ts';
import {continueShipCredits298} from '../sim/ship-escape-runtime-298.ts';
import type {EscapeCampaign298} from '../sim/ship-escape-state-298.ts';
import type {CampaignState} from '../sim/world-map-state.ts';
import type {World} from '../sim/types.ts';

import {SHIP_FRAME_BATCH_LIMIT_298,SHIP_FRAME_MAXIMUM_DELTA_298,type ShipControlRequest298,type ShipFrameRequest298,type ShipCancelRequest298,type ShipOwnerReplyMetadata298,type ShipFrameAck298,type ShipCountdownState298} from './ship-countdown-wire-298.ts';

type Coordinator298=ReturnType<typeof createShipCountdownCoordinator298>;
const positive=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
const natural=(v:unknown):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
const data=(v:object,key:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,key);return d?.enumerable===true&&Object.hasOwn(d,'value')?d:undefined;};
function exact(v:unknown,keys:readonly string[]):v is Record<string,unknown>{
 return !!v&&typeof v==='object'&&Object.getPrototypeOf(v)===Object.prototype
  &&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>!!data(v,k));
}
const reason=(e:unknown)=>e instanceof Error?e.message.slice(0,512):'Le transport terminal interne a échoué.';
/** Validate and copy the WHOLE bounded packet before the first clock write.
 * Separate Single deltas preserve the primitive's subtraction order. */
function frameDeltas(input:unknown):number[]|undefined {
 try{
  if(!exact(input,['type','ownerEpoch','generation','sequence','deltas'])||input.type!=='ship-frame-298'
   ||!positive(input.ownerEpoch)||!positive(input.generation)||!positive(input.sequence))return;
  const a=input.deltas;
  if(!Array.isArray(a)||Object.getPrototypeOf(a)!==Array.prototype||a.length<1||a.length>SHIP_FRAME_BATCH_LIMIT_298||Reflect.ownKeys(a).length!==a.length+1)return;
  const values:number[]=[];
  for(let i=0;i<a.length;i++){
   const v=data(a,String(i))?.value;
   if(typeof v!=='number'||!Number.isFinite(v)||v<0)return;
   values.push(Math.fround(Math.min(v,SHIP_FRAME_MAXIMUM_DELTA_298)));
  }
  return values;
 }catch{return;}
}

/** Private bridge owner. No timer, wall deadline, simulation credit or runtime
 * callback is owned here. Only the actual Worker calls these methods. */
export function createShipCountdownRuntime298(){
 let owner:CampaignState|undefined,coordinator:Coordinator298|undefined,ownerEpoch=0,lastSequence=0;
 const nextEpoch=()=>{if(!Number.isSafeInteger(ownerEpoch+1))throw Error('L’époque terminale est épuisée.');return ownerEpoch+1;};
 const bound=(current:CampaignState|undefined,epoch:number)=>!!current&&current===owner&&epoch===ownerEpoch&&isSchema298OrLater(current.schemaVersion)&&!!coordinator;
 const state=(outcome:ShipCountdownState298['outcome'],message?:string):ShipCountdownState298=>({type:'ship-countdown-state-298',ownerEpoch,generation:coordinator?.generation??0,active:coordinator?.active===true,outcome,...message?{reason:message}:{}});
 const refusal=(request:ShipFrameRequest298,message:string):ShipFrameAck298=>{
  let epoch=ownerEpoch,generation=0,sequence=0;
  try{if(request&&typeof request==='object'){const e=data(request,'ownerEpoch')?.value,g=data(request,'generation')?.value,s=data(request,'sequence')?.value;if(positive(e))epoch=e;if(natural(g))generation=g;if(positive(s))sequence=s;}}catch{/* Invalid descriptors cannot act on the clock. */}
  return {type:'ship-frame-ack-298',ownerEpoch:epoch,generation,sequence,accepted:false,active:bound(owner,epoch)&&coordinator?.generation===generation&&coordinator?.active===true,outcome:'refused',reason:message};
 };
 return {
  /** Cold prepare may allocate an idle coordinator for the validated candidate,
   * but never touches the old mandate. Commit is called at world assignment. */
  prepareAcceptedOwner(next:CampaignState){
   const epoch=nextEpoch(),previousOwner=owner,previousEpoch=ownerEpoch;
   const prepared=isSchema298OrLater(next.schemaVersion)?createShipCountdownCoordinator298(next as EscapeCampaign298):undefined;
   let committed=false;
   return {commit():void {
    if(committed||owner!==previousOwner||ownerEpoch!==previousEpoch)throw Error('Le remplacement terminal préparé est périmé.');
    coordinator?.cleanup();owner=next;coordinator=prepared;ownerEpoch=epoch;lastSequence=0;committed=true;
   }};
  },
  replyMetadata(current:CampaignState|undefined):ShipOwnerReplyMetadata298 {
   return current===owner&&isSchema298OrLater(current?.schemaVersion)?{shipOwnerEpoch298:ownerEpoch}:{};
  },
  launch(current:CampaignState|undefined,world:World,input:Extract<ShipControlRequest298,{type:'ship-launch-298'}>){
   if(!exact(input,['type','id','ownerEpoch','computerId'])||input.type!=='ship-launch-298'||!positive(input.id)||!positive(input.ownerEpoch)||!positive(input.computerId)||!bound(current,input.ownerEpoch))return {ok:false as const,reason:'Le propriétaire ou le geste de lancement est périmé.'};
   const result=coordinator!.start(world,input.computerId);if(!result.ok)return result;
   lastSequence=0;return {ok:true as const,ownerEpoch,generation:result.generation,active:true as const};
  },
  continueCredits(current:CampaignState|undefined,input:Extract<ShipControlRequest298,{type:'ship-credits-continue-298'}>){
   if(!exact(input,['type','id','ownerEpoch','departureId'])||input.type!=='ship-credits-continue-298'||!positive(input.id)||!positive(input.ownerEpoch)||!positive(input.departureId)||!bound(current,input.ownerEpoch))return {ok:false as const,reason:'Le propriétaire ou le geste de crédits est périmé.'};
   return continueShipCredits298(current as EscapeCampaign298,input.departureId);
  },
  frame(current:CampaignState|undefined,input:ShipFrameRequest298,blockedReason?:string):{reply:ShipFrameAck298;departed?:true;unknown?:string} {
   const values=frameDeltas(input);
   if(!values)return {reply:refusal(input,'Le lot de frames est invalide.')};
   if(!bound(current,input.ownerEpoch)||coordinator!.generation!==input.generation||!coordinator!.active)return {reply:refusal(input,'Le propriétaire ou la génération de frames est périmé.')};
   if(input.sequence!==lastSequence+1)return {reply:refusal(input,'Le lot de frames est dupliqué ou hors séquence.')};
   if(blockedReason)return {reply:refusal(input,blockedReason)};
   let result:ReturnType<Coordinator298['updateEligible']>={kind:'waiting'};
   for(const delta of values){result=coordinator!.updateEligible(delta,current as EscapeCampaign298,input.generation);if(result.kind!=='waiting')break;}
   // All ordinary refusal paths above are zero-write. An unexpected internal
   // refusal after updates must not invite replay of a partly consumed batch.
   if(result.kind==='refused'||result.kind==='idle'){
    const message=result.kind==='refused'?result.reason:'Le countdown est devenu inactif pendant le lot.';
    return {unknown:message,reply:{type:'ship-frame-ack-298',ownerEpoch:input.ownerEpoch,generation:input.generation,sequence:input.sequence,accepted:true,active:false,outcome:'unknown',reason:message}};
   }
   // A consumed batch is terminal at its first due transition; later elements
   // cannot trigger another launch.
   lastSequence=input.sequence;
   if(result.kind==='departed')return {departed:true,reply:{type:'ship-frame-ack-298',ownerEpoch:input.ownerEpoch,generation:input.generation,sequence:input.sequence,accepted:true,active:false,outcome:'departed',departureId:result.departureId}};
   if(result.kind==='failed')return {reply:{type:'ship-frame-ack-298',ownerEpoch:input.ownerEpoch,generation:input.generation,sequence:input.sequence,accepted:true,active:false,outcome:result.worldOutcome==='unknown'?'unknown':'refused',reason:result.reason},...result.worldOutcome==='unknown'?{unknown:result.reason}:{}};
   return {reply:{type:'ship-frame-ack-298',ownerEpoch:input.ownerEpoch,generation:input.generation,sequence:input.sequence,accepted:true,active:true,outcome:'waiting'}};
  },
  cancel(current:CampaignState|undefined,input:ShipCancelRequest298):ShipCountdownState298 {
   if(!exact(input,['type','ownerEpoch','generation','reason'])||input.type!=='ship-cancel-298'||!positive(input.ownerEpoch)||!natural(input.generation)||!['menu','front','transport'].includes(input.reason)||!bound(current,input.ownerEpoch)||coordinator!.generation!==input.generation)return state('refused','L’annulation terminale est périmée.');
   if(input.reason==='transport'){
    const epoch=nextEpoch(),prepared=createShipCountdownCoordinator298(current as EscapeCampaign298);
    coordinator!.cleanup();coordinator=prepared;ownerEpoch=epoch;lastSequence=0;
    return state('unknown','La pompe de frames a été arrêtée après une limite de transport. Aucun départ n’est déduit.');
   }
   const ok=input.reason==='menu'?coordinator!.cancelFromMenu(current as EscapeCampaign298,input.generation):coordinator!.cancelFromFront(current as EscapeCampaign298,input.generation);
   if(!ok)return state('refused','L’annulation terminale est périmée.');
   lastSequence=0;return state('cancelled');
  },
  cleanup():void {
   coordinator?.cleanup();coordinator=undefined;owner=undefined;lastSequence=0;
   if(Number.isSafeInteger(ownerEpoch+1))ownerEpoch++;
  },
  failureReason:reason,
 };
}
