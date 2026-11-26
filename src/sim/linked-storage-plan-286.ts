import {revokeActorRecordSource297} from './actor-record-source-297.ts';
import {isSchema286OrLater} from './schema-compatibility-257.ts';
import {captureLinkedStorageOwners286,type LinkedStorageOwner286,type LinkedStorageOwners286} from './linked-storage-owners-286.ts';
import {validLinkedStorageWorld286,validLinkedStorageRegistryShape286} from './linked-storage-save-286.ts';
import {cloneLinkedShelfPolicy286,sameLinkedShelfPolicy286,patchLinkedShelfPolicy286,validLinkedShelfPolicy286} from './linked-storage-policy-286.ts';
import {removalWritesMutable259,sealRemovalOriginal259,type MapRemovalWrite259} from './map-removal-writes-259.ts';
import {registeredCampaign,registeredMapId} from './world-map-context.ts';
import {targetBuildingPlayerUse263} from './world-target-building-263.ts';
import type {LinkedShelfMember286,LinkedStorageCommand286,LinkedStorageGroup286,LinkedStorageRegistry286} from './linked-storage-state-286.ts';
import type {ShelfStorageSettings} from './shelf-storage.ts';
import type {CampaignState} from './world-map-state.ts';
import type {StorageSettings,Structure,World} from './types.ts';

export interface LinkedStoragePlan286 {
 readonly ok:true;
 readonly writes:MapRemovalWrite259[];
 readonly changedCellIds:number[];
 readonly noop:boolean;
 current():boolean;
 /** Revalidate everything before the first write. Consume at most once. */
 commit():boolean;
}
export type LinkedStoragePlanResult286=LinkedStoragePlan286|{ok:false;reason:string};
export type LinkedStoragePolicyCommand286={type:'shelf-policy';structureId:number;settings:StorageSettings};
const refused=(reason:string):LinkedStoragePlanResult286=>({ok:false,reason});
const integer=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>0;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const dataFields=(v:object)=>Reflect.ownKeys(v).every(k=>{const d=Object.getOwnPropertyDescriptor(v,k)!;return typeof k==='string'&&d.enumerable===true&&Object.hasOwn(d,'value');});
const idList=(v:unknown,min:number):v is number[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length>=min&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable===true&&Object.hasOwn(d,'value')&&integer(d.value))&&new Set(v).size===v.length;
function exactData(v:unknown,keys:readonly string[]):v is Record<string,unknown>{return plain(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable===true&&Object.hasOwn(d,'value');});}
export function normalizeLinkedStorageName286(value:unknown):string|undefined{
 if(typeof value!=='string')return;const name=value.trim();return name.length>=1&&name.length<=64&&!/[\u0000-\u001f\u007f]/.test(name)?name:undefined;
}
function rootFieldCurrent(root:CampaignState,key:string):()=>boolean{
 const before=Object.getOwnPropertyDescriptor(root,key);
 return ()=>{const now=Object.getOwnPropertyDescriptor(root,key);return before?!!now&&now.enumerable===before.enumerable&&now.configurable===before.configurable&&now.writable===before.writable&&Object.hasOwn(now,'value')&&Object.is(now.value,before.value):!now;};
}
/** Only cold commands/lifecycle callers enter here. No cell reader resolves a
 * group, no terrain is copied, and no physical cargo is moved by this plan. */
function prepare(input:CampaignState,owners:LinkedStorageOwners286,change:(draft:Draft)=>string|undefined,authority:()=>boolean):LinkedStoragePlanResult286{
 const root=owners.root;
 if(!isSchema286OrLater(root.schemaVersion)||!owners.valid||!validLinkedStorageWorld286(root,owners)||!owners.members.every(o=>validLinkedShelfPolicy286(o.building.shelf?.settings,root.schemaVersion)))return refused('Propriétaires des réglages liés invalides.');
 const original=root.linkedStorage286,registryCurrent=rootFieldCurrent(root,'linkedStorage286');
 const draft=new Draft(owners,original);const reason=change(draft);if(reason)return refused(reason);
 const writes=draft.writes();
 const registryWrite=writes.find(w=>w.object===root&&w.key==='linkedStorage286');
 if(registryWrite&&!validLinkedStorageRegistryShape286(registryWrite.value,root.schemaVersion,root.nextId))return refused('Limites du registre de réglages atteintes.');
 if(!removalWritesMutable259(writes)||writes.some(w=>{const d=Object.getOwnPropertyDescriptor(w.object,w.key);return !!d&&d.enumerable!==true;}))return refused('Un réglage concerné ne peut pas être modifié.');
 // Seal original membership, exact policy leaves/descriptors, and the private
 // desired values too: mutating a returned write must never bless a new plan.
 let seal:(phase:0|1|2)=>boolean;
 const changedCellIds=[...draft.changedCells],writeOriginals=writes.map(w=>({...w}));
 // Do not traverse write.object: one of those objects is the campaign root.
 // Seal only the bounded original policies and private replacement values.
 try{seal=sealRemovalOriginal259({registry:original,buildings:owners.members.map(m=>m.building),next:writes.map(w=>w.value),changedCellIds},[],[]);}catch{return refused('Les réglages doivent être des données ordinaires.');}
 const writesCurrent=()=>writes.length===writeOriginals.length&&writes.every((w,i)=>{const old=writeOriginals[i]!;return Reflect.ownKeys(w).length===Reflect.ownKeys(old).length&&Reflect.ownKeys(old).every(k=>{const d=Object.getOwnPropertyDescriptor(w,k);return !!d&&Object.hasOwn(d,'value')&&d.enumerable===true&&Object.is(d.value,Reflect.get(old,k));});});
 let consumed=false;
 const current=()=>{try{return !consumed&&registeredCampaign(input)===root&&isSchema286OrLater(root.schemaVersion)&&registryCurrent()&&owners.current()&&authority()&&seal(0)&&writesCurrent()&&removalWritesMutable259(writes);}catch{return false;}};
 if(!current())return refused('Les étagères ont changé pendant la préparation.');
 return {ok:true,writes,changedCellIds,noop:writes.length===0,current,commit(){if(!current())return false;consumed=true;for(const w of writes){revokeActorRecordSource297(w.object);if(w.present){if(Object.hasOwn(w.object,w.key))Reflect.set(w.object,w.key,w.value);else Object.defineProperty(w.object,w.key,{value:w.value,writable:true,enumerable:true,configurable:true});}else Reflect.deleteProperty(w.object,w.key);}return true;}};
}
class Draft {
 readonly changedCells=new Set<number>();
 private readonly groups=new Map<number,LinkedStorageGroup286>();
 private readonly links=new Map<Structure,LinkedShelfMember286|undefined>();
 private readonly policies=new Map<Structure,ShelfStorageSettings>();
 private nextId:number;
 private registryChanged=false;
 constructor(private readonly owners:LinkedStorageOwners286,private readonly original:LinkedStorageRegistry286|undefined){
  this.nextId=original?.nextId??1;for(const g of original?.groups??[])this.groups.set(g.id,g);
 }
 private mutableGroup(id:number):LinkedStorageGroup286|undefined{
  const g=this.groups.get(id);if(!g)return;
  if(this.original?.groups.includes(g)){const next={...g,memberIds:[...g.memberIds]};this.groups.set(id,next);return next;}
  return g;
 }
 private setPolicy(owner:LinkedStorageOwner286,policy:ShelfStorageSettings,copyEvenEqual=false):void{
  const changed=!sameLinkedShelfPolicy286(owner.building.shelf!.settings,policy);
  if(!changed&&!copyEvenEqual)return;
  this.policies.set(owner.building,cloneLinkedShelfPolicy286(policy));
  if(changed&&owner.installed)for(const id of owner.building.shelf!.cells)this.changedCells.add(id);
 }
 private removeFromGroup(owner:LinkedStorageOwner286):void{
  const linked=owner.building.shelf!.linked286;if(!linked)return;
  const g=this.mutableGroup(linked.groupId)!;g.memberIds=g.memberIds.filter(id=>id!==owner.building.id);this.links.set(owner.building,undefined);this.registryChanged=true;
 }
 /** The effective projection wins. The hidden independent value is deleted,
  * never restored, including a singleton caused by someone else's departure. */
 private dissolve():void{
  for(const [id,g]of this.groups)if(g.memberIds.length<2){for(const memberId of g.memberIds)this.links.set(this.owners.byId.get(memberId)!.building,undefined);this.groups.delete(id);this.registryChanged=true;}
 }
 link(selected:readonly LinkedStorageOwner286[]):string|undefined{
  const source=selected[0]!,sourceLink=source.building.shelf!.linked286;
  if(sourceLink&&selected.every(o=>o.building.shelf!.linked286?.groupId===sourceLink.groupId))return;
  let destination:LinkedStorageGroup286;
  if(sourceLink)destination=this.mutableGroup(sourceLink.groupId)!;
  else{
   if(!Number.isSafeInteger(this.nextId)||this.nextId>=Number.MAX_SAFE_INTEGER)return 'Identité de groupe épuisée.';
   const id=this.nextId++;destination={id,originMapId:source.mapId!,name:`Étagères ${id}`,settings:cloneLinkedShelfPolicy286(source.building.shelf!.settings),memberIds:[]};this.groups.set(id,destination);this.registryChanged=true;
  }
  for(const owner of selected){const s=owner.building;if(s.shelf!.linked286?.groupId===destination.id)continue;
   this.removeFromGroup(owner);
   this.links.set(s,{revision:1,groupId:destination.id,independent:cloneLinkedShelfPolicy286(s.shelf!.settings)});
   destination.memberIds.push(s.id);this.setPolicy(owner,destination.settings,true);this.registryChanged=true;
  }
  this.dissolve();return;
 }
 unlink(owner:LinkedStorageOwner286):void{this.removeFromGroup(owner);this.dissolve();}
 remove(removed:readonly LinkedStorageOwner286[]):void{for(const owner of removed)this.removeFromGroup(owner);this.dissolve();}
 rename(owner:LinkedStorageOwner286,name:string):string|undefined{
  const link=owner.building.shelf!.linked286;if(!link)return 'Cette étagère ne possède pas de groupe.';
  const g=this.groups.get(link.groupId)!;if(g.name===name)return;
  this.groups.set(g.id,{...g,name});this.registryChanged=true;return;
 }
 patch(owner:LinkedStorageOwner286,settings:StorageSettings):string|undefined{
  const s=owner.building,link=s.shelf!.linked286,g=link?this.groups.get(link.groupId):undefined;
  const policy=patchLinkedShelfPolicy286(g?.settings??s.shelf!.settings,settings,this.owners.root.schemaVersion);if(!policy)return 'Politique de stockage invalide.';
  if(sameLinkedShelfPolicy286(g?.settings??s.shelf!.settings,policy))return;
  if(!g)this.setPolicy(owner,policy);
  else{this.groups.set(g.id,{...g,settings:cloneLinkedShelfPolicy286(policy)});this.registryChanged=true;for(const id of g.memberIds)this.setPolicy(this.owners.byId.get(id)!,policy);}
  return;
 }
 writes():MapRemovalWrite259[]{
  const writes:MapRemovalWrite259[]=[];
  if(this.registryChanged)writes.push({object:this.owners.root,key:'linkedStorage286',present:true,value:{revision:1,nextId:this.nextId,groups:[...this.groups.values()]} satisfies LinkedStorageRegistry286});
  for(const [s,value]of this.links)writes.push({object:s.shelf!,key:'linked286',present:value!==undefined,...(value?{value}:{})});
  for(const [s,value]of this.policies)writes.push({object:s.shelf!,key:'settings',present:true,value});
  return writes;
 }
}
export function prepareLinkedStorageCommand286(world:World,command:LinkedStorageCommand286|LinkedStoragePolicyCommand286):LinkedStoragePlanResult286{
 try{
  if(!isSchema286OrLater(world.schemaVersion)||!plain(command)||!dataFields(command))return refused('Réglages liés indisponibles.');
  const owners=captureLinkedStorageOwners286(world),mapId=registeredMapId(world);
  const local=(id:number)=>{const owner=owners.byId.get(id);return owner?.installed&&owner.mapId===mapId&&world.structures.includes(owner.building)&&targetBuildingPlayerUse263(world,owner.building)?owner:undefined;};
  let selected:LinkedStorageOwner286[]=[];
  if(command.type==='shelf-link'){
   if(!exactData(command,['type','structureIds'])||!idList(command.structureIds,2))return refused('Sélection d’étagères invalide.');
   selected=command.structureIds.flatMap(id=>{const row=local(id);return row?[row]:[];});if(selected.length!==command.structureIds.length)return refused('Toutes les étagères doivent être installées ici et vous appartenir.');
  }else{
   const keys=command.type==='shelf-unlink'?['type','structureId']:command.type==='shelf-group-rename'?['type','structureId','name']:command.type==='shelf-policy'?['type','structureId','settings']:[];
   if(!keys.length||!exactData(command,keys)||!('structureId'in command)||!integer(command.structureId))return refused('Commande d’étagère invalide.');
   const owner=local(command.structureId);if(!owner)return refused('Étagère installée et contrôlée absente.');selected=[owner];
  }
  if(mapId===undefined||selected.some(o=>o.mapId!==mapId))return refused('Carte d’origine absente.');
  const anchors=selected.map(o=>[o.building.id,o]as const);
  return prepare(world,owners,d=>{
   if(command.type==='shelf-link')return d.link(selected);
   if(command.type==='shelf-unlink'){d.unlink(selected[0]!);return;}
   if(command.type==='shelf-group-rename'){const name=normalizeLinkedStorageName286(command.name);return name===undefined?'Nom de groupe invalide.':d.rename(selected[0]!,name);}
   return d.patch(selected[0]!,command.settings);
  },()=>registeredMapId(world)===mapId&&anchors.every(([id,owner])=>local(id)===owner));
 }catch{return refused('Réglages ou propriétaires des étagères invalides.');}
}
/** Lifecycle-only removal of actual originals. Packing/travel are not removal.
 * Caller owns destruction/reinstallation/map removal and its common commit. */
export function prepareLinkedStorageRemoval286(input:CampaignState,buildingIds:readonly number[]):LinkedStoragePlanResult286{
 try{
  if(!idList(buildingIds,0))return refused('Retraits d’étagères invalides.');
  const owners=captureLinkedStorageOwners286(input),removed=buildingIds.map(id=>owners.byId.get(id));
  if(removed.some(o=>!o))return refused('Original d’étagère à retirer absent.');
  return prepare(input,owners,d=>{d.remove(removed as LinkedStorageOwner286[]);return;},()=>true);
 }catch{return refused('Retrait des réglages liés invalide.');}
}
