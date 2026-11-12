import { PathFrontier } from './PathFrontier.ts';
import { CARDINAL_COST, DIAGONAL_COST } from './movement.ts';
import type { DistanceField } from './navigation-types.ts';
import { EMPTY_NAVIGATION_COSTS,type NavigationCostLookup } from './navigation-costs.ts';

const DIRECTIONS = [[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]] as const;

/** The map-sized arrays of one search at a time, at the constructor's
 * sentinels between searches. A search given this scratch records every cell
 * it touches (a cost leaving Infinity) and release() resets only those: a
 * short search on a large map then costs its own area, not the map's. The
 * results are those of fresh arrays. */
export class WeightedSearchScratch {
  readonly parents:Int32Array;readonly costs:Float64Array;readonly settled:Uint8Array;
  readonly next:Int32Array;readonly previous:Int32Array;readonly buckets:Int32Array;
  private touched:Int32Array;private count=0;private busy=false;
  /** The frontier's bucket heads, all -1 between searches; kept for one length. */
  private bucketHeads?:Int32Array;
  constructor(readonly size:number){
    this.parents=new Int32Array(size).fill(-2);this.costs=new Float64Array(size).fill(Infinity);this.settled=new Uint8Array(size);
    this.next=new Int32Array(size).fill(-1);this.previous=new Int32Array(size).fill(-1);this.buckets=new Int32Array(size).fill(-1);
    this.touched=new Int32Array(Math.min(size,4096));
  }
  heads(length:number):Int32Array{if(this.bucketHeads?.length!==length)this.bucketHeads=new Int32Array(length).fill(-1);return this.bucketHeads;}
  /** Takes the scratch for one search; false while another search holds it. */
  acquire():boolean{if(this.busy)return false;this.busy=true;return true;}
  touch(index:number):void{
    if(this.count===this.touched.length){const grown=new Int32Array(Math.min(this.size,this.touched.length*2));grown.set(this.touched);this.touched=grown;}
    this.touched[this.count++]=index;
  }
  /** Ends the search that held the scratch: its field must not be read again. */
  release():void{
    const {parents,costs,settled,next,previous,buckets,touched}=this;
    // A node still queued heads or follows in its bucket: clearing the heads
    // of the touched nodes' buckets empties every bucket.
    const heads=this.bucketHeads;
    if(heads)for(let k=0;k<this.count;k++){const b=buckets[touched[k]!]!;if(b>=0)heads[b]=-1;}
    for(let k=0;k<this.count;k++){const i=touched[k]!;parents[i]=-2;costs[i]=Infinity;settled[i]=0;next[i]=-1;previous[i]=-1;buckets[i]=-1;}
    this.count=0;this.busy=false;
  }
}

/** Resumable Dijkstra. Keep the same queue order and finish the entire equal-cost
 * layer, so a later request returns the exact same parents as one full flood. */
export class WeightedSearch {
  readonly field: DistanceField;
  private readonly frontier: PathFrontier;
  private pending: number | undefined;
  private readonly settled: Uint8Array;
  private readonly width:number;
  private readonly height:number;
  private readonly cardinal:number;
  private readonly diagonal:number;
  private readonly unavailable:Uint8Array;
  private finished=false;
  private readonly extraCosts:NavigationCostLookup|undefined;
  private readonly repeaters:ReadonlySet<number>;
  private readonly floors:NavigationCostLookup;
  private readonly corners:ReadonlySet<number>;
  private readonly additiveCosts?:NavigationCostLookup;
  private readonly scratch?:WeightedSearchScratch;
  constructor(width:number, height:number, start:number, unavailable:Uint8Array, extraCosts?:NavigationCostLookup,repeaters:ReadonlySet<number>=new Set(),floors:NavigationCostLookup=EMPTY_NAVIGATION_COSTS,corners:ReadonlySet<number>=new Set(),additiveCosts?:NavigationCostLookup,moveCosts?:{cardinal:number;diagonal:number},scratch?:WeightedSearchScratch) {
    this.cardinal=moveCosts?.cardinal??CARDINAL_COST;this.diagonal=moveCosts?.diagonal??DIAGONAL_COST;
    this.additiveCosts=additiveCosts;
    this.extraCosts=extraCosts;this.repeaters=repeaters;this.floors=floors;this.corners=corners;
    this.width=width;this.height=height;this.unavailable=unavailable;
    const size=width*height;
    // A scratch (acquired by the caller) is clean: the same sentinels.
    if(scratch&&scratch.size!==size)throw Error('Search scratch of another map size');
    this.scratch=scratch;
    const parents=scratch?scratch.parents:new Int32Array(size).fill(-2),costs=scratch?scratch.costs:new Float64Array(size).fill(Infinity);
    this.settled=scratch?scratch.settled:new Uint8Array(size);this.field={parents,costs,start,visited:0,unreachedGroups:0,settled:this.settled};
    const maximum=extraCosts?.maximum??0;
    this.frontier=new PathFrontier(costs,this.diagonal+maximum+(additiveCosts?.maximum??0),!!additiveCosts,scratch);scratch?.touch(start);costs[start]=0;parents[start]=-1;this.frontier.push(start);this.pending=this.frontier.pop();
  }
  advance(goals?:ReadonlySet<number>,allGroups?:readonly ReadonlySet<number>[],isGoal?:(index:number)=>boolean):DistanceField {
    if(this.finished)throw new Error('A finalized path field cannot be resumed.');
    const {parents,costs,start}=this.field,size=parents.length,blocked=this.unavailable,scratch=this.scratch;
    let goalCost=Infinity,remaining=0;
    if(goals)for(const index of goals)if(this.settled[index])goalCost=Math.min(goalCost,costs[index]!);
    const membership=new Map<number,number[]>(),reached=new Set<number>();
    const free=(i:number)=>i===start||!blocked[i];
    const hasEntry=(i:number)=>i===start||i>=this.width&&free(i-this.width)||i+this.width<size&&free(i+this.width)||i%this.width>0&&free(i-1)||i%this.width+1<this.width&&free(i+1);
    if(allGroups)for(let group=0;group<allGroups.length;group++) {
      let viable=false,known=false;
      for(const index of allGroups[group]!)if(index>=0&&index<size&&free(index)&&hasEntry(index)) {
        const members=membership.get(index);if(members)members.push(group);else membership.set(index,[group]);viable=true;
        if(this.settled[index])known=true;
      }
      if(known)reached.add(group);else if(viable)remaining++;
    }
    if(allGroups&&!remaining)goalCost=0;
    while(this.pending!==undefined&&costs[this.pending]!<=goalCost) {
      const index=this.pending;this.settled[index]=1;this.field.visited++;
      if(goals?.has(index))goalCost=costs[index]!;
      if(isGoal?.(index)){goalCost=costs[index]!;this.field.goalIndex=Math.min(this.field.goalIndex??Infinity,index);}
      if(allGroups){for(const group of membership.get(index)??[])if(!reached.has(group)){reached.add(group);remaining--;}if(!remaining)goalCost=costs[index]!;}
      const x=index%this.width,z=Math.floor(index/this.width);
      for(const [dx,dz] of DIRECTIONS) {
        const nx=x+dx,nz=z+dz,next=nz*this.width+nx;
        if(nx<0||nz<0||nx>=this.width||nz>=this.height||blocked[next]||this.settled[next])continue;
        if(dx&&dz&&(blocked[index+dx]||blocked[index+dz*this.width]||this.corners.has(index+dx)||this.corners.has(index+dz*this.width)))continue;
        const cost=costs[index]!+(dx&&dz?this.diagonal:this.cardinal)+(this.repeaters.has(index)&&this.repeaters.has(next)?this.floors.get(next)??0:this.extraCosts?.get(next)??0)+(this.additiveCosts?.get(next)??0);
        if(cost<costs[next]!) {if(scratch!==undefined&&costs[next]===Infinity)scratch.touch(next);costs[next]=cost;parents[next]=index;this.frontier.push(next);}
      }
      this.pending=this.frontier.pop();
    }
    this.field.unreachedGroups=remaining;return this.field;
  }
  /** Public one-shot results retain the historical -2/Infinity convention. */
  finish(goals?:ReadonlySet<number>,allGroups?:readonly ReadonlySet<number>[],isGoal?:(index:number)=>boolean):DistanceField {
    const field=this.advance(goals,allGroups,isGoal);
    // An exhausted frontier has settled every discovered cell. The untouched
    // cells still contain their constructor's -2/Infinity sentinels; the only
    // discovered cells left unsettled are the pending node and the queued ones.
    if(this.pending!==undefined){
      const {parents,costs}=field,reset=(i:number)=>{parents[i]=-2;costs[i]=Infinity;};
      reset(this.pending);this.frontier.forEachQueued(reset);
    }
    delete field.settled;this.finished=true;return field;
  }
}
