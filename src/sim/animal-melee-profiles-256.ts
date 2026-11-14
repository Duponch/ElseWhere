import type {AnimalMeleeProfile} from './animal-species.ts';
import type {AnimalBodyDef256} from './animal-anatomy-data-v256.ts';
import type {MeleeDamage,MeleeToolId} from './melee-statistics.ts';
import {animalToolParts256} from './animal-anatomy-v256.ts';
export interface AnimalToolSource256 {
 readonly power:number;readonly armorPenetration:number;readonly cooldownTime:number;readonly chanceFactor:number;
 readonly linkedBodyPartsGroup:string;readonly capacities:readonly string[];
 readonly ensureLinkedBodyPartsGroupAlwaysUsable?:boolean;
 readonly extraMeleeDamages:readonly {readonly source:string;readonly def:string;readonly amount:number}[];
}
const kinds:Readonly<Record<string,MeleeDamage>>={Cut:'cut',Blunt:'blunt',Poke:'poke',Bite:'bite',Scratch:'scratch',Stab:'stab',ToxicBite:'toxic-bite'};
/** Existing39 converter extracted verbatim. Definitions only: one call per
 * immutable species profile, never per actor, snapshot or rendered frame. */
export function animalMeleeProfiles256(body:AnimalBodyDef256,tools:readonly AnimalToolSource256[]):readonly AnimalMeleeProfile[] {
 const melee:AnimalMeleeProfile[]=[];tools.forEach((tool,index)=>{
  const parts=animalToolParts256(body,tool.linkedBodyPartsGroup);if(!parts.length)throw Error('Unbound animal melee anatomy.');
  tool.capacities.forEach((capacity,verb)=>{const kind=kinds[capacity];if(!kind)throw Error('Unsupported animal melee capacity.');const surprise=tool.extraMeleeDamages.find(extra=>extra.source==='surpriseAttack'&&extra.def==='Stun');
   melee.push({id:`animal256-tool-${index}-${verb}` as MeleeToolId,sourcePart:parts[0]!,sourceParts:parts,damage:tool.power,penetration:tool.armorPenetration<0?tool.power*.015:tool.armorPenetration,kind,cooldownCore:Math.round(tool.cooldownTime*60),chanceFactor:tool.chanceFactor,...surprise?{surpriseStun:surprise.amount}:{},...tool.ensureLinkedBodyPartsGroupAlwaysUsable?{alwaysUsable:true as const}:{}});
  });
 });return Object.freeze(melee);
}
