import {expect,test} from 'vitest';
import {applyCommand,stepWorld,serializeWorld,deserializeWorld,validateWorld} from '../src/sim/index.ts';
import {addGroundMaterial,refreshStock} from '../src/sim/materials.ts';
import {constructionRecipe,constructionSkillRequired,validConstructionMaterial} from '../src/sim/construction-materials.ts';
import {STRUCTURE_DEFINITIONS,footprintCells} from '../src/sim/definitions.ts';
import {structureMaxHp} from '../src/sim/thing-damage-rules.ts';
import {groupPackedMassGrams258} from '../src/sim/group-freight-mass-258.ts';
import {WorkEnvironmentCache} from '../src/sim/work-environment.ts';
import {RoomTopologyCache} from '../src/sim/room-topology.ts';
import {RoomQualityCapture} from '../src/sim/room-quality.ts';
import {FLOOR_DEFINITIONS,FLOOR_KINDS,burnFloor,floorAvailable} from '../src/sim/flooring.ts';
import {floorBeauty} from '../src/sim/room-beauty.ts';
import {ensureFireState} from '../src/sim/fire-rules.ts';
import {validateResearch,validCarpetResearchTransport355} from '../src/sim/research-save.ts';
import {MACHINING_RESEARCH_COST,SMITHING_RESEARCH_COST,COMPLEX_FURNITURE_RESEARCH_COST,RESEARCH_SCALE,needsHighTechBench,researchCost,researchPrerequisite,researchUnlocked,selectResearch} from '../src/sim/research.ts';
import {RECURVE_BOW_RESEARCH_COST326} from '../src/sim/research.ts';
import {TOOL_CABINET_BENCHES_355,TOOL_CABINET_FACTS_355,linkedToolCabinets355,toolCabinetDistance355,toolCabinetLinkedBenches355,toolCabinetWorkSpeedOffset355} from '../src/sim/tool-cabinet-355.ts';
import {CARPET_COLOR_IDS_355,CARPET_FLOORS_355,CARPET_RESEARCH_355,carpetColor355,carpetLabel355} from '../src/sim/carpet-355.ts';
import {toolCabinetInspection355} from '../src/ui/tool-cabinet-inspection-355.ts';
import {architectToolAvailable} from '../src/ui/architect-availability.ts';
import {newPowerState} from '../src/sim/power-rules.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Command,type Structure,type World} from '../src/sim/types.ts';

const accept=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(c)+JSON.stringify(r)).toMatchObject({ok:true});};
function until(w:World,done:()=>boolean,limit=4000){
  for(let i=0;i<limit&&!done();i++){stepWorld(w);if(i%250===0)expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);}
  expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs.map(j=>({kind:j.kind,status:j.status,progress:j.progress})),pawns:w.pawns.map(p=>({state:p.state,job:p.jobId,haul:p.haul}))})).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
/** Declared prepared research: ComplexFurniture (a Crashlanded start) and RecurveBow. */
const knownResearch=():World['research']=>({project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0},recurveBow:{points:RECURVE_BOW_RESEARCH_COST326,completedAt:0}});
const cabinet=(w:World,x:number,z:number,orientation:0|1|2|3=0):Structure=>{const s={id:w.nextId++,kind:'tool-cabinet',x,z,orientation,footprint:'standard',material:'steel'} as Structure;w.structures.push(s);return s;};
/** Declared 32² workshop: one builder-crafter, a crafting spot, 200 steel and
 * 60 wood on the ground. No cabinet, bill or unfinished thing at the start. */
function workshop(){
  const w=deconstructionCamp(1,32),pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.build=1;pawn.priorities.craft=2;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.construction={level:8,xp:0,dailyXp:0,passion:0};pawn.skills.crafting={level:8,xp:0,dailyXp:0,passion:0};
  w.research=knownResearch();
  const spot={id:w.nextId++,kind:'crafting-spot',x:10,z:10,orientation:0,footprint:'standard',bills:[]} as unknown as Structure;
  w.structures.push(spot);
  addGroundMaterial(w,'steel',200,{x:16,z:14},'steel');addGroundMaterial(w,'wood',60,{x:13,z:13},'wood');refreshStock(w);
  expect(w.schemaVersion).toBe(SCHEMA_VERSION);expect(validateWorld(w)).toEqual([]);
  return {w,pawn,spot};
}
/** Declared two-room camp, as tests/scenarios/rooms.ts but at its own valid
 * tick: left room 11–14 × 11–19, right room 16–19 × 11–19, door at (15,15). */
function roomCamp():World {
  const w=deconstructionCamp(1,32);
  for(let x=11;x<20;x++){fixtureBuilding(w,'wall',x,10);fixtureBuilding(w,'wall',x,20);}
  for(let z=11;z<20;z++){fixtureBuilding(w,'wall',10,z);fixtureBuilding(w,'wall',20,z);if(z!==15)fixtureBuilding(w,'wall',15,z);}
  w.structures.push({id:w.nextId++,kind:'door',x:15,z:15,material:'wood',orientation:0,footprint:'standard',door:newDoorState(w.tick)});
  const p=w.pawns[0]!;p.x=17;p.z=15;return w;
}
const factor=(w:World,station:Structure)=>new WorkEnvironmentCache().read(w).production(station,station,false,toolCabinetWorkSpeedOffset355(w,station)).station;

test('the tool cabinet has the Core ToolCabinet facts: 200 steel, 1800 work, 2 × 1, Construction 4, ComplexFurniture, twelve linkable benches',()=>{
  expect(TOOL_CABINET_FACTS_355).toMatchObject({steel:200,coreWork:1800,constructionSkill:4,maxHitPoints:100,massGrams:20000,flammability:.5,pathCost:42,workSpeedOffset:.06,maxSimultaneous:2,maxDistance:8});
  expect(constructionRecipe({kind:'tool-cabinet',material:'steel'})).toEqual({ingredients:[{item:'steel',quantity:200}],work:180,coreWork:1800});
  expect(validConstructionMaterial('tool-cabinet','steel',355)).toBe(true);
  expect(validConstructionMaterial('tool-cabinet','wood',355)).toBe(false);
  expect(validConstructionMaterial('tool-cabinet','steel',354)).toBe(false);
  expect(constructionSkillRequired('tool-cabinet',355)).toBe(4);
  expect(STRUCTURE_DEFINITIONS['tool-cabinet']).toMatchObject({width:2,depth:1,blocksMovement:false});
  // Core 2 × 1 rotation: the second cell follows the long axis of each Rot4.
  expect([0,1,2,3].map(o=>footprintCells({kind:'tool-cabinet',x:5,z:5,orientation:o as 0,footprint:'standard'}))).toEqual([
    [{x:5,z:5},{x:6,z:5}],[{x:5,z:5},{x:5,z:4}],[{x:5,z:5},{x:4,z:5}],[{x:5,z:5},{x:5,z:6}]]);
  expect(structureMaxHp({kind:'tool-cabinet',material:'steel'} as Structure)).toBe(100);
  expect(groupPackedMassGrams258({building:{kind:'tool-cabinet'}} as never,355)).toBe(20000);
  expect(groupPackedMassGrams258({building:{kind:'tool-cabinet'}} as never,354)).toBeUndefined();
  expect([...TOOL_CABINET_BENCHES_355].sort()).toEqual(['art-bench','butcher-spot','butcher-table','crafting-spot','drug-lab','electric-smithy','electric-tailor-bench','fabrication-bench','fueled-smithy','machining-table','stonecutter','tailor-bench']);
  const {w}=workshop();w.research={project:null,points:0};
  expect(architectToolAvailable(w,'tool-cabinet')).toBe(false);
  const before=serializeWorld(w);expect(applyCommand(w,{type:'designate',kind:'tool-cabinet',x:10,z:7}).ok).toBe(false);expect(serializeWorld(w)).toBe(before);
  w.research=knownResearch();expect(architectToolAvailable(w,'tool-cabinet')).toBe(true);
  expect(applyCommand(w,{type:'designate',kind:'tool-cabinet',material:'wood',x:10,z:7}).ok).toBe(false);
});

test('a builder lays a paid tool cabinet next to the crafting spot; a crafter then works the bill 12 % faster, 24 % with two, never more',()=>{
  const {w,pawn,spot}=workshop();
  accept(w,{type:'designate',kind:'tool-cabinet',x:10,z:7,orientation:0});
  const job=w.jobs.find(j=>j.kind==='tool-cabinet')!;expect(job.material).toBe('steel');
  until(w,()=>job.progress>20&&job.progress<180);
  const saved=deserializeWorld(serializeWorld(w)),at=w.tick;
  until(w,()=>w.structures.some(s=>s.kind==='tool-cabinet'));stepWorld(saved,w.tick-at);expect(serializeWorld(saved)).toBe(serializeWorld(w));
  const built=w.structures.find(s=>s.kind==='tool-cabinet')!;
  expect(built).toMatchObject({kind:'tool-cabinet',material:'steel',x:10,z:7,orientation:0,footprint:'standard'});expect(built.quality).toBeUndefined();
  expect(quantity(w,'steel')).toBe(0);
  // Core: crafting spot WorkTableWorkSpeedFactor 0.5 + 0.06, the spot at FloorEmplacement altitude.
  expect(linkedToolCabinets355(w,spot)).toEqual([built]);expect(toolCabinetLinkedBenches355(w,built)).toEqual([spot]);
  expect(factor(w,spot)).toBeCloseTo(.56,12);
  expect(toolCabinetInspection355(w,spot)).toBe('Installations liées : armoire à outils · vitesse de travail +6 %');
  expect(toolCabinetInspection355(w,built)).toContain('Lié à 1 établi(s) : Emplacement d’artisanat');
  // The real bill: a recurve bow from 40 wood, worked at the spot.
  pawn.priorities.build=0;
  accept(w,{type:'bill-add',structureId:spot.id,recipe:'make-recurve-bow'});
  until(w,()=>w.piles.some(p=>p.item==='unfinished-bow'&&(p.smithingWork?.progress??0)>0));
  // Same instant, four colonies: none, the built cabinet, a second and a third.
  const base=JSON.parse(serializeWorld(w)) as {structures:Structure[]};base.structures=base.structures.filter(s=>s.kind!=='tool-cabinet');
  const none=deserializeWorld(JSON.stringify(base)),one=deserializeWorld(serializeWorld(w)),two=deserializeWorld(serializeWorld(w)),three=deserializeWorld(serializeWorld(w));
  cabinet(two,12,8,1);cabinet(three,12,8,1);cabinet(three,5,10,1);
  for(const world of [none,one,two,three])expect(validateWorld(world)).toEqual([]);
  expect(linkedToolCabinets355(three,three.structures.find(s=>s.id===spot.id)!).map(s=>`${s.x},${s.z}`)).toEqual(['10,7','12,8']);
  expect([none,one,two,three].map(world=>factor(world,world.structures.find(s=>s.id===spot.id)!))).toEqual([.5,.56,.62,.62].map(v=>expect.closeTo(v,12)));
  const progress=(world:World)=>world.piles.find(p=>p.item==='unfinished-bow')!.smithingWork!.progress;
  const start=[none,one,two,three].map(progress);
  for(const world of [none,one,two,three])stepWorld(world,300);
  const gained=[none,one,two,three].map((world,i)=>progress(world)-start[i]!);
  expect(gained[0]).toBeGreaterThan(0);
  expect(gained[1]!/gained[0]!).toBeCloseTo(.56/.5,2);expect(gained[2]!/gained[0]!).toBeCloseTo(.62/.5,2);expect(gained[3]).toBe(gained[2]);
  // The faster bench finishes the bow; the save of the linked bench resumes exactly.
  const copy=deserializeWorld(serializeWorld(two)),mark=two.tick;
  until(two,()=>two.piles.some(p=>p.item==='recurve-bow'),6000);stepWorld(copy,two.tick-mark);expect(serializeWorld(copy)).toBe(serializeWorld(two));
});

test('Core facility limits: eight cells between true centers in 3D, line of sight, nearest two; walls and doors keep a bench in another room unlinked',()=>{
  const w=roomCamp();w.resources=[];w.research={...knownResearch()!,smithing:{points:SMITHING_RESEARCH_COST,completedAt:0},machining:{points:MACHINING_RESEARCH_COST,completedAt:0}};
  // Left room 11–14 × 11–19, right room 16–19 × 11–19, door at (15,15).
  const table={id:w.nextId++,kind:'machining-table',x:12,z:12,orientation:0,footprint:'standard',material:'steel',power:newPowerState('machining-table'),bills:[]} as unknown as Structure;
  w.structures.push(table);
  const behindWall=cabinet(w,16,12);
  expect(validateWorld(w)).toEqual([]);
  expect(toolCabinetDistance355(table,behindWall)).toBeCloseTo(4.5,12);
  expect(linkedToolCabinets355(w,table)).toEqual([]);expect(factor(w,table)).toBe(1);
  // The only sight line crosses the door: a closed door blocks, as at Core's relink.
  const doorView=cabinet(w,17,15),spotLeft={id:w.nextId++,kind:'crafting-spot',x:12,z:15,orientation:0,footprint:'standard',bills:[]} as unknown as Structure;w.structures.push(spotLeft);
  expect(linkedToolCabinets355(w,spotLeft)).toEqual([]);
  // Removing the wall (a real structure change) links the cabinet at once.
  w.structures=w.structures.filter(s=>!(s.kind==='wall'&&s.x===15&&s.z===12));
  expect(linkedToolCabinets355(w,table)).toEqual([behindWall]);expect(factor(w,table)).toBeCloseTo(1.06,12);
  // Distance: 7.5 links a Building-layer bench, but not a crafting spot, whose altitude counts too.
  const open=deconstructionCamp(1,32);open.research=knownResearch();
  const bench={id:open.nextId++,kind:'stonecutter',x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[]} as unknown as Structure;
  const spot={id:open.nextId++,kind:'crafting-spot',x:10,z:20,orientation:0,footprint:'standard',bills:[]} as unknown as Structure;
  open.structures.push(bench,spot);
  const atEight=cabinet(open,17,10,0),far=cabinet(open,19,11,1);
  expect(toolCabinetDistance355(bench,atEight)).toBeCloseTo(7.5,12);
  expect(linkedToolCabinets355(open,bench)).toEqual([atEight]);
  const nearSpot=cabinet(open,17,20,0);
  // Horizontal 7.5, but FloorEmplacement (7) to Building (15): sqrt(7.5² + (8 × 0.36585367)²) > 8.
  expect(toolCabinetDistance355(spot,nearSpot)).toBeGreaterThan(8);expect(linkedToolCabinets355(open,spot)).toEqual([]);
  expect(far.x).toBe(19);expect(toolCabinetDistance355(bench,far)).toBeGreaterThan(8);
  // A cabinet serves any number of benches; stoves and research desks are not linkable.
  const second={id:open.nextId++,kind:'tailor-bench',x:14,z:12,orientation:0,footprint:'standard',material:'wood',bills:[]} as unknown as Structure;
  const stove={id:open.nextId++,kind:'fueled-stove',x:14,z:8,orientation:0,footprint:'standard',material:'steel',bills:[]} as unknown as Structure;
  open.structures.push(second,stove);
  expect(toolCabinetLinkedBenches355(open,atEight).map(s=>s.kind)).toEqual(['stonecutter','tailor-bench']);
  expect(linkedToolCabinets355(open,second)).toEqual([atEight,far]);
  expect(linkedToolCabinets355(open,stove)).toEqual([]);
  // Hand tailoring 0.5 + 2 × 0.06; an unpowered electric tailoring bench (1 + 2 × 0.06) × 0.5.
  expect(factor(open,second)).toBeCloseTo(.62,12);
  const electric={id:open.nextId++,kind:'electric-tailor-bench',x:14,z:14,orientation:0,footprint:'standard',material:'wood',power:newPowerState('electric-tailor-bench'),bills:[]} as unknown as Structure;
  open.structures.push(electric);expect(electric.power?.on).toBeFalsy();
  expect(linkedToolCabinets355(open,electric)).toEqual([atEight,far]);expect(factor(open,electric)).toBeCloseTo(.56,12);
  // Natural rock between them is a line-of-sight blocker; mining it relinks.
  const rockWorld=deconstructionCamp(1,32);rockWorld.research=knownResearch();
  const desk={id:rockWorld.nextId++,kind:'art-bench',x:10,z:10,orientation:0,footprint:'standard',material:'wood',bills:[]} as unknown as Structure;rockWorld.structures.push(desk);
  const beyond=cabinet(rockWorld,14,10,1);
  expect(linkedToolCabinets355(rockWorld,desk)).toEqual([beyond]);
  rockWorld.tiles=rockWorld.tiles.map((t,i)=>i===10*rockWorld.width+12?{...t,terrain:'rock'}:t);
  expect(linkedToolCabinets355(rockWorld,desk)).toEqual([]);
});

test('CarpetMaking is researched at a simple desk, a cloth carpet is laid in a room, adds its beauty, burns and is removed with Core refunds',()=>{
  expect(CARPET_RESEARCH_355).toMatchObject({points:800,techLevel:'Medieval'});
  expect(researchCost('carpet-making')).toBe(800*RESEARCH_SCALE);expect(needsHighTechBench('carpet-making')).toBe(false);
  expect(CARPET_COLOR_IDS_355).toHaveLength(63);expect(FLOOR_KINDS).toEqual(expect.arrayContaining([...CARPET_FLOORS_355]));
  expect(carpetLabel355('carpet-red')).toBe('Tapis (rouge)');expect(carpetColor355('carpet-black').rgb).toEqual([60,60,60]);
  for(const id of CARPET_FLOORS_355)expect(FLOOR_DEFINITIONS[id]).toMatchObject({item:'cloth',quantity:7,coreWork:800,cleanliness:0,cleaningTime:2,flammability:.32,pathCost:0,skill:0,research:'carpet-making'});
  expect(constructionRecipe({kind:'lay-floor',floor:'carpet-blue'})).toEqual({ingredients:[{item:'cloth',quantity:7}],work:80,coreWork:800});
  const w=roomCamp();w.resources=[];w.research={project:null,points:0};
  const pawn=w.pawns[0]!;
  for(const work of Object.keys(pawn.priorities) as (keyof typeof pawn.priorities)[])pawn.priorities[work]=0;
  pawn.priorities.research=1;pawn.priorities.build=2;pawn.priorities.basic=3;pawn.schedule.fill('work');
  pawn.skills.intellectual={level:12,xp:0,dailyXp:0,passion:0};
  w.structures.push({id:w.nextId++,kind:'research-bench',x:17,z:12,orientation:0,footprint:'standard',material:'wood'} as Structure);
  addGroundMaterial(w,'textile',30,{x:18,z:18},'cloth');refreshStock(w);expect(validateWorld(w)).toEqual([]);
  const cells=[{x:11,z:11},{x:12,z:11},{x:13,z:11},{x:14,z:11}];
  expect(applyCommand(w,{type:'designate',kind:'lay-floor',floor:'carpet-red',...cells[0]!}).ok).toBe(false);
  expect(architectToolAvailable(w,'carpet-red')).toBe(false);
  expect(researchPrerequisite(w,'carpet-making')).toBeUndefined();
  accept(w,{type:'research-project',project:'carpet-making'});expect(w.research!.carpetMaking).toEqual({points:0});
  until(w,()=>(w.research!.carpetMaking!.points)>0,600);
  // Declared prepared: the first 790 points stand for days of the same desk work.
  w.research!.carpetMaking!.points=790*RESEARCH_SCALE;expect(validateWorld(w)).toEqual([]);
  const midway=deserializeWorld(serializeWorld(w)),from=w.tick;
  until(w,()=>researchUnlocked(w,'carpet-making'),6000);stepWorld(midway,w.tick-from);expect(serializeWorld(midway)).toBe(serializeWorld(w));
  expect(w.events.some(e=>e.message.includes('Fabrication de tapis'))).toBe(true);
  expect(architectToolAvailable(w,'carpet-red')).toBe(true);
  const topology=()=>new RoomTopologyCache().read(w),room=()=>new RoomQualityCapture(w,topology()).room(cells[0]!)!;
  const before=room();
  for(const c of cells)accept(w,{type:'designate',kind:'lay-floor',floor:'carpet-red',...c});
  until(w,()=>cells.every(c=>w.tiles[c.z*w.width+c.x]!.floor==='carpet-red'),6000);
  expect(quantity(w,'cloth')).toBe(2);
  // Beauty 2 per carpeted cell instead of the indoor grass -3.
  const after=room(),grass=floorBeauty({terrain:'grass'});
  expect(grass).toBe(-3);expect(floorBeauty({terrain:'grass',floor:'carpet-red'})).toBe(2);
  expect(after.total-before.total).toBe(cells.length*(2-grass));expect(after.beauty).toBeGreaterThan(before.beauty);
  expect(after.wealth).toBeGreaterThan(before.wealth);
  // A save with carpets reloads exactly.
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
  // Removal: half of 7 rounded at random (3 or 4), the loss in the textile ledger.
  accept(w,{type:'designate',kind:'remove-floor',...cells[3]!});
  until(w,()=>!w.tiles[cells[3]!.z*w.width+cells[3]!.x]!.floor,3000);
  const refund=quantity(w,'cloth')-2;expect([3,4]).toContain(refund);expect(w.deconstructed.lostTextiles?.cloth).toBe(7-refund);
  // Fire: a carpet becomes the burned carpet (Beauty -6), its seven cloth lost.
  ensureFireState(w);expect(burnFloor(w,cells[0]!)).toBe(true);expect(burnFloor(w,cells[0]!)).toBe(false);
  expect(w.tiles[cells[0]!.z*w.width+cells[0]!.x]!.floor).toBe('burned-carpet');expect(w.fires!.ledger.items.cloth).toBe(7);
  expect(floorBeauty({terrain:'grass',floor:'burned-carpet'})).toBe(-6);
  expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});

test('at schema 354 the cabinet, carpets and CarpetMaking are refused; nothing links or speeds up below 355',()=>{
  expect(floorAvailable('carpet-red',354)).toBe(false);expect(floorAvailable('burned-carpet',354)).toBe(false);expect(floorAvailable('carpet-red',355)).toBe(true);
  // A real save holding each new thing, relabelled 354, is refused whole.
  const {w,spot}=workshop();const built=cabinet(w,10,7);expect(validateWorld(w)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(w),354))).toThrow();
  const carpeted=deconstructionCamp(1,32);carpeted.research={project:null,points:0,carpetMaking:{points:CARPET_RESEARCH_355.scaledCost,completedAt:0}};
  carpeted.tiles[5*carpeted.width+5]!.floor='carpet-teal';expect(validateWorld(carpeted)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(carpeted),354))).toThrow();
  delete carpeted.tiles[5*carpeted.width+5]!.floor;expect(validateWorld(carpeted)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(carpeted),354))).toThrow();
  expect(validCarpetResearchTransport355(carpeted,354)).toBe(false);expect(validCarpetResearchTransport355(carpeted,355)).toBe(true);
  expect(validateResearch({...carpeted,research:{project:'carpet-making',points:0}} as World,355)).not.toEqual([]);
  const old=deconstructionCamp(1,32);old.schemaVersion=354 as World['schemaVersion'];old.research={project:null,points:0};
  expect(selectResearch(old,'carpet-making').ok).toBe(false);expect(old.research.carpetMaking).toBeUndefined();
  // A carpet order needs the research, even in a valid 355 save.
  const order=deconstructionCamp(1,32);order.research={project:null,points:0};
  order.jobs.push({id:order.nextId++,kind:'lay-floor',floor:'carpet-red',x:6,z:6,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}} as World['jobs'][number]);
  expect(validateWorld(order)).not.toEqual([]);
  // Below 355 the link reader is inert even when handed a cabinet.
  const view={...w,schemaVersion:354} as unknown as World;
  expect(linkedToolCabinets355(view,spot)).toEqual([]);expect(toolCabinetWorkSpeedOffset355(view,spot)).toBe(0);
  expect(toolCabinetLinkedBenches355(view,built)).toEqual([]);
});

test('a schema 354 save migrates to 355 by its number only, without cabinet, carpet or research',()=>{
  const {w}=workshop();const current=serializeWorld(w);
  const migrated=deserializeWorld(asOldSchema(current,354));
  expect(serializeWorld(migrated)).toBe(current);expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
  expect(migrated.research?.carpetMaking).toBeUndefined();expect(migrated.structures.some(s=>s.kind==='tool-cabinet')).toBe(false);
  const room=roomCamp();const roomSave=serializeWorld(room);
  expect(serializeWorld(deserializeWorld(asOldSchema(roomSave,354)))).toBe(roomSave);
});
