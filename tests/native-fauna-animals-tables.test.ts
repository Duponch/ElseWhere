import {describe,it,expect,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import {enableBiomeWildlife} from '../src/sim/wildlife';
import {adultAgeTicks} from '../src/sim/animal-life';
import type {WildAnimal} from '../src/sim/wildlife-state';
import type {AnimalSpeciesId} from '../src/sim/animal-species';
import {MEDICAL_CARE} from '../src/sim/medicine-rules';
import {buildNativePanel} from '../src/ui3d/native-panels';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';

let epoch=902000;
function fixture(panel:'animals'|'wildlife'='animals'){
 const world=createWorld(476,16,16);enableBiomeWildlife(world,'temperate-forest');
 for(const tile of world.tiles)delete tile.fogged;
 const make=(species:AnimalSpeciesId,name:string,age:number,sex:'female'|'male',domestic:boolean,x:number):WildAnimal=>({id:world.nextId++,species,startingPet:{revision:1,name},sex,ageTicks:age,x,z:8,food:.5,rest:1,state:'idle',path:[],nextDecision:world.tick,
  ...(domestic?{domestic:{since:world.tick,care:'industrial' as const,tameness:5,nextDecay:world.tick+45000,productFullness:.5}}:{})});
 const female=make('dromedary','Étoile',adultAgeTicks('dromedary'),'female',true,6),male=make('muffalo','Basile',adultAgeTicks('muffalo')*2,'male',true,7);
 const wildYoung=make('hare','Écume',adultAgeTicks('hare')/2,'female',false,9),wildOlder=make('hare','Zéphyr',adultAgeTicks('hare')*2,'male',false,10),unknown=make('hare','Inconnu',adultAgeTicks('hare'),'male',false,-1);
 world.wildlife!.animals=[female,male,wildYoung,wildOlder,unknown];
 world.pawns[0]!.draft={lastActiveTick:world.tick,target:null,queue:[]};
 const state:NativeUiState={world,epoch:++epoch,panel,category:'orders',tool:'select',orientation:0,selectedPawnIds:[world.pawns[0]!.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;
 const noop=()=>{};
 const actions:NativeUiActions={command:vi.fn(async()=>({ok:true})),readState:()=>state,showPage:next=>{page=next;},refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:vi.fn(),speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const rebuild=()=>{page=buildNativePanel(state,actions)!;};rebuild();
 return {world,state,actions,female,male,wildYoung,wildOlder,unknown,rebuild,get page(){return page;}};
}
function control(page:NativePage,id:string):NativeControl{
 const value=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(control=>control.id===id);expect(value,`Missing control ${id}`).toBeDefined();return value!;
}
const animalRows=(page:NativePage,prefix:string)=>page.rows.filter(row=>new RegExp(`^${prefix}-[0-9]+$`).test(row.id));

describe('dense animal management uses actual visible facts and original commands',()=>{
 it('exposes care, maturity, sex, age, area and production directly in aligned domestic rows',async()=>{
  const f=fixture(),before=structuredClone(f.world),record=f.page.rows.find(row=>row.id===`animal-${f.female.id}`)!;
  expect(f.page.layout).toBe('table');expect(record.controls).toHaveLength(f.page.rows.find(row=>row.id==='animals-headings')!.columns!.length);
  expect(control(f.page,`animal-${f.female.id}-sex`).label).toBe('F');expect(control(f.page,`animal-${f.female.id}-sex`).hint).toBe('Femelle');
  expect(control(f.page,`animal-${f.female.id}-care`).hint).toContain(MEDICAL_CARE.industrial);expect(control(f.page,`animal-${f.female.id}-care`).select!.value).toBe('industrial');
  expect(control(f.page,`animal-${f.female.id}-product`).label).toBe('Lait 50 %');
  expect(control(f.page,`animal-${f.female.id}-stage`).label).toBe('Adulte');
  expect(control(f.page,`animal-${f.female.id}-age`).label).toContain('an');
  expect(control(f.page,`animal-${f.female.id}-area`).label.length).toBeGreaterThan(0);
  expect(f.page.actions?.some(action=>action.id==='animals-quotas-open')).toBe(true);
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
  const care=control(f.page,`animal-${f.female.id}-care`).select!;
  expect(care.options).toEqual(Object.entries(MEDICAL_CARE).map(([value,label])=>({value,label})));
  await care.onChange('invalid-care');expect(f.actions.command).not.toHaveBeenCalled();
  await care.onChange('herbal');
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'animal-care-policy',animalId:f.female.id,care:'herbal'});
  expect(f.world).toEqual(before);
 });

 it('searches accents and species, filters sex and sorts numerically without revealing unknown animals or reordering World',async()=>{
  const f=fixture('wildlife'),sourceOrder=f.world.wildlife!.animals.map(animal=>animal.id);
  expect(animalRows(f.page,'wildlife').map(row=>row.id)).not.toContain(`wildlife-${f.unknown.id}`);
  await f.page.rows.find(row=>row.id==='wildlife-search')!.input!.onCommit('ecume');
  expect(animalRows(f.page,'wildlife').map(row=>row.id)).toEqual([`wildlife-${f.wildYoung.id}`]);
  await f.page.rows.find(row=>row.id==='wildlife-search')!.input!.onCommit('lièvre');
  expect(animalRows(f.page,'wildlife')).toHaveLength(2);
  await control(f.page,'wildlife-sort').select!.onChange('age');
  expect(animalRows(f.page,'wildlife').map(row=>row.id)).toEqual([`wildlife-${f.wildYoung.id}`,`wildlife-${f.wildOlder.id}`]);
  await control(f.page,'wildlife-direction').onActivate();
  expect(animalRows(f.page,'wildlife').map(row=>row.id)).toEqual([`wildlife-${f.wildOlder.id}`,`wildlife-${f.wildYoung.id}`]);
  await control(f.page,'wildlife-filter').select!.onChange('female');
  expect(animalRows(f.page,'wildlife').map(row=>row.id)).toEqual([`wildlife-${f.wildYoung.id}`]);
  expect(f.world.wildlife!.animals.map(animal=>animal.id)).toEqual(sourceOrder);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('keeps localization and hunting tied to the actor id after sorting and reads a changed designation at the click',async()=>{
  const f=fixture('wildlife');
  await control(f.page,'wildlife-sort').select!.onChange('age');
  await control(f.page,'wildlife-direction').onActivate();
  await control(f.page,`wildlife-${f.wildOlder.id}-focus`).onActivate();
  expect(f.actions.selectPawn).toHaveBeenCalledExactlyOnceWith(f.wildOlder.id);
  const hunted=control(f.page,`wildlife-${f.wildYoung.id}-hunt`);
  f.world.hunting={...(f.world.hunting??{targets:[],completed:0}),targets:[f.wildYoung.id]};
  await hunted.onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'hunt',animalId:f.wildYoung.id,enabled:false});
  expect(control(f.page,`wildlife-${f.wildOlder.id}-position`).label).toBe(`${f.wildOlder.x}, ${f.wildOlder.z}`);
  const shot=control(f.page,`wildlife-${f.wildOlder.id}-shoot`);
  f.state.selectedPawnIds=[];await shot.onActivate();
  expect(f.actions.command).toHaveBeenCalledTimes(1);
 });

 it('rejects stale map callbacks, resets local filters and preserves the busy and real domestic designation guards',async()=>{
  const f=fixture();
  await f.page.rows.find(row=>row.id==='animals-search')!.input!.onCommit('etoile');
  const staleSearch=f.page.rows.find(row=>row.id==='animals-search')!.input!,staleLocate=control(f.page,`animal-${f.female.id}-locate`),staleSlaughter=control(f.page,`animal-${f.female.id}-slaughter`);
  f.state.epoch!++;f.rebuild();
  expect(f.page.rows.find(row=>row.id==='animals-search')!.input!.value).toBe('');
  await staleSearch.onCommit('basile');await staleLocate.onActivate();await staleSlaughter.onActivate();
  expect(f.page.rows.find(row=>row.id==='animals-search')!.input!.value).toBe('');expect(f.actions.selectPawn).not.toHaveBeenCalled();expect(f.actions.command).not.toHaveBeenCalled();
  const slaughter=control(f.page,`animal-${f.female.id}-slaughter`);f.state.busy=true;await slaughter.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  f.state.busy=false;f.female.domestic!.slaughter=true;await slaughter.onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'slaughter',animalId:f.female.id,enabled:false});
 });
});
