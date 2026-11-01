import {describe,expect,it,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import type {World} from '../src/sim/types';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age';
import {adoptColonyEconomy} from '../src/sim/colony-economy';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {worldSettlementAccess256} from '../src/sim/world-faction-access';
import {buildNativePanel} from '../src/ui3d/native-panels';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import type {JoinerQuest} from '../src/sim/quest-state';

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

describe('Quêtes and Historique restore recorded facts without changing rules',()=>{
 it('shows offered age, named relationship, localized backstory and skills before the optional historical dossiers',async()=>{
  const f=fixture(),live=offer(f.world,80),old=offer(f.world,81,'concluded');quests(f.world,live,old);f.rebuild();const before=structuredClone(f.world);
  expect(f.page.width).toBe(920);
  expect(f.page.rows.find(r=>r.id==='quest-80-age')?.value).toBe('29 / 78 ans');
  expect(f.page.rows.find(r=>r.id==='quest-80-relationship')?.value).toContain(f.world.pawns[0]!.name);
  expect(f.page.rows.find(r=>r.id==='quest-80-background')?.value).toContain('Élève studieux');
  expect(f.page.rows.find(r=>r.id==='quest-80-background')?.value).toContain('Chercheur');
  expect(f.page.rows.find(r=>r.id==='quest-80-skills')?.value).toContain('Intellectuel');
  expect(f.page.rows.find(r=>r.id==='quest-80')?.detail).toContain('1 h 12 min');
  expect(f.page.rows.some(r=>r.id==='quest-81')).toBe(false);
  await control(f.page,'quests-history-toggle').onActivate();
  expect(f.page.rows.findIndex(r=>r.id==='quest-80')).toBeLessThan(f.page.rows.findIndex(r=>r.id==='quest-81'));
  expect(f.page.rows.find(r=>r.id==='quest-81')?.value).toContain('issue neutre');
  expect(f.world).toEqual(before);expect(f.actions.command).not.toHaveBeenCalled();
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
  expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id))).toHaveLength(30);
  expect(f.page.rows.find(r=>r.id==='economy-items')?.value).toBe('111 argent');
  expect(f.page.rows.find(r=>r.id==='economy-buildings')?.value).toBe('222 argent');
  expect(f.page.rows.find(r=>r.id==='economy-floors')?.value).toBe('333 argent');
  expect(f.page.rows.find(r=>r.id==='economy-expectations')?.value).toContain('palier provisoire');
  await control(f.page,'history-range').onActivate();expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id))).toHaveLength(45);
  await f.page.rows.find(r=>r.id==='history-search')!.input!.onCommit('recolte');
  expect(f.page.rows.filter(r=>/^event-[0-9]+$/.test(r.id)).map(r=>r.id)).toEqual(['event-2']);
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
