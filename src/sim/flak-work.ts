import {appendPileEntries,filterPileEntries} from './pile-identity-directory.ts';
import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import { isFlakPantsSchema375 } from './flak-pants-375.ts';
import { ingredientPlaceFree } from './cooking-bills.ts';
import { groundCapacity, planGroundPlacement } from './ground-placement.ts';
import { healthRandom } from './health.ts';
import { addMaterial, refreshStock } from './materials.ts';
import { isCookingOrder } from './order-types.ts';
import { flakRequirements, flakWorkpiece, isFlakRecipe, productionWorkTotal, type FlakRecipe } from './production-recipes.ts';
import { releaseAssignments } from './work-release.ts';
import type { Cell, CommandResult, MaterialPile, Pawn, World } from './types.ts';

type FlakMaterial='cloth'|'steel'|'component'|'plasteel'|'advanced-component'|'uranium';
const recipeMaterials=(recipe:FlakRecipe):readonly FlakMaterial[]=>recipe==='make-flak-vest'||recipe==='make-flak-pants'?['cloth','steel','component']:recipe==='make-flak-helmet'?['steel','component','plasteel']:recipe==='make-recon-armor'?['plasteel','advanced-component','uranium']:['plasteel','advanced-component'];
const requirement=(recipe:FlakRecipe,item:FlakMaterial):number=>(flakRequirements(recipe) as unknown as Record<string,number>)[item]??0;
export interface FlakWork {
  recipe:FlakRecipe;
  authorId:number;
  progress:number;
  parts:{item:FlakMaterial;quantity:number}[];
  billId?:number;
}
const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** Incorporate exact staged source parts only after a ground slot is found. */
export function beginFlakWork(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking,recipe=task?.recipe;
  if(!task||!isFlakRecipe(recipe))return null;
  const workpiece=flakWorkpiece(recipe),needed=recipeMaterials(recipe);
  if(task.ingredients.length===1&&task.ingredients[0]?.item===workpiece){
    const ingredient=task.ingredients[0]!,existing=world.piles.find(p=>p.id===ingredient.pileId);
    if(ingredient.quantity!==1||ingredient.stage!=='placed'||existing?.item!==workpiece||existing.owner.type!=='ground'||!existing.flakWork||existing.flakWork.recipe!==recipe||existing.flakWork.authorId!==pawn.id||existing.flakWork.billId!==undefined&&existing.flakWork.billId!==task.billId)return null;
    existing.flakWork.billId=task.billId;return existing;
  }
  const totals:Record<FlakMaterial,number>={cloth:0,steel:0,component:0,plasteel:0,'advanced-component':0,uranium:0},used=new Map<number,{item:FlakMaterial;quantity:number}>();
  if(!task.ingredients.length)return null;
  for(const ingredient of task.ingredients){
    if(ingredient.stage!=='placed'||!needed.includes(ingredient.item as FlakMaterial)||!integer(ingredient.quantity,1))return null;
    const item=ingredient.item as FlakMaterial,pile=world.piles.find(p=>p.id===ingredient.pileId);
    if(!pile||pile.item!==item||pile.owner.type!=='ground'||pile.owner.x!==ingredient.cell.x||pile.owner.z!==ingredient.cell.z)return null;
    totals[item]+=ingredient.quantity;
    const previous=used.get(pile.id);used.set(pile.id,{item,quantity:(previous?.quantity??0)+ingredient.quantity});
  }
  if(needed.some(item=>totals[item]!==requirement(recipe,item))||[...used].some(([id,part])=>world.piles.find(p=>p.id===id)!.quantity<part.quantity))return null;
  const parts:FlakWork['parts']=[...used.values()].map(part=>({...part}));
  const piles=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!.quantity}:p).filter(p=>p.quantity>0);
  if(piles.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const shadow={...world,piles},spot=task.spot;
  const cells:Cell[]=[{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1}];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&ingredientPlaceFree(shadow,c,spot,recipe)&&groundCapacity(shadow,c,workpiece,pawn.id)>=1);
  if(!cell)return null;
  const pile:MaterialPile={id:world.nextId++,item:workpiece,kind:'unfinished',quantity:1,owner:{type:'ground',...cell},flakWork:{recipe,authorId:pawn.id,progress:0,parts,billId:task.billId}};
  world.piles=[...piles,pile];
  task.ingredients=[{pileId:pile.id,item:workpiece,quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);return pile;
}

/** Draw per original part, then reserve every refund before mutating world/RNG. */
export function cancelFlakWork(world:World,itemId:number):CommandResult {
  const pile=world.piles.find(p=>p.id===itemId);
  if(!pile?.flakWork||pile.item!==flakWorkpiece(pile.flakWork.recipe)||pile.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Armure inachevée introuvable au sol.'};
  const random={rng:world.rng},refund:Record<FlakMaterial,number>={cloth:0,steel:0,component:0,plasteel:0,'advanced-component':0,uranium:0};
  for(const part of pile.flakWork.parts){
    const raw=part.quantity*.75,whole=Math.floor(raw);
    refund[part.item]+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);
  }
  const shadow={...world,piles:world.piles.filter(p=>p!==pile)};
  const plans:{item:FlakMaterial;placements:{cell:Cell;quantity:number}[]}[]=[];
  for(const item of recipeMaterials(pile.flakWork.recipe)){
    if(!refund[item])continue;
    const placements=planGroundPlacement(shadow,refund[item],pile.owner,item);
    if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+plans.reduce((n,p)=>n+p.placements.length,0)+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver tous les matériaux récupérés.'};
    plans.push({item,placements});
    appendPileEntries(shadow.piles,...placements.map((p,i):MaterialPile=>({id:-(plans.length*1000+i+1),kind:item==='cloth'?'textile':item,item,quantity:p.quantity,owner:{type:'ground',...p.cell}})));
  }
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===itemId)||pawn.haul?.sourcePileId===itemId)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===itemId):o.sourcePileId!==itemId));
  }
  world.piles=filterPileEntries(world.piles,p=>p!==pile);
  for(const {item,placements} of plans)for(const placement of placements)addMaterial(world,item==='cloth'?'textile':item,placement.quantity,{type:'ground',...placement.cell},item);
  world.rng=random.rng;return {ok:true};
}

export function detachMissingFlakBills(world:World):void {
  if(!world.piles.some(p=>p.flakWork?.billId))return;
  const bills=new Set([...world.structures,...world.packed.map(p=>p.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
  for(const pile of world.piles)if(pile.flakWork?.billId&&!bills.has(pile.flakWork.billId))delete pile.flakWork.billId;
}

export function validFlakWorkShape(p:Record<string,unknown>,version:number):boolean {
  if(p.item!=='unfinished-flak-vest'&&p.item!=='unfinished-flak-pants'&&p.item!=='unfinished-flak-helmet'&&p.item!=='unfinished-recon-helmet'&&p.item!=='unfinished-recon-armor')return p.flakWork===undefined;
  const work=p.flakWork,owner=p.owner;
  if(version<109||p.kind!=='unfinished'||p.quantity!==1||!record(owner)||!['ground','pawn'].includes(String(owner.type))||!record(work)||!isFlakRecipe(work.recipe)||version<141&&work.recipe==='make-flak-helmet'||version<148&&work.recipe==='make-recon-helmet'||version<241&&work.recipe==='make-recon-armor'||!isFlakPantsSchema375(version)&&work.recipe==='make-flak-pants'||p.item!==flakWorkpiece(work.recipe))return false;
  if(Object.keys(work).some(k=>!['recipe','authorId','progress','parts','billId'].includes(k))||!integer(work.authorId,1)||!integer(work.progress,0,productionWorkTotal(work.recipe))||work.billId!==undefined&&!integer(work.billId,1)||!Array.isArray(work.parts)||work.parts.length<(work.recipe==='make-recon-helmet'?2:3)||work.parts.length>93)return false;
  const recipe=work.recipe as FlakRecipe;
  const totals:Record<FlakMaterial,number>={cloth:0,steel:0,component:0,plasteel:0,'advanced-component':0,uranium:0},needed=recipeMaterials(recipe);
  for(const part of work.parts){
    if(!record(part)||Object.keys(part).some(k=>!['item','quantity'].includes(k))||!needed.includes(part.item as FlakMaterial)||!integer(part.quantity,1,75))return false;
    totals[part.item as FlakMaterial]+=part.quantity as number;
  }
  return needed.every(item=>totals[item]===requirement(recipe,item));
}

export function validateFlakWorks(world:World,version:number):string[] {
  const errors:string[]=[],bound=new Set<number>();
  for(const pile of world.piles){
    if(pile.item!=='unfinished-flak-vest'&&pile.item!=='unfinished-flak-pants'&&pile.item!=='unfinished-flak-helmet'&&pile.item!=='unfinished-recon-helmet'&&pile.item!=='unfinished-recon-armor'&&pile.flakWork===undefined)continue;
    if(!validFlakWorkShape(pile as unknown as Record<string,unknown>,version)){errors.push('Invalid unfinished flak armor.');continue;}
    const work=pile.flakWork!;
    if(!world.pawns.some(p=>p.id===work.authorId))errors.push('Missing unfinished flak vest author.');
    if(work.billId!==undefined){
      if(bound.has(work.billId)||![...world.structures,...world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>b.id===work.billId&&b.recipe===work.recipe)))errors.push('Invalid unfinished flak vest bound bill.');
      bound.add(work.billId);
    }
  }
  return errors;
}
