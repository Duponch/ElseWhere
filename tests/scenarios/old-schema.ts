import {isTextileApparelItem308,isTextileMaterial308} from '../../src/sim/textile-apparel-308.ts';
import {isGarmentItem312} from '../../src/sim/apparel-definitions.ts';
import {deserializeWorld,serializeWorld} from '../../src/sim/serialization.ts';
const FIRST_DAYS_KINDS_343=['slept-in-cold','slept-in-heat','slept-outside','slept-on-ground','soaking-wet','darkness'];
const MOOD_POOL_KINDS_350=['sleep-disturbed','nuzzled','released-prisoner','bonded-animal-died','bonded-animal-lost'];

/** A current save relabelled as an older schema must first drop the content
 * that the older schema could not hold; strict validation still refuses it.
 * Schema 308: the new leather and wool garments in apparel policies; schema
 * 312: the T-shirts and jackets; schema 332: the trader caravan agenda of a
 * home visitor calendar (an arrived caravan group is kept, and refused);
 * schema 341: the recent-incident records of the Misc and World calendars
 * (a concurrent raid group is kept, and refused); schema 343: the
 * CrashedTogether opinions, the NewColonyOptimism of a new game and the
 * sleep, soaking-wet and darkness memories (an emptied social state that
 * never interacted, and an emptied memory list, are removed); schema 344: the
 * campaign's simple Work tab setting (an older game always has manual
 * priorities); schema 345: the room size need; schema 349: the tutorial
 * lessons' record (a 347/348 tutorial had none); schema 350: the mood pool
 * memories, RescuedMe opinions, the psychic drone/soothe calendar and the
 * animals' nuzzle check (a break of a 350 kind is kept, and refused). */
export function asOldSchema(json:string,version:number):string {
  const raw=JSON.parse(json) as Record<string,unknown>;
  raw.schemaVersion=version;
  stripFutureContent(raw,version);
  return JSON.stringify(raw);
}
function strip(value:unknown,version:number):void {
  if(Array.isArray(value)){for(const v of value)strip(v,version);return;}
  if(!value||typeof value!=='object')return;
  const o=value as Record<string,unknown>;
  if(version<312&&Array.isArray(o.allowedItems)&&Array.isArray(o.allowedMaterials)){
    o.allowedItems=(o.allowedItems as unknown[]).filter(i=>!isGarmentItem312(i)&&(version>=308||!isTextileApparelItem308(i)));
    if(version<308)o.allowedMaterials=(o.allowedMaterials as unknown[]).filter(m=>!isTextileMaterial308(m));
  }
  if(version<332&&o.profile==='cassandra-visitors-v1'&&Object.hasOwn(o,'caravan332'))delete o.caravan332;
  if(version<341&&(o.profile==='cassandra-misc-v1'||o.profile==='cassandra-world-v1')&&Object.hasOwn(o,'recent341'))delete o.recent341;
  if(version<350){
    if(Array.isArray(o.roomMemories)){o.roomMemories=(o.roomMemories as {kind?:unknown}[]).filter(m=>!MOOD_POOL_KINDS_350.includes(String(m?.kind)));if(!(o.roomMemories as unknown[]).length)delete o.roomMemories;}
    const social=o.social as Record<string,unknown>|undefined;
    if(social&&typeof social==='object'&&Array.isArray(social.memories)){
      social.memories=(social.memories as {kind?:unknown}[]).filter(m=>m?.kind!=='rescued-me');
      if(!(social.memories as unknown[]).length&&Object.keys(social).every(k=>k==='rng'||k==='memories'))delete o.social;
    }
    if(o.revision===1&&typeof o.nextMoveOrderIsWait==='boolean')delete o.nuzzle350;
    if(o.profile==='cassandra-misc-v1')for(const k of ['psychicDrones350','psychicSoothes350','lastPsychicDrone350','lastPsychicSoothe350','psychic350'])delete o[k];
  }
  // Schema 345: the room size need of colonists and prisoners.
  if(version<345&&Object.hasOwn(o,'roomSize345'))delete o.roomSize345;
  if(version<343){
    if(Array.isArray(o.lostMemories))o.lostMemories=(o.lostMemories as {kind?:unknown}[]).filter(m=>m?.kind!=='new-colony-start343');
    if(Array.isArray(o.roomMemories)){o.roomMemories=(o.roomMemories as {kind?:unknown}[]).filter(m=>!FIRST_DAYS_KINDS_343.includes(String(m?.kind)));if(!(o.roomMemories as unknown[]).length)delete o.roomMemories;}
    const social=o.social as Record<string,unknown>|undefined;
    if(social&&typeof social==='object'&&Array.isArray(social.memories)){
      social.memories=(social.memories as {kind?:unknown}[]).filter(m=>m?.kind!=='crashed-together');
      if(!(social.memories as unknown[]).length&&Object.keys(social).every(k=>k==='rng'||k==='memories'))delete o.social;
    }
  }
  for(const v of Object.values(o))if(v&&typeof v==='object')strip(v,version);
}
/** What any old save of `current` becomes once migrated: the content a later
 * schema gives only at creation is absent (schema 343: the CrashedTogether
 * opinions and NewColonyOptimism of a new Crashlanded colony). */
export const asMigratedCurrent=(current:string):string=>serializeWorld(deserializeWorld(asOldSchema(current,342)));
/** Same as asOldSchema on a parsed save or an in-memory world (mutated). */
export function stripFutureContent(value:unknown,version:number):void {
  if(version<344&&value&&typeof value==='object'&&!Array.isArray(value))delete (value as Record<string,unknown>).simpleWorkTab344;
  // Schema 349: the lessons' record of a tutorial game.
  if(version<349&&value&&typeof value==='object'&&!Array.isArray(value)){const tutorial=((value as Record<string,{tutorial347?:Record<string,unknown>}>).gameProfile)?.tutorial347;if(tutorial)delete tutorial.lessons349;}
  if(version<350)strip(value,version);
}
