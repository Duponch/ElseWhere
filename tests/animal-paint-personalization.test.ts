import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {Buffer} from 'node:buffer';
const sourceRgba=vi.hoisted(()=>new Map<string,Uint8Array>());
vi.mock('../src/render/origami/checkpoint-paint-baker',async()=>{
 const stub=await import('./fixtures/reference-paint-bake-stub');
 const bake:typeof stub.stubCheckpointPaintToSink=(descriptors,fill,onLayer)=>stub.stubCheckpointPaintToSink(descriptors,fill,(index,color,bump,face)=>{
  const descriptor=descriptors[index]!;
  if(/^(best46:)?mat(GazelleFlank|FoxSnout)$/.test(descriptor.key)){
   const authored=!!(descriptor.config.flankStripe||descriptor.config.gradientTip),pixels=new Uint8Array(color.length);
   for(let pixel=0;pixel<pixels.length/4;pixel++){const at=pixel*4;pixels[at]=(pixel%512+(authored?101:17))%256;pixels[at+1]=(Math.floor(pixel/512)+(authored?151:37))%256;pixels[at+2]=(pixel%19+(authored?89:7));pixels[at+3]=255;}
   sourceRgba.set(descriptor.key+':'+authored,pixels);onLayer(index,pixels,bump,face);
  }else onLayer(index,color,bump,face);
 });
 return{bakeCheckpointPaintToSink:vi.fn(bake),replayCheckpointMaskR8:stub.stubReplayCheckpointMaskR8};
});
import {bakeCheckpointPaintToSink} from '../src/render/origami/checkpoint-paint-baker';
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {ANIMAL_GOUACHE_PANELS} from '../src/render/animal-surface-paint';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';

test('animal drawing toggle restores only decorated RGB layers without repainter, new textures or changed alpha/coverage',()=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0});
 try{
  context.requirePaint('test-four-historical-animal-drawings',historicalKeys.map(key=>context.profileId(key)));
  context.flushPaint();
  const bank=context.paint,pixels=bank.image.data as Uint8Array,painted=pixels.slice(),paper=Reflect.get(context,'paperArray')as THREE.DataArrayTexture;
  const paperBytes=(paper.image.data as Uint8Array).slice(),epoch=context.preparedPaintRevision,personalizedEpoch=Reflect.get(context,'personalizedPaintEpoch'),version=bank.version;
  const originals=Reflect.get(context,'animalPigmentOriginals')as Map<number,{rgb:Uint8Array;key:string}>;
  const decoratedLayers=new Set(originals.keys());
  expect(originals.size).toBe(Object.keys(ANIMAL_GOUACHE_PANELS).length+4);
  expect(context.personalizedPaintCpuBytes).toBeLessThanOrEqual((18+8)*512*512*3);
  const calls=vi.mocked(bakeCheckpointPaintToSink).mock.calls.length;
  bank.clearLayerUpdates();
  context.update({...context.preferences,personalizedTextures:false});
  expect(context.paint).toBe(bank);expect(bank.image.data).toBe(pixels);expect(bank.version).toBe(version+1);
  expect(context.preparedPaintRevision).toBe(epoch);expect(Reflect.get(context,'personalizedPaintEpoch')).toBe(personalizedEpoch+1);expect(vi.mocked(bakeCheckpointPaintToSink).mock.calls.length).toBe(calls);
  expect(Buffer.compare(Buffer.from((paper.image.data as Uint8Array).buffer),Buffer.from(paperBytes.buffer))).toBe(0);
  expect(bank.layerUpdates).toEqual(decoratedLayers);
  let changed=0,unchanged=true;
  for(let layer=0;layer<bank.image.depth;layer++){
   const start=layer*512*512*4;
   if(!decoratedLayers.has(layer)){if(Buffer.compare(Buffer.from(pixels.buffer,start,512*512*4),Buffer.from(painted.buffer,start,512*512*4)))unchanged=false;continue;}
   for(let at=start;at<start+512*512*4;at++){
    if(at%4===3){if(pixels[at]!==painted[at])unchanged=false;}
    else if(pixels[at]!==painted[at])changed++;
   }
  }
  expect(unchanged).toBe(true);expect(changed).toBeGreaterThan(0);
  const unchangedVersion=bank.version;
  context.update({...context.preferences,personalizedTextures:false});expect(bank.version).toBe(unchangedVersion);
  context.update({...context.preferences,personalizedTextures:true});
  expect(Buffer.compare(Buffer.from(pixels.buffer),Buffer.from(painted.buffer))).toBe(0);expect(vi.mocked(bakeCheckpointPaintToSink).mock.calls.length).toBe(calls);
 }finally{context.dispose();}
},60_000);

const historicalKeys=['matGazelleFlank','best46:matGazelleFlank','matFoxSnout','best46:matFoxSnout'];
function rgb(packed:Uint8Array):Buffer {
 const result=Buffer.alloc(packed.length/4*3);for(let pixel=0;pixel<packed.length/4;pixel++){result[pixel*3]=packed[pixel*4]!;result[pixel*3+1]=packed[pixel*4+1]!;result[pixel*3+2]=packed[pixel*4+2]!;}return result;
}
test.each([true,false])('historical gazelle/fox RGB is exact for initial enabled=%s and every on/off/on flip, with original bump, paper and coverage',initial=>{
 const context=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',personalizedTextures:initial,impasto:0,wear:0});
 try{
  context.requirePaint('test-four-historical-animal-drawings',historicalKeys.map(key=>context.profileId(key)));
  context.flushPaint();const bank=context.paint,data=bank.image.data,version=bank.version,calls=vi.mocked(bakeCheckpointPaintToSink).mock.calls.length;
  const paper=Reflect.get(context,'paperArray')as THREE.DataArrayTexture,paperBytes=Buffer.from((paper.image.data as Uint8Array).slice().buffer),alpha=new Map<string,Uint8Array>();
  const check=(enabled:boolean)=>{for(const key of historicalKeys){const packed=context.paintLayerData(context.profileId(key)),expected=sourceRgba.get(key+':'+enabled)!;expect(expected,key).toBeDefined();expect(Buffer.compare(rgb(packed),rgb(expected)),key).toBe(0);
   const bump=Uint8Array.from({length:512*512},(_,i)=>packed[i*4+3]!);if(!alpha.has(key))alpha.set(key,bump);else expect(Buffer.compare(Buffer.from(bump.buffer),Buffer.from(alpha.get(key)!.buffer)),key+' bump').toBe(0);
  }};
  check(initial);
  for(const enabled of [!initial,initial,!initial,initial]){context.update({...context.preferences,personalizedTextures:enabled});check(enabled);expect(context.paint).toBe(bank);expect(bank.image.data).toBe(data);expect(vi.mocked(bakeCheckpointPaintToSink).mock.calls.length).toBe(calls);}
  expect(bank.version).toBe(version+4);expect(Buffer.compare(Buffer.from((paper.image.data as Uint8Array).buffer),paperBytes)).toBe(0);
  const neutralCalls=vi.mocked(bakeCheckpointPaintToSink).mock.calls.filter(([descriptors])=>descriptors.length===4&&descriptors.every(d=>historicalKeys.includes(d.key)&&!Object.hasOwn(d.config,'flankStripe')&&!Object.hasOwn(d.config,'gradientTip')));
  expect(neutralCalls.length).toBeGreaterThan(0);
  const originals=Reflect.get(context,'animalPigmentOriginals')as Map<number,{rgb:Uint8Array;authoredRgb?:Uint8Array;key:string}>;
  expect([...originals.values()].filter(row=>historicalKeys.includes(row.key)).reduce((bytes,row)=>bytes+row.rgb.byteLength+(row.authoredRgb?.byteLength??0),0)).toBe(6*1024*1024);
 }finally{context.dispose();}
},60_000);
