import {describe,expect,it,vi} from 'vitest';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import {worldGenerationKey} from '../src/sim/world-generation-settings';
import {canPlaceWorldSettlement} from '../src/sim/world-settlement-placement';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {createWorldUiModels} from './helpers/native-pregame-world-site-model';
import type {FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';
import type {WorldCreationCallbacks256,WorldCreationPreview256} from '../src/ui/world-creation-contract';

// Same bounded92-cell geography helper as the acquired World UI workshop,
// explicitly a presentation backend, not a normal generation or played World.
const models=createWorldUiModels();
function fixture(){
 const player={scenario:'crashlanded',playerDef:'PlayerColony' as const,playerName:'Équipe du composant'};
 const registry=models.baseWorld.worldFactions!;
 const backend:WorldCreationCallbacks256={generate:vi.fn<WorldCreationCallbacks256['generate']>(async request=>({generation:1,key:worldGenerationKey(request.seed,request.settings),request,geography:models.geography,factions:registry.factions.map(f=>({id:f.id,name:f.name,def:f.def,hidden:f.hidden===true})),settlements:registry.settlements.map(s=>({id:s.id,factionId:s.factionId,tile:s.tile,name:s.name}))})),confirmSite:vi.fn(),start:vi.fn()};
 const yes=()=>true,no=()=>false,noop=async()=>{};
 const options:FrontMenuOptions={worldCreation:backend,getWorldCreationPlayer:()=>player,onStart:vi.fn(noop),onLoad:vi.fn(noop),onResume:vi.fn(noop),getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:vi.fn(noop),onImport:vi.fn(noop)};
 let page:NativePage|undefined;const menu=createNativeFrontMenu(options,next=>{page=next??undefined;});
 const control=(id:string):NativeControl=>{const found=[...(page?.rows.flatMap(row=>row.controls??[])??[]),...(page?.actions??[])].find(value=>value.id===id);if(!found)throw Error('Missing '+id);return found;};
 const click=async(id:string)=>{const selected=control(id);expect(selected.disabled).not.toBe(true);await selected.onActivate();};
 const row=(id:string)=>{const found=page?.rows.find(value=>value.id===id);if(!found)throw Error('Missing row '+id);return found;};
 async function openWorld(){menu.showCreation();await click('scenario-next');await click('difficulty-Récit d’aventure');await click('reloadable');await click('story-next');}
 async function matchPreparedGeography(){await control('coverage').select!.onChange('1');await row('world-seed').input!.onCommit(models.geography.surface.seedText);for(const index of[7,6,5,4,3,1])await click('remove-faction-'+index);}
 return{menu,backend,options,control,click,row,openWorld,matchPreparedGeography,get page(){return page!;}};
}

describe('pregame World/Site region presentation keeps its real creation flow',()=>{
 it('keeps parameter and installed-faction regions, compact named Add controls, live maximum and final Generate',async()=>{
  const f=fixture();await f.openWorld();expect(f.page.layout).toBe('setup');expect(f.page.setupCatalogueWidth).toBe(400);
  for(const id of['world-seed','coverage','world-rainfall','world-temperature','world-population','map-size','season'])expect(f.row(id).region).toBe('catalogue');
  expect(f.row('faction-0').region).toBe('details');expect(f.row('world-add-factions').controls?.find(control=>control.id==='add-faction-OutlanderCivil')?.label).toBe('Union civile');expect(f.page.actions!.at(-1)!.id).toBe('generate-world');
  for(let index=0;index<5;index++)await f.click('add-faction-OutlanderCivil');const retained=f.control('add-faction-OutlanderCivil');await retained.onActivate();expect(f.row('human-faction-count').label).toBe('12 / 12 factions humaines');await retained.onActivate();expect(f.row('human-faction-count').label).toBe('12 / 12 factions humaines');expect(f.control('add-faction-OutlanderCivil').disabled).toBe(true);
  await f.click('reset-factions');expect(f.row('human-faction-count').label).toBe('6 / 12 factions humaines');await f.control('map-size').select!.onChange('325');await f.control('season').select!.onChange('winter');expect(f.row('size-warning')).toBeDefined();expect(f.row('winter-warning')).toBeDefined();expect(f.backend.generate).not.toHaveBeenCalled();expect(f.backend.confirmSite).not.toHaveBeenCalled();expect(f.backend.start).not.toHaveBeenCalled();
 });

 it('shows the chosen place, list and factions independently while preserving all facts, actual choose admission and confirmation',async()=>{
  const f=fixture();await f.openWorld();await f.matchPreparedGeography();await f.control('map-size').select!.onChange('325');await f.control('season').select!.onChange('winter');await f.click('generate-world');expect(f.page.id).toBe('front-site');
  const occupied=new Set(models.baseWorld.worldFactions!.settlements.map(value=>value.tile)),eligible=models.geography.surface.tiles.filter(tile=>canPlaceWorldSettlement(models.geography.surface.tiles,tile.id,{settlementTiles:occupied})).map(tile=>tile.id);expect(eligible.length).toBeGreaterThan(16);
  const beforeWorld=JSON.stringify(models.baseWorld),beforeGeography=JSON.stringify(models.geography.definition),surface=models.geography.surface;
  expect(f.page.visual!.surface).toBe(surface);for(const id of['site-views','tile-input','site-selection-tools'])expect(f.row(id).region).toBe('navigation');
  await f.click('site-view-places');expect(f.page.rows.filter(row=>/^tile-\d+$/.test(row.id))).toHaveLength(16);await f.click('choose-tile-'+eligible[0]);
  expect(f.page.rows.filter(row=>row.id.startsWith('site-fact-'))).toHaveLength(16);expect(f.row('site-fact-14').value).toBe('325 × 325');expect(f.row('site-fact-15').value).toBe('Hiver');expect(f.control('site-view-facts').active).toBe(true);
  f.page.visual!.onSelect(eligible.at(-1)!);expect(f.page.visual!.selected).toBe(eligible.at(-1));await f.click('site-view-places');expect(f.row('tile-pagination').label).toContain('/ '+eligible.length);await f.click('tiles-previous');
  await f.row('tile-input').input!.onCommit(String(eligible[0]));expect(f.control('site-view-facts').active).toBe(true);await f.click('site-view-factions');expect(f.page.rows.filter(row=>row.id.startsWith('world-faction-'))).toHaveLength(models.baseWorld.worldFactions!.factions.filter(f=>!f.hidden).length);expect(f.control('tile-random')).toBeDefined();
  await f.click('tile-random');expect(f.control('site-view-facts').active).toBe(true);expect(eligible).toContain(f.page.visual!.selected);const selected=f.page.visual!.selected;await f.click('confirm-site');expect(f.page.id).toBe('front-confirm');expect(f.row('confirmation').label).toContain(`Confirmer la case ${selected} · 325 × 325 · Hiver`);await f.click('confirm-cancel');expect(f.page.id).toBe('front-site');
  expect(f.backend.generate).toHaveBeenCalledTimes(1);expect(f.backend.confirmSite).not.toHaveBeenCalled();expect(f.backend.start).not.toHaveBeenCalled();expect(JSON.stringify(models.baseWorld)).toBe(beforeWorld);expect(JSON.stringify(models.geography.definition)).toBe(beforeGeography);expect(models.geography.surface).toBe(surface);expect(effectiveCore297(models.baseWorld)).toBe(0);
 });

 it('keeps actual generation cancellation as the last available footer action and ignores its late result',async()=>{
  const f=fixture();await f.openWorld();let release!:(value:WorldCreationPreview256)=>void,signal:AbortSignal|undefined;
  vi.mocked(f.backend.generate).mockImplementationOnce(async(_request,context)=>{signal=context.signal;return new Promise(resolve=>{release=resolve;});});
  const generating=f.click('generate-world');await Promise.resolve();expect(f.page.actions!.at(-1)!.id).toBe('cancel-generation');expect(f.control('cancel-generation').disabled).not.toBe(true);await f.click('cancel-generation');expect(signal!.aborted).toBe(true);release(undefined as never);await generating;
  expect(f.page.id).toBe('front-world');expect(f.page.actions!.at(-1)!.id).toBe('generate-world');expect(f.backend.confirmSite).not.toHaveBeenCalled();expect(f.backend.start).not.toHaveBeenCalled();
 });
});
