import {describe,expect,it,vi} from 'vitest';
import {createNativeSaveManager} from '../src/ui3d/native-saves';
import type {NativePage} from '../src/ui3d/native-contract';
import type {SavedColony} from '../src/ui/game-session';
import {NAMED_SAVE_KEYS} from '../src/ui/save-slots';

function fixture(){
  let page:NativePage|undefined;
  let entries:SavedColony[]=[{key:'lisiere.named.v1.1',kind:'named',label:'Camp sûr',detail:'Jour 2 · 250 × 250',savedAt:20,revision:'opaque-A'}];
  const options={readSaves:()=>entries,refresh:vi.fn(async()=>{}),save:vi.fn(async()=>{}),saveNamed:vi.fn(async()=>{}),deleteSave:vi.fn(async()=>{}),load:vi.fn(async()=>{}),exportSave:vi.fn(async()=>{}),show:(next:NativePage)=>{page=next;},close:vi.fn(),blocked:()=>false};
  const manager=createNativeSaveManager(options);
  const click=async(id:string)=>{
    const control=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(control=>control.id===id);
    if(!control)throw Error(`Missing native control ${id}`);expect(control.disabled).not.toBe(true);await control.onActivate();
  };
  return {manager,options,click,get page(){return page!;},setEntries:(next:SavedColony[])=>{entries=next;}};
}
describe('native save manager ownership and consent',()=>{
  it('loads the clicked compact record directly once while keeping management actions separate',async()=>{
    const f=fixture();await f.manager.open();const row=f.page.rows.find(row=>row.id==='native-save-slot-lisiere.named.v1.1')!;
    expect([f.page.layout,f.page.width,f.page.height]).toEqual(['files',620,700]);expect(row).toMatchObject({label:'Camp sûr',region:'catalogue',fileEntry:{manage:true,kind:'Nommée',index:0}});
    expect(row.controls![0]).toMatchObject({id:'native-save-load-lisiere.named.v1.1',label:'Charger'});expect(row.controls![0]!.hint).toContain('Jour 2 · 250 × 250');expect(row.controls![0]!.hint).toContain('Sauvegarde nommée');expect(row.controls![1]).toMatchObject({id:'native-save-select-lisiere.named.v1.1',presentation:'icon'});
    await f.click('native-save-select-lisiere.named.v1.1');expect(f.options.load).not.toHaveBeenCalled();expect(f.page.rows.flatMap(row=>row.controls??[]).some(control=>control.id==='native-save-load')).toBe(false);
    await f.click('native-save-load-lisiere.named.v1.1');expect(f.options.load).toHaveBeenCalledExactlyOnceWith('lisiere.named.v1.1');expect(f.options.close).toHaveBeenCalledOnce();f.manager.dispose();expect(f.options.close).toHaveBeenCalledOnce();
  });
  it('revalidates the exact clicked revision before direct loading',async()=>{
    const f=fixture();await f.manager.open();f.options.refresh.mockImplementationOnce(async()=>{f.setEntries([{key:'lisiere.named.v1.1',kind:'named',label:'Copie changée',detail:'Jour 3',savedAt:21,revision:'opaque-B'}]);});await f.click('native-save-load-lisiere.named.v1.1');expect(f.options.load).not.toHaveBeenCalled();expect(f.options.close).not.toHaveBeenCalled();expect(f.page.rows.map(row=>row.label).join(' ')).toMatch(/changé|disparu/);f.manager.dispose();
  });
  it('preserves the real session-blocked guard after refreshing a directly clicked copy',async()=>{
    const f=fixture();await f.manager.open();f.options.refresh.mockImplementationOnce(async()=>{f.options.blocked=()=>true;});await f.click('native-save-load-lisiere.named.v1.1');expect(f.options.load).not.toHaveBeenCalled();expect(f.options.close).not.toHaveBeenCalled();expect(f.page.rows.map(row=>row.label).join(' ')).toContain('Attendez la fin');f.manager.dispose();
  });
  it('requires explicit confirmation and commits the exact selected revision',async()=>{
    const f=fixture();await f.manager.open();await f.click('native-save-select-lisiere.named.v1.1');await f.click('native-save-overwrite');
    expect(f.page.id).toBe('native-saves-confirm');expect([f.page.layout,f.page.width,f.page.height]).toEqual(['message',640,460]);expect(f.options.saveNamed).not.toHaveBeenCalled();
    await f.click('native-save-confirm-cancel');expect(f.options.saveNamed).not.toHaveBeenCalled();
    await f.click('native-save-overwrite');await f.click('native-save-confirm-apply');
    expect(f.options.saveNamed).toHaveBeenCalledExactlyOnceWith('Camp sûr','lisiere.named.v1.1','opaque-A');f.manager.dispose();
  });
  it('refuses a stale deletion after refresh changes the selected copy',async()=>{
    const f=fixture();await f.manager.open();await f.click('native-save-select-lisiere.named.v1.1');await f.click('native-save-delete');
    const apply=f.page.actions!.find(control=>control.id==='native-save-confirm-apply')!;
    f.options.refresh.mockImplementationOnce(async()=>{f.setEntries([{key:'lisiere.named.v1.1',kind:'named',label:'Copie d’un autre onglet',detail:'Jour 3',savedAt:21,revision:'opaque-B'}]);});
    await apply.onActivate();expect(f.options.deleteSave).not.toHaveBeenCalled();expect(f.page.id).toBe('native-saves');
    expect(f.page.rows.map(row=>row.label).join(' ')).toMatch(/changé|disparu/);f.manager.dispose();
  });
  it('creates in a free slot without silently converting creation into overwrite',async()=>{
    const f=fixture();await f.manager.open();await f.page.rows.find(row=>row.id==='native-save-name')!.input!.onCommit('Nouvelle halte');
    await f.click('native-save-create');expect(f.options.saveNamed).toHaveBeenCalledExactlyOnceWith('Nouvelle halte');
    expect(f.options.deleteSave).not.toHaveBeenCalled();f.manager.dispose();
  });
  it('binds a selected action and a confirmation to their original copy, never a later selection',async()=>{
    const f=fixture();f.setEntries([{key:NAMED_SAVE_KEYS[0]!,kind:'named',label:'Camp A',detail:'Jour 2',revision:'A'},{key:NAMED_SAVE_KEYS[1]!,kind:'named',label:'Camp B',detail:'Jour 4',revision:'B'}]);
    await f.manager.open();await f.click(`native-save-select-${NAMED_SAVE_KEYS[0]}`);
    const oldDelete=f.page.rows.find(row=>row.id==='native-save-selected')!.controls![1]!;
    await f.click(`native-save-select-${NAMED_SAVE_KEYS[1]}`);await oldDelete.onActivate();expect(f.page.id).toBe('native-saves');expect(f.options.deleteSave).not.toHaveBeenCalled();
    await f.click('native-save-delete');const oldPage=f.page,oldApply=oldPage.actions!.find(control=>control.id==='native-save-confirm-apply')!;
    await f.click('native-save-confirm-cancel');await f.click(`native-save-select-${NAMED_SAVE_KEYS[0]}`);await f.click('native-save-overwrite');
    await oldApply.onActivate();oldPage.onClose?.();expect(f.page.id).toBe('native-saves-confirm');expect(f.options.deleteSave).not.toHaveBeenCalled();expect(f.options.saveNamed).not.toHaveBeenCalled();
    await f.click('native-save-confirm-apply');expect(f.options.saveNamed).toHaveBeenCalledExactlyOnceWith('Camp A',NAMED_SAVE_KEYS[0],'A');f.manager.dispose();
  });
  it('filters accents and labels without changing the real capacity or reviving a hidden record',async()=>{
    const f=fixture();f.setEntries(NAMED_SAVE_KEYS.map((key,index)=>({key,kind:'named',label:index===0?'Forêt sûre':`Camp ${index}`,detail:'Jour 2',revision:`rev-${index}`})));
    await f.manager.open();const oldLoad=f.page.rows.find(row=>row.id===`native-save-slot-${NAMED_SAVE_KEYS[1]}`)!.controls![0]!;
    await f.click(`native-save-select-${NAMED_SAVE_KEYS[0]}`);await f.page.rows.find(row=>row.id==='native-save-search')!.input!.onCommit('foret sure');
    expect(f.page.rows.filter(row=>row.fileEntry).map(row=>row.label)).toEqual(['Forêt sûre']);expect(f.page.rows.some(row=>row.id==='native-save-selected')).toBe(false);
    expect(f.page.rows.find(row=>row.id==='native-save-named-slots')!.value).toContain('12 / 12');await oldLoad.onActivate();expect(f.options.load).not.toHaveBeenCalled();
    const form=f.page.rows.find(row=>row.id==='native-save-name')!;expect(form.region).toBe('toolbar');await form.input!.onCommit('Une nouvelle copie');
    expect(f.page.rows.find(row=>row.id==='native-save-name')!.controls![0]!.disabled).toBe(true);expect(f.options.saveNamed).not.toHaveBeenCalled();f.manager.dispose();
  });
  it('rejects captured commands from a closed and reopened manager',async()=>{
    const f=fixture();await f.manager.open();const oldPage=f.page,oldLoad=oldPage.rows.find(row=>row.fileEntry)!.controls![0]!;
    await f.click('native-saves-close');await f.manager.open();await oldLoad.onActivate();oldPage.onClose?.();
    expect(f.options.load).not.toHaveBeenCalled();expect(f.options.close).toHaveBeenCalledTimes(1);expect(f.page.id).toBe('native-saves');f.manager.dispose();
  });
});
