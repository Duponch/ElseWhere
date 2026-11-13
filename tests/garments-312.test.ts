import {expect,test} from 'vitest';
import {applyCommand,serializeWorld,deserializeWorld,validateWorld,stepWorld} from '../src/sim/index.ts';
import {APPAREL,APPAREL_FAMILIES,apparelItemFor,newApparelState,apparelInsulation,conflictsWith} from '../src/sim/apparel-rules.ts';
import {GARMENT_ITEMS312} from '../src/sim/apparel-definitions.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,stationRecipes} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {CLOTHING_RESEARCH_COST} from '../src/sim/research.ts';
import {APPAREL_TRADE_279} from '../src/sim/apparel-trade-279.ts';
import {createDefaultApparelPolicyRegistry,extendApparelPolicies312,validApparelPolicy} from '../src/sim/apparel-policy.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Command,type MaterialPile,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
function until(w:World,done:()=>boolean,limit=6000){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
function workshop(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.priorities.tailor=1;pawn.schedule.fill('work');pawn.apparelAutomation=false;
  pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:CLOTHING_RESEARCH_COST,completedAt:0};
  const bench:Structure={id:w.nextId++,kind:'tailor-bench',x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[]};
  w.structures.push(bench);return {w,pawn,bench};
}
const garment=(item:keyof typeof APPAREL,id=1):MaterialPile=>({id,kind:'apparel',item,quantity:1,owner:{type:'ground',x:1,z:1},apparel:newApparelState(item)});

test('the T-shirt and the jacket have their Core stats, recipes and layers in every material',()=>{
  expect(APPAREL_FAMILIES).toEqual(['tribalwear','shirt','pants','duster','parka','tshirt','jacket']);
  expect(GARMENT_ITEMS312).toHaveLength(22*2);
  for(const item of GARMENT_ITEMS312){expect(ITEM_DEFINITIONS[item].kind).toBe('apparel');expect(APPAREL[item]).toBeDefined();}
  expect(PRODUCTION_RECIPES.tshirt).toMatchObject({units:40,workTicks:160,station:'tailor-bench'});
  expect(PRODUCTION_RECIPES.jacket).toMatchObject({units:70,workTicks:700,station:'tailor-bench'});
  expect(stationRecipes({kind:'tailor-bench'})).toEqual(expect.arrayContaining(['tshirt','jacket']));
  expect(stationRecipes({kind:'crafting-spot'})).not.toContain('tshirt');
  // Cloth T-shirt: cold 18 x 0.22; cloth jacket: cold 18 x 0.8, heat 18 x 0.3, 160 HP.
  expect(apparelInsulation(garment('cloth-tshirt')).cold).toBeCloseTo(3.96,9);
  expect(APPAREL['cloth-jacket']).toMatchObject({hitPoints:160,family:'jacket'});
  expect(APPAREL['cloth-jacket'].coldInsulation).toBeCloseTo(14.4,9);expect(APPAREL['cloth-jacket'].heatInsulation).toBeCloseTo(5.4,9);
  expect(APPAREL['bear-leather-jacket'].hitPoints).toBe(208);
  // Layers: a T-shirt and a button-down shirt both sit on the skin; a jacket is an outer shell.
  expect(conflictsWith(garment('cloth-tshirt'),garment('cloth-shirt',2))).toBe(true);
  expect(conflictsWith(garment('cloth-jacket'),garment('cloth-parka',2))).toBe(true);
  expect(conflictsWith(garment('cloth-jacket'),garment('cloth-tshirt',2))).toBe(false);
  expect(conflictsWith(garment('cloth-tshirt'),garment('cloth-pants',2))).toBe(false);
  // Core value: stuff count x stuff value + work x 0.0036.
  expect(APPAREL_TRADE_279['cloth-tshirt'].baseMarketValue).toBeCloseTo(40*1.5+1600*.0036,9);
  expect(APPAREL_TRADE_279['cloth-jacket'].baseMarketValue).toBeCloseTo(70*1.5+7000*.0036,9);
  expect(apparelItemFor('jacket','wolf-leather')).toBe('wolf-leather-jacket');
});

test('a real tailor makes a cloth T-shirt, then a jacket, and wears both; the save resumes exactly',()=>{
  const {w,pawn,bench}=workshop();addGroundMaterial(w,'textile',110,{x:12,z:12},'cloth');
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'tshirt'});
  until(w,()=>w.piles.some(p=>p.item==='cloth-tshirt'));
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'jacket'});
  until(w,()=>!!w.piles.find(p=>p.unfinished?.recipe==='jacket')?.unfinished?.progress);
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item==='cloth-jacket'));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  for(const item of ['cloth-tshirt','cloth-jacket']){
    const p=w.piles.find(q=>q.item===item)!;
    accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:p.id,action:'wear',queue:false});until(w,()=>p.owner.type==='apparel');
  }
  expect(validateWorld(w)).toEqual([]);
});

test('before schema 312 the garments, recipes and policies are refused',()=>{
  const p=garment('cloth-jacket') as unknown as Record<string,unknown>;
  expect(validApparelShape(p,SCHEMA_VERSION)).toBe(true);expect(validApparelShape(p,311)).toBe(false);
  expect(validBillSettings(newCookingBill(1,'tshirt'),'tshirt',SCHEMA_VERSION)).toBe(true);
  expect(validBillSettings(newCookingBill(1,'tshirt'),'tshirt',311)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'cloth-tshirt'}]},311)).toBe(false);
  expect(validTuqueCatalogueTransport({bills:[{recipe:'jacket'}]},311)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'cloth-tshirt'}]},312)).toBe(true);
  const policy=createDefaultApparelPolicyRegistry().apparelPolicies[0]!;
  expect(policy.allowedItems).toContain('cloth-tshirt');expect(validApparelPolicy(policy,311)).toBe(false);
});

test('migration 311 -> 312: allowed shirts bring their T-shirts and allowed dusters their jackets',()=>{
  const policies=[{allowedItems:['cloth-shirt','wolf-leather-duster'],allowedMaterials:['cloth']}];
  extendApparelPolicies312(policies);
  expect(policies[0]!.allowedItems).toEqual(['cloth-shirt','wolf-leather-duster','cloth-tshirt','wolf-leather-jacket']);
  const {w}=workshop(),current=serializeWorld(w);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,311)))).toBe(current);
});
