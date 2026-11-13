import { expect,test } from 'vitest';
import { APPAREL,APPAREL_FAMILIES,APPAREL_MATERIALS,apparelItemFor,newApparelState } from '../src/sim/apparel-rules';
import { validApparelShape } from '../src/sim/apparel-save';
import { advanceApparelPolicyCalendar,advanceApparelWear,createApparelPolicyCalendar,createApparelWearCalendar } from '../src/sim/apparel-renewal';
import { DEFAULT_APPAREL_POLICY,chooseApparelReplacement,createDefaultApparelPolicyRegistry,type ApparelPolicyCandidate,type ApparelPolicyGarment } from '../src/sim/apparel-policy';
import { validEquipmentShape } from '../src/sim/equipment-save';
import { PRODUCTION_RECIPES,recipeProduct,stationRecipe,stationRecipes,unfinishedItem } from '../src/sim/production-recipes';
import { validUnfinishedShape } from '../src/sim/unfinished';

const garment=(id:number,item:keyof typeof APPAREL,hitPoints=APPAREL[item].hitPoints):ApparelPolicyGarment=>({id,item,apparel:{...newApparelState(item),hitPoints}});
const candidate=(id:number,item:keyof typeof APPAREL,quality:'normal'|'excellent'='normal'):ApparelPolicyCandidate=>({
  ...garment(id,item),apparel:{...newApparelState(item),quality},stored:true,reachable:true,reserved:false,
});

test('five garment families have cloth and light-leather identities, stats and bounded recipes',()=>{
  const ids=new Set<string>();
  // The five historical families; schema 312 T-shirts and jackets are covered by garments-312.
  for(const family of APPAREL_FAMILIES.filter(f=>f!=='tshirt'&&f!=='jacket'))for(const material of ['cloth','light-leather'] as const){
    const item=apparelItemFor(family,material);ids.add(item);
    expect(APPAREL[item]).toMatchObject({family,material});
    expect(newApparelState(item)).toMatchObject({material,hitPoints:APPAREL[item].hitPoints});
    expect(recipeProduct(family,[{item:material}],material)).toBe(item);
    expect(unfinishedItem(family)).toBe(`unfinished-${family}`);
  }
  expect(ids.size).toBe(10);
  expect(apparelItemFor('tribalwear','cloth')).toBe('cloth-tribalwear');
  expect(apparelItemFor('shirt','cloth')).toBe('cloth-shirt');
  expect(APPAREL['light-leather-shirt'].ratings.sharp).toBeCloseTo(.108);
  expect(APPAREL['light-leather-shirt'].ratings.blunt).toBeCloseTo(.028);
  expect(PRODUCTION_RECIPES.pants).toMatchObject({units:40,workTicks:160});
  expect(PRODUCTION_RECIPES.duster).toMatchObject({units:80,workTicks:1000});
  expect(PRODUCTION_RECIPES.parka).toMatchObject({units:80,workTicks:800});
  expect(()=>recipeProduct('shirt',[{item:'cloth'},{item:'light-leather'}])).toThrow('one material');
  expect(stationRecipe({kind:'electric-tailor-bench'})).toBe('shirt');
  expect(stationRecipes({kind:'electric-tailor-bench'})).toEqual(['shirt','pants','duster','parka','tribalwear','tuque','tshirt','jacket']);
});

test('daily wear and randomized policy cadence replay from explicit independent streams',()=>{
  const initial=createApparelWearCalendar(0,42),worn=[{id:7,apparel:{hitPoints:3}},{id:2,apparel:{hitPoints:3}}];
  const a=advanceApparelWear(initial,18000,worn),b=advanceApparelWear(initial,18000,[...worn].reverse());
  expect(a).toEqual(b);expect(a.elapsedDays).toBe(3);expect(a.calendar.nextWearAt).toBe(24000);
  expect(advanceApparelWear(a.calendar,18001,worn)).toMatchObject({elapsedDays:0,changes:[]});
  const policy=createApparelPolicyCalendar(0,123),first=advanceApparelPolicyCalendar(policy,5000),replay=advanceApparelPolicyCalendar(policy,5000);
  expect(first).toEqual(replay);expect(first.checks).toBeGreaterThan(0);expect(first.calendar.nextPolicyAt).toBeGreaterThan(5000);
});

test('policy removes forbidden wear first, then picks a stable worthwhile unreserved replacement',()=>{
  const registry=createDefaultApparelPolicyRegistry();expect(registry).toMatchObject({nextApparelPolicyId:3,apparelPolicies:[{id:1},{id:2}]});
  const worn=garment(1,'cloth-shirt',20),replacement=candidate(3,'light-leather-shirt','excellent');
  const strict={...DEFAULT_APPAREL_POLICY,minHitPointsPercent:.5};
  expect(chooseApparelReplacement(strict,[worn],[replacement])).toEqual({action:'remove',wornId:1,reason:'policy'});
  worn.apparel.hitPoints=100;
  const choice=chooseApparelReplacement(DEFAULT_APPAREL_POLICY,[worn],[replacement]);
  expect(choice).toMatchObject({action:'wear',candidateId:3,replaceIds:[1]});
  worn.apparel.forced=true;expect(chooseApparelReplacement(DEFAULT_APPAREL_POLICY,[worn],[replacement])).toBeNull();
  delete worn.apparel.forced;expect(chooseApparelReplacement(DEFAULT_APPAREL_POLICY,[worn],[{...replacement,reserved:true}])).toBeNull();
});

test('V90 unfinished work owns one material and validates 80-unit leather recipes without changing legacy ids',()=>{
  const pile={kind:'unfinished',item:'unfinished-parka',quantity:1,owner:{type:'ground',x:1,z:1},unfinished:{recipe:'parka',authorId:1,progress:0,material:'light-leather',units:80,parts:[75,5]}};
  expect(validUnfinishedShape(pile,90)).toBe(true);
  expect(validUnfinishedShape(pile,89)).toBe(false);
  expect(validUnfinishedShape({...pile,unfinished:{...pile.unfinished,parts:[40,40],material:'cloth'}},90)).toBe(true);
  expect(validUnfinishedShape({...pile,unfinished:{...pile.unfinished,parts:[75,5],units:79}},90)).toBe(false);
});

test('V90 apparel validation requires matching persisted material and bounds new ids to the new schema',()=>{
  const leather={kind:'apparel',item:'light-leather-shirt',quantity:1,owner:{type:'ground',x:1,z:1},apparel:{quality:'normal',hitPoints:100,material:'light-leather'}};
  expect(validApparelShape(leather,90)).toBe(true);expect(validApparelShape(leather,89)).toBe(false);
  expect(validApparelShape({...leather,apparel:{...leather.apparel,material:'cloth'}},90)).toBe(false);
  const legacy={kind:'apparel',item:'cloth-shirt',quantity:1,owner:{type:'ground',x:1,z:1},apparel:{quality:'normal',hitPoints:100}};
  expect(validApparelShape(legacy,89)).toBe(true);expect(validApparelShape(legacy,90)).toBe(false);
  expect(validApparelShape({...legacy,apparel:{...legacy.apparel,material:'cloth'}},90)).toBe(true);
  expect(validApparelShape({...legacy,owner:{type:'apparel',pawnId:1},apparel:{...legacy.apparel,material:'cloth',forced:true}},90)).toBe(true);
});

test('automatic wear and removal provenance starts strictly in V90',()=>{
  const pawn={equipmentTask:{itemId:4,action:'wear',progress:0,duration:9,automatic:true}};
  expect(validEquipmentShape(pawn,90)).toBe(true);expect(validEquipmentShape(pawn,89)).toBe(false);
  expect(validEquipmentShape({equipmentTask:{...pawn.equipmentTask,automatic:false}},90)).toBe(false);
  expect(validEquipmentShape({equipmentTask:{...pawn.equipmentTask,action:'remove'}},90)).toBe(true);
  expect(validEquipmentShape({equipmentTask:{itemId:4,action:'wear',progress:0,duration:9}},89)).toBe(true);
});
