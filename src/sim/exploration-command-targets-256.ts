/** Local information admission before a guessed Thing ID can invoke its
 * normal command handler. This never changes AI navigation or permission. */
import {explorationEnabled256} from './exploration-state-256.ts';
import {knownCell256,knownSpawnedThing256} from './exploration-visibility-256.ts';
import {footprintCells} from './definitions.ts';
import {isColonist} from './affiliation.ts';
import {firePosition} from './fire-rules.ts';
import type {World,Cell} from './types.ts';
import { structureById } from './structure-navigation.ts';
const KEYS=['casketId','structureId','resourceId','pileId','itemId','animalId','bedId','markerId','fireId','patientId','targetId'] as const;
/** Inventory/control/policy commands remain legal. Actual ground Things and
 * foreign spawned actors require a known occupied cell. Own colonist care
 * stays available from the colony's existing global health controls. */
export function hiddenExplorationCommandTarget256(world:World,command:object):boolean {
 if(!explorationEnabled256(world))return false;
 const known=(c:Cell)=>knownCell256(world,c.z*world.width+c.x);
 const value=(owner:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(owner,key);return d&&Object.hasOwn(d,'value')?d.value:undefined;};
 const hidden=(raw:unknown):boolean=>{
  if(typeof raw!=='number'||!Number.isSafeInteger(raw)||raw<1)return false;
  const id=raw,s=structureById(world,id);
  if(s)return !knownSpawnedThing256(world,footprintCells(s).map(c=>c.z*world.width+c.x));
  const r=world.resources.find(r=>r.id===id);if(r)return !known(r);
  const pile=world.piles.find(p=>p.id===id);if(pile)return pile.owner.type==='ground'&&!known(pile.owner);
  const pack=world.packed.find(p=>p.building.id===id);if(pack)return pack.owner.type==='ground'&&!known(pack.owner);
  const p=world.pawns.find(p=>p.id===id);if(p)return !isColonist(p)&&!known(p);
  const a=world.wildlife?.animals.find(a=>a.id===id)??world.mechanoids?.find(m=>m.id===id);if(a)return !known(a);
  const fire=world.fires?.items.find(f=>f.id===id);if(fire){const c=firePosition(world,fire);return !!c&&!known(c);}
  return false;
 };
 for(const key of KEYS)if(hidden(value(command,key)))return true;
 if(Number(world.schemaVersion)>=378){
  // Future orders use distinct typed targets, including nested haul and
  // casket patients. Check the Things themselves, not the queue wrapper.
  // Job coordinates remain player designations (including blind mining).
  for(const key of ['bookId','bodyPawnId','graveId','traderId','consoleId'])if(hidden(value(command,key)))return true;
  const kind=value(command,'type');
  if(kind==='order-haul'){
   const target=value(command,'target');if(target&&typeof target==='object'&&(hidden(value(target,'pileId'))||hidden(value(target,'structureId'))))return true;
  }
  if(kind==='order-carry-ship-casket'){
   const patient=value(command,'patient');if(patient&&typeof patient==='object'&&hidden(value(patient,'id')))return true;
  }
 }
 return false;
}
