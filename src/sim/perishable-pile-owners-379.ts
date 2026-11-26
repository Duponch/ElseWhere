import {isPerishable} from './food-preservation.ts';
import {eggSpeciesForItem256} from './animal-egg-content-v256.ts';
import {capturePileMembershipCursor379,pileMembershipCursorCurrent379,readPileMembershipCursor379,type PileMembershipCursor379} from './pile-identity-directory.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {MaterialPile,World} from './types.ts';

function thermalCandidate(p:MaterialPile):boolean {
  // Installed save admission permits rot on perishable item/corpse owners
  // only. Retain all potential component owners rather than caching their
  // mutable age or inspecting the rot clock when constructing membership.
  // Fertilized eggs can acquire an unfertilized item/rot on ruined commit.
  // The real item-change writer retires the same pile membership journal.
  return p.kind==='corpse'||isPerishable(p.item)||eggSpeciesForItem256(p.item)!==undefined;
}
const eggCandidate=(p:MaterialPile)=>eggSpeciesForItem256(p.item)!==undefined;
interface Members {readonly owner:object;cursor:PileMembershipCursor379;thermal:Set<MaterialPile>;eggs:Set<MaterialPile>}
const byWorld=new WeakMap<World,Members>();

/** Exact ordered potential component members on a closed actual map. The
 * membership writer guarantees ordered survivors followed by append rows,
 * even across native filter replacements. A middle insertion, gap, unknown
 * transaction or owner change gets a complete fresh capture. Age, temperature,
 * parent, position and live egg state are still read at their original time.
 * Every public mutable read retains its historical full array. */
function members(world:World):Members|undefined {
  const owner=terrainJournalReadOwner();
  if(!owner||world.schemaVersion<256){byWorld.delete(world);return;}
  const piles=world.piles;
  let cached=byWorld.get(world);
  if(cached?.owner!==owner)cached=undefined;
  if(cached&&!pileMembershipCursorCurrent379(piles,owner,cached.cursor)){
    const delta=readPileMembershipCursor379(piles,owner,cached.cursor);
    if(!delta||delta.edits.some(edit=>edit.unordered))cached=undefined;
    else {
      // In a valid map each pile record occurs exactly once. An ordered Set
      // retains first/source ordering and naturally follows append at the end.
      apply:for(const edit of delta.edits){
        for(const p of edit.removed){
          const wasThermal=cached.thermal.delete(p),wasEgg=cached.eggs.delete(p);
          if(wasThermal!==thermalCandidate(p)||wasEgg!==eggCandidate(p)){cached=undefined;break apply;}
        }
        for(const p of edit.appended){
          if(thermalCandidate(p)){if(cached.thermal.has(p)){cached=undefined;break apply;}cached.thermal.add(p);}
          if(eggCandidate(p)){if(cached.eggs.has(p)){cached=undefined;break apply;}cached.eggs.add(p);}
        }
      }
      if(cached)cached.cursor=delta.cursor;
    }
  }
  if(!cached){
    const thermal=new Set<MaterialPile>(),eggs=new Set<MaterialPile>();
    for(const pile of piles){
      if(thermalCandidate(pile)){if(thermal.has(pile)){byWorld.delete(world);return;}thermal.add(pile);}
      if(eggCandidate(pile)){if(eggs.has(pile)){byWorld.delete(world);return;}eggs.add(pile);}
    }
    const cursor=capturePileMembershipCursor379(piles,owner);
    if(!cursor){byWorld.delete(world);return;}
    cached={owner,cursor,thermal,eggs};byWorld.set(world,cached);
  }
  if(verifyTerrainWriteCaches){
    const a=cached.thermal.values(),b=cached.eggs.values();
    for(const p of piles){
      const candidate=thermalCandidate(p);
      if(p.rot&&!candidate)throw Error('Unobserved thermal pile component outside its admitted item family');
      if(candidate&&a.next().value!==p)throw Error('Thermal pile membership differs from its complete ordered capture');
      if(eggCandidate(p)&&b.next().value!==p)throw Error('Egg pile membership differs from its complete ordered capture');
    }
    if(!a.next().done||!b.next().done)throw Error('Stale perishable pile membership');
  }
  return cached;
}
export function thermalPileOwners379(world:World):ReadonlySet<MaterialPile>|readonly MaterialPile[] {
  return members(world)?.thermal??world.piles;
}
/** A hatching iteration may retire the current pile and append a different
 * one. Match the old copied pass by returning a detached ordered list; the
 * next query sees mutations through the independent journal. */
const EMPTY_EGGS:readonly MaterialPile[]=Object.freeze([]);
export function eggPileSnapshot379(world:World):readonly MaterialPile[]|undefined {
  const resident=members(world);
  return resident?resident.eggs.size?[...resident.eggs]:EMPTY_EGGS:undefined;
}
