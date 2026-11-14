import {arrowHit316} from './short-bow-316.ts';
import type {World} from './types.ts';
/** Core 1.6 Bow_Recurve and Bow_Great with their research projects RecurveBow
 * and Greatbow (schema 326). Pure data: only type imports and the pure short
 * bow leaf, so items, recipes and statistics can consume it without a cycle.
 *
 * Bow_Recurve: 40 WoodLog, WorkToMake 5000, Crafting 5, research RecurveBow.
 * Verb: range 25.9, warmup 1.45 s, cooldown 1.65 s, accuracy .70/.78/.65/.35.
 * Arrow_Recurve: 14 damage, ArrowHighVelocity (a Stab, a Crack on solid
 * parts), default armor penetration 14 x 0.015, speed 56, stopping power 1.
 *
 * Bow_Great: 60 WoodLog, WorkToMake 9000, Crafting 6, research Greatbow.
 * Verb: range 29.9, warmup 2 s, cooldown 1.5 s, accuracy .65/.85/.75/.50.
 * Arrow_Great: 17 damage, Arrow (a Cut, a Crack on solid parts), armor
 * penetration 0.15, speed 49, stopping power 1.5.
 *
 * Both: crafting spot and both smithies, unfinished weapon, quality, 100 hit
 * points, one limb melee tool (Blunt and Poke, power 9, cooldown 2 s).
 * Masses 1.3 and 3 kg; value = wood x 1.2 + WorkToMake x 0.0036.
 *
 * Research RecurveBow: 400 points, Neolithic, no prerequisite. Greatbow: 600
 * points, Medieval, after RecurveBow. Both are at or below the colony tech
 * level, so their cost multiplier is 1. */
export const BOWS_SCHEMA_326=326 as const;
export const isBowSchema326=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=BOWS_SCHEMA_326;

export const BOW_ITEMS_326=Object.freeze(['recurve-bow','greatbow'] as const);
export type Bow326=typeof BOW_ITEMS_326[number];
export const isBow326=(v:unknown):v is Bow326=>v==='recurve-bow'||v==='greatbow';
export const BOW_RECIPES_326=Object.freeze(['make-recurve-bow','make-greatbow'] as const);
export type BowRecipe326=typeof BOW_RECIPES_326[number];
export const isBowRecipe326=(v:unknown):v is BowRecipe326=>v==='make-recurve-bow'||v==='make-greatbow';
export type BowResearch326='recurve-bow'|'greatbow';
export const isBowResearch326=(v:unknown):v is BowResearch326=>v==='recurve-bow'||v==='greatbow';

export interface BowRanged326 {
 readonly damage:number;readonly armorPenetration:number;readonly accuracy:readonly [number,number,number,number];
 readonly range:number;readonly warmupCoreTicks:number;readonly cooldownCoreTicks:number;
 readonly projectileTilesPerCoreTick:number;readonly stoppingPower:number;
}
export interface BowFacts326 {
 readonly item:Bow326;readonly label:string;readonly recipe:BowRecipe326;readonly recipeLabel:string;
 /** Wood units, local work ticks (Core WorkToMake / 10) and Crafting level. */
 readonly units:number;readonly workTicks:number;readonly skill:number;
 readonly massGrams:number;readonly baseValue:number;readonly color:number;
 readonly research:BowResearch326;readonly injury:'stab'|'cut';readonly ranged:BowRanged326;
}
const ranged=(r:BowRanged326):BowRanged326=>Object.freeze({...r,accuracy:Object.freeze([...r.accuracy]) as unknown as BowRanged326['accuracy']});
export const BOW_FACTS_326:Readonly<Record<Bow326,BowFacts326>>=Object.freeze({
 'recurve-bow':Object.freeze({item:'recurve-bow',label:'Arc recourbé',recipe:'make-recurve-bow',recipeLabel:'Fabriquer un arc recourbé',
  units:40,workTicks:500,skill:5,massGrams:1300,baseValue:40*1.2+5000*.0036,color:0x8a5a36,research:'recurve-bow',injury:'stab',
  ranged:ranged({damage:14,armorPenetration:14*.015,accuracy:[.70,.78,.65,.35],range:25.9,warmupCoreTicks:87,cooldownCoreTicks:99,projectileTilesPerCoreTick:56/100,stoppingPower:1})}),
 greatbow:Object.freeze({item:'greatbow',label:'Grand arc',recipe:'make-greatbow',recipeLabel:'Fabriquer un grand arc',
  units:60,workTicks:900,skill:6,massGrams:3000,baseValue:60*1.2+9000*.0036,color:0x7a5030,research:'greatbow',injury:'cut',
  ranged:ranged({damage:17,armorPenetration:.15,accuracy:[.65,.85,.75,.50],range:29.9,warmupCoreTicks:120,cooldownCoreTicks:90,projectileTilesPerCoreTick:49/100,stoppingPower:1.5})}),
});
export const bowProduct326=(recipe:BowRecipe326):Bow326=>recipe==='make-recurve-bow'?'recurve-bow':'greatbow';
export const bowRecipeFacts326=(recipe:BowRecipe326):BowFacts326=>BOW_FACTS_326[bowProduct326(recipe)];

/** Impact fields of an arrow: the recurve arrow stabs, the great arrow and
 * the short arrow cut; a bullet adds none. */
export const arrowHit326=(weaponItem:unknown):{injury?:'cut'|'stab'}=>weaponItem==='recurve-bow'?{injury:'stab'}:weaponItem==='greatbow'?{injury:'cut'}:arrowHit316(weaponItem);

export const BOW_RESEARCH_SCALE_326=1_000_000;
export interface BowResearchFacts326 {readonly project:BowResearch326;readonly recordKey:'recurveBow'|'greatbow';readonly label:string;readonly points:number;readonly scaledCost:number;readonly parent:BowResearch326|null;readonly techLevel:'Neolithic'|'Medieval'}
export const BOW_RESEARCH_326:Readonly<Record<BowResearch326,BowResearchFacts326>>=Object.freeze({
 'recurve-bow':Object.freeze({project:'recurve-bow',recordKey:'recurveBow',label:'Arc recourbé',points:400,scaledCost:400*BOW_RESEARCH_SCALE_326,parent:null,techLevel:'Neolithic'}),
 greatbow:Object.freeze({project:'greatbow',recordKey:'greatbow',label:'Grand arc',points:600,scaledCost:600*BOW_RESEARCH_SCALE_326,parent:'recurve-bow',techLevel:'Medieval'}),
});
type ResearchView=Pick<World,'schemaVersion'|'research'>;
export const bowResearchUnlocked326=(w:ResearchView,project:BowResearch326):boolean=>isBowSchema326(w.schemaVersion)&&w.research?.[BOW_RESEARCH_326[project].recordKey]?.completedAt!==undefined;
export const recurveBowUnlocked326=(w:ResearchView):boolean=>bowResearchUnlocked326(w,'recurve-bow');
export const greatbowUnlocked326=(w:ResearchView):boolean=>bowResearchUnlocked326(w,'greatbow');
/** Label of the missing parent project, if any. */
export const bowResearchPrerequisite326=(w:ResearchView,project:BowResearch326):string|undefined=>{
 const parent=BOW_RESEARCH_326[project].parent;
 return parent&&!bowResearchUnlocked326(w,parent)?BOW_RESEARCH_326[parent].label:undefined;
};
/** A bow recipe is unlocked by its own research project. */
export const bowRecipeUnlocked326=(w:ResearchView,recipe:BowRecipe326):boolean=>bowResearchUnlocked326(w,bowRecipeFacts326(recipe).research);
