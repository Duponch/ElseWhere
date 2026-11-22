import {describe,expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {captureRoomQuality} from '../src/sim/room-quality.ts';
import {RoomTopologyCache} from '../src/sim/room-topology.ts';
import {advanceBeautyNeeds,beautyMapAt,captureWorldBeauty,BEAUTY_NEED_INTERVAL} from '../src/sim/beauty-need.ts';
import {RoomBeautyCapture,weightedBeautySize,type BeautyMap} from '../src/sim/room-beauty.ts';
import {ROUGH_ROCK_BEAUTY_373,roughRockBeauty373,naturalWallBeauty373,isRockBeautySchema373} from '../src/sim/rock-beauty-373.ts';
import {SMOOTHED_WALL_BEAUTY_367} from '../src/sim/smooth-wall-367.ts';
import {newDoorState} from '../src/sim/door-rules.ts';
import {rockInspection} from '../src/ui/geology-inspection.ts';
import {RoomBeautyInspection} from '../src/ui/room-beauty-inspection.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Cell,type Command,type Structure,type World} from '../src/sim/types.ts';

/** Declared preparation, not a played acquisition (as V367): a 32x32 legacy
 * map of grass with a rock block x/z 11..19 around an open 3x3 dug room
 * (14..16), one free builder inside with Construction 8 and only Construction
 * enabled. The room's 16 bordering cells (the 5x5 ring) are rock. */
function rockRoom(stone:'granite'|'marble'='granite'){
  const w=deconstructionCamp(1,32),p=w.pawns[0]!;
  for(let z=11;z<=19;z++)for(let x=11;x<=19;x++)if(!(x>=14&&x<=16&&z>=14&&z<=16))w.tiles[z*w.width+x]={terrain:'rock',stone};
  Object.assign(p,{name:'Polisseuse',x:15,z:15,hunger:100,rest:100});
  for(const work of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[work]=0;
  p.priorities.build=1;delete p.traits;
  p.skills.construction={level:8,xp:0,dailyXp:0,passion:1};
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
  return {w,p,index:(c:Cell)=>c.z*w.width+c.x};
}
const ring=(w:World)=>{const out:number[]=[];for(let z=13;z<=17;z++)for(let x=13;x<=17;x++)if(!(x>=14&&x<=16&&z>=14&&z<=16))out.push(z*w.width+x);return out;};
/** The same world under the schema 372 rules (in memory only). */
const at372=(w:World):World=>({...w,schemaVersion:372 as never});
const room=(w:World)=>captureRoomQuality(w).room({x:15,z:15})!;
const perceived=(w:World,cell:Cell)=>captureWorldBeauty(w,new RoomTopologyCache().read(w)).perceived(cell);
const ok=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r.ok,r.reason).toBe(true);return r;};
function reload(w:World):World{const raw=serializeWorld(w),copy=deserializeWorld(raw);expect(serializeWorld(copy)).toBe(raw);return copy;}

/** Core BeautyUtility.FillBeautyRelevantCells and CellBeauty, written
 * independently on the topology labels (space id, -1 solid, -2 doorway). */
function corePerceived(map:BeautyMap,labels:(i:number)=>number,edge:(i:number)=>boolean,root:Cell,fogged:(i:number)=>boolean=()=>false):number {
  const W=map.width,H=map.height,roomOf=(i:number)=>{const l=labels(i);return l>0?`s${l}`:l===-2?`d${i}`:null;};
  const start=roomOf(root.z*W+root.x);if(start===null)return 0;
  const visible=new Set([start]);
  if(start.startsWith('d'))for(const [dx,dz] of [[0,1],[1,0],[0,-1],[-1,0]]){const x=root.x+dx,z=root.z+dz;if(x>=0&&z>=0&&x<W&&z<H){const r=roomOf(z*W+x);if(r!==null)visible.add(r);}}
  let total=0,count=0;
  for(let dz=-9;dz<=9;dz++)for(let dx=-9;dx<=9;dx++){
    if(dx*dx+dz*dz>8.9*8.9)continue;const x=root.x+dx,z=root.z+dz;if(x<0||z<0||x>=W||z>=H)continue;const i=z*W+x;if(fogged(i))continue;
    let relevant=visible.has(roomOf(i)!);
    for(let ax=-1;ax<=1&&!relevant;ax++)for(let az=-1;az<=1&&!relevant;az++){if(!ax&&!az)continue;const nx=x+ax,nz=z+az;if(nx>=0&&nz>=0&&nx<W&&nz<H&&visible.has(roomOf(nz*W+nx)!))relevant=true;}
    if(!relevant)continue;
    total+=labels(i)>0?map.atIndex(i,edge(i)):map.thingsAtIndex(i,false);count++;
  }
  return count?total/count:0;
}

describe('V373 beauty of rough rock walls and of the walls bordering the perceived room',()=>{
  test('Core facts: UglyRockBase Beauty -2, Marble -1; ores, collapsed rocks and unknown stones 0; smoothing gains +3',()=>{
    expect(ROUGH_ROCK_BEAUTY_373).toEqual({granite:-2,limestone:-2,marble:-1,sandstone:-2,slate:-2});
    for(const stone of ['granite','limestone','marble','sandstone','slate'] as const){
      expect(roughRockBeauty373({terrain:'rock',stone},373)).toBe(ROUGH_ROCK_BEAUTY_373[stone]);
      expect(roughRockBeauty373({terrain:'rock',stone},372)).toBe(0);
      // Smoothed<Rock> Beauty 1 (SmoothedMarble 2): three more for every stone.
      expect(naturalWallBeauty373({terrain:'rock',stone,smoothedWall367:true},373)-naturalWallBeauty373({terrain:'rock',stone},373)).toBe(3);
      expect(naturalWallBeauty373({terrain:'rock',stone,smoothedWall367:true},372)).toBe(SMOOTHED_WALL_BEAUTY_367[stone]);
    }
    expect(roughRockBeauty373({terrain:'rock',stone:'granite',ore:'steel'},373)).toBe(0);
    expect(roughRockBeauty373({terrain:'rock',stone:'slate',collapsedRock:{terrain:'soil'}},373)).toBe(0);
    expect(roughRockBeauty373({terrain:'rock'},373)).toBe(0);
    expect(roughRockBeauty373({terrain:'rough-stone',stone:'granite'},373)).toBe(0);
    expect(isRockBeautySchema373(SCHEMA_VERSION)).toBe(true);expect(isRockBeautySchema373(372)).toBe(false);
  });

  test('a dug room counts its 16 bordering granite walls at -2 (marble -1), ores at 0; the room inspection and the rock inspection show it',()=>{
    const {w,index}=rockRoom(),q=room(w),old=room(at372(w));
    expect(q.cells.size).toBe(9);expect([...q.adjacent].sort((a,b)=>a-b)).toEqual(ring(w));
    // Nine indoor grass cells -3 each; the 5x5 ring of rough granite -2 each.
    expect(old.total).toBe(-27);expect(q.total).toBe(-27-32);expect(q.beauty).toBe(-59/weightedBeautySize(9));
    expect(q.wealth).toBe(old.wealth);
    const marble=rockRoom('marble').w;expect(room(marble).total).toBe(-27-16);
    w.tiles[index({x:15,z:13})]={terrain:'rock',stone:'granite',ore:'steel'};expect(room(w).total).toBe(-27-30);
    // The other pipeline (room beauty capture of the beauty need) agrees.
    expect(captureWorldBeauty(w,new RoomTopologyCache().read(w)).room({x:15,z:15})!.total).toBe(-27-30);
    const ui=new RoomBeautyInspection(),topology=new RoomTopologyCache().read(w);
    expect(ui.read(w,topology,{x:15,z:15})!.total).toBe(-57);
    expect(rockInspection(w.tiles[index({x:15,z:17})]!,undefined,SCHEMA_VERSION)!.description).toContain('Beauté −2 pour la pièce qu’elle borde ; lissée, elle compterait 1.');
    expect(rockInspection(marble.tiles[index({x:15,z:17})]!,undefined,SCHEMA_VERSION)!.description).toContain('Beauté −1');
    expect(rockInspection(w.tiles[index({x:15,z:17})]!,undefined,372)!.description).not.toContain('Beauté');
    expect(rockInspection(w.tiles[index({x:15,z:13})]!,undefined,SCHEMA_VERSION)!.description).not.toContain('Beauté');
  });

  test('a builder smooths a bordering face through real ticks: the room gains 3, the inspection follows without a topology change',()=>{
    const {w,index}=rockRoom(),face={x:15,z:13},ui=new RoomBeautyInspection(),topologies=new RoomTopologyCache();
    const before=ui.read(w,topologies.read(w),{x:15,z:15})!;expect(before.total).toBe(-59);
    ok(w,{type:'area',action:'smooth-wall',from:face,to:face});
    for(let n=0;n<1500&&!w.tiles[index(face)]!.smoothedWall367;n++)stepWorld(w);
    expect(w.tiles[index(face)]).toEqual({terrain:'rock',stone:'granite',smoothedWall367:true});expect(validateWorld(w)).toEqual([]);
    expect(room(w).total).toBe(-59+3);expect(room(at372(w)).total).toBe(-27+1);
    const topology=topologies.read(w);expect(ui.read(w,topology,{x:15,z:15})!.total).toBe(-56);expect(ui.rebuilds).toBe(2);
    expect(rockInspection(w.tiles[index(face)]!,undefined,SCHEMA_VERSION)!.description).toContain('Avant lissage, la roche brute comptait −2.');
    // Marble: -1 rough, +2 smoothed.
    const marble=rockRoom('marble').w,r0=room(marble).total;marble.tiles[index(face)]={terrain:'rock',stone:'marble',smoothedWall367:true};
    expect(room(marble).total-r0).toBe(3);
    const copy=reload(w);expect(room(copy).total).toBe(-56);
  });

  test('a room of built walls keeps its room beauty; its colonist now also sees the walls, as Core',()=>{
    const w=deconstructionCamp(1,32),p=w.pawns[0]!;
    for(let z=13;z<=17;z++)for(let x=13;x<=17;x++)if(!(x>=14&&x<=16&&z>=14&&z<=16))Object.assign(fixtureBuilding(w,'wall',x,z),{material:'marble-blocks'});
    Object.assign(p,{x:15,z:15});refreshStock(w);expect(validateWorld(w)).toEqual([]);
    const q=room(w);expect(q.total).toBe(room(at372(w)).total);expect(q.total).toBe(-27+16);
    // 372: the nine room cells; 373: the room and its sixteen walls (marble blocks Beauty 1).
    expect(perceived(at372(w),p)).toBe(-3);expect(perceived(w,p)).toBe((-27+16)/25);
  });

  test('perceived beauty of a colonist in the dug room reads its walls; the need moves the other way than at 372',()=>{
    const {w,p}=rockRoom(),topology=new RoomTopologyCache().read(w);
    expect(perceived(at372(w),p)).toBe(-3);expect(perceived(w,p)).toBe(-59/25);
    const capture=captureWorldBeauty(w,topology);
    expect(capture.perceived(p)).toBe(corePerceived(capture.map,i=>topology.labelAt(i)!,i=>(topology.at(i%w.width,Math.floor(i/w.width)) as {touchesMapEdge:boolean}).touchesMapEdge,p));
    expect(capture.perceived(p,()=>true,8.9)).toBe(capture.perceived(p));
    // A fogged wall is not seen (BeautyUtility skips Fogged cells).
    const wall=13*w.width+15,fog=new RoomBeautyCapture(capture.map,topology,i=>i===wall);expect(fog.perceived(p)).toBe(-57/24);
    // The need's partial map gives the same value as the full one.
    expect(new RoomBeautyCapture(beautyMapAt(w,[p]),topology).perceived(p)).toBe(capture.perceived(p));
    // Target 40 + 10 x perceived: 16.4 at 373 (above 13), 10 at 372 (below).
    w.tick=BEAUTY_NEED_INTERVAL*50;p.beauty=13;advanceBeautyNeeds(w,topology);expect(p.beauty).toBeGreaterThan(13);
    const old=at372(w);old.pawns=[{...p,beauty:13}];advanceBeautyNeeds(old,topology);expect(old.pawns[0]!.beauty).toBeLessThan(13);
    for(let n=0;n<400;n++){w.tick+=BEAUTY_NEED_INTERVAL;advanceBeautyNeeds(w,topology);}expect(p.beauty).toBeCloseTo(40-59/25*10,10);
  });

  test('from a doorway a colonist sees the door, both sides and their walls, as Core',()=>{
    const {w,p,index}=rockRoom();
    // A corridor dug north out of the block, closed by a door on the room's side.
    for(const z of [11,12])w.tiles[index({x:15,z})]={terrain:'rough-stone',stone:'granite'};
    w.tiles[index({x:15,z:13})]={terrain:'rough-stone',stone:'granite'};
    const door:Structure={id:w.nextId++,kind:'door',material:'wood',x:15,z:13,orientation:0,footprint:'standard',door:newDoorState(w.tick)};
    w.structures.push(door);Object.assign(p,{x:15,z:13});refreshStock(w);expect(validateWorld(w)).toEqual([]);
    const topology=new RoomTopologyCache().read(w),capture=captureWorldBeauty(w,topology);
    expect(topology.at(15,13)?.kind).toBe('doorway');
    const edge=(i:number)=>{const s=topology.at(i%w.width,Math.floor(i/w.width));return s?.kind==='space'&&s.touchesMapEdge;};
    const value=capture.perceived(p);expect(value).toBe(corePerceived(capture.map,i=>topology.labelAt(i)!,edge,p));
    expect(value).not.toBe(0);expect(captureWorldBeauty(at372(w),topology).perceived(p)).toBe(0);
    // Inside the room the door is a bordering cell like a wall.
    expect(capture.perceived({x:15,z:15})).toBe(corePerceived(capture.map,i=>topology.labelAt(i)!,edge,{x:15,z:15}));
  });

  test('below 373 nothing changes; 372 migrates by number only and a loaded game then counts its rock walls',()=>{
    const {w,p}=rockRoom(),plain=serializeWorld(w);
    expect(serializeWorld(deserializeWorld(asOldSchema(plain,372)))).toBe(asNumberOnly(plain,372));
    // A 372 world reads its rough walls as an unknown stone, 0 under every rule.
    const old=at372(w),blank:World={...old,tiles:old.tiles.map(t=>t.terrain==='rock'?{terrain:'rock'}:t)};
    expect(room(old)).toEqual(room(blank));expect(perceived(old,p)).toBe(perceived(blank,p));
    expect(captureWorldBeauty(old,new RoomTopologyCache().read(old)).room({x:15,z:15})!.total).toBe(-27);
    const loaded=deserializeWorld(asOldSchema(plain,372));expect(loaded.schemaVersion).toBe(SCHEMA_VERSION);
    expect(room(loaded).total).toBe(-59);expect(perceived(loaded,loaded.pawns[0]!)).toBe(-59/25);
    const copy=reload(w);expect(room(copy)).toEqual(room(w));
  });
});
