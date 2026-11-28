import {isSchema277OrLater} from './schema-compatibility-257.ts';
import {footprintCells,footprintContains,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {isRoofed} from './roof-rules.ts';
import {STARTING_PLACE_STRUCTURES_256} from './starting-place-facts-256.ts';
import {shipCasketCells277,shipCasketContains277,shipCasketInteraction277,shipCasketBeamCell277,type ShipCasketPose277} from './ship-casket-geometry-277.ts';
import {SHIP_CASKET_CONTENT_277} from './ship-casket-content-277.ts';
import type {Cell,Orientation,World} from './types.ts';

/** Resolved existing interaction offsets, including blueprints/install jobs.
 * The native worker compares interaction cells near the candidate interaction,
 * independently from ordinary footprint collisions. No holder is read here. */
function interactionCells277(kind:string,at:Cell,rotation:Orientation):Cell[]|undefined {
 const facts=STARTING_PLACE_STRUCTURES_256[kind as keyof typeof STARTING_PLACE_STRUCTURES_256];if(!facts)return;
 const offsets=facts.multipleInteractionOffsets||(facts.hasInteractionCell?facts.interactionOffset:'');if(!offsets)return [];
 const matches=[...offsets.matchAll(/\((-?\d+),\s*-?\d+,\s*(-?\d+)\)/g)];if(!matches.length)return;
 return matches.map(m=>{let x=Number(m[1]),z=Number(m[2]);for(let n=0;n<rotation;n++){const prior=x;x=z;z=-prior;}return {x:at.x+x,z:at.z+z};});
}
export function shipCasketPlacementRefusal277(w:World,building:ShipCasketPose277,ignoredJobId?:number):string|undefined {
 if(!isSchema277OrLater(w.schemaVersion))return 'Le caisson spatial exige le schéma277.';
 if(building.kind!==undefined&&building.kind!=='ship-cryptosleep-casket')return 'Caisson spatial inconnu.';
 const rotation=building.orientation??SHIP_CASKET_CONTENT_277.defaultOrientation;
 if(!Number.isInteger(building.x)||!Number.isInteger(building.z)||![0,1,2,3].includes(rotation))return 'Position ou orientation du caisson spatial invalide.';
 const candidate={...building,kind:'ship-cryptosleep-casket' as const,orientation:rotation},cells=shipCasketCells277(building,rotation);
 const inBounds=(c:Cell)=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
 if(cells.some(c=>!inBounds(c)))return 'Empreinte du caisson spatial hors de la carte.';
 if(cells.some(c=>foggedCell256(w,c.z*w.width+c.x)))return 'Toute l’empreinte du caisson spatial doit être découverte.';
 if(cells.some(c=>isRoofed(w,c.z*w.width+c.x)))return 'Le caisson spatial doit être construit sans toit.';
 if(!marshSupportsFootprint(w,cells,candidate))return 'Le terrain doit porter une construction lourde sous le caisson spatial.';
 const beam=shipCasketBeamCell277(building,rotation);
 if(!inBounds(beam)||!w.structures.some(s=>s.kind==='ship-beam'&&footprintContains(s,beam)))return 'La tête du caisson doit toucher une poutre de vaisseau construite.';
 const overlaps=(other:Parameters<typeof footprintCells>[0])=>footprintCells(other).some(c=>shipCasketContains277(building,c,rotation));
 if(w.structures.some(s=>sharesConstructionLayer(s.kind,candidate.kind,w.schemaVersion,s.orientation,candidate.orientation)&&overlaps(s)))return 'Un ouvrage occupe déjà l’empreinte du caisson spatial.';
 const jobs=w.jobs.filter(j=>j.id!==ignoredJobId&&(j.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,j.kind)));
 if(jobs.some(j=>sharesConstructionLayer(j.furniture?.kind??j.kind,candidate.kind,w.schemaVersion,j.orientation,candidate.orientation)&&overlaps(j)))return 'Un plan ou cadre occupe déjà l’empreinte du caisson spatial.';
 const interact=shipCasketInteraction277(building,rotation);if(!inBounds(interact))return 'Interaction du caisson spatial hors de la carte.';
 for(const other of [...w.structures,...jobs]){
  if(!footprintCells(other).some(c=>Math.abs(c.x-interact.x)<=1&&Math.abs(c.z-interact.z)<=1))continue;
  const kind='furniture'in other?other.furniture?.kind??other.kind:other.kind;
  const contacts=interactionCells277(kind,other,other.orientation??0);if(!contacts)return 'Les interactions de cet ouvrage ne sont pas résolues.';
  if(!contacts.length)continue;
  if(contacts.some(c=>c.x===interact.x&&c.z===interact.z))return 'Une case d’interaction est déjà réservée par un ouvrage ou un plan.';
 }
 if(w.resources.some(r=>r.kind==='rock'&&shipCasketContains277(building,r,rotation)))return 'Dégagez les roches de l’empreinte du caisson spatial.';
 if(w.pawns.some(p=>p.haul?.destination.type==='aside'&&shipCasketContains277(building,p.haul.destination,rotation)))return 'Une livraison réserve encore l’empreinte du caisson spatial.';
 return undefined;
}
