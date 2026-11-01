import {localIngestionCore299,commitHumanIngestion299} from './human-ingestion-clock299.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { workPriority } from './work-types.ts';
import { bedsideAccess } from './care-access.ts';
import { FEED_TICKS,feedingReason,feedingPlaceValid,feedingWork,type FeedTask } from './feeding-rules.ts';
import { copyPileCondition } from './pile-condition.ts';
import { ingestFoodRisk } from './food-hygiene.ts';
import { selectFoodSource } from './food-selection.ts';
import { pasteRequestValid,dispensePasteAtContact,PASTE_COLLECT_TICKS } from './nutrient-paste.ts';
import { mealQuantity,nutritionOf,ITEM_DEFINITIONS,rawFoodThought } from './items.ts';
import { reservedSource } from './materials.ts';
import { adjacent,blockedCells,reachableCells,type Reachability } from './pathfinding.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { planCommandDrops,releaseWork } from './work-release.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { updatePawnHealth } from './health.ts';
import {medicalCivilTick271} from './suspended-human-clock-271.ts';
import { rememberMeal } from './wellbeing.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';

export function feedingProposal(world:World,doctor:Pawn,patient:Pawn,reach:Reachability):{task:FeedTask;path:Cell[]}|undefined {
  if(feedingReason(world,doctor,patient))return;
  const sources=world.piles.filter(p=>p.kind==='food'&&p.owner.type==='ground'&&p.quantity>reservedSource(world,p.id));
  const access=bedsideAccess(world,doctor,patient,reach);if(!access)return;
  const food=selectFoodSource(world,doctor,sources,reach,patient);if(!food)return;
  if(food.kind==='paste')return {task:{patientId:patient.id,spot:access.spot,sourcePileId:null,carryPileId:null,quantity:1,phase:'pickup',progress:0,paste:food.request},path:food.path};
  const pile=sources.find(p=>p.id===food.id)!;
  return {task:{patientId:patient.id,spot:access.spot,sourcePileId:pile.id,carryPileId:null,quantity:mealQuantity(patient,pile,pile.quantity-reservedSource(world,pile.id)),phase:'pickup',progress:0},path:food.path};
}
export function startFeeding(doctor:Pawn,proposal:{task:FeedTask;path:Cell[]},forced=false):void {
  doctor.feed=proposal.task;doctor.path=proposal.path;doctor.state='moving';doctor.planCooldown=0;if(forced)doctor.orders.active='feed';
}
export function applyFeeding(world:World,command:{pawnId:number;patientId:number;queue:boolean}):CommandResult {
  const doctor=world.pawns.find(p=>p.id===command.pawnId),patient=world.pawns.find(p=>p.id===command.patientId);
  const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(!doctor||!patient||typeof command.queue!=='boolean')return fail('Colon ou patient introuvable.');
  if(command.queue)return fail('La file d’alimentation assistée n’est pas encore disponible.');
  const reason=feedingReason(world,doctor,patient);if(reason)return fail(reason);
  const proposal=feedingProposal(world,doctor,patient,reachableCells(world,doctor,blockedCells(world),new Set()));
  if(!proposal)return fail('Aucun aliment autorisé disponible ou aucun accès à la nourriture et au chevet.');
  const drops=planCommandDrops(world,{type:'order-feed',...command});if(!drops||!releaseWork(world,doctor,drops))return fail('Pas de place pour déposer la cargaison.');
  clearQueuedOrders(world,doctor);delete doctor.priorityWork;startFeeding(doctor,proposal,true);return {ok:true};
}
export function reconcileFeeding(world:World):void {
  for(const d of world.pawns)if(d.feed){
    const t=d.feed,p=world.pawns.find(p=>p.id===t.patientId),food=world.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
    const sourceValid=t.phase==='pickup'&&t.paste?!!p&&pasteRequestValid(world,d,t.paste,p):!!food&&food.kind==='food'
      &&(t.phase==='pickup'?food.owner.type==='ground'&&reservedSource(world,food.id)<=food.quantity:food.owner.type==='pawn'&&food.owner.pawnId===d.id&&food.quantity===t.quantity);
    if(!allowedAreaServicesAllowed(world,d)||feedingReason(world,d,p,true)||workPriority(d,feedingWork(p))===0&&d.orders.active!=='feed'||!p||!feedingPlaceValid(world,t,p)||!sourceValid)interruptWork(world,d);
  }
}
export function processFeeding(world:World,doctor:Pawn,context:NeedContext):void {
  if(!allowedAreaServicesAllowed(world,doctor)){interruptWork(world,doctor);return;}
  const t=doctor.feed;if(!t)return;
  const p=world.pawns.find(p=>p.id===t.patientId)!;
  if(p?.health&&medicalCivilTick271(p.health)<world.tick&&!p.health.death)updatePawnHealth(world,p);
  if(feedingReason(world,doctor,p,true)||!feedingPlaceValid(world,t,p)){interruptWork(world,doctor);return;}
  if(t.phase==='pickup'&&t.paste){
    if(!pasteRequestValid(world,doctor,t.paste,p)){interruptWork(world,doctor);return;}
    const spot=t.paste.spot;
    if(doctor.x!==spot.x||doctor.z!==spot.z){context.move(spot,true);return;}
    if(doctor.moveCooldown>0||(doctor.motion?.end??0)>world.tick||(doctor.stun?.untilCore??0)>world.tick*10)return;
    const meal=dispensePasteAtContact(world,doctor,t.paste,p);
    if(!meal){interruptWork(world,doctor);return;}
    t.carryPileId=meal.id;t.phase='collect';doctor.path=[];doctor.state='moving';return;
  }
  const food=world.piles.find(p=>p.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
  if(!food||food.kind!=='food'){interruptWork(world,doctor);return;}
  if(t.phase==='pickup'){
    if(!eggAllowedForPlayer256(food)||food.owner.type!=='ground'||reservedSource(world,food.id)>food.quantity){interruptWork(world,doctor);return;}
    if((doctor.x!==food.owner.x||doctor.z!==food.owner.z)&&!adjacent(doctor,food.owner)){context.move(food.owner,false);return;}
    if(food.quantity===t.quantity){food.owner={type:'pawn',pawnId:doctor.id};t.carryPileId=food.id;}
    else {
      if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1)){interruptWork(world,doctor);return;}
      food.quantity-=t.quantity;t.carryPileId=world.nextId++;
      world.piles.push({id:t.carryPileId,kind:'food',item:food.item,quantity:t.quantity,owner:{type:'pawn',pawnId:doctor.id},...copyPileCondition(food)});
    }
    t.phase='deliver';doctor.path=[];doctor.state='moving';return;
  }
  if(!eggAllowedForPlayer256(food)){interruptWork(world,doctor);return;}
  if(food.owner.type!=='pawn'||food.owner.pawnId!==doctor.id||food.quantity!==t.quantity){interruptWork(world,doctor);return;}
  if(t.phase==='collect'){
    doctor.path=[];doctor.state='moving';
    if(!t.paste||t.paste.producedAt===undefined){interruptWork(world,doctor);return;}
    if(world.tick-t.paste.producedAt<PASTE_COLLECT_TICKS)return;
    t.phase='deliver';
  }
  if(doctor.x!==t.spot.x||doctor.z!==t.spot.z){context.move(t.spot,true);return;}
  t.phase='feed';doctor.state='working';doctor.path=[];
  if(++t.progress<FEED_TICKS)return;
  // Anchor health under the old hunger before nutrition changes. Feeding has
  // no Medicine XP and a lying patient gets no new ate-without-table thought.
  const ingestedAt299=localIngestionCore299(world,p);
  world.piles.splice(world.piles.indexOf(food),1);p.hunger=Math.min(100,p.hunger+nutritionOf(food));
  commitHumanIngestion299(p,ingestedAt299);
  rememberMeal(world,p,true,rawFoodThought(food.item),food.item);
  context.event(`${p.name} a mangé une portion (${t.quantity} × ${ITEM_DEFINITIONS[food.item].label}) au lit, avec l’aide de ${doctor.name}.`);
  releaseWork(world,doctor);
  ingestFoodRisk(world,p,food);
}
