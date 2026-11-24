import {expect,test,vi} from 'vitest';
import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import {createWorld} from '../src/sim/engine';
import type {Job,World} from '../src/sim/types';
import {actionProgress} from '../src/render/action-feedback';
import {actionProgressAnchor} from '../src/render/action-progress-anchor';
import {ActionFeedbackLayer} from '../src/render/ActionFeedbackLayer';

function fixture(){
  const w=createWorld(1124,32,32),p=w.pawns[0]!;
  w.resources=[];w.structures=[];w.jobs=[];w.piles=[];
  p.x=4;p.z=6;p.state='working';p.jobId=null;p.cooking=null;
  return {w,p};
}
function job(w:World,kind:Job['kind'],extra:Partial<Job>={}):Job {
  const j:Job={id:w.nextId++,kind,x:5,z:6,orientation:0,footprint:'standard',status:'active',reservedBy:w.pawns[0]!.id,progress:5,escrow:{wood:0,food:0},...extra};
  w.jobs.push(j);w.pawns[0]!.jobId=j.id;return j;
}
function source(w:World,capacity=w.pawns.length){
  const g=new THREE.InstancedBufferGeometry();
  for(const name of ['aFrom','aTo','aTravel'])g.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4));
  w.pawns.forEach((p,i)=>{g.getAttribute('aFrom').setXYZW(i,p.x,0,p.z,0);g.getAttribute('aTo').setXYZW(i,p.x,0,p.z,0);g.getAttribute('aTravel').setXYZW(i,0,0,0,1);});
  return g;
}
const clock=()=>({blend:uniform(1),travelTime:uniform(0)});

test('mining and extraction stay on their target while plant cutting, sowing and construction clearance use the Core midpoint',()=>{
  for(const kind of ['mine','chop','cut','harvest','sow','extract-tree'] as const){
    const {w,p}=fixture();w.tiles[6*w.width+5]={terrain:'rock',stone:'granite',miningDamage:160};
    w.resources=[{id:w.nextId++,kind:'tree',x:5,z:6,amount:20,growth:1,species:'oak'}];
    const j=job(w,kind,kind==='extract-tree'?{tree:{kind:'extract',resourceId:w.resources[0]!.id}}:{});
    const before=structuredClone(w),progress=actionProgress(w,p)!;
    expect(progress).toBeDefined();
    expect(actionProgressAnchor(w,p,progress)).toEqual({target:{x:j.x,z:j.z},actorWeight:kind==='mine'||kind==='extract-tree'?0:.5,offsetZ:-.5});
    expect(w).toEqual(before);
  }
  const {w,p}=fixture(),plant={id:w.nextId++,kind:'tree' as const,x:5,z:6,amount:20};w.resources=[plant];
  job(w,'wall',{x:6,z:6,clearance:{resourceId:plant.id,progress:4}});
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:5,z:6},actorWeight:.5,offsetZ:-.5});
});

test('replanting prepares the destination blueprint while the original tree remains carried',()=>{
  const {w,p}=fixture(),resource={id:600,kind:'tree' as const,x:10,z:10,amount:20,growth:1};
  w.piles=[{id:601,kind:'plant',item:'minified-tree',quantity:1,owner:{type:'pawn',pawnId:p.id},innerResource:resource,plantPack:{packedAt:0,expiresAt:42000}}];
  const j=job(w,'replant-tree',{tree:{kind:'replant',sourcePileId:601,resourceId:resource.id,phase:'prepare',carryPileId:601,durationCore:100,workCore:25}});
  const progress=actionProgress(w,p)!;expect(progress).toMatchObject({completed:25,total:100});
  expect(actionProgressAnchor(w,p,progress)).toEqual({target:{x:j.x,z:j.z},actorWeight:0,offsetZ:-.5});
  expect(w.piles[0]!.owner).toEqual({type:'pawn',pawnId:p.id});
});

test('cleaning follows the current filth identity and snow cell, keeping its existing measured fraction',()=>{
  const {w,p}=fixture();
  w.filth={rng:1,cleaned:0,items:[{id:901,kind:'dirt',x:5,z:6,thickness:3,grownCore:0,expiresAfterCore:10000,nextCheckCore:1000},{id:902,kind:'blood',x:4,z:7,thickness:1,grownCore:0,expiresAfterCore:10000,nextCheckCore:1000}]};
  p.cleaning={phase:'clean',targets:[901,902],forced:true,progress:10};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:5,z:6},actorWeight:.5,offsetZ:-.5});
  p.cleaning.targets.shift();
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:4,z:7},actorWeight:.5,offsetZ:-.5});
  p.cleaning.snowCell=7*w.width+5;w.tiles[p.cleaning.snowCell]={terrain:'grass',snowDepth:.5};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:5,z:7},actorWeight:.5,offsetZ:-.5});
});

test('research, recipe work, fuel service and deconstruction target the real rotated footprint center',()=>{
  const {w,p}=fixture(),bench={id:w.nextId++,kind:'research-bench' as const,material:'wood' as const,x:5,z:6,orientation:1 as const,footprint:'standard' as const};
  w.structures=[bench];w.research={project:'stonecutting',points:20};p.research={stationId:bench.id,spot:{x:4,z:6},worked:3};
  const research=actionProgress(w,p)!;
  const expected={target:{x:5.5,z:6},actorWeight:0,offsetZ:-.5};
  expect(actionProgressAnchor(w,p,research)).toEqual(expected);
  delete p.research;
  p.cooking={stationId:bench.id,billId:1,spot:p,actionCell:p,phase:'work',ingredients:[],progress:10,productId:null,storageId:null};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual(expected);
  p.cooking=null;
  p.haul={sourcePileId:77,carryPileId:77,quantity:1,phase:'deliver',destination:{type:'fuel',structureId:bench.id},serviceProgress:1};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual(expected);
  p.haul=null;
  job(w,'deconstruct',{deconstruction:{structureId:bench.id,kind:bench.kind,material:bench.material}});
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual(expected);
  w.structures[0]={...bench,quality:'good'};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!).offsetZ).toBe(-.25);
});

test('tending and surgery use the patient rendered bed origin; self-tending and held targets retain the Core actor fallback',()=>{
  const {w,p}=fixture(),patient=w.pawns[1]!;
  p.tend={patientId:patient.id,spot:p,phase:'tend',progress:4,duration:10};
  const g=source(w),layer=new ActionFeedbackLayer(clock());
  g.getAttribute('aTo').setXYZW(1,8.5,.65,9.25,0);
  try{
    layer.update(w,new Set(),g);
    const anchor=layer.bars.geometry.getAttribute('aActionAnchor');
    expect([anchor.getX(0),anchor.getY(0),anchor.getZ(0),anchor.getW(0)]).toEqual([8.5,9.25,0,-.5]);
    delete p.tend;
    p.surgery={patientId:patient.id,bedId:99,spot:p,phase:'work',part:'left-arm',progress:4,workCore:40};
    expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toMatchObject({pawnId:patient.id,actorWeight:0});
    delete p.surgery;
    p.tend={patientId:p.id,spot:p,phase:'tend',progress:4,duration:10};
    expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({actorWeight:1,offsetZ:-.5});
  }finally{layer.dispose();g.dispose();}
});

test('food and clothes follow their actual ground/held ownership, including feeding a patient',()=>{
  const {w,p}=fixture(),patient=w.pawns[1]!,food={id:801,kind:'food' as const,item:'simple-meal' as const,quantity:1,owner:{type:'pawn' as const,pawnId:p.id}};
  w.piles=[food];p.feed={patientId:patient.id,spot:p,sourcePileId:food.id,carryPileId:food.id,quantity:1,phase:'feed',progress:3};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({actorWeight:1,offsetZ:-.5});
  delete p.feed;
  p.state='eating';p.need={kind:'eat',phase:'ingest',sourcePileId:food.id,carryPileId:food.id,quantity:1,progress:3,dining:null};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({actorWeight:1,offsetZ:-.5});
  p.state='working';p.need=null;p.equipmentTask={action:'wear',itemId:802,progress:1,duration:10};
  w.piles.push({id:802,kind:'apparel',item:'cloth-tuque',quantity:1,owner:{type:'ground',x:5,z:6},apparel:{quality:'normal',hitPoints:100}});
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:5,z:6},actorWeight:0,offsetZ:-.25});
  w.piles[1]!.owner={type:'apparel',pawnId:p.id};p.equipmentTask.action='remove';
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({actorWeight:1,offsetZ:-.5});
});

test('animal work follows the actual animal and hunting switches to the grounded corpse identity',()=>{
  const {w,p}=fixture(),animal={id:701,species:'hare' as const,sex:'female' as const,ageTicks:1000,food:.5,rest:1,x:5,z:6,state:'downed' as const,path:[],nextDecision:0};
  w.wildlife={profile:'temperate-hares-v1',rng:1,animals:[animal],eatenPlants:0,eatenNutrition:0,eatenItems:0};
  p.animalHandling={animalId:animal.id,kind:'slaughter',phase:'interact',step:0,progress:5,sourcePileId:0,carryPileId:null,quantity:0};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:5,z:6},actorWeight:0,offsetZ:-.5});
  delete p.animalHandling;p.hunting={animalId:animal.id,phase:'finish',progress:4,startedAt:0};
  w.piles=[{id:animal.id,kind:'corpse',item:'hare-corpse',quantity:1,owner:{type:'ground',x:4,z:7}}];
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({target:{x:4,z:7},actorWeight:0,offsetZ:-.5});
  w.piles[0]!.owner={type:'pawn',pawnId:p.id};
  expect(actionProgressAnchor(w,p,actionProgress(w,p)!)).toEqual({actorWeight:1,offsetZ:-.5});
});

test('the resident bar keeps its mesh, material and buffers; anchors upload only at snapshot changes and disappear on travel',()=>{
  const {w,p}=fixture(),j=job(w,'mine');w.tiles[j.z*w.width+j.x]={terrain:'rock',miningDamage:160};
  const g=source(w),time=clock(),layer=new ActionFeedbackLayer(time),mesh=layer.bars,material=mesh.material;
  try{
    layer.update(w,new Set(),g);const anchors=mesh.geometry.getAttribute('aActionAnchor') as THREE.InstancedBufferAttribute,action=mesh.geometry.getAttribute('aAction'),uploads=layer.stats.barUploads,anchorVersion=anchors.version;
    expect(layer.stats.activeBars).toBe(1);expect(action.getX(0)).toBe(Math.fround(actionProgress(w,p)!.fraction));
    layer.update(w,new Set(),g);time.travelTime.value=400;time.blend.value=.25;layer.syncTravel(g);
    expect(layer.stats.barUploads).toBe(uploads);expect(anchors.version).toBe(anchorVersion);
    j.x++;w.tiles[j.z*w.width+j.x]={terrain:'rock',miningDamage:160};
    layer.update(w,new Set(),g);expect(anchors.getX(0)).toBe(j.x);expect(layer.stats.barUploads).toBe(uploads+1);
    expect(layer.bars).toBe(mesh);expect(mesh.material).toBe(material);expect(mesh.geometry.getAttribute('aActionAnchor')).toBe(anchors);expect(mesh.geometry.getAttribute('aAction')).toBe(action);
    expect(mesh.geometry.getAttribute('aFrom')).toBe(g.getAttribute('aFrom'));
    const grown=source(w,w.pawns.length+4);try{layer.update(w,new Set(),grown);expect(layer.bars).toBe(mesh);expect(mesh.material).toBe(material);expect(mesh.geometry.getAttribute('aActionAnchor').getX(0)).toBe(j.x);}finally{grown.dispose();}
    p.state='moving';layer.update(w,new Set(),g);expect(layer.stats.activeBars).toBe(0);expect(mesh.visible).toBe(false);
  }finally{layer.dispose();g.dispose();}
});

test('the actual bar shader compiles the confirmed target/midpoint and map offset without a frame callback (cold WGSL, no GPU claim)',()=>{
  const {w}=fixture(),g=source(w),layer=new ActionFeedbackLayer(clock()),renderer=new THREE.WebGPURenderer({canvas:{width:640,height:480,style:{}} as HTMLCanvasElement});
  const init=vi.spyOn(renderer,'init').mockImplementation(()=>{throw Error('No GPU in this cold shader contract');});
  renderer.hasFeature=()=>false;Reflect.set(renderer.backend,'device',{features:new Set<string>(),limits:{maxUniformBufferBindingSize:65536}});Reflect.set(renderer.backend,'renderer',renderer);
  try{
    layer.update(w,new Set(),g);
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-8,8,6,-6,.1,100);scene.add(layer.bars);scene.updateMatrixWorld(true);camera.updateMatrixWorld();
    interface BuilderPort {scene:THREE.Scene;camera:THREE.Camera;material:THREE.Material;vertexShader:string;build():void;updateNodes:THREE.Node[]}
    const Builder=THREE.WGSLNodeBuilder as unknown as new(mesh:THREE.Mesh,renderer:THREE.WebGPURenderer)=>BuilderPort,builder=new Builder(layer.bars,renderer);
    builder.scene=scene;builder.camera=camera;builder.material=layer.bars.material;builder.build();
    expect(builder.vertexShader).toContain('aActionAnchor');expect(builder.vertexShader).toContain('mix(');expect(builder.vertexShader).toContain('0.18');
    expect(layer.bars.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);expect(init).not.toHaveBeenCalled();
  }finally{layer.dispose();g.dispose();init.mockRestore();}
});
