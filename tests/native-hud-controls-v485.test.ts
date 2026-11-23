import {afterEach,describe,expect,it,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {NativeHudCards,nativeHudAlertColor} from '../src/ui3d/native-hud';
import {PALETTE,PrototypeCardboardArt,type CardboardPiece} from '../src/ui3d/prototype-art';
import type {StatusAlert} from '../src/ui/status-alerts';

function fixture(){
  const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash']);
  vi.stubGlobal('document',{createElement:(tag:string)=>{
    if(tag!=='canvas')throw Error(`Unexpected native element ${tag}`);
    const state=new Map<PropertyKey,unknown>(),stack:Array<Map<PropertyKey,unknown>>=[];
    const ctx=new Proxy({}, {get(_target,key){
      if(key==='measureText')return (text:string)=>({width:text.length*7});
      if(typeof key==='string'&&methods.has(key))return()=>{if(key==='save')stack.push(new Map(state));if(key==='restore'){state.clear();for(const[k,v]of stack.pop()??[])state.set(k,v);}};
      return state.get(key);
    },set(_target,key,value){state.set(key,value);return true;}});
    return {width:0,height:0,getContext:()=>ctx};
  }});
  const art=new PrototypeCardboardArt(),root=new THREE.Group(),view=vi.fn(),showPage=vi.fn();
  const anchors={topCenter:new THREE.Group(),topLeft:new THREE.Group(),topRight:new THREE.Group(),bottomRight:new THREE.Group()};root.add(...Object.values(anchors));
  const hud=new NativeHudCards(art,anchors,{selectPawn:vi.fn(),speed:vi.fn(),showPage,view});
  const piece=(id:string):CardboardPiece=>{let found:CardboardPiece|undefined;root.traverse(object=>{if(object.userData.nativeId===id)found=object as CardboardPiece;});if(!found)throw Error(`Missing ${id}`);return found;};
  type TestAlert=StatusAlert&{domain?:{severity:'info'|'warning'|'danger'}};
  const access=hud as unknown as {alerts:TestAlert[];refreshAlerts():void};
  const alerts=(rows:TestAlert[])=>{access.alerts=rows;access.refreshAlerts();};
  return {hud,art,root,piece,alerts,view,showPage,close:()=>{hud.dispose();art.dispose();}};
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('native HUD bounds and severity · V485',()=>{
  it('keeps the cut weather drawing inside its common painted frame and preserves its details action',()=>{
    const f=fixture();try{
      // Core GlobalControls: the weather icon sits in the 26-high weather row, inside the 222 visible px.
      const frame=f.piece('hud:weather-label'),weather=f.piece('hud:weather'),bounds=(piece:CardboardPiece)=>({left:piece.position.x-piece.userData.w/2,right:piece.position.x+piece.userData.w/2,bottom:piece.position.y-piece.userData.h/2,top:piece.position.y+piece.userData.h/2});
      const panel=bounds(frame),icon=bounds(weather);
      expect(icon.left-panel.left).toBeGreaterThan(0);expect(panel.right-icon.right).toBeGreaterThan(.1);
      expect(icon.bottom-panel.bottom).toBeGreaterThan(0);expect(panel.top-icon.top).toBeGreaterThan(0);
      weather.userData.onClick?.();expect(f.showPage.mock.lastCall?.[0].id).toBe('hud-site');expect(f.piece('hud:weather')).toBe(weather);
      expect(weather.userData.texture).toBeDefined();
    }finally{f.close();}
  });

  it('aligns both command rows to the same edges while keeping a separate gap and direct actions',()=>{
    const f=fixture();try{
      const speeds=[0,1,3,6].map(speed=>f.piece(`hud:speed:${speed}`)),views=['walls','roofs','foliage','zones','home','camera'].map(action=>f.piece(`hud:view:${action}`));
      // GlobalControlsUtility: speed buttons 32 × 24 in one strip, display
      // buttons 24 × 24 five to a row (the sixth wraps upward), 4 between rows.
      const px=(value:number)=>Math.round(value*100);
      for(const speed of speeds){expect(px(speed.userData.w)).toBe(32);expect(px(speed.userData.h)).toBe(24);}
      for(const view of views){expect(px(view.userData.w)).toBe(24);expect(px(view.userData.h)).toBe(24);}
      expect(speeds.map(speed=>px(speed.position.x))).toEqual([-118,-86,-54,-22]);
      expect(px(views[1]!.position.x-views[0]!.position.x)).toBe(-26);expect(px(views[5]!.position.x)).toBe(px(views[0]!.position.x));
      expect(px(views[5]!.position.y-views[0]!.position.y)).toBe(26);
      const lowerSpeed=speeds[0]!.position.y-speeds[0]!.userData.h/2,upperView=views[5]!.position.y+views[5]!.userData.h/2;
      expect(px(lowerSpeed-upperView)).toBe(4);
      const date=f.piece('hud:clock'),weather=f.piece('hud:weather-label'),temperature=f.piece('hud:temperature');
      expect([px(date.userData.w),px(date.userData.h)]).toEqual([200,48]);expect(px(weather.userData.h)).toBe(26);expect(px(temperature.userData.h)).toBe(26);
      expect(date.position.y).toBeLessThan(weather.position.y);expect(weather.position.y).toBeLessThan(temperature.position.y);expect(speeds[0]!.position.y).toBeLessThan(date.position.y);
      for(const button of views)button.userData.onClick?.();expect(f.view.mock.calls.map(call=>call[0])).toEqual(['walls','roofs','foliage','zones','home','camera']);
      const before=views.map(piece=>piece.position.toArray());f.hud.setViewport(720,450,.01);expect(views.map(piece=>piece.position.toArray())).toEqual(before);
    }finally{f.close();}
  });

  it('uses semantic urgency while keeping neutral and explicitly resolved incident cards neutral',()=>{
    // Alerts lot A: colour follows the explicit Core priority (Critical red,
    // High ochre, Medium plain) instead of the former key regexes.
    for(const key of ['research-project','domain:visitors','pending-jobs','party','idle','hungry','infection','need-meal-source'])expect(nativeHudAlertColor({key})).toBe(PALETTE.creamPaper);
    for(const key of ['food-reserves','mood-risk-minor','bleeding','turret-wick:12','campaign:42:raid:8','need-warden','colonist-unburied'])expect(nativeHudAlertColor({key})).toBe(PALETTE.ochre);
    for(const key of ['life-threatening','downed','fire','hypothermia','mood-risk-high'])expect(nativeHudAlertColor({key})).toBe(PALETTE.terracotta);
    expect(nativeHudAlertColor({key:'domain:raid-last:7',domain:{severity:'info'}})).toBe(PALETTE.creamPaper);
    expect(nativeHudAlertColor({key:'domain:condition',domain:{severity:'warning'}})).toBe(PALETTE.ochre);
  });

  it('changes the actual painted background without reallocating the card and leaves unchanged records idle',()=>{
    const f=fixture();try{
      const row={key:'notice',text:'Message court',targets:[]};f.alerts([row]);
      const card=f.piece('hud:alert:notice'),geometry=card.userData.mesh.geometry,texture=card.userData.texture,version=texture.version,revision=f.art.revision;
      expect(card.userData.bgColor).toBe(PALETTE.creamPaper);f.alerts([row]);expect(f.art.revision).toBe(revision);
      f.alerts([{...row,domain:{severity:'warning'}}]);expect(f.piece('hud:alert:notice')).toBe(card);expect(card.userData.bgColor).toBe(PALETTE.ochre);
      f.alerts([{...row,domain:{severity:'danger'}}]);expect(card.userData.bgColor).toBe(PALETTE.terracotta);expect(card.userData.texture).toBe(texture);expect(card.userData.mesh.geometry).toBe(geometry);expect(texture.version).toBe(version+2);
      const settled=f.art.revision;f.alerts([{...row,domain:{severity:'danger'}}]);expect(f.art.revision).toBe(settled);
      f.alerts([row]);expect(card.userData.bgColor).toBe(PALETTE.creamPaper);
    }finally{f.close();}
  });

  it('lifts the whole right dock above an overlapping window and restores the exact resting layout',()=>{
    const f=fixture();try{
      f.hud.setViewport(1440,1000,.01,96,500);
      const weather=f.piece('hud:clock'),group=weather.parent!,initialY=group.position.y,texture=weather.userData.texture,revision=f.art.revision;
      const window={x:12,y:432,width:1180,height:476};expect(f.hud.setWindowBounds(window)).toBe(true);
      const budget=f.hud.getWindowLayoutBudget(),top=1000-group.position.y*100-budget.height-4;
      expect(budget.mode).toBe('above-window');expect(budget.visible).toBe(true);expect(top).toBeGreaterThanOrEqual(budget.minimumTop);expect(top+budget.height).toBeLessThanOrEqual(window.y-10);
      expect(f.hud.setWindowBounds(window)).toBe(false);expect(weather.userData.texture).toBe(texture);expect(f.art.revision).toBe(revision);
      expect(f.hud.setWindowBounds(null)).toBe(true);expect(group.position.y).toBe(initialY);expect(f.hud.getWindowLayoutBudget()).toMatchObject({mode:'normal',visible:true,shiftPx:0});
    }finally{f.close();}
  });

  it('leaves the right dock in place when a wide window reserves its complete lane',()=>{
    const f=fixture();try{
      f.hud.setViewport(1440,1000,.01,96,500);const budget=f.hud.getWindowLayoutBudget(),weather=f.piece('hud:clock'),initialY=weather.parent!.position.y;
      expect(f.hud.setWindowBounds({x:12,y:188,width:1440-budget.rightReserve-12,height:720})).toBe(false);
      expect(weather.parent!.position.y).toBe(initialY);expect(f.hud.getWindowLayoutBudget()).toMatchObject({mode:'normal',visible:true,shiftPx:0});
    }finally{f.close();}
  });

  it('hides one complete assembly in a narrow obstructed viewport, with no per-card disappearance',()=>{
    const f=fixture();try{
      f.hud.setViewport(480,400,.01,96,60);const weather=f.piece('hud:clock'),group=weather.parent!,initialY=group.position.y;
      const pieces=['hud:clock','hud:weather','hud:speed:0','hud:speed:1','hud:speed:3','hud:speed:6','hud:view:walls','hud:view:camera'].map(f.piece);
      expect(f.hud.setWindowBounds({x:12,y:50,width:456,height:250})).toBe(true);expect(f.hud.getWindowLayoutBudget()).toMatchObject({mode:'hidden-window-space',visible:false});expect(group.visible).toBe(false);
      for(const piece of pieces){expect(piece.parent).toBe(group);expect(piece.visible).toBe(true);}
      expect(group.position.y).toBe(initialY);expect(f.hud.setWindowBounds({x:12,y:50,width:456,height:250})).toBe(false);
      expect(f.hud.setWindowBounds(null)).toBe(true);expect(f.hud.getWindowLayoutBudget()).toMatchObject({mode:'normal',visible:true,shiftPx:0});
    }finally{f.close();}
  });
});
