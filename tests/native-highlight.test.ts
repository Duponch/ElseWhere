import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import * as THREE from 'three/webgpu';
import {NativeStage} from '../src/ui3d/NativeStage';
import {NativeHighlightPass,highlightPulse,HIGHLIGHT_PULSE_AMPLITUDE,HIGHLIGHT_PULSE_FREQUENCY} from '../src/ui3d/native-highlight';
import {highlightOnlyWhileClosed,learningHighlightTags,nativeHighlightTag} from '../src/ui/native-highlight-tags';
import {LEARNING_CONCEPTS} from '../src/ui/learning-concepts';
import {createLearningHelper,LEARNING_HELPER_STORAGE_KEY} from '../src/ui/learning-helper';
import {createNativeGuidance} from '../src/ui3d/native-guidance-card';
import {createGuidanceCardSession} from '../src/ui/guidance-card';
import {NativeHudCards} from '../src/ui3d/native-hud';
import {MANAGEMENT_BUTTONS,PrototypeCardboardArt,type CardboardPiece} from '../src/ui3d/prototype-art';
import {buildNativePanel,buildNativeToolPalette} from '../src/ui3d/native-panels';
import {buildNativeInspector,setNativeInspectorTab} from '../src/ui3d/native-inspector';
import type {NativeControl,NativePage,NativeUiActions,NativeUiState} from '../src/ui3d/native-contract';
import {MapOutlineLayer} from '../src/render/MapOutlineLayer';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {createWorld} from '../src/sim/index';
import {serializeWorld} from '../src/sim/serialization';
import type {World} from '../src/sim/types';
vi.mock('../src/ui/native-cardboard-cursors',()=>({setNativeCursor:vi.fn()}));

// Interface lot: highlight tags of native controls (Core UIHighlighter) and a
// map rectangle outline (Core GenDraw.DrawFieldEdges). No World is written.
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});

class ImageFixture {onload:(()=>void)|null=null;onerror:(()=>void)|null=null;complete=false;naturalWidth=0;src='';}
function stubPaint():void {
  const methods=new Set(['clearRect','fillRect','strokeRect','save','restore','beginPath','moveTo','lineTo','closePath','fill','stroke','arc','translate','rotate','scale','fillText','strokeText','drawImage','setLineDash','quadraticCurveTo','bezierCurveTo','ellipse','rect','clip','setTransform','resetTransform','transform','arcTo','putImageData']);
  vi.stubGlobal('Image',ImageFixture);
  vi.stubGlobal('document',{createElement:(tag:string)=>{
    if(tag!=='canvas')throw Error(`Unexpected native element ${tag}`);
    const state=new Map<PropertyKey,unknown>(),stack:Array<Map<PropertyKey,unknown>>=[];
    const ctx=new Proxy({},{get(_target,key){
      if(key==='measureText')return (text:string)=>({width:String(text).length*7});
      if(key==='createLinearGradient'||key==='createRadialGradient')return ()=>({addColorStop:()=>{}});
      if(key==='getImageData')return ()=>({data:new Uint8ClampedArray(4)});
      if(typeof key==='string'&&methods.has(key))return()=>{if(key==='save')stack.push(new Map(state));if(key==='restore'){state.clear();for(const[k,v]of stack.pop()??[])state.set(k,v);}};
      return state.get(key);
    },set(_target,key,value){state.set(key,value);return true;}});
    return {width:0,height:0,getContext:()=>ctx};
  }});
}

let seed=345100;
function colony():World {return createWorld(++seed,32,32);}
function uiState(world:World,extra:Partial<NativeUiState>={}):NativeUiState {
  return {world,epoch:seed,panel:null,category:'structure',tool:'select',orientation:0,selectedPawnIds:[],selectedObjects:[],constructionMaterial:'wood',creationStorage:{priority:3,filters:{wood:true,food:true}},speed:0,hasGame:true,busy:false,saves:[],...extra};
}
function uiActions(state:()=>NativeUiState):NativeUiActions & {command:ReturnType<typeof vi.fn>} {
  const noop=()=>{};
  return {command:vi.fn(async()=>({ok:true})),readState:state,showPage:noop,refresh:noop,panel:noop,category:noop,tool:noop,selectPawn:noop,speed:noop,rotate:noop,material:noop,creationStorage:noop,front:noop,save:noop,exportSave:noop};
}
/** Centres of the frames written in the merged highlight mesh. */
function frameCenters(mesh:THREE.Mesh):THREE.Vector3[] {
  const positions=mesh.geometry.getAttribute('position') as THREE.BufferAttribute,centers:THREE.Vector3[]=[];
  for(let frame=0;frame*48<mesh.geometry.drawRange.count;frame++){const center=new THREE.Vector3();for(let v=0;v<48;v++)center.add(new THREE.Vector3().fromBufferAttribute(positions,frame*48+v));centers.push(center.divideScalar(48));}
  return centers;
}
const controlsOf=(page:NativePage):NativeControl[]=>[...(page.actions??[]),...page.rows.flatMap(row=>[...(row.controls??[]),...(row.columns?.flatMap(column=>column.control?[column.control]:[])??[])])];

/** The real stage methods on the pieces they read; no renderer or DOM. */
function stageFixture(){
  stubPaint();
  const art=new PrototypeCardboardArt(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1440/900,.1,220);
  const hudRoot=new THREE.Group(),pageGroup=new THREE.Group();
  hudRoot.position.set(0,0,-7.5);camera.add(hudRoot);scene.add(camera);hudRoot.add(pageGroup);
  const anchors={topCenter:new THREE.Group(),topLeft:new THREE.Group(),topRight:new THREE.Group(),bottomRight:new THREE.Group()};
  anchors.topLeft.position.set(-5,2.6,0);anchors.topRight.position.set(5,2.6,0);anchors.bottomRight.position.set(5,-2.6,0);anchors.topCenter.position.set(0,2.8,0);
  hudRoot.add(...Object.values(anchors));
  const invalidate=vi.fn();
  const stage=Object.assign(Object.create(NativeStage.prototype),{
    highlight:new NativeHighlightPass(),highlightPoint:new THREE.Vector3(),art,hits:new Map(),pageControls:[],scene,camera,pageGroup,
    page:null,pageBox:undefined,dropdown:undefined,width:1440,height:900,reducedMotion:{matches:false},invalidate,
  }) as Record<string,any>;
  const renders:THREE.Scene[]=[];
  const renderer={autoClear:true,xr:{enabled:false},getRenderTarget:()=>null,getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,getMRT:()=>null,getRenderObjectFunction:()=>null,
    setMRT:vi.fn(),setRenderObjectFunction:vi.fn(),setRenderTarget:vi.fn(),render:vi.fn((value:THREE.Scene)=>{renders.push(value);})};
  /** One overlay frame at `now` milliseconds, after the scene's matrices. */
  const frame=(now=0)=>{scene.updateMatrixWorld(true);stage.renderHighlights(renderer,now);return stage.highlight.diagnostics as {tags:string[];targets:{id:string;tag:string;visible:boolean}[];opacity:number};};
  /** A page control as the stage builds it: a piece registered with its control. */
  const pageControl=(control:NativeControl,x=0,y=0)=>{
    const piece=art.createPiece({w:.5,h:.3,interactive:true,seed:7});piece.userData.nativeId=control.id;piece.setBaseTransform(x,y,.07);pageGroup.add(piece);
    for(const mesh of piece.userData.interactiveMeshes??[])stage.hits.set(mesh,{piece,control});
    return piece;
  };
  return {art,scene,camera,hudRoot,pageGroup,anchors,stage,renderer,renders,frame,pageControl,invalidate,close:()=>art.dispose()};
}

describe('surbrillance des commandes natives (Core UIHighlighter)',()=>{
  it('finds a tagged control, frames it and pulses as Core does',()=>{
    const f=stageFixture(),world=colony();
    const hud=new NativeHudCards(f.art,f.anchors,{selectPawn:vi.fn(),speed:vi.fn(),showPage:vi.fn()});
    try{
      hud.update(world,1,60);hud.setVisible(true);
      // Nothing is looked up nor drawn while no tag is active.
      expect(f.frame().targets).toEqual([]);expect(f.renderer.render).not.toHaveBeenCalled();
      f.stage.setHighlightTags(['time-controls']);f.stage.setHighlightTags(['time-controls']);
      expect(f.invalidate).toHaveBeenCalledTimes(1);
      const first=f.frame(0);
      expect(first.targets.map(t=>t.id).sort()).toEqual(['hud:speed:0','hud:speed:1','hud:speed:3','hud:speed:6']);
      expect(first.targets.every(t=>t.visible&&t.tag==='time-controls')).toBe(true);
      expect(f.renders).toEqual([f.stage.highlight.scene]);
      // Pulser.PulseBrightness(1.2, 0.7): 0.3 at rest, 1 half a period later.
      expect(HIGHLIGHT_PULSE_FREQUENCY).toBe(1.2);expect(HIGHLIGHT_PULSE_AMPLITUDE).toBe(.7);
      expect(first.opacity).toBeCloseTo(.3,6);
      expect(f.frame(1000/2.4).opacity).toBeCloseTo(1,6);
      expect(highlightPulse(1/1.2)).toBeCloseTo(.3,6);
      // One mesh, one draw: a frame of 48 vertices around each control.
      const mesh=f.stage.highlight.mesh as THREE.Mesh;
      expect(f.stage.highlight.scene.children).toEqual([mesh]);expect(mesh.geometry.drawRange.count).toBe(4*48);
      for(const id of ['hud:speed:0','hud:speed:1','hud:speed:3','hud:speed:6']){
        let piece:CardboardPiece|undefined;f.hudRoot.traverse(o=>{if(o.userData.nativeId===id)piece=o as CardboardPiece;});
        expect(frameCenters(mesh).some(center=>center.distanceTo(new THREE.Vector3().setFromMatrixPosition(piece!.matrixWorld))<.06),id).toBe(true);
      }
      // Reduced motion: a steady frame.
      f.stage.reducedMotion={matches:true};expect(f.frame(200).opacity).toBe(1);f.stage.reducedMotion={matches:false};

      // Real control ids from the native builders carry the Core tags.
      const state=uiState(world),actions=uiActions(()=>state),colonist=world.pawns[0]!;
      const ids=new Map<string,string>();
      const collect=(page:NativePage|null)=>{for(const control of page?controlsOf(page):[]){const tag=nativeHighlightTag(control.id);if(tag)ids.set(control.id,tag);}};
      collect(buildNativeToolPalette(state,actions,'zones'));collect(buildNativeToolPalette(state,actions,'orders'));
      collect(buildNativePanel({...state,panel:'architect',category:'furniture'},actions));
      collect(buildNativePanel({...state,panel:'assign'},actions));
      setNativeInspectorTab('bio');collect(buildNativeInspector({...state,selectedPawnIds:[colonist.id]},actions));
      for(const [id,tag] of [['tool-stockpile-select','tool:stockpile'],['tool-growing-select','tool:growing'],['tool-home-select','tool:home'],['zones-areas-open','zones:allowed-areas'],
        ['tool-mine-select','tool:mine'],['category-furniture','category:furniture'],['tool-sleeping-spot-select','tool:sleeping-spot'],
        [`assign-response-${colonist.id}`,'hostility-response'],['assign-manage-apparel','manage-outfits'],['assign-manage-drugs','manage-drug-policies'],
        ['draft-pawn','draft'],['pawn-tab-needs','inspector:needs']] as const)expect(ids.get(id),id).toBe(tag);

      // A page control is found through its registered control; an explicit
      // `highlight` (a future lesson) is honoured as well.
      const palette=buildNativeToolPalette(state,actions,'zones'),stockpile=controlsOf(palette).find(c=>c.id==='tool-stockpile-select')!;
      f.pageControl(stockpile,-1,0);f.pageControl({id:'lesson-next',label:'Suivant',highlight:'lesson:next',onActivate:()=>{}},1,0);
      f.stage.setHighlightTags(['tool:stockpile','lesson:next']);
      expect(f.frame().targets.map(t=>t.id).sort()).toEqual(['lesson-next','tool-stockpile-select']);

      // A "-Closed" tag (Core MainTab-Work-Closed) pulses only while its tab is closed.
      const tab=f.art.createManagementButton(1,MANAGEMENT_BUTTONS[1]!,()=>{});tab.userData.nativeId='tab:work';f.anchors.bottomRight.add(tab);
      expect(highlightOnlyWhileClosed('tab:work')).toBe(true);expect(highlightOnlyWhileClosed('tool:mine')).toBe(false);
      f.stage.setHighlightTags(['tab:work']);expect(f.frame().targets).toEqual([{id:'tab:work',tag:'tab:work',visible:true}]);
      tab.setActive(true);f.renders.length=0;
      expect(f.frame().targets).toEqual([{id:'tab:work',tag:'tab:work',visible:false}]);expect(f.renders).toEqual([]);
      tab.setActive(false);

      // A modal page covers the HUD controls, never its own.
      f.stage.setHighlightTags(['time-controls','tool:stockpile']);
      f.stage.page={id:'modal',title:'Fenêtre',rows:[],modal:true};f.stage.pageBox={x:0,y:0,width:1440,height:900};
      const covered=f.frame().targets;
      expect(covered.filter(t=>t.visible).map(t=>t.id)).toEqual(['tool-stockpile-select']);
      expect(covered.filter(t=>t.tag==='time-controls').every(t=>!t.visible)).toBe(true);
      f.stage.page=null;f.stage.pageBox=undefined;
      // A hidden HUD hides its frames.
      hud.setVisible(false);expect(f.frame().targets.filter(t=>t.tag==='time-controls').every(t=>!t.visible)).toBe(true);
    }finally{hud.dispose();f.close();}
  });

  it('looks controls up only when tags or pieces change, never on every frame',()=>{
    const f=stageFixture();
    try{
      const visit=vi.spyOn(f.stage,'visitHighlightCandidates');
      f.pageControl({id:'tool-mine-select',label:'Miner',onActivate:()=>{}});
      for(let i=0;i<5;i++)f.frame(i*16);
      expect(visit).not.toHaveBeenCalled();
      f.stage.setHighlightTags(['tool:mine']);
      for(let i=0;i<10;i++)f.frame(i*16);
      expect(visit).toHaveBeenCalledTimes(1);
      // The pulse is a uniform: the vertices are written once while nothing moves.
      expect(f.stage.highlight.diagnostics.uploads).toBe(1);
      // A repaint or a move is not a new piece; a created piece is.
      const piece=f.pageControl({id:'tool-chop-select',label:'Abattre',onActivate:()=>{}});piece.redraw();piece.setBaseTransform(.3,.2,.07);
      f.frame(200);expect(visit).toHaveBeenCalledTimes(2);
      f.frame(216);expect(visit).toHaveBeenCalledTimes(2);
      // A highlighted control that moves (a hover pose) has its frame rewritten.
      const uploads=f.stage.highlight.diagnostics.uploads,mine=f.pageGroup.children[0]!;
      f.frame(220);expect(f.stage.highlight.diagnostics.uploads).toBe(uploads);
      mine.position.x+=.1;f.frame(224);expect(f.stage.highlight.diagnostics.uploads).toBe(uploads+1);
      // A page rebuild rebinds controls: one lookup at the next frame, and the
      // same controls keep their written frames.
      const written=f.stage.highlight.diagnostics.uploads;
      f.stage.highlight.invalidate();f.frame(232);f.frame(248);expect(visit).toHaveBeenCalledTimes(3);
      expect(f.stage.highlight.diagnostics.uploads).toBe(written);
      f.stage.setHighlightTags([]);f.renders.length=0;f.frame(264);
      expect(visit).toHaveBeenCalledTimes(3);expect(f.renders).toEqual([]);expect(f.stage.highlight.mesh.visible).toBe(false);
    }finally{f.close();}
  });

  it('starts with the notion shown in the advice card and stops once learned, folded or closed',()=>{
    const f=stageFixture(),world=colony(),storage=new Map<string,string>();
    const h=createLearningHelper({concepts:LEARNING_CONCEPTS,read:()=>storage.get(LEARNING_HELPER_STORAGE_KEY)??null,write:value=>{storage.set(LEARNING_HELPER_STORAGE_KEY,value);}});
    const root=new THREE.Group(),anchors={topLeft:new THREE.Group(),topRight:new THREE.Group()};root.add(anchors.topLeft,anchors.topRight);
    const session=createGuidanceCardSession();
    // main.ts syncNativeHighlights: the tags of the notions painted on the card.
    const highlights=()=>learningHighlightTags(guidance.card.shownConcepts,id=>h.concept(id)?.highlightTags);
    const guidance=createNativeGuidance(f.art,anchors,{session,learning:()=>undefined,world:()=>world,blocked:()=>false,sections:()=>[],now:()=>0,openHelp:()=>{},guide:()=>{},
      concepts:()=>h.shown,markConcept:id=>h.markLearned(id),afterSync:()=>f.stage.setHighlightTags(highlights())});
    guidance.card.setViewport(1440,1000,.01,820);guidance.card.setHudVisible(true);
    const find=(id:string):CardboardPiece|undefined=>{let found:CardboardPiece|undefined;root.traverse(object=>{if(object.userData.nativeId===id)found=object as CardboardPiece;});return found;};
    try{
      const state=uiState(world,{selectedPawnIds:[world.pawns[0]!.id]}),actions=uiActions(()=>state);
      setNativeInspectorTab('bio');
      const draft=controlsOf(buildNativeInspector(state,actions)!).find(c=>c.id==='draft-pawn')!;
      expect(draft).toBeDefined();f.pageControl(draft);
      session.loadedColony();guidance.sync();
      expect(guidance.card.shownConcepts).toEqual([]);expect(f.stage.highlight.active).toBe(false);
      // Core Drafting (highlightTags Draft): a raid opens the notion.
      h.teachOpportunity('drafting','critical');session.attention();guidance.sync();
      expect(guidance.card.shownConcepts).toEqual(['drafting']);expect(highlights()).toEqual(['draft']);
      expect(f.frame().targets).toEqual([{id:'draft-pawn',tag:'draft',visible:true}]);
      // Folded to its tab or closed, the card no longer shows the text: no pulse.
      find('hud:guidance:collapse')!.userData.onClick?.();
      expect(guidance.card.shownConcepts).toEqual([]);expect(f.stage.highlight.active).toBe(false);expect(f.frame().targets).toEqual([]);
      find('hud:guidance:tab')!.userData.onClick?.();expect(f.stage.highlight.activeTags).toEqual(['draft']);
      // A second notion adds its own tags (Core Stockpiles).
      h.teachOpportunity('stockpiles','critical');guidance.sync(true);
      expect(f.stage.highlight.activeTags).toEqual(['draft','tool:stockpile','tools:zones']);
      find('hud:guidance:close')!.userData.onClick?.();expect(f.stage.highlight.active).toBe(false);
      session.reopen();guidance.sync(true);expect(f.stage.highlight.activeTags).toEqual(['draft','tool:stockpile','tools:zones']);
      // Compris marks it learned: its controls stop pulsing at once.
      find('hud:guidance:concept:drafting:learned')!.userData.onClick?.();
      expect(h.isComplete('drafting')).toBe(true);expect(f.stage.highlight.activeTags).toEqual(['tool:stockpile','tools:zones']);
      expect(f.frame().targets).toEqual([]);
      // Learned by playing (a stockpile drawn): the notion leaves the card.
      h.demonstrate('stockpiles','total');guidance.sync(true);expect(f.stage.highlight.active).toBe(false);
      // Helper switched off: nothing is shown, nothing pulses.
      h.reset();h.teachOpportunity('drafting','critical');guidance.sync(true);expect(f.stage.highlight.activeTags).toEqual(['draft']);
      h.setEnabled(false);guidance.sync(true);expect(f.stage.highlight.active).toBe(false);
      // The game wires the same expression after every card update.
      const main=readFileSync(new URL('../src/main.ts',import.meta.url),'utf8');
      expect(main).toContain('learningHighlightTags(nativeGuidance.shownConcepts,id=>helper.concept(id)?.highlightTags)');
      expect(main).toMatch(/afterSync:\(\)=>\{[^}]*syncNativeHighlights\(\);\}/);
    }finally{guidance.card.dispose();f.close();}
  });

  it('gives each notion the tags Core gives its concept, mapped to real controls',()=>{
    // Data/Core/Defs/Tutor/Concepts_*.xml: concepts with highlightTags.
    const coreTagged=new Set(['ReformCaravan','Drafting','BuildOrbitalTradeBeacon','BillsTab','DrugAddiction','DrugPolicies','PrisonerTab','Shelves','Books',
      'TimeControls','Pause','Stockpiles','Forbidding','GrowingFood','Alerts','Mining','WorkTab','ForbiddingDoors','FormCaravan','AnimalTaming','AnimalTraining',
      'InfoCard','StorageTab','HomeArea','HostilityResponse','AllowedAreas','TimeAssignments','Outfits','HistoryTab']);
    for(const concept of LEARNING_CONCEPTS){
      if(concept.group==='modal'){expect(concept.highlightTags,concept.id).toBeUndefined();continue;}
      if(concept.core==='Elsewhere'){expect(concept.highlightTags?.length,concept.id).toBeGreaterThan(0);continue;}
      expect((concept.highlightTags?.length??0)>0,concept.id).toBe(coreTagged.has(concept.core));
    }
    // Every tag a notion names is carried by an existing control id.
    const ids=['tab:world','group-formation-open','draft-pawn','tab:architect','category-production','tool-orbital-beacon-select','station-bills','pawn-tab-needs','tab:assign',
      'assign-manage-drugs','pawn-tab-prisoner','tool-shelf-select','assign-reading-7','hud:speed:0','map-dock:zones','tool-stockpile-select','object-action-material-permission',
      'category-furniture','tool-sleeping-spot-select','tool-bed-select','tool-growing-select','hud:alert:downed','map-dock:orders','tool-mine-select','tab:research','tab:work',
      'door-forbidden','tab:wildlife','wildlife-12-tame','train-haul','primary-information','stockpile-settings','tool-home-select','assign-response-3','zones-areas-open',
      'tab:schedule','assign-manage-apparel','tab:history'];
    const carried=new Set(ids.map(id=>nativeHighlightTag(id)));
    for(const concept of LEARNING_CONCEPTS)for(const tag of concept.highlightTags??[])expect(carried.has(tag),`${concept.id} ${tag}`).toBe(true);
    expect(nativeHighlightTag('hud:clock')).toBeUndefined();expect(nativeHighlightTag('tool-mine-select')).toBe('tool:mine');
    expect(learningHighlightTags(['time-controls','pause','alerts'],id=>LEARNING_CONCEPTS.find(c=>c.id===id)?.highlightTags)).toEqual(['alerts','time-controls']);
  });

  it('outlines a map rectangle in the render layer, then removes it',()=>{
    const layer=new MapOutlineLayer();
    try{
      expect(layer.mesh.visible).toBe(false);expect(layer.rectangle).toBeUndefined();
      layer.show({x:2,z:3,width:4,height:2},10,10);
      expect(layer.mesh.visible).toBe(true);expect(layer.rectangle).toEqual({x:2,z:3,width:4,height:2});
      expect(layer.mesh.geometry.drawRange.count).toBe(24);
      const box=new THREE.Box3().setFromBufferAttribute(layer.mesh.geometry.getAttribute('position') as THREE.BufferAttribute);
      expect([box.min.x,box.max.x,box.min.z,box.max.z]).toEqual([1.5,5.5,2.5,4.5]);
      // Clamped to the map; an empty rectangle hides it.
      layer.show({x:8,z:-3,width:6,height:5},10,10);expect(layer.rectangle).toEqual({x:8,z:0,width:2,height:2});
      layer.show({x:12,z:3,width:2,height:2},10,10);expect(layer.mesh.visible).toBe(false);expect(layer.rectangle).toBeUndefined();
      layer.show({x:0,z:0,width:3,height:3},10,10);layer.hide();
      expect(layer.mesh.visible).toBe(false);expect(layer.rectangle).toBeUndefined();expect(layer.mesh.geometry.drawRange.count).toBe(0);
    }finally{layer.dispose();}
    // The renderer's own entry point, on the shown map.
    const world=colony(),outline=new MapOutlineLayer();
    const core=Object.assign(Object.create(SceneRenderCore.prototype),{world,mapOutline:outline}) as SceneRenderCore&{mapOutline:MapOutlineLayer};
    try{
      core.setMapOutline({x:4,z:5,width:6,height:6});expect(core.mapOutlineRect).toEqual({x:4,z:5,width:6,height:6});expect(outline.mesh.visible).toBe(true);
      core.setMapOutline(null);expect(core.mapOutlineRect).toBeUndefined();expect(outline.mesh.visible).toBe(false);
    }finally{outline.dispose();}
  });

  it('never writes the World',()=>{
    const f=stageFixture(),world=colony(),before=serializeWorld(world);
    const hud=new NativeHudCards(f.art,f.anchors,{selectPawn:vi.fn(),speed:vi.fn(),showPage:vi.fn()});
    const outline=new MapOutlineLayer(),core=Object.assign(Object.create(SceneRenderCore.prototype),{world,mapOutline:outline}) as SceneRenderCore;
    try{
      const state=uiState(world),actions=uiActions(()=>state);
      hud.update(world,1,60);hud.setVisible(true);
      const palette=buildNativeToolPalette(state,actions,'zones');for(const control of controlsOf(palette))f.pageControl(control);
      f.stage.setHighlightTags(['time-controls','tool:stockpile','tool:growing','tools:zones']);
      for(let i=0;i<20;i++)f.frame(i*16);
      core.setMapOutline({x:1,z:1,width:5,height:5});core.setMapOutline(null);
      f.stage.setHighlightTags([]);f.frame(400);
      expect(serializeWorld(world)).toBe(before);expect(actions.command).not.toHaveBeenCalled();
    }finally{hud.dispose();outline.dispose();f.close();}
  });
});
