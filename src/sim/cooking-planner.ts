import {cookingUnitValue353,cooksAnimalProducts353} from './cooking-ingredients-353.ts';
import {captureOrderedWorkClaims378,type OrderedWorkClaims378} from './ordered-work-claims-378.ts';
import {isProstheticRecipe273,PROSTHETIC_REQUIREMENTS_273} from './prosthetic-content-273.ts';
import {billWorkerRefusal283} from './bill-worker-rules-283.ts';
import {planProstheticWork273} from './prosthetic-work-plan-273.ts';
import {validProstheticIngredients273} from './machining.ts';
import {isSchema269OrLater} from './schema-compatibility-257.ts';
import {isSmithingRecipe267,smithingUnits267,smithingMaterialAllowed267} from './smithing-content-267.ts';
import {planSmithingWork267} from './smithing-work-plan-267.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import {isBurnApparelRecipe,burnApparelIngredientAllowed} from './burn-apparel-rules.ts';
import {isPemmicanRecipe,validPemmicanIngredients} from './pemmican-content.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {billWork} from './production-recipes.ts';
import { workPriority } from './work-types.ts';
import { isKibbleRecipe,KIBBLE_GROUP_UNITS,kibbleIngredientGroup,validKibbleIngredients } from './fodder-recipes.ts';
import { allowedAreaAllows,captureAllowedArea } from './allowed-area-state.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed } from './smelting-rules.ts';
import { isCremationRecipe,cremationIngredientAllowed } from './cremation-rules.ts';
import { burialClaim } from './burial.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import {planArtWork} from './art-work-plan.ts';
import {isArtRecipe} from './art-rules.ts';
import { productionResearchUnlocked,productionWorkerQualified,validAdvancedComponentIngredients,validFlakIngredients } from './machining.ts';
import { planGunWork } from './gun-work-plan.ts';
import { planFlakWork } from './flak-work-plan.ts';
import { planComponentWork } from './component-work-plan.ts';
import { validBiofuelIngredients,MEDICINE_REQUIREMENTS,validMedicineIngredients,isGunRecipe,GUN_REQUIREMENTS,isFlakRecipe,flakRequirements,ADVANCED_COMPONENT_REQUIREMENTS,type AdvancedComponentMaterial } from './production-recipes.ts';
import { isAnimalCorpseItem } from './biome-items.ts';
import { foodStationUsable, usesCookingFuel } from './food-workstations.ts';
import { corpseFresh } from './corpses.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { planUnfinished } from './tailoring-plan.ts';
import { footprintCells } from './definitions.ts';
import {carryStackLimit379} from './carry-quantity-379.ts';
import { PRODUCTION_RECIPES, admittedIngredient, fineMealIngredientGroup, mixedMealGroupUnits, validSurvivalMealIngredients, validFineMealIngredients, validFineMealBulkIngredients, validLavishMealIngredients, validLavishMealBulkIngredients, validVegetarianFineMealIngredients, validVegetarianFineMealBulkIngredients, validVegetarianLavishMealIngredients, validVegetarianLavishMealBulkIngredients, validCarnivoreFineMealIngredients, validCarnivoreFineMealBulkIngredients, validCarnivoreLavishMealIngredients, validCarnivoreLavishMealBulkIngredients, isTailoring, productionStationUsable, stationRecipe,  type ProductionIngredient } from './production-recipes.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { billWanted, cookingPlaceFree, cookingSpot, ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity } from './ground-placement.ts';
import { createSourceReservationRead379 } from './materials.ts';
import { fuelCapacity, fuelStationReserved } from './fuel.ts';
import { routeToCell, routeToJob, type Reachability } from './pathfinding.ts';
import type { CookingTask, CookingIngredient } from './cooking-types.ts';
import type { Cell, HaulTask, Pawn, Structure, World } from './types.ts';
import { compareSearchKeys,type RegionSearch } from './region-search.ts';
import { compareRimWorkGivers,rimWorkGiver,stationWorkGiver } from './work-givers-rimworld.ts';
import {filteredStructures} from './structure-navigation.ts';

export interface CookingPlan {station:Structure;priority:number;target:Cell;path:Cell[];task?:CookingTask;refuel?:HaulTask}
// Recipe capability depends only on the immutable structure kind. Dynamic
// bills, activity, access and reservations are still read on every offer.
const productionStations=(world:World)=>filteredStructures(world,'production-stations',s=>stationRecipe(s)!==null);
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const distance=(a:Cell,b:Cell)=>(a.x-b.x)**2+(a.z-b.z)**2;
function stationPriority(world:World,pawn:Pawn,s:Structure):number {
  let best=5;for(const bill of s.bills??[]){const priority=workPriority(pawn,billWork(bill));if(priority>0&&priority<best&&!billWorkerRefusal283(world,pawn,bill)&&billWanted(world,bill)&&!backgroundWorkRefusal(pawn,billWork(bill)))best=priority;}return best;
}
export function hasCookingWork(world:World,pawn:Pawn):boolean {
  return productionPriority(world,pawn)<5;
}
export function availableCookingStations(world:World,pawn:Pawn,claims:OrderedWorkClaims378=captureOrderedWorkClaims378(world,pawn.id)):Structure[] {
  const policy=captureAllowedArea(world,pawn);
  return productionStations(world).filter(s=>!claims.structures?.has(s.id)&&(!policy||allowedAreaAllows(world,pawn,s,policy))&&(s.kind!=='electric-stove'||foodStationUsable(s))&&productionStationUsable(s)&&stationPriority(world,pawn,s)<5
    &&(s.kind!=='electric-crematorium'||(pawn.faction??'colony')==='colony'&&!pawn.prisoner&&!pawn.visitor&&!pawn.raid&&!pawn.podRescue&&!medicalWorkRefusal(pawn)&&!pawn.stun&&!pawn.draft&&!pawn.burning&&!pawn.mental?.crisis&&!pawn.collapsePending)
    &&!fuelStationReserved(world,s.id,pawn.id));
}
/** Select without mutation. The ordinary planner compares this proposal with
 * construction/growing/hauling before committing its reservations. */
/** With `search` (schema 301 family), stations are taken in RimWorld's
 * order: by the work giver of their bills (pawn priority, natural priority,
 * priorityInType), then the giver's region search from the pawn to the
 * station's work spot, then straight-line distance. */
export function planCooking(world:World,pawn:Pawn,reachable:Reachability,budget:{pairs:number},options?:{stationId:number;forced:boolean},search?:RegionSearch,claims:OrderedWorkClaims378=captureOrderedWorkClaims378(world,pawn.id)):CookingPlan|null {
  const reserved=createSourceReservationRead379(world);
  const policy=captureAllowedArea(world,pawn),allows=(cell:Cell)=>!policy||allowedAreaAllows(world,pawn,cell,policy);
  const stations=availableCookingStations(world,pawn,claims).filter(s=>!options||s.id===options.stationId);
  const priorities=new Map(stations.map(s=>[s.id,stationPriority(world,pawn,s)]));
  if(search){
    const keys=new Map(stations.map(s=>[s.id,search.key(cookingSpot(s),stationWorkGiver(s))]));
    stations.sort((a,b)=>compareRimWorkGivers(rimWorkGiver(stationWorkGiver(a)),priorities.get(a.id)!,rimWorkGiver(stationWorkGiver(b)),priorities.get(b.id)!)||compareSearchKeys(keys.get(a.id)!,keys.get(b.id)!)||distance(pawn,a)-distance(pawn,b)||a.id-b.id);
  }else stations.sort((a,b)=>priorities.get(a.id)!-priorities.get(b.id)!||distance(pawn,a)-distance(pawn,b)||a.id-b.id);
  // Proposals below only read the World; reserve claims cannot change until
  // the caller commits a plan. Capture the same service cells at most once.
  let serviceCells:ReadonlySet<number>|undefined;
  for(const station of stations) {
    if(fuelStationReserved(world,station.id,pawn.id))continue;
    const spot=cookingSpot(station);
    if(!cookingPlaceFree(world,spot)||(serviceCells??=reservedServiceCells(world,pawn.id)).has(spot.z*world.width+spot.x))continue;
    const toSpot=routeToCell(world,spot,reachable);
    if(!toSpot)continue;
    for(const bill of station.bills!) {
      if(isBurnApparelRecipe(bill.recipe)&&((pawn.faction??'colony')!=='colony'||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||medicalWorkRefusal(pawn)||pawn.stun||pawn.draft||pawn.burning||pawn.mental?.crisis||pawn.collapsePending))continue;
      if(!workPriority(pawn,billWork(bill))||backgroundWorkRefusal(pawn,billWork(bill))||billWorkerRefusal283(world,pawn,bill)||!billWanted(world,bill)||!productionResearchUnlocked(world,bill.recipe)||!productionWorkerQualified(pawn,bill.recipe))continue;
      // The reference bill worker refuels an empty usable station before cooking.
      if(usesCookingFuel(station.kind)&&!station.fuel?.ticks) {
        const capacity=fuelCapacity(world,station.id,undefined,options?.forced);if(!capacity)break;
        const wood=world.piles.filter(p=>p.item==='wood'&&p.owner.type==='ground'&&allows(p.owner)&&p.quantity>reserved(p.id))
          .sort((a,b)=>distance(a.owner as Cell,station)-distance(b.owner as Cell,station)||a.id-b.id);
        for(const pile of wood) {
          if(budget.pairs--<=0){budget.pairs=0;return null;}
          const path=routeToJob(world,pile.owner as Cell,reachable,true);
          if(!path)continue;
          return {station,priority:workPriority(pawn,billWork(bill)),target:pile.owner as Cell,path,refuel:{sourcePileId:pile.id,quantity:Math.min(carryStackLimit379(world,pawn,pile.item),capacity,pile.quantity-reserved(pile.id)),phase:'pickup',carryPileId:null,destination:{type:'fuel',structureId:station.id,...(isSchema269OrLater(world.schemaVersion)&&station.kind==='fueled-smithy'&&billWork(bill)==='craft'?{forCrafting:true as const}:isBurnApparelRecipe(bill.recipe)?{}:{forCooking:true as const}),...(options?.forced?{forced:true}:{})}}};
        }
        break;
      }
      const artResumed=planArtWork(world,pawn,station,bill,reachable,budget);if(artResumed.plan)return artResumed.plan;if(artResumed.handled)continue;
      const prostheticResumed=planProstheticWork273(world,pawn,station,bill,reachable,budget);if(prostheticResumed.plan)return prostheticResumed.plan;if(prostheticResumed.handled)continue;
      const gunResumed=planGunWork(world,pawn,station,bill,reachable,budget);if(gunResumed.plan)return gunResumed.plan;if(gunResumed.handled)continue;
      const smithingResumed=planSmithingWork267(world,pawn,station,bill,reachable,budget);if(smithingResumed.plan)return smithingResumed.plan;if(smithingResumed.handled)continue;
      const flakResumed=planFlakWork(world,pawn,station,bill,reachable,budget);if(flakResumed.plan)return flakResumed.plan;if(flakResumed.handled)continue;
      const componentResumed=planComponentWork(world,pawn,station,bill,reachable,budget);if(componentResumed.plan)return componentResumed.plan;if(componentResumed.handled)continue;
      const resumed=planUnfinished(world,pawn,station,bill,reachable,budget);if(resumed.plan)return resumed.plan;if(resumed.handled)continue;
      const byValue=cooksAnimalProducts353(bill.recipe);
      const requiresFreshIngredients=bill.recipe==='brew-wort'||isPemmicanRecipe(bill.recipe)||isKibbleRecipe(bill.recipe)||bill.recipe==='chemfuel-from-organics'||bill.recipe==='cook-survival-meal'||bill.recipe==='cook-simple-meal-bulk'||bill.recipe==='cook-fine-meal-bulk'||bill.recipe==='cook-lavish-meal-bulk'||bill.recipe==='vegetarian-fine-meal'||bill.recipe==='cook-vegetarian-fine-meal-bulk'||bill.recipe==='carnivore-fine-meal'||bill.recipe==='cook-carnivore-fine-meal-bulk'||bill.recipe==='vegetarian-lavish-meal'||bill.recipe==='cook-vegetarian-lavish-meal-bulk'||bill.recipe==='cook-carnivore-lavish-meal'||bill.recipe==='cook-carnivore-lavish-meal-bulk';
      const sources=world.piles.filter(p=>eggAllowedForPlayer256(p)&&admittedIngredient(bill,p.item)&&(!isBurnApparelRecipe(bill.recipe)||burnApparelIngredientAllowed(bill,p))&&(!isSmeltingRecipe(bill.recipe)||smeltingIngredientAllowed(bill,p))&&(!isCremationRecipe(bill.recipe)||cremationIngredientAllowed(world,bill,p)&&(!p.humanCorpse||!burialClaim(world,p.humanCorpse.pawnId,pawn.id)))&&(isCremationRecipe(bill.recipe)||!isAnimalCorpseItem(p.item)||corpseFresh(p,world.tick))&&(!requiresFreshIngredients||ticksUntilRot(p,world.tick)>0)&&p.owner.type==='ground'&&allows(p.owner)&&distance(p.owner,station)<=bill.radius**2)
        // Schema 353 (Core AllowMix): the least nutritious things first, then
        // distance. Every older ingredient is one unit, so this key is neutral.
        .sort((a,b)=>(byValue?cookingUnitValue353(a.item)-cookingUnitValue353(b.item):0)||distance(a.owner as Cell,station)-distance(b.owner as Cell,station)||a.id-b.id);
      // No source means no pair was visited and no staging decision was made.
      // Avoid six full resource/footprint scans per empty bill, especially after
      // simultaneous spoilage. Keep earlier route/blocker diagnostics unchanged.
      if(!sources.length)continue;
      const kibble=isKibbleRecipe(bill.recipe),mealQuota=kibble?KIBBLE_GROUP_UNITS:mixedMealGroupUnits(bill.recipe);
      const ingredientGroup=kibble?kibbleIngredientGroup:fineMealIngredientGroup;
      const groups=(isSmithingRecipe267(bill.recipe)||isArtRecipe(bill.recipe)||bill.recipe==='tuque')?[...new Set(sources.map(p=>p.item))].map(material=>sources.filter(p=>p.item===material)):[sources];
      for(const group of groups) {
      const ingredients:CookingIngredient[]=[],planned=new Map<string,{item:ProductionIngredient;quantity:number}>();
      let missing:number=isSmithingRecipe267(bill.recipe)&&smithingMaterialAllowed267(bill.recipe,group[0]?.item)?smithingUnits267(bill.recipe,group[0]!.item):PRODUCTION_RECIPES[bill.recipe].units;
      if((isSmithingRecipe267(bill.recipe)||isArtRecipe(bill.recipe)||bill.recipe==='tuque')&&group.reduce((n,p)=>n+Math.max(0,p.quantity-reserved(p.id)),0)<missing)continue;
      const cells=[station,spot,{x:spot.x-1,z:spot.z},{x:spot.x+1,z:spot.z},{x:spot.x,z:spot.z-1},{x:spot.x,z:spot.z+1},...footprintCells(station)]
        .filter((c,i,a)=>allows(c)&&a.findIndex(t=>same(t,c))===i&&(!isCremationRecipe(bill.recipe)||canStandAt(world,c))&&ingredientPlaceFree(world,c,spot,bill.recipe,station));
      let tailoringMaterial:ProductionIngredient|undefined;
      for(const pile of group) {
        if(isTailoring(bill.recipe)&&tailoringMaterial!==undefined&&pile.item!==tailoringMaterial)continue;
        if(budget.pairs--<=0){budget.pairs=0;return null;}
        const sourceGroup=mealQuota?ingredientGroup(pile.item as ProductionIngredient):null;
        const typeMissing=bill.recipe==='make-medicine'?(MEDICINE_REQUIREMENTS[pile.item as keyof typeof MEDICINE_REQUIREMENTS]??0)-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):mealQuota?(sourceGroup===null?0:mealQuota-ingredients.reduce((n,i)=>n+(ingredientGroup(i.item)===sourceGroup?i.quantity*cookingUnitValue353(i.item):0),0)):isProstheticRecipe273(bill.recipe)?(pile.item==='steel'||pile.item==='component'?PROSTHETIC_REQUIREMENTS_273[pile.item]-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):0):isGunRecipe(bill.recipe)?(pile.item==='steel'||pile.item==='component'?GUN_REQUIREMENTS[bill.recipe][pile.item]-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):0):isFlakRecipe(bill.recipe)?((flakRequirements(bill.recipe) as unknown as Record<string,number>)[pile.item]??0)-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):bill.recipe==='make-advanced-component'?ADVANCED_COMPONENT_REQUIREMENTS[pile.item as AdvancedComponentMaterial]-ingredients.reduce((n,i)=>n+(i.item===pile.item?i.quantity:0),0):missing;
        // An egg counts its nutrition: ceil(missing / value) of it, as Core.
        const unit=byValue?cookingUnitValue353(pile.item):1,quantity=Math.min(unit===1?typeMissing:Math.ceil(typeMissing/unit),pile.quantity-reserved(pile.id));
        if(quantity<=0)continue;if(isTailoring(bill.recipe))tailoringMaterial??=pile.item as ProductionIngredient;
        if(!routeToJob(world,pile.owner as Cell,reachable,true))continue;
        const already=cells.find(c=>same(c,pile.owner as Cell));
        const cell=already??cells.find(c=>{
          const reserved=planned.get(`${c.x}:${c.z}`);
          return (!reserved||reserved.item===pile.item)&&groundCapacity(world,c,pile.item)-(reserved?.quantity??0)>=quantity;
        });
        if(!cell)continue;
        for(let left=quantity;left>0;){const part=already?left:Math.min(left,carryStackLimit379(world,pawn,pile.item));if(part<1)break;ingredients.push({pileId:pile.id,item:pile.item as ProductionIngredient,quantity:part,stage:already?'placed':'source',cell:{x:cell.x,z:cell.z}});left-=part;}
        if(!already){const key=`${cell.x}:${cell.z}`;planned.set(key,{item:pile.item as ProductionIngredient,quantity:(planned.get(key)?.quantity??0)+quantity});}
        missing-=unit===1?quantity:Math.min(quantity*unit,typeMissing);if(!missing)break;
      }
      if(missing||!validProstheticIngredients273(bill.recipe,ingredients)||isPemmicanRecipe(bill.recipe)&&!validPemmicanIngredients(ingredients)||kibble&&!validKibbleIngredients(ingredients)||!validBiofuelIngredients(bill.recipe,ingredients)||!validMedicineIngredients(bill.recipe,ingredients)||bill.recipe==='cook-survival-meal'&&!validSurvivalMealIngredients(ingredients)||bill.recipe==='fine-meal'&&!validFineMealIngredients(ingredients)||bill.recipe==='cook-fine-meal-bulk'&&!validFineMealBulkIngredients(ingredients)||bill.recipe==='vegetarian-fine-meal'&&!validVegetarianFineMealIngredients(ingredients)||bill.recipe==='cook-vegetarian-fine-meal-bulk'&&!validVegetarianFineMealBulkIngredients(ingredients)||bill.recipe==='carnivore-fine-meal'&&!validCarnivoreFineMealIngredients(ingredients)||bill.recipe==='cook-carnivore-fine-meal-bulk'&&!validCarnivoreFineMealBulkIngredients(ingredients)||bill.recipe==='lavish-meal'&&!validLavishMealIngredients(ingredients)||bill.recipe==='cook-lavish-meal-bulk'&&!validLavishMealBulkIngredients(ingredients)||bill.recipe==='vegetarian-lavish-meal'&&!validVegetarianLavishMealIngredients(ingredients)||bill.recipe==='cook-vegetarian-lavish-meal-bulk'&&!validVegetarianLavishMealBulkIngredients(ingredients)||bill.recipe==='cook-carnivore-lavish-meal'&&!validCarnivoreLavishMealIngredients(ingredients)||bill.recipe==='cook-carnivore-lavish-meal-bulk'&&!validCarnivoreLavishMealBulkIngredients(ingredients)||!validFlakIngredients(bill.recipe,ingredients)||!validAdvancedComponentIngredients(bill.recipe,ingredients))continue; // Try the next bill if its filters admit other ingredients.
      const source=ingredients.find(i=>i.stage==='source'),target=source?world.piles.find(p=>p.id===source.pileId)!.owner as Cell:spot;
      return {station,priority:workPriority(pawn,billWork(bill)),target,path:source?routeToJob(world,target,reachable,true)!:toSpot,task:{...(bill.recipe!=='simple-meal'?{recipe:bill.recipe}:{}),stationId:station.id,billId:bill.id,spot,actionCell:{x:target.x,z:target.z},phase:'gather',ingredients,progress:0,productId:null,storageId:null}};
      }
    }
  }
  return null;
}

export function productionPriority(world:World,pawn:Pawn,claims:OrderedWorkClaims378=captureOrderedWorkClaims378(world,pawn.id)):number {
  const policy=captureAllowedArea(world,pawn);
  let priority=5;
  for(const s of productionStations(world))if(!claims.structures?.has(s.id)&&(!policy||allowedAreaAllows(world,pawn,s,policy))&&s.bills?.some(b=>billWanted(world,b))){const p=stationPriority(world,pawn,s);priority=Math.min(priority,p);}
  return priority;
}
