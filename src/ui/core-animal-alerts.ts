import {isPenRegionInput,penAnimalsForVersion,penHoldOpen,penRegion,penTerrainBlocked,type PenRegion} from '../sim/animal-pens';
import {animalSpecies,type AnimalSpeciesId} from '../sim/animal-species';
import {malnutritionRate} from '../sim/malnutrition';
import {workPriority} from '../sim/work-types';
import type {Pawn,Structure,World} from '../sim/types';
import type {WildAnimal} from '../sim/wildlife-state';
import {isPlayerHomeMap} from './alert-priority';
import {knownPosition256} from './exploration-readers-256';
import {actorNotificationTarget,objectNotificationTarget} from './notification-focus';
import type {StatusAlert} from './status-alerts';

/** Readers for the animal and pen alerts of RimWorld 1.6 (alerts lot B). They
 * read the confirmed snapshot without changing it and run on the alert
 * cadence. Pen regions come from the simulation's own flood (animal-pens),
 * reused across published snapshots while their barriers and terrain stay the
 * same, so a reading does not flood the whole map again. */

interface PenView {marker:Structure;region:PenRegion|undefined}
interface PenMemo {
  /** Region inputs (id, x, z, held open) of every barrier, passage and marker. */
  facts:number[];
  /** The array they were read from, its membership witnesses (the structure
   * index contract: membership changes alter length, first or last), and its
   * passages, whose held-open state is the only mutable input. */
  structures:readonly Structure[];count:number;first:Structure|undefined;last:Structure|undefined;
  passages:Structure[];holds:number[];markers:Structure[];
  tiles:World['tiles'];width:number;height:number;
  regions:Map<number,PenRegion|undefined>;
}
let penMemo:PenMemo|undefined;
function sameTerrain(previous:World['tiles'],world:World):boolean {
  if(previous===world.tiles)return true;
  if(previous.length!==world.tiles.length)return false;
  const old={tiles:previous};
  for(let i=0;i<previous.length;i++)if(penTerrainBlocked(old,i)!==penTerrainBlocked(world,i))return false;
  return true;
}
/** Every pen marker of the map with its region (undefined on a blocked cell).
 * The regions depend only on the barrier facts and the blocking terrain, so
 * they are reused while both stay the same: an unchanged structures array
 * needs only its passages' held-open states checked, a new array one pass
 * over its structures. Markers are always read from the current World. */
export function readPenViews(world:World):PenView[] {
  const memo=penMemo,source=world.structures;
  if(memo&&memo.structures===source&&memo.count===source.length&&memo.first===source[0]&&memo.last===source[source.length-1]
    &&memo.width===world.width&&memo.height===world.height&&memo.tiles===world.tiles&&memo.passages.every((s,i)=>penHoldOpen(s)===memo.holds[i]))
    return memo.markers.map(marker=>({marker,region:memo.regions.get(marker.id)}));
  // One pass: markers, passages and region inputs, compared with the memo's.
  const markers:Structure[]=[],passages:Structure[]=[],holds:number[]=[],facts:number[]=[],previous=memo?.facts;let same=!!previous;
  for(const s of source){
    if(!isPenRegionInput(s))continue;
    if(s.kind==='pen-marker')markers.push(s);
    const hold=penHoldOpen(s),k=facts.length;
    if(s.door){passages.push(s);holds.push(hold);}
    facts.push(s.id,s.x,s.z,hold);
    if(same&&(previous![k]!==s.id||previous![k+1]!==s.x||previous![k+2]!==s.z||previous![k+3]!==hold))same=false;
  }
  const reuse=!!memo&&same&&previous!.length===facts.length&&memo.width===world.width&&memo.height===world.height&&sameTerrain(memo.tiles,world);
  const regions=reuse?memo!.regions:new Map(markers.map(m=>[m.id,penRegion(world,m.id)]));
  penMemo={facts,structures:source,count:source.length,first:source[0],last:source[source.length-1],passages,holds,markers,tiles:world.tiles,width:world.width,height:world.height,regions};
  return markers.map(marker=>({marker,region:regions.get(marker.id)}));
}
/** The pen whose region holds this cell: an enclosed one first (Core
 * GetCurrentPenOf prefers it), an unenclosed one only when allowed. */
function penAt(pens:readonly PenView[],world:World,cell:{x:number;z:number},allowUnenclosed:boolean):PenView|undefined {
  const index=Math.floor(cell.z)*world.width+Math.floor(cell.x);let open:PenView|undefined;
  for(const pen of pens){
    if(!pen.region?.cells.has(index))continue;
    if(pen.region.closed)return pen;
    open??=pen;
  }
  return allowUnenclosed?open:undefined;
}

/** Core Need_Food.TicksStarving, in Core ticks, read from what the save keeps:
 * while an animal is starving its malnutrition grows by its own fixed rate
 * every 150 Core ticks, so the intervals elapsed are the severity over that
 * rate. A fed animal is not starving. A malnutrition left over from an earlier
 * hunger counts as starvation time (no clock of the last meal is kept). */
export function animalTicksStarving(animal:Pick<WildAnimal,'id'|'food'|'health'>):number {
  if(animal.food>0)return 0;
  const severity=animal.health?.malnutrition??0;
  return severity>0?Math.floor(severity/malnutritionRate(animal.id))*150:0;
}
export const PENNED_HUNGRY_CORE_TICKS=2_500;
export const STARVING_ANIMAL_CORE_TICKS=30_000;
export const STARVING_PREGNANT_CORE_TICKS=5_000;

const plural=(n:number,one:string,many:string)=>n>1?`${n} ${many}`:one;
const animalTargets=(animals:readonly WildAnimal[])=>animals.map(a=>actorNotificationTarget(a.id));
const living=(a:WildAnimal)=>a.state!=='dead'&&!a.health?.death;

/** One reading of the pen alerts: pens are captured once for all four. */
export function readAnimalPenAlerts(world:World,free:readonly Pawn[]):StatusAlert[] {
  if(!isPlayerHomeMap(world))return [];
  const animals=world.wildlife?.animals??[],rows:StatusAlert[]=[];
  const rope:ReadonlySet<AnimalSpeciesId>=new Set(penAnimalsForVersion(Number(world.schemaVersion)));
  const owned=animals.filter(a=>!!a.domestic&&rope.has(a.species)&&living(a)).sort((a,b)=>a.id-b.id);
  const predators=animals.filter(a=>!a.domestic&&living(a)&&animalSpecies(a.species).predator&&knownPosition256(world,{x:Math.floor(a.x),z:Math.floor(a.z)}));
  const pens=readPenViews(world);

  // Alert_AnimalPenNeeded (Medium): a rope-managed animal outside every pen
  // (an unenclosed one counts), not enraged, with no pen accepting its species
  // or no colonist assigned to Handling. Reaching the map edge is not checked.
  const handler=free.some(p=>workPriority(p,'handle')>0);
  const unpenned=owned.filter(a=>!a.manhunter&&!penAt(pens,world,a,true)&&(!handler||!pens.some(p=>p.marker.pen?.accepted.includes(a.species))));
  if(unpenned.length)rows.push({key:'animal-pen-needed',text:'Enclos nécessaire',targets:animalTargets(unpenned),context:{panel:'architect',category:'structure'},explanation:
    `Ces animaux d’élevage vivent en enclos et n’en ont aucun.${handler?'':' Aucun colon n’a le travail Dressage activé pour les y conduire.'} Entourez une zone de clôtures avec un portillon, placez-y un marqueur d’enclos qui accepte l’espèce, puis un dresseur y mènera les animaux.`});

  // Alert_AnimalPenNotEnclosed (Medium): a pen marker whose region is open.
  const open=pens.filter(p=>p.region&&!p.region.closed&&knownPosition256(world,p.marker));
  if(open.length)rows.push({key:'animal-pen-not-enclosed',text:plural(open.length,'Enclos non fermé','enclos non fermés'),targets:open.map(p=>objectNotificationTarget('structure',p.marker.id,p.marker)),context:{panel:'architect',category:'structure'},explanation:
    'Les clôtures autour de ce marqueur laissent un passage vers l’extérieur : les animaux ne peuvent pas y être gardés. Fermez l’enclos avec des clôtures, des murs ou un portillon.'});

  // Alert_PredatorInPen (Medium): a wild predator inside an enclosed pen.
  const intruders=predators.filter(a=>penAt(pens,world,a,false));
  if(intruders.length)rows.push({key:'predator-in-pen',text:`Prédateur dans un enclos : ${animalSpecies(intruders[0]!.species).label}`,targets:animalTargets(intruders),explanation:
    'Un prédateur sauvage est entré dans un enclos et peut attaquer les animaux qui y vivent. Chassez-le ou ouvrez-lui le portillon pour qu’il reparte.'});

  // Alert_PennedAnimalHungry (Medium): a penned animal starving for more than
  // 2 500 Core ticks inside an enclosed pen.
  const hungry=owned.filter(a=>animalTicksStarving(a)>PENNED_HUNGRY_CORE_TICKS&&penAt(pens,world,a,false));
  if(hungry.length)rows.push({key:'penned-animal-hungry',text:plural(hungry.length,'Animal affamé dans un enclos','animaux affamés dans un enclos'),targets:animalTargets(hungry),context:{panel:'animals'},explanation:
    'Ces animaux n’ont plus rien à manger dans leur enclos. Agrandissez l’enclos vers de l’herbe ou déposez du foin ou de la nourriture à l’intérieur.'});
  return rows;
}

/** Alert_StarvationAnimals (Medium): a colony animal starving for more than
 * 30 000 Core ticks, or 5 000 when pregnant. Only animals present on this map
 * are read (animals travelling with a caravan are not). */
export function readStarvationAnimals(world:World):StatusAlert|undefined {
  const starving=(world.wildlife?.animals??[]).filter(a=>!!a.domestic&&living(a)
    &&animalTicksStarving(a)>(a.pregnancy?STARVING_PREGNANT_CORE_TICKS:STARVING_ANIMAL_CORE_TICKS)).sort((a,b)=>a.id-b.id);
  if(!starving.length)return;
  return {key:'starvation-animals',text:plural(starving.length,'Animal affamé','animaux affamés'),targets:animalTargets(starving),context:{panel:'animals'},explanation:
    'Ces animaux de la colonie meurent de faim. Donnez-leur accès à de la nourriture : pâturage, foin ou aliments autorisés dans leur zone.'};
}

