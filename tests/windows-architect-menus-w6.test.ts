import {describe,expect,it} from 'vitest';
import {ARCHITECT_WINDOW,FLOAT_MENU,TOOLTIP_BOX,architectCategoryRect,architectWindowHeight,floatMenuOptionSize,floatMenuOrigin,layoutFloatMenu,tooltipBoxSize} from '../src/ui3d/native-float-menu';
import {flowNativeControls,layoutNativePage} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

// Rectangles of Core's Architect window, float menu and tooltip (decompiled
// MainTabWindow_Architect, ArchitectCategoryTab, GizmoGridDrawer, FloatMenu,
// FloatMenuOption, ActiveTip). Text is measured at 7 points per character.
const measure=(text:string)=>text.length*7;
const control=(id:string,label='x'):NativeControl=>({id,label,onActivate:()=>{}});

describe('Architect window (MainTabWindow_Architect, ArchitectCategoryTab, GizmoGridDrawer)',()=>{
  it('puts the categories in two columns of 32 in a 200 wide window',()=>{
    expect(architectWindowHeight(7)).toBe(4*32);expect(architectWindowHeight(8)).toBe(4*32);
    expect(architectCategoryRect(0)).toEqual({x:0,y:0,width:101,height:33});
    expect(architectCategoryRect(1)).toEqual({x:100,y:0,width:100,height:33});
    expect(architectCategoryRect(5)).toEqual({x:100,y:64,width:100,height:33});
    const flow=flowNativeControls(Array.from({length:7},(_,i)=>control('c'+i)),{x:0,y:0,width:200,height:0},measure,'navigation');
    expect(flow.height).toBe(128);expect(flow.controls.map(box=>[box.x,box.y,box.width,box.height]).slice(0,3)).toEqual([[0,0,101,33],[100,0,100,33],[0,32,101,33]]);
  });
  it('lays the designators out as 75 × 75 gizmos 5 apart, 14 between rows',()=>{
    const flow=flowNativeControls(Array.from({length:7},(_,i)=>control('t'+i)),{x:0,y:0,width:80*3-5,height:0},measure,'tile');
    expect(flow.controls.map(box=>[box.x,box.y,box.width,box.height])).toEqual([[0,0,75,75],[80,0,75,75],[160,0,75,75],[0,89,75,75],[80,89,75,75],[160,89,75,75],[0,178,75,75]]);
    expect(flow.height).toBe(3*89-14);
  });
  it('shows the Architect page as category window, 200 × 270 information box above it and the grid at 210',()=>{
    const categories=Array.from({length:8},(_,i)=>control('category-'+i,'Cat'+i)),tools=Array.from({length:30},(_,i)=>control('tool-'+i,'Outil'));
    const page:NativePage={id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows:[
      {id:'architect-categories',label:'',region:'navigation',controlStyle:'navigation',controls:categories},
      {id:'architect-tools',label:'',region:'catalogue',controlStyle:'tile',controls:tools},
      {id:'architect-selected',label:'Mur',region:'details',emphasis:'heading'}]};
    const box=layoutNativePage(page,{width:1600,height:1000},false,measure);
    const info=box.regions.details!,nav=box.regions.navigation!,grid=box.regions.catalogue!;
    expect([info.width,info.height]).toEqual([ARCHITECT_WINDOW.width,ARCHITECT_WINDOW.infoHeight]);
    expect(nav.width).toBe(ARCHITECT_WINDOW.width);expect(nav.y).toBeGreaterThanOrEqual(info.y+info.height);
    expect(grid.x-info.x).toBe(ARCHITECT_WINDOW.width+10);
    const row=box.rows.find(entry=>entry.row.id==='architect-categories')!;
    expect(row.controls.every(entry=>entry.height===33&&entry.width>=100&&entry.width<=101)).toBe(true);
    expect(box.rows.find(entry=>entry.row.id==='architect-tools')!.controls.every(entry=>entry.width===75&&entry.height===75)).toBe(true);
  });
  it('preserves a complete construction gizmo and scrollable categories at a reduced logical width',()=>{
    const page:NativePage={id:'architect',title:'Architecte',layout:'architect',rows:[
      {id:'categories',label:'',region:'navigation',controls:Array.from({length:9},(_,i)=>control('category-'+i)),controlStyle:'navigation'},
      {id:'tools',label:'',region:'catalogue',controls:Array.from({length:12},(_,i)=>control('tool-'+i)),controlStyle:'tile'},
      {id:'info',label:'Matériaux et réglages',region:'details',detail:'Description conservée'}]};
    const viewport={width:260,height:240},box=layoutNativePage(page,viewport,false,measure),grid=box.regions.catalogue!,nav=box.regions.navigation!,info=box.regions.details!;
    for(const region of Object.values(box.regions)){expect(region.x+region.width).toBeLessThanOrEqual(box.width);expect(region.y+region.height).toBeLessThanOrEqual(box.height);expect(region.height).toBeGreaterThan(0);}
    expect(grid.x-info.x).toBe(info.width+10);expect(nav.contentHeight).toBeGreaterThan(nav.height);
    expect(box.rows.find(row=>row.row.id==='tools')!.controls.every(c=>c.width===75&&c.x+c.width<=grid.x+grid.width)).toBe(true);
  });
});

describe('FloatMenu and FloatMenuOption',()=>{
  const size=(label:string,lines=1)=>floatMenuOptionSize(measure(label),lines);
  it('sizes an option from its text: 4 above and below, 6 and 4 beside',()=>{
    expect(size('Abc')).toEqual({width:6+4+21+6+4,height:30});
    expect(floatMenuOptionSize(100,2)).toEqual({width:120,height:52});
    expect(floatMenuOptionSize(100,1,true,18)).toEqual({width:3+4+100+3+4,height:20});
  });
  it('makes columns at least 70 and at most 300 wide, rows overlapping by one',()=>{
    const small=layoutFloatMenu([size('A'),size('B')],1280,720);
    expect(small.columnWidth).toBe(70);expect(small.columns).toBe(1);expect(small.scrolling).toBe(false);
    expect(small.placements.map(p=>[p.x,p.y,p.height])).toEqual([[0,0,30],[0,29,30]]);expect(small.height).toBe(29+29+1);
    const wide=layoutFloatMenu([size('x'.repeat(80),2)],1280,720);expect(wide.columnWidth).toBe(300);
    const mid=layoutFloatMenu([size('x'.repeat(20)),size('y'.repeat(10))],1280,720);expect(mid.columnWidth).toBe(Math.round(20*7+20));
  });
  it('starts a new column past 90 % of the screen height and scrolls only when the columns do not fit the width',()=>{
    const many=Array.from({length:30},()=>size('Option'));
    const cols=layoutFloatMenu(many,1280,400);
    expect(cols.columns).toBeGreaterThan(1);expect(cols.scrolling).toBe(false);
    expect(cols.placements.find(p=>p.x>0)!.x).toBe(cols.columnWidth-1);
    expect(Math.max(...cols.placements.map(p=>p.y+p.height))).toBeLessThanOrEqual(400*FLOAT_MENU.screenFraction+1);
    const narrow=layoutFloatMenu(many,100,400);
    expect(narrow.scrolling).toBe(true);expect(narrow.width).toBe(narrow.columns*narrow.columnWidth+FLOAT_MENU.scrollbar);
  });
  it('opens at the mouse plus (4, 0) and stays on the screen',()=>{
    expect(floatMenuOrigin(300,200,120,100,1280,720)).toEqual({x:304,y:200});
    expect(floatMenuOrigin(1270,710,120,100,1280,720)).toEqual({x:1160,y:620});
  });
  it('lays a float menu page out as one full-width option per row, the title above',()=>{
    const rows=[{id:'a',label:'Prioriser : Miner',controls:[control('a-go','Prioriser : Miner')]},{id:'b',label:'Aller ici',value:'Pas de chemin',controls:[{...control('b-go','Indisponible'),disabled:true}]},{id:'m',label:'Rien à faire'}];
    const page:NativePage={id:'native-orders',title:'Ada',rows,floatMenu:{x:300,y:200},width:4.6};
    const box=layoutNativePage(page,{width:1280,height:720},false,measure);
    expect(box.header).toBe(FLOAT_MENU.titleOffsetY);expect([box.x,box.y]).toEqual([304,200-box.header]);
    const options=box.rows.map(row=>row.controls[0]!);
    expect(options.map(option=>option.style)).toEqual(['option','option','option']);
    expect(options.map(option=>option.control.label)).toEqual(['Prioriser : Miner','Aller ici (Pas de chemin)','Rien à faire']);
    expect(options.map(option=>option.control.disabled??false)).toEqual([false,true,true]);
    expect(options.every(option=>option.width===box.width&&option.height===30)).toBe(true);
    expect(options.map(option=>option.y)).toEqual([0,29,58]);
    expect(box.width).toBe(Math.round(measure('Aller ici (Pas de chemin)')+20));
    expect(box.height).toBe(box.header+3*29+1);
  });
  it('keeps long and Tiny menus in small logical viewports, with every warning and option reachable',()=>{
    for(const viewport of [{width:180,height:190},{width:420,height:240},{width:1280,height:720}]){
      const rows=Array.from({length:85},(_,i)=>({id:'option-'+i,label:'Option de travail '+i+' avec une description longue et disponible',...(i===2?{value:'Pas de chemin',detail:'Une autre condition doit être remplie'}:{}),
        controls:[{...control('go-'+i),disabled:i===2}]}));
      const box=layoutNativePage({id:'native-orders',title:'Ada',rows,floatMenu:{x:viewport.width-1,y:viewport.height-1}},viewport,false,measure);
      expect(box.x).toBeGreaterThanOrEqual(0);expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height+.01);
      const options=box.rows.flatMap(row=>row.controls);expect(options.map(option=>option.control.id)).toEqual(rows.map((_,i)=>'go-'+i));
      expect(options.every(option=>option.x>=0&&option.x+option.width<=box.width&&option.y+option.height<=box.contentHeight+.01)).toBe(true);
      expect(options[2]!.control.label).toContain('Pas de chemin');expect(options[2]!.control.hint).toContain('Une autre condition');
      if(viewport.width<500)expect(box.contentHeight).toBeGreaterThan(box.body.height);
    }
  });
});

describe('Tooltip (ActiveTip)',()=>{
  it('is the text plus 4 on every side, at most 260 of text, rounded up',()=>{
    expect(TOOLTIP_BOX).toEqual({maxTextWidth:260,margin:4});
    expect(tooltipBoxSize(100.2,22)).toEqual({width:109,height:30});
    expect(tooltipBoxSize(500,66)).toEqual({width:268,height:74});
  });
});
