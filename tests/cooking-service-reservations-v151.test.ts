import { storedPriority } from '../src/sim/work-types.ts';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { expect,test } from 'vitest';
import { candidateAccess } from '../src/sim/candidate-access.ts';
import { cookingSpot } from '../src/sim/cooking-bills.ts';
import { planCooking } from '../src/sim/cooking-planner.ts';
import { stationWork } from '../src/sim/production-recipes.ts';
import { blockedCells } from '../src/sim/pathfinding.ts';
import { deserializeWorld,serializeWorld } from '../src/sim/index.ts';
import { CIVIL_TRANSIT_BLOCKERS } from '../src/sim/travel.ts';
import type { Pawn,World } from '../src/sim/types.ts';
import { availableCookingStations,legacyPlanCooking } from '../scripts/benchmark-cooking-v151.ts';

const stored=readFileSync('public/test-saves/v98/mixed-100.json','utf8');
const envelope=JSON.parse(stored);
const raw=envelope?.format==='lisiere-save'&&envelope.codec==='gzip-base64'
  ?gunzipSync(Buffer.from(envelope.payload,'base64')).toString('utf8'):stored;
const fresh=()=>deserializeWorld(raw);
const distance=(a:Pawn,b:{x:number;z:number})=>(a.x-b.x)**2+(a.z-b.z)**2;

function compare(world:World,pawn:Pawn,blocked=blockedCells(world),options?:{stationId:number;forced:boolean}) {
  const before=JSON.stringify(world),rng=[world.rng,world.wildlife?.rng,world.fires?.rng];
  const reach=()=>candidateAccess(world,pawn,blocked,CIVIL_TRANSIT_BLOCKERS,true);
  const oldBudget={pairs:32768},newBudget={pairs:32768};
  const old=legacyPlanCooking(world,pawn,reach(),oldBudget,options);
  const current=planCooking(world,pawn,reach(),newBudget,options);
  expect(current).toEqual(old);
  expect(newBudget.pairs).toBe(oldBudget.pairs);
  expect(JSON.stringify(world)).toBe(before);
  expect([world.rng,world.wildlife?.rng,world.fires?.rng]).toEqual(rng);
  return current;
}

test('cooking proposal matches the pre-hoist oracle for all workers on the 250² mixed save',()=>{
  const world=fresh(),serialized=serializeWorld(world);let eligible=0;
  for(const pawn of world.pawns){if(availableCookingStations(world,pawn).length)eligible++;compare(world,pawn);}
  expect(eligible).toBeGreaterThan(0);
  expect(serializeWorld(world)).toBe(serialized);
},60000);

test('two station fallback preserves reserved, blocked and unreachable decisions and forced budget',()=>{
  const base=fresh();
  const pawn=base.pawns.find(p=>availableCookingStations(base,p).length>=2)!;
  expect(pawn).toBeDefined();
  const ordered=availableCookingStations(base,pawn).sort((a,b)=>storedPriority(pawn,stationWork(a))-storedPriority(pawn,stationWork(b))||distance(pawn,a)-distance(pawn,b)||a.id-b.id);
  const first=ordered[0]!,second=ordered[1]!,firstSpot=cookingSpot(first);
  expect(first.id).not.toBe(second.id);
  compare(base,pawn,undefined,{stationId:first.id,forced:true});
  compare(base,pawn,undefined,{stationId:second.id,forced:true});

  const reserved=structuredClone(base),other=reserved.pawns.find(p=>p.id!==pawn.id&&!p.research)!;
  other.research={stationId:reserved.structures.find(s=>s.kind==='research-bench')!.id,spot:firstSpot,worked:0};
  compare(reserved,reserved.pawns.find(p=>p.id===pawn.id)!);

  const blocked=structuredClone(base);
  blocked.tiles[firstSpot.z*blocked.width+firstSpot.x]!.terrain='rock';
  compare(blocked,blocked.pawns.find(p=>p.id===pawn.id)!);

  const unreachable=blockedCells(base);
  unreachable[firstSpot.z*base.width+firstSpot.x]=1;
  compare(base,pawn,unreachable);
},30000);
