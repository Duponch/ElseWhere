import {afterEach,expect,test,vi} from 'vitest';
import {advanceAnimalAges256,createAnimalMedicalRecord256} from '../src/sim/animal-clinical-age-v256.ts';
import {advanceLocalTrackedAnimalAge379,attachGeneratedAnimalGrowth256,attachNewbornAnimalGrowth256,trackedAnimalBodySize256,trackedAnimalLifeStage256,trackedAnimalNutritionMaximum256} from '../src/sim/animal-growth-runtime-256.ts';
import {animalGrowthFactor,animalNutritionMax} from '../src/sim/animal-life.ts';
import {INITIAL_ANIMAL_FACTS_256} from '../src/sim/initial-animal-data-256.ts';
import {CORE_ANIMAL_DATA_256,CORE_ANIMAL_LIFE_STAGES_256} from '../src/sim/animal-core-data-v256.ts';
import {advanceSocial} from '../src/sim/social.ts';
import {detachMissingMacroWorkBills379} from '../src/sim/unfinished-bill-pass-379.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {localWorldGroups,pawnWorldGroup} from '../src/sim/world-map-context.ts';
import {backgroundTagRefusal,childhoodDefinition,adulthoodDefinition,CHILDHOODS,ADULTHOODS,type BackgroundWorkTag,type ChildhoodId,type AdulthoodId} from '../src/sim/colonist-backgrounds.ts';
import {createWorld} from '../src/sim/engine.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {setTerrainWriteCacheVerification} from '../src/sim/terrain-mutation-journal.ts';
import type {WildAnimal} from '../src/sim/wildlife-state.ts';
import type {MaterialPile,World} from '../src/sim/types.ts';

afterEach(()=>{setTerrainWriteCacheVerification(false);vi.restoreAllMocks();});

test('compiled species stage, size and nutrition columns preserve every literal rounded source boundary',()=>{
 const f=Math.fround;
 for(const fact of Object.values(INITIAL_ANIMAL_FACTS_256)){
  const species=fact.species,adult=fact.stages.at(-1)!.minAgeYears;
  const values=[0,1,f(.03),f(.33),f(.75),...fact.stages.flatMap(s=>[-.000002,0,.000002].map(delta=>f(Math.max(0,Math.min(1,s.minAgeYears/adult+delta)))))];
  for(const value of values){
   const boundary=f(f(f(adult)*value)+f(.000001));let index=0;
   for(let i=fact.stages.length-1;i>=0;i--)if(f(fact.stages[i]!.minAgeYears)<=boundary){index=i;break;}
   const explicit=Object.hasOwn(CORE_ANIMAL_DATA_256,species)?CORE_ANIMAL_DATA_256[species as keyof typeof CORE_ANIMAL_DATA_256]:undefined;
   const definition=explicit?.lifeStages[index]!.defId??(index===fact.stages.length-1?'AnimalAdult':index===0?'AnimalBaby':'AnimalJuvenile'),stage=CORE_ANIMAL_LIFE_STAGES_256[definition];
   const body=f(f(fact.baseBodySize)*f(stage.bodySizeFactor)),max=f(f(f(explicit?.stats.MaxNutrition??1)*body)*f(stage.foodMaxFactor));
   expect(trackedAnimalLifeStage256(species,{value})).toEqual({definition,index,minimumAgeTicks:Math.round(fact.stages[index]!.minAgeYears*360000),...stage});
   expect(trackedAnimalBodySize256(species,{value})).toBe(body);expect(trackedAnimalNutritionMaximum256(species,{value})).toBe(max);
  }
 }
});

function animal(id:number,ageTicks:number):WildAnimal {
 const a:WildAnimal={id,species:'hare',sex:'female',x:1,z:1,ageTicks,food:0,rest:1,state:'idle',path:[],nextDecision:0};
 if(ageTicks)attachGeneratedAnimalGrowth256(a,1000,256);else attachNewbornAnimalGrowth256(a,1000,256);
 a.food=animalNutritionMax(a)*.1;return a;
}
test('closed local age defers Food-category calculation only until the real juvenile deadline and rejects malformed owners',()=>{
 const a=animal(15,0),read=vi.fn(animalGrowthFactor),owner={};
 withJournalTerrainReadScope(owner,()=>{advanceLocalTrackedAnimalAge379(a,1010,read);expect(read).not.toHaveBeenCalled();advanceLocalTrackedAnimalAge379(a,1240,read);expect(read).toHaveBeenCalledTimes(1);});
 expect(a.ageTicks).toBe(2);expect(a.growthTracker!.nextCheckCore).toBe(1480);expect(a.growthTracker!.value).toBeGreaterThan(0);
 const bad=structuredClone(a);bad.food=animalNutritionMax(bad)+1;
 expect(()=>withJournalTerrainReadScope(owner,()=>advanceLocalTrackedAnimalAge379(bad,1250,read))).toThrow('Invalid actual animal age call');
 const expired=structuredClone(a);expired.health=createAnimalMedicalRecord256({tick:124,schemaVersion:256},expired);expired.health.animalGrowth=1;
 expect(()=>withJournalTerrainReadScope(owner,()=>advanceLocalTrackedAnimalAge379(expired,1250,read))).toThrow('Invalid actual animal age call');
});
test('the real local macro retains identical age, clinical headers, terminal deadlines and birthday RNG',()=>{
 const baby=animal(1,0),adult=animal(2,359999),nearStage=animal(3,35999),terminal=animal(4,400000);adult.health=createAnimalMedicalRecord256({tick:100,schemaVersion:379},adult);nearStage.health=createAnimalMedicalRecord256({tick:100,schemaVersion:379},nearStage);terminal.state='dead';
 const current={tick:100,schemaVersion:379,rng:234987,wildlife:{animals:[baby,adult,nearStage,terminal]}},literal=structuredClone(current),owner={};
 for(let tick=101;tick<=180;tick++){current.tick=literal.tick=tick;advanceAnimalAges256(literal);withJournalTerrainReadScope(owner,()=>advanceAnimalAges256(current));expect(current).toEqual(literal);}
 expect(current.wildlife.animals[0]!.ageTicks).toBe(80);expect(current.wildlife.animals[3]!.ageTicks).toBe(400000);
});

test('synchronous paged social candidates preserve literal source order, live eligibility, and every social draw',()=>{
 const w=createWorld(42,32,32);w.width=128;w.height=128;w.tiles=Array.from({length:w.width*w.height},()=>({terrain:'grass'}));w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.tick=1000;
 const seed=w.pawns[0]!;const base=10000+((91-((w.tick*10+10000)%91))%91);
 w.pawns=Array.from({length:80},(_,i)=>{const p=structuredClone(seed);Object.assign(p,{id:base+i*91,x:2+(i%10)*11,z:3+Math.floor(i/10)*11,state:'idle',motion:null,path:[],jobId:null,need:null,social:{rng:17+i,memories:[],wants:true as const}});return p;});
 // The first two eligible queries have no neighbours. Query #3 sees later
 // source ordinals across different spatial buckets and excludes a sleeper.
 w.pawns[2]!.x=30;w.pawns[2]!.z=20;w.pawns[30]!.x=31;w.pawns[30]!.z=22;w.pawns[9]!.x=27;w.pawns[9]!.z=20;w.pawns[8]!.x=29;w.pawns[8]!.z=20;w.pawns[8]!.state='sleeping';
 w.nextId=base+100*91;const literal=structuredClone(w),owner={};
 setTerrainWriteCacheVerification(true);
 for(let tick=1000;tick<1020;tick++){w.tick=literal.tick=tick;advanceSocial(literal);withJournalTerrainReadScope(owner,()=>advanceSocial(w));expect(w).toEqual(literal);}
 expect(w.pawns.some(p=>p.social?.last)).toBe(true);
});

test('one macro captures all seven missing work-bill families in the same order, including packed bills and duplicate links',()=>{
 const keys=['unfinished','smithingWork','gunWork','flakWork','artWork','componentWork','prostheticWork273'] as const;
 const piles:MaterialPile[]=keys.flatMap((key,i)=>[8,9,10,0].map((billId,n)=>({id:i*10+n+100,kind:'unfinished',item:'unfinished-sculpture',quantity:1,owner:{type:'ground',x:4,z:4},[key]:{billId,progress:7}} as unknown as MaterialPile)));
 const multi={...piles[0],id:900,unfinished:{billId:7},smithingWork:{billId:10},artWork:{billId:9}} as unknown as MaterialPile;piles.push(multi);
 const w={piles,structures:[{bills:[{id:8}]}],packed:[{building:{bills:[{id:9}]}}]} as unknown as World,expected=structuredClone(w);
 detachMissingMacroWorkBills379(expected);
 const scans=vi.spyOn(w.piles,'some');withJournalTerrainReadScope({},()=>detachMissingMacroWorkBills379(w));
 expect(scans).not.toHaveBeenCalled();expect(w).toEqual(expected);expect(multi.unfinished?.billId).toBeUndefined();expect(multi.artWork?.billId).toBe(9);expect(multi.smithingWork?.billId).toBeUndefined();
});

test('closed stock refresh allocates balances only for actual changes; exact public projection includes unknown and removed job deliveries',()=>{
 const w={stock:{wood:7,food:1},pawns:[],jobs:[{id:1,escrow:{wood:0,food:0}},{id:2,escrow:{wood:7,food:0}},{id:3,escrow:{wood:0,food:1}}],piles:[
  {id:4,kind:'wood',item:'wood',quantity:4,owner:{type:'ground',x:1,z:1}},
  {id:5,kind:'wood',item:'wood',quantity:7,owner:{type:'job',jobId:2}},
  {id:6,kind:'food',item:'rice',quantity:3,owner:{type:'job',jobId:999}},
 ]} as unknown as World,expected=structuredClone(w),unchanged=w.jobs[0]!.escrow,delivered=w.jobs[1]!.escrow;
 refreshStock(expected);withJournalTerrainReadScope({},()=>refreshStock(w));
 expect(w).toEqual(expected);expect(w.jobs[0]!.escrow).toBe(unchanged);expect(w.jobs[1]!.escrow).toBe(delivered);
 w.piles[1]!.quantity=2;expected.piles[1]!.quantity=2;refreshStock(expected);withJournalTerrainReadScope({},()=>refreshStock(w));
 expect(w).toEqual(expected);expect(w.jobs[1]!.escrow).not.toBe(delivered);
});

test('point group lookup follows direct membership replacements and both owner paths without filtering an array',()=>{
 const actual=[{originMapId:0,localMapId:0,state:{memberIds:[7,8]}},{originMapId:0,localMapId:1,state:{memberIds:[7]}}];
 const w={schemaVersion:382,tiles:[],worldGroups:{groups:actual}} as unknown as World;
 for(const id of [7,8,9])expect(pawnWorldGroup(w,id)).toBe(localWorldGroups(w).find(g=>'memberIds'in g.state&&g.state.memberIds.includes(id)));
 actual[0]!.state.memberIds=[9];expect(pawnWorldGroup(w,7)).toBeUndefined();expect(pawnWorldGroup(w,9)).toBe(actual[0]);
 const projection={schemaVersion:382,campaignMap:{revision:2,activeMapId:1,groups:actual}} as unknown as World;
 expect(pawnWorldGroup(projection,7)).toEqual(localWorldGroups(projection)[0]);
 expect(pawnWorldGroup(projection,9)).toBeUndefined();
});

test('compiled immutable background refusal table preserves story precedence and sees the next actual background',()=>{
 const tags=['manual-dumb','manual-skilled','caring','social','intellectual','plant-work','artistic','animals','hunting','violent','firefighting'] as const satisfies readonly BackgroundWorkTag[];
 for(const child of Object.keys(CHILDHOODS) as ChildhoodId[])for(const adult of Object.keys(ADULTHOODS) as AdulthoodId[])for(const tag of tags){
  const c=childhoodDefinition(child),a=adulthoodDefinition(adult),cause=c.disables.includes(tag)?c:a.disables.includes(tag)?a:undefined;
  expect(backgroundTagRefusal({background:{childhood:child,adulthood:adult}},tag)).toBe(cause?`Incapacité liée au passé : ${cause.label}.`:undefined);
 }
 const p={background:{childhood:'quiet-child' as ChildhoodId}};expect(backgroundTagRefusal(p,'violent')).toBeDefined();p.background.childhood='settlement-child';expect(backgroundTagRefusal(p,'violent')).toBeUndefined();
 expect(backgroundTagRefusal({background:p.background,traits:['pyromaniac']},'firefighting')).toContain('trait');
});
