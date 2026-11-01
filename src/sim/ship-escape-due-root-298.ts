import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {registeredCampaign,registeredMap,registeredMapId,hasLoadedRoot,isActualMapMutationContext298} from './world-map-context.ts';
import {wasShipRootDestroyed298,type ShipRootDestructionProof298} from './ship-root-destruction-proof-298.ts';
import type {EscapeCampaign298} from './ship-escape-state-298.ts';
import type {ShipEscapeLaunchCapture298,ShipEscapePhysicalServices298} from './ship-escape-physical-298.ts';
import type {World} from './types.ts';

type DueSelection298=ReturnType<ShipEscapePhysicalServices298['prepareDueRoot']>;
const fail298=(reason:string):DueSelection298=>({ok:false,reason});

/** Internal selection only. The coordinator separately proves its exact due
 * token/epoch and WeakSet-issued capture, then preflights physical retirement.
 * registeredMap may refresh its real cache here, never in current(). */
export function prepareShipEscapeDueRoot298(owner:EscapeCampaign298,capture:ShipEscapeLaunchCapture298,proof:ShipRootDestructionProof298,physicalCore298:number):DueSelection298 {
 try{
  const original=capture.originalRoot,mapId=capture.mapId,computerId=capture.computerId;
  const startedAt=capture.startedAt,startedAtCore=capture.startedAtCore298,originKind=capture.originKind298,originTile=capture.originTile298;
  if(!isSchema298OrLater(Number(owner.schemaVersion))||registeredCampaign(owner)!==owner||capture.owner!==owner||proof.original!==original||original.kind!=='ship-computer'||original.id!==computerId
   ||!Number.isSafeInteger(mapId)||mapId<0||!Number.isSafeInteger(computerId)||computerId<1||!Number.isSafeInteger(physicalCore298)||physicalCore298<0
   ||!Number.isSafeInteger(startedAt)||startedAt<0||!Number.isSafeInteger(startedAtCore)||startedAtCore<0||Math.floor(startedAtCore/10)!==startedAt
   ||physicalCore298<startedAtCore||owner.tick<startedAt||originKind!=='registered-map'&&originKind!=='monomap'
   ||originTile!==null&&(!Number.isSafeInteger(originTile)||originTile<0)||effectiveCore297(owner)!==physicalCore298)return fail298('La racine ou la frontière physique ne correspond pas à la capture interne.');
  const frontierCurrent=()=>{
   try{return isSchema298OrLater(Number(owner.schemaVersion))&&registeredCampaign(owner)===owner&&capture.owner===owner&&capture.originalRoot===original&&proof.original===original
    &&capture.mapId===mapId&&capture.computerId===computerId&&original.id===computerId&&original.kind==='ship-computer'&&capture.startedAt===startedAt&&capture.startedAtCore298===startedAtCore
    &&capture.originKind298===originKind&&capture.originTile298===originTile&&effectiveCore297(owner)===physicalCore298;}catch{return false;}
  };
  // A real destruction fact is read BEFORE map resolution. A retired/absent
  // map must not turn this already attested fact back into a lookup failure.
  if(wasShipRootDestroyed298(owner,proof))return {ok:true,source:{kind:'known-destroyed',current:()=>frontierCurrent()&&wasShipRootDestroyed298(owner,proof)}};

  const registry=owner.worldMaps,planet=owner.planet;
  const record=originKind==='registered-map'?registry?.sites.find(row=>row.id===mapId):undefined;
  if(originKind==='registered-map'?!registry||!record||record.tile!==originTile:registry!==undefined||mapId!==0||originTile===null||planet?.homeTile!==originTile)return fail298('La carte d’origine réelle n’est plus disponible sans preuve de destruction.');
  const body=record?(mapId===registry!.rootMapId&&hasLoadedRoot(owner)?owner:record.map):owner;
  if(!body)return fail298('Le corps réel de la carte d’origine est indisponible.');
  const world=registeredMap(owner,mapId);
  if(!world||!isActualMapMutationContext298(owner,world)||registeredMapId(world)!==mapId||!world.structures.includes(original))return fail298('L’original accepté est absent du vrai contexte local ; sa destruction n’est pas prouvée.');
  const bodyStructures=(body as World).structures;
  const structures=world.structures,seed=world.seed,width=world.width,height=world.height,climate=world.climate,site=world.site,scenario=world.scenario;
  const originCurrent=()=>originKind==='registered-map'
   ?owner.worldMaps===registry&&!!record&&registry!.sites.includes(record)&&record.id===mapId&&record.tile===originTile&&(mapId===registry!.rootMapId&&hasLoadedRoot(owner)?owner:record.map)===body
   :owner.worldMaps===undefined&&owner.planet===planet&&planet?.homeTile===originTile&&world===owner;
  const current=()=>{
   try{return frontierCurrent()&&!wasShipRootDestroyed298(owner,proof)&&originCurrent()&&isActualMapMutationContext298(owner,world)&&registeredCampaign(world)===owner&&registeredMapId(world)===mapId
    &&(body as World).structures===bodyStructures&&world.seed===seed&&world.width===width&&world.height===height&&world.climate===climate&&world.site===site&&world.scenario===scenario&&world.structures===structures&&structures.includes(original);}catch{return false;}
  };
  if(!current())return fail298('La sélection de la racine a changé pendant sa préparation.');
  return {ok:true,source:{kind:'network',world,originalRoot:original,current}};
 }catch(error){return fail298(error instanceof Error?error.message:'La sélection physique interne a échoué.');}
}
