import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { healthRandom } from './health.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { isCookingOrder } from './order-types.ts';
import { GUN_REQUIREMENTS, isGunRecipe, productionWorkTotal, type GunRecipe } from './production-recipes.ts';
import { releaseAssignments } from './work-release.ts';
import type { Cell, CommandResult, MaterialPile, Pawn, World } from './types.ts';

export interface GunWork {
  recipe:GunRecipe;
  authorId:number;
  progress:number;
  parts:{item:'steel'|'component';quantity:number}[];
  billId?:number;
}

const materials=['steel','component'] as const;
type GunMaterial=typeof materials[number];
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** Replace only already placed ingredients, after proving the whole workpiece fits. */
export function beginGunWork(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking,recipe=task?.recipe;
  if(!task||!isGunRecipe(recipe))return null;
  if(task.ingredients.length===1&&task.ingredients[0]?.item==='unfinished-gun'){
    const ingredient=task.ingredients[0]!,existing=world.piles.find(p=>p.id===ingredient.pileId);
    if(ingredient.quantity!==1||ingredient.stage!=='placed'||existing?.item!=='unfinished-gun'||existing.owner.type!=='ground'||!existing.gunWork||existing.gunWork.recipe!==recipe||existing.gunWork.authorId!==pawn.id||existing.gunWork.billId!==undefined&&existing.gunWork.billId!==task.billId)return null;
    existing.gunWork.billId=task.billId;
    return existing;
  }
  const required=GUN_REQUIREMENTS[recipe],totals={steel:0,component:0},used=new Map<number,{item:GunMaterial;quantity:number}>();
  if(!task.ingredients.length)return null;
  for(const ingredient of task.ingredients){
    if(ingredient.stage!=='placed'||!materials.includes(ingredient.item as GunMaterial)||!integer(ingredient.quantity,1))return null;
    const item=ingredient.item as GunMaterial,pile=world.piles.find(p=>p.id===ingredient.pileId);
    if(!pile||pile.item!==item||pile.owner.type!=='ground'||pile.owner.x!==ingredient.cell.x||pile.owner.z!==ingredient.cell.z)return null;
    totals[item]+=ingredient.quantity;
    const previous=used.get(pile.id);used.set(pile.id,{item,quantity:(previous?.quantity??0)+ingredient.quantity});
  }
  if(totals.steel!==required.steel||totals.component!==required.component||[...used].some(([id,part])=>world.piles.find(p=>p.id===id)!.quantity<part.quantity))return null;
  const parts:GunWork['parts']=[...used.values()].map(part=>({...part}));
  const piles=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!.quantity}:p).filter(p=>p.quantity>0);
  if(piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const shadow={...world,piles},spot=task.spot;
  const cells:Cell[]=[{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1}];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&ingredientPlaceFree(shadow,c,spot,recipe)&&groundCapacity(shadow,c,'unfinished-gun',pawn.id)>=1);
  if(!cell)return null;
  const pile:MaterialPile={id:world.nextId++,item:'unfinished-gun',kind:'unfinished',quantity:1,owner:{type:'ground',...cell},gunWork:{recipe,authorId:pawn.id,progress:0,parts,billId:task.billId}};
  world.piles=[...piles,pile];
  task.ingredients=[{pileId:pile.id,item:'unfinished-gun',quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);
  return pile;
}

/** Refund each source part independently, but publish neither drops nor RNG
 * until places for both material types have been reserved together. */
export function cancelGunWork(world:World,itemId:number):CommandResult {
  const pile=world.piles.find(p=>p.id===itemId);
  if(pile?.item!=='unfinished-gun'||!pile.gunWork||pile.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Arme inachevée introuvable au sol.'};
  const random={rng:world.rng},refund:{steel:number;component:number}={steel:0,component:0};
  for(const part of pile.gunWork.parts){
    const raw=part.quantity*.75,whole=Math.floor(raw);
    refund[part.item]+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);
  }
  const shadow={...world,piles:world.piles.filter(p=>p!==pile)};
  const plans:{item:GunMaterial;placements:{cell:Cell;quantity:number}[]}[]=[];
  for(const item of materials){
    if(!refund[item])continue;
    const placements=planGroundPlacement(shadow,refund[item],pile.owner,item);
    if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+plans.reduce((n,p)=>n+p.placements.length,0)+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver tous les matériaux récupérés.'};
    plans.push({item,placements});
    // Reserve each planned cell for the next type in the same shadow world.
    shadow.piles.push(...placements.map((p,i):MaterialPile=>({id:-(plans.length*1000+i+1),kind:item,item,quantity:p.quantity,owner:{type:'ground',...p.cell}})));
  }
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===itemId)||pawn.haul?.sourcePileId===itemId)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===itemId):o.sourcePileId!==itemId));
  }
  world.piles=world.piles.filter(p=>p!==pile);
  for(const {item,placements} of plans)for(const placement of placements)addMaterial(world,item,placement.quantity,{type:'ground',...placement.cell},item);
  world.rng=random.rng;
  return {ok:true};
}

export function detachMissingGunBills(world:World):void {
  if(!world.piles.some(p=>p.gunWork?.billId))return;
  const bills=new Set([...world.structures,...world.packed.map(p=>p.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
  for(const pile of world.piles)if(pile.gunWork?.billId&&!bills.has(pile.gunWork.billId))delete pile.gunWork.billId;
}

export function validGunWorkShape(p:Record<string,unknown>,version:number):boolean {
  if(p.item!=='unfinished-gun')return p.gunWork===undefined;
  const work=p.gunWork,owner=p.owner;
  if(version<101||p.kind!=='unfinished'||p.quantity!==1||!record(owner)||!['ground','pawn'].includes(String(owner.type))||!record(work)||!isGunRecipe(work.recipe)||version<208&&work.recipe==='make-emp-launcher'||version<322&&work.recipe==='make-pump-shotgun')return false;
  const recipe=work.recipe,required=GUN_REQUIREMENTS[recipe];
  if(Object.keys(work).some(k=>!['recipe','authorId','progress','parts','billId'].includes(k))||!integer(work.authorId,1)||!integer(work.progress,0,productionWorkTotal(recipe))||work.billId!==undefined&&!integer(work.billId,1)||!Array.isArray(work.parts)||work.parts.length<2||work.parts.length>63)return false;
  const totals={steel:0,component:0};
  for(const part of work.parts){
    if(!record(part)||Object.keys(part).some(k=>!['item','quantity'].includes(k))||!materials.includes(part.item as GunMaterial)||!integer(part.quantity,1,75))return false;
    totals[part.item as GunMaterial]+=part.quantity as number;
  }
  return totals.steel===required.steel&&totals.component===required.component;
}

export function validateGunWorks(world:World,version:number):string[] {
  const errors:string[]=[],bound=new Set<number>();
  for(const pile of world.piles){
    if(pile.item!=='unfinished-gun'&&pile.gunWork===undefined)continue;
    if(!validGunWorkShape(pile as unknown as Record<string,unknown>,version)){errors.push('Invalid unfinished gun.');continue;}
    const work=pile.gunWork!;
    if(!world.pawns.some(p=>p.id===work.authorId))errors.push('Missing unfinished gun author.');
    if(work.billId!==undefined){
      if(bound.has(work.billId)||![...world.structures,...world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>b.id===work.billId&&b.recipe===work.recipe)))errors.push('Invalid unfinished gun bound bill.');
      bound.add(work.billId);
    }
  }
  return errors;
}
