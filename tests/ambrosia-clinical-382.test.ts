import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {at,parseXml} from '../src/import/rimworld/xml.ts';
import {validAmbrosiaClinical382,ambrosiaThought382} from '../src/sim/ambrosia-clinical-382.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization.ts';

it('imports separate active Core ambrosia conditions with their real ages and evolves them on the human owner clock',()=>{
 const source=readRwsSave(readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8'));
 const thing=source.maps[0]!.things.find(t=>t.id==='Human1')!,rows=at(thing.node,'healthTracker/hediffSet/hediffs')!;
 rows.children.push(parseXml('<li Class="HediffWithComps"><def>AmbrosiaTolerance</def><severity>0.0277924761</severity><ageTicks>54201</ageTicks><tickAdded>300000</tickAdded></li>'));
 rows.children.push(parseXml('<li Class="Hediff_High"><def>AmbrosiaHigh</def><severity>0.001</severity><ageTicks>19</ageTicks><tickAdded>359980</tickAdded></li>'));
 const c=convertRwsSave(source,{planet:false}),w=c.world,p=w.pawns.find(p=>p.id===c.thingIds.get('Human1'))!;
 expect(p.health?.ambrosia382).toMatchObject({tolerance:{bornAtCore:300000,ageCore:54201,severity:Math.fround(.0277924761)},high:{bornAtCore:359980,ageCore:19,severity:Math.fround(.001)}});
 expect(ambrosiaThought382(p)?.offset).toBe(5);expect(validAmbrosiaClinical382(p.health,381,true)).toBe(false);expect(validateWorld(w)).toEqual([]);
 stepWorld(w,20);
 expect(p.health?.ambrosia382?.high).toBeUndefined();expect(p.health?.ambrosia382?.tolerance).toMatchObject({ageCore:54401,severity:Math.fround(Math.fround(.0277924761)+Math.fround(Math.fround(-.02)*Math.fround(200/60000)))});
 expect(ambrosiaThought382(p)).toBeUndefined();expect(validateWorld(w)).toEqual([]);const raw=serializeWorld(w);expect(serializeWorld(deserializeWorld(raw))).toBe(raw);
});
