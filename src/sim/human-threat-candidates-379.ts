import {hostileTo,isColonist} from './affiliation.ts';
import {terrainJournalReadOwner} from './terrain-read-scope.ts';
import {verifyTerrainWriteCaches} from './terrain-mutation-journal.ts';
import type {Pawn,World} from './types.ts';

interface Candidates379 {readonly source:readonly Pawn[];readonly length:number;readonly rows:readonly Pawn[];readonly members:ReadonlySet<Pawn>}
interface Scope379 {readonly world:World;readonly owner:object;capture?:Candidates379}
let scope379:Scope379|undefined;
const possible=(p:Pawn)=>!isColonist(p)||!!p.prisoner||p.mental?.crisis?.kind==='berserk';
const noop=()=>{};
/** Engine's synchronous HUMAN DECISION or MOVEMENT phase only. Every foreign affiliation
 * stays a candidate, including neutral visitors made hostile by a strip.
 * Prisoners are included before a possible release/breakout. New berserk
 * starts enroll at commitBreak, their actual producer. Death, sleep, recovery,
 * recruitment, arrest and positions stay live, never copied into a column.
 * New/replaced populations rebuild in source order. The caller must close in
 * finally before incidents, other maps, clocks or public commands can run. */
export function beginHumanThreatCandidates379(world:World):()=>void {
 const owner=terrainJournalReadOwner();if(!owner)return noop;
 const previous=scope379,current:Scope379={world,owner};scope379=current;
 return ()=>{scope379=previous;};
}
/** Newly committed mental hostility is the only new candidate among existing
 * ordinary colony/neutral humans in this phase. Retiring a crisis needs no
 * mark: each consumer tests the actual current hostility and state. */
export function markHumanMentalThreat379(world:World,pawn:Pawn):void {
 const scope=scope379;
 if(scope?.world===world&&pawn.mental?.crisis?.kind==='berserk'&&scope.capture&&!scope.capture.members.has(pawn))scope.capture=undefined;
}
/** For an ordinary colony observer the relation table can only admit a
 * foreign faction, prisoner breakout or berserk human. Other factions, prisoners and
 * berserk observers keep their literal whole-roster query. This is a broad
 * candidate list, not a cached hostility answer or physical-position index. */
export function humanThreatCandidates379(world:World,observer:Pawn):readonly Pawn[] {
 const scope=scope379;
 if(scope?.world!==world||scope.owner!==terrainJournalReadOwner()||!isColonist(observer)||observer.prisoner||observer.mental?.crisis?.kind==='berserk')return world.pawns;
 let capture=scope.capture;
 if(!capture||capture.source!==world.pawns||capture.length!==world.pawns.length){
  const rows=world.pawns.filter(possible);capture={source:world.pawns,length:world.pawns.length,rows,members:new Set(rows)};scope.capture=capture;
 }
 if(verifyTerrainWriteCaches){
  // Movement also needs hostile sleeping occupants. Certify the entire
  // hostility relation, not merely the awake tactical threat subset.
  const expected=world.pawns.filter(p=>hostileTo(observer,p)),actual=capture.rows.filter(p=>hostileTo(observer,p));
  if(actual.length!==expected.length||actual.some((p,i)=>p!==expected[i]))throw Error('Human hostility changed outside its closed decision producers');
 }
 return capture.rows;
}
