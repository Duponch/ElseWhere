import {isColonist} from '../sim/affiliation';
import {animalConditionStage256} from '../sim/animal-age-condition-data-256';
import {FLU_UNIT} from '../sim/flu-rules';
import {HEAT_UNIT} from '../sim/heat-severity';
import {IMMUNE_DISEASE_DEFINITIONS,IMMUNE_DISEASE_UNIT} from '../sim/immune-diseases-rules';
import {IMMUNE_DISEASE_KINDS} from '../sim/immune-diseases-types';
import {INFECTION_UNIT} from '../sim/infection-rules';
import {BLOOD_UNIT} from '../sim/injury-rules';
import {MALNUTRITION_UNIT} from '../sim/malnutrition';
import {batteriesUnlocked} from '../sim/research';
import {assignmentAt} from '../sim/schedule';
import type {MedicalRecord} from '../sim/injury-types';
import {TICKS_PER_DAY,type Pawn,type World} from '../sim/types';
import {geographicSeasonTemperature256,seasonTemperature,siteClimateDefinition,climateTick} from '../sim/site-climate';
import {outdoorTemperature} from '../sim/temperature';
import {isPlayerHomeMap} from './alert-priority';
import type {AlertCensus} from './alert-census';
import {JOY_KIND_LABELS} from './core-colony-alerts';
import {personNotificationTarget,type NotificationTarget} from './notification-focus';
import type {StatusAlert} from './status-alerts';

/** Readers for the needs, health and clothing alerts of RimWorld 1.6 (alerts
 * lot B). Each reads the confirmed snapshot without changing it or drawing
 * randomness; thresholds and windows are Core's (Alert_* classes), one local
 * tick being ten Core ticks. They run on the alert cadence, never per frame. */

const present=<T>(value:T|undefined):value is T=>value!==undefined;
const people=(world:World,pawns:readonly Pawn[]):NotificationTarget[]=>pawns.map(p=>personNotificationTarget(world,p.id)).filter(present);
const plural=(n:number,one:string,many:string)=>n>1?`${n} ${many}`:one;

/** Alert_Exhaustion (High): a free colonist whose rest is in the Exhausted
 * category of Need_Rest (below 1 %). */
export function readExhaustion(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  const exhausted=free.filter(p=>p.rest<1);
  if(!exhausted.length)return;
  return {key:'exhaustion',text:plural(exhausted.length,'Colon épuisé','colons épuisés'),targets:people(world,exhausted),context:{panel:'schedule'},tab:'needs',
    explanation:'Le repos est tombé sous 1 % : l’épuisement pèse lourdement sur l’humeur. Laissez dormir ces colons dans un lit et gardez assez d’heures de sommeil dans l’emploi du temps.'};
}

/** Alert_LowMedicine (High), after 150 000 Core ticks (2.5 days): medicine
 * kept in storage on the home map below 2 per free colonist present. */
export const LOW_MEDICINE_START_TICK=15_000;
export const MEDICINE_PER_COLONIST=2;
export function readLowMedicine(world:World,free:readonly Pawn[],census:AlertCensus):StatusAlert|undefined {
  if(world.tick<LOW_MEDICINE_START_TICK||!isPlayerHomeMap(world)||!free.length)return;
  const count=census.storedMedicine(),needed=MEDICINE_PER_COLONIST*free.length;
  if(count>=needed)return;
  return {key:'low-medicine',text:count?'Réserve de médicaments faible':'Aucun médicament en réserve',targets:[],explanation:count
    ?`${count} médicament${count>1?'s':''} rangé${count>1?'s':''} pour ${free.length} colon${free.length>1?'s':''} ; il en faudrait au moins ${needed}. Produisez ou achetez des médicaments et rangez-les dans une réserve.`
    :'Aucun médicament n’est rangé dans une réserve. Sans médicament, les soins sont moins efficaces et certaines maladies deviennent mortelles. Produisez ou achetez des médicaments et rangez-les.'};
}

/** Alert_TatteredApparel (Medium, an Alert_Thought): free colonists with the
 * damaged-apparel mood thought, i.e. a worn piece under 50 % of its hit
 * points. A confused wanderer has no mood thoughts and is not counted. */
export function readTatteredApparel(world:World,free:readonly Pawn[],census:AlertCensus):StatusAlert|undefined {
  const worn=census.wornApparel();
  const ragged=free.filter(p=>p.mental?.crisis?.kind!=='confused-wander'&&(worn.get(p.id)?.condition??1)<.5);
  if(!ragged.length)return;
  return {key:'tattered-apparel',text:ragged.length>1?`Vêtements abîmés ×${ragged.length}`:'Vêtements abîmés',targets:people(world,ragged),context:{panel:'assign'},tab:'needs',
    explanation:'Une pièce portée est descendue sous la moitié de ses points de vie et le colon en est mécontent. Fabriquez ou achetez des vêtements neufs ; une politique de tenue plus exigeante sur les points de vie fait changer les pièces usées.'};
}

export const BOREDOM_JOY_THRESHOLD=24;
/** Alert_Boredom (Medium): on the home map, a free colonist whose recreation is
 * below 24 % or who is in a recreation hour of the schedule, and who is bored
 * of every recreation kind available on the map. */
export function readBoredom(world:World,free:readonly Pawn[],joyKinds:()=>ReadonlySet<string>):StatusAlert|undefined {
  if(!isPlayerHomeMap(world)||!free.length)return;
  let kinds:ReadonlySet<string>|undefined;
  const bored=free.filter(p=>{
    if(!(p.recreation.level<BOREDOM_JOY_THRESHOLD||assignmentAt(world,p)==='recreation'))return false;
    kinds??=joyKinds();
    const tired=p.recreation.bored as Readonly<Record<string,boolean|undefined>>;
    for(const kind of kinds)if(!tired[kind])return false;
    return true;
  });
  if(!bored.length)return;
  const available=JOY_KIND_LABELS.filter(([kind])=>kinds!.has(kind)).map(([,label])=>label);
  return {key:'boredom',text:plural(bored.length,'Colon qui s’ennuie','colons qui s’ennuient'),targets:people(world,bored),context:{panel:'architect',category:'recreation'},tab:'needs',
    explanation:`Ces colons sont lassés de tous les loisirs de la carte et ne peuvent plus se distraire. Loisirs disponibles : ${available.join(', ')}. Construisez un nouveau type de loisir pour varier les plaisirs.`};
}

/** Alert_NeedBatteries (Medium): home map with a solar generator or wind
 * turbine, no battery, and no steady geothermal generator (Elsewhere has no
 * watermill). */
export function readNeedBatteries(world:World):StatusAlert|undefined {
  if(!isPlayerHomeMap(world))return;
  let variable=false;
  for(const s of world.structures){
    if(s.kind==='battery'||s.kind==='geothermal-generator')return;
    if(s.kind==='solar-generator'||s.kind==='wind-turbine')variable=true;
  }
  if(!variable)return;
  return {key:'need-batteries',text:'Batteries nécessaires',targets:[],context:{panel:'architect',category:'power'},explanation:
    `Les panneaux solaires et les éoliennes ne produisent pas en continu : la nuit ou sans vent, le réseau manque de courant. Une batterie garde le surplus pour ces moments. ${batteriesUnlocked(world)?'Construisez-en une dans Architecte > Énergie et reliez-la au réseau.':'Recherchez d’abord les batteries.'}`};
}

/** Core stages flagged lifeThreatening (HediffDefs of the base game), on the
 * conditions Elsewhere tracks. Each entry answers the condition's French name
 * and, for infections, whether a limb (not the torso) carries it. */
const BLOOD_LOSS_EXTREME=.6*BLOOD_UNIT;              // BloodLoss 0.60
const MALNUTRITION_EXTREME=.8*MALNUTRITION_UNIT;     // Malnutrition 0.8
const TEMPERATURE_EXTREME=.62*HEAT_UNIT;             // Heatstroke, Hypothermia 0.62
const INFECTION_EXTREME=780_000_000;                 // WoundInfection 0.78
const FLU_EXTREME=833_000_000;                       // Flu 0.833
const IMMUNE_LABELS={malaria:'paludisme',plague:'peste','sleeping-sickness':'maladie du sommeil'} as const;
export function lifeThreateningConditions(health:MedicalRecord):{labels:string[];limb:boolean} {
  const labels:string[]=[];let limb=false;
  if(health.bloodLoss>=BLOOD_LOSS_EXTREME)labels.push('perte de sang');
  if((health.malnutrition??0)>=MALNUTRITION_EXTREME)labels.push('malnutrition');
  if((health.heatstroke??0)>=TEMPERATURE_EXTREME)labels.push('coup de chaleur');
  if((health.hypothermia??0)>=TEMPERATURE_EXTREME)labels.push('hypothermie');
  const infections=health.infections;
  if(infections&&infections.immunity<INFECTION_UNIT){
    const severe=infections.cases.filter(c=>c.severity>=INFECTION_EXTREME);
    if(severe.length){labels.push('infection');limb=severe.some(c=>c.part!=='torso');}
  }
  if(health.flu&&health.flu.severity>=FLU_EXTREME&&health.flu.immunity<FLU_UNIT)labels.push('grippe');
  for(const kind of IMMUNE_DISEASE_KINDS){
    const disease=health.immuneDiseases?.[kind];
    if(disease&&disease.severity>=IMMUNE_DISEASE_DEFINITIONS[kind].lifeThreateningAt&&disease.immunity<IMMUNE_DISEASE_UNIT)labels.push(IMMUNE_LABELS[kind]);
  }
  for(const c of health.animalAgeConditions?.cases??[])if(animalConditionStage256(c.kind,c.severity).lifeThreatening)
    labels.push(c.kind==='HeartAttack'?'crise cardiaque':'artères du cœur obstruées');
  return {labels,limb};
}
/** Alert_LifeThreateningHediff (Critical): free colonists AND prisoners with
 * a condition at a life-threatening stage they are not fully immune to. One
 * alert replaces the former per-disease urgent rows. */
const MAX_LISTED=8;
export function readLifeThreatening(world:World):StatusAlert|undefined {
  const cases:{pawn:Pawn;labels:string[]}[]=[];let limb=false;
  for(const p of world.pawns){
    if(!p.health||p.state==='dead'||p.health.death||p.visitor||!(p.prisoner||isColonist(p)))continue;
    const found=lifeThreateningConditions(p.health);
    if(!found.labels.length)continue;
    cases.push({pawn:p,labels:found.labels});limb||=found.limb;
  }
  if(!cases.length)return;
  cases.sort((a,b)=>a.pawn.id-b.pawn.id);
  const listed=cases.slice(0,MAX_LISTED).map(c=>`${c.pawn.name} (${c.labels.join(', ')})`).join(', '),more=cases.length-MAX_LISTED;
  return {key:'life-threatening',text:plural(cases.length,'Personne en danger de mort','personnes en danger de mort'),targets:people(world,cases.map(c=>c.pawn)),context:{panel:'history'},tab:'health',
    explanation:`${listed}${more>0?` et ${more} autre${more>1?'s':''}`:''}. Sans soins rapides, ces états peuvent tuer : couchez le patient dans un lit médical et faites-le soigner.${limb?' Une infection sur un membre peut aussi être arrêtée par une amputation.':''}`};
}

/** Core GenTemperature.AverageTemperatureAtTileForTwelfth: the seasonal
 * temperature (no daily cycle, no weather) averaged over 120 samples of a
 * five-day twelfth, from half a day after its start. */
export function twelfthAverageTemperature(world:Pick<World,'climate'>,twelfth:number):number {
  const climate=world.climate;if(!climate)return 21;
  const definition=siteClimateDefinition(world);let sum=0;
  for(let i=0;i<120;i++)sum+=climate.revision===4
    ?geographicSeasonTemperature256(definition,300_000*twelfth+30_000+2_500*i)
    :seasonTemperature(definition.latitude,definition.meanTemperature,(twelfth*5+.5+i/24)*TICKS_PER_DAY);
  return sum/120;
}
/** Core Alert_NeedWarmClothes.LowestTemperatureComing: the coldest of the
 * current and next three twelfths' averages and of the outdoor air now. */
export function lowestTemperatureComing(world:World):number {
  const day=((Math.floor(climateTick(world)/TICKS_PER_DAY)%60)+60)%60,current=Math.floor(day/5);
  let lowest=outdoorTemperature(world);
  for(let i=0;i<4;i++)lowest=Math.min(lowest,twelfthAverageTemperature(world,(current+i)%12));
  return lowest;
}
/** Alert_NeedWarmClothes (High): on the home map, when the coldest coming
 * temperature is under 5 °C, the free colonists whose comfortable minimum
 * with what they wear stays above it. Core's count of spare warm sets in
 * storage never subtracts anything in 1.6.4871 (its sum keeps the queues'
 * negative priorities), so stored clothes do not clear the alert there
 * either: the colonists must wear them. */
export const WARM_CLOTHES_TEMPERATURE=5;
export function readNeedWarmClothes(world:World,free:readonly Pawn[],census:AlertCensus):StatusAlert|undefined {
  if(!isPlayerHomeMap(world)||!free.length)return;
  const lowest=lowestTemperatureComing(world);
  if(lowest>=WARM_CLOTHES_TEMPERATURE)return;
  const worn=census.wornApparel();
  const cold=free.filter(p=>(worn.get(p.id)?.comfyMin??16)>lowest);
  if(!cold.length)return;
  const degrees=Math.round(lowest).toLocaleString('fr-FR');
  return {key:'need-warm-clothes',text:'Vêtements chauds nécessaires',targets:people(world,cold),context:{panel:'assign'},tab:'needs',
    explanation:`${cold.length===free.length?'Aucun colon n’est':`${cold.length} colon${cold.length>1?'s ne sont':' n’est'}`} assez couvert pour le froid qui arrive : jusqu’à ${degrees} °C dans les prochains jours. Fabriquez ou achetez des parkas, des tuques ou d’autres vêtements chauds et faites-les porter par la politique de tenue.`};
}
