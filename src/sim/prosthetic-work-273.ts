import {appendPileEntries,filterPileEntries} from './pile-identity-directory.ts';
import {isSchema273OrLater} from './schema-compatibility-257.ts';
import {validProstheticWorkShape273} from './prosthetic-work-save-273.ts';
import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { healthRandom } from './health.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { isCookingOrder } from './order-types.ts';
import { PROSTHETIC_REQUIREMENTS_273,isProstheticRecipe273,type ProstheticRecipe273 } from './prosthetic-content-273.ts';
import { releaseAssignments } from './work-release.ts';
import type { Cell, CommandResult, MaterialPile, Pawn, World } from './types.ts';

export interface ProstheticWork273 {
  recipe:ProstheticRecipe273;
  authorId:number;
  progress:number;
  parts:{item:'steel'|'component';quantity:number}[];
  billId?:number;
}

const materials=['steel','component'] as const;
type ProstheticMaterial273=typeof materials[number];
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** Replace only already placed ingredients, after proving the whole workpiece fits. */
export function beginProstheticWork273(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking,recipe=task?.recipe;
  if(!isSchema273OrLater(world.schemaVersion)||!task||!isProstheticRecipe273(recipe))return null;
  if(task.ingredients.length===1&&task.ingredients[0]?.item==='unfinished-prosthetic'){
    const ingredient=task.ingredients[0]!,existing=world.piles.find(p=>p.id===ingredient.pileId);
    if(ingredient.quantity!==1||ingredient.stage!=='placed'||existing?.item!=='unfinished-prosthetic'||existing.owner.type!=='ground'||existing.owner.x!==ingredient.cell.x||existing.owner.z!==ingredient.cell.z||!validProstheticWorkShape273(existing as unknown as Record<string,unknown>,world.schemaVersion)||!existing.prostheticWork273||existing.prostheticWork273.recipe!==recipe||existing.prostheticWork273.authorId!==pawn.id||existing.prostheticWork273.billId!==undefined&&existing.prostheticWork273.billId!==task.billId)return null;
    existing.prostheticWork273.billId=task.billId;
    return existing;
  }
  const required=PROSTHETIC_REQUIREMENTS_273,totals={steel:0,component:0},used=new Map<number,{item:ProstheticMaterial273;quantity:number}>();
  if(!task.ingredients.length)return null;
  for(const ingredient of task.ingredients){
    if(ingredient.stage!=='placed'||!materials.includes(ingredient.item as ProstheticMaterial273)||!integer(ingredient.quantity,1))return null;
    const item=ingredient.item as ProstheticMaterial273,pile=world.piles.find(p=>p.id===ingredient.pileId);
    if(!pile||pile.item!==item||pile.owner.type!=='ground'||pile.owner.x!==ingredient.cell.x||pile.owner.z!==ingredient.cell.z)return null;
    totals[item]+=ingredient.quantity;
    const previous=used.get(pile.id);used.set(pile.id,{item,quantity:(previous?.quantity??0)+ingredient.quantity});
  }
  if(totals.steel!==required.steel||totals.component!==required.component||[...used].some(([id,part])=>world.piles.find(p=>p.id===id)!.quantity<part.quantity))return null;
  const parts:ProstheticWork273['parts']=[...used.values()].map(part=>({...part}));
  const piles=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!.quantity}:p).filter(p=>p.quantity>0);
  if(piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const shadow={...world,piles},spot=task.spot;
  const cells:Cell[]=[{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1}];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&ingredientPlaceFree(shadow,c,spot,recipe)&&groundCapacity(shadow,c,'unfinished-prosthetic',pawn.id)>=1);
  if(!cell)return null;
  const pile:MaterialPile={id:world.nextId++,item:'unfinished-prosthetic',kind:'unfinished',quantity:1,owner:{type:'ground',...cell},prostheticWork273:{recipe,authorId:pawn.id,progress:0,parts,billId:task.billId}};
  world.piles=[...piles,pile];
  task.ingredients=[{pileId:pile.id,item:'unfinished-prosthetic',quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);
  return pile;
}

/** Refund each source part independently, but publish neither drops nor RNG
 * until places for both material types have been reserved together. */
export function cancelProstheticWork273(world:World,itemId:number):CommandResult {
  const pile=world.piles.find(p=>p.id===itemId);
  if(pile?.item!=='unfinished-prosthetic'||!pile.prostheticWork273||pile.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Arme inachevée introuvable au sol.'};
  const random={rng:world.rng},refund:{steel:number;component:number}={steel:0,component:0};
  for(const part of pile.prostheticWork273.parts){
    const raw=part.quantity*.75,whole=Math.floor(raw);
    refund[part.item]+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);
  }
  const shadow={...world,piles:world.piles.filter(p=>p!==pile)};
  const plans:{item:ProstheticMaterial273;placements:{cell:Cell;quantity:number}[]}[]=[];
  for(const item of materials){
    if(!refund[item])continue;
    const placements=planGroundPlacement(shadow,refund[item],pile.owner,item);
    if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+plans.reduce((n,p)=>n+p.placements.length,0)+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver tous les matériaux récupérés.'};
    plans.push({item,placements});
    // Reserve each planned cell for the next type in the same shadow world.
    appendPileEntries(shadow.piles,...placements.map((p,i):MaterialPile=>({id:-(plans.length*1000+i+1),kind:item,item,quantity:p.quantity,owner:{type:'ground',...p.cell}})));
  }
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===itemId)||pawn.haul?.sourcePileId===itemId)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===itemId):o.sourcePileId!==itemId));
  }
  world.piles=filterPileEntries(world.piles,p=>p!==pile);
  for(const {item,placements} of plans)for(const placement of placements)addMaterial(world,item,placement.quantity,{type:'ground',...placement.cell},item);
  world.rng=random.rng;
  return {ok:true};
}

export function detachMissingProstheticBills273(world:World):void {
  if(!world.piles.some(p=>p.prostheticWork273?.billId))return;
  const bills=new Set([...world.structures,...world.packed.map(p=>p.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
  for(const pile of world.piles)if(pile.prostheticWork273?.billId&&!bills.has(pile.prostheticWork273.billId))delete pile.prostheticWork273.billId;
}

