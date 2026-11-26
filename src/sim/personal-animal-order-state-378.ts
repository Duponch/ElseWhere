import type {Pawn} from './types.ts';

export type PersonalAnimalAction378='hunt'|'tame'|'slaughter';
export type PersonalAnimalOrderCommand378={type:'order-animal-378';pawnId:number;animalId:number;action:PersonalAnimalAction378;queue:boolean};

/** The real hunting or handling task owns the order. Releasing that task
 * retires the direct intent without a parallel actor owner. */
export function isForcedPersonalAnimalOrder378(pawn:Pawn):boolean {
  return pawn.hunting?.forced378===true||pawn.animalHandling?.forced378===true
    &&(pawn.animalHandling.kind==='tame'||pawn.animalHandling.kind==='slaughter');
}
