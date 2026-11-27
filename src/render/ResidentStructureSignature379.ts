import type {Structure,World} from '../sim/types';
import {readResidentCollectionChanges379,readResidentCollectionDirectory379,type ResidentCollectionDirectory379} from '../bridge/resident-collection-changes-379';

type Scalar=string|number|boolean|bigint|null|undefined;
type Slot={readonly values:readonly Scalar[];readonly text:string};
const scalar=(value:unknown):value is Scalar=>value===null||value===undefined||['string','number','boolean','bigint'].includes(typeof value);
function capture(s:Structure):Slot|undefined {
 const plant=s.flower?.plant,fuel=s.fuel;
 if(!scalar(plant?.hitPoints)||!scalar(plant?.growth)||!scalar(fuel?.ticks))return;
 const v:Scalar[]=[s.id,s.kind,s.material,s.x,s.z,s.orientation,s.footprint,s.medical,s.grave?.corpseId,!!plant,plant?plant.hitPoints>0:undefined,plant?Math.floor(plant.growth*4):undefined,
  s.power?.on,s.power?.parentId,s.power?.switchOn,s.breakdown?.brokenAt??'',fuel?fuel.ticks>0:'',s.vent?.open,
  s.kind==='cryptosleep-casket'?!!s.cryptosleep?.human:s.kind==='ship-cryptosleep-casket'?!!s.shipCryptosleep277?.occupant:undefined,s.kind==='ship-reactor'?(s.shipReactor275?.state??'hibernating'):undefined,s.prisoner];
 if(!v.every(scalar))return;
 const flower=v[9]?`${v[10]}:${v[11]}`:'';
 return{values:v,text:`${v[0]}:${v[1]}:${v[2]}:${v[3]}:${v[4]}:${v[5]}:${v[6]}:${v[7]}:${v[8]}:${flower}:${v[12]}:${v[13]}:${v[14]}:${v[15]}:${v[16]}${v[17]===undefined?'':':vent'+v[17]}${v[18]===undefined?'':':crypto'+v[18]}${v[19]===undefined?'':':reactor'+v[19]}${v[20]?':prisoner':''}`};
}
const equal=(a:readonly Scalar[],b:readonly Scalar[])=>a.length===b.length&&a.every((value,i)=>Object.is(value,b[i]));

/** Same graphical scalar/text semantics as the literal signature, owned by
 * stable structure ID. The accepted edge describes membership/order; only its
 * changed target rows are captured. A private revision replaces repeatedly
 * joining the other 7,500 unchanged slot strings into a global key. */
export class ResidentStructureSignature379 {
 private world:World|undefined;
 private directory:ResidentCollectionDirectory379|undefined;
 private slots=new Map<number,Slot>();
 private axes:string|undefined;
 private packages:string|undefined;
 private revision=0;
 private valid=false;
 private flowerValid=false;
 private pendingFlowers=new Set<number>();
 private pendingKinds=new Set<Scalar>();
 private pendingOther=true;
 private visits=0;
 clear():void{this.world=undefined;this.directory=undefined;this.slots.clear();this.axes=this.packages=undefined;this.valid=false;this.flowerValid=false;this.pendingFlowers.clear();this.pendingKinds.clear();this.pendingOther=true;}
 read(world:World,axes:string,packages:string,reset=false):string|undefined {
  const directory=readResidentCollectionDirectory379(world,'structures');if(!directory)return;
  const before=this.world,oldDirectory=this.directory,proof=!reset&&before&&before!==world?readResidentCollectionChanges379(before,world,'structures'):undefined;
  const wasValid=this.valid,wasFlower=this.flowerValid;this.valid=false;this.world=undefined;
  let changed=!wasValid||this.axes===undefined||this.packages===undefined||this.axes+this.packages!==axes+packages;
  let flowerOnly=!reset&&!changed&&wasFlower;
  if(reset||!wasValid||this.axes!==axes||this.packages!==packages)this.pendingOther=true;
  let rows:number[]|undefined,removed:number[]=[];
  if(proof&&proof.before.count===this.slots.size){
   const gone=new Set<number>(),added=new Set<number>(),updated=new Set<number>();let count=this.slots.size,valid=true;
   for(const edge of proof.edges){
    if(edge.beforeCount!==count){valid=false;break;}
    for(const {id}of edge.removed){if(!added.delete(id)){if(!this.slots.has(id)||gone.has(id)){valid=false;break;}gone.add(id);}updated.delete(id);}
    for(const {id}of edge.added){if(added.has(id)||this.slots.has(id)&&!gone.has(id)){valid=false;break;}added.add(id);}
    for(const {id}of edge.updated)if(!added.has(id)){if(!this.slots.has(id)||gone.has(id)){valid=false;break;}updated.add(id);}
    count=count-edge.removed.length+edge.added.length;if(count!==edge.afterCount){valid=false;break;}
   }
   if(valid&&count===directory.count){
    rows=[];for(const id of new Set([...updated,...added])){const source=directory.source(id);if(source===undefined){valid=false;break;}rows.push(source);}
    if(valid){rows.sort((a,b)=>a-b);removed=[...gone];}else rows=undefined;
    if(added.size||gone.size){flowerOnly=false;if(count!==this.slots.size)changed=true;
     for(const id of gone)if(!added.has(id)||oldDirectory?.capturedSource(id)!==directory.capturedSource(id))changed=true;
     for(const id of added)if(!this.slots.has(id))changed=true;
    }
   }
  }
  if(rows===undefined){
   // Checkpoint, explicit reorder, same object and missing history are complete
   // reads. Their order can change even when each per-ID scalar text is equal.
   rows=Array.from({length:world.structures.length},(_,i)=>i);changed=changed||this.slots.size!==world.structures.length;flowerOnly=false;this.pendingOther=true;
   const present=new Set(world.structures.map(s=>s.id));removed=[...this.slots.keys()].filter(id=>!present.has(id));
  }
  const next:{id:number;slot:Slot;old:Slot|undefined;source:number}[]=[];
  for(const source of rows){const s=world.structures[source]!,slot=capture(s);this.visits++;if(!slot||directory.source(s.id)!==source){this.clear();return;}if(!proof&&oldDirectory?.capturedSource(s.id)!==source)changed=true;next.push({id:s.id,slot,old:this.slots.get(s.id),source});}
  const gone=new Set(removed);
  for(const id of removed){const old=this.slots.get(id);if(old)this.pendingKinds.add(old.values[1]);this.slots.delete(id);this.pendingFlowers.delete(id);}
  for(const {id,slot,old,source}of next){
   if(old&&equal(old.values,slot.values)&&!gone.has(id))continue;
   if(flowerOnly){if(!old||old.values[1]!=='flower-pot'||slot.values[1]!=='flower-pot'||old.values[9]!==true||slot.values[9]!==true)flowerOnly=false;
    else for(let field=0;field<slot.values.length;field++)if(field!==10&&field!==11&&!Object.is(old.values[field],slot.values[field])){flowerOnly=false;break;}
    if(flowerOnly)this.pendingFlowers.add(id);
   }
   if(old)this.pendingKinds.add(old.values[1]);this.pendingKinds.add(slot.values[1]);if(old?.text!==slot.text)changed=true;this.slots.set(id,slot);
  }
  if(changed)this.revision++;
  this.axes=axes;this.packages=packages;this.valid=true;this.flowerValid=flowerOnly;this.world=world;this.directory=directory;
  return`resident-structure:${this.revision}`;
 }
 flowerChanges():readonly number[]|undefined {
  if(!this.valid||!this.flowerValid||!this.world)return;
  const directory=readResidentCollectionDirectory379(this.world,'structures');if(!directory)return;
  const sources:number[]=[];for(const id of this.pendingFlowers){const source=directory.source(id);if(source===undefined)return;sources.push(source);}return sources.sort((a,b)=>a-b);
 }
 changedKinds():ReadonlySet<Scalar>|undefined{return this.valid&&!this.pendingOther?this.pendingKinds:undefined;}
 acknowledge():void{this.pendingFlowers.clear();this.flowerValid=this.valid;this.pendingKinds.clear();this.pendingOther=!this.valid;}
 metrics(){return{visits:this.visits,structures:this.slots.size};}
}
