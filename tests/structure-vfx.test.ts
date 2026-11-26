import { describe,expect,it } from 'vitest';
import type * as THREE from 'three/webgpu';
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { AnimationDetail } from '../src/render/AnimationDetail';
import { createWorld } from '../src/sim/engine.ts';
import type { CookingTask } from '../src/sim/cooking-types.ts';
import type { Structure } from '../src/sim/types.ts';
import { FireLayer } from '../src/render/FireLayer.ts';
import { GROUND_SMOKE_PUFFS, StructureVfxLayer } from '../src/render/StructureVfxLayer.ts';
import { ensureFireState } from '../src/sim/fire-rules.ts';

const structure=(kind:Structure['kind'],id:number,x=8,z=8):Structure=>({id,kind,x,z,orientation:0,footprint:'standard'});

describe('resident structure effects',()=>{
  it('reprojects fixed emitter rows when the view, far threshold or confirmed sources change',()=>{
    const world=createWorld(1255,32,32),front=structure('battery',951,8,8),rear=structure('battery',952,8,24);
    for(const device of [front,rear])device.battery={stored:BATTERY_QUARTER};
    world.structures=[front,rear];
    const detail=new AnimationDetail(),layer=new StructureVfxLayer(detail),camera=new PerspectiveCamera(50,1,.1,100);
    const slots=()=>Array.from({length:layer.glow.activeCount},(_,i)=>layer.glow.geometry.getAttribute('fxSlot').getX(i));
    const show=(tick:number)=>{detail.beginFrame(tick*10,camera,100,tick);layer.present(tick);};
    try{
      layer.adopt(world,true);
      camera.position.set(8,1,18);camera.lookAt(8,1,8);show(0);expect(slots()).toEqual([0]);
      camera.lookAt(8,1,24);show(1);expect(slots()).toEqual([1]);
      const version=layer.glow.instanceMatrix.version;show(2);expect(layer.glow.instanceMatrix.version).toBe(version);
      detail.setSettings({...detail.settings,farPixels:22});show(3);expect(slots()).toEqual([]);
      detail.setSettings({...detail.settings,enabled:false});show(4);expect(slots()).toEqual([0,1]);
      rear.battery!.stored=0;layer.adopt(world);show(5);expect(slots()).toEqual([0]);
    }finally{layer.dispose();}
  });
  it('keeps the ten-triangle flame cone closed with outward faces, coherent normals and front-face culling',()=>{
    const fire=new FireLayer();
    try{
      const geometry=fire.mesh.geometry,positions=geometry.getAttribute('position'),indices=geometry.getIndex()!;
      const a=new Vector3(),b=new Vector3(),c=new Vector3(),ab=new Vector3(),ac=new Vector3(),normal=new Vector3(),centre=new Vector3();
      const boundary=new Map<string,number>();
      expect(indices.count/3).toBe(10);
      expect(geometry.getAttribute('uv').count).toBe(positions.count);
      const vertexNormals=geometry.getAttribute('normal');
      const pointKey=(index:number)=>[positions.getX(index),positions.getY(index),positions.getZ(index)].map(v=>(Math.abs(v)<1e-5?0:v).toFixed(5)).join(':');
      for(let offset=0;offset<indices.count;offset+=3){
        const ids=[indices.getX(offset),indices.getX(offset+1),indices.getX(offset+2)];
        a.fromBufferAttribute(positions,ids[0]!);b.fromBufferAttribute(positions,ids[1]!);c.fromBufferAttribute(positions,ids[2]!);
        normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));
        centre.copy(a).add(b).add(c).multiplyScalar(1/3);
        expect(normal.lengthSq()).toBeGreaterThan(1e-10);
        if(Math.abs(a.y-b.y)<1e-6&&Math.abs(a.y-c.y)<1e-6)expect(normal.y).toBeLessThan(0); // bottom cap
        else expect(normal.x*centre.x+normal.z*centre.z).toBeGreaterThan(0);
        const averagedNormal=new Vector3();
        for(const id of ids)averagedNormal.add(new Vector3().fromBufferAttribute(vertexNormals,id));
        expect(normal.dot(averagedNormal)).toBeGreaterThan(0);
        for(let i=0;i<3;i++){
          // Cone UV seams duplicate logical vertices. Weld by position to
          // check the actual closed surface rather than buffer index pairs.
          const from=pointKey(ids[i]!),to=pointKey(ids[(i+1)%3]!),key=[from,to].sort().join('|');
          boundary.set(key,(boundary.get(key)??0)+(from<to?1:-1));
        }
      }
      expect([...boundary.values()].filter(value=>value!==0)).toHaveLength(0);
      expect((fire.mesh.material as THREE.Material).side).toBe(0);
    }finally{fire.dispose();}
  });

  it('shows hot steel and smoke only during confirmed powered production work',()=>{
    const world=createWorld(1251,20,20),table=structure('machining-table',900);
    world.structures=[table];table.power={on:true,parentId:null};
    const pawn=world.pawns[0]!,layer=new StructureVfxLayer();
    layer.adopt(world,true);
    expect(layer.glow.activeCount).toBe(1); // powered status lamp
    expect(layer.smoke.geometry.instanceCount).toBe(0);
    pawn.state='working';pawn.cooking={recipe:'make-revolver',stationId:table.id,phase:'work'} as CookingTask;
    layer.adopt(world);
    expect(layer.glow.activeCount).toBe(3);
    expect(layer.smoke.geometry.instanceCount).toBe(9);
    const sizes=layer.smoke.geometry.getAttribute('smokeShape') as THREE.InstancedBufferAttribute;
    expect(new Set(Array.from({length:9},(_,i)=>sizes.getX(i).toFixed(3))).size).toBeGreaterThan(2);
    expect(Array.from({length:9},(_,i)=>sizes.getW(i)).every(aspect=>aspect===1)).toBe(true);
    const version=(layer.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute).version;
    layer.present(17.5);layer.adopt(world);
    expect((layer.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute).version).toBe(version);
    pawn.cooking.phase='output';layer.adopt(world);
    expect(layer.glow.activeCount).toBe(1);
    expect(layer.smoke.geometry.instanceCount).toBe(0);
    table.power.on=false;layer.adopt(world);
    expect(layer.glow.activeCount).toBe(0);
    expect(layer.smoke.visible).toBe(false);
    layer.dispose();
  });

  it('tracks fabrication, stove steam and battery charge without inventing power',()=>{
    const world=createWorld(1252,20,20),bench=structure('fabrication-bench',901),stove=structure('electric-stove',902,12,9),battery=structure('battery',903,15,9);
    bench.power={on:true,parentId:null};stove.power={on:false,parentId:null};battery.battery={stored:BATTERY_QUARTER};
    world.structures=[bench,stove,battery];
    const pawn=world.pawns[0]!,layer=new StructureVfxLayer();
    pawn.state='working';pawn.cooking={recipe:'make-component',stationId:bench.id,phase:'work'} as CookingTask;
    layer.adopt(world,true);
    expect(layer.glow.activeCount).toBe(4); // bench lamp, two hot pieces, one charge bar
    expect(layer.smoke.geometry.instanceCount).toBe(9);
    pawn.cooking={stationId:stove.id,phase:'work'} as CookingTask;
    layer.adopt(world);
    expect(layer.smoke.geometry.instanceCount).toBe(0); // electric stove is unpowered
    stove.power.on=true;layer.adopt(world);
    expect(layer.smoke.geometry.instanceCount).toBe(10);
    battery.battery!.stored=0;layer.adopt(world);
    expect(layer.glow.activeCount).toBe(3); // stove status, stove heat, bench idle status
    layer.setDistant(true);expect(layer.group.visible).toBe(false);
    layer.setDistant(false);expect(layer.group.visible).toBe(true);
    layer.dispose();
  });

  it('draws lit campfire flames in the existing fire batch, without static boxes',()=>{
    const world=createWorld(1253,20,20),camp=structure('campfire',904);
    camp.fuel={ticks:0,burned:0,autoRefuel:true};world.structures=[camp];
    const fire=new FireLayer();fire.adopt(world,true);
    const a=fire.mesh.geometry.getAttribute('firePosition');
    expect(a.getW(0)).toBe(0);
    camp.fuel.ticks=100;fire.adopt(world);
    expect((fire.mesh.geometry as import('three/webgpu').InstancedBufferGeometry).instanceCount).toBe(3);
    expect(a.getW(0)).toBeGreaterThan(0);
    camp.fuel.ticks=0;fire.adopt(world);
    expect(a.getW(0)).toBe(0);
    fire.dispose();
  });

  it('starts ground smoke near the flame tip and scales its climb with fire size',()=>{
    const world=createWorld(1255,24,24),state=ensureFireState(world);
    for(const [id,x,size] of [[970,8,.1],[971,12,1.75]])
      state.items.push({id,x,z:10,size,bornCore:0,nextPulseCore:15,complexCore:150,spreadCore:150});
    const fire=new FireLayer(),vfx=new StructureVfxLayer();
    const target=new Vector3(10,0,10),camera=new OrthographicCamera(-18,18,18,-18,.1,150);
    camera.position.set(28,35,28);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    try {
      fire.adopt(world,true);vfx.adopt(world,true);vfx.setView(camera,target);
      const flame=fire.mesh.geometry.getAttribute('firePosition') as THREE.InstancedBufferAttribute;
      const vertices=fire.mesh.geometry.getAttribute('position') as THREE.BufferAttribute;
      const flameHeight=Math.max(...Array.from({length:vertices.count},(_,i)=>vertices.getY(i)))+.75;
      const position=vfx.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute;
      const shape=vfx.smoke.geometry.getAttribute('smokeShape') as THREE.InstancedBufferAttribute;
      expect(GROUND_SMOKE_PUFFS).toBe(7);
      expect(vfx.smoke.geometry.instanceCount).toBe(14);
      expect(flame.getW(1)).toBeGreaterThan(flame.getW(0));
      for(const index of [0,1]){
        const visibleTip=flameHeight*flame.getW(index);
        expect(position.getY(index*GROUND_SMOKE_PUFFS)).toBeGreaterThan(visibleTip*.7);
        expect(position.getY(index*GROUND_SMOKE_PUFFS)).toBeLessThan(visibleTip*1.05);
      }
      expect(position.getY(GROUND_SMOKE_PUFFS)).toBeGreaterThan(position.getY(0));
      expect(shape.getZ(GROUND_SMOKE_PUFFS)).toBeGreaterThan(shape.getZ(0));
    } finally {fire.dispose();vfx.dispose();}
  });

  it('caps denser ground smoke to 128 camera-local fires and refreshes it after panning',()=>{
    const world=createWorld(1254,100,100),state=ensureFireState(world),camp=structure('campfire',950,22,22);
    camp.fuel={ticks:100,burned:0,autoRefuel:true};world.structures=[camp];
    let id=1000;
    for(const base of [15,75])for(let z=0;z<10;z++)for(let x=0;x<16;x++)
      state.items.push({id:id++,x:base+x,z:base+z,size:1,bornCore:0,nextPulseCore:15,complexCore:150,spreadCore:150});
    const camera=new OrthographicCamera(-18,18,18,-18,.1,150);
    const target=new Vector3(22,0,22);
    camera.position.set(52,50,52);camera.lookAt(target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    const layer=new StructureVfxLayer();layer.adopt(world,true);layer.setView(camera,target);
    let position=layer.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute;
    expect(layer.smoke.geometry.instanceCount).toBe(9+128*GROUND_SMOKE_PUFFS); // campfire + bounded ground fire
    for(let i=9;i<layer.smoke.geometry.instanceCount;i++)expect(position.getX(i)).toBeLessThan(32);
    const version=position.version;layer.setView(camera,target);expect(position.version).toBe(version);
    target.set(82,0,82);camera.position.set(112,50,112);camera.lookAt(target);camera.updateMatrixWorld();
    layer.setView(camera,target);position=layer.smoke.geometry.getAttribute('smokePosition') as THREE.InstancedBufferAttribute;
    expect(layer.smoke.geometry.instanceCount).toBe(9+128*GROUND_SMOKE_PUFFS);
    for(let i=9;i<layer.smoke.geometry.instanceCount;i++)expect(position.getX(i)).toBeGreaterThan(73);
    layer.dispose();
  });
});

const BATTERY_QUARTER=600*120_000/4;
