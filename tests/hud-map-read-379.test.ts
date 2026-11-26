import {expect,it,vi} from 'vitest';
import {captureHudMapRead379,type HudResourceRecord379} from '../src/ui/hud-map-read-379';
import {knownBuilding256,knownNutrition256,knownPile256,knownStockCounts256} from '../src/ui/exploration-readers-256';
import {captureFoodReadability} from '../src/sim/food-readability';
import {isColonist} from '../src/sim/affiliation';
import {colonyPile} from '../src/sim/materials';
import {ITEM_DEFINITIONS,type ItemId} from '../src/sim/items';
import type {MaterialPile,World} from '../src/sim/types';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459';

function literal(world:World){
 const counts=knownStockCounts256(world),records=new Map<ItemId,HudResourceRecord379>(),owned=new Set(world.pawns.filter(isColonist).map(p=>p.id));
 for(const pile of world.piles){
  if(pile.quantity<=0||!knownPile256(world,pile))continue;
  const owner=pile.owner;
  if(owner.type!=='ground'&&owner.type!=='job'&&(!('pawnId' in owner)||!owned.has(owner.pawnId)&&!colonyPile(world,pile)))continue;
  const entry=records.get(pile.item)??{item:pile.item,stock:counts.get(pile.item)??0,ground:0,carried:0,inventory:0,equipped:0,delivered:0};
  if(owner.type==='ground')entry.ground+=pile.quantity;
  else if(owner.type==='job')entry.delivered+=pile.quantity;
  else if(owner.type==='pawn')entry.carried+=pile.quantity;
  else if(owner.type==='inventory')entry.inventory+=pile.quantity;
  else if(owner.type==='equipment'||owner.type==='apparel')entry.equipped+=pile.quantity;
  records.set(pile.item,entry);
 }
 return [...records.values()].sort((a,b)=>ITEM_DEFINITIONS[a.item].label.localeCompare(ITEM_DEFINITIONS[b.item].label,'fr'));
}

it('one adopted HUD pile pass preserves independent stock, owner, food and portrait predicates, including same-object mutations',()=>{
 const f=animalHaulingCamp459(),w=f.world,p=f.handler,a=f.animal;
 w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};w.exploration={revision:1};
 for(const tile of w.tiles)tile.fogged=true;
 const owner=(kind:MaterialPile['kind'],item:ItemId,quantity:number,owner:MaterialPile['owner'])=>{const pile={id:w.nextId++,kind,item,quantity,owner};w.piles.push(pile);return pile;};
 const ground=owner('wood','wood',9,{type:'ground',x:8,z:8});delete w.tiles[8+8*w.width]!.fogged;
 owner('wood','wood',0,{type:'ground',x:8,z:8});owner('wood','wood',-2,{type:'ground',x:8,z:8});
 owner('food','berries',3,{type:'pawn',pawnId:p.id});owner('food','hay',17,{type:'pawn',pawnId:p.id});
 owner('food','kibble',7,{type:'inventory',pawnId:p.id});
 owner('food','berries',11,{type:'job',jobId:999991});
 owner('food','berries',13,{type:'grave',graveId:f.bedId});
 owner('food','survival-meal',2,{type:'orbital-ship',shipId:99});
 const animalPile=owner('wood','wood',5,{type:'inventory',pawnId:a.id});
 a.haul={phase:'holding',carryPileId:animalPile.id,sinceCore:w.tick*10};
 const outfit=owner('apparel','cloth-parka',1,{type:'apparel',pawnId:p.id});
 const weapon=owner('weapon','short-bow',1,{type:'equipment',pawnId:p.id});
 const before=JSON.stringify(w);
 const verify=()=>{
  const expectRows=literal(w),expectNutrition=knownNutrition256(w),visibility=w.piles.map(pile=>knownPile256(w,pile));
  const reading=captureHudMapRead379(w,[p]);
  expect(reading.resources).toEqual(expectRows);expect(reading.physicalNutrition).toBe(expectNutrition);
  expect(w.piles.map(reading.visibility.pileVisible)).toEqual(visibility);
  expect(captureFoodReadability(w,reading.visibility)).toEqual(captureFoodReadability(w,{pileVisible:pile=>knownPile256(w,pile),structureVisible:s=>knownBuilding256(w,s)}));
  expect(reading.portraitOwnership.apparel.get(p.id)).toContain(outfit);expect(reading.portraitOwnership.weapons.get(p.id)).toBe(weapon.item);
  return reading;
 };
 verify();expect(JSON.stringify(w)).toBe(before);
 // The owner/knowledge projection is not a cache across separate readings.
 ground.quantity=17;delete a.domestic;delete a.haul;delete w.tiles[8+8*w.width]!.fogged;
 w.tiles[8+8*w.width]!.fogged=true;verify();
 delete w.exploration;verify();
});

it('owner lookups never repeatedly scan the people, job or structure arrays within a read',()=>{
 const f=animalHaulingCamp459(),w=f.world,p=f.handler;
 w.site={revision:3} as World['site'];w.exploration={revision:1};
 for(let i=0;i<80;i++)w.piles.push({id:w.nextId++,kind:'food',item:'berries',quantity:1,owner:{type:'pawn',pawnId:p.id}});
 const people=vi.spyOn(w.pawns,'find'),jobs=vi.spyOn(w.jobs,'find'),structures=vi.spyOn(w.structures,'find');
 try{const read=captureHudMapRead379(w,[p]);read.structure(f.bedId);expect(people).not.toHaveBeenCalled();expect(jobs).not.toHaveBeenCalled();expect(structures).not.toHaveBeenCalled();}
 finally{people.mockRestore();jobs.mockRestore();structures.mockRestore();}
});
