import {targetBuilding263,targetBuildingPlayerUse263,targetBuildingCanClaim263,targetBuildingCanDeconstruct263} from './world-target-building-263.ts';
import {isAncientNeutralKind256} from './ancient-monument-runtime-256.ts';
import {isLocalRoadProp256} from './local-road-props-256.ts';
import type {CommandResult,Structure,World} from './types.ts';
import { structureById } from './structure-navigation.ts';
type FactionWorld=Pick<World,'schemaVersion'|'worldFactions'>&Partial<Pick<World,'pawns'|'structures'>>;
export interface ClaimRoadPropCommand256 {type:'claim-road-prop';structureId:number}
/** Registry authority, never a conventional faction number or an inferred alias. */
export function roadPropPlayerFaction256(w:FactionWorld):number|undefined {
 const r=w.worldFactions;if(w.schemaVersion<256||!r||r.revision!==1||!Array.isArray(r.factions))return;
 const p=r.factions.find(f=>f&&f.id===r.playerFactionId);
 return p&&(p.def==='PlayerColony'||p.def==='PlayerTribe')?p.id:undefined;
}
export function roadPropCanRepair256(w:FactionWorld,s:Structure):boolean {
 if(targetBuilding263(w,s))return targetBuildingPlayerUse263(w,s);
 if(s.kind==='ship-chunk'||s.kind==='insect-hive')return false;
 if(s.kind==='glow-pod')return w.schemaVersion>=256&&s.factionId===roadPropPlayerFaction256(w);
 if(!(isLocalRoadProp256(s.kind)||Object.hasOwn(s,'factionId')&&isAncientNeutralKind256(s.kind)))return true;
 const player=roadPropPlayerFaction256(w);return player!==undefined&&s.factionId===player;
}
export function roadPropCanDeconstruct256(w:FactionWorld,s:Structure):boolean {
 if(targetBuilding263(w,s))return !!w.structures&&!!w.pawns&&targetBuildingCanDeconstruct263({schemaVersion:w.schemaVersion,worldFactions:w.worldFactions,structures:w.structures,pawns:w.pawns},s);
 if(s.kind==='insect-hive')return false;
 if(s.kind==='glow-pod')return w.schemaVersion>=256&&(s.factionId===null||s.factionId===roadPropPlayerFaction256(w));
 if(s.kind==='ship-chunk')return w.schemaVersion>=256&&s.factionId===null;
 // Core neutral ClaimableBy permits deconstruction without first claiming.
 // Foreign ownership has no producer in this admitted prop domain.
 return !(isLocalRoadProp256(s.kind)||Object.hasOwn(s,'factionId')&&isAncientNeutralKind256(s.kind))||w.schemaVersion>=256&&(s.factionId===null||roadPropCanRepair256(w,s));
}
export function roadPropCanClaim256(w:FactionWorld,s:Structure):boolean {
 if(targetBuilding263(w,s))return !!w.structures&&!!w.pawns&&targetBuildingCanClaim263({schemaVersion:w.schemaVersion,worldFactions:w.worldFactions,structures:w.structures,pawns:w.pawns},s);
 return (s.kind==='glow-pod'||isLocalRoadProp256(s.kind)||Object.hasOwn(s,'factionId')&&isAncientNeutralKind256(s.kind))&&s.factionId===null&&roadPropPlayerFaction256(w)!==undefined;
}
export function claimRoadProp256(w:World,value:unknown):CommandResult {
 if(!value||typeof value!=='object'||Array.isArray(value))return {ok:false,code:'invalid-command',reason:'Commande de revendication invalide.'};
 const d=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(value).length!==2||!d.type||!('value'in d.type)||d.type.value!=='claim-road-prop'
   ||!d.structureId||!('value'in d.structureId)||!Number.isSafeInteger(d.structureId.value)||d.structureId.value<1)
  return {ok:false,code:'invalid-command',reason:'Commande de revendication invalide.'};
 const s=structureById(w,d.structureId.value);
 if(!s||!(targetBuilding263(w,s)||s.kind==='glow-pod'||isLocalRoadProp256(s.kind)||Object.hasOwn(s,'factionId')&&isAncientNeutralKind256(s.kind)))return {ok:false,code:'missing-target',reason:'Vestige routier absent de cette carte.'};
 if(!roadPropCanClaim256(w,s))return {ok:false,code:'invalid-command',reason:'Vestige non neutre ou faction du joueur non confirmée.'};
 s.factionId=roadPropPlayerFaction256(w)!;return {ok:true};
}
