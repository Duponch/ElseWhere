import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import type {World} from '../src/sim/types';
import {knownCell256} from '../src/sim/exploration-visibility-256';
import {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import {GrowingZoneLayer} from '../src/render/GrowingZoneLayer';
import {AllowedAreaLayer} from '../src/render/AllowedAreaLayer';
import {SceneRenderCore} from '../src/render/SceneRenderCore';
import {createClosedMainMapIntentReader} from '../src/render/closed-main-map-intents';
import {FLOOR_SURFACE_Y,overlaySurfaceHeightAtCell} from '../src/render/surface-height';

function exploring(world:World){world.site={revision:3,tileId:0,mapSeed:world.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};world.exploration={revision:1};}

test('new zone cells use played terrain and retain their resident batch until the played surface changes',()=>{
  const executed=createWorld(426,16,16),cells=[4*16+4,4*16+5];executed.growingZones=[];
  for(const cell of cells)executed.tiles[cell]={terrain:'soil'};
  const latest=structuredClone(executed);latest.growingZones=[{id:latest.nextId++,cells,plant:'rice',allowSow:true,allowCut:true}];
  for(const cell of cells)latest.tiles[cell]!.floor='wood-planks';
  const fields=createClosedMainMapIntentReader().admit!(latest),boxes=new BoxBatches(),layer=new GrowingZoneLayer(boxes),before=structuredClone(executed);
  try{
    layer.updateIntents(executed,fields.growingZones);
    expect(layer.surfaces.map(p=>p.y)).toEqual(cells.map(()=>.021));
    const mesh=layer.group.getObjectByName('growing-borders') as BoxMesh,geometry=mesh.geometry,matrix=mesh.instanceMatrix,material=mesh.material;
    expect(mesh.geometry.instanceCount).toBe(2);expect(layer.updateIntents(executed,fields.growingZones)).toBe(false);
    expect(executed).toEqual(before);
    const played=structuredClone(executed);played.tiles[cells[0]!]!.floor='wood-planks';
    expect(layer.updateIntents(played,fields.growingZones)).toBe(true);expect(layer.surfaces[0]!.y).toBeCloseTo(FLOOR_SURFACE_Y+.021);
    expect(mesh.geometry).toBe(geometry);expect(mesh.instanceMatrix).toBe(matrix);expect(mesh.material).toBe(material);
    layer.updateIntents(played,[]);expect(mesh.geometry.instanceCount).toBe(0);expect(layer.surfaces).toEqual([]);
  }finally{boxes.dispose();}
});

test('the real scene growing bridge filters future-known cells through played exploration',()=>{
  const executed=createWorld(426,16,16),visible=4*16+4,hidden=4*16+5;exploring(executed);
  executed.tiles[visible]={terrain:'soil'};executed.tiles[hidden]={terrain:'soil',fogged:true};
  const latest=structuredClone(executed);delete latest.tiles[hidden]!.fogged;
  latest.growingZones=[{id:latest.nextId++,cells:[visible,hidden],plant:'rice',allowSow:true,allowCut:true}];
  const boxes=new BoxBatches(),growing=new GrowingZoneLayer(boxes),scene=Object.assign(Object.create(SceneRenderCore.prototype) as Record<string,unknown>,{
    world:executed,confirmedIntents:createClosedMainMapIntentReader().admit!(latest),growing,tool:'select',
  }) as unknown as {world:World;updateGrowingZones(reset:boolean):boolean};
  try{
    scene.updateGrowingZones(false);expect(growing.surfaces.map(p=>p.z*16+p.x)).toEqual([visible]);
    scene.world=latest;scene.updateGrowingZones(false);expect(growing.surfaces.map(p=>p.z*16+p.x)).toEqual([visible,hidden]);
  }finally{boxes.dispose();}
});

test('removing the optional allowedAreas field clears the real scene layer instead of falling back to an older World',()=>{
  const executed=createWorld(426,16,16),id=executed.nextId++;executed.allowedAreas=[{id,label:'A',color:0x123456,cells:[4*16+4]}];
  const latest=structuredClone(executed);delete latest.allowedAreas;
  const reader=createClosedMainMapIntentReader(),boxes=new BoxBatches(),allowedAreaLayer=new AllowedAreaLayer(boxes);
  const scene=Object.assign(Object.create(SceneRenderCore.prototype) as Record<string,unknown>,{
    world:executed,confirmedIntents:reader.admit!(executed),allowedAreaLayer,refreshZonesTint:vi.fn(),updateHover:vi.fn(),
  }) as unknown as {confirmedIntents:ReturnType<NonNullable<typeof reader.admit>>;setAllowedAreaTarget(id:number|undefined):void};
  try{
    scene.setAllowedAreaTarget(id);expect(allowedAreaLayer.surfaces).toHaveLength(1);
    scene.confirmedIntents=reader.admit!(latest);scene.setAllowedAreaTarget(id);
    expect(allowedAreaLayer.surfaces).toEqual([]);
    expect((allowedAreaLayer.group.getObjectByName('allowed-area') as BoxMesh).geometry.instanceCount).toBe(0);
    scene.setAllowedAreaTarget(undefined);scene.setAllowedAreaTarget(id);expect(allowedAreaLayer.surfaces).toEqual([]);
  }finally{boxes.dispose();}
});

test('allowed surfaces obey played height and visibility while a newer area still includes hidden cells',()=>{
  const executed=createWorld(426,16,16),a=4*16+4,b=4*16+5,id=executed.nextId++;exploring(executed);
  executed.tiles[a]={terrain:'soil',floor:'wood-planks'};executed.tiles[b]={terrain:'soil',fogged:true};
  const future=structuredClone(executed);delete future.tiles[a]!.floor;delete future.tiles[b]!.fogged;
  future.allowedAreas=[{id,label:'A',color:0x123456,cells:[a,b]}];
  const boxes=new BoxBatches(),layer=new AllowedAreaLayer(boxes),areas=createClosedMainMapIntentReader().admit!(future).allowedAreas;
  try{
    layer.updateIntents(executed,areas,id,false,cell=>knownCell256(executed,cell));
    expect(layer.surfaces).toHaveLength(1);expect(layer.surfaces[0]!.y).toBeCloseTo(overlaySurfaceHeightAtCell(executed,4,4)!+.024);
    layer.updateIntents(future,areas,id,false,cell=>knownCell256(future,cell));expect(layer.surfaces).toHaveLength(2);expect(layer.surfaces[0]!.y).toBeCloseTo(.024);
  }finally{boxes.dispose();}
});

test('the real scene route-only update does not rebuild unchanged jobs, zones, storage, roofs or designations',()=>{
  const world=createWorld(426,16,16),reader=createClosedMainMapIntentReader(),previous=reader.admit!(world),next=structuredClone(world),pawn=next.pawns[0]!;
  pawn.state='moving';pawn.motion=null;pawn.path=[{x:pawn.x+1,z:pawn.z}];
  const intents=reader.admit!(next),path=vi.fn(),feedbackSource=new THREE.InstancedBufferGeometry(),unexpected=()=>{throw Error('Unchanged producer rebuilt for a route-only admission');};
  const scene=Object.assign(Object.create(SceneRenderCore.prototype) as Record<string,unknown>,{
    world,confirmedIntents:intents,presentedIntentFields:previous,confirmedJobsSource:previous.jobs,confirmedIntentsDirty:true,
    confirmedSurfaceDirty:false,confirmedPathDirty:false,confirmedDesignationsDirty:false,
    confirmedJobMarkers:{updateIntentions:unexpected,present:unexpected},buildStorage:unexpected,updateGrowingZones:unexpected,
    allowedAreaLayer:{updateIntents:unexpected},roofs:{updateAreas:unexpected},designations:{update:unexpected},
    pawns:{feedbackSource},selectedPawns:new Set([pawn.id]),actionFeedback:{updateConfirmedPath:path},refreshZonesTint:unexpected,
  }) as unknown as {presentConfirmedIntents():void};
  try{
    scene.presentConfirmedIntents();expect(path).toHaveBeenCalledOnce();
    expect(path).toHaveBeenCalledWith(intents.routes,world,expect.any(Set),feedbackSource,undefined);
    scene.presentConfirmedIntents();expect(path).toHaveBeenCalledOnce();
  }finally{feedbackSource.dispose();}
});
