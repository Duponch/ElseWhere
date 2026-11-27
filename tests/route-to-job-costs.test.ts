import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {expect,test} from 'vitest';
import {routeToJob,routeToCell,routeCost,routeToBestCellByCostAndLength} from '../src/sim/pathfinding.ts';
import type {CandidateAccess,DistanceField} from '../src/sim/navigation-types.ts';
import type {World} from '../src/sim/types.ts';

test('job interaction chooses accumulated cost, keeps candidate ties and resolves lazy access once',()=>{
  // Only dimensions/schema are read: stops belong to this captured field.
  const world={width:7,height:7,schemaVersion:SCHEMA_VERSION} as World;
  const parents=new Int32Array(49).fill(-2),costs=new Float64Array(49).fill(Infinity);
  parents[0]=-1;costs[0]=0;
  const enter=(index:number,parent:number,cost:number)=>{parents[index]=parent;costs[index]=cost;};
  enter(1,0,1);enter(2,1,2);enter(3,2,3);enter(4,3,4);
  enter(10,3,30);enter(17,10,50); // North: fewer steps, higher cost.
  enter(11,4,5);enter(18,11,6);enter(25,18,10); // East: first cheapest.
  enter(7,0,1);enter(14,7,2);enter(21,14,3);enter(28,21,4);enter(29,28,5);enter(30,29,6);enter(31,30,12);
  enter(9,2,3);enter(16,9,4);enter(23,16,20);
  const field:DistanceField={parents,costs,start:0,visited:14,unreachedGroups:0,stops:new Set()};
  const expected=[{x:1,z:0},{x:2,z:0},{x:3,z:0},{x:4,z:0},{x:4,z:1},{x:4,z:2},{x:4,z:3}];
  expect(routeToJob(world,{x:3,z:3},field)).toEqual(expected);
  // South now ties East but occurs later in the interaction candidate order.
  costs[31]=10;
  expect(routeToJob(world,{x:3,z:3},field)).toEqual(expected);
  const requests:number[][]=[];
  const lazy:CandidateAccess={kind:'candidate-access',start:0,stops:field.stops,visited:14,connectivityVisited:14,unreachedGroups:0,
    has:index=>parents[index]!==-2,
    resolve(goals){requests.push([...goals]);return field;},
    costTo:index=>costs[index]!,
  };
  expect(routeToJob(world,{x:3,z:3},lazy)).toEqual(expected);
  expect(requests).toEqual([[17,25,31,23]]);
  expect(routeToJob(world,{x:0,z:0},lazy,true)).toEqual([]);
  expect(requests).toHaveLength(1);
  expect(routeToJob(world,{x:6,z:6},field)).toBeNull();
});

test('multi-stop cleaning route matches individual routes, including length ties and lazy frontier order',()=>{
  const world={width:7,height:7,schemaVersion:SCHEMA_VERSION} as World;
  const parents=new Int32Array(49).fill(-2),costs=new Float64Array(49).fill(Infinity);
  parents[0]=-1;costs[0]=0;
  const enter=(i:number,p:number,c:number)=>{parents[i]=p;costs[i]=c;};
  enter(1,0,1);enter(2,1,2);enter(3,2,3);enter(4,3,4);enter(11,4,5);enter(18,11,6);enter(25,18,10);
  enter(7,0,1);enter(8,7,2);enter(9,8,3);enter(16,9,4);enter(23,16,10);
  const field:DistanceField={parents,costs,start:0,visited:13,unreachedGroups:0};
  const cells=[{x:4,z:3},{x:2,z:3},{x:6,z:6},{x:2,z:2}];
  const access=(requests:number[][]):CandidateAccess=>({kind:'candidate-access',start:0,visited:13,connectivityVisited:13,unreachedGroups:0,has:i=>parents[i]!==-2,resolve(goals){requests.push([...goals]);return field;},costTo:i=>costs[i]!});
  for(const candidates of [cells,[...cells,{x:0,z:0}],[{x:6,z:6}],[]]){
    const oldRequests:number[][]=[],newRequests:number[][]=[],old=access(oldRequests),next=access(newRequests);
    const all=candidates.map(c=>routeToCell(world,c,old)).filter((p):p is NonNullable<typeof p>=>p!==null);
    all.sort((a,b)=>routeCost(world,a,old)-routeCost(world,b,old)||a.length-b.length);
    expect(routeToBestCellByCostAndLength(world,candidates,next)).toEqual(all[0]??null);
    expect(newRequests).toEqual(oldRequests);
  }
});
