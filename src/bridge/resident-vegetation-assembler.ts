import type {World} from '../sim/types';
import type {CampaignOnlyMessage} from './protocol';
import type {SnapshotMessage,SnapshotAdoption} from './snapshots';
import {ResidentPresentationAssembler} from './resident-presentation-assembler';
import {readResidentNaturalSidecar,readResidentAuxiliarySidecar} from './resident-protocol';
import {PreparedNaturalFrameOwner,type PreparedNaturalDraft} from './prepared-natural-frame';
import {ResidentAuxiliaryFrameOwner,type PreparedResidentAuxiliary} from './resident-auxiliary-sections';

/** Only the fixed v2/v3 lanes reach this adapter. Public admission and saves keep
 * their literal readers. Nothing is stamped until the whole base transaction
 * (including urgent metadata/geography/native owners) has succeeded. */
export class ResidentVegetationAssembler extends ResidentPresentationAssembler {
 private readonly natural=new PreparedNaturalFrameOwner();
 private readonly auxiliary=new ResidentAuxiliaryFrameOwner();
 readMotion(packet:SnapshotMessage<true>){return this.auxiliary.readMotion(packet);}
 /** Internal composition notification; ordinary readers grant no provenance. */
 protected preparedPublication(_original:SnapshotMessage<true>,_prepared:SnapshotMessage<true>):void {}
 /** Native fixed reader may supply a one-use exact raw-subsection lease.
  * Its decoder verifies the private receipt; an override alone is no proof. */
 protected privateAuxiliaryLease379(_original:SnapshotMessage<true>,_raw:unknown):unknown {return undefined;}
 override adopt(packet:SnapshotMessage<true>,acceptExtra?:(world:World)=>boolean):SnapshotAdoption {
  const original=packet,rawAuxiliary=readResidentAuxiliarySidecar(packet),rawNatural=readResidentNaturalSidecar(packet);
  let auxiliary:PreparedResidentAuxiliary|undefined;
  if(rawAuxiliary!==undefined){
   const prepared=this.auxiliary.prepare(packet,rawAuxiliary,this.privateAuxiliaryLease379(original,rawAuxiliary));if(prepared==='stale')return {status:'stale'};
   if(!prepared)return {status:'resync',reason:'Invalid resident auxiliary sections'};
   auxiliary=prepared;packet=prepared.packet;
  }
  this.preparedPublication(original,packet);
  let draft:PreparedNaturalDraft|undefined;
  const result=super.adopt(packet,world=>{
   draft=this.natural.prepare(world,packet,rawNatural);
   return !!draft&&(!acceptExtra||acceptExtra(world))&&(!auxiliary||this.auxiliary.canCommit(world,auxiliary));
  });
  if(result.status==='applied'){
   if(!draft)throw Error('Missing admitted natural frame');
   this.natural.commit(result.world,draft);
   if(auxiliary)this.auxiliary.commit(result.world,auxiliary);else{this.auxiliary.clear();this.auxiliary.commitLiteralMotion(original);}
  }
  return result;
 }
 override adoptCampaignOnly(packet:CampaignOnlyMessage,acceptExtra?:(world:World)=>boolean):ReturnType<ResidentPresentationAssembler['adoptCampaignOnly']> {
  const result=super.adoptCampaignOnly(packet,world=>readResidentNaturalSidecar(packet)===null&&(!acceptExtra||acceptExtra(world)));
  if(result.status==='applied'){this.natural.clear();this.auxiliary.clear();}return result;
 }
}
