import { expect,test } from 'vitest';
import { deepDrillingCamp } from './helpers/deep-drilling-v280.ts';
import { CORE_DEEP_RADIAL_382,DEEP_RADIAL,DEEP_RESOURCES,adoptDeepResources,addDeepDeposit,deepResourceAt,nextDeepResource,discoverDeepDeposit,deepScannerOverlayPowered,deepRockItem } from '../src/sim/deep-resources.ts';
import {monoIntrospectiveSort} from '../src/sim/mono-sort.ts';
import {VerseRand,hashCombineInt} from '../src/sim/verse-rand.ts';
import { deepWorkReason,deepWorkSpot } from '../src/sim/deep-drilling-rules.ts';
import { deepWorkProposal,startDeepWork,processDeepWork,reconcileDeepWork } from '../src/sim/deep-drilling.ts';
import { blockedCells,reachableCells,routeToCell } from '../src/sim/pathfinding.ts';
import { groundCapacity,groundPile,nearbyGround } from '../src/sim/ground-placement.ts';
import { releaseWork } from '../src/sim/work-release.ts';
import { stepWorld } from '../src/sim/engine.ts';
import { serializeWorld,deserializeWorld,validateWorld } from '../src/sim/serialization.ts';
import type { NeedContext } from '../src/sim/needs.ts';
import type { Pawn,Structure,World } from '../src/sim/types.ts';

function camp(){const f=deepDrillingCamp(),w=f.world,p=w.pawns.find(p=>p.id===f.minerId)!,r=w.pawns.find(p=>p.id===f.researcherId)!,d=w.structures.find(s=>s.id===f.drillId)!,s=w.structures.find(s=>s.id===f.scannerId)!;return {...f,w,p,r,d,s};}
const reach=(w:World,p:Pawn)=>reachableCells(w,p,blockedCells(w),new Set());
function context(w:World,p:Pawn):NeedContext {return {search:()=>reach(w,p),move:c=>{p.path=routeToCell(w,c,reach(w,p))??[];},release:()=>releaseWork(w,p),event:message=>w.events.push({tick:w.tick,type:'need',message})};}
function begin(w:World,p:Pawn,s:Structure,contact=true){const proposal=deepWorkProposal(w,p,s,reach(w,p));expect(proposal).toBeDefined();if(!proposal)throw Error('No deep-work proposal');startDeepWork(p,proposal);if(contact){p.x=proposal.task.spot.x;p.z=proposal.task.spot.z;p.path=[];p.motion=null;p.moveCooldown=0;}return proposal;}
const quantity=(w:World,item:string)=>w.piles.filter(p=>p.item===item).reduce((n,p)=>n+p.quantity,0);

test('adoption is prospective and deposits are finite, sorted, unique and selected within exactly21 cells',()=>{
  const {w,d}=camp(),rng=w.rng;delete w.deepResources;w.schemaVersion=214 as World['schemaVersion'];adoptDeepResources(w);expect(w.deepResources).toBeUndefined();
  w.schemaVersion=215 as World['schemaVersion'];adoptDeepResources(w);expect(w.deepResources!.cells).toEqual([]);expect(w.rng).toBe(rng);
  const cells=[{x:d.x+2,z:d.z+1},{x:d.x-2,z:d.z},{x:d.x,z:d.z}];
  expect(addDeepDeposit(w,'gold',[...cells,cells[0]!])).toBe(3);expect(addDeepDeposit(w,'steel',[d])).toBe(0);
  expect(w.deepResources!.cells.map(c=>c.index)).toEqual(w.deepResources!.cells.map(c=>c.index).sort((a,b)=>a-b));
  expect(DEEP_RADIAL.slice(0,21).every(c=>c.x*c.x+c.z*c.z<=5)).toBe(true);expect(nextDeepResource(w,d)!.cell).toEqual({x:d.x,z:d.z});
  w.deepResources!.cells=[];addDeepDeposit(w,'silver',[{x:d.x+2,z:d.z+2}]);expect(nextDeepResource(w,d)).toBeUndefined();
});

test('strict10000 work threshold, physical output, raw reserve debit and Mining XP share one executable contact',()=>{
  const {w,p,d}=camp(),rng=w.rng;begin(w,p,d);d.deepDrill={progress:9990,yieldPct:.999,rng:123};
  processDeepWork(w,p,context(w,p));expect(d.deepDrill.progress).toBe(10000);expect(quantity(w,'steel')).toBe(0);expect(deepResourceAt(w,d)!.count).toBe(300);
  processDeepWork(w,p,context(w,p));expect(d.deepDrill.progress).toBe(9);expect(quantity(w,'steel')).toBe(45);expect(deepResourceAt(w,d)!.count).toBe(255);
  expect(p.skills.mining!.xp).toBe(1300);expect(w.rng).toBe(rng);
  const spot=deepWorkSpot(d);expect(w.piles.every(i=>i.owner.type!=='ground'||(i.owner.x!==d.x||i.owner.z!==d.z)&&(i.owner.x!==spot.x||i.owner.z!==spot.z))).toBe(true);
});

test('every delivered ore portion debits finite raw stock and a depleted drill produces one local-stone chunk',()=>{
  for(const item of ['steel','gold','silver','plasteel','uranium','jade'] as const){
    const {w,p,d}=camp();w.deepResources!.cells=[];addDeepDeposit(w,item,[d],7);begin(w,p,d);
    d.deepDrill={progress:10000,yieldPct:1,rng:123};processDeepWork(w,p,context(w,p));expect(deepResourceAt(w,d)).toBeUndefined();expect(quantity(w,item)).toBe(7);
    d.deepDrill={progress:10000,yieldPct:1,rng:1};processDeepWork(w,p,context(w,p));expect(w.piles.filter(i=>i.kind==='chunk').reduce((n,i)=>n+i.quantity,0)).toBe(1);
    expect(DEEP_RESOURCES[item].portion).toBeGreaterThanOrEqual(7);
  }
});

test('uranium and jade extract their Core 15-unit portions and keep the real remainder',()=>{
  for(const item of ['uranium','jade'] as const){
    const {w,p,d}=camp();w.deepResources!.cells=[];expect(addDeepDeposit(w,item,[d])).toBe(1);begin(w,p,d);
    d.deepDrill={progress:10000,yieldPct:1,rng:12345};processDeepWork(w,p,context(w,p));
    expect(quantity(w,item)).toBe(15);expect(deepResourceAt(w,d)).toMatchObject({item,count:285});expect(validateWorld(w)).toEqual([]);
  }
});

test('MiningYield changes physical output rather than creating or preserving raw reserve units',()=>{
  const {w,p,d}=camp();begin(w,p,d);d.deepDrill={progress:10000,yieldPct:.5,rng:1};processDeepWork(w,p,context(w,p));
  expect(deepResourceAt(w,d)!.count).toBe(255);expect(quantity(w,'steel')).toBeGreaterThanOrEqual(22);expect(quantity(w,'steel')).toBeLessThanOrEqual(23);
});

test('a saturated floor blocks the final portion atomically, preserving RNG, work, XP and reserve until space returns',()=>{
  const {w,p,d}=camp();begin(w,p,d);d.deepDrill={progress:10000,yieldPct:1,rng:123};
  for(const c of nearbyGround(w,deepWorkSpot(d)))if(!groundPile(w,c)&&groundCapacity(w,c,'wood')>0)w.piles.push({id:w.nextId++,kind:'wood',item:'wood',quantity:1,owner:{type:'ground',...c}});
  const before=structuredClone({state:d.deepDrill,reserve:w.deepResources,skill:p.skills.mining,rng:w.rng});processDeepWork(w,p,context(w,p));
  expect({state:d.deepDrill,reserve:w.deepResources,skill:p.skills.mining,rng:w.rng}).toEqual(before);expect(quantity(w,'steel')).toBe(0);
  w.piles=[];processDeepWork(w,p,context(w,p));expect(quantity(w,'steel')).toBeGreaterThan(0);expect(deepResourceAt(w,d)!.count).toBe(255);
});

test('operator claims, priority, power, roof and removal intents prevent work while preserving acquired progress',()=>{
  const {w,p,r,d,s}=camp();begin(w,p,d);r.priorities.mine=1;expect(deepWorkProposal(w,r,d,reach(w,r))).toBeUndefined();
  d.deepDrill={progress:100,yieldPct:.01,rng:1};d.power!.on=false;expect(reconcileDeepWork(w,p)).toBe(false);expect(p.deepWork).toBeUndefined();expect(d.deepDrill.progress).toBe(100);
  d.power!.on=true;begin(w,p,d);p.priorities.mine=0;expect(reconcileDeepWork(w,p)).toBe(false);p.priorities.mine=1;
  begin(w,p,d);w.jobs.push({id:w.nextId++,kind:'uninstall',x:d.x,z:d.z,orientation:0,footprint:'standard',status:'pending',reservedBy:null,progress:0,escrow:{wood:0,food:0},furniture:{structureId:d.id,kind:d.kind}});
  expect(reconcileDeepWork(w,p)).toBe(false);expect(d.deepDrill.progress).toBe(100);
  w.roofing={constructed:[s.z*w.width+s.x],build:[],remove:[],cursor:0};expect(deepWorkReason(w,r,s)).toMatch(/ciel ouvert/);
});

test('scanner discovery needs real contact and59Core hash checks; its guarantee, private stream and clipping produce finite cells',()=>{
  const {w,r,s}=camp(),rng=w.rng;begin(w,r,s,false);s.deepScanner={daysWorking:6};processDeepWork(w,r,context(w,r));expect(w.deepResources!.discoveries).toBe(0);
  const spot=deepWorkSpot(s);Object.assign(r,{x:spot.x,z:spot.z,path:[],motion:null,moveCooldown:0});
  for(let n=0;n<7&&!w.deepResources!.discoveries;n++){w.tick++;processDeepWork(w,r,context(w,r));}
  expect(w.deepResources!.discoveries).toBe(1);expect(s.deepScanner.daysWorking).toBeLessThan(.01);expect(w.rng).toBe(rng);expect(r.skills.intellectual!.xp).toBeGreaterThanOrEqual(350);
  expect(w.deepResources!.cells.every(c=>c.count===300)).toBe(true);expect(deepScannerOverlayPowered(w)).toBe(true);s.power!.on=false;expect(deepScannerOverlayPowered(w)).toBe(false);
});

test('discovery is deterministic and cannot overwrite reserves or create ore in water or at the no-build edge',()=>{
  const {w}=camp(),copy=structuredClone(w);expect(discoverDeepDeposit(w)).toBe(true);expect(discoverDeepDeposit(copy)).toBe(true);expect(w.deepResources).toEqual(copy.deepResources);
  expect(w.deepResources!.cells.every(c=>c.index%w.width>=5&&c.index%w.width<w.width-5&&Math.floor(c.index/w.width)>=5&&Math.floor(c.index/w.width)<w.height-5)).toBe(true);
  const previous=structuredClone(w.deepResources!.cells);w.tiles=w.tiles.map(()=>({terrain:'water'}));expect(discoverDeepDeposit(w)).toBe(false);expect(w.deepResources!.cells).toEqual(previous);
});

test('schema 382 uses all six discovery weights; a pre-382 world retains the four-kind draw and admission',()=>{
  for(const [seed,item,min,max,legacyItem] of [[51,'uranium',4,10,'silver'],[56,'jade',1,4,'plasteel']] as const){
    const {w}=camp();w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.deepResources!.cells=[];w.deepResources!.rng=seed;
    const historical=structuredClone(w);historical.schemaVersion=381 as World['schemaVersion'];
    expect(addDeepDeposit(historical,item,[{x:10,z:10}])).toBe(0);
    expect(discoverDeepDeposit(historical)).toBe(true);expect(historical.deepResources!.cells.every(c=>c.item===legacyItem)).toBe(true);
    expect(discoverDeepDeposit(w)).toBe(true);expect(w.deepResources!.cells.length).toBeGreaterThanOrEqual(min);expect(w.deepResources!.cells.length).toBeLessThanOrEqual(max);
    expect(w.deepResources!.cells.every(c=>c.item===item&&c.count===300)).toBe(true);
  }
});

test('a successful first interior random-cell attempt does not traverse the full map',()=>{
  const {w}=camp();w.deepResources!.cells=[];w.deepResources!.rng=51;
  let reads=0;w.tiles=new Proxy(w.tiles.map(()=>({terrain:'grass' as const})),{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))reads++;return Reflect.get(target,key,receiver);}});
  expect(discoverDeepDeposit(w)).toBe(true);expect(reads).toBeLessThanOrEqual(11);
});

test('native radial drilling uses the complete Core Mono tie order reflected with the imported map',()=>{
  const native=Array.from({length:25600},(_,i)=>({x:Math.floor(i/160)-80,z:i%160-80}));
  monoIntrospectiveSort(native,(a,b)=>a.x*a.x+a.z*a.z-b.x*b.x-b.z*b.z);
  expect(CORE_DEEP_RADIAL_382).toEqual(native.slice(0,60).map(c=>({x:c.x,z:-c.z||0})));
  const {w,d}=camp();w.deepResources!.cells=[];addDeepDeposit(w,'steel',[{x:d.x-1,z:d.z}]);addDeepDeposit(w,'gold',[{x:d.x+1,z:d.z}]);
  expect(nextDeepResource(w,d)!.item).toBe('gold');w.schemaVersion=381 as World['schemaVersion'];expect(nextDeepResource(w,d)!.item).toBe('steel');
});

test('modern scanning requires the drill terrain affordance, not merely a terrain name different from water',()=>{
  const {w}=camp();w.deepResources!.cells=[];
  for(const terrain of ['water-deep','ocean-deep','water-shallow','river-shallow','mud','marsh'] as const){
    w.tiles=w.tiles.map(()=>({terrain}));const before=structuredClone(w.deepResources);
    expect(discoverDeepDeposit(w)).toBe(false);expect(w.deepResources).toEqual(before);
  }
  w.tiles=w.tiles.map(()=>({terrain:'water-shallow',bridge:true}));
  expect(discoverDeepDeposit(w)).toBe(true);
});

test('geographic fallback uses the real base stone or the local Core seeded rock selection, and sea ice has no bedrock',()=>{
  const {w,p,r,d,s}=camp(),before=w.rng;
  w.site={revision:3,biome:'temperate-forest',stones:['granite','slate','limestone']} as NonNullable<World['site']>;
  const index=d.z*w.width+d.x;w.tiles[index]={terrain:'rough-stone',stone:'slate'};
  expect(deepRockItem(w,d)).toBe('slate-chunk');
  w.tiles[index]={terrain:'soil-natural'};
  const seed=hashCombineInt(hashCombineInt(hashCombineInt(0,d.x),0),w.height-1-d.z);
  expect(deepRockItem(w,d)).toBe(`${w.site.stones[new VerseRand(seed).range(0,3)]}-chunk`);expect(w.rng).toBe(before);
  w.site={...w.site,biome:'sea-ice'} as NonNullable<World['site']>;
  expect(deepRockItem(w,d)).toBeUndefined();const reserves=structuredClone(w.deepResources);
  expect(discoverDeepDeposit(w)).toBe(false);expect(w.deepResources).toEqual(reserves);
  expect(deepWorkReason(w,r,s)).toBe('Absence de socle rocheux.');
  expect(deepWorkReason(w,p,d)).toBeUndefined();w.deepResources!.cells=[];
  expect(deepWorkReason(w,p,d)).toBe('Absence de socle rocheux.');
});

test('the real planner moves an operator, resumes a mid-portion save and exhausts the same finite reserve deterministically',()=>{
  const {w,p,d,s}=camp();s.power!.switchOn=false;s.power!.on=false;
  expect(validateWorld(w)).toEqual([]);
  for(let i=0;i<180&&!d.deepDrill;i++)stepWorld(w);expect(p.deepWork?.kind).toBe('drill');expect(d.deepDrill?.progress).toBeGreaterThan(0);
  d.deepDrill!.progress=9990;d.deepDrill!.yieldPct=.999;
  const loaded=deserializeWorld(serializeWorld(w));expect(loaded).not.toBeNull();if(!loaded)throw Error('Deep work resume failed');
  for(let i=0;i<4;i++){stepWorld(w);stepWorld(loaded);}
  expect(serializeWorld(loaded)).toBe(serializeWorld(w));expect(quantity(w,'steel')).toBeGreaterThan(0);expect(deepResourceAt(w,d)!.count).toBe(255);
});
