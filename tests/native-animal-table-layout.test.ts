import {describe,expect,it} from 'vitest';
import {layoutNativePage,nativeTableRowScroll,nativeMatrixColumns} from '../src/ui3d/native-layout';
import type {NativePage,NativeRow} from '../src/ui3d/native-contract';
const measure=(text:string,size:number)=>text.length*size*.51;
function page(id:'animals'|'wildlife'|'work'|'assign'|'animals-quotas',count=50):NativePage {
  const columns=id==='animals'?10:7,noop=()=>{};
  const rows:NativeRow[]=[{id:id+'-search',label:'Rechercher',region:'navigation',input:{value:'',onCommit:noop}},
    {id:id+'-filters',label:'',region:'navigation',controls:[{id:'sort',label:'Trier par nom',onActivate:noop}]},
    {id:id+'-headings',label:'Animal',value:'Activité',columns:Array.from({length:columns},(_,i)=>({label:'Colonne '+i}))},
    ...Array.from({length:count},(_,n)=>({id:'animal-'+n,label:'Animal '+n,value:'Attend',compact:true,
      controls:Array.from({length:columns},(_,i)=>({id:`animal-${n}-${i}`,label:i===0?'Femelle':'Choix',onActivate:noop}))}))];
  return {id,title:id,layout:'table',rows,width:id==='animals'?1640:1280};
}
describe('fixed headings of the two animal catalogues',()=>{
  it('keeps measured search/filters and column headings above a long list while the list alone moves',()=>{
    for(const id of ['animals','wildlife'] as const){
      const box=layoutNativePage(page(id),{width:1280,height:720},false,measure);
      const toolbar=box.rows.filter(row=>row.row.region==='details'),heading=box.rows.find(row=>row.row.columns)!,record=box.rows.find(row=>row.row.id==='animal-0')!;
      expect(box.tableHeader).toBeDefined();expect(toolbar).toHaveLength(2);
      expect(box.tableHeader!.y).toBeGreaterThanOrEqual(box.header+Math.max(...toolbar.map(row=>row.top+row.height)));
      expect(box.body.y).toBeGreaterThanOrEqual(box.tableHeader!.y+box.tableHeader!.height);
      expect(box.contentHeight).toBeGreaterThan(box.body.height);expect(record.height).toBe(34);expect(record.controls.every(c=>c.height>=24)).toBe(true);
      const short=layoutNativePage(page(id),{width:1280,height:480},false,measure);expect(short.body.height).toBeGreaterThanOrEqual(34);
      for(const scroll of [79,200]){
        expect(box.header+heading.top-nativeTableRowScroll(box,heading.row,scroll)).toBe(box.tableHeader!.y);
        expect(box.header+record.top-nativeTableRowScroll(box,record.row,scroll)).toBe(box.body.y-scroll);
        expect(toolbar.every(row=>row.row.region==='details'&&box.regions.details!.contentHeight===box.regions.details!.height)).toBe(true);
      }
      const columns=nativeMatrixColumns(heading.row,heading.x,heading.width,heading.row.columns!.length,heading.matrixTail,box.matrixColumnWeights);
      expect(record.controls.map(control=>control.x)).toEqual(columns.map(column=>column.x));
      expect(box.rows.every(row=>row.row.columns||row.row.region==='details'||box.header+row.top>=box.body.y)).toBe(true);
    }
  });
  it('retains readable intrinsic cells on a narrow viewport and leaves other table scroll rules unchanged',()=>{
    for(const id of ['animals','wildlife'] as const){
      const box=layoutNativePage(page(id),{width:700,height:720},false,measure),heading=box.rows.find(row=>row.row.columns)!;
      expect(box.width).toBeLessThanOrEqual(700-24);
      expect(heading.width).toBeGreaterThanOrEqual(id==='animals'?1140:1000);
      expect(box.regions.catalogue!.contentWidth).toBeGreaterThan(box.regions.catalogue!.width);
      const cells=nativeMatrixColumns(heading.row,heading.x,heading.width,heading.row.columns!.length,heading.matrixTail,box.matrixColumnWeights);
      expect(cells.every(cell=>cell.width>=44)).toBe(true);
      expect(box.regions.navigation!.x).toBe(box.body.x);expect(box.regions.navigation!.width).toBe(104);
    }
    for(const id of ['work','assign','animals-quotas'] as const){
      const box=layoutNativePage(page(id),{width:1280,height:720},false,measure),heading=box.rows.find(row=>row.row.columns)!;
      expect(box.tableHeader).toBeUndefined();expect(nativeTableRowScroll(box,heading.row,79)).toBe(79);
    }
  });
});
