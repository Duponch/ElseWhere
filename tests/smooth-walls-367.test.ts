import {describe,expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {workProgress} from '../src/sim/work-progress.ts';
import {refreshStock} from '../src/sim/materials.ts';
import {captureRoomQuality} from '../src/sim/room-quality.ts';
import {colonyWealth} from '../src/sim/colony-wealth.ts';
import {constructionRecipe} from '../src/sim/construction-materials.ts';
import {jobWorkGiver} from '../src/sim/work-givers-rimworld.ts';
import {SMOOTH_WALL_CORE_WORK_367,SMOOTH_WALL_WORK_367,SMOOTHED_WALL_BEAUTY_367,SMOOTHED_WALL_MARKET_VALUE_367,smoothedWallCoreDef367} from '../src/sim/smooth-wall-367.ts';
import {validSmoothWallTile367,validSmoothWallsHistoricalTransport367} from '../src/sim/smooth-wall-save-367.ts';
import {rockMaxHP,CHUNK_CHANCE} from '../src/sim/mining-rules.ts';
import {rockInspection} from '../src/ui/geology-inspection.ts';
import {paletteHotkeyTool} from '../src/ui/main-tab-hotkeys.ts';
import {toolDefinitions} from '../src/ui/layout.ts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots.ts';
import {ResidentPresentationAssembler} from '../src/bridge/resident-presentation-assembler.ts';
import {TileSnapshotCache} from '../src/bridge/tile-snapshot-cache.ts';
import {RockLayer} from '../src/render/RockLayer.ts';
import {rockCorner} from '../src/render/RockSurface.ts';
import {designationIconInstances} from '../src/render/DesignationIconLayer.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema.ts';
import type {Cell,Command,Job,World} from '../src/sim/types.ts';

/** Declared preparation, not a played acquisition: a 32x32 legacy map with a
 * granite block x/z 11..19 around an open 3x3 room (14..16), one free builder
 * inside with Construction/Mining 8 (minor passion, no trait), food for the
 * run and only Construction and Mining enabled. Every smoothing, mining and
 * draw below is played by real commands and stepWorld ticks. */
function rockRoom(){
  const w=deconstructionCamp(1,32),p=w.pawns[0]!;
  for(let z=11;z<=19;z++)for(let x=11;x<=19;x++)if(!(x>=14&&x<=16&&z>=14&&z<=16))w.tiles[z*w.width+x]={terrain:'rock',stone:'granite'};
  Object.assign(p,{name:'Polisseuse',x:15,z:15,hunger:100,rest:100});
  for(const work of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[work]=0;
  p.priorities.build=1;p.priorities.mine=1;delete p.traits;
  p.skills.construction={level:8,xp:0,dailyXp:0,passion:1};p.skills.mining={level:8,xp:0,dailyXp:0,passion:1};
  refreshStock(w);expect(validateWorld(w)).toEqual([]);
  return {w,p,index:(c:Cell)=>c.z*w.width+c.x};
}
const ok=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r.ok,r.reason).toBe(true);return r;};
const area=(w:World,action:'smooth-wall'|'smooth-surface'|'mine',from:Cell,to:Cell=from)=>ok(w,{type:'area',action,from,to});
function until(w:World,predicate:()=>boolean,limit=1500){for(let n=0;n<limit&&!predicate();n++)stepWorld(w);expect(predicate(),JSON.stringify({tick:w.tick,jobs:w.jobs,p:w.pawns.map(p=>({x:p.x,z:p.z,state:p.state,job:p.jobId}))})).toBe(true);expect(validateWorld(w)).toEqual([]);}
function reload(w:World):World{const raw=serializeWorld(w),copy=deserializeWorld(raw);expect(serializeWorld(copy)).toBe(raw);return copy;}
const smoothJob=(w:World,c:Cell)=>w.jobs.find(j=>j.kind==='smooth-wall'&&j.x===c.x&&j.z===c.z);

describe('V367 smoothing natural rock walls (Core SmoothWall)',()=>{
  test('Core facts: work 6500 at SmoothingSpeed x1.7, ConstructSmoothWalls, Smoothed<Rock> beauty and value, Misc5 in Orders',()=>{
    expect(SMOOTH_WALL_CORE_WORK_367).toBe(6500);expect(SMOOTH_WALL_WORK_367).toBe(650);
    expect(constructionRecipe({kind:'smooth-wall'} as Job)).toEqual({ingredients:[],work:650,coreWork:6500});
    expect(jobWorkGiver({kind:'smooth-wall'})).toBe('ConstructSmoothWalls');
    expect(SMOOTHED_WALL_BEAUTY_367).toEqual({granite:1,limestone:1,marble:2,sandstone:1,slate:1});
    expect(SMOOTHED_WALL_MARKET_VALUE_367).toBe(7);expect(smoothedWallCoreDef367('slate')).toBe('SmoothedSlate');
    expect(paletteHotkeyTool('orders','j')).toBe('smooth-surface');
    expect(toolDefinitions.find(t=>t.id==='smooth-surface')).toMatchObject({category:'orders',key:'J'});
    expect(toolDefinitions.find(t=>t.id==='smooth-wall')).toMatchObject({category:'structure'});
  });

  test('a builder smooths a designated granite face through real ticks; work and XP as Core; the room sees it; mining it yields as raw granite',()=>{
    const {w,p,index}=rockRoom(),face={x:15,z:13};
    expect(captureRoomQuality(w).room({x:15,z:15})!.adjacent.has(index(face))).toBe(true);
    expect(area(w,'smooth-wall',face)).toMatchObject({affected:1,skipped:0});
    const job=smoothJob(w,face)!;expect(job).toMatchObject({status:'pending',progress:0,reservedBy:null});
    const xp0=p.skills.construction.xp;let workTicks=0;
    for(let n=0;n<1500&&!w.tiles[index(face)]!.smoothedWall367;n++){
      const before=w.jobs.includes(job)?workProgress(job):-1;stepWorld(w);
      if(w.jobs.includes(job)?workProgress(job)>before:w.tiles[index(face)]!.smoothedWall367)workTicks++;
      if(w.jobs.includes(job)&&workProgress(job)>0)expect(Math.max(Math.abs(p.x-face.x),Math.abs(p.z-face.z))).toBe(1);
    }
    expect(w.tiles[index(face)]).toEqual({terrain:'rock',stone:'granite',smoothedWall367:true});
    expect(w.jobs.includes(job)).toBe(false);expect(p.jobId).toBeNull();expect(validateWorld(w)).toEqual([]);
    // Construction learning 0.1 XP per Core tick = 1 XP (1000 milli) per local tick of work.
    expect(p.skills.construction.xp-xp0).toBe(workTicks*1000);
    // Construction 8, full capacities: SmoothingSpeed at most 1, so at least 6500/1.7 Core ticks.
    expect(workTicks).toBeGreaterThanOrEqual(Math.ceil(650/1.7));expect(workTicks).toBeLessThanOrEqual(Math.ceil(650/(1.7*.8)));
    // The same world without the flag isolates the wall from filth or moves.
    const raw=structuredClone(w);delete raw.tiles[index(face)]!.smoothedWall367;
    const room1=captureRoomQuality(w).room({x:15,z:15})!,room0=captureRoomQuality(raw).room({x:15,z:15})!;
    expect(room1.total-room0.total).toBe(1);expect(room1.wealth-room0.wealth).toBe(7);expect(colonyWealth(w).structures-colonyWealth(raw).structures).toBe(7);
    expect(rockInspection(w.tiles[index(face)]!)).toMatchObject({title:'Paroi de granite lissée'});
    const copy=reload(w);expect(copy.tiles[index(face)]).toEqual(w.tiles[index(face)]);
    // Mining the smoothed wall: same HP (granite 900) and the same chunk draw as raw granite.
    expect(rockMaxHP(w.tiles[index(face)]!)).toBe(900);expect(CHUNK_CHANCE).toBe(.25);
    const chunks0=w.piles.filter(q=>q.item==='granite-chunk').length;
    area(w,'mine',face);until(w,()=>w.tiles[index(face)]!.terrain==='rough-stone',1500);
    expect(w.tiles[index(face)]).toEqual({terrain:'rough-stone',stone:'granite'});
    expect(w.piles.filter(q=>q.item==='granite-chunk').length-chunks0).toBeLessThanOrEqual(1);
    expect(w.piles.some(q=>q.item.endsWith('-blocks'))).toBe(false);reload(w);
  });

  test('an inner corner no builder can touch is smoothed with its two smoothed sides, and goes back to raw rock when a side is mined',()=>{
    const {w,index}=rockRoom(),north={x:14,z:13},west={x:13,z:14},corner={x:13,z:13};
    area(w,'smooth-wall',north);area(w,'smooth-wall',west);area(w,'smooth-wall',corner);expect(w.jobs.filter(j=>j.kind==='smooth-wall')).toHaveLength(3);
    until(w,()=>!!w.tiles[index(north)]!.smoothedWall367&&!!w.tiles[index(west)]!.smoothedWall367,2500);
    // SmoothableWallUtility.Notify_SmoothedByPawn: four blocked sides, two smoothed, open diagonal.
    expect(w.tiles[index(corner)]!.smoothedWall367).toBe(true);expect(smoothJob(w,corner)).toBeUndefined();
    expect(w.events.some(e=>e.message.includes('angle'))).toBe(true);
    const room=captureRoomQuality(w).room({x:15,z:15})!;expect(room.adjacent.has(index(corner))).toBe(true);
    area(w,'mine',north);until(w,()=>w.tiles[index(north)]!.terrain==='rough-stone',1500);
    // Notify_BuildingDestroying: the corner's four sides were still blocked, the west wall's were not.
    expect(w.tiles[index(corner)]).toEqual({terrain:'rock',stone:'granite'});
    expect(w.tiles[index(west)]!.smoothedWall367).toBe(true);reload(w);
  });

  test('abandoning resets the work and keeps the XP; a mid-work save reloads and continues exactly',()=>{
    const {w,p,index}=rockRoom(),face={x:16,z:13};
    area(w,'smooth-wall',face);const job=smoothJob(w,face)!;
    until(w,()=>workProgress(job)>5);const xp=p.skills.construction.xp;
    ok(w,{type:'draft',pawnIds:[p.id],enabled:true});
    expect(job).toMatchObject({status:'pending',reservedBy:null,progress:0});expect(job.workRemainder).toBeUndefined();
    expect(p.skills.construction.xp).toBe(xp);expect(w.tiles[index(face)]!.smoothedWall367).toBeUndefined();reload(w);
    ok(w,{type:'draft',pawnIds:[p.id],enabled:false});until(w,()=>workProgress(job)>10);
    const raw=serializeWorld(w),copy=reload(w),at=w.tick;
    until(w,()=>!!w.tiles[index(face)]!.smoothedWall367);stepWorld(copy,w.tick-at);
    expect(serializeWorld(copy)).toBe(serializeWorld(w));expect(raw).not.toBe(serializeWorld(w));
  });

  test('refusals: a built wall, ore, collapsed rock, the map edge and an already smoothed wall; Mine and SmoothWall replace each other; the surface tool splits wall and floor',()=>{
    const {w,index}=rockRoom(),wall=fixtureBuilding(w,'wall',20,20);refreshStock(w);
    const refused=(c:Cell,reason:RegExp)=>{const r=applyCommand(w,{type:'designate',kind:'smooth-wall',x:c.x,z:c.z});expect(r.ok).toBe(false);expect(r.reason).toMatch(reason);};
    refused(wall,/roche naturelle/);expect(applyCommand(w,{type:'area',action:'smooth-wall',from:wall,to:wall}).ok).toBe(false);
    w.tiles[index({x:19,z:19})]={terrain:'rock',stone:'granite',ore:'steel'};refused({x:19,z:19},/filon/);
    w.tiles[index({x:5,z:5})]={terrain:'rock',stone:'granite'};refused({x:5,z:5},/dix cases du bord/);
    w.tiles[index({x:11,z:11})]={terrain:'rock',stone:'granite',smoothedWall367:true};refused({x:11,z:11},/déjà lissé/);
    expect(validateWorld(w)).toEqual([]);
    const face={x:15,z:13};
    ok(w,{type:'designate',kind:'mine',...face});expect(w.jobs.some(j=>j.kind==='mine'&&j.x===face.x&&j.z===face.z)).toBe(true);
    area(w,'smooth-wall',face);expect(w.jobs.some(j=>j.kind==='mine'&&j.x===face.x&&j.z===face.z)).toBe(false);expect(smoothJob(w,face)).toBeDefined();
    area(w,'mine',face);expect(smoothJob(w,face)).toBeUndefined();expect(w.jobs.some(j=>j.kind==='mine'&&j.x===face.x&&j.z===face.z)).toBe(true);
    ok(w,{type:'designate',kind:'smooth-wall',...face});expect(w.jobs.filter(j=>j.x===face.x&&j.z===face.z).map(j=>j.kind)).toEqual(['smooth-wall']);
    // The SmoothSurface mark sits on the wall, above the rock like the mining mark.
    expect(designationIconInstances(w).find(i=>i.x===face.x&&i.z===face.z)).toMatchObject({icon:82,y:3.2});
    ok(w,{type:'designate',kind:'mine',...face});expect(w.jobs.filter(j=>j.x===face.x&&j.z===face.z).map(j=>j.kind)).toEqual(['mine']);
    expect(validateWorld(w)).toEqual([]);
    const s=rockRoom();s.w.tiles[s.index({x:15,z:15})]={terrain:'rough-stone',stone:'granite'};s.w.pawns[0]!.x=14;
    expect(area(s.w,'smooth-surface',{x:15,z:13},{x:15,z:15})).toMatchObject({affected:2,skipped:1});
    expect(s.w.jobs.map(j=>[j.kind,j.x,j.z])).toEqual([['smooth-wall',15,13],['smooth-floor',15,15]]);expect(validateWorld(s.w)).toEqual([]);
  });

  test('nothing below 367: older saves cannot hold a smoothed wall or a SmoothWall job, the tools are refused there, and 366 migrates by number only',()=>{
    const {w,index}=rockRoom(),plain=serializeWorld(w);
    expect(serializeWorld(deserializeWorld(asOldSchema(plain,366)))).toBe(asNumberOnly(plain,366));
    const smoothed=structuredClone(w);smoothed.tiles[index({x:15,z:13})]={terrain:'rock',stone:'granite',smoothedWall367:true};
    expect(validateWorld(smoothed)).toEqual([]);expect(()=>deserializeWorld(asOldSchema(serializeWorld(smoothed),366))).toThrow();
    const designated=structuredClone(w);area(designated,'smooth-wall',{x:15,z:13});
    expect(()=>deserializeWorld(asOldSchema(serializeWorld(designated),366))).toThrow();
    expect(validSmoothWallsHistoricalTransport367(JSON.parse(asOldSchema(serializeWorld(designated),366)),366)).toBe(false);
    expect(validSmoothWallTile367({terrain:'rock',stone:'granite',smoothedWall367:true},366)).toBe(false);
    expect(validSmoothWallTile367({terrain:'rock',stone:'granite',ore:'steel',smoothedWall367:true},367)).toBe(false);
    expect(validSmoothWallTile367({terrain:'rough-stone',stone:'granite',smoothedWall367:true},367)).toBe(false);
    const old=structuredClone(w);Object.assign(old,{schemaVersion:366});
    expect(applyCommand(old,{type:'area',action:'smooth-wall',from:{x:15,z:13},to:{x:15,z:13}}).ok).toBe(false);
    expect(applyCommand(old,{type:'area',action:'smooth-surface',from:{x:15,z:13},to:{x:15,z:13}}).ok).toBe(false);
    expect(applyCommand(old,{type:'designate',kind:'smooth-wall',x:15,z:13}).ok).toBe(false);
    // A 366 mine designation leaves no SmoothWall to replace and is unchanged.
    expect(applyCommand(old,{type:'designate',kind:'mine',x:15,z:13}).ok).toBe(true);
  });

  test('transport: the smoothed state travels as the thirteenth tile slot; both decoders adopt it, a 366 packet with it is refused',()=>{
    const {w,index}=rockRoom(),cell=index({x:15,z:13});
    const encoder=new SnapshotEncoder(),strict=new SnapshotDecoder(),resident=new ResidentPresentationAssembler();
    const first=structuredClone(encoder.encode(w,0,0));expect(strict.adopt(structuredClone(first)).status).toBe('applied');expect(resident.adopt(structuredClone(first)).status).toBe('applied');
    const before=w.tiles.slice();area(w,'smooth-wall',{x:15,z:13});until(w,()=>!!w.tiles[cell]!.smoothedWall367);
    const cache=new TileSnapshotCache();cache.reset(before);
    const tuple=cache.diff(w.tiles).find(t=>t[0]===cell)!;expect(tuple).toHaveLength(13);expect(tuple[12]).toBe(true);
    const next=structuredClone(encoder.encode(w,0,0)),a=strict.adopt(structuredClone(next)),b=resident.adopt(structuredClone(next));
    expect(a.status).toBe('applied');expect(b.status).toBe('applied');
    if(a.status==='applied'&&b.status==='applied'){expect(a.world.tiles[cell]).toMatchObject({terrain:'rock',smoothedWall367:true});expect(b.world.tiles[cell]).toMatchObject({terrain:'rock',smoothedWall367:true});}
    const packet=structuredClone(new SnapshotEncoder().encode(w,0,0)),old=structuredClone(packet);old.world.schemaVersion=366 as never;
    expect(validSmoothWallsHistoricalTransport367(packet,367)).toBe(true);expect(validSmoothWallsHistoricalTransport367(old,366)).toBe(false);
    expect(new SnapshotDecoder().adopt(structuredClone(old)).status).toBe('resync');
    expect(validSmoothWallsHistoricalTransport367({type:'snapshot',tiles:[[cell,'rock','granite',undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,undefined,true]]},366)).toBe(false);
  });

  test('presentation: a smoothed wall is the same rock with a level top and plumb faces, rebuilt only around its cell',()=>{
    const {w,index}=rockRoom(),cell=index({x:15,z:13}),layer=new RockLayer();
    layer.update(w,true);const raw=rockCorner(w,15,13);
    const tiles=w.tiles.slice();tiles[cell]={...tiles[cell]!,smoothedWall367:true};const smoothed={...w,tiles};
    layer.update(smoothed,false,[cell]);expect(layer.stats.updatedCells).toBeGreaterThan(0);expect(layer.stats.updatedCells).toBeLessThanOrEqual(9);
    const corner=rockCorner(smoothed,15,13);expect(corner.top).toBe(2.7);expect(corner.shoulder).toBeCloseTo(2.48,10);
    expect(Math.abs(corner.x-14.5)).toBeLessThanOrEqual(.06+1e-9);expect(raw.top).not.toBe(2.7);
  });
});
