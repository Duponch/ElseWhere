import {expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createNaturalSurfaceArtwork,naturalSurfaceArtworkPixels,naturalArtUv,NATURAL_ART_SIZE,treeArtMotif,type NaturalPaintMotif} from '../src/render/natural-surface-art';
import {physicalSurfaceArtworkUv} from '../src/render/surface-art-uv';
import {paintMetricFromDerivatives} from '../src/render/origami/paint-metric';
import {GraphicsStyleContext,withGraphicsStyle} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {fixedTreePaintKey} from '../src/render/surfaces/FixedTreeTextureSurface';
import {createStylizedSurfaceTexture} from '../src/render/stylized-surfaces';
import {TreeModels,TREE_MODEL_SPECIES} from '../src/render/models/TreeModels';
import {ReferenceFloraLibrary} from '../src/render/origami/resource-flora';
import {createResourceSurfaceModels} from '../src/render/models/ResourceSurfaceModels';
import {mergedInstances} from '../src/render/StaticGeometry';
import {compileNaturalSurfaceModels} from '../src/render/surfaces/NaturalSurfaceModels';
import {cropGeometry} from '../src/render/CropLayer';
import {RESIDENT_CROP_KINDS} from '../src/render/flora-presentation';

test('natural artwork is a deterministic single bounded atlas with recognizably different part illustrations',()=>{
  const previous=createStylizedSurfaceTexture('vegetation'),old=previous.image.data!.slice(),first=createNaturalSurfaceArtwork(previous),second=createNaturalSurfaceArtwork(previous);
  try{
    expect(first.image).toMatchObject({width:256,height:256});
    const data=first.image.data!;
    expect(data.byteLength).toBe(NATURAL_ART_SIZE**2*4);
    expect(first.image.data).toEqual(second.image.data);
    expect(previous.image.data).toEqual(old);
    const motifKeys=['wash','bark','birch','bamboo','oak-leaves','poplar-leaves','needle','palm','cactus','leaf','grass','seed','cotton','hop-cone','mushroom','fruit'] as const;
    const distinct=new Set<string>();
    for(const motif of motifKeys){
      const values:number[]=[];
      for(let v=0;v<16;v++)for(let u=0;u<16;u++){
        const [x,y]=naturalArtUv(motif,u/15,v/15);
        const at=(Math.floor(y*256)*256+Math.floor(x*256))*4;
        values.push(data[at]!);
        expect(data[at+3]).toBe(255);
      }
      expect(Math.max(...values)-Math.min(...values)).toBeGreaterThan(35);
      distinct.add(values.join(','));
    }
    expect(distinct.size).toBe(motifKeys.length);
    expect(treeArtMotif('birch','trunk')).toBe('birch');
    expect(treeArtMotif('bamboo','trunk')).toBe('bamboo');
    expect(treeArtMotif('pine','cone')).toBe('needle');
    expect(treeArtMotif('saguaro','cactus')).toBe('cactus');
    expect(treeArtMotif('palm','crown')).toBe('palm');
  }finally{first.dispose();second.dispose();previous.dispose();}
});

test('generic paint crop follows the actual local and placement metric including a sheared face without changing geometry',()=>{
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,3,1,0,1,1,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setAttribute('surfaceStrokeFace',new THREE.Float32BufferAttribute([0,0,0,0],1));
  geometry.setIndex([0,1,2,0,2,3]);
  const positions=geometry.getAttribute('position').array.slice(),uv=geometry.getAttribute('uv').array.slice(),names=Object.keys(geometry.attributes),result=physicalSurfaceArtworkUv(geometry,.3,2,1);
  try{
    const metric=paintMetricFromDerivatives([.6,0,0],[.9,2,0],[result[2]!-result[0]!,result[3]!-result[1]!],[result[4]!-result[0]!,result[5]!-result[1]!]);
    expect(metric[0]).toBeCloseTo(metric[2],5);expect(metric[1]).toBeCloseTo(0,5);
    expect([...result].every(n=>n>=0&&n<=1)).toBe(true);
    expect(geometry.getAttribute('position').array).toEqual(positions);expect(geometry.getAttribute('uv').array).toEqual(uv);expect(Object.keys(geometry.attributes)).toEqual(names);
    // A tapered trunk face is a trapezoid: its second triangle has a different
    // original UV Jacobian and must still show the same circular paint marks.
    geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,1.5,1,0,.5,1,0],3));
    const tapered=physicalSurfaceArtworkUv(geometry),p=geometry.getAttribute('position');
    for(const [a,b,c]of [[0,1,2],[0,2,3]]){
      const metric=paintMetricFromDerivatives([p.getX(b!)-p.getX(a!),p.getY(b!)-p.getY(a!),0],[p.getX(c!)-p.getX(a!),p.getY(c!)-p.getY(a!),0],[tapered[b!*2]!-tapered[a!*2]!,tapered[b!*2+1]!-tapered[a!*2+1]!],[tapered[c!*2]!-tapered[a!*2]!,tapered[c!*2+1]!-tapered[a!*2+1]!]);
      expect(metric[0]).toBeCloseTo(metric[2],5);expect(metric[1]).toBeCloseTo(0,5);
    }
  }finally{geometry.dispose();}
});

test('merged generic natural paint uses local dimensions and actual placement scale while a whole leaf keeps its authored frame',()=>{
  const source=new THREE.BoxGeometry(4,1,2),models=compileNaturalSurfaceModels([source]),master=models.geometries[0]!,item={x:0,y:0,z:0,sx:.5,sy:3,sz:2},physical=physicalSurfaceArtworkUv(master,item.sx,item.sy,item.sz),material=new THREE.MeshLambertNodeMaterial();material.userData.rendererOwned=true;
  const meshes:THREE.Mesh[]=[];
  try{
    for(const motif of ['bark','leaf'] as const){
      const g=master.clone();g.userData.naturalPaintMotif=motif;
      const mesh=mergedInstances(new THREE.Group(),[{geometry:g,items:[item]}],material,true,true,false,true)!;meshes.push(mesh);
      const actual=mesh.geometry.getAttribute('uv'),raw=master.getAttribute('uv');
      for(let i=0;i<actual.count;i++){
        const expected=naturalArtUv(motif,motif==='bark'?physical[i*2]!:raw.getX(i),motif==='bark'?physical[i*2+1]!:raw.getY(i));
        expect(actual.getX(i)).toBeCloseTo(expected[0],7);expect(actual.getY(i)).toBeCloseTo(expected[1],7);
      }
      expect(Object.keys(mesh.geometry.attributes)).not.toContain('physicalArtworkUv');
    }
  }finally{for(const mesh of meshes)mesh.geometry.dispose();material.dispose();models.dispose();source.dispose();}
});

test('drawn natural textures switch live on the source and fixed-tree copy while retaining topology and historical Gouache tree recipe',()=>{
  const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,impasto:0,wear:0}),pastel=createStylizedSurfaceTexture('vegetation'),plain=new THREE.MeshLambertNodeMaterial(),textured=new THREE.MeshLambertNodeMaterial({map:pastel});
  const layer=withGraphicsStyle(context,()=>new ResourceLayer(new THREE.Group(),plain,textured));
  const source=Reflect.get(layer,'naturalPastel') as THREE.DataTexture,copy=(Reflect.get(layer,'pastelTreeAssets') as {texture:THREE.DataArrayTexture}).texture,enabled=(source.image.data as Uint8Array).slice(),materials=layer.compiledMaterials435(),recipe=fixedTreePaintKey(context);
  try{
    context.update({...context.preferences,personalizedTextures:false});
    expect(source.image.data).toEqual(naturalSurfaceArtworkPixels(pastel,false));
    const data=source.image.data as Uint8Array;
    expect((copy.image.data as Uint8Array).subarray(0,data.length)).toEqual(data);expect((copy.image.data as Uint8Array).subarray(data.length)).toEqual(data);
    expect(source.image.data).not.toEqual(enabled);expect(layer.compiledMaterials435()).toEqual(materials);
    if(recipe!==undefined)expect(fixedTreePaintKey(context)).toEqual(recipe);
    context.update({...context.preferences,personalizedTextures:true});expect(source.image.data).toEqual(enabled);
  }finally{layer.dispose();context.dispose();plain.dispose();textured.dispose();pastel.dispose();}
});

test('all tree species stamp part-specific artwork in existing resident UV and tint streams while retaining the exact Gouache chart and geometry',()=>{
  const trees=new TreeModels(),flora=new ReferenceFloraLibrary(false,false),models=createResourceSurfaceModels(trees,flora);
  const group=new THREE.Group(),material=new THREE.MeshLambertNodeMaterial();material.userData.rendererOwned=true;
  try{
    for(const species of TREE_MODEL_SPECIES){
      const model=trees.get(species,'broadleaf');
      for(const part of model.parts){
        const mapped=models.map(part.geometry),geometry=mapped.clone(),plain=geometry.clone(),motif=treeArtMotif(species,part.primitiveKind);
        expect(geometry.userData.naturalPaintMotif).toBe(motif);
        plain.userData={...plain.userData};delete plain.userData.naturalPaintMotif;
        const placement={...part.canonicalPlacement,referenceColor:part.canonicalPlacement.color,profile:0};
        const render=(g:THREE.BufferGeometry)=>mergedInstances(group,[{geometry:g,items:[placement]}],material,true,true,false,true)!;
        const before=render(plain),after=render(geometry);
        try{
          for(const name of ['position','normal','surfaceUv','origamiPaint'])expect(after.geometry.getAttribute(name).array).toEqual(before.geometry.getAttribute(name).array);
          expect(after.geometry.index!.array).toEqual(before.geometry.index!.array);
          const min=naturalArtUv(motif,0,0),max=naturalArtUv(motif,1,1),uv=after.geometry.getAttribute('uv');
          for(let v=0;v<uv.count;v++){
            expect(uv.getX(v)).toBeGreaterThanOrEqual(min[0]-1e-7);expect(uv.getX(v)).toBeLessThanOrEqual(max[0]+1e-7);
            expect(uv.getY(v)).toBeGreaterThanOrEqual(min[1]-1e-7);expect(uv.getY(v)).toBeLessThanOrEqual(max[1]+1e-7);
          }
          expect(after.geometry.getAttribute('uv').array).not.toEqual(before.geometry.getAttribute('uv').array);
          expect(after.geometry.getAttribute('color').array).not.toEqual(before.geometry.getAttribute('color').array);
          expect(Object.keys(after.geometry.attributes)).toEqual(Object.keys(before.geometry.attributes));
        }finally{for(const mesh of [before,after]){group.remove(mesh);mesh.geometry.dispose();}}
      }
    }
  }finally{models.dispose();flora.dispose();trees.dispose();material.dispose();}
});

test('crop drawings preserve the original poses and topology and keep the independent Gouache chart',()=>{
  const bare=RESIDENT_CROP_KINDS.map(kind=>cropGeometry(kind));
  const adorned=RESIDENT_CROP_KINDS.map(kind=>cropGeometry(kind,true));
  const defaultBank=compileNaturalSurfaceModels(bare),artBank=compileNaturalSurfaceModels(adorned);
  try{
    for(let i=0;i<bare.length;i++){
      const previous=defaultBank.geometries[i]!,next=artBank.geometries[i]!;
      for(const name of ['position','normal','surfaceStrokeUv','surfaceStrokeFace'])expect(next.getAttribute(name).array).toEqual(previous.getAttribute(name).array);
      expect(next.index!.array).toEqual(previous.index!.array);
      expect(next.getAttribute('cropArtworkUv').count).toBe(next.getAttribute('position').count);
      expect(new Set(next.getAttribute('cropArtworkToneUv').array).size).toBeGreaterThan(1);
    }
  }finally{defaultBank.dispose();artBank.dispose();for(const g of [...bare,...adorned])g.dispose();}
});
