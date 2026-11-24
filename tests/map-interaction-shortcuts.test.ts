import {describe,expect,it,vi} from 'vitest';
import {CameraRig} from '../src/render/CameraRig';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {ColonyRenderer} from '../src/render/ColonyRenderer';
import {NativeStage} from '../src/ui3d/NativeStage';
import {stepGameSpeed,pageKeyCameraSpan,squareDesignationEnd,carpetEyedropper} from '../src/ui/map-interaction-shortcuts';
import {mapSelectionShortcut,requestedPowerToggle} from '../src/ui/map-object-actions';
import {globalHotkeyTool,paletteHotkeyTool} from '../src/ui/main-tab-hotkeys';
import {newDoorState} from '../src/sim/door-rules';
import {addMaterial} from '../src/sim/materials';
import {applyCommand} from '../src/sim/engine';
import {materialAllowedForPlayer256,setMaterialForbidden256} from '../src/sim/material-permission-256';
import {CARPET_RESEARCH_355} from '../src/sim/carpet-355';
import type {Cell,Structure,World} from '../src/sim/types';
import type {MapObjectSelection} from '../src/ui/map-object-selection';
import {deconstructionCamp} from './scenarios/deconstruction';

const at={x:5,z:5};
const structure=(world:World,id:Structure['kind'],extra:Partial<Structure>={}):Structure=>{const s:Structure={kind:id,id:world.nextId++,x:at.x,z:at.z,footprint:'standard',orientation:0,material:'wood',...extra};world.structures.push(s);return s;};
const selected=(...entries:Structure[]):MapObjectSelection[]=>entries.map(s=>({kind:'structure',id:s.id}));
const commands=(world:World,objects:MapObjectSelection[],key:string)=>mapSelectionShortcut(world,objects,key)?.commands??[];

describe('Core keyboard designators are bound to real selected Things',()=>{
 it('keeps C/X contextual and palette shortcuts independent',()=>{
  const w=deconstructionCamp();expect(globalHotkeyTool('c')).toBeUndefined();expect(globalHotkeyTool('X')).toBeUndefined();expect(globalHotkeyTool('s')).toBeUndefined();
  expect(paletteHotkeyTool('orders','C')).toBe('cancel');expect(paletteHotkeyTool('orders','x')).toBe('deconstruct');expect(paletteHotkeyTool('zones','b')).toBe('stockpile');
  expect(commands(w,[],'c')).toEqual([]);expect(commands(w,[],'x')).toEqual([]);
  const wall=structure(w,'wall'),cable=structure(w,'power-conduit',{material:'steel'}),objects=selected(wall);
  const removal=commands(w,objects,'x');expect(removal).toEqual([{type:'designate',kind:'deconstruct',targetId:wall.id,x:5,z:5}]);
  expect(applyCommand(w,removal[0]!).ok).toBe(true);const id=w.jobs.find(j=>j.deconstruction?.structureId===wall.id)!.id;
  expect(commands(w,selected(cable),'c')).toEqual([]);expect(commands(w,objects,'c')).toEqual([{type:'cancel-job',jobId:id}]);
  expect(applyCommand(w,commands(w,objects,'c')[0]!).ok).toBe(true);expect(w.jobs.some(j=>j.id===id)).toBe(false);expect(w.structures.map(s=>s.id)).toEqual([wall.id,cable.id]);
 });
 it('F on mixed material and doors forbids only currently allowed targets, then reallows the exact group',()=>{
  const w=deconstructionCamp();addMaterial(w,'wood',5,{type:'ground',x:7,z:5},'wood');addMaterial(w,'wood',6,{type:'ground',x:8,z:5},'wood');
  const piles=w.piles.filter(p=>p.item==='wood');expect(piles).toHaveLength(2);setMaterialForbidden256(piles[0]!,true);
  const door=structure(w,'door',{door:newDoorState(w.tick)}),objects:MapObjectSelection[]=[{kind:'pile',id:piles[0]!.id},{kind:'structure',id:door.id},{kind:'pile',id:piles[1]!.id}];
  const forbid=commands(w,objects,'f');expect(forbid).toEqual([{type:'door-policy',structureId:door.id,setting:'forbidden',value:true},{type:'material-forbid',pileId:piles[1]!.id,forbidden:true}]);
  for(const command of forbid)expect(applyCommand(w,command).ok).toBe(true);expect(piles.every(p=>!materialAllowedForPlayer256(p))).toBe(true);expect(door.door!.forbidden).toBe(true);
  const allow=commands(w,[...objects].reverse(),'F');expect(allow).toHaveLength(3);for(const command of allow)expect(applyCommand(w,command).ok).toBe(true);expect(piles.every(materialAllowedForPlayer256)).toBe(true);expect(door.door!.forbidden).not.toBe(true);
 });
 it('V reads the requested switch; toggling again cancels the request, not the physical switch',()=>{
  const w=deconstructionCamp(),heater=structure(w,'heater',{material:'steel',power:{on:false,parentId:null}}),objects=selected(heater);
  expect(requestedPowerToggle(w,heater)?.active).toBe(true);const off=commands(w,objects,'v');expect(off).toEqual([{type:'power-flick',structureId:heater.id,on:false}]);expect(applyCommand(w,off[0]!).ok).toBe(true);
  expect(heater.power?.switchOn).not.toBe(false);expect(w.jobs.find(j=>j.flick?.structureId===heater.id)?.flick?.on).toBe(false);expect(requestedPowerToggle(w,heater)?.active).toBe(false);
  const on=commands(w,objects,'v');expect(on).toEqual([{type:'power-flick',structureId:heater.id,on:true}]);expect(applyCommand(w,on[0]!).ok).toBe(true);expect(w.jobs.some(j=>j.flick?.structureId===heater.id)).toBe(false);expect(heater.power?.switchOn).not.toBe(false);
 });
 it('V on mixed requested states turns on only the off devices; nonexistent, passive and hidden targets are refused',()=>{
  const w=deconstructionCamp(),a=structure(w,'heater',{material:'steel',power:{on:false,parentId:null}}),b=structure(w,'heater',{x:6,power:{on:false,parentId:null,switchOn:false}}),wire=structure(w,'power-conduit',{x:7,power:{on:false,parentId:null}});
  const objects=selected(a,b,wire);expect(commands(w,objects,'V')).toEqual([{type:'power-flick',structureId:b.id,on:true}]);expect(commands(w,[...objects].reverse(),'v')).toEqual([{type:'power-flick',structureId:b.id,on:true}]);
  expect(commands(w,selected(wire),'v')).toEqual([]);expect(commands(w,[{kind:'structure',id:999999}],'v')).toEqual([]);
  w.site={...w.site,revision:3} as World['site'];w.exploration={revision:1};w.tiles[b.z*w.width+b.x]!.fogged=true;expect(commands(w,selected(b),'v')).toEqual([]);
 });
});

describe('camera and designation Core keyboard gestures',()=>{
 it('steps the four confirmed time speeds with the proper endpoint limits',()=>{
  expect([0,1,3,6].map(speed=>stepGameSpeed(speed,1))).toEqual([1,3,6,6]);expect([0,1,3,6].map(speed=>stepGameSpeed(speed,-1))).toEqual([0,0,1,3]);
 });
 it('snaps the dominant extent in every quadrant and clips at the world edge',()=>{
  const from={x:8,z:8};expect(squareDesignationEnd(from,{x:11,z:9},32,32)).toEqual({x:11,z:11});expect(squareDesignationEnd(from,{x:7,z:13},32,32)).toEqual({x:3,z:13});expect(squareDesignationEnd(from,{x:4,z:6},32,32)).toEqual({x:4,z:4});expect(squareDesignationEnd(from,{x:8,z:4},32,32)).toEqual({x:12,z:4});
  expect(squareDesignationEnd({x:1,z:1},{x:0,z:9},10,10)).toEqual({x:0,z:9});expect(squareDesignationEnd(from,from,32,32)).toEqual(from);
  const raw={x:10,z:9},port={world:{width:32,height:32},designationControlHeld:true};
  const core=SceneRenderCore.prototype as unknown as {areaDragEndpoint(drag:{from:Cell;action?:string;kind?:string},cell:Cell,held?:boolean):Cell};
  expect(core.areaDragEndpoint.call(port,{from,action:'home'},raw)).toEqual({x:10,z:10});expect(core.areaDragEndpoint.call(port,{from,action:'home'},raw,false)).toBe(raw);expect(core.areaDragEndpoint.call(port,{from,kind:'wall'},raw)).toBe(raw);
 });
 it('samples only an available, known carpet colour without placing or mutating anything',()=>{
  const w=deconstructionCamp();w.research={...w.research!,carpetMaking:{points:CARPET_RESEARCH_355.scaledCost,completedAt:w.tick}};w.tiles[5*w.width+5]!.floor='carpet-red';
  const before=JSON.stringify(w),pick=carpetEyedropper(w,'carpet-blue',at);expect(pick).toBe('carpet-red');expect(JSON.stringify(w)).toBe(before);
  expect(carpetEyedropper(w,'wood-planks',at)).toBeUndefined();expect(carpetEyedropper(w,'carpet-blue',{x:6,z:5})).toBeUndefined();
  w.site={...w.site,revision:3} as World['site'];w.exploration={revision:1};w.tiles[5*w.width+5]!.fogged=true;expect(carpetEyedropper(w,'carpet-blue',at)).toBeUndefined();
 });
 it('cancels a captured eyedropper press on the existing designation cancellation path',()=>{
  const release=vi.fn(),base=vi.spyOn(SceneRenderCore.prototype,'cancelDesignation').mockReturnValue(false);
  const port={eyedropperPress:{pointerId:19,x:1,y:1,floor:'carpet-red'},pointerDown:{button:0},orderRightPress:{},renderer:{domElement:{hasPointerCapture:()=>true,releasePointerCapture:release}}};
  try{expect(ColonyRenderer.prototype.cancelDesignation.call(port as unknown as ColonyRenderer,'presentation')).toBe(true);expect(release).toHaveBeenCalledExactlyOnceWith(19);expect(port.eyedropperPress).toBeUndefined();expect(port.pointerDown).toBeNull();expect(base).toHaveBeenCalledExactlyOnceWith('presentation');}finally{base.mockRestore();}
 });
 it('page zoom preserves the real target and angle for both camera projections',()=>{
  const rig=new CameraRig(null);try{for(const mode of ['orthographic','perspective'] as const){rig.setMode(mode);rig.configureMap(250,250);rig.resize(1440,900);const span=rig.span,target=rig.controls.target.clone(),angle=rig.camera.position.clone().sub(target).normalize();
   rig.pageZoom('in');expect(rig.span).toBeCloseTo(pageKeyCameraSpan(span,'in',0,Infinity),5);expect(rig.controls.target.distanceTo(target)).toBeLessThan(1e-8);expect(rig.camera.position.clone().sub(target).normalize().distanceTo(angle)).toBeLessThan(1e-5);
   const near=rig.span;rig.pageZoom('out');expect(rig.span).toBeGreaterThan(near);
   for(let i=0;i<30;i++)rig.pageZoom('in');const limit=rig.span;rig.pageZoom('in');expect(rig.span).toBeCloseTo(limit,6);
  }}finally{rig.dispose();}
 });
 it('the Stage routes the search editor and only grants selected-object hotkeys to its own inspector',()=>{
  const input={piece:{userData:{nativeId:'map-search-input'}},input:{value:''}},beginEdit=vi.fn();
  const stage=Object.assign(Object.create(NativeStage.prototype),{worldVisible:true,frontVisible:false,page:{layout:'map-search'},pageControls:[input],beginEdit}) as NativeStage;
  stage.focusMapSearchInput();expect(beginEdit).toHaveBeenCalledExactlyOnceWith(input);expect(stage.allowsMapSearch()).toBe(true);expect(stage.allowsMapGizmoShortcuts()).toBe(false);
  Object.assign(stage,{page:{layout:'inspector'}});expect(stage.allowsMapGizmoShortcuts()).toBe(true);Object.assign(stage,{dropdown:{}});expect(stage.allowsMapGizmoShortcuts()).toBe(false);expect(stage.allowsMapSearch()).toBe(false);
 });
});
