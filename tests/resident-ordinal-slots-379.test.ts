import {expect,test} from 'vitest';
import {nextResidentMembershipValues379,nextResidentOrdinalSlots379,residentOrdinalSlots379} from '../src/bridge/resident-ordinal-slots-379';
import {residentOwnerArray379,isOrdinaryResidentOwnerArray379} from '../src/bridge/resident-owner-records-379';

test('ordinal sections keep exact remove/append ranks through bounded rebases without mutating old World lists',()=>{
 let current=residentOwnerArray379<{id:number;v:number}>();for(let i=0;i<21000;i++)current.push({id:i+1,v:0});Object.freeze(current);
 let slots=residentOrdinalSlots379(current),nextId=current.length+1;
 const history:{values:typeof current;slots:ReadonlyMap<number,number>}[]=[];
 for(let step=0;step<14;step++){
  history.push({values:current,slots});
  const indices=[3+step*7,100+step*9,current.length-1],removed=indices.map(index=>({id:current[index]!.id,beforeOrdinal:index})),gone=new Set(removed.map(row=>row.id));
  const changed={...current[step+1]!,v:step+1},added=[{id:nextId++,v:3},{id:nextId++,v:4}],writes=new Map([[changed.id,changed],...added.map(row=>[row.id,row] as const)]);
  const expected=current.filter(row=>!gone.has(row.id)).map(row=>writes.get(row.id)??row).concat(added);
  const old=current;current=nextResidentMembershipValues379(current,slots,removed,writes,added);
  expect(isOrdinaryResidentOwnerArray379(current)).toBe(true);expect(current).toEqual(expected);expect(old[step+1]!.v).toBe(0);
  Object.freeze(current);slots=nextResidentOrdinalSlots379(slots,removed,added,current);
  expect(slots.size).toBe(current.length);for(let i=0;i<current.length;i+=101)expect(slots.get(current[i]!.id)).toBe(i);
  for(const row of removed)expect(slots.has(row.id)).toBe(false);for(const row of added)expect(slots.has(row.id)).toBe(true);
 }
 for(const {values,slots:oldSlots}of history){expect(oldSlots.size).toBe(values.length);for(let i=0;i<values.length;i+=89)expect(oldSlots.get(values[i]!.id)).toBe(i);}
 expect([...slots]).toEqual(current.map((row,i)=>[row.id,i]));
});

test('an implicit first membership edge requires no read of surviving rows to build its ordinal directory',()=>{
 const old=Array.from({length:18000},(_,i)=>({id:i+1})),slots=residentOrdinalSlots379(old),removed=[{id:3,beforeOrdinal:2},{id:17,beforeOrdinal:16}],appended=[{id:19000}];
 const rows=new Proxy(old,{get(){throw Error('complete row discovery');}});
 const next=nextResidentOrdinalSlots379(slots,removed,appended,rows);
 expect(next.get(3)).toBeUndefined();expect(next.get(16)).toBe(14);expect(next.get(18)).toBe(15);expect(next.get(19000)).toBe(17998);
 expect(slots.get(3)).toBe(2);expect(slots.get(18)).toBe(17);
});
