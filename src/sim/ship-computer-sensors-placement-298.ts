import {footprintCells,STRUCTURE_DEFINITIONS} from './definitions.ts';
import {foggedCell256} from './exploration-state-256.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {isRoofed} from './roof-rules.ts';
import {isShipComputerSensorsKind298,isShipComputerSensorsSchema298,type ShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {shipComputerSensorsCells298,shipComputerSensorsContains298} from './ship-computer-sensors-geometry-298.ts';
import type {Cell,Orientation,World} from './types.ts';

export interface ShipComputerSensorsPose298 extends Cell {kind:ShipComputerSensorsKind298;orientation?:Orientation}
/** Called both before designation and before final materialization. Ordinary
 * clearing/hauling/collision rules still own plants, movable goods and actors. */
export function shipComputerSensorsPlacementRefusal298(w:World,b:ShipComputerSensorsPose298,ignoredJobId?:number):string|undefined {
 if(!isShipComputerSensorsSchema298(w.schemaVersion))return 'Cette pièce exige le schéma prospectif298.';
 if(!isShipComputerSensorsKind298(b.kind))return 'Pièce de vaisseau inconnue.';
 if(!Number.isSafeInteger(b.x)||!Number.isSafeInteger(b.z)||(b.orientation??0)!==0)return 'Cette pièce de vaisseau non orientable exige son orientation initiale.';
 const cells=shipComputerSensorsCells298(b),inBounds=(c:Cell)=>c.x>=0&&c.z>=0&&c.x<w.width&&c.z<w.height;
 if(cells.some(c=>!inBounds(c)))return 'Empreinte de la pièce de vaisseau hors de la carte.';
 if(cells.some(c=>foggedCell256(w,c.z*w.width+c.x)))return 'Toute l’empreinte de la pièce de vaisseau doit être découverte.';
 if(cells.some(c=>isRoofed(w,c.z*w.width+c.x)))return 'La pièce de vaisseau doit être construite sans toit sur ses quatre cases.';
 if(!marshSupportsFootprint(w,cells,b))return 'Le terrain doit porter une construction lourde sur les quatre cases.';
 const overlaps=(other:Parameters<typeof footprintCells>[0])=>footprintCells(other).some(c=>shipComputerSensorsContains298(b,c));
 if(w.structures.some(s=>sharesConstructionLayer(s.kind,b.kind,w.schemaVersion,s.orientation,b.orientation)&&overlaps(s)))return 'Un ouvrage occupe déjà l’empreinte de la pièce de vaisseau.';
 if(w.jobs.some(j=>j.id!==ignoredJobId&&(j.kind==='install'||Object.hasOwn(STRUCTURE_DEFINITIONS,j.kind))&&sharesConstructionLayer(j.furniture?.kind??j.kind,b.kind,w.schemaVersion,j.orientation,b.orientation)&&overlaps(j)))return 'Un plan ou cadre occupe déjà l’empreinte de la pièce de vaisseau.';
 if(w.resources.some(r=>r.kind==='rock'&&shipComputerSensorsContains298(b,r)))return 'Dégagez les roches de l’empreinte de la pièce de vaisseau.';
 if(w.pawns.some(p=>p.haul?.destination.type==='aside'&&shipComputerSensorsContains298(b,p.haul.destination)))return 'Une livraison réserve encore l’empreinte de la pièce de vaisseau.';
 return undefined;
}
