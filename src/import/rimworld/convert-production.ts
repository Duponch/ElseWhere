/** Import persistent production orders after the actual station, actor,
 * research and item owners exist. A Core Bill is not a current job: keep
 * the ordered bill list, even completed (repeatCount=0) or suspended bills. */
import type {ImportContext} from './convert.ts';
import type {CookingBill} from '../../sim/cooking-types.ts';
import type {ItemId} from '../../sim/items.ts';
import type {ProductionRecipe} from '../../sim/production-recipes.ts';
import {PRODUCTION_RECIPES,stationAccepts,isTailoring,tailoringMaterialAllowed,unfinishedItem,productionWorkTotal,isGunRecipe,isFlakRecipe,flakWorkpiece,isComponentRecipe} from '../../sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../../sim/cooking-bills.ts';
import {productionResearchUnlocked} from '../../sim/machining.ts';
import {supportsBillReservePause289} from '../../sim/bill-pause-rules-289.ts';
import {items as listItems,at,text,num,type XmlNode} from './xml.ts';
import {filterItemIds,qualityRange,numberRange} from './colony-filters.ts';
import {referencedThingId} from './rws-save.ts';
import {lookup,isDropped} from './mapping.ts';
import {STUFF_MAP,ITEM_MAP} from './map-items.ts';
import {isArtRecipe,isArtMaterial,artWorkTotal} from '../../sim/art-rules.ts';
import {validArtWorkShape} from '../../sim/art-work.ts';
import {validUnfinishedShape} from '../../sim/unfinished.ts';
import {isSmithingRecipe267,smithingMaterialAllowed267,smithingWorkpiece267,smithingWorkTotal267} from '../../sim/smithing-content-267.ts';
import {validSmithingWorkShape267} from '../../sim/smithing-save-267.ts';
import {isProstheticRecipe273} from '../../sim/prosthetic-content-273.ts';
import {validProstheticWorkShape273} from '../../sim/prosthetic-work-save-273.ts';
import {validGunWorkShape} from '../../sim/gun-work.ts';
import {validFlakWorkShape} from '../../sim/flak-work.ts';
import {validComponentWorkShape} from '../../sim/component-work.ts';
import {validateResearch} from '../../sim/research-save.ts';
import {ITEM_DEFINITIONS} from '../../sim/items.ts';
import {groundCapacity,planGroundPlacement} from '../../sim/ground-placement.ts';
import {appendPileEntries} from '../../sim/pile-identity-directory.ts';
import {markPileContentWrite379} from '../../sim/ordinary-pile-source-379.ts';
import type {MaterialPile} from '../../sim/types.ts';

/** Core RecipeDef identifiers from the base game's Defs. Separate bulk
 * variants with no native recipe retain their rate-independent target/count
 * by explicitly reporting a substitution instead of claiming equivalence. */
const RECIPE_MAP:Readonly<Record<string,ProductionRecipe>>={
 ButcherCorpseFlesh:'butcher-creature',Make_Kibble:'make-kibble',
 SmashCorpseMechanoid:'smash-mechanoid',ButcherCorpseMechanoid:'shred-mechanoid',
 CookMealSimple:'simple-meal',CookMealSimpleBulk:'cook-simple-meal-bulk',
 CookMealFine:'fine-meal',CookMealFineBulk:'cook-fine-meal-bulk',
 CookMealFine_Veg:'vegetarian-fine-meal',CookMealFineBulk_Veg:'cook-vegetarian-fine-meal-bulk',
 CookMealFine_Meat:'carnivore-fine-meal',CookMealFineBulk_Meat:'cook-carnivore-fine-meal-bulk',
 CookMealLavish:'lavish-meal',CookMealLavishBulk:'cook-lavish-meal-bulk',
 CookMealLavish_Veg:'vegetarian-lavish-meal',CookMealLavishBulk_Veg:'cook-vegetarian-lavish-meal-bulk',
 CookMealLavish_Meat:'cook-carnivore-lavish-meal',CookMealLavishBulk_Meat:'cook-carnivore-lavish-meal-bulk',
 CookMealSurvival:'cook-survival-meal',CookMealSurvivalBulk:'cook-survival-meal',
 Make_Pemmican:'make-pemmican',Make_PemmicanBulk:'make-pemmican',
 Make_StoneBlocksAny:'stone-blocks',Make_StoneBlocksGranite:'stone-blocks',Make_StoneBlocksLimestone:'stone-blocks',
 Make_StoneBlocksMarble:'stone-blocks',Make_StoneBlocksSandstone:'stone-blocks',Make_StoneBlocksSlate:'stone-blocks',
 Make_Apparel_TribalA:'tribalwear',Make_Apparel_BasicShirt:'tshirt',Make_Apparel_CollarShirt:'shirt',Make_Apparel_Pants:'pants',
 Make_Apparel_Duster:'duster',Make_Apparel_Parka:'parka',Make_Apparel_Jacket:'jacket',Make_Apparel_Tuque:'tuque',
 Make_Apparel_CowboyHat:'cowboy-hat',Make_Apparel_BowlerHat:'bowler-hat',
 Make_Apparel_PlateArmor:'make-plate-armor',Make_Apparel_SimpleHelmet:'make-simple-helmet',
 Make_Apparel_AdvancedHelmet:'make-flak-helmet',Make_Apparel_FlakVest:'make-flak-vest',Make_Apparel_FlakPants:'make-flak-pants',
 Make_Apparel_ArmorRecon:'make-recon-armor',Make_Apparel_ArmorHelmetRecon:'make-recon-helmet',
 Make_MeleeWeapon_Knife:'make-plasteel-knife',Make_MeleeWeapon_Mace:'make-mace',Make_MeleeWeapon_LongSword:'make-longsword',Make_MeleeWeapon_Spear:'make-spear',
 Make_Bow_Short:'make-short-bow',Make_Bow_Recurve:'make-recurve-bow',Make_Bow_Great:'make-greatbow',
 Make_Gun_Revolver:'make-revolver',Make_Gun_Autopistol:'make-autopistol',Make_Gun_MachinePistol:'make-machine-pistol',
 Make_Gun_BoltActionRifle:'make-bolt-action-rifle',Make_Gun_PumpShotgun:'make-pump-shotgun',Make_Gun_ChainShotgun:'make-chain-shotgun',
 Make_Gun_HeavySMG:'make-heavy-smg',Make_Gun_LMG:'make-lmg',Make_Gun_AssaultRifle:'make-assault-rifle',Make_Gun_SniperRifle:'make-sniper-rifle',Make_Gun_EmpLauncher:'make-emp-launcher',
 Make_SimpleProstheticArm:'make-prosthetic-arm',Make_SimpleProstheticLeg:'make-prosthetic-leg',
 Make_Penoxycyline:'make-penoxycyline',Make_PenoxycylineBulk:'make-penoxycyline-bulk',
 Make_ComponentIndustrial:'make-component',Make_ComponentSpacer:'make-advanced-component',
 Make_MedicineIndustrial:'make-medicine',Make_MedicineIndustrialBulk:'make-medicine',
 Make_SculptureSmall:'small-sculpture',Make_SculptureLarge:'large-sculpture',
 Make_Wort:'brew-wort',Make_ChemfuelFromWood:'chemfuel-from-wood',Make_ChemfuelFromOrganics:'chemfuel-from-organics',
 ExtractMetalFromSlag:'smelt-slag',SmeltWeapon:'smelt-weapon',SmeltApparel:'smelt-apparel',
 CremateCorpse:'cremate-corpse',BurnApparel:'burn-apparel',DestroyApparel:'burn-apparel',
};
export const coreRecipe=(name:string|undefined):ProductionRecipe|undefined=>name&&Object.hasOwn(RECIPE_MAP,name)?RECIPE_MAP[name]:undefined;
const bulkMultiplier:Record<string,number>={CookMealSurvivalBulk:4,Make_PemmicanBulk:4,Make_MedicineIndustrialBulk:4};
/** Named fixed ingredient quotas are always available in Core independent
 * of the bill's ThingFilter (the source list may omit them entirely). */
const variableRecipes=new Set<ProductionRecipe>([
 'make-kibble','butcher-creature','smash-mechanoid','shred-mechanoid','make-pemmican','simple-meal','cook-simple-meal-bulk',
 'fine-meal','cook-fine-meal-bulk','vegetarian-fine-meal','cook-vegetarian-fine-meal-bulk','carnivore-fine-meal',
 'cook-carnivore-fine-meal-bulk','lavish-meal','cook-lavish-meal-bulk','vegetarian-lavish-meal','cook-vegetarian-lavish-meal-bulk',
 'cook-carnivore-lavish-meal','cook-carnivore-lavish-meal-bulk','cook-survival-meal','stone-blocks',
 'small-sculpture','large-sculpture','chemfuel-from-organics','smelt-slag','smelt-weapon','smelt-apparel','cremate-corpse','burn-apparel',
 'make-flak-helmet','make-plate-armor','make-simple-helmet','make-plasteel-knife','make-mace','make-longsword','make-spear','make-short-bow','make-recurve-bow','make-greatbow'
]);
const fixedExtras:Partial<Record<ProductionRecipe,readonly string[]>>={'make-flak-helmet':['component','plasteel']};
/** Core's Scribe default repeatCount=0. Missing values on the completed
 * repeat bills of real colonies must not restart the work. */
export function configureImportedBill(bill:CookingBill,node:XmlNode,sourceName:string,ids:ReadonlyMap<string,number>):string[] {
 const changes:string[]=[];
 const mode=text(node,'repeatMode')??'RepeatCount';
 bill.mode=mode==='Forever'?'forever':mode==='TargetCount'?'until':'times';
 if(mode!=='Forever'&&mode!=='TargetCount'&&mode!=='RepeatCount')changes.push('Mode de répétition non reconnu.');
 const multiplier=bulkMultiplier[sourceName]??1;
 if(multiplier!==1)changes.push('Recette multiple remplacée par la recette individuelle : répétitions multipliées si nécessaire.');
 const rawTarget=bill.mode==='until'?num(node,'targetCount')??0:(num(node,'repeatCount')??0)*(bill.mode==='times'?multiplier:1);
 bill.target=Math.max(0,Math.min(9999,Math.round(rawTarget)));
 if(bill.target!==rawTarget)changes.push('Nombre de répétitions/cible borné.');
 bill.suspended=text(node,'suspended')==='True';
 bill.radius=Math.max(0,Math.min(999,num(node,'ingredientSearchRadius')??999));
 const store=text(node,'storeMode')??'BestStockpile';
 bill.destination=store==='DropOnFloor'||bill.recipe==='cremate-corpse'||bill.recipe==='burn-apparel'?'drop':'stockpile';
 if(store!=='BestStockpile'&&store!=='DropOnFloor'||text(node,'storeGroup')||text(node,'includeGroup'))changes.push('Groupe de stockage/compteur spécifique absent.');
 if(bill.mode==='until'&&['smelt-weapon','smelt-apparel','cremate-corpse','burn-apparel'].includes(bill.recipe)){
  // Destruction orders have no persistent output reserve in the target.
  bill.mode='times';bill.suspended=true;changes.push('Cible de réserve incompatible : facture suspendue.');
 }
 const ingredientFilter=at(node,'ingredientFilter'),allowed=at(ingredientFilter,'allowedDefs');
 const sourceDefs=listItems(allowed).flatMap(n=>text(n)??[]);
 const mapped=new Set<ItemId>();
 for(const def of sourceDefs)for(const item of filterItemIds(def))mapped.add(item);
 if(sourceName.startsWith('Make_StoneBlocks')&&sourceName!=='Make_StoneBlocksAny'){
  const material=sourceName.slice('Make_StoneBlocks'.length);
  for(const key of Object.keys(bill.filters) as (keyof CookingBill['filters'])[])bill.filters[key]=key===material.toLowerCase()+'-chunk';
  if(bill.mode==='until')changes.push('Le compteur de blocs est global dans Elsewhere.');
 }else if(isTailoring(bill.recipe)||variableRecipes.has(bill.recipe)){
  if(allowed){
   for(const key of Object.keys(bill.filters) as (keyof CookingBill['filters'])[])bill.filters[key]=mapped.has(key)||fixedExtras[bill.recipe]?.includes(key)===true;
  }
 }else{
  // No selectable material: Core fixedIngredient definitions can be absent
  // from the saved whitelist. Preserve the actual fixed recipe requirements.
  for(const key of Object.keys(bill.filters) as (keyof CookingBill['filters'])[])bill.filters[key]=true;
 }
 if(sourceDefs.some(d=>filterItemIds(d).length===0))changes.push('Certains ingrédients autorisés n’ont pas de définition Elsewhere.');
 if(bill.smeltFilter){
  const hp=numberRange(text(ingredientFilter,'allowedHitPointsPercents'),0,100,100),quality=qualityRange(text(ingredientFilter,'allowedQualityLevels'));
  if(hp){bill.smeltFilter.hpMin=hp.min;bill.smeltFilter.hpMax=hp.max;}
  if(quality){bill.smeltFilter.qualityMin=quality.min;bill.smeltFilter.qualityMax=quality.max;}
 }else if(text(ingredientFilter,'allowedHitPointsPercents')!=='0~1'&&text(ingredientFilter,'allowedHitPointsPercents')||text(ingredientFilter,'allowedQualityLevels')!=='Awful~Legendary'&&text(ingredientFilter,'allowedQualityLevels'))changes.push('Filtre détaillé d’état des ingrédients absent pour cette recette.');
 if(bill.cremationFilter){
  const special=new Set(listItems(ingredientFilter,'disallowedSpecialFilters').map(n=>n.text.trim()));
  bill.cremationFilter={colonists:!special.has('AllowCorpsesColonist'),strangers:!special.has('AllowCorpsesStranger'),fresh:!special.has('AllowFresh'),rotting:!special.has('AllowRotten'),desiccated:!special.has('AllowDessicated')&&!special.has('AllowDesiccated')};
 }
 if(bill.apparelCount){
  const hp=numberRange(text(node,'hpRange'),0,100,100),quality=qualityRange(text(node,'qualityRange'));
  if(hp){bill.apparelCount.hpMin=hp.min;bill.apparelCount.hpMax=hp.max;}
  if(quality){bill.apparelCount.qualityMin=quality.min;bill.apparelCount.qualityMax=quality.max;}
  bill.apparelCount.includeEquipped=text(node,'includeEquipped')==='True';
  bill.apparelCount.includeTainted374=text(node,'includeTainted')==='True';
 }
 if(text(node,'limitToAllowedStuff')==='True')changes.push('Compteur limité à certaines matières non représenté.');
 const pawnRef=referencedThingId(text(node,'pawnRestriction')),pawnId=pawnRef?ids.get(pawnRef):undefined;
 const skill=numberRange(text(node,'allowedSkillRange'),0,20)??{min:0,max:20};
 if(pawnRef&&pawnId===undefined){
  // Do not silently reassign an order to an unrestricted worker.
  bill.suspended=true;changes.push('Exécutant absent : facture suspendue.');
 }
 if(pawnId!==undefined||skill.min!==0||skill.max!==20)bill.worker={pawnId:pawnId??null,skillMin:skill.min,skillMax:skill.max};
 if(text(node,'slavesOnly')==='True'||text(node,'mechsOnly')==='True'){bill.suspended=true;changes.push('Restriction d’exécutant non représentée : facture suspendue.');}
 const pause=text(node,'pauseWhenSatisfied')==='True',paused=text(node,'paused')==='True';
 if((pause||paused)&&supportsBillReservePause289(bill.recipe)){
  const resumeAt=Math.max(-1,Math.min(9999,Math.round(num(node,'unpauseWhenYouHave')??0)));
  bill.reservePause={enabled:pause,resumeAt,paused};
 }
 return changes;
}
export function importProductionBills(ctx:ImportContext,allowLockedResearch=false):void {
 const {map,w,notes}=ctx;
 const stations=new Map(w.structures.map(s=>[s.id,s]));
 let total=0,kept=0;
 for(const thing of map.things){
  const nodes=listItems(thing.node,'billStack/bills');if(!nodes.length)continue;
  const station=stations.get(ctx.thingIds.get(thing.id)??-1);
  for(const node of nodes){
   const name=text(node,'recipe')??'?',recipe=coreRecipe(name);
   total++;notes.countBefore('production');
   if(!station?.bills){notes.def('production',name,'dropped',recipe,'Poste de production non repris.');continue;}
   if(!recipe||!stationAccepts(station,recipe)){notes.def('production',name,'dropped',recipe,'Recette ou poste correspondant absent.');continue;}
   const unlocked=productionResearchUnlocked(w,recipe);
   if(!allowLockedResearch&&!unlocked){notes.def('production',name,'dropped',recipe,'Prérequis de recherche non terminés.');continue;}
   if(station.bills.length>=64){notes.def('production',name,'dropped',recipe,'Limite de 64 factures du poste atteinte.');continue;}
   const bill=newCookingBill(w.nextId,recipe,w.schemaVersion),changes=configureImportedBill(bill,node,name,ctx.thingIds);
   if(!unlocked)changes.push('Facture originale de test conservée sans débloquer sa recherche ; Elsewhere attend la recherche avant de l’exécuter.');
   if(!validBillSettings(bill,recipe,w.schemaVersion)){notes.def('production',name,'dropped',recipe,'Réglages hors du domaine valide.');continue;}
   w.nextId++;station.bills.push(bill);
   const loadId=num(node,'loadID')??0;
   ctx.thingIds.set('Bill_'+name+'_'+loadId,bill.id);
   kept++;notes.countAfter('production');
   notes.def('production',name,changes.length?'adapted':'exact',recipe,changes.join(' ')||undefined);
  }
 }
 if(total)notes.mapped('production',`${kept} factures reprises sur ${total} (ordre d'exécution conservé).`);
}

/** A designation targets a real chunk reference; a compressed cell without
 * a preserved source identity is never guessed from a similar chunk. */
export function importHaulDesignations(ctx:ImportContext):void{
 const {map,w,notes}=ctx,piles=new Map(w.piles.map(p=>[p.id,p]));
 let imported=0,lost=0;
 for(const node of listItems(map.node,'designationManager/allDesignations')){
  if(text(node,'def')!=='Haul')continue;
  const source=referencedThingId(text(node,'target')),pile=piles.get(source?ctx.thingIds.get(source)??-1:-1);
  if(pile?.kind==='chunk'&&pile.owner.type==='ground'){markPileContentWrite379(pile).haulRequested=true;imported++;}
  else lost++;
 }
 if(imported)notes.mapped('production',`${imported} désignations de transport de morceaux reprises.`);
 if(lost)notes.lost('production',`${lost} désignations de transport sans propriétaire repris.`);
}

/** WIP is a material owner, not an additional loose stack of ingredients.
 * Preserve the original author, spent quantities, exact bound bill and work
 * remaining for the supported apparel/sculpture kinds. No invented author. */
export function importUnfinishedWorks(ctx:ImportContext):void{
 const {map,w,notes}=ctx;
 for(const t of map.things){
  if(!t.pos||t.cls!=='UnfinishedThing'&&!t.def.startsWith('Unfinished'))continue;
  notes.countBefore('production');
  const name=text(t.node,'recipe'),recipe=coreRecipe(name),creator=referencedThingId(text(t.node,'creator')),authorId=creator?ctx.thingIds.get(creator):undefined;
  const billRef=text(t.node,'bill'),billId=billRef?ctx.thingIds.get(billRef):undefined;
  const workLeft=num(t.node,'workLeft'),mapped=lookup(STUFF_MAP,t.stuff),stuff=mapped&&!isDropped(mapped)?mapped.to:undefined;
  const lost=(why:string)=>notes.def('production',t.def,'dropped',recipe,why);
  if(!recipe||!authorId||!w.pawns.some(p=>p.id===authorId)||workLeft===undefined||workLeft<0){
   if(!recipe&&name?.includes('BreachAxe'))notes.def('production',t.def,'dropped',name,'Hache de brèche : recette et ouvrage correspondants absents du modèle actuel.',1,'model');
   else lost('Recette, auteur ou progression non représenté.');continue;
  }
  const parts:{item:ItemId;quantity:number}[]=[];let valid=true,split=false,ingredientAdapted=!!(mapped&&!isDropped(mapped)&&mapped.adapt);
  for(const ingredient of listItems(t.node,'ingredients')){
   const im=lookup(ITEM_MAP,text(ingredient,'def'));const quantity=num(ingredient,'stackCount')??1;
   if(!im||isDropped(im)||quantity<1||!Number.isSafeInteger(quantity)){valid=false;break;}
   ingredientAdapted||=!!im.adapt;const limit=Math.min(75,ITEM_DEFINITIONS[im.to].stackLimit);
   if(quantity>limit)split=true;
   let left=quantity;while(left>0){parts.push({item:im.to,quantity:Math.min(limit,left)});left-=Math.min(limit,left);}
  }
  if(!valid){lost('Matières constitutives non représentées.');continue;}
  const cell=ctx.coordinates.cell(t.pos),owner={type:'ground' as const,...cell};
  let pile:MaterialPile|undefined;
  const progressAt=(total:number)=>{const done=Math.round(total-workLeft*1000);return done>=0&&done<=total?done:undefined;};
  const bound={authorId,...billId!==undefined?{billId}:{}};
  const homogeneous=(material:ItemId)=>parts.length>0&&parts.every(p=>p.item===material);
  const itemParts=parts.map(p=>p.quantity);
  const candidate=(item:ItemId,work:Partial<MaterialPile>,validShape:(p:Record<string,unknown>,version:number)=>boolean)=>{
   const p:MaterialPile={id:w.nextId,item,kind:'unfinished',quantity:1,owner,...work};
   if(validShape(p as unknown as Record<string,unknown>,w.schemaVersion))pile=p;
  };
  if(t.def==='UnfinishedApparel'&&isTailoring(recipe)&&stuff?.apparel&&tailoringMaterialAllowed(recipe,stuff.apparel as never)&&homogeneous(stuff.apparel)){
   const material=stuff.apparel as import('../../sim/production-recipes.ts').TailoringMaterial;
   const item=unfinishedItem(recipe),units=PRODUCTION_RECIPES[recipe].units;
   const progress=progressAt(productionWorkTotal(recipe));if(progress!==undefined)candidate(item,{unfinished:{recipe,...bound,material,units,parts:itemParts,progress}},validUnfinishedShape);
  }else if(t.def==='UnfinishedSculpture'&&isArtRecipe(recipe)&&isArtMaterial(stuff?.construction,w.schemaVersion)&&homogeneous(stuff!.construction!)){
   const material=stuff!.construction!,progress=progressAt(artWorkTotal(recipe,material));if(progress!==undefined)candidate('unfinished-sculpture',{artWork:{recipe,material,...bound,parts:itemParts,progress}},validArtWorkShape);
  }else if(isSmithingRecipe267(recipe)&&smithingMaterialAllowed267(recipe,stuff?.metal)&&homogeneous(stuff!.metal!)){
   const material=stuff!.metal!,progress=progressAt(smithingWorkTotal267(recipe,material));if(progress!==undefined)candidate(smithingWorkpiece267(recipe),{smithingWork:{recipe,material,...bound,parts:itemParts.map(quantity=>({item:material,quantity})),progress}},validSmithingWorkShape267);
  }else if(isProstheticRecipe273(recipe)&&parts.every(p=>p.item==='steel'||p.item==='component')){
   const progress=progressAt(productionWorkTotal(recipe));if(progress!==undefined)candidate('unfinished-prosthetic',{prostheticWork273:{recipe,...bound,parts:parts as import('../../sim/prosthetic-work-273.ts').ProstheticWork273['parts'],progress}},validProstheticWorkShape273);
  }else if(isGunRecipe(recipe)&&parts.every(p=>p.item==='steel'||p.item==='component')){
   const progress=progressAt(productionWorkTotal(recipe));if(progress!==undefined)candidate('unfinished-gun',{gunWork:{recipe,...bound,parts:parts as import('../../sim/gun-work.ts').GunWork['parts'],progress}},validGunWorkShape);
  }else if(isFlakRecipe(recipe)&&parts.every(p=>['cloth','steel','component','plasteel','advanced-component','uranium'].includes(p.item))){
   const progress=progressAt(productionWorkTotal(recipe));if(progress!==undefined)candidate(flakWorkpiece(recipe),{flakWork:{recipe,...bound,parts:parts as import('../../sim/flak-work.ts').FlakWork['parts'],progress}},validFlakWorkShape);
  }else if(isComponentRecipe(recipe)){
   const progress=progressAt(productionWorkTotal(recipe));if(progress!==undefined){
    if(recipe==='make-component'&&homogeneous('steel'))candidate('unfinished-component',{componentWork:{recipe,...bound,parts:itemParts,progress}},validComponentWorkShape);
    else if(recipe==='make-advanced-component'&&parts.every(p=>['component','steel','plasteel','gold'].includes(p.item)))candidate('unfinished-component',{componentWork:{recipe,...bound,parts:parts as import('../../sim/component-work.ts').AdvancedComponentWork['parts'],progress}},validComponentWorkShape);
   }
  }
  if(!pile){lost('Coûts ou état de l’ouvrage incompatibles.');continue;}
  // The existing static workpiece may be legal despite a locked recipe
  // (e.g. a paid helmet). Never bypass a specific research transport gate.
  if(!productionResearchUnlocked(w,recipe)){
   // Isolate this prospective owner: an unrelated locked bill cannot hide
   // an identical aggregate error emitted by the workpiece guard.
   const isolated={...w,structures:[],jobs:[],packed:[],piles:[],pawns:[]};
   const before=validateResearch(isolated,w.schemaVersion),after=validateResearch({...isolated,piles:[pile],nextId:w.nextId+1},w.schemaVersion);
   if(after.some(s=>after.filter(a=>a===s).length>before.filter(a=>a===s).length)){lost('Ouvrage existant, mais verrou de recherche de transport incompatible.');continue;}
  }
  // Source cells can be occupied by a different pile already imported; use
  // the actual occupancy planner rather than forge a second owner there.
  let moved=false;
  if(groundCapacity(w,cell,pile)<1){
   const placement=planGroundPlacement(w,1,cell,pile.item);
   if(!placement?.length){lost('Aucun emplacement admissible.');continue;}
   pile.owner={type:'ground',...placement[0]!.cell};moved=true;
  }
  w.nextId++;appendPileEntries(w.piles,pile);ctx.thingIds.set(t.id,pile.id);
  notes.countAfter('production');
  const changes=[billRef&&billId===undefined?'Facture d’origine absente : ouvrage détaché.':undefined,ingredientAdapted?'Matériau de substitution signalé.':undefined,
   split?'Quantité incorporée conservée, fragment supérieur à 75 séparé.':undefined,moved?'Ouvrage déplacé sur une case libre voisine.':undefined].filter(Boolean).join(' ');
  notes.def('production',t.def,changes?'adapted':'exact',recipe,changes||undefined);
  notes.mapped('production',`Ouvrage ${t.def} : ${parts.reduce((n,p)=>n+p.quantity,0)} matériaux incorporés et progression conservés.`);
 }
}
