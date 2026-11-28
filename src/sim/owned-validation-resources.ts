import type {ValidationIdentityMembership} from './validation-identities.ts';
import type {Cell,Resource,World} from './types.ts';
import {hasPausedTreeClock} from './tree-transfer-clock.ts';

const MAX_DENSE_CELLS=1048576,MAX_ANCHOR=Number.MAX_SAFE_INTEGER-3,ID_CAPACITY=65536;
const integerAnchor=(value:unknown):value is number=>Number.isSafeInteger(value)&&Math.abs(Number(value))<=MAX_ANCHOR;
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const hydroCrop=(kind:string,version:number):boolean=>kind==='rice'||kind==='potato'||kind==='cotton'||kind==='healroot'||kind==='hops'&&version>=265||kind==='tinctoria'&&version>=382;
type Presence=Map<number,Set<number>>;
type ResourceIndex={width:number;height:number;presence?:Uint8Array;outside:Presence;hydro?:Uint32Array;hydroOutside:Map<number,number>;ids:ValidationIdentityMembership;namespace?:OwnedResourceNamespaceFacts;candidates:number[]};

/** Produced only from the closed Decoder's exact sparse reconstruction.
 * Stable ordinals, complete updates, epoch/revision and no membership/order
 * change are preconditions of the producer, not inferred from this shape. */
export interface OwnedResourceReuseWitness {
  readonly previous:World;
  readonly kind:'sparse';
  readonly updated:readonly {readonly id:number;readonly afterOrdinal:number}[];
}

/** Separate closed-Decoder capability: growth tuples preserved all identity,
 * spatial, substrate and candidate fields. updated contains every full upsert,
 * including same-tick changes. Never derived from an Encoder flag or RAW World. */
export interface OwnedResourceBaseReuseWitness {
  readonly previous:World;
  readonly kind:'resource-base';
  readonly updated:readonly {readonly id:number;readonly afterOrdinal:number}[];
}

export interface OwnedValidationResourceOwner {
  prepare(world:World,witness?:OwnedResourceReuseWitness):OwnedValidationResourceReader;
  prepareBase(world:World,witness:OwnedResourceBaseReuseWitness):OwnedValidationResourceReader;
  commit(world:World):void;
  discard():void;
}

const plantCandidate=(resource:Resource):boolean=>hasPausedTreeClock(resource)||resource.kind==='healroot'||resource.growthLight!==undefined||resource.blight!==undefined||Object.hasOwn(resource,'blight');

/** ID summary from the same resource capture, never an earlier guard verdict.
 * maxId is absent for an empty safe-positive ID collection. */
export interface OwnedResourceNamespaceFacts extends ValidationIdentityMembership {
  readonly safe:boolean;
  readonly unique:boolean;
  readonly maxId:number|undefined;
}

/** Facts from stable ordinary resources during ONE closed MAIN adoption.
 * Undefined facts request the historical traversal. This reader is not an
 * ownership capability: raw Worlds, getters, Proxy and writers stay raw. */
export interface OwnedValidationResourceReader {
  records(world:World):boolean|undefined;
  ids(world:World):ValidationIdentityMembership|undefined;
  namespace(world:World):OwnedResourceNamespaceFacts|undefined;
  /** invalidPlant must be the existing healroot/light/blight aggregate in that
   * order. This is not a general Array.some replacement for arbitrary callbacks. */
  hasInvalid(world:World,foreignIds:ReadonlySet<number>,invalidPlant:(resource:Resource)=>boolean):boolean|undefined;
  hasResource(cell:Cell):boolean;
  hydroOverlapCount(linkedCells:ReadonlyMap<number,unknown>):number;
}

/** Construction reads nothing. Shape, identities, ordered plant candidates
 * and spatial projections share the first paid resource traversal. There is
 * no retained state across adoptions and no early plant predicate evaluation. */
export function createOwnedValidationResources(world:World):OwnedValidationResourceReader {
  return createReader(world).reader;
}

/** A confirmed index is never written here. A full capture allocates a new
 * index; readers share only its facts and always read their own target World. */
function createReader(world:World,reusedIndex?:ResourceIndex):{reader:OwnedValidationResourceReader;peek:()=>ResourceIndex|undefined} {
  let resources:ResourceIndex|undefined=reusedIndex,captured=reusedIndex!==undefined;
  const capture=():ResourceIndex|undefined=>{
    if(captured)return resources;
    captured=true;
    const width=world.width,height=world.height,source=world.resources;
    if(!Number.isSafeInteger(width)||!Number.isSafeInteger(height)||width<=0||height<=0||!Array.isArray(source))return;
    const size=width*height,dense=Number.isSafeInteger(size)&&size<=MAX_DENSE_CELLS;
    const denseIds=new Uint8Array(ID_CAPACITY),sparseIds=new Set<number>();
    let safe=true,unique=true,maxId:number|undefined;
    const ids:ValidationIdentityMembership={has:id=>Number.isInteger(id)&&id>=0&&id<ID_CAPACITY?denseIds[id]===1:sparseIds.has(id)};
    const candidate:ResourceIndex={width,height,presence:dense?new Uint8Array(size):undefined,outside:new Map(),hydro:dense?new Uint32Array(size):undefined,hydroOutside:new Map(),ids,candidates:[]};
    for(let ordinal=0;ordinal<source.length;ordinal++){
      // Own slots are required by hydro records; presence/global some retain
      // their historical hole behavior on the fallback path.
      if(!Object.hasOwn(source,ordinal))return;
      const resource=source[ordinal];if(!record(resource))return;
      const {x,z,kind,id}=resource;
      if(!integerAnchor(x)||!integerAnchor(z)||typeof kind!=='string'||typeof id!=='number')return;
      if(Number.isInteger(id)&&id>=0&&id<ID_CAPACITY){
        if(denseIds[id]===1)unique=false;
        denseIds[id]=1;
        if(id<1)safe=false;else if(maxId===undefined||id>maxId)maxId=id;
      }else{
        if(sparseIds.has(id))unique=false;
        sparseIds.add(id);
        if(!Number.isSafeInteger(id)||id<1)safe=false;
        else if(maxId===undefined||id>maxId)maxId=id;
      }
      if(plantCandidate(resource as unknown as Resource))candidate.candidates.push(ordinal);
      if(candidate.presence&&x>=0&&z>=0&&x<width&&z<height)candidate.presence[z*width+x]=1;
      else {
        let row=candidate.outside.get(z);if(!row)candidate.outside.set(z,row=new Set());row.add(x);
      }
      if(!hydroCrop(kind,world.schemaVersion)){
        // Hydro has historical linear aliases; presence uses strict x/z.
        const cell=z*width+x;
        if(candidate.hydro&&Number.isInteger(cell)&&cell>=0&&cell<size)candidate.hydro[cell]!++;
        else candidate.hydroOutside.set(cell,(candidate.hydroOutside.get(cell)??0)+1);
      }
    }
    candidate.namespace={safe,unique,maxId,has:ids.has};
    return resources=candidate;
  };
  const reader:OwnedValidationResourceReader={
    records(target){return target===world&&capture()?true:undefined;},
    ids(target){return target===world?capture()?.ids:undefined;},
    namespace(target){return target===world?capture()?.namespace:undefined;},
    hasInvalid(target,foreignIds,invalidPlant){
      if(target!==world)return;
      const index=capture();if(!index)return;
      // On a collision, preserve the entire source order: a preceding plant
      // predicate can fail or throw before that later collision is reached.
      for(const id of foreignIds)if(index.ids.has(id))return world.resources.some(resource=>foreignIds.has(resource.id)||invalidPlant(resource));
      for(const ordinal of index.candidates)if(invalidPlant(world.resources[ordinal]!))return true;
      return false;
    },
    hasResource(cell){
      const index=capture();if(!index)return world.resources.some(resource=>resource.x===cell.x&&resource.z===cell.z);
      const {x,z}=cell;
      if(index.presence&&Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<index.width&&z<index.height)return index.presence[z*index.width+x]===1;
      return x===x&&z===z&&index.outside.get(z)?.has(x)===true;
    },
    hydroOverlapCount(linkedCells){
      const index=capture();let count=0;
      if(!index){for(const resource of world.resources)if(linkedCells.has(resource.z*world.width+resource.x)&&!hydroCrop(resource.kind,world.schemaVersion))count++;return count;}
      for(const cell of linkedCells.keys())count+=index.hydro&&Number.isInteger(cell)&&cell>=0&&cell<index.hydro.length?index.hydro[cell]!:index.hydroOutside.get(cell)??0;
      return count;
    },
  };
  return {reader,peek:()=>resources};
}

/** Closed native MAIN only, after its inter-adoption ownership audit. This
 * exported helper grants no authority to arbitrary mutable Worlds/callbacks.
 * RAW callers keep createOwnedValidationResources and historical captures. */
export function createOwnedValidationResourceOwner():OwnedValidationResourceOwner {
  let confirmed:{world:World;index:ResourceIndex}|undefined;
  let pending:{world:World;capture:ReturnType<typeof createReader>}|undefined;
  const reusable=(world:World,witness:OwnedResourceReuseWitness):ResourceIndex|undefined=>{
    const base=confirmed;if(!base||base.world!==witness.previous||witness.kind!=='sparse')return;
    const previous=witness.previous,before=previous.resources,after=world.resources,index=base.index;
    if(world.width!==index.width||world.height!==index.height||previous.width!==index.width||previous.height!==index.height
      ||!Array.isArray(before)||!Array.isArray(after)||before.length!==after.length)return;
    for(const update of witness.updated){
      const ordinal=update.afterOrdinal;
      if(!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>=after.length||!Object.hasOwn(before,ordinal)||!Object.hasOwn(after,ordinal))return;
      const old=before[ordinal],next=after[ordinal];if(!record(old)||!record(next))return;
      if(!integerAnchor(next.x)||!integerAnchor(next.z)||typeof next.kind!=='string'||typeof next.id!=='number'
        ||!Object.is(old.id,update.id)||!Object.is(next.id,update.id)
        ||!Object.is(old.x,next.x)||!Object.is(old.z,next.z)||!Object.is(old.kind,next.kind)
        ||plantCandidate(old as unknown as Resource)!==plantCandidate(next as unknown as Resource))return;
    }
    return index;
  };
  return {
    prepare(world,witness){
      pending=undefined;
      const capture=createReader(world,witness?reusable(world,witness):undefined);
      pending={world,capture};return capture.reader;
    },
    prepareBase(world,witness){
      return this.prepare(world,witness.kind==='resource-base'?{kind:'sparse',previous:witness.previous,updated:witness.updated}:undefined);
    },
    commit(world){
      const index=pending?.world===world?pending.capture.peek():undefined;
      confirmed=index?{world,index}:undefined;pending=undefined;
    },
    discard(){pending=undefined;},
  };
}
