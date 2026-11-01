import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {captureHumanOwners,type HumanOwnershipCapture} from './human-owners.ts';
import {captureCoupleMapContext285,validCouplePawnContext285,validCouplePawnShape285} from './couple-save-285.ts';
import type {Pawn,Structure,World} from './types.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import type {CampaignSummary} from './world-map-state.ts';

export const hasCoupleFields285=(p:object):boolean=>'coupleClock285'in p||'coupleTask285'in p||'coupleMemories285'in p;

/** Cold fence before historical migration/transport. Current285 uses actual
 * owner guards below, never a generic object walk on every publication. */
export function validCoupleHistoricalTransport285(value:unknown,version:number):boolean {
 if(!Number.isSafeInteger(version)||version<1||version>300)return false;
 if(version===285||version===286||version===287||version===288||(version===289||(version===290||(version===291||(version===292||(version===293||(version===294||(version===295||(version===296||isCorePhysicalSchema297(version))))))))))return true;
 const domains=['pawns','structures','packed','worldMaps','secondarySite','campaignMap','worldGroups','worldPawns','worldFactions','group','groups','groupLosses','animalLosses','commercialTrip','visitors','raids','prisonDepartures','startingArrival','podRescues','scout','quests'];
 let budget=2_000_000;const active=new WeakSet<object>(),done=new WeakSet<object>();
 const walk=(v:unknown):boolean=>{
  if(--budget<0)return false;if(v===null||typeof v!=='object')return typeof v!=='function'&&typeof v!=='symbol';
  if(active.has(v))return false;if(done.has(v))return true;
  if(!Array.isArray(v)&&Object.getPrototypeOf(v)!==Object.prototype||hasCoupleFields285(v))return false;
  active.add(v);
  for(const key of Reflect.ownKeys(v)){
   if(typeof key!=='string')return false;const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!Object.hasOwn(d,'value'))return false;
   if(key==='tiles'||key==='resources'||key==='planet')continue;
   if(!walk(d.value))return false;
  }
  active.delete(v);done.add(v);return true;
 };
 try{
  if(value===null||typeof value!=='object')return true;
  if(hasCoupleFields285(value))return false;
  const envelope=Object.getOwnPropertyDescriptor(value,'world');if(envelope&&!Object.hasOwn(envelope,'value')||!envelope&&'world'in value)return false;
  const root=envelope?.value&&typeof envelope.value==='object'?envelope.value:value;
  if(hasCoupleFields285(root))return false;
  for(const key of domains){const d=Object.getOwnPropertyDescriptor(root,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in root)return false;}
  // Sparse collection patches are outside world in transport. The geography
  // packet/typed columns are not human custody and keep their existing guard.
  if(root!==value)for(const key of ['pawns','structures','packed']){const d=Object.getOwnPropertyDescriptor(value,key);if(d&&(!Object.hasOwn(d,'value')||!walk(d.value))||!d&&key in value)return false;}
  return true;
 }catch{return false;}
}

/** New domain only on an already admitted local/campaign projection. Enumerate
 * real custody branches, not terrain or a generic World tree. Plain owner and
 * global identity admission remain the enclosing reader's responsibility. */
export function validCoupleProjection285(w:World,readOwners?:()=>HumanOwnershipCapture):boolean {
 try{
  const rows:{pawn:Pawn;tick:number;civilTick:number;local:boolean}[]=[];
  let valid=true;
  const add=(pawn:Pawn,tick:number,local=false,civilTick=tick)=>{
   if(!validCouplePawnShape285(pawn,w.schemaVersion,tick,civilTick)){valid=false;return;}
   if(hasCoupleFields285(pawn)&&!rows.some(r=>r.pawn===pawn))rows.push({pawn,tick,civilTick,local});
  };
  const packs=(values:readonly PackedFurniture[])=>{for(const p of values)building(p.building);};
  const building=(s:Structure)=>{
   if('casket'in s&&s.casket)for(const p of s.casket.humans)add(p,p.health?.death?.tick??s.casket.heldAt);
   if('cryptosleep'in s&&s.cryptosleep){const h=s.cryptosleep;if(h.human)add(h.human,h.heldAt,false,w.tick);packs(h.packed);}
   if('shipCryptosleep277'in s&&s.shipCryptosleep277){const h=s.shipCryptosleep277;if(h.occupant?.kind==='human')add(h.occupant.pawn,h.heldAt,false,w.tick);packs(h.packed);}
  };
  const group=(g:World['group'])=>{if(g&&'members'in g){for(const p of g.members)add(p,g.lastPersonalTick);packs(g.packed??[]);}};
  for(const p of w.pawns)add(p,w.tick,true);
  for(const s of w.structures)if('casket'in s||'cryptosleep'in s||'shipCryptosleep277'in s)building(s);
  packs(w.packed);
  if(w.startingArrival&&w.startingArrival.phase!=='opened')for(const pod of w.startingArrival.pods)add(pod.pawn,w.startingArrival.personalTick);
  for(const trip of [w.scout,w.commercialTrip])if(trip&&'pawn'in trip)add(trip.pawn,w.tick);
  group(w.group);
  for(const loss of w.groupLosses??[])add(loss.pawn,loss.tick);
  for(const departure of w.visitors?.departed??[])add(departure.pawn,departure.tick);
  for(const departure of w.podRescues?.departed??[])add(departure.pawn,departure.tick);
  for(const row of w.worldFactions?.leaders??[])add(row.pawn,row.clock);
  for(const row of w.worldPawns?.owners??[]){if(row.kind==='human')add(row.actor,row.clockCore/10);packs(row.packed);}
  for(const row of w.worldPawns?.heldCaskets259??[])building(row.casket);
  for(const row of w.worldPawns?.heldPlayerCaskets271??[])building(row.casket);
  for(const row of w.worldPawns?.heldShipCaskets277??[])building(row.casket);
  // groupWorld(summary,null) keeps the literal top-level group rows on older
  // classic campaigns that have no geographic campaignMap projection.
  const metadata=w.campaignMap?.revision===2?w.campaignMap:'groups'in w?w as unknown as Pick<CampaignSummary,'groups'|'groupLosses'>:undefined;
  for(const row of metadata?.groups??[]){group(row.state);for(const p of row.pending261?.people??[])add(p,w.tick);packs(row.pending261?.packed??[]);}
  for(const loss of metadata?.groupLosses??[])add(loss.pawn,loss.tick);
  if(!valid)return false;if(!rows.length)return true;
  const owners=readOwners?.()??captureHumanOwners(w),knownHumanIds=new Set(owners.people.keys());
  const map=rows.some(r=>r.local&&'coupleTask285'in r.pawn)?captureCoupleMapContext285(w):undefined;
  return rows.every(r=>validCouplePawnContext285(r.pawn,{version:w.schemaVersion,tick:r.tick,civilTick:r.civilTick,nextId:w.nextId,knownHumanIds,...r.local&&map?{map}:{}}));
 }catch{return false;}
}
