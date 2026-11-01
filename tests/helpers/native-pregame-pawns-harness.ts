import {vi} from 'vitest';
import {createNativeFrontMenu} from '../../src/ui3d/native-front';
import {SCHEMA_VERSION} from '../../src/sim/types';
import {generateCoveredSurfaceMesh,cropSurfaceCells,surfaceVisibilityAxis} from '../../src/sim/world-surface-mesh';
import {stableWorldSeedHash} from '../../src/sim/world-climate-settings';
import {defaultWorldGenerationSettings,worldClimateSettings,worldGenerationKey,INTRINSIC_WORLD_FACTIONS} from '../../src/sim/world-generation-settings';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../../src/sim/world-faction-generation';
import {WorldGenerationRandom} from '../../src/sim/world-generation-random';
import {generateCoreWorldMutators256} from '../../src/sim/world-local-mutators-256';
import {captureGeneratedGeography256} from '../../src/sim/world-geography-owner-256';
import {canPlaceWorldSettlement} from '../../src/sim/world-settlement-placement';
import type {WorldPhysicalSurface,WorldSurfaceTile} from '../../src/sim/world-surface-geography';
import type {GeographicWorldDraft256} from '../../src/sim/world-geographic-draft';
import type {WorldRoadLink} from '../../src/sim/world-roads';
import type {FrontMenuOptions} from '../../src/ui/front-menu';
import type {NativeControl,NativePage,NativeRow} from '../../src/ui3d/native-contract';
import type {WorldCreationCallbacks256} from '../../src/ui/world-creation-contract';

export const PAWNS_UI_SEED=6157301;
/** Pure reduced geography only. No World/Engine, local map, campaign, step,
 * save, Worker or normal whole-planet generator is constructed or invoked. */
function preparedGeography(){
 const seedText=String(PAWNS_UI_SEED),generationSeed=stableWorldSeedHash(seedText)>>>0,settings={...defaultWorldGenerationSettings(),coverage:1 as const,factions:['OutlanderCivil','TribeCivil',...INTRINSIC_WORLD_FACTIONS] as ReturnType<typeof defaultWorldGenerationSettings>['factions']};
 const cells=cropSurfaceCells(generateCoveredSurfaceMesh(1,2),1,surfaceVisibilityAxis(1));if(cells.length!==92)throw Error('Declared UI mesh requires92 cells.');
 const tiles:WorldSurfaceTile[]=cells.map((cell,id)=>({id,center:cell.center,corners:cell.corners,neighbours:cell.neighbours,biome:'temperate-forest',hilliness:'flat',elevation:20,meanTemperature:12,rainfall:900,swampiness:.25,rivers:[],riverDistance:0}));
 const roads:WorldRoadLink[][]=tiles.map(()=>[]),surface:WorldPhysicalSurface={revision:3,radius:100,seedText,generationSeed,settings:worldClimateSettings(settings),tiles};
 const foreign=generateForeignWorldFactions256({version:SCHEMA_VERSION,tick:0,tiles,selection:settings.factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:1,random:new WorldGenerationRandom(821)});if(!foreign.ok)throw Error('Fixed UI geography: '+foreign.reason);
 const completed=completeWorldFactionRegistry256({version:SCHEMA_VERSION,draft:foreign.draft,playerDef:'PlayerColony',name:'Équipe du composant',postWorldRandom:new WorldGenerationRandom(821)});if(!completed.ok)throw Error('Fixed UI player: '+completed.reason);
 const draft:GeographicWorldDraft256={revision:1,key:'private-pawns-ui-reduced92-not-saveable',surface,roads,settings,factions:completed.registry,nextThingId:foreign.nextThingId,mutators:generateCoreWorldMutators256(tiles,generationSeed).codes};
 const geography=captureGeneratedGeography256(draft),occupied=new Set(completed.registry.settlements.map(settlement=>settlement.tile)),first=tiles.find(tile=>canPlaceWorldSettlement(tiles,tile.id,{settlementTiles:occupied}));if(!first)throw Error('No actual admissible tile in this fixed UI component.');
 return{geography,registry:completed.registry,firstTile:first.id};
}
const source=preparedGeography();

/** The optional factory lets Root pair captured baseline and candidate on the
 * same declared UI seed/geography. Setup and imports are outside any measure. */
export function createPawnsUiHarness(factory:typeof createNativeFrontMenu=createNativeFrontMenu){
 const player={scenario:'crashlanded',playerDef:'PlayerColony' as const,playerName:'Équipe du composant'},sourceBefore=JSON.stringify({definition:source.geography.definition,registry:source.registry}),surface=source.geography.surface;
 const backend:WorldCreationCallbacks256={generate:vi.fn<WorldCreationCallbacks256['generate']>(async request=>({generation:1,key:worldGenerationKey(request.seed,request.settings),request,geography:source.geography,factions:source.registry.factions.map(f=>({id:f.id,name:f.name,def:f.def,hidden:f.hidden})),settlements:source.registry.settlements.map(s=>({id:s.id,factionId:s.factionId,tile:s.tile,name:s.name}))})),confirmSite:vi.fn<WorldCreationCallbacks256['confirmSite']>(async request=>({...request,ticket:'UI-PREPARED-NO-WORKER',player})),start:vi.fn<WorldCreationCallbacks256['start']>(async()=>{})};
 const yes=()=>true,no=()=>false,noop=async()=>{};
 const options:FrontMenuOptions={worldCreation:backend,getWorldCreationPlayer:()=>player,onStart:vi.fn(noop),onLoad:vi.fn(noop),onResume:vi.fn(noop),getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:vi.fn(noop),onImport:vi.fn(noop)};
 let page:NativePage|undefined;const menu=factory(options,next=>{page=next??undefined;});
 const control=(id:string):NativeControl=>{const value=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(item=>item.id===id);if(!value)throw Error('Missing native control '+id);return value;};
 const row=(id:string):NativeRow=>{const value=page?.rows.find(item=>item.id===id);if(!value)throw Error('Missing native row '+id);return value;};
 const click=async(id:string)=>{const value=control(id);if(value.disabled)throw Error('Disabled native control '+id);await value.onActivate();};
 function openSeededCreation(){
  // Only the two explicit front-menu entropy draws are controlled, and the
  // browser service is restored synchronously before any later interaction.
  const target=globalThis.crypto,descriptor=Object.getOwnPropertyDescriptor(target,'getRandomValues');
  Object.defineProperty(target,'getRandomValues',{configurable:true,value:(values:Uint32Array)=>{if(!(values instanceof Uint32Array)||values.length!==1)throw Error('Only one front-menu seed draw is admitted.');values[0]=PAWNS_UI_SEED;return values;}});
  try{menu.showCreation();}finally{if(descriptor)Object.defineProperty(target,'getRandomValues',descriptor);else delete(target as unknown as Record<string,unknown>).getRandomValues;}
 }
 async function enterPawns(){
  openSeededCreation();await click('scenario-next');await click('difficulty-Récit d’aventure');await click('reloadable');await click('story-next');
  await control('coverage').select!.onChange('1');for(const index of[7,6,5,4,3,1])await click('remove-faction-'+index);
  await click('generate-world');await row('tile-input').input!.onCommit(String(source.firstTile));await click('confirm-site');await click('confirm-accept');
  if(page?.id!=='front-pawns')throw Error('The real UI flow did not reach its candidate screen.');
 }
 function sourceUnchanged(){return JSON.stringify({definition:source.geography.definition,registry:source.registry})===sourceBefore&&source.geography.surface===surface;}
 const order=()=>page?.rows.filter(value=>/^candidate-\d+$/.test(value.id)).map(value=>Number(value.id.slice('candidate-'.length)))??[];
 return{menu,options,backend,control,row,click,enterPawns,sourceUnchanged,order,get page(){return page;},geography:source.geography};
}
