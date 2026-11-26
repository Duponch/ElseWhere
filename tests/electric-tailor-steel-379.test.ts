import {expect,test} from 'vitest';
import {constructionRecipe,newConstructionRecipe379} from '../src/sim/construction-materials.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {medicalCamp} from './scenarios/health.ts';
import {CLOTHING_RESEARCH_COST} from '../src/sim/research.ts';

test('new steel electric tailoring combines75Stuff and50fixedsteel while historical acquisition and wood remain exact',()=>{
  const old={kind:'electric-tailor-bench' as const,material:'steel' as const};
  expect(constructionRecipe(old).ingredients).toEqual([{item:'steel',quantity:50},{item:'component',quantity:2}]);
  expect(newConstructionRecipe379(old,378).ingredients).toEqual(constructionRecipe(old).ingredients);
  expect(newConstructionRecipe379(old,379).ingredients).toEqual([{item:'steel',quantity:125},{item:'component',quantity:2}]);
  expect(constructionRecipe({...old,tailorSteel379:true}).ingredients).toEqual(newConstructionRecipe379(old,379).ingredients);
  expect(newConstructionRecipe379({kind:'electric-tailor-bench',material:'wood'},379).ingredients)
    .toEqual([{item:'wood',quantity:75},{item:'steel',quantity:50},{item:'component',quantity:2}]);
});
test('new steel tailoring pays its125steel through actual deliveries and keeps the acquired marker on the completed bench and reload',()=>{
  const world=medicalCamp(),pawn=world.pawns[0]!;delete pawn.background;delete pawn.traits;
  world.research={project:null,...world.research,points:CLOTHING_RESEARCH_COST,completedAt:world.tick};
  pawn.priorities.build=1;pawn.skills.construction.level=10;pawn.x=4;pawn.z=5;
  addMaterial(world,'steel',75,{type:'ground',x:5,z:5},'steel');addMaterial(world,'steel',50,{type:'ground',x:6,z:5},'steel');addMaterial(world,'component',2,{type:'ground',x:5,z:6},'component');
  expect(applyCommand(world,{type:'designate',kind:'electric-tailor-bench',material:'steel',x:8,z:5})).toEqual({ok:true});
  const job=world.jobs.find(j=>j.kind==='electric-tailor-bench')!;expect(job.tailorSteel379).toBe(true);
  expect(constructionRecipe(job).ingredients).toEqual([{item:'steel',quantity:125},{item:'component',quantity:2}]);
  for(let i=0;i<1000&&!world.structures.some(s=>s.kind==='electric-tailor-bench'&&s.x===job.x&&s.z===job.z);i++)stepWorld(world);
  const bench=world.structures.find(s=>s.kind==='electric-tailor-bench'&&s.x===job.x&&s.z===job.z);expect(bench).toMatchObject({kind:'electric-tailor-bench',material:'steel',tailorSteel379:true});
  expect(world.jobs.some(j=>j.id===job.id)).toBe(false);
  expect(world.piles.filter(p=>p.item==='steel'||p.item==='component').reduce((n,p)=>n+p.quantity,0)).toBe(0);
  expect(constructionRecipe(bench!).ingredients).toEqual([{item:'steel',quantity:125},{item:'component',quantity:2}]);
  expect(validateWorld(world)).toEqual([]);expect(deserializeWorld(serializeWorld(world))).toEqual(world);
});
