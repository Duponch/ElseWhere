import type {World} from './types.ts';

type Resource=World['resources'][number];
/** How `next` follows `previous` when resources were only removed (the rest
 * kept in order) and others appended: the removed resources, in their old
 * order, and the index in `next` where the appended ones start. Anything
 * else (a reorder, an insertion, a replaced object) or more than `limit`
 * removed or appended returns undefined: the caller rebuilds. Derived caches
 * use it when `world.resources` is replaced, which happens on most ticks; a
 * resource's kind, species and position never change. */
export function resourceArrayDelta(previous:readonly Resource[],next:readonly Resource[],limit:number):{removed:Resource[];appendedFrom:number}|undefined {
 const removed:Resource[]=[];let i=0,j=0;
 for(;j<next.length;j++){
  const resource=next[j];if(i<previous.length&&previous[i]===resource){i++;continue;}
  let k=i+1;while(k<previous.length&&previous[k]!==resource)k++;
  if(k>=previous.length)break;
  if(removed.length+k-i>limit)return undefined;
  while(i<k)removed.push(previous[i++]!);i++;
 }
 if(removed.length+previous.length-i>limit||next.length-j>limit)return undefined;
 while(i<previous.length)removed.push(previous[i++]!);
 // An appended resource that was also removed was moved: not this pattern.
 if(removed.length&&j<next.length){const gone=new Set(removed);for(let t=j;t<next.length;t++)if(gone.has(next[t]!))return undefined;}
 return {removed,appendedFrom:j};
}
