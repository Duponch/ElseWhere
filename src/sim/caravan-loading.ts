import {assignPileOwner} from './pile-index.ts';
import { candidateAccess } from './candidate-access.ts';
import { refreshStock,reservedSource } from './materials.ts';
import { groundCapacity,groundPile } from './ground-placement.ts';
import { copyPileCondition } from './pile-condition.ts';
import { adjacent,blockedCells,routeToCell,routeToJob } from './pathfinding.ts';
import { visitorAtEdge,visitorExit } from './visitor-navigation.ts';
import { departureReason,scoutEligible,scoutPreparationReason,scoutUnloadEligible } from './caravan-trip.ts';
import type { ScoutCommand } from './caravan-state.ts';
import type { NeedContext } from './needs.ts';
import type { Cell,CommandResult,Pawn,World } from './types.ts';

const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const same=(a:Cell,b:Cell):boolean=>a.x===b.x&&a.z===b.z;
const atPile=(p:Pawn,c:Cell):boolean=>same(p,c)||adjacent(p,c);

/** Cancelling never unloads the personal inventory or jumps across an active
 * movement edge. The next ordinary tick may resume the person's needs. */
function cancelPreparation(w:World,p:Pawn):void {
  delete w.scout;
  p.path=[];
  p.planCooldown=0;
  if(p.state!=='dead'&&p.state!=='downed')p.state='idle';
}

/** This command is deliberately narrow: it waits for a completely free actor
 * and checks source and both route legs before reserving anything. */
export function applyScoutCommand(w:World,c:ScoutCommand):CommandResult {
  if(c.type==='scout-unload'){
    const p=w.pawns.find(p=>p.id===c.pawnId);
    if(!p)return fail('Colon introuvable.');
    const ineligible=scoutUnloadEligible(w,p);
    if(ineligible)return fail(ineligible);
    const carried=w.piles.filter(i=>i.owner.type==='inventory'&&i.owner.pawnId===p.id);
    const pile=carried[0];
    if(carried.length!==1||!pile||pile.kind!=='food'||pile.item!=='survival-meal'||pile.quantity<1||pile.quantity>3||pile.foodPoison)
      return fail('Le colon doit porter une unique pile saine de un à trois repas de survie.');
    const cell={x:p.x,z:p.z};
    if(groundPile(w,cell)||w.packed.some(i=>i.owner.type==='ground'&&same(i.owner,cell))
      ||groundCapacity(w,cell,pile,p.id)<pile.quantity)
      return fail('La case du colon ne peut accueillir cette pile entière.');
    assignPileOwner(pile,{type:'ground',...cell});
    refreshStock(w);
    return {ok:true};
  }
  if(c.type==='scout-cancel'){
    const s=w.scout;
    if(!s||s.phase!=='loading'&&s.phase!=='leaving')return fail('Aucune préparation de reconnaissance à annuler.');
    const p=w.pawns.find(p=>p.id===s.pawnId);
    if(!p)return fail('Le colon préparant la reconnaissance a disparu.');
    cancelPreparation(w,p);
    return {ok:true};
  }
  if(c.quantity!==2&&c.quantity!==3)return fail('Choisissez deux ou trois repas de survie.');
  const p=w.pawns.find(p=>p.id===c.pawnId);
  if(!p)return fail('Colon introuvable.');
  const ineligible=scoutEligible(w,p);
  if(ineligible)return fail(ineligible);
  const source=w.piles.find(pile=>pile.id===c.pileId);
  if(!source||source.owner.type!=='ground'||source.kind!=='food'||source.item!=='survival-meal'||source.foodPoison)
    return fail('Choisissez une pile saine de repas de survie au sol.');
  if(source.quantity-reservedSource(w,source.id)<c.quantity)return fail('La quantité libre de cette pile est insuffisante.');
  if(source.quantity>c.quantity&&(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)))return fail('Aucune identité disponible pour diviser cette pile.');
  const access=candidateAccess(w,p,blockedCells(w),new Set());
  const path=routeToJob(w,source.owner,access,true);
  if(!path||!visitorExit(w,p))return fail('La pile et une sortie de carte doivent être réellement accessibles.');
  w.scout={phase:'loading',pawnId:p.id,sourcePileId:source.id,quantity:c.quantity,startedAt:w.tick};
  p.path=path;
  p.planCooldown=0;
  p.state=path.length?'moving':'working';
  return {ok:true};
}

/** Physical pickup and walk to a reachable map edge. The engine owns movement
 * cadence and invokes departure only after this pawn finishes its last edge. */
export function processScoutLoading(w:World,p:Pawn,ctx:NeedContext):boolean {
  const s=w.scout;
  if(!s||s.phase!=='loading'&&s.phase!=='leaving'||s.pawnId!==p.id)return false;
  if(scoutPreparationReason(w,p)){
    cancelPreparation(w,p);
    return false;
  }
  if(p.moveCooldown>0)return true;
  if(s.phase==='loading'){
    const source=w.piles.find(pile=>pile.id===s.sourcePileId);
    if(!source||source.owner.type!=='ground'||source.kind!=='food'||source.item!=='survival-meal'||source.foodPoison
      ||source.quantity-reservedSource(w,source.id,p.id)<s.quantity){cancelPreparation(w,p);return false;}
    if(!atPile(p,source.owner)){
      if(!p.path.length&&routeToJob(w,source.owner,candidateAccess(w,p,blockedCells(w),new Set()),true)===null){cancelPreparation(w,p);return false;}
      ctx.move(source.owner,false);
      return true;
    }
    if(source.quantity>s.quantity&&(w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1))){cancelPreparation(w,p);return false;}
    let foodPileId:number;
    if(source.quantity===s.quantity){
      assignPileOwner(source,{type:'inventory',pawnId:p.id});
      foodPileId=source.id;
    }else{
      source.quantity-=s.quantity;
      foodPileId=w.nextId++;
      w.piles.push({id:foodPileId,kind:'food',item:'survival-meal',quantity:s.quantity,
        owner:{type:'inventory',pawnId:p.id},...copyPileCondition(source)});
    }
    refreshStock(w);
    w.scout={phase:'leaving',pawnId:p.id,foodPileId,quantity:s.quantity,startedAt:s.startedAt,exit:null};
    p.path=[];
    p.planCooldown=0;
    p.state='moving';
    return true;
  }
  const food=w.piles.find(pile=>pile.id===s.foodPileId);
  if(!food||food.owner.type!=='inventory'||food.owner.pawnId!==p.id||food.item!=='survival-meal'||food.quantity!==s.quantity||food.foodPoison){cancelPreparation(w,p);return false;}
  if(s.exit&&same(p,s.exit)&&visitorAtEdge(w,p)){
    p.path=[];
    p.state='idle';
    if(departureReason(w,p)){cancelPreparation(w,p);return false;}
    return true;
  }
  if(!s.exit||!p.path.length){
    const exit=visitorExit(w,p);
    if(!exit){cancelPreparation(w,p);return false;}
    const path=routeToCell(w,exit,candidateAccess(w,p,blockedCells(w),new Set()));
    if(!path){cancelPreparation(w,p);return false;}
    s.exit=exit;
    p.path=path;
  }
  if(!s.exit){cancelPreparation(w,p);return false;}
  if(same(p,s.exit)){
    p.path=[];
    p.state='idle';
    if(departureReason(w,p)){cancelPreparation(w,p);return false;}
    return true;
  }
  ctx.move(s.exit,true);
  return true;
}
