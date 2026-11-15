import type {World} from './types.ts';
/** Core 1.6 research BlowbackOperation with its two guns, Gun_Autopistol and
 * Gun_MachinePistol (schema 340). Pure data: only type imports, so items,
 * recipes, statistics and research can consume it without a cycle.
 *
 * Research BlowbackOperation (ResearchProjects_2_Electricity.xml): 500 points,
 * Industrial, after Gunsmithing, no research building. GunTurrets (500,
 * Industrial) requires BlowbackOperation; GasOperation (not delivered) too.
 *
 * Gun_Autopistol (RangedIndustrial.xml): 30 Steel + 2 ComponentIndustrial,
 * WorkToMake 5000, Crafting 4, Mass 1.2. Verb_Shoot, single shot: warmup 0.3 s,
 * range 25.9, RangedWeapon_Cooldown 1 s, accuracy .80/.70/.40/.30.
 * Bullet_Autopistol: 10 damage, speed 55, default stopping power 0.5 and
 * armor penetration 10 x 0.015. Weapon tags Gun, SimpleGun, Autopistol.
 *
 * Gun_MachinePistol: 45 Steel + 3 ComponentIndustrial, WorkToMake 11000,
 * Crafting 4, Mass 2.5. Verb_Shoot: warmup 0.5 s, range 19.9, burstShotCount
 * 3, ticksBetweenBurstShots 7, cooldown 0.9 s, accuracy .90/.65/.35/.15.
 * Bullet_MachinePistol: 6 damage, speed 55, stopping power 0.5, armor
 * penetration 6 x 0.015. Weapon tags Gun, ShortShots.
 *
 * Both: machining table through the existing gun pipeline (unfinished gun,
 * quality, Crafting work), tools grip (Blunt 9) and barrel (Blunt/Poke 9),
 * 100 hit points, smeltable; value = steel x 1.9 + components x 32 +
 * WorkToMake x 0.0036 (139 and 221.1). */
export const BLOWBACK_SCHEMA_340=340 as const;
export const isBlowbackSchema340=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=BLOWBACK_SCHEMA_340;

export const BLOWBACK_ITEMS_340=Object.freeze(['autopistol','machine-pistol'] as const);
export type BlowbackGun340=typeof BLOWBACK_ITEMS_340[number];
export const isBlowbackGun340=(v:unknown):v is BlowbackGun340=>v==='autopistol'||v==='machine-pistol';
export const BLOWBACK_RECIPES_340=Object.freeze(['make-autopistol','make-machine-pistol'] as const);
export type BlowbackRecipe340=typeof BLOWBACK_RECIPES_340[number];
export const isBlowbackRecipe340=(v:unknown):v is BlowbackRecipe340=>v==='make-autopistol'||v==='make-machine-pistol';

/** Core burst: one warmup, `shots` shots, then the weapon cooldown. */
export interface RangedBurst340 {readonly shots:number;readonly ticksBetween:number}
export interface BlowbackRanged340 {
 readonly damage:number;readonly armorPenetration:number;readonly accuracy:readonly [number,number,number,number];
 readonly range:number;readonly warmupCoreTicks:number;readonly cooldownCoreTicks:number;
 readonly projectileTilesPerCoreTick:number;readonly stoppingPower:number;readonly burst?:RangedBurst340;
}
export interface BlowbackFacts340 {
 readonly item:BlowbackGun340;readonly label:string;readonly recipe:BlowbackRecipe340;
 /** Steel and components, their sum (recipe units), local work ticks
  * (Core WorkToMake / 10) and Crafting level. */
 readonly steel:number;readonly component:number;readonly units:number;readonly workTicks:number;readonly skill:number;
 readonly massGrams:number;readonly baseValue:number;readonly color:number;readonly ranged:BlowbackRanged340;
}
const ranged=(r:BlowbackRanged340):BlowbackRanged340=>Object.freeze({...r,accuracy:Object.freeze([...r.accuracy]) as unknown as BlowbackRanged340['accuracy'],...r.burst?{burst:Object.freeze({...r.burst})}:{}});
export const BLOWBACK_FACTS_340:Readonly<Record<BlowbackGun340,BlowbackFacts340>>=Object.freeze({
 autopistol:Object.freeze({item:'autopistol',label:'Pistolet automatique',recipe:'make-autopistol',
  steel:30,component:2,units:32,workTicks:500,skill:4,massGrams:1200,baseValue:30*1.9+2*32+5000*.0036,color:0x56636a,
  ranged:ranged({damage:10,armorPenetration:10*.015,accuracy:[.80,.70,.40,.30],range:25.9,warmupCoreTicks:18,cooldownCoreTicks:60,projectileTilesPerCoreTick:55/100,stoppingPower:.5})}),
 'machine-pistol':Object.freeze({item:'machine-pistol',label:'Pistolet-mitrailleur',recipe:'make-machine-pistol',
  steel:45,component:3,units:48,workTicks:1100,skill:4,massGrams:2500,baseValue:45*1.9+3*32+11000*.0036,color:0x4b5a61,
  ranged:ranged({damage:6,armorPenetration:6*.015,accuracy:[.90,.65,.35,.15],range:19.9,warmupCoreTicks:30,cooldownCoreTicks:54,projectileTilesPerCoreTick:55/100,stoppingPower:.5,burst:{shots:3,ticksBetween:7}})}),
});
export const blowbackProduct340=(recipe:BlowbackRecipe340):BlowbackGun340=>recipe==='make-autopistol'?'autopistol':'machine-pistol';

/** Core Verb.TryCastNextBurstShot for a pawn, whose stance tick (warmup end,
 * first shot) runs before its equipment VerbTick in Pawn.Tick: the counter
 * set by the first shot is already decremented at that Core tick, so the
 * second shot follows after ticksBetween-1 ticks and the later ones after
 * ticksBetween. The busy stance between shots lasts ticksBetween+1. */
export const burstNextShotDelay340=(burst:RangedBurst340,firstShot:boolean):number=>Math.max(0,burst.ticksBetween-(firstShot?1:0));
export const burstGapStanceTicks340=(burst:RangedBurst340):number=>burst.ticksBetween+1;

export const BLOWBACK_RESEARCH_SCALE_340=1_000_000;
/** Core BlowbackOperation: 500 points, Industrial, after Gunsmithing. */
export const BLOWBACK_RESEARCH_340=Object.freeze({project:'blowback-operation',recordKey:'blowbackOperation',label:'Culasse non calée',points:500,scaledCost:500*BLOWBACK_RESEARCH_SCALE_340,parentLabel:'Armurerie',techLevel:'Industrial'} as const);
export type BlowbackResearch340=typeof BLOWBACK_RESEARCH_340.project;
export const isBlowbackResearch340=(v:unknown):v is BlowbackResearch340=>v==='blowback-operation';
type ResearchView=Pick<World,'schemaVersion'|'research'>;
export const blowbackUnlocked340=(w:ResearchView):boolean=>isBlowbackSchema340(w.schemaVersion)&&w.research?.blowbackOperation?.completedAt!==undefined;
/** Label of the missing parent project, if any. */
export const blowbackResearchPrerequisite340=(w:ResearchView):string|undefined=>w.research?.gunsmithing?.completedAt===undefined?BLOWBACK_RESEARCH_340.parentLabel:undefined;
/** From 340, GunTurrets requires BlowbackOperation as in Core; before, the
 * delivered adaptation kept Gunsmithing. */
export const gunTurretsPrerequisite340=(w:ResearchView):string|undefined=>isBlowbackSchema340(w.schemaVersion)
 ?(blowbackUnlocked340(w)?undefined:BLOWBACK_RESEARCH_340.label)
 :(w.research?.gunsmithing?.completedAt===undefined?'Armurerie':undefined);

/** Core PawnWeaponGenerator.TryGenerateWeaponFor for the kinds whose weapon
 * tags are exactly Gun: weaponMoney drawn uniformly, then every Gun-tagged
 * gun not dearer than it, weighted by generateCommonality x price. The table
 * lists the Core candidates up to 650 silver in DefDatabase order; the guns
 * Elsewhere does not deliver keep the kind's fixed historical weapon. */
export type GunKind340='Scavenger'|'Pirate'|'Town_Guard'|'Town_Councilman'|'Town_Trader'|'Mercenary_Gunner';
export const GUN_KIND_MONEY_340:Readonly<Record<GunKind340,readonly [number,number]>>=Object.freeze({
 Scavenger:[200,300],Pirate:[250,345],Town_Guard:[250,400],Town_Councilman:[200,200],Town_Trader:[200,200],Mercenary_Gunner:[330,650],
});
export const isGunKind340=(v:unknown):v is GunKind340=>typeof v==='string'&&Object.hasOwn(GUN_KIND_MONEY_340,v);
type DeliveredGun340='revolver'|'autopistol'|'machine-pistol'|'emp-launcher'|'bolt-action-rifle'|'pump-shotgun';
interface CoreGunCandidate340 {readonly core:string;readonly price:number;readonly commonality:number;readonly item?:DeliveredGun340}
export const CORE_GUN_CANDIDATES_340:readonly CoreGunCandidate340[]=Object.freeze(([
 {core:'Gun_Revolver',price:135.4,commonality:1,item:'revolver'},
 {core:'Gun_Autopistol',price:139,commonality:1,item:'autopistol'},
 {core:'Gun_MachinePistol',price:221.1,commonality:1,item:'machine-pistol'},
 {core:'Gun_IncendiaryLauncher',price:342.5,commonality:.3},
 {core:'Gun_SmokeLauncher',price:378.5,commonality:.3},
 {core:'Gun_EmpLauncher',price:506.5,commonality:.3,item:'emp-launcher'},
 {core:'Gun_BoltActionRifle',price:253.2,commonality:1,item:'bolt-action-rifle'},
 {core:'Gun_PumpShotgun',price:253.2,commonality:1,item:'pump-shotgun'},
 {core:'Gun_ChainShotgun',price:404.6,commonality:1},
 {core:'Gun_HeavySMG',price:356.9,commonality:1},
 {core:'Gun_LMG',price:424.9,commonality:1},
 {core:'Gun_AssaultRifle',price:482,commonality:1},
 {core:'Gun_SniperRifle',price:532,commonality:1},
] as CoreGunCandidate340[]).map(c=>Object.freeze(c)));
/** Two private draws per person, from the game seed and the person's own
 * identity: no shared random stream advances. */
export function seededUnit340(seed:number,pawnId:number,salt:number):number {
 let h=(Math.imul((seed>>>0)^0x34a1b0c3,0x9e3779b1)^Math.imul(pawnId|0,0x85ebca6b)^Math.imul(salt+1,0xc2b2ae35))>>>0;
 h^=h>>>16;h=Math.imul(h,0x7feb352d)>>>0;h^=h>>>15;h=Math.imul(h,0x846ca68b)>>>0;h^=h>>>16;
 return (h>>>0)/4294967296;
}
/** The gun a Gun-tagged kind carries from schema 340, or `fixed` (its
 * historical weapon) when Core draws a gun Elsewhere does not deliver. */
export function gunKindWeapon340<T>(kind:GunKind340,fixed:T,seed:number,pawnId:number):DeliveredGun340|T {
 const [min,max]=GUN_KIND_MONEY_340[kind],money=min+(max-min)*seededUnit340(seed,pawnId,0);
 const candidates=CORE_GUN_CANDIDATES_340.filter(c=>!(c.price>money));
 const total=candidates.reduce((sum,c)=>sum+c.commonality*c.price,0);
 if(!(total>0))return fixed;
 let pick=seededUnit340(seed,pawnId,1)*total;
 for(const c of candidates){pick-=c.commonality*c.price;if(pick<0)return c.item??fixed;}
 return candidates.at(-1)!.item??fixed;
}
