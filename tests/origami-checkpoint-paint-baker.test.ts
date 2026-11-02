import {afterEach,describe,it,expect,vi} from 'vitest';
const call=vi.hoisted(()=>({replay:vi.fn((seed:number,fill:number,kraft:boolean)=>{
 const coverageRgba=new Uint8Array(512*512*4);coverageRgba[3]=17;coverageRgba[(511*512)*4+3]=231;
 return{coverageRgba,seedAfter:seed+(fill>.01&&kraft?1:0)};
})}));
vi.mock('../src/render/origami/reference-painter',()=>({GouacheCardboardPainter:class{},createSeparatedReferencePaint:()=>{throw Error('Full paint forbidden in helper test');},replayReferenceCoverage:call.replay}));
import {replayCheckpointMaskR8} from '../src/render/origami/checkpoint-paint-baker';
afterEach(()=>call.replay.mockClear());
describe('Exact mask R8 adapter, without Canvas emulation',()=>{
 it('short-circuits fill0, exact.01 and kraft=false before creating any painter or Canvas',()=>{
  for(const [fill,kraft]of [[0,true],[.01,true],[.8,false]] as const){const bytes=replayCheckpointMaskR8(431287621,fill,kraft);expect(bytes).toHaveLength(512*512);expect(bytes.every(n=>n===255)).toBe(true);}
  expect(call.replay).not.toHaveBeenCalled();
 });
 it('delegates nonzero coverage once and preserves source alpha with the existing row orientation',()=>{
  const bytes=replayCheckpointMaskR8(431287621,.010001,true);expect(call.replay).toHaveBeenCalledExactlyOnceWith(431287621,.010001,true);expect(bytes[0]).toBe(231);expect(bytes[511*512]).toBe(17);expect(bytes[1]).toBe(0);
 });
});
