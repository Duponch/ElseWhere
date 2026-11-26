import {expect,test} from 'vitest';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {queryOrderOptions} from '../src/sim/player-orders.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {ITEM_DEFINITIONS} from '../src/sim/items.ts';
import {validateWorld} from '../src/sim/serialization.ts';
import {COMPLEX_FURNITURE_RESEARCH_COST} from '../src/sim/research.ts';
import {medicalCamp} from './scenarios/health.ts';

function camp(count=1){
  const world=medicalCamp(count),pawn=world.pawns[0]!;
  world.research={points:0,project:null,...world.research,complexFurniture:{points:COMPLEX_FURNITURE_RESEARCH_COST,completedAt:world.tick}};
  for(const p of world.pawns){delete p.background;delete p.traits;p.priorities.build=1;p.skills.construction.level=10;p.x=4;p.z=5;p.hunger=100;p.rest=100;}
  return {world,pawn};
}
test('a steel shelf names its forbidden steel; authorizing the real source enables one physical20unit delivery and construction',()=>{
  const {world,pawn}=camp();
  addMaterial(world,'wood',75,{type:'ground',x:6,z:5},'wood');
  addMaterial(world,'steel',75,{type:'ground',x:5,z:5},'steel');
  const steel=world.piles.find(p=>p.item==='steel')!;
  expect(applyCommand(world,{type:'material-forbid',pileId:steel.id,forbidden:true})).toEqual({ok:true});
  expect(applyCommand(world,{type:'designate',kind:'shelf',material:'steel',x:8,z:5})).toEqual({ok:true});
  const job=world.jobs.find(j=>j.kind==='shelf')!,before=JSON.stringify(world);
  const options=queryOrderOptions(world,pawn.id,job),delivery=options.find(o=>o.haulTarget?.type==='job');
  expect(options.find(o=>o.jobId===job.id&&!o.haulTarget)?.reason).toContain('20 Acier');
  expect(delivery).toMatchObject({enabled:false});expect(delivery!.reason).toContain('Acier');expect(delivery!.reason).toContain('75 interdits');
  expect(delivery!.reason).toContain('0 disponibles');expect(JSON.stringify(world)).toBe(before);
  expect(applyCommand(world,{type:'material-forbid',pileId:steel.id,forbidden:false})).toEqual({ok:true});
  expect(queryOrderOptions(world,pawn.id,job).find(o=>o.haulTarget?.type==='job')?.enabled).toBe(true);
  expect(applyCommand(world,{type:'order-haul',pawnId:pawn.id,target:{type:'job',jobId:job.id},queue:false})).toEqual({ok:true});
  expect(pawn.haul?.quantity).toBe(20);expect(steel.quantity).toBe(75);
  for(let i=0;i<500&&!world.structures.some(s=>s.kind==='shelf'&&s.x===job.x&&s.z===job.z);i++)stepWorld(world);
  expect(world.structures.find(s=>s.kind==='shelf'&&s.x===job.x&&s.z===job.z)).toMatchObject({kind:'shelf',material:'steel'});
  expect(world.jobs.some(j=>j.id===job.id)).toBe(false);
  expect(world.piles.filter(p=>p.item==='steel').reduce((n,p)=>n+p.quantity,0)).toBe(55);
  expect(world.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(75);expect(validateWorld(world)).toEqual([]);
});
test('different Stuff is not a substitute and a disconnected exact material is named inaccessible',()=>{
  const {world,pawn}=camp();
  addMaterial(world,'blocks',25,{type:'ground',x:5,z:5},'limestone-blocks');
  expect(applyCommand(world,{type:'designate',kind:'wall',material:'granite-blocks',x:8,z:5})).toEqual({ok:true});
  const job=world.jobs[0]!;
  const reason=()=>queryOrderOptions(world,pawn.id,job).find(o=>o.haulTarget?.type==='job')?.reason;
  expect(reason()).toContain(ITEM_DEFINITIONS['granite-blocks'].label);expect(reason()).toContain('0 disponibles');
  addMaterial(world,'blocks',25,{type:'ground',x:20,z:5},'granite-blocks');
  world.tiles=world.tiles.map((t,i)=>i%world.width===12?{terrain:'rock'}:t);
  expect(reason()).toContain('25 inaccessibles');expect(reason()).toContain('0 disponibles');
});
