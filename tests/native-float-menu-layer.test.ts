import {describe,expect,it,vi} from 'vitest';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {NativePageBox} from '../src/ui3d/native-layout';

// Exercise the real window ownership, layout and input methods, without a GPU.
// Only the cardboard piece factory and unrelated base-view painting are doubled.
interface StageAccess {
  page:NativePage|null;pageBox:NativePageBox;floatMenu?:{page:NativePage;box:NativePageBox;controls:Array<{piece:unknown;control:NativeControl}>;pieces:unknown[];scroll:number;focus?:string};
  showPage(page:NativePage|null):void;showFloatMenu(page:NativePage):void;hideFloatMenu(page?:NativePage):void;
  isFloatMenuCurrent(page:NativePage):boolean;floatMenuOutside(event:PointerEvent):boolean;
  keyDown(event:KeyboardEvent):void;pointerDown(event:PointerEvent):void;pointerUp(event:PointerEvent):void;
  dismissedPointer?:number;hit:ReturnType<typeof vi.fn>;
}
function fixture(){
  const inspector:NativePage={id:'inspect-pawn-8-bio',title:'Ada',layout:'inspector',rows:[]},
    baseBox={x:12,y:450,width:432,height:165} as NativePageBox;
  const close=vi.fn(),escape=vi.fn(),activate=vi.fn(),rebuildPage=vi.fn(),art={createPiece:vi.fn(()=>({userData:{interactiveMeshes:[]},scale:{setScalar:vi.fn()},setBaseTransform:vi.fn()}))};
  const stage=Object.assign(Object.create(NativeStage.prototype),{
    closed:false,worldVisible:true,frontVisible:false,page:inspector,pageBox:baseBox,displayScale:1,
    width:1000,height:720,visH:5,uiScale:1,sceneRevision:0,activationSerial:0,regionOffsets:{navigation:0,details:0,graph:0},
    art,hudRoot:{add:vi.fn()},highlight:{invalidate:vi.fn()},toolsDock:{children:[]},hits:new Map(),moving:new Set(),
    options:{onError:(e:string)=>{throw Error(e);},onEscape:escape},measure:(s:string,n:number)=>s.length*n*.5,
    unregister:vi.fn(),clearHint:vi.fn(),hover:vi.fn(),closeDropdown:vi.fn(),cancelPress:vi.fn(),
    rebuildPage,layoutToolsDock:vi.fn(),refreshWorldReadout:vi.fn(),updateWorldReadoutVisibility:vi.fn(),
    invalidate:vi.fn(),hit:vi.fn(),activate,gesture:vi.fn(),setPointerOverUi:vi.fn(),
  }) as StageAccess;
  const action=vi.fn();
  const loading:NativePage={id:'native-orders',title:'Ada',rows:[{id:'message',label:'Vérification des accès…'}],floatMenu:{x:300,y:200},onClose:close};
  const ready:NativePage={...loading,rows:[{id:'order',label:'Prioriser : Miner',controls:[{id:'mine-option',label:'Prioriser : Miner',onActivate:action}]}]};
  return {stage,inspector,baseBox,close,escape,activate,rebuildPage,art,loading,ready,action};
}
const pointer=(x:number,y:number,button=0)=>({clientX:x,clientY:y,button,pointerId:12,target:null,
  preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()}) as unknown as PointerEvent;
const key=(key:string)=>({key,target:null,repeat:false,shiftKey:false,preventDefault:vi.fn(),stopImmediatePropagation:vi.fn()}) as unknown as KeyboardEvent;

describe('the orders layer is independent of the inspect pane',()=>{
  it('replaces a pending menu with its options without repainting, retiring or moving the inspect pane',()=>{
    const f=fixture();f.stage.showFloatMenu(f.loading);
    expect(f.stage.page).toBe(f.inspector);expect(f.stage.pageBox).toBe(f.baseBox);
    expect(f.stage.floatMenu?.controls[0]?.control.disabled).toBe(true);
    f.stage.showFloatMenu(f.ready);
    expect(f.stage.isFloatMenuCurrent(f.ready)).toBe(true);
    expect(f.stage.floatMenu?.controls.map(hit=>hit.control.label)).toEqual(['Prioriser : Miner']);
    expect(f.close).not.toHaveBeenCalled();expect(f.rebuildPage).not.toHaveBeenCalled();
    const painted=f.art.createPiece.mock.calls.length;
    f.stage.hideFloatMenu(f.loading);expect(f.stage.isFloatMenuCurrent(f.ready)).toBe(true);
    f.stage.showPage({...f.inspector,title:'Ada, nouvelle information'});
    expect(f.stage.isFloatMenuCurrent(f.ready)).toBe(true);
    expect(f.art.createPiece.mock.calls.length).toBe(painted);
    expect(f.stage.page?.id).toBe(f.inspector.id);expect(f.stage.pageBox).toBe(f.baseBox);
  });
  it('consumes an outside click and Escape while retaining the ordinary page and its owner',()=>{
    for(const mode of ['outside','escape'] as const){
      const f=fixture();f.stage.showFloatMenu(f.ready);
      if(mode==='outside'){expect(f.stage.floatMenuOutside(pointer(20,520))).toBe(true);expect(f.stage.dismissedPointer).toBe(12);}
      else{const event=key('Escape');f.stage.keyDown(event);expect(event.preventDefault).toHaveBeenCalledOnce();}
      expect(f.stage.floatMenu).toBeUndefined();expect(f.close).toHaveBeenCalledOnce();
      expect(f.escape).not.toHaveBeenCalled();expect(f.stage.page).toBe(f.inspector);expect(f.stage.pageBox).toBe(f.baseBox);
    }
  });
  it('closes only the float menu when a different base/modal window is opened',()=>{
    const f=fixture();f.stage.showFloatMenu(f.ready);
    const modal:NativePage={id:'confirmation',title:'Confirmation',modal:true,rows:[]};
    f.stage.showPage(modal);expect(f.stage.page).toBe(modal);
    expect(f.stage.floatMenu).toBeUndefined();expect(f.close).toHaveBeenCalledOnce();expect(f.escape).not.toHaveBeenCalled();
  });
  it('keyboard navigation and confirmation act on the float option, not the inspected pawn',()=>{
    const f=fixture();f.stage.showFloatMenu(f.ready);
    f.stage.keyDown(key('Tab'));expect(f.stage.floatMenu?.focus).toBe('mine-option');
    f.stage.keyDown(key('Enter'));expect(f.activate).toHaveBeenCalledOnce();
    expect(f.activate.mock.calls[0]?.[0]?.control?.id).toBe('mine-option');
    expect(f.stage.page).toBe(f.inspector);expect(f.escape).not.toHaveBeenCalled();
  });
  it('an option click is consumed by the menu layer without dismissing the colonist',()=>{
    const f=fixture();f.stage.showFloatMenu(f.ready);
    const box=f.stage.floatMenu!.box,event=pointer(box.x+15,box.y+box.header+8);
    f.stage.hit.mockReturnValue(f.stage.floatMenu!.controls[0]);
    f.stage.pointerDown(event);f.stage.pointerUp(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(f.activate).toHaveBeenCalledOnce();expect(f.stage.page).toBe(f.inspector);
    expect(f.escape).not.toHaveBeenCalled();
  });
});
