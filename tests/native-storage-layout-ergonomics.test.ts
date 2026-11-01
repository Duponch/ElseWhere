import {expect,test} from 'vitest';
import {createNativeStorageEditor} from '../src/ui3d/native-storage-editor';
import {layoutNativePage,NATIVE_UI} from '../src/ui3d/native-layout';
import type {NativePage,NativeRow} from '../src/ui3d/native-contract';

const measure=(s:string,size:number)=>Array.from(s).length*size*.54;
function fixture(){let page:NativePage;page=createNativeStorageEditor({id:'creation-storage',title:'Réglages du stockage',initial:{priority:2,filters:{wood:true,food:true}},show:next=>{page=next;},onApply:()=>{},onBack:()=>{}});return{get page(){return page;}};}
function layout(page:NativePage,width=1280,height=720){return layoutNativePage(page,{width,height},false,measure);}

test('expanding the catalogue never moves the fixed settings, search or footer and keeps compact independent targets',async()=>{
  const f=fixture(),before=layout(f.page);
  for(let i=0;i<100;i++){
    const closed=f.page.rows.find(row=>row.tree?.branch&&!row.tree.expanded&&!row.controls?.[0]?.disabled);
    if(!closed)break;await closed.controls![0]!.onActivate();
  }
  const after=layout(f.page);expect(after.width).toBe(480);expect(after.height).toBe(before.height);expect(after.y).toBe(before.y);
  expect(after.regions.details).toEqual(before.regions.details);expect(after.regions.navigation).toEqual(before.regions.navigation);expect(after.actions.map(x=>[x.x,x.y,x.width,x.height])).toEqual(before.actions.map(x=>[x.x,x.y,x.width,x.height]));
  expect(after.contentHeight).toBeGreaterThan(after.body.height);expect(after.rows.filter(r=>r.row.tree).length).toBeGreaterThan(40);
  const checks=after.rows.filter(r=>r.row.tree);
  for(const row of checks){
    expect(row.height).toBe(27);expect(row.labelLines).toHaveLength(1);
    const permission=row.controls.at(-1)!;expect(permission.width).toBeGreaterThanOrEqual(24);expect(permission.height).toBeGreaterThanOrEqual(24);
    expect(permission.x+permission.width).toBeCloseTo(row.x+row.width,6);
    expect(permission.control.label.length).toBeGreaterThan(1);expect(permission.control.glyph).toMatch(/allow|forbid|mixed/);
    if(row.row.tree!.branch)expect(row.controls[0]!.x+row.controls[0]!.width).toBeLessThan(permission.x);
  }
  for(const a of after.actions){expect(after.header+a.y).toBeGreaterThanOrEqual(after.height-after.footer);expect(after.header+a.y+a.height).toBeLessThanOrEqual(after.height);}
});

test('short viewports retain an independently reachable settings region and fixed search with a real tree viewport',()=>{
  const f=fixture(),box=layout(f.page,520,480),details=box.regions.details!,search=box.regions.navigation!,tree=box.regions.catalogue!;
  expect(box.height+NATIVE_UI.bottom).toBeLessThanOrEqual(480);expect(details.contentHeight).toBeGreaterThanOrEqual(details.height);expect(tree.height).toBeGreaterThanOrEqual(72);
  expect(details.y+details.height).toBeLessThanOrEqual(search.y);expect(search.contentHeight).toBe(search.height);expect(search.y+search.height).toBeLessThanOrEqual(tree.y);
  expect(tree.y+tree.height).toBeLessThanOrEqual(box.height-box.footer);
  for(const a of box.actions)expect(box.header+a.y+a.height).toBeLessThanOrEqual(box.height);
});

test('narrow storage panels stack paired fields and keep their editable values clear of labels and step buttons',()=>{
  const f=fixture();const fields:NativeRow[]=[0,1].map((column)=>({id:'pair-'+column,label:column?'PV max (%)':'PV min (%)',labelWidth:70,column:column as 0|1,region:'details',input:{value:column?'100':'0',kind:'number',onCommit:()=>{}},controls:[{id:'less-'+column,label:'−',onActivate:()=>{}},{id:'more-'+column,label:'+',onActivate:()=>{}}]}));
  const page={...f.page,rows:[...fields,...f.page.rows.filter(r=>r.region!=='details')]};
  const box=layout(page,360,600),rows=box.rows.filter(r=>r.row.id.startsWith('pair-'));
  expect(rows[0]!.x).toBe(rows[1]!.x);expect(rows[1]!.top).toBeGreaterThanOrEqual(rows[0]!.top+rows[0]!.height);
  for(const row of rows){const right=row.controls.length*28+6,inputWidth=row.width-row.labelWidth-right-8;expect(inputWidth).toBeGreaterThanOrEqual(70);for(const control of row.controls){expect(control.x).toBeGreaterThanOrEqual(row.x);expect(control.x+control.width).toBeLessThanOrEqual(row.x+row.width);}}
});
