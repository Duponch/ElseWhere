import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {validAncientCasketGroupIdsEnvelope256,validAncientCasketGroupLinks256} from './ancient-casket-group-ids-256.ts';
import {validAncientCasketField256,isAncientCasket256,type AncientCasket256} from './ancient-casket-state-256.ts';
import {terrainSupportsAffordance256} from './natural-terrain-runtime-256.ts';
import type {World} from './types.ts';
import {ancientCasketCells256} from './ancient-casket-footprint-256.ts';
import { structureById } from './structure-navigation.ts';
export {ancientCasketCells256} from './ancient-casket-footprint-256.ts';
export const ANCIENT_CASKET_PHYSICS_256=Object.freeze({width:1,depth:2,maxHitPoints:250,flammability:1,support:'Medium' as const,pathCostCore:42,rotatable:true,minifiable:false,quality:false,ingredients:Object.freeze([{item:'steel' as const,quantity:180},{item:'uranium' as const,quantity:5}])});
type Header=Pick<World,'schemaVersion'|'tick'|'width'|'height'|'nextId'>;
const int=(v:unknown,a:number,b:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=a&&v<=b;
/** Descriptor-first: fixed Def, no Stuff/quality/power/recipe state accepted. */
export function validAncientCasketBuilding256(v:unknown,version:number,h:Pick<Header,'width'|'height'|'nextId'>,tick=Number.MAX_SAFE_INTEGER,coreNow297?:number):boolean {
 if(!v||typeof v!=='object'||Array.isArray(v))return false;
 const k=Object.getOwnPropertyDescriptor(v,'kind');if(!k||!('value'in k)||!k.enumerable)return false;
 if(k.value!=='ancient-cryptosleep-casket')return validAncientCasketField256(v,version,tick,coreNow297);
 if(!validAncientCasketField256(v,version,tick,coreNow297)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 const allowed=['id','kind','x','z','orientation','footprint','damage','factionId','casket','casketWick'];
 if(Reflect.ownKeys(v).some(k=>typeof k!=='string'||!allowed.includes(k)||!Object.getOwnPropertyDescriptor(v,k)?.enumerable||!('value'in Object.getOwnPropertyDescriptor(v,k)!)))return false;
 const s=v as AncientCasket256;
 return isSchema256Or257(version)&&int(s.id,1,h.nextId-1)&&int(s.x,0,h.width-1)&&int(s.z,0,h.height-1)&&int(s.orientation,0,3)&&s.footprint==='standard'
  &&(!Object.hasOwn(s,'damage')||int(s.damage,1,249))&&(!Object.hasOwn(s,'factionId')||s.factionId===null)
  &&(!s.casketWick||s.casket.humans.length+s.casket.animals.length+s.casket.items.length===0&&(!s.casketWick.instigatorKey||Number(s.casketWick.instigatorKey.slice(s.casketWick.instigatorKey.indexOf(':')+1))<h.nextId))
  &&ancientCasketCells256(s,s.orientation).every(c=>int(c.x,0,h.width-1)&&int(c.z,0,h.height-1));
}
export function validateAncientCasketPhysical256(w:World):string[]{
 const allocator=w.worldMaps??w.campaignMap;
 if(allocator&&!validAncientCasketGroupIdsEnvelope256(allocator,w.schemaVersion,w.planet?.revision))return ['Invalid actual casket group authority.'];
 const next=allocator&&Object.getOwnPropertyDescriptor(allocator,'nextAncientCasketGroupId');
 if(next&&!validAncientCasketGroupLinks256(w.structures,next.value))return ['Casket group exceeds its actual confirmed campaign allocator.'];
 for(const s of w.structures){if(!validAncientCasketBuilding256(s,w.schemaVersion,w,w.tick,isCorePhysicalSchema297(Number(w.schemaVersion))?effectiveCore297(w):undefined))return ['Invalid actual ancient casket physical definition.'];if(isAncientCasket256(s)&&ancientCasketCells256(s,s.orientation).some(c=>{const t=w.tiles[c.z*w.width+c.x];return !t||['rock','water'].includes(t.terrain)||!terrainSupportsAffordance256(t,'Medium',w);}))return ['Actual ancient casket lacks Medium support.'];}
 for(const p of w.packed??[])if(isAncientCasket256(p.building)||p.building&&'casket'in p.building)return ['An ancient casket is not minifiable.'];
 for(const j of w.jobs){if(isAncientCasket256(j)||j.furniture?.kind==='ancient-cryptosleep-casket')return ['Ancient casket construction/minification is not offered.'];if(j.deconstruction?.kind==='ancient-cryptosleep-casket'){const s=structureById(w,j.deconstruction!.structureId);if(j.kind!=='deconstruct'||!isAncientCasket256(s)||s.casket.humans.length||s.casket.animals.length||s.casket.items.length)return ['Actual casket deconstruction requires the completely empty original.'];}}
 return [];
}
/** Fail BEFORE an unsupported destructive transaction, even for an emptied
 * casket: its Flame2.66/killed-leavings are not ordinary salvage. */
export const ancientCasketRemovalRefusal256=(s:unknown):string|null=>isAncientCasket256(s)&&(s.casket.humans.length||s.casket.animals.length||s.casket.items.length)?'Nonempty ancient casket requires its actual original contents transaction; holder retained.':null;
