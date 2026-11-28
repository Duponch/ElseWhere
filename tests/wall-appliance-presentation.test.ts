import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import type {Structure} from '../src/sim/types';
import {ventParts} from '../src/render/vent-parts';
import {electricalParts} from '../src/render/electrical-parts';
import {readWallGrid,wallChunkFaces,wallBodyColor,wallCodeFamily,WALL_FAMILY_TIMBER} from '../src/render/wall-network';
import {timberCladdingParts} from '../src/render/TimberCladdingLayer';
import {constructionGhostParts,constructionPreviewParts} from '../src/render/construction-preview-parts';
import {WALL_APPLIANCE_BOTTOM,WALL_APPLIANCE_TOP} from '../src/render/wall-appliance';
import {WORLD_SCALE} from '../src/world/scale';
import {WallLayer} from '../src/render/WallLayer';
import {doorLeafTop} from '../src/render/door-parts';

function fixture(kind:'vent'|'cooler',orientation:Structure['orientation']=0,material:Structure['material']='wood'){
  const world=createWorld(17,16,16),s:Structure={id:50,kind,x:7,z:7,orientation,footprint:'standard',material:'steel',vent:kind==='vent'?{open:true}:undefined};
  const dx=orientation%2===0?1:0,dz=1-dx;
  world.structures=[{id:51,kind:'wall',x:7-dx,z:7-dz,orientation:0,footprint:'standard',material},s,{id:52,kind:'wall',x:7+dx,z:7+dz,orientation:0,footprint:'standard',material}];
  return {world,s};
}

test('the two wall appliances keep their real depth, fixed compact height, rotation and resident part counts',()=>{
  expect(WALL_APPLIANCE_TOP).toBe(doorLeafTop(false));
  expect(WALL_APPLIANCE_TOP-WALL_APPLIANCE_BOTTOM).toBeCloseTo(.48,10);
  for(const kind of ['vent','cooler'] as const)for(const orientation of [0,1,2,3] as const){
    const {world,s}=fixture(kind,orientation),before=JSON.stringify(world),parts=kind==='vent'?ventParts(world):electricalParts(world,false,[s]);
    expect(parts).toHaveLength(kind==='vent'?13:7);
    expect(Math.min(...parts.map(p=>p.y-(p.sy??1)/2))).toBeCloseTo(WALL_APPLIANCE_BOTTOM,10);
    expect(Math.max(...parts.map(p=>p.y+(p.sy??1)/2))).toBeCloseTo(WALL_APPLIANCE_TOP,10);
    expect(Math.max(...parts.map(p=>p.sz??1))).toBe(kind==='vent'?.96:.88);
    expect(parts.every(p=>p.ry===orientation*Math.PI/2&&p.targetId===s.id)).toBe(true);
    expect(kind==='vent'?ventParts(world,true):electricalParts(world,true,[s])).toEqual([]);
    expect(JSON.stringify(world)).toBe(before);
  }
});

test('wall network closes below/above each unit with neighbour material, exposes the opening jambs and stays solid at cutaway',()=>{
  for(const kind of ['vent','cooler'] as const)for(const material of ['wood','granite-blocks'] as const){
    const {world,s}=fixture(kind,0,material),grid=readWallGrid(world,false),code=grid.codes[7*16+7]!,left=grid.codes[7*16+6]!;
    expect(grid.ids[7*16+7]).toBe(s.id);expect(wallBodyColor(code)).toBe(wallBodyColor(left));
    expect(wallCodeFamily(code)).toBe(material==='wood'?WALL_FAMILY_TIMBER:0);
    const faces=wallChunkFaces(grid,0,0).drawn;
    let front=0,jambs=0,sill=false,lintel=false;
    for(let i=0;i<faces.position.length;i+=9){
      const x=faces.position[i]!,y=faces.position[i+1]!,z=faces.position[i+2]!,nx=faces.normal[i]!,ny=faces.normal[i+1]!,nz=faces.normal[i+2]!;
      if(Math.abs(nz)===1&&Math.abs(z-7)===.5&&[x,faces.position[i+3]!,faces.position[i+6]!].every(px=>px>=6.5&&px<=7.5)){
        const ys=[y,faces.position[i+4]!,faces.position[i+7]!];
        expect(Math.max(...ys)<=WALL_APPLIANCE_BOTTOM+1e-8||Math.min(...ys)>=WALL_APPLIANCE_TOP-1e-8).toBe(true);front++;
      }
      if(Math.abs(nx)===1&&Math.abs(x-7)===.5&&y>=WALL_APPLIANCE_BOTTOM&&y<WALL_APPLIANCE_TOP)jambs++;
      if(ny===1&&y===WALL_APPLIANCE_BOTTOM)sill=true;
      if(ny===-1&&y===WALL_APPLIANCE_TOP)lintel=true;
    }
    expect(front).toBeGreaterThan(0);expect(jambs).toBeGreaterThan(0);expect(sill&&lintel).toBe(true);
    const cut=wallChunkFaces(readWallGrid(world,true),0,0).drawn;
    expect(Math.max(...cut.position.filter((_,i)=>i%3===1))).toBe(WORLD_SCALE.wallCutawayHeight);
  }
});

test('blueprints and frames share full/cutaway wall assemblies with no empty appliance preview',()=>{
  for(const material of ['wood','granite-blocks'] as const)for(const cutaway of [false,true]){
    const {world,s}=fixture('cooler',1,material),spec={key:88,kind:'cooler' as const,x:s.x,z:s.z,orientation:s.orientation,material:'steel' as const};
    world.structures=world.structures.filter(p=>p.id!==s.id);
    const cursor=constructionPreviewParts(world,[spec],cutaway),frame=constructionGhostParts(world,[spec],cutaway);
    for(const parts of [cursor,frame]){
      expect(parts.boxes.length+parts.timberWalls.length).toBeGreaterThan(0);
      expect([...parts.boxes,...parts.timberWalls,...parts.timberEaves].every(p=>p.key===88)).toBe(true);
      if(material==='wood')expect(parts.timberWalls).toHaveLength(cutaway?1:2);
      else expect(parts.timberWalls).toHaveLength(0);
      if(cutaway)expect(parts.boxes.every(p=>p.y+(p.sy??1)/2<=WORLD_SCALE.wallCutawayHeight+1e-8)).toBe(true);
    }
    const real=timberCladdingParts({...world,structures:[...world.structures,s]},cutaway,[s]);
    expect(real.walls).toHaveLength(material==='wood'?(cutaway?1:2):0);
  }
});

test('an appliance never adds cuts or triangles to distant unchanged wall regions',()=>{
  const {world,s}=fixture('vent');world.width=96;world.height=16;
  world.structures.push({id:90,kind:'wall',material:'wood',x:70,z:7,orientation:0,footprint:'standard'});
  const withUnit=wallChunkFaces(readWallGrid(world,false),2,0).drawn;
  const withoutUnit=wallChunkFaces(readWallGrid({...world,structures:world.structures.filter(p=>p.id!==s.id)},false),2,0).drawn;
  expect(withUnit.triangles).toBe(withoutUnit.triangles);expect(withUnit.position).toEqual(withoutUnit.position);
});

test('finished appliance surrounds stay in the one retained wall mesh through edits and cutaway',()=>{
  const {world,s}=fixture('cooler'),layer=new WallLayer();
  try{
    const mesh=layer.mesh;layer.update(world,false,true);
    expect(layer.group.children).toEqual([mesh]);expect(mesh.castShadow&&mesh.receiveShadow).toBe(true);
    expect(layer.triangles).toBeGreaterThan(0);
    layer.setTargetPreview(new Set([s.id]));
    const grid=Reflect.get(layer,'grid') as ReturnType<typeof readWallGrid>;
    expect(grid.ids[s.z*world.width+s.x]).toBe(s.id);
    layer.update(world,true);expect(layer.mesh).toBe(mesh);expect(layer.group.children).toEqual([mesh]);
    layer.update(world,false);expect(layer.mesh).toBe(mesh);expect(layer.group.children).toEqual([mesh]);
  }finally{layer.dispose();}
});

