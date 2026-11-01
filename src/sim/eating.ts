import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {localIngestionCore299,commitHumanIngestion299,selfFoodPermission299} from './human-ingestion-clock299.ts';
import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {beerPile265,completeAlcoholInventory265,takeOwnedBeer265,ingestBeer265} from './alcohol-ingestion-265.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { copyPileCondition } from './pile-condition.ts';
import { ingestFoodRisk } from './food-hygiene.ts';
import { physicalEatingFactor,pawnBody } from './health-rules.ts';
import { advanceWork } from './work-progress.ts';
import { nutritionOf, ITEM_DEFINITIONS, rawFoodThought } from './items.ts';
import { adjacent } from './pathfinding.ts';
import { reservedSource } from './materials.ts';
import { adjacentTable, chooseDiningPlace, validDiningPlace } from './dining.ts';
import { rememberMeal } from './wellbeing.ts';
import { pasteRequestValid,dispensePasteAtContact,PASTE_COLLECT_TICKS } from './nutrient-paste.ts';
import { consumeActivityValid,consumeContactValid } from './consuming.ts';
import { interruptDraftWork } from './drafting.ts';
import type { NeedContext } from './needs.ts';
import type { Pawn, World } from './types.ts';

export const INGEST_TICKS = 50;
export const PORTION_NUTRITION = 35;

export function processEating(world: World, pawn: Pawn, context: NeedContext): void {
  const task = pawn.need;
  if (task?.kind !== 'eat') return;
  // Only the explicit mode acquires this interruption contract. Automatic
  // eating keeps its historical release, location choice and resolution.
  const release=()=>{if(task.forced)interruptDraftWork(world,pawn);else context.release();};
  const alcohol=isSchema265OrLater(world.schemaVersion)&&task.alcoholReason!==undefined;
  const ignoreFoodForbidden299=isSchema299OrLater(Number(world.schemaVersion))&&task.foodBinge299===true;
  if(alcohol){
    const body=pawnBody(pawn);
    // Recheck after every health transition, before pickup, inventory transfer
    // or ingestion work. Hard interruption retains any in-flight cargo and
    // otherwise drops the same held unit; it never creates a dose.
    if(body.capacities.eating<=0||body.capacities.manipulation<=0){interruptDraftWork(world,pawn);return;}
  }
  if(task.forced&&!consumeActivityValid(world,pawn)){release();return;}
  if(task.forced&&(pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick))return;
  const ownBeer=isSchema265OrLater(world.schemaVersion)&&task.alcoholReason!==undefined&&task.alcoholReason!=='inventory'&&task.phase==='pickup'&&world.piles.some(p=>p.id===task.sourcePileId&&p.owner.type==='inventory'&&p.owner.pawnId===pawn.id&&beerPile265(p));
  if(!ownBeer&&task.alcoholReason!=='binge'&&!allowedAreaServicesAllowed(world,pawn)){release();return;}
  if(task.phase==='pickup'&&task.paste){
    if(!pasteRequestValid(world,pawn,task.paste)){release();return;}
    const spot=task.paste.spot;
    if(pawn.x!==spot.x||pawn.z!==spot.z){context.move(spot,true);return;}
    if(pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick||(pawn.stun?.untilCore??0)>world.tick*10)return;
    const meal=dispensePasteAtContact(world,pawn,task.paste);
    if(!meal){release();return;}
    task.carryPileId=meal.id;task.phase='collect';pawn.path=[];pawn.state='moving';return;
  }
  const pile = world.piles.find(item => item.id === (task.phase === 'pickup' ? task.sourcePileId : task.carryPileId));
  if (!pile || !(alcohol?beerPile265(pile):pile.kind==='food')||task.alcoholReason!=='binge'&&!selfFoodPermission299(pile,ignoreFoodForbidden299)) { release(); return; }
  if(alcohol&&(task.paste||task.phase==='collect'||(task.alcoholReason==='inventory'?(task.phase!=='pickup'||task.quantity<1||task.quantity>3):task.quantity!==1))){release();return;}
  if (task.phase === 'pickup') {
    if(alcohol&&pile.owner.type==='inventory'){if(!takeOwnedBeer265(world,pawn,pile,task))release();return;}
    if (pile.owner.type !== 'ground' || reservedSource(world, pile.id) > pile.quantity) { release(); return; }
    if(task.forced&&!consumeContactValid(world,pawn)){
      const contact=pawn.path.at(-1);
      if(contact&&consumeContactValid(world,pawn,contact)
        &&(contact.x===pile.owner.x&&contact.z===pile.owner.z||adjacent(contact,pile.owner)))context.move(contact,true);
      else release();
      return;
    }
    if ((pawn.x !== pile.owner.x || pawn.z !== pile.owner.z) && !adjacent(pawn, pile.owner)) { context.move(pile.owner, false); return; }
    if(alcohol&&task.alcoholReason==='inventory'){if(!completeAlcoholInventory265(world,pawn,pile,task))release();return;}
    if (pile.quantity === task.quantity) {
      pile.owner = { type: 'pawn', pawnId: pawn.id }; task.carryPileId = pile.id;
    } else {
      if (world.piles.length >= 32768 || !Number.isSafeInteger(world.nextId + 1)) { release(); return; }
      pile.quantity -= task.quantity; task.carryPileId = world.nextId++;
      world.piles.push({ id: task.carryPileId, kind: pile.kind, item: pile.item, quantity: task.quantity, owner: { type: 'pawn', pawnId: pawn.id }, ...copyPileCondition(pile) });
    }
    task.phase = 'choose-spot'; pawn.path = []; pawn.state = 'moving'; pawn.needCooldown = 0;
    return;
  }
  if (pile.owner.type !== 'pawn' || pile.owner.pawnId !== pawn.id || pile.quantity !== task.quantity) { release(); return; }
  if(task.phase==='collect'){
    pawn.path=[];pawn.state='moving';
    if(!task.paste||task.paste.producedAt===undefined){release();return;}
    if(world.tick-task.paste.producedAt<PASTE_COLLECT_TICKS)return;
    task.phase='choose-spot';
  }
  if (task.dining && !validDiningPlace(world, task.dining)) {
    task.phase = 'choose-spot'; task.dining = null; task.progress = 0;delete task.workRemainder;
    pawn.path = []; pawn.state = 'moving'; pawn.needCooldown = 0;
  }
  if (task.phase === 'choose-spot') {
    const choice=task.forced&&pawn.draft
      ?consumeContactValid(world,pawn)?{place:{target:{x:pawn.x,z:pawn.z},seatId:null,tableId:adjacentTable(world,pawn)?.id??null},path:[]}:null
      :chooseDiningPlace(world, pawn, context,alcohol);
    if (!choice) {if(task.forced&&pawn.draft)release();return;}
    if(task.forced&&!consumeContactValid(world,pawn,choice.place.target)){release();return;}
    task.dining = choice.place; task.phase = 'travel'; pawn.path = choice.path;
  }
  if (!task.dining) { release(); return; }
  if(task.forced&&(!consumeContactValid(world,pawn,task.dining.target)
    ||(pawn.draft||task.phase==='ingest')&&(pawn.x!==task.dining.target.x||pawn.z!==task.dining.target.z))){release();return;}
  if (task.phase === 'travel') {
    if (pawn.x !== task.dining.target.x || pawn.z !== task.dining.target.z) { context.move(task.dining.target, true); return; }
    task.phase = 'ingest'; pawn.path = []; pawn.state = 'eating';
    // The surface is checked on arrival and again at completion, never remotely.
    task.dining.tableId = adjacentTable(world, pawn)?.id ?? null;
    return;
  }
  pawn.state = 'eating';
  advanceWork(task,physicalEatingFactor(pawn));
  if (task.progress >= INGEST_TICKS) {
    const ingestedAt299=localIngestionCore299(world,pawn);
    world.piles.splice(world.piles.indexOf(pile), 1);
    pawn.hunger = Math.min(100, pawn.hunger + nutritionOf(pile));
    commitHumanIngestion299(pawn,ingestedAt299);
    if(alcohol){
      pawn.need=null;pawn.state='idle';pawn.planCooldown=0;pawn.needCooldown=0;if(task.forced)pawn.orders.active=null;
      ingestBeer265(world,pawn);context.event(`${pawn.name} a bu une bière.`);return;
    }
    const atTable = adjacentTable(world, pawn) !== null;
    rememberMeal(world, pawn, atTable, rawFoodThought(pile.item), pile.item);
    pawn.need = null; pawn.state = 'idle'; pawn.planCooldown = 0; pawn.needCooldown = 0;
    if(task.forced)pawn.orders.active=null;
    context.event(`${pawn.name} a mangé une portion (${task.quantity} × ${ITEM_DEFINITIONS[pile.item].label}) ${atTable ? 'à table' : 'sans table'}.`);
    ingestFoodRisk(world,pawn,pile);
  }
}
