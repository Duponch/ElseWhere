// The places of the game that show lore texts read them through the lore
// lookup: the installed RimWorld's when loaded, Elsewhere's otherwise. The
// « game » texts here are invented (« zorp … »), made for every mapped id.
import {afterEach,describe,expect,it,vi} from 'vitest';
import {createWorld,applyCommand} from '../src/sim/index';
import type {MaterialPile,World} from '../src/sim/types';
import {advanceArrivals,applyArrival,enableArrivals} from '../src/sim/arrivals';
import {TRAITS} from '../src/sim/traits';
import {appearanceOf} from '../src/sim/pawn-appearance';
import {ITEM_DEFINITIONS} from '../src/sim/items';
import {CORE_BACKSTORIES_370} from '../src/sim/core-backstories-370';
import {generateForeignWorldFactions256,completeWorldFactionRegistry256} from '../src/sim/world-faction-generation';
import {defaultWorldGenerationSettings} from '../src/sim/world-generation-settings';
import {WorldGenerationRandom} from '../src/sim/world-generation-random';
import {gameLoreTargets} from '../src/lore/game-lore-mapping';
import {gameLoreTextsOf,setGameLoreTexts} from '../src/lore/lore-text';
import type {LoreCategoryId,LoreEntry} from '../src/lore/lore-types';
import {backgroundInspectionRows} from '../src/ui/background-inspection';
import {itemInformation} from '../src/ui/item-information';
import {traitSummary} from '../src/ui/traits-inspection';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {buildNativeArrivals} from '../src/ui3d/native-arrivals';
import {buildNativeFactions} from '../src/ui3d/native-world';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {createPawnsUiHarness} from './helpers/native-pregame-pawns-harness';

/** Invented « game » texts for every id the game can answer. */
function inventedGameTexts():void {
 const entries:LoreEntry[]=gameLoreTargets().map(target=>{
  const [category,group,key]=target.id.split('/') as [LoreCategoryId,string,string];
  const person=target.read.kind==='backstory'||target.read.kind==='trait';
  return {id:target.id,origin:'installed',category,group,key,title:`zorp ${key}`,titleFemale:`zorpe ${key}`,
   description:person?`[PAWN_nameDef] zorpe {PAWN_gender ? il : elle : iel} ${key}.`:`Zorp ${key}.`,source:{file:'Data/Core/Defs/x.xml',symbol:target.defName}};
 });
 setGameLoreTexts(gameLoreTextsOf('RimWorld · Zorgish','Zorgish','LanguageWorker_French',entries,{Prohe:'ilz',Proshe:'ellz'}));
}
afterEach(()=>setGameLoreTexts(undefined));

let epoch=990100;
function state(world:World,patch:Partial<NativeUiState>={}):NativeUiState {
 return {world,epoch:++epoch,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',
  creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],...patch};
}
function actions(world:World,current:()=>NativeUiState,show:(page:NativePage)=>void):NativeUiActions {
 const noop=()=>{};
 return {command:vi.fn(async command=>command.type==='answer-arrival'?applyArrival(world,command):applyCommand(world,command)),readState:current,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,
  material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:show,closePage:noop,refresh:noop} as NativeUiActions;
}
const controlOf=(page:NativePage,id:string):NativeControl=>{const found=[...(page.actions??[]),...page.rows.flatMap(row=>row.controls??[])].find(value=>value.id===id);if(!found)throw Error('Missing '+id);return found;};
function colonist(world:World){
 const pawn=world.pawns[0]!;
 pawn.background={childhood:'SewerKid57',adulthood:'NavyScientist52'};pawn.traits=['optimist','kind'];
 return pawn;
}

describe('Bio and story tooltips',()=>{
 it('show the game’s titles and texts resolved for the person, and Elsewhere’s without it',()=>{
  // Without a stored appearance: the inspector shows the stable fallback's sex, and so do the texts.
  const world=createWorld(7301,16,16),pawn=colonist(world);delete pawn.appearance;const sex=appearanceOf(pawn,world.seed).sex;
  const elsewhere=backgroundInspectionRows(pawn,sex);
  expect(elsewhere[0]!.label).toBe(sex==='female'?CORE_BACKSTORIES_370.SewerKid57.labelFemale:CORE_BACKSTORIES_370.SewerKid57.label);
  expect(elsewhere[0]!.tooltip.body).toBe(CORE_BACKSTORIES_370.SewerKid57.description);
  inventedGameTexts();
  const rows=backgroundInspectionRows(pawn,sex),form=sex==='female'?'elle':sex==='male'?'il':'iel';
  expect(rows.map(row=>row.label)).toEqual(sex==='female'?['zorpe SewerKid57','zorpe NavyScientist52']:['zorp SewerKid57','zorp NavyScientist52']);
  expect(rows[0]!.tooltip.body).toBe(`${pawn.name} zorpe ${form} SewerKid57.`);
  // Gains and refusals stay Elsewhere's rules.
  expect(rows[0]!.tooltip.rows?.[0]?.label).toBe('Gains à la création');
  setNativeInspectorTab('bio');
  let page:NativePage|undefined;const current=state(world,{selectedPawnIds:[pawn.id]});
  page=buildNativeInspector(current,actions(world,()=>current,next=>{page=next;}))!;
  // The Bio card's chips (Core CharacterCardUtility).
  const bio=page.rows.find(row=>row.id==='bio-card')!.bio!,trait=bio.traits.find(chip=>chip.id==='trait-optimist');
  expect(bio.stories.find(story=>story.chip.id==='childhood')?.chip.label).toBe(rows[0]!.label);
  expect(trait?.label).toBe(sex==='female'?'Zorpe optimist':'Zorp optimist');
  expect(trait?.hint).toBe(`${pawn.name} zorpe ${form} optimist.\n\n${TRAITS.optimist.description}`);
  expect(traitSummary({...pawn,appearance:{sex}})).toBe(sex==='female'?'Zorpe optimist · Zorpe kind':'Zorp optimist · Zorp kind');
 });
});

describe('inspection of things',()=>{
 it('names piles and gives the game’s description',()=>{
  const world=createWorld(7302,16,16),id=world.nextId++;
  const pile={id,item:'wood',kind:'wood',quantity:12,owner:{type:'ground',x:2,z:2}} as MaterialPile;world.piles.push(pile);
  expect(itemInformation(pile).title).toBe(ITEM_DEFINITIONS.wood.label);
  inventedGameTexts();
  expect(itemInformation(pile)).toMatchObject({title:'Zorp wood',description:'Zorp wood.'});
  let page:NativePage|undefined;const current=state(world,{selectedObjects:[{kind:'pile',id}]});
  page=buildNativeInspector(current,actions(world,()=>current,next=>{page=next;}))!;
  expect(page.title).toBe('Zorp wood × 12');expect(page.subtitle).toBe('Zorp wood.');
 });
});

describe('arrival letters',()=>{
 it('show the game’s story and trait texts in their neutral forms (the offer has no sex yet)',()=>{
  const world=createWorld(7303,16,16);enableArrivals(world);world.arrivals!.nextCheck=world.tick;advanceArrivals(world);
  const offer=world.arrivals!.pending!;offer.background={childhood:'SewerKid57',adulthood:'NavyScientist52'};offer.traits=['optimist'];
  inventedGameTexts();
  const current=state(world,{panel:'quests'}),page=buildNativeArrivals(current,actions(world,()=>current,()=>{}));
  expect(page.rows.find(row=>row.id==='arrival-background-0')).toMatchObject({label:'Enfance · zorp SewerKid57',detail:`${offer.name} zorpe iel SewerKid57.`});
  expect(page.rows.find(row=>row.id==='arrival-trait-optimist')).toMatchObject({label:'Zorp optimist',detail:`${offer.name} zorpe iel optimist.\n\n${TRAITS.optimist.description}`});
 });
});

describe('faction panel',()=>{
 it('shows the game’s faction names, description and leader title',async()=>{
  const world=createWorld(7304,16,16);
  const tiles=Array.from({length:128},(_,i)=>({biome:'temperate-forest' as const,hilliness:'flat' as const,neighbours:[(i+127)%128,(i+1)%128]}));
  const generated=generateForeignWorldFactions256({version:world.schemaVersion,tick:world.tick,tiles,selection:defaultWorldGenerationSettings().factions,population:3,nextFactionId:1,nextSettlementId:1,nextThingId:world.nextId,random:new WorldGenerationRandom(821)});
  if(!generated.ok)throw Error(generated.reason);
  const completed=completeWorldFactionRegistry256({version:world.schemaVersion,draft:generated.draft,playerDef:'PlayerColony',name:'Camp UI',postWorldRandom:new WorldGenerationRandom(821)});
  if(!completed.ok)throw Error(completed.reason);world.worldFactions=completed.registry;
  const foreign=completed.registry.factions.find(faction=>!faction.hidden&&faction.def==='OutlanderCivil')!;
  inventedGameTexts();
  let page:NativePage;const current=state(world),act=actions(world,()=>current,next=>{page=next;});
  page=buildNativeFactions(current,act);
  const type=controlOf(page,`faction-${foreign.id}-field-0`);expect(type.label).toBe('Zorp OutlanderCivil');expect(type.hint).toBe('Zorp OutlanderCivil.');
  await type.onActivate();
  expect(page!.rows.find(row=>row.id==='faction-detail-type')).toMatchObject({value:'Zorp OutlanderCivil'});
  expect(page!.rows.find(row=>row.id==='faction-detail-leader')?.label).toMatch(/^Zorpe? OutlanderCivil$/);
  // The player's colony has no game counterpart in the registry: Elsewhere's label.
  const player=completed.registry.factions.find(faction=>faction.id===completed.registry.playerFactionId)!;
  page=buildNativeFactions(current,act);expect(controlOf(page,`faction-${player.id}-field-0`).label).toBe('Colonie');
 });
});

describe('candidate selection',()=>{
 it('shows the inspected candidate’s stories and traits from the game',async()=>{
  const f=createPawnsUiHarness();await f.enterPawns();
  inventedGameTexts();
  await f.click(f.page!.rows.find(row=>/^candidate-\d+$/.test(row.id))!.controls![0]!.id);
  const bio=f.page!.rows.find(row=>row.id==='candidate-bio')!.bio!,childhood=bio.stories.find(story=>story.chip.id==='childhood')?.chip,traits=bio.traits;
  expect(childhood?.label).toMatch(/^zorpe? /);expect(childhood?.hint).toMatch(/ zorpe (il|elle|iel) /);
  for(const trait of traits)expect(trait.label).toMatch(/^Zorpe? /);
 });
});
