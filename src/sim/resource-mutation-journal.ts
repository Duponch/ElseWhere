import type {Resource,World} from './types.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';

/** Derived bookkeeping for the closed Worker only. Never saved, never a value
 * witness for public mutable callers. Each reader owns its opaque cursor; a
 * missed write, unknown array replacement or bounded history gap requires the
 * complete codec. No cursor exposes the mutable journal or its collections. */
export const RESOURCE_JOURNAL_CAPACITY=8192;
export interface ResourceMembershipEdit {readonly removed:readonly Resource[];readonly appended:readonly Resource[]}
interface Journal {
 source:readonly Resource[];length:number;version:number;membershipVersion:number;fullVersion:number;
 versions:Float64Array;ids:Float64Array;flags:Uint8Array;edits:(ResourceMembershipEdit|undefined)[];
 identities?:{owner:object;byId:Map<number,Resource>};
}
interface Position {journal:Journal;version:number}
const journals=new WeakMap<readonly Resource[],Journal>();
const positions=new WeakMap<ResourceJournalCursor,Position>();
declare const brand:unique symbol;
export interface ResourceJournalCursor {readonly [brand]:true}
export interface ResourceJournalRead {readonly cursor:ResourceJournalCursor;readonly dirtyIds:ReadonlySet<number>;readonly membershipChanged:boolean;readonly membershipEdits:readonly ResourceMembershipEdit[]|undefined}
const cursor=(journal:Journal):ResourceJournalCursor=>{const token=Object.freeze({}) as ResourceJournalCursor;positions.set(token,{journal,version:journal.version});return token;};
function append(journal:Journal,id:number|undefined,membership:boolean,edit?:ResourceMembershipEdit):void {
 if(journal.version===Number.MAX_SAFE_INTEGER){journal.fullVersion=Infinity;return;}
 const version=++journal.version,index=version%RESOURCE_JOURNAL_CAPACITY;
 if(membership)journal.membershipVersion=version;
 // Resident numeric columns avoid allocating an Event for every plant clock
 // write. Float64 preserves the full version/ID number domain; flags keep an
 // absent ID distinct from every numeric value, including NaN and signed zero.
 journal.versions[index]=version;journal.flags[index]=(membership?1:0)|(id===undefined?0:2);
 if(id!==undefined)journal.ids[index]=id;
 journal.edits[index]=edit;
}
/** Mark after committing ANY resource field, including nested life/blight and
 * property deletion. An absent journal makes initial generation free. */
export function markResourceChanged(world:Pick<World,'resources'>,resource:Pick<Resource,'id'>):void {
 const journal=journals.get(world.resources);if(journal)append(journal,resource.id,false);
}
/** Certified remove/append/record-replacement commit. `changed` contains every
 * new/replaced/edited record. Survivors keep their values. Order discovery is
 * still complete; no monotone membership pattern is guessed by this journal. */
export function markResourceArrayChanged(world:Pick<World,'resources'>,before:readonly Resource[],changed:readonly Resource[]=[],removed?:readonly Resource[]):void {
 const journal=journals.get(before);if(!journal)return;
 if(journal.source!==before||journal.length!==before.length){invalidateResourceJournal({resources:before});return;}
 if(before!==world.resources)journals.delete(before);
 journal.source=world.resources;journal.length=world.resources.length;journals.set(world.resources,journal);
 const identities=journal.identities;
 if(identities){
  if(!removed||terrainJournalReadOwner()!==identities.owner)journal.identities=undefined;
  else {
   const byId=identities.byId;let known=true;
   for(const resource of removed){const id=resourceIdentity(resource);if(id===undefined||byId.get(id)!==resource){known=false;break;}byId.delete(id);}
   if(known)for(const resource of changed){const id=resourceIdentity(resource);if(id===undefined||byId.has(id)){known=false;break;}byId.set(id,resource);}
   if(!known||byId.size!==world.resources.length)journal.identities=undefined;
  }
 }
 // An explicit `removed` certifies survivors in order followed by `changed`
 // appended records. Unknown replacements still permit complete membership
 // discovery in the codec, but never incremental simulation membership.
 const edit=removed?Object.freeze({removed:Object.freeze([...removed]),appended:Object.freeze([...changed])}):undefined;
 append(journal,undefined,true,edit);for(const resource of changed)append(journal,resource.id,false);
}
/** Unknown transactions (including speculative rollback/catch paths) cannot
 * certify their internal writes. Call before entry or at their actual commit. */
export function invalidateResourceJournal(world:{readonly resources:readonly Resource[]}):void {
 const journal=journals.get(world.resources);if(journal){append(journal,undefined,true);journal.fullVersion=journal.version;journal.identities=undefined;}
}
function resourceIdentity(resource:unknown):number|undefined {
 try{
  if(!resource||typeof resource!=='object'||Object.getPrototypeOf(resource)!==Object.prototype)return;
  const id=Object.getOwnPropertyDescriptor(resource,'id');return id?.enumerable&&Object.hasOwn(id,'value')&&Number.isSafeInteger(id.value)&&id.value>0?id.value:undefined;
 }catch{return;}
}
/** Closed presentation join, maintained by the actual membership commits
 * above. Field changes deliberately keep the live record: meal coordinates
 * are read now. Missing enrollment, duplicates, accessors, holes and custom
 * arrays refuse this lane; the caller retains its complete historical walk.
 * No public dependency capture calls this function or accepts this resolver. */
export function closedResourceIdentityLookup(resources:readonly Resource[],owner:object):((id:number)=>Resource|undefined)|undefined {
 const journal=journals.get(resources);
 if(!journal||journal.source!==resources||journal.length!==resources.length)return;
 try{if(Object.getPrototypeOf(resources)!==Array.prototype||resources[Symbol.iterator]!==Array.prototype[Symbol.iterator])return;}catch{return;}
 let identities=journal.identities;
 if(!identities||identities.owner!==owner){
  const byId=new Map<number,Resource>();
  for(let i=0;i<resources.length;i++){
   let slot:PropertyDescriptor|undefined;try{slot=Object.getOwnPropertyDescriptor(resources,String(i));}catch{return;}
   if(!slot?.enumerable||!Object.hasOwn(slot,'value'))return;
   const resource=slot.value as Resource,id=resourceIdentity(resource);if(id===undefined||byId.has(id))return;byId.set(id,resource);
  }
  identities={owner,byId};journal.identities=identities;
 }else if(verifyResourceJournal){
  if(identities.byId.size!==resources.length)throw Error('Unmarked resource identity membership write');
  for(const resource of resources)if(identities.byId.get(resource.id)!==resource)throw Error('Unmarked resource identity membership write');
 }
 const byId=identities.byId;return id=>byId.get(id);
}
/** Internal encoder boundary: capture before a complete codec pass; retain
 * only if that pass succeeds. Unknown/replaced arrays start a new history. */
export function captureResourceJournal(resources:readonly Resource[]):ResourceJournalCursor {
 let journal=journals.get(resources);
 if(!journal||journal.source!==resources||journal.length!==resources.length||journal.fullVersion===Infinity){journal={source:resources,length:resources.length,version:0,membershipVersion:0,fullVersion:0,
  versions:new Float64Array(RESOURCE_JOURNAL_CAPACITY),ids:new Float64Array(RESOURCE_JOURNAL_CAPACITY),flags:new Uint8Array(RESOURCE_JOURNAL_CAPACITY),edits:new Array(RESOURCE_JOURNAL_CAPACITY)};journals.set(resources,journal);}
 return cursor(journal);
}
export function readResourceJournal(resources:readonly Resource[],before:ResourceJournalCursor):ResourceJournalRead|undefined {
 const position=positions.get(before),journal=journals.get(resources);
 if(!position||!journal||position.journal!==journal||journal.source!==resources||journal.length!==resources.length||position.version>journal.version||journal.fullVersion>position.version||journal.version-position.version>RESOURCE_JOURNAL_CAPACITY)return;
 const dirtyIds=new Set<number>(),membershipEdits:ResourceMembershipEdit[]=[];let membershipChanged=false,knownMembership=true;
 for(let version=position.version+1;version<=journal.version;version++){
  const index=version%RESOURCE_JOURNAL_CAPACITY;if(journal.versions[index]!==version)return;
  const flags=journal.flags[index]!;
  if(flags&1){membershipChanged=true;const edit=journal.edits[index];if(edit)membershipEdits.push(edit);else knownMembership=false;}
  if(flags&2)dirtyIds.add(journal.ids[index]!);
 }
 return {cursor:cursor(journal),dirtyIds,membershipChanged,membershipEdits:knownMembership?Object.freeze(membershipEdits):undefined};
}
/** Membership-only readers need no field walk and do not consume the codec's
 * cursor. This remains valid even after unrelated field events overflow. */
export function resourceMembershipUnchanged(resources:readonly Resource[],before:ResourceJournalCursor):boolean {
 const position=positions.get(before),journal=journals.get(resources);
 return !!position&&!!journal&&position.journal===journal&&journal.source===resources&&journal.length===resources.length
  &&journal.fullVersion<=position.version&&journal.membershipVersion<=position.version&&position.version<=journal.version;
}
/** Independent exhaustive codec verification, opt-in in replay/tests only. */
export let verifyResourceJournal=false;
export function setResourceJournalVerification(enabled:boolean):void {verifyResourceJournal=enabled;}
