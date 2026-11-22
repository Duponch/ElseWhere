import { createWorld,applyCommand } from '../../src/sim/index';
import { addMaterial,refreshStock } from '../../src/sim/materials';
import { enableWildlife } from '../../src/sim/wildlife';
import { legacyHumanAge } from '../../src/sim/human-age.ts';
import { newCorePathBudget297 } from '../../src/sim/core-path-budget-297.ts';
import type { Pawn,World } from '../../src/sim/types';

/** Controlled real-shot fixture: a healthy armed hunter, a cook and live prey.
 * Injury, death, corpse and ingredients must all arise through gameplay. */
export function huntingCamp(seed=81733):World {
  const w=createWorld(seed,32,32);w.tick=2000;
  // The world is placed at tick 2000: its physical path budget belongs to that tick.
  if(w.corePathBudget297)w.corePathBudget297=newCorePathBudget297(w.tick);
  w.rng=seed;w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.jobs=[];w.structures=[];w.piles=[];w.stockpiles=[];w.growingZones=[];w.pawns=w.pawns.slice(0,2);
  // This controlled pre-injury arena starts with healthy workers; health
  // records created by later tests use the prepared tick explicitly.
  for(const pawn of w.pawns){pawn.age=legacyHumanAge();delete pawn.health;}
  for(const [i,p] of w.pawns.entries()){
    Object.assign(p,{x:i===0?4:8,z:i===0?10:6,hunger:100,rest:100});p.recreation.level=100;p.schedule.fill('work');p.bedId=null;
    for(const key of Object.keys(p.priorities) as (keyof Pawn['priorities'])[])p.priorities[key]=0;
  }
  const hunter=w.pawns[0]!,cook=w.pawns[1]!;hunter.priorities.hunt=1;hunter.skills.shooting.level=20;hunter.skills.shooting.passion=1;cook.priorities.cook=1;cook.skills.cooking={level:8,xp:0,dailyXp:0,passion:1};
  addMaterial(w,'weapon',1,{type:'equipment',pawnId:hunter.id},'revolver');addMaterial(w,'wood',20,{type:'ground',x:10,z:7},'wood');
  w.resources.push({id:w.nextId++,kind:'berries',x:10,z:10,amount:10,growth:1,growthTick:w.tick});enableWildlife(w,1);
  Object.assign(w.wildlife!.animals[0]!,{x:10,z:10,food:.2,rest:1,nextDecision:w.tick+5});
  const storage=applyCommand(w,{type:'stockpile',x:8,z:8,enabled:true,filters:{wood:false,food:false,corpse:true}});if(!storage.ok)throw Error(storage.reason);
  refreshStock(w);return w;
}
