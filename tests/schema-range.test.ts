import {expect,test} from 'vitest';
import {SCHEMA_VERSION} from '../src/sim/types.ts';
import {schemaAtLeast} from '../src/sim/schema-range.ts';
import * as compatibility from '../src/sim/schema-compatibility-257.ts';
import {isCorePhysicalSchema297} from '../src/sim/physical-schema-297.ts';

// Every schema predicate admits exactly the integers [minimum, SCHEMA_VERSION]
// and nothing else, so a schema bump needs no per-predicate edit.
const predicates:[string,(value:unknown)=>boolean,number][]=[
 ...Object.entries(compatibility).filter(([name])=>/^isSchema\d+(OrLater|Or257)$/.test(name))
  .map(([name,f])=>[name,f as (value:unknown)=>boolean,Number(/^isSchema(\d+)/.exec(name)![1])] as [string,(value:unknown)=>boolean,number]),
 ['isCorePhysicalSchema297',isCorePhysicalSchema297,297],
];

test.each(predicates)('%s admits exactly [minimum, SCHEMA_VERSION]',(_name,predicate,minimum)=>{
 for(let value=minimum-50;value<=SCHEMA_VERSION+50;value++)expect(predicate(value)).toBe(value>=minimum&&value<=SCHEMA_VERSION);
 for(const odd of [String(minimum),minimum+.5,NaN,Infinity,null,undefined,{},[minimum]])expect(predicate(odd)).toBe(false);
});

test('schemaAtLeast follows SCHEMA_VERSION',()=>{
 const current=schemaAtLeast(SCHEMA_VERSION);
 expect(current(SCHEMA_VERSION)).toBe(true);
 expect(current(SCHEMA_VERSION+1)).toBe(false);
 expect(current(SCHEMA_VERSION-1)).toBe(false);
});
