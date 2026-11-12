/** Immutable cost capture for one synchronous navigation decision. The terrain
 * byte array and sparse overlays are owned by the capture, never cached. */
export interface NavigationCostLookup {
  get(index:number):number|undefined;
  has(index:number):boolean;
  readonly maximum:number;
}

export const EMPTY_NAVIGATION_COSTS:NavigationCostLookup=Object.freeze({get:()=>undefined,has:()=>false,maximum:0});

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
  return costs?{get(index){const value=costs.get(index);return value===undefined?undefined:value*factor;},has:index=>costs.has(index),maximum:costs.maximum*factor}:undefined;
}
