import {describe,it,expect} from 'vitest';
import {PAWN_TABLE,PAWN_COLUMN,WORK_COLUMN_LABEL,pawnTableWidths,pawnTableSpec,workLabelDown} from '../src/ui3d/native-pawn-table';
import {layoutNativePage,nativeMatrixHeadingLines} from '../src/ui3d/native-layout';
import type {NativePage,NativeRow,NativeControl} from '../src/ui3d/native-contract';
import {NATIVE_TEXT} from '../src/ui3d/native-ui-scale';
const measure=(text:string,size:number)=>text.length*size*.5;
const noop=()=>{};
const works=Object.keys(WORK_COLUMN_LABEL);
function workPage(pawns:number):NativePage{
  const cell=(id:string):NativeControl=>({id,label:'1',onActivate:noop,onSecondary:noop});
  const head:NativeRow={id:'work-headings',label:'Colon',value:'Activité',compact:true,columns:[{label:'Copier'},{label:'Coller'},...works.map(w=>({label:WORK_COLUMN_LABEL[w]!}))]};
  const rows:NativeRow[]=[head,...Array.from({length:pawns},(_,i)=>({id:`worker-${i}`,label:`Colon ${i}`,value:'Au repos',compact:true,controls:[cell(`work-${i}-copy`),cell(`work-${i}-paste`),...works.map(w=>cell(`work-${i}-${w}`))]}))];
  return {id:'work',title:'Travail',layout:'table',tableProfile:'colonists',rows,width:1480};
}
describe('RimWorld pawn tables (PawnTable, WidgetsWork, worker classes)',()=>{
  it('uses the decompiled constants',()=>{
    expect(PAWN_TABLE).toMatchObject({rowHeight:30,workHeaderHeight:50,workBox:25,workBoxTop:2.5,minWidth:998,scrollbar:16,gapTiny:4});
    expect(PAWN_COLUMN.work).toEqual({min:32,optimal:39,max:80});expect(PAWN_COLUMN.label.min).toBe(80);expect(PAWN_COLUMN.label.optimal).toBe(165);
    expect(PAWN_COLUMN.hour.optimal*24).toBe(504);expect(PAWN_COLUMN.hour.min*24).toBe(360);expect(PAWN_COLUMN.hour.max*24).toBe(600);
    expect(PAWN_COLUMN.policy).toMatchObject({min:194,optimal:251});expect(PAWN_COLUMN.area).toMatchObject({min:200,optimal:273});
  });
  it('shares the free width like PawnTable: minimums, then optimals, then maximums',()=>{
    const cols=[PAWN_COLUMN.label,PAWN_COLUMN.work,PAWN_COLUMN.work];
    expect(pawnTableWidths(cols,80+32+32)).toEqual([80,32,32]);
    expect(pawnTableWidths(cols,165+39+39)).toEqual([165,39,39]);
    const wide=pawnTableWidths(cols,600);expect(wide.reduce((a,b)=>a+b,0)).toBe(600);expect(wide[1]).toBeLessThanOrEqual(80);expect(wide[0]).toBeGreaterThan(165);
    expect(pawnTableWidths(cols,100)).toEqual([80,32,32]);
  });
  it('never cuts a heading word and lowers every other work label',()=>{
    for(const label of Object.values(WORK_COLUMN_LABEL)){expect(label).not.toMatch(/[.\s…]/);expect(label.length).toBeGreaterThan(2);}
    expect(works.map((_,i)=>workLabelDown(i)).slice(0,4)).toEqual([true,false,true,false]);
    const m=(t:string)=>measure(t,NATIVE_TEXT.small);
    for(const kind of ['assign','animals','wildlife'] as const){
      const labels=kind==='assign'?['Régime','Hostilité','Zone','Tenue','Auto','Port forcé','Drogues','Lecture']:['Sexe','Âge','Maturité','Soins','Zone / enclos','Produit','Transport','Abattre','Repérer','Dossier','Position','Chasse','Rage si blessé','Apprivoiser','Rage si raté','Tirer','Mêlée'];
      const {spec}=pawnTableSpec(kind,labels,1500,m,true);
      labels.forEach((label,i)=>{for(const word of label.split(' ')){expect(nativeMatrixHeadingLines(word,spec.widths[i]!-5,(t,s)=>measure(t,s)).length).toBe(1);}});
    }
  });
  it('lays the Work table out with rows of 30, a header of 50 and 25 x 25 boxes',()=>{
    const box=layoutNativePage(workPage(80),{width:1920,height:1080},false,measure),head=box.rows.find(r=>r.row.columns)!,record=box.rows.find(r=>r.row.id==='worker-3')!;
    expect(head.height).toBe(50);expect(record.height).toBe(30);expect(box.matrixSpec!.rowHeight).toBe(30);
    const cells=record.controls.slice(2);expect(cells.every(c=>c.width===25&&c.height===25)).toBe(true);
    expect(cells[0]!.y-record.top).toBe(2.5);
    expect(box.matrixSpec!.widths.slice(2).every(w=>w>=32&&w<=80)).toBe(true);
    expect(box.width).toBeLessThanOrEqual(1920-24);
    const narrow=layoutNativePage(workPage(80),{width:900,height:700},false,measure);expect(narrow.regions.catalogue!.contentWidth).toBeGreaterThan(narrow.regions.catalogue!.width);
  });
});
