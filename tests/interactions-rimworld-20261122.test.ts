// Section H of the 22 November feedback (items 23 to 30 and 33): player and
// interface interactions as Core's code decides them. Presentation and
// interface only; no rule or save changes.
import {expect,test,vi} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {queryOrderOptions} from '../src/sim/player-orders';
import {SCHEMA_VERSION,type Command,type Job,type World} from '../src/sim/types';
import {buildNativeInspector} from '../src/ui3d/native-inspector';
import {nativeOrderPage,type NativeOrderClient} from '../src/ui3d/native-orders';
import {layoutNativePage} from '../src/ui3d/native-layout';
import {floatMenuDistance,floatMenuVanishes,pressOutsideFloatMenu,mouseAttachedTipPosition,tipTextAction,TOOLTIP_DELAY_MS} from '../src/ui3d/native-float-menu';
import type {NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {mapHoverLines,glowLabel} from '../src/ui/map-hover-readout';
import {hoverTemperatureText} from '../src/ui/hover-temperature';
import {actionProgress} from '../src/render/action-feedback';
import {mapObjectsInRect,boxSelection,pileCountsAsResource} from '../src/ui/map-object-rectangle';
import {mapObjectGroupTarget} from '../src/ui/map-object-group-selection';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {mapObjectActions} from '../src/ui/map-object-actions';
import {cycledColonist} from '../src/ui/colonist-cycle';
import {rockThingLabel} from '../src/ui/geology-inspection';
import {outdoorTemperature} from '../src/sim/temperature';

vi.mock('../src/ui/pawn-portrait', () => ({portraitDataUrl:()=>'data:image/svg+xml,%3Csvg/%3E',portraitExpressionOf:()=>'awake'}));

/** A bare 32×32 grass map with its colonists and nothing else. */
function bare(seed=1122):World {
  const w=createWorld(seed,32,32);
  w.tiles=w.tiles.map(()=>({terrain:'grass'}));
  w.resources=[];w.structures=[];w.jobs=[];w.piles=[];w.stockpiles=[];w.packed=[];w.growingZones=[];
  delete w.roofing;delete w.thermal;if(w.filth)w.filth.items=[];
  return w;
}
const at=(w:World,x:number,z:number)=>z*w.width+x;
function inspect(w:World,objects:NativeUiState['selectedObjects']):NativePage {
  const state:NativeUiState={world:w,epoch:1,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:objects,constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[]};
  const noop=()=>{};
  const actions:NativeUiActions={command:async()=>({ok:true}),panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop,showPage:noop,refresh:noop,readState:()=>state};
  return buildNativeInspector(state,actions)!;
}
const job=(w:World,kind:Job['kind'],x:number,z:number,extra:Partial<Job>={}):Job=>({id:w.nextId++,kind,x,z,orientation:0,footprint:'standard',status:'active',reservedBy:null,progress:0,escrow:{wood:0,food:0},...extra} as Job);

// ---- 23. A selected rock says what it is ----------------------------------

test('23: the selected natural rock is titled by its own stone, ore or smoothed wall, with its hit points (InspectPaneUtility, InspectPaneFiller.DrawHealth)',()=>{
  const w=bare(),granite=at(w,15,15),steel=at(w,16,15),smooth=at(w,17,15);
  w.tiles[granite]={terrain:'rock',stone:'granite',miningDamage:160};
  w.tiles[steel]={terrain:'rock',stone:'granite',ore:'steel'};
  w.tiles[smooth]={terrain:'rock',stone:'slate',smoothedWall367:true};
  const page=inspect(w,[{kind:'rock',id:granite}]);
  expect(page.title).toBe('Granite');
  expect(page.inspectInfo!.find(row=>row.id==='rock-hp')).toMatchObject({label:'Points de vie',value:'740 / 900',meter:{value:740,max:900}});
  // Core InspectPaneFiller.DrawHealth: the bar of the pane, 93 × 16, label « current / max ».
  expect(page.rows.find(row=>row.id==='pane-gauges')!.gauges![0]).toMatchObject({label:'740 / 900',fill:740/900});
  expect(inspect(w,[{kind:'rock',id:steel}]).title).toBe('Acier compacté');
  expect(inspect(w,[{kind:'rock',id:smooth}]).title).toBe('Paroi d’ardoise lissée');
  expect(rockThingLabel({terrain:'rock'})).toBe('Massif rocheux');
  // Reverse designators of a natural rock wall: Mine and, where it may designate, Smooth.
  expect(mapObjectActions(w,{kind:'rock',id:granite}).map(a=>a.id)).toEqual(['mine','smooth-wall']);
  expect(mapObjectActions(w,{kind:'rock',id:steel}).map(a=>a.id)).toEqual(['mine']);
  // Several objects: one label and the summed count, else « Divers ».
  w.piles.push({id:w.nextId++,kind:'wood',item:'wood',quantity:30,owner:{type:'ground',x:4,z:4}},{id:w.nextId++,kind:'wood',item:'wood',quantity:45,owner:{type:'ground',x:5,z:4}});
  expect(inspect(w,w.piles.map(p=>({kind:'pile' as const,id:p.id}))).title).toBe('Bois ×75');
  expect(inspect(w,[{kind:'pile',id:w.piles[0]!.id},{kind:'rock',id:granite}]).title).toBe('Divers ×31');
});

// ---- 24, 25, 29. The orders float menu -------------------------------------

interface Menu {pages:NativePage[];sent:Command[];closed:number}
function client(w:World,menu:Menu):NativeOrderClient {
  return {orderOptions:async(pawnId,x,z,queue)=>queryOrderOptions(w,pawnId,{x,z},queue),command:async c=>{menu.sent.push(c);return undefined;},currentWorld:()=>w,close:()=>{menu.closed++;}};
}
async function rightClick(w:World,ids:number[],cell:{x:number;z:number},x=300,y=200,targetId?:number):Promise<Menu> {
  const menu:Menu={pages:[],sent:[],closed:0};
  await nativeOrderPage(w,ids,cell,x,y,false,targetId,client(w,menu),page=>menu.pages.push(page));
  return menu;
}

test('24/25: the orders open as a non-modal float menu at the mouse, titled by the pawn, with only its options; no option, no menu (FloatMenuMap, Selector.HandleMapClicks)',async()=>{
  const w=bare(),pawn=w.pawns[0]!;pawn.name='Umbre « LeSombre » Nighthawk';
  w.tiles[at(w,pawn.x+2,pawn.z)]={terrain:'rock',stone:'granite'};
  w.jobs.push(job(w,'mine',pawn.x+2,pawn.z,{status:'pending'}));
  const menu=await rightClick(w,[pawn.id],{x:pawn.x+2,z:pawn.z});
  const page=menu.pages.at(-1)!;
  expect(page).toMatchObject({id:'native-orders',title:'LeSombre',modal:false,floatMenu:{x:300,y:200}});
  expect(page.rows.map(row=>row.label)).toEqual(['Prioriser : Miner']);
  expect(page.rows.some(row=>row.id==='orders-hint')).toBe(false);
  // 30: Shift held while choosing the option queues it (TryTakeOrderedJob).
  await page.rows[0]!.controls![0]!.onActivate({shift:true});
  expect(menu.sent).toEqual([{type:'order-job',pawnId:pawn.id,jobId:w.jobs[0]!.id,queue:true}]);
  // Nothing to order on bare ground: the loading page is closed, no menu stays.
  const empty=await rightClick(w,[pawn.id],{x:pawn.x+5,z:pawn.z+5});
  expect(empty.closed).toBe(1);expect(empty.pages.every(p=>p.rows.every(r=>r.id==='order-message'))).toBe(true);
  // Several undrafted colonists: the work providers are single-select.
  const many=await rightClick(w,w.pawns.map(p=>p.id),{x:pawn.x+2,z:pawn.z});
  expect(many.closed).toBe(0);expect(many.pages).toEqual([]);
  // A call without a mouse position keeps the old modal page.
  expect((await rightClick(w,[pawn.id],{x:pawn.x+2,z:pawn.z},0,0)).pages.at(-1)).toMatchObject({modal:true});
});

test('25: the float menu is laid out at the mouse, a press outside closes it, and it vanishes past 95 px (FloatMenu, WindowStack)',()=>{
  const page:NativePage={id:'native-orders',title:'Ada',rows:[{id:'a',label:'Prioriser : Miner'}],floatMenu:{x:300,y:200},width:4.6};
  const box=layoutNativePage(page,{width:1280,height:720},false,(text,size)=>text.length*size*.5);
  expect(box.x).toBe(304);expect(box.y).toBe(200-box.header);
  const right=layoutNativePage({...page,floatMenu:{x:1270,y:710}},{width:1280,height:720},false,(text,size)=>text.length*size*.5);
  expect(right.x+right.width).toBeLessThanOrEqual(1272);expect(right.y+right.height).toBeLessThanOrEqual(712);
  expect(pressOutsideFloatMenu(box,box.x+10,box.y+10)).toBe(false);
  expect(pressOutsideFloatMenu(box,box.x-1,box.y+10)).toBe(true);
  expect(floatMenuDistance(box,box.x-5,box.y)).toBe(0);
  expect(floatMenuVanishes(box,box.x-5-95,box.y)).toBe(false);
  expect(floatMenuVanishes(box,box.x-5-96,box.y)).toBe(true);
});

// ---- 26. Work bars -----------------------------------------------------------

test('26: mining shows the rock over the whole job, construction, repair, flicking, taming and prisoner chats show no bar, a thick filth one bar (JobDriver_Mine and others)',()=>{
  const w=bare(),pawn=w.pawns[0]!,rock=at(w,pawn.x+1,pawn.z);
  w.tiles[rock]={terrain:'rock',stone:'granite',miningDamage:160};
  const mine=job(w,'mine',pawn.x+1,pawn.z,{reservedBy:pawn.id,progress:9,pickTicks:12});
  w.jobs.push(mine);pawn.jobId=mine.id;pawn.state='working';
  expect(actionProgress(w,pawn)).toMatchObject({kind:'job',completed:160,total:900});
  mine.progress=1;expect(actionProgress(w,pawn)?.fraction).toBeCloseTo(160/900);
  for(const kind of ['wall','repair','flick'] as const){const other=job(w,kind,pawn.x,pawn.z+2,{reservedBy:pawn.id,material:kind==='wall'?'wood':undefined});w.jobs=[other];pawn.jobId=other.id;expect(actionProgress(w,pawn),kind).toBeUndefined();}
  w.jobs=[];pawn.jobId=null;
  pawn.animalHandling={animalId:1,kind:'tame',sourcePileId:0,phase:'interact',step:1,progress:5} as never;
  expect(actionProgress(w,pawn)).toBeUndefined();
  pawn.animalHandling={animalId:1,kind:'slaughter',sourcePileId:0,phase:'interact',step:0,progress:5} as never;
  expect(actionProgress(w,pawn)?.kind).toBe('handling');
  delete pawn.animalHandling;
  // Filth of thickness 3: one bar for the three layers.
  w.filth={rng:1,cleaned:0,items:[{id:900,kind:'dirt',x:pawn.x,z:pawn.z+1,thickness:3,grownCore:0,expiresAfterCore:1e9,nextCheckCore:1e9}]};
  pawn.cleaning={targets:[900],forced:false,phase:'clean',progress:10};
  const memory=new Map<number,{filthId:number;thickness:number}>();
  expect(actionProgress(w,pawn,{cleaningStart:memory})).toMatchObject({completed:10,total:105});
  w.filth.items[0]!.thickness=2;pawn.cleaning.progress=5;
  expect(actionProgress(w,pawn,{cleaningStart:memory})).toMatchObject({completed:40,total:105});
});

// ---- 27. Tooltips ----------------------------------------------------------

test('27: a tooltip stays and re-reads its text while the mouse stays, follows the mouse, appears after 0.45 s (TooltipHandler, TipSignal, GenUI)',()=>{
  expect(TOOLTIP_DELAY_MS).toBe(450);
  expect(tipTextAction('Repos 54 %','Repos 55 %')).toBe('retext');
  expect(tipTextAction('Repos 54 %','Repos 54 %')).toBe('keep');
  expect(tipTextAction('Repos 54 %','')).toBe('clear');
  expect(mouseAttachedTipPosition(100,100,200,50,1280,720)).toEqual({left:116,top:114});
  expect(mouseAttachedTipPosition(1200,700,200,50,1280,720)).toEqual({left:996,top:645});
});

// ---- 28. Selection box -----------------------------------------------------

test('28: the selection box keeps Core predicates and their order (Selector.SelectInsideDragBox, ThingSelectionUtility)',()=>{
  const w=bare();
  const wall={id:w.nextId++,kind:'wall' as const,x:3,z:3,orientation:0 as const,footprint:'standard' as const,material:'wood' as const};
  const table={id:w.nextId++,kind:'table' as const,x:6,z:3,orientation:0 as const,footprint:'standard' as const,material:'wood' as const};
  w.structures.push(wall,table);
  const wood={id:w.nextId++,kind:'wood' as const,item:'wood' as const,quantity:10,owner:{type:'ground' as const,x:8,z:8}};
  const chunk={id:w.nextId++,kind:'chunk' as const,item:'granite-chunk' as const,quantity:1,owner:{type:'ground' as const,x:9,z:8}};
  w.piles.push(wood,chunk);
  w.resources.push({id:w.nextId++,kind:'tree',species:'oak',x:10,z:10,amount:25,growth:1,growthTick:w.tick} as never);
  const blueprint=job(w,'wall',12,12,{material:'wood',construction:'blueprint'}),mine=job(w,'mine',13,12);w.jobs.push(blueprint,mine);
  w.growingZones.push({id:w.nextId++,cells:[at(w,20,20)],plant:'potato',allowSow:true,allowCut:true} as never);
  const all=mapObjectsInRect(w,()=>true);
  expect(all.resources).toEqual([{kind:'pile',id:wood.id}]);
  // No wall (neverMultiSelect), no tree (PlantBaseNonEdible), no designation.
  expect(all.things).toEqual([{kind:'structure',id:table.id},{kind:'pile',id:chunk.id},{kind:'job',id:blueprint.id}]);
  expect(all.zones.map(z=>z.kind)).toEqual(['growing']);
  expect(pileCountsAsResource(chunk)).toBe(false);
  const colonist={id:1,category:0},visitor={id:2,category:1},muffalo={id:3,category:2},body={id:4,category:3};
  expect(boxSelection([muffalo,visitor,colonist],all)).toEqual({pawns:[1]});
  expect(boxSelection([muffalo,visitor],all)).toEqual({pawns:[2]});
  expect(boxSelection([muffalo,body],all)).toEqual({objects:all.resources});
  expect(boxSelection([muffalo,body],{...all,resources:[]})).toEqual({pawns:[3]});
  expect(boxSelection([body],{...all,resources:[]})).toEqual({objects:all.things});
  expect(boxSelection([body],{resources:[],things:[],zones:all.zones,plans:[]})).toEqual({pawns:[4]});
  expect(boxSelection([],{resources:[],things:[],zones:all.zones,plans:[]})).toEqual({objects:all.zones});
  expect(boxSelection([],{resources:[],things:[],zones:all.zones,plans:[{kind:'plan',id:7}]})).toEqual({objects:[{kind:'plan',id:7}]});
  expect(boxSelection([],{resources:[],things:[],zones:[],plans:[]})).toBeUndefined();
  // Double-click on a wall or a natural rock selects no group (neverMultiSelect).
  expect(mapObjectGroupTarget(w,mapObjectsAt(w,{x:3,z:3}))).toBeUndefined();
  w.tiles[at(w,1,1)]={terrain:'rock',stone:'granite'};
  expect(mapObjectGroupTarget(w,mapObjectsAt(w,{x:1,z:1}))).toBeUndefined();
  expect(mapObjectGroupTarget(w,mapObjectsAt(w,{x:6,z:3}))).toEqual({kind:'structure',id:table.id});
});

// ---- 30. Gestures -----------------------------------------------------------

test('30: Period and Comma cycle the colonists in bar order from the last or first selected (ThingSelectionUtility.SelectNext/PreviousColonist)',()=>{
  expect(cycledColonist([3,5,9],new Set(),true)).toBe(3);
  expect(cycledColonist([3,5,9],new Set(),false)).toBe(9);
  expect(cycledColonist([3,5,9],new Set([3,5]),true)).toBe(9);
  expect(cycledColonist([3,5,9],new Set([3,5]),false)).toBe(9);
  expect(cycledColonist([3,5,9],new Set([9]),true)).toBe(3);
  expect(cycledColonist([],new Set(),true)).toBeUndefined();
});

// ---- 33. Hover readout and temperature ---------------------------------------

test('33: the hover readout gives MouseoverReadout lines, bottom line first in Core and top line first here',()=>{
  const w=bare(),cell={x:8,z:8},i=at(w,8,8);
  w.growingZones.push({id:w.nextId++,cells:[i],plant:'potato',allowSow:true,allowCut:true} as never);
  w.tiles[i]={terrain:'grass',snowDepth:.4};
  w.piles.push({id:w.nextId++,kind:'wood',item:'wood',quantity:12,owner:{type:'ground',x:8,z:8}});
  w.filth={rng:1,cleaned:0,items:[{id:901,kind:'dirt',x:8,z:8,thickness:2,grownCore:0,expiresAfterCore:1e9,nextCheckCore:1e9}]};
  w.roofing={constructed:[i],build:[],remove:[],cursor:0};
  const lines=mapHoverLines(w,cell,.54);
  expect(lines).toEqual(['Toit construit','Terre ×2','Bois ×12','Neige (fine) (vitesse de marche 76 %)','Zone de culture',lines.at(-2),'Éclairé (54 %)']);
  expect(lines.at(-2)).toMatch(/^Terre ordinaire \(vitesse de marche \d+ % fert\. 100 %\)$/u);
  expect(lines.join(' ')).not.toMatch(/tick|Support|Sol de culture/u);
  // A rock wall: the rough stone under it, then the rock Thing.
  w.tiles[at(w,9,8)]={terrain:'rock',stone:'granite'};
  expect(mapHoverLines(w,{x:9,z:8},.1)).toEqual(['Granite','Granite brut (vitesse de marche 87 %)','Sombre (10 %)']);
  expect(glowLabel(.95)).toBe('Très éclairé (95 %)');expect(glowLabel(.3)).toBe('Sombre (30 %)');
});

test('33: the bottom-right temperature is the hovered room\'s, indoors or outdoors (GlobalControls.TemperatureString)',()=>{
  const w=bare(),outside=`Extérieur ${Math.round(outdoorTemperature(w))} °C`;
  w.thermal={regions:[{cells:[at(w,5,5),at(w,6,5)],temperature:21.4}]};
  w.structures.push({id:w.nextId++,kind:'wall',x:7,z:5,orientation:0,footprint:'standard',material:'wood'});
  expect(hoverTemperatureText(w,{x:5,z:5})).toBe('Intérieur 21 °C');
  expect(hoverTemperatureText(w,{x:7,z:5})).toBe('Intérieur 21 °C');
  expect(hoverTemperatureText(w,{x:12,z:12})).toBe(outside);
  expect(hoverTemperatureText(w,null)).toBe(outside);
  expect(SCHEMA_VERSION).toBeGreaterThanOrEqual(376);
});
