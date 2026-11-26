import {appendPileEntries} from './pile-identity-directory.ts';
import { enableAndInitializeWork, initializesWorkLikeCore302 } from './work-initialization.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {bindBornHumanFaction259} from './world-affiliation-259.ts';
import { arrivalTraits,isTraitsSchema361 } from './traits.ts';
import { bornTraitEffects361,offeredTraits361 } from './trait-generation-361.ts';
import { offeredBornBackground,assignOfferedBackground } from './background-generation.ts';
import { coreSkillBirth372,coreSkillRecords372,giveCoreSkills372,skillStream372 } from './skill-generation-372.ts';
import { bornWimpRecord362 } from './wimp-record-362.ts';
import { biologicalYears } from './human-age.ts';
import type { PawnSkills } from './skills.ts';
import { relationshipOfferCandidates,chooseOfferedRelationship,prepareRelationshipAdmission } from './relationship-generation.ts';
import { ARRIVAL_NAMES,arrivalRandom,type ArrivalCommand } from './arrival-state.ts';
import { arrivalEntry } from './arrival-entry.ts';
import { isColonist } from './affiliation.ts';
import { startingPawn } from './starting-pawns.ts';
import { newApparelState } from './apparel-rules.ts';
import { TICKS_PER_DAY,type World,type CommandResult } from './types.ts';

const log=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};
export function enableArrivals(world:World):void {
  if(world.gameProfile)throw new Error('Historical arrivals are unavailable for the selected storyteller.');
  if(world.arrivals)return;
  const s=world.arrivals={profile:'camp-arrivals-v1' as const,rng:((world.seed^0xa7719e31)>>>0)||1,nextCheck:0,serial:0,accepted:0,declined:0,expired:0};
  s.nextCheck=world.tick+Math.floor(TICKS_PER_DAY*(1.5+arrivalRandom(s)*.5));
}
export function advanceArrivals(world:World):void {
  const s=world.arrivals;if(!s)return;
  if(s.pending&&world.tick>=s.pending.expiresAt){s.expired++;delete s.pending;log(world,'La demande d’accueil a expiré. Le voyageur poursuit sa route.');}
  if(world.tick<s.nextCheck)return;
  // Explicit provisional pacing. Complete population intent, difficulty and
  // competing incidents belong to the future storyteller, not this profile.
  const random={rng:s.rng},nextCheck=world.tick+Math.floor(TICKS_PER_DAY*(4+arrivalRandom(random)*4));
  if(s.pending||world.pawns.filter(p=>isColonist(p)&&p.state!=='dead').length>=12||!arrivalEntry(world,random.rng)
    ||!Number.isSafeInteger(s.serial+1)||!Number.isSafeInteger(world.tick+TICKS_PER_DAY)){
    s.nextCheck=nextCheck;s.rng=random.rng;return;
  }
  // Schema 370: Core's wanderer is a Villager without a faction.
  const id=s.serial+1,background=world.schemaVersion>=191?offeredBornBackground(world,world.seed^0x210a771,id,{kind:'Villager',faction:'random'}):undefined;
  const plans=background?relationshipOfferCandidates(world,background.age):[];
  const profile=Math.floor(arrivalRandom(random)*3) as 0|1|2;
  const name=ARRIVAL_NAMES[Math.floor(arrivalRandom(random)*ARRIVAL_NAMES.length)]!;
  const relationship=chooseOfferedRelationship(plans,random);
  // Schema 361: Core traits, drawn privately for the offered identity.
  const traits=isTraitsSchema361(world.schemaVersion)?offeredTraits361(world.seed,id,background?.age,background?.background,world.schemaVersion):arrivalTraits(profile,id);
  s.pending={id,openedAt:world.tick,expiresAt:world.tick+TICKS_PER_DAY,name,profile,...traits?{traits}:{},...background,...relationship?{relationship}:{}};
  s.serial=id;s.nextCheck=nextCheck;s.rng=random.rng;
  log(world,`${name} demande à rejoindre la colonie. Répondez dans la journée.`);
}
export function applyArrival(world:World,command:ArrivalCommand):CommandResult {
  const refuse=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
  if(command.type==='enable-arrivals') {if(world.gameProfile)return refuse('Le calendrier d’accueil historique n’est pas disponible avec ce narrateur.');enableArrivals(world);return {ok:true};}
  const s=world.arrivals,o=s?.pending;
  if(!o||!Number.isSafeInteger(command.offerId)||command.offerId!==o.id||typeof command.accept!=='boolean'||world.tick>=o.expiresAt)return refuse('Cette demande n’est plus disponible.');
  if(!command.accept) {
    for(const p of world.pawns)if(isColonist(p)&&p.state!=='dead'&&!p.mental?.crisis) {
      const memories=(p.deniedJoining??[]).filter(t=>t>world.tick);
      // Same-tick duplicate decisions cannot occur for this sole pending letter.
      p.deniedJoining=[...memories,world.tick+6*TICKS_PER_DAY].slice(-5);
    }
    s!.declined++;delete s!.pending;log(world,`La demande de ${o.name} a été refusée.`);return {ok:true};
  }
  if(!civilianAdmissionFits(world,1,1)||world.nextId>Number.MAX_SAFE_INTEGER-2)return refuse('La carte ne peut plus accueillir cette personne.');
  const entry=arrivalEntry(world,s!.rng);if(!entry)return refuse('Aucune entrée libre et accessible depuis la colonie. La demande reste ouverte.');
  const pawn=startingPawn(world.nextId,o.name,entry.x,entry.z,o.profile,55,world.seed,world.tick,world.schemaVersion);
  if((Number(world.schemaVersion)===259||Number(world.schemaVersion)===260||(Number(world.schemaVersion)===261||(Number(world.schemaVersion)===262||isSchema263OrLater(Number(world.schemaVersion)))))&&world.worldFactions&&!bindBornHumanFaction259(world,pawn,world.worldFactions.playerFactionId))return refuse('L’instance de faction réelle manque pour cette arrivée.');
  assignOfferedBackground(pawn,o,world.seed,world.tick,world.schemaVersion);
  if(o.traits)pawn.traits=[...o.traits];
  // Schema 372: Core's skills and passions of the offered person (Core
  // backstories), on the offer's own identity, so the letter can show them.
  if(coreSkillBirth372(world.schemaVersion,pawn.background)){bornWimpRecord362(pawn,world.tick);giveCoreSkills372(pawn,arrivalSkillStream372(world.seed,o.id));}
  else if(o.traits&&isTraitsSchema361(world.schemaVersion))bornTraitEffects361(pawn,world.tick);
  if(initializesWorkLikeCore302(world.schemaVersion))enableAndInitializeWork(pawn);
  pawn.hunger=75;pawn.rest=80;pawn.foodPolicyId=world.foodPolicies[0]!.id;
  // Clothing crosses the map boundary with its owner; it is an external input,
  // not a withdrawal from colony stock or a textile-production recipe.
  const shirt={id:world.nextId+1,kind:'apparel' as const,item:'cloth-shirt' as const,quantity:1,owner:{type:'apparel' as const,pawnId:pawn.id},apparel:newApparelState('cloth-shirt',undefined,world.schemaVersion)};
  const relationships=prepareRelationshipAdmission(world,pawn,o.relationship);
  if(relationships===null)return refuse('Le lien familial annoncé ne peut plus être engagé. La demande reste ouverte.');
  world.nextId+=2;world.pawns.push(pawn);appendPileEntries(world.piles,shirt);
  if(relationships!==undefined)world.relationships=relationships;
  s!.accepted++;delete s!.pending;
  log(world,`${pawn.name} rejoint la colonie par le bord de la carte avec sa chemise. Prévoyez un couchage et ses affectations.`);
  return {ok:true};
}
import { civilianAdmissionFits } from './civilian-away.ts';

/** Schema 372: the private skill stream of an arrival offer (its identity). */
const arrivalSkillStream372=(seed:number,offerId:number)=>skillStream372((seed^0x210a771)>>>0,offerId);
/** Schema 372: the levels and passions an arrival offer will have at
 * acceptance; undefined when the offer is not a Core birth of this
 * schema (the letter keeps its historical preview). */
export function arrivalOfferSkills372(world:Pick<World,'schemaVersion'|'seed'>,offer:{id:number;age?:import('./human-age.ts').HumanAge;background?:import('./colonist-backgrounds.ts').ColonistBackground;traits?:readonly import('./traits.ts').TraitId[]}):PawnSkills|undefined {
  if(!offer.background||!offer.age||!coreSkillBirth372(world.schemaVersion,offer.background))return undefined;
  return coreSkillRecords372({draw:arrivalSkillStream372(world.seed,offer.id),ageYears:biologicalYears(offer.age),background:offer.background,traits:offer.traits??[]},-1);
}
