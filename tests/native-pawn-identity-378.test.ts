import {describe,expect,it,vi} from 'vitest';
import {createWorld,applyCommand} from '../src/sim/engine.ts';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {nativeActionIconKind} from '../src/ui3d/native-action-icons';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
let epoch=378000;
function ui(){
 const w=createWorld(378,20,20),p=w.pawns[0]!;let page:NativePage;
 const state:NativeUiState={world:w,epoch:++epoch,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[p.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{},actions:NativeUiActions={readState:()=>state,command:vi.fn(async c=>applyCommand(w,c)),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:next=>{page=next;},refresh:noop};
 setNativeInspectorTab('bio');page=buildNativeInspector(state,actions)!;
 return {w,p,state,actions,get page(){return page;}};
}
const bioButton=(page:NativePage,id:string)=>page.rows.find(r=>r.bio)!.bio!.buttons!.find(b=>b.id===id)!;
describe('native Bio decisions are confirmed commands',()=>{
 it('renders original rename/banish glyphs and keeps edits as a cancelable draft',async()=>{
  const f=ui(),name=f.p.name;expect(nativeActionIconKind('pawn-banish')).toBe('banish');expect(nativeActionIconKind('pawn-rename')).toBe('rename');
  await bioButton(f.page,'pawn-rename').onActivate();expect(f.page).toMatchObject({modal:true,layout:'dialog'});await f.page.rows.find(r=>r.id==='pawn-name-nick')!.input!.onCommit('Éloïse');expect(f.p.name).toBe(name);expect(f.actions.command).not.toHaveBeenCalled();
  await f.page.actions!.find(b=>b.id==='pawn-identity-cancel')!.onActivate();expect(f.p.name).toBe(name);expect(f.actions.command).not.toHaveBeenCalled();
  await bioButton(f.page,'pawn-rename').onActivate();await f.page.rows.find(r=>r.id==='pawn-name-nick')!.input!.onCommit('Éloïse');await f.page.rows.find(r=>r.id==='pawn-name-title')!.input!.onCommit('Artisane');await f.page.actions!.find(b=>b.id==='pawn-rename-confirm')!.onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'pawn-rename',pawnId:f.p.id,nick:'Éloïse',title:'Artisane'});expect(f.p.name).toBe('Éloïse');expect(f.p.identity378?.title).toBe('Artisane');
 });
 it('requires confirmation and rechecks selected epoch before banishing',async()=>{
  const f=ui();await bioButton(f.page,'pawn-banish').onActivate();expect(f.actions.command).not.toHaveBeenCalled();expect(f.page.rows.some(r=>r.id==='pawn-banish-confirmation')).toBe(true);
  const confirm=f.page.actions!.find(b=>b.id==='pawn-banish-confirm')!;f.state.epoch!++;await confirm.onActivate();expect(f.actions.command).not.toHaveBeenCalled();expect(f.page.rows.find(r=>r.id==='pawn-identity-error')!.label).toContain('changé');
 });
 it('shows pending movement/heterogeneous queues with player-facing names',()=>{
  const f=ui();f.p.orderedQueue378=[{type:'draft-move',pawnIds:[f.p.id],target:{x:2,z:2},queue:false},{type:'order-animal-378',pawnId:f.p.id,animalId:99,action:'tame',queue:false}];f.p.draft={lastActiveTick:0,target:null,queue:[{x:3,z:3}]};
  const page=buildNativeInspector(f.state,f.actions)!,row=page.rows.find(r=>r.id==='pawn-orders')!;expect(row.value).toContain('3 en file');expect(row.hint).toBe('Se déplacer → Apprivoiser → Se déplacer');expect(row.hint).not.toContain('draft-move');
 });
});
