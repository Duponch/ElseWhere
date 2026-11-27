import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {SnapshotEncoder} from '../src/bridge/snapshots';
import {PresentationSnapshotDecoder} from '../src/bridge/presentation-decoder';
import {createWorld} from '../src/sim/engine';
import type {World,StockpileCell} from '../src/sim/types';
import type {MapObjectSelection} from '../src/ui/map-object-selection';
import {createClosedMainMapIntentReader} from '../src/render/closed-main-map-intents';
import {confirmedZoneSelectionCells,type ConfirmedIntentFields} from '../src/render/confirmed-intent-fields';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import {GrowingZoneLayer} from '../src/render/GrowingZoneLayer';
import {AllowedAreaLayer} from '../src/render/AllowedAreaLayer';
import {RoofLayer} from '../src/render/RoofLayer';
import {GroundSurfaceTint} from '../src/render/GroundSurfaceTint';
import {zoneBoundaryVertices} from '../src/render/zone-surface-presentation';
import type {Placement} from '../src/render/primitives';

const cell=(world:World,i:number)=>({x:i%world.width,z:Math.floor(i/world.width)});
const storage=(world:World,i:number,id=world.nextId++,zoneId=id):StockpileCell=>({id,zoneId,...cell(world,i),capacity:75,priority:2,filters:{wood:true,food:true}});

test('real same-tick admission cannot mistake the old tail of a home group for its new shorter list',()=>{
  const source=createWorld(426,16,16),encoder=new SnapshotEncoder(),decoder=new PresentationSnapshotDecoder(),reader=createClosedMainMapIntentReader();
  source.stockpiles=[];source.home=[0,1,2,3,42,43,44];
  const send=()=>{const result=decoder.adopt(structuredClone(encoder.encode(source,0,1)));expect(result.status).toBe('applied');if(result.status!=='applied')throw Error('Real admission refused');return result.world;};
  const first=send(),before=reader.admit!(first);
  // A new storage cell inserts exactly four primitive words before home.
  // The old absolute-offset comparison saw [3,42,43,44] already at the
  // shifted offset and incorrectly retained [0,1,2,3,42,43,44].
  source.stockpiles=[storage(source,68)];source.home=[42,43,44];
  const next=send(),after=reader.admit!(next);
  expect(next.tick).toBe(first.tick);expect(before.home).toEqual([0,1,2,3,42,43,44]);expect(after.home).toBe(next.home);
  expect(after.stockpiles).toBe(next.stockpiles);
  for(const key of ['jobs','growingZones','snowClearArea','allowedAreas','plans369','roofBuild','roofRemove','routes'] as const)expect(after[key],key).toBe(before[key]);
});

test('every visual group is independent of upstream length changes, including plans, and the public witness cannot advance the projection',()=>{
  const world=createWorld(426,16,16),reader=createClosedMainMapIntentReader();
  world.home=[18,19];world.snowClearArea=[20,21];world.stockpiles=[storage(world,68)];
  world.growingZones=[{id:world.nextId++,cells:[70,71],plant:'rice',allowSow:true,allowCut:true}];
  world.allowedAreas=[{id:world.nextId++,label:'A',color:0x123456,cells:[72]}];
  world.roofing={constructed:[],build:[74],remove:[76],cursor:0};world.plans369={nextId:2,plans:[{id:1,n:1,color:'red',cells:[78]}]};
  let facts=reader.admit!(world),current=world;
  const stable=reader.admit!(structuredClone(current));expect(stable).toBe(facts);
  const change=(edit:(w:World)=>void,changed:readonly (keyof ConfirmedIntentFields)[])=>{
    const next=structuredClone(current);edit(next);const prior=facts;facts=reader.admit!(next);
    for(const key of ['jobs','growingZones','stockpiles','home','snowClearArea','allowedAreas','plans369','roofBuild','roofRemove','routes'] as const){
      if(!changed.includes(key))expect(facts[key],key).toBe(prior[key]);
    }
    expect(facts.growingZones).toEqual(next.growingZones);expect(facts.stockpiles).toEqual(next.stockpiles);expect(facts.home).toEqual(next.home);
    expect(facts.snowClearArea).toEqual(next.snowClearArea);expect(facts.allowedAreas).toEqual(next.allowedAreas);expect(facts.plans369).toEqual(next.plans369);
    expect(facts.roofBuild).toEqual(next.roofing?.build??[]);expect(facts.roofRemove).toEqual(next.roofing?.remove??[]);
    current=next;
  };
  change(w=>{w.growingZones[0]!.cells=[70,71,86];w.stockpiles.push(storage(w,69));w.home=[22];w.snowClearArea=[21,23];w.roofing!.build=[74,75];w.roofing!.remove=[];w.allowedAreas![0]!.cells=[73];w.plans369!.plans[0]!.cells=[78,79];},['growingZones','stockpiles','home','snowClearArea','roofBuild','roofRemove','allowedAreas','plans369']);
  change(w=>{w.plans369!.plans[0]!.color='green';w.plans369!.plans[0]!.hidden=true;},['plans369']);
  change(w=>{delete w.plans369;},['plans369']);
  const next=structuredClone(current);next.home=[24,25];reader.read(next);
  expect(reader.admit!(next).home).toBe(next.home);
});

function sceneFixture(){
  const played=createWorld(426,16,16);
  for(const i of [18,19,20,21,22,23,68,69,70,71,72,73,74,75,76,77,78,79,86])played.tiles[i]={terrain:'soil'};
  played.home=[18];played.snowClearArea=[19];played.stockpiles=[storage(played,68)];
  played.growingZones=[{id:played.nextId++,cells:[70],plant:'rice',allowSow:true,allowCut:true}];
  const area=played.nextId++;played.allowedAreas=[{id:area,label:'A',color:0x123456,cells:[72]}];
  played.roofing={constructed:[],build:[74],remove:[76],cursor:0};played.plans369={nextId:2,plans:[{id:1,n:1,color:'red',cells:[78]}]};
  const reader=createClosedMainMapIntentReader(),boxes=new BoxBatches(),storageGroup=new THREE.Group(),growing=new GrowingZoneLayer(boxes),allowedAreaLayer=new AllowedAreaLayer(boxes),roofs=new RoofLayer(),surfaceTint=new GroundSurfaceTint();
  const objectSelection=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicNodeMaterial({color:0xfff5d6}));objectSelection.visible=false;
  const scene=Object.assign(Object.create(SceneRenderCore.prototype),{
    world:played,tool:'home',boxes,storageGroup,growing,allowedAreaLayer,allowedAreaTarget:area,roofs,surfaceTint,
    confirmedIntentsDirty:true,confirmedSurfaceDirty:false,confirmedPathDirty:false,confirmedDesignationsDirty:false,
    confirmedJobMarkers:{updateIntentions:vi.fn(),present:vi.fn()},jobGroup:new THREE.Group(),constructionGhosts:{},designations:{update:vi.fn()},pawns:{},selectedPawns:new Set(),
    storageTintPlacements:[],homeTintPlacements:[],planTintPlacements369:[],zonesTintDirty:true,zonesVisible:true,roofAreasVisible:true,preparing:false,
    objectSelection,selectedObjects:[],objectSelectionSignature:'',objectTintSurfaces:[],turretTintSurfaces:[],groundOverlayInputs:[],turretPreviewVisible:false,
    recreationHints:{group:{visible:false},surfaces:[]},deepResources:{mesh:{visible:false},surfaces:[]},constructionPreview:{surfaces:[]},
  }) as {world:World;tool:string;confirmedIntents:ConfirmedIntentFields;confirmedIntentsDirty:boolean;confirmedSurfaceDirty:boolean;zonesVisible:boolean;zonesTintDirty:boolean;selectedObjects:MapObjectSelection[];selectedObject?:MapObjectSelection;homeTintPlacements:Placement[];presentConfirmedIntents():void;updateSelectedObject():void;buildStorage(world:World,storage?:boolean,area?:boolean):void;refreshZonesTint():void};
  const admit=(latest:World)=>{scene.confirmedIntents=reader.admit!(latest);scene.confirmedIntentsDirty=true;scene.presentConfirmedIntents();};
  admit(played);
  const alpha=(i:number)=>(surfaceTint.zones.image.data as Float32Array)[i*4+3]!,edges=(i:number)=>Array.from((surfaceTint.edges.image.data as Uint8Array).slice(i*4,i*4+4));
  const mesh=(name:string)=>storageGroup.getObjectByName(name) as BoxMesh;
  const select=(selected:MapObjectSelection)=>{scene.selectedObjects=[selected];scene.selectedObject=selected;scene.updateSelectedObject();};
  const dispose=()=>{surfaceTint.dispose();objectSelection.geometry.dispose();objectSelection.material.dispose();roofs.dispose();boxes.dispose();};
  return {played,scene,admit,alpha,edges,mesh,growing,allowedAreaLayer,roofs,surfaceTint,objectSelection,select,dispose};
}

test('an open home or snow tool refreshes fill and actual resident mesh from confirmations, without touching storage or a stable frame',()=>{
  const f=sceneFixture();try{
    expect(f.alpha(18)).toBeCloseTo(.28);const stock=f.mesh('storage-cells'),version=stock.instanceMatrix.version,home=f.mesh('storage-home');
    const next=structuredClone(f.played);next.home=[20,21];f.admit(next);
    expect(f.scene.world).toBe(f.played);expect(f.scene.tool).toBe('home');expect(f.alpha(18)).toBe(0);expect(f.alpha(20)).toBeCloseTo(.28);expect(f.alpha(21)).toBeCloseTo(.28);
    expect(home.geometry.instanceCount).toBe(2);expect(f.mesh('storage-cells')).toBe(stock);expect(stock.instanceMatrix.version).toBe(version);
    const zonesVersion=f.surfaceTint.zones.version;f.scene.presentConfirmedIntents();f.admit(structuredClone(next));expect(f.surfaceTint.zones.version).toBe(zonesVersion);expect(stock.instanceMatrix.version).toBe(version);
    // The player chooses the snow tool once; subsequent edits do not toggle it.
    f.scene.tool='snow-clear';f.scene.buildStorage(f.played,false,true);f.scene.refreshZonesTint();expect(f.alpha(20)).toBe(0);expect(f.alpha(19)).toBeCloseTo(.28);
    const snow=structuredClone(next);snow.snowClearArea=[22,23];f.admit(snow);expect(f.alpha(19)).toBe(0);expect(f.alpha(22)).toBeCloseTo(.28);expect(f.alpha(23)).toBeCloseTo(.28);expect(stock.instanceMatrix.version).toBe(version);
    const removed=structuredClone(snow);delete removed.snowClearArea;f.admit(removed);expect(f.alpha(22)).toBe(0);expect(home.geometry.instanceCount).toBe(0);
  }finally{f.dispose();}
});

test('confirmed storage, growing, allowed, roof and plan changes update their real fills and selected contours before the physical World advances',()=>{
  const f=sceneFixture();try{
    const grow=f.played.growingZones[0]!,stored=f.played.stockpiles[0]!;
    f.select({kind:'growing',id:grow.id});expect(f.edges(70)).toEqual([255,255,255,255]);
    const next=structuredClone(f.played);next.growingZones[0]!.cells=[70,71];next.stockpiles.push(storage(next,69,undefined,stored.zoneId!));next.allowedAreas![0]!.cells=[73];next.roofing!.build=[75];next.roofing!.remove=[77];next.plans369!.plans[0]!.cells=[78,79];
    f.admit(next);expect(f.scene.world).toBe(f.played);
    for(const i of [68,69,70,71,73])expect(f.alpha(i)).toBeCloseTo(.2);expect(f.alpha(72)).toBe(0);expect(f.alpha(79)).toBeCloseTo(.4);
    expect(f.roofs.areaSurfaces).toHaveLength(2);
    for(const [index,i]of [75,77].entries()){const p=f.roofs.areaSurfaces[index]!,c=cell(next,i);expect((p.minX+p.maxX)/2).toBeCloseTo(c.x,6);expect((p.minZ+p.maxZ)/2).toBeCloseTo(c.z,6);}
    expect(f.edges(70)).toEqual([255,0,255,255]);expect(f.edges(71)).toEqual([0,255,255,255]);
    expect(Array.from(f.objectSelection.geometry.getAttribute('position').array)).toEqual(zoneBoundaryVertices(next.width,[70,71]).map(Math.fround));
    f.select({kind:'stockpile',id:stored.id});expect(f.edges(69)).toEqual([0,255,255,255]);
    const shrink=structuredClone(next);shrink.stockpiles=shrink.stockpiles.filter(s=>s.id===stored.id);shrink.growingZones=[];delete shrink.allowedAreas;shrink.roofing!.build=[];shrink.roofing!.remove=[];shrink.plans369!.plans[0]!.hidden=true;
    f.admit(shrink);expect(f.edges(69)).toEqual([0,0,0,0]);expect(f.edges(68)).toEqual([255,255,255,255]);
    for(const i of [69,70,71,73,78,79])expect(f.alpha(i),String(i)).toBe(0);expect(f.roofs.areaSurfaces).toHaveLength(0);
    const plan=structuredClone(shrink);delete plan.plans369!.plans[0]!.hidden;f.scene.zonesVisible=false;f.scene.zonesTintDirty=true;f.admit(plan);expect(f.alpha(68)).toBe(0);expect(f.alpha(78)).toBeCloseTo(.4);f.select({kind:'plan',id:1});expect(f.edges(79)).toEqual([0,255,255,255]);
    const gone=structuredClone(plan);delete gone.plans369;f.admit(gone);expect(f.alpha(78)).toBe(0);expect(f.edges(79)).toEqual([0,0,0,0]);expect(f.objectSelection.visible).toBe(false);
    expect(confirmedZoneSelectionCells(f.played,f.scene.confirmedIntents,{kind:'growing',id:grow.id})).toEqual([]);
  }finally{f.dispose();}
});
