import {expect,test} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/engine';
import type {World} from '../src/sim/types';
import {doorOrientations,isRoomDoor,newDoorState} from '../src/sim/door-rules';
import {penBoundaryAxes} from '../src/render/pen-parts';
import {SnapshotEncoder,SnapshotDecoder} from '../src/bridge/snapshots';
import {SceneStructurePreparation} from '../src/render/SceneStructurePreparation';

function publisher(){
  // Keep the generated calendars valid; this fixture does not advance time.
  const world=createWorld(29902,24,24);world.tiles=world.tiles.map(()=>({terrain:'grass'}));world.resources=[];world.structures=[];world.jobs=[];
  world.structures.push({id:world.nextId++,kind:'door',x:8,z:8,material:'wood',orientation:0,footprint:'standard',door:newDoorState(world.tick)});
  world.structures.push({id:world.nextId++,kind:'bed',x:12,z:12,material:'wood',orientation:0,footprint:'standard'});
  const encoder=new SnapshotEncoder({structureDelta:true,minimumStructures:0}),decoder=new SnapshotDecoder(),history:Array<{world:World;before:World}>=[];
  const send=(checkpoint=false)=>{const result=decoder.adopt(structuredClone(encoder.encode(world,0,6,checkpoint)));expect(result.status).toBe('applied');if(result.status!=='applied')throw Error(JSON.stringify(result));history.push({world:result.world,before:structuredClone(result.world)});return result.world;};
  return {world,send,verify:()=>{for(const old of history)expect(old.world).toStrictEqual(old.before);}};
}
const expectedDoors=(world:World)=>world.structures.filter(s=>isRoomDoor(s.kind)||s.kind==='fence-gate');
function check(prepared:ReturnType<SceneStructurePreparation['read']>,world:World){
  expect(prepared.world).toBe(world);expect(prepared.doors).toStrictEqual(expectedDoors(world));
  expect([...prepared.axes]).toStrictEqual([...doorOrientations(world)]);expect([...prepared.gateAxes]).toStrictEqual([...penBoundaryAxes(world)]);
  expect(prepared.axesKey).toBe([...doorOrientations(world)].join(':'));
}

test('projection composes A to C after D decoding and refreshes axes for jobs/terrain without door patches',()=>{
  const {world,send,verify}=publisher(),projection=new SceneStructurePreparation(),skipped=new SceneStructurePreparation();
  const a=send();check(projection.read(a),a);skipped.read(a);
  expect(applyCommand(world,{type:'designate',kind:'wall',material:'wood',x:8,z:7}).ok).toBe(true);
  const b=send(),pb=projection.read(b);check(pb,b);expect(pb.indices).toEqual([]);expect(pb.axes.get(8+8*world.width)).toBe(1);
  world.tiles[8*world.width+9]={terrain:'water'};const c=send();
  world.structures[1]!.material='steel';const d=send();
  const ac=skipped.read(c);check(ac,c);expect(ac.indices).toEqual([]);
  const pc=projection.read(c);check(pc,c);expect(pc.indices).toEqual([]);expect(pc.axes.get(8+8*world.width)).toBe(0);
  const pd=projection.read(d);check(pd,d);expect(pd.indices).toEqual([1]);
  expect([...pb.axes]).toStrictEqual([...doorOrientations(b)]);verify();
});

test('projection forces full for order/checkpoint/same World and retains old arrays after new membership',()=>{
  const {world,send,verify}=publisher(),projection=new SceneStructurePreparation(),a=send(),pa=projection.read(a);
  world.structures.reverse();const b=send(),pb=projection.read(b);check(pb,b);expect(pb.indices).toBeUndefined();
  world.structures.push({id:world.nextId++,kind:'door',x:17,z:8,material:'steel',orientation:0,footprint:'standard',door:newDoorState(world.tick)});
  const c=send(),pc=projection.read(c);check(pc,c);expect(pc.indices).toBeUndefined();expect(pa.doors).toHaveLength(1);expect(pc.doors).toHaveLength(2);
  const d=send(true),pd=projection.read(d);check(pd,d);expect(pd.indices).toBeUndefined();
  expect(projection.read(d).indices).toBeUndefined();const clone=structuredClone(d);check(projection.read(clone),clone);expect(projection.read(clone).indices).toBeUndefined();
  projection.clear();expect(projection.read(d).indices).toBeUndefined();verify();
});

test('unrelated building and tile writers retain both exact axis maps; only actual door scores change them',()=>{
  const {world,send}=publisher(),projection=new SceneStructurePreparation(),a=send(),first=projection.read(a);
  world.structures[1]!.x=13;world.tiles[3*world.width+3]={terrain:'water'};world.tiles[7*world.width+8]!.floor='wood-planks';
  const b=send(),second=projection.read(b);check(second,b);expect(second.axes).toBe(first.axes);expect(second.gateAxes).toBe(first.gateAxes);
  expect(applyCommand(world,{type:'designate',kind:'wall',material:'wood',x:8,z:7}).ok).toBe(true);
  const c=send(),third=projection.read(c);check(third,c);expect(third.axes.get(8+8*world.width)).toBe(1);expect(third.gateAxes).toBe(first.gateAxes);
  world.tiles[8*world.width+9]={terrain:'rock'};const d=send(),fourth=projection.read(d);check(fourth,d);expect(fourth.axes.get(8+8*world.width)).toBe(0);
  world.structures.push({id:world.nextId++,kind:'fence',x:8,z:9,material:'wood',orientation:0,footprint:'standard'});
  const e=send(),fifth=projection.read(e);check(fifth,e);expect(fifth.axes).toBe(fourth.axes);expect(fifth.gateAxes).not.toBe(fourth.gateAxes);
  const raw=structuredClone(e);raw.tiles[8*raw.width+9]={terrain:'grass'};const publicRead=projection.read(raw);check(publicRead,raw);expect(publicRead.axes.get(8+8*raw.width)).toBe(1);
});
