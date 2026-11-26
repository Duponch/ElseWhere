import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {CORE_HUMAN_REQUIRED297,CORE_HUMAN_OPTIONAL297,CORE_ANIMAL_REQUIRED297,CORE_ANIMAL_OPTIONAL297,CORE_MECH_REQUIRED297,CORE_MECH_OPTIONAL297} from './physical-actor-fields-297.ts';
type Kind297='human'|'animal'|'mechanical';
declare const sourceShapeBrand297:unique symbol;
export interface ActorRecordSourceShape297 {readonly [sourceShapeBrand297]:true}
interface Shape {readonly actor:object;readonly kind:Kind297;readonly owner:object;readonly generation:object;readonly proof:ActorRecordSourceShape297}
const shapes=new WeakMap<object,Shape>(),proofs=new WeakMap<ActorRecordSourceShape297,Shape>();
let generation:object={};
function ordinaryShape(kind:Kind297,actor:object):boolean {
 try{
  if(Object.getPrototypeOf(actor)!==Object.prototype)return false;
  const required:readonly string[]=kind==='human'?CORE_HUMAN_REQUIRED297:kind==='animal'?CORE_ANIMAL_REQUIRED297:CORE_MECH_REQUIRED297;
  const optional:readonly string[]=kind==='human'?CORE_HUMAN_OPTIONAL297:kind==='animal'?CORE_ANIMAL_OPTIONAL297:CORE_MECH_OPTIONAL297;
  for(const key of ['id',...required]){const d=Object.getOwnPropertyDescriptor(actor,key);if(!d?.enumerable||!Object.hasOwn(d,'value'))return false;}
  for(const key of optional){const d=Object.getOwnPropertyDescriptor(actor,key);if(d&&(!d.enumerable||!Object.hasOwn(d,'value')))return false;}
  return true;
 }catch{return false;}
}
/** Actual SIM actor passes only, inside the exclusive deserialized owner.
 * The cold shape check is retained across ordinary assignments/deletions;
 * these writers cannot create accessors or change enumerability/prototypes.
 * Public calls revoke the witness instead of enrolling mutable caller data. */
export function markActorRecordSource297(kind:Kind297,actor:object):void {
 const owner=terrainJournalReadOwner();if(!owner){shapes.delete(actor);return;}
 const before=shapes.get(actor);if(before?.owner===owner&&before.generation===generation&&before.kind===kind)return;
 if(!ordinaryShape(kind,actor)){shapes.delete(actor);return;}
 const proof=Object.freeze({}) as ActorRecordSourceShape297,source:Shape={actor,kind,owner,generation,proof};shapes.set(actor,source);proofs.set(proof,source);
}
export function invalidateActorRecordSources297():void {generation={};}
/** Descriptor transactions explicitly retire any old record witness before
 * defining fields. A later genuine SIM pass may discover the new own data. */
export function revokeActorRecordSource297(actor:object):void {shapes.delete(actor);}
export function actorRecordSourceShape297(kind:Kind297,actor:object,owner:object):ActorRecordSourceShape297|undefined {
 const source=shapes.get(actor);return source?.owner===owner&&source.generation===generation&&source.kind===kind?source.proof:undefined;
}
export function admitsActorRecordSource297(proof:ActorRecordSourceShape297|undefined,kind:Kind297,actor:object):boolean {
 const source=proof&&proofs.get(proof);return !!source&&source.actor===actor&&source.kind===kind&&source.generation===generation&&shapes.get(actor)===source;
}
export function verifyActorRecordSource297(proof:ActorRecordSourceShape297):boolean {
 const source=proofs.get(proof);return !!source&&source.generation===generation&&shapes.get(source.actor)===source&&ordinaryShape(source.kind,source.actor);
}
