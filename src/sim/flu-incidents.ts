import {BIOME_DISEASE_FACTS_256,biomeDiseaseChoice256} from './biome-disease-facts-256.ts';
import { isPlayerPatient } from './affiliation.ts';
import { acquireFlu } from './flu-state.ts';
import { acquireImmuneDisease } from './immune-diseases-state.ts';
import { acquireParasite306,isParasites306,PARASITE_LABELS306,type ParasiteKind306 } from './parasites-306.ts';
import { acquireMechanite307,isMechanites307,MECHANITE_LABELS307,type MechaniteKind307 } from './mechanites-307.ts';
import type { ImmuneDiseaseKind } from './immune-diseases-types.ts';
import { createMedicalRecord } from './injury-state.ts';
import { reconcilePawnHealth,updatePawnHealth } from './health.ts';
import { TICKS_PER_DAY,type Pawn,type World } from './types.ts';

/** One Core disease check is 1,000 Core ticks = 100 local ticks. Cassandra's
 * DiseaseHuman component is dormant until day nine. The biome MTB belongs to
 * the whole category, not to Flu alone. Unimplemented diseases consume their
 * selected opportunities instead of making the one implemented disease more
 * frequent. Adventure Story multiplies the biome MTB by 1.5. */
export const FLU_CHECK_INTERVAL=100;
export const FLU_FIRST_CHECK=9*TICKS_PER_DAY;
const DISEASE_INTERVAL_FACTOR=1.5;
const BIOMES={
  'temperate-forest':{mtbDays:50,humanWeight:470},
  'boreal-forest':{mtbDays:60,humanWeight:370},
  'arid-shrubland':{mtbDays:65,humanWeight:390},
  tundra:{mtbDays:80,humanWeight:330},
} as const;
const FLU_WEIGHT=100;

export interface FluIncidentCalendar {
  profile:'cassandra-flu-v1';
  /** xorshift32 independent of the world medical/combat random stream. */
  rng:number;
  nextCheck:number;
  checks:number;
  fluDraws:number;
  episodes:number;
  cases:number;
  /** V207 prospective extension; never shares the historical Flu victim RNG. */
  immuneDiseases?:ImmuneDiseaseIncidentCalendar;
}
export interface ImmuneDiseaseIncidentCalendar {
  adoptedAt:number;
  rng:number;
  draws:number;
  episodes:number;
  cases:number;
}

function random(state:{rng:number}):number {
  let n=state.rng;n^=n<<13;n^=n>>>17;n^=n<<5;state.rng=n>>>0;
  return state.rng/0x100000000;
}
function coreRound(value:number):number {
  const whole=Math.floor(value);
  return value-whole===.5?whole+(whole%2):Math.round(value);
}
function fluCandidates(world:World):Pawn[] {
  // Only spawned human owners participate. Starting pods, cryptosleep holders
  // and travellers keep their originals outside this active pawn collection.
  return world.pawns.filter(p=>p.state!=='dead'&&isPlayerPatient(p)&&!p.visitor&&!p.health?.body);
}
function emit(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}

/** Adopt prospectively. An old save never receives a retrospective roll, and
 * merely adding this state does not consume either RNG stream. */
export function adoptFluIncidents(world:World):void {
  if(!world.gameProfile||world.fluIncidents)return;
  world.fluIncidents={profile:'cassandra-flu-v1',rng:((world.seed^0xf10a1270)>>>0)||1,
    nextCheck:Math.max(FLU_FIRST_CHECK,(Math.floor(world.tick/FLU_CHECK_INTERVAL)+1)*FLU_CHECK_INTERVAL),
    checks:0,fluDraws:0,episodes:0,cases:0};
}

/** Called only by the real advancing clock, never by load/create adoption. */
export function adoptImmuneDiseaseIncidents(world:World):void {
  const state=world.fluIncidents;
  if(world.schemaVersion<207||world.tick<1||!world.gameProfile||!state||state.immuneDiseases)return;
  state.immuneDiseases={adoptedAt:world.tick,rng:((world.seed^0x207d15ea)>>>0)||1,draws:0,episodes:0,cases:0};
}

/** Resolve only a selected Flu incident. Kept separate so focused tests can
 * cover a physical case without simulating the many disease-free days. */
export function resolveFluIncident(world:World,state:FluIncidentCalendar=world.fluIncidents!):number {
  if(!state)return 0;
  const candidates=fluCandidates(world);
  if(!candidates.length)return 0;
  const min=coreRound(candidates.length*.2),max=coreRound(candidates.length*.5);
  const requested=Math.max(1,min+Math.floor(random(state)*(max-min+1)));
  // A partial Fisher-Yates shuffle samples without favoring a pawn's stable
  // world-array position. The entire O(n) operation occurs only on an incident.
  let acquired=0;const names:string[]=[];
  for(let index=0;index<Math.min(requested,candidates.length);index++){
    const swap=index+Math.floor(random(state)*(candidates.length-index));
    [candidates[index],candidates[swap]]=[candidates[swap]!,candidates[index]!];
    const pawn=candidates[index]!;
    const flu=pawn.health?.flu;
    const immunity=flu?.immunity??0;
    const contractChance=flu?.severity?0:Math.max(0,1-immunity/600_000_000);
    if(random(state)>=contractChance)continue;
    if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    if(pawn.state==='dead')continue;
    const record=pawn.health??=createMedicalRecord(world.tick);
    const luck=800_000+Math.floor(random(state)*400_001);
    if(!acquireFlu(record,luck))continue;
    reconcilePawnHealth(world,pawn);
    acquired++;names.push(pawn.name);
  }
  if(acquired){
    state.episodes++;state.cases+=acquired;
    emit(world,`Grippe : ${names.join(', ')} ${acquired===1?'est malade':'sont malades'}. Consultez Santé, organisez les soins et le repos au lit.`);
  }
  return acquired;
}

/** The existing DiseaseHuman opportunity selected one new implemented type.
 * Victim sampling/admission/luck consume only the prospective extension. */
export function resolveImmuneDiseaseIncident(world:World,kind:ImmuneDiseaseKind,
  state:ImmuneDiseaseIncidentCalendar|undefined=world.fluIncidents?.immuneDiseases):number {
  if(world.schemaVersion<207||!state||kind==='sleeping-sickness'&&Number(world.schemaVersion)<309)return 0;
  if(kind==='malaria'){
    const site=world.site;
    // The geographic selector already owns the resolved biome weights. Keep
    // its admission coherent without rewriting legacy calendars or rolls.
    const offered=site?.revision===3
      ?BIOME_DISEASE_FACTS_256[site.biome].diseases.some(d=>d.id==='Disease_Malaria'&&d.weight>0)
      :(site?.biome??'temperate-forest')==='temperate-forest';
    if(!offered)return 0;
  }
  const candidates=fluCandidates(world);if(!candidates.length)return 0;
  const min=coreRound(candidates.length*.2),max=coreRound(candidates.length*.5);
  const requested=Math.min(99_999,Math.max(1,min+Math.floor(random(state)*(max-min+1))));
  let acquired=0;const names:string[]=[];
  for(let index=0;index<Math.min(requested,candidates.length);index++){
    const swap=index+Math.floor(random(state)*(candidates.length-index));
    [candidates[index],candidates[swap]]=[candidates[swap]!,candidates[index]!];
    const pawn=candidates[index]!,disease=pawn.health?.immuneDiseases?.[kind];
    const contractChance=disease?.severity?0:Math.max(0,1-(disease?.immunity??0)/600_000_000);
    if(random(state)>=contractChance)continue;
    if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    if(pawn.state==='dead')continue;
    const record=pawn.health??=createMedicalRecord(world.tick),luck=800_000+Math.floor(random(state)*400_001);
    if(!acquireImmuneDisease(record,kind,luck))continue;
    reconcilePawnHealth(world,pawn);acquired++;names.push(pawn.name);
  }
  if(acquired){
    state.episodes++;state.cases+=acquired;
    emit(world,`${kind==='malaria'?'Paludisme':kind==='plague'?'Peste':'Maladie du sommeil'} : ${names.join(', ')} ${acquired===1?'est malade':'sont malades'}. Consultez Santé, organisez les soins et le repos au lit.`);
  }
  return acquired;
}

/** Schema 306: Core Disease_GutWorms / Disease_MuscleParasites. The victim
 * count comes from all candidates (20 to 50 %, at least one); victims are
 * then drawn among those who can catch it: not already infected and, for gut
 * worms, with a stomach. No immunity, so no contract roll. Uses the prospective
 * disease extension's random stream and counters. */
export function resolveParasiteIncident306(world:World,kind:ParasiteKind306,
  state:ImmuneDiseaseIncidentCalendar|undefined=world.fluIncidents?.immuneDiseases):number {
  if(!state||!isParasites306(Number(world.schemaVersion)))return 0;
  const all=fluCandidates(world);if(!all.length)return 0;
  const candidates=all.filter(p=>!p.health?.parasites306?.[kind]&&(kind!=='gut-worms'||!p.health?.missing.some(m=>m.part==='stomach'||m.part==='torso')));
  if(!candidates.length)return 0;
  const min=coreRound(all.length*.2),max=coreRound(all.length*.5);
  const requested=Math.min(99_999,Math.max(1,min+Math.floor(random(state)*(max-min+1))));
  let acquired=0;const names:string[]=[];
  for(let index=0;index<Math.min(requested,candidates.length);index++){
    const swap=index+Math.floor(random(state)*(candidates.length-index));
    [candidates[index],candidates[swap]]=[candidates[swap]!,candidates[index]!];
    const pawn=candidates[index]!;
    if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    if(pawn.state==='dead')continue;
    const record=pawn.health??=createMedicalRecord(world.tick);
    if(!acquireParasite306(record,kind))continue;
    reconcilePawnHealth(world,pawn);acquired++;names.push(pawn.name);
  }
  if(acquired){
    state.episodes++;state.cases+=acquired;
    emit(world,`${PARASITE_LABELS306[kind]} : ${names.join(', ')} ${acquired===1?'est atteint':'sont atteints'}. Consultez Santé : des soins répétés en viennent à bout.`);
  }
  return acquired;
}

/** Schema 307: Core Disease_FibrousMechanites / Disease_SensoryMechanites,
 * on the whole body. Same victim count and draw as the parasites; one more
 * draw per victim fixes the 15 to 30 day lifetime. Without an immunity record
 * the contract chance is 1. */
export function resolveMechaniteIncident307(world:World,kind:MechaniteKind307,
  state:ImmuneDiseaseIncidentCalendar|undefined=world.fluIncidents?.immuneDiseases):number {
  if(!state||!isMechanites307(Number(world.schemaVersion)))return 0;
  const all=fluCandidates(world);if(!all.length)return 0;
  const candidates=all.filter(p=>!p.health?.mechanites307?.[kind]);if(!candidates.length)return 0;
  const min=coreRound(all.length*.2),max=coreRound(all.length*.5);
  const requested=Math.min(99_999,Math.max(1,min+Math.floor(random(state)*(max-min+1))));
  let acquired=0;const names:string[]=[];
  for(let index=0;index<Math.min(requested,candidates.length);index++){
    const swap=index+Math.floor(random(state)*(candidates.length-index));
    [candidates[index],candidates[swap]]=[candidates[swap]!,candidates[index]!];
    const pawn=candidates[index]!;
    if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
    if(pawn.state==='dead')continue;
    const record=pawn.health??=createMedicalRecord(world.tick);
    if(!acquireMechanite307(record,kind,random(state)))continue;
    reconcilePawnHealth(world,pawn);acquired++;names.push(pawn.name);
  }
  if(acquired){
    state.episodes++;state.cases+=acquired;
    emit(world,`${MECHANITE_LABELS307[kind]} : ${names.join(', ')} ${acquired===1?'est atteint':'sont atteints'}. Elles disparaissent seules en 15 à 30 jours ; des soins freinent leur progression.`);
  }
  return acquired;
}

/** O(1) on 99/100 ticks and O(n) only when a disease opportunity is drawn.
 * Remaining unimplemented disease selections keep their original silent share.
 * The historical exponential category chance is a documented local adaptation. */
export function advanceFluIncidents(world:World):void {
  adoptImmuneDiseaseIncidents(world);
  const state=world.fluIncidents;if(!state||world.tick<state.nextCheck)return;
  state.nextCheck=world.tick+FLU_CHECK_INTERVAL;
  state.checks++;
  const site=world.site;
  const biome=site?.revision===3?BIOME_DISEASE_FACTS_256[site.biome]:BIOMES[site?.biome??'temperate-forest'];
  const mtbTicks=biome.mtbDays*DISEASE_INTERVAL_FACTOR*TICKS_PER_DAY;
  if(random(state)>=-Math.expm1(-FLU_CHECK_INTERVAL/mtbTicks))return;
  if(site?.revision===3){
    const selected=biomeDiseaseChoice256(site.biome,random(state));
    if(selected==='Disease_Flu'){state.fluDraws++;resolveFluIncident(world,state);}
    else if(state.immuneDiseases&&(selected==='Disease_Plague'||selected==='Disease_Malaria')){state.immuneDiseases.draws++;resolveImmuneDiseaseIncident(world,selected==='Disease_Plague'?'plague':'malaria',state.immuneDiseases);}
    else if(state.immuneDiseases&&Number(world.schemaVersion)>=309&&selected==='Disease_SleepingSickness'){state.immuneDiseases.draws++;resolveImmuneDiseaseIncident(world,'sleeping-sickness',state.immuneDiseases);}
    else if(state.immuneDiseases&&isParasites306(Number(world.schemaVersion))&&(selected==='Disease_GutWorms'||selected==='Disease_MuscleParasites')){state.immuneDiseases.draws++;resolveParasiteIncident306(world,selected==='Disease_GutWorms'?'gut-worms':'muscle-parasites',state.immuneDiseases);}
    else if(state.immuneDiseases&&isMechanites307(Number(world.schemaVersion))&&(selected==='Disease_FibrousMechanites'||selected==='Disease_SensoryMechanites')){state.immuneDiseases.draws++;resolveMechaniteIncident307(world,selected==='Disease_FibrousMechanites'?'fibrous-mechanites':'sensory-mechanites',state.immuneDiseases);}
    // Other selected diseases consume their opportunity, as in the existing
    // bounded implementation. This does not claim a complete storyteller.
    return;
  }
  // Core chooses a weighted, currently usable disease after the category
  // event. These static human weights preserve category frequency; other
  // diseases have not yet been implemented or dynamically filtered here.
  const ticket=random(state)*biome.humanWeight,plagueCeiling=FLU_WEIGHT+((world.site?.biome==='tundra')?80:100);
  if(ticket>=FLU_WEIGHT){
    const extension=state.immuneDiseases;
    if(world.schemaVersion>=207&&extension&&(ticket<plagueCeiling||ticket<300&&(world.site?.biome??'temperate-forest')==='temperate-forest')){
      extension.draws++;
      resolveImmuneDiseaseIncident(world,ticket<plagueCeiling?'plague':'malaria',extension);
    }
    return;
  }
  state.fluDraws++;
  resolveFluIncident(world,state);
}
