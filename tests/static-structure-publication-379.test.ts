import {afterEach,expect,test} from 'vitest';
import {TerrainJournalSnapshotEncoder} from '../src/bridge/terrain-journal-encoder';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {invalidateStaticStructurePublication379} from '../src/bridge/static-structure-publication-379';
import {withJournalTerrainReadScope} from '../src/sim/terrain-read-scope';
import {setResourceJournalVerification} from '../src/sim/resource-mutation-journal';
import {structureDamageChanged379} from '../src/sim/structure-family-379';
import {appendStructureEntries} from '../src/sim/structure-navigation';
import type {Structure,World} from '../src/sim/types';
import {fixture} from './resident-presentation-fixtures-v427';

class ProbeFullEncoder extends TerrainJournalSnapshotEncoder {
 protected override usesClosedResourceJournal=true;
 candidates:readonly number[]|undefined;
 protected override structureCandidates(world:World){return this.candidates=super.structureCandidates(world);}
}
function setup(){
 const world=fixture(),owner={},closed=new ProbeFullEncoder(owner),plain=new SnapshotEncoder({structureDelta:true,minimumStructures:0,plantLifeDelta:true,pileRotDelta:true});
 const roomRow=(kind:Structure['kind'],i:number):Structure=>({id:world.nextId++,kind,x:i%world.width,z:Math.floor(i/world.width)%world.height,footprint:'standard',orientation:0,material:kind==='power-conduit'?'steel':'wood',...kind==='power-conduit'?{power:{on:false,parentId:null}}:{}});
 world.structures=Array.from({length:1024},(_,i)=>roomRow((['wall','fence','power-conduit'] as const)[i%3]!,i));
 const dynamic=roomRow('stool',0);world.structures.push(dynamic);
 const send=()=>{const packet=structuredClone(closed.encode(world,0,6)),expected=structuredClone(plain.encode(world,0,6));expect(packet).toStrictEqual(expected);return packet;};
 return {world,owner,closed,send,roomRow,dynamic,write:<T>(run:()=>T)=>withJournalTerrainReadScope(owner,run)};
}
afterEach(()=>{setResourceJournalVerification(false);invalidateStaticStructurePublication379();});

test('Full codec walks only actual dynamic and damaged installed rows; order and repair are exact',()=>{
 const h=setup(),wall=h.world.structures[3]!,fence=h.world.structures[7]!;
 h.send();h.send();expect(h.closed.candidates).toEqual([1024]);
 h.write(()=>{wall.damage=13;structureDamageChanged379(h.world,wall);fence.damage=1;structureDamageChanged379(h.world,fence);h.dynamic.damage=2;structureDamageChanged379(h.world,h.dynamic);});
 const damaged=h.send();expect(h.closed.candidates).toEqual([3,7,1024]);expect(damaged.kind==='delta'&&damaged.structures?.upserted).toEqual([wall,fence,h.dynamic]);
 h.write(()=>{wall.damage=12;delete fence.damage;structureDamageChanged379(h.world,fence);});h.send();expect(h.closed.candidates).toEqual([3,7,1024]);
 h.write(()=>{delete wall.damage;structureDamageChanged379(h.world,wall);});h.send();expect(h.closed.candidates).toEqual([3,7,1024]);
 const add=h.roomRow('wall',9);h.write(()=>appendStructureEntries(h.world,add));const appended=h.send();expect(h.closed.candidates).toBeUndefined();expect(appended.kind==='delta'&&appended.structures?.upserted).toEqual([add]);
 h.send();expect(h.closed.candidates).toEqual([1024]);
 // Commands are explicitly unknown, even damage writes outside the owner.
 invalidateStaticStructurePublication379();add.damage=4;wall.material='steel';h.send();expect(h.closed.candidates).toBeUndefined();
 h.send();expect(h.closed.candidates).toEqual([1024,1025]);
 h.write(()=>{add.damage=2;structureDamageChanged379(h.world,add);});h.send();
});

test('independent exhaustive Full oracle catches unmarked static value writes',()=>{
 const h=setup();setResourceJournalVerification(true);h.closed.encode(h.world,0,6);h.closed.encode(h.world,0,6);expect(h.closed.candidates).toEqual([1024]);
 h.world.structures[0]!.material='steel';
 expect(()=>h.closed.encode(h.world,0,6)).toThrow('Unmarked static structure source write');
});
