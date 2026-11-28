import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {firefoamResearchUnlocked290} from './firefoam-content-290.ts';
import {footprintCells} from './definitions.ts';
import {sharesConstructionLayer} from './power-grid.ts';
import {isRoofJob} from './roof-rules.ts';
import {cookingCellReserved} from './cooking-bills.ts';
import {marshSupportsFootprint} from './marsh.ts';
import {foggedCell256} from './exploration-state-256.ts';
import type {CommandResult,DesignateCommand,World} from './types.ts';

/** Shared admission for a new paid plan and a replacement. Installation keeps
 * the recovered original and therefore does not require research again. */
export function canPlaceFirefoamPopper290(world:World,command:DesignateCommand,installing=false):CommandResult {
 const fail=(code:'invalid-command'|'occupied'|'out-of-bounds'|'missing-target',reason:string):CommandResult=>({ok:false,code,reason});
 if((Number(world.schemaVersion)!==290&&(Number(world.schemaVersion)!==291&&(Number(world.schemaVersion)!==292&&(Number(world.schemaVersion)!==293&&(Number(world.schemaVersion)!==294&&(Number(world.schemaVersion)!==295&&(Number(world.schemaVersion)!==296&&!isCorePhysicalSchema297(Number(world.schemaVersion)))))))))||command.kind!=='firefoam-popper'||(command.orientation??0)!==0||command.targetId!==undefined
  ||(command.material??'steel')!=='steel'||command.floor!==undefined)return fail('invalid-command','Diffuseur fixe ou matériau invalide.');
 if(!installing&&!firefoamResearchUnlocked290(world))return fail('invalid-command','Recherchez Mousse anti-incendie.');
 const {x,z}=command;if(!Number.isInteger(x)||!Number.isInteger(z)||x<0||z<0||x>=world.width||z>=world.height)return fail('out-of-bounds','Empreinte hors de la carte.');
 if(foggedCell256(world,z*world.width+x))return fail('missing-target','Cette cellule n’est pas encore découverte.');
 const same=(c:{x:number;z:number})=>c.x===x&&c.z===z;
 if(!marshSupportsFootprint(world,[{x,z}],{kind:'firefoam-popper',material:'steel'}))return fail('occupied','Le terrain ne porte pas cet appareil.');
 if(world.jobs.some(j=>!isRoofJob(j)&&sharesConstructionLayer(j.furniture?.kind??j.deconstruction?.kind??j.flick?.kind??j.fixBreakdown?.kind??j.kind,'firefoam-popper',world.schemaVersion,j.orientation,0)&&footprintCells(j).some(same))
  ||world.tiles[z*world.width+x]!.terrain==='rock'||world.resources.some(r=>r.kind==='rock'&&same(r))
  ||world.structures.some(s=>sharesConstructionLayer(s.kind,'firefoam-popper',world.schemaVersion,s.orientation,0)&&footprintCells(s).some(same))
  ||world.pawns.some(p=>p.haul?.destination.type==='aside'&&same(p.haul.destination))||cookingCellReserved(world,command))return fail('occupied','Construction impossible : terrain, ouvrage ou réservation incompatible.');
 return {ok:true};
}
