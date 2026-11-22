/** Wave 2 of the user's feedback of 22 November, lot 1 (items 13 and 15):
 * placed constructions drawn as the placement cursor's ghost, and selection
 * by a click on the drawn model. Presentation only, no World change. */
import {describe,expect,test} from 'vitest';
import * as THREE from 'three/webgpu';
import {createWorld} from '../src/sim/engine';
import {jobDuration} from '../src/sim/farming';
import {footprintCells} from '../src/sim/definitions';
import type {Job,Structure,World} from '../src/sim/types';
import {BoxBatches} from '../src/render/BoxBatches';
import type {BoxMesh} from '../src/render/BoxMesh';
import type {Placement} from '../src/render/primitives';
import {buildJobMarkers} from '../src/render/JobLayer';
import {ConstructionGhosts,constructionGhostSpec} from '../src/render/construction-ghosts';
import {ConstructionPreviewLayer} from '../src/render/ConstructionPreviewLayer';
import {constructionGhostParts,constructionPreviewParts,GHOST_FLOOR_LIFT,type ConstructionPreviewSpec} from '../src/render/construction-preview-parts';
import {floorPartsForKind} from '../src/render/HygieneLayer';
import {buildingModelTop,modelPickTarget,pickMapModel,type MapPickRay} from '../src/render/map-model-pick';
import {bodyScreenProxy,humanScreenProxy} from '../src/render/actor-screen-proxy';
import {hitActors} from '../src/render/PawnSelectionInput';
import {clickedMapObject,mapObjectsAt,nextMapObject} from '../src/ui/map-object-selection';

function bareWorld(seed:number,size=32):World {
  const world=createWorld(seed,size,size);
  world.tiles=world.tiles.map(()=>({terrain:'grass'}));
  world.resources=[];world.structures=[];world.jobs=[];world.piles=[];world.stockpiles=[];world.packed=[];world.growingZones=[];
  return world;
}
function job(world:World,kind:Job['kind'],x:number,z:number,extra:Partial<Job>={}):Job {
  const j:Job={id:world.nextId++,kind,x,z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},...extra};
  world.jobs.push(j);return j;
}
function structure(world:World,kind:Structure['kind'],x:number,z:number,orientation:Structure['orientation']=0):Structure {
  const s:Structure={id:world.nextId++,kind,x,z,orientation,footprint:'standard'};world.structures.push(s);return s;
}
/** Parts without their owner fields, order-free. The timber boards' slight
 * shade derives from the owner's identity (the job id for a placed ghost). */
const shape=(parts:readonly Placement[])=>parts.map(({key:_k,targetId:_t,tint:_s,...part}:Placement&{tint?:number})=>JSON.stringify(part)).sort();
function markers(world:World){
  const writes=new Map<string,Placement[]>(),ghosts=new ConstructionGhosts();
  buildJobMarkers(world,new THREE.Group(),false,{set:(_g:THREE.Group,name:string,parts:Placement[])=>writes.set(name,parts)} as unknown as BoxBatches,ghosts);
  return {writes,ghosts};
}

describe('item 13 · placed constructions are the cursor ghost, not a box over tinted cells',()=>{
  const cases:{label:string;make:(w:World)=>Job;spec:(w:World,j:Job)=>ConstructionPreviewSpec}[]=[
    {label:'wood wall',make:w=>job(w,'wall',6,6,{material:'wood'}),spec:(_w,j)=>({kind:'wall',x:j.x,z:j.z,material:'wood'})},
    {label:'stone wall',make:w=>job(w,'wall',6,6,{material:'granite-blocks'}),spec:(_w,j)=>({kind:'wall',x:j.x,z:j.z,material:'granite-blocks'})},
    {label:'door',make:w=>job(w,'door',6,6,{material:'wood'}),spec:(_w,j)=>({kind:'door',x:j.x,z:j.z,material:'wood'})},
    {label:'bed turned',make:w=>job(w,'bed',6,6,{material:'wood',orientation:1}),spec:(_w,j)=>({kind:'bed',x:j.x,z:j.z,orientation:1,material:'wood'})},
    {label:'research bench',make:w=>job(w,'research-bench',8,8,{material:'wood',orientation:2}),spec:(_w,j)=>({kind:'research-bench',x:j.x,z:j.z,orientation:2,material:'wood'})},
    {label:'standing lamp',make:w=>job(w,'standing-lamp',6,6),spec:(_w,j)=>({kind:'standing-lamp',x:j.x,z:j.z})},
    {label:'power conduit',make:w=>job(w,'power-conduit',6,6),spec:(_w,j)=>({kind:'power-conduit',x:j.x,z:j.z})},
    {label:'shelf',make:w=>job(w,'shelf',6,6,{material:'wood',orientation:3}),spec:(_w,j)=>({kind:'shelf',x:j.x,z:j.z,orientation:3,material:'wood'})},
    {label:'grave',make:w=>job(w,'grave',6,6),spec:(_w,j)=>({kind:'grave',x:j.x,z:j.z})},
    {label:'bridge',make:w=>job(w,'build-bridge',6,6),spec:(_w,j)=>({kind:'build-bridge',x:j.x,z:j.z})},
    {label:'installation of a packed stool',make:w=>{
      const stool:Structure={id:w.nextId++,kind:'stool',x:2,z:2,orientation:0,footprint:'standard',material:'steel'};
      w.packed=[{building:stool,owner:{type:'ground',x:2,z:2}}];
      return job(w,'install',6,6,{furniture:{structureId:stool.id,kind:'stool'},orientation:1});
    },spec:(w,j)=>({kind:'stool',x:j.x,z:j.z,orientation:1,furniture:w.packed[0]!.building})},
  ];
  test.each(cases)('$label: the ghost has the cursor model, rotated as placed; no plan box, no tinted cell',({make,spec})=>{
    const world=bareWorld(1301),placed=make(world),{writes,ghosts}=markers(world);
    try{
      expect(writes.has('job-plans')).toBe(false);expect(writes.get('job-orders')).toEqual([]);
      const ghost=ghosts.allParts();expect(ghost.length).toBeGreaterThan(0);expect(ghost.every(p=>p.key===placed.id)).toBe(true);
      const cursor=constructionPreviewParts(world,[spec(world,placed)]);
      expect(shape(ghost)).toEqual(shape([...cursor.boxes,...cursor.timberWalls,...cursor.timberEaves,...cursor.rotatedBoxes]));
    }finally{ghosts.dispose();}
  });
  test('a laid floor ghost sits just above a floor already laid, covering its cell',()=>{
    const world=bareWorld(1302),floor=job(world,'lay-floor',6,6,{floor:'wood-planks'}),{ghosts}=markers(world);
    try{
      expect(ghosts.allParts()).toEqual(floorPartsForKind('wood-planks',6,6).map(p=>({...p,y:p.y+GHOST_FLOOR_LIFT,key:floor.id})));
    }finally{ghosts.dispose();}
  });
  test('the multi-cell footprint and the orientation are those of the placed job',()=>{
    const world=bareWorld(1303),a=job(world,'bed',6,6,{material:'wood',orientation:0}),b=job(world,'bed',12,6,{material:'wood',orientation:1}),{ghosts}=markers(world);
    try{
      for(const placed of [a,b]){
        const parts=ghosts.allParts().filter(p=>p.key===placed.id),cells=footprintCells(placed);expect(cells).toHaveLength(2);
        const cx=parts.reduce((n,p)=>n+p.x,0)/parts.length,cz=parts.reduce((n,p)=>n+p.z,0)/parts.length;
        // The model's centre lies inside its two cells, between them.
        expect(Math.abs(cx-(cells[0]!.x+cells[1]!.x)/2)).toBeLessThan(.5);expect(Math.abs(cz-(cells[0]!.z+cells[1]!.z)/2)).toBeLessThan(.5);
        expect(parts.every(p=>Math.abs((p.ry??0)-placed.orientation*Math.PI/2)<1e-9||(p.ry??0)===0)).toBe(true);
      }
      const turned=ghosts.allParts().filter(p=>p.key===b.id).map(p=>({x:p.x-b.x,z:p.z-b.z})),straight=ghosts.allParts().filter(p=>p.key===a.id).map(p=>({x:p.x-a.x,z:p.z-a.z}));
      expect(turned).not.toEqual(straight);
    }finally{ghosts.dispose();}
  });
  test('orders that build nothing have no ghost; repair keeps its own cell mark',()=>{
    const world=bareWorld(1304);structure(world,'wall',4,4);world.resources=[{id:world.nextId++,kind:'tree',x:9,z:9,amount:25,species:'oak',growth:1}];
    job(world,'deconstruct',4,4,{deconstruction:{structureId:world.structures[0]!.id,kind:'wall'}} as Partial<Job>);job(world,'chop',9,9);job(world,'mine',2,2);
    const repair=job(world,'repair',4,4,{repair:{structureId:world.structures[0]!.id}} as Partial<Job>);
    const {writes,ghosts}=markers(world);
    try{
      expect(ghosts.allParts()).toEqual([]);
      expect(writes.get('job-orders')!.map(p=>p.targetId)).toEqual([repair.id]);
    }finally{ghosts.dispose();}
  });
  test('a frame shows Core\'s four corner marks and ceil(percent×cells×4) progress tiles; a plain blueprint shows neither',()=>{
    const world=bareWorld(1305),frame=job(world,'bed',6,6,{material:'wood',construction:'frame'}),plan=job(world,'table',12,6,{material:'wood'});
    frame.progress=jobDuration(world,frame)*.4;
    const {writes,ghosts}=markers(world);
    try{
      const solids=writes.get('job-solids')!;
      expect(solids.filter(p=>p.targetId===plan.id)).toEqual([]);
      const own=solids.filter(p=>p.targetId===frame.id),tiles=own.filter(p=>p.sx===.44&&p.sz===.44),corners=own.filter(p=>!(p.sx===.44&&p.sz===.44));
      expect(corners).toHaveLength(8);expect(tiles).toHaveLength(Math.ceil(.4*1*2*4));
      // Tiles are laid row by row from the lower corner of the footprint.
      expect(tiles.map(p=>[p.x,p.z])).toEqual([[5.75,5.75],[6.25,5.75],[5.75,6.25],[6.25,6.25]]);
    }finally{ghosts.dispose();}
  });
  test('progress never rebuilds the ghosts; a new placed order does, in the same resident meshes',()=>{
    const world=bareWorld(1306),frame=job(world,'wall',6,6,{material:'wood',construction:'frame'}),ghosts=new ConstructionGhosts(),boxes=new BoxBatches(),group=new THREE.Group();
    try{
      buildJobMarkers(world,group,false,boxes,ghosts);const parts=ghosts.parts,meshes=ghosts.layer.group.children.slice() as BoxMesh[],geometries=meshes.map(m=>m.geometry);
      frame.progress=jobDuration(world,frame)*.6;buildJobMarkers(world,group,false,boxes,ghosts);expect(ghosts.parts).toBe(parts);
      job(world,'wall',7,6,{material:'wood'});buildJobMarkers(world,group,false,boxes,ghosts);expect(ghosts.parts).not.toBe(parts);
      expect(ghosts.layer.group.children).toEqual(meshes);expect(meshes.map(m=>m.geometry)).toEqual(geometries);
    }finally{boxes.dispose();ghosts.dispose();}
  });
  test('a change of the placed set draws again only the ghosts near it, with the same result as a full drawing',()=>{
    const world=bareWorld(1308,64),ghosts=new ConstructionGhosts(),boxes=new BoxBatches(),group=new THREE.Group();
    for(let x=4;x<12;x++)job(world,'wall',x,8,{material:'wood'});
    const far=job(world,'bed',50,50,{material:'wood'});job(world,'standing-lamp',40,20);
    try{
      buildJobMarkers(world,group,false,boxes,ghosts);expect(ghosts.redrawn).toBe(10);
      const farParts=JSON.stringify(ghosts.allParts().filter(p=>p.key===far.id)),wallTint=ghosts.parts.timberWalls.find(p=>p.key===world.jobs[0]!.id)!;
      world.jobs.splice(3,1);job(world,'door',12,8,{material:'wood'});
      buildJobMarkers(world,group,false,boxes,ghosts);
      expect(ghosts.redrawn).toBeLessThan(world.jobs.length);expect(ghosts.redrawn).toBeGreaterThan(0);
      expect(JSON.stringify(ghosts.allParts().filter(p=>p.key===far.id))).toBe(farParts);
      expect(ghosts.parts.timberWalls.find(p=>p.key===world.jobs[0]!.id)).toEqual(wallTint);
      const fresh=new ConstructionGhosts();
      try{buildJobMarkers(world,new THREE.Group(),false,boxes,fresh);expect(ghosts.parts).toEqual(fresh.parts);}finally{fresh.dispose();}
    }finally{boxes.dispose();ghosts.dispose();}
  });
  test('placed ghosts share the cursor ghost look but are hidden by what stands in front of them',()=>{
    const cursor=new ConstructionPreviewLayer(),placed=new ConstructionGhosts();
    try{
      for(const key of ['transparent','opacity','depthWrite','vertexColors'] as const)expect(placed.layer.material[key]).toBe(cursor.material[key]);
      expect(cursor.material.depthTest).toBe(false);expect(placed.layer.material.depthTest).toBe(true);
      expect(placed.layer.group.children.length).toBe(cursor.group.children.length);
    }finally{cursor.dispose();placed.dispose();}
  });
  test('the batched ghost capture equals one capture per ghost, next to real walls too',()=>{
    const world=bareWorld(1307);for(let x=3;x<9;x++)structure(world,'wall',x,10);
    const jobs=[job(world,'wall',9,10,{material:'wood'}),job(world,'door',10,10,{material:'wood'}),job(world,'wall',11,10,{material:'steel'}),job(world,'power-conduit',5,11),job(world,'bed',14,4,{material:'wood',orientation:2})];
    const specs=jobs.map(j=>constructionGhostSpec(j,world)!),batched=constructionGhostParts(world,specs),whole=constructionGhostParts(world,specs,false,1e9);
    expect(batched).toEqual(whole);
    for(const [i,j] of jobs.entries()){
      const one=constructionPreviewParts(world,[specs[i]!],false,specs);
      const all=[...batched.boxes,...batched.timberWalls,...batched.timberEaves,...batched.rotatedBoxes].filter(p=>p.key===j.id);
      expect(shape(all)).toEqual(shape([...one.boxes,...one.timberWalls,...one.timberEaves,...one.rotatedBoxes]));
    }
  });
});

/** A ray from `from` through `to` (world space). */
const ray=(from:[number,number,number],to:[number,number,number]):MapPickRay=>({ox:from[0],oy:from[1],oz:from[2],dx:to[0]-from[0],dy:to[1]-from[1],dz:to[2]-from[2]});
const groundCell=(r:MapPickRay)=>{const t=-r.oy/r.dy;return {x:Math.floor(r.ox+r.dx*t+.5),z:Math.floor(r.oz+r.dz*t+.5)};};

describe('item 15 · a click selects the drawn model first, then falls back to the cell list',()=>{
  test('a tall tree crown drawn over the cell behind selects the tree',()=>{
    const world=bareWorld(1501),tree={id:world.nextId++,kind:'tree' as const,x:10,z:10,amount:25,species:'oak' as const,growth:1};world.resources=[tree];
    const r=ray([10,12,4],[10,3,10]),ground=groundCell(r);expect(ground).toEqual({x:10,z:12});
    const target=modelPickTarget(ground,pickMapModel(world,r));
    expect(target).toEqual({cell:{x:10,z:10},preferred:{kind:'resource',id:tree.id}});
  });
  test('the face of a wall selects the wall, not the floor behind it; the cutaway wall is low',()=>{
    const world=bareWorld(1502),wall=structure(world,'wall',5,10);
    const r=ray([5,6,4],[5,2.2,9.5]),ground=groundCell(r);expect(ground).toEqual({x:5,z:13});
    expect(modelPickTarget(ground,pickMapModel(world,r))).toEqual({cell:{x:5,z:10},preferred:{kind:'structure',id:wall.id}});
    expect(buildingModelTop(world,'wall',true)).toBeLessThan(1.5);
    expect(modelPickTarget(ground,pickMapModel(world,r,{cutaway:true}))).toEqual({cell:ground});
  });
  test('a model met on its own cell keeps Core\'s cell list order; empty ground stays the ground cell',()=>{
    const world=bareWorld(1503),bed=structure(world,'bed',8,8);
    const down=ray([8,10,8.05],[8,0,8]);expect(pickMapModel(world,down)?.selection).toEqual({kind:'structure',id:bed.id});
    expect(modelPickTarget(groundCell(down),pickMapModel(world,down))).toEqual({cell:{x:8,z:8}});
    const empty=ray([20,10,20.05],[20,0,20]);expect(pickMapModel(world,empty)).toBeUndefined();expect(modelPickTarget(groundCell(empty),undefined)).toEqual({cell:{x:20,z:20}});
  });
  test('the side of a pile, a placed ghost and natural rock are models too',()=>{
    const world=bareWorld(1504),pile={id:world.nextId++,item:'wood' as const,kind:'wood' as const,quantity:50,owner:{type:'ground' as const,x:15,z:10}};world.piles=[pile];
    const pileRay=ray([15,3,6],[15,.3,10.3]);expect(groundCell(pileRay)).toEqual({x:15,z:11});
    expect(modelPickTarget(groundCell(pileRay),pickMapModel(world,pileRay))?.preferred).toEqual({kind:'pile',id:pile.id});
    const ghost=job(world,'wall',25,10,{material:'wood'}),ghostRay=ray([25,6,4],[25,1.5,9.5]);
    expect(modelPickTarget(groundCell(ghostRay),pickMapModel(world,ghostRay))).toEqual({cell:{x:25,z:10},preferred:{kind:'job',id:ghost.id}});
    world.tiles[20*world.width+28]={terrain:'rock'};const rockRay=ray([28,6,15],[28,1,19.5]);
    expect(pickMapModel(world,rockRay)?.selection).toEqual({kind:'rock',id:20*world.width+28});
  });
  test('fogged models are never picked; wall lamps keep their own face pick',()=>{
    const world=bareWorld(1505),tree={id:world.nextId++,kind:'tree' as const,x:10,z:10,amount:25,species:'oak' as const,growth:1};world.resources=[tree];
    world.site={revision:3,tileId:0,mapSeed:world.seed,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','marble'],coastAngle:null,mutatorCode:0};world.exploration={revision:1};
    world.tiles[10*world.width+10]={terrain:'grass',fogged:true};
    expect(pickMapModel(world,ray([10,12,4],[10,3,10]))).toBeUndefined();
    const lampWorld=bareWorld(1506),wall=structure(lampWorld,'wall',5,6);structure(lampWorld,'wall-lamp',5,5,0);
    expect(pickMapModel(lampWorld,ray([5,6,1],[5,1.8,5.5]))?.selection).toEqual({kind:'structure',id:wall.id});
  });
  test('the preferred thing is selected first, then the clicks cycle on its cell in Core order',()=>{
    const world=bareWorld(1507),tree={id:world.nextId++,kind:'tree' as const,x:10,z:10,amount:25,species:'oak' as const,growth:1};world.resources=[tree];
    const pile={id:world.nextId++,item:'wood' as const,kind:'wood' as const,quantity:5,owner:{type:'ground' as const,x:10,z:10}};world.piles=[pile];
    const cell={x:10,z:10},objects=mapObjectsAt(world,cell);expect(objects[0]).toEqual({kind:'pile',id:pile.id});
    const crown={kind:'resource' as const,id:tree.id};
    const first=clickedMapObject(world,cell,undefined,crown);expect(first).toEqual(crown);
    const second=clickedMapObject(world,cell,first,crown);expect(second).toEqual(nextMapObject(world,cell,first));
    let current=second,seen=[first,second];for(let i=0;i<objects.length;i++){current=clickedMapObject(world,cell,current,crown);seen.push(current);}
    expect(new Set(seen.map(o=>`${o?.kind}:${o?.id}`)).size).toBe(objects.length);
    // Without a model, the historical cell cycle is unchanged.
    expect(clickedMapObject(world,cell,undefined)).toEqual(nextMapObject(world,cell,undefined));
    expect(clickedMapObject(world,cell,objects[0])).toEqual(nextMapObject(world,cell,objects[0]));
  });
  const rect={left:0,top:0,width:1280,height:800};
  function camera(from:[number,number,number],at:[number,number,number]):THREE.PerspectiveCamera {
    const c=new THREE.PerspectiveCamera(40,rect.width/rect.height,.5,500);c.position.set(...from);c.lookAt(...at);c.updateMatrixWorld();c.updateProjectionMatrix();return c;
  }
  function screenGroundCell(c:THREE.Camera,x:number,y:number){
    const caster=new THREE.Raycaster();caster.setFromCamera(new THREE.Vector2(x/rect.width*2-1,-(y/rect.height)*2+1),c);
    const hit=new THREE.Vector3();caster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit);return {x:Math.floor(hit.x+.5),z:Math.floor(hit.z+.5)};
  }
  test('a person standing on a cell edge is clicked on the drawn body, from the side or from above',()=>{
    for(const from of [[4.5,9,-2],[4.5,24,6.01]] as [number,number,number][]){
      const c=camera(from,[4.5,0,6]),proxy=humanScreenProxy(c,rect,4.5,0,6)!;expect(proxy).toBeDefined();
      // The body is drawn above the edge between cells 4 and 5: the click is on it, whatever cell lies under the cursor.
      expect(hitActors([{id:7,...proxy}],proxy.x,proxy.y).map(p=>p.id)).toEqual([7]);
      const shoulder=new THREE.Vector3(4.5,.75,6).addScaledVector(new THREE.Vector3().setFromMatrixColumn(c.matrixWorld,0),.3).project(c);
      const sx=(shoulder.x+1)*rect.width/2,sy=(1-shoulder.y)*rect.height/2;
      expect(hitActors([{id:7,...proxy}],sx,sy).map(p=>p.id)).toEqual([7]);
      expect([4,5]).toContain(screenGroundCell(c,proxy.x,proxy.y).x);
    }
  });
  test('an animal walking between two cells is clicked on its drawn body',()=>{
    const c=camera([7.5,10,0],[7.5,0,6.5]),proxy=bodyScreenProxy(c,rect,7.5,0,6.5,.8,.45)!;
    expect(hitActors([{id:9,...proxy}],proxy.x,proxy.y).map(p=>p.id)).toEqual([9]);
    expect(proxy.radius).toBeGreaterThan(6);
  });
});
