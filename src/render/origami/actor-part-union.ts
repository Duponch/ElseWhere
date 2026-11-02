import * as THREE from 'three/webgpu';
import {RESIDENT_WEAPON_VISUALS269} from '../weapon-shape';

type Attribute=THREE.BufferAttribute|THREE.InterleavedBufferAttribute;
export type ActorUnionKind='human'|'animal';
const weaponByDye=new Map<number,number>(RESIDENT_WEAPON_VISUALS269.map(weapon=>[weapon.dye,weapon.equipment]));
const humanDyes=Object.freeze([...new Set([
 ...Array.from({length:15},(_,i)=>100+i),...Array.from({length:5},(_,i)=>200+i),
 -3,-40,-41,-2,-7,-11,-12,-42,-8,-10,-6,...weaponByDye.keys(),-30,-31,-32,
])]);
const dyeIndex=new Map(humanDyes.map((dye,index)=>[dye,index]));
if(humanDyes.length>64)throw new Error('Actor union gate word requires an explicit layout extension');
export interface HumanPartUnion {readonly kind:'human';readonly count:number;readonly reliable:boolean;readonly low:number;readonly high:number;readonly key:string}
export interface AnimalPartUnion {readonly kind:'animal';readonly count:number;readonly reliable:boolean;readonly allAbsent:number;readonly eyes:number;readonly key:string}
export type ActorPartUnion=HumanPartUnion|AnimalPartUnion;
export interface ActorPartRun {readonly first:number;readonly count:number;readonly gate:number;readonly eye:number}
function required(geometry:THREE.BufferGeometry,name:string):Attribute {const value=geometry.getAttribute(name);if(!value)throw new Error(`Actor union requires existing ${name}`);return value;}
function ownerCount(count:number,...attributes:Attribute[]):void {if(!Number.isInteger(count)||count<0||attributes.some(a=>count>a.count))throw new Error('Actor union owner count exceeds the actual encoded streams');}
function humanVisible(dye:number,stage:number,hair:number,beard:number,weapon:number,outfit:number,worn:number,activity:number,cargo:number):boolean {
 const helmet=worn>1.5,recon=worn>3.5&&worn<5.5,tuque=worn>5.5&&worn<9.5;
 if(stage>1.5&&(dye<0||dye>=100))return false;
 if(dye>=100&&dye<=114)return !helmet&&Math.floor(hair/2**(dye-100))%2>.5;
 if(dye>=200&&dye<=204)return !recon&&Math.floor(beard/2**(dye-200))%2>.5;
 const equipment=weaponByDye.get(dye);if(equipment!==undefined)return weapon===equipment;
 switch(dye){
  case -3:return outfit===2;
  case -40:return outfit===3;
  case -41:return outfit===4;
  case -2:return worn%2>=.5;
  case -7:return helmet&&worn<=3.5;
  case -11:return outfit===6;
  case -12:return worn>=9.5&&worn<=11.5;
  case -42:return outfit===5;
  case -8:return recon;
  case -10:return tuque;
  case -6:return outfit===4&&!helmet;
  case -30:case -31:case -32:return dye===activity&&Math.abs(cargo)<=.5;
  default:return true;
 }
}
/** Stable gates from the existing Origami pose, evaluated per complete owner
 * before OR-ing the result. Separate unions of helmet/hair/outfit fields would
 * create invalid cross-owner combinations. Clocks, blink, anatomy and pose
 * interpolation remain wholly in the original shader. No population cap. */
export function readHumanPartUnion(owners:THREE.BufferGeometry,count:number):HumanPartUnion {
 return new HumanPartUnionReader().read(owners,count);
}
/** Retained per-layer visibility rows. A changed movement clock, equipment
 * ready fraction or palette row does not reevaluate forty gates. Source owner
 * slots remain untouched; identical visibility data may safely reuse the same
 * result even when an actor slot is recycled. Call at Full/stable gate changes,
 * not unconditionally from render. No fixed population limit or string per row. */
export class HumanPartUnionReader {
 private capacity=0;private values=new Float64Array(0);private low=new Uint32Array(0);private high=new Uint32Array(0);private valid=new Uint8Array(0);private readonly scratch=new Float64Array(8);
 readonly stats={reads:0,rowEvaluations:0,rowHits:0};
 reset():void{this.valid.fill(0);}
 read(owners:THREE.BufferGeometry,count:number):HumanPartUnion {
  const shape=required(owners,'aShape'),equipment=required(owners,'aEquipment'),motion=required(owners,'aMotion'),cargo=required(owners,'aCargo');ownerCount(count,shape,equipment,motion,cargo);this.stats.reads++;
  if(count>this.capacity){const capacity=2**Math.ceil(Math.log2(Math.max(1,count))),values=new Float64Array(capacity*8),low=new Uint32Array(capacity),high=new Uint32Array(capacity),valid=new Uint8Array(capacity);values.set(this.values);low.set(this.low);high.set(this.high);valid.set(this.valid);this.values=values;this.low=low;this.high=high;this.valid=valid;this.capacity=capacity;}
  let low=0,high=0,reliable=true;
  for(let owner=0;owner<count;owner++){
   const body=shape.getX(owner),hair=shape.getZ(owner),beard=shape.getW(owner),weapon=Math.floor(equipment.getX(owner)),outfit=equipment.getY(owner),worn=Math.floor(equipment.getZ(owner)),activity=motion.getY(owner),load=cargo.getX(owner);
   if(!Number.isSafeInteger(body)||body<0||body>=2**24||!Number.isSafeInteger(hair)||hair<0||hair>32767||!Number.isSafeInteger(beard)||beard<0||beard>=2**24||!Number.isSafeInteger(weapon)||weapon<0||!Number.isSafeInteger(outfit)||outfit<0||!Number.isSafeInteger(worn)||worn<0||!Number.isFinite(activity)||!Number.isFinite(load)){this.valid[owner]=0;reliable=false;break;}
   const row=owner*8,s=this.scratch;s[0]=Math.floor(body/10)%10;s[1]=hair;s[2]=beard%32;s[3]=weapon;s[4]=outfit;s[5]=worn;s[6]=activity;s[7]=Math.abs(load)>.5?1:0;
   let same=this.valid[owner]===1;for(let c=0;c<8&&same;c++)same=s[c]===this.values[row+c];
   if(same)this.stats.rowHits++;
   else{
    let rowLow=0,rowHigh=0;for(let index=0;index<humanDyes.length;index++)if(humanVisible(humanDyes[index]!,s[0]!,s[1]!,s[2]!,s[3]!,s[4]!,s[5]!,s[6]!,s[7]!)){if(index<32)rowLow|=2**index;else rowHigh|=2**(index-32);}
    this.values.set(s,row);this.low[owner]=rowLow>>>0;this.high[owner]=rowHigh>>>0;this.valid[owner]=1;this.stats.rowEvaluations++;
   }
   low|=this.low[owner]!;high|=this.high[owner]!;
  }
  low>>>=0;high>>>=0;return {kind:'human',count,reliable,low,high,key:`human:${count===0?'empty':'owners'}:${reliable?`${low}:${high}`:'conservative'}`};
 }
}
/** Native animal masks already fit the established23-bit exact float word.
 * Only an absence common to every owner may remove a part. Eye states match
 * the existing shader's state.z>1.5 test; mixed living/dead lots retain both. */
export function readAnimalPartUnion(owners:THREE.BufferGeometry,count:number):AnimalPartUnion {
 const biology=required(owners,'aBiology'),state=required(owners,'aAnimal');ownerCount(count,biology,state);
 let allAbsent=0x7fffff,eyes=0,reliable=true;
 for(let owner=0;owner<count;owner++){
  const absent=biology.getZ(owner),posture=state.getZ(owner);
  if(!Number.isSafeInteger(absent)||absent<0||absent>0x7fffff||!Number.isFinite(posture)){reliable=false;break;}
  allAbsent&=absent;eyes|=posture>1.5?2:1;
 }
 return {kind:'animal',count,reliable,allAbsent,eyes,key:`animal:${count===0?'empty':'owners'}:${reliable?`${allAbsent}:${eyes}`:'conservative'}`};
}
function same3(attribute:Attribute,indices:readonly number[],component:number):number|undefined {const value=attribute.getComponent(indices[0]!,component);return indices.every(i=>attribute.getComponent(i,component)===value)?value:undefined;}
/** One index-only controller per existing body/brush/wear family. The original
 * vertex buffers, vertex IDs, owner slots, material, poses, cache, attributes,
 * masks and draw ordering are preserved. A triangle is removed only when its
 * existing shader collapses it for every real owner. The run cache is reusable
 * by later per-owner packet selection without changing this first boundary.
 *
 * A generated identity index for formerly non-indexed wear remains attached
 * after retirement, so its GPU buffer is released by the owner's normal
 * geometry disposal. Never dispose shared actor attributes from this helper. */
export class ActorPartUnionIndex {
 readonly runs:readonly ActorPartRun[];
 readonly sourceIndices:Uint16Array|Uint32Array;
 readonly sourceVertexCount:number;
 readonly kind:ActorUnionKind;
 private readonly index:THREE.BufferAttribute;
 private readonly originalDrawRange:{start:number;count:number};
 private lastKey='';private selectedCount=0;private selectedVertices=0;private state?:ActorPartUnion;private warmDepth=0;private disposed=false;
 readonly stats={reconciles:0,indexPatches:0,sourceIndexEntries:0,selectedIndexEntries:0,sourceReferencedVertices:0,selectedReferencedVertices:0,owners:0};
 constructor(readonly geometry:THREE.InstancedBufferGeometry,kind:ActorUnionKind){
  this.kind=kind;this.sourceVertexCount=required(geometry,'position').count;this.originalDrawRange={...geometry.drawRange};
  const total=geometry.index?.count??this.sourceVertexCount;
  if(total%3||geometry.groups.length||geometry.drawRange.start!==0||geometry.drawRange.count<total)throw new Error('Actor union requires the complete existing triangle family without material groups');
  const ArrayType=this.sourceVertexCount>65535?Uint32Array:Uint16Array;this.sourceIndices=new ArrayType(total);for(let i=0;i<total;i++)this.sourceIndices[i]=geometry.index?.getX(i)??i;
  if(geometry.index){this.index=geometry.index;if(this.index.count!==total)throw new Error('Actor union index capacity mismatch');}
  else{this.index=new THREE.BufferAttribute(this.sourceIndices.slice(),1);geometry.setIndex(this.index);}
  const traits=kind==='human'?required(geometry,'pawnRigTraits'):required(geometry,'animalPart'),runs:ActorPartRun[]=[];
  for(let first=0;first<total;first+=3){
   const vertices=[this.sourceIndices[first]!,this.sourceIndices[first+1]!,this.sourceIndices[first+2]!];
   let gate=-1,eye=-1;
   if(kind==='human'){const dye=same3(traits,vertices,1);gate=dye===undefined?-1:dyeIndex.get(dye)??-1;}
   else{const bit=same3(traits,vertices,1),mark=same3(traits,vertices,3);if(bit!==undefined&&mark!==undefined){gate=Number.isSafeInteger(bit)&&bit>=0&&bit<=0x400000&&(bit===0||(bit&(bit-1))===0)?bit:0;eye=mark===0||mark===1?mark:-1;}}
   const previous=runs.at(-1);if(previous&&previous.gate===gate&&previous.eye===eye)(previous as {count:number}).count+=3;else runs.push({first,count:3,gate,eye});
  }
  this.runs=Object.freeze(runs.map(run=>Object.freeze(run)));this.selectedCount=total;this.selectedVertices=new Set(this.sourceIndices).size;
  Object.assign(this.stats,{sourceIndexEntries:total,selectedIndexEntries:total,sourceReferencedVertices:this.selectedVertices,selectedReferencedVertices:this.selectedVertices});
 }
 private keep(run:ActorPartRun,state:ActorPartUnion):boolean {
  if(state.count===0)return false;if(!state.reliable||run.gate<0)return true;
  if(state.kind==='human')return run.gate<32?Math.floor(state.low/2**run.gate)%2>.5:Math.floor(state.high/2**(run.gate-32))%2>.5;
  return !(run.gate>0&&Math.floor(state.allAbsent/run.gate)%2>.5)&&(run.eye<0||(state.eyes&(run.eye===0?1:2))!==0);
 }
 reconcile(state:ActorPartUnion):boolean {
  if(this.disposed)return false;if(state.kind!==this.kind)throw new Error('Actor union state belongs to a different rig');this.state=state;this.stats.reconciles++;this.stats.owners=state.count;
  if(this.warmDepth||state.key===this.lastKey)return false;return this.apply(state);
 }
 private apply(state:ActorPartUnion):boolean {
  const values=this.index.array;let count=0,changed=false;
  for(const run of this.runs)if(this.keep(run,state)){
   for(let i=0;i<run.count;i++)if(values[count+i]!==this.sourceIndices[run.first+i])changed=true;
   values.set(this.sourceIndices.subarray(run.first,run.first+run.count),count);count+=run.count;
  }
  changed||=count!==this.selectedCount;this.lastKey=state.key;this.selectedCount=count;this.geometry.setDrawRange(0,count);
  if(changed){this.index.clearUpdateRanges();if(count){this.index.addUpdateRange(0,count);this.index.needsUpdate=true;}this.stats.indexPatches++;this.selectedVertices=new Set(Array.from(values.subarray(0,count))).size;}
  this.stats.selectedIndexEntries=count;this.stats.selectedReferencedVertices=this.selectedVertices;return changed;
 }
 /** Full source coverage for the existing temporary pipeline/shadow warmup.
  * Nested users and adoption during an awaited warmup restore the latest union,
  * never the old slot membership. The owner still suspends ordinary frames. */
 prepareForCompile():()=>void {
  if(this.disposed)return()=>{};
  if(this.warmDepth++===0){this.index.array.set(this.sourceIndices);this.index.clearUpdateRanges();this.index.addUpdateRange(0,this.sourceIndices.length);this.index.needsUpdate=true;this.geometry.setDrawRange(0,this.sourceIndices.length);}
  let active=true;return()=>{if(!active||this.disposed)return;active=false;if(--this.warmDepth===0){this.lastKey='';this.selectedCount=-1;if(this.state)this.apply(this.state);}};
 }
 dispose():void {
  if(this.disposed)return;this.disposed=true;this.index.array.set(this.sourceIndices);this.index.clearUpdateRanges();this.index.addUpdateRange(0,this.sourceIndices.length);this.index.needsUpdate=true;this.geometry.setDrawRange(this.originalDrawRange.start,this.originalDrawRange.count);
 }
}
/** Optional-style boundary: disabled/Default creates no index or run cache and
 * does not inspect or mutate the source geometry at all. */
export function createActorPartUnionIndex(geometry:THREE.InstancedBufferGeometry,kind:ActorUnionKind,enabled:boolean):ActorPartUnionIndex|undefined {
 return enabled?new ActorPartUnionIndex(geometry,kind):undefined;
}
