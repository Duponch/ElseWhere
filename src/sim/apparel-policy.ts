import { apparelCompatible } from './armor.ts';
import {CORE_STARTING_APPAREL_256,isCoreStartingApparel256} from './starting-gear-256.ts';
import { APPAREL, isApparelFamily, APPAREL_MATERIALS, APPAREL_MATERIAL_DEFINITIONS, type ApparelFamily, type ApparelItem, type ApparelMaterial, type ApparelState } from './apparel-rules.ts';
import { WEAPON_QUALITIES, type WeaponQuality } from './equipment-rules.ts';
import {ARMOR_STUFFS267,ARMOR_STUFF_DEFINITIONS267,SMITHING_APPAREL_ITEMS267,isSmithingApparel267,type ArmorStuff267} from './smithing-apparel-267.ts';
import {FABRIC_TEXTILES308,TEXTILE_APPAREL_ITEMS308,TEXTILE_MATERIALS308,isTextileApparelItem308,isTextileMaterial308} from './textile-apparel-308.ts';

export type ApparelPolicyMaterial=ApparelMaterial|ArmorStuff267;
export const APPAREL_POLICY_MATERIALS267:readonly ApparelPolicyMaterial[]=Object.freeze([...APPAREL_MATERIALS,...ARMOR_STUFFS267]);
export const apparelPolicyMaterialLabel267=(material:ApparelPolicyMaterial):string=>Object.hasOwn(ARMOR_STUFF_DEFINITIONS267,material)?ARMOR_STUFF_DEFINITIONS267[material as ArmorStuff267].label:APPAREL_MATERIAL_DEFINITIONS[material as ApparelMaterial].label;

export type ApparelTemperatureNeed='neutral'|'cold'|'heat';
export interface ApparelPolicy {
  readonly id:number;
  readonly label:string;
  readonly allowedItems:readonly ApparelItem[];
  readonly allowedMaterials:readonly ApparelPolicyMaterial[];
  readonly minQuality:WeaponQuality;
  readonly maxQuality:WeaponQuality;
  readonly minHitPointsPercent:number;
  readonly maxHitPointsPercent:number;
}
/** Small integration boundary: callers project world piles into these values. */
export interface ApparelPolicyGarment {
  readonly id:number;
  readonly item:ApparelItem;
  readonly apparel:ApparelState;
}
export interface ApparelPolicyCandidate extends ApparelPolicyGarment {
  readonly stored:boolean;
  readonly reachable:boolean;
  readonly reserved:boolean;
  readonly burning?:boolean;
}
export type ApparelReplacementChoice=
  |Readonly<{action:'remove';wornId:number;reason:'policy'}>
  |Readonly<{action:'wear';candidateId:number;replaceIds:readonly number[];gain:number}>;

const qualities=WEAPON_QUALITIES as readonly WeaponQuality[];
export const DEFAULT_APPAREL_POLICY:ApparelPolicy=Object.freeze({
  id:1,label:'Tout vêtement',allowedItems:Object.freeze((Object.keys(APPAREL) as ApparelItem[]).filter(item=>!isCoreStartingApparel256(item)&&!isSmithingApparel267(item))),allowedMaterials:APPAREL_MATERIALS,
  minQuality:'awful',maxQuality:'legendary',minHitPointsPercent:0,maxHitPointsPercent:1,
});
export const TEXTILE_APPAREL_POLICY:ApparelPolicy=Object.freeze({
  ...DEFAULT_APPAREL_POLICY,id:2,label:'Tenue entretenue',minHitPointsPercent:.51,
});
export interface ApparelPolicyRegistry {apparelPolicies:ApparelPolicy[];nextApparelPolicyId:number}
const clonePolicy=(policy:ApparelPolicy):ApparelPolicy=>({...policy,allowedItems:[...policy.allowedItems],allowedMaterials:[...policy.allowedMaterials]});
// The pre-V90 migration requests the old catalogue via includeWool=false.
// It must not acquire later V141 headgear before its own strict validation.
export const createDefaultApparelPolicyRegistry=(includeWool=true,includeHelmet=includeWool,includePredators=true,includeTuque=includeHelmet,includeCoreStartingGear=false,includeSmithing=false,includeTextiles308=true):ApparelPolicyRegistry=>({apparelPolicies:[DEFAULT_APPAREL_POLICY,TEXTILE_APPAREL_POLICY].map(policy=>{
  const copy=clonePolicy(policy);
  return {...copy,allowedItems:[...copy.allowedItems.filter(item=>(includeTuque||APPAREL[item].family!=='tuque')&&(includePredators||APPAREL[item].material!=='foxfur')&&(includeWool||APPAREL[item].material!=='muffalo-wool')&&(includeHelmet||item!=='flak-helmet'&&item!=='recon-helmet'&&item!=='recon-armor')&&!isTextileApparelItem308(item)),...includeCoreStartingGear?CORE_STARTING_APPAREL_256:[],...includeSmithing?SMITHING_APPAREL_ITEMS267:[],...includeTextiles308?TEXTILE_APPAREL_ITEMS308:[]],
    allowedMaterials:[...copy.allowedMaterials.filter(material=>(includeWool||material!=='muffalo-wool')&&(includePredators||material!=='foxfur')&&!isTextileMaterial308(material)),...includeSmithing?ARMOR_STUFFS267:[],...includeTextiles308?TEXTILE_MATERIALS308:[]]};
}),nextApparelPolicyId:3});

export function validApparelPolicy(policy:ApparelPolicy,version=Number.MAX_SAFE_INTEGER):boolean {
  return !!policy&&Number.isSafeInteger(policy.id)&&policy.id>0&&typeof policy.label==='string'&&policy.label.length>0
    &&Array.isArray(policy.allowedItems)&&new Set(policy.allowedItems).size===policy.allowedItems.length&&policy.allowedItems.every(i=>Object.hasOwn(APPAREL,i)&&(version>=267||!isSmithingApparel267(i))&&(version>=308||!isTextileApparelItem308(i)))
    &&Array.isArray(policy.allowedMaterials)&&new Set(policy.allowedMaterials).size===policy.allowedMaterials.length&&policy.allowedMaterials.every(m=>APPAREL_POLICY_MATERIALS267.includes(m)&&(version>=267||!(ARMOR_STUFFS267 as readonly string[]).includes(m))&&(version>=308||!isTextileMaterial308(m)))
    &&qualities.includes(policy.minQuality)&&qualities.includes(policy.maxQuality)&&qualities.indexOf(policy.minQuality)<=qualities.indexOf(policy.maxQuality)
    &&Number.isFinite(policy.minHitPointsPercent)&&Number.isFinite(policy.maxHitPointsPercent)&&policy.minHitPointsPercent>=0&&policy.maxHitPointsPercent<=1&&policy.minHitPointsPercent<=policy.maxHitPointsPercent;
}
export function apparelPolicyAllows(policy:ApparelPolicy,garment:ApparelPolicyGarment):boolean {
  if(!validApparelPolicy(policy)||!garment||!Object.hasOwn(APPAREL,garment.item))return false;
  const definition=APPAREL[garment.item],quality=qualities.indexOf(garment.apparel.quality),percent=garment.apparel.hitPoints/definition.hitPoints;
  const material=definition.stuff??garment.apparel.material??definition.material;
  return policy.allowedItems.includes(garment.item)&&(material===undefined||policy.allowedMaterials.includes(material))
    &&quality>=qualities.indexOf(policy.minQuality)&&quality<=qualities.indexOf(policy.maxQuality)&&percent>=policy.minHitPointsPercent&&percent<=policy.maxHitPointsPercent;
}

/** Piecewise durability utility keeps damaged garments useful while strongly
 * preferring sound replacements. Inputs outside [0,1] are clamped. */
export function apparelHitPointsUtility(percent:number):number {
  const p=Math.max(0,Math.min(1,percent)),points:[[number,number],[number,number]][]=[[[0,0],[.2,.1]],[[.2,.1],[.5,.6]],[[.5,.6],[.7,.85]],[[.7,.85],[1,1]]];
  const segment=points.find(([[x],[x2]])=>p>=x&&p<=x2)??points[points.length-1]!;
  const [[x,y],[x2,y2]]=segment;return y+(y2-y)*(p-x)/(x2-x);
}
const qualityUtility=(quality:WeaponQuality)=>[.55,.75,1,1.16,1.32,1.5,1.8][qualities.indexOf(quality)]!;
export function apparelPolicyScore(garment:ApparelPolicyGarment,need:ApparelTemperatureNeed='neutral'):number {
  const d=APPAREL[garment.item],hp=apparelHitPointsUtility(garment.apparel.hitPoints/d.hitPoints),protection=d.ratings.sharp*.45+d.ratings.blunt*.25+d.ratings.heat*.1;
  const thermal=need==='cold'?d.coldInsulation*.02:need==='heat'?d.heatInsulation*.02:0;
  return (1+protection+thermal)*qualityUtility(garment.apparel.quality)*hp;
}

/** Chooses one deterministic action. Stable ids resolve equal scores; callers
 * reserve and execute the returned action transactionally in the world. */
export function chooseApparelReplacement(policy:ApparelPolicy,worn:readonly ApparelPolicyGarment[],candidates:readonly ApparelPolicyCandidate[],need:ApparelTemperatureNeed='neutral',minimumGain=.05):ApparelReplacementChoice|null {
  if(!validApparelPolicy(policy)||!Number.isFinite(minimumGain)||minimumGain<0)throw new RangeError('Invalid apparel replacement request');
  const all=[...worn,...candidates],ids=new Set<number>();for(const g of all){
    const definition=APPAREL[g.item],material=g.apparel.material??definition?.material;
    if(!Number.isSafeInteger(g.id)||g.id<=0||ids.has(g.id)||!definition||!Number.isSafeInteger(g.apparel.hitPoints)||g.apparel.hitPoints<=0||g.apparel.hitPoints>definition.hitPoints||!qualities.includes(g.apparel.quality)||material!==definition.material)throw new RangeError('Invalid apparel garment');
    ids.add(g.id);
  }
  const remove=[...worn].filter(g=>!g.apparel.forced&&!apparelPolicyAllows(policy,g)).sort((a,b)=>a.id-b.id)[0];
  if(remove)return {action:'remove',wornId:remove.id,reason:'policy'};
  const choices:{candidateId:number;replaceIds:number[];gain:number;score:number}[]=[];
  for(const candidate of candidates){
    if(!candidate.stored||!candidate.reachable||candidate.reserved||candidate.burning||candidate.apparel.forbidden||!apparelPolicyAllows(policy,candidate))continue;
    const conflicts=worn.filter(g=>!apparelCompatible(APPAREL[g.item].coverage,APPAREL[candidate.item].coverage));
    if(conflicts.some(g=>g.apparel.forced))continue;
    const score=apparelPolicyScore(candidate,need),gain=score-conflicts.reduce((n,g)=>n+apparelPolicyScore(g,need),0);
    if(gain>=minimumGain)choices.push({candidateId:candidate.id,replaceIds:conflicts.map(g=>g.id).sort((a,b)=>a-b),gain,score});
  }
  choices.sort((a,b)=>b.gain-a.gain||b.score-a.score||a.candidateId-b.candidateId);
  const choice=choices[0];return choice?{action:'wear',candidateId:choice.candidateId,replaceIds:choice.replaceIds,gain:choice.gain}:null;
}

/** Convenience constructor for adapters that already know family and material. */
export const policyAllowsFamily=(policy:ApparelPolicy,family:ApparelFamily,material:ApparelMaterial):boolean=>isApparelFamily(family)&&policy.allowedItems.some(i=>APPAREL[i].family===family&&APPAREL[i].material===material)&&policy.allowedMaterials.includes(material);

/** Migration 307 -> 308. A policy that allowed the plain leather (or muffalo
 * wool) variant of a garment also allows the new leathers (or wools) of that
 * garment, as Core filters do by stuff category; same for the material list.
 * Nothing else changes and no garment is given. */
export function extendApparelPolicies308(policies:unknown):void {
  if(!Array.isArray(policies))return;
  const wools=FABRIC_TEXTILES308;
  for(const policy of policies){
    if(!policy||typeof policy!=='object'||!Array.isArray(policy.allowedItems)||!Array.isArray(policy.allowedMaterials))continue;
    const items:string[]=policy.allowedItems,materials:string[]=policy.allowedMaterials,add=(list:string[],value:string)=>{if(!list.includes(value))list.push(value);};
    // Same order as a fresh policy: catalogue order of the new garments.
    const allowLeather=new Set(['tribalwear','shirt','pants','duster','parka'].filter(f=>items.includes(`plainleather-${f}`)));
    const allowWool=new Set(['tribalwear','shirt','pants','duster','parka','tuque'].filter(f=>items.includes(`muffalo-wool-${f}`)));
    for(const item of TEXTILE_APPAREL_ITEMS308){
      const cut=item.lastIndexOf('-'),material=item.slice(0,cut),family=item.slice(cut+1);
      if((wools as readonly string[]).includes(material)?allowWool.has(family):allowLeather.has(family))add(items,item);
    }
    for(const m of TEXTILE_MATERIALS308)if((wools as readonly string[]).includes(m)?materials.includes('muffalo-wool'):materials.includes('plainleather'))add(materials,m);
  }
}
