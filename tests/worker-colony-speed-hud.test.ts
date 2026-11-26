import {afterEach,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {WorkerSpeedHud} from '../src/render/worker-scene/speed-hud';
import {PresentedSpeedHits} from '../src/render/worker-scene/speed-hud-hit';
import type {SpeedHudHits} from '../src/render/worker-scene/protocol';
import type {CardboardPiece} from '../src/ui3d/prototype-art';

afterEach(()=>vi.unstubAllGlobals());

it('uses the submitted cut meshes for input, publishes geometry once and stops posting after settling',()=>{
  vi.stubGlobal('document',undefined);
  const context=new Proxy<Record<string,unknown>>({},{get:(owner,key)=>owner[String(key)]??(()=>{})});
  vi.stubGlobal('OffscreenCanvas',class {width=1;height=1;getContext(){return context;}});
  const hits=new PresentedSpeedHits(),packets:SpeedHudHits[]=[];
  const hud=new WorkerSpeedHud(1,false,packet=>{hits.update(packet);packets.push(packet);});
  const rig=hud as unknown as {buttons:CardboardPiece[];camera:THREE.PerspectiveCamera};
  const ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),size={width:768,height:512,pixelRatio:1};
  const renderer={initialized:false} as THREE.WebGPURenderer;
  let now=0;
  function draw(speed:number){hud.draw(renderer,size,speed,now+=40);}
  function expectRayAgreement(){
    const meshes=rig.buttons.map(b=>b.userData.mesh),seen=new Set<number|null>();
    for(let y=384;y<=423;y+=3.125)for(let x=613;x<=766;x+=3.125){
      pointer.set(x/size.width*2-1,1-y/size.height*2);ray.setFromCamera(pointer,rig.camera);
      const hit=ray.intersectObjects(meshes,false)[0]?.object.userData.widgetGroup as CardboardPiece|undefined;
      const expected=hit?Number(String(hit.userData.nativeId).slice(10)):null;
      expect(hits.hit(x,y,size.width,size.height)).toBe(expected);seen.add(expected);
    }
    expect(seen).toEqual(new Set([null,0,1,3,6]));
    expect(hits.hit(700,400,769,512)).toBeNull();
  }
  try{
    draw(0);expectRayAgreement();expect(packets[0]!.buttons.every(b=>!!b.vertices?.length)).toBe(true);
    hud.pointer(3,true);draw(3);expectRayAgreement();
    hud.pointer(null,false);
    for(let i=0;i<40;i++)draw(6);
    expectRayAgreement();const count=packets.length;
    for(let i=0;i<20;i++)draw(6);
    expect(packets).toHaveLength(count);
    expect(packets.slice(1).every(p=>p.buttons.every(b=>b.vertices===undefined))).toBe(true);
  }finally{hud.dispose();}
});
