import {describe,expect,it} from 'vitest';
import {layoutNativePage,nativeTableRowScroll,type NativePageBox,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';

// Pure presentation fixtures: no World, Engine, command, save, Worker or colony.
// Assertions describe fitting/reachability rather than copying an implementation
// height formula or asserting a new fixed height for each management screen.
const measure:TextMeasure=(text,size)=>text.length*size*.52;
const control=(id:string,label=id):NativeControl=>({id,label,onActivate:()=>{throw Error('Geometry must not activate a control.');}});
const inside=(outer:NativeRect,inner:NativeRect)=>{
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);
};
type Roster='work'|'schedule'|'assign'|'animals'|'wildlife'|'factions';
const rosters:readonly Roster[]=['work','schedule','assign','animals','wildlife','factions'];

function roster(id:Roster,count:number):NativePage{
  const columns=id==='schedule'?26:id==='work'?18:id==='assign'?8:id==='animals'?10:id==='wildlife'?7:6;
  const rows:NativeRow[]=[
    {id:id+'-search',label:'Rechercher',region:'navigation',input:{value:'',onCommit:()=>{throw Error('Geometry must not edit a search.');}}},
    {id:id+'-toolbar',label:'',region:'navigation',controls:[control(id+'-sort','Ordre des noms')]},
    {id:id+'-heading',label:'Nom',columns:Array.from({length:columns},(_,i)=>({label:'Information '+i}))},
    ...Array.from({length:count},(_,i)=>({id:id+'-record-'+i,label:(id==='animals'||id==='wildlife'?'Animal ':'Colon ')+i,compact:true,
      controls:Array.from({length:columns},(_,n)=>control(id+'-record-'+i+'-field-'+n,'Choix'))})),
  ];
  const actions=id==='assign'?['Alimentation','Tenues','Drogues','Zones']:id==='animals'?['Abattage automatique']:id==='schedule'?['Aide du planning']:id==='factions'?['Retour']:[];
  return{id,title:id,layout:'table',width:id==='animals'?1640:1480,rows,
    ...(id==='work'?{subtitle:'Priorités manuelles de travail.'}:{}),
    ...(['work','schedule','assign'].includes(id)?{tableProfile:'colonists' as const}:id==='factions'?{tableProfile:'factions' as const}:{}),
    actions:actions.map((label,i)=>control(id+'-action-'+i,label))};
}
const layout=(page:NativePage,width=1280,height=1000)=>layoutNativePage(page,{width,height},false,measure);
const records=(box:NativePageBox)=>box.rows.filter(row=>row.row.id.includes('-record-'));

function fixedPartsAndReachableEnd(box:NativePageBox){
  const heading=box.rows.find(row=>row.row.columns)!;
  expect(box.tableHeader).toBeDefined();expect(box.body.height).toBeGreaterThan(0);
  expect(box.body.y).toBeGreaterThanOrEqual(box.tableHeader!.y+box.tableHeader!.height);
  const details=box.regions.details!;inside({x:0,y:0,width:box.width,height:box.height},details);
  expect(details.y+details.height).toBeLessThanOrEqual(box.tableHeader!.y);
  expect(box.body.y+box.body.height).toBeLessThanOrEqual(box.height-box.footer+.01);
  const last=records(box).at(-1)!;
  const scroll=Math.max(0,box.contentHeight-box.body.height);
  expect(box.header+heading.top-nativeTableRowScroll(box,heading.row,scroll)).toBe(box.tableHeader!.y);
  const lastRect={x:box.body.x,y:box.header+last.top-scroll,width:box.body.width,height:last.height};
  inside(box.body,lastRect);
  // Footer geometry is relative to header, unlike the body rectangle.
  for(const action of box.actions)inside({x:0,y:0,width:box.width,height:box.height},{...action,y:action.y+box.header});
}

describe('management panels adapt to actual content while long lists remain reachable',()=>{
  it('grows each roster from0 to3 to45 records, and a short roster does not expand on a taller screen',()=>{
    for(const id of rosters){
      const empty=layout(roster(id,0)),short=layout(roster(id,3)),long=layout(roster(id,45)),taller=layout(roster(id,3),1280,1400);
      expect(empty.height).toBeLessThan(short.height);expect(short.height).toBeLessThan(long.height);
      expect(taller.height).toBeCloseTo(short.height,8);
      expect(records(short)).toHaveLength(3);expect(records(long)).toHaveLength(45);
      expect(short.contentHeight).toBeLessThanOrEqual(short.body.height+.01);
      expect(long.contentHeight).toBeGreaterThan(long.body.height);
      fixedPartsAndReachableEnd(short);fixedPartsAndReachableEnd(long);
    }
  });

  it('bounds narrow rosters while retaining all0/3/45 rows and scrolling only long body content',()=>{
    const viewport={width:480,height:720};
    for(const id of rosters)for(const count of [0,3,45]){
      const page=roster(id,count),before=JSON.stringify(page),box=layout(page,viewport.width,viewport.height);
      inside({x:0,y:0,...viewport},box);expect(box.body.height).toBeGreaterThan(0);
      expect(records(box).map(row=>row.row.id)).toEqual(page.rows.filter(row=>row.id.includes('-record-')).map(row=>row.id));
      expect(box.regions.catalogue!.contentWidth).toBeGreaterThan(box.regions.catalogue!.width);
      expect(box.regions.navigation!.x).toBe(box.body.x);expect(box.regions.navigation!.height).toBe(box.body.height);
      if(count)fixedPartsAndReachableEnd(box);
      if(count===45)expect(box.contentHeight).toBeGreaterThan(box.body.height);
      expect(JSON.stringify(page)).toBe(before);
    }
  });

  it('preserves natural sizing of Menu, Quests, History and World without a globe instead of forcing a mostly empty maximum',()=>{
    for(const id of ['menu','quests','history','world']){
      const page=(count:number):NativePage=>({id,title:id,layout:id==='history'?'table':'dialog',width:id==='menu'?450:720,rows:Array.from({length:count},(_,i)=>({id:id+'-fact-'+i,label:'Fait enregistré '+i})),actions:[control(id+'-back','Retour')]});
      const empty=layout(page(0)),short=layout(page(3)),long=layout(page(45));
      expect(empty.height).toBeLessThan(short.height);expect(short.height).toBeLessThan(long.height);
      expect(layout(page(3),1280,1400).height).toBeCloseTo(short.height,8);
      expect(short.contentHeight).toBeLessThanOrEqual(short.body.height+.01);
      expect(long.contentHeight).toBeGreaterThan(long.body.height);
      expect(long.rows.map(row=>row.row.id)).toEqual(page(45).rows.map(row=>row.id));
    }
  });

  it('keeps wrapped dialog content and its final action reachable on a narrow screen without dropping information',()=>{
    const viewport={width:400,height:520};
    for(const count of [0,3,45]){
      const page:NativePage={id:'quests-adaptive-detail',title:'Dossier',layout:'dialog',width:920,rows:Array.from({length:count},(_,i)=>({id:'fact-'+i,label:'Information complète '+i,detail:'Le nom, les conditions et les conséquences restent lisibles même lorsque le texte occupe plusieurs lignes.'})),actions:[control('detail-return','Retour aux dossiers')]};
      const box=layout(page,viewport.width,viewport.height);inside({x:0,y:0,...viewport},box);
      expect(box.body.height).toBeGreaterThan(0);expect(box.rows.map(row=>row.row.id)).toEqual(page.rows.map(row=>row.id));
      expect(box.actions.map(action=>action.control.id)).toEqual(['detail-return']);
      for(const action of box.actions)inside({x:0,y:0,width:box.width,height:box.height},{...action,y:box.header+action.y});
      if(count){const last=box.rows.at(-1)!,scroll=Math.max(0,box.contentHeight-box.body.height);inside(box.body,{x:box.body.x,y:box.header+last.top-scroll,width:box.body.width,height:last.height});}
      if(count===45)expect(box.contentHeight).toBeGreaterThan(box.body.height);
    }
  });
});
