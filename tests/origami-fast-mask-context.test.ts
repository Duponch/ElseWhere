import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import type {ReferencePaintDescriptor} from '../src/render/origami/reference-paint-library';
import type {CheckpointPaintSink} from '../src/render/origami/checkpoint-paint-baker';
const state=vi.hoisted(()=>({full:[] as {fill:number;seeds:number[]}[],replay:[] as {seed:number;fill:number;kraft:boolean}[],throwMaskAt:0,throwFullAt:0,invalidCheckpoint:false}));
// Lifecycle-only seam: synthetic pixels do NOT qualify paint fidelity. ROOT's
// independent72 real-Canvas cases cover checkpoint/raster byte equality.
vi.mock('../src/render/origami/checkpoint-paint-baker',()=>({
 bakeCheckpointPaintToSink(descriptors:readonly ReferencePaintDescriptor[],fill:number,onLayer:CheckpointPaintSink){
  state.full.push({fill,seeds:descriptors.map(d=>d.seed)});
  const pigment=new Uint8Array(512*512*4).fill(255),paper=new Uint8Array(512*512*4).fill(255),coverage=new Uint8Array(512*512*4).fill(255);
  pigment[0]=31;paper[0]=71;
  for(let index=0;index<descriptors.length;index++){
   if(state.throwFullAt===index+1)throw Error('deliberate full failure');
   coverage.fill(descriptors[index]!.config.kraftEdgeWear===false||fill<=.01?255:Math.round(fill*255));
   onLayer(index,pigment,pigment,{paperColorRgba:paper,paperBumpRgba:paper,coverageRgba:coverage,coverageSeed:state.invalidCheckpoint?Number.NaN:descriptors[index]!.seed+10000});
  }
  return{layers:descriptors.map(d=>({key:d.key,seed:d.seed,seedAfter:d.seed+10000}))};
 },
 replayCheckpointMaskR8(seed:number,fill:number,kraft:boolean){
  state.replay.push({seed,fill,kraft});if(state.throwMaskAt===state.replay.length)throw Error('deliberate mask failure');
  return new Uint8Array(512*512).fill(!kraft||fill<=.01?255:Math.round(fill*255));
 },
}));
import {stubResidentPaintToSink} from './fixtures/reference-paint-bake-stub';
vi.mock('../src/render/origami/reference-resident-paint-library',async importOriginal=>({...await importOriginal<typeof import('../src/render/origami/reference-resident-paint-library')>(),bakeResidentPaintToSink:stubResidentPaintToSink}));
import {GraphicsStyleContext} from '../src/render/graphics-style';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {BASE_REFERENCE_PAINT_DESCRIPTORS} from '../src/render/origami/reference-profiles';
import {GAME_REQUIRED_VIRTUAL_IDS78} from '../src/render/origami/game-paint-residency';
const live:GraphicsStyleContext[]=[];
function context(fill=.60){const c=new GraphicsStyleContext({...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',contourImperfection:fill});live.push(c);return c;}
function fill(c:GraphicsStyleContext,value:number){c.update({...c.preferences,contourImperfection:value});vi.advanceTimersByTime(60);}
function sameReference(a:unknown,b:unknown,label:string){expect(a===b,label).toBe(true);}
const digest=(bytes:Uint8Array|Float32Array)=>createHash('sha256').update(new Uint8Array(bytes.buffer,bytes.byteOffset,bytes.byteLength)).digest('hex');
function stable(c:GraphicsStyleContext){const before=c.debugPaintStorage(),mode=c.paintReplayState(),lookupVersion=before.lookup.texture.version,paperVersion=before.paper.texture.version,bankVersions=before.banks.map(b=>b.texture.version),paperHash=digest(before.paper.data),lookupHash=digest(before.lookup.data),bankHashes=before.banks.map(b=>digest(b.data));return()=>{
 const after=c.debugPaintStorage();sameReference(after.lookup.texture,before.lookup.texture,'lookup texture identity');sameReference(after.lookup.data,before.lookup.data,'lookup bytes identity');expect(after.lookup.texture.version).toBe(lookupVersion);
 sameReference(after.paper.texture,before.paper.texture,'paper texture identity');sameReference(after.paper.data,before.paper.data,'paper bytes identity');expect(after.paper.texture.version).toBe(paperVersion);sameReference(after.rows,before.rows,'human rows identity');
 expect(after.banks.length).toBe(before.banks.length);after.banks.forEach((b,i)=>{sameReference(b.texture,before.banks[i]!.texture,'bank texture '+i);sameReference(b.data,before.banks[i]!.data,'bank bytes '+i);expect(b.texture.version).toBe(bankVersions[i]);});
 expect(digest(after.paper.data),'paper bytes digest').toBe(paperHash);expect(digest(after.lookup.data),'lookup bytes digest').toBe(lookupHash);after.banks.forEach((b,i)=>expect(digest(b.data),'bank bytes digest '+i).toBe(bankHashes[i]));
 expect(c.paintReplayState().checkpointCount).toBe(mode.checkpointCount);
};}
beforeEach(()=>{vi.useFakeTimers();state.full=[];state.replay=[];state.throwMaskAt=0;state.throwFullAt=0;state.invalidCheckpoint=false;});
afterEach(()=>{for(const c of live.splice(0))c.dispose();vi.useRealTimers();});
describe('gamewide mask-only transactional lifecycle',()=>{
 it('keeps Default raster-free and prepares all78 before any actual animal request',()=>{
  const plain=new GraphicsStyleContext();live.push(plain);plain.flushPaint();expect(state.full).toHaveLength(0);
  const c=context();expect(c.paintResidency().requiredCount).toBe(78);expect(state.full).toHaveLength(0);
  void c.paint;expect(state.full).toHaveLength(1);expect(c.paintResidency().residentCount).toBe(78);expect(c.paintReplayState()).toMatchObject({mode:'full',refreshed:false,checkpointCount:77});
  const unchanged=stable(c);for(const id of GAME_REQUIRED_VIRTUAL_IDS78)c.requirePaint('arrival:'+id,[id]);c.flushPaint();expect(state.full).toHaveLength(1);expect(state.replay).toHaveLength(0);unchanged();
 });
 it('preserves the real first refreshed full bake, then publishes only77 masks without touching P/K/metadata or slots',()=>{
  const c=context();c.flushPaint();expect(state.full[0]!.seeds).toEqual(GAME_REQUIRED_VIRTUAL_IDS78.map(id=>BASE_REFERENCE_PAINT_DESCRIPTORS[id]!.seed));
  fill(c,.35);expect(state.full).toHaveLength(2);expect(state.full[1]!.seeds).toEqual(GAME_REQUIRED_VIRTUAL_IDS78.map(id=>BASE_REFERENCE_PAINT_DESCRIPTORS[id]!.refreshSeed??BASE_REFERENCE_PAINT_DESCRIPTORS[id]!.seed));
  const unchanged=stable(c),before=c.debugPaintStorage(),beforeMaskHash=digest(before.coverage.data),beforeMaskVersion=before.coverage.texture.version,slots=GAME_REQUIRED_VIRTUAL_IDS78.map(id=>{const p=c.debugPaintProfile(id);return[p.physicalLayer,p.faceLayer];});
  fill(c,0);expect(c.paintReplayState().mode).toBe('mask');expect(state.full).toHaveLength(2);expect(state.replay).toHaveLength(77);sameReference(c.debugPaintStorage().coverage.data,before.coverage.data,'M retains storage');sameReference(c.debugPaintStorage().coverage.texture,before.coverage.texture,'M retains texture');expect(digest(c.debugPaintStorage().coverage.data)).not.toBe(beforeMaskHash);expect(c.debugPaintStorage().coverage.texture.version).toBe(beforeMaskVersion+1);expect(c.debugPaintStorage().coverage.data.every(n=>n===255)).toBe(true);unchanged();
  const zeroHash=digest(c.debugPaintStorage().coverage.data);fill(c,.60);expect(state.full).toHaveLength(2);expect(state.replay).toHaveLength(154);expect(digest(c.debugPaintStorage().coverage.data)).not.toBe(zeroHash);sameReference(c.debugPaintStorage().coverage.data,before.coverage.data,'M retains storage after retry');unchanged();
  expect(GAME_REQUIRED_VIRTUAL_IDS78.map(id=>{const p=c.debugPaintProfile(id);return[p.physicalLayer,p.faceLayer];})).toEqual(slots);expect(c.paintReplayState().refreshed).toBe(true);
 });
 it('starts directly refreshed away from.60, honors debounce and atomically preserves everything after a later mask failure',()=>{
  const c=context(.4);c.flushPaint();expect(c.paintReplayState().refreshed).toBe(true);const unchanged=stable(c),before=c.debugPaintStorage(),beforeVersion=before.coverage.texture.version,beforeMaskHash=digest(before.coverage.data),beforeState=c.paintReplayState(),beforeResidency=c.paintResidency();
  c.update({...c.preferences,contourImperfection:.2});c.flushPaint();expect(state.replay).toHaveLength(0);expect(c.paintReplayState().bakedFill).toBe(.4);
  state.throwMaskAt=1;expect(()=>vi.advanceTimersByTime(60)).toThrow('deliberate mask failure');
  sameReference(c.debugPaintStorage().coverage.data,before.coverage.data,'failed mask keeps M bytes');expect(digest(c.debugPaintStorage().coverage.data)).toBe(beforeMaskHash);expect(c.debugPaintStorage().coverage.texture.version).toBe(beforeVersion);expect(c.paintReplayState()).toEqual(beforeState);expect(c.paintResidency()).toEqual(beforeResidency);unchanged();
  state.throwMaskAt=0;c.flushPaint();expect(c.paintReplayState()).toMatchObject({mode:'mask',bakedFill:.2});expect(state.full).toHaveLength(1);sameReference(c.debugPaintStorage().coverage.data,before.coverage.data,'successful retry retains M storage');expect(digest(c.debugPaintStorage().coverage.data)).not.toBe(beforeMaskHash);unchanged();
 });
 it('falls back to a full transaction for a late human palette, then captures the new shared-template checkpoint for future masks',()=>{
  const c=context(.4);c.flushPaint();const row=c.registerHumanAppearance({skin:0xb79162,hair:0x2d2721,shirt:0x893b45,outerwear:0x697d50,pants:0x474144,hat:0x7d5734});expect(row).toBe(0);
  c.update({...c.preferences,contourImperfection:.2});vi.advanceTimersByTime(60);
  expect(state.full).toHaveLength(2);expect(state.replay).toHaveLength(0);expect(c.paintReplayState().mode).toBe('full');expect(c.paintResidency().residentCount).toBeGreaterThan(78);
  const unchanged=stable(c),count=c.paintReplayState().checkpointCount;fill(c,.1);expect(c.paintReplayState().mode).toBe('mask');expect(state.replay).toHaveLength(count);unchanged();
 });
 it('falls back when checkpoints are incomplete, and failed full baking cannot publish partial cache or pixel buffers',()=>{
  state.invalidCheckpoint=true;const c=context(.4);c.flushPaint();expect(c.paintReplayState().checkpointCount).toBe(0);
  state.invalidCheckpoint=false;state.throwFullAt=4;const before=c.debugPaintStorage(),beforeState=c.paintReplayState(),unchanged=stable(c);
  expect(()=>fill(c,.2)).toThrow('deliberate full failure');expect(c.paintReplayState()).toEqual(beforeState);sameReference(c.debugPaintStorage().coverage.data,before.coverage.data,'failed full bake keeps M bytes');unchanged();
  state.throwFullAt=0;c.flushPaint();expect(c.paintReplayState()).toMatchObject({mode:'full',checkpointCount:77,bakedFill:.2});expect(state.replay).toHaveLength(0);
  fill(c,.1);expect(c.paintReplayState().mode).toBe('mask');expect(state.replay).toHaveLength(77);
 });
 it('disposes all checkpoint ownership with the context',()=>{
  const c=context(.4);c.flushPaint();expect(c.paintReplayState().checkpointCount).toBe(77);c.dispose();live.splice(live.indexOf(c),1);expect(c.paintReplayState().checkpointCount).toBe(0);expect(c.paintResidency().residentCount).toBe(0);
 });
 it('retains the mask texture, Source, image and typed buffer without any disposal during fast publication',()=>{
  const c=context(.4);c.flushPaint();const before=c.debugPaintStorage().coverage,texture=before.texture,source=texture.source,image=texture.image,bytes=before.data,version=texture.version,hash=digest(bytes),disposed=vi.fn();texture.addEventListener('dispose',disposed);
  fill(c,.2);const after=c.debugPaintStorage().coverage;
  sameReference(after.texture,texture,'M texture');sameReference(texture.source,source,'M Source');sameReference(texture.image,image,'M image');sameReference(after.data,bytes,'M typed buffer');
  expect(disposed).not.toHaveBeenCalled();expect(texture.version).toBe(version+1);expect(digest(bytes)).not.toBe(hash);expect(c.paintReplayState().mode).toBe('mask');
 });
 it('keeps the disabled-fill boundary opaque at0 and.01 while preserving all refreshed pigment and paper ownership',()=>{
  const c=context(.4);c.flushPaint();const unchanged=stable(c);
  fill(c,0);const zeroHash=digest(c.debugPaintStorage().coverage.data);expect(c.debugPaintStorage().coverage.data.every(value=>value===255)).toBe(true);unchanged();
  fill(c,.01);expect(c.paintReplayState()).toMatchObject({mode:'mask',bakedFill:.01});expect(digest(c.debugPaintStorage().coverage.data)).toBe(zeroHash);expect(state.full).toHaveLength(1);unchanged();
  fill(c,.010001);expect(digest(c.debugPaintStorage().coverage.data)).not.toBe(zeroHash);unchanged();
 });
 it('can retry a failed first bake without admitting partial layers or checkpoints',()=>{
  const c=context();state.throwFullAt=4;expect(()=>c.flushPaint()).toThrow('deliberate full failure');
  expect(c.paintResidency().residentCount).toBe(0);expect(c.paintReplayState()).toMatchObject({mode:'none',checkpointCount:0,bakedFill:-1});
  state.throwFullAt=0;c.flushPaint();expect(state.full).toHaveLength(2);expect(c.paintResidency().residentCount).toBe(78);expect(c.paintReplayState()).toMatchObject({mode:'full',checkpointCount:77,bakedFill:.6,refreshed:false});
 });
});
