import {isSchema285OrLater} from './schema-compatibility-257.ts';
import { isColonist,distanceSquared } from './affiliation.ts';
import {alcoholModifiers265} from './alcohol-rules-265.ts';
import {malnutritionStage} from './malnutrition.ts';
import {violentWorkRefusal} from './colonist-backgrounds.ts';
import { pawnBody } from './health-rules.ts';
import { carrierOf } from './rescue-state.ts';
import { clearShotSegment,type ShotGrid } from './combat-space.ts';
import { STRUCTURE_SHOT_FILL } from './combat-content.ts';
import { footprintCells } from './definitions.ts';
import { isRoomDoor } from './door-rules.ts';
import { learnSkill } from './skills.ts';
import { canStartSocialFight,finishSocialFight,startSocialFight } from './social-fight.ts';
import { addSocialMemory,deepTalkWeight,expireSocialMemories,opinionOf,SOCIAL_LABELS,socialCompatibility,socialImpact,socialRandom,socialSeed,type SocialInteractionKind,type SocialState } from './social-state.ts';
import { breakupSelectionWeight,performRomanceExchange,romanceSelectionWeight } from './romance.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import type { RelationshipPeople } from './relationship-state.ts';
import type { Pawn,World } from './types.ts';

const stateFor=(w:World,p:Pawn):SocialState=>p.social??={rng:socialSeed(w.seed,p.id),memories:[]};
export function canSocialize(world:World,pawn:Pawn,initiate:boolean,carried?:ReadonlySet<number>):boolean {
  if(isSchema285OrLater(world.schemaVersion)&&pawn.coupleTask285)return false;
  if(!isColonist(pawn)||pawn.state==='dead'||pawn.state==='downed'||pawn.state==='sleeping'||pawn.medicalSleep||pawn.mental?.crisis||pawn.stun||pawn.shooting||pawn.melee||pawn.social?.fight||pawn.flee||pawn.tactics||(carried?carried.has(pawn.id):carrierOf(world,pawn.id)))return false;
  const body=pawnBody(pawn);return body.canBeAwake&&(!initiate||body.capacities.talking>0);
}
/** Full obstacles only: no combat lean, no navigation and no scan of map vegetation.
 * Built lazily for this synchronous interaction pass, never retained after mutation. */
function socialSight(world:World):ShotGrid {
  const blocked=new Set<number>();for(const s of world.structures)if(STRUCTURE_SHOT_FILL[s.kind]>.99&&!(isRoomDoor(s.kind)&&s.door?.open))for(const c of footprintCells(s))blocked.add(c.z*world.width+c.x);
  return {width:world.width,height:world.height,coverAt:()=>undefined,blocksSight:(x,z)=>world.tiles[z*world.width+x]?.terrain==='rock'||blocked.has(z*world.width+x)};
}
export function goodSocialPosition(world:World,a:Pawn,b:Pawn,grid:ShotGrid=socialSight(world)):boolean {
  return a.id!==b.id&&distanceSquared(a,b)<=36&&!grid.blocksSight(b.x,b.z)&&clearShotSegment(grid,a,b);
}
const opinionWeight=[[-100,6],[-50,4],[-25,2],[0,1],[50,.1],[100,0]] as const;
const compatibilityWeight=[[-2.5,4],[-1.5,3],[-.5,2],[.5,1],[1,.75],[2,.5],[3,.4]] as const;
const fightOpinionWeight=[[-100,4],[0,1],[100,.6]] as const;
function curve(value:number,points:readonly (readonly [number,number])[]):number {
  if(value<=points[0]![0])return points[0]![1];
  for(let i=1;i<points.length;i++){
    const [x,y]=points[i]!,[previousX,previousY]=points[i-1]!;
    if(value<=x)return previousY+(y-previousY)*(value-previousX)/(x-previousX);
  }
  return points[points.length-1]![1];
}
/** Pair affinity needs no PRNG draw. Slave, gene and age rules remain outside
 * this human social slice. */
export function negativeInteractionFactor(world:World,initiator:Pawn,recipient:Pawn,compatibility=socialCompatibility(world.seed,initiator.id,recipient.id)):number {
  if(initiator.traits?.includes('kind'))return 0;
  return curve(opinionOf(initiator,recipient.id,world.tick,world),opinionWeight)
    *curve(compatibility,compatibilityWeight)
    *(initiator.traits?.includes('abrasive')?2.3:1);
}
export function passiveSocialWeights(world:World,initiator:Pawn,recipient:Pawn,people?:RelationshipPeople):{chitchat:number;'deep-talk':number;'kind-words':number;slight:number;insult:number;'romance-attempt':number;breakup:number} {
  const compatibility=socialCompatibility(world.seed,initiator.id,recipient.id);
  const negative=negativeInteractionFactor(world,initiator,recipient,compatibility);
  return {chitchat:1,'deep-talk':deepTalkWeight(compatibility),'kind-words':initiator.traits?.includes('kind') ? .01 : 0,slight:.02*negative,insult:.007*negative,
    'romance-attempt':romanceSelectionWeight(world,initiator,recipient,people),breakup:breakupSelectionWeight(world,initiator,recipient)};
}
/** The opinion factor reads the recipient after its new directed memory. */
export function socialFightChance(world:World,recipient:Pawn,initiator:Pawn,kind:'slight'|'insult'):number {
  if(world.schemaVersion>=319&&violentWorkRefusal(recipient))return 0;
  const malnutrition319=world.schemaVersion>=319?[1,1.5,2,2.5,3,1][malnutritionStage(recipient.health?.malnutrition)]!:1;
  const capacities=pawnBody(recipient).capacities;
  const usable=(value:number)=>Math.max(0,Math.min(1,(value-.3)/.7));
  return Math.min(1,(kind==='slight' ? .005 : .04)*usable(capacities.manipulation)*usable(capacities.moving)
    *curve(opinionOf(recipient,initiator.id,world.tick,world),fightOpinionWeight)*(recipient.traits?.includes('bloodlust')?4:1)*(recipient.health?alcoholModifiers265(recipient.health).socialFightFactor:1)*malnutrition319);
}
/** Passive exchanges do not acquire reservations, cancel work or retime an edge. */
export function exchangeSocial(world:World,a:Pawn,b:Pawn,kind:SocialInteractionKind,grid?:ShotGrid):boolean {
  if(kind==='fight-cathartic'||kind==='fight-angering')return false;
  if((kind==='kind-words'&&!a.traits?.includes('kind'))
    ||(a.traits?.includes('kind')&&(kind==='slight'||kind==='insult')))return false;
  if(!world.pawns.includes(a)||!world.pawns.includes(b)||!canSocialize(world,a,true)||!canSocialize(world,b,false)||world.tick-(a.social?.last?.tick??-1000)<12||!goodSocialPosition(world,a,b,grid))return false;
  if(kind==='romance-attempt'||kind==='breakup'){
    const outcome=performRomanceExchange(world,a,b,kind);if(!outcome)return false;
    const sa=stateFor(world,a),sb=stateFor(world,b);
    sa.last={otherId:b.id,kind,tick:world.tick,initiated:true};sb.last={otherId:a.id,kind,tick:world.tick,initiated:false};delete sa.wants;
    world.events.push({tick:world.tick,type:'need',message:outcome==='formed'?`${a.name} et ${b.name} deviennent partenaires.`:outcome==='rebuffed'?`${b.name} repousse l’avance de ${a.name}.`:`${a.name} se sépare de ${b.name}.`});
    if(world.events.length>80)world.events.splice(0,world.events.length-80);return true;
  }
  const sa=stateFor(world,a),sb=stateFor(world,b),impactA=socialImpact(a),impactB=socialImpact(b);
  expireSocialMemories(a,world.tick);expireSocialMemories(b,world.tick);
  if(kind==='slight'||kind==='insult'){
    addSocialMemory(sb,a.id,kind,world.tick,impactA);
    if(canStartSocialFight(world,a,b)&&socialRandom(sb)<socialFightChance(world,b,a,kind))startSocialFight(world,a,b);
  }else{
    addSocialMemory(sa,b.id,kind,world.tick,impactB);addSocialMemory(sb,a.id,kind,world.tick,impactA);
    if(kind==='chitchat'||kind==='deep-talk'){
      a.skills.social??={level:0,xp:0,dailyXp:0,passion:0};learnSkill(a.skills.social,(kind==='chitchat'?4:10)*1000,a);
    }
  }
  sa.last={otherId:b.id,kind,tick:world.tick,initiated:true};sb.last={otherId:a.id,kind,tick:world.tick,initiated:false};delete sa.wants;
  world.events.push({tick:world.tick,type:'need',message:kind==='slight'?`${a.name} a vexé ${b.name}.`:kind==='insult'?`${a.name} a insulté ${b.name}.`:`${SOCIAL_LABELS[kind]} entre ${a.name} et ${b.name}.`});if(world.events.length>80)world.events.splice(0,world.events.length-80);
  return true;
}
/** The patient visit owns its conversation cadence; no passive roll is due for
 * the visitor while the physical visit is active. */
export function visitSocialExchange(world:World,visitor:Pawn,patient:Pawn):boolean {
  if(visitor.recreation.task?.activity!=='visit-sick'||visitor.recreation.task.phase!=='active'||visitor.recreation.task.patientId!==patient.id
    ||!canSocialize(world,visitor,true)||!canSocialize(world,patient,false)||!goodSocialPosition(world,visitor,patient))return false;
  const kind=socialRandom(stateFor(world,visitor))<.8?'chitchat':'deep-talk';
  return exchangeSocial(world,visitor,patient,kind);
}
/** Hash checks: 60 Core ticks; pending attempts retry every 91 Core ticks.
 * Recipients are sampled uniformly among eligible nearby colonists. */
export function advanceSocial(world:World):void {
  let grid:ShotGrid|undefined;
  let people:RelationshipPeople|undefined;
  for(const p of world.pawns)if(p.social?.fight){
    const other=world.pawns.find(q=>q.id===p.social!.fight!.opponentId);
    if(!other||other.social?.fight?.opponentId!==p.id||p.melee?.order?.auto!=='social'||other.melee?.order?.auto!=='social')finishSocialFight(world,p);
  }
  const carried=new Set(world.pawns.flatMap(p=>p.rescue?.phase==='carry'?[p.rescue.patientId]:[]));
  for(const p of world.pawns){
    expireSocialMemories(p,world.tick);
    if(p.recreation.task?.activity==='visit-sick'&&p.recreation.task.phase==='active')continue;
    if(!canSocialize(world,p,true,carried)){if(p.social)delete p.social.wants;continue;}
    if(p.draft&&p.social)delete p.social.wants;
    const prior=p.social,last=prior?.last?.tick??-1000,pending=!!prior?.wants;
    if(pending?(world.tick*10+p.id)%91>=10:(world.tick+p.id)%6!==0||world.tick<=last+32)continue;
    const s=stateFor(world,p);
    const intensive=p.recreation.task?.activity==='social-relax'&&p.recreation.task.phase==='active'&&p.state==='recreating';
    if(!pending&&socialRandom(s)>=60/(p.draft?22000:intensive?550:6600))continue;
    if(world.tick-last<12)continue;
    const candidates=world.pawns.filter(q=>q!==p&&distanceSquared(p,q)<=36&&canSocialize(world,q,false,carried));
    if(candidates.length){grid??=socialSight(world);const eligible=candidates.filter(q=>goodSocialPosition(world,p,q,grid));
      if(eligible.length){const other=eligible[Math.floor(socialRandom(s)*eligible.length)]!;
        if(world.schemaVersion>=195)people??=captureRelationshipPeople(world);
        const weights=passiveSocialWeights(world,p,other,people),total=weights.chitchat+weights['deep-talk']+weights['kind-words']+weights.slight+weights.insult+weights['romance-attempt']+weights.breakup;
        const roll=socialRandom(s)*total;
        const kind=roll<weights.chitchat?'chitchat':roll<weights.chitchat+weights['deep-talk']?'deep-talk':roll<weights.chitchat+weights['deep-talk']+weights['kind-words']?'kind-words':roll<weights.chitchat+weights['deep-talk']+weights['kind-words']+weights.slight?'slight':roll<weights.chitchat+weights['deep-talk']+weights['kind-words']+weights.slight+weights.insult?'insult':roll<total-weights.breakup?'romance-attempt':'breakup';
        if(exchangeSocial(world,p,other,kind,grid))continue;
      }
    }
    s.wants=true;
  }
}
