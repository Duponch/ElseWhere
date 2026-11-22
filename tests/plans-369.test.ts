import {describe,expect,it,vi} from 'vitest';
import {applyCommand,createWorld,stepWorld} from '../src/sim/engine';
import {queryArea} from '../src/sim/designation';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization';
import {LOCAL_FIELDS} from '../src/sim/secondary-site-save';
import {
 DEFAULT_PLAN_COLOR_369,PLAN_COLORS_369,PLAN_COLOR_DEFS_369,PLAN_OVERLAY_ALPHA_369,planAt369,planColorHex369,planLabel369,totalPlanArea369,
 type PlanColor369,
} from '../src/sim/plans-369';
import {SCHEMA_VERSION,type AreaCommand,type Command,type World} from '../src/sim/types';
import {planOverlayPlacements369,planOverlaySignature369,PLAN_TINT_OPACITY_369} from '../src/render/plan-overlay-369';
import {GroundSurfaceTint} from '../src/render/GroundSurfaceTint';
import {mapObjectsAt,mapObjectCells} from '../src/ui/map-object-selection';
import {mapHoverLines} from '../src/ui/map-hover-readout';
import {ORDERS_PALETTE_HOTKEYS,paletteHotkeyTool} from '../src/ui/main-tab-hotkeys';
import {toolDefinitions} from '../src/ui/layout';
import {toolDefinitions as nativeTools} from '../src/ui3d/native-catalog';
import {architectToolAvailable} from '../src/ui/architect-availability';
import {pictoArtwork} from '../src/ui/picto-artwork';
import {buildNativeToolPalette} from '../src/ui3d/native-panels';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {asNumberOnly,asOldSchema} from './scenarios/old-schema';

vi.mock('../src/ui/pawn-portrait',()=>({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

const SLOW=60000;
const world=(seed=369):World=>createWorld(seed,40,40);
const idx=(w:World,x:number,z:number)=>z*w.width+x;
const rectCells=(w:World,x0:number,z0:number,x1:number,z1:number)=>{const out:number[]=[];for(let z=z0;z<=z1;z++)for(let x=x0;x<=x1;x++)out.push(idx(w,x,z));return out;};
const plan=(w:World,from:[number,number],to:[number,number],color?:PlanColor369,target?:number)=>applyCommand(w,{type:'area',action:'plan',from:{x:from[0],z:from[1]},to:{x:to[0],z:to[1]},
 ...(color?{planColor369:color}:{}),...(target===undefined?{}:{targetPlanId369:target})});
const unplan=(w:World,from:[number,number],to:[number,number])=>applyCommand(w,{type:'area',action:'remove-plan',from:{x:from[0],z:from[1]},to:{x:to[0],z:to[1]}});
const ok=(w:World,c:Command)=>{const r=applyCommand(w,c);expect(r,JSON.stringify(r)).toMatchObject({ok:true});return r;};

describe('schema 369: plans (Core 1.6 Designator_Plan_Add / Designator_Plan_Remove)',()=>{
 it('takes the colours, the default, the keys and the gating from Core',()=>{
  // ColorDefs.xml Planning colours, def order, alpha 0.4.
  expect(PLAN_COLORS_369).toEqual(['gray','red','orange','yellow','green','cyan','blue','purple','pink']);
  expect(PLAN_COLOR_DEFS_369.gray.rgba).toEqual([.68,.68,.68,.4]);expect(PLAN_COLOR_DEFS_369.blue.rgba).toEqual([.2,.4,.9,.4]);
  expect(PLAN_COLORS_369.every(c=>PLAN_COLOR_DEFS_369[c].rgba[3]===.4)).toBe(true);
  expect(DEFAULT_PLAN_COLOR_369).toBe('gray');expect(PLAN_OVERLAY_ALPHA_369).toBe(.4);
  expect(planColorHex369('red')).toBe(0xe66666);
  // Designator_Plan_Add hotKey Misc9 (I), Designator_Plan_Remove Misc8 (K), Orders palette.
  expect(ORDERS_PALETTE_HOTKEYS.i).toBe('plan');expect(ORDERS_PALETTE_HOTKEYS.k).toBe('remove-plan');
  expect(paletteHotkeyTool('orders','I')).toBe('plan');expect(paletteHotkeyTool('zones','i')).toBe('build-roof');
  for(const [list,id,key] of [[toolDefinitions,'plan','I'],[toolDefinitions,'remove-plan','K'],[nativeTools,'plan','I'],[nativeTools,'remove-plan','K']] as const){
   const tool=list.find(t=>t.id===id)!;expect(tool.category).toBe('orders');expect(tool.key).toBe(key);expect(tool.hint).not.toMatch(/schéma|369/);
  }
  expect(toolDefinitions.find(t=>t.id==='plan')!.title).toBe('Planifier');expect(toolDefinitions.find(t=>t.id==='remove-plan')!.title).toBe('Retirer le plan');
  expect(pictoArtwork('plan')).toBeTruthy();expect(pictoArtwork('remove-plan')).toBeTruthy();
  const w=world();expect(architectToolAvailable(w,'plan')).toBe(true);expect(architectToolAvailable(w,'remove-plan')).toBe(true);
  const old={...w,schemaVersion:368} as unknown as World;expect(architectToolAvailable(old,'plan')).toBe(false);expect(architectToolAvailable(old,'remove-plan')).toBe(false);
  expect(LOCAL_FIELDS.has('plans369')).toBe(true);
 });

 it('a drag creates "Plan 1"; the plan it holds, or the one plan of its colour met, grows; a click on it only picks it',()=>{
  const w=world();
  const a=plan(w,[10,10],[12,11]);
  expect(a).toMatchObject({ok:true,affected:6,skipped:0,planId369:1});
  expect(w.plans369).toEqual({nextId:2,plans:[{id:1,n:1,color:'gray',cells:rectCells(w,10,10,12,11)}]});
  expect(planLabel369(w.plans369!.plans[0]!)).toBe('Plan 1');
  // A click on a plan of the tool's colour selects it: nothing changes.
  const before=JSON.stringify(w.plans369);
  expect(plan(w,[11,11],[11,11])).toMatchObject({ok:true,affected:0,planId369:1});expect(JSON.stringify(w.plans369)).toBe(before);
  // Held plan (Core SelectedPlan): an adjacent stroke extends it.
  expect(plan(w,[13,10],[14,10],'gray',1)).toMatchObject({ok:true,affected:2,planId369:1});
  expect(w.plans369!.plans).toHaveLength(1);expect(w.plans369!.plans[0]!.cells).toHaveLength(8);
  // No held plan, but the stroke overlaps the one gray plan: it grows too.
  expect(plan(w,[12,11],[12,12])).toMatchObject({ok:true,affected:1,planId369:1});
  expect(w.plans369!.plans.map(p=>[p.id,p.cells.length])).toEqual([[1,9]]);
  // A held plan of another colour is ignored (Core deselects it).
  expect(plan(w,[30,30],[31,30],'red',1)).toMatchObject({ok:true,affected:2,planId369:2});
  expect(w.plans369!.plans.map(p=>[p.id,p.n,p.color])).toEqual([[1,1,'gray'],[2,2,'red']]);
  expect(totalPlanArea369(w)).toBe(11);
 });

 it('without a held plan an adjacent stroke starts a new plan that merges the touching plan of its colour',()=>{
  const w=world();plan(w,[10,10],[11,10]);
  // Core PlanCells: a new plan from the first dragged cell (lowest index,
  // CellRect order); every same-colour plan touching a later dragged cell
  // merges into it. North of the plan, (11,11) touches it: one plan, "Plan 2".
  expect(plan(w,[10,11],[11,11])).toMatchObject({ok:true,affected:2,planId369:2});
  expect(w.plans369).toEqual({nextId:3,plans:[{id:2,n:2,color:'gray',cells:[...rectCells(w,10,10,11,10),...rectCells(w,10,11,11,11)]}]});
  // East of it only the first dragged cell touches: no merge, a new "Plan 1".
  expect(plan(w,[12,10],[13,10])).toMatchObject({ok:true,affected:2,planId369:3});
  expect(w.plans369!.plans.map(p=>[p.id,p.n,p.cells.length])).toEqual([[2,2,4],[3,1,2]]);
 });

 it('another colour takes the cells; removing a strip splits a plan into two with the same label',()=>{
  const w=world();plan(w,[10,10],[16,12]);
  // Red over the middle column: the gray plan loses those cells and splits.
  expect(plan(w,[13,10],[13,12],'red')).toMatchObject({ok:true,affected:3,planId369:2});
  const [gray,red,split]=w.plans369!.plans;
  expect(gray).toMatchObject({id:1,n:1,color:'gray',cells:rectCells(w,10,10,12,12)});
  expect(red).toMatchObject({id:2,n:2,color:'red',cells:rectCells(w,13,10,13,12)});
  expect(split).toMatchObject({id:3,n:1,color:'gray',cells:rectCells(w,14,10,16,12)});
  expect(planLabel369(split!)).toBe('Plan 1');
  // Retirer le plan: any colour, only planned cells, then the split.
  expect(queryArea(w,{type:'area',action:'remove-plan',from:{x:9,z:11},to:{x:17,z:11}})).toMatchObject({ok:true,selected:9,skipped:2});
  expect(unplan(w,[9,11],[17,11])).toMatchObject({ok:true,affected:7,skipped:2});
  expect(w.plans369!.plans.map(p=>[p.id,p.n,p.color,p.cells.length])).toEqual([[1,1,'gray',3],[2,2,'red',1],[3,1,'gray',3],[4,1,'gray',3],[5,2,'red',1],[6,1,'gray',3]]);
  // The piece holding the lowest cell keeps the plan.
  expect(w.plans369!.plans[0]!.cells).toEqual(rectCells(w,10,10,12,10));
  expect(unplan(w,[0,0],[5,5])).toMatchObject({ok:false,code:'missing-target'});
  // Removing every cell removes the field; the next plan is "Plan 1" again.
  expect(unplan(w,[0,0],[39,39])).toMatchObject({ok:true,affected:14});
  expect(w.plans369).toBeUndefined();
  plan(w,[1,1],[1,1],'pink');expect(w.plans369).toEqual({nextId:2,plans:[{id:1,n:1,color:'pink',cells:[idx(w,1,1)]}]});
 });

 it('the plan gizmos change the colour, hide and delete a plan; refusals change nothing',()=>{
  const w=world();plan(w,[5,5],[6,6]);plan(w,[20,20],[21,21],'blue');
  ok(w,{type:'plan-369',action:'color',planId:1,color:'green'});expect(w.plans369!.plans[0]!.color).toBe('green');
  ok(w,{type:'plan-369',action:'hide',planId:1,hidden:true});expect(w.plans369!.plans[0]!.hidden).toBe(true);
  ok(w,{type:'plan-369',action:'hide',planId:1,hidden:false});expect(Object.hasOwn(w.plans369!.plans[0]!,'hidden')).toBe(false);
  const before=JSON.stringify(w.plans369);
  expect(applyCommand(w,{type:'plan-369',action:'color',planId:1,color:'teal' as PlanColor369})).toMatchObject({ok:false});
  expect(applyCommand(w,{type:'plan-369',action:'delete',planId:99})).toMatchObject({ok:false,code:'missing-target'});
  expect(applyCommand(w,{type:'plan-369',action:'delete',planId:1,extra:1} as unknown as Command)).toMatchObject({ok:false});
  expect(plan(w,[1,1],[2,2],'teal' as PlanColor369)).toMatchObject({ok:false});
  expect(applyCommand(w,{type:'area',action:'remove-plan',from:{x:1,z:1},to:{x:2,z:2},planColor369:'red'})).toMatchObject({ok:false});
  expect(plan(w,[1,1],[40,2])).toMatchObject({ok:false,code:'out-of-bounds'});
  expect(JSON.stringify(w.plans369)).toBe(before);
  ok(w,{type:'plan-369',action:'delete',planId:1});expect(w.plans369!.plans.map(p=>p.id)).toEqual([2]);
 });

 it('plans never touch the simulation: real ticks run bit-identically with and without them, and they survive save/reload',()=>{
  const a=world(3691),b=deserializeWorld(serializeWorld(a));
  plan(a,[5,5],[20,9]);plan(a,[22,5],[30,30],'orange');unplan(a,[25,10],[26,12]);ok(a,{type:'plan-369',action:'hide',planId:2,hidden:true});
  // The twin also crosses the command boundary, with a refused plan command.
  expect(unplan(b,[0,0],[39,39])).toMatchObject({ok:false});
  const plans=structuredClone(a.plans369);
  for(let i=0;i<150;i++){stepWorld(a);stepWorld(b);}
  expect(a.plans369).toEqual(plans);
  // Mid-run save and reload, then more ticks.
  const reloaded=deserializeWorld(serializeWorld(a));expect(serializeWorld(reloaded)).toBe(serializeWorld(a));
  for(let i=0;i<150;i++){stepWorld(reloaded);stepWorld(b);}
  expect(reloaded.plans369).toEqual(plans);
  delete reloaded.plans369;
  expect(serializeWorld(reloaded)).toBe(serializeWorld(b));
  expect(b.jobs.some(j=>(j.kind as string)==='plan')).toBe(false);
 },SLOW);

 it('saves are strict: below 369 plans are refused, malformed plans too; a 368 save migrates by number only',()=>{
  const w=world();plan(w,[5,5],[7,7]);plan(w,[10,5],[10,9],'cyan');
  expect(validateWorld(w)).toEqual([]);
  const current=serializeWorld(w);
  expect(()=>deserializeWorld(asOldSchema(current,368))).toThrow();
  // Commands below 369 are refused before any change.
  const old={...world(),schemaVersion:368} as unknown as World;
  expect(queryArea(old,{type:'area',action:'plan',from:{x:1,z:1},to:{x:2,z:2}} as AreaCommand)).toMatchObject({ok:false,code:'invalid-command'});
  expect(applyCommand(old,{type:'plan-369',action:'delete',planId:1})).toMatchObject({ok:false});
  const bad=(edit:(p:{nextId:number;plans:Record<string,unknown>[]})=>void)=>{const raw=JSON.parse(current) as {plans369:{nextId:number;plans:Record<string,unknown>[]}};edit(raw.plans369);return ()=>deserializeWorld(JSON.stringify(raw));};
  expect(()=>deserializeWorld(current)).not.toThrow();
  expect(bad(p=>{(p.plans[1]!.cells as number[]).push(idx(w,5,5));})).toThrow(); // overlap (and unsorted)
  expect(bad(p=>{p.plans[0]!.cells=[idx(w,1,1),idx(w,3,1)];})).toThrow(); // two pieces
  expect(bad(p=>{p.plans[0]!.color='teal';})).toThrow();
  expect(bad(p=>{p.plans[0]!.hidden=false;})).toThrow();
  expect(bad(p=>{p.plans[0]!.label='Plan 1';})).toThrow();
  expect(bad(p=>{p.nextId=2;})).toThrow();
  expect(bad(p=>{p.plans=[];})).toThrow();
  expect(bad(p=>{p.plans[0]!.n=1001;})).toThrow();
  expect(bad(p=>{p.plans[0]!.cells=[w.width*w.height];})).toThrow();
  // The migration 368 → 369 changes only the number.
  const plain=world(3692),saved=serializeWorld(plain),migrated=deserializeWorld(asOldSchema(saved,368));
  expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated.plans369).toBeUndefined();
  expect(serializeWorld(migrated)).toBe(asNumberOnly(saved,368));
 },SLOW);

 it('gives the renderer one tint texel per visible planned cell in the plan colour, shown even with zones hidden',()=>{
  const w=world();plan(w,[2,3],[3,3],'red');plan(w,[10,10],[10,11],'blue');
  const placements=planOverlayPlacements369(w);
  expect(placements).toEqual([{x:2,y:0,z:3,color:0xe66666},{x:3,y:0,z:3,color:0xe66666},{x:10,y:0,z:10,color:planColorHex369('blue')},{x:10,y:0,z:11,color:planColorHex369('blue')}]);
  const signature=planOverlaySignature369(w);expect(planOverlaySignature369(deserializeWorld(serializeWorld(w)))).toBe(signature);
  ok(w,{type:'plan-369',action:'hide',planId:2,hidden:true});
  expect(planOverlayPlacements369(w)).toHaveLength(2);expect(planOverlaySignature369(w)).not.toBe(signature);
  unplan(w,[3,3],[3,3]);expect(planOverlayPlacements369(w)).toEqual([{x:2,y:0,z:3,color:0xe66666}]);
  expect(PLAN_TINT_OPACITY_369).toBe(.4);
  const tint=new GroundSurfaceTint();try{
   tint.setZones(w.width,w.height,[{placements:[{x:5,y:0,z:5,color:0xffffff}],opacity:.3},{placements:planOverlayPlacements369(w),opacity:PLAN_TINT_OPACITY_369,always:true}],false);
   const data=tint.zones.image.data as Float32Array,at=(x:number,z:number)=>(z*w.width+x)*4;
   expect(data[at(2,3)+3]).toBeCloseTo(.4,6);expect(data[at(2,3)]).toBeGreaterThan(data[at(2,3)+1]!);
   expect(data[at(5,5)+3]).toBe(0); // the hidden zone layer
   tint.setZones(w.width,w.height,[{placements:[{x:5,y:0,z:5,color:0xffffff}],opacity:.3}],true);
   expect((tint.zones.image.data as Float32Array)[at(5,5)+3]).toBeCloseTo(.3,6);
  }finally{tint.dispose();}
  expect(planAt369(w,{x:2,z:3})?.id).toBe(1);expect(planAt369(w,{x:3,z:3})).toBeUndefined();
 });

 it('a plan is selectable after things and zones, not in the mouseover readout, and its inspector offers the Core gizmos',async()=>{
  const w=world();
  const empty=w.tiles.findIndex((t,i)=>t.terrain!=='rock'&&!w.resources.some(r=>r.x===i%w.width&&r.z===Math.floor(i/w.width))&&!w.structures.some(s=>s.x===i%w.width&&s.z===Math.floor(i/w.width))&&!w.piles.some(p=>p.owner.type==='ground'&&p.owner.x===i%w.width&&p.owner.z===Math.floor(i/w.width)));
  const cell={x:empty%w.width,z:Math.floor(empty/w.width)};
  plan(w,[cell.x,cell.z],[cell.x,cell.z]);plan(w,[30,30],[31,30],'green');
  expect(mapObjectsAt(w,cell).at(-1)).toEqual({kind:'plan',id:1});
  expect(mapObjectCells(w,{kind:'plan',id:2})).toEqual([{x:30,z:30},{x:31,z:30}]);
  expect(mapHoverLines(w,cell).join('\n')).not.toContain('Plan');
  const state:NativeUiState={world:w,epoch:369,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[{kind:'plan',id:2}],
   constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const edit=vi.fn(),noop=()=>{},actions={command:async(c:Command)=>applyCommand(w,c),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,
   showPage:noop,refresh:noop,readState:()=>state,editPlan369:edit} as unknown as NativeUiActions;
  const page=buildNativeInspector(state,actions)!;
  expect(page.title).toBe('Plan 2');
  expect(page.rows.find(r=>r.id==='plan-size')?.value).toBe('2 cases');
  expect(page.rows.find(r=>r.id==='plan-total')?.value).toBe('3 cases');
  const color=page.rows.find(r=>r.id==='plan-color')!.controls![0]!;
  expect(color.select!.value).toBe('green');expect(color.select!.options.map(o=>o.label)).toEqual(['Gris','Rouge','Orange','Jaune','Vert','Cyan','Bleu','Violet','Rose']);
  expect(page.actions!.map(a=>a.id)).toEqual(expect.arrayContaining(['plan-hide','plan-expand','plan-shrink','plan-delete']));
  await page.actions!.find(a=>a.id==='plan-expand')!.onActivate();expect(edit).toHaveBeenCalledWith(2,false);
  await color.select!.onChange('purple');expect(w.plans369!.plans[1]!.color).toBe('purple');
  await page.actions!.find(a=>a.id==='plan-delete')!.onActivate();expect(w.plans369!.plans.map(p=>p.id)).toEqual([1]);
 });

 it('the native Orders palette offers both tools; Planifier opens the colour grid and a colour arms the tool',async()=>{
  const w=world();let shown:NativePage|undefined;
  const state:NativeUiState={world:w,epoch:369,panel:null,category:'orders',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],
   constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],planColor369:'red'};
  const noop=()=>{},actions:NativeUiActions={command:vi.fn(async()=>({ok:true})),panel:vi.fn(),category:vi.fn(),tool:vi.fn(),selectPawn:noop,speed:noop,
   rotate:vi.fn(),material:vi.fn(),creationStorage:vi.fn(),front:noop,save:noop,exportSave:noop,showPage:vi.fn(page=>{shown=page;}),refresh:vi.fn(),closePage:vi.fn(),readState:()=>state,
   planColor369:vi.fn()};
  const palette=buildNativeToolPalette(state,actions,'orders'),controls=palette.rows.flatMap(r=>r.controls??[]);
  const find=(page:NativePage|NativeControl[],id:string)=>(Array.isArray(page)?page:page.rows.flatMap(r=>r.controls??[])).find(c=>c.id===id)!;
  const add=find(controls,'tool-plan-select'),remove=find(controls,'tool-remove-plan-select');
  expect(add.caption).toBe('I');expect(remove.caption).toBe('K');expect(add.hint).toContain('Planifier · I');
  await remove.onActivate();expect(actions.tool).toHaveBeenCalledWith('remove-plan');
  await add.onActivate();expect(actions.tool).not.toHaveBeenCalledWith('plan');
  expect(shown?.id).toBe('plan-colors-369');
  const swatches=shown!.rows.find(r=>r.id==='plan-colors')!.controls!;
  expect(swatches.map(s=>s.id)).toEqual(PLAN_COLORS_369.map(c=>`plan-color-${c}`));
  expect(find(shown!,'plan-color-red').caption).toBe('Choisie');expect(find(shown!,'plan-color-red').color).toBe('#e66666');
  await find(shown!,'plan-color-cyan').onActivate();expect(actions.planColor369).toHaveBeenCalledWith('cyan');
  // Without the host's colour action the tool is armed directly.
  const bare={...actions,planColor369:undefined} as NativeUiActions;
  await find(buildNativeToolPalette(state,bare,'orders'),'tool-plan-select').onActivate();expect(actions.tool).toHaveBeenCalledWith('plan');
  // Below 369 the palette has neither tool.
  const oldState={...state,world:{...w,schemaVersion:368} as unknown as World};
  expect(buildNativeToolPalette(oldState,actions,'orders').rows.flatMap(r=>r.controls??[]).some(c=>c.id.includes('plan'))).toBe(false);
 });
});
