/** Packing/lifetime contract at the Canvas streaming seam. Synthetic pixels
 * do not establish source-painter fidelity, Native images or performance. */
import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createHash} from 'node:crypto';
import {stubReferenceBakeToSink,stubResidentPaintToSink,stubCheckpointPaintToSink,stubReplayCheckpointMaskR8} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-paint-library')>(),bakeReferencePaintLayersToSink:stubReferenceBakeToSink}));
vi.mock('../src/render/origami/reference-resident-paint-library',async original=>({...await original<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
vi.mock('../src/render/origami/checkpoint-paint-baker',async original=>({...await original<typeof import('../src/render/origami/checkpoint-paint-baker')>(),bakeCheckpointPaintToSink:stubCheckpointPaintToSink,replayCheckpointMaskR8:stubReplayCheckpointMaskR8}));
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES,requiresGraphicsStyleRebuild} from '../src/ui3d/native-preferences';
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
function rgbDigest(bytes:Uint8Array){const hash=createHash('sha256'),scratch=new Uint8Array(3*16384);for(let first=0;first<bytes.length;first+=4*16384){let used=0;for(let i=first;i<Math.min(bytes.length,first+4*16384);i+=4){scratch[used++]=bytes[i]!;scratch[used++]=bytes[i+1]!;scratch[used++]=bytes[i+2]!;}hash.update(scratch.subarray(0,used));}return hash.digest('hex');}

test('Pastel remains raster-free; coverage shares the paper alpha and fill replay preserves all pigment and paper RGB bytes',()=>{
 const preferences={...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default' as const,impasto:0,wear:0},context=new GraphicsStyleContext(preferences);
 try{
  expect(context.prepareSharedSurfaceAssets()).toEqual([]);expect(context.paintReplayState().mode).toBe('none');expect(Reflect.get(context,'paperHeightArray')).toBeUndefined();expect(context.reliefLod).toBeUndefined();
  expect(requiresGraphicsStyleRebuild(preferences,{...preferences,style:'origami'})).toBe(false);
  context.update({...preferences,style:'origami'});context.prepareSharedSurfaceAssets();
  // The established cache replays masks only after its first complete refresh.
  // Preserve that admission rule; packing must not silently change the painter.
  context.update({...context.preferences,contourImperfection:.4});const uploads=context.prepareSharedSurfaceAssets(),before=context.debugPaintStorage(),paper=before.paper.data,pigments=before.banks.map(b=>digest(b.data)),rgb=rgbDigest(paper);
  expect(uploads).toContain(before.paper.texture);expect(uploads).not.toContain(before.coverage.texture);expect(Reflect.get(context,'paperHeightArray')).toBeUndefined();
  for(let i=0;i<before.coverage.data.length;i++)if(paper[i*4+3]!==before.coverage.data[i])throw Error('Initial packed coverage differs from the replay checkpoint');
  context.update({...context.preferences,contourImperfection:.2});context.prepareSharedSurfaceAssets();const after=context.debugPaintStorage();
  expect(context.paintReplayState().mode).toBe('mask');expect(after.paper.texture).toBe(before.paper.texture);expect(after.paper.data).toBe(paper);expect(rgbDigest(after.paper.data)).toBe(rgb);expect(after.banks.map(b=>digest(b.data))).toEqual(pigments);
  for(let i=0;i<after.coverage.data.length;i++)if(paper[i*4+3]!==after.coverage.data[i])throw Error('Replayed coverage differs from the packed alpha');
  expect(Reflect.get(context,'paperHeightArray')).toBeUndefined();expect(Reflect.get(context,'edgeMaps').color).toBeUndefined();expect(Reflect.get(context,'edgeMaps').bump).toBeUndefined();
 }finally{context.dispose();}
},60_000);

test('positive height has an independent optional binding and strict zero retires it without changing the paint owners',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0});
 try{
  context.prepareSharedSurfaceAssets();const before=context.debugPaintStorage(),source=before.paper.texture.source;
  context.update({...context.preferences,impasto:.5});const uploads=context.prepareSharedSurfaceAssets(),height=Reflect.get(context,'paperHeightArray') as THREE.DataArrayTexture;
  expect(height).toBeInstanceOf(THREE.DataArrayTexture);expect(height.format).toBe(THREE.RedFormat);expect(height.colorSpace).toBe(THREE.NoColorSpace);expect(uploads).toContain(height);expect(context.debugPaintStorage().paper.texture).toBe(before.paper.texture);expect(before.paper.texture.source).toBe(source);let retired=0;height.addEventListener('dispose',()=>retired++);
  context.update({...context.preferences,impasto:0});context.prepareSharedSurfaceAssets();expect(retired).toBe(1);expect(Reflect.get(context,'paperHeightArray')).toBeUndefined();expect(context.reliefLod).toBeUndefined();expect(context.debugPaintStorage().paper.texture).toBe(before.paper.texture);
 }finally{context.dispose();}
},60_000);

test('a texture-only change does not rewrite enabled physical-wear geometry',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'default',impasto:0,wear:.75}),geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));geometry.userData.referenceWearBasePositions=new Float32Array([0,0,0]);geometry.userData.referenceWearExpandDirections=new Float32Array([1,0,0]);
 const release=context.trackWearGeometry(geometry),position=geometry.getAttribute('position') as THREE.BufferAttribute,version=position.version,original=Array.from(position.array);
 try{context.update({...context.preferences,style:'origami'});context.update({...context.preferences,style:'default'});expect(position.version).toBe(version);expect(Array.from(position.array)).toEqual(original);}
 finally{release();geometry.dispose();context.dispose();}
});
