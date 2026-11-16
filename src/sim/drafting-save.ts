import {isSchema277OrLater} from './schema-compatibility-257.ts';
import { hasForcedConsumeMarker,validForcedConsumePawnShape } from './consume-save.ts';
import { DRAFT_QUEUE_LIMIT,sameCell } from './drafting-rules.ts';
import type { World } from './types.ts';
import { draftTurretService } from './mini-turret-reload.ts';
import { validTendShape } from './care-save.ts';
import { isDraftedRescue } from './rescue.ts';
import { isDraftedEquipment346 } from './drafted-orders-346.ts';

export function validDraftShape(value:unknown,version:number,world:{width:number;height:number;tick:number}):boolean {
  if(value===undefined)return true;
  if(version<53||!value||typeof value!=='object'||Array.isArray(value))return false;
  const d=value as Record<string,unknown>;
  const cell=(v:unknown)=>{if(!v||typeof v!=='object'||Array.isArray(v))return false;const c=v as {x:number;z:number};return Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<world.width&&c.z<world.height;};
  return Object.keys(d).every(k=>['lastActiveTick','target','queue',...(version>=60?['holdFire']:[])].includes(k))&&(d.holdFire===undefined||d.holdFire===true)&&Number.isSafeInteger(d.lastActiveTick)&&Number(d.lastActiveTick)>=0&&Number(d.lastActiveTick)<=world.tick&&(d.target===null||cell(d.target))&&Array.isArray(d.queue)&&d.queue.length<=DRAFT_QUEUE_LIMIT&&d.queue.every(cell);
}
export function validateDrafting(world:World,onlyPawnIds?:ReadonlySet<number>):string[] {
  const errors:string[]=[],claims=new Set<number>();
  for(const p of world.pawns)if(p.draft) {
    if(onlyPawnIds&&!onlyPawnIds.has(p.id))continue;
    const d=p.draft,sleep=p.need?.kind==='sleep'&&p.need.phase==='sleep'&&p.need.bedId===null;
    const service=draftTurretService(world,p),refuge=world.schemaVersion>=193&&!!p.bombRefuge;
    const clinical=world.schemaVersion>=233&&p.tend?.drafted===true;
    const rescuing=isDraftedRescue(world,p);
    // Schema 346: an ordered equip, wear or drop of a drafted colonist (the
    // equipment validator checks the task itself).
    const equipping=isDraftedEquipment346(world,p);
    const invalidEquipping=equipping&&(d.target!==null||d.queue.length>0||p.orders.queue.length>0||p.priorityWork!==undefined
      ||p.need!==null||p.melee||p.shooting||p.bombRefuge||p.heatRefuge||p.tactics||p.flee||p.burning
      ||p.transitExit||p.interruptedCargo);
    const shipCasket=isSchema277OrLater(world.schemaVersion)&&!!p.shipCasketTask277;
    const invalidShipCasket=shipCasket&&(d.target!==null||d.queue.length>0||p.orders.active!==null||p.orders.queue.length>0||p.priorityWork!==undefined||p.need!==null||p.bombRefuge||p.heatRefuge||p.tactics||p.flee||p.burning||p.transitExit||p.interruptedCargo||p.shooting?.order||p.melee?.order);
    const consuming=world.schemaVersion>=234&&hasForcedConsumeMarker(p)&&validForcedConsumePawnShape(p,world.schemaVersion,world);
    const invalidClinical=clinical&&(!validTendShape(p.tend,world.schemaVersion,world)||d.target!==null||d.queue.length>0
      ||p.orders.active!=='tend'||p.orders.queue.length>0||p.priorityWork!==undefined||p.need!==null||p.melee||p.shooting
      ||p.bombRefuge||p.transitExit||p.interruptedCargo);
    const invalidService=service&&(d.target!==null||d.queue.length>0||p.haul!==null&&(p.haul.destination.type!=='turret'||!p.haul.destination.forced)
      ||p.orders.active!==null&&p.orders.active!=='haul'||p.orders.queue.some(o=>typeof o==='number'||!('destination' in o)||o.destination.type!=='turret')
      ||p.priorityWork!==undefined&&p.priorityWork.work!=='haul');
    const invalidRescue=rescuing&&(d.target!==null||d.queue.length>0||p.orders.queue.length>0||p.priorityWork!==undefined
      ||p.need!==null||p.melee||p.shooting||p.bombRefuge||p.heatRefuge||p.tactics||p.flee||p.burning
      ||p.transitExit||p.interruptedCargo);
    // Stun acquired after admission pauses the existing mandate and captured
    // edge. Its ordinary shape/clock are still checked before this validator;
    // only new orders apply the stun refusal in rescueReason.
    if(invalidShipCasket||invalidService||invalidClinical||invalidRescue||invalidEquipping||p.state==='dead'||p.state==='downed'||p.jobId!==null||p.haul&&!service||p.cooking||p.equipmentTask&&!equipping||p.ward||p.feed||p.tend&&!clinical||p.rescue&&!rescuing||p.recreation.task||p.orders.active!==null&&!service&&!clinical&&!consuming&&!rescuing&&!equipping||p.orders.queue.length&&!service&&!clinical&&!consuming&&!rescuing||p.priorityWork&&!service&&!clinical&&!consuming&&!rescuing||p.need&&!sleep&&!consuming||sleep&&(d.target||d.queue.length)||p.state==='sleeping'&&!sleep||p.path.length&&p.state!=='moving'||!['idle','moving','sleeping',...(service||clinical||shipCasket||equipping?['working']:[]),...(consuming?['eating']:[])].includes(p.state))errors.push('Invalid drafted activity.');
    if(clinical&&p.path.length&&!sameCell(p.path.at(-1)!,p.tend!.spot))errors.push('Drafted tending path does not reach its contact cell.');
    if(d.target){const key=d.target.z*world.width+d.target.x;if(claims.has(key))errors.push('Conflicting tactical destination.');claims.add(key);}
    if(p.path.length&&!p.melee?.order&&!p.transitExit&&!service&&!refuge&&!clinical&&!consuming&&!rescuing&&!shipCasket&&!equipping&&(!d.target||!sameCell(p.path.at(-1)!,d.target)))errors.push('Tactical path does not reach its destination.');
    if(!d.target&&!p.melee?.order&&p.state==='moving'&&!p.transitExit&&!service&&!refuge&&!clinical&&!consuming&&!rescuing&&!shipCasket&&!equipping&&p.moveCooldown===0)errors.push('Tactical movement lacks a destination.');
  }
  return errors;
}
