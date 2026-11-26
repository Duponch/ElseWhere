import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {unpublishedAncientGeneration256} from './ancient-generation-frontier-256.ts';
import {validGeographicSiteClimate256} from './site-climate-save.ts';
import {captureActualLocalDistricts256} from './actual-local-districts-256.ts';
import {footprintCells} from './definitions.ts';
import {setMaterialForbidden256} from './material-permission-256.ts';
import {refreshStock} from './materials.ts';
import {generatePlayableAncientLoot256,type PlayableAncientLootReady256 as AncientTempleLootReady256} from './functional-ancient-loot-256.ts';
import {findAncientTempleItemCell256} from './ancient-temple-item-cell-256.ts';
import type {MonumentRect256} from './ancient-monument-plan-256.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import type {MaterialPile,World} from './types.ts';

/** Creation input from the true later-settlement assembly, never save data. */
export interface NonStartingTempleBirth256 {readonly kind:'nonstarting-settlement';readonly atTick:number;readonly calendarOrigin:number}
const created=new WeakMap<AncientTempleLootReady256,{world:World;signature:string;birth:NonStartingTempleBirth256|undefined;tick:number;climate:World['climate'];calendarOrigin:number|undefined}>(),consumed=new WeakSet<AncientTempleLootReady256>();
/** This is the actual resolver's supported fresh750 catalogue, not a
 * fallback table for arbitrary future buildings. Only tables expose Eat;
 * all other currently generated envelope/road/casket Things have None. */
const kinds=new Set(['wall','door','table','table-square','column','urn','stele-large','stele-grand','sarcophagus','ancient-cryptosleep-casket','ancient-road-barrier','ancient-road-lamp','insect-hive','glow-pod']);
function actualPhase750(world:World,birth?:NonStartingTempleBirth256):void {
 const later=birth!==undefined;
 if(!isSchema256Or257(world.schemaVersion)||world.site?.revision!==3||world.planet?.revision!==3||world.jobs.length||world.resources.length||world.startingArrival||world.exploration||world.geysers||world.snow||world.fires||
  (later?birth.kind!=='nonstarting-settlement'||birth.atTick!==world.tick||!unpublishedAncientGeneration256(world,true)||world.scenario!==undefined||world.expeditionSite!==undefined||world.climate?.revision!==4||world.climate.adoptedAt!==world.tick||!validGeographicSiteClimate256(world.climate,world.schemaVersion,world,birth.calendarOrigin):world.tick!==0))throw Error(later?'Actual unpublished later-settlement temple750 birth required':'Actual unpublished initial temple750 map required');
 if(world.structures.some(s=>!kinds.has(s.kind)))throw Error('Temple item SurfaceType is unresolved for an actual generated structure');
}
/** Allocate the original playable-loot v1 Things, BEFORE casket/threat symbols.
 * The native loot table remains a separate unchanged source with its STOPs.
 * Their later producers use the resulting nextId. On any blocked option the
 * whole unpublished map must be rejected; no partial successful temple. */
export function generateActualAncientTempleLoot256(world:World,random:WorldGenerationRandom,birth?:NonStartingTempleBirth256){
 actualPhase750(world,birth);const result=generatePlayableAncientLoot256(world.nextId,random);
 if(result.status==='ready'){world.nextId=result.nextId;created.set(result,{world,signature:JSON.stringify(result),birth,tick:world.tick,climate:world.climate,calendarOrigin:birth?.calendarOrigin});}return result;
}
/** Call AFTER the actual casket/threat child symbols. No alternate World,
 * Near/ringscan placement, stack merging or runtime RNG is substituted for
 * BaseGen SingleThing. Its two searches (CanResolve then Resolve) are real.
 * A source material with no cell retires as in Core, keeping its ID gap.
 * This function is creation-only; a throw discards the complete candidate. */
export function spawnActualAncientTempleLoot256(world:World,plan:AncientTempleLootReady256,rect:MonumentRect256,random:WorldGenerationRandom,nonStartingBirth?:NonStartingTempleBirth256){
 actualPhase750(world,nonStartingBirth);
 const birth=created.get(plan);
 if(!birth||birth.world!==world||birth.signature!==JSON.stringify(plan)||birth.birth!==nonStartingBirth||birth.tick!==world.tick||birth.climate!==world.climate||birth.calendarOrigin!==nonStartingBirth?.calendarOrigin||consumed.has(plan)||!(random instanceof WorldGenerationRandom)||rect.maxZ>=world.height||rect.minX<0||rect.minZ<0||rect.maxX>=world.width||rect.maxX<rect.minX||rect.maxZ<rect.minZ)throw Error('Actual unconsumed temple loot plan required');
 if(plan.things.some(p=>p.id>=world.nextId||world.piles.some(q=>q.id===p.id)))throw Error('Temple loot identity is already owned or unallocated');
 const physical=captureActualLocalDistricts256(world),surface=new Set<number>(),itemCells=new Set<number>();
 for(const s of world.structures)if(s.kind==='table'||s.kind==='table-square')for(const c of footprintCells(s))surface.add(c.z*world.width+c.x);
 for(const pile of world.piles)if(pile.owner.type==='ground')itemCells.add(pile.owner.z*world.width+pile.owner.x);
 for(const packed of world.packed)if(packed.owner.type==='ground')itemCells.add(packed.owner.z*world.width+packed.owner.x);
 const allows=(cell:number)=>!itemCells.has(cell)&&(physical.standable(cell)||surface.has(cell));
 const spawned:number[]=[],retired:number[]=[];
 for(const original of plan.spawnOrder){
  if(findAncientTempleItemCell256(rect,allows,world.width,random)===null){retired.push(original.id);continue;}
  const cell=findAncientTempleItemCell256(rect,allows,world.width,random);if(cell===null){retired.push(original.id);continue;}
  const pile=Object.assign(original,{owner:{type:'ground' as const,x:cell%world.width,z:Math.floor(cell/world.width)}}) satisfies MaterialPile;
  setMaterialForbidden256(pile,true);appendPileEntries(world.piles,pile);itemCells.add(cell);spawned.push(pile.id);
 }
 consumed.add(plan);refreshStock(world);return {spawned,retired};
}
