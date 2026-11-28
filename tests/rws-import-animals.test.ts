import {readFileSync} from 'node:fs';
import {describe,it,expect,beforeAll} from 'vitest';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave,ImportContext} from '../src/import/rimworld/convert.ts';
import {parseXml} from '../src/import/rimworld/xml.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {importAnimalDesignations} from '../src/import/rimworld/import-animal-jobs.ts';
import {validateWorld,serializeCampaignUnchecked,deserializeCampaign} from '../src/sim/serialization.ts';
import {gestationTicks} from '../src/sim/animal-life.ts';
import {animalPartId256} from '../src/sim/animal-anatomy-v256.ts';
import {readAnimalTraining282} from '../src/sim/animal-training-282.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';

const base=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
const animal=(def:string,id:number,x:number,z:number,contents:string,female=false,age=8_000_009,growth=1)=>
 `<thing Class="Pawn"><def>${def}</def><id>${def}${id}</id><map>0</map><pos>(${x}, 0, ${z})</pos><faction>Faction_1</faction>${female?'<gender>Female</gender>':''}
 <ageTracker><ageBiologicalTicks>${age}</ageBiologicalTicks><growth>${growth}</growth><nextGrowthCheckTick>9223372036854775807</nextGrowthCheckTick></ageTracker>${contents}</thing>`;

describe('native animal state from RimWorld',()=>{
 let conversion:ReturnType<typeof convertRwsSave>;
 const more=[
  // Deliberately child first, before both actual parents in XML map order.
  animal('Bison',103,17,9,'<social><directRelations><li><def>Parent</def><otherPawn>Thing_Bison101</otherPawn></li><li><def>Parent</def><otherPawn>Thing_Bison102</otherPawn></li></directRelations></social><jobs><curJob><def>GotoWander</def><targetA>(19,0,9)</targetA></curJob></jobs>',true,100_003,.02),
  animal('Bison',102,17,8,`<woolGrowth>0.62</woolGrowth><needs><needs><li><def>Food</def><curLevel>1.1</curLevel></li><li><def>Rest</def><curLevel>0.23</curLevel></li></needs></needs>
  <playerSettings><medCare>Best</medCare></playerSettings><healthTracker><hediffSet><hediffs>
  <li Class="Hediff_Pregnant"><def>Pregnant</def><father>Thing_Bison101</father><severity>0.42</severity></li>
  <li Class="Hediff_Injury"><def>Gunshot</def><part><body>QuadrupedAnimalWithHooves</body><index>0</index></part><severity>5</severity><isPermanent>True</isPermanent><painCategory>LowPain</painCategory></li>
  </hediffs></hediffSet></healthTracker>`,true),
  animal('Bison',101,18,8,'<woolGrowth>0.35</woolGrowth><jobs><curJob><def>Wait_Wander</def><startTick>359950</startTick><expiryInterval>120</expiryInterval></curJob></jobs>'),
  animal('Duck',104,16,8,''),
  animal('Duck',105,16,9,'<eggProgress>0.708333373</eggProgress><fertilizationCount>1</fertilizationCount><fertilizedBy>Thing_Duck104</fertilizedBy>',true),
  animal('Tortoise',106,18,10,`<mindState><nextMoveOrderIsWait>True</nextMoveOrderIsWait></mindState><jobs><curJob><def>LayDown</def><targetA>(18,0,10)</targetA></curJob><curDriver><asleep>True</asleep></curDriver></jobs><healthTracker><hediffSet><hediffs>
   <li Class="HediffWithComps"><def>Asthma</def><severity>0.00559637696</severity><part><body>TurtleLike</body><index>7</index></part><ageTicks>1371</ageTicks><tendTicksLeft>426124</tendTicksLeft><tendQuality>0.0662654787</tendQuality><totalTendQuality>0.0662654787</totalTendQuality></li></hediffs></hediffSet></healthTracker>`),
  animal('Bison',107,15,10,'<jobs><curJob><def>Mate</def><targetA>Thing_Bison108</targetA></curJob><curDriver><curToilIndex>1</curToilIndex><ticksLeftThisToil>205</ticksLeftThisToil></curDriver></jobs>'),
  animal('Bison',108,16,10,'<jobs><curJob><def>Wait_MaintainPosture</def></curJob></jobs>',true),
  '<thing Class="Building"><def>PenMarker</def><id>PenMarker900</id><map>0</map><pos>(18, 0, 11)</pos><faction>Faction_1</faction><stuff>WoodLog</stuff><animalFilter><allowedDefs><li>Duck</li><li>Bison</li></allowedDefs></animalFilter></thing>',
 ].join('');
 beforeAll(()=>{
  const source=base.replace('</things>',`${more}</things><autoSlaughterManager><configs><li><animal>Hare</animal><maxMales>2</maxMales></li><li><animal>Bison</animal><maxFemales>3</maxFemales></li></configs></autoSlaughterManager>`)
   .replace('<training><learned><vals><li>True</li><li>False</li><li>False</li><li>False</li><li>True</li></vals></learned></training>',
   '<training><wantedTrainables><vals><li>True</li><li>True</li><li>True</li><li>True</li><li>True</li></vals></wantedTrainables><steps><vals><li>3</li><li>2</li><li>2</li><li>7</li><li>5</li></vals></steps><learned><vals><li>True</li><li>True</li><li>True</li><li>True</li><li>True</li></vals></learned></training>')
   .replace('<playerSettings><master>Thing_Human2</master></playerSettings>',
    '<healthTracker><hediffSet><hediffs><li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>QuadrupedAnimalWithPawsAndTail</body><index>1</index></part><ageTicks>9000000</ageTicks><tendTicksLeft>1</tendTicksLeft><tendQuality>0.8</tendQuality></li><li Class="Hediff_MissingPart"><def>MissingBodyPart</def><part><body>QuadrupedAnimalWithPawsAndTail</body><index>18</index></part><ageTicks>5000000</ageTicks><isFresh>True</isFresh></li></hediffs></hediffSet></healthTracker><playerSettings><master>Thing_Human2</master></playerSettings><carryTracker><innerContainer><innerList><li Class="ThingWithComps"><def>WoodLog</def><id>WoodLog991</id><pos>(15,0,6)</pos><stackCount>7</stackCount><health>90</health></li></innerList></innerContainer></carryTracker><jobs><curJob><def>HaulToCell</def><targetA>Thing_WoodLog991</targetA><targetB>(11,0,11)</targetB><count>7</count><startTick>359200</startTick></curJob></jobs>');
  conversion=convertRwsSave(readRwsSave(source),{planet:false});
 });
 const byId=(id:string):WildAnimal=>conversion.world.wildlife!.animals.find(a=>a.id===conversion.thingIds.get(id))!;
 it('keeps male default, precise Core age/growth, nutrition units, rest, product and care',()=>{
  const father=byId('Bison101'),mother=byId('Bison102'),child=byId('Bison103');
  expect(father.sex).toBe('male');expect(mother.sex).toBe('female');
  expect(father.ageTicks*10+father.ageCoreRemainder!).toBe(8_000_009);
  expect(child.ageTicks*10+child.ageCoreRemainder!).toBe(100_003);
  expect(child.growthTracker?.value).toBe(Math.fround(.02));
  expect(mother.food).toBe(1.1);expect(mother.rest).toBe(.23);
  expect(mother.domestic).toMatchObject({care:'best',productFullness:.62});
 });
 it('resolves real parents independently of map order and retains pregnancy',()=>{
  const father=byId('Bison101'),mother=byId('Bison102'),child=byId('Bison103');
  expect(child.parents).toEqual({fatherId:father.id,motherId:mother.id});
  expect(mother.pregnancy).toEqual({fatherId:father.id,progress:Math.round(.42*gestationTicks(mother.species))});
 });
 it('uses the exact native anatomy and retained scar injury',()=>{
  const mother=byId('Bison102');
  expect(mother.health?.injuries).toEqual([expect.objectContaining({part:animalPartId256('QuadrupedAnimalWithHooves',0),kind:'gunshot',severity:5000,scar:{threshold:5000,pain:1}})]);
  const husband=byId('Husky1');
  expect(husband.health?.missing.map(p=>p.part)).toEqual(['tail','nose']);
  expect(husband.health?.missing[0]).toMatchObject({part:'tail',tended:true});
 });
 it('retains a chronic disease on the original native anatomical part and its tend receipt',()=>{
  const a=byId('Tortoise106');
  expect(a.wander?.nextMoveOrderIsWait).toBe(true);
  expect(a.health?.animalAgeConditions?.cases).toEqual([expect.objectContaining({kind:'Asthma',part:animalPartId256('TurtleLike',7),severity:Math.fround(.00559637696),
   tend:{ticksLeft:426124,quality:Math.fround(.0662654787),totalQuality:Math.fround(.0662654787)}})]);
 });
 it('rebinds true animal wander wait, navigation destination, sleep and mating progress',()=>{
  const father=byId('Bison101'),child=byId('Bison103'),tortoise=byId('Tortoise106'),mate=byId('Bison107');
  expect(father.wander?.job).toMatchObject({kind:'wait'});
  expect(child.wander?.job).toEqual({kind:'goto',destination:{x:19,z:10}});
  expect(child.path.at(-1)).toEqual({x:19,z:10});
  expect(tortoise.state).toBe('sleeping');
  expect(mate.mating).toEqual({femaleId:byId('Bison108').id,progress:29});
 });
 it('retains laying progress, fertilization count and actual father',()=>{
  const father=byId('Duck104'),mother=byId('Duck105');
  expect(mother.eggLayer).toEqual({progress:.708333373,fertilizations:1,fatherId:father.id});
 });
 it('keeps actual trained transport and obedience independently of the immutable bond receipt',()=>{
  const husky=byId('Husky1');
  expect(readAnimalTraining282(husky,'obedience')).toMatchObject({steps:3,learned:true,wanted:true});
  expect(readAnimalTraining282(husky,'haul')).toMatchObject({steps:7,learned:true,wanted:true});
  const bruno=conversion.thingIds.get('Human2');
  expect(husky.training?.masterId).toBe(bruno);expect(husky.startingPet?.bondedPawnId).toBe(bruno);
  const carryId=conversion.thingIds.get('WoodLog991'),pile=conversion.world.piles.find(p=>p.id===carryId);
  expect(pile).toMatchObject({quantity:7,owner:{type:'inventory',pawnId:husky.id}});
  expect(husky.haul).toMatchObject({phase:'deliver',sourcePileId:carryId,carryPileId:carryId,quantity:7,pickupCell:{x:15,z:13}});
 });
 it('only admits automatic-slaughter policies represented by the present game model',()=>{
  expect(conversion.world.autoSlaughter).toEqual([{species:'hare',maxTotal:-1,maxMales:2,maxMalesYoung:-1,maxFemales:-1,maxFemalesYoung:-1,allowPregnant:false}]);
  expect([...conversion.notes.tallies.get('animals')!.values()].some(r=>r.def==='Bison: abattage automatique'&&r.status==='dropped')).toBe(true);
 });
 it('routes original animal designations through their native command admission',()=>{
  const save=readRwsSave(base),ctx=new ImportContext(save,save.maps[0]!,conversion.world,new ImportNotes(),false);
  for(const [source,id] of conversion.thingIds)ctx.thingIds.set(source,id);
  ctx.map.node.children.push(parseXml('<designationManager><allDesignations><li><def>Tame</def><target>Thing_Hare1</target></li><li><def>Slaughter</def><target>Thing_Bison102</target></li></allDesignations></designationManager>'));
  importAnimalDesignations(ctx);
  expect(byId('Hare1').taming?.designated).toBe(true);
  expect(byId('Bison102').domestic?.slaughter).toBe(true);
  expect(ctx.notes.summary('active-jobs').exact).toBe(2);
 });
 it('sets the actual pen marker acceptance before computing enclosed membership',()=>{
  const mark=conversion.world.structures.find(s=>s.id===conversion.thingIds.get('PenMarker900'));
  expect(mark?.pen?.accepted.slice().sort()).toEqual(['bison','duck']);
 });
 it('passes the current strict validation and exact round trip',()=>{
  expect(validateWorld(conversion.world)).toEqual([]);
  const save=serializeCampaignUnchecked(conversion.world);
  expect(serializeCampaignUnchecked(deserializeCampaign(save))).toBe(save);
 });
});
