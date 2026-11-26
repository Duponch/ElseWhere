import type {MaterialPile} from './types.ts';
import {invalidateOrdinaryPileSources379} from './ordinary-pile-source-379.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyPileIndex} from './pile-index.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

/** Private identity membership bookkeeping, independent of spatial/owner
 * indexes. Every in-place membership edit marks its actual array, including
 * same-length splice/replacement transactions. Replacing the array starts a
 * fresh directory. A mark before an operation that throws is conservative. */
const revisions=new WeakMap<readonly unknown[],number>();
let unknownRevision=0;
const PILE_MEMBERSHIP_LOG_SIZE=2048;
/** Only absence of the unordered marker proves survivors followed by newly
 * appended rows. A middle splice is still an exact membership edge for
 * phases, but the ordered Full codec must re-discover source order. */
export interface PileMembershipEdit379 {readonly removed:readonly MaterialPile[];readonly appended:readonly MaterialPile[];readonly unordered?:true}
interface MembershipLog {readonly owner:object;readonly unknownRevision:number;source:readonly MaterialPile[];length:number;version:number;readonly edits:(PileMembershipEdit379|undefined)[]}
const membershipLogs=new WeakMap<readonly unknown[],MembershipLog>();
declare const membershipCursorBrand:unique symbol;
export interface PileMembershipCursor379 {readonly [membershipCursorBrand]:true}
const membershipPositions=new WeakMap<PileMembershipCursor379,{readonly log:MembershipLog;readonly version:number}>();
function membershipPosition(log:MembershipLog):PileMembershipCursor379 {
 const cursor={} as PileMembershipCursor379;membershipPositions.set(cursor,{log,version:log.version});return cursor;
}
function ordinaryPileArray(piles:object):boolean {
 try{return Object.getPrototypeOf(piles)===Array.prototype&&piles.constructor===Array&&Array[Symbol.species]===Array;}catch{return false;}
}
/** Enrolled only at the successful fixed producer's complete pile capture. A
 * collection may transfer its lineage through a native filter; every other
 * replacement or unknown mutation forces an ordinary reconstruction. */
export function capturePileMembershipCursor379(piles:readonly MaterialPile[],owner:object):PileMembershipCursor379|undefined {
 if(!ordinaryPileArray(piles))return;
 let log=membershipLogs.get(piles);
 if(!log||log.owner!==owner||log.source!==piles||log.length!==piles.length||log.unknownRevision!==unknownRevision||log.version===Number.MAX_SAFE_INTEGER){
  log={owner,unknownRevision,source:piles,length:piles.length,version:0,edits:new Array(PILE_MEMBERSHIP_LOG_SIZE)};membershipLogs.set(piles,log);
 }
 return membershipPosition(log);
}
export function readPileMembershipCursor379(piles:readonly MaterialPile[],owner:object,before:PileMembershipCursor379):{readonly cursor:PileMembershipCursor379;readonly edits:readonly PileMembershipEdit379[]}|undefined {
 const position=membershipPositions.get(before),log=membershipLogs.get(piles);
 if(!position||!log||position.log!==log||log.owner!==owner||log.source!==piles||log.unknownRevision!==unknownRevision||log.length!==piles.length||log.version<position.version||log.version-position.version>PILE_MEMBERSHIP_LOG_SIZE)return;
 const edits:PileMembershipEdit379[]=[];for(let version=position.version+1;version<=log.version;version++){const edit=log.edits[version%PILE_MEMBERSHIP_LOG_SIZE];if(!edit)return;edits.push(edit);}
 return {cursor:membershipPosition(log),edits};
}
function writableMembershipLog(piles:readonly unknown[]):MembershipLog|undefined {
 const log=membershipLogs.get(piles);if(!log)return;
 if(log.owner!==terrainJournalReadOwner()||log.source!==piles||log.length!==piles.length||log.unknownRevision!==unknownRevision||!ordinaryPileArray(piles)){membershipLogs.delete(piles);return;}
 return log;
}
function recordMembership(log:MembershipLog,piles:readonly unknown[],removed:readonly unknown[],appended:readonly unknown[],unordered=false):void {
 if(log.version===Number.MAX_SAFE_INTEGER||log.length+appended.length-removed.length!==piles.length){membershipLogs.delete(piles);return;}
 log.source=piles as readonly MaterialPile[];log.length=piles.length;
 if(removed.length||appended.length)log.edits[++log.version%PILE_MEMBERSHIP_LOG_SIZE]={removed:removed as readonly MaterialPile[],appended:appended as readonly MaterialPile[],...unordered?{unordered:true}:{}};
 membershipLogs.set(piles,log);
}
function bumpMembershipRevision<T extends readonly unknown[]>(piles:T):T {
 revisions.set(piles,(revisions.get(piles)??0)+1);return piles;
}
/** Existing generic pile writes cannot attest which array changed. */
export function markPileIdentityUnknownWrite():void {unknownRevision++;invalidateOrdinaryPileSources379();}
export function markPileMembershipChanged<T extends readonly unknown[]>(piles:T):T {
 membershipLogs.delete(piles);return bumpMembershipRevision(piles);
}
interface Directory {owner:object;revision:number;unknownRevision:number;refs?:MaterialPile[];ids?:number[];byId:Map<unknown,MaterialPile>;repeated:Set<unknown>}
const directories=new WeakMap<readonly MaterialPile[],Directory>();
const checking=()=>verifyPileIndex||verifyTerrainWriteCaches;
function capture(piles:readonly MaterialPile[],owner:object,revision:number):Directory {
 const byId=new Map<unknown,MaterialPile>(),repeated=new Set<unknown>();
 for(const pile of piles){if(byId.has(pile.id))repeated.add(pile.id);else byId.set(pile.id,pile);}
 return {owner,revision,unknownRevision,...checking()?{refs:piles.slice(),ids:piles.map(p=>p.id)}:{},byId,repeated};
}
function verify(piles:readonly MaterialPile[],directory:Directory):void {
 if(piles.length!==directory.refs!.length||piles.some((pile,i)=>pile!==directory.refs![i]||pile.id!==directory.ids![i]&&!(Number.isNaN(pile.id)&&Number.isNaN(directory.ids![i]))))
  throw Error('Unmarked pile identity membership write');
}
function admitted<T>(piles:T[]):Directory|undefined {
 const source=piles as unknown as MaterialPile[],directory=directories.get(source),owner=terrainJournalReadOwner();
 if(!directory||!owner||directory.owner!==owner||directory.revision!==(revisions.get(piles)??0)||directory.unknownRevision!==unknownRevision||checking()&&!directory.refs)return;
 if(checking())verify(source,directory);return directory;
}
/** Native append, followed by updates only for the appended identities. */
export function appendPileEntries<T>(piles:T[],...items:T[]):number {
 const directory=admitted(piles),journal=writableMembershipLog(piles);bumpMembershipRevision(piles);
 const native=journal&&piles.push===Array.prototype.push;
 if(journal)membershipLogs.delete(piles);
 const length=piles.push(...items);
 if(journal&&native)recordMembership(journal,piles,[],items);
 if(directory){
  for(const item of items as unknown as MaterialPile[]){if(directory.byId.has(item.id))directory.repeated.add(item.id);else directory.byId.set(item.id,item);}
  if(checking()){directory.refs!.push(...items as unknown as MaterialPile[]);directory.ids!.push(...(items as unknown as MaterialPile[]).map(p=>p.id));}else{delete directory.refs;delete directory.ids;}
  directory.revision=revisions.get(piles)!;
 }
 return length;
}
/** Native argument count and normalization (negative indices, omitted versus
 * undefined deleteCount) are retained. Ordinary unique-id edits touch only the
 * removed/inserted IDs. A duplicate ID reselects its first original occurrence. */
export function splicePileEntries<T>(piles:T[],...args:[start:number,deleteCount?:number,...items:T[]]):T[] {
 const directory=admitted(piles),journal=writableMembershipLog(piles);bumpMembershipRevision(piles);
 const native=journal&&piles.splice===Array.prototype.splice;
 const before=piles.length;
 if(journal)membershipLogs.delete(piles);
 const removed=piles.splice(...args as [number,number,...T[]]);
 if(journal&&native){
  const inserted=args.slice(2),start=typeof args[0]==='number'&&!Number.isNaN(args[0])?Math.trunc(args[0]):NaN;
  const index=start<0?Math.max(before+start,0):Math.min(start,before);
  recordMembership(journal,piles,removed.slice(),inserted,inserted.length>0&&index!==before-removed.length);
 }
 if(directory){
  const inserted=args.slice(2) as unknown as MaterialPile[],rescan=new Set<unknown>();
  for(const item of removed as unknown as MaterialPile[]){if(directory.repeated.has(item.id))rescan.add(item.id);else directory.byId.delete(item.id);}
  for(const item of inserted){if(directory.repeated.has(item.id)||directory.byId.has(item.id)){directory.repeated.add(item.id);rescan.add(item.id);}else directory.byId.set(item.id,item);}
  for(const id of rescan){const first=(piles as unknown as MaterialPile[]).find(p=>p.id===id);if(first)directory.byId.set(id,first);else {directory.byId.delete(id);directory.repeated.delete(id);}}
  if(checking()){
   directory.refs!.splice(...args as unknown as [number,number,...MaterialPile[]]);
   const idArgs=args.length===1?[args[0]]:[args[0],args[1],...inserted.map(p=>p.id)];directory.ids!.splice(...idArgs as [number,number,...number[]]);
  }else{delete directory.refs;delete directory.ids;}
  directory.revision=revisions.get(piles)!;
 }
 return removed;
}
const nativePileFilter=Array.prototype.filter;
/** Native filter for the explicitly read-only producer predicates. Its one
 * predicate pass records removals, then transfers the admitted directory to
 * the new array. The old alias loses its witness and rebuilds if read again.
 * Unknown methods, species, owner changes and mutations keep the cold path. */
export function filterPileEntries<T>(piles:T[],predicate:(value:T,index:number,array:T[])=>unknown,thisArg?:unknown):T[] {
 const source=piles as unknown as MaterialPile[],directory=admitted(piles),journal=writableMembershipLog(piles);
 if(!directory&&!journal||Object.getPrototypeOf(piles)!==Array.prototype||piles.filter!==nativePileFilter||piles.constructor!==Array||Array[Symbol.species]!==Array){
  directories.delete(source);membershipLogs.delete(source);return arguments.length<3?piles.filter(predicate):piles.filter(predicate,thisArg);
 }
 const revision=revisions.get(piles)??0,beforeUnknown=unknownRevision,owner=directory?.owner??journal!.owner,removed:MaterialPile[]=[];
 const next=piles.filter((value,index,array)=>{const keep=predicate.call(thisArg,value,index,array);if(!keep)removed.push(value as unknown as MaterialPile);return keep;});
 const result=next as unknown as MaterialPile[];
 if(directory&&directories.get(source)!==directory||journal&&membershipLogs.get(source)!==journal||terrainJournalReadOwner()!==owner||(revisions.get(piles)??0)!==revision||unknownRevision!==beforeUnknown
  ||next===piles||Object.getPrototypeOf(next)!==Array.prototype||piles.length!==next.length+removed.length){directories.delete(source);membershipLogs.delete(source);return next;}
 if(journal){membershipLogs.delete(source);recordMembership(journal,result,removed,[]);}
 if(!directory)return next;
 if(checking())verify(source,directory);
 directories.delete(source);
 const rescan=new Set<unknown>();
 for(const item of removed){if(directory.repeated.has(item.id))rescan.add(item.id);else directory.byId.delete(item.id);}
 for(const id of rescan){const first=result.find(p=>p.id===id);if(first)directory.byId.set(id,first);else{directory.byId.delete(id);directory.repeated.delete(id);}}
 if(checking()){directory.refs=result.slice();directory.ids=result.map(p=>p.id);}else{delete directory.refs;delete directory.ids;}
 directory.revision=revisions.get(result)??0;directories.set(result,directory);return next;
}
/** Exactly `world.piles.find(p=>p.id===id)`. Only the exclusive deserialized
 * SIM owner reuses a directory; public and ordinary scoped callers scan and
 * retire any prior owner witness. NaN never matches strict equality, and the
 * first duplicate wins just as it does in Array.find. Pile ids are immutable
 * throughout simulation; changing one is a membership write too. */
export function pileById(world:{readonly piles:readonly MaterialPile[]},id:unknown):MaterialPile|undefined {
 const piles=world.piles,owner=terrainJournalReadOwner();
 if(!owner){directories.delete(piles);return piles.find(pile=>pile.id===id);}
 const revision=revisions.get(piles)??0;
 let directory=directories.get(piles);
 if(!directory||directory.owner!==owner||directory.revision!==revision||directory.unknownRevision!==unknownRevision||checking()&&!directory.refs){directory=capture(piles,owner,revision);directories.set(piles,directory);}
 else if(checking())verify(piles,directory);
 return typeof id==='number'&&Number.isNaN(id)?undefined:directory.byId.get(id);
}

// Exact observational addition already made by the publication owner.
export function pileMembershipCursorCurrent379(piles:readonly MaterialPile[],owner:object,before:PileMembershipCursor379):boolean {
 const position=membershipPositions.get(before),log=membershipLogs.get(piles);
 return !!position&&!!log&&position.log===log&&log.owner===owner&&log.source===piles&&log.unknownRevision===unknownRevision&&log.length===piles.length&&log.version===position.version;
}
