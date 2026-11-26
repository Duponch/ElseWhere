import {appendPileEntries,filterPileEntries} from './pile-identity-directory.ts';
import { learnSkill,type SkillRecord } from './skills.ts';
import { pawnBody } from './health-rules.ts';
import { craftingSkill } from './crafting-quality.ts';
import { roundYield } from './cooking-statistics.ts';
import { healthRandom } from './health.ts';
import { refreshStock } from './materials.ts';
import { MECH_CORPSE_ITEMS } from './items.ts';
import { mechanoidDefinition } from './mechanoid-definition.ts';
import type { CookingBill } from './cooking-types.ts';
import type { ProductionContext } from './production-output.ts';
import type { Pawn,World } from './types.ts';

export type MechSalvageRecipe='smash-mechanoid'|'shred-mechanoid';
export const isMechSalvageRecipe=(v:unknown):v is MechSalvageRecipe=>v==='smash-mechanoid'||v==='shred-mechanoid';
export function completedMechSalvageSkill(p:Pawn,workTicks:number):SkillRecord {
  const skill={...craftingSkill(p)};learnSkill(skill,workTicks*1000,{...p,skills:{...p.skills,crafting:skill}});return skill;
}
export function mechSalvageSpeed(p:Pawn):number {
  const c=pawnBody(p).capacities;
  return Math.max(.1,(.4+.06*craftingSkill(p).level)*c.manipulation*(.6+.4*Math.min(1,c.sight)));
}
export function mechSalvageEfficiency(p:Pawn):number {
  const c=pawnBody(p).capacities;
  return Math.max(0,Math.min(1.5,(.75+.025*craftingSkill(p).level)*(.1+.9*c.manipulation)*(.6+.4*Math.min(1,c.sight))));
}
/** Steel yield is independent of missing anatomy. Both roundings always draw. */
export function mechSalvageYield(p:Pawn,random:()=>number):number {
  return roundYield(roundYield(15*mechSalvageEfficiency(p),random),random);
}
export function finishMechSalvage(w:World,p:Pawn,bill:CookingBill,context:ProductionContext):boolean {
  const task=p.cooking;if(!task||!isMechSalvageRecipe(task.recipe)||task.ingredients.length!==1)return false;
  const corpse=w.piles.find(pile=>pile.id===task.ingredients[0]!.pileId);
  if(!corpse?.mechCorpse||!MECH_CORPSE_ITEMS.some(item=>item===corpse.item)||corpse.item!==`${corpse.mechCorpse.mechKind}-corpse`
    ||corpse.quantity!==1||corpse.owner.type!=='ground')return false;
  const skill=completedMechSalvageSkill(p,task.workTicks??0),worker={...p,skills:{...p.skills,crafting:skill}};
  const random={rng:w.rng},quantity=mechSalvageYield(worker,()=>healthRandom(random));
  const ledger=w.mechSalvage??{completed:0,steel:0};
  if(!Number.isSafeInteger(ledger.completed+1)||!Number.isSafeInteger(ledger.steel+quantity)
    ||quantity>0&&(!Number.isSafeInteger(w.nextId+1)||w.piles.some(pile=>pile.owner.type==='pawn'&&pile.owner.pawnId===p.id)))return false;
  // Consuming the whole corpse frees its pile slot; one steel output needs no new ground cell.
  w.piles=filterPileEntries(w.piles,pile=>pile!==corpse);w.rng=random.rng;p.skills.crafting=skill;
  w.mechSalvage={completed:ledger.completed+1,steel:ledger.steel+quantity};
  if(quantity){
    const id=w.nextId++;appendPileEntries(w.piles,{id,item:'steel',kind:'steel',quantity,owner:{type:'pawn',pawnId:p.id}});
    task.ingredients=[];task.productId=id;task.phase='output';task.progress=0;task.storageId=null;
    delete task.workTicks;delete task.storageQuantity;
  }else {p.cooking=null;if(p.orders.active==='cook')p.orders.active=null;p.state='idle';}
  p.path=[];p.planCooldown=0;if(bill.mode==='times')bill.target=Math.max(0,bill.target-1);
  refreshStock(w);context.event(`${p.name} a récupéré ${quantity} acier dans une carcasse de ${mechanoidDefinition(corpse.mechCorpse.mechKind).label}.`);
  return true;
}
