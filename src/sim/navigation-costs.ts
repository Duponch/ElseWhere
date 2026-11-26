import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';

/** Immutable cost capture for one synchronous navigation decision. The terrain
 * byte array and sparse overlays are owned by the capture, never cached. */
export interface NavigationCostLookup {
  get(index:number):number|undefined;
  has(index:number):boolean;
  readonly maximum:number;
}

export const EMPTY_NAVIGATION_COSTS:NavigationCostLookup=Object.freeze({get:()=>undefined,has:()=>false,maximum:0});

interface CostPage {readonly values:Float64Array;readonly states:Uint8Array}
interface CostOperation {readonly factor:number;readonly round:boolean}
interface CostOwnership {owner:object|undefined}
const NO_TERRAIN=new Uint8Array(),NO_SPARSE:ReadonlyMap<number,number>=new Map();
export interface SearchNavigationCostColumns {readonly pages:readonly (CostPage|undefined)[];read(index:number):number|undefined}
/** One producer-owned program for terrain/object maxima, then ordered additive
 * layers and normalization. Values remain doubles; no reassociation of sums or
 * multiplication is allowed. Public/unowned reads execute the live program.
 * An exclusively owned synchronous decision can retain computed cells in
 * sparse pages instead of traversing the same program for every incoming edge. */
class CapturedNavigationCosts implements NavigationCostLookup {
  readonly pages:(CostPage|undefined)[];
  readonly maximum:number;
  constructor(readonly terrain:Uint8Array|Uint16Array,readonly sparse:ReadonlyMap<number,number>,readonly additions:readonly ReadonlyMap<number,number>[],readonly operations:readonly CostOperation[],maximum:number,readonly ownership:CostOwnership,readonly includeBase:boolean,readonly size=terrain.length,readonly source?:NavigationCostLookup){
    this.maximum=maximum;this.pages=[];
  }
  private raw(index:number):number|undefined {
    if(this.source){let value=this.source.get(index);if(value!==undefined)for(const operation of this.operations){value=value*operation.factor;if(operation.round)value=Math.round(value);}return value;}
    const floor=this.terrain[index]||undefined,extra=this.includeBase?this.sparse.get(index):undefined;
    let value=this.includeBase?(extra===undefined?floor:Math.max(extra,floor??0)):undefined;
    for(const addition of this.additions){const added=addition.get(index);if(value!==undefined||added!==undefined)value=(value??0)+(added??0);}
    if(value!==undefined)for(const operation of this.operations){value=value*operation.factor;if(operation.round)value=Math.round(value);}
    return value;
  }
  get(index:number):number|undefined {
    if(!this.owned()||!Number.isInteger(index)||index<0||index>=this.size)return this.raw(index);
    return this.read(index);
  }
  /** Search-only integer/in-range read after its source owner was admitted. */
  read(index:number):number|undefined {
    const p=index>>>8,o=index&255,page=this.pages[p]??=({values:new Float64Array(256),states:new Uint8Array(256)}),state=page.states[o];
    if(state){const value=state===2?page.values[o]:undefined;if(verifyTerrainWriteCaches&&!Object.is(value,this.raw(index)))throw Error('Navigation cost capture changed during its owned search');return value;}
    const value=this.raw(index);page.states[o]=value===undefined?1:2;if(value!==undefined)page.values[o]=value;return value;
  }
  has(index:number):boolean {
    if(this.owned()&&Number.isInteger(index)&&index>=0&&index<this.size){const state=this.pages[index>>>8]?.states[index&255];if(state){if(verifyTerrainWriteCaches)this.read(index);return state===2;}}
    if(this.source)return this.source.has(index);
    if(this.includeBase&&(!!this.terrain[index]||this.sparse.has(index)))return true;
    for(const addition of this.additions)if(addition.has(index))return true;return false;
  }
  transformed(factor:number,round:boolean):CapturedNavigationCosts {
    this.owned();
    return new CapturedNavigationCosts(this.terrain,this.sparse,this.additions,[...this.operations,{factor,round}],round?Math.round(this.maximum*factor):this.maximum*factor,this.ownership,this.includeBase,this.size,this.source);
  }
  owned():boolean {
    const owner=this.ownership.owner;if(owner===undefined)return false;
    if(owner===terrainJournalReadOwner())return true;
    // A public observation retires every transformed sibling's witness.
    this.ownership.owner=undefined;return false;
  }
}

/** Admission is repeated when a resumable search advances, never by a tick or
 * guessed revision. Unknown programs and public callers use their live API. */
export function searchNavigationCostColumns(costs:NavigationCostLookup|undefined):SearchNavigationCostColumns|undefined {
  return costs instanceof CapturedNavigationCosts&&costs.owned()?costs:undefined;
}

/** A true cost producer has already captured every mutable fact in `source`.
 * Give that immutable program the same owned integer-cell pages as the fused
 * terrain program. Unknown public lookups remain live; callers must not use
 * this admission for a source whose get() can change during the decision. */
export function captureNavigationCostProgram379(source:NavigationCostLookup|undefined,size:number):NavigationCostLookup|undefined {
  const owner=terrainJournalReadOwner();if(!source||!owner)return source;
  if(source instanceof CapturedNavigationCosts&&source.size===size&&source.owned())return source;
  return new CapturedNavigationCosts(NO_TERRAIN,NO_SPARSE,[],[],source.maximum,{owner},false,size,source);
}

/** Same lookup as overlayNavigationCosts followed by addFireNavigationCosts
 * for each nonempty additive map, in order. A single capture owns the program
 * and its optional memo pages; it introduces no persistent World state. */
export function captureNavigationCostLayers(terrain:Uint8Array|Uint16Array,terrainMaximum:number,sparse:ReadonlyMap<number,number>,additions:readonly ReadonlyMap<number,number>[],includeBase=true):NavigationCostLookup|undefined {
  const layers=additions.filter(layer=>layer.size>0);if(!includeBase&&!layers.length)return;
  let maximum=includeBase?terrainMaximum:0;
  if(includeBase){if(sparse instanceof LayeredMap){if(sparse.size)maximum=Math.max(maximum,sparse.maximumValue());}else for(const value of sparse.values())maximum=Math.max(maximum,value);}
  for(const layer of layers){let added=0;for(const value of layer.values())added=Math.max(added,value);maximum+=added;}
  return new CapturedNavigationCosts(terrain,sparse,layers,[],maximum,{owner:terrainJournalReadOwner()},includeBase);
}

/** Preserve each original transform's rounding and evaluation order while
 * attaching it to an owned program instead of nesting another get closure. */
export function transformNavigationCosts(costs:NavigationCostLookup|undefined,factor:number,round=false):NavigationCostLookup|undefined {
  if(!costs)return;
  if(costs instanceof CapturedNavigationCosts)return costs.transformed(factor,round);
  return {get(index){const value=costs.get(index);return value===undefined?undefined:round?Math.round(value*factor):value*factor;},has:index=>costs.has(index),maximum:round?Math.round(costs.maximum*factor):costs.maximum*factor};
}

const NO_KEYS:ReadonlySet<number>=new Set();
/** A set read as a copy of `base` then edited (add/delete), without copying
 * base, which is never written: the same members and size, and iteration in
 * the order of such a copy (a deleted base member added again comes last). */
export class LayeredSet implements ReadonlySet<number> {
  private added?:Set<number>;
  private removed?:Set<number>;
  constructor(private readonly base:ReadonlySet<number>=NO_KEYS) {}
  has(value:number):boolean {return !!this.added?.has(value)||this.base.has(value)&&!this.removed?.has(value);}
  add(value:number):this {
    if(this.added?.has(value)||this.base.has(value)&&!this.removed?.has(value))return this;
    (this.added??=new Set()).add(value);return this;
  }
  delete(value:number):boolean {
    if(this.added?.delete(value))return true;
    if(this.base.has(value)&&!this.removed?.has(value)){(this.removed??=new Set()).add(value);return true;}
    return false;
  }
  get size():number {return this.base.size-(this.removed?.size??0)+(this.added?.size??0);}
  *values():SetIterator<number> {for(const value of this.base)if(!this.removed?.has(value))yield value;if(this.added)yield* this.added;}
  keys():SetIterator<number> {return this.values();}
  *entries():SetIterator<[number,number]> {for(const value of this.values())yield [value,value];}
  [Symbol.iterator]():SetIterator<number> {return this.values();}
  forEach(callback:(value:number,key:number,set:ReadonlySet<number>)=>void,thisArg?:unknown):void {for(const value of this.values())callback.call(thisArg,value,value,this);}
}
/** A map read as a copy of `base` then written (set only), without copying
 * base: the same entries and size, iteration in the order of such a copy.
 * maximumValue() is the largest value, from base's cached maximum while no
 * write lowered a base value. */
export class LayeredMap implements ReadonlyMap<number,number> {
  private written?:Map<number,number>;
  private writtenMaximum=-Infinity;
  private lowered=false;
  constructor(private readonly base:ReadonlyMap<number,number>,private readonly baseMaximum:number) {}
  // A written value is a number, never undefined.
  get(key:number):number|undefined {const written=this.written;if(written!==undefined){const value=written.get(key);if(value!==undefined)return value;}return this.base.get(key);}
  has(key:number):boolean {return !!this.written?.has(key)||this.base.has(key);}
  set(key:number,value:number):this {
    const old=this.base.get(key);if(old!==undefined&&value<old)this.lowered=true;
    (this.written??=new Map()).set(key,value);if(value>this.writtenMaximum)this.writtenMaximum=value;return this;
  }
  get size():number {let size=this.base.size;if(this.written)for(const key of this.written.keys())if(!this.base.has(key))size++;return size;}
  *entries():MapIterator<[number,number]> {
    for(const [key,value] of this.base){const written=this.written;yield written?.has(key)?[key,written.get(key)!]:[key,value];}
    if(this.written)for(const entry of this.written)if(!this.base.has(entry[0]))yield entry;
  }
  *keys():MapIterator<number> {for(const [key] of this.entries())yield key;}
  *values():MapIterator<number> {for(const [,value] of this.entries())yield value;}
  [Symbol.iterator]():MapIterator<[number,number]> {return this.entries();}
  forEach(callback:(value:number,key:number,map:ReadonlyMap<number,number>)=>void,thisArg?:unknown):void {for(const [key,value] of this.entries())callback.call(thisArg,value,key,this);}
  maximumValue():number {
    if(this.lowered){let maximum=-Infinity;for(const value of this.values())if(value>maximum)maximum=value;return maximum;}
    return Math.max(this.base.size?this.baseMaximum:-Infinity,this.writtenMaximum);
  }
}

/** Sparse objects can raise a terrain cost, including a present zero-cost door.
 * The dense layer is shared by total and non-repeatable floor costs. */
export function overlayNavigationCosts(terrain:Uint8Array|Uint16Array,terrainMaximum:number,sparse:ReadonlyMap<number,number>):NavigationCostLookup {
  let maximum=terrainMaximum;
  if(sparse instanceof LayeredMap){if(sparse.size)maximum=Math.max(maximum,sparse.maximumValue());}
  else for(const cost of sparse.values())maximum=Math.max(maximum,cost);
  return {
    get(index){const floor=terrain[index]||undefined,extra=sparse.get(index);return extra===undefined?floor:Math.max(extra,floor??0);},
    has:index=>!!terrain[index]||sparse.has(index),maximum,
  };
}

/** Preserve already-rounded integer search units (67 becomes 201, not 200).
 * Scaling a lookup does not copy its dense layer or sparse entries. */
export function scaleNavigationCosts(costs:NavigationCostLookup|undefined,factor:number):NavigationCostLookup|undefined {
  return transformNavigationCosts(costs,factor);
}
