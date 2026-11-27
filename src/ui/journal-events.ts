import type {Pawn,World,WorldEvent} from '../sim/types';
import {SOCIAL_LABELS} from '../sim/social-state';
import {MENTAL_CRISIS_CATALOG} from '../sim/mental-catalog';

export type PersonalJournalKind='social'|'combat'|'mental';
export const JOURNAL_PICTOGRAMS=['chat','kind','insult','romance','breakup','shot','combat','mental','health','work','command'] as const;
export type JournalPictogram=typeof JOURNAL_PICTOGRAMS[number];
const fold=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-FR').replace(/[’']/g,"'");
const socialLabels=Object.values(SOCIAL_LABELS).map(fold);
const mentalLabels=Object.values(MENTAL_CRISIS_CATALOG).map(crisis=>fold(crisis.label));

/** Only confirmed, actually recorded lines; no dialogue reconstructed from
 * opinions, thoughts or a pawn's current activity. Shared by both journals. */
export function personalJournalKind(event:WorldEvent):PersonalJournalKind|undefined {
  const text=fold(event.message);
  if(event.type==='need'&&mentalLabels.some(word=>text.includes(word)))return 'mental';
  if(socialLabels.some(label=>text.startsWith(`${label} entre `))||['a vexe','a insulte','bagarre'].some(word=>text.includes(word))||event.type==='need'&&['deviennent partenaires',"repousse l'avance de",'se separe de'].some(word=>text.includes(word)))return 'social';
  if(/\b(?:tir(?:e\w*|s)?|touche\w*|blesse\w*|attaqu\w*|frappe\w*|combat\w*)\b/.test(text))return 'combat';
  return undefined;
}
export function journalPictogram(event:WorldEvent):JournalPictogram {
  const text=fold(event.message),kind=personalJournalKind(event);
  if(kind==='mental')return 'mental';
  if(kind==='social')return /se separe|rupture/.test(text)?'breakup':/partenaires|avance|amoureu/.test(text)?'romance':/insulte|vexe|rageante/.test(text)?'insult':/gentil|rapprochement|secouru|recrute/.test(text)?'kind':/bagarre/.test(text)?'combat':'chat';
  if(kind==='combat')return /tir|balle|projectile/.test(text)?'shot':'combat';
  return /soin|soign|maladie|hypotherm|chaleur|intoxication|gueri|sante|mort/.test(text)?'health':event.type==='job'?'work':'command';
}
export function pawnNamePattern(name:string):RegExp {
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,'iu');
}
export function personalJournalEvents(world:Pick<World,'events'>,pawn:Pick<Pawn,'name'>):{index:number;event:WorldEvent;kind:PersonalJournalKind;icon:JournalPictogram}[]{
  const named=pawnNamePattern(pawn.name),result:ReturnType<typeof personalJournalEvents>=[];
  for(let index=world.events.length-1;index>=0;index--){const event=world.events[index]!,kind=personalJournalKind(event);if(kind&&named.test(event.message))result.push({index,event,kind,icon:journalPictogram(event)});}
  return result;
}
export const journalEventKey=(event:WorldEvent):string=>JSON.stringify([event.tick,event.type,event.message]);

/** A bounded suffix/prefix cursor counts occurrences, including identical
 * lines at the same tick. Initial capture/reset is a baseline, never a replay. */
export class ConfirmedJournalCursor {
  private previous:string[]|undefined;
  private immutableSource:readonly WorldEvent[]|undefined;
  private tick=-Infinity;
  read(events:readonly WorldEvent[],tick:number,reset=false,immutableSnapshot=false):readonly WorldEvent[]{
    // Only an admitted immutable projection may reuse a reference. Public or
    // mutable Worlds still compare occurrences, even in the very same array.
    if(immutableSnapshot&&!reset&&tick>=this.tick&&this.immutableSource===events){this.tick=tick;return [];}
    this.immutableSource=immutableSnapshot?events:undefined;
    const next=events.map(journalEventKey),before=this.previous,oldTick=this.tick;this.previous=next;this.tick=tick;
    if(reset||!before||tick<oldTick)return [];
    if(!before.length)return events;
    let overlap=Math.min(before.length,next.length);
    for(;overlap>0;overlap--){let same=true;for(let i=0;i<overlap;i++)if(before[before.length-overlap+i]!==next[i]){same=false;break;}if(same)break;}
    // Full rollover between captures: unseen lines at the same frontier are
    // also new (e.g. several confirmed commands while paused). An identical
    // eighty-line replacement has no occurrence identity in this old format.
    if(overlap)return events.slice(overlap).filter(event=>event.tick>=oldTick);
    const known=new Set(before);return events.filter(event=>event.tick>oldTick||event.tick===oldTick&&!known.has(journalEventKey(event)));
  }
  clear():void{this.previous=undefined;this.immutableSource=undefined;this.tick=-Infinity;}
}
