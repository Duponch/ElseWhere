import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {registeredMapId} from './world-map-context.ts';
import {groupAnimalPreparation} from './group-animal-formation-256.ts';
import {animalCarrier} from './animal-rest-state.ts';
import {readAnimalAreaChoice287,type AnimalAreaChoice287} from './animal-area-state-287.ts';
import type {NavigationCostLookup} from './navigation-costs.ts';
import type {AnimalSpeciesId} from './animal-species.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Cell,World} from './types.ts';

/** Resolved Core1.6 default profiles: roamers retain their existing pen owner. */
const supported=new Set<AnimalSpeciesId>(['grizzly-bear','polar-bear','boomrat','cat','cobra','cougar','elephant','arctic-fox','fennec-fox','red-fox','guinea-pig','hare','husky','iguana','labrador-retriever','lynx','megascarab','megasloth','megaspider','monkey','panther','raccoon','rat','rhinoceros','snow-hare','spelopede','squirrel','tortoise','warg','arctic-wolf','timber-wolf','yorkshire-terrier']);
export const ANIMAL_OUTSIDE_AREA_COST_287=60000;
supported.add('thrumbo');
export const supportsAnimalAreas287=(species:AnimalSpeciesId):boolean=>supported.has(species);
/** Canonical preference remains visible while a real collective job masks it. */
export function currentAnimalAreaChoice287(w:World,a:WildAnimal):AnimalAreaChoice287|null {
 const mapId=registeredMapId(w);return isSchema287OrLater(w.schemaVersion)&&mapId!==undefined?readAnimalAreaChoice287(a,mapId):null;
}
export interface AnimalAreaPolicy287 {
 readonly choice:AnimalAreaChoice287;
 readonly cells:readonly number[];
 has(index:number):boolean;
 readonly costs:NavigationCostLookup;
}
export function animalAreaEffective287(w:World,a:WildAnimal):boolean {
 return isSchema287OrLater(w.schemaVersion)&&!!a.domestic&&supportsAnimalAreas287(a.species)&&!!w.wildlife?.animals.includes(a)
  &&a.state!=='dead'&&!a.health?.death&&a.shipCryptosleepHeldAt277===undefined&&!animalCarrier(w,a.id)
  &&!a.confusion&&!a.manhunter&&!a.burning&&!a.flee&&!a.threat&&!a.retaliation&&!a.strike&&!groupAnimalPreparation(w,a.id);
}
/** Immutable decision-local membership; no identity-only cache across edits. */
export function animalAreaPolicyFromCells287(w:Pick<World,'width'|'height'>,choice:AnimalAreaChoice287|null,cells:readonly number[]|undefined):AnimalAreaPolicy287|undefined {
 if(!choice||!cells?.length)return;
 const indices=[...cells],membership=new Set(indices),size=w.width*w.height;
 const has=(i:number)=>Number.isInteger(i)&&i>=0&&i<size&&membership.has(i);
 return {choice:{...choice},cells:indices,has,costs:{maximum:ANIMAL_OUTSIDE_AREA_COST_287,has:i=>!has(i),get:i=>has(i)?undefined:ANIMAL_OUTSIDE_AREA_COST_287}};
}
/** One synchronous pass may share grids. Actor effect is reread on every call;
 * discard this reader before any area edit. Mutable standalone reads recapture. */
export function createAnimalAreaPolicyReader287(w:World):(a:WildAnimal)=>AnimalAreaPolicy287|undefined {
 const grids=new Map<string,AnimalAreaPolicy287|undefined>();
 return a=>{
  const choice=currentAnimalAreaChoice287(w,a);if(!choice||!animalAreaEffective287(w,a))return;
  const key=choice.kind==='home'?'home':`allowed:${choice.areaId}`;
  if(!grids.has(key))grids.set(key,animalAreaPolicyFromCells287(w,choice,choice.kind==='home'?w.home:w.allowedAreas?.find(row=>row.id===choice.areaId)?.cells));
  return grids.get(key);
 };
}
export function captureAnimalAreaPolicy287(w:World,a:WildAnimal):AnimalAreaPolicy287|undefined {return createAnimalAreaPolicyReader287(w)(a);}
export function animalAreaAllows287(w:World,a:WildAnimal,c:Cell,policy?:AnimalAreaPolicy287):boolean {
 const read=policy??captureAnimalAreaPolicy287(w,a);return !read||read.has(c.z*w.width+c.x);
}
