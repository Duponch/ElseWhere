import type {Command,World} from '../sim/types';
import {isOrderedCommand378} from '../sim/ordered-queue-378';

/** Existing queue-capable commands keep their native reserved prefix. For
 * former direct-only actions, the Worker receives an explicit queued intent,
 * not a simulated task or a delayed UI callback. Core multiselect attacks
 * issue one ordered job per eligible pawn. */
export function personalOrderCommands378(world:World,command:Command,queued:boolean):Command[] {
  if(!queued||Number(world.schemaVersion)<378)return [command];
  if(command.type==='order-bury')return [{type:'queue-order-378',order:{...command,queue:false}}];
  if(command.type==='order-consume'||command.type==='order-drafted-tend')return [{type:'queue-order-378',order:{...command,queue:false}}];
  if('queue' in command && typeof command.queue==='boolean')return [{...command,queue:true} as Command];
  if(command.type==='shoot'||command.type==='melee')return command.pawnIds.map(pawnId=>({type:'queue-order-378',order:{...command,pawnIds:[pawnId]}}));
  if(isOrderedCommand378(command))return [{type:'queue-order-378',order:command}];
  // An immediate switch/ejection isn't an actor's job and has no queue.
  return [command];
}
