import {footprintCells,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {isRoofed} from './roof-rules.ts';
import {isSchema275OrLater,isSchema276OrLater} from './schema-compatibility-257.ts';
import {SHIP_PART_DEFAULT_ORIENTATION_276,isShipAddedKind276,isShipPartKind276,type ShipPartKind276} from './ship-part-content-276.ts';
import {shipPartCells276,shipPartContains276} from './ship-part-geometry-276.ts';
import type {Cell,Orientation,World} from './types.ts';

/** Shared by designation and final materialization. Plants and movable goods
 * retain the ordinary clearing/delivery jobs, never vanish during admission. */
export function shipPartPlacementRefusal276(world:World,building:Cell&{kind:ShipPartKind276;orientation?:Orientation},ignoredJobId?:number):string|undefined {
 if(!isShipPartKind276(building.kind))return 'Pièce de vaisseau inconnue.';
 if(!(isShipAddedKind276(building.kind)?isSchema276OrLater(world.schemaVersion):isSchema275OrLater(world.schemaVersion)))return 'Cette pièce de vaisseau exige son schéma courant.';
 const orientation=building.orientation??SHIP_PART_DEFAULT_ORIENTATION_276[building.kind];
 if(!Number.isInteger(building.x)||!Number.isInteger(building.z)||!Number.isInteger(orientation)||orientation<0||orientation>3)return 'Position ou orientation de la pièce de vaisseau invalide.';
 const candidate={...building,orientation},cells=shipPartCells276(candidate);
 if(cells.some(c=>c.x<0||c.z<0||c.x>=world.width||c.z>=world.height))return 'Empreinte de la pièce de vaisseau hors de la carte.';
 if(cells.some(c=>foggedCell256(world,c.z*world.width+c.x)))return 'Toute l’empreinte de la pièce de vaisseau doit être découverte.';
 if(cells.some(c=>isRoofed(world,c.z*world.width+c.x)))return `La pièce de vaisseau doit être construite sans toit sur ses ${cells.length} cases.`;
 if(!marshSupportsFootprint(world,cells,candidate))return `Le terrain doit porter une construction lourde sur les ${cells.length} cases.`;
 const overlaps=(other:Parameters<typeof footprintCells>[0])=>footprintCells(other).some(c=>shipPartContains276(candidate,c));
 if(world.structures.some(s=>sharesConstructionLayer(s.kind,candidate.kind,world.schemaVersion,s.orientation,candidate.orientation)&&overlaps(s)))return 'Un ouvrage occupe déjà l’empreinte de la pièce de vaisseau.';
 if(world.jobs.some(j=>j.id!==ignoredJobId&&(j.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,j.kind))&&sharesConstructionLayer(j.furniture?.kind??j.kind,candidate.kind,world.schemaVersion,j.orientation,candidate.orientation)&&overlaps(j)))return 'Un plan ou cadre occupe déjà l’empreinte de la pièce de vaisseau.';
 if(world.resources.some(r=>r.kind==='rock'&&shipPartContains276(candidate,r)))return 'Dégagez les roches de l’empreinte de la pièce de vaisseau.';
 if(world.pawns.some(p=>p.haul?.destination.type==='aside'&&shipPartContains276(candidate,p.haul.destination)))return 'Une livraison réserve encore l’empreinte de la pièce de vaisseau.';
 return undefined;
}

/** Historical API retained; its42 cells and East default are unchanged. */
export function shipReactorPlacementRefusal275(world:World,building:Cell&{orientation?:Orientation},ignoredJobId?:number):string|undefined {
 return shipPartPlacementRefusal276(world,{...building,kind:'ship-reactor'},ignoredJobId);
}
