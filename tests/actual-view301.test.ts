import {expect,test} from 'vitest';
import {OrthographicCamera,PerspectiveCamera,WebGPUCoordinateSystem} from 'three/webgpu';
import {isActualView301,rateForPawn301,setActualView301,type ActualView301} from '../src/sim/actual-view-301.ts';
import {brandCampaignContext} from '../src/sim/world-map-context.ts';
import type {World} from '../src/sim/types.ts';
import type {WorldGroupRecord} from '../src/sim/world-map-state.ts';
import {actualCameraView301,actualZoomBand301} from '../src/render/actual-camera-view-301.ts';
import {actualViewKey301,isActualViewRequest301} from '../src/bridge/actual-view-wire-301.ts';

const view:ActualView301={mapId:0,minX:4,minZ:5,maxX:12,maxZ:13,zoomBand:0};
// Deliberately partial own-data component records, NOT Whole/save fixtures or
// a played campaign. The production registry only reads these named fields.
function componentMap():World {return {schemaVersion:301,width:32,height:32,tiles:[],rng:184,nextId:9,
 worldMaps:{rootMapId:0,selectedMapId:0,mapSize:{width:32,height:32},sites:[{id:0},{id:1}]}} as unknown as World;}

test('closed own-data view channel refuses getters, extras and malformed bounds without reading accessors',()=>{
 let reads=0;
 const getter={...view};Object.defineProperty(getter,'minX',{enumerable:true,get(){reads++;return 4;}});
 expect(isActualView301(getter)).toBe(false);expect(reads).toBe(0);
 const header={epoch:1,view};Object.defineProperty(header,'type',{enumerable:true,get(){reads++;return 'actual-view-301';}});
 expect(isActualViewRequest301(header)).toBe(false);expect(reads).toBe(0);
 for(const bad of [{...view,zoomBand:5},{...view,minX:13},{...view,maxX:400},{...view,minZ:.5},Object.create(view),{...view,world:{}}])expect(isActualView301(bad)).toBe(false);
 expect(isActualViewRequest301({type:'actual-view-301',epoch:1,view})).toBe(true);
 expect(isActualViewRequest301({type:'actual-view-301',epoch:0,view})).toBe(false);
 expect(isActualViewRequest301({type:'actual-view-301',epoch:1,view,id:3})).toBe(false);
 expect(actualViewKey301(1,view)).toBe(actualViewKey301(1,{zoomBand:0,maxZ:13,minZ:5,maxX:12,minX:4,mapId:0}));
 expect(actualViewKey301(2,view)).not.toBe(actualViewKey301(1,view));
});

test('true campaign identity owns the ephemeral view; aliases, other maps, group projections and headless replacements cannot borrow it',()=>{
 const root=componentMap(),pawn={x:8,z:9},before=JSON.stringify(root),alias=componentMap(),other=componentMap(),group=componentMap();
 brandCampaignContext(alias,root,0);brandCampaignContext(other,root,1);
 brandCampaignContext(group,root,0,{} as unknown as WorldGroupRecord);
 expect(rateForPawn301(root,pawn)).toBe(15);
 for(const zoomBand of [0,1,2,3,4] as const){expect(setActualView301(root,{...view,zoomBand})).toBe(true);expect(rateForPawn301(root,pawn)).toBe(zoomBand+1);expect(rateForPawn301(alias,pawn)).toBe(zoomBand+1);}
 expect(rateForPawn301(root,{x:3,z:9})).toBe(15);expect(rateForPawn301(other,pawn)).toBe(15);expect(rateForPawn301(group,pawn)).toBe(15);
 expect(rateForPawn301(componentMap(),pawn)).toBe(15);
 expect(setActualView301(root,{...view,maxX:32})).toBe(false);
 expect(JSON.stringify(root)).toBe(before); // Includes RNG/id: zero World fields changed.
 const supplied={...view};expect(setActualView301(root,supplied)).toBe(true);supplied.minX=10;
 expect(rateForPawn301(root,pawn)).toBe(1); // Stored descriptor does not alias caller data.
 root.worldMaps!.selectedMapId=1;expect(rateForPawn301(root,pawn)).toBe(15);
 root.worldMaps!.selectedMapId=0;expect(setActualView301(root,null)).toBe(true);expect(rateForPawn301(alias,pawn)).toBe(15);
});

test('real ground/frustum intersection handles orthographic and horizon perspective views, with explicit five-band adaptation',()=>{
 const camera=new OrthographicCamera(-4,4,4,-4,.1,100);camera.position.set(15.5,30,15.5);camera.up.set(0,0,-1);camera.lookAt(15.5,0,15.5);camera.updateProjectionMatrix();
 const actual=actualCameraView301(camera,0,32,32,16);
 expect(actual).toEqual({mapId:0,minX:10,minZ:10,maxX:21,maxZ:21,zoomBand:0});
 camera.position.x+=8;camera.lookAt(23.5,0,15.5);
 expect(actualCameraView301(camera,0,32,32,16)).toEqual({...actual,minX:18,maxX:29});
 const perspective=new PerspectiveCamera(60,1,.1,100);perspective.coordinateSystem=WebGPUCoordinateSystem;perspective.position.set(15.5,3,40);perspective.lookAt(15.5,0,15.5);perspective.updateProjectionMatrix();
 const horizon=actualCameraView301(perspective,1,32,32,55)!;
 expect(horizon).not.toBeNull();expect(horizon.mapId).toBe(1);expect(horizon.minX).toBeGreaterThanOrEqual(0);expect(horizon.maxX).toBeLessThan(32);expect(horizon.minZ).toBeLessThanOrEqual(15);expect(horizon.maxZ).toBeGreaterThanOrEqual(15);expect(horizon.zoomBand).toBe(4);
 perspective.lookAt(15.5,3,100);expect(actualCameraView301(perspective,1,32,32,55)).toBeNull();
 expect([16,16.01,24,24.01,36,36.01,54,54.01].map(actualZoomBand301)).toEqual([0,1,1,2,2,3,3,4]);
});
