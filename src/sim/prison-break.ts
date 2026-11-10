import {assignPileOwner} from './pile-index.ts';
import { isBedKind } from './bed-kinds.ts';
import { isColonist } from './affiliation.ts';
import { isRoomDoor } from './door-rules.ts';
import { pawnBody } from './health-rules.ts';
import { interruptWork } from './interrupted-cargo.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { clearQueuedOrders } from './player-orders.ts';
import { capturePrisonTopology,prisonRoom } from './prison-space.ts';
import { carrierOf } from './rescue-state.ts';
import { PRISON_BREAK_BASE_MTB_DAYS,PRISON_BREAK_CHECK_INTERVAL,PRISON_BREAK_JOIN_RADIUS,nextPrisonBreakRandom,prisonBreakActive,prisonBreakHistoryFactor,seedPrisonBreak,type PrisonBreakState } from './prison-break-state.ts';
import type { RoomSpace,RoomTopology } from './room-topology.ts';
import { planCommandDrops,releaseWork,type DropPlan } from './work-release.ts';
import { TICKS_PER_DAY,type Pawn,type World } from './types.ts';

const safeClock=(w:World)=>Number.isSafeInteger(w.tick)&&w.tick>=0&&Number.isSafeInteger(w.tick*10+2500);
function participantReady(world:World,p:Pawn,ignoreAsleep:boolean):boolean {
  return world.pawns.includes(p)&&!!p.prisoner&&p.prisoner.releasedAt===undefined&&!prisonBreakActive(p)
    &&!(world.schemaVersion>=213&&isColonist(p))
    &&p.state!=='dead'&&p.state!=='downed'&&!p.health?.death&&!p.mental?.crisis&&!p.interruptedCargo
    &&!p.health?.flu?.vomit&&!(p.health?.foodPoisoning?.vomit||p.health?.cryptosleepSickness?.vomit||p.health?.toxicBuildup?.vomit||p.health?.toxicBuildup?.vomitRequestedAt!==undefined)&&!p.health?.immuneDiseases?.malaria?.vomit&&!carrierOf(world,p.id)
    &&pawnBody(p).canBeAwake&&pawnBody(p).capacities.moving>0
    &&(ignoreAsleep||p.state!=='sleeping'&&!p.medicalSleep);
}
function exteriorDoorCount(world:World,room:RoomSpace,map:RoomTopology):number {
  let count=0;
  for(const door of world.structures)if(isRoomDoor(door.kind)) {
    const sides=[[0,-1],[1,0],[0,1],[-1,0]].map(([dx,dz])=>map.at(door.x+dx!,door.z+dz!));
    if(sides.some(s=>s===room)&&sides.some(s=>s?.kind==='space'&&s!==room))count++;
  }
  return count;
}

/** Prospective admission only. Loading a historical save does not roll or
 * invent participation, and this never touches either existing random stream. */
export function adoptPrisonBreaks(world:World):void {
  if(world.schemaVersion<204||!safeClock(world))return;
  for(const p of world.pawns)if(p.prisoner&&!p.prisoner.breakout&&!(world.schemaVersion>=213&&isColonist(p)))
    p.prisoner.breakout={rng:seedPrisonBreak(world.seed,p.id,p.prisoner.capturedAt)};
}

export function prisonBreakMtbDays(world:World,p:Pawn,ignoreAsleep=false):number {
  if(world.schemaVersion<204||!safeClock(world)||!participantReady(world,p,ignoreAsleep))return -1;
  const map=capturePrisonTopology(world),room=prisonRoom(world,p,map);if(!room)return -1;
  const moving=Math.max(.01,Math.min(1,pawnBody(p).capacities.moving)),doors=exteriorDoorCount(world,room,map);
  const last=p.prisoner!.breakout?.lastAt,history=last===undefined?1:prisonBreakHistoryFactor((world.tick-last)/TICKS_PER_DAY);
  return PRISON_BREAK_BASE_MTB_DAYS/moving/(doors||1)*history;
}

/** Stops only the escape mandate. A committed movement edge or strike recovery
 * remains physical; history is retained if the prisoner record still exists. */
export function endPrisonBreak(world:World,p:Pawn):void {
  const state=p.prisoner?.breakout,owned=!!state?.active||p.melee?.order?.auto==='prison-break';
  if(!owned)return;
  if(state)delete state.active;
  if(p.melee?.order?.auto==='prison-break')cancelMelee(p);
  for(const actor of world.pawns)if(actor!==p){
    const melee=actor.melee?.order;
    if(melee&&!melee.structure&&melee.targetId===p.id&&(melee.auto==='draft'||melee.auto==='response')){cancelMelee(actor);actor.path=[];}
    const shot=actor.shooting?.order;
    if(shot?.targetId===p.id&&(shot.auto?.kind==='draft'||shot.auto?.kind==='response'))cancelShooting(actor);
  }
  for(const s of world.structures)if(s.turret?.targetKey===`pawn:${p.id}`){s.turret.targetKey=null;s.turret.warmup=null;}
  if(p.prisoner)delete p.prisoner.escape;
  p.path=[];p.planCooldown=0;p.needCooldown=0;
  if(p.state!=='dead'&&p.state!=='downed'&&!p.need)p.state=p.moveCooldown>0?'moving':'idle';
}
export function reconcilePrisonBreaks(world:World):void {
  if(world.schemaVersion<204)return;
  for(const p of world.pawns)if(prisonBreakActive(p)) {
    if(p.state==='dead'||p.state==='downed'||p.health?.death||p.prisoner!.releasedAt!==undefined||carrierOf(world,p.id)
      ||p.mental?.crisis||p.interruptedCargo||p.need||p.health?.flu?.vomit||(p.health?.foodPoisoning?.vomit||p.health?.cryptosleepSickness?.vomit||p.health?.toxicBuildup?.vomit||p.health?.toxicBuildup?.vomitRequestedAt!==undefined)||p.health?.immuneDiseases?.malaria?.vomit)endPrisonBreak(world,p);
  }else if(p.melee?.order?.auto==='prison-break')endPrisonBreak(world,p);
}

/** Core samples nearby rooms, then makes Lord groups through its region/path
 * graph. Our rooms have no Lord or region traversal: retain nearby enclosed
 * prison rooms independently in cell-index order and share the initiator ID.
 * Each participant's ordinary escape/navigation owns its actual route. */
export function startPrisonBreak(world:World,initiator:Pawn):boolean {
  if(prisonBreakMtbDays(world,initiator)<0)return false;
  const map=capturePrisonTopology(world),initialRoom=prisonRoom(world,initiator,map)!;
  const shadow:World={...world,piles:world.piles.map(p=>({...p,owner:{...p.owner}})),packed:world.packed.map(p=>({...p,owner:{...p.owner}}))};
  const plans=new Map<number,DropPlan>();
  const prepare=(p:Pawn):boolean=>{
    const drops=planCommandDrops(shadow,{type:'clear-orders',pawnId:p.id});if(!drops)return false;
    plans.set(p.id,drops);
    for(const [id,cell] of drops) {
      const pile=shadow.piles.find(q=>q.id===id);if(pile)assignPileOwner(pile,{type:'ground',x:cell.x,z:cell.z});
      const pack=shadow.packed.find(q=>q.building.id===id);if(pack)assignPileOwner(pack,{type:'ground',x:cell.x,z:cell.z});
    }
    return true;
  };
  // A full-floor initiator does not mutate the room lottery or the meal.
  if(!prepare(initiator))return false;
  const existing=initiator.prisoner!.breakout,preview:PrisonBreakState={rng:existing?.rng??seedPrisonBreak(world.seed,initiator.id,initiator.prisoner!.capturedAt)};
  const random=()=>{const next=nextPrisonBreakRandom(preview.rng);preview.rng=next.rng;return next.value;};
  const possible=new Map<number,RoomSpace>();
  for(const p of world.pawns)if(p.prisoner){const r=map.at(p.x,p.z);if(r?.kind==='space'&&!r.touchesMapEdge)possible.set(r.id,r);}
  for(const bed of world.structures)if(isBedKind(bed.kind)&&bed.prisoner){const r=map.at(bed.x,bed.z);if(r?.kind==='space'&&!r.touchesMapEdge)possible.set(r.id,r);}
  const nearby=new Set<number>(),radius=PRISON_BREAK_JOIN_RADIUS;
  for(let z=Math.max(0,initiator.z-radius);z<=Math.min(world.height-1,initiator.z+radius);z++)
    for(let x=Math.max(0,initiator.x-radius);x<=Math.min(world.width-1,initiator.x+radius);x++)if((x-initiator.x)**2+(z-initiator.z)**2<=radius*radius) {
      const room=map.at(x,z);if(room?.kind==='space'&&possible.has(room.id))nearby.add(room.id);
    }
  const rooms=new Set([initialRoom.id]);
  for(const id of [...nearby].sort((a,b)=>a-b))if(id!==initialRoom.id&&random()<.5)rooms.add(id);
  const participants=[initiator];
  for(const p of [...world.pawns].sort((a,b)=>a.id-b.id))if(p!==initiator&&participantReady(world,p,true)) {
    const room=map.at(p.x,p.z);if(room?.kind==='space'&&rooms.has(room.id)&&prepare(p))participants.push(p);
  }
  // Release participants first using their jointly reserved cells. Staff
  // interruptions then see these deposits and can retain cargo if necessary.
  for(const p of participants) {
    if(!releaseWork(world,p,plans.get(p.id)))throw new Error('Admitted prison-break deposit changed during commit.');
    clearQueuedOrders(world,p);delete p.priorityWork;delete p.medicalSleep;
    p.prisoner!.breakout??={rng:seedPrisonBreak(world.seed,p.id,p.prisoner!.capturedAt)};
    const state=p.prisoner!.breakout!;
    state.lastAt=world.tick;state.active={startedAt:world.tick,initiatorId:initiator.id};
    delete p.prisoner!.escape;p.path=[];p.planCooldown=0;p.needCooldown=0;
    p.state=p.moveCooldown>0?'moving':'idle';
  }
  initiator.prisoner!.breakout!.rng=preview.rng;
  const ids=new Set(participants.map(p=>p.id));
  for(const actor of world.pawns)if(actor.ward&&ids.has(actor.ward.patientId)||actor.rescue&&ids.has(actor.rescue.patientId)
    ||actor.tend&&ids.has(actor.tend.patientId)||actor.feed&&ids.has(actor.feed.patientId)||actor.surgery&&ids.has(actor.surgery.patientId))interruptWork(world,actor);
  world.events.push({tick:world.tick,type:'need',message:`Révolte de prison : ${participants.map(p=>p.name).join(', ')} ${participants.length===1?'tente':'tentent'} de s’échapper.`});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
  return true;
}

/** One stable individual phase per 250 local ticks. Active reconciliation is
 * separate from the private lottery and never retries missed historical rolls. */
export function advancePrisonBreaks(world:World):void {
  if(world.schemaVersion<204||!safeClock(world))return;
  adoptPrisonBreaks(world);reconcilePrisonBreaks(world);
  for(const p of world.pawns)if(p.prisoner?.breakout&&!prisonBreakActive(p)&&world.tick%PRISON_BREAK_CHECK_INTERVAL===p.id%PRISON_BREAK_CHECK_INTERVAL) {
    const mtb=prisonBreakMtbDays(world,p);if(mtb<0)continue;
    const state=p.prisoner.breakout,next=nextPrisonBreakRandom(state.rng);state.rng=next.rng;
    if(next.value<PRISON_BREAK_CHECK_INTERVAL/(TICKS_PER_DAY*mtb))startPrisonBreak(world,p);
  }
}
