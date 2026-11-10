import {assignPileOwner} from './pile-index.ts';
import {planShipChunkKill256} from './ship-chunk-leavings-256.ts';
import {planGraveRelease} from './burial.ts';
import {planLocalRoadPropRubble256} from './local-road-prop-rubble-256.ts';
import {hasTravellingCargo} from './interrupted-cargo.ts';
import {planShelfRemoval} from './shelf-retirement.ts';
import { coolerSalvage } from './cooler-salvage.ts';
import { dropRetainingIdentity } from './ground-placement.ts';
import { furnitureDropCell } from './furniture-transfer.ts';
import { structureLeavesResources } from './thing-damage-rules.ts';
import type { DropPlan } from './work-release.ts';
import type { Cell,Pawn,Structure,World } from './types.ts';

/** Fatal hits only. Preview the usual cargo drops and recipe salvage together.
 * Only ownership is copied; terrain, actors, health and simulation state are
 * shared read-only. Keep existing reservations until the material commit, so
 * an unrelated or pending delivery cannot lose its promised floor capacity. */
export function planStructureDestruction(world:World,structure:Structure,actors:readonly Pawn[],origin:Cell,rng:number,thickRoof=false){
  const shelfRemoval=planShelfRemoval(world,structure);if(!shelfRemoval)return null;
  const view:World={...world,structures:world.structures.filter(s=>s.id!==structure.id),
    packed:world.packed.filter(p=>p.building.id!==structure.id).map(p=>({...p,owner:{...p.owner}})),
    piles:shelfRemoval.view.piles};
  const graveRelease=structure.kind==='sarcophagus'?planGraveRelease(view,structure):{corpseId:null};if(!graveRelease)return null;
  if(graveRelease.corpseId!==null)assignPileOwner(view.piles.find(p=>p.id===graveRelease.corpseId)!,{type:'ground',...graveRelease.cell!});
  const drops:DropPlan=new Map(shelfRemoval.drops);
  for(const actor of actors){
    if(hasTravellingCargo(world,actor))continue; // Logical arrival is not a physical drop contact.
    const pack=view.packed.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id);
    if(pack){const cell=furnitureDropCell(view,actor,actor.id);if(cell){assignPileOwner(pack,{type:'ground',...cell});drops.set(pack.building.id,cell);}}
    const pile=view.piles.find(p=>p.owner.type==='pawn'&&p.owner.pawnId===actor.id);
    if(pile&&dropRetainingIdentity(view,pile,actor)&&pile.owner.type==='ground')drops.set(pile.id,{x:pile.owner.x,z:pile.owner.z});
  }
  const ship=structure.kind==='ship-chunk'&&!thickRoof?planShipChunkKill256(view,structure,origin,rng):undefined;if(ship===null)return null;
  const rubble=ship?.rubble??planLocalRoadPropRubble256(view,structure,origin,rng);
  if(rubble){view.filth=rubble.filth;view.nextId=rubble.nextId;rng=rubble.rng;}
  const salvage=ship??(!thickRoof&&structureLeavesResources(structure)?coolerSalvage(view,{...structure,x:origin.x,z:origin.z},rng):undefined);
  return salvage===null?null:{drops,salvage,shelfRemoval,rubble,graveRelease};
}
