import type {World} from './types.ts';

/* A bounded scope in which no pile of one World changes: the Core movement
 * pass (core-movement-297), which closes it after the pass and calls
 * dropPileFacts after any drafted pawn's turn, the only part of that pass
 * that may drop, take or wear an item. Facts derived from the piles inside
 * the scope (ground pile cells, worn apparel offsets) are kept until then.
 * A replaced or resized piles array drops them as well. */
interface PileScope {world:World;source:World['piles'];length:number;generation:number}
let scope:PileScope|undefined,generations=0;
export function beginPileScope(world:World):void {scope={world,source:world.piles,length:world.piles.length,generation:++generations};}
export function dropPileFacts():void {if(scope)scope.generation=++generations;}
export function endPileScope():void {scope=undefined;}
/** The current facts generation of `world`'s open scope, or undefined outside one. */
export function pileScopeGeneration(world:World):number|undefined {
 const s=scope;if(!s||s.world!==world)return undefined;
 if(s.source!==world.piles||s.length!==world.piles.length){s.source=world.piles;s.length=world.piles.length;s.generation=++generations;}
 return s.generation;
}
