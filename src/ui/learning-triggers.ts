import {isColonist} from '../sim/affiliation';
import {isBlockMaterial} from '../sim/building-materials';
import {raidStaging330} from '../sim/raid-state';
import {storageCells} from '../sim/shelf-storage';
import {toxicFalloutActive294,getToxicFallout294} from '../sim/toxic-fallout-state-294';
import {workPriority} from '../sim/work-types';
import type {Command,Pawn,StructureKind,World} from '../sim/types';
import {isPlayerHomeMap} from './alert-priority';
import {LEARNING_FRAMES_PER_SECOND,type KnowledgeAmount,type LearningOpportunity} from './learning-helper';

/** Where the learning helper meets the game: opportunities read from the
 * confirmed snapshots that MAIN already adopts, and demonstrations read from
 * the player's accepted commands and interface gestures. Reading only: no
 * World is changed, no randomness drawn. */

export interface LearningTrigger {concept:string;type:LearningOpportunity}
export interface LearningDemonstration {concept:string;amount:KnowledgeAmount;frames?:number}

/** Core's 19 workbenches with spawnedConceptLearnOpportunity BillsTab, as
 * they exist in Elsewhere. */
export const BILL_STATIONS:ReadonlySet<StructureKind>=new Set<StructureKind>(['crafting-spot','butcher-spot','butcher-table','fueled-stove','electric-stove','fueled-smithy','electric-smithy',
  'tailor-bench','electric-tailor-bench','stonecutter','brewery','drug-lab','electric-smelter','biofuel-refinery','fabrication-bench','electric-crematorium','art-bench','machining-table','campfire']);
const BED_KINDS:ReadonlySet<string>=new Set(['sleeping-spot','bedroll','bed','double-bed','hospital-bed','double-bedroll','double-sleeping-spot']);

/** A compact digest of one confirmed snapshot; a field is absent when every
 * concept it serves is already learned (or the helper is off). */
export interface LearningWorldDigest {
  raids?:Set<string>;assaults?:Set<string>;
  downedColonists?:Set<number>;lostAway?:Set<number>;downedHostiles?:Set<number>;
  ignitions?:number;rotted?:number;
  stations?:Set<number>;consoles?:Set<number>;books?:Set<number>;
  manhunters?:Set<number>;toxic?:number|null;traders?:Set<number>;
  stockpileCells?:number;prisoners?:Set<number>;addicted?:Set<number>;storedDrugs?:Set<number>;
}

const freeColonist=(p:Pawn)=>isColonist(p)&&!p.prisoner&&!p.visitor;
const hostileHuman=(p:Pawn)=>!!p.raid&&!p.prisoner;
const isDrug=(kind:string)=>kind==='beer'||kind==='drug';

/** One pass per family of objects, each only when one of its concepts is
 * still open. Called at most at the helper's check cadence, on a new
 * snapshot. */
export function digestLearningWorld(world:World,open:(concept:string)=>boolean):LearningWorldDigest {
  const digest:LearningWorldDigest={};
  const any=(...ids:string[])=>ids.some(open);
  if(any('equipping-weapons','drafting','reform-caravan')){
    const raids=new Set<string>(),assaults=new Set<string>(),r=world.raids;
    for(const group of [r?.active,...r?.extraActive261??[]]){if(!group)continue;raids.add(`r${group.id}`);if(group.phase==='assault'&&!raidStaging330(group))assaults.add(`r${group.id}`);}
    for(const group of [r?.mechActive,...r?.extraMechActive261??[]]){if(!group)continue;raids.add(`m${group.id}`);if(group.phase==='assault')assaults.add(`m${group.id}`);}
    digest.raids=raids;digest.assaults=assaults;
  }
  const pawnFamily=any('rescuing','reform-caravan','capturing','traders','prisoners','addiction');
  if(pawnFamily){
    const downed=new Set<number>(),lost=new Set<number>(),hostile=new Set<number>(),traders=new Set<number>(),prisoners=new Set<number>(),addicted=new Set<number>();
    for(const p of world.pawns){
      if(freeColonist(p)){if(p.state==='downed')downed.add(p.id);if(p.state==='downed'||p.state==='dead')lost.add(p.id);}
      else if(hostileHuman(p)&&p.state==='downed')hostile.add(p.id);
      if(p.visitor?.role==='trader'&&p.visitor.phase==='staying')traders.add(p.visitor.group);
      if(p.prisoner&&p.prisoner.releasedAt===undefined&&p.state!=='dead')prisoners.add(p.id);
      if(p.health?.alcohol?.addiction&&(isColonist(p)||p.prisoner)&&p.state!=='dead')addicted.add(p.id);
    }
    Object.assign(digest,{downedColonists:downed,lostAway:lost,downedHostiles:hostile,traders,prisoners,addicted});
  }
  if(open('home-area'))digest.ignitions=world.fires?.ledger.ignitions??0;
  if(open('spoilage'))digest.rotted=Object.values(world.spoiled).reduce((sum:number,n)=>sum+(n??0),0);
  if(any('bills','comms','orbital-beacon')){
    const stations=new Set<number>(),consoles=new Set<number>();
    for(const s of world.structures){if(BILL_STATIONS.has(s.kind))stations.add(s.id);else if(s.kind==='comms-console')consoles.add(s.id);}
    digest.stations=stations;digest.consoles=consoles;
  }
  if(any('books','drug-policies')){
    const books=new Set<number>(),drugs:number[]=[];
    for(const pile of world.piles){if(pile.kind==='book')books.add(pile.id);else if(isDrug(pile.kind)&&pile.owner.type==='ground')drugs.push(pile.id);}
    digest.books=books;
    const stored=new Set<number>();
    if(drugs.length){
      const cells=new Set(storageCells(world).map(cell=>cell.z*world.width+cell.x));
      for(const pile of world.piles)if(drugs.includes(pile.id)&&pile.owner.type==='ground'&&cells.has(pile.owner.z*world.width+pile.owner.x))stored.add(pile.id);
    }
    digest.storedDrugs=stored;
  }
  if(any('animals-doors','forbidding-doors','allowed-areas','reform-caravan')){
    const manhunters=new Set<number>();
    for(const animal of world.wildlife?.animals??[])if(animal.manhunter&&!animal.manhunter.exhausted&&animal.state!=='dead')manhunters.add(animal.id);
    digest.manhunters=manhunters;
    digest.toxic=toxicFalloutActive294(world)?getToxicFallout294(world)!.startCore:null;
  }
  if(any('storage-tab','shelves'))digest.stockpileCells=world.stockpiles.length;
  return digest;
}

const added=<T>(before:Set<T>|undefined,after:Set<T>|undefined):T[]=>before&&after?[...after].filter(id=>!before.has(id)):[];

/** Core's TeachOpportunity call sites, read as differences between two
 * confirmed snapshots of the same colony. A field missing from either
 * digest is a fresh baseline and raises nothing. */
export function learningOpportunities(before:LearningWorldDigest|undefined,after:LearningWorldDigest,world?:World):LearningTrigger[] {
  if(!before)return [];
  const out:LearningTrigger[]=[],raise=(concept:string,type:LearningOpportunity)=>out.push({concept,type});
  // IncidentWorker_Raid (EquippingWeapons) and LordToil_AssaultColony.Init (Drafting).
  if(added(before.raids,after.raids).length)raise('equipping-weapons','critical');
  if(added(before.assaults,after.assaults).length)raise('drafting','critical');
  // Pawn_HealthTracker.MakeDowned: own humans Critical, hostile humans Important.
  if(added(before.downedColonists,after.downedColonists).length)raise('rescuing','critical');
  if(added(before.downedHostiles,after.downedHostiles).length)raise('capturing','important');
  // GenHostility.Notify_PawnLostForTutor: lost away from home, no active threat.
  if(world&&added(before.lostAway,after.lostAway).length&&!isPlayerHomeMap(world)&&world.pawns.some(p=>freeColonist(p)&&p.state!=='downed'&&p.state!=='dead')
    &&!(after.assaults?.size||after.raids?.size)&&!after.manhunters?.size)raise('reform-caravan','important');
  // Fire.SpawnSetup (HomeArea Important).
  if(before.ignitions!==undefined&&after.ignitions!==undefined&&after.ignitions>before.ignitions)raise('home-area','important');
  // CompRottable (SpoilageAndFreezers GoodToKnow).
  if(before.rotted!==undefined&&after.rotted!==undefined&&after.rotted>before.rotted)raise('spoilage','good-to-know');
  // spawnedConceptLearnOpportunity and Building_CommsConsole.SpawnSetup.
  if(added(before.stations,after.stations).length)raise('bills','good-to-know');
  if(added(before.consoles,after.consoles).length){raise('comms','good-to-know');raise('orbital-beacon','good-to-know');}
  if(added(before.books,after.books).length)raise('books','good-to-know');
  // MentalState_Manhunter.PostStart; IncidentWorker_AggressiveAnimals for a pack.
  const manhunters=added(before.manhunters,after.manhunters);
  if(manhunters.length)raise('animals-doors','critical');
  if(manhunters.length>=2){raise('forbidding-doors','critical');raise('allowed-areas','important');}
  // GameCondition_ToxicFallout.Init.
  if(before.toxic!==undefined&&after.toxic!==undefined&&after.toxic!==null&&after.toxic!==before.toxic){raise('forbidding-doors','critical');raise('allowed-areas','critical');}
  // TradeUtility: a trader caravan waits at its spot.
  if(added(before.traders,after.traders).length)raise('traders','important');
  // Zone_Stockpile.AddCell (Shelves) and the stockpile designator (StorageTab).
  if(before.stockpileCells!==undefined&&after.stockpileCells!==undefined&&after.stockpileCells>before.stockpileCells){raise('storage-tab','good-to-know');raise('shelves','good-to-know');}
  // RestUtility.TuckIntoBed of a prisoner; addiction checks; a drug stored.
  if(added(before.prisoners,after.prisoners).length)raise('prisoners','good-to-know');
  if(added(before.addicted,after.addicted).length)raise('addiction','important');
  if(added(before.storedDrugs,after.storedDrugs).length)raise('drug-policies','good-to-know');
  return out;
}

interface CommandReply {ok?:unknown;affected?:unknown}
const reply=(raw:unknown):CommandReply|undefined=>{
  if(raw===undefined)return {};
  if(typeof raw!=='string'||raw.length>4096)return undefined;
  try{const value:unknown=JSON.parse(raw);return value&&typeof value==='object'?value as CommandReply:undefined;}catch{return undefined;}
};

export interface CommandLearning {demonstrations:LearningDemonstration[];opportunities:LearningTrigger[];modal?:string}
/** Knowledge shown by an accepted player command (Core designators, float
 * menu options, gizmos and tabs), plus the opportunities Core raises at the
 * same places. `world` is the snapshot the command was given on. */
export function learningFromCommand(command:Command,result:unknown,world?:World):CommandLearning {
  const out:CommandLearning={demonstrations:[],opportunities:[]};
  const answer=reply(result);
  if(!answer||answer.ok===false)return out;
  const show=(concept:string,amount:KnowledgeAmount)=>out.demonstrations.push({concept,amount});
  const affected=typeof answer.affected==='number'?answer.affected:undefined;
  switch(command.type){
    case 'area':{
      if(affected!==undefined&&affected<=0)break;
      if(command.action==='stockpile')show('stockpiles','total');
      else if(command.action==='growing')show('growing','total');
      else if(command.action==='allow'||command.action==='forbid')show('forbidding','specific');
      else if(command.action==='mine')show('mining','specific');
      else if(command.action==='home')show('home-area','total');
      break;
    }
    case 'designate':{
      if(BED_KINDS.has(command.kind))show('beds','total');
      else if(command.kind==='mine')show('mining','specific');
      else if(command.kind==='hydroponics-basin')show('growing','total');
      else if(command.kind==='orbital-beacon')show('orbital-beacon','total');
      // PlaceWorker_DoorLearnOpeningSpeed: open speed below 0.65 (stone .45).
      else if(command.kind==='door'&&isBlockMaterial(command.material))out.opportunities.push({concept:'door-speed',type:'important'});
      break;
    }
    case 'material-forbid':case 'weapon-permission':case 'apparel-permission':show('forbidding','specific');break;
    case 'door-policy':if(command.setting==='forbidden')show('forbidding-doors','specific');break;
    case 'priority':{
      const pawn=world?.pawns.find(p=>p.id===command.pawnId);
      if(!world||pawn&&workPriority(pawn,command.work)!==command.value)show('work-tab','specific');
      break;
    }
    case 'draft':if(command.enabled){show('drafting','specific');out.opportunities.push({concept:'queue-orders',type:'good-to-know'});}break;
    case 'order-equipment':if(command.action==='equip')show('equipping-weapons','total');break;
    case 'order-rescue':show('rescuing','total');break;
    case 'order-capture':show('capturing','total');break;
    case 'allowed-area-create':case 'allowed-area-paint':show('allowed-areas','specific');break;
    case 'hostility-response':show('hostility-response','specific');break;
    case 'schedule-paint':case 'schedule-replace':show('time-assignments','small');break;
    case 'tame':if(command.enabled)show('animal-taming','total');break;
    case 'animal-training':show('animal-training','total');break;
    case 'group-start':show('form-caravan','total');if(world&&!isPlayerHomeMap(world))show('reform-caravan','total');break;
    case 'order-trade':show('traders','total');break;
    case 'apparel-policy-assign':show('outfits','total');break;
    case 'drug-policy-assign':case 'drug-policy-create':case 'drug-policy-update':case 'drug-policy-default':case 'drug-policy-delete':show('drug-policies','total');break;
    case 'surgery-request':show('medical-operations','specific');break;
    case 'research-project':if(command.project!==null)show('research','total');break;
    case 'order-faction-comms':case 'order-orbital-trade':show('comms','total');break;
    case 'power-flick':out.modal='flick-warning';break;
  }
  // Pawn_JobTracker.TryTakeOrderedJob with queueing.
  if('queue' in command&&command.queue===true)show('queue-orders','note-taught');
  return out;
}

/** What the interface shows now, read on the helper's timer. */
export interface LearningObservation {
  /** Native control under the pointer. */
  hoveredId?:string;
  /** Native page shown (inspector, panels). */
  pageId?:string;
  panel?:string|null;
  /** Alt inspector held over the map. */
  tileInspector?:boolean;
  /** Camera moved by the player's keys or middle button. */
  cameraDolly?:boolean;
}
/** Core's per-frame demonstrations over `seconds` of real time, and the
 * one-time ones on a page or panel opening. */
export function learningFromObservation(now:LearningObservation,before:LearningObservation|undefined,seconds:number):CommandLearning {
  const out:CommandLearning={demonstrations:[],opportunities:[]};
  const frames=Math.max(0,seconds)*LEARNING_FRAMES_PER_SECOND;
  const shown=(concept:string)=>out.demonstrations.push({concept,amount:'frame-displayed',frames});
  if(frames>0){
    if(now.hoveredId?.startsWith('hud:alert:'))shown('alerts');
    const page=now.pageId??'';
    if(page.startsWith('inspect-bills-'))shown('bills');
    else if(page.startsWith('inspect-storage-'))shown('storage-tab');
    else if(/^inspect-pawn-\d+-prisoner$/.test(page))shown('prisoners');
    else if(/^inspect-pawn-\d+-health$/.test(page))shown('medical-operations');
    if(now.cameraDolly)out.demonstrations.push({concept:'camera-dolly',amount:'frame-interaction',frames});
    if(now.tileInspector)out.demonstrations.push({concept:'tile-inspector',amount:'tiny',frames});
  }
  if(now.pageId?.startsWith('inspect-item-information-')&&now.pageId!==before?.pageId)out.demonstrations.push({concept:'info-card',amount:'total'});
  if(now.panel==='history'&&before?.panel!=='history')out.demonstrations.push({concept:'history-tab',amount:'total'});
  // MainButtonWorker_ToggleWorld.Activate.
  if(now.panel==='world'&&before&&before.panel!=='world')out.opportunities.push({concept:'form-caravan',type:'important'});
  return out;
}
