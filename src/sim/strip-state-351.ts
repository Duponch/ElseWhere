import {APPAREL,type ApparelItem} from './apparel-definitions.ts';
import type {MoodThought} from './mood.ts';
import type {Command,Pawn,World} from './types.ts';

/** Schema 351: Core RimWorld 1.6 Strip and the dead man's apparel thought.
 * Facts only, nothing copied:
 * - DesignationDef Strip (target Thing). Designator_Strip designates every
 *   thing of an unfogged cell that StrippableUtility.CanBeStrippedByColony
 *   accepts and that is not designated yet. It is also a reverse designator
 *   (ReverseDesignatorDatabase): the inspector of a strippable thing shows it.
 * - CanBeStrippedByColony: an IStrippable with AnythingToStrip (equipment,
 *   inventory or worn apparel); a corpse always; a pawn only when its kind can
 *   be stripped, it is not carried, and it is downed or a secure prisoner of
 *   the colony.
 * - WorkGiverDef Strip: Hauling, priorityInType 100, Manipulation; the scanner
 *   reads the designations, skips when there is none, reserves the target and
 *   rechecks CanBeStrippedByColony.
 * - JobDriver_Strip: reserve, go to ClosestTouch, wait StripTicks = 60, then
 *   delete the designation and call Strip. Fails when the target despawns,
 *   enters an aggressive mental state or cannot be stripped any more.
 * - Pawn.Strip drops the equipment, then the worn apparel (both unforbidden),
 *   then the inventory, near the corpse or pawn position. Apparel worn at
 *   death already carries WornByCorpse (Apparel.Notify_PawnKilled); stripping
 *   never sets or clears it. A living stripped member of a visible, non-hostile
 *   faction costs 40 goodwill (Faction.Notify_MemberStripped).
 * - DeadMansApparel (ThoughtWorker_ApparelThought): count of worn WornByCorpse
 *   apparel; stage = min(count, 4) - 1, offsets -5/-8/-11/-14; nullified by the
 *   Bloodlust trait; valid while despawned. */
export const STRIP_SCHEMA_351=351;
export const isStrip351=(version:unknown):boolean=>Number(version)>=STRIP_SCHEMA_351;
/** JobDriver_Strip.StripTicks in Core ticks (one local tick is ten). */
export const STRIP_CORE_TICKS_351=60;
/** Faction.Notify_MemberStripped goodwill change. */
export const STRIP_GOODWILL_351=-40;
/** Same bound as the hunting designations. */
export const MAX_STRIP_DESIGNATIONS_351=256;
/** One designation on a person or a corpse. `dead` and `colony` record the
 * thing designated: a living pawn that dies becomes a new Corpse thing, and
 * SetFaction to or from the player removes the designations (Core). */
export interface StripDesignation351 {targetId:number;dead:boolean;colony:boolean}
/** The Strip job of one colonist. `forced` is a player order (float menu). */
export interface StripTask351 {targetId:number;phase:'approach'|'strip';progressCore:number;lastWorkedAt:number;forced?:true}
export type StripCommand351={type:'strip-designate';targetId:number;enabled:boolean}|{type:'order-strip';pawnId:number;targetId:number};

const own=(v:unknown,key:string):PropertyDescriptor|undefined=>v&&typeof v==='object'?Object.getOwnPropertyDescriptor(v,key):undefined;
const plain=(v:unknown,keys:readonly string[],optional:readonly string[]=[]):v is Record<string,unknown>=>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)return false;
 const present=Reflect.ownKeys(v);
 if(present.some(k=>typeof k!=='string'||!keys.includes(k)&&!optional.includes(k)))return false;
 for(const k of present){const d=own(v,k as string)!;if(!d.enumerable||!Object.hasOwn(d,'value'))return false;}
 return keys.every(k=>Object.hasOwn(v,k));
};
const id=(v:unknown,nextId:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>0&&v<nextId;

/** The world field: absent below 351 and when empty; strict shape. */
export function validStripDesignations351(world:unknown,version:number,nextId:number):boolean {
 const d=own(world,'strip351');if(!d)return !(world&&typeof world==='object'&&'strip351'in world);
 if(!isStrip351(version)||!d.enumerable||!Object.hasOwn(d,'value')||!Array.isArray(d.value))return false;
 const list=d.value as unknown[];if(!list.length||list.length>MAX_STRIP_DESIGNATIONS_351||Object.getPrototypeOf(list)!==Array.prototype)return false;
 const seen=new Set<number>();
 for(const entry of list){
  if(!plain(entry,['targetId','dead','colony'])||!id(entry.targetId,nextId)||typeof entry.dead!=='boolean'||typeof entry.colony!=='boolean'||seen.has(entry.targetId))return false;
  seen.add(entry.targetId);
 }
 return true;
}
/** The pawn field: absent below 351; strict shape and clock. */
export function validStripTaskField351(pawn:unknown,version:number,tick:number,nextId:number):boolean {
 const d=own(pawn,'strip351');if(!d)return !(pawn&&typeof pawn==='object'&&'strip351'in pawn);
 if(!isStrip351(version)||!d.enumerable||!Object.hasOwn(d,'value'))return false;
 const t=d.value;
 if(!plain(t,['targetId','phase','progressCore','lastWorkedAt'],['forced'])||!id(t.targetId,nextId)||(t.phase!=='approach'&&t.phase!=='strip'))return false;
 if(typeof t.progressCore!=='number'||!Number.isSafeInteger(t.progressCore)||t.progressCore<0||t.progressCore>=STRIP_CORE_TICKS_351||t.progressCore%10!==0||t.phase==='approach'&&t.progressCore!==0)return false;
 if(typeof t.lastWorkedAt!=='number'||!Number.isSafeInteger(t.lastWorkedAt)||t.lastWorkedAt<0||t.lastWorkedAt>tick)return false;
 return !Object.hasOwn(t,'forced')||t.forced===true;
}

/** ThoughtDef DeadMansApparel: the label names the first counted piece. */
export function deadMansApparelThought351(count:number,firstItem:ApparelItem):MoodThought|undefined {
 if(!Number.isSafeInteger(count)||count<1)return undefined;
 const stage=Math.min(count,4)-1,label=APPAREL[firstItem]?.label??'vêtement';
 const suffix=['',' (+1)',' (+2)',' etc.'][stage]!;
 return Object.freeze({id:'dead-mans-apparel',label:`Vêtement de mort : ${label}${suffix}`,offset:[-5,-8,-11,-14][stage]!,kind:'situation',
  description:count===1?'Porter une pièce prise sur quelqu’un qui y est mort met mal à l’aise.':`Porter ${count} pièces prises sur des morts met mal à l’aise.`});
}

/** A drafted colonist accepts the Strip order (FloatMenuOptionProvider_Strip:
 * Drafted = true); it stays drafted and waits once the job ends. */
export const draftedStripAdmitted351=(world:Pick<World,'schemaVersion'>,command:Command):boolean=>isStrip351(world.schemaVersion)&&command.type==='order-strip';
export const isDraftedStrip351=(world:Pick<World,'schemaVersion'>,pawn:Pawn):boolean=>isStrip351(world.schemaVersion)&&!!pawn.draft&&!!pawn.strip351?.forced;
