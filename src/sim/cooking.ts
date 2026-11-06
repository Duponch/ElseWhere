import {validProstheticIngredients273} from './machining.ts';
import {isProstheticRecipe273} from './prosthetic-content-273.ts';
import {beginProstheticWork273} from './prosthetic-work-273.ts';
import {isSmithingWeaponRecipe267,smithingRecipeAvailable267,isSmithingRecipe267,smithingMaterialFromIngredients267,smithingProduct267,smithingWorkTotal267} from './smithing-content-267.ts';
import {beginSmithingWork267} from './smithing-work-267.ts';
import {brewingSpeed265,validWortIngredients265} from './brewing-content-265.ts';
import {eggAllowedForPlayer256} from './animal-egg-permission-v256.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {isBurnApparelRecipe,burnApparelIngredientAllowed,validBurnApparelIngredients} from './burn-apparel-rules.ts';
import {isPemmicanRecipe,validPemmicanIngredients} from './pemmican-content.ts';
import { shelfAt } from './shelf-storage.ts';
import {isMechSalvageRecipe,mechSalvageSpeed,finishMechSalvage} from './mechanoid-salvage.ts';
import { workPriority } from './work-types.ts';
import { isKibbleRecipe,validKibbleIngredients,kibbleOutputUnits } from './fodder-recipes.ts';
import { allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed,smeltingSpeed,validSmeltingIngredients } from './smelting-rules.ts';
import {finishBurnApparel} from './burn-apparel.ts';
import { finishSmelting } from './smelting.ts';
import { isCremationRecipe,cremationIngredientAllowed,cremationSpeed,validCremationIngredients } from './cremation-rules.ts';
import { finishCremation } from './cremation.ts';
import { burialClaim } from './burial.ts';
import { canStandAt } from './furniture-travel.ts';
import { recipeHasProducts } from './production-recipes.ts';
import { pawnBody,medicalWorkRefusal } from './health-rules.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { beginArtWork } from './art-work.ts';
import { isArtRecipe,artWorkTotal,artisticSkill } from './art-rules.ts';
import { completeArtProduction } from './art-production.ts';
import { beginGunWork } from './gun-work.ts';
import { beginFlakWork } from './flak-work.ts';
import { beginComponentWork } from './component-work.ts';
import { biofuelProductionSpeed,completedMedicineSkill,medicineProductionSpeed,productionResearchUnlocked,productionWorkerQualified } from './machining.ts';
import { isBiofuelRecipe,validBiofuelIngredients,validMedicineIngredients,isFlakRecipe,isGunRecipe,stationAccepts } from './production-recipes.ts';
import { newWeaponState,type WeaponItem } from './equipment-rules.ts';
import { isAnimalCorpseItem, isAnimalMeat } from './biome-items.ts';
import { foodStationUsable } from './food-workstations.ts';
import { consumeCookingFuel } from './fuel.ts';
import { applyCookingHeat } from './thermal-sources.ts';
import { corpseFresh } from './corpses.ts';
import { finishButchery } from './butchery.ts';
import { foodPoisonFromRecipe } from './food-poisoning.ts';
import { roomCleanliness } from './filth.ts';
import { cookingSpeed,butcherySpeed,completedCookingSkill } from './cooking-statistics.ts';
import { beginUnfinished, unfinishedMaterial } from './unfinished.ts';
import { craftingQuality,craftingSkill } from './crafting-quality.ts';
import { learnSkill } from './skills.ts';
import { healthRandom } from './health.ts';
import { newApparelState, type ApparelItem } from './apparel-rules.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { isComponentRecipe,isTailoring, PRODUCTION_RECIPES, PRODUCTION_WORK_SCALE, productionStationUsable, productionWorkTotal, recipeProduct, taskRecipe, taskWork, validSurvivalMealIngredients, validFineMealIngredients, validFineMealBulkIngredients, validLavishMealIngredients, validLavishMealBulkIngredients, validVegetarianFineMealIngredients, validVegetarianFineMealBulkIngredients, validVegetarianLavishMealIngredients, validVegetarianLavishMealBulkIngredients, validCarnivoreFineMealIngredients, validCarnivoreFineMealBulkIngredients, validCarnivoreLavishMealIngredients, validCarnivoreLavishMealBulkIngredients } from './production-recipes.ts';
import { processProductionOutput, type ProductionContext } from './production-output.ts';
import { copyPileCondition } from './pile-condition.ts';
import { freshRot, ticksUntilRot } from './food-preservation.ts';
import { groundPile } from './ground-placement.ts';
import { transferPile, reservedSource } from './materials.ts';
import type { MaterialPile, Pawn, World } from './types.ts';
import { structureById } from './structure-navigation.ts';

const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
function take(world:World,pawn:Pawn,pile:MaterialPile,quantity:number):MaterialPile|null {
  if(!eggAllowedForPlayer256(pile)||pile.quantity<quantity||pile.owner.type!=='ground'||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id))return null;
  if(pile.quantity===quantity){pile.owner={type:'pawn',pawnId:pawn.id};return pile;}
  if(world.piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  pile.quantity-=quantity;
  const carried:MaterialPile={id:world.nextId++,item:pile.item,kind:pile.kind,quantity,owner:{type:'pawn',pawnId:pawn.id},...copyPileCondition(pile)};
  world.piles.push(carried);return carried;
}
export function processCooking(world:World,pawn:Pawn,context:ProductionContext):void {
  const task=pawn.cooking!;
  if(!allowedAreaWorkAllowed(world,pawn)){context.release();return;}
  const smithing=isSmithingRecipe267(task.recipe);
  const prostheticRecipe=isProstheticRecipe273(task.recipe);
  if(prostheticRecipe&&(pawn.draft||pawn.stun||pawn.state==='dead'||pawn.state==='downed'||medicalWorkRefusal(pawn)||pawn.burning||pawn.mental?.crisis)){context.release();return;}
  if(prostheticRecipe&&((pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0))return;
  if(smithing&&(!smithingRecipeAvailable267(task.recipe as import('./smithing-content-267.ts').SmithingRecipe267,world.schemaVersion)||pawn.draft||pawn.stun||pawn.state==='dead'||pawn.state==='downed'||medicalWorkRefusal(pawn)||pawn.burning||pawn.mental?.crisis)){context.release();return;}
  if(smithing&&((pawn.motion?.end??0)>world.tick||pawn.moveCooldown>0))return;
  const brewing=task.recipe==='brew-wort';
  if(brewing&&(world.schemaVersion<265||task.phase!=='output'&&task.phase!=='interrupted'&&!validWortIngredients265(task.ingredients))){context.release();return;}
  const medicine=task.recipe==='make-medicine';
  const kibble=isKibbleRecipe(task.recipe),pemmican=isPemmicanRecipe(task.recipe);
  if(pemmican&&world.schemaVersion<248){context.release();return;}
  if(kibble&&world.schemaVersion<227){context.release();return;}
  const biofuel=isBiofuelRecipe(task.recipe);
  const smelting=isSmeltingRecipe(task.recipe);
  const cremation=isCremationRecipe(task.recipe),burningApparel=isBurnApparelRecipe(task.recipe);
  if(burningApparel&&world.schemaVersion<251){context.release();return;}
  if((smelting||cremation||burningApparel)&&((pawn.motion?.end??0)>world.tick||(cremation||burningApparel)&&pawn.moveCooldown>0))return;
  if((smelting||cremation||burningApparel)&&(pawn.stun||pawn.draft||pawn.state==='downed'||pawn.state==='dead'||pawnBody(pawn).capacities.manipulation<=0||(cremation||burningApparel)&&(medicalWorkRefusal(pawn)||(pawn.faction??'colony')!=='colony'||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.burning||pawn.mental?.crisis||pawn.collapsePending||workPriority(pawn,'haul')===0))){context.release();return;}
  if(task.phase==='interrupted'){context.release();return;}
  const station=structureById(world,task.stationId),bill=station?.bills?.find(b=>b.id===task.billId);
  if((smithing||brewing||pemmican||kibble||medicine||biofuel||smelting||cremation||burningApparel)&&(!station||!bill||bill.recipe!==task.recipe||!stationAccepts(station,task.recipe!))){context.release();return;}
  if(backgroundWorkRefusal(pawn,taskWork(task))||!station||!bill||bill.suspended||task.recipe==='cook-survival-meal'&&!stationAccepts(station,task.recipe)||!productionResearchUnlocked(world,taskRecipe(task))||task.phase!=='output'&&!productionWorkerQualified(pawn,taskRecipe(task))||workPriority(pawn,taskWork(task))===0&&pawn.orders.active!=='cook'||(task.phase!=='output'&&(!foodStationUsable(station)||!productionStationUsable(station)))) {context.release();return;}
  if(task.phase==='output'){if(!recipeHasProducts(taskRecipe(task))){context.release();return;}processProductionOutput(world,pawn,context,bill.destination);return;}
  const recipe=PRODUCTION_RECIPES[taskRecipe(task)];
  if(isProstheticRecipe273(task.recipe)&&bill.recipe!==task.recipe){context.release();return;}
  if(isProstheticRecipe273(task.recipe)&&!(task.ingredients.length===1&&task.ingredients[0]!.item==='unfinished-prosthetic')&&!validProstheticIngredients273(task.recipe,task.ingredients)){context.release();return;}
  if(pemmican&&!validPemmicanIngredients(task.ingredients)){context.release();return;}
  if(kibble&&!validKibbleIngredients(task.ingredients)){context.release();return;}
  if(medicine&&!validMedicineIngredients(taskRecipe(task),task.ingredients)){context.release();return;}
  if(biofuel&&!validBiofuelIngredients(taskRecipe(task),task.ingredients)){context.release();return;}
  if(smelting&&(!validSmeltingIngredients(task.ingredients,task.recipe)||(task.recipe==='smelt-weapon'||task.recipe==='smelt-apparel')&&bill.mode==='until')){context.release();return;}
  if(burningApparel&&(!validBurnApparelIngredients(task.ingredients)||bill.mode==='until'||bill.destination!=='drop'||bill.mode==='times'&&bill.target<=0)){context.release();return;}
  if(cremation&&(!validCremationIngredients(task.ingredients)||bill.mode==='until'||bill.destination!=='drop'||bill.mode==='times'&&bill.target<=0)){context.release();return;}
  if((pemmican||task.recipe==='cook-survival-meal'||task.recipe==='cook-simple-meal-bulk'||task.recipe==='cook-fine-meal-bulk'||task.recipe==='cook-lavish-meal-bulk'||task.recipe==='vegetarian-fine-meal'||task.recipe==='cook-vegetarian-fine-meal-bulk'||task.recipe==='carnivore-fine-meal'||task.recipe==='cook-carnivore-fine-meal-bulk'||task.recipe==='vegetarian-lavish-meal'||task.recipe==='cook-vegetarian-lavish-meal-bulk'||task.recipe==='cook-carnivore-lavish-meal'||task.recipe==='cook-carnivore-lavish-meal-bulk')&&bill.recipe!==task.recipe){context.release();return;}
  if(task.recipe==='cook-survival-meal'&&!validSurvivalMealIngredients(task.ingredients)||task.recipe==='fine-meal'&&!validFineMealIngredients(task.ingredients)||task.recipe==='cook-fine-meal-bulk'&&!validFineMealBulkIngredients(task.ingredients)||task.recipe==='vegetarian-fine-meal'&&!validVegetarianFineMealIngredients(task.ingredients)||task.recipe==='cook-vegetarian-fine-meal-bulk'&&!validVegetarianFineMealBulkIngredients(task.ingredients)||task.recipe==='carnivore-fine-meal'&&!validCarnivoreFineMealIngredients(task.ingredients)||task.recipe==='cook-carnivore-fine-meal-bulk'&&!validCarnivoreFineMealBulkIngredients(task.ingredients)||task.recipe==='lavish-meal'&&!validLavishMealIngredients(task.ingredients)||task.recipe==='cook-lavish-meal-bulk'&&!validLavishMealBulkIngredients(task.ingredients)||task.recipe==='vegetarian-lavish-meal'&&!validVegetarianLavishMealIngredients(task.ingredients)||task.recipe==='cook-vegetarian-lavish-meal-bulk'&&!validVegetarianLavishMealBulkIngredients(task.ingredients)||task.recipe==='cook-carnivore-lavish-meal'&&!validCarnivoreLavishMealIngredients(task.ingredients)||task.recipe==='cook-carnivore-lavish-meal-bulk'&&!validCarnivoreLavishMealBulkIngredients(task.ingredients)){context.release();return;}
  const smithingPiece=smithing&&task.ingredients.length===1?world.piles.find(p=>p.id===task.ingredients[0]!.pileId&&p.smithingWork):undefined;
  if(smithing&&!smithingPiece&&!smithingMaterialFromIngredients267(task.recipe as import('./smithing-content-267.ts').SmithingRecipe267,task.ingredients)){context.release();return;}
  if(smithingPiece&&(!bill.filters[smithingPiece.smithingWork!.material]||smithingPiece.smithingWork!.authorId!==pawn.id)){context.release();return;}
  for(const entry of task.ingredients) {
    const pile=world.piles.find(p=>p.id===entry.pileId);
    if((smithing||prostheticRecipe)&&pile&&!materialAllowedForPlayer256(pile)){context.release();return;}
    if(smithing&&(!pile||!smithingPiece&&!bill.filters[entry.item]||entry.stage==='source'&&(pile.owner.type!=='ground'||(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2)||entry.stage==='placed'&&(pile.owner.type!=='ground'||pile.owner.x!==entry.cell.x||pile.owner.z!==entry.cell.z)||entry.stage==='held'&&(pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id))){context.release();return;}
    if(cremation&&!canStandAt(world,entry.cell)){context.release();return;}
    if((pemmican||kibble||biofuel)&&entry.stage!=='placed'&&entry.quantity>10){context.release();return;}
    if((brewing||pemmican||kibble||medicine||biofuel||smelting||cremation||burningApparel)&&(!bill.filters[entry.item]||!pile||burningApparel&&!burnApparelIngredientAllowed(bill,pile)||smelting&&!smeltingIngredientAllowed(bill,pile)
      ||cremation&&(!cremationIngredientAllowed(world,bill,pile)||pile.humanCorpse&&burialClaim(world,pile.humanCorpse.pawnId,pawn.id))
      ||entry.stage==='source'&&(pile.owner.type!=='ground'||(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2)
      ||entry.stage==='placed'&&(pile.owner.type!=='ground'||pile.owner.x!==entry.cell.x||pile.owner.z!==entry.cell.z)
      ||entry.stage==='held'&&(pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id))){context.release();return;}
    if((brewing||pemmican||kibble||task.recipe==='chemfuel-from-organics')&&pile&&ticksUntilRot(pile,world.tick)<=0){context.release();return;}
    if(!pile||!cremation&&isAnimalCorpseItem(pile.item)&&!corpseFresh(pile,world.tick)||(task.recipe==='cook-survival-meal'||task.recipe==='cook-simple-meal-bulk'||task.recipe==='cook-fine-meal-bulk'||task.recipe==='cook-lavish-meal-bulk'||task.recipe==='vegetarian-fine-meal'||task.recipe==='cook-vegetarian-fine-meal-bulk'||task.recipe==='carnivore-fine-meal'||task.recipe==='cook-carnivore-fine-meal-bulk'||task.recipe==='vegetarian-lavish-meal'||task.recipe==='cook-vegetarian-lavish-meal-bulk'||task.recipe==='cook-carnivore-lavish-meal'||task.recipe==='cook-carnivore-lavish-meal-bulk')&&ticksUntilRot(pile,world.tick)<=0||pile.item!==entry.item||pile.quantity<entry.quantity||entry.stage!=='held'&&reservedSource(world,pile.id)>pile.quantity){context.release();return;}
    if((cremation||burningApparel)&&reservedSource(world,pile.id,pawn.id)>0){context.release();return;}
    if((task.recipe==='cook-survival-meal'||task.recipe==='cook-simple-meal-bulk'||task.recipe==='cook-fine-meal-bulk'||task.recipe==='cook-lavish-meal-bulk'||task.recipe==='vegetarian-fine-meal'||task.recipe==='cook-vegetarian-fine-meal-bulk'||task.recipe==='carnivore-fine-meal'||task.recipe==='cook-carnivore-fine-meal-bulk'||task.recipe==='vegetarian-lavish-meal'||task.recipe==='cook-vegetarian-lavish-meal-bulk'||task.recipe==='cook-carnivore-lavish-meal'||task.recipe==='cook-carnivore-lavish-meal-bulk')&&(!bill.filters[entry.item]
      ||entry.stage==='source'&&(pile.owner.type!=='ground'||(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2)
      ||entry.stage==='placed'&&(pile.owner.type!=='ground'||pile.owner.x!==entry.cell.x||pile.owner.z!==entry.cell.z)
      ||entry.stage==='held'&&(pile.owner.type!=='pawn'||pile.owner.pawnId!==pawn.id))){context.release();return;}
  }
  const held=task.ingredients.find(i=>i.stage==='held');
  if(held) {
    if(pawn.x!==task.spot.x||pawn.z!==task.spot.z){context.move(task.spot,true);return;}
    const pile=world.piles.find(p=>p.id===held.pileId)!;
    task.actionCell={...held.cell};
    if(shelfAt(world,held.cell)){context.release();return;}
    if(!transferPile(world,pile,{type:'ground',...held.cell})){context.release();return;}
    held.pileId=groundPile(world,held.cell)!.id;held.stage='placed';pawn.path=[];pawn.planCooldown=0;pawn.state='working';return;
  }
  const source=task.ingredients.find(i=>i.stage==='source');
  if(source) {
    const pile=world.piles.find(p=>p.id===source.pileId)!;
    if(pile.owner.type!=='ground'){context.release();return;}
    if(!near(pawn,pile.owner)){context.move(pile.owner,false);return;}
    task.actionCell={x:pile.owner.x,z:pile.owner.z};
    const carried=take(world,pawn,pile,source.quantity);if(!carried){context.release();return;}
    source.pileId=carried.id;source.stage='held';pawn.path=[];pawn.planCooldown=0;pawn.state='working';return;
  }
  if(pawn.x!==task.spot.x||pawn.z!==task.spot.z){context.move(task.spot,true);return;}
  task.actionCell={x:station.x,z:station.z};
  let total=productionWorkTotal(taskRecipe(task));
  task.phase='work';pawn.state='working';pawn.path=[];
  const unfinished=isTailoring(task.recipe)?beginUnfinished(world,pawn):null;
  if(isTailoring(task.recipe)&&!unfinished){context.release();return;}
  const prosthetic=isProstheticRecipe273(task.recipe)?beginProstheticWork273(world,pawn):null;
  if(isProstheticRecipe273(task.recipe)&&!prosthetic){context.release();return;}
  const gun=isGunRecipe(task.recipe)?beginGunWork(world,pawn):null;
  if(isGunRecipe(task.recipe)&&!gun){context.release();return;}
  const smith=smithing?beginSmithingWork267(world,pawn):null;
  if(smithing&&!smith){context.release();return;}
  if(smith){total=smithingWorkTotal267(smith.smithingWork!.recipe,smith.smithingWork!.material);task.progress=smith.smithingWork!.progress;pawn.skills.crafting??={...craftingSkill(pawn)};if(task.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);}
  const flak=isFlakRecipe(task.recipe)?beginFlakWork(world,pawn):null;
  if(isFlakRecipe(task.recipe)&&!flak){context.release();return;}
  const component=isComponentRecipe(task.recipe)?beginComponentWork(world,pawn):null;
  if(isComponentRecipe(task.recipe)&&!component){context.release();return;}
  if(prosthetic){pawn.skills.crafting??={...craftingSkill(pawn)};if(prosthetic.prostheticWork273!.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);task.progress=prosthetic.prostheticWork273!.progress;}
  if(gun){pawn.skills.crafting??={...craftingSkill(pawn)};if(gun.gunWork!.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);task.progress=gun.gunWork!.progress;}
  if(flak){pawn.skills.crafting??={...craftingSkill(pawn)};if(flak.flakWork!.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);task.progress=flak.flakWork!.progress;}
  if(component){pawn.skills.crafting??={...craftingSkill(pawn)};if(component.componentWork!.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);task.progress=component.componentWork!.progress;}
  if(unfinished){pawn.skills.crafting??={...craftingSkill(pawn)};if(unfinished.unfinished!.progress<total)learnSkill(pawn.skills.crafting,1000,pawn);task.progress=unfinished.unfinished!.progress;}
  const art=isArtRecipe(task.recipe)?beginArtWork(world,pawn):null;
  if(isArtRecipe(task.recipe)&&!art){context.release();return;}
  if(art){total=artWorkTotal(art.artWork!.recipe,art.artWork!.material);task.progress=art.artWork!.progress;pawn.skills.artistic??={...artisticSkill(pawn)};if(task.progress<total)learnSkill(pawn.skills.artistic,1000,pawn);}
  const culinary=taskWork(task)==='cook',mechanical=isMechSalvageRecipe(task.recipe);
  if(task.progress<total){
    if(culinary||mechanical||medicine){if(!Number.isSafeInteger((task.workTicks??0)+1)||((task.workTicks??0)+1)>Math.floor(Number.MAX_SAFE_INTEGER/1000))return;task.workTicks=(task.workTicks??0)+1;}
    const speed=prosthetic?biofuelProductionSpeed(pawn):smithing?biofuelProductionSpeed(pawn):brewing?brewingSpeed265(pawn):burningApparel?cremationSpeed(pawn):cremation?cremationSpeed(pawn):smelting?smeltingSpeed(pawn):biofuel?biofuelProductionSpeed(pawn):medicine?medicineProductionSpeed(pawn):mechanical?mechSalvageSpeed(pawn):task.recipe==='butcher-creature'?butcherySpeed(pawn):culinary?cookingSpeed(pawn):1;
    const fraction=medicine||biofuel?1:consumeCookingFuel(station);if(!medicine&&!biofuel)applyCookingHeat(world,station,fraction);
    task.progress=Math.min(total,task.progress+Math.round(context.workRate(station,pawn)*speed*PRODUCTION_WORK_SCALE*fraction));
  }
  if(unfinished)unfinished.unfinished!.progress=task.progress;
  if(prosthetic)prosthetic.prostheticWork273!.progress=task.progress;
  if(gun)gun.gunWork!.progress=task.progress;
  if(smith)smith.smithingWork!.progress=task.progress;
  if(flak)flak.flakWork!.progress=task.progress;
  if(component)component.componentWork!.progress=task.progress;
  if(art)art.artWork!.progress=task.progress;
  if(task.progress<total)return;
  if(burningApparel){finishBurnApparel(world,pawn,bill,context);return;}
  if(cremation){finishCremation(world,pawn,bill,context);return;}
  if(smelting){finishSmelting(world,pawn,bill,context);return;}
  if(art){completeArtProduction(world,pawn,task,context);return;}
  if(mechanical){finishMechSalvage(world,pawn,bill,context);return;}
  if(task.recipe==='butcher-creature'){finishButchery(world,pawn,bill,context);return;}
  const used=new Map<number,number>();for(const i of task.ingredients)used.set(i.pileId,(used.get(i.pileId)??0)+i.quantity);
  const freed=[...used].filter(([id,n])=>world.piles.find(p=>p.id===id)?.quantity===n).length;
  if(world.piles.length-freed+1>32768||!Number.isSafeInteger(world.nextId+1))return;
  const agave=task.ingredients.filter(i=>i.item==='agave-fruit').reduce((n,i)=>n+i.quantity,0);
  const meat=task.ingredients.filter(i=>isAnimalMeat(i.item)).reduce((n,i)=>n+i.quantity,0);
  const material=unfinished?unfinishedMaterial(unfinished.unfinished!):undefined;
  const rice=task.ingredients.filter(i=>i.item==='rice').reduce((n,i)=>n+i.quantity,0),item=smith?smithingProduct267(smith.smithingWork!.recipe,smith.smithingWork!.material):recipeProduct(taskRecipe(task),task.ingredients,material);
  const potato=task.ingredients.filter(i=>i.item==='potato').reduce((n,i)=>n+i.quantity,0),corn=task.ingredients.filter(i=>i.item==='corn').reduce((n,i)=>n+i.quantity,0);
  if(isTailoring(task.recipe)&&!Number.isSafeInteger((world.tailoring?.completed??0)+1))return;
  const random={rng:world.rng},apparel=smithing&&!isSmithingWeaponRecipe267(task.recipe)||isTailoring(task.recipe)||isFlakRecipe(task.recipe)?{...newApparelState(item as ApparelItem,material,world.schemaVersion),quality:craftingQuality(craftingSkill(pawn).level,()=>healthRandom(random))}:undefined;
  const weapon=isGunRecipe(task.recipe)||isSmithingWeaponRecipe267(task.recipe)?{...newWeaponState(item as WeaponItem),quality:craftingQuality(craftingSkill(pawn).level,()=>healthRandom(random))}:undefined;
  const foodPoison=world.schemaVersion>=89&&culinary&&!kibble&&!brewing?foodPoisonFromRecipe(roomCleanliness(world,pawn),(pawn.skills.cooking?.level??0),()=>healthRandom(random)):undefined;
  const medicineSkill=medicine?completedMedicineSkill(pawn,task.workTicks??0):undefined;
  // All preconditions succeeded. Consume once, create once, then store physically.
  for(const [id,quantity] of used)world.piles.find(p=>p.id===id)!.quantity-=quantity;
  world.piles=world.piles.filter(p=>p.quantity>0);
  const id=world.nextId++;world.piles.push({id,item,kind:ITEM_DEFINITIONS[item].kind,quantity:kibble?kibbleOutputUnits(station):recipe.outputUnits,owner:{type:'pawn',pawnId:pawn.id},...freshRot(item,world.tick),...(foodPoison?{foodPoison}:{}),...apparel?{apparel}:{},...(weapon?{weapon}:{})});
  world.rng=random.rng;
  if(medicineSkill)pawn.skills.intellectual=medicineSkill;
  if(isTailoring(task.recipe)){(world.tailoring??={completed:0,cancelled:0,lostCloth:0}).completed++;}
  task.ingredients=[];task.productId=id;task.phase='output';task.progress=0;if(culinary)pawn.skills.cooking=completedCookingSkill(pawn,task.workTicks??0);delete task.workTicks;pawn.planCooldown=0;
  if(bill.mode==='times')bill.target=Math.max(0,bill.target-1);
  if(brewing){context.event(`${pawn.name} a brassé 5 unités de moût.`);return;}
  if(medicine){context.event(`${pawn.name} a fabriqué 1 médicament.`);return;}
  if(pemmican){context.event(`${pawn.name} a préparé 16 unités de pemmican.`);return;}
  if(kibble){context.event(`${pawn.name} a fabriqué ${kibbleOutputUnits(station)} croquettes.`);return;}
  if(biofuel){context.event(`${pawn.name} a raffiné 35 unités de biocarburant.`);return;}
  context.event(isProstheticRecipe273(task.recipe)||smithing||isGunRecipe(task.recipe)||isFlakRecipe(task.recipe)||isComponentRecipe(task.recipe)||isTailoring(task.recipe)?`${pawn.name} a fabriqué : ${ITEM_DEFINITIONS[item].label.toLowerCase()}.`:task.recipe==='cook-survival-meal'?`${pawn.name} a cuisiné 1 repas de survie emballé.`:task.recipe==='stone-blocks'?`${pawn.name} a taillé 20 ${ITEM_DEFINITIONS[item].label.toLowerCase()}.`:task.recipe==='cook-simple-meal-bulk'?`${pawn.name} a cuisiné 4 repas simples.`:task.recipe==='fine-meal'?`${pawn.name} a cuisiné 1 plat raffiné.`:task.recipe==='cook-fine-meal-bulk'?`${pawn.name} a cuisiné 4 plats raffinés.`:task.recipe==='vegetarian-fine-meal'?`${pawn.name} a cuisiné 1 plat végétarien raffiné.`:task.recipe==='cook-vegetarian-fine-meal-bulk'?`${pawn.name} a cuisiné 4 plats végétariens raffinés.`:task.recipe==='carnivore-fine-meal'?`${pawn.name} a cuisiné 1 plat carnivore raffiné.`:task.recipe==='cook-carnivore-fine-meal-bulk'?`${pawn.name} a cuisiné 4 plats carnivores raffinés.`:task.recipe==='lavish-meal'?`${pawn.name} a cuisiné 1 plat gastronomique.`:task.recipe==='cook-lavish-meal-bulk'?`${pawn.name} a cuisiné 4 plats gastronomiques.`:task.recipe==='vegetarian-lavish-meal'?`${pawn.name} a cuisiné 1 plat végétarien gastronomique.`:task.recipe==='cook-vegetarian-lavish-meal-bulk'?`${pawn.name} a cuisiné 4 plats végétariens gastronomiques.`:task.recipe==='cook-carnivore-lavish-meal'?`${pawn.name} a cuisiné 1 plat carnivore gastronomique.`:task.recipe==='cook-carnivore-lavish-meal-bulk'?`${pawn.name} a cuisiné 4 plats carnivores gastronomiques.`:`${pawn.name} a cuisiné 1 repas simple (${10-rice-meat-potato-corn-agave} baies, ${rice} riz${meat?`, ${meat} viande`:''}${potato?`, ${potato} pommes de terre`:''}${corn?`, ${corn} maïs`:''}${agave?`, ${agave} fruits d’agave`:''}).`);
}
