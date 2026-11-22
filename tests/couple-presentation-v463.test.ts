import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health';
import {fixtureBuilding} from './scenarios/deconstruction';
import {HUMAN_YEAR_TICKS} from '../src/sim/human-age';
import {bedSlotBodyCenter,bedSlotCell} from '../src/sim/bed-slots';
import {addMaterial} from '../src/sim/materials';
import {PawnLayer,bedLyingOffset} from '../src/render/PawnLayer';
import {WORLD_SCALE} from '../src/world/scale';
import {portraitExpressionOf} from '../src/ui/pawn-portrait';
import {coupleActivity285} from '../src/ui/couple-activity-285';
import {specificWorkActivity} from '../src/ui/work-activity';
import {PresentationChanges} from '../src/bridge/presentation-changes';

/** Two actual fixture adults already engaged at a built double-bed's real
 * cells. This checks confirmed presentation, not admission or played time. */
function pair(orientation:0|1|2|3=0){
 const w=medicalCamp(2),a=w.pawns[0]!,b=w.pawns[1]!,bed=fixtureBuilding(w,'double-bed',14,14);bed.orientation=orientation;
 w.relationships={links:[{kind:'lover',aId:Math.min(a.id,b.id),bId:Math.max(a.id,b.id),recordedAt:w.tick}]};
 for(const[p,other,slot]of [[a,b,0],[b,a,1]]as const){
  const cell=bedSlotCell(bed,slot);if(!cell)throw Error('Actual slot missing');
  delete p.nativeHuman;delete p.health;delete p.medicalSleep;
  p.age={biologicalTicks:30*HUMAN_YEAR_TICKS,chronologicalTicks:30*HUMAN_YEAR_TICKS};
  Object.assign(p,cell,{bedId:bed.id,bedSlot:slot,state:'idle',need:null,jobId:null,haul:null,cooking:null,path:[],moveCooldown:0,motion:null});
  p.orders.active=null;p.orders.queue=[];p.recreation.task=null;
  p.coupleClock285={revision:1,rng:p.id,lastAttemptAtCore:w.tick*10};
  p.coupleTask285={revision:1,otherId:other.id,initiatorId:a.id,bedId:bed.id,slot,enteredAtCore:w.tick*10,endsAtCore:w.tick*10+1000};
 }
 return{w,a,b,bed};
}

test.each([0,1,2,3]as const)('two awake rigs use their original bed slots, height and rotation%i without changing the world or equipment',orientation=>{
 const{w,a,b,bed}=pair(orientation);addMaterial(w,'weapon',1,{type:'equipment',pawnId:a.id},'bolt-action-rifle');
 const before=JSON.stringify(w),layer=new PawnLayer();
 try{
  layer.update(w,1,true);const g=layer.feedbackSource!;
  for(const[index,p,slot]of [[0,a,0],[1,b,1]]as const){
   const body=bedSlotBodyCenter(bed,slot)!,shift=bedLyingOffset(bed,layer.lieHeadExtent),center={x:body.x+shift.x,z:body.z+shift.z};
   expect(g.getAttribute('aMotion').getZ(index)).toBe(1); // Existing reclining-awake rig, not sleep18.
   expect(g.getAttribute('aTo').getX(index)).toBeCloseTo(center.x,6);expect(g.getAttribute('aTo').getZ(index)).toBeCloseTo(center.z,6);
   expect(g.getAttribute('aTo').getY(index)).toBeCloseTo(WORLD_SCALE.bedSurfaceHeight,6);
   expect(Math.sin(g.getAttribute('aTo').getW(index))).toBeCloseTo(Math.sin(orientation*Math.PI/2),6);
   expect(Math.cos(g.getAttribute('aTo').getW(index))).toBeCloseTo(Math.cos(orientation*Math.PI/2),6);
   expect(portraitExpressionOf(p)).toBe('awake');expect(p.state).toBe('idle');expect(p.medicalSleep).toBeUndefined();
  }
  const gear=g.getAttribute('aEquipment'),equipment=[gear.getX(0),gear.getY(0),gear.getZ(0),gear.getW(0)];
  expect(equipment[0]).toBeGreaterThan(0);expect(JSON.stringify(w)).toBe(before);
  // Existing sleep rendering keeps the exact same equipment payload. The
  // common reclining transform handles limbs, carried gear and shadows.
  for(const p of[a,b]){delete p.coupleTask285;p.state='sleeping';p.need={kind:'sleep',phase:'sleep',bedId:bed.id,target:{x:p.x,z:p.z}};}
  layer.update(w,1,true);const slept=layer.feedbackSource!.getAttribute('aEquipment');
  expect([slept.getX(0),slept.getY(0),slept.getZ(0),slept.getW(0)]).toEqual(equipment);expect(layer.feedbackSource!.getAttribute('aMotion').getZ(0)).toBe(18);
 }finally{layer.dispose();}
});

test('activity reads the real current local name and only confirmed SIM duration, with a sober absent-partner fallback',()=>{
 const{w,a,b}=pair(),before=JSON.stringify(w),view=coupleActivity285(w,a)!;
 expect(view.label).toBe(`Moment intime avec ${b.name}`);expect(specificWorkActivity(w,a)).toBe(view.label);expect(view.remainingCore).toBe(1000);expect(view.durationCore).toBe(1000);
 for(let i=0;i<5;i++)expect(coupleActivity285(w,a)).toEqual(view);expect(JSON.stringify(w)).toBe(before);
 b.name='Aube';expect(coupleActivity285(w,a)!.label).toBe('Moment intime avec Aube');w.tick+=5;expect(coupleActivity285(w,a)!.remainingCore).toBe(950);
 w.pawns=w.pawns.filter(p=>p!==b);expect(coupleActivity285(w,a)!.label).toBe('Moment intime');
});

test('physical loss of the bed place removes the activity and reclining projection even while a stale task remains',()=>{
 const{w,a}=pair(),layer=new PawnLayer();a.x++;
 const before=JSON.stringify(w);
 try{expect(coupleActivity285(w,a)).toBeUndefined();layer.update(w,1,true);expect(layer.feedbackSource!.getAttribute('aMotion').getZ(0)).toBe(0);expect(JSON.stringify(w)).toBe(before);}finally{layer.dispose();}
});

test('discrete task entry and exit publish without treating private RNG or elapsed opportunity clocks as visual changes',()=>{
 const{w,a,b}=pair(),changes=new PresentationChanges(),task=a.coupleTask285!;
 delete a.coupleTask285;delete b.coupleTask285;expect(changes.capture(w)).toBe(true);expect(changes.capture(w)).toBe(false);
 a.coupleClock285!.rng=123;a.coupleClock285!.nextAllowedAtCore=w.tick*10+1000;expect(changes.capture(w)).toBe(false);
 a.coupleTask285=task;expect(changes.capture(w)).toBe(true);expect(changes.capture(w)).toBe(false);
 a.coupleTask285.slot=1;expect(changes.capture(w)).toBe(true);delete a.coupleTask285;expect(changes.capture(w)).toBe(true);
});
