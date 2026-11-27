import {describe,it,expect,vi,afterEach} from 'vitest';
import {NativeStage} from '../src/ui3d/NativeStage';
import {cardScroll,resetCardScroll,type NativeTabCard} from '../src/ui3d/native-tab-card';

describe('nested inspector card wheel ownership',()=>{
  afterEach(resetCardScroll);
  it('consumes motion inside its scroll range and leaves its ends to the outer page',()=>{
    const card:NativeTabCard={width:200,height:160,items:[],targets:[],regions:[{id:'list',x:0,y:0,w:200,h:100,contentHeight:240}]};
    const stage=Object.assign(Object.create(NativeStage.prototype),{pageBox:{layout:'inspector',rows:[{card}]},height:650,hover:vi.fn(),rebuildPage:vi.fn(),invalidate:vi.fn()}) as {wheelCardRegion:(hit:unknown,event:unknown)=>boolean;rebuildPage:ReturnType<typeof vi.fn>};
    const hit={piece:{userData:{cardRegion:'list'}}},event=(deltaY:number)=>({deltaMode:0,deltaY,deltaX:0,shiftKey:false});
    expect(stage.wheelCardRegion(hit,event(-30))).toBe(false);
    expect(stage.wheelCardRegion(hit,event(80))).toBe(true);expect(cardScroll('list')).toBe(80);
    expect(stage.wheelCardRegion(hit,event(1000))).toBe(true);expect(cardScroll('list')).toBe(140);
    expect(stage.wheelCardRegion(hit,event(30))).toBe(false);expect(stage.rebuildPage).toHaveBeenCalledTimes(2);
    expect(stage.wheelCardRegion(hit,event(-20))).toBe(true);expect(cardScroll('list')).toBe(120);
    resetCardScroll();card.regions[0]!.contentHeight=50;
    expect(stage.wheelCardRegion(hit,event(30))).toBe(false);
  });
});
