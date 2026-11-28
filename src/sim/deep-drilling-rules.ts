import { isColonist } from './affiliation.ts';
import { allowedAreaReason } from './allowed-area-state.ts';
import { medicalWorkRefusal,pawnBody } from './health-rules.ts';
import { workPriority } from './work-types.ts';
import { isPowerActive } from './power-rules.ts';
import { empStructureActive } from './emp-state.ts';
import { footprintCells } from './definitions.ts';
import { isRoofed } from './roof-rules.ts';
import { canStandAt } from './furniture-travel.ts';
import { reservedServiceCells } from './service-reservations.ts';
import { carrierOf } from './rescue-state.ts';
import { intellectualSkill,deepDrillingUnlocked,groundScannerUnlocked } from './research.ts';
import { deepBedrock,nextDeepResource } from './deep-resources.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';

export interface DeepDrillState {progress:number;yieldPct:number;rng:number;lastUsedAt?:number}
export interface DeepScannerState {daysWorking:number;lastScanAt?:number;lastUserSpeed?:number}
export interface DeepWorkTask {structureId:number;spot:Cell;kind:'drill'|'scan'}
export function deepWorkSpot(s:Structure):Cell {
  const d=s.kind==='ground-scanner'?2:-1;
  return s.orientation===0?{x:s.x,z:s.z+d}:s.orientation===1?{x:s.x+d,z:s.z}:s.orientation===2?{x:s.x,z:s.z-d}:{x:s.x-d,z:s.z};
}
export function deepResearchSpeed(pawn:Pawn,light=1):number {
  const c=pawnBody(pawn).capacities;
  return Math.max(.1,(.08+.115*intellectualSkill(pawn).level)*(.5+.5*Math.min(1.1,c.manipulation))*(.5+.5*Math.min(1.1,c.sight))*light);
}
export function deepWorkReason(world:World,pawn:Pawn,s:Structure,accepted=false):string|undefined {
  if(world.schemaVersion<215||!world.deepResources)return 'Le forage profond n’est pas encore adopté.';
  if(s.kind!=='deep-drill'&&s.kind!=='ground-scanner'||!world.structures.includes(s))return 'Installation introuvable.';
  const areaReason=allowedAreaReason(world,pawn,s);if(areaReason)return areaReason;
  if(!isColonist(pawn)||pawn.prisoner||pawn.visitor||pawn.raid||pawn.podRescue||pawn.draft||pawn.shooting||pawn.burning||pawn.flee||pawn.mental?.crisis||pawn.interruptedCargo
    ||pawn.collapsePending||world.restRules==='legacy'&&pawn.rest===0||carrierOf(world,pawn.id)||medicalWorkRefusal(pawn))return 'Opérateur indisponible.';
  if(pawn.orbitalTrade||pawn.need||pawn.orders.active!==null||pawn.jobId!==null||pawn.haul||pawn.cooking||pawn.research||pawn.hunting||pawn.animalHandling||pawn.animalCare||pawn.animalFeed||pawn.animalRescue
    ||pawn.rescue||pawn.tend||pawn.surgery||pawn.feed||pawn.ward||pawn.equipmentTask||pawn.burial||pawn.cleaning||pawn.firefighting||pawn.recreation.task
    ||world.piles.some(p=>p.owner.type==='pawn'&&p.owner.pawnId===pawn.id))return 'Cet opérateur a une autre activité.';
  if(workPriority(pawn,s.kind==='deep-drill'?'mine':'research')<=0)return 'Travail désactivé.';
  if(s.kind==='deep-drill'?!deepDrillingUnlocked(world):!groundScannerUnlocked(world))return 'Recherche nécessaire.';
  if(!deepBedrock(world)&&(s.kind==='ground-scanner'||!nextDeepResource(world,s)))return 'Absence de socle rocheux.';
  if(!isPowerActive(s)||empStructureActive(s,world.tick*10))return 'Installation non alimentée.';
  if(world.fires?.items.some(f=>footprintCells(s).some(c=>c.x===f.x&&c.z===f.z)))return 'Installation en feu.';
  if(world.jobs.some(j=>(j.kind==='uninstall'||j.kind==='deconstruct')&&(j.deconstruction?.structureId??j.furniture?.structureId)===s.id))return 'Retrait de cette installation demandé.';
  if(s.kind==='ground-scanner'&&footprintCells(s).some(c=>isRoofed(world,c.z*world.width+c.x)))return 'Le scanner doit être à ciel ouvert.';
  const spot=deepWorkSpot(s);
  if(!canStandAt(world,spot))return 'Cellule de travail inaccessible.';
  if(world.pawns.some(p=>p!==pawn&&p.deepWork?.structureId===s.id)||reservedServiceCells(world,pawn.id).has(spot.z*world.width+spot.x))return 'Installation réservée.';
  if(!accepted&&pawn.deepWork)return 'Cet opérateur a déjà un mandat de forage.';
}
