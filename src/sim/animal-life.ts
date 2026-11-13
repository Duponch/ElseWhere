import {animalDietFlags256} from './animal-diet-v256.ts';
import {trackedAnimalLifeStage256,trackedAnimalNutritionMaximum256,trackedAnimalBodySize256,attachNewbornAnimalGrowth256} from './animal-growth-runtime-256.ts';
import {animalMechanicalReadiness256} from './animal-readiness-v256.ts';
import {animalCore256} from './animal-core-v256.ts';
import {drawAnimalLitter256} from './animal-reproduction-v256.ts';
import {ANIMAL_EGG_CONTENT_256,isEggSpecies256} from './animal-egg-content-v256.ts';
import {fertilizeEggLayer256} from './animal-egg-state-v256.ts';
import {isAnimalSpecies256,animalStageAgeTicks256,animalBodySize256,animalNutritionMax256,animalFoodPerDay256,animalGestationTicks256} from './animal-core-v256.ts';
import {actualAnimalProfile256} from './actual-animal-profile-256.ts';
import { animalSpecies, type AnimalSpeciesId } from './animal-species.ts';
import { leadingClaimIds } from './animal-leading.ts';
import { animalNavigation } from './wildlife-navigation.ts';
import { grazingPen } from './wildlife-food.ts';
import { MAX_WILDLIFE, wildlifeRandom } from './wildlife-state.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { TICKS_PER_DAY, type Cell, type World } from './types.ts';

/** Core 1.6.4871 life-stage ages are years of 60 days. */
const YEAR=TICKS_PER_DAY*60;
export const juvenileAgeTicks=(species:AnimalSpeciesId):number=>isAnimalSpecies256(species)?animalStageAgeTicks256(species,'juvenile'):Math.round((species==='muffalo'||species==='dromedary'?.25:.1)*YEAR);
export const adultAgeTicks=(species:AnimalSpeciesId):number=>isAnimalSpecies256(species)?animalStageAgeTicks256(species,'adult'):Math.round((species==='deer'||species==='muffalo'||species==='dromedary'||species==='red-fox'?.3333:.2222)*YEAR);
export const gestationTicks=(species:AnimalSpeciesId):number=>isAnimalSpecies256(species)?animalGestationTicks256(species)??0:Math.round((species==='muffalo'||species==='dromedary'?6.66:5.661)*TICKS_PER_DAY);
export const animalLifeStage=(a:WildAnimal):'baby'|'juvenile'|'adult'=>a.growthTracker?({AnimalAdult:'adult',AnimalBaby:'baby',AnimalBabyTiny:'baby',AnimalJuvenile:'juvenile',EusocialInsectLarva:'baby',EusocialInsectJuvenile:'juvenile',EusocialInsectAdult:'adult'} as const)[trackedAnimalLifeStage256(a.species,a.growthTracker).definition]:a.ageTicks>=adultAgeTicks(a.species)?'adult':a.ageTicks>=juvenileAgeTicks(a.species)?'juvenile':'baby';
export const bodySizeAtAge=(species:AnimalSpeciesId,ageTicks:number,growth?:number):number=>growth!==undefined?trackedAnimalBodySize256(species,{value:growth}):isAnimalSpecies256(species)?animalBodySize256(species,ageTicks):animalSpecies(species).bodySize*
  (ageTicks>=adultAgeTicks(species)?1:ageTicks>=juvenileAgeTicks(species)?.5:.2);
export const animalBodySize=(a:WildAnimal):number=>bodySizeAtAge(a.species,a.ageTicks,a.growthTracker?.value);
export const animalNutritionMax=(a:WildAnimal):number=>a.growthTracker?trackedAnimalNutritionMaximum256(a.species,a.growthTracker):isAnimalSpecies256(a.species)?animalNutritionMax256(a.species,a.ageTicks):animalSpecies(a.species).nutrition*({baby:.6,juvenile:.75,adult:1} as const)[animalLifeStage(a)];
export const animalFoodPerDay=(a:WildAnimal):number=>isAnimalSpecies256(a.species)?animalFoodPerDay256(a.species,a.ageTicks,a.growthTracker?.value):a.growthTracker?actualAnimalProfile256(a).foodPerDay*trackedAnimalLifeStage256(a.species,a.growthTracker).hungerRateFactor:animalSpecies(a.species).foodPerDay*({baby:.4,juvenile:.75,adult:1} as const)[animalLifeStage(a)];

/** The same four hunger bands used by Core body-resource and gestation growth. */
export function animalFoodWantEat256(a:WildAnimal):number {const d=animalDietFlags256(a.species);return d===undefined?animalSpecies(a.species).predator?.3:.45:(d&0x80)!==0?.45:(d&2)!==0?.3:(d&0x20)!==0?.4:.45;}
export function animalGrowthFactor(a:WildAnimal):number {
 if(a.growthTracker){const ratio=Math.fround(a.food/animalNutritionMax(a)),want=Math.fround(animalFoodWantEat256(a));return a.food<=0?0:ratio<Math.fround(want*Math.fround(.4))?.25:ratio<Math.fround(want*Math.fround(.8))?.5:1;}
  const reserve=a.food/animalNutritionMax(a);
  return reserve<=0?0:reserve<.18?.25:reserve<.36?.5:1;
}

const touching=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
const navigation=(world:World,a:WildAnimal)=>animalNavigation(world,false,isAnimalSpecies256(a.species)?animalCore256(a.species).race.roamMtbDays===null:a.species==='hare'||a.species==='snow-hare');
const fertile=(a:WildAnimal):boolean=>(!isAnimalSpecies256(a.species)||!animalCore256(a.species).race.disableMating)&&!!a.domestic&&animalLifeStage(a)==='adult'&&a.state!=='dead'&&a.state!=='downed'
  &&a.state!=='sleeping'&&!a.confusion&&!a.stun&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike;
const femaleAvailable=(a:WildAnimal):boolean=>a.sex==='female'&&fertile(a)&&!a.pregnancy&&(isEggSpecies256(a.species)?!!a.eggLayer&&a.eggLayer.fertilizations<ANIMAL_EGG_CONTENT_256[a.species].fertilizationMaximum:gestationTicks(a.species)>0);
const hash=(a:number,b:number,c:number):number=>{
  let n=(a^Math.imul(b,0x9e3779b1)^Math.imul(c,0x85ebca6b))>>>0;
  n^=n>>>16;n=Math.imul(n,0x7feb352d);n^=n>>>15;n=Math.imul(n,0x846ca68b);n^=n>>>16;
  return (n>>>0)/0x100000000;
};
const event=(world:World,message:string)=>{world.events.push({tick:world.tick,type:'need',message});if(world.events.length>80)world.events.splice(0,world.events.length-80);};

/** New arrivals remain adults; newborns alone begin at age zero. */
export function advanceAnimalLife(world:World):void {
  const s=world.wildlife;if(!s)return;
  const residents=s.animals.slice();
  const byId=new Map(residents.map(a=>[a.id,a]));
  const claimed=new Set<number>();
  const handled=new Set<number>();
  for(const pawn of world.pawns){
    if(pawn.animalHandling)for(const id of leadingClaimIds(pawn.animalHandling))handled.add(id);
    if(pawn.animalCare)handled.add(pawn.animalCare.animalId);
    if(pawn.animalFeed)handled.add(pawn.animalFeed.animalId);
    if(pawn.animalRescue)handled.add(pawn.animalRescue.animalId);
  }
  for(const male of residents)if(male.mating)claimed.add(male.mating.femaleId);
  let routeBudget=1;
  for(const a of residents){
    if(a.state==='dead')continue;
    if(!a.growthTracker&&!isAnimalSpecies256(a.species)&&a.ageTicks<Number.MAX_SAFE_INTEGER)a.ageTicks++;
    if(a.ageTicks===adultAgeTicks(a.species)&&a.domestic&&(a.species==='muffalo'||a.species==='dromedary'&&a.sex==='female'))
      a.domestic.productFullness??=0;
    if(a.pregnancy){
      const factor=animalGrowthFactor(a);
      const accrue=factor===1||factor===.5&&(world.tick+a.id)%2===0||factor===.25&&(world.tick+a.id)%4===0;
      if(accrue)a.pregnancy.progress=Math.min(gestationTicks(a.species),a.pregnancy.progress+1);
      if(a.pregnancy.progress>=gestationTicks(a.species))birth(world,a);
    }
  }
  for(const male of residents){
    if(!male.mating)continue;
    const female=byId.get(male.mating.femaleId);
    if(!fertile(male)||male.sex!=='male'||handled.has(male.id)||!female||handled.has(female.id)
      ||!femaleAvailable(female)||male.species!==female.species){
      delete male.mating;male.path=[];continue;
    }
    if((male.motion?.end??0)>world.tick||(female.motion?.end??0)>world.tick)continue;
    if(touching(male,female)){
      male.path=[];female.path=[];
      if(++male.mating.progress>=50){
        delete male.mating;
        if(isEggSpecies256(female.species))female.eggLayer=fertilizeEggLayer256(female.eggLayer!,female.species,male.id);
        else if(wildlifeRandom(s)<.5)female.pregnancy={fatherId:male.id,progress:0};
      }
      continue;
    }
    male.mating.progress=0;
    if(male.path.length||!routeBudget)continue;
    routeBudget--;
    const nav=navigation(world,male);
    const pen=grazingPen(world,male);
    const goals=[{x:female.x-1,z:female.z},{x:female.x+1,z:female.z},{x:female.x,z:female.z-1},{x:female.x,z:female.z+1}]
      .filter(c=>!pen||pen.has(c.z*world.width+c.x));
    const path=nav.route(male,goals);
    if(path?.length){male.path=path;male.state='moving';male.nextDecision=world.tick;}
    else {delete male.mating;male.path=[];male.nextDecision=world.tick+10;}
  }
  for(const male of residents){
    if(male.sex!=='male'||!fertile(male)||handled.has(male.id)||male.mating||male.meal||male.path.length||(male.motion?.end??0)>world.tick)continue;
    if(world.tick%250!==male.id%250)continue;
    const mtb=isAnimalSpecies256(male.species)?animalCore256(male.species).race.mateMtbHours:male.species==='hare'||male.species==='snow-hare'?8:12;
    if(hash(world.seed,male.id,Math.floor(world.tick/250))>=1-Math.exp(-1/mtb))continue;
    let female:WildAnimal|undefined,nearest=Infinity;
    for(const candidate of residents){
      if(!femaleAvailable(candidate)||handled.has(candidate.id)||candidate.species!==male.species||claimed.has(candidate.id))continue;
      const distance=(male.x-candidate.x)**2+(male.z-candidate.z)**2;
      if(distance<=900&&(distance<nearest||distance===nearest&&candidate.id<(female?.id??Infinity))){female=candidate;nearest=distance;}
    }
    if(!female)continue;
    male.mating={femaleId:female.id,progress:0};claimed.add(female.id);
  }
}

/** Core hare litterSizeCurve (1,0) (1.5,1) (2,1) (2.5,0), rounded: one baby
 * 25 %, two 75 % from schema 315 (one draw, as before; older chance 50 %). */
export const hareSecondBabyChance315=(version:number):number=>version>=315?.75:.5;
function birth(world:World,mother:WildAnimal):void {
  if(isAnimalSpecies256(mother.species)){birth256(world,mother);return;}
  const s=world.wildlife!,pregnancy=mother.pregnancy!;
  const available=Math.min(MAX_WILDLIFE-s.animals.length,world.nextId<=Number.MAX_SAFE_INTEGER-2?2:0);
  if(available<=0)return;
  const pen=grazingPen(world,mother),nav=navigation(world,mother);
  const occupied=new Set(s.animals.map(a=>a.z*world.width+a.x));
  for(const pawn of world.pawns)occupied.add(pawn.z*world.width+pawn.x);
  const places:Cell[]=[];
  for(let radius=1;radius<=1&&places.length<available;radius++)
    for(let z=mother.z-radius;z<=mother.z+radius&&places.length<available;z++)for(let x=mother.x-radius;x<=mother.x+radius&&places.length<available;x++){
      if(Math.max(Math.abs(x-mother.x),Math.abs(z-mother.z))!==radius)continue;
      const c={x,z},key=z*world.width+x;
      if((!pen||pen.has(key))&&nav.free(c)&&!occupied.has(key)){places.push(c);occupied.add(key);}
    }
  if(!places.length)return;
  const litter=mother.species==='hare'||mother.species==='snow-hare'?1+(wildlifeRandom(s)<hareSecondBabyChance315(world.schemaVersion)?1:0):1;
  const births=places.slice(0,litter);
  for(const place of births){
    const child:WildAnimal={id:world.nextId++,species:mother.species,sex:wildlifeRandom(s)<.5?'female':'male',ageTicks:0,
      parents:{motherId:mother.id,fatherId:pregnancy.fatherId},x:place.x,z:place.z,
      food:animalSpecies(mother.species).nutrition*.6*.45,rest:1,state:'idle',path:[],nextDecision:world.tick+1};
    if(world.schemaVersion>=256)attachNewbornAnimalGrowth256(child,world.tick*10,world.schemaVersion);
    if(mother.domestic)child.domestic={since:world.tick,care:mother.domestic.care,tameness:mother.domestic.tameness,
      nextDecay:mother.domestic.nextDecay,...mother.domestic.penMarkerId!==undefined?{penMarkerId:mother.domestic.penMarkerId}:{}};
    s.animals.push(child);
  }
  delete mother.pregnancy;
  event(world,`${animalSpecies(mother.species).label} ${mother.id} a mis bas ${births.length} petit${births.length>1?'s':''}.`);
}

/** Prospective species use their own litter curve. All babies need real free
 * places before the private sex/litter draws and IDs can commit together. */
function birth256(world:World,mother:WildAnimal):void {
 if(!isAnimalSpecies256(mother.species)||world.schemaVersion<256||!animalMechanicalReadiness256(mother.species).ok)return;
 const s=world.wildlife!,pregnancy=mother.pregnancy!,randomOwner={...s};
 const count=drawAnimalLitter256(mother.species,()=>wildlifeRandom(randomOwner));
 if(s.animals.length+count>MAX_WILDLIFE||!Number.isSafeInteger(world.nextId+count))return;
 const pen=grazingPen(world,mother),nav=navigation(world,mother),occupied=new Set([...s.animals,...world.pawns].map(a=>a.z*world.width+a.x)),places:Cell[]=[];
 for(let radius=0;radius<=3&&places.length<count;radius++)for(let z=mother.z-radius;z<=mother.z+radius&&places.length<count;z++)for(let x=mother.x-radius;x<=mother.x+radius&&places.length<count;x++){
  const key=z*world.width+x;if(Math.max(Math.abs(x-mother.x),Math.abs(z-mother.z))!==radius||occupied.has(key)||pen&&!pen.has(key)||!nav.free({x,z}))continue;
  places.push({x,z});occupied.add(key);
 }
 if(places.length!==count)return;
 for(const place of places){
  const child:WildAnimal={id:world.nextId++,species:mother.species,sex:wildlifeRandom(randomOwner)<.5?'female':'male',ageTicks:0,
   parents:{motherId:mother.id,fatherId:pregnancy.fatherId},...place,food:0,rest:1,state:'idle',path:[],nextDecision:world.tick+1};
  attachNewbornAnimalGrowth256(child,world.tick*10,world.schemaVersion);child.food=animalNutritionMax(child)*.45;
  if(mother.domestic)child.domestic={since:world.tick,care:mother.domestic.care,tameness:mother.domestic.tameness,nextDecay:mother.domestic.nextDecay,...mother.domestic.penMarkerId!==undefined?{penMarkerId:mother.domestic.penMarkerId}:{}};
  s.animals.push(child);
 }
 s.rng=randomOwner.rng;delete mother.pregnancy;
 event(world,`${animalSpecies(mother.species).label} ${mother.id} a mis bas ${count} petit${count>1?'s':''}.`);
}
