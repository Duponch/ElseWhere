import {expect,test} from 'vitest';
import {BoxGeometry, Color, InstancedMesh, MeshBasicNodeMaterial} from 'three/webgpu';
import {float} from 'three/tsl';
import {CropInstanceViews} from '../src/render/crop-instance-views';

test('crop draws see unversioned node replacements, additions and deletions in their original read order',()=>{
  const source=new MeshBasicNodeMaterial(),holder=new InstancedMesh(new BoxGeometry(),source,1),views=new CropInstanceViews();
  holder.setColorAt(0,new Color());
  const view=views.attach(holder),variant=view.material as MeshBasicNodeMaterial;
  const seen:string[]=[];
  try{
    for(const key of ['zTestNode','aTestNode'])Object.defineProperty(source,key,{configurable:true,enumerable:true,get(){seen.push(key);return undefined;}});
    views.select(view,holder);
    expect(seen.slice(0,2)).toEqual(['aTestNode','zTestNode']);
    seen.length=0;const v=variant.version;
    views.select(view,holder);
    expect(seen).toEqual(['aTestNode','zTestNode']);expect(variant.version).toBe(v);
    delete (source as unknown as Record<string,unknown>).zTestNode;
    views.select(view,holder);expect(variant.version).toBeGreaterThan(v);
    const replacement=float(0.25);source.opacityNode=replacement;
    views.select(view,holder);expect(variant.opacityNode).toBe(replacement);
    const updated=variant.version;
    views.select(view,holder);expect(variant.version).toBe(updated);
  }finally{views.dispose();holder.geometry.dispose();source.dispose();holder.dispose();}
});
