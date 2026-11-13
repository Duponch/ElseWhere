import {isSchema272OrLater} from './schema-compatibility-257.ts';
import {isSpearItem272} from './spear-content-272.ts';
import {isLongswordItem270} from './longsword-content-270.ts';
import {isMaceItem269} from './mace-content-269.ts';
import { WEAPON_QUALITIES,equippedWeapon,isWeaponItem,weaponMaxHitPoints } from './equipment-rules.ts';
import { equipmentReason } from './equipment.ts';
import { pawnBody } from './health-rules.ts';
import { reservedSource } from './materials.ts';
import type { World } from './types.ts';

const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0;
export function validEquipmentShape(p:Record<string,unknown>,version:number):boolean {
  if(version<52)return p.equipmentTask===undefined&&p.equipmentDropPending===undefined&&p.droppedWeaponId===undefined;
  if(p.equipmentDropPending!==undefined&&p.equipmentDropPending!==true||p.droppedWeaponId!==undefined&&!id(p.droppedWeaponId))return false;
  const t=p.equipmentTask;if(t===undefined)return true;
  // V267 can exchange two90-tick plates; a vest+duster replacement takes138.
  // Older envelopes retain their132/60 bounds. validateApparel still checks
  // the exact captured duration against the versioned compatible wardrobe.
  if(record(t)&&(t.action==='wear'||t.action==='remove'))return version>=63&&Object.keys(t).every(k=>['itemId','action','progress','duration',...(version>=90?['automatic']:[])].includes(k))&&id(t.itemId)&&id(t.duration)&&Number(t.duration)<=(version>=267?180:version>=241?132:60)&&typeof t.progress==='number'&&Number.isInteger(t.progress)&&t.progress>=0&&t.progress<Number(t.duration)
    &&(t.automatic===undefined||version>=90&&t.automatic===true);
  return record(t)&&Object.keys(t).every(k=>['itemId','action','progress','automatic'].includes(k))&&id(t.itemId)
    &&(t.action==='equip'?t.progress===0:t.action==='drop'&&typeof t.progress==='number'&&Number.isInteger(t.progress)&&t.progress>=0&&t.progress<3)
    &&(t.automatic===undefined||t.action==='equip'&&t.automatic===true);
}
export function validWeaponShape(p:Record<string,unknown>,version:number):boolean {
  if(p.kind!=='weapon')return p.weapon===undefined;
  const w=p.weapon;
  return version>=52&&isWeaponItem(p.item)&&(version>=269||!isMaceItem269(p.item))&&(version>=270||!isLongswordItem270(p.item))&&(isSchema272OrLater(version)||!isSpearItem272(p.item))&&(version>=208||p.item!=='emp-launcher')&&(version>=316||p.item!=='short-bow')&&(version>=88||p.item==='revolver')&&record(p.owner)&&p.owner.type!=='job'&&record(w)&&Object.keys(w).every(k=>['quality','hitPoints','forbidden'].includes(k))
    &&typeof w.quality==='string'&&(WEAPON_QUALITIES as readonly string[]).includes(w.quality)
    &&typeof w.hitPoints==='number'&&Number.isInteger(w.hitPoints)&&w.hitPoints>0&&w.hitPoints<=weaponMaxHitPoints(p.item)
    &&(w.forbidden===undefined||w.forbidden===true)&&p.quantity===1;
}
export function validateEquipment(world:World):string[] {
  const errors:string[]=[];
  errors.push(...validateEquipmentOwners259(world.pawns,world.piles));
  for(const p of world.pawns){
    const weapon=equippedWeapon(world,p),t=p.equipmentTask;
    if(p.equipmentDropPending&&!weapon)errors.push('Pending equipment drop without weapon.');
    if(weapon&&!p.equipmentDropPending&&(p.state==='dead'||p.state==='downed'&&!(p.need?.kind==='sleep'&&p.need.phase==='sleep'&&p.need.bedId!==null)||pawnBody(p).capacities.manipulation===0))errors.push('Incapacitated pawn retains active weapon.');
    if(p.droppedWeaponId!==undefined&&(weapon||!world.piles.some(i=>i.id===p.droppedWeaponId&&i.kind==='weapon'&&i.owner.type==='ground')))errors.push('Invalid remembered weapon.');
    if(!t)continue;
    const pile=world.piles.find(i=>i.id===t.itemId);
    if(equipmentReason(world,p,pile,t.action,true)||(t.action==='equip'||t.action==='wear')&&reservedSource(world,t.itemId)>1)errors.push('Invalid equipment target or reservation.');
    if(p.need||p.haul||p.cooking||p.rescue||p.tend||p.ward||p.feed||p.recreation.task||p.jobId!==null)errors.push('Equipment conflicts with another activity.');
    if(t.automatic?p.orders.active!==null:p.orders.active!=='equipment')errors.push('Equipment order intent mismatch.');
    if(t.action==='equip'?p.state!=='moving':t.progress>0?(p.state!=='working'||p.moveCooldown>0||p.path.length):p.state!=='moving')errors.push('Invalid equipment phase.');
  }
  return errors;
}

/** Same actual gear owners, without local task/clinical projection. */
export function validateEquipmentOwners259(pawns:readonly {id:number}[],piles:readonly import('./types.ts').MaterialPile[]):string[]{const errors:string[]=[],owners=new Set<number>();
  for(const pile of piles)if(pile.owner.type==='equipment'){
    const owner=pile.owner.pawnId;
    if(pile.kind!=='weapon'||!pawns.some(p=>p.id===owner)||owners.has(owner)||pile.weapon?.forbidden)errors.push('Invalid primary equipment owner.');
    owners.add(owner);
  }
return errors;}
