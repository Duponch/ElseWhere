import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {expect,test} from 'vitest';
import {beautyMapAt,worldBeautyInput} from '../src/sim/beauty-need.ts';
import {BeautyMapCache,markDefaultPerceptionCells,type BeautyCell} from '../src/sim/room-beauty.ts';
import {deserializeWorld} from '../src/sim/serialization.ts';
import {stepWorld} from '../src/sim/index.ts';
import {clonePlainData} from '../src/sim/plain-clone.ts';
import type {World} from '../src/sim/types.ts';

const worlds=new Map<string,World>();
/** Each reference save is loaded and stepped once for the whole file. */
function load(path:string):World{
  let w=worlds.get(path);if(w)return w;
  const text=readFileSync(path,'utf8'),raw=JSON.parse(text);
  w=deserializeWorld(raw.format==='lisiere-save'?gunzipSync(Buffer.from(raw.payload,'base64')).toString('utf8'):text);stepWorld(w,30);
  worlds.set(path,w);return w;
}

/** The beauty need pulse builds the map only at the cells its perceivers read.
 * Every such cell must hold exactly the value of the full map. Perceivers are
 * placed on every contributor (structure, filth, pile, packed furniture) so
 * that each contribution kind is read at least once. */
test.each(['public/test-saves/v432/les-forges-crash-test.json','public/test-saves/v419/les-eclaircies.json'])('partial beauty map equals the full map at perceived cells: %s',path=>{
  const w=load(path);
  const cells:BeautyCell[]=[...w.pawns,...w.structures,...(w.filth?.items??[]),...w.piles.flatMap(p=>p.owner.type==='ground'?[p.owner]:[]),...w.packed.flatMap(p=>p.owner.type==='ground'?[p.owner]:[])];
  const full=new BeautyMapCache().read(worldBeautyInput(w)),partial=beautyMapAt(w,cells),needed=new Uint8Array(w.width*w.height);
  for(const c of cells)markDefaultPerceptionCells(w.width,w.height,c,needed);
  let checked=0;
  for(let i=0;i<needed.length;i++)if(needed[i]){
    for(const outdoors of [false,true]){
      expect(partial.atIndex(i,outdoors),`cell ${i}`).toBe(full.atIndex(i,outdoors));
      expect(partial.thingsAtIndex(i,outdoors),`cell ${i}`).toBe(full.thingsAtIndex(i,outdoors));
    }
    checked++;
  }
  expect(checked).toBeGreaterThan(1000);
},600_000);

/** World pawn drafts use clonePlainData instead of structuredClone. */
test('plain-data clone matches structuredClone on simulation records',()=>{
  const w=load('public/test-saves/v432/les-forges-crash-test.json');
  for(const value of [w.pawns,w.piles,w.structures,w.wildlife,w.worldFactions,{a:-0,b:undefined,c:[1,[2,{d:null}]]}]){
    const shared={x:1},cyclic:Record<string,unknown>={shared,again:shared};cyclic.self=cyclic;
    expect(clonePlainData(value)).toStrictEqual(structuredClone(value));
    const copy=clonePlainData(cyclic) as typeof cyclic;
    expect(copy.self).toBe(copy);expect(copy.shared).toBe(copy.again);expect(copy.shared).not.toBe(shared);
  }
},600_000);
