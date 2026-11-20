import {expect,test,vi} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {queryOrderOptions} from '../src/sim/player-orders';
import {addMaterial} from '../src/sim/materials';
import {moodThoughts,personalMoodThoughts} from '../src/sim/mood';
import {commitStrip351,prisonerSecure351,stripGoodwillWarning351,stripRefusal351,stripTarget351} from '../src/sim/strip-351';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import type {SettlementTile} from '../src/sim/world-settlement-placement';
import {deadMansApparelThought351,STRIP_CORE_TICKS_351,validStripDesignations351,validStripTaskField351} from '../src/sim/strip-state-351';
import {SCHEMA_VERSION,type Command,type MaterialPile,type Pawn,type World} from '../src/sim/types';
import {newApparelState,type ApparelItem} from '../src/sim/apparel-rules';
import {apparelPolicyScore,chooseApparelReplacement,DEFAULT_APPAREL_POLICY} from '../src/sim/apparel-policy';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import {nativeOrderPage,type NativeOrderClient} from '../src/ui3d/native-orders';
import {mapObjectActions} from '../src/ui/map-object-actions';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {medicalCamp,controlledInjury} from './scenarios/health';
import {prisonerUiFixture} from './scenarios/prison-camp';
import {asMigratedFrom352,asOldSchema} from './scenarios/old-schema';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

/** Declared fixture: a small camp whose hauler (Transport only) works on a
 * person given real garments and cargo by the material producer. Deaths and
 * downs come from real injuries; the strip itself is played by stepWorld. */
const valid=(w:World)=>expect(validateWorld(w),`tick ${w.tick}`).toEqual([]);
function until(w:World,done:()=>boolean,limit=900):void {for(let i=0;i<limit&&!done();i++){stepWorld(w);valid(w);}expect(done()).toBe(true);}
const ok=(w:World,c:Command)=>expect(applyCommand(w,c),JSON.stringify(c)).toMatchObject({ok:true});
const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
function garment(w:World,p:Pawn,item:ApparelItem,owner:MaterialPile['owner']={type:'apparel',pawnId:p.id}):MaterialPile {
 const id=w.nextId;addMaterial(w,'apparel',1,owner,item);return w.piles.find(q=>q.id===id)!;
}
function camp(){
 const w=medicalCamp(3,32);w.piles=[];w.resources=[];w.events=[];delete w.raids;delete w.arrivals;delete w.heatwaves;delete w.wildlife;
 const [hauler,other,target]=w.pawns as [Pawn,Pawn,Pawn];
 Object.assign(hauler,{name:'Porteur',x:4,z:4});hauler.priorities.haul=1;
 Object.assign(other,{name:'Témoin',x:2,z:26});
 Object.assign(target,{name:'Pillard',x:14,z:12,faction:'outlaws'});delete target.hostilityResponse;
 for(const p of w.pawns){p.hunger=100;p.rest=100;p.mood=80;}
 const shirt=garment(w,target,'cloth-shirt'),pants=garment(w,target,'cloth-pants');
 const meals=w.nextId;addMaterial(w,'food',5,{type:'inventory',pawnId:target.id},'survival-meal');
 return {w,hauler,other,target,shirt,pants,meals:w.piles.find(p=>p.id===meals)!};
}
const owned=(w:World,id:number)=>w.piles.filter(p=>(p.owner.type==='apparel'||p.owner.type==='inventory'||p.owner.type==='equipment')&&p.owner.pawnId===id);
const census=(w:World)=>w.piles.map(p=>[p.id,p.item,p.quantity]).sort((a,b)=>Number(a[0])-Number(b[0]));
const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=12;

test('a hauler strips a corpse: real reservation, walk, contact, 60 Core ticks, items on the ground with the corpse flag, same ids and counts',()=>{
 const {w,hauler,target,shirt,pants,meals}=camp();
 controlledInjury(w,target,'heart',15000);expect(target.state).toBe('dead');
 expect(shirt.apparel!.corpseWear284).toBe(true);expect(pants.apparel!.corpseWear284).toBe(true);
 // The engine lays the body down as a ground corpse thing at the next tick.
 stepWorld(w);valid(w);const body=w.piles.find(p=>p.humanCorpse?.pawnId===target.id)!;expect(body.owner).toEqual({type:'ground',x:14,z:12});
 const before=census(w),next=w.nextId;
 // The Orders palette rectangle: one designation, the work giver then picks it up.
 expect(applyCommand(w,{type:'area',action:'strip',from:{x:10,z:10},to:{x:16,z:14}})).toEqual({ok:true,affected:1,skipped:34});
 expect(w.strip351).toEqual([{targetId:target.id,dead:true,colony:false}]);
 valid(w);
 until(w,()=>!!hauler.strip351,40);
 expect(hauler.strip351).toMatchObject({targetId:target.id,phase:'approach'});
 until(w,()=>hauler.strip351?.phase==='strip',200);
 // Real contact: on the corpse cell or next to it, settled.
 expect(Math.abs(hauler.x-target.x)+Math.abs(hauler.z-target.z)).toBeLessThanOrEqual(1);
 const contact=w.tick;
 until(w,()=>!hauler.strip351,20);
 expect(w.tick-contact).toBe(STRIP_CORE_TICKS_351/10);
 expect(owned(w,target.id)).toEqual([]);
 for(const p of [shirt,pants,meals]){expect(p.owner.type).toBe('ground');expect(near(p.owner as {x:number;z:number},target)).toBe(true);}
 // Apparel worn at death keeps WornByCorpse; the inventory meals are untouched.
 expect(shirt.apparel!.corpseWear284).toBe(true);expect(pants.apparel!.corpseWear284).toBe(true);expect(meals.quantity).toBe(5);
 // Conservation: nothing created or lost, no id spent.
 expect(census(w)).toEqual(before);expect(w.nextId).toBe(next);
 expect(w.strip351).toBeUndefined();
 expect(w.events.some(e=>/Porteur dépouille le corps de Pillard \(3 objets au sol\)/.test(e.message))).toBe(true);
 // Nothing left to strip: the corpse cannot be designated again.
 expect(applyCommand(w,{type:'strip-designate',targetId:target.id,enabled:true})).toMatchObject({ok:false});
});

test('a downed raider and a secure prisoner are stripped; living wear is not tainted; equipment drops first and unforbidden',()=>{
 const {w,hauler,target,shirt}=camp();
 controlledInjury(w,target,'left-leg',30000);controlledInjury(w,target,'right-leg',30000);expect(target.state).toBe('downed');
 // The inspector gizmo designates (reverse designator).
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});valid(w);
 until(w,()=>owned(w,target.id).length===0,400);
 expect(shirt.owner.type).toBe('ground');expect(shirt.apparel!.corpseWear284).toBe(false);
 expect(target.state).toBe('downed');expect(w.strip351).toBeUndefined();expect(hauler.strip351).toBeUndefined();

 // Pawn.Strip order on the rule level: equipment first, then apparel, then inventory; forbid and forced cleared.
 const gun=w.nextId;addMaterial(w,'weapon',1,{type:'equipment',pawnId:target.id},'revolver');
 const rifle=w.piles.find(p=>p.id===gun)!;rifle.weapon!.forbidden=true;
 const coat=garment(w,target,'cloth-parka');coat.apparel!.forced=true;coat.apparel!.forbidden=true;
 const t=stripTarget351(w,target.id)!;expect(stripRefusal351(w,t)).toBeUndefined();
 expect(commitStrip351(w,t)).toEqual({ok:true,dropped:2});
 expect(rifle.owner.type).toBe('ground');expect(rifle.weapon!.forbidden).toBeUndefined();
 expect(coat.owner.type).toBe('ground');expect(coat.apparel!.forced).toBeUndefined();expect(coat.apparel!.forbidden).toBeUndefined();

 // A captured prisoner in its prison bed.
 const f=prisonerUiFixture(),pw=f.world,actor=pw.pawns.find(p=>p.id===f.actorId)!,captive=pw.pawns.find(p=>p.id===f.patientId)!;
 ok(pw,{type:'prison-bed',bedId:f.bedId,enabled:true});ok(pw,{type:'order-capture',pawnId:f.actorId,patientId:f.patientId,queue:false});
 until(pw,()=>!!captive.prisoner&&!actor.rescue);
 const tunic=garment(pw,captive,'cloth-shirt');actor.priorities.haul=1;
 expect(prisonerSecure351(captive)).toBe(true);
 ok(pw,{type:'strip-designate',targetId:captive.id,enabled:true});
 until(pw,()=>tunic.owner.type==='ground',400);
 expect(tunic.apparel!.corpseWear284).toBe(false);expect(captive.prisoner).toBeDefined();
});

test('refusals follow StrippableUtility: standing people, empty bodies, released or escaping prisoners, carried and duplicate targets',()=>{
 const {w,hauler,other,target}=camp();
 // A standing outlaw and a healthy colonist are neither downed nor prisoners.
 expect(applyCommand(w,{type:'strip-designate',targetId:target.id,enabled:true})).toMatchObject({ok:false,reason:expect.stringMatching(/corps, une personne à terre ou un prisonnier/)});
 garment(w,other,'cloth-shirt');
 expect(applyCommand(w,{type:'strip-designate',targetId:other.id,enabled:true})).toMatchObject({ok:false});
 // A downed colonist is strippable (Core), but not one with nothing to remove.
 controlledInjury(w,other,'left-leg',30000);controlledInjury(w,other,'right-leg',30000);expect(other.state).toBe('downed');
 expect(stripRefusal351(w,stripTarget351(w,other.id))).toBeUndefined();
 const bare=medicalCamp(2,32);bare.piles=[];const naked=bare.pawns[1]!;controlledInjury(bare,naked,'left-leg',30000);controlledInjury(bare,naked,'right-leg',30000);
 expect(applyCommand(bare,{type:'strip-designate',targetId:naked.id,enabled:true})).toMatchObject({ok:false,reason:expect.stringMatching(/Rien à retirer/)});
 // Prisoners: secure only while held, not released, escaping, breaking out or berserk.
 const prisoner={...target,state:'idle',prisoner:{capturedAt:0,initialResistance:1,resistance:1,mode:'maintain',chatDay:0,chatCount:0,rng:1}} as Pawn;
 expect(prisonerSecure351(prisoner)).toBe(true);
 expect(prisonerSecure351({...prisoner,prisoner:{...prisoner.prisoner!,releasedAt:1}})).toBe(false);
 expect(prisonerSecure351({...prisoner,prisoner:{...prisoner.prisoner!,escape:{x:0,z:0}}})).toBe(false);
 expect(prisonerSecure351({...prisoner,prisoner:{...prisoner.prisoner!,breakout:{rng:1,active:{startedAt:0,initiatorId:1}}}})).toBe(false);
 // Already designated, then the order menu of a busy target refuses a second claimant.
 ok(w,{type:'strip-designate',targetId:other.id,enabled:true});
 expect(applyCommand(w,{type:'strip-designate',targetId:other.id,enabled:true})).toMatchObject({ok:false,reason:'Déjà désigné pour être dépouillé.'});
 // An unknown target and a malformed command.
 expect(applyCommand(w,{type:'strip-designate',targetId:999999,enabled:true})).toMatchObject({ok:false});
 expect(applyCommand(w,{type:'strip-designate',targetId:other.id,enabled:true,extra:1} as unknown as Command)).toMatchObject({ok:false});
 // A colonist does not strip itself, and the right-click option names the target.
 const options=queryOrderOptions(w,hauler.id,{x:other.x,z:other.z});
 expect(options.find(o=>o.stripTargetId===other.id)).toMatchObject({label:`Dépouiller ${other.name}`,enabled:true});
 expect(queryOrderOptions(w,other.id,{x:other.x,z:other.z}).some(o=>o.stripTargetId===other.id)).toBe(false);
 expect(queryOrderOptions(w,hauler.id,{x:other.x,z:other.z},true).find(o=>o.stripTargetId===other.id)).toMatchObject({enabled:false});
});

test('designations go when the target dies, is carried, leaves or changes faction, and with the Cancel tool; a merely unstrippable target keeps it',()=>{
 const {w,target,other}=camp();
 controlledInjury(w,target,'left-leg',30000);controlledInjury(w,target,'right-leg',30000);
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 // The downed raider dies: its corpse is a new thing without the designation.
 controlledInjury(w,target,'heart',15000);expect(target.state).toBe('dead');
 stepWorld(w);valid(w);expect(w.strip351).toBeUndefined();
 // The corpse designated, then carried for burial (despawned).
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});expect(w.strip351).toHaveLength(1);
 const body=w.nextId;target.body={observedAt:w.tick,pileId:body};
 w.piles.push({id:w.nextId++,kind:'corpse',item:'human-corpse',quantity:1,owner:{type:'pawn',pawnId:other.id},humanCorpse:{pawnId:target.id}});
 expect(stripTarget351(w,target.id)).toBeUndefined();
 stepWorld(w);expect(w.strip351).toBeUndefined();
 // Back on the ground: the Cancel tool clears a new designation; an empty cancel stays refused.
 w.piles.find(p=>p.id===body)!.owner={type:'ground',x:20,z:20};
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 expect(applyCommand(w,{type:'cancel',x:20,z:20})).toMatchObject({ok:true,affected:1});
 expect(w.strip351).toBeUndefined();
 expect(applyCommand(w,{type:'cancel',x:20,z:20})).toMatchObject({ok:false});
 // A record leaving the map (map exit removes it) drops its designation.
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 w.pawns=w.pawns.filter(p=>p!==target);stepWorld(w);expect(w.strip351).toBeUndefined();

 const f=camp(),downed=f.target;
 controlledInjury(f.w,downed,'left-leg',30000);controlledInjury(f.w,downed,'right-leg',30000);
 ok(f.w,{type:'strip-designate',targetId:downed.id,enabled:true});
 // Joining the colony (SetFaction to the player) removes it.
 delete downed.faction;stepWorld(f.w);expect(f.w.strip351).toBeUndefined();
 // Merely unstrippable (everything gone): Core keeps the designation, the giver skips it.
 downed.faction='outlaws';ok(f.w,{type:'strip-designate',targetId:downed.id,enabled:true});
 for(const p of owned(f.w,downed.id))p.owner={type:'ground',x:0,z:0};
 f.hauler.priorities.haul=0;stepWorld(f.w,5);expect(f.w.strip351).toHaveLength(1);
 expect(applyCommand(f.w,{type:'strip-designate',targetId:downed.id,enabled:false})).toEqual({ok:true});expect(f.w.strip351).toBeUndefined();
});

test('dead man’s apparel: Core stages by tainted count, Bloodlust nullifies, valid while despawned, and a stripped garment worn for real',()=>{
 const w=medicalCamp(1,32);w.piles=[];const p=w.pawns[0]!;
 const items:ApparelItem[]=['cloth-shirt','cloth-pants','cloth-parka','steel-simple-helmet','flak-vest'];
 const thought=()=>moodThoughts(w,p).find(t=>t.id==='dead-mans-apparel');
 expect(thought()).toBeUndefined();
 const offsets:number[]=[];
 for(const item of items){const piece=garment(w,p,item);piece.apparel!.corpseWear284=true;offsets.push(thought()?.offset??0);}
 expect(offsets).toEqual([-5,-8,-11,-14,-14]);
 expect(thought()!.label).toBe('Vêtement de mort : '+deadMansApparelThought351(1,'cloth-shirt')!.label.split(' : ')[1]+' etc.');
 // A clean garment does not count.
 for(const piece of w.piles.slice(1))piece.apparel!.corpseWear284=false;expect(thought()?.offset).toBe(-5);
 p.traits=['bloodlust'];expect(thought()).toBeUndefined();p.traits=[];
 // Away (despawned) owners read the same thought from their own items.
 const away=personalMoodThoughts(p,{tick:w.tick,people:{get:()=>undefined},items:w.piles,difficultyMood:0,schemaVersion:SCHEMA_VERSION,despawned313:true});
 expect(away.find(t=>t.id==='dead-mans-apparel')?.offset).toBe(-5);
 expect(personalMoodThoughts(p,{tick:w.tick,people:{get:()=>undefined},items:w.piles,difficultyMood:0,schemaVersion:350}).some(t=>t.id==='dead-mans-apparel')).toBe(false);

 // JobGiver_OptimizeApparel: a tainted garment scores (score − 0.5) × 0.1 for whoever can get the thought.
 const clean={id:1,item:'cloth-shirt' as ApparelItem,apparel:newApparelState('cloth-shirt'),stored:true,reachable:true,reserved:false};
 const dirty={...clean,id:2,apparel:{...clean.apparel,corpseWear284:true}};
 expect(apparelPolicyScore(dirty,'neutral',true)).toBeCloseTo((apparelPolicyScore(clean)-.5)*.1,12);
 expect(apparelPolicyScore(dirty,'neutral',false)).toBe(apparelPolicyScore(clean));
 expect(chooseApparelReplacement(DEFAULT_APPAREL_POLICY,[],[dirty,clean],'neutral',.05,true)).toMatchObject({candidateId:1});
 expect(chooseApparelReplacement(DEFAULT_APPAREL_POLICY,[],[dirty],'neutral',.05,true)).toMatchObject({candidateId:2});
 // Played: a colonist wears the shirt stripped from a corpse.
 const c=camp();controlledInjury(c.w,c.target,'heart',15000);
 ok(c.w,{type:'strip-designate',targetId:c.target.id,enabled:true});
 until(c.w,()=>c.shirt.owner.type==='ground',400);
 ok(c.w,{type:'order-equipment',pawnId:c.hauler.id,itemId:c.shirt.id,action:'wear',queue:false});
 until(c.w,()=>c.shirt.owner.type==='apparel',400);
 expect(moodThoughts(c.w,c.hauler).find(t=>t.id==='dead-mans-apparel')).toMatchObject({offset:-5});
});

test('save and reload with a pending designation and a job in progress continue identically',()=>{
 const {w,hauler,target}=camp();controlledInjury(w,target,'heart',15000);
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 const pending=deserializeWorld(serializeWorld(w));expect(pending.strip351).toEqual(w.strip351);
 until(w,()=>hauler.strip351?.phase==='strip',300);stepWorld(w,2);valid(w);
 expect(hauler.strip351?.progressCore).toBeGreaterThan(0);
 const copy=deserializeWorld(serializeWorld(w));
 expect(copy.pawns.find(p=>p.id===hauler.id)!.strip351).toEqual(hauler.strip351);
 stepWorld(w,10);stepWorld(copy,10);expect(serializeWorld(copy)).toBe(serializeWorld(w));
 expect(hauler.strip351).toBeUndefined();expect(owned(w,target.id)).toEqual([]);
 // Strict fields: unknown keys, bad phases and clocks are refused.
 expect(validStripDesignations351({strip351:[{targetId:target.id,dead:true,colony:false,x:1}]},SCHEMA_VERSION,w.nextId)).toBe(false);
 expect(validStripDesignations351({strip351:[]},SCHEMA_VERSION,w.nextId)).toBe(false);
 expect(validStripTaskField351({strip351:{targetId:target.id,phase:'approach',progressCore:10,lastWorkedAt:0}},SCHEMA_VERSION,w.tick,w.nextId)).toBe(false);
 expect(validStripTaskField351({strip351:{targetId:target.id,phase:'strip',progressCore:20,lastWorkedAt:w.tick+1}},SCHEMA_VERSION,w.tick,w.nextId)).toBe(false);
 expect(validStripTaskField351({strip351:{targetId:target.id,phase:'strip',progressCore:20,lastWorkedAt:w.tick,forced:false}},SCHEMA_VERSION,w.tick,w.nextId)).toBe(false);
 expect(validStripTaskField351({strip351:{targetId:target.id,phase:'strip',progressCore:20,lastWorkedAt:w.tick,forced:true}},SCHEMA_VERSION,w.tick,w.nextId)).toBe(true);
});

test('right-click order, drafted or not, inspector gizmos on the pawn and the corpse pile',async()=>{
 const {w,hauler,target,other}=camp();controlledInjury(w,target,'left-leg',30000);controlledInjury(w,target,'right-leg',30000);
 // Undrafted: Prioriser : Dépouiller, a forced job with no designation.
 const pages:NativePage[]=[],sent:Command[]=[];
 const client:NativeOrderClient={orderOptions:async(pawnId,x,z,queue)=>queryOrderOptions(w,pawnId,{x,z},queue),command:async c=>{sent.push(c);const r=applyCommand(w,c);if(!r.ok)throw Error(r.reason);return undefined;},currentWorld:()=>w,close:()=>{}};
 await nativeOrderPage(w,[hauler.id],{x:target.x,z:target.z},0,0,false,undefined,client,page=>pages.push(page));
 const row=pages.at(-1)!.rows!.find(r=>/Dépouiller Pillard/.test(r.label))!;expect(row.label).toBe('Prioriser : Dépouiller Pillard');
 await row.controls![0]!.onActivate!();
 expect(sent).toEqual([{type:'order-strip',pawnId:hauler.id,targetId:target.id}]);
 expect(hauler.strip351).toMatchObject({targetId:target.id,forced:true});expect(w.strip351).toBeUndefined();
 until(w,()=>!hauler.strip351,300);expect(owned(w,target.id)).toEqual([]);
 // Drafted: the same order keeps the colonist drafted.
 const d=camp();controlledInjury(d.w,d.target,'heart',15000);
 ok(d.w,{type:'draft',pawnIds:[d.hauler.id],enabled:true});
 ok(d.w,{type:'order-strip',pawnId:d.hauler.id,targetId:d.target.id});
 until(d.w,()=>owned(d.w,d.target.id).length===0,300);expect(d.hauler.draft).toBeDefined();expect(d.hauler.strip351).toBeUndefined();
 // Inspector of the downed pawn and of a corpse pile.
 const g=camp();controlledInjury(g.w,g.target,'left-leg',30000);controlledInjury(g.w,g.target,'right-leg',30000);
 const state:NativeUiState={world:g.w,epoch:351,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[g.target.id],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true} as unknown as NativeUiState;
 const noop=()=>{},actions={command:async(c:Command)=>applyCommand(g.w,c),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop} as unknown as NativeUiActions;
 const page=buildNativeInspector(state,actions);
 expect(page?.actions?.find(a=>a.id==='strip-designate')).toMatchObject({label:'Dépouiller'});
 controlledInjury(g.w,g.target,'heart',15000);
 const pile={id:g.w.nextId++,kind:'corpse',item:'human-corpse',quantity:1,owner:{type:'ground',x:20,z:20},humanCorpse:{pawnId:g.target.id}} as MaterialPile;
 g.w.piles.push(pile);g.target.body={observedAt:g.w.tick,pileId:pile.id};
 expect(mapObjectActions(g.w,{kind:'pile',id:pile.id})).toContainEqual({id:'strip',label:'Dépouiller',command:{type:'strip-designate',targetId:g.target.id,enabled:true}});
 ok(g.w,{type:'strip-designate',targetId:g.target.id,enabled:true});
 expect(mapObjectActions(g.w,{kind:'pile',id:pile.id})).toContainEqual({id:'strip',label:'Annuler le dépouillement',command:{type:'strip-designate',targetId:g.target.id,enabled:false}});
 void other;
});

test('below 351 nothing changes: commands refused, no option, no thought; migration 350 → 351 by number only',()=>{
 const {w,hauler,target}=camp();controlledInjury(w,target,'heart',15000);
 const raw=serializeWorld(w),migrated=deserializeWorld(asOldSchema(raw,350));
 // Schema 353: a new game's policies also allow the hats, which an old save lacks.
 expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(serializeWorld(migrated)).toBe(asMigratedFrom352(raw));
 // A 350 save holding a designation or a strip job is refused.
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 expect(()=>deserializeWorld(asOldSchema(serializeWorld(w),350))).toThrow();
 until(w,()=>!!hauler.strip351,40);
 const busy=JSON.parse(serializeWorld(w)) as {strip351?:unknown};delete busy.strip351;
 expect(()=>deserializeWorld(asOldSchema(JSON.stringify(busy),350))).toThrow();

 const old=camp();controlledInjury(old.w,old.target,'heart',15000);setVersion(old.w,350);
 expect(applyCommand(old.w,{type:'area',action:'strip',from:{x:0,z:0},to:{x:31,z:31}}).ok).toBe(false);
 expect(applyCommand(old.w,{type:'strip-designate',targetId:old.target.id,enabled:true}).ok).toBe(false);
 expect(applyCommand(old.w,{type:'order-strip',pawnId:old.hauler.id,targetId:old.target.id}).ok).toBe(false);
 expect(queryOrderOptions(old.w,old.hauler.id,{x:old.target.x,z:old.target.z}).some(o=>o.stripTargetId!==undefined)).toBe(false);
 old.shirt.owner={type:'apparel',pawnId:old.hauler.id};
 expect(moodThoughts(old.w,old.hauler).some(t=>t.id==='dead-mans-apparel')).toBe(false);
 // Without any designation, stepping at 350 and at 351 is bit-identical.
 const a=camp(),b=camp();controlledInjury(a.w,a.target,'heart',15000);controlledInjury(b.w,b.target,'heart',15000);
 setVersion(a.w,350);stepWorld(a.w,60);stepWorld(b.w,60);setVersion(a.w,SCHEMA_VERSION);
 expect(serializeWorld(a.w)).toBe(serializeWorld(b.w));
});

test('a living member of a visible non-hostile faction costs 40 goodwill when stripped (Notify_MemberStripped); hostile, dead and factionless do not',()=>{
 const {w,target}=camp();
 const tiles:readonly SettlementTile[]=Array.from({length:128},(_,i)=>({biome:'temperate-forest',hilliness:'flat',neighbours:[(i+127)%128,(i+1)%128]}));
 const foreign=generateForeignWorldFactions256({version:w.schemaVersion,tick:w.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:2,nextFactionId:1,nextSettlementId:1,nextThingId:w.nextId,random:new WorldGenerationRandom(718)});
 if(!foreign.ok)throw Error(foreign.reason);
 const registry=completeWorldFactionRegistry256({version:w.schemaVersion,draft:foreign.draft,playerDef:'PlayerColony',name:'Colonie de contrôle',postWorldRandom:new WorldGenerationRandom(991)});
 if(!registry.ok)throw Error(registry.reason);
 w.worldFactions=registry.registry;w.nextId=foreign.nextThingId;
 const r=w.worldFactions,civil=r.factions.find(f=>f.def==='OutlanderCivil')!,relation=r.relations.find(x=>x.aId===Math.min(civil.id,r.playerFactionId)&&x.bId===Math.max(civil.id,r.playerFactionId))!;
 Object.assign(relation,{goodwill:0,kind:'neutral'});
 Object.assign(target,{faction:'outlanders',worldAffiliation259:{revision:1,factionId:civil.id,hostFactionId:null,guestStatus:'Guest'}});
 controlledInjury(w,target,'left-leg',30000);controlledInjury(w,target,'right-leg',30000);
 const t=stripTarget351(w,target.id)!;
 expect(stripGoodwillWarning351(w,t)).toBe(`Dépouiller ${target.name} fâchera ${civil.name} (relations 0 → -40).`);
 ok(w,{type:'strip-designate',targetId:target.id,enabled:true});
 expect(w.events.at(-1)!.message).toMatch(/fâchera/);
 for(let i=0;i<400&&owned(w,target.id).length;i++)stepWorld(w);
 expect(owned(w,target.id)).toEqual([]);
 expect(relation).toMatchObject({goodwill:-40,kind:'neutral'});
 expect(w.events.some(e=>e.message===`Relations avec ${civil.name} : 0 → -40 (membre dépouillé).`)).toBe(true);
 // Hostile relation, a corpse, or no world faction: no warning and no change.
 Object.assign(relation,{goodwill:-80,kind:'hostile'});expect(stripGoodwillWarning351(w,t)).toBeUndefined();
 Object.assign(relation,{goodwill:0,kind:'neutral'});expect(stripGoodwillWarning351(w,{...t,dead:true})).toBeUndefined();
 delete target.worldAffiliation259;expect(stripGoodwillWarning351(w,t)).toBeUndefined();
});
