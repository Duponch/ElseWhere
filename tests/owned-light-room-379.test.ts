import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine.ts';
import {RoomTopologyCache} from '../src/sim/room-topology.ts';
import {lightSources} from '../src/sim/light-sources.ts';
import {appendStructureEntries,structureMembershipToken} from '../src/sim/structure-navigation.ts';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope.ts';
import {invalidateTerrainJournal,markTerrainCellChanged,setTerrainWriteCacheVerification,verifyTerrainWriteCaches} from '../src/sim/terrain-mutation-journal.ts';
import type {World,Structure} from '../src/sim/types.ts';

const fixture=():World=>{
 const w=createWorld(197,32,32);w.tiles=w.tiles.map(()=>({terrain:'soil-natural'}));w.structures=[];w.resources=[];w.jobs=[];w.piles=[];w.packed=[];
 return w;
};
const append=(w:World,kind:Structure['kind'],x:number,z:number)=>{
 const s={id:w.nextId++,kind,x,z,orientation:0,footprint:'standard'} as Structure;
 appendStructureEntries(w,s);return s;
};

test('closed room reads consume only marked tile changes and preserve the complete enclosure after appends and invalidation',()=>{
 const w=fixture(),owner={},cache=new RoomTopologyCache();let reads=0;
 w.tiles=new Proxy(w.tiles,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});
 const read=()=>withJournalTerrainReadScope(owner,()=>{structureMembershipToken(w);return cache.read(w);});
 const cold=()=>new RoomTopologyCache().read(w);
 const compare=()=>{const a=read(),b=cold();expect([...a.allSpaces()]).toEqual([...b.allSpaces()]);
  for(let y=0;y<w.height;y++)for(let x=0;x<w.width;x++)expect(a.at(x,y)).toEqual(b.at(x,y));return a;};
 const initial=read();reads=0;
 w.tiles[45]={terrain:'soil-natural',snowDepth:.3};markTerrainCellChanged(w.tiles,45);
 expect(read()).toBe(initial);if(!verifyTerrainWriteCaches)expect(reads).toBe(1);
 w.tiles[95]={terrain:'rock'};markTerrainCellChanged(w.tiles,95);
 expect(compare()).not.toBe(initial);
 withJournalTerrainReadScope(owner,()=>{append(w,'stool',18,18);append(w,'door',19,19);append(w,'wall',20,20);});compare();
 const checking=verifyTerrainWriteCaches;setTerrainWriteCacheVerification(true);
 try{
  w.tiles[97]={terrain:'rock'};
  expect(()=>read()).toThrow('Unmarked terrain write');
  invalidateTerrainJournal(w.tiles);expect(compare().at(1,3)?.kind).toBe('solid');
 }finally{setTerrainWriteCacheVerification(checking);}
});

test('closed light member identities survive unrelated append while live switches and added glowers stay exact',()=>{
 const w=fixture(),owner={};const get=()=>withJournalTerrainReadScope(owner,()=>{structureMembershipToken(w);return lightSources(w);});
 const lamp=append(w,'standing-lamp',3,3);lamp.power={on:true,parentId:null};
 const first=get();
 withJournalTerrainReadScope(owner,()=>append(w,'stool',4,4));
 expect(get()).toBe(first);
 lamp.power.on=false;expect(get()).toHaveLength(0);lamp.power.on=true;expect(get()).toEqual(first);
 withJournalTerrainReadScope(owner,()=>{const extra=append(w,'standing-lamp',7,7);extra.power={on:true,parentId:null};});
 expect(get().map(row=>row.cell)).toEqual([3*w.width+3,7*w.width+7]);
});
