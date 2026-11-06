import {isProstheticRecipe273} from './prosthetic-content-273.ts';
import {billWorkerRefusal283} from './bill-worker-rules-283.ts';
import {validProstheticIngredients273} from './machining.ts';
import {isSmithingRecipe267,smithingWorkpiece267,smithingMaterialFromIngredients267} from './smithing-content-267.ts';
import {isBurnApparelRecipe,burnApparelIngredientAllowed,validBurnApparelIngredients} from './burn-apparel-rules.ts';
import {billWork,taskWork} from './production-recipes.ts';
import { workPriority } from './work-types.ts';
import { isKibbleRecipe,validKibbleIngredients } from './fodder-recipes.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed } from './smelting-rules.ts';
import { isCremationRecipe,cremationIngredientAllowed,validCremationIngredients } from './cremation-rules.ts';
import { burialClaim } from './burial.ts';
import { canStandAt } from './furniture-travel.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { backgroundWorkRefusal } from './colonist-backgrounds.ts';
import { validBiofuelIngredients,validMedicineIngredients,productionStationUsable,stationAccepts } from './production-recipes.ts';
import { productionResearchUnlocked,productionWorkerQualified } from './machining.ts';
import { isAnimalCorpseItem } from './biome-items.ts';
import { foodStationUsable, usesCookingFuel, isButcherStation } from './food-workstations.ts';
import { corpseFresh } from './corpses.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { isFlakRecipe,stationRecipe,  taskRecipe, validSurvivalMealIngredients, validFineMealIngredients, validFineMealBulkIngredients, validLavishMealIngredients, validLavishMealBulkIngredients, validVegetarianFineMealIngredients, validVegetarianFineMealBulkIngredients, validVegetarianLavishMealIngredients, validVegetarianLavishMealBulkIngredients, validCarnivoreFineMealIngredients, validCarnivoreFineMealBulkIngredients, validCarnivoreLavishMealIngredients, validCarnivoreLavishMealBulkIngredients, type ProductionIngredient } from './production-recipes.ts';
import { candidateAccess } from './candidate-access.ts';
import { billWanted, componentWorkpiecePlaceFree,cookingPlaceFree, cookingSpot, ingredientPlaceFree, ingredientWithinReach } from './cooking-bills.ts';
import { planCooking } from './cooking-planner.ts';
import { fuelStationReserved } from './fuel.ts';
import { groundCapacity } from './ground-placement.ts';
import { withoutQueuedOrder } from './haul-reservations.ts';
import { reservedSource } from './materials.ts';
import { blockedCells, cellIndex, interactionGoals, routeToCell, routeToJob } from './pathfinding.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { canReach, search, type NavigationGrid, type SearchBudget } from './work-planner.ts';
import type { CookingOrder } from './order-types.ts';
import type { Cell, HaulTask, Pawn, World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface CookingProposal { label:string;reason?:string;order?:CookingOrder|HaulTask;path?:Cell[] }
export function planCookingOrder(world:World,pawn:Pawn,stationId:number,access?:import('./pathfinding.ts').Reachability,budget={pairs:32768},forced=true):CookingProposal {
  const label='Produire au poste',no=(reason:string):CookingProposal=>({label,reason});
  const station=world.structures.find(s=>s.id===stationId&&stationRecipe(s)!==null);
  if(!station)return no('Poste de production introuvable.');
  if(station.kind==='electric-crematorium'){
    const unavailable=medicalWorkRefusal(pawn)??((pawn.faction??'colony')!=='colony'||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.stun||pawn.draft||pawn.burning||pawn.mental?.crisis||pawn.collapsePending?'Ce colon est indisponible pour transporter une dépouille.':undefined);
    if(unavailable)return no(unavailable);
  }
  const areaReason=allowedAreaReason(world,pawn,station);if(areaReason)return no(areaReason);
  if(!station.bills?.some(b=>billWanted(world,b)))return no('Aucune facture active à produire : vérifiez suspension et quantité demandée.');
  const enabled=(station.bills??[]).filter(b=>billWanted(world,b)&&workPriority(pawn,billWork(b))>0);
  const refusal=enabled.length&&enabled.every(b=>backgroundWorkRefusal(pawn,billWork(b)))?backgroundWorkRefusal(pawn,billWork(enabled[0]!)):undefined;if(refusal)return no(refusal);
  if(!enabled.length)return no('Métier désactivé dans le tableau Travail.');
  const admitted=enabled.filter(b=>!billWorkerRefusal283(world,pawn,b));
  if(!admitted.length)return no(billWorkerRefusal283(world,pawn,enabled[0]!)!);
  if(station.kind==='drug-lab'&&!productionResearchUnlocked(world,'make-medicine'))return no('La recherche Production de médicaments est nécessaire.');
  if(station.kind==='biofuel-refinery'&&!productionResearchUnlocked(world,'chemfuel-from-wood'))return no('La recherche Raffinage du biocarburant est nécessaire.');
  if(station.kind==='drug-lab'&&!productionWorkerQualified(pawn,'make-medicine'))return no('Artisanat 4 et Intellectuel 4 nécessaires.');
  if(fuelStationReserved(world,station.id))return no('Poste réservé pour une cuisine ou un ravitaillement.');
  if(station.kind==='electric-stove'&&!foodStationUsable(station))return no('La cuisinière n’est pas alimentée :350 W nécessaires.');
  if(station.kind==='biofuel-refinery'&&!productionStationUsable(station))return no('Raffinerie sans courant : 170 W nécessaires.');
  if(station.kind==='electric-smithy'&&!productionStationUsable(station))return no('Forge sans courant : 210 W nécessaires.');
  if(station.kind==='electric-smelter'&&!productionStationUsable(station))return no('Fonderie sans courant : 700 W nécessaires.');
  if(station.kind==='electric-crematorium'&&!productionStationUsable(station))return no('Crématorium sans courant : 250 W nécessaires.');
  if(!productionStationUsable(station))return no(station.kind==='fabrication-bench'?'Établi de fabrication sans courant : 250 W nécessaires.':'Atelier d’usinage sans courant : 350 W nécessaires.');
  const spot=cookingSpot(station);
  if(!cookingPlaceFree(world,spot)||reservedServiceCells(world).has(cellIndex(world,spot.x,spot.z)))return no('Place de cuisine obstruée ou réservée.');
  const reach=access??candidateAccess(world,pawn,blockedCells(world),new Set());
  if(!routeToCell(world,spot,reach))return no('Aucun accès à la place de cuisine.');
  const plan=planCooking(world,pawn,reach,budget,{stationId,forced});
  if(!plan)return no(!usesCookingFuel(station.kind)||station.fuel?.ticks?'Aucune recette réalisable : ingrédients autorisés dans le rayon, accès ou dépôt insuffisants.':'Aucun bois disponible et accessible pour rallumer le feu.');
  if(isBurnApparelRecipe(plan.task?.recipe))return {label:'Brûler des vêtements',order:{cooking:plan.task!},path:plan.path};
  if(station.kind==='drug-lab')return {label:'Fabriquer un médicament',order:{cooking:plan.task!},path:plan.path};
  if(station.kind==='biofuel-refinery')return {label:'Raffiner du biocarburant',order:{cooking:plan.task!},path:plan.path};
  if(station.kind==='electric-smelter')return {label:plan.task?.recipe==='smelt-slag'?'Extraire l’acier d’une scorie':'Fondre une arme',order:{cooking:plan.task!},path:plan.path};
  if(station.kind==='electric-crematorium')return {label:'Incinérer une dépouille',order:{cooking:plan.task!},path:plan.path};
  if(isKibbleRecipe(plan.task?.recipe))return {label:'Fabriquer des croquettes',order:{cooking:plan.task!},path:plan.path};
  if(plan.task?.recipe==='make-spear')return {label:'Fabriquer une lance',order:{cooking:plan.task},path:plan.path};
  if(plan.task?.recipe==='make-longsword')return {label:'Fabriquer une épée longue',order:{cooking:plan.task},path:plan.path};
  if(plan.task?.recipe==='make-mace')return {label:'Fabriquer une masse',order:{cooking:plan.task},path:plan.path};
  if(plan.task?.recipe==='make-plasteel-knife')return {label:'Fabriquer un couteau en plastacier',order:{cooking:plan.task},path:plan.path};
  return {label:plan.refuel?'Ravitailler avant de cuisiner':isButcherStation(station.kind)?'Dépecer une créature':station.kind==='tailor-bench'?'Confectionner un vêtement':station.kind==='crafting-spot'?'Confectionner une tenue tribale':station.kind==='art-bench'?'Sculpter une œuvre':station.kind==='fabrication-bench'?(plan.task?.recipe==='make-recon-armor'?'Fabriquer une combinaison de reconnaissance':plan.task?.recipe==='make-recon-helmet'?'Fabriquer un casque de reconnaissance':'Fabriquer un composant'):station.kind==='machining-table'?(plan.task?.recipe==='make-flak-helmet'?'Fabriquer un casque pare-balles':plan.task&&isFlakRecipe(plan.task.recipe)?'Fabriquer un gilet pare-balles':'Fabriquer une arme'):station.kind==='stonecutter'?'Tailler des blocs de pierre':plan.task?.recipe==='cook-survival-meal'?'Cuisiner un repas de survie emballé':plan.task?.recipe==='cook-simple-meal-bulk'?'Cuisiner quatre repas simples':plan.task?.recipe==='fine-meal'?'Cuisiner un plat raffiné':plan.task?.recipe==='cook-fine-meal-bulk'?'Cuisiner quatre plats raffinés':plan.task?.recipe==='vegetarian-fine-meal'?'Cuisiner un plat raffiné végétarien':plan.task?.recipe==='cook-vegetarian-fine-meal-bulk'?'Cuisiner quatre plats raffinés végétariens':plan.task?.recipe==='carnivore-fine-meal'?'Cuisiner un plat raffiné carnivore':plan.task?.recipe==='cook-carnivore-fine-meal-bulk'?'Cuisiner quatre plats raffinés carnivores':plan.task?.recipe==='lavish-meal'?'Cuisiner un plat gastronomique':plan.task?.recipe==='cook-lavish-meal-bulk'?'Cuisiner quatre plats gastronomiques':plan.task?.recipe==='vegetarian-lavish-meal'?'Cuisiner un plat gastronomique végétarien':plan.task?.recipe==='cook-vegetarian-lavish-meal-bulk'?'Cuisiner quatre plats gastronomiques végétariens':plan.task?.recipe==='cook-carnivore-lavish-meal'?'Cuisiner un plat gastronomique carnivore':plan.task?.recipe==='cook-carnivore-lavish-meal-bulk'?'Cuisiner quatre plats gastronomiques carnivores':'Cuisiner un repas simple',order:plan.refuel??{cooking:plan.task!},path:plan.path};
}

/** Waiting recipes reserve real ingredients, the work spot and typed staging. */
export function queuedCookingReason(world:World,order:CookingOrder,pawn?:Pawn):string|undefined {
  const areaReason=pawn?queuedCookingAreaReason(world,pawn,order):undefined;if(areaReason)return areaReason;
  const view=withoutQueuedOrder(world,order),c=order.cooking,station=view.structures.find(s=>s.id===c.stationId&&stationRecipe(s)!==null),bill=station?.bills?.find(b=>b.id===c.billId);
  if(!station||!bill||bill.recipe!==taskRecipe(c)||!billWanted(view,bill,true))return 'Facture supprimée, suspendue ou quantité atteinte.';
  if(isKibbleRecipe(bill.recipe)&&(world.schemaVersion<227||!stationAccepts(station,bill.recipe)||!validKibbleIngredients(c.ingredients)||c.ingredients.some(i=>i.stage==='source'&&i.quantity>10)))return 'Les croquettes exigent vingt protéines et vingt végétaux frais au poste de boucherie.';
  if(isBurnApparelRecipe(bill.recipe)&&(world.schemaVersion<251||!stationAccepts(station,bill.recipe)||!validBurnApparelIngredients(c.ingredients)||c.phase==='output'||c.phase==='interrupted'||bill.mode==='until'||bill.destination!=='drop'))return 'La combustion exige un vêtement entier autorisé et aucune sortie.';
  if(isCremationRecipe(bill.recipe)&&(!validCremationIngredients(c.ingredients)||c.phase==='output'||bill.mode==='until'||bill.destination!=='drop'))return 'La crémation exige une seule dépouille entière et aucune sortie.';
  if(!productionStationUsable(station)||!productionResearchUnlocked(world,bill.recipe))return 'Atelier sans courant ou recherche manquante.';
  if(!foodStationUsable(station))return station.kind==='electric-stove'?'La cuisinière n’est pas alimentée.':'Le poste est sans combustible.';
  const spot=cookingSpot(station);
  if(spot.x!==c.spot.x||spot.z!==c.spot.z||!cookingPlaceFree(view,spot)||fuelStationReserved(view,station.id)||reservedServiceCells(view).has(cellIndex(view,spot.x,spot.z)))return 'Poste ou place de cuisine indisponible.';
  const incoming=new Map<number,{item:ProductionIngredient;quantity:number}>(),sources=new Map<number,number>();
  const author=world.pawns.find(p=>p.orders.queue.includes(order));
  if(author&&bill.recipe==='make-medicine'&&!productionWorkerQualified(author,bill.recipe))return 'Artisanat 4 et Intellectuel 4 nécessaires.';
  if(author&&!productionWorkerQualified(author,bill.recipe))return bill.recipe==='fine-meal'||bill.recipe==='cook-fine-meal-bulk'||bill.recipe==='vegetarian-fine-meal'||bill.recipe==='cook-vegetarian-fine-meal-bulk'||bill.recipe==='carnivore-fine-meal'||bill.recipe==='cook-carnivore-fine-meal-bulk'?'Cuisine 6 nécessaire.':bill.recipe==='cook-survival-meal'||bill.recipe==='lavish-meal'||bill.recipe==='cook-lavish-meal-bulk'||bill.recipe==='vegetarian-lavish-meal'||bill.recipe==='cook-vegetarian-lavish-meal-bulk'||bill.recipe==='cook-carnivore-lavish-meal'||bill.recipe==='cook-carnivore-lavish-meal-bulk'?'Cuisine 8 nécessaire.':'Compétence Artisanat insuffisante.';
  if(isProstheticRecipe273(bill.recipe)&&!(c.ingredients.length===1&&c.ingredients[0]!.item==='unfinished-prosthetic')&&!validProstheticIngredients273(bill.recipe,c.ingredients))return 'La prothèse exige40 unités d’acier et4composants.';
  if(!validMedicineIngredients(bill.recipe,c.ingredients))return 'Le médicament exige une plante médicinale, une neutroamine et trois tissus.';
  if(!validBiofuelIngredients(bill.recipe,c.ingredients))return bill.recipe==='chemfuel-from-wood'?'Le raffinage exige soixante-dix unités de bois.':'Le raffinage exige 3,5 nutrition de matières premières autorisées.';
  if(bill.recipe==='cook-survival-meal'&&!validSurvivalMealIngredients(c.ingredients))return 'Le repas de survie exige six protéines (viande ou lait) et six végétaux.';
  if(bill.recipe==='fine-meal'&&!validFineMealIngredients(c.ingredients))return 'Le plat raffiné exige cinq protéines (viande ou lait) et cinq végétaux.';
  if(bill.recipe==='cook-fine-meal-bulk'&&!validFineMealBulkIngredients(c.ingredients))return 'Les quatre plats raffinés exigent vingt protéines (viande ou lait) et vingt végétaux.';
  if(bill.recipe==='vegetarian-fine-meal'&&!validVegetarianFineMealIngredients(c.ingredients))return 'Le plat végétarien raffiné exige quinze végétaux crus ou laits au total, sans viande.';
  if(bill.recipe==='cook-vegetarian-fine-meal-bulk'&&!validVegetarianFineMealBulkIngredients(c.ingredients))return 'Les quatre plats raffinés végétariens exigent soixante végétaux crus ou laits au total, sans viande.';
  if(bill.recipe==='cook-carnivore-fine-meal-bulk'&&!validCarnivoreFineMealBulkIngredients(c.ingredients))return 'Les quatre plats raffinés carnivores exigent soixante viandes crues, sans lait ni végétaux.';
  if(bill.recipe==='carnivore-fine-meal'&&!validCarnivoreFineMealIngredients(c.ingredients))return 'Le plat carnivore raffiné exige quinze viandes crues, sans lait ni végétaux.';
  if(bill.recipe==='lavish-meal'&&!validLavishMealIngredients(c.ingredients))return 'Le plat gastronomique exige dix protéines (viande ou lait) et dix végétaux.';
  if(bill.recipe==='cook-lavish-meal-bulk'&&!validLavishMealBulkIngredients(c.ingredients))return 'Les quatre plats gastronomiques exigent quarante protéines (viande ou lait) et quarante végétaux.';
  if(bill.recipe==='vegetarian-lavish-meal'&&!validVegetarianLavishMealIngredients(c.ingredients))return 'Le plat végétarien gastronomique exige vingt-cinq végétaux crus ou laits au total, sans viande.';
  if(bill.recipe==='cook-vegetarian-lavish-meal-bulk'&&!validVegetarianLavishMealBulkIngredients(c.ingredients))return 'Les quatre plats gastronomiques végétariens exigent cent végétaux crus ou laits, sans viande.';
  if(bill.recipe==='cook-carnivore-lavish-meal-bulk'&&!validCarnivoreLavishMealBulkIngredients(c.ingredients))return 'Les quatre plats gastronomiques carnivores exigent cent viandes crues, sans lait ni végétaux.';
  if(bill.recipe==='cook-carnivore-lavish-meal'&&!validCarnivoreLavishMealIngredients(c.ingredients))return 'Le plat carnivore gastronomique exige vingt-cinq viandes crues, sans lait ni végétaux.';
  if(isSmithingRecipe267(bill.recipe)&&!(c.ingredients.length===1&&c.ingredients[0]!.item===smithingWorkpiece267(bill.recipe))&&!smithingMaterialFromIngredients267(bill.recipe,c.ingredients))return 'L’ouvrage exige une seule matière autorisée en quantité complète.';
  for(const i of c.ingredients) {
    const pile=view.piles.find(p=>p.id===i.pileId);
    if(isCremationRecipe(bill.recipe)&&!canStandAt(view,i.cell))return 'Dépôt des ingrédients inaccessible.';
    if(isCremationRecipe(bill.recipe)&&(!pile||!cremationIngredientAllowed(view,bill,pile)||pile.humanCorpse&&burialClaim(view,pile.humanCorpse.pawnId,author?.id)))return 'Dépouille interdite par les filtres, indisponible ou réservée pour une inhumation.';
    if(isBurnApparelRecipe(bill.recipe)&&(!pile||!burnApparelIngredientAllowed(bill,pile)))return 'Vêtement interdit, non brûlable ou hors des filtres de type, état et qualité.';
    if(isSmeltingRecipe(bill.recipe)&&(!pile||!smeltingIngredientAllowed(bill,pile)))return bill.recipe==='smelt-apparel'?'Armure interdite ou hors des filtres de type, état et qualité.':bill.recipe==='smelt-slag'?'Scorie interdite ou absente de la facture.':'Arme interdite ou hors des filtres de type, état et qualité de la facture.';
    const work=pile?.prostheticWork273??pile?.smithingWork??pile?.artWork??pile?.gunWork??pile?.flakWork??pile?.componentWork??pile?.unfinished,bound=work?.billId===bill.id;
    const required=(sources.get(i.pileId)??0)+i.quantity;sources.set(i.pileId,required);
    if(!isCremationRecipe(bill.recipe)&&pile&&isAnimalCorpseItem(pile.item)&&!corpseFresh(pile,world.tick))return 'Dépouille pourrie, impropre à la boucherie.';
    if(pile&&bill.recipe==='cook-survival-meal'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre au repas de survie.';
    if(pile&&bill.recipe==='chemfuel-from-organics'&&ticksUntilRot(pile,world.tick)<=0)return 'Matière organique périmée, impropre au raffinage.';
    if(pile&&bill.recipe==='cook-simple-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux quatre repas simples.';
    if(pile&&bill.recipe==='cook-fine-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux quatre plats raffinés.';
    if(pile&&bill.recipe==='cook-lavish-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux quatre plats gastronomiques.';
    if(pile&&bill.recipe==='vegetarian-fine-meal'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre au plat végétarien raffiné.';
    if(pile&&bill.recipe==='cook-vegetarian-fine-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux quatre plats raffinés végétariens.';
    if(pile&&bill.recipe==='cook-carnivore-fine-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Viande périmée, impropre aux quatre plats raffinés carnivores.';
    if(pile&&bill.recipe==='carnivore-fine-meal'&&ticksUntilRot(pile,world.tick)<=0)return 'Viande périmée, impropre au plat carnivore raffiné.';
    if(pile&&isKibbleRecipe(bill.recipe)&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux croquettes.';
    if(pile&&bill.recipe==='vegetarian-lavish-meal'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre au plat végétarien gastronomique.';
    if(pile&&bill.recipe==='cook-vegetarian-lavish-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Ingrédient périmé, impropre aux quatre plats gastronomiques végétariens.';
    if(pile&&bill.recipe==='cook-carnivore-lavish-meal-bulk'&&ticksUntilRot(pile,world.tick)<=0)return 'Viande périmée, impropre aux quatre plats gastronomiques carnivores.';
    if(pile&&bill.recipe==='cook-carnivore-lavish-meal'&&ticksUntilRot(pile,world.tick)<=0)return 'Viande périmée, impropre au plat carnivore gastronomique.';
    if(pile?.smithingWork&&(pile.smithingWork.recipe!==bill.recipe||!bill.filters[pile.smithingWork.material]))return 'Ouvrage de forge incompatible avec la recette ou ses matières autorisées.';
    if(pile?.prostheticWork273&&pile.prostheticWork273.recipe!==bill.recipe)return 'Ouvrage réservé à une autre recette.';
    if(pile?.componentWork&&pile.componentWork.recipe!==bill.recipe)return 'Ouvrage réservé à une autre recette.';
    if(work&&(work.authorId!==author?.id||work.billId!==undefined&&!bound))return 'Ouvrage réservé à un autre auteur ou une autre facture.';
    if(!(bound||(pile?.prostheticWork273?pile.prostheticWork273.parts.every(part=>bill.filters[part.item]):pile?.smithingWork?bill.filters[pile.smithingWork.material]:pile?.artWork?bill.filters[pile.artWork.material]:pile?.gunWork?pile.gunWork.parts.every(part=>bill.filters[part.item]):pile?.flakWork?pile.flakWork.parts.every(part=>bill.filters[part.item]):pile?.componentWork?pile.componentWork.recipe==='make-component'?bill.filters.steel:pile.componentWork.parts.every(part=>bill.filters[part.item]):bill.filters[pile?.unfinished?'cloth':i.item]))||!pile||pile.item!==i.item||pile.owner.type!=='ground'||pile.quantity-reservedSource(view,pile.id)<required)return 'Ingrédient réservé disparu ou devenu insuffisant.';
    if(!bound&&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2>bill.radius**2)return 'Ingrédient sorti du rayon de la facture.';
    const workpiece=i.item==='unfinished-component'&&c.recipe==='make-advanced-component';
    if(!(workpiece&&componentWorkpiecePlaceFree(view,i.cell,spot,taskRecipe(c),station)||ingredientWithinReach(i.cell,spot,station))||!(workpiece?componentWorkpiecePlaceFree(view,i.cell,spot,taskRecipe(c),station):ingredientPlaceFree(view,i.cell,spot,taskRecipe(c),station)))return 'Dépôt des ingrédients inaccessible.';
    if(i.stage==='placed') {if(pile.owner.x!==i.cell.x||pile.owner.z!==i.cell.z)return 'Ingrédient déjà posé déplacé.';}
    else {
      const key=cellIndex(view,i.cell.x,i.cell.z),prior=incoming.get(key),quantity=(prior?.quantity??0)+i.quantity;
      if(prior&&prior.item!==i.item||groundCapacity(view,i.cell,i.item)<quantity)return 'Dépôt réservé devenu incompatible ou plein.';
      incoming.set(key,{item:i.item,quantity});
    }
  }
}
export function startCookingOrder(pawn:Pawn,order:CookingOrder,path:Cell[]):void {
  pawn.cooking=order.cooking;pawn.orders.active='cook';pawn.path=path;pawn.planCooldown=0;pawn.state=path.length||pawn.moveCooldown>0?'moving':'working';
}
/** Runtime queue admission is separate from its historical structural save guard. */
export function queuedCookingAreaReason(world:World,pawn:Pawn,order:CookingOrder):string|undefined {
  const c=order.cooking,station=structureById(world,c.stationId);
  let reason=station?allowedAreaReason(world,pawn,station):undefined;if(reason)return reason;
  for(const i of c.ingredients){reason=allowedAreaReason(world,pawn,i.cell);if(reason)return reason;
    const pile=world.piles.find(p=>p.id===i.pileId);if(i.stage!=='held'&&pile?.owner.type==='ground'){reason=allowedAreaReason(world,pawn,pile.owner);if(reason)return reason;}}
}
export function advanceCookingOrder(world:World,pawn:Pawn,order:CookingOrder,getBlocked:NavigationGrid,budget:SearchBudget):boolean {
  const station=structureById(world,order.cooking.stationId);
  let reason=queuedCookingAreaReason(world,pawn,order)??(station?backgroundWorkRefusal(pawn,taskWork(order.cooking)):undefined)??queuedCookingReason(world,order),path:Cell[]|null=null;
  if(!reason) {
    const c=order.cooking,sources=c.ingredients.filter(i=>i.stage==='source').map(i=>world.piles.find(p=>p.id===i.pileId)!.owner as Cell);
    const groups=[new Set([cellIndex(world,c.spot.x,c.spot.z)]),...sources.map(s=>interactionGoals(world,[s]))];
    const reach=search(world,pawn,getBlocked(),new Set(),budget,undefined,groups);if(!reach)return true;
    const workPath=routeToCell(world,c.spot,reach);
    if(!workPath||sources.some(s=>!canReach(world,s,reach,true)))reason='Accès perdu à la cuisine ou aux ingrédients.';
    else path=sources[0]?routeToJob(world,sources[0],reach,true):workPath;
  }
  pawn.orders.queue.shift();
  if(!reason&&path){startCookingOrder(pawn,order,path);return false;}
  world.events.push({tick:world.tick,type:'command',message:`${pawn.name} : cuisine abandonnée. ${reason??'Accès perdu.'}`});if(world.events.length>80)world.events.shift();return true;
}
