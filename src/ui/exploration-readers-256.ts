import {explorationEnabled256} from '../sim/exploration-state-256';
import {isColonist} from '../sim/affiliation';
/** Player knowledge only: never an AI/world/ownership projection. */
import {knownCell256,knownSpawnedThing256} from '../sim/exploration-visibility-256';
import {footprintCells} from '../sim/definitions';
import {colonyPile} from '../sim/materials';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import type {World,Cell,MaterialPile,Structure} from '../sim/types';
export const knownPosition256=(world:World,cell:Cell):boolean=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height&&knownCell256(world,cell.z*world.width+cell.x);
export const knownBuilding256=(world:World,structure:Structure):boolean=>knownSpawnedThing256(world,footprintCells(structure).map(c=>c.z*world.width+c.x));
/** Held inventories remain owned knowledge; unknown ground piles do not. */
export interface KnownPileLookup256 {
 person(id:number):World['pawns'][number]|undefined;
 animal(id:number):NonNullable<World['wildlife']>['animals'][number]|undefined;
 job(id:number):World['jobs'][number]|undefined;
 structure(id:number):Structure|undefined;
}
export function knownPile256(world:World,pile:MaterialPile,lookup?:KnownPileLookup256):boolean {
 if(!explorationEnabled256(world))return true;
 const owner=pile.owner;
 if(owner.type==='ground')return knownPosition256(world,owner);
 if(owner.type==='job'){const job=lookup?lookup.job(owner.jobId):world.jobs.find(j=>j.id===owner.jobId);return !!job&&knownPosition256(world,job);}
 if('pawnId' in owner){
  const id=owner.pawnId,person=lookup?lookup.person(id):world.pawns.find(p=>p.id===id);
  if(person)return isColonist(person)||!!person.prisoner||knownPosition256(world,person);
  // A local animal can be the actual inventory owner (hauling/loading),
  // separately from the human pawn namespace. Its possessions follow the
  // same knowledge rule, never exposing an unknown wild animal in the fog.
  const animal=owner.type==='inventory'?(lookup?lookup.animal(id):world.wildlife?.animals.find(entry=>entry.id===id)):undefined;
  return !!animal&&(!!animal.domestic||knownPosition256(world,animal));
 }
 if(owner.type==='grave'){const id=owner.graveId,grave=lookup?lookup.structure(id):world.structures.find(s=>s.id===id);return !!grave&&knownBuilding256(world,grave);}
 return true;
}
export function knownStockCounts256(world:World):Map<ItemId,number> {
 const counts=new Map<ItemId,number>();for(const pile of world.piles)if(knownPile256(world,pile)&&colonyPile(world,pile))counts.set(pile.item,(counts.get(pile.item)??0)+pile.quantity);return counts;
}
/** Same historical nutrition inclusion, plus prospective ground knowledge. */
export function knownNutrition256(world:World):number {
 let n=0;for(const pile of world.piles){if(!knownPile256(world,pile)||pile.item==='hay'||pile.owner.type==='job'||pile.owner.type==='inventory')continue;
 if(pile.owner.type==='pawn'){const id=pile.owner.pawnId;if(!world.pawns.some(p=>p.id===id&&(p.faction??'colony')==='colony'))continue;}
 n+=ITEM_DEFINITIONS[pile.item].nutrition*pile.quantity;}return n/100;
}
