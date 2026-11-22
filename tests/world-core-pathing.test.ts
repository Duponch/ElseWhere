// The game's world path search (src/sim/world-core-pathing.ts) on hand-made
// graphs: ties, the truncated step cost evaluated in double, the heuristic
// added only to a reopened node, the terminator, reachability.
import {describe,expect,it} from 'vitest';
import {createCoreWorldPathing} from '../src/sim/world-core-pathing';
import {roundToInt,simpleCurveEvaluate} from '../src/sim/verse-rand';
import type {WorldRoadLink} from '../src/sim/world-roads';
import type {WorldSurfaceTile} from '../src/sim/world-surface-geography';
import type {Vector3} from '../src/sim/verse-vector';
const f=Math.fround;
const at=(latitude:number,longitude:number):Vector3=>{const la=latitude*Math.PI/180,lo=longitude*Math.PI/180;return [f(100*Math.cos(la)*Math.sin(lo)),f(100*Math.sin(la)),f(-100*Math.cos(la)*Math.cos(lo))];};
type Tile=Pick<WorldSurfaceTile,'center'|'neighbours'|'biome'>;
const tile=(center:Vector3,neighbours:number[]):Tile=>({center,neighbours,biome:'temperate-forest'});
const noRoads=(n:number)=>Array.from({length:n},()=>[] as WorldRoadLink[]);
/** S(0) — A(1), B(2) — D(3): two routes of two steps. */
function diamond(firstFromStart:1|2=1):Tile[] {
 return [tile(at(0,0),firstFromStart===1?[1,2]:[2,1]),tile(at(1,1),[0,3]),tile(at(-1,1),[0,3]),tile(at(0,2),[1,2])];
}

describe('world path search (WorldPathing.FindPath)',()=>{
 it('equal costs: the node opened first keeps the parent role',()=>{
  // S opens A then B at 3 300; A pops first (heap root) and opens D at 6 600;
  // B finds D at 6 600, not cheaper: D keeps A.
  const tiles=diamond(1),p=createCoreWorldPathing(tiles,Float32Array.from([1,1,1,1]),noRoads(4));
  expect(p.findPath(0,3)).toEqual({nodesReversed:[3,1,0],cost:6600});
  const swapped=diamond(2),q=createCoreWorldPathing(swapped,Float32Array.from([1,1,1,1]),noRoads(4));
  expect(q.findPath(0,3)).toEqual({nodesReversed:[3,2,0],cost:6600});
 });
 it('a step costs (int)(3300 × difficulty × road) evaluated in double',()=>{
  // d = 1 + 2542 × 2⁻²³: 3300 × d = 3300 + 8 388 600 / 2²³ = 3300.99999905,
  // truncated to 3300 (in single precision the product would round to 3301).
  const d=1+2542*2**-23;expect(f(d)).toBe(d);
  const p=createCoreWorldPathing(diamond(1),Float32Array.from([1,d,1,1]),noRoads(4));
  expect(p.findPath(0,1)).toEqual({nodesReversed:[1,0],cost:3300});
 });
 it('a reopened node enters with its stored heuristic, a new one without',()=>{
  // S(0): A(1) costs 3 × 3300 = 9900 directly; B(2) 3300, then B→A along a
  // road 3 × 3300 × 0.5 = 4950: A reopened at 8250 + h(A). D(3) after A.
  const tiles=[tile(at(0,0),[1,2]),tile(at(0,1),[0,2,3]),tile(at(-1,0.5),[0,1]),tile(at(0,12),[1])];
  const roads=noRoads(4);roads[2]!.push({neighbour:1,road:'dirt-path'});roads[1]!.push({neighbour:2,road:'dirt-path'});
  const p=createCoreWorldPathing(tiles,Float32Array.from([1,3,1,1]),roads),closed:number[]=[];
  const path=p.findPath(0,3,cost=>{closed.push(cost);return false;});
  const strength=roundToInt(simpleCurveEvaluate([[30,1],[40,1.3],[130,2]],p.distance(0,3))),heuristic=roundToInt(f(3300*p.distance(1,3)*strength*.5));
  expect(heuristic).toBeGreaterThan(1650);
  // A at 9900 is stale when popped (its priority is now 8250 + h): skipped.
  expect(closed).toEqual([0,3300,8250+heuristic]);
  expect(path).toEqual({nodesReversed:[3,1,2,0],cost:11550});
 });
 it('the terminator stops the search after closing a node',()=>{
  const p=createCoreWorldPathing(diamond(1),Float32Array.from([1,1,1,1]),noRoads(4));
  expect(p.findPath(0,3,cost=>cost>3000)).toBeNull();
  expect(p.findPath(0,3,cost=>cost>4000)).toEqual({nodesReversed:[3,1,0],cost:6600});
 });
 it('an impassable end or another connected field is not found',()=>{
  const tiles=[...diamond(1),tile(at(5,5),[])];
  const p=createCoreWorldPathing(tiles,Float32Array.from([1,1,1,1000,1]),noRoads(5));
  expect(p.findPath(0,3)).toBeNull();expect(p.findPath(0,4)).toBeNull();
  expect(p.findPath(0,0)).toEqual({nodesReversed:[0],cost:0});
 });
});
