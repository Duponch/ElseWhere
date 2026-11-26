import {appendPileEntries} from './pile-identity-directory.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {siteAmbushTriggered263} from './world-site-ambush-state-263.ts';
import {prepareSiteThreatPlacements263} from './world-site-threat-placement-263.ts';
import {draftSiteManhunterRoster263} from './caravan-manhunter-261.ts';
import {prepareManhunterSpawn261} from './animal-scaria-261.ts';
import {draftForeignRoster261} from './caravan-foreign-roster-261.ts';
import {selectCaravanFaction261,type CaravanFactionCapture261} from './caravan-faction-selection-261.ts';
import {CARAVAN_FACTION_DATA_261} from './caravan-faction-data-261.ts';
import {draftSiteMechanoidRoster263,assembleSiteMechanoids263} from './world-site-mechanoids-263.ts';
import {civilianAdmissionFits} from './civilian-away.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import {healthRandom} from './health.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {newTactics} from './tactics-state.ts';
import {processTactics} from './tactics.ts';
import type {World,Pawn} from './types.ts';
import type {WorldSiteAmbush263} from './world-site-ambush-state-263.ts';
import type {NavigationGrid,SearchBudget} from './work-planner.ts';
import type {LightReader} from './light-environment.ts';

/** Native SignalAction resolves once. A refused private draft/placement
 * publishes no original and cannot be used to reroll the selected force. */
function activate263(w:World,s:WorldSiteAmbush263,core:number):void {
 const where=s.kind==='ambush-edge'?{kind:'edge' as const}:{kind:'around' as const,rect:s.storage},releaseAtCore=core+(s.kind==='ambush-hidden'?120:0);
 let rng=s.rng;const humanIds:number[]=[],animalIds:number[]=[],mechanoidIds:number[]=[];
 if(s.payload==='human'){
  const f=w.worldFactions!,random={rng},capture:CaravanFactionCapture261[]=f.factions.map(a=>({id:a.id,def:a.def,player:a.id===f.playerFactionId,hidden:a.hidden,lifecycle259:a.lifecycle259,hostileToPlayer:f.relations.some(r=>r.aId===Math.min(a.id,f.playerFactionId)&&r.bId===Math.max(a.id,f.playerFactionId)&&r.kind==='hostile')})),selected=selectCaravanFaction261(capture,'combat',10000,()=>healthRandom(random));rng=random.rng;
  if(selected.ok){const faction=f.factions.find(a=>a.id===selected.factionId)!,facts=Object.hasOwn(CARAVAN_FACTION_DATA_261,faction.def)?CARAVAN_FACTION_DATA_261[faction.def as keyof typeof CARAVAN_FACTION_DATA_261]:undefined;
   const roster=facts?draftForeignRoster261(w,'combat',selected.factionId,Math.max(s.points,facts.combatMinimum),rng):null;
   if(roster){rng=roster.rng;const placed=prepareSiteThreatPlacements263(w,roster.people.length,rng,where);if(placed&&civilianAdmissionFits(w,roster.people.length,roster.items.length)){
    rng=placed.rng;for(let i=0;i<roster.people.length;i++){const p=roster.people[i]!;Object.assign(p,placed.cells[i]!);p.path=[];p.state='idle';p.moveCooldown=0;p.planCooldown=0;delete p.raid;p.tactics=newTactics();humanIds.push(p.id);}
    w.pawns.push(...roster.people);appendPileEntries(w.piles,...roster.items);w.nextId=roster.nextId;for(const p of roster.people)notifyActualExplorationSpawn256(w,p);
   }}
  }
 }else if(s.payload==='manhunters'){
  const site=w.worldSites263!.entries.find(x=>x.id===s.siteId)!,roster=draftSiteManhunterRoster263(w,site.tile,s.points,rng);
  if(roster){rng=roster.rng;const placed=prepareSiteThreatPlacements263(w,roster.animals.length,rng,where);if(placed&&w.wildlife&&w.wildlife.animals.length+roster.animals.length<=MAX_WILDLIFE){
   const animals=roster.animals.map((a,i)=>{Object.assign(a,placed.cells[i]!);return prepareManhunterSpawn261(w,a,core);});
   if(animals.every(a=>a!==undefined)){rng=placed.rng;w.wildlife.animals.push(...animals);w.nextId=roster.nextId;for(const a of animals){animalIds.push(a.id);notifyActualExplorationSpawn256(w,a);}}
  }}
 }else{
  const roster=draftSiteMechanoidRoster263(s.points,rng);if(roster){rng=roster.nextRng;if(roster.roster.length){const placed=prepareSiteThreatPlacements263(w,roster.roster.length,rng,where);if(placed){const assembled=assembleSiteMechanoids263(w,roster.roster,placed.rng,placed.cells,s.siteId,{sleeping:false,wakeIfClose:false,bornAtCore:core,releaseAtCore});if(assembled){rng=assembled.rng;(w.mechanoids??=[]).push(...assembled.mechanoids);w.nextId=assembled.nextId;mechanoidIds.push(...assembled.mechanoids.map(m=>m.id));}}}}
 }
 s.rng=rng;s.phase='active';s.activatedAtCore=core;s.releaseAtCore=releaseAtCore;s.humanIds=humanIds;s.animalIds=animalIds;s.mechanoidIds=mechanoidIds;
 if(humanIds.length||animalIds.length||mechanoidIds.length){w.events.push({tick:w.tick,type:'command',message:'Une embuscade se déclenche sur le Site.'});if(w.events.length>80)w.events.splice(0,w.events.length-80);}
}
/** True local simulation phase only; no RAF, load initializer or missed-tick
 * replay. Each published participant remains in its real local owner list. */
export function advanceSiteAmbush263(w:World):void {
 const s=w.worldSiteThreat263;if(!isSchema263OrLater(Number(w.schemaVersion))||!s||s.phase!=='armed')return;
 if(siteAmbushTriggered263(w,s))activate263(w,s,s.explosionAtCore??w.tick*10);
}
export function siteAmbushWaiting263(w:World,id:number,kind:'human'|'animal'):boolean {
 const s=w.worldSiteThreat263;return isSchema263OrLater(Number(w.schemaVersion))&&!!s&&s.phase==='active'&&s.releaseAtCore!==null&&w.tick*10<s.releaseAtCore&&(kind==='human'?s.humanIds:s.animalIds).includes(id);
}
export function isSiteAmbushHuman263(w:World,p:Pawn):boolean {const s=w.worldSiteThreat263;return isSchema263OrLater(Number(w.schemaVersion))&&!!s&&s.phase==='active'&&s.humanIds.includes(p.id)&&p.faction==='outlaws'&&!p.prisoner;}
export function processSiteAmbushHuman263(w:World,p:Pawn,getBlocked:NavigationGrid,budget:SearchBudget,getLight:LightReader):void {
 if(!isSiteAmbushHuman263(w,p))throw Error('No actual Site human ambush mandate');
 if(siteAmbushWaiting263(w,p.id,'human')){p.path=[];if(!p.motion||p.motion.end<=w.tick)p.state='idle';return;}
 p.tactics??=newTactics();processTactics(w,p,getBlocked,budget,getLight);
}
