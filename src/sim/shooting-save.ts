import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import type {NumericMembershipLookup} from './numeric-membership.ts';
import { huntingPermission } from './hunting-state.ts';
import { combatTarget } from './combat-target.ts';
import { validAutomaticAttack,automaticPost,automaticOwnership } from './automatic-combat-save.ts';
import { isColonist,hostileTo } from './affiliation.ts';
import { equippedWeapon,isRangedWeaponItem } from './equipment-rules.ts';
import { shootingOrderAuthority } from './shooting-state.ts';
import { validStunShape } from './melee-save.ts';
import { rangedWeaponProfile } from './ranged-statistics.ts';
import type { Cell,World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
export function validShootingShape(value:unknown,version:number,tick:number,coreNow297?:number):boolean {
 const physicalCoreNow297=validationCore297(version,tick,coreNow297);if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(physicalCoreNow297))return false;
  if(value===undefined)return true;
  if(version<56||!record(value)||!keys(value,['order','stance'])||value.order===null&&value.stance===null)return false;
  if(value.order!==null&&(!record(value.order)||!keys(value.order,['targetId','weaponId','startedDowned',...(version>=60?['auto']:[]),...(version>=79?['hunt']:[])])||!integer(value.order.targetId,1)||!integer(value.order.weaponId,1)||typeof value.order.startedDowned!=='boolean'||!validAutomaticAttack(value.order.auto,version,tick)||value.order.hunt!==undefined&&(value.order.hunt!==true||value.order.auto!==undefined||value.order.startedDowned!==false)))return false;
  const s=value.stance;if(s===null)return value.order!==null;
  if(record(s)&&'lean' in s&&(!Object.hasOwn(s,'lean')||version<238||s.phase!=='aim'||!validLeanOffset(s.lean)))return false;
  if(!record(s)||version<198&&Object.hasOwn(s,'clock')||!keys(s,['phase','startedAtCore','endsAtCore',...(s.phase==='aim'?['targetStartedDowned']:[]),...(version>=88?['weaponItem']:[]),...(version>=198?['clock']:[]),...(version>=238&&s.phase==='aim'?['lean']:[])])||s.weaponItem!==undefined&&s.weaponItem!=='bolt-action-rifle'&&!(version>=208&&s.weaponItem==='emp-launcher')&&!(version>=316&&s.weaponItem==='short-bow')&&!(version>=322&&s.weaponItem==='pump-shotgun')||!integer(s.startedAtCore,0,physicalCoreNow297)||!integer(s.endsAtCore,physicalCoreNow297+1))return false;
  if(s.phase!=='aim'&&s.phase!=='cooldown'||s.phase==='aim'&&(value.order===null||typeof s.targetStartedDowned!=='boolean'))return false;
  if(record(value.order)&&value.order.hunt&&s.weaponItem==='emp-launcher')return false;
  // EMP launcher and short bow carry their own warmup and cooldown.
  const own=s.weaponItem==='emp-launcher'||s.weaponItem==='short-bow'||s.weaponItem==='pump-shotgun';
  const emp=own?rangedWeaponProfile(s.weaponItem,'normal'):undefined;
  if(own&&!emp)return false;
  const duration=emp?(s.phase==='aim'?emp.warmupCoreTicks:emp.cooldownCoreTicks):s.phase==='aim'?(s.weaponItem?102:18):(s.weaponItem?90:96);
  if(version<198||!Object.hasOwn(s,'clock')&&s.clock===undefined)return s.endsAtCore-s.startedAtCore===duration;
  const c=s.clock;
  if(!Object.hasOwn(s,'clock')||!record(c)||Reflect.ownKeys(c).length!==2||!Object.hasOwn(c,'lastAdvancedAtCore')||!Object.hasOwn(c,'pausedCore')
    ||!integer(physicalCoreNow297,0)||c.lastAdvancedAtCore!==physicalCoreNow297||!integer(c.lastAdvancedAtCore,s.startedAtCore)
    ||!integer(c.pausedCore,0,c.lastAdvancedAtCore-s.startedAtCore))return false;
  return Number.isSafeInteger(s.startedAtCore+duration+c.pausedCore)&&s.endsAtCore-s.startedAtCore-c.pausedCore===duration;
}
/** A captured cardinal offset is history, not a new sight/path query. */
function validLeanOffset(value:unknown):value is Cell {
  return record(value)&&Reflect.ownKeys(value).length===2&&Object.hasOwn(value,'x')&&Object.hasOwn(value,'z')
    &&integer(value.x,-1,1)&&integer(value.z,-1,1)&&Math.abs(value.x)+Math.abs(value.z)===1;
}
/** Shared RAW/transport boundary. The hypothetical source stays inside the map;
 * later doors/cover/target movement do not rewrite this captured warmup fact. */
export function validShootingLeanOwner(pawn:unknown,world:Pick<World,'width'|'height'>,version:number):boolean {
  if(!record(pawn)||!record(pawn.shooting)||!record(pawn.shooting.stance)||!('lean' in pawn.shooting.stance))return true;
  const stance=pawn.shooting.stance;
  if(version<238||stance.phase!=='aim'||!Object.hasOwn(stance,'lean')||!validLeanOffset(stance.lean))return false;
  return integer(pawn.x,0,world.width-1)&&integer(pawn.z,0,world.height-1)
    &&integer(pawn.x+stance.lean.x,0,world.width-1)&&integer(pawn.z+stance.lean.z,0,world.height-1);
}
/** Numeric human orders never captured a historical target kind. The mandate
 * still bounds the known categories, and a Thing cannot become a living target. */
function historicalTargetKind(w:World,id:number):'pawn'|'animal'|'mech'|undefined {
  if(w.pawns.some(p=>p.id===id)||[w.scout,w.commercialTrip].some(g=>g&&'pawn' in g&&g.pawn.id===id)
    ||w.group&&'members' in w.group&&w.group.members.some(p=>p.id===id)||w.groupLosses?.some(l=>l.pawn.id===id)
    ||w.raids?.departed.some(d=>d.pawnId===id)||w.prisonDepartures?.some(d=>d.pawnId===id)
    ||w.visitors?.departed.some(d=>d.pawn.id===id)||w.podRescues?.departed.some(d=>d.pawn.id===id)
    ||w.piles.some(p=>p.humanCorpse?.pawnId===id))return 'pawn';
  if(w.wildlife?.animals.some(a=>a.id===id)||w.piles.some(p=>p.corpse?.animalId===id))return 'animal';
  if(w.mechanoids?.some(m=>m.id===id)||w.piles.some(p=>p.id===id&&p.mechCorpse!==undefined))return 'mech';
  return undefined;
}
/** registeredIds is the COMPLETE Thing namespace, after collective owners.
 * It is never a set of group/relationship references or a projected World. */
export function validateShooting(world:World,version:number=world.schemaVersion,registeredIds?:NumericMembershipLookup):string[] {
  const errors:string[]=[];
  for(const p of world.pawns)if(p.shooting!==undefined) {
    if(!validShootingShape(p.shooting,version,world.tick,isCorePhysicalSchema297(version)?effectiveCore297(world):undefined)||!validShootingLeanOwner(p,world,version)||!validStunShape(p.stun,version,world.tick,version>=318?120:45,isCorePhysicalSchema297(version)?effectiveCore297(world):undefined)){errors.push('Invalid shooting state for schema.');continue;}
    const {order,stance}=p.shooting;
    const suspended=version>=198&&stance?.phase==='aim'&&!!p.stun&&effectiveCore297(world)<p.stun.untilCore;
    if(order){const weapon=equippedWeapon(world,p);if(!weapon||!isRangedWeaponItem(weapon.item)||order.hunt&&weapon.item==='emp-launcher'||stance?.phase==='aim'&&(stance.weaponItem??'revolver')!==weapon.item)errors.push('Invalid ranged weapon/aim profile.');}
    if(order?.auto&&(order.startedDowned||stance?.phase==='aim'&&stance.targetStartedDowned||order.auto.kind==='draft'&&p.draft?.holdFire||order.auto.kind==='response'&&order.auto.remaining===0&&stance?.phase!=='cooldown'))errors.push('Invalid automatic shooting phase.');
    if(p.state==='dead'||p.state==='downed'||p.jobId!==null||p.haul||p.cooking||p.equipmentTask||p.tend||p.ward||p.feed||p.rescue||p.need||p.recreation.task||p.orders.active!==null||(p.priorityWork||p.orders.queue.length)&&!(version>=79&&(!order||order.hunt)))errors.push('Shooting conflicts with another activity.');
    if(order){
      const target=combatTarget(world,order.targetId);
      const legacyOwnership=order.hunt?huntingPermission(world,p,order.targetId):order.auto?automaticOwnership(world,p,order.targetId,order.auto.kind)
        :isColonist(p)?!!p.draft:world.pawns.some(t=>t.id===order.targetId&&hostileTo(p,t))||version>=194&&!p.prisoner&&!!world.mechanoids?.some(m=>m.id===order.targetId);
      if((version>=198&&!shootingOrderAuthority(world,p,order))||(!suspended&&!legacyOwnership)||(!order.auto&&p.draft?.target)||order.auto?.kind==='draft'&&!automaticPost(p)
        ||p.draft?.queue.length||p.path.length||(!suspended&&!target)||order.targetId===p.id||equippedWeapon(world,p)?.id!==order.weaponId)errors.push('Invalid shooting order ownership.');
      if(version>=198){
        if(!integer(order.targetId,1,world.nextId-1))errors.push('Invalid shooting target identity.');
        if(suspended){
          const kind=historicalTargetKind(world,order.targetId);
          if(!target&&!registeredIds||registeredIds?.has(order.targetId)&&!kind||order.hunt&&kind!==undefined&&kind!=='animal'||!isColonist(p)&&kind==='animal')errors.push('Suspended shooting history aliases another owner.');
        }
      }
    }
    if(stance&&(p.motion?.end??0)>(isCorePhysicalSchema297(version)?effectiveLocal297(world):world.tick))errors.push('Shooting stance during a captured edge.');
    if(!stance&&!p.melee?.strike&&!p.stun&&(!order||!p.motion||(p.motion.end<=(isCorePhysicalSchema297(version)?effectiveLocal297(world):world.tick))))errors.push('Shooting wait without active travel.');
  }
  return errors;
}
