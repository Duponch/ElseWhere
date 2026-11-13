import {expect,test} from 'vitest';
import {structureMaxHp,rescaleStructureDamage311,HP_CHANGED_KINDS311} from '../src/sim/thing-damage-rules.ts';
import {constructionSkillRequired} from '../src/sim/construction-materials.ts';
import {structureBeauty} from '../src/sim/room-beauty.ts';
import {FURNITURE_DEFINITIONS,QUALITY_BEAUTY,furnitureBeauty,roundCoreBeauty311} from '../src/sim/furniture-stats.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import {SCHEMA_VERSION,type Structure} from '../src/sim/types.ts';

const building=(kind:string,material='wood',extra:Partial<Structure>={})=>({id:9,kind,x:3,z:3,orientation:0,footprint:'standard',material,...extra}) as unknown as Structure;

test('eight buildings take their Core hit points from schema 311; older schemas keep validating with theirs',()=>{
  const core:Record<string,number>={fence:40,'fence-gate':20,'pen-marker':100,'table-long':150,'dining-chair':100,'end-table':75,dresser:120,'flower-pot':75};
  expect([...HP_CHANGED_KINDS311].sort()).toEqual(Object.keys(core).sort());
  // Steel keeps the base value (stuff HP factor 1).
  for(const [kind,hp] of Object.entries(core))expect(structureMaxHp(building(kind,'steel'))).toBe(hp);
  // Wood x0.65.
  expect(structureMaxHp(building('fence'))).toBe(26);expect(structureMaxHp(building('fence'),310)).toBe(65);
  expect(structureMaxHp(building('dining-chair'),310)).toBe(Math.round(75*.65));
});

test('migration 310 -> 311 keeps the remaining fraction of hit points of a damaged building',()=>{
  // Wood fence: 65 -> 26 HP. 35 of 65 left -> 14 of 26 left.
  const fence={...building('fence'),damage:30} as Record<string,unknown>;
  // Steel dining chair: 75 -> 100 HP. 25 of 75 left -> 33 of 100 left.
  const chair={...building('dining-chair','steel'),damage:50} as Record<string,unknown>;
  // A badly damaged fence keeps at least one hit point.
  const ruin={...building('fence-gate'),damage:77} as Record<string,unknown>;
  const save={structures:[fence,chair],packed:[{building:ruin}]};
  rescaleStructureDamage311(save);
  expect(fence.damage).toBe(26-14);expect(chair.damage).toBe(100-33);
  expect(Number(ruin.damage)).toBeLessThan(structureMaxHp(building('fence-gate')));expect(Number(ruin.damage)).toBeGreaterThan(0);
  // Undamaged or other kinds are left alone.
  const wall={...building('wall'),damage:10};rescaleStructureDamage311({structures:[wall]});expect(wall.damage).toBe(10);
});

test('the wood-fired and chemfuel generators need Construction 4 and 6 from schema 311',()=>{
  expect(constructionSkillRequired('wood-generator')).toBe(4);expect(constructionSkillRequired('chemfuel-generator')).toBe(6);
  expect(constructionSkillRequired('wood-generator',310)).toBe(0);expect(constructionSkillRequired('chemfuel-generator',310)).toBe(0);
});

test('Beauty follows Core: power buildings are ugly, the hospital bed and plain shelves are neutral, stone factors apply',()=>{
  expect(structureBeauty(building('wind-turbine','steel'))).toBe(-12);expect(structureBeauty(building('battery','steel'))).toBe(-15);
  expect(structureBeauty(building('wood-generator','steel'))).toBe(-20);expect(structureBeauty(building('power-conduit','steel'))).toBe(-2);
  expect(structureBeauty(building('power-switch','steel'))).toBe(-2);
  expect(structureBeauty(building('battery','steel'),310)).toBe(0);
  expect(furnitureBeauty(building('hospital-bed','steel'))).toBe(0);expect(furnitureBeauty(building('hospital-bed','steel'),310)).toBe(2);
  // Shelf: base 0.5 -> 0 in wood (rounded to even), marble (0.5 x 1.35 + 1) -> 2.
  expect(furnitureBeauty(building('shelf','wood'))).toBe(0);expect(furnitureBeauty(building('shelf','marble-blocks'))).toBe(2);
  // Quality multiplies after the stuff offset: (base x 1.35 + 1) x 2 for a good marble table.
  const table=FURNITURE_DEFINITIONS.table.beauty;
  expect(furnitureBeauty(building('table','marble-blocks',{quality:'good'}))).toBe(roundCoreBeauty311((table*1.35+1)*QUALITY_BEAUTY.good));
  expect(furnitureBeauty(building('table','marble-blocks',{quality:'good'}),310)).toBe(table*1*2+1);
  // A negative value is not scaled by quality.
  expect(roundCoreBeauty311(2.5)).toBe(2);expect(roundCoreBeauty311(3.5)).toBe(4);expect(roundCoreBeauty311(-2.5)).toBe(-2);
  expect(roundCoreBeauty311(102.5)).toBe(100);expect(roundCoreBeauty311(113)).toBe(115);
});

test('a schema 310 save migrates to 311 unchanged when nothing is damaged',()=>{
  const w=createScenarioWorld(42,32,'crashlanded'),current=serializeWorld(w);
  expect(current.startsWith(`{"schemaVersion":${SCHEMA_VERSION},`)).toBe(true);
  expect(serializeWorld(deserializeWorld(asOldSchema(current,310)))).toBe(current);
});
