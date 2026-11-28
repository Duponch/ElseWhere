import {expect,test} from 'vitest';
import {applyCommand,deserializeWorld,serializeWorld,stepWorld,validateWorld} from '../src/sim/index';
import {FORESTRY_SPECIES_291,forestNativeSpecies291,forestSowingChoices291,growingPlantSowTicks291,isGrowingPlantInVersion291,TREE_SOWING_COST_291} from '../src/sim/forestry-content-291';
import {finishSowing,growingJobValid,jobDuration,scheduleGrowing,sowingJobAllowed} from '../src/sim/farming';
import {createPlantLife} from '../src/sim/plant-life';
import {FLORA_DEFINITIONS} from '../src/sim/biome-flora';
import {plantGrowth} from '../src/sim/plants';
import {gatherResource} from '../src/sim/gathering';
import {workProgress} from '../src/sim/work-progress';
import {forestryCamp471} from './scenarios/forestry-v471';
import type {Job,Resource,World} from '../src/sim/types';

const cell=(w:World,x=12,z=10)=>z*w.width+x;
function discover(w:World):Job[]{scheduleGrowing(w);return w.jobs.filter(j=>j.growingZoneId!==undefined);}
function preparedPlant(w:World,resource:Partial<Resource>&Pick<Resource,'kind'>):Resource{
 const species=resource.species,def=species?FLORA_DEFINITIONS[species]:undefined;
 const plant:Resource={id:w.nextId++,x:12,z:10,amount:def?.yield??6,growth:.1,growthTick:w.tick,...resource};plant.plantLife=createPlantLife(w,plant);
 w.resources=[...w.resources,plant];if(species&&w.flora?.revision===1&&!plant.sown291)w.flora.capacity++;
 return plant;
}
function until(w:World,predicate:()=>boolean,limit=1800):void{for(let n=0;n<limit&&!predicate();n++)stepWorld(w);expect(predicate(),`tick ${w.tick}`).toBe(true);}
function accepted(w:World,job:Job):void{const p=w.pawns[0]!;job.reservedBy=p.id;job.status='active';p.jobId=job.id;}

test('forest choices use positive indigenous biome flora and acquired research, never physical tree presence',()=>{
 const w=forestryCamp471(false);expect(forestNativeSpecies291(w)).toEqual(['oak','poplar']);expect(forestSowingChoices291(w)).toEqual([]);
 preparedPlant(w,{kind:'tree',species:'palm'});expect(forestNativeSpecies291(w)).toEqual(['oak','poplar']);
 w.research!.treeSowing291={points:TREE_SOWING_COST_291,completedAt:w.tick};expect(forestSowingChoices291(w)).toEqual(['oak','poplar']);
 delete w.site;expect(forestNativeSpecies291(w)).toEqual([]);expect(forestSowingChoices291(w)).toEqual([]);
});

test('all thirteen existing species use400 local sowing work without becoming CropKind and future291 additions stay closed',()=>{
 expect(FORESTRY_SPECIES_291).toHaveLength(13);for(const species of FORESTRY_SPECIES_291){expect(growingPlantSowTicks291(species)).toBe(400);expect(isGrowingPlantInVersion291(species,291)).toBe(true);expect(isGrowingPlantInVersion291(species,290)).toBe(false);}
 expect(isGrowingPlantInVersion291('rice',290)).toBe(true);for(const version of [291,292,293]){expect(isGrowingPlantInVersion291('rice',version)).toBe(true);expect(isGrowingPlantInVersion291('oak',version)).toBe(true);}expect(isGrowingPlantInVersion291('rice',294)).toBe(false);expect(isGrowingPlantInVersion291('oak',294)).toBe(false);
});

test('a foreign essence, absent research and a roof admit no new forest sowing work',()=>{
 const w=forestryCamp471();w.growingZones=[{...w.growingZones[0]!,plant:'palm'}];expect(discover(w)).toEqual([]);
 w.growingZones=[{...w.growingZones[0]!,plant:'poplar'}];delete w.research!.treeSowing291;expect(discover(w)).toEqual([]);
 w.research!.treeSowing291={points:TREE_SOWING_COST_291,completedAt:w.tick};w.roofing={constructed:[cell(w)],build:[],remove:[],cursor:0};expect(discover(w)).toEqual([]);
});

test('Plants6 gates admission only; accepted sowing survives a later loss of skill and roof',()=>{
 const w=forestryCamp471(),p=w.pawns[0]!,job=discover(w)[0]!;expect(job.kind).toBe('sow');expect(jobDuration(w,job)).toBe(400);
 p.skills.plants!.level=5;expect(sowingJobAllowed(w,p,job)).toBe(false);p.skills.plants!.level=6;expect(sowingJobAllowed(w,p,job)).toBe(true);accepted(w,job);
 p.skills.plants!.level=5;w.roofing={constructed:[cell(w)],build:[],remove:[],cursor:0};expect(growingJobValid(w,job)).toBe(true);
 finishSowing(w,job);expect(w.resources[0]).toMatchObject({kind:'tree',species:'poplar',sown291:true,growth:.0001});expect(w.resources[0]!.plantLife?.bornAt).toBe(w.tick);
});

test('forest temperature admission is strict at zero and uses the actual species upper bound',()=>{
 const w=forestryCamp471(),job=discover(w)[0]!,p=w.pawns[0]!;w.thermal={regions:[{cells:[cell(w)],temperature:0}]};expect(sowingJobAllowed(w,p,job)).toBe(false);
 w.thermal.regions[0]!.temperature=58;expect(sowingJobAllowed(w,p,job)).toBe(false);w.thermal.regions[0]!.temperature=57.9;expect(sowingJobAllowed(w,p,job)).toBe(true);
 w.site={revision:2,biome:'arid-shrubland',hilliness:'flat',river:'none',stones:['granite','limestone']};w.growingZones=[{...w.growingZones[0]!,plant:'saguaro'}];w.thermal.regions[0]!.temperature=58;expect(sowingJobAllowed(w,p,job)).toBe(true);w.thermal.regions[0]!.temperature=75;expect(sowingJobAllowed(w,p,job)).toBe(false);
});

test('eight-neighbour cultivated crops protect their own zones and block even diagonally',()=>{
 const w=forestryCamp471();preparedPlant(w,{kind:'rice',x:13,z:11});w.growingZones=[...w.growingZones,{id:w.nextId++,plant:'rice',cells:[cell(w,13,11)],allowSow:true,allowCut:true}];
 expect(discover(w)).toEqual([]);expect(w.resources).toHaveLength(1);
 w.growingZones=[w.growingZones[0]!];const clear=discover(w)[0]!;expect(clear).toMatchObject({kind:'cut',x:13,z:11});expect(growingJobValid(w,clear)).toBe(true);
});

test('a wanted same-species tree remains protected even with allowCut enabled in both adjacent zones',()=>{
 const w=forestryCamp471();preparedPlant(w,{kind:'tree',species:'poplar',x:13,z:11});w.growingZones=[...w.growingZones,{id:w.nextId++,plant:'poplar',cells:[cell(w,13,11)],allowSow:true,allowCut:true}];
 expect(discover(w)).toEqual([]);expect(w.resources).toHaveLength(1);
});

test('unwanted young adjacent trees use executable CUT rather than a permanently refused CHOP',()=>{
 const w=forestryCamp471(),source=preparedPlant(w,{kind:'tree',species:'oak',x:13,z:11,growth:.1}),job=discover(w)[0]!;
 expect(job).toMatchObject({kind:'cut',x:13,z:11});expect(growingJobValid(w,job)).toBe(true);expect(gatherResource(w,source,'cut',job.id,w.pawns[0])).toBe(0);expect(w.resources).toEqual([]);expect(w.piles).toEqual([]);
});

test('accepted SOW reserves spacing before birth and releasing it immediately frees a neighbouring candidate',()=>{
 const w=forestryCamp471();w.growingZones=[{...w.growingZones[0]!,cells:[cell(w),cell(w,13,11)]}];const jobs=discover(w),first=jobs.find(j=>j.x===12)!,second=jobs.find(j=>j.x===13)!;
 expect(jobs).toHaveLength(2);expect(sowingJobAllowed(w,w.pawns[0]!,second)).toBe(true);accepted(w,first);expect(sowingJobAllowed(w,w.pawns[0]!,second)).toBe(false);expect(growingJobValid(w,first)).toBe(true);
 first.reservedBy=null;first.status='pending';w.pawns[0]!.jobId=null;expect(sowingJobAllowed(w,w.pawns[0]!,second)).toBe(true);expect(w.resources).toEqual([]);
});

test('an accepted forest intention also prevents an adjacent crop from being admitted',()=>{
 const w=forestryCamp471();w.growingZones=[...w.growingZones,{id:w.nextId++,plant:'rice',cells:[cell(w,13,11)],allowSow:true,allowCut:true}];const jobs=discover(w),tree=jobs.find(j=>j.x===12)!,crop=jobs.find(j=>j.x===13)!;
 accepted(w,tree);expect(sowingJobAllowed(w,w.pawns[0]!,crop)).toBe(false);
});

test('young desired trees persist and automatic chopping uses the strict Mature boundary rather than manual growth',()=>{
 const w=forestryCamp471(),source=preparedPlant(w,{kind:'tree',species:'poplar',growth:.4});w.growingZones=[{...w.growingZones[0]!,allowSow:false,allowCut:false}];
 expect(discover(w)).toEqual([]);source.growth=.999;expect(discover(w)).toEqual([]);source.growth=.999001;const job=discover(w)[0]!;expect(job.kind).toBe('chop');expect(growingJobValid(w,job)).toBe(true);expect(source.sown291).toBeUndefined();
});

test('allowCut protects another species but never suppresses harvesting a mature desired tree',()=>{
 const w=forestryCamp471(),source=preparedPlant(w,{kind:'tree',species:'oak',growth:1});w.growingZones=[{...w.growingZones[0]!,allowSow:false,allowCut:false}];expect(discover(w)).toEqual([]);
 w.growingZones=[{...w.growingZones[0]!,plant:'oak'}];expect(discover(w)[0]!.kind).toBe('chop');expect(w.resources[0]).toBe(source);
});

test('legacy known temperate site gives a factual birth without acquiring climate or wild spawning',()=>{
 const w=forestryCamp471();delete w.climate;delete w.flora;w.site={revision:1,biome:'temperate-forest',hilliness:'flat',river:'none',stones:['granite','limestone']};const job=discover(w)[0]!;accepted(w,job);finishSowing(w,job);
 expect(w.resources[0]!.plantLife?.bornAt).toBe(w.tick);expect(w.resources[0]).toMatchObject({kind:'tree',species:'poplar',sown291:true});expect(w.climate).toBeUndefined();expect(w.flora).toBeUndefined();
});

test('final creation rechecks the actual occupancy, zone and identity bound before awarding a plant',()=>{
 const w=forestryCamp471(),job=discover(w)[0]!;accepted(w,job);const next=w.nextId;preparedPlant(w,{kind:'rice'});finishSowing(w,job);expect(w.resources).toHaveLength(1);expect(w.resources[0]!.kind).toBe('rice');expect(w.nextId).toBe(next+1);
 w.resources=[];w.growingZones=[];finishSowing(w,job);expect(w.resources).toEqual([]);
});

test('real travel earns no Plants XP, paid sowing creates one young tree and whole work checkpoints resume exactly',()=>{
 const w=forestryCamp471(),p=w.pawns[0]!;let checkpoint:string|undefined,sawTravel=false;
 until(w,()=>{
  const job=w.jobs.find(j=>j.kind==='sow');if(job&&workProgress(job)===0&&p.path.length){sawTravel=true;expect(p.skills.plants!.xp).toBe(0);expect(w.resources).toEqual([]);}
  if(job&&workProgress(job)>0){expect(p.skills.plants!.xp).toBeGreaterThan(0);checkpoint??=serializeWorld(w);}
  return w.resources.some(r=>r.sown291===true);
 });
 expect(sawTravel).toBe(true);expect(checkpoint).toBeDefined();const tree=w.resources.find(r=>r.sown291)!;expect(tree).toMatchObject({kind:'tree',species:'poplar',amount:27});expect(plantGrowth(w,tree)).toBeLessThan(.01);expect(tree.plantLife?.bornAt).toBeDefined();expect(w.piles).toEqual([]);expect(validateWorld(w)).toEqual([]);
 const a=deserializeWorld(checkpoint!),b=deserializeWorld(checkpoint!);stepWorld(a,24);stepWorld(b,24);expect(serializeWorld(a)).toBe(serializeWorld(b));
});

test('a prepared mature checkpoint yields physical wood, hauls it to storage and starts a newly paid sowing cycle',()=>{
 const w=forestryCamp471(),source=preparedPlant(w,{kind:'tree',species:'poplar',growth:1,sown291:true});const storage={x:17,z:10};expect(applyCommand(w,{type:'stockpile',enabled:true,...storage,filters:{wood:true,food:false}}).ok).toBe(true);let carried:string|undefined;
 until(w,()=>{if(w.pawns[0]!.haul?.phase==='deliver')carried??=serializeWorld(w);return !w.resources.some(r=>r.id===source.id)&&w.piles.some(p=>p.item==='wood'&&p.owner.type==='ground'&&p.owner.x===storage.x&&p.owner.z===storage.z);},2600);
 expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(27);expect(carried).toBeDefined();
 // Core 1.6 leaves a real DeadPlant on a mature chop: the next forest
 // sowing must clear its own stump first, not silently erase it.
 expect(w.resources.find(r=>r.species==='chopped-stump')).toMatchObject({x:source.x,z:source.z,growth:1,amount:4});
 const a=deserializeWorld(carried!),b=deserializeWorld(carried!);stepWorld(a,24);stepWorld(b,24);expect(serializeWorld(a)).toBe(serializeWorld(b));
 until(w,()=>w.resources.some(r=>r.sown291&&r.id!==source.id),1800);expect(w.resources.filter(r=>r.kind==='tree')).toHaveLength(1);expect(w.resources.some(r=>r.species==='chopped-stump')).toBe(false);expect(w.piles.filter(p=>p.item==='wood').reduce((n,p)=>n+p.quantity,0)).toBe(30);
});
