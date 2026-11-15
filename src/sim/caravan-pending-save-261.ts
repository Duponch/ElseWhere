import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {hasPartyMemoryField292} from './party-memories-292.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import type {World} from './types.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';
import {validateDetachedPawnRecordShape} from './pawn-record-save.ts';
import {captureHumanOwners} from './human-owners.ts';
import {hasCoupleFields285} from './couple-owner-save-285.ts';
import {validCouplePawnContext285} from './couple-save-285.ts';
import {validatePileRecordShape} from './material-record-save.ts';
import {validatePackedFurnitureRecords} from './furniture-transfer-save.ts';
import {validCaravanAnimalRecord256} from './group-animal-record-save-256.ts';
import {validWorldAffiliationForeignKeys259} from './world-affiliation-259.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {worldGroupContext} from './world-map-context.ts';
import {CARAVAN_FAMILY_BY_DEF_332,CARAVAN_TRADER_KINDS_332,isCaravanTraderKind332} from './trader-caravans-332.ts';
import type {CampaignState} from './world-map-state.ts';
import type {EncounterGroup261,PendingCaravanEncounter261} from './caravan-encounter-state-261.ts';
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:Record<string,unknown>,names:readonly string[])=>Reflect.ownKeys(v).length===names.length&&names.every(k=>Object.hasOwn(v,k));
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(v,i)).every(Boolean);
/** Envelope is checked before any nested record is interpreted as an actor. */
export function validPendingEncounterShape261(value:unknown,version:number,nextId:number,atCore:number):value is PendingCaravanEncounter261|undefined {
 if(value===undefined)return true;
 if((version!==261&&(Number(version)!==262&&!isSchema263OrLater(Number(version))))||!plainWorldPawnData256(value)||!plain(value)||!['meeting','demand','ambush',...((version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version)))))?['peace-talks']:[])].includes(String(value.kind))||!exact(value,['revision','kind','decision','atCore','factionId','people','animals','items','packed',...value.kind==='peace-talks'?['peaceTalksSiteId293']:[],...value.kind==='demand'?['demands']:[],...value.kind==='meeting'?['traderId','guardIds',...Number(version)>=338&&Object.hasOwn(value,'caravanKind338')?['caravanKind338']:[]]:[],...value.animalAmbush261===true?['animalAmbush261']:[]])||value.revision!==1||!int(value.atCore,0,atCore)||!(value.animalAmbush261===true?value.kind==='ambush'&&value.factionId===null:int(value.factionId,1))||!dense(value.people,nextId)||(value.animalAmbush261===true?value.people.length!==0:!value.people.length)||!dense(value.animals,nextId)||!dense(value.items,nextId)||!dense(value.packed,nextId))return false;
 if((value.kind==='ambush'||value.kind==='peace-talks')?value.decision!=='forced':value.kind==='meeting'?!['open','attack'].includes(String(value.decision)):!['open','fight'].includes(String(value.decision)))return false;
 if(value.animalAmbush261===true&&(value.animals.length<2||value.animals.length>100||value.items.length||value.packed.length)||Object.hasOwn(value,'animalAmbush261')&&value.animalAmbush261!==true)return false;
 if(value.kind==='peace-talks'&&(!int(value.peaceTalksSiteId293,1)||value.animals.length))return false;
 const people=value.people;
 if(value.kind==='meeting'){
  if(!int(value.traderId,1,nextId-1)||!people.some(p=>plain(p)&&p.id===value.traderId)||!dense(value.guardIds,people.length)||new Set(value.guardIds).size!==value.guardIds.length||value.guardIds.some(id=>!int(id,1,nextId-1)||id===value.traderId||!people.some(p=>plain(p)&&p.id===id)))return false;
  // Schema 338: an optional (old meetings migrate without it) known kind.
  if(Object.hasOwn(value,'caravanKind338')&&!isCaravanTraderKind332(value.caravanKind338))return false;
 }
 if(value.kind==='demand'){
  if(!dense(value.demands,nextId)||!value.demands.length)return false;
  const seen=new Set<number>();
  for(const line of value.demands){
   if(!plain(line)||!int(line.id,1,nextId-1)||seen.has(line.id))return false;seen.add(line.id);
   if(line.kind==='human'||line.kind==='animal'){if(!exact(line,['kind','id']))return false;}
   else if(line.kind==='pile'||line.kind==='packed'){if(!exact(line,['kind','id','quantity'])||!int(line.quantity,1)||line.kind==='packed'&&line.quantity!==1)return false;}
   else return false;
  }
 }
 return true;
}
/** Namespace registration happens in the same existing campaign pass as every
 * other original. It is never deferred until a command or hidden by projection. */
export function validatePendingEncounterOwners261(root:CampaignState,record:EncounterGroup261,globalIds:Set<number>,humanIds:Set<number>):string[] {
 const p=record.pending261;if(p===undefined)return [];
 if(!validPendingEncounterShape261(p,root.schemaVersion,root.nextId,root.tick*10))return ['Invalid or future pending caravan encounter'];
 const context=worldGroupContext(root,record.state.id);return context?validatePendingEncounterRecords261(root,record,context,globalIds,humanIds):['Pending encounter has no actual context'];
}
/** Same record validation in the decoder's already confirmed group projection. */
export function validatePendingEncounterRecords261(root:Pick<CampaignState,'schemaVersion'|'nextId'|'tick'|'worldFactions'>,record:EncounterGroup261,context:World,globalIds:NumericMembershipSink,humanIds:Set<number>):string[] {
 const p=record.pending261;if(!p)return [];
 if(!validPendingEncounterShape261(p,root.schemaVersion,root.nextId,root.tick*10))return ['Invalid pending projected encounter'];
 const factions=root.worldFactions,g=record.state;
 if(!context||!factions||record.localMapId!==null||!('members'in g)||!record.encounters261||!(p.animalAmbush261===true?p.factionId===null:factions.factions.some(f=>f.id===p.factionId&&f.id!==factions.playerFactionId)))return ['Pending encounter has no exclusive current caravan/faction owner'];
 if(p.kind==='meeting'&&p.caravanKind338!==undefined&&CARAVAN_FAMILY_BY_DEF_332[factions.factions.find(f=>f.id===p.factionId)!.def]!==CARAVAN_TRADER_KINDS_332[p.caravanKind338].family)return ['Pending caravan trader kind does not belong to its faction'];
 const errors:string[]=[],holders=new Set<number>();
 const add=(id:number)=>{if(!int(id,1,root.nextId-1)||globalIds.has(id))errors.push('Duplicate or invalid pending original');globalIds.add(id);};
 for(const actor of p.people){
  add(actor.id);holders.add(actor.id);humanIds.add(actor.id);
  errors.push(...validateDetachedPawnRecordShape(actor as unknown as Record<string,unknown>,context,root.schemaVersion,root.tick));
  if(actor.state==='dead'||actor.health?.death||actor.raid||actor.visitor||actor.podRescue||!validWorldAffiliationForeignKeys259(actor,factions)||actor.worldAffiliation259?.factionId!==p.factionId||actor.worldAffiliation259.hostFactionId!==null||actor.worldAffiliation259.guestStatus!=='Guest')errors.push('Pending foreign person has an incompatible active holder');
 }
 for(const animal of p.animals){add(animal.id);holders.add(animal.id);if(!validCaravanAnimalRecord256(animal,{context:record.context,tick:root.tick,nextId:root.nextId,version:root.schemaVersion})||animal.state==='dead'||animal.health?.death||p.animalAmbush261&&(animal.domestic||animal.manhunter||animal.health?.scaria261))errors.push('Pending foreign animal is not a living original');}
 for(const item of p.items){
  add(item.id);if(item.innerResource)add(item.innerResource.id);
  errors.push(...validatePileRecordShape(item as unknown as Record<string,unknown>,context,root.schemaVersion,root.tick));
  if(!('pawnId'in item.owner)||!holders.has(item.owner.pawnId)||!['inventory','equipment','apparel'].includes(item.owner.type))errors.push('Pending item has no exclusive actual holder');
 }
 errors.push(...validatePackedFurnitureRecords(p.packed,context,root.schemaVersion,new Set()));
 for(const pack of p.packed){add(pack.building.id);if(pack.owner.type!=='inventory'||!holders.has(pack.owner.pawnId))errors.push('Pending furniture has no actual foreign carrier');}
 if(p.kind==='demand')for(const line of p.demands){
  if(line.kind==='human'){if(!g.members.some(a=>a.id===line.id))errors.push('Demanded human has left this caravan');}
  else if(line.kind==='animal'){if(!g.animalOwners?.members.some(a=>a.id===line.id))errors.push('Demanded animal has left this caravan');}
  else if(line.kind==='pile'){if(!g.items.some(i=>i.id===line.id&&i.quantity>=line.quantity))errors.push('Demanded goods are no longer held');}
  else if(!g.packed?.some(i=>i.building.id===line.id))errors.push('Demanded packed original is absent');
 }
 // The existing accumulator is still registering later campaign owners here.
 // Only acquired couple fields need the complete, actual campaign knowledge.
 if(!errors.length&&p.people.some(hasCoupleFields285))try{
  const known=new Set(captureHumanOwners(context).people.keys());
  for(const actor of p.people)if((hasCoupleFields285(actor)||hasPartyMemoryField292(actor))&&!validCouplePawnContext285(actor,{version:root.schemaVersion,tick:root.tick,nextId:root.nextId,knownHumanIds:known}))errors.push('Invalid pending foreign couple clock or memory.');
 }catch{errors.push('Invalid pending foreign couple namespace.');}
 return errors;
}
