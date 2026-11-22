import { expect,test } from 'vitest';
import { readFirstDayGuide,createFirstDayGuide,type FirstDayGuideAction,type FirstDayGuideId } from '../src/ui/first-day-guide';
import { newCookingBill,cookingSpot } from '../src/sim/cooking-bills';
import {selectResearch} from '../src/sim/research';
import { newShelfStorage } from '../src/sim/shelf-storage';
import { structureMaxHp } from '../src/sim/thing-damage-rules';
import { addMaterial } from '../src/sim/materials';
import { deconstructionCamp,fixtureBuilding } from './scenarios/deconstruction';
import type { BedSlot,Job,World } from '../src/sim/types';
import { bedSlotClaimed,bedSlotsCount } from '../src/sim/bed-slots';
import { captureActorBeds256 } from '../src/sim/actor-bed-local-256';
import { registeredCampaign } from '../src/sim/world-map-context';

const camp=()=>{const w=deconstructionCamp(3);w.stockpiles=[];w.growingZones=[];return w;};
const row=(w:World,id:FirstDayGuideId)=>readFirstDayGuide(w).find(s=>s.id===id)!;
const plan=(w:World,kind:Job['kind']):Job=>{
  const j:Job={id:w.nextId++,kind,x:8,z:8,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},construction:'blueprint'};
  w.jobs.push(j);return j;
};

test('blueprints do not supply beds, storage or usable meal stations',()=>{
  const w=camp();plan(w,'bed');plan(w,'shelf');plan(w,'fueled-stove');
  for(const id of ['beds','storage','cooking'] as const)expect(row(w,id).status).toBe('started');
  expect(row(w,'beds').detail).toContain('0 place(s)');expect(row(w,'storage').detail).toContain('0 case(s)');
  expect(row(w,'cooking').detail).toContain('0 poste(s) construit(s)');
});

test('empty, disabled and explicit item filters do not masquerade as working storage',()=>{
  const w=camp(),cell={id:w.nextId++,x:5,z:5,priority:3,capacity:500,filters:{wood:false,food:false}};
  w.stockpiles=[cell];expect(row(w,'storage').status).toBe('started');
  cell.filters={wood:true,food:true};expect(row(w,'storage').status).toBe('ready');
  w.stockpiles[0]!.items={wood:true};expect(row(w,'storage').status).toBe('started');
  delete w.stockpiles[0]!.items;cell.priority=0;expect(row(w,'storage').status).toBe('missing');
  cell.priority=3;cell.capacity=0;expect(row(w,'storage').status).toBe('missing');
});

test('only a physical surviving shelf contributes its actual policy cells',()=>{
  const w=camp(),s=fixtureBuilding(w,'small-shelf',7,7);Object.assign(s,{shelf:newShelfStorage([w.nextId++])});
  expect(row(w,'storage').status).toBe('ready');
  Object.assign(s,{damage:structureMaxHp(s)});expect(row(w,'storage').status).toBe('missing');
});

test('medical, prison and destroyed beds do not fill civilian capacity',()=>{
  const w=camp(),a=fixtureBuilding(w,'bed',7,7),b=fixtureBuilding(w,'bed',9,7),c=fixtureBuilding(w,'bed',11,7);
  Object.assign(a,{medical:true});Object.assign(b,{prisoner:true});Object.assign(c,{damage:structureMaxHp(c)});
  expect(row(w,'beds')).toMatchObject({status:'missing',detail:'0 place(s) civile(s) compatibles pour 3 colon(s).'});
});

test('foreign owners exclude their bed while dead people do not inflate demand',()=>{
  const w=camp(),bed=fixtureBuilding(w,'bed',7,7),foreign=w.pawns[0]!;
  foreign.faction='outlanders';foreign.bedId=bed.id;w.pawns[1]!.state='dead';
  expect(row(w,'beds').detail).toBe('0 place(s) civile(s) compatibles pour 1 colon(s).');
  foreign.state='dead';expect(row(w,'beds').detail).toBe('1 place(s) civile(s) compatibles pour 1 colon(s).');
});

test('an unassigned double bed supplies only its first automatic place for unrelated colonists',()=>{
  const w=camp(),bed=fixtureBuilding(w,'double-bed',7,7),owner=w.pawns[0]!;
  owner.bedId=bed.id;owner.bedSlot=0;
  expect(row(w,'beds').detail).toBe('1 place(s) civile(s) compatibles pour 3 colon(s).');
  owner.bedId=null;delete owner.bedSlot;
  expect(row(w,'beds').detail).toBe('1 place(s) civile(s) compatibles pour 3 colon(s).');
  fixtureBuilding(w,'bed',11,7);
  expect(row(w,'beds')).toMatchObject({status:'started',detail:'2 place(s) civile(s) compatibles pour 3 colon(s).'});
});

test('explicit manual assignment of both double slots supplies both actual owners places',()=>{
  const w=camp(),bed=fixtureBuilding(w,'double-bed',7,7),[a,b]=w.pawns;
  a!.bedId=bed.id;a!.bedSlot=0;b!.bedId=bed.id;b!.bedSlot=1;
  expect(row(w,'beds').detail).toBe('2 place(s) civile(s) compatibles pour 3 colon(s).');
  fixtureBuilding(w,'bed',11,7);
  expect(row(w,'beds')).toMatchObject({status:'ready',detail:'3 place(s) civile(s) compatibles pour 3 colon(s).'});
});

test('a current double-bed owner admits their actual partner to the second automatic place',()=>{
  const w=camp(),bed=fixtureBuilding(w,'double-bed',7,7),[a,b]=w.pawns;
  a!.bedId=bed.id;a!.bedSlot=0;
  w.relationships={links:[{kind:'spouse',aId:Math.min(a!.id,b!.id),bId:Math.max(a!.id,b!.id),recordedAt:w.tick}]};
  expect(row(w,'beds').detail).toBe('2 place(s) civile(s) compatibles pour 3 colon(s).');
  fixtureBuilding(w,'bed',11,7);expect(row(w,'beds').status).toBe('ready');
});

test('work coverage reads effective incapacities, living civil workers and disabled priorities',()=>{
  const w=camp();for(const p of w.pawns){p.priorities.haul=1;p.priorities.grow=1;p.priorities.build=1;}
  expect(row(w,'work').status).toBe('ready');
  for(const p of w.pawns)p.background={childhood:'school-child',adulthood:'researcher'};
  expect(row(w,'work').detail).toContain('Transport');
  for(const p of w.pawns){delete p.background;p.state='downed';}
  expect(row(w,'work').status).toBe('missing');
  w.pawns[0]!.faction='outlanders';w.pawns[1]!.state='dead';w.pawns[2]!.state='dead';
  expect(row(w,'work').status).toBe('optional');
});

test('food is real current nutrition and excludes future production, foreign, dead, inventory and job owners',()=>{
  const w=camp(),a=w.pawns[0]!,b=w.pawns[1]!;a.faction='outlanders';b.state='dead';
  addMaterial(w,'food',50,{type:'pawn',pawnId:a.id},'survival-meal');
  addMaterial(w,'food',50,{type:'pawn',pawnId:b.id},'survival-meal');
  addMaterial(w,'food',50,{type:'inventory',pawnId:w.pawns[2]!.id},'survival-meal');
  const j=plan(w,'campfire');addMaterial(w,'food',50,{type:'job',jobId:j.id},'survival-meal');
  expect(row(w,'food')).toMatchObject({status:'missing'});expect(row(w,'food').detail).toContain('0.0 nutrition fraîche constatée, dont 0 repas de survie.');
  addMaterial(w,'food',5,{type:'ground',x:7,z:7},'survival-meal');
  expect(row(w,'food')).toMatchObject({status:'ready'});expect(row(w,'food').detail).toContain('4.5 nutrition fraîche constatée, dont 5 repas de survie.');
});

test.each(['cotton','healroot','haygrass'] as const)('%s does not complete human food cultivation',plant=>{
  const w=camp();w.growingZones=[{id:w.nextId++,plant,cells:[7*w.width+7],allowSow:true,allowCut:true}];
  expect(row(w,'cultivation').status).toBe('missing');
});

test('food zone, actual seedlings and harvestable food are three distinct states',()=>{
  const w=camp(),index=7*w.width+7;w.growingZones=[{id:w.nextId++,plant:'rice',cells:[index],allowSow:true,allowCut:true}];
  expect(row(w,'cultivation')).toMatchObject({status:'started',detail:'1 zone(s) de riz, pommes de terre ou maïs ; 0 plant(s), 0 récoltable(s).'});
  const crop={id:w.nextId++,kind:'rice' as const,x:7,z:7,amount:6,growth:.1,growthTick:w.tick};w.resources.push(crop);
  expect(row(w,'cultivation').status).toBe('started');crop.growth=1;expect(row(w,'cultivation').status).toBe('ready');
  Object.assign(crop,{blight:{since:w.tick,severity:.1,lastHarmTick:w.tick,nextCheck:w.tick+200,rng:1}});expect(row(w,'cultivation').status).toBe('started');
});

test('meal readiness requires compatible bill, filters, fuel and an enabled cook',()=>{
  const w=camp(),fire=fixtureBuilding(w,'campfire',7,7);w.pawns[0]!.priorities.cook=1;
  expect(row(w,'cooking').status).toBe('started');
  const bill=newCookingBill(w.nextId++);Object.assign(fire,{bills:[bill]});
  expect(row(w,'cooking').status).toBe('ready');
  bill.suspended=true;expect(row(w,'cooking').status).toBe('started');bill.suspended=false;
  for(const key of Object.keys(bill.filters) as (keyof typeof bill.filters)[])bill.filters[key]=false;
  expect(row(w,'cooking').status).toBe('started');bill.filters.rice=true;
  fire.fuel!.ticks=0;expect(row(w,'cooking').status).toBe('started');fire.fuel!.ticks=100;
  w.pawns[0]!.priorities.cook=0;expect(row(w,'cooking').status).toBe('started');
});

test('weapons in inventory or on another faction are not civilian equipment',()=>{
  const w=camp(),foreign=w.pawns[0]!;foreign.faction='outlanders';
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:foreign.id},'revolver');
  addMaterial(w,'weapon',1,{type:'inventory',pawnId:w.pawns[1]!.id},'bolt-action-rifle');
  expect(row(w,'equipment').detail).toBe('0 colon(s) portent une arme ; 0 arme(s) restent au sol.');
  addMaterial(w,'weapon',1,{type:'ground',x:7,z:7},'plasteel-knife');
  expect(row(w,'equipment')).toMatchObject({status:'started',action:{panel:'assign'}});
});

test('reading frozen snapshots preserves every value and observes changes at the same tick',()=>{
  const w=camp(),before=JSON.stringify(w);readFirstDayGuide(w);expect(JSON.stringify(w)).toBe(before);
  fixtureBuilding(w,'bed',7,7);expect(row(w,'beds').detail).toContain('1 place(s)');
  const freeze=(value:unknown):void=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}};
  freeze(w);expect(()=>readFirstDayGuide(w)).not.toThrow();expect(row(w,'beds').detail).toContain('1 place(s)');
});

/** Minimal node surface keeps this unit test independent of browser packages.
 * Assigning HTML is deliberately forbidden; DOM behavior is covered by ROOT. */
class GuideNode {
  children:GuideNode[]=[];dataset:Record<string,string>={};textContent='';className='';hidden=false;open=false;type='';onclick:(()=>void)|null=null;
  classList={add:(_name:string)=>{}};
  ownerDocument={createElement:(_tag:string)=>new GuideNode()};
  set innerHTML(_value:string){throw new Error('HTML must not be assigned');}
  append(...nodes:GuideNode[]){this.children.push(...nodes);}
  replaceChildren(){this.children=[];}
}

test('inactive and disposed guide updates do not read or retain any world data',()=>{
  const host=new GuideNode(),guide=createFirstDayGuide(host as unknown as HTMLElement,{onAction:()=>{}});
  const unreadable=new Proxy({} as World,{get(){throw new Error('hidden guide read World');}});
  expect(()=>guide.update(unreadable)).not.toThrow();expect(host.children).toHaveLength(0);
  guide.setActive(true);guide.update(camp());expect(host.children).toHaveLength(8);
  guide.setActive(false);expect(()=>guide.update(unreadable)).not.toThrow();
  guide.dispose();expect(()=>guide.update(unreadable)).not.toThrow();expect(host.children).toHaveLength(0);
});

test('keyed details and action buttons survive refreshes; reset releases their callbacks',()=>{
  const host=new GuideNode(),actions:FirstDayGuideAction[]=[],guide=createFirstDayGuide(host as unknown as HTMLElement,{onAction:action=>actions.push(action)}),w=camp();
  guide.setActive(true);guide.update(w);const work=host.children[0]!,button=work.children[3]!;work.open=true;
  w.pawns[0]!.name='<img src=x onerror=alert(1)>';w.pawns[0]!.priorities.haul=1;guide.update(w);
  expect(host.children[0]).toBe(work);expect(work.open).toBe(true);expect(work.children[3]).toBe(button);
  button.onclick!();expect(actions).toEqual([{panel:'work'}]);
  guide.setActive(false);button.onclick!();expect(actions).toHaveLength(1);
  guide.reset();expect(button.onclick).toBeNull();expect(host.children).toHaveLength(0);
});

test('research is an eighth optional guide route, never an automatic project or assignment',()=>{
 const w=camp();delete w.research;const before=structuredClone(w),section=row(w,'research');
 expect(readFirstDayGuide(w)).toHaveLength(8);expect(section).toMatchObject({status:'optional',action:{panel:'research'},actionLabel:'Ouvrir Recherche'});expect(section.detail).toContain('Aucun projet choisi');expect(section.body).toContain('facultatif');expect(w).toEqual(before);
 fixtureBuilding(w,'research-bench',7,7);expect(row(w,'research').status).toBe('optional');expect(w.research).toBeUndefined();expect(w.pawns.every(p=>p.priorities.research===0)).toBe(true);
 const host=new GuideNode(),actions:FirstDayGuideAction[]=[],guide=createFirstDayGuide(host as unknown as HTMLElement,{onAction:action=>actions.push(action)});guide.setActive(true);guide.update(w);host.children[7]!.children[3]!.onclick!();expect(actions).toEqual([{panel:'research'}]);expect(w.research).toBeUndefined();
});

test('a chosen project with a sleeping assigned researcher stays started, not complete or a promised route',()=>{
 const w=camp();delete w.research;fixtureBuilding(w,'research-bench',7,7);expect(selectResearch(w,'complex-clothing').ok).toBe(true);
 expect(row(w,'research')).toMatchObject({status:'started'});expect(row(w,'research').body).toContain('0 colon(s) affecté(s)');
 const p=w.pawns[0]!;p.priorities.research=1;p.state='sleeping';p.need={kind:'sleep',phase:'sleep',bedId:null,target:{x:p.x,z:p.z}};
 const before=structuredClone(w),section=row(w,'research');expect(section.status).toBe('started');expect(section.detail).toContain('0 chercheur(s) au travail, 0 en chemin');expect(section.body).toContain('1 colon(s) affecté(s)');expect(section.body).toContain('ne garantit pas l’accès');expect(w).toEqual(before);expect(w.research!.points).toBe(0);
});

test('a current local research task supplies guide readiness without inventing completion, and foreign engagement is excluded',()=>{
 const w=camp();delete w.research;const bench=fixtureBuilding(w,'research-bench',7,7),p=w.pawns[0]!;expect(selectResearch(w,'complex-clothing').ok).toBe(true);p.priorities.research=1;
 const spot=cookingSpot(bench);Object.assign(p,{x:spot.x,z:spot.z,state:'working',path:[],motion:null,moveCooldown:0,research:{stationId:bench.id,spot,worked:0}});
 const before=structuredClone(w);expect(row(w,'research')).toMatchObject({status:'ready'});expect(row(w,'research').detail).toContain('1 chercheur(s) au travail');expect(w).toEqual(before);expect(w.research!.points).toBe(0);expect(w.research!.completedAt).toBeUndefined();
 p.faction='outlanders';expect(row(w,'research').status).toBe('started');expect(row(w,'research').detail).toContain('0 chercheur(s) au travail');
});
test('a shared bed capture answers every place exactly as one capture per question',()=>{
  // The guide reads many places of one World; it now captures the campaign's
  // beds once. Each answer must equal the per-question capture.
  const w=camp(),single=fixtureBuilding(w,'bed',7,7),double=fixtureBuilding(w,'double-bed',9,7),medical=fixtureBuilding(w,'bed',12,7),[a,b,c]=w.pawns;
  Object.assign(medical,{medical:true});
  a!.bedId=double.id;a!.bedSlot=1;b!.bedId=single.id;c!.bedId=medical.id;
  let captures=0;const shared=()=>{captures++;return captureActorBeds256(registeredCampaign(w));};
  for(const bed of [single,double,medical])for(let slot=0;slot<bedSlotsCount(bed);slot++)for(const pawn of [a,b,c,undefined]){
    expect(bedSlotClaimed(w,bed,slot as BedSlot,pawn?.id,shared)).toBe(bedSlotClaimed(w,bed,slot as BedSlot,pawn?.id));
  }
  expect(captures).toBeGreaterThan(0);
  expect(row(w,'beds').detail).toBe('2 place(s) civile(s) compatibles pour 3 colon(s).');
});
