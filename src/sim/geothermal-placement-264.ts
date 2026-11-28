import {footprintCells,footprintContains,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {geyserAt256} from './local-geyser-state-256.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {foggedCell256} from './exploration-state-256.ts';
import type {Cell,Orientation,World} from './types.ts';

/** Core's geyser Position is the minimum corner of its natural 2×2; our
 * generator is stored at the minimum corner of its fixed 6×6 footprint. */
export function geothermalPlacementRefusal264(world:World,building:Cell&{orientation?:Orientation},ignoredJobId?:number):string|undefined {
  if(world.schemaVersion<264||world.site?.revision!==3||(building.orientation??0)!==0)return 'La centrale géothermique exige un geyser géographique et ne se tourne pas.';
  if(!Number.isInteger(building.x)||!Number.isInteger(building.z)||building.x<0||building.z<0||building.x+5>=world.width||building.z+5>=world.height)return 'Empreinte géothermique hors de la carte.';
  const center={x:building.x+2,z:building.z+2},geyser=geyserAt256(world,center);
  if(!geyser||geyser.x!==center.x||geyser.z!==center.z)return 'Centrez exactement la centrale sur un geyser naturel.';
  const candidate={...building,kind:'geothermal-generator' as const},cells=footprintCells(candidate);
  if(cells.some(c=>foggedCell256(world,c.z*world.width+c.x)))return 'Toute l’empreinte de la centrale doit être découverte.';
  if(!marshSupportsFootprint(world,cells,candidate))return 'Le terrain doit porter une construction lourde sur les 36 cases.';
  const overlaps=(other:Parameters<typeof footprintCells>[0])=>footprintCells(other).some(c=>footprintContains(candidate,c));
  if(world.structures.some(s=>sharesConstructionLayer(s.kind,candidate.kind,world.schemaVersion,s.orientation,candidate.orientation)&&overlaps(s)))return 'Un ouvrage occupe déjà l’empreinte géothermique.';
  if(world.jobs.some(j=>j.id!==ignoredJobId&&(j.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,j.kind))&&sharesConstructionLayer(j.furniture?.kind??j.kind,candidate.kind,world.schemaVersion,j.orientation,candidate.orientation)&&overlaps(j)))return 'Un plan ou cadre occupe déjà l’empreinte géothermique.';
  if(world.resources.some(r=>r.kind==='rock'&&footprintContains(candidate,r)))return 'Dégagez les roches de l’empreinte géothermique.';
  if(world.pawns.some(p=>p.haul?.destination.type==='aside'&&footprintContains(candidate,p.haul.destination)))return 'Une livraison réserve encore l’empreinte géothermique.';
  return undefined;
}
