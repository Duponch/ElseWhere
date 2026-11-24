import {describe,expect,it,vi} from 'vitest';
import {existsSync} from 'node:fs';
import {createNativeTradeRequestDelivery} from '../src/ui3d/native-trade-request-delivery';
import {buildNativeWorld,focusNativeTradeRequestDestination,nativeTradeRequestVisitors,setNativeWorldTab,syncNativeWorldState} from '../src/ui3d/native-world';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {layoutNativePage} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {tradeRequestContent284} from '../src/sim/trade-request-content-284';
import {tradeRewardManifest284} from '../src/sim/trade-request-holder-284';
import {quoteTradeRequestFulfill284} from '../src/sim/trade-request-fulfill-284';
import {groupWorld} from '../src/sim/world-map-authority';
import {campaignPresentation} from '../src/sim/secondary-site-presentation';
import {applyCommand} from '../src/sim/engine';
import {serializeWorld} from '../src/sim/serialization';
import {preparedTradeRequestCamp462,TRADE_REQUEST_CAMP_SOURCE462} from './scenarios/trade-requests-v462';
import type {TradeRequest284,TradeRequestQuote284,TradeRequestCommand284} from '../src/sim/trade-request-state-284';
import type {Command,MaterialPile,World} from '../src/sim/types';

type DeliveryView=ReturnType<Parameters<typeof createNativeTradeRequestDelivery>[0]['read']>;
function deferred<T>(){let resolve!:(value:T)=>void;const promise=new Promise<T>(yes=>{resolve=yes;});return {promise,resolve};}
const controls=(page:NativePage)=>[...page.rows.flatMap(row=>row.controls??[]),...page.actions??[]];
function control(page:NativePage,id:string):NativeControl {const found=controls(page).find(c=>c.id===id);expect(found,id).toBeDefined();return found!;}
const text=(page:NativePage)=>[page.title,page.subtitle,...page.rows.flatMap(row=>[row.label,row.value,row.detail,row.hint])].filter(Boolean).join(' ');
// Invalid callbacks may report refusal by rejecting or by showing a refusal
// page. Both must revoke consent; the tests below assert the retained effects.
const attempt=async(action:()=>void|Promise<unknown>)=>{try{await action();}catch{/* An explicit refusal is allowed by this controller's contract. */}};

function declaredView():DeliveryView {
 const request:TradeRequest284={id:1,homeMapId:1,settlementId:2,factionId:3,giverId:4,tile:5,settlementName:'Destination <littérale>',offeredAtCore:100,offerExpiresAtCore:1000,durationCore:720000,
  family:'cloth',quantity:7,baseMarketValue:tradeRequestContent284('cloth')!.baseMarketValue,wealth:{basis:'known-material-v1',value:0,items:0,structures:0,floors:0,unpricedPiles:0,unpricedPacked:0,unpricedStructures:0,unpricedPawns:2},rewardBudget:500,
  options:[{id:1,goodwill:20,original:[{id:51,item:'revolver',quantity:1,quality:'normal'}],items:[]}],dismissed:false,status:'accepted',cleanup:[],acceptedAtCore:100,expiresAtCore:720100,selectedOptionId:1};
 const quote:TradeRequestQuote284={ok:true,quote:'declared-exact-quote-1',requestId:1,groupId:9,available:10,required:7,consumed:[{pileId:41,item:'cloth',quantity:6},{pileId:42,item:'cloth',quantity:1}],rewards:[{id:51,item:'revolver',quantity:1,quality:'normal',pawnId:17}],mass:{grams:40000,capacityGrams:35000}};
 return {identity:'declared-session-1/group-9',request,quote,groupLabel:'Caravane des roseaux',carrierLabel:id=>`Porteur déclaré ${id}`,consumedLabel:pileId=>`Tissu déclaré, pile ${pileId}`};
}

/** Declared read views and asynchronous UI ports only. These quick tests do
 * not qualify an incident, travel, a Worker ACK, or any physical transaction. */
function fixture(pause:()=>Promise<unknown>=async()=>{},send:(command:TradeRequestCommand284)=>Promise<unknown>=async()=>{}){
 const parent:NativePage={id:'group-9',title:'Caravane',rows:[]};let page=parent,view=declaredView();
 const read=vi.fn(()=>view),pausePort=vi.fn(pause),sendPort=vi.fn(send),show=vi.fn((next:NativePage)=>{page=next;}),back=vi.fn(()=>{page=parent;});
 const owner=createNativeTradeRequestDelivery({parent,requestId:1,groupId:9,read,pause:pausePort,isCurrent:next=>next===page,show,back,send:sendPort});
 return {parent,owner,read,pause:pausePort,send:sendPort,show,back,get page(){return page;},get view(){return view;},set view(next:DeliveryView){view=next;},replace(){page={id:'foreign',title:'Autre page',rows:[]};},confirm(){return control(page,'delivery-confirm-confirm');},cancel(){return control(page,'delivery-confirm-back');}};
}

describe('native trade request delivery owns one explicit consent',()=>{
 it('waits for the pause port, shows the complete compact review and opens without a command or mutation',async()=>{
  const gate=deferred<unknown>(),f=fixture(()=>gate.promise),before=JSON.stringify(f.view),opening=f.owner.open();
  expect(f.pause).toHaveBeenCalledTimes(1);expect(f.show).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled();
  gate.resolve(undefined);await opening;
  expect(f.page).toMatchObject({id:'delivery-confirm',layout:'message',width:640,height:460,closeOwnsNavigation:true});
  expect(f.owner.owns(f.page)).toBe(true);expect(f.owner.owns(f.parent)).toBe(false);
  expect(f.confirm().disabled).not.toBe(true);expect(f.cancel().disabled).not.toBe(true);
  const rendered=text(f.page);for(const label of ['Destination <littérale>','Caravane des roseaux','Porteur déclaré 17','Tissu déclaré, pile 41','Tissu déclaré, pile 42'])expect(rendered).toContain(label);
  expect(rendered).toContain('7');expect(rendered).toContain('10');expect(rendered).toContain('12');expect(rendered).toContain('20');expect(rendered).toMatch(/surcharg/i);
  for(const viewport of [{width:1440,height:900},{width:480,height:320},{width:320,height:240}]){
   const box=layoutNativePage(f.page,viewport,false,(text,size)=>text.length*size*.53);
   expect(box.actions.map(entry=>entry.control.id)).toEqual(['delivery-confirm-back','delivery-confirm-confirm']);
   expect(box.actions.every(entry=>entry.width>0&&entry.height>0&&entry.x+entry.width<=box.width&&box.header+entry.y>=box.body.y+box.body.height&&box.header+entry.y+entry.height<=box.height)).toBe(true);
   expect(box.contentHeight).toBeGreaterThan(box.body.height);
  }
  expect(JSON.stringify(f.view)).toBe(before);expect(f.send).not.toHaveBeenCalled();
 });

 it('rereads the exact quote and sends one explicit command, then returns to its parent',async()=>{
  const f=fixture();await f.owner.open();const reads=f.read.mock.calls.length;
  await f.confirm().onActivate();expect(f.read.mock.calls.length).toBeGreaterThan(reads);
  expect(f.send).toHaveBeenCalledExactlyOnceWith({type:'trade-request-fulfill',requestId:1,groupId:9,quote:'declared-exact-quote-1',confirm:true});
  expect(f.back).toHaveBeenCalledTimes(1);expect(f.page).toBe(f.parent);
 });

 it('excludes double activation while the send port is pending and after it resolves',async()=>{
  const gate=deferred<unknown>(),f=fixture(async()=>{},()=>gate.promise);await f.owner.open();const confirm=f.confirm(),pending=confirm.onActivate();
  try{await attempt(()=>confirm.onActivate());expect(f.send).toHaveBeenCalledTimes(1);}finally{gate.resolve(undefined);await pending;}
  await attempt(()=>confirm.onActivate());expect(f.send).toHaveBeenCalledTimes(1);expect(f.back).toHaveBeenCalledTimes(1);
 });

 it.each(['back','close'] as const)('%s revokes old callbacks and returns once without sending',async(gesture)=>{
  const f=fixture();await f.owner.open();const page=f.page,confirm=f.confirm();
  if(gesture==='back')await f.cancel().onActivate();else{expect(page.onClose).toBeTypeOf('function');page.onClose!();}
  expect(f.page).toBe(f.parent);expect(f.back).toHaveBeenCalledTimes(1);await attempt(()=>confirm.onActivate());page.onClose?.();page.onCancel?.();
  expect(f.send).not.toHaveBeenCalled();expect(f.back).toHaveBeenCalledTimes(1);
 });

 it('never opens from an obsolete parent',async()=>{
  const f=fixture();f.replace();await attempt(()=>f.owner.open());expect(f.pause).not.toHaveBeenCalled();expect(f.show).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled();
 });

 it.each(['navigation','identity','dispose'] as const)('a pending pause cannot reopen after %s changes',async(change)=>{
  const gate=deferred<unknown>(),f=fixture(()=>gate.promise),opening=attempt(()=>f.owner.open());
  expect(f.pause).toHaveBeenCalledTimes(1);
  if(change==='navigation')f.replace();else if(change==='identity')f.view={...f.view,identity:'replacement-session'};else f.owner.dispose();
  gate.resolve(undefined);await opening;expect(f.show).not.toHaveBeenCalled();expect(f.send).not.toHaveBeenCalled();expect(f.back).not.toHaveBeenCalled();
 });

 it('a rejected pause cannot arm a confirmation',async()=>{
  const f=fixture(async()=>{throw Error('Pause refusée.');});await attempt(()=>f.owner.open());expect(f.send).not.toHaveBeenCalled();
  expect(controls(f.page).some(c=>c.id==='delivery-confirm-confirm'&&!c.disabled)).toBe(false);
 });

 it.each(['identity','request','group','quote','refusal','subject'] as const)('revokes consent when the live %s changes before confirmation',async(change)=>{
  const f=fixture();await f.owner.open();const confirm=f.confirm(),old=f.view,q=old.quote;if(!q.ok)throw Error('Declared successful quote required');
  if(change==='identity')f.view={...old,identity:'new-session'};
  else if(change==='request')f.view={...old,quote:{...q,requestId:2}};
  else if(change==='group')f.view={...old,quote:{...q,groupId:10}};
  else if(change==='quote')f.view={...old,quote:{...q,quote:'changed-exact-quote'}};
  else if(change==='refusal')f.view={...old,quote:{ok:false,reason:'La caravane ne transporte plus les objets.'}};
  else old.request.quantity=8;
  await attempt(()=>confirm.onActivate());expect(f.send).not.toHaveBeenCalled();
  // Restoring the data cannot revive the callback's old consent.
  if(change==='subject')old.request.quantity=7;f.view=old;await attempt(()=>confirm.onActivate());expect(f.send).not.toHaveBeenCalled();
 });

 it('renders a new quote refusal with a way back and no active confirmation',async()=>{
  const f=fixture();await f.owner.open();const confirm=f.confirm();f.view={...f.view,quote:{ok:false,reason:'Quantité admissible insuffisante (0/7).'}};
  await confirm.onActivate();expect(text(f.page)).toContain('Quantité admissible insuffisante');
  expect(controls(f.page).some(c=>c.id==='delivery-confirm-confirm'&&!c.disabled)).toBe(false);
  await f.cancel().onActivate();expect(f.page).toBe(f.parent);expect(f.send).not.toHaveBeenCalled();
 });
 it('an accepted snapshot update revokes the visible consent even before another click',async()=>{
  const f=fixture();await f.owner.open();const old=f.confirm(),q=f.view.quote;if(!q.ok)throw Error('Declared successful quote required');
  f.view={...f.view,quote:{...q,quote:'changed-before-click'}};f.owner.refresh();expect(f.confirm().disabled).toBe(true);
  f.view={...f.view,quote:q};f.owner.refresh();await old.onActivate();expect(f.send).not.toHaveBeenCalled();expect(f.confirm().disabled).toBe(true);
 });
 it('a rejected or negatively acknowledged send is not silently retried and keeps an explicit reason',async()=>{
  const f=fixture(async()=>{},async()=>({ok:false,reason:'Refus de la simulation.'}));await f.owner.open();const old=f.confirm();await old.onActivate();
  expect(f.send).toHaveBeenCalledTimes(1);expect(f.confirm().disabled).toBe(true);expect(text(f.page)).toContain('Refus de la simulation.');
  await old.onActivate();expect(f.send).toHaveBeenCalledTimes(1);await f.cancel().onActivate();expect(f.page).toBe(f.parent);
 });

 it('disposing a review or navigating away makes retained confirm and close callbacks inert',async()=>{
  for(const change of ['dispose','navigation'] as const){
   const f=fixture();await f.owner.open();const page=f.page,confirm=f.confirm();if(change==='dispose')f.owner.dispose();else f.replace();
   await attempt(()=>confirm.onActivate());page.onClose?.();page.onCancel?.();expect(f.send).not.toHaveBeenCalled();expect(f.back).not.toHaveBeenCalled();
  }
 });

 it('a late send-port resolution cannot reclaim a foreign page',async()=>{
  const gate=deferred<unknown>(),f=fixture(async()=>{},()=>gate.promise);await f.owner.open();const confirm=f.confirm(),pending=confirm.onActivate();
  expect(f.send).toHaveBeenCalledTimes(1);f.replace();const foreign=f.page;gate.resolve(undefined);await pending;
  expect(f.page).toBe(foreign);expect(f.back).not.toHaveBeenCalled();await attempt(()=>confirm.onActivate());expect(f.send).toHaveBeenCalledTimes(1);
 });
});

/** Real transaction proof, explicitly opt-in because admission of the acquired
 * campaign is expensive. Preparation is declared: an offer is supplied at the
 * acquired nonhostile settlement; acceptance and delivery use applyCommand.
 * No natural incident, production or journey is claimed. */
describe('native delivery on acquired campaign owners',()=>{
 it.skipIf(process.env.NATIVE_TRADE_DELIVERY_PROOF!=='1'||!existsSync(TRADE_REQUEST_CAMP_SOURCE462))('keeps opening read-only, delivers original rewards once and returns to the real caravan',async()=>{
  const f=preparedTradeRequestCamp462(),{w}=f,record=w.worldGroups!.groups.find(r=>r.state.id===f.groupId);
  if(!record||!('members'in record.state))throw Error('Actual acquired caravan missing');const g=record.state;
  const target=w.worldFactions!.settlements.find(s=>s.id===f.settlementId)!,faction=w.worldFactions!.factions.find(s=>s.id===f.factionId)!;
  g.lastPersonalTick=w.tick;const core=w.tick*10,reward:MaterialPile={id:w.nextId++,item:'gold',kind:'gold',quantity:10,owner:{type:'trade-request284',requestId:1,optionId:1}};
  const request:TradeRequest284={id:1,homeMapId:record.originMapId,settlementId:target.id,factionId:faction.id,giverId:faction.leaderOwnerId!,tile:target.tile,settlementName:target.name,
   offeredAtCore:core,offerExpiresAtCore:core+300000,durationCore:720000,family:'cloth',quantity:7,baseMarketValue:tradeRequestContent284('cloth')!.baseMarketValue,
   wealth:{basis:'known-material-v1',value:50000,items:30000,structures:15000,floors:5000,unpricedPiles:0,unpricedPacked:0,unpricedStructures:0,unpricedPawns:g.members.length},rewardBudget:500,
   options:[{id:1,goodwill:0,original:[tradeRewardManifest284(reward)],items:[reward]}],dismissed:false,status:'offered',cleanup:[]};
  w.tradeRequests284={revision:1,adoptedAtCore:core,nextId:2,entries:[request]};applyCommand(w,{type:'trade-request-answer',requestId:1,optionId:1});expect(request.status).toBe('accepted');
  const ui=realNativeFixture(w);expect(nativeTradeRequestVisitors(ui.state.world!,request).map(entry=>entry.id)).toContain(g.id);
  const before=serializeWorld(w),rng=w.rng,next=w.nextId,view=groupWorld(ui.state.world!,g.id)!;
  const quote=quoteTradeRequestFulfill284(view,1,g.id);if(!quote.ok)throw Error(quote.reason);
  // Declared refusal projection only, with the same original owners. The
  // source campaign is never edited to fabricate a successful quote.
  ui.state.world={...ui.state.world!,tradeRequests284:{...ui.state.world!.tradeRequests284!,entries:[{...request,quantity:quote.available+1}]}};
  expect(focusNativeTradeRequestDestination(ui.state,ui.actions,1,g.id)).toBe(true);
  expect(control(ui.page,'group-deliver-1').disabled).toBe(true);expect(control(ui.page,'group-deliver-1').hint).toContain(`${quote.available}/${quote.available+1}`);
  await control(ui.page,'group-deliver-1').onActivate();expect(ui.command).not.toHaveBeenCalled();ui.sync();
  ui.showPanel('quests');await ui.click('quests-tab-active');await ui.click('quests-select-trade-request-1');
  await ui.click(`trade-request-1-group-${g.id}-open`);expect(ui.page.id).toBe(`group-${g.id}`);
  await ui.click('group-deliver-1');expect(ui.page).toMatchObject({id:'delivery-confirm',layout:'message',width:640,height:460});
  expect(serializeWorld(w)).toBe(before);expect(w.rng).toBe(rng);expect(w.nextId).toBe(next);expect(ui.command).not.toHaveBeenCalled();
  await ui.click('delivery-confirm-back');expect(ui.page.id).toBe(`group-${g.id}`);expect(serializeWorld(w)).toBe(before);
  // Main can adopt a Full publication into a retained projection at the same
  // tick. Its observer revision must revoke the displayed consent even before
  // another click, without altering the acquired campaign itself.
  const retained={...ui.state.world!};ui.state.world=retained;syncNativeWorldState(ui.state,ui.actions);
  await ui.click('group-deliver-1');const stale=control(ui.page,'delivery-confirm-confirm'),registry=retained.tradeRequests284!;
  retained.tradeRequests284={...registry,entries:[{...request,quantity:quote.available+1}]};ui.state.publicationRevision=(ui.state.publicationRevision??0)+1;syncNativeWorldState(ui.state,ui.actions);
  expect(control(ui.page,'delivery-confirm-confirm').disabled).toBe(true);expect(text(ui.page)).toContain(`${quote.available}/${quote.available+1}`);
  retained.tradeRequests284=registry;ui.sync();await stale.onActivate();expect(ui.command).not.toHaveBeenCalled();expect(serializeWorld(w)).toBe(before);
  await ui.click('delivery-confirm-back');expect(ui.page.id).toBe(`group-${g.id}`);
  await ui.click('group-deliver-1');const confirm=control(ui.page,'delivery-confirm-confirm');await confirm.onActivate();
  expect(ui.command).toHaveBeenCalledExactlyOnceWith({type:'trade-request-fulfill',requestId:1,groupId:g.id,quote:quote.quote,confirm:true});
  expect(request.status).toBe('succeeded');expect(request.options[0]!.items).toEqual([]);expect(g.items.find(p=>p.id===reward.id)).toBe(reward);expect(reward.owner.type).toBe('inventory');
  expect(request.fulfillment?.groupId).toBe(g.id);expect(request.fulfillment?.consumed.reduce((sum,p)=>sum+p.quantity,0)).toBe(7);expect(request.fulfillment?.delivered).toEqual(quote.rewards);
  expect(ui.page.id).toBe(`group-${g.id}`);expect(controls(ui.page).some(c=>c.id==='group-deliver-1')).toBe(false);
  const after=serializeWorld(w);await attempt(()=>confirm.onActivate());expect(ui.command).toHaveBeenCalledTimes(1);expect(serializeWorld(w)).toBe(after);
  ui.showPanel('quests');await ui.click('quests-history-toggle');await ui.click('quests-select-trade-request-1');expect(ui.page.rows.find(row=>row.id==='trade-request-1-receipt-group')?.value).toBe('7 unités remises');
  expect(ui.page.rows.find(row=>row.id===`trade-request-1-received-${reward.id}`)?.detail).toContain(`porteur n° ${quote.rewards[0]!.pawnId}`);expect(ui.command).toHaveBeenCalledTimes(1);
 },180000);
});

function realNativeFixture(w:World){
 let page:NativePage={id:'initial',title:'Initial',rows:[]};
 const state:NativeUiState={world:campaignPresentation(w),epoch:916,publicationRevision:0,panel:'world',category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};const sync=()=>{state.world=campaignPresentation(w);state.publicationRevision=(state.publicationRevision??0)+1;syncNativeWorldState(state,actions);};
 const command=vi.fn(async(command:Command)=>{const result=applyCommand(w,command);sync();return result;});
 const showPanel=(panel:NativeUiState['panel'])=>{state.panel=panel;const next=buildNativePanel(state,actions);if(next)page=next;};
 const actions:NativeUiActions={command,readState:()=>state,isCurrentPage:next=>page===next,showPage:next=>{page=next;},refresh:sync,panel:showPanel,category:noop,tool:noop,selectPawn:noop,speed:vi.fn(async()=>{}),rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 setNativeWorldTab('groups');page=buildNativeWorld(state,actions);
 return {state,actions,command,sync,showPanel,get page(){return page;},async click(id:string){const c=control(page,id);expect(c.disabled,id).not.toBe(true);await c.onActivate();}};
}
