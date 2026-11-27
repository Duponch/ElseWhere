import {expect,test} from 'vitest';
import type {Structure} from '../src/sim/types';
import {StructurePresentationSignature} from '../src/render/presentation-signatures';
import {ConfirmedStructurePresentationSignature} from '../src/render/ConfirmedStructurePresentationSignature';

const flower=(id:number):Structure=>({id,kind:'flower-pot',x:id,z:4,material:'wood',orientation:0,footprint:'standard',flower:{allowSow:true,plant:{species:'daylily',sownAt:0,lastTick:0,growth:.2,ageCore:0,unlitCore:0,hitPoints:1}}});

test('confirmed signature accumulates flowers until ACK and preserves non-floral text collisions',()=>{
  const a=new StructurePresentationSignature(),b=new ConfirmedStructurePresentationSignature(),source=[flower(1),flower(2)];
  source[0]!.x=-0;
  const check=(indices?:readonly number[],axes='',packages='',reset=false)=>{const x=a.read(source,axes,packages,reset),y=b.readConfirmed(source,axes,packages,indices,reset);expect(y).toBe(x);expect(b.flowerChanges()).toStrictEqual(a.flowerChanges());return x;};
  check();a.ackFurnitureBuild();b.ackFurnitureBuild();
  (source[0]!.flower!.plant! as {growth:number}).growth=.3;check([0]);expect(b.flowerChanges()).toEqual([0]);
  (source[1]!.flower!.plant! as {hitPoints:number}).hitPoints=0;check([1]);expect(b.flowerChanges()).toEqual([0,1]);check([]); // failed/unperformed build: no ACK
  a.ackFurnitureBuild();b.ackFurnitureBuild();expect(b.flowerChanges()).toEqual([]);
  const before=check([]);source[0]!.x=0;expect(check([0])).toBe(before);expect(b.flowerChanges()).toBeUndefined();
  a.ackFurnitureBuild();b.ackFurnitureBuild();check([],'axes-only');expect(b.flowerChanges()).toBeUndefined();
  a.ackFurnitureBuild();b.ackFurnitureBuild();check([],'axes-only','package-only');expect(b.flowerChanges()).toBeUndefined();
  check([], '', '', true);
});

test('confirmed signature recovers after a throwing capture and keeps full RAW mutation semantics',()=>{
  const a=new StructurePresentationSignature(),b=new ConfirmedStructurePresentationSignature(),source=[flower(1),flower(2)];
  expect(b.readConfirmed(source,'','')).toBe(a.read(source,'',''));a.ackFurnitureBuild();b.ackFurnitureBuild();
  (source[0]!.flower!.plant! as {growth:number}).growth=.6;
  Object.defineProperty(source[1]!,'x',{configurable:true,get(){throw new Error('capture failed');}});
  expect(()=>a.read(source,'','')).toThrow('capture failed');expect(()=>b.readConfirmed(source,'','',[0,1])).toThrow('capture failed');
  expect(a.flowerChanges()).toBeUndefined();expect(b.flowerChanges()).toBeUndefined();
  Object.defineProperty(source[1]!,'x',{configurable:true,writable:true,value:21});
  expect(b.readConfirmed(source,'','',[])).toBe(a.read(source,'',''));expect(b.flowerChanges()).toStrictEqual(a.flowerChanges());
  source[0]!.material='steel';expect(b.read(source,'raw','')).toBe(a.read(source,'raw',''));
  source[0]!.material='wood';expect(b.read(source,'raw','')).toBe(a.read(source,'raw',''));
});

test('invalid indices, absent suffix, resize and reset fall back to the full signature',()=>{
  const a=new StructurePresentationSignature(),b=new ConfirmedStructurePresentationSignature(),source=[flower(1),flower(2)];
  expect(b.readConfirmed(source,'','')).toBe(a.read(source,'',''));
  for(const indices of [[1,0],[-1],[0,0],[999],undefined]){
    source[0]!.x++;source[1]!.z++;
    expect(b.readConfirmed(source,'','',indices)).toBe(a.read(source,'',''));expect(b.flowerChanges()).toStrictEqual(a.flowerChanges());
  }
  source.push(flower(3));expect(b.readConfirmed(source,'','',[])).toBe(a.read(source,'',''));
  source.reverse();expect(b.readConfirmed(source,'','',undefined,true)).toBe(a.read(source,'','',true));
});

test('bed prisoner role invalidates both literal and confirmed presentation while stable unrelated fields retain the key',()=>{
  const a=new StructurePresentationSignature(),b=new ConfirmedStructurePresentationSignature(),bed:Structure={id:1,kind:'bed',x:4,z:4,orientation:0,footprint:'standard',material:'wood'},source=[bed];
  const normal=a.read(source,'','');expect(b.readConfirmed(source,'','')).toBe(normal);a.ackFurnitureBuild();b.ackFurnitureBuild();
  bed.prisoner=true;const prison=a.read(source,'','');expect(prison).not.toBe(normal);expect(b.readConfirmed(source,'','',[0])).toBe(prison);expect(b.changedKinds()?.has('bed')).toBe(true);
  bed.medical=true;const medicalPrison=a.read(source,'','');expect(medicalPrison).not.toBe(prison);expect(b.readConfirmed(source,'','',[0])).toBe(medicalPrison);
  delete bed.prisoner;const medical=a.read(source,'','');expect(medical).not.toBe(medicalPrison);expect(b.read(source,'','')).toBe(medical);
});
