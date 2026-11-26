import {filterPileEntries} from './pile-identity-directory.ts';
import { atMapEdge } from './raid-space.ts';
import { isColonist } from './affiliation.ts';
import { exitRaider } from './raids.ts';
import { carrierOf } from './rescue-state.ts';
import { cancelMelee } from './melee-state.ts';
import { cancelShooting } from './shooting-state.ts';
import { resetTactics } from './tactics-state.ts';
import type { Cell,MaterialPile,Pawn,World } from './types.ts';

export interface PrisonDeparture { pawnId:number;name:string;capturedAt:number;tick:number;cell:Cell;items:MaterialPile[];reason?:'released';releasedAt?:number }

/** Exit after the pawn loop, once the physical edge has arrived. The departure
 * retains ownership identities; a carried meal must first be eaten or dropped. */
export function exitPrisoner(world:World,pawn:Pawn):boolean {
  // Local detention until a complete off-map colony-person owner exists.
  if(world.schemaVersion>=213&&isColonist(pawn))return false;
  if(!world.pawns.includes(pawn)||carrierOf(world,pawn.id)||!pawn.prisoner?.escape||!atMapEdge(world,pawn)||pawn.state==='dead'||pawn.state==='downed'||pawn.need||pawn.moveCooldown>0||(pawn.motion?.end??0)>world.tick||pawn.interruptedCargo||pawn.equipmentDropPending||(pawn.stun?.untilCore??0)>world.tick*10)return false;
  if(world.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===pawn.id)||world.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===pawn.id))return false;
  if(world.schemaVersion>=204&&(pawn.melee?.strike||pawn.shooting?.stance))return false;
  if(pawn.raid){pawn.raid.exiting=true;return exitRaider(world,pawn);}
  if((world.prisonDepartures?.length??0)>=world.width*world.height)return false;
  const items=world.piles.filter(i=>(i.owner.type==='apparel'||i.owner.type==='equipment')&&i.owner.pawnId===pawn.id);
  const released=world.schemaVersion>=202&&pawn.prisoner.releasedAt!==undefined;
  if(world.schemaVersion>=204)for(const actor of world.pawns)if(actor!==pawn){
    if(actor.melee?.order&&!actor.melee.order.structure&&actor.melee.order.targetId===pawn.id){cancelMelee(actor);actor.path=[];}
    if(actor.shooting?.order?.targetId===pawn.id)cancelShooting(actor);
    if(actor.tactics?.targetId===pawn.id){resetTactics(actor);actor.path=[];}
  }
  (world.prisonDepartures??=[]).push({pawnId:pawn.id,name:pawn.name,capturedAt:pawn.prisoner.capturedAt,tick:world.tick,cell:{x:pawn.x,z:pawn.z},items,...released?{reason:'released' as const,releasedAt:pawn.prisoner.releasedAt}:{}});
  world.pawns=world.pawns.filter(p=>p!==pawn);world.piles=filterPileEntries(world.piles,i=>!items.includes(i));
  world.events.push({tick:world.tick,type:'command',message:released?`${pawn.name} a été libéré et quitte la carte avec ses objets portés.`:`${pawn.name} s'est échappé au bord de la carte avec ses objets portés.`});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
  return true;
}
