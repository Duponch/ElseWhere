import {describe,expect,it} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {flowNativeControls,layoutNativePage,NATIVE_UI,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';

const measure:TextMeasure=(text,size)=>Array.from(text).reduce((width,letter)=>width+(/\s/.test(letter)?.3:/[ilI.,:;!]/.test(letter)?.3:.54)*size,0);
const control=(id:string,label=id):NativeControl=>({id,label,onActivate:()=>{}});
const viewport={width:1440,height:1000};
function inside(outer:NativeRect,inner:NativeRect){
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);
  expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);
}
const layout=(page:NativePage,view=viewport)=>layoutNativePage(page,view,false,measure);

describe('native UI structure retained with the revised V480 proportions',()=>{
  it('keeps ordinary actions at intrinsic width and wraps them without filling empty horizontal space',()=>{
    const actions=[control('first','Choisir'),control('second','Consulter le dossier'),control('third','Fermer')];
    const wide=flowNativeControls(actions,{x:10,y:20,width:1000,height:0},measure);
    expect(wide.height).toBe(NATIVE_UI.button);expect(wide.controls.every(button=>button.width>=68&&button.width<=240)).toBe(true);
    expect(wide.controls.at(-1)!.x+wide.controls.at(-1)!.width).toBeLessThan(600);
    const narrow=flowNativeControls(actions,{x:10,y:20,width:180,height:0},measure);
    expect(narrow.height).toBeGreaterThan(wide.height);expect(narrow.controls.map(button=>button.control)).toEqual(actions);
    for(const button of narrow.controls)inside({x:10,y:20,width:180,height:narrow.height},button);
    expect(new Set(narrow.controls.map(button=>button.y)).size).toBeGreaterThan(1);
  });

  it('keeps equal cells only for actual matrices, with room for captions and the current dropdown',()=>{
    const controls=Array.from({length:8},(_,index)=>({...control('priority-'+index,String(index%5)),caption:'12 ♨'}));
    const page:NativePage={id:'work',title:'Travail',layout:'table',width:1480,rows:[{id:'worker',label:'Ada',value:'Travail confirmé',compact:true,controls}]};
    const box=layout(page),row=box.rows[0]!;
    expect(row.matrix).toBe(true);expect(row.height).toBe(48);expect(row.controls).toHaveLength(8);
    expect(new Set(row.controls.map(button=>button.width)).size).toBe(1);
    expect(row.controls.every(button=>button.height===42&&button.y===row.top+3)).toBe(true);
    expect(row.controls[0]!.x).toBe(row.x+104);
    expect(row.controls.at(-1)!.x+row.controls.at(-1)!.width).toBeCloseTo(row.x+row.width-142);
  });

  it('retains input side actions on the right and keeps symbolic actions small',()=>{
    const controls=[control('less','−'),control('more','+')];
    const box=layout({id:'editor',title:'Réglages',rows:[{id:'quantity',label:'Quantité',controls,input:{value:'12',onCommit:()=>{}}}]});
    const row=box.rows[0]!;expect(row.controls.map(button=>button.control)).toEqual(controls);
    expect(row.controls.every(button=>button.height===26&&button.width===26)).toBe(true);
    expect(row.controls[0]!.x).toBeGreaterThan(row.x+row.labelWidth+70);
    expect(row.controls.at(-1)!.x+row.controls.at(-1)!.width).toBe(row.x+row.width);
    const arrows=flowNativeControls([control('left','↶'),control('right','↷')],{x:0,y:0,width:100,height:0},measure);
    expect(arrows.height).toBe(NATIVE_UI.button);expect(arrows.controls.map(button=>button.width)).toEqual([32,32]);
  });

  it('restores independent Architecte navigation, catalogue and option regions',()=>{
    const rows:NativeRow[]=[{id:'categories',label:'',region:'navigation',controlStyle:'navigation',controls:Array.from({length:8},(_,i)=>control('category-'+i))},
      {id:'catalogue',label:'',region:'catalogue',controlStyle:'tile',controls:Array.from({length:40},(_,i)=>({...control('build-'+i),icon:'wall'}))},
      {id:'options',label:'Matériau choisi',region:'details',detail:'Les réglages de la construction restent dans une colonne distincte.'}];
    const box=layout({id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows});
    const nav=box.regions.navigation!,catalogue=box.regions.catalogue!,details=box.regions.details!;
    expect(box.width).toBe(1180);expect(box.height).toBeLessThanOrEqual(740);
    expect(nav.x+nav.width).toBeLessThan(catalogue.x);expect(catalogue.x+catalogue.width).toBeLessThan(details.x);
    expect([nav.y,catalogue.y,details.y]).toEqual([box.header,box.header,box.header]);
    const buttons=box.rows[0]!.controls,tiles=box.rows[1]!.controls;
    expect(buttons.every(button=>button.height===96&&button.width<=100)).toBe(true);
    expect(new Set(tiles.slice(0,6).map(tile=>tile.y)).size).toBe(1);expect(tiles[6]!.y).toBe(114);
    expect(tiles.every(tile=>tile.height===104&&tile.width<=104)).toBe(true);expect(catalogue.contentHeight).toBeGreaterThan(catalogue.height);
    expect(details.contentHeight).toBeLessThan(details.height);expect(box.contentHeight).toBe(catalogue.contentHeight);
    expect(box.body).toEqual({x:catalogue.x,y:catalogue.y,width:catalogue.width,height:catalogue.height});
  });

  it('keeps responsive Architecte regions inside their page while options move below the catalogue',()=>{
    for(const width of[900,700,400]){
      const box=layout({id:'architect',title:'Architecte',layout:'architect',rows:[],width:1420,height:900},{width,height:800});
      for(const region of Object.values(box.regions))inside({x:0,y:0,width:box.width,height:box.height},region);
      if(width<740){const cat=box.regions.catalogue!,details=box.regions.details!;expect(details.x).toBe(cat.x);expect(details.y).toBeGreaterThanOrEqual(cat.y+cat.height);}
    }
  });

  it('uses compact V480 cards with more visible catalogue columns and no stretched cell widths',()=>{
    const page=(cards:number):NativePage=>({id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows:[
      {id:'navigation',label:'',region:'navigation',controlStyle:'navigation',controls:Array.from({length:7},(_,i)=>control('category-'+i))},
      {id:'catalogue',label:'',region:'catalogue',controlStyle:'tile',controls:Array.from({length:cards},(_,i)=>control('tool-'+i))},
      {id:'details',label:'Choisir une construction',region:'details',detail:'Les réglages restent accessibles.'}]});
    const wide=layout(page(7)),medium=layout(page(7),{width:960,height:1000}),small=layout(page(7),{width:760,height:1000});
    expect(wide.rows[1]!.controls.filter(control=>control.y===0)).toHaveLength(6);
    expect(medium.rows[1]!.controls.filter(control=>control.y===0)).toHaveLength(4);
    expect(small.rows[1]!.controls.filter(control=>control.y===0)).toHaveLength(4);
    expect(wide.height).toBe(476);expect(wide.y).toBe(1000-94-wide.height);
    expect(wide.regions.navigation!.height).toBe(414);expect(wide.regions.catalogue!.contentHeight).toBe(218);
    expect(wide.body.height).toBe(414);expect(wide.contentHeight).toBe(218);
    expect(layout(page(13)).height).toBe(476);
    const long=layout(page(48));expect(long.height).toBe(740);expect(long.contentHeight).toBeGreaterThan(long.body.height);
  });

  it('positions the two map-tool trays without a panel header or large background allocation',()=>{
    for(const kind of['orders','zones'] as const){
      const page:NativePage={id:'map-tools-'+kind,title:kind,layout:'palette',palette:kind,width:600,rows:[{id:'tools',label:'',region:'catalogue',controlStyle:'icon',controls:Array.from({length:kind==='orders'?8:12},(_,i)=>({...control('tool-'+i),icon:'mine'}))}]};
      const box=layout(page);expect(box.x).toBe(128);expect(box.header).toBe(0);expect(box.footer).toBe(0);
      expect(box.height).toBe(46);expect(box.y).toBe(1000-82-12-box.height-(kind==='orders'?54:0));
      expect(box.rows[0]!.controls.every(button=>button.width===48&&button.height===46)).toBe(true);
      for(const button of box.rows[0]!.controls)inside(box.body,button);
    }
  });

  it('preserves the research graph coordinate system and separate selection/start targets',()=>{
    const page:NativePage={id:'research',title:'Recherche',layout:'research',width:1190,height:720,research:{width:850,height:815,selected:'b',links:[]},rows:[
      {id:'tabs',label:'',region:'navigation',controlStyle:'tab',controls:[control('main','Principal')]},
      {id:'detail',label:'Dossier du projet',region:'details'},
      ...[{id:'a',x:24,y:20},{id:'b',x:644,y:700}].map(node=>({id:node.id,label:'Projet',region:'graph' as const,graphNode:{x:node.x,y:node.y,width:142,height:66,points:0,cost:500,state:'available' as const},controls:[control(node.id),control(node.id+'-start','▶')]}))]};
    const box=layout(page),graph=box.regions.graph!,first=box.rows[2]!,last=box.rows[3]!;
    expect(graph.y).toBe(box.header+40);expect(graph.contentWidth).toBe(850);expect(graph.contentHeight).toBe(815);
    expect(first.x).toBe(graph.x+24);expect(first.top).toBe(60);expect(last.top).toBe(740);
    expect(first.controls.map(button=>[button.width,button.height])).toEqual([[142,66],[22,19]]);
    expect(first.controls[1]!.x).toBe(first.x+118);expect(first.controls[1]!.y).toBe(first.top+40);
    expect(box.regions.details!.x+box.regions.details!.width).toBeLessThan(graph.x);
    expect(box.contentHeight).toBe(box.regions.details!.contentHeight);expect(box.body.x).toBe(box.regions.details!.x);
  });

  it('keeps all twelve Bio meters visible above the separated inspector tabs and footer',()=>{
    const rows:NativeRow[]=[{id:'pawn-tabs',label:'',compact:true,controls:['Journal','Matériel','Social','Bio','Besoins','Santé'].map(label=>control(label))},
      {id:'identity',label:'Une personne',column:0},{id:'heading-bio-skills',label:'Compétences',emphasis:'heading',column:1},
      ...Array.from({length:12},(_,i)=>({id:'skill-'+i,label:'Compétence '+i,column:1 as const,meter:{value:12,max:20,secondary:{value:50,max:100}}}))];
    const page:NativePage={id:'inspect-pawn-bio',title:'Ada',subtitle:'Bio',portrait:{url:'data:,',label:'Ada'},layout:'inspector',width:514,height:489,columnRatio:.48,rows,actions:[control('draft','Mobiliser'),control('clear','Effacer les ordres'),control('work','Travail')]};
    const box=layout(page),parts=box.inspectorParts!;expect([box.width,box.height]).toEqual([700,620]);
    expect(box.header).toBe(40);expect(box.body.height).toBe(426);expect(parts.sheet).toEqual({x:0,y:0,width:700,height:474});
    expect(parts.tabs.y).toBe(478);expect(parts.summary.y).toBe(516);expect(parts.summary.width).toBe(240);expect(parts.actions.width).toBe(420);
    expect(parts.summary.y).toBe(parts.actions.y);expect(parts.summary.height).toBe(104);
    expect(box.regions.navigation).toEqual({...parts.tabs,contentHeight:parts.tabs.height});
    const tabs=box.rows.find(row=>row.row.id==='pawn-tabs')!;
    expect(tabs.row).toMatchObject(rows[0]!);expect(tabs.row.region).toBe('navigation');expect(tabs.top+box.header).toBe(parts.tabs.y);
    for(const button of tabs.controls)inside(parts.tabs,{...button,y:button.y+box.header});
    expect(box.rows.filter(row=>row.row.id.startsWith('skill-')).every(row=>row.top+row.height<=box.body.height)).toBe(true);
    expect(box.actions.map(button=>button.control)).toEqual(page.actions);
    expect(box.actions[0]!.y).toBe(box.actions[1]!.y);expect(box.actions[2]!.y).toBeGreaterThan(box.actions[0]!.y);
    for(const button of box.actions)inside(parts.actions,{...button,y:button.y+box.header});
    expect(box.actions.every(button=>button.width<=205)).toBe(true);expect(box.height).toBeLessThanOrEqual(686);
  });

  it('wraps long footer actions into two columns while all pawn tabs keep one fixed V480 body budget',()=>{
    const wideMeasure:TextMeasure=(text,size)=>Array.from(text).length*size*8/13;
    const actions=[control('draft','Mobiliser'),control('clear','Effacer tous les ordres de cette personne'),control('work','Travail')];
    const tabs:NativeRow={id:'pawn-tabs',label:'',controls:['Journal','Matériel','Social','Bio','Besoins','Santé'].map(label=>control(label))};
    const bio:NativePage={id:'inspect-pawn-bio',title:'Ada',subtitle:'Bio',portrait:{url:'data:,',label:'Ada'},layout:'inspector',width:514,height:489,rows:[tabs,{id:'facts',label:'Dossier'}],actions};
    const box=layoutNativePage(bio,viewport,false,wideMeasure),parts=box.inspectorParts!;
    expect(box.actions[1]!.height).toBe(42);expect(box.actions[2]!.y-box.actions[0]!.y).toBe(50);
    expect(box.actions[2]!.width).toBeLessThan(box.actions[1]!.width);
    for(const button of box.actions)inside(parts.actions,{...button,y:button.y+box.header});
    for(const[width,height,bound]of[[580,520,717],[630,430,627]] as const){
      const page:NativePage={...bio,id:'inspect-pawn-other',subtitle:undefined,width,height,rows:[tabs,...Array.from({length:30},(_,i)=>({id:'fact-'+i,label:'Information '+i}))]};
      const other=layout(page),navigation=other.rows.find(row=>row.row.id==='pawn-tabs')!;
      expect(other.body.height).toBe(426);expect(other.height).toBe(620);expect(other.height).toBeLessThanOrEqual(bound);expect(navigation.height).toBe(34);
      expect(other.rows.filter(row=>row.row.id!=='pawn-tabs').map(row=>row.row)).toEqual(page.rows.slice(1));
      expect(other.contentHeight).toBeGreaterThan(other.body.height);
    }
  });

  it('retains the complete text and action extents in overflowing generic dossiers',()=>{
    const rows:NativeRow[]=Array.from({length:40},(_,i)=>({id:'fact-'+i,label:'Fait '+i,detail:'Toutes les informations restent disponibles lorsque le dossier dépasse la hauteur affichée.'}));
    const box=layout({id:'long',title:'Dossier',layout:'inspector',width:514,height:489,rows,actions:[control('one','Choisir'),control('two','Retour')]});
    expect(box.inspectorParts).toBeUndefined();
    expect(box.rows.map(row=>row.row)).toEqual(rows);expect(box.contentHeight).toBeGreaterThan(box.body.height);
    expect(box.rows.at(-1)!.top+box.rows.at(-1)!.height).toBe(box.contentHeight);
    for(const action of box.actions)expect(action.y+action.height+box.header).toBeLessThanOrEqual(box.height-4);
    expect(box.actions.at(-1)!.x+box.actions.at(-1)!.width).toBeLessThan(box.width-100);
  });
});
