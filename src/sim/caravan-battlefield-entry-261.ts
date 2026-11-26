import {appendPileEntries} from './pile-identity-directory.ts';
import {isCorePhysicalSchema297} from './physical-schema-297.ts';
import {isSchema263OrLater} from '../sim/schema-compatibility-257.ts';
import {prepareManhunterSpawn261} from './animal-scaria-261.ts';
import {MAX_WILDLIFE} from './wildlife-state.ts';
import {bornKidnapLord261} from './caravan-kidnap-lord-261.ts';
import {prepareBattlefieldGeneration261} from './caravan-battlefield-generation-261.ts';
import {prepareBattlefieldPlacements261} from './caravan-battlefield-placement-261.ts';
import {caravanAmbushMapSize261} from './caravan-incident-calculation-261.ts';
import {captureCurrentArrival261,captureRetainedCaravan261} from './caravan-retained-261.ts';
import {copiedCaravanStory261,firedCaravanStory261,type EncounterGroup261,type CaravanBattlefield261} from './caravan-encounter-state-261.ts';
import {registeredCampaign,registeredMap,flushRegisteredMap,promoteRootMap} from './world-map-context.ts';
import {captureSecondaryMap} from './secondary-site-context.ts';
import {captureActorBeds256} from './actor-bed-local-256.ts';
import {actorBedEntryAlias256,commitActorBedEntry256} from './actor-map-bed-256.ts';
import {prepareMapAreaEntry,commitMapAreaEntry} from './pawn-map-areas.ts';
import {captureActualFogPhysical256} from './exploration-physical-256.ts';
import {notifyExplorationSpawn256} from './exploration-flood-256.ts';
import {actualExplorationAffiliation256} from './exploration-actors-256.ts';
import {notifyActualExplorationSpawn256} from './exploration-runtime-256.ts';
import {commitGroupAnimalEntry256} from './group-animal-entry-256.ts';
import {cobraCohortReason256} from './cobra-admission-256.ts';
import {mutableWorldPawnOriginal256} from './world-pawn-state-256.ts';
import {newCampPressure260} from './camp-pressure-state-260.ts';
import {healthRandom} from './health.ts';
import {refreshStock} from './materials.ts';
import {ensureFilth} from './filth-rules.ts';
import type {CampaignState,WorldMapRecord} from './world-map-state.ts';
import type {CampMapProgress256} from './camp-map-assembly-256.ts';
import type {CommandResult,Pawn} from './types.ts';
import type {CaravanRaidProvenance261} from './raid-state.ts';
import type {PeaceTalksSite293} from './peace-talks-state-293.ts';

export type BattlefieldEntry261={status:'ready';commit():CommandResult}|{status:'blocked';phase:string;reason:string};
const writable=(o:object,k:string)=>{const d=Object.getOwnPropertyDescriptor(o,k);return d?Object.hasOwn(d,'value')&&d.writable===true:!(k in o)&&Object.isExtensible(o);};
/** Concrete new-map publication recipients only, before any original is moved. */
function recipients(root:CampaignState,record:EncounterGroup261,people:readonly Pawn[]):boolean {
 const maps=root.worldMaps!,groups=root.worldGroups!;
 return ['nextId','rng','worldFactions'].every(k=>writable(root,k))&&['sites','nextMapId','selectedMapId','generationRuntime'].every(k=>writable(maps,k))&&['groups','selectedGroupId','events'].every(k=>writable(groups,k))
  &&Object.isExtensible(maps.sites)&&Object.getOwnPropertyDescriptor(maps.sites,'length')?.writable===true&&people.every(mutableWorldPawnOriginal256)
  &&('members'in record.state&&(record.state.animalOwners?.members??[]).every(mutableWorldPawnOriginal256));
}
/** Worker resumes this SAME actual pending decision after cold load. Every
 * yield remains private; no new scenario, fabricated Camp or route payment. */
export function* prepareActualBattlefieldEntry261(input:CampaignState,groupId:number):Generator<CampMapProgress256,BattlefieldEntry261,void> {
 const root=registeredCampaign(input),record=root.worldGroups?.groups.find(g=>g.state.id===groupId) as EncounterGroup261|undefined,g=record?.state,pending=record?.pending261;
 const blocked=(phase:string,reason:string):BattlefieldEntry261=>({status:'blocked',phase,reason});
 if((Number(root.schemaVersion)!==261&&(Number(root.schemaVersion)!==262&&!isSchema263OrLater(Number(root.schemaVersion))))||!record||!g||!('members'in g)||!pending||pending.decision==='open'||!root.worldMaps||!root.worldFactions||!root.worldPawns)return blocked('owner','La vraie décision de rencontre et ses originaux sont absents.');
 const peaceRegistry=root.worldSites263,peaceEntries=peaceRegistry?.entries,peaceSite=pending.kind==='peace-talks'?peaceEntries?.find((s):s is PeaceTalksSite293=>s.kind==='peace-talks'&&s.id===pending.peaceTalksSiteId293):undefined;
 const peaceClosed=peaceSite?.closed,peaceResult=peaceClosed?.reason==='resolved'?peaceClosed.result:undefined,peaceAttack=peaceResult?.attack;
 const peaceBefore=peaceSite?JSON.stringify(peaceSite):undefined;
 const peaceCurrent=()=>pending.kind!=='peace-talks'||(Number(root.schemaVersion)===293||(Number(root.schemaVersion)===294||(Number(root.schemaVersion)===295||(Number(root.schemaVersion)===296||isCorePhysicalSchema297(Number(root.schemaVersion))))))&&root.worldSites263===peaceRegistry&&peaceRegistry?.entries===peaceEntries&&!!peaceSite&&peaceEntries!.includes(peaceSite)&&peaceSite.closed===peaceClosed&&peaceSite.tile===g.tile&&peaceSite.factionId===pending.factionId&&peaceClosed?.atCore===pending.atCore&&peaceResult?.outcome==='disaster'&&peaceResult.groupId===g.id&&peaceResult.attack===peaceAttack&&peaceAttack?.phase==='pending'&&peaceAttack.groupId===g.id&&peaceAttack.enemyIds.length===pending.people.length&&peaceAttack.enemyIds.every((id,i)=>id===pending.people[i]!.id)&&JSON.stringify(peaceSite)===peaceBefore&&writable(peaceResult,'attack');
 if(!peaceCurrent())return blocked('peace-owner','Le reçu terminal ne possède plus sa vraie attaque en attente.');
 const playerAnimals=g.animalOwners?.members??[],size=pending.kind==='meeting'?100:caravanAmbushMapSize261(g.members.length+playerAnimals.length,pending.people.length+pending.animals.length);
 if(size===undefined||pending.animals.length&&!pending.animalAmbush261)return blocked('roster','Ce producteur de rencontre n’a pas de détenteur animal étranger pris en charge.');
 const generation=yield*prepareBattlefieldGeneration261(root,groupId,size);if(generation.status==='blocked')return generation;
 const result=generation.result,map=result.world,maps=root.worldMaps,groups=root.worldGroups!,factions=root.worldFactions,atCore=root.tick*10;
 if(!map.raids||map.raids.profile!=='camp-pressure-v1'||map.raids.serial!==0||map.raids.active||map.raids.mechActive||!Number.isSafeInteger(maps.nextMapId+1))return blocked('calendar','Le vrai propriétaire de combat neuf ne peut recevoir cet incident.');
 if(map.pawns.length||map.jobs.length||map.piles.length+g.items.length+pending.items.length>32768)return blocked('capacity','La carte ne peut recevoir tous les originaux et leurs biens.');
 const placement=prepareBattlefieldPlacements261(map,g.members.length+playerAnimals.length,pending.people.length+pending.animals.length,result.rng);if(!placement)return blocked('placement','Les deux groupes ne trouvent pas leurs vrais accès opposés.');
 const byId=new Map([...g.members,...playerAnimals].map(a=>[a.id,a])),order=g.animalOwners?.order??g.members.map(p=>p.id);
 if(order.length!==byId.size||new Set(order).size!==order.length||order.some(id=>!byId.has(id)))return blocked('order','L’ordre des véritables voyageurs est incomplet.');
 const playerCells=new Map(order.map((id,i)=>[id,placement.players[i]!])),foreignCells=new Map([...pending.people,...pending.animals].map((p,i)=>[p.id,placement.foreign[i]!]));
 if([...map.wildlife?.animals??[],...playerAnimals,...pending.animals].some(a=>a.species==='cobra'&&a.state!=='dead')){const cobra=cobraCohortReason256([...g.members,...pending.people],[...map.wildlife?.animals??[],...playerAnimals,...pending.animals]);if(cobra)return blocked('cohort',cobra);}
 const mapId=maps.nextMapId,beds=captureActorBeds256(root),bedAliases=[...g.members,...playerAnimals].map(actor=>({actor,alias:actorBedEntryAlias256(actor,mapId,beds.refs)}));
 const areas=g.members.map(p=>prepareMapAreaEntry(root,p,g.reorganization?.memberOrigins.find(o=>o.pawnId===p.id)?.originMapId??record.originMapId,mapId,(map.allowedAreas??[]).map(a=>a.id)));
 const physical=captureActualFogPhysical256(map);
 for(const p of [...g.members,...playerAnimals]){const cell=playerCells.get(p.id)!,affiliation=actualExplorationAffiliation256(p);notifyExplorationSpawn256(map,cell.z*map.width+cell.x,{playerOwned:affiliation.playerOwned,playerControlled:false,respawningAfterLoad:false},physical);}
 const retained=captureRetainedCaravan261(g,captureCurrentArrival261(root,record));
 const story=pending.kind==='ambush'?firedCaravanStory261(record.story261,pending.animalAmbush261?'manhunter-ambush':'ambush',atCore):copiedCaravanStory261(record.story261);
 const random={rng:placement.rng},pressure=newCampPressure260(atCore);if(!pressure)return blocked('clock','L’échéance de pression dépasserait l’horloge sûre.');
 pressure.notifyAtCore=atCore+Math.floor(60000*(.8+.4*healthRandom(random)));
 const provenance:CaravanRaidProvenance261|undefined=pending.animalAmbush261?undefined:{revision:1,sourceGroupId:g.id,bornAtCore:pending.atCore,factionId:pending.factionId,...pending.kind==='meeting'?{kind:'defend-caravan',traderId:pending.traderId,guardIds:pending.guardIds.slice(),defendSpot:{...foreignCells.get(pending.traderId)!}}:{kind:'assault',kidnapLord261:bornKidnapLord261(atCore)}};
 if((map.wildlife?.animals.length??0)+playerAnimals.length+pending.animals.length>MAX_WILDLIFE)return blocked('animal-capacity','La carte ne peut recevoir tous les animaux originaux sans troncature.');
 const animalSpawns=pending.animals.map(animal=>{const draft=structuredClone(animal);Object.assign(draft,foreignCells.get(animal.id)!);return prepareManhunterSpawn261(map,draft);});
 if(animalSpawns.some(a=>!a))return blocked('animal-state','Le véritable animal sélectionné ne peut démarrer son état permanent après apparition.');
 let nextFactions=factions;
 if(pending.kind==='meeting'){
  const relation=factions.relations.find(r=>r.aId===Math.min(factions.playerFactionId,pending.factionId)&&r.bId===Math.max(factions.playerFactionId,pending.factionId));
  if(!relation)return blocked('relation','La vraie relation de faction est absente.');
  nextFactions={...factions,relations:factions.relations.map(r=>r===relation?{...r,goodwill:r.kind==='hostile'?r.goodwill:-75,kind:'hostile' as const}:r)};
 }
 const factionActors=nextFactions!==factions?beds.actors.filter((a):a is Pawn=>!('species'in a)&&a.worldAffiliation259?.factionId===pending.factionId):[];
 const allPeople=[...g.members,...pending.people,...factionActors];
 if(!pending.animals.every(mutableWorldPawnOriginal256))return blocked('animal-recipients','Un animal original de rencontre n’est pas modifiable.');
 if(!recipients(root,record,allPeople))return blocked('recipients','Un véritable destinataire de l’entrée n’est pas modifiable.');
 const battlefield:CaravanBattlefield261=pending.kind==='peace-talks'
  ?{revision:1,kind:'peace-talks',won:false,factionId:pending.factionId,peaceTalksSiteId293:pending.peaceTalksSiteId293,retained}
  :{revision:1,kind:pending.kind==='meeting'?'attacked-caravan':'ambush',won:false,factionId:pending.kind==='meeting'?pending.factionId:null,retained};
 const body=captureSecondaryMap(map),site:WorldMapRecord={id:mapId,tile:g.tile,kind:'battlefield',createdAt:root.tick,visit:null,map:body,campPressure:pressure,encounters261:{revision:1},...story?{story261:story}:{},battlefield261:battlefield};
 const before=JSON.stringify(record),tick=root.tick,rng=root.rng,nextId=root.nextId;let used=false;
 const current=()=>!used&&root.tick===tick&&root.rng===rng&&root.nextId===nextId&&root.worldMaps===maps&&root.worldGroups===groups&&root.worldFactions===factions&&record.pending261===pending&&JSON.stringify(record)===before&&generation.current()&&peaceCurrent()&&pending.animals.every(mutableWorldPawnOriginal256)&&recipients(root,record,allPeople);
 return {status:'ready',commit(){
  if(!current())return {ok:false,code:'invalid-command',reason:'La rencontre a changé avant son entrée réelle.'};used=true;
  map.wildlife!.animals=result.worldAnimalGeneration.commit();
  for(const p of g.members){Object.assign(p,playerCells.get(p.id)!);p.path=[];p.moveCooldown=0;p.planCooldown=0;delete p.motion;commitMapAreaEntry(p,areas[g.members.indexOf(p)]!);if(p.state!=='downed')p.state='idle';if(!p.prisoner&&p.faction!=='outlaws'&&p.faction!=='outlanders'&&p.state!=='downed')p.draft={lastActiveTick:tick,target:null,queue:[]};}
  commitGroupAnimalEntry256(map,playerAnimals.map(animal=>({animal,cell:playerCells.get(animal.id)!})));for(const b of bedAliases)commitActorBedEntry256(b.actor,b.alias);
  for(const p of pending.people){Object.assign(p,foreignCells.get(p.id)!);p.path=[];p.moveCooldown=0;p.planCooldown=0;delete p.motion;p.faction='outlaws';p.raid={group:1,exiting:false,goal:null};}
  for(const p of factionActors)p.faction='outlaws';
  for(let i=0;i<pending.animals.length;i++){const original=pending.animals[i]!;Object.assign(original,animalSpawns[i]!);map.wildlife!.animals.push(original);}
  map.pawns.push(...g.members,...pending.people);appendPileEntries(map.piles,...g.items,...pending.items);map.packed.push(...g.packed??[],...pending.packed);
  if(provenance){map.raids!.active={id:1,startedAt:tick,deadline:null,lossPermille:null,members:pending.people.map(p=>p.id),lost:[],phase:'assault',caravan261:provenance};map.raids!.serial=1;}
  root.worldFactions=nextFactions;root.rng=random.rng;root.nextId=result.nextId;maps.generationRuntime=generation.runtimeAfter;maps.sites.push(site);maps.nextMapId++;
  if(peaceResult&&peaceAttack?.phase==='pending')peaceResult.attack={phase:'entered',mapId,atCore,points:peaceAttack.points,enemyIds:peaceAttack.enemyIds.slice()};
  groups.groups=groups.groups.filter(r=>r!==record);if(groups.selectedGroupId===g.id)groups.selectedGroupId=null;maps.selectedMapId=mapId;
  const actual=registeredMap(root,mapId)!;for(const p of [...g.members,...playerAnimals])notifyActualExplorationSpawn256(actual,p);
  ensureFilth(actual);refreshStock(actual);flushRegisteredMap(actual);if(maps.rootMapId===null)promoteRootMap(root,mapId);
  groups.events.push({tick,type:'command',message:'La caravane et ses adversaires entrent sur leur champ de bataille avec les mêmes personnes et les mêmes biens.'});if(groups.events.length>80)groups.events.splice(0,groups.events.length-80);return {ok:true};
 }};
}
