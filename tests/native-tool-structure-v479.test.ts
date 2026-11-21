import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/index';
import {projectProgress,researchCost,type ResearchProject} from '../src/sim/research';
import {constructionMaterials} from '../src/sim/construction-materials';
import {ITEM_DEFINITIONS} from '../src/sim/items';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {researchProjects} from '../src/ui/research-projects';
import {productionToolOrder,toolDefinitions} from '../src/ui3d/native-catalog';
import {buildNativePanel,buildNativeToolPalette} from '../src/ui3d/native-panels';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';

let seed=479100;
function fixture(){
 const world=createWorld(++seed,16,16);
 // Declared UI catalogue fixture, not a colony that earned these technologies.
 world.research={project:null,points:0};
 const state:NativeUiState={world,epoch:seed,panel:'architect',category:'structure',tool:'select',orientation:0,
  selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},
  speed:0,hasGame:true,busy:false,saves:[]};
 let shown:NativePage|undefined;
 const noop=()=>{};
 const actions:NativeUiActions={command:vi.fn(async()=>({ok:true})),panel:vi.fn(),category:vi.fn(),tool:vi.fn(),selectPawn:noop,speed:noop,
  rotate:vi.fn(),material:vi.fn(),creationStorage:vi.fn(),front:noop,save:noop,exportSave:noop,showPage:vi.fn(page=>{shown=page;}),
  refresh:vi.fn(),closePage:vi.fn(),readState:()=>state};
 const page=()=>buildNativePanel(state,actions)!;
 const controls=(page:NativePage)=>page.rows.flatMap(row=>row.controls??[]);
 const control=(page:NativePage,id:string):NativeControl=>{const result=controls(page).find(control=>control.id===id);if(!result)throw Error('Missing control '+id);return result;};
 const complete=(id:ResearchProject)=>Object.assign(projectProgress(world.research!,id),{points:researchCost(id),completedAt:0});
 return {world,state,actions,page,controls,control,complete,get shown(){return shown;}};
}

describe('native Architect keeps the former three-part workbench',()=>{
 it('uses the category rail, illustrated catalogue and distinct detail column rather than horizontal button rows',()=>{
  const f=fixture(),page=f.page();
  expect(page.layout).toBe('architect');expect([page.width,page.height]).toEqual([1420,900]);
  const navigation=page.rows.find(row=>row.region==='navigation')!,catalogue=page.rows.filter(row=>row.region==='catalogue');
  expect(navigation.id).toBe('architect-categories');expect(navigation.controlStyle).toBe('navigation');
  expect(navigation.controls!.map(control=>control.label)).toEqual(['Température','Structure','Sols','Mobilier','Loisirs','Production','Énergie']);
  expect(navigation.controls!.every(control=>control.icon&&control.hint)).toBe(true);
  expect(navigation.controls!.filter(control=>control.active).map(control=>control.id)).toEqual(['category-structure']);
  expect(catalogue).toHaveLength(1);expect(catalogue[0]!.controlStyle).toBe('tile');
  expect(catalogue[0]!.controls!.every(control=>control.icon&&control.hint?.includes(control.label))).toBe(true);
  expect(page.rows.some(row=>row.id==='architect-instruction'&&row.region==='details')).toBe(true);
  expect(page.rows.some(row=>row.id==='architect-job-count'&&row.region==='details')).toBe(true);
 });

 it('retains current category selection and exact map-tool actions without sending game commands',async()=>{
  const f=fixture(),page=f.page(),before=JSON.stringify(f.world);
  await f.control(page,'category-floors').onActivate();
  expect(f.actions.category).toHaveBeenCalledWith('floors');expect(f.actions.refresh).toHaveBeenCalled();
  await f.control(page,'tool-wall-select').onActivate();expect(f.actions.tool).toHaveBeenCalledWith('wall');
  expect(f.actions.command).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
  const wall=f.control(page,'tool-wall-select');expect(wall.caption).toBe('B');expect(wall.hint).toContain('Mur · B');
 });

 it('keeps material choices and rotation in the selected construction detail owner',async()=>{
  const f=fixture();f.state.tool='wall';f.state.orientation=2;f.state.constructionMaterial='granite-blocks';
  const page=f.page(),material=f.control(page,'tool-wall-material');
  expect(f.control(page,'tool-wall-select').active).toBe(true);expect(material.label).toBe(ITEM_DEFINITIONS['granite-blocks'].label);
  expect(material.select!.options.map(option=>option.value)).toEqual(constructionMaterials('wall'));
  expect(page.rows.find(row=>row.id==='architect-material')!.region).toBe('details');
  expect(page.rows.find(row=>row.id==='architect-rotation')!.value).toBe('180°');
  await material.select!.onChange('steel');expect(f.actions.material).toHaveBeenLastCalledWith('steel');
  const calls=vi.mocked(f.actions.material).mock.calls.length;
  await material.select!.onChange('not-a-material');expect(f.actions.material).toHaveBeenCalledTimes(calls);
  await f.control(page,'rotate-left').onActivate();await f.control(page,'rotate-right').onActivate();
  expect(vi.mocked(f.actions.rotate).mock.calls).toEqual([[-1],[1]]);expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('retains real research/schema catalogue gates and unlocks the ship category only from ShipBasics',()=>{
  const f=fixture();f.state.category='furniture';
  expect(f.controls(f.page()).some(control=>control.id==='tool-dining-chair-select')).toBe(false);
  f.complete('complex-furniture');
  expect(f.controls(f.page()).some(control=>control.id==='tool-dining-chair-select')).toBe(true);
  expect(f.controls(f.page()).some(control=>control.id==='category-ship')).toBe(false);
  f.complete('ship-basics');
  expect(f.controls(f.page()).some(control=>control.id==='category-ship')).toBe(true);
 });

 it('keeps the full available production catalogue in the existing workbench order',()=>{
  const f=fixture();for(const project of researchProjects)f.complete(project.id);f.state.category='production';
  const page=f.page(),catalogue=page.rows.find(row=>row.region==='catalogue')!.controls!;
  const expected=toolDefinitions.filter(tool=>tool.category==='production'&&architectToolAvailable(f.world,tool.id))
   .sort((a,b)=>{const ai=productionToolOrder.indexOf(a.id),bi=productionToolOrder.indexOf(b.id);return (ai<0?productionToolOrder.length:ai)-(bi<0?productionToolOrder.length:bi);});
  expect(catalogue.map(control=>control.id)).toEqual(expected.map(tool=>`tool-${tool.id}-select`));
  expect(catalogue.map(control=>control.id)).toContain('tool-fabrication-bench-select');
  expect(page.rows.filter(row=>row.region==='catalogue')).toHaveLength(1);
 });
});

describe('native Ordres and Zones keep their independent icon trays',()=>{
 it.each(['orders','zones'] as const)('keeps %s out of the Architect category rail with icon controls and no idle selector',kind=>{
  const f=fixture(),palette=buildNativeToolPalette(f.state,f.actions,kind),navigation=f.page().rows.find(row=>row.id==='architect-categories')!.controls!;
  expect(navigation.map(control=>control.id)).not.toContain('category-orders');expect(navigation.map(control=>control.id)).not.toContain('category-zones');
  expect(palette.layout).toBe('palette');expect(palette.palette).toBe(kind);expect(palette.width).toBe(600);
  expect(palette.rows).toHaveLength(1);expect(palette.rows[0]!.controlStyle).toBe('icon');expect(palette.rows[0]!.region).toBe('catalogue');
  const controls=f.controls(palette);expect(controls.every(control=>control.icon&&control.hint)).toBe(true);
  expect(controls.some(control=>control.id==='tool-select-select')).toBe(false);
 });

 it('retains every ordinary order, shortcut hint, active state and tool callback',async()=>{
  const f=fixture();f.state.tool='mine';const palette=buildNativeToolPalette(f.state,f.actions,'orders');
  expect(f.controls(palette).map(control=>control.id)).toEqual(['mine','haul-chunks','chop','harvest','cut','uninstall','deconstruct','cancel'].map(id=>`tool-${id}-select`));
  const mine=f.control(palette,'tool-mine-select');expect(mine.active).toBe(true);expect(mine.hint).toContain('Miner · L'); // Core Designator_Mine key Misc10 in the Orders palette (alerts lot C)
  await mine.onActivate();expect(f.actions.tool).toHaveBeenCalledWith('mine');
  palette.onClose!();expect(f.actions.closePage).toHaveBeenCalledOnce();expect(f.actions.panel).toHaveBeenCalledWith(null);
  expect(f.actions.command).not.toHaveBeenCalled();
 });

 it('keeps zone-specific snow availability and the real creation-storage editor as a small tray action',async()=>{
  const f=fixture();delete f.world.snow;
  const palette=buildNativeToolPalette(f.state,f.actions,'zones');
  expect(f.controls(palette).some(control=>control.id==='tool-stockpile-select')).toBe(true);
  expect(f.controls(palette).some(control=>control.id==='tool-snow-clear-select'||control.id==='tool-remove-snow-clear-select')).toBe(false);
  const storage=f.control(palette,'architect-storage-settings-open');expect(storage.icon).toBe('settings');expect(storage.hint).toContain('prochaines réserves');
  await storage.onActivate();expect(f.shown?.id).toBe('creation-storage');
  expect(f.shown!.rows.some(row=>row.id==='creation-storage-priority')).toBe(true);expect(f.actions.command).not.toHaveBeenCalled();
 });
});

describe('native command admission reads current operation state',()=>{
 it('accepts research after a save releases busy without a new World or UI model',async()=>{
  const f=fixture();f.state.panel='research';f.state.busy=true;
  let current={...f.state};f.actions.readState=()=>current;
  f.actions.command=vi.fn(async command=>applyCommand(f.world,command));
  const page=f.page(),start=f.control(page,'research-brewing-start'),tick=f.world.tick;
  // A save publication may paint while GameSession.exclusive is still busy.
  // Its finally releases the live state without publishing another World.
  current={...current,busy:false};
  expect(f.state.busy).toBe(true);expect(current.world).toBe(f.world);
  await expect(start.onActivate()).resolves.toMatchObject({ok:true});
  expect(f.actions.command).toHaveBeenCalledExactlyOnceWith({type:'research-project',project:'brewing'});
  expect(f.world.research!.project).toBe('brewing');expect(f.world.tick).toBe(tick);
  expect(f.actions.refresh).toHaveBeenCalledOnce();
 });

 it('refuses research when an operation starts after the model was built idle',async()=>{
  const f=fixture();f.state.panel='research';
  let current={...f.state};f.actions.readState=()=>current;
  const page=f.page(),start=f.control(page,'research-brewing-start'),before=JSON.stringify(f.world);
  current={...current,busy:true};
  expect(f.state.busy).toBe(false);
  await expect(start.onActivate()).rejects.toThrow('Attendez la fin de l’opération courante.');
  expect(f.actions.command).not.toHaveBeenCalled();expect(JSON.stringify(f.world)).toBe(before);
 });

 it('keeps the dispatch lock until an admitted command settles',async()=>{
  const f=fixture();f.state.panel='research';
  let release!:(value:unknown)=>void;
  const unresolved=new Promise<unknown>(resolve=>{release=resolve;});
  f.actions.command=vi.fn(()=>unresolved);
  const page=f.page(),start=f.control(page,'research-brewing-start'),pending=start.onActivate();
  try {
   await expect(start.onActivate()).rejects.toThrow('Attendez la fin de l’opération courante.');
   expect(f.actions.command).toHaveBeenCalledOnce();expect(f.actions.refresh).not.toHaveBeenCalled();
  } finally {release({ok:true});await pending;}
  expect(f.actions.refresh).toHaveBeenCalledOnce();
  await expect(start.onActivate()).resolves.toMatchObject({ok:true});
  expect(f.actions.command).toHaveBeenCalledTimes(2);
 });
});
