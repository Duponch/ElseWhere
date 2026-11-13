import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isMaceItem269} from './mace-content-269.ts';
import { isBedKind } from './bed-kinds.ts';
import { bombRefugeRouteTarget } from './bomb-refuge-route.ts';
import { validApparelShape,validateApparel } from './apparel-save.ts';
import { isColonist } from './affiliation.ts';
import { patientClaimed } from './care-access.ts';
import { validWeaponShape,validateEquipment } from './equipment-save.ts';
import { groundCapacity,groundPile } from './ground-placement.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import { ITEM_DEFINITIONS } from './items.ts';
import { reservedSource } from './materials.ts';
import { adjacent } from './pathfinding.ts';
import { prisonRoom } from './prison-space.ts';
import { PRISON_RAPPORTS,PRISON_RAPPORT_TICKS,prisonDay } from './prisoner-state.ts';
import { prisonBreakActive } from './prison-break-state.ts';
import type { Cell,MaterialPile,Pawn,World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:readonly string[])=>Object.keys(v).every(k=>allowed.includes(k));
const cell=(v:unknown,w:World):v is Cell=>object(v)&&Object.keys(v).length===2&&integer(v.x,0,w.width-1)&&integer(v.z,0,w.height-1);
const edge=(v:Cell,w:World)=>v.x===0||v.z===0||v.x===w.width-1||v.z===w.height-1;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;

function validBreakout(value:unknown,version:number,capturedAt:number,w:World):boolean {
  if(value===undefined)return true;
  if(version<204||!object(value)||!keys(value,['rng','lastAt','active'])||!integer(value.rng,1,0xffffffff)
    ||value.lastAt!==undefined&&!integer(value.lastAt,capturedAt,w.tick))return false;
  const active=value.active;
  return active===undefined||object(active)&&Object.keys(active).length===2&&keys(active,['startedAt','initiatorId'])
    &&integer(active.startedAt,capturedAt,w.tick)&&active.startedAt===value.lastAt&&integer(active.initiatorId,1,w.nextId-1);
}

/** The breakout owns travel and its automatic melee, never a colony or care
 * service. This local guard also runs before a snapshot candidate is accepted. */
function validActiveBreakoutPawn(p:Pawn):boolean {
  return !isColonist(p)&&!['dead','downed','sleeping','eating','resting','recreating'].includes(p.state)
    &&(p.state!=='working'||!!p.burning)&&!p.health?.death&&p.prisoner?.releasedAt===undefined
    &&!p.mental?.crisis&&!p.health?.flu?.vomit&&!(p.health?.foodPoisoning?.vomit||p.health?.cryptosleepSickness?.vomit||p.health?.toxicBuildup?.vomit||p.health?.toxicBuildup?.vomitRequestedAt!==undefined)&&!p.health?.immuneDiseases?.malaria?.vomit&&!p.interruptedCargo
    &&!p.need&&!p.medicalSleep&&!p.recruitment&&!p.draft&&!p.flee&&!p.hostilityResponse&&p.jobId===null
    &&p.orders?.active===null&&Array.isArray(p.orders.queue)&&!p.orders.queue.length&&!p.priorityWork&&!p.haul&&!p.cooking
    &&!p.rescue&&!p.tend&&!p.feed&&!p.ward&&!p.surgery&&!p.surgeryRequest&&!p.equipmentTask&&!p.recreation?.task&&!p.research&&!p.hunting
    &&!p.shooting?.order&&!p.tactics&&(!p.melee?.order||p.melee.order.auto==='prison-break');
}

/** Cross-person care claims are checked once, only for the new active domain. */
export function validPrisonBreakBindings(w:World,version:number):boolean {
  if(version<204)return true;
  const active=new Set(w.pawns.filter(prisonBreakActive).map(p=>p.id));
  if(!active.size)return true;
  return !w.piles.some(p=>p.owner.type==='equipment'&&active.has(p.owner.pawnId))
    &&w.pawns.every(p=>![p.ward,p.feed,p.tend,p.surgery,p.rescue].some(t=>t&&active.has(t.patientId)));
}

/** Same dossier shape, also used for the real dormant former-prisoner record.
 * Detached conversation history may predate today; no chat is replayed. */
export function validPrisonerStateRecord259(s:unknown,version:number,w:World,detached=false):boolean {
  if(!object(s)||!keys(s,['capturedAt','initialResistance','resistance','mode','lastChatTick','chatDay','chatCount','rng','escape',...(version>=202?['releasedAt']:[]),...(version>=204?['breakout']:[])])
    ||!integer(s.capturedAt,0,w.tick)||!integer(s.initialResistance,7,12)||typeof s.resistance!=='number'||!Number.isFinite(s.resistance)||s.resistance<0||s.resistance>s.initialResistance
    ||typeof s.mode!=='string'||!['maintain','reduce','recruit',...(version>=202?['release']:[])].includes(s.mode)||!integer(s.rng,1,0xffffffff)||!integer(s.chatDay,0,prisonDay(w))||(!detached&&s.chatDay!==prisonDay(w))||!integer(s.chatCount,0,2)
    ||s.lastChatTick!==undefined&&!integer(s.lastChatTick,s.capturedAt,w.tick)||s.chatCount>0&&s.lastChatTick===undefined
    ||s.escape!==undefined&&(!cell(s.escape,w)||!edge(s.escape,w))
    ||s.releasedAt!==undefined&&(!integer(s.releasedAt,s.capturedAt,w.tick)||s.mode!=='release'||s.lastChatTick!==undefined&&Number(s.lastChatTick)>s.releasedAt)
    ||!validBreakout(s.breakout,version,s.capturedAt,w))return false;
  return !detached||!object(s)||s.escape===undefined&&(!object(s.breakout)||s.breakout.active===undefined);
}

/** Optional V86 records stay absent on older schemas, before migration. */
export function validPrisonerPawnShape(p:Record<string,unknown>,version:number,w:World,detached259=false):boolean {
  if(version<86)return p.prisoner===undefined&&p.ward===undefined&&p.recruitment===undefined;
  const s=p.prisoner;
  if(s!==undefined&&!validPrisonerStateRecord259(s,version,w,version>=259&&detached259&&Object.hasOwn(p,'worldAffiliation259')))return false;
  const active=version>=204&&object(s)&&object(s.breakout)&&s.breakout.active!==undefined;
  const colony=object(s)&&isColonist(p as unknown as Pawn);
  if(colony&&(version<213||!['maintain','release'].includes(String(s.mode))||['escape','releasedAt','breakout'].some(k=>Object.hasOwn(s,k))
    ||p.raid||p.visitor||p.podRescue||p.state==='working'&&!p.burning||p.draft||p.flee||p.hostilityResponse||p.jobId!==null
    ||!object(p.orders)||p.orders.active!==null||!Array.isArray(p.orders.queue)||p.orders.queue.length||p.priorityWork||p.haul||p.cooking||p.rescue||p.tend||p.feed||p.ward||p.surgery||p.equipmentTask||p.recreation&&object(p.recreation)&&p.recreation.task||p.deepWork||p.research||p.hunting||p.animalCare||p.animalHandling||p.burial||p.cleaning||p.firefighting
    ||object(p.shooting)&&p.shooting.order||object(p.melee)&&p.melee.order||p.tactics||p.trade))return false;
  if(colony&&w.piles.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id))return false;
  if(active&&!validActiveBreakoutPawn(p as unknown as Pawn))return false;
  if(object(p.melee)&&object(p.melee.order)&&p.melee.order.auto==='prison-break'&&!active)return false;
  const r=p.recruitment;
  if(r!==undefined&&(!object(r)||!keys(r,['capturedAt','recruitedAt','fromFaction','raidGroup'])||!integer(r.capturedAt,0,w.tick)||!integer(r.recruitedAt,r.capturedAt,w.tick)||r.fromFaction!=='outlaws'||r.raidGroup!==undefined&&!integer(r.raidGroup,1)))return false;
  if(colony&&object(r)&&(Number(r.recruitedAt)>Number(s.capturedAt)||r.raidGroup!==undefined&&(!w.raids||Number(r.raidGroup)>w.raids.serial)))return false;
  const t=p.ward;if(t===undefined)return true;
  if(!object(t)||!integer(t.patientId,1,w.nextId-1)||!cell(t.spot,w))return false;
  if(t.kind==='food')return keys(t,['kind','patientId','sourcePileId','carryPileId','quantity','spot','phase'])&&integer(t.sourcePileId,1,w.nextId-1)&&integer(t.quantity,1,75)
    &&(t.phase==='pickup'?t.carryPileId===null:t.phase==='deliver'&&integer(t.carryPileId,1,w.nextId-1));
  return t.kind==='chat'&&keys(t,['kind','patientId','spot','phase','progress','rapports'])&&typeof t.phase==='string'&&['approach','rapport','closing'].includes(t.phase)&&integer(t.progress,0,PRISON_RAPPORT_TICKS-1)
    &&integer(t.rapports,0,PRISON_RAPPORTS)&&(t.phase!=='closing'||t.rapports===PRISON_RAPPORTS);
}

function validateDepartures(w:World,version:number,ids:Set<number>):string[] {
  const departures:unknown=w.prisonDepartures;if(departures===undefined)return [];
  if(version<86)return ['Legacy save contains prisoner departures.'];
  if(!Array.isArray(departures)||departures.length>w.width*w.height)return ['Invalid prisoner departures.'];
  const errors:string[]=[];
  for(const d of departures){
    if(!object(d)||!keys(d,['pawnId','name','capturedAt','tick','cell','items',...(version>=202?['reason','releasedAt']:[])])||!integer(d.pawnId,1,w.nextId-1)||ids.has(d.pawnId)||typeof d.name!=='string'||!d.name.trim()||d.name.length>80
      ||!integer(d.capturedAt,0,w.tick)||!integer(d.tick,d.capturedAt,w.tick)||!cell(d.cell,w)||!edge(d.cell,w)||!Array.isArray(d.items)||d.items.length>32768
      ||(d.reason===undefined?d.releasedAt!==undefined:d.reason!=='released'||!integer(d.releasedAt,d.capturedAt,d.tick))){errors.push('Invalid prisoner departure.');continue;}
    ids.add(d.pawnId);let valid=true;
    for(const item of d.items){
      if(!object(item)||!keys(item,['id','kind','item','quantity','owner','apparel','weapon'])||!integer(item.id,1,w.nextId-1)||ids.has(item.id)||!object(item.owner)||!keys(item.owner,['type','pawnId'])||item.owner.pawnId!==d.pawnId
        ||!(item.kind==='weapon'&&(['revolver',...(version>=88?['bolt-action-rifle','plasteel-knife']:[]),...(version>=208?['emp-launcher']:[]),...(version>=316?['short-bow']:[])].includes(String(item.item))||version>=269&&isMaceItem269(item.item)||isSchema272OrLater(version)&&isSpearItem272(item.item)||version>=270&&isLongswordItem270(item.item))&&item.owner.type==='equipment'||item.kind==='apparel'&&item.owner.type==='apparel')||!validWeaponShape(item,version)||!validApparelShape(item,version)){valid=false;continue;}
      ids.add(item.id);
    }
    if(!valid){errors.push('Invalid exported prisoner possessions.');continue;}
    // Apply the same equipment/layer checks as actors on the map, with no
    // invented physiology or task inherited from an unrelated current pawn.
    const owner={id:d.pawnId,state:'idle',health:undefined} as Pawn;
    const exported={...w,pawns:[owner],piles:d.items as MaterialPile[]};
    errors.push(...validateApparel(exported),...validateEquipment(exported));
  }
  return errors;
}

/** Shapes passed first. A missing enclosure is a real breach to process, not a
 * reason to delete the saved person or reject a once-valid prisoner bed. */
export function validatePrisoners(w:World,version:number,ids:Set<number>):string[] {
  const errors=validateDepartures(w,version,ids);if(version<86)return errors;
  if(!validPrisonBreakBindings(w,version))errors.push('Active prison break conflicts with a care claim.');
  for(const p of w.pawns){
    if(p.prisoner){
      const active=version>=204&&prisonBreakActive(p);
      if(active&&!validActiveBreakoutPawn(p))errors.push('Invalid active prison break ownership.');
      const colony=version>=213&&isColonist(p);
      if(colony&&!validPrisonerPawnShape(p as unknown as Record<string,unknown>,version,w))errors.push('Invalid local colony detention.');
      if(isColonist(p)&&!colony||p.state==='working'&&!(version>=87&&p.burning)||p.recruitment&&!colony||p.draft||p.flee||p.hostilityResponse||p.jobId!==null||p.orders.active!==null||p.orders.queue.length||p.priorityWork||p.haul||p.cooking||p.rescue||p.tend||p.feed||p.ward||p.equipmentTask||p.recreation.task||p.deepWork||p.research||p.hunting
        ||p.shooting?.order||p.melee?.order&&!(active&&p.melee.order.auto==='prison-break')||p.tactics)errors.push('Prisoner retains a colony or combat mandate.');
      const escape=bombRefugeRouteTarget(p,p.prisoner.escape,version);
      // A later collapse does not revoke an actual release. Ordinary rescue
      // and medical-rest validators still own the bed and the physical route.
      const releasedCare=version>=202&&p.prisoner.releasedAt!==undefined&&!!p.need;
      if(p.prisoner.escape&&(p.state==='dead'||p.need&&!releasedCare||!(active&&p.melee)&&!releasedCare&&!(version>=87&&p.burning)&&p.path.length&&(!escape||!same(p.path.at(-1)!,escape))))errors.push('Invalid prisoner escape intent or route.');
      if(w.piles.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id))errors.push('Captured prisoner retains a weapon.');
    }
    if(p.recruitment&&(!isColonist(p)||p.prisoner&&!(version>=213&&isColonist(p))||p.raid||p.recruitment.raidGroup!==undefined&&(!w.raids||p.recruitment.raidGroup>w.raids.serial)))errors.push('Invalid recruitment provenance.');
    const beds=[p.bedId,...p.need?.kind==='sleep'?[p.need.bedId]:[]];
    for(const bedId of beds)if(bedId!==null){const bed=[...w.structures,...w.packed.map(p=>p.building)].find(b=>b.id===bedId&&isBedKind(b.kind)&&(version>=187||b.kind==='bed'));if(bed&&!!bed.prisoner!==!!p.prisoner)errors.push('Bed role disagrees with its occupant.');}
    const t=p.ward;if(!t)continue;const patient=w.pawns.find(q=>q.id===t.patientId);
    if(!isColonist(p)||p.prisoner||p.priorities.warden===0||medicalWorkRefusal(p)||p.mental?.crisis||p.draft||p.interruptedCargo||p.orders.active!==null||p.jobId!==null||p.need||p.haul||p.cooking||p.rescue||p.tend||p.feed||p.recreation.task||p.equipmentTask||p.deepWork||p.research||p.hunting)errors.push('Warden task conflicts with actor activity.');
    if(!patient||patient===p||patient.state==='dead'||patientClaimed(w,t.patientId,p)||w.pawns.some(a=>a.rescue?.patientId===t.patientId)||t.kind==='chat'&&patient.prisoner?.mode==='release'
      ||(t.kind==='chat'&&t.phase==='closing'?!(patient.prisoner||patient.recruitment):!patient.prisoner||!!patient.prisoner.escape))errors.push('Invalid or duplicate warden patient.');
    if(t.kind==='food'){
      const food=w.piles.find(i=>i.id===(t.phase==='pickup'?t.sourcePileId:t.carryPileId));
      if(!food||food.kind!=='food'||t.quantity>ITEM_DEFINITIONS[food.item].maxIngest||(t.phase==='pickup'?food.owner.type!=='ground'||reservedSource(w,food.id)>food.quantity:food.owner.type!=='pawn'||food.owner.pawnId!==p.id||food.quantity!==t.quantity))errors.push('Invalid warden food reservation or ownership.');
      const room=patient&&prisonRoom(w,patient);
      if(!room||prisonRoom(w,t.spot)!==room||groundPile(w,t.spot)||food&&groundCapacity(w,t.spot,food.item,p.id)<t.quantity)errors.push('Invalid warden food destination.');
      if(p.state!=='moving')errors.push('Invalid warden delivery phase.');
    }else if(t.phase==='approach'){
      if(p.state!=='moving')errors.push('Invalid warden approach phase.');
    }else if(p.state!=='working'||p.moveCooldown>0||p.path.length||!same(p,t.spot)||t.phase==='rapport'&&patient&&!adjacent(p,patient))errors.push('Warden conversation lacks physical service.');
  }
  return errors;
}
