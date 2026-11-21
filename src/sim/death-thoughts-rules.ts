import { TICKS_PER_DAY } from './types.ts';
import type { DeathThoughtKind } from './death-thoughts-state.ts';

export const DEATH_THOUGHT_RULES:Readonly<Record<DeathThoughtKind,{duration:number;limit:number;offset:number;stackMultiplier:number;label:string;description:string}>>=Object.freeze({
  'witnessed-ally-death':{duration:2*TICKS_PER_DAY,limit:5,offset:-5,stackMultiplier:.75,label:'Mort d’un allié sous mes yeux',description:'Décès d’un membre de la même faction vu à proximité.'},
  'witnessed-outsider-death':{duration:TICKS_PER_DAY,limit:1,offset:-3,stackMultiplier:.75,label:'Mort sous mes yeux',description:'Décès vu d’une personne extérieure non hostile.'},
  'witnessed-family-death':{duration:6*TICKS_PER_DAY,limit:1,offset:-6,stackMultiplier:.75,label:'Mort d’un parent sous mes yeux',description:'Décès vu d’un parent de sang ; s’ajoute au deuil familial.'},
  'witnessed-bloodlust-death':{duration:4*TICKS_PER_DAY,limit:5,offset:8,stackMultiplier:.75,label:'Mort savourée',description:'La soif de sang transforme un décès humain vu en souvenir agréable.'},
  'colonist-died':{duration:6*TICKS_PER_DAY,limit:5,offset:-3,stackMultiplier:.75,label:'Mort d’un colon',description:'Décès appris d’un membre de la colonie, sans avoir assisté à sa mort.'},
  'observed-corpse':{duration:TICKS_PER_DAY/2,limit:3,offset:-4,stackMultiplier:.5,label:'Cadavre aperçu',description:'Cadavre humain frais vu à proximité ; le revoir renouvelle ce souvenir.'},
  'observed-rotting-corpse':{duration:TICKS_PER_DAY/2,limit:5,offset:-6,stackMultiplier:.5,label:'Cadavre décomposé aperçu',description:'Cadavre humain non frais vu à proximité ; le revoir renouvelle ce souvenir.'},
  // Schema 364: KnowGuestExecuted stage 2 (generic brutal) and KilledHumanlikeBloodlust.
  'guest-executed':{duration:6*TICKS_PER_DAY,limit:5,offset:-5,stackMultiplier:.75,label:'Prisonnier exécuté',description:'Un prisonnier a été tué de sang-froid par la colonie. Cela semblait un peu cruel. Six jours.'},
  'killed-humanlike-bloodlust':{duration:4*TICKS_PER_DAY,limit:5,offset:12,stackMultiplier:.75,label:'A tué quelqu’un',description:'La soif de sang fait de cette mise à mort un plaisir. Quatre jours.'},
});
/** Schema 364 kinds, refused in an older save. */
export const DEATH_THOUGHT_KINDS_364:readonly DeathThoughtKind[]=Object.freeze(['guest-executed','killed-humanlike-bloodlust']);
export const deathThoughtDuration=(kind:DeathThoughtKind):number=>DEATH_THOUGHT_RULES[kind].duration;
/** Core samples every 3–5 mood intervals (150 Core ticks each). The local
 * observer uses the mean 600 Core ticks, phased by identity, without new RNG. */
export const DEATH_OBSERVATION_INTERVAL=60;
export const UNBURIED_COLONIST_AFTER=9000;
