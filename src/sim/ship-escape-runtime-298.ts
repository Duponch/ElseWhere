import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {registeredCampaign,registeredMapId,boundWorldGroup} from './world-map-context.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {indexShipParts276,connectedShipParts276,readShipAssembly276} from './ship-part-reader-276.ts';
import {isShipCasket277} from './ship-casket-state-277.ts';
import {validateShipCasketOwners277,validateRetainedShipCasketOwner277} from './ship-casket-owner-save-277.ts';
import {captureHumanOwners} from './human-owners.ts';
import {sealRemovalOriginal259} from './map-removal-writes-259.ts';
import {prepareShipEscapeAliases298,previewDetachedShipCasket298} from './ship-escape-aliases-298.ts';
import {prepareShipEscapePhysical298,type ShipEscapePhysicalServices298,type ShipEscapeDueRoot298,type ShipEscapeLaunchCapture298} from './ship-escape-physical-298.ts';
import {validEscapedShipsEnvelope298} from './ship-escape-save-298.ts';
import {SHIP_ESCAPE_HISTORY_LIMIT_298,type EscapeCampaign298,type EscapedShips298,type EscapedShip298,type ShipEscapeReceipt298,type ShipEscapeResult298} from './ship-escape-state-298.ts';
import type {World} from './types.ts';

const preparedLaunches=new WeakSet<ShipEscapeLaunchCapture298>();
const fail=(reason:string):{ok:false;reason:string}=>({ok:false,reason});
const ownWritable=(object:object,key:string)=>{const d=Object.getOwnPropertyDescriptor(object,key);return d?d.enumerable===true&&Object.hasOwn(d,'value')&&d.writable===true:Object.isExtensible(object);};
/** Uses actual owner metadata. It does not create/cache a map or a retired record. */
function launchOrigin(w:World,root:EscapeCampaign298,mapId:number){
 if(boundWorldGroup(w))return fail('Un contexte de groupe n’est pas une carte de départ.');
 const registry=root.worldMaps;
 if(registry){
  const record=registry.sites.find(m=>m.id===mapId);if(!record)return fail('La carte réelle du départ est absente.');
  const tile=record.tile;
  return {ok:true as const,originKind298:'registered-map' as const,originTile298:tile,current:()=>root.worldMaps===registry&&registry.sites.includes(record)&&record.id===mapId&&record.tile===tile};
 }
 const planet=root.planet,tile=planet?.homeTile;
 if(mapId!==0||w!==root||!Array.isArray(w.tiles)||!Number.isSafeInteger(tile)||Number(tile)<0)return fail('Le départ exige une carte originale et sa provenance réelle.');
 return {ok:true as const,originKind298:'monomap' as const,originTile298:tile!,current:()=>root.worldMaps===undefined&&root.planet===planet&&planet?.homeTile===tile&&w===root&&Array.isArray(w.tiles)};
}
function inspectLaunch(w:World,computerId:number){
 const root=registeredCampaign(w) as EscapeCampaign298,mapId=registeredMapId(w),state=root.escapedShips298;
 if(!isSchema298OrLater(Number(root.schemaVersion))||mapId===undefined)return fail('Le départ exige le domaine physique 298 actuel.');
 const origin=launchOrigin(w,root,mapId);if(!origin.ok)return origin;
 const core=effectiveCore297(root);
 if(!validEscapedShipsEnvelope298(root,298,root.tick,root.nextId,core))return fail('Le registre des départs est invalide.');
 const indexed=indexShipParts276(w.structures,w.width,w.height);if(!indexed.ok)return fail('Le réseau physique du vaisseau est invalide.');
 const computer=indexed.index.get(computerId);if(String(computer?.kind)!=='ship-computer')return fail('L’ordinateur de vaisseau original est absent.');
 const graph=connectedShipParts276(indexed.index,computerId),report=readShipAssembly276(indexed.index,computerId);
 if(!graph.ok||!report.ok)return fail('L’ordinateur n’appartient plus à son réseau.');
 if(report.missing.length)return fail(`Pièces manquantes : ${report.missing.map(r=>`${r.label} (${r.missing})`).join(', ')}.`);
 if(!report.occupiedCaskets)return fail('Au moins un caisson spatial doit être réellement occupé.');
 const parts=graph.parts.map(p=>p.source),partIds=new Set(parts.map(p=>p.id));
 for(const s of parts)if(s.kind==='ship-reactor'&&s.shipReactor275?.state!=='running')return fail(s.shipReactor275?.state==='starting'?'Le démarrage du réacteur n’est pas terminé.':'Un réacteur relié hiberne encore.');
 const casketErrors=validateShipCasketOwners277(w);if(casketErrors.length)return fail(casketErrors[0]!);
 return {ok:true as const,root,mapId,state,parts,partIds,origin,core,originalRoot:computer!.source};
}
/** Command/explicit inspection only. Never scan this graph on every wake. */
export function readShipLaunch298(w:World,computerId:number):{ok:false;reason:string}|{ok:true;mapId:number;computerId:number;partIds:number[]} {
 const r=inspectLaunch(w,computerId);if(!r.ok)return r;
 if(r.state?.credits!==null&&r.state?.credits!==undefined)return fail('Fermez les crédits du précédent départ.');
 return {ok:true,mapId:r.mapId,computerId,partIds:[...r.partIds]};
}
function stateCurrent(root:EscapeCampaign298,state:EscapedShips298|undefined){
 const d=Object.getOwnPropertyDescriptor(root,'escapedShips298');return state?!!d&&Object.hasOwn(d,'value')&&d.value===state:!d&&!('escapedShips298'in root);
}
function stateStamp(state:EscapedShips298|undefined){
 if(!state)return ()=>true;
 const next=state.nextId,credits=state.credits,departures=state.departures,receipts=state.receipts,ds=[...departures],rs=[...receipts];
 return ()=>state.nextId===next&&state.credits===credits&&state.departures===departures&&state.receipts===receipts&&departures.length===ds.length&&receipts.length===rs.length&&departures.every((e,i)=>e===ds[i])&&receipts.every((e,i)=>e===rs[i]);
}
function writeState(root:EscapeCampaign298,state:EscapedShips298):void {
 const d=Object.getOwnPropertyDescriptor(root,'escapedShips298');Object.defineProperty(root,'escapedShips298',d?{...d,value:state}:{value:state,writable:true,enumerable:true,configurable:true});
}
/** Permission at expiry is about an actual physical selection, NOT about
 * whether this changed network would pass initial LaunchFailReasons again. */
function prepareFinalDeparture(root:EscapeCampaign298,p:ShipEscapeLaunchCapture298,source:ShipEscapeDueRoot298,core:number,services:ShipEscapePhysicalServices298){
 const state=root.escapedShips298,id=state?.nextId??1;
 if(!preparedLaunches.has(p)||p.owner!==root||!ownWritable(root,'escapedShips298')||!source.current())throw Error('Stale final escape owner or recipient');
 const tick=root.tick,rng=root.rng,nextId=root.nextId,registry=root.worldMaps,planet=root.planet,homeTile=planet?.homeTile;
 const stateDescriptor=Object.getOwnPropertyDescriptor(root,'escapedShips298'),priorCurrent=stateStamp(state);
 const descriptorCurrent=()=>{const d=Object.getOwnPropertyDescriptor(root,'escapedShips298');return stateDescriptor?!!d&&Object.hasOwn(d,'value')&&d.value===stateDescriptor.value&&d.writable===stateDescriptor.writable&&d.enumerable===stateDescriptor.enumerable&&d.configurable===stateDescriptor.configurable:!d&&!('escapedShips298'in root);};
 const siteRecord=registry?.sites.find(m=>m.id===p.mapId),retiredRecord=registry?.retired.find(m=>m.id===p.mapId),meta=siteRecord??retiredRecord;
 if(p.originKind298==='registered-map'?!meta||meta.tile!==p.originTile298:p.mapId!==0||p.originTile298===null||p.originTile298!==homeTile)throw Error('Final escape origin provenance differs from its accepted original');
 const originCurrent=()=>root.worldMaps===registry&&root.planet===planet&&(p.originKind298==='registered-map'?!!meta&&(siteRecord?registry?.sites.includes(siteRecord):retiredRecord?registry?.retired.includes(retiredRecord):false)&&meta.id===p.mapId&&meta.tile===p.originTile298:planet?.homeTile===homeTile);
 const baseCurrent=()=>preparedLaunches.has(p)&&isSchema298OrLater(Number(root.schemaVersion))&&root.tick===tick&&effectiveCore297(root)===core&&root.rng===rng&&root.nextId===nextId&&originCurrent()&&stateCurrent(root,state)&&descriptorCurrent()&&priorCurrent()&&source.current()&&ownWritable(root,'escapedShips298');
 let used=false;
 const common={id,mapId:p.mapId,computerId:p.computerId,departedAt:tick,departedAtCore298:core,originKind298:p.originKind298,originTile298:p.originTile298};
 if(source.kind==='known-destroyed'){
  // Fresh primary: Destroyed root => an empty final network. No original
  // elsewhere is detached, hidden or claimed. No clinical context is invented.
  const departure:EscapedShip298={...common,finalRoot298:'known-destroyed',parts:[],aliases:[]};
  const current=()=>!used&&baseCurrent();
  return {root,state,departure,current,commit(next:EscapedShips298):boolean{if(!current())return false;used=true;writeState(root,next);return true;}};
 }
 const w=source.world;
 if(registeredCampaign(w)!==root||registeredMapId(w)!==p.mapId||boundWorldGroup(w))throw Error('Final ship source is not its actual local map');
 const origin=launchOrigin(w,root,p.mapId);if(!origin.ok||origin.originKind298!==p.originKind298||origin.originTile298!==p.originTile298)throw Error('Final physical origin changed');
 const indexed=indexShipParts276(w.structures,w.width,w.height);if(!indexed.ok)throw Error('Final ship graph is malformed');
 const original=indexed.index.get(p.computerId);
 if(!original||source.originalRoot!==p.originalRoot||original.source!==p.originalRoot||!w.structures.includes(p.originalRoot))throw Error('Final root original lost its actual source');
 const graph=connectedShipParts276(indexed.index,p.computerId);if(!graph.ok||!graph.parts.length)throw Error('Final real network selection is invalid');
 const parts=graph.parts.map(part=>part.source);
 // No required-parts, Running, occupied-casket or all-colonists check here.
 const casketErrors=validateShipCasketOwners277(w);if(casketErrors.length)throw Error(casketErrors[0]!);
 const aliases=prepareShipEscapeAliases298(parts);if(!aliases.current())throw Error('Final occupant aliases are immutable');
 const physical=prepareShipEscapePhysical298(w,parts,core,services);if(!physical.ok)throw Error(physical.reason);
 const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:structuredClone(w.climate)}:{},...w.site?{site:structuredClone(w.site)}:{},...w.scenario?{scenario:structuredClone(w.scenario)}:{}};
 const humans=new Set(captureHumanOwners(w).people.keys());
 const clinical={...context,schemaVersion:w.schemaVersion,tick,phaseCore297:core%10,nextId,worldFactions:root.worldFactions,foodPolicies:root.foodPolicies,apparelPolicies:root.apparelPolicies,research:root.research};
 for(const c of parts.filter(isShipCasket277))if(c.shipCryptosleep277.occupant){const errors=validateRetainedShipCasketOwner277(previewDetachedShipCasket298(c),clinical,humans,tick,core);if(errors.length)throw Error(errors[0]!);}
 const structures=w.structures,all=[...structures],localContext={climate:w.climate,site:w.site,scenario:w.scenario};
 const scope={parts,context,...w.climate?{sourceClimate:w.climate}:{},...w.site?{sourceSite:w.site}:{},...w.scenario?{sourceScenario:w.scenario}:{}};
 const seal=sealRemovalOriginal259(scope,[],[]);
 const departure:EscapedShip298={...common,finalRoot298:'network',context,parts:[...parts],aliases:aliases.aliases};
 const current=()=>!used&&baseCurrent()&&origin.current()&&w.structures===structures&&structures.length===all.length&&structures.every((s,i)=>s===all[i])&&w.climate===localContext.climate&&w.site===localContext.site&&w.scenario===localContext.scenario&&seal(0)&&aliases.current()&&physical.current();
 return {root,state,departure,current,commit(next:EscapedShips298):boolean{if(!current())return false;
  // Every writable recipient/alias/physical reference was preflighted. False
  // is zero-write; after true only direct prepared ledger/alias writes follow.
  if(!physical.adopt())return false;used=true;aliases.commitPrepared();writeState(root,next);return true;
 }};
}
/** Prepare only the initial ordinary launch. No World field, attempt ID,
 * timer or archive is written. The Root coordinator must check this current
 * seal before starting its separate private session with capture.originalRoot. */
export function prepareShipLaunch298(w:World,computerId:number):{ok:false;reason:string}|{ok:true;capture:ShipEscapeLaunchCapture298;current():boolean} {
 try{
  const r=inspectLaunch(w,computerId);if(!r.ok)return r;
  const {root,state:prior,origin,core}=r;
  if(prior?.credits!==null&&prior?.credits!==undefined)return fail('Fermez les crédits du précédent départ.');
  if((prior?.receipts.length??0)>=SHIP_ESCAPE_HISTORY_LIMIT_298)return fail('Le registre des départs a atteint sa limite.');
  if(!ownWritable(root,'escapedShips298'))return fail('Le registre de départ n’est pas modifiable.');
  const tick=root.tick,rng=root.rng,nextId=root.nextId,stamp=stateStamp(prior);
  const structures=w.structures,all=[...structures],seal=sealRemovalOriginal259({parts:r.parts},[],[]);
  const capture:ShipEscapeLaunchCapture298=Object.freeze({owner:root,world:w,originalRoot:r.originalRoot,mapId:r.mapId,computerId,startedAt:tick,startedAtCore298:core,originKind298:origin.originKind298,originTile298:origin.originTile298});
  const current=()=>isSchema298OrLater(Number(root.schemaVersion))&&root.tick===tick&&effectiveCore297(root)===core&&root.rng===rng&&root.nextId===nextId&&origin.current()&&stateCurrent(root,prior)&&stamp()&&w.structures===structures&&structures.length===all.length&&structures.every((s,i)=>s===all[i])&&seal(0)&&ownWritable(root,'escapedShips298');
  if(!current())return fail('Le départ initial a changé avant sa préparation.');
  preparedLaunches.add(capture);return {ok:true,capture,current};
 }catch(error){return fail(error instanceof Error?error.message:'Le départ initial n’a pas pu être préparé.');}
}
/** A capture is not a due permission. Only the external Root coordinator may
 * call this after validating its exact private session token/owner/root/epoch.
 * No clock, final LaunchFailReasons or saved pending is consulted here.
 * current/commit run synchronously; false is zero World/physical writes and
 * true completes retirement, alias release and archive publication together. */
export function prepareShipDeparture298(input:EscapeCampaign298,capture:ShipEscapeLaunchCapture298,services:ShipEscapePhysicalServices298) {
 const root=registeredCampaign(input) as EscapeCampaign298;
 if(!preparedLaunches.has(capture)||capture.owner!==root||capture.originalRoot.id!==capture.computerId||String(capture.originalRoot.kind)!=='ship-computer')throw Error('Unknown or replaced private launch capture');
 const core=effectiveCore297(root),state=root.escapedShips298;
 if(!isSchema298OrLater(Number(root.schemaVersion))||!validEscapedShipsEnvelope298(root,298,root.tick,root.nextId,core))throw Error('Invalid final escape archive owner');
 if(core<capture.startedAtCore298||root.tick<capture.startedAt)throw Error('Final escape physical frontier precedes its captured launch');
 if(state?.credits!==null&&state?.credits!==undefined)throw Error('Final escape credits recipient is no longer available');
 if((state?.receipts.length??0)>=SHIP_ESCAPE_HISTORY_LIMIT_298)throw Error('Final escape archive capacity changed');
 const selected=services.prepareDueRoot(root,capture,core);if(!selected.ok)throw Error(selected.reason);
 const plan=prepareFinalDeparture(root,capture,selected.source,core,services),id=state?.nextId??1;
 const receipt:ShipEscapeReceipt298={id,mapId:capture.mapId,computerId:capture.computerId,at:root.tick,atCore298:core,outcome:'departed'};
 const next:EscapedShips298={revision:1,nextId:id+1,receipts:[...(state?.receipts??[]),receipt],departures:[...(state?.departures??[]),plan.departure],credits:id};
 const current=()=>preparedLaunches.has(capture)&&plan.state===state&&plan.current();
 return {departureId:id,current,commit():boolean{if(!current()||!plan.commit(next))return false;preparedLaunches.delete(capture);return true;}};
}
export function continueShipCredits298(input:EscapeCampaign298,departureId:number):ShipEscapeResult298 {
 const root=registeredCampaign(input) as EscapeCampaign298,s=root.escapedShips298;
 if(!s||s.credits!==departureId||!s.departures.some(e=>e.id===departureId)||!ownWritable(root,'escapedShips298'))return fail('Ces crédits ne sont plus ouverts.');
 writeState(root,{...s,credits:null});return {ok:true,resumeNormal:true};
}
