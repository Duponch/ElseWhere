import { withoutResearch,withMigratedResearch } from './scenarios/legacy-skills';
import { SCHEMA_VERSION } from '../src/sim/types';
import { withoutPawnSkills, withMigratedSkills } from './scenarios/legacy-skills';
import { OCCUPANCY } from '../src/sim/occupancy';
import { groundCapacity, storageCapacity } from '../src/sim/ground-placement';
import { requiredMaterial } from '../src/sim/construction-materials';
import { jobDuration } from '../src/sim/farming';
import { queryArea } from '../src/sim/designation';
import { pileSurfaces } from '../src/render/pile-surfaces';
import { WORLD_SCALE } from '../src/world/scale';
import { expect, test } from 'vitest';
import { createWorld, applyCommand, addGroundMaterial, refreshStock, stepWorld, serializeWorld, deserializeWorld, validateWorld } from '../src/sim/index';
import { blockedCells, reachableCells, routeToCell } from '../src/sim/pathfinding';
import { startTravel } from '../src/sim/movement';
import { constructionObstruction, constructionObstructions, constructionSiteFree } from '../src/sim/construction-rules';
import { constructionCandidates } from '../src/sim/construction-planner';
import { rotAge } from '../src/sim/food-preservation';
import type { World } from '../src/sim/types';

function camp(count=1) {
  const w=createWorld(42,32,32);expect(w.pawns.map(p=>p.moveCooldown),JSON.stringify(w.pawns)).toEqual([0,0,0]);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.pawns=w.pawns.slice(0,count);
  w.pawns.forEach((p,i)=>{p.x=8+i;p.z=10;p.hunger=100;p.rest=100;p.schedule.fill('anything');p.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,build:1,haul:0,gather:0,grow:0,cook:0};});refreshStock(w);return w;
}
function until(w:World,predicate:()=>boolean,limit=1200) {
  for(let i=0;i<limit&&!predicate();i++){stepWorld(w);expect(validateWorld(w),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns})).toEqual([]);}
  expect(predicate(),JSON.stringify({tick:w.tick,jobs:w.jobs,pawns:w.pawns})).toBe(true);
}

test('a builder clears a typed pile physically, preserves freshness and cargo on cancellation, supplies a frame and completes it',()=>{
  const w=camp();addGroundMaterial(w,'wood',5,{x:7,z:10},'wood');addGroundMaterial(w,'food',23,{x:12,z:10},'rice');
  expect(applyCommand(w,{type:'designate',kind:'wall',x:12,z:10}).ok).toBe(true);
  expect(w.jobs[0]!.construction).toBe('blueprint');expect(blockedCells(w)[332]).toBe(0);
  // Historical producers keep their ten-unit trip; new construction clearing
  // carries this whole rice stack under the current actor/item capacity.
  const historical={...w,schemaVersion:378 as typeof w.schemaVersion},blocked=blockedCells(historical);
  const reach=reachableCells(historical,w.pawns[0]!,blocked,new Set());
  expect(constructionCandidates(historical,w.pawns[0]!,blocked,reach,{remaining:32768,pairs:32768},constructionObstructions(historical))
    .find(c=>c.destination?.type==='aside')?.quantity).toBe(10);
  until(w,()=>w.pawns[0]!.haul?.destination.type==='aside'&&w.pawns[0]!.haul.phase==='deliver');
  const checkpoint=serializeWorld(w),copy=deserializeWorld(checkpoint),cancelled=deserializeWorld(checkpoint);
  expect(cancelled.pawns[0]!.haul?.quantity).toBe(23);
  expect(applyCommand(cancelled,{type:'cancel',x:12,z:10}).ok).toBe(true);expect(validateWorld(cancelled)).toEqual([]);
  expect(cancelled.pawns[0]!.haul).toBeNull();expect(cancelled.piles.filter(p=>p.item==='rice').reduce((n,p)=>n+p.quantity,0)).toBe(23);
  until(w,()=>w.jobs[0]?.construction==='frame');expect(w.jobs[0]!.escrow.wood).toBe(5);expect(blockedCells(w)[332]).toBe(0);
  until(w,()=>w.structures.length===1);expect(w.jobs).toHaveLength(0);expect(w.stock.wood).toBe(0);
  expect(w.piles.filter(p=>p.item==='rice').reduce((n,p)=>n+p.quantity,0)).toBe(23);
  for(const pile of w.piles.filter(p=>p.item==='rice'))expect(rotAge(pile,w.tick)).toBeCloseTo(w.tick,8);
  stepWorld(copy,w.tick-copy.tick);expect(copy).toEqual(w);expect(blockedCells(w)[332]).toBe(1);
});

test('plant clearing respects a rotated footprint, saves mid-cut, and transport-only actors can supply but cannot finish a frame',()=>{
  // A wall blueprint is not a finished wall: cutting on it must be allowed to
  // create the wood that the builder then clears and physically delivers.
  const wall=camp();wall.resources.push({id:wall.nextId++,kind:'tree',x:12,z:10,amount:12});
  expect(applyCommand(wall,{type:'designate',kind:'wall',x:12,z:10}).ok).toBe(true);
  until(wall,()=>wall.structures.length===1);expect(wall.structures[0]!.kind).toBe('wall');expect(wall.stock.wood).toBe(7);expect(wall.resources).toEqual([]);expect(validateWorld(wall)).toEqual([]);
  const w=camp();w.resources.push({id:w.nextId++,kind:'tree',x:12,z:10,amount:49},{id:w.nextId++,kind:'berries',x:13,z:10,amount:10,growth:.2,growthTick:0});
  w.resources.push({id:w.nextId++,kind:'tree',x:8,z:9,amount:5});w.pawns[0]!.priorities.gather=4;
  expect(applyCommand(w,{type:'designate',kind:'bed',orientation:1,x:12,z:10}).ok).toBe(true);
  expect(applyCommand(w,{type:'designate',kind:'chop',x:8,z:9}).ok).toBe(true);
  expect(constructionObstructions(w).get(w.jobs[0]!.id)).toEqual(constructionObstruction(w,w.jobs[0]!));
  until(w,()=>!!w.jobs[0]?.clearance&&w.jobs[0].clearance.progress>10);
  expect(w.resources.find(r=>r.x===8&&r.z===9)?.amount).toBe(5);
  const saved=deserializeWorld(serializeWorld(w));until(w,()=>w.structures.length===1);
  expect(w.resources).toHaveLength(1);expect(w.stock.wood).toBe(4);expect(w.stock.food).toBe(0);stepWorld(saved,w.tick-saved.tick);expect(saved).toEqual(w);
  const shipping=camp();shipping.pawns[0]!.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,build:0,haul:1,gather:0,grow:0,cook:0};addGroundMaterial(shipping,'wood',45,{x:7,z:10},'wood');
  expect(applyCommand(shipping,{type:'designate',kind:'bed',x:12,z:10}).ok).toBe(true);
  until(shipping,()=>shipping.jobs[0]?.escrow.wood===45);stepWorld(shipping,50);expect(shipping.jobs[0]!.progress).toBe(0);expect(shipping.jobs[0]!.construction).toBe('frame');
  expect(applyCommand(shipping,{type:'priority',pawnId:shipping.pawns[0]!.id,work:'build',value:1}).ok).toBe(true);until(shipping,()=>shipping.structures.length===1);
});

test('plans and frames remain traversable with calibrated edge delay, completion protects active corners, and V15 migration is strict',()=>{
  const w=camp(2);expect(applyCommand(w,{type:'designate',kind:'wall',x:11,z:10}).ok).toBe(true);const job=w.jobs[0]!;
  addGroundMaterial(w,'wood',5,{x:7,z:10},'wood');until(w,()=>job.construction==='frame');
  const path=reachableCells(w,{x:10,z:10},blockedCells(w),new Set());expect(path.costs[331]).toBe(1467);expect(routeToCell(w,{x:11,z:10},path)).toEqual([{x:11,z:10}]);
  const entrant=camp();Object.assign(entrant.pawns[0]!,{x:10,z:10});entrant.jobs=[{...structuredClone(job),id:entrant.nextId++,reservedBy:null,status:'pending',progress:0,escrow:{wood:0,food:0}}];
  startTravel(entrant,entrant.pawns[0]!,{x:11,z:10});expect(entrant.pawns[0]!.motion!.end-entrant.pawns[0]!.motion!.start).toBeCloseTo(3/.8+1.4,9);
  const mid=deserializeWorld(serializeWorld(entrant));expect(mid.pawns[0]!.motion!.terrainDelay).toBe(1.4);
  const builder=w.pawns[0]!,passer=w.pawns[1]!;
  for(const p of w.pawns){p.jobId=null;p.path=[];p.haul=null;p.state='idle';p.motion=null;p.moveCooldown=0;p.needCooldown=0;}
  Object.assign(builder,{x:12,z:10,jobId:job.id,state:'working'});Object.assign(job,{progress:jobDuration(w,job)-1,reservedBy:builder.id,status:'active'});
  Object.assign(passer,{x:10,z:10,priorities: {handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,build:0,haul:0,gather:0,grow:0,cook:0}});startTravel(w,passer,{x:11,z:11});
  expect(constructionSiteFree(w,job,builder.id)).toBe(false);stepWorld(w);expect(w.structures).toHaveLength(0);expect(validateWorld(w)).toEqual([]);
  until(w,()=>w.structures.length===1);expect(passer).toMatchObject({x:11,z:11});
  const old=camp();applyCommand(old,{type:'designate',kind:'wall',x:12,z:10});const raw=JSON.parse(serializeWorld(old));(raw.schemaVersion=15,withoutPawnSkills(raw));for(const a of raw.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete raw.deconstructed;delete raw.packed;for(const pawn of raw.pawns)delete pawn.orders;raw.jobs.forEach((j:any)=>{delete j.construction;delete j.material;});
  const loaded=deserializeWorld(JSON.stringify(raw));expect(loaded.jobs[0]!.construction).toBe('blueprint');expect(loaded.rng).toBe(old.rng);expect(loaded.pawns).toEqual(withMigratedSkills(old).pawns);
  raw.pawns[0].x=12;raw.pawns[0].z=10;expect(()=>deserializeWorld(JSON.stringify(raw))).toThrow(/version 15/);
  const invalid=JSON.parse(serializeWorld(loaded));invalid.jobs[0].construction='finished';expect(()=>deserializeWorld(JSON.stringify(invalid))).toThrow(/phase/);
  const rock=deserializeWorld(serializeWorld(loaded));rock.resources.push({id:rock.nextId++,kind:'rock',x:12,z:10,amount:1});
  expect(validateWorld(rock)).toContain('Construction overlaps existing content.');
  const sow=deserializeWorld(serializeWorld(loaded)),sowJob=sow.jobs[0]!;sow.jobs=[];
  expect(applyCommand(sow,{type:'area',action:'growing',from:{x:12,z:10},to:{x:12,z:10}}).ok).toBe(true);
  Object.assign(sowJob,{kind:'sow',material:undefined,construction:undefined,growingZoneId:sow.growingZones[0]!.id});sow.jobs=[sowJob];sow.resources.push({id:sow.nextId++,kind:'tree',x:12,z:10,amount:1});
  expect(validateWorld(sow)).toContain('Construction overlaps existing content.');
  // A meal place already reserved by an approaching colonist remains valid
  // after a blueprint is placed there; delivery waits until ingestion ends.
  const dining=camp(2),eater=dining.pawns[1]!;eater.hunger=20;eater.priorities.build=0;
  addGroundMaterial(dining,'food',1,{x:9,z:10},'survival-meal');addGroundMaterial(dining,'wood',5,{x:7,z:10},'wood');
  // Synthetic checkpoint after pickup, with a free floor meal destination.
  const portion=dining.piles.find(p=>p.item==='survival-meal')!;portion.owner={type:'pawn',pawnId:eater.id};
  eater.need={kind:'eat',phase:'travel',sourcePileId:portion.id,carryPileId:portion.id,quantity:1,progress:0,dining:{target:{x:10,z:9},seatId:null,tableId:null}};
  eater.state='moving';eater.path=[{x:9,z:9},{x:10,z:9}];expect(validateWorld(dining)).toEqual([]);
  if(eater.need?.kind!=='eat'||!eater.need.dining)throw new Error('Missing dining place');
  const target=eater.need.dining.target;
  expect(applyCommand(dining,{type:'designate',kind:'wall',...target}).ok).toBe(true);
  expect(constructionSiteFree(dining,dining.jobs[0]!,dining.pawns[0]!.id)).toBe(false);
  const diningCopy=deserializeWorld(serializeWorld(dining));
  until(dining,()=>dining.pawns.some(p=>p.memories.length>0)||eater.need===null);
  expect(dining.jobs[0]!.construction).toBe('blueprint');
  stepWorld(diningCopy,dining.tick-diningCopy.tick);expect(diningCopy).toEqual(dining);
});


test('construction profiles preserve compatible stacks, clear incompatible ones, trim zones at blueprint time and replay through completion',()=>{
  for(const kind of ['wall','bed','campfire','table','stool','horseshoes'] as const) {
    const w=camp();addGroundMaterial(w,'wood',requiredMaterial({kind,material:'wood'},'wood'),{x:7,z:10},'wood');addGroundMaterial(w,'food',23,{x:12,z:10},'rice');
    const rice=w.piles.find(p=>p.item==='rice')!,id=rice.id;
    expect(applyCommand(w,{type:'stockpile',x:12,z:10,enabled:true}).ok).toBe(true);
    expect(applyCommand(w,{type:'designate',kind,x:12,z:10,orientation:1}).ok).toBe(true);
    expect(w.stockpiles.length).toBe(OCCUPANCY[kind].zones?1:0);expect(rice.owner).toMatchObject({type:'ground',x:12,z:10});
    if(w.stockpiles.length)expect(storageCapacity(w,w.stockpiles[0]!,'rice')).toBe(OCCUPANCY[kind].store?52:0);
    expect(constructionObstructions(w).get(w.jobs[0]!.id)).toEqual(constructionObstruction(w,w.jobs[0]!));
    expect(!!constructionObstruction(w,w.jobs[0]!).pile).toBe(OCCUPANCY[kind].clearItems);
    const copy=deserializeWorld(serializeWorld(w));let clearing=false;
    for(let i=0;i<1200&&!w.structures.length;i++){stepWorld(w);stepWorld(copy);clearing ||= w.pawns[0]!.haul?.destination.type==='aside';expect(validateWorld(w),kind).toEqual([]);expect(copy).toEqual(w);}
    expect(w.structures[0]?.kind).toBe(kind);expect(clearing).toBe(OCCUPANCY[kind].clearItems);expect(w.stock).toEqual({wood:0,food:23});
    expect(w.piles.filter(p=>p.item==='rice').reduce((n,p)=>n+p.quantity,0)).toBe(23);
    if(!OCCUPANCY[kind].clearItems)expect(w.piles.find(p=>p.id===id)?.owner).toMatchObject({type:'ground',x:12,z:10});
    for(const pile of w.piles)expect(rotAge(pile,w.tick)).toBe(w.tick);
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
    const area=queryArea(w,{type:'area',action:'stockpile',from:{x:12,z:10},to:{x:13,z:10}});expect(area.ok).toBe(true);
    // Existing zones are skipped, and every new zone uses the same profile as its blueprint.
    expect(applyCommand(w,{type:'stockpile',x:12,z:10,enabled:true}).ok).toBe(OCCUPANCY[kind].zones);
    if(kind==='table')expect(pileSurfaces(w).get(12+10*w.width)?.y).toBe(WORLD_SCALE.tableHeight);
    if(kind==='stool')expect(pileSurfaces(w).get(12+10*w.width)?.y).toBe(WORLD_SCALE.stoolHeight);
  }
});

test('replacing storage with a blueprint releases active and queued deliveries atomically, preserves other zone cells, and migrates old furniture contents',()=>{
  for(const kind of ['wall','campfire','stool'] as const) {
    const w=camp(2),p=w.pawns[0]!;for(const q of w.pawns)q.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,art:0,craft:2,mine:2,build:0,haul:0,gather:0,grow:0,cook:0};p.priorities.haul=1;
    addGroundMaterial(w,'food',30,{x:10,z:10},'rice');const pile=w.piles[0]!;
    expect(applyCommand(w,{type:'area',action:'stockpile',from:{x:15,z:10},to:{x:16,z:10}}).ok).toBe(true);
    for(const queue of [false,true])expect(applyCommand(w,{type:'order-haul',pawnId:p.id,target:{type:'pile',pileId:pile.id},queue}).ok).toBe(true);
    until(w,()=>p.haul?.phase==='deliver');const held=w.piles.find(p=>p.owner.type==='pawn')!,age=rotAge(held,w.tick),zones=structuredClone(w.stockpiles);
    const crowded=JSON.parse(serializeWorld(w)) as World;
    const occupied=new Set(crowded.piles.filter(p=>p.owner.type==='ground').map(p=>p.owner.type==='ground'?p.owner.z*crowded.width+p.owner.x:-1));
    for(let i=0;i<crowded.width*crowded.height;i++)if(!occupied.has(i)){const reserved=i===15+10*crowded.width;crowded.piles.push({id:crowded.nextId++,kind:reserved?'food':'wood',item:reserved?'rice':'wood',quantity:reserved?55:75,owner:{type:'ground',x:i%crowded.width,z:Math.floor(i/crowded.width)},...(reserved?{rot:{progress:0,atTick:crowded.tick}}:{})});}
    refreshStock(crowded);const crowdedRaw=serializeWorld(crowded);
    if(kind!=='stool'){expect(applyCommand(crowded,{type:'designate',kind,x:15,z:10}).ok).toBe(false);expect(serializeWorld(crowded)).toBe(crowdedRaw);}
    const failed=serializeWorld(w);expect(applyCommand(w,{type:'designate',kind,x:-1,z:10}).ok).toBe(false);expect(serializeWorld(w)).toBe(failed);
    expect(applyCommand(w,{type:'designate',kind,x:15,z:10}).ok).toBe(true);expect(validateWorld(w)).toEqual([]);
    if(kind==='stool'){expect(p.haul).not.toBeNull();expect(p.orders.queue).toHaveLength(1);expect(w.stockpiles).toEqual(zones);}
    else {expect(p.haul).toBeNull();expect(p.orders.queue).toEqual([]);expect(w.piles.find(p=>p.id===held.id)?.owner.type).toBe('ground');expect(rotAge(held,w.tick)).toBe(age);}
    expect(w.stock.food).toBe(30);expect(w.stockpiles.some(z=>z.x===16)).toBe(true);expect(w.stockpiles.some(z=>z.x===15)).toBe(kind!=='wall');
    expect(deserializeWorld(serializeWorld(w))).toEqual(w);
  }
  const legacy=camp();legacy.structures.push({id:legacy.nextId++,kind:'bed',x:12,z:10,orientation:1,footprint:'standard'});
  addGroundMaterial(legacy,'food',10,{x:7,z:10},'rice');const id=legacy.piles[0]!.id;
  legacy.piles[0]!.owner={type:'ground',x:13,z:10};const raw=JSON.parse(JSON.stringify(legacy));((raw.schemaVersion=20,withoutResearch(raw)),withoutPawnSkills(raw));for(const a of raw.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete raw.deconstructed;delete raw.packed;
  const migrated=deserializeWorld(JSON.stringify(raw));expect(migrated.schemaVersion).toBe(SCHEMA_VERSION);expect(migrated.stock.food).toBe(10);expect(migrated.piles[0]!.id).toBe(id);expect(migrated.piles[0]!.rot).toEqual(legacy.piles[0]!.rot);
  expect(migrated.piles[0]!.owner).not.toMatchObject({x:13,z:10});expect(migrated.pawns).toEqual(withMigratedSkills(legacy).pawns);expect(validateWorld(migrated)).toEqual([]);
  const full=structuredClone(raw);const used=new Set(full.piles.filter((p:any)=>p.owner.type==='ground').map((p:any)=>p.owner.z*full.width+p.owner.x));
  for(let i=0;i<full.width*full.height;i++)if(!used.has(i))full.piles.push({id:full.nextId++,kind:'wood',item:'wood',quantity:75,owner:{type:'ground',x:i%full.width,z:Math.floor(i/full.width)}});
  refreshStock(full);expect(()=>deserializeWorld(JSON.stringify(full))).toThrow(/No ground cell/);
  expect(groundCapacity(migrated,{x:13,z:10},'rice')).toBe(0);
  const invalid=JSON.parse(serializeWorld(migrated));invalid.stockpiles.push({id:invalid.nextId++,x:12,z:10,filters:{wood:true,food:true},priority:2,capacity:75});expect(()=>deserializeWorld(JSON.stringify(invalid))).toThrow();
  const oldOverlap=JSON.parse(serializeWorld(migrated));(oldOverlap.schemaVersion=20,withoutPawnSkills(oldOverlap));for(const a of oldOverlap.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete oldOverlap.deconstructed;delete oldOverlap.packed;oldOverlap.structures[0].kind='stool';oldOverlap.stockpiles.push({id:oldOverlap.nextId++,x:12,z:10,filters:{wood:true,food:true},priority:2,capacity:75});expect(()=>deserializeWorld(JSON.stringify(oldOverlap))).toThrow(/version 20/);
  // Zone compatibility is symmetric: painting after a plan/building uses the
  // same footprint, while plants and compatible furniture remain paintable.
  const field=camp();field.pawns[0]!.priorities.build=0;
  expect(applyCommand(field,{type:'area',action:'growing',from:{x:12,z:10},to:{x:14,z:10}}).ok).toBe(true);
  const zone=structuredClone(field.growingZones[0]!);
  expect(applyCommand(field,{type:'designate',kind:'bed',x:12,z:10,orientation:1}).ok).toBe(true);
  expect(field.growingZones).toEqual([{...zone,cells:[334]}]);expect(validateWorld(field)).toEqual([]);
  expect(applyCommand(field,{type:'area',action:'growing',from:{x:12,z:10},to:{x:13,z:10}}).ok).toBe(false);
  delete field.jobs[0]!.material; // Historical V20 blueprint retains its old recipe after migration.
  const oldField=JSON.parse(serializeWorld(field));(oldField.schemaVersion=20,withoutPawnSkills(oldField));for(const a of oldField.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete oldField.deconstructed;delete oldField.packed;oldField.growingZones=[zone];
  const newField=deserializeWorld(JSON.stringify(oldField));expect(newField).toEqual(withMigratedSkills(field));
  (oldField.schemaVersion=21,withoutPawnSkills(oldField));for(const a of oldField.pawns){delete a.priorities.mine;delete a.priorities.craft;}delete oldField.deconstructed;delete oldField.packed;expect(()=>deserializeWorld(JSON.stringify(oldField))).toThrow(/Growing zone overlaps/);
  expect(applyCommand(field,{type:'cancel',x:12,z:10}).ok).toBe(true);expect(field.growingZones[0]!.cells).toEqual([334]);
  for(const kind of ['wall','bed','table','stool','campfire','horseshoes'] as const) {
    const f=camp();f.structures.push({id:f.nextId++,kind,x:12,z:10,orientation:1,footprint:'standard'});
    const selection=queryArea(f,{type:'area',action:'growing',from:{x:12,z:10},to:{x:13,z:10}});
    expect(selection.ok&&selection.cells.includes(332)).toBe(OCCUPANCY[kind].zones);
  }
  const vegetation=camp();vegetation.resources.push({id:vegetation.nextId++,kind:'tree',x:12,z:10,amount:10});
  expect(applyCommand(vegetation,{type:'designate',kind:'chop',x:12,z:10}).ok).toBe(true);
  expect(applyCommand(vegetation,{type:'area',action:'growing',from:{x:12,z:10},to:{x:12,z:10}}).ok).toBe(true);
});
