import {SCHEMA_VERSION} from './types.ts';
import {laneOrder} from './save-lanes.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {kidnapCarryPairs261} from './caravan-kidnap-261.ts';
import {localWorldGroups} from './world-map-context.ts';
import {validPartyField292,partyPlain292 as plain,partyInteger292 as integer,partyData292 as data,partyKeys292} from './party-state-292.ts';
import {validPartyMemoryField292} from './party-memories-292.ts';
import type {World} from './types.ts';

/** Shape-only reciprocal token. Spatial feasibility is runtime authority. */
export function validPartyTask292(value:unknown,version:number,tick:number,width:number,height:number):boolean {
 if(!plain(value))return false;const token='partyStartedAtCore'in value,activity=data(value,'activity')?.value;
 if(activity!=='party')return !token;
 return (version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))&&partyKeys292(value,['activity','partyStartedAtCore','target','buildingId','phase','elapsed'])&&integer(value.partyStartedAtCore,0,tick*10)&&value.buildingId===null
  &&(value.phase==='travel'||value.phase==='active')&&integer(value.elapsed,0,1501)&&partyKeys292(value.target,['x','z'])&&integer(value.target.x,0,width-1)&&integer(value.target.z,0,height-1);
}

/** Closed custody/transport lanes, with sparse upserts. No terrain or health walk. */
const lists=new Set(['sites','piles','items','jobs','groups','groupLosses','losses','legacyTravellers','abandonedPawns','abandonedContents','owners','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','structures','packed','departed','pods','humans','members','people','animals','pawns']);
const lanes=['world','summary','dynamic','campaign','worldMaps','sites','map','secondarySite','campaignMap','piles','items','jobs','worldGroups','groups','group','state','pending261','groupLosses','losses','legacyTravellers','abandonedPawns','abandonedContents','worldPawns','owners','worldFactions','leaders','heldCaskets259','heldPlayerCaskets271','heldShipCaskets277','casket','cryptosleep','shipCryptosleep277','occupant','structures','packed','building','visitors','raids','podRescues','prisonDepartures','departed','startingArrival','pods','humans','members','people','animals','pawns','human','pawn','animal','mech','actor','scout','commercialTrip','recreation','task'] as const;
const humanLanes=new Set(['pawns','humans','members','people','human','pawn','actor']);
const laneReads=laneOrder(lanes);
export function validPartyHistoricalTransport292(raw:unknown,version:unknown):boolean {
 if(!integer(version,1,SCHEMA_VERSION))return false;let budget=2_000_000;const active=new Set<object>(),inherited=laneReads.inherited();
 const visit=(v:unknown,kind:string):boolean=>{
  if(--budget<0||!plain(v)||active.has(v))return false;active.add(v);
  if('party292'in v){if(!['world','map','dynamic'].includes(kind)||!validPartyField292(v,version,integer(data(v,'tick')?.value)?data(v,'tick')!.value:Math.floor(Number.MAX_SAFE_INTEGER/10),integer(data(v,'width')?.value,1)?data(v,'width')!.value:Number.MAX_SAFE_INTEGER,integer(data(v,'height')?.value,1)?data(v,'height')!.value:Number.MAX_SAFE_INTEGER))return false;}
  if('partyMemories292'in v){if(!humanLanes.has(kind)||!data(v,'recreation')||!validPartyMemoryField292(v,version,Math.floor(Number.MAX_SAFE_INTEGER/10),Math.floor(Number.MAX_SAFE_INTEGER/10),true))return false;}
  if(kind==='task'&&!validPartyTask292(v,version,Math.floor(Number.MAX_SAFE_INTEGER/10),Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER))return false;
  if('partyStartedAtCore'in v&&kind!=='task')return false;
  const list=(value:unknown,lane:string):boolean=>{
   // VisitorGroup.members are persistent IDs, not custody Pawn records.
   const visitorIds=lane==='visitor-member-id';
   if(!Array.isArray(value))return !visitorIds&&plain(value)&&!!data(value,'upserted')&&visit(value,lane);
   if(active.has(value)||value.length>1_000_000)return false;active.add(value);
   for(let i=0;i<value.length;i++){const d=Object.getOwnPropertyDescriptor(value,String(i));if(!d||!d.enumerable||!Object.hasOwn(d,'value'))return false;if(visitorIds?--budget<0||!integer(d.value,1):!visit(d.value,lane))return false;}
   active.delete(value);return true;
  };
  if('upserted'in v){const d=data(v,'upserted');if(!d||!list(d.value,kind))return false;}
  // Only the lanes present on this plain object, in lane order (save-lanes).
  const present=inherited?undefined:laneReads.present(v);
  for(let n=0,count=present?present.length:lanes.length;n<count;n++){const lane=lanes[present?present[n]!:n]!;const d=Object.getOwnPropertyDescriptor(v,lane);if(!d){if(lane in v)return false;continue;}if(!d.enumerable||!Object.hasOwn(d,'value'))return false;if(d.value===undefined||d.value===null||typeof d.value!=='object')continue;const child=kind==='visitors'&&lane==='groups'?'visitor-group':kind==='visitor-group'&&lane==='members'?'visitor-member-id':lane;if(!(lists.has(lane)?list(d.value,child):visit(d.value,child)))return false;}
  active.delete(v);return true;
 };
 try{return visit(raw,'world');}catch{return false;}
}

function validLocalParty292(w:World):boolean {
 if(!validPartyField292(w,w.schemaVersion,w.tick,w.width,w.height,w.nextId))return false;
 const a=w.party292?.active,byId=new Map(w.pawns.map(p=>[p.id,p])),carried=new Set<number>();
 if(a){for(const p of w.pawns){if(p.rescue?.phase==='carry')carried.add(p.rescue.patientId);const c=p.cryptosleepTask;if(c?.action==='carry'&&(c.phase==='carry'||c.phase==='closing')&&c.patientId!==undefined)carried.add(c.patientId);const s=p.shipCasketTask277;if(s?.action==='carry'&&(s.phase==='carry'||s.phase==='closing')&&s.patient?.kind==='human')carried.add(s.patient.id);}
  for(const row of kidnapCarryPairs261(w))carried.add(row.patientId);
  const groups=[...localWorldGroups(w).map(r=>r.state),...w.group?[w.group]:[]];for(const g of groups)if('humanPreparation'in g)for(const row of g.humanPreparation?.passengers??[])if(row.phase==='carry')carried.add(row.pawnId);
 }

 if(a){const organizer=byId.get(a.organizerId);if(!organizer||organizer.state==='dead'||organizer.health?.death||organizer.prisoner||carried.has(a.organizerId)||organizer.visitor||organizer.raid||organizer.podRescue||organizer.faction&&organizer.faction!=='colony'||organizer.cryptosleepHeldAt271!==undefined||organizer.shipCryptosleepHeldAt277!==undefined)return false;}
 const members=new Map(a?.members.map(m=>[m.pawnId,m])??[]);
 if(a?.organizerJoined&&!members.has(a.organizerId))return false;
 for(const m of a?.members??[]){const p=byId.get(m.pawnId),t=p?.recreation.task;if(!p||p.state==='dead'||p.health?.death||p.prisoner||carried.has(p.id)||p.visitor||p.raid||p.podRescue||p.faction&&p.faction!=='colony'||p.cryptosleepHeldAt271!==undefined||p.shipCryptosleepHeldAt277!==undefined||t?.activity!=='party'||t.partyStartedAtCore!==a!.startedAtCore)return false;}
 for(const p of w.pawns){if(!validPartyMemoryField292(p,w.schemaVersion,p.health?.death?.tick??w.tick,w.tick))return false;const t=p.recreation.task;if(t&&(!validPartyTask292(t,w.schemaVersion,w.tick,w.width,w.height)||t.activity==='party'&&(!a||!members.has(p.id)||t.partyStartedAtCore!==a.startedAtCore)))return false;}
 return true;
}
/** Candidate graph after the enclosing ordinary owner/identity admission. */
export function validPartyWorld292(w:World):boolean {
 try{
  if(!integer(w.schemaVersion,1,SCHEMA_VERSION))return false;
  if(Array.isArray(w.pawns)){if(!validLocalParty292(w))return false;}else if('party292'in w)return false;
  if(w.secondarySite&&!validLocalParty292({...w.secondarySite.map,schemaVersion:w.schemaVersion,tick:w.tick,nextId:w.nextId} as World))return false;
  for(const site of w.worldMaps?.sites??[]){if(site.map){const map={...site.map,schemaVersion:w.schemaVersion,tick:w.tick,nextId:w.nextId} as World;if(!validLocalParty292(map))return false;}}
  return true;
 }catch{return false;}
}
