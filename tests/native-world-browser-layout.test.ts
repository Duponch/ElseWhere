import {describe,expect,it} from 'vitest';
import type {NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,type NativeRect} from '../src/ui3d/native-layout';
const measure=(text:string,size:number)=>text.length*size*.52;
const control=(id:string,label=id)=>({id,label,onActivate:()=>{throw Error('Layout cannot activate navigation.');}});
function page(count:number,globe:boolean):NativePage{return{id:'world',title:'Monde',subtitle:'Colonies, caravanes et lieux.',layout:'world',width:1120,height:740,
  rows:[{id:'world-tabs',label:'',region:'navigation',controlStyle:'tab',controls:['Cartes et globe','Caravanes','Voyages individuels','Factions'].map(label=>control(label))},
    {id:'world-jump',label:'Aller à',region:'navigation',controls:[control('jump-choice','Foyer · case32'),control('jump-go','Afficher')]},
    ...Array.from({length:count},(_,i):NativeRow=>({id:'map-'+i,label:'Colonie '+i,value:'3 personnes · case '+i,region:'catalogue',controls:[control('view-'+i,'Afficher'),control('prepare-'+i,'Préparer une caravane')]}))],
  // Geometry-only truthiness fixture, deliberately not a drawable surface or
  // a played/admitted campaign. Runtime globe proof uses actual geography.
  ...(globe?{visual:{kind:'planet'} as NonNullable<NativePage['visual']>}:{})};}
function inside(outer:NativeRect,inner:NativeRect){expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);}
describe('World browser keeps navigation independently accessible',()=>{
  it('fits a short nonvisual list and preserves fixed navigation, every long row and its final scroll access',()=>{
    const view={width:1280,height:900},small=layoutNativePage(page(3,false),view,false,measure),long=layoutNativePage(page(45,false),view,false,measure);
    expect(small.height).toBeLessThan(long.height);expect(small.contentHeight).toBeLessThanOrEqual(small.body.height);expect(long.contentHeight).toBeGreaterThan(long.body.height);
    expect(small.regions.navigation).toEqual(long.regions.navigation);expect(long.rows.filter(r=>r.row.id.startsWith('map-'))).toHaveLength(45);
    const nav=long.regions.navigation!,last=long.rows.at(-1)!,offset=long.contentHeight-long.body.height;
    expect(nav.y+nav.height).toBeLessThan(long.body.y);expect(long.header+last.top+last.height-offset).toBeCloseTo(long.body.y+long.body.height,6);
    for(const c of long.rows[0]!.controls)expect(c.height).toBe(34);
  });
  it('retains a separate useful globe on desktop and narrow screens, with all controls and short-screen navigation reachable',()=>{
    for(const view of [{width:1280,height:720},{width:480,height:720},{width:480,height:360}]){
      const source=page(30,true),before=JSON.stringify(source),box=layoutNativePage(source,view,false,measure),nav=box.regions.navigation!,globe=box.visualRect!;
      expect(globe).toBeDefined();inside({x:0,y:0,width:box.width,height:box.height},globe);inside({x:0,y:0,width:box.width,height:box.height},box.body);inside({x:0,y:0,...view},box);
      expect(globe.width).toBeGreaterThan(0);expect(globe.height).toBeGreaterThan(0);expect(box.body.height).toBeGreaterThan(0);
      expect(globe.y).toBeGreaterThanOrEqual(nav.y+nav.height);expect(box.body.y).toBeGreaterThanOrEqual(nav.y+nav.height);
      if(view.width>=850)expect(globe.x+globe.width).toBeLessThanOrEqual(box.body.x);else expect(globe.y+globe.height).toBeLessThanOrEqual(box.body.y);
      expect(box.rows.filter(r=>r.row.id.startsWith('map-'))).toHaveLength(30);expect(JSON.stringify(source)).toBe(before);
      const lastNav=box.rows.filter(r=>r.row.region==='navigation').at(-1)!,navOffset=Math.max(0,nav.contentHeight-nav.height);
      expect(box.header+lastNav.top+lastNav.height-navOffset).toBeCloseTo(nav.y+nav.height,6);
    }
  });
});
