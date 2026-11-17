import {releaseDraftForOrder346} from './drafted-orders-346.ts';
import {setMaterialForbidden256} from './material-permission-256.ts';
import {clearQueuedOrders} from './player-orders.ts';
import {planCommandDrops,releaseWork} from './work-release.ts';
import {startStrip351,stripGoodwillWarning351,stripOrderIntent351} from './strip-351.ts';
import type {CommandResult,World} from './types.ts';

export {draftedStripAdmitted351,isDraftedStrip351} from './strip-state-351.ts';

/** TryTakeOrderedJob(Strip): the current job and queue end, the corpse is
 * unforbidden, and the stripping-impacts-goodwill message is sent. A direct
 * order, without a queue (adaptation, like capture and opening). */
export function applyStripOrder351(world:World,command:{type:'order-strip';pawnId:number;targetId:number}):CommandResult {
 const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
 if(!command||Reflect.ownKeys(command).length!==3||!Number.isSafeInteger(command.pawnId)||!Number.isSafeInteger(command.targetId))return fail('Ordre de dépouillement invalide.');
 const intent=stripOrderIntent351(world,command.pawnId,command.targetId);if(!intent.ok)return fail(intent.reason);
 const {pawn,target}=intent;
 const drops=planCommandDrops(world,{type:'clear-orders',pawnId:pawn.id});
 if(!drops||!releaseWork(world,pawn,drops))return fail('La cargaison doit pouvoir être déposée avant de dépouiller.');
 clearQueuedOrders(world,pawn);delete pawn.priorityWork;releaseDraftForOrder346(world,pawn);
 // The release may have moved things: recheck the route from the same state.
 const fresh=stripOrderIntent351(world,pawn.id,target.pawn.id);if(!fresh.ok)return fail(fresh.reason);
 if(fresh.target.pile)setMaterialForbidden256(fresh.target.pile,false);
 startStrip351(world,pawn,{targetId:fresh.target.pawn.id,cell:fresh.target.cell,path:fresh.path},true);
 const warning=stripGoodwillWarning351(world,fresh.target);
 if(warning){world.events.push({tick:world.tick,type:'command',message:warning});if(world.events.length>80)world.events.shift();}
 return {ok:true};
}
