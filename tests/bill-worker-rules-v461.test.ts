import {expect,test} from 'vitest';
import {applyCommand} from '../src/sim/engine.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {billWorkerRefusal283,productionRecipeSkill283,readBillWorkerPolicy283,validBillWorkerPolicy283} from '../src/sim/bill-worker-rules-283.ts';
import {planCookingOrder} from '../src/sim/player-cooking.ts';
import {productionWorkerQualified} from '../src/sim/machining.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {DRUG_PRODUCTION_RESEARCH_COST,MEDICINE_PRODUCTION_RESEARCH_COST,MICROELECTRONICS_RESEARCH_COST} from '../src/sim/research.ts';
import {serializeWorld} from '../src/sim/serialization.ts';
import type {BillWorkerPolicy283} from '../src/sim/bill-worker-state-283.ts';
import type {ProductionRecipe} from '../src/sim/production-recipes.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';
import {healrootCamp} from './helpers/healroot-domestic-v195.ts';
import {fixtureBuilding} from './scenarios/deconstruction.ts';

/** Existing complete World fixture with declared stations/inputs only. These
 * tests exercise new admission/planning, not an elapsed production campaign. */
function camp(recipe:ProductionRecipe='simple-meal',kind:Structure['kind']='campfire',count=2){
 const world=healrootCamp(32,count);
 for(const pawn of world.pawns){delete pawn.background;delete pawn.traits;pawn.priorities.cook=1;pawn.priorities.craft=1;pawn.skills.cooking={level:8,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:0};pawn.skills.intellectual={level:8,xp:0,dailyXp:0,passion:0};}
 if(recipe==='make-medicine')world.research={points:0,project:null,microelectronics:{points:MICROELECTRONICS_RESEARCH_COST,completedAt:1000},drugProduction:{points:DRUG_PRODUCTION_RESEARCH_COST,completedAt:1500},medicineProduction:{points:MEDICINE_PRODUCTION_RESEARCH_COST,completedAt:2000}};
 const station:Structure=fixtureBuilding(world,kind,8,8);station.bills=[];
 if(kind==='drug-lab')station.material='steel';
 expect(applyCommand(world,{type:'bill-add',structureId:station.id,recipe})).toMatchObject({ok:true});
 const bill=station.bills[0]!;bill.destination='drop';
 return {world,station,bill,pawn:world.pawns[0]!,other:world.pawns[1]};
}
const policy=(pawnId:number|null=null,skillMin=0,skillMax=20):BillWorkerPolicy283=>({pawnId,skillMin,skillMax});
function choose(f:ReturnType<typeof camp>,value:BillWorkerPolicy283){return applyCommand(f.world,{type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:value});}
function unchangedRefusal(world:World,command:Command){const before=serializeWorld(world);expect(applyCommand(world,command).ok).toBe(false);expect(serializeWorld(world)).toBe(before);}

test('absent preferences remain a pure unrestricted read and current skill range endpoints are inclusive',()=>{
 const f=camp(),before=serializeWorld(f.world),defaults=readBillWorkerPolicy283(f.bill);
 expect(defaults).toEqual(policy());expect(Object.isFrozen(defaults)).toBe(true);expect(readBillWorkerPolicy283(newCookingBill(1))).toBe(defaults);expect(Object.hasOwn(f.bill,'worker')).toBe(false);
 expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();expect(serializeWorld(f.world)).toBe(before);
 expect(choose(f,policy(null,4,8))).toMatchObject({ok:true});
 for(const level of [4,8]){f.pawn.skills.cooking!.level=level;const raw=serializeWorld(f.world);expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();expect(serializeWorld(f.world)).toBe(raw);}
 f.pawn.skills.cooking!.level=3;expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toContain('minimum');
 f.pawn.skills.cooking!.level=9;expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toContain('maximum');
 expect(choose(f,policy(null,8,8))).toMatchObject({ok:true});f.pawn.skills.cooking!.level=8;expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();
});

test('a named person bypasses the preferred range, while another actual colonist is refused',()=>{
 const f=camp();expect(choose(f,policy(f.pawn.id,20,20))).toMatchObject({ok:true});f.pawn.skills.cooking!.level=0;
 const before=serializeWorld(f.world);expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();expect(billWorkerRefusal283(f.world,f.other!,f.bill)).toContain('autre personne');expect(serializeWorld(f.world)).toBe(before);
});

test('medicine uses Intellectual while stonecutting keeps Crafting and recipes without workSkill ignore the range',()=>{
 const f=camp('make-medicine','drug-lab');expect(choose(f,policy(null,7,9))).toMatchObject({ok:true});
 f.pawn.skills.intellectual!.level=8;f.pawn.skills.crafting!.level=20;expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();
 f.pawn.skills.intellectual!.level=6;f.pawn.skills.crafting!.level=8;expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toContain('Intellectuel');
 const stone=newCookingBill(1,'stone-blocks');stone.worker=policy(null,9,20);expect(productionRecipeSkill283(stone.recipe)).toBe('crafting');expect(billWorkerRefusal283(f.world,f.pawn,stone)).toContain('Artisanat');
 const xp=structuredClone(f.pawn.skills);
 for(const recipe of ['smelt-slag','chemfuel-from-wood','cremate-corpse'] as const){const bill={...newCookingBill(1,recipe),worker:policy(null,20,20)};expect(productionRecipeSkill283(recipe)).toBeNull();expect(billWorkerRefusal283(f.world,f.pawn,bill)).toBeUndefined();}
 expect(f.pawn.skills).toEqual(xp);
});

test('disabled skills read as zero without rewriting their stored level or background',()=>{
 const f=camp();f.pawn.background={childhood:'school-child',adulthood:'merchant'};f.pawn.skills.cooking!.level=20;f.bill.worker=policy(null,1,20);
 const before=serializeWorld(f.world);expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toContain('minimum');expect(f.pawn.skills.cooking!.level).toBe(20);expect(serializeWorld(f.world)).toBe(before);
 f.bill.worker=policy(null,0,0);expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();
});

test('policy shape rejects unknown, hidden, inherited, accessor and noninteger fields without invoking getters',()=>{
 const base=policy(),invalid:unknown[]=[undefined,null,false,[],{},Object.create(base),Object.assign(Object.create(null),base),{...base,future:true},{...base,[Symbol('future')]:true},{...base,pawnId:0},{...base,pawnId:-1},{...base,pawnId:1.5},{...base,pawnId:Number.MAX_SAFE_INTEGER+1},{...base,skillMin:-1},{...base,skillMax:21},{...base,skillMin:.5},{...base,skillMax:NaN},{...base,skillMin:Infinity},{...base,skillMin:9,skillMax:8}];
 const missing={...base} as Partial<BillWorkerPolicy283>;delete missing.skillMax;invalid.push(missing);
 const hidden={...base};Object.defineProperty(hidden,'pawnId',{value:null,enumerable:false});invalid.push(hidden);
 const getter={...base};Object.defineProperty(getter,'skillMin',{enumerable:true,get(){throw Error('Policy accessor must not run');}});invalid.push(getter);
 for(const value of invalid)expect(validBillWorkerPolicy283(value)).toBe(false);
 expect(validBillWorkerPolicy283(base)).toBe(true);expect(validBillWorkerPolicy283(policy(null,0,0))).toBe(true);expect(validBillWorkerPolicy283(policy(null,20,20))).toBe(true);
 expect(validBillWorkerPolicy283(policy(9),10)).toBe(true);expect(validBillWorkerPolicy283(policy(10),10)).toBe(false);expect(validBillWorkerPolicy283(base,0)).toBe(false);expect(validBillWorkerPolicy283(base,NaN)).toBe(false);
});

test('closed schema guards preserve absent/history admission and reject prospective settings on historical or future worlds',()=>{
 // Schema 353 meal bills also filter eggs and insect jelly: the historical checks use a 352 bill's filters.
 const f=camp(),withPolicy={...f.bill,filters:newCookingBill(f.bill.id,f.bill.recipe,352).filters,worker:policy(f.other!.id,20,20)};
 expect(validBillSettings(withPolicy,withPolicy.recipe,283)).toBe(true);expect(validBillSettings(withPolicy,withPolicy.recipe,282)).toBe(false);
 for(const version of [285,SCHEMA_VERSION]){
  f.world.schemaVersion=version as World['schemaVersion'];const before=JSON.stringify(f.world);
  expect(validBillSettings(withPolicy,withPolicy.recipe,version)).toBe(true);
  expect(billWorkerRefusal283(f.world,f.pawn,withPolicy)).toBe('Cette facture est réservée à une autre personne.');expect(JSON.stringify(f.world)).toBe(before);
  expect(applyCommand(f.world,{type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:policy()}).ok).toBe(true);
 }
 for(const version of [282,SCHEMA_VERSION+1]){
  f.world.schemaVersion=version as World['schemaVersion'];const before=JSON.stringify(f.world);
  expect(billWorkerRefusal283(f.world,f.pawn,withPolicy)).toBeUndefined();expect(JSON.stringify(f.world)).toBe(before);
  expect(applyCommand(f.world,{type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:policy()}).ok).toBe(false);expect(JSON.stringify(f.world)).toBe(before);
 }
 const absent=newCookingBill(1);Object.defineProperty(absent,'worker',{get(){throw Error('Closed-schema preference must not be read');}});
 expect(billWorkerRefusal283(f.world,f.pawn,absent)).toBeUndefined();
});

test('the dedicated command stores detached preferences, leaves other bills alone and rejects a general-settings bypass',()=>{
 const f=camp();expect(applyCommand(f.world,{type:'bill-add',structureId:f.station.id,recipe:'simple-meal'})).toMatchObject({ok:true});const otherBill=structuredClone(f.station.bills![1]!);
 const incoming=policy(f.pawn.id,6,10),rng=f.world.rng,nextId=f.world.nextId;
 expect(choose(f,incoming)).toMatchObject({ok:true,affected:1});expect(f.bill.worker).toEqual(incoming);expect(f.bill.worker).not.toBe(incoming);
 incoming.pawnId=f.other!.id;incoming.skillMin=19;incoming.skillMax=20;expect(f.bill.worker).toEqual(policy(f.pawn.id,6,10));expect(f.station.bills![1]).toEqual(otherBill);expect(f.world.rng).toBe(rng);expect(f.world.nextId).toBe(nextId);
 const settings={...f.bill,filters:{...f.bill.filters},worker:policy()} as unknown as Extract<Command,{type:'bill-update'}>['settings'];
 unchangedRefusal(f.world,{type:'bill-update',structureId:f.station.id,billId:f.bill.id,settings});
 expect(choose(f,policy(null,0,20))).toMatchObject({ok:true});expect(f.bill.worker).toEqual(policy());
});

test('unknown people, missing targets and malformed dedicated-command data refuse without changing the real World',()=>{
 const f=camp(),unknownId=f.world.nextId++;
 for(const command of [
  {type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:policy(unknownId)},
  {type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:policy(f.station.id)},
  {type:'bill-worker-policy',structureId:f.world.nextId+100,billId:f.bill.id,policy:policy()},
  {type:'bill-worker-policy',structureId:f.station.id,billId:f.world.nextId+101,policy:policy()},
  {type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:{...policy(),extra:1}},
 ] as Command[])unchangedRefusal(f.world,command);
 const malformed=policy();Object.defineProperty(malformed,'skillMax',{enumerable:true,get(){throw Error('Command policy accessor must not run');}});
 unchangedRefusal(f.world,{type:'bill-worker-policy',structureId:f.station.id,billId:f.bill.id,policy:malformed});
});

test('a named medicine worker still needs both recipe minima before a new real-ingredient plan is admitted',()=>{
 const f=camp('make-medicine','drug-lab',1);
 for(const [item,quantity,x] of [['herbal-medicine',1,4],['neutroamine',1,5],['cloth',3,6]] as const)addGroundMaterial(f.world,ITEM_DEFINITIONS[item].kind,quantity,{x,z:6},item);
 refreshStock(f.world);expect(choose(f,policy(f.pawn.id,20,20))).toMatchObject({ok:true});
 for(const [crafting,intellectual] of [[3,8],[8,3]]){
  f.pawn.skills.crafting!.level=crafting!;f.pawn.skills.intellectual!.level=intellectual!;const before=serializeWorld(f.world);
  expect(billWorkerRefusal283(f.world,f.pawn,f.bill)).toBeUndefined();expect(productionWorkerQualified(f.pawn,'make-medicine')).toBe(false);
  const proposal=planCookingOrder(f.world,f.pawn,f.station.id);expect(proposal.order).toBeUndefined();expect(proposal.reason).toContain('Artisanat 4 et Intellectuel 4');expect(serializeWorld(f.world)).toBe(before);
 }
 f.pawn.skills.crafting!.level=4;f.pawn.skills.intellectual!.level=4;const before=serializeWorld(f.world),proposal=planCookingOrder(f.world,f.pawn,f.station.id);
 expect(proposal.order).toBeDefined();expect(proposal.order&&'cooking'in proposal.order).toBe(true);expect(serializeWorld(f.world)).toBe(before);
});
