import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {describe,expect,it} from 'vitest';
import {parseAst} from 'rolldown/parseAst';
import {createNativeFrontMenu} from '../src/ui3d/native-front';
import type {FrontMenu,FrontMenuOptions} from '../src/ui/front-menu';
import type {NativeControl,NativePage} from '../src/ui3d/native-contract';

// Execute the actual main integration functions without importing its browser
// bootstrap, renderer, simulation or workers. No copy of their guard logic.
const mainText=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8'),main=parseAst(mainText,{lang:'ts'},'src/main.ts');
function declaration(name:string){
 const node=main.body.find(node=>node.type==='FunctionDeclaration'&&node.id?.name===name);
 if(!node||node.type!=='FunctionDeclaration')throw Error('Missing main function '+name);return mainText.slice(node.start,node.end);
}
const optionsDeclaration=main.body.flatMap(node=>node.type==='VariableDeclaration'?node.declarations:[]).find(node=>node.id.type==='Identifier'&&node.id.name==='frontOptions');
if(optionsDeclaration?.init?.type!=='ObjectExpression')throw Error('Missing actual frontOptions initializer');
const resume=optionsDeclaration.init.properties.find(node=>node.type==='Property'&&node.key.type==='Identifier'&&node.key.name==='onResume');
if(resume?.type!=='Property')throw Error('Missing actual frontOptions.onResume');
const backToMenu=optionsDeclaration.init.properties.find(node=>node.type==='Property'&&node.key.type==='Identifier'&&node.key.name==='onReturnToGameMenu');
if(backToMenu?.type!=='Property')throw Error('Missing actual frontOptions.onReturnToGameMenu');
const selected=['pauseForMenu','openNativeOptions','openFront','setPanel','changeSpeed'].map(declaration).join('\n');
const source=stripTypeScriptTypes(`(function(dependencies:any){
let frontMenu,currentPanel='menu',menuResumeSpeed,currentSpeed=dependencies.speed,lastSpeed=1;
let snapshot={},campaignOnly,simulationStopped=false,replacingWorld=false,graphicsFault=false,currentTool='select',nativeCustomPage,nativeToolPalette;
const waitingRequests=new Set(),speedRequests=[],panelChanges=[],cancelNativeOrderPage=()=>{},resetNativePanelSession=()=>{},applyTool=()=>{},refreshNativeUi=()=>{},syncStorageButtons=()=>{},prepareWorld=async()=>{};
const nativeUi={setPanel:value=>panelChanges.push(value)},renderer={cancelDesignation:()=>{}},orderMenu={close:()=>{}},menuTransition=Promise.resolve(),campaignState=()=>snapshot;
const session={hasWorld:true,busy:false,refreshSaves:async()=>{}},deferredResumeGuard={held:dependencies.held,capture:()=>0,allows:()=>!dependencies.held};
const client={cancelShipCountdown298:()=>{},setSpeed:async(speed,options)=>{currentSpeed=speed;speedRequests.push({speed,options});}},attempt=async action=>action();
// The speed sound cue (audio coverage of 22 November) stays silent here.
const clockCue=()=>({kind:'clock',pitch:1}),audio={playInterface:()=>{}};
${selected}
const actualResume=${mainText.slice(resume.value.start,resume.value.end)};
const actualBack=${mainText.slice(backToMenu.value.start,backToMenu.value.end)};
return {bind:menu=>{frontMenu=menu;},open:openNativeOptions,openFront,backToMenu:actualBack,resumePause:()=>setPanel(null),resume:actualResume,speed:changeSpeed,
 get state(){return {currentPanel,currentSpeed,menuResumeSpeed};},speedRequests,panelChanges,block:()=>waitingRequests.add(1)};
})`,{mode:'transform'});
interface Integration {bind(menu:FrontMenu):void;open():Promise<void>;openFront(page:'home'|'load'|'create'):Promise<void>;backToMenu():void;resumePause():void;resume():Promise<void>;speed(value:number,token?:unknown):Promise<void>;state:{currentPanel:string|null;currentSpeed:number;menuResumeSpeed:number|undefined};speedRequests:{speed:number;options?:unknown}[];panelChanges:(string|null)[];block():void}
function fixture(speed=0,held=false){
 const runtime=Function('return (\n'+source.trim().replace(/;$/u,'')+'\n);')()({speed,held}) as Integration;
 const yes=()=>true,no=()=>false,noop=async()=>{};
 const options:FrontMenuOptions={onStart:noop,onLoad:noop,onResume:runtime.resume,getTexturesEnabled:yes,onTexturesEnabledChange:yes,getGroundGrassEnabled:yes,onGroundGrassEnabledChange:yes,getDioramaEnabled:yes,onDioramaEnabledChange:yes,getRoomEnabled:yes,onRoomEnabledChange:yes,getLightingSettings:()=>({sun:1,moon:1,ambient:1}),onLightingSettingsChange:yes,getSoundEnabled:no,onSoundEnabledChange:yes,getSoundVolume:()=>0,onSoundVolumeChange:yes,onTestSound:noop,getMusicEnabled:no,onMusicEnabledChange:yes,getMusicVolume:()=>0,onMusicVolumeChange:yes,getSaves:()=>[],getTestColonies:async()=>[],onLoadTest:noop,onImport:noop};
 options.onReturnToGameMenu=runtime.backToMenu;
 let page:NativePage|null=null;const menu=createNativeFrontMenu(options,next=>{page=next;});runtime.bind(menu);
 const click=async(id:string)=>{const control:NativeControl|undefined=[...(page?.actions??[]),...(page?.rows.flatMap(row=>row.controls??[])??[])].find(c=>c.id===id);if(!control)throw Error('Missing real front control '+id);expect(control.disabled).not.toBe(true);await control.onActivate();};
 return {runtime,menu,click,get page(){return page;}};
}

describe('native Options close → actual main speed integration V485',()=>{
 it('releases the hidden menu owner so a subsequent HUD speed callback is accepted',async()=>{
  const f=fixture();await f.runtime.open();expect(f.page?.id).toBe('front-options');
  expect(f.menu.isGameOverlay()).toBe(true);await f.click('front-back');expect(f.runtime.state.currentPanel).toBe('menu');f.runtime.resumePause();
  expect(f.menu.isOpen()).toBe(false);expect(f.page).toBeNull();
  await f.runtime.speed(1);expect(f.runtime.state.currentPanel).toBeNull();expect(f.runtime.state.currentSpeed).toBe(1);
  expect(f.runtime.speedRequests.at(-1)?.speed).toBe(1);
 });
 it('restores the captured speed once after Options instead of retaining a hidden pause lock',async()=>{
  const f=fixture(3);await f.runtime.open();expect(f.runtime.state.currentSpeed).toBe(0);
  await f.click('front-back');expect(f.runtime.speedRequests.map(r=>r.speed)).toEqual([0]);expect(f.runtime.state.currentPanel).toBe('menu');f.runtime.resumePause();
  expect(f.runtime.speedRequests.map(r=>r.speed)).toEqual([0,3]);expect(f.runtime.state.menuResumeSpeed).toBeUndefined();expect(f.runtime.state.currentPanel).toBeNull();
 });
 it('keeps the deferred pause guard on resume and retains the explicit speed token afterward',async()=>{
  const f=fixture(3,true);await f.runtime.open();await f.click('front-back');f.runtime.resumePause();
  expect(f.runtime.state.currentSpeed).toBe(0);expect(f.runtime.speedRequests.every(r=>r.speed===0)).toBe(true);
  const token={fixture:'actual-explicit-threat-token'};await f.runtime.speed(6,token);
  expect(f.runtime.speedRequests.at(-1)).toEqual({speed:6,options:{explicit:true,token}});
 });
 it('does not weaken pending-request admission while closing the native front menu',async()=>{
  const f=fixture();await f.runtime.open();await f.click('front-back');await f.runtime.openFront('home');expect(f.menu.isGameOverlay()).toBe(false);f.runtime.block();const before=f.runtime.speedRequests.length;
  await f.click('resume');expect(f.menu.isOpen()).toBe(true);expect(f.runtime.speedRequests).toHaveLength(before);
  expect(f.page?.rows.find(row=>row.id==='front-error')?.label).toContain('Chargez une colonie validée');
 });
 it('opening Load from the pause menu keeps the map origin and the original pause through its close',async()=>{
  const f=fixture(6);await f.runtime.openFront('load');expect(f.page?.id).toBe('front-load');expect(f.menu.isGameOverlay()).toBe(true);
  expect(f.runtime.state.currentSpeed).toBe(0);expect(f.runtime.state.menuResumeSpeed).toBe(6);
  f.page?.onClose?.();expect(f.menu.isOpen()).toBe(false);expect(f.runtime.state.currentPanel).toBe('menu');expect(f.runtime.speedRequests.map(r=>r.speed)).toEqual([0]);
  f.runtime.resumePause();expect(f.runtime.speedRequests.map(r=>r.speed)).toEqual([0,6]);
 });
});
