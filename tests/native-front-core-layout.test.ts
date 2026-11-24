import {describe,expect,it,vi} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,type NativeRect,type TextMeasure} from '../src/ui3d/native-layout';
import {NATIVE_CREATION,NATIVE_FILE_LIST,nativeFileColumns} from '../src/ui3d/native-front-metrics';
import {NativeStage} from '../src/ui3d/NativeStage';

const measure:TextMeasure=(text,size)=>text.length*size*.53;
const button=(id:string,label=id):NativeControl=>({id,label,onActivate:vi.fn()});
const nav=[button('front-back','Retour'),button('next','Suivant')];
const cases:NativePage[]=[
  {id:'home',title:'Elsewhere',layout:'home',setupAnchor:'right',subtitle:'Au départ',rows:[
    {id:'notice',region:'navigation',label:'Un message de préparation long. '.repeat(12)},
    ...Array.from({length:8},(_,i):NativeRow=>({id:`play-${i}`,label:'',region:'catalogue',controls:[button('play-'+i,'Action de jeu '+i)]})),
    {id:'help',label:'',region:'details',controls:[button('help','Aide')]},
  ]},
  {id:'files',title:'Charger',layout:'files',subtitle:'Choisissez la copie',rows:[
    {id:'search',label:'Filtrer',region:'navigation',input:{value:'',onCommit:vi.fn()}},
    ...Array.from({length:25},(_,i):NativeRow=>({id:`save-${i}`,label:'',region:'catalogue',fileEntry:{date:'24/11/2026',kind:'Nommée',index:i},controls:[button('choose-'+i,'Sauvegarde '+i),button('load-'+i,'Charger')]})),
    {id:'metadata',label:'Informations',region:'details',detail:'Toutes les informations conservées. '.repeat(25)},
  ],actions:[nav[0]!,button('test','Colonies de test'),button('import','Importer un fichier'),button('rimworld','Importer une sauvegarde RimWorld'),nav[1]!]},
  {id:'world',title:'Paramètres',layout:'setup',setupProfile:'world',rows:[
    {id:'notice',region:'navigation',label:'Conserver l’avertissement. '.repeat(12)},
    ...Array.from({length:8},(_,i):NativeRow=>({id:`parameter-${i}`,label:'Paramètre '+i,region:'catalogue',input:{value:String(i),onCommit:vi.fn()},controls:[button('less-'+i,'−'),button('more-'+i,'+')]})),
    ...Array.from({length:5},(_,i):NativeRow=>({id:`faction-${i}`,label:'Faction '+i,region:'details',controls:[button('remove-'+i,'Retirer')]})),
  ],actions:[nav[0]!,button('reset','Réinitialiser'),nav[1]!]},
  {id:'site',title:'Lieu de départ',layout:'setup',setupProfile:'site',visual:{kind:'planet',surface:{} as NonNullable<NativePage['visual']>['surface'],selected:null,onSelect:vi.fn()},
    rows:[{id:'site-nav',region:'navigation',label:'',controls:[button('facts','Lieu choisi'),button('places','Lieux disponibles')]},{id:'tile',region:'navigation',label:'Case',input:{value:'',onCommit:vi.fn()}},
      ...Array.from({length:16},(_,i):NativeRow=>({id:`fact-${i}`,label:'Fait '+i,region:'details',value:'Valeur'}))],actions:[nav[0]!,button('random','Lieu aléatoire'),button('factions','Factions'),nav[1]!]},
];
function inside(outer:NativeRect,inner:NativeRect){
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);
}

describe('new front windows use bounded regions and the same action authorities',()=>{
  it('keeps every row and every original control on the small logical viewports',()=>{
    for(const viewport of [{width:720,height:410},{width:480,height:322},{width:320,height:240}])for(const page of cases){
      const box=layoutNativePage(page,viewport,true,measure),outer={x:0,y:0,width:box.width,height:box.height};
      inside({x:0,y:0,...viewport},box);inside(outer,box.body);expect(box.body.height,`${page.id} ${viewport.width} body`).toBeGreaterThan(0);
      for(const region of Object.values(box.regions)){inside(outer,region);expect(region.height,`${page.id} ${viewport.width} region`).toBeGreaterThan(0);}
      for(const action of box.actions)inside(outer,{...action,y:box.header+action.y});
      const controls=[...box.rows.flatMap(row=>row.controls.map(control=>control.control)),...box.actions.map(control=>control.control)];
      const expected=[...page.rows.flatMap(row=>row.controls??[]),...(page.actions??[])];
      expect(controls.map(c=>c.id).sort()).toEqual(expected.map(c=>c.id).sort());for(const control of expected)expect(controls).toContain(control);
      for(const row of page.rows)expect(box.rows.some(r=>r.row.id===row.id)).toBe(true);
      const files=box.rows.filter(row=>row.row.fileEntry);if(files.length){
        expect(files.every(row=>row.height===NATIVE_FILE_LIST.rowHeight)).toBe(true);
        for(const row of files){const c=nativeFileColumns(row.width);expect(row.controls[0]!.x+row.controls[0]!.width).toBeLessThan(row.controls[1]!.x);expect(row.controls[1]!.height).toBeLessThanOrEqual(box.regions.catalogue!.height);expect(c.actionX+c.action).toBe(row.width);}
      }
    }
  });
  it('keeps the site globe and selectable dossier disjoint, with a full four-choice footer',()=>{
    const page=cases[3]!,box=layoutNativePage(page,{width:1440,height:900},true,measure),globe=box.visualRect!,details=box.regions.details!;
    expect(globe.x+globe.width).toBeLessThan(details.x);expect(globe.height).toBe(details.height);
    expect(box.rows.every(row=>row.row.region==='details')).toBe(true);expect(box.rows.map(row=>row.row.id)).toEqual(page.rows.map(row=>row.id));
    expect(box.actions.every(a=>a.width===NATIVE_CREATION.buttonWidth&&a.height===NATIVE_CREATION.buttonHeight)).toBe(true);
    expect(box.actions[0]!.x+box.actions.at(-1)!.x+NATIVE_CREATION.buttonWidth).toBe(box.width);
  });
  it('does not let a zoomed globe acquire pointer input over the dossier or footer',()=>{
    const page=cases[3]!,viewport={width:1440,height:900},box=layoutNativePage(page,viewport,true,measure),pick=vi.fn(()=>27);
    const stage=Object.create(NativeStage.prototype) as {page:NativePage;pageBox:typeof box;globe:unknown;pointer:unknown;scene:unknown;raycaster:unknown;camera:unknown;width:number;height:number;displayScale:number;globeHit:(x:number,y:number)=>number|null};
    Object.assign(stage,{page,pageBox:box,globe:{visible:true,hitTest:pick},pointer:{set:vi.fn()},scene:{updateMatrixWorld:vi.fn()},raycaster:{setFromCamera:vi.fn()},camera:{},...viewport,displayScale:1});
    const r=box.regions.details!,g=box.visualRect!;
    expect(stage.globeHit(box.x+r.x+r.width/2,box.y+r.y+r.height/2)).toBeNull();expect(stage.globeHit(box.x+box.actions[0]!.x+20,box.y+box.header+box.actions[0]!.y+12)).toBeNull();expect(pick).not.toHaveBeenCalled();
    expect(stage.globeHit(box.x+g.x+g.width/2,box.y+g.y+g.height/2)).toBe(27);expect(pick).toHaveBeenCalledOnce();
  });
  it('pans the pregame Bio independently of catalogue, clamps to real content and leaves existing layouts alone',()=>{
    // Test the stage's actual scroll owner without constructing a renderer or a GPU.
    const stage=Object.create(NativeStage.prototype) as {page:NativePage;pageBox:unknown;setupDetailsX:number;graphX:number;paletteX:number;horizontalOffset:(region:string)=>number;setHorizontalOffset:(region:string,value:number)=>void};
    stage.page={id:'pawns',title:'Personnages',layout:'setup',setupProfile:'pawns',rows:[]};stage.pageBox={layout:'setup',regions:{details:{x:170,y:63,width:300,height:400,contentHeight:480,contentWidth:693}}};stage.setupDetailsX=stage.graphX=stage.paletteX=0;
    stage.setHorizontalOffset('details',1000);expect(stage.horizontalOffset('details')).toBe(393);expect(stage.horizontalOffset('catalogue')).toBe(0);
    stage.setHorizontalOffset('details',-20);expect(stage.horizontalOffset('details')).toBe(0);stage.setHorizontalOffset('details',120);expect(stage.horizontalOffset('details')).toBe(120);
    stage.page={id:'other',title:'Autre',layout:'setup',rows:[]};expect(stage.horizontalOffset('details')).toBe(0);
  });
});
