import {markPileWrite} from './pile-index.ts';
import {attachNewbornAnimalGrowth256} from './animal-growth-runtime-256.ts';
import {heldDuckAnimal256} from './duck-owner-capture-256.ts';
import {animalContentsLocation256} from './animal-local-contents-256.ts';
import {grazingPen} from './wildlife-food.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
import {ANIMAL_EGG_CONTENT_256,isEggSpecies256,eggSpeciesForItem256,type EggSpecies256} from './animal-egg-content-v256.ts';
import {evolveFertilizedEgg256,drawEggQuantity256} from './animal-egg-state-v256.ts';
import {animalLifeStageData256} from './animal-core-v256.ts';
import {animalGrowthFactor,animalNutritionMax} from './animal-life.ts';
import {animalNavigation} from './wildlife-navigation.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {MAX_WILDLIFE,wildlifeRandom,type WildAnimal} from './wildlife-state.ts';
import {addMaterial,materialCanFit,pileCell,refreshStock} from './materials.ts';
import {freshRot} from './food-preservation.ts';
import {TemperatureView} from './temperature.ts';
import type {ThermalLayout} from './thermal-topology.ts';
import {pawnContentsLocation} from './human-corpses.ts';
import {RoomTopologyCache} from './room-topology.ts';
import type {Cell,MaterialPile,World} from './types.ts';
const roomCaches=new WeakMap<World,RoomTopologyCache>();
const active=(a:WildAnimal)=>a.state!=='dead'&&a.state!=='downed'&&a.state!=='sleeping'&&!a.burning&&!a.stun&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!a.manhunter&&!a.predation&&!a.meal&&!a.mating;
export function initializeAnimalEggLayer256(a:WildAnimal):void {if(isEggSpecies256(a.species))a.eggLayer={progress:0,fertilizations:0};}
/** This is a new-owner initializer, never a migration or repair default. */
export function advanceEggLayers256(world:World):void {
 if(world.schemaVersion<256)return;
 for(const a of world.wildlife?.animals??[]){
  if(!isEggSpecies256(a.species)||a.state==='dead'||!a.eggLayer||world.tick%250!==a.id%250)continue;
  const def=ANIMAL_EGG_CONTENT_256[a.species];
  if(def.femaleOnly&&a.sex!=='female'||!animalLifeStageData256(a.species,a.ageTicks,a.growthTracker?.value).milkable)continue;
  const increment=Math.fround(Math.fround(2500/Math.fround(def.intervalDays*60000))*animalGrowthFactor(a));
  a.eggLayer.progress=Math.min(a.eggLayer.fertilizations?1:def.unfertilizedProgressMaximum,Math.fround(a.eggLayer.progress+increment));
 }
}
export const canLayAnimalEgg256=(world:World,a:WildAnimal):boolean=>world.schemaVersion>=256&&isEggSpecies256(a.species)&&animalMechanicalReadiness256(a.species).ok&&!!a.eggLayer&&a.eggLayer.progress>=1&&active(a)&&!animalCarrier(world,a.id);
/** Select once when this real job starts; one existing frontier and room cache.
 * Egg boxes are not implemented. The original bounded local wander below is
 * an explicit presentation/gameplay adaptation, not a copied Core selector. */
export function beginAnimalEggLay256(world:World,a:WildAnimal,route:(goals:Cell[])=>Cell[]|null|undefined):boolean {
 if(!canLayAnimalEgg256(world,a)||a.path.length||(a.motion?.end??0)>world.tick)return false;
 const species=a.species as EggSpecies256,def=ANIMAL_EGG_CONTENT_256[species],item=a.eggLayer!.fertilizations?def.fertilizedItem:def.unfertilizedItem;
 let cache=roomCaches.get(world);if(!cache){cache=new RoomTopologyCache();roomCaches.set(world,cache);}
 const rooms=cache.read(world),own=rooms.at(a.x,a.z);
 const eggs=world.piles.filter(p=>p.item===item&&p.owner.type==='ground'&&(p.owner.x-a.x)**2+(p.owner.z-a.z)**2<=900&&(!own||own.kind!=='space'||rooms.at(p.owner.x,p.owner.z)===own));
 const pen=grazingPen(world,a);
 const goals=eggs.filter(p=>p.owner.type==='ground'&&(!pen||pen.has(p.owner.z*world.width+p.owner.x))).flatMap(p=>p.owner.type==='ground'?[{x:p.owner.x,z:p.owner.z}]:[]);
 let path=goals.length?route(goals):undefined;
 if(!path){
  const nav=animalNavigation(world,false,true),near:Cell[]=[];
  for(let z=Math.max(0,a.z-5);z<=Math.min(world.height-1,a.z+5);z++)for(let x=Math.max(0,a.x-5);x<=Math.min(world.width-1,a.x+5);x++)if((x-a.x)**2+(z-a.z)**2<=25&&nav.free({x,z})&&(!pen||pen.has(z*world.width+x)))near.push({x,z});
  if(!near.length)return false;
  // No extra global route per candidate: one destination order and one route.
  const start=Math.floor(wildlifeRandom(world.wildlife!)*near.length);
  path=route(near.slice(start).concat(near.slice(0,start)));
 }
 if(!path)return false;
 // An animal already on its laying cell has an empty route: the target is
 // its position, never a copy of the whole animal record.
 const end=path.at(-1)??a;
 a.path=path;a.eggLay={target:{x:end.x,z:end.z},progress:0};a.state=path.length?'moving':'idle';return true;
}
/** Return true while this physical job owns the animal. */
export function processAnimalEggLay256(world:World,a:WildAnimal,move:()=>void):boolean {
 const job=a.eggLay;if(!job)return false;
 if(!canLayAnimalEgg256(world,a)){delete a.eggLay;a.path=[];return false;}
 if(a.path.length){move();return true;}
 if((a.motion?.end??0)>world.tick)return true;
 if(a.x!==job.target.x||a.z!==job.target.z){delete a.eggLay;return false;}
 a.state='idle';if(job.progress<49){job.progress++;return true;}
 const species=a.species as EggSpecies256,def=ANIMAL_EGG_CONTENT_256[species],layer=a.eggLayer!,fertilized=layer.fertilizations>0,item=fertilized?def.fertilizedItem:def.unfertilizedItem;
 // Draws remain private until all placement/identity preconditions succeed.
 const randomOwner={...world.wildlife!},quantity=drawEggQuantity256(species,()=>wildlifeRandom(randomOwner));
 const condition:Pick<MaterialPile,'egg'|'eggForbidden'>={...(!a.domestic?{eggForbidden:true as const}:{}),...(fertilized?{egg:{progress:0,temperatureDamage:0,motherId:a.id,fatherId:layer.fatherId,faction:a.domestic?'player' as const:'wild' as const,atTick:world.tick}}:{})};
 if(!materialCanFit(world,'food',quantity,{type:'ground',x:a.x,z:a.z},item,{id:0,kind:'food',item,quantity,owner:{type:'ground',x:a.x,z:a.z},...condition}))return true;
 addMaterial(world,'food',quantity,{type:'ground',x:a.x,z:a.z},item,condition);
 world.wildlife!.rng=randomOwner.rng;layer.progress=0;if(fertilized)layer.fertilizations=Math.max(0,layer.fertilizations-quantity);
 delete a.eggLay;a.nextDecision=world.tick+1;return true;
}
function eggLocation(world:World,pile:MaterialPile):{cell:Cell;suspended:boolean}|null {
 const owner=pile.owner;
 if(owner.type==='ground')return {cell:owner,suspended:false};
 if(owner.type==='pawn'||owner.type==='inventory'||owner.type==='equipment'||owner.type==='apparel'){
  const p=world.pawns.find(p=>p.id===owner.pawnId);if(p)return pawnContentsLocation(world,p);
  if(world.schemaVersion>=256&&owner.type==='inventory'){
   const animal=world.wildlife?.animals.find(a=>a.id===owner.pawnId);if(!animal)return animalContentsLocation256(world,owner.pawnId);
   const carrier=animalCarrier(world,animal.id);return carrier?pawnContentsLocation(world,carrier):{cell:{x:animal.x,z:animal.z},suspended:false};
  }
  return null;
 }
 const cell=pileCell(world,pile);return cell?{cell,suspended:false}:null;
}
function hatch(world:World,pile:MaterialPile,species:EggSpecies256,cell:Cell):boolean {
 const wildlife=world.wildlife,egg=pile.egg!;
 if(!animalMechanicalReadiness256(species).ok)return false;
 if(!wildlife||wildlife.animals.length+pile.quantity>MAX_WILDLIFE||!Number.isSafeInteger(world.nextId+pile.quantity))return false;
 const nav=animalNavigation(world,false,true),occupied=new Set([...world.pawns,...wildlife.animals].map(a=>a.z*world.width+a.x)),places:Cell[]=[];
 // Conservative all-or-nothing bounded placement: waiting never consumes eggs,
 // allocates IDs, or spends sex RNG. No off-map owner or fake World is created.
 for(let radius=0;radius<=3&&places.length<pile.quantity;radius++)for(let z=cell.z-radius;z<=cell.z+radius&&places.length<pile.quantity;z++)for(let x=cell.x-radius;x<=cell.x+radius&&places.length<pile.quantity;x++){
  if(Math.max(Math.abs(x-cell.x),Math.abs(z-cell.z))!==radius||!nav.free({x,z})||occupied.has(z*world.width+x))continue;
  places.push({x,z});occupied.add(z*world.width+x);
 }
 if(places.length<pile.quantity)return false;
 const newborns:WildAnimal[]=places.map(place=>{
  const a:WildAnimal={id:world.nextId++,species,sex:wildlifeRandom(wildlife)<.5?'female':'male',ageTicks:0,...place,food:0,rest:1,state:'idle',path:[],nextDecision:world.tick+1,
   ...(egg.motherId!==undefined&&egg.fatherId!==undefined?{parents:{motherId:egg.motherId,fatherId:egg.fatherId}}:{})};
  attachNewbornAnimalGrowth256(a,world.tick*10,world.schemaVersion);a.food=animalNutritionMax(a)*.45;initializeAnimalEggLayer256(a);
  if(egg.faction==='player')a.domestic={since:world.tick,care:world.wildlife?.animals.find(m=>m.id===egg.motherId)?.domestic?.care??'herbal',tameness:5,nextDecay:world.tick+6000};
  return a;
 });
 wildlife.animals.push(...newborns);world.piles.splice(world.piles.indexOf(pile),1);return true;
}
/** One pass over actual local pile owners after thermal/animal movement. */
export function advanceLocalEggs256(world:World,layout?:ThermalLayout):void {
 if(world.schemaVersion<256)return;
 let temperature:TemperatureView|undefined,changed=false;
 for(const pile of [...world.piles]){
  const species=eggSpeciesForItem256(pile.item);if(!species||!pile.egg)continue;
  // Skyfaller does not tick its nested Pawn/ThingOwner. Preserve the actual
  // egg anchor as well as progress for compact capture at personalTick.
  if(pile.owner.type==='inventory'&&heldDuckAnimal256(world,pile.owner.pawnId))continue;
  const location=eggLocation(world,pile);temperature??=new TemperatureView(world,layout);
  const result=evolveFertilizedEgg256(pile.egg,species,{tick:world.tick,temperature:location?temperature.at(world,location.cell):temperature.outside,suspended:!location||location.suspended});pile.egg=result.state;
  if(result.action==='ruin'){
   pile.item=ANIMAL_EGG_CONTENT_256[species].unfertilizedItem;markPileWrite();delete pile.egg;Object.assign(pile,freshRot(pile.item,world.tick));changed=true;
  }else if(result.action==='hatch'&&location&&!location.suspended)changed=hatch(world,pile,species,location.cell)||changed;
 }
 if(changed)refreshStock(world);
}

/** An interruption retires the old lay route before other decisions own it;
 * a captured motion itself always finishes under the ordinary movement clock. */
export function reconcileAnimalEggLay256(world:World,a:WildAnimal):void {
 if(a.eggLay&&!canLayAnimalEgg256(world,a)){delete a.eggLay;a.path=[];}
}
