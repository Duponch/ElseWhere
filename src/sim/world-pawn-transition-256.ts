import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {worldPawnsPhysicalCore297,worldPawnPhysicalCore297} from './world-pawn-physical-clock-297.ts';
import {isSchema287OrLater} from './schema-compatibility-257.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {isColonist} from './affiliation.ts';
import {validMechanicalWorldPawn259} from './world-pawn-mechanical-259.ts';
import {nativeWorldPawnOrderCurrent256,commitNativeWorldPawnOrder256} from './world-pawn-native-order-256.ts';
import {passNativeWorldPawnOrder256} from './native-world-pawn-order-256.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {cancelWorldPawnGC256} from './world-pawn-gc-256.ts';
import {autoTendWorldPawn256} from './world-pawn-auto-tend-256.ts';
import {groupPawnInterval256} from './group-core-cadence-256.ts';
import {deadWorldPawn256,terminalWorldPawn256,type WorldPawnsState256,type WorldPawnOwner256} from './world-pawn-state-256.ts';
import {WORLD_FACTION_DEFINITIONS_256} from './world-faction-catalog.ts';
import type {WorldFactionRegistry256} from './world-faction-state.ts';
/** These flags belong to actual faction INSTANCES. The current registry has
 * no defeated/temporary authority, so callers cannot derive them from names. */
export interface WorldPawnFactionCondition256 {factionId:number;defeated:boolean;temporary:boolean;techLevel:number}
export interface WorldPawnPassRandom256 {float(min:number,max:number):number}
const f=Math.fround;
/** Ordered IEnumerable reservoir; first positive is draw-free. */
function factionChoice(registry:WorldFactionRegistry256,conditions:readonly WorldPawnFactionCondition256[],medieval:boolean,allowDefeated:boolean,r:WorldPawnPassRandom256):number|null {
 let choice:number|null=null,total=0;
 for(const faction of registry.factions){const d=WORLD_FACTION_DEFINITIONS_256[faction.def],condition=conditions.find(c=>c.factionId===faction.id)!;
  if(d.player||faction.hidden||!d.humanlike||condition.temporary||!allowDefeated&&condition.defeated)continue;
  const weight=f(medieval&&condition.techLevel<3?.1:1);if(choice===null){choice=faction.id;total=weight;continue;}const next=f(total+weight);if(r.float(0,next)>=total)choice=faction.id;total=next;
 }return choice;
}
export type PassedWorldPreparation256={ok:true;row:WorldPawnOwner256;commit():void}|{ok:false;reason:string};
/** The input is the original AFTER true DeSpawn/StopDead/drop cleanup. It is
 * never a projection taken from an already frozen historical archive. The
 * caller's outer removal transaction owns detachment and its staged RNG. */
export function preparePassedToWorld256(state:WorldPawnsState256,input:WorldPawnOwner256,registry:WorldFactionRegistry256,random:WorldPawnPassRandom256,options:WorldPawnEntryOptions256={}):PassedWorldPreparation256 {
 const version297=options.version??256,physicalState297=worldPawnsPhysicalCore297(state,version297),physicalRow297=worldPawnPhysicalCore297(input,version297);
 if(!Number.isSafeInteger(physicalState297)||!Number.isSafeInteger(physicalRow297)||physicalRow297>physicalState297||input.mode==='active'&&physicalRow297!==physicalState297)return {ok:false,reason:'Invalid actual owned physical PassedToWorld frontier'};
 const nativeBefore=state.nativeOrder;if(!nativeWorldPawnOrderCurrent256(state,nativeBefore))return {ok:false,reason:'Actual native WorldPawn order is not mutable/admitted'};
 if(!plainWorldPawnData256(input))return {ok:false,reason:'PassedToWorld requires admitted original data'};
 if(input.kind==='human'&&(input.actor.visitor||input.actor.podRescue||input.actor.raid||input.actor.prisoner&&!((options.version===259||options.version===260||(options.version===261||(Number(options.version)===262||isSchema263OrLater(Number(options.version)))))&&input.actor.worldAffiliation259?.guestStatus==='Prisoner')))return {ok:false,reason:'Actual guest HostFaction history must remain with its existing owner'};
 if(Object.hasOwn(input,'destroyed')&&(input.destroyed!==true||input.mode!=='dead'||deadWorldPawn256(input)||input.items.length||input.packed.length))return {ok:false,reason:'Destroyed original cannot carry possessions or invent clinical death'};
 if((input.mode==='dead')!==terminalWorldPawn256(input))return {ok:false,reason:'PassedToWorld terminal mode does not match its original'};
 if(!Object.isExtensible(input.actor)||Reflect.ownKeys(input.actor).some(k=>{const d=Object.getOwnPropertyDescriptor(input.actor,k)!;return !Object.hasOwn(d,'value')||!d.writable||!d.configurable;}))return {ok:false,reason:'PassedToWorld requires its mutable original'};
 if(!Object.isExtensible(state.owners)||!Object.getOwnPropertyDescriptor(state.owners,'length')?.writable)return {ok:false,reason:'PassedToWorld requires its mutable actual registry'};
 if(state.owners.some(r=>r.actor===input.actor||r.actor.id===input.actor.id))return {ok:false,reason:'Actual Pawn already has a WorldPawn owner'};
 if(input.clockCore>state.atCore||input.mode==='active'&&input.clockCore!==state.atCore||input.mode!=='active'&&input.mode!=='dead'||input.startingPawnLeftBehind&&(input.kind!=='human'||input.keepForever!==true))return {ok:false,reason:'Invalid true PassedToWorld frontier'};
 const effects=prepareWorldPawnEntryEffects256(input,isCorePhysicalSchema297(version297)?physicalRow297:state.atCore,registry,random,options);if(!effects.ok)return effects;const row=effects.row;
 // Actual present colonist at this true PassToWorld only, before SetFaction.
 // This supplies no past history to a load/migration or an already foreign row.
 if((options.version===259||options.version===260||(options.version===261||(Number(options.version)===262||isSchema263OrLater(Number(options.version)))))&&input.kind==='human'&&row.kind==='human'&&!terminalWorldPawn256(input)&&isColonist(input.actor)&&!input.actor.prisoner&&!input.actor.visitor&&!input.actor.podRescue&&!input.actor.raid&&input.actor.worldAffiliation259?.factionId===registry.playerFactionId&&input.actor.worldAffiliation259.hostFactionId===null&&input.actor.worldAffiliation259.guestStatus==='Guest')row.everColonist=true;
 const nativeAfter=nativeBefore?passNativeWorldPawnOrder256(nativeBefore,input.actor.id,terminalWorldPawn256(input)):undefined;
 const atBefore=state.atCore,originals=state.owners.slice(),before=JSON.stringify(input),prepared=JSON.stringify(row);let used=false;
 return {ok:true,row,commit(){if(used||!nativeWorldPawnOrderCurrent256(state,nativeBefore)||state.atCore!==atBefore||worldPawnsPhysicalCore297(state,version297)!==physicalState297||JSON.stringify(input)!==before||JSON.stringify(row)!==prepared||state.owners.length!==originals.length||state.owners.some((r,i)=>r!==originals[i]))throw Error('Stale PassedToWorld transaction');used=true;cancelWorldPawnGC256(state);
  const original=input.actor,history=input.kind==='human'?input.actor.prisonerHistory259:undefined;for(const k of Object.keys(original))delete (original as unknown as Record<string,unknown>)[k];Object.assign(original,row.actor);if(history&&row.kind==='human')row.actor.prisonerHistory259=history;row.actor=original;if(history&&row.kind==='human')row.actor.prisonerHistory259=history;row.items=input.items;row.packed=input.packed;state.owners.push(row);commitNativeWorldPawnOrder256(state,nativeBefore,nativeAfter);
 }};
}

export type WorldPawnEntryOptions256={conditions?:readonly WorldPawnFactionCondition256[];extraHomeFactionId?:number|null;situation?:import('./world-pawn-capture-256.ts').ActualWorldPawnSituation256;version?:number};
/** Per-original entry ONLY. Registry ownership is a separate actual commit. */
export function prepareWorldPawnEntryEffects256(input:WorldPawnOwner256,atCore:number,registry:WorldFactionRegistry256,random:WorldPawnPassRandom256,options:WorldPawnEntryOptions256={}):{ok:true;row:WorldPawnOwner256}|{ok:false;reason:string}{
 const oldFaction=input.factionId===null?undefined:registry.factions.find(r=>r.id===input.factionId);
 if(input.factionId!==null&&!oldFaction)return {ok:false,reason:'PassedToWorld lacks actual faction foreign key'};
 if(input.startingPawnLeftBehind&&input.factionId!==registry.playerFactionId)return {ok:false,reason:'StartingPawnLeftBehind must retain real player faction'};
 if(input.kind==='animal'&&!input.actor.growthTracker)return {ok:false,reason:'Historical animal stays in its literal historical owner'};
 const row=structuredClone(input);
 if(row.kind==='animal')delete row.actor.animalThermalRefuge288;

 if(row.kind==='mechanical'){
  if((options.version!==259&&options.version!==260&&(options.version!==261&&(Number(options.version)!==262&&!isSchema263OrLater(Number(options.version)))))||options.situation!=='Free'||!validMechanicalWorldPawn259(row,Number(options.version),registry)||typeof row.enteredAtAbsCore!=='number'||!Number.isSafeInteger(row.enteredAtAbsCore)||row.enteredAtAbsCore<0)return {ok:false,reason:'Mechanical PassedToWorld requires its actual cleaned original, faction and DeSpawn clock'};
  delete row.free;if(!terminalWorldPawn256(row))row.free=true;return {ok:true,row};
 }
 if(options.situation!=='CaravanMember'&&!terminalWorldPawn256(row)&&row.actor.health&&groupPawnInterval256(row.actor.id,atCore,7500,1))for(let n=0;n<30;n++)autoTendWorldPawn256(row.actor.health,Number(options.version),()=>random.float(0,1));
 let factionId=row.factionId;
 const free=!row.startingPawnLeftBehind&&!terminalWorldPawn256(row),change=free&&(row.kind==='human'&&factionId===null||oldFaction&&(WORLD_FACTION_DEFINITIONS_256[oldFaction.def].player||oldFaction.def==='Ancients'||oldFaction.def==='AncientsHostile'));
 if(change&&!row.startingPawnLeftBehind&&options.situation===undefined)return {ok:false,reason:'PassedToWorld faction change requires its actual situation authority'};
 if(change&&options.situation==='Free'){
  const extra=options.extraHomeFactionId===undefined?undefined:options.extraHomeFactionId===null?null:registry.factions.find(r=>r.id===options.extraHomeFactionId);
  if(options.extraHomeFactionId!==undefined&&options.extraHomeFactionId!==null&&!extra)return {ok:false,reason:'Unknown actual extra home faction'};
  if(extra&&!WORLD_FACTION_DEFINITIONS_256[extra.def].player)factionId=extra.id;
  else {const conditions=options.conditions;
   if(!conditions||conditions.length!==registry.factions.length||new Set(conditions.map(c=>c.factionId)).size!==conditions.length||conditions.some(c=>!registry.factions.some(f=>f.id===c.factionId)||typeof c.defeated!=='boolean'||typeof c.temporary!=='boolean'||!Number.isInteger(c.techLevel)||c.techLevel<0||c.techLevel>7))return {ok:false,reason:'Missing actual faction instance conditions for PassedToWorld'};
   const medieval=oldFaction!==undefined&&conditions.find(c=>c.factionId===oldFaction.id)!.techLevel>=3;
   factionId=factionChoice(registry,conditions,medieval,false,random);if(factionId===null)factionId=factionChoice(registry,conditions,medieval,true,random);
  }
  if(row.kind==='animal'&&row.actor.domestic&&factionId!==registry.playerFactionId&&(options.version!==259&&options.version!==260&&(options.version!==261&&(Number(options.version)!==262&&!isSchema263OrLater(Number(options.version))))))return {ok:false,reason:'Actual SetFaction of a domesticated animal needs its non-player domestic owner adapter'};
 }
 row.factionId=factionId;
 if(isSchema287OrLater(options.version)&&row.kind==='animal'&&factionId!==input.factionId){delete row.actor.animalMapAreas287;delete row.actor.animalAreaReturn287;}
 if(row.kind==='human'&&row.actor.worldAffiliation259){row.actor.worldAffiliation259={...row.actor.worldAffiliation259,factionId};if(factionId!==input.factionId){const def=registry.factions.find(f=>f.id===factionId)?.def;row.actor.faction=def&&WORLD_FACTION_DEFINITIONS_256[def].player?'colony':def&&(WORLD_FACTION_DEFINITIONS_256[def].permanentEnemy||WORLD_FACTION_DEFINITIONS_256[def].naturalEnemy)?'outlaws':'outlanders';}}
 // Only the actual caller supplying Free may produce this durable authority.
 delete row.free;if(options.situation==='Free'&&!terminalWorldPawn256(row)&&!row.startingPawnLeftBehind)row.free=true;
 if(options.situation!=='CaravanMember'&&row.kind==='animal'){delete row.actor.manhunter;delete row.actor.confusion;if(row.actor.wander){delete row.actor.wander.job;row.actor.wander.nextMoveOrderIsWait=true;}}
 else if(options.situation!=='CaravanMember'&&row.kind==='human'&&row.actor.mental?.crisis)return {ok:false,reason:'Actual human ClearMind mental interruption must complete before PassedToWorld'};
 // The caller captures enteredAtAbsCore BEFORE this preparation, from its
 // actual GenTicks equivalent. Never replace it with local tick/calendar data.
 if(typeof row.enteredAtAbsCore!=='number'||!Number.isSafeInteger(row.enteredAtAbsCore)||row.enteredAtAbsCore<0)return {ok:false,reason:'Missing absolute PassedToWorld entry clock'};
 return {ok:true,row};
}
