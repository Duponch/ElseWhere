import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {effectiveCore297} from '../src/sim/core-phase-297.ts';
import {stepWorld} from '../src/sim/engine.ts';
import {validateWorld,serializeWorld,deserializeWorld} from '../src/sim/serialization.ts';
import {backgroundWorkRefusal} from '../src/sim/colonist-backgrounds.ts';
import {ImportNotes} from '../src/import/rimworld/notes.ts';
import {gapOrigin} from '../src/import/rimworld/gap-origin.ts';

describe('RWS cold clock adoption',()=>{
 const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
 it('keeps the played Core tick and its sub-macro phase, without aging an artificial map',()=>{
  const source=fixture.replace(/<ticksGame>\d+<\/ticksGame>/,'<ticksGame>360006</ticksGame>')
   .replace('</tickManager>','</tickManager><history><archive><archivables><li Class="Message"><ID>42</ID><text>Ancien message</text><startingTick>123450</startingTick></li></archivables></archive></history>');
  const c=convertRwsSave(readRwsSave(source),{planet:false}),w=c.world;
  expect(w.tick).toBe(36000);expect(w.phaseCore297).toBe(6);expect(effectiveCore297(w)).toBe(360006);
  expect(w.corePathBudget297?.tick).toBe(w.tick);
  expect(w.letters352?.archive).toEqual(expect.arrayContaining([expect.objectContaining({tick:12345,message:'Ancien message'})]));
  expect(w.pawns.every(p=>p.skills.lastResetTick===35000)).toBe(true);
  expect(w.startingArrival).toBeUndefined();expect(validateWorld(w)).toEqual([]);
  const raw=serializeWorld(w),loaded=deserializeWorld(raw);expect(serializeWorld(loaded)).toBe(raw);
  stepWorld(loaded,2);expect(effectiveCore297(loaded)).toBe(360026);expect(validateWorld(loaded)).toEqual([]);
 });
 it('does not generate disabled-work prohibitions for the two named source backstories without one',()=>{
  // The two original non-shuffled stories are not in the current native
  // catalogue; the replacement must not disable a work they could perform.
  const source=fixture.replace('<childhood>MedicalAssistant12</childhood>','<childhood>VatgrownScientist91</childhood>')
   .replace('<adulthood>Gardener99</adulthood>','<adulthood>RunawayDancer35</adulthood>');
  const w=convertRwsSave(readRwsSave(source),{planet:false}).world;
  // verify the imported real hauling priority survives the model adaptation
  expect(backgroundWorkRefusal(w.pawns.find(p=>p.name.startsWith('Alma'))!,'haul')).toBeUndefined();
  expect(validateWorld(w)).toEqual([]);
 });
 it('keeps the permanent Core roof areas in the current persistent roof policy',()=>{
  const grid=(indices:number[])=>{const bits=Buffer.alloc(50);for(const i of indices)bits[i>>3]!|=1<<(i&7);return `<innerGrid><arr>${bits.toString('base64')}</arr></innerGrid>`;};
  const source=fixture.replace('<li Class="Area_BuildRoof"><ID>1</ID></li>',`<li Class="Area_BuildRoof"><ID>1</ID>${grid([21,22])}</li><li Class="Area_NoRoof"><ID>2</ID>${grid([42])}</li>`);
  const w=convertRwsSave(readRwsSave(source),{planet:false}).world;
  expect(w.roofing?.build).toEqual([18*20+1,18*20+2]);expect(w.roofing?.remove).toEqual([17*20+2]);
  expect(validateWorld(w)).toEqual([]);
 });
 it('does not merge two different proven reasons for the same missing definition',()=>{
  const n=new ImportNotes();n.def('items','Test','dropped',undefined,'Propriétaire absent.',1,'source');n.def('items','Test','dropped',undefined,'Modèle absent.',2,'model');
  const rows=[...n.tallies.get('items')!.values()];expect(rows.map(r=>[gapOrigin('items',r),r.count])).toEqual([['source',1],['model',2]]);
  expect(gapOrigin('items',{def:'Mystère',status:'unknown',count:1})).toBe('unresolved');
 });
});
