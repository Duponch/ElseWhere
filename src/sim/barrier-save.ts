import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {validNaturalHiveLoss256} from './cave-hive-loss-256.ts';
import {isFutureEcologyItem256} from './cave-products-256.ts';
import {isBedrollTextile256} from './bedroll-textiles-256.ts';
import { isRepairableStructure,structureMaxHp } from './thing-damage-rules.ts';
import { barrierMaxHp,isBarrier } from './barriers.ts';
import { CONSTRUCTION_MATERIALS } from './building-materials.ts';
import { repairWanted } from './repairs.ts';
import { ITEM_DEFINITIONS,V219_ITEM_IDS } from './items.ts';
import { validFireResourceLosses } from './fire-save.ts';
import type { World } from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min:number,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
export function validateBarriers(world:World,version:number):string[] {
  const errors:string[]=[],size=world.width*world.height;
  if(world.home!==undefined&&(version<67||!Array.isArray(world.home)||!world.home.length||world.home.length>size||!world.home.every((i,n)=>integer(i,0,size-1)&&(n===0||i>world.home![n-1]!))))errors.push('Invalid home area.');
  const ledger:unknown=world.destroyed;
  if(ledger!==undefined){
    if(!validNaturalHiveLoss256(ledger,version))errors.push('Invalid or future natural Hive destruction count.');
    const natural=version>=256&&object(ledger)&&Object.hasOwn(ledger,'natural')&&validNaturalHiveLoss256(ledger,version);
    const neutral=natural||version>=193&&object(ledger)&&(object(ledger.items)&&Object.keys(ledger.items).length>0||object(ledger.resources)&&Object.keys(ledger.resources).length>0);
    if(version<67||!object(ledger)||Object.keys(ledger).some(k=>!['count','lost',...(version>=256?['natural']:[]),...(version>=192?['fuelTicksLost','fuelTicksBurned','batteryEnergyLost']:[]),...(version>=193?['items','resources','woodPotentialLost']:[])].includes(k))
      ||!integer(ledger.count,neutral?0:1)||!object(ledger.lost)||(!Object.keys(ledger.lost).length&&!neutral)
      ||Object.entries(ledger.lost).some(([k,v])=>!(isSchema298OrLater(version)&&k==='ai-core'||version>=123&&k==='gold'||isSchema275OrLater(version)&&k==='plasteel'||version>=256&&(k==='jade'||k==='uranium')||k!=='jade'&&CONSTRUCTION_MATERIALS.includes(k as never)||version>=256&&isBedrollTextile256(k)||version>=75&&k==='component'||version>=193&&k==='advanced-component'||version>=211&&k==='silver'||version>=265&&(k==='wort'||k==='beer'))||!integer(v,1))
      ||['fuelTicksLost','fuelTicksBurned'].some(k=>ledger[k]!==undefined&&!integer(ledger[k],1))
      ||ledger.batteryEnergyLost!==undefined&&(typeof ledger.batteryEnergyLost!=='number'||!Number.isFinite(ledger.batteryEnergyLost)||ledger.batteryEnergyLost<=0||!Number.isSafeInteger(ledger.batteryEnergyLost*2))
      ||ledger.items!==undefined&&(!object(ledger.items)||!Object.keys(ledger.items).length||Object.entries(ledger.items).some(([k,v])=>!Object.hasOwn(ITEM_DEFINITIONS,k)||version<256&&(isFutureEcologyItem256(k)||k==='slag-steel-chunk')||version<235&&k==='minified-tree'||version<227&&['hay','kibble'].includes(k)||version<206&&k==='neutroamine'||version<194&&k==='scyther-corpse'||version<197&&V219_ITEM_IDS.some(item=>item===k)||!integer(v,1)))
      ||ledger.resources!==undefined&&(!validFireResourceLosses(ledger.resources,version)||!Object.keys(ledger.resources as object).length)
      ||ledger.woodPotentialLost!==undefined&&(!integer(ledger.woodPotentialLost,1)||!object(ledger.resources)||!integer(ledger.resources.tree,1)))errors.push('Invalid destroyed building ledger.');
  }
  for(const s of [...world.structures,...(world.packed??[]).map(p=>p.building)])if(s.damage!==undefined&&(version<67||!(version>=87?isRepairableStructure(s):isBarrier(s))||!integer(s.damage,1,(version>=87?structureMaxHp(s,version):barrierMaxHp(s))-1)))errors.push('Invalid barrier damage.');
  for(const j of world.jobs){
    const r:unknown=j.repair;
    if(j.kind!=='repair'){if(r!==undefined)errors.push('Unexpected repair target.');continue;}
    if(version<67||!object(r)||Object.keys(r).some(k=>!['structureId','warmed'].includes(k))||!integer(r.structureId,1)||r.warmed!==undefined&&r.warmed!==true){errors.push('Invalid repair job.');continue;}
    const s=world.structures.find(s=>s.id===r.structureId);
    if(!s||!(version>=87?isRepairableStructure(s):isBarrier(s))||s.x!==j.x||s.z!==j.z||s.orientation!==j.orientation||s.footprint!==j.footprint||j.material!==undefined||j.deconstruction||j.construction||j.furniture||j.clearance||j.growingZoneId!==undefined||j.escrow.wood||j.escrow.food)errors.push('Repair does not match its building.');
    if(!errors.length&&!repairWanted(world,j))errors.push('Repair outside home, undamaged or marked for removal.');
    if(j.reservedBy===null&&(j.progress!==0||j.workRemainder!==undefined||r.warmed))errors.push('Interrupted repair kept work.');
  }
  return errors;
}
