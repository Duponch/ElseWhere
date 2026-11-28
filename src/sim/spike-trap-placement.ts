import {isWetTerrain} from './shallow-water.ts';
import {footprintCells} from './definitions.ts';
import {validConstructionMaterial} from './construction-materials.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {isRoofJob} from './roof-rules.ts';
import {cookingCellReserved} from './cooking-bills.ts';
import {spikeTrapPlacementAllowed} from './spike-trap-state.ts';
import {isIedSchema357,isIedTrapKind357} from './ied-traps-357.ts';
import type {CommandResult,DesignateCommand,World} from './types.ts';

/** Same admission for a player blueprint, installation and paid replacement.
 * Kept outside engine so destruction/lighting cannot import its class owners. */
export function canPlaceSpikeTrap(world:World,command:DesignateCommand):CommandResult {
 const fail=(code:'invalid-command'|'occupied'|'out-of-bounds',reason:string):CommandResult=>({ok:false,code,reason});
 const ied=isIedTrapKind357(command.kind);
 if(world.schemaVersion<226||command.kind!=='spike-trap'&&!(ied&&isIedSchema357(world.schemaVersion))||(command.orientation??0)!==0||command.targetId!==undefined
  ||!validConstructionMaterial(command.kind,command.material??(ied?'steel':'wood'),world.schemaVersion))return fail('invalid-command','Piège fixe ou matériau invalide.');
 const {x,z}=command;if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=world.width||z>=world.height)return fail('out-of-bounds','Empreinte hors de la carte.');
 if(!spikeTrapPlacementAllowed(world,command))return fail('invalid-command','Aucun autre piège dans les huit cases voisines.');
 const same=(c:{x:number;z:number})=>c.x===x&&c.z===z;
 if(world.jobs.some(j=>!isRoofJob(j)&&sharesConstructionLayer(j.furniture?.kind??j.deconstruction?.kind??j.flick?.kind??j.fixBreakdown?.kind??j.kind,command.kind,world.schemaVersion,j.orientation,command.orientation)&&footprintCells(j).some(same)))return fail('occupied','Un ordre existe déjà dans cette empreinte.');
 if((['water','rock'].includes(world.tiles[z*world.width+x]!.terrain)||isWetTerrain(world.tiles[z*world.width+x]!.terrain)&&!world.tiles[z*world.width+x]!.bridge)||world.resources.some(r=>r.kind==='rock'&&same(r))
  ||world.structures.some(s=>sharesConstructionLayer(s.kind,command.kind,world.schemaVersion,s.orientation,command.orientation)&&footprintCells(s).some(same))
  ||world.pawns.some(p=>p.haul?.destination.type==='aside'&&same(p.haul.destination))||cookingCellReserved(world,command))return fail('occupied','Construction impossible : terrain, ouvrage ou réservation incompatible.');
 return {ok:true};
}
