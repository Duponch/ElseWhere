/** Metadata/measurement boundary only. Real Core/Layer prototype methods and
 * the public collector run; tiny meshes stand for owners, never53 baked models,
 * atlas pixels, an admitted World, a renderer/device or a gameplay scene. */
import {afterEach,expect,test,vi} from 'vitest';
import {BufferAttribute,Group,InstancedBufferGeometry,Mesh,MeshStandardNodeMaterial,OrthographicCamera,Vector3} from 'three/webgpu';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {ResourceLayer} from '../src/render/ResourceLayer';
import {WildlifeLayer,animalGraphicsComparisonState} from '../src/render/WildlifeLayer';
import {ResourceTargetTint} from '../src/render/resource-target-tint';
import {ANIMAL_SPECIES_IDS} from '../src/sim/animal-species';
import {DEFAULT_GRAPHICS_STYLE_PREFERENCES} from '../src/ui3d/native-preferences';
import {createGraphicsStyleComparison,graphicsStyleComparisonsShareScene,type GraphicsComparisonMetadata,type GraphicsStyleComparisonContext} from '../src/render/graphics-style-comparison';

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();});
const countValues=(value:unknown):number=>1+(Array.isArray(value)?value.reduce((n:number,v:unknown)=>n+countValues(v),0):value&&typeof value==='object'?Object.values(value).reduce<number>((n,v)=>n+countValues(v),0):0);

function catalogFixture(){
  vi.useFakeTimers();let now=0;
  const materials:MeshStandardNodeMaterial[]=[],geometries:InstancedBufferGeometry[]=[];
  const material=()=>{const m=new MeshStandardNodeMaterial();materials.push(m);return m;},geometry=()=>{const g=new InstancedBufferGeometry();geometries.push(g);return g;};
  const source=material();
  const rows=ANIMAL_SPECIES_IDS.map(species=>{
    const g=geometry(),m=material();m.userData.origamiBakedBloodFree=true;
    const row={species,mesh:new Mesh(g,m),binding:{geometry:g,material:m},textures:true,blood:false,ribbons:false,
      graphicsComparisonState(active:boolean){return animalGraphicsComparisonState(this.species,this.mesh,active,this.textures,this.blood,source,this.ribbons,this.binding);}};
    return row;
  });
  const wildlife=Object.assign(Object.create(WildlifeLayer.prototype),{rigs:rows,activeRigs:[...rows],bakedEligible:true,bakedGeneration:7,bakedPending:false,bakedClosed:false}) as WildlifeLayer;
  const fullWildlife=vi.spyOn(wildlife,'bakedStatus').mockImplementation(()=>{throw Error('Detailed Native status must not be built for a measurement frame');});
  const catalog={revision:3,assertCurrent:vi.fn()},family={normal:material(),preview:material(),plain:material()};
  const resourceGeometry=geometry();resourceGeometry.setAttribute('color',new BufferAttribute(new Float32Array([1,1,1,1,1,1,1,1,1]),3));
  const resourceMesh=new Mesh(resourceGeometry,family.normal),resourceGroup=new Group();resourceGroup.add(resourceMesh);resourceMesh.userData.resourceRanges={ranges:[{id:1001,start:0,count:3,vertexStart:0,vertexCount:3}]};
  const chunks=new Map([['0:0',{group:resourceGroup}]]),census=vi.spyOn(chunks,'values');
  const resources=Object.assign(Object.create(ResourceLayer.prototype),{treeRecipeEpoch:4,treeDemandEpoch:2,graphicsComparisonRevision:8,treeSpeciesKey:'["oak","poplar"]',treeCatalog:catalog,treeFamily:family,texturesEnabled:true,foliageVisible:true,chunks,targetPreviewIds:new Set<number>(),targetTint:new ResourceTargetTint(),resourceChunks:new Map([[1001,'0:0']]),preparedTreeMeshes:new WeakSet([resourceMesh])}) as ResourceLayer;
  const fullTrees=vi.spyOn(resources,'bakedTreeStatus').mockImplementation(()=>{throw Error('Detailed tree census must remain outside the comparator');});
  const camera=new OrthographicCamera(-16,16,16,-16,.1,1000);camera.position.set(20,25,20);
  const core=Object.assign(Object.create(SceneRenderCore.prototype),{
    // measureGraphicsStyle only checks the presence of this marker. No World is
    // passed to setWorld, admitted to Core, read by simulation or rendered.
    world:{},received:{speed:0},disposed:false,fatalError:undefined,preparing:false,presentationStopped:false,
    graphicsStyle:{preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style:'origami',impasto:0,wear:0}},
    wildlife,resources,rig:{mode:'orthographic',span:32,camera,controls:{target:new Vector3(0,0,0)}},
    viewportWidth:1280,viewportHeight:900,backend:'WebGPU',renderer:{getPixelRatio:()=>1},
    texturesEnabled:true,grassVisible:true,roomEnabled:true,dioramaEnabled:false,
    lightingSettings:{sun:1,moon:1,ambient:1},shadowSettings:{frequency:60,resolution:2048},animationDetail:{settings:{enabled:true,nearPixels:24,farPixels:8,middleHz:12}},
    hostPort:{now:()=>now,hidden:()=>false,pixelRatio:()=>1,viewport:()=>({width:1280,height:900}),backend:()=> 'WebGPU'},
  }) as SceneRenderCore;
  return{core,wildlife,resources,catalog,family,rows,source,material,geometry,fullWildlife,fullTrees,census,
    async measure(mutate:()=>void=()=>{}){now=0;const result=core.measureGraphicsStyle('same-confirmed-scene',{scope:'paused-colony',ui:'game-hud',tool:'select',selectionKey:'1,2',objectKey:'[]'},()=>true);void result.catch(()=>{});mutate();now=6000;await vi.advanceTimersByTimeAsync(6000);return result;},
    dispose(){for(const g of geometries)g.dispose();for(const m of materials)m.dispose();},
  };
}

test('the public Core measurement admits53 compact owners and cancels exact render-state changes without rebuilding Native diagnostics or a tree census',async()=>{
  const f=catalogFixture();
  try{
    expect(f.rows).toHaveLength(53);
    const result=await f.measure();
    expect(result).toMatchObject({status:'incomplete',reason:'insufficient-frames'}); // no rendered samples in this contract
    expect(countValues(result.context)).toBeLessThanOrEqual(1024);expect(JSON.stringify(result.context).length).toBeLessThanOrEqual(16384);
    const state=result.context.settings.origamiBaked as {animals:{rigs:readonly (readonly[string,string,string,number])[]};trees:{catalogRevision:number}};
    expect(state.animals.rigs).toHaveLength(53);expect(state.animals.rigs[0]).toEqual([f.rows[0]!.species,f.rows[0]!.mesh.geometry.uuid,f.rows[0]!.mesh.material.uuid,1|2|4|16|32|256]);
    expect(state.trees.catalogRevision).toBe(3);expect(state).not.toHaveProperty('cache');expect(state.animals.rigs[0]).not.toHaveProperty('atlas');
    const first=f.rows[0]!;
    const mutations:[string,()=>()=>void][]=[
      ['textures',()=>{const old=first.textures;first.textures=false;return()=>{first.textures=old;};}],
      ['clinical/source branch',()=>{const old={blood:first.blood,ribbons:first.ribbons,material:first.mesh.material};first.blood=true;first.ribbons=true;first.mesh.material=f.source;return()=>{first.blood=old.blood;first.ribbons=old.ribbons;first.mesh.material=old.material;};}],
      ['same-state geometry owner',()=>{const old=first.mesh.geometry,next=f.geometry();first.mesh.geometry=first.binding.geometry=next;return()=>{first.mesh.geometry=first.binding.geometry=old;};}],
      ['same-state material owner',()=>{const old=first.mesh.material,next=f.material();next.userData.origamiBakedBloodFree=true;first.mesh.material=first.binding.material=next;return()=>{first.mesh.material=first.binding.material=old;};}],
      ['animal generation',()=>{const old=Reflect.get(f.wildlife,'bakedGeneration');Reflect.set(f.wildlife,'bakedGeneration',old+1);return()=>{Reflect.set(f.wildlife,'bakedGeneration',old);};}],
      ['active cohort',()=>{Reflect.set(f.wildlife,'activeRigs',f.rows.slice(1));return()=>{Reflect.set(f.wildlife,'activeRigs',[...f.rows]);};}],
      ['tree publication',()=>{const old=Reflect.get(f.resources,'treeRecipeEpoch');Reflect.set(f.resources,'treeRecipeEpoch',old+1);return()=>{Reflect.set(f.resources,'treeRecipeEpoch',old);};}],
      ['tree catalog revision',()=>{f.catalog.revision++;return()=>{f.catalog.revision--;};}],
      ['resource geometry revision',()=>{const old=Reflect.get(f.resources,'graphicsComparisonRevision');Reflect.set(f.resources,'graphicsComparisonRevision',old+1);return()=>{Reflect.set(f.resources,'graphicsComparisonRevision',old);};}],
    ];
    for(const[name,mutate]of mutations){let restore=()=>{};try{const measured=await f.measure(()=>{restore=mutate();});expect(measured,name).toMatchObject({status:'cancelled',reason:'context-changed'});}finally{restore();}}
    expect(f.census).not.toHaveBeenCalled();
    const preview=await f.measure(()=>{f.resources.setTargetPreview(new Set([1001]));});expect(preview).toMatchObject({status:'cancelled',reason:'context-changed'});
    const previewRevision=f.resources.graphicsComparisonMetadata().revision;f.resources.setTargetPreview(new Set([1001]));expect(f.resources.graphicsComparisonMetadata().revision).toBe(previewRevision); // same preview is not a writer
    expect(f.census).not.toHaveBeenCalled();
    const cleared=await f.measure(()=>{f.resources.clearTargetPreview();});expect(cleared).toMatchObject({status:'cancelled',reason:'context-changed'});expect(f.census).toHaveBeenCalledTimes(1); // only the existing clear-preview writer visits chunks
    const clearedRevision=f.resources.graphicsComparisonMetadata().revision;f.resources.clearTargetPreview();expect(f.resources.graphicsComparisonMetadata().revision).toBe(clearedRevision);
    expect(f.fullWildlife).not.toHaveBeenCalled();expect(f.fullTrees).not.toHaveBeenCalled();expect(f.catalog.assertCurrent).toHaveBeenCalled();
  }finally{f.core.cancelGraphicsMeasurement('test-cleanup');f.dispose();}
});

function pairContext(style:'default'|'origami'):GraphicsStyleComparisonContext {
  return{preferences:{...DEFAULT_GRAPHICS_STYLE_PREFERENCES,style,...style==='origami'?{impasto:0,wear:0}:{}},sceneFingerprint:'world-owner:7/revision:12',camera:{position:[3,4,5],target:[0,0,0],projection:[1,0,0,1],zoom:1},viewport:{width:1280,height:900,pixelRatio:1},backend:'WebGPU',settings:{requested:{scope:'paused-colony',ui:'game-hud',tool:'select',selectionKey:'1,2',objectKey:'[]'},origamiBaked:style==='origami'?{generation:4,rigs:[['deer','geometry-A','material-A',55]],treeRevision:3}:{generation:0,rigs:[],treeRevision:null},renderer:{textures:true,lighting:{sun:1},shadows:{frequency:60,resolution:2048},animations:{enabled:true}}}};
}
test('pair reporting excludes only cross-style preferences/binding identity while the collector and every shared scene parameter remain strict',()=>{
  const origami=pairContext('origami'),legacy=pairContext('default');
  const complete=(context:GraphicsStyleComparisonContext)=>{const run=createGraphicsStyleComparison(context,0);run.sample({nowMs:1000,context,visible:true,drawCalls:1,triangles:1});run.sample({nowMs:1020,context,visible:true,drawCalls:1,triangles:1});return run.finish(6000,context,true);};
  const a=complete(origami),b=complete(legacy);expect(a.status).toBe('complete');expect(b.status).toBe('complete');expect(graphicsStyleComparisonsShareScene(a.context,b.context)).toBe(true);
  const intra=createGraphicsStyleComparison(origami,0);expect(intra.sample({nowMs:1000,context:legacy,visible:true,drawCalls:1,triangles:1})).toMatchObject({status:'cancelled',reason:'context-changed'});
  const mutations:((value:GraphicsStyleComparisonContext)=>void)[]=[
    value=>{value.sceneFingerprint='other-confirmed-world';},value=>{value.camera={...value.camera,target:[0,0,1]};},value=>{value.viewport.pixelRatio=2;},value=>{value.backend='WebGL';},
    value=>{value.settings={...value.settings,requested:{scope:'different',ui:'game-hud'}};},
    ...['tool','selectionKey','objectKey'].map(key=>(value:GraphicsStyleComparisonContext)=>{const requested=value.settings.requested as Record<string,GraphicsComparisonMetadata>;value.settings={...value.settings,requested:{...requested,[key]:'different'}};}),
    ...['textures','lighting','shadows','animations'].map(key=>(value:GraphicsStyleComparisonContext)=>{const renderer=value.settings.renderer as Record<string,GraphicsComparisonMetadata>;value.settings={...value.settings,renderer:{...renderer,[key]:key==='textures'?false:{changed:true}}};}),
  ];
  for(const mutate of mutations){const changed=structuredClone(legacy);mutate(changed);expect(graphicsStyleComparisonsShareScene(origami,changed)).toBe(false);}
  const sameStyle=structuredClone(origami);sameStyle.preferences.edgeWidth=2;expect(graphicsStyleComparisonsShareScene(origami,sameStyle)).toBe(false);
  const oversized=structuredClone(origami);oversized.settings={...oversized.settings,origamiBaked:Array.from({length:1024},()=>0)};expect(()=>createGraphicsStyleComparison(oversized,0)).toThrow('Comparison context is too large');expect(graphicsStyleComparisonsShareScene(oversized,legacy)).toBe(false);
  const long=structuredClone(origami);long.settings={...long.settings,origamiBaked:'x'.repeat(16385)};expect(()=>createGraphicsStyleComparison(long,0)).toThrow('Comparison context is too large');expect(graphicsStyleComparisonsShareScene(long,legacy)).toBe(false);
});
