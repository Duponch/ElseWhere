import { describe, expect, it } from 'vitest';
import { applyCommand, createWorld, stepWorld } from '../src/sim/engine';
import { addGroundMaterial, refreshStock } from '../src/sim/materials';
import { deserializeWorld, serializeWorld, validateWorld } from '../src/sim/serialization';
import { constructionRecipe, validConstructionMaterial } from '../src/sim/construction-materials';
import { footprintCells } from '../src/sim/definitions';
import { FLOOR_DEFINITIONS, FLOOR_KINDS, floorAvailable, flooringRecipe } from '../src/sim/flooring';
import { floorBeauty, structureBeauty } from '../src/sim/room-beauty';
import { floorRoomMarketValue } from '../src/sim/room-market-value';
import { seatComfort } from '../src/sim/furniture-stats';
import { structureFlammability, structureMaxHp } from '../src/sim/thing-damage-rules';
import { groupPackedMassGrams258 } from '../src/sim/group-freight-mass-258';
import { addFilth, captureCleanliness } from '../src/sim/filth';
import { startFire } from '../src/sim/fire';
import { navigationCosts, terrainTravelDelay } from '../src/sim/furniture-travel';
import { RoomTopologyCache } from '../src/sim/room-topology';
import { RoomQualityCapture } from '../src/sim/room-quality';
import { recreationSpace } from '../src/sim/recreation-space';
import { seatAt } from '../src/sim/dining';
import { COMPLEX_FURNITURE_RESEARCH_COST } from '../src/sim/research';
import { COUCH_365, STRAW_MATTING_365, couchCells365 } from '../src/sim/straw-couch-365';
import { architectToolAvailable } from '../src/ui/architect-availability';
import { enclosedRoom } from './scenarios/cleanliness';
import { asNumberOnly, asOldSchema } from './scenarios/old-schema';
import { initializeDeclaredFixtureTick297 } from './scenarios/initial-core-clock-v492';
import { SCHEMA_VERSION, type Pawn, type Structure, type World } from '../src/sim/types';

const SLOW=90000;
/** Open 40×40 grass map, every colonist idle, fed, rested and entertained. */
function open(seed=365,pawns=1,tick=2000):World {
  const w=createWorld(seed,40,40);initializeDeclaredFixtureTick297(w,tick);
  if(w.deterioration)w.deterioration.lastTick=w.tick;
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
  w.pawns=w.pawns.slice(0,pawns);
  for(const [i,p] of w.pawns.entries()){p.x=8+i;p.z=8;p.path=[];p.state='idle';p.hunger=100;p.rest=100;p.recreation.level=100;}
  refreshStock(w);return w;
}
function idle(p:Pawn):void {for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;}
function builder(w:World):Pawn {
  const p=w.pawns[0]!;p.schedule.fill('work');idle(p);
  p.priorities.build=1;p.priorities.haul=1;p.skills.construction={level:8,xp:0,dailyXp:0,passion:0};return p;
}
function until(w:World,done:()=>boolean,limit=6000):void {
  for(let i=0;i<limit&&!done();i++){stepWorld(w);if(i%250===0)expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);}
  expect(done(),JSON.stringify({tick:w.tick,jobs:w.jobs.map(j=>({kind:j.kind,status:j.status,progress:j.progress})),pawns:w.pawns.map(p=>({state:p.state,job:p.jobId,haul:p.haul}))})).toBe(true);
  expect(validateWorld(w)).toEqual([]);
}
function reload(w:World):World {
  const json=serializeWorld(w),a=deserializeWorld(json),b=deserializeWorld(json);
  expect(validateWorld(a)).toEqual([]);expect(a).toEqual(w);
  stepWorld(a,30);stepWorld(b,30);expect(a).toEqual(b);return a;
}
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);
const floorAt=(w:World,c:{x:number;z:number})=>w.tiles[c.z*w.width+c.x]!.floor;

describe('schema 365: Core straw matting and couch', () => {
 it('takes every number from Terrain_Floors.xml and Buildings_Furniture.xml', () => {
  expect(FLOOR_KINDS).toContain('straw-matting');expect(FLOOR_KINDS).not.toContain('burned-straw-matting');
  expect(FLOOR_DEFINITIONS['straw-matting']).toMatchObject({item:'hay',quantity:2,coreWork:120,cleanliness:-.1,flammability:1.5,pathCost:1,skill:0,research:null});
  expect(FLOOR_DEFINITIONS['burned-straw-matting']).toMatchObject({item:null,flammability:0,pathCost:1});
  expect(flooringRecipe('straw-matting')).toEqual({ingredients:[{item:'hay',quantity:2}],work:12,coreWork:120});
  expect(floorBeauty({terrain:'grass',floor:'straw-matting'})).toBe(-1);
  expect(floorBeauty({terrain:'grass',floor:'burned-straw-matting'})).toBe(-6);
  expect(floorRoomMarketValue({terrain:'grass',floor:'straw-matting'})).toBeCloseTo(2*.6+120*.0036,12);
  expect(STRAW_MATTING_365.filthMultiplier).toBe(.05);
  expect(floorAvailable('straw-matting',365)).toBe(true);expect(floorAvailable('straw-matting',364)).toBe(false);
  expect(floorAvailable('burned-straw-matting',364)).toBe(false);
  // Couch: 2×1, 200 Fabric/Leathery, WorkToBuild 20000, 160 HP, Beauty 8, Comfort 0.85, 70 kg.
  expect(constructionRecipe({kind:'couch',material:'cloth'})).toEqual({ingredients:[{item:'cloth',quantity:200}],work:2000,coreWork:20000});
  expect(validConstructionMaterial('couch','cloth',365)).toBe(true);expect(validConstructionMaterial('couch','light-leather',365)).toBe(true);
  expect(validConstructionMaterial('couch','cloth',364)).toBe(false);expect(validConstructionMaterial('couch','wood',365)).toBe(false);
  expect(structureMaxHp({kind:'couch',material:'cloth'})).toBe(160);
  expect(structureFlammability({kind:'couch',material:'cloth'})).toBeCloseTo(1.2,12);
  expect(structureBeauty({kind:'couch',x:0,z:0,material:'cloth',quality:'normal'},365)).toBe(8);
  expect(seatComfort({kind:'couch',material:'cloth',quality:'normal'})).toBeCloseTo(.85,12);
  expect(groupPackedMassGrams258({building:{kind:'couch'}} as never,365)).toBe(70000);expect(groupPackedMassGrams258({building:{kind:'couch'}} as never,364)).toBeUndefined();
  expect(couchCells365({x:5,z:5,orientation:0})).toEqual([{x:5,z:5},{x:6,z:5}]);
  expect(couchCells365({x:5,z:5,orientation:1})).toEqual([{x:5,z:5},{x:5,z:4}]);
  expect(COUCH_365.seats).toBe(2);
  const w=open();
  w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
  for(const tool of ['couch','straw-matting'] as const){
   expect(architectToolAvailable(w,tool)).toBe(true);
   expect(architectToolAvailable({...w,schemaVersion:364} as unknown as World,tool)).toBe(false);
  }
 });

 it('a colonist lays straw matting with hay; the room grows uglier and dirtier, it holds little filth and burns', () => {
  const w=open(),b=builder(w),room=enclosedRoom(w,{x:14,z:14},5);
  const cells=room.cells.map(i=>({x:i%w.width,z:Math.floor(i/w.width)}));
  addGroundMaterial(w,'food',30,{x:10,z:10},'hay');refreshStock(w);
  const topology=()=>new RoomTopologyCache().read(w),quality=()=>new RoomQualityCapture(w,topology()).room(cells[0]!)!;
  const before=quality(),cleanBefore=captureCleanliness(w).room(cells[0]!)!.cleanliness;
  for(const c of cells)expect(applyCommand(w,{type:'designate',kind:'lay-floor',floor:'straw-matting',...c}).ok).toBe(true);
  // Hay is food, delivered physically to each floor frame: a save mid-delivery stays valid.
  let midway:string|undefined;
  for(let i=0;i<6000&&!cells.every(c=>floorAt(w,c)==='straw-matting');i++){
   stepWorld(w);
   if(!midway&&w.piles.some(p=>p.item==='hay'&&p.owner.type==='job')){midway=serializeWorld(w);expect(validateWorld(w)).toEqual([]);}
   if(i%250===0)expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
  }
  expect(cells.every(c=>floorAt(w,c)==='straw-matting')).toBe(true);expect(validateWorld(w)).toEqual([]);
  expect(midway).toBeDefined();const resumed=deserializeWorld(midway!);expect(validateWorld(resumed)).toEqual([]);
  expect(quantity(w,'hay')).toBe(30-2*cells.length);
  b.priorities.build=0;b.priorities.haul=0;
  // Beauty -1 instead of the indoor grass -3; Cleanliness -0.1 per cell instead of the grass -1.
  const after=quality();expect(after.total-before.total).toBe(cells.length*(-1-floorBeauty({terrain:'grass'})));
  const cleanAfter=captureCleanliness(w).room(cells[0]!)!.cleanliness;
  expect(cleanAfter).toBeCloseTo(-.1,12);expect(cleanBefore).toBeCloseTo(-1,12);
  // Path cost 1, as the burned floors.
  const index=cells[0]!.z*w.width+cells[0]!.x;expect(terrainTravelDelay(w,index)).toBe(.1);expect(navigationCosts(w).floors.get(index)).toBe(33);
  reload(w);
  // FilthMultiplier 0.05: most new dirt is refused, blood (ignoreFilthMultiplierStat) is not.
  const straw=open(366);
  for(let z=2;z<38;z++)for(let x=2;x<38;x++)straw.tiles[z*straw.width+x]!.floor='straw-matting';
  let dirt=0,blood=0;
  for(let z=2;z<38;z+=2)for(let x=2;x<38;x+=2){if(addFilth(straw,{x,z},'dirt'))dirt++;if(addFilth(straw,{x:x+1,z},'blood'))blood++;}
  expect(blood).toBe(324);expect(dirt).toBeGreaterThan(0);expect(dirt).toBeLessThan(50);
  const kept=straw.filth!.items.find(f=>f.kind==='dirt')!,rng=straw.filth!.rng;
  expect(addFilth(straw,kept,'dirt')).toBe(true);expect(kept.thickness).toBe(2);expect(straw.filth!.rng).toBe(rng);
  expect(validateWorld(straw)).toEqual([]);
  const planks=open(366);
  for(let z=2;z<38;z++)for(let x=2;x<38;x++)planks.tiles[z*planks.width+x]!.floor='wood-planks';
  let woodDirt=0;for(let z=2;z<38;z+=2)for(let x=2;x<38;x+=2)if(addFilth(planks,{x,z},'dirt'))woodDirt++;
  expect(woodDirt).toBe(324);
  // Removal gives back half of the hay (RoundRandom(2 × 0.5) = 1), the other in the ledger.
  const removed=cells[0]!;b.priorities.build=1;
  expect(applyCommand(w,{type:'designate',kind:'remove-floor',...removed}).ok).toBe(true);
  const hay=quantity(w,'hay');
  until(w,()=>!floorAt(w,removed),3000);
  expect(quantity(w,'hay')-hay).toBe(1);expect(w.deconstructed.lostHay365).toBe(1);
  reload(w);
  // A ground fire burns the matting (Flammability 1.5) at the 7500-Core boundary: BurnedStrawMatting, two hay lost.
  const fire=open(367);for(const p of fire.pawns)idle(p);
  const cell={x:20,z:20},at=cell.z*fire.width+cell.x;fire.tiles[at]!.floor='straw-matting';
  expect(startFire(fire,cell,.6)).toBe(true);const lit=fire.tick;
  stepWorld(fire,749);expect(floorAt(fire,cell)).toBe('straw-matting');expect(fire.fires!.ledger.items.hay??0).toBe(0);
  stepWorld(fire);expect(fire.tick-lit).toBe(750);
  expect(fire.tiles[at]!.floor).toBe('burned-straw-matting');expect(fire.fires!.ledger.items.hay).toBe(2);
  expect(floorBeauty({terrain:'grass',floor:'burned-straw-matting'})).toBe(-6);expect(validateWorld(fire)).toEqual([]);
  reload(fire);
 }, SLOW);

 it('a colonist builds a cloth couch; two colonists eat sitting side by side on it', () => {
  const w=open(365,3),b=builder(w);
  w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
  const eaters=w.pawns.slice(1) as [Pawn,Pawn];
  for(const p of eaters){p.schedule.fill('anything');idle(p);}
  addGroundMaterial(w,'textile',200,{x:12,z:12},'cloth');refreshStock(w);
  const locked={...structuredClone(w),research:{project:null,points:0}} as World;
  expect(applyCommand(locked,{type:'designate',kind:'couch',x:20,z:20,material:'cloth',orientation:0}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'couch',x:20,z:20,material:'wood',orientation:0}).ok).toBe(false);
  expect(applyCommand(w,{type:'designate',kind:'couch',x:20,z:20,material:'cloth',orientation:0}).ok).toBe(true);
  expect(footprintCells(w.jobs.at(-1)!)).toEqual([{x:20,z:20},{x:21,z:20}]);
  until(w,()=>w.structures.some(s=>s.kind==='couch'),30000);
  const couch=w.structures.find(s=>s.kind==='couch')!;
  expect(couch).toMatchObject({material:'cloth',orientation:0});expect(couch.quality).toBeDefined();
  expect(quantity(w,'cloth')).toBe(0);
  b.priorities.build=0;b.priorities.haul=0;
  // Both cells are seats in the joy index.
  const space=recreationSpace(w);
  expect(space.seats.get(20*w.width+20)?.id).toBe(couch.id);expect(space.seats.get(20*w.width+21)?.id).toBe(couch.id);
  // A 2×2 table touches both seats; enough food for two; two hungry colonists.
  Object.assign(w.structures[w.structures.push({id:w.nextId++,kind:'table-square',x:20,z:21,orientation:0,footprint:'standard'})-1]!,{material:'wood',quality:'normal'});
  addGroundMaterial(w,'food',10,{x:18,z:17});refreshStock(w);b.hunger=100;b.needCooldown=0;
  expect(validateWorld(w)).toEqual([]);
  for(const [i,p] of eaters.entries()){Object.assign(p,{x:14+i,z:24,hunger:20,needCooldown:0,planCooldown:0,comfort:0});}
  let saved:string|undefined;const seats=new Map<number,{x:number;z:number}>();
  for(let i=0;i<900&&eaters.some(p=>p.hunger<=20);i++){
   stepWorld(w);
   for(const p of eaters)if(p.need?.kind==='eat'&&p.need.phase==='ingest'&&p.need.dining?.seatId===couch.id&&p.x===p.need.dining.target.x&&p.z===p.need.dining.target.z){
    seats.set(p.id,{x:p.x,z:p.z});if(seats.size===2)saved??=serializeWorld(w);
   }
  }
  expect(seats.size).toBe(2);
  const places=[...seats.values()];expect(places.every(c=>seatAt(couch,c))).toBe(true);
  expect(places[0]).not.toEqual(places[1]);
  for(const p of eaters){expect(p.hunger).toBeGreaterThan(20);expect(p.memories.some(m=>m.kind==='ate-without-table')).toBe(false);expect(p.comfort).toBeGreaterThan(0);}
  expect(saved).toBeDefined();
  const a=deserializeWorld(saved!),c=deserializeWorld(saved!);expect(validateWorld(a)).toEqual([]);
  stepWorld(a,60);stepWorld(c,60);expect(a).toEqual(c);
  reload(w);
  // Minifiable like the armchair: uninstalled into one packed couch, same identity and quality.
  b.priorities.build=1;
  expect(applyCommand(w,{type:'designate',kind:'uninstall',x:21,z:20}).ok).toBe(true);
  until(w,()=>w.packed.some(p=>p.building.id===couch.id),3000);
  expect(w.packed.find(p=>p.building.id===couch.id)?.building).toMatchObject({kind:'couch',material:'cloth',quality:couch.quality});
  reload(w);
 }, SLOW);

 it('nothing exists below 365: refused kinds, and a 364 save migrates by its number only', () => {
  const w=open();
  w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:0}};
  const relabelled={...structuredClone(w),schemaVersion:364} as unknown as World;
  expect(applyCommand(relabelled,{type:'designate',kind:'couch',x:20,z:20,material:'cloth'}).ok).toBe(false);
  expect(applyCommand(relabelled,{type:'designate',kind:'lay-floor',floor:'straw-matting',x:20,z:20}).ok).toBe(false);
  // A current save holding a new thing cannot claim an older schema.
  const withCouch=structuredClone(w);withCouch.structures.push({id:withCouch.nextId++,kind:'couch',x:20,z:20,orientation:0,footprint:'standard',material:'cloth',quality:'normal'});
  expect(validateWorld(withCouch)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(withCouch),364))).toThrow();
  for(const floor of ['straw-matting','burned-straw-matting'] as const){
   const floored=open();floored.tiles[20*floored.width+20]!.floor=floor;expect(validateWorld(floored)).toEqual([]);
   expect(()=>deserializeWorld(asOldSchema(serializeWorld(floored),364))).toThrow();
  }
  const job=open();addGroundMaterial(job,'food',2,{x:10,z:10},'hay');refreshStock(job);
  expect(applyCommand(job,{type:'designate',kind:'lay-floor',floor:'straw-matting',x:20,z:20}).ok).toBe(true);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(job),364))).toThrow();
  const ledger=open();ledger.deconstructed.lostHay365=1;expect(validateWorld(ledger)).toEqual([]);
  expect(()=>deserializeWorld(asOldSchema(serializeWorld(ledger),364))).toThrow();
  // A colony without the new things migrates by its number only and plays the same ticks.
  const plain=serializeWorld(open(9));
  expect(serializeWorld(deserializeWorld(asOldSchema(plain,364)))).toBe(asNumberOnly(plain,364));
  const a=deserializeWorld(plain),c=deserializeWorld(asOldSchema(plain,364));expect(c.schemaVersion).toBe(SCHEMA_VERSION);
  stepWorld(a,200);stepWorld(c,200);expect(c).toEqual(a);
 }, SLOW);
});
