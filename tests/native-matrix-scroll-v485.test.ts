import {describe,expect,it} from 'vitest';
import {NativeStage} from '../src/ui3d/NativeStage';
import {layoutNativePage,nativeMatrixColumns,nativeMatrixHeadingLines,type NativePageBox,type NativeRowBox,type TextMeasure} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

const measure:TextMeasure=(text,size)=>Array.from(text).length*size*.55;
const labels=['Incendie','Patient','Médecin','Repos au lit','Manutention','Geôlier','Dressage','Cuisine','Chasse','Construction','Culture','Minage','Foresterie','Art','Artisanat','Transport','Nettoyage','Recherche'];
function workPage(count=3){
 const changes:string[]=[],controls:NativeControl[][]=[];
 const page:NativePage={id:'work',title:'Travail',layout:'table',width:1480,rows:[{id:'work-headings',label:'Colon',value:'Activité',columns:labels.map(label=>({label,hint:'Priorité '+label}))},
 ...Array.from({length:count},(_,pawn)=>{const row=labels.map((label,index)=>({id:`work-${pawn}-${index}`,label:'2',caption:'20 ♨ ♨',hint:label+' · niveau20/20 et passion brûlante',onActivate:()=>{},select:{value:'2',options:[0,1,2,3,4].map(value=>({value:String(value),label:String(value)})),onChange:(value:string)=>{changes.push(`${pawn}:${index}:${value}`);}}}));controls.push(row);return {id:'worker-'+pawn,label:'Colon '+pawn,value:pawn===1?undefined:'Disponible',compact:true,controls:row};})]};
 return {page,controls,changes};
}
function stageAccess(box:NativePageBox){
 const stage=Object.create(NativeStage.prototype) as {pageBox:NativePageBox;paletteX:number;graphX:number;scroll:number;primaryRegion():string|undefined;horizontalOffset(region?:string):number;setHorizontalOffset(region:string|undefined,value:number):void;regionOffset(region?:string):number;setRegionOffset(region:string|undefined,value:number):void;drawScrollbars(box:NativePageBox):void;drawMatrixName(ctx:CanvasRenderingContext2D,row:NativeRowBox,top:number):void;rowHint(row:NativeRowBox['row']):string;semanticText:(ctx:CanvasRenderingContext2D,text:string,x:number,y:number,width:number,...rest:unknown[])=>void;regionGroup(region?:string):unknown;regionGroups:{navigation:unknown;details:unknown;graph:unknown};pageContent:unknown;pagePiece:(id:string)=>{userData:Record<string,unknown>};pageGroup:{add:(piece:unknown)=>void}};
 stage.pageBox=box;stage.paletteX=0;stage.graphX=0;stage.scroll=0;stage.regionGroups={navigation:{name:'navigation'},details:{name:'details'},graph:{name:'graph'}};stage.pageContent={name:'content'};return stage;
}

describe('intrinsic native matrices preserve legibility and both scroll axes',()=>{
 it('keeps all work cells at least42 logical pixels across small and enlarged UI viewports',()=>{
  const f=workPage(),before=JSON.stringify(f.page);
  for(const viewport of[{width:1440,height:1000},{width:960,height:800},{width:640,height:533},{width:480,height:400}]){
   const box=layoutNativePage(f.page,viewport,false,measure),region=box.regions.catalogue!;
   expect(region.contentWidth!+box.regions.navigation!.width).toBeGreaterThanOrEqual(1220);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);
   expect(box.regions.navigation!.x).toBe(box.body.x);expect(box.regions.navigation!.width).toBe(104);expect(region.x).toBe(box.body.x+104);expect(region.width).toBe(box.body.width-104);
   const header=box.rows[0]!,columns=nativeMatrixColumns(header.row,header.x,header.width,labels.length,header.matrixTail);
   expect(header.row.region).toBe('catalogue');
   for(const row of box.rows.slice(1)){
    expect(row.row.region).toBe('catalogue');expect(row.controls).toHaveLength(18);
    for(const [index,cell]of row.controls.entries()){expect(cell.width).toBeGreaterThanOrEqual(42);expect(cell.x).toBe(columns[index]!.x);expect(cell.width).toBe(columns[index]!.width);expect(cell.control).toBe(f.controls[Number(row.row.id.slice(7))]![index]);}
   }
   if(viewport.width<=960)expect(region.contentWidth).toBeGreaterThan(region.width);
  }
  expect(JSON.stringify(f.page)).toBe(before);
 });
 it('wraps long headings without shrinking glyphs or removing their complete labels',()=>{
  const f=workPage(),box=layoutNativePage(f.page,{width:480,height:400},false,measure),header=box.rows[0]!,columns=nativeMatrixColumns(header.row,header.x,header.width,labels.length,header.matrixTail);
  for(const [index,label]of labels.entries()){
   const lines=nativeMatrixHeadingLines(label,columns[index]!.width-5,measure);expect(lines.length).toBeLessThanOrEqual(2);expect(lines.join('').replaceAll(' ','')).toBe(label.replaceAll(' ',''));for(const line of lines)expect(measure(line,12,true)).toBeLessThanOrEqual(columns[index]!.width-5);
   expect(header.row.columns![index]!.hint).toBe('Priorité '+label);
  }
 });
 it('keeps every name and its full hint fixed while the matrix scrolls horizontally and vertically',()=>{
  const box=layoutNativePage(workPage(40).page,{width:480,height:400},false,measure),stage=stageAccess(box),region=box.regions.catalogue!;
  const names:Array<{text:string;x:number;y:number;width:number}>=[];stage.semanticText=(_ctx,text,x,y,width)=>names.push({text,x,y,width});
  expect(stage.primaryRegion()).toBe('catalogue');stage.setRegionOffset('catalogue',50);stage.setHorizontalOffset('catalogue',100000);
  expect(stage.horizontalOffset('catalogue')).toBe(region.contentWidth!-region.width);expect(stage.regionOffset('catalogue')).toBe(50);
  const row=box.rows[1]!,hint=stage.rowHint(row.row);expect(hint).toContain('Colon 0');expect(hint).toContain('Disponible');stage.drawMatrixName({} as CanvasRenderingContext2D,row,box.header+row.top-stage.regionOffset('navigation'));
  stage.setHorizontalOffset('catalogue',-100);expect(stage.horizontalOffset('catalogue')).toBe(0);expect(stage.regionOffset('catalogue')).toBe(50);expect(stage.graphX).toBe(0);stage.drawMatrixName({} as CanvasRenderingContext2D,row,box.header+row.top-stage.regionOffset('navigation'));
  expect(names).toHaveLength(2);expect(names[0]).toEqual(names[1]);expect(names[0]!.text).toBe('Colon 0');expect(names[0]!.x).toBe(box.regions.navigation!.x);expect(names[0]!.width).toBeLessThan(box.regions.navigation!.width);expect(stage.rowHint(row.row)).toBe(hint);
  stage.setRegionOffset('navigation',75);expect(stage.regionOffset('navigation')).toBe(75);expect(stage.regionOffset('catalogue')).toBe(75);expect(stage.horizontalOffset('navigation')).toBe(0);
  expect(stage.regionGroup('navigation')).toBe(stage.regionGroups.navigation);expect(stage.regionGroup()).toBe(stage.regionGroups.details);expect(stage.regionGroup('catalogue')).toBe(stage.pageContent);
 });
 it('creates distinct horizontal and vertical controls inside the unchanged clipping region',()=>{
  const box=layoutNativePage(workPage(40).page,{width:480,height:400},false,measure),stage=stageAccess(box),pieces=new Map<string,{userData:Record<string,unknown>}>(),dimensions=new Map<string,{w:number;h:number}>();
  stage.pagePiece=((id:string,spec:{w:number;h:number})=>{expect(pieces.has(id)).toBe(false);const piece={userData:{}};pieces.set(id,piece);dimensions.set(id,spec);return piece;}) as typeof stage.pagePiece;stage.pageGroup={add:()=>{}};stage.drawScrollbars(box);
  expect([...pieces.keys()]).toEqual(['native-scrollbar','native-scroll-thumb','native-scroll:catalogue:x:track','native-scroll:catalogue:x:thumb']);
  expect([...pieces.values()].map(piece=>(piece.userData.nativeScroll as {axis:string}).axis)).toEqual(['y','y','x','x']);
  expect(dimensions.get('native-scrollbar')!.w).toBe(.16);expect(dimensions.get('native-scroll-thumb')!.w).toBe(.16);
  expect(dimensions.get('native-scroll:catalogue:x:track')!.h).toBe(.16);expect(dimensions.get('native-scroll:catalogue:x:thumb')!.h).toBe(.16);
  expect((pieces.get('native-scroll:catalogue:x:track')!.userData.nativeScroll as {start:number}).start).toBe(box.x+box.regions.catalogue!.x);
  expect(box.footer).toBeGreaterThanOrEqual(22);expect(box.body.height).toBeGreaterThan(0);expect(box.body.y+box.body.height+8).toBeLessThanOrEqual(box.height);
 });
 it('preserves every priority dropdown, full tooltip, caption and original callback',async()=>{
  const f=workPage(),box=layoutNativePage(f.page,{width:480,height:400},false,measure),row=box.rows[1]!;
  for(const cell of row.controls){expect(cell.control.caption).toBe('20 ♨ ♨');expect(cell.control.hint).toContain('passion brûlante');expect(cell.control.select!.options.map(option=>option.value)).toEqual(['0','1','2','3','4']);}
  await row.controls.at(-1)!.control.select!.onChange('1');expect(f.changes).toEqual(['0:17:1']);expect(f.page.rows[1]!.controls!.at(-1)!.select!.value).toBe('2');
 });
});
