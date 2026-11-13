import {isSchema289OrLater} from './schema-compatibility-257.ts';
import {isSchema273OrLater,isSchema278OrLater,isSchema283OrLater} from './schema-compatibility-257.ts';
import {validBillWorkerPolicy283} from './bill-worker-rules-283.ts';
import {validBillReservePauseState289} from './bill-pause-rules-289.ts';
import {isApparelCountRecipe278,newApparelCountFilter278,validApparelCountFilter278,countedApparelProducts278} from './apparel-count-278.ts';
import {isProstheticRecipe273} from './prosthetic-content-273.ts';
import {isSchema272OrLater,isSchema269OrLater,isSchema270OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isSchema267OrLater} from './schema-compatibility-257.ts';
import {isMaceItem269} from './mace-content-269.ts';
import {isSmithingRecipe267,smithingRecipeAvailable267,smithingInitialMaterial267,isSmithingProduct267} from './smithing-content-267.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import {isTextileMaterial308} from './textile-apparel-308.ts';
import {isBurnApparelRecipe} from './burn-apparel-rules.ts';
import {isPemmicanRecipe} from './pemmican-content.ts';
import { storageCells,storageCellAccepts,shelfAt } from './shelf-storage.ts';
import {isArtRecipe} from './art-rules.ts';
import { isKibbleRecipe } from './fodder-recipes.ts';
import { isSmeltingRecipe,validSmeltFilter } from './smelting-rules.ts';
import { isCremationRecipe,validCremationFilter } from './cremation-rules.ts';
import { V91_ITEM_IDS,V190_ITEM_IDS, isAnimalMeat } from './biome-items.ts';
import { ITEM_DEFINITIONS,V219_ITEM_IDS } from './items.ts';
import { isFoodWorkstation } from './food-workstations.ts';
import { groundOccupancyAllows } from './occupancy.ts';
import { isTailoring, BIOFUEL_INITIAL_ORGANICS,PRODUCTION_RECIPES,isBiofuelRecipe,isFlakRecipe,isRecipeProduct, type ProductionRecipe } from './production-recipes.ts';
import { canStandAt } from './furniture-travel.ts';
import { footprintCells, footprintContains } from './definitions.ts';
import { isCookingOrder } from './order-types.ts';
import type { CookingBill, BillSettings } from './cooking-types.ts';
import type {StagingGeometryReader} from './staging-validation.ts';
import { SCHEMA_VERSION,type Cell,type Structure,type World } from './types.ts';

export const COOK_TICKS=60; // 300 reference work / 10 local ticks × campfire factor 2.
export const INGREDIENT_UNITS=10; // 0.5 nutrition for the supported raw ingredients.
export function newCookingBill(id:number,recipe:ProductionRecipe='simple-meal',version:number=SCHEMA_VERSION):CookingBill {
  const inputs=PRODUCTION_RECIPES[recipe].inputs.filter(i=>(isSchema272OrLater(version)||!isSpearItem272(i))&&(version>=270||!isLongswordItem270(i))&&(version>=269||!isMaceItem269(i))&&(version>=267||!isSmithingProduct267(i))&&(version>=256||!isFutureEcologyItem256(i))&&(version>=197||!V219_ITEM_IDS.some(future=>future===i))&&(version>=308||!isTailoring(recipe)||!isTextileMaterial308(i)));
  return {id,recipe,mode:'times',target:1,suspended:false,filters:Object.fromEntries(inputs.map(i=>[i,isCremationRecipe(recipe)?i==='human-corpse':isSmithingRecipe267(recipe)?smithingInitialMaterial267(i as import('./smithing-content-267.ts').SmithingMaterial267,recipe):(recipe==='smelt-slag'||!isSmeltingRecipe(recipe))&&!isBurnApparelRecipe(recipe)&&(recipe!=='chemfuel-from-organics'||(BIOFUEL_INITIAL_ORGANICS as readonly string[]).includes(i))])),radius:999,destination:isCremationRecipe(recipe)||isBurnApparelRecipe(recipe)?'drop':'stockpile',
    ...(recipe==='smelt-weapon'||recipe==='smelt-apparel'||isBurnApparelRecipe(recipe))?{smeltFilter:{hpMin:0,hpMax:100,qualityMin:'awful',qualityMax:'legendary'}}:{},
    ...isCremationRecipe(recipe)?{cremationFilter:{colonists:true,strangers:true,fresh:true,rotting:true,desiccated:true}}:{},
    ...(isSchema278OrLater(version)&&isApparelCountRecipe278(recipe)?{apparelCount:newApparelCountFilter278()}:{})};
}
export function validBillSettings(value:unknown,recipe:ProductionRecipe='simple-meal',version:number=SCHEMA_VERSION):value is BillSettings {
  if(isProstheticRecipe273(recipe)&&!isSchema273OrLater(version))return false;
  if(isSmithingRecipe267(recipe)&&!smithingRecipeAvailable267(recipe,version)||recipe==='smelt-apparel'&&!isSchema267OrLater(version))return false;
  if(recipe==='brew-wort'&&version<265)return false;
  if(recipe==='smelt-slag'&&version<256)return false;
  if(isBurnApparelRecipe(recipe)&&version<251)return false;
  if(isPemmicanRecipe(recipe)&&version<248)return false;
  if(isKibbleRecipe(recipe)&&version<227)return false;
  if(isSmeltingRecipe(recipe)&&version<222)return false;
  if(isCremationRecipe(recipe)&&version<225)return false;
  if(isBiofuelRecipe(recipe)&&version<218)return false;
  if(recipe==='make-medicine'&&version<206)return false;
  if(recipe==='make-recon-armor'&&version<241)return false;
  if(recipe==='tuque'&&version<245)return false;
  if((recipe==='tshirt'||recipe==='jacket')&&version<312)return false;
  if(recipe==='make-emp-launcher'&&version<208)return false;
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as BillSettings;
  const reservePause=Object.getOwnPropertyDescriptor(value,'reservePause');
  if(!reservePause&&'reservePause'in value)return false;
  if(reservePause&&(!Object.hasOwn(reservePause,'value')||!reservePause.enumerable||!validBillReservePauseState289(reservePause.value,version,recipe)))return false;
  const worker=Object.getOwnPropertyDescriptor(value,'worker');
  if(!worker&&'worker'in value)return false;
  if(worker&&(!isSchema283OrLater(version)||!Object.hasOwn(worker,'value')||!worker.enumerable||!validBillWorkerPolicy283(worker.value)))return false;
  const apparelCount=Object.getOwnPropertyDescriptor(value,'apparelCount');
  if(!apparelCount&&'apparelCount'in value)return false;
  if(apparelCount&&(!isSchema278OrLater(version)||!isApparelCountRecipe278(recipe)||!Object.hasOwn(apparelCount,'value')||!apparelCount.enumerable||!validApparelCountFilter278(apparelCount.value)))return false;
  const smelting=recipe==='smelt-weapon'||recipe==='smelt-apparel'||isBurnApparelRecipe(recipe);
  const cremation=isCremationRecipe(recipe);
  if(smelting?!Object.hasOwn(v,'smeltFilter')||!validSmeltFilter(v.smeltFilter):Object.hasOwn(v,'smeltFilter'))return false;
  if(cremation?!Object.hasOwn(v,'cremationFilter')||!validCremationFilter(v.cremationFilter):Object.hasOwn(v,'cremationFilter'))return false;
  return Object.keys(v).every(k=>['id','recipe','mode','target','suspended','filters','radius','destination',...smelting?['smeltFilter']:[],...cremation?['cremationFilter']:[],...apparelCount?['apparelCount']:[],...worker?['worker']:[],...reservePause?['reservePause']:[]].includes(k))
    &&(smelting||cremation?['times','forever']:['times','until','forever']).includes(v.mode)&&Number.isSafeInteger(v.target)&&v.target>=0&&v.target<=9999
    &&typeof v.suspended==='boolean'&&!!v.filters&&typeof v.filters==='object'&&!Array.isArray(v.filters)
    &&Object.keys(v.filters).every(i=>(PRODUCTION_RECIPES[recipe].inputs as readonly string[]).includes(i)&&(isSchema272OrLater(version)||!isSpearItem272(i))&&(isSchema269OrLater(version)||!isMaceItem269(i))&&(isSchema270OrLater(version)||!isLongswordItem270(i))&&(version>=267||!isSmithingProduct267(i))&&(version>=265||i!=='hops')&&(version>=256||!isFutureEcologyItem256(i))&&(version>=197||!V219_ITEM_IDS.some(future=>future===i))&&(version>=308||!isTailoring(recipe)||!isTextileMaterial308(i)))
    // Old carcass filters stay absent after migration and therefore reject new
    // sources. Only a new bill or explicit settings can opt into those inputs.
    &&PRODUCTION_RECIPES[recipe].inputs.every(i=>typeof v.filters[i]==='boolean'||(isSmithingProduct267(i)||isMaceItem269(i)||isLongswordItem270(i)||isSpearItem272(i)||i==='hops'&&recipe!=='brew-wort'||isFutureEcologyItem256(i)||V219_ITEM_IDS.some(future=>future===i)||isTailoring(recipe)&&isTextileMaterial308(i)||(['milk','muffalo-wool'].includes(i)?version<120:['hare-meat','potato','corn',...V91_ITEM_IDS,...V190_ITEM_IDS].includes(i)))&&v.filters[i]===undefined)
    &&Number.isFinite(v.radius)&&v.radius>=0&&v.radius<=999&&(cremation||isBurnApparelRecipe(recipe)?v.destination==='drop':['stockpile','drop'].includes(v.destination));
}
/** Reference resource counter includes stored items and current task cargo.
 * Loose meals outside storage do not satisfy a target-count bill. */
export function countedMeals(world:World):number {return countedProducts(world);}
// Lazy initialization also keeps recipe/unfinished-work imports cycle-safe.
const COUNTED_PRODUCTS=new Map<ProductionRecipe,ReadonlySet<string>>();
export function countedProducts(world:World,bill?:CookingBill):number {
  if(bill&&Object.hasOwn(bill,'apparelCount'))return countedApparelProducts278(world,bill);
  const recipe=bill?.recipe??'simple-meal';
  if(isArtRecipe(recipe))return world.structures.filter(s=>s.kind===recipe).length+world.packed.filter(p=>p.building.kind===recipe&&p.owner.type!=='inventory').length;
  let products=COUNTED_PRODUCTS.get(recipe);
  if(!products){products=new Set(Object.keys(ITEM_DEFINITIONS).filter(item=>recipe==='butcher-creature'?isAnimalMeat(item):isRecipeProduct(recipe,item as keyof typeof ITEM_DEFINITIONS)));COUNTED_PRODUCTS.set(recipe,products);}
  const stored=new Map(storageCells(world).map(z=>[z.z*world.width+z.x,z] as const));
  const meal=isPemmicanRecipe(recipe)||isKibbleRecipe(recipe)||recipe==='cook-survival-meal'||recipe==='fine-meal'||recipe==='cook-fine-meal-bulk'||recipe==='vegetarian-fine-meal'||recipe==='cook-vegetarian-fine-meal-bulk'||recipe==='carnivore-fine-meal'||recipe==='cook-carnivore-fine-meal-bulk'||recipe==='lavish-meal'||recipe==='cook-lavish-meal-bulk'||recipe==='vegetarian-lavish-meal'||recipe==='cook-vegetarian-lavish-meal-bulk'||recipe==='cook-carnivore-lavish-meal'||recipe==='cook-carnivore-lavish-meal-bulk';
  return world.piles.reduce((n,p)=>{
    if(!products.has(p.item))return n;
    if(p.owner.type==='pawn'&&bill?.recipe!=='butcher-creature'||(isFlakRecipe(recipe)||isSmithingRecipe267(recipe))&&p.owner.type==='apparel')return n+p.quantity;
    if(p.owner.type!=='ground')return n;
    const zone=stored.get(p.owner.z*world.width+p.owner.x);
    return zone&&(!meal||storageCellAccepts(world,zone,p.item))?n+p.quantity:n;
  },0);
}
export function billWanted(world:World,bill:CookingBill,alreadyAdmitted=false):boolean {
  // Existing reserved orders keep their historical target/suspension checks;
  // only the new automatic memory is prospective to later admissions.
  if(!alreadyAdmitted&&isSchema289OrLater(world.schemaVersion)&&bill.mode==='until'&&bill.reservePause?.enabled&&bill.reservePause.paused)return false;
  return !bill.suspended&&(bill.mode==='forever'||bill.mode==='times'&&bill.target>0||bill.mode==='until'&&countedProducts(world,bill)<bill.target);
}
export function cookingSpot(station:Structure):Cell {
  const [dx,dz]=[[0,-1],[-1,0],[0,1],[1,0]][station.orientation]!;
  return {x:station.x+dx!,z:station.z+dz!};
}
export function cookingCellReserved(world:World,cell:Cell):boolean {
  if(world.pawns.some(p=>p.research&&p.research.spot.x===cell.x&&p.research.spot.z===cell.z))return true;
  for(const p of world.pawns)for(const order of p.orders?.queue??[])if(isCookingOrder(order)&&(order.cooking.spot.x===cell.x&&order.cooking.spot.z===cell.z||order.cooking.ingredients.some(i=>i.stage!=='placed'&&i.cell.x===cell.x&&i.cell.z===cell.z)))return true;
  return world.pawns.some(p=>p.cooking&&(p.cooking.spot.x===cell.x&&p.cooking.spot.z===cell.z
    ||p.cooking.ingredients.some(i=>i.stage!=='placed'&&i.cell.x===cell.x&&i.cell.z===cell.z)));
}
export function cookingPlaceFree(world:World,cell:Cell,geometry?:StagingGeometryReader):boolean {
  return (world.schemaVersion<22||canStandAt(world,cell))&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height
    &&!['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)
    &&!(geometry?geometry.hasResource(cell):world.resources.some(r=>r.x===cell.x&&r.z===cell.z))
    &&![...world.jobs,...world.structures].some(s=>(s.kind==='wall'||s.kind==='cooler'||s.kind==='table')&&footprintCells(s).some(c=>c.x===cell.x&&c.z===cell.z));
}

export const ingredientWithinReach=(cell:Cell,spot:Cell,station?:Structure):boolean=>station&&isFoodWorkstation(station.kind)?footprintContains(station,cell):Math.abs(cell.x-spot.x)+Math.abs(cell.z-spot.z)<=1;
/** New food benches stage on their three physical surface cells. Historical
 * stations keep their existing adjacent staging and continuation unchanged. */
export function ingredientPlaceFree(world:World,cell:Cell,spot:Cell,recipe:ProductionRecipe,station?:Structure,geometry?:StagingGeometryReader):boolean {
  if(geometry?.shelfAt?geometry.shelfAt(cell):shelfAt(world,cell))return false;
  if(station&&isFoodWorkstation(station.kind))return ingredientWithinReach(cell,spot,station)
    &&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height
    &&!['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)
    &&!(geometry?geometry.hasResource(cell):world.resources.some(r=>r.x===cell.x&&r.z===cell.z))&&(geometry?geometry.groundAllows(cell):groundOccupancyAllows(world,cell));
  if(isPemmicanRecipe(recipe)||recipe==='cook-survival-meal'||recipe==='simple-meal'||recipe==='cook-simple-meal-bulk'||recipe==='fine-meal'||recipe==='cook-fine-meal-bulk'||recipe==='vegetarian-fine-meal'||recipe==='cook-vegetarian-fine-meal-bulk'||recipe==='carnivore-fine-meal'||recipe==='cook-carnivore-fine-meal-bulk'||recipe==='lavish-meal'||recipe==='cook-lavish-meal-bulk'||recipe==='vegetarian-lavish-meal'||recipe==='cook-vegetarian-lavish-meal-bulk'||recipe==='cook-carnivore-lavish-meal'||recipe==='cook-carnivore-lavish-meal-bulk')return cookingPlaceFree(world,cell,geometry);
  return (cell.x!==spot.x||cell.z!==spot.z)&&Math.abs(cell.x-spot.x)+Math.abs(cell.z-spot.z)<=1
    &&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height
    &&!['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)
    &&!(geometry?geometry.hasResource(cell):world.resources.some(r=>r.x===cell.x&&r.z===cell.z))&&(geometry?geometry.groundAllows(cell):groundOccupancyAllows(world,cell));
}
/** An advanced component's unfinished body can rest on the nearby fabrication
 * surface. Ordinary ingredients and historical workpieces keep their reach. */
export function componentWorkpiecePlaceFree(world:World,cell:Cell,spot:Cell,recipe:ProductionRecipe,station?:Structure,geometry?:StagingGeometryReader):boolean {
  if(ingredientPlaceFree(world,cell,spot,recipe,station,geometry))return true;
  return recipe==='make-advanced-component'&&station?.kind==='fabrication-bench'
    &&Math.abs(cell.x-spot.x)+Math.abs(cell.z-spot.z)<=2
    &&footprintCells(station).some(c=>c.x===cell.x&&c.z===cell.z)
    &&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height
    &&!['water','rock'].includes(world.tiles[cell.z*world.width+cell.x]!.terrain)
    &&!(geometry?geometry.hasResource(cell):world.resources.some(r=>r.x===cell.x&&r.z===cell.z))&&(geometry?geometry.groundAllows(cell):groundOccupancyAllows(world,cell));
}
