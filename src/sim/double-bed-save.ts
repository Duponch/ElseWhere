import {isDoubleBedKind} from './bed-kinds.ts';
import {isFurnitureCSchema363} from './furniture-c-363.ts';
import { captureHumanOwners,everyHumanPawnOwner } from './human-owners.ts';
import { bedSlotCell } from './bed-slots.ts';
import { furnitureMaxHitPoints,isFurnitureQuality,materialAllowed } from './furniture-stats.ts';
import { sameRescueEdge,validRescueShape } from './rescue-save.ts';
import { isColonist } from './affiliation.ts';
import { medicalWorkRefusal } from './health-rules.ts';
import type { BedSlot,Pawn,World } from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const slot=(v:unknown):v is BedSlot=>v===0||v===1;
const same=(a:{x:number;z:number},b:{x:number;z:number})=>a.x===b.x&&a.z===b.z;
const prospectivePawn=(p:Pawn)=>Object.hasOwn(p,'bedSlot')||!!p.rescue&&Object.hasOwn(p.rescue,'bedSlot')||!!p.need&&Object.hasOwn(p.need,'bedSlot');
const normalBeds=(w:World)=>[...w.structures,...(w.packed??[]).map(p=>p.building)];

/** Own presence is prospective, including undefined. A simple or missing bed
 * keeps historical bed-reference admission; it can never acquire a slot. */
export function validBedSlotPawnShape(p:Record<string,unknown>,w:World,version:number):boolean {
  if(object(p.need)&&Object.hasOwn(p.need,'bedSlot'))return false;
  if(version<224)return !Object.hasOwn(p,'bedSlot')&&(!object(p.rescue)||!Object.hasOwn(p.rescue,'bedSlot'));
  const bed=normalBeds(w).find(b=>b.id===p.bedId),present=Object.hasOwn(p,'bedSlot');
  if(isDoubleBedKind(bed?.kind)?!present||!slot(p.bedSlot):present)return false;
  const r=p.rescue;
  if(object(r)){
    const target=w.structures.find(b=>b.id===r.bedId),hasSlot=Object.hasOwn(r,'bedSlot');
    if(isDoubleBedKind(target?.kind)){
      if(!validRescueShape(r,version)||!hasSlot||!slot(r.bedSlot)||Object.hasOwn(r,'capture')||Object.hasOwn(r,'arrest')||Object.hasOwn(r,'release'))return false;
    }else if(hasSlot)return false;
  }
  return true;
}

/** Pure double-bed domain on the ORIGINAL World, before scout projections.
 * No path search, policy check, repair or random draw. Only prospective
 * rescue authority reads the same local medical verdict as file admission. */
export function validateDoubleBeds(w:World,version:number):string[] {
  const archivedPacks=[...(w.visitors?.departed??[]),...(w.podRescues?.departed??[])].flatMap(d=>d.packed??[]);
  const built=[...w.structures,...(w.packed??[]).map(p=>p.building),...archivedPacks.map(p=>p.building)];
  const physical=[...built,...w.jobs];
  const content=[...physical,...w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.repair,j.fixBreakdown].filter(Boolean))];
  if(!content.some(b=>b&&'kind' in b&&isDoubleBedKind(b.kind))&&everyHumanPawnOwner(w,p=>!prospectivePawn(p)))return [];
  if(version<224)return ['Future double bed or bed slot.'];
  // Schema 363: the double bedroll and the double sleeping spot share these two slots.
  if(!isFurnitureCSchema363(version)&&content.some(b=>b&&'kind' in b&&(b.kind==='double-bedroll'||b.kind==='double-sleeping-spot')))return ['Future double bedroll or double sleeping spot.'];
  if([...w.jobs,...(w.packed??[]).map(p=>p.building),...archivedPacks.map(p=>p.building),...w.jobs.flatMap(j=>[j.furniture,j.deconstruction,j.flick,j.repair,j.fixBreakdown])].some(b=>b&&'kind' in b&&b.kind==='double-sleeping-spot'))return ['A double sleeping spot is never built, packed or worked on.'];
  // Inner minified coordinates are literal provenance, not the current map.
  // Installed buildings and jobs still require their complete local footprint.
  const packedBuildings=version>=258?new Set<object>([...(w.packed??[]),...archivedPacks].map(p=>p.building)):undefined;
  const spatialBuildings=version>=258?new Set<object>([...w.structures,...w.jobs]):undefined;
  const errors:string[]=[],owners=captureHumanOwners(w),beds=normalBeds(w);
  if(content.some(b=>b&&'kind' in b&&b.kind==='double-bed')&&w.research?.complexFurniture?.completedAt===undefined)errors.push('Locked double bed.');
  for(const bed of physical)if(isDoubleBedKind(bed.kind)){
    const material=bed.material,kind=bed.kind,geometry={id:bed.id,kind,x:bed.x,z:bed.z,orientation:bed.orientation,footprint:bed.footprint},head0=bedSlotCell(geometry,0),head1=bedSlotCell(geometry,1),d=[{x:0,z:1},{x:1,z:0},{x:0,z:-1},{x:-1,z:0}][bed.orientation];
    const literalInnerPose=!!packedBuildings?.has(bed)&&!spatialBuildings?.has(bed);
    if(bed.footprint!=='standard'||!Number.isInteger(bed.orientation)||bed.orientation<0||bed.orientation>3||Object.hasOwn(bed,'medical')||Object.hasOwn(bed,'prisoner')
      ||(kind==='double-sleeping-spot'?Object.hasOwn(bed,'material'):!materialAllowed(kind,material))||!head0||!head1||!d||(literalInnerPose
        ?!Number.isSafeInteger(bed.x)||!Number.isSafeInteger(bed.z)||bed.x<0||bed.z<0
        :[head0,head1,{x:head0.x+d.x,z:head0.z+d.z},{x:head1.x+d.x,z:head1.z+d.z}].some(c=>!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.z)||c.x<0||c.z<0||c.x>=w.width||c.z>=w.height)))errors.push('Invalid double bed footprint, material or civil role.');
  }
  for(const bed of built)if(bed.kind==='double-sleeping-spot'?Object.hasOwn(bed,'quality')||Object.hasOwn(bed,'damage'):isDoubleBedKind(bed.kind)&&(!isFurnitureQuality(bed.quality)
    ||bed.damage!==undefined&&(!Number.isSafeInteger(bed.damage)||bed.damage<0||!materialAllowed(bed.kind,bed.material)||bed.damage>=furnitureMaxHitPoints(bed.kind,bed.material))))errors.push('Invalid double bed quality or damage.');
  const assignments=new Map<string,number>(),claims=new Map<string,number>(),rescuedPatients=new Set<number>();
  const key=(bedId:number,n:BedSlot)=>`${bedId}:${n}`;
  const claim=(bedId:number,n:BedSlot,patientId:number)=>{
    const k=key(bedId,n),owner=assignments.get(k),existing=claims.get(k);
    if(owner!==undefined&&owner!==patientId||existing!==undefined&&existing!==patientId)errors.push('Duplicate double bed slot claim.');
    claims.set(k,patientId);
  };
  for(const owner of owners.pawnOwners){
    const p=owner.pawn!;
    if(!validBedSlotPawnShape(p as unknown as Record<string,unknown>,w,version)){errors.push('Invalid double bed owner or rescue slot shape.');continue;}
    if(owner.kind==='player-casket'&&(p.need||p.rescue||p.surgery)){errors.push('Contained player-casket owner retains a local bed service.');continue;}
    if(owner.kind!=='map'&&owner.kind!=='player-casket'&&prospectivePawn(p)){errors.push('Off-map owner retains a local bed slot.');continue;}
    const bed=beds.find(b=>b.id===p.bedId);
    if(isDoubleBedKind(bed?.kind)){
      if((p.faction??'colony')!=='colony'||p.state==='dead'||p.health?.death||p.prisoner||p.visitor||p.raid||p.podRescue)errors.push('Invalid double bed civilian owner.');
      const k=key(bed.id,p.bedSlot!);if(assignments.has(k))errors.push('Duplicate double bed slot ownership.');assignments.set(k,p.id);
    }
  }
  for(const owner of owners.pawnOwners){
    const p=owner.pawn!,need=p.need;
    if(need?.kind==='sleep'){
      const bed=beds.find(b=>b.id===need.bedId);
      if(isDoubleBedKind(bed?.kind)){
        const target=slot(p.bedSlot)?bedSlotCell(bed,p.bedSlot):undefined;
        if(owner.kind!=='map'||!w.structures.includes(bed)||need.bedId!==p.bedId||!target||!same(target,need.target)
          ||!['travel','sleep'].includes(need.phase)||Object.keys(need).some(k=>!['kind','phase','bedId','target','roomRest','medical'].includes(k))
          ||!object(need.target)||Object.keys(need.target).length!==2||need.medical!==undefined&&!['patient','bedrest'].includes(need.medical))errors.push('Invalid double bed sleep target or owner.');
        else {
          claim(bed.id,p.bedSlot!,p.id);
          if(need.phase==='sleep'?(p.state!=='sleeping'&&p.state!=='resting'&&p.state!=='downed')||p.path.length>0||!same(p,need.target):p.state!=='moving'||p.path.length>0&&!same(p.path.at(-1)!,need.target))errors.push('Invalid double bed sleep phase or route.');
        }
      }
    }
    const r=p.rescue;
    if(r){const bed=w.structures.find(b=>b.id===r.bedId);if(isDoubleBedKind(bed?.kind)){
      const patient=w.pawns.find(q=>q.id===r.patientId),target=slot(r.bedSlot)?bedSlotCell(bed,r.bedSlot):undefined;
      if(owner.kind!=='map'||!target||!patient||patient===p||patient.state!=='downed'||patient.health?.death||patient.rescue
        ||patient.need?.kind==='sleep'&&patient.need.bedId!==null&&patient.need.phase==='sleep'
        ||patient.bedId!==bed.id||patient.bedSlot!==r.bedSlot||rescuedPatients.has(r.patientId)||w.pawns.some(q=>q!==p&&q.rescue?.patientId===r.patientId)
        ||Object.hasOwn(r,'capture')||Object.hasOwn(r,'arrest')||Object.hasOwn(r,'release'))errors.push('Invalid double bed rescue destination.');
      else {claim(bed.id,r.bedSlot!,patient.id);if(r.phase==='carry'&&p.path.length&&!same(p.path.at(-1)!,target))errors.push('Double bed carry route misses patient slot.');}
      rescuedPatients.add(r.patientId);
      if(!isColonist(p)||p.prisoner||medicalWorkRefusal(p)||p.priorities.doctor===0&&p.orders.active!=='rescue')errors.push('Invalid double bed rescue authority.');
      if(p.state!=='moving'||p.need||p.jobId!==null||p.haul||p.cooking||p.tend||p.ward||p.feed||p.recreation.task||p.interruptedCargo)errors.push('Double bed rescue conflicts with actor activity.');
      if(r.phase==='carry'&&patient&&(patient.x!==p.x||patient.z!==p.z||patient.moveCooldown!==p.moveCooldown||!sameRescueEdge(patient.motion,p.motion)||patient.need||patient.path.length||patient.medicalSleep))errors.push('Double bed patient does not share the carrier edge.');
    }}
    if(p.surgery&&w.structures.some(b=>b.id===p.surgery!.bedId&&isDoubleBedKind(b.kind)))errors.push('Double bed cannot host an operative task.');
  }
  return errors;
}
export function validDoubleBedTransport(w:World,version:number=w.schemaVersion):boolean {
  try{return validateDoubleBeds(w,version).length===0;}catch{return false;}
}
