import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import type {Cell} from './types.ts';

interface Source {readonly owner:object;readonly generation:object;readonly identity:object;readonly originalLength:number;dropped:number}
export interface ActorPathSourcePosition297 {readonly identity:object;readonly dropped:number;readonly length:number}
const paths=new WeakMap<readonly unknown[],Source>();
const nativeShift=Array.prototype.shift;
let generation:object={};
/** Only the actual reconstruction exits call this: every point was just
 * constructed as its own {x,z}. It neither freezes nor copies a SIM value. */
export function markActorPathCreated297<T extends Cell[]>(path:T):T {
 const owner=terrainJournalReadOwner();
 if(owner)paths.set(path,{owner,generation,identity:{},originalLength:path.length,dropped:0});else paths.delete(path);
 return path;
}
/** The original native operation/return, plus the real consumed-prefix
 * transition. Unknown/custom operations retire the source witness. */
export function shiftActorPath297<T>(path:T[]):T|undefined {
 const source=paths.get(path),owner=terrainJournalReadOwner(),length=path.length;
 const known=!!source&&source.owner===owner&&source.generation===generation&&source.originalLength-source.dropped===length
  &&Object.getPrototypeOf(path)===Array.prototype&&path.shift===nativeShift;
 if(!known)paths.delete(path);
 let value:T|undefined;
 try{value=path.shift();}catch(error){paths.delete(path);throw error;}
 if(known){if(length>0&&path.length===length-1)source!.dropped++;else if(length!==path.length)paths.delete(path);}
 return value;
}
export function invalidateActorPathSources297():void {generation={};}
/** An owned origin and a monotone consumed prefix, never a value predicate. */
export function actorPathSourcePosition297(path:unknown,owner:object):ActorPathSourcePosition297|undefined {
 if(!Array.isArray(path))return;
 const source=paths.get(path);
 if(source?.owner!==owner||source.generation!==generation||source.originalLength-source.dropped!==path.length)return;
 return {identity:source.identity,dropped:source.dropped,length:path.length};
}
