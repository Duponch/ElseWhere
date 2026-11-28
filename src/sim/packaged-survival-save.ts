import { PACKAGED_SURVIVAL_MEALS_RESEARCH_COST } from './research.ts';
import { cookingSpot } from './cooking-bills.ts';
import type { CookingTask } from './cooking-types.ts';
import { validCookingOrder } from './player-cooking-save.ts';
import { isRecipeProduct,productionWorkTotal,stationAccepts,validSurvivalMealIngredients } from './production-recipes.ts';
import type { Pawn,Structure,World } from './types.ts';
import { storageCellById } from './shelf-storage.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max:number):boolean=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const recipe='cook-survival-meal' as const;
const taskKeys=new Set(['recipe','stationId','billId','spot','actionCell','phase','ingredients','progress','workTicks','productId','storageId','storageQuantity']);
const ingredientKeys=new Set(['pileId','item','quantity','stage','cell']);

/** Only the V206 envelope is checked here. Full reservation, staging capacity
 * and actor-service validation remains with the ordinary save validator. */
function validStation(w:World,c:CookingTask):boolean {
  const station=w.structures.find(s=>s.id===c.stationId),bill=station?.bills?.find(b=>b.id===c.billId);
  if(!station||!stationAccepts(station,recipe)||!bill||bill.recipe!==recipe||bill.suspended||!object(bill.filters))return false;
  const spot=cookingSpot(station);
  return c.spot.x===spot.x&&c.spot.z===spot.z&&c.ingredients.every(i=>bill.filters[i.item]);
}

function validTask(w:World,p:Pawn,c:CookingTask):boolean {
  const cell=(v:unknown)=>object(v)&&Object.keys(v).every(k=>k==='x'||k==='z')&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);
  if(Object.keys(c).some(k=>!taskKeys.has(k))||!integer(c.stationId,1,w.nextId-1)||!integer(c.billId,1,w.nextId-1)
    ||!cell(c.spot)||!cell(c.actionCell)||!['gather','work','output'].includes(c.phase)
    ||!integer(c.progress,0,productionWorkTotal(recipe))||c.storageQuantity!==undefined
    ||c.workTicks!==undefined&&(c.phase!=='work'||!integer(c.workTicks,1,Math.floor(Number.MAX_SAFE_INTEGER/1000)))
    ||!Array.isArray(c.ingredients)||c.ingredients.length>12)return false;
  for(const i of c.ingredients)if(!object(i)||Object.keys(i).some(k=>!ingredientKeys.has(k))
    ||!integer(i.pileId,1,w.nextId-1)||!integer(i.quantity,1,12)||!['source','held','placed'].includes(i.stage)||!cell(i.cell))return false;
  if(!validStation(w,c))return false;
  if(c.phase==='output'){
    if(c.ingredients.length||c.progress!==0||!integer(c.productId,1,w.nextId-1)
      ||c.storageId!==null&&(!integer(c.storageId,1,w.nextId-1)||!storageCellById(w,c.storageId)))return false;
    const product=w.piles.find(q=>q.id===c.productId);
    return !!product&&isRecipeProduct(recipe,product.item)&&product.quantity===1&&product.owner.type==='pawn'&&product.owner.pawnId===p.id;
  }
  if(c.productId!==null||c.storageId!==null||!validSurvivalMealIngredients(c.ingredients)
    ||c.ingredients.filter(i=>i.stage==='held').length>1)return false;
  return c.phase==='gather'?c.progress===0:c.ingredients.every(i=>i.stage==='placed')&&p.x===c.spot.x&&p.z===c.spot.z&&p.path.length===0&&p.state==='working';
}

/** Save and bridge share future-content rejection. Existing acquired rations
 * do not require research, and old saves never gain a production project. */
export function validPackagedSurvivalState(w:World,version:number):boolean {
  const research=w.research,active=research?.project==='packaged-survival-meals';
  const entry=research?.packagedSurvivalMeals;
  if(research&&Object.hasOwn(research,'packagedSurvivalMeals')){
    if(version<188||!object(entry)||Object.keys(entry).some(k=>k!=='points'&&k!=='completedAt')||!integer(entry.points,0,PACKAGED_SURVIVAL_MEALS_RESEARCH_COST))return false;
    if(entry.completedAt===undefined?entry.points>=PACKAGED_SURVIVAL_MEALS_RESEARCH_COST:active||entry.points!==PACKAGED_SURVIVAL_MEALS_RESEARCH_COST||!integer(entry.completedAt,0,w.tick))return false;
  }
  if(active&&(version<188||!entry))return false;
  const unlocked=version>=188&&entry?.completedAt!==undefined;
  const bills=(s:Structure):boolean=>!s.bills?.some(b=>b.recipe==='cook-survival-meal'&&(!(s.kind==='fueled-stove'||s.kind==='electric-stove')||
    !unlocked&&!(w.developerTest381===true&&developerBillPlacement381(w,s,b))));
  for(const s of w.structures)if(!bills(s))return false;
  for(const p of w.packed??[])if(!bills(p.building))return false;
  for(const p of w.pawns){
    if(p.cooking?.recipe===recipe&&(!unlocked||!validTask(w,p,p.cooking)))return false;
    for(const o of p.orders?.queue??[])if(typeof o==='object'&&o!==null&&'cooking' in o&&o.cooking?.recipe===recipe
      &&(!unlocked||!validCookingOrder(o,w)||!validStation(w,o.cooking)))return false;
  }
  return true;
}
import {developerBillPlacement381} from './developer-import-381.ts';
