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
 for(const key of KEYS){
  const field=Object.getOwnPropertyDescriptor(command,key);if(!field||!Object.hasOwn(field,'value')||!Number.isSafeInteger(field.value)||field.value<1)continue;
  const id=field.value as number,s=structureById(world,id);
  if(s){if(!knownSpawnedThing256(world,footprintCells(s).map(c=>c.z*world.width+c.x)))return true;continue;}
  const r=world.resources.find(r=>r.id===id);if(r){if(!known(r))return true;continue;}
  const pile=world.piles.find(p=>p.id===id);if(pile){if(pile.owner.type==='ground'&&!known(pile.owner))return true;continue;}
  const pack=world.packed.find(p=>p.building.id===id);if(pack){if(pack.owner.type==='ground'&&!known(pack.owner))return true;continue;}
  const p=world.pawns.find(p=>p.id===id);if(p){if(!isColonist(p)&&!known(p))return true;continue;}
  const a=world.wildlife?.animals.find(a=>a.id===id)??world.mechanoids?.find(m=>m.id===id);if(a){if(!known(a))return true;continue;}
  const fire=world.fires?.items.find(f=>f.id===id);if(fire){const c=firePosition(world,fire);if(c&&!known(c))return true;}
 }
 return false;
}
