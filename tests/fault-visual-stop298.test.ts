import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {parseAst} from 'rolldown/parseAst';
import {expect,test,vi} from 'vitest';

// These are the actual production bodies, with declared peripheral services.
// No browser bootstrap, World, Native token, Engine or save is manufactured.
const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
const scene=readFileSync(new URL('../src/render/SceneRenderCore.ts',import.meta.url),'utf8');
const mainAst:any=parseAst(main,{lang:'ts'},'src/main.ts');
const sceneAst:any=parseAst(scene,{lang:'ts'},'SceneRenderCore.ts');
function unique(rows:any[],name:string):any{if(rows.length!==1)throw Error('Expected one actual source body: '+name);return rows[0];}
function find(node:any,predicate:(n:any)=>boolean,out:any[]=[]):any[]{
 if(!node||typeof node!=='object')return out;if(predicate(node))out.push(node);
 for(const[key,value]of Object.entries(node)){if(key==='parent')throw Error('Cyclic AST');if(Array.isArray(value))for(const child of value)find(child,predicate,out);else if(value&&typeof value==='object')find(value,predicate,out);}return out;
}
const pause=unique(mainAst.body.filter((n:any)=>n.type==='FunctionDeclaration'&&n.id?.name==='pauseForMenu'),'pauseForMenu');
const fault=unique(find(mainAst,(n:any)=>n.type==='AssignmentExpression'&&n.left?.type==='MemberExpression'&&n.left.object?.name==='client'&&n.left.property?.name==='onFault'),'client.onFault');
const klass=unique(sceneAst.body.flatMap((n:any)=>n.type==='ExportNamedDeclaration'&&n.declaration?[n.declaration]:[n]).filter((n:any)=>n.type==='ClassDeclaration'&&n.id?.name==='SceneRenderCore'),'SceneRenderCore');
const methods=['stopPresentation','suspendUntilNextFrame','resumeAfterFrameStarvation','visibilityChanged','frame'].flatMap(name=>klass.body.body.filter((n:any)=>n.type==='MethodDefinition'&&n.key?.name===name).map((n:any)=>scene.slice(n.start,n.end)));
const ActualSceneMethods=new Function('return '+stripTypeScriptTypes('(class ActualSceneMethods{'+methods.join('\n')+'})',{mode:'transform'}))() as new()=>any;

function mainHost(stopped:boolean,transition:Promise<void>=Promise.resolve(),refuseReadoption=true){
 const client={setSpeed:vi.fn(async()=>{}),onFault:undefined as undefined|(()=>void)};
 const renderer={cancelDesignation:vi.fn(),stopPresentation:vi.fn(),setWorld:vi.fn(()=>{if(refuseReadoption)throw Error('Revoked Native Full owner');})};
 const services={client,renderer,session:{markSimulationStopped:vi.fn()},groupUI:{setSimulationStopped:vi.fn()},frontMenu:{setHasGame:vi.fn()},audio:{reset:vi.fn()},orderMenu:{close:vi.fn()},updateIncident:vi.fn(),syncStorageButtons:vi.fn(),campaignState:()=>true,deferredResumeGuard:{capture:()=>1,allows:()=>true},stopped,transition};
 const text=`const{client,renderer,session,groupUI,frontMenu,audio,orderMenu,updateIncident,syncStorageButtons,campaignState,deferredResumeGuard}=d;
 let simulationStopped=d.stopped,currentSpeed=6,menuResumeSpeed;const menuTransition=d.transition;
 const snapshot=Object.freeze({displayOnly:true}),latestMotion=undefined,latestCoreFullInput297=Object.freeze({revoked:true});
 ${main.slice(pause.start,pause.end)}
 ${main.slice(fault.start,fault.end)};
 return{pauseForMenu,fault:()=>client.onFault(),state:()=>({simulationStopped,currentSpeed,menuResumeSpeed})};`;
 const actual=new Function('return '+stripTypeScriptTypes('(function(d:any){'+text+'})',{mode:'transform'}))()(services) as {pauseForMenu:()=>Promise<void>;fault:()=>void;state:()=>{simulationStopped:boolean;currentSpeed:number;menuResumeSpeed:number|undefined}};
 return{...services,actual};
}

test('actual Main fault preserves the last scene without re-admitting its revoked owner',()=>{
 const h=mainHost(false);expect(()=>h.actual.fault()).not.toThrow();
 expect(h.renderer.stopPresentation).toHaveBeenCalledTimes(1);expect(h.renderer.setWorld).not.toHaveBeenCalled();
 expect(h.actual.state()).toEqual({simulationStopped:true,currentSpeed:0,menuResumeSpeed:undefined});
 expect(h.session.markSimulationStopped).toHaveBeenCalledTimes(1);expect(h.audio.reset).toHaveBeenCalledTimes(1);
 expect(h.updateIncident).toHaveBeenCalledTimes(1);expect(h.syncStorageButtons).toHaveBeenCalledTimes(1);
});

test('actual stopped scene redraws without advancing poses, queues, clocks or visibility adoption',()=>{
 const view=new ActualSceneMethods(),renderScene=vi.fn(),advance=vi.fn(),take=vi.fn(),adopt=vi.fn();
 const updateTravel=vi.fn(),presentAnimations=vi.fn(),pawns={blend:{value:.4},time:{value:3},updateTravel,presentAnimations};
 Object.assign(view,{disposed:false,fatalError:undefined,preparing:false,lastFrame:100,keys:new Set(['arrowleft']),
  renderer:{info:{reset:vi.fn()}},renderScene,pawns,timeline:{advance,tick:27},presentation:{take},setWorld:adopt,
  frames:{reset:vi.fn()},animationDetail:{reset:vi.fn()},hostPort:{hidden:()=>false}});
 Object.defineProperty(view,'received',{get(){throw Error('Stopped mode must not read a revoked reception');}});
 expect(typeof view.stopPresentation).toBe('function');view.stopPresentation();
 expect(()=>view.frame(1000)).not.toThrow();expect(()=>view.frame(2000)).not.toThrow();
 expect(()=>view.visibilityChanged()).not.toThrow();
 expect(renderScene).toHaveBeenCalledTimes(2);expect(advance).not.toHaveBeenCalled();expect(take).not.toHaveBeenCalled();expect(adopt).not.toHaveBeenCalled();
 expect(view.timeline.tick).toBe(27);expect(pawns.blend.value).toBe(.4);expect(pawns.time.value).toBe(3);
 expect(updateTravel).not.toHaveBeenCalled();expect(presentAnimations).not.toHaveBeenCalled();expect(view.keys.size).toBe(0);
});

test('actual menu pause does not send a request to an already stopped simulation',async()=>{
 const h=mainHost(true);await h.actual.pauseForMenu();expect(h.client.setSpeed).not.toHaveBeenCalled();
 expect(h.actual.state().menuResumeSpeed).toBe(0);expect(h.renderer.cancelDesignation).toHaveBeenCalledTimes(1);expect(h.orderMenu.close).toHaveBeenCalledTimes(1);
});

test('actual menu pause rechecks a fault occurring while the previous transition settles',async()=>{
 let resolve!:()=>void;const transition=new Promise<void>(done=>{resolve=done;});
 const h=mainHost(false,transition,false),pending=h.actual.pauseForMenu();h.actual.fault();resolve();await pending;
 expect(h.client.setSpeed).not.toHaveBeenCalled();expect(h.actual.state().menuResumeSpeed).toBe(0);
});


test('actual temporary suspension waits for one explicit frame resume before refreshing presentation',()=>{
 const view=new ActualSceneMethods(),reset=vi.fn(),detailReset=vi.fn(),advance=vi.fn(),take=vi.fn(),adopt=vi.fn();
 let receptionReads=0;
 Object.assign(view,{disposed:false,fatalError:undefined,presentationStopped:false,lastFrame:100,keys:new Set(),
  frames:{reset},animationDetail:{reset:detailReset},hostPort:{hidden:()=>false},
  timeline:{advance,tick:27},presentation:{take},setWorld:adopt});
 Object.defineProperty(view,'received',{get(){receptionReads++;return undefined;}});
 expect(typeof view.suspendUntilNextFrame).toBe('function');expect(typeof view.resumeAfterFrameStarvation).toBe('function');
 view.suspendUntilNextFrame();view.suspendUntilNextFrame();
 expect(view.presentationSuspendedUntilFrame325).toBe(true);expect(reset).not.toHaveBeenCalled();expect(receptionReads).toBe(0);
 view.resumeAfterFrameStarvation();
 expect(view.presentationSuspendedUntilFrame325).toBe(false);expect(reset).toHaveBeenCalledTimes(1);expect(detailReset).toHaveBeenCalledTimes(1);
 expect(view.lastFrame).toBe(0);expect(receptionReads).toBe(1);
 view.resumeAfterFrameStarvation();expect(reset).toHaveBeenCalledTimes(1);expect(receptionReads).toBe(1);
 expect(advance).not.toHaveBeenCalled();expect(take).not.toHaveBeenCalled();expect(adopt).not.toHaveBeenCalled();expect(view.timeline.tick).toBe(27);
});

test('actual fault while temporarily suspended cannot revive revoked presentation on the next frame',()=>{
 const view=new ActualSceneMethods(),reset=vi.fn(),detailReset=vi.fn(),renderScene=vi.fn(),advance=vi.fn(),take=vi.fn(),adopt=vi.fn();
 Object.assign(view,{disposed:false,fatalError:undefined,preparing:false,presentationStopped:false,lastFrame:100,keys:new Set(['arrowleft']),
  frames:{reset},animationDetail:{reset:detailReset},hostPort:{hidden:()=>false},
  renderer:{info:{reset:vi.fn()}},renderScene,timeline:{advance,tick:27},presentation:{take},setWorld:adopt});
 Object.defineProperty(view,'received',{get(){throw Error('Faulted suspension must not read a revoked Native reception');}});
 expect(typeof view.suspendUntilNextFrame).toBe('function');expect(typeof view.resumeAfterFrameStarvation).toBe('function');
 view.suspendUntilNextFrame();expect(view.presentationSuspendedUntilFrame325).toBe(true);
 view.stopPresentation();expect(view.presentationStopped).toBe(true);
 expect(()=>view.resumeAfterFrameStarvation()).not.toThrow();expect(view.presentationSuspendedUntilFrame325).toBe(false);
 expect(()=>view.frame(2000)).not.toThrow();expect(renderScene).toHaveBeenCalledTimes(1);
 expect(reset).not.toHaveBeenCalled();expect(detailReset).not.toHaveBeenCalled();expect(adopt).not.toHaveBeenCalled();expect(advance).not.toHaveBeenCalled();expect(take).not.toHaveBeenCalled();
 expect(view.timeline.tick).toBe(27);expect(view.keys.size).toBe(0);
 view.suspendUntilNextFrame();expect(view.presentationSuspendedUntilFrame325).toBe(false);
});
