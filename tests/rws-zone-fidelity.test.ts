import {expect,test} from 'vitest';
import {applyCommand,stepWorld,validateWorld,serializeWorld,deserializeWorld} from '../src/sim/index';
import {scheduleGrowing,growingJobValid} from '../src/sim/farming';
import {createPlantLife} from '../src/sim/plant-life';
import {FLORA_DEFINITIONS,type PlantSpecies} from '../src/sim/biome-flora';
import {forestryCamp471} from './scenarios/forestry-v471';
import {medicalCamp} from './scenarios/health';
import {fixtureBuilding} from './scenarios/deconstruction';
import {groundOccupancyAllows,storageOccupancyAllows,storageOccupancyAllowsIndexed} from '../src/sim/occupancy';
import {createWildPlantResource256} from '../src/sim/wild-plant-acquisition-v256';
import {actualPlantPhysicalMasks256} from '../src/sim/actual-plant-physical-masks-256';
import {conduitKeepsPlant} from '../src/sim/power-construction';
import {constructionFinalWipesPlants,constructionFrameWipesPlants,isConstructionLightPlant} from '../src/sim/construction-plants';
import {newPowerState} from '../src/sim/power-rules';
import type {Resource,World} from '../src/sim/types';

const cell=(w:World,x:number,z:number)=>z*w.width+x;
function plant(w:World,x:number,z:number,species:PlantSpecies):Resource{
 const d=FLORA_DEFINITIONS[species],p:Resource={id:w.nextId++,kind:d.kind,species,x,z,amount:d.yield,growth:1,growthTick:w.tick};
 p.plantLife=createPlantLife(w,p);w.resources=[...w.resources,p];
 if(w.flora?.revision===1)w.flora.capacity++;
 return p;
}
test('sow disabled/cut enabled: mature wild herbs without harvest product stay in the imported growing area, never create invalid harvest',()=>{
 const w=forestryCamp471(false);
 w.growingZones=[{...w.growingZones[0]!,allowSow:false,allowCut:true,cells:[cell(w,12,10),cell(w,13,10),cell(w,14,10),cell(w,15,10)]}];
 const grass=plant(w,12,10,'grass'),bramble=plant(w,13,10,'brambles'),berry=plant(w,14,10,'berry-bush');
 const rice:Resource={id:w.nextId++,kind:'rice',x:15,z:10,amount:6,growth:1,growthTick:w.tick};
 rice.plantLife=createPlantLife(w,rice);w.resources=[...w.resources,rice];
 scheduleGrowing(w);
 const jobs=w.jobs.filter(j=>j.growingZoneId!==undefined);
 expect(jobs.map(j=>[j.kind,j.x])).toEqual([['harvest',berry.x],['harvest',rice.x]]);
 expect(jobs.every(j=>growingJobValid(w,j))).toBe(true);
 expect(w.growingZones[0]!.cells).toHaveLength(4);
 expect(validateWorld(w)).toEqual([]);
 const reloaded=deserializeWorld(serializeWorld(w));
 expect(serializeWorld(reloaded)).toBe(serializeWorld(w));
 // Real later scheduling: no invalid grass harvesting job may be created
 // when the grower proceeds through harvest intents at the other cells.
 for(let i=0;i<120;i++)stepWorld(reloaded);
 expect(validateWorld(reloaded)).toEqual([]);
 expect(reloaded.resources.some(p=>p.id===grass.id)).toBe(true);
 expect(reloaded.resources.some(p=>p.id===bramble.id)).toBe(true);
});
test('sow-enabled weed clearing still creates CUT, and a mature desired crop harvests even when allowCut is false',()=>{
 const w=forestryCamp471(false),p=plant(w,12,10,'grass');
 scheduleGrowing(w);expect(w.jobs.filter(j=>j.growingZoneId!==undefined).map(j=>j.kind)).toEqual(['cut']);
 w.jobs=[];w.resources=w.resources.filter(r=>r!==p);w.growingZones=[{...w.growingZones[0]!,allowCut:false,allowSow:false}];
 const rice:Resource={id:w.nextId++,kind:'rice',x:12,z:10,amount:6,growth:1,growthTick:w.tick};
 rice.plantLife=createPlantLife(w,rice);w.resources=[...w.resources,rice];
 scheduleGrowing(w);expect(w.jobs.filter(j=>j.growingZoneId!==undefined).map(j=>j.kind)).toEqual(['harvest']);
});
test('a compatible zone cell occupied by a horseshoes pin is retained but no sow job is emitted on the blocked cell',()=>{
 const w=forestryCamp471(false);fixtureBuilding(w,'horseshoes',12,10);
 scheduleGrowing(w);expect(w.jobs.filter(j=>j.growingZoneId!==undefined)).toEqual([]);
 expect(w.growingZones[0]!.cells).toEqual([cell(w,12,10)]);
 expect(validateWorld(w)).toEqual([]);
});
test('FirefoamPopper retains the storage designation as Core permits, without turning its nonstandable cell into a storage destination',()=>{
 const w=medicalCamp(1,32),popper={id:w.nextId++,kind:'firefoam-popper' as const,x:12,z:10,orientation:0 as const,footprint:'standard' as const,material:'steel' as const,firefoam290:{autoRebuild:false}};
 w.structures.push(popper);
 w.research={points:0,project:null,firefoam:{points:600_000_000,completedAt:w.tick}};
 const point={x:popper.x,z:popper.z};
 expect(applyCommand(w,{type:'area',action:'stockpile',from:point,to:point}).ok).toBe(true);
 expect(w.stockpiles.some(p=>p.x===point.x&&p.z===point.z)).toBe(true);
 expect(groundOccupancyAllows(w,point)).toBe(true);
 expect(storageOccupancyAllows(w,point)).toBe(false);expect(storageOccupancyAllowsIndexed(w,point)).toBe(false);
 expect(validateWorld(w)).toEqual([]);
 const reloaded=deserializeWorld(serializeWorld(w));
 expect(serializeWorld(reloaded)).toBe(serializeWorld(w));
});
test('actual wild tree birth on an installed conduit remains a valid saved owner; the physical construction Frame remains distinct',()=>{
 const w=forestryCamp471(false),x=13,z=12,index=cell(w,x,z);
 w.growingZones=[];w.structures.push({id:w.nextId++,kind:'power-conduit',x,z,orientation:0,footprint:'standard',material:'steel',power:newPowerState('power-conduit')});
 // Actual rare-capture flora masks, before birth: the wild plant runtime
 // itself has no cover/edifice/BlocksPlanting rejection at this cell.
 const before=actualPlantPhysicalMasks256(w);expect(before.coverOrEdifice[index]).toBe(0);expect(before.blocksPlanting[index]).toBe(0);
 // The ordinary wild reproduction constructor, exactly the owner and
 // growth used by the actual regeneration event of the imported witness.
 const oak=createWildPlantResource256(w,w.nextId++,x,z,'oak',.15,true)!;
 expect(oak).toMatchObject({kind:'tree',species:'oak',x,z,growth:.15});
 expect(isConstructionLightPlant(oak)).toBe(false);
 expect(conduitKeepsPlant('power-conduit',oak.kind)).toBe(true);
 expect(conduitKeepsPlant('power-conduit',oak.kind,380)).toBe(false);
 expect(conduitKeepsPlant('power-conduit','rice',380)).toBe(true);
 expect(conduitKeepsPlant('power-conduit','rock')).toBe(false);
 expect(constructionFrameWipesPlants('power-conduit')).toBe(true);
 expect(constructionFinalWipesPlants('power-conduit')).toBe(false);
 expect(conduitKeepsPlant('wall',oak.kind)).toBe(false);
 w.resources=[...w.resources,oak];if(w.flora?.revision===1)w.flora.capacity++;
 expect(validateWorld(w)).toEqual([]);
 const copy=deserializeWorld(serializeWorld(w));expect(serializeWorld(copy)).toBe(serializeWorld(w));
 expect(copy.resources.find(p=>p.id===oak.id)).toEqual(oak);
});
