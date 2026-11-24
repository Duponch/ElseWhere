import {describe,expect,it,vi} from 'vitest';
import {createWorld,applyCommand} from '../src/sim/index';
import {addMaterial} from '../src/sim/materials';
import {animalWildness315} from '../src/sim/animal-domestic-v256';
import {physicalTravelUnitMass} from '../src/sim/tree-transfer-mass';
import {knownPile256} from '../src/ui/exploration-readers-256';
import {itemInformation} from '../src/ui/item-information';
import {buildNativeInfoCard,infoFactsFromRows,infoFactMatches,type NativeInfoSource} from '../src/ui3d/native-info-card';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {layoutNativePage,type NativePageBox,type NativeRowBox} from '../src/ui3d/native-layout';
import {NATIVE_INFO} from '../src/ui3d/native-dialog-metrics';
import {NATIVE_INK} from '../src/ui3d/native-ui-scale';
import {NativeStage} from '../src/ui3d/NativeStage';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import type {World} from '../src/sim/types';
import {adultAgeTicks} from '../src/sim/animal-life';
import {animalHaulingCamp459} from './scenarios/animal-hauling-v459';
import {animalRescueCamp} from './helpers/animal-rescue-v310';

const measure=(text:string,size:number)=>text.length*size*.54;
const viewport={width:1440,height:900};
const noop=()=>{};
const bindings={search:()=>true,select:noop,section:noop,back:noop};
const source:NativeInfoSource={id:'info-test',title:'Dossier',icon:'chair',facts:Array.from({length:80},(_,i)=>({id:`stat-${i}`,category:i%2?'Santé':'Général',label:i===79?'Électricité':'Statistique '+i,value:i===79?'300 W':`${i} %`,explanation:i===79?'Énergie réellement fournie.':'Explication '+i}))};
const build=(query='',selected?:string)=>buildNativeInfoCard(source,{query,selected,section:'stats'},bindings);

describe('information sheet — Core points, reading and search',()=>{
  it('has the 950 × 760 centred sheet, the equal two-column body and fixed footer',()=>{
    const page=build(),box=layoutNativePage(page,viewport,false,measure),m=NATIVE_INFO;
    expect([box.x,box.y,box.width,box.height,box.header,box.footer]).toEqual([245,70,950,760,88,74]);
    expect(box.infoParts?.icon).toEqual({x:27,y:18,width:34,height:34});
    expect(box.regions.catalogue).toMatchObject({x:36,y:88,width:439-16,height:598});
    expect(box.regions.details).toMatchObject({x:485,y:98,width:439-20-16,height:578});
    const category=box.rows.find(row=>row.row.infoHeading)!,stat=box.rows.find(row=>row.row.id==='stat-0')!;
    expect(category.height).toBe(25);expect(stat.height).toBe(22);expect(stat.x-category.x).toBe(8);expect(stat.labelWidth/stat.width).toBeCloseTo(.55);
    expect(stat.controls[0]).toMatchObject({hitOnly:true,x:stat.x,y:stat.top,width:stat.width,height:stat.height});
    expect(box.regions.catalogue!.contentHeight).toBeGreaterThan(box.regions.catalogue!.height);
    const search=box.rows.find(row=>row.row.id==='info-search')!,back=box.actions[0]!;
    expect(search.inputRect).toMatchObject({x:18,width:m.searchWidth,height:m.searchHeight});
    expect(back).toMatchObject({x:415,width:120,height:40});expect(box.header+back.y).toBe(702);
    expect(box.header+search.inputRect!.y).toBe(710);
  });
  it('highlights accent-insensitive results, retains nonmatches and their explanations, and exposes the first visual match',()=>{
    expect(infoFactMatches(source.facts[79]!,'electricite energie')).toBe(true);
    const page=build('electricite energie'),stats=page.rows.filter(row=>row.infoEntry);
    expect(stats).toHaveLength(80);expect(stats.find(row=>row.id==='stat-79')?.infoEntry).toEqual({selected:true,match:'match'});
    expect(stats.filter(row=>row.infoEntry?.match==='muted')).toHaveLength(79);expect(page.infoCard?.focusRow).toBe('stat-79');
    const search=layoutNativePage(page,viewport,false,measure).rows.find(row=>row.row.id==='info-search')!;
    expect(search.controls[0]?.control.id).toBe('info-search-clear');expect(search.inputRect!.x+search.inputRect!.width).toBeLessThan(search.controls[0]!.x);
    expect(page.rows.find(row=>row.id==='info-explanation-text')?.label).toBe('Énergie réellement fournie.');
    const other=build('electricite','stat-2');expect(other.detailsKey).toBe('stat-2');expect(other.rows.find(row=>row.id==='stat-2')?.infoEntry).toEqual({selected:true,match:'muted'});
    const empty=build('aucun résultat');expect(empty.rows.filter(row=>row.infoEntry)).toHaveLength(80);expect(empty.infoCard?.focusRow).toBeUndefined();expect(empty.rows.find(row=>row.id==='info-explanation-text')?.label).toMatch(/Aucune statistique/);
  });
  it('projects data and real explanations without cloning orders or duplicating facts',()=>{
    const command:NativeControl={id:'real-order',label:'Demander',onActivate:vi.fn()};
    const facts=infoFactsFromRows([{id:'pile-info',label:'Combat · Portée',value:'3',infoCategory:'Combat',detail:'Portée actuelle',controls:[command]},{id:'header',label:'Santé',emphasis:'heading'},{id:'pain',label:'Douleur',meter:{value:.4,label:'40 %'}},{id:'pain',label:'Douleur dupliquée'},{id:'command',label:'Ordre',controls:[command]}]);
    expect(facts).toEqual([{id:'pile-info',label:'Portée',category:'Combat',value:'3',explanation:'Portée actuelle'},{id:'pain',label:'Douleur',category:'Santé',value:'40 %',explanation:''}]);
    expect(command.onActivate).not.toHaveBeenCalled();
  });
  it.each([{width:800,height:600},{width:480,height:320},{width:320,height:240}])('keeps both regions and search/back reachable at $width × $height',small=>{
    const box=layoutNativePage(build('electricite'),small,false,measure),left=box.regions.catalogue!,right=box.regions.details!,search=box.regions.toolbar!,back=box.actions[0]!;
    for(const rect of [left,right,search,...box.actions]){expect(rect.width).toBeGreaterThan(0);expect(rect.height).toBeGreaterThan(0);expect(rect.x+rect.width).toBeLessThanOrEqual(box.width);}
    expect(left.y+left.height<=right.y||left.x+left.width<=right.x).toBe(true);
    expect(right.y+right.height).toBeLessThanOrEqual(search.y);expect(search.x+search.width).toBeLessThanOrEqual(back.x);
    expect(box.header+back.y+back.height).toBeLessThanOrEqual(box.height);
  });
  it('paints the selection and the muted ink on the original renderer and uses separate regions for scrolling',()=>{
    const page=build('electricite'),box=layoutNativePage(page,viewport,false,measure),fillRect=vi.fn(),fillText=vi.fn();
    const ctx={fillStyle:'',font:'',textAlign:'',fillRect,fillText} as unknown as CanvasRenderingContext2D;
    type StagePort={font:()=>string;pageBox:NativePageBox;page:NativePage;scroll:number;regionOffsets:{details:number};primaryRegion:()=>string;regionOffset:(id:string)=>number;drawPageRow:(ctx:CanvasRenderingContext2D,row:NativeRowBox,top:number,rng:()=>number,box:NativePageBox)=>void;};
    const stage=Object.assign(Object.create(NativeStage.prototype),{font:()=> 'test',pageBox:box,page,scroll:240,regionOffsets:{details:21}}) as StagePort;
    expect(stage.primaryRegion()).toBe('catalogue');expect(stage.regionOffset('catalogue')).toBe(240);expect(stage.regionOffset('details')).toBe(21);
    const selected=box.rows.find(row=>row.row.id==='stat-79')!,muted=box.rows.find(row=>row.row.id==='stat-0')!;
    stage.drawPageRow(ctx,selected,0,()=>.5,box);expect(fillRect).toHaveBeenCalledWith(selected.x,0,selected.width,selected.height);expect(fillText.mock.calls.map(entry=>entry[0])).toContain('300 W');
    stage.drawPageRow(ctx,muted,0,()=>.5,box);expect(ctx.fillStyle).toBe(NATIVE_INK.disabled);
  });
});

let epoch=6_015_000;
function inspect(world:World,selection:Partial<NativeUiState>,tab='none'){
  setNativeInspectorTab(tab);let page:NativePage;
  const state:NativeUiState={world,epoch:++epoch,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],...selection};
  const actions:NativeUiActions={command:vi.fn(async command=>applyCommand(world,command)),panel:noop,category:noop,tool:noop,selectPawn:vi.fn(),speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh:noop,readState:()=>state,isCurrentPage:p=>p===page};
  const rebuild=()=>{page=buildNativeInspector(state,actions)!;return page;};rebuild();
  const controls=()=>[...page.actions??[],...page.rows.flatMap(row=>row.controls??[]),...layoutNativePage(page,viewport,false,measure).rows.flatMap(row=>row.card?.targets.flatMap(target=>target.control?[target.control]:[])??[])];
  const click=async(id:string)=>{const control=controls().find(entry=>entry.id===id);expect(control,id).toBeDefined();expect(control!.disabled,id).not.toBe(true);await control!.onActivate();};
  return{state,actions,rebuild,controls,click,get page(){return page;},replace(){page={id:'other',title:'Autre fenêtre',rows:[]};}};
}
const row=(page:NativePage,id:string)=>{const result=page.rows.find(row=>row.id===id);expect(result,id).toBeDefined();return result!;};

describe('information sheet — real selected entities',()=>{
  it('opens a human dossier with the real Bio and Health, supports narrow card panning and returns to the same tab',async()=>{
    const world=createWorld(6015,16,16),pawn=world.pawns[0]!,before=JSON.stringify(world),ui=inspect(world,{selectedPawnIds:[pawn.id]},'needs');
    await ui.click('inspect-info');expect(ui.page.layout).toBe('info');expect(ui.page.modal).toBe(true);expect(ui.page.closeOwnsNavigation).toBe(true);
    expect(row(ui.page,'skill-medicine').value).toContain(`${pawn.skills.medicine.level} / 20`);expect(row(ui.page,'need-mood').value).toBe(`${Math.round(pawn.mood)} %`);
    expect(row(ui.page,'info-tabs').controls?.map(control=>control.id)).toEqual(['info-tab-stats','info-tab-bio','info-tab-health']);
    const box=layoutNativePage(ui.page,viewport,false,measure);expect(box.header).toBe(133);
    await ui.click('info-tab-bio');expect(row(ui.page,'info-bio-card').bio?.name).toBe(pawn.name);
    await ui.click('info-tab-health');const health=row(ui.page,'info-health-card').card;expect(health?.type).toBe('health');if(health?.type==='health'){expect(health.settings).toEqual([]);expect(health.tabs.operations).toBeUndefined();expect(health.entries.every(entry=>!entry.info)).toBe(true);}
    const small=layoutNativePage(ui.page,{width:480,height:320},false,measure);expect(small.regions.details?.contentWidth).toBe(630);expect(small.regions.details!.contentHeight).toBeGreaterThan(small.regions.details!.height);
    await ui.click('info-tab-stats');const entry=row(ui.page,'need-mood');await entry.controls![0]!.onActivate();expect(ui.page.detailsKey).toBe('need-mood');
    ui.page.onClose?.();expect(ui.page.inspectTab?.id).toBe('needs');expect(ui.actions.command).not.toHaveBeenCalled();expect(JSON.stringify(world)).toBe(before);
  });
  it('rebuilds from a new accepted state and rejects retained callbacks after closing, replacing or changing the selection',async()=>{
    const world=createWorld(6016,16,16),pawn=world.pawns[0]!,ui=inspect(world,{selectedPawnIds:[pawn.id]});
    await ui.click('inspect-info');const old=ui.page,oldSearch=row(old,'info-search').input!;
    expect(oldSearch.onChange?.('humeur')).toBe(true);expect(ui.page.detailsKey).toBe('need-mood');expect(await row(ui.page,'info-search').input!.onCommit('humeur')).toBe(true);
    ui.state.world=structuredClone(world);ui.state.world.pawns[0]!.mood=28;ui.rebuild();expect(row(ui.page,'need-mood').value).toBe('28 %');expect(row(ui.page,'info-search').input?.value).toBe('humeur');
    await ui.click('info-search-clear');expect(row(ui.page,'info-search').input?.value).toBe('');expect(row(ui.page,'need-mood').infoEntry?.match).toBe('normal');
    await ui.click('info-back');await ui.click('inspect-info');expect(await oldSearch.onCommit('ancien')).toBe(false);old.onClose?.();expect(row(ui.page,'info-search').input?.value).toBe('');
    const retained=row(ui.page,'info-search').input!,close=ui.page.onClose;ui.replace();expect(await retained.onCommit('autre')).toBe(false);close?.();expect(ui.page.id).toBe('other');
    ui.state.selectedPawnIds=[world.pawns[1]!.id];ui.rebuild();expect(ui.page.layout).toBe('inspector');expect(ui.page.title).toBe(world.pawns[1]!.name);expect(ui.actions.command).not.toHaveBeenCalled();
  });
  it('opens real item information from a selected human inventory and removes it when ownership changes',async()=>{
    const world=createWorld(6017,16,16),pawn=world.pawns[0]!;addMaterial(world,'food',3,{type:'inventory',pawnId:pawn.id},'rice');const pile=world.piles.find(pile=>pile.owner.type==='inventory'&&pile.owner.pawnId===pawn.id)!;
    const ui=inspect(world,{selectedPawnIds:[pawn.id]},'gear');await ui.click(`item-information-${pile.id}`);expect(ui.page.title).toBe(itemInformation(pile,world).title);expect(ui.page.rows.filter(row=>row.infoEntry&&row.id!=='info-description').length).toBe(itemInformation(pile,world).rows.length);
    pile.owner={type:'inventory',pawnId:world.pawns[1]!.id};ui.rebuild();expect(ui.page.layout).toBe('inspector');expect(ui.page.inspectTab?.id).toBe('gear');expect(ui.actions.command).not.toHaveBeenCalled();
  });
  it('opens a real item from an animal inventory and shows carried mass, including a packed original, but not an unowned pile',async()=>{
    const f=animalHaulingCamp459(),world=f.world,animal=world.wildlife!.animals.find(entry=>entry.id===f.animalId)!;
    const ui=inspect(world,{selectedAnimalId:animal.id});expect(ui.controls().some(control=>control.id==='pane-tab-gear')).toBe(false);
    addMaterial(world,'wood',3,{type:'inventory',pawnId:animal.id},'wood');const carried=world.piles.find(pile=>pile.owner.type==='inventory'&&pile.owner.pawnId===animal.id)!;
    world.packed.push({building:{id:world.nextId++,kind:'bedroll',x:0,z:0,orientation:0,footprint:'standard'},owner:{type:'inventory',pawnId:animal.id}});
    ui.rebuild();await ui.click('pane-tab-gear');expect(ui.page.inspectTab).toMatchObject({id:'gear',width:460,height:450});
    const card=row(ui.page,'tab-card').card;expect(card?.type).toBe('gear');if(card?.type!=='gear')throw Error('Gear card missing');
    const items=card.sections.flatMap(section=>section.rows);expect(items.map(entry=>entry.id)).toEqual([`inventory-${carried.id}`,`packed-${world.packed[0]!.building.id}`]);expect(items[0]?.grams).toBe(physicalTravelUnitMass(carried,world.schemaVersion)!*3);expect(items[1]?.grams).toBe(2500);expect(items.every(entry=>!entry.drop&&!entry.ingest)).toBe(true);
    await ui.click(`item-information-${carried.id}`);expect(ui.page.layout).toBe('info');expect(ui.page.title).toBe(itemInformation(carried,world).title);expect(ui.page.rows.some(row=>row.infoEntry&&row.label==='Quantité'&&row.value==='3')).toBe(true);
    await ui.click('item-information-back');expect(ui.page.inspectTab?.id).toBe('gear');await ui.click('inspect-info');expect(row(ui.page,'animal-wildness').value).toBe(`${Math.round(animalWildness315(animal.species)*100)} %`);expect(row(ui.page,'animal-inventory-mass').value).toBeDefined();
    await ui.click('info-tab-health');expect(row(ui.page,'info-health-card').card?.type).toBe('health');await ui.click('info-back');expect(ui.page.inspectTab?.id).toBe('gear');expect(ui.actions.command).not.toHaveBeenCalled();
  });
  it('shows only species trainables and separates maintenance intent from acquired progress, without filling an invented journal',async()=>{
    const f=animalHaulingCamp459(),world=f.world,animal=world.wildlife!.animals.find(entry=>entry.id===f.animalId)!;animal.ageTicks=adultAgeTicks(animal.species);
    animal.training={revision:1,sinceCore:world.tick*10,lastLocalCore:world.tick*10,nextDecayCore:(world.tick+100)*10,tamenessWanted:true,obedience:{steps:3,learned:true,wanted:false},haul:{steps:0,learned:false,wanted:false}};
    const ui=inspect(world,{selectedAnimalId:animal.id},'training');const card=row(ui.page,'tab-card').card;if(card?.type!=='training')throw Error('Training card missing');
    expect(card.rows.map(entry=>[entry.id,entry.learned,entry.wanted])).toEqual([['training-obedience',true,false],['training-haul',false,false]]);expect(ui.page.inspectTab?.height).toBe(168);expect(card.lines.find(entry=>entry.id==='wildness')?.value).toBe(`${Math.round(animalWildness315(animal.species)*100)} %`);
    await ui.click('pane-tab-journal');const log=row(ui.page,'tab-card').card;if(log?.type!=='log')throw Error('Log card missing');expect(log.lines).toEqual([]);expect(log.copy.disabled).toBe(true);expect(log.emptyText).toMatch(/Aucun journal individuel/);
    const other=animalRescueCamp(),restricted=inspect(other.world,{selectedAnimalId:other.sleeperId},'training');const limited=row(restricted.page,'tab-card').card;if(limited?.type!=='training')throw Error('Training card missing');expect(limited.rows).toEqual([]);expect(restricted.page.inspectTab?.height).toBe(112);
    expect(ui.actions.command).not.toHaveBeenCalled();
  });
  it('lists actual known lineage and selects the original animal from its social card',async()=>{
    const f=animalRescueCamp(),w=f.world,animal=w.wildlife!.animals.find(entry=>entry.id===f.animalId)!,child=w.wildlife!.animals.find(entry=>entry.id===f.sleeperId)!;
    child.parents={motherId:animal.id,fatherId:w.nextId++};delete w.tiles[child.z*w.width+child.x]!.fogged;
    const ui=inspect(w,{selectedAnimalId:animal.id},'social'),card=row(ui.page,'tab-card').card;if(card?.type!=='social')throw Error('Social card missing');
    expect(card.rows.find(entry=>entry.id===`child-${child.id}`)).toMatchObject({relations:'Descendant',situation:'Présent'});
    await ui.click(`select-animal-${child.id}`);expect(ui.actions.selectPawn).toHaveBeenCalledExactlyOnceWith(child.id);expect(ui.actions.command).not.toHaveBeenCalled();
  });
  it('recognises an owned inventory in an explored map without disclosing a wild carrier hidden in fog',()=>{
    const f=animalHaulingCamp459(),w=f.world,animal=w.wildlife!.animals.find(entry=>entry.id===f.animalId)!;
    w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};w.exploration={revision:1};w.tiles[animal.z*w.width+animal.x]!.fogged=true;
    addMaterial(w,'wood',2,{type:'inventory',pawnId:animal.id},'wood');const pile=w.piles.find(entry=>entry.owner.type==='inventory'&&entry.owner.pawnId===animal.id)!;
    expect(knownPile256(w,pile)).toBe(true);expect(itemInformation(pile,w).rows.some(entry=>entry.label==='Quantité'&&entry.value==='2')).toBe(true);
    delete animal.domestic;expect(knownPile256(w,pile)).toBe(false);expect(itemInformation(pile,w).rows).toEqual([]);delete w.tiles[animal.z*w.width+animal.x]!.fogged;expect(knownPile256(w,pile)).toBe(true);
  });
});
