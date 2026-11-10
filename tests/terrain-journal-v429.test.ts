import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {captureTerrainJournal,readTerrainJournal,markTerrainCellChanged,invalidateTerrainJournal,TERRAIN_JOURNAL_CAPACITY} from '../src/sim/terrain-mutation-journal';
import {createWorld} from '../src/sim/index';
import {deserializeCampaign,serializeCampaign} from '../src/sim/serialization';
import {decodeStoredSave} from '../src/ui/save-storage-codec';
import {campaignPresentation} from '../src/sim/secondary-site-presentation';
import {hasLoadedRoot} from '../src/sim/world-map-context';
import {placeCollapsedRock256} from '../src/sim/collapsed-rocks-256';
import {setSnowDepth} from '../src/sim/snow-surface';
import {ensureFireState} from '../src/sim/fire-rules';
import {burnFloor} from '../src/sim/flooring';
import {destroyBridge} from '../src/sim/bridge';
import {damageRoofMineable256} from '../src/sim/roof-mineable-damage-256';
import {prepareStartingSpawnFog256} from '../src/sim/starting-spawn-fog-256';
import type {World,Tile} from '../src/sim/types';

/** Small prepared transport/physical-writer fixture, not a generated geographic
 * save. The public/historical input cases below supply the real SAVE boundary. */
function fixture():World {
 const world=createWorld(429,16,16);world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.resources=[];world.structures=[];world.jobs=[];
 return world;
}
function pair(world=fixture()){
 // Match the fixed Worker's structure mode; the public Encoder still discovers
 // every terrain value independently of the closed terrain journal.
 const full=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),closed=new TerrainJournalSnapshotEncoder();
 const history:unknown[]=[],frozen:unknown[]=[];
 const send=(checkpoint=false)=>{const before=structuredClone(world),a=structuredClone(full.encode(world,0,1,checkpoint)),b=structuredClone(closed.encode(world,0,1,checkpoint));expect(b).toStrictEqual(a);expect(world).toStrictEqual(before);expect(history).toStrictEqual(frozen);history.push(b);frozen.push(structuredClone(b));return b;};
 return {world,full,closed,send};
}

test('journal versions are same-tick, nonconsumptive and bounded with full invalidation on gaps',()=>{
 const tiles:Tile[]=[{terrain:'soil'},{terrain:'soil'}],a=captureTerrainJournal(tiles),b=captureTerrainJournal(tiles);
 markTerrainCellChanged(tiles,1);markTerrainCellChanged(tiles,0);markTerrainCellChanged(tiles,1);
 expect(readTerrainJournal(tiles,a)?.indices).toStrictEqual([0,1]);expect(readTerrainJournal(tiles,b)?.indices).toStrictEqual([0,1]);
 const next=readTerrainJournal(tiles,a)!.cursor;expect(readTerrainJournal(tiles,next)?.indices).toStrictEqual([]);
 invalidateTerrainJournal(tiles);expect(readTerrainJournal(tiles,next)).toBeUndefined();
 const reset=captureTerrainJournal(tiles);for(let i=0;i<=TERRAIN_JOURNAL_CAPACITY;i++)markTerrainCellChanged(tiles,0);
 expect(readTerrainJournal(tiles,reset)).toBeUndefined();expect(readTerrainJournal(tiles.slice(),captureTerrainJournal(tiles))).toBeUndefined();
 const length=captureTerrainJournal(tiles);tiles.push({terrain:'soil'});expect(readTerrainJournal(tiles,length)).toBeUndefined();
});

test('covered same World/same tick primitives, deletions and A-B-A produce exact complete Encoder packets',()=>{
 const h=pair(),w=h.world,tick=w.tick;h.send();
 const edit=(fn:()=>void)=>{fn();markTerrainCellChanged(w.tiles,0);return h.send();};
 edit(()=>{w.tiles[0]!.floor='wood-planks';});edit(()=>{delete w.tiles[0]!.floor;});
 edit(()=>{w.tiles[0]={terrain:'rock',stone:'granite',ore:'steel',miningDamage:80,miningYield:.1234567890123456,snowDepth:.4,bridge:true,floor:'wood-planks',fogged:true,mineable:{id:w.nextId++,def:'MineableSteel',terrain:'rough-stone'}};});
 edit(()=>{w.tiles[0]!.mineable!.id=w.nextId++;w.tiles[0]!.mineable!.terrain='gravel';});
 edit(()=>{w.tiles[0]={terrain:'soil',bridge:undefined};});
 w.tiles[0]!.floor='wood-planks';markTerrainCellChanged(w.tiles,0);delete w.tiles[0]!.floor;markTerrainCellChanged(w.tiles,0);
 const unchanged=h.send();if(unchanged.kind!=='delta')throw Error('delta');expect(unchanged.tiles).toBeUndefined();expect(w.tick).toBe(tick);
 h.send(true);h.send();
});

test('two closed encoders retain independent cursors and see all interleaved edits',()=>{
 const w=fixture(),a=new TerrainJournalSnapshotEncoder(),b=new TerrainJournalSnapshotEncoder();
 const send=()=>expect(structuredClone(a.encode(w,0,1))).toStrictEqual(structuredClone(b.encode(w,0,1)));
 send();w.tiles[0]!.floor='wood-planks';markTerrainCellChanged(w.tiles,0);send();
 w.tiles[1]!.floor='granite-tile';markTerrainCellChanged(w.tiles,1);send();send();
});

test('array replacement same dimensions/tick, overflow and bulk invalidation fall back to full value DIFF',()=>{
 const h=pair(),w=h.world;h.send();
 w.tiles=w.tiles.map(t=>({...t}));w.tiles[1]!.floor='wood-planks';const replaced=h.send();if(replaced.kind!=='delta')throw Error('delta');expect(replaced.tiles?.[0]?.[0]).toBe(1);
 w.tiles[2]!.floor='granite-tile';markTerrainCellChanged(w.tiles,2);h.send();
 w.tiles[0]!.floor='wood-planks';for(let i=0;i<=TERRAIN_JOURNAL_CAPACITY;i++)markTerrainCellChanged(w.tiles,0);h.send();
 delete w.tiles[1]!.floor;invalidateTerrainJournal(w.tiles);h.send();h.send();
 expect(h.closed.campaignHeader(true)).toStrictEqual(h.full.campaignHeader(true));h.send();
 w.tiles[3]!.snowDepth=.1;markTerrainCellChanged(w.tiles,3);h.send();
});

test('public mutable Encoder remains complete even for a table already enrolled by the closed lane',()=>{
 const h=pair(),w=h.world;h.send();w.tiles[0]!.floor='wood-planks';
 const publicDelta=structuredClone(h.full.encode(w,0,1));if(publicDelta.kind!=='delta')throw Error('delta');expect(publicDelta.tiles).toStrictEqual([[0,'soil',undefined,undefined,undefined,'wood-planks']]);
 // The unmarked external edit is deliberately OUTSIDE closed authority. A full
 // checkpoint rejoins it; public encoding never opts into the existing journal.
 h.closed.encode(w,0,1,true);Object.defineProperty(w.tiles[0]!,'fogged',{value:undefined,enumerable:true,configurable:true});
 expect(()=>h.full.encode(w,0,1)).toThrow('Invalid actual fog field');
});

test('late codec refusal forces a complete closed checkpoint on an explicit retry',()=>{
 const h=pair(),w=h.world;h.send();w.tiles[0]!.floor='wood-planks';w.tiles[1]!.floor='granite-tile';
 markTerrainCellChanged(w.tiles,0);markTerrainCellChanged(w.tiles,1);Object.defineProperty(w.tiles[1]!,'fogged',{value:undefined,enumerable:true,configurable:true});
 expect(()=>h.full.encode(w,0,1)).toThrow('Invalid actual fog field');expect(()=>h.closed.encode(w,0,1)).toThrow('Invalid actual fog field');
 delete w.tiles[1]!.fogged;
 const expected=structuredClone(h.full.encode(w,0,1,true)),actual=structuredClone(h.closed.encode(w,0,1));expect(actual.kind).toBe('checkpoint');expect(actual).toStrictEqual(expected);h.send();
});

test('real floor/bridge/roof-damage/collapse/snow writers retain exact transport and refusals do not invent Tile edits',()=>{
 const w=fixture();w.tiles[2]!.floor='wood-planks';w.tiles[3]={terrain:'water',bridge:true};w.tiles[4]={terrain:'rock',stone:'granite'};
 w.snow={revision:1,adoptedAt:w.tick,lastTick:w.tick,cursor:0,seed:429};ensureFireState(w);const h=pair(w);h.send();
 expect(destroyBridge(w,{x:3,z:0},'bomb',0)).toBe(false);const unchanged=h.send();if(unchanged.kind!=='delta')throw Error('delta');expect(unchanged.tiles).toBeUndefined();
 expect(burnFloor(w,{x:2,z:0})).toBe(true);h.send();expect(destroyBridge(w,{x:3,z:0},'fire')).toBe(true);h.send();
 placeCollapsedRock256(w,1);h.send();expect(damageRoofMineable256(w,4,w.tiles[4]!,1,false)).toBe(true);h.send();
 setSnowDepth(w,0,.01);h.send();setSnowDepth(w,0,.02);h.send();setSnowDepth(w,0,0);h.send();
 w.roofing??={constructed:[],build:[],remove:[],cursor:0};w.roofing.constructed=[0];w.roofing.natural={thin:[1],thick:[4]};h.send();
});

test('real historical/public inputs keep strict SAVE and shared physical campaign Tile arrays',async()=>{
 for(const file of ['public/test-saves/v394/les-aulnes-integrees.json','public/test-saves/v419/les-eclaircies.json']){
  const world=deserializeCampaign(await decodeStoredSave(readFileSync(file,'utf8')));
  if(!hasLoadedRoot(world))throw Error('Expected the public fixture to contain its physical root map');
  const before=serializeCampaign(world),view=campaignPresentation(world),h=pair(world);
  expect(view.tiles).toBe(world.tiles);h.send();h.send();expect(serializeCampaign(world)).toBe(before);
  if(file.includes('eclaircies')){
   const cell=world.tiles.findIndex(t=>t.fogged);expect(cell).toBeGreaterThanOrEqual(0);
   const plan=prepareStartingSpawnFog256(world,[{actor:world.pawns[0]!,cell:{x:cell%world.width,z:Math.floor(cell/world.width)}}]);
   expect(serializeCampaign(world)).toBe(before);h.send();
   // Change the exact preflight input, with a real source mark; rejection must
   // neither apply its staged cloned fog nor consume a publication cursor.
   delete world.tiles[cell]!.fogged;markTerrainCellChanged(world.tiles,cell);const changed=structuredClone(world);
   expect(()=>plan.commit()).toThrow('stale');expect(world).toStrictEqual(changed);h.send();
  }
 }
},240000); // 83 to 117 s measured alone on 10 November, depending on machine load.
