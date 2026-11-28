import {isAnimalItem256} from './animal-items-v256.ts';
import {unavailableEcologyItem} from './cave-products-256.ts';
import {SCHEMA_VERSION} from './types.ts';
import { V91_ITEM_IDS,V190_ITEM_IDS } from './biome-items.ts';
import { campaignPhysicalCaptures } from './campaign-people.ts';
import { otherCampaignMap } from './secondary-site-context.ts';
import { isCarePatient } from './affiliation.ts';
import { ITEM_DEFINITIONS, type ItemId } from './items.ts';
import type { CommandResult, Pawn, World } from './types.ts';

export type FoodItemId = Exclude<{[K in ItemId]: typeof ITEM_DEFINITIONS[K]['nutrition'] extends 0 ? never : K}[ItemId],'hay'|'hops'|'beer'>;
// Hops has FoodType Plant, absent from the human race's diet; Beer explicitly
// NeverForNutrition. Neither silently joins historical food policies/recipes.
export const FOOD_ITEMS = Object.keys(ITEM_DEFINITIONS).filter(id => id!=='hay'&&id!=='hops'&&id!=='beer'&&ITEM_DEFINITIONS[id as ItemId].nutrition > 0) as FoodItemId[];
export const MAX_FOOD_POLICIES = 32;
export interface FoodPolicy {id: number; name: string; allowed: FoodItemId[]}
export type FoodPolicyCommand =
  | {type: 'food-policy-create'; name: string; copyFromId?: number}
  | {type: 'food-policy-update'; policyId: number; name: string; allowed: FoodItemId[]}
  | {type: 'food-policy-delete'; policyId: number}
  | {type: 'food-policy-assign'; pawnId: number; policyId: number};

export function initialFoodPolicies(includeMeat=true,includeFoodCrops=true,includeBiomes=true,includeMilk=true,includePredators=true,includePaste=true,includeFodder=true,includePemmican=true,includeFauna256=false,includeCave256=false,version:number=SCHEMA_VERSION): FoodPolicy[] {
  const items=FOOD_ITEMS.filter(id=>!unavailableEcologyItem(id,version)&&(includeCave256||id!=='raw-fungus')&&(includeFauna256||!isAnimalItem256(id))&&(includePemmican||id!=='pemmican')&&(includeFodder||id!=='kibble')&&(includePaste||id!=='nutrient-paste-meal')&&(includePredators||!V190_ITEM_IDS.includes(id))&&(includeBiomes||!V91_ITEM_IDS.includes(id))&&(includeMeat||id!=='hare-meat')&&(includeFoodCrops||id!=='potato'&&id!=='corn')&&(includeMilk||id!=='milk'));
  return [
    {id: 1, name: 'Sans restriction', allowed: [...items]},
    {id: 2, name: 'Repas uniquement', allowed: [...(includePemmican?['pemmican' as const]:[]),'simple-meal', 'fine-meal', 'vegetarian-fine-meal', 'carnivore-fine-meal', 'lavish-meal', 'vegetarian-lavish-meal', 'carnivore-lavish-meal', 'survival-meal', 'legacy-portion', ...(includePaste?['nutrient-paste-meal' as const]:[])]},
    {id: 3, name: 'Sans rations', allowed: items.filter(id => id !== 'survival-meal')},
    {id: 4, name: 'Rien', allowed: []},
  ];
}
export const validPolicyName = (name: unknown): name is string => typeof name === 'string' && name.trim().length > 0 && name.length <= 60;
export const validAllowedFood = (v: unknown,version:number=SCHEMA_VERSION): v is FoodItemId[] => Array.isArray(v) && v.length <= FOOD_ITEMS.length
  && Array.from(v).every(id => FOOD_ITEMS.includes(id)&&!unavailableEcologyItem(id,version)) && new Set(v).size === v.length;
export function foodAllowed(world: World, pawn: Pawn, item: ItemId): boolean {
  return allowedFood(world, pawn).includes(item as FoodItemId);
}
export const allowedFood = (world: World, pawn: Pawn): readonly FoodItemId[] => allowedFoodFromPolicies(world.foodPolicies,pawn);
export const allowedFoodFromPolicies=(policies:readonly FoodPolicy[],pawn:Pawn):readonly FoodItemId[]=>pawn.mental?.crisis?FOOD_ITEMS:policies.find(policy=>policy.id===pawn.foodPolicyId)?.allowed??[];

/** The registry is shared, but each person remains in their physical map or
 * travelling owner. Frozen archives retain their historical policy IDs. */
const policyUsers=(world:World):readonly Pawn[]=>world.worldMaps||otherCampaignMap(world)?campaignPhysicalCaptures(world).flatMap(({owners})=>[...owners.local,...owners.away].map(slot=>slot.pawn!)):
  world.group&&'members' in world.group?[...world.pawns,...world.group.members]:world.pawns;

/** Policy IDs have their own namespace: migrations never renumber entities. */
export function applyFoodPolicyCommand(world: World, command: FoodPolicyCommand): CommandResult {
  const invalid = (reason: string): CommandResult => ({ok: false, code: 'invalid-command', reason});
  if(world.schemaVersion<256&&command.type==='food-policy-update'&&command.allowed.includes('raw-fungus'))return invalid('Aliment futur non admis.');
  if (command.type === 'food-policy-create') {
    const source = command.copyFromId === undefined ? undefined : world.foodPolicies.find(p => p.id === command.copyFromId);
    if (!validPolicyName(command.name) || (command.copyFromId !== undefined && !source)) return invalid('Nom ou régime à copier invalide.');
    if (world.foodPolicies.length >= MAX_FOOD_POLICIES || !Number.isSafeInteger(world.nextFoodPolicyId + 1)) return invalid('Limite de régimes atteinte.');
    world.foodPolicies.push({id: world.nextFoodPolicyId++, name: command.name.trim(), allowed: [...(source?.allowed ?? FOOD_ITEMS.filter(id=>!unavailableEcologyItem(id,world.schemaVersion)))]});
    return {ok: true};
  }
  const policy = world.foodPolicies.find(p => p.id === command.policyId);
  if (!policy) return invalid('Régime introuvable.');
  if (command.type === 'food-policy-update') {
    if (!validPolicyName(command.name) || !validAllowedFood(command.allowed,world.schemaVersion)) return invalid('Nom ou liste des aliments invalide.');
    policy.name = command.name.trim(); policy.allowed = FOOD_ITEMS.filter(id => command.allowed.includes(id));
    const users=policyUsers(world);
    for (const pawn of users) if (pawn.foodPolicyId === policy.id) pawn.needCooldown = 0;
  } else if (command.type === 'food-policy-assign') {
    const pawn = world.pawns.find(p => p.id === command.pawnId);
    if (!pawn) return invalid('Colon introuvable.');
    pawn.foodPolicyId = policy.id; pawn.needCooldown = 0;
  } else {
    const users=policyUsers(world);
    if (users.some(p => isCarePatient(p)&&p.foodPolicyId === policy.id)) return invalid('Ce régime est utilisé : réaffectez ses utilisateurs avant de le supprimer.');
    if (world.foodPolicies.length === 1) return invalid('Conservez au moins un régime.');
    world.foodPolicies.splice(world.foodPolicies.indexOf(policy), 1);
    for(const p of users)if(!isCarePatient(p)&&p.foodPolicyId===policy.id)p.foodPolicyId=world.foodPolicies[0]!.id;
  }
  // An accepted meal remains committed. Filtering applies at the next food choice,
  // independently of hauling, ingredient permissions and preservation.
  return {ok: true};
}
