/** The sort RimWorld 1.6 runs when it calls `List<T>.Sort(Comparison<T>)`,
 * `List<T>.Sort(IComparer<T>)` or `Array.Sort`: the introspective sort of the
 * class library shipped with the game (Mono's mscorlib, from .NET's corefx),
 * rewritten from its decompiled algorithm. It is NOT stable: two elements that
 * compare equal may end in either order, and the order they end in depends on
 * the whole input. Porting it exactly is what reproduces the game's order of
 * equal keys; JavaScript's `Array.prototype.sort` is stable and does not.
 *
 * The algorithm: quicksort with a median-of-three pivot (low, middle, high are
 * first put in order, the pivot is parked at `high − 1`), partitions of at most
 * 16 elements finished by insertion sort (2 and 3 elements by direct swaps),
 * and heapsort once the recursion depth limit `2 × (⌊log2 n⌋ + 1)` is spent.
 * The right partition is sorted by recursion, the left one by looping.
 *
 * Pure: sorts `keys` in place between `index` and `index + length`. */
export type MonoComparison<T>=(a:T,b:T)=>number;

/** `IntrospectiveSortUtilities.FloorLog2PlusOne`. */
export function floorLog2PlusOne(n:number):number {let result=0;while(n>=1){result++;n=Math.trunc(n/2);}return result;}

/** `ArraySortHelper<T>.IntrospectiveSort(keys, index, length, comparison)`. */
export function monoIntrospectiveSort<T>(keys:T[],comparison:MonoComparison<T>,index=0,length=keys.length-index):void {
 if(!Number.isSafeInteger(index)||!Number.isSafeInteger(length)||index<0||length<0||index+length>keys.length)throw Error('Invalid sort range');
 if(length<2)return;
 introSort(keys,index,length+index-1,2*floorLog2PlusOne(length),comparison);
}
function swapIfGreater<T>(keys:T[],comparison:MonoComparison<T>,a:number,b:number):void {
 if(a!==b&&comparison(keys[a]!,keys[b]!)>0){const value=keys[a]!;keys[a]=keys[b]!;keys[b]=value;}
}
function swap<T>(keys:T[],i:number,j:number):void {if(i!==j){const value=keys[i]!;keys[i]=keys[j]!;keys[j]=value;}}
function introSort<T>(keys:T[],lo:number,hi:number,depthLimit:number,comparison:MonoComparison<T>):void {
 while(hi>lo){
  const size=hi-lo+1;
  if(size<=16){
   if(size===2)swapIfGreater(keys,comparison,lo,hi);
   else if(size===3){swapIfGreater(keys,comparison,lo,hi-1);swapIfGreater(keys,comparison,lo,hi);swapIfGreater(keys,comparison,hi-1,hi);}
   else if(size>3)insertionSort(keys,lo,hi,comparison);
   return;
  }
  if(depthLimit===0){heapsort(keys,lo,hi,comparison);return;}
  depthLimit--;
  const pivot=pickPivotAndPartition(keys,lo,hi,comparison);
  introSort(keys,pivot+1,hi,depthLimit,comparison);
  hi=pivot-1;
 }
}
function pickPivotAndPartition<T>(keys:T[],lo:number,hi:number,comparison:MonoComparison<T>):number {
 const middle=lo+Math.trunc((hi-lo)/2);
 swapIfGreater(keys,comparison,lo,middle);swapIfGreater(keys,comparison,lo,hi);swapIfGreater(keys,comparison,middle,hi);
 const pivot=keys[middle]!;swap(keys,middle,hi-1);
 let left=lo,right=hi-1;
 while(left<right){
  while(comparison(keys[++left]!,pivot)<0){/* advance */}
  while(comparison(pivot,keys[--right]!)<0){/* advance */}
  if(left>=right)break;
  swap(keys,left,right);
 }
 swap(keys,left,hi-1);
 return left;
}
/** The heapsort fallback on its own, between `lo` and `hi` inclusive
 * (exposed so that its order of equal keys can be checked directly). */
export function monoHeapsort<T>(keys:T[],comparison:MonoComparison<T>,lo=0,hi=keys.length-1):void {
 if(!Number.isSafeInteger(lo)||!Number.isSafeInteger(hi)||lo<0||hi>=keys.length)throw Error('Invalid sort range');
 if(hi>lo)heapsort(keys,lo,hi,comparison);
}
function heapsort<T>(keys:T[],lo:number,hi:number,comparison:MonoComparison<T>):void {
 const n=hi-lo+1;
 for(let i=Math.trunc(n/2);i>=1;i--)downHeap(keys,i,n,lo,comparison);
 for(let i=n;i>1;i--){swap(keys,lo,lo+i-1);downHeap(keys,1,i-1,lo,comparison);}
}
function downHeap<T>(keys:T[],i:number,n:number,lo:number,comparison:MonoComparison<T>):void {
 const value=keys[lo+i-1]!;
 while(i<=Math.trunc(n/2)){
  let child=2*i;
  if(child<n&&comparison(keys[lo+child-1]!,keys[lo+child]!)<0)child++;
  if(comparison(value,keys[lo+child-1]!)>=0)break;
  keys[lo+i-1]=keys[lo+child-1]!;i=child;
 }
 keys[lo+i-1]=value;
}
function insertionSort<T>(keys:T[],lo:number,hi:number,comparison:MonoComparison<T>):void {
 for(let i=lo;i<hi;i++){
  let j=i;const value=keys[i+1]!;
  while(j>=lo&&comparison(value,keys[j]!)<0){keys[j+1]=keys[j]!;j--;}
  keys[j+1]=value;
 }
}
