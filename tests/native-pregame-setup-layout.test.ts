import {expect,test} from 'vitest';
import {layoutNativePage,type NativePageBox} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';

const measure=(text:string,size:number)=>Array.from(text).length*size*.51;
const button=(id:string,label=id):NativeControl=>({id,label,onActivate:()=>{}});
const bottom=(box:NativePageBox,id:string)=>{const row=box.rows.find(row=>row.row.id===id)!;return box.header+row.top+row.height;};
function roster(count=8):NativePage{
  // Layout-only projection: no person, World, creation ticket, image decode or command.
  const rows:NativeRow[]=[{id:'help',label:'Choisir trois personnes',value:'Les trois premiers partent.',region:'navigation'}];
  for(let i=0;i<count;i++){
    if(i===0||i===3)rows.push({id:'heading-'+i,label:i?'Laissés sur place':'Au départ',emphasis:'heading',region:'catalogue'});
    rows.push({id:'candidate-'+i,label:'',compact:true,controlStyle:'button',region:'catalogue',controls:[button('inspect-'+i,'Personne '+i)]});
  }
  rows.push({id:'name',label:'Nom',dense:true,region:'details',input:{value:'Soline',onCommit:()=>{}},controls:[button('reroll','↻')]},
    {id:'age',label:'Âge bio. / chrono.',value:'26 / 31 ans',dense:true,region:'details'},
    {id:'actions',label:'',dense:true,setupColumn:0,region:'details',controls:[button('leave','Laisser sur place'),button('up','↑'),button('down','↓')]},
    {id:'clothes',label:'Portrait',dense:true,setupColumn:0,region:'details',controls:[button('clothes','Masquer')]},
    {id:'bio',label:'Histoire',dense:true,emphasis:'heading',setupColumn:0,region:'details'},
    {id:'childhood',label:'Enfance',value:'Fermière',dense:true,setupColumn:0,region:'details'},
    {id:'skills',label:'Compétences',dense:true,emphasis:'heading',setupColumn:1,region:'details'});
  for(let i=0;i<12;i++)rows.push({id:'skill-'+i,label:'Compétence '+i,dense:true,setupColumn:1,region:'details',meter:{value:i,max:20,label:i+' / 20'}});
  rows.push({id:'health',label:'Santé',dense:true,emphasis:'heading',setupColumn:2,region:'details'},
    {id:'healthy',label:'Aucun problème enregistré',dense:true,setupColumn:2,region:'details'},
    {id:'relations',label:'Relations',dense:true,emphasis:'heading',setupColumn:2,region:'details'},
    {id:'unrelated',label:'Aucun lien connu',dense:true,setupColumn:2,region:'details'},
    {id:'team-heading',label:'Équipe choisie',emphasis:'heading',dense:true,region:'graph'});
  for(let i=0;i<12;i++)rows.push({id:'team-'+i,label:'Équipe '+i,dense:true,region:'graph',meter:{value:i,max:20,label:String(i)}});
  return{id:'declared-roster',title:'Préparer les personnages',layout:'setup',width:1260,height:764,setupCatalogueWidth:240,rows,portrait:{url:'layout-only-not-decoded',label:'Portrait déclaré'},actions:[button('previous','Précédent'),button('start','Démarrer')]};
}

test('wide setup keeps all12 skills and8 names reachable at720px; portrait uses the right header space, not Bio padding',()=>{
  const page=roster(),before=JSON.stringify(page),box=layoutNativePage(page,{width:1280,height:720},true,measure),details=box.regions.details!,catalogue=box.regions.catalogue!,portrait=box.portraitRect!;
  for(let i=0;i<12;i++)expect(bottom(box,'skill-'+i)).toBeLessThanOrEqual(details.y+details.height);
  expect(bottom(box,'candidate-7')).toBeLessThanOrEqual(catalogue.y+catalogue.height);
  const bio=box.rows.find(row=>row.row.id==='actions')!,name=box.rows.find(row=>row.row.id==='name')!,skills=box.rows.find(row=>row.row.id==='skills')!,health=box.rows.find(row=>row.row.id==='health')!;
  expect(box.header+bio.top).toBeLessThan(portrait.y+portrait.height);
  expect(name.x+name.width).toBeLessThanOrEqual(portrait.x);expect(skills.x).toBeGreaterThan(bio.x);expect(health.x).toBeGreaterThan(skills.x);
  expect(box.rows.find(row=>row.row.id==='candidate-0')!.controls[0]!.width).toBeGreaterThan(catalogue.width*.8);
  expect(JSON.stringify(page)).toBe(before);
});

test('long setup regions scroll without taking navigation/footer; narrow views retain rows and portrait bounds; two-lane story leaves no third blank lane',()=>{
  const long=roster(40),other=roster(40);other.rows.push(...Array.from({length:80},(_,i):NativeRow=>({id:'more-'+i,label:'Information '+i,region:'details',setupColumn:0,dense:true})));
  const wide=layoutNativePage(long,{width:1280,height:720},true,measure),changed=layoutNativePage(other,{width:1280,height:720},true,measure);
  expect(wide.regions.navigation).toEqual(changed.regions.navigation);expect(wide.actions.map(({control,...rect})=>({id:control.id,...rect}))).toEqual(changed.actions.map(({control,...rect})=>({id:control.id,...rect})));
  const small=layoutNativePage(other,{width:640,height:480},true,measure),p=small.portraitRect!,d=small.regions.details!;
  expect(small.rows.map(row=>row.row.id).sort()).toEqual(other.rows.map(row=>row.id).sort());expect(d.contentHeight).toBeGreaterThan(d.height);expect(small.regions.catalogue!.contentHeight).toBeGreaterThan(small.regions.catalogue!.height);
  expect(p.x).toBeGreaterThanOrEqual(d.x);expect(p.x+p.width).toBeLessThanOrEqual(d.x+d.width);expect(p.y+p.height).toBeLessThanOrEqual(d.y+d.height);
  for(const action of small.actions){expect(small.header+action.y).toBeGreaterThanOrEqual(small.height-small.footer);expect(small.header+action.y+action.height).toBeLessThanOrEqual(small.height);}
  const story:NativePage={id:'declared-story',title:'Conteur',layout:'setup',width:1260,rows:[{id:'a',label:'Difficulté',region:'details',setupColumn:0},{id:'b',label:'Sauvegarde',region:'details',setupColumn:1}]};
  const two=layoutNativePage(story,{width:1280,height:720},true,measure);expect(two.rows[0]!.width).toBeGreaterThan(two.regions.details!.width*.4);expect(two.rows[1]!.x).toBeGreaterThan(two.rows[0]!.x);
});

test('setup globe honors the existing ratio with bounded fallback while preserving separate dossier access',()=>{
  // Surface deliberately not materialized: the pure layout never reads geometry.
  const page:NativePage={id:'declared-site',title:'Lieu',layout:'setup',width:1260,columnRatio:.58,rows:[{id:'facts',label:'Faits conservés',region:'details'}],visual:{kind:'planet',surface:{} as NonNullable<NativePage['visual']>['surface'],selected:null,onSelect:()=>{}}};
  const box=(ratio:number|undefined)=>layoutNativePage({...page,columnRatio:ratio},{width:1280,height:720},true,measure);
  const requested=box(.58),fallback=box(undefined);expect(requested.visualRect!.width/fallback.visualRect!.width).toBeCloseTo(.58/.54);
  expect(box(.01).visualRect!.width).toBe(box(.35).visualRect!.width);expect(box(.99).visualRect!.width).toBe(box(.7).visualRect!.width);
  expect(requested.visualRect!.x+requested.visualRect!.width).toBeLessThan(requested.regions.details!.x);expect(requested.rows.map(row=>row.row.id)).toEqual(['facts']);
});

test('only the explicit home anchor moves the paper right; content and centered default retain their geometry',()=>{
  const home:NativePage={id:'declared-home',title:'Elsewhere',layout:'setup',width:480,height:550,rows:[{id:'new',label:'',compact:true,controlStyle:'button',region:'catalogue',controls:[button('new','Nouvelle partie')]}]};
  const center=layoutNativePage(home,{width:1280,height:720},true,measure),right=layoutNativePage({...home,setupAnchor:'right'},{width:1280,height:720},true,measure);
  expect(right.x).toBeGreaterThan(center.x);expect(right.x+right.width).toBeLessThan(1280);expect({...right,x:0}).toEqual({...center,x:0});expect(home.setupAnchor).toBeUndefined();
});
