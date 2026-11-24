import {describe,expect,it,vi} from 'vitest';
import {existsSync} from 'node:fs';
import {buildNativeEncounter,buildNativeWorld,focusNativeCaravanTrade,setNativeWorldTab,syncNativeWorldState} from '../src/ui3d/native-world';
import {layoutNativePage} from '../src/ui3d/native-layout';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {applyCommand} from '../src/sim/engine';
import type {World,Command,MaterialPile} from '../src/sim/types';
import {groupPermission,groupTradeQuote} from '../src/sim/group-authority';
import {quoteGroupGift274} from '../src/sim/group-gift-274';
import {groupWorld} from '../src/sim/world-map-authority';
import {withWorldGroup,registeredMap,flushRegisteredMap} from '../src/sim/world-map-context';
import {campaignPresentation} from '../src/sim/secondary-site-presentation';
import {withGroupExchange} from '../src/sim/group-reorganization-balance';
import {ensureCommercialPost,quoteCommercial,quoteCommercialSell} from '../src/sim/commercial-post';
import {validCivilianPostShape} from '../src/sim/commercial-post-rules';
import {quoteMeetingTrade261} from '../src/sim/caravan-meeting-trade-261';
import {draftForeignRoster261} from '../src/sim/caravan-foreign-roster-261';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {reorganizationCamp256} from './helpers/group-reorganization-v256';
import {legacyPlanet} from './helpers/legacy-fixture-guards';
import {medicalCamp} from './scenarios/health';
import {preparedGiftCamp274,GIFT_CAMP_SOURCE274} from './helpers/diplomatic-gifts-v450';

// Declared boundary fixtures: the original simulation owns the inventories,
// quotes and commands. No natural travel/arrival history is claimed.
function groupCamp(){
 const f=reorganizationCamp256(),{w,g}=f,tile=legacyPlanet(w).civilianTile;if(tile===null)throw Error('Legacy civilian post missing');
 g.phase='at-site';g.tile=tile;g.destination=tile;g.route=[tile];g.segment=null;g.stop={kind:'at-site'};
 const money:MaterialPile={id:w.nextId++,item:'silver',kind:'silver',quantity:500,owner:{type:'inventory',pawnId:g.members[0]!.id}},cloth:MaterialPile={id:w.nextId++,item:'cloth',kind:'textile',quantity:40,owner:{type:'inventory',pawnId:g.members[0]!.id}};
 g.items.push(money,cloth);g.reorganization=withGroupExchange(g.reorganization!,'received',[money,cloth]);
 expect(withWorldGroup(w,g.id,view=>ensureCommercialPost(view))).toBe(true);return {...f,cloth};
}
function individualCamp(){
 const root=medicalCamp(3,16),w=root.worldMaps?registeredMap(root,root.worldMaps.selectedMapId!)!:root,pawn=w.pawns[0]!;pawn.hunger=pawn.rest=95;pawn.skills.social={level:0,xp:0,dailyXp:0,passion:0};
 const items=w.piles.filter(p=>'pawnId'in p.owner&&p.owner.pawnId===pawn.id);w.piles=w.piles.filter(p=>!items.includes(p));w.pawns=w.pawns.filter(p=>p!==pawn);
 const add=(kind:MaterialPile['kind'],item:MaterialPile['item'],quantity:number)=>{const pile:MaterialPile={id:w.nextId++,kind,item,quantity,owner:{type:'inventory',pawnId:pawn.id}};items.push(pile);return pile;};
 const food=add('food','survival-meal',3);add('silver','silver',500);const cloth=add('textile','cloth',40);
 w.commercialTrip={phase:'at-post',pawn,items,foodPileId:food.id,foodQuantity:3,silverQuantity:500,cargo:{cloth:40,'muffalo-wool':0},sold:{cloth:0,'muffalo-wool':0},silverEarned:0,startedAt:w.tick-750,departedAt:w.tick-750,entry:{x:0,z:0},consumed:0,silverPaid:0,bought:{medicine:0,component:0},arrivedAt:w.tick,decisionUntil:w.tick+250};
 expect(ensureCommercialPost(w)).toBe(true);expect(validCivilianPostShape(w.civilianPost,w.tick,w.nextId,w.schemaVersion)).toBe(true);expect(quoteCommercial(w,[])).toMatchObject({ok:true});if(root.worldMaps)flushRegisteredMap(w);return {w:root,cloth};
}
function meetingCamp(shortfall=false){
 const f=groupCamp(),{w,g,record}=f,tiles=Array.from({length:128},(_,i)=>({biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[(i+127)%128,(i+1)%128]}));
 const generated=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(821)});
 if(!generated.ok)throw Error(generated.reason);const completed=completeWorldFactionRegistry256({version:w.schemaVersion,draft:generated.draft,playerDef:'PlayerColony',name:'Camp UI',postWorldRandom:new WorldGenerationRandom(821)});
 if(!completed.ok)throw Error(completed.reason);w.worldFactions=completed.registry;w.nextId=generated.nextThingId;
 const faction=w.worldFactions.factions.find(faction=>faction.def==='OutlanderCivil')!,roster=draftForeignRoster261(w,'trader',faction.id,100,4242);
 if(!roster?.meeting)throw Error('Real merchant roster missing');w.nextId=roster.nextId;
 record.encounters261={revision:1};g.lastPersonalTick=w.tick;
 record.pending261={revision:1,kind:'meeting',decision:'open',atCore:w.tick*10,factionId:faction.id,people:roster.people,animals:[],items:shortfall?roster.items.filter(pile=>pile.item!=='silver'):roster.items,packed:[],...roster.meeting};
 const base=quoteMeetingTrade261(w,record,[]);if(!base.ok)throw Error(base.reason);
 // A finite original lot of a ware the real merchant already trades. The
 // declared preparation supplies that lot to the same original caravan owner.
 const buy=base.goods.find(good=>good.side==='buy'&&!good.refusal&&good.unitPrice!==null&&good.unitPrice>1&&good.unitPrice<100&&good.available>=2&&['wood','steel','cloth','muffalo-wool','medicine','component','gold','plasteel'].includes(good.item));
 if(!buy)throw Error('No simple negociable ware in the fixed merchant roster');const original=record.pending261.items.find(p=>p.id===buy.id)!;
 const sale:MaterialPile={...original,id:w.nextId++,quantity:6,owner:{type:'inventory',pawnId:g.members[0]!.id}};g.items.push(sale);g.reorganization=withGroupExchange(g.reorganization!,'received',[sale]);
 expect(quoteMeetingTrade261(w,record,[])).toMatchObject({ok:true});return {...f,record,buy,sale};
}
let epoch=400;
function fixture(w:World,tab:'groups'|'individual'='groups'){
 let page:NativePage;const projection=()=>w.worldMaps?campaignPresentation(w):w;
 const state:NativeUiState={world:projection(),epoch:++epoch,panel:'world',category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 const noop=()=>{};
 const command=vi.fn(async(command:Command)=>{const result=applyCommand(w,command);sync();return result;});
 const actions:NativeUiActions={readState:()=>state,isCurrentPage:next=>page===next,command,showPage:next=>{page=next;},refresh:()=>sync(),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:vi.fn(async()=>{}),rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
 const sync=()=>{state.world=projection();syncNativeWorldState(state,actions);};
 setNativeWorldTab(tab);page=buildNativeWorld(state,actions);
 const row=(id:string)=>{const found=page.rows.find(row=>row.id===id);expect(found,id).toBeDefined();return found!;};
 const control=(id:string):NativeControl=>{const found=[...page.rows.flatMap(row=>row.controls??[]),...page.actions??[]].find(control=>control.id===id);expect(found,id).toBeDefined();return found!;};
 const click=async(id:string)=>{const c=control(id);expect(c.disabled,id).not.toBe(true);await c.onActivate();};
 const commit=async(id:string,value:string)=>{const input=row(id).input;expect(input,id).toBeDefined();expect(await input!.onCommit(value)).not.toBe(false);};
 const group=async(id:number,action:string)=>{expect(focusNativeCaravanTrade(state,actions,id)).toBe(true);await click('group-'+action);};
 const meeting=async()=>{page=buildNativeEncounter(state,actions)!;await click('encounter-trade');};
 return{state,actions,command,sync,row,control,click,commit,group,meeting,get page(){return page;},replacePage(){page={id:'unrelated',title:'Autre fenêtre',rows:[]};}};
}
const measure=(text:string,size:number)=>text.length*size*.53;

describe('world trade uses the real owner quotes in the compact native sheet',()=>{
 it('buys from a finite registered post, preserving hidden lots and dispatching precisely the verified group quote',async()=>{
  const {w,g}=groupCamp(),f=fixture(w);await f.group(g.id,'buy');expect([f.page.id,f.page.layout,f.page.width]).toEqual([`group-buy-${g.id}`,'trade',1024]);
  const view=groupWorld(f.state.world!,g.id)!,stock=groupPermission(view).trade!.buys;expect(stock.length).toBeGreaterThan(0);
  for(const good of stock)expect(f.row(`trade-good-${good.pile.id}`).tradeEntry).toMatchObject({side:'buy',available:good.available,unitPrice:good.unitPrice});
  const good=stock.find(good=>good.pile.item==='medicine')!,lines=[{pileId:good.pile.id,quantity:1}],q=groupTradeQuote(view,'buy',lines);if(!q.ok)throw Error(q.reason);
  await f.click(`trade-good-${good.pile.id}-more`);expect(f.row('trade-draft-total').value).toBe(`${q.totalSilver} argent`);
  await f.commit('trade-search','aucun bien de ce nom');expect(f.page.rows.some(row=>row.tradeEntry)).toBe(false);expect(f.row('trade-basket-count').detail).toContain('1 lot(s)');
  await f.click('trade-quote');expect([f.page.layout,f.page.width,f.page.height]).toEqual(['message',640,460]);expect(f.row(`trade-confirmed-${good.pile.id}`).value).toBe('Acheter × 1');expect(f.command).not.toHaveBeenCalled();
  await f.click('trade-confirm-confirm');expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'group-buy',groupId:g.id,lines,quote:q.signature});expect(w.worldGroups!.groups[0]!.state).toHaveProperty('ledger');expect(w.worldGroups!.posts[0]!.state.stock.find(p=>p.id===good.pile.id)?.quantity).toBe(good.available-1);
 });
 it('returns to the same group sale basket and never applies an old confirmation to a new one',async()=>{
  const {w,g,cloth}=groupCamp(),f=fixture(w);await f.group(g.id,'sell');expect(f.row(`trade-good-${cloth.id}`).tradeEntry?.side).toBe('sell');
  await f.commit(`trade-good-${cloth.id}`,'1');await f.click('trade-quote');const oldPage=f.page,old=f.control('trade-confirm-confirm');await f.click('trade-confirm-back');expect(f.row(`trade-good-${cloth.id}`).input?.value).toBe('1');
  await f.commit(`trade-good-${cloth.id}`,'2');await f.click('trade-quote');await old.onActivate();oldPage.onClose?.();expect(f.command).not.toHaveBeenCalled();expect(f.row(`trade-confirmed-${cloth.id}`).value).toBe('Vendre × 2');
  const q=groupTradeQuote(groupWorld(f.state.world!,g.id)!,'sell',[{pileId:cloth.id,quantity:2}]);if(!q.ok)throw Error(q.reason);await f.click('trade-confirm-confirm');expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'group-sell',groupId:g.id,lines:[{pileId:cloth.id,quantity:2}],quote:q.signature});expect(w.worldGroups!.groups[0]!.state.phase).toBe('at-site');
 });
 it('rechecks the live busy guard, excludes double submission and does not reclaim a different page after an asynchronous command',async()=>{
  const {w,g,cloth}=groupCamp(),f=fixture(w);await f.group(g.id,'sell');await f.commit(`trade-good-${cloth.id}`,'1');await f.click('trade-quote');const apply=f.control('trade-confirm-confirm');
  f.state.busy=true;await expect(apply.onActivate()).rejects.toThrow('Attendez la fin');expect(f.command).not.toHaveBeenCalled();f.state.busy=false;
  let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});f.command.mockImplementationOnce(async(command:Command)=>{await gate;const result=applyCommand(w,command);f.sync();return result;});
  const pending=apply.onActivate();try{await apply.onActivate();expect(f.command).toHaveBeenCalledTimes(1);f.replacePage();}finally{release();await pending;}
  expect(f.command).toHaveBeenCalledTimes(1);expect(f.page.id).toBe('unrelated');expect(w.worldGroups!.groups[0]!.state.phase).toBe('at-site');
 });
 it('edits individual goods with real limits, revalidates live stock, and rejects a replacement session',async()=>{
  const {w,cloth}=individualCamp(),f=fixture(w,'individual');expect(quoteCommercial(f.state.world!,[])).toMatchObject({ok:true});await f.click('commercial-buy');expect(f.page.layout).toBe('trade');const base=quoteCommercial(f.state.world!,[]);if(!base.ok)throw Error(base.reason);const good=base.goods.find(g=>g.item==='medicine')!;
  expect(()=>f.row(`individual-good-${good.pileId}`).input!.onCommit('1.5')).toThrow('Entier');await f.commit(`individual-good-${good.pileId}`,'1');await f.click('individual-trade-check');const apply=f.control('individual-trade-confirm-confirm');
  f.state.world!.civilianPost!.stock.find(p=>p.id===good.pileId)!.quantity--;f.sync();await expect(apply.onActivate()).rejects.toThrow(/changé|stock/);expect(f.command).not.toHaveBeenCalled();await f.click('individual-trade-confirm-back');
  await f.click('individual-trade-check');f.state.epoch=(f.state.epoch??0)+1;await expect(f.control('individual-trade-confirm-confirm').onActivate()).rejects.toThrow(/changé|comptoir/);expect(f.command).not.toHaveBeenCalled();f.replacePage();await apply.onActivate();expect(f.command).not.toHaveBeenCalled();
  const fresh=fixture(w,'individual');await fresh.click('commercial-sell');await fresh.commit(`individual-good-${cloth.id}`,'2');const q=quoteCommercialSell(fresh.state.world!,[{pileId:cloth.id,quantity:2}]);if(!q.ok)throw Error(q.reason);await fresh.click('individual-trade-check');await fresh.click('individual-trade-confirm-confirm');expect(fresh.command).toHaveBeenCalledExactlyOnceWith({type:'commercial-sell',lines:[{pileId:cloth.id,quantity:2}],quote:q.signature});
 });
 it('preserves both signed directions and refused records in a real encounter',async()=>{
  const {w,g,record,buy,sale}=meetingCamp(),f=fixture(w);await f.meeting();expect(f.page.layout).toBe('trade');const base=quoteMeetingTrade261(w,record,[]);if(!base.ok)throw Error(base.reason);
  for(const good of base.goods){const row=f.row(`meeting-good-${good.id}`);expect(row.tradeEntry).toMatchObject({side:good.side,available:good.available,unitPrice:good.unitPrice,refused:!!good.refusal||good.unitPrice===null});if(good.refusal)expect(row.input).toBeUndefined();}
  await f.commit(`meeting-good-${buy.id}`,'1');await f.commit(`meeting-good-${sale.id}`,'1');await f.row('meeting-search').controls![0]!.select!.onChange('buy');expect(f.page.rows.filter(row=>row.tradeEntry).every(row=>row.tradeEntry!.side==='buy')).toBe(true);
  const lines=[{pileId:buy.id,quantity:1},{pileId:sale.id,quantity:-1}].sort((a,b)=>a.pileId-b.pileId),q=quoteMeetingTrade261(w,record,lines);if(!q.ok)throw Error(q.reason);expect(q.forgone).toBe(0);
  await f.click('meeting-quote');expect(f.row(`meeting-confirmed-${sale.id}`).value).toBe('Vendre × 1');await f.click('meeting-confirm-confirm');expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'caravan-meeting-trade',groupId:g.id,lines,quote:q.signature,acceptShortfall:false});expect(f.page.id).toBe(`encounter-${g.id}`);
 });
 it('binds a meeting shortfall approval to the actual quote and requires it again after an edit',async()=>{
  const {w,g,record,sale}=meetingCamp(true),f=fixture(w);await f.meeting();await f.commit(`meeting-good-${sale.id}`,'2');expect(f.control('meeting-quote').disabled).toBe(true);await f.click('meeting-shortfall-toggle');expect(f.control('meeting-quote').disabled).toBe(false);
  await f.click(`meeting-good-${sale.id}-less`);expect(f.control('meeting-quote').disabled).toBe(true);await f.click('meeting-shortfall-toggle');const lines=[{pileId:sale.id,quantity:-1}],q=quoteMeetingTrade261(w,record,lines);if(!q.ok)throw Error(q.reason);expect(q.forgone).toBeGreaterThan(0);
  // Another recorded owner changes while the accepted amount is on screen.
  const p=record.pending261!;if(p.kind!=='meeting')throw Error('Expected merchant');p.items.find(pile=>pile.owner.type==='inventory'&&pile.quantity>2)!.quantity--;f.sync();await expect(f.click('meeting-quote')).rejects.toThrow('acceptation explicite');expect(f.command).not.toHaveBeenCalled();expect(f.control('meeting-quote').disabled).toBe(true);
  await f.click('meeting-shortfall-toggle');const refreshed=quoteMeetingTrade261(w,record,lines);if(!refreshed.ok)throw Error(refreshed.reason);expect(refreshed.signature).not.toBe(q.signature);await f.click('meeting-quote');expect(f.row('meeting-payment').detail).toContain('abandonné explicitement');await f.click('meeting-confirm-confirm');expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'caravan-meeting-trade',groupId:g.id,lines,quote:refreshed.signature,acceptShortfall:true});
 });
 it.skipIf(!existsSync(GIFT_CAMP_SOURCE274)||process.env.NATIVE_WORLD_GIFT_PROOF!=='1')('uses the acquired geographic post for an actual diplomatic gift without a fictitious payment',async()=>{
  const {w,groupId,clothId,postId}=preparedGiftCamp274(),f=fixture(w);await f.group(groupId,'gift');expect(f.page.layout).toBe('trade');expect(f.page.rows.find(row=>row.tradeHeading)?.tradeHeading).toMatchObject({gift:true,source:'Caravane',partner:'Destinataire'});
  expect(f.row(`trade-good-${clothId}`).tradeEntry?.side).toBe('gift');await f.commit(`trade-good-${clothId}`,'1');const lines=[{pileId:clothId,quantity:1}],q=withWorldGroup(w,groupId,v=>quoteGroupGift274(v,lines));if(!q?.ok)throw Error(q?.reason??'Missing gift quote');expect(f.row('trade-draft-goodwill').value).toBe(`${q.goodwillBefore} → ${q.goodwillAfter}`);
  const box=layoutNativePage(f.page,{width:1440,height:900},false,measure);expect(box.rows.find(row=>row.row.id===`trade-good-${clothId}`)?.height).toBe(30);
  await f.click('trade-quote');expect(f.row(`trade-confirmed-${clothId}`).value).toBe('Donner × 1');await f.click('gift-confirm-confirm');expect(f.command).toHaveBeenCalledExactlyOnceWith({type:'group-gift274',groupId,lines,quote:q.signature});expect(w.worldGroups!.posts.find(post=>post.id===postId)!.state.gifts274?.count).toBe(1);
 },180000);
});
