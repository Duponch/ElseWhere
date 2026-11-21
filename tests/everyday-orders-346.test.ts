import {expect,test,vi} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {queryOrderOptions} from '../src/sim/player-orders';
import {equippedWeapon} from '../src/sim/equipment-rules';
import {addMaterial} from '../src/sim/materials';
import {breakThresholds} from '../src/sim/traits';
import {startSadWander} from '../src/sim/mental-break';
import {idleWanderTask300} from '../src/sim/idle-wander-300';
import {SCHEMA_VERSION,TICKS_PER_DAY,type Command,type Pawn,type Structure,type World} from '../src/sim/types';
import {selectionDraftCommand,selectionFireAtWillCommand,selectionStopCommand,toggleDraft} from '../src/ui/drafting-controls';
import {colonistBarState346,colonistMoodThreshold346} from '../src/ui/colonist-bar-state-346';
import {colonistBarStateLabel346} from '../src/ui3d/native-colonist-bar-346';
import {buildCopy346} from '../src/ui3d/native-build-copy-346';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import {nativeOrderPage,type NativeOrderClient} from '../src/ui3d/native-orders';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {medicalCamp} from './scenarios/health';
import {equipmentCamp} from './scenarios/equipment';
import {encounterCamp} from './scenarios/encounter';
import {prisonerUiFixture} from './scenarios/prison-camp';
import {fixtureBuilding} from './scenarios/deconstruction';
import {asOldSchema} from './scenarios/old-schema';
import {SnapshotDecoder,SnapshotEncoder} from '../src/bridge/snapshots';
import {asNumberOnly} from './scenarios/old-schema.ts';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const valid=(w:World)=>expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
function until(w:World,done:()=>boolean,limit=900):void {for(let i=0;i<limit&&!done();i++){stepWorld(w);valid(w);}expect(done()).toBe(true);}
/** Save and reload in the middle of the job; both copies continue identically. */
function replay(w:World,n=3):void {const copy=deserializeWorld(serializeWorld(w));stepWorld(w,n);stepWorld(copy,n);expect(serializeWorld(copy)).toBe(serializeWorld(w));valid(w);}
/** The worker's snapshot of the job in progress is adopted by the main thread with the same pawns and piles. */
function bridge(w:World):void {const adopted=new SnapshotDecoder().adopt(structuredClone(new SnapshotEncoder().encode(w,0,6)));expect(adopted.status).toBe('applied');if(adopted.status==='applied'){expect(adopted.world.pawns).toEqual(w.pawns);expect(adopted.world.piles).toEqual(w.piles);}}
const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toEqual({ok:true});

// ---- Inspector harness -----------------------------------------------------
interface Calls {commands:Command[];tools:string[];materials:string[]}
function inspector(world:World,part:Partial<NativeUiState>,calls:Calls):NativePage {
 const state:NativeUiState={world,epoch:346,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],...part};
 const noop=()=>{};
 const actions:NativeUiActions={command:async command=>{calls.commands.push(command);return applyCommand(world,command);},panel:noop,category:noop,tool:tool=>{calls.tools.push(tool);},selectPawn:noop,speed:noop,rotate:noop,material:material=>{calls.materials.push(material);},creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state};
 return buildNativeInspector(state,actions)!;
}
const calls=():Calls=>({commands:[],tools:[],materials:[]});
const action=(page:NativePage,id:string)=>page.actions?.find(control=>control.id===id);

// ---- Right-click harness ---------------------------------------------------
interface Menu {pages:NativePage[];sent:Command[];closed:number}
function orderClient(w:World,menu:Menu):NativeOrderClient {
 return {orderOptions:async(pawnId,x,z,queue)=>queryOrderOptions(w,pawnId,{x,z},queue),
  command:async command=>{menu.sent.push(command);const result=applyCommand(w,command);if(!result.ok)throw Error(result.reason);return undefined;},
  currentWorld:()=>w,close:()=>{menu.closed++;}};
}
async function rightClick(w:World,pawnIds:number[],cell:{x:number;z:number},targetId?:number):Promise<Menu> {
 const menu:Menu={pages:[],sent:[],closed:0};
 await nativeOrderPage(w,pawnIds,cell,0,0,false,targetId,orderClient(w,menu),page=>menu.pages.push(page));
 return menu;
}
const lastRows=(menu:Menu)=>menu.pages.at(-1)?.rows??[];
const rowLabelled=(menu:Menu,text:RegExp)=>lastRows(menu).find(row=>text.test(row.label));

// ---- 1. Draft, Stop, Fire at will on the whole selection -------------------

test('Draft, Stop and Fire at will act on the whole selection as merged Core gizmos',async()=>{
 const w=medicalCamp(3),[a,b,c]=w.pawns as [Pawn,Pawn,Pawn];
 // Nobody drafted: the merged Draft gizmo drafts everyone.
 expect(selectionDraftCommand([b,a,c])).toEqual({type:'draft',pawnIds:[b.id,a.id,c.id],enabled:true});
 // Mixed: activateIfAmbiguous shows an inactive gizmo, so the click drafts the rest.
 ok(w,{type:'draft',pawnIds:[a.id],enabled:true});
 expect(selectionDraftCommand([a,b,c])).toEqual({type:'draft',pawnIds:[a.id,b.id,c.id],enabled:true});
 // R uses the same merge.
 const sent:Command[]=[];toggleDraft([a,b,c],command=>sent.push(command));expect(sent).toEqual([selectionDraftCommand([a,b,c])]);
 // A downed pawn keeps a disabled gizmo and is not toggled; nothing to toggle, no command.
 c.state='downed';expect(selectionDraftCommand([c,b])).toEqual({type:'draft',pawnIds:[b.id],enabled:true});expect(selectionDraftCommand([c])).toBeUndefined();c.state='idle';
 ok(w,{type:'draft',pawnIds:[a.id],enabled:false});

 // The inspector's buttons send the merged command for the whole selection.
 const log=calls();let page=inspector(w,{selectedPawnIds:[b.id,a.id,c.id]},log);
 expect(action(page,'draft-pawn')).toMatchObject({label:'Mobiliser',disabled:false});
 expect(action(page,'draft-stop')).toBeUndefined();
 ok(w,{type:'draft',pawnIds:[c.id],enabled:true});
 page=inspector(w,{selectedPawnIds:[b.id,a.id,c.id]},log);
 // The dossier shows b, but c's drafted state already offers Stop and Fire at will.
 expect(page.title).toBe(b.name);expect(action(page,'draft-pawn')!.label).toBe('Mobiliser');expect(action(page,'draft-stop')).toBeDefined();
 await action(page,'draft-pawn')!.onActivate();
 expect(log.commands).toEqual([{type:'draft',pawnIds:[b.id,a.id,c.id],enabled:true}]);
 expect(w.pawns.every(p=>!!p.draft)).toBe(true);valid(w);

 page=inspector(w,{selectedPawnIds:[b.id,a.id,c.id]},log);
 expect(action(page,'draft-pawn')!.label).toBe('Démobiliser');
 expect(action(page,'fire-at-will')!.label).toBe('Cesser le feu');
 await action(page,'fire-at-will')!.onActivate();
 expect(log.commands.at(-1)).toEqual({type:'fire-at-will',pawnIds:[b.id,a.id,c.id],enabled:false});
 expect(w.pawns.every(p=>p.draft!.holdFire)).toBe(true);
 // Fire at will merges like Draft: one pawn holding fire makes the click turn it on for all.
 ok(w,{type:'fire-at-will',pawnIds:[c.id],enabled:true});
 page=inspector(w,{selectedPawnIds:[c.id,a.id,b.id]},log);
 expect(action(page,'fire-at-will')!.label).toBe('Feu à volonté');
 const merged=selectionFireAtWillCommand([c,a,b]);
 await action(page,'fire-at-will')!.onActivate();
 expect(log.commands.at(-1)).toEqual(merged);
 expect(log.commands.at(-1)).toEqual({type:'fire-at-will',pawnIds:[c.id,a.id,b.id],enabled:true});
 expect(w.pawns.every(p=>!p.draft!.holdFire)).toBe(true);

 // Stop: every drafted pawn of the selection stops its move and stays drafted.
 ok(w,{type:'draft-move',pawnIds:[a.id,b.id],target:{x:20,z:20},queue:false});
 expect(a.draft!.target).not.toBeNull();
 page=inspector(w,{selectedPawnIds:[b.id,a.id,c.id]},log);
 const stop=selectionStopCommand([b,a,c]);
 await action(page,'draft-stop')!.onActivate();
 expect(log.commands.at(-1)).toEqual(stop);
 expect(log.commands.at(-1)).toEqual({type:'draft-stop',pawnIds:[b.id,a.id,c.id]});
 expect(w.pawns.every(p=>!!p.draft&&p.draft.target===null)).toBe(true);valid(w);

 // A fully drafted selection is undrafted entirely; a single pawn as before.
 page=inspector(w,{selectedPawnIds:[a.id]},log);
 await action(page,'draft-pawn')!.onActivate();
 expect(log.commands.at(-1)).toEqual({type:'draft',pawnIds:[a.id],enabled:false});
 expect(a.draft).toBeUndefined();expect(b.draft).toBeDefined();
 page=inspector(w,{selectedPawnIds:[b.id,c.id]},log);
 await action(page,'draft-pawn')!.onActivate();
 expect(log.commands.at(-1)).toEqual({type:'draft',pawnIds:[b.id,c.id],enabled:false});
 expect(w.pawns.some(p=>p.draft)).toBe(false);valid(w);
});

// ---- 2. Copy (build the same) ---------------------------------------------

test('Copier on a building picks the same Architect construction and material, only when the designator is available',async()=>{
 const w=medicalCamp(1),wall:Structure=fixtureBuilding(w,'wall',10,10);wall.material='steel';
 expect(buildCopy346(w,wall)).toEqual({tool:'wall',material:'steel'});
 const log=calls(),page=inspector(w,{selectedObjects:[{kind:'structure',id:wall.id}]},log);
 const copy=action(page,'object-action-copy')!;expect(copy.label).toBe('Copier');
 const before=serializeWorld(w);await copy.onActivate();
 expect(log.tools).toEqual(['wall']);expect(log.materials).toEqual(['steel']);
 expect(log.commands).toEqual([]);expect(serializeWorld(w)).toBe(before);
 // A building with a fixed material picks the tool alone.
 const heater=fixtureBuilding(w,'heater',14,10);
 expect(buildCopy346(w,heater)).toEqual({tool:'heater'});
 // Core FindAllowedDesignator(mustBeVisible): no button before the research.
 const autodoor:Structure=fixtureBuilding(w,'autodoor',16,10);autodoor.material='steel';
 expect(buildCopy346(w,autodoor)).toBeUndefined();
 expect(action(inspector(w,{selectedObjects:[{kind:'structure',id:autodoor.id}]},calls()),'object-action-copy')).toBeUndefined();
});

// ---- 3. Drafted right-click options ----------------------------------------

test('drafted Equip: the right-click menu offers it beside Go here, the real job runs through stepWorld and the pawn stays drafted',async()=>{
 const w=equipmentCamp(),p=w.pawns[0]!,gun=w.piles[0]!;
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});
 const menu=await rightClick(w,[p.id],{x:12,z:5});
 expect(lastRows(menu).map(row=>row.label)).toEqual(['Prioriser : Équiper Revolver (normal)','Aller ici','Un colon mobilisé exécute cet ordre puis reste mobilisé et attend sur place.']);
 expect(menu.sent).toEqual([]);
 await rowLabelled(menu,/Équiper/)!.controls![0]!.onActivate();
 expect(menu.sent).toEqual([{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false}]);
 expect(p.draft).toMatchObject({target:null,queue:[]});expect(p.equipmentTask).toMatchObject({itemId:gun.id,action:'equip'});valid(w);
 replay(w);bridge(w);
 // Walked like an undrafted equip: the drafted goto pass must not wipe the job's path.
 until(w,()=>!!equippedWeapon(w,p),60);
 expect(equippedWeapon(w,p)!.id).toBe(gun.id);expect(p.draft).toBeDefined();expect(p.orders.active).toBeNull();
 stepWorld(w,5);valid(w);expect(p.draft).toBeDefined();expect(p.state).toBe('idle');
 // Go here still moves the drafted pawn from the same menu.
 addMaterial(w,'weapon',1,{type:'ground',x:20,z:5},'revolver');
 const second=await rightClick(w,[p.id],{x:20,z:5});
 await rowLabelled(second,/^Aller ici$/)!.controls![0]!.onActivate();
 expect(second.sent).toEqual([{type:'draft-move',pawnIds:[p.id],target:{x:20,z:5},queue:false}]);
 // A plain cell keeps the immediate drafted move, without a menu.
 const plain=await rightClick(w,[p.id],{x:25,z:12});
 expect(plain.pages.some(page=>page.id==='native-orders'&&page.rows.length>1)).toBe(false);
 expect(plain.sent).toEqual([{type:'draft-move',pawnIds:[p.id],target:{x:25,z:12},queue:false}]);
});

test('drafted Wear and Drop: same garment and same weapon, the pawn stays drafted',async()=>{
 const w=equipmentCamp(),p=w.pawns[0]!,gun=w.piles[0]!;
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false});until(w,()=>!!equippedWeapon(w,p));
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});
 addMaterial(w,'apparel',1,{type:'ground',x:9,z:5},'cloth-tuque');const tuque=w.piles.at(-1)!;
 const menu=await rightClick(w,[p.id],{x:9,z:5});
 const wear=rowLabelled(menu,/^Prioriser : Porter/)!;expect(wear).toBeDefined();
 await wear.controls![0]!.onActivate();
 expect(menu.sent).toEqual([{type:'order-equipment',pawnId:p.id,itemId:tuque.id,action:'wear',queue:false}]);
 replay(w,2);bridge(w);until(w,()=>tuque.owner.type==='apparel');
 expect(tuque.owner).toEqual({type:'apparel',pawnId:p.id});expect(p.draft).toBeDefined();
 // Drop: the drafted pawn's own cell (or itself) offers Déposer.
 const own=await rightClick(w,[p.id],{x:p.x,z:p.z},p.id);
 const drop=rowLabelled(own,/^Prioriser : Déposer Revolver/)!;expect(drop).toBeDefined();
 await drop.controls![0]!.onActivate();
 expect(own.sent).toEqual([{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'drop',queue:false}]);
 until(w,()=>gun.owner.type==='ground',60);
 expect(gun.id).toBe(w.piles.find(q=>q.item==='revolver'&&q.owner.type==='ground')!.id);expect(p.draft).toBeDefined();
});

test('drafted Capture: the downed outlaw is carried to the prison bed by the drafted warden, who stays drafted',async()=>{
 const {world:w,actorId,patientId,bedId}=prisonerUiFixture(),a=w.pawns.find(p=>p.id===actorId)!,patient=w.pawns.find(p=>p.id===patientId)!;
 ok(w,{type:'prison-bed',bedId,enabled:true});ok(w,{type:'draft',pawnIds:[actorId],enabled:true});
 const menu=await rightClick(w,[actorId],{x:patient.x,z:patient.z},patientId);
 const capture=rowLabelled(menu,/^Prioriser : Capturer/)!;expect(capture).toBeDefined();
 expect(lastRows(menu)[0]).toBe(capture);
 await capture.controls![0]!.onActivate();
 expect(menu.sent).toEqual([{type:'order-capture',pawnId:actorId,patientId,queue:false}]);
 expect(a.rescue).toMatchObject({patientId,bedId,capture:true});expect(a.draft).toMatchObject({target:null,queue:[]});
 until(w,()=>a.rescue?.phase==='carry');replay(w,2);bridge(w);
 until(w,()=>!!patient.prisoner);
 expect(patient.need).toMatchObject({kind:'sleep',bedId});
 expect(a.draft).toBeDefined();expect(a.rescue).toBeUndefined();expect(a.orders.active).toBeNull();
 stepWorld(w,5);valid(w);
});

test('drafted Eat and Rescue (older admissions) keep their options in the 346 drafted menu',async()=>{
 const w=equipmentCamp(),p=w.pawns[0]!;w.piles=[];
 addMaterial(w,'food',3,{type:'ground',x:9,z:5},'survival-meal');const meal=w.piles.at(-1)!;
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});p.hunger=40;
 const menu=await rightClick(w,[p.id],{x:9,z:5});
 expect(lastRows(menu).map(row=>row.label).slice(0,2)).toEqual(['Consommer Repas de survie','Aller ici']);
 await rowLabelled(menu,/^Consommer/)!.controls![0]!.onActivate();
 expect(menu.sent).toEqual([{type:'order-consume',pawnId:p.id,pileId:meal.id,queue:false}]);
 until(w,()=>meal.quantity<3||!w.piles.includes(meal),600);expect(p.draft).toBeDefined();
});

test('below 346 the drafted ordinary orders stay refused and the cell keeps its immediate drafted move',async()=>{
 const w=equipmentCamp(),p=w.pawns[0]!,gun=w.piles[0]!;
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});
 (w as {schemaVersion:number}).schemaVersion=345;
 expect(applyCommand(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false})).toMatchObject({ok:false,reason:'Démobilisez ce colon avant un ordre civil.'});
 addMaterial(w,'apparel',1,{type:'ground',x:9,z:5},'cloth-tuque');
 expect(applyCommand(w,{type:'order-equipment',pawnId:p.id,itemId:w.piles.at(-1)!.id,action:'wear',queue:false}).ok).toBe(false);
 const menu=await rightClick(w,[p.id],{x:12,z:5});
 expect(menu.sent).toEqual([{type:'draft-move',pawnIds:[p.id],target:{x:12,z:5},queue:false}]);
 expect(p.equipmentTask).toBeUndefined();
 const f=prisonerUiFixture(),capturer=f.world.pawns.find(q=>q.id===f.actorId)!;
 ok(f.world,{type:'prison-bed',bedId:f.bedId,enabled:true});ok(f.world,{type:'draft',pawnIds:[f.actorId],enabled:true});
 (f.world as {schemaVersion:number}).schemaVersion=345;
 expect(applyCommand(f.world,{type:'order-capture',pawnId:f.actorId,patientId:f.patientId,queue:false}).ok).toBe(false);
 expect(capturer.rescue).toBeUndefined();
 // Two drafted colonists: Core's ordinary providers are single-pawn only.
 (w as {schemaVersion:number}).schemaVersion=SCHEMA_VERSION;
 ok(w,{type:'draft',pawnIds:[w.pawns[1]!.id],enabled:true});
 const both=await rightClick(w,[p.id,w.pawns[1]!.id],{x:9,z:5});
 expect(both.sent[0]).toMatchObject({type:'draft-move'});
});

// ---- 4. Colonist bar --------------------------------------------------------

test('colonist bar: Core mood-risk thresholds and tint on real pawn states',()=>{
 const w=medicalCamp(2),p=w.pawns[0]!,[minor,major,extreme]=breakThresholds(p);
 p.mood=minor+1;expect(colonistMoodThreshold346(p)).toBe('none');expect(colonistBarState346(w,p)).toEqual({threshold:'none',tint:false,icons:[]});
 p.mood=minor-.5;expect(colonistBarState346(w,p)).toMatchObject({threshold:'minor',tint:true});
 p.mood=major-.5;expect(colonistMoodThreshold346(p)).toBe('major');
 p.mood=extreme-.5;expect(colonistBarState346(w,p)).toMatchObject({threshold:'extreme',tint:true});
 expect(colonistBarStateLabel346(colonistBarState346(w,p))).toBe(' · Risque de crise extrême');
 // Downed: the threshold stays but Core draws no tint.
 p.state='downed';expect(colonistBarState346(w,p)).toMatchObject({threshold:'extreme',tint:false});p.state='idle';
 // A real mental break: the threshold is None and the mental state icon shows.
 p.mood=minor-1;expect(startSadWander(w,p)).toBe(true);
 expect(colonistBarState346(w,p)).toMatchObject({threshold:'none',tint:false,icons:[{kind:'mental',label:'Errance triste'}]});
});

test('colonist bar icons: attacking, medical rest, idle from the first day, fleeing, and none for an ordinary worker',()=>{
 // Attacking: a drafted guard ordered to shoot the outlaw.
 const e=encounterCamp(),guard=e.pawns[0]!,enemy=e.pawns[3]!;
 expect(colonistBarState346(e,guard).icons).toEqual([]);
 ok(e,{type:'shoot',pawnIds:[guard.id],targetId:enemy.id});
 expect(colonistBarState346(e,guard).icons).toEqual([{kind:'attacking',label:'Attaque'}]);
 // Medical rest: the captive installed in its medical prison bed.
 const {world:w,actorId,patientId,bedId}=prisonerUiFixture(),patient=w.pawns.find(p=>p.id===patientId)!;
 ok(w,{type:'prison-bed',bedId,enabled:true});ok(w,{type:'medical-bed',bedId,enabled:true});ok(w,{type:'order-capture',pawnId:actorId,patientId,queue:false});
 until(w,()=>!!patient.prisoner);
 expect(colonistBarState346(w,patient).icons).toEqual([{kind:'medical-rest',label:'Repos médical'}]);
 expect(colonistBarState346(w,patient).tint).toBe(false);
 // Idle: the Core idle wander, only once a whole day has passed.
 const idle=medicalCamp(1),q=idle.pawns[0]!;
 until(idle,()=>!!idleWanderTask300(q),400);
 expect(Math.floor(idle.tick/TICKS_PER_DAY)).toBe(0);expect(colonistBarState346(idle,q).icons).toEqual([]);
 const later=medicalCamp(1),r=later.pawns[0]!;stepWorld(later,TICKS_PER_DAY-later.tick);
 until(later,()=>!!idleWanderTask300(r),400);
 expect(colonistBarState346(later,r).icons).toEqual([{kind:'idle',label:'Inoccupé'}]);
 // Fleeing: an unarmed civilian next to the hostile outlaw really flees.
 const f=encounterCamp(),civilian=f.pawns[1]!;Object.assign(civilian,{x:13,z:10});
 until(f,()=>!!civilian.flee,200);
 expect(colonistBarState346(f,civilian).icons).toEqual([{kind:'fleeing',label:'Fuit'}]);
});

// ---- 5. Migration ------------------------------------------------------------

test('migration 345 → 346 by number only; a 345 save holding a drafted ordered equip is refused',()=>{
 const w=equipmentCamp(),p=w.pawns[0]!,gun=w.piles[0]!;
 ok(w,{type:'draft',pawnIds:[p.id],enabled:true});valid(w);
 const raw=serializeWorld(w),old=asOldSchema(raw,345);
 const migrated=deserializeWorld(old);
 expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);
 expect(serializeWorld(migrated)).toBe(asNumberOnly(raw,345));
 // The drafted equip state does not exist at 345: strict validation refuses it.
 ok(w,{type:'order-equipment',pawnId:p.id,itemId:gun.id,action:'equip',queue:false});stepWorld(w);valid(w);
 expect(p.equipmentTask).toBeDefined();
 expect(()=>deserializeWorld(asOldSchema(serializeWorld(w),345))).toThrow();
 expect(deserializeWorld(serializeWorld(w))).toEqual(w);
});
