import {requireOriginalStartingRoster256,type StartingOriginalRoster256} from './starting-original-roster-256.ts';
import {chooseStartingPetKind256,startingPetMinimumHandling256,type StartingPetKind256} from './starting-pet-selection-256.ts';
import {INITIAL_ANIMAL_FACTS_256} from './initial-animal-data-256.ts';
import {prepareWorldAnimalGeneration256} from './world-pawn-generation-256.ts';
import {worldPawnSituation256} from './world-pawn-capture-256.ts';
import {productKind} from './animal-products.ts';
import {TAMENESS_DECAY} from './animal-handling.ts';
import type {StartingPetState256,ActualStartingPet256} from './starting-pet-state-256.ts';
import type {WorldGenerationRandom} from './world-generation-random.ts';
import type {World,Cell} from './types.ts';

const first=['Aube','Bise','Cendre','Dune','Écume','Flocon','Galet','Mousse'] as const;
const second=['claire','douce','fine','lune','nacre','pluie','ronde','vive'] as const;
/** Read by the lore registry (src/lore); the lists are unchanged. */
export {first as STARTING_PET_NAME_FIRST_256,second as STARTING_PET_NAME_SECOND_256};
/** Original lexical model, deliberately declared as an adaptation. Actual
 * variable draws/retries are retained; no estimated Core grammar counter is
 * inserted and no proprietary names/rule text are copied. */
export function drawOriginalStartingPetName256(random:Pick<WorldGenerationRandom,'integer'>,used:ReadonlySet<string>):string {
 let name='';for(let attempt=0;attempt<150;attempt++){name=first[random.integer(0,first.length)]+'-'+second[random.integer(0,second.length)];if(!used.has(name))return name;}return name;
}
export interface StartingPetBirth256 {readonly kind:StartingPetKind256;readonly animal:ActualStartingPet256;readonly nextId:number;commit():ActualStartingPet256}
/** Actual initial player ownership only. This reuses the delivered initial
 * animal constructor; it does not claim complete Player PawnGenerator request
 * or proprietary name-grammar equivalence. The five retained original starters
 * prove the initial WorldPawn population; a later animal roster must use the
 * full request-aware faction/redress path, never this fresh initial shortcut. */
export function prepareStartingPetBirth256(world:World,roster:StartingOriginalRoster256,cell:Readonly<Cell>,random:WorldGenerationRandom,usedNames:ReadonlySet<string>):StartingPetBirth256|{blocked:string} {
 requireOriginalStartingRoster256(world,roster);
 if(world.tick!==0||world.planet?.revision!==3||world.site?.revision!==3||!world.worldPawns||world.worldPawns!==roster.worldPawns||world.worldPawns.owners.some(r=>r.kind!=='human'||!r.startingPawnLeftBehind||r.factionId!==roster.factions.playerFactionId))return {blocked:'Starting pet requires the actual initial five retained humans'};
 const selected=roster.selected.map(e=>e.pawn),kind=chooseStartingPetKind256(selected,random),fact=INITIAL_ANIMAL_FACTS_256[kind.defId as keyof typeof INITIAL_ANIMAL_FACTS_256];
 if(!fact)return {blocked:'Selected actual pet has no constructor: '+kind.defId};
 const generation=prepareWorldAnimalGeneration256(world.worldPawns,{tick:0,nextId:world.nextId,random,situation:worldPawnSituation256,weight:()=>{throw Error('Initial retained humans are not animal redress candidates');}});
 const made=generation.generate(fact,{x:cell.x,z:cell.z});if(made.status==='blocked')return {blocked:made.reason};
 const animal=made.animal;
 // Tameness complete has no Core Rand draw. Reuse the delivered domestic
 // owner, whose maintenance cadence is an existing explicit adaptation.
 animal.domestic={since:0,care:'herbal',tameness:5,nextDecay:TAMENESS_DECAY,...productKind(animal)?{productFullness:0}:{}};
 const pet:StartingPetState256={revision:1,name:drawOriginalStartingPetName256(random,usedNames)};
 // Direct Value<1 may be false at the genuine float endpoint1. Keep that
 // draw even for a race which cannot learn Obedience.
 const bondTrial=random.value()<1;
 if(bondTrial&&(kind.trainability==='Intermediate'||kind.trainability==='Advanced')){
  const minimum=startingPetMinimumHandling256(kind.wildness);
  // The branded actual delivered starters have the known nine-trait model;
  // it produces neither Psychopath nor Inhumanized. No old Pawn is inferred
  // to lack an unrepresented trait in this creation-only consumer.
  const candidates=selected.filter(p=>!p.prisoner&&p.skills.animals!.level>=minimum);
  if(candidates.length){const master=candidates[random.integer(0,candidates.length)]!;pet.masterId=master.id;pet.bondedPawnId=master.id;pet.obedience={steps:3,wanted:true};}
 }
 const actual=Object.assign(animal,{startingPet:pet});let used=false;
 return {kind,animal:actual,nextId:generation.nextId,commit(){if(used)throw Error('Starting pet birth already consumed');used=true;const originals=generation.commit();if(originals.length!==1||originals[0]!==animal)throw Error('Initial pet was replaced at adoption');return actual;}};
}
