import {effectiveCore297} from './core-phase-297.ts';
import {advanceGroupAlcohol265} from './alcohol-caravan-265.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {preparePlayerRetreatDeparture261} from './caravan-player-retreat-261.ts';
import {prepareDepartureCombat261} from './caravan-departure-combat-261.ts';
import type {GroupCampaignRuntime256} from './group-campaign-runtime-256.ts';
import {groupAmbientTemperature256} from './group-provision-age.ts';
import {captureCaravanEntry259,transferOwnerlessCaravan259} from './group-world-ownership-259.ts';
import {groupPlayerOwner256} from './group-route-interval-256.ts';
import {processGroupPackedDelivery258,pendingGroupPackedDeliveries258,reconcileGroupPackedHandoffs258} from './group-packed-animal-loading-258.ts';
import {validLoadedGroupFreight258} from './group-freight-contract-258.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {groupHasAdmission257,groupHumanHandler257,groupHumanPassenger257,releaseGroupHumanWork257,processGroupHumanCarry257} from './group-human-admission-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {adoptCaravanOtherFoodClimate256,advanceCaravanOtherFoodAges256} from './group-animal-runtime-256.ts';
import {stripTerminalCaravanMember256,archiveOwnerlessCaravanAnimals256} from './group-animal-terminal-256.ts';
import {markCorpseWornApparel284} from './apparel-provenance-284.ts';
import {processGroupAnimalHandler256,processGroupAnimalDelivery256,pendingGroupAnimalDeliveries256,groupAnimalsReadyForDeparture256,groupAnimalReason256} from './group-animal-formation-256.ts';
import {rememberActorBedDeparture256,unclaimDetachedActorBed256} from './actor-map-bed-256.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {nextGroupBedrollPickup256,commitGroupBedrollPickup256,validGroupBedrollLoadingField256} from './group-bedroll-loading-256.ts';
import {canReturnGroupBedrolls256} from './group-bedroll-capture-256.ts';
import {furnitureDropCell} from './furniture-transfer.ts';
import {arriveGeographicGroupPost256} from './group-geographic-post-256.ts';
import {advanceGroupForagedAges256} from './group-foraged-age-256.ts';
import {ingestGroupFood256} from './group-foraged-ingestion-256.ts';
import {rememberMapAreaDeparture} from './pawn-map-areas.ts';
import {newGroupForageRevision256} from './group-forage-state-256.ts';
import {openGroupReorganization} from './group-reorganization-balance.ts';
import {lostThoughts} from './world-map-lost.ts';
import {registeredCampaign,registeredMapId,boundWorldGroup,pawnWorldGroup,localWorldGroups,withWorldGroup} from './world-map-context.ts';
import {mixedGroupProvisions,groupProvisionMinimum,freshGroupProvision} from './group-provisions.ts';
import {adoptGroupProvisionClimate,advanceGroupProvisionAges,groupProvisionClimateRate} from './group-provision-age.ts';
import {campaignAuthority,isSecondaryContext,flushSecondaryContext} from './secondary-site-context.ts';
import { releaseAllowedAreaReturn } from './allowed-area-state.ts';
import { ensureCommercialPost } from './commercial-post.ts';
import type {GroupTravelCapture} from './group-capture.ts';
import type { Cell, MaterialPile, Pawn, World } from './types.ts';
import type { NeedContext } from './needs.ts';
import type { AwayGroup } from './group-capture.ts';
import { captureGroupTravel } from './group-capture.ts';
import { cancelGroupPreparation, groupFormationAuthority, groupLog, groupMemberReason } from './group-authority.ts';
import { commitGroupPickup, departGroup, prepareGroupPickup,previewGroupLoading, type DepartureAuthority } from './group-loading.ts';
import { planetCostContext, planetQueryBudget,findPlanetRoute } from './planet-navigation.ts';
import { advanceGroupRoute } from './group-trip.ts';
import { advanceGroupPersonal } from './group-personal.ts';
import { advanceGroupIngestion } from './group-ingestion.ts';
import { advanceGroupCare, applyConsumedGroupMass } from './group-care.ts';
import { advanceGroupJoy } from './group-joy.ts';
import { captureHumanOwners } from './human-owners.ts';
import {notifyBillWorkerUnavailable283} from './bill-worker-owners-283.ts';
import { healthRandom } from './health.ts';
import { colonistMoodOffset } from './game-profile.ts';
import { colonyExpectation } from './colony-economy.ts';
import { pawnBody } from './health-rules.ts';
import { hasMentalBreak } from './mental-state.ts';
import { notifyPawnDeath } from './bereavement.ts';
import { captureCivilianReturnFinder } from './civilian-return.ts';
import { candidateAccess } from './candidate-access.ts';
import { blockedCells, inBounds, workNeighbours } from './pathfinding.ts';
import { captureStandability } from './furniture-travel.ts';
import { groundCapacity, nearbyGround } from './ground-placement.ts';
import { refreshStock, transferPile } from './materials.ts';
import { dropIncapacitatedEquipment } from './equipment-state.ts';

const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const contact=(a:Cell,b:Cell)=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
/** The ordinary engine owns every movement edge and its global search budget. */
export function processGroupOnMap(w:World,p:Pawn,ctx:NeedContext):boolean {
  if(w.worldMaps&&!boundWorldGroup(w)){const owned=pawnWorldGroup(w,p.id);return owned?withWorldGroup(w,owned.state.id,v=>processGroupOnMap(v,p,ctx))??false:false;}
  const g=w.group;if(!g||!('memberIds' in g)||!g.memberIds.includes(p.id))return false;
  if(g.phase==='unloading'){
    if(g.admission&&!groupHumanHandler257(p))return true;
    if(['dead','downed'].includes(p.state)||hasMentalBreak(p)||p.flee||p.melee||p.shooting){cancelGroupPreparation(w);return false;}
    g.pendingPileIds=g.pendingPileIds.filter(id=>w.piles.some(i=>i.id===id&&i.owner.type==='inventory'&&[...g.memberIds,...g.animalIds??[]].includes(i.owner.pawnId)));
    g.pendingPackedIds=g.pendingPackedIds?.filter(id=>w.packed.some(i=>i.building.id===id&&i.owner.type==='inventory'&&[...g.memberIds,...g.animalIds??[]].includes(i.owner.pawnId)));if(!g.pendingPackedIds?.length)delete g.pendingPackedIds;
    if(!g.pendingPileIds.length&&!g.pendingPackedIds?.length){cancelGroupPreparation(w);return false;}
    if(!g.pendingPileIds.length){const pack=w.packed.find(i=>g.pendingPackedIds?.includes(i.building.id)&&i.owner.type==='inventory'&&(i.owner.pawnId===p.id||g.animalIds?.includes(i.owner.pawnId)||!!g.admission&&g.memberIds.includes(i.owner.pawnId)));if(pack?.owner.type==='inventory'&&g.admission&&pack.owner.pawnId!==p.id){const owner=w.pawns.find(q=>q.id===(pack.owner as {pawnId:number}).pawnId)??w.wildlife?.animals.find(q=>q.id===(pack.owner as {pawnId:number}).pawnId);if(!owner){cancelGroupPreparation(w);return true;}if((owner.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.moveCooldown>0)return true;if(!contact(p,owner)){ctx.move(owner,false);return true;}}if(pack?.owner.type==='inventory'&&g.animalIds?.includes(pack.owner.pawnId)){const animal=w.wildlife?.animals.find(a=>a.id===(pack.owner as {pawnId:number}).pawnId);if(!animal){cancelGroupPreparation(w);return true;}if((animal.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.moveCooldown>0)return true;if(!contact(p,animal)){ctx.move(animal,false);return true;}}if(!pack){p.path=[];p.state='idle';return true;}const cell=furnitureDropCell(w,p,p.id);if(!cell){p.path=[];p.state='idle';return true;}if(g.admission&&pack.owner.type==='inventory'&&pack.owner.pawnId!==p.id&&!contact(p,cell)){p.path=[];p.state='idle';return true;}if(contact(p,cell)&&(p.motion?.end??0)<=w.tick&&p.moveCooldown===0){pack.owner={type:'ground',...cell};g.pendingPackedIds=g.pendingPackedIds!.filter(id=>id!==pack.building.id);if(!g.pendingPackedIds.length){delete g.pendingPackedIds;cancelGroupPreparation(w);}p.path=[];p.state='idle';}else ctx.move(cell,false);return true;}
    const pile=w.piles.find(i=>g.pendingPileIds.includes(i.id)&&i.owner.type==='inventory'&&(i.owner.pawnId===p.id||g.animalIds?.includes(i.owner.pawnId)||!!g.admission&&g.memberIds.includes(i.owner.pawnId)));
    if(pile?.owner.type==='inventory'&&g.admission&&pile.owner.pawnId!==p.id){const owner=w.pawns.find(q=>q.id===(pile.owner as {pawnId:number}).pawnId)??w.wildlife?.animals.find(q=>q.id===(pile.owner as {pawnId:number}).pawnId);if(!owner){cancelGroupPreparation(w);return true;}if((owner.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.moveCooldown>0)return true;if(!contact(p,owner)){ctx.move(owner,false);return true;}}
    if(pile?.owner.type==='inventory'&&g.animalIds?.includes(pile.owner.pawnId)){const animal=w.wildlife?.animals.find(a=>a.id===(pile.owner as {pawnId:number}).pawnId);if(!animal){cancelGroupPreparation(w);return false;}if((animal.motion?.end??0)>w.tick||(p.motion?.end??0)>w.tick||p.moveCooldown>0)return true;if(!contact(p,animal)){ctx.move(animal,false);return true;}}
    if(!pile){p.path=[];p.state='idle';return true;}
    const access=candidateAccess(w,p,blockedCells(w),new Set(),true),stand=captureStandability(w);
    // This is admission only. Ordinary ctx.move owns the weighted route and
    // global PATH quota; even quota0 must not hide a second weighted search.
    const cell=nearbyGround(w,p).find(c=>(!g.admission||pile.owner.type!=='inventory'||pile.owner.pawnId===p.id||contact(p,c))&&groundCapacity(w,c,pile,p.id)>=pile.quantity
      &&[c,...workNeighbours(c)].some(stop=>inBounds(w,stop.x,stop.z)&&stand(stop)&&access.has(stop.z*w.width+stop.x)));
    if(!cell){p.path=[];p.state='idle';return true;}
    if(contact(p,cell)){
      if(!transferPile(w,pile,{type:'ground',...cell}))throw Error('Preflighted group unload failed');
      g.pendingPileIds=g.pendingPileIds.filter(id=>id!==pile.id);p.path=[];p.state='idle';
      if(!g.pendingPileIds.length&&!g.pendingPackedIds?.length)cancelGroupPreparation(w);
    }else ctx.move(cell,false);
    return true;
  }
  const release=releaseGroupHumanWork257(w,g,()=>{
    if(!w.planet||!validGroupBedrollLoadingField256(g,w,w.schemaVersion)||g.animalPreparation?.lines.some(line=>{const animal=w.wildlife?.animals.find(a=>a.id===line.animalId);return !animal||!!groupAnimalReason256(w,animal,true);}))return false;const baseAuthority=groupFormationAuthority(w,true),authority={...baseAuthority,reservedQuantity:(world:World,id:number)=>baseAuthority.reservedQuantity(world,id,g.id)},lines=new Map<number,number>();
    for(const line of g.manifest)lines.set(line.pileId,(lines.get(line.pileId)??0)+line.quantity);
    const ready=previewGroupLoading(w,g.memberIds,[...lines].map(([pileId,quantity])=>({pileId,quantity})),authority,g.animalPreparation?.lines.map(l=>l.animalId));
    if(ready.kind!=='ready'||ready.manifest.length!==g.manifest.length||ready.manifest.some((line,i)=>{const old=g.manifest[i]!;return line.pileId!==old.pileId||line.quantity!==old.quantity||line.carrierId!==old.carrierId||line.animalCarrierId!==old.animalCarrierId;}))return false;
    if(g.bedrollLoading?.manifest.some(line=>{const pack=w.packed.find(item=>item.building.id===line.structureId),carrier=w.pawns.find(q=>q.id===line.carrierId);return !pack||pack.owner.type!=='ground'||!carrier||!groupHumanHandler257(carrier)||!authority.reachable(carrier,pack.owner);}))return false;
    if(findPlanetRoute(w.planet,g.originTile??w.planet.homeTile,g.destination,planetCostContext(w,ready.mass),planetQueryBudget(w.planet)).kind!=='found')return false;
    return [...g.meeting,...g.exits].every(target=>{const member=w.pawns.find(q=>q.id===target.pawnId),carrierId=g.humanPreparation?.passengers.find(row=>row.pawnId===target.pawnId)?.carrierId,actor=member?.state==='downed'?w.pawns.find(q=>q.id===carrierId):member;return !!actor&&!!target.cell&&authority.stand(target.cell)&&authority.reachable(actor,target.cell);});
  });if(release!=='ready'){if(release==='refused')cancelGroupPreparation(w);return true;}
  const reason=groupMemberReason(w,p,true);if(reason){groupLog(w,`Préparation annulée : ${reason}`);cancelGroupPreparation(w);return false;}
  const human=processGroupHumanCarry257(w,g,p,ctx);if(human==='refused'){cancelGroupPreparation(w);return true;}if(human==='handled')return true;
  if(processGroupAnimalHandler256(w,g,p,ctx))return true;
  if(processGroupAnimalDelivery256(w,g,p,ctx))return true;
  const packedDelivery=processGroupPackedDelivery258(w,g,p,ctx);if(packedDelivery==='refused'){cancelGroupPreparation(w);return true;}if(packedDelivery==='handled')return true;
  if(g.phase==='gathering'){
    const spot=g.meeting.find(e=>e.pawnId===p.id)!.cell;
    if(!same(p,spot)){ctx.move(spot,true);return true;}
    p.path=[];p.state='idle';
    if(g.meeting.every(e=>{const q=w.pawns.find(q=>q.id===e.pawnId),passenger=g.humanPreparation?.passengers.find(row=>row.pawnId===e.pawnId);if(q&&passenger&&(q.state==='downed'||passenger.phase==='carry'))return true;return !!q&&same(q,e.cell)&&q.moveCooldown===0&&(q.motion?.end??0)<=w.tick;}))g.phase=g.manifest.length||g.bedrollLoading?.manifest.some(r=>!r.loaded)?'loading':'leaving';
    return true;
  }
  if(g.phase==='loading'){
    const line=g.manifest[g.cursor];if(!line){if(!validGroupBedrollLoadingField256(g,w,w.schemaVersion)){cancelGroupPreparation(w);return true;}const next=nextGroupBedrollPickup256(w,g);if(!next){if(!pendingGroupAnimalDeliveries256(g)&&!pendingGroupPackedDeliveries258(g))g.phase='leaving';return true;}if(next.carrier!==p){p.path=[];p.state='idle';return true;}if(next.pack.owner.type!=='ground'){cancelGroupPreparation(w);return false;}if(!contact(p,next.pack.owner)){ctx.move(next.pack.owner,false);return true;}if(!commitGroupBedrollPickup256(w,g,p)){if(p.moveCooldown===0&&(p.motion?.end??0)<=w.tick)cancelGroupPreparation(w);return true;}if(!g.bedrollLoading!.manifest.some(r=>!r.loaded))if(!pendingGroupAnimalDeliveries256(g)&&!pendingGroupPackedDeliveries258(g))g.phase='leaving';return true;}
    if(line.carrierId!==p.id){p.path=[];p.state='idle';return true;}
    const source=w.piles.find(i=>i.id===line.pileId);
    if(!source||source.owner.type!=='ground'||source.item!==line.item||source.foodPoison){cancelGroupPreparation(w);return false;}
    if(!contact(p,source.owner)){ctx.move(source.owner,false);return true;}
    const plan=prepareGroupPickup(w,g,groupFormationAuthority(w,true));
    if(plan.kind!=='ready'){groupLog(w,'Le chargement ne peut plus être confirmé ; les biens déjà portés sont conservés.');cancelGroupPreparation(w);return false;}
    if(!commitGroupPickup(w,g,plan.plan))throw Error('Synchronous group pickup changed');
    p.path=[];p.state='idle';if(g.cursor===g.manifest.length&&!g.bedrollLoading?.manifest.some(r=>!r.loaded))if(!pendingGroupAnimalDeliveries256(g)&&!pendingGroupPackedDeliveries258(g))g.phase='leaving';return true;
  }
  const exit=g.exits.find(e=>e.pawnId===p.id)?.cell;
  if(!exit){cancelGroupPreparation(w);return false;}
  if(same(p,exit)){p.path=[];p.state='idle';}else ctx.move(exit,true);
  return true;
}

/** Cancel only new local human intents. This small guard is also the final
 * tick boundary after social/danger producers; no manifest or departure runs. */
export function reconcileGroupAdmission257(w:World):void {
  if(w.worldMaps&&!boundWorldGroup(w)){
    for(const row of localWorldGroups(w).filter(row=>'manifest'in row.state&&groupHasAdmission257(row.state)).sort((a,b)=>a.state.id-b.state.id))withWorldGroup(w,row.state.id,reconcileGroupAdmission257);
    return;
  }
  const g=w.group;if(!g||!('manifest'in g)||!groupHasAdmission257(g))return;
  for(const id of g.memberIds){const member=w.pawns.find(p=>p.id===id),reason=member?groupMemberReason(w,member,true):'Un membre réel de la formation est absent.';
    if(reason){groupLog(w,`Préparation annulée : ${reason}`);cancelGroupPreparation(w);return;}
  }
}

/** At most512 manifest rows/64 source identities. Only future promises are
 * reconciled: contact receipts and actual inventories remain historical. */
export function reconcileGroupPreparation(w:World):void {
  if(w.worldMaps&&!boundWorldGroup(w)){for(const g of localWorldGroups(w).slice().sort((a,b)=>a.state.id-b.state.id))withWorldGroup(w,g.state.id,reconcileGroupPreparation);return;}
  const g=w.group;if(!g||!('manifest' in g))return;
  reconcileGroupAdmission257(w);if(w.group!==g)return;
  reconcileGroupPackedHandoffs258(w,g);
  if(!validGroupBedrollLoadingField256(g,w,w.schemaVersion)){groupLog(w,'Préparation annulée : un couchage promis a changé ; les biens déjà détenus restent portés.');cancelGroupPreparation(w);return;}
  if(g.animalPreparation?.lines.some(l=>{const a=w.wildlife?.animals.find(a=>a.id===l.animalId);return !a||!!groupAnimalReason256(w,a,true);})){groupLog(w,'Préparation annulée : un animal ne peut plus suivre ; les originaux et les biens restent présents.');cancelGroupPreparation(w);return;}
  let pileIndex:Map<number,MaterialPile>|undefined;const currentPiles=()=>pileIndex??=new Map(w.piles.map(p=>[p.id,p]));
  if(!validLoadedGroupFreight258(g,currentPiles(),w.schemaVersion)){groupLog(w,'Préparation annulée : un bien déjà chargé a changé ; les possessions réelles restent conservées.');cancelGroupPreparation(w);return;}
  if(mixedGroupProvisions(g)&&g.manifest.slice(0,g.cursor).some(line=>{if(line.item!=='pemmican')return false;const p=currentPiles().get(line.carriedPileId!);return !p||p.owner.type!=='inventory'||p.owner.pawnId!==line.carrierId||p.item!=='pemmican'||p.quantity!==line.quantity||!freshGroupProvision(p,w.tick);})){groupLog(w,'Préparation annulée : une provision déjà chargée n’est plus disponible ; les autres biens restent portés.');cancelGroupPreparation(w);return;}
  const future=new Map<number,{item:MaterialPile['item'];quantity:number}>();
  for(let i=g.cursor;i<g.manifest.length;i++){
    const line=g.manifest[i]!,old=future.get(line.pileId);
    if(old&&old.item!==line.item){groupLog(w,'Préparation annulée : une source promise a changé.');cancelGroupPreparation(w);return;}
    future.set(line.pileId,{item:line.item,quantity:(old?.quantity??0)+line.quantity});
  }
  if(!future.size)return;
  const piles=currentPiles();
  for(const [id,promised] of future){
    const source=piles.get(id);
    if(!source||source.owner.type!=='ground'||source.item!==promised.item||source.foodPoison||w.schemaVersion>=258&&Number(w.schemaVersion)<298&&!materialAllowedForPlayer256(source)||source.quantity<promised.quantity){
      groupLog(w,'Préparation annulée : une provision promise n’est plus disponible ; les biens déjà portés sont conservés.');
      cancelGroupPreparation(w);return;
    }
  }
}

/** Called after all on-map personal passes. All originals transfer together. */
export function tryGroupDeparture(w:World,retreatRuntime261?:GroupCampaignRuntime256):void {
  if(w.worldMaps&&!boundWorldGroup(w)){for(const g of localWorldGroups(w).slice().sort((a,b)=>a.state.id-b.state.id))withWorldGroup(w,g.state.id,v=>tryGroupDeparture(v,retreatRuntime261));return;}
  const g=w.group;if(!w.planet||!g||!('manifest' in g)||g.phase!=='leaving')return;
  const isRetreat=!!boundWorldGroup(w)?.retreat261;if(isRetreat!==!!retreatRuntime261)return;
  if(!g.exits.every(e=>{const p=w.pawns.find(p=>p.id===e.pawnId);return !!p&&!!e.cell&&same(p,e.cell)&&p.moveCooldown===0&&!p.path.length&&(p.motion?.end??0)<=w.tick;}))return;
  if(!groupAnimalsReadyForDeparture256(w,g)||g.humanPreparation?.releaseIds.length||g.humanPreparation?.passengers.some(row=>row.phase!=='waiting'))return;
  const base=groupFormationAuthority(w,true);
  const authority:DepartureAuthority={...base,personalPassTick:()=>w.tick,departureReason:(_world,plan)=>{
    if(!(isSchema256Or257(w.schemaVersion)&&g.travelPreparation===true)&&(mixedGroupProvisions(plan.next)?!groupProvisionMinimum(plan.next.members,plan.next.items.filter(p=>p.owner.type==='inventory'),w.foodPolicies,w.tick):plan.next.baseline.food<plan.next.members.length))return mixedGroupProvisions(plan.next)?'Les provisions saines doivent couvrir les régimes de tous les membres avant le départ.':'Chargez au moins une ration saine par membre avant le départ.';
    return undefined;
  },adoptDeparture:(world,plan)=>{
    if(world.group!==g)return false;
    const undraftIds=new Set((Number(world.schemaVersion)===261||(Number(world.schemaVersion)===262||isSchema263OrLater(Number(world.schemaVersion))))?g.humanPreparation?.undraftIds261??[]:[]);
    // Only this new intent owns demobilisation. Admit every deletion before
    // any original write; old engaged groups have no marker and stay literal.
    if([...undraftIds].some(id=>{const p=plan.capture.members.find(p=>p.id===id);return !p?.draft||Object.getOwnPropertyDescriptor(p,'draft')?.configurable!==true;}))return false;
    const departingIds=new Set([...plan.capture.members,...plan.capture.animals??[]].map(p=>p.id));
    const combat=(Number(world.schemaVersion)===261||(Number(world.schemaVersion)===262||isSchema263OrLater(Number(world.schemaVersion))))?prepareDepartureCombat261(world,departingIds):undefined;if(combat&&(!combat.ok||!combat.current()))return false;
    const entryMembers=plan.next.members.map(p=>{if(!undraftIds.has(p.id))return p;const clone=structuredClone(p);delete clone.draft;return clone;});
    const enteredAtAbsCore=captureCaravanEntry259(world,{...plan.next,members:entryMembers});
    const retreat=preparePlayerRetreatDeparture261(world,plan.next,enteredAtAbsCore);if(!retreat.ok||('current'in retreat&&!retreat.current()))return false;
    const retreatMotion=isRetreat?retreatRuntime261!.preparePlayerRetreat261(registeredCampaign(world),retreat.next,'targetId'in retreat?retreat.targetId:undefined):undefined;
    plan.next=retreat.next;
    adoptGroupProvisionClimate(world,plan.next);if(g.travelPreparation===true)adoptCaravanOtherFoodClimate256(world,plan.next);
    if(world.schemaVersion>=256&&g.travelPreparation===true){const originMapId=world.worldMaps?boundWorldGroup(world)?.originMapId:undefined;if(originMapId===undefined)throw Error('Missing actual departure map');const context={seed:world.seed,width:world.width,height:world.height,...world.climate?{climate:world.climate}:{},...world.site?{site:world.site}:{},...world.scenario?{scenario:world.scenario}:{}};plan.next.travel={revision:1,tickDelta:0,forage:newGroupForageRevision256(plan.next.items)};plan.next.reorganization=openGroupReorganization(plan.next,[],world.tick,plan.next.members.map(p=>({pawnId:p.id,originMapId,context,...enteredAtAbsCore!==undefined?{enteredAtAbsCore}:{}})));}

    const bedCapture=world.schemaVersion>=256?captureActorBeds256(registeredCampaign(world)):undefined;
    const mapId=world.schemaVersion>=256?registeredMapId(world):undefined;if(bedCapture&&mapId===undefined)throw Error('Missing actual bed departure map');
    if(plan.next.animalOwners){const context={seed:world.seed,width:world.width,height:world.height,...world.climate?{climate:world.climate}:{},...world.site?{site:world.site}:{},...world.scenario?{scenario:world.scenario}:{}};plan.next.animalOwners.origins=plan.next.animalOwners.members.map(a=>({pawnId:a.id,originMapId:mapId!,context,...enteredAtAbsCore!==undefined?{enteredAtAbsCore}:{}}));}
    const people=new Set(plan.capture.members.map(p=>p.id)),items=new Set(plan.capture.items.map(p=>p.id));
    for(const p of plan.capture.members){if(undraftIds.has(p.id))delete p.draft;rememberMapAreaDeparture(world,p);releaseAllowedAreaReturn(p);if(isSecondaryContext(world))delete p.allowedAreaId;if(bedCapture)rememberActorBedDeparture256(p,mapId!,bedCapture.refs,world.schemaVersion);else {p.bedId=null;delete p.bedSlot;}p.path=[];p.moveCooldown=0;p.planCooldown=0;if(p.state!=='downed')p.state='idle';if(p.mental)p.mental.below=[0,0,0];delete p.motion;delete p.shooting;delete p.stagger;delete p.stun;if((Number(world.schemaVersion)===259||Number(world.schemaVersion)===260||(Number(world.schemaVersion)===261||(Number(world.schemaVersion)===262||isSchema263OrLater(Number(world.schemaVersion)))))&&g.admission?.revision===2&&p.prisoner){delete p.prisoner.escape;if(p.prisoner.breakout)delete p.prisoner.breakout.active;delete p.raid;delete p.visitor;}}
    for(const a of plan.capture.animals??[]){if(bedCapture)rememberActorBedDeparture256(a,mapId!,bedCapture.refs,world.schemaVersion);delete a.animalThermalRefuge288;delete a.animalAreaReturn287;delete a.haul;if(a.wander)delete a.wander.job;a.path=[];delete a.motion;delete a.animalRest;delete a.meal;delete a.eggLay;delete a.flight;delete a.stagger;delete a.stun;delete a.sleepUntilCore;if(a.domestic)delete a.domestic.penMarkerId;if(a.state!=='downed')a.state='idle';a.nextDecision=world.tick;}
    if(world.wildlife&&plan.capture.animals){const ids=new Set(plan.capture.animals.map(a=>a.id));world.wildlife.animals=world.wildlife.animals.filter(a=>!ids.has(a.id));}
    world.pawns=world.pawns.filter(p=>!people.has(p.id));world.piles=world.piles.filter(p=>!items.has(p.id));const packs=new Set(plan.capture.packed??[]);world.packed=world.packed.filter(p=>!packs.has(p));
    if(combat?.ok)combat.commit();
    if(world.worldMaps){const record=boundWorldGroup(world);if(!record)throw Error('Missing group authority');record.localMapId=null;world.group=plan.next;if(isRetreat){const joined=retreat.commit();retreatMotion!.commit();if(joined)delete world.group;}}else if(isSecondaryContext(world)){
      const root=campaignAuthority(world),site=root.secondarySite!;
      plan.next.entry={...site.visit!.homeEntry};root.group=plan.next;delete world.group;
      site.visit=null;site.selected=false;flushSecondaryContext(root);
    }else world.group=plan.next;
    refreshStock(world);
    groupLog(world,`${people.size} membre${people.size>1?'s':''} quitte${people.size>1?'nt':''} la carte avec ses provisions.`);return true;
  }};
  const result=departGroup(w,w.planet,g,authority,planetQueryBudget(w.planet!));
  if(result.kind==='refused'){groupLog(w,`Départ annulé : ${result.reason}`);cancelGroupPreparation(w);}
}
function returnGroup(w:World,g:AwayGroup):boolean {
  if(g.packed&&!canReturnGroupBedrolls256(w,g.packed,g.members))return false;
  if(g.phase!=='awaiting-entry'||w.pawns.length+g.members.length>w.width*w.height||w.piles.length+g.items.length>32768)return false;
  const find=captureCivilianReturnFinder(w),used=new Set<number>(),placements:{pawn:Pawn;cell:Cell}[]=[];
  for(const pawn of g.members){const cell=find(g.entry,c=>!used.has(c.z*w.width+c.x));if(!cell)return false;used.add(cell.z*w.width+cell.x);placements.push({pawn,cell});}
  captureHumanOwners(w);
  for(const {pawn,cell} of placements){pawn.x=cell.x;pawn.z=cell.z;pawn.path=[];pawn.moveCooldown=0;pawn.planCooldown=0;delete pawn.motion;if(pawn.state!=='downed')pawn.state='idle';}
  w.pawns.push(...g.members);w.piles.push(...g.items);if(g.packed)w.packed.push(...g.packed);
  const pending=g.items.filter(i=>i.owner.type==='inventory').map(i=>i.id),pendingPacked=g.packed?.map(p=>p.building.id)??[];
  if(pending.length||pendingPacked.length)w.group={...g.admission?{admission:g.admission}:{},id:g.id,startedAt:g.startedAt,destination:g.destination,ledger:g.ledger,...g.provisions?{provisions:g.provisions}:{},...g.freight?{freight:g.freight}:{},phase:'unloading',memberIds:g.members.map(p=>p.id),pendingPileIds:pending,...pendingPacked.length?{pendingPackedIds:pendingPacked}:{}};else delete w.group;
  // Reinsert the real owners together before the local physical drop. A full
  // floor keeps the same disabled weapon with equipmentDropPending for retry.
  for(const {pawn} of placements)dropIncapacitatedEquipment(w,pawn);
  refreshStock(w);groupLog(w,pending.length?'Le groupe est rentré ; ses provisions sont à décharger physiquement.':'Le groupe est rentré.');return true;
}

export interface GroupPersonalFrontier256 {resting:boolean;clinicalRestFor256?:import('./group-personal.ts').GroupPersonalContext['clinicalRestFor256']}
export interface GroupPersonalFrontierResult {travel:GroupTravelCapture;stationary:boolean}
/** Shared once-per-local personal frontier. No route payment is hidden here. */
export function advanceGroupPersonalFrontier(w:World,prospective?:GroupPersonalFrontier256):GroupPersonalFrontierResult|undefined {
  let g=w.group;if(!w.planet||!g||!('members' in g)||g.lastPersonalTick===w.tick)return;
  const animalPersonalTick=g.lastPersonalTick;
  if(w.schemaVersion>=256&&(g.travel||g.reorganization))advanceGroupForagedAges256(w,g,groupProvisionClimateRate(w,g));
  advanceGroupProvisionAges(w,g);
  // A true prospective owner loss may end the caravan during the clinical
  // pass below. Settle its other live food here, beside fruit and pemmican,
  // before either survivor suspension or terminal ownership can occur.
  if((Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))&&g.admission?.revision===2)advanceCaravanOtherFoodAges256(w,g);
  for(const p of g.members)if(p.droppedWeaponId!==undefined&&(g.items.some(i=>i.owner.type==='equipment'&&i.owner.pawnId===p.id)||!w.piles.some(i=>i.id===p.droppedWeaponId&&i.kind==='weapon'&&i.owner.type==='ground')))delete p.droppedWeaponId;
  // Reused Core V182 Caravan_NeedsTracker.AnyPawnsNeedRest tests whether
  // Rest exists. Every admitted human has it, including one at rest100.
  let travel=captureGroupTravel(g,p=>({incapable:p.state==='downed'||hasMentalBreak(p)||pawnBody(p).capacities.moving<=0,restNeed:true}),w.schemaVersion);
  if(!travel)throw Error('Invalid group owner mass');
  const routePreview=prospective?undefined:advanceGroupRoute(w.planet,g,planetCostContext(w,travel.mass),travel).state;
  const stationary=prospective?.resting??(g.phase!=='travelling'||!!routePreview&&'members' in routePreview&&!!routePreview.stop),people=captureHumanOwners(w).people,expectation=colonyExpectation(w,g.members[0]!);
  const random=()=>healthRandom(w),notice=(_person:Pawn,message:string)=>groupLog(w,message);
  if(prospective&&(!g.travel||w.schemaVersion<256))throw Error('Missing prospective personal owner');
  const result=advanceGroupPersonal(g,{...prospective?{deferNeedMeters256:true as const,clinicalRestFor256:prospective.clinicalRestFor256}:{},tick:w.tick,schemaVersion:w.schemaVersion,...(Number(w.schemaVersion)===259||Number(w.schemaVersion)===260||(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))?{ambientTemperature259:groupAmbientTemperature256(w,g)}:{},seed:w.seed,seedFor:p=>g!.reorganization?.memberOrigins.find(o=>o.pawnId===p.id)?.context.seed??w.seed,legacyFood:w.foodRules==='legacy',legacyRest:w.restRules==='legacy',resting:stationary,
    infectionChanceFactor:w.gameProfile?.difficulty==='adventure-story'?.75:1,mood:{people,expectation,difficultyMood:colonistMoodOffset(w,g.members[0]!)},lostThoughts:p=>lostThoughts(w,p,people),joyToleranceFall:(expectation?.joyToleranceDropPerDay??.18)*100/6000,random,notice});
  if(!result)return;
  if(result.deceased.length){
    for(const p of result.deceased)markCorpseWornApparel284(g.items,p,w.schemaVersion);
    const dead=new Set(result.deceased.map(p=>p.id));
    const actualAway=g;
    if(w.schemaVersion>=256&&g.reorganization&&g.members.some(p=>!dead.has(p.id)&&(g.admission?.revision!==2||groupPlayerOwner256(p))))for(const p of result.deceased)stripTerminalCaravanMember256(w,g,p.id);
    const losses=result.deceased.map(p=>({...actualAway.admission?{admission:actualAway.admission}:{},...actualAway.packed?.some(pack=>pack.owner.type==='inventory'&&pack.owner.pawnId===p.id)?{packed:actualAway.packed.filter(pack=>pack.owner.type==='inventory'&&pack.owner.pawnId===p.id)}:{},...actualAway.reorganization?{memberOrigin:actualAway.reorganization.memberOrigins.find(o=>o.pawnId===p.id)!}:{},groupId:actualAway.id,tile:actualAway.tile,tick:p.health!.death!.tick,pawn:p,items:actualAway.items.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id)}));
    if(w.worldGroups){const r=boundWorldGroup(w);if(!r)throw Error('Missing loss context');if(!w.worldGroups.lossContexts.some(c=>c.groupId===g!.id))w.worldGroups.lossContexts.push({groupId:g.id,originMapId:r.originMapId,context:r.context});}w.groupLosses??=[];w.groupLosses.push(...losses);g.members=g.members.filter(p=>!dead.has(p.id));if(g.reorganization)g.reorganization.memberOrigins=g.reorganization.memberOrigins.filter(o=>!dead.has(o.pawnId));g.items=g.items.filter(i=>!('pawnId' in i.owner)||!dead.has(i.owner.pawnId));if(g.packed){g.packed=g.packed.filter(pack=>pack.owner.type!=='inventory'||!dead.has(pack.owner.pawnId));if(!g.packed.length)delete g.packed;}
    if(g.animalOwners)g.animalOwners.order=g.animalOwners.order.filter(id=>!dead.has(id));
    const transferred=transferOwnerlessCaravan259(w,g,animalPersonalTick);
    if(!transferred&&!g.members.length){if(w.schemaVersion>=256)archiveOwnerlessCaravanAnimals256(w,g,animalPersonalTick);delete w.group;}
    for(const loss of losses){if(w.schemaVersion>=256)unclaimDetachedActorBed256(loss.pawn);notifyPawnDeath(w,loss.pawn);notifyBillWorkerUnavailable283(w,loss.pawn.id);groupLog(w,`${loss.pawn.name} est décédé pendant le voyage ; son dossier et ses biens sont conservés à cette destination.`);}
    if(!g.members.length)return;
    travel=captureGroupTravel(g,p=>({incapable:p.state==='downed'||hasMentalBreak(p)||pawnBody(p).capacities.moving<=0,restNeed:true}),w.schemaVersion);if(!travel)throw Error('Invalid surviving group');
  }
  return {travel,stationary};
}
/** Historical route and needs remain literal, even after a real exchange. */
export function advanceGroup(w:World):void {
 const initial=w.group;if(!initial||!('members'in initial)||!w.planet)return;
 if(initial.travel)throw Error('Prospective caravan requires its Core runtime');
 const provisionTile=initial.tile,travelAtFrontier=advanceGroupPersonalFrontier(w);let g=w.group;
 if(!travelAtFrontier||!g||!('members'in g))return;
 let travel=travelAtFrontier.travel;
 const stationary=travelAtFrontier.stationary;
 const random=()=>healthRandom(w),notice=(_person:Pawn,message:string)=>groupLog(w,message);
  const ingestion=g.reorganization?g.members.reduce((all,p)=>{const one=ingestGroupFood256(w,g as AwayGroup,p,{random,notice,...(Number(w.schemaVersion)===299?{coreAt299:effectiveCore297(w)}:{})});all.massRemovedGrams+=one.massRemovedGrams;all.removed.push(...one.removed);return all;},{massRemovedGrams:0,removed:[] as {pawnId:number;grams:number}[]}):advanceGroupIngestion(g,{tick:w.tick,schemaVersion:w.schemaVersion,...(Number(w.schemaVersion)===299?{coreAt299:effectiveCore297(w)}:{}),foodPolicies:w.foodPolicies,foodPoisonFactor:w.gameProfile?.difficulty==='adventure-story'?.75:1,random,notice});
  const alcohol=advanceGroupAlcohol265(g,{tick:w.tick,schemaVersion:w.schemaVersion,drugPolicies:w.drugPolicies,resting:stationary,random,notice});
  const care=advanceGroupCare(g,{tick:w.tick,random});
  const mass=applyConsumedGroupMass(travel.mass,[ingestion,alcohol,care]);
  travel={mass,incapableIds:g.members.filter(p=>p.state==='downed'||hasMentalBreak(p)||pawnBody(p).capacities.moving<=0).map(p=>p.id),anyRestNeed:g.members.length>0};
  advanceGroupJoy(g,{tick:w.tick,stationary,random});
  for(let core=0;core<10;core++){
    const context=planetCostContext(w,mass);context.homeCivilCore+=core;
    const next=advanceGroupRoute(w.planet,g,context,travel);if(!('members' in next.state))throw Error('Route returned wrong owner phase');g=next.state;w.group=g;
    if(next.event==='arrived'){
      if(w.planet.revision===3)arriveGeographicGroupPost256(w,g);else if(g.tile===w.planet.civilianTile)ensureCommercialPost(w);
      groupLog(w,g.tile===w.planet.homeTile?'Le groupe attend une entrée accessible au foyer.':'Le groupe est arrivé à sa destination.');
    }
  }
  if(g.tile!==provisionTile)adoptGroupProvisionClimate(w,g);
  if(!w.worldMaps)returnGroup(w,g);
}
