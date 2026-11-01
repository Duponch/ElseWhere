import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/index';
import {newShelfStorage,groundMaxStacks} from '../src/sim/shelf-storage';
import type {Structure,World} from '../src/sim/types';
import type {StorageControlSettings} from '../src/ui/storage-item-controls';
import {shelfControlOptions} from '../src/ui/shelf-inspection';
import {STORAGE_FILTER_TREE,storageNodeLeaves,storageTreeSelection,storageTreePermissions,type StorageLeafId} from '../src/ui/storage-filter-tree';
import type {NativeControl,NativePage,NativeRow,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {createNativeStorageEditor,nativeStorageTreeRows} from '../src/ui3d/native-storage-editor';
import {buildNativeInspector} from '../src/ui3d/native-inspector';

function findRow(page:NativePage,id:string):NativeRow {
  const found=page.rows.find(row=>row.id===id);expect(found,`Missing row ${id}`).toBeDefined();return found!;
}
function findControl(page:NativePage,id:string):NativeControl {
  const found=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(control=>control.id===id);
  expect(found,`Missing control ${id}`).toBeDefined();return found!;
}
function editor(initial:StorageControlSettings={priority:3,filters:{wood:true,food:true}},apply=vi.fn(async (_settings:StorageControlSettings)=>{})) {
  let page:NativePage;
  const back=vi.fn();
  page=createNativeStorageEditor({id:'draft-storage',title:'Réserve',initial,onApply:apply,onBack:back,show:next=>{page=next;}});
  return {initial,apply,back,get page(){return page;}};
}

// Same small real-world/command pattern as native-inspector-storage-v476.test.ts.
let epoch=901100;
async function storageFixture(kind:'stockpile'|'shelf'='stockpile',prepare?:(world:World,shelf:Structure)=>void) {
  const world=createWorld(476,16,16);
  const stockpile={id:world.nextId++,x:7,z:8,priority:3,capacity:75,filters:{wood:true,food:true}};
  const shelf:Structure={id:world.nextId++,kind:'small-shelf',x:7,z:8,orientation:0,footprint:'standard',shelf:newShelfStorage([world.nextId++])};
  world.stockpiles=kind==='stockpile'?[stockpile]:[];
  if(kind==='shelf')world.structures.push(shelf);
  delete world.tiles[8*world.width+7]!.fogged;
  prepare?.(world,shelf);
  const state:NativeUiState={world,epoch:++epoch,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],
    selectedObjects:[{kind:kind==='stockpile'?'stockpile':'structure',id:kind==='stockpile'?stockpile.id:shelf.id}],
    constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  let page:NativePage;
  const noop=()=>{};
  const actions:NativeUiActions={command:vi.fn(async command=>applyCommand(world,command)),readState:()=>state,panel:noop,category:noop,tool:noop,selectPawn:noop,
    speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh:noop};
  const rebuild=()=>{page=buildNativeInspector(state,actions)!;};
  rebuild();
  await findControl(page!,kind==='stockpile'?'stockpile-settings':'shelf-policy').onActivate();
  return {world,stockpile,shelf,state,actions,rebuild,get page(){return page;}};
}

describe('compact native storage preserves permissions and local navigation',()=>{
  it('projects mixed physical groups without editing caller sets and disables physically empty branches',async()=>{
    const corpses=STORAGE_FILTER_TREE.find(node=>node.id==='corpses')!;
    const admissible=storageNodeLeaves(corpses).filter(shelfControlOptions.fixedAllows!);
    expect(admissible.length).toBeGreaterThan(1);
    const selected=new Set<StorageLeafId>([admissible[0]!]),expanded=new Set(['corpses']);
    const selectedBefore=[...selected],expandedBefore=[...expanded],toggle=vi.fn(),expand=vi.fn();
    const rows=nativeStorageTreeRows({id:'physical',selected,expanded,search:'',fixedAllows:shelfControlOptions.fixedAllows,onExpand:expand,onToggle:toggle});
    const page={id:'physical',title:'Stockage',rows},parent=findRow(page,'physical-node-corpses');
    expect(parent.tree?.state).toBe('mixed');
    await findControl(page,'physical-node-corpses-permission').onActivate();
    expect(toggle).toHaveBeenCalledExactlyOnceWith(corpses,'mixed',admissible);
    expect(findControl(page,'physical-node-buildings-permission').disabled).toBe(true);
    await findControl(page,'physical-node-buildings-permission').onActivate();
    expect(toggle).toHaveBeenCalledTimes(1);
    expect([...selected]).toEqual(selectedBefore);expect([...expanded]).toEqual(expandedBefore);expect(expand).not.toHaveBeenCalled();
  });

  it('keeps expansion through search, exposes matching ancestors and never applies a navigation edit',async()=>{
    const f=editor(),before=structuredClone(f.initial);
    await findControl(f.page,'draft-storage-node-foods-expand').onActivate();
    await findControl(f.page,'draft-storage-node-raw-food-expand').onActivate();
    const openRows=f.page.rows.filter(row=>row.tree).map(row=>row.id);
    await findRow(f.page,'draft-storage-search').input!.onCommit('riz');
    for(const name of ['foods','raw-food','vegetarian','rice'])expect(f.page.rows.some(row=>row.id===`draft-storage-node-${name}`)).toBe(true);
    expect(f.page.rows.some(row=>row.id==='draft-storage-node-wood')).toBe(false);
    await findRow(f.page,'draft-storage-search').input!.onCommit('');
    expect(f.page.rows.filter(row=>row.tree).map(row=>row.id)).toEqual(openRows);
    expect(f.apply).not.toHaveBeenCalled();expect(f.initial).toEqual(before);
  });

  it('leaves future-reserve policy untouched before Apply and keeps absent ranges absent after unchanged bounds',async()=>{
    const f=editor(),before=structuredClone(f.initial);
    const quality=findControl(f.page,'draft-storage-quality-min').select!;
    await quality.onChange(quality.value);
    await findRow(f.page,'draft-storage-hp-min').input!.onCommit('0');
    await findRow(f.page,'draft-storage-hp-max').input!.onCommit('100');
    expect(f.page.rows.some(row=>row.id==='draft-storage-hp-min')).toBe(true);
    expect(f.apply).not.toHaveBeenCalled();expect(f.initial).toEqual(before);
    await findControl(f.page,'draft-storage-apply').onActivate();
    expect(f.apply).toHaveBeenCalledTimes(1);
    const applied=vi.mocked(f.apply).mock.calls[0]![0];
    expect(Object.hasOwn(applied,'quality')).toBe(false);expect(Object.hasOwn(applied,'hitPoints')).toBe(false);
    expect(storageTreeSelection(applied.filters,applied.items)).toEqual(storageTreeSelection(before.filters,before.items));
    expect(f.back).toHaveBeenCalledTimes(1);expect(f.initial).toEqual(before);
  });

  it('retains a rejected draft and ignores a second Apply while the first application is pending',async()=>{
    let reject!:(reason:Error)=>void;
    const pending=new Promise<void>((_resolve,rejectPromise)=>{reject=rejectPromise;});
    const apply=vi.fn(async (_settings:StorageControlSettings)=>{}).mockImplementationOnce(()=>pending);
    const f=editor(undefined,apply);
    await findRow(f.page,'draft-storage-search').input!.onCommit('bois');
    await findControl(f.page,'draft-storage-node-wood-permission').onActivate();
    const firstApply=findControl(f.page,'draft-storage-apply');
    const first=firstApply.onActivate();
    await firstApply.onActivate();
    expect(apply).toHaveBeenCalledTimes(1);expect(f.back).not.toHaveBeenCalled();
    const rejected=expect(first).rejects.toThrow('Refus stockage');reject(new Error('Refus stockage'));await rejected;
    expect(findRow(f.page,'draft-storage-search').input!.value).toBe('bois');
    expect(findRow(f.page,'draft-storage-node-wood').tree?.state).toBe('none');
    expect(findControl(f.page,'draft-storage-apply').disabled).toBe(false);
    await findControl(f.page,'draft-storage-apply').onActivate();
    expect(apply).toHaveBeenCalledTimes(2);expect(apply.mock.calls[1]![0].filters.wood).toBe(false);expect(f.back).toHaveBeenCalledTimes(1);
  });

  it('applies an existing shelf group immediately from fresh confirmed permissions while preserving excluded leaves',async()=>{
    const corpses=STORAGE_FILTER_TREE.find(node=>node.id==='corpses')!,leaves=storageNodeLeaves(corpses);
    const allowed=leaves.filter(shelfControlOptions.fixedAllows!);
    const f=await storageFixture('shelf',(_world,shelf)=>Object.assign(shelf.shelf!.settings,storageTreePermissions(new Set([allowed[0]!]))));
    expect(f.page.layout).toBe('storage');expect(f.page.actions?.some(action=>/appliquer/i.test(action.label))).toBe(false);
    expect(findRow(f.page,'storage-node-corpses').tree?.state).toBe('mixed');
    const click=findControl(f.page,'storage-node-corpses-permission');
    // A real confirmed policy update intervenes without refreshing the drawn page.
    applyCommand(f.world,{type:'shelf-policy',structureId:f.shelf.id,settings:storageTreePermissions(new Set<StorageLeafId>([allowed[0]!,'wood']))});
    const before=storageTreeSelection(f.shelf.shelf!.settings.filters,f.shelf.shelf!.settings.items);
    const excluded=leaves.filter(item=>!shelfControlOptions.fixedAllows!(item));
    await click.onActivate();
    const after=storageTreeSelection(f.shelf.shelf!.settings.filters,f.shelf.shelf!.settings.items);
    expect(after.has('wood')).toBe(true);expect(allowed.every(item=>after.has(item))).toBe(true);
    expect(excluded.map(item=>after.has(item))).toEqual(excluded.map(item=>before.has(item)));
    expect(f.actions.command).toHaveBeenCalledTimes(1);
    expect(f.actions.command).toHaveBeenLastCalledWith(expect.objectContaining({type:'shelf-policy',structureId:f.shelf.id}));
  });

  it('does not change World or send commands when expanding or searching an existing reserve',async()=>{
    const f=await storageFixture(),before=structuredClone(f.world);
    await findControl(f.page,'storage-node-foods-expand').onActivate();
    await findRow(f.page,'storage-search').input!.onCommit('riz');
    expect(findRow(f.page,'storage-node-rice').tree?.depth).toBeGreaterThan(0);
    await findRow(f.page,'storage-search').input!.onCommit('');
    expect(findRow(f.page,'storage-node-foods').tree?.expanded).toBe(true);
    expect(f.actions.command).not.toHaveBeenCalled();expect(f.world).toEqual(before);
  });

  it('resets local navigation and refuses old handlers after selection or map identity changes',async()=>{
    const f=await storageFixture();
    await findControl(f.page,'storage-node-foods-expand').onActivate();
    await findRow(f.page,'storage-search').input!.onCommit('riz');
    const stale=findControl(f.page,'storage-node-rice-permission');
    f.world.structures.push(f.shelf);f.state.selectedObjects=[{kind:'structure',id:f.shelf.id}];f.rebuild();
    await findControl(f.page,'shelf-policy').onActivate();
    expect(findRow(f.page,'storage-search').input!.value).toBe('');
    expect(findRow(f.page,'storage-node-foods').tree?.expanded).toBe(false);
    // Intended new contract: no command against the previous selection.
    await stale.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
    const previousMap=findControl(f.page,'storage-node-foods-permission');
    f.state.epoch!++;await previousMap.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  });

  it('pastes an independent policy into the real target without changing physical capacity or removing guards',async()=>{
    const f=await storageFixture();
    Object.assign(f.stockpile,{priority:5,capacity:12,quality:{min:'good',max:'excellent'},allowRotten:false});
    await findControl(f.page,'storage-copy').onActivate();
    f.stockpile.filters.wood=false;f.world.structures.push(f.shelf);
    f.state.selectedObjects=[{kind:'structure',id:f.shelf.id}];f.rebuild();await findControl(f.page,'shelf-policy').onActivate();
    const capacityBefore=structuredClone(f.shelf.shelf),physicalBefore=groundMaxStacks(f.world,f.shelf);
    await findControl(f.page,'storage-paste').onActivate();
    expect(f.shelf.shelf!.settings).toMatchObject({priority:5,capacity:capacityBefore!.settings.capacity,filters:{wood:true,food:true},quality:{min:'good',max:'excellent'},allowRotten:false});
    expect(f.shelf.shelf!.cells).toEqual(capacityBefore!.cells);expect(groundMaxStacks(f.world,f.shelf)).toBe(physicalBefore);
    expect(f.shelf.shelf!.settings.filters).not.toBe(f.stockpile.filters);
    expect(findRow(f.page,'storage-capacity').input).toBeUndefined();
    const guarded=findControl(f.page,'storage-paste');f.state.busy=true;await guarded.onActivate();
    expect(f.actions.command).toHaveBeenCalledTimes(1);
  });
});
