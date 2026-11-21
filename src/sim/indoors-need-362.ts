import {isColonist} from './affiliation.ts';
import {pawnBody} from './health-rules.ts';
import {keepsOwnAir359,outdoorsPlace359,type OutdoorsPlace359} from './outdoors-need-359.ts';
import {carrierOf} from './rescue-state.ts';
import {roofKindAt} from './roof-rules.ts';
import {isTraitLinks362} from './trait-links-362.ts';
import type {BodyAssessment} from './body-capacities.ts';
import type {Pawn,World} from './types.ts';

/* Schema 362: the Undergrounder trait (TraitDef Undergrounder: disablesNeeds
 * Outdoors, enablesNeeds Indoors) and its thoughts, read from Need_Indoors,
 * ThoughtWorker_NeedIndoors, ThoughtWorker_IsIndoorsForUndergrounder,
 * ThoughtWorker_IsUndergroundForUndergrounder, ThoughtWorker_IsOutdoorsFor-
 * Undergrounder and the defs NeedDef Indoors (Needs.xml), ThoughtDefs
 * NeedIndoors (Thoughts_Situation_Needs.xml), UndergrounderIndoors,
 * UndergrounderUnderground and UndergrounderOutdoors (Thoughts_Situation_
 * Traits.xml). Only a holder of the 362 degree is concerned. */

const f=Math.fround;
/** NeedDef Indoors: colonistAndPrisonersOnly, onlyIfCausedByTrait (here
 * Undergrounder). Like the outdoors need (359), Elsewhere's guests have it not. */
export const indoorsNeedApplies362=(p:Pawn):boolean=>!!p.traits?.includes('undergrounder')&&(!!p.prisoner||isColonist(p)&&!p.visitor);
/** Need_Indoors.SetInitialLevel: 1. Absent field = 1. */
export const indoorsLevel362=(p:Pick<Pawn,'indoors362'>):number=>p.indoors362??1;

/** Need_Indoors.NeedInterval per-day rates: indoors under a thick roof +2,
 * under a thin (or constructed) roof +1, without a roof 0; outdoors (the
 * outdoor temperature, or not spawned) under no or a thin roof −0.25, under a
 * thick roof 0; times 0.0025 per 150-tick interval. No floor, no bed factor. */
const RATE:Readonly<Record<OutdoorsPlace359,number>>=Object.freeze({'indoors-thick':2,'indoors-thin':1,'indoors-open':0,'outdoors-open':f(-.25),'outdoors-thin':f(-.25),'outdoors-thick':0});
const PER_INTERVAL=f(.0025);
export function indoorsStep362(level:number,place:OutdoorsPlace359):number {
  const change=f(RATE[place]*PER_INTERVAL);
  const next=change<0?Math.min(level,f(level+change)):Math.min(f(level+change),1);
  return Math.max(0,Math.min(1,next));
}
/** Need.IsFrozen (freezeWhileSleeping): suspended, asleep or unable to be awake. */
function frozen(pawn:Pawn,body?:BodyAssessment):boolean {
  return pawn.state==='dead'||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined
    ||pawn.state==='sleeping'||!!pawn.medicalSleep||!(body??pawnBody(pawn)).canBeAwake;
}
/** Absent is the initial level 1: a full need keeps no field. */
function store(pawn:Pawn,level:number):void {if(level===1)delete pawn.indoors362;else pawn.indoors362=level;}
/** On the map, at the pawn's need interval (after Need_Outdoors: NeedDef order). */
export function advanceIndoors362(world:World,pawn:Pawn,body?:BodyAssessment):void {
  if(!isTraitLinks362(world.schemaVersion))return;
  if(!indoorsNeedApplies362(pawn)){if(pawn.indoors362!==undefined)delete pawn.indoors362;return;}
  if(frozen(pawn,body))return;
  store(pawn,indoorsStep362(indoorsLevel362(pawn),outdoorsPlace359(world,pawn)));
}
/** In a caravan the pawn is not spawned: Need_Indoors counts it outdoors
 * under no roof (−0.25 per day). Caravan members are not frozen unless asleep. */
export function advanceCaravanIndoors362(pawn:Pawn,body?:BodyAssessment):void {
  if(!indoorsNeedApplies362(pawn)){if(pawn.indoors362!==undefined)delete pawn.indoors362;return;}
  if(pawn.health?.death||frozen(pawn,body))return;
  store(pawn,indoorsStep362(indoorsLevel362(pawn),'outdoors-open'));
}

interface Thought362 {readonly id:string;readonly label:string;readonly offset:number;readonly kind:'situation';readonly description:string}
const situation=(id:string,label:string,offset:number,description:string):Thought362=>Object.freeze({id,label,offset,kind:'situation' as const,description});
/** Need_Indoors.CurCategory thresholds 0.8, 0.6, 0.4, 0.2, 0.05 (strict). */
export function indoorsStage362(level:number):number|undefined {
  return level>f(.8)?undefined:level>f(.6)?0:level>f(.4)?1:level>f(.2)?2:level>f(.05)?3:4;
}
const NEED_INDOORS=Object.freeze([
  situation('indoors-just-outdoors','Un peu trop dehors',-1,'Intérieur de 60 à 80 % : ce souterrain n’a rien à faire au grand air.'),
  situation('indoors-outdoors','Trop longtemps dehors',-3,'Intérieur de 40 à 60 % : il passe trop de temps à l’extérieur ces derniers temps.'),
  situation('indoors-long-outdoors','Dehors bien trop longtemps',-5,'Intérieur de 20 à 40 % : tant de grand air ne lui convient pas.'),
  situation('indoors-very-long-outdoors','Perdu dans les grands espaces',-7,'Intérieur de 5 à 20 % : ces espaces ouverts le troublent profondément.'),
  situation('indoors-brutal-outdoors','Écrasé par le ciel',-8,'Intérieur à 5 % ou moins : les grands espaces le rendent fou.'),
]);
const INDOORS=situation('undergrounder-indoors','Souterrain à l’intérieur',3,'Éveillé à l’intérieur, sous un toit construit : ce souterrain s’y sent bien.');
const UNDERGROUND=situation('undergrounder-underground','Souterrain sous la roche',4,'Éveillé à l’intérieur, sous la roche : ce souterrain est dans son élément.');
const OUTDOORS=situation('undergrounder-outdoors','Souterrain dehors',-3,'Éveillé dehors ou sans toit : ce souterrain voudrait retrouver ses galeries.');

/** The undergrounder's map thoughts (none is validWhileDespawned: not while
 * carried, in a casket or in a caravan). The three trait thoughts need the
 * pawn awake; the Indoors need thought is not for a pawn the colony holds
 * (HostFaction: prisoners). Position: the cell the pawn stands in. */
export function undergrounderThoughts362(world:World,pawn:Pawn):readonly Thought362[] {
  if(!pawn.traits?.includes('undergrounder')||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined||carrierOf(world,pawn.id))return [];
  const out:Thought362[]=[];
  if(!pawn.prisoner&&indoorsNeedApplies362(pawn)){const stage=indoorsStage362(indoorsLevel362(pawn));if(stage!==undefined)out.push(NEED_INDOORS[stage]!);}
  if(pawn.state!=='sleeping'&&!pawn.medicalSleep){
    const at=pawn.motion&&pawn.motion.end>world.tick?pawn.motion.from:pawn,index=at.z*world.width+at.x;
    const roof=roofKindAt(world,index),indoors=keepsOwnAir359(world,index);
    // IsAwakeAndIndoors: not the outdoor temperature and roofed; natural rock → underground.
    if(indoors&&roof!==undefined)out.push(roof==='constructed'?INDOORS:UNDERGROUND);
    else out.push(OUTDOORS);
  }
  return out;
}

/** Strict save reading: absent before 362; from 362 a single-precision level
 * in [0, 1] held by an undergrounder only. An undergrounder never holds the
 * outdoors need (its step removes it before any write). */
export function validIndoorsField362(item:Record<string,unknown>,version:number):boolean {
  const undergrounder=Array.isArray(item.traits)&&item.traits.includes('undergrounder');
  if(undergrounder&&Object.hasOwn(item,'outdoors359'))return false;
  if(!Object.hasOwn(item,'indoors362'))return true;
  const v=item.indoors362;
  return isTraitLinks362(version)&&undergrounder&&typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1&&f(v)===v;
}
