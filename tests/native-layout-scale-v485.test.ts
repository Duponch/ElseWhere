import {describe,expect,it} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,NATIVE_UI,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';

const measure:TextMeasure=(text,size)=>text.length*size*.52;
const button=(id:string,label=id):NativeControl=>({id,label,onActivate:()=>{}});
const inside=(outer:NativeRect,inner:NativeRect)=>{
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);
};
const viewports=[{width:720,height:410},{width:480,height:322},{width:480,height:240}];
const records:NativeRow[]=Array.from({length:24},(_,i)=>({id:'fact-'+i,label:'Valeur conservée '+i,detail:'Tous les détails restent lisibles au défilement.'}));
const tabs:NativeRow={id:'pawn-tabs',label:'',region:'navigation',controls:['Journal','Matériel','Social','Bio','Besoins','Santé','Prisonnier'].map(label=>button('tab-'+label,label))};

describe('native layout on logical viewports reduced by the chosen scale',()=>{
  it('bounds structured boards and every clipped region without dropping their records',()=>{
    for(const viewport of viewports)for(const kind of ['architect','research'] as const){
      const page:NativePage={id:kind,title:kind,layout:kind,rows:kind==='architect'?[{id:'categories',label:'',region:'navigation',controlStyle:'navigation',controls:Array.from({length:8},(_,i)=>button('category-'+i))},{id:'catalogue',label:'',region:'catalogue',controlStyle:'tile',controls:Array.from({length:15},(_,i)=>button('tool-'+i))},{id:'details',label:'Options complètes',region:'details',detail:'Détails de construction et matériaux conservés.'}]:records.map(row=>({...row,region:'details'}))};
      const box=layoutNativePage(page,viewport,false,measure);inside({x:0,y:0,...viewport},box);expect(box.body.height).toBeGreaterThan(0);
      for(const region of Object.values(box.regions)){inside({x:0,y:0,width:box.width,height:box.height},region);expect(region.height).toBeGreaterThan(0);}
      expect(box.rows.map(row=>row.row.id)).toEqual(page.rows.map(row=>row.id));
      if(kind==='architect'){
        const detail=box.rows.find(row=>row.row.id==='details')!,region=box.regions.details!;
        expect(detail.top+box.header).toBe(region.y);
        const nav=box.regions.navigation!,grid=box.regions.catalogue!;
        expect(nav.y).toBeGreaterThanOrEqual(region.y+region.height);
        expect(grid.x-region.x).toBe(210);
        expect(box.rows.find(row=>row.row.id==='catalogue')!.controls.every(c=>c.height===75&&c.width===75)).toBe(true);
        expect(box.rows.find(row=>row.row.id==='categories')!.controls).toHaveLength(8);
      }
    }
  });
  it('keeps a short dossier onscreen with all tabs and actions reachable by scrolling',()=>{
    const actions=['Mobiliser','Effacer les ordres','Travail','Fermer'].map(label=>button(label));
    const page:NativePage={id:'inspect-pawn',title:'Eden',layout:'inspector',portrait:{url:'data:,',label:'Eden'},inspectTab:{id:'bio',width:514,height:489,margin:17},rows:[tabs,...records],actions};
    for(const viewport of viewports){
      const box=layoutNativePage(page,viewport,false,measure);inside({x:0,y:0,...viewport},box);expect(box.body.height).toBeGreaterThan(0);
      expect(box.rows.filter(row=>row.row.id.startsWith('fact-'))).toHaveLength(records.length);
      const controls=[...box.rows.flatMap(row=>row.controls),...box.actions].map(control=>control.control.id);
      for(const control of [...tabs.controls!,...actions])expect(controls).toContain(control.id);
      expect(box.contentHeight).toBeGreaterThan(box.body.height);
    }
    expect(NATIVE_UI.body).toBe(13);expect(NATIVE_UI.button).toBe(30);
  });
  it('moves an oversized footer into scrollable content instead of covering the body',()=>{
    const actions=Array.from({length:12},(_,i)=>button('action-'+i,'Longue action conservée '+i));
    const box=layoutNativePage({id:'many-actions',title:'Actions',rows:records,actions},viewports[2]!,false,measure);
    expect(box.actions).toEqual([]);expect(box.body.height).toBeGreaterThanOrEqual(32);
    expect(box.rows.at(-1)?.row.id).toBe('page-overflow-actions');expect(box.rows.at(-1)?.controls.map(control=>control.control)).toEqual(actions);
    inside({x:0,y:0,...viewports[2]!},box);
  });
  it('keeps full-size front-menu controls in a bounded scrollable options panel',()=>{
    const page:NativePage={id:'front-options',title:'Options',layout:'front',width:1040,height:720,rows:records,actions:[button('back','Retour')]};
    for(const viewport of viewports){const box=layoutNativePage(page,viewport,true,measure);inside({x:0,y:0,...viewport},box);expect(box.body.height).toBeGreaterThan(0);expect(box.contentHeight).toBeGreaterThan(box.body.height);expect(box.actions[0]?.height).toBe(NATIVE_UI.button);}
  });
});
