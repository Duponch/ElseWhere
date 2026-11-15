import type {World} from './types.ts';
import {CORE_GUN_CANDIDATES_340,GUN_KIND_MONEY_340,blowbackUnlocked340,gunKindWeapon340,seededUnit340,type BlowbackRanged340,type GunKind340} from './blowback-340.ts';
/** Core 1.6 research GasOperation and PrecisionRifling with their five guns
 * (schema 342). Pure data and small helpers: it imports only blowback-340.ts,
 * which imports only types, so items, recipes, statistics and research can
 * consume it without a cycle.
 *
 * Research (ResearchProjects_2_Electricity.xml, _3_Microelectronics.xml):
 * GasOperation 1000 points, Industrial, after BlowbackOperation, no research
 * building. PrecisionRifling 1400 points, Industrial, after GasOperation and
 * MicroelectronicsBasics, HiTechResearchBench. GasOperation is also a hidden
 * prerequisite of HeavyTurrets and MultibarrelWeapons, PrecisionRifling of
 * ChargedShot and SniperTurret: none of those is delivered.
 *
 * Guns (RangedIndustrial.xml, BaseHumanMakeableGun: machining table, unfinished
 * gun, Crafting work, quality, smeltable, 100 hit points; value = steel x 1.9 +
 * components x 32 + WorkToMake x 0.0036):
 * - Gun_ChainShotgun: 70 Steel + 5 ComponentIndustrial, WorkToMake 31000,
 *   Crafting 6, Mass 4.5. Warmup 1.2 s, range 12.9, burst 3 / 10 ticks,
 *   cooldown 1.35 s, accuracy .57/.64/.55/.45. Bullet_Shotgun: 18 damage,
 *   explicit armor penetration 0.14, speed 55, stopping power 3. Tags Gun,
 *   IndustrialGunAdvanced, ShortShots. Tools stock, barrel.
 * - Gun_HeavySMG: 75 Steel + 4, WorkToMake 24000, Crafting 5, Mass 3.5.
 *   Warmup 0.9 s, range 22.9, burst 3 / 11, cooldown 1.65 s, accuracy
 *   .85/.65/.35/.20. Bullet_HeavySMG: 12 damage, speed 48, default stopping
 *   power 0.5 and penetration 12 x 0.015. Tags Gun, IndustrialGunAdvanced,
 *   ShortShots. Tools grip, barrel.
 * - Gun_LMG: 75 Steel + 5, WorkToMake 34000, Crafting 6, Mass 8.5. Warmup
 *   1.8 s, range 25.9, burst 6 / 7, cooldown 1.6 s, accuracy .40/.48/.35/.26.
 *   Bullet_LMG: 12 damage, speed 46, stopping power 1. Tags Gun,
 *   IndustrialGunAdvanced. Tools stock, barrel.
 * - Gun_AssaultRifle: 60 Steel + 7, WorkToMake 40000, Crafting 6, Mass 3.5.
 *   Warmup 1.0 s, range 30.9, burst 3 / 10, cooldown 1.7 s, accuracy
 *   .60/.70/.65/.55. Bullet_AssaultRifle: 11 damage, speed 70. Tags Gun,
 *   IndustrialGunAdvanced, AssaultRifle. Tools stock, barrel.
 * - Gun_SniperRifle: 60 Steel + 8, WorkToMake 45000, Crafting 7, Mass 4.
 *   Warmup 3.5 s, range 44.9, single shot, cooldown 1.5 s, accuracy
 *   .50/.70/.88/.90. Bullet_SniperRifle: 25 damage, speed 100, stopping power
 *   1.5. weaponTags Inherit="False": SniperRifle only (not Gun).
 * None of these verbs has a minimum range or a forced miss radius. */
export const GUNS_SCHEMA_342=342 as const;
export const isGunsSchema342=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=GUNS_SCHEMA_342;

export const GUNS_ITEMS_342=Object.freeze(['chain-shotgun','heavy-smg','lmg','assault-rifle','sniper-rifle'] as const);
export type Gun342=typeof GUNS_ITEMS_342[number];
export const isGun342=(v:unknown):v is Gun342=>typeof v==='string'&&(GUNS_ITEMS_342 as readonly string[]).includes(v);
export const GUNS_RECIPES_342=Object.freeze(['make-chain-shotgun','make-heavy-smg','make-lmg','make-assault-rifle','make-sniper-rifle'] as const);
export type GunRecipe342=typeof GUNS_RECIPES_342[number];
export const isGunRecipe342=(v:unknown):v is GunRecipe342=>typeof v==='string'&&(GUNS_RECIPES_342 as readonly string[]).includes(v);

export type GunsResearch342='gas-operation'|'precision-rifling';
export const isGunsResearch342=(v:unknown):v is GunsResearch342=>v==='gas-operation'||v==='precision-rifling';
export interface GunFacts342 {
 readonly item:Gun342;readonly label:string;readonly recipe:GunRecipe342;readonly research:GunsResearch342;
 /** Steel and components, their sum (recipe units), local work ticks (Core
  * WorkToMake / 10) and Crafting level. */
 readonly steel:number;readonly component:number;readonly units:number;readonly workTicks:number;readonly skill:number;
 readonly massGrams:number;readonly baseValue:number;readonly color:number;readonly ranged:BlowbackRanged340;
}
const ranged=(r:BlowbackRanged340):BlowbackRanged340=>Object.freeze({...r,accuracy:Object.freeze([...r.accuracy]) as unknown as BlowbackRanged340['accuracy'],...r.burst?{burst:Object.freeze({...r.burst})}:{}});
const value=(steel:number,component:number,work:number)=>steel*1.9+component*32+work*.0036;
export const GUNS_FACTS_342:Readonly<Record<Gun342,GunFacts342>>=Object.freeze({
 'chain-shotgun':Object.freeze({item:'chain-shotgun',label:'Fusil à chaîne',recipe:'make-chain-shotgun',research:'gas-operation',
  steel:70,component:5,units:75,workTicks:3100,skill:6,massGrams:4500,baseValue:value(70,5,31000),color:0x5b6670,
  ranged:ranged({damage:18,armorPenetration:.14,accuracy:[.57,.64,.55,.45],range:12.9,warmupCoreTicks:72,cooldownCoreTicks:81,projectileTilesPerCoreTick:55/100,stoppingPower:3,burst:{shots:3,ticksBetween:10}})}),
 'heavy-smg':Object.freeze({item:'heavy-smg',label:'Mitraillette lourde',recipe:'make-heavy-smg',research:'gas-operation',
  steel:75,component:4,units:79,workTicks:2400,skill:5,massGrams:3500,baseValue:value(75,4,24000),color:0x535f66,
  ranged:ranged({damage:12,armorPenetration:12*.015,accuracy:[.85,.65,.35,.20],range:22.9,warmupCoreTicks:54,cooldownCoreTicks:99,projectileTilesPerCoreTick:48/100,stoppingPower:.5,burst:{shots:3,ticksBetween:11}})}),
 lmg:Object.freeze({item:'lmg',label:'Fusil-mitrailleur',recipe:'make-lmg',research:'gas-operation',
  steel:75,component:5,units:80,workTicks:3400,skill:6,massGrams:8500,baseValue:value(75,5,34000),color:0x4d5a52,
  ranged:ranged({damage:12,armorPenetration:12*.015,accuracy:[.40,.48,.35,.26],range:25.9,warmupCoreTicks:108,cooldownCoreTicks:96,projectileTilesPerCoreTick:46/100,stoppingPower:1,burst:{shots:6,ticksBetween:7}})}),
 'assault-rifle':Object.freeze({item:'assault-rifle',label:'Fusil d’assaut',recipe:'make-assault-rifle',research:'precision-rifling',
  steel:60,component:7,units:67,workTicks:4000,skill:6,massGrams:3500,baseValue:value(60,7,40000),color:0x4f5a60,
  ranged:ranged({damage:11,armorPenetration:11*.015,accuracy:[.60,.70,.65,.55],range:30.9,warmupCoreTicks:60,cooldownCoreTicks:102,projectileTilesPerCoreTick:70/100,stoppingPower:.5,burst:{shots:3,ticksBetween:10}})}),
 'sniper-rifle':Object.freeze({item:'sniper-rifle',label:'Fusil de précision',recipe:'make-sniper-rifle',research:'precision-rifling',
  steel:60,component:8,units:68,workTicks:4500,skill:7,massGrams:4000,baseValue:value(60,8,45000),color:0x5a5248,
  ranged:ranged({damage:25,armorPenetration:25*.015,accuracy:[.50,.70,.88,.90],range:44.9,warmupCoreTicks:210,cooldownCoreTicks:90,projectileTilesPerCoreTick:100/100,stoppingPower:1.5})}),
});
const RECIPE_ITEM:Readonly<Record<GunRecipe342,Gun342>>=Object.freeze({'make-chain-shotgun':'chain-shotgun','make-heavy-smg':'heavy-smg','make-lmg':'lmg','make-assault-rifle':'assault-rifle','make-sniper-rifle':'sniper-rifle'});
export const gunProduct342=(recipe:GunRecipe342):Gun342=>RECIPE_ITEM[recipe];

export const GUNS_RESEARCH_SCALE_342=1_000_000;
export interface GunsResearchFacts342 {
 readonly project:GunsResearch342;readonly recordKey:'gasOperation'|'precisionRifling';readonly label:string;readonly points:number;readonly scaledCost:number;
 readonly techLevel:'Industrial';readonly highTechBench:boolean;
}
export const GUNS_RESEARCH_342:Readonly<Record<GunsResearch342,GunsResearchFacts342>>=Object.freeze({
 'gas-operation':Object.freeze({project:'gas-operation',recordKey:'gasOperation',label:'Emprunt de gaz',points:1000,scaledCost:1000*GUNS_RESEARCH_SCALE_342,techLevel:'Industrial',highTechBench:false}),
 'precision-rifling':Object.freeze({project:'precision-rifling',recordKey:'precisionRifling',label:'Rayures de précision',points:1400,scaledCost:1400*GUNS_RESEARCH_SCALE_342,techLevel:'Industrial',highTechBench:true}),
});
type ResearchView=Pick<World,'schemaVersion'|'research'>;
export const gunsResearchUnlocked342=(w:ResearchView,project:GunsResearch342):boolean=>isGunsSchema342(w.schemaVersion)&&w.research?.[GUNS_RESEARCH_342[project].recordKey]?.completedAt!==undefined;
export const gunRecipeUnlocked342=(w:ResearchView,recipe:GunRecipe342):boolean=>gunsResearchUnlocked342(w,GUNS_FACTS_342[gunProduct342(recipe)].research);
/** Label of the first missing parent project, if any: GasOperation needs
 * BlowbackOperation; PrecisionRifling needs GasOperation and Microelectronics. */
export function gunsResearchPrerequisite342(w:ResearchView,project:GunsResearch342):string|undefined {
 if(project==='gas-operation')return blowbackUnlocked340(w)?undefined:'Culasse non calée';
 if(!gunsResearchUnlocked342(w,'gas-operation'))return GUNS_RESEARCH_342['gas-operation'].label;
 return w.research?.microelectronics?.completedAt===undefined?'Microélectronique':undefined;
}
/** Record keys of the parents, completed before the child (save rule). */
export const GUNS_RESEARCH_PARENTS_342:Readonly<Record<GunsResearch342,readonly ('blowbackOperation'|'gasOperation'|'microelectronics')[]>>=Object.freeze({
 'gas-operation':Object.freeze(['blowbackOperation'] as const),'precision-rifling':Object.freeze(['gasOperation','microelectronics'] as const),
});

/** Core PawnWeaponGenerator for the kinds whose weapon tags are exactly Gun,
 * from schema 342. The same candidates as schema 340, in DefDatabase order,
 * with two corrections: the four new Gun-tagged guns are delivered, and the
 * sniper rifle leaves the table (its weaponTags Inherit="False" hold only
 * SniperRifle, so a Gun kind never draws it). Schema 340-341 keeps the 340
 * table unchanged. */
type DeliveredGun342='revolver'|'autopistol'|'machine-pistol'|'emp-launcher'|'bolt-action-rifle'|'pump-shotgun'|'chain-shotgun'|'heavy-smg'|'lmg'|'assault-rifle';
interface CoreGunCandidate342 {readonly core:string;readonly price:number;readonly commonality:number;readonly item?:DeliveredGun342}
const DELIVERED_342:Readonly<Record<string,DeliveredGun342>>=Object.freeze({Gun_ChainShotgun:'chain-shotgun',Gun_HeavySMG:'heavy-smg',Gun_LMG:'lmg',Gun_AssaultRifle:'assault-rifle'});
export const CORE_GUN_CANDIDATES_342:readonly CoreGunCandidate342[]=Object.freeze(CORE_GUN_CANDIDATES_340.filter(c=>c.core!=='Gun_SniperRifle').map(c=>Object.freeze({...c,...DELIVERED_342[c.core]?{item:DELIVERED_342[c.core]}:{}}) as CoreGunCandidate342));
/** The gun a Gun-tagged kind carries: the schema 340 draw below 342, the
 * corrected table from 342 (same two private draws of the identity). */
export function gunKindWeapon342<T>(kind:GunKind340,fixed:T,seed:number,pawnId:number,version:number):DeliveredGun342|T {
 if(!isGunsSchema342(version))return gunKindWeapon340(kind,fixed,seed,pawnId);
 const [min,max]=GUN_KIND_MONEY_340[kind],money=min+(max-min)*seededUnit340(seed,pawnId,0);
 const candidates=CORE_GUN_CANDIDATES_342.filter(c=>!(c.price>money));
 const total=candidates.reduce((sum,c)=>sum+c.commonality*c.price,0);
 if(!(total>0))return fixed;
 let pick=seededUnit340(seed,pawnId,1)*total;
 for(const c of candidates){pick-=c.commonality*c.price;if(pick<0)return c.item??fixed;}
 return candidates.at(-1)!.item??fixed;
}
