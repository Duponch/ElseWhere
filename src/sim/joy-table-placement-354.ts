import { footprintCells } from './definitions.ts';
import { isJoyTablesSchema354, JOY_TABLES_354, joyTableRing354, type JoyTableKind354 } from './joy-tables-354.ts';
import { inBounds } from './pathfinding.ts';
import { complexFurnitureUnlocked } from './research.ts';
import { structureRoomStandable } from './room-market-value.ts';
import type { Orientation, World } from './types.ts';

/** Schema 354 designation rules of the four joy buildings, in addition to the
 * shared footprint, terrain and material checks: Core research
 * (ComplexFurniture for billiards and poker, also when installing, as the
 * chess table and the save's research lock),
 * non-rotatable defs, and PlaceWorker_NeverAdjacentUnstandable of the
 * billiards table: no non-standable thing in its expanded rect. */
export function joyTablePlacementRefusal354(world:World,command:{kind:JoyTableKind354;x:number;z:number;orientation?:Orientation}):{code:'invalid-command'|'occupied';reason:string}|undefined {
  const f=JOY_TABLES_354[command.kind];
  if(!isJoyTablesSchema354(world.schemaVersion))return {code:'invalid-command',reason:'Ce jeu n’existe pas dans cet ancien format de partie.'};
  if(f.research==='complex-furniture'&&!complexFurnitureUnlocked(world))return {code:'invalid-command',reason:'Recherchez Mobilier complexe pour construire ce jeu.'};
  if(!f.rotatable&&command.orientation!==undefined&&command.orientation!==0)return {code:'invalid-command',reason:'Ce bâtiment ne se tourne pas manuellement.'};
  if(command.kind==='billiards-table'){
    const ring=joyTableRing354(footprintCells({...command,orientation:command.orientation??0}));
    for(const cell of ring){
      if(!inBounds(world,cell.x,cell.z))continue;
      if(world.tiles[cell.z*world.width+cell.x]!.terrain==='rock')return {code:'occupied',reason:'Le billard doit être entouré de cases praticables : la roche borde son emplacement.'};
    }
    for(const s of world.structures)if(!structureRoomStandable(s.kind)&&footprintCells(s).some(c=>ring.some(r=>r.x===c.x&&r.z===c.z)))
      return {code:'occupied',reason:'Le billard doit être entouré de cases praticables : un meuble ou un mur le borde.'};
  }
  return undefined;
}
