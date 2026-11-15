import {isSchema265OrLater} from './schema-compatibility-257.ts';
import {campaignPhysicalCaptures} from './campaign-people.ts';
import {isCarePatient} from './affiliation.ts';
import {isPenoxycyline337,validPenoxycylinePolicy337,DEFAULT_PENOXYCYLINE_POLICY_337,type PenoxycylinePolicy337} from './penoxycyline-337.ts';
import type {Pawn,World} from './types.ts';

export interface BeerPolicy265 {
  allowedForAddiction:boolean;allowedForJoy:boolean;allowScheduled:boolean;
  daysFrequency:number;onlyIfMoodBelow:number;onlyIfJoyBelow:number;takeToInventory:number;
}
/** Schema 337 adds the optional penoxycyline entry; absent is Core's default
 * entry (unscheduled, every 1 day), never a historical choice. */
export interface DrugPolicy265 {id:number;name:string;beer:BeerPolicy265;penoxycyline337?:PenoxycylinePolicy337}
export type DrugPolicyCommand265=
 |{type:'drug-policy-create';name:string;copyFromId?:number}
 |{type:'drug-policy-update';policyId:number;name?:string;beer?:BeerPolicy265;penoxycyline337?:PenoxycylinePolicy337}
 |{type:'drug-policy-delete';policyId:number}
 |{type:'drug-policy-assign';pawnId:number;policyId:number}
 |{type:'drug-policy-default';policyId:number};
const entry=(addiction:boolean,joy:boolean,scheduled=false,inventory=0):BeerPolicy265=>({allowedForAddiction:addiction,allowedForJoy:joy,allowScheduled:scheduled,daysFrequency:1,onlyIfMoodBelow:1,onlyIfJoyBelow:1,takeToInventory:inventory});
/** Core4871's explicit Beer entries replace the initialized addiction=true.
 * In particular Social and OneDrinkPerDay do NOT allow addiction doses. */
export function initialDrugPolicies265():DrugPolicy265[]{return [
 {id:1,name:'Drogues sociales',beer:entry(false,true)},
 {id:2,name:'Aucune drogue',beer:entry(true,false)},
 {id:3,name:'Sans restriction',beer:entry(true,true)},
 {id:4,name:'Une bière par jour',beer:entry(false,true,true,1)},
];}
const social=initialDrugPolicies265()[0]!;
Object.freeze(social.beer);Object.freeze(social);
export const DEFAULT_DRUG_POLICY_265:Readonly<DrugPolicy265>=social;
const implicit:readonly DrugPolicy265[]=Object.freeze([social]);
export const effectiveDrugPolicies265=(world:Pick<World,'drugPolicies'>):readonly DrugPolicy265[]=>world.drugPolicies??implicit;
export const drugPolicyFor265=(world:Pick<World,'drugPolicies'>,pawn:Pick<Pawn,'drugPolicyId'>):DrugPolicy265=>effectiveDrugPolicies265(world).find(p=>p.id===pawn.drugPolicyId)??effectiveDrugPolicies265(world)[0]!;
export const drugPolicyLabel265=(world:Pick<World,'drugPolicies'>,pawn:Pick<Pawn,'drugPolicyId'>):string=>drugPolicyFor265(world,pawn).name;
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const fields=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>plain(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return d&&'value'in d&&d.enumerable;});
const name=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=60;
export function validBeerPolicy265(v:unknown):v is BeerPolicy265 {
 return fields(v,['allowedForAddiction','allowedForJoy','allowScheduled','daysFrequency','onlyIfMoodBelow','onlyIfJoyBelow','takeToInventory'])&&
 ['allowedForAddiction','allowedForJoy','allowScheduled'].every(k=>typeof v[k]==='boolean')&&
 typeof v.daysFrequency==='number'&&Number.isFinite(v.daysFrequency)&&v.daysFrequency>=.1&&v.daysFrequency<=25&&
 [v.onlyIfMoodBelow,v.onlyIfJoyBelow].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=.01&&n<=1)&&
 Number.isInteger(v.takeToInventory)&&Number(v.takeToInventory)>=0&&Number(v.takeToInventory)<=3;
}
export const penoxycylinePolicyOf337=(policy:Pick<DrugPolicy265,'penoxycyline337'>):Readonly<PenoxycylinePolicy337>=>policy.penoxycyline337??DEFAULT_PENOXYCYLINE_POLICY_337;
/** `version` admits the schema 337 penoxycyline entry; callers that only know
 * a registry without its world keep the historical three fields. */
export function validDrugPolicyRegistry265(policies:unknown,nextId:unknown,version=0):boolean {
 if(policies===undefined||nextId===undefined)return policies===undefined&&nextId===undefined;
 if(!Array.isArray(policies)||policies.length<1||policies.length>32||!Number.isSafeInteger(nextId)||Number(nextId)<2||Reflect.ownKeys(policies).length!==policies.length+1)return false;
 const ids=new Set<number>();
 for(let i=0;i<policies.length;i++){const d=Object.getOwnPropertyDescriptor(policies,String(i));if(!d||!('value'in d)||!d.enumerable)return false;const p=d.value;
  const penoxycyline=isPenoxycyline337(version)&&plain(p)&&Object.hasOwn(p,'penoxycyline337');
  if(!fields(p,['id','name','beer',...(penoxycyline?['penoxycyline337']:[])])||penoxycyline&&!validPenoxycylinePolicy337((p as Record<string,unknown>).penoxycyline337)||!Number.isSafeInteger(p.id)||Number(p.id)<1||Number(p.id)>=Number(nextId)||ids.has(Number(p.id))||!name(p.name)||!validBeerPolicy265(p.beer))return false;ids.add(Number(p.id));}
 return true;
}
/** Command boundary only. Absent old registries are materialized at an actual
 * edit, never at load or inspection. Accepted physical drinks stay committed. */
export function applyDrugPolicyCommand265(world:World,command:DrugPolicyCommand265):string|null {
 if(!isSchema265OrLater(world.schemaVersion))return 'Les politiques de drogues nécessitent la version actuelle.';
 const policies=effectiveDrugPolicies265(world),users=()=>campaignPhysicalCaptures(world).flatMap(c=>c.owners.pawnOwners.filter(s=>s.simulation!=='frozen').map(s=>s.pawn!));
 if(command.type==='drug-policy-create'){
  const source=command.copyFromId===undefined?undefined:policies.find(p=>p.id===command.copyFromId);
  if(!name(command.name)||command.copyFromId!==undefined&&!source)return 'Nom ou politique à copier invalide.';
  if(policies.length>=32||!Number.isSafeInteger((world.nextDrugPolicyId??2)+1))return 'Limite de politiques atteinte.';
  const next=world.nextDrugPolicyId??2;
  world.drugPolicies??=[structuredClone(social)];world.nextDrugPolicyId=next+1;
  world.drugPolicies.push({id:next,name:command.name.trim(),beer:{...(source?.beer??entry(true,false))},...(isPenoxycyline337(world.schemaVersion)&&source?.penoxycyline337?{penoxycyline337:{...source.penoxycyline337}}:{})});return null;
 }
 const policy=policies.find(p=>p.id===command.policyId);if(!policy)return 'Politique introuvable.';
 if(command.type==='drug-policy-assign'){
  const pawn=world.pawns.find(p=>p.id===command.pawnId&&isCarePatient(p));if(!pawn)return 'Habitant local introuvable.';
  pawn.drugPolicyId=policy.id;pawn.needCooldown=0;return null;
 }
 if(command.type==='drug-policy-update'){
  if(command.penoxycyline337!==undefined&&(!isPenoxycyline337(world.schemaVersion)||!validPenoxycylinePolicy337(command.penoxycyline337)))return 'Réglages de pénoxycyline invalides.';
  if(command.name===undefined&&command.beer===undefined&&command.penoxycyline337===undefined||command.name!==undefined&&!name(command.name)||command.beer!==undefined&&!validBeerPolicy265(command.beer))return 'Réglages de consommation invalides.';
  world.drugPolicies??=[structuredClone(social)];world.nextDrugPolicyId??=2;
  const actual=world.drugPolicies.find(p=>p.id===policy.id)!;
  if(command.name!==undefined)actual.name=command.name.trim();if(command.beer!==undefined)actual.beer={...command.beer};if(command.penoxycyline337!==undefined)actual.penoxycyline337={...command.penoxycyline337};
  for(const pawn of users())if(drugPolicyFor265(world,pawn).id===policy.id)pawn.needCooldown=0;return null;
 }
 if(command.type==='drug-policy-default'){
  if(!world.drugPolicies)return null;world.drugPolicies.splice(world.drugPolicies.indexOf(policy),1);world.drugPolicies.unshift(policy);return null;
 }
 const people=users();if(people.some(p=>p.state!=='dead'&&drugPolicyFor265(world,p).id===policy.id))return 'Cette politique est utilisée : réaffectez ses utilisateurs.';
 if(policies.length===1)return 'Conservez au moins une politique.';
 world.drugPolicies!.splice(world.drugPolicies!.indexOf(policy),1);for(const pawn of people)if(pawn.drugPolicyId===policy.id)pawn.drugPolicyId=world.drugPolicies![0]!.id;return null;
}
