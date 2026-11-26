import {expect,test} from 'vitest';
import {isOrdinaryResidentOwnerRecord379,observeNativeResidentOwners379,residentOwnerRecord379} from '../src/bridge/resident-owner-records-379';

test('only actually constructed own-data records get local representation facts, never their arbitrary children',()=>{
 const child=new Proxy({id:2},{}),raw={id:1,child},replacement=residentOwnerRecord379(raw,{id:3});
 expect(isOrdinaryResidentOwnerRecord379(raw)).toBe(false);expect(isOrdinaryResidentOwnerRecord379(child)).toBe(false);
 expect(isOrdinaryResidentOwnerRecord379(replacement)).toBe(true);expect(replacement.child).toBe(child);expect(Object.keys(replacement)).toEqual(['id','child']);
 expect(isOrdinaryResidentOwnerRecord379(new Proxy(replacement,{}))).toBe(false);
});

test('fabricated message, ordinary data, and frozen envelope never grant the native representation fact',()=>{
 const source=new EventTarget(),row={id:1},raw=Object.freeze({type:'resident-publication',publication:{type:'snapshot',world:{resources:[row]}}});
 const unobserve=observeNativeResidentOwners379(source as unknown as Worker);
 try{source.dispatchEvent(new MessageEvent('message',{data:raw}));expect(isOrdinaryResidentOwnerRecord379(raw)).toBe(false);expect(isOrdinaryResidentOwnerRecord379(row)).toBe(false);}
 finally{unobserve();}
});
