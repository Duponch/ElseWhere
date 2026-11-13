import fs from 'node:fs';
import {extendApparelPolicies308} from '../src/sim/apparel-policy.ts';
import {stripFutureContent} from './scenarios/old-schema.ts';
import {deserializeCampaign,validateWorld} from '../src/sim/serialization.ts';
import {test,expect} from 'vitest';
import {effectiveCore297,validPhaseCore297} from '../src/sim/core-phase-297.ts';
import {isCorePhysicalSchema297} from '../src/sim/physical-schema-297.ts';
import {isSchema298OrLater,isSchema299OrLater} from '../src/sim/schema-compatibility-257.ts';
import {validHumanIngestionPawn299} from '../src/sim/human-ingestion-save-299.ts';
import {foodBingeDue299,localIngestionCore299,commitHumanIngestion299} from '../src/sim/human-ingestion-clock299.ts';
import type {Pawn,World} from '../src/sim/types.ts';

test('299 through309 retain physical phase and food provenance; historical and next future fields stay closed',()=>{
 for(const version of [299,300,301,302,303,304,305,306,307,308,309]){
  const frame={schemaVersion:version,tick:123,phaseCore297:7};
  expect(isCorePhysicalSchema297(version)).toBe(true);expect(isSchema298OrLater(version)).toBe(true);expect(isSchema299OrLater(version)).toBe(true);
  expect(validPhaseCore297(frame,version)).toBe(true);expect(effectiveCore297(frame)).toBe(1237);
  expect(validHumanIngestionPawn299({lastIngestAtCore299:1237},version,1237)).toBe(true);
  expect(validHumanIngestionPawn299({lastIngestAtCore299:1238},version,1237)).toBe(false);
 }
 expect(validHumanIngestionPawn299({lastIngestAtCore299:0},298,0)).toBe(false);
 expect(isCorePhysicalSchema297(310)).toBe(false);expect(isSchema298OrLater(310)).toBe(false);expect(isSchema299OrLater(310)).toBe(false);
 expect(validPhaseCore297({schemaVersion:310,tick:123,phaseCore297:7},310)).toBe(false);
 expect(validHumanIngestionPawn299({},310,0)).toBe(false);
});

test('food299 rules continue on300 at the actual ingestion commit, with no generated history',()=>{
 // Field-only clock fixture: not a Whole/Engine/Native authority.
 const p={mental:{crisis:{kind:'food-binge'}}} as Pawn;
 const w={schemaVersion:300,tick:110,phaseCore297:0,pawns:[p]} as unknown as World;
 expect(Object.hasOwn(p,'lastIngestAtCore299')).toBe(false);expect(foodBingeDue299(w,p)).toBe(true);
 const core=localIngestionCore299(w,p);expect(core).toBe(1100);expect(Object.hasOwn(p,'lastIngestAtCore299')).toBe(false);
 commitHumanIngestion299(p,core);expect(p.lastIngestAtCore299).toBe(1100);
 w.tick=220;expect(foodBingeDue299(w,p)).toBe(false);w.phaseCore297=1;expect(foodBingeDue299(w,p)).toBe(true);
 expect(()=>localIngestionCore299({...w,pawns:[]} as World,p)).toThrow('actual local person');
});


test('strict299 migrates number-only; historical fields cannot smuggle a future300 task',()=>{
 // Declared metadata fixture: published canonical298 fields are a subset of299;
 // deserialize validates that299 record strictly before migration. No campaign is advanced.
 const before=JSON.parse(fs.readFileSync(new URL('./fixtures/food-binge-cadence299-canonical298.json',import.meta.url),'utf8'));
 before.schemaVersion=299;stripFutureContent(before,299);
 const expected=structuredClone(before);expected.schemaVersion=309;
 // Migration 307 -> 308 extends the policies that allowed plain leather or muffalo wool.
 extendApparelPolicies308(expected.apparelPolicies);
 const after=deserializeCampaign(JSON.stringify(before));expect(after).toStrictEqual(expected);expect(validateWorld(after)).toEqual([]);
 if(!('pawns'in after))throw Error('Declared local fixture expected');
 for(const p of after.pawns){expect(Object.hasOwn(p,'idleWander300')).toBe(false);expect(p.mental?.wander).toStrictEqual(before.pawns.find((q:Pawn)=>q.id===p.id).mental?.wander);}
 before.pawns[0].idleWander300={kind:'wait',at:{x:before.pawns[0].x,z:before.pawns[0].z},startedAtCore:0,expiryIntervalCore:125};
 expect(()=>deserializeCampaign(JSON.stringify(before))).toThrow('Invalid version299 save:');
});
