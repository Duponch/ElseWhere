import { expect, test } from 'vitest';
import { candidateAccess } from '../src/sim/candidate-access';
import { applyCommand, createWorld } from '../src/sim/engine';
import { planWork, type SearchStats } from '../src/sim/work-planner';
import { addGroundMaterial, refreshStock } from '../src/sim/materials';
import { deconstructionCamp, fixtureBuilding } from './scenarios/deconstruction';
import { foodSearchGoals, selectFood } from '../src/sim/food-selection';
import type { MaterialPile } from '../src/sim/types';
import { newDoorState } from '../src/sim/door-rules';
import { routeCost, blockedCells, interactionGoals, reachableCells, routeToJob, routeToCell } from '../src/sim/pathfinding';

test('logistics proves only competitive access, retains ties and skips an inaccessible higher-priority reserve',()=>{
  const setup=()=>{
    const w=deconstructionCamp(1,64),p=w.pawns[0]!;p.x=10;p.z=10;p.priorities={handle:0,clean:0,firefight:0,warden:0,basic:3,hunt:0,research:0, patient:0,bedrest:0,doctor:0,mine:0,art:0,craft:0,gather:0,build:0,haul:1,grow:0,cook:0};
    addGroundMaterial(w,'wood',20,{x:11,z:10},'wood');
    for(const [x,z] of [[12,10],[11,11],[55,55]])expect(applyCommand(w,{type:'stockpile',x:x!,z:z!,enabled:true,filters:{wood:true,food:false},capacity:75,priority:3}).ok).toBe(true);
    return {w,p};
  };
  const {w,p}=setup(),stats:SearchStats={searches:[]},budget={remaining:8,pairs:32768,stats};
  planWork(w,p,()=>blockedCells(w),new Set(),budget);
  expect(p.haul?.destination).toEqual({type:'stockpile',stockpileId:w.stockpiles[0]!.id});
  // RimWorld's haul scan (schema 301) looks at the closest accepting cell
  // first and stops there: one pair, not the whole window of three.
  expect(p.haul?.quantity).toBe(10);expect(budget.pairs).toBe(32768-1);expect(budget.remaining).toBe(7);
  // Both close cells tie. Array order chooses the first; the remote reserve
  // cannot beat it and must not flood the map merely to prove its existence.
  expect(stats.searches[0]!.connectivityVisited).toBeLessThan(100);
  const blockedCase=setup();
  expect(applyCommand(blockedCase.w,{type:'stockpile',x:30,z:30,enabled:true,filters:{wood:true,food:false},capacity:75,priority:4}).ok).toBe(true);
  for(let dx=-2;dx<=2;dx++)for(let dz=-2;dz<=2;dz++)if(Math.abs(dx)===2||Math.abs(dz)===2)fixtureBuilding(blockedCase.w,'wall',30+dx,30+dz);
  planWork(blockedCase.w,blockedCase.p,()=>blockedCells(blockedCase.w),new Set(),{remaining:8,pairs:32768});
  expect(blockedCase.p.haul?.destination).toEqual({type:'stockpile',stockpileId:blockedCase.w.stockpiles[0]!.id});
  // A new decision must see the opening and may select the superior reserve.
  blockedCase.p.haul=null;blockedCase.p.path=[];
  blockedCase.w.structures=blockedCase.w.structures.filter(s=>!(s.x===28&&s.z===30));
  planWork(blockedCase.w,blockedCase.p,()=>blockedCells(blockedCase.w),new Set(),{remaining:8,pairs:32768});
  expect(blockedCase.w.pawns[0]!.haul?.destination).toEqual({type:'stockpile',stockpileId:blockedCase.w.stockpiles[3]!.id});
});

// Independent O(V²) oracle on small maps: no engine frontier, neighbour helper
// or pruning logic. Different tie order is fine; optimal costs must agree.
function oracleCosts(width:number,height:number,start:number,blocked:Uint8Array,traffic:Set<number>,doors=new Map<number,number>()):number[] {
  const costs=Array<number>(width*height).fill(Infinity),done=new Set<number>();costs[start]=0;
  for(;;) {
    let cell=-1;
    for(let i=0;i<costs.length;i++)if(!done.has(i)&&costs[i]!<Infinity&&(cell===-1||costs[i]!<costs[cell]!))cell=i;
    if(cell===-1)return costs;
    done.add(cell);const x=cell%width,z=Math.floor(cell/width);
    for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++) {
      if(!dx&&!dz||x+dx<0||x+dx>=width||z+dz<0||z+dz>=height)continue;
      const next=(z+dz)*width+x+dx;
      if(blocked[next]||traffic.has(next))continue;
      if(dx&&dz&&(blocked[cell+dx]||traffic.has(cell+dx)||blocked[cell+dz*width]||traffic.has(cell+dz*width)||doors.has(cell+dx)||doors.has(cell+dz*width)))continue;
      costs[next]=Math.min(costs[next]!,costs[cell]!+(dx&&dz?1414:1000)+(doors.get(next)??0));
    }
  }
}

test('goal-bounded floods retain the full-flood nearest food and exact path across ties, walls and unreachable goals', () => {
  let random = 123456789, reduced = 0;
  const draw = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random; };
  for (let run = 0; run < 120; run++) {
    const w = createWorld(run, 16, 16), start = { x: 2, z: 2 };
    // This oracle models terrain and doors only, not the natural chunks that
    // new worlds also carry as physical ground piles since V129.
    w.structures = []; w.jobs = []; w.resources = []; w.piles=[]; refreshStock(w);
    w.tiles = w.tiles.map(() => ({ terrain: draw() % 5 === 0 ? 'rock' : 'grass' })); w.tiles[34] = { terrain: 'grass' };
    const doors=new Map<number,number>();
    if(run%2)for(let n=0;n<5;n++) {
      const index=draw()%256;if(index===34||w.tiles[index]!.terrain==='rock'||doors.has(index))continue;
      const material=(['wood','steel','granite-blocks'] as const)[n%3]!,open=n%2===0,state=newDoorState(w.tick);state.open=open;state.from=open?1:0;state.forbidden=n===4;
      w.structures.push({id:w.nextId++,kind:'door',material,x:index%16,z:Math.floor(index/16),orientation:0,footprint:'standard',door:state});
      doors.set(index,open?0:material==='wood'?1267:material==='steel'?1500:3333);
    }
    const foods = Array.from({ length: 12 }, (_, id) => ({ id, x: draw() % 16, z: (draw() >>> 9) % 16 }));
    const blocked = blockedCells(w), occupied = new Set<number>();
    const full = reachableCells(w, start, blocked, occupied);
    const bounded = reachableCells(w, start, blocked, occupied, interactionGoals(w, foods));
    const groups=foods.map(food=>interactionGoals(w,[food]));
    const all=reachableCells(w,start,blocked,occupied,undefined,groups);
    for(const food of foods)expect(routeToJob(w,food,all,true),`all groups seed ${run} target ${food.id}`).toEqual(routeToJob(w,food,full,true));
    const exact=reachableCells(w,start,blocked,occupied,undefined,foods.map(f=>new Set([f.z*16+f.x])));
    for(const food of foods)expect(routeToCell(w,food,exact),`exact groups seed ${run} target ${food.id}`).toEqual(routeToCell(w,food,full));
    const traffic=new Set(Array.from({length:40},()=>draw()%256).filter(i=>i!==34));
    // A free target can still be completely enclosed by transient occupants.
    const trafficFull=reachableCells(w,start,blocked,traffic),trafficGroups=reachableCells(w,start,blocked,traffic,undefined,groups);
    expect(Array.from(trafficFull.costs),`independent distances seed ${run}`).toEqual(oracleCosts(16,16,34,blocked,traffic,doors));
    const gridSnapshot=blocked.slice(),trafficSnapshot=new Set(traffic),access=candidateAccess(w,start,gridSnapshot,trafficSnapshot);
    expect(access.visited).toBe(0); // Existence never allocates a speculative route.
    expect(access.connectivityVisited).toBe(0);
    // Caller buffers may change after this synchronous query was created. Its
    // component and weighted continuation must still refer to the same snapshot.
    gridSnapshot.fill(1);trafficSnapshot.clear();
    const order=run%2?[...foods].reverse():foods;
    for(const food of [...order,...order.slice().reverse()]) {
      const actual=routeToJob(w,food,access,true),expected=routeToJob(w,food,trafficFull,true);
      expect(actual,`resumed route seed ${run} target ${food.id}`).toEqual(expected);
      if(actual)expect(routeCost(w,actual,access)).toBe(routeCost(w,expected!,trafficFull));
      expect(routeToCell(w,food,access),`exact resumed seed ${run}`).toEqual(routeToCell(w,food,trafficFull));
    }
    for(const orientation of [0,1,2,3] as const) {
      const table={kind:'table',x:7,z:7,footprint:'standard' as const,orientation};
      expect(routeToJob(w,table,access,false)).toEqual(routeToJob(w,table,trafficFull,false));
    }
    expect(access.visited).toBeLessThanOrEqual(trafficFull.visited); // Each cell settles at most once across all requests.
    expect(routeToCell(w,start,access)).toEqual([]);
    for(let i=0;i<256;i++)expect(access.has(i),`component seed ${run} cell ${i}`).toBe(trafficFull.costs[i]!==Infinity);
    expect(access.connectivityVisited).toBeLessThanOrEqual(trafficFull.visited);
    for(const food of foods)expect(routeToJob(w,food,trafficGroups,true),`traffic groups seed ${run} target ${food.id}`).toEqual(routeToJob(w,food,trafficFull,true));
    const select = (reach: typeof full) => foods.flatMap(food => {
      const path = routeToJob(w, food, reach, true); return path ? [{ id: food.id, path }] : [];
    }).sort((a, b) => routeCost(w,a.path,reach) - routeCost(w,b.path,reach) || a.id - b.id)[0] ?? null;
    expect(select(bounded), `seed ${run}`).toEqual(select(full));
    const sources:MaterialPile[]=foods.filter(f=>!blocked[f.z*16+f.x]).map(f=>({id:f.id+1,kind:'food',item:(['berries','survival-meal','rice'] as const)[f.id%3]!,quantity:10,owner:{type:'ground',x:f.x,z:f.z}}));
    const pawn={...w.pawns[0]!,...start};
    const preferredReach=reachableCells(w,start,blocked,occupied,foodSearchGoals(w,pawn,sources));
    const oracle=sources.flatMap(p=>{
      if(p.owner.type!=='ground')return [];
      const path=routeToJob(w,p.owner,full,true);if(!path)return [];
      const offset=p.item==='rice'?-82:p.item==='survival-meal'?-5:0;
      return [{id:p.id,path,score:offset-Math.abs(start.x-p.owner.x)-Math.abs(start.z-p.owner.z)}];
    }).sort((a,b)=>b.score-a.score||a.id-b.id)[0];
    expect(selectFood(w,pawn,sources,preferredReach),`preferred seed ${run}`).toEqual(oracle);
    if (bounded.parents.filter(parent => parent !== -2).length < full.parents.filter(parent => parent !== -2).length) reduced++;
  }
  expect(reduced).toBeGreaterThan(70);
});
