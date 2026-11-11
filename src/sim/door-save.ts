import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveLocal297} from './core-phase-297.ts';
import {validExplorationDoorApproacher256,type ResolveExplorationApproacher256} from './exploration-door-256.ts';
import {captureActualExplorationApproachers256} from './exploration-actors-256.ts';
import {explorationEnabled256} from './exploration-state-256.ts';
import { doorOpenness, doorMotionTicks, fenceGateOpenTicks303, isFenceGateSpeedSchema303, manualDoorOpenTicks } from './door-rules.ts';
import type { World } from './types.ts';
export function validateDoors(world:World,version:number,providedResolver?:ResolveExplorationApproacher256):string[] {
  const now297=isCorePhysicalSchema297(version)?effectiveLocal297(world):world.tick;
  const coreDate297=(v:number,min:number):boolean=>Number.isFinite(v)&&v>=min&&v<=now297&&Number.isSafeInteger(Math.round(v*10))&&Math.round(v*10)/10===v;
  const errors:string[]=[];let actual:ResolveExplorationApproacher256|undefined;
  const resolve:ResolveExplorationApproacher256=providedResolver??(id=>{actual??=captureActualExplorationApproachers256(world);return actual(id);});
  for(const s of [...world.structures,...world.jobs]) {
    const d=(s as import('./types.ts').Structure).door;
    const isDoor=s.kind==='door'||version>=119&&s.kind==='fence-gate'||version>=143&&s.kind==='autodoor';
    if(isDoor&&s.orientation!==0)errors.push('Door orientation must be automatic.');
    if(!isDoor||!world.structures.includes(s as import('./types.ts').Structure)||version<34) {
      if(d!==undefined)errors.push('Unexpected door state.');continue;
    }
    const approach=!!d&&Object.hasOwn(d,'explorationApproacherId');
    // Schema 303: a fence gate may record the Core gate speed (door-rules.ts).
    const gateSpeed=s.kind==='fence-gate'&&!!d&&typeof d==='object'&&Object.hasOwn(d,'duration');
    try{if(d&&!validExplorationDoorApproacher256(d,version,explorationEnabled256(world),world.nextId,resolve)){errors.push('Invalid actual exploration door approach owner.');continue;}}catch{errors.push('Unresolved actual exploration actor owner.');continue;}
    if(!d||typeof d!=='object'||Array.isArray(d)||Object.keys(d).length!==(s.kind==='autodoor'||gateSpeed?8:7)+(approach?1:0)||!['open','holdOpen','forbidden'].every(k=>typeof d[k as keyof typeof d]==='boolean')
      ||!(isCorePhysicalSchema297(version)?coreDate297(d.changedAt,0):Number.isSafeInteger(d.changedAt)&&d.changedAt>=0&&d.changedAt<=world.tick)||!Number.isFinite(d.from)||d.from<0||d.from>1
      ||!(isCorePhysicalSchema297(version)?coreDate297(d.lastTouch,-12):Number.isSafeInteger(d.lastTouch)&&d.lastTouch>= -12&&d.lastTouch<=world.tick)
      ||!(d.closeAt===null||Number.isFinite(d.closeAt)&&d.closeAt>=now297&&d.closeAt<=now297+21)
      ||!d.open&&d.closeAt!==null||gateSpeed&&!(isFenceGateSpeedSchema303(version)&&d.duration===fenceGateOpenTicks303(s))||s.kind==='autodoor'&&(typeof d.duration!=='number'||![manualDoorOpenTicks(s),manualDoorOpenTicks(s)/4].includes(d.duration))) {errors.push('Invalid door state.');continue;}
    if(s.orientation!==0||s.material===undefined)errors.push('Door requires an explicit material and automatic orientation.');
    // No new movement enters a closed/incompletely opened door. A later forbid
    // does not invalidate the committed edge; construction protects its corners.
    for(const p of world.pawns)if(p.motion&&p.motion.end>now297&&p.x===s.x&&p.z===s.z) {
      if(!d.open||d.changedAt>p.motion.start&&d.from<1-1e-7||d.changedAt<=p.motion.start&&d.from+(p.motion.start-d.changedAt)/doorMotionTicks(s)<1-1e-7)errors.push('Travel entered a door before opening.');
    }
    if(!Number.isFinite(doorOpenness(s as import('./types.ts').Structure,now297)))errors.push('Invalid door pose.');
  }
  return errors;
}
