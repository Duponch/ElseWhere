import {preparedSchema256} from './helpers/legacy-fixture-guards.ts';
import {describe,it,expect} from 'vitest';
import {huntingCamp} from './scenarios/hunting.ts';
import {STARTING_PET_FOUR_IDS_256} from '../src/sim/starting-pet-four-data-256.ts';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256.ts';
import {constructFreshInitialWildAnimal256} from '../src/sim/initial-animal-constructor-256.ts';
import {WorldGenerationRandom} from '../src/sim/world-generation-random.ts';
import {animalCore256} from '../src/sim/animal-core-v256.ts';
import {animalSpecies,isAnimalSpeciesInVersion} from '../src/sim/animal-species.ts';
import {animalBodyModel} from '../src/sim/body-model.ts';
import {animalNutritionMax,animalFoodPerDay} from '../src/sim/animal-life.ts';
import {createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256.ts';
import {validCaravanAnimalRecord256} from '../src/sim/group-animal-record-save-256.ts';
import {animalFoods,animalMealTarget} from '../src/sim/wildlife-food.ts';
import {validFodderTransport} from '../src/sim/fodder-save.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {advanceTameness} from '../src/sim/animal-handling.ts';
import {startingPetFourNoTamenessDecay256} from '../src/sim/starting-pet-four-tameness-256.ts';
import {isAnimalItem256} from '../src/sim/animal-items-v256.ts';
import {animalShape256} from '../src/render/animal-shape-v256.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import type {World} from '../src/sim/types.ts';

const ids=Object.values(STARTING_PET_FOUR_IDS_256);
const sourceRows=[
 ['Cat','cat',.32,.42,10,.15,.15,.4,'None','light-leather'],
 ['YorkshireTerrier','yorkshire-terrier',.32,.4,15,.15,.1,.3,'Intermediate','dog-leather'],
 ['LabradorRetriever','labrador-retriever',.75,1,12,.4,.25,.5,'Advanced','dog-leather'],
 ['Husky','husky',.86,1.05,12,.5,.25,.5,'Advanced','dog-leather'],
] as const;

/** Explicit lower endpoints of the admitted generator inputs, NOT a seed
 * comparison or a substituted fixed-age runtime. No nominal or bond draw here.
 * StartingAnimal875 owns ChanceRedress, actual registry, Full name and training. */
class LowerEndpoints extends WorldGenerationRandom {
 calls:string[]=[];constructor(){super(0);}
 override value(){this.calls.push('value');return 1;}
 override float(min:number,_max:number){this.calls.push('float');return Math.fround(min);}
 override integer(min:number,_max:number){this.calls.push('integer');return min;}
}

/** Existing true huntingCamp World, prepared without stepping or generating a
 * map. Reserve its real next ID and put this SAME constructor original at10,10.
 * Its true healthy clinical record is created only for the RAW owner checks. */
function prepared(def:typeof sourceRows[number][0]){
 const w=huntingCamp();preparedSchema256(w);w.resources=[];w.piles=[];
 const random=new LowerEndpoints(),made=constructFreshInitialWildAnimal256({fact:INITIAL_ANIMAL_FACTS_256[def],id:w.nextId,cell:{x:10,z:10},tick:w.tick,random});
 expect(made.status).toBe('ready');if(made.status!=='ready')throw Error('Lower source endpoint blocked: '+made.reason);
 const a=made.animal;w.nextId++;a.health=createAnimalMedicalRecord256(w,a);w.wildlife!.animals=[a];
 return {w,a,made,random};
}

describe('four real starting pets: native owners, food and identities',()=>{
 it.each(sourceRows)('%s keeps its own native facts, four tool groups and actual anatomy',(def,id,size,health,life,hunger,juvenile,adult,trainability,leather)=>{
  const core=animalCore256(id),profile=animalSpecies(id),model=animalBodyModel(id);
  expect(INITIAL_ANIMAL_FACTS_256[def].species).toBe(id);expect(core.coreDefId).toBe(def);
  expect(core.race.body).toBe('QuadrupedAnimalWithPawsAndTail');expect(core.race.baseBodySize).toBe(size);expect(core.race.baseHealthScale).toBe(health);
  expect(core.race.lifeExpectancy).toBe(life);expect(core.race.baseHungerRate).toBe(hunger);expect(core.race.trainability).toBe(trainability);
  expect(core.lifeStages.map(s=>s.minAgeYears)).toEqual([0,juvenile,adult]);expect(core.race.nuzzleMtbHours).toBe(12);expect(core.stats.Wildness).toBe(0);
  expect(core.tools.map(t=>t.linkedBodyPartsGroup)).toEqual(['FrontLeftPaw','FrontRightPaw','Teeth','HeadAttackTool']);
  expect(profile.melee).toHaveLength(4);profile.melee.forEach((tool,i)=>{expect(tool.sourceParts).toContain(tool.sourcePart);for(const part of tool.sourceParts!){expect(model.byId[part]).toBeDefined();expect(model.byId[part]!.groups).toContain(core.tools[i]!.linkedBodyPartsGroup);}});
  expect(model.parts.filter(p=>p.nativeDefId==='Leg')).toHaveLength(4);expect(model.parts.some(p=>p.nativeDefId==='Tail')).toBe(true);
  expect(profile.corpseItem).toBe(id+'-corpse');expect(profile.meatItem).toBe(id+'-meat');expect(profile.leatherItem).toBe(leather);
  expect(isAnimalItem256(profile.corpseItem)).toBe(true);expect(isAnimalItem256(profile.meatItem)).toBe(true);expect(isAnimalItem256('dog-leather')).toBe(true);
  expect(isAnimalSpeciesInVersion(id,255)).toBe(false);expect(isAnimalSpeciesInVersion(id,256)).toBe(true);
 });

 it.each(sourceRows)('%s uses the existing free-age constructor and retains its own growth clock',(def,id,_size,_health,life)=>{
  const {a,made,random,w}=prepared(def);
  // Need_Food then Need_Rest initial levels (two calls each), then the sex.
  expect(random.calls).toEqual(['float','float','float','float','value','float','float','value','integer','float','float','value']);
  const age=Math.trunc(Math.fround(Math.fround(Math.fround(.05)*Math.fround(life))*3600000));
  expect(made.ageCoreTicks).toBe(age);expect(a.ageTicks*10+a.ageCoreRemainder).toBe(age);expect(made.ageSamples).toBe(1);
  expect(a.species).toBe(id);expect(a.growthTracker!.value).toBe(1);expect(a.growthTracker!.nextCheckCore).toBe(w.tick*10+240);
  expect(a.health!.animalGrowth).toBe(a.growthTracker!.value);expect(a.food).toBe(Math.fround(.5*animalNutritionMax(a)));
  expect(a.caravanCarrySick).toBe(false);expect(Object.hasOwn(a,'name')).toBe(false);expect(a.domestic).toBeUndefined();
  // Generation has not also attached it to an off-map owner or invented875 training.
  expect(w.wildlife!.animals[0]).toBe(a);expect(a.id).toBe(w.nextId-1);
 });

 it.each(sourceRows)('%s admits exact native food max, rejects excess/255 and preserves the original',(def)=>{
  const {w,a}=prepared(def),context={context:{width:w.width,height:w.height},tick:w.tick,nextId:w.nextId,version:256};
  a.food=animalNutritionMax(a);expect(animalFoodPerDay(a)).toBeCloseTo(animalCore256(INITIAL_ANIMAL_FACTS_256[def].species).race.baseHungerRate*1.6,12);
  const raw:WildAnimal=JSON.parse(JSON.stringify(a)),before=JSON.stringify(raw);
  expect(validCaravanAnimalRecord256(raw,context)).toBe(true);expect(JSON.stringify(raw)).toBe(before);
  expect(validCaravanAnimalRecord256(raw,{...context,version:255})).toBe(false);
  raw.food+=.00001;const excess=JSON.stringify(raw);expect(validCaravanAnimalRecord256(raw,context)).toBe(false);expect(JSON.stringify(raw)).toBe(excess);
  expect(a.food).toBe(animalNutritionMax(a));expect(w.wildlife!.animals[0]).toBe(a);
 });

 it.each(sourceRows)('%s reserves actual kibble at the real ground owner without consuming stock remotely',(def)=>{
  const {w,a}=prepared(def);a.food=0;addMaterial(w,'food',75,{type:'ground',x:a.x,z:a.z},'kibble');
  const stock=w.piles.find(p=>p.item==='kibble')!,offer=animalFoods(w,a).find(p=>p.kind==='pile'&&p.id===stock.id);
  expect(offer).toBeDefined();expect(offer!.quantity).toBe(Math.ceil(animalNutritionMax(a)/.05));
  a.meal={kind:offer!.kind,id:offer!.id,quantity:offer!.quantity,progress:0};a.state='eating';expect(animalMealTarget(w,a)).toBe(stock.owner);
  const raw:World=JSON.parse(JSON.stringify(w)),before=JSON.stringify(raw);expect(validFodderTransport(raw,256)).toBe(true);expect(JSON.stringify(raw)).toBe(before);
  const held=raw.wildlife!.animals[0]!;expect(animalMealTarget(raw,held)).toEqual(stock.owner);held.meal!.quantity++;expect(validFodderTransport(raw,256)).toBe(false);
  expect(a.food).toBe(0);expect(stock.quantity).toBe(75);expect(w.wildlife!.animals[0]).toBe(a);
 });

 it('keeps zero-wildness Tameness and its deadline while preserving the old hare decay path',()=>{
  const {w,a}=prepared('Cat');w.tick=45000;a.domestic={since:0,care:'best',tameness:5,nextDecay:45000};
  const before=JSON.stringify(a.domestic);advanceTameness(w);expect(JSON.stringify(a.domestic)).toBe(before);expect(w.wildlife!.animals[0]).toBe(a);
  for(const id of ids)expect(startingPetFourNoTamenessDecay256(id)).toBe(true);expect(startingPetFourNoTamenessDecay256('hare')).toBe(false);expect(startingPetFourNoTamenessDecay256('cobra')).toBe(false);
  const old=huntingCamp();preparedSchema256(old);old.tick=45000;const hare=old.wildlife!.animals[0]!;hare.species='hare';hare.state='idle';hare.domestic={since:0,care:'best',tameness:5,nextDecay:45000};
  advanceTameness(old);expect(hare.domestic!.tameness).toBe(4);expect(hare.domestic!.nextDecay).toBe(90000);
 });

 it('uses four distinct original resident forms whose labels address real body parts',()=>{
  const shapes=ids.map(id=>animalShape256(id));expect(new Set(shapes.map(s=>JSON.stringify(s))).size).toBe(4);
  ids.forEach((id,index)=>{const model=animalBodyModel(id),shape=shapes[index]!;for(const p of shape.parts)expect(model.byId[p.bodyPart!]).toBeDefined();for(const r of shape.rings)expect(model.byId[r.part!]).toBeDefined();});
 });
});
