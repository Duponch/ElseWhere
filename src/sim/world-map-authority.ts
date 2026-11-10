import {assignPileOwner} from './pile-index.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {isPlayerCasket271} from './cryptosleep-state-271.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {actualDestroyedSettlement263,prepareDestroyedSettlement263,settleInventoryOwner263,settleInventoryOrigin263,planDestroyedPackedDrop263} from './world-destroyed-settlement-263.ts';
import {prepareWorldTargetMapRemoval263} from './world-target-lifecycle-263.ts';
import {worldTargetRetreatAvailable263} from './world-target-access-263.ts';
import {validGeographicSettlementDimensions262} from './geographic-creation-options-262.ts';
import {prepareReformRetirementSurface260} from './group-reform-retirement-surface-260.ts';
import {heldCasketRemovalPrepared259,beginHeldCasketRemoval259} from './world-pawn-casket-259.ts';
import {resumeTempMapHomeAgendas261} from './temp-map-settlement-261.ts';
import {convertCampRaidOwner260} from './cassandra-raids.ts';
import {prepareMapRemoved259,type ReformDeparture260} from './world-pawn-map-removed-259.ts';
import {newCampPressure260} from './camp-pressure-state-260.ts';
import {isSchema256Or257} from './schema-compatibility-257.ts';
import {prepareCampMapRemoved256} from './world-pawn-map-removed-256.ts';
import {actualNewCampEntryRecipients256} from './camp-entry-recipients-256.ts';
import {CORE_STARTING_ARRIVAL_PROFILE_256} from './starting-pod-state-256.ts';
import {cobraCohortReason256} from './cobra-admission-256.ts';
import {ancientCasketMapRemovalBoundary256} from './ancient-casket-state-256.ts';
import {prepareCampCenterEntry256,applyPreparedCampCenterFog256,type PreparedCampCenterEntry256} from './camp-center-entry-256.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import type {ReadyCampDraft256} from './group-camp-draft-256.ts';
import {prepareGroupAnimalEntry256,commitGroupAnimalEntry256} from './group-animal-entry-256.ts';
import {actorBedEntryAlias256,commitActorBedEntry256} from './actor-map-bed-256.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {planPackedInventoryDrop256} from './group-packed-entry-256.ts';
import {canReturnGroupBedrolls256} from './group-bedroll-capture-256.ts';
import {planetTile} from './planet-geography-256.ts';
import {captureGroupMemberContexts} from './group-member-origin.ts';
import {prepareRemovedMapBeds256} from './actor-bed-transition-256.ts';
import {prepareRemovedMapAreas,commitRemovedMapAreas,beginRemovedMapAreas287,prepareMapAreaEntry,commitMapAreaEntry} from './pawn-map-areas.ts';
import {detachMapOwners} from './world-lost-owners.ts';
import {captureGroupCapturePatients259} from './group-human-projection-259.ts';
import {notifyMapLost,captureNewColonyReceivers259,resetNewColonyMemories259} from './world-map-lost.ts';
import {settlementLimit} from './world-map-options.ts';
import {captureHumanOwners} from './human-owners.ts';
import {captureLocalMap,sharedCampaignData} from './world-map-context.ts';
import type {World,CommandResult,Pawn,MaterialPile} from './types.ts';
import type {CampaignState,CampaignSummary,CampaignMapSummary,MapAction,WorldMapCommand,WorldMapKind,CampaignGroupSummary} from './world-map-state.ts';
import {registeredCampaign,registeredMap,registeredMapId,registeredMaps,selectedRegisteredMap,brandGroupProjection,brandGroupMemberProjection,worldGroupContext,hasLoadedRoot,boundWorldGroup,flushRegisteredMap,promoteRootMap,clearRootMap} from './world-map-context.ts';
import {isColonist,activeThreat} from './affiliation.ts';
import {captureGroupMass} from './group-capture.ts';
import {freightGroup} from './group-freight.ts';
import {dropRetainingIdentity} from './ground-placement.ts';
import {captureCivilianReturnFinder} from './civilian-return.ts';
import {captureStandability} from './furniture-travel.ts';
import {draftSite} from './secondary-site.ts';
import {refreshStock} from './materials.ts';
import {ensureFilth} from './filth-rules.ts';
const ok:MapAction={ok:true},no=(reason:string):MapAction=>({ok:false,reason}),fail=(reason:string):CommandResult=>({ok:false,code:'invalid-command',reason});
const own=(p:MaterialPile,id:number)=>'pawnId' in p.owner&&p.owner.pawnId===id&&['inventory','equipment','apparel','pawn'].includes(p.owner.type);
export function campaignLog(root:CampaignState,message:string):void {const events=root.worldGroups!.events;events.push({tick:root.tick,type:'command',message});if(events.length>80)events.splice(0,events.length-80);}
function settlementAt(root:CampaignState,tile:number):boolean {return (root.planet?.revision===3?!!root.worldFactions?.settlements.some(s=>s.tile===tile):tile===root.planet?.civilianTile)||!!root.worldMaps?.sites.some(s=>s.kind==='settlement'&&s.tile===tile);}
export function settlementTileAction(root:CampaignState,tile:number,existingId?:number):MapAction {
 const planet=root.planet,t=planet?planetTile(planet,tile):undefined;if(!t||t.biome==='ocean'||planet?.revision===3&&(t.biome==='lake'||t.hilliness==='impassable'))return no('Cette tuile ne permet pas une implantation.');
 if(planet?.revision!==3&&t.hilliness==='mountainous')return no('La génération montagneuse de cette révision reste indisponible.');
 if(root.worldMaps!.sites.filter(s=>s.kind==='settlement').length>=settlementLimit(root))return no('Le nombre maximal de colonies est atteint.');
 if(settlementAt(root,tile)&&!root.worldMaps!.sites.some(s=>s.id===existingId&&s.kind!=='settlement'))return no('Une implantation occupe cette tuile.');
 if(t.neighbours.some(id=>settlementAt(root,id)))return no('Une implantation voisine empêche de s’installer ici.');
 if(root.worldMaps!.retired.some(s=>s.tile===tile&&s.reason!=='battlefield-empty'&&(s.markerUntilCore===undefined||s.markerUntilCore>root.tick*10)))return no('Le marqueur d’un site abandonné occupe encore cette tuile.');
 return ok;
}
export function mapActions(input:CampaignState,id:number):CampaignMapSummary['actions'] {
 const root=registeredCampaign(input),record=root.worldMaps?.sites.find(s=>s.id===id),map=record?registeredMap(root,id):undefined;
 if(!record||!map){const missing=no('Cette carte n’existe plus.');return {view:missing,settle:missing,abandon:missing};}
 const destroyed263=actualDestroyedSettlement263(root,record);
 let settle=record.target263&&!destroyed263?no('Ce parent mondial ne permet pas de fonder une colonie ; reformez ou retirez la caravane.'):record.kind==='battlefield'?no('Reformez la caravane avant de fonder une colonie sur un autre site.'):record.kind==='settlement'?no('Ce site est déjà une colonie.'):record.tile===null?no('Aucune tuile mondiale confirmée.'):isSchema263OrLater(Number(root.schemaVersion))?(root.worldMaps!.sites.filter(s=>s.kind==='settlement').length>=settlementLimit(root)?no('Le nombre maximal de colonies est atteint.'):ok):settlementTileAction(root,record.tile,id);
 if(settle.ok&&!map.pawns.some(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead'))settle=no('Un colon libre doit être présent sur la carte.');
 if(settle.ok&&!destroyed263&&(map.pawns.some(p=>p.faction==='outlaws'&&!p.prisoner&&activeThreat(p))||(map.mechanoids??[]).some(m=>!['dead','downed'].includes(m.state))||(map.wildlife?.animals??[]).some(a=>a.manhunter&&a.state!=='dead'&&a.state!=='downed')))settle=no('Terminez la menace active avant de vous installer.');
 const legacy=registeredMaps(root).some(m=>!!m.scout&&'pawn' in m.scout&&m.scout.pawn.state!=='dead'||!!m.commercialTrip&&'pawn' in m.commercialTrip&&m.commercialTrip.pawn.state!=='dead')||root.worldGroups!.legacyTravellers.some(r=>!!r.scout&&'pawn' in r.scout&&r.scout.pawn.state!=='dead'||!!r.commercialTrip&&'pawn' in r.commercialTrip&&r.commercialTrip.pawn.state!=='dead');
 const caravan=legacy||root.worldGroups!.groups.some(g=>'members' in g.state&&g.state.members.some(p=>isColonist(p)&&p.state!=='dead'));
 const elsewhere=registeredMaps(root).some(other=>registeredMapId(other)!==id&&other.pawns.some(p=>isColonist(p)&&!p.prisoner&&p.state!=='dead'));
 return {view:ok,settle,abandon:caravan||elsewhere?ok:no('Conservez une caravane ou un colon libre sur une autre carte avant d’abandonner.')};
}
/** Working population and actual people left behind are distinct. */
const playerHeldMapHumans271=(map:World)=>map.structures.filter(isPlayerCasket271).flatMap(c=>c.cryptosleep.human?[c.cryptosleep.human]:[]);
export function mapChoices(input:CampaignState):CampaignMapSummary[] {const root=registeredCampaign(input);return (root.worldMaps?.sites??[]).map(record=>{const map=registeredMap(root,record.id)!;return {...root.schemaVersion>=256?{areaIds:(map.allowedAreas??[]).map(a=>a.id)}:{},...record.campPressure?{campPressure:{...record.campPressure}}:{},...record.encounters261?{encounters261:record.encounters261}:{},...record.story261?{story261:record.story261}:{},...record.battlefield261?{battlefield261:record.battlefield261}:{},...record.target263?{target263:structuredClone(record.target263)}:{},...record.tempIncidents261?{tempIncidents261:structuredClone(record.tempIncidents261)}:{},id:record.id,tile:record.tile,kind:record.kind,createdAt:record.createdAt,...record.settledAt!==undefined?{settledAt:record.settledAt}:{},pawnCount:map.pawns.length,selected:root.worldMaps!.selectedMapId===record.id,actions:mapActions(root,record.id),abandonConsequences:{pawns:[...map.pawns,...playerHeldMapHumans271(map)].filter(p=>isColonist(p)&&p.state!=='dead').map(p=>({id:p.id,name:p.name})),groundItems:map.piles.filter(p=>p.owner.type==='ground').reduce((n,p)=>n+p.quantity,0),structures:map.structures.length}};});}
export function groupEntryActions(input:CampaignState|CampaignSummary,groupId:number):Record<'visit'|'camp'|'settle',MapAction> {
 if(!('worldMaps' in input)||!input.worldMaps){const rows='campaignMap' in input&&input.campaignMap?.revision===2?input.campaignMap.groups:(input as CampaignSummary).groups;const row=rows?.find(g=>g.id===groupId);return row?.entryActions??{visit:no('Aucun groupe confirmé.'),camp:no('Aucun groupe confirmé.'),settle:no('Aucun groupe confirmé.')};}
 const root=registeredCampaign(input as CampaignState),record=root.worldGroups!.groups.find(g=>g.state.id===groupId),g=record?.state;
 if(record?.pending261||record?.pendingEntry263){const blocked=no('Résolvez la rencontre réelle avant de choisir une entrée.');return {visit:blocked,camp:blocked,settle:blocked};}
 const unavailable=no('Faites réellement arriver le groupe avant d’entrer.');if(!g||!('members' in g)||!['at-site','awaiting-entry',...root.schemaVersion>=256?['stationary']:[]].includes(g.phase)||g.segment||g.tile!==g.destination)return {visit:unavailable,camp:unavailable,settle:unavailable};
 const existing=root.worldMaps!.sites.find(s=>s.tile===g.tile),worldTarget=isSchema263OrLater(Number(root.schemaVersion))&&(!!existing?.target263||!!root.worldSites263?.entries.some(s=>s.tile===g.tile&&(!('closed'in s)||!s.closed))),planet=root.planet,tile=planet?planetTile(planet,g.tile):undefined;let empty=tile&&tile.biome!=='ocean'&&(planet!.revision===3?tile.biome!=='lake'&&tile.hilliness!=='impassable':tile.hilliness!=='mountainous')&&!settlementAt(root,g.tile)?ok:no('Ce terrain n’est pas une entrée locale disponible.');
 if(root.worldMaps!.retired.some(s=>s.tile===g.tile&&s.reason!=='battlefield-empty'&&(s.markerUntilCore===undefined||s.markerUntilCore>root.tick*10)))empty=no('Un objet mondial abandonné occupe cette tuile.');
 if(worldTarget){const target=no('Utilisez le véritable ordre Attaquer ou Visiter de cet objet mondial.');return {visit:target,camp:target,settle:target};}
 return {visit:existing?ok:no('Aucune carte ou site existant à visiter.'),camp:existing?no('Une carte existe déjà sur cette tuile.'):empty,settle:existing?no('Entrez puis utilisez S’installer sur cette carte.'):empty.ok?settlementTileAction(root,g.tile):empty};
}
export function groupChoices(root:CampaignState):CampaignGroupSummary[] {return root.worldGroups!.groups.map(record=>{const g=record.state,map=record.localMapId===null?undefined:registeredMap(root,record.localMapId),ids='members' in g?g.members.map(p=>p.id):g.memberIds,members='members' in g?g.members:map?.pawns.filter(p=>ids.includes(p.id))??[],animalIds='manifest'in g?g.animalPreparation?.lines.map(l=>l.animalId)??[]:'animalIds'in g?g.animalIds??[]:[],animals='members'in g?g.animalOwners?.members:map?.wildlife?.animals.filter(a=>animalIds.includes(a.id)),physicalIds=[...ids,...animals?.map(a=>a.id)??[]],items='members' in g?g.items:map?.piles.filter(p=>'pawnId' in p.owner&&physicalIds.includes(p.owner.pawnId))??[],mass=captureGroupMass(members,items,freightGroup(g),root.schemaVersion,'members'in g?g.packed:map?.packed.filter(p=>p.owner.type==='inventory'&&physicalIds.includes(p.owner.pawnId)),animals);const capturePatients259=captureGroupCapturePatients259(map,record.localMapId,g);return {...isSchema263OrLater(Number(root.schemaVersion))&&record.retreat261?{retreat261:record.retreat261}:{},...record.encounters261?{encounters261:record.encounters261}:{},...record.story261?{story261:record.story261}:{},...record.pending261?{pending261:record.pending261}:{},...record.pendingEntry263?{pendingEntry263:structuredClone(record.pendingEntry263)}:{},...record.arrival261?{arrival261:record.arrival261}:{},...capturePatients259?{capturePatients259}:{},id:g.id,originMapId:record.originMapId,localMapId:record.localMapId,phase:g.phase,originTile:root.worldMaps!.sites.find(s=>s.id===record.originMapId)?.tile??root.worldMaps!.retired.find(s=>s.id===record.originMapId)?.tile??null,filthPresent:!!worldGroupContext(root,g.id)?.filth||root.worldGroups!.abandonedContents.find(a=>a.mapId===record.originMapId)?.filthPresent===true,tile:'tile' in g?g.tile:root.worldMaps!.sites.find(s=>s.id===record.localMapId)?.tile??null,memberIds:ids,mass:mass?{grams:mass.grams,capacityGrams:mass.capacityGrams}:null,state:g,...'members'in g&&g.reorganization?{memberContexts:captureGroupMemberContexts(root as World,[...g.reorganization.memberOrigins,...g.animalOwners?.origins??[]])}:{},...worldGroupContext(root,g.id)?.civilianPost?{postId:record.postId??root.worldGroups!.canonicalPostId!,post:worldGroupContext(root,g.id)!.civilianPost}:{},context:record.context,entryActions:groupEntryActions(root,g.id)};});}
/** Public read-only group façade, including the no-map/globe state. */
export function groupWorld(input:World|CampaignSummary,id:number|null):World|undefined {
 if('worldMaps' in input&&input.worldMaps&&id!==null)return worldGroupContext(input,id);
 const summary='maps' in input?input as CampaignSummary:input.campaignMap?.revision===2?{...input,...input.campaignMap} as unknown as CampaignSummary:undefined;
 if(!summary)return input as World;const row=id===null?undefined:summary.groups.find(g=>g.id===id);if(id!==null&&!row)return;
 const source='tiles' in input&&Array.isArray(input.tiles)&&summary.activeMapId!==null?input as World:undefined;
 const view={...source,...summary,...row?.context,seed:row?.context.seed??summary.campaignSeed,width:row?.context.width??summary.mapSize.width,height:row?.context.height??summary.mapSize.height,pawns:source?.pawns??[],piles:source?.piles??[],packed:source?.packed??[],jobs:source?.jobs??[],resources:source?.resources??[],structures:source?.structures??[],stockpiles:source?.stockpiles??[],tiles:source?.tiles??[],...row?{group:row.state,...row.post?{civilianPost:row.post}:{}}:{},...(summary.planet?.revision===3?{campaignMap:{...summary,revision:2}}:{}),campaignPeople:summary.people??('campaignPeople' in input?input.campaignPeople:undefined),groupLosses:summary.groupLosses} as World;
 const owned=new Set(view.pawns.map(p=>p.id));if(view.group&&'members'in view.group)for(const p of view.group.members)owned.add(p.id);for(const loss of view.groupLosses??[])owned.add(loss.pawn.id);view.campaignPeople=view.campaignPeople?.filter(p=>!owned.has(p.id));if(row){brandGroupProjection(view,{originMapId:row.originMapId,localMapId:row.localMapId,context:row.context,state:row.state,...isSchema263OrLater(Number(view.schemaVersion))&&row.retreat261?{retreat261:row.retreat261}:{},...isSchema263OrLater(Number(view.schemaVersion))&&row.encounters261?{encounters261:row.encounters261}:{}},row.originTile,row.filthPresent);if(row.memberContexts)brandGroupMemberProjection(view,row.memberContexts);}return view;
}
function inventoryDropPlan(map:World,hosted263=false):MaterialPile[]|undefined {const view={...map,piles:map.piles.map(p=>({...p,owner:{...p.owner}}))};for(const pile of view.piles)if(pile.owner.type==='inventory'){const ownerId=pile.owner.pawnId,pawn=map.pawns.find(p=>p.id===ownerId)??(map.schemaVersion>=256?map.wildlife?.animals.find(a=>a.id===ownerId):undefined);if(!pawn||(hosted263?!settleInventoryOwner263(map,ownerId):'species'in pawn?!pawn.domestic:!isColonist(pawn)&&!pawn.visitor))continue;if(!dropRetainingIdentity(view,pile,hosted263?settleInventoryOrigin263(map,pawn):pawn))return;}return view.piles;}
export function settleRegisteredMap(root:CampaignState,id:number):CommandResult {const permission=mapActions(root,id).settle;if(!permission.ok)return fail(permission.reason!);const map=registeredMap(root,id)!,record=root.worldMaps!.sites.find(s=>s.id===id)!,modern263=isSchema263OrLater(Number(root.schemaVersion)),destroyed263=!!record.target263;const conversion=destroyed263?prepareDestroyedSettlement263(root,map,record):undefined;if(destroyed263&&!conversion)return fail('Le parent détruit ou ses récipients réels ne peuvent recevoir la fondation.');const planned=inventoryDropPlan(map,modern263),packs=planned&&root.schemaVersion>=256?(modern263?planDestroyedPackedDrop263({...map,piles:planned}):planPackedInventoryDrop256({...map,piles:planned})):undefined;if(!planned||root.schemaVersion>=256&&!packs)return fail('Le sol ne permet pas de déposer tous les inventaires.');const receivers=(Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||Number(root.schemaVersion)===261||Number(root.schemaVersion)===262)&&!root.worldMaps!.sites.some(s=>s.kind==='settlement')?captureNewColonyReceivers259(root):undefined;if(conversion&&!conversion.current())return fail('La source réelle de l’établissement détruit a changé.');for(let i=0;i<planned.length;i++)assignPileOwner(map.piles[i]!,planned[i]!.owner);if(packs)for(let i=0;i<packs.length;i++)assignPileOwner(map.packed[i]!,packs[i]!.owner);conversion?.commit();if(!conversion)convertCampRaidOwner260(map);record.kind='settlement';delete record.campPressure;if(!conversion)resumeTempMapHomeAgendas261(map);if((Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))))record.settledAt=root.tick;refreshStock(map);flushRegisteredMap(map);if(receivers)resetNewColonyMemories259(root,id,'new-colony-settled',receivers);campaignLog(root,destroyed263?'L’établissement détruit devient une colonie, avec sa carte et ses propriétaires réels.':'Le camp devient une colonie, avec sa carte, ses habitants et ses biens réels.');return {ok:true};}
/** Centre entry for genuinely new Camp/Settle; no terrain or resource is cleared. */
function centreEntries(map:World,count:number):{x:number;z:number}[]|undefined {const stand=captureStandability(map),result:{x:number;z:number}[]=[],cx=Math.floor(map.width/2),cz=Math.floor(map.height/2),used=new Set(map.pawns.map(p=>p.z*map.width+p.x));for(let r=0;r<Math.max(map.width,map.height);r++)for(let z=Math.max(0,cz-r);z<=Math.min(map.height-1,cz+r);z++)for(let x=Math.max(0,cx-r);x<=Math.min(map.width-1,cx+r);x++){if(Math.max(Math.abs(x-cx),Math.abs(z-cz))!==r||used.has(z*map.width+x)||!stand({x,z}))continue;used.add(z*map.width+x);result.push({x,z});if(result.length===count)return result;}return;}
export function enterRegisteredSite(root:CampaignState,groupId:number,mode:'visit'|'camp'|'settle',select=true,preparedCamp?:ReadyCampDraft256):CommandResult {
 if(preparedCamp&&((preparedCamp.settlement?mode!=='settle':mode!=='camp')||preparedCamp.groupId!==groupId||root.planet?.revision!==3||!preparedCamp.current(root)))return fail('La carte préparée ne correspond plus à cette campagne et ce groupe.');
 const permission=groupEntryActions(root,groupId)[mode];if(!permission.ok)return fail(permission.reason!);const record=root.worldGroups!.groups.find(g=>g.state.id===groupId)!,g=record.state;if(!('members' in g))return fail('Le groupe ne possède pas de voyageurs.');
 let site=root.worldMaps!.sites.find(s=>s.tile===g.tile),draft:ReturnType<typeof draftSite>|undefined,newSite=!site;
 if(!site){if((Number(root.schemaVersion)===260||Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&mode==='camp'&&!newCampPressure260(root.tick*10))return fail('L’échéance de pression du camp dépasserait l’horloge sûre.');if(!Number.isSafeInteger(root.worldMaps!.nextMapId+1))return fail('Le registre des cartes est plein.');if(root.planet?.revision===3){if(!preparedCamp||(mode==='settle'?!preparedCamp.settlement:mode!=='camp'||!!preparedCamp.settlement))return fail('La génération géographique exige le vrai contexte local confirmé.');if(mode==='settle'&&!validGeographicSettlementDimensions262(root.schemaVersion,preparedCamp.draft.site.map.width,preparedCamp.draft.site.map.height,root.worldMaps!.mapSize))return fail('La carte préparée ne conserve pas la taille de colonie configurée.');draft=preparedCamp.draft;}else{const context=worldGroupContext(root,groupId)!;context.seed=root.worldMaps!.campaignSeed;context.width=mode==='camp'?200:root.worldMaps!.mapSize.width;context.height=mode==='camp'?200:root.worldMaps!.mapSize.height;draft=draftSite(context,g.tile,mode==='camp'?'camp':'settlement');}if(!draft)return fail('La génération de cette tuile est refusée.');site={...(Number(root.schemaVersion)===260||Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&mode==='camp'?{campPressure:newCampPressure260(root.tick*10)!}:{},id:root.worldMaps!.nextMapId,tile:g.tile,kind:mode==='camp'?'camp':'settlement',createdAt:root.tick,...(Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))&&mode==='settle'?{settledAt:root.tick}:{},map:draft.site.map,visit:null};}
 const map=site.id===root.worldMaps!.rootMapId?root as World:site.map?{...site.map,...sharedCampaignData(root),...draft?{nextId:draft.nextId}:{}} as World:undefined;if(!map||map.pawns.length+g.members.length>map.width*map.height||map.piles.length+g.items.length>32768)return fail('La carte ne peut accueillir tous les voyageurs et leurs biens.');
 if(map.schemaVersion>=256&&[...map.wildlife?.animals??[],...g.animalOwners?.members??[]].some(a=>a.species==='cobra'&&a.state!=='dead')){const reason=cobraCohortReason256([...map.pawns,...g.members],[...map.wildlife?.animals??[],...g.animalOwners?.members??[]]);if(reason)return fail(reason);}
 if(g.packed&&!canReturnGroupBedrolls256(map,g.packed,[...g.members,...g.animalOwners?.members??[]]))return fail('Les couchages réels ne peuvent entrer dans cette carte.');
 let campCenter:PreparedCampCenterEntry256|undefined;
 if(newSite&&(mode==='camp'||mode==='settle')&&isSchema256Or257(root.schemaVersion)&&root.planet?.revision===3&&preparedCamp){
  try{campCenter=prepareCampCenterEntry256(root,map,g,mode==='settle');}catch(error){return fail(error instanceof Error?error.message:String(error));}
 }
 const used=new Set<number>(),find=campCenter?undefined:captureCivilianReturnFinder(map),positions=campCenter?campCenter.humanPositions.map(c=>({...c})):newSite?centreEntries(map,g.members.length):g.members.map(()=>{const p=find!(g.entry,c=>!used.has(c.z*map.width+c.x));if(p)used.add(p.z*map.width+p.x);return p;});if(!positions||positions.some(p=>!p))return fail('Aucun accès réel n’accueille le groupe complet.');
 const animalPositions=campCenter?campCenter.animalPositions.map(p=>({animal:p.animal,cell:{...p.cell}})):prepareGroupAnimalEntry256(map,g,newSite?{x:Math.floor(map.width/2),z:Math.floor(map.height/2)}:g.entry,positions as {x:number;z:number}[]);if(!animalPositions)return fail('Aucun placement physique ne peut accueillir tous les animaux et leurs propriétaires.');
 const bedCapture=root.schemaVersion>=256?captureActorBeds256(root):undefined,bedAliases=bedCapture?[...g.members,...g.animalOwners?.members??[]].map(a=>({actor:a,alias:actorBedEntryAlias256(a,site.id,bedCapture.refs)})):[];
 const areaAliases=root.schemaVersion>=256?g.members.map(p=>prepareMapAreaEntry(root,p,g.reorganization?.memberOrigins.find(o=>o.pawnId===p.id)?.originMapId??record.originMapId,site.id,(map.allowedAreas??[]).map(a=>a.id))):undefined;
 const staging={...map,pawns:[...map.pawns,...g.members.map((p,i)=>({...p,...positions[i]!}))],...map.wildlife?{wildlife:{...map.wildlife,animals:[...map.wildlife.animals,...animalPositions.map(p=>({...p.animal,...p.cell}))]}}:animalPositions.length?{wildlife:{profile:'temperate-hares-v1' as const,rng:(map.seed^0x784caf31)>>>0||1,animals:animalPositions.map(p=>({...p.animal,...p.cell})),eatenPlants:0,eatenNutrition:0,eatenItems:0}}:{},piles:[...map.piles,...g.items],packed:[...map.packed,...g.packed??[]]};const drop=mode==='settle'?inventoryDropPlan(staging):undefined;const packedDrop=drop&&root.schemaVersion>=256?planPackedInventoryDrop256({...staging,piles:drop}):undefined;if(mode==='settle'&&(!drop||root.schemaVersion>=256&&!packedDrop))return fail('Le sol ne permet pas de déposer les inventaires.');
 const settlementReceivers=(Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))&&mode==='settle'&&!root.worldMaps!.sites.some(s=>s.kind==='settlement')?captureNewColonyReceivers259(root):undefined;
 if(newSite&&preparedCamp&&campCenter&&!actualNewCampEntryRecipients256(root,draft!.site.map,g,select,campCenter,areaAliases,bedAliases,mode==='settle'))return fail('Les récipients réels de la nouvelle carte ne peuvent recevoir cette adoption.');
 if((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&record.retreat261&&Object.getOwnPropertyDescriptor(record,'retreat261')?.configurable!==true)return fail('Le vrai drapeau de sortie ne peut être retiré avant l’entrée.');
 if(campCenter){if(root.rng!==campCenter.rngBefore)return fail('Le flux réel d’arrivée a changé.');try{applyPreparedCampCenterFog256(map,campCenter);}catch(error){return fail(error instanceof Error?error.message:String(error));}}
 if(newSite&&preparedCamp){if(!preparedCamp.current(root))return fail('Le propriétaire WorldPawns de la carte a changé.');preparedCamp.adoptWorldAnimals();}
 if(newSite){if(preparedCamp?.settlement){root.worldMaps!.nextLordId=preparedCamp.settlement.nextLordId;root.worldMaps!.nextAncientCasketGroupId=preparedCamp.settlement.nextAncientCasketGroupId;}root.worldMaps!.sites.push(site);root.worldMaps!.nextMapId++;root.nextId=draft!.nextId;}
 const actual=registeredMap(root,site.id)!;
 for(let i=0;i<g.members.length;i++){const p=g.members[i]!;Object.assign(p,positions[i]!);p.path=[];p.moveCooldown=0;p.planCooldown=0;delete p.motion;if(areaAliases)commitMapAreaEntry(p,areaAliases[i]!);else delete p.allowedAreaId;if(p.state!=='downed')p.state='idle';}
 commitGroupAnimalEntry256(actual,animalPositions);for(const b of bedAliases)commitActorBedEntry256(b.actor,b.alias);
 actual.pawns.push(...g.members);actual.piles.push(...g.items);if(g.packed)actual.packed.push(...g.packed);if(packedDrop)for(let i=0;i<packedDrop.length;i++)assignPileOwner(actual.packed[i]!,packedDrop[i]!.owner);if(drop)for(let i=0;i<drop.length;i++)assignPileOwner(actual.piles[i]!,drop[i]!.owner);
 const pending=g.items.filter(p=>p.owner.type==='inventory').map(p=>p.id),pendingPacked=g.packed?.filter(p=>p.owner.type==='inventory').map(p=>p.building.id)??[];if(!newSite&&site.kind==='settlement'&&(pending.length||pendingPacked.length)){if((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))delete record.retreat261;record.localMapId=site.id;record.context={seed:actual.seed,width:actual.width,height:actual.height,...actual.climate?{climate:actual.climate}:{},...actual.site?{site:actual.site}:{},...actual.scenario?{scenario:actual.scenario}:{}};record.state={...g.admission?{admission:g.admission}:{},id:g.id,startedAt:g.startedAt,destination:g.destination,ledger:g.ledger,...g.originTile!==undefined?{originTile:g.originTile}:{},...g.provisions?{provisions:g.provisions}:{},...g.freight?{freight:g.freight}:{},phase:'unloading',memberIds:g.members.map(p=>p.id),...g.animalOwners?.members.length?{animalIds:g.animalOwners.members.map(a=>a.id)}:{},pendingPileIds:pending,...pendingPacked.length?{pendingPackedIds:pendingPacked}:{}};}else{root.worldGroups!.groups=root.worldGroups!.groups.filter(row=>row!==record);if(root.worldGroups!.selectedGroupId===groupId)root.worldGroups!.selectedGroupId=null;}if(select)root.worldMaps!.selectedMapId=site.id;
 if(campCenter){
  for(const p of campCenter.placements)p.actor.arrivalRotation=p.rotation;
  root.rng=campCenter.rngAfter;
  // Fog was prepared on this private map. Real-owner Spawn notifications now
  // verify that transfer and are idempotent; no mine intent exists in a new Camp.
  for(const p of campCenter.placements)notifyActualExplorationSpawn256(actual,p.actor);
 }
 ensureFilth(actual);refreshStock(actual);flushRegisteredMap(actual);if(root.worldMaps!.rootMapId===null)promoteRootMap(root,site.id);
 if(settlementReceivers)resetNewColonyMemories259(root,site.id,'new-colony-settled',settlementReceivers);
 campaignLog(root,mode==='camp'?'Le groupe établit un camp temporaire et conserve ses inventaires.':mode==='settle'?'Le groupe fonde une colonie sur sa nouvelle carte.':'Le groupe entre sur la carte existante avec ses biens.');return {ok:true};
}

/** An explicit map removal never credits the surviving colony or caravan. */
export function abandonRegisteredMap(root:CampaignState,id:number,confirm:boolean,automatic=false):CommandResult {
 const record=root.worldMaps!.sites.find(s=>s.id===id),map=record?registeredMap(root,id):undefined;if(!record||!map||record.tile===null)return fail('Carte absente ou tuile inconnue.');
 const permission=mapActions(root,id).abandon;if(!automatic&&!permission.ok)return fail(permission.reason!);

 if(map.startingArrival?.profile===CORE_STARTING_ARRIVAL_PROFILE_256&&map.startingArrival.phase!=='opened')return fail('Attendez la sortie effective des capsules initiales avant de retirer cette carte.');
 const affected=[...map.pawns,...playerHeldMapHumans271(map)].filter(p=>isColonist(p)&&p.state!=='dead');if(automatic&&playerHeldMapHumans271(map).some(p=>isColonist(p)&&p.state!=='dead'&&!p.health?.death))return fail('Un occupant vivant de caisson conserve cette carte.');if(!automatic&&affected.length&&!confirm)return fail('Confirmez les personnes réellement laissées sur cette carte.');
 const pass=prepareCampMapRemoved256(root,map,id,automatic);if(!pass.ok)return fail(pass.reason);if(!pass.current())return fail('La source réelle du camp a changé.');
 return commitRegisteredMapRemoval260(root,map,record,pass,automatic);
}
function commitRegisteredMapRemoval260(root:CampaignState,map:World,record:import('./world-map-state.ts').WorldMapRecord,pass:Extract<import('./world-pawn-map-removed-256.ts').CampMapRemoved256,{ok:true}>,automatic:boolean,admittedPhase?:ReturnType<typeof beginHeldCasketRemoval259>,admittedTarget?:ReturnType<typeof prepareWorldTargetMapRemoval263>):CommandResult {
 const id=record.id;const targetRemoval=admittedTarget??(record.target263?prepareWorldTargetMapRemoval263(root,record):null);if(targetRemoval&&!targetRemoval.current())return fail('Le parent mondial263 a changé.');
 const casketRemoval=admittedPhase?undefined:ancientCasketMapRemovalBoundary256(map);if(casketRemoval&&!admittedPhase&&!heldCasketRemovalPrepared259(map,pass))return fail(casketRemoval);
 const lastSettlement=record.kind==='settlement'&&!root.worldMaps!.sites.some(s=>s.id!==id&&s.kind==='settlement'),newColonyReceivers=(Number(root.schemaVersion)===259||Number(root.schemaVersion)===260||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion)))))&&lastSettlement?captureNewColonyReceivers259(root):undefined;
 let removalPhase=admittedPhase;try{removalPhase??=beginHeldCasketRemoval259(map,pass);}catch(e){return fail(e instanceof Error?e.message:String(e));}
 const bedOwnership=removalPhase?undefined:prepareRemovedMapBeds256(root,map,id);
 const areaPlan=!removalPhase&&root.schemaVersion>=256?prepareRemovedMapAreas(root,id,new Set((map.allowedAreas??[]).map(a=>a.id))):undefined;
 if(areaPlan)beginRemovedMapAreas287(areaPlan);
 notifyMapLost(root,map,id,lastSettlement,newColonyReceivers);
 const registry=root.worldGroups!;
 if(removalPhase)removalPhase.areas();else if(areaPlan)commitRemovedMapAreas(areaPlan);
 const compact=detachMapOwners(map,id,record.tile!,pass,removalPhase?.drops260,removalPhase?.releaseCouples285);
 if(removalPhase)removalPhase.beds();else bedOwnership?.commit();
 if(map.scout&&'pawn' in map.scout||map.commercialTrip&&'pawn' in map.commercialTrip){registry.legacyTravellers.push({originMapId:id,...record.postId!==undefined?{postId:record.postId}:{},context:{seed:map.seed,width:map.width,height:map.height,...map.climate?{climate:map.climate}:{},...map.site?{site:map.site}:{},...map.scenario?{scenario:map.scenario}:{}},...map.scout&&'pawn' in map.scout?{scout:map.scout}:{},...map.commercialTrip&&'pawn' in map.commercialTrip?{commercialTrip:map.commercialTrip}:{}});delete map.scout;delete map.commercialTrip;}
 pass.commit(compact);targetRemoval?.commit();
 registry.abandonedContents.push(compact);
 registry.groups=registry.groups.filter(g=>g.localMapId!==id);if(registry.selectedGroupId!==null&&!registry.groups.some(g=>g.state.id===registry.selectedGroupId))registry.selectedGroupId=null;
 const maps=root.worldMaps!,wasSelected=maps.selectedMapId===id,wasRoot=maps.rootMapId===id;
 if(wasRoot){const other=maps.sites.filter(s=>s.id!==id).sort((a,b)=>a.id-b.id)[0];if(other)promoteRootMap(root,other.id);else clearRootMap(root);}
 maps.sites=maps.sites.filter(s=>s.id!==id);maps.retired.push({id:record.id,tile:record.tile!,kind:record.kind,createdAt:record.createdAt,...record.settledAt!==undefined?{settledAt:record.settledAt}:{},removedAt:root.tick,...isCorePhysicalSchema297(Number(root.schemaVersion))?{removedAtCore297:effectiveCore297(root)}:{},reason:record.kind==='battlefield'?'battlefield-empty':record.target263?'abandon':automatic?'camp-empty':'abandon',...record.kind==='camp'?{markerUntilCore:root.tick*10+1800000}:{}});if(wasSelected)maps.selectedMapId=maps.sites.slice().sort((a,b)=>a.id-b.id)[0]?.id??null;
 campaignLog(root,automatic?'Le camp vide est retiré. Les biens laissés ne sont pas récupérés.':'La carte est abandonnée. Les personnes restantes sont perdues au monde, leurs biens ne reviennent pas au stock.');return {ok:true};
}/** Pure preflight of the actual Camp after the selected originals leave; no fake map. */
export function prepareCampReformRetirement260(root:CampaignState,map:World,id:number,departure:ReformDeparture260):{ok:false;reason:string}|{ok:true;current():boolean;begin():void;commit():void} {
 const record=root.worldMaps?.sites.find(s=>s.id===id);
 if((Number(root.schemaVersion)!==260&&(Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion)))))||!(record?.kind==='camp'||(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&record?.kind==='battlefield'||!!record&&worldTargetRetreatAvailable263(root,record))||record.tile===null)return {ok:false,reason:'La réforme doit viser son vrai Camp.'};
 let targetRemoval:ReturnType<typeof prepareWorldTargetMapRemoval263>;try{targetRemoval=record.target263?prepareWorldTargetMapRemoval263(root,record):null;}catch(e){return {ok:false,reason:e instanceof Error?e.message:String(e)};}
 const retiring=!(playerHeldMapHumans271(map).some(p=>isColonist(p)&&p.state!=='dead'&&!p.health?.death)||map.pawns.some(p=>!departure.ids.has(p.id)&&isColonist(p)&&p.state!=='dead')||map.startingArrival&&map.startingArrival.phase!=='opened'||map.podRescues?.pending),surface=prepareReformRetirementSurface260(root,map,id,retiring);
 if(!retiring)return {ok:true,current:surface,begin(){if(!surface())throw Error('Stale Reform flush recipients');},commit(){}};
 if(!Number.isSafeInteger(root.tick*10+1800000))return {ok:false,reason:'Le marqueur de retrait dépasserait l’horloge sûre.'};
 const pass=prepareMapRemoved259(root,map,id,false,departure);if(!pass.ok)return pass;
 const boundary=ancientCasketMapRemovalBoundary256(map);if(boundary&&!heldCasketRemovalPrepared259(map,pass))return {ok:false,reason:boundary};
 let admittedPhase:ReturnType<typeof beginHeldCasketRemoval259>;
 return {ok:true,current:()=>surface()&&pass.current()&&(!targetRemoval||targetRemoval.current()),begin(){if(!surface()||!pass.current()||targetRemoval&&!targetRemoval.current())throw Error('Stale Reform retirement admission');admittedPhase=beginHeldCasketRemoval259(map,pass);if(!admittedPhase?.departed260)throw Error('Missing admitted Reform departure phase');},commit(){if(!admittedPhase?.departed260)throw Error('Reform retirement was not admitted');admittedPhase.departed260();const result=commitRegisteredMapRemoval260(root,map,record,pass,true,admittedPhase,targetRemoval);if(!result.ok)throw Error('Admitted Reform retirement unexpectedly refused');}};
}

const dataCommand=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.hasOwn(Object.getOwnPropertyDescriptor(v,k)!,'value'));
export function validWorldMapCommand(v:unknown):v is WorldMapCommand {
 if(!dataCommand(v))return false;const keys=Reflect.ownKeys(v),exact=(names:string[])=>keys.length===names.length&&names.every(k=>Object.hasOwn(v,k)),id=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>=0;
 if(v.type==='map-view')return exact(['type','mapId'])&&(v.mapId===null||id(v.mapId));
 if(v.type==='map-settle')return exact(['type','mapId'])&&id(v.mapId);
 if(v.type==='map-abandon')return exact(['type','mapId','confirm'])&&id(v.mapId)&&typeof v.confirm==='boolean';
 if(v.type==='group-select')return exact(['type','groupId'])&&(v.groupId===null||Number.isSafeInteger(v.groupId)&&Number(v.groupId)>=1);
 return v.type==='group-enter'&&exact(['type','groupId','mode'])&&Number.isSafeInteger(v.groupId)&&Number(v.groupId)>=1&&typeof v.mode==='string'&&['visit','camp','settle'].includes(v.mode);
}
export function applyWorldMapCommand(input:CampaignState,command:WorldMapCommand):CommandResult {
 if(!validWorldMapCommand(command))return fail('Commande de carte invalide.');const root=registeredCampaign(input);if(root.schemaVersion<255||!root.worldMaps||!root.worldGroups)return fail('Le registre de cartes n’est pas disponible.');
 switch(command.type){
  case 'map-view':if(command.mapId!==null&&!registeredMap(root,command.mapId))return fail('Carte absente.');root.worldMaps.selectedMapId=command.mapId;return {ok:true};
  case 'map-settle':return settleRegisteredMap(root,command.mapId);
  case 'map-abandon':return abandonRegisteredMap(root,command.mapId,command.confirm);
  case 'group-select':if(command.groupId!==null&&!root.worldGroups.groups.some(g=>g.state.id===command.groupId))return fail('Groupe absent.');root.worldGroups.selectedGroupId=command.groupId;return {ok:true};
  case 'group-enter':return enterRegisteredSite(root,command.groupId,command.mode);
 }
}
/** Temporary maps do not expire after four days. A living colonist, including downed, blocks removal. */
export function removeEmptyCamps(root:CampaignState):void {for(const site of root.worldMaps!.sites.slice().sort((a,b)=>a.id-b.id)){if(site.kind!=='camp'&&!((Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&site.kind==='battlefield')&&!worldTargetRetreatAvailable263(root,site))continue;const map=registeredMap(root,site.id)!;if(playerHeldMapHumans271(map).some(p=>isColonist(p)&&p.state!=='dead'&&!p.health?.death)||map.pawns.some(p=>isColonist(p)&&p.state!=='dead')||map.startingArrival&&map.startingArrival.phase!=='opened'||(Number(root.schemaVersion)===260||Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))&&map.podRescues?.pending)continue;abandonRegisteredMap(root,site.id,true,true);}}
