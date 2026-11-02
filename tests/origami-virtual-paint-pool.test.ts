import {describe,it} from 'vitest';
import {VirtualPaintPool,type VirtualPaintDescriptor} from '../src/render/origami/virtual-paint-pool';

// Pure contracts: no Canvas, renderer, simulation or pixel buffers.
const check=(condition:unknown,message:string)=>{if(!condition)throw Error(message);};
const refuses=(run:()=>unknown)=>{let refused=false;try{run();}catch{refused=true;}check(refused,'Expected a refusal');};
function base():VirtualPaintDescriptor[]{return Array.from({length:43},(_,id)=>({key:id===0?'generic-gouache':`protected:${id}`,config:{baseColor:id===0?'#ffffff':`#${(id+1).toString(16).padStart(6,'0')}`,secondaryColor:'#dddddd',strokeStyle:id===0?'directional':'coarse',strokeCount:340},seed:id===0?1337:42,sourceIndex:id===0?undefined:7,refreshSeed:id===0?undefined:9876}));}
function extra(key:string):VirtualPaintDescriptor{return {...base()[1]!,key,config:{...base()[1]!.config,baseColor:'#aabbcc'}};}
const contracts=[
 {name:'43 protected IDs plus catalog declarations create no pixel residency',run(){
  const pool=new VirtualPaintPool(base());for(let i=0;i<100;i++)pool.register(extra(`new:${i}`));
  for(let id=0;id<43;id++)check(pool.id(id===0?'generic-gouache':`protected:${id}`)===id,'Protected ID moved');
  check(pool.stats().residentCount===0&&pool.stats().physicalPixelCpuBytes===0&&!pool.metadataData(),'Metadata registration allocated paint');check(pool.plan().entries.length===0,'No demand should mean no bake entries');
 }},
 {name:'only actual species demand admits profiles; declarations alone stay virtual',run(){
  const pool=new VirtualPaintPool(base());for(let i=0;i<53;i++)pool.declareSpecies(`species:${i}`,[1+i%42]);
  pool.requireSpecies('visible-wildlife',['species:2','species:3']);const plan=pool.plan();check(plan.entries.length===2,'Inactive species were admitted');pool.commit(plan);check(pool.stats().residentCount===2,'Wrong live admission');
 }},
 {name:'generic0 remains physical0 even if a different ID is admitted first',run(){
  const pool=new VirtualPaintPool(base());pool.requireProfiles('first',[42]);pool.commit(pool.plan());check(pool.resolve(42)?.[0]===1,'Non-generic stole reserved0');check(!pool.resolve(0),'Generic was eagerly baked');
  pool.requireProfiles('generic',[0]);pool.commit(pool.plan());check(pool.resolve(0)?.[0]===0&&pool.resolve(42)?.[0]===1,'Generic admission moved existing slots');
 }},
 {name:'271 demanded pigments cross256 while virtual IDs and one shared face remain stable',run(){
  const pool=new VirtualPaintPool(base());while(pool.stats().virtualCount<272)pool.register(extra(`palette:${pool.stats().virtualCount}`));
  pool.requireProfiles('palettes',Array.from({length:271},(_,i)=>i+1));const plan=pool.plan();check(plan.bankShapes[0]?.depth===256&&plan.bankShapes[1]?.depth===16,'Wrong exact bank dimensions');check(plan.faceDepth===1,'RGB palettes duplicated a shared face');pool.commit(plan);check(pool.resolve(271)?.[0]===271,'Bank1 mapping wrong');check(pool.metadataData()?.[542]===271,'RG32 row mapping wrong');
 }},
 {name:'human rows keep virtual IDs unique and defer admission',run(){
  const pool=new VirtualPaintPool(base()),ids=[34,35,36,37,38,39,40,41,42,34,35,36],row=pool.registerHumanRow(ids);
  check(row===pool.registerHumanRow(ids),'Equal human row not interned');refuses(()=>pool.register(extra('late-species')));const skin=pool.registerHumanProfile(extra('human:skin:variant')),other=[...ids];other[0]=skin;check(pool.registerHumanRow(other)!==row,'Different human appearance lost');check(pool.stats().residentCount===0,'Row registration baked pixels');
  pool.requireHumanRow('pawn',row);pool.commit(pool.plan());check(pool.stats().residentCount===9,'Unused human variant admitted');check(pool.humanRowsData()[0]===34,'Human row was replaced by physical ID');
 }},
 {name:'stale plan refuses before metadata publication',run(){
  const pool=new VirtualPaintPool(base());pool.requireProfiles('visible',[1]);const plan=pool.plan();pool.register(extra('arrived-during-bake'));refuses(()=>pool.commit(plan));check(!pool.metadataData()&&pool.stats().residentCount===0,'Stale plan mutated state');
 }},
 {name:'capacity errors happen while planning, with no pixel metadata allocated',run(){
  const pool=new VirtualPaintPool(base(),2);pool.requireProfiles('too-many',[1,2]);refuses(()=>pool.plan());check(!pool.metadataData(),'Failure allocated metadata');
  const faces=new VirtualPaintPool(base(),2048,1);faces.requireProfiles('two-templates',[0,1]);refuses(()=>faces.plan());check(!faces.metadataData(),'Template failure allocated metadata');
 }},
 {name:'release/reacquire is stable and does not pretend to implement eviction',run(){
  const pool=new VirtualPaintPool(base());pool.requireProfiles('animal',[1]);pool.commit(pool.plan());const first=pool.resolve(1);pool.release('animal');check(pool.stats().requiredCount===0&&pool.stats().residentCount===1,'Release unexpectedly evicted live texture');pool.requireProfiles('animal',[1]);check(pool.plan().entries.length===0&&String(pool.resolve(1))===String(first),'Reacquire moved slot/rebaked');
 }},
 {name:'repaint uses existing slots/templates and effective descriptor seeds',run(){
  const pool=new VirtualPaintPool(base());pool.requireProfiles('actor',[1,2]);pool.commit(pool.plan());const before=pool.resolve(1),repaint=pool.plan(true);check(repaint.entries.length===2&&repaint.entries.every(entry=>entry.descriptor.seed===9876),'Repaint seed not preserved');pool.commit(repaint);check(String(pool.resolve(1))===String(before)&&pool.stats().faceCount===1,'Repaint appended history/moved metadata');
 }},
 {name:'registered identity cannot overwrite protected source and unadmitted draw refuses',run(){
  const pool=new VirtualPaintPool(base());refuses(()=>pool.register({...base()[1]!,seed:43}));refuses(()=>pool.assertResident([1]));check(pool.id('protected:1')===1,'Refusal changed old ID');
 }},
] as const;

describe('virtual paint residency planning',()=>{for(const contract of contracts)it(contract.name,contract.run);});
