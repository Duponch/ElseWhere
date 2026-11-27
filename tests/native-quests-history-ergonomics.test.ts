import {describe,expect,it,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import type {World} from '../src/sim/types';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age';
import {adoptColonyEconomy} from '../src/sim/colony-economy';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {worldSettlementAccess256} from '../src/sim/world-faction-access';
import {buildNativePanel,resetNativePanelSession} from '../src/ui3d/native-panels';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import type {JoinerQuest} from '../src/sim/quest-state';
import {layoutNativePage,NATIVE_UI} from '../src/ui3d/native-layout';

let nextEpoch=612000;
function fixture(panel:'quests'|'history'='quests'){
 const world=createWorld(++nextEpoch,16,16);
 const state:NativeUiState={world,epoch:nextEpoch,panel,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:false}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;const noop=()=>{};
 const actions:NativeUiActions={command:vi.fn(async()=>({ok:true})),readState:()=>state,showPage:next=>{page=next;},refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const rebuild=()=>{page=buildNativePanel(state,actions)!;};rebuild();
 return{world,state,actions,rebuild,get page(){return page;}};
}
function control(page:NativePage,id:string):NativeControl {const found=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(c=>c.id===id);expect(found,'Missing '+id).toBeDefined();return found!;}
function offer(world:World,id:number,status:JoinerQuest['status']='offered'):JoinerQuest {
 return {id,name:'Iris '+id,offeredAt:world.tick,expiresAt:world.tick+300,profile:0,joinDelay:50,raidDelay:100,status,
  age:{biologicalTicks:29*HUMAN_YEAR_TICKS,chronologicalTicks:78*HUMAN_YEAR_TICKS},background:{childhood:'school-child',adulthood:'researcher'},
  relationship:{kind:'sibling',otherId:world.pawns[0]!.id},...(status==='concluded'?{endedAt:world.tick}:{} )};
}
function quests(world:World,...entries:JoinerQuest[]){world.quests={profile:'pursued-joiner-v1',adoptedAt:world.tick,rng:1,nextCheck:world.tick+100,serial:entries.length,entries};}

it('a closed history starts on Messages again and a retired control cannot restore its old tab',async()=>{
 const f=fixture('history');const old=control(f.page,'history-tab-stats');await old.onActivate();expect(control(f.page,'history-tab-stats').active).toBe(true);
 resetNativePanelSession('history');f.rebuild();expect(control(f.page,'history-tab-messages').active).toBe(true);
 await old.onActivate();expect(control(f.page,'history-tab-messages').active).toBe(true);
});

describe('Quêtes and Historique restore recorded facts without changing rules',()=>{
 it('shows offered age, named relationship, localized backstory and skills before the optional historical dossiers',async()=>{
  const f=fixture(),live=offer(f.world,80),old=offer(f.world,81,'concluded');quests(f.world,live,old);f.rebuild();const before=structuredClone(f.world);
  expect([f.page.width,f.page.height,f.page.layout]).toEqual([1010,640,'quests']);
  expect(control(f.page,'quests-select-quest-80').active).toBe(true);
  expect(f.page.rows.find(r=>r.id==='quest-80-age')?.value).toBe('29 / 78 ans');
  expect(f.page.rows.find(r=>r.id==='quest-80-relationship')?.value).toContain(f.world.pawns[0]!.name);
  expect(f.page.rows.find(r=>r.id==='quest-80-background')?.value).toContain('Élève studieux');
  expect(f.page.rows.find(r=>r.id==='quest-80-background')?.value).toContain('Chercheur');
  expect(f.page.rows.find(r=>r.id==='quest-80-skills')?.value).toContain('Intellectuel');
  expect(f.page.rows.find(r=>r.id==='quest-80')?.detail).toContain('1 h 12 min');
  expect(f.page.rows.some(r=>r.id==='quest-81')).toBe(false);
  await control(f.page,'quests-history-toggle').onActivate();
  expect(f.page.rows.some(r=>r.id==='quest-80')).toBe(false);
  expect(f.page.rows.find(r=>r.id==='quest-81')?.value).toContain('issue neutre');
  await control(f.page,'quests-tab-available').onActivate();expect(f.page.rows.some(r=>r.id==='quest-80')).toBe(true);
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('keeps one selected dossier, follows its real status across tabs and searches without sending an order',async()=>{
  const f=fixture(),first=offer(f.world,100),second=offer(f.world,101),ongoing=offer(f.world,102,'accepted'),old=offer(f.world,103,'concluded');
  quests(f.world,first,second,ongoing,old);f.rebuild();
  await control(f.page,'quests-select-quest-100').onActivate();
  expect(f.page.rows.some(r=>r.id==='quest-100')).toBe(true);expect(f.page.rows.some(r=>r.id==='quest-101')).toBe(false);
  expect(control(f.page,'quests-select-quest-101').active).toBe(false);
  first.status='accepted';first.acceptedAt=f.world.tick;f.rebuild();
  expect(control(f.page,'quests-tab-active').active).toBe(true);expect(f.page.rows.some(r=>r.id==='quest-100')).toBe(true);
  expect(control(f.page,'quests-select-quest-102').active).toBe(false);
  first.status='concluded';first.endedAt=f.world.tick;f.rebuild();
  expect(control(f.page,'quests-history-toggle').active).toBe(true);expect(f.page.rows.some(r=>r.id==='quest-100')).toBe(true);
  await control(f.page,'quests-tab-available').onActivate();
  await f.page.rows.find(r=>r.id==='quests-search')!.input!.onCommit('IRIS 101');
  expect(f.page.rows.filter(r=>r.id.startsWith('quests-entry-')).map(r=>r.id)).toEqual(['quests-entry-quest-101']);
  expect(f.page.rows.some(r=>r.id==='quest-101')).toBe(true);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('sizes the Core quest rail, fixed search and independent scroll at normal and high interface scale',()=>{
  const f=fixture();quests(f.world,...Array.from({length:45},(_,i)=>offer(f.world,100+i)));f.rebuild();
  for(const viewpoint of [{width:1440,height:860},{width:480,height:240}]){
   const box=layoutNativePage(f.page,viewpoint,false,(s,n)=>s.length*n*.52),nav=box.regions.navigation!,details=box.regions.details!;
   expect(box.x+box.width).toBeLessThanOrEqual(viewpoint.width);expect(box.y+box.height).toBeLessThanOrEqual(viewpoint.height);
   expect(nav.width).toBe(Math.round((box.width-2*NATIVE_UI.padding)*.36));expect(details.x-nav.x-nav.width).toBe(17);
   for(const region of Object.values(box.regions)){expect(region.x+region.width).toBeLessThanOrEqual(box.width);expect(region.y+region.height).toBeLessThanOrEqual(box.height);}
   const entries=box.rows.filter(r=>r.row.id.startsWith('quests-entry-'));expect(entries.filter(r=>r.row.id.startsWith('quests-entry-quest-'))).toHaveLength(45);
   expect(entries.every(r=>r.height===32&&r.controls[0]?.height===32)).toBe(true);expect(nav.contentHeight).toBeGreaterThan(nav.height);
   const search=box.rows.find(r=>r.row.id==='quests-search')!;expect(search.inputRect!.height).toBe(24);
   if(viewpoint.width>1000){expect(box.regions.toolbar).toBeDefined();expect(search.row.region).toBe('toolbar');expect(search.inputRect!.y+box.header).toBeGreaterThanOrEqual(nav.y+nav.height);}
   else expect(search.row.region).toBe('navigation');
  }
 });

 it('keeps asylum answers on the recorded id and refuses expired, busy or previous-map handlers',async()=>{
  const f=fixture();quests(f.world,offer(f.world,90));f.rebuild();
  const stale=control(f.page,'quest-90-accept');
  f.state.epoch!++;f.rebuild();await stale.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  const current=control(f.page,'quest-90-accept');f.state.busy=true;await current.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  f.state.busy=false;f.world.quests!.entries[0]!.expiresAt=f.world.tick;await current.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  f.world.quests!.entries[0]!.expiresAt=f.world.tick+300;f.rebuild();await control(f.page,'quest-90-refuse').onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'answer-quest',questId:90,accept:false});
 });

 it('uses only recorded economic totals and retains the full journal behind a bounded, searchable view',async()=>{
  const f=fixture('history');adoptColonyEconomy(f.world);
  f.world.economy!.wealth={items:111,structures:222,floors:333,pawnsKnown:0,knownTotal:666,knownStorytellerWealth:666,unpricedPileIds:[],unpricedPackedIds:[],unpricedStructureIds:[],unpricedPawnIds:[f.world.pawns[0]!.id],complete:false};
  f.world.events=Array.from({length:45},(_,i)=>({tick:0,type:'command' as const,message:i===2?'Récolte de maïs ancienne':'Événement '+i}));f.rebuild();const before=structuredClone(f.world);
  expect([f.page.width,f.page.height,f.page.layout]).toEqual([1010,640,'history']);
  expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id))).toHaveLength(30);
  await control(f.page,'history-tab-stats').onActivate();
  expect(f.page.rows.find(r=>r.id==='economy-items')?.value).toBe('111 argent');
  expect(f.page.rows.find(r=>r.id==='economy-buildings')?.value).toBe('222 argent');
  expect(f.page.rows.find(r=>r.id==='economy-floors')?.value).toBe('333 argent');
  expect(f.page.rows.find(r=>r.id==='economy-expectations')?.value).toContain('palier provisoire');
  await control(f.page,'history-tab-graph').onActivate();
  const chart=f.page.rows.find(r=>r.id==='history-wealth-graph')!;
  expect(chart.historyGraph).toMatchObject({total:666,complete:false,bars:[{value:111},{value:222},{value:333},{value:0}]});
  expect(chart.hint).toContain('pas une série historique');
  const graphBox=layoutNativePage(f.page,{width:1440,height:860},false,(s,n)=>s.length*n*.52);
  expect(graphBox.rows.find(r=>r.row.id===chart.id)!.height).toBe(450);
  await control(f.page,'history-tab-messages').onActivate();
  await control(f.page,'history-range').onActivate();expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id))).toHaveLength(45);
  await f.page.rows.find(r=>r.id==='history-search')!.input!.onCommit('recolte');
  expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id)).map(r=>r.id)).toEqual(['event-2']);
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('keeps the real 30-point message columns, fixed search and a separately selected full message',async()=>{
  const f=fixture('history');
  f.world.events=Array.from({length:40},(_,i)=>({tick:0,type:'command' as const,message:'Événement '+i+' · information complète et détaillée du journal de la colonie'}));
  f.rebuild();const before=structuredClone(f.world);
  await control(f.page,'history-select-event-20').onActivate();
  expect(f.page.rows.find(r=>r.id==='history-selected-body')?.label).toBe(f.world.events[20]!.message);
  expect(control(f.page,'history-select-event-20').active).toBe(true);
  for(const viewport of [{width:1440,height:860},{width:480,height:240}]){
   const box=layoutNativePage(f.page,viewport,false,(s,n)=>s.length*n*.52),nav=box.regions.navigation!,details=box.regions.details!,entries=box.rows.filter(r=>r.row.historyEntry);
   expect(box.x+box.width).toBeLessThanOrEqual(viewport.width);expect(box.y+box.height).toBeLessThanOrEqual(viewport.height);
   for(const region of Object.values(box.regions)){expect(region.x+region.width).toBeLessThanOrEqual(box.width);expect(region.y+region.height).toBeLessThanOrEqual(box.height);}
   expect(details.x-nav.x-nav.width).toBe(10);expect(entries.every(r=>r.height===30)).toBe(true);
   expect(entries.some(r=>r.row.id==='event-20')).toBe(true);
   const field=box.rows.find(r=>r.row.id==='history-search')!.inputRect!;
   expect(field.height).toBe(24);
   if(viewport.width>1000){
    expect(field).toMatchObject({x:NATIVE_UI.padding+720,y:8,width:240,height:24});
    const entry=entries.find(r=>r.row.id==='event-20')!;
    expect(entry.labelWidth).toBe(90);expect(entry.controls.find(c=>c.control.id==='event-pin-20')).toMatchObject({width:22,height:22,x:entry.x+4});
    expect(entry.controls.find(c=>c.control.id==='history-select-event-20')).toMatchObject({x:entry.x+165,height:30});
   }
  }
  await control(f.page,'history-filter-messages').onActivate();
  expect(f.page.rows.some(r=>r.id==='event-20')).toBe(false);
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('retains reward choice as a local draft and rechecks the real offer before the unchanged accept command',async()=>{
  const f=fixture(),tiles=Array.from({length:128},(_,i)=>({biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[(i+127)%128,(i+1)%128]}));
  // A small pure faction-generation fixture supplies real registry owners.
  // No campaign, map progression, quote or worker authority is reconstructed.
  const generated=generateForeignWorldFactions256({version:f.world.schemaVersion,tick:f.world.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:f.world.nextId,random:new WorldGenerationRandom(718)});
  if(!generated.ok)throw Error(generated.reason);
  const completed=completeWorldFactionRegistry256({version:f.world.schemaVersion,draft:generated.draft,playerDef:'PlayerColony',name:'Camp témoin UI',postWorldRandom:new WorldGenerationRandom(718)});
  if(!completed.ok)throw Error(completed.reason);
  f.world.worldFactions=completed.registry;f.world.nextId=generated.nextThingId;const registry=completed.registry;
  const settlement=registry.settlements.find(s=>{const access=worldSettlementAccess256(registry,s.id);return access.ok&&access.canTrade;});
  expect(settlement,'fixture needs an existing non-hostile settlement').toBeDefined();
  const rewardId=f.world.nextId++,otherRewardId=f.world.nextId++;
  f.world.tradeRequests284={revision:1,adoptedAtCore:0,nextId:2,entries:[{
   id:1,homeMapId:0,settlementId:settlement!.id,factionId:settlement!.factionId,giverId:registry!.leaders.find(p=>p.factionId===settlement!.factionId)!.pawn.id,tile:settlement!.tile,settlementName:settlement!.name,
   offeredAtCore:0,offerExpiresAtCore:60000,durationCore:60000,family:'cloth',quantity:10,baseMarketValue:1.5,wealth:{basis:'known-material-v1',value:1000,items:1000,structures:0,floors:0,unpricedPiles:0,unpricedPacked:0,unpricedStructures:0,unpricedPawns:0},rewardBudget:100,options:[{id:2,goodwill:0,original:[{id:rewardId,item:'silver',quantity:10}],items:[{id:rewardId,kind:'silver',item:'silver',quantity:10,owner:{type:'trade-request284',requestId:1,optionId:2}}]},{id:3,goodwill:1,original:[{id:otherRewardId,item:'silver',quantity:5}],items:[{id:otherRewardId,kind:'silver',item:'silver',quantity:5,owner:{type:'trade-request284',requestId:1,optionId:3}}]}],dismissed:false,status:'offered',cleanup:[],
  }]};f.rebuild();const before=structuredClone(f.world);
  const otherChoice=control(f.page,'trade-request-1-option-3');
  await control(f.page,'trade-request-1-option-2').onActivate();
  expect(f.actions.command).not.toHaveBeenCalled();expect(f.world).toEqual(before);
  await control(f.page,'trade-request-1-accept').onActivate();expect(f.page.id).toBe('trade-answer-1');
  const previousChoiceConfirmation=control(f.page,'trade-answer-1-confirm');
  await otherChoice.onActivate();await previousChoiceConfirmation.onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  await control(f.page,'trade-request-1-option-2').onActivate();await control(f.page,'trade-request-1-accept').onActivate();
  f.world.tradeRequests284.entries[0]!.status='expired';
  await control(f.page,'trade-answer-1-confirm').onActivate();expect(f.actions.command).not.toHaveBeenCalled();
  f.world.tradeRequests284.entries[0]!.status='offered';f.rebuild();
  await control(f.page,'trade-request-1-accept').onActivate();
  const staleConfirmation=control(f.page,'trade-answer-1-confirm'),staleReturn=control(f.page,'trade-answer-1-back'),staleClose=f.page.onClose!;
  f.state.epoch!++;f.state.panel='history';f.rebuild();
  await staleConfirmation.onActivate();await staleReturn.onActivate();staleClose();expect(f.page.id).toBe('history');expect(f.actions.command).not.toHaveBeenCalled();
  f.state.panel='quests';f.rebuild();expect(control(f.page,'trade-request-1-accept').disabled).toBe(true);
  await control(f.page,'trade-request-1-option-2').onActivate();
  await control(f.page,'trade-request-1-accept').onActivate();
  await control(f.page,'trade-answer-1-confirm').onActivate();
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'trade-request-answer',requestId:1,optionId:2});
 });
});
