import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Pawn,Job,World} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';

const human=(p:Pawn)=>!!(p.recreation.task?.activity==='read'||p.burial||p.hunting||p.equipmentTask||p.cooking||p.animalHandling||p.animalCare||p.surgery||p.tend||p.need?.kind==='eat'||p.feed||p.animalFeed||p.ward||p.haul||p.orders?.queue?.length);
const animalService=(p:Pawn)=>!!(p.animalHandling||p.animalCare||p.animalFeed||p.animalRescue||p.shipCasketTask277||p.hunting);
const animal=(a:WildAnimal)=>!!(a.meal?.kind==='pile'||a.haul);
const tree=(j:Job)=>j.tree?.kind==='replant';
interface Roster<T> {source:readonly T[];count:number;first:T|undefined;last:T|undefined;ordinals:Map<T,number>;members:Set<T>;rows:T[]}
interface Scope {world:World;owner:object;human?:Roster<Pawn>;animalService?:Roster<Pawn>;animal?:Roster<WildAnimal>;job?:Roster<Job>;activeHuman?:Pawn;activeAnimal?:WildAnimal}
let scope:Scope|undefined;
const noAnimals:readonly WildAnimal[]=[];
const isCurrent=<T>(r:Roster<T>|undefined,source:readonly T[]):r is Roster<T>=>!!r&&r.source===source&&r.count===source.length&&r.first===source[0]&&r.last===source[source.length-1];
function capture<T>(source:readonly T[],possible:(actor:T)=>boolean,active?:T):Roster<T> {
 const ordinals=new Map<T,number>(),members=new Set<T>(),rows:T[]=[];
 for(let i=0;i<source.length;i++){const row=source[i]!;ordinals.set(row,i);if(row===active||possible(row)){rows.push(row);members.add(row);}}
 return {source,count:source.length,first:source[0],last:source[source.length-1],ordinals,members,rows};
}
function change<T>(r:Roster<T>,actor:T,include:boolean):void {
 const slot=r.ordinals.get(actor);if(slot===undefined||include===r.members.has(actor))return;
 if(include){let low=0,high=r.rows.length;while(low<high){const mid=(low+high)>>>1;if(r.ordinals.get(r.rows[mid]!)!<slot)low=mid+1;else high=mid;}r.rows.splice(low,0,actor);r.members.add(actor);}
 else{r.rows.splice(r.rows.indexOf(actor),1);r.members.delete(actor);}
}
function verify<T>(r:Roster<T>,possible:(actor:T)=>boolean):void {
 const expected=r.source.filter(possible),actual=r.rows.filter(possible);
 if(actual.length!==expected.length||actual.some((a,i)=>a!==expected[i]))throw Error('Source reservation ownership changed outside its actor decision boundary');
}
interface DecisionScope {human(p:Pawn):void;animal(a:WildAnimal):void;close():void}
const inert:DecisionScope={human(){},animal(){},close(){}};
/** The actual autonomous decision pass, not a guessed tick or a per-query
 * cache. A current actor can publish any task during its turn and is always
 * admitted; its successor retires that turn according to the committed live
 * task roots. Other humans/animals can cancel/release tasks (including need,
 * transport and service interruptions) but only their own decision installs
 * a new positive source claim here. Cross-owner sleep, held cargo and
 * pregnancy/mating states are not source reservations. A population change
 * rebuilds the source-order directory before the next reader. The returned
 * candidate rows are live, never cached task fields or quantities. */
export function beginSourceReservationCandidates379(world:World):DecisionScope {
 const owner=terrainJournalReadOwner();if(!owner)return inert;
 const previous=scope,current:Scope={world,owner};scope=current;
 return {
  human(p){if(current.activeHuman===p)return;
   const index=current.human;if(isCurrent(index,world.pawns)){if(current.activeHuman)change(index,current.activeHuman,human(current.activeHuman));change(index,p,true);}else current.human=undefined;
   const service=current.animalService;if(isCurrent(service,world.pawns)){if(current.activeHuman)change(service,current.activeHuman,animalService(current.activeHuman));change(service,p,true);}else current.animalService=undefined;
   current.activeHuman=p;},
  animal(a){if(current.activeAnimal===a)return;const index=current.animal;if(isCurrent(index,world.wildlife?.animals??noAnimals)){if(current.activeAnimal)change(index,current.activeAnimal,animal(current.activeAnimal));change(index,a,true);}else current.animal=undefined;current.activeAnimal=a;},
  close(){scope=previous;},
 };
}
export interface SourceReservationCandidates379 {readonly people:readonly Pawn[];readonly animals:readonly WildAnimal[];readonly trees:readonly Job[]}
export function sourceReservationCandidates379(world:World):SourceReservationCandidates379|undefined {
 const current=scope;if(current?.world!==world||current.owner!==terrainJournalReadOwner())return;
 const people=world.pawns,animals=world.wildlife?.animals??noAnimals,jobs=world.jobs;
 if(!isCurrent(current.human,people))current.human=capture(people,human,current.activeHuman);
 if(!isCurrent(current.animal,animals))current.animal=capture(animals,animal,current.activeAnimal);
 if(!isCurrent(current.job,jobs))current.job=capture(jobs,tree);
 if(verifyTerrainWriteCaches){verify(current.human,human);verify(current.animal,animal);verify(current.job,tree);}
 return {people:current.human.rows,animals:current.animal.rows,trees:current.job.rows};
}

/** Same synchronous decision owner, but independent candidate family. A
 * human rescue/casket/handling/hunt may acquire an animal even without a
 * physical source-pile claim. Include the current actor before its decision
 * so every newly installed task is immediately visible; other actors can
 * release their tasks and retained candidates always re-read live roots. */
export function animalServiceDecisionCandidates379(world:World):readonly Pawn[]|undefined {
 const current=scope;if(current?.world!==world||current.owner!==terrainJournalReadOwner())return;
 const people=world.pawns;
 if(!isCurrent(current.animalService,people))current.animalService=capture(people,animalService,current.activeHuman);
 if(verifyTerrainWriteCaches)verify(current.animalService,animalService);
 return current.animalService.rows;
}
