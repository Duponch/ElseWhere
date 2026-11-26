import type {Structure,World} from '../sim/types';
import {structureMembershipToken} from '../sim/structure-navigation';
import {damagedStructures379,invalidateStructureFamily379} from '../sim/structure-family-379';
import {withJournalTerrainReadScope} from '../sim/terrain-read-scope';

let generation:object={};
/** Command, replacement and speculative unknown transactions retire the
 * witness. The ordinary SnapshotEncoder never uses this private ownership. */
export function invalidateStaticStructurePublication379():void {generation={};}

const simpleKeys=new Set(['id','kind','x','z','orientation','footprint','material','factionId','damage']);
function ordinaryConduitPower(value:unknown):boolean {
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype||Reflect.ownKeys(value).length!==2)return false;
 const on=Object.getOwnPropertyDescriptor(value,'on'),parent=Object.getOwnPropertyDescriptor(value,'parentId');
 return !!on?.enumerable&&Object.hasOwn(on,'value')&&on.value===false&&!!parent?.enumerable&&Object.hasOwn(parent,'value')&&parent.value===null;
}
/** Actual fixed SIM producer facts only. The static installed wall/fence has
 * immutable geometry/material/affiliation in ordinary stepping; only damage
 * can change. A conduit is a transmitter, never a switch, trader, connector
 * or EMP target; its ordinary off/null power stub never changes in stepping.
 * All other kinds, component records and unknown own layouts stay dynamic. */
function coldStructure(row:Structure):boolean {
 if(row.kind!=='wall'&&row.kind!=='fence'&&row.kind!=='power-conduit'||!!row.damage||Object.getPrototypeOf(row)!==Object.prototype)return false;
 for(const key of Reflect.ownKeys(row)){
  if(typeof key!=='string'||!simpleKeys.has(key)&&!(row.kind==='power-conduit'&&key==='power'))return false;
  const d=Object.getOwnPropertyDescriptor(row,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return false;
  if(key!=='power'&&d.value!==undefined&&d.value!==null&&typeof d.value!=='number'&&typeof d.value!=='string')return false;
 }
 return row.kind!=='power-conduit'||ordinaryConduitPower(row.power);
}
interface State {
 readonly generation:object;readonly owner:World;readonly source:readonly Structure[];readonly membership:object;
 readonly slots:WeakMap<Structure,number>;readonly hot:Set<number>;indices:readonly number[];
}
/** The Full codec's geometry membership is already owned by the actual
 * structure writers. Keep a resident candidate list of dynamic components
 * and rows which have ever been damaged since the last genuine rebuild.
 * A new real damage membership promotes its slot permanently (including the
 * later repair-to-zero); no search over the undamaged walls/conduits. */
export class StaticStructurePublication379 {
 private current:State|undefined;
 private world:World|undefined;
 private rebuild=false;
 constructor(private readonly sourceOwner:object){}
 clear():void {this.current=this.world=undefined;this.rebuild=false;}
 reset(world:World):void {this.world=world;this.rebuild=true;}
 prepare(world:World):readonly number[]|undefined {
  this.world=world;this.rebuild=true;
  if(Number(world.schemaVersion)<379)return;
  const held=this.current;
  if(!held||held.generation!==generation||held.owner!==world||held.source!==world.structures||held.membership!==structureMembershipToken(world))return;
  const damaged=withJournalTerrainReadScope(this.sourceOwner,()=>damagedStructures379(world));
  if(damaged===world.structures)return;
  let changed=false;
  for(const row of damaged){const slot=held.slots.get(row);if(slot===undefined||world.structures[slot]!==row)return;if(!held.hot.has(slot)){held.hot.add(slot);changed=true;}}
  if(changed)held.indices=[...held.hot].sort((a,b)=>a-b);
  this.rebuild=false;return held.indices;
 }
 commit():void {
  const world=this.world;
  if(this.rebuild&&world){
   if(Number(world.schemaVersion)<379){this.current=undefined;}
   else {
    const source=world.structures,slots=new WeakMap<Structure,number>(),hot=new Set<number>();
    for(let i=0;i<source.length;i++){const row=source[i]!;slots.set(row,i);if(!coldStructure(row))hot.add(i);}
    // Seed the genuine installed damage directory while the complete source
    // capture is held. Future real writer hooks update its membership.
    const membership=structureMembershipToken(world);
    if(!this.current||this.current.generation!==generation)invalidateStructureFamily379(world);
    withJournalTerrainReadScope(this.sourceOwner,()=>damagedStructures379(world));
    this.current={generation,owner:world,source,membership,slots,hot,indices:[...hot]};
   }
  }
  this.world=undefined;this.rebuild=false;
 }
}
