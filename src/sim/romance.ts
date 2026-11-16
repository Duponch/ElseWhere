import { isColonist } from './affiliation.ts';
import {tutorialMode347} from './game-profile.ts';
import { HUMAN_YEAR_TICKS } from './human-age.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import { relationshipIndex,replaceRelationshipLinks } from './relationship-runtime.ts';
import { knownRomanceChanceFactor,livingPartnerId,romanceAgeFactor,type RelationshipPeople } from './relationship-state.ts';
import { addRomanceMemory,removeSuccessfulRomanceMemories } from './romance-memories.ts';
import { opinionOf,socialRandom,socialSeed } from './social-state.ts';
import type { Pawn,World } from './types.ts';

export type RomanticInteraction='romance-attempt'|'breakup';
const inverseLerp=(a:number,b:number,n:number)=>Math.max(0,Math.min(1,(n-a)/(b-a)));
const years=(p:Pawn)=>p.age?p.age.biologicalTicks/HUMAN_YEAR_TICKS:30;
const adults=(w:World,a:Pawn,b:Pawn)=>w.schemaVersion>=195&&a!==b&&w.pawns.includes(a)&&w.pawns.includes(b)
  &&isColonist(a)&&isColonist(b)&&!a.prisoner&&!b.prisoner&&!a.visitor&&!b.visitor&&a.state!=='dead'&&b.state!=='dead'&&years(a)>=18&&years(b)>=18;
const secondary=(w:World,a:Pawn,b:Pawn)=>romanceAgeFactor(years(a),years(b))*knownRomanceChanceFactor(relationshipIndex(w),a.id,b.id);

/** Selection happens only after the existing social presence/LOS admission.
 * Orientation and beauty are neutral until actual profiles exist. */
export function romanceSelectionWeight(world:World,a:Pawn,b:Pawn,people?:RelationshipPeople):number {
  // Schema 347: InteractionWorker_RomanceAttempt weighs 0 in the tutorial.
  if(tutorialMode347(world))return 0;
  if(!adults(world,a,b))return 0;
  const index=relationshipIndex(world),known=people??captureRelationshipPeople(world);
  if(livingPartnerId(index,known,a.id)!==undefined||livingPartnerId(index,known,b.id)!==undefined)return 0;
  const chance=secondary(world,a,b),opinion=opinionOf(a,b.id,world.tick,world);
  if(chance<.15||opinion<5||opinionOf(b,a.id,world.tick,world)<5)return 0;
  return 1.15*inverseLerp(.15,1,chance)*inverseLerp(5,100,opinion);
}
export function romanceSuccessChance(world:World,a:Pawn,b:Pawn):number {
  return adults(world,a,b)?Math.max(0,Math.min(1,.6*secondary(world,b,a)*inverseLerp(5,100,opinionOf(b,a.id,world.tick,world)))):0;
}
export function breakupSelectionWeight(world:World,a:Pawn,b:Pawn):number {
  if(!adults(world,a,b))return 0;
  const kind=relationshipIndex(world).kinds(a.id,b.id).find(k=>k==='lover'||k==='spouse');
  return kind ? .02*inverseLerp(100,-100,opinionOf(a,b.id,world.tick,world))*(kind==='spouse'?.4:1):0;
}
/** Invoked by exchangeSocial after physical eligibility. Failed preflight or
 * graph admission commits no random draw, memory, relationship or last event. */
export function performRomanceExchange(world:World,a:Pawn,b:Pawn,kind:RomanticInteraction):'formed'|'rebuffed'|'broken-up'|undefined {
  const links=world.relationships?.links??[],low=Math.min(a.id,b.id),high=Math.max(a.id,b.id);
  if(kind==='breakup'){
    if(breakupSelectionWeight(world,a,b)<=0)return;
    const current=links.find(link=>(link.kind==='lover'||link.kind==='spouse')&&link.aId===low&&link.bId===high);if(!current)return;
    const former=current.kind==='spouse'?'ex-spouse':'ex-lover';
    const next=links.filter(link=>link!==current&&!(link.kind===former&&link.aId===low&&link.bId===high));
    if(!replaceRelationshipLinks(world,[...next,{kind:former,aId:low,bId:high,recordedAt:world.tick}]))return;
    if(current.kind==='lover'){addRomanceMemory(b,a.id,'breakup-opinion',world.tick);addRomanceMemory(b,a.id,'breakup-mood',world.tick);}
    return 'broken-up';
  }
  if(romanceSelectionWeight(world,a,b)<=0)return;
  const draft={rng:a.social?.rng??socialSeed(world.seed,a.id)},success=socialRandom(draft)<romanceSuccessChance(world,a,b);
  if(success){
    const next=links.filter(link=>!(link.kind==='ex-lover'&&link.aId===low&&link.bId===high));
    if(!replaceRelationshipLinks(world,[...next,{kind:'lover',aId:low,bId:high,recordedAt:world.tick}]))return;
    removeSuccessfulRomanceMemories(a,b.id);removeSuccessfulRomanceMemories(b,a.id);
  }else{
    addRomanceMemory(a,b.id,'rebuffed-opinion',world.tick);addRomanceMemory(a,b.id,'rebuffed-mood',world.tick);
    addRomanceMemory(b,a.id,'failed-opinion',world.tick);
    if(opinionOf(b,a.id,world.tick,world)<=0)addRomanceMemory(b,a.id,'failed-low-opinion-mood',world.tick);
  }
  (a.social??={rng:socialSeed(world.seed,a.id),memories:[]}).rng=draft.rng;
  return success?'formed':'rebuffed';
}
