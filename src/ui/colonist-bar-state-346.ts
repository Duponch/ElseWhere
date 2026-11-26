import { isAggressiveCrisis } from '../sim/aggressive-crisis';
import { groupOnMapMember } from '../sim/group-state';
import { idleWanderTask300 } from '../sim/idle-wander-300';
import { inspirationKind360,inspirationLabel360 } from '../sim/inspirations-360';
import { mentalCrisisLabel } from '../sim/mental-presentation';
import { breakThresholds } from '../sim/traits';
import { TICKS_PER_DAY,type Pawn,type World } from '../sim/types';

/** Core MoodThreshold, from MoodThresholdExtensions.CurrentMoodThresholdFor. */
export type MoodThreshold346='none'|'minor'|'major'|'extreme';
export type ColonistBarIcon346='forming-caravan'|'mental-aggro'|'mental'|'medical-rest'|'sleeping'|'fleeing'|'attacking'|'idle'|'burning'|'inspired';
export interface ColonistBarState346 {
  threshold:MoodThreshold346;
  /** Core draws the tint, the edge and the mood gradient only for a living,
   * standing colonist (DrawColonist: !Dead && !Downed). */
  tint:boolean;
  icons:readonly {kind:ColonistBarIcon346;label:string}[];
}

/** Core MentalBreaker.BreakExtremeIsImminent / Major / Minor: no mental state
 * and the mood under the personal threshold (minor, minor × 4/7, minor / 7). */
export function colonistMoodThreshold346(pawn:Pawn):MoodThreshold346 {
  if(pawn.mental?.crisis)return 'none';
  const [minor,major,extreme]=breakThresholds(pawn);
  return pawn.mood<extreme?'extreme':pawn.mood<major?'major':pawn.mood<minor?'minor':'none';
}

/** Core ColonistBarColonistDrawer.DrawIcons, in its order: forming caravan;
 * then aggressive mental state, other mental state, medical bed rest, or else
 * asleep, fleeing, attacking or idle (from the first whole day); then burning.
 * then inspired (schema 360). Slave, ideoligion role and extra faction icons
 * have no Elsewhere owner. Read only: no RNG, no write. */
export function colonistBarState346(world:World,pawn:Pawn,structureById?:(id:number)=>World['structures'][number]|undefined):ColonistBarState346 {
  const dead=pawn.state==='dead'||!!pawn.health?.death,downed=pawn.state==='downed';
  const threshold=dead?'none':colonistMoodThreshold346(pawn);
  if(dead)return {threshold,tint:false,icons:[]};
  const icons:{kind:ColonistBarIcon346;label:string}[]=[];
  if(groupOnMapMember(world,pawn.id))icons.push({kind:'forming-caravan',label:'Prépare une caravane'});
  const crisis=pawn.mental?.crisis;
  const bedId=pawn.need?.kind==='sleep'&&pawn.need.phase==='sleep'?pawn.need.bedId:null;
  const medicalBed=bedId!==null&&!!(structureById?structureById(bedId):world.structures.find(structure=>structure.id===bedId))?.medical;
  if(crisis)icons.push({kind:isAggressiveCrisis(pawn.mental)?'mental-aggro':'mental',label:mentalCrisisLabel(crisis.kind)});
  else if(medicalBed)icons.push({kind:'medical-rest',label:'Repos médical'});
  else if(pawn.state==='sleeping'||pawn.medicalSleep&&bedId!==null)icons.push({kind:'sleeping',label:'Dort'});
  else if(pawn.flee)icons.push({kind:'fleeing',label:'Fuit'});
  else if(!pawn.hunting&&(!!pawn.melee?.order||!!pawn.melee?.strike||!!pawn.shooting?.order||!!pawn.shooting?.stance))icons.push({kind:'attacking',label:'Attaque'});
  else if(!downed&&!!idleWanderTask300(pawn)&&Math.floor(world.tick/TICKS_PER_DAY)>=1)icons.push({kind:'idle',label:'Inoccupé'});
  if(pawn.burning)icons.push({kind:'burning',label:'En feu'});
  const inspiration360=inspirationKind360(pawn);if(inspiration360)icons.push({kind:'inspired',label:inspirationLabel360(inspiration360)});
  return {threshold,tint:!downed&&threshold!=='none',icons};
}
