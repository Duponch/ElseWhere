import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, stepWorld } from '../src/sim/engine';
import { addGroundMaterial, refreshStock } from '../src/sim/materials';
import { deserializeWorld, serializeWorld, validateWorld } from '../src/sim/serialization';
import { constructionRecipe, validConstructionMaterial } from '../src/sim/construction-materials';
import { footprintCells } from '../src/sim/definitions';
import { ITEM_DEFINITIONS } from '../src/sim/items';
import { bedComfort, bedRestEffectiveness, furnitureMaxHitPoints } from '../src/sim/furniture-stats';
import { bedSlotCell, bedSlotsCount } from '../src/sim/bed-slots';
import { structureBeauty } from '../src/sim/room-beauty';
import { LightEnvironmentCache } from '../src/sim/light-environment';
import { newPowerState } from '../src/sim/power-rules';
import { BATTERY_CAPACITY } from '../src/sim/power-battery';
import { BATTERIES_RESEARCH_COST } from '../src/sim/research';
import { WorkEnvironmentCache } from '../src/sim/work-environment';
import { architectToolAvailable } from '../src/ui/architect-availability';
import { tableLargeCells363, wallLampWallCell363 } from '../src/sim/furniture-c-363';
import { medicalCamp } from './scenarios/health';
import { fixtureBuilding } from './scenarios/deconstruction';
import { asOldSchema } from './scenarios/old-schema';
import { enclosedRoom } from './scenarios/cleanliness';
import { initializeDeclaredFixtureTick297 } from './scenarios/initial-core-clock-v492';
import { SCHEMA_VERSION, TICKS_PER_DAY, type Pawn, type Structure, type World } from '../src/sim/types';

const SLOW=60000;
/** Open 40×40 grass map, every colonist idle, fed and rested. */
function open(seed=363,pawns=1,tick=2000):World {
  const w=createWorld(seed,40,40);initializeDeclaredFixtureTick297(w,tick);
  if(w.deterioration)w.deterioration.lastTick=w.tick;
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
  w.pawns=w.pawns.slice(0,pawns);
  for(const [i,p] of w.pawns.entries()){p.x=8+i;p.z=8;p.path=[];p.state='idle';p.hunger=100;p.rest=100;p.recreation.level=100;}
  refreshStock(w);return w;
}
function builder(w:World):Pawn {
  const p=w.pawns[0]!;p.schedule.fill('work');
  for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  p.priorities.build=1;p.priorities.haul=1;p.skills.construction={level:8,xp:0,dailyXp:0,passion:0};return p;
}
function buildThrough(w:World,kind:Structure['kind'],max=6000):Structure {
  for(let i=0;i<max&&!w.structures.some(s=>s.kind===kind);i++){stepWorld(w);if(i%400===0)expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);}
  const built=w.structures.find(s=>s.kind===kind);expect(built,`${kind} built`).toBeDefined();
  expect(validateWorld(w)).toEqual([]);return built!;
}
function reload(w:World):World {
  const json=serializeWorld(w),a=deserializeWorld(json),b=deserializeWorld(json);
  expect(validateWorld(a)).toEqual([]);expect(a).toEqual(w);
  stepWorld(a,30);stepWorld(b,30);expect(a).toEqual(b);return a;
}

describe('schema 363: Core table (3×3), double sleeping spot, double bedroll and wall lamp', () => {
 it('takes every number from Buildings_Furniture.xml', () => {
  expect(constructionRecipe({kind:'table-large',material:'steel'}).ingredients).toEqual([{item:'steel',quantity:100}]);
  expect(constructionRecipe({kind:'table-large',material:'steel'}).coreWork).toBe(3300);
  expect(constructionRecipe({kind:'table-large',material:'wood'}).coreWork).toBe(2310);
  expect(constructionRecipe({kind:'double-bedroll',material:'cloth'}).ingredients).toEqual([{item:'cloth',quantity:85}]);
  expect(constructionRecipe({kind:'double-bedroll',material:'cloth'}).coreWork).toBe(1100);
  expect(constructionRecipe({kind:'wall-lamp',material:'steel'})).toMatchObject({ingredients:[{item:'steel',quantity:15}],coreWork:330});
  for(const [kind,material] of [['table-large','granite-blocks'],['double-bedroll','light-leather'],['wall-lamp','steel']] as const){
   expect(validConstructionMaterial(kind,material,363)).toBe(true);
   expect(validConstructionMaterial(kind,material,362)).toBe(false);
  }
  expect(validConstructionMaterial('table-large','cloth',363)).toBe(false);
  expect(validConstructionMaterial('double-bedroll','wood',363)).toBe(false);
  expect(validConstructionMaterial('double-sleeping-spot',undefined,363)).toBe(true);
  expect(furnitureMaxHitPoints('table-large','steel')).toBe(175);
  expect(furnitureMaxHitPoints('double-bedroll','cloth')).toBe(100);
  expect(bedRestEffectiveness({kind:'double-bedroll',material:'cloth',quality:'normal'})).toBeCloseTo(.95,12);
  expect(bedComfort({kind:'double-bedroll',material:'cloth',quality:'normal'})).toBeCloseTo(.68,12);
  expect(bedRestEffectiveness({kind:'double-sleeping-spot'})).toBe(.8);
  expect(bedComfort({kind:'double-sleeping-spot'})).toBe(.4);
  expect(structureBeauty({kind:'table-large',x:0,z:0,material:'steel',quality:'normal'},363)).toBe(2);
  expect(tableLargeCells363({x:5,z:5})).toHaveLength(9);
  expect(wallLampWallCell363({x:5,z:5,orientation:1})).toEqual({x:6,z:5});
  const w=open();
  for(const tool of ['table-large','double-bedroll','double-sleeping-spot','wall-lamp'] as const){
   expect(architectToolAvailable(w,tool)).toBe(true);
   expect(architectToolAvailable({...w,schemaVersion:362} as unknown as World,tool)).toBe(false);
  }
 });

 it('a colonist builds the 3×3 table, another eats at it from a stool; it is a gathering spot and a dining room', () => {
  const w=open(363,2),b=builder(w),eater=w.pawns[1]!;
  eater.schedule.fill('anything');for(const key of Object.keys(eater.priorities) as (keyof Pawn['priorities'])[])eater.priorities[key]=0;
  addGroundMaterial(w,'wood',100,{x:12,z:12});refreshStock(w);
  expect(applyCommand(w,{type:'designate',kind:'table-large',x:20,z:20,material:'wood',orientation:1}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'table-large',x:20,z:20,material:'wood'}).ok).toBe(true);
  expect(footprintCells(w.jobs.at(-1)!)).toHaveLength(9);
  const table=buildThrough(w,'table-large');
  expect(footprintCells(table).map(c=>`${c.x},${c.z}`).sort()).toEqual(tableLargeCells363({x:20,z:20}).map(c=>`${c.x},${c.z}`).sort());
  expect(table.material).toBe('wood');expect(table.quality).toBeDefined();
  expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(0);
  b.priorities.build=0;b.priorities.haul=0;
  // A stool on the 12-seat ring, a meal on the ground, a hungry colonist.
  const stool=fixtureBuilding(w,'stool',22,20);Object.assign(stool,{material:'wood'});
  addGroundMaterial(w,'food',1,{x:16,z:16});refreshStock(w);
  eater.hunger=20;eater.needCooldown=0;eater.planCooldown=0;
  let tableId:number|null|undefined,saved:string|undefined;
  for(let i=0;i<900&&eater.hunger<=20;i++){
   stepWorld(w);
   if(eater.need?.kind==='eat'&&eater.need.phase==='ingest'){tableId??=eater.need.dining?.tableId;saved??=serializeWorld(w);}
  }
  expect(tableId).toBe(table.id);
  expect(eater.hunger).toBeGreaterThan(20);
  expect(eater.memories.some(m=>m.kind==='ate-without-table')).toBe(false);
  const a=deserializeWorld(saved!),c=deserializeWorld(saved!);expect(validateWorld(a)).toEqual([]);
  stepWorld(a,60);stepWorld(c,60);expect(a).toEqual(c);
  // Gathering spot toggle like the other tables.
  expect(applyCommand(w,{type:'gather-spot',structureId:table.id,enabled:false}).ok).toBe(true);
  expect(table.gatherSpot).toBe(false);
  reload(w);
  // Minifiable like the other tables: uninstalled into one packed table, same identity and quality.
  b.priorities.build=1;
  expect(applyCommand(w,{type:'designate',kind:'uninstall',x:21,z:21}).ok).toBe(true);
  for(let i=0;i<2000&&!w.packed.some(p=>p.building.id===table.id);i++)stepWorld(w);
  const packed=w.packed.find(p=>p.building.id===table.id);
  expect(packed?.building).toMatchObject({kind:'table-large',material:'wood',quality:table.quality});
  expect(w.structures.some(s=>s.kind==='table-large')).toBe(false);
  expect(validateWorld(w)).toEqual([]);
  reload(w);
 }, SLOW);

 it('the 3×3 table makes an enclosed room a dining room, worth 12 as RoomRoleWorker_DiningRoom', () => {
  const w=open();enclosedRoom(w,{x:10,z:10},9);
  Object.assign(fixtureBuilding(w,'table-large',14,14),{material:'wood'});
  expect(new WorkEnvironmentCache().read(w).room({x:12,z:12})?.role).toBe('dining');
 });

 it('two colonists sleep side by side on a double sleeping spot placed at once', () => {
  const w=medicalCamp(2);
  for(const [i,p] of w.pawns.entries()){Object.assign(p,{x:5+i*10,z:10,rest:10,hunger:100,needCooldown:0,planCooldown:0});p.schedule.fill('anything');}
  const rng=w.rng,before=w.nextId;
  expect(applyCommand(w,{type:'designate',kind:'double-sleeping-spot',x:10,z:10,orientation:0}).ok).toBe(true);
  const spot=w.structures.find(s=>s.kind==='double-sleeping-spot')!;
  expect(spot.id).toBe(before);expect(w.rng).toBe(rng);expect(w.jobs).toEqual([]);
  expect(spot).toEqual({id:spot.id,kind:'double-sleeping-spot',x:10,z:10,orientation:0,footprint:'standard'});
  expect(bedSlotsCount(spot)).toBe(2);expect(footprintCells(spot)).toHaveLength(4);
  const [a,b]=w.pawns as [Pawn,Pawn];
  expect(applyCommand(w,{type:'assign-bed',bedId:spot.id,pawnId:a.id,slot:0}).ok).toBe(true);
  expect(applyCommand(w,{type:'assign-bed',bedId:spot.id,pawnId:b.id,slot:1}).ok).toBe(true);
  expect(validateWorld(w)).toEqual([]);
  let saved:string|undefined;
  for(let i=0;i<300&&![a,b].every(p=>p.need?.kind==='sleep'&&p.need.phase==='sleep'&&p.moveCooldown===0);i++){stepWorld(w);if(a.need?.kind==='sleep'&&a.need.phase==='travel')saved??=serializeWorld(w);}
  expect({x:a.x,z:a.z}).toEqual(bedSlotCell(spot,0));expect({x:b.x,z:b.z}).toEqual(bedSlotCell(spot,1));
  // Ground rest: the spot sleeps like the single sleeping spot (0.8).
  const rest=[a.rest,b.rest];stepWorld(w,4);expect(a.rest).toBeGreaterThan(rest[0]!);expect(b.rest).toBeGreaterThan(rest[1]!);
  expect(validateWorld(w)).toEqual([]);
  expect(saved).toBeDefined();const c=deserializeWorld(saved!);expect(validateWorld(c)).toEqual([]);
  reload(w);
  // A prisoner or medical role is refused (two civil places), removal is immediate.
  expect(applyCommand(w,{type:'medical-bed',bedId:spot.id,enabled:true}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'deconstruct',x:11,z:11}).ok).toBe(true);
  expect(w.structures.some(s=>s.kind==='double-sleeping-spot')).toBe(false);
  expect(validateWorld(w)).toEqual([]);
 }, SLOW);

 it('a colonist builds a cloth double bedroll, then two colonists sleep in its two places', () => {
  const w=medicalCamp(3),b=w.pawns[2]!;
  for(const key of Object.keys(b.priorities) as (keyof Pawn['priorities'])[])b.priorities[key]=0;
  Object.assign(b,{x:4,z:4,rest:100,hunger:100});b.priorities.build=1;b.priorities.haul=1;b.skills.construction={level:8,xp:0,dailyXp:0,passion:0};
  const [p,q]=w.pawns as [Pawn,Pawn];
  for(const [i,s] of [p,q].entries())Object.assign(s,{x:5+i*10,z:20,rest:100,hunger:100});
  addGroundMaterial(w,ITEM_DEFINITIONS.cloth.kind,85,{x:6,z:6},'cloth');refreshStock(w);
  expect(applyCommand(w,{type:'designate',kind:'double-bedroll',x:10,z:10,material:'cloth',orientation:0}).ok).toBe(true);
  const bedroll=buildThrough(w,'double-bedroll');
  expect(bedroll.material).toBe('cloth');expect(bedroll.quality).toBeDefined();expect(bedSlotsCount(bedroll)).toBe(2);
  b.priorities.build=0;b.priorities.haul=0;
  expect(applyCommand(w,{type:'assign-bed',bedId:bedroll.id,pawnId:p.id,slot:0}).ok).toBe(true);
  expect(applyCommand(w,{type:'assign-bed',bedId:bedroll.id,pawnId:q.id,slot:1}).ok).toBe(true);
  for(const s of [p,q]){s.rest=10;s.needCooldown=0;s.planCooldown=0;s.schedule.fill('anything');}
  for(let i=0;i<400&&![p,q].every(s=>s.need?.kind==='sleep'&&s.need.phase==='sleep'&&s.moveCooldown===0);i++)stepWorld(w);
  expect({x:p.x,z:p.z}).toEqual(bedSlotCell(bedroll,0));expect({x:q.x,z:q.z}).toEqual(bedSlotCell(bedroll,1));
  const rest=[p.rest,q.rest];stepWorld(w,4);expect(p.rest).toBeGreaterThan(rest[0]!);expect(q.rest).toBeGreaterThan(rest[1]!);
  expect(validateWorld(w)).toEqual([]);
  reload(w);
 }, SLOW);

 it('a wall lamp hangs on a wall, is built with steel and lights its cell from a battery at night', () => {
  const w=open(363,1,TICKS_PER_DAY*2+5600),b=builder(w); // 22 h 24: night.
  for(let z=15;z<=25;z++)Object.assign(fixtureBuilding(w,'wall',20,z),{material:'wood'});
  expect(applyCommand(w,{type:'designate',kind:'wall-lamp',x:10,z:10,material:'steel',orientation:1}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'wall-lamp',x:19,z:20,material:'steel',orientation:3}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'wall-lamp',x:19,z:20,material:'steel',orientation:1}).ok).toBe(true);
  addGroundMaterial(w,'steel',15,{x:12,z:12});refreshStock(w);
  const lamp=buildThrough(w,'wall-lamp');
  expect(lamp.orientation).toBe(1);expect(lamp.power).toBeDefined();
  b.priorities.build=0;b.priorities.haul=0;
  const dark=new LightEnvironmentCache().read(w).lightAt({x:19,z:20});
  w.research??={project:null,points:0};w.research.batteries={points:BATTERIES_RESEARCH_COST,completedAt:0};
  const battery:Structure={id:w.nextId++,kind:'battery',x:17,z:20,orientation:0,footprint:'standard',material:'steel',power:newPowerState('battery'),battery:{stored:BATTERY_CAPACITY/2}};
  w.structures.push(battery);Object.assign(fixtureBuilding(w,'power-conduit',18,20),{material:'steel',power:newPowerState('power-conduit')});
  for(let i=0;i<300&&!lamp.power?.on;i++)stepWorld(w);
  expect(lamp.power?.on).toBe(true);
  const lit=new LightEnvironmentCache().read(w).lightAt({x:19,z:20});
  expect(lit).toBeGreaterThan(dark);expect(lit).toBeGreaterThan(.3);
  expect(validateWorld(w)).toEqual([]);
  reload(w);
 }, SLOW);

 it('nothing exists below 363: the four kinds are refused, a 362 save migrates by its number only', () => {
  const w=open();
  const old=deserializeWorld(asOldSchema(serializeWorld(w),362));
  expect(old.schemaVersion).toBe(SCHEMA_VERSION);
  const relabelled={...structuredClone(w),schemaVersion:362} as unknown as World;
  for(const kind of ['table-large','double-bedroll','wall-lamp','double-sleeping-spot'] as const)
   expect(applyCommand(relabelled,{type:'designate',kind,x:20,z:20,...(kind==='double-sleeping-spot'?{}:{material:kind==='double-bedroll'?'cloth':kind==='wall-lamp'?'steel':'wood'})}).ok,kind).toBe(false);
  // A current save holding one of the new kinds cannot claim an older schema.
  const withTable=open();Object.assign(fixtureBuilding(withTable,'table-large',20,20),{material:'wood'});
  expect(validateWorld(withTable)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withTable),362))).toThrow();
  const withSpot=open();withSpot.structures.push({id:withSpot.nextId++,kind:'double-sleeping-spot',x:20,z:20,orientation:0,footprint:'standard'});
  expect(validateWorld(withSpot)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withSpot),362))).toThrow();
  // A colony without the new kinds plays the same ticks at 362 and 363.
  const a=open(9),c=deserializeWorld(asOldSchema(serializeWorld(a),362));
  stepWorld(a,200);stepWorld(c,200);expect(c).toEqual(a);
 }, SLOW);
});
