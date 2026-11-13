import type { Cell, World } from './types.ts';

/** These values have ONE authority for the whole campaign. A map context has
 * forwarding accessors, never a copied random stream or identity allocator. */
export const CAMPAIGN_FIELDS = [
  'schemaVersion','tick','phaseCore297','rng','nextId','planet','worldFactions','worldPawns','escapedShips298','research','relationships',
  'drugPolicies','nextDrugPolicyId','foodPolicies','nextFoodPolicyId','apparelPolicies','nextApparelPolicyId',
  'foodRules','restRules','gameProfile','worldIncidents','worldSites263','tradeRequests284','linkedStorage286','populationGainCore320',
] as const satisfies readonly (keyof World)[];
export type CampaignField = typeof CAMPAIGN_FIELDS[number];
export type SecondaryMap = Omit<World, CampaignField | 'secondarySite' | 'campaignPeople' | 'campaignMap'>;

/** A second map is a real local simulation, not a cloned colony. The visit is
 * a reference roster; the map's pawns/piles are the only local owners. */
export interface SecondarySite {
  revision:1;
  tile:number;
  createdAt:number;
  selected:boolean;
  map:SecondaryMap;
  visit:null|{groupId:number;memberIds:number[];homeEntry:Cell};
}
export type SecondarySiteCommand =
  | {type:'secondary-enter'}
  | {type:'secondary-view';site:'home'|'secondary'};

export const secondaryCommand=(value:unknown):value is SecondarySiteCommand=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>,keys=Reflect.ownKeys(v);
  if(v.type==='secondary-enter')return keys.length===1&&keys[0]==='type';
  return v.type==='secondary-view'&&keys.length===2&&keys.includes('type')&&keys.includes('site')&&(v.site==='home'||v.site==='secondary');
};
