import {afterEach,describe,expect,it,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {applyCommand,stepWorld} from '../src/sim/engine';
import {initialGrave} from '../src/sim/burial';
import {adoptColonyEconomy} from '../src/sim/colony-economy';
import {addGroundMaterial} from '../src/sim/materials';
import {enableVisitors} from '../src/sim/visitors';
import {createMedicalRecord} from '../src/sim/injury-state';
import {currentMedicalBed} from '../src/sim/hospital-medical-stats';
import type {Structure,World} from '../src/sim/types';
import {readStatusAlerts} from '../src/ui/status-alerts';
import {missingColonistBeds,freeColonistsSpawned} from '../src/ui/core-colony-alerts';
import {CORE_ALERT_PRIORITY_RANK,coreAlertPriority,coreAlertsStarted} from '../src/ui/alert-priority';
import {NotificationFocusCycle,actorNotificationTarget,personNotificationTarget,type NotificationTarget} from '../src/ui/notification-focus';
import {readNativeDomainAlerts,RESOLVED_REPORT_TICKS} from '../src/ui3d/native-domain-alerts';
import {AlertActivationTracker,AlertBounce,alertHoverText,alertPulseBrightness,readNativeAlertRows,type PrioritizedHudAlert} from '../src/ui3d/native-alert-list';
import {NativeHudCards,type NativeAlertStart} from '../src/ui3d/native-hud';
import {PrototypeCardboardArt,type CardboardPiece} from '../src/ui3d/prototype-art';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction';
import {fireCamp,woodFire} from './scenarios/fire';
import {rescueCamp} from './scenarios/rescue';
import {careCamp} from './scenarios/care';
import {funeralFixture} from './scenarios/hygiene-ui';
import {recruitmentUiFixture} from './scenarios/prison-camp';
import {visitorTradeFixture} from './scenarios/visitors';

/** Alerts lot A: Core RimWorld 1.6 alert rules on real World states. Readers are
 * pure; the native column is driven through its public update/animate path. */
const row=(w:World,key:string)=>readStatusAlerts(w).find(r=>r.key===key);
const has=(w:World,key:string)=>readStatusAlerts(w).some(r=>r.key===key);
const DAY=6000;

describe('corrected Core alert rows',()=>{
  test('fire in the home area (Critical) only counts fires on home cells and clears when put out',()=>{
    const w=fireCamp(1),cell={x:6,z:6},index=cell.z*w.width+cell.x;
    woodFire(w,cell);
    expect(has(w,'fire')).toBe(false); // no home area
    w.home=[index];
    const fire=row(w,'fire')!;
    expect(fire).toMatchObject({text:'Incendie dans la zone de foyer',targets:[{kind:'cell',cell}]});
    expect(coreAlertPriority(fire)).toBe('critical');
    w.home=[index+1];expect(has(w,'fire')).toBe(false); // outside the home area
    w.home=[index];w.fires!.items=[];expect(has(w,'fire')).toBe(false);
  });

  test('crop blight returns to the list as a Medium row pointing at the real plant',()=>{
    const w=deconstructionCamp(1);w.resources=[{id:w.nextId++,kind:'rice',amount:1,x:4,z:4,growth:.5}] as World['resources'];
    const plant=w.resources[0]!;expect(has(w,'blight')).toBe(false);
    plant.blight={since:w.tick,severity:.1,lastHarmTick:w.tick,nextCheck:w.tick+200,rng:1};
    const blight=row(w,'blight')!;expect(blight.targets[0]).toMatchObject({kind:'object',object:{kind:'resource',id:plant.id}});expect(coreAlertPriority(blight)).toBe('medium');
    delete plant.blight;expect(has(w,'blight')).toBe(false);
  });

  test('a downed colonist needs rescue until carried, then neither rescue nor tend alerts in the medical bed',()=>{
    const w=rescueCamp(),[actor,patient]=w.pawns;
    expect(row(w,'downed')).toMatchObject({text:'Colon à secourir',targets:[actorNotificationTarget(patient!.id)],tab:'health'});
    expect(row(w,'colonist-needs-tend')).toBeUndefined(); // Core: rescue first
    for(let i=0;i<600&&actor!.rescue?.phase!=='carry';i++)stepWorld(w);
    expect(actor!.rescue?.phase).toBe('carry');expect(has(w,'downed')).toBe(false);
    for(let i=0;i<900&&!(patient!.need?.kind==='sleep'&&patient!.need.phase==='sleep');i++)stepWorld(w);
    expect(currentMedicalBed(w,patient!)?.medical).toBe(true);
    expect(has(w,'downed')).toBe(false);expect(has(w,'colonist-needs-tend')).toBe(false);
  });

  test('a colonist with an untended wound is signalled (High) until lying in a medical bed',()=>{
    const w=careCamp(),[doctor,patient]=w.pawns;
    const tend=row(w,'colonist-needs-tend')!;
    expect(tend.targets).toEqual([actorNotificationTarget(patient!.id)]);expect(tend.targets).not.toContainEqual(actorNotificationTarget(doctor!.id));
    expect(coreAlertPriority(tend)).toBe('high');
    for(let i=0;i<1000&&patient!.state!=='resting';i++)stepWorld(w);
    expect(currentMedicalBed(w,patient!)?.medical).toBe(true);expect(has(w,'colonist-needs-tend')).toBe(false);
  });

  test('an unburied colonist body is High until carried and buried; no alert without a free colonist',()=>{
    const {w,actor,other,body}=funeralFixture();other.priorities.haul=0;
    const unburied=row(w,'colonist-unburied')!;
    expect(unburied).toMatchObject({text:'Colon laissé sans sépulture',targets:[personNotificationTarget(w,body.id)]});
    expect(coreAlertPriority(unburied)).toBe('high');
    const alone=structuredClone(w);for(const p of alone.pawns)if(p.id!==body.id)p.state='dead';
    expect(readStatusAlerts(alone).some(r=>r.key==='colonist-unburied')).toBe(false);
    const grave=fixtureBuilding(w,'grave',20,16) as Structure;grave.grave=initialGrave();
    expect(applyCommand(w,{type:'assign-grave',graveId:grave.id,pawnId:body.id}).ok).toBe(true);
    expect(applyCommand(w,{type:'order-bury',pawnId:actor.id,bodyPawnId:body.id}).ok).toBe(true);
    for(let i=0;i<1600&&actor.burial?.phase!=='carry';i++)stepWorld(w);
    expect(actor.burial?.phase).toBe('carry');expect(has(w,'colonist-unburied')).toBe(false);
    for(let i=0;i<1600&&grave.grave!.corpseId===undefined;i++)stepWorld(w);
    expect(grave.grave!.corpseId).toBeDefined();expect(has(w,'colonist-unburied')).toBe(false);
  });

  test('prisoners need a conscious free warden (NeedWarden, High), not a permanent count',()=>{
    const {world:w,actorId,patientId}=recruitmentUiFixture(),actor=w.pawns.find(p=>p.id===actorId)!;
    expect(has(w,'prisoners')).toBe(false);
    const warden=row(w,'need-warden')!;
    expect(warden).toMatchObject({text:'Geôlier nécessaire',targets:[actorNotificationTarget(patientId)],tab:'prisoner'});
    expect(coreAlertPriority(warden)).toBe('high');
    actor.priorities.warden=1;expect(has(w,'need-warden')).toBe(false);
    actor.state='downed';expect(has(w,'need-warden')).toBe(true);
  });

  test('serious hypothermia (stage ≥ 0.35) in unsafe air is Critical; shivering or warm air is not',()=>{
    const w=deconstructionCamp(2),[a,b]=w.pawns;
    for(const p of [a!,b!])p.health=createMedicalRecord(w.tick);
    a!.health!.hypothermia=350_000_000;b!.health!.hypothermia=200_000_000;
    const cells=[a!,b!].map(p=>p.z*w.width+p.x);
    w.thermal={regions:[{cells,temperature:-40}]};
    const cold=row(w,'hypothermia')!;expect(cold.targets).toEqual([actorNotificationTarget(a!.id)]);expect(coreAlertPriority(cold)).toBe('critical');
    w.thermal={regions:[{cells,temperature:21}]};expect(has(w,'hypothermia')).toBe(false); // warmed up, still recovering
  });

  test('idle colonists wait for day 1; beds stop after day 30 and pair love partners in a double bed',()=>{
    const w=deconstructionCamp(3);for(const p of w.pawns)p.state='idle';
    expect(has(w,'idle')).toBe(false);w.tick=DAY;expect(row(w,'idle')?.targets).toHaveLength(3);
    fixtureBuilding(w,'double-bed',4,4);fixtureBuilding(w,'bed',8,4);
    const free=freeColonistsSpawned(w);expect(missingColonistBeds(w,free)).toBe(1);
    expect(row(w,'beds')).toMatchObject({text:'1 couchage manquant',context:{panel:'architect',category:'furniture'}});
    const [a,b]=w.pawns;w.relationships={links:[{kind:'lover',aId:Math.min(a!.id,b!.id),bId:Math.max(a!.id,b!.id),recordedAt:0}]};
    expect(missingColonistBeds(w,free)).toBe(0);expect(has(w,'beds')).toBe(false);
    w.relationships={links:[]};w.structures=[];w.tick=30*DAY;expect(has(w,'beds')).toBe(true);
    w.tick=31*DAY;expect(has(w,'beds')).toBe(false);
  });

  test('low food counts only fresh food in storage, after 2.5 days, against 4 per colonist',()=>{
    const w=deconstructionCamp(3);w.tick=14_999;
    expect(has(w,'food-reserves')).toBe(false);w.tick=15_000;expect(has(w,'food-reserves')).toBe(true);
    addGroundMaterial(w,'food',10,{x:3,z:3},'survival-meal');addGroundMaterial(w,'food',10,{x:3,z:4},'survival-meal');
    expect(has(w,'food-reserves')).toBe(true); // 18 nutrition, but not in storage
    for(const z of [3,4])w.stockpiles.push({id:w.nextId++,x:3,z,priority:2,capacity:75,filters:{wood:false,food:true}});
    expect(has(w,'food-reserves')).toBe(false); // 18 ≥ 4 × 3
  });
});

describe('new early Core alerts',()=>{
  test('meal source from day 2 and defenses during days 2 to 5 clear once built',()=>{
    const w=deconstructionCamp(2);w.tick=2*DAY-1;
    expect(has(w,'need-meal-source')).toBe(false);expect(has(w,'need-defenses')).toBe(false);
    w.tick=2*DAY;expect(coreAlertPriority(row(w,'need-meal-source')!)).toBe('medium');expect(coreAlertPriority(row(w,'need-defenses')!)).toBe('high');
    fixtureBuilding(w,'campfire',5,5);expect(has(w,'need-meal-source')).toBe(false);
    fixtureBuilding(w,'sandbags',9,9);expect(has(w,'need-defenses')).toBe(false);
    w.structures=w.structures.filter(s=>s.kind!=='sandbags');w.tick=6*DAY;expect(has(w,'need-defenses')).toBe(false);
  });

  test('recreation kinds below the expectation raise NeedJoySources until a new kind is built',()=>{
    const w=deconstructionCamp(2);expect(has(w,'need-joy-sources')).toBe(false); // no expectation profile
    // Prepared wealth record (the expectation reader only looks at knownTotal).
    const wealth=(total:number)=>{w.economy!.wealth={...w.economy!.wealth,knownTotal:total};};
    adoptColonyEconomy(w);wealth(0);expect(has(w,'need-joy-sources')).toBe(false); // 2 needed, 2 always present
    wealth(20_000);const joy=row(w,'need-joy-sources')!;expect(joy.explanation).toContain('Manquants');expect(coreAlertPriority(joy)).toBe('medium');
    fixtureBuilding(w,'horseshoes',6,6);expect(has(w,'need-joy-sources')).toBe(false);
    wealth(90_000);expect(has(w,'need-joy-sources')).toBe(true); // moderate: 4 kinds
  });
});

describe('letter projections in the list',()=>{
  test('the visitors card exists only while visitors are present',()=>{
    const w=deconstructionCamp(1);enableVisitors(w,true);
    expect(readNativeDomainAlerts(w,1).some(r=>r.key==='domain:visitors')).toBe(false);
    const {world}=visitorTradeFixture();expect(readNativeDomainAlerts(world,1).some(r=>r.key==='domain:visitors')).toBe(true);
  });
  test('a finished assault report expires after its window',()=>{
    const w=deconstructionCamp(1);w.tick=1000;
    w.raids={profile:'camp-raids-v1',rng:1,nextCheck:null,serial:7,completed:1,departed:[],last:{id:7,tick:1000,reason:'defended',killed:1,downed:0,escaped:0}};
    expect(readNativeDomainAlerts(w,1).some(r=>r.key==='domain:raid-last:7')).toBe(true);
    w.tick=1000+RESOLVED_REPORT_TICKS-1;expect(readNativeDomainAlerts(w,1).some(r=>r.key==='domain:raid-last:7')).toBe(true);
    w.tick=1000+RESOLVED_REPORT_TICKS;expect(readNativeDomainAlerts(w,1).some(r=>r.key==='domain:raid-last:7')).toBe(false);
  });
});

describe('Core readout rules',()=>{
  test('alerts start at 600 Core ticks (60 local ticks); letters are visible before',()=>{
    const w=deconstructionCamp(2);for(const p of w.pawns)p.state='downed';w.tick=59;
    expect(coreAlertsStarted(w)).toBe(false);
    const before=readNativeAlertRows(w,undefined,1);expect(before.some(r=>!r.domain)).toBe(false);
    w.tick=60;expect(coreAlertsStarted(w)).toBe(true);
    expect(readNativeAlertRows(w,undefined,1).find(r=>r.key==='downed')?.priority).toBe('critical');
  });

  test('priority order Critical → High → Medium keeps activation order inside a tier; a return starts again',()=>{
    const tracker=new AlertActivationTracker(),r=(key:string,priority:PrioritizedHudAlert['priority'])=>({key,priority});
    let step=tracker.update([r('m1','medium'),r('h1','high')],true);
    expect(step.ordered.map(x=>x.key)).toEqual(['h1','m1']);expect(step.started).toEqual([]);
    step=tracker.update([r('m1','medium'),r('h1','high'),r('c1','critical'),r('h2','high')],false);
    expect(step.ordered.map(x=>x.key)).toEqual(['c1','h1','h2','m1']);expect(step.started.map(x=>x.key)).toEqual(['c1','h2']);
    tracker.update([r('m1','medium'),r('h2','high'),r('c1','critical')],false);
    step=tracker.update([r('h1','high'),r('m1','medium'),r('h2','high'),r('c1','critical')],false);
    expect(step.ordered.map(x=>x.key)).toEqual(['c1','h2','h1','m1']);expect(step.started.map(x=>x.key)).toEqual(['h1']);
  });

  test('culprit cycle walks forward and backward through the same identity ring',()=>{
    const cycle=new NotificationFocusCycle(),t=(id:number):NotificationTarget=>actorNotificationTarget(id),ring=[t(1),t(2),t(3)];
    expect(cycle.next('a',ring)).toEqual(t(1));expect(cycle.next('a',ring)).toEqual(t(2));
    expect(cycle.previous('a',ring)).toEqual(t(1));expect(cycle.previous('a',ring)).toEqual(t(3));
    expect(cycle.previous('b',ring)).toEqual(t(3)); // first right click: last culprit
    expect(cycle.previous('a',[t(1),t(2)])).toEqual(t(2)); // removed last one: walk the old ring backwards
  });

  test('bounce and pulse follow Core AlertBounce and Alert_Critical constants',()=>{
    const bounce=new AlertBounce();expect(bounce.position).toBe(300);
    let steps=0;while(!bounce.idle&&steps<400){bounce.step(.05);steps++;}
    expect(bounce.idle).toBe(true);expect(bounce.position).toBe(0);expect(steps).toBeGreaterThan(10);
    expect(alertPulseBrightness(0)).toBeCloseTo(.6);expect(alertPulseBrightness(1)).toBeCloseTo(1);expect(alertPulseBrightness(2)).toBeCloseTo(.6);
  });

  test('hover text carries the explanation, the culprit names and the click hint; reading never mutates',()=>{
    const w=rescueCamp(2),before=JSON.stringify(w);
    const downed=readNativeAlertRows(w,undefined,1).find(r=>r.key==='downed')!;
    const text=alertHoverText(w,downed);
    for(const p of w.pawns.filter(p=>p.state==='downed'))expect(text).toContain(p.name);
    expect(text).toContain('clic droit');expect(JSON.stringify(w)).toBe(before);
    expect(alertHoverText(w,{key:'plain',text:'Message',targets:[]})).toBe('Message');
  });
});

type Command=unknown[];
class ImageFixture {onload:(()=>void)|null=null;onerror:(()=>void)|null=null;complete=false;naturalWidth=0;src='';}
function installPaint():void {
  const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash','quadraticCurveTo','bezierCurveTo','ellipse','rect','clip','createLinearGradient','createRadialGradient','setTransform','resetTransform','measureText']);
  vi.stubGlobal('Image',ImageFixture);
  vi.stubGlobal('document',{createElement:(tag:string)=>{
    if(tag!=='canvas')throw new Error(`Unexpected native element ${tag}`);
    const commands:Command[]=[],state=new Map<PropertyKey,unknown>();
    const context=new Proxy({},{
      get(_target,key){
        if(key==='measureText')return (text:string)=>({width:text.length*7});
        if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop:()=>{}});
        if(typeof key==='string'&&methods.has(key))return (...args:unknown[])=>{commands.push([key,...args]);};
        return state.get(key);
      },
      set(_target,key,value:unknown){state.set(key,value);return true;}
    });
    return {width:0,height:0,getContext:()=>context} as unknown as HTMLCanvasElement;
  }});
}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

describe('native alert column',()=>{
  it('waits for 600 Core ticks, sorts by priority, signals starts once, cycles culprits and reads on the Core cadence',()=>{
    installPaint();
    let now=0;const started:NativeAlertStart[]=[],focus=vi.fn();
    const art=new PrototypeCardboardArt(),root=new THREE.Group();
    const anchors={topCenter:new THREE.Group(),topLeft:new THREE.Group(),topRight:new THREE.Group(),bottomRight:new THREE.Group()};root.add(...Object.values(anchors));
    const hud=new NativeHudCards(art,anchors,{selectPawn:vi.fn(),speed:vi.fn(),showPage:vi.fn(),focus,alertStarted:s=>started.push(s)},()=>now);
    const piece=(id:string)=>{let found:CardboardPiece|undefined;root.traverse(o=>{if(o.userData.nativeId===id)found=o as CardboardPiece;});return found;};
    const alerts=()=>(hud as unknown as {alerts:PrioritizedHudAlert[]}).alerts;
    try{
      const w=rescueCamp(2),patients=w.pawns.filter(p=>p.state==='downed').sort((a,b)=>a.id-b.id);
      expect(patients).toHaveLength(2);
      w.tick=59;hud.update(structuredClone(w),1,60);
      expect(alerts().some(a=>!a.domain)).toBe(false);expect(started).toEqual([]);
      now=1000;w.tick=60;hud.update(structuredClone(w),1,60);
      const ranks=alerts().map(a=>CORE_ALERT_PRIORITY_RANK[coreAlertPriority(a)]);
      expect(ranks).toEqual([...ranks].sort((a,b)=>b-a));
      expect(alerts()[0]!.key).toBe('downed');
      const critical=started.filter(s=>s.priority==='critical');
      expect(critical.map(s=>s.key)).toEqual(['downed']);
      expect(started.filter(s=>s.bell)).toHaveLength(1); // one bell per 0.5 s
      // Same alerts on the next reading: nothing starts again.
      const count=started.length;now=1500;w.tick=61;hud.update(structuredClone(w),1,60);expect(started).toHaveLength(count);
      // Click: next culprit; right click: previous.
      const card=piece('hud:alert:downed')!;
      expect(card.userData.tooltip).toContain(patients[0]!.name);
      (card.userData.onClick as ()=>void)();(card.userData.onClick as ()=>void)();(card.userData.onSecondary as ()=>void)();
      expect(focus.mock.calls.map(c=>c[0])).toEqual([actorNotificationTarget(patients[0]!.id),actorNotificationTarget(patients[1]!.id),actorNotificationTarget(patients[0]!.id)]);
      expect(focus.mock.calls[0]![1]).toBe('health');
      // The new card bounced in from 300 px and settles on its place.
      const settled=card.userData.basePos.x;for(let i=0;i<200;i++)hud.animate(.05);
      expect(card.userData.basePos.x).toBeGreaterThan(settled);
      // Cadence: a snapshot within 400 ms waits for the next due frame.
      w.pawns.find(p=>p.id===patients[1]!.id)!.state='idle';
      now=1600;w.tick=62;hud.update(structuredClone(w),1,60);
      expect(alerts().find(a=>a.key==='downed')?.targets).toHaveLength(2);
      now=1950;hud.animate(.016);expect(alerts().find(a=>a.key==='downed')?.targets).toHaveLength(1);
      // A different game is adopted silently.
      const other=rescueCamp(1);other.seed=w.seed+1;other.tick=60;now=5000;const before=started.length;hud.update(other,1,60);
      expect(started).toHaveLength(before);expect(alerts().some(a=>a.key==='downed')).toBe(true);
    }finally{hud.dispose();art.dispose();}
  });
});
