import { allowedAreaServicesAllowed } from './allowed-area-services.ts';
import { allowedAreaAllows } from './allowed-area-state.ts';
import { footprintCells } from './definitions.ts';
import { groundCapacity,groundPile } from './ground-placement.ts';
import { isAnimalMeat } from './biome-items.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { allowedFood,type FoodItemId } from './food-policy.ts';
import { selfAllowedFood } from './prison-food.ts';
import { capturePrisonTopology,prisonRoom,prisonerAllowedCell } from './prison-space.ts';
import type { RoomTopology } from './room-topology.ts';
import { isPowerActive } from './power-rules.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { reservedSource,refreshStock } from './materials.ts';
import { freshRot } from './food-preservation.ts';
import { interruptWork } from './interrupted-cargo.ts';
import type { Cell,MaterialPile,Pawn,Structure,World } from './types.ts';
import { structureById } from './structure-navigation.ts';

export interface PasteRequest {
  dispenserId:number;
  spot:Cell;
  ingredients?:{pileId:number;quantity:number}[];
  producedAt?:number;
}
export const PASTE_INGREDIENT_UNITS=6,PASTE_COLLECT_TICKS=5;
const directions=[[0,1],[1,0],[0,-1],[-1,0]] as const;
export function pasteSpot(dispenser:Structure):Cell {
  const d=directions[dispenser.orientation??0]!;
  return {x:dispenser.x+3*d[0],z:dispenser.z+3*d[1]};
}
/** A hopper touches any cardinal footprint edge. Rotation and diagonal
 * proximity do not create a second stock owner or a connection. */
export function pasteHoppers(world:World,dispenser:Structure):Structure[] {
  if(dispenser.kind!=='nutrient-paste-dispenser')return [];
  const cells=footprintCells(dispenser);
  return world.structures.filter(s=>s.kind==='hopper'&&!cells.some(c=>c.x===s.x&&c.z===s.z)&&cells.some(c=>Math.abs(c.x-s.x)+Math.abs(c.z-s.z)===1))
    .sort((a,b)=>a.id-b.id);
}
export function hopperAccepts(item:string):boolean {
  return item==='raw-fungus'||item==='rice'||item==='potato'||item==='corn'||item==='berries'||item==='agave-fruit'||item==='milk'||isAnimalMeat(item);
}
export function hopperCapacity(world:World,hopperId:number,item:ItemId,exceptPawn?:number):number {
  const hopper=world.structures.find(s=>s.id===hopperId&&s.kind==='hopper');
  return world.schemaVersion>=217&&hopper&&hopperAccepts(item)?groundCapacity(world,hopper,item,exceptPawn):0;
}
export function hopperFillWanted(world:World,hopperId:number):boolean {
  const hopper=world.structures.find(s=>s.id===hopperId&&s.kind==='hopper');if(!hopper||world.schemaVersion<217)return false;
  if(!world.structures.some(s=>s.kind==='nutrient-paste-dispenser'&&pasteHoppers(world,s).some(h=>h.id===hopper.id)))return false;
  const pile=groundPile(world,hopper);
  return !pile||hopperAccepts(pile.item)&&pile.quantity/ITEM_DEFINITIONS[pile.item].stackLimit<=.35;
}
function hopperFood(world:World,dispenser:Structure):MaterialPile[] {
  return pasteHoppers(world,dispenser).flatMap(h=>{
    const p=groundPile(world,h);return p&&p.kind==='food'&&hopperAccepts(p.item)?[p]:[];
  });
}
export function pasteAvailableUnits(world:World,dispenser:Structure,exceptPawn?:number):number {
  return hopperFood(world,dispenser).reduce((sum,p)=>sum+Math.max(0,p.quantity-reservedSource(world,p.id,exceptPawn)),0);
}
function pasteAccessible(world:World,getter:Pawn,eater:Pawn,dispenser:Structure,spot:Cell,topology?:RoomTopology):boolean {
  if(!topology&&(getter.prisoner||eater.prisoner||world.structures.some(s=>s.prisoner)))topology=capturePrisonTopology(world);
  if(getter.prisoner&&!prisonerAllowedCell(world,getter,spot,topology))return false;
  // Match ordinary food's prison ownership without fabricating a material pile.
  if(!world.structures.some(s=>s.prisoner))return true;
  const room=prisonRoom(world,dispenser,topology);
  if(!room)return true;
  return !!getter.prisoner&&room===prisonRoom(world,getter,topology)
    ||eater!==getter&&!!eater.prisoner&&room===prisonRoom(world,eater,topology);
}
export function pasteDispenserUsable(world:World,pawn:Pawn,dispenser:Structure,eater:Pawn=pawn,topology?:RoomTopology):boolean {
  if(world.schemaVersion<217||dispenser.kind!=='nutrient-paste-dispenser'||!world.structures.includes(dispenser)||medicalWorkRefusal(pawn)
    ||pawn.burning||pawn.flee||pawn.interruptedCargo||!isPowerActive(dispenser))return false;
  const allowed=eater===pawn?selfAllowedFood(world,pawn):allowedFood(world,eater);
  if(!allowed.includes('nutrient-paste-meal' as FoodItemId))return false;
  if(world.jobs.some(j=>(j.kind==='deconstruct'||j.kind==='uninstall')&&(j.deconstruction?.structureId??j.furniture?.structureId)===dispenser.id))return false;
  const cells=footprintCells(dispenser);
  if(world.fires?.items.some(f=>cells.some(c=>c.x===f.x&&c.z===f.z)))return false;
  const spot=pasteSpot(dispenser);
  return canStandAt(world,spot)&&!reservedServiceCells(world,pawn.id).has(spot.z*world.width+spot.x)
    &&pasteAccessible(world,pawn,eater,dispenser,spot,topology);
}
export function planPasteRequest(world:World,pawn:Pawn,dispenser:Structure,eater:Pawn=pawn,topology?:RoomTopology):PasteRequest|undefined {
  if(!allowedAreaAllows(world,pawn,dispenser)||!allowedAreaAllows(world,pawn,pasteSpot(dispenser)))return;
  if(!pasteDispenserUsable(world,pawn,dispenser,eater,topology))return;
  const ingredients:NonNullable<PasteRequest['ingredients']>=[];let remaining=PASTE_INGREDIENT_UNITS;
  for(const p of hopperFood(world,dispenser)){
    const quantity=Math.min(remaining,Math.max(0,p.quantity-reservedSource(world,p.id,pawn.id)));
    if(quantity){ingredients.push({pileId:p.id,quantity});remaining-=quantity;}
    if(!remaining)return {dispenserId:dispenser.id,spot:pasteSpot(dispenser),ingredients};
  }
}
/** Revalidate the exact reserved inputs. Another dispenser may share these
 * hoppers, but cannot consume this actor's promised six units. */
export function pasteRequestValid(world:World,pawn:Pawn,request:PasteRequest,eater:Pawn=pawn):boolean {
  if(request.producedAt!==undefined)return request.ingredients===undefined;
  const s=structureById(world,request.dispenserId),inputs=request.ingredients;
  if(!s||!inputs?.length||!pasteDispenserUsable(world,pawn,s,eater))return false;
  const spot=pasteSpot(s);if(spot.x!==request.spot.x||spot.z!==request.spot.z)return false;
  const sources=hopperFood(world,s),seen=new Set<number>();let total=0;
  for(const i of inputs){
    const p=sources.find(p=>p.id===i.pileId);
    if(!p||seen.has(i.pileId)||!Number.isSafeInteger(i.quantity)||i.quantity<=0||p.quantity-reservedSource(world,p.id,pawn.id)<i.quantity)return false;
    seen.add(i.pileId);total+=i.quantity;
  }
  return total===PASTE_INGREDIENT_UNITS;
}
/** Production occurs at arrival, before the five-tick pickup wait. All checks
 * precede withdrawal; afterwards the meal is ordinary conserved cargo. */
export function dispensePasteAtContact(world:World,pawn:Pawn,request:PasteRequest,eater:Pawn=pawn):MaterialPile|undefined {
  if(request.producedAt!==undefined||!pasteRequestValid(world,pawn,request,eater)||pawn.x!==request.spot.x||pawn.z!==request.spot.z
    ||pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick||(pawn.stun?.untilCore??0)>world.tick*10
    ||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)
    ||world.packed.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id)||!Number.isSafeInteger(world.nextId+1))return;
  const removed=request.ingredients!.filter(i=>world.piles.find(p=>p.id===i.pileId)!.quantity===i.quantity).length;
  if(world.piles.length-removed+1>32768)return;
  const pile:MaterialPile={id:world.nextId,kind:'food',item:'nutrient-paste-meal',quantity:1,owner:{type:'pawn',pawnId:pawn.id},...freshRot('nutrient-paste-meal',world.tick)};
  for(const i of request.ingredients!){const p=world.piles.find(p=>p.id===i.pileId)!;p.quantity-=i.quantity;}
  world.piles=world.piles.filter(p=>p.quantity>0);world.nextId++;world.piles.push(pile);
  delete request.ingredients;request.producedAt=world.tick;refreshStock(world);return pile;
}

/** Commands, destruction and perishables may invalidate a promise after its
 * actor has run. Only unproduced requests are cancelled at those boundaries. */
export function reconcilePasteRequests(world:World):void {
  if(world.schemaVersion<217)return;
  for(const p of world.pawns){
    const eat=p.need?.kind==='eat'&&p.need.phase==='pickup'?p.need.paste:undefined;
    const feed=p.feed?.phase==='pickup'?p.feed.paste:undefined;
    const patient=feed?world.pawns.find(patient=>patient.id===p.feed!.patientId):undefined;
    if((eat||feed)&&!allowedAreaServicesAllowed(world,p)||eat&&eat.producedAt===undefined&&!pasteRequestValid(world,p,eat)
      ||feed&&feed.producedAt===undefined&&(!patient||!pasteRequestValid(world,p,feed,patient)))interruptWork(world,p);
  }
}
