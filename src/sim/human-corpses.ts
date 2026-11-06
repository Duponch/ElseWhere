import {toxicCorpseRot256} from './toxic-victim-256.ts';
import {prepareLinkedShelfRetirement286} from './linked-storage-lifecycle-286.ts';
import { constructionRecipe,type ConstructionMaterial } from './construction-materials.ts';
import { corpseStage } from './corpses.ts';
import { rotAge,rotRateAtTemperature,type RotState } from './food-preservation.ts';
import { groundCapacity } from './ground-placement.ts';
import { adjacent } from './pathfinding.ts';
import { TemperatureView } from './temperature.ts';
import { ensureFireState } from './fire-rules.ts';
import { neutralLossPlan } from './destruction-losses.ts';
import { addFilth } from './filth.ts';
import type { ThermalLayout } from './thermal-topology.ts';
import { TICKS_PER_DAY,type Cell,type MaterialOwner,type MaterialPile,type Pawn,type World } from './types.ts';
import { structureById } from './structure-navigation.ts';

/** The person survives as a reference. Only the physical body can be lost. */
export interface HumanBodyState {observedAt:number;pileId?:number;lostAt?:number;rot?:RotState;damage?:number}
export interface HumanCorpseState {pawnId:number;nextBileTick?:number}
export const HUMAN_CORPSE_MAX_HP=100;
export const humanCorpse=(p:MaterialPile):boolean=>p.item==='human-corpse'&&!!p.humanCorpse;
export const corpsePawn=(w:World,p:MaterialPile):Pawn|undefined=>p.humanCorpse?w.pawns.find(a=>a.id===p.humanCorpse!.pawnId):undefined;

/** A buried/lost person has no loose body on the map. Live people and bodies
 * waiting for a free floor cell retain their normal position. */
export function pawnBodyLocation(w:World,p:Pawn):Cell|null {
  if(p.body?.lostAt!==undefined)return null;
  if(p.body?.pileId===undefined)return p;
  const pile=w.piles.find(i=>i.id===p.body!.pileId);if(!pile)return null;
  const owner=pile.owner;return owner.type==='ground'?owner:owner.type==='pawn'?w.pawns.find(a=>a.id===owner.pawnId)??null:null;
}
/** Equipment/inventory still belongs to its person, including when contained. */
export function pawnContentsLocation(w:World,p:Pawn):{cell:Cell;suspended:boolean}|null {
  if(p.body?.lostAt!==undefined)return null;
  const pile=p.body?.pileId===undefined?undefined:w.piles.find(i=>i.id===p.body!.pileId);
  if(pile?.owner.type==='grave'){
    const graveId=pile.owner.graveId,grave=structureById(w,graveId);return grave?{cell:grave,suspended:true}:null;
  }
  const cell=pawnBodyLocation(w,p);return cell?{cell,suspended:false}:null;
}
function anchor(rot:RotState,tick:number,rate:number):RotState {
  if(rate===(rot.rate??1))return rot;
  const next={...rot,progress:rot.progress+(tick-rot.atTick)*(rot.rate??1),atTick:tick};
  if(rate===1)delete next.rate;else next.rate=rate;return next;
}
function observe(w:World,p:Pawn,view:TemperatureView):HumanBodyState {
  p.body??={observedAt:w.tick,rot:toxicCorpseRot256(p.health,{progress:0,atTick:w.tick})};
  if(p.body.rot)p.body.rot=anchor(p.body.rot,w.tick,rotRateAtTemperature(view.at(w,p)));
  return p.body;
}
function materialize(w:World,p:Pawn,owner:MaterialOwner,view:TemperatureView):MaterialPile|null {
  if(p.state!=='dead'||!p.health?.death||p.body?.pileId!==undefined||p.body?.lostAt!==undefined
    ||(p.motion?.end??0)>w.tick||p.moveCooldown>0||w.piles.length>=32768||!Number.isSafeInteger(w.nextId+1)
    ||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id))return null;
  const body=observe(w,p,view),cell=owner.type==='pawn'?w.pawns.find(a=>a.id===owner.pawnId):p;
  if(!cell)return null;
  const pile:MaterialPile={id:w.nextId++,kind:'corpse',item:'human-corpse',quantity:1,owner,
    humanCorpse:{pawnId:p.id},...(body.damage?{damage:body.damage}:{}),rot:anchor(body.rot!,w.tick,rotRateAtTemperature(view.at(w,cell)))};
  w.piles.push(pile);body.pileId=pile.id;delete body.rot;delete body.damage;
  for(const actor of w.pawns)if(actor.burial?.bodyPawnId===p.id)actor.burial.corpseId=pile.id;
  // A weapon whose forced death drop was blocked stays attached to this body.
  // It cannot later teleport from the frozen location stored on the dead Pawn.
  if(w.schemaVersion<226)delete p.equipmentDropPending;
  p.path=[];p.motion=null;p.moveCooldown=0;
  return pile;
}
export function pickUpRetainedHumanCorpse(w:World,actor:Pawn,bodyPawnId:number):MaterialPile|null {
  const p=w.pawns.find(a=>a.id===bodyPawnId);
  if(!p||actor.burial?.bodyPawnId!==p.id||actor.burial.phase!=='pickup'||!(actor.x===p.x&&actor.z===p.z||adjacent(actor,p))
    ||(actor.motion?.end??0)>w.tick||w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===actor.id)
    ||w.packed.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===actor.id))return null;
  return materialize(w,p,{type:'pawn',pawnId:actor.id},new TemperatureView(w));
}
/** Also called after thermal mutations/ownership transitions at a paused tick. */
export function updateHumanCorpseTemperatures(w:World,layout?:ThermalLayout):void {
  if(w.schemaVersion<89)return;
  const bodies=w.pawns.filter(p=>p.body&&p.body.lostAt===undefined);if(!bodies.length)return;
  const view=new TemperatureView(w,layout),piles=new Map(w.piles.map(p=>[p.id,p])),pawns=new Map(w.pawns.map(p=>[p.id,p]));
  for(const p of bodies){
    if(p.body!.rot)p.body!.rot=anchor(p.body!.rot,w.tick,rotRateAtTemperature(view.at(w,p)));
    const pile=piles.get(p.body!.pileId??-1);if(!pile?.rot)continue;
    const o=pile.owner,cell=o.type==='ground'?o:o.type==='pawn'?pawns.get(o.pawnId):null;
    const rate=o.type==='grave'?0:cell?rotRateAtTemperature(view.at(w,cell)):pile.rot.rate??1;
    pile.rot=anchor(pile.rot,w.tick,rate);
  }
}
export function advanceHumanCorpses(w:World,layout?:ThermalLayout):void {
  if(w.schemaVersion<89||!w.pawns.some(p=>p.state==='dead'&&p.health?.death))return;
  const view=new TemperatureView(w,layout);
  for(const p of w.pawns){
    if(p.state!=='dead'||!p.health?.death||p.body?.lostAt!==undefined)continue;
    const body=observe(w,p,view);
    if(body.pileId===undefined&&groundCapacity(w,p,'human-corpse')>=1)materialize(w,p,{type:'ground',x:p.x,z:p.z},view);
  }
  updateHumanCorpseTemperatures(w,layout);
  for(const pile of w.piles){
    if(!pile.humanCorpse||pile.owner.type==='grave'||corpseStage(pile,w.tick)!=='rotting')continue;
    const state=pile.humanCorpse;
    if(state.nextBileTick===undefined){state.nextBileTick=w.tick+TICKS_PER_DAY;continue;}
    if(w.tick<state.nextBileTick)continue;
    // A carried corpse still advances its component clock, but has no Map of
    // its own on which to deposit bile. A grave suspends the component itself.
    if(pile.owner.type==='ground')addFilth(w,pile.owner,'corpse-bile');state.nextBileTick=w.tick+TICKS_PER_DAY;
  }
}
/** All still attached possessions are destroyed together; a dropped weapon is
 * deliberately absent. Preflight the whole ledger before changing any owner. */
export function destroyHumanCorpse(w:World,pile:MaterialPile,cause:'fire'|'bullet'|'bomb'|'cremation'|'roof'='fire'):boolean {
  const person=corpsePawn(w,pile);if(!person||!w.piles.includes(pile))return false;
  return destroyHumanBodyContents(w,person,pile,cause);
}
/** A thick collapse can destroy the real retained body before it became a
 * material pile (blocked floor, captured edge, still-held cargo). */
export function destroyRetainedHumanBody256(w:World,person:Pawn):boolean {
  if(w.schemaVersion<256||!w.pawns.includes(person)||person.state!=='dead'||!person.health?.death||person.body?.lostAt!==undefined||person.body?.pileId!==undefined)return false;
  return destroyHumanBodyContents(w,person,undefined,'roof');
}
function destroyHumanBodyContents(w:World,person:Pawn,pile:MaterialPile|undefined,cause:'fire'|'bullet'|'bomb'|'cremation'|'roof'):boolean {
  const contents=w.piles.filter(p=>p===pile||[...(!pile?['pawn']:[]),'equipment','apparel','inventory'].includes(p.owner.type)&&'pawnId' in p.owner&&p.owner.pawnId===person.id);
  const packed=w.packed.filter(p=>(p.owner.type==='inventory'||!pile&&p.owner.type==='pawn')&&p.owner.pawnId===person.id);
  const lost={...w.destroyed?.lost};
  for(const pack of packed)for(const ingredient of constructionRecipe(pack.building).ingredients){const item=ingredient.item as ConstructionMaterial|'component';lost[item]=(lost[item]??0)+ingredient.quantity;}
  if(packed.length&&(!Number.isSafeInteger((w.destroyed?.count??0)+packed.length)||cause==='fire'&&!Number.isSafeInteger((w.fires?.ledger.structures??0)+packed.length)||Object.values(lost).some(n=>!Number.isSafeInteger(n))))return false;
  const changes=new Map<MaterialPile['item'],number>();for(const p of contents)changes.set(p.item,(changes.get(p.item)??0)+p.quantity);
  const neutral=cause==='fire'?undefined:neutralLossPlan(w,{items:Object.fromEntries(changes)});if(neutral===null)return false;
  if(cause==='fire')for(const [item,quantity] of changes)if(!Number.isSafeInteger((w.fires?.ledger.items[item]??0)+quantity))return false;
  const linked=prepareLinkedShelfRetirement286(w,packed.map(p=>p.building));if(!linked.ok||!linked.commit())return false;
  const ledger=cause==='fire'?ensureFireState(w).ledger:undefined;
  if(ledger)for(const [item,quantity] of changes)ledger.items[item]=(ledger.items[item]??0)+quantity;
  if(neutral)w.destroyed=neutral;
  const ids=new Set(contents.map(p=>p.id));w.piles=w.piles.filter(p=>!ids.has(p.id));
  if(packed.length){const packedIds=new Set(packed.map(p=>p.building.id));w.packed=w.packed.filter(p=>!packedIds.has(p.building.id));w.destroyed={...w.destroyed,count:(w.destroyed?.count??0)+packed.length,lost};if(ledger)ledger.structures+=packed.length;}
  person.body??={observedAt:w.tick};person.body.lostAt=w.tick;delete person.body.damage;if(!pile)delete person.body.rot;delete person.equipmentDropPending;
  if(person.visitor)person.visitor.personalFoodIds=[];
  for(const grave of w.structures){if(pile&&grave.grave?.corpseId===pile.id)delete grave.grave.corpseId;
    if(grave.grave?.assignedPawnId===person.id)delete grave.grave.assignedPawnId;}
  for(const p of w.pawns){if(p.droppedWeaponId!==undefined&&ids.has(p.droppedWeaponId))delete p.droppedWeaponId;
    if(p.burial?.bodyPawnId===person.id){delete p.burial;if(p.orders.active==='bury')p.orders.active=null;p.path=[];if(p.state!=='dead'&&p.state!=='downed')p.state='idle';}}
  return true;
}
export function humanCorpseAge(w:World,p:Pawn):number {
  if(p.body?.rot)return p.body.rot.progress+(w.tick-p.body.rot.atTick)*(p.body.rot.rate??1);
  const pile=w.piles.find(i=>i.id===p.body?.pileId);return pile?rotAge(pile,w.tick):0;
}

export function damageRetainedHumanBody256(w:World,p:Pawn,amount:number):boolean {
 if(w.schemaVersion<256||!w.pawns.includes(p)||p.state!=='dead'||!p.health?.death||p.body?.pileId!==undefined||p.body?.lostAt!==undefined||!Number.isSafeInteger(amount)||amount<=0)return false;
 const body=observe(w,p,new TemperatureView(w)),damage=(body.damage??0)+amount;
 if(damage>=HUMAN_CORPSE_MAX_HP)return destroyRetainedHumanBody256(w,p);body.damage=damage;return true;
}
