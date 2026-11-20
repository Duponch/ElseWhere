import {isColonist} from './affiliation.ts';
import {mentalCrisisLabel, type MentalCrisisKind} from './mental-catalog.ts';
import {isSchema352OrLater, sendLetter352, type LetterClass352, type LetterTarget352} from './letters-352.ts';
import type {Pawn, World} from './types.ts';

/* The letter each existing incident and event sends, with the Core class of
 * the IncidentDef, MentalStateDef or code path that sends it (see
 * docs/gameplay/letters-v352.md). Producers are called where the event is
 * committed, right after its journal line; nothing scans per tick. Before
 * schema 352 they return at once, so older games stay bit-identical. */

export const actors352=(ids:Iterable<number>):LetterTarget352[]=>[...ids].map(id=>({kind:'actor' as const,id}));
export const cell352=(cell:{x:number;z:number}):LetterTarget352=>({kind:'cell',x:cell.x,z:cell.z});

/** A letter whose text is the journal line just written on the same journal
 * (Elsewhere's own French notice of the event). */
export function journalLetter352(world:World,cls:LetterClass352,title:string,targets:readonly LetterTarget352[]=[]):void {
  if(!isSchema352OrLater(world.schemaVersion))return;
  const last=world.events[world.events.length-1];
  sendLetter352(world,{cls,title,text:last&&last.tick===world.tick?last.message:title,targets});
}

/** MentalStateDefs: Berserk and MurderousRage send a ThreatSmall letter, the
 * mood breaks a NegativeEvent one (the beginLetterDef default); the drug
 * binges have no begin letter. Only for the player's people (Core
 * PawnUtility.ShouldSendNotificationAbout): colonists and their prisoners. */
export function mentalBreakLetter352(world:World,pawn:Pawn,kind:MentalCrisisKind|'confused-wander'):void {
  if(!isSchema352OrLater(world.schemaVersion)||kind==='drug-binge'||!(isColonist(pawn)||pawn.prisoner))return;
  journalLetter352(world,kind==='berserk'||kind==='murderous-rage'?'threat-small':'negative',`${mentalCrisisLabel(kind)} : ${pawn.name}`,actors352([pawn.id]));
}

/** Pawn_HealthTracker.NotifyPlayerOfKilled: a Death letter for a pawn of the
 * player's faction (a prisoner's death is a message only). */
export function deathLetter352(world:World,pawn:Pawn):void {
  if(!isSchema352OrLater(world.schemaVersion)||!isColonist(pawn)||pawn.prisoner)return;
  sendLetter352(world,{cls:'death',title:`Décès : ${pawn.name}`,
    text:`${pawn.name} a perdu la vie. Son corps reste là où il est tombé : enterrez-le dans une tombe ou un sarcophage avant qu’il ne se décompose, sans quoi ses proches en souffriront davantage.`,
    targets:[cell352(pawn)]});
}
/** The same Death letter for an animal of the colony, its kind in the title. */
export function animalDeathLetter352(world:World,animal:{id:number;x:number;z:number;domestic?:unknown},kind:string):void {
  if(!isSchema352OrLater(world.schemaVersion)||!animal.domestic)return;
  const name=`${kind} ${animal.id}`;
  sendLetter352(world,{cls:'death',title:`Décès : ${name}`,text:`${name}, un animal de la colonie, est mort. Sa dépouille peut être dépecée, enterrée ou laissée à la nature.`,targets:[cell352(animal)]});
}
