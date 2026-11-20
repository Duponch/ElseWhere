import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {generateNovelBook295} from './book-state-295.ts';
import { ITEM_DEFINITIONS,type ItemId } from './items.ts';
import { freshRot } from './food-preservation.ts';
import { tradeCatalogueEntry } from './trade-catalogue.ts';
import { APPAREL,type ApparelItem } from './apparel-definitions.ts';
import { orbitalClothing338,orbitalTechHediff338 } from './orbital-trade-338.ts';
import type { OrbitalKind,OrbitalShip,OrbitalState } from './orbital-state.ts';
import type { MaterialPile,World } from './types.ts';

export const ORBITAL_STOCK:Readonly<Record<OrbitalKind,readonly (readonly [ItemId,number,number])[]>>={
  bulk:[['silver',2000,4000],['component',15,30],['advanced-component',1,2],['steel',500,800],['wood',500,800],['plasteel',100,400],['cloth',200,600],['medicine',20,30],['gold',50,200],['neutroamine',100,200]],
  exotic:[['silver',2000,4000],['component',5,30],['advanced-component',3,8],['plasteel',100,400],['gold',200,400],['neutroamine',100,500],['glitterworld-medicine',5,30]],
};
export function orbitalRandom(state:Pick<OrbitalState,'rng'>):number {let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;return state.rng/0x100000000;}
/** Core BulkGoods Beer uses a total-price range, including no-stock draws.
 * The product keeps its existing independent orbital random stream. */
export function orbitalBeerCount265(random:number):number {
  const value=Math.fround(Math.fround(-70+Math.fround(270*Math.fround(random)))/12);
  const lo=Math.floor(value),fraction=value-lo;
  return Math.max(0,fraction>.5||fraction===.5&&lo%2!==0?lo+1:lo);
}
export const orbitalBeerCatalogue265=(version:number,kind:OrbitalKind,item:ItemId):boolean=>version>=265&&kind==='bulk'&&item==='beer';
export const orbitalNovelCatalogue295=(version:number,kind:OrbitalKind,item:ItemId):boolean=>(version===295||(version===296||isCorePhysicalSchema297(version)))&&(kind==='bulk'||kind==='exotic')&&item==='novel';
/** Direct supported Core stock only. Every draw and physical identity is once. */
export function orbitalStock(w:World,ship:OrbitalShip,state:Pick<OrbitalState,'rng'>):MaterialPile[] {
  const result:MaterialPile[]=[];
  for(const [item,min,max] of ORBITAL_STOCK[ship.kind]){
    let quantity=min+Math.floor(orbitalRandom(state)*(max-min+1));
    while(quantity){const n=Math.min(quantity,ITEM_DEFINITIONS[item].stackLimit);result.push({id:w.nextId++,item,kind:ITEM_DEFINITIONS[item].kind,quantity:n,owner:{type:'orbital-ship',shipId:ship.id},...freshRot(item,w.tick)});quantity-=n;}
  }
  // Schema 338: Core Orbital_BulkGoods Chemfuel 200~600, right after Neutroamine.
  if(w.schemaVersion>=338&&ship.kind==='bulk'){
    let quantity=200+Math.floor(orbitalRandom(state)*401);
    while(quantity){const n=Math.min(quantity,ITEM_DEFINITIONS.chemfuel.stackLimit);result.push({id:w.nextId++,item:'chemfuel',kind:ITEM_DEFINITIONS.chemfuel.kind,quantity:n,owner:{type:'orbital-ship',shipId:ship.id},...freshRot('chemfuel',w.tick)});quantity-=n;}
  }
  if(w.schemaVersion>=265&&ship.kind==='bulk'){
    let quantity=orbitalBeerCount265(orbitalRandom(state));
    while(quantity>0){const n=Math.min(quantity,ITEM_DEFINITIONS.beer.stackLimit);result.push({id:w.nextId++,item:'beer',kind:'beer',quantity:n,owner:{type:'orbital-ship',shipId:ship.id}});quantity-=n;}
  }
  // New stock only, after every historical draw and identity. Existing ships
  // are never backfilled by loading, quoting or inspecting their old stock.
  if(orbitalNovelCatalogue295(w.schemaVersion,ship.kind,'novel')){
    // createOrbitalShip rejects an overflowing draft without committing its
    // identities or RNG. Keep that ordinary refusal rather than throw late.
    const id=w.nextId++;if(!Number.isSafeInteger(id)||!Number.isSafeInteger(w.nextId))return result;
    const book=generateNovelBook295(id,()=>orbitalRandom(state));
    result.push({id,item:'novel',kind:'book',quantity:1,owner:{type:'orbital-ship',shipId:ship.id},book});
  }
  // Schema 338, after the novel as in Core: bulk BasicClothing/Clothing
  // garments, exotic TechHediff parts (unrepresented defs keep their weight).
  if(w.schemaVersion>=338){
    for(const {item,quality} of ship.kind==='bulk'?orbitalClothing338(state,w.schemaVersion):[])
      result.push({id:w.nextId++,item,kind:'apparel',quantity:1,owner:{type:'orbital-ship',shipId:ship.id},apparel:{quality,hitPoints:tradeCatalogueEntry(item)!.maxHitPoints,material:APPAREL[item as ApparelItem].material,corpseWear284:false}});
    for(const item of ship.kind==='exotic'?orbitalTechHediff338(state):[])
      result.push({id:w.nextId++,item,kind:ITEM_DEFINITIONS[item].kind,quantity:1,owner:{type:'orbital-ship',shipId:ship.id}});
  }
  return result;
}
