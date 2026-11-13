import {localAuroraThought305} from './misc-incidents-305.ts';
import {partyMoodThoughts292,expirePartyMemories292} from './party-memories-292.ts';
import {readingActive295} from './reading-state-295.ts';
import {memoryExpiry271,memoryReadTick271} from './suspended-memory-271.ts';
import {hiveDefeatThoughts256} from './cave-hive-memories-256.ts';
import {alcoholThoughts265} from './alcohol-rules-265.ts';
import {cryptosleepSick256} from './cryptosleep-sickness-256.ts';
import {lostThoughts} from './world-map-lost.ts';
import {isSchema282OrLater} from './schema-compatibility-257.ts';
import {thermalMoodThoughts460} from './thermal-mood-v460.ts';
import {toxicFalloutActive294} from './toxic-fallout-state-294.ts';
import {carrierOf} from './rescue-state.ts';
import {isRoofed} from './roof-rules.ts';
import {temperatureAt} from './temperature.ts';
import { COLONY_EXPECTATIONS,type ColonyExpectation } from './expectations.ts';
import { colonyExpectation } from './colony-economy.ts';
import { malnutritionStage } from './malnutrition.ts';
import { expireRoomMemoriesAt,roomMoodThoughtsAt } from './room-experience.ts';
import { TRAITS } from './traits.ts';
import { colonistMoodOffset } from './game-profile.ts';
import { APPAREL,apparelInsulation } from './apparel-rules.ts';
import { pawnBody } from './health-rules.ts';
import { medicalPain } from './injury-state.ts';
import { insultMoodMemories,kindWordsMoodMemories } from './social-state.ts';
import { bereavementThoughtsAt,expireBereavement } from './bereavement.ts';
import { deathThoughtsAt,expireDeathThoughts } from './death-thoughts.ts';
import { colonistUnburiedThought } from './death-thoughts-perception.ts';
import { expireFamilyBereavement,familyBereavementThoughtsAt } from './family-bereavement.ts';
import { expireRomanceMemories,romanceMoodThoughtsAt } from './romance-memories.ts';
import {coupleMoodThoughts285,expireCoupleMemories285} from './couple-memories-285.ts';
import { relationshipHousingThought,type RelationshipTopology } from './relationship-housing.ts';
import { captureRelationshipPeople } from './relationship-namespace.ts';
import type { BodyAssessment } from './body-capacities.ts';
import { TICKS_PER_DAY,type Pawn,type World,type MaterialPile } from './types.ts';

export const MOOD_BASE=32;
export const MOOD_RISE_PER_HOUR=12,MOOD_FALL_PER_HOUR=8;
export interface MoodThought {
  readonly id:string;readonly label:string;readonly offset:number;
  readonly kind:'situation'|'memory';readonly description:string;readonly expiresAt?:number;
}
const situation=(id:string,label:string,offset:number,description:string):MoodThought=>Object.freeze({id,label,offset,description,kind:'situation'});
const hunger=[situation('hungry','Faim',-6,'Nutrition sous 24 %.'),situation('ravenous','Très faim',-12,'Nutrition sous 12 %.'),situation('starving','Affamé',-20,'Nutrition épuisée.')];
const starvation=['Malnutrition débutante','Malnutrition légère','Malnutrition modérée','Famine sévère','Famine extrême'].map((label,index)=>situation(`starvation-${index}`,label,-20-index*6,'Nutrition épuisée et malnutrition progressive.'));
const fatigue=[situation('drowsy','Somnolent',-6,'Repos sous 28 %.'),situation('tired','Très fatigué',-12,'Repos sous 14 %.'),situation('exhausted','Épuisé',-18,'Repos sous 1 %.')];
const comforts=[situation('uncomfortable','Inconfortable',-3,'Confort sous 10 %.'),situation('comfortable','Confortable',4,'Confort d’au moins 60 %.'),situation('quite-comfortable','Très confortable',6,'Confort d’au moins 70 %.'),situation('extremely-comfortable','Extrêmement confortable',8,'Confort d’au moins 80 %.'),situation('luxurious','Confort luxueux',10,'Confort d’au moins 90 %.')];
const beauty=[situation('hideous-environment','Environnement affreux',-15,'Beauté perçue sous 1 %.'),situation('very-ugly-environment','Environnement très laid',-10,'Beauté perçue sous 15 %.'),situation('ugly-environment','Environnement laid',-5,'Beauté perçue sous 35 %.'),situation('pretty-environment','Joli environnement',5,'Beauté perçue d’au moins 65 %.'),situation('beautiful-environment','Bel environnement',10,'Beauté perçue d’au moins 85 %.'),situation('gorgeous-environment','Environnement splendide',15,'Beauté perçue d’au moins 99 %.')];
const leisure=[situation('recreation-starved','Privé de loisirs',-20,'Loisirs sous 1 %.'),situation('recreation-deprived','Manque important de loisirs',-10,'Loisirs sous 15 %.'),situation('recreation-low','Manque de loisirs',-5,'Loisirs sous 30 %.'),situation('recreation-high','Loisirs satisfaisants',5,'Loisirs d’au moins 70 %.'),situation('recreation-full','Loisirs pleinement satisfaits',10,'Loisirs d’au moins 85 %.')];
const pains=[situation('minor-pain','Douleur légère',-5,'Douleur présente, sous 15 %.'),situation('serious-pain','Douleur importante',-10,'Douleur d’au moins 15 %.'),situation('intense-pain','Douleur intense',-15,'Douleur d’au moins 40 %.'),situation('extreme-pain','Douleur extrême',-20,'Douleur d’au moins 80 %.')];
const sick=situation('sick','Malade',-5,'Maladie active ; cette pensée disparaît avec la maladie.');
const readingPassion295=[situation('reading-passion','Passion pour la lecture',4,'Une passion intellectuelle est satisfaite pendant la lecture effective.'),situation('reading-burning-passion','Passion ardente pour la lecture',6,'Une passion intellectuelle ardente est satisfaite pendant la lecture effective.')];
const toxicFallout294=situation('toxic-fallout','Retombées toxiques',-5,'Des retombées toxiques sont présentes au-dessus de cette position non couverte. Cette pensée disparaît sous un toit ou à la fin de la condition ; elle ne mesure pas une dose clinique.');
const apparel=[situation('ratty-apparel','Vêtements abîmés',-3,'Au moins une pièce portée a moins de 50 % de ses PV.'),situation('tattered-apparel','Vêtements en lambeaux',-5,'Au moins une pièce portée a moins de 20 % de ses PV.')];
const expectationThoughts=new Map(COLONY_EXPECTATIONS.map(e=>[e.id,situation(`expectations-${e.id}`,e.label,e.moodOffset,'Attentes liées au patrimoine évalué de la colonie ; les valeurs inconnues restent exclues.')]));
const camp=situation('camp-expectations','Attentes extrêmement basses',30,'Profil fixe de ce camp, partagé avec les loisirs ; ne varie pas encore avec la richesse.');
const memoryLabels={'ate-kibble':'A mangé des croquettes','ate-nutrient-paste':'A mangé de la pâte nutritive','ate-without-table':'Mangé sans table','ate-raw-food':'Mangé cru','ate-fine-meal':'A mangé un bon repas','ate-lavish-meal':'A mangé un repas gastronomique'} as const;
const memoryOffsets={'ate-kibble':-12,'ate-nutrient-paste':-4,'ate-without-table':-3,'ate-raw-food':-7,'ate-fine-meal':5,'ate-lavish-meal':12} as const;

const hungerStage=(value:number)=>value<=0?2:value<12?1:value<24?0:-1;
const restStage=(value:number)=>value<1?2:value<14?1:value<28?0:-1;
const comfortStage=(value:number)=>value<10?0:value<60?-1:value<70?1:value<80?2:value<90?3:4;
const beautyStage=(value:number)=>value<=1?0:value<15?1:value<35?2:value<65?-1:value<85?3:value<99?4:5;
/** Schema 313: Core Need_Beauty.CurCategory uses strict '>' bounds (an exact
 * 35 is still ugly, an exact 65 still neutral). */
const beautyStage313=(value:number)=>value<=1?0:value<=15?1:value<=35?2:value<=65?-1:value<=85?3:value<=99?4:5;
const joyStage=(value:number)=>value<1?0:value<15?1:value<30?2:value<70?-1:value<85?3:4;
const painStage=(value:number)=>value<.0001?-1:value<.15?0:value<.4?1:value<.8?2:3;
export const comfortMood=(value:number):number=>comforts[comfortStage(value)]?.offset??0;

/** Situation facts are derived, never saved as permanent memories. The same
 * evaluator supplies simulation and inspection, outside render frames. Current
 * content permits one stage per family and one memory per meal kind. */
export type PersonalMoodPeople=Pick<ReadonlyMap<number,{readonly name:string}>,'get'>;
const unnamedCouplePeople285:PersonalMoodPeople=Object.freeze({get:(_id:number)=>undefined});
export interface PersonalMoodContext {
  tick:number;people:PersonalMoodPeople;
  /** Local compatibility uses its existing namespace for family/romance labels. */
  relationPeople?:PersonalMoodPeople;
  /** Optional local-first actual-owner lookup, used only for couple labels. */
  couplePeople285?:PersonalMoodPeople;
  /** SIM may omit these new names; identity grouping and values are unchanged. */
  resolveCoupleNames285?:boolean;
  items:readonly MaterialPile[];expectation?:ColonyExpectation;difficultyMood:number;
  /** Schema of the rules (313: Core despawned thoughts, wound infection sickness, beauty bounds). */
  schemaVersion?:number;
  /** Off the map (a caravan): Core gives no thought whose def is not validWhileDespawned. */
  despawned313?:boolean;
  /** Absent off-map: never reuse the former map room, comfort or beauty. */
  environment?:{comfort:number;beauty:number};housing?:MoodThought;
  /** Actual owner's current air, including caravans; independent from furniture.
   * Only a supported prospective owner supplies this optional situation. */
  ambientTemperature460?:number;
  deathSituation?:MoodThought;lost?:readonly MoodThought[];
  toxicFallout294?:MoodThought;
  /** Schema 305: an aurora seen from an uncovered position. */
  aurora305?:MoodThought;
}
/** Held position differs deliberately from the spawned-only dose pass. Rescue,
 * captive and casket-service carriers resolve through their existing owner.
 * Off-map or suspended originals never borrow the displayed map's condition. */
function localToxicFalloutThought294(world:World,pawn:Pawn):MoodThought|undefined {
  if(!toxicFalloutActive294(world)||!world.pawns.includes(pawn)||pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)return;
  const holder=carrierOf(world,pawn.id)??pawn;
  if(!world.pawns.includes(holder))return;
  const position=holder.motion&&holder.motion.end>world.tick?holder.motion.from:holder;
  return isRoofed(world,position.z*world.width+position.x)?undefined:toxicFallout294;
}
export function moodThoughts(world:World,pawn:Pawn,topology?:RelationshipTopology,readTemperature?:()=>number,resolveCoupleNames285=true):readonly MoodThought[] {
  if(pawn.state==='dead')return [];
  const relationPeople=pawn.familyBereavement||pawn.romanceMemories?captureRelationshipPeople(world):undefined;
  // This lookup lives only for this read. A present partner needs no owner
  // capture; an away/held/terminal partner is resolved only if a label asks.
  let coupleNamespace285=relationPeople;
  return personalMoodThoughts(pawn,{lost:lostThoughts(world,pawn,()=>captureRelationshipPeople(world)),tick:world.tick,people:{get:id=>world.pawns.find(p=>p.id===id)},
    ...relationPeople?{relationPeople}:{},
    ...pawn.coupleMemories285?{resolveCoupleNames285,couplePeople285:{get:(id:number)=>world.pawns.find(p=>p.id===id)??(coupleNamespace285??=captureRelationshipPeople(world)).get(id)}}:{},
    items:world.piles,expectation:colonyExpectation(world,pawn),difficultyMood:colonistMoodOffset(world,pawn),schemaVersion:Number(world.schemaVersion),
    ...(isSchema282OrLater(world.schemaVersion)&&pawn.cryptosleepHeldAt271===undefined&&pawn.shipCryptosleepHeldAt277===undefined
      ?{ambientTemperature460:readTemperature?readTemperature():temperatureAt(world,pawn)}:{}),
    environment:{comfort:pawn.comfort,beauty:pawn.beauty},housing:relationshipHousingThought(world,pawn,topology),deathSituation:colonistUnburiedThought(world,pawn),toxicFallout294:localToxicFalloutThought294(world,pawn),aurora305:localAuroraThought305(world,pawn)});
}
export function personalMoodThoughts(pawn:Pawn,c:PersonalMoodContext):readonly MoodThought[] {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))c={...c,tick:memoryReadTick271(pawn,c.tick)};
  if(pawn.mental?.crisis?.kind==='confused-wander')return [];
  if(pawn.state==='dead')return [];
  const expectation=c.expectation;
  const thoughts:MoodThought[]=[expectation?expectationThoughts.get(expectation.id)!:camp,...roomMoodThoughtsAt(pawn,c.tick),...hiveDefeatThoughts256(pawn,c.tick),...alcoholThoughts265(pawn)];
  if(pawn.bereavement)thoughts.push(...bereavementThoughtsAt(pawn,c.tick,c.people));
  if(pawn.deathThoughts)thoughts.push(...deathThoughtsAt(pawn,c.tick,c.people));
  if(c.lost)thoughts.push(...c.lost);
  if(c.deathSituation)thoughts.push(c.deathSituation);
  if(c.toxicFallout294)thoughts.push(c.toxicFallout294);
  if(c.aurora305)thoughts.push(c.aurora305);
  if(readingActive295(pawn)&&pawn.skills.intellectual?.passion)thoughts.push(readingPassion295[pawn.skills.intellectual.passion-1]!);
  if(pawn.familyBereavement)thoughts.push(...familyBereavementThoughtsAt(pawn,c.tick,c.relationPeople??c.people));
  if(pawn.romanceMemories)thoughts.push(...romanceMoodThoughtsAt(pawn,c.tick,c.relationPeople??c.people));
  if(pawn.partyMemories292)thoughts.push(...partyMoodThoughts292(pawn,c.tick));
  if(pawn.coupleMemories285)thoughts.push(...coupleMoodThoughts285(pawn,c.tick,c.resolveCoupleNames285===false?unnamedCouplePeople285:c.couplePeople285??c.people));
  const housing=c.housing;if(housing)thoughts.push(housing);
  const difficultyMood=c.difficultyMood;
  if(difficultyMood)thoughts.push(situation('difficulty-mood','Récit d’aventure',difficultyMood,'Bonus d’humeur du niveau d’aventure choisi.'));
  for(const id of pawn.traits??[]){const trait=TRAITS[id];if(trait.mood)thoughts.push({id:`trait-${id}`,label:trait.label,offset:trait.mood,kind:'situation',description:trait.description});}
  const v313=(c.schemaVersion??0)>=313;
  for(const t of [pawn.hunger<=0?starvation[Math.max(0,malnutritionStage(pawn.health?.malnutrition)-1)]:hunger[hungerStage(pawn.hunger)],v313&&c.despawned313?undefined:fatigue[restStage(pawn.rest)],c.environment?comforts[comfortStage(c.environment.comfort)]:undefined,c.environment?beauty[(v313?beautyStage313:beautyStage)(c.environment.beauty)]:undefined,pawn.prisoner?undefined:leisure[joyStage(pawn.recreation.level)],pains[painStage(pawn.health?medicalPain(pawn.health):0)]])if(t)thoughts.push(t);
  if((pawn.health?.toxicBuildup?.severity??0)>=Math.fround(.04)||cryptosleepSick256(pawn.health?.cryptosleepSickness)||(pawn.health?.flu?.severity??0)>0||(pawn.health?.immuneDiseases?.malaria?.severity??0)>0||(pawn.health?.immuneDiseases?.plague?.severity??0)>0||v313&&!!pawn.health?.infections?.cases.length||(pawn.health?.immuneDiseases?.['sleeping-sickness']?.severity??0)>0||!!pawn.health?.parasites306||!!pawn.health?.mechanites307)thoughts.push(sick);
  const ambientTemperature460=pawn.cryptosleepHeldAt271===undefined&&pawn.shipCryptosleepHeldAt277===undefined?c.ambientTemperature460:undefined;
  let condition=1,minComfortable460=16,maxComfortable460=26;
  for(const pile of c.items)if(pile.owner.type==='apparel'&&pile.owner.pawnId===pawn.id){
    condition=Math.min(condition,pile.apparel!.hitPoints/APPAREL[pile.item as keyof typeof APPAREL].hitPoints);
    if(ambientTemperature460!==undefined){const insulation=apparelInsulation(pile);minComfortable460-=insulation.cold;maxComfortable460+=insulation.heat;}
  }
  if(condition<.5)thoughts.push(apparel[condition<.2?1:0]!);
  if(ambientTemperature460!==undefined)thoughts.push(...thermalMoodThoughts460(ambientTemperature460,{min:minComfortable460,max:maxComfortable460}));
  for(const m of pawn.memories)if(memoryExpiry271(m,m.expiresAt)>c.tick)thoughts.push({id:m.kind,label:memoryLabels[m.kind],offset:memoryOffsets[m.kind],kind:'memory',description:'Souvenir du dernier repas concerné ; une nouvelle occurrence renouvelle sa durée sans cumul.',expiresAt:memoryExpiry271(m,m.expiresAt)});
  const denied=pawn.deniedJoining?.filter(t=>t>c.tick)??[];
  if(denied.length)thoughts.push({id:'denied-joining',label:`Accueil refusé ×${denied.length}`,offset:-3*(1-.75**denied.length)/.25,kind:'memory',description:'Une demande d’accueil refusée ; six jours, au plus cinq souvenirs à effet décroissant.',expiresAt:denied[0]});
  for(const insult of insultMoodMemories(pawn,c.tick)){
    const speaker=c.people.get(insult.otherId);
    thoughts.push({id:`insult-${insult.otherId}`,label:`Insulté par ${speaker?.name??'un colon'}${insult.count>1?` ×${insult.count}`:''}`,offset:insult.offset,kind:'memory',description:'Paroles blessantes reçues ; effet cumulatif dégressif pendant deux jours.',expiresAt:insult.expiresAt});
  }
  for(const words of kindWordsMoodMemories(pawn,c.tick)){
    const speaker=c.people.get(words.otherId);
    thoughts.push({id:`kind-words-${words.otherId}`,label:`Mots gentils de ${speaker?.name??'un colon'}${words.count>1?` ×${words.count}`:''}`,offset:words.offset,kind:'memory',description:'Paroles bienveillantes reçues ; effet cumulatif dégressif pendant deux jours.',expiresAt:words.expiresAt});
  }
  const catharsis=pawn.mental?.catharsis.filter(t=>t>c.tick)??[];
  if(catharsis.length)thoughts.push({id:'catharsis',label:`Catharsis ×${catharsis.length}`,offset:40*(1-.75**catharsis.length)/.25,kind:'memory',description:'Soulagement après crise ; chaque occurrence dure trois jours, au plus cinq, effet décroissant.',expiresAt:catharsis[0]});
  return thoughts;
}
export function moodTarget(thoughts:readonly MoodThought[]):number {
  return Math.max(0,Math.min(100,MOOD_BASE+thoughts.reduce((sum,t)=>sum+t.offset,0)));
}
/** Downed does not mean unconscious. Awake medical rest and a conscious person
 * without usable legs still experience mood; sleep and lost awareness freeze it. */
export function moodFrozen(pawn:Pawn,body?:BodyAssessment):boolean {
  return (pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined)||pawn.state==='dead'||pawn.state==='sleeping'||!!pawn.medicalSleep||!(body??pawnBody(pawn)).canBeAwake;
}
/** `localTicks`: the local ticks this step covers (15 for a RimWorld need
 * interval of 150 Core ticks); the target is read once, at the step. */
export function updateMood(world:World,pawn:Pawn,body?:BodyAssessment,topology?:RelationshipTopology,readTemperature?:()=>number,localTicks=1):void {
  if(moodFrozen(pawn,body))return;
  updateMoodFromThoughts(pawn,moodThoughts(world,pawn,topology,readTemperature,false),body,localTicks);
}
export function updateMoodFromThoughts(pawn:Pawn,thoughts:readonly MoodThought[],body?:BodyAssessment,localTicks=1):void {
  if(moodFrozen(pawn,body))return;
  const target=moodTarget(thoughts);
  const amount=(target>pawn.mood?MOOD_RISE_PER_HOUR:MOOD_FALL_PER_HOUR)*24/TICKS_PER_DAY*localTicks;
  pawn.mood=target>pawn.mood?Math.min(target,pawn.mood+amount):Math.max(target,pawn.mood-amount);
}
export function expireMealMemories(world:World,pawn:Pawn):void {expireMealMemoriesAt(pawn,world.tick);}
export function expireMealMemoriesAt(pawn:Pawn,tick:number):void {
  if((pawn.cryptosleepHeldAt271!==undefined||pawn.shipCryptosleepHeldAt277!==undefined))return;
  if(pawn.familyBereavement)expireFamilyBereavement(pawn,tick);
  if(pawn.romanceMemories)expireRomanceMemories(pawn,tick);
  if(pawn.partyMemories292)expirePartyMemories292(pawn,tick);
  if(pawn.coupleMemories285)expireCoupleMemories285(pawn,tick);
  if(pawn.bereavement)expireBereavement(pawn,tick);
  if(pawn.deathThoughts)expireDeathThoughts(pawn,tick);
  expireRoomMemoriesAt(pawn,tick);
  if(pawn.deniedJoining?.some(t=>t<=tick)){pawn.deniedJoining=pawn.deniedJoining.filter(t=>t>tick);if(!pawn.deniedJoining.length)delete pawn.deniedJoining;}
  if(pawn.memories.some(m=>memoryExpiry271(m,m.expiresAt)<=tick))pawn.memories=pawn.memories.filter(m=>memoryExpiry271(m,m.expiresAt)>tick);
}
