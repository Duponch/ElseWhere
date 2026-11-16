import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {validationCore297} from './core-phase-297.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validPermanentManhunter261} from './animal-scaria-261.ts';
import {validHiveStructureStrike256} from './cave-hive-strike-save-256.ts';
import type { World } from './types.ts';
import type { WildAnimal } from './wildlife-state.ts';
import { isRoomDoor } from './door-rules.ts';
import {isAnimalSpecies} from './animal-species.ts';
import {actualAnimalMeleeProfile256} from './actual-animal-profile-256.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>Number.isSafeInteger(v)&&Number(v)>=min&&Number(v)<=max;
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
type BoundaryWorld=Pick<World,'tick'|'nextId'|'pawns'|'structures'|'raids'|'width'|'height'|'wildlife'|'jobs'|'piles'|'resources'|'packed'|'mechanoids'>;
/** Recovery survives loss of its door and mental state. It still owns a
 * valid past contact and cannot borrow a live actor's global identity. */
function validDoorStrike(w:BoundaryWorld,version:number,a:WildAnimal,coreNow297?:number):boolean {
  const core=isCorePhysicalSchema297(version)?validationCore297(version,w.tick,coreNow297):w.tick*10;if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(core))return false;
 const actualHiveStrike=validHiveStructureStrike256(w,version,a,coreNow297);if(actualHiveStrike!==undefined)return actualHiveStrike;
  const s=a.strike;if(s?.structure===undefined)return true;
  if(version<183||!isAnimalSpecies(a.species)||!Array.isArray(a.path)||!object(s)||!keys(s,['targetId','atCore','untilCore','tool','outcome','structure'])
    ||!object(s.structure)||!keys(s.structure,['x','z'])||!int(s.structure.x,0,w.width-1)||!int(s.structure.z,0,w.height-1)
    ||!int(s.targetId,1,w.nextId-1)||!int(s.atCore,0,core)||!int(s.untilCore,core+1)
    ||s.outcome!=='hit'||!actualAnimalMeleeProfile256(a).some(t=>t.id===s.tool&&s.untilCore-s.atCore===t.cooldownCore)
    ||!['idle','sleeping'].includes(a.state)||a.path.length||(a.motion?.end??0)>(isCorePhysicalSchema297(version)?core/10:w.tick)||a.meal)return false;
  const door=w.structures.find(d=>d.id===s.targetId),c=s.structure;
  if(door&&(!isRoomDoor(door.kind)||door.x!==c.x||door.z!==c.z))return false;
  return ![w.pawns,w.jobs,w.piles,w.resources,w.wildlife?.animals??[]].some(items=>items.some(i=>i.id===s.targetId))
    &&!w.packed.some(p=>p.building.id===s.targetId);
}
/** Closed sparse shape, with no navigation or medical mutation at transport.
 * From schema 348 a harm or failed-tame rage keeps the Tame designation. */
export function validAnimalManhunter(w:BoundaryWorld,version:number,a:WildAnimal,coreNow297?:number):boolean {
  const core=isCorePhysicalSchema297(version)?validationCore297(version,w.tick,coreNow297):w.tick*10;if(isCorePhysicalSchema297(version)&&!Number.isSafeInteger(core))return false;
  if(!validDoorStrike(w,version,a,coreNow297)||!validPermanentManhunter261(a,version))return false;
  const m:unknown=a.manhunter;if(m===undefined)return true;
  if(version<183||!object(m)||!keys(m,['startedAtCore','rng','zeroRestTicks','exhausted','targetId','door',...((version===261||(Number(version)===262||isSchema263OrLater(Number(version))))?['permanent261']:[])])
    ||!int(m.startedAtCore,0,core)||!int(m.rng,1,0xffffffff)
    ||!int(m.zeroRestTicks,0,core-m.startedAtCore+150)||m.zeroRestTicks%150!==0
    ||a.domestic||a.meal||a.predation||a.exiting||a.flee||a.threat||a.retaliation||a.mating||a.taming&&Number(version)<348
    ||!['idle','moving','sleeping',...(m.permanent261?['downed']:[])].includes(a.state))return false;
  if(m.exhausted!==undefined&&(m.exhausted!==true||m.zeroRestTicks<=1000||a.rest>=.0001||a.path.length||m.targetId!==undefined||m.door!==undefined))return false;
  if(m.targetId!==undefined&&(!int(m.targetId,1,w.nextId-1)||!w.pawns.some(p=>p.id===m.targetId)&&!w.raids?.departed.some(p=>p.pawnId===m.targetId)&&!(m.permanent261&&((w.wildlife?.animals??[]).some(a=>a.id===m.targetId)||(w.mechanoids??[]).some(a=>a.id===m.targetId)||w.piles.some(p=>p.kind==='corpse'&&p.id===m.targetId)))))return false;
  if(m.door!==undefined){
    const d=m.door;
    if(!object(d)||!keys(d,['targetId','remaining','untilCore'])||!int(d.targetId,1,w.nextId-1)||!int(d.remaining,0,5)
      ||!int(d.untilCore,core+1,core+3999)||m.targetId===undefined
      ||!w.structures.some(s=>s.id===d.targetId&&!!s.door))return false;
  }
  return true;
}
export function validWildlifeManhunterState(w:BoundaryWorld,version:number,coreNow297?:number):boolean {
  if(w.wildlife===undefined)return true;
  return object(w.wildlife)&&Array.isArray(w.wildlife.animals)&&w.wildlife.animals.every(a=>object(a)&&validAnimalManhunter(w,version,a,coreNow297));
}
