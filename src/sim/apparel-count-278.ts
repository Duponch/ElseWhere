import {APPAREL} from './apparel-definitions.ts';
import {WEAPON_QUALITIES} from './equipment-rules.ts';
import {isRecipeProduct,type ProductionRecipe} from './production-recipes.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {isSchema278OrLater} from './schema-compatibility-257.ts';
/** Schema 374: Core's includeTainted bill option (Bill_Production, default false). */
export const isBillTaintedSchema374=(version:unknown):boolean=>typeof version==='number'&&version>=374;
import type {ApparelCountFilter278,CookingBill} from './cooking-types.ts';
import {SCHEMA_VERSION,type Cell,type Pawn,type World} from './types.ts';

const RECIPES=['tribalwear','shirt','pants','duster','parka','tuque','tshirt','jacket','cowboy-hat','bowler-hat','make-flak-vest','make-flak-pants','make-flak-helmet','make-recon-helmet','make-recon-armor','make-plate-armor','make-simple-helmet'] as const;
export type ApparelCountRecipe278=typeof RECIPES[number];
export const isApparelCountRecipe278=(value:unknown):value is ApparelCountRecipe278=>typeof value==='string'&&(RECIPES as readonly string[]).includes(value);
/** From schema 374 a new filter holds Core's includeTainted, false by default. */
export const newApparelCountFilter278=(version:number=SCHEMA_VERSION):ApparelCountFilter278=>({hpMin:0,hpMax:100,qualityMin:'awful',qualityMax:'legendary',includeEquipped:false,...isBillTaintedSchema374(version)?{includeTainted374:false}:{}});

/** A prospective data domain. Never invoke getters on an imported filter. */
export function validApparelCountFilter278(value:unknown,version=Number.MAX_SAFE_INTEGER):value is ApparelCountFilter278 {
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)return false;
 const tainted=Object.hasOwn(value,'includeTainted374');if(tainted&&!isBillTaintedSchema374(version))return false;
 const keys=['hpMin','hpMax','qualityMin','qualityMax','includeEquipped',...tainted?['includeTainted374']:[]],descriptors=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).length!==keys.length||!keys.every(k=>Object.hasOwn(descriptors,k)&&Object.hasOwn(descriptors[k]!,'value')&&descriptors[k]!.enumerable))return false;
 const v=value as ApparelCountFilter278,min=WEAPON_QUALITIES.indexOf(v.qualityMin),max=WEAPON_QUALITIES.indexOf(v.qualityMax);
 return Number.isInteger(v.hpMin)&&Number.isInteger(v.hpMax)&&v.hpMin>=0&&v.hpMin<=v.hpMax&&v.hpMax<=100&&min>=0&&max>=min&&typeof v.includeEquipped==='boolean'&&(!tainted||typeof v.includeTainted374==='boolean');
}

// Static catalogue only; no World/owner/condition result survives a call.
// Lazy creation preserves the existing production-module import boundaries.
const PRODUCTS=new Map<ApparelCountRecipe278,ReadonlySet<string>>();
function products278(recipe:ApparelCountRecipe278):ReadonlySet<string> {
 let products=PRODUCTS.get(recipe);
 if(!products){products=new Set(Object.keys(APPAREL).filter(item=>isRecipeProduct(recipe as ProductionRecipe,item as keyof typeof APPAREL)));PRODUCTS.set(recipe,products);}
 return products;
}
const spawned=(p:Pawn):boolean=>p.state!=='dead'&&!p.health?.death&&p.shipCryptosleepHeldAt277===undefined&&p.cryptosleepHeldAt271===undefined;

/** Map-local original owners only. Cargo is not personal inventory, and the
 * includeEquipped option never reaches travellers, caskets or WorldPawns.
 * Apparel uses raw float32 HP ratios with the Core FloatRange epsilon;
 * storage's rounded percentages deliberately have a different contract. */
export function countedApparelProducts278(world:World,bill:Pick<CookingBill,'recipe'|'apparelCount'>):number {
 const field=Object.getOwnPropertyDescriptor(bill,'apparelCount');
 if(!isSchema278OrLater(world.schemaVersion)||!isApparelCountRecipe278(bill.recipe)||!field||!Object.hasOwn(field,'value')||!field.enumerable||!validApparelCountFilter278(field.value))return 0;
 const filter:ApparelCountFilter278=field.value,products=products278(bill.recipe),carriers=new Map<number,Pawn>(),colonists=new Set<number>(),player=world.worldFactions?.playerFactionId;
 for(const p of world.pawns){
  if(!spawned(p)||(p.faction??'colony')!=='colony'||p.worldAffiliation259&&p.worldAffiliation259.factionId!==player)continue;
  carriers.set(p.id,p);
  if(!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue)colonists.add(p.id);
 }
 const f=Math.fround,hpMin=f(f(filter.hpMin/100)-f(.00001)),hpMax=f(f(filter.hpMax/100)+f(.00001)),qualityMin=WEAPON_QUALITIES.indexOf(filter.qualityMin),qualityMax=WEAPON_QUALITIES.indexOf(filter.qualityMax);
 const visible=(cell:Cell)=>Number.isInteger(cell.x)&&Number.isInteger(cell.z)&&cell.x>=0&&cell.z>=0&&cell.x<world.width&&cell.z<world.height&&!foggedCell256(world,cell.z*world.width+cell.x);
 let count=0;
 // Schema 374: RecipeWorkerCounter.CountValidThing skips apparel worn by a corpse unless the bill includes it.
 const skipTainted=filter.includeTainted374===false;
 for(const p of world.piles){
  if(p.kind!=='apparel'||!products.has(p.item)||!p.apparel||skipTainted&&p.apparel.corpseWear284===true)continue;
  const definition=APPAREL[p.item as keyof typeof APPAREL],ratio=f(p.apparel.hitPoints/definition.hitPoints),quality=WEAPON_QUALITIES.indexOf(p.apparel.quality);
  if(!Number.isFinite(ratio)||ratio<hpMin||ratio>hpMax||quality<qualityMin||quality>qualityMax)continue;
  const owner=p.owner;
  if(owner.type==='ground'){if(visible(owner))count+=p.quantity;continue;}
  if(owner.type==='pawn'){
   const carrier=carriers.get(owner.pawnId);if(carrier&&visible(carrier))count+=p.quantity;continue;
  }
  if(filter.includeEquipped&&(owner.type==='apparel'||owner.type==='equipment'||owner.type==='inventory')&&colonists.has(owner.pawnId)){
   const holder=carriers.get(owner.pawnId)!;if(visible(holder))count+=p.quantity;
  }
 }
 return count;
}
