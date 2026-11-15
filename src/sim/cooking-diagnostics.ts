import {isPenoxycylineRecipe337} from './penoxycyline-337.ts';
import {isSchema289OrLater} from './schema-compatibility-257.ts';
import {isProstheticRecipe273,PROSTHETIC_REQUIREMENTS_273} from './prosthetic-content-273.ts';
import {billWorkerRefusal283} from './bill-worker-rules-283.ts';
import {isSchema283OrLater} from './schema-compatibility-257.ts';
import {backgroundWorkRefusal} from './colonist-backgrounds.ts';
import {isColonist} from './affiliation.ts';
import {isApparelCountRecipe278} from './apparel-count-278.ts';
import {smithingSkillRequired267,isSmithingRecipe267,smithingMaterials267,smithingUnits267,smithingWorkTotal267} from './smithing-content-267.ts';
import {isBurnApparelRecipe,burnApparelIngredientAllowed} from './burn-apparel-rules.ts';
import {isPemmicanRecipe} from './pemmican-content.ts';
import { workPriority } from './work-types.ts';
import { isSmeltingRecipe,smeltingIngredientAllowed } from './smelting-rules.ts';
import { isCremationRecipe,cremationIngredientAllowed } from './cremation-rules.ts';
import { burialClaim } from './burial.ts';
import {artWorkTotal,isArtRecipe} from './art-rules.ts';
import { isAnimalCorpseItem } from './biome-items.ts';
import { productionResearchUnlocked,productionWorkerQualified } from './machining.ts';
import { isBiofuelRecipe,BIOFUEL_ORGANIC_NUTRITION,biofuelNutrition,MEDICINE_REQUIREMENTS,validMedicineIngredients,ADVANCED_COMPONENT_REQUIREMENTS,isComponentRecipe,isFlakRecipe,isGunRecipe,flakRequirements,RECON_ARMOR_REQUIREMENTS,FLAK_HELMET_REQUIREMENTS,RECON_HELMET_REQUIREMENTS,FLAK_REQUIREMENTS,GUN_REQUIREMENTS } from './production-recipes.ts';
import { foodStationUsable, usesCookingFuel } from './food-workstations.ts';
import { corpseFresh } from './corpses.ts';
import { ticksUntilRot } from './food-preservation.ts';
import { productionWorkTotal, PRODUCTION_RECIPES, admittedIngredient, fineMealIngredientGroup, mixedMealGroupUnits } from './production-recipes.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { isCookingOrder } from './order-types.ts';
import { billWanted, cookingPlaceFree, cookingSpot } from './cooking-bills.ts';
import { isKibbleRecipe,KIBBLE_GROUP_UNITS,kibbleIngredientGroup } from './fodder-recipes.ts';
import { reservedSource } from './materials.ts';
import { queryPawnStatus } from './diagnostics.ts';
import type { CookingBill } from './cooking-types.ts';
import type { Structure, World } from './types.ts';

/** Cheap explanation of known state, never a main-thread reachability probe.
 * Available quantities are unreserved ground stock in radius, not a promise
 * that a route or enough staging room exists. */
export function queryCookingBillStatus(world:World,station:Structure,bill:CookingBill):{code:string;reason:string} {
  const worker=world.pawns.find(p=>p.cooking?.stationId===station.id&&p.cooking.billId===bill.id);
  if(worker)return queryPawnStatus(world,worker);
  const queued=world.pawns.find(p=>p.orders.queue.some(o=>isCookingOrder(o)&&o.cooking.stationId===station.id&&o.cooking.billId===bill.id));
  if(queued)return {code:'queued',reason:`Production en file pour ${queued.name} ; ingrédients et poste réservés.`};
  if(bill.suspended)return {code:'suspended',reason:'Facture suspendue.'};
  if(isSchema289OrLater(world.schemaVersion)&&bill.mode==='until'&&bill.reservePause?.enabled&&bill.reservePause.paused)return {code:'reserve-paused',reason:`Réserve en pause automatique ; reprise à ${bill.reservePause.resumeAt} produit(s) compté(s) ou moins, ou sur relance manuelle sous la cible.`};
  if(isBiofuelRecipe(bill.recipe)&&!productionResearchUnlocked(world,bill.recipe))return {code:'research-required',reason:'Recherchez Raffinage du biocarburant après Électricité.'};
  if(!productionResearchUnlocked(world,bill.recipe))return {code:'research-required',reason:isPenoxycylineRecipe337(bill.recipe)?'Recherchez Production de pénoxycyline après Production de drogues.':isProstheticRecipe273(bill.recipe)?'Recherchez Prothèses après Usinage.':isSmithingRecipe267(bill.recipe)?(bill.recipe==='make-plasteel-knife'?'Cette fabrication est indisponible dans ce schéma.':bill.recipe==='make-spear'?'Recherchez Lames longues après Forge pour fabriquer une lance.':bill.recipe==='make-longsword'?'Recherchez Lames longues après Forge pour fabriquer une épée longue.':bill.recipe==='make-mace'?'Recherchez Forge pour fabriquer une masse.':bill.recipe==='make-plate-armor'?'Recherchez Armure de plaques après Forge et Vêtements complexes.':'Recherchez Forge pour fabriquer un casque simple.'):isPemmicanRecipe(bill.recipe)?'Recherchez Pemmican pour préparer cette réserve de camp.':bill.recipe==='tuque'?'Recherchez Vêtements complexes pour confectionner une tuque.':bill.recipe==='make-emp-launcher'?'Recherchez Microélectronique pour fabriquer un lanceur EMP.':bill.recipe==='make-medicine'?'Recherchez Production de médicaments après Production de drogues et Microélectronique.':bill.recipe==='cook-survival-meal'?'Recherchez Repas de survie pour préparer des rations.':bill.recipe==='make-component'?'Recherchez Fabrication pour produire des composants.':bill.recipe==='make-advanced-component'?'Recherchez Fabrication avancée pour produire des composants avancés.':(bill.recipe==='make-recon-armor'||bill.recipe==='make-recon-helmet')?'Recherchez Armure de reconnaissance après Fabrication et Vêtements complexes.':isFlakRecipe(bill.recipe)?'Recherchez Armure pare-balles après Usinage et Armure de plaques.':'Recherchez Armurerie pour fabriquer cette arme.'};
  if(!billWanted(world,bill))return {code:'target-met',reason:bill.mode==='times'?'Quantité demandée terminée.':isApparelCountRecipe278(bill.recipe)&&bill.apparelCount?'Seuil de réserve vestimentaire atteint avec les critères confirmés.':bill.recipe==='butcher-creature'?'Seuil de viande stockée atteint.':'Seuil de produits comptés atteint.'};
  const serving=world.pawns.find(p=>p.cooking?.stationId===station.id||p.haul?.destination.type==='fuel'&&p.haul.destination.structureId===station.id);
  if(serving)return {code:'station-busy',reason:`Poste occupé par ${serving.name}.`};
  // Local availability is cheap. The selector separately queries real campaign
  // holders on demand; inspections never fabricate workers from identity data.
  const preference=isSchema283OrLater(world.schemaVersion)?bill.worker:undefined;
  let workers=world.pawns;
  if(preference){
    workers=workers.filter(p=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue&&p.state!=='dead'&&!p.health?.death);
    if(preference.pawnId!==null){
      workers=workers.filter(p=>p.id===preference.pawnId);
      if(!workers.length)return {code:'worker-away',reason:'La personne désignée est absente de cette carte ou contenue ; aucun remplacement automatique.'};
      const refusal=backgroundWorkRefusal(workers[0]!,PRODUCTION_RECIPES[bill.recipe].work);
      if(refusal)return {code:'worker-incapable',reason:refusal};
    }else{
      workers=workers.filter(p=>!billWorkerRefusal283(world,p,bill));
      if(!workers.length)return {code:'worker-range',reason:`Aucun colon de cette carte ne satisfait la plage de compétence choisie (${preference.skillMin}–${preference.skillMax}).`};
    }
  }
  if(!workers.some(p=>workPriority(p,PRODUCTION_RECIPES[bill.recipe].work)>0))return {code:'waiting-worker',reason:preference?.pawnId!=null?'Métier désactivé pour la personne désignée dans Travail.':'Métier désactivé pour tous les colons dans Travail.'};
  if(!workers.some(p=>workPriority(p,PRODUCTION_RECIPES[bill.recipe].work)>0&&productionWorkerQualified(p,bill.recipe)))return {code:'skill-required',reason:bill.recipe==='make-medicine'?'Un artisan de niveau Artisanat 4 et Intellectuel 4 est nécessaire.':bill.recipe==='fine-meal'||bill.recipe==='cook-fine-meal-bulk'||bill.recipe==='vegetarian-fine-meal'||bill.recipe==='cook-vegetarian-fine-meal-bulk'||bill.recipe==='carnivore-fine-meal'||bill.recipe==='cook-carnivore-fine-meal-bulk'?'Un cuisinier de niveau Cuisine 6 est nécessaire.':bill.recipe==='cook-survival-meal'||bill.recipe==='lavish-meal'||bill.recipe==='cook-lavish-meal-bulk'||bill.recipe==='vegetarian-lavish-meal'||bill.recipe==='cook-vegetarian-lavish-meal-bulk'||bill.recipe==='cook-carnivore-lavish-meal'||bill.recipe==='cook-carnivore-lavish-meal-bulk'?'Un cuisinier de niveau Cuisine 8 est nécessaire.':`Un artisan de niveau ${isProstheticRecipe273(bill.recipe)?PROSTHETIC_REQUIREMENTS_273.skill:isSmithingRecipe267(bill.recipe)?smithingSkillRequired267(bill.recipe):isComponentRecipe(bill.recipe)?8:isGunRecipe(bill.recipe)?GUN_REQUIREMENTS[bill.recipe].skill:isFlakRecipe(bill.recipe)?flakRequirements(bill.recipe).skill:0} est nécessaire.`};
  const spot=cookingSpot(station);
  if(!cookingPlaceFree(world,spot))return {code:'blocked-workplace',reason:'La place de travail devant le poste est obstruée.'};
  if(station.kind==='electric-stove'&&!foodStationUsable(station))return {code:'no-power',reason:'Cuisinière sans alimentation électrique :350 W nécessaires.'};
  if(station.kind==='machining-table'&&!station.power?.on)return {code:'no-power',reason:'Atelier sans alimentation électrique : 350 W nécessaires.'};
  if(station.kind==='fabrication-bench'&&!station.power?.on)return {code:'no-power',reason:'Établi de fabrication sans alimentation électrique : 250 W nécessaires.'};
  if(station.kind==='biofuel-refinery'&&!station.power?.on)return {code:'no-power',reason:'Raffinerie sans alimentation électrique : 170 W nécessaires.'};
  if(station.kind==='electric-smithy'&&!station.power?.on)return {code:'no-power',reason:'Forge sans alimentation électrique : 210 W nécessaires.'};
  if(station.kind==='electric-smelter'&&!station.power?.on)return {code:'no-power',reason:'Fonderie sans alimentation électrique : 700 W nécessaires.'};
  if(station.kind==='electric-crematorium'&&!station.power?.on)return {code:'no-power',reason:'Crématorium sans alimentation électrique : 250 W nécessaires.'};
  if(usesCookingFuel(station.kind)&&!station.fuel?.ticks) {
    if(!station.fuel?.autoRefuel)return {code:'refuel-disabled',reason:'Poste sans combustible ; ravitaillement automatique désactivé.'};
    const wood=world.piles.some(p=>p.item==='wood'&&p.owner.type==='ground'&&p.quantity>reservedSource(world,p.id));
    return {code:wood?'waiting-fuel':'missing-fuel',reason:wood?'Poste sans combustible ; attend un ravitaillement et un accès au bois.':'Poste sans combustible ; aucun bois au sol non réservé.'};
  }
  const u=world.piles.find(p=>p.prostheticWork273?.billId===bill.id||p.smithingWork?.billId===bill.id||p.artWork?.billId===bill.id||p.unfinished?.billId===bill.id||p.gunWork?.billId===bill.id||p.flakWork?.billId===bill.id||p.componentWork?.billId===bill.id),work=u?.prostheticWork273??u?.smithingWork??u?.artWork??u?.gunWork??u?.flakWork??u?.componentWork??u?.unfinished;if(work)return {code:'unfinished',reason:`Ouvrage commencé : attend ${world.pawns.find(p=>p.id===work.authorId)?.name??'son auteur'} ; ${Math.floor(work.progress/(u?.smithingWork?smithingWorkTotal267(u.smithingWork.recipe,u.smithingWork.material):u?.artWork?artWorkTotal(u.artWork.recipe,u.artWork.material):productionWorkTotal(work.recipe))*100)} % conservés.`};
  let available=0;const byMaterial=new Map<string,number>();const metals={cloth:0,steel:0,component:0,plasteel:0,uranium:0,gold:0,'advanced-component':0};const fine={protein:0,vegetable:0};
  for(const pile of world.piles)if(admittedIngredient(bill,pile.item)&&(!isBurnApparelRecipe(bill.recipe)||burnApparelIngredientAllowed(bill,pile))&&(!isSmeltingRecipe(bill.recipe)||smeltingIngredientAllowed(bill,pile))&&(!isCremationRecipe(bill.recipe)||cremationIngredientAllowed(world,bill,pile)&&(!pile.humanCorpse||!burialClaim(world,pile.humanCorpse.pawnId)))&&(isCremationRecipe(bill.recipe)||!isAnimalCorpseItem(pile.item)||corpseFresh(pile,world.tick))&&((!isPemmicanRecipe(bill.recipe)&&!isKibbleRecipe(bill.recipe)&&bill.recipe!=='chemfuel-from-organics'&&bill.recipe!=='cook-survival-meal'&&bill.recipe!=='cook-simple-meal-bulk'&&bill.recipe!=='cook-fine-meal-bulk'&&bill.recipe!=='cook-lavish-meal-bulk'&&bill.recipe!=='vegetarian-fine-meal'&&bill.recipe!=='cook-vegetarian-fine-meal-bulk'&&bill.recipe!=='carnivore-fine-meal'&&bill.recipe!=='cook-carnivore-fine-meal-bulk'&&bill.recipe!=='vegetarian-lavish-meal'&&bill.recipe!=='cook-vegetarian-lavish-meal-bulk'&&bill.recipe!=='cook-carnivore-lavish-meal'&&bill.recipe!=='cook-carnivore-lavish-meal-bulk')||ticksUntilRot(pile,world.tick)>0)&&pile.owner.type==='ground'
    &&(pile.owner.x-station.x)**2+(pile.owner.z-station.z)**2<=bill.radius**2){const units=Math.max(0,pile.quantity-reservedSource(world,pile.id));available+=units;byMaterial.set(pile.item,(byMaterial.get(pile.item)??0)+units);if(pile.item==='cloth'||pile.item==='steel'||pile.item==='component'||pile.item==='plasteel'||pile.item==='uranium'||pile.item==='gold'||pile.item==='advanced-component')metals[pile.item]+=units;if(isKibbleRecipe(bill.recipe)||mixedMealGroupUnits(bill.recipe)){const group=isKibbleRecipe(bill.recipe)?kibbleIngredientGroup(pile.item):fineMealIngredientGroup(pile.item);if(group)fine[group]+=units;}}
  if(isBurnApparelRecipe(bill.recipe)&&available<1)return {code:'missing-ingredients',reason:'Aucun vêtement au sol autorisé non réservé, brûlable et admis par les filtres de type, état et qualité dans le rayon.'};
  if(isSmeltingRecipe(bill.recipe)&&available<1)return {code:'missing-ingredients',reason:bill.recipe==='smelt-apparel'?'Aucune armure métallique au sol non réservée admise par les filtres de type, état et qualité dans le rayon.':bill.recipe==='smelt-slag'?'Aucune scorie au sol autorisée, non réservée et dans le rayon.':'Aucune arme au sol non réservée admise par les filtres de type, état et qualité dans le rayon.'};
  if(isCremationRecipe(bill.recipe)&&available<1)return {code:'missing-ingredients',reason:'Aucune dépouille matérialisée au sol non réservée admise par les filtres de type, personne et état dans le rayon.'};
  if(bill.recipe==='make-medicine'){
    const quota=(Object.keys(MEDICINE_REQUIREMENTS) as (keyof typeof MEDICINE_REQUIREMENTS)[]).map(item=>({item,quantity:Math.min(byMaterial.get(item)??0,MEDICINE_REQUIREMENTS[item])}));
    if(!validMedicineIngredients(bill.recipe,quota))return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${byMaterial.get('herbal-medicine')??0}/${MEDICINE_REQUIREMENTS['herbal-medicine']} plante médicinale · ${byMaterial.get('neutroamine')??0}/${MEDICINE_REQUIREMENTS.neutroamine} neutroamine · ${byMaterial.get('cloth')??0}/${MEDICINE_REQUIREMENTS.cloth} tissus non réservés.`};
  }
  if(bill.recipe==='chemfuel-from-organics'){
    const nutrition=biofuelNutrition([...byMaterial].map(([item,quantity])=>({item,quantity})));
    if(nutrition<BIOFUEL_ORGANIC_NUTRITION)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${nutrition/100}/3,5 nutrition de matières premières fraîches non réservées.`};
  }
  const mealQuota=isKibbleRecipe(bill.recipe)?KIBBLE_GROUP_UNITS:mixedMealGroupUnits(bill.recipe);
  if(mealQuota&&(fine.protein<mealQuota||fine.vegetable<mealQuota))return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${fine.protein}/${mealQuota} ${isPemmicanRecipe(bill.recipe)?'viandes animales (sans lait)':'protéines (viande ou lait)'} · ${fine.vegetable}/${mealQuota} végétaux.`};
  if(bill.recipe==='vegetarian-fine-meal'&&available<15)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/15 végétaux crus ou lait frais non réservés.`};
  if(bill.recipe==='cook-vegetarian-fine-meal-bulk'&&available<60)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/60 végétaux crus ou lait frais non réservés.`};
  if(bill.recipe==='cook-carnivore-fine-meal-bulk'&&available<60)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/60 viandes crues fraîches non réservées.`};
  if(bill.recipe==='carnivore-fine-meal'&&available<15)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/15 viandes crues fraîches non réservées.`};
  if(bill.recipe==='cook-vegetarian-lavish-meal-bulk'&&available<100)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/100 végétaux crus ou laits frais non réservés.`};
  if(bill.recipe==='vegetarian-lavish-meal'&&available<25)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/25 végétaux crus ou lait frais non réservés.`};
  if(bill.recipe==='cook-carnivore-lavish-meal-bulk'&&available<100)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/100 viandes crues fraîches non réservées.`};
  if(bill.recipe==='cook-carnivore-lavish-meal'&&available<25)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${available}/25 viandes crues fraîches non réservées.`};
  if(bill.recipe==='make-advanced-component'){
    const r=ADVANCED_COMPONENT_REQUIREMENTS;
    if(metals.component<r.component||metals.steel<r.steel||metals.plasteel<r.plasteel||metals.gold<r.gold)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.component}/${r.component} composant · ${metals.steel}/${r.steel} acier · ${metals.plasteel}/${r.plasteel} plastacier · ${metals.gold}/${r.gold} or.`};
  }
  if(isProstheticRecipe273(bill.recipe)){const r=PROSTHETIC_REQUIREMENTS_273;if(metals.steel<r.steel||metals.component<r.component)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.steel}/${r.steel} acier · ${metals.component}/${r.component} composants.`};}
  if(isGunRecipe(bill.recipe)){const r=GUN_REQUIREMENTS[bill.recipe];if(metals.steel<r.steel||metals.component<r.component)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.steel}/${r.steel} acier · ${metals.component}/${r.component} composants.`};}
  if(bill.recipe==='make-flak-vest'){const r=FLAK_REQUIREMENTS;if(metals.cloth<r.cloth||metals.steel<r.steel||metals.component<r.component)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.cloth}/${r.cloth} tissu · ${metals.steel}/${r.steel} acier · ${metals.component}/${r.component} composant.`};}
  if(bill.recipe==='make-flak-helmet'){const r=FLAK_HELMET_REQUIREMENTS;if(metals.steel<r.steel||metals.component<r.component||metals.plasteel<r.plasteel)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.steel}/${r.steel} acier · ${metals.component}/${r.component} composants · ${metals.plasteel}/${r.plasteel} plastacier.`};}
  if(bill.recipe==='make-recon-armor'){const r=RECON_ARMOR_REQUIREMENTS;if(metals.plasteel<r.plasteel||metals['advanced-component']<r['advanced-component']||metals.uranium<r.uranium)return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.plasteel}/${r.plasteel} plastacier · ${metals['advanced-component']}/${r['advanced-component']} composants avancés · ${metals.uranium}/${r.uranium} uranium.`};}
  if(bill.recipe==='make-recon-helmet'){const r=RECON_HELMET_REQUIREMENTS;if(metals.plasteel<r.plasteel||metals['advanced-component']<r['advanced-component'])return {code:'missing-ingredients',reason:`Dans le rayon et les filtres : ${metals.plasteel}/${r.plasteel} plastacier · ${metals['advanced-component']}/${r['advanced-component']} composant avancé.`};}
  if(isSmithingRecipe267(bill.recipe)){const recipe=bill.recipe,materials=smithingMaterials267(recipe).filter(m=>bill.filters[m]);if(!materials.some(m=>(byMaterial.get(m)??0)>=smithingUnits267(recipe,m)))return {code:'missing-ingredients',reason:'Une seule matière autorisée est nécessaire : '+materials.map(m=>`${byMaterial.get(m)??0}/${smithingUnits267(recipe,m)} ${m}`).join(' · ')};}
  if(isArtRecipe(bill.recipe))available=Math.max(0,...byMaterial.values());
  if(!isSmithingRecipe267(bill.recipe)&&available<PRODUCTION_RECIPES[bill.recipe].units)return {code:'missing-ingredients',reason:`Ingrédients insuffisants : ${available}/${PRODUCTION_RECIPES[bill.recipe].units} non réservés dans le rayon et les filtres.`};
  if(reservedServiceCells(world).has(spot.z*world.width+spot.x))return {code:'workplace-occupied',reason:'La place devant le poste est réservée par une autre activité.'};
  return {code:'waiting',reason:isCremationRecipe(bill.recipe)||isBurnApparelRecipe(bill.recipe)?'Attend un transporteur disponible ; accès, priorités et place de dépôt à vérifier.':'Attend un artisan disponible ; accès, priorités et place de dépôt à vérifier.'};
}
