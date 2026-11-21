import type { BombInstigatorKey,TurretWick } from './mini-turret-state.ts';
import type { Structure,World } from './types.ts';

/** Schema 357: Core RimWorld 1.6 IED traps and the IEDs research.
 *
 * ThingDef TrapIEDBase (ThingDefs_Buildings/Buildings_Security.xml), thing
 * class Building_TrapExplosive: MaxHitPoints 40, WorkToBuild 1400, Mass 2,
 * Flammability 1, Beauty -4, TrapSpringChance 1, isTrap,
 * trapPeacefulWildAnimalsSpringChanceFactor 0.25, no trapDestroyOnSpring,
 * leaveResourcesWhenKilled false, constructionSkillPrerequisite 3, research
 * IEDs, PlaceWorker_NeverAdjacentTrap, not rotatable, minifiable, no stuff.
 * TrapIED_HighExplosive costs 2 Shell_HighExplosive, TrapIED_Incendiary 2
 * Shell_Incendiary. CompProperties_Explosive: explosiveRadius 3.9, damage
 * Bomb (high-explosive, with Filth_BlastMark) or Flame (incendiary),
 * wickTicks 15, startWickHitPointsPercent 0.2, startWickOnDamageTaken
 * Bullet/Arrow/ArrowHighVelocity, chanceNeverExplodeFromDamage 0.
 *
 * Building_TrapExplosive.SpringSub starts the wick (CompExplosive.StartWick
 * with the springing pawn as instigator); the wick counts down in CompTick
 * (Building_Trap.Tick springs first, then its comps tick, so a contact spring
 * detonates on the 14th following Core tick), then CompExplosive.Detonate
 * kills the trap (no resources, Building_Trap.CheckAutoRebuild) and starts
 * GenExplosion.DoExplosion with the springing pawn as instigator for a
 * player trap. Building_Trap keeps its touching pawns, rolls SpringChance once
 * per new toucher (KnowsOfTrap: same faction 0.005, wild animal
 * 0.2 x factor, other knowers 0, others 1) and offers path costs 800/40 to
 * the pawns knowing it, as the spike trap already does here.
 *
 * ResearchProjectDef IEDs (ResearchProjects_2_Electricity.xml): 500 points,
 * Industrial, prerequisite Electricity (known from the start here), no
 * research building.
 *
 * ShellBase (ThingDefs_Items/Items_Resource_Shell.xml): MaxHitPoints 60,
 * MarketValue 55, Mass 1.25, Flammability 1, DeteriorationRate 1.5, stack
 * 25, trade tag MortarShell. The machining recipes need the Mortars research
 * (absent here); the shells reach the colony through the MortarShell trade
 * tag of the outlander combat supplier and pirate merchant caravans. */
export const IED_SCHEMA_357=357;
export const isIedSchema357=(version:unknown):boolean=>typeof version==='number'&&Number.isSafeInteger(version)&&version>=IED_SCHEMA_357;

export const IED_TRAP_KINDS_357=['ied-high-explosive','ied-incendiary'] as const;
export type IedTrapKind357=typeof IED_TRAP_KINDS_357[number];
export const isIedTrapKind357=(value:unknown):value is IedTrapKind357=>value==='ied-high-explosive'||value==='ied-incendiary';

export const SHELL_ITEMS_357=['shell-high-explosive','shell-incendiary'] as const;
export type ShellItem357=typeof SHELL_ITEMS_357[number];
export const isShellItem357=(value:unknown):value is ShellItem357=>value==='shell-high-explosive'||value==='shell-incendiary';

/** Shared CompExplosive and Building_Trap facts of TrapIEDBase. */
export const IED_COMMON_357=Object.freeze({
  shellCount:2,maxHitPoints:40,coreWork:1400,work:140,constructionSkill:3,beauty:-4,massGrams:2000,flammability:1,
  radius:3.9,wickCore:15,
  /** Mathf.RoundToInt(0.2 x MaxHitPoints). */
  startWickHitPoints:8,
  peacefulWildAnimalFactor:.25,springChance:1,
});
export interface IedTrapFacts357 {
  readonly kind:IedTrapKind357;readonly defName:string;readonly label:string;readonly shell:ShellItem357;
  /** CompProperties_Explosive.explosiveDamageType: Bomb or Flame. */
  readonly damage:'bomb'|'flame';readonly description:string;
}
export const IED_TRAPS_357:Readonly<Record<IedTrapKind357,IedTrapFacts357>>=Object.freeze({
  'ied-high-explosive':Object.freeze({kind:'ied-high-explosive',defName:'TrapIED_HighExplosive',label:'Piège EEI explosif',shell:'shell-high-explosive',damage:'bomb',
    description:'Deux obus explosifs reliés à un déclencheur, dissimulés dans le sol. Explose au contact ou sous une balle, dans un rayon de 3,9 cases.'}),
  'ied-incendiary':Object.freeze({kind:'ied-incendiary',defName:'TrapIED_Incendiary',label:'Piège EEI incendiaire',shell:'shell-incendiary',damage:'flame',
    description:'Deux obus incendiaires reliés à un déclencheur, dissimulés dans le sol. Embrase le rayon de 3,9 cases au contact ou sous une balle.'}),
});
/** ShellBase facts; the French names are written for Elsewhere. */
export const SHELL_FACTS_357=Object.freeze({marketValue:55,massGrams:1250,maxHitPoints:60,flammability:1,deterioration:1.5,stackLimit:25});
export const SHELL_LABELS_357:Readonly<Record<ShellItem357,string>>=Object.freeze({'shell-high-explosive':'Obus explosif','shell-incendiary':'Obus incendiaire'});

export const IED_RESEARCH_SCALE_357=1_000_000;
/** Core IEDs: 500 points, Industrial, prerequisite Electricity, any bench. */
export const IED_RESEARCH_357=Object.freeze({project:'ieds',recordKey:'ieds',label:'EEI',points:500,scaledCost:500*IED_RESEARCH_SCALE_357,techLevel:'Industrial'} as const);
export type IedResearch357=typeof IED_RESEARCH_357.project;
export const isIedResearch357=(value:unknown):value is IedResearch357=>value==='ieds';
export const iedsUnlocked357=(w:Pick<World,'schemaVersion'|'research'>):boolean=>isIedSchema357(w.schemaVersion)&&w.research?.ieds?.completedAt!==undefined;

/** Building_Trap.isTrap: the spike trap and, from 357, the IED traps. */
export const isTrapKind357=(kind:unknown):boolean=>kind==='spike-trap'||isIedTrapKind357(kind);
/** Every trap structure in source order: the spike-trap index plus the IED
 * kinds (empty before 357, so older worlds see exactly the spike traps). */
export function trapStructures357(world:World,ofKind:(kind:Structure['kind'])=>readonly Structure[]):readonly Structure[] {
  const spikes=ofKind('spike-trap');
  if(!isIedSchema357(world.schemaVersion)||!ofKind('ied-high-explosive').length&&!ofKind('ied-incendiary').length)return spikes;
  return world.structures.filter(s=>isTrapKind357(s.kind));
}

/** A burning CompExplosive wick. `endCore` is the detonation Core: a contact
 * spring lights it during the trap's own tick (14 more Core ticks), a bullet
 * or low hit points light it from outside (15). */
export type IedWick357=TurretWick;
export function startIedWick357(s:Structure,core:number,instigatorKey?:BombInstigatorKey,contact=false):boolean {
  if(!isIedTrapKind357(s.kind)||s.iedWick357||!Number.isSafeInteger(core)||core<0||!Number.isSafeInteger(core+IED_COMMON_357.wickCore))return false;
  s.iedWick357={startedAtCore:core,endCore:core+IED_COMMON_357.wickCore-(contact?1:0),...instigatorKey?{instigatorKey}:{}};
  return true;
}
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const instigator=(v:unknown,nextId:number):v is BombInstigatorKey=>typeof v==='string'&&/^(pawn|animal|mech|structure):[1-9]\d*$/.test(v)&&integer(Number(v.slice(v.indexOf(':')+1)),1,nextId-1);
/** Presence fence: only an installed IED trap of 357 may hold a wick, with
 * the persisted duration (never redrawn) and a Core not yet reached. */
export function validIedWickField357(owner:Record<string,unknown>,version:number,nextId:number,core?:number):boolean {
  if(!Object.hasOwn(owner,'iedWick357'))return true;
  const d=Object.getOwnPropertyDescriptor(owner,'iedWick357');
  if(!isIedSchema357(version)||!isIedTrapKind357(owner.kind)||!d?.enumerable||!Object.hasOwn(d,'value'))return false;
  const w=d.value as Record<string,unknown>;
  if(!w||typeof w!=='object'||Array.isArray(w)||Object.getPrototypeOf(w)!==Object.prototype||!Object.keys(w).every(k=>['startedAtCore','endCore','instigatorKey'].includes(k)))return false;
  if(!integer(w.startedAtCore)||!integer(w.endCore)||w.endCore-w.startedAtCore<IED_COMMON_357.wickCore-1||w.endCore-w.startedAtCore>IED_COMMON_357.wickCore)return false;
  if(core!==undefined&&(w.startedAtCore>core||w.endCore<=core))return false;
  return !Object.hasOwn(w,'instigatorKey')||instigator(w.instigatorKey,nextId);
}

/** Core MortarShell trade tag, DefDatabase order, trader-sellable and player
 * acquirable: high-explosive, incendiary, EMP, smoke and firefoam (the
 * antigrain warhead is only Sellable). Unrepresented shells keep their equal
 * selection weight and yield nothing. */
export const MORTAR_SHELL_TAG_357:readonly (ShellItem357|null)[]=Object.freeze(['shell-high-explosive','shell-incendiary',null,null,null]);
/** StockGenerator_Tag.GenerateThings: thingDefCountRange distinct defs, equal
 * weight, then RandomCountOf (countRange) for each chosen def. */
export function mortarShellStock357(draw:{integer:(min:number,max:number)=>number;random:()=>number},defs:readonly [number,number],count:readonly [number,number]):{item:ShellItem357;quantity:number}[] {
  const remaining=MORTAR_SHELL_TAG_357.map((_,i)=>i),out:{item:ShellItem357;quantity:number}[]=[];
  for(let k=draw.integer(defs[0],defs[1]);k>0&&remaining.length;k--){
    const index=remaining.splice(Math.min(remaining.length-1,Math.floor(draw.random()*remaining.length)),1)[0]!,quantity=draw.integer(count[0],count[1]),item=MORTAR_SHELL_TAG_357[index];
    if(item&&quantity>0)out.push({item,quantity});
  }
  return out;
}
/** Item definitions spread into ITEM_DEFINITIONS (kind 'shell'). */
export const SHELL_ITEM_DEFINITIONS_357=Object.freeze({
  'shell-high-explosive':Object.freeze({label:'Obus explosif',kind:'shell',stackLimit:25,nutrition:0,maxIngest:0,color:0x7f8a63}),
  'shell-incendiary':Object.freeze({label:'Obus incendiaire',kind:'shell',stackLimit:25,nutrition:0,maxIngest:0,color:0xb4653b}),
});
