import {isSchema298OrLater} from './schema-compatibility-257.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {roofCollapseProjection256} from './roof-collapse-projection-256.ts';
import {retireShipWorkDraft298} from './ship-work-retirement-draft-298.ts';
import {reconcilePower} from './power.ts';
import {prepareRemovedFogStructure256,commitRemovedFogBlocker256} from './exploration-runtime-256.ts';
import {reconcileTemperature} from './temperature.ts';
import {invalidateAnimalPens} from './animal-pens.ts';
import {registeredCampaign,registeredMapId,captureLocalMap,hasLoadedRoot,isActualMapMutationContext298} from './world-map-context.ts';
import {sealRemovalOriginal259} from './map-removal-writes-259.ts';
import {validShipCasketField277} from './ship-casket-state-277.ts';
import type {CampaignState} from './world-map-state.ts';
import type {Structure,World} from './types.ts';

export type ShipPhysicalRemoval298={ok:false;reason:string}|{ok:true;current():boolean;adopt():boolean};
type Data298=Record<string,unknown>;
const kinds298=new Set(['ship-beam','ship-engine','ship-reactor','ship-computer','ship-sensors','ship-cryptosleep-casket']);
// Exact local slots committed by the qualified projection. No campaign archive,
// loss ledger, deadline, geography, post stock or permission lives here.
const localSlots298=['pawns','resources','structures','jobs','piles','packed','stockpiles','growingZones','events','tiles',
 'startingArrival','roofing','economy','destroyed','stock','spoiled','deconstructed','tailoring','hunting','bombWaves','firefoam290','growingCursor',
 'thermal','wildlife','mechanoids','filth','fires','exploration','party292'] as const;
const descriptor298=(o:object,k:PropertyKey)=>Object.getOwnPropertyDescriptor(o,k);
const sameDescriptor298=(a:PropertyDescriptor|undefined,b:PropertyDescriptor|undefined)=>!a?!b:!!b&&Object.hasOwn(a,'value')&&Object.hasOwn(b,'value')&&Object.is(a.value,b.value)&&a.enumerable===b.enumerable&&a.configurable===b.configurable&&a.writable===b.writable;
const writable298=(o:object,k:PropertyKey,present:boolean)=>{const d=descriptor298(o,k);return d?Object.hasOwn(d,'value')&&(present?d.writable===true:d.configurable===true):!present||!(k in o)&&Object.isExtensible(o);};
const encoded298=(v:unknown)=>JSON.stringify(v);

/** INTERNAL actual retirement service, not launch admission or a saved receipt.
 * All callbacks operate only on an owned projection. A refused draft is thrown
 * away, including any earlier draft cleanup. No clock step or clinical death.
 * The Root coordinator separately owns the due token, archive and credits. */
export function prepareShipPhysicalRemoval298(expectedOwner:CampaignState,world:World,parts:readonly Structure[],physicalCore298:number):ShipPhysicalRemoval298 {
 const fail=(reason:string):ShipPhysicalRemoval298=>({ok:false,reason});
 try{
  if(!isSchema298OrLater(Number(expectedOwner.schemaVersion))||!isSchema298OrLater(Number(world.schemaVersion))||registeredCampaign(expectedOwner)!==expectedOwner
   ||!isActualMapMutationContext298(expectedOwner,world)||!Number.isSafeInteger(physicalCore298)||physicalCore298<0||effectiveCore297(expectedOwner)!==physicalCore298||effectiveCore297(world)!==physicalCore298)
   return fail('Le propriétaire ou la frontière physique réelle du retrait est invalide.');
  const registry=expectedOwner.worldMaps,mapId=registeredMapId(world),record=registry?.sites.find(r=>r.id===mapId),planet=expectedOwner.planet;
  const body=registry?(record&&(mapId===registry.rootMapId&&hasLoadedRoot(expectedOwner)?expectedOwner:record.map)):world;
  if(mapId===undefined||!body||registry&&!record||!registry&&(world!==expectedOwner||mapId!==0))return fail('Le corps actif original de la carte est indisponible.');
  if(!parts.length||new Set(parts).size!==parts.length||new Set(parts.map(p=>p.id)).size!==parts.length
   ||parts.some(p=>!kinds298.has(p.kind)||!Number.isSafeInteger(p.id)||p.id<1||p.id>=expectedOwner.nextId||!world.structures.includes(p)||!validShipCasketField277(p,298,world.tick,physicalCore298)))
   return fail('Les parties ne sont pas les originaux spatiaux distincts de cette carte.');
  const originals=[...parts],ids=new Set(originals.map(p=>p.id)),sourceStructures=world.structures,sourceTiles=world.tiles;
  const rng=expectedOwner.rng,nextId=expectedOwner.nextId,seed=world.seed,width=world.width,height=world.height;
  const local=captureLocalMap(world) as unknown as Data298,keys=Reflect.ownKeys(local),sourceDescriptors=keys.map(k=>descriptor298(world,k));
  const bodyDescriptors=localSlots298.map(k=>descriptor298(body,k)),worldDescriptors=localSlots298.map(k=>descriptor298(world,k));
  const sourceSeal=sealRemovalOriginal259({parts:originals,tiles:sourceTiles,roofing:world.roofing,thermal:world.thermal,
   exploration:world.exploration,party292:world.party292,site:world.site,climate:world.climate,heatwaves:world.heatwaves,miscIncidents:world.miscIncidents,
   allowedAreas:world.allowedAreas,profile:world.gameProfile},[],[]);
  // Capture genuine installed blockers BEFORE deleting their private copies.
  const blockers=originals.map(part=>prepareRemovedFogStructure256(world,part));
  const projection=roofCollapseProjection256(world,{extraMutableDomains:['exploration','party292']}),view=projection.view;
  const drafts=originals.map(original=>view.structures.find(p=>p.id===original.id));
  if(drafts.some((p,i)=>!p||p===originals[i]||encoded298(p)!==encoded298(originals[i])))return fail('La projection a perdu une partie originale.');
  const draftParts=drafts as Structure[],payloads=draftParts.map(encoded298),roofBefore=encoded298(view.roofing);
  // Reveals delete fogged in place; ordinary Tile data stay borrowed readonly.
  view.tiles=sourceTiles.map(t=>t.fogged===true?{...t}:t);
  const work=retireShipWorkDraft298(view,draftParts);if(!work.ok)return fail(work.reason);
  view.structures=view.structures.filter(p=>!ids.has(p.id));
  reconcilePower(view);
  for(const blocker of blockers)commitRemovedFogBlocker256(view,blocker);
  reconcileTemperature(view);
  if(encoded298(view.roofing)!==roofBefore||draftParts.some((part,i)=>encoded298(part)!==payloads[i]))return fail('Le retrait a altéré la toiture ou un contenu embarqué.');
  // Native Ship/BuildingBase has no holdsRoof. Retain the existing roof data
  // literally; no global support collapse or fresh launch requirements here.
  if(world.roofing!==undefined)view.roofing=world.roofing;else delete view.roofing;
  if(encoded298(view.exploration)===encoded298(world.exploration)){if(world.exploration)view.exploration=world.exploration;else delete view.exploration;}
  if(encoded298(view.party292)===encoded298(world.party292)){if(world.party292)view.party292=world.party292;else delete view.party292;}
  let changedTiles=0;
  for(let i=0;i<view.tiles.length;i++)if(view.tiles[i]!==sourceTiles[i]){if(encoded298(view.tiles[i])===encoded298(sourceTiles[i]))view.tiles[i]=sourceTiles[i]!;else changedTiles++;}
  if(!changedTiles)view.tiles=sourceTiles;
  const physical=projection.finish(),presence=localSlots298.map(k=>view[k]!==undefined);
  const bodyReady=()=>body===world||localSlots298.every((k,i)=>writable298(body,k,presence[i]!));
  // No registeredMap/flush/cache refresh in either guard. Replacing the active
  // cached context, source body, descriptor or exact fine frontier refuses.
  const baseCurrent=()=>{
   try{return isSchema298OrLater(Number(expectedOwner.schemaVersion))&&isSchema298OrLater(Number(world.schemaVersion))&&registeredCampaign(expectedOwner)===expectedOwner&&registeredCampaign(world)===expectedOwner
    &&isActualMapMutationContext298(expectedOwner,world)&&registeredMapId(world)===mapId&&effectiveCore297(expectedOwner)===physicalCore298&&effectiveCore297(world)===physicalCore298
    &&expectedOwner.worldMaps===registry&&(registry?!!record&&registry.sites.includes(record)&&record.id===mapId&&(mapId===registry.rootMapId&&hasLoadedRoot(expectedOwner)?expectedOwner:record.map)===body:expectedOwner.planet===planet&&world===expectedOwner)
    &&expectedOwner.rng===rng&&expectedOwner.nextId===nextId&&world.seed===seed&&world.width===width&&world.height===height&&world.tiles===sourceTiles&&world.structures===sourceStructures
    &&parts.length===originals.length&&originals.every((p,i)=>parts[i]===p&&sourceStructures.includes(p))
    &&keys.every((k,i)=>sameDescriptor298(sourceDescriptors[i],descriptor298(world,k)))&&Reflect.ownKeys(captureLocalMap(world)).length===keys.length
    &&localSlots298.every((k,i)=>sameDescriptor298(bodyDescriptors[i],descriptor298(body,k))&&sameDescriptor298(worldDescriptors[i],descriptor298(world,k)))&&sourceSeal(0)&&bodyReady();
   }catch{return false;}
  };
  let used=false;
  const current=()=>!used&&baseCurrent()&&physical.current();
  if(!current())return fail('Les sources ou destinataires physiques sont immuables ou périmés.');
  return {ok:true,current,adopt(){
   // physical.adopt owns its source/mutability guard ONCE. Every false occurs
   // before its first actual write. Afterwards only preflighted plain-data
   // slot copies and non-failing WeakMap invalidation remain.
   if(used||!baseCurrent()||!physical.adopt())return false;used=true;
   if(body!==world){
    for(const k of localSlots298){const value=descriptor298(world,k),before=descriptor298(body,k);if(value){if(!before||!Object.is(before.value,value.value))(body as unknown as Data298)[k]=value.value;}else if(before)delete (body as unknown as Data298)[k];}
    invalidateAnimalPens(body as World);
   }
   return true;
  }};
 }catch(error){return fail(error instanceof Error?error.message.slice(0,512):'La préparation physique interne a échoué.');}
}
