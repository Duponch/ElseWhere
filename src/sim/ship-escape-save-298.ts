import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {validGroupMapContext} from './world-map-context-save.ts';
import {indexShipParts276,connectedShipParts276} from './ship-part-reader-276.ts';
import {isShipComputerSensorsKind298} from './ship-computer-sensors-content-298.ts';
import {validShipComputerSensorsBuilding298} from './victory-content-save-298.ts';
import {validShipHullBuilding276} from './ship-part-save-276.ts';
import {validShipReactorBuilding275} from './ship-reactor-save-275.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {shipCasketThingIds277,validShipCasketBuilding277,validateRetainedShipCasketOwner277} from './ship-casket-owner-save-277.ts';
import {validActorMapBedField256} from './actor-map-bed-256.ts';
import type {NumericMembershipSink} from './numeric-membership.ts';
import type {HumanOwnerSlot,HumanOwnershipCapture} from './human-owners.ts';
import {SHIP_ESCAPE_HISTORY_LIMIT_298,type EscapeCampaign298,type EscapedShips298,type EscapedShip298} from './ship-escape-state-298.ts';

const data=(v:object,k:PropertyKey)=>{const d=Object.getOwnPropertyDescriptor(v,k);return d?.enumerable&&Object.hasOwn(d,'value')?d:undefined;};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const exact=(v:unknown,keys:readonly string[]):v is Record<string,unknown>=>plain(v)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>!!data(v,k));
const int=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>data(v,String(i))).every(Boolean);
const atCore=(civil:unknown,core:unknown,max:number):core is number=>int(civil)&&int(core,0,max)&&Math.floor(core/10)===civil;
const nextDeparture=(state:EscapedShips298)=>state.receipts.length+1;

/** Descriptor-first envelope. Actual current Core is EXPLICIT in298, including
 * paused phase1..9. Only an actual completed departure has this saved owner. */
export function validEscapedShipsEnvelope298(root:object,version:number,tick:number,nextThingId:number,physicalCore298?:number):boolean {
 try{
  if(!int(version,1,301))return false;
  const field=data(root,'escapedShips298');if(!field)return !('escapedShips298'in root);
  if(!isSchema298OrLater(version)||!atCore(tick,physicalCore298,Number.MAX_SAFE_INTEGER)||!int(nextThingId,1)||!exact(field.value,['revision','nextId','departures','receipts','credits']))return false;
  const s=field.value;if(s.revision!==1||!int(s.nextId,2,SHIP_ESCAPE_HISTORY_LIMIT_298+1)||!dense(s.receipts,SHIP_ESCAPE_HISTORY_LIMIT_298)||!dense(s.departures,SHIP_ESCAPE_HISTORY_LIMIT_298))return false;
  for(let i=0;i<s.receipts.length;i++){
   const r=s.receipts[i];if(!plain(r)||!exact(r,['id','mapId','computerId','at','atCore298','outcome'])||r.id!==i+1||!int(r.mapId)||!int(r.computerId,1,nextThingId-1)||!atCore(r.at,r.atCore298,physicalCore298)||r.outcome!=='departed'||i>0&&Number((s.receipts[i-1] as Record<string,unknown>).atCore298)>r.atCore298)return false;
  }
  const state=s as unknown as EscapedShips298;if(state.nextId!==nextDeparture(state))return false;
  const successful=state.receipts;if(successful.length!==state.departures.length)return false;
  for(let i=0;i<state.departures.length;i++){
   const e=state.departures[i],r=successful[i]!;
   if(!plain(e))return false;const archivedParts=data(e,'parts')?.value;if(!dense(archivedParts,32768))return false;
   if(!exact(e,['id','mapId','computerId','departedAt','departedAtCore298','originKind298','originTile298','finalRoot298',...(archivedParts.length?['context']:[]),'parts','aliases'])||e.id!==r.id||e.mapId!==r.mapId||e.computerId!==r.computerId||e.departedAt!==r.at||e.departedAtCore298!==r.atCore298||!['registered-map','monomap'].includes(e.originKind298)||e.originTile298!==null&&!int(e.originTile298)||e.originKind298==='monomap'&&(e.mapId!==0||e.originTile298===null)||!['network','known-destroyed'].includes(e.finalRoot298)||e.finalRoot298==='known-destroyed'&&archivedParts.length!==0||e.finalRoot298==='network'&&archivedParts.length===0||!dense(e.parts,32768)||!dense(e.aliases,32768)||e.parts.length>0&&!plain(e.context)||e.parts.length===0&&e.aliases.length!==0)return false;
  }
  return state.credits===null||int(state.credits,1,state.nextId-1)&&successful.at(-1)?.id===state.credits;
 }catch{return false;}
}
function validAliases(e:EscapedShip298,nextId:number):boolean {
 const expected=new Map<string,true>();
 for(const c of e.parts.filter(isShipCasket277)){
  const o=c.shipCryptosleep277.occupant;if(o?.kind==='human')for(const key of ['bedId','bedSlot','mapBed','allowedAreaId','allowedAreaReturn'])expected.set(`${o.pawn.id}:actor:${key}`,true);
  else if(o?.kind==='animal'){expected.set(`${o.animal.id}:actor:mapBed`,true);if(o.animal.domestic)for(const key of ['bedId','penMarkerId'])expected.set(`${o.animal.id}:domestic:${key}`,true);}
 }
 if(e.aliases.length!==expected.size)return false;
 for(const a of e.aliases){
  if(!plain(a)||!exact(a,data(a,'present')?.value===true?['actorId','target','key','present','value']:['actorId','target','key','present'])||typeof a.present!=='boolean'||!int(a.actorId,1,nextId-1)||!['actor','domestic'].includes(a.target))return false;
  const k=`${a.actorId}:${a.target}:${a.key}`;if(!expected.has(k))return false;expected.delete(k);if(!a.present)continue;
  if(a.key==='mapBed'){if(!validActorMapBedField256({mapBed:a.value},298,nextId))return false;}
  else if(a.key==='bedSlot'){if(a.value!==0&&a.value!==1)return false;}
  else if(a.key==='bedId'&&a.target==='actor'){if(a.value!==null&&!int(a.value,1,nextId-1))return false;}
  else if(a.key==='allowedAreaReturn')return false;
  else if(!int(a.value,1,nextId-1))return false;
 }
 return expected.size===0;
}
/** Only explicit actual monomap0 provenance permits an absent historic record.
 * Registered-map archives always require their retained actual/retired record. */
function validOrigin(e:EscapedShip298,root:EscapeCampaign298):boolean {
 const meta=root.worldMaps?.sites.find(m=>m.id===e.mapId)??root.worldMaps?.retired.find(m=>m.id===e.mapId);
 if(e.originKind298==='registered-map')return !!meta&&meta.tile===e.originTile298&&(!e.context||meta.tile===null||e.context.site?.revision===3&&meta.tile===e.context.site.tileId);
 return e.mapId===0&&e.originTile298!==null&&e.originTile298===root.planet?.homeTile&&(!meta||meta.tile===e.originTile298)&&(!e.context?.site||e.context.site.revision===3&&e.context.site.tileId===e.originTile298);
}
/** Register this frozen campaign owner ONCE, outside all local-map loops.
 * Building and nested originals join the existing global Thing namespace. */
export function validateEscapedShips298(root:EscapeCampaign298,ids:NumericMembershipSink,knownHumanIds:ReadonlySet<number>,physicalCore298:number):string[] {
 try{
 const errors:string[]=[];if(!validEscapedShipsEnvelope298(root,Number(root.schemaVersion),root.tick,root.nextId,physicalCore298))return ['Invalid escaped-ship298 envelope'];
 const state=root.escapedShips298;if(!state)return errors;if(!plainWorldPawnData256(state))return ['Escaped ship298 is not data-only'];const humans=new Set(knownHumanIds);
 for(const e of state.departures)for(const c of e.parts.filter(isShipCasket277))if(c.shipCryptosleep277.occupant?.kind==='human')humans.add(c.shipCryptosleep277.occupant.pawn.id);
 const destroyedRootIds=new Set<number>();
 for(const e of state.departures){
  if(e.finalRoot298==='known-destroyed')destroyedRootIds.add(e.computerId);
  if(!validOrigin(e,root)||e.context&&!validGroupMapContext(e.context,e.departedAt,298,root)||!validAliases(e,root.nextId)){errors.push('Escaped ship298 origin or detached-alias provenance refused');continue;}
  if(!e.parts.length)continue;
  const archivedContext=e.context;if(!archivedContext){errors.push('Nonempty escaped network298 lacks its actual context');continue;}
  // Archive validation uses its departure physical frontier. Nested occupants
  // retain their own heldAtCore297; no current-root phase is borrowed for them.
  const context={...archivedContext,schemaVersion:root.schemaVersion,tick:e.departedAt,phaseCore297:e.departedAtCore298%10,nextId:root.nextId,worldFactions:root.worldFactions,foodPolicies:root.foodPolicies,apparelPolicies:root.apparelPolicies,research:root.research};
  if(!e.parts.every(plain)){errors.push('Escaped ship298 contains a non-record part');continue;}
  const index=indexShipParts276(e.parts,archivedContext.width,archivedContext.height);if(!index.ok){errors.push('Escaped ship298 physical graph refused');continue;}
  const graph=connectedShipParts276(index.index,e.parts[0]!.id);
  if(!graph.ok||graph.parts.length!==e.parts.length)errors.push('Escaped ship298 is not the one actual connected departure network');
  for(const part of e.parts){
   if(!int(part.id,1,root.nextId-1)||ids.has(part.id))errors.push('Escaped ship298 building has another actual owner');else ids.add(part.id);
   if(isShipCasket277(part)){
    if(!validShipCasketBuilding277(part,298,context,e.departedAt,e.departedAtCore298))errors.push('Escaped casket298 physical data refused');
    if(part.shipCryptosleep277.occupant)errors.push(...validateRetainedShipCasketOwner277(part,context,humans,e.departedAt,e.departedAtCore298));
    for(const id of shipCasketThingIds277(part,true))if(!int(id,1,root.nextId-1)||ids.has(id))errors.push('Escaped casket298 original has another actual owner');else ids.add(id);
   }else if(isShipComputerSensorsKind298(part.kind)){
    if(!validShipComputerSensorsBuilding298(part,298,context))errors.push('Escaped computer/sensors298 physical data refused');
   }else if(part.kind==='ship-reactor'){
    if(!validShipReactorBuilding275(part,298,context,e.departedAtCore298))errors.push('Escaped reactor298 physical data or clock refused');
   }else if(!validShipHullBuilding276(part,298,context))errors.push('Escaped hull298 physical data refused');
  }
 }
 for(const id of destroyedRootIds)if(ids.has(id))errors.push('Destroyed final root298 still has an actual Thing owner');
 return errors;
 }catch{return ['Malformed escaped ship298 physical owner'];}
}
export function escapedShipHumanSlots298(root:EscapeCampaign298):HumanOwnerSlot[] {
 return (root.escapedShips298?.departures??[]).flatMap(e=>e.parts.filter(isShipCasket277).flatMap(c=>{const h=c.shipCryptosleep277,p=h.occupant?.kind==='human'?h.occupant.pawn:undefined;return p?[{id:p.id,name:p.name,kind:'ship-casket' as const,simulation:'frozen' as const,place:{kind:'ship-casket' as const,casketId:c.id},status:'away' as const,validationTick:h.heldAt,pawn:p,items:h.items,packed:h.packed}]:[];}));
}
/** Sole frozen campaign capture. Shapes/owners are admitted by the RAW guard;
 * no synthetic World, personal advance, new Thing registration or observer.
 * Only copied slot/array wrappers are frozen, never the original held data. */
export function captureEscapedShipHumans298(root:EscapeCampaign298):HumanOwnershipCapture {
 const byId=new Map<number,HumanOwnerSlot>(),people=new Map<number,{id:number;name:string;status:'away'}>(),slots:HumanOwnerSlot[]=[];
 for(const source of escapedShipHumanSlots298(root)){
  if(!Number.isSafeInteger(source.id)||source.id<1||source.id>=root.nextId||byId.has(source.id)||!source.pawn||source.pawn.id!==source.id
   ||typeof source.name!=='string'||source.name.length<1||source.name.length>80||!Number.isSafeInteger(source.validationTick)||source.validationTick<0||source.validationTick>root.tick)
   throw Error('Invalid or duplicate escaped human original');
  const slot=Object.freeze({...source,items:Object.freeze([...source.items]),packed:Object.freeze([...source.packed])});
  byId.set(slot.id,slot);people.set(slot.id,{id:slot.id,name:slot.name,status:'away'});slots.push(slot);
 }
 const held=Object.freeze(slots),none:readonly HumanOwnerSlot[]=Object.freeze([]);
 const census=Object.freeze({localOwned:0,localLiving:0,localDead:0,containedOwned:held.length,containedLiving:held.length,
  containedPiles:held.reduce((n,s)=>n+s.items.length,0),containedPacked:held.reduce((n,s)=>n+s.packed.length,0),
  legacyAwayOwned:0,legacyAwayLiving:0,groupAwayOwned:0,groupAwayLiving:0,terminalOwned:0,frozenPawnArchives:0,simpleDepartureIdentities:0,knownHumans:people.size,
  mapPiles:0,legacyTravelPiles:0,groupTravelPiles:0,terminalPiles:0,archivedPiles:0,postPiles:0,archivedPacked:0});
 return Object.freeze({byId,people,slots:held,pawnOwners:held,local:none,away:none,contained:held,terminals:none,frozen:none,census});
}
export function escapedShipCaskets298(root:EscapeCampaign298) {return (root.escapedShips298?.departures??[]).flatMap(e=>e.parts.filter(isShipCasket277));}
export function* escapedShipThingIds298(root:EscapeCampaign298):Generator<number> {for(const e of root.escapedShips298?.departures??[])for(const p of e.parts){yield p.id;if(isShipCasket277(p))yield*shipCasketThingIds277(p,true);}}
const lanes=new Set(['world','dynamic','campaign','worldMaps','sites','map','worldGroups','groups','state','worldPawns','owners','actor','pawns','structures','jobs','packed','building','shipCryptosleep277','occupant','heldShipCaskets277','secondarySite','group','worldSites263','tradeRequests284','entries']);
/** Historical branches cannot gain the future owner/summary/commands. */
export function validShipEscapeHistorical298(value:unknown,version:number):boolean {
 if(!int(version,1,301))return false;if(isSchema298OrLater(version))return true;let budget=2000000;const active=new Set<object>();
 const walk=(v:unknown):boolean=>{if(--budget<0)return false;if(v===null||typeof v!=='object')return true;if(active.has(v)||!Array.isArray(v)&&!plain(v))return false;active.add(v);for(const k of Reflect.ownKeys(v)){if(typeof k!=='string'||k==='escapedShips298'||k==='escapedShipsSummary298')return false;const d=Object.getOwnPropertyDescriptor(v,k);if(!d||!Object.hasOwn(d,'value'))return false;if(k==='type'&&(d.value==='ship-launch-298'||d.value==='ship-credits-continue-298'))return false;if((Array.isArray(v)||lanes.has(k))&&!walk(d.value))return false;}active.delete(v);return true;};
 try{return walk(value);}catch{return false;}
}
