import {expect,test} from 'vitest';
import {applyCommand,serializeWorld,deserializeWorld,validateWorld,stepWorld} from '../src/sim/index.ts';
import {APPAREL,APPAREL_MATERIALS,apparelItemFor,newApparelState,apparelInsulation} from '../src/sim/apparel-rules.ts';
import {validApparelShape} from '../src/sim/apparel-save.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,isRecipeProduct,tailoringMaterialAllowed} from '../src/sim/production-recipes.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {addGroundMaterial} from '../src/sim/materials.ts';
import {CLOTHING_RESEARCH_COST} from '../src/sim/research.ts';
import {APPAREL_TRADE_279} from '../src/sim/apparel-trade-279.ts';
import {createDefaultApparelPolicyRegistry,validApparelPolicy} from '../src/sim/apparel-policy.ts';
import {TEXTILE_APPAREL_ITEMS308,TEXTILE_MATERIALS308,FABRIC_TEXTILES308} from '../src/sim/textile-apparel-308.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {SCHEMA_VERSION,type Command,type MaterialPile,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
function until(w:World,done:()=>boolean,limit=4000){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
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

test('every Core leather and wool is a tailoring material with its Core stuff powers',()=>{
  expect(APPAREL_MATERIALS).toHaveLength(22);
  expect(TEXTILE_APPAREL_ITEMS308).toHaveLength(15*5+3);
  for(const item of TEXTILE_APPAREL_ITEMS308){expect(APPAREL[item]).toBeDefined();expect(ITEM_DEFINITIONS[item].kind).toBe('apparel');}
  // Bear leather parka: cold 20 x 2, sharp 1.12 x 0.2, 180 HP x 1.3.
  expect(APPAREL['bear-leather-parka']).toMatchObject({hitPoints:234,coldInsulation:40,heatInsulation:0,material:'bear-leather',family:'parka'});
  expect(APPAREL['bear-leather-parka'].ratings.sharp).toBeCloseTo(.224,9);
  // Guinea pig fur is fragile (x0.6) but very warm (38).
  expect(APPAREL['guinea-pig-fur-duster']).toMatchObject({hitPoints:120});expect(APPAREL['guinea-pig-fur-duster'].coldInsulation).toBeCloseTo(38*.6,9);
  expect(apparelInsulation(garment('alpaca-wool-tuque'))).toEqual({cold:15,heat:0});
  for(const m of TEXTILE_MATERIALS308)for(const family of ['tribalwear','shirt','pants','duster','parka'] as const){
    expect(tailoringMaterialAllowed(family,m)).toBe(true);expect(isRecipeProduct(family,apparelItemFor(family,m))).toBe(true);
  }
  // The tuque takes fabric only.
  for(const m of FABRIC_TEXTILES308)expect(tailoringMaterialAllowed('tuque',m)).toBe(true);
  expect(tailoringMaterialAllowed('tuque','wolf-leather')).toBe(false);expect(()=>apparelItemFor('tuque','wolf-leather')).toThrow(RangeError);
  expect(PRODUCTION_RECIPES.tuque.inputs).toEqual(['cloth','muffalo-wool','alpaca-wool','bison-wool','megasloth-wool']);
});

test('market value follows the Core cost: stuff count times stuff value plus work',()=>{
  // Duster: 80 x 3.4 + 10000 x 0.0036.
  expect(APPAREL_TRADE_279['bear-leather-duster'].baseMarketValue).toBeCloseTo(308,9);
  expect(APPAREL_TRADE_279['chinchilla-fur-parka'].baseMarketValue).toBeCloseTo(80*6.5+8000*.0036,9);
  expect(APPAREL_TRADE_279['bison-wool-tuque'].baseMarketValue).toBeCloseTo(20*2.7+1200*.0036,9);
});

test('a real tailor makes a wolf leather parka from wolf leather and wears it; the save resumes exactly',()=>{
  const {w,pawn,bench}=workshop();addGroundMaterial(w,'textile',80,{x:12,z:12},'wolf-leather');
  accept(w,{type:'bill-add',structureId:bench.id,recipe:'parka'});
  until(w,()=>!!w.piles.find(p=>p.unfinished?.recipe==='parka')?.unfinished?.progress);
  const work=w.piles.find(p=>p.unfinished?.recipe==='parka')!;expect(work.unfinished).toMatchObject({authorId:pawn.id,material:'wolf-leather',units:80});
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item==='wolf-leather-parka'&&p.owner.type==='ground'));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  const product=w.piles.find(p=>p.item==='wolf-leather-parka')!;expect(product.apparel).toMatchObject({material:'wolf-leather',hitPoints:234});
  expect(w.piles.some(p=>p.item==='wolf-leather')).toBe(false);
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:product.id,action:'wear',queue:false});until(w,()=>product.owner.type==='apparel');
  expect(validateWorld(w)).toEqual([]);
});

test('saves: the new garments and materials exist only from schema 308',()=>{
  const p=garment('megasloth-wool-parka') as unknown as Record<string,unknown>;
  expect(validApparelShape(p,SCHEMA_VERSION)).toBe(true);expect(validApparelShape(p,307)).toBe(false);
  const bill=newCookingBill(1,'shirt'),old=newCookingBill(2,'shirt',307);
  expect(bill.filters['dog-leather']).toBe(true);expect(Object.hasOwn(old.filters,'dog-leather')).toBe(false);
  expect(validBillSettings(old,'shirt',SCHEMA_VERSION)).toBe(true);expect(validBillSettings(bill,'shirt',307)).toBe(false);
  const policy=createDefaultApparelPolicyRegistry().apparelPolicies[0]!;
  expect(policy.allowedItems).toContain('pig-leather-pants');expect(policy.allowedMaterials).toContain('pig-leather');
  expect(validApparelPolicy(policy,SCHEMA_VERSION)).toBe(true);expect(validApparelPolicy(policy,307)).toBe(false);
  const legacy=createDefaultApparelPolicyRegistry(true,true,true,true,false,true,false).apparelPolicies[0]!;
  expect(legacy.allowedItems.some(i=>(TEXTILE_APPAREL_ITEMS308 as readonly string[]).includes(i))).toBe(false);expect(validApparelPolicy(legacy,307)).toBe(true);
});

test('migration 307 -> 308: policies that allowed plain leather or muffalo wool garments also allow the new ones; nothing else changes',()=>{
  const {w}=workshop();
  const legacy=createDefaultApparelPolicyRegistry(true,true,true,true,false,true,false);
  w.apparelPolicies=legacy.apparelPolicies;w.nextApparelPolicyId=legacy.nextApparelPolicyId;
  // A third policy: cloth shirts only.
  w.apparelPolicies.push({...w.apparelPolicies[0]!,id:3,label:'Chemises en tissu',allowedItems:['cloth-shirt'],allowedMaterials:['cloth']});w.nextApparelPolicyId=4;
  const old=serializeWorld(w).replace(`{"schemaVersion":${SCHEMA_VERSION},`,'{"schemaVersion":307,');
  const migrated=deserializeWorld(old);
  const all=migrated.apparelPolicies![0]!,clothOnly=migrated.apparelPolicies![2]!;
  expect(all.allowedItems).toEqual(expect.arrayContaining(['dog-leather-shirt','wolf-leather-parka','alpaca-wool-tuque','megasloth-wool-pants']));
  expect(all.allowedMaterials).toEqual(expect.arrayContaining([...TEXTILE_MATERIALS308]));
  expect(clothOnly.allowedItems).toEqual(['cloth-shirt']);expect(clothOnly.allowedMaterials).toEqual(['cloth']);
  expect(validateWorld(migrated)).toEqual([]);
  // Old items keep their order; the new ones follow.
  expect(all.allowedItems.slice(0,legacy.apparelPolicies[0]!.allowedItems.length)).toEqual(legacy.apparelPolicies[0]!.allowedItems);
});
