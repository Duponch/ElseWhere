import {describe,expect,it,vi} from 'vitest';
import {createWorld,applyCommand} from '../src/sim/engine.ts';
import type {Job,MaterialPile,World} from '../src/sim/types.ts';
import {ConstructionMaterialChoices,countedConstructionMaterials,defaultConstructionMaterial} from '../src/ui/construction-material-choice';
import {constructionMaterialLines,constructionCostText,constructionThingLabel,constructionToolObject} from '../src/ui/construction-material-presentation';
import {constructionDeliveryLabel} from '../src/ui/construction-controls';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import {buildNativePanel} from '../src/ui3d/native-panels';
import {mapHoverLines} from '../src/ui/map-hover-readout';
import type {NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {toolDefinitions} from '../src/ui3d/native-catalog';

function fixture(){const w=createWorld(379,20,20);w.tiles=w.tiles.map(()=>({terrain:'soil' as const}));w.structures=[];w.resources=[];w.jobs=[];w.piles=[];w.stockpiles=[];return w;}
function stock(w:World,item:MaterialPile['item'],quantity:number,x:number,z:number,stored=true){
 const pile:MaterialPile={id:w.nextId++,item,quantity,kind:item==='wood'?'wood':item.endsWith('-blocks')?'blocks':item==='cloth'||item==='devilstrand'?'textile':item as MaterialPile['kind'],owner:{type:'ground',x,z}};w.piles.push(pile);
 if(stored)w.stockpiles.push({id:w.nextId++,x,z,filters:{wood:true,food:true,steel:true,blocks:true,textile:true},priority:3,capacity:75});return pile;
}
function ui(w:World,selection:Partial<NativeUiState>={}){
 const state:NativeUiState={world:w,epoch:379,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],...selection};
 const noop=()=>{},actions:NativeUiActions={readState:()=>state,command:vi.fn(async c=>applyCommand(w,c)),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop};return {state,actions};
}
function job(w:World,kind:Job['kind'],material:Job['material'],construction:Job['construction']='frame'):Job {const p:Job={id:w.nextId++,kind,x:12,z:12,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},material,construction};w.jobs.push(p);return p;}
describe('named Core construction resources and per-designator materials',()=>{
 it('shows each actual named resource, counts physical deliveries only and merges repeated materials',()=>{
  const w=fixture(),j=job(w,'research-bench','wood'),wood=stock(w,'wood',20,2,2),steel=stock(w,'steel',10,3,2);wood.owner={type:'job',jobId:j.id};steel.owner={type:'job',jobId:j.id};
  const inbound=stock(w,'wood',30,4,2);inbound.owner={type:'pawn',pawnId:w.pawns[0]!.id};
  expect(constructionMaterialLines(j,w,j)).toEqual([{item:'wood',label:'Bois',required:75,delivered:20,remaining:55},{item:'steel',label:'Acier',required:25,delivered:10,remaining:15}]);
  expect(constructionDeliveryLabel(w,j)).toBe('Bois : 20 / 75 · Acier : 10 / 25');
  expect(constructionMaterialLines({kind:'research-bench',material:'steel'})).toMatchObject([{item:'steel',required:100}]);
  expect(constructionCostText({kind:'table-large',material:'marble-blocks'})).toBe('100 Blocs de marbre');expect(constructionThingLabel('Table 3 × 3',{kind:'table-large',material:'marble-blocks'})).toBe('Table 3 × 3 en marbre');
 });
 it('distinguishes acquired historical tailor recipes from prospective379 costs',()=>{
  const old={kind:'electric-tailor-bench' as const,material:'steel' as const};expect(constructionCostText(old)).toBe('50 Acier + 2 Composants');
  expect(constructionMaterialLines(constructionToolObject('electric-tailor-bench','steel'),undefined,undefined,true)).toMatchObject([{item:'steel',required:125},{item:'component',required:2}]);
  expect(constructionMaterialLines({...old,tailorSteel379:true})).toMatchObject([{item:'steel',required:125},{item:'component',required:2}]);
 });
 it('counts Core stored materials, excluding loose/fogged/carry/job piles while keeping forbidden stock',()=>{
  const w=fixture(),stored=stock(w,'steel',25,2,2),loose=stock(w,'wood',50,3,2,false),carry=stock(w,'wood',50,4,2),delivered=stock(w,'wood',50,5,2);carry.owner={type:'inventory',pawnId:w.pawns[0]!.id};delivered.owner={type:'job',jobId:999};stored.forbidden=true;
  expect(countedConstructionMaterials(w).get('steel')).toBe(25);expect(countedConstructionMaterials(w).get('wood')).toBeUndefined();expect(loose.owner.type).toBe('ground');
  expect(defaultConstructionMaterial(w,'wall')).toBe('steel');
  stock(w,'wood',5,6,2);expect(defaultConstructionMaterial(w,'wall')).toBe('wood');
  w.site={revision:3,tileId:0,mapSeed:w.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};w.exploration={revision:1};w.tiles[2*w.width+6]!.fogged=true;
  expect(countedConstructionMaterials(w).get('wood')).toBeUndefined();expect(defaultConstructionMaterial(w,'wall')).toBe('steel');
 });
 it('uses the base Stuff threshold and native suggestion order, and keeps every tool’s explicit choice',()=>{
  const w=fixture(),choices=new ConstructionMaterialChoices();stock(w,'steel',75,2,2);stock(w,'marble-blocks',75,3,2);stock(w,'sandstone-blocks',75,4,2);
  expect(defaultConstructionMaterial(w,'electric-tailor-bench')).toBe('steel'); //75stuff, fixed50steel is separate.
  expect(defaultConstructionMaterial(w,'electric-tailor-bench',new Map([['steel',74]]))).toBe('wood');
  expect(defaultConstructionMaterial(w,'wall',new Map([['jade',500]]))).toBe('wood');
  expect(defaultConstructionMaterial(w,'electric-crematorium',new Map([['marble-blocks',150],['sandstone-blocks',150]]))).toBe('sandstone-blocks');
  choices.choose('wall','marble-blocks');expect(choices.resolve(w,'wall')).toBe('marble-blocks');expect(choices.resolve(w,'bed')).toBe('steel');
  w.piles=[];expect(choices.resolve(w,'wall')).toBe('marble-blocks');expect(choices.resolve(w,'bed')).toBe('wood');choices.reset();expect(choices.resolve(w,'wall')).toBe('wood');
 });
 it('projects named per-resource lines and actual Stuff in selection, info and hover without rewriting jobs',()=>{
  const w=fixture(),j=job(w,'table-large','marble-blocks'),pile=stock(w,'marble-blocks',20,2,2);pile.owner={type:'job',jobId:j.id};const before=JSON.stringify(w),f=ui(w,{selectedObjects:[{kind:'job',id:j.id}]});setNativeInspectorTab('none');
  const page=buildNativeInspector(f.state,f.actions)!,all=[...page.rows,...page.inspectInfo??[]];expect(page.title).toContain('Table 3 × 3 en marbre');expect(all.some(row=>row.label==='Blocs de marbre'&&row.value==='20 / 100')).toBe(true);expect(JSON.stringify(w)).toBe(before);expect(f.actions.command).not.toHaveBeenCalled();
  expect(mapHoverLines(w,j,1).some(line=>line.includes('Table 3 × 3 en marbre'))).toBe(true);
 });
 it('Architect selected card lists all actual quantities and the chosen named material',()=>{
  const w=fixture(),f=ui(w,{panel:'architect',category:'production',tool:'research-bench',constructionMaterial:'marble-blocks'}),page=buildNativePanel(f.state,f.actions)!;
  expect(page.rows.find(row=>row.id==='architect-selected')!.label).toContain('en marbre');expect(page.rows.find(row=>row.id==='architect-cost-marble-blocks')).toMatchObject({label:'Blocs de marbre',value:'75'});expect(page.rows.find(row=>row.id==='architect-cost-steel')).toMatchObject({label:'Acier',value:'25'});
  expect(page.rows.find(row=>row.id==='architect-material')!.controls![0]!.select!.value).toBe('marble-blocks');
  expect(toolDefinitions.every(tool=>!(/\d+ matériaux?\b/.test(tool.hint)))).toBe(true);
 });
});
