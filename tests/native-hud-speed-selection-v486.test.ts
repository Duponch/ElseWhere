// Exercise actual source bodies with controlled geometry and rendering dependencies.
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {describe,it,expect} from 'vitest';
import {parseAst} from 'rolldown/parseAst';
import {PawnSelection} from '../src/ui/pawn-selection';
const base=new URL('../src/',import.meta.url);
const mainText=readFileSync(new URL('main.ts',base),'utf8'),stageText=readFileSync(new URL('ui3d/NativeStage.ts',base),'utf8');
const main=parseAst(mainText,{lang:'ts'}),stage=parseAst(stageText,{lang:'ts'});
function find(node:any,predicate:(n:any)=>boolean):any{if(!node||typeof node!=='object')return; if(predicate(node))return node;for(const value of Object.values(node)){if(Array.isArray(value)){for(const item of value){const found=find(item,predicate);if(found)return found;}}else if(value&&typeof value==='object'){const found=find(value,predicate);if(found)return found;}}}
function fn(name:string){const node=find(main,(n:any)=>n.type==='FunctionDeclaration'&&n.id?.name===name);if(!node)throw Error('Actual main function missing '+name);return {node,text:mainText.slice(node.start,node.end)};}
const options=find(main,(n:any)=>n.type==='NewExpression'&&n.callee?.name==='NativeStage')?.arguments[0];
function callback(name:string){const property=options?.properties.find((n:any)=>n.key?.name===name);if(!property)throw Error('Actual NativeStage option missing '+name);return mainText.slice(property.value.start,property.value.end);}
function replacement(name:string){const block=find(fn(name).node.body,(n:any)=>n.type==='IfStatement'&&n.consequent?.type==='BlockStatement'&&n.consequent.body.some((s:any)=>s.expression?.type==='AssignmentExpression'&&s.expression.left?.name==='nativeHudHiddenInspectorKey'));if(!block)throw Error('Actual replacement invalidation missing');return mainText.slice(block.start,block.end);}
const stageClass=find(stage,(n:any)=>n.type==='ClassDeclaration'&&n.id?.name==='NativeStage');
const stageMethods=['pointerDown','pointerUp','activate','dismissPage','keyDown'].map(name=>{const node=stageClass.body.body.find((n:any)=>n.type==='MethodDefinition'&&n.key?.name===name);if(!node)throw Error('Actual stage method missing '+name);return stageText.slice(node.start,node.end);}).join('\n');
const mainFactory=stripTypeScriptTypes(`(function(deps:any,PawnSelection:any){
 const selection=new PawnSelection();selection.apply({ids:[8],additive:false,toggle:false},new Set([8,9]));
 const draft={target:{x:4,z:5}},snapshot={pawns:[{id:8,draft},{id:9}],wildlife:{animals:[]},mechanoids:[]},session={generation:2};let campaignPresentationEpoch=3,nativeHudHiddenInspectorKey;
 let campaignOnly=undefined,nativeCustomPage,nativeToolPalette,nativeEncounterKey,currentPanel=null,currentSpeed=0,lastSpeed=1,selectedPawn=8,selectedCell,selectedObject,selectedObjects=[],replacingWorld=false,graphicsFault=false,simulationStopped=false,front=false;
 const waitingRequests=new Set(),requests=[],frontMenu={isOpen:()=>front},nativeHud=undefined,nativeLocalTrade=undefined;
 const renderer={setSelectedPawns(){},setSelectedObject(){},focusPawn(){},cancelSelection(){},cancelDesignation(){}},shootingControls={cancel(){}},orderMenu={close(){}},knownPosition256=()=>true,cancelNativeOrderPage=()=>{};
 const nativeUi={setTextEntities(){},setWorldVisible(){},showPage(page){deps.page=page;deps.pageSink?.(page);}};
 const wallCutaway=false,nativeRoofsVisible=true,foliageVisible=true,nativeZonesVisible=true,nativePerspective=false;
 const nativeTextEntitiesFor=()=>[],readNativeState=()=>({}),nativeActions=()=>({}),syncNativePanelState=()=>{},buildNativeEncounter=()=>null,buildNativePanel=()=>null;
 const buildNativeToolPalette=()=>null,openNativeSaveManager=()=>{},openNativeOptions=()=>{},openHelp=()=>{};
 const buildNativeInspector=()=>selection.ids.size?{id:'inspect-pawn-'+selection.single+'-bio',layout:'inspector',rows:[],onClose:clearSelection}:null;
 const setPanel=value=>{currentPanel=value;},rebuildInspector=()=>{},renderState=()=>refreshNativeUi(),client={setSpeed:async(speed,options)=>{requests.push({speed,options});}};
 ${['nativePawnInspectorKey','refreshNativeUi','selectPawns','clearSelection','changeSpeed'].map(name=>fn(name).text).join('\n')}
 const dismiss=${callback('onHudInspectorDismiss')},escape=${callback('onEscape')};
 return {dismiss,escape,refresh:refreshNativeUi,clear:clearSelection,speed:changeSpeed,requests,select:ids=>selectPawns({ids,additive:false,toggle:false}),replaceMap(replaced){${replacement('receiveMainSnapshot')}},replaceCampaign(replaced,hadMap){${replacement('receiveMainCampaignOnly')}},generation(){session.generation++;},setFront(value){front=value;},get state(){return {ids:[...selection.ids],draft,hidden:nativeHudHiddenInspectorKey,key:nativePawnInspectorKey(),epoch:campaignPresentationEpoch,page:deps.page};}};
})`,{mode:'strip'});
// Geometry/hit acquisition is a declared boundary: stable hit and empty pose.
// The actual pointer/activation bodies decide dismissal, edit admission and action.
const stageFactory=stripTypeScriptTypes(`(function(){class NativeHitPose{constructor(_meshes:any){}intersects(){return false;}}class ExtractedStage{${stageMethods}}return ExtractedStage;})()`,{mode:'strip'});
const createMain=Function('return '+mainFactory)(),Stage=Function('return '+stageFactory)();
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture(id='hud:speed:1'){
 const deps:any={},main=createMain(deps,PawnSelection),errors:string[]=[],events:string[]=[],piece:any={parent:{},userData:{nativeId:id,mesh:{}}};
 const control:any={id,onActivate:()=>{events.push('action');return main.speed(Number(id.split(':').at(-1)));}},hit:any={piece,control};let currentHit:any=hit;
 const stage:any=Object.assign(new Stage(),{options:{onHudInspectorDismiss:()=>{events.push('dismiss');main.dismiss();},onEscape:main.escape,onActivate:()=>events.push('activate'),onError:(m:string)=>errors.push(m)},pageBox:{x:10,y:10,width:300,height:300},displayScale:1,activationSerial:0,closed:false,frontVisible:false,hits:new Map([[piece.userData.mesh,hit]]),pagePieces:[],pageControls:[],insetControls:new Map(),moving:new Set(),lastPointer:{x:900,y:900},pendingActions:0,hit:()=>currentHit,cameraWorldPoint:()=>false,globeHit:()=>null,belongsToPage:()=>false,gesture(){},swallow(){},clearHint(){},closeDropdown(){},setPointerOverUi(){},invalidate(){},updatePointerCursor(){},acquiredHitLive:()=>true});
 deps.pageSink=(page:any)=>{stage.page=page;};main.refresh();const event={button:0,pointerId:17,clientX:900,clientY:900,target:{}};
 return {main,stage,control,hit,piece,events,errors,down:()=>stage.pointerDown(event),up:()=>stage.pointerUp(event),click:async()=>{stage.pointerDown(event);stage.pointerUp(event);await flush();},world:()=>{currentHit=undefined;stage.pointerDown(event);stage.pointerUp(event);}};
}
describe('HUD speed keeps the selection and the inspect pane open (Core: the time controls never close it)',()=>{
 it.each([0,1,3,6])('speed%s leaves the inspector open and refresh preserves selected drafted pawn',async speed=>{const f=fixture('hud:speed:'+speed),draft=f.main.state.draft;await f.click();expect(f.main.state.ids).toEqual([8]);expect(f.main.state.draft).toBe(draft);expect(f.main.requests).toEqual([{speed,options:undefined}]);expect(f.events).toEqual(['activate','action']);expect(f.stage.page?.id).toBe('inspect-pawn-8-bio');f.main.refresh();expect(f.stage.page?.id).toBe('inspect-pawn-8-bio');expect(f.main.state.hidden).toBeUndefined();expect(f.errors).toEqual([]);});
 it('rejecting a pending edit neither sends speed nor closes anything; an accepted edit sends it afterward and still keeps the pane',async()=>{for(const accepted of [false,true]){const f=fixture();let release!:(v:boolean)=>void;f.stage.editor={};f.stage.finishEdit=()=>new Promise<boolean>(resolve=>{release=resolve;});f.down();f.up();expect(f.main.requests).toEqual([]);expect(f.events).toEqual([]);expect(f.stage.page.id).toBe('inspect-pawn-8-bio');release(accepted);await flush();expect(f.main.requests.length).toBe(accepted?1:0);expect(f.main.state.ids).toEqual([8]);expect(f.events.includes('dismiss')).toBe(false);expect(f.stage.page.id).toBe('inspect-pawn-8-bio');}});
 it.each(['serial','removed','disabled','closed'])('pending edit then%s makes an acquired speed action stale',async kind=>{const f=fixture();let release!:(v:boolean)=>void;f.stage.editor={};f.stage.finishEdit=()=>new Promise<boolean>(resolve=>{release=resolve;});f.down();f.up();if(kind==='serial')f.stage.activationSerial++;if(kind==='removed'){f.stage.hits.clear();f.piece.parent=null;}if(kind==='disabled')f.control.disabled=true;if(kind==='closed')f.stage.closed=true;release(true);await flush();expect(f.main.requests).toEqual([]);expect(f.events).toEqual([]);expect(f.main.state.ids).toEqual([8]);});
 it('ordinary outside World, Escape and an inspector close action retain actual clearSelection behavior',async()=>{for(const kind of ['world','escape','close']){const f=fixture();if(kind==='world')f.world();else if(kind==='escape')f.stage.keyDown({key:'Escape',repeat:false,target:{}});else{f.control.id='inspect-close';f.piece.userData.nativeId='inspect-close';f.control.onActivate=f.main.clear;f.stage.pagePieces=[f.piece];f.stage.pageControls=[f.hit];f.stage.activate(f.hit);}await flush();expect(f.main.state.ids).toEqual([]);expect(f.main.state.hidden).toBeUndefined();expect(f.events).not.toContain('dismiss');}});
 it('a non-speed external button follows ordinary dismissal instead of preserving selection',async()=>{const f=fixture('hud:view:foliage');f.control.onActivate=()=>f.events.push('view');await f.click();expect(f.main.state.ids).toEqual([]);expect(f.events).not.toContain('dismiss');expect(f.events).toContain('view');});
});
