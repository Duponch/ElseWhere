import {filterPileEntries} from './pile-identity-directory.ts';
import {homeAnimalThreatPoints329} from './animal-threat-points-329.ts';
import {drawBigThreat328} from './big-threats-328.ts';
import {isConcurrentRaids341,raidSlotTaken341} from './concurrent-raids-341.ts';
import {homeRecentFactor341,recordHomeIncident341} from './recent-incidents-341.ts';
import {shipCasketHumanReferences277,shipCasketTerminalParticipant277} from './ship-casket-notifications-277.ts';
import {isSchema275OrLater} from './schema-compatibility-257.ts';
import {mechRaidGroups261,multiRaid261} from './mechanical-raid-groups-261.ts';
import {retainRaidResult261} from './temp-map-raids-261.ts';
import {advanceKidnapLord261} from './caravan-kidnap-lord-261.ts';
import {advanceTempMapRaids261,raidSource261} from './temp-map-raids-261.ts';
import {tempMapModern261} from './temp-map-incidents-261.ts';
import {advanceCaravanRaid261} from './caravan-raid-261.ts';
import { chooseMechanoidOpportunity,createMechanoidRaid,advanceMechanoidRaid } from './mechanoid-raids.ts';
import { isColonist } from './affiliation.ts';
import { carrierOf } from './rescue-state.ts';
import { consumeCassandraOpportunity,INTRO_RAID_TICK } from './cassandra-raids.ts';
import { raidEntries,atMapEdge } from './raid-space.ts';
import { RAID_ROLE_COST,pirateMaxPawnCost,raidRandom,raidStaging330,type PirateRaidComposition,type PirateRaidRole } from './raid-state.ts';
import { createRaidGroup,RAID_ROLE_OPTIONS } from './raid-spawn.ts';
import {chooseRaidComposition331,drawRaidFaction331} from './raid-factions-331.ts';
import {raidPodsPending333} from './raid-arrival-333.ts';
import {advanceRaidPods333} from './raid-pods-333.ts';
import {chooseMechanoidComposition} from './mechanoid-raid-composition.ts';
import {shipReactorBeacon275} from './ship-reactor-threats-275.ts';
import type {RaidGroup} from './raid-state.ts';
import { computeThreatPoints,summaryHealthPercent } from './threat-points.ts';
import { cancelShooting } from './shooting-state.ts';
import { cancelMelee } from './melee-state.ts';
import { TICKS_PER_DAY,type World,type Pawn } from './types.ts';
import {tutorialMode347,tutorialOrigin347,homeThreatCycle382,threatModifiers382} from './game-profile.ts';

const log=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};
/** Local projection of a Core pirate group, using only physical weapon types
 * Lisière implements. Weighted choices spend until no available role fits. */
export function chooseRaidComposition(budget:number,random:{rng:number}):PirateRaidComposition {
  if(!Number.isFinite(budget)||budget<35||budget>10000)throw new RangeError('Invalid raid budget.');
  const roster:PirateRaidRole[]=[],maxCost=pirateMaxPawnCost(budget);let remaining=budget;
  for(;;){
    const eligible=RAID_ROLE_OPTIONS.filter(option=>RAID_ROLE_COST[option.role]<=remaining&&RAID_ROLE_COST[option.role]<=maxCost);
    if(!eligible.length)break;
    const total=eligible.reduce((sum,option)=>sum+option.weight,0),draw=raidRandom(random)*total;
    let weight=0,selected=eligible.at(-1)!;
    for(const option of eligible){weight+=option.weight;if(draw<weight){selected=option;break;}}
    roster.push(selected.role);remaining-=RAID_ROLE_COST[selected.role];
  }
  return {budget,roster};
}
export function enableRaids(w:World):void {
  if(w.raids)return;const s=w.raids={profile:'camp-raids-v1' as const,rng:((w.seed^0x7a1d068)>>>0)||1,nextCheck:0,serial:0,completed:0,departed:[]};s.nextCheck=w.tick+Math.floor(TICKS_PER_DAY*(3.5+raidRandom(s)*.5));
}
export function stopRaidEngagement(p:Pawn):void {cancelShooting(p);cancelMelee(p);delete p.tactics;p.path=[];if(p.raid)p.raid.goal=null;p.planCooldown=0;}
/** One original Lord, with the same retreat/contact rules in either owner. */
function advanceHumanRaidGroup(w:World,a:RaidGroup,independent=false):void {
 if(a.arrival333?.pods)advanceRaidPods333(w,a);
 const s=w.raids!,cassandra=s.profile==='cassandra-raids-v1',members=[...w.pawns,...shipCasketHumanReferences277(w)].filter(p=>a.members.includes(p.id)),terminal=a.members.flatMap(id=>{const r=shipCasketTerminalParticipant277(w,id,'human',a.id);return r?[r]:[];}),destroyed=terminal.filter(r=>r.destroyed).length;
 for(const p of members)if((p.state==='dead'||p.state==='downed'||p.prisoner||p.recruitment?.raidGroup===a.id)&&!a.lost.includes(p.id))a.lost.push(p.id);a.lost.sort((a,b)=>a-b);
 if(a.stage330&&raidStaging330(a)&&(w.tick*10>=a.stage330.untilCore||a.lost.length*10>=a.members.length*3)){
  a.stage330.endedAtCore=w.tick*10;
  for(const p of members)if(p.raid&&!p.prisoner){p.raid.goal=null;p.path=[];p.planCooldown=0;delete p.tactics;}
  log(w,'Les assaillants regroupés passent à l’assaut.');
 }
 if(a.phase==='assault'&&!raidStaging330(a)){
  const reason=a.lossPermille!==null&&a.lost.length*1000>=a.members.length*a.lossPermille?'losses':a.deadline!==null&&w.tick>=a.deadline?'timeout':!w.pawns.some(p=>isColonist(p)&&p.state!=='dead'&&p.state!=='downed')?'colony-down':undefined;
  if(reason){a.phase='withdraw';a.reason=reason;for(const p of members)if(p.raid&&!p.prisoner){p.raid.exiting=true;stopRaidEngagement(p);}log(w,reason==='losses'?'Les assaillants battent en retraite après leurs pertes.':reason==='timeout'?'Les assaillants abandonnent et cherchent une sortie.':'La défense est tombée. Les assaillants se retirent ; les victimes restent sur place.');}
 }
 // Schema 333: raiders still in their falling or closed pods keep the raid on.
 if(!members.some(p=>p.state!=='dead'&&p.state!=='downed'&&!p.prisoner&&!isColonist(p))&&!raidPodsPending333(a.arrival333)){
  const captured=members.filter(p=>p.state!=='dead'&&(p.prisoner||p.recruitment?.raidGroup===a.id)).length;
  s.last={id:a.id,tick:w.tick,reason:a.reason==='colony-down'?'colony-down':s.departed.some(d=>a.members.includes(d.pawnId))?'withdrawn':'defended',killed:members.filter(p=>p.state==='dead').length+terminal.filter(r=>!r.destroyed&&r.actor.health?.death).length,...destroyed?{destroyed277:destroyed}:{},downed:members.filter(p=>p.state==='downed'&&!p.prisoner&&!p.recruitment).length,escaped:a.members.length-members.length-terminal.length,...captured?{captured}:{},...a.composition?{composition:a.composition}:{},...a.originQuestId!==undefined?{originQuestId:a.originQuestId}:{},...a.caravan261?{caravan261:a.caravan261,memberCount261:a.members.length}:{},...a.shipReactor275?{shipReactor275:{...a.shipReactor275}}:{},...a.concurrent341?{concurrent341:true as const}:{}};
  for(const p of members)if(p.raid&&!p.prisoner){p.raid.exiting=true;stopRaidEngagement(p);}
  retainRaidResult261(w);s.completed++;if(independent)s.extraActive261=s.extraActive261!.filter(g=>g!==a);else delete s.active;
  // A concurrent group (schema 341) may end while the primary raid goes on.
  if(!a.shipReactor275&&!tempMapModern261(w)&&!s.active&&!mechRaidGroups261(w).length&&!s.extraActive261?.length)s.nextCheck=s.profile==='camp-pressure-v1'?null:cassandra?s.cassandra!.pending[0]!:w.tick+Math.floor(TICKS_PER_DAY*(6+raidRandom(s)*2));
  log(w,'Assaut terminé. Vérifiez les blessés, les stocks et les ouvrages endommagés.');
 }
}
/** Independent reactor Lords do not borrow Cassandra's occupied agenda slot. */
function restoreShipFreeAgenda275(w:World):void {
 const s=w.raids;if(isSchema275OrLater(w.schemaVersion)&&w.shipReactorThreats275&&s?.profile==='cassandra-raids-v1'&&!s.active&&!s.mechActive&&(s.extraActive261??[]).every(g=>!!g.shipReactor275)&&(s.extraMechActive261??[]).every(g=>!!g.shipReactor275))s.nextCheck=s.cassandra!.pending[0]!;
}
/** Calendar and group outcomes, once per tick. Pawn controllers own movement. */
export function advanceRaids(w:World):void {
  const s=w.raids;if(!s)return;advanceKidnapLord261(w);advanceTempMapRaids261(w);
  // Independent reactor Lords and (schema 341) concurrent Cassandra raids.
  if(isSchema275OrLater(w.schemaVersion))for(const group of s.extraActive261?.slice()??[])if(group.shipReactor275||group.concurrent341)advanceHumanRaidGroup(w,group,true);
  const multi=multiRaid261(w);if(multi)advanceMechanoidRaid(w);
  if(s.profile==='ship-reactor-raids-v1')return;
  if(advanceCaravanRaid261(w))return;
  if(s.profile==='camp-pressure-v1'&&!s.active){if(!multi&&s.mechActive)advanceMechanoidRaid(w);return;}
  // Schema 347: while the Tutor tells the story (no storyteller comps) the
  // agenda still runs, so a due opportunity is consumed and never fires.
  const cassandra=s.profile==='cassandra-raids-v1',opportunity=cassandra&&!tempMapModern261(w)&&consumeCassandraOpportunity(w,s)&&!tutorialMode347(w);
  // Schema 341: an ongoing raid no longer swallows Cassandra's opportunity.
  const concurrent=cassandra&&isConcurrentRaids341(w.schemaVersion);
  restoreShipFreeAgenda275(w);
  const beacon=shipReactorBeacon275(w);
  if(beacon&&!cassandra&&s.nextCheck!==null&&w.tick>=s.nextCheck)s.nextCheck=w.tick+Math.floor(TICKS_PER_DAY*(6+raidRandom(s)*2));
  if(!multi&&s.mechActive){advanceMechanoidRaid(w);restoreShipFreeAgenda275(w);if(!concurrent)return;}
  if(!concurrent&&multi&&!s.active&&mechRaidGroups261(w).some(g=>!g.shipReactor275))return;
  const a=s.active;
  if(a){
    advanceHumanRaidGroup(w,a);
    restoreShipFreeAgenda275(w);
    if(!concurrent)return;
  }
  if(tempMapModern261(w))return;
  if(beacon)return;
  if(cassandra?!opportunity||!w.pawns.some(p=>isColonist(p)&&p.state!=='dead'):s.nextCheck===null||w.tick<s.nextCheck)return;
  // Only adopted Cassandra colonies use the new wealth budget. The fixed
  // introductory raid and every legacy calendar retain their exact draws.
  const budgeted=cassandra&&w.tick!==INTRO_RAID_TICK&&!!w.economy;
  const freeColonists=budgeted?w.pawns.filter(p=>isColonist(p)&&p.state!=='dead'&&!p.prisoner&&!p.visitor):[];
  const points=budgeted?computeThreatPoints({timeFactorWholeDays:w.schemaVersion>=328,animalPoints:homeAnimalThreatPoints329(w),
    knownWealth:w.economy!.wealth.knownStorytellerWealth,
    freeColonists:freeColonists.length,
    colonistHealthSum:freeColonists.reduce((sum,p)=>sum+(p.health?summaryHealthPercent(p.health):1),0),
    elapsedDays:w.tick/TICKS_PER_DAY,
    adaptationDays:w.economy!.adaptationDays,
    seedBucket:Math.floor(w.tick/250),difficulty:threatModifiers382(w),
  }).points:undefined;
  if(cassandra&&w.schemaVersion>=328&&w.tick!==INTRO_RAID_TICK){
    // Core suppresses the cycle at DaysPassed <= minDaysPassed (day 11.0).
    if(w.tick===homeThreatCycle382(w).start)return;
    // Schema 341: the absent big threats carry their recent-incident factor,
    // and a drawn one joins the home record as if it had fired.
    const recent=homeRecentFactor341(w),threat=drawBigThreat328(Math.floor(w.tick/TICKS_PER_DAY),points,()=>raidRandom(s),recent);
    if(threat!=='raid'){if(recent)recordHomeIncident341(w,threat);return;}
  }
  const random={rng:s.rng};
  const mechRandom=s.mechanoid?{rng:s.mechanoid.rng}:undefined;
  // Schema 331: Cassandra draws the raiding faction among every hostile world
  // faction, the introductory raid included (Core forces 40 points).
  // Schema 341: with a raid slot taken, the new raid arrives beside it.
  const beside=raidSlotTaken341(w);
  if(cassandra&&w.schemaVersion>=331&&w.worldFactions&&(points!==undefined||w.tick===INTRO_RAID_TICK)){startFactionRaid331(w,points??40,random,mechRandom,points===undefined,beside);return;}
  const mech=points!==undefined&&mechRandom?chooseMechanoidOpportunity(w,points,mechRandom):undefined;
  if(mech!==undefined){
    if(mech===null){s.mechanoid!.rng=mechRandom!.rng;return;}
    createMechanoidRaid(w,mech,mechRandom!,undefined,beside);return;
  }
  const composition=points!==undefined?chooseRaidComposition(points,random):undefined;
  const count=composition?.roster.length??(s.serial===0?1:2),sites=raidEntries(w,s.rng,count);
  if(!sites||!createRaidGroup(w,{count,sites,random,...(composition?{composition,recompose333:chooseRaidComposition}:{}),...beside?{concurrent341:true}:{}})){
    if(!cassandra)s.nextCheck=w.tick+TICKS_PER_DAY/4;
    return;
  }else if(mechRandom){s.mechanoid!.rng=mechRandom.rng;s.mechanoid!.lastFaction='outlaws';}
}
/** One Cassandra home raid by a faction drawn with the Core weights. The
 * draw uses the mechanical policy RNG when the colony admitted mechanoids,
 * as the historical mechanoid-or-pirate choice did; failures commit nothing
 * more than that choice did. */
function startFactionRaid331(w:World,points:number,random:{rng:number},mechRandom:{rng:number}|undefined,intro:boolean,beside=false):void {
  const s=w.raids!,draw=mechRandom??random,pick=drawRaidFaction331(w,points,()=>raidRandom(draw));
  if(!pick){if(mechRandom)s.mechanoid!.rng=mechRandom.rng;return;}
  if(pick.family==='mechanoid'){
    const composition=chooseMechanoidComposition(points,mechRandom!,w.schemaVersion>=197&&!!s.mechanoid!.ranged);
    if(!composition){s.mechanoid!.rng=mechRandom!.rng;return;}
    if(createMechanoidRaid(w,composition,mechRandom!,undefined,beside))s.lastFaction331=pick.factionId;
    return;
  }
  const composition=intro?undefined:pick.family==='pirate'?chooseRaidComposition(points,random):chooseRaidComposition331(points,pick.family,random);
  // Schema 347: after a tutorial (whose raid took the first serial) the
  // introductory raid is still Core's one forced-downed raider.
  const afterTutorial=intro&&tutorialOrigin347(w);
  const count=composition?.roster.length??(s.serial===0||afterTutorial?1:2),sites=raidEntries(w,s.rng,count);
  const family=pick.family;
  const recompose333=(budget:number,r:{rng:number})=>family==='pirate'?chooseRaidComposition(budget,r):chooseRaidComposition331(budget,family,r);
  if(!sites||!createRaidGroup(w,{count,sites,random,faction331:{factionId:pick.factionId,family},...(composition?{composition,recompose333}:{}),...beside?{concurrent341:true}:{},...afterTutorial?{forceOneDowned347:true as const}:{}}))return;
  if(mechRandom){s.mechanoid!.rng=mechRandom.rng;s.mechanoid!.lastFaction='outlaws';}
  s.lastFaction331=pick.factionId;
}
/** Remove only an actor physically at the boundary, after travel/recovery.
 * Export carried equipment with identity/quality/HP; ground loot stays here. */
export function exitRaider(w:World,p:Pawn):boolean {
  if(!w.pawns.includes(p))return false;
  if(p.raid&&(raidSource261(w,p.raid.group)?.tempIncident261||raidSource261(w,p.raid.group)?.caravan261))return false; // True WorldPawn exit follows the global pass.
  if(isColonist(p)||p.prisoner&&!p.prisoner.escape||carrierOf(w,p.id))return false;
  if(!p.raid?.exiting||!atMapEdge(w,p)||p.moveCooldown>0||(p.motion?.end??0)>w.tick||p.melee?.strike||p.shooting?.stance||p.need||p.state==='sleeping'||(p.stun?.untilCore??0)>w.tick*10||p.state==='dead'||p.state==='downed')return false;
  const items=w.piles.filter(i=>(i.owner.type==='apparel'||i.owner.type==='equipment')&&i.owner.pawnId===p.id);
  if(w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||p.interruptedCargo||p.equipmentDropPending)return false;
  const released=p.prisoner?.releasedAt!==undefined?{reason:'released' as const,capturedAt:p.prisoner.capturedAt,releasedAt:p.prisoner.releasedAt}:{};
  w.raids!.departed.push({group:p.raid.group,pawnId:p.id,name:p.name,cell:{x:p.x,z:p.z},tick:w.tick,items,...released});w.piles=filterPileEntries(w.piles,i=>!items.includes(i));w.pawns=w.pawns.filter(q=>q!==p);
  for(const q of w.pawns)if(q.shooting?.order?.targetId===p.id||q.melee?.order?.targetId===p.id||q.tactics?.targetId===p.id){stopRaidEngagement(q);if((q.motion?.end??0)<=w.tick&&q.state==='moving')q.state='idle';}
  log(w,p.prisoner?.releasedAt!==undefined?`${p.name} quitte librement la carte après sa libération, avec ses objets portés.`:p.prisoner?`${p.name} s'est échappé au bord de la carte avec ses objets portés.`:`${p.name} quitte la carte avec son équipement porté.`);return true;
}
/** Developer mode only (dev-actions.ts): a home raid right now with the given
 * threat points, through the same functions as a due storyteller opportunity (the
 * faction draw, the composition, the entry cells, the group). Nothing of the
 * calendar is consumed or rescheduled. Only the storyteller's calendar draws
 * such raids (the historical camp calendar has its own fixed groups). True when
 * raiders really arrived. */
export function startDevRaid(w:World,points:number):boolean {
  const s=w.raids;if(!s||s.profile!=='cassandra-raids-v1'||!w.pawns.some(p=>isColonist(p)&&p.state!=='dead'))return false;
  const before=w.pawns.length,random={rng:s.rng},beside=raidSlotTaken341(w);
  if(w.schemaVersion>=331&&w.worldFactions){
    startFactionRaid331(w,points,random,s.mechanoid?{rng:s.mechanoid.rng}:undefined,false,beside);
  }else{
    const composition=chooseRaidComposition(points,random),count=composition.roster.length,sites=raidEntries(w,s.rng,count);
    if(sites)createRaidGroup(w,{count,sites,random,composition,recompose333:chooseRaidComposition,...beside?{concurrent341:true}:{}});
  }
  return w.pawns.length>before;
}
