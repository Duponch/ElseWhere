import { V91_ITEM_IDS,V190_ITEM_IDS } from './biome-items.ts';
import { initialFoodPolicies, MAX_FOOD_POLICIES, validAllowedFood, validPolicyName } from './food-policy.ts';
import type { World } from './types.ts';

export function validateFoodPolicies(world: World, version: number): string[] {
  if (version < 13) return world.foodPolicies !== undefined || world.nextFoodPolicyId !== undefined || world.pawns.some(p => p.foodPolicyId !== undefined)
    ? ['Legacy save contains food policy fields.'] : [];
  const errors: string[] = [],ids=new Set<number>();
  if (!Number.isSafeInteger(world.nextFoodPolicyId) || world.nextFoodPolicyId < 2) errors.push('Invalid next food policy ID.');
  if (!Array.isArray(world.foodPolicies) || world.foodPolicies.length < 1 || world.foodPolicies.length > MAX_FOOD_POLICIES) return [...errors, 'Invalid food policies.'];
  for (const p of world.foodPolicies) {
    if (!p || typeof p !== 'object' || !Number.isSafeInteger(p.id) || p.id < 1 || p.id >= world.nextFoodPolicyId || ids.has(p.id)
      || version<248&&Array.isArray(p.allowed)&&p.allowed.includes('pemmican')|| version<227&&Array.isArray(p.allowed)&&p.allowed.includes('kibble')|| version<217&&Array.isArray(p.allowed)&&p.allowed.includes('nutrient-paste-meal')|| !validPolicyName(p.name) || !validAllowedFood(p.allowed,version)||version<178&&p.allowed.some(i=>V190_ITEM_IDS.includes(i))||version<157&&p.allowed.includes('vegetarian-lavish-meal')||version<159&&p.allowed.includes('carnivore-lavish-meal')||version<156&&p.allowed.includes('carnivore-fine-meal')||version<155&&p.allowed.includes('vegetarian-fine-meal')||version<154&&p.allowed.includes('lavish-meal')||version<152&&p.allowed.includes('fine-meal')||version<120&&p.allowed.includes('milk')||version<91&&p.allowed.some(i=>V91_ITEM_IDS.includes(i)) || version<79&&p.allowed.includes('hare-meat')
      || version<84&&(p.allowed.includes('potato')||p.allowed.includes('corn'))) {errors.push('Invalid food policy.');continue;}
    ids.add(p.id);
  }
  if (world.pawns.some(p => !ids.has(p.foodPolicyId))) errors.push('Pawn food policy missing.');
  return errors;
}
export function initializeFoodPolicies(world: World): void {
  (world as unknown as {schemaVersion:number}).schemaVersion = 13;
  // Historical V13 policies cannot acquire meals introduced in later schemas.
  world.foodPolicies = initialFoodPolicies(false,false,false,false,false,false,false,false,false,false,13).map(policy=>({...policy,allowed:policy.allowed.filter(item=>item!=='fine-meal'&&item!=='lavish-meal'&&item!=='vegetarian-fine-meal'&&item!=='carnivore-fine-meal'&&item!=='vegetarian-lavish-meal'&&item!=='carnivore-lavish-meal')}));
  world.nextFoodPolicyId = 5;
  for (const pawn of world.pawns) pawn.foodPolicyId = 1;
  // Preserve all existing jobs, piles, routes, need/food profiles and entity IDs.
}

/** Extend only untouched original profiles, matching ID, label and ordered list. */
export function adoptPasteFoodPolicies(world:World):void {
 const old=initialFoodPolicies(true,true,true,true,true,false,false,false,false,false,216);
 for(const policy of world.foodPolicies){const original=old.find(p=>p.id===policy.id&&p.id<=3);if(original&&policy.name===original.name&&policy.allowed.length===original.allowed.length&&policy.allowed.every((id,i)=>id===original.allowed[i]))policy.allowed.push('nutrient-paste-meal');}
}
