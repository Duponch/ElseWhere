import {memoryExpiry271} from './suspended-memory-271.ts';
import type {MoodThought} from './mood.ts';
import type {RoomMemory} from './room-experience.ts';
import type {Pawn,World} from './types.ts';

/* Schema 343: the first days of a Core Crashlanded game and the everyday
 * thoughts of sleep, weather and darkness. Every rule here is read from the
 * RimWorld 1.6 defs (Thoughts_Memory_Misc, Thoughts_Situation_General,
 * Thoughts_Situation_Social) and their classes (Toils_LayDown.ApplyBedThoughts,
 * Pawn_MindState, PawnRecentMemory, ThoughtWorker_Dark,
 * ThoughtWorker_BondedAnimalMaster). Older schemas never call this module. */
export const FIRST_DAYS_SCHEMA_343=343;
export const isFirstDays343=(version:unknown):boolean=>Number(version)>=FIRST_DAYS_SCHEMA_343;

export type SleepMemoryKind343='slept-in-cold'|'slept-in-heat'|'slept-outside'|'slept-on-ground';
export type FirstDaysMemoryKind343=SleepMemoryKind343|'soaking-wet'|'darkness';
/** Sleep memories last one day (60 000 Core ticks), SoakingWet 0.1 day. The
 * darkness entry is not a Core memory: it records that the pawn's last
 * light sample (PawnRecentMemory, every need interval) found darkness, the
 * state behind TicksSinceLastLight > 240. It lives two intervals at most. */
export const FIRST_DAYS_MEMORIES_343:Readonly<Record<FirstDaysMemoryKind343,Readonly<{label:string;offset:number;duration:number;description:string}>>>=Object.freeze({
 'slept-in-cold':Object.freeze({label:'A dormi dans le froid',offset:-4,duration:6000,description:'La température ambiante était sous 16 °C pendant le sommeil. Le souvenir dure un jour.'}),
 'slept-in-heat':Object.freeze({label:'A dormi dans la chaleur',offset:-4,duration:6000,description:'La température ambiante dépassait 26 °C pendant le sommeil. Le souvenir dure un jour.'}),
 'slept-outside':Object.freeze({label:'A dormi dehors',offset:-4,duration:6000,description:'Sommeil dans un lieu à ciel ouvert. Le souvenir dure un jour.'}),
 'slept-on-ground':Object.freeze({label:'A dormi par terre',offset:-4,duration:6000,description:'Sommeil au sol ou sur un simple emplacement de couchage. Le souvenir dure un jour.'}),
 'soaking-wet':Object.freeze({label:'Trempé',offset:-3,duration:600,description:'Pluie sans toit ou eau sous les pieds. Le souvenir dure 2,4 heures après la dernière exposition.'}),
 darkness:Object.freeze({label:'Dans l’obscurité',offset:-5,duration:30,description:'Éveillé dans un lieu trop sombre depuis quelques secondes. La pensée disparaît à la lumière.'}),
});
const KINDS=Object.keys(FIRST_DAYS_MEMORIES_343) as FirstDaysMemoryKind343[];
export const isFirstDaysMemory343=(kind:unknown):kind is FirstDaysMemoryKind343=>typeof kind==='string'&&(KINDS as string[]).includes(kind);
export const SLEEP_MEMORY_KINDS_343:readonly SleepMemoryKind343[]=Object.freeze(['slept-in-cold','slept-in-heat','slept-outside','slept-on-ground']);
/** Race ComfyTemperatureMin/Max of the Human def: ApplyBedThoughts reads the
 * def's abstract stat, without apparel. */
export const HUMAN_COMFY_MIN_343=16,HUMAN_COMFY_MAX_343=26;

/** Free colonists only, like the bedroom memories (room-experience admitted). */
export const firstDaysAdmitted343=(w:World,p:Pawn):boolean=>isFirstDays343(w.schemaVersion)&&(p.faction??'colony')==='colony'&&!p.visitor&&!p.prisoner&&p.state!=='dead'
 &&p.cryptosleepHeldAt271===undefined&&p.shipCryptosleepHeldAt277===undefined;

/** Replace one memory of this kind, renewing its age (TryGainMemoryFast). */
export function setFirstDaysMemory343(p:Pawn,kind:FirstDaysMemoryKind343,tick:number):void {
 const entry:RoomMemory={kind,stage:0,expiresAt:tick+FIRST_DAYS_MEMORIES_343[kind].duration};
 const list=p.roomMemories,index=list?list.findIndex(m=>m.kind===kind):-1;
 if(!list)p.roomMemories=[entry];
 else if(index<0)p.roomMemories=[...list,entry];
 else{const next=[...list];next[index]=entry;p.roomMemories=next;}
}
export function removeFirstDaysMemory343(p:Pawn,kind:FirstDaysMemoryKind343):void {
 if(!p.roomMemories?.some(m=>m.kind===kind))return;
 const next=p.roomMemories.filter(m=>m.kind!==kind);if(next.length)p.roomMemories=next;else delete p.roomMemories;
}

/** ThoughtWorker_Dark: awake, and the previous light sample was dark. */
export function darknessThought343(p:Pawn,tick:number):MoodThought|undefined {
 if(p.state==='sleeping'||p.medicalSleep||!p.roomMemories?.some(m=>m.kind==='darkness'&&memoryExpiry271(m,m.expiresAt)>tick))return;
 const d=FIRST_DAYS_MEMORIES_343.darkness;
 return {id:'environment-dark',label:d.label,offset:d.offset,kind:'situation',description:d.description};
}

