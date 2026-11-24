import {describe,expect,it,vi} from 'vitest';
import type {NativeControl,NativePage,NativeRow} from '../src/ui3d/native-contract';
import {layoutNativePage,type NativePageBox,type NativeRect,type NativeRowBox,type TextMeasure} from '../src/ui3d/native-layout';
import {NATIVE_FILE_LIST,nativeFileColumns} from '../src/ui3d/native-front-metrics';
import {NATIVE_TRADE,nativeTradeColumns} from '../src/ui3d/native-dialog-metrics';
import {NativeStage} from '../src/ui3d/NativeStage';

const measure:TextMeasure=(s,size)=>s.length*size*.53;
const button=(id:string,label=id):NativeControl=>({id,label,onActivate:vi.fn()});
const fileRows=Array.from({length:17},(_,i):NativeRow=>({id:`copy-${i}`,label:`Une colonie ${i}`,region:'catalogue',fileEntry:{date:'24/11/2026',kind:'Nommée',index:i,manage:true},controls:[button(`load-${i}`,'Charger'),{...button(`manage-${i}`,'Gérer cette copie'),presentation:'icon',icon:'settings'}]}));
const manager:NativePage={id:'native-saves',title:'Sauvegardes',layout:'files',modal:true,rows:[
  {id:'current',label:'Partie actuelle',region:'navigation',controls:[button('save','Sauvegarder'),button('export','Exporter'),button('refresh','Actualiser')]},
  {id:'save-search',label:'Rechercher une copie',region:'navigation',input:{value:'',onCommit:vi.fn()}},
  {id:'capacity',label:'Emplacements nommés',region:'navigation',value:'12 / 12'},...fileRows,
  {id:'selected',label:'Sélection : Une colonie 0',value:'Sauvegarde nommée',region:'details',detail:'Jour 2 · 250 × 250',controls:[button('overwrite','Remplacer par la partie actuelle'),button('delete','Supprimer cette copie')]},
  {id:'name',label:'Nouvelle sauvegarde nommée',region:'toolbar',input:{value:'Nouvelle halte',onCommit:vi.fn()},controls:[button('create','Créer')]},
],actions:[button('back','Retour')]};
const stockRows=Array.from({length:240},(_,i):NativeRow=>{
  const refused=i===2;
  return{id:`stock-${i}`,label:i===0?'Bois':i===1?'Composant':'Bien '+i,region:'catalogue',tradeEntry:{side:i%2?'buy':'sell',available:127+i,unitPrice:3.5+i,quantity:i===1?2:0,refused,index:i},
    ...(refused?{}:{input:{value:i===1?'2':'0',kind:'number',onCommit:vi.fn()}}),
    controls:[{...button('less-'+i,'−'),disabled:refused},{...button('more-'+i,'+'),disabled:refused}]};
});
const trade:NativePage={id:'native-local-trade-visitors',title:'Commerce',layout:'trade',modal:true,rows:[
  {id:'parties',label:'Négociateur : Eden Brun',value:'Marchand : Vaurien',region:'navigation'},
  {id:'funds',label:'Argent disponible',value:'Colonie 50 · Marchand 500',region:'navigation'},
  {id:'filter',label:'Rechercher',region:'navigation',input:{value:'',onCommit:vi.fn()},controls:[button('side','Tous les biens'),button('sort','Ordre du catalogue')]},
  {id:'heading',label:'Marchandises',region:'toolbar',tradeHeading:true},...stockRows,
  {id:'basket',label:'Panier',region:'details',value:'À recevoir : 80 argent',detail:'2 lots'},
  {id:'shortfall',label:'Perte de 20 argent',region:'details',value:'Acceptation requise',controls:[button('accept','Accepter cette perte')]},
],actions:[button('reset','Vider le panier'),button('quote','Vérifier le panier'),button('close','Fermer')]};
const viewport={width:1440,height:900};
function inside(outer:NativeRect,inner:NativeRect){
  expect(inner.x).toBeGreaterThanOrEqual(outer.x-.01);expect(inner.y).toBeGreaterThanOrEqual(outer.y-.01);
  expect(inner.x+inner.width).toBeLessThanOrEqual(outer.x+outer.width+.01);expect(inner.y+inner.height).toBeLessThanOrEqual(outer.y+outer.height+.01);
}
function noControlsLost(page:NativePage,box:NativePageBox){
  const originals=[...page.rows.flatMap(row=>row.controls??[]),...(page.actions??[])],actual=[...box.rows.flatMap(row=>row.controls.map(control=>control.control)),...box.actions.map(action=>action.control)];
  expect(actual.map(c=>c.id).sort()).toEqual(originals.map(c=>c.id).sort());for(const original of originals)expect(actual).toContain(original);
  expect(box.rows.map(row=>row.row.id).sort()).toEqual(page.rows.map(row=>row.id).sort());
}
function nonOverlappingRegions(box:NativePageBox){
  const outer={x:0,y:0,width:box.width,height:box.height},regions=Object.values(box.regions).sort((a,b)=>a.y-b.y);
  for(const region of regions){inside(outer,region);expect(region.height).toBeGreaterThan(0);expect(region.y+region.height).toBeLessThanOrEqual(box.height-box.footer+.01);}
  for(let i=1;i<regions.length;i++)expect(regions[i-1]!.y+regions[i-1]!.height).toBeLessThanOrEqual(regions[i]!.y+.01);
  for(const action of box.actions){inside(outer,{...action,y:box.header+action.y});expect(box.header+action.y).toBeGreaterThanOrEqual(box.height-box.footer);}
}

describe('Core file manager and local/orbital trade sheet',()=>{
  it('uses the exact file name form and disjoint load and manage controls at nominal scale',()=>{
    const box=layoutNativePage(manager,viewport,false,measure),m=NATIVE_FILE_LIST;
    expect([box.width,box.height]).toEqual([620,700]);nonOverlappingRegions(box);noControlsLost(manager,box);
    const row=box.rows.find(row=>row.row.fileEntry)!,c=nativeFileColumns(row.width,true),form=box.rows.find(row=>row.row.id==='name')!;
    expect([row.height,c.info,row.controls[0]!.width,row.controls[1]!.width,row.controls[0]!.height]).toEqual([m.rowHeight,m.infoWidth,m.actionWidth,m.manageWidth,m.actionHeight]);
    expect(form.inputRect!.width).toBe(m.nameFieldWidth);expect(form.inputRect!.height).toBe(m.nameFieldHeight);
    expect(form.controls[0]!.x-(form.inputRect!.x+form.inputRect!.width)).toBe(m.nameFieldGap);
    expect(form.top+box.header).toBe(box.regions.toolbar!.y);expect(box.regions.details!.y+box.regions.details!.height).toBeLessThan(box.regions.toolbar!.y);
  });
  it('uses actual stock and price columns, one fixed record per physical lot, a fixed header and a fixed quote footer',()=>{
    const box=layoutNativePage(trade,viewport,false,measure),m=NATIVE_TRADE,row=box.rows.find(row=>row.row.tradeEntry)!,c=nativeTradeColumns(row.width);
    expect(box.width).toBe(1024);expect(box.height).toBe(viewport.height-24);expect(c.compact).toBe(false);
    expect([c.count,c.price,c.adjust]).toEqual([75,100,240]);expect(c.buyCountX+c.count).toBe(row.width);
    expect(box.rows.filter(row=>row.row.tradeEntry).every(r=>r.height===m.rowHeight)).toBe(true);
    expect(box.regions.catalogue!.contentHeight).toBe(stockRows.length*m.rowHeight);
    expect(box.actions.map(action=>action.control.id)).toEqual(['reset','quote','close']);expect(box.actions.every(a=>a.width===160&&a.height===40)).toBe(true);
    expect(box.regions.toolbar!.y+box.regions.toolbar!.height).toBe(box.regions.catalogue!.y);
    const refused=box.rows.find(row=>row.row.tradeEntry?.refused)!;expect(refused.inputRect).toBeUndefined();expect(refused.controls.every(c=>c.control.disabled)).toBe(true);
    nonOverlappingRegions(box);noControlsLost(trade,box);
  });
  it('keeps every control reachable on reduced viewports without spilling a numeric field into another lot',()=>{
    for(const small of [{width:900,height:530},{width:620,height:410},{width:480,height:322},{width:320,height:240}])for(const page of [manager,trade]){
      const box=layoutNativePage(page,small,false,measure);inside({x:0,y:0,...small},box);nonOverlappingRegions(box);noControlsLost(page,box);
      for(const r of box.rows.filter(r=>r.row.fileEntry||r.row.tradeEntry||r.row.id==='name'||r.row.id==='filter')){
        const bounds={x:r.x,y:r.top,width:r.width,height:r.height},rects=[...r.controls,...(r.inputRect?[r.inputRect]:[])];
        for(const rect of rects)inside(bounds,rect);
        for(const [i,a]of rects.entries())for(const b of rects.slice(i+1))expect(a.x+a.width<=b.x+.01||b.x+b.width<=a.x+.01||a.y+a.height<=b.y+.01||b.y+b.height<=a.y+.01).toBe(true);
        if(r.row.tradeEntry){const c=nativeTradeColumns(r.width);expect(r.height).toBe(c.compact?NATIVE_TRADE.compactRowHeight:NATIVE_TRADE.rowHeight);expect(rects.every(rect=>rect.x>=r.x+c.adjustX-.01)).toBe(true);}
      }
    }
  });
  it('keeps independent native scroll and pointer regions for the heading, records and confirmation facts',()=>{
    const box=layoutNativePage(trade,viewport,false,measure);
    const stage=Object.create(NativeStage.prototype) as {pageBox:NativePageBox;page:NativePage;displayScale:number;scroll:number;regionOffsets:Record<string,number>;primaryRegion:()=>string;regionAt:(x:number,y:number)=>string;setRegionOffset:(r:string,value:number)=>void;rowOffset:(r:NativeRow)=>number};
    Object.assign(stage,{page:trade,pageBox:box,displayScale:1,scroll:0,regionOffsets:{navigation:0,details:0,toolbar:0,graph:0}});
    expect(stage.primaryRegion()).toBe('catalogue');for(const key of ['navigation','catalogue','details','toolbar'] as const){const r=box.regions[key]!;expect(stage.regionAt(box.x+r.x+r.width/2,box.y+r.y+r.height/2)).toBe(key);}
    stage.setRegionOffset('catalogue',1e9);expect(stage.scroll).toBe(box.contentHeight-box.body.height);expect(stage.rowOffset(stockRows[0]!)).toBe(stage.scroll);
    expect(stage.rowOffset(trade.rows.find(row=>row.tradeHeading)!)).toBe(0);expect(stage.rowOffset(trade.rows.find(row=>row.id==='basket')!)).toBe(0);
  });
  it('paints the recorded side in its own columns and a refused lot without a purchasable price',()=>{
    const box=layoutNativePage(trade,viewport,false,measure),stage=Object.create(NativeStage.prototype) as {font:(role:string,bold?:boolean)=>string;drawPageRow:(ctx:CanvasRenderingContext2D,row:NativeRowBox,top:number,rng:()=>number,box:NativePageBox)=>void};
    stage.font=()=> 'sans-serif';const fillText=vi.fn(),ctx={fillText,fillRect:vi.fn()} as unknown as CanvasRenderingContext2D;
    const row=box.rows.find(row=>row.row.id==='stock-0')!,c=nativeTradeColumns(row.width);stage.drawPageRow(ctx,row,0,()=>.5,box);
    expect(fillText.mock.calls).toContainEqual(['127',row.x+c.sellCountX+c.count/2,NATIVE_TRADE.rowHeight/2+4,c.count-3]);
    expect(fillText.mock.calls).toContainEqual(['3,5',row.x+c.sellPriceX+c.price/2,NATIVE_TRADE.rowHeight/2+4,c.price-3]);
    expect(fillText.mock.calls).toContainEqual(['—',row.x+c.buyPriceX+c.price/2,NATIVE_TRADE.rowHeight/2+4,c.price-3]);
    fillText.mockClear();stage.drawPageRow(ctx,box.rows.find(row=>row.row.id==='stock-1')!,0,()=>.5,box);expect(fillText.mock.calls).toContainEqual(['128',row.x+c.buyCountX+c.count/2,NATIVE_TRADE.rowHeight/2+4,c.count-3]);
    fillText.mockClear();stage.drawPageRow(ctx,box.rows.find(row=>row.row.id==='stock-2')!,0,()=>.5,box);expect(fillText.mock.calls.some(call=>call[0]==='Refusé')).toBe(true);expect(fillText.mock.calls.some(call=>call[0]==='5,5')).toBe(false);
  });
  it('labels an outgoing gift as recognized value and never as a purchase or a payment',()=>{
    const heading:NativeRow={id:'gift-heading',label:'Marchandises',region:'toolbar',tradeHeading:{source:'Caravane',partner:'Destinataire',gift:true}};
    const good:NativeRow={...stockRows[0]!,tradeEntry:{side:'gift',available:14,unitPrice:7.25,quantity:-2,refused:false,index:0}};
    const page:NativePage={...trade,rows:[heading,good]},box=layoutNativePage(page,viewport,false,measure),stage=Object.create(NativeStage.prototype) as {font:(role:string)=>string;drawPageRow:(ctx:CanvasRenderingContext2D,row:NativeRowBox,top:number,rng:()=>number,box:NativePageBox)=>void};
    stage.font=()=> 'sans-serif';const fillText=vi.fn(),ctx={fillText,fillRect:vi.fn()} as unknown as CanvasRenderingContext2D;
    stage.drawPageRow(ctx,box.rows.find(row=>row.row.id===heading.id)!,0,()=>.5,box);const labels=fillText.mock.calls.map(call=>call[0]);expect(labels).toEqual(expect.arrayContaining(['Caravane','Destinataire','Valeur/u','Sans paiement','Quantité donnée']));expect(labels).not.toContain('Vente/u');expect(labels).not.toContain('Achat/u');
    fillText.mockClear();const r=box.rows.find(row=>row.row.id===good.id)!,c=nativeTradeColumns(r.width);stage.drawPageRow(ctx,r,0,()=>.5,box);
    expect(fillText.mock.calls).toContainEqual(['14',r.x+c.sellCountX+c.count/2,NATIVE_TRADE.rowHeight/2+4,c.count-3]);expect(fillText.mock.calls).toContainEqual(['7,25',r.x+c.sellPriceX+c.price/2,NATIVE_TRADE.rowHeight/2+4,c.price-3]);expect(fillText.mock.calls).toContainEqual(['—',r.x+c.buyPriceX+c.price/2,NATIVE_TRADE.rowHeight/2+4,c.price-3]);
  });
  it('lets a native modal restore its own parent on the pointer close without globally clearing that parent',()=>{
    const fallback=vi.fn(),error=vi.fn(),parent:NativePage={id:'trade',title:'Panier',rows:[]};
    const stage=Object.assign(Object.create(NativeStage.prototype),{frontVisible:false,activationSerial:0,closeDropdown:vi.fn(),clearHint:vi.fn(),options:{onEscape:fallback,onError:error}}) as {page:NativePage;dismissPage:()=>void};
    stage.page={id:'review',title:'Confirmation',rows:[],modal:true,closeOwnsNavigation:true,onClose:()=>{stage.page=parent;}};stage.dismissPage();expect(stage.page).toBe(parent);expect(fallback).not.toHaveBeenCalled();expect(error).not.toHaveBeenCalled();
    const ordinary=vi.fn();stage.page={id:'ordinary',title:'Autre fenêtre',rows:[],onClose:ordinary};stage.dismissPage();expect(ordinary).toHaveBeenCalledOnce();expect(fallback).toHaveBeenCalledOnce();
  });
});
