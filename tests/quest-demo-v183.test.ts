import { withoutMiningSkill, withoutPredatorDefaults } from './scenarios/legacy-skills.ts';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {expect,test} from 'vitest';
import {prepareQuestDemo,questDemoManifestEntry} from '../scripts/generate-quest-demo-v183.ts';
import {applyCommand,stepWorld} from '../src/sim/engine.ts';
import {injurePawn} from '../src/sim/health.ts';
import {atMapEdge} from '../src/sim/raid-space.ts';
import {advanceRaids} from '../src/sim/raids.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

const fixtureUrl=new URL('../public/test-saves/v183/asile-et-poursuite.json',import.meta.url);
const EXPECTED_SHA256='4e7ebd747679916b4113ec2a0838006759d9b2e844569f9c997d0e035ec94d37';

function stepUntil(world:World,ready:()=>boolean,limit:number):void {
  for(let i=0;i<limit&&!ready();i++)stepWorld(world);
  expect(ready(),`Quête non avancée avant ${limit} ticks ; tick=${world.tick}`).toBe(true);
}

test('V183 public scene is a byte-stable 250² colony with a real unanswered offer',()=>{
  const raw=readFileSync(fixtureUrl,'utf8'),sha256=createHash('sha256').update(raw).digest('hex');
  expect(sha256).toBe(EXPECTED_SHA256);
  const world=deserializeWorld(raw),prepared=withoutPredatorDefaults(withoutMiningSkill(prepareQuestDemo('pre-v210')));
  // Arid species and weights are unchanged; the V172 fixture uses herbivores-v1.
  prepared.wildlife!.profile='biome-herbivores-v1';
  expect(world).toEqual(prepared);
  expect(world.schemaVersion).toBe(SCHEMA_VERSION);
  expect(world.width).toBe(250);expect(world.height).toBe(250);
  expect(world.seed).toBe(13313);expect(world.pawns).toHaveLength(3);
  expect(world.quests?.entries).toHaveLength(1);
  expect(world.quests!.entries[0]!.status).toBe('offered');
  expect(world.raids!.active).toBeUndefined();
  expect(questDemoManifestEntry(world,sha256)).toMatchObject({id:'asile-et-poursuite-v183',prepared:true,sha256});
  expect(validateWorld(world)).toEqual([]);
},180_000);

test('real answer, entry, knife pursuit, neutral conclusion and phase saves preserve the same identities',()=>{
  const world=deserializeWorld(readFileSync(fixtureUrl,'utf8'));
  const q=world.quests!.entries[0]!,initialId=world.nextId,raidRng=world.raids!.rng;
  expect(applyCommand(world,{type:'answer-quest',questId:q.id,accept:true}).ok).toBe(true);
  expect(q.status).toBe('accepted');expect(world.pawns).toHaveLength(3);expect(world.raids!.active).toBeUndefined();
  expect(validateWorld(world)).toEqual([]);
  const beforeEntry=deserializeWorld(serializeWorld(world));stepWorld(world);stepWorld(beforeEntry);expect(beforeEntry).toEqual(world);

  stepUntil(world,()=>q.arrivedAt!==undefined,200);
  expect(q.pawnId).toBe(initialId);
  const joiner=world.pawns.find(p=>p.id===q.pawnId)!;
  expect(joiner.name).toBe(q.name);expect(atMapEdge(world,joiner)).toBe(true);
  const shirt=world.piles.find(p=>p.owner.type==='apparel'&&p.owner.pawnId===joiner.id&&p.item==='cloth-shirt')!;
  expect(shirt.id).toBe(initialId+1);
  expect(world.raids!.active).toBeUndefined();expect(validateWorld(world)).toEqual([]);
  const beforeRaid=deserializeWorld(serializeWorld(world));stepWorld(world);stepWorld(beforeRaid);expect(beforeRaid).toEqual(world);

  stepUntil(world,()=>q.raidAt!==undefined,350);
  const group=world.raids!.active!;
  expect(group.originQuestId).toBe(q.id);expect(q.raidGroupId).toBe(group.id);
  expect(group.members).toHaveLength(1);
  const raider=world.pawns.find(p=>p.id===group.members[0])!;
  expect(atMapEdge(world,raider)).toBe(true);
  expect(world.piles.some(p=>p.owner.type==='equipment'&&p.owner.pawnId===raider.id&&p.item==='plasteel-knife')).toBe(true);
  expect(world.raids!.rng).toBe(raidRng);
  expect(validateWorld(world)).toEqual([]);
  const duringRaid=deserializeWorld(serializeWorld(world));stepWorld(world);stepWorld(duringRaid);expect(duringRaid).toEqual(world);

  stepUntil(world,()=>q.status==='concluded',100);
  expect(q.endedAt).toBe(q.raidAt!+60);
  expect(world.pawns.find(p=>p.id===joiner.id)?.name).toBe(q.name);
  expect(world.raids!.active?.originQuestId??world.raids!.last?.originQuestId).toBe(q.id);
  expect(world.raids!.rng).toBe(raidRng);
  expect(validateWorld(world)).toEqual([]);
  expect(deserializeWorld(serializeWorld(world))).toEqual(world);
  const survivingRaider=world.pawns.find(p=>p.id===group.members[0]);
  if(survivingRaider&&world.raids!.active){injurePawn(world,survivingRaider,'brain','crush',99000);advanceRaids(world);}
  expect(world.raids!.last?.originQuestId).toBe(q.id);
  expect(validateWorld(world)).toEqual([]);
},180_000);

test('refusal of the prepared offer grants no person or raid and consumes no identity',()=>{
  const world=deserializeWorld(readFileSync(fixtureUrl,'utf8'));
  const q=world.quests!.entries[0]!,id=world.nextId,raidRng=world.raids!.rng,questRng=world.quests!.rng;
  expect(applyCommand(world,{type:'answer-quest',questId:q.id,accept:false}).ok).toBe(true);
  expect(q.status).toBe('refused');expect(world.pawns).toHaveLength(3);
  expect(world.nextId).toBe(id);expect(world.raids!.rng).toBe(raidRng);expect(world.quests!.rng).toBe(questRng);
  expect(world.raids!.active).toBeUndefined();
  expect(validateWorld(world)).toEqual([]);
},180_000);
