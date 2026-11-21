import {effectiveCore297,effectiveLocal297,validationCore297} from './core-phase-297.ts';
import { isBlockMaterial } from './building-materials.ts';
import { combatTargetByKey,isAnimalTarget,isPawnTarget,type LivingTargetKey } from './combat-target.ts';
import { carrierOf } from './rescue-state.ts';
import { animalCarrier } from './animal-rest-state.ts';
import { spikeTrapPhysicalCell } from './spike-trap-state.ts';
import { structureMaxHp } from './thing-damage-rules.ts';
import { validateFurniture } from './furniture-transfer-save.ts';
import type { Structure,World } from './types.ts';
import { isIedSchema357,isIedTrapKind357,isTrapKind357 } from './ied-traps-357.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const prospective=(v:unknown)=>object(v)&&(isTrapKind357(v.kind)||Object.hasOwn(v,'spikeTrap')||Object.hasOwn(v,'iedWick357'));
/** Schema 357 IED traps: a fixed 'steel' recipe key (two shells, no stuff). */
const trapMaterial=(kind:unknown,material:unknown)=>isIedTrapKind357(kind)?material==='steel':material==='wood'||material==='steel'||isBlockMaterial(material);
const key=(v:unknown):v is LivingTargetKey=>typeof v==='string'&&/^(pawn|animal|mech):[1-9][0-9]*$/.test(v)&&integer(Number(v.slice(v.indexOf(':')+1)),1);

/** Durable presence only: no role, pathfinding, probability or damage check. */
export function validSpikeTrapStateShape(value:unknown,version:number,packed=false):boolean {
  if(version<226||!object(value)||Reflect.ownKeys(value).length!==2||!Object.hasOwn(value,'autoRebuild')||!Object.hasOwn(value,'touching')
    ||typeof value.autoRebuild!=='boolean'||!Array.isArray(value.touching)||packed&&value.touching.length!==0)return false;
  const contacts=value.touching;
  if(Reflect.ownKeys(contacts).length!==contacts.length+1)return false;
  for(let i=0;i<contacts.length;i++)if(!Object.hasOwn(contacts,i)||!key(contacts[i]))return false;
  return new Set(contacts).size===contacts.length;
}

/** Reciprocal kind/state rule, also used by standalone packed admission. */
export function validSpikeTrapBuildingShape(value:unknown,version:number,packed=false):boolean {
  if(!object(value))return false;
  if(!isTrapKind357(value.kind))return !Object.hasOwn(value,'spikeTrap');
  if(version<226||isIedTrapKind357(value.kind)&&!isIedSchema357(version)||!Object.hasOwn(value,'spikeTrap')||!validSpikeTrapStateShape(value.spikeTrap,version,packed)
    ||value.orientation!==0||value.footprint!=='standard'||!trapMaterial(value.kind,value.material)||packed&&Object.hasOwn(value,'iedWick357')
    ||['quality','art','fuel','bills','power','medical','prisoner'].some(k=>Object.hasOwn(value,k)))return false;
  return !Object.hasOwn(value,'damage')||integer(value.damage,1,structureMaxHp(value as unknown as Structure)-1);
}

export function validSpikeTrapCommand(value:unknown):boolean {
  return object(value)&&Reflect.ownKeys(value).length===3&&Object.hasOwn(value,'type')&&Object.hasOwn(value,'structureId')&&Object.hasOwn(value,'on')
    &&value.type==='spike-trap-auto-rebuild'&&integer(value.structureId,1)&&typeof value.on==='boolean';
}

/** Original building owners, before scout projections. No unrelated actor/item
 * fields are inspected; actors are looked up only for actual saved contacts. */
export function validateSpikeTraps(w:World,version:number):string[] {
  if(Object.hasOwn(w,'packed')&&!Array.isArray(w.packed))return ['Malformed packed furniture container.'];
  const departures=[...(w.visitors?.departed??[]),...(w.podRescues?.departed??[])];
  const packs=[...(w.packed??[]),...departures.flatMap(d=>d.packed??[])];
  const descriptors=w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.repair,j.fixBreakdown].filter(Boolean));
  const content=[...w.structures,...w.jobs,...packs.map(p=>p.building),...descriptors];
  if(!content.some(prospective))return [];
  if(version<226)return ['Future spike trap kind or state.'];
  if(!isIedSchema357(version)&&content.some(v=>object(v)&&(isIedTrapKind357(v.kind)||Object.hasOwn(v,'iedWick357'))))return ['Future IED trap kind or state.'];
  const errors:string[]=[];
  for(const s of w.structures){
    if(!validSpikeTrapBuildingShape(s,version))errors.push('Invalid spike trap building or unexpected state.');
    if(isTrapKind357(s.kind)&&(!integer(s.id,1,w.nextId-1)||!integer(s.x,0,w.width-1)||!integer(s.z,0,w.height-1)))errors.push('Invalid spike trap identity or cell.');
    if(!isTrapKind357(s.kind)||!validSpikeTrapStateShape(s.spikeTrap,version))continue;
    if(s.spikeTrap!.touching.length>w.pawns.length+(w.wildlife?.animals.length??0)+(w.mechanoids?.length??0))errors.push('Too many spike trap contacts.');
    for(const contact of s.spikeTrap!.touching){
      const actor=combatTargetByKey(w,contact);
      if(!actor||actor.state==='dead'||actor.health?.death||isPawnTarget(actor)&&carrierOf(w,actor.id)||isAnimalTarget(actor)&&animalCarrier(w,actor.id)){
        errors.push('Spike trap contact has no living uncarried map owner.');continue;
      }
      const cell=spikeTrapPhysicalCell(actor,effectiveCore297(w));
      if(cell.x!==s.x||cell.z!==s.z)errors.push('Spike trap contact is not physically present.');
    }
  }
  for(const j of w.jobs){
    if(Object.hasOwn(j,'spikeTrap'))errors.push('A construction site cannot own spike trap state.');
    if(Object.hasOwn(j,'iedWick357'))errors.push('A construction site cannot own an IED wick.');
    if(isTrapKind357(j.kind)&&(!integer(j.id,1,w.nextId-1)||!integer(j.x,0,w.width-1)||!integer(j.z,0,w.height-1)||j.orientation!==0||j.footprint!=='standard'
      ||!trapMaterial(j.kind,j.material)||['quality','art','fuel','bills','power','medical','prisoner','damage'].some(k=>Object.hasOwn(j,k))))errors.push('Invalid spike trap construction shape.');
  }
  if(descriptors.some(d=>Object.hasOwn(d!,'spikeTrap')))errors.push('A building reference cannot own spike trap state.');
  for(const pack of packs)if(!validSpikeTrapBuildingShape(pack.building,version,true))errors.push('Invalid packed spike trap or unexpected state.');
  // Preserve existing owner/collision/cargo rules for the newly minifiable kind.
  // Archives have their real Pawn and tick; a full departed owner is never
  // substituted with a scout projection or a map identity reference.
  if((w.packed??[]).some(p=>prospective(p.building))||w.jobs.some(j=>isTrapKind357(j.furniture?.kind)))errors.push(...validateFurniture(w,version,new Set()));
  for(const d of departures)if((d.packed??[]).some(p=>prospective(p.building))){
    if((d.packed??[]).some(p=>isTrapKind357(p.building.kind)))errors.push('A departed owner cannot acquire a spike trap package.');
    errors.push(...validateFurniture({...w,tick:d.tick,structures:[],jobs:[],piles:[],pawns:[d.pawn],packed:d.packed??[]},version,new Set()));
  }
  return errors;
}

export function validSpikeTrapTransport(w:World,version:number=w.schemaVersion):boolean {
  try{return validateSpikeTraps(w,version).length===0;}catch{return false;}
}
