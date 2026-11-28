import type { Cell } from './types.ts';
import type { TravelSegment } from './travel-timing.ts';
import type { MedicalRecord } from './injury-types.ts';
import type { StaggerState } from './stagger.ts';
import type { CaravanRestMark266 } from './caravan-rest-state-266.ts';
import { ANIMAL_SPECIES,type AnimalSpeciesId,type FaunaBiomeId } from './animal-species.ts';

export interface WildAnimal extends Cell { shipCryptosleepHeldAt277?:number; filthFeet?:import('./filth-rules.ts').FilthFeet; hiveThink?:import('./cave-hive-think-256.ts').HiveThinkData256; hiveJob?:import('./cave-hive-lord-256.ts').HiveDutyJob256; hive?:import('./cave-insect-constructor-256.ts').HiveInsectMembership256; startingPet?:import("./starting-pet-state-256.ts").StartingPetState256; arrivalRotation?:import('./types.ts').Orientation; growthTracker?:import("./animal-growth-runtime-256.ts").AnimalGrowthTracker256; caravanCarrySick?:boolean; corpseDamage?:number;
  animalThermalRefuge288?:import('./animal-thermal-refuge-state-288.ts').AnimalThermalRefuge288;
  animalMapAreas287?:import('./animal-area-state-287.ts').AnimalMapAreas287;
  animalAreaReturn287?:import('./animal-area-state-287.ts').AnimalAreaReturn287;
  /** Last actual caravan rest; retained history, never a local rest promise. */
  caravanRest?:CaravanRestMark266;
  wander?:import('./animal-condition-mental-state-256.ts').AnimalWanderState256;
  confusion?:import('./animal-condition-mental-state-256.ts').AnimalConfusion256;
  mapBed?:import('./actor-map-bed-256.ts').ActorMapBed256;
  /** Real prospective Duck tracker, absent on historical actors. */
  exitFlight?:import('./duck-flyer-state-256.ts').DuckExitFlight256;
  flight?:import('./duck-flight-state-256.ts').DuckFlight256;
  eggLayer?:import('./animal-egg-state-v256.ts').AnimalEggLayer256;
  /** `box374`: schema 374, the egg box laid into (JobGiver_LayEgg.GetBestEggBox). */
  eggLay?:{target:Cell;progress:number;box374?:number};
  animalRest?:import('./animal-rest-state.ts').AnimalRestTask;
  domestic?:import('./domestic-state.ts').DomesticAnimal;
  /** Prospective acquired skills on this same original, including wild returns. */
  training?:import('./animal-training-state-282.ts').AnimalTrainingState282;
  /** Real local storage service, or a true held pile awaiting Near cleanup. */
  haul?:import('./animal-hauling-state-282.ts').AnimalHaulTask282;
  taming?:import('./domestic-state.ts').TamingDesignation;
  id:number; species:AnimalSpeciesId; sex:'female'|'male';
  /** Biological age in local ticks. Historical animals enter V121 as adults. */
  ageTicks:number;
  /** Prospective exact Core age remainder, never installed by migration. */
  ageCoreRemainder?:number;
  /** Identity survives even after either parent leaves the map. */
  parents?:{motherId:number;fatherId:number};
  /** A full gestation waits for a physical, available birth cell. */
  pregnancy?:{fatherId:number;progress:number};
  /** Physical mating action on the male; 50 local ticks complete one attempt. */
  mating?:{femaleId:number;progress:number};
  /** Nutrition units, distinct from a human's percentage gauge. */
  food:number; rest:number;
  state:'idle'|'moving'|'eating'|'sleeping'|'hungry'|'downed'|'dead';
  health?:MedicalRecord;
  burning?:import('./fire-rules.ts').BurningReaction;
  corpseRot?:import('./food-preservation.ts').RotState;
  flee?:{danger:Cell;until:number};
  stagger?:StaggerState;
  stun?:import('./stun.ts').StunState;
  threat?:{targetId:number;harmedAtCore:number};
  retaliation?:{targetId:number;untilCore:number};
  strike?:NonNullable<import('./melee-state.ts').MeleeState['strike']>;
  /** Physical predator hunt; never a reservation of the living prey. */
  predation?:{targetId:number;startedAtCore:number;firstHit:boolean};
  /** Temporary mental hostility, distinct from retaliation and predation. */
  manhunter?:{permanent261?:true;startedAtCore:number;rng:number;zeroRestTicks:number;exhausted?:true;targetId?:number;door?:{targetId:number;remaining:number;untilCore:number}};
  sleepUntilCore?:number;
  path:Cell[]; motion?:TravelSegment; nextDecision:number;
  meal?:{kind:'plant'|'pile';id:number;quantity:number;progress:number};
  exiting?:{destination:Cell;nextFoodCheck:number};
  /** Rare visiting thrumbo's real Core departure deadline. Only local wild original. */
  exitAtCore382?:number;
}
export interface WildlifeState {
  geographicRenewal262?:import('./geographic-renewal-state-262.ts').GeographicRenewal262;
  hiveLords?:import('./cave-hive-state-256.ts').HiveLord256[];
  flyers?:import('./duck-flyer-state-256.ts').DuckFlyer256[];
  profile:'temperate-hares-v1'|'biome-herbivores-v1'|'biome-fauna-v2'|'geographic-fauna-v3'; rng:number; animals:WildAnimal[];
  eatenPlants:number; eatenNutrition:number; eatenItems:number;
  exitedAnimals?:number;
  population?:{biome:FaunaBiomeId;fullTargetWeight:number;targetWeight:number;nextCheck:number;checks:number;arrivals:number};
}
/** Compatibility alias: existing V76 callers and snapshots keep exact values. */
export const HARE=ANIMAL_SPECIES.hare;
export const MAX_WILDLIFE=256;
export function wildlifeRandom(s:WildlifeState):number {
  let n=s.rng;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng/0x100000000;
}
