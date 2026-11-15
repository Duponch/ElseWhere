import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema274OrLater} from './schema-compatibility-257.ts';
import {quoteGroupGift274,prepareGroupGift274} from './group-gift-274.ts';
export {quoteGroupGift274} from './group-gift-274.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {newGroupAdmissionRevision259,autoCapturePatient259} from './group-human-admission-259.ts';
import {estimateGroupTravel} from './group-travel-estimate.ts';
import {regularGroupFreight258} from './group-freight-contract-258.ts';
import {materialAllowedForPlayer256} from './material-permission-256.ts';
import {captureCaravanSourceAccess298} from './caravan-source-access-298.ts';
import {groupHumanAdmissionReason257,groupHasAdmission257,groupHumanHandler257,previewGroupHumanPreparation257,releaseGroupHumanPassengers257} from './group-human-admission-257.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {ITEM_DEFINITIONS} from './items.ts';
import {groupCaravanUnitMass256} from './group-caravan-mass-256.ts';
import {previewGroupAnimals256,releaseGroupAnimals256,groupAnimalReason256} from './group-animal-formation-256.ts';
import {setGroupCaravanCarrySick256} from './group-caravan-carry-256.ts';
import {validCaravanBedrollPacks256} from './group-bedroll-capture-256.ts';
import {previewGroupBedrollLoading256} from './group-bedroll-loading-256.ts';
import {groupGeographicTradeTarget256,commitGeographicGroupPost256} from './group-geographic-post-256.ts';
import {registeredCampaign,registeredMapId,pawnWorldGroup,boundWorldGroup,initialWorldRegistry,withWorldGroup} from './world-map-context.ts';
import {applyTradeGoodwill338,planTradeGoodwill338} from './trade-goodwill-338.ts';
import {GROUP_FREIGHT_SCHEMA,newGroupFreight,freightGroup} from './group-freight.ts';
import {GROUP_PROVISIONS_SCHEMA,newGroupProvisions,mixedGroupProvisions,groupProvisionCounts,groupProvisionMinimum,freshGroupProvision} from './group-provisions.ts';
import {secondaryLocalGroupAllowed} from './secondary-site.ts';
import {campaignAuthority} from './secondary-site-context.ts';
import { quoteGroupTrade,draftGroupTrade,type GroupTradeEnvironment } from './group-trade.ts';
import { bestGroupNegotiator } from './trade-negotiator.ts';
import type { Cell, CommandResult, MaterialPile, Pawn, World } from './types.ts';
import type { CommercialBuyLine } from './commercial-state.ts';
import type { GroupCommand, GroupState } from './group-state.ts';
import { GROUP_MAX_LOSSES } from './group-state.ts';
import type { GroupFormationAuthority, GroupMassCapture, AwayGroup, PreparingGroup } from './group-capture.ts';
import { captureGroupMass, groupDestinationValid } from './group-capture.ts';
import { emptyGroupLedger, previewGroupLoading, groupReservedSources } from './group-loading.ts';
import { captureHumanOwners } from './human-owners.ts';
import { isColonist } from './affiliation.ts';
import { biologicalYears } from './human-age.ts';
import { scoutActiveTask, scoutPreparationReason, scoutUnstable, collectiveMobilePreparationReason256 } from './caravan-trip.ts';
import { reservedSource,reservedSourcesByPile } from './materials.ts';
import { candidateAccess } from './candidate-access.ts';
import { blockedCells, inBounds, workNeighbours } from './pathfinding.ts';
import { captureStandability } from './furniture-travel.ts';
import { generatePlanet, planetHomeInput } from './planet-generation.ts';
import { findPlanetRoute, planetQueryBudget, planetCostContext } from './planet-navigation.ts';
import { prepareGroupRedirection } from './group-trip.ts';
import type { GroupFormationPreview, GroupMassView, GroupMemberChoice, GroupPermissionView, GroupRoutePreview, GroupSourceChoice, GroupTradePreview, GroupPanelAction, GroupActionPermission } from './group-panel-state.ts';

const groupCaravanFood256=(item:MaterialPile['item'])=>ITEM_DEFINITIONS[item].nutrition>0&&groupCaravanUnitMass256(item,true)!==undefined;
const fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const same=(a:Cell,b:Cell)=>a.x===b.x&&a.z===b.z;
const queryBudget=(w:World)=>planetQueryBudget(w.planet!);
const away=(g:GroupState|undefined):g is AwayGroup=>!!g&&'members' in g;
export { groupOnMapMember } from './group-state.ts';
export function groupLog(w:World,message:string):void {w.events.push({tick:w.tick,type:'command',message});if(w.events.length>80)w.events.splice(0,w.events.length-80);}

/** Collective256 uses actual mobility; historical formations retain scout admission. */
export function groupMemberReason(w:World,p:Pawn,preparing=false):string|undefined {
  const admission=w.schemaVersion>=257&&(!w.group||groupHasAdmission257(w.group));
  if(!admission&&(!w.pawns.includes(p)||!isColonist(p)||p.prisoner||p.visitor))return 'Choisissez un colon libre et présent.';
  const engaged=pawnWorldGroup(w,p.id);if(engaged&&engaged!==boundWorldGroup(w)&&(!preparing||engaged.state.id!==w.group?.id))return 'Ce colon appartient déjà à un autre groupe.';
  if(w.scout||w.commercialTrip)return 'Terminez le voyage individuel en cours.';
  // Absence of travelPreparation is the old engaged formation contract, even
  // after a neutral schema migration. Only a real new256 start owns this flag.
  if(admission)return groupHumanAdmissionReason257(w,p,!w.group)??(w.group&&'manifest'in w.group&&!w.group.humanPreparation?.releaseIds.includes(p.id)&&(scoutActiveTask(p)||p.deepWork||p.openCasket||p.medicalSleep)?'Une nouvelle activité concurrente réserve cette personne.':undefined);
  const current=w.group,prospective=isSchema256Or257(w.schemaVersion)&&(current&&'manifest'in current?current.travelPreparation===true:!preparing&&!current);
  if(!prospective&&p.age&&biologicalYears(p.age)<18)return 'Le groupe accepte actuellement des adultes.';
  const reason=prospective?collectiveMobilePreparationReason256(w,p):scoutPreparationReason(w,p,w.schemaVersion<255&&!w.expeditionSite,w.schemaVersion>=GROUP_PROVISIONS_SCHEMA&&(!preparing||!!w.group&&mixedGroupProvisions(w.group)));if(reason)return reason;
  if(scoutActiveTask(p))return 'Le colon doit terminer son activité avant de rejoindre le groupe.';
  if(!preparing&&(p.state!=='idle'||p.path.length||p.moveCooldown>0||(p.motion?.end??0)>w.tick))return 'Le colon doit avoir terminé son déplacement.';
  if(w.piles.some(i=>i.owner.type==='pawn'&&i.owner.pawnId===p.id)||w.packed.some(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id&&(w.schemaVersion<256||i.owner.type!=='inventory'||i.building.kind!=='bedroll')))return 'Déposez la cargaison de travail avant de partir.';
  return undefined;
}

/** A shared connectivity capture per member answers all sources and meeting/exit cells.
 * It supplies no unweighted route: the ordinary engine still pays its weighted movement. */
export function groupFormationAuthority(w:World,preparing=false,origins?:ReadonlyMap<number,Cell>):GroupFormationAuthority & {reachable(p:Pawn,c:Cell):boolean;stand(c:Cell):boolean} {
  const blocked=blockedCells(w),stand=captureStandability(w),queries=new Map<number,ReturnType<typeof candidateAccess>>();
  let connectivityQuota=8*w.width*w.height;
  const reachable=(p:Pawn,c:Cell):boolean=>{
    if(!inBounds(w,c.x,c.z))return false;
    let q=queries.get(p.id);if(!q){q=candidateAccess(w,p,blocked,new Set(),true,origins?.get(p.id)??p);queries.set(p.id,q);}
    const before=q.connectivityVisited,result=q.has(c.z*w.width+c.x);connectivityQuota-=q.connectivityVisited-before;
    if(connectivityQuota<0)throw Error('Group connectivity quota exceeded');
    return result;
  };
  const newSources=Number(w.schemaVersion)>=298&&!preparing?captureCaravanSourceAccess298(w):undefined;

  return {
    requireResident:w.schemaVersion<255&&!w.expeditionSite,reachable,stand:c=>inBounds(w,c.x,c.z)&&!blocked[c.z*w.width+c.x]&&stand(c),
    namespace:world=>({byId:new Map(captureHumanOwners(world).slots.map(s=>[s.id,{pawn:s.pawn,local:s.kind==='map'}]))}),
    memberReason:(world,p)=>groupMemberReason(world,p,preparing),
    residentCapable:(_world,p)=>isColonist(p)&&!p.prisoner&&!p.visitor&&!['dead','downed'].includes(p.state)&&!p.mental?.crisis,
    sourceReason:(world,pile)=>{
      if(Number(world.schemaVersion)>=298){
        const place=newSources?.(pile);if(place)return place;
        // Engaged promises no longer re-read Home, storage or fog. Their
        // existing loading preflight checks live reservations separately.
      }else if(world.schemaVersion>=258&&!materialAllowedForPlayer256(pile))return 'Ce bien est interdit.';
      return pile.owner.type!=='ground'||pile.foodPoison||pile.item==='pemmican'&&!freshGroupProvision(pile,world.tick)?'Choisissez une provision saine au sol.':undefined;
    },
    reservedQuantity:(world,id,exceptGroupId)=>{
      const own=world.group&&'manifest' in world.group&&world.group.id===exceptGroupId?groupReservedSources(world.group).get(id)??0:0;
      return reservedSource(world,id)-own;
    },
    sourceAccess:(_world,p,pile)=>pile.owner.type==='ground'&&[pile.owner,...workNeighbours(pile.owner)].some(c=>reachable(p,c))?'reachable':'unreachable',
    namespaceReason:(world,{additionalPiles,members,items})=>{
      try {captureHumanOwners(world);}catch {return 'Une identité humaine possède plusieurs propriétaires.';}
      if(world.schemaVersion<256&&(registeredCampaign(world).worldGroups?.losses.length??campaignAuthority(world).groupLosses?.length??0)+members.length>GROUP_MAX_LOSSES)return 'Les dossiers de pertes conservés ne permettent plus ce départ.';
      if(world.piles.length+additionalPiles>32768||!Number.isSafeInteger(world.nextId+additionalPiles))return 'Le nombre de biens ou d’identités disponibles est dépassé.';
      if(world.schemaVersion<256&&members.some(p=>items.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id).length>256))return 'Un inventaire dépasse 256 piles.';
      return undefined;
    },
  };
}

export function groupMemberChoices(w:World):readonly GroupMemberChoice[] {
  return w.pawns.filter(p=>w.schemaVersion>=257?isColonist(p)||!!p.prisoner||autoCapturePatient259(w,p):isColonist(p)&&!p.prisoner&&!p.visitor).map(p=>{
    const reason=w.group?'Un groupe est déjà engagé.':groupMemberReason(w,p);return {pawn:p,ok:!reason,...reason?{reason}:{}};
  });
}
export function groupSourceChoices(w:World):readonly GroupSourceChoice[] {
  const current=Number(w.schemaVersion)>=298,place=current?captureCaravanSourceAccess298(w):undefined;
  const reservations=current?reservedSourcesByPile(w):undefined;
  const own=current&&w.group&&'manifest'in w.group?groupReservedSources(w.group):undefined;
  const reservedFor=(p:MaterialPile)=>reservations?(reservations.get(p.id)??0)-(own?.get(p.id)??0):reservedSource(w,p.id);
  return w.piles.filter(p=>p.owner.type==='ground'&&(regularGroupFreight258(p,w.schemaVersion)&&(!['wood','steel'].includes(p.item)||!w.group||freightGroup(w.group))||w.schemaVersion>=256&&groupCaravanFood256(p.item)||['survival-meal','silver','cloth','muffalo-wool',...(w.schemaVersion>=GROUP_FREIGHT_SCHEMA&&(!w.group||freightGroup(w.group))?['wood','steel']:[]),...(w.schemaVersion>=GROUP_PROVISIONS_SCHEMA&&(!w.group||mixedGroupProvisions(w.group))?['pemmican']:[])].includes(p.item))&&(!place||!place(p)&&reservedFor(p)===0)).map(p=>{
    const reserved=reservedFor(p);return {pile:p,reserved,available:Math.max(0,p.quantity-reserved),...!current&&w.schemaVersion>=258&&!materialAllowedForPlayer256(p)?{reason:'Ce bien est interdit.'}:p.foodPoison?{reason:'Provision contaminée.'}:p.item==='pemmican'&&!freshGroupProvision(p,w.tick)?{reason:'Provision périmée.'}:{}};
  });
}
function viewMass(mass:GroupMassCapture,items:readonly MaterialPile[],tick:number,mixed:boolean):GroupMassView {
  const counts=groupProvisionCounts(items.filter(p=>p.owner.type==='inventory'&&(mixed||p.item!=='pemmican')),tick);
  return {grams:mass.grams,capacityGrams:mass.capacityGrams,byMember:mass.carriers,...mass.ridingFactor!==undefined?{ridingFactor:mass.ridingFactor}:{},...counts};
}
export function previewFormation(w:World,ids:readonly number[],sources:readonly CommercialBuyLine[],destination:number,packedIds:readonly number[]=[],animalIds:readonly number[]=[],retreat261=false) {
  const campaignMap=w.campaignMap,legacyMap=campaignMap&&campaignMap.revision!==2?campaignMap:undefined;
  const origin=w.worldMaps?w.worldMaps.sites.find(s=>s.id===registeredMapId(w))?.tile:campaignMap?.revision===2?campaignMap.maps.find(s=>s.id===campaignMap.activeMapId)?.tile:w.expeditionSite?.tile??w.planet?.homeTile;
  if(!w.planet||!groupDestinationValid(w.planet,destination)||destination===origin&&!((Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))&&retreat261))return {kind:'refused' as const,reason:'Choisissez une destination terrestre différente de la carte actuelle.'};
  const visit=campaignAuthority(w).secondarySite?.visit;
  if(w.schemaVersion<255&&!w.expeditionSite&&(visit||legacyMap?.visitIds.length))return {kind:'refused' as const,reason:'Une expédition est déjà présente sur le second site.'};
  if(w.schemaVersion<255&&w.expeditionSite){
    if(destination!==w.planet.homeTile)return {kind:'refused' as const,reason:'Cette première expédition repart vers le foyer.'};
    const roster=visit?.memberIds??legacyMap?.visitIds??[];
    const living=roster.filter(id=>w.pawns.some(p=>p.id===id&&p.state!=='dead'));
    if(living.length!==ids.length||living.some(id=>!ids.includes(id)))return {kind:'refused' as const,reason:'Choisissez tous les membres vivants de l’expédition pour le retour.'};
  }
  if(w.group||w.scout||w.commercialTrip)return {kind:'refused' as const,reason:'Un groupe ou voyage est déjà engagé.'};
  if(!Number.isSafeInteger(w.planet.nextGroupId+1))return {kind:'refused' as const,reason:'Le registre des groupes est plein.'};
  const authority=groupFormationAuthority(w),selected=ids.map(id=>w.pawns.find(p=>p.id===id)).filter((p):p is Pawn=>!!p);const animal=previewGroupAnimals256(w,animalIds,w.schemaVersion>=257?selected.filter(groupHumanHandler257):selected,(p,c)=>authority.reachable(p,c));if(animal.kind!=='ready')return animal;
  const human=w.schemaVersion>=257?previewGroupHumanPreparation257(w,selected,(p,c)=>authority.reachable(p,c),animal.preparation?.lines.filter(l=>l.mode==='carry').map(l=>l.handlerId)):undefined;if(human&&!human.ok)return {kind:'refused' as const,reason:human.reason};
  const piles=previewGroupLoading(w,ids,sources,authority,animalIds);if(piles.kind!=='ready')return piles;
  const beds=w.schemaVersion>=256?previewGroupBedrollLoading256(w,packedIds,piles.capture.members,piles.mass,(p,c)=>authority.reachable(p,c)?'reachable':'unreachable',piles.capture.animals??[],animal.preparation?.lines.filter(l=>l.mode==='carry').map(l=>l.handlerId)??[]):packedIds.length?{kind:'refused' as const,reason:'Chargement de couchages futur.'}:undefined;if(beds&&beds.kind!=='ready')return beds;const loading=beds?{...piles,mass:beds.preview.mass}:piles;const bedrollLoading=beds?.preview.loading.manifest.length?beds.preview.loading:undefined;
  if(w.schemaVersion<256&&loading.capture.members.some(p=>loading.capture.items.filter(i=>'pawnId' in i.owner&&i.owner.pawnId===p.id).length+loading.manifest.filter(l=>l.carrierId===p.id).length>256))return {kind:'refused' as const,reason:'Un inventaire dépasserait 256 piles.'};
  const food=loading.capture.items.filter(p=>p.owner.type==='inventory'&&p.item==='survival-meal'&&!p.foodPoison).reduce((n,p)=>n+p.quantity,0)+loading.manifest.filter(l=>l.item==='survival-meal').reduce((n,l)=>n+l.quantity,0);
  if(w.schemaVersion<256&&(w.schemaVersion>=GROUP_PROVISIONS_SCHEMA?!groupProvisionMinimum(loading.capture.members,[...loading.capture.items.filter(p=>p.owner.type==='inventory'),...loading.manifest.map(line=>({...loading.capture.sources.get(line.pileId)!,quantity:line.quantity}))],w.foodPolicies,w.tick):food<loading.capture.members.length))return {kind:'refused' as const,reason:w.schemaVersion>=GROUP_PROVISIONS_SCHEMA?'Les provisions doivent fournir au moins 0,9 nutrition saine par membre selon les régimes, sans partager deux fois les mêmes unités.':'Chargez au moins une ration saine par membre.'};
  const route=findPlanetRoute(w.planet,origin!,destination,planetCostContext(w,loading.mass),queryBudget(w));
  if(route.kind!=='found')return {kind:'refused' as const,reason:route.kind==='deferred'?'Le calcul de route attend une nouvelle tentative.':'Cette destination est inaccessible.'};
  const rendezvous={x:loading.capture.members[0]!.x,z:loading.capture.members[0]!.z},used=new Set<number>();
  const others=new Set(w.pawns.filter(p=>!ids.includes(p.id)).map(p=>p.z*w.width+p.x));
  const spots:Cell[]=[];const radius=w.schemaVersion>=256?Math.max(w.width,w.height):2;for(let z=Math.max(0,rendezvous.z-radius);z<=Math.min(w.height-1,rendezvous.z+radius);z++)for(let x=Math.max(0,rendezvous.x-radius);x<=Math.min(w.width-1,rendezvous.x+radius);x++)spots.push({x,z});
  spots.sort((a,b)=>((a.x-rendezvous.x)**2+(a.z-rendezvous.z)**2)-((b.x-rendezvous.x)**2+(b.z-rendezvous.z)**2)||a.z-b.z||a.x-b.x);
  const meeting:{pawnId:number;cell:Cell}[]=[];
  for(const p of loading.capture.members){const cell=spots.find(c=>authority.stand(c)&&!used.has(c.z*w.width+c.x)&&!others.has(c.z*w.width+c.x)&&authority.reachable(p.state==='downed'?selected.find(q=>q.id===human?.preparation.passengers.find(l=>l.pawnId===p.id)?.carrierId)??p:p,c));
    if(!cell)return {kind:'refused' as const,reason:'Le groupe ne dispose pas de places de rassemblement accessibles.'};
    used.add(cell.z*w.width+cell.x);meeting.push({pawnId:p.id,cell:{...cell}});
  }
  const exits:{pawnId:number;cell:Cell}[]=[],edgeUsed=new Set<number>(),edges:Cell[]=[];
  for(let x=0;x<w.width;x++){edges.push({x,z:0},{x,z:w.height-1});}for(let z=1;z<w.height-1;z++)edges.push({x:0,z},{x:w.width-1,z});
  for(const p of loading.capture.members){const ranked=[...edges].sort((a,b)=>((a.x-p.x)**2+(a.z-p.z)**2)-((b.x-p.x)**2+(b.z-p.z)**2)||a.z-b.z||a.x-b.x);
    const cell=ranked.find(c=>!edgeUsed.has(c.z*w.width+c.x)&&authority.stand(c)&&authority.reachable(p.state==='downed'?selected.find(q=>q.id===human?.preparation.passengers.find(l=>l.pawnId===p.id)?.carrierId)??p:p,c));
    if(!cell)return {kind:'refused' as const,reason:'Tous les membres doivent disposer d’une sortie accessible.'};
    edgeUsed.add(cell.z*w.width+cell.x);exits.push({pawnId:p.id,cell:{...cell}});
  }
  return {kind:'ready' as const,loading,route,rendezvous,meeting,exits,bedrollLoading,animalPreparation:animal.preparation,...human?.ok?{humanPreparation:human.preparation}:{}};
}
export function previewGroupFormation(w:World,ids:readonly number[],sources:readonly CommercialBuyLine[],destination:number,packedIds:readonly number[]=[],animalIds:readonly number[]=[],retreat261=false):GroupFormationPreview {
  const p=previewFormation(w,ids,sources,destination,packedIds,animalIds,retreat261);if(p.kind!=='ready')return {ok:false,reason:p.kind==='deferred'?'La préparation attend une nouvelle tentative.':p.reason};
  const mass=viewMass(p.loading.mass,p.loading.capture.items,w.tick,w.schemaVersion>=GROUP_PROVISIONS_SCHEMA);
  const selected=groupProvisionCounts(p.loading.manifest.map(line=>({...p.loading.capture.sources.get(line.pileId)!,quantity:line.quantity})),w.tick);
  mass.rations+=selected.rations;mass.pemmicanUnits+=selected.pemmicanUnits;mass.provisionNutrition+=selected.provisionNutrition;
  const provisions=w.schemaVersion>=256?estimateGroupTravel(w,{members:p.loading.capture.members,animals:p.loading.capture.animals??[],items:[...p.loading.capture.items.filter(i=>i.owner.type==='inventory'),...p.loading.manifest.map(line=>({...p.loading.capture.sources.get(line.pileId)!,quantity:line.quantity}))],route:p.route.tiles,mass:p.loading.mass}):undefined;
  return {ok:true,route:p.route.tiles,mass,carriers:p.loading.manifest.map(l=>({pileId:l.pileId,pawnId:l.carrierId,quantity:l.quantity})),...provisions?{provisions}:{}};
}
export function groupRoutePreview(w:World,destination:number):GroupRoutePreview {
  const g=w.group;if(!w.planet||!away(g))return {ok:false,reason:'Aucun groupe hors carte.'};
  const mass=captureGroupMass(g.members,g.items,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return {ok:false,reason:'Inventaire du groupe invalide.'};
  const context=planetCostContext(w,mass),from=g.segment?.to??g.tile,route=findPlanetRoute(w.planet,from,destination,context,queryBudget(w));
  if(route.kind!=='found')return {ok:false,reason:'Cette destination est inaccessible.'};
  const provisions=w.schemaVersion>=256?estimateGroupTravel(w,{members:g.members,animals:g.animalOwners?.members??[],items:g.items.filter(i=>i.owner.type==='inventory'),route:route.tiles,mass,...g.segment?{initial:{tile:g.tile,elapsedCore:Math.max(0,g.segment.remainingCore)}}:{}}):undefined;
  return {ok:true,route:route.tiles,durationCore:provisions?.ok?provisions.durationCore:route.estimatedCore+(g.segment?.remainingCore??0),...provisions?{provisions}:{}};
}
function tradeEnvironment(w:World,mass:GroupMassCapture):GroupTradeEnvironment {
  if(w.planet?.revision===3){const g=w.group;if(!away(g))throw Error('No actual trade group');const target=groupGeographicTradeTarget256(w,g);return {tick:w.tick,nextId:w.nextId,version:w.schemaVersion,siteTile:g.tile,siteOpen:!!target,post:target?.post,mass,pileCountElsewhere:w.piles.length,...target?{siteOwner:{settlementId:target.settlementId,factionId:target.factionId,postId:target.postId}}:{}};}
  return {tick:w.tick,nextId:w.nextId,version:w.schemaVersion,siteTile:(()=>{const tile=w.planet!.civilianTile;if(tile===null)throw Error('No real civilian destination');return tile;})(),siteOpen:true,post:w.civilianPost,mass,pileCountElsewhere:w.piles.length+(w.scout&&'items' in w.scout?w.scout.items.length:0)+(w.commercialTrip&&'items' in w.commercialTrip?w.commercialTrip.items.length:0)};
}
export function groupTradeQuote(w:World,direction:'buy'|'sell',lines:readonly CommercialBuyLine[]):GroupTradePreview {
  const g=w.group;if(!w.planet||!away(g))return {ok:false,reason:'Le groupe doit rejoindre un vrai comptoir civil.'};
  const mass=captureGroupMass(g.members,g.items,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return {ok:false,reason:'Inventaire du groupe invalide.'};
  const env=tradeEnvironment(w,mass),q=quoteGroupTrade(g,env,direction,lines);if(!q.ok)return q;
  // A private draft gives an exact reviewable distribution; no World ID or
  // stock is adopted by a preview and the command rebuilds the entire draft.
  const draft=lines.length?draftGroupTrade(g,env,direction,lines,q.signature):null;
  if(lines.length&&!draft)return {ok:false,reason:'Ce panier ne peut pas être réparti dans les inventaires disponibles.'};
  const final=draft?captureGroupMass(draft.group.members,draft.group.items,freightGroup(draft.group),w.schemaVersion,draft.group.packed,draft.group.animalOwners?.members):mass;if(!final)return {ok:false,reason:'La charge du panier est invalide.'};
  return {ok:true,signature:q.signature,totalSilver:q.totalSilver,mass:viewMass(final,draft?.group.items??g.items,w.tick,mixedGroupProvisions(g))};
}
export function groupPermission(w:World):GroupPermissionView {
  const legacyMap=w.campaignMap&&w.campaignMap.revision!==2?w.campaignMap:undefined;
  const g=w.group,animalIds=g?away(g)?g.animalOwners?.members.map(a=>a.id)??[]:'manifest'in g?g.animalPreparation?.lines.map(l=>l.animalId)??[]:g.animalIds??[]:[],ids=g&&!away(g)?new Set([...g.memberIds,...animalIds]):undefined;
  const members=away(g)?g.members:ids?w.pawns.filter(p=>ids.has(p.id)):[],items=away(g)?g.items:ids?w.piles.filter(p=>'pawnId' in p.owner&&ids.has(p.owner.pawnId)):[];
  const mass=g?captureGroupMass(members,items,freightGroup(g),w.schemaVersion,away(g)?g.packed:w.packed.filter(p=>p.owner.type==='inventory'&&ids?.has(p.owner.pawnId)),away(g)?g.animalOwners?.members:w.wildlife?.animals.filter(a=>animalIds.includes(a.id))):undefined;
  const actions:Record<GroupPanelAction,GroupActionPermission>={adopt:{ok:!w.planet},start:{ok:!!w.planet&&!g&&!w.scout&&!w.commercialTrip&&(w.schemaVersion>=255||!!w.expeditionSite||!(w.secondarySite?.visit||legacyMap?.visitIds.length))},cancel:{ok:!!g&&!away(g)},pause:{ok:away(g)},route:{ok:away(g)},return:{ok:away(g)},buy:{ok:false},sell:{ok:false},unload:{ok:!!w.planet&&(!g||g.phase==='unloading')}};
  let trade:GroupPermissionView['trade']=null;
  if(w.planet&&away(g)&&g.phase==='at-site'&&(w.planet.revision===3||w.planet.civilianTile!==null&&g.tile===w.planet.civilianTile)&&mass){
    const env=tradeEnvironment(w,mass),buy=quoteGroupTrade(g,env,'buy',[]),sell=quoteGroupTrade(g,env,'sell',[]),negotiator=bestGroupNegotiator(g.members,w.schemaVersion)??null;
    const goods=(q:typeof buy,direction:'buy'|'sell')=>q.ok?q.goods.map(good=>({pile:(direction==='buy'?env.post!.stock:g.items).find(p=>p.id===good.pileId)!,available:good.available,unitPrice:good.unitPrice})):[];
    trade={negotiator,...!buy.ok?{refusal:buy.reason}:{},groupSilver:g.items.filter(p=>p.owner.type==='inventory'&&p.item==='silver').reduce((n,p)=>n+p.quantity,0),postSilver:env.post?.stock.filter(p=>p.item==='silver').reduce((n,p)=>n+p.quantity,0)??0,buys:goods(buy,'buy'),sells:goods(sell,'sell')};
    actions.buy={ok:buy.ok,...!buy.ok?{reason:buy.reason}:{}};actions.sell={ok:sell.ok,...!sell.ok?{reason:sell.reason}:{}};
  }
  return {originTile:away(g)?g.tile:w.expeditionSite?.tile??w.planet?.homeTile??0,originLabel:away(g)?'Groupe':w.expeditionSite?'Expédition':'Foyer',maximumSources:w.schemaVersion>=256?w.piles.length:64,mass:mass?viewMass(mass,items,w.tick,!!g&&mixedGroupProvisions(g)):null,confirmedRoute:away(g)?g.route:[],actions,trade,...isSchema274OrLater(Number(w.schemaVersion))?{gift274:quoteGroupGift274(w,[])}:{}};
}
export function cancelPawnGroupPreparation257(w:World,id:number):void {const row=pawnWorldGroup(w,id);if(row)withWorldGroup(w,row.state.id,cancelGroupPreparation);else cancelGroupPreparation(w);}
export function cancelGroupPreparation(w:World):void {
  const g=w.group;if(!g||away(g))return;
  if('manifest'in g)releaseGroupHumanPassengers257(w,g);
  for(const p of w.pawns)if(g.memberIds.includes(p.id)){
    if('manifest'in g&&g.humanPreparation?.releaseIds.includes(p.id))continue;
    // A danger owner may already have replaced the formation path this tick.
    // Its route, captured edge, strike and recovery belong to that activity.
    if(p.flee||p.melee||p.shooting||p.burning||p.bombRefuge||p.heatRefuge)continue;
    p.path=[];p.planCooldown=0;if(!['dead','downed'].includes(p.state))p.state='idle';
  }
  if('manifest'in g)releaseGroupAnimals256(w,g);
  delete w.group;
}
export function applyGroupCommand(w:World,c:GroupCommand):CommandResult {
  if(w.schemaVersion<255&&!secondaryLocalGroupAllowed(w,c.type))return fail('Sur le second site, formez une caravane vers le foyer ou terminez le chargement en cours.');
  if(w.schemaVersion<255&&c.type==='group-start'&&!w.expeditionSite&&campaignAuthority(w).secondarySite?.visit)return fail('Une expédition est déjà présente sur le second site.');
  if(c.type==='planet-adopt'){if(!w.planet){w.planet=generatePlanet(w.seed,planetHomeInput(w),w.tick,w.site?.biome==='tundra'?2:1);initialWorldRegistry(w);groupLog(w,'La planète et ses destinations sont maintenant accessibles.');}return {ok:true};}
  if(c.type==='group-carry-sick')return setGroupCaravanCarrySick256(w,c);
  if(c.type==='group-start'){
    const p=previewFormation(w,c.memberIds,c.sources,c.destination,c.packedIds??[],c.animalIds??[]);if(p.kind!=='ready')return fail(p.kind==='deferred'?'La préparation attend une nouvelle tentative.':p.reason);
    const id=w.planet!.nextGroupId;
    w.group={...(w.worldMaps&&w.worldMaps.sites.find(s=>s.id===registeredMapId(w))?.tile!==w.planet!.homeTile?{originTile:w.worldMaps.sites.find(s=>s.id===registeredMapId(w))!.tile!}:w.expeditionSite?{originTile:w.expeditionSite.tile}:{}),id,startedAt:w.tick,destination:c.destination,ledger:emptyGroupLedger(),...(w.schemaVersion>=GROUP_PROVISIONS_SCHEMA?{provisions:newGroupProvisions()}:{}),...(w.schemaVersion>=GROUP_FREIGHT_SCHEMA?{freight:newGroupFreight()}:{}),...p.bedrollLoading?{bedrollLoading:p.bedrollLoading}:{},...p.animalPreparation?{animalPreparation:p.animalPreparation}:{},...p.humanPreparation?{admission:{revision:newGroupAdmissionRevision259(w)},humanPreparation:p.humanPreparation}:{},...(w.schemaVersion>=256?{travelPreparation:true as const}:{}),phase:'gathering',memberIds:p.loading.capture.members.map(p=>p.id),rendezvous:p.rendezvous,meeting:p.meeting,manifest:p.loading.manifest,cursor:0,exits:p.exits};
    // Formation has passed every preview. Its real position authority now
    // supersedes only this local job; the captured edge and goods stay owned.
    for(const a of p.loading.capture.animals??[])delete a.animalThermalRefuge288;
    w.planet!.nextGroupId++;groupLog(w,'Le groupe se rassemble avant le chargement des provisions.');return {ok:true};
  }
  if(c.type==='group-cancel'){if(!w.group||away(w.group))return fail('Aucune préparation ou décharge à annuler.');cancelGroupPreparation(w);return {ok:true};}
  if(c.type==='group-pause'){if(!away(w.group))return fail('Aucun groupe hors carte.');w.group.paused=c.paused;return {ok:true};}
  if(c.type==='group-route'){
    const g=w.group;if(!w.planet||!away(g))return fail('Aucun groupe hors carte.');
    const mass=captureGroupMass(g.members,g.items,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return fail('Inventaire du groupe invalide.');
    const p=prepareGroupRedirection(w.planet,g,c.destination,planetCostContext(w,mass),queryBudget(w));
    if(p.kind!=='ready')return fail(p.kind==='deferred'?'Le calcul de route attend une nouvelle tentative.':p.reason);
    w.group=p.state;return {ok:true};
  }
  if(c.type==='group-unload'){
    const current=w.group;
    if(current?.phase==='unloading')return c.memberIds.length===current.memberIds.length&&c.memberIds.every(id=>current.memberIds.includes(id))?{ok:true}:fail('Ce déchargement appartient à un autre groupe.');
    if(!w.planet||w.group||w.scout||w.commercialTrip||!Array.isArray(c.memberIds)||!c.memberIds.length||c.memberIds.length>(w.schemaVersion>=256?w.nextId-1:8)||new Set(c.memberIds).size!==c.memberIds.length)return fail('Choisissez des colons présents pour décharger.');
    const members=c.memberIds.map(id=>w.pawns.find(p=>p.id===id));
    if(members.some(p=>!p||!isColonist(p)||p.prisoner||p.visitor||scoutUnstable(p,w)||scoutActiveTask(p)||p.state!=='idle'))return fail('Les porteurs doivent être libres et présents.');
    const animals=(c.animalIds??[]).map(id=>w.wildlife?.animals.find(a=>a.id===id));if(animals.some(a=>!a||groupAnimalReason256(w,a)))return fail('Les animaux à décharger doivent être présents et disponibles.');
    const ids=new Set([...c.memberIds,...c.animalIds??[]]),items=w.piles.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId));
    const packs=w.packed.filter(p=>p.owner.type==='inventory'&&ids.has(p.owner.pawnId));if(!validCaravanBedrollPacks256(packs,[...members as Pawn[],...animals.filter((a):a is import('./wildlife-state.ts').WildAnimal=>!!a)],w.nextId,w.schemaVersion))return fail('Couchage porté inadmissible.');
    if(!items.length&&!packs.length||items.some(p=>!(p.item==='ai-core'&&regularGroupFreight258(p,w.schemaVersion))&&!(p.item==='novel'&&(Number(w.schemaVersion)===295||(Number(w.schemaVersion)===296||isCorePhysicalSchema297(Number(w.schemaVersion))))&&regularGroupFreight258(p,w.schemaVersion))&&!(w.schemaVersion>=265&&['hops','wort','beer'].includes(p.item))&&!(w.schemaVersion>=256&&groupCaravanFood256(p.item))&&!['survival-meal','silver','cloth','muffalo-wool','medicine','component',...(w.schemaVersion>=GROUP_FREIGHT_SCHEMA?['wood','steel']:[]),...(w.schemaVersion>=GROUP_PROVISIONS_SCHEMA?['pemmican']:[])].includes(p.item)))return fail('Aucune provision admissible à décharger.');
    if(!Number.isSafeInteger(w.planet.nextGroupId+1))return fail('Le registre des groupes est plein.');
    w.group={id:w.planet.nextGroupId++,startedAt:w.tick,destination:w.planet.homeTile,ledger:emptyGroupLedger(),...(w.schemaVersion>=GROUP_PROVISIONS_SCHEMA?{provisions:newGroupProvisions()}:{}),...(w.schemaVersion>=GROUP_FREIGHT_SCHEMA?{freight:newGroupFreight()}:{}),phase:'unloading',memberIds:[...c.memberIds].sort((a,b)=>a-b),...c.animalIds?.length?{animalIds:[...c.animalIds]}:{},pendingPileIds:items.map(p=>p.id),...packs.length?{pendingPackedIds:packs.map(p=>p.building.id)}:{}};return {ok:true};
  }
  if(c.type==='group-gift274'){const g=w.group;if(!g||g.id!==c.groupId)return fail('La caravane ciblée est absente.');const plan=prepareGroupGift274(w,c.lines,c.quote);if(!plan.ok)return fail(plan.reason);plan.commit();return {ok:true};}
  if(c.type==='group-buy'||c.type==='group-sell'){
    const g=w.group;if(!w.planet||!away(g))return fail('Le commerce exige un groupe présent au comptoir civil.');
    const mass=captureGroupMass(g.members,g.items,freightGroup(g),w.schemaVersion,g.packed,g.animalOwners?.members);if(!mass)return fail('Inventaire du groupe invalide.');
    const env=tradeEnvironment(w,mass),direction=c.type==='group-buy'?'buy':'sell',draft=draftGroupTrade(g,env,direction,c.lines,c.quote);
    if(!draft)return fail('Le devis, le stock, les fonds ou la charge du groupe ont changé.');
    // Pure transfer draft is complete before this closed adoption. Original
    // Pawn owners never change, and all goods/currency/counters adopt together.
    // Schema 338: Core Faction.Notify_PlayerTraded on the settlement's faction.
    const goodwill=env.siteOwner?planTradeGoodwill338(registeredCampaign(w).worldFactions,env.siteOwner.factionId,draft.sold338,w.schemaVersion):undefined;
    if(env.siteOwner)commitGeographicGroupPost256(w,env.siteOwner.postId,draft.post);else w.civilianPost=draft.post;w.group=draft.group;w.nextId=draft.nextId;
    groupLog(w,direction==='buy'?'Le groupe a acheté les marchandises au comptoir.':'Le groupe a vendu son fret au comptoir.');
    if(goodwill)groupLog(w,applyTradeGoodwill338(goodwill));
    return {ok:true};
  }
  return fail('Commande de groupe inconnue.');
}
