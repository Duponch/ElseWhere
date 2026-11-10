import {assignPileOwner} from './pile-index.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {estimateGroupTravel} from './group-travel-estimate.ts';
import {prepareReformDeparture260} from './group-reform-departure-260.ts';
import {campReformThreatReason260} from './camp-reform-threats-260.ts';
import {prepareGroupRedirection} from './group-trip.ts';
import {prepareRetainedReform261} from './caravan-retained-261.ts';
import {temporaryRetainedOwner263} from './world-target-retained-263.ts';
import {worldTargetRetreatAvailable263} from './world-target-access-263.ts';
/** Direct Core Reform transaction. Reachability is admission, never a played pickup. */
import type {World,Pawn,MaterialPile,CommandResult} from './types.ts';
import type {CampaignState,WorldGroupRecord} from './world-map-state.ts';
import type {AwayGroup} from './group-capture.ts';
import type {PackedFurniture} from './furniture-rules.ts';
import {registeredCampaign,registeredMapId,flushRegisteredMap,pawnWorldGroup} from './world-map-context.ts';
import {groupHumanAdmissionReason257,groupHumanHandler257} from './group-human-admission-257.ts';
import {prospectiveHuman259,autoCapturePatient259} from './group-human-admission-259.ts';
import {actualPlayerOwner259,commitCapturedGuest259} from './world-affiliation-259.ts';
import {groupExitAuthorityReason259,captureCaravanEntry259} from './group-world-ownership-259.ts';
import {actualCampRemovalAbsCore256} from './world-pawn-map-removed-256.ts';
import {groupFormationAuthority} from './group-authority.ts';
import {captureGroupMass,departureBaseline,groupDestinationValid} from './group-capture.ts';
import {captureHumanOwners} from './human-owners.ts';
import {regularGroupFreight258,groupFreightUnitMass258,validGroupFreightPack258} from './group-freight-contract-258.ts';
import {groupCaravanUnitMass256} from './group-caravan-mass-256.ts';
import {materialAllowedForPlayer256,setMaterialForbidden256} from './material-permission-256.ts';
import {captureCaravanSourceAccess298} from './caravan-source-access-298.ts';
import {freshGroupProvision,groupProvisionCounts,newGroupProvisions} from './group-provisions.ts';
import {newGroupFreight} from './group-freight.ts';
import {emptyGroupLedger} from './group-loading.ts';
import {openGroupReorganization} from './group-reorganization-balance.ts';
import {newGroupForageRevision256} from './group-forage-state-256.ts';
import {findPlanetRoute,planetCostContext,planetQueryBudget} from './planet-navigation.ts';
import {groupAnimalReason256} from './group-animal-formation-256.ts';
import {planReformDrops260,planReformInventoryDrops260,reformHumanOrigin260} from './work-release.ts';
import {createPrisonerState} from './prisoner-state.ts';
import {prepareCampReformRetirement260} from './world-map-authority.ts';
import {reservedSource} from './materials.ts';
import {validatePileRecordShape} from './material-record-save.ts';
import {workNeighbours} from './pathfinding.ts';
export interface GroupReformDraft260 {originMapId:number;memberIds:number[];sources:{pileId:number;quantity:number}[];packedIds?:number[];animalIds?:number[];destination?:number}
export type GroupReformCommand260=GroupReformDraft260&{type:'group-reform';quote:string};
export interface ReformReceipt260 {sourceId:number;fragmentId:number;quantity:number;toPawnId:number}
const holderId=(owner:MaterialPile['owner']|PackedFurniture['owner']):number|undefined=>'pawnId'in owner?owner.pawnId:undefined;
const fail=(reason:string)=>({kind:'refused' as const,reason});
export function actualCampReform260(w:World):boolean {const root=registeredCampaign(w),version=Number(w.schemaVersion),id=root.worldMaps?registeredMapId(w):w.campaignMap?.revision===2?w.campaignMap.activeMapId:undefined;if(!(version===260||version===261||version===262||isSchema263OrLater(version))||id===undefined)return false;const site=(root.worldMaps?.sites??(w.campaignMap?.revision===2?w.campaignMap.maps:[])).find(m=>m.id===id);return !!site&&(site.kind==='camp'||(version===261||version===262||isSchema263OrLater(version))&&site.kind==='battlefield'||worldTargetRetreatAvailable263(root,site));}
export function reformMemberReason260(w:World,p:Pawn):string|undefined {
 const reason=groupHumanAdmissionReason257(w,p,true);if(reason)return reason;
 if(pawnWorldGroup(w,p.id)||w.group||w.scout||w.commercialTrip)return 'Une formation ou un voyage possède déjà cette personne ou cette carte.';
 if(p.surgery||p.surgeryRequest||p.rescue||p.animalRescue||p.animalHandling?.kind==='lead')return 'Terminez le soin, transport ou cordage entre originaux avant la réforme.';
 return undefined;
}
export function reformSourceChoices260(w:World){
 const current=Number(w.schemaVersion)>=298,place=current?captureCaravanSourceAccess298(w,true):undefined;
 return w.piles.filter(p=>p.owner.type==='ground'||p.owner.type==='inventory'||p.owner.type==='equipment'&&w.pawns.some(q=>q.id===holderId(p.owner)&&autoCapturePatient259(w,q))).filter(p=>(regularGroupFreight258(p,w.schemaVersion)||groupCaravanUnitMass256(p.item,true,w.schemaVersion)!==undefined)&&(!place||!place(p))).map(pile=>({pile,reserved:reservedSource(w,pile.id),available:pile.quantity,...!current&&!materialAllowedForPlayer256(pile)?{reason:'Ce bien est interdit.'}:{}}));
}
/** Canonical, bounded command fingerprint. Not saved; no ID, PRNG or ledger. */
function fingerprint(value:unknown):string {const canonical=(v:unknown):string=>v===null||typeof v!=='object'?JSON.stringify(v)??'undefined':Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}';const s=canonical(value),h=[2166136261,0x9e3779b9,0x85ebca6b,0xc2b2ae35];for(let i=0;i<s.length;i++)for(let j=0;j<h.length;j++)h[j]=Math.imul(h[j]!^(s.charCodeAt(i)+j),16777619+j*2)>>>0;return 'reform260:'+s.length+':'+h.map(n=>n.toString(16).padStart(8,'0')).join('');}
export interface GroupReformPlan260 {root:CampaignState;map:World;record:WorldGroupRecord;mass:NonNullable<ReturnType<typeof captureGroupMass>>;quote:string;receipts:ReformReceipt260[];commit():CommandResult}
export function prepareGroupReform260(w:World,c:GroupReformDraft260,previewOnly=false):{kind:'ready';plan:GroupReformPlan260}|{kind:'preview';preview:{ok:true;quote:string;route:number[];mass:import('./group-panel-state.ts').GroupMassView;carriers:{pileId:number;pawnId:number;quantity:number}[];provisions?:import('./group-travel-estimate.ts').GroupTravelEstimateResult}}|{kind:'refused';reason:string} {
 try{
 const root=registeredCampaign(w),id=root.worldMaps?registeredMapId(w):w.campaignMap?.revision===2?w.campaignMap.activeMapId:undefined,site=root.worldMaps?.sites.find(m=>m.id===id)??(w.campaignMap?.revision===2?w.campaignMap.maps.find(m=>m.id===id):undefined),groups=root.worldGroups,planet=root.planet;
 if(!actualCampReform260(w)||!prospectiveHuman259(w)||!previewOnly&&!groups||!planet||id!==c.originMapId||site?.tile===null||site?.tile===undefined)return fail('La réforme exige le vrai Camp géographique et ses propriétaires actuels.');
 const threatReason=campReformThreatReason260(w,site.kind==='battlefield');if(threatReason)return fail(threatReason);
 if(w.group||w.scout||w.commercialTrip||!Number.isSafeInteger(planet.nextGroupId+1))return fail('La carte ou le registre des caravanes est engagé.');
 const ids=new Set(c.memberIds),animalIds=new Set(c.animalIds??[]),all=new Set([...ids,...animalIds]);if(!ids.size||ids.size!==c.memberIds.length||all.size!==ids.size+animalIds.size||animalIds.size!==(c.animalIds??[]).length)return fail('Le choix des personnes et animaux est invalide.');
 const namespace=captureHumanOwners(w,{},false),members=c.memberIds.slice().sort((a,b)=>a-b).map(id=>w.pawns.find(p=>p.id===id));
 if(members.some(p=>!p||namespace.byId.get(p.id)?.kind!=='map'||namespace.byId.get(p.id)?.pawn!==p))return fail('Une personne ne possède plus son propriétaire local exclusif.');
 const people=members as Pawn[];for(const p of people){const reason=reformMemberReason260(w,p);if(reason)return fail(reason);}
 if(!people.some(p=>actualPlayerOwner259(p,root.worldFactions!.playerFactionId)&&p.state!=='downed'))return fail('Un propriétaire joueur non à terre doit partir.');
 const humanOrigins=new Map(people.map(p=>[p.id,Object.freeze(reformHumanOrigin260(w,p))]));
 const authority=groupFormationAuthority(w,false,humanOrigins),colonists=people.filter(groupHumanHandler257),touch=(cell:{x:number;z:number})=>colonists.some(p=>[cell,...workNeighbours(cell)].some(c=>authority.reachable(p,c)));
 const animals=[...animalIds].sort((a,b)=>a-b).map(id=>w.wildlife?.animals.find(a=>a.id===id));if(animals.some(a=>!a))return fail('Un animal original est absent.');
 const actualAnimals=animals as NonNullable<World['wildlife']>['animals'];for(const a of actualAnimals){const reason=groupAnimalReason256(w,a);if(reason)return fail(reason);if(!touch(a))return fail('Un animal sélectionné est inaccessible.');}
 for(const p of people)if(p.state==='downed'&&!touch(humanOrigins.get(p.id)!))return fail('Une personne à terre est inaccessible aux colons sélectionnés.');
 const captured=new Set(people.filter(p=>autoCapturePatient259(w,p)).map(p=>p.id));
 const sourceAccess298=Number(w.schemaVersion)>=298?captureCaravanSourceAccess298(w,true):undefined;
 const sourceMap=new Map(w.piles.map(p=>[p.id,p])),chosen=new Map<number,number>();if(sourceMap.size!==w.piles.length)return fail('Une identité de pile est dupliquée.');
 for(const l of c.sources){const p=sourceMap.get(l.pileId);if(chosen.has(l.pileId)||!p||!Number.isSafeInteger(l.quantity)||l.quantity<1||l.quantity>p.quantity)return fail('Une source ou quantité sélectionnée a changé.');
  if((sourceAccess298?!!sourceAccess298(p):!materialAllowedForPlayer256(p))||groupFreightUnitMass258(p,w.schemaVersion)===undefined||validatePileRecordShape(p as unknown as Record<string,unknown>,w,w.schemaVersion).length||p.foodPoison||p.item==='pemmican'&&!freshGroupProvision(p,w.tick))return fail('Un original sélectionné ne possède pas sa forme, ses composants ou sa permission admissible.');
  if(p.owner.type==='ground'){if(!touch(p.owner))return fail('La quantité choisie au sol n’est pas Touch-accessible.');}
  else if(p.owner.type==='inventory'){const holder=w.pawns.find(q=>q.id===holderId(p.owner))??w.wildlife?.animals.find(q=>q.id===holderId(p.owner));if(!holder||holder.state==='dead')return fail('Le vrai détenteur de cet inventaire est absent.');}
  else if(!(p.owner.type==='equipment'&&captured.has(p.owner.pawnId)))return fail('Le propriétaire de cette source ne peut pas être transféré par Reform.');
  if(reservedSource(w,p.id,undefined,undefined,all)>0)return fail('Un tiers réserve cette source.');chosen.set(p.id,l.quantity);
 }
 const selectedPacks=new Set(c.packedIds??[]);if(selectedPacks.size!==(c.packedIds??[]).length)return fail('Une miniature est choisie deux fois.');
 const packs:PackedFurniture[]=[];for(const packId of selectedPacks){const p=w.packed.find(p=>p.building.id===packId);if(!p||!validGroupFreightPack258(p,w,w.schemaVersion))return fail('Une miniature a perdu sa forme ou ses composants.');if(p.owner.type==='ground'){if(!touch(p.owner))return fail('Une miniature est inaccessible.');}else if(p.owner.type!=='inventory'||!w.pawns.some(q=>q.id===holderId(p.owner))&&!w.wildlife?.animals.some(q=>q.id===holderId(p.owner)))return fail('Le détenteur de miniature est illégitime.');if(reservedSource(w,packId,undefined,undefined,all)>0||w.jobs.some(j=>j.furniture?.structureId===packId))return fail('Une réservation de tiers ou un travail d’installation encore présent réclame cette miniature.');packs.push(p);}
 const vacated=new Set([...chosen].filter(([id,n])=>{const p=sourceMap.get(id)!;return p.owner.type==='ground'&&n===p.quantity;}).map(([id])=>id));for(const p of packs)if(p.owner.type==='ground')vacated.add(p.building.id);
 const drops=planReformDrops260(w,ids,captured,vacated,humanOrigins);if(!drops)return fail('Les cargaisons de travail et équipements de capture ne peuvent pas être déposés.');
 const intrinsic=w.piles.filter(p=>'pawnId'in p.owner&&ids.has(p.owner.pawnId)&&['equipment','apparel'].includes(p.owner.type)&&!(captured.has(p.owner.pawnId)&&p.owner.type==='equipment'));
 const staged:MaterialPile[]=intrinsic.map(p=>structuredClone(p)),transfers:{original:MaterialPile;next:MaterialPile;fragment?:MaterialPile}[]=[],receipts:ReformReceipt260[]=[];let nextId=root.nextId;
 const carriers=[...people,...actualAnimals].filter(p=>!('prisoner'in p&&p.prisoner)&&p.state!=='downed');if(!carriers.length)return fail('Aucun détenteur de fret n’est disponible.');
 const choose=()=>{const m=captureGroupMass(people,staged,true,w.schemaVersion,[],actualAnimals);if(!m)throw Error('Masse réelle inconnue');return carriers.slice().sort((a,b)=>(m.carriers.find(c=>c.pawnId===a.id)!.grams-m.carriers.find(c=>c.pawnId===b.id)!.grams)||a.id-b.id)[0]!.id;};
 for(const [pileId,quantity] of [...chosen].sort((a,b)=>a[0]-b[0])){const p=sourceMap.get(pileId)!,target=choose(),next=structuredClone(p);let moved:MaterialPile;if(quantity===p.quantity){moved=next;}else {if(!Number.isSafeInteger(nextId+1))return fail('Les identités de fragments sont épuisées.');moved=structuredClone(p);moved.id=nextId++;moved.quantity=quantity;next.quantity-=quantity;}
  assignPileOwner(moved,{type:'inventory',pawnId:target});if(Number(w.schemaVersion)>=298)setMaterialForbidden256(moved,false);staged.push(moved);transfers.push({original:p,next,...moved!==next?{fragment:moved}:{}});receipts.push({sourceId:p.id,fragmentId:moved.id,quantity,toPawnId:target});
 }
 const packUpdates=packs.map(p=>({original:p,next:{...p,owner:{type:'inventory' as const,pawnId:choose()}}}));
 const mass=captureGroupMass(people,staged,true,w.schemaVersion,packUpdates.map(p=>p.next),actualAnimals);if(!mass)return fail('La masse ou les détenteurs finaux ne sont pas valides.');
 // Deselecting a departing inventory never donates it to the caravan. Its real remainder drops.
 const leftInventory=w.piles.filter(p=>p.owner.type==='inventory'&&all.has(p.owner.pawnId)&&chosen.get(p.id)!==p.quantity).map(p=>transfers.find(t=>t.original===p)?.next??p);
 const leftPacks=w.packed.filter(p=>p.owner.type==='inventory'&&all.has(p.owner.pawnId)&&!selectedPacks.has(p.building.id));
 const inventoryDrops=planReformInventoryDrops260(w,leftInventory,leftPacks,drops,vacated,humanOrigins);if(!inventoryDrops)return fail('Le sol ne peut pas conserver les inventaires non retenus.');
 const destination=c.destination??site.tile;if(!groupDestinationValid(planet,destination))return fail('Destination terrestre invalide.');
 let route=[site.tile];if(destination!==site.tile){const r=findPlanetRoute(planet,site.tile,destination,planetCostContext(w,mass),planetQueryBudget(planet));if(r.kind!=='found')return fail(r.kind==='deferred'?'Le calcul de route doit être réessayé.':'La route choisie est inaccessible.');route=r.tiles;}
 const baseline=departureBaseline(staged,true,w.tick,true);if(!baseline)return fail('Les compteurs de départ dépassent leur domaine.');
 const context={seed:w.seed,width:w.width,height:w.height,...w.climate?{climate:w.climate}:{},...w.site?{site:w.site}:{},...w.scenario?{scenario:w.scenario}:{}},abs=previewOnly?undefined:actualCampRemovalAbsCore256(root,w);
 const prospectivePeople=people.map(p=>{if(!captured.has(p.id)&&!((Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))&&p.draft))return p;const q=structuredClone(p);if((Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion)))))delete q.draft;if(captured.has(p.id)){q.prisoner=createPrisonerState(w,q);commitCapturedGuest259(w,q);}return q;});
 const exit=groupExitAuthorityReason259(w,prospectivePeople,staged,actualAnimals);if(exit)return fail(exit);
 let next:AwayGroup={id:planet.nextGroupId,startedAt:root.tick,destination,originTile:site.tile,admission:{revision:2},ledger:emptyGroupLedger(),provisions:newGroupProvisions(),freight:newGroupFreight(),phase:destination===site.tile?'stationary':'travelling',members:people,items:staged,...packs.length?{packed:packUpdates.map(p=>p.next)}:{},...actualAnimals.length?{animalOwners:{revision:1,members:actualAnimals,origins:actualAnimals.map(a=>({pawnId:a.id,originMapId:id!,context,...abs!==undefined?{enteredAtAbsCore:abs}:{}})),order:[...people,...actualAnimals].map(p=>p.id)}}:{},departedAt:root.tick,lastPersonalTick:root.tick,baseline,entry:{...humanOrigins.get(people[0]!.id)!},tile:site.tile,route,segment:null,paused:false,stop:destination===site.tile?{kind:'stationary'}:null,travel:{revision:1,tickDelta:0,forage:newGroupForageRevision256(staged)}};
 next.reorganization=openGroupReorganization(next,[],root.tick,people.map(p=>({pawnId:p.id,originMapId:id!,context,...abs!==undefined?{enteredAtAbsCore:abs}:{}})));next.reorganization.birth={kind:'reform',sourceMapId:id!,at:root.tick};

 const retainedParent=temporaryRetainedOwner263(root,site);let retainedPlan:Extract<ReturnType<typeof prepareRetainedReform261>,{kind:'ready'}>|undefined;
 if(retainedParent){const retained=prepareRetainedReform261(root,site as import('./caravan-encounter-state-261.ts').EncounterMap261,next,mass,w);if(retained.kind==='deferred')return fail('Le calcul de route retenue est différé.');retainedPlan=retained;next=retained.state;route=next.route;}
 if(retainedPlan&&c.destination!==undefined){const redirected=prepareGroupRedirection(planet,next,c.destination,planetCostContext(w,mass),planetQueryBudget(planet));if(redirected.kind!=='ready')return fail(redirected.kind==='deferred'?'Le nouvel itinéraire doit être réessayé.':redirected.reason);next={...redirected.state,paused:false};route=next.route;const target=(root.worldMaps?.sites??(w.campaignMap?.revision===2?w.campaignMap.maps:[])).find(m=>m.tile===c.destination);retainedPlan={...retainedPlan,state:next,arrival:target?{tile:c.destination,action:{kind:'enter',mapId:target.id}}:undefined};}
 const quoteDraft={originMapId:c.originMapId,memberIds:[...c.memberIds].sort((a,b)=>a-b),sources:c.sources.slice().sort((a,b)=>a.pileId-b.pileId),packedIds:[...c.packedIds??[]].sort((a,b)=>a-b),animalIds:[...c.animalIds??[]].sort((a,b)=>a-b),destination:c.destination??site.tile};
 const quoteFor=()=>fingerprint({draft:quoteDraft,map:{seed:w.seed,tick:w.tick,nextId:w.nextId,width:w.width,height:w.height,tiles:w.tiles,pawns:w.pawns,piles:w.piles,packed:w.packed,jobs:w.jobs,resources:w.resources,structures:w.structures,wildlife:w.wildlife,foodPolicies:w.foodPolicies,climate:w.climate,site:w.site},site:{id:site.id,kind:site.kind,tile:site.tile,createdAt:site.createdAt,...site.kind==='battlefield'?{battlefield261:site.battlefield261,story261:site.story261}:site.target263?{target263:site.target263,story261:site.story261}:{}},planet:{revision:planet.revision,homeTile:planet.homeTile,nextGroupId:planet.nextGroupId},route,drops:[...drops],inventoryDrops:[...inventoryDrops],receipts,nextId});const quote=quoteFor();
 const provisions=previewOnly&&(Number(w.schemaVersion)===261||(Number(w.schemaVersion)===262||isSchema263OrLater(Number(w.schemaVersion))))?estimateGroupTravel(w,{members:people,animals:actualAnimals,items:staged.filter(p=>p.owner.type==='inventory'),route,mass,...next.segment?{initial:{tile:next.tile,elapsedCore:Math.max(0,next.segment.remainingCore)}}:{}}):undefined;
 if(previewOnly)return {kind:'preview',preview:{ok:true,quote,route,...provisions?{provisions}:{},mass:{grams:mass.grams,capacityGrams:mass.capacityGrams,byMember:mass.carriers,...groupProvisionCounts(staged,w.tick)},carriers:receipts.map(r=>({pileId:r.sourceId,pawnId:r.toPawnId,quantity:r.quantity}))}};
 captureCaravanEntry259(w,{...next,members:prospectivePeople});
 const record:WorldGroupRecord={originMapId:id!,localMapId:null,context,state:next,...(Number(root.schemaVersion)===261||(Number(root.schemaVersion)===262||isSchema263OrLater(Number(root.schemaVersion))))?{encounters261:{revision:1 as const}}:{},...retainedPlan?.story?{story261:retainedPlan.story}:{},...retainedPlan?.arrival?{arrival261:retainedPlan.arrival}:{}};
 const departure=prepareReformDeparture260(w,{people,humanOrigins,animals:actualAnimals,captured,drops,inventoryDrops,transfers,intrinsic,packs,packUpdates,next,record,nextId,mapId:id!});
 const retirement=prepareCampReformRetirement260(root,w,id!,departure);if(!retirement.ok)return fail(retirement.reason);

 const openingNextId=root.nextId,openingRng=root.rng,recordSignature=JSON.stringify(record);let used=false;
 const plan:GroupReformPlan260={root,map:w,record,mass,quote,receipts,commit(){
  if(used||campReformThreatReason260(w,site.kind==='battlefield')||people.some(p=>!w.pawns.includes(p))||actualAnimals.some(a=>!w.wildlife?.animals.includes(a))||transfers.some(t=>!w.piles.includes(t.original))||intrinsic.some(p=>!w.piles.includes(p))||packs.some(p=>!w.packed.includes(p))||root.worldGroups!==groups||root.planet!==planet||root.nextId!==openingNextId||root.rng!==openingRng||JSON.stringify(record)!==recordSignature||quoteFor()!==quote||!departure.current()||!retirement.current())return {ok:false,code:'invalid-command',reason:'Le Camp a changé avant le commit de réforme.'};retirement.begin();departure.begin();used=true;
  // The consumed source seal authorizes exactly these already planned writes.
  departure.commit();flushRegisteredMap(w);retirement.commit();if(retainedPlan&&retainedParent)retainedParent.retained=retainedPlan.retained;
  groups!.events.push({tick:root.tick,type:'command',message:'Caravane reformée : transfert direct des originaux, sans rassemblement ni marche au bord.'});if(groups!.events.length>80)groups!.events.splice(0,groups!.events.length-80);return {ok:true};
 }};return {kind:'ready',plan};
 }catch{return fail('La réforme ne peut pas conserver les originaux et leurs propriétaires actuels.');}
}
export function previewGroupReform260(w:World,c:GroupReformDraft260){const result=prepareGroupReform260(w,c,true);return result.kind==='preview'?result.preview:{ok:false as const,reason:result.kind==='refused'?result.reason:'Prévisualisation indisponible.'};}
