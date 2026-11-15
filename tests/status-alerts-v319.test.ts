import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/index';
import {createMedicalRecord} from '../src/sim/injury-state';
import {ensureFireState} from '../src/sim/fire-rules';
import {readStatusAlerts,readInspectAlerts} from '../src/ui/status-alerts';
import {actorNotificationTarget} from '../src/ui/notification-focus';
import {fixtureBuilding} from './scenarios/deconstruction';
import {scytherCamp} from './scenarios/scyther-v213';
import {newMiniTurretState} from '../src/sim/mini-turret-state';

// Alerts lot A (Core Alert_Hypothermia): the threshold is now the serious stage
// (0.35) in air outside the safe range, instead of the former 0.04.
test('V319 hypothermia is actionable at the Core serious threshold, ordered by identity and independent of labels',()=>{
  const w=createWorld(319,32,32),[a,b,c]=w.pawns;
  for(const p of [a!,b!,c!])p.health=createMedicalRecord(w.tick);
  w.thermal={regions:[{cells:[a!,b!,c!].map(p=>p.z*w.width+p.x),temperature:-40}]};
  a!.name='<img src=x> hypothermie';a!.health!.hypothermia=350000000;b!.health!.hypothermia=900000000;c!.health!.hypothermia=349999999;
  const row=readStatusAlerts(w).find(r=>r.key==='hypothermia')!;
  expect(row.text).toBe('2 colons en hypothermie grave');expect(row.targets).toEqual([a!,b!].sort((p,q)=>p.id-q.id).map(p=>actorNotificationTarget(p.id)));expect(row.tab).toBe('health');
  w.pawns.reverse();expect(readStatusAlerts(w).find(r=>r.key==='hypothermia')!.targets).toEqual(row.targets);
});
test.each(['flu','malaria','plague'] as const)('V319 %s keeps urgent and ordinary alerts distinct and points to the real patient',kind=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!;p.health=createMedicalRecord(w.tick);
  const disease={bornAt:w.tick,severity:950000000,immunity:0,luck:1000000};if(kind==='flu')p.health.flu=disease;else p.health.immuneDiseases={[kind]:disease};
  const rows=readStatusAlerts(w);for(const key of [kind,`${kind}-critical`])expect(rows.find(r=>r.key===key)).toMatchObject({targets:[actorNotificationTarget(p.id)],tab:'health'});
  disease.immunity=1000000000;expect(readStatusAlerts(w).some(r=>r.key===`${kind}-critical`)).toBe(false);expect(readStatusAlerts(w).some(r=>r.key===kind)).toBe(true);
});
test('V319 malaria urgency preserves its distinct 91% threshold',()=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!;p.health=createMedicalRecord(w.tick);
  const disease={bornAt:w.tick,severity:909999999,immunity:0,luck:1000000};p.health.immuneDiseases={malaria:disease};
  expect(readStatusAlerts(w).some(row=>row.key==='malaria-critical')).toBe(false);
  disease.severity=910000000;expect(readStatusAlerts(w).find(row=>row.key==='malaria-critical')?.targets).toEqual([actorNotificationTarget(p.id)]);
});
test('V319 severe infection exposes its own patients rather than every colonist',()=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!,q=w.pawns[1]!;p.health=createMedicalRecord(w.tick);q.health=createMedicalRecord(w.tick);
  p.health.infections={nextId:2,immunity:0,cases:[{id:1,part:'torso',bornAt:w.tick,severity:870000000,luck:1000000}]};q.health.malnutrition=1;
  const rows=readStatusAlerts(w);expect(rows.find(r=>r.key==='infection-critical')!.targets).toEqual([actorNotificationTarget(p.id)]);expect(rows.find(r=>r.key==='malnutrition')!.targets).toEqual([actorNotificationTarget(q.id)]);
});
test('V319 food, missing beds, storage and disabled work open explicit management contexts',()=>{
  // Core Alert_LowFood only starts after 150 000 Core ticks (15 000 local).
  const w=createWorld(319,32,32);w.piles=[];w.structures=[];w.stockpiles=[];w.tick=15000;
  const rows=readStatusAlerts(w);expect(rows.find(r=>r.key==='food-reserves')).toMatchObject({targets:[],context:{panel:'assign'}});expect(rows.find(r=>r.key==='beds')).toMatchObject({targets:[],context:{panel:'architect',category:'furniture'}});expect(rows.find(r=>r.key==='no-stockpile')).toMatchObject({targets:[],context:{panel:'architect',tool:'stockpile'}});
});
// Alerts lot A: the permanent death count became Core's unburied-colonist alert.
test('V319 dead colonial bodies do not borrow a similarly named living target and lost bodies leave no alert',()=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!,q=w.pawns[2]!;p.state='dead';p.body={observedAt:w.tick,lostAt:w.tick};w.pawns[1]!.name=p.name;
  expect(readStatusAlerts(w).some(r=>r.key==='colonist-unburied')).toBe(false);
  q.state='dead';q.name=p.name;
  expect(readStatusAlerts(w).find(r=>r.key==='colonist-unburied')).toMatchObject({text:'Colon laissé sans sépulture',targets:[actorNotificationTarget(q.id)]});
});
test('V319 turret wick has a precise structure target, not a cell cycling slot',()=>{
  const w=createWorld(319,32,32),turret=fixtureBuilding(w,'mini-turret',8,8);
  // This projection fixture supplies the same public wick shape as a confirmed turret.
  Object.assign(turret,{turret:{...newMiniTurretState(),wick:{startedAtCore:w.tick*10,endCore:w.tick*10+100}}});
  const row=readStatusAlerts(w).find(r=>r.key===`turret-wick:${turret.id}`);
  expect(row?.targets[0]).toMatchObject({kind:'object',object:{kind:'structure',id:turret.id},cell:{x:8,z:8}});
});
test('V319 blight selects the real resource while ground fires remain cells and attached fires select actors',()=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!,r=w.resources[0]!;r.blight={since:w.tick,severity:.1,lastHarmTick:w.tick,nextCheck:w.tick+200,rng:1};
  const fires=ensureFireState(w);const base={size:.5,bornCore:0,nextPulseCore:15,complexCore:150,spreadCore:300,x:5,z:5};fires.items=[{id:w.nextId++,...base},{id:w.nextId++,...base,attachedPawnId:p.id}];
  const rows=readInspectAlerts(w);expect(rows['inspect-blight']?.targets[0]).toMatchObject({kind:'object',object:{kind:'resource',id:r.id}});expect(rows['inspect-fire']?.targets.map(t=>t.kind)).toEqual(['cell','actor']);expect(rows['inspect-fire']?.targets[1]).toEqual(actorNotificationTarget(p.id));
});
test('V319 combined threat cycles human and machine targets without hiding the second physical type',()=>{
  const {world:w,actor}=scytherCamp(),p=w.pawns[0]!;p.faction='outlaws';p.state='idle';
  const targets=readInspectAlerts(w)['inspect-threat']!.targets;expect(targets).toContainEqual(actorNotificationTarget(p.id));expect(targets).toContainEqual(actorNotificationTarget(actor.id));
});
test('V319 reading every notification leaves the complete snapshot unchanged',()=>{
  const w=createWorld(319,32,32),p=w.pawns[0]!;p.health=createMedicalRecord(w.tick);p.health.hypothermia=40000000;
  const before=JSON.stringify(w);readStatusAlerts(w);readInspectAlerts(w);expect(JSON.stringify(w)).toBe(before);
});
