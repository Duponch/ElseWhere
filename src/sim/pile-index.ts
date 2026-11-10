import {APPAREL} from './apparel-definitions.ts';
import type {ApparelItem} from './apparel-definitions.ts';
import type {MaterialPile,World} from './types.ts';

/* Pile index (chantier 4, 10–11 November 2026).
 *
 * Many systems scanned every pile (about 1 800 on Les Forges) for the piles of
 * one cell or one wearer, on every step of every actor. This index answers
 * those questions from per-cell and per-wearer tables, inside a simulation
 * step only (withPileIndexScope, opened by the engine's step entry points).
 *
 * Contract, inside a scope:
 *  - a pile's `owner` object is never edited in place: a move assigns a new
 *    owner object, through assignPileOwner (which also marks the write);
 *  - any other in-place write to what the index reads (a pile's `kind` or
 *    `item`, an element replaced by index) calls markPileWrite;
 *  - push/splice change the array length or its first or last element.
 * Outside a scope every reader scans, as before. At the start of each
 * outermost scope, and after any marked write, an index is first checked
 * against the piles, owners, kinds and items it was built from (identity);
 * so writes made between steps (tests, loaders, commands) need no mark.
 * setPileIndexVerification(true) makes every indexed answer recompute the
 * scan and throw on a difference, which exposes an unmarked write. */

let epoch=0,scopeDepth=0,generation=0;
/** Marks an in-place write to a pile's owner, kind or item, or to the array. */
export function markPileWrite():void {epoch++;}
/** `target.owner = owner`, then markPileWrite; returns `owner` like the assignment. */
export function assignPileOwner<T extends {owner:unknown}>(target:T,owner:T['owner']):T['owner'] {target.owner=owner;epoch++;return owner;}
/** Runs `step` with pile indexes available; nested scopes share the outermost one. */
export function withPileIndexScope<R>(step:()=>R):R {
  if(scopeDepth===0)generation++;
  scopeDepth++;
  try{return step();}finally{scopeDepth--;}
}
export let verifyPileIndex=false;
export function setPileIndexVerification(on:boolean):void {verifyPileIndex=on;}
export const PILE_CHUNK=1,PILE_MATERIAL_FLOOR=2;
/** The ground piles that slow travel as a material floor, by schema (furniture-travel). */
export const materialFloorPile=(version:number,kind:string):boolean=>version>=29&&kind==='steel'||version>=32&&kind==='blocks'||version>=41&&kind==='component'||version>=123&&(kind==='gold'||kind==='plasteel'||kind==='advanced-component');

export interface PileIndex {
  readonly width:number;readonly height:number;readonly version:number;
  /** Ground piles of each in-map cell, in array order. */
  readonly groundAt:ReadonlyMap<number,readonly MaterialPile[]>;
  /** PILE_CHUNK / PILE_MATERIAL_FLOOR of the in-map ground piles of each cell. */
  readonly groundFacts:Uint8Array;
  /** Every ground chunk pile (any position), in array order. */
  readonly groundChunks:readonly MaterialPile[];
  /** Every ground material-floor pile (any position), in array order. */
  readonly groundMaterialFloors:readonly MaterialPile[];
  /** Sum of worn apparel move offsets per integer wearer id, added in array order from 0. */
  readonly wornOffsets:ReadonlyMap<number,number>;
  /** Wearers with an apparel pile whose item has no apparel definition: readers scan (and throw as before). */
  readonly undefinedWorn:ReadonlySet<number>;
  /** First equipment pile per integer pawn id, in array order. */
  readonly equipment:ReadonlyMap<number,MaterialPile>;
}
interface Entry extends PileIndex {
  generation:number;epoch:number;length:number;first:MaterialPile|undefined;last:MaterialPile|undefined;
  readonly piles:MaterialPile[];readonly owners:MaterialPile['owner'][];readonly kinds:MaterialPile['kind'][];readonly items:MaterialPile['item'][];
}
const entries=new WeakMap<readonly MaterialPile[],Entry>();
const inMap=(x:number,z:number,width:number,height:number)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<width&&z<height;
function unchanged(piles:readonly MaterialPile[],e:Entry):boolean {
  const n=piles.length;if(n!==e.piles.length)return false;
  for(let i=0;i<n;i++){const p=piles[i]!;if(p!==e.piles[i]||p.owner!==e.owners[i]||p.kind!==e.kinds[i]||p.item!==e.items[i])return false;}
  return true;
}
function build(world:World):Entry {
  const piles=world.piles,width=world.width,height=world.height,version=world.schemaVersion;
  const groundAt=new Map<number,MaterialPile[]>(),groundFacts=new Uint8Array(width*height),groundChunks:MaterialPile[]=[],groundMaterialFloors:MaterialPile[]=[];
  const wornOffsets=new Map<number,number>(),undefinedWorn=new Set<number>(),equipment=new Map<number,MaterialPile>();
  for(const p of piles){
    const owner=p.owner;
    if(owner.type==='ground'){
      const chunk=version>=28&&p.kind==='chunk',floor=materialFloorPile(version,p.kind);
      if(chunk)groundChunks.push(p);
      if(floor)groundMaterialFloors.push(p);
      if(inMap(owner.x,owner.z,width,height)){
        const i=owner.z*width+owner.x,list=groundAt.get(i);if(list)list.push(p);else groundAt.set(i,[p]);
        groundFacts[i]=groundFacts[i]!|(chunk?PILE_CHUNK:0)|(floor?PILE_MATERIAL_FLOOR:0);
      }
    }else if(owner.type==='apparel'){
      if(Number.isInteger(owner.pawnId)){
        const definition=Object.hasOwn(APPAREL,p.item)?APPAREL[p.item as ApparelItem]:undefined;
        if(definition)wornOffsets.set(owner.pawnId,(wornOffsets.get(owner.pawnId)??0)+definition.moveOffset);else undefinedWorn.add(owner.pawnId);
      }
    }else if(owner.type==='equipment'){
      if(Number.isInteger(owner.pawnId)&&!equipment.has(owner.pawnId))equipment.set(owner.pawnId,p);
    }
  }
  return {width,height,version,groundAt,groundFacts,groundChunks,groundMaterialFloors,wornOffsets,undefinedWorn,equipment,
    generation,epoch,length:piles.length,first:piles[0],last:piles[piles.length-1],
    piles:piles.slice(),owners:piles.map(p=>p.owner),kinds:piles.map(p=>p.kind),items:piles.map(p=>p.item)};
}
/** The index of `world`'s piles, or undefined outside a simulation step. */
export function pileIndex(world:World):PileIndex|undefined {
  if(!scopeDepth)return undefined;
  const piles=world.piles,n=piles.length;let e=entries.get(piles);
  if(e&&e.width===world.width&&e.height===world.height&&e.version===world.schemaVersion){
    if(e.generation===generation&&e.epoch===epoch&&e.length===n&&e.first===piles[0]&&e.last===piles[n-1])return e;
    if(unchanged(piles,e)){e.generation=generation;e.epoch=epoch;e.length=n;e.first=piles[0];e.last=piles[n-1];return e;}
  }
  e=build(world);entries.set(piles,e);return e;
}
/** Throws when an indexed answer differs from the scan (verification mode). */
export function pileIndexMismatch(what:string):never {throw Error(`Unmarked pile write: ${what} differs from the scan`);}
