import { isColonist } from './affiliation.ts';
import { biomeDiseaseChoice256 } from './biome-disease-facts-256.ts';
import { acquireFlu } from './flu-state.ts';
import { reconcilePawnHealth,updatePawnHealth } from './health.ts';
import { acquireImmuneDisease } from './immune-diseases-state.ts';
import type { ImmuneDiseaseKind } from './immune-diseases-types.ts';
import { createMedicalRecord } from './injury-state.ts';
import { actors352,journalLetter352 } from './letter-producers-352.ts';
import { acquireMechanite307,MECHANITE_LABELS307,type MechaniteKind307 } from './mechanites-307.ts';
import { acquireParasite306,PARASITE_LABELS306,type ParasiteKind306 } from './parasites-306.ts';
import { isPenoxycyline337,penoxycylineImmuneTo337 } from './penoxycyline-337.ts';
import { TRAITS,type TraitId } from './traits.ts';
import type { Pawn,World } from './types.ts';

/** Schema 361: a Sickly person (TraitDegreeData.randomDiseaseMtbDays 30)
 * contracts a disease on its own. Core Pawn_HealthTracker checks every 60 Core
 * ticks (6 local ticks) with Rand.MTBEventOccurs(30 days), then draws one
 * DiseaseHuman incident by the biome's commonality and applies it to this
 * person alone (IncidentWorker_Disease.ApplyToPawns). Diseases this game does
 * not have keep their share and give nothing, as the colony-wide incidents.
 * Every draw is private to (seed, person, tick): no stream moves. */
const CHECK_LOCAL_TICKS=6;
const LEGACY_HUMAN_WEIGHT={'temperate-forest':470,'boreal-forest':370,'arid-shrubland':390,tundra:330} as const;
function sicklyMtbDays(pawn:Pawn):number|undefined {
  for(const id of pawn.traits??[]){const mtb=TRAITS[id as TraitId].randomDiseaseMtbDays;if(mtb)return mtb;}
  return undefined;
}
function stream(seed:number,id:number,tick:number):()=>number {
  let n=(seed^0x51c1e361^Math.imul(id,0x9e3779b1)^Math.imul(tick,0x85ebca6b))>>>0;
  n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);let state=((n^(n>>>16))>>>0)||1;
  return ()=>{state^=state<<13;state>>>=0;state^=state>>>17;state^=state<<5;state>>>=0;return state/0x100000000;};
}
type Choice={kind:'flu'}|{kind:'immune';disease:ImmuneDiseaseKind}|{kind:'parasite';disease:ParasiteKind306}|{kind:'mechanite';disease:MechaniteKind307};
function chooseDisease(world:World,roll:number):Choice|undefined {
  const site=world.site;
  if(site?.revision===3){
    const id=biomeDiseaseChoice256(site.biome,roll);
    return id==='Disease_Flu'?{kind:'flu'}:id==='Disease_Plague'?{kind:'immune',disease:'plague'}:id==='Disease_Malaria'?{kind:'immune',disease:'malaria'}
      :id==='Disease_SleepingSickness'?{kind:'immune',disease:'sleeping-sickness'}:id==='Disease_GutWorms'?{kind:'parasite',disease:'gut-worms'}
      :id==='Disease_MuscleParasites'?{kind:'parasite',disease:'muscle-parasites'}:id==='Disease_FibrousMechanites'?{kind:'mechanite',disease:'fibrous-mechanites'}
      :id==='Disease_SensoryMechanites'?{kind:'mechanite',disease:'sensory-mechanites'}:undefined;
  }
  // The legacy static weights of the colony incidents (flu-incidents.ts).
  const biome=site?.biome??'temperate-forest',ticket=roll*(LEGACY_HUMAN_WEIGHT[biome as keyof typeof LEGACY_HUMAN_WEIGHT]??470);
  if(ticket<100)return {kind:'flu'};
  if(ticket<100+(biome==='tundra'?80:100))return {kind:'immune',disease:'plague'};
  if(ticket<300&&biome==='temperate-forest')return {kind:'immune',disease:'malaria'};
  return undefined;
}
const LABEL:Record<ImmuneDiseaseKind,string>={malaria:'Paludisme',plague:'Peste','sleeping-sickness':'Maladie du sommeil'};
export function advanceSicklyDisease361(world:World,pawn:Pawn):void {
  if((world.tick+pawn.id)%CHECK_LOCAL_TICKS!==0||pawn.state==='dead')return;
  const mtb=sicklyMtbDays(pawn);if(!mtb)return;
  const random=stream(world.seed,pawn.id,world.tick);
  if(random()>=CHECK_LOCAL_TICKS*10/(mtb*60000))return;
  const choice=chooseDisease(world,random());if(!choice)return;
  if(pawn.health&&pawn.health.tick<world.tick)updatePawnHealth(world,pawn);
  if((pawn.state as string)==='dead'||pawn.health?.death||pawn.health?.body)return;
  const record=pawn.health??createMedicalRecord(world.tick);
  let label:string,acquired=false,blocked=false;
  if(choice.kind==='flu'){
    label='Grippe';const flu=record.flu,chance=flu?.severity?0:Math.max(0,1-(flu?.immunity??0)/600_000_000);
    if(random()<chance)acquired=acquireFlu(record,800_000+Math.floor(random()*400_001));
  }else if(choice.kind==='immune'){
    label=LABEL[choice.disease];const disease=record.immuneDiseases?.[choice.disease];
    blocked=isPenoxycyline337(world.schemaVersion)&&penoxycylineImmuneTo337(record,world.tick,choice.disease);
    const chance=disease?.severity||blocked?0:Math.max(0,1-(disease?.immunity??0)/600_000_000);
    if(random()<chance)acquired=acquireImmuneDisease(record,choice.disease,800_000+Math.floor(random()*400_001));
  }else if(choice.kind==='parasite'){
    label=PARASITE_LABELS306[choice.disease];
    if(!record.parasites306?.[choice.disease]&&(choice.disease!=='gut-worms'||!record.missing.some(m=>m.part==='stomach'||m.part==='torso')))acquired=acquireParasite306(record,choice.disease);
  }else{
    label=MECHANITE_LABELS307[choice.disease];
    if(!record.mechanites307?.[choice.disease])acquired=acquireMechanite307(record,choice.disease,random());
  }
  if(!acquired){
    if(blocked&&isColonist(pawn))event(world,`${label} bloqué par la pénoxycyline : ${pawn.name}.`);
    return;
  }
  pawn.health=record;reconcilePawnHealth(world,pawn);
  if(isColonist(pawn)){
    event(world,`${pawn.name}, de santé fragile, a contracté : ${label.toLowerCase()}. Consultez Santé.`);
    journalLetter352(world,'negative',`${label} (maladif)`,actors352([pawn.id]));
  }
}
function event(world:World,message:string):void {
  world.events.push({tick:world.tick,type:'need',message});
  if(world.events.length>80)world.events.splice(0,world.events.length-80);
}
