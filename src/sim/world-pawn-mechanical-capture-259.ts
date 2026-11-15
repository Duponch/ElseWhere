import {concurrentHumanGroups341} from './concurrent-raids-341.ts';
import {shipCasketActor277} from './ship-casket-state-277.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {mechRaidGroups261} from './mechanical-raid-groups-261.ts';
import {registeredMaps} from './world-map-context.ts';
import {campaignPhysicalCaptures} from './campaign-people.ts';
import {captureDuckFlyerOwners256} from './duck-owner-capture-256.ts';
import {captureCoreStartingAnimals256} from './starting-pod-state-256.ts';
import {validMechanicalWorldPawn259} from './world-pawn-mechanical-259.ts';
import type {WorldPawnGCFacts256} from './world-pawn-gc-256.ts';
import type {WorldPawnOwner256} from './world-pawn-state-256.ts';
import type {CampaignState} from './world-map-state.ts';
import type {World,Pawn,MaterialPile,Structure} from './types.ts';
import type {WildAnimal} from './wildlife-state.ts';
import type {Mechanoid} from './mechanoid-state.ts';
import type {PackedFurniture} from './furniture-rules.ts';
const unknown:WorldPawnGCFacts256=Object.freeze({keep:[],unknown:['unclosed-human-animal-or-mechanical-owner'],relatedIds:[],memoryIds:[]});
type Mechanical=Extract<WorldPawnOwner256,{kind:'mechanical'}>;
type Actor=Pawn|WildAnimal|Mechanoid;
/** Adaptation approved for ONLY the current closed Elsewhere mechanical model.
 * No native negative history is inferred from its birth header. No grid, generic
 * object crawler, maintained index or extra persistent manager is introduced. */
function scan(root:CampaignState,rows:readonly Mechanical[]){
 if(!rows.length)return {facts:new Map<number,WorldPawnGCFacts256>(),history:new Set<number>(),seal:'[]'};
 const ids=new Set(rows.map(r=>r.actor.id)),keep=new Map<number,Set<string>>(),history=new Set<number>();
 for(const id of ids)keep.set(id,new Set());
 const ref=(id:number|null|undefined,source:string)=>{if(id!==null&&id!==undefined)keep.get(id)?.add(source);};
 const historic=(id:number|null|undefined)=>{if(id!==null&&id!==undefined&&ids.has(id))history.add(id);};
 const key=(value:string|null|undefined,source:string,active=true)=>{if(!value?.startsWith('mech:'))return;const id=Number(value.slice(5));if(active)ref(id,source);else historic(id);};
 const actors=new Set<object>(),piles=new Set<object>(),structures=new Set<object>();
 const actor=(a:Actor,source:string,physical:boolean,worldMechanical=false)=>{
  if(!worldMechanical)ref(a.id,source+':actual-actor-holder');
  if(actors.has(a))return;actors.add(a);
  const target=(id:number|null|undefined,field:string)=>physical?ref(id,source+':'+field):historic(id);
  if('species'in a){
   target(a.strike?.targetId,'animal-strike');target(a.threat?.targetId,'animal-threat');target(a.retaliation?.targetId,'animal-retaliation');target(a.predation?.targetId,'predation');target(a.manhunter?.targetId,'manhunter');target(a.manhunter?.door?.targetId,'manhunter-door');
   ref(a.startingPet?.bondedPawnId,source+':actual-bond');ref(a.startingPet?.masterId,source+':actual-master');historic(a.parents?.motherId);historic(a.parents?.fatherId);target(a.pregnancy?.fatherId,'pregnancy');target(a.mating?.femaleId,'mating');return;
  }
  target(a.melee?.order?.targetId,'melee-order');target(a.melee?.strike?.targetId,'melee-recovery');
  // These scalar histories have no payload ownership requirement. Receipt D
  // preserves the mechanical identity after the real Destroy/Discard.
  historic(a.meleeThreat?.attackerId);
  if('mechKind'in a){key(a.ranged?.order?.targetKey,source+':ranged-order',physical);key(a.ranged?.stance?.targetKey,source+':ranged-recovery',physical);return;}
  target(a.shooting?.order?.targetId,'shooting-order');target(a.tactics?.targetId,'tactics');historic(a.lastAttack?.targetId);
  const crisis=a.mental?.crisis;if(crisis&&'targetId'in crisis)target(crisis.targetId,'mental-target');
  target(a.rescue?.patientId,'rescue');target(a.animalRescue?.animalId,'animal-rescue');target(a.hunting?.animalId,'hunting');target(a.burial?.bodyPawnId,'burial');
  for(const memory of [...a.social?.memories??[],...a.romanceMemories??[],...a.bereavement??[],...a.familyBereavement??[],...a.deathThoughts??[]])ref(memory.otherId,source+':actual-human-memory');
  // These namespaces are human-only in admitted campaigns. Capture their
  // actual incoming references anyway; corruption never grants collection.
  ref(a.social?.last?.otherId,source+':human-social-reference');ref(a.social?.fight?.opponentId,source+':human-fight');
 };
 const pile=(p:Omit<MaterialPile,'owner'>&{owner?:MaterialPile['owner']|{type:'ancient-casket';casketId:number}},source:string)=>{
  if(piles.has(p))return;piles.add(p);ref(p.id,source+':thing-namespace');ref(p.innerResource?.id,source+':inner-resource-namespace');
  if(p.owner&&'pawnId'in p.owner)ref(p.owner.pawnId,source+':actual-item-holder');
  ref(p.humanCorpse?.pawnId,source+':actual-human-corpse');ref(p.corpse?.animalId,source+':actual-animal-corpse');if(p.mechCorpse)ref(p.id,source+':actual-mechanical-corpse');
 };
 const structure=(s:Structure,source:string)=>{
  if(structures.has(s))return;structures.add(s);ref(s.id,source+':structure-namespace');ref(s.art?.authorId,source+':human-art-author');ref(s.grave?.assignedPawnId,source+':grave-assignment');ref(s.grave?.corpseId,source+':actual-grave-corpse');
  key(s.turret?.targetKey,source+':turret-target');key(s.turret?.burst?.targetKey,source+':turret-burst');key(s.turret?.wick?.instigatorKey,source+':wick-instigator');key(s.casketWick?.instigatorKey,source+':casket-instigator');
  for(const id of s.shelf?.cells??[])ref(id,source+':shelf-reference');for(const b of s.bills??[])ref(b.id,source+':bill-namespace');
  if(s.casket){for(const p of s.casket.humans)actor(p,source+':casket-human',false);for(const a of s.casket.animals)actor(a,source+':casket-animal',false);for(const p of s.casket.items)pile(p,source+':casket-item');}
  if(s.shipCryptosleep277){const h=s.shipCryptosleep277,a=shipCasketActor277(h);if(a)actor(a,source+':spatial-casket-occupant',false);for(const p of h.items)pile(p,source+':spatial-casket-item');for(const p of h.packed)packed(p,source+':spatial-casket-furniture');}
  if(s.cryptosleep){if(s.cryptosleep.human)actor(s.cryptosleep.human,source+':player-casket-human',false);for(const p of s.cryptosleep.items)pile(p,source+':player-casket-item');for(const p of s.cryptosleep.packed)packed(p,source+':player-casket-furniture');}
 };
 const packed=(p:PackedFurniture,source:string)=>{structure(p.building,source+':packed');if(p.owner.type!=='ground')ref(p.owner.pawnId,source+':packed-holder');};
 for(const captured of campaignPhysicalCaptures(root as World))for(const slot of captured.owners.slots){const source='human:'+slot.id;ref(slot.id,source+':actual-human-holder');if(slot.pawn)actor(slot.pawn,source,!!captured.world&&slot.kind==='map');for(const p of slot.items)pile(p,source);for(const p of slot.packed)packed(p,source);}
 for(const map of registeredMaps(root)){
  const source='map';for(const m of map.mechanoids??[])actor(m,source+':mech:'+m.id,true);for(const a of map.wildlife?.animals??[])actor(a,source+':animal:'+a.id,true);
  for(const f of captureDuckFlyerOwners256(map)){ref(f.holderId,'duck-holder');actor(f.animal,'duck:'+f.holderId,false);}for(const a of captureCoreStartingAnimals256(map))actor(a,'initial-pod-animal',false);
  for(const p of map.piles)pile(p,source);for(const p of map.packed)packed(p,source);for(const s of map.structures)structure(s,source);
  for(const r of map.resources)ref(r.id,'resource-namespace');for(const j of map.jobs){ref(j.id,'job-namespace');ref(j.reservedBy,'job-reservation');}for(const fire of map.fires?.items??[]){ref(fire.id,'fire-namespace');ref(fire.attachedPawnId,'actual-fire-attachment');ref(fire.attachedAnimalId,'actual-animal-fire-attachment');}for(const ember of map.fires?.embers??[])ref(ember.id,'ember-namespace');
  const arrival=map.startingArrival;if(arrival?.profile==='crashlanded-pods-core256-v1'&&arrival.phase!=='opened')for(const pod of arrival.pods){ref(pod.id,'initial-pod-holder');ref(pod.skyfallerId,'initial-skyfaller');for(const p of pod.items)pile(p,'initial-pod');}
  for(const q of map.quests?.entries??[]){ref(q.pawnId,'actual-joiner-quest');ref(q.relationship?.otherId,'actual-quest-offer');}
  ref(map.arrivals?.pending?.relationship?.otherId,'actual-arrival-offer');
  for(const id of map.raids?.active?.members??[])ref(id,'actual-raid-member');for(const g of concurrentHumanGroups341(map.raids))for(const id of g.members)ref(id,'actual-raid-member');for(const group of mechRaidGroups261(map))for(const id of group.members)ref(id,'actual-mechanical-lord');
  for(const projectile of map.projectiles??[]){ref(projectile.id,'projectile-namespace');key(projectile.flight.launcherKey,'actual-projectile-launcher');key(projectile.flight.intendedKey,'actual-projectile-intended');key(projectile.flight.usedKey,'actual-projectile-used');key(projectile.arrival?.targetKey,'actual-projectile-arrival');for(const k of projectile.relations.friendlyTargetKeys??[])key(k,'projectile-launch-relation',false);}
  for(const wave of map.bombWaves??[]){ref(wave.id,'bomb-namespace');ref(wave.sourceId,'actual-bomb-source');key(wave.instigatorKey,'actual-bomb-instigator');for(const k of wave.damagedThingKeys)key(k,'bomb-impact-history',false);}
  for(const ship of map.orbital?.pending??[])ref(ship.negotiatorId,'actual-orbital-negotiator');
 }
 for(const f of root.worldFactions?.factions??[])ref(f.leaderOwnerId,'actual-faction-leader-reference');
 for(const owner of root.worldFactions?.leaders??[]){ref(owner.pawn.id,'actual-faction-leader');actor(owner.pawn,'faction-leader',false);for(const p of owner.items)pile(p,'faction-leader');for(const p of owner.packed)packed(p,'faction-leader');}
 for(const relation of root.relationships?.links??[]){ref(relation.aId,'actual-human-relationship');ref(relation.bId,'actual-human-relationship');}
 for(const memory of root.worldGroups?.lostMemories??[]){ref(memory.receiverId,'actual-memory-receiver');ref(memory.otherId,'actual-loss-memory');}
 for(const group of root.worldGroups?.groups??[]){const g=group.state;if('memberIds'in g)for(const id of g.memberIds)ref(id,'actual-group-intent');
  if('members'in g){for(const a of g.animalOwners?.members??[])actor(a,'caravan-animal',false);for(const p of g.items)pile(p,'caravan');for(const p of g.packed??[])packed(p,'caravan');}
  if('animalIds'in g)for(const id of g.animalIds??[])ref(id,'group-animal-intent');if('humanPreparation'in g){for(const id of g.humanPreparation?.releaseIds??[])ref(id,'actual-group-release');for(const p of g.humanPreparation?.passengers??[]){ref(p.pawnId,'actual-group-passenger');ref(p.carrierId,'actual-group-carrier');}}
  if('manifest'in g){for(const p of g.manifest){ref(p.carrierId,'actual-freight-carrier');ref(p.animalCarrierId,'actual-animal-freight-carrier');}for(const p of g.animalPreparation?.lines??[]){ref(p.animalId,'actual-animal-preparation');ref(p.handlerId,'actual-animal-handler');}}
 }
 for(const loss of root.worldGroups?.animalLosses??[]){actor(loss.animal,'animal-loss',false);for(const p of loss.items)pile(p,'animal-loss');for(const p of loss.packed??[])packed(p,'animal-loss');}
 for(const archive of root.worldGroups?.abandonedContents??[]){for(const a of archive.animals){actor(a.animal,'archive-animal',false);for(const p of a.items??[])pile(p,'archive-animal');for(const p of a.packed??[])packed(p,'archive-animal');}for(const p of archive.pods)for(const item of p.items)pile(item,'archive-pod');}
 for(const h of root.worldGroups?.abandonedPawns??[]){ref(h.id,'historical-exclusive-human');if(h.pawn)actor(h.pawn,'historical-human',false);for(const p of h.items)pile(p,'historical-human');for(const p of h.packed)packed(p,'historical-human');}
 for(const post of root.worldGroups?.posts??[])for(const p of post.state.stock)pile(p,'post-stock');
 for(const row of root.worldPawns?.owners??[]){actor(row.actor,'world-pawn:'+row.actor.id,false,row.kind==='mechanical');for(const p of row.items)pile(p,'world-pawn');for(const p of row.packed)packed(p,'world-pawn');}
 for(const held of root.worldPawns?.heldCaskets259??[])structure(held.casket,'actual-retained-cryptosleep-holder');
 for(const held of root.worldPawns?.heldPlayerCaskets271??[])structure(held.casket,'actual-retained-player-cryptosleep-holder');
 for(const held of root.worldPawns?.heldShipCaskets277??[])structure(held.casket,'actual-retained-spatial-cryptosleep-holder');
 const facts=new Map<number,WorldPawnGCFacts256>(),sealed:unknown[]=[];
 for(const row of rows){const admitted=validMechanicalWorldPawn259(row,root.schemaVersion,root.worldFactions),reasons=[...keep.get(row.actor.id)!];if(row.keepForever)reasons.push('actual-explicit-keep');if(row.everColonist)reasons.push('actual-explicit-ever-colonist');reasons.sort();
  // Humanlike-only Colonist/logs, Animal-only bonds, and outgoing native
  // relationship/memory guards do not apply to this real unspawned mechanic.
  const value=admitted?{keep:reasons,unknown:[],relatedIds:[],memoryIds:[]}:unknown;facts.set(row.actor.id,value);
  sealed.push([row.actor.id,row.factionId,row.originMapId,row.mechanicalTimersAtCore259,row.mode,row.destroyed===true,admitted,reasons]);
 }
 return {facts,history,seal:JSON.stringify(sealed)};
}
/** Lazy caller starts this once inside the real GC pass. Only pertinent
 * mechanical retentions are recaptured before commit; ordinary clocks, text
 * events and historical scalar IDs do not invalidate or manufacture a Keep. */
export function captureMechanicalWorldPawnFacts259(root:CampaignState){
 const state=root.worldPawns,rows=(state?.owners??[]).filter((r):r is Mechanical=>r.kind==='mechanical'),byId=new Map(rows.map(r=>[r.actor.id,r])),originals=rows.map(r=>r.actor);
 const supported=()=>(Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))&&root.planet?.revision===3&&!!root.worldMaps&&!!root.worldGroups&&!!root.worldFactions&&root.worldPawns===state;
 const before=supported()?scan(root,rows):undefined;
 return {facts(row:WorldPawnOwner256):WorldPawnGCFacts256{return row.kind==='mechanical'&&byId.get(row.actor.id)===row?before?.facts.get(row.actor.id)??unknown:unknown;},historicalIds:before?.history??new Set<number>(),current():boolean{
  return !!before&&supported()&&rows.every((r,i)=>r.actor===originals[i])&&scan(root,rows).seal===before.seal;
 }};
}
