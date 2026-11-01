import {describe,expect,it} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';
const measure:TextMeasure=(text,size)=>text.length*size*.51;
const control=(id:string,label=id):NativeControl=>({id,label,onActivate:()=>{}});
function inside(outer:NativeRect,inner:NativeRect){expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);}
function architect(count:number,nav=0,details:NativeRow[]=[]):NativePage{return{id:'architect',title:'Architecte',layout:'architect',width:1420,height:900,rows:[...(nav?[{id:'categories',label:'',region:'navigation' as const,controlStyle:'navigation' as const,controls:Array.from({length:nav},(_,i)=>control(`category-${i}`))}]:[]),...(count?[{id:'catalogue',label:'',region:'catalogue' as const,controlStyle:'tile' as const,controls:Array.from({length:count},(_,i)=>control(`tool-${i}`))}]:[]),...details]};}
function research(count:number):NativePage{
 return{id:'research',title:'Recherche',layout:'research',width:1420,height:780,rows:[...(count?[{id:'research-tabs',label:'',region:'navigation' as const,controlStyle:'tab' as const,controls:[control('principal','Principal')]}]:[]),...Array.from({length:count},(_,i)=>({id:`node-${i}`,label:`Projet ${i}`,region:'graph' as const,graphNode:{x:i%5*180,y:Math.floor(i/5)*100,width:142,height:66,points:0,cost:100,state:'available' as const},controls:[control(`select-${i}`),control(`start-${i}`)]}))],research:{width:8000,height:8000,selected:'node-0',links:[]}};
}
function storage(count:number,settings=false):NativePage{
 return{id:'storage-example',title:'Stockage',layout:'storage',width:480,height:760,rows:[...(settings?[{id:'priority',label:'Priorité',region:'details' as const,controls:[control('priority-choice','Normale')]},{id:'fresh',label:'Frais',region:'details' as const,controls:[control('fresh-choice','Oui')]},{id:'quality',label:'Qualité',region:'details' as const,controls:[control('quality-choice','Toutes')]},{id:'search',label:'Rechercher',region:'navigation' as const,input:{value:'',onCommit:()=>{}}}]:[]),...Array.from({length:count},(_,i)=>({id:`item-${i}`,label:`Objet ${i}`,region:'catalogue' as const,tree:{depth:0,state:'all' as const,branch:false,expanded:false},controls:[{...control(`allow-${i}`),glyph:'allow' as const}]}))],actions:[control('apply','Appliquer')]};
}
describe('measured natural heights of structured and storage windows',()=>{
 it('sizes Architect from every region, grows only for necessary content, and keeps a narrow long dossier reachable',()=>{
  const viewport={width:1280,height:720},zero=layoutNativePage(architect(0),viewport,false,measure),three=layoutNativePage(architect(3),viewport,false,measure),many=layoutNativePage(architect(120),viewport,false,measure);
  expect(zero.height).toBeLessThan(three.height);expect(three.height).toBeLessThan(many.height);expect(many.height).toBeLessThanOrEqual(viewport.height-106);
  for(const box of [zero,three,many])inside({x:0,y:0,...viewport},box);
  expect(three.rows.find(r=>r.row.id==='catalogue')!.controls.every(c=>c.height===104)).toBe(true);expect(many.rows.find(r=>r.row.id==='catalogue')!.controls).toHaveLength(120);expect(many.regions.catalogue!.contentHeight).toBeGreaterThan(many.regions.catalogue!.height);
  const withRail=layoutNativePage(architect(3,8),viewport,false,measure);expect(withRail.height).toBeGreaterThan(three.height);expect(withRail.regions.navigation!.height).toBeGreaterThanOrEqual(withRail.regions.navigation!.contentHeight);
  // Empty catalogue, real-sized categories and a long detail owner. The last
  // paragraph must be reachable instead of giving the empty catalogue its room.
  const details=Array.from({length:20},(_,i):NativeRow=>({id:`detail-${i}`,label:`Information ${i}`,detail:'Tous les mots et les réglages restent disponibles dans le dossier, sans réduction des caractères.',region:'details'}));
  const page=architect(0,3,details),box=layoutNativePage(page,{width:480,height:720},false,measure),region=box.regions.details!,last=box.rows.find(r=>r.row.id==='detail-19')!,offset=region.contentHeight-region.height;
  inside({x:0,y:0,width:box.width,height:box.height},region);expect(region.height).toBeGreaterThan(190);expect(region.contentHeight).toBeGreaterThan(region.height);expect(box.regions.catalogue!.height).toBeLessThanOrEqual(2);
  expect(box.header+last.top+last.height-offset).toBeCloseTo(region.y+region.height,6);expect(last.detailLines.join(' ')).toBe(details.at(-1)!.detail);expect(box.rows.find(r=>r.row.id==='categories')!.controls.every(c=>c.height===96)).toBe(true);
 });
 it('sizes Research from actual nodes, routes and tabs, including routes without nodes and overflowing tabs',()=>{
  const viewport={width:1280,height:720},zero=layoutNativePage(research(0),viewport,false,measure),three=layoutNativePage(research(3),viewport,false,measure),many=layoutNativePage(research(60),viewport,false,measure);
  expect(zero.height).toBeLessThan(three.height);expect(three.height).toBeLessThan(many.height);expect(many.height).toBeLessThanOrEqual(viewport.height-106);expect(three.regions.graph!.contentHeight).toBeLessThan(8000);expect(many.rows.filter(r=>r.row.graphNode)).toHaveLength(60);
  for(const row of three.rows.filter(r=>r.row.graphNode))expect([row.controls[0]!.width,row.controls[0]!.height]).toEqual([142,66]);
  const routes=research(0);routes.rows=[{id:'tabs',label:'',region:'navigation',controlStyle:'tab',controls:Array.from({length:12},(_,i)=>control(`tab-${i}`,`Onglet ${i}`))}];routes.research!.links=[{from:'a',to:'b',path:[{x:0,y:0},{x:120,y:1200}]}];const before=JSON.stringify(routes);
  const box=layoutNativePage(routes,{width:480,height:322},false,measure),graph=box.regions.graph!,navigation=box.regions.navigation!,tabRow=box.rows.find(r=>r.row.id==='tabs')!,lastTab=tabRow.controls.at(-1)!;
  for(const region of Object.values(box.regions))inside({x:0,y:0,width:box.width,height:box.height},region!);
  expect(graph.contentHeight).toBeGreaterThanOrEqual(1200);expect(graph.contentHeight).toBeGreaterThan(graph.height);expect(navigation.contentHeight).toBeGreaterThan(navigation.height);expect(navigation.height).toBeGreaterThanOrEqual(34);
  const graphOffset=graph.contentHeight-graph.height;expect(graph.y+1200-graphOffset).toBeLessThanOrEqual(graph.y+graph.height);expect(graph.y+1200-graphOffset).toBeGreaterThanOrEqual(graph.y);
  const tabOffset=navigation.contentHeight-navigation.height;expect(lastTab.height).toBe(34);expect(box.header+lastTab.y+lastTab.height-tabOffset).toBeCloseTo(navigation.y+navigation.height,6);expect(JSON.stringify(routes)).toBe(before);
 });
 it('shrinks empty/three-row storage while keeping settings, footer and full tree accessible at many rows',()=>{
  const viewport={width:1280,height:720},zero=layoutNativePage(storage(0),viewport,false,measure),three=layoutNativePage(storage(3),viewport,false,measure),many=layoutNativePage(storage(80),viewport,false,measure);
  expect(zero.height).toBeLessThan(three.height);expect(three.height).toBeLessThan(many.height);expect(many.height).toBeLessThanOrEqual(viewport.height-104);expect(three.rows.filter(r=>r.row.tree).map(r=>r.height)).toEqual([27,27,27]);
  for(const box of [zero,three,many]){inside({x:0,y:0,...viewport},box);expect(box.actions).toHaveLength(1);inside({x:0,y:0,width:box.width,height:box.height},{...box.actions[0]!,y:box.header+box.actions[0]!.y});}
  const empty=layoutNativePage(storage(0,true),viewport,false,measure),small=layoutNativePage(storage(3,true),viewport,false,measure);expect(empty.regions.details!.height).toBe(empty.regions.details!.contentHeight);expect(empty.regions.catalogue!.height).toBeLessThanOrEqual(2);expect(empty.height).toBeLessThan(small.height);
  const tree=many.rows.filter(r=>r.row.tree),last=tree.at(-1)!,region=many.regions.catalogue!,offset=region.contentHeight-region.height;expect(tree).toHaveLength(80);expect(region.contentHeight).toBeGreaterThan(region.height);expect(many.header+last.top+last.height-offset).toBeCloseTo(region.y+region.height,6);expect(tree.every(r=>r.controls.every(c=>c.height===24))).toBe(true);
 });
});
