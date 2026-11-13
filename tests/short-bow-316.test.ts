import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {rangedWeaponProfile} from '../src/sim/ranged-statistics.ts';
import {WEAPON_QUALITIES,isRangedWeaponItem,weaponMaxHitPoints} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,stationRecipes} from '../src/sim/production-recipes.ts';
import {smithingUnits267,smithingWorkTicks267,smithingSkillRequired267,smithingProduct267,smithingRecipeAvailable267} from '../src/sim/smithing-content-267.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock,VISITOR_RANGED_POOL,VISITOR_SHORT_BOW_INDEX316} from '../src/sim/trade-stock.ts';
import {resolveUnarmoredBullet} from '../src/sim/bullet-impact.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {addGroundMaterial,addMaterial} from '../src/sim/materials.ts';
import {firingCamp} from './scenarios/shooting.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {Command,Structure,World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=6000){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}

test('the short bow has the Core recipe, value and ranged statistics',()=>{
  expect(ITEM_DEFINITIONS['short-bow']).toMatchObject({kind:'weapon',stackLimit:1});
  expect(isRangedWeaponItem('short-bow')).toBe(true);expect(weaponMaxHitPoints('short-bow')).toBe(100);
  const normal=rangedWeaponProfile('short-bow','normal')!;
  expect(normal).toMatchObject({damage:11,range:22.9,warmupCoreTicks:81,cooldownCoreTicks:99,projectileTilesPerCoreTick:.44,stoppingPower:.5});
  expect(normal.armorPenetration).toBeCloseTo(.165,12);expect(normal.accuracy).toEqual([.75,.65,.45,.25]);
  // Quality multiplies damage and accuracy like every ranged weapon.
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('short-bow',q)!.damage)).toEqual([10,11,11,11,11,14,16]);
  expect(smithingUnits267('make-short-bow','wood')).toBe(30);expect(smithingWorkTicks267('make-short-bow','wood')).toBe(240);
  expect(smithingSkillRequired267('make-short-bow')).toBe(2);expect(smithingProduct267('make-short-bow','wood')).toBe('short-bow');
  expect(PRODUCTION_RECIPES['make-short-bow']).toMatchObject({units:30,workTicks:240});
  for(const kind of ['crafting-spot','fueled-smithy','electric-smithy'] as const)expect(stationRecipes({kind})).toContain('make-short-bow');
  expect(stationRecipes({kind:'machining-table'})).not.toContain('make-short-bow');
  expect(tradeCatalogueEntry('short-bow')!.baseMarketValue).toBeCloseTo(30*1.2+2400*.0036,9);
});

test('an arrow cuts flesh and cracks bone instead of making a gunshot wound',()=>{
  const draws=()=>{let n=0;return ()=>[.3,.6,.2,.8,.5][n++%5]!;};
  const arrow=resolveUnarmoredBullet(createMedicalRecord(0),{damage:11,injury:'cut'},draws());
  const bullet=resolveUnarmoredBullet(createMedicalRecord(0),{damage:11},draws());
  expect(arrow.selected).toBe(bullet.selected);
  expect(bullet.layers.every(l=>l.kind==='gunshot')).toBe(true);
  expect(arrow.layers.length).toBe(bullet.layers.length);
  expect(arrow.layers.every(l=>l.kind==='cut'||l.kind==='crack')).toBe(true);
  // The skull is solid: an arrow there leaves a crack.
  const skull=resolveUnarmoredBullet(createMedicalRecord(0),{damage:5,injury:'cut',part:'skull'},draws());
  expect(skull.layers[0]).toMatchObject({part:'skull',kind:'crack'});
});

test('a drafted archer aims 81 Core ticks, shoots real arrows and wounds with cuts; the save resumes exactly',()=>{
  const w=firingCamp(),archer=w.pawns[0]!,target=w.pawns[1]!;w.piles=[];
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:archer.id},'short-bow');
  const start=w.tick*10;
  accept(w,{type:'shoot',pawnIds:[archer.id],targetId:target.id});
  expect(archer.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+81,weaponItem:'short-bow'});
  const copy=deserializeWorld(serializeWorld(w));
  let arrows=0;
  for(let i=0;i<400&&!(target.health?.injuries.length);i++){
    stepWorld(w);stepWorld(copy);
    for(const p of w.projectiles??[])if(p.weaponItem==='short-bow')arrows++;
  }
  expect(arrows).toBeGreaterThan(0);
  const injuries=target.health?.injuries??[];
  expect(injuries.length).toBeGreaterThan(0);
  expect(injuries.every(i=>i.kind==='cut'||i.kind==='crack')).toBe(true);
  expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(validateWorld(w)).toEqual([]);
});

test('a crafter makes a short bow from 30 wood at the crafting spot and the work resumes exactly',()=>{
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.schedule.fill('work');pawn.skills.crafting={level:6,xp:0,dailyXp:0,passion:1};
  const spot:Structure={id:w.nextId++,kind:'crafting-spot',x:10,z:10,orientation:0,footprint:'standard',bills:[]} as unknown as Structure;
  w.structures.push(spot);addGroundMaterial(w,'wood',40,{x:12,z:12});
  accept(w,{type:'bill-add',structureId:spot.id,recipe:'make-short-bow'});
  until(w,()=>w.piles.some(p=>p.item==='unfinished-bow'&&!!p.smithingWork?.progress));
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item==='short-bow'));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  const bow=w.piles.find(p=>p.item==='short-bow')!;
  expect(bow.kind).toBe('weapon');expect(bow.weapon?.hitPoints).toBe(100);
  expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(10);
  // The crafter first sets the finished bow down.
  until(w,()=>bow.owner.type==='ground');
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:bow.id,action:'equip',queue:false});
  until(w,()=>bow.owner.type==='equipment');expect(validateWorld(w)).toEqual([]);
});

test('visitors may sell a short bow from schema 316, with the same random draws',()=>{
  expect(VISITOR_RANGED_POOL[VISITOR_SHORT_BOW_INDEX316]!.value).toBe(44.64);
  let bows=0;
  for(let n=1;n<=3000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700),old=generateVisitorStock(seed,100,101,700,315);
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    if(now.piles.some(p=>p.item==='short-bow'))bows++;
    expect(old.piles.some(p=>p.item==='short-bow')).toBe(false);
  }
  expect(bows).toBeGreaterThan(0);
});

test('before schema 316 the bow, its workpiece, recipe and arrows are refused',()=>{
  expect(smithingRecipeAvailable267('make-short-bow',315)).toBe(false);
  expect(validBillSettings(newCookingBill(1,'make-short-bow'),'make-short-bow',315)).toBe(false);
  const bow={id:1,kind:'weapon',item:'short-bow',quantity:1,owner:{type:'ground',x:1,z:1},weapon:{quality:'normal',hitPoints:100}};
  expect(validWeaponShape(bow,316)).toBe(true);expect(validWeaponShape(bow,315)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'short-bow'}]},315)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'unfinished-bow'}]},315)).toBe(false);
  expect(validTuqueCatalogueTransport({bills:[{recipe:'make-short-bow'}]},315)).toBe(false);
  expect(validTuqueCatalogueTransport({projectiles:[{weaponItem:'short-bow'}]},315)).toBe(false);
  expect(validTuqueCatalogueTransport({piles:[{item:'short-bow'}]},316)).toBe(true);
});

test('a schema 315 save migrates to 316 by its number only',()=>{
  const current=serializeWorld(firingCamp());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,315)))).toBe(current);
});
