// Loading validates a historical save at its own schema and the final world,
// not each intermediate schema produced by our migrations (serialization.ts,
// verifyMigrationSteps). The test suite turns the intermediate checks back on
// (tests/setup-migration-steps.ts); here both modes load the same saves.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {afterEach,expect,test} from 'vitest';
import {deserializeCampaign,setMigrationStepValidation,type CampaignLoadProgress} from '../src/sim/serialization.ts';
import {SCHEMA_VERSION} from '../src/sim/types.ts';

afterEach(()=>setMigrationStepValidation(true));
test('the test suite validates every intermediate schema (tests/setup-migration-steps.ts)',()=>{
  expect((globalThis as {__verifyMigrationSteps?:boolean}).__verifyMigrationSteps).toBe(true);
});
const save=(path:string)=>{
  const text=readFileSync(new URL(`../public/test-saves/${path}`,import.meta.url),'utf8'),v=JSON.parse(text);
  return v.format==='lisiere-save'?gunzipSync(Buffer.from(v.payload,'base64')).toString('utf8'):text;
};
const load=(text:string,steps:boolean)=>{
  setMigrationStepValidation(steps);const progress:CampaignLoadProgress[]=[];
  try{return {world:JSON.stringify(deserializeCampaign(text,p=>progress.push(p))),progress};}
  catch(error){return {world:'refused: '+(error as Error).message,progress};}
};

test.each(['v101/atelier.json','v152/repas-fin.json','v193/expedition-commerciale.json','v216/globe-voyage.json','v394/les-aulnes-integrees.json'])(
  'without the intermediate checks, %s loads the same world with the same progress steps',path=>{
  const text=save(path),version=JSON.parse(text).schemaVersion as number;
  expect(version).toBeLessThan(SCHEMA_VERSION);
  const checked=load(text,true),final=load(text,false);
  expect(checked.world.startsWith('refused')).toBe(false);
  expect(final.world).toBe(checked.world);
  expect(final.progress).toEqual(checked.progress);
},120_000);

test('a save invalid at its own schema is still refused at its own step',()=>{
  const raw=JSON.parse(save('v216/globe-voyage.json'));raw.pawns[0].hunger='plein';
  const text=JSON.stringify(raw),checked=load(text,true),final=load(text,false);
  expect(final.world).toMatch(/^refused: Invalid version ?196 save/);
  expect(final.world).toBe(checked.world);
});
