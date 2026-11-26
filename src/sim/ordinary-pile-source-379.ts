import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import type {MaterialPile} from './types.ts';

interface Source {readonly owner:object;readonly generation:object;version:object;dirtyShape:boolean}
const sources=new WeakMap<object,Source>();
let generation:object={};
const ordinaryKeys=new Set(['id','kind','item','quantity','owner','rot','foodPoison','damage','forbidden','haulRequested']);
// The presentation codec needs a *directory of writers*, not just a cheap
// equality predicate for every pile. Every enrolled non-rot write appends the
// real receiver. Independent readers keep opaque cursors in this bounded log;
// unknown transactions retire the generation rather than certify any gaps.
const PILE_CONTENT_LOG_SIZE=8192;
interface ContentLog {readonly generation:object;version:number;readonly rows:(object|undefined)[]}
const contentLogs=new WeakMap<object,ContentLog>();
declare const contentCursorBrand:unique symbol;
export interface PileContentCursor379 {readonly [contentCursorBrand]:true}
const contentPositions=new WeakMap<PileContentCursor379,{readonly log:ContentLog;readonly version:number}>();
function contentPosition(log:ContentLog):PileContentCursor379 {
 const cursor={} as PileContentCursor379;contentPositions.set(cursor,{log,version:log.version});return cursor;
}
export function capturePileContentCursor379(owner:object):PileContentCursor379 {
 let log=contentLogs.get(owner);
 if(!log||log.generation!==generation||log.version===Number.MAX_SAFE_INTEGER){log={generation,version:0,rows:new Array(PILE_CONTENT_LOG_SIZE)};contentLogs.set(owner,log);}
 return contentPosition(log);
}
export function readPileContentCursor379(owner:object,before:PileContentCursor379):{readonly cursor:PileContentCursor379;readonly writes:ReadonlySet<object>}|undefined {
 const position=contentPositions.get(before),log=contentLogs.get(owner);
 if(!position||!log||position.log!==log||log.generation!==generation||log.version<position.version||log.version-position.version>PILE_CONTENT_LOG_SIZE)return;
 const writes=new Set<object>();for(let version=position.version+1;version<=log.version;version++){const row=log.rows[version%PILE_CONTENT_LOG_SIZE];if(!row)return;writes.add(row);}
 return {cursor:contentPosition(log),writes};
}
function recordPileContentWrite(owner:object,target:object):void {
 const log=contentLogs.get(owner);if(!log||log.generation!==generation)return;
 if(log.version===Number.MAX_SAFE_INTEGER){contentLogs.delete(owner);return;}
 log.rows[++log.version%PILE_CONTENT_LOG_SIZE]=target;
}
/** Successful fixed publication seeding only. Complex item components stay
 * exhaustive; this lane certifies ordinary commodity records and their real
 * writer hooks, not a mutable public World/array claim. */
export function captureOrdinaryPileSource379(pile:MaterialPile,owner:object):object|undefined {
 const before=sources.get(pile);if(before?.owner===owner&&before.generation===generation&&!before.dirtyShape)return before.version;
 try{
  if(Object.getPrototypeOf(pile)!==Object.prototype)return;
  for(const key of Reflect.ownKeys(pile)){
   if(typeof key!=='string'||!ordinaryKeys.has(key)){sources.delete(pile);return;}
   const d=Object.getOwnPropertyDescriptor(pile,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return;
  }
  for(const key of ['id','kind','item','quantity','owner'])if(!Object.hasOwn(pile,key))return;
 }catch{return;}
 const version=before?.owner===owner&&before.generation===generation?before.version:{};
 sources.set(pile,{owner,generation,version,dirtyShape:false});return version;
}
export function ordinaryPileSourceVersion379(pile:MaterialPile,owner:object):object|undefined {
 const source=sources.get(pile);return source?.owner===owner&&source.generation===generation?source.version:undefined;
}
/** Before an actual non-rot field write. Return the identical receiver so
 * assignment/update evaluation order and postfix results remain native. */
export function markPileContentWrite379<T extends object>(target:T):T {
 const source=sources.get(target);if(!source)return target;
 recordPileContentWrite(source.owner,target);
 const owner=terrainJournalReadOwner();
 if(source.owner===owner&&source.generation===generation){source.version={};source.dirtyShape=true;}else sources.delete(target);
 return target;
}
/** Unknown transactions and kind/item/record writes retire every witness. */
export function invalidateOrdinaryPileSources379():void {generation={};}
