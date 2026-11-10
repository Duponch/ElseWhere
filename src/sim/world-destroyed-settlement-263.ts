import {assignPileOwner} from './pile-index.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {isColonist,isAdmittedGuest} from './affiliation.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {enableCassandraRaids} from './cassandra-raids.ts';
import {adoptMiscIncidents} from './cassandra-misc.ts';
import {adoptFluIncidents} from './flu-incidents.ts';
import {enableVisitors} from './visitors.ts';
import {adoptColonyEconomy} from './colony-economy.ts';
import {adoptWind} from './wind.ts';
import {ensureFireState} from './fire-rules.ts';
import {furnitureDropCell} from './furniture-transfer.ts';
import {reformHumanOrigin260} from './work-release.ts';
import {prepareReformRetirementSurface260} from './group-reform-retirement-surface-260.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {World,Pawn,Cell} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {CampaignState,WorldMapRecord} from './world-map-state.ts';
import type {DestroyedSettlement263} from './world-sites-state-263.ts';

/** This is the actual defeated parent, never an unvisited hostile base or an
 * ItemStash relabelled as a home. Preview is scalar and entirely read-only. */
export function actualDestroyedSettlement263(root:CampaignState,record:WorldMapRecord):DestroyedSettlement263|undefined {
 if(!isSchema263OrLater(Number(root.schemaVersion))||record.kind!=='foreign-settlement'||record.target263?.kind!=='foreign-settlement'||record.target263.destroyedSiteId===undefined)return;
 const target=record.target263;
 return root.worldSites263?.entries.find((s):s is DestroyedSettlement263=>s.kind==='destroyed-settlement'&&s.id===target.destroyedSiteId&&s.sourceSettlementId===target.settlementId&&s.factionId===target.factionId&&s.mapId===record.id&&s.tile===record.tile);
}
const writable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?Object.hasOwn(d,'value')&&d.writable===true:!(k in o)&&Object.isExtensible(o);};
const removable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return !!d&&Object.hasOwn(d,'value')&&d.configurable===true;};
const HOME_FIELDS=['raids','miscIncidents','fluIncidents','visitors','economy','wind','fires'] as const;

/** HostFaction is the existing colony-prisoner contract. Other foreign
 * inventories do not become player goods when the map becomes a home. */
export function settleInventoryOwner263(map:World,id:number):boolean {
 const person=map.pawns.find(p=>p.id===id);
 return person?isColonist(person)||!!person.prisoner||isAdmittedGuest(person):!!map.wildlife?.animals.some(a=>a.id===id&&a.domestic);
}
export function settleInventoryOrigin263(map:World,actor:Pawn|WildAnimal):Cell {return 'species'in actor?actor:reformHumanOrigin260(map,actor);}
export function planDestroyedPackedDrop263(map:World):PackedFurniture[]|undefined {
 const packed=map.packed.map(p=>({...p,owner:{...p.owner}})),view={...map,packed};
 for(const p of packed)if(p.owner.type==='inventory'&&settleInventoryOwner263(map,p.owner.pawnId)){
  const actor=map.pawns.find(a=>a.id===(p.owner as {pawnId:number}).pawnId)??map.wildlife?.animals.find(a=>a.id===(p.owner as {pawnId:number}).pawnId);
  if(!actor)return;const cell=furnitureDropCell(view,settleInventoryOrigin263(map,actor),actor.id);if(!cell)return;assignPileOwner(p,{type:'ground',...cell});
 }
 return packed;
}

/** Prospective home calendars are prepared with the existing producers on a
 * private wrapper. This map never had a Camp/TempIncident calendar to resume.
 * Physical weather, wildlife, fire, wear, original actors and global RNG stay
 * literal. A surviving foreign defence keeps its own mandate and faction. */
export function prepareDestroyedSettlement263(root:CampaignState,map:World,record:WorldMapRecord):{current():boolean;commit():void}|undefined {
 const site=actualDestroyedSettlement263(root,record),registry=root.worldSites263,target=record.target263,maps=root.worldMaps;
 if(!site||!registry||!maps||!maps.sites.includes(record)||!Number.isSafeInteger(map.tick+1000000))return;
 const entries=registry.entries,tick=root.tick,rng=root.rng,nextId=root.nextId,defence=map.worldDefence263;
 if(map.tick!==tick||['raids','miscIncidents','fluIncidents','visitors','economy'].some(k=>{const d=Object.getOwnPropertyDescriptor(map,k);return !!d&&(!Object.hasOwn(d,'value')||d.value!==undefined&&!plainWorldPawnData256(d.value));}))return;
 const body=record.id===maps.rootMapId?root:record.map;
 if(!body||!HOME_FIELDS.every(k=>writable(body,k)))return;
 let surface:()=>boolean;try{surface=prepareReformRetirementSurface260(root,map,record.id,false);}catch{return;}
 const jobs=map.jobs,jobRefs=[...jobs],escrows=jobs.map(j=>j.escrow),stock=map.stock,stockValues=JSON.stringify([jobs,stock]);
 const source=JSON.stringify([site,target,defence]),piles=map.piles,packed=map.packed,pileRefs=[...piles],packRefs=[...packed],pileOwners=piles.map(p=>p.owner),packOwners=packed.map(p=>p.owner),people=map.pawns,peopleRefs=[...people],wildlife=map.wildlife,animals=wildlife?.animals,animalRefs=animals?[...animals]:undefined,contents=JSON.stringify([piles,packed,people,animals]),homeBefore=HOME_FIELDS.map(k=>map[k]),homeValues=JSON.stringify(homeBefore);
 const current=()=>surface()&&root.tick===tick&&root.rng===rng&&root.nextId===nextId&&root.worldSites263===registry&&root.worldMaps===maps&&registry.entries===entries&&maps.sites.includes(record)&&record.target263===target&&actualDestroyedSettlement263(root,record)===site&&map.worldDefence263===defence&&map.piles===piles&&map.packed===packed
  &&plainWorldPawnData256(site)&&plainWorldPawnData256(target)&&(!defence||plainWorldPawnData256(defence))&&JSON.stringify([site,target,defence])===source
  &&HOME_FIELDS.every((k,i)=>map[k]===homeBefore[i])&&JSON.stringify(homeBefore)===homeValues&&piles.length===pileRefs.length&&packed.length===packRefs.length&&piles.every((p,i)=>p===pileRefs[i]&&p.owner===pileOwners[i])&&packed.every((p,i)=>p===packRefs[i]&&p.owner===packOwners[i])&&map.pawns===people&&people.length===peopleRefs.length&&people.every((p,i)=>p===peopleRefs[i])&&map.wildlife===wildlife&&wildlife?.animals===animals&&(!animals||animals.length===animalRefs!.length&&animals.every((a,i)=>a===animalRefs![i]))&&JSON.stringify([piles,packed,people,animals])===contents
  &&map.jobs===jobs&&jobs.length===jobRefs.length&&jobs.every((j,i)=>j===jobRefs[i]&&j.escrow===escrows[i]&&writable(j,'escrow'))&&map.stock===stock&&writable(map,'stock')&&JSON.stringify([jobs,stock])===stockValues
  &&writable(registry,'entries')&&writable(record,'kind')&&writable(record,'settledAt')&&removable(record,'target263')&&HOME_FIELDS.every(k=>writable(map,k))
  &&piles.every(p=>writable(p,'owner'))&&packed.every(p=>writable(p,'owner'))&&(!defence||defence.source.kind==='foreign-settlement'&&defence.source.settlementId===site.sourceSettlementId&&writable(defence,'source'));
 if(!current())return;
 const draft={...map};adoptWind(draft);ensureFireState(draft);
 if(draft.gameProfile){if(!draft.raids)enableCassandraRaids(draft,true);adoptMiscIncidents(draft);adoptFluIncidents(draft);enableVisitors(draft,false,true);adoptColonyEconomy(draft);}
 if(!current())return;
 return {current,commit(){
  // The enclosing synchronous Settle transaction admits current() once before
  // any real inventory owner changes. There is no second refusal in this tail.
  registry.entries=entries.filter(s=>s!==site);
  delete record.target263;
  if(defence&&defence.source.kind==='foreign-settlement')defence.source={...defence.source,settledAtCore:tick*10};
  for(const k of HOME_FIELDS){const d=Object.getOwnPropertyDescriptor(draft,k);if(d){const old=Object.getOwnPropertyDescriptor(map,k);Object.defineProperty(map,k,old?{...old,value:d.value}:d);}}
 }};
}
