import {isColonist} from '../sim/affiliation';
import {isBedKind} from '../sim/bed-kinds';
import {bedSlotsCount} from '../sim/bed-slots';
import {treatmentTargets} from '../sim/care-rules';
import {expectationForWealth} from '../sim/expectations';
import {firePosition} from '../sim/fire-rules';
import {ticksUntilRot} from '../sim/food-preservation';
import {comfortableTemperature} from '../sim/heat-rules';
import {groupAmbientTemperature256} from '../sim/group-provision-age';
import {offmapThermalRange259} from '../sim/offmap-thermal-259';
import {worldCaravans} from './alert-caravans';
import {currentMedicalBed} from '../sim/hospital-medical-stats';
import {ITEM_DEFINITIONS,nutritionOf} from '../sim/items';
import {MECHANITE_KINDS307} from '../sim/mechanites-307';
import {inHome} from '../sim/repairs';
import {wantsRescue} from '../sim/rescue';
import {carrierOf} from '../sim/rescue-state';
import {temperatureAt} from '../sim/temperature';
import {workPriority} from '../sim/work-types';
import type {Pawn,Resource,World} from '../sim/types';
import {coreDaysPassed,isPlayerHomeMap} from './alert-priority';
import {knownBuilding256,knownPile256,knownPosition256} from './exploration-readers-256';
import {actorNotificationTarget,cellNotificationTarget,objectNotificationTarget,personNotificationTarget,type NotificationTarget} from './notification-focus';
import {coreSlotGroupCells,type AlertCensus} from './alert-census';
import type {StatusAlert} from './status-alerts';

/** Readers for the Core alerts of the right-hand list. Each one reads the same
 * confirmed snapshot, never mutates it and draws no randomness. Thresholds and
 * windows are Core's (Alert_* classes of RimWorld 1.6); local ticks are ten
 * Core ticks. Callers run them on the alert cadence, not every frame. */

const present=<T>(value:T|undefined):value is T=>value!==undefined;
const byId=(a:{id:number},b:{id:number})=>a.id-b.id;
/** Core FreeColonistsSpawned: colony humans present on this map, neither held,
 * visiting nor dead. Travellers away are not in the map's pawn list. */
export const freeColonist=(p:Pawn):boolean=>isColonist(p)&&!p.prisoner&&!p.visitor&&p.state!=='dead'&&!p.health?.death;
export const freeColonistsSpawned=(world:World):Pawn[]=>world.pawns.filter(freeColonist).sort(byId);
const people=(world:World,pawns:readonly Pawn[])=>pawns.map(p=>personNotificationTarget(world,p.id)).filter(present);
const names=(pawns:readonly Pawn[])=>pawns.map(p=>p.name).join(', ');

/** Alert_FireInHomeArea (Critical): any fire on a home-area cell the player
 * knows. Every such fire is a culprit; attached fires point at their bearer. */
export function readFireInHomeArea(world:World):StatusAlert|undefined {
  if(!world.home?.length)return;
  const targets:NotificationTarget[]=[];
  for(const fire of world.fires?.items??[]){
    const cell=firePosition(world,fire);if(!cell)continue;
    const x=Math.floor(cell.x),z=Math.floor(cell.z);
    if(!knownPosition256(world,{x,z})||!inHome(world,z*world.width+x))continue;
    if(fire.attachedPawnId!==undefined){const target=personNotificationTarget(world,fire.attachedPawnId);if(target)targets.push(target);}
    else if(fire.attachedAnimalId!==undefined)targets.push(actorNotificationTarget(fire.attachedAnimalId));
    else targets.push(cellNotificationTarget(`fire:${fire.id}`,{x,z}));
  }
  if(!targets.length)return;
  const text=`Incendie dans la zone de foyer${targets.length>1?` · ${targets.length} foyers`:''}`;
  return {key:'fire',text,targets,context:{panel:'work'},explanation:
    'Un feu brûle dans la zone de foyer. Les colons dont le travail Incendie est actif vont l’éteindre au contact ; un colon mobilisé peut aussi y être envoyé.'};
}

/** Elsewhere projection of the Core blight letter (NegativeEvent), restored in
 * the native list after the old jump button disappeared with the DOM HUD. */
export function readCropBlight(world:World,knownBlighted?:()=>readonly Resource[]):StatusAlert|undefined {
  const blighted=knownBlighted?.()??world.resources.filter(r=>!!r.blight&&knownPosition256(world,r));
  if(!blighted.length)return;
  const text=`Fléau des cultures · ${blighted.length} plant${blighted.length>1?'s':''}`;
  return {key:'blight',text,targets:blighted.map(r=>objectNotificationTarget('resource',r.id,r)),context:{panel:'architect',category:'orders'},
    explanation:'Le fléau se propage d’une plante cultivée à ses voisines. Coupez les plants atteints avec l’ordre de récolte ou de coupe pour l’arrêter.'};
}

/** Alert_ColonistLeftUnburied (High): an unburied body of a colony human, on a
 * map where a free colonist is present. Carried, buried or lost bodies are not
 * on the ground and do not count. */
export function readUnburiedColonists(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(!free.length)return;
  const bodies=world.pawns.filter(p=>{
    if(!isColonist(p)||p.prisoner||p.visitor||p.state!=='dead'||p.body?.lostAt!==undefined)return false;
    const pileId=p.body?.pileId;if(pileId===undefined)return knownPosition256(world,p);
    const pile=world.piles.find(i=>i.id===pileId);return pile?.owner.type==='ground'&&knownPile256(world,pile);
  }).sort(byId);
  if(!bodies.length)return;
  const text=bodies.length>1?`${bodies.length} colons laissés sans sépulture`:'Colon laissé sans sépulture';
  return {key:'colonist-unburied',text,targets:people(world,bodies),tab:'health',explanation:
    `Le corps reste à découvert et attriste la colonie. Faites-le enterrer dans une tombe ou incinérer. Concerné : ${names(bodies)}.`};
}

/** Alert_NeedWarden (High): prisoners present on the home map and no free,
 * conscious colonist with the Warden work enabled. The first prisoner is the culprit. */
export function readNeedWarden(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(!isPlayerHomeMap(world))return;
  const prisoners=world.pawns.filter(p=>p.prisoner&&p.state!=='dead'&&!p.health?.death).sort(byId);
  if(!prisoners.length||free.some(p=>p.state!=='downed'&&workPriority(p,'warden')>0))return;
  const target=personNotificationTarget(world,prisoners[0]!.id);
  return {key:'need-warden',text:'Geôlier nécessaire',targets:target?[target]:[],context:{panel:'work'},tab:'prisoner',explanation:
    `${prisoners.length} prisonnier${prisoners.length>1?'s':''} et aucun colon disponible n’a le travail Geôlier activé. Activez-le dans Travail pour nourrir, surveiller et recruter les prisonniers.`};
}

/** Alert_ColonistNeedsRescuing (Critical): a free colonist downed outside a bed
 * who wants rescue and is not already being carried. */
export function colonistNeedsRescue(world:World,p:Pawn):boolean {return freeColonist(p)&&wantsRescue(p)&&!carrierOf(world,p.id);}
export function readColonistsNeedRescue(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  const patients=free.filter(p=>colonistNeedsRescue(world,p));
  if(!patients.length)return;
  const text=patients.length>1?`${patients.length} colons à secourir`:'Colon à secourir';
  return {key:'downed',text,targets:people(world,patients),context:{panel:'history'},tab:'health',explanation:
    `À terre hors d’un lit : ${names(patients)}. Un colon libre doit le porter dans un lit ; sélectionnez un colon puis faites un clic droit sur le blessé pour l’ordonner.`};
}

/** Alert_ColonistNeedsTend (High): a free colonist with a tendable injury or
 * illness (mechanites excluded: their HediffDef sets makesAlert false), not
 * already in a medical bed and not waiting for rescue. */
const MECHANITES:ReadonlySet<string>=new Set(MECHANITE_KINDS307);
export function readColonistsNeedTend(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  const patients=free.filter(p=>{
    if(!p.health||colonistNeedsRescue(world,p))return false;
    if(!treatmentTargets(p).some(t=>!('disease' in t)||!MECHANITES.has(String(t.disease))))return false;
    return !currentMedicalBed(world,p)?.medical;
  });
  if(!patients.length)return;
  const text=patients.length>1?`${patients.length} colons à soigner`:'Colon à soigner';
  return {key:'colonist-needs-tend',text,targets:people(world,patients),tab:'health',explanation:
    `Blessure ou maladie à traiter : ${names(patients)}. Un médecin soigne le patient couché dans un lit ; activez Médecin dans Travail et préparez un lit médical.`};
}

/** Alert_Hypothermia (Critical): a free colonist on the map or in a caravan
 * (PawnsFinder.AllMapsCaravansAndTravellingTransporters_AliveSpawned_FreeColonists_NoSuspended)
 * whose Hypothermia hediff is at stage index 3 or more (serious, severity
 * ≥ 0.35) and whose ambient temperature is outside the safe range
 * (GenTemperature.SafeTemperatureRange: comfortable range, worn apparel
 * included, widened by 10 °C on each side). A caravan's air is its tile's. */
export const SERIOUS_HYPOTHERMIA=350_000_000;
export const SAFE_TEMPERATURE_MARGIN=10;
const outsideSafeRange=(air:number,range:{min:number;max:number})=>air<range.min-SAFE_TEMPERATURE_MARGIN||air>range.max+SAFE_TEMPERATURE_MARGIN;
export function readSeriousHypothermia(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  const cold=free.filter(p=>(p.health?.hypothermia??0)>=SERIOUS_HYPOTHERMIA&&outsideSafeRange(temperatureAt(world,p),comfortableTemperature(world,p)));
  for(const {group} of worldCaravans(world)){
    const members=group.members.filter(p=>freeColonist(p)&&(p.health?.hypothermia??0)>=SERIOUS_HYPOTHERMIA);
    if(!members.length)continue;
    let air:number;
    try{air=groupAmbientTemperature256(world,group);}catch{continue;}
    for(const p of members){const range=offmapThermalRange259(p,group.items);if(typeof range!=='string'&&outsideSafeRange(air,range))cold.push(p);}
  }
  if(!cold.length)return;
  const text=`${cold.length} colon${cold.length>1?'s':''} en hypothermie grave`;
  return {key:'hypothermia',text,targets:people(world,cold),context:{panel:'history'},tab:'health',explanation:
    `Hypothermie grave dans un air trop froid : ${names(cold)}. Mettez-le à l’abri dans une pièce chauffée, avec des vêtements chauds.`};
}

/** Alert_ColonistsIdle (Medium), from the first whole day on the home map. */
export function readIdleColonists(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(coreDaysPassed(world)<1||!isPlayerHomeMap(world))return;
  const idle=free.filter(p=>p.state==='idle'&&!p.draft&&!p.flee&&!p.mental?.crisis&&!p.interruptedCargo);
  if(!idle.length)return;
  const text=idle.length>1?`${idle.length} colons sans occupation`:'Colon sans occupation';
  return {key:'idle',text,targets:people(world,idle),context:{panel:'history'},explanation:
    `${names(idle)} n’a rien à faire. Donnez des ordres, activez d’autres travaux ou construisez de quoi s’occuper.`};
}

/** Core AvailableColonistBeds without babies: couples of love partners share a
 * double bed, everyone else takes a double before a single. */
export function missingColonistBeds(world:World,free:readonly Pawn[]):number {
  let single=0,double=0;
  for(const s of world.structures)if(isBedKind(s.kind)&&!s.medical&&!s.prisoner&&knownBuilding256(world,s)){if(bedSlotsCount(s)===1)single++;else double++;}
  const ids=new Set(free.map(p=>p.id)),partners=new Map<number,number[]>();
  for(const link of world.relationships?.links??[]){
    if(link.kind!=='lover'&&link.kind!=='spouse')continue;
    for(const [a,b] of [[link.aId,link.bId],[link.bId,link.aId]] as const){const list=partners.get(a)??[];list.push(b);partners.set(a,list);}
  }
  const living=new Set(world.pawns.filter(p=>p.state!=='dead'&&!p.health?.death).map(p=>p.id));
  const assigned=new Set<number>();let singles=0,couples=0;
  for(const p of free){
    if(assigned.has(p.id))continue;
    const loves=(partners.get(p.id)??[]).filter(id=>living.has(id));
    if(!loves.length){singles++;assigned.add(p.id);continue;}
    let best:number|undefined,bestCount=Infinity;
    for(const other of loves){
      if(!ids.has(other)||assigned.has(other))continue;
      const count=(partners.get(other)??[]).filter(id=>living.has(id)).length;
      if(best===undefined||count<bestCount){best=other;bestCount=count;}
    }
    if(best!==undefined){assigned.add(best);assigned.add(p.id);couples++;}
  }
  for(const p of free)if(!assigned.has(p.id))singles++;
  for(let i=0;i<couples;i++){if(double>0)double--;else single-=2;}
  for(let i=0;i<singles;i++){if(double>0)double--;else single--;}
  return Math.max(0,-single);
}
/** Alert_NeedColonistBeds (High), only during the first 30 days on the home map. */
export function readNeedColonistBeds(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(coreDaysPassed(world)>30||!isPlayerHomeMap(world))return;
  const missing=missingColonistBeds(world,free);if(!missing)return;
  const text=`${missing} couchage${missing>1?'s':''} manquant${missing>1?'s':''}`;
  return {key:'beds',text,targets:[],context:{panel:'architect',category:'furniture'},explanation:
    'Chaque colon a besoin d’un lit ou d’un couchage non médical ; un couple partage un lit double. Construisez-en dans Architecte > Mobilier.'};
}

/** Alert_LowFood (High) after 150 000 Core ticks: fresh human-edible nutrition
 * kept in storage below 4 per free colonist on the home map
 * (NutritionThresholdPerColonist 4). */
export const LOW_FOOD_START_TICK=15_000;
export const LOW_FOOD_NUTRITION_PER_COLONIST=4;
/** Core ResourceCounter.TotalHumanEdibleNutrition counts a ThingDef when it
 * gives nutrition and its foodType meets FoodTypeFlags.OmnivoreHuman. The raw
 * plants of RoughPlantBase (foodType Plant: hay and hops) are not human
 * edible; beer is (DrugBase, nutrition 0.08, foodType Fluid, Processed,
 * Liquor). Kibble, eggs, milk, insect jelly and meals are. */
const CORE_PLANT_FOOD:ReadonlySet<string>=new Set(['hay','hops']);
export const coreHumanEdibleItem=(item:string,kind:string):boolean=>kind==='food'&&!CORE_PLANT_FOOD.has(item)||item==='beer';
export function storedHumanNutrition(world:World,census?:AlertCensus):number {
  // One pass over the storage cells, then one over the piles (no lookup per pile).
  let total=0,stored:ReadonlySet<number>|undefined;
  for(const pile of world.piles){
    if(pile.owner.type!=='ground'||!coreHumanEdibleItem(pile.item,pile.kind)||pile.quantity<=0||!ITEM_DEFINITIONS[pile.item].nutrition)continue;
    stored??=census?census.storedCells():coreSlotGroupCells(world);
    if(!stored.has(pile.owner.z*world.width+pile.owner.x)||!knownPile256(world,pile)||ticksUntilRot(pile,world.tick)<=0)continue;
    total+=nutritionOf(pile)/100;
  }
  return total;
}
export function readLowFood(world:World,free:readonly Pawn[],census?:AlertCensus):StatusAlert|undefined {
  if(world.tick<LOW_FOOD_START_TICK||!isPlayerHomeMap(world)||!free.length)return;
  const stored=storedHumanNutrition(world,census);if(stored>=LOW_FOOD_NUTRITION_PER_COLONIST*free.length)return;
  // Core GetExplanation: free colonists plus the colony's prisoners, the
  // nutrition shown with no decimal (F0) and the days rounded down.
  const eaters=free.length+world.pawns.filter(p=>p.prisoner&&p.state!=='dead'&&!p.health?.death).length,days=Math.floor(stored/Math.max(1,eaters));
  return {key:'food-reserves',text:'Réserves de nourriture faibles',targets:[],context:{panel:'assign'},explanation:
    `Nourriture fraîche rangée : ${Math.round(stored).toLocaleString('fr-FR')} de nutrition pour ${eaters} personne${eaters>1?'s':''}, soit environ ${days} jour${days>1?'s':''}. Cultivez, chassez ou cueillez, puis rangez la nourriture dans une réserve ou une trémie.`};
}

/** Alert_NeedMealSource (Medium) from the second day: no campfire, stove or
 * nutrient paste dispenser built on the home map. */
export const MEAL_SOURCE_KINDS:ReadonlySet<string>=new Set(['campfire','fueled-stove','electric-stove','nutrient-paste-dispenser']);
export function readNeedMealSource(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  if(coreDaysPassed(world)<2||!isPlayerHomeMap(world)||!free.length)return;
  if(world.structures.some(s=>MEAL_SOURCE_KINDS.has(s.kind)))return;
  return {key:'need-meal-source',text:'Aucune source de repas',targets:[],context:{panel:'architect',category:'production'},explanation:
    'Construisez un feu de camp ou une cuisinière pour préparer des repas ; la nourriture crue rend les colons malheureux et peut les rendre malades.'};
}

/** Alert_NeedDefenses (High) during days 2 to 5: no turret, trap or sandbags. */
export const DEFENSE_KINDS:ReadonlySet<string>=new Set(['mini-turret','spike-trap','ied-high-explosive','ied-incendiary','sandbags']);
export function readNeedDefenses(world:World,free:readonly Pawn[]):StatusAlert|undefined {
  const days=coreDaysPassed(world);
  if(days<2||days>5||!isPlayerHomeMap(world))return;
  if(!free.length&&!world.structures.length)return;
  if(world.structures.some(s=>DEFENSE_KINDS.has(s.kind)))return;
  return {key:'need-defenses',text:'Défenses nécessaires',targets:[],context:{panel:'architect',category:'structure'},explanation:
    'Des pillards peuvent bientôt attaquer. Préparez des sacs de sable, des pièges ou une tourelle, et armez les colons.'};
}

/** Alert_NeedJoySources (Medium): recreation kinds available on the home map
 * fewer than the current expectations require. Core counts kinds needing no
 * thing (contemplation, social) plus buildings and unfogged recreational items;
 * only the kinds Elsewhere actually offers are counted. */
export const JOY_KIND_LABELS=[['solitary','contemplation (ciel, œuvres d’art)'],['social','sociale'],['dexterity','adresse (fers à cheval, billard)'],['cerebral','réflexion (échecs, poker)'],['television','télévision'],['chemical','chimique (bière)'],['reading','lecture']] as const;
export function joyKindsOnMap(world:World):Set<string> {
  const kinds=new Set<string>(['solitary','social']);
  for(const s of world.structures){
    if(s.kind==='horseshoes'||s.kind==='hoopstone-ring'||s.kind==='billiards-table')kinds.add('dexterity');else if(s.kind==='chess-table'||s.kind==='poker-table'||s.kind==='game-of-ur-board')kinds.add('cerebral');else if(s.kind==='tube-television')kinds.add('television');
  }
  for(const pile of world.piles){
    if(pile.owner.type!=='ground'||pile.quantity<=0||(pile.kind!=='beer'&&pile.kind!=='book')||!knownPile256(world,pile))continue;
    kinds.add(pile.kind==='beer'?'chemical':'reading');
  }
  return kinds;
}
export function readNeedJoySources(world:World,free:readonly Pawn[],joyKinds:()=>ReadonlySet<string>=()=>joyKindsOnMap(world)):StatusAlert|undefined {
  if(!world.economy||!free.length||!isPlayerHomeMap(world))return;
  const expectation=expectationForWealth(world.economy.wealth.knownTotal),available=joyKinds();
  if(available.size>=expectation.joyKindsNeeded)return;
  const have=JOY_KIND_LABELS.filter(([kind])=>available.has(kind)).map(([,label])=>label),missing=JOY_KIND_LABELS.filter(([kind])=>!available.has(kind)).map(([,label])=>label);
  return {key:'need-joy-sources',text:'Sources de loisirs insuffisantes',targets:[],context:{panel:'architect',category:'recreation'},explanation:
    `${available.size} type${available.size>1?'s':''} de loisir disponible${available.size>1?'s':''} ; ${expectation.label.toLowerCase()} en demandent ${expectation.joyKindsNeeded}. Disponibles : ${have.join(', ')}. Manquants : ${missing.join(', ')}.`};
}
