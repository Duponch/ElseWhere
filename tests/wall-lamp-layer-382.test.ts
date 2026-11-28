import {expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {applyCommand,canDesignate,createWorld,stepWorld} from '../src/sim/engine';
import {newPowerState} from '../src/sim/power-rules';
import {PowerTopologyCache,bestPowerParent,validPowerParent} from '../src/sim/power-topology';
import {furnitureDelay} from '../src/sim/furniture-travel';
import {sharesConstructionLayer} from '../src/sim/power-grid';
import {reconcileRepairs} from '../src/sim/repairs';
import {serializeWorld,deserializeWorld,validateWorld} from '../src/sim/serialization';
import {refreshStock,addGroundMaterial} from '../src/sim/materials';
import {mapObjectsAt} from '../src/ui/map-object-selection';
import {fixtureBuilding} from './scenarios/deconstruction';
import {readRwsSave} from '../src/import/rimworld/rws-save';
import {convertRwsSave} from '../src/import/rimworld/convert';
import type {World,Structure} from '../src/sim/types';

function map(seed=382):World {
 const w=createWorld(seed,40,40);w.tiles=w.tiles.map(()=>({terrain:'grass'}));w.resources=[];w.piles=[];w.jobs=[];w.structures=[];w.stockpiles=[];
 const p=w.pawns[0]!;w.pawns=[p];p.x=8;p.z=8;p.path=[];p.state='idle';p.hunger=100;p.rest=100;p.recreation.level=100;
 p.schedule.fill('work');for(const k of Object.keys(p.priorities) as (keyof typeof p.priorities)[])p.priorities[k]=0;
 p.priorities.build=1;p.priorities.haul=1;p.skills.construction={level:10,xp:0,dailyXp:0,passion:0};refreshStock(w);return w;
}
function support(w:World,x:number,z:number){return Object.assign(fixtureBuilding(w,'wall',x,z),{material:'wood'});}
function lamp(w:World,x:number,z:number,orientation:0|1|2|3):Structure{return Object.assign(fixtureBuilding(w,'wall-lamp',x,z,orientation),{material:'steel' as const,power:newPowerState('wall-lamp')});}
it('allows only different attachment faces and non-full Core buildings, and preserves the floor movement cost in either source order',()=>{
 const w=map();support(w,21,20);support(w,19,20);
 const table=Object.assign(fixtureBuilding(w,'table',20,20),{material:'wood'}),from={x:20,z:19},cell={x:20,z:20};
 const cost=furnitureDelay(w,from,cell);
 const a=lamp(w,20,20,1),b=lamp(w,20,20,3);
 expect(sharesConstructionLayer('wall-lamp','table',381)).toBe(true);
 expect(sharesConstructionLayer('wall-lamp','table',382)).toBe(false);
 for(const kind of ['wall','door','autodoor','cooler','vent','fence-gate','geothermal-generator','nutrient-paste-dispenser'])expect(sharesConstructionLayer('wall-lamp',kind,382),kind).toBe(true);
 expect(sharesConstructionLayer('wall-lamp','wall-lamp',382,1,1)).toBe(true);expect(sharesConstructionLayer('wall-lamp','wall-lamp',382,1,3)).toBe(false);
 expect(furnitureDelay(w,from,cell)).toBe(cost);expect(validateWorld(w)).toEqual([]);
 expect(mapObjectsAt(w,cell).filter(s=>s.kind==='structure').map(s=>s.id)).toEqual(expect.arrayContaining([table.id,a.id,b.id]));
 w.structures=[...w.structures].reverse();expect(furnitureDelay(w,from,cell)).toBe(cost);expect(validateWorld(w)).toEqual([]);
 const state=serializeWorld(w);expect(serializeWorld(deserializeWorld(state))).toBe(state);
 w.structures.push({...a,id:w.nextId++});expect(validateWorld(w)).toContain('Overlapping footprints.');
});
it('constructs above an existing floor object and forbids a duplicate plan on the same wall without excluding another face',()=>{
 const w=map(383);support(w,21,20);support(w,19,20);
 Object.assign(fixtureBuilding(w,'table',20,20),{material:'wood'});
 const order={type:'designate' as const,kind:'wall-lamp' as const,x:20,z:20,orientation:1 as const,material:'steel' as const};
 expect(applyCommand(w,order).ok).toBe(true);
 expect(canDesignate(w,order).ok).toBe(false);expect(canDesignate(w,{...order,orientation:3}).ok).toBe(true);
 addGroundMaterial(w,'steel',15,{x:12,z:12});refreshStock(w);
 for(let i=0;i<3500&&!w.structures.some(s=>s.kind==='wall-lamp');i++)stepWorld(w);
 expect(w.structures.some(s=>s.kind==='wall-lamp'&&s.x===20&&s.z===20)).toBe(true);
 expect(w.structures.some(s=>s.kind==='table')).toBe(true);expect(validateWorld(w)).toEqual([]);
},60000);
it('keeps independent repair orders when both an attachment and its underlying furniture are damaged',()=>{
 const w=map(385);support(w,21,20);w.home=[20*w.width+20];
 const table=Object.assign(fixtureBuilding(w,'table',20,20),{material:'wood',damage:10});
 const a=lamp(w,20,20,1);reconcileRepairs(w);
 expect(w.jobs.filter(j=>j.repair).map(j=>j.repair!.structureId)).toEqual([table.id]);
 a.damage=5;reconcileRepairs(w);reconcileRepairs(w);
 expect(w.jobs.filter(j=>j.repair).map(j=>j.repair!.structureId)).toEqual([table.id,a.id]);
 expect(validateWorld(w)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(w)))).toBe(serializeWorld(w));
});
it('uses the support wall as the power origin and migrates only the old out-of-range parent',()=>{
 const w=map(384);support(w,21,20);const a=lamp(w,20,20,1);
 const old=Object.assign(fixtureBuilding(w,'power-conduit',14,20),{material:'steel',power:newPowerState('power-conduit')});
 const proper=Object.assign(fixtureBuilding(w,'power-conduit',27,20),{material:'steel',power:newPowerState('power-conduit')});
 const topology=new PowerTopologyCache().read(w);
 expect(validPowerParent(topology,a,old.id,381)).toBe(true);expect(validPowerParent(topology,a,old.id,382)).toBe(false);
 expect(bestPowerParent(topology,a,undefined,382)).toBe(proper.id);expect(bestPowerParent(topology,a,undefined,381)).toBe(old.id);
 a.power!.parentId=old.id;const raw={...w,schemaVersion:381};const loaded=deserializeWorld(JSON.stringify(raw));
 expect(loaded.structures.find(s=>s.id===a.id)!.power).toMatchObject({on:false,parentId:proper.id});expect(validateWorld(loaded)).toEqual([]);
 expect(loaded.rng).toBe(w.rng);expect(loaded.nextId).toBe(w.nextId);
});
it('imports a Core lamp and a chair sharing the same cell without losing either identity',()=>{
 const fixture=readFileSync('tests/fixtures/rws/petite-colonie.rws','utf8');
 const added='<thing Class="Building"><def>DiningChair</def><id>DiningChair888</id><map>0</map><pos>(3, 0, 3)</pos><stuff>WoodLog</stuff><quality>Normal</quality></thing><thing Class="Building"><def>WallLamp</def><id>WallLamp889</id><map>0</map><pos>(3, 0, 3)</pos><rot>2</rot><health>35</health></thing>';
 const imported=convertRwsSave(readRwsSave(fixture.replace('</things>',added+'</things>')),{planet:false});
 const chair=imported.world.structures.find(s=>s.id===imported.thingIds.get('DiningChair888'))!,light=imported.world.structures.find(s=>s.id===imported.thingIds.get('WallLamp889'))!;
 expect(chair).toMatchObject({kind:'dining-chair'});expect(light).toMatchObject({kind:'wall-lamp',x:chair.x,z:chair.z});
 expect(validateWorld(imported.world)).toEqual([]);expect(serializeWorld(deserializeWorld(serializeWorld(imported.world)))).toBe(serializeWorld(imported.world));
},60000);
