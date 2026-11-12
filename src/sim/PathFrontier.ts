/** Dial queue for bounded nonnegative integer edge costs. One entry per cell.
 * Unlike a heap, decrease-key and extraction avoid log(N) work on full map floods. */
export class PathFrontier {
  private readonly heads:Int32Array;
  private readonly next:Int32Array;
  private readonly previous:Int32Array;
  private readonly buckets:Int32Array;
  private count=0;
  private cursor=0;
  private readonly costs:Float64Array;
  private readonly occupancy?:Uint32Array[];
  /** `arrays`: map-sized next/previous/buckets already at -1 (a reused search
   * scratch, see WeightedSearchScratch); else fresh ones. */
  constructor(costs:Float64Array,maxEdgeCost=1414,indexOccupied=false,arrays?:{readonly next:Int32Array;readonly previous:Int32Array;readonly buckets:Int32Array;heads?(length:number):Int32Array}) {this.heads=arrays?.heads?arrays.heads(maxEdgeCost+1):new Int32Array(maxEdgeCost+1).fill(-1);this.costs=costs;
    if(arrays){this.next=arrays.next;this.previous=arrays.previous;this.buckets=arrays.buckets;}else{this.next=new Int32Array(costs.length).fill(-1);this.previous=new Int32Array(costs.length).fill(-1);this.buckets=new Int32Array(costs.length).fill(-1);}
    if(indexOccupied){this.occupancy=[];let length=this.heads.length;do{length=Math.ceil(length/32);this.occupancy.push(new Uint32Array(length));}while(length>1);}}
  private mark(bucket:number,present:boolean):void {
    if(!this.occupancy)return;
    let index=bucket;
    for(const level of this.occupancy){const word=index>>>5,bit=1<<(index&31),before=level[word]!;level[word]=present?before|bit:before&~bit;
      if((before===0)===(level[word]===0))break;present=level[word]!==0;index=word;}
  }
  private successor(level:number,index:number):number|undefined {
    const bits=this.occupancy![level]!,word=index>>>5;if(word>=bits.length)return;
    const matching=(bits[word]!&(0xffffffff<<(index&31)))>>>0;
    if(matching)return word*32+31-Math.clz32((matching&-matching)>>>0);
    if(level+1>=this.occupancy!.length)return;
    const next=this.successor(level+1,word+1);if(next===undefined)return;
    const value=bits[next]!;return next*32+31-Math.clz32((value&-value)>>>0);
  }
  push(node:number):void {
    const old=this.buckets[node]!;
    if(old>=0) {
      const previous=this.previous[node]!,next=this.next[node]!;
      if(previous<0)this.heads[old]=next;else this.next[previous]=next;
      if(next>=0)this.previous[next]=previous;
      if(this.heads[old]===-1)this.mark(old,false);
    } else this.count++;
    const bucket=this.costs[node]!%this.heads.length,head=this.heads[bucket]!;
    this.buckets[node]=bucket;this.next[node]=head;this.previous[node]=-1;if(head>=0)this.previous[head]=node;this.heads[bucket]=node;
    if(head===-1)this.mark(bucket,true);
  }
  /** Calls `visit` for every node still queued (each once). */
  forEachQueued(visit:(node:number)=>void):void {
    for(let bucket=0;bucket<this.heads.length;bucket++)for(let node=this.heads[bucket]!;node>=0;node=this.next[node]!)visit(node);
  }
  pop():number|undefined {
    if(!this.count)return undefined;
    if(this.occupancy){const start=this.cursor%this.heads.length,next=this.successor(0,start)??this.successor(0,0)!;this.cursor+=(next-start+this.heads.length)%this.heads.length;}
    else while(this.heads[this.cursor%this.heads.length]===-1)this.cursor++;
    const bucket=this.cursor%this.heads.length,node=this.heads[bucket]!,next=this.next[node]!;
    this.heads[bucket]=next;if(next>=0)this.previous[next]=-1;else this.mark(bucket,false);this.buckets[node]=-1;this.count--;return node;
  }
}
