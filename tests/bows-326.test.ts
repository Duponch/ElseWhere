import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {rangedWeaponProfile} from '../src/sim/ranged-statistics.ts';
import {WEAPON_QUALITIES,isRangedWeaponItem,weaponMaxHitPoints} from '../src/sim/equipment-rules.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {PRODUCTION_RECIPES,stationRecipes} from '../src/sim/production-recipes.ts';
import {smithingUnits267,smithingWorkTicks267,smithingSkillRequired267,smithingProduct267,smithingRecipeAvailable267,smithingWorkpiece267} from '../src/sim/smithing-content-267.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {tradeCatalogueEntry} from '../src/sim/trade-catalogue.ts';
import {generateVisitorStock,VISITOR_RANGED_POOL,VISITOR_RANGED_ITEMS326} from '../src/sim/trade-stock.ts';
import {resolveUnarmoredBullet,validateUnarmoredBullet} from '../src/sim/bullet-impact.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {validTuqueCatalogueTransport} from '../src/sim/tuque-catalogue-save.ts';
import {validWeaponShape} from '../src/sim/equipment-save.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {validWorldProjectile} from '../src/sim/projectile-save.ts';
import {validShootingShape} from '../src/sim/shooting-save.ts';
import {validBowResearchTransport326,validateResearch} from '../src/sim/research-save.ts';
import {RESEARCH_SCALE,researchCost,researchPrerequisite,researchUnlocked,needsHighTechBench,selectResearch} from '../src/sim/research.ts';
import {productionResearchUnlocked} from '../src/sim/machining.ts';
import {meleeTools} from '../src/sim/melee-statistics.ts';
import {arrowHit326} from '../src/sim/bows-326.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {addGroundMaterial,addMaterial} from '../src/sim/materials.ts';
import {firingCamp} from './scenarios/shooting.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=8000){for(let i=0;i<limit&&!done();i++)stepWorld(w);expect(done(),`tick ${w.tick}`).toBe(true);}
const bows=['recurve-bow','greatbow'] as const;
/** Declared 32² workshop: one crafter-researcher, a simple research desk and
 * a crafting spot. No research point, bill or bow exists at the start. */
function workshop(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.research=1;pawn.priorities.craft=1;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:6,xp:0,dailyXp:0,passion:1};
  w.research={project:null,points:0};
  const desk={id:w.nextId++,kind:'research-bench',x:8,z:8,orientation:0,footprint:'standard',material:'wood'} as unknown as Structure;
  const spot={id:w.nextId++,kind:'crafting-spot',x:10,z:10,orientation:0,footprint:'standard',bills:[]} as unknown as Structure;
  w.structures.push(desk,spot);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
  return {w,pawn,desk,spot};
}

test('the recurve bow and the greatbow have the Core recipes, values and ranged statistics',()=>{
  for(const bow of bows){expect(ITEM_DEFINITIONS[bow]).toMatchObject({kind:'weapon',stackLimit:1});expect(isRangedWeaponItem(bow)).toBe(true);expect(weaponMaxHitPoints(bow)).toBe(100);}
  expect(ITEM_DEFINITIONS['recurve-bow'].label).toBe('Arc recourbé');expect(ITEM_DEFINITIONS.greatbow.label).toBe('Grand arc');
  const recurve=rangedWeaponProfile('recurve-bow','normal')!,great=rangedWeaponProfile('greatbow','normal')!;
  expect(recurve).toMatchObject({damage:14,range:25.9,warmupCoreTicks:87,cooldownCoreTicks:99,projectileTilesPerCoreTick:.56,stoppingPower:1});
  expect(recurve.armorPenetration).toBeCloseTo(.21,12);expect(recurve.accuracy).toEqual([.70,.78,.65,.35]);
  expect(great).toMatchObject({damage:17,range:29.9,warmupCoreTicks:120,cooldownCoreTicks:90,projectileTilesPerCoreTick:.49,stoppingPower:1.5});
  expect(great.armorPenetration).toBeCloseTo(.15,12);expect(great.accuracy).toEqual([.65,.85,.75,.50]);
  // Quality multiplies damage and accuracy like every ranged weapon.
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('recurve-bow',q)!.damage)).toEqual([13,14,14,14,14,18,21]);
  expect(WEAPON_QUALITIES.map(q=>rangedWeaponProfile('greatbow',q)!.damage)).toEqual([15,17,17,17,17,21,26]);
  rangedWeaponProfile('greatbow','legendary')!.accuracy.forEach((a,i)=>expect(a).toBeCloseTo([.975,1,1,.75][i]!,12));
  expect([smithingUnits267('make-recurve-bow','wood'),smithingWorkTicks267('make-recurve-bow','wood'),smithingSkillRequired267('make-recurve-bow'),smithingProduct267('make-recurve-bow','wood')]).toEqual([40,500,5,'recurve-bow']);
  expect([smithingUnits267('make-greatbow','wood'),smithingWorkTicks267('make-greatbow','wood'),smithingSkillRequired267('make-greatbow'),smithingProduct267('make-greatbow','wood')]).toEqual([60,900,6,'greatbow']);
  expect(smithingWorkpiece267('make-recurve-bow')).toBe('unfinished-bow');expect(smithingWorkpiece267('make-greatbow')).toBe('unfinished-bow');
  expect(PRODUCTION_RECIPES['make-recurve-bow']).toMatchObject({inputs:['wood'],units:40,workTicks:500,label:'Fabriquer un arc recourbé'});
  expect(PRODUCTION_RECIPES['make-greatbow']).toMatchObject({inputs:['wood'],units:60,workTicks:900,label:'Fabriquer un grand arc'});
  for(const kind of ['crafting-spot','fueled-smithy','electric-smithy'] as const)expect(stationRecipes({kind})).toEqual(expect.arrayContaining(['make-recurve-bow','make-greatbow']));
  expect(stationRecipes({kind:'machining-table'})).not.toContain('make-recurve-bow');
  expect(tradeCatalogueEntry('recurve-bow')!.baseMarketValue).toBeCloseTo(40*1.2+5000*.0036,9);
  expect(tradeCatalogueEntry('greatbow')!.baseMarketValue).toBeCloseTo(60*1.2+9000*.0036,9);
  // One limb melee tool: Blunt and Poke, power 9 at normal quality.
  const w=firingCamp(),archer=w.pawns[0]!;w.piles=[];addMaterial(w,'weapon',1,{type:'equipment',pawnId:archer.id},'greatbow');
  const tools=meleeTools(w,archer).filter(t=>t.id==='barrel'||t.id==='barrel-poke'||t.id==='grip');
  expect(tools.map(t=>[t.id,t.kind,t.damage]).sort()).toEqual([['barrel','blunt',9],['barrel-poke','poke',9]]);
});

test('a recurve arrow stabs flesh and cracks bone; a great arrow cuts',()=>{
  expect(arrowHit326('recurve-bow')).toEqual({injury:'stab'});expect(arrowHit326('greatbow')).toEqual({injury:'cut'});
  expect(arrowHit326('short-bow')).toEqual({injury:'cut'});expect(arrowHit326('bolt-action-rifle')).toEqual({});
  const draws=()=>{let n=0;return ()=>[.3,.6,.2,.8,.5][n++%5]!;};
  const recurve=resolveUnarmoredBullet(createMedicalRecord(0),{damage:14,injury:'stab'},draws());
  const bullet=resolveUnarmoredBullet(createMedicalRecord(0),{damage:14},draws());
  expect(recurve.selected).toBe(bullet.selected);expect(recurve.layers.length).toBe(bullet.layers.length);
  expect(recurve.layers.length).toBeGreaterThan(0);
  expect(recurve.layers.every(l=>l.kind==='stab'||l.kind==='crack')).toBe(true);
  expect(recurve.layers.some(l=>l.kind==='stab')).toBe(true);
  const skull=resolveUnarmoredBullet(createMedicalRecord(0),{damage:5,injury:'stab',part:'skull'},draws());
  expect(skull.layers[0]).toMatchObject({part:'skull',kind:'crack'});
  expect(()=>validateUnarmoredBullet({damage:5,injury:'burn' as 'stab'})).toThrow();
});

test('RecurveBow (400) then Greatbow (600) unlock their bills only after real desk work; the save resumes exactly',()=>{
  const {w,pawn,spot}=workshop();
  expect(researchCost('recurve-bow')).toBe(400*RESEARCH_SCALE);expect(researchCost('greatbow')).toBe(600*RESEARCH_SCALE);
  expect(needsHighTechBench('recurve-bow')).toBe(false);expect(needsHighTechBench('greatbow')).toBe(false);
  expect(researchPrerequisite(w,'recurve-bow')).toBeUndefined();expect(researchPrerequisite(w,'greatbow')).toBe('Arc recourbé');
  for(const recipe of ['make-recurve-bow','make-greatbow'] as const)expect(productionResearchUnlocked(w,recipe)).toBe(false);
  // Refusals are atomic: no research record, bill or selection is created.
  const before=serializeWorld(w);
  expect(applyCommand(w,{type:'research-project',project:'greatbow'}).ok).toBe(false);
  expect(applyCommand(w,{type:'bill-add',structureId:spot.id,recipe:'make-recurve-bow'}).ok).toBe(false);
  expect(applyCommand(w,{type:'bill-add',structureId:spot.id,recipe:'make-greatbow'}).ok).toBe(false);
  expect(serializeWorld(w)).toBe(before);
  accept(w,{type:'research-project',project:'recurve-bow'});expect(w.research!.recurveBow).toEqual({points:0});
  // Real desk work from zero: points only grow while the researcher stands at the desk.
  until(w,()=>(w.research!.recurveBow!.points)>0,400);expect(pawn.research).toBeDefined();expect(validateWorld(w)).toEqual([]);
  // Declared shortcut: the rest of the 400 points, then the last real work tick.
  w.research!.recurveBow!.points=researchCost('recurve-bow')-1;
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>researchUnlocked(w,'recurve-bow'),800);stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  expect(w.research!.recurveBow).toEqual({points:researchCost('recurve-bow'),completedAt:w.research!.recurveBow!.completedAt});
  expect(w.research!.project).toBeNull();expect(validateWorld(w)).toEqual([]);
  expect(productionResearchUnlocked(w,'make-recurve-bow')).toBe(true);expect(productionResearchUnlocked(w,'make-greatbow')).toBe(false);
  expect(researchPrerequisite(w,'greatbow')).toBeUndefined();
  accept(w,{type:'bill-add',structureId:spot.id,recipe:'make-recurve-bow'});
  expect(applyCommand(w,{type:'bill-add',structureId:spot.id,recipe:'make-greatbow'}).ok).toBe(false);
  // Completed research cannot be chosen again.
  expect(applyCommand(w,{type:'research-project',project:'recurve-bow'}).ok).toBe(false);
  accept(w,{type:'research-project',project:'greatbow'});expect(w.research!.greatbow).toEqual({points:0});
  w.research!.greatbow!.points=researchCost('greatbow')-1;pawn.priorities.craft=0;
  until(w,()=>researchUnlocked(w,'greatbow'),800);
  expect(w.research!.greatbow!.completedAt).toBeGreaterThanOrEqual(w.research!.recurveBow!.completedAt!);
  accept(w,{type:'bill-add',structureId:spot.id,recipe:'make-greatbow'});
  expect(productionResearchUnlocked(w,'make-greatbow')).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

for(const bow of bows)test(`a crafter makes a ${bow} from its exact wood at the crafting spot; the work resumes exactly and the bow is equipped`,()=>{
  const {w,pawn,spot}=workshop(),recipe=bow==='recurve-bow'?'make-recurve-bow' as const:'make-greatbow' as const,wood=bow==='recurve-bow'?40:60;
  pawn.priorities.research=0;
  // Declared prepared research, completed before the start of this fixture.
  w.research=bow==='recurve-bow'?{project:null,points:0,recurveBow:{points:researchCost('recurve-bow'),completedAt:0}}
    :{project:null,points:0,recurveBow:{points:researchCost('recurve-bow'),completedAt:0},greatbow:{points:researchCost('greatbow'),completedAt:0}};
  addGroundMaterial(w,'wood',wood+10,{x:12,z:12});expect(validateWorld(w)).toEqual([]);
  accept(w,{type:'bill-add',structureId:spot.id,recipe});
  until(w,()=>w.piles.some(p=>p.item==='unfinished-bow'&&!!p.smithingWork?.progress));
  const work=w.piles.find(p=>p.item==='unfinished-bow')!.smithingWork!;
  expect(work).toMatchObject({recipe,material:'wood',authorId:pawn.id});
  expect(work.parts.reduce((n,p)=>n+p.quantity,0)).toBe(wood);
  const resumed=deserializeWorld(serializeWorld(w)),start=w.tick;
  until(w,()=>w.piles.some(p=>p.item===bow));stepWorld(resumed,w.tick-start);
  expect(serializeWorld(resumed)).toBe(serializeWorld(w));
  const made=w.piles.find(p=>p.item===bow)!;
  expect(made.kind).toBe('weapon');expect(made.weapon?.hitPoints).toBe(100);expect(WEAPON_QUALITIES).toContain(made.weapon?.quality);
  expect(w.piles.some(p=>p.item==='unfinished-bow')).toBe(false);
  expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(10);
  until(w,()=>made.owner.type==='ground');
  accept(w,{type:'order-equipment',pawnId:pawn.id,itemId:made.id,action:'equip',queue:false});
  until(w,()=>made.owner.type==='equipment');expect(validateWorld(w)).toEqual([]);
});

for(const [bow,warmup,wound] of [['recurve-bow',87,'stab'],['greatbow',120,'cut']] as const)
  test(`a drafted archer with a ${bow} aims ${warmup} Core ticks and its arrows make ${wound} wounds; the save resumes exactly`,()=>{
    const w=firingCamp(),archer=w.pawns[0]!,target=w.pawns[1]!;w.piles=[];
    addMaterial(w,'weapon',1,{type:'equipment',pawnId:archer.id},bow);
    const start=w.tick*10;
    accept(w,{type:'shoot',pawnIds:[archer.id],targetId:target.id});
    expect(archer.shooting?.stance).toMatchObject({phase:'aim',startedAtCore:start,endsAtCore:start+warmup,weaponItem:bow});
    const copy=deserializeWorld(serializeWorld(w));
    let arrows=0,checked=false;
    for(let i=0;i<500&&!(target.health?.injuries.length);i++){
      stepWorld(w);stepWorld(copy);
      for(const p of w.projectiles??[])if(p.weaponItem===bow)arrows++;
      if(!checked&&archer.shooting?.stance?.phase==='cooldown'){checked=true;expect(archer.shooting.stance.endsAtCore-archer.shooting.stance.startedAtCore-(archer.shooting.stance.clock?.pausedCore??0)).toBe(rangedWeaponProfile(bow,'normal')!.cooldownCoreTicks);}
    }
    expect(arrows).toBeGreaterThan(0);
    const injuries=target.health?.injuries??[];
    expect(injuries.length).toBeGreaterThan(0);
    expect(injuries.every(i=>i.kind===wound||i.kind==='crack')).toBe(true);
    expect(injuries.some(i=>i.kind===wound)).toBe(true);
    expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(validateWorld(w)).toEqual([]);
  });

test('visitors may sell a recurve bow or a greatbow from schema 326, with the same random draws',()=>{
  expect(VISITOR_RANGED_POOL[21]!.value).toBe(66);expect(VISITOR_RANGED_POOL[22]!.value).toBe(104.4);
  expect(VISITOR_RANGED_ITEMS326).toEqual({21:'recurve-bow',22:'greatbow'});
  const sold={'recurve-bow':0,greatbow:0};
  for(let n=1;n<=4000;n++){
    const seed=Math.imul(n,1013904223)>>>0,now=generateVisitorStock(seed,100,101,700),old=generateVisitorStock(seed,100,101,700,325);
    expect(now.rng).toBe(old.rng);
    for(const p of old.piles)expect(now.piles).toContainEqual(expect.objectContaining({item:p.item,quantity:p.quantity}));
    for(const bow of bows)if(now.piles.some(p=>p.item===bow))sold[bow]++;
    expect(old.piles.some(p=>p.item==='recurve-bow'||p.item==='greatbow')).toBe(false);
  }
  expect(sold['recurve-bow']).toBeGreaterThan(0);expect(sold.greatbow).toBeGreaterThan(0);
});

test('before schema 326 the bows, their recipes, arrows, stances and research are refused by the direct validators',()=>{
  for(const recipe of ['make-recurve-bow','make-greatbow'] as const){
    expect(smithingRecipeAvailable267(recipe,326)).toBe(true);expect(smithingRecipeAvailable267(recipe,325)).toBe(false);
    expect(validBillSettings(newCookingBill(1,recipe),recipe,326)).toBe(true);
    expect(validBillSettings(newCookingBill(1,recipe),recipe,325)).toBe(false);
    expect(validTuqueCatalogueTransport({bills:[{recipe}]},325)).toBe(false);
  }
  const w=firingCamp();
  for(const bow of bows){
    const pile={id:1,kind:'weapon',item:bow,quantity:1,owner:{type:'ground',x:1,z:1},weapon:{quality:'normal',hitPoints:100}};
    expect(validWeaponShape(pile,326)).toBe(true);expect(validWeaponShape(pile,325)).toBe(false);
    expect(validatePileRecordShape(pile,w,325)).toEqual(['Future recurve or great bow catalogue.']);
    expect(validTuqueCatalogueTransport({piles:[{item:bow}]},325)).toBe(false);
    expect(validTuqueCatalogueTransport({piles:[{item:bow}]},315)).toBe(false);
    expect(validTuqueCatalogueTransport({projectiles:[{weaponItem:bow}]},325)).toBe(false);
    expect(validTuqueCatalogueTransport({stockpiles:[{filters:{items:{[bow]:true}}}]},325)).toBe(false);
    expect(validTuqueCatalogueTransport({piles:[{item:bow}]},326)).toBe(true);
  }
  // A real arrow in flight and a real bow stance, relabelled 325.
  const archer=w.pawns[0]!,target=w.pawns[1]!;w.piles=[];addMaterial(w,'weapon',1,{type:'equipment',pawnId:archer.id},'recurve-bow');
  accept(w,{type:'shoot',pawnIds:[archer.id],targetId:target.id});
  const core=effectiveCore297(w);
  expect(validShootingShape(archer.shooting,326,w.tick,core)).toBe(true);expect(validShootingShape(archer.shooting,325,w.tick,core)).toBe(false);
  // The same stance with the short bow's timings is valid at 325: only the bow identity is refused.
  const stance=archer.shooting!.stance!;
  expect(validShootingShape({...archer.shooting,stance:{...stance,weaponItem:'short-bow',endsAtCore:stance.startedAtCore+81}},325,w.tick,core)).toBe(true);
  until(w,()=>(w.projectiles??[]).some(p=>p.weaponItem==='recurve-bow'),400);
  const arrow=w.projectiles!.find(p=>p.weaponItem==='recurve-bow')!;
  expect(validWorldProjectile(arrow,w,326,effectiveCore297(w))).toBe(true);expect(validWorldProjectile(arrow,w,325,effectiveCore297(w))).toBe(false);
  // Research records and selection: refused before 326, and Greatbow needs RecurveBow.
  const research=(r:World['research'])=>({...firingCamp(),research:r}) as World;
  const recurve={project:null,points:0,recurveBow:{points:12}} as World['research'];
  expect(validBowResearchTransport326(research(recurve),326)).toBe(true);
  expect(validBowResearchTransport326(research(recurve),325)).toBe(false);
  expect(validateResearch(research(recurve),325)).not.toEqual([]);
  expect(validateResearch(research({project:'recurve-bow',points:0,recurveBow:{points:0}} as World['research']),325)).not.toEqual([]);
  expect(validBowResearchTransport326(research({project:null,points:0,greatbow:{points:5}} as World['research']),326)).toBe(false);
  expect(validBowResearchTransport326(research({project:'greatbow',points:0} as World['research']),326)).toBe(false);
  const old=firingCamp();old.schemaVersion=325 as World['schemaVersion'];
  expect(selectResearch(old,'recurve-bow').ok).toBe(false);expect(old.research?.recurveBow).toBeUndefined();
  // A whole 325 save holding a bow is refused, never migrated.
  const withBow=firingCamp();addMaterial(withBow,'weapon',1,{type:'ground',x:2,z:2},'greatbow');
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withBow),325))).toThrow();
});

test('a schema 325 save migrates to 326 by its number only',()=>{
  const current=serializeWorld(firingCamp());
  expect(serializeWorld(deserializeWorld(asOldSchema(current,325)))).toBe(current);
  const {w}=workshop();const workshopSave=serializeWorld(w);
  expect(serializeWorld(deserializeWorld(asOldSchema(workshopSave,325)))).toBe(workshopSave);
});
