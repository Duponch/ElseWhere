import {describe,expect,it,vi} from 'vitest';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {NativePageBox} from '../src/ui3d/native-layout';

// Exercise the real window ownership, layout and input methods, without a GPU.
// Only the cardboard piece factory and unrelated base-view painting are doubled.
interface StageAccess {
  page:NativePage|null;pageBox:NativePageBox;lastPointer:{x:number;y:number};floatMenu?:{page:NativePage;box:NativePageBox;controls:Array<{piece:unknown;control:NativeControl}>;pieces:unknown[];opacity:number;scroll:number;focus?:string};
  showPage(page:NativePage|null):void;showFloatMenu(page:NativePage):void;hideFloatMenu(page?:NativePage):void;
  isFloatMenuCurrent(page:NativePage):boolean;floatMenuOutside(event:PointerEvent):boolean;
  keyDown(event:KeyboardEvent):void;pointerDown(event:PointerEvent):void;pointerUp(event:PointerEvent):void;
  dismissedPointer?:number;hit:ReturnType<typeof vi.fn>;
}
function fixture(){
  const inspector:NativePage={id:'inspect-pawn-8-bio',title:'Ada',layout:'inspector',rows:[]},
    baseBox={x:12,y:450,width:432,height:165} as NativePageBox;
  const close=vi.fn(),escape=vi.fn(),activate=vi.fn(),rebuildPage=vi.fn(),art={createPiece:vi.fn(()=>({userData:{interactiveMeshes:[]},traverse:vi.fn(),scale:{setScalar:vi.fn()},setBaseTransform:vi.fn()}))};
  const stage=Object.assign(Object.create(NativeStage.prototype),{
    closed:false,worldVisible:true,frontVisible:false,page:inspector,pageBox:baseBox,displayScale:1,
    width:1000,height:720,visH:5,uiScale:1,sceneRevision:0,activationSerial:0,lastPointer:{x:300,y:200},regionOffsets:{navigation:0,details:0,graph:0},
    art,hudRoot:{add:vi.fn()},highlight:{invalidate:vi.fn()},toolsDock:{children:[]},hits:new Map(),moving:new Set(),
    options:{onError:(e:string)=>{throw Error(e);},onEscape:escape},measure:(s:string,n:number)=>s.length*n*.5,
    unregister:vi.fn(),clearHint:vi.fn(),updateHint:vi.fn(),hover:vi.fn(),closeDropdown:vi.fn(),cancelPress:vi.fn(),
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
  it('recomputes distance when an async reply replaces the menu while the pointer stays still',()=>{
    const f=fixture();f.stage.showFloatMenu(f.loading);const box=f.stage.floatMenu!.box;
    f.stage.lastPointer={x:box.x-5-47.5,y:box.y+10};f.stage.showFloatMenu(f.ready);
    expect(f.stage.floatMenu!.opacity).toBe(.5);
    f.stage.lastPointer.x=box.x-5-96;f.stage.showFloatMenu({...f.ready});
    expect(f.stage.floatMenu).toBeUndefined();expect(f.close).toHaveBeenCalledOnce();expect(f.stage.page).toBe(f.inspector);
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
  it('retains the shown tooltip and its delay state when the same region is clicked, in both layers',()=>{
    for(const floating of [true,false]){
      const f=fixture();f.stage.showFloatMenu(f.ready);
      const hit=f.stage.floatMenu!.controls[0]!,box=f.stage.floatMenu!.box;
      (hit.piece as {userData:Record<string,unknown>}).userData.tooltip='Prioriser : Miner';
      if(!floating)f.stage.hideFloatMenu();
      const clearHint=vi.fn(),placeHint=vi.fn(),tip={name:'shown tip'},timer={name:'unchanged timer'};
      const real=NativeStage.prototype as unknown as {updateHint:(hit:unknown,x:number,y:number)=>void};
      Object.assign(f.stage,{updateHint:real.updateHint,hintOwner:hit.piece,hintHit:hit,hintText:'Prioriser : Miner',hintPiece:tip,hintTimer:timer,clearHint,placeHint,
        globeHit:()=>null,cameraWorldPoint:()=>undefined,pageContains:()=>true,belongsToPage:()=>!floating});
      f.stage.hit.mockReturnValue(hit);
      const event=pointer(box.x+15,box.y+box.header+8);f.stage.pointerDown(event);f.stage.pointerUp(event);
      const state=f.stage as unknown as {hintPiece:unknown;hintTimer:unknown};
      expect(clearHint).not.toHaveBeenCalled();expect(placeHint).toHaveBeenCalledOnce();
      expect(state.hintPiece).toBe(tip);expect(state.hintTimer).toBe(timer);expect(f.activate).toHaveBeenCalledOnce();
    }
  });
  it('refreshes a changed tooltip on click without restarting its hover delay',()=>{
    const f=fixture();f.stage.showFloatMenu(f.ready);const hit=f.stage.floatMenu!.controls[0]!,box=f.stage.floatMenu!.box;
    const clearHint=vi.fn(),showHint=vi.fn(),timer={name:'preserved'},tip={name:'visible'};
    (hit.piece as {userData:Record<string,unknown>}).userData.tooltip='Valeur actuelle';
    const real=NativeStage.prototype as unknown as {updateHint:(hit:unknown,x:number,y:number)=>void};
    Object.assign(f.stage,{updateHint:real.updateHint,hintOwner:hit.piece,hintHit:hit,hintText:'Ancienne valeur',hintPiece:tip,hintTimer:timer,clearHint,showHint,placeHint:vi.fn()});
    f.stage.hit.mockReturnValue(hit);f.stage.pointerDown(pointer(box.x+15,box.y+box.header+8));
    const state=f.stage as unknown as {hintText:string;hintTimer:unknown};
    expect(clearHint).not.toHaveBeenCalled();expect(showHint).toHaveBeenCalledOnce();expect(state.hintText).toBe('Valeur actuelle');expect(state.hintTimer).toBe(timer);
  });
});
