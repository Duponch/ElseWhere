import {expect,test} from 'vitest';
import {NativeHoverPreview} from '../src/ui3d/native-hover-preview';
test('hover and keyboard focus share one preview lifetime and release it before switching, removing or closing',()=>{
 const events:string[]=[],a=(on:boolean)=>events.push('a:'+on),b=(on:boolean)=>events.push('b:'+on);
 const owner=new NativeHoverPreview(message=>{throw Error(message);});
 owner.set(a);owner.set(a);owner.set(b);owner.set(undefined);owner.set(undefined);
 expect(events).toEqual(['a:true','a:false','b:true','b:false']);
});
test('a failed old preview cannot prevent a new one or its later cleanup',()=>{
 const errors:string[]=[],events:boolean[]=[];
 const owner=new NativeHoverPreview(message=>errors.push(message));
 const broken=(active:boolean)=>{if(!active)throw Error('preview gone');};
 owner.set(broken);owner.set(active=>events.push(active));owner.set(undefined);
 expect(events).toEqual([true,false]);expect(errors).toEqual(['preview gone']);
});
