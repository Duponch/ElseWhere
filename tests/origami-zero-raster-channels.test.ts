import {createHash} from 'node:crypto';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {GouacheCardboardPainter,createReferenceEdgeMaterial,createReferencePaintMaterial,createSeparatedReferencePaint,type ReferencePaintConfig} from '../src/render/origami/reference-painter';
import {packReferencePaintPixels} from '../src/render/origami/reference-paint-library';
import {bakeResidentPaintToSink} from '../src/render/origami/reference-resident-paint-library';
import {bakeCheckpointPaintToSink} from '../src/render/origami/checkpoint-paint-baker';

/** Records the real painter's draw commands and allocation boundary. This is
 * not a Canvas rasterizer: these tests qualify RGB draw/RNG conservation and
 * absent height/color work, not browser antialiasing or final pixel fidelity. */
type Command={name:string;args:unknown[]};
class Gradient {readonly stops:unknown[][]=[];addColorStop(...args:unknown[]):void{this.stops.push(args);}}
class RecordingCanvas {
 width=0;height=0;readonly commands:Command[]=[];
 readonly context=new Proxy({} as Record<string,unknown>,{
  set:(target,key,value)=>{this.commands.push({name:'set:'+String(key),args:[value]});return Reflect.set(target,key,value);},
  get:(_target,key)=>{
   if(key==='getImageData')return (_x:number,_y:number,w:number,h:number)=>({data:new Uint8ClampedArray(w*h*4).fill(255)});
   if(key==='createLinearGradient')return (...args:unknown[])=>{this.commands.push({name:String(key),args});return new Gradient();};
   return (...args:unknown[])=>{this.commands.push({name:String(key),args});};
  },
 });
 getContext(kind:string):CanvasRenderingContext2D|null{return kind==='2d'?this.context as unknown as CanvasRenderingContext2D:null;}
}
const canvases:RecordingCanvas[]=[];
const normalize=(value:unknown):unknown=>value instanceof RecordingCanvas?{canvas:signature(value)}:value instanceof Gradient?{gradient:value.stops}:value;
function signature(canvas:RecordingCanvas):string{
 return createHash('sha256').update(JSON.stringify(canvas.commands.map(command=>({name:command.name,args:command.args.map(normalize)})))).digest('hex');
}
const dispose=(material:ReturnType<typeof createReferencePaintMaterial>)=>{for(const map of [material.map,material.alphaMap,material.bumpMap])map?.dispose();material.dispose();};
beforeEach(()=>{canvases.length=0;vi.stubGlobal('document',{createElement:(kind:string)=>{if(kind!=='canvas')throw Error('Unexpected DOM allocation');const canvas=new RecordingCanvas();canvases.push(canvas);return canvas;}});});
afterEach(()=>vi.unstubAllGlobals());

describe('Selective authored raster channels, with exact draw/RNG flow',()=>{
 it.each(['fur','wavy','directional','coarse'])('omits both height canvases and texture while retaining %s RGB commands and final seed',strokeStyle=>{
  const config:ReferencePaintConfig={baseColor:'#c86428',secondaryColor:'#624227',accentColor:'#f3d68b',strokeCount:5,strokeStyle,kraftEdgeWear:true};
  const full=new GouacheCardboardPainter();full.seed=871;
  const source=createReferencePaintMaterial(full,config),sourceCanvases=canvases.splice(0);
  const cheap=new GouacheCardboardPainter();cheap.seed=871;
  const result=createReferencePaintMaterial(cheap,config,{includeHeight:false}),cheapCanvases=canvases.splice(0);
  expect(sourceCanvases).toHaveLength(5);expect(cheapCanvases).toHaveLength(3);
  expect(result.bumpMap).toBeNull();expect(result.userData.bumpCanvas).toBeUndefined();
  expect(signature(cheapCanvases[0]!)).toBe(signature(sourceCanvases[0]!));
  expect(signature(cheapCanvases[1]!)).toBe(signature(sourceCanvases[2]!));
  expect(signature(cheapCanvases[2]!)).toBe(signature(sourceCanvases[4]!));
  expect(cheap.seed).toBe(full.seed);dispose(source);dispose(result);
 });
 it('preserves gradient/flank/dry-brush and disabled-fill commands, checkpoints and RNG without height planes',()=>{
  for(const fill of [0,.6]){
   const config:ReferencePaintConfig={baseColor:'#ad6b32',strokeCount:2,gradientTip:{color:'#eee6d5'},flankStripe:{bellyColor:'#e9d6b1',stripeColor:'#38261a'}};
   const full=new GouacheCardboardPainter();full.seed=51071;full.fillImperfectionAmount=fill;
   const source=createSeparatedReferencePaint(full,config),sourceCanvases=canvases.splice(0);
   const cheap=new GouacheCardboardPainter();cheap.seed=51071;cheap.fillImperfectionAmount=fill;
   const result=createSeparatedReferencePaint(cheap,config,{includeHeight:false}),cheapCanvases=canvases.splice(0);
   expect(cheapCanvases).toHaveLength(sourceCanvases.length-2);
   expect(signature(cheapCanvases[0]!)).toBe(signature(sourceCanvases[0]!));
   expect(signature(cheapCanvases[1]!)).toBe(signature(sourceCanvases[2]!));
   expect(result.coverageSeed).toBe(source.coverageSeed);expect(result.seedAfter).toBe(source.seedAfter);
   expect(result.paperBumpRgba).toBeUndefined();expect(result.pigmentBumpRgba).toBeUndefined();expect(result.canonicalBumpRgba).toBeUndefined();
   expect(result.material.bumpMap).toBeNull();dispose(source.material);dispose(result.material);
  }
 });
 it.each([{color:false,height:false},{color:true,height:false},{color:false,height:true}])('bakes only requested edge channels %j while retaining alpha commands and the 380-speckle RNG preamble',channels=>{
  const full=new GouacheCardboardPainter();full.seed=1337;const source=createReferenceEdgeMaterial(full),sourceCanvases=canvases.splice(0);
  const cheap=new GouacheCardboardPainter();cheap.seed=1337;const result=createReferenceEdgeMaterial(cheap,channels),cheapCanvases=canvases.splice(0);
  expect(sourceCanvases).toHaveLength(3);expect(cheapCanvases).toHaveLength(1+Number(channels.color)+Number(channels.height));
  expect(signature(result.alphaMap!.image as unknown as RecordingCanvas)).toBe(signature(source.alphaMap!.image as unknown as RecordingCanvas));
  expect(Boolean(result.map)).toBe(channels.color);expect(Boolean(result.bumpMap)).toBe(channels.height);
  if(result.map)expect(signature(result.map.image as unknown as RecordingCanvas)).toBe(signature(source.map!.image as unknown as RecordingCanvas));
  if(result.bumpMap)expect(signature(result.bumpMap.image as unknown as RecordingCanvas)).toBe(signature(source.bumpMap!.image as unknown as RecordingCanvas));
  expect(cheap.seed).toBe(full.seed);dispose(source);dispose(result);
 });
 it('streams absent height planes and alpha-only edges without allocating substitute height buffers',()=>{
  const descriptor={key:'zero-test',seed:717,config:{baseColor:'#b67531',strokeCount:2}};
  let calls=0;
  const result=bakeResidentPaintToSink([descriptor],{includeHeight:false,separateFill:true,includeEdge:true,edgeChannels:{color:false,height:false}},(_index,color,bump,face)=>{
   calls++;expect(color).toHaveLength(512*512*4);expect(bump).toBeUndefined();expect(face?.paperBumpRgba).toBeUndefined();expect(face?.paperColorRgba).toHaveLength(512*512*4);
  });
  expect(calls).toBe(1);expect(canvases).toHaveLength(4);expect(result.edge?.alphaRgba).toHaveLength(512*128*4);expect(result.edge?.colorRgba).toBeUndefined();expect(result.edge?.bumpRgba).toBeUndefined();
 });
 it.each([1337,Number.MAX_SAFE_INTEGER+1])('skips all 1520 unused wear-color random computations for seed %s, with exact shared alpha and rounding',seed=>{
  const full=new GouacheCardboardPainter();full.seed=seed;const fullRandom=vi.spyOn(full,'random');
  const source=createReferenceEdgeMaterial(full),sourceCalls=fullRandom.mock.calls.length;
  const cheap=new GouacheCardboardPainter();cheap.seed=seed;const cheapRandom=vi.spyOn(cheap,'random');
  const result=createReferenceEdgeMaterial(cheap,{color:false,height:false});
  expect(sourceCalls-cheapRandom.mock.calls.length).toBe(1520);
  expect(signature(result.alphaMap!.image as unknown as RecordingCanvas)).toBe(signature(source.alphaMap!.image as unknown as RecordingCanvas));
  expect(cheap.seed).toBe(full.seed);dispose(source);dispose(result);
 });
 it('accepts the optional checkpoint settings and preserves coverage boundary/final seed with no heights',()=>{
  const descriptors=[{key:'checkpoint-zero',seed:1717,config:{strokeCount:2}}];let sourceCheckpoint=0,cheapCheckpoint=0;
  const full=bakeCheckpointPaintToSink(descriptors,.6,(_i,_color,bump,face)=>{expect(bump).toHaveLength(512*512*4);sourceCheckpoint=face.coverageSeed;});
  canvases.length=0;
  const cheap=bakeCheckpointPaintToSink(descriptors,.6,(_i,_color,bump,face)=>{expect(bump).toBeUndefined();expect(face.paperBumpRgba).toBeUndefined();cheapCheckpoint=face.coverageSeed;},{includeHeight:false});
  expect(canvases).toHaveLength(3);expect(cheapCheckpoint).toBe(sourceCheckpoint);expect(cheap.layers).toEqual(full.layers);
 });
 it('packs absent height directly as neutral alpha255, preserving RGB, row inversion and caller-owned scratch',()=>{
  const color=new Uint8Array([11,12,13,255,21,22,23,255]),scratch=new Uint8Array(8);
  expect(packReferencePaintPixels(color,undefined,1,2,1,scratch)).toBe(scratch);
  expect(Array.from(scratch)).toEqual([21,22,23,255,11,12,13,255]);
 });
});
