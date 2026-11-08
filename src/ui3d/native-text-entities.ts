import type {World} from '../sim/types';
import type {CampaignSummary} from '../sim/world-map-state';
import {ITEM_DEFINITIONS} from '../sim/items';
import {actualAnimalName256} from '../sim/starting-pet-state-256';
import {buildingLabels} from '../ui/building-labels';
import type {NativeTextEntity} from './native-rich-text';

const objects:readonly NativeTextEntity[]=Object.freeze([...new Set([
  ...Object.values(ITEM_DEFINITIONS).map(item=>item.label),...Object.values(buildingLabels),
])].map(text=>Object.freeze({text,kind:'item' as const})));
// Cache only explicit labels, never a World or a borrowed simulation object.
const namesCache=new Map<string,readonly NativeTextEntity[]>();
let lastRaw='',lastResult:readonly NativeTextEntity[]|undefined;

/** The semantic dictionary follows actual people and named animals. Anonymous
 * capitalised prose is intentionally absent, and remains ordinary neutral ink. */
export function nativeTextEntitiesFor(world?:World,campaign?:CampaignSummary):readonly NativeTextEntity[] {
  const names=new Set<string>();
  const add=(value:string|undefined)=>{if(value?.trim())names.add(value.trim());};
  for(const pawn of world?.pawns??[])add(pawn.name);
  for(const person of world?.campaignPeople??campaign?.people??[])add(person.name);
  for(const animal of world?.wildlife?.animals??[])add(actualAnimalName256(animal));
  if(!names.size)return objects;
  // Same names in the same order as last time: same dictionary, without the
  // locale sort of a few hundred names at every HUD refresh.
  const raw=[...names].join('\u0000');if(raw===lastRaw&&lastResult)return lastResult;
  const ordered=[...names].sort((a,b)=>a.localeCompare(b,'fr')),signature=JSON.stringify(ordered);
  let result=namesCache.get(signature);
  if(!result){result=Object.freeze([...objects,...ordered.map(text=>Object.freeze({text,kind:'person' as const}))]);namesCache.set(signature,result);if(namesCache.size>8)namesCache.delete(namesCache.keys().next().value!);}
  lastRaw=raw;lastResult=result;
  return result;
}
