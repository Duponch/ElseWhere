import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {addMaterial,refreshStock} from '../src/sim/materials.ts';
import {STONE_KINDS,validStoneIdentity} from '../src/sim/geology.ts';
import {isNaturalTerrain256,NATURAL_TERRAIN_DEFINITIONS_256} from '../src/sim/local-terrain-definitions-256.ts';
import {terrainAvailable256,terrainHasProspectiveRules256,terrainSupportsAffordance256,terrainGroundFertility256,terrainHoldsSnow256,terrainAcceptsFilth256,readNaturalPlantSubstrate256,naturalPlantSubstrate256} from '../src/sim/natural-terrain-runtime-256.ts';
import {naturalTerrainCosts256,naturalTerrainWalkable256} from '../src/sim/natural-terrain-movement-256.ts';
import {SMOOTHED_STONE_TERRAIN_281,SMOOTHED_STONE_FACTS_281,smoothFloorSourceStone281,smoothedStoneCoreDef281,smoothedStoneLabel281} from '../src/sim/smooth-floor-terrain-281.ts';
import {floorBeauty} from '../src/sim/room-beauty.ts';
import {floorRoomMarketValue} from '../src/sim/room-market-value.ts';
import {colonyWealth} from '../src/sim/colony-wealth.ts';
import {captureRoomQuality} from '../src/sim/room-quality.ts';
import {roomCleanliness,addFilth} from '../src/sim/filth.ts';
import {FILTH_DEFINITIONS} from '../src/sim/filth-rules.ts';
import {FLOOR_DEFINITIONS,canDesignateFloor} from '../src/sim/flooring.ts';
import {terrainTravelDelay} from '../src/sim/furniture-travel.ts';
import {placeCollapsedRock256,excavatedCollapsedRock256,validCollapsedRock256,admittedRoofTerrain256} from '../src/sim/collapsed-rocks-256.ts';
import {captureTerrainJournal,readTerrainJournal} from '../src/sim/terrain-mutation-journal.ts';
import {initializeSnowSurface,setSnowDepth,snowDepthAt} from '../src/sim/snow-surface.ts';
import {terrainInspection,terrainSurfaceLabel} from '../src/ui/terrain-inspection.ts';
import {rockInspection} from '../src/ui/geology-inspection.ts';
import {createTerrainPaintTexture,patchTerrainPaintTexture,terrainPaintPixelsPerCell} from '../src/render/TerrainLayer.ts';
import {terrainSurfaceChanges} from '../src/render/terrain-state.ts';
import {deconstructionCamp} from './scenarios/deconstruction.ts';
import {cleanlinessCamp,enclosedRoom} from './scenarios/cleanliness.ts';
import type {Tile,World} from '../src/sim/types.ts';

const rows=[
 ['granite','Granite lissé','Granite_Smooth'],['limestone','Calcaire lissé','Limestone_Smooth'],
 ['marble','Marbre lissé','Marble_Smooth'],['sandstone','Grès lissé','Sandstone_Smooth'],['slate','Ardoise lissée','Slate_Smooth'],
] as const;
const at=(w:World,c:{x:number;z:number})=>c.z*w.width+c.x;
function until(w:World,predicate:()=>boolean,limit=500):void {
 for(let n=0;n<limit&&!predicate();n++)stepWorld(w);
 expect(predicate(),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns.map(p=>({id:p.id,state:p.state,jobId:p.jobId,path:p.path}))})).toBe(true);
 expect(validateWorld(w)).toEqual([]);
}

// These are definition/reader inputs, not an assertion that smoothing or
// extraction has been played. The separate service scenario starts in rock.
test.each(rows)('%s keeps its real identity and the shared Core smooth-terrain facts', (stone,label,coreDef)=>{
 const rough:Tile={terrain:'rough-stone',stone},tile:Tile={terrain:SMOOTHED_STONE_TERRAIN_281,stone};
 expect(smoothFloorSourceStone281(rough)).toBe(stone);expect(smoothFloorSourceStone281(tile)).toBeUndefined();
 expect(smoothedStoneLabel281(stone)).toBe(label);expect(smoothedStoneCoreDef281(stone)).toBe(coreDef);
 expect(validStoneIdentity(stone,tile.terrain,281)).toBe(true);
 expect(SMOOTHED_STONE_FACTS_281).toMatchObject({beauty:2,marketValue:5,pathCostCore:0,cleanliness:0,cleaningTime:1,fertility:0,flammability:0,layerable:false,removable:false});
 for(const need of ['Walkable','Light','Medium','Heavy'] as const)expect(terrainSupportsAffordance256(tile,need,{schemaVersion:281})).toBe(true);
 for(const need of ['GrowSoil','Diggable','Bridgeable','SmoothableStone'] as const)expect(terrainSupportsAffordance256(tile,need,{schemaVersion:281})).toBe(false);
 expect(terrainHoldsSnow256(tile.terrain)).toBe(true);expect(terrainAcceptsFilth256(tile)).toBe(true);
 expect(terrainGroundFertility256(tile)).toBe(0);expect(naturalTerrainWalkable256(tile.terrain)).toBe(true);
 expect(naturalTerrainCosts256(tile.terrain)?.pathCostCore).toBe(0);
 expect(floorBeauty(tile)).toBe(2);expect(floorBeauty(tile,true)).toBe(2);expect(floorRoomMarketValue(tile)).toBe(5);
 const substrate=readNaturalPlantSubstrate256(tile);
 expect(substrate).toEqual({fertility:0,terrainDefId:coreDef,tags:['Floor']});expect(substrate).toBe(readNaturalPlantSubstrate256({...tile}));
 expect(Object.isFrozen(substrate)).toBe(true);expect(Object.isFrozen(substrate.tags)).toBe(true);
 expect(naturalPlantSubstrate256(tile)).toEqual(substrate);
 expect(terrainSurfaceLabel(tile)).toBe(label);expect(terrainInspection(tile,{schemaVersion:281})).toContain('Beauté : 2 · Propreté du sol : 0.0 · Valeur : 5');
 expect(rockInspection(tile)?.title).toBe(label);
});

test('new substrate is closed to280/future297 and neither generation nor untyped historical rough terrain is enriched',()=>{
 expect(isNaturalTerrain256(SMOOTHED_STONE_TERRAIN_281)).toBe(false);
 expect(Object.hasOwn(NATURAL_TERRAIN_DEFINITIONS_256,SMOOTHED_STONE_TERRAIN_281)).toBe(false);
 expect(naturalTerrainCosts256('rough-stone')?.pathCostCore).toBe(2); // Historical Rough/RoughHewn merge is preserved.
 for(const version of [27,28,256,280,297]){
  expect(terrainAvailable256(SMOOTHED_STONE_TERRAIN_281,version)).toBe(false);
  for(const stone of STONE_KINDS)expect(validStoneIdentity(stone,SMOOTHED_STONE_TERRAIN_281,version)).toBe(false);
 }
 expect(terrainAvailable256(SMOOTHED_STONE_TERRAIN_281,281)).toBe(true);
 for(const version of [282,296]){
  expect(terrainAvailable256(SMOOTHED_STONE_TERRAIN_281,version)).toBe(true);
  for(const stone of STONE_KINDS)expect(validStoneIdentity(stone,SMOOTHED_STONE_TERRAIN_281,version)).toBe(true);
 }
 expect(terrainHasProspectiveRules256(SMOOTHED_STONE_TERRAIN_281,{schemaVersion:281})).toBe(true);
 expect(terrainHasProspectiveRules256('rough-stone',{schemaVersion:281})).toBe(false);
 expect(validStoneIdentity(undefined,SMOOTHED_STONE_TERRAIN_281,281)).toBe(false);
 expect(validStoneIdentity('basalt',SMOOTHED_STONE_TERRAIN_281,281)).toBe(false);
 expect(validStoneIdentity(undefined,'rough-stone',280)).toBe(true);expect(validStoneIdentity(undefined,'rock',281)).toBe(true);
 const rough:Tile={terrain:'rough-stone',stone:'granite'};
 for(const extra of [{floor:'wood-planks' as const},{bridge:true as const},{ore:'steel' as const},{miningDamage:1},{miningYield:0},{collapsedRock:{id:1,terrain:'grass' as const}}])expect(smoothFloorSourceStone281({...rough,...extra})).toBeUndefined();
 expect(smoothFloorSourceStone281({terrain:'rough-stone'})).toBeUndefined();
});

test('real paid overlay construction and removal restore the exact declared smooth substrate without refunding stone',()=>{
 const w=cleanlinessCamp(),p=w.pawns[0]!,target={x:p.x+3,z:p.z},index=at(w,target);
 // Initial terrain and three finite wood units are declared; only the overlay
 // is acquired below through ordinary deliveries, work and removal commands.
 w.tiles[index]={terrain:SMOOTHED_STONE_TERRAIN_281,stone:'slate'};p.priorities.clean=0;p.priorities.build=1;
 addMaterial(w,'wood',3,{type:'ground',x:p.x-1,z:p.z},'wood');refreshStock(w);
 expect(validateWorld(w)).toEqual([]);expect(terrainTravelDelay(w,index)).toBe(0);
 expect(canDesignateFloor(w,{type:'designate',kind:'remove-floor',...target}).ok).toBe(false);
 const cursor=captureTerrainJournal(w.tiles);
 expect(applyCommand(w,{type:'designate',kind:'lay-floor',floor:'wood-planks',...target})).toEqual({ok:true});
 until(w,()=>w.tiles[index]!.floor==='wood-planks');
 expect(w.tiles[index]).toEqual({terrain:SMOOTHED_STONE_TERRAIN_281,stone:'slate',floor:'wood-planks'});
 expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(0);
 expect(floorBeauty(w.tiles[index]!)).toBe(0);expect(floorRoomMarketValue(w.tiles[index]!)).toBeCloseTo(3*1.2+85*.0036);
 expect(readNaturalPlantSubstrate256(w.tiles[index]!).tags).toEqual([]);
 expect(terrainInspection(w.tiles[index]!,w)).toContain('Terrain conservé : Ardoise lissée');
 const loaded=deserializeWorld(serializeWorld(w));expect(loaded).toEqual(w);
 expect(applyCommand(w,{type:'designate',kind:'remove-floor',...target})).toEqual({ok:true});until(w,()=>!w.tiles[index]!.floor);
 expect(w.tiles[index]).toEqual({terrain:SMOOTHED_STONE_TERRAIN_281,stone:'slate'});
 expect(w.stock.wood+w.deconstructed.lostWood).toBe(3);expect(w.deconstructed.count).toBe(1);
 expect(w.piles.some(p=>p.kind==='chunk'||p.kind==='blocks')).toBe(false);
 expect(floorRoomMarketValue(w.tiles[index]!)).toBe(5);expect(floorBeauty(w.tiles[index]!)).toBe(2);
 expect(readTerrainJournal(w.tiles,cursor)?.indices).toContain(index);
 expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('a real collapsed-rock owner retains the new stone and its terrain statistics until exact excavation restoration',()=>{
 const w=deconstructionCamp(),index=14*w.width+14,original:Tile={terrain:SMOOTHED_STONE_TERRAIN_281,stone:'marble'},snowIndex=index+1;
 w.tiles[index]=original;
 // Declared fresh snow authority, on adjacent walkable ground. The full rock
 // itself cannot retain depth; this fixture does not claim a snowy collapse.
 if(!w.snow)initializeSnowSurface(w);setSnowDepth(w,snowIndex,.3);expect(snowDepthAt(w,snowIndex)).toBe(.3);
 expect(validateWorld(w)).toEqual([]);const rng=w.rng,nextId=w.nextId,cursor=captureTerrainJournal(w.tiles);
 placeCollapsedRock256(w,index);const fallen=w.tiles[index]!;
 expect(fallen).toMatchObject({terrain:'rock',stone:'marble',collapsedRock:{id:nextId,terrain:SMOOTHED_STONE_TERRAIN_281}});
 expect(snowDepthAt(w,index)).toBe(0);expect(snowDepthAt(w,snowIndex)).toBe(.3);
 expect(w.nextId).toBe(nextId+1);expect(w.rng).toBe(rng);expect(validateWorld(w)).toEqual([]);
 const valid=(tile:object,version:number)=>validCollapsedRock256(tile,version,w.nextId,(value):value is Tile['terrain']=>admittedRoofTerrain256(value,version));
 expect(valid(fallen,281)).toBe(true);expect(valid(fallen,280)).toBe(false);expect(valid(fallen,282)).toBe(true);expect(valid(fallen,296)).toBe(true);expect(valid(fallen,297)).toBe(false);
 const missing=structuredClone(fallen);delete missing.stone;expect(valid(missing,281)).toBe(false);
 expect(floorRoomMarketValue(fallen)).toBe(5);expect(floorBeauty(fallen)).toBe(2);expect(colonyWealth(w).floors).toBe(5);
 expect(deserializeWorld(serializeWorld(w))).toEqual(w);
 expect(excavatedCollapsedRock256(fallen)).toEqual(original);expect(w.tiles[index]).toBe(fallen); // Pure preview never excavates by itself.
 expect(readTerrainJournal(w.tiles,cursor)?.indices).toEqual([index]);expect(w.rng).toBe(rng);
});

test('ordinary room readers and real cleaning use beauty2, cleanliness0 and normal cleaning work on the new bare floor',()=>{
 const w=cleanlinessCamp(),room=enclosedRoom(w,{x:8,z:8}),p=w.pawns[0]!;
 const before=captureRoomQuality(w).room(room.inside)!;expect(before).not.toBeNull();
 for(const index of room.cells)w.tiles[index]={terrain:SMOOTHED_STONE_TERRAIN_281,stone:'limestone'};
 Object.assign(p,room.inside);p.priorities.clean=1;
 expect(applyCommand(w,{type:'area',action:'home',from:room.inside,to:{x:room.inside.x+2,z:room.inside.z+2}}).ok).toBe(true);
 expect(w.home).toEqual([...room.cells].sort((a,b)=>a-b));
 expect(validateWorld(w)).toEqual([]);
 const clean=captureRoomQuality(w).room(room.inside)!;
 expect(clean.wealth-before.wealth).toBeCloseTo(5*room.cells.length);expect(clean.total-before.total).toBe(5*room.cells.length);
 expect(clean.cleanliness).toBe(0);expect(roomCleanliness(w,room.inside)).toBe(0);
 const rng=w.rng;expect(addFilth(w,room.inside,'dirt')).toBe(true);expect(w.rng).toBe(rng);
 expect(roomCleanliness(w,room.inside)).toBeCloseTo(FILTH_DEFINITIONS.dirt.cleanliness/room.cells.length);
 expect(FLOOR_DEFINITIONS['wood-planks'].cleaningTime).toBe(SMOOTHED_STONE_FACTS_281.cleaningTime);
 expect(applyCommand(w,{type:'clean-room',pawnId:p.id,...room.inside})).toEqual({ok:true});
 until(w,()=>w.filth?.items.length===0,100);expect(w.filth?.cleaned).toBe(1);expect(roomCleanliness(w,room.inside)).toBe(0);
 expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});

test('new bare substrate visibility affects colony wealth separately from physical room value and leaves historical overlays unchanged',()=>{
 const w=deconstructionCamp(),index=14*w.width+14;w.tiles[index]={terrain:SMOOTHED_STONE_TERRAIN_281,stone:'sandstone'};
 expect(validateWorld(w)).toEqual([]);expect(colonyWealth(w).floors).toBe(5);
 // Isolated reader candidates only: campaign/fog authority is owned by the
 // common transport tests, not manufactured on this legacy fixture.
 const hidden={...w,tiles:w.tiles.map((t,i)=>i===index?{...t,fogged:true as const}:t)};
 expect(floorRoomMarketValue(hidden.tiles[index]!)).toBe(5);expect(colonyWealth(hidden).floors).toBe(0);
 const covered={...hidden,tiles:hidden.tiles.map((t,i)=>i===index?{...t,floor:'wood-planks' as const}:t)};
 const historical={...covered,tiles:covered.tiles.map((t,i)=>i===index?{...t,terrain:'grass' as const,stone:undefined}:t)};
 // Schema 327 (Core WealthWatcher): nothing under the fog counts, floors included.
 expect(colonyWealth(covered).floors).toBe(0);expect(colonyWealth(historical).floors).toBe(0);
 // Before 327 the laid floor counted under the fog.
 const at326=<T extends object>(v:T):T=>({...v,schemaVersion:326});
 expect(colonyWealth(at326(covered)).floors).toBeCloseTo(floorRoomMarketValue(covered.tiles[index]!));
 expect(colonyWealth(at326(covered)).floors).toBe(colonyWealth(at326(historical)).floors); // No retroactive floor/fog fix.
});

test('resident terrain paint patches rough to smooth by real stone pigment with unchanged texture budget and alpha convention',()=>{
 const w=deconstructionCamp(),index=14*w.width+14;w.tiles[index]={terrain:'rough-stone',stone:'granite'};
 const before={...w,tiles:w.tiles},texture=createTerrainPaintTexture(w),initial=new Uint8Array(texture.image.data as Uint8Array),colors=new Set<string>();
 w.tiles=w.tiles.map((tile,i)=>i===index?{...tile,terrain:SMOOTHED_STONE_TERRAIN_281}:tile);
 const changes=terrainSurfaceChanges(before,w);expect(changes).toEqual([index]);
 try{
  const scale=terrainPaintPixelsPerCell(w);expect(patchTerrainPaintTexture(texture,w,changes!)).toBe(9*scale*scale);
  expect(texture.image.width).toBe(w.width*scale);expect((texture.image.data as Uint8Array).byteLength).toBe(initial.byteLength);
  expect(texture.image.data).not.toEqual(initial);
  const data=texture.image.data as Uint8Array;let sameAlpha=true;for(let i=3;i<data.length;i+=4)if(data[i]!==initial[i]){sameAlpha=false;break;}expect(sameAlpha).toBe(true);
  for(const stone of STONE_KINDS){
   const previous={...w,tiles:w.tiles};w.tiles=w.tiles.map((tile,i)=>i===index?{...tile,stone}:tile);
   const changed=terrainSurfaceChanges(previous,w);expect(changed).toEqual(stone==='granite'?[]:[index]);
   patchTerrainPaintTexture(texture,w,[index]);
   const palette=texture.userData.terrainPalette as Uint8Array;colors.add(Array.from(palette.slice(index*3,index*3+3)).join(','));
  }
  expect(colors.size).toBe(5);expect(validateWorld(w)).toEqual([]);
  const fresh=createTerrainPaintTexture(w);try{expect(texture.image.data).toEqual(fresh.image.data);}finally{fresh.dispose();}
 }finally{texture.dispose();}
});
