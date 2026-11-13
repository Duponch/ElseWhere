import {notePopulationGain320} from './population-intent-320.ts';
import { enableAndInitializeWork, initializesWorkLikeCore302 } from './work-initialization.ts';
import { civilianAdmissionFits,civilianAwayCounts } from './civilian-away.ts';
import { isColonist } from './affiliation.ts';
import { offeredBackground,assignOfferedBackground } from './background-generation.ts';
import { relationshipOfferCandidates,chooseOfferedRelationship,prepareRelationshipAdmission } from './relationship-generation.ts';
import { arrivalEntry } from './arrival-entry.ts';
import { ARRIVAL_NAMES,arrivalRandom } from './arrival-state.ts';
import { newApparelState } from './apparel-rules.ts';
import { raidEntries } from './raid-space.ts';
import { createRaidGroup } from './raid-spawn.ts';
import { startingPawn } from './starting-pawns.ts';
import { QUEST_HISTORY_LIMIT,QUEST_OFFER_TICKS,QUEST_RETRY_TICKS,type JoinerQuest,type QuestCommand } from './quest-state.ts';
import { TICKS_PER_DAY,type CommandResult,type World } from './types.ts';

export const questsSupported=(w:World):boolean=>!!w.gameProfile&&w.raids?.profile==='cassandra-raids-v1';
const offMap=(w:World)=>w.scout&&(w.scout.phase==='travelling'||w.scout.phase==='awaiting-entry')?w.scout:w.commercialTrip&&'pawn' in w.commercialTrip?w.commercialTrip:undefined;
function admission(w:World):boolean {
  return civilianAdmissionFits(w,1,1)
    &&w.nextId<=Number.MAX_SAFE_INTEGER-2&&!!w.foodPolicies[0];
}
function liveCount(w:World):number {
  return w.pawns.reduce((n,p)=>n+Number(isColonist(p)&&p.state!=='dead'),0)+civilianAwayCounts(w).people;
}
function log(w:World,message:string):void {
  w.events.push({tick:w.tick,type:'command',message});
  if(w.events.length>80)w.events.splice(0,w.events.length-80);
}
export function enableQuests(w:World):void {
  if(!questsSupported(w))throw Error('Les offres locales demandent une colonie Atterrissage avec Cassandra.');
  if(w.quests)return;
  w.quests={profile:'pursued-joiner-v1',adoptedAt:w.tick,rng:(w.seed^w.tick^0x183ad51)>>>0||1,nextCheck:w.tick+8*TICKS_PER_DAY,serial:0,entries:[]};
}
export function applyQuestCommand(w:World,c:QuestCommand):CommandResult {
  if(c.type==='enable-quests'){
    if(!questsSupported(w))return {ok:false,code:'invalid-command',reason:'Ces offres concernent le départ Atterrissage/Cassandra.'};
    if(w.quests)return {ok:false,code:'invalid-command',reason:'Les offres locales sont déjà actives.'};
    if(!Number.isSafeInteger(w.tick+8*TICKS_PER_DAY))return {ok:false,code:'invalid-command',reason:'Limite de calendrier atteinte.'};
    enableQuests(w);log(w,'Quêtes locales activées : une première offre sera possible dans huit jours.');return {ok:true};
  }
  if(!Number.isSafeInteger(c.questId)||typeof c.accept!=='boolean')return {ok:false,code:'invalid-command',reason:'Réponse de quête invalide.'};
  const s=w.quests,q=s?.entries.find(q=>q.id===c.questId);
  if(!s||!q||q.status!=='offered'||w.tick>=q.expiresAt)return {ok:false,code:'missing-target',reason:'Cette offre est déjà traitée ou expirée.'};
  if(c.accept){
    if(!questsSupported(w)||liveCount(w)>=12||!admission(w)||!arrivalEntry(w,s.rng))return {ok:false,code:'occupied',reason:'Aucune entrée accessible ou capacité pour accueillir cette personne.'};
    q.status='accepted';q.acceptedAt=w.tick;
    log(w,`Asile accepté pour ${q.name} : une personne puis un bandit au couteau arriveront au bord de la carte.`);
  }else{q.status='refused';q.endedAt=w.tick;log(w,`L'offre d'asile de ${q.name} a été refusée. Aucune poursuite n'est engagée.`);}
  return {ok:true};
}
function arrive(w:World,q:JoinerQuest):void {
  const s=w.quests!;
  if(!admission(w))return;
  const entry=arrivalEntry(w,s.rng);if(!entry)return;
  const p=startingPawn(w.nextId,q.name,entry.x,entry.z,q.profile,55,w.seed,w.tick,w.schemaVersion);
  assignOfferedBackground(p,q,w.seed,w.tick);
  if(initializesWorkLikeCore302(w.schemaVersion))enableAndInitializeWork(p);
  p.hunger=75;p.rest=80;p.foodPolicyId=w.foodPolicies[0]!.id;p.originQuestId=q.id;
  const shirt={id:w.nextId+1,kind:'apparel' as const,item:'cloth-shirt' as const,quantity:1,owner:{type:'apparel' as const,pawnId:p.id},apparel:newApparelState('cloth-shirt',undefined,w.schemaVersion)};
  const relationships=prepareRelationshipAdmission(w,p,q.relationship);
  if(relationships===null)return;
  w.nextId+=2;w.pawns.push(p);w.piles.push(shirt);
  if(relationships!==undefined)w.relationships=relationships;
  q.pawnId=p.id;q.entry=entry;q.arrivedAt=w.tick;notePopulationGain320(w);
  log(w,`${q.name} entre au bord de la carte et rejoint la colonie. Ses poursuivants sont toujours attendus.`);
}
function pursue(w:World,q:JoinerQuest):void {
  if(w.raids?.active)return;
  const s=w.quests!,sites=raidEntries(w,s.rng,1,q.entry);if(!sites)return;
  const random={rng:s.rng};
  const group=createRaidGroup(w,{count:1,sites,random,composition:{budget:35,roster:['drifter']},preserveCalendarRng:true});
  if(!group)return;
  group.originQuestId=q.id;s.rng=random.rng;q.raidAt=w.tick;q.raidGroupId=group.id;
  log(w,`Poursuite de ${q.name} : le bandit annoncé est entré près de sa bordure d'arrivée.`);
}
/** Only actual admissions capture connectivity. Waiting keeps its committed
 * plan and retries on the same persisted phase clock, once per hundred ticks. */
export function advanceQuests(w:World):void {
  const s=w.quests;if(!s)return;
  const current=s.entries.find(q=>q.status==='offered'||q.status==='accepted');
  if(current?.status==='offered'&&w.tick>=current.expiresAt){current.status='expired';current.endedAt=current.expiresAt;log(w,`L'offre d'asile de ${current.name} a expiré.`);}
  if(current?.status==='accepted'){
    const arrivalDue=current.acceptedAt!+current.joinDelay;
    if(current.arrivedAt===undefined&&w.tick>=arrivalDue&&(w.tick-arrivalDue)%QUEST_RETRY_TICKS===0)arrive(w,current);
    if(current.arrivedAt!==undefined&&current.raidAt===undefined){
      const raidDue=Math.max(current.acceptedAt!+current.raidDelay,current.arrivedAt+current.raidDelay-current.joinDelay);
      if(w.tick>=raidDue&&(w.tick-raidDue)%QUEST_RETRY_TICKS===0)pursue(w,current);
    }
    if(current.raidAt!==undefined&&w.tick>=current.raidAt+60){current.status='concluded';current.endedAt=current.raidAt+60;log(w,`La quête d'asile de ${current.name} est conclue. Cette conclusion ne signifie pas que la poursuite est vaincue.`);}
  }
  if(w.tick<s.nextCheck)return;
  // No speculative draws when a phase or admission blocks the next offer.
  if(s.entries.some(q=>q.status==='offered'||q.status==='accepted')||!questsSupported(w)||liveCount(w)===0||liveCount(w)>=12||!admission(w)||s.serial>=Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(w.tick+8*TICKS_PER_DAY)||!arrivalEntry(w,s.rng)){
    s.nextCheck=w.tick+QUEST_RETRY_TICKS;return;
  }
  const background=w.schemaVersion>=191?offeredBackground(w.seed^0x210a511,s.serial+1):undefined;
  const plans=background?relationshipOfferCandidates(w,background.age):[],random={rng:s.rng},q:JoinerQuest={id:s.serial+1,offeredAt:w.tick,expiresAt:w.tick+QUEST_OFFER_TICKS,
    name:ARRIVAL_NAMES[Math.floor(arrivalRandom(random)*ARRIVAL_NAMES.length)]!,profile:Math.floor(arrivalRandom(random)*3) as 0|1|2,
    joinDelay:60+Math.floor(arrivalRandom(random)*61),raidDelay:Math.round((1800+Math.floor(arrivalRandom(random)*601))/250)*25,status:'offered',...background};
  if(s.entries.length>=QUEST_HISTORY_LIMIT){
    const pinned=[w.raids?.active?.originQuestId,w.raids?.last?.originQuestId];
    const old=s.entries.findIndex(q=>!pinned.includes(q.id));
    if(old<0){s.nextCheck=w.tick+QUEST_RETRY_TICKS;return;}
    s.entries.splice(old,1);
  }
  const relationship=chooseOfferedRelationship(plans,random);if(relationship)q.relationship=relationship;
  s.rng=random.rng;s.serial=q.id;s.entries.push(q);s.nextCheck=w.tick+8*TICKS_PER_DAY;
  log(w,`${q.name} demande asile : un bandit armé d'un couteau le poursuit. Décidez dans Quêtes.`);
}
