import {isFurnitureCSchema363} from './furniture-c-363.ts';
import { footprintCells } from './definitions.ts';
import { sharesConstructionLayer } from './power-grid.ts';
import { isConstruction } from './construction-rules.ts';
import { everyHumanPawnOwner } from './human-owners.ts';
import { prisonBedValid,prisonerAllowedCell } from './prison-space.ts';
import { validateRescues,validRescueShape } from './rescue-save.ts';
import { validateCare } from './care-save.ts';
import { validateSurgeries } from './surgery-save.ts';
import { validRoomExperience } from './room-experience.ts';
import type { Cell,Structure,World } from './types.ts';
import type { OwnedGeometryReuseWitness } from './owned-validation-geometry.ts';

const SPOT='sleeping-spot';
/** Schema 363: the double sleeping spot is the same kind of placed ground
 * emplacement; its two slots belong to the double-bed domain (double-bed-save). */
const DOUBLE_SPOT='double-sleeping-spot';
const groundSpot=(k:unknown):boolean=>k===SPOT||k===DOUBLE_SPOT;
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Inspect descriptors before reading transport values. This walk follows only
 * actual construction/item containers, never arbitrary World metadata or tiles. */
function dataRecord(v:unknown):v is Record<string,unknown> {
  return object(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>{
    const d=Object.getOwnPropertyDescriptor(v,k);return typeof k==='string'&&!!d&&Object.hasOwn(d,'value')&&d.enumerable;
  });
}
function dataArray(v:unknown):v is unknown[] {
  if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype||v.length>1_000_000)return false;
  const own=Reflect.ownKeys(v);
  return own.length===v.length+1&&own.every(k=>{
    const d=Object.getOwnPropertyDescriptor(v,k);
    return typeof k==='string'&&!!d&&Object.hasOwn(d,'value')&&(k==='length'||d.enumerable&&/^(0|[1-9][0-9]*)$/.test(k)&&Number(k)<v.length);
  });
}
const fields=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))
  &&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));

export function validHumanSleepingSpotShape(v:unknown,version:number,w:Pick<World,'width'|'height'|'nextId'>):v is Structure {
  if(!dataRecord(v)||!(v.kind===SPOT||v.kind===DOUBLE_SPOT&&isFurnitureCSchema363(version))||version<232||!fields(v,['id','kind','x','z','orientation','footprint'],['medical','prisoner'])
    ||!integer(v.id,1,w.nextId-1)||!integer(v.x,0,w.width-1)||!integer(v.z,0,w.height-1)||!integer(v.orientation,0,3)
    ||v.footprint!=='standard'||Object.hasOwn(v,'medical')&&v.medical!==true||Object.hasOwn(v,'prisoner')&&v.prisoner!==true)return false;
  return footprintCells(v as unknown as Structure).every(c=>integer(c.x,0,w.width-1)&&integer(c.z,0,w.height-1));
}
/** Descriptor-safe admission before the existing sparse structure reader. */
export function validHumanSleepingSpotStructureEntry(v:unknown,version:number,w:Pick<World,'width'|'height'|'nextId'>):boolean {
  return dataRecord(v)&&(!groundSpot(v.kind)||validHumanSleepingSpotShape(v,version,w));
}

/** A floor designation is only a placed Structure. In particular old migrations
 * may not erase a future kind hidden in a frame, archive or original possession.
 * Missing historical containers are permitted; their ordinary guards own shape. */
type StructureProvenanceReader=(value:unknown,walk:()=>boolean)=>boolean;
function validProvenance(raw:unknown,version:number,structures?:StructureProvenanceReader):boolean {
  try {
    if(!dataRecord(raw))return false;
    const scanRecords=(value:unknown,placed=false):boolean=>{
      if(value===undefined)return true;if(!dataArray(value))return false;
      return value.every(v=>{
        if(!dataRecord(v))return false;
        if(groundSpot(v.kind)&&( !placed||!validHumanSleepingSpotShape(v,version,raw as unknown as World)))return false;
        if(groundSpot(v.item))return false;
        for(const key of ['building','furniture','deconstruction','flick','repair','fixBreakdown'])if(v[key]!==undefined){
          if(!dataRecord(v[key])||groundSpot(v[key].kind)||groundSpot(v[key].item))return false;
        }
        return true;
      });
    };
    const placed=raw.structures;
    if(!(structures?structures(placed,()=>scanRecords(placed,true)):scanRecords(placed,true))
      ||!scanRecords(raw.jobs)||!scanRecords(raw.packed)||!scanRecords(raw.piles))return false;
    for(const key of ['scout','commercialTrip','civilianPost','group'])if(raw[key]!==undefined){
      const owner=raw[key];if(!dataRecord(owner)||!scanRecords(owner.items)||!scanRecords(owner.stock)||!scanRecords(owner.packed))return false;
    }
    for(const key of ['groupLosses','prisonDepartures'])if(raw[key]!==undefined){
      if(!dataArray(raw[key]))return false;
      for(const owner of raw[key])if(!dataRecord(owner)||!scanRecords(owner.items)||!scanRecords(owner.packed))return false;
    }
    for(const key of ['visitors','podRescues','raids'])if(raw[key]!==undefined){
      const state=raw[key];if(!dataRecord(state))return false;
      if(state.departed!==undefined){if(!dataArray(state.departed))return false;
        for(const owner of state.departed)if(!dataRecord(owner)||!scanRecords(owner.items)||!scanRecords(owner.packed))return false;
      }
    }
    if(raw.startingArrival!==undefined){const arrival=raw.startingArrival;if(!dataRecord(arrival))return false;
      if(arrival.pods!==undefined){if(!dataArray(arrival.pods))return false;
        for(const pod of arrival.pods)if(!dataRecord(pod)||!scanRecords(pod.items))return false;
      }
    }
    return true;
  }catch{return false;}
}

/** Public/RAW and early packet admission always inspect every original domain.
 * Additional arguments cannot grant authority to skip a structure traversal. */
export function validHumanSleepingSpotProvenance(raw:unknown,version:number):boolean {
  return validProvenance(raw,version);
}

/** A bounded new-domain guard, with real World ownership and existing physical
 * medical/rescue rules. It never projects actors, repairs records or runs RNG. */
function validTransport(w:World,version:number,structures?:StructureProvenanceReader):boolean {
  try {
    if(!validProvenance(w,version,structures))return false;
    const grounds=w.structures.filter(s=>groundSpot(s.kind));if(!grounds.length)return true;
    const spots=grounds.filter(s=>s.kind===SPOT);
    const byId=new Map(spots.map(s=>[s.id,s]));if(byId.size!==spots.length)return false;
    const occupied=new Set<number>();
    for(const spot of grounds)for(const c of footprintCells(spot)){
      const key=c.z*w.width+c.x;if(occupied.has(key))return false;occupied.add(key);
      if(!w.tiles[key]||['water','rock'].includes(w.tiles[key]!.terrain)||w.resources.some(r=>same(c,r)&&['rock','tree'].includes(r.kind))
        ||w.structures.some(s=>s!==spot&&sharesConstructionLayer(s.kind,spot.kind,version,s.orientation,spot.orientation)&&footprintCells(s).some(d=>same(c,d)))
        ||w.jobs.some(j=>isConstruction(j)&&sharesConstructionLayer(j.furniture?.kind??j.kind,spot.kind,version,j.orientation,spot.orientation)&&footprintCells(j).some(d=>same(c,d))))return false;
    }
    const assignments=new Set<number>(),claims=new Set<number>();
    const claim=(id:number)=>{if(claims.has(id))return false;claims.add(id);return true;};
    if(!everyHumanPawnOwner(w,(p,kind)=>{
      if(!dataRecord(p)||p.need!==null&&p.need!==undefined&&!dataRecord(p.need)
        ||p.rescue!==undefined&&!dataRecord(p.rescue)||p.surgery!==undefined&&!dataRecord(p.surgery))return false;
      const assigned=p.bedId===null?undefined:byId.get(p.bedId),need=p.need?.kind==='sleep'?p.need:undefined,bed=need?.bedId===null?undefined:byId.get(need?.bedId??0);
      const rescue=p.rescue&&byId.get(p.rescue.bedId),surgery=p.surgery&&byId.get(p.surgery.bedId);
      if(kind!=='map'&&kind!=='player-casket')return !assigned&&!bed&&!rescue&&!surgery;
      if(kind==='player-casket'&&(need||p.rescue||p.surgery))return false;
      if(assigned){
        if(Object.hasOwn(p,'bedSlot')||assigned.medical||!!assigned.prisoner!==!!p.prisoner||p.state==='dead'||p.health?.death||assignments.has(assigned.id))return false;
        assignments.add(assigned.id);
      }
      if(bed&&need){
        // A breach does not move an installed incapacitated patient. This is
        // physical occupancy only; travel and future assignments still need
        // the same enclosure as a new rescue or prison-bed reservation.
        const installedBreachPatient=bed.medical&&bed.prisoner&&p.bedId===null&&p.state==='downed'
          &&need.phase==='sleep'&&same(p,bed)&&dataRecord(need.target)&&same(need.target,bed)&&!p.path.length&&p.moveCooldown===0&&(p.motion?.end??0)<=w.tick;
        if(!fields(need as unknown as Record<string,unknown>,['kind','phase','bedId','target'],['medical','roomRest'])
          ||!dataRecord(need.target)||!fields(need.target,['x','z'])||Object.hasOwn(need,'medical')&&!['patient','bedrest'].includes(String(need.medical))
          ||Object.hasOwn(need,'roomRest')&&(!dataRecord(need.roomRest)||!validRoomExperience(p as unknown as Record<string,unknown>,version,w.tick))
          ||Object.hasOwn(p,'bedSlot')||!same(need.target,bed)||!!bed.prisoner!==!!p.prisoner
          ||!claim(bed.id)||p.state==='dead'||p.health?.death||!['travel','sleep'].includes(need.phase)
          ||p.bedId!==bed.id&&!(bed.medical&&(p.state==='downed'||!!need.medical))
          ||!need.medical&&p.state!=='downed'&&bed.medical
          ||p.prisoner&&((!installedBreachPatient&&!prisonBedValid(w,bed))||!prisonerAllowedCell(w,p,bed)))return false;
        if(need.phase==='sleep'&&(!same(p,bed)||p.path.length||(p.motion?.end??0)>w.tick||!['sleeping','resting','downed'].includes(p.state)))return false;
        if(need.phase==='travel'&&(p.state!=='moving'||p.path.length&&!same(p.path.at(-1)!,bed)
          ||!p.path.length&&((p.motion?.end??0)<=w.tick||!same(p,bed))))return false;
      }
      if(rescue&&p.rescue){
        if(!validRescueShape(p.rescue,version)||Object.hasOwn(p.rescue,'bedSlot')||!claim(rescue.id)||p.rescue.phase==='carry'&&p.path.length&&!same(p.path.at(-1)!,rescue)
          ||w.pawns.filter(a=>a.rescue?.patientId===p.rescue!.patientId).length!==1)return false;
      }
      return true;
    }))return false;
    const ids=new Set(byId.keys());
    return !validateRescues(w,false,ids).length&&!validateCare(w,ids).length&&!validateSurgeries(w,version,ids).length;
  }catch{return false;}
}

/** Public mutable callers retain complete provenance and dynamic admission. */
export function validHumanSleepingSpotTransport(w:World,version:number=w.schemaVersion):boolean {
  return validTransport(w,version);
}

export interface OwnedSleepingProvenanceOwner {
  validate(world:World,reuse?:OwnedGeometryReuseWitness):boolean;
  commit(world:World):void;
  discard():void;
}

/** Closed MAIN only: the confirmed structures have no external writers. This
 * caches only their descriptor-safe placed provenance, never tasks, archives,
 * possessions, geometry, occupancy, assignments, rescue, care or surgery.
 * A genuine empty contiguous sparse edge can keep the EXACT accepted array,
 * including at the same tick. Every upsert/remap/full boundary walks it again.
 * Constructing this helper grants no authority to arbitrary mutable Worlds. */
export function createOwnedSleepingProvenanceOwner():OwnedSleepingProvenanceOwner {
  type Fact={world:World;structures:World['structures']};
  let confirmed:Fact|undefined,pending:Fact|undefined;
  return {
    validate(world,reuse){
      pending=undefined;
      let clean:World['structures']|undefined;
      const valid=validTransport(world,world.schemaVersion,(value,walk)=>{
        const base=confirmed;
        const unchanged=!!base&&!!reuse&&reuse.kind==='sparse'&&reuse.previous===base.world
          &&reuse.updatedOrdinals.length===0&&value===base.structures&&value===reuse.previous.structures
          &&world.schemaVersion>=232&&world.schemaVersion===base.world.schemaVersion
          &&world.width===base.world.width&&world.height===base.world.height
          &&world.seed===base.world.seed&&world.nextId===base.world.nextId;
        const clear=unchanged||walk();
        if(clear&&Array.isArray(value))clean=value;
        return clear;
      });
      if(valid&&clean)pending={world,structures:clean};
      return valid;
    },
    // The whole adoption must succeed before its local fact can be retained.
    commit(world){confirmed=pending?.world===world?pending:undefined;pending=undefined;},
    discard(){pending=undefined;},
  };
}
