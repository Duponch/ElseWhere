import {expect,test} from 'vitest';
import {crematoriumParts} from '../src/render/crematorium-parts.ts';
import {constructionPreviewParts} from '../src/render/construction-preview-parts.ts';
import {deconstructionCamp,fixtureBuilding} from './scenarios/deconstruction.ts';
import {cookingSpot} from '../src/sim/cooking-bills.ts';
import {structureBeauty} from '../src/sim/room-beauty.ts';
import {reconcileTemperature} from '../src/sim/temperature.ts';
import {applyCookingHeat,applyThermalSources} from '../src/sim/thermal-sources.ts';
import {WorkEnvironmentCache} from '../src/sim/work-environment.ts';
import type {Structure} from '../src/sim/types.ts';

test.each([0,1,2,3] as const)('actual crematorium model and ghost share bounded stone geometry outside the worker, orientation %i',orientation=>{
  const world=deconstructionCamp(),s:Structure={...fixtureBuilding(world,'electric-crematorium',16,16,orientation),material:'granite-blocks',power:{on:false,parentId:null},bills:[]};world.structures=[s];
  const before=structuredClone(world),finished=crematoriumParts(world),preview=constructionPreviewParts(world,[{kind:s.kind,x:s.x,z:s.z,orientation,material:s.material}]);
  const normalize=(parts:typeof finished)=>parts.map(({key,targetId,ry=0,...p})=>({...p,ry})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  expect(finished).toHaveLength(19);expect(normalize([...preview.boxes,...preview.rotatedBoxes])).toEqual(normalize(finished));expect(world).toEqual(before);
  for(const p of finished){const angle=orientation*Math.PI/2,dx=p.x-s.x,dz=p.z-s.z,x=dx*Math.cos(angle)-dz*Math.sin(angle),z=dx*Math.sin(angle)+dz*Math.cos(angle);expect(Math.abs(x)+(p.sx??1)/2).toBeLessThanOrEqual(1.500001);expect(z-(p.sz??1)/2).toBeGreaterThanOrEqual(-.500001);expect(z+(p.sz??1)/2).toBeLessThanOrEqual(1.500001);expect(p.targetId).toBe(s.id);}
  expect(finished.some(p=>Math.hypot(p.x-cookingSpot(s).x,p.z-cookingSpot(s).z)<.3)).toBe(false);expect(structureBeauty(s)).toBe(-10);
});

test('solid volume retains no air; light, work role and heat use the real front room',()=>{
  const world=deconstructionCamp(),station:Structure={...fixtureBuilding(world,'electric-crematorium',16,16),material:'granite-blocks',power:{on:true,parentId:null},bills:[]};
  world.structures=[station];
  for(let z=12;z<=20;z++)for(let x=12;x<=20;x++)if(x===12||x===20||z===12||z===20)fixtureBuilding(world,'wall',x,z);
  const constructed:number[]=[];for(let z=12;z<=20;z++)for(let x=12;x<=20;x++)constructed.push(z*world.width+x);
  world.roofing={constructed,build:[],remove:[],cursor:0};
  const layout=reconcileTemperature(world),front=cookingSpot(station),room=world.thermal!.regions[layout.indices[front.z*world.width+front.x]!]!;
  expect(room.cells).toHaveLength(43);expect(layout.indices[station.z*world.width+station.x]).toBe(-1);
  room.temperature=20;applyThermalSources(world,layout);expect(room.temperature).toBeCloseTo(20+2/43,12);
  applyCookingHeat(world,station,.5);expect(room.temperature).toBeCloseTo(20+3.6/43,12);
  // Schema 301 (RimWorld 1.6): the crematorium has no workTableRoomRole, so alone it makes no workshop.
  const work=new WorkEnvironmentCache().read(world);expect(work.room(front)?.role).toBe('none');expect(work.production(station,front)).toMatchObject({outdoors:1,roomRole:1,station:1});expect(work.lightAt(front)).toBeGreaterThan(0);
  station.power!.on=false;const temperature=room.temperature;applyThermalSources(world,layout);expect(room.temperature).toBe(temperature);
});
