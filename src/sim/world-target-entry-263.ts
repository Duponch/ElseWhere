import {appendPileEntries,filterPileEntries} from './pile-identity-directory.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {effectiveCore297} from './core-phase-297.ts';
import {prepareReformRetirementSurface260} from './group-reform-retirement-surface-260.ts';
import {captureTargetFactionSeal263} from './world-target-faction-seal-263.ts';
import {prepareWorldTargetGeneration263} from './world-target-generation-263.ts';
import {worldTargetAccess263} from './world-target-access-263.ts';
import {prepareWorldTargetPlacements263} from './world-target-placement-263.ts';
import {prepareItemStashTransfer263} from './world-site-holder-263.ts';
import {registeredCampaign,registeredMap,flushRegisteredMap,promoteRootMap,hasLoadedRoot} from './world-map-context.ts';
import {captureSecondaryMap} from './secondary-site-context.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {actorBedEntryAlias256,commitActorBedEntry256} from './actor-map-bed-256.ts';
import {prepareMapAreaEntry,commitMapAreaEntry} from './pawn-map-areas.ts';
import {commitGroupAnimalEntry256} from './group-animal-entry-256.ts';
import {cobraCohortReason256} from './cobra-admission-256.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import {mutableWorldPawnOriginal256} from './world-pawn-state-256.ts';
import {plainWorldPawnData256} from './world-pawn-save-256.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {refreshStock} from './materials.ts';
import {ensureFilth} from './filth-rules.ts';
import type {CampMapProgress256} from './camp-map-assembly-256.ts';
import type {CampaignState,WorldMapRecord} from './world-map-state.ts';
import type {CommandResult,Pawn} from './types.ts';
export type WorldTargetEntry263={status:'ready';commit():CommandResult}|{status:'blocked';phase:string;reason:string};
const writable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?Object.hasOwn(d,'value')&&d.writable===true:!(k in o)&&Object.isExtensible(o);};
const grow=(a:unknown[])=>Object.isExtensible(a)&&Object.getOwnPropertyDescriptor(a,'length')?.writable===true;
/** New real parent or its already loaded body, Edge/DoNotDrop, same physical
 * originals. A failed generation never changes relations, consumes the Site
 * holder, advances a route or removes the accepted pending request. */
export function* prepareWorldTargetEntry263(input:CampaignState,groupId:number):Generator<CampMapProgress256,WorldTargetEntry263,void> {
 const root=registeredCampaign(input),maps=root.worldMaps,groups=root.worldGroups,record=groups?.groups.find(r=>r.state.id===groupId),g=record?.state,pending=record?.pendingEntry263;
 const blocked=(phase:string,reason:string):WorldTargetEntry263=>({status:'blocked',phase,reason});
 if(!isSchema263OrLater(Number(root.schemaVersion))||!maps||!groups||!root.worldFactions||!root.worldPawns||!record||!g||!('members'in g)||!pending||record.localMapId!==null||record.pending261||g.segment||g.lastPersonalTick!==root.tick||g.tile!==g.destination)return blocked('owner','La vraie caravane et sa préparation d’entrée263 sont absentes.');
 const access=worldTargetAccess263(root,pending.target,g.tile);if(!access.ok)return blocked('target',access.reason);
 const core=effectiveCore297(root),tick=root.tick,rng=root.rng,nextId=root.nextId,factions=root.worldFactions,worldPawns=root.worldPawns,sitesAuthority=root.worldSites263,registry=groups.groups,registryRefs=registry.slice(),mapRecords=maps.sites,mapRefs=mapRecords.slice();
 const source=access.source.kind==='foreign-settlement'?access.source.settlement:access.source.site,sourceBefore=JSON.stringify(source),recordBefore=JSON.stringify(record),members=g.members,items=g.items,packed=g.packed,animals=g.animalOwners?.members??[];
 const memberRefs=members.slice(),itemRefs=items.slice(),itemOwners=items.map(p=>p.owner),packedRefs=packed?.slice(),packedBuildings=packed?.map(p=>p.building),packedOwners=packed?.map(p=>p.owner),animalRefs=animals.slice(),domesticRefs=animals.map(a=>a.domestic);
 const factionsCurrent=captureTargetFactionSeal263(factions);
 const sourceCurrent=()=>{try{const now=worldTargetAccess263(root,pending.target,g.tile);return effectiveCore297(root)===core&&root.tick===tick&&root.rng===rng&&root.nextId===nextId&&root.worldMaps===maps&&root.worldGroups===groups&&root.worldFactions===factions&&factionsCurrent()&&root.worldPawns===worldPawns&&root.worldSites263===sitesAuthority&&groups.groups===registry&&registry.length===registryRefs.length&&registry.every((r,i)=>r===registryRefs[i])&&maps.sites===mapRecords&&mapRecords.length===mapRefs.length&&mapRecords.every((r,i)=>r===mapRefs[i])&&record.state===g&&record.pendingEntry263===pending&&g.members===members&&members.length===memberRefs.length&&members.every((p,i)=>p===memberRefs[i])&&g.items===items&&items.length===itemRefs.length&&items.every((p,i)=>p===itemRefs[i]&&p.owner===itemOwners[i])&&g.packed===packed&&(!packed||packed.length===packedRefs!.length&&packed.every((p,i)=>p===packedRefs![i]&&p.building===packedBuildings![i]&&p.owner===packedOwners![i]))&&(g.animalOwners?.members??animals)===animals&&animals.length===animalRefs.length&&animals.every((a,i)=>a===animalRefs[i]&&a.domestic===domesticRefs[i])&&plainWorldPawnData256(record)&&JSON.stringify(record)===recordBefore&&plainWorldPawnData256(source)&&JSON.stringify(source)===sourceBefore&&now.ok&&(now.source.kind==='foreign-settlement'?now.source.settlement:now.source.site)===source;}catch{return false;}};
 let generated:Extract<ReturnType<typeof prepareWorldTargetGeneration263> extends Generator<unknown,infer R,void>?R:never,{status:'ready'}>|undefined;
 if(!access.map){const result=yield*prepareWorldTargetGeneration263(root,groupId);if(result.status==='blocked')return result;generated=result;}
 if(!sourceCurrent()||generated&&!generated.current())return blocked('stale','La source réelle a changé pendant la génération.');
 const mapId=access.map?.id??maps.nextMapId,map=generated?.result.world??registeredMap(root,mapId);
 if(!map||!Number.isSafeInteger(mapId+1)||map.tick!==tick||map.pawns.length+members.length>map.width*map.height||map.piles.length+items.length+(access.source.kind==='quest-site'?access.source.site.items.length:0)>32768||(map.wildlife?.animals.length??0)+animals.length>MAX_WILDLIFE)return blocked('capacity','La carte ne peut recevoir tous les véritables acteurs et biens.');
 const originals=new Map([...members,...animals].map(a=>[a.id,a])),order=g.animalOwners?.order??members.map(p=>p.id);
 if(order.length!==originals.size||new Set(order).size!==order.length||order.some(id=>!originals.has(id)))return blocked('order','L’ordre physique des voyageurs est incomplet.');
 const placements=prepareWorldTargetPlacements263(map,order.length,generated?.result.rng??rng);if(!placements)return blocked('placement','Aucun bord réel n’accueille les voyageurs.');
 const positions=new Map(order.map((id,i)=>[id,placements.cells[i]!]));
 const cohort=cobraCohortReason256([...map.pawns,...members],[...map.wildlife?.animals??[],...animals]);if(cohort)return blocked('cohort',cohort);
 const beds=captureActorBeds256(root),aliases=[...members,...animals].map(actor=>({actor,alias:actorBedEntryAlias256(actor,mapId,beds.refs)})),areas=members.map(p=>prepareMapAreaEntry(root,p,g.reorganization?.memberOrigins.find(o=>o.pawnId===p.id)?.originMapId??record.originMapId,mapId,(map.allowedAreas??[]).map(a=>a.id)));
 const holder=generated&&access.source.kind==='quest-site'?prepareItemStashTransfer263(root,access.source.site,map,mapId,generated.result.worldTarget263!.storage):undefined;
 if(generated&&access.source.kind==='quest-site'&&!holder)return blocked('holder','Le vrai contenant et tous ses Things ne peuvent être transférés.');
 let nextFactions=factions;
 if(access.source.kind==='foreign-settlement'){
  const foreignFactionId=access.source.factionId;
  const relation=factions.relations.find(r=>r.aId===Math.min(factions.playerFactionId,foreignFactionId)&&r.bId===Math.max(factions.playerFactionId,foreignFactionId));if(!relation)return blocked('relation','La vraie relation de faction est absente.');
  if(relation.kind!=='hostile')nextFactions={...factions,relations:factions.relations.map(r=>r===relation?{...r,goodwill:-75,kind:'hostile' as const}:r)};
 }
 const foreignPeople=nextFactions!==factions?beds.actors.filter((p):p is Pawn=>!('species'in p)&&p.worldAffiliation259?.factionId===access.source.factionId):[];
 const draftPeople=access.source.kind==='foreign-settlement'||access.source.factionId===null||nextFactions.relations.some(r=>r.aId===Math.min(nextFactions.playerFactionId,access.source.factionId!)&&r.bId===Math.max(nextFactions.playerFactionId,access.source.factionId!)&&r.kind==='hostile');
 // Ordinary Site and Settlement are NOT temp-incident map owners in Core.
 // Their default retained container never fabricates the caravan's story/path.
 const site:WorldMapRecord|undefined=generated?{id:mapId,tile:g.tile,kind:access.source.kind,createdAt:tick,visit:null,map:captureSecondaryMap(map),encounters261:{revision:1},target263:access.source.kind==='foreign-settlement'?{revision:1,kind:'foreign-settlement',settlementId:access.source.settlement.id,factionId:access.source.factionId,retained:{passStory:false,next:null,destination:null}}:{revision:1,kind:'quest-site',siteId:access.source.site.id,retained:{passStory:false,next:null,destination:null}}}:undefined;
 const peopleBefore=map.pawns,pilesBefore=map.piles,packedBefore=map.packed,peopleRefs=map.pawns.slice(),pilesRefs=map.piles.slice(),pilesOwners=map.piles.map(p=>p.owner),packsRefs=map.packed.slice(),packsBuildings=map.packed.map(p=>p.building),packsOwners=map.packed.map(p=>p.owner);
 // refreshStock writes each original job.escrow and replaces stock after the
 // physical transfer. A live reentry must admit those true recipients first.
 let surface=()=>true;if(!generated){try{surface=prepareReformRetirementSurface260(root,map,mapId,false);}catch{return blocked('recipients','La surface réelle de réentrée ne peut pas être publiée.');}}
 const wildlife=map.wildlife,localAnimals=wildlife?.animals,localAnimalRefs=localAnimals?.slice();
 const stock=map.stock,jobs=map.jobs,jobRefs=jobs.slice(),escrows=jobs.map(j=>j.escrow),stockValues=JSON.stringify([jobs,stock]),rootMapId=maps.rootMapId,localRecord=maps.sites.find(s=>s.id===mapId),stockBody=generated?undefined:mapId===rootMapId&&hasLoadedRoot(root)?root:localRecord?.map;
 const stockCurrent=()=>generated!==undefined||!!stockBody&&maps.rootMapId===rootMapId&&(mapId===rootMapId&&hasLoadedRoot(root)?root:localRecord?.map)===stockBody&&map.jobs===jobs&&stockBody.jobs===jobs&&jobs.length===jobRefs.length&&jobs.every((j,i)=>j===jobRefs[i]&&j.escrow===escrows[i]&&writable(j,'escrow'))&&map.stock===stock&&stockBody.stock===stock&&writable(map,'stock')&&writable(stockBody,'stock')&&plainWorldPawnData256(jobs)&&plainWorldPawnData256(stock)&&JSON.stringify([jobs,stock])===stockValues;
 const recipients=()=>['rng','nextId','worldFactions','worldSites263'].every(k=>writable(root,k))&&['groups','selectedGroupId','events'].every(k=>writable(groups,k))&&grow(groups.events)&&['selectedMapId',...(generated?['nextMapId','generationRuntime']:[])].every(k=>writable(maps,k))&&(!generated||grow(maps.sites))&&grow(map.pawns)&&grow(map.piles)&&grow(map.packed)&&(!animals.length||!!map.wildlife&&grow(map.wildlife.animals))&&[...members,...animals,...foreignPeople].every(mutableWorldPawnOriginal256)&&animals.every(a=>!a.domestic||mutableWorldPawnOriginal256(a.domestic))&&(!generated||access.source.kind!=='foreign-settlement'||writable(access.source.settlement,'attack263'));
 let used=false;const current=()=>!used&&surface()&&map.wildlife===wildlife&&wildlife?.animals===localAnimals&&(!localAnimals||localAnimals.length===localAnimalRefs!.length&&localAnimals.every((a,i)=>a===localAnimalRefs![i]))&&sourceCurrent()&&(!generated||generated.current())&&(!holder||holder.current())&&recipients()&&stockCurrent()&&(!foreignPeople.length||(()=>{const actual=captureActorBeds256(root).actors;return foreignPeople.every(p=>actual.includes(p));})())&&map.pawns===peopleBefore&&map.pawns.length===peopleRefs.length&&map.pawns.every((p,i)=>p===peopleRefs[i])&&map.piles===pilesBefore&&map.piles.length===pilesRefs.length&&map.piles.every((p,i)=>p===pilesRefs[i]&&p.owner===pilesOwners[i])&&map.packed===packedBefore&&map.packed.length===packsRefs.length&&map.packed.every((p,i)=>p===packsRefs[i]&&p.building===packsBuildings[i]&&p.owner===packsOwners[i]);
 if(!current())return blocked('recipients','Un véritable destinataire de l’entrée est immuable ou périmé.');
 return {status:'ready',commit(){
  if(!current())return {ok:false,code:'invalid-command',reason:'L’entrée réelle a changé avant son adoption.'};used=true;
  if(generated){const faunaOriginals=generated.result.worldAnimalGeneration.commit(),faunaById=new Map(faunaOriginals.map(a=>[a.id,a]));map.wildlife!.animals=map.wildlife!.animals.map(a=>faunaById.get(a.id)??a);const recalled=generated.result.worldTarget263?.recalled;if(recalled){const oldIds=new Set(recalled.ids),oldItems=new Set(recalled.items.map(p=>p.id)),oldPacked=new Set(recalled.packed.map(p=>p.building.id)),actual=recalled.commitAfterAnimals();map.pawns=map.pawns.filter(p=>!oldIds.has(p.id));map.pawns.push(...actual.people);map.piles=filterPileEntries(map.piles,p=>!oldItems.has(p.id));appendPileEntries(map.piles,...actual.items);map.packed=map.packed.filter(p=>!oldPacked.has(p.building.id));map.packed.push(...actual.packed);}holder?.commit();}
  for(let i=0;i<members.length;i++){const p=members[i]!;Object.assign(p,positions.get(p.id)!);p.path=[];p.moveCooldown=0;p.planCooldown=0;delete p.motion;commitMapAreaEntry(p,areas[i]!);if(p.state!=='downed'){p.state='idle';if(draftPeople&&!p.prisoner&&p.faction!=='outlaws'&&p.faction!=='outlanders')p.draft={lastActiveTick:tick,target:null,queue:[]};}}
  commitGroupAnimalEntry256(map,animals.map(animal=>({animal,cell:positions.get(animal.id)!})));for(const a of aliases)commitActorBedEntry256(a.actor,a.alias);for(const p of foreignPeople)p.faction='outlaws';
  map.pawns.push(...members);appendPileEntries(map.piles,...items);map.packed.push(...packed??[]);
  root.worldSites263??={revision:1,nextId:1,entries:[]};root.worldFactions=nextFactions;root.rng=placements.rng;
  if(generated){root.nextId=generated.result.nextId;maps.generationRuntime=generated.runtimeAfter;if(access.source.kind==='foreign-settlement')access.source.settlement.attack263={revision:1,mapId,generatedAtCore:access.source.settlement.attack263?.generatedAtCore??tick*10,inhabitantIds:[...generated.result.worldTarget263!.inhabitantIds]};site!.map=captureSecondaryMap(map);maps.sites.push(site!);maps.nextMapId++;}
  groups.groups=groups.groups.filter(r=>r!==record);if(groups.selectedGroupId===groupId)groups.selectedGroupId=null;maps.selectedMapId=mapId;
  const actual=generated?registeredMap(root,mapId)!:map;for(const p of [...members,...animals])notifyActualExplorationSpawn256(actual,p);ensureFilth(actual);refreshStock(actual);flushRegisteredMap(actual);if(maps.rootMapId===null)promoteRootMap(root,mapId);
  groups.events.push({tick,type:'command',message:access.source.kind==='foreign-settlement'?'La caravane entre au bord du véritable établissement étranger.':'La caravane entre au bord du Site et conserve tous ses biens.'});if(groups.events.length>80)groups.events.splice(0,groups.events.length-80);return {ok:true};
 }};
}
