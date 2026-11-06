import type {Pawn,World} from '../sim/types';
import {isSchema292OrLater} from '../sim/schema-compatibility-257.ts';

/** Confirmed map event only. Reading never adopts an occasion or grants presence. */
export function partyView292(world:World) {
 const active=isSchema292OrLater(world.schemaVersion)?world.party292?.active:undefined;
 if(!active)return;
 const minutes=Math.ceil(Math.max(0,active.startedAtCore+active.durationCore-world.tick*10)*60/2500);
 const time=minutes>=60?`${Math.floor(minutes/60)} h${minutes%60?` ${minutes%60} min`:''}`:`${minutes} min`;
 return {site:active.site,organizerId:active.organizerId,startedAtCore:active.startedAtCore,
  members:active.members,remaining:minutes>0?`encore ${time}`:'fin imminente'};
}

export function partyParticipation292(world:World,pawn:Pawn):string|undefined {
 const event=partyView292(world),task=pawn.recreation.task;
 if(!event||task?.activity!=='party'||task.partyStartedAtCore!==event.startedAtCore||!event.members.some(member=>member.pawnId===pawn.id))return;
 return `${task.phase==='travel'?'Se rend à la fête':'Participe à la fête'} · ${event.remaining}`;
}
