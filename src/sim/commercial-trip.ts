import {offMapIngestionCore299,commitHumanIngestion299} from './human-ingestion-clock299.ts';
import {medicalElapsedTicks271} from './suspended-human-clock-271.ts';
import {rememberMapAreaDeparture,prepareSameMapAreaReturn,commitMapAreaEntry} from './pawn-map-areas.ts';
import {registeredCampaign} from './world-map-context.ts';
import { releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { scoutActiveTask,scoutPreparationReason,scoutUnstable } from './caravan-trip.ts';
import { findCivilianReturnEntry } from './civilian-return.ts';
import { commercialMass } from './commercial-mass.ts';
import { commercialCargoIntact,emptyCommercialTextiles,isCommercialTextile,type CommercialBuyLine } from './commercial-state.ts';
import { ensureCommercialPost } from './commercial-post.ts';
import { COMMERCIAL_DECISION_TICKS,COMMERCIAL_LEG_TICKS,type CommercialTrip } from './commercial-state.ts';
import { foodAllowed } from './food-policy.ts';
import { biologicalYears } from './human-age.ts';
import { advanceHumanAge } from './human-age.ts';
import { adultHungerFactor,ITEM_DEFINITIONS } from './items.ts';
import { refreshStock } from './materials.ts';
import { expireMealMemories } from './mood.ts';
import { HUNGER_PER_TICK } from './needs.ts';
import { updateRest } from './rest.ts';
import { tickSkills } from './skills.ts';
import { expireSocialMemories } from './social-state.ts';
import { negotiatorRefusal } from './trade-contact.ts';
import { visitorAtEdge } from './visitor-navigation.ts';
import type { CommandResult,Pawn,World } from './types.ts';

export type CommercialOffMap=Extract<CommercialTrip,{pawn:Pawn}>;
export function commercialOnMapId(w:World):number|null {
  const s=w.commercialTrip;return s&&'pawnId' in s?s.pawnId:null;
}
export function commercialPawn(w:World):Pawn|null {
  const s=w.commercialTrip;return !s?null:'pawn' in s?s.pawn:w.pawns.find(p=>p.id===s.pawnId)??null;
}
/** Original owners are projected only for shared reference/save checks. */
export function commercialRegistryView(w:World):World {
  const s=w.commercialTrip;return s&&'pawn' in s?{...w,pawns:[...w.pawns,s.pawn],piles:[...w.piles,...s.items]}:w;
}
export { commercialReservedSources } from './commercial-reservations.ts';
export function commercialPreparationReason(w:World,p:Pawn):string|null {
  const reason=scoutPreparationReason(w,p);if(reason)return reason;
  if(p.age&&biologicalYears(p.age)<18)return 'Le voyageur doit être adulte.';
  return negotiatorRefusal(p)??null;
}
export function previewCommercialLoading(w:World,p:Pawn,foodQuantity:number,silver:number,cargo?:CommercialBuyLine[]):ReturnType<typeof commercialMass> {
  if((foodQuantity!==2&&foodQuantity!==3)||!Number.isSafeInteger(silver)||silver<0||silver===0&&!cargo?.length
    ||cargo!==undefined&&(!Array.isArray(cargo)||!cargo.length||cargo.length>31||new Set(cargo.map(l=>l?.pileId)).size!==cargo.length))return null;
  const owner={type:'inventory' as const,pawnId:p.id};
  const existing=w.piles.filter(i=>i.owner.type==='equipment'||i.owner.type==='apparel');
  const freight=[];
  for(const line of cargo??[]){
    if(!line||Object.keys(line).some(k=>!['pileId','quantity'].includes(k))||!Number.isSafeInteger(line.pileId)||!Number.isSafeInteger(line.quantity)||line.quantity<1)return null;
    const source=w.piles.find(i=>i.id===line.pileId);
    if(!source||!isCommercialTextile(source.item)||source.owner.type!=='ground'||line.quantity>source.quantity)return null;
    freight.push({...source,quantity:line.quantity,owner});
  }
  return commercialMass(w,p,[...existing,{id:-1,kind:'food',item:'survival-meal',quantity:foodQuantity,owner},
    ...silver?[{id:-2,kind:'silver' as const,item:'silver' as const,quantity:silver,owner}]:[],...freight]);
}
export function commercialDepartureReason(w:World,p:Pawn):string|null {
  const s=w.commercialTrip;
  if(s?.phase!=='leaving'||s.pawnId!==p.id||!w.pawns.includes(p)||!visitorAtEdge(w,p))return 'Le colon doit atteindre le bord de la carte.';
  const reason=commercialPreparationReason(w,p);if(reason)return reason;
  if(scoutActiveTask(p)||p.state!=='idle'||p.path.length||p.moveCooldown>0||(p.motion?.end??0)>w.tick)return 'Le dernier segment doit être terminé.';
  const owned=w.piles.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id),inventory=owned.filter(i=>i.owner.type==='inventory');
  const food=inventory.find(i=>i.id===s.foodPileId);
  if(!food||food.item!=='survival-meal'||food.quantity!==s.foodQuantity||food.foodPoison
    ||inventory.some(i=>i!==food&&i.item!=='silver'&&!isCommercialTextile(i.item))||inventory.filter(i=>i.item==='silver').reduce((n,i)=>n+i.quantity,0)!==s.silverQuantity
    ||!commercialCargoIntact(inventory,p.id,s.cargo))
    return 'Le manifeste chargé a changé.';
  if(owned.some(i=>i.owner.type==='pawn')||w.packed.some(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id))return 'Une cargaison incompatible empêche le départ.';
  if(w.pawns.some(q=>q!==p&&(q.rescue?.patientId===p.id||q.tend?.patientId===p.id||q.feed?.patientId===p.id||q.ward?.patientId===p.id||q.surgery?.patientId===p.id
    ||q.melee?.order?.targetId===p.id||q.melee?.strike?.targetId===p.id||q.shooting?.order?.targetId===p.id)))return 'Une action active vise encore ce colon.';
  const mass=commercialMass(w,p);if(!mass||mass.grams>mass.capacityGrams)return 'La charge du voyageur est excessive ou inconnue.';
  if(!Number.isSafeInteger(w.tick+2*COMMERCIAL_LEG_TICKS+COMMERCIAL_DECISION_TICKS))return 'L’échéance du voyage dépasse l’horloge.';
  return null;
}
export function departCommercial(w:World,p:Pawn):boolean {
  if(commercialDepartureReason(w,p))return false;
  const s=w.commercialTrip;if(s?.phase!=='leaving')return false;
  const items=w.piles.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id),ids=new Set(items.map(i=>i.id)),entry={x:p.x,z:p.z};
  rememberMapAreaDeparture(w,p);releaseAllowedAreaReturn(p);p.bedId=null;delete p.bedSlot;p.path=[];p.state='idle';p.planCooldown=0;p.moveCooldown=0;
  delete p.motion;delete p.shooting;delete p.stagger;delete p.stun;
  w.commercialTrip={phase:'outbound',pawn:p,items,foodPileId:s.foodPileId,foodQuantity:s.foodQuantity,silverQuantity:s.silverQuantity,
    startedAt:s.startedAt,departedAt:w.tick,arrivesAt:w.tick+COMMERCIAL_LEG_TICKS,entry,consumed:0,silverPaid:0,bought:{medicine:0,component:0},
    ...s.cargo?{cargo:{...s.cargo},sold:emptyCommercialTextiles(),silverEarned:0}:{}};
  w.pawns=w.pawns.filter(q=>q!==p);w.piles=w.piles.filter(i=>!ids.has(i.id));refreshStock(w);
  logCommercial(w,`${p.name} quitte la carte pour le comptoir civil.`);return true;
}
export function logCommercial(w:World,message:string):void {
  w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);
}
export function beginCommercialReturn(w:World):boolean {
  const s=w.commercialTrip;if(s?.phase!=='at-post'||!Number.isSafeInteger(w.tick+COMMERCIAL_LEG_TICKS))return false;
  const {decisionUntil:_deadline,...base}=s;
  w.commercialTrip={...base,phase:'returning',leftPostAt:w.tick,returnAt:w.tick+COMMERCIAL_LEG_TICKS};
  logCommercial(w,`${s.pawn.name} repart du comptoir vers la colonie.`);return true;
}
export function applyCommercialReturn(w:World):CommandResult {
  if(!beginCommercialReturn(w))return {ok:false,code:'invalid-command',reason:'Le voyageur doit être au comptoir et l’échéance doit être admissible.'};
  return {ok:true};
}
function consumeRation(w:World,s:CommercialOffMap):void {
  const p=s.pawn;if(p.hunger>30||!foodAllowed(w,p,'survival-meal'))return;
  const pile=s.items.find(i=>i.id===s.foodPileId&&i.item==='survival-meal'&&i.owner.type==='inventory'&&i.owner.pawnId===p.id);
  if(!pile||pile.quantity<1)return;
  const ingestedAt299=offMapIngestionCore299(w,p);
  p.hunger=Math.min(100,p.hunger+ITEM_DEFINITIONS['survival-meal'].nutrition);pile.quantity--;s.consumed++;commitHumanIngestion299(p,ingestedAt299);
  if(!pile.quantity)s.items.splice(s.items.indexOf(pile),1);
  logCommercial(w,`${p.name} mange une ration de survie pendant l’expédition commerciale.`);
}
/** Legs and the bounded visit advance needs once. Only sealed-entry waiting
 * suspends needs; birthdays, skills and memories still follow the clock. */
export function advanceCommercialTrip(w:World):void {
  const s=w.commercialTrip;if(!s||!('pawn' in s))return;
  if(w.tick>s.departedAt){
    advanceHumanAge(w,s.pawn);tickSkills(w,s.pawn);expireSocialMemories(s.pawn,w.tick);expireMealMemories(w,s.pawn);
    if(s.pawn.health){const h=s.pawn.health;if(h.civilTick271===undefined)h.tick=w.tick;else{h.tick+=medicalElapsedTicks271(h,w.tick);h.civilTick271=w.tick;}}
    if(s.phase!=='awaiting-entry'){
      s.pawn.hunger=Math.max(0,s.pawn.hunger-(w.foodRules==='legacy'?.015:HUNGER_PER_TICK*adultHungerFactor(s.pawn.hunger)));
      updateRest(w,s.pawn);if(s.pawn.needCooldown>0)s.pawn.needCooldown--;consumeRation(w,s);
    }
  }
  if(s.phase==='outbound'){
    if(w.tick<s.arrivesAt)return;
    const {arrivesAt,...base}=s;
    w.commercialTrip={...base,phase:'at-post',arrivedAt:arrivesAt,decisionUntil:arrivesAt+COMMERCIAL_DECISION_TICKS};
    if(!ensureCommercialPost(w)){beginCommercialReturn(w);return;}
    logCommercial(w,`${s.pawn.name} arrive au comptoir civil ; décision limitée à une heure.`);return;
  }
  if(s.phase==='at-post'){if(w.tick>=s.decisionUntil)beginCommercialReturn(w);return;}
  if(w.tick<s.returnAt||s.phase==='awaiting-entry'&&(w.tick-s.returnAt)%20!==0)return;
  if(w.worldMaps&&registeredCampaign(w).worldGroups?.legacyTravellers.some(r=>r.commercialTrip===s&&!w.worldMaps!.sites.some(m=>m.id===r.originMapId))){s.phase='awaiting-entry';return;}
  if(w.pawns.length+1>w.width*w.height||w.piles.length+s.items.length>32768){s.phase='awaiting-entry';return;}
  const entry=findCivilianReturnEntry(w,s.entry);if(!entry){s.phase='awaiting-entry';return;}
  const areaPlan=w.schemaVersion>=256?prepareSameMapAreaReturn(w,s.pawn):undefined;if(areaPlan)commitMapAreaEntry(s.pawn,areaPlan);
  const p=s.pawn;p.x=entry.x;p.z=entry.z;p.path=[];p.state='idle';p.moveCooldown=0;p.planCooldown=0;delete p.motion;
  w.pawns.push(p);w.piles.push(...s.items);
  const pendingPileIds=s.items.filter(i=>i.owner.type==='inventory').map(i=>i.id);
  if(pendingPileIds.length)w.commercialTrip={phase:'unloading',pawnId:p.id,startedAt:w.tick,pendingPileIds};else delete w.commercialTrip;
  refreshStock(w);logCommercial(w,`${p.name} revient avec ses possessions ; déchargement au contact.`);
}

/** Reused by explicit recovery unloading, without departure hunger/health gates. */
export function commercialUnloadReason(w:World,p:Pawn):string|null {
  if(w.scout)return 'Une reconnaissance est déjà engagée.';
  if(scoutUnstable(p,w)||scoutActiveTask(p)||p.state!=='idle'||p.path.length||p.moveCooldown>0||(p.motion?.end??0)>w.tick)return 'Le colon doit être libre et immobile.';
  return null;
}
