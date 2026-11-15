import { expect,test } from 'vitest';
import { createWorld,stepWorld } from '../src/sim/engine.ts';
import { crashlandedProfile } from '../src/sim/game-profile.ts';
import { adoptWorldIncidents,advanceWorldIncidents,resolveSelectedSolarFlare,eligibleSolarFlare,electricityDisabledAtCore,
  WORLD_FIRST_CHECK,WORLD_CATEGORY_CHANCE,SOLAR_FLARE_COOLDOWN } from '../src/sim/cassandra-world.ts';
import { validWorldIncidents } from '../src/sim/cassandra-world-save.ts';
import { TICKS_PER_DAY } from '../src/sim/types.ts';

function colony(tick=0){const w=createWorld(202,16,16);w.pawns=[];w.tick=tick;w.gameProfile=crashlandedProfile();delete w.heatwaves;adoptWorldIncidents(w);return w;}
function draw(seed:number){let n=seed;n^=n<<13;n^=n>>>17;n^=n<<5;return n>>>0;}
const SOLAR_SEED=2472303839; // Independent xorshift oracle: category, solar ticket, duration9000.

test('World adopts only on a real continuation, starts after J15 strictly and never replays past checks',()=>{
  const old=createWorld(202,16,16);adoptWorldIncidents(old);expect(old.worldIncidents).toBeUndefined();
  old.gameProfile=crashlandedProfile();stepWorld(old,0);expect(old.worldIncidents).toBeUndefined();
  stepWorld(old);expect(old.worldIncidents).toMatchObject({adoptedAt:0,checks:0,opportunities:0,flares:0});
  expect(WORLD_FIRST_CHECK).toBe(15*TICKS_PER_DAY+100);expect(WORLD_CATEGORY_CHANCE).toBe(1/900);
  const w=colony(15*TICKS_PER_DAY),rng=w.worldIncidents!.rng;
  advanceWorldIncidents(w);expect(w.worldIncidents!.checks).toBe(0);expect(w.worldIncidents!.rng).toBe(rng);
  w.tick=WORLD_FIRST_CHECK;advanceWorldIncidents(w);expect(w.worldIncidents!.checks).toBe(1);
  advanceWorldIncidents(w);expect(w.worldIncidents!.checks).toBe(1);
  const late=colony(WORLD_FIRST_CHECK+37);expect(late.worldIncidents!.nextCheck).toBe(WORLD_FIRST_CHECK+100);
  const before=late.worldIncidents!.rng;late.tick+=1000;advanceWorldIncidents(late);
  expect(late.worldIncidents!.checks).toBe(0);expect(late.worldIncidents!.rng).toBe(before);
  expect(validWorldIncidents(late.worldIncidents,184,late)).toBe(true);
});

test('private World category preserves absent weights, rejects without reroll and leaves map/actor streams untouched',()=>{
  for(const seed of [1,SOLAR_SEED]){
    const w=colony(WORLD_FIRST_CHECK-1),state=w.worldIncidents!,rng=w.rng,misc=w.miscIncidents,weather=w.weather;
    state.rng=seed;w.tick++;advanceWorldIncidents(w);
    expect(draw(seed)/2**32).toBeLessThan(1/900);
    expect(state).toMatchObject({checks:1,opportunities:1,flares:seed===1?0:1});
    expect(w.rng).toBe(rng);expect(w.miscIncidents).toBe(misc);expect(w.weather).toBe(weather);
    // Schema 341 records a fired World incident (recent-incidents-341.ts);
    // the 184 shape is checked without that later record.
    const {recent341,...shape184}=state;
    expect(recent341).toEqual(seed===1?undefined:['solar-flare']);
    expect(validWorldIncidents(state,w.schemaVersion,w)).toBe(true);expect(validWorldIncidents(shape184,184,w)).toBe(true);
    if(seed===1){expect(state.active).toBeUndefined();expect(state.rng).toBe(draw(draw(seed)));}
    else expect(state.active).toEqual({start:WORLD_FIRST_CHECK,endCore:WORLD_FIRST_CHECK*10+9000});
  }
  const w=colony(WORLD_FIRST_CHECK-1);w.worldIncidents!.rng=SOLAR_SEED;w.tick++;advanceWorldIncidents(w);
  const state=w.worldIncidents!,end=state.active!.endCore;
  w.tick+=100;state.rng=SOLAR_SEED;advanceWorldIncidents(w);
  expect(state).toMatchObject({checks:2,opportunities:2,flares:1});expect(state.active!.endCore).toBe(end);
  expect(state.rng).toBe(draw(draw(SOLAR_SEED))); // No duration draw on refused active ticket.
});

test('no device or weather prerequisite; exact Core expiration, cooldown from start and continued next check',()=>{
  const w=colony(WORLD_FIRST_CHECK-1);w.worldIncidents!.rng=SOLAR_SEED;w.tick++;advanceWorldIncidents(w);
  const state=w.worldIncidents!,start=w.tick,endCore=state.active!.endCore;
  expect(w.structures).toHaveLength(0);expect(electricityDisabledAtCore(w,start*10)).toBe(false);
  expect(electricityDisabledAtCore(w,start*10+1)).toBe(true);
  expect(electricityDisabledAtCore(w,endCore)).toBe(true);expect(electricityDisabledAtCore(w,endCore+1)).toBe(false);
  w.tick=endCore/10;advanceWorldIncidents(w);expect(state.active).toBeDefined();
  w.tick++;advanceWorldIncidents(w);expect(state.active).toBeUndefined();
  expect(w.events.at(-1)!.message).toContain('se termine');
  w.tick=start+SOLAR_FLARE_COOLDOWN-1;expect(eligibleSolarFlare(w)).toBe(false);
  const rng=state.rng;expect(resolveSelectedSolarFlare(w)).toBe(false);expect(state.rng).toBe(rng);
  w.tick++;expect(eligibleSolarFlare(w)).toBe(true);
});

test('closed calendar validates counters, timing, global profile and active partial shedding',()=>{
  const w=colony(WORLD_FIRST_CHECK-1);w.worldIncidents!.rng=SOLAR_SEED;w.tick++;advanceWorldIncidents(w);
  const good=structuredClone(w.worldIncidents!);
  for(const patch of [{rng:0},{checks:0},{opportunities:0},{flares:2},{nextCheck:w.tick},{lastStart:w.tick+1},
    {lastEndCore:w.tick*10+8999},{unknown:true},{active:{start:w.tick,endCore:good.lastEndCore,unknown:true}}]){
    const bad={...structuredClone(good),...patch};expect(validWorldIncidents(bad,184,w),JSON.stringify(patch)).toBe(false);
  }
  expect(validWorldIncidents(good,183,w)).toBe(false);
  expect(validWorldIncidents(good,184,{tick:w.tick})).toBe(false);
  const resumed=structuredClone(good);delete resumed.active;expect(validWorldIncidents(resumed,184,w)).toBe(false);
  expect(w.worldIncidents).toEqual(good);
});
