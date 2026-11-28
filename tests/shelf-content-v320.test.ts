import {expect,test} from 'vitest';
import {applyCommand,createWorld} from '../src/sim/index';
import type {Job,MaterialPile,Structure} from '../src/sim/types';
import {footprintCells,footprintContains} from '../src/sim/definitions';
import {FURNITURE_DEFINITIONS,FURNITURE_MATERIALS,isFurnitureMaterial} from '../src/sim/furniture-stats';
import {constructionMaterials,constructionRecipe,validConstructionMaterial} from '../src/sim/construction-materials';
import {structureMaxHp} from '../src/sim/thing-damage-rules';
import {FURNITURE_TRAVEL,canStandAt} from '../src/sim/furniture-travel';
import {STRUCTURE_SHOT_FILL} from '../src/sim/combat-content';
import {structureRoomStandable,structureRoomMarketValue} from '../src/sim/room-market-value';
import {constructionObstruction,constructionObstructions} from '../src/sim/construction-rules';
import {COMPLEX_FURNITURE_RESEARCH_COST} from '../src/sim/research';
import {deconstructionCamp} from './scenarios/deconstruction';

test.each(['shelf','small-shelf'] as const)('%s uses ordinary stuff factors without quality and rejects historical construction',kind=>{
  const def=FURNITURE_DEFINITIONS[kind],amount=kind==='shelf'?20:10,work=kind==='shelf'?500:250,hp=kind==='shelf'?100:50;
  expect(def).toMatchObject({stuff:amount,coreWork:work,maxHitPoints:hp,quality:false,research:'complex-furniture',constructionSkill:0});
  expect(constructionMaterials(kind)).toEqual(['wood','steel','granite-blocks','limestone-blocks','marble-blocks','sandstone-blocks','slate-blocks']);
  for(const material of constructionMaterials(kind)){
    if(!isFurnitureMaterial(material))throw Error('Shelf admitted a material outside its native furniture catalogue');
    const factors=FURNITURE_MATERIALS[material],recipe=constructionRecipe({kind,material});
    expect(recipe.ingredients).toEqual([{item:material,quantity:amount}]);
    expect(recipe.coreWork).toBe(Math.round(work*factors.workFactor+factors.workOffset));
    expect(recipe.work).toBe(Math.ceil(recipe.coreWork/10));
    expect(structureMaxHp({kind,material})).toBe(Math.round(hp*factors.hitPointsFactor));
    expect(validConstructionMaterial(kind,material,228)).toBe(false);expect(validConstructionMaterial(kind,material,229)).toBe(true);
  }
  expect(validConstructionMaterial(kind,undefined)).toBe(false);expect(validConstructionMaterial(kind,'cloth')).toBe(false);
  const s:Structure={id:100,kind,x:5,z:5,orientation:0,footprint:'standard',material:'steel'};
  expect(structureRoomMarketValue(s)).toBeGreaterThan(0);expect(structureRoomStandable(kind)).toBe(false);
  expect(FURNITURE_TRAVEL[kind]).toEqual({delay:5,stand:false,repeat:true});expect(STRUCTURE_SHOT_FILL[kind]).toBe(.4);
});

test.each(['shelf','small-shelf'] as const)('%s is admitted only after actual Complex furniture research',kind=>{
  const w=deconstructionCamp(),before=structuredClone(w);
  expect(applyCommand(w,{type:'designate',kind,x:17,z:18,material:'wood'}).ok).toBe(false);expect(w).toEqual(before);
  w.research={project:null,points:0,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:w.tick}};
  expect(applyCommand(w,{type:'designate',kind,x:17,z:18,material:'wood'}).ok).toBe(true);
  expect(w.jobs[0]).toMatchObject({kind,material:'wood',status:'pending'});
});

test.each([0,1,2,3] as const)('shelf footprint rotates physically and remains transit-only, orientation %i',orientation=>{
  const w=createWorld(42,32),s:Structure={id:100,kind:'shelf',x:16,z:16,orientation,footprint:'standard',material:'steel'};
  w.structures=[s];w.jobs=[];w.piles=[];w.tiles=w.tiles.map(()=>({terrain:'grass'}));
  const cells=footprintCells(s);expect(cells).toHaveLength(2);expect(new Set(cells.map(c=>`${c.x}:${c.z}`)).size).toBe(2);
  const offset=[[1,0],[0,-1],[-1,0],[0,1]][orientation]!;expect(cells).toEqual([{x:16,z:16},{x:16+offset[0]!,z:16+offset[1]!}]);
  for(let z=14;z<=18;z++)for(let x=14;x<=18;x++)expect(footprintContains(s,{x,z})).toBe(cells.some(c=>c.x===x&&c.z===z));
  for(const c of cells)expect(canStandAt(w,c)).toBe(false);
  expect(footprintCells({...s,kind:'small-shelf'})).toEqual([{x:16,z:16}]);
});

test('shelf construction retains compatible ground contents regardless of policy, clearing actual exclusions and packed furniture only',()=>{
  const w=deconstructionCamp(),job:Job={id:800,kind:'shelf',x:16,z:16,orientation:0,footprint:'standard',material:'wood',status:'active',reservedBy:null,progress:0,escrow:{wood:0,food:0}};
  w.jobs=[job];const first=footprintCells(job)[0]!,last=footprintCells(job).at(-1)!;
  const wood:MaterialPile={id:801,kind:'wood',item:'wood',quantity:17,owner:{type:'ground',...first}};
  const rice:MaterialPile={id:802,kind:'food',item:'rice',quantity:13,owner:{type:'ground',...last}};
  w.piles=[wood,rice];expect(constructionObstruction(w,job)).toEqual({plant:undefined,pile:undefined,pack:undefined});expect(constructionObstructions(w).get(job.id)).toEqual({});
  const chunk:MaterialPile={id:803,kind:'chunk',item:'granite-chunk',quantity:1,owner:{type:'ground',...last}};
  w.piles.push(chunk);expect(constructionObstruction(w,job).pile).toBe(chunk);expect(constructionObstructions(w).get(job.id)?.pile).toBe(chunk);
  w.piles.pop();const pack={building:{id:804,kind:'stool' as const,x:0,z:0,orientation:0 as const,footprint:'standard' as const,material:'wood' as const},owner:{type:'ground' as const,...last}};
  w.packed=[pack];expect(constructionObstruction(w,job).pack).toBe(pack);expect(constructionObstructions(w).get(job.id)?.pack).toBe(pack);
});
