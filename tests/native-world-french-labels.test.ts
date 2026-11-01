import {describe,expect,it,vi} from 'vitest';
import {buildNativeWorld,setNativeWorldTab} from '../src/ui3d/native-world';
import {effectiveCore297} from '../src/sim/core-phase-297';
import {createWorldUiModels} from './helpers/native-world-french-labels-model';
import type {CampaignMapSummary,CampaignSummary,WorldMapKind} from '../src/sim/world-map-state';
import type {LegacyPlanetState} from '../src/sim/planet-state';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';

// Reduced92-cell geography and explicit projection summaries only, never a
// saved/admitted campaign. The actual source World is created once at Core0.
const models=createWorldUiModels();let epoch=718300;
function ui(campaign:CampaignSummary){
 const state:NativeUiState={campaign,epoch:++epoch,panel:'world',category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
 let page:NativePage;const noop=()=>{},command=vi.fn<NativeUiActions['command']>(async()=>{throw Error('Label inspection must not issue a command.');});
 const actions:NativeUiActions={readState:()=>state,command,panel:vi.fn(),category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:vi.fn(),exportSave:vi.fn(),showPage:next=>{page=next;},refresh:vi.fn()};
 const worldBefore=JSON.stringify(models.baseWorld),campaignBefore=JSON.stringify(campaign),owner=models.geography;
 setNativeWorldTab('maps');page=buildNativeWorld(state,actions);
 return{get page(){return page;},async tile(id:number){await page.rows.find(row=>row.id==='world-tile')!.input!.onCommit(String(id));},unchanged(){expect(JSON.stringify(models.baseWorld)).toBe(worldBefore);expect(JSON.stringify(campaign)).toBe(campaignBefore);expect(models.geography).toBe(owner);expect(effectiveCore297(models.baseWorld)).toBe(0);expect(command).not.toHaveBeenCalled();expect(actions.save).not.toHaveBeenCalled();expect(actions.exportSave).not.toHaveBeenCalled();expect(actions.panel).not.toHaveBeenCalled();}};
}

describe('World French presentation reads the same unmodified source facts',()=>{
 it('names all existing map kinds without tile suffixes and agrees0/1/3people',()=>{
  const kinds:WorldMapKind[]=['settlement','settlement','camp','battlefield','foreign-settlement','quest-site','legacy-site'],counts=[3,1,0,1,0,3,0];
  const maps:CampaignMapSummary[]=kinds.map((kind,id)=>({...models.scenes[3].maps[0]!,id,kind,pawnCount:counts[id]!,selected:id===0}));
  const f=ui({...models.scenes[3],maps});
  expect(f.page.rows.filter(row=>/^map-\d+$/.test(row.id)).map(row=>row.value)).toEqual(['3 personnes · Foyer','1 personne · Colonie','0 personnes · Camp temporaire','1 personne · Champ de bataille','0 personnes · Établissement étranger','3 personnes · Site temporaire','0 personnes · Site conservé']);f.unchanged();
 });
 it('keeps literal legacy tiles and presents their biome/relief in French',async()=>{
  const legacy:LegacyPlanetState={revision:2,adoptedAt:0,generationSeed:19281,homeTile:0,civilianTile:1,nextGroupId:1,tiles:[{id:0,center:[0,1,0],neighbours:[1],biome:'boreal-forest',hilliness:'flat',meanTemperature:5,rainfall:900},{id:1,center:[1,0,0],neighbours:[0],biome:'ocean',hilliness:'small-hills',meanTemperature:10,rainfall:900}]};
  const tiles=legacy.tiles,f=ui({...models.scenes[3],planet:legacy});expect(f.page.rows.find(row=>row.id==='world-selected-tile')?.label).toBe('Case 0 · Forêt boréale · Plat');await f.tile(1);expect(f.page.rows.find(row=>row.id==='world-selected-tile')?.label).toBe('Case 1 · Océan · Petites collines');expect(legacy.tiles).toBe(tiles);f.unchanged();
 });
 it('uses the real revision3 reader for Ocean/Lake and all five typed relief keys',async()=>{
  const f=ui(models.scenes[3]);
  for(const [id,label] of [[0,'Case 0 · Forêt boréale · Plat'],[1,'Case 1 · Océan · Petites collines'],[2,'Case 2 · Lac · Grandes collines'],[3,'Case 3 · Forêt tempérée · Montagnes'],[4,'Case 4 · Toundra · Infranchissable']] as const){await f.tile(id);expect(f.page.rows.find(row=>row.id==='world-selected-tile')?.label).toBe(label);}
  f.unchanged();
 });
});
