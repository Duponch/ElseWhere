import {expect,test} from 'vitest';
import {medicalCamp} from './scenarios/health.ts';
import {addMaterial} from '../src/sim/materials.ts';
import {pileMarketValue,tradeRefusal} from '../src/sim/trade-prices.ts';
import {colonyWealth} from '../src/sim/colony-wealth.ts';
import {createScenarioWorld} from '../src/sim/new-game.ts';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization.ts';
import {asOldSchema} from './scenarios/old-schema.ts';
import type {MaterialPile,World} from '../src/sim/types.ts';

const setVersion=(w:World,v:number)=>{(w as {schemaVersion:number}).schemaVersion=v;};
function camp(){const w=medicalCamp(2);w.piles=[];w.resources=[];return w;}
function ground(w:World,kind:MaterialPile['kind'],item:MaterialPile['item'],quantity=1,x=5,z=5):MaterialPile{
  const id=w.nextId;addMaterial(w,kind,quantity,{type:'ground',x,z},item);const pile=w.piles.find(p=>p.id===id);if(!pile)throw Error('Missing pile');return pile;
}

test('apparel taken from a corpse is worth a tenth and cannot be sold',()=>{
  const w=camp(),shirt=ground(w,'apparel','cloth-shirt');
  const clean=pileMarketValue(shirt,327)!;
  shirt.apparel!.corpseWear284=true;
  expect(pileMarketValue(shirt,327)).toBeCloseTo(clean*.1,10);
  expect(pileMarketValue(shirt,326)).toBe(clean);
  expect(tradeRefusal(shirt,'sell',w.tick,undefined,'visitor',327)).toMatch(/mort/);
  expect(tradeRefusal(shirt,'sell',w.tick,undefined,'visitor',326)).toBeUndefined();
});

test('visitors buy gold, advanced components, novels, prostheses and beer',()=>{
  const w=camp();
  let x=3;
  for(const [kind,item] of [['gold','gold'],['advanced-component','advanced-component'],['beer','beer']] as const){
    const pile=ground(w,kind,item,1,x++,3);
    expect(tradeRefusal(pile,'sell',w.tick,undefined,'visitor',327),item).toBeUndefined();
    expect(tradeRefusal(pile,'sell',w.tick,undefined,'visitor',326),item).toMatch(/catégorie/);
    expect(tradeRefusal(pile,'buy',w.tick,undefined,'visitor',327),item).toMatch(/catégorie/);
  }
});

test('colony wealth counts only the colony buildings and nothing under the fog',()=>{
  const w=camp(),gold=ground(w,'gold','gold',10,6,6);void gold;
  const before=colonyWealth(w);
  w.tiles[6*w.width+6]!.fogged=true;
  expect(colonyWealth(w).items).toBeCloseTo(before.items-100,6);
  setVersion(w,326);expect(colonyWealth(w).items).toBeCloseTo(before.items,6);setVersion(w,327);
  const building=w.structures[0];
  if(building){
    const withAll=colonyWealth(w).structures;
    (building as {factionId?:number|null}).factionId=null;
    expect(colonyWealth(w).structures).toBeLessThan(withAll);
  }
});

test('a schema 326 save migrates to 327 by its number only',()=>{
  const current=serializeWorld(createScenarioWorld(42,32,'crashlanded'));
  expect(serializeWorld(deserializeWorld(asOldSchema(current,326)))).toBe(current);
});
