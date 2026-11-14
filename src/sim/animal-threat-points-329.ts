import {ANIMAL_SPECIES} from './animal-species.ts';
import {animalCore256,isAnimalSpecies256} from './animal-core-v256.ts';
import {summaryHealthPercent} from './threat-points.ts';
import type {World} from './types.ts';

/** Core StorytellerUtility.DefaultThreatPointsNow (schema 329): every colony
 * animal standing and able to learn Release (trainability Intermediate or
 * Advanced) adds 0.08 x its combat power, blended 65 % toward its health:
 * x (0.35 + 0.65 x health). Historical species without Core data add none. */
export function homeAnimalThreatPoints329(w:World):number {
  if(w.schemaVersion<329)return 0;
  let total=0;
  for(const a of w.wildlife?.animals??[]){
    if(!a.domestic||a.state==='dead'||a.state==='downed'||!isAnimalSpecies256(a.species))continue;
    const trainability=animalCore256(a.species).race.trainability;
    if(trainability!=='Intermediate'&&trainability!=='Advanced')continue;
    const health=a.health?summaryHealthPercent(a.health):1;
    total+=.08*ANIMAL_SPECIES[a.species].combatPower*(.35+.65*health);
  }
  return total;
}
