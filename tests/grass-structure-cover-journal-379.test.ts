import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {World,Structure} from '../src/sim/types';
import {newDoorState} from '../src/sim/door-rules';
import {RoomTopologyCache} from '../src/sim/room-topology';
import {GpuGroundGrassLayer,groundGrassPixels} from '../src/render/GpuGroundGrassLayer';
import {SceneResourceIndex} from '../src/render/scene-resource-index';
import {SceneLightTopology} from '../src/render/SceneLightTopology';
import {readResidentCollectionChanges379} from '../src/bridge/resident-collection-changes-379';
import {harness} from './resident-presentation-fixtures-v427';

function fixture(){
 const world=createWorld(720379,48,48);world.tiles=world.tiles.map(()=>({terrain:'soil'}));world.resources=[];world.structures=[];world.piles=[];world.packed=[];world.jobs=[];world.filth={rng:1,cleaned:0,items:[]};
 const building=(kind:Structure['kind'],x:number,z:number):Structure=>({id:world.nextId++,kind,x,z,material:'wood',orientation:0,footprint:'standard',...(kind==='door'?{door:newDoorState(world.tick)}:{})});
 for(let i=0;i<192;i++){const x=3+i%24,z=3+Math.floor(i/24);world.structures.push(building('stool',x,z));world.piles.push({id:world.nextId++,kind:'wood',item:'wood',quantity:5,owner:{type:'ground',x,z}});}
 const wall=building('wall',3,3),door=building('door',3,3);world.structures.push(wall,door);world.resources.push({id:world.nextId++,kind:'rock',x:3,z:3,amount:20});
 return {...harness(world),building,wall,door};
}

test('resident grass applies endpoint source journals for structures/piles without scanning unchanged rows; overlap, skipped Full, reorder and raw/reset stay exact',()=>{
 const h=fixture(),index=new SceneResourceIndex(),candidate=new GpuGroundGrassLayer(),literal=new GpuGroundGrassLayer();
 const apply=(w:World,reset=false)=>{const frame=index.adopt(w,reset);candidate.update(w,reset,undefined,frame);literal.update(w,reset);
  expect(candidate.map.image.data).toStrictEqual(literal.map.image.data);expect(candidate.map.image.data).toStrictEqual(groundGrassPixels(w));expect(candidate['coverCounts']).toStrictEqual(literal['coverCounts']);expect(candidate['previousBlocked']).toStrictEqual(literal['previousBlocked']);expect(candidate.map.version).toBe(literal.map.version);};
 try{
  const a=h.send();apply(a,true);const m=candidate.coverSourceMetrics379();
  h.world.structures[12]!.material='steel';h.world.piles[12]!.quantity--;const b=h.send();expect(readResidentCollectionChanges379(a,b,'structures')).toBeDefined();apply(b);
  const first=candidate.coverSourceMetrics379();expect(first.journalReads-m.journalReads).toBe(2);expect(first.journalRows-m.journalRows).toBe(2);expect(first.journalEdits-m.journalEdits).toBe(0);
  // Both memberships change over skipped packets; actual last applied A/B
  // still owns old contributions. Cell3,3 has several overlapping subjects.
  h.world.structures[0]!.x=30;h.world.piles[0]!.owner={type:'pawn',pawnId:h.world.pawns[0]!.id};h.send();
  h.world.structures.splice(1,1);h.world.structures.push(h.building('stool',31,31));h.world.piles[1]!.owner={type:'ground',x:31,z:31};h.world.piles.splice(2,1);h.world.piles.push({id:h.world.nextId++,kind:'wood',item:'wood',quantity:3,owner:{type:'ground',x:3,z:3}});
  const c=h.send();apply(c);const after=candidate.coverSourceMetrics379();expect(after.journalRows-first.journalRows).toBeLessThan(16);expect(after.journalEdits-first.journalEdits).toBeGreaterThan(0);
  h.world.structures.reverse();h.world.piles.reverse();const reordered=h.send();apply(reordered);expect(candidate.coverSourceMetrics379().fallbackReads).toBeGreaterThan(after.fallbackReads);
  // Endpoint from the wrong index predecessor must force exact complete cover.
  h.world.structures[0]!.x=28;const wrong=h.send();index.adopt(wrong);h.world.piles[0]!.owner={type:'ground',x:40,z:40};apply(h.send());
  const raw=structuredClone(h.world);raw.structures=raw.structures.map((s,i)=>i===0?{...s,x:35}:s);candidate.update(raw);literal.update(raw);expect(candidate.map.image.data).toStrictEqual(groundGrassPixels(raw));
  apply(h.send(true),true);
 }finally{candidate.dispose();literal.dispose();index.clear();}
});

test('room topology retains actual ordered barriers through unrelated structural births/removals, but reorders and reborn barrier precedence are observed',()=>{
 const h=fixture(),candidate=new SceneLightTopology(),literal=new RoomTopologyCache();
 const compare=(world:World)=>{const got=candidate.read(world),want=literal.read(world);expect(Array.from({length:world.width*world.height},(_,i)=>got.labelAt(i))).toEqual(Array.from({length:world.width*world.height},(_,i)=>want.labelAt(i)));return got;};
 const a=h.send(),initial=compare(a),first=candidate.metrics379();expect(initial.at(3,3)?.kind).toBe('doorway');
 h.world.structures.splice(0,3);h.world.structures.push(h.building('stool',35,35));h.send();h.world.structures[4]!.material='steel';
 const b=h.send();expect(compare(b)).toBe(initial);const next=candidate.metrics379();expect(next.journalReads-first.journalReads).toBe(1);expect(next.journalRows-first.journalRows).toBeLessThan(10);expect(next.fullRows).toBe(first.fullRows);
 // Same ID with the same barrier code is removed/reborn after the other
 // barrier, which changes its precedence at their overlapping cell.
 h.world.structures=h.world.structures.filter(s=>s.id!==h.wall.id);h.send();h.world.structures.push(h.wall);const c=h.send(),reborn=compare(c);expect(reborn.at(3,3)?.kind).toBe('solid');expect(reborn).not.toBe(initial);
 h.world.structures.reverse();const d=h.send(),reordered=compare(d);expect(reordered.at(3,3)?.kind).toBe('doorway');
 const raw=structuredClone(d);raw.structures.find(s=>s.id===h.door.id)!.x=4;expect(compare(raw).at(3,3)?.kind).toBe('solid');
 raw.structures.find(s=>s.id===h.wall.id)!.x=5;expect(compare(raw).at(3,3)?.kind).toBe('space');
});
