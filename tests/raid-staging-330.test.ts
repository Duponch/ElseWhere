import {expect,test} from 'vitest';
import {createRaidGroup} from '../src/sim/raid-spawn.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {deserializeWorld,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
/** A real Atterrissage game (Cassandra) and a pirate raid created at a free
 * edge cell with the given calendar seed. */
function raidAt(seed:number,version:number=SCHEMA_VERSION):{w:World;group:ReturnType<typeof createRaidGroup>} {
  const w=createScenarioWorld(42,32,'crashlanded');setVersion(w,version);
  for(let z=0;z<w.height;z++)for(const x of [0,w.width-1]){
    const group=createRaidGroup(w,{count:1,sites:[{x,z}],random:{rng:seed}});
    if(group)return {w,group};
  }
  throw Error('No free edge cell');
}
function staged(version:number):{w:World;seed:number}|undefined {
  for(let seed=1;seed<=60;seed++){const {w,group}=raidAt(seed,version);if(group!.stage330)return {w,seed};}
  return undefined;
}

test('a Cassandra pirate raid may stage before its assault, about half the time',()=>{
  let stagedCount=0;
  for(let seed=1;seed<=60;seed++)if(raidAt(seed).group!.stage330)stagedCount++;
  expect(stagedCount).toBeGreaterThan(15);expect(stagedCount).toBeLessThan(45);
  expect(staged(329)).toBeUndefined();
});

test('the staged group defends its point, then assaults after the Core delay',()=>{
  const {w}=staged(SCHEMA_VERSION)!,group=w.raids!.active!,stage=group.stage330!;
  expect(stage.untilCore-w.tick*10).toBeGreaterThanOrEqual(5000);expect(stage.untilCore-w.tick*10).toBeLessThanOrEqual(15000);
  expect(group.deadline!-w.tick).toBeGreaterThanOrEqual(2600+Math.ceil((stage.untilCore-w.tick*10)/10));
  expect(w.events.at(-1)!.message).toMatch(/se regroupe/);
  expect(validateWorld(w)).toEqual([]);
  expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
  const raider=w.pawns.find(p=>p.raid?.group===group.id)!;
  while(w.raids!.active?.stage330?.endedAtCore===undefined&&w.tick*10<stage.untilCore){
    stepWorld(w);
    if(raider.state!=='dead'&&raider.state!=='downed')expect((raider.x-stage.point.x)**2+(raider.z-stage.point.z)**2).toBeLessThanOrEqual(29**2);
  }
  stepWorld(w);
  expect(w.raids!.active?.stage330?.endedAtCore).toBeDefined();
  // The pushed-back give-up deadline stays valid in the save after the assault starts.
  expect(validateWorld(w)).toEqual([]);
  expect(w.events.some(e=>e.message.includes('passent à l’assaut'))).toBe(true);
});

/** Found by the prison campaign: a long staging pushes the give-up deadline
 * past the immediate raid bound, and the save must still validate. */
test('a long staging keeps a valid save, before and after the assault',()=>{
  let checked=0;
  for(let seed=1;seed<=200&&checked<3;seed++){
    const {w,group}=raidAt(seed);
    if(!group!.stage330||group!.deadline!-group!.startedAt<=3800)continue;
    expect(validateWorld(w)).toEqual([]);
    group!.stage330.endedAtCore=w.tick*10;expect(validateWorld(w)).toEqual([]);
    checked++;
  }
  expect(checked).toBe(3);
});

test('a staging point outside the Core window is refused in a save',()=>{
  const {w}=staged(SCHEMA_VERSION)!,group=w.raids!.active!;
  group.stage330!.untilCore=group.startedAt*10+20000;
  expect(validateWorld(w).length).toBeGreaterThan(0);
  // An assault start in the future is refused too.
  const {w:v}=staged(SCHEMA_VERSION)!,g=v.raids!.active!;g.stage330!.endedAtCore=v.tick*10+50;
  expect(validateWorld(v)).toContain('Invalid raid staging.');
});

test('a schema 329 save migrates to 330 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,329)))).toBe(current);
});
