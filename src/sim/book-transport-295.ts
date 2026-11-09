import {SCHEMA_VERSION} from './types.ts';
import {validNovelPile295,validReadingPawnFields295,validReadingTask295} from './book-save-295.ts';
import {isDiningSeat,isDiningTable} from './dining.ts';
import {adjacentToTable} from './recreation-space.ts';
import {animalContentsOwner256} from './animal-local-contents-256.ts';
import type {World} from './types.ts';

/** Physical local join AFTER a delta's inherited piles have been resolved.
 * Only actors, piles and furniture are read; never the terrain or navigation.
 * A reservation is a reference to the one existing exemplar, not another item. */
export function validReadingWorld295(world:World):boolean {
 try{
  const version=Number(world.schemaVersion);if(!Number.isSafeInteger(version)||version<1||version>SCHEMA_VERSION)return false;
  const piles=new Map<number,World['piles'][number]>();
  for(const pile of world.piles){
   if(!validNovelPile295(pile,version))return false;
   if(pile.kind==='book'){
    if(piles.has(pile.id)||pile.id>=world.nextId)return false;const owner=pile.owner;
    if(owner.type==='ground'){if(owner.x>=world.width||owner.z>=world.height)return false;}
    else if(owner.type==='pawn'||owner.type==='inventory'){if(!world.pawns.some(p=>p.id===owner.pawnId)&&!(owner.type==='inventory'&&animalContentsOwner256(world,owner.pawnId)))return false;}
    else if(owner.type==='orbital-ship'){if(!world.orbital?.ships.some(s=>s.id===owner.shipId))return false;}
    else if(owner.type==='orbital-cargo'){if(!world.orbital?.pending.some(s=>s.id===owner.deliveryId))return false;}
    else if(owner.type==='starting-pod'){if(!world.startingArrival||!('pods'in world.startingArrival)||!world.startingArrival.pods.some(s=>s.id===owner.podId))return false;}
    else return false;
    piles.set(pile.id,pile);
   }
  }
  const claimed=new Set<number>(),seats=new Set<number>();
  for(const pawn of world.pawns){
   if(!validReadingPawnFields295(pawn,version))return false;
   const task=pawn.recreation?.task;if(task?.activity!=='read')continue;
   if(!validReadingTask295(task,version)||claimed.has(task.bookId)||task.target.x>=world.width||task.target.z>=world.height)return false;
   claimed.add(task.bookId);
   const book=piles.get(task.bookId);if(!book)return false;
   const held=(book.owner.type==='pawn'||book.owner.type==='inventory')&&book.owner.pawnId===pawn.id;
   if(task.stage==='pickup'){
    if(book.owner.type!=='ground'&&!held)return false;
    if(book.owner.type==='ground'&&Math.abs(book.owner.x-task.target.x)+Math.abs(book.owner.z-task.target.z)>1)return false;
   }else if(book.owner.type!=='pawn'||book.owner.pawnId!==pawn.id)return false;
   if(task.phase==='travel') {if(pawn.state!=='moving')return false;}
   else if(pawn.state!==(task.stage==='read'?'recreating':'idle')||pawn.path.length>0||task.stage==='read'&&pawn.moveCooldown>0||pawn.x!==task.target.x||pawn.z!==task.target.z)return false;
   if(pawn.jobId!==null||pawn.haul||pawn.need||pawn.cooking||pawn.research||pawn.tend||pawn.rescue||pawn.feed||pawn.equipmentTask||pawn.surgery||pawn.brewing||pawn.firefoamTask290||pawn.coupleTask285)return false;
   if(task.seatId!==undefined){
    const seat=world.structures.find(s=>s.id===task.seatId&&isDiningSeat(s.kind));
    if(!seat||seats.has(seat.id)||seat.x!==task.target.x||seat.z!==task.target.z)return false;seats.add(seat.id);
   }
   if(task.buildingId!==null&&!world.structures.some(s=>s.id===task.buildingId&&isDiningTable(s.kind)&&adjacentToTable(s,task.target)))return false;
  }
  return true;
 }catch{return false;}
}
