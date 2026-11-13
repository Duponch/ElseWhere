import { storedPriority } from './work-types.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {validBillWorkerBuilding283} from './bill-worker-save-283.ts';
import {isProstheticRecipe273} from './prosthetic-content-273.ts';
import {validProstheticIngredients273} from './machining.ts';
import {isSchema267OrLater} from './schema-compatibility-257.ts';
import {isSmithingRecipe267,smithingRecipeAvailable267,smithingWorkpiece267,smithingMaterialFromIngredients267,smithingUnits267} from './smithing-content-267.ts';
import {validWortIngredients265} from './brewing-content-265.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {isBurnApparelRecipe} from './burn-apparel-content.ts';
import {burnApparelIngredientAllowed,validBurnApparelIngredients} from './burn-apparel-rules.ts';
import {isPemmicanRecipe,validPemmicanIngredients} from './pemmican-content.ts';
import {storageCellById,shelfAt} from './shelf-storage.ts';
import { isCremationRecipe,cremationIngredientAllowed,validCremationIngredients } from './cremation-rules.ts';
import { isMechSalvageRecipe } from './mechanoid-salvage.ts';
import { isKibbleRecipe,validKibbleIngredients,kibbleOutputUnits } from './fodder-recipes.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed,validSmeltingProduct } from './smelting-rules.ts';
import { packagedSurvivalMealsUnlocked } from './research.ts';
import {isArtRecipe,artWorkTotal,isArtMaterial} from './art-rules.ts';
import {furnitureSlot} from './furniture-haul-rules.ts';
import { storageConditionAccepts } from './storage-condition.ts';
import { V91_ITEM_IDS,V190_ITEM_IDS } from './biome-items.ts';
import { V120_ANIMAL_PRODUCT_ITEMS } from './animal-product-items.ts';
import { V219_ITEM_IDS } from './items.ts';
import { isComponentRecipe,isFlakRecipe,flakWorkpiece,isGunRecipe, isTailoring, unfinishedItem, stationAccepts, PRODUCTION_RECIPES, productionWorkTotal, legacyProductionTicks, stationRecipe, taskRecipe, taskWork, isRecipeProduct, blockFor, validSurvivalMealIngredients, validFineMealIngredients, validFineMealBulkIngredients, validLavishMealIngredients, validLavishMealBulkIngredients, validVegetarianFineMealIngredients, validVegetarianFineMealBulkIngredients, validCarnivoreFineMealIngredients, validCarnivoreFineMealBulkIngredients, validVegetarianLavishMealIngredients, validVegetarianLavishMealBulkIngredients, validCarnivoreLavishMealIngredients, validCarnivoreLavishMealBulkIngredients, type ProductionIngredient, type StoneIngredient } from './production-recipes.ts';
import { productionResearchUnlocked,productionWorkerQualified,validAdvancedComponentIngredients,validFlakIngredients,validGunIngredients } from './machining.ts';
import { isBiofuelRecipe,validBiofuelIngredients,validMedicineIngredients } from './production-recipes.ts';
import { fuelStationReserved } from './fuel.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { isCookingOrder } from './order-types.ts';
import { validCookingOrder } from './player-cooking-save.ts';
import { withoutQueuedOrder } from './haul-reservations.ts';
import { componentWorkpiecePlaceFree,cookingSpot, ingredientPlaceFree, ingredientWithinReach, validBillSettings } from './cooking-bills.ts';
import { groundCapacity, storageCapacity } from './ground-placement.ts';
import { reservedSource } from './materials.ts';
import {createStagingValidation,type StagingGeometryReader} from './staging-validation.ts';
import type { Cell,World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
/** Called after the base schema's structures/pawns/piles are shape-checked. */
export function validateCooking(input:unknown,version:number,ids:Set<number>,memoizeStaging=false,indexStaging=false,geometry?:StagingGeometryReader,packedRecords?:readonly PackedFurniture[]):string[] {
  const w=input as World,errors:string[]=[];
  const cell=(v:unknown)=>record(v)&&Object.keys(v).every(key=>key==='x'||key==='z')&&int(v.x,0,w.width-1)&&int(v.z,0,w.height-1);
  const taskKeys=new Set(['recipe','stationId','billId','spot','actionCell','phase','ingredients','progress','productId','storageId',...(version>=79?['workTicks']:[]),...(version>=32?['storageQuantity']:[])]);
  const ingredientKeys=new Set(['pileId','item','quantity','stage','cell']);
  errors.push(...validateCookingBuildingRecords258(w,version,ids,packedRecords?packedRecords.map(p=>p.building):[...w.structures,...(version>=32?w.packed.map(p=>p.building):[])]));
  if(packedRecords)return errors;
  for(const p of w.pawns) {
    if(version<32?p.priorities.craft!==undefined:!int(p.priorities.craft,0,4))errors.push('Invalid or future craft priority.');
    if(version<10) {if(p.cooking!==undefined||p.priorities.cook!==undefined)errors.push('Legacy save contains cooking fields.');continue;}
    if(!int(p.priorities.cook,0,4))errors.push('Invalid cooking priority.');
    if(p.cooking===null)continue;
    const c=p.cooking;
    if(isSmithingRecipe267(c?.recipe)&&(!smithingRecipeAvailable267(c.recipe,version)||!productionResearchUnlocked(w,c.recipe)||c.phase!=='output'&&!productionWorkerQualified(p,c.recipe))){errors.push('Unavailable smithing production.');continue;}
    if(c?.recipe==='smelt-apparel'&&!isSchema267OrLater(version)){errors.push('Future apparel smelting production.');continue;}
    if(c?.recipe==='brew-wort'&&version<265){errors.push('Future wort production.');continue;}
    if(isBurnApparelRecipe(c?.recipe)&&(version<251||!['gather','work'].includes(c.phase)||c.productId!==null||c.storageId!==null||Object.hasOwn(c,'storageQuantity')||Object.hasOwn(c,'workTicks'))){errors.push('Invalid or future apparel-burning production.');continue;}
    if(isPemmicanRecipe(c?.recipe)&&(version<248||c.phase==='interrupted'||!productionResearchUnlocked(w,c.recipe))){errors.push('Invalid or future pemmican production.');continue;}
    if(isKibbleRecipe(c?.recipe)&&(version<227||c.phase==='interrupted')){errors.push('Invalid or future kibble production.');continue;}
    if(isCremationRecipe(c?.recipe)&&(version<225||c.phase==='output'||c.productId!==null||c.storageId!==null||Object.hasOwn(c,'storageQuantity')||Object.hasOwn(c,'workTicks')||!productionResearchUnlocked(w,c.recipe))){errors.push('Invalid or future cremation production.');continue;}
    if(isSmeltingRecipe(c?.recipe)&&(version<222||c.phase==='interrupted'||!productionResearchUnlocked(w,c.recipe))){errors.push('Invalid or future smelting production.');continue;}
    if(isBiofuelRecipe(c?.recipe)&&(version<218||!productionResearchUnlocked(w,c.recipe)||c.phase==='interrupted')){errors.push('Invalid or future biofuel production.');continue;}
    if(c?.recipe==='make-emp-launcher'&&(version<208||!productionResearchUnlocked(w,c.recipe))){errors.push('Invalid or future EMP production.');continue;}
    const medicine=c?.recipe==='make-medicine';
    if(medicine&&(version<206||!record(c)||Object.keys(c).some(key=>!taskKeys.has(key))||c.phase==='interrupted')){errors.push('Invalid or future medicine production.');continue;}
    if((isMechSalvageRecipe(c?.recipe)||c?.recipe==='cook-survival-meal'||c?.recipe==='fine-meal'||c?.recipe==='lavish-meal'||c?.recipe==='vegetarian-fine-meal'||c?.recipe==='carnivore-fine-meal'||c?.recipe==='vegetarian-lavish-meal'||c?.recipe==='cook-carnivore-lavish-meal'||c?.recipe==='cook-simple-meal-bulk'||c?.recipe==='cook-fine-meal-bulk'||c?.recipe==='cook-vegetarian-fine-meal-bulk'||c?.recipe==='cook-carnivore-fine-meal-bulk'||c?.recipe==='cook-lavish-meal-bulk'||c?.recipe==='cook-vegetarian-lavish-meal-bulk'||c?.recipe==='cook-carnivore-lavish-meal-bulk')&&c.phase==='interrupted'){errors.push('Meal has no resumable interrupted work.');continue;}
    if(!record(c)||Object.keys(c).some(key=>!taskKeys.has(key))||c.recipe!==undefined&&(!((isSchema273OrLater(version)&&isProstheticRecipe273(c.recipe))||(isSmithingRecipe267(c.recipe)&&smithingRecipeAvailable267(c.recipe,version))||(version>=265&&c.recipe==='brew-wort')||(version>=251&&isBurnApparelRecipe(c.recipe))||(version>=248&&isPemmicanRecipe(c.recipe))||(version>=227&&isKibbleRecipe(c.recipe))||(version>=225&&isCremationRecipe(c.recipe))||(version>=222&&isSmeltingRecipe(c.recipe))||(version>=218&&isBiofuelRecipe(c.recipe))||(version>=206&&c.recipe==='make-medicine')||(version>=194&&isMechSalvageRecipe(c.recipe))||(version>=188&&c.recipe==='cook-survival-meal')||(version>=32&&c.recipe==='stone-blocks')||(version>=72&&c.recipe==='tribalwear')||(version>=73&&c.recipe==='shirt')||(version>=79&&c.recipe==='butcher-creature')||(version>=90&&['pants','duster','parka'].includes(String(c.recipe)))||(version>=101&&isGunRecipe(c.recipe))||(version>=104&&isArtRecipe(c.recipe))||(version>=109&&c.recipe==='make-flak-vest')||(version>=141&&c.recipe==='make-flak-helmet')||(version>=148&&c.recipe==='make-recon-helmet')||(version>=241&&c.recipe==='make-recon-armor')||(version>=245&&c.recipe==='tuque')||(version>=312&&(c.recipe==='tshirt'||c.recipe==='jacket'))||(version>=123&&c.recipe==='make-component')||(version>=139&&c.recipe==='make-advanced-component')||(version>=152&&c.recipe==='fine-meal')||(version>=154&&c.recipe==='lavish-meal')||(version>=155&&c.recipe==='vegetarian-fine-meal')||(version>=156&&c.recipe==='carnivore-fine-meal')||(version>=157&&c.recipe==='vegetarian-lavish-meal')||(version>=159&&c.recipe==='cook-carnivore-lavish-meal')||(version>=160&&c.recipe==='cook-simple-meal-bulk')||(version>=161&&c.recipe==='cook-fine-meal-bulk')||(version>=162&&c.recipe==='cook-vegetarian-fine-meal-bulk')||(version>=163&&c.recipe==='cook-carnivore-fine-meal-bulk')||(version>=164&&c.recipe==='cook-lavish-meal-bulk')||(version>=165&&c.recipe==='cook-vegetarian-lavish-meal-bulk')||(version>=166&&c.recipe==='cook-carnivore-lavish-meal-bulk')))){errors.push('Invalid or future production recipe.');continue;}
    const recipe=PRODUCTION_RECIPES[taskRecipe(c)];
    if((c.recipe==='brew-wort'||isKibbleRecipe(c.recipe)||isPemmicanRecipe(c.recipe)||isBiofuelRecipe(c.recipe))&&Array.isArray(c.ingredients)&&c.ingredients.some(i=>record(i)&&i.stage!=='placed'&&Number(i.quantity)>10))errors.push('Oversized biofuel ingredient cargo.');
    if(c.workTicks!==undefined&&(version<79||taskWork(c)!=='cook'&&!isMechSalvageRecipe(c.recipe)&&!medicine||c.phase!=='work'||!int(c.workTicks,1,Math.floor(Number.MAX_SAFE_INTEGER/1000))))errors.push('Invalid cooking work duration.');
    if(medicine&&c.phase==='work'&&c.workTicks===undefined)errors.push('Missing medicine work duration.');
    if(c.storageQuantity!==undefined&&(version<32||c.recipe!=='brew-wort'&&!isKibbleRecipe(c.recipe)&&!isPemmicanRecipe(c.recipe)&&!isSmeltingRecipe(c.recipe)&&!isBiofuelRecipe(c.recipe)&&!isMechSalvageRecipe(c.recipe)&&c.recipe!=='stone-blocks'&&c.recipe!=='butcher-creature'&&c.recipe!=='cook-simple-meal-bulk'&&c.recipe!=='cook-fine-meal-bulk'&&c.recipe!=='cook-vegetarian-fine-meal-bulk'&&c.recipe!=='cook-carnivore-fine-meal-bulk'&&c.recipe!=='cook-lavish-meal-bulk'&&c.recipe!=='cook-vegetarian-lavish-meal-bulk'&&c.recipe!=='cook-carnivore-lavish-meal-bulk'||c.phase!=='output'||c.storageId===null||!int(c.storageQuantity,1,recipe.outputUnits)))errors.push('Invalid production output quantity.');
    if(!record(c)||!int(c.stationId,1)||!int(c.billId,1)||!cell(c.spot)||!cell(c.actionCell)||!['gather','work','output',...(version>=11?['interrupted']:[])].includes(c.phase as string)
      ||!int(c.progress,0,version>=36?(isArtRecipe(c.recipe)?artWorkTotal(c.recipe,'granite-blocks'):productionWorkTotal(taskRecipe(c))):legacyProductionTicks(taskRecipe(c)))||!(c.productId===null||int(c.productId,1,w.nextId-1))||!(c.storageId===null||int(c.storageId,1,w.nextId-1))
      ||!Array.isArray(c.ingredients)||c.ingredients.length>recipe.units) {errors.push('Invalid cooking task.');continue;}
    if(version<197&&c.ingredients.some(i=>record(i)&&V219_ITEM_IDS.some(item=>item===i.item)))errors.push('Future mechanical carcass ingredient.');
    for(const i of c.ingredients)if(!record(i)||Object.keys(i).some(key=>!ingredientKeys.has(key))||!int(i.pileId,1,w.nextId-1)||!int(i.quantity,1,recipe.units)||!(recipe.inputs.includes(i.item as ProductionIngredient)&&(version>=178||!V190_ITEM_IDS.includes(String(i.item)))&&(version>=120||!V120_ANIMAL_PRODUCT_ITEMS.includes(String(i.item)))&&(version>=91||!V91_ITEM_IDS.includes(String(i.item)))&&(version>=79||i.item!=='hare-meat'&&i.item!=='hare-corpse')&&(version>=84||i.item!=='potato'&&i.item!=='corn')||isSmithingRecipe267(c.recipe)&&smithingRecipeAvailable267(c.recipe,version)&&i.item===smithingWorkpiece267(c.recipe)&&i.quantity===1||isSchema273OrLater(version)&&isProstheticRecipe273(c.recipe)&&c.ingredients.length===1&&i.item==='unfinished-prosthetic'&&i.quantity===1||isTailoring(c.recipe)&&i.item===unfinishedItem(c.recipe)&&i.quantity===1||version>=101&&isGunRecipe(c.recipe)&&i.item==='unfinished-gun'&&i.quantity===1||version>=104&&isArtRecipe(c.recipe)&&i.item==='unfinished-sculpture'&&i.quantity===1||isFlakRecipe(c.recipe)&&version>=(c.recipe==='make-recon-armor'?241:c.recipe==='make-recon-helmet'?148:c.recipe==='make-flak-helmet'?141:109)&&i.item===flakWorkpiece(c.recipe)&&i.quantity===1||version>=123&&isComponentRecipe(c.recipe)&&i.item==='unfinished-component'&&i.quantity===1)||!['source','held','placed'].includes(i.stage as string)||!cell(i.cell))errors.push('Invalid recipe ingredient reservation.');
  }
  if(errors.length||version<10)return errors;
  const staging=geometry??(indexStaging?createStagingValidation(w):undefined);
  const stations=new Set<number>(),spots=new Set<number>();
  for(const p of w.pawns)if(p.cooking) {
    const c=p.cooking,station=w.structures.find(s=>s.id===c.stationId&&stationAccepts(s,taskRecipe(c))),bill=station?.bills?.find(b=>b.id===c.billId);
    if(!station||!bill||bill.recipe!==taskRecipe(c)||bill.suspended||storedPriority(p,taskWork(c))===0&&!(version>=20&&p.orders.active==='cook')||p.jobId!==null||p.haul!==null||p.need!==null){errors.push('Invalid cooking task ownership.');continue;}
    if(c.recipe==='make-medicine'&&(!productionResearchUnlocked(w,c.recipe)||c.phase!=='output'&&!productionWorkerQualified(p,c.recipe)))errors.push('Unqualified medicine production.');
    if(isBiofuelRecipe(c.recipe)&&!productionResearchUnlocked(w,c.recipe))errors.push('Unavailable biofuel production.');
    if(isSmeltingRecipe(c.recipe)&&(!productionResearchUnlocked(w,c.recipe)||c.phase!=='output'&&!productionWorkerQualified(p,c.recipe)))errors.push('Unqualified smelting production.');
    const recipe=PRODUCTION_RECIPES[taskRecipe(c)],spot=cookingSpot(station),key=c.spot.z*w.width+c.spot.x;
    if(spot.x!==c.spot.x||spot.z!==c.spot.z||stations.has(station.id)||spots.has(key))errors.push('Invalid or duplicate cooking work spot.');
    stations.add(station.id);spots.add(key);
    if(version>=19&&fuelStationReserved(w,station.id,p.id))errors.push('Conflicting queued workstation reservation.');
    if(w.pawns.some(o=>o.id!==p.id&&(o.haul?.destination.type==='fuel'&&o.haul.destination.structureId===station.id||o.need?.kind==='eat'&&o.need.dining?.target.x===spot.x&&o.need.dining?.target.z===spot.z||o.need?.kind==='sleep'&&(version<14||o.need.bedId!==null)&&o.need.target.x===spot.x&&o.need.target.z===spot.z)))errors.push('Conflicting workstation reservation.');
    const unfinishedApparel=isTailoring(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item===unfinishedItem(c.recipe);
    const unfinishedProsthetic=isProstheticRecipe273(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item==='unfinished-prosthetic';
    const unfinishedGun=isGunRecipe(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item==='unfinished-gun';
    const unfinishedFlak=isFlakRecipe(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item===flakWorkpiece(c.recipe);
    const unfinishedComponent=isComponentRecipe(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item==='unfinished-component';
    const unfinishedArt=isArtRecipe(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item==='unfinished-sculpture';
    const unfinishedSmith=isSmithingRecipe267(c.recipe)&&c.ingredients.length===1&&c.ingredients[0]!.item===smithingWorkpiece267(c.recipe);
    const unfinished=unfinishedProsthetic||unfinishedSmith||unfinishedApparel||unfinishedGun||unfinishedFlak||unfinishedComponent||unfinishedArt;
    const owned=w.piles.filter(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id);
    if(c.phase==='output'&&isArtRecipe(c.recipe)) {
      const carried=w.packed.filter(q=>q.owner.type==='pawn'&&q.owner.pawnId===p.id),product=carried[0];
      if(c.ingredients.length||c.progress!==0||owned.length||carried.length!==1||product?.building.id!==c.productId||product.building.kind!==c.recipe||product.building.art?.authorId!==p.id)errors.push('Invalid sculpture product ownership.');
      if(c.storageId!==null){const zone=w.stockpiles.find(z=>z.id===c.storageId);if(!zone||!zone.filters.furniture||!product||!storageConditionAccepts(zone,product.building)||!furnitureSlot(w,zone,p.id))errors.push('Invalid sculpture output reservation.');}
    } else if(c.phase==='output') {
      if(isSmeltingRecipe(c.recipe)&&(!owned[0]||!validSmeltingProduct(owned[0].item,owned[0].quantity,c.recipe,version)||owned[0].weapon!==undefined||owned[0].apparel!==undefined))errors.push('Invalid smelting metal product.');
      if(c.ingredients.length||c.progress!==0||owned.length!==1||owned[0]?.id!==c.productId||!isRecipeProduct(taskRecipe(c),owned[0]!.item)||!int(owned[0]?.quantity,1,isKibbleRecipe(c.recipe)?kibbleOutputUnits(station):version>=91&&c.recipe==='butcher-creature'?75:recipe.outputUnits)||c.recipe==='stone-blocks'&&!recipe.inputs.some(i=>bill.filters[i]&&blockFor(i as StoneIngredient)===owned[0]!.item))errors.push('Invalid cooked product ownership.');
      if(c.storageId!==null){const storage=storageCellById(w,c.storageId),product=owned[0],quantity=c.storageQuantity??1;if(!product||(c.recipe==='brew-wort'||isKibbleRecipe(c.recipe)||isPemmicanRecipe(c.recipe)||isSmeltingRecipe(c.recipe)||isBiofuelRecipe(c.recipe)||isMechSalvageRecipe(c.recipe)||c.recipe==='stone-blocks'||c.recipe==='butcher-creature'||c.recipe==='cook-simple-meal-bulk'||c.recipe==='cook-fine-meal-bulk'||c.recipe==='cook-vegetarian-fine-meal-bulk'||c.recipe==='cook-carnivore-fine-meal-bulk'||c.recipe==='cook-lavish-meal-bulk'||c.recipe==='cook-vegetarian-lavish-meal-bulk'||c.recipe==='cook-carnivore-lavish-meal-bulk')&&c.storageQuantity===undefined||quantity>(product?.quantity??0)||!storage||storageCapacity(w,storage,product,p.id,geometry)<quantity)errors.push('Invalid cooking output reservation.');}
    } else {
      if(c.recipe==='brew-wort'&&c.phase!=='interrupted'&&!validWortIngredients265(c.ingredients))errors.push('Invalid wort ingredient quota.');
      if(isPemmicanRecipe(c.recipe)&&!validPemmicanIngredients(c.ingredients))errors.push('Invalid pemmican ingredient quotas.');
      if(isKibbleRecipe(c.recipe)&&!validKibbleIngredients(c.ingredients))errors.push('Invalid kibble ingredient quotas.');
      if(isBurnApparelRecipe(c.recipe)&&!validBurnApparelIngredients(c.ingredients))errors.push('Invalid whole apparel-burning ingredient.');
      if(isCremationRecipe(c.recipe)&&!validCremationIngredients(c.ingredients))errors.push('Invalid whole cremation ingredient.');
      if(isBiofuelRecipe(c.recipe)&&!validBiofuelIngredients(c.recipe,c.ingredients))errors.push('Invalid biofuel ingredient quota.');
      if(c.recipe==='make-medicine'&&!validMedicineIngredients(c.recipe,c.ingredients))errors.push('Invalid medicine ingredient quotas.');
      if(c.productId!==null||c.storageId!==null||(c.phase==='gather'||c.phase==='interrupted')&&c.progress!==0
        ||(c.phase==='interrupted'?c.ingredients.length!==1||c.ingredients[0]?.stage!=='held':c.ingredients.reduce((n,i)=>n+i.quantity,0)!==(unfinished?1:isSmithingRecipe267(c.recipe)?(smithingMaterialFromIngredients267(c.recipe,c.ingredients)?smithingUnits267(c.recipe,c.ingredients[0]!.item as import('./smithing-content-267.ts').SmithingMaterial267):-1):recipe.units))
        ||isProstheticRecipe273(c.recipe)&&c.phase!=='interrupted'&&!unfinished&&!validProstheticIngredients273(c.recipe,c.ingredients)
        ||isGunRecipe(c.recipe)&&c.phase!=='interrupted'&&!unfinished&&!validGunIngredients(c.recipe,c.ingredients)
        ||isFlakRecipe(c.recipe)&&c.phase!=='interrupted'&&!unfinished&&!validFlakIngredients(c.recipe,c.ingredients)
        ||c.recipe==='make-advanced-component'&&c.phase!=='interrupted'&&!unfinished&&!validAdvancedComponentIngredients(c.recipe,c.ingredients)
        ||c.recipe==='cook-survival-meal'&&!validSurvivalMealIngredients(c.ingredients)
        ||c.recipe==='fine-meal'&&c.phase!=='interrupted'&&!validFineMealIngredients(c.ingredients)
        ||c.recipe==='cook-fine-meal-bulk'&&c.phase!=='interrupted'&&!validFineMealBulkIngredients(c.ingredients)
        ||c.recipe==='cook-vegetarian-fine-meal-bulk'&&c.phase!=='interrupted'&&!validVegetarianFineMealBulkIngredients(c.ingredients)
        ||c.recipe==='cook-carnivore-fine-meal-bulk'&&c.phase!=='interrupted'&&!validCarnivoreFineMealBulkIngredients(c.ingredients)
        ||c.recipe==='lavish-meal'&&c.phase!=='interrupted'&&!validLavishMealIngredients(c.ingredients)
        ||c.recipe==='cook-lavish-meal-bulk'&&c.phase!=='interrupted'&&!validLavishMealBulkIngredients(c.ingredients)
        ||c.recipe==='vegetarian-fine-meal'&&c.phase!=='interrupted'&&!validVegetarianFineMealIngredients(c.ingredients)
        ||c.recipe==='carnivore-fine-meal'&&c.phase!=='interrupted'&&!validCarnivoreFineMealIngredients(c.ingredients)
        ||c.recipe==='vegetarian-lavish-meal'&&c.phase!=='interrupted'&&!validVegetarianLavishMealIngredients(c.ingredients)
        ||c.recipe==='cook-vegetarian-lavish-meal-bulk'&&c.phase!=='interrupted'&&!validVegetarianLavishMealBulkIngredients(c.ingredients)
        ||c.recipe==='cook-carnivore-lavish-meal-bulk'&&c.phase!=='interrupted'&&!validCarnivoreLavishMealBulkIngredients(c.ingredients)
        ||c.recipe==='cook-carnivore-lavish-meal'&&c.phase!=='interrupted'&&!validCarnivoreLavishMealIngredients(c.ingredients))errors.push('Invalid recipe quantity or phase.');
      if(c.recipe==='tuque'&&!unfinished&&c.phase!=='interrupted'&&new Set(c.ingredients.map(i=>i.item)).size!==1)errors.push('Tuque requires homogeneous material.');
      if(isArtRecipe(c.recipe)&&!unfinished&&c.phase!=='interrupted'&&(new Set(c.ingredients.map(i=>i.item)).size!==1||!isArtMaterial(c.ingredients[0]?.item,version)))errors.push('Sculpture requires homogeneous material.');
      const held=c.ingredients.filter(i=>i.stage==='held');
      if(held.length>1||owned.length!==held.length||held.length&&owned[0]?.id!==held[0]?.pileId)errors.push('Invalid ingredient cargo.');
      // The Decoder may share pure geometry for equal cells in this one task.
      // File/raw callers retain every historical read; no cache outlives the task.
      const freeByCell=memoizeStaging?new Map<number,boolean>():undefined;
      const placeFree=(cell:Cell):boolean=>{
        if(!freeByCell)return unfinishedComponent?componentWorkpiecePlaceFree(w,cell,spot,taskRecipe(c),station,staging):ingredientPlaceFree(w,cell,spot,taskRecipe(c),station,staging);
        const key=cell.z*w.width+cell.x,cached=freeByCell.get(key);
        if(cached!==undefined)return cached;
        const free=unfinishedComponent?componentWorkpiecePlaceFree(w,cell,spot,taskRecipe(c),station,staging):ingredientPlaceFree(w,cell,spot,taskRecipe(c),station,staging);
        freeByCell.set(key,free);return free;
      };
      const incoming=new Map<number,{item:ProductionIngredient;quantity:number}>();
      for(const i of c.ingredients) {
        const pile=w.piles.find(q=>q.id===i.pileId);
        if(isCremationRecipe(c.recipe)&&(!pile||i.quantity!==1||!cremationIngredientAllowed(w,bill,pile)||i.stage==='source'&&pile.owner.type==='ground'&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2))errors.push('Invalid or filtered cremation corpse.');
        if(isBurnApparelRecipe(c.recipe)&&(!pile||i.quantity!==1||!burnApparelIngredientAllowed(bill,pile)
          ||i.stage==='source'&&pile.owner.type==='ground'&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2))errors.push('Invalid or filtered apparel-burning input.');
        if(isSmeltingRecipe(c.recipe)&&(!pile||i.quantity!==1||!smeltingIngredientAllowed(bill,pile)
          ||i.stage==='source'&&pile.owner.type==='ground'&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2))errors.push('Invalid or filtered smelting weapon.');
        if((c.recipe==='brew-wort'||isKibbleRecipe(c.recipe)||isPemmicanRecipe(c.recipe)||isBiofuelRecipe(c.recipe))&&i.stage==='source'&&pile?.owner.type==='ground'&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2)errors.push('Biofuel ingredient outside bill radius.');
        if((isKibbleRecipe(c.recipe)||c.recipe==='chemfuel-from-organics')&&pile&&ticksUntilRot(pile,w.tick)<=0)errors.push('Spoiled biofuel ingredient.');
        if((!unfinished&&!bill.filters[i.item])||!pile||pile.item!==i.item||pile.quantity<i.quantity){errors.push('Missing recipe ingredient.');continue;}
        if(isSmithingRecipe267(c.recipe)&&(i.stage!=='placed'&&i.quantity>10||i.stage==='source'&&pile?.owner.type==='ground'&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2))errors.push('Invalid smithing carry or source radius.');
        if(unfinishedSmith&&(!pile.smithingWork||pile.smithingWork.recipe!==c.recipe||pile.smithingWork.authorId!==p.id||!bill.filters[pile.smithingWork.material]||pile.smithingWork.billId!==undefined&&pile.smithingWork.billId!==c.billId||c.phase==='work'&&pile.smithingWork.progress!==c.progress))errors.push('Invalid unfinished smithing ownership or progress.');
        if(unfinishedApparel&&(!pile.unfinished||pile.unfinished.recipe!==c.recipe||pile.unfinished.authorId!==p.id||pile.unfinished.billId!==undefined&&pile.unfinished.billId!==c.billId||c.phase==='work'&&pile.unfinished.progress!==c.progress))errors.push('Invalid unfinished work ownership or progress.');
        if(unfinishedArt&&(!pile.artWork||pile.artWork.recipe!==c.recipe||pile.artWork.authorId!==p.id||pile.artWork.billId!==undefined&&pile.artWork.billId!==c.billId||pile.artWork.billId===undefined&&!bill.filters[pile.artWork.material]||c.phase==='work'&&pile.artWork.progress!==c.progress))errors.push('Invalid unfinished sculpture ownership or progress.');
        if(unfinishedProsthetic&&(!pile.prostheticWork273||pile.prostheticWork273.recipe!==c.recipe||pile.prostheticWork273.authorId!==p.id||pile.prostheticWork273.billId!==undefined&&pile.prostheticWork273.billId!==c.billId||pile.prostheticWork273.billId===undefined&&!pile.prostheticWork273.parts.every(part=>bill.filters[part.item])||c.phase==='work'&&pile.prostheticWork273.progress!==c.progress))errors.push('Invalid unfinished prosthetic ownership or progress.');
        if(unfinishedGun&&(!pile.gunWork||pile.gunWork.recipe!==c.recipe||pile.gunWork.authorId!==p.id||pile.gunWork.billId!==undefined&&pile.gunWork.billId!==c.billId||pile.gunWork.billId===undefined&&!pile.gunWork.parts.every(part=>bill.filters[part.item])||c.phase==='work'&&pile.gunWork.progress!==c.progress))errors.push('Invalid unfinished gun ownership or progress.');
        if(unfinishedFlak&&(!pile.flakWork||pile.flakWork.recipe!==c.recipe||pile.flakWork.authorId!==p.id||pile.flakWork.billId!==undefined&&pile.flakWork.billId!==c.billId||pile.flakWork.billId===undefined&&!pile.flakWork.parts.every(part=>bill.filters[part.item])||c.phase==='work'&&pile.flakWork.progress!==c.progress))errors.push('Invalid unfinished flak armor ownership or progress.');
        if(unfinishedComponent&&(!pile.componentWork||pile.componentWork.recipe!==c.recipe||pile.componentWork.authorId!==p.id||pile.componentWork.billId!==undefined&&pile.componentWork.billId!==c.billId||pile.componentWork.billId===undefined&&!(pile.componentWork.recipe==='make-component'?bill.filters.steel:pile.componentWork.parts.every(part=>bill.filters[part.item]))||c.phase==='work'&&pile.componentWork.progress!==c.progress))errors.push('Invalid unfinished component ownership or progress.');
        if(i.stage==='held') {if(pile.owner.type!=='pawn'||pile.owner.pawnId!==p.id||pile.quantity!==i.quantity)errors.push('Wrong ingredient carrier.');}
        else {
          if(pile.owner.type!=='ground'||reservedSource(w,pile.id)>pile.quantity)errors.push('Invalid ground ingredient reservation.');
          if(i.stage==='placed'&&pile.owner.type==='ground'&&(pile.owner.x!==i.cell.x||pile.owner.z!==i.cell.z))errors.push('Ingredient not placed at workstation.');
        }
        if(!(unfinishedComponent&&placeFree(i.cell)||ingredientWithinReach(i.cell,spot,station))||c.phase!=='interrupted'&&((staging?.shelfAt?staging.shelfAt(i.cell):shelfAt(w,i.cell))!==undefined||c.recipe!==undefined&&!placeFree(i.cell)))errors.push('Ingredient staging beyond work reach.');
        if(i.stage!=='placed'&&c.phase!=='interrupted') {
          const key=i.cell.z*w.width+i.cell.x,prior=incoming.get(key);
          if(prior&&prior.item!==i.item)errors.push('Mixed ingredient staging reservation.');
          const quantity=(prior?.quantity??0)+i.quantity;incoming.set(key,{item:i.item,quantity});
          if(groundCapacity(w,i.cell,i.item,p.id,geometry)<quantity)errors.push('Invalid ingredient staging capacity.');
        }
      }
      if(c.phase==='work'&&(c.ingredients.some(i=>i.stage!=='placed')||p.x!==spot.x||p.z!==spot.z||p.path.length||p.state!=='working'))errors.push('Cooking before gathering or away from workstation.');
    }
  }
  return errors;
}

/** New production envelopes use the same strict file checks in the Decoder.
 * Historical worlds without refining keep their existing transport contract. */
export function validBiofuelProductionTransport(w:World,version:number,memoizeStaging=false,indexStaging=false,geometry?:StagingGeometryReader):boolean {
  try {
    const present=w.structures.some(s=>s.kind==='biofuel-refinery'||s.bills?.some(b=>isBiofuelRecipe(b?.recipe)))
      ||w.packed.some(p=>p.building.kind==='biofuel-refinery'||p.building.bills?.some(b=>isBiofuelRecipe(b?.recipe)))
      ||w.pawns.some(p=>isBiofuelRecipe(p.cooking?.recipe)||p.orders.queue.some(o=>isCookingOrder(o)&&isBiofuelRecipe(o.cooking.recipe)));
    if(!present)return true;
    if(version<218||validateCooking(w,version,new Set(),memoizeStaging,indexStaging,geometry).length)return false;
    const stations=new Set(w.pawns.filter(p=>isBiofuelRecipe(p.cooking?.recipe)).map(p=>p.cooking!.stationId));
    const spots=new Set(w.pawns.filter(p=>p.cooking).map(p=>p.cooking!.spot.z*w.width+p.cooking!.spot.x));
    for(const pawn of w.pawns)for(const order of pawn.orders.queue)if(isCookingOrder(order)&&isBiofuelRecipe(order.cooking.recipe)){
      if(!validCookingOrder(order,w))return false;
      const c=order.cooking,station=w.structures.find(s=>s.id===c.stationId&&s.kind==='biofuel-refinery'),bill=station?.bills?.find(b=>b.id===c.billId);
      if(!station||!bill||bill.recipe!==c.recipe||bill.suspended||stations.has(station.id))return false;
      const spot=cookingSpot(station),key=spot.z*w.width+spot.x;
      if(c.spot.x!==spot.x||c.spot.z!==spot.z||spots.has(key))return false;
      stations.add(station.id);spots.add(key);
      const view=withoutQueuedOrder(w,order),incoming=new Map<number,{item:ProductionIngredient;quantity:number}>();
      for(const part of c.ingredients){
        const pile=w.piles.find(p=>p.id===part.pileId);
        if(!pile||pile.item!==part.item||pile.owner.type!=='ground'||!bill.filters[part.item]||reservedSource(w,pile.id)>pile.quantity
          ||(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2
          ||c.recipe==='chemfuel-from-organics'&&ticksUntilRot(pile,w.tick)<=0
          ||!ingredientWithinReach(part.cell,spot,station)||!ingredientPlaceFree(w,part.cell,spot,c.recipe!,station,geometry))return false;
        if(part.stage==='placed'){
          if(pile.owner.x!==part.cell.x||pile.owner.z!==part.cell.z)return false;
        }else{
          const cellKey=part.cell.z*w.width+part.cell.x,prior=incoming.get(cellKey),quantity=(prior?.quantity??0)+part.quantity;
          if(prior&&prior.item!==part.item||groundCapacity(view,part.cell,part.item,undefined,geometry)<quantity)return false;
          incoming.set(cellKey,{item:part.item,quantity});
        }
      }
    }
    return true;
  }catch{return false;}
}

/** Kibble and pemmican retain the same strict file/Decoder
 * quotas, physical reservations and typed staging. No historical bill opts in. */
const isConservedBatchRecipe=(value:unknown):boolean=>value==='brew-wort'||isKibbleRecipe(value)||isPemmicanRecipe(value);
export function validKibbleProductionTransport(w:World,version:number,memoizeStaging=false,indexStaging=false,geometry?:StagingGeometryReader):boolean {
  try {
    const present=w.structures.some(s=>s.bills?.some(b=>isConservedBatchRecipe(b?.recipe)))
      ||(w.packed??[]).some(p=>p.building.bills?.some(b=>isConservedBatchRecipe(b?.recipe)))
      ||w.pawns.some(p=>isConservedBatchRecipe(p.cooking?.recipe)||(p.orders?.queue??[]).some(o=>isCookingOrder(o)&&isConservedBatchRecipe(o.cooking.recipe)));
    if(!present)return true;
    if(version<227||validateCooking(w,version,new Set(),memoizeStaging,indexStaging,geometry).length)return false;
    const stations=new Set(w.pawns.filter(p=>p.cooking).map(p=>p.cooking!.stationId));
    const spots=new Set(w.pawns.filter(p=>p.cooking).map(p=>p.cooking!.spot.z*w.width+p.cooking!.spot.x));
    for(const pawn of w.pawns)for(const order of pawn.orders.queue)if(isCookingOrder(order)&&!isConservedBatchRecipe(order.cooking.recipe)){
      const station=w.structures.find(s=>s.id===order.cooking.stationId);
      if(station){const spot=cookingSpot(station);stations.add(station.id);spots.add(spot.z*w.width+spot.x);}
    }
    for(const pawn of w.pawns)for(const order of pawn.orders.queue)if(isCookingOrder(order)&&isConservedBatchRecipe(order.cooking.recipe)){
      const c=order.cooking,station=w.structures.find(s=>s.id===c.stationId),spot=station&&cookingSpot(station);
      if(!validCookingOrder(order,w))return false;
      const bill=station?.bills?.find(b=>b.id===c.billId);
      if(!station||!spot||!bill||!stationAccepts(station,c.recipe!)||bill.recipe!==c.recipe||bill.suspended||stations.has(station.id))return false;
      const key=spot.z*w.width+spot.x;
      if(c.spot.x!==spot.x||c.spot.z!==spot.z||spots.has(key))return false;
      stations.add(station.id);spots.add(key);
      const view=withoutQueuedOrder(w,order),incoming=new Map<number,{item:ProductionIngredient;quantity:number}>();
      for(const part of c.ingredients){
        const pile=w.piles.find(p=>p.id===part.pileId);
        if(!pile||pile.item!==part.item||pile.owner.type!=='ground'||!bill.filters[part.item]||reservedSource(w,pile.id)>pile.quantity
          ||(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2||ticksUntilRot(pile,w.tick)<=0
          ||!ingredientWithinReach(part.cell,spot,station)||!ingredientPlaceFree(w,part.cell,spot,c.recipe!,station,geometry))return false;
        if(part.stage==='placed'){
          if(pile.owner.x!==part.cell.x||pile.owner.z!==part.cell.z)return false;
        }else{
          const cellKey=part.cell.z*w.width+part.cell.x,prior=incoming.get(cellKey),quantity=(prior?.quantity??0)+part.quantity;
          if(prior&&prior.item!==part.item||groundCapacity(view,part.cell,part.item,undefined,geometry)<quantity)return false;
          incoming.set(cellKey,{item:part.item,quantity});
        }
      }
    }
    return true;
  }catch{return false;}
}

/** Shared literal building/bill validation. No map authority is required for
 * actual minified originals; only their scalar research/allocator context. */
export function validateCookingBuildingRecords258(w:Pick<World,'schemaVersion'|'research'|'nextId'>,version:number,ids:Set<number>,buildings:readonly import('./types.ts').Structure[]):string[] {
  const errors:string[]=[];
  for(const s of buildings) {
    if(!validBillWorkerBuilding283(s,version,w.nextId)){errors.push('Invalid or future bill worker settings.');continue;}
    const recipe=stationRecipe(s);
    if((s.kind==='fueled-smithy'||s.kind==='electric-smithy')&&!isSchema267OrLater(version)){errors.push('Future smithy.');continue;}
    if(s.kind==='brewery'&&version<265){errors.push('Future brewery.');continue;}
    if(s.kind==='electric-crematorium'&&version<225){errors.push('Future electric crematorium.');continue;}
    if(s.kind==='electric-smelter'&&version<222){errors.push('Future electric smelter.');continue;}
    if(s.kind==='biofuel-refinery'&&version<218){errors.push('Future biofuel refinery.');continue;}
    if(s.kind==='drug-lab'&&version<206){errors.push('Future drug laboratory.');continue;}
    if(!recipe||version<32&&recipe==='stone-blocks'||version<72&&recipe==='tribalwear'||version<79&&recipe==='butcher-creature'||version<101&&s.kind==='machining-table'||version<104&&s.kind==='art-bench'||version<123&&s.kind==='fabrication-bench') {if(s.bills!==undefined)errors.push('Bills attached to a non-workstation.');continue;}
    if(!Array.isArray(s.bills)||s.bills.length>64){errors.push('Invalid workstation bills.');continue;}
    for(const b of s.bills) {
      if(isSmithingRecipe267(b?.recipe)&&(!smithingRecipeAvailable267(b.recipe,version)||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable smithing bill.');continue;}
      if(b?.recipe==='smelt-apparel'&&!isSchema267OrLater(version)){errors.push('Future apparel smelting bill.');continue;}
      if(b?.recipe==='brew-wort'&&version<265){errors.push('Future wort bill.');continue;}
      if(isBurnApparelRecipe(b?.recipe)&&version<251){errors.push('Future apparel-burning bill.');continue;}
      if(isPemmicanRecipe(b?.recipe)&&(version<248||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable pemmican bill.');continue;}
      if(isKibbleRecipe(b?.recipe)&&version<227){errors.push('Future kibble bill.');continue;}
      if(isCremationRecipe(b?.recipe)&&(version<225||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable cremation bill.');continue;}
      if(isSmeltingRecipe(b?.recipe)&&(version<222||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable smelting bill.');continue;}
      if(isBiofuelRecipe(b?.recipe)&&(version<218||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable biofuel bill.');continue;}
      if(b?.recipe==='make-medicine'&&(version<206||!productionResearchUnlocked(w,b.recipe))){errors.push('Unavailable medicine bill.');continue;}
      if(version<197&&record(b)&&record(b.filters)&&Object.keys(b.filters).some(key=>V219_ITEM_IDS.some(item=>item===key))){errors.push('Future mechanical carcass bill filter.');continue;}
      if(!record(b)||!int(b.id,1,w.nextId-1)||!stationAccepts(s,b.recipe)||version<194&&(isMechSalvageRecipe(b.recipe)||Object.hasOwn(b.filters??{},'scyther-corpse'))||b.recipe==='cook-survival-meal'&&(version<188||!packagedSurvivalMealsUnlocked(w))||version<152&&b.recipe==='fine-meal'||version<154&&b.recipe==='lavish-meal'||version<155&&b.recipe==='vegetarian-fine-meal'||version<156&&b.recipe==='carnivore-fine-meal'||version<157&&b.recipe==='vegetarian-lavish-meal'||version<159&&b.recipe==='cook-carnivore-lavish-meal'||version<160&&b.recipe==='cook-simple-meal-bulk'||version<161&&b.recipe==='cook-fine-meal-bulk'||version<162&&b.recipe==='cook-vegetarian-fine-meal-bulk'||version<163&&b.recipe==='cook-carnivore-fine-meal-bulk'||version<164&&b.recipe==='cook-lavish-meal-bulk'||version<165&&b.recipe==='cook-vegetarian-lavish-meal-bulk'||version<166&&b.recipe==='cook-carnivore-lavish-meal-bulk'||version<101&&isGunRecipe(b.recipe)||version<104&&isArtRecipe(b.recipe)||version<109&&isFlakRecipe(b.recipe)||version<141&&b.recipe==='make-flak-helmet'||version<148&&b.recipe==='make-recon-helmet'||version<241&&b.recipe==='make-recon-armor'||version<245&&b.recipe==='tuque'||version<123&&b.recipe==='make-component'||version<139&&b.recipe==='make-advanced-component'||!validBillSettings(b,b.recipe,version)||Object.hasOwn(b.filters??{},'fine-meal')||Object.hasOwn(b.filters??{},'lavish-meal')||Object.hasOwn(b.filters??{},'vegetarian-fine-meal')||Object.hasOwn(b.filters??{},'carnivore-fine-meal')||Object.hasOwn(b.filters??{},'vegetarian-lavish-meal')||Object.hasOwn(b.filters??{},'carnivore-lavish-meal')||version<148&&Object.keys(b.filters??{}).some(i=>i==='recon-helmet'||i==='unfinished-recon-helmet')||version<178&&Object.keys(b.filters??{}).some(i=>V190_ITEM_IDS.includes(i))||version<120&&Object.keys(b.filters??{}).some(i=>V120_ANIMAL_PRODUCT_ITEMS.includes(i))||version<91&&Object.keys(b.filters??{}).some(i=>V91_ITEM_IDS.includes(i))||version<79&&b.filters&&Object.hasOwn(b.filters,'hare-meat')||version<84&&b.filters&&['potato','corn'].some(i=>Object.hasOwn(b.filters,i)))errors.push('Invalid cooking bill.');
      else {if(ids.has(b.id))errors.push('Duplicate bill identity.');ids.add(b.id);}
    }
  }
  return errors;
}
