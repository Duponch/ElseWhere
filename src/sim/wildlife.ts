import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {recordShipCasketFilthMovement277} from './filth.ts';
import {createAnimalThermalPass466,createAnimalAirReader466} from './animal-thermal-air-v466.ts';
import {processAnimalThermalRefuge288,reconcileAnimalThermalRefuge288} from './animal-thermal-refuge-288.ts';
import {HEAT_SERIOUS} from './heat-severity.ts';
import {createAnimalHaulingPass282,animalHaulAvailable282,interruptAnimalHaul282} from './animal-hauling-282.ts';
import {createAnimalAreaPolicyReader287} from './animal-area-policy-287.ts';
import {reconcileAnimalAreaTasks287,processAnimalAreaReturn287} from './animal-area-runtime-287.ts';
import {readyAnimalHaulDoorEntry282} from './doors.ts';
import {siteAmbushWaiting263} from './world-site-ambush-263.ts';
import {advanceGeographicRenewal262} from './geographic-renewal-runtime-262.ts';
import {toxicFalloutActive294} from './toxic-fallout-state-294.ts';
import {processAnimalFalloutShelter294,animalFalloutNextStepBlocked294} from './animal-fallout-shelter-294.ts';
import {isRoofed,roofIndex} from './roof-rules.ts';
import {processHivePriority256,processHiveWander256} from './cave-hive-lord-256.ts';
import {reconcileHiveMaintenance256} from './cave-hive-maintenance-256.ts';
import {cobraAdmissionReason256} from './cobra-admission-256.ts';
import {processAnimalConfusedWander256} from './animal-confused-wander-256.ts';
import {isAnimalIdleWanderSchema304,processAnimalIdleWander304} from './animal-idle-wander-304.ts';
import {animalClinicalRandom256} from './animal-condition-medical-frontier-256.ts';
import {finishArrivalFacing256} from './arrival-rotation-256.ts';
import {attachGeneratedAnimalGrowth256} from './animal-growth-runtime-256.ts';
import {processGroupAnimalOnMap256,groupAnimalPreparation} from './group-animal-formation-256.ts';
import {hitSkyfallerRoof256} from './roofing.ts';
import {advanceDuckFlyers256,commitDuckFlyExits256,holdNewDuckArrival256,beginDuckFlyExit256,duckPhysicalOwnerCount256,type DuckFlyerServices256} from './duck-flyer-runtime-256.ts';
import {selectDuckFlyerArrival256} from './duck-flyer-selection-256.ts';
import {advanceDuckFlight256,notifyDuckFlightJob256,isDuckRuntime256} from './duck-flight-runtime-256.ts';
import {duckMapHasWater256,duckWanderWaterAllowed256,duckTerrainWalkable256} from './duck-water-256.ts';
import {retireDownedDuckLanding256} from './duck-retirement-256.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
import {isAnimalSpecies256} from './animal-core-v256.ts';
import {initializeAnimalEggLayer256,reconcileAnimalEggLay256,advanceEggLayers256,beginAnimalEggLay256,processAnimalEggLay256} from './animal-egg-local-v256.ts';
import {isWetTerrain} from './shallow-water.ts';
import { processBurningAnimal } from './firefighting-animals.ts';
import { advanceAnimalManhunter,processAnimalManhunter } from './animal-manhunter.ts';
import { malnutritionModifiers } from './malnutrition.ts';
import { processAnimalVomiting } from './food-hygiene.ts';
import { bleedFilth } from './filth.ts';
import { medicalBleed } from './injury-state.ts';
import { moveAnimalMelee } from './wildlife-melee.ts';
import { captureWorldShotGrid } from './combat-world.ts';
import { blockedCells } from './pathfinding.ts';
import { advanceAnimalHealth,animalBody } from './wildlife-health.ts';
import { animalEscape } from './wildlife-flight.ts';
import { animalFoods,animalMealTarget,finishAnimalMeal,grazingPen,reservedPlantWorkCells,type AnimalFood } from './wildlife-food.ts';
import { animalDoorPassingNavigation,animalNavigation,createAnimalNavigationReader,moveAnimal } from './wildlife-navigation.ts';
import { structureNavigationReader } from './structure-navigation.ts';
import { HARE,MAX_WILDLIFE,wildlifeRandom,type WildAnimal,type WildlifeState } from './wildlife-state.ts';
import { isPlant } from './plants.ts';
import { calendarTick } from './calendar.ts';
import type { Cell,Resource,World } from './types.ts';
import { animalSpecies,faunaBiome,selectBiomeSpecies,type AnimalSpeciesId,type FaunaBiomeId } from './animal-species.ts';
import { animalHandlingHolding } from './animal-handling.ts';
import { animalCareInProgress,animalCareTargets } from './animal-care.ts';
import { animalCarrier,animalServiceIds } from './animal-rest-state.ts';
import { processAnimalRest } from './animal-rest.ts';
import { animalFeedingInProgress } from './animal-feeding.ts';
import { veterinaryCareSpeciesAllowed,veterinaryNeedsRest } from './veterinary-rules.ts';
import { adultAgeTicks, advanceAnimalLife, animalFoodPerDay, animalLifeStage, animalNutritionMax } from './animal-life.ts';
import { atMapEdge,cancelAnimalExit,exitSuppressed,finishAnimalExits,stopExitTargeting,WILDLIFE_EXIT_FOOD_CHECK } from './wildlife-exit.ts';
import { animalPreyCandidates,animalPredationTarget,reconcileAnimalPredation,cancelAnimalPredation } from './wildlife-predation.ts';
const contact=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
const neighbours=(c:Cell):Cell[]=>[{x:c.x,z:c.z},{x:c.x-1,z:c.z},{x:c.x+1,z:c.z},{x:c.x,z:c.z-1},{x:c.x,z:c.z+1}];
/** With new fodder present, Core score is bonus minus source Manhattan distance.
 * Existing food-only searches retain their historical path-cost ranking.
 * Reachability and route ties reuse one frontier, never one flood per food. */
function foodRouting(w:World,a:WildAnimal,food:AnimalFood[]){
  const goals=food.flatMap(neighbours),preferred=food.some(f=>f.preference),ranks=new Map<number,number>();
  const score=(f:AnimalFood)=>Math.abs(a.x-f.x)+Math.abs(a.z-f.z)-(f.preference??0);
  if(preferred)for(const f of food)for(const c of neighbours(f)){
    if(c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)continue;
    const index=c.z*w.width+c.x,priority=score(f);if(!ranks.has(index)||priority<ranks.get(index)!)ranks.set(index,priority);
  }
  return {goals,rank:preferred?(c:Cell)=>ranks.get(c.z*w.width+c.x)!:undefined,
    target:(end:Cell)=>preferred?food.filter(f=>contact(end,f)).sort((a,b)=>score(a)-score(b))[0]!:food.find(f=>contact(end,f))!};
}
export const ANIMAL_POPULATION_CHECK_TICKS=122; // 1,220 Core ticks; Core checks every 1,213.

function occupiedWildlifeCells(world:World,s:WildlifeState):Set<number>{
  return new Set([
    ...world.pawns.map(p=>p.z*world.width+p.x),...s.animals.map(a=>a.z*world.width+a.x),
    ...world.piles.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
    ...world.packed.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
  ]);
}
function addAnimal(world:World,s:WildlifeState,speciesId:AnimalSpeciesId,place:Cell,nextDecision:number,flyIn=false):boolean {
  if(speciesId==='cobra'&&cobraAdmissionReason256(world))return false;
  if(isAnimalSpecies256(speciesId)&&(world.schemaVersion<256||!animalMechanicalReadiness256(speciesId).ok))return false;
  if(!Number.isSafeInteger(world.nextId+(flyIn?2:1)))return false;
  const species=animalSpecies(speciesId);
  s.animals.push({id:world.nextId++,species:speciesId,sex:wildlifeRandom(s)<.5?'female':'male',x:place.x,z:place.z,
    ageTicks:adultAgeTicks(speciesId),food:species.nutrition*(.5+.4*wildlifeRandom(s)),rest:.9+.1*wildlifeRandom(s),state:'idle',path:[],nextDecision});
  const original=s.animals.at(-1)!;if(world.schemaVersion>=256){attachGeneratedAnimalGrowth256(original,world.tick*10,world.schemaVersion);initializeAnimalEggLayer256(original);}if(flyIn&&!holdNewDuckArrival256(world,original))throw Error('Preflighted Duck arrival lost its holder');
  return true;
}
function placeSpeciesGroup(world:World,s:WildlifeState,speciesId:AnimalSpeciesId,count:number,canFlyIn=false):number {
  count=Math.min(count,MAX_WILDLIFE-duckPhysicalOwnerCount256(world));
  if(count<=0||!Number.isSafeInteger(world.nextId+count))return 0;
  const nav=animalNavigation(world),plants=world.resources.filter(isPlant),occupied=occupiedWildlifeCells(world,s);
  const flyAnchor=canFlyIn&&speciesId==='duck'?selectDuckFlyerArrival256(world,()=>wildlifeRandom(s)):undefined;
  const radius=Math.ceil(Math.sqrt(animalSpecies(speciesId).wildGroupSize[1])),diameter=radius*2+1;
  const anchors=flyAnchor?Array.from({length:diameter*diameter},(_,i)=>({x:flyAnchor.x+i%diameter-radius,z:flyAnchor.z+Math.floor(i/diameter)-radius})):plants.length?plants.flatMap(neighbours):[{x:Math.floor(world.width/2),z:Math.floor(world.height/2)}].flatMap(neighbours);
  if(!anchors.length)return 0;
  const offset=Math.floor(wildlifeRandom(s)*anchors.length),ordered=anchors.slice(offset).concat(anchors.slice(0,offset));let added=0;
  for(const place of ordered){const key=place.z*world.width+place.x;if(!nav.free(place)||occupied.has(key))continue;
    if(!addAnimal(world,s,speciesId,place,world.tick+1+(s.animals.length+added)%60,!!flyAnchor))break;occupied.add(key);added++;if(added>=count||duckPhysicalOwnerCount256(world)>=MAX_WILDLIFE)break;
  }
  return added;
}
// A tamed hare keeps its physical body in this collection, but no longer
// satisfies the wild ecological target used to plan new arrivals.
export const wildPopulationWeight=(s:WildlifeState)=>s.animals.reduce((sum,a)=>sum+(a.domestic?0:animalSpecies(a.species).ecoSystemWeight),0);

/** V91 biome initialization spends ecological weight, never density as a head
 * count. The target is reduced by the exact commonality share implemented in
 * this bounded catalogue, leaving unavailable Core species unredistributed. */
export function enableBiomeWildlife(world:World,biomeId:FaunaBiomeId):void {
  if(world.wildlife)return;
  const biome=faunaBiome(biomeId,world.schemaVersion>=178),implemented=biome.entries.reduce((n,e)=>n+e.commonality,0);
  const fullTargetWeight=world.width*world.height*biome.animalDensity/10000,targetWeight=fullTargetWeight*implemented/biome.totalCommonality;
  const s=world.wildlife={profile:world.schemaVersion>=178?'biome-fauna-v2':'biome-herbivores-v1',rng:(world.seed^0x784caf31)>>>0||1,animals:[],eatenPlants:0,eatenNutrition:0,eatenItems:0,
    population:{biome:biomeId,fullTargetWeight,targetWeight,nextCheck:world.tick+ANIMAL_POPULATION_CHECK_TICKS,checks:0,arrivals:0}};
  const initialTargetWeight=toxicFalloutActive294(world)?0:targetWeight;
  for(let attempts=0;attempts<256&&wildPopulationWeight(s)<initialTargetWeight&&s.animals.length<MAX_WILDLIFE;attempts++){
    let roll=wildlifeRandom(s)*implemented,speciesId:AnimalSpeciesId|undefined;
    for(const entry of biome.entries){roll-=entry.commonality;if(roll<0){speciesId=entry.species;break;}}
    if(!speciesId)break;const species=animalSpecies(speciesId),[min,max]=species.wildGroupSize;
    const count=min+Math.floor(wildlifeRandom(s)*(max-min+1));if(!placeSpeciesGroup(world,s,speciesId,count))break;
  }
}

function advancePopulation(world:World,s:WildlifeState):void {
  const population=s.population;if(!['biome-herbivores-v1','biome-fauna-v2'].includes(s.profile)||!population||world.tick<population.nextCheck)return;
  if(!Number.isSafeInteger(population.checks+1))return;
  population.nextCheck=world.tick+ANIMAL_POPULATION_CHECK_TICKS;population.checks++;
  if(toxicFalloutActive294(world))return;
  if(wildPopulationWeight(s)>=population.targetWeight||duckPhysicalOwnerCount256(world)>=MAX_WILDLIFE)return;
  const biome=faunaBiome(population.biome,s.profile==='biome-fauna-v2');
  const maximumGroup=biome.entries.reduce((maximum,entry)=>Math.max(maximum,animalSpecies(entry.species).wildGroupSize[1]),0);
  if(!Number.isSafeInteger(population.arrivals+1)||!Number.isSafeInteger(world.nextId+Math.min(maximumGroup,MAX_WILDLIFE-s.animals.length)))return;
  if(wildlifeRandom(s)>=.026955556*biome.animalDensity)return;
  const speciesId=selectBiomeSpecies(biome,wildlifeRandom(s));if(!speciesId)return;
  const species=animalSpecies(speciesId),[min,max]=species.wildGroupSize,count=min+Math.floor(wildlifeRandom(s)*(max-min+1));
  const added=placeSpeciesGroup(world,s,speciesId,count,true);if(added)population.arrivals++;
}

/** Only new camps or explicit opt-in. No wildlife is invented during migration. */
export function enableWildlife(world:World,count=Math.min(12,Math.max(3,Math.floor(world.width*world.height/5000))),distribution?:'natural'):void {
  if(world.wildlife)return;
  if(distribution!==undefined&&distribution!=='natural')throw new Error('Invalid wildlife distribution.');
  if(!Number.isSafeInteger(count)||count<0||count>MAX_WILDLIFE||!Number.isSafeInteger(world.nextId+count))throw new Error('Invalid wildlife population.');
  if(toxicFalloutActive294(world))count=0;
  const s=world.wildlife={profile:'temperate-hares-v1' as const,rng:(world.seed^0x784caf31)>>>0||1,animals:[] as WildAnimal[],eatenPlants:0,eatenNutrition:0,eatenItems:0};
  const nav=animalNavigation(world),plants=world.resources.filter(isPlant);
  if(!distribution)plants.sort((a,b)=>Math.hypot(a.x-world.width/2,a.z-world.height/2)-Math.hypot(b.x-world.width/2,b.z-world.height/2));
  const occupied=distribution?new Set([
    ...world.pawns.map(p=>p.z*world.width+p.x),
    ...world.piles.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
    ...world.packed.flatMap(p=>p.owner.type==='ground'?[p.owner.z*world.width+p.owner.x]:[]),
  ]):undefined;
  const used=new Set<number>();
  for(let n=0;n<count&&plants.length;n++) {
    const offset=n===0&&!distribution?0:Math.floor(wildlifeRandom(s)*plants.length);
    const places=plants.slice(offset).concat(plants.slice(0,offset)).flatMap(neighbours);
    const admissible=(c:Cell)=>nav.free(c)&&!used.has(c.z*world.width+c.x)&&!occupied?.has(c.z*world.width+c.x);
    // Disperse the available species where habitat permits; a crowded small
    // fixture can fall back to any admissible unoccupied location.
    const place=distribution?places.find(c=>admissible(c)&&s.animals.every(a=>(a.x-c.x)**2+(a.z-c.z)**2>=36))??places.find(admissible):places.find(admissible);if(!place)break;
    used.add(place.z*world.width+place.x);
    s.animals.push({id:world.nextId++,species:'hare',sex:wildlifeRandom(s)<.5?'female':'male',ageTicks:adultAgeTicks('hare'),x:place.x,z:place.z,food:HARE.nutrition*(.5+.4*wildlifeRandom(s)),rest:.9+.1*wildlifeRandom(s),state:'idle',path:[],nextDecision:world.tick+1+n%60});if(world.schemaVersion>=256)attachGeneratedAnimalGrowth256(s.animals.at(-1)!,world.tick*10,world.schemaVersion);
  }
}
export function reconcileWildlife(world:World,resourcesById?:ReadonlyMap<number,Resource>,workCells?:ReadonlySet<number>,readArea=createAnimalAreaPolicyReader287(world)):void {
  const animals=world.wildlife?.animals??[];
  const mates=animals.some(a=>a.mating)?new Map(animals.map(a=>[a.id,a])):undefined;
  let refugeNav:ReturnType<typeof createAnimalNavigationReader>|undefined;
  for(const a of animals){
    if(a.animalThermalRefuge288)reconcileAnimalThermalRefuge288(world,a,readArea(a),(c)=>(refugeNav??=createAnimalNavigationReader(world,undefined,readArea))(a).free(c));
    if(a.predation)reconcileAnimalPredation(world,a);
    if(a.exiting&&exitSuppressed(a))cancelAnimalExit(world,a);
    if(a.meal&&!animalMealTarget(world,a,resourcesById,workCells,readArea)){delete a.meal;a.path=[];a.state=a.motion&&a.motion.end>world.tick?'moving':'idle';a.nextDecision=world.tick;}
    if(a.mating){
      const female=mates?.get(a.mating.femaleId);
      if(a.state==='dead'||!a.domestic||animalLifeStage(a)!=='adult'||!female||female.state==='dead'||!female.domestic
        ||animalLifeStage(female)!=='adult'||female.species!==a.species||female.sex!=='female'||female.pregnancy){
        delete a.mating;a.path=[];a.nextDecision=world.tick;
      }
    }
  }
}
export function advanceWildlife(world:World,duckFlyerServices:DuckFlyerServices256={hitRoof:hitSkyfallerRoof256}):void {
  const s=world.wildlife;if(!s)return;advanceGeographicRenewal262(world,(species,cell,nextDecision,flyIn)=>addAnimal(world,s,species,cell,nextDecision,flyIn));advancePopulation(world,s);advanceAnimalLife(world);advanceEggLayers256(world);if(!s.animals.length){advanceDuckFlyers256(world,duckFlyerServices);return;}
  const animalAir=createAnimalAirReader466(world),readThermal466=createAnimalThermalPass466(world,animalAir);
  // A meal can remain active for many ticks. Capture its plant identity once
  // for this synchronous decision, then discard the index before other world
  // systems can mutate resources. A handful of meals are cheaper to scan
  // directly; the first measured large-map win was at 16 active meals.
  // The public reconciliation API remains live.
  let mealResources:Map<number,Resource>|undefined;
  let activePlantMeals=0;
  for(const animal of s.animals)if(animal.meal?.kind==='plant')activePlantMeals++;
  if(activePlantMeals>=16){
    mealResources=new Map();for(const resource of world.resources)mealResources.set(resource.id,resource);
  }
  let plantWorkCells:ReadonlySet<number>|undefined;
  const getPlantWorkCells=()=>plantWorkCells??=reservedPlantWorkCells(world);
  const readArea=createAnimalAreaPolicyReader287(world);
  reconcileWildlife(world,mealResources,activePlantMeals?getPlantWorkCells():undefined,readArea);
  let searches=0;
  const hauling=createAnimalHaulingPass282(world,readArea),takeHaulSearch=()=>{if(searches>=1)return false;searches++;return true;};
  const structureNavigation=structureNavigationReader(world);
  const getNav=createAnimalNavigationReader(world,()=>structureNavigation.read(),readArea);
  let physical:Uint8Array|undefined,shot:ReturnType<typeof captureWorldShotGrid>|undefined;
  const getPhysical=()=>physical??=blockedCells(world,true,structureNavigation.read()),getShot=()=>shot??=captureWorldShotGrid(world);
  const hour=Math.floor(calendarTick(world)%6000/250),night=hour<7||hour>=22;
  let ledAnimals:Set<number>|undefined;
  for(const pawn of world.pawns)if(pawn.animalHandling?.kind==='lead'&&pawn.animalHandling.phase!=='approach')
    for(const id of pawn.animalHandling.ropees??[pawn.animalHandling.animalId])(ledAnimals??=new Set()).add(id);
  const matingFemales=new Set(s.animals.flatMap(a=>a.mating?[a.mating.femaleId]:[]));
  const departures=new Set<number>(),retiredDucks=new Set<number>();
  // Rotate priority; at most one potentially map-wide search per tick.
  for(let i=0;i<s.animals.length;i++) {
    const a=s.animals[(world.tick+i)%s.animals.length]!;
    const species=animalSpecies(a.species);
    const aliveBefore=a.state!=='dead';
    advanceAnimalHealth(world,a,readThermal466(a));reconcileAnimalEggLay256(world,a);reconcileHiveMaintenance256(world,a);
    if(aliveBefore&&a.state==='dead')hauling.invalidate();
    // Revoke future cargo travel before any danger, medical or other owner
    // can take control. The committed edge and actual inventory stay physical.
    if(a.haul&&a.haul.phase!=='holding'&&!animalHaulAvailable282(world,a,night)){
      interruptAnimalHaul282(world,a);hauling.invalidate();
    }
    if(a.exitFlight&&(a.state==='dead'||a.state==='downed'||a.domestic||a.manhunter))delete a.exitFlight;
    if((a.state==='downed'||!!(a.flee||a.meal||a.eggLay||a.mating)||a.state==='sleeping')&&a.flight)notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s));
    advanceDuckFlight256(world,a,{walkable:core=>{const occupied=a.motion&&a.motion.end>core/10?a.motion.from:a;return duckTerrainWalkable256(world,{species:a.species},world.tiles[occupied.z*world.width+occupied.x]!.terrain);},retireDowned:()=>{if(!retireDownedDuckLanding256(world,a))return false;retiredDucks.add(a.id);return true;}});
    if(retiredDucks.has(a.id))continue;
    // Burning prevents all new attacks; its reaction can begin at the first
    // local boundary after recovery. Other blows expire in the Core substep.
    if(a.burning&&a.strike&&a.strike.untilCore<=world.tick*10)delete a.strike;
    if(a.exiting&&exitSuppressed(a))cancelAnimalExit(world,a);
    if(a.state==='dead')continue;
    if(a.health)bleedFilth(world,a,medicalBleed(a.health),a.state==='downed'||a.state==='sleeping',.4);
    const body=animalBody(a);
    // Local ground-rest adaptation: keep the existing food/danger priorities.
    // V277 also retains convalescence after tending, as Core medical rest does.
    const medicalRest=!a.confusion&&!!a.domestic&&a.domestic.care!=='none'&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike
      &&(animalCareTargets(a).length>0||world.schemaVersion>=212&&veterinaryCareSpeciesAllowed(a.species,world.schemaVersion,a)
        &&!!a.health&&veterinaryNeedsRest(a.health));
    if(medicalRest&&a.haul&&a.haul.phase!=='holding'){interruptAnimalHaul282(world,a);hauling.invalidate();}
    const nutrition=animalNutritionMax(a);
    const wantFood=a.confusion?.05:species.predator?.3:.45,urgent=species.predator?.12:.18,hungry=species.predator?.24:.36;
    a.food=Math.max(0,a.food-animalFoodPerDay(a)/6000*malnutritionModifiers(a.health?.malnutrition).hungerFactor*(a.food<nutrition*urgent?.25:a.food<nutrition*hungry?.5:1));
    a.rest=Math.max(0,Math.min(1,a.rest+(a.state==='sleeping'?.0003809524*.8:-.00015833333*(a.rest<.01?.6:a.rest<.14?.3:a.rest<.28?.7:1))));
    if(isSchema287OrLater(Number(world.schemaVersion))&&a.animalAreaReturn287)reconcileAnimalAreaTasks287(world,a,readArea(a));
    // Transport owns position only: life, health, bleeding and needs still advance.
    if(world.schemaVersion>=221&&animalCarrier(world,a.id))continue;
    hauling.recover(a);
    if(!isCorePhysicalSchema297(world.schemaVersion)&&a.filthFeet&&a.motion&&a.motion.end>world.tick-1&&a.motion.end<=world.tick)recordShipCasketFilthMovement277(world,a);
    if(a.exitFlight)continue;
    if(!a.burning&&!a.flee&&!a.retaliation&&siteAmbushWaiting263(world,a.id,'animal')){a.path=[];if(!a.motion||a.motion.end<=world.tick)a.state='idle';continue;}
    advanceAnimalManhunter(world,a);
    if(a.flee&&world.tick>=a.flee.until){delete a.flee;a.path=[];if(!a.motion||a.motion.end<=world.tick)a.state='idle';}
    if(processAnimalVomiting(world,a))continue;
    if(world.schemaVersion>=256&&processGroupAnimalOnMap256(world,a,{free:c=>getNav(a).free(c),route:(animal,goals)=>{if(searches>=1)return null;searches++;return getNav(animal).route(animal,goals);},move:animal=>moveAnimal(world,animal,getNav(animal).step,animalBody(animal).capacities.moving,getNav(animal).geometry)}))continue;
    if(a.state==='downed'||a.motion&&a.motion.end>world.tick)continue;
    // New panic travel waits only for the already committed physical recovery.
    // Fire damage keeps advancing in the shared fire clock during this wait.
    if(a.strike){a.path=[];if(a.state!=='sleeping')a.state='idle';continue;}
    if(a.predation&&(a.burning||a.flee))cancelAnimalPredation(world,a);
    if(a.burning&&processBurningAnimal(world,a,{free:c=>getNav(a).free(c),route:goals=>{if(searches>=1)return null;searches++;return getNav(a).route(a,goals);},move:()=>{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}}))continue;
    if(a.manhunter&&processAnimalManhunter(world,a,getNav(a),getPhysical(),()=>{if(searches>=1)return false;searches++;return true;},()=>animalDoorPassingNavigation(world,a,structureNavigation.read())))continue;
    if(moveAnimalMelee(world,a,()=>getNav(a),getPhysical,getShot))continue;
    if(a.stun)continue;
    if(!a.flee&&processHivePriority256(world,a,()=>getNav(a),getPhysical,()=>{if(searches>=1)return false;searches++;return true;}))continue;
    if(a.predation){
      const target=animalPredationTarget(world,a);
      if(!target){
        const pile=world.piles.find(p=>p.id===a.predation!.targetId&&p.corpse);
        if(pile){
          const food=animalFoods(world,a,readArea).find(f=>f.id===pile.id);
          if(!food){cancelAnimalPredation(world,a);continue;}
          if(searches>=1)continue;
          searches++;const path=getNav(a).route(a,neighbours(food));
          if(path){cancelAnimalPredation(world,a);a.meal={kind:'pile',id:food.id,quantity:1,progress:0};a.path=path;a.state='moving';a.nextDecision=world.tick;}
          else cancelAnimalPredation(world,a);
        }
        // A retained dead actor must complete its fall and become a real pile.
        continue;
      }
      if(contact(a,target)){a.path=[];a.state='idle';continue;}
      const end=a.path.at(-1);
      if(!end||!contact(end,target)||world.tick>=a.nextDecision){
        // A deferred target review does not revoke an existing safe edge.
        // moveAnimal still validates terrain/corners before consuming it.
        if(searches<1){
          searches++;const path=getNav(a).route(a,neighbours(target));
          if(!path){cancelAnimalPredation(world,a);a.nextDecision=world.tick+25;continue;}
          a.path=path;a.nextDecision=world.tick+25;
        }
      }
      if(a.path.length)moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);
      continue;
    }
    if(a.flee){
      if(world.tick>=a.flee.until){delete a.flee;a.path=[];a.state='idle';}
      else {
        if(a.path.length){moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);if(!a.path.length)delete a.flee;continue;}
        if(a.nextDecision>world.tick||searches>=1)continue;
        searches++;const path=animalEscape(world,a,getNav(a));
        if(path){a.path=path;moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}
        a.nextDecision=world.tick+20;continue;
      }
    }
    // A handler or veterinarian holds the animal only at real adjacent
    // interaction. Their approach reserves work but never freezes wildlife.
    const danger=!!(a.burning||a.flee||a.threat||a.retaliation||a.strike||a.manhunter);
    // The handler advances both bodies on confirmed ticks. Ordinary wildlife
    // decisions must not replace its route while the rope is held.
    if(!danger&&!a.confusion&&(ledAnimals?.has(a.id)||matingFemales.has(a.id)))continue;
    const held=!danger&&((!!a.taming?.designated||!!a.domestic)&&animalHandlingHolding(world,a.id)
      ||!!a.domestic&&(animalCareInProgress(world,a)||animalFeedingInProgress(world,a)));
    if(held&&!(a.state==='eating'&&a.meal)){cancelAnimalExit(world,a);continue;}
    if(a.eggLay&&processAnimalEggLay256(world,a,()=>moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry)))continue;
    const returnToArea=()=>{const policy=readArea(a);if(!policy&&!a.animalAreaReturn287)return false;return processAnimalAreaReturn287(world,a,{policy,nav:getNav(a),takeSearch:takeHaulSearch,...medicalRest?{fallbackRoute:(goals:Cell[])=>getNav(a).failedRouteTo(a,goals)}:{},move:()=>{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}});};
    if(isSchema287OrLater(Number(world.schemaVersion))&&!medicalRest&&returnToArea())continue;
    const rest=()=>{
      if(world.schemaVersion<221||!a.domestic||a.confusion&&a.rest>=.15&&a.state!=='sleeping')return false;
      const pen=grazingPen(world,a),inside=(c:Cell)=>!pen||pen.has(c.z*world.width+c.x);
      return processAnimalRest(world,a,{medicalRest,night,nutrition,readArea,
        free:c=>inside(c)&&getNav(a).free(c),step:(from,to)=>inside(to)&&getNav(a).step(from,to),
        route:(goals,rank)=>{if(searches>=1)return null;searches++;return getNav(a).route(a,goals.filter(inside),rank);},
        move:()=>{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}});
    };
    if(medicalRest&&rest())continue;
    if(isSchema287OrLater(Number(world.schemaVersion))&&medicalRest&&returnToArea())continue;
    if((Number(world.schemaVersion)===288||(Number(world.schemaVersion)===289||(Number(world.schemaVersion)===290||(Number(world.schemaVersion)===291||(Number(world.schemaVersion)===292||(Number(world.schemaVersion)===293||(Number(world.schemaVersion)===294||(Number(world.schemaVersion)===295||(Number(world.schemaVersion)===296||isCorePhysicalSchema297(Number(world.schemaVersion)))))))))))&&(a.animalThermalRefuge288||Math.max(a.health?.heatstroke??0,a.health?.hypothermia??0)>=HEAT_SERIOUS)&&processAnimalThermalRefuge288(world,a,{nav:getNav(a),air:animalAir,policy:readArea(a),takeSearch:takeHaulSearch,
      interruptHaul:()=>{interruptAnimalHaul282(world,a);hauling.invalidate();},startJob:()=>notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s)),
      move:()=>{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}}))continue;
    if(!medicalRest&&rest())continue;
    if(a.state==='sleeping') {
      if(medicalRest&&a.food>=nutrition*.45&&!a.sleepUntilCore&&getNav(a).free(a))continue;
      if(!medicalRest&&a.rest<1&&!a.sleepUntilCore&&getNav(a).free(a))continue;
      a.state='idle';a.nextDecision=world.tick+1;
    }
    if(a.meal) {
      const target=animalMealTarget(world,a,mealResources,a.meal.kind==='plant'?getPlantWorkCells():undefined,readArea);
      if(!target){delete a.meal;a.path=[];a.state='idle';a.nextDecision=world.tick;continue;}
      if(contact(a,target)&&getNav(a).free(a)) {
        a.path=[];
        if(a.state!=='eating'){finishArrivalFacing256(a,target);a.state='eating';a.meal.progress=0;}
        else if((a.meal.progress+=Math.max(.15,(.05+.95*body.capacities.eating)*(.7+.3*body.capacities.manipulation)))>=species.ingestTicks){
          const meal=a.meal,resourcesBefore=world.resources;
          finishAnimalMeal(world,a,readArea);hauling.invalidate();
          if(meal.kind==='plant'){
            plantWorkCells=undefined; // Eating may remove harvest/cut jobs at this cell.
            if(world.resources!==resourcesBefore)mealResources?.delete(meal.id);
          }
          getNav.invalidate();structureNavigation.invalidate();
        }
        continue;
      }
      if(!a.path.length){delete a.meal;a.state='idle';a.nextDecision=world.tick;}
    }
    if(a.exiting){
      const arrived=atMapEdge(world,a)&&!a.path.length;
      // A committed blow must finish recovery while its identity still exists.
      if(arrived&&stopExitTargeting(world,a.id))continue;
      let checked=false;
      if((arrived||!a.path.length||world.tick>=a.exiting.nextFoodCheck)&&a.nextDecision<=world.tick&&searches<1){
        searches++;
        const food=animalFoods(world,a,readArea),routing=foodRouting(world,a,food),route=species.predator
          ?getNav(a).foodPreyOrExitRoute(a,routing.goals,animalPreyCandidates(world,a),true,routing.rank)
          :getNav(a).foodOrExitRoute(a,routing.goals,routing.rank);
        if(route?.kind==='prey'){
          delete a.exiting;a.predation={targetId:route.targetId!,startedAtCore:world.tick*10,firstHit:true};a.path=route.path;a.state='moving';a.nextDecision=world.tick;continue;
        }
        if(route?.kind==='food'){
          const end=route.path.at(-1)??a,target=routing.target(end);
          notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s));delete a.exiting;a.meal={kind:target.kind,id:target.id,quantity:target.quantity,progress:0};
          a.path=route.path;a.state='moving';a.nextDecision=world.tick;continue;
        }
        if(!route){cancelAnimalExit(world,a);a.path=[];a.state='hungry';a.nextDecision=world.tick+WILDLIFE_EXIT_FOOD_CHECK;continue;}
        a.path=route.path;a.exiting.destination={...(a.path.at(-1)??a)};
        a.exiting.nextFoodCheck=world.tick+WILDLIFE_EXIT_FOOD_CHECK;checked=true;
      }
      if(arrived&&checked&&!a.path.length){departures.add(a.id);continue;}
      if(a.path.length)moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);
      continue;
    }
    if(a.confusion&&!a.meal){
      if(a.food>=nutrition*.05&&a.rest>=.15){processAnimalConfusedWander256(world,a,getNav(a),{takeSearch:()=>{if(searches>=1)return false;searches++;return true;},createReachability:()=>getNav(a).wanderSearch(a),random:animalClinicalRandom256(()=>wildlifeRandom(s)),move:()=>{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}});continue;}
      if(a.wander?.job){delete a.wander.job;a.path=[];}
    }
    if(a.haul&&a.haul.phase!=='holding'){
      if(!animalHaulAvailable282(world,a,night)){interruptAnimalHaul282(world,a);hauling.invalidate();}
      else if(hauling.process(a,getNav(a),takeHaulSearch,()=>{
        const next=a.path[0];if(next&&readyAnimalHaulDoorEntry282(world,a,next))moveAnimal(world,a,(from,to)=>getNav(a).haulStep(a,to),body.capacities.moving,getNav(a).geometry);
      }))continue;
    }
    if(a.path.length&&toxicFalloutActive294(world))processAnimalFalloutShelter294(world,a,{nav:getNav(a),startNew:false,takeSearch:takeHaulSearch,startJob:()=>{},move:()=>{}});
    if(a.path.length){const pen=grazingPen(world,a);if(pen&&!pen.has(a.path[0]!.z*world.width+a.path[0]!.x)){a.path=[];delete a.meal;a.nextDecision=world.tick;}else{moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);continue;}}
    if(a.mating)continue;
    if(a.nextDecision>world.tick)continue;
    const n=getNav(a);
    if(a.food<nutrition*wantFood&&searches<1) {
      searches++;
      const food=animalFoods(world,a,readArea),routing=foodRouting(world,a,food),goals=routing.goals;
      const choice=species.predator?n.foodPreyOrExitRoute(a,goals,animalPreyCandidates(world,a),a.food<=0&&!a.domestic&&!a.confusion,routing.rank):a.food<=0&&!a.domestic&&!a.confusion?n.foodOrExitRoute(a,goals,routing.rank):undefined;
      if(choice?.kind==='prey'){
        a.predation={targetId:choice.targetId!,startedAtCore:world.tick*10,firstHit:true};a.path=choice.path;a.state='moving';a.nextDecision=world.tick;continue;
      }
      const path=choice?.kind==='food'?choice.path:species.predator||a.food<=0&&!a.domestic&&!a.confusion?undefined:n.route(a,goals,routing.rank);
      if(path) {
        const end=path.at(-1)??a,target=routing.target(end);
        notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s));a.meal={kind:target.kind,id:target.id,quantity:target.quantity,progress:0};a.path=path;a.state='moving';a.nextDecision=world.tick;continue;
      }
      if(choice?.kind==='exit'){
        if(beginDuckFlyExit256(world,a,world.tick*10,'exit'))continue;
        a.path=choice.path;a.exiting={destination:{...(a.path.at(-1)??a)},nextFoodCheck:world.tick+WILDLIFE_EXIT_FOOD_CHECK};
        a.state='moving';a.nextDecision=world.tick;continue;
      }
      a.nextDecision=world.tick+100;a.state='hungry';
    } else if(a.food<nutrition*wantFood)continue;
    const areaPolicy=readArea(a),insideArea=(c:Cell)=>!areaPolicy||areaPolicy.has(c.z*world.width+c.x);
    if((medicalRest?a.food>=nutrition*.45:a.confusion?a.rest<.15:a.rest<.3||night&&a.rest<.75)&&!a.sleepUntilCore&&n.free(a)&&insideArea(a)) {notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s));a.state='sleeping';continue;}
    if(!a.confusion&&searches<1&&beginAnimalEggLay256(world,a,goals=>{if(searches>=1)return null;searches++;return n.route(a,goals);})){notifyDuckFlightJob256(world,a,'other',()=>wildlifeRandom(s));continue;}
    if(processHiveWander256(world,a,n,()=>{if(searches>=1)return false;searches++;return true;}))continue;
    if(!medicalRest&&animalHaulAvailable282(world,a,night)&&hauling.start(a,n,takeHaulSearch))continue;
    const falloutWander=toxicFalloutActive294(world)?processAnimalFalloutShelter294(world,a,{nav:n,canSearch:()=>searches<1,takeSearch:takeHaulSearch,startJob:()=>notifyDuckFlightJob256(world,a,'GotoWander',()=>wildlifeRandom(s)),move:()=>{moveAnimal(world,a,n.step,body.capacities.moving,n.geometry);}}):0;
    if(falloutWander===1)continue;
    // Schema 304: RimWorld's JobGiver_Wander (wait, then walk to a cell drawn
    // around the node's root), see animal-idle-wander-304.ts.
    if(isAnimalIdleWanderSchema304(world.schemaVersion)&&a.wander){
      processAnimalIdleWander304(world,a,{nav:n,reach:()=>n.idleWanderSearch(a),random:animalClinicalRandom256(()=>wildlifeRandom(s)),
        move:()=>{moveAnimal(world,a,n.step,body.capacities.moving,n.geometry);},policy:areaPolicy,roofedOnly:falloutWander===2});
      continue;
    }
    // Bounded neighbouring moves avoid full-map wandering floods. No random
    // walk through walls/closed doors; diagonal length stays Euclidean.
    const pen=grazingPen(world,a);
    const choices=[[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]].map(([x,z])=>({x:a.x+x!,z:a.z+z!})).filter(c=>insideArea(c)&&n.free(c)&&(isDuckRuntime256(world,a)||!isWetTerrain(world.tiles[c.z*world.width+c.x]?.terrain)||!!world.tiles[c.z*world.width+c.x]?.bridge)&&n.step(a,c)&&(!pen||pen.has(c.z*world.width+c.x))&&(falloutWander!==2||isRoofed(world,roofIndex(world,c))));
    if(choices.length){const candidate=choices[Math.floor(wildlifeRandom(s)*choices.length)]!;if(!isDuckRuntime256(world,a)||duckWanderWaterAllowed256(world,a,candidate,duckMapHasWater256(world),()=>wildlifeRandom(s))){notifyDuckFlightJob256(world,a,'GotoWander',()=>wildlifeRandom(s));a.path=[candidate];if(a.wander){a.wander.nextMoveOrderIsWait=!a.wander.nextMoveOrderIsWait;a.wander.job={kind:'goto',destination:{...candidate}};}moveAnimal(world,a,getNav(a).step,body.capacities.moving,getNav(a).geometry);}}
    a.nextDecision=Math.max(a.nextDecision,world.tick+12+Math.floor(wildlifeRandom(s)*13));
  }
  if(retiredDucks.size)s.animals=s.animals.filter(a=>!retiredDucks.has(a.id));
  finishAnimalExits(world,departures);
  commitDuckFlyExits256(world);advanceDuckFlyers256(world,duckFlyerServices);
}

/** Read-only participants captured only until macro/command/impact. This is
 * neither an animal job planner nor permission to replace its true owner. */
export interface AnimalPathGuards297 {readonly led:ReadonlySet<number>;readonly matingFemales:ReadonlySet<number>;readonly services:ReadonlySet<number>;readonly night:boolean}
export function captureAnimalPathGuards297(world:World):AnimalPathGuards297 {
 const led=new Set<number>(),services=new Set<number>();
 for(const p of world.pawns){for(const id of animalServiceIds(p))services.add(id);
  if(p.animalHandling?.kind==='lead'&&p.animalHandling.phase!=='approach')for(const id of p.animalHandling.ropees??[p.animalHandling.animalId])led.add(id);}
 const matingFemales=new Set((world.wildlife?.animals??[]).flatMap(a=>a.mating?[a.mating.femaleId]:[]));
 const hour=Math.floor(calendarTick(world)%6000/250);return {led,matingFemales,services,night:hour<7||hour>=22};
}
/** Same external owners as the wildlife pass, with actual Core comparisons
 * for physical recovery. No job transition, search, quota or RNG is run. */
export function animalPathContinuationAllowed297(world:World,a:WildAnimal,core:number,c:AnimalPathGuards297):boolean {
 if(a.state!=='moving'||!a.path.length||a.health?.death||a.exitFlight||animalCarrier(world,a.id)
  ||a.stun&&a.stun.untilCore>core||a.strike&&a.strike.untilCore>core||a.manhunter?.exhausted
  ||a.health?.foodPoisoning?.vomit||a.health?.cryptosleepSickness?.vomit||a.health?.toxicBuildup?.vomit||a.health?.toxicBuildup?.vomitRequestedAt!==undefined)return false;
 const body=animalBody(a);if(!body.movingCapable||!body.canBeAwake||body.painShock||body.vitalFailure)return false;
 if(!a.burning&&!a.flee&&!a.retaliation&&siteAmbushWaiting263(world,a.id,'animal'))return false;
 const danger=!!(a.burning||a.flee||a.threat||a.retaliation||a.strike&&a.strike.untilCore>core||a.manhunter);
 if(!danger&&!a.confusion&&(c.led.has(a.id)||c.matingFemales.has(a.id)))return false;
 if(!danger&&c.services.has(a.id)&&((!!a.taming?.designated||!!a.domestic)&&animalHandlingHolding(world,a.id)
  ||!!a.domestic&&(animalCareInProgress(world,a)||animalFeedingInProgress(world,a))))return false;
 const group=groupAnimalPreparation(world,a.id);
 if(group&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.manhunter){
  const {line}=group,p=world.pawns.find(p=>p.id===line.handlerId);
  if(!p||!line.gathered||line.mode==='carry'||Math.hypot(a.x-p.x,a.z-p.z)<=1.5)return false;
  const end=a.path.at(-1)!;if(Math.abs(end.x-p.x)>1||Math.abs(end.z-p.z)>1)return false;
 }
 if(a.haul&&a.haul.phase!=='holding'&&!animalHaulAvailable282(world,a,c.night))return false;
 // Specialized routes were admitted before the generic pen fallback. Keep
 // this separation: allowed-area costs are not a strict corridor wall.
 const special=!!(group||a.burning||a.flee||a.threat||a.retaliation||a.manhunter||a.predation||a.exiting||a.animalRest||a.eggLay||a.confusion||a.hiveJob||a.animalAreaReturn287||a.animalThermalRefuge288||a.haul&&a.haul.phase!=='holding');
 if(!special){if(animalFalloutNextStepBlocked294(world,a))return false;const pen=grazingPen(world,a),next=a.path[0]!;if(pen&&!pen.has(next.z*world.width+next.x))return false;}
 return true;
}
