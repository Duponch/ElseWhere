import {isSchema284OrLater} from './schema-compatibility-257.ts';
import {isFlakPantsSchema375} from './flak-pants-375.ts';
import {TRADE_REQUEST_CONTENT_284,tradeRequestFamilyForItem284,type TradeRequestFamily284} from './trade-request-content-284.ts';
import {registeredMapForValidation,registeredMapId,hasLoadedRoot} from './world-map-context.ts';
import {planetTile,planetTiles} from './planet-geography-256.ts';
import {geographicAverageTileSize256} from './planet-route-256.ts';
import {worldSurfaceApproxDistance,worldSurfaceAverageTileSize} from './world-surface-distances.ts';
import {stationAccepts} from './production-recipes.ts';
import {constructionRecipe} from './construction-materials.ts';
import {workPriority} from './work-types.ts';
import {isColonist} from './affiliation.ts';
import {actualPlayerOwner259} from './world-affiliation-259.ts';
import {PLANT_DEFINITIONS,createPlantGrowthReader,plantTemperatureFactorFor} from './plants.ts';
import {FLORA_DEFINITIONS} from './biome-flora.ts';
import {hydroponicFertility} from './hydroponics.ts';
import {terrainGroundFertility256} from './natural-terrain-runtime-256.ts';
import {TemperatureView} from './temperature.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {actualAnimalProfile256} from './actual-animal-profile-256.ts';
import {bodySizeAtAge} from './animal-life.ts';
import {corpseProducts} from './corpses.ts';
import {captureDuckFlyerOwners256} from './duck-owner-capture-256.ts';
import {SMELTING_WEAPONS,SMELTING_APPAREL_INPUTS267,smeltingProduct} from './smelting-content.ts';
import {isSmithingApparel267,smithingApparelUnits267} from './smithing-apparel-267.ts';
import {isMaceItem269,maceMaterial269,maceUnits269} from './mace-content-269.ts';
import {isLongswordItem270,longswordMaterial270,longswordUnits270} from './longsword-content-270.ts';
import {isSpearItem272,spearMaterial272,spearUnits272} from './spear-content-272.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {CampaignState} from './world-map-state.ts';
import type {ItemId} from './items.ts';
import type {MaterialPile,Pawn,Resource,Structure,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

export interface TradeRequestAvailability284 {
 readonly actual:number;
 /** TOTAL actual + independent estimates, matching PossiblyAccessible. */
 readonly potential:number;
 readonly makeable:boolean;
}
const roundEven284=(n:number):number=>{const lo=Math.floor(n),fraction=n-lo;return fraction===.5?lo+lo%2:Math.round(n);};
const freeCraft=(root:CampaignState,p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&!p.raid&&!p.podRescue
 &&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&workPriority(p,'craft')>0
 &&(!root.worldFactions||actualPlayerOwner259(p,root.worldFactions.playerFactionId));

/** Ephemeral, pure offer estimate over ORIGINAL owners. No RAW hydration,
 * generation, producer calls, RNG, identity allocation, clocks or commands.
 * Primary branches are independent, not a recipe-chain/route solver.
 * Local adaptations: merged Crafting métier; admitted local recipe/material
 * bindings; existing local plant-growth/temperature and recovery definitions;
 * cropYieldFactor1 (the only admitted current difficulty); leather round-even
 * instead of native stochastic rounding. No mining/shearing/fermentation. */
export function captureTradeRequestAvailability284(root:CampaignState,home:World):ReadonlyMap<TradeRequestFamily284,TradeRequestAvailability284> {
 const totals=new Map<TradeRequestFamily284,{actual:number;potential:number;makeable:boolean}>(
  TRADE_REQUEST_CONTENT_284.map(e=>[e.family,{actual:0,potential:0,makeable:false}]));
 if(!isSchema284OrLater(root.schemaVersion))return totals;
 const add=(item:ItemId,quantity:number,actual=false)=>{
  if(!(quantity>0))return;const family=tradeRequestFamilyForItem284(item);if(!family)return;
  if(!Number.isSafeInteger(quantity))throw Error('Invalid trade request availability quantity');
  const row=totals.get(family)!;if(!Number.isSafeInteger(row.potential+quantity)||actual&&!Number.isSafeInteger(row.actual+quantity))throw Error('Trade request availability overflow');
  row.potential+=quantity;if(actual)row.actual+=quantity;else row.makeable=true;
 };
 const homeId=registeredMapId(home),homeRecord=root.worldMaps?.sites.find(s=>s.id===homeId),homeTile=homeRecord?.tile??(home.site?.revision===3?home.site.tileId:home.planet?.homeTile);
 const planet=root.planet;let average:number|undefined;
 const nearby=(tile:number|null|undefined):boolean=>{
  if(tile==null||homeTile==null||!planet)return false;
  if(tile===homeTile)return true;
  const a=planetTile(planet,homeTile),b=planetTile(planet,tile);if(!a||!b)return false;
  average??=planet.revision===3?geographicAverageTileSize256(planet):worldSurfaceAverageTileSize(planetTiles(planet));
  return worldSurfaceApproxDistance(a.center,b.center,average)<=5;
 };
 const maps:World[]=[];
 if(root.worldMaps){for(const r of root.worldMaps.sites){if(r.id!==homeId&&!nearby(r.tile))continue;
   const map=r.id===homeId?home:registeredMapForValidation(root,r.id);if(map)maps.push(map);
  }}else if(hasLoadedRoot(root))maps.push(root===home?root:home);
 const seenPiles=new Set<number>(),seenBuildings=new Set<number>(),seenHumans=new Set<number>(),seenAnimals=new Set<number>();
 const stations:{map:World;building:Structure}[]=[];let crafters=0;
 const human=(p:Pawn)=>{if(seenHumans.has(p.id))return;seenHumans.add(p.id);if(freeCraft(root,p))crafters++;};
 const animal=(a:WildAnimal)=>{
  if(seenAnimals.has(a.id))return;seenAnimals.add(a.id);
  const def=actualAnimalProfile256(a);if(!def.leatherItem)return;
  // Pure local body-size projection; no kill, butchery skill, station, output
  // roll or future shearing/egg/milk yield is supplied by this estimate.
  const raw=def.rawLeather*bodySizeAtAge(a.species,a.ageTicks,a.growthTracker?.value)/def.bodySize;
  const curved=raw<=5?raw*14/5:raw<=40?14+(raw-5)*26/35:raw;
  add(def.leatherItem,roundEven284(curved));
 };
 // The payload is the actual record; its owner remains untouched. Ancient
 // holders have their own owner union and need no fake ground/inventory view.
 const pile=(p:Pick<MaterialPile,'id'|'item'|'quantity'|'corpse'>)=>{
  if(seenPiles.has(p.id))return;seenPiles.add(p.id);add(p.item,p.quantity,true);
  if(p.corpse&&!seenAnimals.has(p.corpse.animalId)){
   seenAnimals.add(p.corpse.animalId);const products=corpseProducts(p);if(products?.leather.item)add(products.leather.item,roundEven284(products.leather.quantity));
  }
  if(!(SMELTING_WEAPONS as readonly string[]).includes(p.item)&&!(SMELTING_APPAREL_INPUTS267 as readonly string[]).includes(p.item))return;
  const item=p.item;
  let units:number;
  if(isSmithingApparel267(item))units=smithingApparelUnits267(item);
  else if(isSpearItem272(item))units=spearUnits272(spearMaterial272(item));
  else if(isLongswordItem270(item))units=longswordUnits270(longswordMaterial270(item));
  else if(isMaceItem269(item))units=maceUnits269(maceMaterial269(item));
  else units=item==='plasteel-knife'?30:item==='bolt-action-rifle'?60:item==='emp-launcher'?75:30;
  add(smeltingProduct(p.item as Parameters<typeof smeltingProduct>[0]),roundEven284(units*.25)*p.quantity);
 };
 const packed=(packs:readonly PackedFurniture[])=>{for(const p of packs)building(p.building);};
 const building=(s:Structure,map?:World)=>{
  if(seenBuildings.has(s.id))return;seenBuildings.add(s.id);
  if(map)stations.push({map,building:s});
  // The represented recovery contract uses half-cost (zero for these spent
  // structures); no stochastic deconstruction producer is invoked here.
  if(!['campfire','passive-cooler','torch-lamp','power-conduit','hidden-conduit','ship-chunk','glow-pod','sleeping-spot','double-sleeping-spot','animal-sleeping-spot'].includes(s.kind)){
   for(const cost of constructionRecipe(s).ingredients)add(cost.item,roundEven284(cost.quantity*.5));
  }
  if(s.casket){for(const p of s.casket.humans)human(p);for(const a of s.casket.animals)animal(a);for(const p of s.casket.items)pile(p);}
  if(s.cryptosleep){if(s.cryptosleep.human)human(s.cryptosleep.human);for(const p of s.cryptosleep.items)pile(p);packed(s.cryptosleep.packed);}
  if(s.shipCryptosleep277){const o=s.shipCryptosleep277.occupant;if(o?.kind==='human')human(o.pawn);else if(o?.kind==='animal')animal(o.animal);
   for(const p of s.shipCryptosleep277.items)pile(p);packed(s.shipCryptosleep277.packed);
  }
 };
 for(const map of maps){
  for(const p of map.pawns)human(p);for(const a of map.wildlife?.animals??[])animal(a);for(const holder of captureDuckFlyerOwners256(map))animal(holder.animal);
  for(const p of map.piles)pile(p);for(const s of map.structures)building(s,map);packed(map.packed);
  if(map.startingArrival&&map.startingArrival.phase!=='opened')for(const pod of map.startingArrival.pods){human(pod.pawn);if('animals'in pod)for(const a of pod.animals)animal(a);for(const p of pod.items)pile(p);}
  const growth=createPlantGrowthReader(map),air=new TemperatureView(map);
  for(const plant of map.resources)if(plant.species||['cotton','healroot','haygrass','hops'].includes(plant.kind))harvestEstimate(map,plant,growth(plant),air,add);
 }
 const seenGroups=new Set<number>();
 const group=(g:NonNullable<World['group']>)=>{
  if(!('members'in g)||seenGroups.has(g.id)||!nearby(g.tile))return;seenGroups.add(g.id);
  for(const p of g.members)human(p);for(const a of g.animalOwners?.members??[])animal(a);for(const p of g.items)pile(p);packed(g.packed??[]);
 };
 for(const r of root.worldGroups?.groups??[])group(r.state);
 if(hasLoadedRoot(root)&&root.group)group(root.group);
 // Actual near-map tables, deduplicated by ThingDef-equivalent kind BEFORE
 // recipe/ingredient checks, as native first-instance traversal does.
 const tableKinds=new Set<Structure['kind']>();
 if(crafters>0)for(const {map,building:s} of stations){
  if(tableKinds.has(s.kind))continue;tableKinds.add(s.kind);
  const present=new Set(map.piles.filter(p=>p.owner.type==='ground'&&!foggedCell256(map,p.owner.z*map.width+p.owner.x)).map(p=>p.item));
  for(const e of TRADE_REQUEST_CONTENT_284)for(const r of e.recipes){
   // The flak pants recipe exists from schema 375: older maps never count it.
   if(r.recipe==='make-flak-pants'&&!isFlakPantsSchema375(Number(map.schemaVersion)))continue;
   if(!stationAccepts(s,r.recipe)||!r.research.every(key=>key==='completedAt'?map.research?.completedAt!==undefined:map.research?.[key]?.completedAt!==undefined)
    ||!r.ingredientGroups.every(g=>g.some(item=>present.has(item))))continue;
   const quantity=Math.floor(crafters*27000/r.workCore)*r.outputUnits;
   // Add directly to the family: material is not fabricated or selected.
   if(quantity>0){const row=totals.get(e.family)!;if(!Number.isSafeInteger(row.potential+quantity))throw Error('Trade request production overflow');row.potential+=quantity;row.makeable=true;}
  }
 }
 return new Map([...totals].map(([family,row])=>[family,Object.freeze({...row})]));
}

function harvestEstimate(map:World,p:Resource,growth:number,air:TemperatureView,add:(item:ItemId,count:number)=>void):void {
 const wild=p.species?FLORA_DEFINITIONS[p.species]:undefined;
 const crop=Object.hasOwn(PLANT_DEFINITIONS,p.kind)?PLANT_DEFINITIONS[p.kind as keyof typeof PLANT_DEFINITIONS]:undefined;
 const product=wild?.product??(p.kind==='cotton'?'cloth':p.kind==='healroot'?'herbal-medicine':p.kind==='haygrass'?'hay':p.kind==='hops'?'hops':null);
 if(!product||!tradeRequestFamilyForItem284(product)||!crop&&!wild)return;
 const def=wild??crop!,minimum=wild?.harvestMinGrowth??.65;
 // Local healroot's duration is retained; this is a declared environmental
 // adaptation, not a rewrite of the colony's established growth contract.
 const now=growth>minimum,soon=(Math.max(1-growth,0)*def.growDays<=10||Math.max(1-minimum,0)*def.growDays<=1)
  &&(hydroponicFertility(map,p)??terrainGroundFertility256(map.tiles[p.z*map.width+p.x]!))>0
  &&plantTemperatureFactorFor(p,air.at(map,p))>0;
 if(now||soon)add(product,roundEven284(def.yield));
}
