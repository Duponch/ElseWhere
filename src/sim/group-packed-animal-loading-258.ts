import {assignPileOwner} from './pile-index.ts';
import type {World,Pawn} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {PreparingGroup} from './group-capture.ts';
import type {NeedContext} from './needs.ts';
import {captureGroupMass} from './group-capture.ts';
import {groupPackedMassGrams258} from './group-freight-contract-258.ts';
import {groupCaravanPileMass256} from './group-caravan-mass-256.ts';
import {groupHumanHandler257} from './group-human-admission-257.ts';
import {pawnBody} from './health-rules.ts';
import {groupAnimalReason256,groupAnimalFormationReason259} from './group-animal-formation-256.ts';
import {animalCaravanCapacityGrams256} from './group-animal-capacity-256.ts';
import {animalBody} from './wildlife-health.ts';
import {slaughterContact} from './animal-slaughter.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
export const GROUP_PACK_HANDOFF_CORE_258=25;
/** One minified wrapper: stackLimit1, VolumePerUnit1. CarryingCapacity75 is
 * quantity/volume for the existing human body, never a75kg mass allowance. */
export const groupPackHandler258=(p:Pawn):boolean=>groupHumanHandler257(p)&&Math.round(75*pawnBody(p).capacities.manipulation)>=1;
export const usableGroupPackAnimal258=(w:World,a:WildAnimal,preparing=false):boolean=>!(preparing?groupAnimalReason256(w,a,true):groupAnimalFormationReason259(w,a))&&a.state!=='downed'&&animalBody(a).capacities.moving>0&&animalCaravanCapacityGrams256(a)>0;
export function selectedGroupPackAnimal258(w:World,g:PreparingGroup,id:number):WildAnimal|undefined {
 const row=g.animalPreparation?.lines.find(l=>l.animalId===id&&l.mode==='lead'),a=w.wildlife?.animals.find(a=>a.id===id);return row&&a&&usableGroupPackAnimal258(w,a,true)?a:undefined;
}
const settled=(w:World,a:{motion?:{end:number}|null})=>(a.motion?.end??0)<=w.tick;
export const groupPackedContactReady258=(w:World,p:Pawn,a:WildAnimal):boolean=>p.moveCooldown===0&&settled(w,p)&&settled(w,a)&&!p.path.length&&!a.path.length&&slaughterContact(w,p,a);
export const pendingGroupPackedDeliveries258=(g:PreparingGroup,pawnId?:number):boolean=>g.bedrollLoading?.revision===2&&g.bedrollLoading.manifest.some(l=>l.animalCarrierId!==undefined&&!l.deliveredToAnimal&&(pawnId===undefined||l.loaded&&l.carrierId===pawnId));
export function validGroupPackedDeadline258(v:unknown,w:World,g:PreparingGroup):v is number {
 return typeof v==='number'&&Number.isSafeInteger(v)&&v>=25&&(v-25)%10===0&&v-25>=g.startedAt*10&&v-25<=w.tick*10;
}
/** Reconcile only interrupted contact time, never the actual cargo owner. */
export function reconcileGroupPackedHandoffs258(w:World,g:PreparingGroup):void {
 if(w.schemaVersion<258||g.bedrollLoading?.revision!==2)return;
 for(const l of g.bedrollLoading.manifest){if(l.handoffReadyCore===undefined)continue;const p=w.pawns.find(p=>p.id===l.carrierId),a=l.animalCarrierId===undefined?undefined:selectedGroupPackAnimal258(w,g,l.animalCarrierId);
  if(g.phase!=='loading'||!l.loaded||l.deliveredToAnimal||!p||!a||!groupPackedContactReady258(w,p,a))delete l.handoffReadyCore;
 }
}
/** Reuses the real capture at pickup/start/end, not every waiting tick. Future
 * reservations are counted at the final receiver, held goods at their owner. */
export function groupPackedReceiverSpace258(w:World,g:PreparingGroup,receiverId:number):boolean {
 const animals=(g.animalPreparation?.lines??[]).map(l=>w.wildlife?.animals.find(a=>a.id===l.animalId));if(animals.some(a=>!a))return false;
 const members=w.pawns.filter(p=>g.memberIds.includes(p.id)),ids=new Set([...g.memberIds,...animals.map(a=>a!.id)]),mass=captureGroupMass(members,w.piles.filter(p=>'pawnId'in p.owner&&ids.has(p.owner.pawnId)),!!g.freight,w.schemaVersion,w.packed.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId)),animals as WildAnimal[]),receiver=mass?.carriers.find(c=>c.pawnId===receiverId);if(!receiver)return false;
 let grams=receiver.grams;
 for(const [index,l] of g.manifest.entries()){if(l.animalCarrierId!==receiverId||l.deliveredToAnimal)continue;const pile=w.piles.find(p=>p.id===(index<g.cursor?l.carriedPileId:l.pileId));if(!pile)return false;const unit=groupCaravanPileMass256({...pile,quantity:l.quantity},!!g.freight,w.schemaVersion);if(unit===undefined)return false;grams+=unit*l.quantity;}
 for(const l of g.bedrollLoading?.manifest??[]){if((l.animalCarrierId??l.carrierId)!==receiverId||l.deliveredToAnimal||l.loaded&&l.animalCarrierId===undefined)continue;const pack=w.packed.find(p=>p.building.id===l.structureId),unit=pack&&groupPackedMassGrams258(pack,w.schemaVersion);if(unit===undefined)return false;grams+=unit;}
 return Number.isSafeInteger(grams)&&grams<=receiver.capacityGrams;
}
/** Actual handler walks with the same inventory wrapper to the selected animal.
 *25Coreticks are rounded up to the first confirmed10Coretick simulation step. */
export function processGroupPackedDelivery258(w:World,g:PreparingGroup,p:Pawn,ctx:NeedContext):'none'|'handled'|'refused' {
 if(w.group!==g||!w.pawns.includes(p)||w.schemaVersion<258||g.phase!=='loading'||g.bedrollLoading?.revision!==2)return 'none';
 const l=g.bedrollLoading.manifest.find(l=>l.loaded&&l.carrierId===p.id&&l.animalCarrierId!==undefined&&!l.deliveredToAnimal);if(!l)return 'none';
 const a=selectedGroupPackAnimal258(w,g,l.animalCarrierId!),pack=w.packed.find(p=>p.building.id===l.structureId);
 if(!a||!groupPackHandler258(p)||!pack||pack.owner.type!=='inventory'||pack.owner.pawnId!==p.id||allowedAreaReason(w,p,a))return 'refused';
 // Contact can be reached by the moving recipient before this stale route ends.
 // Only discard the handler's remaining route after its captured edge finishes.
 if(settled(w,p)&&p.moveCooldown===0&&slaughterContact(w,p,a)){p.path=[];p.state='idle';}
 if(!groupPackedContactReady258(w,p,a)){delete l.handoffReadyCore;if(settled(w,p)&&p.moveCooldown===0&&!slaughterContact(w,p,a))ctx.move(a,false);return 'handled';}
 p.path=[];p.state='idle';
 if(l.handoffReadyCore===undefined){if(!groupPackedReceiverSpace258(w,g,a.id))return 'refused';l.handoffReadyCore=w.tick*10+GROUP_PACK_HANDOFF_CORE_258;return 'handled';}
 if(w.tick*10<l.handoffReadyCore)return 'handled';
 if(!validGroupPackedDeadline258(l.handoffReadyCore,w,g)||!groupPackedReceiverSpace258(w,g,a.id))return 'refused';
 assignPileOwner(pack,{type:'inventory',pawnId:a.id});l.deliveredToAnimal=true;delete l.handoffReadyCore;return 'handled';
}
