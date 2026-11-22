import {describe,expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index.ts';
import {newCookingBill,validBillSettings} from '../src/sim/cooking-bills.ts';
import {validFlakWorkShape} from '../src/sim/flak-work.ts';
import {FLAK_PANTS_SCHEMA_375} from '../src/sim/flak-pants-375.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {productionResearchUnlocked,validFlakIngredients} from '../src/sim/machining.ts';
import {validatePileRecordShape} from '../src/sim/material-record-save.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {newBuildingFuel} from '../src/sim/fuel.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {FLAK_PANTS_REQUIREMENTS,PRODUCTION_RECIPES,PRODUCTION_WORK_SCALE,flakWorkpiece,isRecipeProduct,productionWorkTotal,recipeProduct,stationRecipes} from '../src/sim/production-recipes.ts';
import {CLOTHING_RESEARCH_COST,FLAK_ARMOR_RESEARCH_COST,MACHINING_RESEARCH_COST,PLATE_ARMOR_RESEARCH_COST,SMITHING_RESEARCH_COST,projectProgress,researchPrerequisite,type ResearchProject,type ResearchState} from '../src/sim/research.ts';
import {RESEARCH_PARENT_LABELS,RESEARCH_PREREQUISITES,researchParentProjects,researchPrerequisitesAt} from '../src/sim/research-prerequisites.ts';
import {validStorageItems} from '../src/sim/storage-filters.ts';
import {captureTradeRequestAvailability284} from '../src/sim/trade-request-accessibility-284.ts';
import {createMedicalRecord} from '../src/sim/injury-state.ts';
import {groupAmbientTemperature256} from '../src/sim/group-provision-age.ts';
import {offmapThermalRange259} from '../src/sim/offmap-thermal-259.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';
import {toolDefinitions} from '../src/ui/layout.ts';
import {GLOBAL_TOOL_HOTKEYS,ORDERS_PALETTE_HOTKEYS,ZONES_PALETTE_HOTKEYS,globalHotkeyTool,paletteHotkeyTool} from '../src/ui/main-tab-hotkeys.ts';
import {GAMEPLAY_TIPS} from '../src/ui3d/native-tips.ts';
import {buildNativeHelp} from '../src/ui3d/native-help.ts';
import {LOW_FOOD_NUTRITION_PER_COLONIST,LOW_FOOD_START_TICK,SERIOUS_HYPOTHERMIA,coreHumanEdibleItem,freeColonistsSpawned,readLowFood,readSeriousHypothermia,storedHumanNutrition} from '../src/ui/core-colony-alerts.ts';
import {researchProjects} from '../src/ui/research-projects.ts';
import {researchLinks,researchPrerequisiteLabels} from '../src/ui/research-tree.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {advanceUntil} from './scenarios/machining-v101.ts';
import {reorganizationCamp256} from './helpers/group-reorganization-v256.ts';
import {healrootCamp} from './helpers/healroot-domestic-v195.ts';

/** Wave 8 conformity lot: four existing behaviours brought back to Core
 * RimWorld 1.6 (Apparel_FlakPants, KeyBindings C and X, Alert_Hypothermia and
 * Alert_LowFood, research prerequisites shown from the simulation's table). */
const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const flakResearch=():ResearchState=>({project:null,points:CLOTHING_RESEARCH_COST,completedAt:0,
  smithing:{points:SMITHING_RESEARCH_COST,completedAt:0},machining:{points:MACHINING_RESEARCH_COST,completedAt:0},
  plateArmor:{points:PLATE_ARMOR_RESEARCH_COST,completedAt:0},flakArmor:{points:FLAK_ARMOR_RESEARCH_COST,completedAt:0}});

/** Declared 32² workshop: one crafter (Crafting 10), a fuelled generator
 * powering a built machining table, exactly 30 cloth, 60 steel and one
 * component on the ground. Flak armor and its parents are known at the start. */
function workshop(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.craft=1;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.crafting={level:10,xp:0,dailyXp:0,passion:0};
  w.research=flakResearch();
  w.structures.push({id:w.nextId++,kind:'wood-generator',x:12,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('wood-generator'),fuel:{...newBuildingFuel('wood-generator'),ticks:45_000,autoRefuel:false}} as Structure);
  const station={id:w.nextId++,kind:'machining-table',x:15,z:8,orientation:0,footprint:'standard',material:'steel',power:newPowerState('machining-table'),bills:[]} as Structure;
  w.structures.push(station);
  addGroundMaterial(w,'textile',30,{x:3,z:13},'cloth');addGroundMaterial(w,'steel',60,{x:4,z:13},'steel');addGroundMaterial(w,'component',1,{x:5,z:13},'component');refreshStock(w);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
  return {world:w,pawn,station};
}

describe('flak pants are made at the machining table as in Core (Apparel_FlakPants)',()=>{
  test('Core recipe facts: TableMachining, FlakArmor, Crafting 4, WorkToMake 9000, 30 cloth + 60 steel + 1 component',()=>{
    expect(FLAK_PANTS_SCHEMA_375).toBe(375);
    expect(PRODUCTION_RECIPES['make-flak-pants']).toMatchObject({label:'Pantalon pare-balles',station:'machining-table',work:'craft',inputs:['cloth','steel','component'],units:91,workTicks:900,outputUnits:1});
    expect(FLAK_PANTS_REQUIREMENTS).toEqual({cloth:30,steel:60,component:1,skill:4});
    // Core displayPriority: flak vest 220, flak pants 230.
    const machining=stationRecipes({kind:'machining-table'});
    expect(machining.indexOf('make-flak-pants')).toBe(machining.indexOf('make-flak-vest')+1);
    expect(stationRecipes({kind:'fabrication-bench'})).not.toContain('make-flak-pants');
    expect(flakWorkpiece('make-flak-pants')).toBe('unfinished-flak-pants');
    expect(ITEM_DEFINITIONS['unfinished-flak-pants']).toMatchObject({kind:'unfinished',stackLimit:1});
    expect(recipeProduct('make-flak-pants',[])).toBe('flak-pants');
    expect(isRecipeProduct('make-flak-pants','flak-pants')).toBe(true);expect(isRecipeProduct('make-flak-pants','flak-vest')).toBe(false);
    expect(validFlakIngredients('make-flak-pants',[{item:'cloth',quantity:30},{item:'steel',quantity:60},{item:'component',quantity:1}])).toBe(true);
    expect(validFlakIngredients('make-flak-pants',[{item:'cloth',quantity:29},{item:'steel',quantity:61},{item:'component',quantity:1}])).toBe(false);
  });

  test('the recipe needs schema 375 and Flak armor; nothing is offered to an older save',()=>{
    const research=flakResearch(),without:ResearchState={...flakResearch()};delete without.flakArmor;
    expect(productionResearchUnlocked({schemaVersion:SCHEMA_VERSION,research},'make-flak-pants')).toBe(true);
    expect(productionResearchUnlocked({schemaVersion:SCHEMA_VERSION,research:without},'make-flak-pants')).toBe(false);
    expect(productionResearchUnlocked({schemaVersion:372 as typeof SCHEMA_VERSION,research},'make-flak-pants')).toBe(false);
    // The flak vest keeps its own gate at every schema.
    expect(productionResearchUnlocked({schemaVersion:372 as typeof SCHEMA_VERSION,research},'make-flak-vest')).toBe(true);
    const bill=newCookingBill(1,'make-flak-pants');
    expect(validBillSettings(bill,'make-flak-pants',SCHEMA_VERSION)).toBe(true);
    expect(validBillSettings(bill,'make-flak-pants',372)).toBe(false);
    expect(validStorageItems({'unfinished-flak-pants':true},SCHEMA_VERSION)).toBe(true);
    expect(validStorageItems({'unfinished-flak-pants':true},372)).toBe(false);
    const piece={id:5,item:'unfinished-flak-pants',kind:'unfinished',quantity:1,owner:{type:'ground',x:1,z:1},
      flakWork:{recipe:'make-flak-pants',authorId:2,progress:0,parts:[{item:'cloth',quantity:30},{item:'steel',quantity:60},{item:'component',quantity:1}]}};
    expect(validFlakWorkShape(piece,SCHEMA_VERSION)).toBe(true);
    expect(validFlakWorkShape(piece,372)).toBe(false);
    expect(validatePileRecordShape(piece,{width:8,height:8,tick:0,nextId:10} as Parameters<typeof validatePileRecordShape>[1],372)).toContain('Future flak pants workpiece.');
  });

  test('a crafter really makes the pants: physical workpiece, exact reload mid-work, quality and the whole cost',()=>{
    const {world:w,pawn,station}=workshop();
    advanceUntil(w,()=>station.power?.on===true,100);
    accept(w,{type:'bill-add',structureId:station.id,recipe:'make-flak-pants'});
    const bill=station.bills![0]!;
    accept(w,{type:'bill-update',structureId:station.id,billId:bill.id,settings:{...bill,destination:'drop'}});
    advanceUntil(w,()=>w.piles.some(p=>p.flakWork?.recipe==='make-flak-pants'&&p.flakWork.progress>0),3000);
    const piece=w.piles.find(p=>p.flakWork?.recipe==='make-flak-pants')!;
    expect(piece.item).toBe('unfinished-flak-pants');
    expect(piece.flakWork).toMatchObject({authorId:pawn.id,billId:bill.id});
    for(const item of ['cloth','steel','component'] as const)expect(piece.flakWork!.parts.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0)).toBe(FLAK_PANTS_REQUIREMENTS[item]);
    expect([quantity(w,'cloth'),quantity(w,'steel'),quantity(w,'component')]).toEqual([0,0,0]);
    expect(validateWorld(w)).toEqual([]);
    // An exact reload in the middle of the work continues identically.
    const resumed=deserializeWorld(serializeWorld(w));
    for(let i=0;i<30;i++){stepWorld(w);stepWorld(resumed);}
    expect(serializeWorld(resumed)).toBe(serializeWorld(w));
    // Declared shortcut: the paid workpiece jumps near the end of its work.
    const jump=Math.max(piece.flakWork!.progress,productionWorkTotal('make-flak-pants')-60*PRODUCTION_WORK_SCALE);piece.flakWork!.progress=jump;
    if(pawn.cooking?.recipe==='make-flak-pants'&&pawn.cooking.phase==='work')pawn.cooking.progress=jump;
    advanceUntil(w,()=>w.piles.some(p=>p.item==='flak-pants'),2500);
    const pants=w.piles.find(p=>p.item==='flak-pants')!;
    expect(pants.kind).toBe('apparel');expect(pants.apparel?.hitPoints).toBe(200);expect(pants.apparel?.quality).toBeDefined();
    expect(w.piles.some(p=>p.item==='unfinished-flak-pants')).toBe(false);
    expect(validateWorld(w)).toEqual([]);
  });

  test('migration by number only; an older save holding the recipe is refused',()=>{
    const {world:w,station}=workshop(),clean=serializeWorld(w);
    const migrated=deserializeWorld(asOldSchema(clean,372));
    expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
    expect(serializeWorld(migrated)).toBe(asNumberOnly(clean,372));
    expect(migrated.structures.find(s=>s.kind==='machining-table')?.bills).toEqual([]);
    station.bills!.push(newCookingBill(w.nextId++,'make-flak-pants'));
    const withBill=serializeWorld(w);
    expect(()=>deserializeWorld(withBill)).not.toThrow();
    expect(()=>deserializeWorld(asOldSchema(withBill,372))).toThrow();
  });

  test('trade requests see the pants as makeable from schema 375 only (Core makeable check)',()=>{
    const w=healrootCamp(32,1);
    delete w.worldMaps;delete w.worldGroups;delete w.worldFactions;delete w.planet;delete w.site;delete w.exploration;
    for(const p of w.pawns){delete p.background;p.priorities.craft=1;p.skills.crafting={level:0,xp:0,dailyXp:0,passion:0};}
    w.research=flakResearch();
    const s=fixtureBuilding(w,'machining-table',8,8) as Structure;s.material='steel';
    for(const [item,kind] of [['cloth','textile'],['steel','steel'],['component','component']] as const)w.piles.push({id:w.nextId++,kind,item,quantity:1,owner:{type:'ground',x:4,z:4+w.piles.length}});
    const now=captureTradeRequestAvailability284(w,w);
    expect(now.get('flak-pants')).toMatchObject({potential:3,makeable:true});
    expect(now.get('flak-vest')).toMatchObject({makeable:true});
    const old={...w,schemaVersion:372} as unknown as World,before=captureTradeRequestAvailability284(old,old);
    expect(before.get('flak-pants')).toMatchObject({potential:0,makeable:false});
    expect(before.get('flak-vest')).toMatchObject({makeable:true});
  });
});

describe('keys C and X are Core Designator_Cancel and Designator_Deconstruct',()=>{
  test('every palette and the map read C and X as Cancel and Deconstruct, with no other tool on these letters',()=>{
    expect(ORDERS_PALETTE_HOTKEYS.c).toBe('cancel');expect(ORDERS_PALETTE_HOTKEYS.x).toBe('deconstruct');
    expect(ZONES_PALETTE_HOTKEYS.c).toBe('cancel');expect(ZONES_PALETTE_HOTKEYS.x).toBe('deconstruct');
    expect(GLOBAL_TOOL_HOTKEYS.c).toBe('cancel');expect(GLOBAL_TOOL_HOTKEYS.x).toBe('deconstruct');
    for(const palette of ['orders','zones',undefined] as const){
      expect(paletteHotkeyTool(palette,'C')??globalHotkeyTool('c')).toBe('cancel');
      expect(paletteHotkeyTool(palette,'X')??globalHotkeyTool('x')).toBe('deconstruct');
    }
    const shown=(id:string)=>toolDefinitions.find(t=>t.id===id)?.key;
    expect(shown('cancel')).toBe('C');expect(shown('deconstruct')).toBe('X');
    expect(toolDefinitions.filter(t=>t.key==='C'||t.key==='X').map(t=>t.id).sort()).toEqual(['cancel','deconstruct']);
  });
  test('the help page and the loading tips name C Annuler and X Déconstruire',()=>{
    const tip=GAMEPLAY_TIPS.find(t=>/\bC\b/.test(t)&&/\bX\b/.test(t))!;
    expect(tip).toMatch(/C choisit Annuler et X Déconstruire/);expect(tip).not.toMatch(/Abattre/);
    const pages=buildNativeHelp({showPage:()=>{},panel:async()=>{},category:()=>{},tool:()=>{}} as never);
    const keys=pages.find(p=>p.id==='help-shortcuts')!.rows.find(r=>r.id==='key-tools')!;
    expect(keys.label).toBe('M / C / X / B / L / S');expect(keys.detail).toBe('Choisir Miner / Annuler / Déconstruire / Mur / Lit / Réserve.');
  });
});

describe('Core alert thresholds: Alert_Hypothermia and Alert_LowFood',()=>{
  test('low food counts Core human-edible nutrition in every slot group: beer and hoppers yes, hay and hops no',()=>{
    expect(LOW_FOOD_START_TICK*10).toBe(150_000);expect(LOW_FOOD_NUTRITION_PER_COLONIST).toBe(4);
    for(const item of ['hay','hops'])expect(coreHumanEdibleItem(item,'food')).toBe(false);
    for(const [item,kind] of [['beer','beer'],['kibble','food'],['milk','food'],['simple-meal','food'],['insect-jelly','food']] as const)expect(coreHumanEdibleItem(item,kind)).toBe(true);
    const w=deconstructionCamp(1);w.tick=LOW_FOOD_START_TICK;const free=freeColonistsSpawned(w);
    w.stockpiles.push({id:w.nextId++,x:3,z:3,priority:2,capacity:200,filters:{wood:false,food:true,beer:true}},{id:w.nextId++,x:3,z:4,priority:2,capacity:200,filters:{wood:false,food:true,beer:true}});
    addGroundMaterial(w,'food',75,{x:3,z:3},'hops');
    expect(storedHumanNutrition(w)).toBe(0); // 3.75 nutrition of hops: not human edible
    expect(readLowFood(w,free)?.key).toBe('food-reserves');
    addGroundMaterial(w,'beer',25,{x:3,z:4},'beer');
    expect(storedHumanNutrition(w)).toBeCloseTo(2,9); // 25 beers × 0.08
    expect(readLowFood(w,free)).toBeDefined();
    // A nutrient paste hopper is a Core slot group (Building_Storage).
    const hopper=fixtureBuilding(w,'hopper',8,8) as Structure;
    addGroundMaterial(w,'food',40,{x:hopper.x,z:hopper.z},'rice');
    expect(storedHumanNutrition(w)).toBeCloseTo(4,9);
    expect(readLowFood(w,free)).toBeUndefined();
    w.structures=w.structures.filter(s=>s!==hopper);
    expect(readLowFood(w,free)?.explanation).toMatch(/^Nourriture fraîche rangée : 2 de nutrition pour 1 personne, soit environ 2 jours\./);
  });

  test('serious hypothermia reads stage 3 (0.35), the safe range and the caravans’ tile air',()=>{
    expect(SERIOUS_HYPOTHERMIA).toBe(350_000_000);
    const f=reorganizationCamp256(false),w=f.w,g=f.g,member=g.members[0]!;
    member.health=createMedicalRecord(w.tick);member.health.hypothermia=SERIOUS_HYPOTHERMIA;
    const air=groupAmbientTemperature256(w,g),range=offmapThermalRange259(member,g.items);
    if(typeof range==='string')throw Error(range);
    expect(air).toBeGreaterThanOrEqual(range.min-10); // a mild tile: inside the safe range
    expect(readSeriousHypothermia(w,[])).toBeUndefined();
    const tile=(w.planet as unknown as {tiles:{meanTemperature:number}[]}).tiles[g.tile]!,mild=tile.meanTemperature;
    tile.meanTemperature=mild-60;
    expect(groupAmbientTemperature256(w,g)).toBeLessThan(range.min-10);
    const alert=readSeriousHypothermia(w,[])!;
    expect(alert).toMatchObject({key:'hypothermia',text:'1 colon en hypothermie grave'});
    expect(alert.explanation).toContain(member.name);
    member.health.hypothermia=SERIOUS_HYPOTHERMIA-1; // stage 2 (minor): no alert
    expect(readSeriousHypothermia(w,[])).toBeUndefined();
    tile.meanTemperature=mild;
  });
});

describe('the research view reads the simulation’s prerequisites (one source)',()=>{
  const nodes=new Set(researchProjects.map(p=>p.id));
  test('every drawn link is a real prerequisite and every prerequisite is drawn',()=>{
    const drawn=new Set(researchLinks.map(([from,to])=>`${from}>${to}`));
    expect(drawn.size).toBe(researchLinks.length);
    for(const [from,to] of researchLinks)expect(researchParentProjects(to,SCHEMA_VERSION),`${from} → ${to}`).toContain(from);
    for(const project of researchProjects)for(const parent of researchParentProjects(project.id,SCHEMA_VERSION)){
      expect(nodes.has(parent),parent).toBe(true);
      expect(drawn.has(`${parent}>${project.id}`),`${parent} → ${project.id}`).toBe(true);
    }
    // Every project of the simulation has its node.
    expect([...nodes].sort()).toEqual(Object.keys(RESEARCH_PREREQUISITES).sort());
  });

  test('listed prerequisites are the simulation’s, in Core order, with Electricity known from the start',()=>{
    for(const project of researchProjects){
      const p=RESEARCH_PREREQUISITES[project.id];
      expect(researchPrerequisiteLabels.get(project.id)).toEqual([...p.visible,...p.hidden].map(parent=>RESEARCH_PARENT_LABELS[parent]));
      // The words of a prerequisite are its node title.
      expect(RESEARCH_PARENT_LABELS[project.id]).toBe(project.title);
    }
    expect(researchPrerequisiteLabels.get('machining')).toEqual(['Électricité (acquise au départ)','Forge']);
    expect(researchPrerequisiteLabels.get('vitals-monitor')).toEqual(['Multi-analyseur','Lit d’hôpital']);
    expect(researchPrerequisiteLabels.get('flak-armor')).toEqual(['Usinage','Armure de plaques']);
    expect(researchPrerequisiteLabels.get('batteries')).toEqual(['Électricité (acquise au départ)']);
  });

  test('the simulation refuses a project from the same table, first missing parent first',()=>{
    const all=Object.keys(RESEARCH_PREREQUISITES) as ResearchProject[];
    const done=(skip:ReadonlySet<ResearchProject>)=>{const w=deconstructionCamp(1),research:ResearchState={project:null,points:0};
      for(const id of all)if(!skip.has(id))projectProgress(research,id).completedAt=0;
      w.research=research;return w;};
    for(const project of all){
      const parents=researchParentProjects(project,SCHEMA_VERSION);
      expect(researchPrerequisite(done(new Set()),project),project).toBeUndefined();
      for(const [i,parent] of parents.entries()){
        // Every parent before this one is complete; this one and the next are missing.
        const missing=new Set(parents.slice(i));
        expect(researchPrerequisite(done(missing),project),`${project} without ${parent}`).toBe(RESEARCH_PARENT_LABELS[parent]);
      }
    }
    // Core GunTurrets needs BlowbackOperation; before schema 340 Elsewhere kept Gunsmithing.
    expect(researchPrerequisitesAt('gun-turrets',SCHEMA_VERSION).visible).toEqual(['blowback-operation']);
    expect(researchPrerequisitesAt('gun-turrets',339).visible).toEqual(['gunsmithing']);
  });

  test('the table matches the Core ResearchProjectDefs, with the declared adaptations',()=>{
    // Core prerequisites / hiddenPrerequisites read from Data/Core/Defs/ResearchProjectDefs.
    const core:Readonly<Partial<Record<ResearchProject,readonly [readonly string[],readonly string[]]>>>={
      'tube-television':[['electricity'],['complex-furniture']],machining:[['electricity','smithing'],[]],'flak-armor':[['machining'],['plate-armor']],
      'hospital-bed':[['microelectronics'],['sterile-materials','complex-furniture']],'multi-analyzer':[['microelectronics'],['machining']],
      'long-range-mineral-scanner':[['microelectronics'],['machining']],'vitals-monitor':[['multi-analyzer','hospital-bed'],[]],
      'recon-armor':[['fabrication'],['complex-clothing']],'ship-cryptosleep':[['ship-basics'],['cryptosleep']],'ship-sensors':[['ship-basics'],['long-range-mineral-scanner']],
      'precision-rifling':[['gas-operation','microelectronics'],[]],'medicine-production':[['drug-production','microelectronics'],[]],
      'plate-armor':[['smithing','complex-clothing'],[]],'packaged-survival-meals':[['nutrient-paste'],[]],'gun-turrets':[['blowback-operation'],[]],
    };
    const adaptations:Readonly<Partial<Record<ResearchProject,string>>>={'hospital-bed':'sterile-materials','packaged-survival-meals':'nutrient-paste'};
    for(const [project,[visible,hidden]] of Object.entries(core) as [ResearchProject,readonly [readonly string[],readonly string[]]][]){
      const table=RESEARCH_PREREQUISITES[project],omitted=adaptations[project];
      expect(table.visible,project).toEqual(visible.filter(p=>p!==omitted));
      expect(table.hidden,project).toEqual(hidden.filter(p=>p!==omitted));
    }
  });
});
