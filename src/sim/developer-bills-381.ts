import type {World,Structure} from './types.ts';
import {developerBillPlacement381} from './developer-import-381.ts';
import {productionResearchUnlocked} from './machining.ts';
import {PRODUCTION_RECIPES,stationAccepts,type ProductionRecipe} from './production-recipes.ts';

/** Moving/minifying would put the bill under a different physical pose or
 * packed owner, which has no placement evidence. The player may remove it
 * or finish its actual research before relocating this station. */
export const developerLockedBillsAt381=(w:World,s:Structure):boolean=>w.developerTest381===true&&
 !!s.bills?.some(b=>!productionResearchUnlocked(w,b.recipe)&&developerBillPlacement381(w,s,b));

/** Only imported bills are retained while locked. This shared physical guard
 * ensures the Full and strict save reject any other locked order, including
 * a new copied bill, a packed original or an executing/queued job. Runtime
 * eligibility and construction are deliberately NOT granted by evidence. */
export function validDeveloperBills381(world:World):boolean {
 if(world.developerTest381!==true)return true;
 try{
  const locked=(recipe:ProductionRecipe)=>!Object.hasOwn(PRODUCTION_RECIPES,recipe)||!productionResearchUnlocked(world,recipe);
  for(const s of world.structures)for(const b of s.bills??[]){
   if(!stationAccepts(s,b.recipe)||locked(b.recipe)&&!developerBillPlacement381(world,s,b))return false;
  }
  for(const p of world.packed??[])if(p.building.bills?.some(b=>locked(b.recipe)))return false;
  for(const job of world.jobs)if((job.kind==='install'||job.kind==='uninstall')&&job.furniture&&world.structures.some(s=>s.id===job.furniture!.structureId&&developerLockedBillsAt381(world,s)))return false;
  for(const p of world.pawns){
   if(p.cooking?.recipe&&locked(p.cooking.recipe))return false;
   if(p.orders.queue.some(o=>typeof o==='object'&&o!==null&&'cooking'in o&&o.cooking.recipe!==undefined&&locked(o.cooking.recipe)))return false;
  }
  return true;
 }catch{return false;}
}
