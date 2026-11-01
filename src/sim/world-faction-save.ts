import {hasPartyMemoryField292} from './party-memories-292.ts';
import {isSchema299OrLater} from './schema-compatibility-257.ts';
import {hasCoupleFields285} from './couple-owner-save-285.ts';
import {validCouplePawnContext285} from './couple-save-285.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {validSettlementAdmission263} from './world-target-registry-save-263.ts';
import {validWorldAffiliationForeignKeys259} from './world-affiliation-259.ts';
import type {NumericMembershipLookup} from './numeric-membership.ts';
import {validFactionNoExpansionIdeos256} from './world-faction-no-expansion-ideo-256.ts';
import {APPAREL_POLICY_INTERVAL} from './apparel-renewal.ts';
import {validWorldFactionSelection} from './world-generation-settings.ts';
import {isWorldFactionDef256,WORLD_FACTION_DEFINITIONS_256} from './world-faction-catalog.ts';
import {validWorldRelationKind274} from './world-diplomacy-274.ts';
import type {WorldFactionRegistry256} from './world-faction-state.ts';
import {validateDetachedPawnRecordShape} from './pawn-record-save.ts';
import {validatePawnHealthRecord} from './health-save.ts';
import {validateRecreationRecordShape} from './recreation-save.ts';
import {validateHumanSocial} from './social-save.ts';
import {validSchedule} from './schedule.ts';
import {validMentalShape} from './mental-save.ts';
import type {World} from './types.ts';
const object=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
const integer=(v:unknown,min=0,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.hasOwn(Object.getOwnPropertyDescriptor(v,String(i))??{},'value')).every(Boolean);
const keys=(v:Record<string,unknown>,required:readonly string[],optional:readonly string[]=[])=>required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
const name=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=80&&!/[\u0000-\u001f\u007f-\u009f]/.test(v);
/** Closed domain admission before nested personal guards; no cache or writer. */
function plain(v:unknown,budget:{left:number},depth=0):boolean {if(--budget.left<0||depth>28)return false;if(v===null)return true;if(typeof v!=='object')return ['string','number','boolean','undefined'].includes(typeof v)&&(typeof v!=='number'||Number.isFinite(v));if(Array.isArray(v))return dense(v,10000)&&v.every(x=>plain(x,budget,depth+1));return object(v)&&Object.values(v).every(x=>plain(x,budget,depth+1));}
const requiredPawn=['id','name','x','z','skills','orders','recreation','foodPolicyId','schedule','restZeroTicks','collapsePending','hunger','rest','mood','comfort','beauty','memories','jobId','haul','cooking','need','bedId','needCooldown','state','priorities','path','moveCooldown','planCooldown'];
const passivePawn=['partyMemories292','coupleClock285','coupleMemories285','age','appearance','health','medicalCare','apparelPolicyId','apparelAutomation','nextApparelCheckAt','faction','mental'];
export interface WorldFactionValidationHeader256 {present:boolean;tick:number;width:number;height:number;nextId:number;tileCount:number;postIds:ReadonlySet<number>;allowUnobservedPostReferences?:true;knownHumanIds:ReadonlySet<number>;occupiedThingIds:NumericMembershipLookup}
/** Old schema accepts ABSENCE only. Call on RAW, full and reconstructed delta
 * before adoption; this module never creates historical factions or leaders. */
export function validateWorldFactionRegistry256(value:unknown,version:number,c:WorldFactionValidationHeader256):string[] {
 try{return validateCandidate(value,version,c);}catch{return ['Invalid world faction registry.'];}
}
function validateCandidate(value:unknown,version:number,c:WorldFactionValidationHeader256):string[] {
 if(!c.present)return value===undefined?[]:['Unexpected faction registry value.'];if(version<256)return ['Future world faction registry in historical schema.'];
 if(!plain(value,{left:200000})||!object(value)||!keys(value,['revision','contentModel','generatedAt','playerFactionId','nextFactionId','nextSettlementId','factions','relations','settlements','leaders'],['noExpansionIdeoIds'])||value.revision!==1||value.contentModel!=='original-faction-content-v1'||!integer(value.generatedAt,0,c.tick)||!integer(value.nextFactionId,2)||!integer(value.nextSettlementId,1)||!integer(value.playerFactionId,1)||!dense(value.factions,17)||!dense(value.relations,136)||!dense(value.settlements,c.tileCount)||!dense(value.leaders,12))return ['Invalid world faction registry.'];
 const factions=new Map<number,{def:import('./world-faction-catalog.ts').WorldFactionDef256;hidden:boolean;leaderOwnerId:number|null}>(),leaders=new Map<number,number>(),pairs=new Set<string>(),tiles=new Set<number>(),ids=new Set<number>(),postIds=new Set<number>(),humanIds=new Set(c.knownHumanIds);
 for(const a of value.factions){if(!object(a)||!keys(a,['id','def','hidden','name','randomKey','colorFromSpectrum','leaderOwnerId'],['noExpansionIdeo',...(version>=259?['lifecycle259']:[])])||!integer(a.id,1,Number(value.nextFactionId)-1)||factions.has(a.id)||!isWorldFactionDef256(a.def)||typeof a.hidden!=='boolean'||a.hidden!==WORLD_FACTION_DEFINITIONS_256[a.def].hidden||!name(a.name)||!integer(a.randomKey,0,2147483646)||typeof a.colorFromSpectrum!=='number'||!Number.isFinite(a.colorFromSpectrum)||a.colorFromSpectrum<0||a.colorFromSpectrum>1||a.leaderOwnerId!==null&&!integer(a.leaderOwnerId,1,c.nextId-1))return ['Invalid faction instance.'];if((WORLD_FACTION_DEFINITIONS_256[a.def].leaderKinds.length>0)!==(a.leaderOwnerId!==null))return ['Missing or unexpected faction leader producer.'];if(Object.hasOwn(a,'lifecycle259')&&(!object(a.lifecycle259)||!keys(a.lifecycle259,['revision','defeated','temporary'])||a.lifecycle259.revision!==1||typeof a.lifecycle259.defeated!=='boolean'||typeof a.lifecycle259.temporary!=='boolean'))return ['Invalid or future actual faction lifecycle'];factions.set(a.id,{def:a.def,hidden:a.hidden,leaderOwnerId:a.leaderOwnerId as number|null});}
 if(!validFactionNoExpansionIdeos256(value,version))return ['Invalid or future no-expansion faction initialization.'];
 if(!validWorldFactionSelection([...factions.values()].filter(a=>!WORLD_FACTION_DEFINITIONS_256[a.def].player).map(a=>a.def)))return ['Invalid ordered faction instances.'];
 const player=factions.get(Number(value.playerFactionId));if(!player||!WORLD_FACTION_DEFINITIONS_256[player.def].player||[...factions.values()].filter(f=>WORLD_FACTION_DEFINITIONS_256[f.def].player).length!==1||player.leaderOwnerId!==null)return ['Invalid player faction authority.'];
 for(const r of value.relations){if(!object(r)||!keys(r,['aId','bId','goodwill','kind'])||!integer(r.aId,1)||!integer(r.bId,r.aId+1)||!factions.has(r.aId)||!factions.has(r.bId)||!integer(r.goodwill,-100,100)||!validWorldRelationKind274(r.goodwill,r.kind,version)||pairs.has(`${r.aId}:${r.bId}`))return ['Invalid bilateral faction relation.'];if((WORLD_FACTION_DEFINITIONS_256[factions.get(r.aId)!.def].permanentEnemy||WORLD_FACTION_DEFINITIONS_256[factions.get(r.bId)!.def].permanentEnemy)&&r.goodwill!==-100)return ['Permanent enemy relation cannot be friendly.'];pairs.add(`${r.aId}:${r.bId}`);}
 if(pairs.size!==factions.size*(factions.size-1)/2)return ['Incomplete faction relation authority.'];
 const settlements=new Set<number>();for(const s of value.settlements){if(!object(s)||!keys(s,['id','factionId','tile','name','postId'],isSchema263OrLater(version)?['attack263']:[])||!validSettlementAdmission263(s,version,c.tick,c.nextId)||!integer(s.id,1,Number(value.nextSettlementId)-1)||settlements.has(s.id)||!integer(s.factionId,1)||!factions.has(s.factionId)||factions.get(s.factionId)!.hidden||WORLD_FACTION_DEFINITIONS_256[factions.get(s.factionId)!.def].player||!integer(s.tile,0,c.tileCount-1)||tiles.has(s.tile)||!name(s.name)||s.postId!==null&&(!integer(s.postId,1)||!c.allowUnobservedPostReferences&&!c.postIds.has(s.postId)||postIds.has(s.postId)))return ['Invalid faction settlement owner or tile.'];settlements.add(s.id);tiles.add(s.tile);if(s.postId!==null)postIds.add(s.postId as number);}
 for(const l of value.leaders){if(!object(l)||!keys(l,['factionId','clock','pawn','items','packed'])||!integer(l.factionId,1)||leaders.has(l.factionId)||!factions.has(l.factionId)||!integer(l.clock,Number(value.generatedAt),c.tick)||!object(l.pawn)||!keys(l.pawn,requiredPawn,[...passivePawn,...Number(version)===301?['jobTickDelta301']:[],...isSchema299OrLater(version)?['lastIngestAtCore299']:[],...version>=259?['worldAffiliation259','prisonerHistory259']:[]])||!object(l.pawn.orders)||!keys(l.pawn.orders,['active','queue'])||l.pawn.orders.active!==null||!dense(l.pawn.orders.queue,0)||!dense(l.pawn.path,0)||!object(l.pawn.recreation)||!dense(l.items,0)||!dense(l.packed,0)||!integer(l.pawn.id,1,c.nextId-1)||ids.has(l.pawn.id)||c.occupiedThingIds.has(l.pawn.id)||factions.get(l.factionId)!.leaderOwnerId!==l.pawn.id)return ['Invalid physical faction leader owner.'];leaders.set(l.factionId,l.pawn.id);ids.add(l.pawn.id);humanIds.add(l.pawn.id);}
 const errors:string[]=[];for(const l of (value as unknown as WorldFactionRegistry256).leaders){
  // The real prospective constructor owns its inert wander toggle. A detached
  // faction leader cannot acquire a local mental job or skip personal validation.
  if(Object.hasOwn(l.pawn,'mental')&&(!l.pawn.mental||!validMentalShape(l.pawn.mental,version,l.clock,c.width,c.height)||Object.hasOwn(l.pawn.mental,'crisis')))return ['Invalid detached faction leader mental owner.'];
  const p=l.pawn;if(p.worldAffiliation259&&(!validWorldAffiliationForeignKeys259(p,value as unknown as WorldFactionRegistry256)||p.worldAffiliation259.factionId!==l.factionId||p.worldAffiliation259.hostFactionId!==null||p.worldAffiliation259.guestStatus!=='Guest'))return ['Invalid leader faction/host foreign key.'];const context={width:c.width,height:c.height,tick:l.clock,nextId:c.nextId,schemaVersion:version as World['schemaVersion']};
  const personalErrors=validateDetachedPawnRecordShape(p as unknown as Record<string,unknown>,context,version,l.clock);if(personalErrors.length)return personalErrors;
  if((hasCoupleFields285(p)||hasPartyMemoryField292(p))&&!validCouplePawnContext285(p,{version,tick:l.clock,nextId:c.nextId,knownHumanIds:humanIds}))errors.push('Invalid faction leader couple clock or memory.');
  errors.push(...validatePawnHealthRecord(p,context),...validateRecreationRecordShape(p as unknown as Record<string,unknown>,version,l.clock),...validateHumanSocial(p,version,l.clock,humanIds,[]));
  if(p.foodPolicyId!==1||p.apparelPolicyId!==1||typeof p.apparelAutomation!=='boolean'||!integer(p.nextApparelCheckAt,0,l.clock+APPAREL_POLICY_INTERVAL.max)||!integer(p.restZeroTicks,0,4500)||typeof p.collapsePending!=='boolean'||p.collapsePending&&(p.rest>=.01||p.restZeroTicks<=100)||!validSchedule(p.schedule)||p.jobId!==null||p.haul!==null||p.cooking!==null||p.need!==null||p.bedId!==null||p.path.length||p.moveCooldown||p.orders.active!==null||p.orders.queue.length||p.recreation.task!==null)errors.push('Faction leader retains local work.');
 }
 for(const [id,a] of factions)if(a.leaderOwnerId!==null&&leaders.get(id)!==a.leaderOwnerId)errors.push('Faction leader reference lacks its physical owner.');
 return errors;
}
