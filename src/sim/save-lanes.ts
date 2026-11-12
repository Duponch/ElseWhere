/* Faster reading of the closed "lanes" of the save walkers.
 *
 * A walker reads a fixed list of keys (its lanes) on each plain object, in
 * that order: a lane missing as an own property is skipped, unless the object
 * inherits it (then the save is refused). For a plain object (prototype
 * Object.prototype), an inherited lane can only come from Object.prototype.
 * When no lane name is found there (checked once per walk: the walk reads
 * descriptors and runs no getter), the lanes to read on an object are exactly
 * its own properties that are lanes, read in lane order: this reader lists
 * them from the object's own property names (a few) instead of querying every
 * lane (dozens). The walker's sequence of reads, verdicts and side effects is
 * unchanged. */
export interface LaneOrder {
 /** Whether some lane name is found on Object.prototype: then every lane must
  * be queried. Read once at the start of a walk. */
 inherited():boolean;
 /** Lane indices that are own properties of the plain object `value`, in
  * lane order. */
 present(value:object):number[];
}
export function laneOrder(keys:readonly string[]):LaneOrder {
 const index=new Map<string,number>();
 keys.forEach((key,i)=>{if(index.has(key))throw Error('Duplicate save lane '+key);index.set(key,i);});
 return {
  inherited(){for(const key of keys)if(key in Object.prototype)return true;return false;},
  present(value){
   const found:number[]=[];
   for(const name of Object.getOwnPropertyNames(value)){
    const i=index.get(name);if(i===undefined)continue;
    let at=found.length;found.push(i);while(at>0&&found[at-1]!>i){found[at]=found[at-1]!;at--;}found[at]=i;
   }
   return found;
  },
 };
}
