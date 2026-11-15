import {afterEach,expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/index';
import {createMedicalRecord} from '../src/sim/injury-state';
import {emptyGroupLedger} from '../src/sim/group-loading';
import type {Pawn,World} from '../src/sim/types';
import {actorNotificationTarget} from '../src/ui/notification-focus';
import {createStatusAlerts,readAvailabilityStatusAlerts,readStatusAlerts} from '../src/ui/status-alerts';
import {createFirstDayGuide,readFirstDayGuide,type FirstDayGuideAction} from '../src/ui/first-day-guide';

// Prepared presentation snapshots only: these cases do not claim to play a
// departure, an illness, a death or a campaign. No simulation clock is advanced.
const camp=()=>createWorld(337,32,32);
const work=(w:World)=>readFirstDayGuide(w).find(row=>row.id==='work')!;
const blocked=()=>{const w=camp();for(const p of w.pawns)p.state='downed';return w;};
function away():World {
  const w=camp(),[scout,trader,member]=w.pawns;w.pawns=[];
  w.scout={phase:'travelling',pawn:scout!,items:[],foodPileId:1000,quantity:2,startedAt:0,departedAt:0,returnAt:1500,consumed:0,entry:{x:1,z:1}};
  w.commercialTrip={phase:'at-post',pawn:trader!,items:[],foodPileId:1001,foodQuantity:2,silverQuantity:0,startedAt:0,departedAt:0,
    consumed:0,silverPaid:0,bought:{medicine:0,component:0},entry:{x:1,z:1},arrivedAt:0,decisionUntil:250};
  w.group={phase:'travelling',id:1,startedAt:0,destination:1,ledger:emptyGroupLedger(),members:[member!],items:[],departedAt:0,
    lastPersonalTick:0,baseline:{food:0,silver:0,cargo:{cloth:0,'muffalo-wool':0},medicine:0,component:0},entry:{x:1,z:1},
    tile:0,route:[],segment:null,paused:false,stop:null};
  return w;
}
const death=(w:World,p:Pawn)=>{p.state='dead';p.health=createMedicalRecord(w.tick);p.health.death={tick:w.tick,cause:'trauma'};p.body={observedAt:w.tick,lostAt:w.tick};};

/** Small DOM double: event routing and keyed nodes only. Native focus/layout
 * remain the composed browser pilot's responsibility. Saved HTML is forbidden. */
class NodeFixture {
  children:NodeFixture[]=[];parentElement:NodeFixture|null=null;dataset:Record<string,string>={};style:Record<string,string>={};
  attributes=new Map<string,string>();className='';type='';hidden=false;open=false;tabIndex=-1;textWrites=0;
  onclick:(()=>void)|null=null;onkeydown:((event:{key:string;preventDefault:()=>void;stopPropagation:()=>void})=>void)|null=null;
  classList={add:(_name:string)=>{}};ownerDocument={createElement:()=>new NodeFixture()};private text='';
  set textContent(value:string){this.text=value;this.replaceChildren();this.textWrites++;}get textContent():string{return this.text+this.children.map(n=>n.textContent).join(' ');}
  set innerHTML(_value:string){throw Error('Saved names must stay literal.');}
  append(...nodes:NodeFixture[]){for(const node of nodes){node.remove();node.parentElement=this;this.children.push(node);}}
  insertBefore(node:NodeFixture,before:NodeFixture|null){node.remove();node.parentElement=this;if(!before)this.children.push(node);else this.children.splice(this.children.indexOf(before),0,node);}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(n=>n!==this);this.parentElement=null;}
  replaceChildren(){for(const node of this.children)node.parentElement=null;this.children=[];}
  setAttribute(key:string,value:string){this.attributes.set(key,value);}
}
function alertsUI(){
  vi.stubGlobal('document',{createElement:()=>new NodeFixture()});
  const host=new NodeFixture(),focus=vi.fn(),context=vi.fn(),tab=vi.fn();
  return {host,focus,context,tab,ui:createStatusAlerts(host as unknown as HTMLElement,{},{focus,context,tab})};
}
afterEach(()=>vi.unstubAllGlobals());

test('an available team keeps the normal seven guide sections and existing idle targets',()=>{
  const w=camp();expect(readAvailabilityStatusAlerts(w)).toEqual([]);
  expect(readFirstDayGuide(w)).toHaveLength(7);expect(work(w).action).toEqual({panel:'work'});
  // Alerts lot A: Core Alert_ColonistsIdle waits for the first whole day.
  const later=structuredClone(w);later.tick=6000;
  expect(readStatusAlerts(later).find(row=>row.key==='idle')?.targets).toEqual(w.pawns.map(p=>actorNotificationTarget(p.id)));
});
test('all downed colonists have an explicit explanation and retain the ordinary medical alert',()=>{
  const w=blocked(),rows=readAvailabilityStatusAlerts(w),first=w.pawns[0]!;
  expect(rows[0]).toMatchObject({key:'colonist-availability',text:'Aucun colon libre sur cette carte',targets:[actorNotificationTarget(first.id)],tab:'health'});
  expect(rows.find(row=>row.key===`availability-local:${first.id}`)?.text).toContain('à terre');
  expect(readStatusAlerts(w).find(row=>row.key==='downed')?.targets).toHaveLength(3);
  expect(work(w)).toMatchObject({status:'missing',action:{target:actorNotificationTarget(first.id),tab:'health'},actionLabel:'Consulter Santé'});
});
test('mental crises route to Needs rather than suggesting a worker is free',()=>{
  const w=camp();for(const p of w.pawns)p.mental={below:[0,0,0],cooldown:0,catharsis:[],crisis:{kind:'sad-wander',age:0,target:null,waitUntil:0}};
  expect(readAvailabilityStatusAlerts(w)[0]?.tab).toBe('needs');expect(work(w).actionLabel).toBe('Consulter Besoins');
  expect(readStatusAlerts(w).find(row=>row.key==='sad-wander')?.targets).toHaveLength(3);
});
test('detained colonial people route to the Prisoner tab',()=>{
  const w=camp();for(const p of w.pawns)p.prisoner={capturedAt:0,initialResistance:0,resistance:0,mode:'maintain',chatDay:0,chatCount:0,rng:1};
  expect(readAvailabilityStatusAlerts(w)[0]?.tab).toBe('prisoner');expect(work(w).actionLabel).toBe('Consulter Prisonnier');
});
test('cumulative local causes remain visible while the actionable health cause has priority',()=>{
  const w=blocked(),p=w.pawns[0]!;p.prisoner={capturedAt:0,initialResistance:0,resistance:0,mode:'maintain',chatDay:0,chatCount:0,rng:1};
  p.mental={below:[0,0,0],cooldown:0,catharsis:[],crisis:{kind:'sad-wander',age:0,target:null,waitUntil:0}};
  const row=readAvailabilityStatusAlerts(w).find(r=>r.key===`availability-local:${p.id}`)!;
  for(const label of ['détenu','à terre','en crise mentale'])expect(row.text).toContain(label);
  expect(row.tab).toBe('health');
});
test.each(['scout','commercialTrip','group'] as const)('%s links to the actual world view without an old map target',owner=>{
  const w=away(),container=w[owner]!;
  const id='pawn' in container?container.pawn.id:'members' in container?container.members[0]!.id:0;
  const row=readAvailabilityStatusAlerts(w).find(r=>r.key===`availability-away:${id}`)!;
  expect(row.targets).toEqual([]);expect(row.context).toEqual({panel:'world',worldTab:owner==='group'?'group':'individual'});
  expect(row.text).not.toMatch(/rappeler|revient dans/i);
});
test('a returning merchant and blocked scout entrance display the current phase without promising admission',()=>{
  const w=away();if(!w.scout||!('pawn' in w.scout))throw Error('Expected prepared scout');
  const scout=w.scout;scout.phase='awaiting-entry';
  if(w.commercialTrip?.phase!=='at-post')throw Error('Expected prepared merchant');
  const trader=w.commercialTrip;w.commercialTrip={...trader,phase:'returning',leftPostAt:0,returnAt:750};
  const rows=readAvailabilityStatusAlerts(w);
  expect(rows.find(r=>r.key===`availability-away:${scout.pawn.id}`)?.text).toContain('entrée sur la carte en attente');
  expect(rows.find(r=>r.key===`availability-away:${trader.pawn.id}`)?.text).toContain('trajet retour');
});
test('a local affected colonist remains the guide destination when other originals are travelling',()=>{
  const w=away();if(!w.scout||!('pawn' in w.scout))throw Error('Expected prepared scout');
  const p=w.scout.pawn;delete w.scout;p.state='downed';w.pawns=[p];
  expect(work(w).action).toEqual({target:actorNotificationTarget(p.id),tab:'health'});
  expect(readAvailabilityStatusAlerts(w).filter(row=>row.key.startsWith('availability-away:'))).toHaveLength(2);
});
test('confirmed local deaths preserve named facts and route total absence to Menu',()=>{
  const w=camp();for(const p of w.pawns)death(w,p);
  expect(readAvailabilityStatusAlerts(w)[0]).toMatchObject({targets:[],context:{panel:'menu'}});
  expect(readAvailabilityStatusAlerts(w).filter(row=>row.key.startsWith('availability-death:'))).toHaveLength(3);
  // Alerts lot A: Core Alert_ColonistLeftUnburied needs a free colonist on the
  // map; with everyone dead only the named availability facts remain.
  expect(readStatusAlerts(w).some(row=>row.key==='colonist-unburied'||row.key==='deaths')).toBe(false);
  expect(work(w).action).toEqual({panel:'menu'});expect(work(w).detail).toContain('décès confirmé');
});
test('an original group loss links to Group while total living absence still opens Menu',()=>{
  const w=camp(),p=w.pawns[0]!;w.pawns=[];death(w,p);
  w.groupLosses=[{groupId:1,tile:0,tick:0,pawn:p,items:[]}];
  expect(readAvailabilityStatusAlerts(w).find(r=>r.key===`availability-death:${p.id}`)).toMatchObject({targets:[],context:{panel:'world',worldTab:'group'}});
  expect(work(w).action).toEqual({panel:'menu'});
});
test('an empty map without known originals reports absence without inventing a death',()=>{
  const w=camp();w.pawns=[];
  expect(readAvailabilityStatusAlerts(w)).toEqual([{key:'colonist-availability',text:'Aucun colon vivant actuellement recensé dans la colonie ou ses voyages',targets:[],context:{panel:'menu'}}]);
  expect(work(w).detail).not.toMatch(/décès|défaite|arrivée/i);expect(work(w).action).toEqual({panel:'menu'});
});
test('contained starting colonists leave the arrival banner as the sole availability feedback',()=>{
  const w=camp(),held=w.pawns;w.pawns=[];
  w.startingArrival={profile:'crashlanded-pods-v1',phase:'incoming',start:0,landAt:15,openAt:27,personalTick:0,
    pods:held.map((pawn,index)=>({id:w.nextId++,cell:{x:15+index,z:15},pawn,items:[],drops:[]}))};
  expect(readAvailabilityStatusAlerts(w)).toEqual([]);expect(readStatusAlerts(w).some(r=>r.key==='colonist-availability')).toBe(false);
});
test('same-tick refresh preserves keyboard alert identity, literal saved names and existing target cycles',()=>{
  const {host,ui,focus,tab,context}=alertsUI(),w=blocked(),[a,b]=w.pawns;
  a!.name='<img src=x onerror=alert(1)> & A';ui.update(w);expect(focus).not.toHaveBeenCalled();expect(context).not.toHaveBeenCalled();
  const named=host.children.find(n=>n.dataset.alert===`availability-local:${a!.id}`)!;
  expect(named.textContent).toContain(a!.name);named.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(a!.id));expect(tab).toHaveBeenLastCalledWith('health');
  const downed=host.children.find(n=>n.dataset.alert==='downed')!;downed.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(a!.id));
  const copy=structuredClone(w);copy.pawns.shift();ui.update(copy);
  expect(host.children.find(n=>n.dataset.alert==='downed')).toBe(downed);
  const event={key:'Enter',preventDefault:vi.fn(),stopPropagation:vi.fn()};downed.onkeydown!(event);
  expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(b!.id));expect(event.preventDefault).toHaveBeenCalledOnce();
  ui.reset();downed.onclick!();expect(focus).toHaveBeenLastCalledWith(actorNotificationTarget(b!.id));
});
test('away alert keyboard activation opens the real view and never focuses a stale actor',()=>{
  const {host,ui,focus,context}=alertsUI(),w=away();ui.update(w);
  const member=w.group&&'members' in w.group?w.group.members[0]!:undefined;if(!member)throw Error('Expected group');
  const node=host.children.find(n=>n.dataset.alert===`availability-away:${member.id}`)!;
  node.onkeydown!({key:' ',preventDefault:()=>{},stopPropagation:()=>{}});
  expect(context).toHaveBeenLastCalledWith({panel:'world',worldTab:'group'});expect(focus).not.toHaveBeenCalled();
});
test('guide action updates on the same keyed row and reset releases its callback',()=>{
  const host=new NodeFixture(),actions:FirstDayGuideAction[]=[],guide=createFirstDayGuide(host as unknown as HTMLElement,{onAction:a=>actions.push(a)}),w=away();
  guide.setActive(true);guide.update(w);expect(actions).toEqual([]);expect(host.children).toHaveLength(7);
  const row=host.children[0]!,button=row.children[3]!;row.open=true;button.onclick!();expect(actions[0]).toEqual({panel:'world',worldTab:'individual'});
  guide.update(camp());expect(host.children[0]).toBe(row);expect(row.open).toBe(true);expect(row.children[3]).toBe(button);
  button.onclick!();expect(actions[1]).toEqual({panel:'work'});guide.reset();expect(button.onclick).toBeNull();guide.dispose();
});
test('reading frozen snapshots preserves all owners and reacts to new confirmed availability at the same tick',()=>{
  const w=away(),before=JSON.stringify(w);
  const freeze=(value:unknown):void=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}};
  freeze(w);expect(()=>{readStatusAlerts(w);readFirstDayGuide(w);}).not.toThrow();expect(JSON.stringify(w)).toBe(before);
  const returned=structuredClone(w);if(!returned.scout||!('pawn' in returned.scout))throw Error('Expected scout');
  returned.pawns.push(returned.scout.pawn);delete returned.scout;
  expect(readAvailabilityStatusAlerts(returned)).toEqual([]);expect(work(returned).action).toEqual({panel:'work'});
});
