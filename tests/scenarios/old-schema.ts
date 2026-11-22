import {LEGACY_TRAIT_IDS} from '../../src/sim/traits.ts';
import {isTextileApparelItem308,isTextileMaterial308} from '../../src/sim/textile-apparel-308.ts';
import {isGarmentItem312,isHatItem353} from '../../src/sim/apparel-definitions.ts';
import {isCookingAnimalProduct353} from '../../src/sim/cooking-ingredients-353.ts';
import {isDevilstrandItem358} from '../../src/sim/devilstrand-358.ts';
import {deserializeWorld,serializeWorld} from '../../src/sim/serialization.ts';
import type {World} from '../../src/sim/types.ts';
const FIRST_DAYS_KINDS_343=['slept-in-cold','slept-in-heat','slept-outside','slept-on-ground','soaking-wet','darkness'];
const TRAIT_LINK_IDS_362:readonly string[]=['undergrounder','tortured-artist','wimp'];
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
 * animals' nuzzle check (a break of a 350 kind is kept, and refused);
 * schema 352: the campaign's letters, stack, archive and pins; schema 353:
 * the cowboy and bowler hats in apparel policies and bill filters, and the
 * eggs and insect jelly in bill filters; schema 358: the devilstrand garments
 * and material in apparel policies and the devilstrand key of bill filters;
 * schema 359: the outdoors need;
 * schema 361: the trait ids of the Core trait set (a person keeps only the
 * nine older ids, and none at all if it held no older one; faction leaders
 * and departed visitors keep none); schema 362: the Undergrounder, Tortured
 * artist and Wimp degrees, the indoors need, the wimp's record marker and
 * the not-mood marker of a crisis; schema 368: the Pyromaniac degree (a
 * fire-starting spree is kept, and refused). */
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
  // Schema 360: a pawn's active inspiration.
  if(version<360&&Object.hasOwn(o,'inspiration360'))delete o.inspiration360;
  // Schema 368: the Pyromaniac degree.
  if(version<368&&Array.isArray(o.traits)&&o.traits.every(id=>typeof id==='string')&&o.traits.includes('pyromaniac')){
    const kept=(o.traits as string[]).filter(id=>id!=='pyromaniac');
    if(kept.length)o.traits=kept;else delete o.traits;
  }
  // Schema 362: the three new trait degrees and what they hold.
  if(version<362){
    if(Array.isArray(o.traits)&&o.traits.every(id=>typeof id==='string')&&o.traits.some(id=>TRAIT_LINK_IDS_362.includes(id as string))){
      const kept=(o.traits as string[]).filter(id=>!TRAIT_LINK_IDS_362.includes(id));
      if(kept.length)o.traits=kept;else delete o.traits;
    }
    if(Object.hasOwn(o,'indoors362'))delete o.indoors362;
    if(Object.hasOwn(o,'wimp362'))delete o.wimp362;
    if(Object.hasOwn(o,'notMood362'))delete o.notMood362;
  }  // Schema 361: the Core trait set; an older save holds only the nine old ids.
  if(version<361&&Array.isArray(o.traits)&&o.traits.every(id=>typeof id==='string')){
    const kept=(o.traits as string[]).filter(id=>(LEGACY_TRAIT_IDS as readonly string[]).includes(id));
    if(kept.length)o.traits=kept;else delete o.traits;
  }
  // Faction leaders and departed visitors held no traits at all before 361.
  if(version<361&&o.pawn&&typeof o.pawn==='object'&&(Object.hasOwn(o,'factionId')&&Object.hasOwn(o,'clock')||Object.hasOwn(o,'group')&&Object.hasOwn(o,'tick')&&Object.hasOwn(o,'items')))delete (o.pawn as Record<string,unknown>).traits;
  if(version<358){
    if(Array.isArray(o.allowedItems)&&Array.isArray(o.allowedMaterials)){o.allowedItems=(o.allowedItems as unknown[]).filter(i=>!isDevilstrandItem358(i));o.allowedMaterials=(o.allowedMaterials as unknown[]).filter(m=>m!=='devilstrand');}
    if(typeof o.recipe==='string'&&o.filters&&typeof o.filters==='object'&&!Array.isArray(o.filters))for(const k of Object.keys(o.filters))if(isDevilstrandItem358(k))delete (o.filters as Record<string,unknown>)[k];
  }
  if(version<353){
    if(Array.isArray(o.allowedItems)&&Array.isArray(o.allowedMaterials))o.allowedItems=(o.allowedItems as unknown[]).filter(i=>!isHatItem353(i));
    if(typeof o.recipe==='string'&&o.filters&&typeof o.filters==='object'&&!Array.isArray(o.filters))for(const k of Object.keys(o.filters))if(isCookingAnimalProduct353(k)||isHatItem353(k))delete (o.filters as Record<string,unknown>)[k];
  }
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
  // Schema 359: the outdoors need of colonists and prisoners.
  if(version<359&&Object.hasOwn(o,'outdoors359'))delete o.outdoors359;
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
/** What a pre-353 save of `current` becomes once migrated: a new game's
 * apparel policies also allow the schema 353 hats, which an older save cannot
 * hold and the number-only migration does not add. */
export const asMigratedFrom352=(current:string):string=>serializeWorld(deserializeWorld(asOldSchema(current,352)));
/** Same for a pre-358 save: a new game's policies and tailoring bills also
 * allow devilstrand, which the number-only migration does not add. */
export const asMigratedFrom357=(current:string):string=>serializeWorld(deserializeWorld(asOldSchema(current,357)));
/** Same as asOldSchema on a parsed save or an in-memory world (mutated). */
export function stripFutureContent(value:unknown,version:number):void {
  if(version<344&&value&&typeof value==='object'&&!Array.isArray(value))delete (value as Record<string,unknown>).simpleWorkTab344;
  // Schema 352: the campaign's letters, their stack and archive.
  if(version<352&&value&&typeof value==='object'&&!Array.isArray(value))delete (value as Record<string,unknown>).letters352;
  // Schema 349: the lessons' record of a tutorial game.
  if(version<349&&value&&typeof value==='object'&&!Array.isArray(value)){const tutorial=((value as Record<string,{tutorial347?:Record<string,unknown>}>).gameProfile)?.tutorial347;if(tutorial)delete tutorial.lessons349;}
  if(version<368)strip(value,version);
}

/** The reference for a number-only migration step from `version`: the same
 * content saved one schema later, then migrated like the old one. Comparing a
 * migrated `version` save with it checks that the step `version`→`version+1`
 * changes only the number, while later steps (308 and 312 extend apparel
 * policies, for example) apply to both alike. Comparing with `current` itself
 * no longer works: a new game holds more than an old save gains by migration
 * (352 letters, 353 hats and 358 devilstrand in new apparel policies). */
export function asNumberOnly(current:string,version:number):string {
  return serializeWorld(deserializeWorld(asOldSchema(current,version+1)));
}
/** The same reference for a parsed old save already relabelled and stripped. */
export function numberOnlyWorld(old:Record<string,unknown>):World {
  return deserializeWorld(JSON.stringify({...old,schemaVersion:Number(old.schemaVersion)+1}));
}
