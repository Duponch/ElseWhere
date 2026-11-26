import {afterEach,expect,it,vi} from 'vitest';
import {NativeClockRaster} from '../src/ui3d/native-clock-raster';
import type {ClockHour,ClockSheet} from '../src/ui3d/native-clock-ink';

afterEach(()=>vi.unstubAllGlobals());

it('draws only the requested confirmed hour, date and size, including across a rewind and a late response',()=>{
  let worker:LocalWorker;
  class LocalWorker {
    postMessage=vi.fn();
    terminate=vi.fn();
    onmessage!:(event:{data:ClockSheet})=>void;
    constructor(){worker=this;}
    deliver(index:number){
      const input=this.postMessage.mock.calls[index]![0] as ClockHour;
      const bitmap={close:vi.fn()};
      this.onmessage({data:{...input,bitmap:bitmap as unknown as ImageBitmap,left:20,top:7,tileWidth:123,tileHeight:48}});
      return bitmap;
    }
  }
  vi.stubGlobal('Worker',LocalWorker);vi.stubGlobal('OffscreenCanvas',class {});
  const ctx={save:vi.fn(),restore:vi.fn(),scale:vi.fn(),strokeText:vi.fn(),fillText:vi.fn(),drawImage:vi.fn(),clearRect:vi.fn(),getImageData:()=>({data:new Uint8ClampedArray(4)})};
  const raster=new NativeClockRaster();
  const draw=(minute:number,date='A',width=560)=>raster.draw(ctx as unknown as CanvasRenderingContext2D,width,134,minute,date);
  draw(52);draw(53);expect(worker!.postMessage).toHaveBeenCalledTimes(1);
  expect(ctx.fillText).toHaveBeenCalledWith('00h53',193,19);
  const first=worker!.deliver(0);expect(ctx.drawImage).not.toHaveBeenCalled();
  draw(59);expect(ctx.drawImage.mock.calls[0]?.[0]).toBe(first);
  draw(60);draw(59);
  const abandoned=worker!.deliver(1);expect(abandoned.close).toHaveBeenCalledOnce();
  expect(worker!.postMessage).toHaveBeenCalledTimes(2);
  draw(59,'B');draw(59,'B',400);
  expect(worker!.deliver(2).close).toHaveBeenCalledOnce();
  expect(worker!.postMessage).toHaveBeenCalledTimes(4);
  const active=worker!.deliver(3);
  expect(first.close).toHaveBeenCalledOnce();expect(active.close).not.toHaveBeenCalled();
  draw(59,'B',400);expect(ctx.drawImage.mock.calls.at(-1)?.[0]).toBe(active);
  draw(60,'B',400);raster.dispose();
  expect(worker!.deliver(4).close).toHaveBeenCalledOnce();
  expect(active.close).toHaveBeenCalledOnce();expect(worker!.terminate).toHaveBeenCalledOnce();
});

it('keeps the local clock on screen and closes a sheet whose raster differs on the current device',()=>{
  const terminate=vi.fn(),close=vi.fn();
  let deliver!:(()=>void);
  class DifferentWorker {
    onmessage!:(event:{data:ClockSheet})=>void;
    terminate=terminate;
    postMessage(hour:ClockHour){
      deliver=()=>this.onmessage({data:{...hour,bitmap:{close} as unknown as ImageBitmap,left:1,top:1,tileWidth:2,tileHeight:2}});
    }
  }
  vi.stubGlobal('Worker',DifferentWorker);vi.stubGlobal('OffscreenCanvas',class {});
  const ctx={save:vi.fn(),restore:vi.fn(),scale:vi.fn(),fillText:vi.fn(),strokeText:vi.fn(),drawImage:vi.fn(),clearRect:vi.fn(),
    getImageData:vi.fn().mockReturnValueOnce({data:Uint8ClampedArray.of(0,0,0,2)}).mockReturnValueOnce({data:Uint8ClampedArray.of(0,0,0,1)})};
  const raster=new NativeClockRaster(),draw=(minute:number,running=true)=>raster.draw(ctx as unknown as CanvasRenderingContext2D,560,134,minute,'A',running);
  draw(12,false);expect(deliver).toBeUndefined();
  draw(13);deliver();
  draw(14);expect(ctx.fillText).toHaveBeenCalledWith('00h14',193,19);
  expect(terminate).toHaveBeenCalledOnce();expect(close).toHaveBeenCalledOnce();
  const copies=ctx.drawImage.mock.calls.length;draw(15);
  expect(ctx.drawImage).toHaveBeenCalledTimes(copies);
  expect(ctx.fillText).toHaveBeenCalledWith('00h15',193,19);
});
