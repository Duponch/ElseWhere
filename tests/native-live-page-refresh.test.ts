import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/index';
import {newCookingBill} from '../src/sim/cooking-bills';
import {newShelfStorage} from '../src/sim/shelf-storage';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {buildNativeFactions,buildNativeWorld,setNativeWorldTab} from '../src/ui3d/native-world';
import {liveNativePage,refreshNativePage} from '../src/ui3d/native-page-refresh';
import {NativeStage} from '../src/ui3d/NativeStage';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import type {Command,World} from '../src/sim/types';
import type {NativeControl,NativePage,NativeRow,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';

let seed=8_530_000;
const noop=()=>{};
const rows=(p:NativePage)=>[...p.rows,...p.inspectInfo??[]];
const control=(p:NativePage,id:string):NativeControl=>{
 const c=[...p.actions??[],...rows(p).flatMap(r=>r.controls??[])].find(c=>c.id===id);if(!c)throw Error('Missing '+id);return c;
};
function fixture(){
 const world=createWorld(++seed,16,16);for(const pawn of world.pawns)delete pawn.background;
 const state:NativeUiState={world,epoch:seed,publicationRevision:1,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[world.pawns[0]!.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage|null=null;
 const refresh=()=>{if(page)page=refreshNativePage(page,state,actions);if(!page)page=state.panel?buildNativePanel(state,actions):buildNativeInspector(state,actions);};
 const actions:NativeUiActions={command:vi.fn(async c=>applyCommand(state.world!,c)),readState:()=>state,showPage:p=>{page=p;},refresh,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,isCurrentPage:p=>page===p};
 const accept=(c:Command)=>{const tick=state.world!.tick;expect(applyCommand(state.world!,c)).toMatchObject({ok:true});expect(state.world!.tick).toBe(tick);state.publicationRevision!++;refresh();};
 const inspector=()=>{setNativeInspectorTab('none');page=buildNativeInspector(state,actions);};
 return{state,actions,accept,refresh,inspector,get world(){return state.world!;},get page(){if(!page)throw Error('No page');return page;},set page(p:NativePage){page=p;}};
}
function registry(world:World){
 const tiles=Array.from({length:128},(_,i)=>({biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[(i+127)%128,(i+1)%128]}));
 const g=generateForeignWorldFactions256({version:world.schemaVersion,tick:world.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:world.nextId,random:new WorldGenerationRandom(821)});if(!g.ok)throw Error(g.reason);
 const completed=completeWorldFactionRegistry256({version:world.schemaVersion,draft:g.draft,playerDef:'PlayerColony',name:'Camp UI',postWorldRandom:new WorldGenerationRandom(821)});if(!completed.ok)throw Error(completed.reason);
 world.worldFactions=completed.registry;world.nextId=g.nextThingId;return completed.registry;
}
function ink(page:NativePage){
 const stage=Object.assign(Object.create(NativeStage.prototype),{textFontRevision:0,textEntityRevision:0,frontVisible:false,width:1440,height:900,displayScale:1,bottomDockHeight:96,scroll:0,regionOffsets:{navigation:0,details:0,graph:0},graphX:0,paletteX:0,setupDetailsX:0}) as {pageInkSignature:(p:NativePage)=>string};
 return stage.pageInkSignature(page);
}

describe('live native owners refresh without reopening their windows',()=>{
 it('keeps a clicked human Needs tab live across real simulation updates and an accepted same-tick rename',async()=>{
  const f=fixture();f.inspector();await control(f.page,'pawn-tab-needs').onActivate();
  const card=()=>f.page.rows.find(r=>r.card?.type==='needs')!.card as {needs:readonly {id:string;level:number}[]};
  const before=card().needs.find(n=>n.id==='need-hunger')!.level,old=f.page;stepWorld(f.world,12);f.state.publicationRevision!++;f.refresh();
  expect(f.page.id).toBe(old.id);expect(card().needs.find(n=>n.id==='need-hunger')!.level).not.toBe(before);
  const tick=f.world.tick;f.accept({type:'pawn-rename',pawnId:f.world.pawns[0]!.id,nick:'Lise',title:''});
  expect(f.page.title).toContain('Lise');expect(f.world.tick).toBe(tick);expect(f.page.inspectTab?.id).toBe('needs');
 });
 it('keeps the management root returned from a help page live for same-tick schedule changes',async()=>{
  const f=fixture();f.state.panel='schedule';f.page=buildNativePanel(f.state,f.actions)!;
  await control(f.page,'schedule-help-open').onActivate();expect(f.page.id).toBe('schedule-help');expect(f.page.refreshFromState).toBeUndefined();
  await control(f.page,'schedule-help-back').onActivate();expect(f.page.id).toBe('schedule');
  const id=f.world.pawns[0]!.id,old=control(f.page,`hour-${id}-8`).hint;
  f.accept({type:'schedule-paint',pawnId:id,hours:[8],assignment:'sleep'});
  expect(control(f.page,`hour-${id}-8`).hint).not.toBe(old);expect(control(f.page,`hour-${id}-8`).hint).toContain('Dormir');
 });
 it('re-reads unchanged-tick work priorities while retaining the table context',()=>{
  const f=fixture();f.state.panel='work';f.page=buildNativePanel(f.state,f.actions)!;const id=f.world.pawns[0]!.id;
  f.accept({type:'priority',pawnId:id,work:'build',value:1});expect(control(f.page,`work-${id}-build`).label).toBe('1');
  f.accept({type:'priority',pawnId:id,work:'build',value:4});expect(control(f.page,`work-${id}-build`).label).toBe('4');
 });
 it('keeps policy and allowed-area overview lists live while leaving their rename drafts alone',async()=>{
  const f=fixture();f.state.panel='assign';f.page=buildNativePanel(f.state,f.actions)!;
  await control(f.page,'assign-manage-food').onActivate();
  f.accept({type:'food-policy-create',name:'Régime ajouté'});expect(rows(f.page).flatMap(r=>r.controls??[]).some(c=>c.label==='Régime ajouté')).toBe(true);
  f.page=buildNativePanel(f.state,f.actions)!;await control(f.page,'areas-manage').onActivate();
  f.accept({type:'allowed-area-create'});const area=f.world.allowedAreas!.at(-1)!;
  f.accept({type:'allowed-area-settings',areaId:area.id,label:'Nouvelle zone'});expect(rows(f.page).find(r=>r.id===`area-${area.id}`)?.label).toBe('Nouvelle zone');
  await control(f.page,`area-${area.id}-rename`).onActivate();const draft=f.page;
  const input=draft.rows.find(r=>r.input)!.input!;await input.onCommit('Saisie locale');
  f.accept({type:'allowed-area-settings',areaId:area.id,label:'Autre nom confirmé'});
  expect(f.page).toBe(draft);expect(f.page.refreshFromState).toBeUndefined();
 });
 it('follows live storage policy after opening its actual tab, retaining search and tree expansion',async()=>{
  const f=fixture(),shelf={id:f.world.nextId++,kind:'shelf' as const,x:7,z:8,orientation:0 as const,footprint:'standard' as const,shelf:newShelfStorage([8*f.world.width+7,8*f.world.width+8],f.world.schemaVersion)};f.world.structures.push(shelf);
  f.state.selectedPawnIds=[];f.state.selectedObjects=[{kind:'structure',id:shelf.id}];f.inspector();await control(f.page,'pane-tab-storage').onActivate();
  const branch=rows(f.page).find(r=>r.tree?.branch&&!r.tree.expanded&&r.controls?.some(c=>c.glyph==='expand'&&!c.disabled));
  if(branch){await branch.controls!.find(c=>c.glyph==='expand')!.onActivate();expect(rows(f.page).find(r=>r.id===branch.id)?.tree?.expanded).toBe(true);}
  await rows(f.page).find(r=>r.id==='storage-search')!.input!.onCommit('bois');
  const before=ink(f.page);f.accept({type:'shelf-policy',structureId:shelf.id,settings:{...shelf.shelf.settings,priority:5}});
  expect(f.page.inspectTab?.id).toBe('storage');expect(ink(f.page)).not.toBe(before);expect(JSON.stringify(f.page)).toContain('Critique');
  expect(rows(f.page).find(r=>r.id==='storage-search')?.input?.value).toBe('bois');
  await rows(f.page).find(r=>r.id==='storage-search')!.input!.onCommit('');
  if(branch)expect(rows(f.page).find(r=>r.id===branch.id)?.tree?.expanded).toBe(true);
 });
 it('updates pristine bill settings from accepted commands while preserving an edited bill draft',async()=>{
  const f=fixture(),bill=newCookingBill(f.world.nextId++,'shirt',f.world.schemaVersion),station={id:f.world.nextId++,kind:'tailor-bench' as const,x:7,z:8,orientation:0 as const,footprint:'standard' as const,bills:[bill]};f.world.structures.push(station);
  f.state.selectedPawnIds=[];f.state.selectedObjects=[{kind:'structure',id:station.id}];f.inspector();await control(f.page,'pane-tab-bills').onActivate();
  const target=()=>rows(f.page).find(r=>r.id===`bill-target-${bill.id}`)!;
  const settings=()=>({mode:bill.mode,target:bill.target,suspended:bill.suspended,filters:{...bill.filters},radius:bill.radius,destination:bill.destination});
  f.accept({type:'bill-update',structureId:station.id,billId:bill.id,settings:{...settings(),target:4}});expect(target().input?.value).toBe('4');
  await target().input!.onCommit('9');expect(target().input?.value).toBe('9');
  f.accept({type:'bill-update',structureId:station.id,billId:bill.id,settings:{...settings(),target:6,suspended:true}});
  expect(target().input?.value).toBe('9');expect(rows(f.page).find(r=>r.id===`bill-${bill.id}`)?.value).toContain('Suspendue');
  await control(f.page,`bill-revert-${bill.id}`).onActivate();expect(target().input?.value).toBe('6');
 });
 it('updates both faction list and open faction dossier from newer accepted registry facts',async()=>{
  const f=fixture(),reg=registry(f.world),relation=reg.relations.find(r=>r.aId===reg.playerFactionId||r.bId===reg.playerFactionId)!,id=relation.aId===reg.playerFactionId?relation.bId:relation.aId;
  f.page=buildNativeFactions(f.state,f.actions);const row=()=>f.page.rows.find(r=>r.id===`faction-${id}`)!;
  relation.goodwill=23;f.state.publicationRevision!++;f.refresh();expect(row().factionEntry?.goodwill).toBe(23);
  await control(f.page,`faction-${id}-field-5`).onActivate();expect(f.page.id).toBe(`faction-detail-${id}`);
  relation.goodwill=41;f.state.publicationRevision!++;f.refresh();expect(f.page.rows.find(r=>r.id==='faction-detail-relation')?.value).toContain('+41');
 });
 it('keeps a World root promoted by tab navigation live on accepted same-tick facts',async()=>{
  const f=fixture(),reg=registry(f.world),relation=reg.relations.find(r=>r.aId===reg.playerFactionId||r.bId===reg.playerFactionId)!,id=relation.aId===reg.playerFactionId?relation.bId:relation.aId;
  f.state.panel='world';setNativeWorldTab('maps');f.page=buildNativeWorld(f.state,f.actions);
  await control(f.page,'world-tab-factions').onActivate();relation.goodwill=37;f.state.publicationRevision!++;f.refresh();
  expect(f.page.rows.find(r=>r.id===`faction-${id}`)?.value).toContain('+37');
 });
 it('retires an inspector owned by another selection or map, and preserves static confirmations and drafts',()=>{
  const f=fixture();f.inspector();const original=f.page;f.state.selectedPawnIds=[f.world.pawns[1]!.id];
  expect(refreshNativePage(original,f.state,f.actions)).toBeNull();
  const draft:NativePage={id:'draft',title:'Confirmation',modal:true,rows:[{id:'local',label:'',input:{value:'Texte en cours',onCommit:()=>true}}]};
  f.state.publicationRevision!++;expect(refreshNativePage(draft,f.state,f.actions)).toBe(draft);
  const live=liveNativePage({id:'live',title:'Live',rows:[]},f.state,()=>draft);f.state.epoch!++;expect(refreshNativePage(live,f.state,f.actions)).toBeNull();
 });
 it('keeps identical projections at the same ink signature while including inspector-tab geometry',()=>{
  const f=fixture();f.inspector();const initial=f.page;f.refresh();expect(ink(f.page)).toBe(ink(initial));
  const page:NativePage={id:'geometry',title:'',rows:[],inspectTab:{id:'health',width:630,height:430,margin:0}};
  expect(ink(page)).not.toBe(ink({...page,inspectTab:{...page.inspectTab!,height:520}}));
 });
});
