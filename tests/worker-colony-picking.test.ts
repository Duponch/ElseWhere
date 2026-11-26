import {afterEach,expect,it,vi} from 'vitest';
import {PickOverlay} from '../src/render/worker-scene/pick-overlay';
import {WorkerColonyClient} from '../src/render/worker-scene/client';
import type {PickImage} from '../src/render/worker-scene/protocol';
import {WorkerColonyScene} from '../src/render/worker-scene/scene';

afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

it('reads first-click actor priority and object/terrain hits from the displayed World at CSS coordinates',()=>{
  const world={tick:33,width:8,height:8,wildlife:{animals:[{id:12}]},mechanoids:[],structures:[{id:8,kind:'wall',x:2,z:2}],
    resources:[],packed:[],piles:[],jobs:[],tiles:Array.from({length:64},()=>({terrain:'soil'})),stockpiles:[],growingZones:[]};
  const actors=vi.fn(()=>[{id:12,x:50,y:20,depth:.1,radius:4,category:2},{id:7,x:50,y:20,depth:.8,radius:4,category:0}]);
  const shape=vi.fn(()=>({cell:{x:2,z:2},preferred:{kind:'structure',id:8}}));
  const h={world,ready:true,hasTracks:true,timeline:{tick:33.7},submissions:7,screenPawns:actors,
    wallAttachmentCellAt:vi.fn(()=>null),objectPickAt:shape,captureGraphicsView:()=>({mode:'iso',zoom:1,position:[0,8,0],target:[0,0,0]})};
  const read=(u:number)=>WorkerColonyScene.prototype.readPick.call(h as unknown as WorkerColonyScene,u,.25,{width:100,height:80,pixelRatio:3});
  expect(read(.5)).toMatchObject({frame:7,tick:33,presentationTick:33.7,target:{kind:'pawn',id:7}});expect(shape).not.toHaveBeenCalled();
  expect(read(.1).target).toEqual({kind:'structure',id:8,x:2,z:2});expect(shape).toHaveBeenCalledWith(10,20);
  h.wallAttachmentCellAt.mockReturnValue({x:6,z:6} as never);
  expect(read(.1).target).toEqual({kind:'terrain',x:6,z:6});
});

function viewer(){
  vi.useFakeTimers();
  const frames:FrameRequestCallback[]=[],close=vi.fn(),draw=vi.fn(),remove=vi.fn();
  const host={rect:{left:20,top:10,width:100,height:80},hidden:false};
  vi.stubGlobal('window',{setTimeout,clearTimeout,devicePixelRatio:3});
  vi.stubGlobal('document',{get hidden(){return host.hidden;},createElement:()=>({style:{},getContext:()=>({drawImage:draw}),remove})});
  vi.stubGlobal('requestAnimationFrame',(c:FrameRequestCallback)=>frames.push(c));
  let deliver!:(r:PickImage)=>void;
  const client={pick:vi.fn(()=>new Promise<PickImage>(r=>{deliver=r;})),cancelPick:vi.fn()};
  const canvas={getBoundingClientRect:()=>({...host.rect}),clientWidth:100,clientHeight:80,matches:()=>true,parentElement:{append:vi.fn()}},
    result={dataset:new Proxy({} as Record<string,string>,{set:(object,key,value)=>Reflect.set(object,key,String(value))}),textContent:''},
    confirm={hidden:true,onclick:()=>{}},cancel={hidden:true,onclick:()=>{}};
  const view=new PickOverlay(canvas as unknown as HTMLCanvasElement,client as unknown as WorkerColonyClient,
    result as unknown as HTMLElement,confirm as unknown as HTMLButtonElement,cancel as unknown as HTMLButtonElement);
  const arrive=async()=>{
    deliver({bitmap:{width:180,height:144,close} as unknown as ImageBitmap,pick:{frame:43,tick:335,presentationTick:335.3,map:0,
      camera:{position:[1,2,3],target:[0,0,0],mode:'iso',zoom:2},viewport:{width:100,height:80,pixelRatio:3},u:.5,v:.5,target:{kind:'structure',id:72,x:45,z:46}}});
    await Promise.resolve();await Promise.resolve();
  };
  return {view,host,canvas,result,confirm,cancel,close,draw,client,arrive,paint:()=>{frames.shift()?.(0);frames.shift()?.(16);}};
}

it('waits for explicit confirmation when release precedes display and keeps the source tick and target',async()=>{
  const t=viewer();t.view.begin(70,50);t.view.end(70,50);await t.arrive();
  expect(t.client.pick).toHaveBeenCalledWith(.5,.5);expect(t.draw).toHaveBeenCalledOnce();expect(t.close).toHaveBeenCalledOnce();
  expect(t.confirm.hidden).toBe(true);expect(t.result.dataset.frame).toBeUndefined();
  t.paint();expect(t.confirm.hidden).toBe(false);t.confirm.onclick();
  expect(t.result.dataset).toMatchObject({frame:'43',tick:'335',kind:'structure',id:'72'});
  expect(t.view.pinned).toBe(false);
});

it('a held click commits only the same rendered physical pixel, even with capped HiDPI scaling',async()=>{
  const t=viewer();t.view.begin(70,50);await t.arrive();t.paint();t.view.end(71,50);
  expect(t.result.dataset.frame).toBeUndefined();expect(t.confirm.hidden).toBe(false);
  t.cancel.onclick();t.view.begin(70,50);await t.arrive();t.paint();t.view.end(70,50);
  expect(t.result.dataset.kind).toBe('structure');
});

it('disposes late bitmaps and refuses stale size, hidden view, cancelled and expired confirmations',async()=>{
  const t=viewer();t.view.begin(70,50);t.view.clear();await t.arrive();expect(t.close).toHaveBeenCalledOnce();expect(t.draw).not.toHaveBeenCalled();
  t.view.begin(70,50);await t.arrive();t.paint();t.view.end(71,50);t.host.rect.width++;t.confirm.onclick();
  expect(t.view.pinned).toBe(false);expect(t.result.dataset.frame).toBeUndefined();
  t.host.rect.width--;t.view.begin(70,50);await t.arrive();t.host.hidden=true;t.paint();expect(t.view.pinned).toBe(false);
  t.host.hidden=false;t.view.begin(70,50);await t.arrive();t.paint();t.view.end(71,50);vi.advanceTimersByTime(12001);
  t.confirm.onclick();expect(t.view.pinned).toBe(false);expect(t.result.dataset.frame).toBeUndefined();expect(t.close).toHaveBeenCalledTimes(4);
});

it('a camera change, a timed-out request and a closed Worker cannot redeem an older bitmap',async()=>{
  vi.useFakeTimers();vi.stubGlobal('document',{hidden:false});vi.stubGlobal('window',{setTimeout,clearTimeout,devicePixelRatio:1});
  vi.stubGlobal('navigator',{gpu:{}});
  let port!:MockWorker;
  class MockWorker {
    constructor(){port=this;}
    onmessage!:(event:{data:unknown})=>void;
    postMessage=vi.fn();terminate=vi.fn();
    reply(data:unknown){this.onmessage({data});}
  }
  vi.stubGlobal('Worker',MockWorker);
  const canvas={clientWidth:100,clientHeight:80,transferControlToOffscreen:()=>({})};
  const client=new WorkerColonyClient(canvas as unknown as HTMLCanvasElement,{onState:vi.fn(),onError:vi.fn()});
  const opening=client.open({} as File);port.reply({type:'ready'});await opening;
  const old=client.pick(.5,.5).catch(error=>error),oldId=port.postMessage.mock.lastCall![0].id;
  client.camera({orbit:.1});expect(await old).toBeInstanceOf(Error);
  const fresh=client.pick(.6,.5).catch(error=>error),id=port.postMessage.mock.lastCall![0].id;
  const close=vi.fn();port.reply({type:'pick-image',id:oldId,bitmap:{close}});expect(close).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(4001);expect(await fresh).toBeInstanceOf(Error);port.reply({type:'pick-image',id,bitmap:{close}});
  client.dispose();port.reply({type:'pick-image',id,bitmap:{close}});expect(close).toHaveBeenCalledTimes(3);
});
