import {mockRequestId298} from './request-id-binding298';
import {afterEach,expect,test,vi} from 'vitest';
import {SimulationClient,type SimulationOperationProgress} from '../src/bridge/SimulationClient';
import type {Request,Response,SimulationRequestStatus} from '../src/bridge/protocol';
import {LaunchProgress,planetGenerationStep} from '../src/ui/launch-progress';
import {buildNativeLaunchPage} from '../src/ui3d/native-launch';

class Transport {
  static current:Transport;onmessage?:(e:MessageEvent<Response>)=>void;onerror?:unknown;onmessageerror?:unknown;
  requests:Request[]=[];constructor(){Transport.current=this;}postMessage(p:Request){this.requests.push(p);}terminate(){}
  deliver(p:unknown){this.onmessage!({data:p} as MessageEvent<Response>);}
}
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});

test('Worker progress re-arms the 15 s watchdog; silence still reports waiting, then progress withdraws it',async()=>{
  vi.useFakeTimers();vi.stubGlobal('Worker',Transport);
  const client=new SimulationClient(),worker=Transport.current,statuses:SimulationRequestStatus[]=[],steps:SimulationOperationProgress[]=[];
  client.onRequestStatus=status=>statuses.push(status);client.onOperationProgress=step=>steps.push(step);client.onError=()=>{};
  const load=client.load('save'),id=mockRequestId298(worker.requests.at(-1)!);void load.catch(()=>{});
  for(let i=0;i<4;i++){vi.advanceTimersByTime(10_000);worker.deliver({type:'operation-progress',id,stage:'migrate',completed:i,total:38});}
  expect(statuses).toEqual([]);
  expect(steps.map(s=>[s.type,s.stage,s.completed,s.total])).toEqual([0,1,2,3].map(i=>['load','migrate',i,38]));
  vi.advanceTimersByTime(15_000);
  expect(statuses.map(s=>s.state)).toEqual(['waiting']);
  worker.deliver({type:'operation-progress',id,stage:'validate',completed:0,total:2});
  expect(statuses.map(s=>s.state)).toEqual(['waiting','progressing']);
  // Progress never answers the request.
  let settled=false;void load.then(()=>{settled=true;},()=>{settled=true;});await Promise.resolve();expect(settled).toBe(false);
  // Malformed or unrelated progress is ignored and is not mistaken for a reply.
  worker.deliver({type:'operation-progress',id,stage:'unknown',completed:0,total:1});
  worker.deliver({type:'operation-progress',id:id+99,stage:'read',completed:0,total:1});
  worker.deliver({type:'operation-progress',id,stage:'read',completed:2,total:1});
  expect(steps).toHaveLength(5);
  await Promise.resolve();expect(settled).toBe(false);
  client.dispose();
});

test('the loading model only moves forward, skips unreported steps and weighs the versions actually migrated',()=>{
  const fresh=new LaunchProgress('load',0,false);
  expect(fresh.view(0).steps.some(s=>s.label.startsWith('Copie de sécurité'))).toBe(false);
  fresh.report('read');const afterRead=fresh.view(1000).fraction;
  fresh.report('validate',0,2);
  const view=fresh.view(2000);
  expect(view.fraction).toBeGreaterThanOrEqual(afterRead);
  expect(view.steps.some(s=>s.label==='Mise à jour de la sauvegarde')).toBe(false);
  fresh.report('read');expect(fresh.view(3000).stage).toBe('Vérification de la colonie');
  let last=0;
  for(const [stage,completed,total] of [['restore',0,1],['publish',0,1],['renderer',0,1],['world',0,1],['surfaces',1,2],['scene',100,290],['scene',290,290],['actors',3,6],['shadows',0,1]] as const){
    fresh.report(stage,completed,total);const fraction=fresh.view(4000).fraction;expect(fraction).toBeGreaterThanOrEqual(last);last=fraction;
  }
  expect(last).toBeLessThan(1);expect(last).toBeGreaterThan(.9);

  const old=new LaunchProgress('load',0,true);old.report('migrate',0,38);
  const migrating=old.view(5000);
  expect(migrating.steps[0]).toEqual({label:'Copie de sécurité de la colonie ouverte',state:'done'});
  expect(migrating.steps.find(s=>s.label==='Mise à jour de la sauvegarde')?.state).toBe('active');
  old.report('migrate',19,38);expect(old.view(6000).detail).toBe('Version 19 / 38 à mettre à jour');
  expect(old.view(6000).elapsedSeconds).toBe(6);

  const created=new LaunchProgress('create',0,false);created.report('map',6,20,'Plants900');
  expect(created.view(0).title).toBe('Création de la colonie');expect(created.view(0).detail).toBe('Étape 7 / 20 · végétation');
});

test('planet generation steps are labelled and ordered',()=>{
  const terrain=planetGenerationStep('terrain',50,100)!,roads=planetGenerationStep('road-drawing',0,10)!;
  expect(terrain.label).toBe('Reliefs et biomes');expect(roads.fraction).toBeGreaterThan(terrain.fraction);
  expect(planetGenerationStep('unknown-phase',0,1)).toBeUndefined();
});

test('the native loading page shows the bar, the current step and a stop action only while waiting',()=>{
  const model=new LaunchProgress('load',0,false);model.report('scene',120,290);
  const page=buildNativeLaunchPage(model.view(12_000));
  expect(page).toMatchObject({id:'native-launch',title:'Chargement de la colonie',modal:true,closable:false});
  expect(page.rows[0]!.meter).toMatchObject({max:1,label:`${Math.floor(model.view(12_000).fraction*100)} %`});
  expect(page.rows[1]).toMatchObject({label:'Compilation des matériaux',value:'120 / 290 objets'});
  expect(page.rows.at(-1)).toMatchObject({label:'Temps écoulé',value:'12 s'});
  expect(page.actions).toBeUndefined();
  const stop=vi.fn(),waiting=buildNativeLaunchPage(model.view(75_000),{message:'Attente',onStop:stop});
  expect(waiting.rows.find(r=>r.id==='launch-elapsed')?.value).toBe('1 min 15 s');
  void waiting.actions![0]!.onActivate();expect(stop).toHaveBeenCalledOnce();
});
