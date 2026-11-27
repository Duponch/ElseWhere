import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {mechanicalPaint,mechanicalPaintAspect,mechanicalFacePaintUv,mechanicalPaintUv,mechanicalSurfacePixels} from '../src/render/mechanical-surface-art';
import {SCYTHER_VISUAL_PARTS,scytherGeometry} from '../src/render/scyther-geometry';
import {LANCER_VISUAL_PARTS,PIKEMAN_VISUAL_PARTS,rangedMechGeometry} from '../src/render/ranged-mech-geometry';
import {mechanoidPartIndex} from '../src/sim/mechanoid-presentation';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {MechanoidLayer} from '../src/render/MechanoidLayer';
import {StartingArrivalLayer} from '../src/render/StartingArrivalLayer';
import {RaidPodLayer} from '../src/render/RaidPodLayer';
import {OrbitalDeliveryLayer} from '../src/render/OrbitalDeliveryLayer';
import {PodRescueLayer} from '../src/render/PodRescueLayer';
import {scytherCamp} from './scenarios/scyther-v213';

test('every mechanical face has equal physical pigment scale on both authored UV axes, including rolled blades',()=>{
  for(const[kind,parts]of [['scyther',SCYTHER_VISUAL_PARTS],['lancer',LANCER_VISUAL_PARTS],['pikeman',PIKEMAN_VISUAL_PARTS]]as const){
    const index=(name:string)=>mechanoidPartIndex(kind,name),g=kind==='scyther'?scytherGeometry(8,index):rangedMechGeometry(kind,8,index);
    try{
      const uv=g.getAttribute('uv');
      parts.forEach((part,partIndex)=>{
        for(let face=0;face<6;face++){
          const start=partIndex*36+face*6,us:number[]=[],vs:number[]=[];
          for(let v=start;v<start+6;v++){us.push(uv.getX(v));vs.push(uv.getY(v));}
          const chart=(Math.floor(us[0]!*4)+4*Math.floor(vs[0]!*4))as typeof mechanicalPaint[keyof typeof mechanicalPaint];
          const[sx,sy,sz]=part.size,width=face<2?sz:sx,height=face===2||face===3?sz:sy;
          const uScale=(Math.max(...us)-Math.min(...us))*mechanicalPaintAspect(chart)/width,vScale=(Math.max(...vs)-Math.min(...vs))/height;
          expect(uScale,`${kind}/${partIndex}/${face}`).toBeCloseTo(vScale,5);
          expect(g.getAttribute('position').count).toBe(parts.length*36);
        }
      });
    }finally{g.dispose();}
  }
});

test('whole authored capsule lids retain their edges and emblems at their real rectangle dimensions',()=>{
  for(const[chart,width,height]of [[mechanicalPaint.landing,.56,1.82],[mechanicalPaint.cargo,.54,1.82],[mechanicalPaint.rescue,.54,1.90],[mechanicalPaint.weathered,.54,1.90]]as const){
    for(const[u,v]of [[0,0],[1,1],[.5,.5]]as const)expect(mechanicalFacePaintUv(chart,u,v,width,height)).toEqual(mechanicalPaintUv(chart,u,v));
  }
  expect(mechanicalPaintAspect(mechanicalPaint.limb)).toBe(.3);
  expect(mechanicalPaintAspect(mechanicalPaint.edge)).toBe(.2);
  expect(mechanicalSurfacePixels(false)).toHaveLength(128*128*4);
  expect(mechanicalSurfacePixels(false)).toBe(mechanicalSurfacePixels(false));
  expect(mechanicalSurfacePixels(false)).not.toEqual(mechanicalSurfacePixels(true));
});

function usesMap(node:THREE.Node|null,map:THREE.Texture):boolean {
  let found=false;node?.traverse(value=>{if(Reflect.get(value,'isTextureNode')&&Reflect.get(value,'value')===map)found=true;});return found;
}
function context():GraphicsStyleContext{return new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:0});}

test('personalized mech paint is removed from the material graph, with global textures still independent and resident buffers unchanged',()=>{
  const style=context(),layer=withGraphicsStyle(style,()=>new MechanoidLayer()),{world}=scytherCamp();
  try{
    layer.update(world,undefined);const mesh=layer.group.children[0]as THREE.Mesh,material=mesh.material as THREE.MeshStandardNodeMaterial,map=layer.surfaceTextures()[0]!,geometry=mesh.geometry,attributes={...geometry.attributes};
    const painted=material.colorNode;
    expect(usesMap(painted,map)).toBe(true);
    style.update({...style.preferences,personalizedTextures:false});
    const natural=material.colorNode;expect(natural).not.toBe(painted);expect(usesMap(natural,map)).toBe(false);
    layer.setTexturesEnabled(false);const plain=material.colorNode;expect(plain).not.toBe(natural);expect(usesMap(plain,map)).toBe(false);
    layer.setTexturesEnabled(true);expect(material.colorNode).toBe(natural);
    style.update({...style.preferences,personalizedTextures:true});expect(material.colorNode).toBe(painted);
    expect(mesh.geometry).toBe(geometry);for(const[name,attribute]of Object.entries(attributes))expect(geometry.getAttribute(name)).toBe(attribute);
    layer.dispose();expect(()=>style.update({...style.preferences,personalizedTextures:false})).not.toThrow();
  }finally{layer.dispose();style.dispose();}
});

test('four capsule owners swap only resident pixels, while retaining their two surfaces, static attributes and one batch',()=>{
  const style=context(),layers=withGraphicsStyle(style,()=>[new StartingArrivalLayer(),new RaidPodLayer(),new OrbitalDeliveryLayer(),new PodRescueLayer()]);
  try{
    const saved=layers.map(layer=>({layer,mesh:layer.mesh,geometry:layer.mesh.geometry,matrix:layer.mesh.instanceMatrix,version:layer.mesh.instanceMatrix.version,material:layer.mesh.material,map:layer.surfaceTexture as THREE.DataTexture}));
    style.update({...style.preferences,personalizedTextures:false});
    for(const row of saved){expect(row.map.image.data).toBe(mechanicalSurfacePixels(false));expect(row.mesh.material).toBe(row.material);row.layer.setTexturesEnabled(false);expect(row.mesh.material).not.toBe(row.material);row.layer.setTexturesEnabled(true);expect(row.mesh.material).toBe(row.material);}
    style.update({...style.preferences,personalizedTextures:true});
    for(const row of saved){expect(row.map.image.data).toBe(mechanicalSurfacePixels(true));expect(row.mesh.geometry).toBe(row.geometry);expect(row.mesh.instanceMatrix).toBe(row.matrix);expect(row.matrix.version).toBe(row.version);expect(row.layer.group.children).toEqual([row.mesh]);}
    for(const layer of layers)layer.dispose();expect(()=>style.update({...style.preferences,personalizedTextures:false})).not.toThrow();
  }finally{for(const layer of layers)layer.dispose();style.dispose();}
});
