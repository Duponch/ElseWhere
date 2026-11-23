import {describe,expect,it} from 'vitest';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import {layoutNativePage,type TextMeasure} from '../src/ui3d/native-layout';
const measure:TextMeasure=(text,size)=>text.length*size*.52;
const button=(id:string):NativeControl=>({id,label:id,onActivate:()=>{}});
const architect=(count:number,selected=false):NativePage=>({id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows:[
 {id:'categories',label:'',region:'navigation',controlStyle:'navigation',controls:Array.from({length:8},(_,i)=>button('category-'+i))},
 {id:'catalogue',label:'',region:'catalogue',controlStyle:'tile',controls:Array.from({length:count},(_,i)=>button('construction-'+i))},
 {id:'details',label:selected?'Mur en pierre':'Choisir une construction',detail:selected?'Matériau, orientation et coût réel de construction.':'Choisissez une carte.',region:'details'},
]});
const rects=(box:ReturnType<typeof layoutNativePage>)=>({x:box.x,y:box.y,width:box.width,height:box.height,regions:Object.fromEntries(Object.entries(box.regions).map(([name,region])=>[name,{x:region!.x,y:region!.y,width:region!.width,height:region!.height}]))});

describe('native V485 presentation spacing',()=>{
 it('keeps Architect cardboard and panes identical for short and long categories and selected options',()=>{
  for(const viewport of[{width:1440,height:1000},{width:960,height:800},{width:480,height:322}]){
   const boxes=[architect(5),architect(15,true),architect(45)].map(page=>layoutNativePage(page,viewport,false,measure));
   expect(rects(boxes[1]!)).toEqual(rects(boxes[0]!));expect(rects(boxes[2]!)).toEqual(rects(boxes[0]!));
   for(const box of boxes)expect(box.height).toBe(viewport.height>=800?476:216);
   expect(boxes[2]!.regions.catalogue!.contentHeight).toBeGreaterThan(boxes[2]!.regions.catalogue!.height);
   for(const box of boxes){expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);}
  }
 });
 it('keeps every front-menu row while adding12 logical pixels between its groups',()=>{
  const page:NativePage={id:'front-options',title:'Options',layout:'front',rows:Array.from({length:5},(_,i)=>({id:'row-'+i,label:'Réglage '+i,controls:[button('action-'+i)]}))};
  const box=layoutNativePage(page,{width:1440,height:1000},true,measure);
  expect(box.rows.map(row=>row.row.id)).toEqual(page.rows.map(row=>row.id));
  for(let i=1;i<box.rows.length;i++)expect(box.rows[i]!.top-box.rows[i-1]!.top-box.rows[i-1]!.height).toBe(12);
 });
 it('keeps the wider dossier footprint stable across content while enlarging its portrait-action strip',()=>{
  const make=(count:number):NativePage=>({id:'inspect-pawn',title:'Eden',layout:'inspector',portrait:{url:'data:,',label:'Eden'},rows:[{id:'pawn-tabs',label:'',controls:['Journal','Matériel','Social','Bio','Besoins','Santé'].map(button)},...Array.from({length:count},(_,i)=>({id:'fact-'+i,label:'Valeur '+i}))],actions:['Mobiliser','Effacer les ordres','Travail','Fermer'].map(button)});
  for(const viewport of[{width:1440,height:1000},{width:960,height:800}]){
   const boxes=[0,12,50].map(count=>layoutNativePage(make(count),viewport,false,measure));
   // Core's inspect pane keeps 432 × 165 whatever the inspected content.
   for(const box of boxes){expect(box.inspectorParts?.summary).toMatchObject({width:432,height:165});expect(box.inspectorParts).toEqual(boxes[0]!.inspectorParts);expect([box.width,box.height]).toEqual([boxes[0]!.width,boxes[0]!.height]);}
  }
 });
});
