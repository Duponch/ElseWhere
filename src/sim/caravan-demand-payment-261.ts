import {markPileContentWrite379} from './ordinary-pile-source-379.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import type {CampaignState} from './world-map-state.ts';
import type {AwayGroup} from './group-capture.ts';
import type {MaterialPile} from './types.ts';
import type {EncounterGroup261} from './caravan-encounter-state-261.ts';
import {worldGroupContext} from './world-map-context.ts';
import {actualPlayerOwner259} from './world-affiliation-259.ts';
import {groupPhysicalPawns256} from './group-mixed-pawns-256.ts';
import {draftSplitInventory,splitInventoryDraftCurrent,commitSplitInventory} from './group-inventory-reorganization.ts';
import {openGroupReorganization,withGroupExchange} from './group-reorganization-balance.ts';
import {exchangeGroupPackedBalance256} from './group-packed-balance-256.ts';
import {prepareCaravanCaptivity261,prepareCaravanAnimalCession261,type PreparedCaravanCession261} from './caravan-captivity-261.ts';
import {prepareEncounterForeignWorld261} from './caravan-foreign-world-261.ts';
import {recordCaravanInventoryEffect256} from './group-animal-food-256.ts';
import {draftCaravanPersonLost261} from './caravan-person-lost-261.ts';
import {notifyBillWorkerUnavailable283} from './bill-worker-owners-283.ts';
import type {LostCampaignMemory} from './world-map-lost.ts';

export type DemandPaymentPlan261={ok:true;current():boolean;commit():void}|{ok:false;reason:string};
/** Native Give is an explicit world decision. The same split/holder routines
 * redistribute a ceded Pawn's possessions; no gathering/pickup contact is
 * claimed. Only quantities actually surrendered enter the existing sent balance. */
export function prepareDemandPayment261(root:CampaignState,record:EncounterGroup261):DemandPaymentPlan261 {
 const pending=record.pending261,g=record.state,w=worldGroupContext(root,record.state.id),factions=root.worldFactions;
 const fail=(reason:string):DemandPaymentPlan261=>({ok:false,reason});
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||pending?.kind!=='demand'||!w||!factions||!('members'in g)||record.localMapId!==null||g.lastPersonalTick!==root.tick||!pending.demands.length)return fail('La demande confirmée et ses propriétaires sont indisponibles.');
 const lines=pending.demands,category=lines[0]!.kind;
 if(new Set(lines.map(l=>l.id)).size!==lines.length||lines.some(l=>(category==='human'||category==='animal')?l.kind!==category:l.kind!=='pile'&&l.kind!=='packed')||category==='human'&&lines.length!==1)return fail('Le manifeste de la demande n’est pas une sélection admissible.');
 const now=root.tick,openingId=root.nextId,openingRng=root.rng,openingState=record.state,signature=JSON.stringify(record);
 const registryBefore=root.worldGroups!,worldPawnsBefore=root.worldPawns!,memoriesBefore=registryBefore.lostMemories;
 const recordsBefore=registryBefore.groups,recordSlotBefore=recordsBefore.indexOf(record);if(recordSlotBefore<0)return fail('La demande n’appartient plus à son vrai registre.');
 // JSON equality seals values, not the physical originals a draft will mutate.
 // Capture each actual holder once; a same-ID clone cannot replace its target.
 const membersBefore=g.members.slice(),itemsBefore=g.items.slice(),packsBefore=(g.packed??[]).slice(),animalsBefore=(g.animalOwners?.members??[]).slice();
 const foreignPeopleBefore=pending.people.slice(),foreignAnimalsBefore=pending.animals.slice(),foreignItemsBefore=pending.items.slice(),foreignPacksBefore=pending.packed.slice();
 const buildingsBefore=packsBefore.map(p=>p.building),foreignBuildingsBefore=foreignPacksBefore.map(p=>p.building);
 let lostMemories:LostCampaignMemory[]|undefined;
 let cession:PreparedCaravanCession261|undefined,inventory:ReturnType<typeof draftSplitInventory>,nextId=openingId,nextRng=openingRng;
 const removedItems:MaterialPile[]=[],removedPacks:NonNullable<AwayGroup['packed']>=[],updates:{original:MaterialPile;quantity:number}[]=[];
 const gone=new Set<number>(),cededIds=new Set<number>();
 if(category==='human'||category==='animal'){
  for(const line of lines)cededIds.add(line.id);
  const human=category==='human'?g.members.find(p=>p.id===lines[0]!.id):undefined;
  if(category==='human'){
   if(!human||!actualPlayerOwner259(human,factions.playerFactionId)&&!(human.worldAffiliation259?.guestStatus==='Prisoner'&&human.worldAffiliation259.hostFactionId===factions.playerFactionId))return fail('La personne demandée n’est plus membre admissible de cette caravane.');
   if(actualPlayerOwner259(human,factions.playerFactionId)&&g.members.filter(p=>actualPlayerOwner259(p,factions.playerFactionId)).length<2)return fail('La demande ne peut pas céder le dernier vrai propriétaire.');
   const prepared=prepareCaravanCaptivity261(w,g,human,pending.factionId);if(!prepared.ok)return prepared;cession=prepared;
   if(human.worldAffiliation259?.factionId===factions.playerFactionId){try{lostMemories=draftCaravanPersonLost261(root,w,record,human,prepared.row);}catch{return fail('Le souvenir de cette vraie cession ne peut pas conserver sa provenance.');}}
  }else{
   const animals=lines.map(l=>g.animalOwners?.members.find(a=>a.id===l.id));if(animals.some(a=>!a))return fail('Un animal demandé n’est plus détenu.');
   const prepared=prepareCaravanAnimalCession261(root,g,animals as NonNullable<typeof animals[number]>[]);if(!prepared.ok)return prepared;cession=prepared;
  }
  inventory=draftSplitInventory(groupPhysicalPawns256(g),g.items,cededIds,[],openingId,openingRng,now,g.packed??[],[],human?.id,root.schemaVersion);
  if(!inventory||inventory.child.length||inventory.childPacked.length)return fail('Les biens du membre cédé ne peuvent pas rejoindre les détenteurs restants.');
  nextId=inventory.nextId;nextRng=inventory.rng;
 }else for(const line of lines){
  if(line.kind==='pile'){
   const p=g.items.find(p=>p.id===line.id);
   if(!p||!Number.isSafeInteger(line.quantity)||line.quantity<1||line.quantity>p.quantity)return fail('Une quantité demandée n’est plus disponible.');
   removedItems.push({...p,quantity:line.quantity});
   if(line.quantity===p.quantity)gone.add(p.id);
   else {if(!Number.isSafeInteger(nextId+1))return fail('Le registre des fragments est plein.');nextId++;updates.push({original:p,quantity:p.quantity-line.quantity});}
  }else if(line.kind==='packed'){
   const pack=g.packed?.find(p=>p.building.id===line.id);if(!pack||line.quantity!==1)return fail('Un paquet demandé n’est plus disponible.');removedPacks.push(pack);
  }else return fail('Le manifeste de biens est incohérent.');
 }
 if(!g.members.some(p=>!cededIds.has(p.id)&&actualPlayerOwner259(p,factions.playerFactionId)))return fail('La cession ne conserve aucun vrai propriétaire.');
 const baseHistory=g.reorganization??openGroupReorganization(g,root.worldGroups!.losses,now,g.members.map(p=>({pawnId:p.id,originMapId:record.originMapId,context:record.context})));
 let history=withGroupExchange(baseHistory,'sent',removedItems);history={...history,memberOrigins:history.memberOrigins.filter(o=>!cededIds.has(o.pawnId))};
 if(category==='human'){
  const staged={...g,reorganization:{...history,inventoryEffects:{...history.inventoryEffects}}};
  for(const item of g.items)if((item.owner.type==='apparel'||item.owner.type==='equipment')&&cededIds.has(item.owner.pawnId))recordCaravanInventoryEffect256(staged,item.item,item.quantity);
  history=staged.reorganization;
 }
 if(removedPacks.length)history.packed=exchangeGroupPackedBalance256(history.packed,'sent',removedPacks);
 const foreign=prepareEncounterForeignWorld261(root,record,nextRng);if(!foreign.ok)return foreign;
 let used=false;
 const sameOriginals=(actual:readonly object[],before:readonly object[])=>actual.length===before.length&&actual.every((p,i)=>p===before[i]);
 const writable=(o:object,key:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(o,key);return !!d&&Object.hasOwn(d,'value')&&d.writable===true;};
 const mutable=(o:object)=>Object.isExtensible(o)&&Reflect.ownKeys(o).every(key=>{const d=Object.getOwnPropertyDescriptor(o,key)!;return Object.hasOwn(d,'value')&&d.writable===true&&(Array.isArray(o)&&key==='length'||d.configurable===true);});
 const assignableChanges=(original:object,next:object)=>{const a=original as Record<string,unknown>,b=next as Record<string,unknown>;return Object.keys(a).every(key=>Object.hasOwn(b,key)||Object.getOwnPropertyDescriptor(a,key)?.configurable===true)&&Object.keys(b).every(key=>JSON.stringify(a[key])===JSON.stringify(b[key])||(Object.hasOwn(a,key)?writable(a,key):Object.isExtensible(a)));};
 const originalsCurrent=()=>sameOriginals(g.members,membersBefore)&&sameOriginals(g.items,itemsBefore)&&sameOriginals(g.packed??[],packsBefore)&&packsBefore.every((p,i)=>p.building===buildingsBefore[i])&&sameOriginals(g.animalOwners?.members??[],animalsBefore)&&sameOriginals(pending.people,foreignPeopleBefore)&&sameOriginals(pending.animals,foreignAnimalsBefore)&&sameOriginals(pending.items,foreignItemsBefore)&&sameOriginals(pending.packed,foreignPacksBefore)&&foreignPacksBefore.every((p,i)=>p.building===foreignBuildingsBefore[i]);
 // All write targets, including foreign publication, must still accept their
 // writes BEFORE foreign.commit performs the first ownership publication.
 const recipientsCurrent=()=>writable(root,'nextId')&&writable(root,'rng')&&writable(record,'state')&&Object.getOwnPropertyDescriptor(record,'pending261')?.configurable===true&&mutable(root.worldGroups!.events)&&mutable(root.worldPawns!.owners)&&writable(root.worldPawns!,'currentRate')&&(!lostMemories||writable(root.worldGroups!,'lostMemories'))&&updates.every(u=>writable(u.original,'quantity'))&&(!inventory||inventory.updates.every(u=>assignableChanges(u.original,u.next))&&inventory.packedUpdates.every(u=>writable(u.original,'owner')))&&foreignPeopleBefore.every(mutable)&&foreignAnimalsBefore.every(mutable)&&foreignItemsBefore.every(p=>!p.rot||writable(p,'rot'))&&(!cession||membersBefore.filter(p=>cededIds.has(p.id)).every(mutable));
 const current=()=>!used&&root.tick===now&&root.nextId===openingId&&root.rng===openingRng&&root.worldGroups===registryBefore&&root.worldPawns===worldPawnsBefore&&registryBefore.groups===recordsBefore&&recordsBefore[recordSlotBefore]===record&&registryBefore.lostMemories===memoriesBefore&&record.state===openingState&&record.pending261===pending&&originalsCurrent()&&recipientsCurrent()&&JSON.stringify(record)===signature&&(!inventory||splitInventoryDraftCurrent(g.items,inventory,g.packed??[]))&&(!cession||cession.current())&&foreign.current();
 return {ok:true,current,commit(){
  if(!current())throw Error('Stale actual caravan demand payment');used=true;
  // All refusal work, native-set plans and RNG draws are complete. No await,
  // future source lookup or new validation occurs after this first publication.
  foreign.commit(cession);if(inventory)commitSplitInventory(inventory);
  for(const update of updates)markPileContentWrite379(update.original).quantity=update.quantity;
  const items=inventory?inventory.source:g.items.filter(p=>!gone.has(p.id)),packs=inventory?inventory.sourcePacked:(g.packed??[]).filter(p=>!removedPacks.includes(p));
  const next:AwayGroup={...g,members:g.members.filter(p=>!cededIds.has(p.id)),items,reorganization:history,...packs.length?{packed:packs}:{}};
  if(!packs.length)delete next.packed;
  if(g.animalOwners){const members=g.animalOwners.members.filter(a=>!cededIds.has(a.id));if(members.length)next.animalOwners={...g.animalOwners,members,origins:g.animalOwners.origins.filter(o=>!cededIds.has(o.pawnId)),order:g.animalOwners.order.filter(id=>!cededIds.has(id))};else delete next.animalOwners;}
  record.state=next;delete record.pending261;root.nextId=nextId;if(lostMemories)root.worldGroups!.lostMemories=lostMemories;
  for(const p of membersBefore)if(cededIds.has(p.id))notifyBillWorkerUnavailable283(w,p.id);
  root.worldGroups!.events.push({tick:now,type:'command',message:'La caravane a cédé les originaux demandés. Les biens des personnes et animaux cédés restent aux détenteurs restants.'});if(root.worldGroups!.events.length>80)root.worldGroups!.events.splice(0,root.worldGroups!.events.length-80);
 }};
}
