import {memoryExpiry271,validSuspendedMemory271} from './suspended-memory-271.ts';
import {captureHumanOwners,type HumanOwnershipCapture} from './human-owners.ts';
import {DEATH_THOUGHT_KINDS_364,DEATH_THOUGHT_RULES} from './death-thoughts-rules.ts';
import type {DeathThoughtKind,DeathThoughtMemory} from './death-thoughts-state.ts';
import type {World} from './types.ts';

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;

/** Memories preserve the observed event, not today's line of sight, trait,
 * affiliation or surviving corpse Thing. A dead observer freezes its memories. */
export function validDeathThoughtsShape(value:unknown,version:number,tick:number,frozen=false,civilTick=tick):value is DeathThoughtMemory[]|undefined {
  if(value===undefined)return true;
  if(version<209||!integer(tick)||!Array.isArray(value)||!value.length||value.length>(version>=364?35:25)
    ||Object.keys(value).length!==value.length||Object.keys(value).some((key,index)=>key!==String(index)))return false;
  const seen=new Set<string>(),counts=new Map<DeathThoughtKind,number>();
  for(const memory of value){
    if(!object(memory)||Reflect.ownKeys(memory).length!==(Object.hasOwn(memory,'suspendedTicks')?4:3)||Object.keys(memory).some(k=>!['kind','otherId','at','suspendedTicks'].includes(k))||!validSuspendedMemory271(memory,version,tick,Number(memory.at))
      ||typeof memory.kind!=='string'||!Object.hasOwn(DEATH_THOUGHT_RULES,memory.kind)||version<364&&DEATH_THOUGHT_KINDS_364.includes(memory.kind as DeathThoughtKind)||!integer(memory.otherId,1)||!integer(memory.at,0,civilTick))return false;
    const kind=memory.kind as DeathThoughtKind,rule=DEATH_THOUGHT_RULES[kind],key=`${kind}:${memory.otherId}`;
    const count=(counts.get(kind)??0)+1;
    if(seen.has(key)||count>rule.limit||!frozen&&memoryExpiry271(memory,memory.at+rule.duration)<=Math.max(tick,memory.at))return false;
    seen.add(key);counts.set(kind,count);
  }
  return true;
}

export function validDeathThoughtsPawnShape(pawn:Record<string,unknown>,version:number,tick:number,civilTick=tick):boolean {
  if(!Object.hasOwn(pawn,'deathThoughts'))return true;
  if(pawn.deathThoughts===undefined)return false;
  const dead=pawn.state==='dead',deathAt=object(pawn.health)&&object(pawn.health.death)?pawn.health.death.tick:undefined;
  return validDeathThoughtsShape(pawn.deathThoughts,version,tick,dead,civilTick)
    &&(!dead||integer(deathAt,0,tick)&&pawn.deathThoughts!.every(m=>m.at<=deathAt));
}

/** One scoped human capture after the ordinary owners have been validated.
 * Archives retain departure clocks; terminal people retain their death clock.
 * The common absence path does not capture possessions or invent state. */
export function validDeathThoughtsTransport(world:World,version:number=world.schemaVersion):boolean {
  return validDeathThoughtsTransportForSnapshot(world,version,()=>captureHumanOwners(world));
}

/** @internal Fixed Decoder consumers only; the absence guard remains before capture. */
export function validDeathThoughtsTransportForSnapshot(world:World,version:number,readOwners:()=>HumanOwnershipCapture):boolean {
  try {
    const candidates:unknown[]=[...world.pawns];
    if(world.startingArrival&&world.startingArrival.phase!=='opened')candidates.push(...world.startingArrival.pods.map(p=>p.pawn));
    for(const owner of [world.scout,world.commercialTrip])if(owner&&'pawn' in owner)candidates.push(owner.pawn);
    if(world.group&&'members' in world.group)candidates.push(...world.group.members);
    candidates.push(...(world.groupLosses??[]).map(loss=>loss.pawn));
    for(const records of [world.visitors?.departed??[],world.podRescues?.departed??[]])candidates.push(...records.map(d=>d.pawn));
    if(!candidates.some(p=>object(p)&&Object.hasOwn(p,'deathThoughts'))&&!world.structures.some(s=>s.cryptosleep?.human?.deathThoughts?.length)&&!world.worldPawns?.heldPlayerCaskets271?.some(e=>e.casket.cryptosleep.human?.deathThoughts?.length))return true;
    const capture=readOwners();
    for(const slot of capture.pawnOwners){
      const pawn=slot.pawn!;
      if(!validDeathThoughtsPawnShape(pawn as unknown as Record<string,unknown>,version,slot.validationTick,slot.kind==='player-casket'?world.tick:slot.validationTick))return false;
      for(const memory of pawn.deathThoughts??[]){
        const other=capture.people.get(memory.otherId);
        if(memory.otherId===pawn.id||other?.status!=='dead'||other.deathAt===undefined||memory.at<other.deathAt)return false;
      }
    }
    return true;
  }catch{return false;}
}
