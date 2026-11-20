import {schemaAtLeast} from './schema-range.ts';
import type {CommandResult, World, WorldEvent} from './types.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import {registeredMapId, registeredMaps} from './world-map-context.ts';

/* Letters of Core RimWorld 1.6 (schema 352).
 *
 * Core facts (LetterDefs, LetterStack, Letter, ChoiceLetter, Archive):
 * - five base classes, each with a colour, a flash colour and interval, a
 *   bounce flag, an arrival sound and an automatic pause mode: ThreatBig
 *   (pauses on MajorThreat), ThreatSmall (AnyThreat), NegativeEvent,
 *   NeutralEvent and PositiveEvent (AnyLetter, the LetterDef default);
 *   Death derives from NegativeEvent and NewQuest from PositiveEvent;
 * - LetterStack.ReceiveLetter plays the arrival sound, pauses when
 *   Prefs.AutomaticPauseMode >= def.pauseMode, stamps arrivalTick, appends
 *   the letter (newest at the bottom) and adds it to the Archive;
 * - RemoveLetter (right click, or Close / Jump to location in the opened
 *   letter) takes it out of the stack; it stays in the Archive;
 * - Archive.MaxNonPinnedArchivables = 200: the oldest entries that are not
 *   pinned and not still in the stack are culled; pinned entries are kept.
 *
 * Elsewhere stores the stack and the archive in the campaign (one authority
 * for every map). Letters are written by the producers when the event
 * happens; nothing scans per tick. A 351 save migrates by number only: the
 * field is absent, which reads as an empty stack and an empty archive. */
export const isSchema352OrLater=schemaAtLeast(352);
/** Core Archive.MaxNonPinnedArchivables. */
export const LETTER_ARCHIVE_LIMIT_352=200;
/** Adaptation: Core never limits the stack (overflow is bundled). Past this
 * many letters the oldest one leaves the stack (it stays in the archive). */
export const LETTER_STACK_LIMIT_352=200;
/** Adaptation: a bound on pinned entries for strict save validation. */
export const LETTER_PIN_LIMIT_352=200;
const TITLE_MAX=120,TEXT_MAX=1200,MESSAGE_MAX=240,TARGET_MAX=12;

export type LetterClass352='threat-big'|'threat-small'|'negative'|'neutral'|'positive'|'death'|'new-quest';
/** Core AutomaticPauseMode (Never < MajorThreat < AnyThreat < AnyLetter). */
export type LetterPauseMode352='never'|'major'|'any-threat'|'any-letter';
export type LetterTarget352={kind:'cell';x:number;z:number}|{kind:'actor';id:number};
export interface Letter352 {
  id:number;
  /** Core Letter.arrivalTick, in campaign ticks. */
  tick:number;
  cls:LetterClass352;
  title:string;
  text:string;
  /** Core lookTargets: cells, people, animals or things to jump to. */
  targets:LetterTarget352[];
  /** Registered map of the targets, when the campaign has one. */
  mapId?:number;
  /** Opened at least once (stops the flash). */
  read?:true;
}
/** A journal line the player pinned: a copy kept by the archive. */
export interface JournalCopy352 {id:number;tick:number;journal:WorldEvent['type'];message:string;mapId?:number}
export type ArchiveEntry352=Letter352|JournalCopy352;
export interface Letters352 {
  revision:1;
  /** Next archive entry id. */
  next:number;
  /** Ids of the letters shown, oldest first (Core LetterStack.letters). */
  stack:number[];
  /** Letters and pinned journal copies, by tick then id (Core Archive). */
  archive:ArchiveEntry352[];
  /** Pinned archive ids (Core Archive.pinnedArchivables). */
  pinned:number[];
}
export const isLetter352=(entry:ArchiveEntry352):entry is Letter352=>'cls'in entry;

export interface LetterClassDef352 {
  /** Core LetterDef defName. */
  def:string;
  label:string;
  /** Core LetterDef.color, flashColor (sRGB) and flashInterval (seconds). */
  color:string;
  flash:string;
  flashInterval:number;
  bounce:boolean;
  /** Core arrival SoundDef. */
  sound:string;
  pause:Exclude<LetterPauseMode352,'never'>;
}
/** Core LetterDefs (Misc/LetterDefs): ThreatBig, ThreatSmall, NegativeEvent,
 * NeutralEvent, PositiveEvent, Death (parent NegativeEvent), NewQuest
 * (parent PositiveEvent). */
export const LETTER_CLASSES_352:Readonly<Record<LetterClass352,LetterClassDef352>>={
  'threat-big':{def:'ThreatBig',label:'Menace majeure',color:'#cc7373',flash:'#ff5555',flashInterval:6,bounce:true,sound:'LetterArrive_BadUrgentBig',pause:'major'},
  'threat-small':{def:'ThreatSmall',label:'Menace',color:'#cc9b7d',flash:'#ff9b5f',flashInterval:16,bounce:true,sound:'LetterArrive_BadUrgent',pause:'any-threat'},
  negative:{def:'NegativeEvent',label:'Mauvaise nouvelle',color:'#ccc487',flash:'#d2c66a',flashInterval:40,bounce:false,sound:'LetterArrive_BadUrgentSmall',pause:'any-letter'},
  neutral:{def:'NeutralEvent',label:'Événement',color:'#afb0b9',flash:'#a0aab4',flashInterval:90,bounce:false,sound:'LetterArrive',pause:'any-letter'},
  positive:{def:'PositiveEvent',label:'Bonne nouvelle',color:'#78b0d8',flash:'#6ab3e7',flashInterval:90,bounce:false,sound:'LetterArrive_Good',pause:'any-letter'},
  death:{def:'Death',label:'Décès',color:'#ccc487',flash:'#d2c66a',flashInterval:40,bounce:false,sound:'LetterArrive_BadUrgentSmall',pause:'any-letter'},
  'new-quest':{def:'NewQuest',label:'Nouvelle quête',color:'#78b0d8',flash:'#6ab3e7',flashInterval:90,bounce:false,sound:'LetterArrive_Good',pause:'any-letter'},
};
/** Core BundleLetter colour. */
export const BUNDLE_LETTER_COLOR_352='#afb0b9';
const PAUSE_RANK:Readonly<Record<LetterPauseMode352,number>>={never:0,major:1,'any-threat':2,'any-letter':3};
/** Core LetterStack.ReceiveLetter: pause when the preference is at least the
 * letter's pause mode. */
export const letterPauses352=(cls:LetterClass352,preference:LetterPauseMode352):boolean=>PAUSE_RANK[preference]>=PAUSE_RANK[LETTER_CLASSES_352[cls].pause];

export interface LetterInput352 {cls:LetterClass352;title:string;text:string;targets?:readonly LetterTarget352[]}
const clip=(text:string,max:number)=>text.length>max?text.slice(0,max-1)+'…':text;
const okTarget=(t:LetterTarget352)=>t.kind==='cell'?Number.isSafeInteger(t.x)&&Number.isSafeInteger(t.z)&&t.x>=0&&t.z>=0:Number.isSafeInteger(t.id)&&t.id>=1;

/** The letters of a campaign, absent before the first one. */
export function campaignLetters352(world:World):Letters352|undefined {
  return isSchema352OrLater(world.schemaVersion)?campaignAuthority(world).letters352:undefined;
}
function ensureLetters(world:World):Letters352 {
  const root=campaignAuthority(world);
  let state=root.letters352;
  if(!state){state={revision:1,next:1,stack:[],archive:[],pinned:[]};root.letters352=state;}
  return state;
}

/** Core LetterStack.ReceiveLetter, without the sound and the pause (the
 * presentation and the runtime read the new letter). Returns its id, or
 * undefined before schema 352 (bit-identical older games). */
export function sendLetter352(world:World,input:LetterInput352):number|undefined {
  if(!isSchema352OrLater(world.schemaVersion))return undefined;
  const state=ensureLetters(world),root=campaignAuthority(world);
  if(!Number.isSafeInteger(state.next+1))return undefined;
  const targets=(input.targets??[]).filter(okTarget).slice(0,TARGET_MAX).map(t=>t.kind==='cell'?{kind:'cell' as const,x:t.x,z:t.z}:{kind:'actor' as const,id:t.id});
  const mapId=targets.length?registeredMapId(world):undefined;
  const letter:Letter352={id:state.next++,tick:root.tick,cls:input.cls,title:clip(input.title,TITLE_MAX),text:clip(input.text,TEXT_MAX),targets,...mapId!==undefined?{mapId}:{}};
  insertArchive(state,letter);
  state.stack.push(letter.id);
  while(state.stack.length>LETTER_STACK_LIMIT_352)state.stack.shift();
  cullArchive(state);
  return letter.id;
}

/** Core Archive.Add: sorted by creation tick (stable). */
function insertArchive(state:Letters352,entry:ArchiveEntry352):void {
  let at=state.archive.length;
  while(at>0&&state.archive[at-1]!.tick>entry.tick)at--;
  state.archive.splice(at,0,entry);
}
/** Core Archive.CheckCullArchivables: the oldest entries that are neither
 * pinned nor still in the stack go first. Elsewhere culls after every change
 * (arrival, dismissal, unpinning), so a save always respects the bound. */
function cullArchive(state:Letters352):void {
  const pinned=new Set(state.pinned),stacked=new Set(state.stack);
  let cullable=0;
  for(const entry of state.archive)if(!pinned.has(entry.id)&&!stacked.has(entry.id))cullable++;
  let excess=cullable-LETTER_ARCHIVE_LIMIT_352;
  if(excess<=0)return;
  state.archive=state.archive.filter(entry=>{
    if(excess>0&&!pinned.has(entry.id)&&!stacked.has(entry.id)){excess--;return false;}
    return true;
  });
}

export type LetterCommand352=
  | {type:'letter-open';id:number}
  | {type:'letter-dismiss';id:number}
  | {type:'archive-pin';id:number;pinned:boolean}
  | {type:'journal-pin';tick:number;journal:WorldEvent['type'];message:string};
const COMMANDS=new Set(['letter-open','letter-dismiss','archive-pin','journal-pin']);
export function isLetterCommand352(command:unknown):command is LetterCommand352 {
  if(!command||typeof command!=='object'||Array.isArray(command))return false;
  const d=Object.getOwnPropertyDescriptor(command,'type');
  return !!d&&'value'in d&&typeof d.value==='string'&&COMMANDS.has(d.value);
}
const refusal=(code:'invalid-command'|'missing-target',reason:string):CommandResult=>({ok:false,code,reason});
function exactKeys(value:object,keys:readonly string[]):boolean {
  const own=Reflect.ownKeys(value);
  return own.length===keys.length&&own.every(k=>typeof k==='string'&&keys.includes(k)&&'value'in Object.getOwnPropertyDescriptor(value,k)!);
}
const id=(v:unknown):v is number=>Number.isSafeInteger(v)&&(v as number)>=1;

/** Every journal of the campaign: the maps' and the caravans' one. */
function journals(world:World):{mapId?:number;events:readonly WorldEvent[]}[] {
  const root=campaignAuthority(world);
  if(root.worldMaps){
    const rows:{mapId?:number;events:readonly WorldEvent[]}[]=registeredMaps(root).map(map=>{const mapId=registeredMapId(map);return {...mapId!==undefined?{mapId}:{},events:map.events};});
    if(root.worldGroups)rows.push({events:root.worldGroups.events});
    return rows;
  }
  const mapId=registeredMapId(root);
  return [{...mapId!==undefined?{mapId}:{},events:root.events},...root.secondarySite?[{events:root.secondarySite.map.events}]:[]];
}

/** Player commands: open (read), dismiss, pin and unpin. They change only the
 * letters; the simulation, its random streams and its clocks are untouched. */
export function applyLetterCommand352(world:World,command:LetterCommand352):CommandResult {
  if(!isSchema352OrLater(world.schemaVersion))return refusal('invalid-command','Commande invalide.');
  const state=campaignLetters352(world);
  if(command.type==='letter-open'||command.type==='letter-dismiss'){
    if(!exactKeys(command,['type','id'])||!id(command.id))return refusal('invalid-command','Commande invalide.');
    const letter=state?.archive.find(entry=>entry.id===command.id);
    if(!state||!letter||!isLetter352(letter))return refusal('missing-target','Cette lettre n’existe plus.');
    if(command.type==='letter-open'){letter.read=true;return {ok:true};}
    const at=state.stack.indexOf(letter.id);
    if(at<0)return refusal('missing-target','Cette lettre n’est plus dans la pile.');
    state.stack.splice(at,1);cullArchive(state);
    return {ok:true};
  }
  if(command.type==='archive-pin'){
    if(!exactKeys(command,['type','id','pinned'])||!id(command.id)||typeof command.pinned!=='boolean')return refusal('invalid-command','Commande invalide.');
    if(!state||!state.archive.some(entry=>entry.id===command.id))return refusal('missing-target','Cette entrée n’est plus archivée.');
    const at=state.pinned.indexOf(command.id);
    if(command.pinned){
      if(at>=0)return {ok:true};
      if(state.pinned.length>=LETTER_PIN_LIMIT_352)return refusal('invalid-command','Trop d’entrées épinglées : désépinglez-en une d’abord.');
      state.pinned.push(command.id);return {ok:true};
    }
    if(at>=0){state.pinned.splice(at,1);cullArchive(state);}
    return {ok:true};
  }
  if(!exactKeys(command,['type','tick','journal','message'])||!Number.isSafeInteger(command.tick)||command.tick<0
    ||!['job','need','command'].includes(command.journal)||typeof command.message!=='string'||command.message.length>MESSAGE_MAX)return refusal('invalid-command','Commande invalide.');
  const source=journals(world).find(row=>row.events.some(e=>e.tick===command.tick&&e.type===command.journal&&e.message===command.message));
  const copy=state?.archive.find((entry):entry is JournalCopy352=>!isLetter352(entry)&&entry.tick===command.tick&&entry.journal===command.journal&&entry.message===command.message);
  if(!source&&!copy)return refusal('missing-target','Cette ligne du journal n’existe plus.');
  const letters=ensureLetters(world);
  if(copy){if(!letters.pinned.includes(copy.id)){if(letters.pinned.length>=LETTER_PIN_LIMIT_352)return refusal('invalid-command','Trop d’entrées épinglées : désépinglez-en une d’abord.');letters.pinned.push(copy.id);}return {ok:true};}
  if(letters.pinned.length>=LETTER_PIN_LIMIT_352||!Number.isSafeInteger(letters.next+1))return refusal('invalid-command','Trop d’entrées épinglées : désépinglez-en une d’abord.');
  const entry:JournalCopy352={id:letters.next++,tick:command.tick,journal:command.journal,message:command.message,...source!.mapId!==undefined?{mapId:source!.mapId}:{}};
  insertArchive(letters,entry);letters.pinned.push(entry.id);
  return {ok:true};
}

const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype
  &&Reflect.ownKeys(v).every(k=>typeof k==='string'&&'value'in Object.getOwnPropertyDescriptor(v,k)!&&Object.getOwnPropertyDescriptor(v,k)!.enumerable===true);
const dense=(v:unknown):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===v.length+1
  &&v.every((_,i)=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return !!d&&'value'in d;});
const keysOk=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const CLASSES=new Set(Object.keys(LETTER_CLASSES_352));
function validTarget(v:unknown):boolean {
  if(!plain(v))return false;
  if(v.kind==='cell')return keysOk(v,['kind','x','z'])&&Number.isSafeInteger(v.x)&&Number.isSafeInteger(v.z)&&(v.x as number)>=0&&(v.z as number)>=0;
  return v.kind==='actor'&&keysOk(v,['kind','id'])&&id(v.id);
}
function validEntry(v:unknown,tick:number,next:number):v is ArchiveEntry352 {
  if(!plain(v)||!id(v.id)||(v.id as number)>=next||!Number.isSafeInteger(v.tick)||(v.tick as number)<0||(v.tick as number)>tick)return false;
  if(v.mapId!==undefined&&(!Number.isSafeInteger(v.mapId)||(v.mapId as number)<0))return false;
  if(Object.hasOwn(v,'cls'))return keysOk(v,['id','tick','cls','title','text','targets'],['mapId','read'])&&CLASSES.has(v.cls as string)
    &&typeof v.title==='string'&&v.title.length>=1&&v.title.length<=TITLE_MAX&&typeof v.text==='string'&&v.text.length<=TEXT_MAX
    &&dense(v.targets)&&v.targets.length<=TARGET_MAX&&v.targets.every(validTarget)&&(v.read===undefined||v.read===true)&&(v.mapId===undefined||v.targets.length>0);
  return keysOk(v,['id','tick','journal','message'],['mapId'])&&['job','need','command'].includes(v.journal as string)&&typeof v.message==='string'&&v.message.length<=MESSAGE_MAX;
}
/** Strict: absent before the first letter, and before schema 352 (a 351 save
 * migrates by number only). A map view forwards the campaign value through
 * an accessor; its root is validated on its own. */
export function validLetters352(input:Record<string,unknown>,version:number):boolean {
  const descriptor=Object.getOwnPropertyDescriptor(input,'letters352');
  const value=descriptor&&'value'in descriptor?descriptor.value:input.letters352;
  if(value===undefined)return !descriptor||!('value'in descriptor);
  if(!isSchema352OrLater(version)||descriptor&&'value'in descriptor&&descriptor.enumerable!==true)return false;
  const tick=Number(input.tick);
  if(!Number.isSafeInteger(tick)||!plain(value)||!keysOk(value,['revision','next','stack','archive','pinned'])||value.revision!==1||!id(value.next)
    ||!dense(value.stack)||!dense(value.archive)||!dense(value.pinned)||value.stack.length>LETTER_STACK_LIMIT_352||value.pinned.length>LETTER_PIN_LIMIT_352)return false;
  const next=value.next as number,ids=new Map<number,ArchiveEntry352>();
  let previous=-1;
  for(const entry of value.archive){
    if(!validEntry(entry,tick,next)||ids.has(entry.id)||entry.tick<previous)return false;
    previous=entry.tick;ids.set(entry.id,entry);
  }
  const stacked=new Set<number>(),pinned=new Set<number>();
  for(const v of value.stack){const entry=ids.get(v as number);if(!entry||!isLetter352(entry)||stacked.has(v as number))return false;stacked.add(v as number);}
  for(const v of value.pinned){if(!ids.has(v as number)||pinned.has(v as number))return false;pinned.add(v as number);}
  let cullable=0;
  for(const entry of value.archive as ArchiveEntry352[])if(!pinned.has(entry.id)&&!stacked.has(entry.id))cullable++;
  return cullable<=LETTER_ARCHIVE_LIMIT_352;
}

/** The stack as drawn: Core LetterStack.LettersOnGUI shows the newest letters
 * at the bottom and folds the oldest ones into one BundleLetter when the
 * column has room for `capacity` rows only. */
export function letterStackRows352(stack:readonly Letter352[],capacity:number):{bundle:Letter352[];shown:Letter352[]} {
  const rows=Math.max(1,Math.floor(capacity));
  if(stack.length<=rows)return {bundle:[],shown:[...stack]};
  const folded=stack.length-rows+1;
  return {bundle:stack.slice(0,folded),shown:stack.slice(folded)};
}
/** Letters of the stack in order, resolved against the archive. */
export function stackLetters352(state:Letters352|undefined):Letter352[] {
  if(!state)return [];
  const byId=new Map(state.archive.map(entry=>[entry.id,entry]));
  const rows:Letter352[]=[];
  for(const value of state.stack){const entry=byId.get(value);if(entry&&isLetter352(entry))rows.push(entry);}
  return rows;
}
