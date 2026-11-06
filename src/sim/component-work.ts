import { allowedAreaAllows,allowedAreaWorkAllowed } from './allowed-area-state.ts';
import {componentWorkpiecePlaceFree,cookingSpot,ingredientPlaceFree} from './cooking-bills.ts';
import {footprintCells} from './definitions.ts';
import {blockedCells,reachableCells,routeToJob} from './pathfinding.ts';
import {groundCapacity,planGroundPlacement} from './ground-placement.ts';
import {healthRandom} from './health.ts';
import {addMaterial,refreshStock} from './materials.ts';
import {validAdvancedComponentIngredients} from './machining.ts';
import {isCookingOrder} from './order-types.ts';
import {ADVANCED_COMPONENT_REQUIREMENTS,isComponentRecipe,productionWorkTotal,type AdvancedComponentMaterial} from './production-recipes.ts';
import {releaseAssignments} from './work-release.ts';
import type {Cell,CommandResult,MaterialPile,Pawn,World} from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface OrdinaryComponentWork {
  recipe:'make-component';
  authorId:number;
  progress:number;
  /** One part per incorporated steel source, preserving cancellation rounding. */
  parts:number[];
  billId?:number;
}
export interface AdvancedComponentWork {
  recipe:'make-advanced-component';
  authorId:number;
  progress:number;
  /** Physical sources, kept separate so cancellation rounds each part. */
  parts:{item:AdvancedComponentMaterial;quantity:number}[];
  billId?:number;
}
export type ComponentWork=OrdinaryComponentWork|AdvancedComponentWork;

const record=(value:unknown):value is Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):boolean=>Number.isSafeInteger(value)&&Number(value)>=min&&Number(value)<=max;

/** A single authored workpiece owns the 12 physical steel once work begins. */
export function beginComponentWork(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking;
  if(!isComponentRecipe(task?.recipe))return null;
  if(task.ingredients.length===1&&task.ingredients[0]?.item==='unfinished-component'){
    const ingredient=task.ingredients[0]!,existing=world.piles.find(p=>p.id===ingredient.pileId);
    if(ingredient.quantity!==1||ingredient.stage!=='placed'||existing?.item!=='unfinished-component'||existing.owner.type!=='ground'||!existing.componentWork||existing.componentWork.recipe!==task.recipe||existing.componentWork.authorId!==pawn.id||existing.componentWork.billId!==undefined&&existing.componentWork.billId!==task.billId)return null;
    existing.componentWork.billId=task.billId;return existing;
  }
  if(task.recipe==='make-advanced-component')return beginAdvancedComponentWork(world,pawn);
  const used=new Map<number,number>();
  for(const ingredient of task.ingredients){
    if(ingredient.item!=='steel'||ingredient.stage!=='placed'||!integer(ingredient.quantity,1,12))return null;
    const pile=world.piles.find(p=>p.id===ingredient.pileId);
    if(pile?.item!=='steel'||pile.owner.type!=='ground'||pile.owner.x!==ingredient.cell.x||pile.owner.z!==ingredient.cell.z)return null;
    used.set(pile.id,(used.get(pile.id)??0)+ingredient.quantity);
  }
  if(!used.size||[...used.values()].reduce((sum,n)=>sum+n,0)!==12||[...used].some(([id,n])=>world.piles.find(p=>p.id===id)!.quantity<n))return null;
  const remaining=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!}:p).filter(p=>p.quantity>0);
  if(remaining.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const shadow={...world,piles:remaining},spot=task.spot;
  const cells:Cell[]=[{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1}];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&ingredientPlaceFree(shadow,c,spot,'make-component')&&groundCapacity(shadow,c,'unfinished-component',pawn.id)>=1);
  if(!cell)return null;
  const piece:MaterialPile={id:world.nextId++,item:'unfinished-component',kind:'unfinished',quantity:1,owner:{type:'ground',...cell},componentWork:{recipe:'make-component',authorId:pawn.id,progress:0,parts:[...used.values()],billId:task.billId}};
  world.piles=[...remaining,piece];
  task.ingredients=[{pileId:piece.id,item:'unfinished-component',quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);return piece;
}

/** Consume the four exact material totals only after a reachable workpiece cell exists. */
function beginAdvancedComponentWork(world:World,pawn:Pawn):MaterialPile|null {
  if(!allowedAreaWorkAllowed(world,pawn))return null;
  const task=pawn.cooking!;
  const used=new Map<number,{item:AdvancedComponentMaterial;quantity:number}>();
  for(const ingredient of task.ingredients){
    if(ingredient.stage!=='placed'||!['component','steel','plasteel','gold'].includes(ingredient.item)||!integer(ingredient.quantity,1,34))return null;
    const item=ingredient.item as AdvancedComponentMaterial,pile=world.piles.find(p=>p.id===ingredient.pileId);
    if(pile?.item!==item||pile.owner.type!=='ground'||pile.owner.x!==ingredient.cell.x||pile.owner.z!==ingredient.cell.z)return null;
    const prior=used.get(pile.id);used.set(pile.id,{item,quantity:(prior?.quantity??0)+ingredient.quantity});
  }
  const parts=[...used.values()];
  if(!validAdvancedComponentIngredients('make-advanced-component',parts)||[...used].some(([id,part])=>world.piles.find(p=>p.id===id)!.quantity<part.quantity))return null;
  const remaining=world.piles.map(p=>used.has(p.id)?{...p,quantity:p.quantity-used.get(p.id)!.quantity}:p).filter(p=>p.quantity>0);
  if(remaining.length>=32768||!Number.isSafeInteger(world.nextId+1))return null;
  const shadow={...world,piles:remaining},spot=task.spot,station=structureById(world,task.stationId);
  const cells:Cell[]=[{x:spot.x,z:spot.z+1},{x:spot.x+1,z:spot.z},{x:spot.x-1,z:spot.z},{x:spot.x,z:spot.z-1},...(station?footprintCells(station):[])];
  const cell=cells.find(c=>allowedAreaAllows(world,pawn,c)&&componentWorkpiecePlaceFree(shadow,c,spot,'make-advanced-component',station)&&groundCapacity(shadow,c,'unfinished-component',pawn.id)>=1);
  if(!cell)return null;
  const piece:MaterialPile={id:world.nextId++,item:'unfinished-component',kind:'unfinished',quantity:1,owner:{type:'ground',...cell},componentWork:{recipe:'make-advanced-component',authorId:pawn.id,progress:0,parts,billId:task.billId}};
  world.piles=[...remaining,piece];
  task.ingredients=[{pileId:piece.id,item:'unfinished-component',quantity:1,stage:'placed',cell:{...cell}}];
  refreshStock(world);return piece;
}

/** Plan refunds and identities before touching the workpiece, jobs or RNG. */
export function cancelComponentWork(world:World,itemId:number):CommandResult {
  const piece=world.piles.find(p=>p.id===itemId);
  if(piece?.item!=='unfinished-component'||!piece.componentWork||piece.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Composant inachevé introuvable au sol.'};
  if(piece.componentWork.recipe==='make-advanced-component')return cancelAdvancedComponentWork(world,piece);
  const random={rng:world.rng};let refund=0;
  for(const part of piece.componentWork.parts){const raw=part*.75,whole=Math.floor(raw);refund+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);}
  const shadow={...world,piles:world.piles.filter(p=>p!==piece)},placements=planGroundPlacement(shadow,refund,piece.owner,'steel');
  if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver l’acier récupéré.'};
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===itemId)||pawn.haul?.sourcePileId===itemId)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===itemId):o.sourcePileId!==itemId));
  }
  world.piles=shadow.piles;
  for(const placement of placements)addMaterial(world,'steel',placement.quantity,{type:'ground',...placement.cell},'steel');
  world.rng=random.rng;return {ok:true};
}

function cancelAdvancedComponentWork(world:World,piece:MaterialPile):CommandResult {
  const work=piece.componentWork;
  if(!work||work.recipe!=='make-advanced-component'||piece.owner.type!=='ground')return {ok:false,code:'missing-target',reason:'Composant avancé inachevé introuvable au sol.'};
  const random={rng:world.rng},refund:{[K in AdvancedComponentMaterial]:number}={component:0,steel:0,plasteel:0,gold:0};
  for(const part of work.parts){
    const raw=part.quantity*.75,whole=Math.floor(raw);
    refund[part.item]+=whole+(raw>whole&&healthRandom(random)<raw-whole?1:0);
  }
  const shadow={...world,piles:world.piles.filter(p=>p!==piece)};
  const station=world.structures.find(s=>s.kind==='fabrication-bench'&&s.bills?.some(b=>b.id===work.billId&&b.recipe===work.recipe));
  const stationSpot=station&&cookingSpot(station);
  const origin=stationSpot&&componentWorkpiecePlaceFree(shadow,piece.owner,stationSpot,work.recipe,station)?stationSpot:piece.owner;
  const author=world.pawns.find(p=>p.id===work.authorId);
  const reach=reachableCells(shadow,stationSpot??author??origin,blockedCells(shadow),new Set());
  const plans:{item:AdvancedComponentMaterial;placements:{cell:Cell;quantity:number}[]}[]=[];
  for(const item of ['component','steel','plasteel','gold'] as const){
    if(!refund[item])continue;
    const placements=planGroundPlacement(shadow,refund[item],origin,item,cell=>routeToJob(shadow,cell,reach,true)!==null);
    if(!placements||shadow.piles.length+placements.length>32768||!Number.isSafeInteger(world.nextId+plans.reduce((n,p)=>n+p.placements.length,0)+placements.length))return {ok:false,code:'occupied',reason:'Aucune place pour conserver tous les matériaux récupérés.'};
    plans.push({item,placements});
    shadow.piles.push(...placements.map((p,i):MaterialPile=>({id:-(plans.length*1000+i+1),item,kind:item,quantity:p.quantity,owner:{type:'ground',...p.cell}})));
  }
  for(const pawn of world.pawns){
    if(pawn.cooking?.ingredients.some(i=>i.pileId===piece.id)||pawn.haul?.sourcePileId===piece.id)releaseAssignments(world,pawn);
    pawn.orders.queue=pawn.orders.queue.filter(o=>typeof o==='number'||(isCookingOrder(o)?!o.cooking.ingredients.some(i=>i.pileId===piece.id):o.sourcePileId!==piece.id));
  }
  world.piles=world.piles.filter(p=>p!==piece);
  for(const {item,placements} of plans)for(const placement of placements)addMaterial(world,item,placement.quantity,{type:'ground',...placement.cell},item);
  world.rng=random.rng;return {ok:true};
}

export function detachMissingComponentBills(world:World):void {
  if(!world.piles.some(p=>p.componentWork?.billId))return;
  const bills=new Set([...world.structures,...world.packed.map(p=>p.building)].flatMap(s=>s.bills?.map(b=>b.id)??[]));
  for(const pile of world.piles)if(pile.componentWork?.billId&&!bills.has(pile.componentWork.billId))delete pile.componentWork.billId;
}

export function validComponentWorkShape(p:Record<string,unknown>,version:number):boolean {
  if(p.item!=='unfinished-component')return p.componentWork===undefined;
  const work=p.componentWork,owner=p.owner;
  if(version<123||p.kind!=='unfinished'||p.quantity!==1||!record(owner)||!['ground','pawn'].includes(String(owner.type))||!record(work))return false;
  if(!isComponentRecipe(work.recipe)||work.recipe==='make-advanced-component'&&version<139||Object.keys(work).some(k=>!['recipe','authorId','progress','parts','billId'].includes(k))
    ||!integer(work.authorId,1)||!integer(work.progress,0,productionWorkTotal(work.recipe))||work.billId!==undefined&&!integer(work.billId,1)||!Array.isArray(work.parts))return false;
  if(work.recipe==='make-component')return work.parts.length>=1&&work.parts.length<=12&&work.parts.every(n=>integer(n,1,12))&&work.parts.reduce((sum:number,n:number)=>sum+n,0)===12;
  if(work.parts.length<4||work.parts.length>34)return false;
  for(const part of work.parts){
    if(!record(part)||Object.keys(part).some(k=>!['item','quantity'].includes(k))||!['component','steel','plasteel','gold'].includes(String(part.item))||!integer(part.quantity,1,ADVANCED_COMPONENT_REQUIREMENTS[part.item as AdvancedComponentMaterial]))return false;
  }
  return validAdvancedComponentIngredients('make-advanced-component',work.parts as {item:string;quantity:number}[]);
}

export function validateComponentWorks(world:World,version:number):string[] {
  const errors:string[]=[],bound=new Set<number>();
  for(const pile of world.piles){
    if(pile.item!=='unfinished-component'&&pile.componentWork===undefined)continue;
    if(!validComponentWorkShape(pile as unknown as Record<string,unknown>,version)){errors.push('Invalid unfinished component.');continue;}
    const work=pile.componentWork!;
    if(!world.pawns.some(p=>p.id===work.authorId))errors.push('Missing unfinished component author.');
    if(work.billId!==undefined){
      if(bound.has(work.billId)||![...world.structures,...world.packed.map(p=>p.building)].some(s=>s.bills?.some(b=>b.id===work.billId&&b.recipe===work.recipe)))errors.push('Invalid unfinished component bound bill.');
      bound.add(work.billId);
    }
  }
  return errors;
}
