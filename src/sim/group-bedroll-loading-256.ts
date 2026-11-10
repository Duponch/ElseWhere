import {assignPileOwner} from './pile-index.ts';
import {validGroupFreightPack258,groupPackedMassGrams258} from './group-freight-contract-258.ts';
import {captureGroupMass} from './group-capture.ts';
import {groupHumanHandler257} from './group-human-admission-257.ts';
import type {WildAnimal} from './wildlife-state.ts';
import {groupPackHandler258,usableGroupPackAnimal258,selectedGroupPackAnimal258,groupPackedContactReady258,validGroupPackedDeadline258,groupPackedReceiverSpace258,pendingGroupPackedDeliveries258} from './group-packed-animal-loading-258.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import type {World,Pawn,Cell} from './types.ts';
import type {PreparingGroup,GroupMassCapture} from './group-capture.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {validBedrollBuilding256} from './bedroll-save-256.ts';
import {allowedAreaReason} from './allowed-area-state.ts';
export interface GroupBedrollLoading256 {revision:1|2;manifest:{structureId:number;carrierId:number;loaded:boolean;animalCarrierId?:number;deliveredToAnimal?:true;handoffReadyCore?:number}[]}
export type PreparingBedrollGroup256=PreparingGroup&{bedrollLoading?:GroupBedrollLoading256};
export interface GroupBedrollPreview256 {loading:GroupBedrollLoading256;mass:GroupMassCapture}
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const integer=(v:unknown,min=1)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min;
function reserved(w:World,id:number,exceptGroupId?:number):boolean{return !!campaignAuthority(w).worldGroups?.groups.some(r=>r.state.id!==exceptGroupId&&'manifest'in r.state&&r.state.bedrollLoading?.manifest.some(line=>line.structureId===id&&!line.loaded))||w.jobs.some(j=>j.furniture?.structureId===id||j.deconstruction?.structureId===id)||w.pawns.some(p=>p.haul?.whole&&p.haul.sourcePileId===id);}
/** Extends the existing formation preflight after its material-pile manifest.
 * Uses that same mass capture, actual original members, and bounded local
 * reachability authority. No path search, ID allocation or RNG occurs here. */
export function previewGroupBedrollLoading256(w:World,ids:readonly number[],members:readonly Pawn[],mass:GroupMassCapture,reachable:(p:Pawn,cell:Cell)=>'reachable'|'unreachable'|'deferred',animals:readonly WildAnimal[]=[],physicalBusy:readonly number[]=[]):{kind:'ready';preview:GroupBedrollPreview256}|{kind:'refused';reason:string}|{kind:'deferred'} {
 const fail=(reason:string)=>({kind:'refused' as const,reason});
 if(w.schemaVersion<256||new Set(ids).size!==ids.length||ids.some(id=>!integer(id)||id>=w.nextId)||members.some(p=>!w.pawns.includes(p))||new Set(mass.carriers.map(c=>c.pawnId)).size!==mass.carriers.length||members.some(p=>!mass.carriers.some(c=>c.pawnId===p.id))||mass.carriers.some(c=>!members.some(p=>p.id===c.pawnId)&&!w.wildlife?.animals.some(a=>a.id===c.pawnId&&a.domestic&&a.state!=='dead')))return fail('Chargement de meubles minifiés invalide.');
 if(animals.some(a=>!w.wildlife?.animals.includes(a)||!mass.carriers.some(c=>c.pawnId===a.id)))return fail('Animal porteur original absent.');
 const carriers=mass.carriers.map(c=>({...c})),manifest:GroupBedrollLoading256['manifest']=[];
 for(const id of ids){const pack=w.packed.find(p=>p.building.id===id);if(!pack||pack.owner.type!=='ground'||(w.schemaVersion>=258?!validGroupFreightPack258(pack,w,w.schemaVersion):pack.building.kind!=='bedroll'||!validBedrollBuilding256(pack.building,w.schemaVersion))||reserved(w,id))return fail('Le meuble minifié doit être disponible au sol.');
  const packMass=groupPackedMassGrams258(pack,w.schemaVersion);if(packMass===undefined)return fail('Masse du meuble minifié indisponible.');
  let carrier:typeof carriers[number]|undefined,handler:Pawn|undefined;
  // Prefer actual selected pack animals; retain deterministic greedy final fit.
  for(const c of [...carriers].sort((a,b)=>Number(!!members.find(p=>p.id===a.pawnId))-Number(!!members.find(p=>p.id===b.pawnId))||a.grams-b.grams||a.pawnId-b.pawnId)){
   if(c.capacityGrams-c.grams<packMass)continue;const animal=animals.find(a=>a.id===c.pawnId);if(animal&&(w.schemaVersion<258||!usableGroupPackAnimal258(w,animal)))continue;
   const people=animal?members:[members.find(p=>p.id===c.pawnId)].filter((p):p is Pawn=>!!p);
   for(const person of [...people].sort((a,b)=>a.id-b.id)){if(physicalBusy.includes(person.id))continue;if(w.schemaVersion>=258?!groupPackHandler258(person):w.schemaVersion>=257&&!groupHumanHandler257(person))continue;if(allowedAreaReason(w,person,pack.owner)||animal&&allowedAreaReason(w,person,animal))continue;const access=reachable(person,pack.owner);if(access==='deferred')return {kind:'deferred'};if(access!=='reachable')continue;if(animal){const destination=reachable(person,animal);if(destination==='deferred')return {kind:'deferred'};if(destination!=='reachable')continue;}carrier=c;handler=person;break;}if(carrier)break;
  }
  if(!carrier||!handler)return fail('Aucun porteur admissible ne peut charger ce meuble minifié.');carrier.grams+=packMass;manifest.push({structureId:id,carrierId:handler.id,loaded:false,...carrier.pawnId!==handler.id?{animalCarrierId:carrier.pawnId}:{}});
 }
 const grams=carriers.reduce((n,p)=>n+p.grams,0);if(!Number.isSafeInteger(grams))return fail('Masse de chargement invalide.');
 return {kind:'ready',preview:{loading:{revision:w.schemaVersion>=258?2:1,manifest},mass:{grams,capacityGrams:mass.capacityGrams,...mass.ridingFactor!==undefined?{ridingFactor:mass.ridingFactor}:{},carriers}}};
}
/** Shared closed receipt shape; inactive projections retain references only. */
export function validGroupBedrollLoadingReferences256(value:unknown,w:World,g:PreparingGroup,version:number):value is GroupBedrollLoading256 {
 if(version<256||!plain(value)||Reflect.ownKeys(value).length!==2||!(value.revision===1||version>=258&&value.revision===2&&g.travelPreparation===true)||!Array.isArray(value.manifest)||Object.getPrototypeOf(value.manifest)!==Array.prototype||value.manifest.length>w.nextId-1||Reflect.ownKeys(value.manifest).length!==value.manifest.length+1)return false;
 const ids=new Set<number>(),held=new Set<number>();let pending=false;
 for(let i=0;i<value.manifest.length;i++){const d=Object.getOwnPropertyDescriptor(value.manifest,String(i));if(!d||!Object.hasOwn(d,'value')||!plain(d.value))return false;const r=d.value,keys=Reflect.ownKeys(r);if(keys.some(k=>!['structureId','carrierId','loaded',...(value.revision===2?['animalCarrierId','deliveredToAnimal','handoffReadyCore']:[])].includes(String(k)))||!integer(r.structureId)||Number(r.structureId)>=w.nextId||!integer(r.carrierId)||!g.memberIds.includes(Number(r.carrierId))||typeof r.loaded!=='boolean'||ids.has(Number(r.structureId)))return false;ids.add(Number(r.structureId));if(!r.loaded)pending=true;else if(pending)return false;
  if(Object.hasOwn(r,'animalCarrierId')&&(!integer(r.animalCarrierId)||!g.animalPreparation?.lines.some(l=>l.animalId===r.animalCarrierId&&l.mode==='lead')))return false;
  if(Object.hasOwn(r,'deliveredToAnimal')&&(r.deliveredToAnimal!==true||!r.loaded||r.animalCarrierId===undefined))return false;
  if(Object.hasOwn(r,'handoffReadyCore')&&(!validGroupPackedDeadline258(r.handoffReadyCore,w,g)||!r.loaded||r.deliveredToAnimal||r.animalCarrierId===undefined||g.phase!=='loading'))return false;
  if(r.loaded&&r.animalCarrierId!==undefined&&!r.deliveredToAnimal){if(held.has(Number(r.carrierId)))return false;held.add(Number(r.carrierId));}
  if(g.phase==='gathering'&&r.loaded||g.phase==='leaving'&&(!r.loaded||r.animalCarrierId!==undefined&&!r.deliveredToAnimal))return false;
 }return true;
}
/** Original RAW owner binding. A loaded receipt never replaces a package. */
export function validGroupBedrollLoading256(value:unknown,w:World,g:PreparingGroup,version:number):value is GroupBedrollLoading256|undefined {
 if(value===undefined)return true;if(!validGroupBedrollLoadingReferences256(value,w,g,version)||value.manifest.length>w.packed.length)return false;
 for(const row of value.manifest){const pack=w.packed.find(p=>p.building.id===row.structureId);if(!pack||(value.revision===1?pack.building.kind!=='bedroll'||!validBedrollBuilding256(pack.building,version):!validGroupFreightPack258(pack,w,version))||(row.loaded?(pack.owner.type!=='inventory'||pack.owner.pawnId!==(row.deliveredToAnimal?row.animalCarrierId:row.carrierId)):pack.owner.type!=='ground'||reserved(w,row.structureId,g.id)))return false;
  if(row.handoffReadyCore!==undefined){const p=w.pawns.find(p=>p.id===row.carrierId),animal=selectedGroupPackAnimal258(w,g,row.animalCarrierId!);if(!p||!animal||!groupPackedContactReady258(w,p,animal))return false;}
 }return true;
}
export function validGroupBedrollLoadingField256(g:PreparingBedrollGroup256,w:World,version:number):boolean {const d=Object.getOwnPropertyDescriptor(g,'bedrollLoading');return !d||version>=256&&Object.hasOwn(d,'value')&&d.enumerable===true&&d.value!==undefined&&validGroupBedrollLoading256(d.value,w,g,version);}
export function nextGroupBedrollPickup256(w:World,g:PreparingBedrollGroup256):{pack:PackedFurniture;carrier:Pawn;line:GroupBedrollLoading256['manifest'][number]}|undefined {
 if(!validGroupBedrollLoadingField256(g,w,w.schemaVersion))throw Error('Invalid actual bedroll loading');
 const line=g.bedrollLoading?.manifest.find(row=>!row.loaded);if(!line)return;const pack=w.packed.find(p=>p.building.id===line.structureId)!,carrier=w.pawns.find(p=>p.id===line.carrierId);if(!carrier)throw Error('Missing actual bedroll carrier');return {pack,carrier,line};
}
/** Contact transition only, called by the ordinary on-map group driver after
 * movement completion. Existing cursor/exit logic waits for all lines loaded. */
export function commitGroupBedrollPickup256(w:World,g:PreparingBedrollGroup256,p:Pawn):boolean {
 if(w.group!==g||g.phase!=='loading'||g.cursor!==g.manifest.length||!validGroupBedrollLoadingField256(g,w,w.schemaVersion))return false;const next=nextGroupBedrollPickup256(w,g);if(!next||next.carrier!==p||next.pack.owner.type!=='ground'||p.moveCooldown!==0||(p.motion?.end??0)>w.tick||Math.abs(p.x-next.pack.owner.x)+Math.abs(p.z-next.pack.owner.z)>1||reserved(w,next.pack.building.id,g.id))return false;
 if(w.schemaVersion>=258){const ids=new Set([...g.memberIds,...(g.animalPreparation?.lines.map(l=>l.animalId)??[])]),members=w.pawns.filter(a=>g.memberIds.includes(a.id)),animals=w.wildlife?.animals.filter(a=>ids.has(a.id))??[],items=w.piles.filter(a=>'pawnId'in a.owner&&ids.has(a.owner.pawnId)),packs=w.packed.filter(a=>a.owner.type==='inventory'&&ids.has(a.owner.pawnId)),mass=captureGroupMass(members,items,!!g.freight,w.schemaVersion,packs,animals),carrier=mass?.carriers.find(a=>a.pawnId===p.id),unit=groupPackedMassGrams258(next.pack,w.schemaVersion);if(!carrier||unit===undefined||g.animalPreparation?.lines.some(l=>l.handlerId===p.id&&l.mode==='carry')||!groupPackHandler258(p)||allowedAreaReason(w,p,next.pack.owner)||pendingGroupPackedDeliveries258(g,p.id)||g.manifest.slice(0,g.cursor).some(l=>l.carrierId===p.id&&l.animalCarrierId!==undefined&&!l.deliveredToAnimal))return false;if(next.line.animalCarrierId!==undefined){const a=selectedGroupPackAnimal258(w,g,next.line.animalCarrierId);if(!a||allowedAreaReason(w,p,a)||!groupPackedReceiverSpace258(w,g,a.id))return false;}else if(carrier.grams+unit>carrier.capacityGrams)return false;}
 assignPileOwner(next.pack,{type:'inventory',pawnId:p.id});next.line.loaded=true;p.path=[];p.state='idle';return true;
}

/** Pure source rows for the existing formation panel, same reservation and
 * shape predicates as previewGroupBedrollLoading256. No reachability claim. */
export function groupBedrollChoices256(w:World):readonly {pack:PackedFurniture;ok:boolean;reason?:string}[] {
 if(w.schemaVersion<256)return [];
 return w.packed.filter(pack=>pack.owner.type==='ground'&&(w.schemaVersion>=258?groupPackedMassGrams258(pack,w.schemaVersion)!==undefined:pack.building.kind==='bedroll')).map(pack=>{
  const reason=w.group?'Une caravane est déjà engagée.':(w.schemaVersion>=258?!validGroupFreightPack258(pack,w,w.schemaVersion):!validBedrollBuilding256(pack.building,w.schemaVersion))?'Ce meuble minifié n’est pas disponible.':reserved(w,pack.building.id)?'Ce meuble minifié est réservé à un autre travail.':undefined;
  return {pack,ok:!reason,...reason?{reason}:{}};
 });
}
