import {giveBornTraits361} from './trait-generation-361.ts';
import {WorldGenerationRandom} from './world-generation-random.ts';
import {constructCoreNoExpansionIdeoIds256,constructFactionNoExpansionIdeo256,validFactionNoExpansionIdeos256} from './world-faction-no-expansion-ideo-256.ts';
import {validWorldFactionSelection,type ConfigurableWorldFaction} from './world-generation-settings.ts';
import {pickWorldSettlementTile,nextWorldSettlement,worldSettlementQuota,settlementFactionWeight,type InitializedSettlementFaction,type SettlementTile,type SettlementAdmission} from './world-settlement-placement.ts';
import type {ClimateSetting} from './world-climate-settings.ts';
import {startingPawn} from './starting-pawns.ts';
import {WORLD_FACTION_DEFINITIONS_256,initialWorldGoodwill256,worldRelationKind256,type WorldFactionDef256} from './world-faction-catalog.ts';
import type {WorldFactionRegistry256,WorldForeignFactionDraft256,WorldFactionInstance256,WorldFactionLeader256} from './world-faction-state.ts';
import {coreFactionName,coreSettlementName,type CoreFactionNames} from './world-faction-core-names.ts';
const f=Math.fround;
const int=(n:number,min=0)=>Number.isSafeInteger(n)&&n>=min;
const roots=['Aube','Cime','Brume','Rive','Sillon','Orbe','Roseau','Argile'] as const;
const forms=['Cercle','Union','Veille','Ligue','Pacte','Maison','Accord','Alliance'] as const;
const people=['Lina','Éloi','Nora','Sacha','Iris','Maël','Yanis','Noé'] as const;
/** Original lexical choices. Their actual variable draws are consumed, never
 * padded/skipped to pretend to reproduce Core proprietary grammar. */
function originalName(r:WorldGenerationRandom,used:ReadonlySet<string>,settlement:boolean,id:number):string {
 let last='';for(let attempt=0;attempt<150;attempt++){
  last=(settlement?'':forms[r.integer(0,forms.length)]+' de ')+roots[r.integer(0,roots.length)]+(settlement?'-'+roots[r.integer(0,roots.length)]:'');
  if(!used.has(last))return last;
 }return `${last} ${id}`;
}
function factionName(def:WorldFactionDef256,id:number,r:WorldGenerationRandom,previous:readonly WorldFactionInstance256[]):string {
 if(WORLD_FACTION_DEFINITIONS_256[def].fixedName)return `Présence ${id}`;
 const used=new Set(previous.filter(p=>!p.hidden).map(p=>p.name));let chosen='';
 for(let attempt=0;attempt<10;attempt++){const candidate=originalName(r,used,false,id);if(candidate.length<=20)chosen=candidate;}
 return chosen||originalName(r,used,false,id);
}
function spectrum(def:WorldFactionDef256,r:WorldGenerationRandom,previous:readonly WorldFactionInstance256[]):number {
 let bestDistance=-1,result=0;
 for(let i=0;i<20;i++){const value=r.value();let nearest=1;
  for(const other of previous)if(other.def===def)nearest=Math.min(nearest,Math.abs(f(value-other.colorFromSpectrum)));
  if(nearest>bestDistance){bestDistance=nearest;result=value;}
 }return result;
}
function placementFaction(a:WorldFactionInstance256):InitializedSettlementFaction|undefined {
 const def=WORLD_FACTION_DEFINITIONS_256[a.def];if(def.player)return;
 return {id:a.id,def:a.def as ConfigurableWorldFaction,player:false,hidden:a.hidden,temporary:false,layerCompatible:true};
}
function originalLeader(faction:WorldFactionInstance256,id:number,tick:number,r:WorldGenerationRandom,version:number):WorldFactionLeader256|undefined {
 const d=WORLD_FACTION_DEFINITIONS_256[faction.def];if(!d.leaderKinds.length)return;
 // This draw selects the actual referenced role, including duplicate entries.
 const role=d.leaderKinds[r.integer(0,d.leaderKinds.length)]!;
 const name=people[r.integer(0,people.length)]+' '+roots[r.integer(0,roots.length)];
 const seed=r.integerValue(),index=r.integer(0,3),pawn=startingPawn(id,name,0,0,index,.65,seed>>>0,tick,version);
 pawn.faction=d.permanentEnemy||d.naturalEnemy?'outlaws':'outlanders';
 giveBornTraits361({schemaVersion:version,seed:seed>>>0},pawn,pawn.faction==='outlaws',seed>>>0);
 if(version>=259)pawn.worldAffiliation259={revision:1,factionId:faction.id,hostFactionId:null,guestStatus:'Guest'};
 // Role is a source reference, not a promise of Core loadout/biography. The
 // current real person constructor supplies age/health/skills/appearance.
 if(!role)throw Error('Missing leader role');return {factionId:faction.id,clock:tick,pawn,items:[],packed:[]};
}
export interface WorldForeignFactionGenerationInput256 {
 version:number;tick:number;tiles:readonly SettlementTile[];selection:readonly ConfigurableWorldFaction[];population:ClimateSetting;
 nextFactionId:number;nextSettlementId:number;nextThingId:number;
 random:WorldGenerationRandom;admission?:Omit<SettlementAdmission,'settlementTiles'>&{settlementTiles?:ReadonlySet<number>};
 /** The game's name data (read from an installed game by the tools): faction
  * and settlement names drawn as the game draws them. Absent: Elsewhere's
  * names and draws, unchanged. */
 names?:CoreFactionNames;
 /** Observer of the stream (tools): called right before a faction's leader
  * is drawn, with the step's generator state at that point. */
 onLeaderStart?:(faction:Readonly<WorldFactionInstance256>,index:number,state:Readonly<{seed:number;counter:number}>)=>void;
}
export type WorldForeignFactionGenerationResult256={ok:true;draft:WorldForeignFactionDraft256;nextThingId:number}|{ok:false;reason:string};
export type WorldFactionCompletionResult256={ok:true;registry:WorldFactionRegistry256}|{ok:false;reason:string};
/** One synchronous draft. No existing World/registry is mutated; the supplied
 * step-local RNG really advances, so the caller discards that draft on refusal.
 * Native grammar/Pawn output seed parity is explicitly not claimed. */
export function generateForeignWorldFactions256(input:WorldForeignFactionGenerationInput256):WorldForeignFactionGenerationResult256 {
 if(input.version<256||!int(input.tick)||!Number.isInteger(input.population)||input.population<0||input.population>6||!input.tiles.length||!validWorldFactionSelection(input.selection)||
  !int(input.nextFactionId,1)||!int(input.nextSettlementId,1)||!int(input.nextThingId,1))return {ok:false,reason:'Invalid prospective foreign faction inputs'};
 const r=input.random,registry:WorldForeignFactionDraft256={revision:1,contentModel:'original-faction-content-v1',generatedAt:input.tick,
  noExpansionIdeoIds:constructCoreNoExpansionIdeoIds256(),nextFactionId:input.nextFactionId,nextSettlementId:input.nextSettlementId,factions:[],relations:[],settlements:[],leaders:[]};
 let nextThingId=input.nextThingId;
 const occupied=new Set(input.admission?.settlementTiles),admission:SettlementAdmission={...input.admission,settlementTiles:occupied};
 const addSettlement=(faction:WorldFactionInstance256,tile:number)=>{
  if(!int(registry.nextSettlementId+1,1))return false;
  const id=registry.nextSettlementId++,name=input.names?coreSettlementName(input.names,faction.def,registry.settlements.map(s=>s.name),r):originalName(r,new Set(registry.settlements.map(s=>s.name)),true,id);
  registry.settlements.push({id,factionId:faction.id,tile,name,postId:null});occupied.add(tile);return true;
 };
 for(const def of input.selection){
  if(!int(registry.nextFactionId+1,1))return {ok:false,reason:'Faction identity exhausted'};
  const randomKey=r.integer(0,2147483647),id=registry.nextFactionId++,colorFromSpectrum=spectrum(def,r,registry.factions);
  const d=WORLD_FACTION_DEFINITIONS_256[def];
  // Actual Core initialization precedes faction names. Seeds/IDs remain owned.
  const noExpansionIdeo=constructFactionNoExpansionIdeo256(def,registry.noExpansionIdeoIds!,r);
  const faction:WorldFactionInstance256={...input.version>=259?{lifecycle259:{revision:1 as const,defeated:false,temporary:false}}:{},id,def,hidden:d.hidden,name:input.names?coreFactionName(input.names,def,registry.factions.filter(p=>!p.hidden).map(p=>p.name),r):factionName(def,id,r,registry.factions),randomKey,colorFromSpectrum,leaderOwnerId:null,...noExpansionIdeo?{noExpansionIdeo}:{}};
  for(const other of registry.factions){const goodwill=initialWorldGoodwill256(def,other.def);
   registry.relations.push({aId:Math.min(id,other.id),bId:Math.max(id,other.id),goodwill,kind:worldRelationKind256(goodwill)});}
  if(!faction.hidden){const choice=pickWorldSettlementTile(input.tiles,r,admission);
   if(!choice.found||!addSettlement(faction,choice.tile))return {ok:false,reason:'No admissible initial settlement'};}
  if(d.leaderKinds.length){if(!int(nextThingId+1,1))return {ok:false,reason:'Person identity exhausted'};
   input.onLeaderStart?.(faction,registry.factions.length,r.state);
   const owner=originalLeader(faction,nextThingId,input.tick,r,input.version);if(!owner)return {ok:false,reason:'Leader producer missing'};
   nextThingId++;faction.leaderOwnerId=owner.pawn.id;registry.leaders.push(owner);}
  registry.factions.push(faction);
 }
 const factions=registry.factions.flatMap(a=>{const p=placementFaction(a);return p?[p]:[];}),eligible=factions.filter(a=>settlementFactionWeight(a)>0).length;
 const quota=worldSettlementQuota(input.tiles.length,input.population,occupied.size,eligible,r);
 for(let i=0;i<quota;i++){
  const choice=nextWorldSettlement(input.tiles,factions,r,admission),faction=choice&&registry.factions.find(f=>f.id===choice.factionId);
  if(!choice?.found||!faction||!addSettlement(faction,choice.tile))return {ok:false,reason:'No admissible density settlement'};
 }
 return {ok:true,draft:registry,nextThingId};
}

/** Post-world hook, AFTER foreign factions and roads. The caller owns a distinct
 * post-world RNG reset to the root world seed before finalization/hooks; it must
 * never pass the consumed step500 stream here. Only Core no-expansion initial
 * culture/precept state is owned; labels/leader content remain original. */
export function completeWorldFactionRegistry256(input:{version:number;draft:WorldForeignFactionDraft256;playerDef:'PlayerColony'|'PlayerTribe';name:string;postWorldRandom:WorldGenerationRandom}):WorldFactionCompletionResult256 {
 const d=input.draft;
 if(!validFactionNoExpansionIdeos256(d,input.version))return {ok:false,reason:'Invalid no-expansion faction initialization authority'};
 if(input.version<256||!d||Object.hasOwn(d,'playerFactionId')||d.revision!==1||d.contentModel!=='original-faction-content-v1'||!int(d.nextFactionId,1)||!int(d.nextFactionId+1,1)||
  !['PlayerColony','PlayerTribe'].includes(input.playerDef)||typeof input.name!=='string'||!input.name.trim()||input.name.length>80||/[\u0000-\u001f\u007f-\u009f]/.test(input.name)||
  !validWorldFactionSelection(d.factions.map(f=>f.def))||d.factions.some(f=>WORLD_FACTION_DEFINITIONS_256[f.def].player||f.id>=d.nextFactionId))return {ok:false,reason:'Invalid post-world faction draft'};
 const r=input.postWorldRandom,id=d.nextFactionId,randomKey=r.integer(0,2147483647),colorFromSpectrum=spectrum(input.playerDef,r,d.factions);
 // Core's player branch has no faction-name draw or initial settlement. The
 // existing real starting people remain the player's owners, no leader clone.
 // Capture the unpublished continuation; completion never mutates its input.
 const noExpansionIdeoIds=d.noExpansionIdeoIds?{...d.noExpansionIdeoIds}:undefined;
 const noExpansionIdeo=noExpansionIdeoIds?constructFactionNoExpansionIdeo256(input.playerDef,noExpansionIdeoIds,r):undefined;
 const player:WorldFactionInstance256={...input.version>=259?{lifecycle259:{revision:1 as const,defeated:false,temporary:false}}:{},id,def:input.playerDef,hidden:false,name:input.name,randomKey,colorFromSpectrum,leaderOwnerId:null,...noExpansionIdeo?{noExpansionIdeo}:{}};
 const relations=[...d.relations];
 for(const other of d.factions){const goodwill=initialWorldGoodwill256(input.playerDef,other.def);
  relations.push({aId:Math.min(id,other.id),bId:Math.max(id,other.id),goodwill,kind:worldRelationKind256(goodwill)});}
 return {ok:true,registry:{...d,...noExpansionIdeoIds?{noExpansionIdeoIds}:{},playerFactionId:id,nextFactionId:id+1,factions:[...d.factions,player],relations}};
}
