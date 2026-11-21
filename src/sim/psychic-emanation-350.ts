import {isMoodPool350} from './mood-pool-memories-350.ts';
import {journalLetter352} from './letter-producers-352.ts';
import {pawnGender350} from './mood-pool-350.ts';
import {PSYCHIC_DURATION_DAYS_350,PSYCHIC_GENDER_LABEL_350 as GENDER_LABEL,PSYCHIC_LEVEL_LABEL_350 as LEVEL_LABEL,type PsychicKind350,type PsychicLevel350} from './psychic-state-350.ts';
export {psychicActive350,psychicConditionText350,validPsychic350,type PsychicEmanation350,type PsychicKind350} from './psychic-state-350.ts';
import {cropBlightIncidentPoints} from './crop-blight-incident.ts';
import {isColonist} from './affiliation.ts';
import {homeIncidentsBlocked261} from './temp-map-incidents-261.ts';
import {TICKS_PER_DAY,type World} from './types.ts';
import type {CassandraMiscCalendar} from './cassandra-misc.ts';

/* Schema 350: the psychic drone and psychic soothe that Cassandra's Misc
 * category already drew without effect. Core facts (Incidents_Map_Misc,
 * GameConditions_Misc, IncidentWorker_PsychicEmanation, IncidentWorker_PsychicDrone,
 * IncidentWorker_PsychicSoothe, GameCondition_PsychicEmanation):
 * - neither can fire while a drone or a soothe is active on the map, nor
 *   without a free colonist there, nor within 15 days of its own last start;
 * - duration: drone 0.75~1.75 days, soothe 1.5~3 days (RoundToInt of the
 *   drawn days × 60 000 Core ticks), drawn first;
 * - gender: that of a free colonist drawn on the map, drawn second;
 * - drone level by the incident points (DefaultThreatPointsNow): under 800
 *   low, under 2 000 moderate, else high; a soothe has the GoodMedium level;
 * - the PsychicDrone thought (mood-pool-350) reads the active condition. */
export const PSYCHIC_REFIRE_DAYS_350=15;
/** MapPawns.FreeColonists: free colonists present on the map. */
const freePresentColonist=(w:World,p:import('./types.ts').Pawn):boolean=>w.pawns.includes(p)&&isColonist(p)&&!p.prisoner&&!p.visitor&&!p.podRescue&&!p.raid&&p.state!=='dead';
const emit=(w:World,message:string)=>{w.events.push({tick:w.tick,type:'need',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);};

export function eligiblePsychic350(w:World,kind:PsychicKind350,state:CassandraMiscCalendar=w.miscIncidents!):boolean {
 if(!isMoodPool350(w.schemaVersion)||!state||homeIncidentsBlocked261(w)||state.psychic350)return false;
 const last=kind==='drone'?state.lastPsychicDrone350:state.lastPsychicSoothe350;
 if(last!==undefined&&w.tick-last<PSYCHIC_REFIRE_DAYS_350*TICKS_PER_DAY)return false;
 return w.pawns.some(p=>freePresentColonist(w,p));
}
/** Only a selected Misc ticket reaches this function. */
export function resolveSelectedPsychic350(w:World,kind:PsychicKind350,draw:()=>number,state:CassandraMiscCalendar=w.miscIncidents!):boolean {
 if(!eligiblePsychic350(w,kind,state))return false;
 const f=Math.fround,[min,max]=PSYCHIC_DURATION_DAYS_350[kind];
 const days=f(f(min)+f(f(max-min)*f(draw()))),core=f(days*f(60000)),lower=Math.floor(core);
 const duration=core-lower===.5?lower+lower%2:Math.round(core);
 const colonists=w.pawns.filter(p=>freePresentColonist(w,p));
 const gender=pawnGender350(colonists[Math.min(colonists.length-1,Math.floor(draw()*colonists.length))]!,w);
 let level:PsychicLevel350='soothe';
 if(kind==='drone'){const points=cropBlightIncidentPoints(w);level=points<800?'low':points<2000?'moderate':'high';}
 const startCore=w.tick*10;
 state.psychic350={kind,level,gender,startCore,endCore:startCore+duration};
 if(kind==='drone'){state.lastPsychicDrone350=w.tick;state.psychicDrones350=(state.psychicDrones350??0)+1;}
 else{state.lastPsychicSoothe350=w.tick;state.psychicSoothes350=(state.psychicSoothes350??0)+1;}
 const length=(duration/60000).toFixed(1);
 emit(w,kind==='drone'
  ?`Bourdonnement psychique ${LEVEL_LABEL[level]} : une émission lointaine tourmente les ${GENDER_LABEL[gender]} de la carte pendant ${length} jours. Leur humeur va nettement baisser.`
  :`Apaisement psychique : une émission lointaine calme les ${GENDER_LABEL[gender]} de la carte pendant ${length} jours. Leur humeur va nettement monter.`);
 journalLetter352(w,kind==='drone'?'negative':'positive',kind==='drone'?'Bourdonnement psychique':'Apaisement psychique');
 return true;
}
/** Ends the condition when due; called with the Misc calendar each tick. */
export function advancePsychic350(w:World):void {
 const state=w.miscIncidents,c=state?.psychic350;if(!state||!c||w.tick*10<c.endCore)return;
 delete state.psychic350;
 emit(w,c.kind==='drone'?'Le bourdonnement psychique prend fin.':'L’apaisement psychique prend fin.');
}
