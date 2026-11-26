import {isColonist} from '../sim/affiliation';
import {colonyPile} from '../sim/materials';
import {ITEM_DEFINITIONS,type ItemId} from '../sim/items';
import type {MaterialPile,Pawn,World} from '../sim/types';
import {knownBuilding256,knownPile256,type KnownPileLookup256} from './exploration-readers-256';

export interface HudResourceRecord379 {
 item:ItemId;stock:number;ground:number;carried:number;inventory:number;equipped:number;delivered:number;
}
export interface HudPortraitOwnership379 {
 readonly apparel:ReadonlyMap<number,MaterialPile[]>;
 readonly weapons:ReadonlyMap<number,string>;
}
const firstIdentity=<T extends {id:number}>(values:readonly T[]):Map<number,T>=>{
 const result=new Map<number,T>();for(const value of values)if(!result.has(value.id))result.set(value.id,value);return result;
};

/** A synchronous read of one adopted map. Keep the first identity exactly as
 * Array.find does, including unusual duplicate witnesses, but build each
 * directory only if one of the actual readers needs that owner family.
 * No directory or borrowed World is cached across independent HUD readings. */
export function hudKnowledgeLookup379(world:World):KnownPileLookup256 {
 let people:Map<number,Pawn>|undefined,animals:Map<number,NonNullable<World['wildlife']>['animals'][number]>|undefined;
 let jobs:Map<number,World['jobs'][number]>|undefined,structures:Map<number,World['structures'][number]>|undefined;
 return {person:id=>(people??=firstIdentity(world.pawns)).get(id),animal:id=>(animals??=firstIdentity(world.wildlife?.animals??[])).get(id),job:id=>(jobs??=firstIdentity(world.jobs)).get(id),structure:id=>(structures??=firstIdentity(world.structures)).get(id)};
}

/** The HUD previously made separate stock, physical nutrition, owner details
 * and portrait-apparel scans. Read their distinct predicates on the single
 * original pile order: floating-point additions keep their original order and
 * inclusion; nutrition still differs from stored food and from known stock. */
export function captureHudMapRead379(world:World,shown:readonly Pawn[]) {
 const lookup=hudKnowledgeLookup379(world),known=(pile:MaterialPile)=>knownPile256(world,pile,lookup);
 const counts=new Map<ItemId,number>(),records=new Map<ItemId,HudResourceRecord379>();
 const owned=new Set<number>();for(const pawn of world.pawns)if(isColonist(pawn))owned.add(pawn.id);
 const onBar=new Set(shown.map(pawn=>pawn.id)),apparel=new Map<number,MaterialPile[]>(),weapons=new Map<number,string>();
 let physicalNutrition=0;
 for(const pile of world.piles){
  const owner=pile.owner;
  // The portrait reader deliberately knows the actual apparel/equipment of its
  // colonists regardless of their position in the explored cells.
  if(owner.type==='apparel'&&onBar.has(owner.pawnId)){let list=apparel.get(owner.pawnId);if(!list){list=[];apparel.set(owner.pawnId,list);}list.push(pile);}
  else if(owner.type==='equipment'&&onBar.has(owner.pawnId))weapons.set(owner.pawnId,pile.item);
  if(!known(pile))continue;
  const stock=owner.type==='ground'||(owner.type==='pawn'||owner.type==='equipment'||owner.type==='apparel')&&owned.has(owner.pawnId)||owner.type==='inventory'&&colonyPile(world,pile);
  // KnownStockCounts includes all quantities, even a historical zero witness.
  if(stock)counts.set(pile.item,(counts.get(pile.item)??0)+pile.quantity);
  if(pile.item!=='hay'&&owner.type!=='job'&&owner.type!=='inventory'&&(owner.type!=='pawn'||owned.has(owner.pawnId)))physicalNutrition+=ITEM_DEFINITIONS[pile.item].nutrition*pile.quantity;
  if(pile.quantity<=0)continue;
  if(owner.type!=='ground'&&owner.type!=='job'&&(!('pawnId' in owner)||!owned.has(owner.pawnId)&&!stock))continue;
  let record=records.get(pile.item);if(!record){record={item:pile.item,stock:0,ground:0,carried:0,inventory:0,equipped:0,delivered:0};records.set(pile.item,record);}
  if(owner.type==='ground')record.ground+=pile.quantity;
  else if(owner.type==='job')record.delivered+=pile.quantity;
  else if(owner.type==='pawn')record.carried+=pile.quantity;
  else if(owner.type==='inventory')record.inventory+=pile.quantity;
  else if(owner.type==='equipment'||owner.type==='apparel')record.equipped+=pile.quantity;
 }
 for(const record of records.values())record.stock=counts.get(record.item)??0;
 const resources=[...records.values()].sort((a,b)=>ITEM_DEFINITIONS[a.item].label.localeCompare(ITEM_DEFINITIONS[b.item].label,'fr'));
 return {resources,physicalNutrition:physicalNutrition/100,visibility:{pileVisible:known,structureVisible:(s:World['structures'][number])=>knownBuilding256(world,s)},portraitOwnership:{apparel,weapons} as HudPortraitOwnership379,structure:lookup.structure};
}
