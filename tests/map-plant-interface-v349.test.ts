import {expect,test} from 'vitest';
import {treeTransferScene,preparedTreeWrapper} from './scenarios/tree-transfer-v349';
import {medicalCamp} from './scenarios/health';
import {applyCommand} from '../src/sim/engine';
import {mapObjectActions,mapObjectGroupActions} from '../src/ui/map-object-actions';
import {mapObjectsAt,mapObjectCells,mapObjectExists,mapResourceSelectable,nextMapObject} from '../src/ui/map-object-selection';
import {matchingMapObjects,mapObjectGroupCells} from '../src/ui/map-object-group-selection';
import {FLORA_DEFINITIONS,type PlantSpecies} from '../src/sim/biome-flora';
import {actionProgress} from '../src/render/action-feedback';
import {specificWorkActivity} from '../src/ui/work-activity';
import {queryJobStatus} from '../src/sim/diagnostics';
import type {World,Resource,Job} from '../src/sim/types';

// UI projection fragments are declared as such; played custody and save guards
// live in the separate V349 runtime / persistence tests.
const before=(w:World)=>structuredClone(w);
function flora(w:World,species:PlantSpecies,x:number,z:number):Resource {const def=FLORA_DEFINITIONS[species];return {id:w.nextId++,kind:def.kind,species,x,z,amount:def.yield,growth:.5,growthTick:w.tick};}
const allVisible=()=>true;

test.each(['wall','door','table'] as const)('V349 plant gizmos and map cycling remain available under a %s ghost',kind=>{
  const w=treeTransferScene('oak',.1),tree=w.resources[0]!;expect(applyCommand(w,{type:'designate',kind,material:'wood',x:tree.x,z:tree.z}).ok).toBe(true);const job=w.jobs[0]!,saved=before(w),selected={kind:'resource' as const,id:tree.id};
  const actions=mapObjectActions(w,selected);expect(actions.map(a=>a.id)).toEqual(['cut','extract']);expect(actions.find(a=>a.id==='cut')).toMatchObject({label:'Couper',command:{type:'designate',kind:'cut',x:tree.x,z:tree.z}});expect(actions.find(a=>a.id==='extract')).toMatchObject({label:'Déraciner',command:{type:'extract-tree',resourceId:tree.id}});
  expect(mapObjectsAt(w,tree)).toContainEqual(selected);expect(mapObjectsAt(w,tree)).toContainEqual({kind:'job',id:job.id});expect(nextMapObject(w,tree,selected)).toEqual({kind:'job',id:job.id});expect(nextMapObject(w,tree,{kind:'job',id:job.id})).toEqual(selected);expect(w).toEqual(saved);
});

test('V349 resource and ghost inspectors cancel different exact identities at one coordinate',()=>{
  const w=treeTransferScene('oak',1),tree=w.resources[0]!;expect(applyCommand(w,{type:'designate',kind:'wall',material:'wood',x:tree.x,z:tree.z}).ok).toBe(true);const ghost=w.jobs[0]!;expect(applyCommand(w,{type:'extract-tree',resourceId:tree.id}).ok).toBe(true);const extract=w.jobs.find(j=>j.kind==='extract-tree')!,saved=before(w);
  expect(mapObjectActions(w,{kind:'resource',id:tree.id}).find(a=>a.id==='cancel')?.command).toEqual({type:'cancel-resource',resourceId:tree.id});expect(mapObjectActions(w,{kind:'job',id:ghost.id}).find(a=>a.id==='cancel')?.command).toEqual({type:'cancel-job',jobId:ghost.id});expect(mapObjectActions(w,{kind:'job',id:extract.id}).find(a=>a.id==='cancel')?.command).toEqual({type:'cancel-job',jobId:extract.id});expect(w).toEqual(saved);
});

test('V349 a loose resource inspector cancels its exact mine Job rather than a plant identity',()=>{
  const w=medicalCamp(),r:Resource={id:w.nextId++,kind:'rock',x:12,z:10,amount:1};w.tiles[r.z*w.width+r.x]={terrain:'rock',stone:'granite'};w.resources=[r];const job:Job={id:w.nextId++,kind:'mine',x:r.x,z:r.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0}};w.jobs=[job];
  expect(mapObjectActions(w,{kind:'resource',id:r.id}).find(a=>a.id==='cancel')?.command).toEqual({type:'cancel-job',jobId:job.id});
});

test('V349 flagged fragment offers a targeted cancellation and distinct Transporter wording',()=>{
  const w=medicalCamp(),pile={id:w.nextId++,kind:'chunk' as const,item:'granite-chunk' as const,quantity:1,owner:{type:'ground' as const,x:12,z:10}};w.piles=[pile];expect(mapObjectActions(w,{kind:'pile',id:pile.id})).toEqual([{id:'haul-chunks',label:'Transporter',command:{type:'area',action:'haul-chunks',from:{x:12,z:10},to:{x:12,z:10}}}]);Object.assign(pile,{haulRequested:true});const saved=before(w);expect(mapObjectActions(w,{kind:'pile',id:pile.id})).toEqual([{id:'cancel',label:'Annuler l’ordre',command:{type:'cancel-pile',pileId:pile.id}}]);expect(w).toEqual(saved);
});

test('V349 replant starts one placement mode, then wrapper and plan offer its exact cancellation',()=>{
  const {w,pile}=preparedTreeWrapper(),saved=before(w),selected={kind:'pile' as const,id:pile.id};expect(mapObjectActions(w,selected)).toEqual([{id:'replant',label:'Replanter',placementPileId:pile.id}]);expect(mapObjectGroupActions(w,[selected])).toEqual([]);expect(w).toEqual(saved);
  expect(applyCommand(w,{type:'replant-tree',pileId:pile.id,x:20,z:14}).ok).toBe(true);const job=w.jobs.find(j=>j.kind==='replant-tree')!;expect(mapObjectActions(w,selected)).toEqual([{id:'cancel',label:'Annuler l’ordre',command:{type:'cancel-job',jobId:job.id}}]);expect(mapObjectGroupActions(w,[selected,selected])).toEqual([{id:'cancel',label:'Annuler l’ordre',commands:[{type:'cancel-job',jobId:job.id}]}]);
});

test.each(['grass','tall-grass','brambles','moss'] as const)('V349 physical %s has hover data but no click, group, stale selection or gizmo target',species=>{
  const w=medicalCamp(),first=flora(w,species,12,10),second=flora(w,species,13,10);w.resources=[first,second];const saved=before(w),target={kind:'resource' as const,id:first.id};
  expect(mapResourceSelectable(first)).toBe(false);expect(mapObjectsAt(w,first)).toEqual([]);expect(mapObjectCells(w,target)).toEqual([]);expect(mapObjectExists(w,target)).toBe(false);expect(nextMapObject(w,first,target)).toBeUndefined();expect(matchingMapObjects(w,target,allVisible)).toEqual([]);expect(mapObjectGroupCells(w,[target,{kind:'resource',id:second.id}])).toEqual([[],[]]);expect(mapObjectActions(w,target)).toEqual([]);expect(mapObjectGroupActions(w,[target,{kind:'resource',id:second.id}])).toEqual([]);expect(w.resources).toEqual([first,second]);expect(w).toEqual(saved);
});

test.each([['oak',false],['poplar',false],['pine',false],['birch',false],['drago',false],['saguaro',false],['berry-bush',true],['agave',true],['healroot-wild',true]] as const)('V349 %s retains normal click and its concrete Core group eligibility',(species,multi)=>{
  const w=medicalCamp(),first=flora(w,species,12,10),second=flora(w,species,13,10);w.resources=[first,second];const saved=before(w),target={kind:'resource' as const,id:first.id};expect(mapResourceSelectable(first)).toBe(true);expect(mapObjectsAt(w,first)).toContainEqual(target);expect(mapObjectExists(w,target)).toBe(true);expect(matchingMapObjects(w,target,allVisible)).toEqual(multi?[target,{kind:'resource',id:second.id}]:[]);expect(w).toEqual(saved);
});

test.each(['rice','potato','corn','cotton','healroot','haygrass','tree'] as const)('V349 crop / historical %s remains selectable with its concrete or TreeBase group policy',kind=>{
  const w=medicalCamp(),first:Resource={id:w.nextId++,kind,x:12,z:10,amount:kind==='healroot'?1:10},second={...first,id:w.nextId++,x:13};w.resources=[first,second];const target={kind:'resource' as const,id:first.id};expect(mapResourceSelectable(first)).toBe(true);expect(mapObjectCells(w,target)).toEqual([first]);expect(matchingMapObjects(w,target,allVisible)).toEqual([]);
});

function activeExtraction(){const w=treeTransferScene('oak',.1),p=w.pawns[0]!,tree=w.resources[0]!;expect(applyCommand(w,{type:'extract-tree',resourceId:tree.id}).ok).toBe(true);const job=w.jobs.find(j=>j.kind==='extract-tree')!;Object.assign(job,{status:'active',reservedBy:p.id,progress:700,workRemainder:5000});Object.assign(p,{jobId:job.id,state:'working',x:11,z:10,path:[],moveCooldown:0});delete p.motion;return {w,p,job,tree};}
function activeReplant(phase:'pickup'|'carry'|'prepare'){const {w,pile}=preparedTreeWrapper(),p=w.pawns[0]!;expect(applyCommand(w,{type:'replant-tree',pileId:pile.id,x:20,z:14}).ok).toBe(true);const job=w.jobs.find(j=>j.kind==='replant-tree')!;job.status='active';job.reservedBy=p.id;p.jobId=job.id;p.state=phase==='prepare'?'working':'moving';p.path=[];p.moveCooldown=0;delete p.motion;const task=job.tree!;if(task.kind!=='replant')throw Error('Prepared tree task mismatch');task.phase=phase;if(phase!=='pickup'){pile.owner={type:'pawn',pawnId:p.id};task.carryPileId=pile.id;}if(phase==='prepare'){task.durationCore=640;task.workCore=160;job.progress=160;p.x=20;p.z=13;}return {w,p,pile,job,task};}

test('V349 extraction label and bar use the original species work in Core units, without modifying the source',()=>{
  const {w,p,job,tree}=activeExtraction(),saved=before(w);expect(specificWorkActivity(w,p)).toContain('Déracinement');expect(specificWorkActivity(w,p)).toContain('(50 %)');expect(actionProgress(w,p,{jobs:new Map([[job.id,job]]),resources:new Map([[tree.id,tree]])})).toMatchObject({kind:'job',completed:700.5,total:1400,fraction:700.5/1400});expect(queryJobStatus(w,job)).toMatchObject({code:'working',reason:expect.stringContaining('(50 %)')});expect(w).toEqual(saved);
  p.state='moving';expect(queryJobStatus(w,job).reason).toContain('pour le déraciner');expect(specificWorkActivity(w,p)).toContain('pour le déraciner');expect(actionProgress(w,p)).toBeUndefined();
});

test('V349 missing extraction source gives neither a forged activity nor a fallback duration',()=>{const {w,p,job}=activeExtraction();w.resources=[];expect(queryJobStatus(w,job)).toMatchObject({code:'blocked',reason:'L’arbre à déraciner est indisponible.'});expect(specificWorkActivity(w,p)).toBeUndefined();expect(actionProgress(w,p)).toBeUndefined();});

test.each(['pickup','carry'] as const)('V349 replant %s reports the real phase without a fake local completion gauge',phase=>{const {w,p,job}=activeReplant(phase),saved=before(w);expect(queryJobStatus(w,job)).toMatchObject({code:phase==='carry'?'delivering':'working',reason:expect.stringContaining(phase==='pickup'?'pour le replanter':'transporte')});expect(specificWorkActivity(w,p)).toContain(phase==='pickup'?'pour le replanter':'Transport');expect(actionProgress(w,p)).toBeUndefined();p.state='working';expect(actionProgress(w,p)).toBeUndefined();p.state='moving';expect(w).toEqual(saved);});

test('V349 preparation reads its captured durationCore / workCore and exact held original, not generic construction work',()=>{
  const {w,p,pile,task,job}=activeReplant('prepare'),saved=before(w);expect(queryJobStatus(w,job)).toMatchObject({code:'working',reason:expect.stringContaining('(25 %)')});expect(specificWorkActivity(w,p)).toContain('Replantation');expect(specificWorkActivity(w,p)).toContain('(25 %)');expect(actionProgress(w,p)).toMatchObject({kind:'job',completed:160,total:640,fraction:.25});expect(w).toEqual(saved);
  pile.owner={type:'pawn',pawnId:w.pawns[1]!.id};expect(queryJobStatus(w,job)).toMatchObject({code:'blocked',reason:'Attend le porteur de l’arbre déraciné.'});expect(specificWorkActivity(w,p)).toBeUndefined();expect(actionProgress(w,p)).toBeUndefined();expect(task.durationCore).toBe(640);
});

test('V349 replant destination clearance displays its separate plant counter before preparation',()=>{
  const {w,p,job,task}=activeReplant('carry'),grass=flora(w,'grass',20,14);w.resources=[grass];job.clearance={resourceId:grass.id,progress:12,workRemainder:5000};p.state='working';const saved=before(w);expect(queryJobStatus(w,job)).toMatchObject({code:'clearing',reason:expect.stringContaining('avant replantation (20 %)')});expect(specificWorkActivity(w,p)).toContain('avant replantation');expect(specificWorkActivity(w,p)).toContain('(20 %)');expect(actionProgress(w,p)).toMatchObject({kind:'clearing',completed:12.5,total:60});expect(task.workCore).toBe(0);expect(w).toEqual(saved);
});
