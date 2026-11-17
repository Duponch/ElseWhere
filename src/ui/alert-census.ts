import {APPAREL,apparelInsulation,type ApparelItem} from '../sim/apparel-rules';
import {isMedicine} from '../sim/medicine-rules';
import {storageCells} from '../sim/shelf-storage';
import type {World} from '../sim/types';
import {knownPile256} from './exploration-readers-256';

/** What one wearer has on, read once for every alert of a reading. */
export interface WornApparelSummary {
  /** Lowest hit-point ratio of the worn pieces (1 with nothing worn), as the
   * damaged-apparel mood thought reads it. */
  readonly condition:number;
  /** Comfortable minimum with the worn pieces: 16 °C minus each piece's cold
   * insulation, subtracted in pile order exactly as comfortableTemperature. */
  readonly comfyMin:number;
}

/** Shared per-reading aggregates of the alert readers. One pass over the
 * storage cells and at most one pass over the piles per question, built
 * lazily on the first reader that needs it and dropped with the reading.
 * Pure: the World is never changed and nothing is cached across readings, so
 * a World mutated in place between two readings is read afresh. */
export class AlertCensus {
  private stored?:ReadonlySet<number>;
  private worn?:ReadonlyMap<number,WornApparelSummary>;
  private medicine?:number;
  constructor(readonly world:World){}
  /** Cell indices of the stockpile zones and player shelves (Core slot groups). */
  storedCells():ReadonlySet<number> {
    const w=this.world;
    return this.stored??=new Set(storageCells(w).map(cell=>cell.z*w.width+cell.x));
  }
  /** Core ResourceCounter Medicine group: medicine items kept in storage,
   * counted by item, on known cells. */
  storedMedicine():number {
    if(this.medicine!==undefined)return this.medicine;
    const w=this.world;let count=0,stored:ReadonlySet<number>|undefined;
    for(const pile of w.piles){
      if(pile.owner.type!=='ground'||pile.quantity<=0||!isMedicine(pile.item))continue;
      stored??=this.storedCells();
      if(stored.has(pile.owner.z*w.width+pile.owner.x)&&knownPile256(w,pile))count+=pile.quantity;
    }
    return this.medicine=count;
  }
  /** Worn apparel of every wearer, one pass over the piles in array order. */
  wornApparel():ReadonlyMap<number,WornApparelSummary> {
    if(this.worn)return this.worn;
    const out=new Map<number,{condition:number;comfyMin:number}>();
    for(const pile of this.world.piles){
      if(pile.owner.type!=='apparel')continue;
      const id=pile.owner.pawnId;let entry=out.get(id);
      if(!entry){entry={condition:1,comfyMin:16};out.set(id,entry);}
      const definition=APPAREL[pile.item as ApparelItem];
      if(definition&&pile.apparel)entry.condition=Math.min(entry.condition,pile.apparel.hitPoints/definition.hitPoints);
      entry.comfyMin-=apparelInsulation(pile).cold;
    }
    return this.worn=out;
  }
}
