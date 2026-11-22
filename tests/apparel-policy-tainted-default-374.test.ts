import {expect,test} from 'vitest';
import {createWorld} from '../src/sim/engine';
import {createDefaultApparelPolicyRegistry} from '../src/sim/apparel-policy';
import {deserializeWorld,serializeWorld} from '../src/sim/serialization';
import {asOldSchema} from './scenarios/old-schema.ts';

test('a new world: « Tenue entretenue » refuses clothes of the dead, « Tout vêtement » allows them (Core OutfitDatabase)',()=>{
  const w=createWorld(11,16,16);
  const [anything,maintained]=w.apparelPolicies;
  expect(anything!.label).toBe('Tout vêtement');expect(Object.hasOwn(anything!,'taintedAllowed374')).toBe(false);
  expect(maintained!.label).toBe('Tenue entretenue');expect(maintained!.taintedAllowed374).toBe(false);
  const reloaded=deserializeWorld(serializeWorld(w));expect(reloaded.apparelPolicies).toEqual(w.apparelPolicies);
  // An older save keeps its policies: the field is dropped below 374 and none is added by migration.
  const old=deserializeWorld(asOldSchema(serializeWorld(w),373));
  expect(old.apparelPolicies.every(p=>!Object.hasOwn(p,'taintedAllowed374'))).toBe(true);
  // The registry made for old migrations is unchanged.
  expect(createDefaultApparelPolicyRegistry(false,false,false,false,false,false,false,false).apparelPolicies.every(p=>!Object.hasOwn(p,'taintedAllowed374'))).toBe(true);
});
