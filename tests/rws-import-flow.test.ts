import {afterEach,describe,expect,it,vi} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {runRwsImport,handleRwsImportRequest,importProgress,type RwsImportOutcome,type RwsImportProgress,type RwsImportWorkerMessage,type RwsImportWorkerRequest} from '../src/import/rimworld/import-job.ts';
import {startRimWorldImport,rimWorldReportFileName} from '../src/ui/rimworld-import.ts';
import {readRwsSave} from '../src/import/rimworld/rws-save.ts';
import {convertRwsSave} from '../src/import/rimworld/convert.ts';
import {deserializeCampaign,serializeCampaignUnchecked,serializeWorld,validateWorld} from '../src/sim/serialization.ts';
import {GameSession} from '../src/ui/game-session.ts';
import type {SessionStorage} from '../src/ui/save-repository.ts';

// Step 3 of the RimWorld save import: the job the import Worker runs, its
// page-side client, and the adoption of the converted save by the ordinary
// load path. The fixture is the small hand-written colony of step 2.
const fixturePath=resolve('tests/fixtures/rws/petite-colonie.rws');
const fixture=readFileSync(fixturePath,'utf8');
const dlc=fixture.replace('<li>ludeon.rimworld</li></modIds>','<li>ludeon.rimworld</li><li>ludeon.rimworld.biotech</li></modIds>').replace('<li>Core</li></modNames>','<li>Core</li><li>Biotech</li></modNames>');
const converted=(o:RwsImportOutcome)=>{if(o.status!=='converted')throw Error(`expected a conversion, got ${o.status}: ${'message' in o?o.message:''}`);return o;};

describe('Import job (what the import Worker runs)',()=>{
 const progress:RwsImportProgress[]=[];
 const outcome=converted(runRwsImport(fixture,'petite-colonie.rws',p=>progress.push(p)));
 it('reports every stage once, in order, with a bar that only moves forward',()=>{
  // A 20×20 map has no geographic colony: no planet or colony stage.
  expect(progress.map(p=>p.stage)).toEqual(['read','analyze','terrain','buildings','plants','people','items','zones','research','finish','validate','serialize','reload']);
  for(let i=1;i<progress.length;i++)expect(progress[i]!.fraction).toBeGreaterThan(progress[i-1]!.fraction);
  expect(progress.every(p=>p.fraction>=0&&p.fraction<1&&p.label.length>0)).toBe(true);
  expect(importProgress('colony',.5).fraction).toBeGreaterThan(importProgress('colony').fraction);
  expect(importProgress('colony',1).fraction).toBe(importProgress('terrain').fraction);
 });
 it('produces the Elsewhere save of the conversion, valid and reloading to the same text',()=>{
  expect(outcome.save).toBe(serializeWorld(convertRwsSave(readRwsSave(fixture)).world));
  const reloaded=deserializeCampaign(outcome.save);
  expect(validateWorld(reloaded)).toEqual([]);expect(serializeCampaignUnchecked(reloaded)).toBe(outcome.save);
  expect(outcome.bytes).toBe(outcome.save.length);expect(outcome.planetMode).toBe('none');
  expect(outcome).toMatchObject({fileName:'petite-colonie.rws',colonists:2,animals:1,facts:{mapSize:'20×20',colonists:2,scenario:'Petite colonie',version:expect.stringMatching(/^1\.6/)}});
 });
 it('summarises each family (repris, adapté, perdu) and names the main losses',()=>{
  const family=(f:string)=>outcome.families.find(c=>c.family===f)!;
  expect(family('buildings')).toMatchObject({label:'Bâtiments'});
  expect(family('traits')).toMatchObject({exact:5,dropped:0});
  expect(outcome.families.every(c=>c.exact+c.adapted+c.dropped+c.unknown>0||c.before!==undefined)).toBe(true);
  expect(outcome.losses.length).toBeGreaterThan(0);expect(outcome.losses.length).toBeLessThanOrEqual(12);
  for(let i=1;i<outcome.losses.length;i++)expect(outcome.losses[i]!.count).toBeLessThanOrEqual(outcome.losses[i-1]!.count);
  expect(outcome.losses.some(l=>l.def.startsWith('Thrumbo')&&l.note?.includes('Thrumbo'))).toBe(true);
  expect(outcome.details.find(d=>d.family==='animals')?.rows.some(r=>r.def==='Husky (colonie)'&&r.status==='exact')).toBe(true);
 });
 it('keeps the full French report, without claiming ticks it did not run',()=>{
  expect(outcome.report).toContain('## Bilan par famille (conversion)');expect(outcome.report).toContain('Rechargement exact (sérialiser, relire, resérialiser) : identique');
  expect(outcome.report).toContain('Thrumbo : espèce absente');expect(outcome.report).not.toContain('Simulation après import');
 });
 it('refuses an expansion save with its French reason and a report, converting nothing',()=>{
  const steps:string[]=[],refused=runRwsImport(dlc,'biotech.rws',p=>steps.push(p.stage));
  expect(refused.status).toBe('refused');if(refused.status!=='refused')return;
  expect(refused.reasons.join(' ')).toContain('Extensions non prises en charge : Biotech');
  expect(refused.report).toContain('refusée');expect('save' in refused).toBe(false);
  expect(steps).toEqual(['read','analyze']);
 });
 it('fails in French on a file that is not a RimWorld save',()=>{
  const failed=runRwsImport('<notasave/>','faux.rws');
  expect(failed).toMatchObject({status:'failed',fileName:'faux.rws'});
  expect(failed.status==='failed'&&failed.message).toMatch(/^Ce fichier n’est pas une sauvegarde RimWorld lisible : .*sauvegarde RimWorld/);
  expect(runRwsImport('pas du XML <a>','x.rws')).toMatchObject({status:'failed'});
 });
});

describe('Import Worker protocol',()=>{
 const post=async(file:Blob&{name?:string})=>{const messages:RwsImportWorkerMessage[]=[];await handleRwsImportRequest({type:'import',file},m=>messages.push(m));return messages;};
 it('reads the file in the Worker, posts its progress, then one outcome',async()=>{
  const messages=await post(new File([fixture],'petite-colonie.rws'));
  const done=messages.at(-1)!;expect(done.type).toBe('done');expect(messages.filter(m=>m.type==='done')).toHaveLength(1);
  expect(done.type==='done'&&done.outcome.status).toBe('converted');
  const stages=messages.flatMap(m=>m.type==='progress'?[m.progress.stage]:[]);
  expect(stages[0]).toBe('read');expect(stages.filter(s=>s==='read')).toHaveLength(1);expect(stages.at(-1)).toBe('reload');
 });
 it('refuses an empty file and reports a refusal or a failure as an outcome',async()=>{
  expect((await post(new File([],'vide.rws'))).at(-1)).toMatchObject({type:'done',outcome:{status:'failed',message:expect.stringContaining('vide')}});
  expect((await post(new File([dlc],'biotech.rws'))).at(-1)).toMatchObject({type:'done',outcome:{status:'refused'}});
 });
});

/** In-process stand-in of the dedicated Worker: same request handler, asynchronous like a thread. */
class FakeWorker {
 static created:FakeWorker[]=[];
 onmessage:((event:MessageEvent<RwsImportWorkerMessage>)=>void)|null=null;onerror:((event:ErrorEvent)=>void)|null=null;
 terminated=false;hold=false;held:RwsImportWorkerMessage[]=[];
 constructor(){FakeWorker.created.push(this);}
 postMessage(request:RwsImportWorkerRequest){setTimeout(()=>void handleRwsImportRequest(request,m=>{if(this.terminated)return;if(this.hold)this.held.push(m);else this.onmessage?.({data:m} as MessageEvent<RwsImportWorkerMessage>);}),0);}
 release(){this.hold=false;for(const m of this.held.splice(0))if(!this.terminated)this.onmessage?.({data:m} as MessageEvent<RwsImportWorkerMessage>);}
 terminate(){this.terminated=true;}
}
afterEach(()=>{FakeWorker.created=[];});

describe('Page-side import client',()=>{
 it('runs in its own Worker, forwards progress and terminates the Worker once done',async()=>{
  const seen:RwsImportProgress[]=[];
  const job=startRimWorldImport(new File([fixture],'petite-colonie.rws'),p=>seen.push(p),()=>new FakeWorker() as unknown as Worker);
  const result=await job.done;
  expect(result.status).toBe('converted');expect(seen[0]?.stage).toBe('read');expect(seen.at(-1)?.stage).toBe('reload');
  expect(FakeWorker.created).toHaveLength(1);expect(FakeWorker.created[0]!.terminated).toBe(true);
  job.cancel();expect(await job.done).toBe(result);
 });
 it('cancels at once: the Worker is stopped and its later messages are ignored',async()=>{
  const seen:RwsImportProgress[]=[];
  const job=startRimWorldImport(new File([fixture],'petite-colonie.rws'),p=>seen.push(p),()=>{const w=new FakeWorker();w.hold=true;return w as unknown as Worker;});
  job.cancel();
  expect(await job.done).toEqual({status:'cancelled'});
  const worker=FakeWorker.created[0]!;expect(worker.terminated).toBe(true);
  await new Promise(r=>setTimeout(r,20));worker.release();expect(seen).toEqual([]);
 });
 it('never falls back to the page thread: no Worker or a Worker error is a French failure',async()=>{
  expect(await startRimWorldImport(new File(['x'],'a.rws'),()=>{},()=>undefined).done).toMatchObject({status:'failed',message:expect.stringContaining('Worker indisponible')});
  expect(await startRimWorldImport(new File(['x'],'a.rws'),()=>{},()=>{throw Error('no');}).done).toMatchObject({status:'failed'});
  const job=startRimWorldImport(new File([fixture],'a.rws'),()=>{},()=>{const w=new FakeWorker();w.hold=true;return w as unknown as Worker;});
  FakeWorker.created[0]!.onerror!({preventDefault(){}} as ErrorEvent);
  expect(await job.done).toMatchObject({status:'failed',message:expect.stringContaining('colonie actuelle et vos sauvegardes sont conservées')});
  expect(FakeWorker.created[0]!.terminated).toBe(true);
 });
 it('names the downloaded report after the save',()=>{
  expect(rimWorldReportFileName('Ma colonie.rws')).toBe('Ma colonie-rapport-import.md');
  expect(rimWorldReportFileName('a/b:c.RWS')).toBe('a_b_c-rapport-import.md');expect(rimWorldReportFileName('.rws')).toBe('sauvegarde-rapport-import.md');
 });
});

describe('Adoption of the converted colony',()=>{
 it('goes through the ordinary external load: strict reload in the simulation, recovery copy of the open colony',async()=>{
  const outcome=converted(runRwsImport(fixture,'petite-colonie.rws'));
  const map=new Map<string,string>(),storage:SessionStorage={getItem:k=>map.get(k)??null,setItem:(k,v)=>{map.set(k,v);},removeItem:k=>{map.delete(k);}};
  // The simulation Worker's load: deserializeCampaign with its strict validation.
  let world:ReturnType<typeof deserializeCampaign>|undefined;
  const client={init:vi.fn(async()=>undefined),load:vi.fn(async(data:string)=>{world=deserializeCampaign(data);}),save:vi.fn(async()=>world?serializeCampaignUnchecked(world):undefined)};
  const prepared=vi.fn(async()=>{}),session=new GameSession(client,()=>storage,prepared);
  await session.initializeStorage();
  await session.loadExternal(async()=>outcome.save);
  expect(client.load).toHaveBeenCalledExactlyOnceWith(outcome.save);expect(session.hasWorld).toBe(true);expect(prepared).toHaveBeenCalledOnce();
  expect(validateWorld(world)).toEqual([]);expect(serializeCampaignUnchecked(world!)).toBe(outcome.save);
  // Nothing was stored by the import itself; the converted colony is then saved like any game.
  expect([...map.keys()]).toEqual([]);
  await session.save();expect(map.size).toBe(1);
  // A second import keeps the open colony in « Colonie précédente », as any load.
  await session.loadExternal(async()=>outcome.save);expect(map.size).toBe(2);
 });
 it('a refused or invalid text never replaces the open colony',async()=>{
  const storage:SessionStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};
  const client={init:vi.fn(async()=>undefined),load:vi.fn(async(data:string)=>{deserializeCampaign(data);}),save:vi.fn(async()=>undefined)};
  const session=new GameSession(client,()=>storage,async()=>{});
  await expect(session.loadExternal(async()=>'{"schemaVersion":1}')).rejects.toThrow();expect(session.hasWorld).toBe(false);
 });
});

// Opt-in: RWS_IMPORT_SAVE=path/to/save.rws runs the whole job on a real save (read only).
const real=process.env.RWS_IMPORT_SAVE;
describe.skipIf(!real||!existsSync(real))('Import job on a real RimWorld save (opt-in)',()=>{
 it('converts with progress through the planet and the colony, and the save reloads',async()=>{
  const messages:RwsImportWorkerMessage[]=[];
  await handleRwsImportRequest({type:'import',file:new File([readFileSync(real!)],basename(real!))},m=>messages.push(m));
  const stages=new Set(messages.flatMap(m=>m.type==='progress'?[m.progress.stage]:[]));
  expect([...stages]).toEqual(expect.arrayContaining(['planet','colony','reload']));
  const done=messages.at(-1)!;expect(done.type).toBe('done');
  const outcome=converted((done as {outcome:RwsImportOutcome}).outcome);
  expect(outcome.planetMode).toBe('save');expect(validateWorld(deserializeCampaign(outcome.save))).toEqual([]);
 },600_000);
});
