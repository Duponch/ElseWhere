import {describe,expect,it,vi} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';
import {NATIVE_MESSAGE,NATIVE_OPTIONS} from '../src/ui3d/native-dialog-metrics';
import {NATIVE_WINDOW} from '../src/ui3d/native-ui-scale';

const measure:TextMeasure=(text,size)=>text.length*size*.53;
const button=(id:string,label=id):NativeControl=>({id,label,onActivate:vi.fn()});
const full={width:1440,height:900};
function inside(outer:NativeRect,inner:NativeRect){
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-0.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-0.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+0.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+0.01);
}
const pageWithMessage=(actions:NativeControl[]):NativePage=>({id:'message',title:'Confirmer',layout:'message',modal:true,
  rows:[{id:'paragraphs',label:Array.from({length:24},(_,index)=>`Paragraphe ${index+1} : le texte complet reste disponible.`).join('\n')}],actions});
const settingsRows:NativeRow[]=[...['Jeu','Interface','Graphismes','Éclairage','Audio','Textes de RimWorld','Développeur'].map((label,index)=>({id:`category-${index}`,label:'',region:'catalogue' as const,controls:[{...button(`category-${index}`,label),icon:'settings'}]})),
  ...Array.from({length:28},(_,index)=>({id:`setting-${index}`,label:`Réglage modifiable ${index}`,value:`${index} %`,region:'details' as const,input:{value:String(index),onCommit:vi.fn()},controls:[button(`minus-${index}`,'−'),button(`plus-${index}`,'+')]}))];
const settingsPage:NativePage={id:'front-options',title:'Options',layout:'options',modal:true,rows:settingsRows,actions:[button('front-back','OK')]};

describe('Core message window',()=>{
  it('uses the fixed centred sheet, a scrollable body and equal 35-point confirmation actions outside it',()=>{
    const cancel=button('cancel'),accept=button('accept'),page=pageWithMessage([cancel,accept]);
    for(const front of [true,false]){
      const box=layoutNativePage(page,full,front,measure),pad=NATIVE_WINDOW.margin;
      expect([box.width,box.height]).toEqual([NATIVE_MESSAGE.width,NATIVE_MESSAGE.height]);
      expect([box.x,box.y]).toEqual([(full.width-box.width)/2,(full.height-box.height)/2]);
      expect(box.body.y-pad).toBe(NATIVE_MESSAGE.titleHeight);expect(box.contentHeight).toBeGreaterThan(box.body.height);
      const lane=(box.width-pad*2)/2;
      expect(box.actions.map(a=>[a.x,box.header+a.y,a.width,a.height])).toEqual([[pad,box.height-pad-35,lane-10,35],[pad+lane+10,box.height-pad-35,lane-10,35]]);
      expect(box.actions.map(a=>a.control)).toEqual([cancel,accept]);
      expect(box.rows[0]!.labelLines).toHaveLength(24);
      expect(box.body.y+box.body.height).toBeLessThan(box.header+box.actions[0]!.y);
    }
    expect(cancel.onActivate).not.toHaveBeenCalled();expect(accept.onActivate).not.toHaveBeenCalled();
  });
  it('places a single acknowledgement on the right and preserves three explicit choices',()=>{
    const single=layoutNativePage(pageWithMessage([button('okay','OK')]),full,true,measure);
    expect(single.actions[0]!.x).toBeGreaterThan(single.width/2);expect(single.actions[0]!.x+single.actions[0]!.width).toBe(single.width-NATIVE_WINDOW.margin);
    const controls=[button('cancel'),button('alternative'),button('accept')];
    const triple=layoutNativePage(pageWithMessage(controls),full,false,measure);
    expect(triple.actions.map(a=>a.control)).toEqual(controls);
    for(let i=1;i<triple.actions.length;i++)expect(triple.actions[i]!.x).toBeGreaterThan(triple.actions[i-1]!.x+triple.actions[i-1]!.width);
  });
});

describe('Core Options window',()=>{
  it('reserves the fixed category rail and footer, keeps independent scroll extents and retains all actual controls',()=>{
    const box=layoutNativePage(settingsPage,full,true,measure),o=NATIVE_OPTIONS,pad=NATIVE_WINDOW.margin;
    expect([box.width,box.height]).toEqual([o.width,o.height]);
    expect(box.regions.catalogue).toMatchObject({x:pad,width:o.categoryWidth,contentHeight:7*50-2});
    expect(box.regions.details!.x-pad).toBe(o.categoryWidth+o.sectionGap);
    expect(box.regions.details!.contentHeight).toBeGreaterThan(box.regions.details!.height);
    expect(box.rows.slice(0,7).map(r=>[r.top,r.height,r.controls[0]!.height,r.controls[0]!.width])).toEqual(Array.from({length:7},(_,i)=>[i*50,48,40,152]));
    expect(box.actions[0]).toMatchObject({x:(o.width-o.okayWidth)/2,width:o.okayWidth,height:o.okayHeight});
    expect(box.header+box.actions[0]!.y).toBe(box.height-pad-o.okayHeight);
    expect(box.rows.flatMap(r=>r.controls.map(c=>c.control))).toEqual(settingsPage.rows.flatMap(r=>r.controls??[]));
    expect(box.rows.filter(r=>r.row.input).every(r=>r.inputRect!.x+r.inputRect!.width<r.controls[0]!.x)).toBe(true);
  });
  it('keeps both lanes, warnings, editable inputs and all actions bounded at reduced logical scales',()=>{
    const page:NativePage={...settingsPage,rows:[{id:'front-error',region:'navigation',label:'Une préférence n’a pas pu être enregistrée. '.repeat(20)},...settingsRows]};
    for(const viewport of [{width:720,height:410},{width:480,height:322},{width:480,height:240},{width:320,height:240}]){
      for(const current of [page,pageWithMessage([button('no'),button('yes')])]){
        const box=layoutNativePage(current,viewport,true,measure),outer={x:0,y:0,width:box.width,height:box.height};
        inside({x:0,y:0,...viewport},box);inside(outer,box.body);expect(box.body.height).toBeGreaterThan(0);
        for(const region of Object.values(box.regions)){inside(outer,region);expect(region.height).toBeGreaterThan(0);}
        for(const action of box.actions)inside(outer,{...action,y:box.header+action.y});
        expect(box.rows.map(r=>r.row.id)).toEqual(current.rows.map(r=>r.id));
        if(box.regions.catalogue)expect(box.rows.filter(r=>r.row.region==='catalogue').every(r=>r.controls.every(c=>c.height<=box.regions.catalogue!.height))).toBe(true);
        for(const row of box.rows.filter(r=>r.inputRect)){
          const region=box.regions.details!,input=row.inputRect!;
          expect(input.x).toBeGreaterThanOrEqual(region.x);expect(input.x+input.width).toBeLessThanOrEqual(region.x+region.width);
          expect(input.y+input.height).toBeLessThanOrEqual(row.top+row.height);
          expect(row.controls.every(control=>control.x>=input.x+input.width)).toBe(true);
        }
      }
    }
  });
});
